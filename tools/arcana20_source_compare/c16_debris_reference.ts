// Original C16 debris alone. Preserve source setup/update and control only
// Particles' nondeterministic default Math.random seeds to match CKit.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {Particles} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/kit';
import {VERDANT} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/verdant';
const dir=process.argv[2]; if(!dir)throw new Error('output required');mkdirSync(dir,{recursive:true});
let autoSeed=0;Math.random=()=>((++autoSeed*7919%1000000)+0.25)/1000000;
const render=Particles.prototype.render;
Particles.prototype.render=function(f:Frame){f.clear();return render.call(this,f);};
for(const tick of [450,456,457,480,510,540,590,610,660,720,744,780,786]){
 const f=new Frame();f.clear();
 let capture=false;
 const coverage=new Uint8Array(384*216);
 const ink=f.I.bind(f),light=f.L.bind(f),shade=f.S.bind(f),disp=f.D.bind(f);
 const mark=(x:number,y:number)=>{const xx=x|0,yy=y|0;if(capture&&xx>=0&&yy>=0&&xx<384&&yy<216)coverage[yy*384+xx]=1;};
 f.I=(x,y,r,g,b,a=1)=>{mark(x,y);ink(x,y,r,g,b,a);};
 f.L=(x,y,r,g,b)=>{mark(x,y);light(x,y,r,g,b);};
 f.S=(x,y,m)=>{mark(x,y);shade(x,y,m);};
 f.D=(x,y,dx,dy)=>{mark(x,y);disp(x,y,dx,dy);};
 const originalRender=Particles.prototype.render;
 Particles.prototype.render=function(frame:Frame){capture=true;return originalRender.call(this,frame);};
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=VERDANT.find(x=>x.id===16)!.make(new Rng(119785),fx as any);
 for(let i=1;i<=tick;i++)spell.update(1/60,i/60);
 spell.render(f,tick/60);
 for(const kind of ['ink','light','disp'] as const)writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
 writeFileSync(`${dir}/original_${tick}.coverage.u8`,coverage);
 Particles.prototype.render=originalRender;
}
