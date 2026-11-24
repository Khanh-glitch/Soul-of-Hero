// Guards for the 2026-11-24 UI/HUD test findings. All checks read source text, so the file runs in milliseconds.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });

function symbolRange(css: string): Set<number> {
  const m = css.match(/soh-symbols\.woff2'\) format\('woff2'\); unicode-range: ([^;]+);/);
  expect(m, 'symbol @font-face with a unicode-range').toBeTruthy();
  const out = new Set<number>();
  for (const part of m![1].split(',')) { const [a, b] = part.trim().slice(2).split('-'); for (let c = parseInt(a, 16); c <= parseInt(b ?? a, 16); c++) out.add(c); }
  return out;
}

describe('UI readability guards', () => {
  it('gauge and bar fills never append hex alpha to a colour that may be a CSS variable', () => {
    // `${col}99` with col = "var(--hp)" is not a colour: the browser dropped the whole background and the
    // health and stamina bars were drawn with no fill at all.
    for (const file of ['ui/hud.tsx', 'ui/common.tsx']) expect(read(file), file).not.toMatch(/\$\{col\}[0-9a-fA-F]{2}\b/);
    expect(read('ui/hud.tsx')).toMatch(/<Gauge k="hp"[^>]*col="var\(--hp\)"/);
  });

  it('label digits come from VT323, one face per weight (a weight range hijacks the regular weight)', () => {
    const css = read('index.css');
    const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]).filter(f => /font-family: 'Pixelify Sans'/.test(f) && /unicode-range: U\+30-39/.test(f));
    expect(faces.map(f => f.match(/font-weight: ([^;]+);/)![1].trim()).sort()).toEqual(['400', '700']);
    for (const f of faces) expect(f).toMatch(/vt323-latin-400-normal\.woff2/);
  });

  it('ligatures are off everywhere ("find" must not render as "And")', () => {
    expect(read('index.css')).toMatch(/\*, \*::placeholder \{ font-variant-ligatures: none; \}/);
  });

  it('every symbol the source prints is covered by the bundled symbol font', () => {
    const css = read('index.css'); const have = symbolRange(css);
    // three registrations: body font, label font regular, label font bold
    expect([...css.matchAll(/soh-symbols\.woff2/g)].length).toBe(3);
    const missing = new Set<string>();
    for (const file of walk(SRC)) for (const ch of readFileSync(file, 'utf8')) {
      const c = ch.codePointAt(0)!;
      if (((c >= 0x2190 && c <= 0x2bff) || (c >= 0x1f000 && c <= 0x1ffff)) && c !== 0x2212 /* minus: in the pixel fonts */ && !have.has(c)) missing.add(`${ch} U+${c.toString(16).toUpperCase()}`);
    }
    // A new symbol in the UI? Run scripts/make-symbol-font.py and paste the printed unicode-range into index.css.
    expect([...missing]).toEqual([]);
  });

  it('the escrow prompt uses the English display name (item-ontology round 2 decision)', () => {
    expect(read('game/sim.ts')).not.toMatch(/label = 'Rương ký gửi'/);
  });
});
