export const BITS={N:1,E:2,S:4,W:8,NE:16,SE:32,SW:64,NW:128};
export function foldMask(m){
  let f=m&(BITS.N|BITS.E|BITS.S|BITS.W);
  if(m&BITS.NE&&m&BITS.N&&m&BITS.E)f|=BITS.NE;
  if(m&BITS.SE&&m&BITS.S&&m&BITS.E)f|=BITS.SE;
  if(m&BITS.SW&&m&BITS.S&&m&BITS.W)f|=BITS.SW;
  if(m&BITS.NW&&m&BITS.N&&m&BITS.W)f|=BITS.NW;
  return f;
}
export function blobTable(){const map={},list=[];for(let m=0;m<256;m++){const f=foldMask(m);if(!(f in map)){map[f]=list.length;list.push(f);}}return{map,list};}
