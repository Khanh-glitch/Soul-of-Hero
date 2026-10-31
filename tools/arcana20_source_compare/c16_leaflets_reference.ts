// Run the original C16 render. Start recording at its first leaflet ribbon,
// clear earlier fields, and stop after the fourteenth; calculations unmodified.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {VERDANT} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/verdant';
const dir=process.argv[2];if(!dir)throw Error('output required');mkdirSync(dir,{recursive:true});
for(const tick of [330,360,381,420,456,510,558,570]){
 const f=new Frame();f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=VERDANT.find(x=>x.id===16)!.make(new Rng(119785),fx as any);
 const ribbon=f.ribbon.bind(f),ink=f.I.bind(f),light=f.L.bind(f);let active=false,count=0;
 const coverage=new Uint8Array(384*216);
 function mark(x:number,y:number){const xx=x|0,yy=y|0;if(active&&xx>=0&&yy>=0&&xx<384&&yy<216)coverage[yy*384+xx]=1;}
 f.I=(x,y,r,g,b,a=1)=>{mark(x,y);ink(x,y,r,g,b,a);};f.L=(x,y,r,g,b)=>{mark(x,y);light(x,y,r,g,b);};
 f.ribbon=(pts,widths,fn)=>{if(!active){f.clear();active=true;}ribbon(pts,widths,fn);count++;if(count===14)throw new Error('LEAFLETS_END');};
 try{spell.render(f,tick/60);}catch(e){if(!(e instanceof Error)||e.message!=='LEAFLETS_END')throw e;}
 if(count!==14)throw Error(`leaflets not found ${tick}: ${count}`);
 for(const kind of ['ink','light','disp'] as const)writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
 writeFileSync(`${dir}/original_${tick}.coverage.u8`,coverage);
 console.log('C16_LEAFLETS_ORIGINAL',tick);
}
