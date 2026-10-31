// Diagnostic source component only, not a Gold battlefield composite.
// Bundled against the unmodified extracted source package by esbuild.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Framebuffer } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/engine/framebuffer';
import { Worldseed } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/spells/verdant';

class ImageDataShim {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
(globalThis as any).ImageData = ImageDataShim;
const out = process.argv[2];
if (!out) throw new Error('output directory required');
mkdirSync(out, { recursive: true });
for (const tick of [90, 180, 270, 324, 378, 450, 479]) {
  const fb = new Framebuffer(416, 234);
  const source = new Worldseed();
  for (let i = 1; i <= tick; i++) source.update(1 / 60, i / 60);
  fb.clear();
  // Record actual indexed buffer writes from the original operations. This
  // trace is diagnostic only; never derive world transparency from RGB.
  const writes = new Uint8Array(416 * 234);
  const rawBuffer = fb.buf;
  fb.buf = new Proxy(rawBuffer, {
    get(target, key) { const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; },
    set(target, key, value) {
      if (typeof key === 'string' && /^\d+$/.test(key)) writes[Math.floor(Number(key) / 3)] = 1;
      return Reflect.set(target, key, value, target);
    }
  });
  source.render(fb, tick / 60);
  fb.buf = rawBuffer;
  writeFileSync(`${out}/original_${tick}.writes.u8`, writes);
  writeFileSync(`${out}/original_${tick}.rgb32f`, Buffer.from(fb.buf.buffer));
  fb.present({putImageData() {}} as any);
  writeFileSync(`${out}/original_${tick}.rgba8`, Buffer.from(fb.out.data.buffer));
}
