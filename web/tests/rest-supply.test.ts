import {describe,it,expect} from 'vitest';
import {BAL,HOUR,TILE,WW,T,type GameState,type RunState} from '../src/game/core';
import {getWorld} from '../src/game/world';
import {newGame,dispatch,addItem,countItem,C,blockGrid,destroyStructure,killPlayer,restForecast,restEligible,homeStatus,markDirty,weatherAt,isWet,darkness} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';

// Rest is tested through the real intents, real build placement, real custody and the shared settle clock.
// Only the world site search is a fixture; every structure, chest, bed and item in the shelter is built or moved by intents.
const T=Date.UTC(2026,0,1);let seq=0;
const act=(g:GameState,type:string,data:object={},now=T)=>dispatch(g,{id:`resttest-${++seq}`,type,...data},now);
const copy=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const why=(res:any)=>res.ok?'':res.reason;
const uids=(r:RunState)=>Object.values(r.custody).flatMap(c=>c.slots.filter(Boolean).map(s=>s!.uid)).sort();

// Real world conditions only (no heat grant): a candidate tile is a TEMPERATE rest site when the game's own shared thermal
// authority, with NO heat source and NO insulation, keeps a sheltered sleeper's target >= 50 at every 30-minute sample of the 12 h
// window (zone, weather slots and night are all the real ones). The frigid negative case uses the same authority, not a special rule.
import {thermalEnv,thermalEvaluate} from '../src/game/thermal';
const TEMPERATE_MIN_TARGET=50;
const HALF_HOUR=30*60000;
const climateTargets=(r:RunState,xx:number,yy:number,hours:number)=>{const zone=getWorld().zone[yy*WW+xx];const out:number[]=[];for(let t=T;t<=T+hours*HOUR;t+=HALF_HOUR)out.push(thermalEvaluate(r,thermalEnv(r,{x:xx*TILE+8,y:yy*TILE+8,zone,tileType:T.FLOOR,wet:isWet(weatherAt(r,t)),dark:darkness(r,t)>0.45,sheltered:true})).target);return out;};
const isTemperate=(r:RunState,xx:number,yy:number)=>Math.min(...climateTargets(r,xx,yy,12))>=TEMPERATE_MIN_TARGET;
function site(g:GameState,pred:(r:RunState,x:number,y:number)=>boolean=isTemperate){
  const r=g.run!,w=getWorld(),grid=blockGrid(r);
  for(let yy=20;yy<180;yy++)for(let xx=20;xx<180;xx++){
    const cells=[];for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++)cells.push([dx,dy]);
    if(cells.every(([dx,dy])=>{const i=(yy+dy)*WW+xx+dx;return grid[i]===0&&!w.sourceV3[i]&&w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.accessCorridors?.mask[i];}) && pred(r,xx,yy))return {x:xx,y:yy};
  }
  throw new Error('no open site');
}
// Builds a real 2x2 wooden shelter (floor, roof, walls) with a Cabinet-free bed and chest inside.
function shelter(seed:number,pred?:(r:RunState,x:number,y:number)=>boolean){
  const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed}).ok).toBe(true);
  const r=g.run!;r.creatures=[];
  const {x,y}=site(g,pred);
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  addItem(r,'inv','wood',400);addItem(r,'inv','fiber',200);addItem(r,'inv','stone',60);
  const build=(struct:string,tx:number,ty:number)=>{const res=act(g,"build",{struct,tx,ty});expect({s:struct,tx,ty,why:res.ok?"":(res as any).reason}).toEqual({s:struct,tx,ty,why:""});};
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)build('floor_wood',x+dx,y+dy);
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)build('roof_thatch',x+dx,y+dy);
  // Walls are placed from just outside each ring tile (line of sight from inside would cross the ring).
  for(let dx=-1;dx<=2;dx++)for(let dy=-1;dy<=2;dy++){
    if(dx>=0&&dx<=1&&dy>=0&&dy<=1)continue;
    const ox=dx<0?-1:dx>1?1:0, oy=dy<0?-1:dy>1?1:0;
    r.player.x=(x+dx+ox)*TILE+8;r.player.y=(y+dy+oy)*TILE+8;
    build('wall_wood',x+dx,y+dy);
  }
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  build('bed_straw',x,y);build('chest_small',x+1,y+1);
  const bed=Object.values(r.entities).find(e=>e.type==='bed_straw')!;
  const chest=Object.values(r.entities).find(e=>e.type==='chest_small')!;
  r.player.x=x*TILE+8;r.player.y=(y+1)*TILE+8;
  // Provisions: real safe food, real charged flask, and a raw meat that must be refused.
  addItem(r,chest.c!,'cooked_meat',3);addItem(r,chest.c!,'meat',1);addItem(r,chest.c!,'water_flask',1);
  const flask=C(r,chest.c!).slots.find(s=>s?.key==='water_flask')!;flask.charge=4;
  return {g,r,bed,chest,flask};
}
const meatUid=(r:RunState,cid:string)=>C(r,cid).slots.find(s=>s?.key==='cooked_meat')!.uid;
const rawUid=(r:RunState,cid:string)=>C(r,cid).slots.find(s=>s?.key==='meat')!.uid;

describe('supplied bed rest (real intents, physical custody)',()=>{
  it('starts from a real bed intent and moves the exact chosen UIDs into locked reserve custody',()=>{
    const {g,r,bed,chest,flask}=shelter(501);
    r.player.hunger=40;r.player.thirst=60;
    const before=uids(r),m=meatUid(r,chest.c!);
    const res=act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[m,flask.uid],hours:8},T);
    expect(res.ok).toBe(true);
    expect(r.rest).toMatchObject({version:'rest-v1',bedId:bed.id,chestId:chest.id,startedAt:T,targetAt:T+8*HOUR});
    const reserve=r.custody[r.rest!.reserveId];
    expect(reserve.slots.filter(Boolean).map(s=>s!.uid).sort()).toEqual([m,flask.uid].sort());
    expect(C(r,chest.c!).slots.filter(Boolean).some(s=>s!.uid===m||s!.uid===flask.uid)).toBe(false);
    expect(uids(r)).toEqual(before); // no duplication, no loss
    expect(new Set(uids(r)).size).toBe(uids(r).length);
    expect(validate(copy(g))).toBeTruthy();
  });
  it('refuses raw meat, unknown UIDs, bad durations, too many stacks and a bed beyond reach',()=>{
    const {g,r,bed,chest,flask}=shelter(502);
    r.player.hunger=40;r.player.thirst=60;
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[rawUid(r,chest.c!)],hours:8}).ok).toBe(false);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:['nope'],hours:8}).ok).toBe(false);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[flask.uid],hours:3}).ok).toBe(false);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[],hours:8}).ok).toBe(false);
    r.player.x+=6*TILE;
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[flask.uid],hours:8}).ok).toBe(false);
    expect(r.rest).toBeUndefined();
    expect(C(r,chest.c!).slots.find(s=>s?.uid===flask.uid)).toBeTruthy();
  });
  it('a legitimate 8 h interval consumes real food and flask charge at the trigger and wakes exactly on time',()=>{
    const {g,r,bed,chest,flask}=shelter(503);
    r.player.hunger=40;r.player.thirst=60;
    const meat=meatUid(r,chest.c!),meatBefore=countItem(r,chest.c!,'cooked_meat');expect(meatBefore).toBe(3);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[meat,flask.uid],hours:8}).ok).toBe(true);
    const before=uids(r);
    settle(g,T+8*HOUR,true);
    expect(r.rest).toBeUndefined();
    const end=r.receipts.find(x=>x.kind==='rest.end')!;
    expect(end.detail).toMatch(/^rested;/);
    expect(end.at).toBe(T+8*HOUR);
    const eaten=r.receipts.filter(x=>x.kind==='rest.eat').length;
    const drinks=r.receipts.filter(x=>x.kind==='rest.drink').length;
    expect(eaten).toBeGreaterThanOrEqual(1);
    expect(drinks).toBeGreaterThanOrEqual(1);
    // Real quantities: chest keeps the leftovers, and the flask UID is still the same object with reduced charge.
    expect(countItem(r,chest.c!,'cooked_meat')+eaten).toBe(meatBefore);
    const f=Object.values(r.custody).flatMap(c=>c.slots).find(s=>s?.uid===flask.uid)!;
    expect(f).toBeTruthy();
    expect(f.charge).toBe(4-drinks);
    expect(uids(r)).toEqual(before);
    expect(validate(copy(g))).toBeTruthy();
  });
  it('shared online/offline chronology: a partitioned settle equals one long settle, and hunger is never frozen',()=>{
    const a=shelter(504);
    a.r.player.hunger=40;a.r.player.thirst=60;
    expect(act(a.g,'restStart',{eid:a.bed.id,chestId:a.chest.id,items:[meatUid(a.r,a.chest.c!),a.flask.uid],hours:8}).ok).toBe(true);
    const b=copy(a.g);
    settle(a.g,T+8*HOUR,true);
    for(let t=37*60000;t<=8*HOUR;t+=37*60000)settle(b,T+t,true);
    settle(b,T+8*HOUR,true);
    const pa=a.g.run!.player,pb=b.run!.player;
    expect(pb.hunger).toBeCloseTo(pa.hunger,3);
    expect(pb.thirst).toBeCloseTo(pa.thirst,3);
    expect(JSON.stringify(b.run!.custody)).toBe(JSON.stringify(a.g.run!.custody));
    expect(b.run!.receipts.filter(x=>x.kind.startsWith('rest.')).map(x=>x.kind+x.detail)).toEqual(a.g.run!.receipts.filter(x=>x.kind.startsWith('rest.')).map(x=>x.kind+x.detail));
  });
  it('save and reload mid-rest keeps the same reserve custody, charge, and resumes to the same wake',()=>{
    const {g,r,bed,chest,flask}=shelter(505);
    r.player.hunger=40;r.player.thirst=60;
    const m=meatUid(r,chest.c!);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[m,flask.uid],hours:8}).ok).toBe(true);
    expect(validate(g)).toBeTruthy();
    settle(g,T+2*HOUR,true);
    const saved=copy(g);
    expect(validate(saved)).toBeTruthy();
    expect(saved.run!.rest).toEqual(g.run!.rest);
    expect(JSON.stringify(saved.run!.custody)).toBe(JSON.stringify(g.run!.custody));
    settle(g,T+8*HOUR,true);settle(saved,T+8*HOUR,true);
    expect(JSON.stringify(saved.run!.custody)).toBe(JSON.stringify(g.run!.custody));
    expect(saved.run!.player.hunger).toBeCloseTo(g.run!.player.hunger,3);
  });
  it('an explicit cancel wakes at once and returns leftovers to the same chest with the same UIDs',()=>{
    const {g,r,bed,chest,flask}=shelter(506);
    r.player.hunger=40;r.player.thirst=60;
    const m=meatUid(r,chest.c!);
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[m,flask.uid],hours:8}).ok).toBe(true);
    const before=uids(r);
    const cancel=act(g,'restCancel',{},T+HOUR);
    expect(cancel.ok).toBe(true);
    expect(r.rest).toBeUndefined();
    expect(uids(r)).toEqual(before);
    expect(C(r,chest.c!).slots.some(s=>s?.uid===m)).toBe(true);
    expect(C(r,chest.c!).slots.some(s=>s?.uid===flask.uid)).toBe(true);
  });
  it('destroying the bed ends rest and returns every reserved UID; losing the chest sends them to a bag at the bed',()=>{
    const a=shelter(507);
    a.r.player.hunger=40;a.r.player.thirst=60;
    expect(act(a.g,'restStart',{eid:a.bed.id,chestId:a.chest.id,items:[meatUid(a.r,a.chest.c!),a.flask.uid],hours:8}).ok).toBe(true);
    const beforeA=uids(a.r);
    destroyStructure(a.r,a.bed,T+HOUR);
    expect(a.r.rest).toBeUndefined();
    expect(uids(a.r)).toEqual(beforeA);
    const b=shelter(508);
    b.r.player.hunger=40;b.r.player.thirst=60;
    expect(act(b.g,'restStart',{eid:b.bed.id,chestId:b.chest.id,items:[meatUid(b.r,b.chest.c!),b.flask.uid],hours:8}).ok).toBe(true);
    const beforeB=uids(b.r);const reservedB=b.r.custody[b.r.rest!.reserveId].slots.filter(Boolean).map(x=>x!.uid);
    destroyStructure(b.r,b.chest,T+HOUR);
    expect(b.r.rest).toBeUndefined();
    expect(uids(b.r)).toEqual(beforeB);
    const endB=b.r.receipts.find(x=>x.kind==='rest.end')!;
    expect(endB.detail).toMatch(/bed or chest destroyed/);
    const bagged=Object.values(b.r.custody).filter(c=>c.kind==='bag').flatMap(c=>c.slots.filter(Boolean).map(s=>s!.uid));
    expect(reservedB.length).toBe(2);expect(bagged).toEqual(expect.arrayContaining(reservedB));
    expect(validate(copy(b.g))).toBeTruthy();
  });
  it('death ends the rest before the bag forms, so no reserved item is stranded',()=>{
    const {g,r,bed,chest,flask}=shelter(509);
    r.player.hunger=40;r.player.thirst=60;
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[meatUid(r,chest.c!),flask.uid],hours:8}).ok).toBe(true);
    const before=uids(r);
    killPlayer(g,T+HOUR,'test');
    expect(r.rest).toBeUndefined();
    expect(uids(r)).toEqual(before);
    expect(validate(copy(g))).toBeTruthy();
  });
  it('the forecast is the same arithmetic the simulator uses: food-limited rest wakes when food runs out',()=>{
    const {g,r,bed,chest,flask}=shelter(510);
    r.player.hunger=40;r.player.thirst=60;
    const stacks=[flask];
    const f=restForecast(r,stacks,8);
    expect(f.limitedBy).toBe('food');
    expect(f.coveredHours).toBeCloseTo((40-BAL.restV1.triggerStat)/BAL.player.offlineHungerPerHour,6);
    expect(restEligible(flask)).toBe('water');
    expect(act(g,'restStart',{eid:bed.id,chestId:chest.id,items:[flask.uid],hours:8}).ok).toBe(true);
    settle(g,T+8*HOUR,true);
    const end=r.receipts.find(x=>x.kind==='rest.end')!;
    expect(end.detail).toMatch(/^food out;/);
    expect(end.at-T).toBeCloseTo(f.coveredHours*HOUR,-3);
    expect(r.player.hunger).toBeLessThanOrEqual(BAL.restV1.triggerStat+0.01);
  });
});

describe('homeStatus external coverage (audit fix)',()=>{
  function cabinetWith(dx:number,dy:number,seed:number){
    const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed}).ok).toBe(true);
    const r=g.run!;r.creatures=[];const {x,y}=site(g);
    r.player.x=(x-2)*TILE+8;r.player.y=y*TILE+8;
    addItem(r,'inv','wood',200);addItem(r,'inv','stone',80);addItem(r,'inv','fiber',60);addItem(r,'inv','rope',20);addItem(r,'inv','iron_ingot',40);addItem(r,'inv','spares',40);addItem(r,'inv','mechanical_parts',40);addItem(r,'inv','fasteners',40);
    expect(why(act(g,'build',{struct:'floor_wood',tx:x,ty:y}))).toBe('');
    expect(why(act(g,'build',{struct:'claim',tx:x,ty:y}))).toBe('');
    const cab=Object.values(r.entities).find(e=>e.type==='claim')!;
    expect(why(act(g,'build',{struct:'floor_wood',tx:x+dx,ty:y+dy}))).toBe('');
    markDirty();
    return {g,r,cab,x,y};
  }
  it('a foundation on the horizontal neighbour is external coverage and not idle',()=>{
    const {r,cab}=cabinetWith(1,0,601);
    const s=homeStatus(r).cabinets.find(c=>c.id===cab.id)!;
    expect(s.external).toBeGreaterThanOrEqual(1);
    expect(s.state).not.toBe('idle');
  });
  it('a foundation on the vertical neighbour is external coverage and not idle',()=>{
    const {r,cab}=cabinetWith(0,1,602);
    const s=homeStatus(r).cabinets.find(c=>c.id===cab.id)!;
    expect(s.external).toBeGreaterThanOrEqual(1);
    expect(s.state).not.toBe('idle');
  });
  it('a foundation on the diagonal neighbour is external coverage and not idle',()=>{
    const {r,cab}=cabinetWith(1,1,603);
    const s=homeStatus(r).cabinets.find(c=>c.id===cab.id)!;
    expect(s.external).toBeGreaterThanOrEqual(1);
    expect(s.state).not.toBe('idle');
  });
  it('a lone self-only Cabinet on its own tile is still idle (self does not count)',()=>{
    const g=newGame();expect(act(g,'startRun',{character:'female',region:0,seed:604}).ok).toBe(true);
    const r=g.run!;r.creatures=[];const {x,y}=site(g);r.player.x=(x-2)*TILE+8;r.player.y=y*TILE+8;
    addItem(r,'inv','wood',200);addItem(r,'inv','stone',80);addItem(r,'inv','fiber',60);addItem(r,'inv','rope',20);addItem(r,'inv','iron_ingot',40);addItem(r,'inv','spares',40);addItem(r,'inv','mechanical_parts',40);addItem(r,'inv','fasteners',40);
    expect(why(act(g,'build',{struct:'floor_wood',tx:x,ty:y}))).toBe('');
    expect(why(act(g,'build',{struct:'claim',tx:x,ty:y}))).toBe('');
    const cab=Object.values(r.entities).find(e=>e.type==='claim')!;
    expect(homeStatus(r).cabinets.find(c=>c.id===cab.id)!.state).toBe('idle');
  });
});

// Hostile-climate NEGATIVE case (creator law: an unheated shelter in cold weather may kill a sleeper; a bed is not cold immunity).
// The site is chosen by the same shared thermal authority: the sheltered, unheated target falls below the cold gate (8) somewhere in the window.
describe('rest V1 in a frigid unheated shelter (lawful exposure death, exact custody)', () => {
  const frigid = (r: RunState, x: number, y: number) => Math.min(...climateTargets(r, x, y, 12)) < 8;
  it('an 8 h unheated rest in a frigid site ends in exposure death at a real time, with every reserve UID restored', () => {
    const { g, r, bed, chest, flask } = shelter(503, frigid);
    r.player.hunger = 40; r.player.thirst = 60;
    const meat = meatUid(r, chest.c!);
    const before = uids(r);
    expect(act(g, 'restStart', { eid: bed.id, chestId: chest.id, items: [meat, flask.uid], hours: 8 }).ok).toBe(true);
    settle(g, T + 8 * HOUR, true);
    expect(r.player.dead).toBe(true);
    const death = r.receipts.find(x => x.kind === 'death')!;
    expect(death.detail).toMatch(/exposure/);
    expect(death.at).toBeGreaterThan(T);
    expect(death.at).toBeLessThanOrEqual(T + 8 * HOUR);
    const end = r.receipts.find(x => x.kind === 'rest.end')!;
    expect(end.detail).toMatch(/^death;/);
    expect(end.at).toBe(death.at);
    expect(uids(r)).toEqual(before); // no duplication, no loss: reserve UIDs go to bag/custody
    expect(new Set(uids(r)).size).toBe(uids(r).length);
  });
});
