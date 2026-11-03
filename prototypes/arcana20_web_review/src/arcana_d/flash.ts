/** Optional bounded-LDR approximation of D's authored additive flash only.
 * It consumes the actual world framebuffer before the DOM HUD, never an
 * invented background or a brightness-keyed mask. It is not D HDR/post or
 * P0 A parity. Use only with explicit review opt-in. */
export type DFlash={amount:number;color:[number,number,number]};
export function applyDFlash(g:CanvasRenderingContext2D,flashes:readonly DFlash[]){
 if(!flashes.length)return;
 g.save();try{g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='lighter';for(const f of flashes){
  const a=Math.max(0,Math.min(1,f.amount));if(!a)continue;
  const [r,green,b]= f.color.map(x=>Math.round(Math.max(0,Math.min(1,x))*255));
  g.fillStyle=`rgba(${r},${green},${b},${a})`;g.fillRect(0,0,g.canvas.width,g.canvas.height);
 }}finally{g.restore();}
}
