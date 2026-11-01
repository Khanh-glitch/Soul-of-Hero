// Exact original A #11, all authored bolt, rotor and OUT operations enabled.
// Reference source-field diagnostic only: this is not the A+C fusion or world.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Framebuffer } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/engine/framebuffer';
import { VoltCarousel } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/spells/tempest';
class ImageDataShim {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
}
(globalThis as any).ImageData = ImageDataShim;
const out = process.argv[2];
const ticks = process.argv.slice(3).map(Number);
if (!out || !ticks.length || ticks.some(t => !Number.isInteger(t) || t < 0)) throw new Error('output directory and integer ticks required');
mkdirSync(out, { recursive: true });
for (const tick of ticks) {
  const fb = new Framebuffer(416, 234);
  const source = new VoltCarousel();
  for (let i = 1; i <= tick; i++) source.update(1 / 60, i / 60);
  fb.clear(); source.render(fb, tick / 60);
  writeFileSync(`${out}/a11_original_${tick}.rgb32f`, Buffer.from(fb.buf.buffer));
  fb.present({putImageData() {}} as any);
  writeFileSync(`${out}/a11_original_${tick}.rgba8`, Buffer.from(fb.out.data.buffer));
  console.log(`Original A full #11 at source tick ${tick}`);
}
