/** Occupation execution on real shared K1 custody, canonical recipes, station queues,
 * item repair rules, garden laws and physical structures. No work output loot table. */
import { TILE, uid, type RunState, type Entity, type Stack } from './core';
import { ITEMS, RECIPES, STRUCTS, GARDEN_CROPS, isGardenCrop, stationBurnable } from './catalog';
import { C, hasAll, removeItem, addItem, addStack, queuePaidRecipe, structureRepairCost, receipt, clearPhysicalLine, productionFits } from './engine';
import { recoveryPlan, recoveryFits } from './recycler';
import type { HumanRecord, HumanWorld } from './humanworld';
export type HumanJobKind = 'cook' | 'recycle' | 'repair_item' | 'garden' | 'medical' | 'engineer' | 'build' | 'guard';
export interface HumanWorkTask {
  kind: HumanJobKind; entityId?: string; patientId?: string; itemUid?: string;
  recipe?: string; crop?: 'crop' | 'herb' | 'berry';
  phase: 'fetch' | 'travel' | 'act' | 'machine' | 'collect';
  inputs: [string, number][]; duration: number;
  machineJobId?: string; readyAt?: number; outputs?: [string, number][];
}
type Router = (gx: number, gy: number) => { tx: number; ty: number; floor: number }[] | null;
const pack = (r: RunState, h: HumanRecord) => C(r, h.inv.packId);
export function humanEntityTile(r: RunState, e: Entity): [number, number] {
  const o = r.sourceMap?.veyra?.originAu;
  const ox = o ? Math.round(o[0] / .5) : 0, oy = o ? Math.round(o[1] / .5) : 0;
  return r.entities[e.id] === e ? [ox + (e.tx ?? Math.floor(e.x / TILE)), oy + (e.ty ?? Math.floor(e.y / TILE))] : [e.tx ?? Math.floor(e.x / TILE), e.ty ?? Math.floor(e.y / TILE)];
}
export function humanCanUseEntity(r: RunState, h: HumanRecord, e: Entity): boolean {
  if ((e.floor ?? 0) !== h.floor || h.floor !== (r.veyraFloor ?? 0) || r.entities[e.id] !== e || (e.hp ?? 1) <= 0) return false;
  const [gx, gy] = humanEntityTile(r, e);
  if (Math.hypot(h.gx - gx, h.gy - gy) > 1.5) return false;
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
    delete transfer.production;
    moved += n;
  }
  return moved;
}
function count(r: RunState, cid: string, key: string) { return C(r, cid).slots.reduce((n,s) => n + (s?.key === key ? s.qty : 0), 0); }
function knownRecipe(h: HumanRecord, key: string) {
  // Profession-origin training is finite, run-persistent knowledge, not the player's research ledger.
  return h.knownRecipes?.includes(key) === true;
}
function taskCandidates(r: RunState, hw: HumanWorld, h: HumanRecord): HumanWorkTask[] {
  const comm = h.community ? hw.communities[h.community] : undefined; if (!comm) return [];
  const entities = Object.values(r.entities).filter(e => (e.floor ?? 0) === h.floor && (e.hp ?? 1) > 0 && (comm.workStations.includes(e.id) || e.poi === comm.poi && e.owner === comm.id || h.occupation==='guard' && (e.id===comm.storeEntityId || e.kind==='door' && e.poi===comm.poi)));
  const tasks: HumanWorkTask[] = [], start = (kind: HumanJobKind, e: Entity | undefined, inputs: [string,number][], duration: number): HumanWorkTask => ({kind,entityId:e?.id,inputs,duration,phase:'travel'});
  const stores = comm.storeContainers.filter(c => r.custody[c]);
  const available = (key: string, n: number) => count(r,h.inv.packId,key) + stores.reduce((q,c) => q+count(r,c,key),0) >= n;
  for (const e of entities) {
    // Completed paid work outlives a temporary combat/recruitment intent. The
    // physical stack's claim is sufficient to recover it, never a matching item key.
    if(e.station) {
      const claims=new Map<string,[string,number][]>();
      for(const s of C(r,e.station.outC).slots)if(s?.production?.workerId===h.actorId){const outputs=claims.get(s.production.jobId)??[];outputs.push([s.key,s.qty]);claims.set(s.production.jobId,outputs);}
      for(const [jobId,outputs]of claims)tasks.push({...start(h.occupation==='salvager'?'recycle':'cook',e,[],800),phase:'collect',machineJobId:jobId,outputs});
    }
    if (h.occupation === 'cook' && e.station && STRUCTS[e.type!]?.station === 'campfire') {
      for (const [recipe, rc] of Object.entries(RECIPES)) if (rc.station === 'campfire' && ITEMS[rc.out]?.food && knownRecipe(h,recipe) && rc.ins.every(([k,q])=>available(k,q))) {
        const ins=rc.ins.map(([k,q])=>[k,q] as [string,number]);
        if(e.station.burn<=0&&!C(r,e.station.fuelC).slots.some(s=>s&&stationBurnable(s.key))){
          const fuel=[...pack(r,h).slots,...stores.flatMap(c=>C(r,c).slots)].find(s=>s&&stationBurnable(s.key));
          if(!fuel)continue;
          const existing=ins.find(([k])=>k===fuel.key);if(existing)existing[1]++;else ins.push([fuel.key,1]);
          if(!ins.every(([k,q])=>available(k,q)))continue;
        }
        const task = start('cook',e,ins,1200); task.recipe=recipe; task.outputs=rc.outs ?? [[rc.out,rc.qty]]; tasks.push(task);
      }
    }
    if (h.occupation === 'salvager' && e.kind === 'recycler' && e.station && !e.station.queue.length) {
      for (const s of pack(r,h).slots) if (s) { const plan=recoveryPlan(s); if (plan) tasks.push({...start('recycle',e,[],1500),itemUid:s.uid,outputs:plan.outputs}); }
    }
    if (h.occupation === 'mechanic' && e.type === 'workbench') {
      const items = [...pack(r,h).slots, ...Object.values(h.equip)].filter((s): s is Stack => !!s);
      for (const s of items) { const d=ITEMS[s.key]; if (d.repair?.station===e.type && d.dur && s.dur!==undefined && s.dur<d.dur && d.repair.cost.every(([k,q])=>available(k,q))) tasks.push({...start('repair_item',e,d.repair.cost,8000),itemUid:s.uid}); }
    }
    if (h.occupation === 'gardener' && e.garden) {
      const g=e.garden;
      if (isGardenCrop(g.crop) && g.growth >= 1) tasks.push(start('garden',e,[],2000));
      else if (!g.crop) { for (const crop of ['crop','herb','berry'] as const) if (GARDEN_CROPS[crop].inputs.every(([k,q])=>available(k,q))) { tasks.push({...start('garden',e,GARDEN_CROPS[crop].inputs,2500),crop}); break; } }
      else if (g.water < 2) tasks.push(start('garden',e,[],1500));
    }
    if (h.occupation === 'builder' && e.kind === 'struct' && e.hp !== undefined && e.maxHp && e.hp < e.maxHp && !STRUCTS[e.type!]?.item) {
      const cost=structureRepairCost(e); if(cost.length && cost.every(([k,q])=>available(k,q))) tasks.push(start('build',e,cost,8000));
    }
    if (h.occupation === 'engineer' && e.basePower && e.c && (!e.basePower.enabled || e.basePower.energy<=0 && !C(r,e.c).slots.some(s=>s&&ITEMS[s.key].fuel))) tasks.push(start('engineer',e,[],3000));
  }
  if(h.occupation==='guard') {
    const posts=entities.filter(e=>e.kind==='door'||e.id===comm.storeEntityId).sort((a,b)=>a.id.localeCompare(b.id));
    if(posts.length)tasks.push(start('guard',posts[(h.patrolPostIndex??0)%posts.length],[],8000));
  }
  if (h.occupation === 'medic') for (const patient of Object.values(hw.people)) {
    if (patient.actorId===h.actorId || patient.community!==h.community || patient.floor!==h.floor || patient.state==='DEAD' || patient.state==='EVACUATED') continue;
    if (patient.state==='DOWNED' || patient.wounds.some(w=>!w.treated)) {
      const key = available('bandage',1) ? 'bandage' : available('herb',1) ? 'herb' : undefined;
      if(key) tasks.push({...start('medical',undefined,[[key,1]],6000),patientId:patient.actorId});
    }
  }
  return tasks;
}
function target(r: RunState, hw: HumanWorld, h: HumanRecord, task: HumanWorkTask): [number,number] | null {
  if (task.phase==='fetch') { const c=h.community ? hw.communities[h.community] : undefined; return c?.storeTile ?? null; }
  if (task.patientId) { const p=hw.people[task.patientId]; return p && p.floor===h.floor ? [p.gx,p.gy] : null; }
  const e=task.entityId && r.entities[task.entityId]; return e ? humanEntityTile(r,e) : null;
}
export function planHumanOccupation(r: RunState, hw: HumanWorld, h: HumanRecord, now: number, route: Router): boolean {
  if (h.following || !h.community) return false;
  let task=h.intent?.work;
  if (!task) {
    for (const candidate of taskCandidates(r,hw,h)) {
      const needs=candidate.inputs.some(([k,q])=>count(r,h.inv.packId,k)<q);
      candidate.phase=needs?'fetch':candidate.machineJobId?'collect':'travel';
      const dest=target(r,hw,h,candidate); if(!dest)continue;
      const path=route(...dest); if(!path)continue;
      task=candidate;
      h.intent={intentId:uid(r,'hw'),actorId:h.actorId,kind:'work',target:`occupation:${task.kind}`,preconditions:['community permission','physical access','canonical paid bill'],reserved:[],startAt:now,dueAt:now,route:path,work:task};
      h.state=path.length?'MOVING':'WORKING'; h.intent.dueAt=now+(task.phase==='fetch'?800:task.duration); return true;
    }
    return false;
  }
  if (task.phase!=='travel') return false;
  const dest=target(r,hw,h,task); if(!dest)return false;
  const path=route(...dest); if(!path)return false;
  h.intent!.route=path; h.intent!.startAt=now; h.intent!.dueAt=now+task.duration;
  h.state=path.length?'MOVING':'WORKING'; return true;
}
export function executeHumanWork(r: RunState, hw: HumanWorld, h: HumanRecord, now: number): {done:boolean;reason?:string} {
  const intent=h.intent, task=intent?.work;
  if (!intent || !task || h.following || h.state!=='WORKING') return {done:false,reason:'no physical occupation commitment'};
  if(now<intent.dueAt)return {done:false,reason:'work in progress'};
  const role = { cook:'cook',recycle:'salvager',repair_item:'mechanic',garden:'gardener',medical:'medic',engineer:'engineer',build:'builder',guard:'guard' } as const;
  if(task.phase!=='collect' && role[task.kind]!==h.occupation)return {done:false,reason:'occupation no longer assigned'};
  const comm=h.community ? hw.communities[h.community] : undefined; if(!comm)return {done:false,reason:'no community permission'};
  const fail=(reason:string)=>{h.lastWorkBlock=reason;intent.blockReason=reason;return {done:false,reason};};
  const beforeOutput = new Map(pack(r,h).slots.filter((s):s is Stack=>!!s).map(s=>[s.uid,s.qty]));
  const recordOutputs=()=>{ h.workOutputs ??= {}; for(const s of pack(r,h).slots) if(s){const n=s.qty-(beforeOutput.get(s.uid)??0);if(n>0)h.workOutputs[s.uid]=(h.workOutputs[s.uid]??0)+n;beforeOutput.set(s.uid,s.qty);} };
  const e=task.entityId ? r.entities[task.entityId] : undefined;
  if(task.phase==='fetch') {
    const store=comm.storeEntityId && r.entities[comm.storeEntityId];
    if(!store || !store.c || !humanCanUseEntity(r,h,store))return fail('cannot reach authorized store');
    for(const [key,qty] of task.inputs) {
      const need=Math.max(0,qty-count(r,h.inv.packId,key));
      if(need)moveHumanGoods(r,store.c,h.inv.packId,key,need);
    }
    if(!hasAll(r,h.inv.packId,task.inputs))return fail('supplies unavailable or pack full');
    receipt(r,now,'human.work.fetch',`${h.actorId}:${intent.intentId}:${store.id}`);
    task.phase='travel'; h.state='IDLE'; return {done:false,reason:'carrying paid materials to work'};
  }
  if(task.patientId) {
    const p=hw.people[task.patientId];
    if(!p || p.floor!==h.floor || Math.hypot(p.gx-h.gx,p.gy-h.gy)>1.5 || p.state==='DEAD' || p.state==='EVACUATED')return fail('patient moved or cannot be treated');
    const o=r.sourceMap?.veyra?.originAu,ox=o?Math.round(o[0]/.5):0,oy=o?Math.round(o[1]/.5):0;
    if(!clearPhysicalLine(r,{x:(h.gx-ox+.5)*TILE,y:(h.gy-oy+.5)*TILE},{x:(p.gx-ox+.5)*TILE,y:(p.gy-oy+.5)*TILE},true))return fail('patient obstructed');
    if(p.state!=='DOWNED' && p.wounds.every(w=>w.treated))return fail('patient already treated');
    const medicine = task.inputs.length===1 && task.inputs[0][1]===1 && ['bandage','herb'].includes(task.inputs[0][0]) ? task.inputs : [];
    if(!medicine.length || !hasAll(r,h.inv.packId,medicine))return fail('medicine missing');
    for(const [k,q]of medicine)removeItem(r,h.inv.packId,k,q);
    p.wounds.forEach(w=>{w.treated=true;w.bleeding=false;});p.hp=Math.min(p.maxHp,p.hp+30);p.downedAt=undefined;p.state='IDLE';
  } else {
    if(!e || !(comm.workStations.includes(e.id)||e.poi===comm.poi && e.owner===comm.id || task.kind==='guard' && (e.id===comm.storeEntityId || e.kind==='door' && e.poi===comm.poi)) || !humanCanUseEntity(r,h,e))return fail('work target inaccessible or unauthorized');
    if(task.kind==='guard') {
      h.lastWatchAt=now;h.guardedEntityId=e.id;h.patrolPostIndex=(h.patrolPostIndex??0)+1;
    } else if(task.phase==='machine') {
      if(task.readyAt===undefined)return fail(e.station?.queue.some(j=>j.id===task.machineJobId)?'machine processing or paused':'job interrupted; no output claim');
      task.phase='collect';
    }
    if(task.kind==='guard') { /* the observation above is the committed duty, not item production */ }
    else if(task.phase==='collect') {
      if(!e.station)return fail('station lost');
      let remaining=false;
      for(const output of task.outputs??[]) { const n=moveHumanGoods(r,e.station.outC,h.inv.packId,output[0],output[1],{jobId:task.machineJobId!,workerId:h.actorId}); output[1]-=n;if(output[1]>0)remaining=true; }
      recordOutputs();
      if(remaining)return fail('output missing or pack full');
    } else if(task.kind==='cook') {
      if(!task.recipe || !knownRecipe(h,task.recipe))return fail('recipe not known');
      // Fuel is actual carried stock transferred to the real station fuel container.
      if(e.station && e.station.burn<=0 && !C(r,e.station.fuelC).slots.some(s=>s&&stationBurnable(s.key))) {
        const fuel=pack(r,h).slots.find(s=>s&&stationBurnable(s.key));
        if(!fuel)return fail('carry station fuel'); moveHumanGoods(r,h.inv.packId,e.station.fuelC,fuel.key,1);
      }
      const queued=queuePaidRecipe(r,e,h.inv.packId,task.recipe,h.actorId);if(!queued.ok)return fail(queued.reason!);
      task.machineJobId=queued.jobId;task.phase='machine';intent.reserved=[queued.jobId!];
      receipt(r,now,'human.work.start',`${h.actorId}:${intent.intentId}:${task.recipe}:${queued.jobId}`);return {done:false,reason:'machine running'};
    } else if(task.kind==='recycle') {
      const i=pack(r,h).slots.findIndex(s=>s?.uid===task.itemUid),s=pack(r,h).slots[i], plan=s&&recoveryPlan(s);
      if(!s || !plan || e.kind!=='recycler' || !e.station || e.station.queue.length || !productionFits(r,e.station.outC,plan.outputs))return fail('recycler input, queue or output blocked');
      pack(r,h).slots[i]=null;const id=uid(r,'j');e.station.queue.push({id,recipe:plan.recipe,left:plan.total,total:plan.total,reserved:[s],workerId:h.actorId});
      task.machineJobId=id;task.phase='machine';intent.reserved=[id];return {done:false,reason:'recycler running'};
    } else if(task.kind==='repair_item') {
      const s=[...pack(r,h).slots,...Object.values(h.equip)].find(s=>s?.uid===task.itemUid);
      const d=s&&ITEMS[s.key], rule=d?.repair;
      if(!s || !d?.dur || !rule || rule.station!==e.type || s.dur===undefined || s.dur>=d.dur || !hasAll(r,h.inv.packId,rule.cost))return fail('repair condition or materials changed');
      for(const [k,q]of rule.cost)removeItem(r,h.inv.packId,k,q);s.dur=d.dur;
    } else if(task.kind==='build') {
      const cost=structureRepairCost(e);
      if(!cost.length || !e.hp || !e.maxHp || e.hp>=e.maxHp || STRUCTS[e.type!]?.item || !hasAll(r,h.inv.packId,cost))return fail('repair target or materials changed');
      for(const [k,q]of cost)removeItem(r,h.inv.packId,k,q);e.hp=Math.min(e.maxHp,e.hp+Math.ceil(e.maxHp/4));
    } else if(task.kind==='engineer') {
      if(!e.basePower || !e.c)return fail('no actual generator');
      if(!C(r,e.c).slots.some(s=>s&&ITEMS[s.key].fuel)) {
        const fuel=pack(r,h).slots.find(s=>s&&ITEMS[s.key].fuel);if(!fuel)return fail('carry fuel to generator');
        if(!moveHumanGoods(r,h.inv.packId,e.c,fuel.key,1))return fail('generator fuel full');
      }
      if(e.basePower.enabled && e.basePower.energy>0)return fail('generator already operating');
      e.basePower.enabled=true;
    } else if(task.kind==='garden') {
      const g=e.garden;if(!g)return fail('plot lost');
      if(isGardenCrop(g.crop) && g.growth>=1) {
        const outputs=GARDEN_CROPS[g.crop].output;
        if(!recoveryFits(pack(r,h),outputs))return fail('harvest pack full');
        for(const [k,q]of outputs)addItem(r,h.inv.packId,k,q);recordOutputs();g.crop=null;g.growth=0;
      } else if(!g.crop && task.crop) {
        const rule=GARDEN_CROPS[task.crop];if(!hasAll(r,h.inv.packId,rule.inputs))return fail('planting seed missing');
        for(const [k,q]of rule.inputs)removeItem(r,h.inv.packId,k,q);g.crop=task.crop;g.growth=0;
      } else if(g.crop && g.water<3) {
        const flask=pack(r,h).slots.find(s=>s&&ITEMS[s.key].waterContainer&&(s.charge??0)>0);if(!flask)return fail('carry charged potable water');
        flask.charge!--;g.water=Math.min(3,g.water+1);
      } else return fail('plot does not need this work');
    } else return fail('work kind unsupported');
  }
  receipt(r,now,'human.work.commit',`${h.actorId}:${intent.intentId}:${task.kind}:${task.entityId??task.patientId}:${task.itemUid??''}`);
  h.lastCommittedAt=now;h.lastWorkBlock=undefined;h.intent=undefined;h.state='IDLE';h.nextThinkAt=now+3000;
  return {done:true};
}
