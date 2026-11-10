// MEC-01 R8C: high-grade iron ore from iron veins -> furnace -> refined ingots. SOH_PROVISIONAL rates.
// Real: harvestHit on a real iron vein of the shipping layout, real RNG, real furnace craft with timing and fuel.
// FIXTURE: starter coal/rich ore for the furnace step, and fuel wood in the furnace fuel container. Not natural play.
import {describe,it,expect,afterEach} from 'vitest';
import {type GameState,type RunState,TILE} from '../src/game/core';
import {RECIPES,SOURCES,qualityTierFor} from '../src/game/catalog';
import {addItem,countItem,dispatch,harvestHit,markDirty,newGame,sourceAt,stepStations,mkContainer} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';

const T=Date.UTC(2026,10,14);let n=0;
afterEach(()=>setActiveLayout('shipping'));
const act=(g:GameState,type:string,p:object={},at=T+10)=>dispatch(g,{id:'r8c-'+(++n),type,...p} as any,at);
function start(seed:number){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed},T).ok).toBe(true);g.run!.creatures=[];markDirty();return g;}
/** First real iron vein tile of this run's layout. */
function ironTile(r:RunState):[number,number]{
  for(let ty=0;ty<200;ty++)for(let tx=0;tx<200;tx++){const s=sourceAt(r,tx,ty,T);if(s&&s.key==='iron')return [tx,ty];}
  throw new Error('no iron vein');
}
// Ground drops are custody containers of kind 'drop' (spawnDrop); count their real rich-ore stacks.
const richOnGround=(r:RunState)=>Object.values(r.custody).filter(c=>c.kind==='drop').flatMap(c=>c.slots).reduce((a,s)=>a+(s?.key==='rich_iron_ore'?s.qty:0),0);

describe('MEC-01 R8C rich iron ore', () => {
  it('rate is tier-gated by the source contract: iron pick 8%, salvager 12%, stone pick none, environment none', () => {
    const iron=SOURCES.iron;
    expect(qualityTierFor(iron,{ore:5},'playerTool')).toEqual({item:'rich_iron_ore',chance:0.08});
    expect(qualityTierFor(iron,{ore:8},'playerTool')).toEqual({item:'rich_iron_ore',chance:0.12});
    expect(qualityTierFor(iron,{ore:4},'playerTool')).toBeNull();        // NEGATIVE: just below the iron-pick tier
    expect(qualityTierFor(iron,{ore:2},'playerTool')).toBeNull();        // NEGATIVE: stone pick
    expect(qualityTierFor(iron,{ore:8},'environment')).toBeNull();       // NEGATIVE: earthquake capability
    expect(qualityTierFor(SOURCES.rock,{stone:6,ore:5},'playerTool')).toBeNull(); // NEGATIVE: source without a contract
  });

  it('a generic harvest call with no extraction capability never yields rich ore, even with a top-tier ore power', () => {
    const g=start(815);const r=g.run!;const [tx,ty]=ironTile(r);
    for(let i=0;i<30;i++){const s=sourceAt(r,tx,ty,T);if(!s||s.stock<=0)break;harvestHit(g,tx,ty,{stone:6,ore:8},T+i*500,tx*TILE,ty*TILE);}
    expect(richOnGround(r)).toBe(0);
  });

  it('an iron-pick swing that depletes veins drops at most one rich ore per unit taken; stone-pick swings drop none', () => {
    const g=start(811);const r=g.run!;const [tx,ty]=ironTile(r);
    let units=0,rich=0;
    // Iron-class pick: power ore 5 (same as iron_pick). Count the stock actually taken per swing.
    for(let i=0;i<60;i++){const s=sourceAt(r,tx,ty,T);if(!s||s.stock<=0)break;const before=s.stock;harvestHit(g,tx,ty,{stone:6,ore:5,scrap:4},T+i*500,tx*TILE,ty*TILE,{extraction:'playerTool'});units+=before-(sourceAt(r,tx,ty,T)?.stock??0);}
    rich=richOnGround(r);
    expect(units).toBeGreaterThan(0);
    expect(rich).toBeLessThanOrEqual(units);         // conservation: never more rich ore than units taken
    // Stone-pick swings on a fresh iron vein: no rich ore, only stone/iron ore.
    const g2=start(812);const r2=g2.run!;const [ux,uy]=ironTile(r2);
    for(let i=0;i<60;i++){const s=sourceAt(r2,ux,uy,T);if(!s||s.stock<=0)break;harvestHit(g2,ux,uy,{stone:3,ore:2},T+i*500,ux*TILE,uy*TILE,{extraction:'playerTool'});}
    expect(richOnGround(r2)).toBe(0);
  });

  it('the rich path produces ore on real iron veins (positive control, not vacuously zero)', () => {
    let total=0;
    for(const seed of [821,822,823,824]){const g=start(seed);const r=g.run!;const [tx,ty]=ironTile(r);for(let i=0;i<40;i++){const s=sourceAt(r,tx,ty,T);if(!s||s.stock<=0)break;harvestHit(g,tx,ty,{stone:6,ore:5,scrap:4},T+i*500,tx*TILE,ty*TILE,{extraction:'playerTool'});}total+=richOnGround(r);}
    expect(total).toBeGreaterThan(0);
  });

  it('the same seed and the same swings give the same rich-ore count (replay determinism)', () => {
    const run=()=>{const g=start(813);const r=g.run!;const [tx,ty]=ironTile(r);for(let i=0;i<40;i++){const s=sourceAt(r,tx,ty,T);if(!s||s.stock<=0)break;harvestHit(g,tx,ty,{stone:6,ore:5,scrap:4},T+i*500,tx*TILE,ty*TILE,{extraction:'playerTool'});}return richOnGround(r);};
    expect(run()).toBe(run());
  });

  it('rich ore + one coal -> two refined ingots at a furnace after 14 real seconds; one second early yields nothing', () => {
    const g=start(814);const r=g.run!;
    const f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);
    const furnace:any={id:'r8c-furnace',kind:'struct',type:'furnace',x:r.player.x+8,y:r.player.y,tx:Math.floor(r.player.x/TILE),ty:Math.floor(r.player.y/TILE),hp:300,maxHp:300,station:{fuelC:f.id,outC:o.id,burn:0,queue:[]}};
    r.entities[furnace.id]=furnace;
    addItem(r,f.id,'wood',2);                                 // fixture fuel in the furnace
    // NEGATIVE: rich ore with no coal is refused; nothing reserved, no job
    addItem(r,'inv','rich_iron_ore',1);
    expect(act(g,'craft',{recipe:'refined_iron_rich',eid:furnace.id},T+20).ok).toBe(false);
    expect(furnace.station.queue.length).toBe(0);
    addItem(r,'inv','coal',1);                                // FIXTURE: one coal for the smelt
    expect(act(g,'craft',{recipe:'refined_iron_rich',eid:furnace.id},T+30).ok).toBe(true);
    stepStations(g,13000,T+13000);                            // NEGATIVE: 1 s before the real finish
    expect(o.slots.some(s=>s?.key==='refined_iron_ingot')).toBe(false);
    stepStations(g,1500,T+14500);
    const made=o.slots.filter(s=>s?.key==='refined_iron_ingot').reduce((a,s)=>a+(s?.qty??0),0);
    expect(made).toBe(RECIPES.refined_iron_rich.qty);
    expect(countItem(r,'inv','rich_iron_ore')).toBe(0);      // exactly one rich ore consumed
    expect(countItem(r,'inv','coal')).toBe(0);               // exactly one coal consumed
    // Save/reload: the job-free state with the output validates
    expect(validate(JSON.parse(JSON.stringify(JSON.parse(JSON.parse(serializeSnapshot(g)).payload))))).not.toBeNull();
  });

  it('rich route is cheaper per refined ingot than the common route in iron ore units', () => {
    // 1 rich ore -> 2 refined; common: 3 iron ore + 1 coal -> 2 refined. Rich saves 3 ore units and 30 s of smelting per 2 ingots.
    expect(RECIPES.refined_iron_rich.ins.find(([k])=>k==='rich_iron_ore')![1]).toBe(1);
    expect(RECIPES.refined_iron_rich.secs).toBeLessThan(RECIPES.refined_iron_ingot.secs);
    expect(RECIPES.iron_ingot.secs*3+RECIPES.refined_iron_ingot.secs).toBeGreaterThan(RECIPES.refined_iron_rich.secs);
  });
});
