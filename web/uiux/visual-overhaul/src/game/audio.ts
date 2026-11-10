// ============================================================================
// SOUL OF HEROES — audio. Original procedural sound design (WebAudio, no assets).
//
// VISUAL ARENA UPGRADE — this is the SAME module the game already called
// (initAudio / setVolume / setAmbience / sfx). It is not a second sound system.
// What changed:
//   * a real mixer: master -> [music | ambience | world | combat | ui] buses,
//     each with its own persisted gain and a smooth fade, plus a global mute;
//   * a compressor/limiter on the master so overlapping combat cannot clip;
//   * per-voice polyphony caps + event dedupe windows so footsteps and machine
//     ticks cannot machine-gun;
//   * spatial attenuation + stereo pan from the camera when a cue has a position;
//   * environment-aware ambience (forest / coast / industrial / underground /
//     night / Ragnarok) driven by real zone + weather + phase state;
//   * machine loops that are OWNED by real station state — a furnace with no
//     fuel is silent, a powered door sounds different from a locked one;
//   * an ORIGINAL adaptive score prototype: three reusable themes (Ashfall /
//     Hearth / Iron) with layered stems that fade in on authentic state changes
//     and long silent gaps during ordinary gathering. Clearly a prototype, not
//     a finished orchestral score.
//
// Licensing: 100% synthesis in this file. No Kenney / RPG Essentials WAV is
// loaded by the Web runtime (those files remain in assets/audio, unused here).
// ============================================================================
import { getPrefs, subscribePrefs } from '../visual/direction';

type Bus = 'music' | 'ambience' | 'world' | 'combat' | 'ui';
let ctx: AudioContext | null = null;
let master: GainNode | null = null, limiter: DynamicsCompressorNode | null = null;
const buses: Partial<Record<Bus, GainNode>> = {};
let vol = 0.6, muted = false;
let noiseBuf: AudioBuffer | null = null;
let pinkBuf: AudioBuffer | null = null;

const BUS_BASE: Record<Bus, number> = { music: 0.34, ambience: 0.5, world: 0.85, combat: 1, ui: 0.7 };

function busGain(b: Bus) {
  const p = getPrefs();
  const v = b === 'music' ? p.music : b === 'ambience' ? p.ambience : b === 'ui' ? p.ui : b === 'combat' ? p.combat : p.world;
  return v * BUS_BASE[b];
}
function applyMix(fade = 0.25) {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, fade);
  for (const b of Object.keys(buses) as Bus[]) buses[b]!.gain.setTargetAtTime(busGain(b), ctx.currentTime, fade);
}
subscribePrefs(() => applyMix());

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 8;
  limiter.attack.value = 0.004; limiter.release.value = 0.18;
  master = ctx.createGain(); master.gain.value = muted ? 0 : vol;
  limiter.connect(master).connect(ctx.destination);
  for (const b of ['music', 'ambience', 'world', 'combat', 'ui'] as Bus[]) {
    const g = ctx.createGain(); g.gain.value = busGain(b); g.connect(limiter); buses[b] = g;
  }
  // white + pink noise beds
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  pinkBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const pd = pinkBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < pd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; pd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
  buildAmbience();
  applyMix(0.01);
}

export function setVolume(v: number, m: boolean) { vol = v; muted = m; applyMix(); }
export function audioReady() { return !!ctx && ctx.state === 'running'; }

// ---------------------------------------------------------------------------
// voice helpers — spatialised, deduped, polyphony-capped
// ---------------------------------------------------------------------------
const last: Record<string, number> = {};
const live: Partial<Record<Bus, number>> = {};
const CAP: Record<Bus, number> = { music: 14, ambience: 6, world: 12, combat: 16, ui: 6 };
let listener = { x: 0, y: 0 };
/** Camera centre in world px; set once per frame by the renderer host. */
export function setListener(x: number, y: number) { listener.x = x; listener.y = y; }

function spatial(e: any, bus: Bus): { g: number; pan: number } | null {
  if (e?.x === undefined || e?.y === undefined) return { g: 1, pan: 0 };
  const dx = e.x - listener.x, dy = e.y - listener.y;
  const d = Math.hypot(dx, dy);
  if (d > 460) return null;                      // inaudible: do not allocate a voice
  const g = 1 / (1 + (d / 150) * (d / 150));
  return { g, pan: Math.max(-0.8, Math.min(0.8, dx / 300)) };
}
function route(node: AudioNode, bus: Bus, pan: number): GainNode | null {
  const b = buses[bus]; if (!ctx || !b) return null;
  if ((live[bus] ?? 0) >= CAP[bus]) return null;
  live[bus] = (live[bus] ?? 0) + 1;
  const g = ctx.createGain();
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p).connect(g); }
  else node.connect(g);
  g.connect(b);
  return g;
}
function release(bus: Bus, after: number) { setTimeout(() => { live[bus] = Math.max(0, (live[bus] ?? 1) - 1); }, after * 1000 + 40); }

function tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number, bus: Bus, delay = 0, pan = 0, detune = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2));
  env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(env);
  const out = route(env, bus, pan); if (!out) { return; }
  out.gain.value = 1;
  o.start(t); o.stop(t + dur + 0.03); release(bus, delay + dur);
}
function noise(dur: number, freq: number, gain: number, bus: Bus, type: BiquadFilterType = 'lowpass', delay = 0, q = 1, pan = 0, pink = false) {
  if (!ctx || !noiseBuf) return; const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = pink ? (pinkBuf || noiseBuf) : noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.25));
  env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f).connect(env);
  const out = route(env, bus, pan); if (!out) return; out.gain.value = 1;
  s.start(t, Math.random()); s.stop(t + dur + 0.03); release(bus, delay + dur);
}

// ---------------------------------------------------------------------------
// ambience — layered beds cross-faded from real environment state
// ---------------------------------------------------------------------------
type Bed = { gain: GainNode; src: AudioBufferSourceNode; filt: BiquadFilterNode };
const beds: Record<string, Bed> = {};
function mkBed(name: string, freq: number, q: number, type: BiquadFilterType, pink: boolean): Bed | null {
  if (!ctx || !buses.ambience || !noiseBuf) return null;
  const s = ctx.createBufferSource(); s.buffer = pink ? (pinkBuf || noiseBuf) : noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(buses.ambience); s.start();
  const bed = { gain: g, src: s, filt: f }; beds[name] = bed; return bed;
}
function buildAmbience() {
  mkBed('rain', 2600, 0.6, 'bandpass', false);
  mkBed('wind', 340, 0.7, 'bandpass', true);
  mkBed('surf', 180, 0.5, 'lowpass', true);
  mkBed('room', 120, 0.9, 'lowpass', true);
  mkBed('rag', 70, 1.2, 'lowpass', true);
}
function bedTo(name: string, v: number, tc = 1.4) {
  const b = beds[name]; if (!b || !ctx) return;
  b.gain.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, tc);
}
/** Legacy signature preserved: Game.tsx already calls this once per second. */
export function setAmbience(rain: number, wind: number) { bedTo('rain', rain * 0.2); bedTo('wind', wind * 0.1); }

export interface EnvState { zone: number; indoors: boolean; sheltered: boolean; night: boolean; rag: boolean; phase: string; nearMachine: number; coast: number }
let envPrev = '';
/** Richer environment mix. Called from the same 1 Hz cadence as setAmbience. */
export function setEnvironment(e: EnvState, rain: number, wind: number) {
  const key = `${e.zone}|${e.indoors}|${e.night}|${e.rag}|${Math.round(e.coast)}`;
  const tc = key === envPrev ? 1.6 : 2.6; envPrev = key;
  bedTo('rain', (e.indoors ? rain * 0.06 : rain * 0.22), tc);
  bedTo('wind', (e.indoors ? 0.02 : wind * 0.1) * (e.zone === 5 ? 1.5 : 1), tc);
  bedTo('surf', e.indoors ? 0 : Math.max(0, 1 - e.coast / 6) * 0.16, tc);
  // industrial hum only where machinery actually is; underground room tone
  bedTo('room', (e.indoors ? 0.1 : 0) + e.nearMachine * 0.07 + (e.zone === 7 ? 0.05 : 0), tc);
  bedTo('rag', e.rag ? 0.24 : e.phase === 'danger' ? 0.1 : 0, 2.2);
}

// ---------------------------------------------------------------------------
// machine loops — owned by REAL station state, never by render frames
// ---------------------------------------------------------------------------
interface MachineVoice { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode; filt: BiquadFilterNode; on: boolean }
const machines = new Map<string, MachineVoice>();
/** kind: furnace | refinery | generator | pump. `running` must come from burn/queue/power. */
export function machineState(id: string, kind: string, running: boolean, x: number, y: number) {
  if (!ctx || !buses.world) return;
  let m = machines.get(id);
  const sp = spatial({ x, y }, 'world');
  if (!running || !sp) {
    if (m?.on) { m.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.35); m.on = false; }
    return;
  }
  if (!m) {
    const osc = ctx.createOscillator(); const sub = ctx.createOscillator();
    const filt = ctx.createBiquadFilter(); const gain = ctx.createGain();
    const base = kind === 'generator' ? 58 : kind === 'refinery' ? 44 : kind === 'pump' ? 36 : 90;
    osc.type = kind === 'generator' ? 'sawtooth' : 'triangle'; osc.frequency.value = base;
    sub.type = 'sine'; sub.frequency.value = base * 0.5;
    filt.type = 'lowpass'; filt.frequency.value = kind === 'furnace' ? 700 : 320; filt.Q.value = 3;
    gain.gain.value = 0;
    osc.connect(filt); sub.connect(filt); filt.connect(gain).connect(buses.world);
    osc.start(); sub.start();
    m = { osc, sub, gain, filt, on: false }; machines.set(id, m);
  }
  if (!m.on) { m.gain.gain.setTargetAtTime(0.05 * sp.g, ctx.currentTime, 0.5); m.on = true; }
  else m.gain.gain.setTargetAtTime(0.05 * sp.g, ctx.currentTime, 0.6);
}
export function stopAllMachines() {
  if (!ctx) return;
  for (const m of machines.values()) { m.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); m.on = false; }
}

// ---------------------------------------------------------------------------
// ORIGINAL adaptive score prototype — "Ashfall", three reusable themes
// ---------------------------------------------------------------------------
type Mood = 'silence' | 'wild' | 'home' | 'ruins' | 'night' | 'combat' | 'elder' | 'ragnarok' | 'aftermath';
let mood: Mood = 'silence';
let moodSince = 0, nextNote = 0, step = 0;
const SCALE = [0, 2, 3, 5, 7, 8, 10];               // natural minor — the island's mode
const ROOT: Record<Mood, number> = { silence: 0, wild: 55, home: 65.41, ruins: 49, night: 49, combat: 55, elder: 41.2, ragnarok: 36.71, aftermath: 65.41 };
const TEMPO: Record<Mood, number> = { silence: 0, wild: 3.2, home: 2.6, ruins: 3.6, night: 4.2, combat: 0.62, elder: 0.5, ragnarok: 0.42, aftermath: 3.0 };

export function setMood(m: Mood, now: number) {
  if (m === mood) return;
  mood = m; moodSince = now; nextNote = 0; step = 0;
}
export function currentMood() { return mood; }

/** Called ~10 Hz from the game loop. Schedules at most a few notes per second. */
export function tickMusic(now: number) {
  if (!ctx || !buses.music || muted) return;
  if (mood === 'silence') return;
  if (now - moodSince < 1200) return;                 // let the transition breathe
  const beat = TEMPO[mood]; if (!beat) return;
  if (now < nextNote) return;
  nextNote = now + beat * 1000;
  const root = ROOT[mood];
  const deg = SCALE[(step * 3 + (mood === 'combat' ? step : 0)) % SCALE.length];
  const f = root * Math.pow(2, deg / 12);
  const intense = mood === 'combat' || mood === 'elder' || mood === 'ragnarok';

  if (intense) {
    // pulse + low brass-ish saw + a metallic tick: rhythmic, not melodic
    tone(root, root * 0.98, 0.28, 'sawtooth', 0.075, 'music', 0, 0, -6);
    if (step % 2 === 0) tone(f * 2, f * 2, 0.16, 'square', 0.03, 'music', 0.02, 0.2);
    if (mood === 'ragnarok' && step % 4 === 0) noise(0.5, 220, 0.06, 'music', 'lowpass', 0, 1, -0.2, true);
  } else {
    // sparse felt-piano-ish triangle with a long tail: silence is part of the theme
    if (step % 2 === 0 || Math.random() < 0.35) {
      tone(f * 2, f * 2, 1.6, 'triangle', 0.045, 'music', 0, (step % 4 - 1.5) * 0.25);
      tone(f * 4, f * 4, 1.1, 'sine', 0.014, 'music', 0.06, (step % 4 - 1.5) * -0.2);
    }
    if (step % 8 === 0) tone(root, root, 3.4, 'sine', 0.05, 'music', 0, 0);
    if (mood === 'home' && step % 4 === 2) tone(f * 3, f * 3, 1.2, 'sine', 0.02, 'music', 0.1, 0.3);
    if (mood === 'ruins' && step % 6 === 3) noise(1.2, 900, 0.02, 'music', 'bandpass', 0, 4, -0.4, true);
  }
  step++;
}

// ---------------------------------------------------------------------------
// one-shot cues. Names are the engine's existing FX event types — unchanged.
// ---------------------------------------------------------------------------
export function sfx(e: any) {
  if (!ctx) return;
  const now = performance.now();
  const k = e.type + (e.mat || '') + (e.core || '');
  const win = e.type === 'step' ? 130 : e.type === 'mhit' || e.type === 'chip' ? 45 : 35;
  if (last[k] && now - last[k] < win) return; last[k] = now;
  const sp = spatial(e, 'world'); if (!sp) return;
  const { g, pan } = sp;
  const W: Bus = 'world', C: Bus = 'combat', U: Bus = 'ui';

  switch (e.type) {
    // ---- material world --------------------------------------------------
    case 'whoosh': noise(0.13, 1700, 0.07 * g, C, 'bandpass', 0, 2, pan); break;
    case 'chip':
      if (e.mat === 'wood') { tone(190, 84, 0.09, 'triangle', 0.24 * g, W, 0, pan); noise(0.07, 850, 0.14 * g, W, 'lowpass', 0, 1, pan); }
      else if (e.mat === 'stone' || e.mat === 'ore') { tone(940, 560, 0.05, 'square', 0.07 * g, W, 0, pan); noise(0.09, 3200, 0.12 * g, W, 'highpass', 0, 1, pan); }
      else if (e.mat === 'scrap') { tone(1450, 1150, 0.13, 'square', 0.055 * g, W, 0, pan); tone(2150, 1750, 0.1, 'square', 0.035 * g, W, 0.02, pan); }
      else noise(0.1, 2500, 0.09 * g, W, 'bandpass', 0, 1, pan);
      if (e.depleted) { tone(300, 110, 0.3, 'triangle', 0.14 * g, W, 0.05, pan); noise(0.3, 500, 0.07 * g, W, 'lowpass', 0.05, 1, pan); }
      break;
    case 'fell': noise(0.55, 380, 0.24 * g, W, 'lowpass', 0, 1, pan, true); tone(120, 46, 0.45, 'triangle', 0.2 * g, W, 0.1, pan); break;
    case 'clank': tone(1650, 1480, 0.05, 'square', 0.05 * g, W, 0, pan); break;
    case 'step': {
      if (Math.random() > 0.72) break;
      const t = e.t;
      // 9 sand, 12 road, 4 snow, 7 marsh, water 15/16/17 — material-specific
      if (t === 4) noise(0.07, 2600, 0.03 * g, W, 'highpass', 0, 1, pan);
      else if (t === 9) noise(0.06, 1400, 0.03 * g, W, 'bandpass', 0, 0.8, pan);
      else if (t === 12 || t === 13) { noise(0.035, 1100, 0.035 * g, W, 'bandpass', 0, 1.4, pan); tone(220, 160, 0.03, 'triangle', 0.02 * g, W, 0, pan); }
      else if (t === 7) noise(0.1, 420, 0.035 * g, W, 'lowpass', 0, 1, pan, true);
      else if (t === 15 || t === 16 || t === 17) noise(0.09, 1800, 0.035 * g, W, 'bandpass', 0, 0.7, pan);
      else noise(0.045, 520, 0.028 * g, W, 'lowpass', 0, 1, pan, true);
      break;
    }
    case 'roll': noise(0.2, 640, 0.09 * g, W, 'lowpass', 0, 1, pan, true); break;
    case 'dodge': noise(0.09, 3000, 0.055 * g, W, 'highpass', 0, 1, pan); break;
    case 'pickup': tone(680, 1010, 0.07, 'square', 0.055, U); tone(1010, 1350, 0.06, 'square', 0.045, U, 0.05); break;
    case 'eat': tone(500, 300, 0.09, 'triangle', 0.075, W, 0, pan); tone(400, 250, 0.09, 'triangle', 0.07, W, 0.1, pan); break;

    // ---- combat ----------------------------------------------------------
    case 'mhit': tone(230, 76, 0.1, 'square', 0.13 * g, C, 0, pan); noise(0.08, 1250, 0.17 * g, C, 'lowpass', 0, 1, pan); break;
    case 'phit': tone(165, 58, 0.2, 'sawtooth', 0.17, C); noise(0.14, 620, 0.2, C, 'lowpass'); tone(90, 60, 0.35, 'sine', 0.1, C, 0.04); break;
    case 'mdeath': tone(300, 40, 0.38, 'sawtooth', 0.11 * g, C, 0, pan); noise(0.3, 400, 0.08 * g, C, 'lowpass', 0.03, 1, pan, true); break;
    case 'structhit': tone(145, 88, 0.1, 'square', 0.1 * g, C, 0, pan); break;
    case 'structbreak': noise(0.55, 480, 0.28 * g, C, 'lowpass', 0, 1, pan); tone(150, 50, 0.4, 'triangle', 0.12 * g, C, 0.02, pan); break;
    case 'break': tone(820, 190, 0.3, 'square', 0.075 * g, C, 0, pan); noise(0.22, 2000, 0.09 * g, C, 'highpass', 0, 1, pan); break;
    case 'bowshot': tone(420, 190, 0.08, 'triangle', 0.09 * g, C, 0, pan); noise(0.1, 2600, 0.055 * g, C, 'bandpass', 0, 1, pan); break;
    case 'tongue': noise(0.16, 1400, 0.075 * g, C, 'bandpass', 0, 3, pan); break;
    case 'tell': tone(540, 540, 0.06, 'square', 0.05 * g, C, 0, pan); break;
    case 'etell': tone(105, 138, 0.55, 'sawtooth', 0.1 * g, C, 0, pan); break;
    case 'sniff': tone(300, 350, 0.1, 'sine', 0.035 * g, W, 0, pan); break;
    case 'boom': noise(0.65, 300, 0.36 * g, C, 'lowpass', 0, 1, pan); tone(92, 28, 0.55, 'sine', 0.28 * g, C, 0, pan); break;
    case 'bolt': case 'lightning': noise(0.32, 5200, 0.22 * g, C, 'highpass', 0, 1, pan); tone(80, 38, 0.5, 'sawtooth', 0.11 * g, C, 0.05, pan); break;
    case 'zap': tone(1250, 300, 0.1, 'square', 0.05 * g, C, 0, pan); break;
    case 'hazfire': noise(0.22, 620, 0.11 * g, C, 'lowpass', 0, 1, pan); break;
    case 'ignite': noise(0.42, 1000, 0.09 * g, W, 'bandpass', 0, 1, pan); break;
    case 'steam': noise(0.5, 3400, 0.05 * g, W, 'highpass', 0, 0.7, pan); break;

    // ---- Cores: each family gets its own timbre, not one shared blip -------
    case 'windup': {
      const c = e.core;
      if (c === 'frost') { tone(900, 1500, 0.5, 'sine', 0.05 * g, C, 0, pan); noise(0.5, 5200, 0.03 * g, C, 'highpass', 0, 1, pan); }
      else if (c === 'storm') { tone(140, 520, 0.5, 'sawtooth', 0.05 * g, C, 0, pan); noise(0.5, 2600, 0.03 * g, C, 'bandpass', 0, 3, pan); }
      else if (c === 'spirit') { tone(320, 480, 0.55, 'sine', 0.05 * g, C, 0, pan, 8); tone(482, 720, 0.55, 'sine', 0.03 * g, C, 0, pan, -8); }
      else if (c === 'earth' || c === 'nature') { tone(70, 130, 0.5, 'triangle', 0.07 * g, C, 0, pan); noise(0.5, 260, 0.05 * g, C, 'lowpass', 0, 1, pan, true); }
      else { tone(180, 760, 0.45, 'sawtooth', 0.055 * g, C, 0, pan); noise(0.45, 900, 0.04 * g, C, 'bandpass', 0, 1, pan); }
      break;
    }
    case 'cast': {
      const c = e.core;
      if (c === 'frost') { tone(1500, 420, 0.28, 'sine', 0.09 * g, C, 0, pan); noise(0.24, 6000, 0.07 * g, C, 'highpass', 0, 1, pan); }
      else if (c === 'storm') { tone(1100, 200, 0.2, 'square', 0.07 * g, C, 0, pan); noise(0.24, 4200, 0.09 * g, C, 'highpass', 0, 1, pan); }
      else if (c === 'spirit') { tone(420, 880, 0.3, 'sine', 0.07 * g, C, 0, pan, 10); tone(630, 1320, 0.3, 'sine', 0.04 * g, C, 0.02, pan, -10); }
      else if (c === 'earth' || c === 'nature') { tone(110, 48, 0.34, 'triangle', 0.11 * g, C, 0, pan); noise(0.3, 320, 0.09 * g, C, 'lowpass', 0, 1, pan, true); }
      else { tone(280, 900, 0.26, 'sawtooth', 0.09 * g, C, 0, pan); noise(0.22, 1800, 0.09 * g, C, 'bandpass', 0, 1, pan); }
      break;
    }
    case 'fizzle': tone(400, 96, 0.26, 'sine', 0.07 * g, W, 0, pan); noise(0.16, 700, 0.04 * g, W, 'lowpass', 0.02, 1, pan); break;

    // ---- machines, doors, vehicles ---------------------------------------
    case 'machineOn': tone(60, 120, 0.5, 'sawtooth', 0.07 * g, W, 0, pan); noise(0.4, 500, 0.05 * g, W, 'lowpass', 0.02, 1, pan, true); break;
    case 'machineOff': tone(120, 42, 0.6, 'sawtooth', 0.06 * g, W, 0, pan); break;
    case 'dryFire': tone(200, 90, 0.14, 'square', 0.05 * g, W, 0, pan); noise(0.1, 900, 0.04 * g, W, 'bandpass', 0.05, 2, pan); break;
    case 'doorLocked': tone(180, 150, 0.09, 'square', 0.07 * g, W, 0, pan); noise(0.07, 500, 0.06 * g, W, 'lowpass', 0.06, 1, pan); break;
    case 'doorPowered': tone(90, 260, 0.34, 'sawtooth', 0.05 * g, W, 0, pan); noise(0.34, 1400, 0.04 * g, W, 'bandpass', 0.02, 2, pan); tone(520, 700, 0.1, 'sine', 0.03 * g, W, 0.3, pan); break;
    case 'doorWood': noise(0.24, 420, 0.1 * g, W, 'lowpass', 0, 1, pan); tone(160, 110, 0.16, 'triangle', 0.05 * g, W, 0.02, pan); break;
    case 'vehicleStart': tone(48, 130, 0.55, 'sawtooth', 0.09 * g, W, 0, pan); noise(0.5, 700, 0.06 * g, W, 'lowpass', 0.04, 1, pan, true); break;
    case 'vehicleStop': tone(130, 40, 0.5, 'sawtooth', 0.07 * g, W, 0, pan); break;
    case 'lowFuel': tone(440, 330, 0.12, 'square', 0.05, U); tone(330, 260, 0.14, 'square', 0.04, U, 0.14); break;
    case 'airdropImpact': noise(0.28, 480, 0.15 * g, W, 'lowpass', 0, 1, pan); tone(130, 52, 0.24, 'triangle', 0.11 * g, W, 0, pan); break;

    // ---- UI + progression -------------------------------------------------
    case 'ui': tone(900, 900, 0.028, 'square', 0.035, U); break;
    case 'uiBack': tone(600, 480, 0.04, 'square', 0.03, U); break;
    case 'deny': tone(210, 150, 0.13, 'square', 0.065, U); tone(150, 110, 0.1, 'square', 0.04, U, 0.07); break;
    case 'coin': tone(1340, 1340, 0.06, 'square', 0.055, U); tone(1780, 1780, 0.12, 'square', 0.045, U, 0.06); break;
    case 'craft': tone(300, 300, 0.05, 'square', 0.055, U); tone(450, 450, 0.09, 'square', 0.055, U, 0.07); noise(0.08, 1600, 0.03, U, 'bandpass', 0.02, 2); break;
    case 'build': noise(0.11, 700, 0.16, W, 'lowpass', 0, 1, pan); tone(150, 98, 0.13, 'triangle', 0.14, W, 0, pan); break;
    case 'discover': tone(523, 523, 0.18, 'triangle', 0.075, U); tone(659, 659, 0.18, 'triangle', 0.075, U, 0.13); tone(784, 784, 0.34, 'triangle', 0.08, U, 0.26); tone(1046, 1046, 0.5, 'sine', 0.04, U, 0.4); break;
    case 'banner': tone(196, 196, 0.65, 'triangle', 0.1, U); tone(147, 147, 0.85, 'triangle', 0.085, U, 0.26); break;
    case 'rare': tone(392, 392, 0.2, 'sine', 0.07, U); tone(587, 587, 0.24, 'sine', 0.06, U, 0.14); tone(784, 784, 0.6, 'triangle', 0.07, U, 0.3); noise(0.7, 5000, 0.025, U, 'highpass', 0.3, 1); break;
    // ---- Journey feedback ladder (L1 tick → L5 epic). Each rung is audibly bigger than the last.
    case 'jtick': tone(1500, 1500, 0.018, 'square', 0.018, U); break;
    case 'jstamp': noise(0.05, 900, 0.09, U, 'lowpass'); tone(220, 180, 0.08, 'triangle', 0.08, U); tone(988, 988, 0.22, 'sine', 0.045, U, 0.12); tone(1318, 1318, 0.3, 'sine', 0.03, U, 0.2); break;
    case 'jmilestone': tone(659, 659, 0.5, 'sine', 0.06, U); tone(988, 988, 0.6, 'sine', 0.045, U, 0.09); tone(1318, 1318, 0.9, 'triangle', 0.035, U, 0.18); noise(0.6, 6000, 0.012, U, 'highpass', 0.15, 1); break;
    case 'jcapability': tone(392, 392, 0.09, 'square', 0.045, U); tone(523, 523, 0.09, 'square', 0.045, U, 0.08); tone(784, 784, 0.28, 'square', 0.05, U, 0.16); tone(196, 196, 0.4, 'triangle', 0.05, U, 0.16); break;
    case 'jrelic': tone(311, 311, 0.6, 'sine', 0.06, U); tone(466, 466, 0.7, 'sine', 0.05, U, 0.18); tone(698, 698, 0.9, 'triangle', 0.06, U, 0.36); tone(1396, 1396, 1.2, 'sine', 0.02, U, 0.5); noise(1.2, 7000, 0.02, U, 'highpass', 0.4, 1); break;
    case 'jepic': noise(0.9, 140, 0.22, U, 'lowpass', 0, 1, 0, true); tone(65, 49, 1.4, 'sine', 0.2, U); tone(131, 131, 1.6, 'sawtooth', 0.04, U, 0.5); tone(196, 196, 1.6, 'triangle', 0.06, U, 0.5); tone(262, 262, 1.8, 'triangle', 0.06, U, 0.9); tone(392, 392, 2.2, 'sine', 0.05, U, 1.3); break;
    case 'death': tone(220, 55, 1.4, 'sawtooth', 0.12, C); tone(110, 40, 1.8, 'sine', 0.1, C, 0.1); noise(1.2, 260, 0.07, C, 'lowpass', 0, 1, 0, true); break;
    default: break;
  }
}
