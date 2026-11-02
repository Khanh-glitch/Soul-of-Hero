/** P0 C stage-world diagnostic policy, applied to the live terrain before
 * local fields/actors/HUD. This LDR path is not HDR or full-post parity. */
import type {Frame} from './engine/frame';
export type CStage={shade:number;scan:Float32Array};
export function combineCStage(frames:Frame[]):CStage{const scan=new Float32Array(216*2);let shade=1;for(const f of frames){shade*=f.stageShade;for(let i=0;i<scan.length;i++)scan[i]+=f.stageScanlines[i];}return {shade,scan};}
export function hasCStage(s:CStage){return s.shade!==1||s.scan.some(v=>v!==0);}
export function compositeCStage(data:Uint8ClampedArray,w:number,h:number,s:CStage){const input=new Uint8ClampedArray(data),at=(x:number,y:number,c:number)=>input[(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4+c];for(let y=0;y<h;y++){const q=Math.min(215,Math.floor((y+.5)/h*216+.0001))*2,dx=Math.floor(s.scan[q]+.5)*w/384,ch=s.scan[q+1]>.2?Math.ceil(s.scan[q+1])*w/384:0;for(let x=0;x<w;x++){const o=(y*w+x)*4;data[o]=Math.round(at(Math.floor(x+.5+dx+ch+.0001),y,0)*s.shade);data[o+1]=Math.round(at(Math.floor(x+.5+dx+.0001),y,1)*s.shade);data[o+2]=Math.round(at(Math.floor(x+.5+dx-ch+.0001),y,2)*s.shade);}}}
