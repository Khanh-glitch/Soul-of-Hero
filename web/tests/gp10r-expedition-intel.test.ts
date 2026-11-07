// GP10-R: physically observed expedition facts. Fixture disclosure: fresh shipping run; the player is placed beside the
// real lighthouse door and crate (no items injected for the gate test). Real intents: door, observeLoot. Save roundtrip via persist.
import {afterAll,describe,it,expect} from 'vitest';
import {TILE,type GameState} from '../src/game/core';
import {addItem,dispatch,newGame} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {expeditionNotes,validIntel} from '../src/game/expedition-intel';
const START=Date.UTC(2026,10,5);
let serial=0;
afterAll(()=>setActiveLayout('shipping'));
function fresh(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(dispatch(g,{id:'gp10r-start-'+ ++serial,type:'startRun',character:'female',seed:73},START).ok).toBe(true);
  const r=g.run!;r.creatures=[];r.worldStimuli=[];return {g,r};
}
function placeAt(r:any,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;}
function copy(g:GameState){return selectSnapshots([serializeSnapshot(g),null]).gs!;}

describe('GP10-R expedition intel authority', () => {
  it('records the lighthouse gate only from an in-reach interaction, and the crate only from its real contents', () => {
    const {g,r}=fresh();
    const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.poi==='light'&&e.locked==='power')!;
    expect(door).toBeTruthy();
    // Out of reach: nothing recorded, no hidden knowledge.
    placeAt(r,door.tx,door.ty+12);
    expect(dispatch(g,{id:'gp10r-far-'+ ++serial,type:'door',eid:door.id},START+5).ok).toBe(false);
    expect(r.intel??[]).toEqual([]);
    // In reach (outside the authored doorway): the gate requirement is observed.
    placeAt(r,door.tx,door.ty+1);
    dispatch(g,{id:'gp10r-door-'+ ++serial,type:'door',eid:door.id},START+6);
    expect(r.intel).toContain('gate:light:power');
    // Opening the adjacent real crate records exactly its observed contents (fuel_can, no keycard).
    const crate=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='light'&&e.c)!;
    placeAt(r,crate.tx,crate.ty+1);
    expect(dispatch(g,{id:'gp10r-loot-'+ ++serial,type:'observeLoot',eid:crate.id},START+7).ok).toBe(true);
    expect(r.intel).toContain('loot:light:fuel_can');
    expect(r.intel!.some(k=>k.includes('keycard'))).toBe(false);
  });

  it('survives save/reload and updates the preparation note when the required item is carried', () => {
    const {g,r}=fresh();
    r.intel=['gate:light:power','loot:light:fuel_can','opened:light'];
    const before=expeditionNotes(r);
    expect(before).toHaveLength(1);
    expect(before[0].gates[0]).toMatchObject({item:'fuel_can',carried:false,sources:['light']});
    const back=copy(g).run!;
    expect(back.intel).toEqual(r.intel);
    addItem(back,'inv','fuel_can',1);
    expect(expeditionNotes(back)[0].gates[0].carried).toBe(true);
  });

  it('rejects malformed intel and starts clean on a new run', () => {
    expect(validIntel(['gate:light:power','loot:factory:keycard'])).toBe(true);
    expect(validIntel(['gate:light:open-sesame'])).toBe(false);
    expect(validIntel(['loot:light:<b>'])).toBe(false);
    expect(validIntel(['gate:light:power','gate:light:power'])).toBe(false);
    const {r}=fresh();
    expect(r.intel).toEqual([]);
  });
});
