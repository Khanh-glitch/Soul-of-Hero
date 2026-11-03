import {PNG} from 'pngjs';import fs from 'node:fs';
for(const n of ['01_greywater_harbor_day','05_argus_courtyard_day','07_argus_l0_service_day','09_argus_l2_lens_night']){
 const p=PNG.sync.read(fs.readFileSync(`screenshots/${n}.png`)),s=2,o=new PNG({width:p.width*s,height:p.height*s});
 for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){const a=((Math.floor(y/s)*p.width+Math.floor(x/s))*4),b=(y*o.width+x)*4;for(let k=0;k<4;k++)o.data[b+k]=p.data[a+k];}
 fs.writeFileSync(`_scratch/zoom_${n}.png`,PNG.sync.write(o));
}
