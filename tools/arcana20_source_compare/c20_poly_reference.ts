// Original C20 polygons/passage only, with the first contour field cleared
// after it has populated the spell's own mask. Source is not modified.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Frame } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import { Rng } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import { ASTRAL } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/astral';
const dir=process.argv[2]; if (!dir) throw new Error('output required'); mkdirSync(dir,{recursive:true});
for (const tick of [270,324,378]) {
  const f=new Frame(); f.clear();
  const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
  const spell=ASTRAL.find(x=>x.id===20)!.make(new Rng(151461),fx as any);
  const field=f.field.bind(f); let isolated=false;
  f.field=(x0,y0,x1,y1,fn)=>{
    field(x0,y0,x1,y1,fn);
    if (!isolated && x0===40 && y0===16 && x1===380 && y1===214) { f.clear(); isolated=true; }
  };
  spell.render(f,tick/60);
  if (!isolated) throw new Error('source mask field was not found');
  writeFileSync(`${dir}/original_${tick}.light32f`,Buffer.from(f.light.buffer));
}
