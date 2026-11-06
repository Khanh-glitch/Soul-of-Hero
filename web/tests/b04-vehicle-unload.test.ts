// B04: stranded motorbike emergency unload into a physical ground bag, plus OfflineReturnV1 truth repairs (R1-R3).
import {afterEach,describe,expect,it} from 'vitest';
import {TILE,WW,type Entity,type GameState} from '../src/game/core';
import {addItem,C,dispatch,markDirty,mkContainer,newGame,receipt} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {vehicleClear} from '../src/game/motorbike';
import {serializeSnapshot,validate} from '../src/game/persist';
import {buildOfflineReturn,captureReturnSnapshot} from '../src/game/return-report';
const T=Date.UTC(2026,10,5);let serial=0;
const act=(g:GameState,type:string,p:object={},id=`ub-${++serial}`,now=T+1)=>dispatch(g,{id,type,...p},now);
const snapshot=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function setup(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:99},'start',T).ok).toBe(true);return g;}
function line(g:GameState){const r=g.run!,w=getWorld(r.layoutId);for(let y=2;y<198;y++)for(let x=3;x<194;x++){let yes=true;for(let d=-1;d<=4;d++){const px=(x+d)*TILE+8,py=y*TILE+8;if(!w.economyMap.road[y*WW+x+d]||!vehicleClear(r,px,py)){yes=false;break;}}if(yes)return{x:x*TILE+8,y:y*TILE+8};}throw new Error('no road line');}
function deploy(g:GameState){const r=g.run!,q=line(g);r.player.x=q.x-TILE;r.player.y=q.y;addItem(r,'inv','motorbike_kit',1);expect(act(g,'placeMotorbike',q).ok).toBe(true);const e=Object.values(r.entities).find(x=>x.kind==='vehicle')!;return {r,e};}
const allUids=(g:GameState)=>Object.values(g.run!.custody).flatMap(c=>c.slots.filter(Boolean).map(s=>s!.uid)).sort();
const bagsAt=(r:GameState['run'] & object,e:Entity)=>Object.values(r!.entities).filter(x=>x.kind==='bag'&&Math.floor(x.x/TILE)===Math.floor(e.x/TILE)&&Math.floor(x.y/TILE)===Math.floor(e.y/TILE));
function loadCargo(g:GameState,e:Entity){const r=g.run!;for(const k of ['core_fire','fuel_can','scrap']) addItem(r,'inv',k,1);const inv=C(r,'inv');for(const key of ['core_fire','fuel_can','scrap']){const i=inv.slots.findIndex(s=>s?.key===key);expect(act(g,'move',{from:'inv',fs:i,to:e.c}).ok).toBe(true);}return C(r,e.c!).slots.filter(Boolean).map(s=>s!.uid);}
afterEach(()=>setActiveLayout('shipping'));

describe('B04 stranded motorbike: emergency unload into a physical ground bag', () => {
  it('a broken motorbike moves its real cargo stacks (same UIDs, qty, dur) into ONE bag at its tile; nothing copied', () => {
    const g=setup(),{r,e}=deploy(g);
    const cargo=loadCargo(g,e);expect(cargo.length).toBe(3);
    e.hp=0;e.deployed!.dur=0;e.deployed!.dur=0;
    const before=allUids(g);
    const res=act(g,'vehicleUnloadBag',{eid:e.id},'u1',T+100);
    expect(res.ok).toBe(true);
    expect(C(r,e.c!).slots.filter(Boolean).length).toBe(0);
    const bags=bagsAt(r,e);expect(bags.length).toBe(1);
    expect(C(r,bags[0].c!).slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([...cargo].sort());
    expect(allUids(g)).toEqual(before);
    expect(new Set(allUids(g)).size).toBe(allUids(g).length);
    expect(r.receipts.some(x=>x.kind==='vehicle.unload'&&x.detail.startsWith(`${e.deployed!.uid}:${bags[0].id}:`))).toBe(true);
    expect(e.deployed!.uid).toBeTruthy();
    expect(e.hp).toBe(0); // no free repair or fuel from unloading
  });
  it('out of fuel (hp intact) also allows the unload; the bike keeps its UID and fuel stays at zero', () => {
    const g=setup(),{r,e}=deploy(g);loadCargo(g,e);
    e.vehicle!.fuel=0;const uid=e.deployed!.uid;
    expect(act(g,'vehicleUnloadBag',{eid:e.id},'u2',T+100).ok).toBe(true);
    expect(e.deployed!.uid).toBe(uid);expect(e.vehicle!.fuel).toBe(0);
    expect(bagsAt(r,e).length).toBe(1);
  });
  it('a repeated intent moves nothing and creates no duplicate bag', () => {
    const g=setup(),{r,e}=deploy(g);loadCargo(g,e);e.hp=0;e.deployed!.dur=0;
    expect(act(g,'vehicleUnloadBag',{eid:e.id},'u3',T+100).ok).toBe(true);
    const again=act(g,'vehicleUnloadBag',{eid:e.id},'u4',T+101);
    expect(again.ok).toBe(false);
    expect(bagsAt(r,e).length).toBe(1);
  });
  it('a running motorbike (hp and fuel present) refuses; cargo stays in the bike', () => {
    const g=setup(),{r,e}=deploy(g);const cargo=loadCargo(g,e);e.vehicle!.fuel=50;e.hp=100;e.deployed!.dur=100;
    const res=act(g,'vehicleUnloadBag',{eid:e.id},'u5',T+100);
    expect(res.ok).toBe(false);expect(res.reason).toMatch(/can still run/);
    expect(C(r,e.c!).slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([...cargo].sort());
    expect(bagsAt(r,e).length).toBe(0);
  });
  it('mounted, out-of-reach and not-owned motorbikes refuse with no change', () => {
    const g=setup(),{r,e}=deploy(g);loadCargo(g,e);e.hp=0;e.deployed!.dur=0;
    r.player.vehicle=e.id;expect(act(g,'vehicleUnloadBag',{eid:e.id},'u6',T+100).ok).toBe(false);delete r.player.vehicle;
    r.player.x+=12*TILE;expect(act(g,'vehicleUnloadBag',{eid:e.id},'u7',T+101).ok).toBe(false);r.player.x-=12*TILE;
    const owner=e.owner;e.owner='other';expect(act(g,'vehicleUnloadBag',{eid:e.id},'u8',T+102).ok).toBe(false);e.owner=owner;
    expect(bagsAt(r,e).length).toBe(0);expect(C(r,e.c!).slots.filter(Boolean).length).toBe(3);
  });
  it('a partial unload moves only the chosen UIDs; the rest stays in the motorbike', () => {
    const g=setup(),{r,e}=deploy(g);const cargo=loadCargo(g,e);e.hp=0;e.deployed!.dur=0;
    expect(act(g,'vehicleUnloadBag',{eid:e.id,uids:[cargo[0]]},'u9',T+100).ok).toBe(true);
    const bag=bagsAt(r,e)[0];
    expect(C(r,bag.c!).slots.filter(Boolean).map(s=>s!.uid)).toEqual([cargo[0]]);
    expect(C(r,e.c!).slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([cargo[1],cargo[2]].sort());
    expect(act(g,'vehicleUnloadBag',{eid:e.id,uids:['nope']},'u10',T+101).ok).toBe(false);
  });
  it('a full ground bag refuses without moving anything (no silent loss)', () => {
    const g=setup(),{r,e}=deploy(g);const cargo=loadCargo(g,e);e.hp=0;e.deployed!.dur=0;
    const cont=mkContainer(r,'bag',1);addItem(r,cont.id,'scrap',1);
    const bag:Entity={id:'bag-full',kind:'bag',x:e.x,y:e.y,c:cont.id,label:'full',born:T};r.entities[bag.id]=bag;markDirty();
    const res=act(g,'vehicleUnloadBag',{eid:e.id},'u11',T+100);
    expect(res.ok).toBe(false);expect(C(r,e.c!).slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([...cargo].sort());
  });
  it('saved and reloaded: the bag, its UIDs and the emptied motorbike survive; old unload receipts are not replayed', () => {
    const g=setup(),{r,e}=deploy(g);const cargo=loadCargo(g,e);e.hp=0;e.deployed!.dur=0;
    expect(act(g,'vehicleUnloadBag',{eid:e.id},'u12',T+100).ok).toBe(true);
    const reloaded=snapshot(g);expect(validate(reloaded)).toBeTruthy();
    const rr=reloaded.run!;const re=Object.values(rr.entities).find(x=>x.kind==='vehicle')!;
    const bag=bagsAt(rr,re)[0];expect(bag).toBeTruthy();
    expect(C(rr,bag.c!).slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([...cargo].sort());
    expect(C(rr,re.c!).slots.filter(Boolean).length).toBe(0);
    expect(act(reloaded,'vehicleUnloadBag',{eid:re.id},'u13',T+200).ok).toBe(false);
  });
});

describe('B04 OfflineReturnV1 truth repairs (R1-R3)', () => {
  it('R3: a synthetic station receipt for an unseen, non-owned POI station is dropped; an owned workbench receipt is shown', () => {
    const g=setup(),r=g.run!;
    const poiOut=mkContainer(r,'out',6);addItem(r,poiOut.id,'scrap',3);
    r.entities['poi-hidden']={id:'poi-hidden',kind:'recycler',poi:'factory',label:'Hidden site',x:50*TILE,y:50*TILE,tx:50,ty:50,station:{queue:[],burn:0,fuelC:mkContainer(r,'fuel',3).id,outC:poiOut.id}} as any;
    const bench:Entity={id:'bench-mine',kind:'struct',type:'workbench',x:20*TILE,y:20*TILE,tx:20,ty:20,hp:100,maxHp:100,station:{queue:[],burn:0,fuelC:mkContainer(r,'fuel',3).id,outC:mkContainer(r,'out',6).id}} as any;
    r.entities[bench.id]=bench;markDirty();
    const before=captureReturnSnapshot(g)!;
    const rep=buildOfflineReturn(g,before,[
      {id:'s1',at:T+5,kind:'station.state',detail:'poi-hidden:idle>output_full'},
      {id:'s2',at:T+6,kind:'station.state',detail:'bench-mine:running>output_full'},
      {id:'s3',at:T+7,kind:'job.done',detail:'poi-hidden:R:iron_ingot'},
    ],T,T+60000,false);
    const text=JSON.stringify(rep.sections);
    expect(text).not.toMatch(/50,50/);expect(text).not.toMatch(/Hidden site/);
    expect(text).not.toMatch(/iron ingot/i);
    expect(text).toMatch(/Workbench 20,20/);
  });
  it('R2: an unrelated bag on a vanished structure tile is labelled origin not verified, never as its wreckage', () => {
    const g=setup(),r=g.run!;
    const before=captureReturnSnapshot(g)!;
    before.structs['gone1']={name:'Garden',tx:30,ty:30,hp:40,maxHp:60};
    const cont=mkContainer(r,'bag',4);addItem(r,cont.id,'scrap',2);
    r.entities['bag-stray']={id:'bag-stray',kind:'bag',x:30*TILE,y:30*TILE,c:cont.id,label:'stray',born:T};markDirty();
    const rep=buildOfflineReturn(g,before,[],T,T+60000,false);
    const lost=rep.sections.loss.find(x=>x.id==='gone:gone1'||x.id==='lost:gone1');
    expect(lost).toBeTruthy();
    expect(lost!.text).toMatch(/origin not verified/);
    expect(lost!.text).not.toMatch(/collapsed/);
  });
  it('R1: a dead player with no real bag on the death tile is told no bag is confirmed, not that a bag keeps their items', () => {
    const g=setup(),r=g.run!;
    const before=captureReturnSnapshot(g)!;
    r.player.dead=true;
    const rep=buildOfflineReturn(g,before,[],T,T+60000,false);
    const dead=rep.sections.body.find(x=>x.id==='dead')!;
    expect(dead.text).toMatch(/No surviving bag is confirmed/);
    expect(dead.text).not.toMatch(/keeps your belongings/);
  });
  it('R1: a dead player standing on a real bag is told which bag entity holds the items', () => {
    const g=setup(),r=g.run!;
    const before=captureReturnSnapshot(g)!;
    r.player.dead=true;
    const cont=mkContainer(r,'bag',8);addItem(r,cont.id,'scrap',1);
    r.entities['bag-death']={id:'bag-death',kind:'bag',x:r.player.x,y:r.player.y,c:cont.id,label:'death',born:T};markDirty();
    const rep=buildOfflineReturn(g,before,[],T,T+60000,false);
    expect(rep.sections.body.find(x=>x.id==='dead')!.text).toMatch(/bag-death/);
  });
});
