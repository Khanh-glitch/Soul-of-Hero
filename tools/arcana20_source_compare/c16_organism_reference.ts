// Capture actual original layered leaves/cellular petals alone, without
// changing its calculations: clear on entry to the authored organism field,
// run that field, then stop before leaflets. Track writes, never RGB support.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {VERDANT} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/verdant';
const dir=process.argv[2];if(!dir)throw Error('output required');mkdirSync(dir,{recursive:true});
for(const tick of [180,240,300,381,456,510,558]){
 const f=new Frame();f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=VERDANT.find(x=>x.id===16)!.make(new Rng(119785),fx as any);
 const field=f.field.bind(f),ink=f.I.bind(f),light=f.L.bind(f);let active=false,done=false;
 const coverage=new Uint8Array(384*216);
 function mark(x:number,y:number){const xx=x|0,yy=y|0;if(active&&xx>=0&&yy>=0&&xx<384&&yy<216)coverage[yy*384+xx]=1;}
 f.I=(x,y,r,g,b,a=1)=>{mark(x,y);ink(x,y,r,g,b,a);};
 f.L=(x,y,r,g,b)=>{mark(x,y);light(x,y,r,g,b);};
 f.field=(x0,y0,x1,y1,fn)=>{if(x0===164&&x1===324&&Math.abs(y0-(106-80*.78))<1e-8){f.clear();active=true;field(x0,y0,x1,y1,fn);done=true;throw new Error('ORGANISM_END');}field(x0,y0,x1,y1,fn);};
 try{spell.render(f,tick/60);}catch(e){if(!(e instanceof Error)||e.message!=='ORGANISM_END')throw e;}
 if(!done)throw Error(`organism field not found at ${tick}`);
 for(const kind of ['ink','light','disp'] as const)writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
 writeFileSync(`${dir}/original_${tick}.coverage.u8`,coverage);
 console.log('C16_ORGANISM_ORIGINAL',tick);
}
