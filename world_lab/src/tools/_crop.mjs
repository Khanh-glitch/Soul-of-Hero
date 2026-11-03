import {PNG} from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';
const plants=PNG.sync.read(fs.readFileSync('/tmp/soh_audit/packs_extracted/200380-farm-plants/PNG/Plants.png'));
const bridges=PNG.sync.read(fs.readFileSync('/tmp/soh_audit/packs_extracted/668008-bridges/PNG_n_Tiled/Bridges.png'));
function crop(src,box){const [x,y,w,h]=box;const out=new PNG({width:w,height:h});for(let j=0;j<h;j++)for(let i=0;i<w;i++){const s=((y+j)*src.width+(x+i))*4,d=(j*w+i)*4;for(let k=0;k<4;k++)out.data[d+k]=src.data[s+k]??0;}return out;}
const items=[
 ['tree_oak',plants,[261,14,52,66]],['tree_fruit',plants,[325,14,52,66]],['tree_round',plants,[202,29,38,51]],['tree_bush',plants,[204,96,35,47]],['tree_small',plants,[204,162,38,44]],['palm',plants,[324,298,53,70]],
 ['bridge_stone',bridges,[498,0,139,77]],['bridge_woodarch',bridges,[498,112,139,77]],['bridge_plank',bridges,[498,192,139,47]],['bridge_foot',bridges,[277,161,119,33]],['bridge_foot2',bridges,[293,293,103,30]],['bridge_foot3',bridges,[292,356,103,36]],
];
fs.mkdirSync('_scratch/crops',{recursive:true});
let W=720,H=0; const rows=[];
for(const [name,src,box] of items){const p=crop(src,box);fs.writeFileSync(`_scratch/crops/${name}.png`,PNG.sync.write(p));rows.push([name,p]);H+=Math.max(80,p.height+24);}
const sheet=new PNG({width:W,height:H});
let y=0;
for(const [name,p] of rows){ // nearest 2x preview
 const s=2; for(let j=0;j<p.height;j++)for(let i=0;i<p.width;i++)for(let dy=0;dy<s;dy++)for(let dx=0;dx<s;dx++){const X=i*s+dx,Y=y+j*s+dy;if(X>=W||Y>=H)continue;const a=((j*p.width+i)*4),b=(Y*W+X)*4;for(let k=0;k<4;k++)sheet.data[b+k]=p.data[a+k];}
 y+=Math.max(80,p.height*s+24);
}
fs.writeFileSync('_scratch/crops/contact.png',PNG.sync.write(sheet));
console.log(items.map(x=>x[0]).join('\n'));
