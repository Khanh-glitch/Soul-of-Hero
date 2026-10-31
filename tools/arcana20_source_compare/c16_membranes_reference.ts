// Isolate the original Worldseed membrane/vein phase without rewriting it:
// clear immediately before the first authored polygon, then stop before the
// following layered-organism field. Source make/render and RNG are untouched.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {VERDANT} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/verdant';
const dir=process.argv[2];if(!dir)throw Error('output required');mkdirSync(dir,{recursive:true});
for(const tick of [210,240,300,381,456,510,558]){
 const f=new Frame();f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=VERDANT.find(x=>x.id===16)!.make(new Rng(119785),fx as any);
 const poly=f.poly.bind(f),field=f.field.bind(f),light=f.L.bind(f);let started=false,done=false,polygons=0;
 const coverage=new Uint8Array(384*216);
 f.L=(x,y,r,g,b)=>{if(started){const xx=x|0,yy=y|0;if(xx>=0&&yy>=0&&xx<384&&yy<216)coverage[yy*384+xx]=1;}light(x,y,r,g,b);};
 f.poly=(pts,fn)=>{if(!started){f.clear();started=true;}polygons++;poly(pts,fn);};
 f.field=(x0,y0,x1,y1,fn)=>{if(started && x0===164 && x1===324 && Math.abs(y0-(106-80*.78))<1e-8){done=true;throw new Error('MEMBRANE_END');}field(x0,y0,x1,y1,fn);};
 try{spell.render(f,tick/60);}catch(e){if(!(e instanceof Error)||e.message!=='MEMBRANE_END')throw e;}
 if(!started||!done||polygons!==7)throw Error(`isolation mismatch tick ${tick}: ${started}/${done}/${polygons}`);
 for(const kind of ['ink','light','disp'] as const)writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
 writeFileSync(`${dir}/original_${tick}.coverage.u8`,coverage);
 console.log('C16_MEMBRANES_ORIGINAL',tick,'polygons',polygons);
}
