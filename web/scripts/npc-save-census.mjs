// Runs in the browser on a COPY of the normal persisted run. No app imports,
// state injection, clock advances, or assumptions that a stockpile lasts 336h.
export function readSaveCensus(canonical) {
  const key=Object.keys(localStorage).find(k=>/^soh\.state\.v\d+$/.test(k));
  const r=JSON.parse(JSON.parse(localStorage.getItem(key)).payload).run, hw=r.humanWorld;
  const byPoi=new Map(Object.values(hw.communities).map(c=>[c.poi,c]));
  const entity=id=>r.entities[id]??r.veyraOffscreenEntities?.[id];
  const claimCount=new Map();for(const h of Object.values(hw.people))if(h.bedId)claimCount.set(h.bedId,(claimCount.get(h.bedId)??0)+1);
  const [ox,oy]=r.sourceMap.veyra.originAu.map(n=>Math.round(n*2));
  const place=e=>{const local=r.entities[e.id]===e;return [(e.tx??Math.floor(e.x/16))+(local?ox:0),(e.ty??Math.floor(e.y/16))+(local?oy:0),e.floor??0];};
  const lot=s=>({uid:s.uid,key:s.key,qty:s.qty,dur:s.dur,charge:s.charge,claim:s.production?.jobId});
  const rows=canonical.map(({id,name,archetype,spaces})=>{
    const c=byPoi.get(id);if(!c)return {id,name,missing:true};
    const bedIds=c.homeBeds.filter(id=>{const e=entity(id);return e?.type==='bed_straw'&&e.owner===c.id&&e.hp>0;});
    const store=entity(c.storeEntityId),bin=r.custody[store?.c];
    const members=c.memberIds.map(id=>{const h=hw.people[id];if(!h)return {id,missing:true};
      return {id:h.actorId,origin:h.sourceId,role:h.occupation,state:h.state,position:[h.gx,h.gy,h.floor],profile:h.profile,home:h.home,pack:{id:h.inv.packId,items:r.custody[h.inv.packId].slots.filter(Boolean).map(lot)},cartId:h.inv.cartId,equip:Object.fromEntries(Object.entries(h.equip).filter(([,s])=>s).map(([slot,s])=>[slot,lot(s)])),intent:h.intent?{kind:h.intent.kind,target:h.intent.target,steps:h.intent.route?.length,next:h.intent.route?.[0],dueAt:h.intent.dueAt,blocked:h.intent.blockReason}:null,bed:h.bedId??null,hasOwnBed:bedIds.includes(h.bedId)&&claimCount.get(h.bedId)===1};});
    return {id,name,authored:{archetype,spaces},siteClass:c.class,members,beds:bedIds.map(id=>({id,at:place(entity(id)),owner:entity(id).owner,hp:entity(id).hp,claimants:claimCount.get(id)??0})),stations:c.workStations.map(id=>{const e=entity(id);return e?{id,type:e.type??e.kind,at:place(e),owner:e.owner,hp:e.hp,fuel:e.station?.fuelC,output:e.station?.outC,enabled:e.basePower?.enabled}: {id,missing:true};}),
      store:bin&&store.owner===c.id&&c.storeContainers.includes(bin.id)?{entity:store.id,at:place(store),container:bin.id,origin:bin.origin,stock:bin.slots.filter(Boolean).map(lot)}:null,
      waterSourceIds:c.waterSources,withoutAssignedBed:members.filter(m=>!m.hasOwnBed).length};
  });
  return {scope:'snapshot of finite assignments and existing custody, not route, accessible water, continuous occupancy or sustainability proof',evidence:{authored:'SOURCE_AUTHORED_UNVERIFIED',members:'VERIFIED_RUNTIME',custody:'VERIFIED_RUNTIME',waterSourceIds:'REFERENCES_ONLY',routesToSupplies:'NOT_MEASURED',h336:'NOT_MEASURED'},run:r.id,seed:r.seed,layout:r.layoutId,rules:r.sourceMap.rules,at:r.clock.lastSimAt,totalActors:Object.keys(hw.people).length,rows};
}
