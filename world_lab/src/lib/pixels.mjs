// Tiny deterministic pixel canvas used by the atlas generator, the Node capture tool,
// and the shared renderer.  All coordinates are integer device pixels; no smoothing.
export function hex(c){
  if(Array.isArray(c)) return c;
  const n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255,255];
}
export function hash2(x,y,s=0){
  let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,2246822519))|0;
  h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296;
}
export function mulberry(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export class Pix {
  constructor(w,h){this.width=w;this.height=h;this.data=new Uint8Array(w*h*4);}
  idx(x,y){return (y*this.width+x)*4;}
  set(x,y,c){x|=0;y|=0;if(x<0||y<0||x>=this.width||y>=this.height)return;const [r,g,b,a=255]=hex(c);const i=this.idx(x,y);this.data[i]=r;this.data[i+1]=g;this.data[i+2]=b;this.data[i+3]=a;}
  get(x,y){if(x<0||y<0||x>=this.width||y>=this.height)return[0,0,0,0];const i=this.idx(x,y);return[this.data[i],this.data[i+1],this.data[i+2],this.data[i+3]];}
  rect(x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.set(x+i,y+j,c);}
  ellipse(cx,cy,rx,ry,c){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){const nx=(x+.5-cx)/rx,ny=(y+.5-cy)/ry;if(nx*nx+ny*ny<=1)this.set(x,y,c);}}
  outline(c='#140c14'){const w=this.width,h=this.height;const src=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)src[y*w+x]=this.get(x,y)[3]>40?1:0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(src[y*w+x])continue;if((x>0&&src[y*w+x-1])||(x<w-1&&src[y*w+x+1])||(y>0&&src[(y-1)*w+x])||(y<h-1&&src[(y+1)*w+x]))this.set(x,y,c);}}
  blit(src,dx,dy,sx=0,sy=0,sw=src.width,sh=src.height,flipX=false){for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const [r,g,b,a]=src.get(sx+(flipX?sw-1-x:x),sy+y);if(!a)continue;this.set(dx+x,dy+y,[r,g,b,a]);}}
  blitAlpha(src,dx,dy,sx=0,sy=0,sw=src.width,sh=src.height,alpha=255){for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const [r,g,b,a]=src.get(sx+x,sy+y);if(!a)continue;this.set(dx+x,dy+y,[r,g,b,Math.round(a*alpha/255)]);}}
}
export function fromPNG(png){const p=new Pix(png.width,png.height);p.data.set(png.data);return p;}
export function packSprites(sprites,pad=1){
  // sprites: [{name,pix}]; returns {pix,rects}
  let x=pad,y=pad,rowH=0,W=1024,H=1024;const rects={};const canvas=new Pix(W,H);
  for(const s of sprites){const w=s.pix.width,h=s.pix.height;if(x+w+pad>W){x=pad;y+=rowH+pad;rowH=0;}if(y+h+pad>H)throw new Error('atlas overflow');canvas.blit(s.pix,x,y);rects[s.name]={x,y,w,h};x+=w+pad;rowH=Math.max(rowH,h);}
  return {pix:canvas,rects};
}
