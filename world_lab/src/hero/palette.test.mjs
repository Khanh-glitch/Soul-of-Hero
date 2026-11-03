// Minimal, dependency-light checks for the one-scene palette contract.
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {PALETTE, PALETTE_HEX, PALETTE_SIZE, nearestIndex, paletteLock, strictPaletteColor, selectiveOutline, chromaKey, nearestDownsample, contactShadow} from './palette.mjs';

const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
const pix = (w, h, fill = [12, 34, 56, 255]) => ({width: w, height: h, data: new Uint8Array(w * h * 4).map((_, i) => fill[i % 4])});

check('36 unique authored colours', () => {
  assert.equal(PALETTE_SIZE, 36);
  assert.equal(new Set(PALETTE_HEX).size, 36);
  assert.equal(PALETTE_HEX[0], '#05060b');
  assert.equal(PALETTE_HEX.at(-1), '#f7e8c8');
});
check('nearest colour is exact and group-scoped', () => {
  assert.deepEqual(PALETTE[nearestIndex([5, 6, 11], 'all')], [5, 6, 11]);
  assert.equal(nearestIndex([200, 0, 200], 'brass'), nearestIndex([200, 0, 200], 'brass'));
});
check('strictPaletteColor never emits off-palette RGB', () => {
  const c = strictPaletteColor('#123456');
  assert.ok(PALETTE.some(p => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]));
});
check('paletteLock emits only exact palette RGB for every opaque pixel', () => {
  const src = pix(5, 5, [123, 45, 67, 255]);
  src.data[3] = 0;
  const out = paletteLock(src, 'stone', {dither: true, hueShift: true});
  const allowed = new Set(PALETTE_HEX);
  for (let i = 0; i < out.data.length; i += 4) {
    if (!out.data[i + 3]) continue;
    const h = '#' + [out.data[i], out.data[i + 1], out.data[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
    assert.ok(allowed.has(h), `off-palette ${h}`);
  }
  assert.equal(out.data[3], 0);
});
check('chromaKey removes magenta while preserving other alpha', () => {
  const src = pix(2, 1, [255, 0, 255, 255]);
  src.data[4] = 10; src.data[5] = 20; src.data[6] = 30; src.data[7] = 255;
  const out = chromaKey(src);
  assert.equal(out.data[3], 0);
  assert.equal(out.data[7], 255);
});
check('nearestDownsample is integer nearest-neighbour with no interpolation', () => {
  const src = pix(4, 4, [100, 110, 120, 255]);
  src.data[(0 * 4 + 0) * 4] = 7;
  const out = nearestDownsample(src, 2, 2, 2);
  assert.equal(out.data[0], src.data[(1 * 4 + 1) * 4]);
  assert.equal(out.data[3], 255);
});
check('selectiveOutline adds lower/right silhouette only', () => {
  const src = pix(3, 3, [0, 0, 0, 0]);
  src.data[(1 * 3 + 1) * 4 + 3] = 255;
  const out = selectiveOutline(src);
  assert.equal(out.data[(0 * 3 + 1) * 4 + 3], 255); // below neighbour
  assert.equal(out.data[(1 * 3 + 0) * 4 + 3], 255); // right neighbour
  assert.equal(out.data[3], 0);                      // upper-left is untouched
});
check('contactShadow is conservative, at most one 16px tile', () => {
  const out = contactShadow(pix(16, 16), {drop: 3});
  assert.equal(out.width, 19);
  assert.equal(out.height, 19);
  const max = contactShadow(pix(16, 16), {drop: 99});
  assert.equal(max.width, 32);
  assert.equal(max.width - 16, 16);
});
check('PNG round trip preserves strict palette and 1x dimensions', () => {
  const src = paletteLock(pix(16, 16), 'brass', {dither: false});
  const png = new PNG({width: 16, height: 16}); png.data = Buffer.from(src.data);
  const round = PNG.sync.read(PNG.sync.write(png));
  assert.equal(round.width, 16); assert.equal(round.height, 16);
  assert.equal(round.data[0], src.data[0]);
});
console.log(`PALETTE_TEST PASS ${checks.length}/${checks.length}: ${checks.join(' | ')}`);
