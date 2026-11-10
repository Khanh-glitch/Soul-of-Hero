import { useEffect, useRef } from 'react';
import { getArt } from '../game/art';

/** Real animated SOH character art reused from Title, not a fabricated portrait. */
export function AdventurerPortrait({ female }: { female: boolean }) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    ctx.imageSmoothingEnabled=false;
    const frames=getArt().hero[female?'female':'male'];
    let raf=0;
    const loop=(time:number)=>{
      raf=requestAnimationFrame(loop);
      ctx.clearRect(0,0,64,96);
      const dir=Math.floor(time/2000)%4, walk=['walk0','walk2','walk3','walk1'][dir];
      const available=frames[walk]||frames.idle0;
      const sprite=available[Math.floor(time/190)%available.length];
      ctx.fillStyle='rgba(0,0,0,.36)';ctx.fillRect(13,83,38,6);
      if(sprite)ctx.drawImage(sprite,0,0,16,24,0,0,64,96);
    };
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[female]);
  return <canvas ref={ref} width={64} height={96} className="gold-inv-hero-canvas" aria-label="Animated adventurer portrait" role="img" />;
}
