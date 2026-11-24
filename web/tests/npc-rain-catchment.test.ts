import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {newGame,startRun,addItem,findRunEntity,beginReceiptSink,endReceiptSink,stepGardensBarrels} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {barrelBill,rainSite,installCatchment,drinkCommunityRain} from '../src/game/human-rainwater';
import {RECIPES} from '../src/game/catalog';
it('charges the whole pack recipe, or its same rope paid in fiber',()=>{
 expect(barrelBill(false)).toEqual(RECIPES.deploy_barrel.ins);
 expect(barrelBill(true)).toEqual([['wood',8],['fiber',3]]);
});
it('refuses an unpaid build and only the first body at the last serving can drink (position and water fixtures)',()=>{
 setActiveLayout('veyra05-world');const g=newGame(),now=Date.UTC(2026,10,15,8);expect(startRun(g,'female',now,null,7606).ok).toBe(true);
 const r=g.run!,hw=r.humanWorld!,c=hw.communities['com:po_tidecamp'],h=hw.people.h6f;
 const site={...rainSite(r,hw,c)!,twist:true};expect(site.gx).toBeDefined();h.gx=site.gx+1;h.gy=site.gy;h.floor=0;
 const pack=r.custody[h.inv.packId],before=structuredClone(pack.slots);expect(installCatchment(r,hw,h,c,site,now)).toBe(false);expect(pack.slots).toEqual(before);
 expect(addItem(r,h.inv.packId,'wood',8)).toBe(0);expect(addItem(r,h.inv.packId,'fiber',3)).toBe(0);
 expect(installCatchment(r,hw,h,c,site,now)).toBe(true);const barrel=findRunEntity(r,c.rainBarrelId)!;expect(barrel.water).toBe(0);expect(installCatchment(r,hw,h,c,site,now)).toBe(false);
 const target=`barrel:${barrel.id}`;h.thirst=0;expect(drinkCommunityRain(r,h,target,now)).toBe(false);barrel.water=1.25;
 h.gx+=2;expect(drinkCommunityRain(r,h,target,now)).toBe(false);h.gx-=2;const owner=barrel.owner;barrel.owner='player';expect(drinkCommunityRain(r,h,target,now)).toBe(false);barrel.owner=owner;
 expect(drinkCommunityRain(r,h,target,now)).toBe(true);expect(h.thirst).toBe(25);expect(drinkCommunityRain(r,h,target,now)).toBe(false);expect(barrel.water).toBe(.25);
});
const save=process.env.SOH_DRY_TIDECAMP;
it.skipIf(!save)('a dry coast builds an initially empty barrel from actual store and pack lots',()=>{
 let gs=selectSnapshots([readFileSync(save!,'utf8')]).gs!;const r=gs.run!,hw=r.humanWorld!,c=hw.communities['com:po_tidecamp'];expect(setActiveLayout(r.layoutId!)).toBe(true);expect(c.rainBarrelId).toBeUndefined();
 const start=r.clock.lastSimAt;beginReceiptSink();let events;
 try{for(let i=1;i<=45&&!c.rainBarrelId;i++)settle(gs,start+i*60000,true);}finally{events=endReceiptSink();}
 const h=hw.people.h6f;const treatment=events.filter(v=>v.kind==='human.medical.payment').map(v=>JSON.parse(v.detail)).find(v=>v.patient===h.actorId && v.hpBefore<30 && v.hpAfter>=30);expect(treatment?.inputs).toHaveLength(1);
 expect(c.rainBarrelId).toBeTruthy();const e=findRunEntity(r,c.rainBarrelId)!;
 const paid=events.filter(v=>v.kind==='human.barrel.built').map(v=>JSON.parse(v.detail)).find(v=>v.entity===e.id);
 expect(paid.actor).toBe(h.actorId);expect(paid.kit).toBe(e.deployed!.uid);expect(paid.inputs.reduce((v:number,s:{qty:number})=>v+s.qty,0)).toBe(11);
 const builtAt=events.find(v=>v.kind==='human.barrel.built' && JSON.parse(v.detail).entity===e.id)!.at;
 expect(e.owner).toBe(c.id);expect(e.type).toBe('barrel');const bytes=serializeSnapshot(gs);gs=selectSnapshots([bytes]).gs!;expect(gs).toBeTruthy();
 const after=findRunEntity(gs.run!,e.id)!;expect(after.water).toBe(e.water);const dry=selectSnapshots([bytes]).gs!,before=after.water;stepGardensBarrels(dry,20000,false);expect(findRunEntity(dry.run!,e.id)!.water).toBe(before);
 // Continue through actual weather slots. No rain injection or refilled flask.
 const then=gs.run!.clock.lastSimAt;let drink:ReturnType<typeof endReceiptSink>[number]|undefined;beginReceiptSink();try{
   for(let minutes=5;minutes<=360;minutes+=5){settle(gs,then+minutes*60000,true);drink=gs.run!.receipts.find(v=>v.kind==='human.barrel.drink' && v.detail.includes(`:${e.id}:`));if(drink)break;}
 }finally{const trace=endReceiptSink();drink??=trace.find(v=>v.kind==='human.barrel.drink' && v.detail.includes(`:${e.id}:`));}
 expect(drink).toBeTruthy();expect(drink!.at).toBeGreaterThan(builtAt);expect(gs.run!.humanWorld!.communities[c.id].rainBarrelId).toBe(e.id);expect(selectSnapshots([serializeSnapshot(gs)]).gs).toBeTruthy();
 const evidence={start,builtAt,treatment,construction:paid,firstObservedDrink:drink,remainingWater:after.water};console.log('TIDECAMP_RAIN',JSON.stringify(evidence));if(process.env.SOH_RAIN_REPORT)writeFileSync(process.env.SOH_RAIN_REPORT,JSON.stringify(evidence,null,2));
},300000);
