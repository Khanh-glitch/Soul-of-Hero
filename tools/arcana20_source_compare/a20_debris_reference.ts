// Original A20 particle simulation, no framebuffer / demo battlefield.
import { mkdirSync, writeFileSync } from 'node:fs';
import { RealityRipper } from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/A/src/spells/astral';
const dir=process.argv[2]; if (!dir) throw new Error('output directory required');
mkdirSync(dir,{recursive:true});
const source=new RealityRipper(), frames:Record<string,unknown>={};
for(let tick=1;tick<=420;tick++) {
  source.update(1/60,tick/60);
  if ([318,320,326,336,360,420].includes(tick)) {
    frames[tick]=source.debris.alive.map(p=>({x:p.x,y:p.y,px:p.px,py:p.py,vx:p.vx,vy:p.vy,life:p.life,max:p.max,size:p.size,seed:p.seed,k:p.k}));
  }
}
writeFileSync(`${dir}/a20_original.json`,JSON.stringify({path:source.path,frames}));
