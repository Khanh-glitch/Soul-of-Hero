// Original C20 block/collision-shock role, zero base. Contour field and
// wireframe raster are suppressed in memory after creating the source mask.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Frame} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/frame';
import {Rng} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/engine/math';
import {ASTRAL} from '../../prototypes/arcana_fusion20/original_source/package/handoff/sources/C/src/spells/astral';
const dir=process.argv[2]; if(!dir) throw new Error('output required'); mkdirSync(dir,{recursive:true});
for(const tick of [396,420,450,480,540,558]) {
 const f=new Frame(); f.clear();
 const fx={shake(){},flash(){},kick(){},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};
 const spell=ASTRAL.find(x=>x.id===20)!.make(new Rng(151461),fx as any);
 const field=f.field.bind(f); let cleared=false;
 f.field=(x0,y0,x1,y1,fn)=>{field(x0,y0,x1,y1,fn); if(!cleared && x0===40 && y0===16 && x1===380 && y1===214){f.clear();cleared=true;}};
 f.line=()=>{};
 spell.render(f,tick/60);
 if(!cleared) throw new Error('source mask field missing');
 for(const kind of ['ink','light','disp'] as const) writeFileSync(`${dir}/original_${tick}.${kind}32f`,Buffer.from(f[kind].buffer));
}
