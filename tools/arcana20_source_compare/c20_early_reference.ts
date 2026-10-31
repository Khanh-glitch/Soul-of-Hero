// Original C20 early glitch fields on zero base; no updates/particles required.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {ASTRAL} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/astral';
const dir=process.argv[2]; if(!dir) throw new Error('output required'); mkdirSync(dir,{recursive:true});
for(const tick of [20,45,64,84]) {
 const f=new Frame(); f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=ASTRAL.find(x=>x.id===20)!.make(new Rng(151461),fx as any);
 spell.render(f,tick/60);
 for(const kind of ['light','disp'] as const) writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
}
