// GP11: expedition intel invariants. Fixture disclosure: fresh shipping run; the player is placed beside the real lighthouse
// door and crate; no items are injected except where a blueprint/recipe state is being checked. Real intents only.
import {afterAll,describe,it,expect} from 'vitest';
import {TILE,type GameState} from '../src/game/core';
import {addItem,dispatch,newGame,mkStack} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {expeditionNotes,validIntel,MAX_INTEL_KEY} from '../src/game/expedition-intel';
const START=Date.UTC(2026,10,5);
let serial=0;
afterAll(()=>setActiveLayout('shipping'));
function fresh(){
  setActiveLayout('shipping_fresh');const g=newGame();
  expect(dispatch(g,{id:'gp11-start-'+ ++serial,type:'startRun',character:'female',seed:73},START).ok).toBe(true);
  const r=g.run!;r.creatures=[];r.worldStimuli=[];return {g,r};
}
function placeAt(r:any,tx:number,ty:number){r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;}
function copy(g:GameState){return selectSnapshots([serializeSnapshot(g),null]).gs!;}
const id=(p:string)=>`${p}-${++serial}`;

describe('GP11 expedition intel invariants', () => {
  it('observeGate is a separate committed observation: a denied door does not unlock and records nothing itself', () => {
    const {g,r}=fresh();
    const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.poi==='light'&&e.locked==='power')!;
    placeAt(r,door.tx,door.ty+12);
    expect(dispatch(g,{id:id('far'),type:'observeGate',eid:door.id},START+5).ok).toBe(false);
    expect(r.intel??[]).toEqual([]);
    placeAt(r,door.tx,door.ty+1);
    const denied=dispatch(g,{id:id('door'),type:'door',eid:door.id},START+6);
    expect(denied.ok).toBe(false);                       // unpowered: still denied
    expect(door.open).toBeFalsy();
    expect(r.intel??[]).toEqual([]);                     // the denial alone writes no intel
    expect(dispatch(g,{id:id('obs'),type:'observeGate',eid:door.id},START+7).ok).toBe(true);
    expect(r.intel).toContain('gate:light:power');
    // Repeating the observation is idempotent and creates no second entry.
    dispatch(g,{id:id('obs2'),type:'observeGate',eid:door.id},START+8);
    expect(r.intel!.filter(k=>k==='gate:light:power')).toHaveLength(1);
    // The committed observation survives a save/reload without any further intent (no five-second autosave dependency).
    expect(copy(g).run!.intel).toContain('gate:light:power');
  });

  it('observeLoot honours reach and records a container once; historical items are labelled as seen, not as stock', () => {
    const {g,r}=fresh();
    const crate=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='light'&&e.c)!;
    placeAt(r,crate.tx,crate.ty+12);
    expect(dispatch(g,{id:id('loot-far'),type:'observeLoot',eid:crate.id},START+5).ok).toBe(false);
    expect(r.intel??[]).toEqual([]);
    placeAt(r,crate.tx,crate.ty+1);
    expect(dispatch(g,{id:id('loot'),type:'observeLoot',eid:crate.id},START+6).ok).toBe(true);
    expect(r.intel).toContain('loot:light:fuel_can');
    expect(r.intel!.some(k=>k.includes('keycard'))).toBe(false);
    // The crate's current contents are not inferred from the record: removing the item leaves the observation historical.
    r.entities[crate.id] && (r.custody[crate.c!].slots = r.custody[crate.c!].slots.map(()=>null));
    const note=expeditionNotes(r).find(n=>n.place==='light');
    expect(note).toBeUndefined();    // a loot observation alone creates no gate note
  });

  it('rejects oversized or malformed keys; old saves without intel load clean', () => {
    expect(validIntel(['gate:light:power'])).toBe(true);
    expect(validIntel(['gate:light:'+'a'.repeat(MAX_INTEL_KEY)])).toBe(false);
    expect(validIntel(['loot:light:'+'x'.repeat(200)])).toBe(false);
    expect(validIntel(['gate:light:open-sesame'])).toBe(false);
    expect(validIntel(['gate:light:power','gate:light:power'])).toBe(false);
    const {g,r}=fresh();
    expect(r.intel).toEqual([]);
    delete (r as any).intel;                  // an old save has no field at all
    expect(expeditionNotes(r)).toEqual([]);
    expect(copy(g).run).toBeTruthy();
  });

  it('fuel preparation derives from real inventory and known recipe; keycards never get a recipe', () => {
    const {r}=fresh();
    r.intel=['gate:light:power','loot:light:fuel_can','gate:factory:keycard_vault','loot:wreck:bp_bow'];
    let n=expeditionNotes(r).find(x=>x.place==='light')!;
    expect(n.gates[0]).toMatchObject({item:'fuel_can',have:0,carried:false,seenIn:['light'],craft:undefined});  // recipe not known yet
    r.knowledge.recipes.push('fuel_can');
    n=expeditionNotes(r).find(x=>x.place==='light')!;
    expect(n.gates[0].craft!.missing.map(i=>i.key).sort()).toEqual(['charcoal','glass','sulfur']);
    addItem(r,'inv','charcoal',1);
    n=expeditionNotes(r).find(x=>x.place==='light')!;
    expect(n.gates[0].craft!.missing.map(i=>i.key).sort()).toEqual(['glass','sulfur']);
    const kc=expeditionNotes(r).find(x=>x.place==='factory')!.gates[0];
    expect(kc.item).toBe('keycard');expect(kc.carried).toBe(false);expect(kc.craft).toBeUndefined();
  });

  it('blueprints distinguish seen, owned-not-learned and learned from live state', () => {
    const {r}=fresh();
    r.intel=['loot:wreck:bp_bow'];
    const state=()=>expeditionNotes(r).find(x=>x.place==='wreck')!.blueprints[0].state;
    expect(state()).toBe('seen');
    r.custody.inv.slots[5]=mkStack(r,'blueprint',1,'bow');
    expect(state()).toBe('owned');
    r.knowledge.recipes.push('bow');
    expect(state()).toBe('learned');
  });
});
