import type { Container } from './core';

/** A delivery/production claim is not loose material, even when its item key
 * matches the bill. Plan the entire debit first so a missing last line pays nothing. */
export function materialPayment(c:Container, bill:readonly [string,number][], commit=false, allowedUids?: readonly string[]) {
  const required=new Map<string,number>();
  for(const [key,qty] of bill){
    if(!Number.isSafeInteger(qty)||qty<=0)return null;
    required.set(key,(required.get(key)??0)+qty);
  }
  const lines:{slot:number;uid:string;key:string;qty:number;containerId:string}[]=[];
  for(let slot=0;slot<c.slots.length && required.size;slot++){
    const s=c.slots[slot];if(!s || s.production || (allowedUids && !allowedUids.includes(s.uid)))continue;
    const need=required.get(s.key);if(!need)continue;
    const qty=Math.min(need,s.qty);lines.push({slot,uid:s.uid,key:s.key,qty,containerId:c.id});
    if(need===qty)required.delete(s.key);else required.set(s.key,need-qty);
  }
  if(required.size)return null;
  if(commit)for(const l of lines){const s=c.slots[l.slot]!;s.qty-=l.qty;if(!s.qty)c.slots[l.slot]=null;}
  return lines;
}
