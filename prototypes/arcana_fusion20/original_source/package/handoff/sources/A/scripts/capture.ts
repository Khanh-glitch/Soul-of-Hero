// ---------------------------------------------------------------------------
// Headless capture: runs the REAL renderer (no browser) and writes PNGs of
// every spell's climax, plus optional contact sheets of a full timeline.
//   npm run shots
// ---------------------------------------------------------------------------

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// minimal ImageData shim so the browser-targeted framebuffer runs in node
class ImageDataShim {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}
(globalThis as any).ImageData = ImageDataShim;

const { Lab, DT } = await import("../src/engine/lab");
const { SPELLS } = await import("../src/spells");

function crc32(buf: Uint8Array) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w: number, h: number, rgba: Uint8ClampedArray) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}
function upscale(src: Uint8ClampedArray, w: number, h: number, s: number) {
  const out = new Uint8ClampedArray(w * s * h * s * 4);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) {
      const si = (((y / s) | 0) * w + ((x / s) | 0)) * 4;
      const di = (y * w * s + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = 255;
    }
  return out;
}

const lab = new Lab();
const fakeCtx = { putImageData() {} } as unknown as CanvasRenderingContext2D;

mkdirSync("shots", { recursive: true });
mkdirSync("shots/timeline", { recursive: true });

const args = process.argv.slice(2);
const only = args.find((a) => /^\d+$/.test(a));
const strip = args.includes("--strip");
const seqI = args.indexOf("--seq");
const seq = seqI >= 0 ? { t0: parseFloat(args[seqI + 1]), stride: parseInt(args[seqI + 2] || "2") } : null;

const W = lab.fb.W,
  H = lab.fb.H;
const t0 = Date.now();

function grab() {
  lab.render(fakeCtx);
  return new Uint8ClampedArray(lab.fb.out.data);
}
/** seek, then run a few real frames so persistence/camera are in a true state */
function shotAt(target: number, settle = 5) {
  lab.seek(Math.max(0, target - settle * DT));
  let f: Uint8ClampedArray | null = null;
  for (let i = 0; i < settle; i++) {
    lab.step();
    lab.advanced = true;
    f = grab();
  }
  return f!;
}
function sheetOf(frames: Uint8ClampedArray[], cols: number) {
  const rows = Math.ceil(frames.length / cols);
  const sw = W * cols,
    sh = H * rows;
  const sheet = new Uint8ClampedArray(sw * sh * 4);
  frames.forEach((f, i) => {
    const ox = (i % cols) * W,
      oy = ((i / cols) | 0) * H;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const si = (y * W + x) * 4,
          di = ((y + oy) * sw + x + ox) * 4;
        sheet[di] = f[si];
        sheet[di + 1] = f[si + 1];
        sheet[di + 2] = f[si + 2];
        sheet[di + 3] = 255;
      }
  });
  return { sw, sh, sheet };
}

if (args.includes("--grid")) {
  const off = parseFloat(args[args.indexOf("--grid") + 1] || "0");
  const frames = SPELLS.map((def) => {
    lab.load(def);
    return shotAt(def.climax * def.duration + off, 7);
  });
  const { sw, sh, sheet } = sheetOf(frames, 4);
  writeFileSync(`shots/timeline/grid${off ? "-" + off : ""}.png`, png(sw, sh, sheet));
  console.log("grid done");
  process.exit(0);
}

for (const def of SPELLS) {
  if (only && def.id !== parseInt(only)) continue;
  const name = `${String(def.id).padStart(2, "0")}-${def.name.toLowerCase().replace(/\s+/g, "-")}`;
  lab.load(def);
  if (seq) {
    lab.seek(seq.t0);
    const frames: Uint8ClampedArray[] = [];
    const ts: string[] = [];
    for (let k = 0; k < 16; k++) {
      for (let i = 0; i < seq.stride; i++) {
        lab.step();
        lab.advanced = true;
        if (i < seq.stride - 1) grab();
      }
      frames.push(grab());
      ts.push(lab.t.toFixed(2));
    }
    const { sw, sh, sheet } = sheetOf(frames, 4);
    writeFileSync(`shots/timeline/${name}-seq.png`, png(sw, sh, sheet));
    console.log(`✓ ${name} seq  (${ts.join(" ")})`);
    continue;
  }
  if (strip) {
    const times = [0.04, 0.2, 0.4, 0.55, def.climax, Math.min(0.97, def.climax + 0.1), 0.88, 0.99].map((f) => f * def.duration);
    const frames = times.map((tt) => shotAt(tt));
    const { sw, sh, sheet } = sheetOf(frames, 4);
    writeFileSync(`shots/timeline/${name}.png`, png(sw, sh, sheet));
    console.log(`✓ ${name} strip`);
  } else {
    const f = shotAt(def.climax * def.duration, 7);
    writeFileSync(`shots/${name}.png`, png(W * 2, H * 2, upscale(f, W, H, 2)));
    console.log(`✓ ${name}  (${lab.t.toFixed(2)}s)`);
  }
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
