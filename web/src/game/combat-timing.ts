/** K5 swing phases are fractions of the item's cycle, not renderer frame counts. */
export function swingTiming(swingMs:number, ranged:boolean, handling=1) {
  const dur=swingMs*handling;
  return {dur,contact:dur * (ranged ? 0.62 : 0.45)};
}
export function castTiming(core:string,mode:'basic'|'refined'|'signature'='basic') {
  if(mode!=='basic')return {dur:380,contact:300};
  return core==='meteor'?{dur:400,contact:300}:core==='dragon'?{dur:280,contact:170}:{dur:180,contact:100};
}
