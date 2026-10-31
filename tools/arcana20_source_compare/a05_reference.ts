// Diagnostic source component only, not a Gold battlefield composite.
// Bundled against the unmodified extracted source package by esbuild.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Framebuffer } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/engine/framebuffer';
import { AbyssalBloom } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/spells/tide';

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
for (const tick of [90, 180, 270]) {
  const fb = new Framebuffer(416, 234);
  const source = new AbyssalBloom();
  for (let i = 1; i <= tick; i++) source.update(1 / 60, i / 60);
  fb.clear();
  source.render(fb, tick / 60);
  writeFileSync(`${out}/original_${tick}.rgb32f`, Buffer.from(fb.buf.buffer));
  fb.present({putImageData() {}} as any);
  writeFileSync(`${out}/original_${tick}.rgba8`, Buffer.from(fb.out.data.buffer));
}
