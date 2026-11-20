import {ITEMS} from './catalog';
import type {Container,Stack} from './core';
import type {Community,HumanWorld} from './humanworld';

/** Free one existing slot by moving a whole indistinguishable pantry lot.
 * Caller owns the physical unload transaction. Never retire a delivered UID:
 * it may be a receipt destination even if it is not a cargoLedger key. */
export function consolidatePantry(bin:Container,comm:Community,hw:HumanWorld){
  if(bin.slots.includes(null))return;
  const plain=(s:Stack|null):s is Stack=>!!s && !!ITEMS[s.key]?.food && ITEMS[s.key].max>1 &&
    Object.entries(s).every(([k,v])=>v===undefined||k==='uid'||k==='key'||k==='qty');
  const lots=bin.slots.filter(plain);
  const pairs=lots.flatMap(src=>lots.filter(dst=>src!==dst && src.key===dst.key && src.qty+dst.qty<=ITEMS[src.key].max).map(dst=>({src,dst})));
  if(!pairs.length)return;
  const locked=new Set(Object.keys(hw.robberyByUid??{}));
  for(const h of Object.values(hw.people)){
    if(h.intent?.work?.itemUid)locked.add(h.intent.work.itemUid);
    for(const id of h.intent?.reserved??[])locked.add(id);
    for(const id of h.intent?.work?.patchLots??[])locked.add(id);
    for(const v of h.intent?.delivery?.cargo??[])locked.add(v.uid);
  }
  const retiredCandidates=new Set(pairs.filter(({src,dst})=>!locked.has(src.uid)&&!locked.has(dst.uid)).map(({src})=>src.uid));
  for(const [id,lines] of Object.entries(comm.cargoLedger??{})){
    retiredCandidates.delete(id);
    for(const line of lines){retiredCandidates.delete(line.intoUid);retiredCandidates.delete(line.fromUid);}
    if(!retiredCandidates.size)return;
  }
  const pair=pairs.find(({src,dst})=>retiredCandidates.has(src.uid)&&!locked.has(dst.uid));if(!pair)return;
  const {src,dst}=pair;dst.qty+=src.qty;bin.slots[bin.slots.indexOf(src)]=null;
  return {containerId:bin.id,fromUid:src.uid,intoUid:dst.uid,key:src.key,qty:src.qty};
}
