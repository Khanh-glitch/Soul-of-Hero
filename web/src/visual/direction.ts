// ============================================================================
// SOUL OF HEROES — VISUAL ARENA
// Presentation-only art direction system. No gameplay authority: this module
// never reads or writes run state, items, costs, damage or saves. It owns
// palette tokens, the world colour grade and the HUD theme, and it can be
// switched live so three competing directions can be judged on the SAME frame.
//
// Base Gameplay SHA: 6121e7d4447c68a036fcd80b5c9266c88bba6aee
// Branch: arena/visual-soh-ashfall (independent of arena/d4bfcfff-soul-of-hero)
// ============================================================================

export type DirectionId = 'fieldcraft' | 'arcane' | 'mythic';

export interface Direction {
  id: DirectionId;
  name: string;
  tagline: string;
  rationale: string;
  /** multiplies the whole world frame — the dominant colour family */
  multiply: string;
  /** soft-light pass — lifts mids toward the mood hue */
  mood: string;
  moodAlpha: number;
  /** 0 = full colour, 1 = monochrome */
  desaturate: number;
  /** corner falloff strength */
  vignette: number;
  /** additive warmth around emissive sources */
  bloom: number;
  /** HUD chrome */
  ui: {
    ink: string; iron: string; steel: string; edge: string; edgeLit: string;
    brass: string; brassLit: string; paper: string; muted: string;
    hp: string; stam: string; food: string; water: string; warm: string;
    good: string; warn: string; bad: string; info: string;
  };
}

const BASE_UI = {
  ink: '#0a0c0f', iron: '#14181d', steel: '#1e252c', edge: '#39464f', edgeLit: '#5d707c',
  brass: '#c8963c', brassLit: '#f4d089', paper: '#e9dfc6', muted: '#8fa0a8',
  hp: '#d8402f', stam: '#a8c247', food: '#dd9a3c', water: '#3f9fd0', warm: '#e0705a',
  good: '#7fc25a', warn: '#e8b23c', bad: '#e2543c', info: '#5fc8e0',
};

export const DIRECTIONS: Record<DirectionId, Direction> = {
  fieldcraft: {
    id: 'fieldcraft', name: 'A · Survival Fieldcraft',
    tagline: 'Weathered canvas, wet bark, honest daylight.',
    rationale: 'Most readable terrain and least visual fatigue, but the weakest sense of Core mystery; the world reads as a hiking sim rather than a dying island.',
    multiply: '#e8e2d2', mood: '#8a7a52', moodAlpha: 0.16, desaturate: 0.3, vignette: 0.3, bloom: 0.5,
    ui: { ...BASE_UI, brass: '#b08a48', brassLit: '#e8cb8c', edge: '#41473c', edgeLit: '#6b7359', iron: '#171a15', steel: '#22261e' },
  },
  arcane: {
    id: 'arcane', name: 'B · Arcane Industrial',
    tagline: 'Cold iron, teal shadow, one warm lamp still burning.',
    rationale: 'Best fit for refineries, generators, powered doors and Core energy. Cool shadows make every emissive read as authored light instead of decoration.',
    multiply: '#cdd8dc', mood: '#2f6a78', moodAlpha: 0.22, desaturate: 0.22, vignette: 0.42, bloom: 1,
    ui: { ...BASE_UI },
  },
  mythic: {
    id: 'mythic', name: 'C · Mythic Pixel Adventure',
    tagline: 'Deep contrast, hot accents, a world that poses.',
    rationale: 'Strongest silhouette drama and Core identity, but the heavy grade costs low-light readability and fights the industrial machinery.',
    multiply: '#d8c6e0', mood: '#5a2f7a', moodAlpha: 0.26, desaturate: 0.08, vignette: 0.62, bloom: 1.35,
    ui: { ...BASE_UI, brass: '#d8a03c', brassLit: '#ffdf9a', edge: '#4a3a5e', edgeLit: '#7a5f96', iron: '#171320', steel: '#221b30' },
  },
};

/** Winning direction: Arcane Industrial chassis, Mythic silhouette + Core drama. */
export const DEFAULT_DIRECTION: DirectionId = 'arcane';

export const CORE_HUES: Record<string, string> = {
  fire: '#ff8a3a', frost: '#7fd8ff', storm: '#b8a0ff', earth: '#c08a4a',
  nature: '#8fd45a', spirit: '#cf7fff', gold: '#ffd166',
};

// ---------------------------------------------------------------------------
// live selection (presentation preference, persisted outside the game save)
// ---------------------------------------------------------------------------
const KEY = 'soh.visual.v1';
export type UiLayoutPref = 'auto' | 'pc' | 'mobile';
export type StageScaleMode = 'fit' | 'integer';

export interface VisualPrefs {
  direction: DirectionId;
  grade: number;        // 0..1.5 grade intensity
  shake: number;        // 0..1 camera shake scale
  reduceFlash: boolean; // accessibility: damp full-screen flashes
  highContrastHud: boolean;
  uiLayout: UiLayoutPref;     // 'auto' -> PC unified 2-column on computers, 2-tab touch layout on phones
  stageScale: StageScaleMode; // 'fit' -> high-res window fit (default), 'integer' -> strict 1x/2x/3x floor
  music: number; ambience: number; world: number; combat: number; ui: number;
  muted: boolean;
}
export const DEFAULT_PREFS: VisualPrefs = {
  direction: DEFAULT_DIRECTION, grade: 1, shake: 1, reduceFlash: false, highContrastHud: false,
  uiLayout: 'auto', stageScale: 'fit',
  music: 0.5, ambience: 0.65, world: 0.8, combat: 0.9, ui: 0.6, muted: false,
};

/** Resolve 'pc' (unified 2-column SurvivorScreen) vs 'mobile' (touch-friendly 2-tab PACK/WORK). */
export function resolveUiLayout(
  p: Pick<VisualPrefs, 'uiLayout'> = prefs,
  env?: { coarseOnly?: boolean; userAgent?: string; maxTouchPoints?: number },
): 'pc' | 'mobile' {
  if (p.uiLayout === 'pc') return 'pc';
  if (p.uiLayout === 'mobile') return 'mobile';
  const coarseOnly = env?.coarseOnly ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
    : false);
  if (coarseOnly) return 'mobile';
  const ua = env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  const touchPts = env?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);
  if (touchPts > 0 && /Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'mobile';
  return 'pc';
}

/** Compute stage scale & letterbox offset: 'fit' fills window smoothly at native resolution; 'integer' snaps 1x/2x/3x. */
export function computeStageFit(
  W: number,
  H: number,
  viewW: number,
  viewH: number,
  mode: StageScaleMode = prefs.stageScale,
): { k: number; x: number; y: number } {
  const raw = Math.min(W / viewW, H / viewH);
  const k = mode === 'integer' ? (raw >= 1 ? Math.floor(raw) : raw) : raw;
  return {
    k,
    x: Math.floor((W - viewW * k) / 2),
    y: Math.floor((H - viewH * k) / 2),
  };
}

let prefs: VisualPrefs = { ...DEFAULT_PREFS };
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (raw) prefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  if (!DIRECTIONS[prefs.direction]) prefs.direction = DEFAULT_DIRECTION;
} catch { /* private mode: defaults are fine */ }

const subs = new Set<() => void>();
export function getPrefs(): VisualPrefs { return prefs; }
export function dir(): Direction { return DIRECTIONS[prefs.direction]; }
export function setPrefs(patch: Partial<VisualPrefs>) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  applyCssTheme();
  subs.forEach(f => f());
}
export function subscribePrefs(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

/** Push the palette into CSS custom properties so every panel shares one source. */
export function applyCssTheme() {
  if (typeof document === 'undefined' || !document.documentElement?.style) return;
  const d = dir(); const r = document.documentElement;
  for (const [k, v] of Object.entries(d.ui)) r.style.setProperty(`--${k}`, v);
  r.style.setProperty('--hud-op', prefs.highContrastHud ? '0.97' : '0.86');
  r.dataset.direction = d.id;
}
applyCssTheme();

// ---------------------------------------------------------------------------
// world grade — composited AFTER lighting so ground, actors and VFX all sit in
// the same atmosphere. Never touches collision, actors' visibility or state.
// ---------------------------------------------------------------------------
let vigCv: HTMLCanvasElement | null = null; let vigKey = '';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function vignette(w: number, h: number, strength: number): HTMLCanvasElement {
  const key = `${w}x${h}:${strength.toFixed(2)}`;
  if (vigCv && vigKey === key) return vigCv;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h); const buf = new Uint32Array(img.data.buffer);
  const cx = w / 2, cy = h / 2, max = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // ordered dither keeps the falloff on the pixel grid — no blurry vector halo
    const d = Math.hypot(x - cx, y - cy) / max;
    const a = Math.pow(Math.max(0, d - 0.42) / 0.58, 1.7) * strength;
    const th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
    const q = Math.min(1, Math.floor(a * 6 + th) / 6);
    buf[y * w + x] = (Math.round(q * 190) << 24) | (14 << 16) | (10 << 8) | 8;
  }
  g.putImageData(img, 0, 0); vigCv = c; vigKey = key; return c;
}

export function gradeWorld(g: CanvasRenderingContext2D, w: number, h: number, dark: number) {
  const d = dir(); const k = prefs.grade;
  if (k <= 0.001) return;
  g.save();
  if (d.desaturate > 0.01) {
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = Math.min(1, d.desaturate * k);
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = Math.min(1, 0.55 * k);
  g.fillStyle = d.multiply; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = Math.min(1, d.moodAlpha * k * (1 + dark * 0.5));
  g.fillStyle = d.mood; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = Math.min(1, k);
  g.drawImage(vignette(w, h, d.vignette), 0, 0);
  g.restore();
}

/** Cheap, pixel-safe bloom: additive halo only where the scene already emits. */
export function bloomAt(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
  const s = dir().bloom * prefs.grade;
  if (s <= 0.01 || a <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 3; i >= 1; i--) {
    g.globalAlpha = a * s * 0.09 * i;
    g.fillStyle = col;
    g.beginPath(); g.arc(Math.round(x), Math.round(y), Math.round(r * (0.4 + i * 0.28)), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function flashScale() { return prefs.reduceFlash ? 0.25 : 1; }
export function shakeScale() { return prefs.shake; }
