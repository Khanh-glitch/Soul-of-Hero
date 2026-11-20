/** Occupation execution on real shared K1 custody, canonical recipes, station queues,
 * item repair rules, garden laws and physical structures. No work output loot table. */
import { materialPayment } from './material-payment';
import { WW, WH, TILE, uid, type RunState, type Entity, type Stack } from './core';
import { ITEMS, RECIPES, STRUCTS, GARDEN_CROPS, isGardenCrop, stationBurnable } from './catalog';
import { authoredStationFootprint,globalCellTileAndClass,mkStack,mkContainer,C, addItem, addStack, queuePaidRecipe, structureRepairCost, receipt, markDirty, clearSurvivorSight, clearPhysicalLine, productionFits, findRunEntity, allRunEntities } from './engine';
import { VEYRA_RECYCLER_SITE } from './world';
import { recoveryPlan, recoveryPlanFor } from './recycler';
import type { HumanRecord, HumanWorld } from './humanworld';
export type HumanJobKind = 'cook' | 'recycle' | 'repair_item' | 'garden' | 'medical' | 'engineer' | 'build' | 'guard';
export interface HumanWorkTask {
  kind: HumanJobKind; entityId?: string; patientId?: string; itemUid?: string;
  recipe?: string; crop?: 'crop' | 'herb' | 'berry';
  phase: 'fetch' | 'travel' | 'act' | 'machine' | 'collect';
  inputs: [string, number][]; duration: number;
  machineJobId?: string; readyAt?: number; outputs?: [string, number][];
  observedPatient?:{gx:number;gy:number;floor:number};
  gardenAction?:'plant'|'water'|'harvest'; sowingId?:string;
  rebuildSite?:string;
  resumePhase?:'machine';
}
type Router = (gx: number, gy: number, floor: number) => { tx: number; ty: number; floor: number }[] | null;
const pack = (r: RunState, h: HumanRecord) => C(r, h.inv.packId);
export function humanEntityTile(r: RunState, e: Entity): [number, number] {
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / .5) : 0, oy = o ? Math.round(o[1] / .5) : 0;
  return r.entities[e.id] === e ? [ox + (e.tx ?? Math.floor(e.x / TILE)), oy + (e.ty ?? Math.floor(e.y / TILE))] : [e.tx ?? Math.floor(e.x / TILE), e.ty ?? Math.floor(e.y / TILE)];
}
export function humanCanUseEntity(r: RunState, h: HumanRecord, e: Entity): boolean {
  return (e.hp??1)>0 && atWorksite(r,h,e);
}
function atWorksite(r:RunState,h:HumanRecord,e:Entity){
  if ((e.floor ?? 0) !== h.floor) return false;
  const [gx, gy] = humanEntityTile(r, e);
  if (Math.abs(h.gx - gx)+Math.abs(h.gy - gy) > 1) return false;
  if(r.entities[e.id]!==e || h.floor!==(r.veyraFloor??0))return true; // exact cardinal contact, no intermediate cell can hide a wall
  const o = r.sourceMap?.veyra?.originAu, ox = o ? Math.round(o[0] / .5) : 0, oy = o ? Math.round(o[1] / .5) : 0;
  return clearPhysicalLine(r, { x: (h.gx - ox + .5) * TILE, y: (h.gy - oy + .5) * TILE }, e, true, true);
}
/** Whole-stack transfers preserve UID; partial transfers create a distinct child only on admission. */
export function moveHumanGoods(r: RunState, from: string, into: string, key: string, qty: number, claim?: {jobId:string;workerId:string}): number {
  const src = C(r, from); let moved = 0;
  for (let i = 0; i < src.slots.length && moved < qty; i++) {
    const s = src.slots[i]; if (!s || s.key !== key || (claim ? s.production?.jobId!==claim.jobId || s.production.workerId!==claim.workerId : !!s.production)) continue;
    const n = Math.min(s.qty, qty - moved), whole = n === s.qty;
    const transfer: Stack = whole ? s : { ...s, uid: uid(r, 's'), qty: n };
    if (whole) src.slots[i] = null; else s.qty -= n;
    if (!addStack(r, into, transfer)) { if (whole) src.slots[i] = s; else s.qty += n; break; }
    // The paid output remains worker-owned until reached-store delivery.
    moved += n;
  }
  return moved;
}
/** At the warehouse, stage the whole bill against copies of the two
 * inventories. A vanished last ingredient or a full pack must not withdraw the
 * first ingredient. Use the same transfer rules (including splits and merges)
 * for preflight and commit; never publish preview UIDs or advance live nextId. */
function fetchWorkMaterials(r:RunState, from:string, into:string, bill:[string,number][], workerId:string, orderId:string, now:number) {
  const copy=(id:string)=>({...C(r,id), slots:C(r,id).slots.map(s=>s?{...s}:null)});
  const trial={...r,custody:{[from]:copy(from),[into]:copy(into)}};
  const missing:[string,number][]=[];
  for(const [key,qty] of bill){
    const need=qty-count(trial,into,key);if(need<=0)continue;
    if(moveHumanGoods(trial,from,into,key,need)!==need)return false;
    missing.push([key,need]);
  }
  if(!materialPayment(C(trial,into),bill))return false;
  for(const [key,qty] of missing){
    const quantities=(id:string)=>new Map(C(r,id).slots.flatMap(s=>s?.key===key?[[s.uid,s.qty] as const]:[]));
    const source=quantities(from),pack=quantities(into);
    moveHumanGoods(r,from,into,key,qty);
    const left=quantities(from);
    const inputs=[...source].flatMap(([uid,n])=>n>(left.get(uid)??0)?[{uid,key,qty:n-(left.get(uid)??0)}]:[]);
    const received=[...quantities(into)].flatMap(([uid,n])=>n>(pack.get(uid)??0)?[{uid,key,qty:n-(pack.get(uid)??0)}]:[]);
    receipt(r,now,'human.work.input',JSON.stringify({workerId,orderId,containerId:from,into,inputs,received}));
  }
  return true;
}
function repairRule(s:Stack|null|undefined, e:Entity|undefined, community:string){
  if(!s || s.production || s.qty!==1 || s.dur===undefined || !Number.isFinite(s.dur) || s.dur<0 ||
    !e?.station || e.kind!=='struct' || (e.owner && e.owner!==community) || (e.hp??1)<=0)return null;
  const def=ITEMS[s.key];return def?.dur && s.dur<def.dur && def.repair?.station===e.type ? def.repair : null;
}
function count(r: RunState, cid: string, key: string) { return C(r, cid).slots.reduce((n,s) => n + (s?.key === key && !s.production ? s.qty : 0), 0); }
function knownRecipe(h: HumanRecord, key: string) {
  // Profession-origin training is finite, run-persistent knowledge, not the player's research ledger.
  return h.knownRecipes?.includes(key) === true;
}
// The Foundry Recycler is public. Slagworks workers know this single authored
// machine; do not grant a settlement every public machine in the active window.
function localRecycler(r: RunState, poi: string, e: Entity) {
  if (poi !== VEYRA_RECYCLER_SITE.poi || e.kind !== 'recycler' || e.poi !== 'factory' || e.owner || (e.floor ?? 0) !== 0) return false;
  const [gx, gy] = humanEntityTile(r,e);
  return gx === VEYRA_RECYCLER_SITE.tx && gy === VEYRA_RECYCLER_SITE.ty;
}
// Only loose components are autonomous inputs. The player's voluntary tool
// recovery rules also accept intact tools, which workers must keep for work.
function salvagePlan(s: Stack, fromWarehouse = false) {
  if (s.production || ITEMS[s.key].dur !== undefined) return null;
  return recoveryPlan(fromWarehouse ? { ...s, qty: 1 } : s);
}
function taskCandidates(r: RunState, hw: HumanWorld, h: HumanRecord): HumanWorkTask[] {
  const comm = h.community ? hw.communities[h.community] : undefined; if (!comm) return [];
  const entities = allRunEntities(r).filter(e => (e.hp ?? 1) > 0 && (h.occupation==='salvager' && localRecycler(r,comm.poi,e) || comm.workStations.includes(e.id) || e.poi === comm.poi && e.owner === comm.id || h.occupation==='guard' && (e.id===comm.storeEntityId || e.kind==='door' && e.poi===comm.poi)));
  const tasks: HumanWorkTask[] = [], start = (kind: HumanJobKind, e: Entity | undefined, inputs: [string,number][], duration: number): HumanWorkTask => ({kind,entityId:e?.id,inputs,duration,phase:'travel'});
  const warehouse=findRunEntity(r,comm.storeEntityId);
  const collapsed=warehouse?.hp===0 && warehouse.kind==='bag' && warehouse.owner===comm.id;
  if(collapsed && h.occupation==='builder'){
    if(count(r,h.inv.packId,'wood')>=2)tasks.push(start('build',warehouse,[['wood',2]],8000));
    else h.lastWorkBlock='Collapsed warehouse needs two carried wood for braces.';
  }
  const stores = collapsed?[]:comm.storeContainers.filter(c => r.custody[c]);
  const available = (key: string, n: number) => count(r,h.inv.packId,key) + stores.reduce((q,c) => q+count(r,c,key),0) >= n;
  if(h.occupation==='builder')for(const [siteId,site] of Object.entries(comm.lostWorksites??{})){
    const key=STRUCTS[site.type]?.item,recipe=key?RECIPES[key]:null;
    if(!key || !recipe?.base || recipe.station || findRunEntity(r,siteId))continue;
    const packed=available(key,1),bill:[string,number][]=packed?[[key,1]]:recipe.ins;
    if(bill.every(([k,n])=>available(k,n)))tasks.push({...start('build',undefined,bill,8000+recipe.secs*1000),rebuildSite:siteId});
    else h.lastWorkBlock=`Need a packed ${site.type} or its materials to rebuild.`;
  }
  const preparedKeys=new Set((h.knownRecipes??[]).flatMap(k=>RECIPES[k]?[RECIPES[k].out]:[]));
  const prepared=stores.reduce((n,cid)=>n+C(r,cid).slots.reduce((q,s)=>q+(s&&preparedKeys.has(s.key)?s.qty:0),0),0);
  const foodNeed=prepared<comm.memberIds.length; // one canonical prepared meal per resident; finite pantry target

  for (const e of entities) {
    // Completed paid work outlives a temporary combat/recruitment intent. The
    // physical stack's claim is sufficient to recover it, never a matching item key.
    if(e.station) {
      const pending=e.station.queue.find(j=>j.workerId===h.actorId);if(pending){
        if(e.kind==='recycler') {
          const plan=pending.reserved?.[0] && recoveryPlanFor(pending.reserved[0],pending.recipe);
          if(plan)tasks.push({...start('recycle',e,[],800),phase:'machine',machineJobId:pending.id,recipe:pending.recipe,outputs:plan.outputs});
          continue;
        }
        const rc=RECIPES[pending.recipe];if(rc){
        const needsFuel=e.station.burn<=0&&!C(r,e.station.fuelC).slots.some(s=>s&&!s.production&&stationBurnable(s.key));
        const fuel=needsFuel?[...pack(r,h).slots,...stores.flatMap(id=>C(r,id).slots)].find(s=>s&&!s.production&&stationBurnable(s.key)):undefined;
        tasks.push({...start('cook',e,fuel?[[fuel.key,1]]:[],1000),phase:'machine',resumePhase:'machine',machineJobId:pending.id,recipe:pending.recipe,outputs:rc.outs??[[rc.out,rc.qty]]});
      }continue;}
      const claims=new Map<string,[string,number][]>();
      for(const s of C(r,e.station.outC).slots)if(s?.production?.workerId===h.actorId){const outputs=claims.get(s.production.jobId)??[];outputs.push([s.key,s.qty]);claims.set(s.production.jobId,outputs);}
      for(const [jobId,outputs]of claims)tasks.push({...start(h.occupation==='salvager'?'recycle':'cook',e,[],800),phase:'collect',machineJobId:jobId,outputs});
    }
    if (h.occupation === 'cook' && foodNeed && !Object.values(h.workOutputs??{}).some(q=>q>0) && e.station && !e.station.queue.length && STRUCTS[e.type!]?.station === 'campfire') {
      for (const [recipe, rc] of Object.entries(RECIPES)) if (rc.station === 'campfire' && (ITEMS[rc.out]?.food?.hunger??0)>0 && knownRecipe(h,recipe) && rc.ins.every(([k,q])=>available(k,q))) {
        const ins=rc.ins.map(([k,q])=>[k,q] as [string,number]);
        if(e.station.burn<=0&&!C(r,e.station.fuelC).slots.some(s=>s&&!s.production&&stationBurnable(s.key))){
          const fuel=[...pack(r,h).slots,...stores.flatMap(c=>C(r,c).slots)].find(s=>s&&!s.production&&stationBurnable(s.key));
          if(!fuel)continue;
          const existing=ins.find(([k])=>k===fuel.key);if(existing)existing[1]++;else ins.push([fuel.key,1]);
          if(!ins.every(([k,q])=>available(k,q)))continue;
        }
        const task = start('cook',e,ins,1200); task.recipe=recipe; task.outputs=rc.outs ?? [[rc.out,rc.qty]]; tasks.push(task);
      }
    }
    if (h.occupation === 'salvager' && e.kind === 'recycler' && e.station && !e.station.queue.length) {
      for (const s of pack(r,h).slots) if (s && !h.workOutputs?.[s.uid]) { const plan=salvagePlan(s); if (plan && productionFits(r,e.station.outC,plan.outputs)) tasks.push({...start('recycle',e,[],1500),itemUid:s.uid,outputs:plan.outputs}); }
      // Fetch one unclaimed component (never dismantle community tools).
      if(warehouse?.owner===comm.id && warehouse.c && stores.includes(warehouse.c) && pack(r,h).slots.includes(null))
      for(const s of C(r,warehouse.c).slots)if(s){
        const plan=salvagePlan(s,true);
        if(plan && productionFits(r,e.station.outC,plan.outputs))tasks.push({...start('recycle',e,[],1500),phase:'fetch',itemUid:s.uid,outputs:plan.outputs});
      }
    }
    if (h.occupation === 'mechanic' && e.type === 'workbench') {
      const items = [...pack(r,h).slots, ...Object.values(h.equip)].filter((s): s is Stack => !!s);
      for(const s of items){const rule=repairRule(s,e,comm.id);if(rule && rule.cost.every(([k,q])=>available(k,q)))tasks.push({...start('repair_item',e,rule.cost,8000),itemUid:s.uid});}
    }
    if (h.occupation === 'gardener' && e.owner===comm.id && e.garden) {
      const g=e.garden;
      if (isGardenCrop(g.crop) && g.growth >= 1) tasks.push({...start('garden',e,[],2000),gardenAction:'harvest',crop:g.crop,sowingId:g.sowing?.id});
      else if (!g.crop) { for (const crop of ['crop','herb','berry'] as const) if (GARDEN_CROPS[crop].inputs.every(([k,q])=>available(k,q))) { tasks.push({...start('garden',e,GARDEN_CROPS[crop].inputs,2500),gardenAction:'plant',crop}); break; } }
      else if (isGardenCrop(g.crop) && g.water<2){
        const flask=pack(r,h).slots.find(s=>s && !s.production && ITEMS[s.key].waterContainer && (s.charge??0)>0);
        if(flask)tasks.push({...start('garden',e,[],1500),gardenAction:'water',crop:g.crop,itemUid:flask.uid,sowingId:g.sowing?.id});
      }
    }
    if (h.occupation === 'builder' && e.kind === 'struct' && e.hp !== undefined && e.maxHp && e.hp < e.maxHp && !STRUCTS[e.type!]?.item) {
      const cost=structureRepairCost(e); if(cost.length && cost.every(([k,q])=>available(k,q))) tasks.push(start('build',e,cost,8000));
    }
    if (h.occupation === 'engineer' && e.basePower && e.c) {
      const loaded=C(r,e.c).slots.some(s=>s&&!s.production&&ITEMS[s.key].fuel);
      if(!e.basePower.enabled || (!loaded && e.basePower.energy<=0)){
        const fuel=loaded?null:[...pack(r,h).slots,...stores.flatMap(cid=>C(r,cid).slots)].find(s=>s&&!s.production&&ITEMS[s.key].fuel);
        if(loaded || fuel)tasks.push(start('engineer',e,fuel?[[fuel.key,1]]:[],3000));
        else h.lastWorkBlock='Generator needs fuel; none in my pack or our store.';
      }
    }
  }
  if(h.occupation==='guard') {
    // A kill earmarks an existing loose stack, not a second loot roll. Another
    // claimant may collect it before the guard arrives.
    if(h.gameDrop){
      const drop=findRunEntity(r,h.gameDrop.entityId);
      if(drop?.kind==='drop' && drop.c && r.custody[drop.c]?.slots.some(s=>s?.uid===h.gameDrop!.stackUid && s.key==='meat'))
        tasks.push({...start('guard',drop,[],1200),itemUid:h.gameDrop.stackUid});
      else delete h.gameDrop;
    }
    const posts=entities.filter(e=>e.kind==='door'||e.id===comm.storeEntityId).sort((a,b)=>a.id.localeCompare(b.id));
    if(posts.length)tasks.push(start('guard',posts[(h.patrolPostIndex??0)%posts.length],[],8000));
  }
  if (h.occupation === 'medic') {
    const seen=comm.memberIds.map(id=>hw.people[id]).filter(p=>eligiblePatient(h,p) && clearSurvivorSight(r,h,p) &&
      !comm.memberIds.some(id=>hw.people[id]?.intent?.work?.patientId===p.actorId));
    seen.sort((a,b)=>Number(b.state==='DOWNED')-Number(a.state==='DOWNED') || a.hp-b.hp || a.actorId.localeCompare(b.actorId));
    for(const p of seen){
      const key=available('bandage',1)?'bandage':available('herb',1)?'herb':undefined;
      if(key)tasks.push({...start('medical',undefined,[[key,1]],6000),patientId:p.actorId,observedPatient:patientTile(p)});
    }
  }
  return tasks;
}
const patientTile=(p:HumanRecord)=>({gx:p.gx,gy:p.gy,floor:p.floor});
function eligiblePatient(h:HumanRecord,p:HumanRecord|undefined):p is HumanRecord {
  return !!p && p!==h && p.community===h.community && p.floor===h.floor && !p.transit &&
    !['DEAD','EVACUATED','ON_VESSEL','FIGHTING'].includes(p.state) && (p.state==='DOWNED'||p.wounds.some(w=>!w.treated));
}
function target(r: RunState, hw: HumanWorld, h: HumanRecord, task: HumanWorkTask): [number,number,number] | null {
  if (task.phase==='fetch') {
    const c=h.community ? hw.communities[h.community] : undefined,e=findRunEntity(r,c?.storeEntityId);
    return e?[...humanEntityTile(r,e),e.floor??0]:null;
  }
  if(task.rebuildSite){const site=h.community?hw.communities[h.community]?.lostWorksites?.[task.rebuildSite]:undefined;return site?[site.tx,site.ty,site.floor]:null;}
  if (task.patientId) {
    // Legacy tasks had no sighting. Reacquire locally rather than tracking the
    // patient's current coordinates from a pre-observation save.
    if(!task.observedPatient){const p=hw.people[task.patientId];if(!eligiblePatient(h,p)||!clearSurvivorSight(r,h,p))return null;task.observedPatient=patientTile(p);}
    const p=task.observedPatient;return p.floor===h.floor?[p.gx,p.gy,p.floor]:null;
  }
  const e=task.entityId && findRunEntity(r,task.entityId); return e ? [...humanEntityTile(r,e),e.floor??0] : null;
}
/** A nearby responder must see the body. Only a real route starts a response;
 * a fetched dose remains in the responder's custody on interruption. */
export function dispatchMedicalResponse(r:RunState,hw:HumanWorld,p:HumanRecord,now:number,route:(h:HumanRecord,...dest:[number,number,number])=>ReturnType<Router>){
  const c=p.community && hw.communities[p.community];if(!c || p.state!=='DOWNED')return;
  const distance=(h:HumanRecord)=>Math.abs(h.gx-p.gx)+Math.abs(h.gy-p.gy);
  const helpers=c.memberIds.map(id=>hw.people[id]).filter(h=>h && h.community===p.community && h.floor===p.floor && !h.following && !h.motion && !h.intent?.work &&
    (h.state==='IDLE'||(h.harvestJob?.phase==='source' && ['WORKING','MOVING'].includes(h.state))) && !h.transit && (!h.intent || h.intent.target?.startsWith('global-harvest:')))
    .sort((a,b)=>Number(b.occupation==='medic')-Number(a.occupation==='medic') || distance(a)-distance(b) || a.actorId.localeCompare(b.actorId));
  let hasDose=false,witnessed=false;
  for(const h of helpers){
    if(!clearSurvivorSight(r,h,p))continue;witnessed=true;
    const medicine=['bandage','herb'];let key=medicine.find(k=>count(r,h.inv.packId,k)>0),phase:HumanWorkTask['phase']='travel';
    let dest:[number,number,number]=[p.gx,p.gy,p.floor];
    if(!key && h.occupation==='medic'){
      const store=findRunEntity(r,c.storeEntityId);
      if(store?.c && store.owner===c.id && c.storeContainers.includes(store.c) && (store.hp??1)>0){
        key=medicine.find(k=>count(r,store.c!,k)>0);phase='fetch';dest=[...humanEntityTile(r,store),store.floor??0];
      }
    }
    if(!key)continue;hasDose=true;const path=route(h,...dest);if(!path)continue;
    h.intent={intentId:uid(r,'hw'),actorId:h.actorId,kind:'work',target:'occupation:medical',reserved:[],preconditions:['community casualty','physical treatment and one dose'],startAt:now,dueAt:now+(phase==='fetch'?800:6000),route:path,work:{kind:'medical',phase,inputs:[[key,1]],duration:6000,patientId:p.actorId,observedPatient:patientTile(p)}};
    h.state=path.length?'MOVING':'WORKING';receipt(r,now,'human.medical.respond',`${h.actorId}:${p.actorId}:${phase}:${path.length}`);return;
  }
  p.lastWorkBlock=hasDose?'No certified medical route yet.':witnessed?'No available community responder with medicine.':'No available responder has seen the casualty.';
}
export function planHumanOccupation(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, route: Router): boolean {
  if (h.following || !h.community) return false;
  let task=h.intent?.work;
  if (!task) {
    for (const candidate of taskCandidates(r,hw,h)) {
      const needs=candidate.phase==='fetch' || candidate.inputs.some(([k,q])=>count(r,h.inv.packId,k)<q);
      candidate.phase=needs?'fetch':candidate.machineJobId?(candidate.phase==='machine'?'machine':'collect'):'travel';
      const dest=target(r,hw,h,candidate); if(!dest)continue;
      const path=route(...dest);
      // A funded repair can require several bounded searches just to reach
      // the store. Keep its target on the committed retry clock, not behind
      // another full island census. No path means no travel or work yet.
      const pending=!path && (candidate.kind==='repair_item' || candidate.kind==='garden') && h.routeSearch?.status==='PENDING_SEARCH' &&
        h.routeSearch.target===`${dest[2]}:${dest[0]},${dest[1]}`;
      if(!path && !pending)continue;
      task=candidate;
      h.intent={intentId:uid(r,'hw'),actorId:h.actorId,kind:'work',target:`occupation:${task.kind}`,preconditions:['community permission','physical access','canonical paid bill'],reserved:[],startAt:now,dueAt:now,route:path??[],work:task};
      if(!path){h.state='IDLE';h.nextThinkAt=now+3000;return true;}
      h.state=path.length?'MOVING':'WORKING'; h.intent.dueAt=now+(task.phase==='fetch'?800:task.duration); return true;
    }
    return false;
  }
  if (!['travel','fetch','machine','collect'].includes(task.phase)) return false;
  const dest=target(r,hw,h,task); if(!dest){
    // A lost kitchen/patient isn't a destination to retry forever. Paid stock
    // remains in its real pack/wreck; the next review can take another task.
    h.lastWorkBlock='Worksite or patient unavailable; keeping carried materials.';
    receipt(r,now,'human.work.blocked',`${h.actorId}:${h.intent!.intentId}:${h.lastWorkBlock}`);
    h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+3000;return false;
  }
  const path=route(...dest); if(!path){
    if((task.kind==='repair_item'||task.kind==='garden'||task.kind==='medical') && (h.routeSearch?.status==='NO_PATH'||h.routeSearch?.status==='SEARCH_LIMIT')){
      h.lastWorkBlock='No confirmed work route; retaining carried supplies.';
      receipt(r,now,'human.work.blocked',`${h.actorId}:${h.intent!.intentId}:${h.lastWorkBlock}`);
      h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+30000;
    }
    return false;
  }
  h.intent!.route=path; h.intent!.startAt=now; h.intent!.dueAt=now+(task.phase==='fetch'?800:task.duration);
  h.state=path.length?'MOVING':'WORKING'; return true;
}
export function executeHumanWork(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): {done:boolean;reason?:string} {
  const intent=h.intent, task=intent?.work;
  if (!intent || !task || h.following || h.state!=='WORKING') return {done:false,reason:'no physical occupation commitment'};
  if(now<intent.dueAt)return {done:false,reason:'work in progress'};
  const role = { cook:'cook',recycle:'salvager',repair_item:'mechanic',garden:'gardener',medical:'medic',engineer:'engineer',build:'builder',guard:'guard' } as const;
  if(task.phase!=='collect' && task.phase!=='machine' && task.kind!=='medical' && role[task.kind]!==h.occupation)return {done:false,reason:'occupation no longer assigned'};
  const comm=h.community ? hw.communities[h.community] : undefined; if(!comm)return {done:false,reason:'no community permission'};
  const fail=(reason:string)=>{h.lastWorkBlock=reason;intent.blockReason=reason;
    // Materials stay in custody; a paid queue/output claim is rediscovered from
    // the station, not duplicated. Invalid work must not freeze a worker forever.
    h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+10000;
    receipt(r,now,'human.work.blocked',`${h.actorId}:${intent.intentId}:${reason}`);return {done:false,reason};};
  const beforeOutput = new Map(pack(r,h).slots.filter((s):s is Stack=>!!s).map(s=>[s.uid,s.qty]));
  const recordOutputs=()=>{ h.workOutputs ??= {}; for(const s of pack(r,h).slots) if(s){const n=s.qty-(beforeOutput.get(s.uid)??0);if(n>0){h.workOutputs[s.uid]=(h.workOutputs[s.uid]??0)+n;if(s.production)(h.workOutputSources??={})[s.uid]={jobId:s.production.jobId,recipe:s.production.recipe,inputs:s.production.inputs,stationId:s.production.stationId};receipt(r,now,'human.production.pickup',JSON.stringify({workerId:h.actorId,uid:s.uid,qty:n,containerId:h.inv.packId,production:s.production}));}beforeOutput.set(s.uid,s.qty);} };
  const e=task.entityId ? findRunEntity(r,task.entityId) : undefined;
  if(task.phase==='fetch') {
    const store=comm.storeEntityId && findRunEntity(r,comm.storeEntityId);
    if(!store || !store.c || !comm.storeContainers.includes(store.c) || store.owner!==comm.id || !humanCanUseEntity(r,h,store))return fail('cannot reach authorized store');
    if(task.kind==='medical' && !eligiblePatient(h,hw.people[task.patientId??'']))return fail('patient no longer needs this dose');
    if(task.kind==='recycle') {
      const stock=C(r,store.c),slot=stock.slots.findIndex(s=>s?.uid===task.itemUid),s=stock.slots[slot];
      const into=pack(r,h),empty=into.slots.indexOf(null);
      if(!s || !salvagePlan(s,true) || empty<0)return fail('salvage lot missing, reserved or pack full');
      const unit=s.qty===1?s:{...s,qty:1,uid:uid(r,'s')};
      if(unit===s)stock.slots[slot]=null;else s.qty--;
      into.slots[empty]=unit;task.itemUid=unit.uid;
      receipt(r,now,'human.work.input',JSON.stringify({workerId:h.actorId,orderId:intent.intentId,containerId:stock.id,into:into.id,receivedUid:unit.uid,inputs:[{uid:s.uid,key:s.key,qty:1}]}));
    }
    if(task.kind==='garden' && (!e?.garden || e.owner!==comm.id || (e.hp??1)<=0 || task.gardenAction!=='plant' || e.garden.crop))return fail('plot no longer needs seed');
    if(task.kind==='repair_item'){
      const item=[...pack(r,h).slots,...Object.values(h.equip)].find(s=>s?.uid===task.itemUid);
      const rule=repairRule(item,e,comm.id);
      if(!rule || !e || !(comm.workStations.includes(e.id) || e.poi===comm.poi && e.owner===comm.id))return fail('repair target or workbench changed');
      if(!fetchWorkMaterials(r,store.c,h.inv.packId,rule.cost,h.actorId,intent.intentId,now))return fail('repair supplies unavailable or pack full');
      task.inputs=rule.cost; // resume with the same canonical bill that was admitted
    } else if(task.kind==='medical'){
      if(!fetchWorkMaterials(r,store.c,h.inv.packId,task.inputs,h.actorId,intent.intentId,now))return fail('medicine missing, reserved or pack full');
    } else for(const [key,qty] of task.inputs) {
      const need=Math.max(0,qty-count(r,h.inv.packId,key));
      if(need){const before=C(r,store.c).slots.filter((s):s is Stack=>!!s).map(s=>({uid:s.uid,qty:s.qty,key:s.key}));const moved=moveHumanGoods(r,store.c,h.inv.packId,key,need);if(moved)receipt(r,now,'human.work.input',JSON.stringify({workerId:h.actorId,orderId:intent.intentId,containerId:store.c,into:h.inv.packId,inputs:before.flatMap(s=>{const qty=s.qty-(C(r,store.c!).slots.find(v=>v?.uid===s.uid)?.qty??0);return qty>0?[{...s,qty}]:[];})}));}
    }
    if(!materialPayment(pack(r,h),task.inputs))return fail('supplies unavailable or pack full');
    receipt(r,now,'human.work.fetch',`${h.actorId}:${intent.intentId}:${store.id}`);
    task.phase=task.resumePhase??'travel';delete task.resumePhase; h.state='IDLE';h.nextThinkAt=now; return {done:false,reason:'carrying paid materials to work'};
  }
  if(task.patientId) {
    const p=hw.people[task.patientId];
    if(!eligiblePatient(h,p) || Math.abs(p.gx-h.gx)+Math.abs(p.gy-h.gy)>1 || !clearSurvivorSight(r,h,p))return fail('patient moved, obstructed or no longer needs treatment');
    const medicine = task.inputs.length===1 && task.inputs[0][1]===1 && ['bandage','herb'].includes(task.inputs[0][0]) ? task.inputs : [];
    const inputs=medicine.length && materialPayment(pack(r,h),medicine,true);
    if(!inputs)return fail('medicine missing or reserved');
    delete p.nextMedicalReviewAt;delete p.lastWorkBlock;
    const hpBefore=p.hp;
    p.wounds.forEach(w=>{w.treated=true;w.bleeding=false;});p.hp=Math.min(p.maxHp,p.hp+30);
    if(p.state==='DOWNED'){p.downedAt=undefined;p.state='IDLE';}
    receipt(r,now,'human.medical.payment',JSON.stringify({worker:h.actorId,patient:p.actorId,job:intent.intentId,seen:task.observedPatient,at:patientTile(p),hpBefore,hpAfter:p.hp,inputs}));
    receipt(r,now,'human.treat',`${h.actorId}:${p.actorId}:${medicine.map(m=>m[0]).join('+')}`);
  } else if(task.kind==='build' && task.rebuildSite){
    const old=task.rebuildSite,site=comm.lostWorksites?.[old];
    if(!site || !comm.workStations.includes(old) || findRunEntity(r,old) || site.floor!==h.floor || Math.abs(h.gx-site.tx)+Math.abs(h.gy-site.ty)!==1)return fail('lost worksite no longer accessible');
    const def=STRUCTS[site.type],item=def?.item,recipe=item?RECIPES[item]:null;
    if(!item || !recipe?.base || recipe.station || !['campfire','workbench','furnace'].includes(site.type))return fail('no known field construction recipe');
    const entities=allRunEntities(r),cell=globalCellTileAndClass(r,site.tx,site.ty,site.floor,entities),o=r.sourceMap?.veyra?.originAu,ox=o?o[0]*2:0,oy=o?o[1]*2:0;
    const lx=site.tx-ox,ly=site.ty-oy,local=site.floor===(r.veyraFloor??0)&&lx>=0&&lx<WW&&ly>=0&&ly<WH;
    const authored=cell.cls===2 && authoredStationFootprint(comm.poi,site.type,site.tx,site.ty,site.floor);
    const overlap=entities.some(e=>{if((e.floor??0)!==site.floor||['bag','drop'].includes(e.kind)||e.kind==='struct'&&['roof','floor'].includes(STRUCTS[e.type!]?.layer))return false;const [x,y]=humanEntityTile(r,e);return x===site.tx&&y===site.ty;});
    if(overlap || (!authored && cell.cls!==0 && cell.cls!==4) || Object.values(hw.people).some(p=>!p.transit&&!['DEAD','EVACUATED'].includes(p.state)&&p.floor===site.floor&&((p.gx===site.tx&&p.gy===site.ty)||(p.motion?.toGx===site.tx&&p.motion.toGy===site.ty))) ||
       local && ((!r.player.dead && Math.floor(r.player.x/TILE)===lx && Math.floor(r.player.y/TILE)===ly)||r.creatures.some(m=>m.state!=='dead'&&(m.floor??0)===site.floor&&Math.floor(m.x/TILE)===lx&&Math.floor(m.y/TILE)===ly)))return fail('worksite footprint obstructed');
    const slots=pack(r,h).slots,idx=slots.findIndex(s=>s?.key===item&&!s.production&&(s.dur??0)>0),used:{uid:string;qty:number}[]=[];
    let kit:Stack;
    if(idx>=0){kit=slots[idx]!;slots[idx]=null;}else{
      if(!recipe.ins.every(([k,q])=>count(r,h.inv.packId,k)>=q))return fail('construction materials unavailable');
      for(const [k,q] of recipe.ins){let left=q;for(let i=0;i<slots.length&&left;i++){const s=slots[i];if(s?.key!==k||s.production)continue;const n=Math.min(left,s.qty);used.push({uid:s.uid,qty:n});left-=n;s.qty-=n;if(!s.qty)slots[i]=null;}}
      kit=mkStack(r,item,1);
    }
    const tx=local?lx:site.tx,ty=local?ly:site.ty,id=uid(r,'e');
    const station:Entity={id,kind:'struct',type:site.type,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE,floor:site.floor,owner:comm.id,poi:comm.poi,deployed:kit,hp:kit.dur,maxHp:def.hp,station:{queue:[],burn:0,fuelC:mkContainer(r,'fuel',3).id,outC:mkContainer(r,'out',6).id}};
    (local?r.entities:(r.veyraOffscreenEntities??={}))[id]=station;comm.workStations[comm.workStations.indexOf(old)]=id;delete comm.lostWorksites![old];markDirty();
    receipt(r,now,'human.worksite.rebuilt',JSON.stringify({builder:h.actorId,lost:old,id,type:site.type,kit:kit.uid,inputs:used}));
    for(const id of comm.memberIds){const colleague=hw.people[id];if(colleague?.state==='IDLE'&&!colleague.intent)colleague.nextThinkAt=now;}
  } else if(task.kind==='build' && e?.id===comm.storeEntityId && e?.kind==='bag'){
    if(e.owner!==comm.id || e.hp!==0 || !e.maxHp || !atWorksite(r,h,e))return fail('warehouse no longer needs bracing or out of reach');
    if(count(r,h.inv.packId,'wood')<2)return fail('Collapsed warehouse needs two carried wood for braces.');
    let need=2;const used:{uid:string;qty:number}[]=[];
    for(const [i,s] of pack(r,h).slots.entries())if(s?.key==='wood' && !s.production && need){
      const n=Math.min(need,s.qty);need-=n;s.qty-=n;used.push({uid:s.uid,qty:n});if(!s.qty)pack(r,h).slots[i]=null;
    }
    e.hp=e.maxHp;receipt(r,now,'human.store.rebuilt',JSON.stringify({workerId:h.actorId,storeId:e.id,inputs:used}));
  } else if(task.kind==='guard' && task.itemUid){
    const claim=h.gameDrop;
    if(!claim || !e?.c || e.kind!=='drop' || e.id!==claim.entityId || !humanCanUseEntity(r,h,e))return fail('carcass moved or inaccessible');
    const c=r.custody[e.c],stack=c?.slots.find(s=>s!==null && s.uid===task.itemUid && s.uid===claim.stackUid && s.key==='meat' && !s.production);
    if(!stack){delete h.gameDrop;return fail('carcass already claimed');}
    const slot=pack(r,h).slots.indexOf(null);if(slot<0)return fail('pack full; meat stays on the ground');
    c.slots[c.slots.indexOf(stack)]=null;pack(r,h).slots[slot]=stack;
    stack.production={workerId:h.actorId,jobId:intent.intentId};
    (h.workOutputs??={})[stack.uid]=stack.qty;
    (h.workOutputSources??={})[stack.uid]={jobId:intent.intentId,sourceId:claim.creatureId};
    if(c.slots.every(s=>!s)){delete r.custody[c.id];delete r.entities[e.id];if(r.veyraOffscreenEntities)delete r.veyraOffscreenEntities[e.id];markDirty();}
    receipt(r,now,'human.hunt.pickup',`${h.actorId}:${claim.creatureId}:${stack.uid}:${stack.qty}`);delete h.gameDrop;
  } else {
    if(!e || !(task.kind==='recycle' && localRecycler(r,comm.poi,e) || comm.workStations.includes(e.id)||e.poi===comm.poi && e.owner===comm.id || task.kind==='guard' && (e.id===comm.storeEntityId || e.kind==='door' && e.poi===comm.poi)) || !humanCanUseEntity(r,h,e))return fail('work target inaccessible or unauthorized');
    if(task.kind==='guard') {
      h.lastWatchAt=now;h.guardedEntityId=e.id;h.patrolPostIndex=(h.patrolPostIndex??0)+1;
      // Duty is a physical act on a real post: it leaves an auditable receipt like any other work.
      receipt(r,now,'human.guard.duty',`${h.actorId}:${intent.intentId}:${e.id}:${h.patrolPostIndex}`);
    } else if(task.phase==='machine') {
      if(task.readyAt===undefined){
        if(!e.station?.queue.some(j=>j.id===task.machineJobId))return fail('job interrupted; no output claim');
        if(e.kind!=='recycler' && e.station.burn<=0&&!C(r,e.station.fuelC).slots.some(s=>s&&!s.production&&stationBurnable(s.key))){
          const fuel=pack(r,h).slots.find(s=>s&&!s.production&&stationBurnable(s.key));
          if(!fuel)return fail('machine paused; procure physical fuel');
          if(!moveHumanGoods(r,h.inv.packId,e.station.fuelC,fuel.key,1))return fail('machine fuel container full');
        }
        return {done:false,reason:'machine processing or paused'};
      }
      if (e.kind==='recycler' && e.station) {
        // Old job versions may pay a retired material as its live successor.
        task.outputs=C(r,e.station.outC).slots.flatMap(s=>s?.production?.workerId===h.actorId && s.production.jobId===task.machineJobId ? [[s.key,s.qty] as [string,number]] : []);
        if (!task.outputs.length) return fail('no paid recycler output');
      }
      task.phase='collect';
    }
    if(task.kind==='guard') { /* the observation above is the committed duty, not item production */ }
    else if(task.phase==='collect') {
      if(!e.station)return fail('station lost');
      let remaining=false;
      for(const output of task.outputs??[]) { const n=moveHumanGoods(r,e.station.outC,h.inv.packId,output[0],output[1],{jobId:task.machineJobId!,workerId:h.actorId}); output[1]-=n;if(output[1]>0)remaining=true; }
      recordOutputs();
      if(remaining){
        if(Object.values(h.workOutputs??{}).some(q=>q>0)){h.intent=undefined;h.state='IDLE';h.nextThinkAt=now;h.lastWorkBlock='Partial paid output collected; deliver before recovering remaining station claim';return {done:false,reason:h.lastWorkBlock};}
        return fail('output missing or pack full');
      }
    } else if(task.kind==='cook') {
      if(!task.recipe || !knownRecipe(h,task.recipe))return fail('recipe not known');
      // Fuel is actual carried stock transferred to the real station fuel container.
      if(e.station && e.station.burn<=0 && !C(r,e.station.fuelC).slots.some(s=>s&&!s.production&&stationBurnable(s.key))) {
        const fuel=pack(r,h).slots.find(s=>s&&!s.production&&stationBurnable(s.key));
        if(!fuel)return fail('carry station fuel'); if(!moveHumanGoods(r,h.inv.packId,e.station.fuelC,fuel.key,1))return fail('station fuel capacity blocked');
      }
      const queued=queuePaidRecipe(r,e,h.inv.packId,task.recipe,h.actorId,now);if(!queued.ok)return fail(queued.reason!);
      task.machineJobId=queued.jobId;task.phase='machine';intent.reserved=[queued.jobId!];
      receipt(r,now,'human.work.start',`${h.actorId}:${intent.intentId}:${task.recipe}:${queued.jobId}`);return {done:false,reason:'machine running'};
    } else if(task.kind==='recycle') {
      const i=pack(r,h).slots.findIndex(s=>s && s.uid===task.itemUid && !s.production),s=pack(r,h).slots[i], plan=s&&!h.workOutputs?.[s.uid]&&salvagePlan(s);
      if(!s || !plan || e.kind!=='recycler' || !e.station || e.station.queue.length || !productionFits(r,e.station.outC,plan.outputs))return fail('recycler input, queue or output blocked');
      const inputs=[{uid:s.uid,key:s.key,qty:s.qty,containerId:h.inv.packId}];
      pack(r,h).slots[i]=null;const id=uid(r,'j');e.station.queue.push({id,recipe:plan.recipe,left:plan.total,total:plan.total,reserved:[s],workerId:h.actorId,inputProvenance:inputs});
      receipt(r,now,'human.production.pay',JSON.stringify({workerId:h.actorId,jobId:id,recipe:plan.recipe,stationId:e.id,inputs,totalMs:plan.total}));
      task.machineJobId=id;task.phase='machine';intent.reserved=[id];return {done:false,reason:'recycler running'};
    } else if(task.kind==='repair_item') {
      const s=[...pack(r,h).slots,...Object.values(h.equip)].find(s=>s?.uid===task.itemUid);
      const rule=repairRule(s,e,comm.id);
      if(!s || !rule)return fail('repair condition or materials changed');
      const inputs=materialPayment(pack(r,h),rule.cost,true);if(!inputs)return fail('repair materials missing or reserved');
      const before=s.dur;s.dur=ITEMS[s.key].dur;
      receipt(r,now,'human.maintenance',JSON.stringify({worker:h.actorId,job:intent.intentId,station:e.id,item:s.uid,before,after:s.dur,inputs}));
    } else if(task.kind==='build') {
      const cost=structureRepairCost(e);
      if(!cost.length || !e.hp || !e.maxHp || e.hp>=e.maxHp || STRUCTS[e.type!]?.item)return fail('repair target or materials changed');
      const inputs=materialPayment(pack(r,h),cost,true);if(!inputs)return fail('repair materials missing or reserved');
      const before=e.hp;e.hp=Math.min(e.maxHp,e.hp+Math.ceil(e.maxHp/4));
      receipt(r,now,'human.structure.patch',JSON.stringify({worker:h.actorId,job:intent.intentId,site:e.id,before,after:e.hp,inputs}));
    } else if(task.kind==='engineer') {
      if(!e.basePower || !e.c)return fail('no actual generator');
      const loaded=C(r,e.c).slots.some(s=>s&&!s.production&&ITEMS[s.key].fuel);
      if(e.basePower.enabled && (loaded || e.basePower.energy>0))return fail('generator already operating');
      if(!loaded && e.basePower.energy<=0) {
        const fuel=pack(r,h).slots.find(s=>s&&!s.production&&ITEMS[s.key].fuel);if(!fuel)return fail('carry fuel to generator');
        if(!moveHumanGoods(r,h.inv.packId,e.c,fuel.key,1))return fail('generator fuel full');
      }
      e.basePower.enabled=true;
    } else if(task.kind==='garden') {
      const g=e.garden;if(!g || e.owner!==comm.id)return fail('plot lost or unauthorized');
      if(task.sowingId!==g.sowing?.id)return fail('planting changed before work finished');
      if(task.gardenAction==='harvest' && task.crop===g.crop && isGardenCrop(g.crop) && g.growth>=1) {
        const outputs=GARDEN_CROPS[g.crop].output;
        if(!productionFits(r,h.inv.packId,outputs))return fail('harvest pack full');
        const job=g.sowing?.id??uid(r,'hj');
        const claim={workerId:h.actorId,jobId:job,stationId:e.id,inputs:g.sowing?.inputs};
        for(const [k,q]of outputs)addItem(r,h.inv.packId,k,q,{production:claim});
        recordOutputs();receipt(r,now,'human.garden.harvest',JSON.stringify({worker:h.actorId,plot:e.id,crop:g.crop,job,outputs}));
        g.crop=null;g.growth=0;delete g.sowing;
      } else if(task.gardenAction==='plant' && !g.crop && isGardenCrop(task.crop)) {
        const rule=GARDEN_CROPS[task.crop],inputs=materialPayment(pack(r,h),rule.inputs,true);if(!inputs)return fail('planting seed missing');
        g.sowing={id:uid(r,'hj'),inputs};g.crop=task.crop;g.growth=0;receipt(r,now,'human.garden.plant',JSON.stringify({worker:h.actorId,plot:e.id,crop:g.crop,job:g.sowing.id,inputs}));
      } else if(task.gardenAction==='water' && g.crop===task.crop && g.growth<1 && g.water<2) {
        const flask=pack(r,h).slots.find(s=>s&&s.uid===task.itemUid&&!s.production&&ITEMS[s.key].waterContainer&&(s.charge??0)>0);if(!flask)return fail('carry charged potable water');
        flask.charge!--;g.water=Math.min(3,g.water+1);receipt(r,now,'human.garden.water',JSON.stringify({worker:h.actorId,plot:e.id,crop:g.crop,flask:flask.uid,charge:flask.charge,water:g.water}));
      } else return fail('plot does not need this work');
    } else return fail('work kind unsupported');
  }
  receipt(r,now,'human.work.commit',`${h.actorId}:${intent.intentId}:${task.kind}:${task.entityId??task.patientId}:${task.itemUid??''}`);
  h.lastCommittedAt=now;h.lastWorkBlock=undefined;h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+3000;
  // A gardener standing over a newly sown, nearly dry bed may tend it next.
  // This schedules, rather than grants, irrigation: contact, lot and flask UID
  // must still be good when the separate watering action comes due.
  if(task.gardenAction==='plant' && e?.garden && e.garden.water<1 && isGardenCrop(e.garden.crop)){
    const flask=pack(r,h).slots.find(s=>s && !s.production && ITEMS[s.key].waterContainer && (s.charge??0)>0);
    if(flask){
      h.intent={...intent,intentId:uid(r,'hw'),reserved:[],startAt:now,dueAt:now+1500,route:[],work:{kind:'garden',phase:'act',gardenAction:'water',crop:e.garden.crop,sowingId:e.garden.sowing?.id,entityId:e.id,itemUid:flask.uid,duration:1500,inputs:[]}};
      h.state='WORKING';
    }
  }
  return {done:true};
}
