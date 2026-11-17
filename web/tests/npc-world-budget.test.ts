/** Runtime accounting, not a sustainability certificate or natural-input acceptance. */
import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {BAL} from '../src/game/core';
import {newGame,startRun,findRunEntity} from '../src/game/engine';
import {ITEMS} from '../src/game/catalog';
import {setActiveLayout} from '../src/game/world';
import {NPC_POI_CENSUS} from '../src/game/npc-census';
import {authoredPlan} from '../src/veyra05/floors';
import {T0} from './helpers/g1b-kit';
it('accounts all 81 locations, actual beds and finite opening nutrition without calling deficits sustainable',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!;
 const rows=NPC_POI_CENSUS.map(p=>{
  const c=Object.values(hw.communities).find(c=>c.poi===p.id),people=c?c.memberIds.map(id=>hw.people[id]):[],plan=authoredPlan(p.id);
  const ids=[...(c?.storeContainers??[]),...people.flatMap(h=>[h.inv.packId,h.inv.cartId])];
  let food=0,water=0;for(const id of new Set(ids))for(const s of r.custody[id]?.slots??[])if(s){const d=ITEMS[s.key];if(d.waterContainer)water+=(d.food?.thirst??0)*(s.charge??0);else{food+=(d.food?.hunger??0)*s.qty;water+=(d.food?.thirst??0)*s.qty;}}
  const hungerNeed=people.reduce((n,h)=>n+Math.max(0,BAL.player.offlineHungerPerHour*336-h.hunger),0),thirstNeed=people.reduce((n,h)=>n+Math.max(0,BAL.player.offlineThirstPerHour*336-h.thirst),0);
  return {poi:p.id,name:p.name,classification:people.length?'OCCUPIED_UNCERTIFIED':c?.class??'NO_RESIDENT_SOURCE',residents:people.length,compiledRooms:plan?.plan.rooms.length??0,compiledFloors:plan?.levels.size??0,authoredBedProps:plan?.plan.props.filter(q=>q.kind==='bed').length??0,functionalBeds:c?.homeBeds.filter(id=>findRunEntity(r,id)?.type==='bed_straw').length??0,assignedBeds:people.filter(h=>h.bedId).length,unhoused:people.filter(h=>!h.bedId).length,foodPoints:food,waterPoints:water,hungerNeed336h:hungerNeed,thirstNeed336h:thirstNeed,foodDeficit:Math.max(0,hungerNeed-food),waterDeficit:Math.max(0,thirstNeed-water),stations:c?.workStations.length??0,stockAuthority:ids.length?'REGIONAL_HUMAN_ECONOMY':'NONE',replenishment:'NOT_CERTIFIED',routeStatus:'GLOBAL_AND_FLOOR_ROUTES_NOT_CERTIFIED',elderContact:'GLOBAL_ASSAULT_NOT_IMPLEMENTED'};
 });
 expect(rows).toHaveLength(81);expect(new Set(rows.map(q=>q.poi)).size).toBe(81);
 expect(rows.reduce((n,q)=>n+q.residents,0)).toBe(Object.keys(hw.people).length);
 expect(rows.some(q=>q.foodDeficit>0)).toBe(true);expect(rows.some(q=>q.functionalBeds>0)).toBe(true);
 if(process.env.NPC_AUDIT_OUT){const keys=Object.keys(rows[0]);const csv=[keys.join(','),...rows.map(q=>keys.map(k=>JSON.stringify(q[k as keyof typeof q])).join(','))].join('\n')+'\n';writeFileSync(process.env.NPC_AUDIT_OUT,csv);}
});
