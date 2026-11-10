/** P0 D world-bend history, independent of any floor colour or fake scene. */
import {phase} from './constellationState';
export class DWarp {
 readonly data=new Float32Array(480*270*4);readonly influence=new Uint8Array(480*270);private history=false;
 step(t:number){if(this.history){const d=Math.exp(-3.4/60);for(let i=0;i<this.data.length;i++)this.data[i]*=d;}if(t<=7.4)return;
  const q=phase(t,7.55,8.1),fade=1-phase(t,8.6,9.8),su=(q>=1?1:1-2**(-10*q))*fade,size=70*su,chroma=1.4*su;if(size<=0)return;this.history=true;
  const cx=244,cy=132,x0=Math.max(0,Math.floor(cx-size)),x1=Math.min(479,Math.ceil(cx+size)),y0=Math.max(0,Math.floor(cy-size)),y1=Math.min(269,Math.ceil(cy+size));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=(x+.5-cx)/size,dy=(y+.5-cy)/size;let f=1-dx*dx-dy*dy;if(f<=0)continue;f*=f;const p=y*480+x;this.data[p*4+3]+=chroma*f;this.influence[p]=1;}
 }
}
