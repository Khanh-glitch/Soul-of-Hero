// Original C #20 first rift-contour field only, with zero base for an
// isolated operation comparison. Later wireframes/blocks/particles excluded.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Frame } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import { Rng } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import { ASTRAL } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/astral';
const dir = process.argv[2]; if (!dir) throw new Error('output required');
mkdirSync(dir,{recursive:true});
for (const tick of [270,324,396,450,540]) {
  const f = new Frame(); f.clear();
  const fx = {shake() {}, flash() {}, kick() {}, invert:0, desat:0, chroma:0, bloom:1, ambient:1, ambientEcho:0};
  const spell = ASTRAL.find(x=>x.id===20)!.make(new Rng(151461),fx as any);
  const original = f.field.bind(f); let captured=false;
  f.field = (x0,y0,x1,y1,fn) => {
    original(x0,y0,x1,y1,fn);
    if (!captured && x0===40 && y0===16 && x1===380 && y1===214) {
      captured=true;
      writeFileSync(`${dir}/original_${tick}.ink32f`,Buffer.from(f.ink.buffer));
      writeFileSync(`${dir}/original_${tick}.light32f`,Buffer.from(f.light.buffer));
    }
  };
  spell.render(f,tick/60);
  if (!captured) throw new Error(`source contour field missing at ${tick}`);
}
