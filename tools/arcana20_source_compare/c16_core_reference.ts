// Capture the actual original C16 core: clear at first discL, stop after its
// first glow. Earlier seed/membrane/organism/leaflet calculations are untouched.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {VERDANT} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/verdant';
const dir=process.argv[2];if(!dir)throw Error('output required');mkdirSync(dir,{recursive:true});
for(const tick of [270,300,360,381,423,456,510,540,558]){
 const f=new Frame();f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=VERDANT.find(x=>x.id===16)!.make(new Rng(119785),fx as any);
 const disc=f.discL.bind(f),glow=f.glow.bind(f),light=f.L.bind(f);let active=false,done=false;
 const coverage=new Uint8Array(384*216);
 f.L=(x,y,r,g,b)=>{const xx=x|0,yy=y|0;if(active&&xx>=0&&yy>=0&&xx<384&&yy<216)coverage[yy*384+xx]=1;light(x,y,r,g,b);};
 f.discL=(...args)=>{if(!active){f.clear();active=true;}disc(...args);};
 f.glow=(...args)=>{glow(...args);if(active){done=true;throw new Error('CORE_END');}};
 try{spell.render(f,tick/60);}catch(e){if(!(e instanceof Error)||e.message!=='CORE_END')throw e;}
 if(!done)throw Error(`core not found ${tick}`);
 for(const kind of ['ink','light','disp'] as const)writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
 writeFileSync(`${dir}/original_${tick}.coverage.u8`,coverage);
 console.log('C16_CORE_ORIGINAL',tick);
}
