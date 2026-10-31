// Original source A VoltCarousel, with only its bolt() helper disabled by the
// in-memory esbuild diagnostic plugin. No archive/source file is modified.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Framebuffer } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/engine/framebuffer';
import { VoltCarousel } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/spells/tempest';
class ImageDataShim {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
}
(globalThis as any).ImageData = ImageDataShim;
const out = process.argv[2];
if (!out) throw new Error('output directory required');
mkdirSync(out, { recursive: true });
for (const tick of [90, 180, 270, 324, 348, 396, 420]) {
  const fb = new Framebuffer(416, 234);
  const source = new VoltCarousel();
  for (let i = 1; i <= tick; i++) source.update(1 / 60, i / 60);
  fb.clear();
  const writes = new Uint8Array(416 * 234), raw = fb.buf;
  fb.buf = new Proxy(raw, {
    get(target, key) { const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; },
    set(target, key, value) {
      if (typeof key === 'string' && /^\d+$/.test(key)) writes[Math.floor(Number(key) / 3)] = 1;
      return Reflect.set(target, key, value, target);
    }
  });
  source.render(fb, tick / 60);
  fb.buf = raw;
  writeFileSync(`${out}/original_${tick}.writes.u8`, writes);
  writeFileSync(`${out}/original_${tick}.rgb32f`, Buffer.from(fb.buf.buffer));
  fb.present({putImageData() {}} as any);
  writeFileSync(`${out}/original_${tick}.rgba8`, Buffer.from(fb.out.data.buffer));
}
