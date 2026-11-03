// Generates genuine pixel-art tile/sprite atlases from procedural SOH-prototype grammar
// plus selected creator-library sprites. No illustrative substitutes, no stretched overview.
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import {Pix,hash2,packSprites} from '../lib/pixels.mjs';
import {BITS,foldMask,blobTable} from '../lib/blob.mjs';
const ROOT=process.cwd(),SRC=path.join(ROOT,'assets/source'),OUT=path.join(ROOT,'assets/generated');
fs.mkdirSync(OUT,{recursive:true});
const readPNG=p=>PNG.sync.read(fs.readFileSync(p));
const writePNG=(p,pix)=>{const png=new PNG({width:pix.width,height:pix.height});png.data.set(pix.data);fs.writeFileSync(p,PNG.sync.write(png));};
const P=c=>{const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255,255];};
export const PAL={
  outline:'#17161b',deep:['#173b58','#1d5071','#2b6d8b','#3c89a3'],shallow:['#2d6f78','#3b8a8c','#5aa99c','#8ccab0'],
  river:['#2a6078','#357d8e','#4e9aa0','#79b8ac'],foam:['#d9efdc','#a9d6c3','#eef8e8','#7fb8a5'],
  sand:['#c6aa73','#d8c18a','#ead6a2','#a68b5e'],grass:['#4e7a3c','#67994a','#86b25b','#34582c'],
  meadow:['#6a9846','#8db759','#b6cf6c','#e4d57c'],forest:['#355431','#4a6d3b','#62834a','#283f27'],
  marsh:['#465b39','#5e7146','#7c8a55','#334331'],rock:['#66665f','#858276','#a49e89','#4a4a45'],
  cliff:['#45433f','#625d53','#898171','#302e2c'],snow:['#bfd0cf','#dce9e5','#f2f7ee','#96b1b8'],
  ash:['#393235','#544244','#70554c','#262126'],lava:['#b8422c','#e27132','#f4b34c','#7e2b22'],
  dune:['#c39c5d','#dbb873','#ecd396','#9a7847'],toxic:['#48593a','#65754a','#8b9858','#303d2a'],
  dirt:['#7d6044','#9a7954','#b89568','#5c452f'],cobble:['#657079','#839098','#a5b0b1','#4b555d'],
  wood:['#6e4a30','#8e6239','#b1824e','#4a3020'],roof:['#7c3f38','#a65947','#c77a58','#522c29'],
  metal:['#50565f','#727985','#9aa2aa','#34383f'],stone:['#75757a','#95949b','#b3b1b5','#56565d'],
  glass:['#4a7f9c','#6fa8bf','#a9d8e0','#31586f'],light:['#e8c66a','#f6df97','#fff1be','#b88b3c'],
  void:['#10131a','#171b24','#222936','#090b10'],wall:['#383b44','#4a4e58','#626670','#24262d'],wood_wall:['#5a3a26','#775033','#93663e','#38251b'],door:['#343942','#4b525e','#6f7884','#22252c'],
};
function pal(n){return (PAL[n]||PAL.grass).map(P);}
function noise(x,y,s,period=16){return hash2(((x%period)+period)%period,((y%period)+period)%period,s);}
function baseTile(name,frame=0){
  const p=new Pix(16,16),c=pal(name),[c0,c1,c2,c3]=c;
  const block=(x,y,s,scale=4)=>hash2(Math.floor(x/scale),Math.floor(y/scale),name.length*17+s);
  const set=(x,y,v)=>p.set(x,y,v);
  // Coherent 4x4 color fields; patterns are drawn on top, not per-pixel random noise.
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const n=block(x,y,frame*31),base=n<.32?c0:n<.74?c1:c2;set(x,y,base);
  }
  const tufts=(color,light,count,seed)=>{
    for(let k=0;k<count;k++){
      const x=2+Math.floor(hash2(k,seed,11)*12),y=7+Math.floor(hash2(k,seed,12)*7);
      for(let j=0;j<3;j++){set(x,y-j,color);if(j===2)set(x-1,y-j,light);if(j===1)set(x+1,y-j,light);}
    }
  };
  const pebbles=(count,seed,colors)=>{for(let k=0;k<count;k++){const x=1+Math.floor(hash2(k,seed,13)*14),y=2+Math.floor(hash2(k,seed,14)*12);set(x,y,colors[k%colors.length]);}};
  if(['deep','shallow','river'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const wave=Math.floor((y+frame*2+Math.floor(Math.sin((x+frame*3)*.7)*2))/4)%4;
      set(x,y,wave===0?c2:wave===1?c1:wave===2?c0:c1);
      if((x*3+y*5+frame*7)%29===0)set(x,y,c3);
    }
  } else if(['sand','dune'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const ripple=(y+Math.floor(Math.sin((x+frame)*.5)*2))%6;set(x,y,ripple===0?c3:ripple===1?c2:x%7===0?c2:c1);}
    pebbles(6,41,[c0,c2,c3]);
  } else if(['grass','meadow','forest','marsh','toxic'].includes(name)){
    if(name==='grass')tufts(c0,c2,7,3);else if(name==='meadow'){tufts(c0,c2,5,4);for(let k=0;k<4;k++)set(2+Math.floor(hash2(k,9,11)*12),5+Math.floor(hash2(k,9,12)*9),c3);}
    else if(name==='forest'){tufts(c0,c2,4,5);for(let k=0;k<5;k++)set(1+Math.floor(hash2(k,7,11)*14),4+Math.floor(hash2(k,7,12)*11),c3);}
    else if(name==='marsh'){tufts(c0,c2,5,6);for(let y=3;y<15;y+=5)for(let x=2;x<15;x+=4)set(x,y,c3);}
    else {for(let k=0;k<7;k++)set(2+Math.floor(hash2(k,8,11)*12),3+Math.floor(hash2(k,8,12)*11),k%2?c2:c3);}
  } else if(['rock','cliff','stone'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const strata=Math.floor((y+Math.floor(x/5))/3)%3;set(x,y,strata===0?c1:strata===1?c0:c2);if(y%5===0)set(x,y,c3);}
    pebbles(5,21,[c2,c3]);
  } else if(name==='snow'){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,block(x,y,5,8)>.22?c1:c0);
    for(let k=0;k<6;k++)set(2+Math.floor(hash2(k,6,11)*12),3+Math.floor(hash2(k,6,12)*11),k%2?c2:c3);
  } else if(['ash','lava'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,block(x,y,frame,4)>.62?c1:c0);
    for(let k=0;k<5;k++){const x=2+Math.floor(hash2(k,frame,11)*12),y=2+Math.floor(hash2(k,frame,12)*12);set(x,y,name==='lava'?P('#ffb45a'):c3);set(x+1,y,name==='lava'?P('#ffd56b'):c2);}
  } else if(['dirt','road_dirt'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,(y===4||y===11)?c3:block(x,y,11,4)>.68?c2:c0);
    pebbles(7,31,[c1,c2,c3]);
  } else if(['cobble','road_cobble','plaza'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const by=Math.floor(y/5),bx=Math.floor((x+(by%2)*3)/6),joint=(y%5===0)||((x+(by%2)*3)%6===0);
      const n=hash2(bx,by,17);set(x,y,joint?c3:n>.72?c2:n>.3?c1:c0);
    }
  } else if(['wood','bridge_deck','floor_wood','deck'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const plank=Math.floor(y/4)%2;set(x,y,y%4===3?c3:plank?c1:c0);if((x*7+y)%17===0)set(x,y,c2);}
    for(let k=0;k<4;k++)set(2+k*4,2,c3);
  } else if(['floor_stone','wall_stone'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const by=Math.floor(y/8),bx=Math.floor((x+(by%2)*4)/8),joint=(y%8===0)||((x+(by%2)*4)%8===0);set(x,y,joint?c3:x%8===1||y%8===1?c2:c1);}
  } else if(['wall_wood','roof_tile'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(name==='roof_tile'){const ry=Math.floor(y/4),rx=Math.floor((x+(ry%2)*2)/4);set(x,y,y%4===3?c3:rx%2?c1:c0);}else set(x,y,x%4===0?c3:y%4===0?c2:c1);}
  } else if(name==='void'){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,(x%8===0||y%8===0)?c3:block(x,y,23,4)>.78?c2:c0);
  } else if(name==='wall'){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const by=Math.floor(y/5),bx=Math.floor((x+(by%2)*4)/8),joint=(y%5===0)||((x+(by%2)*4)%8===0);set(x,y,joint?c3:bx%3===0?c2:c1);}
  } else if(name==='wood_wall'){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,x%5===0?c3:y%6===0?c2:c1);
  } else if(name==='door'){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,x%4===0?c3:y%7===0?c2:c1);
    for(let k=0;k<3;k++)set(3+k*4,8,c2);
  } else if(['metal','glass','light','foam'].includes(name)){
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(x,y,(x+y)%6===0?c2:c1);
  }
  return p;
}
const {map:blobMap,list:blobList}=blobTable();
function irregular(x,y,s){return(hash2(x,y,s)-.5)*1.6;}
function blobTile(a,b,f){
  const p=new Pix(16,16),A=baseTile(a),B=baseTile(b),seed=a.length*131+b.length*17+f;p.blit(A,0,0);
  const band=(edge,vertical,high)=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const d=vertical?(high?15-x:x):(high?15-y:y);if(d<2.5+irregular(x,y,seed+edge))p.set(x,y,B.get(x,y));}};
  if(f&BITS.N)band(1,false,false);if(f&BITS.S)band(2,false,true);if(f&BITS.W)band(3,true,false);if(f&BITS.E)band(4,true,true);
  const corner=(cx,cy,tag)=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(Math.hypot(x-cx,y-cy)+irregular(x,y,seed+tag)<8.5)p.set(x,y,B.get(x,y));};
  if(f&BITS.NW)corner(0,0,11);if(f&BITS.NE)corner(15,0,12);if(f&BITS.SW)corner(0,15,13);if(f&BITS.SE)corner(15,15,14);
  if((f&(BITS.N|BITS.E|BITS.S|BITS.W))===(BITS.N|BITS.E|BITS.S|BITS.W))for(let y=4;y<12;y++)for(let x=4;x<12;x++)p.set(x,y,B.get(x,y));
  return p;
}
function shoreOverlay(kind){
  const p=new Pix(16,16),c=PAL.foam.map(P);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const n=noise(x,y,900+kind.length);let on=false;
    if(kind.startsWith('edge_')){const side=kind.slice(5),d={N:y,S:15-y,W:x,E:15-x}[side];on=d<2+Math.floor(n*2);}
    else if(kind.startsWith('corner_')){const q=kind.slice(7),cx=q.includes('E')?15:0,cy=q.includes('S')?15:0;on=Math.hypot(x-cx,y-cy)<8+Math.floor(n*3);}
    else on=(n>.68&&((x+y)%3!==0));
    if(on)p.set(x,y,n>.7?c[0]:n>.35?c[1]:c[2]);
  }
  return p;
}
function protoSprite(kind,v=0){
  const tall=['oak','pine','willow','palm','wall_wood','wall_stone','door','furnace','chimney','player','lens','shelf'].includes(kind);
  const p=new Pix(kind==='cart'?28:kind==='wreck'?32:24, tall?32:16);
  const R=(x,y,w,h,c)=>p.rect(x,y,w,h,P(c));
  const E=(cx,cy,rx,ry,c)=>p.ellipse(cx,cy,rx,ry,P(c));
  const Q=(x,y,c)=>p.set(x,y,P(c));
  const shadedEllipse=(cx,cy,rx,ry,base,light,dark,s)=>{for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){const nx=(x+.5-cx)/rx,ny=(y+.5-cy)/ry;if(nx*nx+ny*ny>1)continue;const n=hash2(x,y,s);Q(x,y,n>.72?light:n<.28?dark:base);}};
  if(kind==='oak'){
    R(10,22,4,9,'#5a3a22');R(12,22,2,9,'#7a5232');Q(9,30,'#5a3a22');Q(14,30,'#5a3a22');
    for(const [x,y,r] of [[12,12,9],[6+v,15,5],[18-v,15,5],[12,6,6],[8,9,5],[16,9,5]])shadedEllipse(x,y,r,r*.85,'#3f7a32','#6aa84a','#24501e',x*7+y+v);
  } else if(kind==='pine'){
    R(11,26,3,6,'#4a2e1a');for(let t=0;t<4;t++){const y0=3+t*6,w=4+t*2.4;for(let yy=0;yy<8;yy++){const hw=yy/8*w;for(let x=Math.round(12-hw);x<=Math.round(12+hw);x++){const nx=(x-12)/(w+.1);Q(x,y0+yy,nx<-.3?'#4a8a4a':nx>.35?'#1e4628':'#2e6a3a');}}}
  } else if(kind==='willow'){
    R(10,20,4,11,'#4a3a26');E(12,10,10,8,'#4a6a3a');for(let x=3;x<22;x+=2){const l=8+(hash2(x,v,5)*10|0);for(let y=12;y<12+l;y++)Q(x,y,y%2?'#5a7a42':'#3a5a2e');}
  } else if(kind==='bush'){E(8,10,7,5,'#3f7a32');E(5,8,3.5,3,'#4a8a3a');for(let k=0;k<6;k++)Q(3+(hash2(k,v,8)*10|0),6+(hash2(k,v,9)*7|0),'#79b85a');}
  else if(kind==='herb'){for(const [x,y] of [[6,10],[9,9],[8,12],[11,11],[5,13]]){R(x,y,2,2,'#4aa05a');Q(x,y,'#8ae09a');}R(8,11,1,4,'#2e6a3a');}
  else if(kind==='grass'||kind==='reed'){
    for(let k=0;k<9;k++){const x=3+k+(hash2(k,v,10)*2|0),h=4+(hash2(k,v,11)*6|0);for(let y=0;y<h;y++)Q(x+(y>h-3?(k%2?1:-1):0),14-y,['#5a9a3c','#8ac258','#3f7a32'][(k+y)%3]);}
    if(kind==='reed')for(let k=0;k<3;k++)R(4+k*4,3+k,1,3,'#7a4a2a');
  }
  else if(kind==='rock'||kind==='ore'){
    E(8,10,7,5.5,kind==='ore'?'#6d6b66':'#7d8088');E(5+v%3,8,3,2.5,kind==='ore'?'#8a7a68':'#8d9098');
    if(kind==='ore')for(let k=0;k<7;k++)Q(3+(hash2(k,v,6)*10|0),7+(hash2(k,v,7)*6|0),k%2?'#d08a5a':'#a0502a');
    for(let k=0;k<3;k++)Q(4+k*3,12,'#4e5058');
  }
  else if(kind==='stump'){E(8,11,4,2.5,'#7a5232');E(8,10,3,1.5,'#c9935a');Q(8,10,'#8a5a32');}
  else if(kind==='log'){R(2,10,12,3,'#6e4a30');R(2,10,12,1,'#9a6a3e');E(3,11,1.5,2,'#c9935a');}
  else if(kind==='mushroom'){for(const [x,y,c] of [[5,10,'#8a5ab0'],[10,9,'#a06ad0'],[8,12,'#7a4aa0']]){R(x,y+2,1,3,'#e0d8c0');E(x+.5,y+1,2.5,1.6,P(c));}}
  else if(kind==='crate'){R(2,4,12,10,'#a07040');R(2,4,12,1,'#c08a50');R(2,8,12,1,'#6a4626');R(4,6,8,1,'#5a3a22');}
  else if(kind==='barrel'){E(8,9,6,6,'#8a5a32');R(2,6,12,1,'#4a4e56');R(2,11,12,1,'#4a4e56');E(8,4,5,1.5,'#2a4a6a');}
  else if(kind==='wall_wood'||kind==='wall_stone'){
    const wood=kind==='wall_wood';R(0,0,16,10,wood?'#8a5e36':'#9a9aa2');R(0,10,16,22,wood?'#7a5230':'#7a7a82');
    for(let x=0;x<16;x+=4)R(x,0,1,32,wood?'#4a2e1a':'#55555e');R(0,9,16,1,'#3a2a2a');R(0,15,16,1,wood?'#4a2e1a':'#55555e');
  } else if(kind==='door'){R(1,6,14,26,'#4a5058');R(2,8,12,24,'#6a7280');Q(12,13,'#ff3a2a');R(2,20,12,1,'#3a3e46');}
  else if(kind==='roof'){for(let y=0;y<16;y+=4)for(let x=(y%8?0:2);x<16;x+=4){R(x,y,4,4,'#a84a32');R(x,y+3,4,1,'#6a2a1e');Q(x+1,y,'#d07a5a');}}
  else if(kind==='furnace'){E(8,15,7,9,'#8a8a90');R(1,18,14,10,'#6e6e76');R(5,17,6,5,'#1a1214');R(6,3,4,3,'#55555e');}
  else if(kind==='chimney'){R(4,4,8,26,'#6b4a3a');R(3,2,10,3,'#8b5c45');R(5,8,6,1,'#4a3228');}
  else if(kind==='waterwheel'){for(let a=0;a<8;a++){const x=8+Math.cos(a*Math.PI/4)*6,y=8+Math.sin(a*Math.PI/4)*6;R(x|0,y|0,2,2,'#8a5a32');}E(8,8,2,2,'#4a4e56');}
  else if(kind==='stairs'){
    for(let i=0;i<5;i++){R(i*3,15-i*3,16-i*3,3,'#8a8a92');R(i*3,15-i*3,16-i*3,1,'#b5b5bb');R(i*3,17-i*3,16-i*3,1,'#4c4c55');}
  } else if(kind==='lift'){
    R(1,1,14,30,'#4a5058');R(3,3,10,26,'#6a7280');for(let y=4;y<28;y+=5)R(3,y,10,1,'#3a3e46');R(6,12,4,8,'#c9a45a');R(7,13,2,6,'#f4d788');
  } else if(kind==='lens'){
    for(let y=0;y<32;y++)for(let x=0;x<24;x++){const d=Math.hypot(x-12,y-16);if(d<11){const n=hash2(x,y,77);Q(x,y,n>.72?'#a9d8e0':n>.35?'#6fa8bf':'#31586f');}else if(d<13)Q(x,y,hash2(x,y,78)>.5?'#d6b36a':'#8a6a34');}
    R(11,28,3,4,'#8a6a34');R(10,0,5,3,'#d6b36a');
  } else if(kind==='sign'){
    R(7,12,2,20,'#5a3a22');R(1,2,14,10,'#8a5a32');R(2,3,12,8,'#b1824e');R(3,5,10,1,'#4a3020');R(3,8,7,1,'#4a3020');
  } else if(kind==='shelf'){
    R(1,2,14,30,'#6e4a30');R(2,3,12,28,'#9a6a3e');for(let y=5;y<30;y+=6)R(1,y,14,2,'#4a3020');
    for(let k=0;k<8;k++)R(3+(k%4)*3,Math.floor(k/4)*6+5,2,4,k%2?'#7a4a8a':'#4a7a8a');
  } else if(kind==='player'){R(6,4,4,4,'#eab894');R(5,8,6,7,'#b4532a');R(5,15,2,4,'#33304a');R(9,15,2,4,'#33304a');Q(7,6,'#2a1a2a');Q(9,6,'#2a1a2a');}
  else if(kind==='cart'){R(3,4,20,10,'#8a5a32');R(3,4,20,2,'#b07a4a');for(let x=5;x<23;x+=4)R(x,6,1,8,'#5a3a22');E(7,16,4,4,'#4a2e1a');E(19,16,4,4,'#4a2e1a');}
  p.outline('#17161b');return p;
}
function crop(src,box){const [x,y,w,h]=box,p=new Pix(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const s=((y+j)*src.width+(x+i))*4,d=(j*w+i)*4;for(let k=0;k<4;k++)p.data[d+k]=src.data[s+k];}return p;}
function downscale(src,f){const w=Math.floor(src.width/f),h=Math.floor(src.height/f),p=new Pix(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=((y*f)*src.width+(x*f))*4,d=(y*w+x)*4;for(let k=0;k<4;k++)p.data[d+k]=src.data[s+k];}return p;}
function footCollider(p){const bottom=Math.floor(p.height*.72);let x0=p.width,x1=-1,y0=p.height,y1=-1;for(let y=bottom;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.get(x,y)[3]>40){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return x1<0?{x:0,y:p.height-2,w:p.width,h:2}:{x:x0,y:y0,w:Math.max(2,x1-x0+1),h:Math.max(2,y1-y0+1)};}
function buildingSprite(kind,w,h){
  const p=new Pix(w,h);
  if(kind==='bld_lens'){
    const PA=(c,a=255)=>{const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255,a];};
    const R=(x,y,ww,hh,c)=>p.rect(x,y,ww,hh,PA(c));const E=(cx,cy,rx,ry,c)=>p.ellipse(cx,cy,rx,ry,PA(c));
    E(24,45,20,3,'#15171c',110);R(20,40,8,8,'#5a4a32');R(22,30,4,12,'#8a6a34');
    E(24,22,19,19,'#8a6a34');E(24,22,16,16,'#d6b36a');E(24,22,13,13,'#31586f');
    for(let y=8;y<36;y++)for(let x=8;x<40;x++){const d=Math.hypot(x-24,y-22);if(d<12){const n=hash2(x,y,91);p.set(x,y,PA(n>.78?'#a9d8e0':n>.4?'#6fa8bf':'#31586f'));}}
    E(19,16,4,3,'#d9f0f4');R(23,0,3,8,'#d6b36a');R(21,3,7,2,'#f4d788');p.outline('#17161b');return p;
  }
  const PA=(c,a=255)=>{const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255,a];};
  const R=(x,y,ww,hh,c,a=255)=>p.rect(Math.round(x),Math.round(y),Math.max(0,Math.round(ww)),Math.max(0,Math.round(hh)),PA(c,a));
  const E=(cx,cy,rx,ry,c,a=255)=>p.ellipse(cx,cy,rx,ry,PA(c,a));
  const Q=(x,y,c,a=255)=>p.set(Math.round(x),Math.round(y),PA(c,a));
  const stone=/academy|archive|hall|observatory|lantern|filter/.test(kind);
  const wall=stone?'#9b958d':'#b08050',wallDark=stone?'#5f5d61':'#6b4528',wallLight=stone?'#c5bfb2':'#d1a16a';
  const roof=stone?'#3e5f7e':'#a94d3b',roofDark=stone?'#263c55':'#6d2f28',roofLight=stone?'#6d8eaa':'#d07b58';
  const glass='#6fa8bf',frame='#3a3a42',door='#5b3a24',metal='#6a7280',gold='#d6b36a';
  const roofH=Math.max(12,Math.floor(h*.34)),wallY=roofH-3,baseY=h-5;
  E(w/2,h-2,w/2-3,3,'#15171c',110);
  // Roof: shallow trapezoid with 16px shingle rhythm and a dark eave.
  for(let y=2;y<roofH;y++){
    const inset=Math.floor((1-(y-2)/roofH)*Math.min(14,w*.16));
    R(inset,y,w-2*inset,1,y%4===0?roofDark:roof);
    for(let x=inset+((y%8)>>2)*3;x<w-inset;x+=6)Q(x,y,roofLight);
  }
  R(0,roofH-3,w,4,roofDark);R(2,roofH-3,w-4,1,roofLight);
  // Walls, beams and foundation.
  R(3,wallY,w-6,baseY-wallY,wall);
  for(let x=7;x<w-7;x+=14){R(x,wallY,2,baseY-wallY,wallDark);R(x+2,wallY,1,baseY-wallY,wallLight);}
  R(3,baseY-4,w-6,4,wallDark);R(0,baseY,w,5,stone?'#56565d':'#5a3a22');R(1,baseY,w-2,1,wallLight);
  // Windows with crossframes.
  for(let x=9;x<w-11;x+=19){if(x+8>w-6)break;R(x,wallY+5,8,8,frame);R(x+1,wallY+6,6,6,glass);R(x+3,wallY+6,1,6,frame);R(x+1,wallY+8,6,1,frame);Q(x+2,wallY+7,'#a9d8e0');}
  // Central door is the physical threshold; no gameplay lock is implied.
  const dw=Math.min(14,Math.floor(w*.24)),dx=Math.floor((w-dw)/2);R(dx,baseY-17,dw,17,frame);R(dx+2,baseY-15,dw-4,15,door);for(let y=baseY-13;y<baseY-2;y+=4)R(dx+2,y,dw-4,1,'#8a5a32');Q(dx+dw-4,baseY-9,gold);
  if(/mill/.test(kind)){
    E(w-10,h-16,11,11,'#4a3a2a');E(w-10,h-16,8,8,'#8a5a32');for(let a=0;a<8;a++){const ang=a*Math.PI/4;R(w-10+Math.cos(ang)*6-1,h-16+Math.sin(ang)*6-1,2,2,'#4a3020');}E(w-10,h-16,2,2,metal);R(8,4,5,14,wallDark);R(7,2,7,3,wallLight);
  } else if(/filter/.test(kind)){
    R(w-14,2,7,18,wallDark);R(w-15,0,9,3,wallLight);R(8,baseY-20,16,3,metal);R(20,baseY-24,3,8,metal);R(5,baseY-18,w-10,2,'#6fa8bf');
  } else if(/warehouse/.test(kind)){
    for(let x=10;x<w-12;x+=12){R(x,baseY-12,8,8,'#8a5a32');R(x+1,baseY-11,6,1,'#b1824e');R(x,baseY-8,8,1,'#4a3020');}
  } else if(/cottage/.test(kind)){
    R(w-12,3,6,15,wallDark);R(w-13,1,8,3,wallLight);R(6,baseY-8,9,7,'#7a4a8a');Q(10,baseY-5,gold);
  } else if(/saw/.test(kind)){
    R(6,baseY-10,w-12,9,'#4a3020');for(let x=8;x<w-10;x+=7){E(x,baseY-7,3,3,'#8a5a32');E(x,baseY-7,1,1,'#b1824e');}
    R(4,wallY+2,w-8,2,'#6b4528');
  } else if(/academy/.test(kind)){
    for(const tx of [2,w-18]){R(tx,4,16,baseY-4,wallLight);R(tx,4,16,3,roofDark);R(tx+3,8,10,baseY-12,wall);R(tx+5,12,6,8,glass);R(tx+4,2,8,3,roofDark);}
    R(Math.floor(w/2)-3,wallY+3,6,baseY-wallY-3,roofDark);R(Math.floor(w/2)-2,wallY+5,4,baseY-wallY-5,gold);
    R(10,wallY+4,4,14,'#7a3a3a');R(w-14,wallY+4,4,14,'#7a3a3a');
  } else if(/archive/.test(kind)){
    for(let x=8;x<w-8;x+=12){R(x,wallY+2,5,baseY-wallY-2,wallLight);R(x,wallY+2,5,2,wallDark);R(x,baseY-3,5,2,wallDark);}
  } else if(/hall/.test(kind)){
    E(w/2,wallY+9,9,9,frame);E(w/2,wallY+9,7,7,glass);E(w/2,wallY+9,2,2,'#f4d788');R(4,baseY-8,6,8,wallDark);R(w-10,baseY-8,6,8,wallDark);
  } else if(/observatory/.test(kind)){
    E(w/2,roofH-2,Math.min(18,w/2-3),10,metal);E(w/2,roofH-2,Math.min(15,w/2-5),8,glass);E(w/2,roofH-2,4,4,'#a9d8e0');R(w/2-1,0,2,8,gold);R(w/2-4,3,8,2,gold);
  } else if(/lantern/.test(kind)){
    R(4,4,w-8,12,metal);R(7,7,w-14,7,'#f6df97');R(9,9,w-18,3,'#fff1be');R(2,2,w-4,3,roofDark);R(0,roofH-2,w,2,gold);
  }
  p.outline('#17161b');return p;
}
const BUILDINGS={
  bld_mill:[80,48],bld_filter_house:[48,48],bld_warehouse:[64,48],bld_cottage:[48,32],bld_saw_shed:[64,32],
  bld_academy:[96,64],bld_archive:[64,48],bld_hall_eyes:[48,48],bld_observatory:[48,64],bld_lantern:[32,48],bld_lens:[48,48],
};
const terrainSprites=[],propSprites=[],manifest={terrain:{},props:{},artProfiles:{}};
const materialNames=['deep_water','shallow_water','river_water','sand','grass','meadow','forest_floor','marsh','rock','cliff','snow','ash','lava','dune','toxic','road_dirt','road_cobble','bridge_deck','wood_deck','floor_wood','floor_stone','wall_wood','wall_stone','roof_tile','door','plaza','interior_void','water_foam'];
const keyMap={deep_water:'deep',shallow_water:'shallow',river_water:'river',sand:'sand',grass:'grass',meadow:'meadow',forest_floor:'forest',marsh:'marsh',rock:'rock',cliff:'cliff',snow:'snow',ash:'ash',lava:'lava',dune:'dune',toxic:'toxic',road_dirt:'dirt',road_cobble:'cobble',bridge_deck:'wood',wood_deck:'wood',floor_wood:'wood',floor_stone:'stone',wall_wood:'wood_wall',wall_stone:'wall',roof_tile:'roof',door:'door',plaza:'cobble',interior_void:'void',water_foam:'foam'};
for(const name of materialNames){const key=keyMap[name],frames=(name.includes('water')||name==='river_water')?4:1;for(let f=0;f<frames;f++)terrainSprites.push({name:frames===1?`tile_${name}`:`tile_${name}_f${f}`,pix:baseTile(key,f)});}
const pairs=[
 ['sand','deep'],['sand','shallow'],['grass','deep'],['grass','shallow'],['dirt','grass'],['cobble','grass'],['grass','dirt'],['grass','cobble'],
 ['grass','meadow'],['meadow','grass'],['meadow','forest'],['forest','meadow'],['forest','marsh'],['marsh','forest'],['grass','forest'],['forest','grass'],
 ['rock','cliff'],['cliff','rock'],['rock','snow'],['snow','rock'],['cliff','snow'],['snow','cliff'],['ash','lava'],['lava','ash'],['toxic','ash'],['ash','toxic'],
 ['dune','sand'],['sand','dune'],['dune','grass'],['grass','dune'],['marsh','grass'],['grass','marsh'],['stone','wood'],['wood','stone'],['dirt','cobble'],['cobble','dirt'],
 ['river','sand'],['sand','river'],['river','grass'],['grass','river'],['deep','shallow'],['shallow','deep'],['wood','deep'],['deep','wood'],['stone','floor'],['floor','stone']
];
for(const [a,b] of pairs)for(let id=0;id<47;id++)terrainSprites.push({name:`blob_${a}_${b}_${id}`,pix:blobTile(a,b,blobList[id])});
for(const k of ['edge_N','edge_E','edge_S','edge_W','corner_NE','corner_NW','corner_SE','corner_SW','confluence_T','confluence_X','river_mouth','delta'])terrainSprites.push({name:`shore_${k}`,pix:shoreOverlay(k)});
const terrainAtlas=packSprites(terrainSprites,1);writePNG(path.join(OUT,'terrain_atlas.png'),terrainAtlas.pix);
for(const [name,r] of Object.entries(terrainAtlas.rects))manifest.terrain[name]={...r,source:'procedural SOH prototype grammar + blob-47 autotile rules'};
for(const kind of ['oak','pine','willow','bush','herb','grass','reed','rock','ore','stump','log','mushroom','crate','barrel','wall_wood','wall_stone','door','roof','furnace','chimney','waterwheel','stairs','lift','lens','sign','shelf','player','cart']){
  const n=['oak','pine','rock','ore'].includes(kind)?3:1;for(let v=0;v<n;v++)propSprites.push({name:`proto_${kind}_${v}`,pix:protoSprite(kind,v)});
}
for(const [name,[w,h]] of Object.entries(BUILDINGS)){const p=buildingSprite(name,w,h);propSprites.push({name,pix:p});manifest.props[name]={source:'procedural SOH 16px modular building grammar',profile:'INDUSTRIAL-TILE-16',foot:footCollider(p),size:[w,h]};}
const plants=readPNG(path.join(SRC,'craftpix_200380_plants.png')),bridges=readPNG(path.join(SRC,'craftpix_668008_bridges.png')),roads=readPNG(path.join(SRC,'craftpix_574220_roads_reference.png'));
const large=[['3q_oak',[261,14,52,66]],['3q_fruit',[325,14,52,66]],['3q_round',[202,29,38,51]],['3q_shrub',[204,96,35,47]],['3q_bush',[204,162,38,44]],['3q_palm',[324,298,53,70]]];
for(const [name,box] of large){const p=downscale(crop(plants,box),2);propSprites.push({name,pix:p});manifest.props[name]={source:'CraftPix 200380 farm-plants, PNG/Plants.png',profile:'CRAFTPIX-3Q',foot:footCollider(p),size:[p.width,p.height]};}
const bridgeCrops=[['bridge_stone_h',[498,0,139,77]],['bridge_wood_h',[498,112,139,77]],['bridge_plank_h',[498,192,139,47]],['bridge_foot_h',[277,161,119,33]],['bridge_stone_v',[426,41,43,128]],['bridge_wood_v',[434,327,27,133]]];
for(const [name,box] of bridgeCrops){const p=downscale(crop(bridges,box),2);propSprites.push({name,pix:p});manifest.props[name]={source:'CraftPix 668008 bridges, PNG_n_Tiled/Bridges.png',profile:'INDUSTRIAL-TILE-16',size:[p.width,p.height]};}
const roadCrop=downscale(crop(roads,[12,12,48,48]),3);propSprites.push({name:'craftpix_cobble_swatch',pix:roadCrop});manifest.props['craftpix_cobble_swatch']={source:'CraftPix 574220 roads (reference-only), PNG_Tiled/Road1_grass.png',profile:'reference-only',size:[roadCrop.width,roadCrop.height]};
const propAtlas=packSprites(propSprites,1);writePNG(path.join(OUT,'props_atlas.png'),propAtlas.pix);
for(const [name,r] of Object.entries(propAtlas.rects))manifest.props[name]={...(manifest.props[name]||{}),...r,source:manifest.props[name]?.source||'procedural SOH prototype grammar'};
manifest.artProfiles={
  'SOH-PROTO-16':{perspective:'small side-presented 3/4',scale:'16–32px',regions:'Greywater Lake, Mossbrook, Elderwood, all four GOLD spawn areas',sprites:Object.keys(propAtlas.rects).filter(k=>k.startsWith('proto_')),rule:'Never mix with CRAFTPIX-3Q vegetation in the same local scene.'},
  'CRAFTPIX-3Q':{perspective:'large 3/4 top-down',scale:'17–35px after integer 2x downscale',regions:'Argus Highlands, Verdant terraces, Anubis dune oasis',sprites:large.map(x=>x[0]),rule:'Surrounding rocks, shadows and structures use the larger family. Foot collider derived from bottom 28% nontransparent pixels.'},
  'INDUSTRIAL-TILE-16':{perspective:'16px modular top-down',scale:'16px grid',regions:'Greywater Tideworks, Argus Academy interiors, bridges/docks',sprites:[...bridgeCrops.map(x=>x[0]),...Object.keys(BUILDINGS)],rule:'Walls, roofs, doors and decks share one 16px grid; ground contact at the foot anchor.'},
};
manifest.blob47={table:blobList,count:blobList.length,bitOrder:BITS,foldedMaskMap:blobMap};
manifest.sourceFiles=fs.readdirSync(SRC).map(f=>({file:f,bytes:fs.statSync(path.join(SRC,f)).size}));
fs.writeFileSync(path.join(OUT,'asset_manifest.json'),JSON.stringify(manifest,null,2));
console.log('terrain sprites',terrainSprites.length,'prop sprites',propSprites.length,'blob cases',blobList.length);
