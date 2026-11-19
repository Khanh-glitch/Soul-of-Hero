// Generate derivative NPC action frames (use, attack, hurt, downed, dead) as 16x32 PNGs.
// Derivative of the CC0 MetroCity human body (JIK-A-4, CC0 1.0). Authored as original pixel art
// in the same 16x32 top-down scale so the runtime kit is coherent. Pure Node (zlib built-in).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), 'public/assets/npc/metrocity_v1');
mkdirSync(OUT, { recursive: true });

// ---- minimal PNG encoder (8-bit RGBA) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- pixel canvas ----
function canvas(w, h) { return { w, h, px: Buffer.alloc(w * h * 4) }; }
function setPx(c, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  // simple alpha over
  const sa = a / 255, da = c.px[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  c.px[i] = Math.round((r * sa + c.px[i] * da * (1 - sa)) / outA);
  c.px[i + 1] = Math.round((g * sa + c.px[i + 1] * da * (1 - sa)) / outA);
  c.px[i + 2] = Math.round((b * sa + c.px[i + 2] * da * (1 - sa)) / outA);
  c.px[i + 3] = Math.round(outA * 255);
}
function fillRect(c, x0, y0, w, h, r, g, b, a = 255) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(c, x, y, r, g, b, a); }
// draw a vertical "human" silhouette: head + body, given a color and a top y
function human(c, cx, topY, skin, cloth, h, lean = 0) {
  // head (4 wide)
  fillRect(c, cx - 2, topY, 4, 4, skin[0], skin[1], skin[2]);
  // body (5 wide)
  fillRect(c, cx - 2, topY + 4, 5, h - 4, cloth[0], cloth[1], cloth[2]);
  if (lean) for (let y = topY + 4; y < topY + h; y++) { setPx(c, cx - 2 + lean, y, cloth[0], cloth[1], cloth[2]); setPx(c, cx + 2 + lean, y, cloth[0], cloth[1], cloth[2]); }
}
const SKIN = [232, 200, 168];
const CLOTH = [70, 90, 120];
const CLOTH_DK = [40, 50, 70];

// ---- frames: 16x32, facing down ----
// use/tool: arm extended forward (right), holding a tool
function frameUse() {
  const c = canvas(16, 32);
  human(c, 7, 6, SKIN, CLOTH, 20);
  // arm + tool extending right
  fillRect(c, 11, 10, 4, 2, SKIN[0], SKIN[1], SKIN[2]);
  fillRect(c, 14, 9, 2, 6, 120, 120, 130); // tool
  return c;
}
// attack: weapon raised and thrust forward
function frameAttack() {
  const c = canvas(16, 32);
  human(c, 7, 6, SKIN, CLOTH_DK, 20, 1);
  fillRect(c, 11, 8, 4, 2, SKIN[0], SKIN[1], SKIN[2]);
  fillRect(c, 14, 6, 2, 8, 200, 200, 210); // blade forward
  return c;
}
// hurt: lean back, red tint
function frameHurt() {
  const c = canvas(16, 32);
  human(c, 8, 6, [200, 150, 150], [150, 60, 60], 20, -1);
  fillRect(c, 6, 5, 2, 2, 255, 80, 80); // hurt mark
  return c;
}
// downed: lying horizontal body
function frameDowned() {
  const c = canvas(16, 32);
  fillRect(c, 2, 18, 11, 5, SKIN[0], SKIN[1], SKIN[2]); // body lying
  fillRect(c, 5, 15, 4, 4, SKIN[0], SKIN[1], SKIN[2]); // head
  fillRect(c, 2, 18, 11, 1, CLOTH[0], CLOTH[1], CLOTH[2]);
  return c;
}
// dead: distinct from downed — darker, still, with a marker
function frameDead() {
  const c = canvas(16, 32);
  fillRect(c, 2, 19, 11, 4, 90, 90, 100); // dark body
  fillRect(c, 5, 16, 4, 4, 120, 100, 100); // head, greyish
  fillRect(c, 7, 22, 3, 2, 60, 60, 70); // blood pool marker
  return c;
}

const frames = { use: frameUse, attack: frameAttack, hurt: frameHurt, downed: frameDowned, dead: frameDead };
for (const [name, fn] of Object.entries(frames)) {
  const c = fn();
  const png = encodePNG(c.w, c.h, c.px);
  writeFileSync(resolve(OUT, `action_${name}.png`), png);
  console.log('wrote action_' + name + '.png', c.w + 'x' + c.h, png.length, 'bytes');
}
console.log('done');
