/** Local POI access adapter. No name-based circuits; missing map contract fails closed. */
import { BAL, TILE, type Entity, type RunState } from './core';
import { getWorld, type PoiDoorContract, type World } from './world';

/** Binds a run to this gameplay adapter's geometry interpretation, independently of Map's digest. */
export function poiContractDigest(w:World):string|undefined {
  if(!w.poiAccess)return;const text=JSON.stringify({mapId:w.economyMap.id,revision:w.economyMap.revision,contract:w.poiAccess});let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');
}
export function poiDoorContract(r:RunState,e:Entity):PoiDoorContract|undefined {
  const a=getWorld(r.layoutId||'shipping').poiAccess;
  if(e.kind!=='door'||!a||a.version!=='poi-access-v1')return;
  return a.doors.find(d=>d.tx===e.tx&&d.ty===e.ty);
}
export function poiGeneratorContract(r:RunState,e:Entity):boolean {
  const a=getWorld(r.layoutId||'shipping').poiAccess;
  return e.kind==='gen' && !!a && a.version==='poi-access-v1' && a.doors.some(d=>d.requirement==='power'&&d.generator?.tx===e.tx&&d.generator?.ty===e.ty);
}
export function poiGenerator(r:RunState, d:PoiDoorContract):Entity|undefined {
  if(!d.generator)return;
  return Object.values(r.entities).find(e=>e.kind==='gen'&&e.tx===d.generator!.tx&&e.ty===d.generator!.ty);
}
export function poiPowered(r:RunState,d:PoiDoorContract,now:number):boolean {
  const g=poiGenerator(r,d);return !!g?.poiPower && g.power===1 && g.poiPower.expiresAt>now;
}
export function interiorRelease(r:RunState,e:Entity,d:PoiDoorContract):boolean {
  const dx=r.player.x-e.x,dy=r.player.y-e.y;
  return dx*d.interior[0]+dy*d.interior[1]>=TILE*.35 && Math.abs(dx*d.interior[1]-dy*d.interior[0])<TILE*.75;
}
/** An aperture must not close on any physical player, cart, bike or living creature. */
export function doorwayOccupied(r:RunState,e:Entity):boolean {
  const inDoor=(o:{x:number;y:number})=>Math.abs(o.x-e.x)<TILE*.75&&Math.abs(o.y-e.y)<TILE*.75;
  return (!r.player.dead&&inDoor(r.player)) || r.creatures.some(c=>c.state!=='dead'&&inDoor(c)) || Object.values(r.entities).some(o=>(o.kind==='cart'||o.kind==='vehicle')&&inDoor(o));
}
/** Idempotent chronological expiry; an occupied aperture remains open until clear. */
export function advancePoiAccess(r:RunState,now:number):{closed:string[];expired:string[]} {
  const closed:string[]=[],expired:string[]=[];
  for(const g of Object.values(r.entities))if(g.poiPower&&g.power===1&&g.poiPower.expiresAt<=now){g.power=0;expired.push(g.id);}
  for(const e of Object.values(r.entities))if(e.kind==='door'&&e.open&&e.poiDoor){
    const d=poiDoorContract(r,e);if(!d)continue;
    const due=e.poiDoor.closeAt<=now || d.requirement==='power'&&!poiPowered(r,d,now);
    if(due&&!doorwayOccupied(r,e)){e.open=false;closed.push(e.id);}
  }
  return {closed,expired};
}
export function poiDoorLabel(r:RunState,e:Entity,now:number):string {
  const d=poiDoorContract(r,e);if(!d)return e.locked?'Access metadata missing':e.open?'Close door':'Open door';
  if(e.open)return (e.poiDoor?.closeAt??now)<=now&&doorwayOccupied(r,e)?'Door open · aperture occupied':`Close door · auto-close ${Math.max(0,Math.ceil(((e.poiDoor?.closeAt??now)-now)/1000))}s`;
  if(interiorRelease(r,e,d))return 'Interior exit handle';
  if(d.requirement==='keycard'){const cards=r.custody.inv?.slots.filter(s=>s?.key==='keycard')||[], card=cards.find(s=>(s!.meta??'vault')===(d.cardClass??'vault')&&(s!.charge===undefined||s!.charge>0));return card?`${d.cardClass??'vault'} card · ${card.charge??1} uses`:cards.length?'Incompatible or exhausted card':`${d.cardClass??'vault'} card required`;}
  const g=poiGenerator(r,d);if(!g)return 'Circuit generator missing';
  return poiPowered(r,d,now)?`Powered gate · ${Math.ceil((g.poiPower!.expiresAt-now)/1000)}s`:g.poiPower?.pausedMs?'Gate unpowered · generator off':'Gate unpowered · generator empty';
}
export function poiGenLabel(r:RunState,e:Entity,now:number):string {
  if(!poiGeneratorContract(r,e))return 'Generator circuit metadata missing';
  if(e.power===1&&!e.poiPower)return 'Legacy circuit · previously unlocked';
  if(e.poiPower&&e.power===1&&e.poiPower.expiresAt>now)return `Generator ON · ${Math.ceil((e.poiPower.expiresAt-now)/1000)}s · switch off`;
  if(e.poiPower?.pausedMs)return `Generator OFF · ${Math.ceil(e.poiPower.pausedMs/1000)}s · resume`;
  return 'Generator empty · 1 Fuel Canister';
}

/** C3: causal reason a powered gate is shut. Names the exact state and the single action that fixes it. Never consumes anything. */
export function poiPowerMissingReason(g: { poiPower?: { pausedMs?: number; expiresAt: number } } | undefined, now: number): string {
  if (!g) return 'Gate unpowered: no authorized generator is connected.';
  if (g.poiPower?.pausedMs) return `Gate unpowered: generator is OFF with ${Math.ceil(g.poiPower.pausedMs / 1000)}s banked. Use E on the generator to resume; no can needed.`;
  if (g.poiPower && g.poiPower.expiresAt <= now) return 'Gate unpowered: the generator has run out. Add 1 physical Fuel Canister to it.';
  return 'Gate unpowered: the generator is empty. Add 1 physical Fuel Canister to it.';
}
