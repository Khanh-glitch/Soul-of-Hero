// Fog dots drawn as one picture against one fill per dot: largest per-channel difference on Chromium's CPU raster,
// over a noisy background and over flat extremes. Same colour, opacity and dot lattice as web/src/game/fog-layer.ts.
import { chromium } from 'playwright-core'; import sparticuz from '@sparticuz/chromium';
const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: [...sparticuz.args, '--disable-gpu'], headless: true });
const page = await browser.newPage(); await page.setContent('<canvas id=a width=640 height=360></canvas><canvas id=b width=640 height=360></canvas>');
const out = await page.evaluate(() => {
  const W = 640, H = 360, results = [];
  const dots = []; let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let y = 0; y < H; y += 2) for (let x = (y >> 1) % 2 * 2; x < W; x += 4) if (rnd() > 0.45) dots.push(x, y);
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H; const lg = layer.getContext('2d');
  const img = lg.createImageData(W, H), px = new Uint32Array(img.data.buffer), DOT = (255 << 24 | 238 << 16 | 230 << 8 | 225) >>> 0;
  for (let i = 0; i < dots.length; i += 2) { const at = dots[i + 1] * W + dots[i]; px[at] = px[at + 1] = px[at + W] = px[at + W + 1] = DOT; }
  lg.putImageData(img, 0, 0);
  const backgrounds = {
    noise: g => { const im = g.createImageData(W, H); for (let i = 0; i < im.data.length; i += 4) { im.data[i] = rnd() * 256; im.data[i + 1] = rnd() * 256; im.data[i + 2] = rnd() * 256; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); },
    ramp: g => { const im = g.createImageData(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; im.data[i] = x % 256; im.data[i + 1] = (x + y) % 256; im.data[i + 2] = y % 256; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); },
    black: g => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }, white: g => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); },
  };
  for (const [name, paint] of Object.entries(backgrounds)) {
    const s0 = seed; const ga = document.getElementById('a').getContext('2d'), gb = document.getElementById('b').getContext('2d');
    seed = 99; paint(ga); seed = 99; paint(gb); seed = s0;
    // the two washes the game lays under the dots in fog weather
    for (const g of [ga, gb]) { g.fillStyle = 'rgba(30,36,50,0.14)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(200,205,215,0.16)'; g.fillRect(0, 0, W, H); }
    ga.fillStyle = 'rgba(225,230,238,0.22)'; for (let i = 0; i < dots.length; i += 2) ga.fillRect(dots[i], dots[i + 1], 2, 2);
    gb.globalAlpha = 0.22; gb.drawImage(layer, 0, 0); gb.globalAlpha = 1;
    const A = ga.getImageData(0, 0, W, H).data, B = gb.getImageData(0, 0, W, H).data; let max = 0, differing = 0; const hist = [0, 0, 0, 0];
    for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); if (d) differing++; if (d > max) max = d; hist[Math.min(d, 3)]++; }
    results.push({ background: name, dots: dots.length / 2, maxChannelDifference: max, channelsDiffering: differing, channels: A.length, histogram0123plus: hist });
  }
  return results;
});
console.log(JSON.stringify(out, null, 1)); await browser.close();
if (out.some(r => r.maxChannelDifference > 2)) { console.error('difference above 2'); process.exit(1); }
