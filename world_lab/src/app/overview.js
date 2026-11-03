// 2x nearest-neighbor authoring minimap of the 500x350 GOLD-derived grid.
// This is a navigation aid, explicitly not a gameplay camera or stretched world texture.
import {M,SCALE} from '../lib/constants.mjs';
const COLORS=['#173b58','#2d6f78','#2a6078','#c6aa73','#4e7a3c','#6a9846','#355431','#465b39','#66665f','#45433f','#bfd0cf','#393235','#b8422c','#c39c5d','#48593a','#7d6044','#657079','#6e4a30','#8e6239','#8e6239','#75757a','#5a3a26','#383b44','#7c3f38','#343942','#a5b0b1','#10131a','#d9efdc'];
export function drawOverview(canvas,data,state,onPick){
  const ctx=canvas.getContext('2d'),W=SCALE.gridW,H=SCALE.gridH,sx=canvas.width/W,sy=canvas.height/H;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  const im=ctx.createImageData(W/2,H/2);
  for(let y=0;y<H/2;y++)for(let x=0;x<W/2;x++){
    const m=data.world.material[(y*2)*W+(x*2)],c=COLORS[m]||'#222222',n=parseInt(c.slice(1),16),i=(y*(W/2)+x)*4;
    im.data[i]=(n>>16)&255;im.data[i+1]=(n>>8)&255;im.data[i+2]=n&255;im.data[i+3]=255;
  }
  const tmp=document.createElement('canvas');tmp.width=W/2;tmp.height=H/2;tmp.getContext('2d').putImageData(im,0,0);
  ctx.drawImage(tmp,0,0,canvas.width,canvas.height);
  const worldToPx=(auX,auY)=>[auX*SCALE.pxPerUnit/SCALE.tile*sx,auY*SCALE.pxPerUnit/SCALE.tile*sy];
  const dot=(auX,auY,color,r=2)=>{const [x,y]=worldToPx(auX,auY);ctx.fillStyle=color;ctx.fillRect(x-r,y-r,r*2,r*2);};
  for(const q of data.world.objects.resources)dot(q.at[0],q.at[1],'#63e6ff',1);
  for(const q of data.world.objects.pois)dot(q.at[0],q.at[1],'#ffd35a',2);
  for(const q of data.world.objects.spawns)dot(q.at[0],q.at[1],'#ff5ab4',3);
  for(const q of data.poi.greywater.build_sites||[]){const [tx,ty,w,h]=q.rect;ctx.strokeStyle='#8df07a';ctx.strokeRect(tx*sx,ty*sy,w*sx,h*sy);}
  ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.strokeRect(state.camera.x/SCALE.tile*sx,state.camera.y/SCALE.tile*sy,SCALE.cameraW/SCALE.tile*sx,SCALE.cameraH/SCALE.tile*sy);
  ctx.fillStyle='#e8c66a';ctx.font='9px monospace';
  const labels=[['GREYWATER',812,592],['ARGUS',936,262],['SAWMILL',748,668]];for(const [t,x,y] of labels){const [px,py]=worldToPx(x,y);ctx.fillText(t,px+4,py-4);}
  canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),tx=Math.floor((e.clientX-r.left)/r.width*W),ty=Math.floor((e.clientY-r.top)/r.height*H);onPick(tx,ty);};
}
