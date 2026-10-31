// Original C20 particles only, after the source has simulated its real RNG
// and block initialization. Control Math.random's default particle seeds to
// match native CKit's deterministic sequence; do not modify source files.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {Particles} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/kit';
import {ASTRAL} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/astral';
const dir=process.argv[2]; if(!dir) throw new Error('output required'); mkdirSync(dir,{recursive:true});
let autoSeed=0; Math.random=()=>((++autoSeed*7919%1000000)+0.25)/1000000;
const render=Particles.prototype.render;
Particles.prototype.render=function(f:Frame) {f.clear(); return render.call(this,f);};
for(const tick of [270,324,396,420,450,480,510]) {
 const f=new Frame(); f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=ASTRAL.find(x=>x.id===20)!.make(new Rng(151461),fx as any);
 for(let i=1;i<=tick;i++) spell.update(1/60,i/60);
 spell.render(f,tick/60);
 for(const kind of ['ink','light','disp'] as const) writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
}
