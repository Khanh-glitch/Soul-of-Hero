import {Pix} from '../lib/pixels.mjs';
const FONT={
 A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],D:['110','101','101','101','110'],
 E:['111','100','110','100','111'],F:['111','100','110','100','100'],G:['011','100','101','101','011'],H:['101','101','111','101','101'],
 I:['111','010','010','010','111'],J:['001','001','001','101','010'],K:['101','101','110','101','101'],L:['100','100','100','100','111'],
 M:['101','111','111','101','101'],N:['101','111','111','111','101'],O:['010','101','101','101','010'],P:['110','101','110','100','100'],
 Q:['010','101','101','111','011'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],
 U:['101','101','101','101','111'],V:['101','101','101','101','010'],W:['101','101','111','111','101'],X:['101','101','010','101','101'],
 Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],
 2:['111','001','111','100','111'],3:['111','001','011','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],
 6:['011','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111'],
 '-':['000','000','111','000','000'],'/':['001','001','010','100','100'],':':['000','010','000','010','000'],'.':['000','000','000','000','010'],
 ' ':['000','000','000','000','000'],'_':['000','000','000','000','111'],'+':['000','010','111','010','000'],
};
export function bitmapText(t,text,x,y,color='#ffffff',scale=1,alpha=1){
  let cx=x;for(const ch of String(text).toUpperCase()){
    const g=FONT[ch]||FONT[' '];for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(g[row][col]==='1')t.fillRect(cx+col*scale,y+row*scale,scale,scale,color,alpha);
    cx+=4*scale;
  }
}
function tintRGBA(data,mode){
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]===0)continue;
    if(mode==='night'){
      data[i]=Math.round(data[i]*.52+8);data[i+1]=Math.round(data[i+1]*.58+14);data[i+2]=Math.round(data[i+2]*.82+34);
    } else if(mode==='dusk'){
      data[i]=Math.min(255,Math.round(data[i]*1.02+18));data[i+1]=Math.round(data[i+1]*.88+8);data[i+2]=Math.round(data[i+2]*.72);
    }
  }
}
export class NodeTarget {
  constructor(w,h,terrain,props,manifest){this.pix=new Pix(w,h);this.terrain=terrain;this.props=props;this.manifest=manifest;this.w=w;this.h=h;}
  clear(){this.pix.data.fill(0);}
  blit(atlas,sx,sy,sw,sh,dx,dy,dw=sw,dh=sh,alpha=1){
    const src=atlas==='terrain'?this.terrain:this.props;
    const crop=new Pix(sw,sh);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const s=((sy+y)*src.width+(sx+x))*4,d=(y*sw+x)*4;for(let k=0;k<4;k++)crop.data[d+k]=src.data[s+k]||0;}
    if(dw!==sw||dh!==sh){const scaled=new Pix(dw,dh);for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const s=(Math.floor(y*sh/dh)*sw+Math.floor(x*sw/dw))*4,d=(y*dw+x)*4;for(let k=0;k<4;k++)scaled.data[d+k]=crop.data[s+k];}this.pix.blitAlpha(scaled,dx,dy,0,0,dw,dh,Math.round(alpha*255));}
    else this.pix.blitAlpha(crop,dx,dy,0,0,sw,sh,Math.round(alpha*255));
  }
  fillRect(x,y,w,h,color,alpha=1){
    const rgba=typeof color==='string'?hexColor(color):color,x0=Math.round(x),y0=Math.round(y),ww=Math.round(w),hh=Math.round(h);
    if(alpha>=1){this.pix.rect(x0,y0,ww,hh,rgba.slice(0,3).concat(255));return;}
    const a=Math.max(0,Math.min(1,alpha));
    for(let yy=y0;yy<y0+hh;yy++)for(let xx=x0;xx<x0+ww;xx++){
      if(xx<0||yy<0||xx>=this.w||yy>=this.h)continue;const i=(yy*this.w+xx)*4,da=this.pix.data[i+3]/255;
      const outA=a+da*(1-a);if(outA<=0)continue;
      for(let k=0;k<3;k++)this.pix.data[i+k]=Math.round((rgba[k]*a+this.pix.data[i+k]*da*(1-a))/outA);
      this.pix.data[i+3]=Math.round(outA*255);
    }
  }
  text(s,x,y,color,scale,alpha){bitmapText(this,s,x,y,color,scale,alpha);}
  finish(mode){tintRGBA(this.pix.data,mode);return this.pix;}
}
export class BrowserTarget {
  constructor(ctx,w,h,terrainImg,propsImg,manifest){this.ctx=ctx;this.w=w;this.h=h;this.terrain=terrainImg;this.props=propsImg;this.manifest=manifest;ctx.imageSmoothingEnabled=false;}
  clear(){this.ctx.clearRect(0,0,this.w,this.h);}
  blit(atlas,sx,sy,sw,sh,dx,dy,dw=sw,dh=sh,alpha=1){const img=atlas==='terrain'?this.terrain:this.props;const a=this.ctx.globalAlpha;this.ctx.globalAlpha=alpha;this.ctx.drawImage(img,sx,sy,sw,sh,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));this.ctx.globalAlpha=a;}
  fillRect(x,y,w,h,color,alpha=1){const a=this.ctx.globalAlpha;this.ctx.globalAlpha=alpha;this.ctx.fillStyle=color;this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));this.ctx.globalAlpha=a;}
  text(s,x,y,color,scale,alpha){bitmapText(this,s,x,y,color,scale,alpha);}
  finish(mode){if(mode&&mode!=='day'){const im=this.ctx.getImageData(0,0,this.w,this.h);tintRGBA(im.data,mode);this.ctx.putImageData(im,0,0);} }
}
function hexColor(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255,255];}
