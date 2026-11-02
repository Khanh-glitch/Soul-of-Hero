/** Experimental dev-only temporal LOD. It never changes game simulation,
 * combat, charge, or lifetime. High is the unchanged 60 Hz diagnostic path;
 * its presence is NOT a claim of P0 fidelity or a shippable quality mode. */
export type VisualQuality='high'|'balance'|'performance';
const key='soh.arcana-lab.quality.v1';
let quality:VisualQuality='high';
export function getVisualQuality():VisualQuality{return quality;}
export function setVisualQuality(q:VisualQuality){if(q==='high'||q==='balance'||q==='performance')quality=q;}
/** Source-impact windows retain 60 Hz. Conservative boundaries include the
 * transition into and out of the short high-energy events; reduced profiles
 * are provisional until motion review and device measurement. */
const protectedWindows:Partial<Record<number,readonly (readonly [number,number])[]>>={
 1:[[3.75,4.85]],2:[[4.8,5.4]],3:[[3.6,7.8]],4:[[3.05,3.6],[4.5,5.5]],5:[[4.25,5.8]],6:[[4.45,6.55]],7:[[4.25,5.7],[6.25,6.65]],8:[[4.9,5.7]],9:[[1.3,6.6]],10:[[4.3,5.5]],11:[[5.2,6.0]],12:[[4.3,6.1],[6.7,7.5]],13:[[2.9,3.9],[5.3,5.6]],14:[[5.3,7]],15:[[4.85,6.5]],17:[[5.65,6.6]],18:[[4.9,6.5]],19:[[7.3,8.5]],20:[[6.25,7.65]],
};
export function visualTick(id:number,seconds:number,q:VisualQuality=quality):number{
 const tick=Math.max(0,Math.floor(seconds*60+1e-8));if(q==='high')return tick;
 // Look at quantized time too, so a boundary never maps backward into a lower
 // rate while the true time is already inside a protected event.
 const stride=q==='balance'?2:3,base=Math.floor(tick/stride)*stride,t0=base/60,t1=tick/60;
 if((protectedWindows[id]||[]).some(([a,b])=>t1>=a&&t0<=b))return tick;
 return base;
}
// The review lab has separate storage. No changes to original run/profile.
if(import.meta.env.DEV&&typeof sessionStorage!=='undefined'){
 try{const saved=sessionStorage.getItem(key);if(saved==='high'||saved==='balance'||saved==='performance')quality=saved;}catch{/* storage may be disabled */}
}
export function saveVisualQuality(q:VisualQuality){setVisualQuality(q);if(import.meta.env.DEV&&typeof sessionStorage!=='undefined')try{sessionStorage.setItem(key,quality);}catch{/* optional preference */}}
