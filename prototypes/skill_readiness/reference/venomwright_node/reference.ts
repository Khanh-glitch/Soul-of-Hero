// Node reference runner for ORIGINAL Venomwright TypeScript (GOLD93 oracle protocol).
//   tsx reference.ts hashes <skillId> <castTick> <maxTick>        -> JSON rows (scene/glow sha256)
//   tsx reference.ts render <skillId> <outDir> [maxTick]          -> composite PNGs + manifest.json
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { deflateSync, crc32 } from 'zlib';
import { join } from 'path';
import { Game } from './src/game/engine';
import { World, resetIds } from './src/game/world';
import { SKILL_BY_ID } from './src/game/skills';
import { F } from './src/game/skills/lib';

const W = 1200, H = 680, K = 2;

function h32(buf: Uint32Array) {
  return createHash('sha256').update(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)).digest('hex').slice(0, 32);
}

// Mirrors Game.startStage(id, 7, auto) reset, with the cast driven by the protocol tick.
function setup(id: number) {
  const g = new Game();
  g.W = 600; g.H = 340; g.rW = W; g.rH = H; g.renderScale = K;
  g.world = new World(g.W, g.H);
  g.buildGfx();
  const w = g.world, def = SKILL_BY_ID[id];
  resetIds(); w.uid = 1; w.reset(7, true); w.lab = true;
  w.stats = { total: 0, kills: 0, hits: 0, ev: [] };
  const p = w.player; p.form = def.form === 'venom' ? 'venom' : 'vessel'; p.venomT = 999; p.cat = 100; if (def.form !== 'venom') p.venomT = 0;
  g.aim = null; g.dragPts = []; g.lastCastId = id;
  return { g, w, def };
}

// Runs the timeline. Calls onTick(t, g, w, hitsThisTick) after render each tick.
function run(id: number, castTick: number, maxTick: number, onTick: (t: number, g: Game, w: World, dHits: number) => void) {
  const { g, w, def } = setup(id);
  let lastHits = 0;
  for (let t = 1; t <= maxTick; t++) {
    w.step(F);
    if (t === castTick) g.cast(def, g.autoAim(def), true);
    g.render();
    const dHits = w.stats.hits - lastHits; lastHits = w.stats.hits;
    onTick(t, g, w, dHits);
  }
  return def;
}

// --- CPU replica of the ORIGINAL composite fragment shader (display.ts FRAG). ---
// Inputs are the RGBA8 scene and glow buffers exactly as uploaded by present().
function unpack(v: number): [number, number, number] { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255]; }
function clampI(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function sampleTex(buf: Uint32Array, u: number, v: number): [number, number, number] {
  const tx = clampI(Math.floor(u * W), 0, W - 1), ty = clampI(Math.floor(v * H), 0, H - 1);
  const [r, g, b] = unpack(buf[ty * W + tx]);
  return [r / 255, g / 255, b / 255];
}
function bayer4(x: number, y: number) {
  const px = ((x % 4) + 4) % 4, py = ((y % 4) + 4) % 4;
  const a = px % 2, b = Math.floor(px / 2) % 2, c = py % 2, d = Math.floor(py / 2) % 2;
  return (8 * Math.abs(a - c) + 4 * c + 2 * Math.abs(b - d) + d) / 16;
}
function smoothstep(e0: number, e1: number, x: number) { const t = clampI((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

export function composite(scene: Uint32Array, glow: Uint32Array, shake: [number, number], shocks: number[], flash: number[], grade: number[]) {
  const out = new Uint8Array(W * H * 3);
  const sh = new Float64Array(16); for (let i = 0; i < 16; i++) sh[i] = (shocks[i] || 0) * K;
  const sx = (shake[0] || 0) * K, sy = (shake[1] || 0) * K;
  const fl = [flash[0] || 0, flash[1] || 0, flash[2] || 0, flash[3] || 0];
  const gr = grade;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const pxX = x, pxY = y;
    let px = pxX + 0.5, py = pxY + 0.5;
    let offX = 0, offY = 0;
    for (let i = 0; i < 4; i++) {
      const s = i * 4; const w4 = sh[s + 3];
      if (w4 > 0) {
        const dx = px - sh[s], dy = py - sh[s + 1]; const r = Math.hypot(dx, dy);
        const band = Math.exp(-Math.pow((r - sh[s + 2]) / 9, 2));
        if (r > 0.5) { offX += dx / r * band * w4; offY += dy / r * band * w4; }
      }
    }
    px = Math.floor(px + offX + sx) + 0.5; py = Math.floor(py + offY + sy) + 0.5;
    px = clampI(px, 0.5, W - 0.5); py = clampI(py, 0.5, H - 0.5);
    const uvx = px / W, uvy = py / H;
    const sc = sampleTex(scene, uvx, uvy);
    const g = sampleTex(glow, uvx, uvy);
    const o2x = 2 / W, o2y = 2 / H;
    const hA = sampleTex(glow, uvx + o2x, uvy), hB = sampleTex(glow, uvx - o2x, uvy);
    const hC = sampleTex(glow, uvx, uvy + o2y), hD = sampleTex(glow, uvx, uvy - o2y);
    // o5 = vec2(5, -5) / uRes ; o5.xx, o5.xy, o5.yx as in the shader
    const o5x = 5 / W, o5y = -5 / H;
    const h2A = sampleTex(glow, uvx + o5x, uvy + o5x), h2B = sampleTex(glow, uvx - o5x, uvy - o5x);
    const h2C = sampleTex(glow, uvx + o5x, uvy + o5y), h2D = sampleTex(glow, uvx + o5y, uvy + o5x);
    const col = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const h = (hA[c] + hB[c] + hC[c] + hD[c]) * 0.25;
      const h2 = (h2A[c] + h2B[c] + h2C[c] + h2D[c]) * 0.25;
      col[c] = sc[c] + (g[c] + h * 0.5 + h2 * 0.4) * gr[3];
    }
    const l = col[0] * 0.3 + col[1] * 0.55 + col[2] * 0.15;
    for (let c = 0; c < 3; c++) col[c] = col[c] + (l - col[c]) * gr[2];
    const qx = (pxX / W - 0.5) * 1.0, qy = (pxY / H - 0.5) * 0.9;
    const vg = smoothstep(0.38, 0.78, Math.hypot(qx, qy)) * gr[1];
    const bt = bayer4(pxX, pxY);
    const m1 = vg >= bt + 0.001 ? 1 : 0, m2 = vg * 0.55 >= bt + 0.001 ? 1 : 0;
    const shade = 1 - 0.55 * m1 - 0.2 * m2;
    for (let c = 0; c < 3; c++) col[c] *= shade;
    for (let c = 0; c < 3; c++) col[c] *= 1 - gr[0];
    if (fl[3] > 0) {
      const amt = (fl[3] >= bt ? 1 : 0) * Math.min(1, fl[3] * 1.4);
      for (let c = 0; c < 3; c++) col[c] = col[c] + (fl[c] - col[c]) * amt;
    }
    const o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      const q = Math.floor(clampI(col[c], 0, 1) * 31 + 0.5) / 31;
      out[o + c] = Math.round(q * 255);
    }
  }
  return out;
}

function png(rgb: Uint8Array, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

const [mode, a1, a2, a3] = process.argv.slice(2);
if (mode === 'hashes') {
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  const rows: unknown[] = [];
  run(id, castTick, maxTick, (t, g, w) => {
    rows.push({ tick: t, scene_sha256: h32(g.gfx.s.d), glow_sha256: h32(g.gfx.l.d),
      enemies: w.enemies.filter(e => e.dying <= 0).length, fx: w.fx.length, parts: w.parts.list.length });
  });
  console.log(JSON.stringify(rows));
} else if (mode === 'render') {
  const id = Number(a1), outDir = a2, maxTick = Number(a3 ?? 0);
  mkdirSync(outDir, { recursive: true });
  // Pass 1: gather timeline facts (hit ticks, activity) without rendering PNGs.
  const hitTicks: number[] = []; const activity: number[] = [];
  const def0 = run(id, 1, maxTick || Math.ceil((SKILL_BY_ID[id].total + 2) * 60), (t, g, w, dHits) => {
    if (dHits > 0) hitTicks.push(t);
    activity[t] = w.fx.length + w.parts.list.length;
  });
  const end = maxTick || Math.ceil((def0.total + 2) * 60);
  const impact = Math.round(def0.first * 60);
  const finisher = hitTicks.length ? hitTicks[hitTicks.length - 1] : impact;
  let peak = impact, best = -1;
  for (let t = impact; t <= Math.min(finisher + 60, end); t++) if ((activity[t] ?? 0) > best) { best = activity[t]; peak = t; }
  const cps: { name: string; tick: number; rule: string }[] = [
    { name: 'anticipation', tick: Math.max(1, Math.round(impact * 0.5)), rule: 'round(0.5 * def.first * 60)' },
    { name: 'wind-up', tick: Math.max(1, Math.round(impact * 0.85)), rule: 'round(0.85 * def.first * 60)' },
    { name: 'impact', tick: impact, rule: 'round(def.first * 60)' },
    { name: 'peak', tick: peak, rule: 'argmax(fx+parts) over [impact, last hit + 1 s]' },
    { name: 'finisher', tick: finisher, rule: 'last tick with a hit increment' },
    { name: 'aftermath', tick: Math.min(end, finisher + 60), rule: 'last hit + 1 s' },
  ];
  const want = new Map<number, string[]>();
  for (const c of cps) want.set(c.tick, [...(want.get(c.tick) ?? []), c.name]);
  const manifest: any = { skill: id, name: def0.name, protocol: 'gold93/venomwright-oracle-protocol/v1', seed: 7, cast_tick: 1, native: [W, H], logical: [600, 340], k: K,
    impact_tick_rule: 'def.first', hit_ticks_count: hitTicks.length, checkpoints: [], note: 'CPU replica of the original GLSL composite; labelled as reference, not a GPU capture.' };
  const { g, w, def } = setup(id);
  let lastHits = 0;
  for (let t = 1; t <= end; t++) {
    w.step(F);
    if (t === 1) g.cast(def, g.autoAim(def), true);
    g.render();
    lastHits = w.stats.hits;
    const names = want.get(t);
    if (names) {
      const shocks = w.shockArr(); const flash = w.flashArr();
      const rgb = composite(g.gfx.s.d, g.gfx.l.d, w.shakeOff(), shocks, flash, w.grade());
      const file = `${String(t).padStart(4, '0')}_${names.join('+')}.png`;
      writeFileSync(join(outDir, file), png(rgb, W, H));
      manifest.checkpoints.push({ tick: t, time_s: +(t * F).toFixed(4), names, file,
        scene_sha256: h32(g.gfx.s.d), glow_sha256: h32(g.gfx.l.d), enemies: w.enemies.filter(e => e.dying <= 0).length, fx: w.fx.length, parts: w.parts.list.length, hits_total: w.stats.hits });
    }
  }
  manifest.rules = Object.fromEntries(cps.map(c => [c.name, { tick: c.tick, rule: c.rule }]));
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest.rules));
} else if (mode === 'objhash') {
  // Per-object cumulative raster hashes at the requested ticks: wrap every fx
  // hook so each draw call appends `method.kind#index <scene+glow sha256/12>`,
  // the identical format the native differential prints as GOLD93_OBJ.
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  const want = new Set((process.argv[6] ?? '89,90').split(',').map(Number));
  const { g, w, def } = setup(id);
  const hash = () => createHash('sha256').update(Buffer.from(g.gfx.s.d.buffer, g.gfx.s.d.byteOffset, g.gfx.s.d.byteLength)).update(Buffer.from(g.gfx.l.d.buffer, g.gfx.l.d.byteOffset, g.gfx.l.d.byteLength)).digest('hex').slice(0, 12);
  let log: string[] = [];
  const wrap = () => {
    for (const f of w.fx as any[]) {
      if ((f as any).__oh) continue; (f as any).__oh = true;
      for (const m of ['gnd', 'shd', 'up', 'air', 'lit']) {
        const orig = (f as any)[m];
        if (typeof orig !== 'function') continue;
        (f as any)[m] = (...args: unknown[]) => { const r = orig.apply(f, args); log.push(`${m}.${String((f as any).kind)}#${(w.fx as any[]).indexOf(f)} ${hash()}`); return r; };
      }
    }
  };
  for (let t = 1; t <= maxTick; t++) {
    w.step(F);
    if (t === castTick) g.cast(def, g.autoAim(def), true);
    log = [];
    if (want.has(t)) wrap();
    g.render();
    if (want.has(t)) log.forEach((line, i) => console.log(`GOLD93_OBJ t=${t} i=${i} ${line}`));
  }
} else if (mode === 'blockhash') {
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  run(id, castTick, maxTick, (t, g) => {
    if (t !== maxTick - 1 && t !== maxTick) return;
    const buf = Buffer.from(g.gfx.s.d.buffer, g.gfx.s.d.byteOffset, g.gfx.s.d.byteLength);
    const blks: string[] = [];
    for (let by = 0; by < 10; by++) for (let bx = 0; bx < 12; bx++) {
      const h = createHash('sha256');
      for (let row = 0; row < 68; row++) { const off = ((by * 68 + row) * 1200 + bx * 100) * 4; h.update(buf.subarray(off, off + 400)); }
      blks.push(h.digest('hex').slice(0, 6));
    }
    for (let i = 0, p = 0; i < blks.length; i += 15, p++) console.log(`GOLD93_BLK t=${t} p=${p} ${blks.slice(i, i + 15).join(' ')}`);
  });
} else if (mode === 'cocoonstate') {
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  run(id, castTick, maxTick, (t, _g, w) => {
    if (t !== 89 && t !== 90) return;
    const co: any = w.fx[0];
    console.log(`GOLD93_COCOON t=${t} x=${co.x.toFixed(9)} y=${co.y.toFixed(9)} z=${co.z.toFixed(9)} open=${co.open.toFixed(9)} pulseY=${co.pulseY.toFixed(9)} glow=${co.glowAdd.toFixed(9)} age=${co.age.toFixed(9)} trans=${co.trans.toFixed(9)} shake=${co.shake.toFixed(9)} grow=${co.grow.toFixed(9)} vis=${co.vis.toFixed(9)} rup=${JSON.stringify(co.ruptured)}`);
  });
} else if (mode === 'hatchstate') {
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  run(id, castTick, maxTick, (t, _g, w) => {
    if (t !== 263 && t !== 264) return;
    const hs: string[] = [];
    for (const f of w.fx as any[]) {
      if (f.idx === undefined) continue;
      hs.push(`h${f.idx} x=${f.x.toFixed(9)} y=${f.y.toFixed(9)} z=${f.z.toFixed(9)} hd=${f.hd.toFixed(9)} vx=${f.vx.toFixed(9)} vy=${f.vy.toFixed(9)}`);
    }
    for (let i = 0; i < hs.length; i += 4) console.log(`GOLD93_HATCH t=${t} ${hs.slice(i, i + 4).join(' | ')}`);
  });
} else if (mode === 'flowstate') {
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  run(id, castTick, maxTick, (t, _g, w) => {
    if (t !== 179 && t !== 180) return;
    for (const f of w.fx as any[]) {
      if (f.kind !== 'flow') continue;
      const bs = f.br.map((b: any) => `d${b.drawn.toFixed(3)}/l${b.len.toFixed(3)}/w${b.w.toFixed(3)}`);
      console.log(`GOLD93_FLOW t=${t} age=${f.age.toFixed(6)} br=${f.br.length} discs=${f.discs.length} ${bs.join(' ')} | discs ${f.discs.map((d: any) => d.r.toFixed(4)).join(' ')}`);
    }
  });
} else if (mode === 'state') {
  // Per-tick enemy positions, in the exact text format the native differential
  // prints as GOLD93_EN (two lines per tick), so the two logs can be diffed.
  const id = Number(a1), castTick = Number(a2), maxTick = Number(a3);
  run(id, castTick, maxTick, (t, _g, w) => {
    const en = w.enemies as any[];
    for (let g = 0; g < 2; g++) {
      const parts: string[] = [];
      for (let i = g * 8; i < Math.min(g * 8 + 8, en.length); i++) parts.push(`${en[i].x.toFixed(8)},${en[i].y.toFixed(8)}`);
      const head = g === 0 ? `fx=${w.fx.length} pt=${w.parts.list.length} n=${en.length} |` : '|';
      console.log(`GOLD93_EN t=${t} g=${g} ${head} ${parts.join(' ')}`);
    }
  });
} else {
  console.error('usage: reference.ts hashes|render ...'); process.exit(2);
}
