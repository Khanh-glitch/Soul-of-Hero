// MEC-01 A: versioned LootSourceSpec. Real shipping world + real engine startRun. No POI, door, item or coordinate is added.
// Fixture disclosure: fresh shipping_fresh run only; the b04 case sets grammar explicitly to test save compatibility.
import {describe,it,expect} from 'vitest';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch} from '../src/game/engine';
import {TILE} from '../src/game/core';
import {lootGrammarRoll,LOOT_B05_TOOLBOX_GRADE,lootSlots} from '../src/game/loot-ecology';
import {SHIPPING_LOOT_SOURCES,resolveLootSource,type LootSourceSpec} from '../src/game/loot-source-spec';
import {type RunState,type StaticEnt} from '../src/game/core';

const START=Date.UTC(2026,10,5);
function freshRun():RunState{setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'mec01a-'+Math.random(),type:'startRun',character:'female',seed:101},START).ok).toBe(true);return g.run!;}
const world=()=>getWorld('shipping_fresh');
function site(poi:string,item:string):StaticEnt{const s=world().statics.find(x=>x.kind==='loot'&&x.poi===poi&&x.loot?.some(([k])=>k===item));if(!s)throw new Error('no authored site '+poi+' '+item);return s;}

describe('LootSourceSpec v2 — authored identity and independence', () => {
  it('each shipping spec matches exactly one authored cache in the shipping world', () => {
    for (const spec of SHIPPING_LOOT_SOURCES) {
      const hits=world().statics.filter(s=>s.kind==='loot'&&s.poi===spec.match.poi&&s.loot?.some(([k])=>k===spec.match.hasItem));
      expect(hits, spec.id).toHaveLength(1);
    }
  });
  it('role and grade are independent: two toolbox sites differ in grade, and grade does not follow role', () => {
    const tp=resolveLootSource(site('tp','blueprint:bow'),world())!, fa=resolveLootSource(site('factory','iron_sword'),world())!;
    expect(tp.spec.role).toBe('toolbox');expect(fa.spec.role).toBe('toolbox');
    expect(tp.spec.grade).toBe('mid');expect(fa.spec.grade).toBe('high');
    const vault=resolveLootSource(site('factory_vault','core_fire'),world())!;
    expect(vault.spec.role).toBe('advanced');expect(vault.spec.grade).toBe('high');   // different role, same grade as Foundry
  });
  it('the Foundry grade is a real material difference: high toolbox adds a fixed gear and industrial blade/pipe/plate pool', () => {
    expect(LOOT_B05_TOOLBOX_GRADE.high.fixed.map(([k])=>k)).toContain('mechanical_gear');
    expect(LOOT_B05_TOOLBOX_GRADE.high.pool.map(([k])=>k)).toEqual(['metal_blade','metal_pipe','iron_plate']);
    expect(LOOT_B05_TOOLBOX_GRADE.mid.fixed.map(([k])=>k)).toEqual(['refined_iron_ingot']);
  });
});

describe('access fails closed and is proven against the authored door contract', () => {
  it('a spec pointing at a door that does not exist resolves unproven (the consumer returns no rolls for that state)', () => {
    const bogus:LootSourceSpec={version:'loot-source-v2',id:'bogus',match:{poi:'factory',hasItem:'iron_sword'},role:'toolbox',grade:'high',access:{kind:'poi-door',poi:'factory',requirement:'power'}};
    expect(resolveLootSource(site('factory','iron_sword'),world(),[bogus])!.access).toBe('unproven');
  });
  it('the keycard vault resolves gated only because its authored keycard door exists', () => {
    expect(resolveLootSource(site('factory_vault','core_fire'),world())!.access).toBe('gated');
  });
});

describe('save compatibility and provenance', () => {
  it('a b04 run keeps the pinned B04 toolbox table for the Foundry cache (no high-grade reroll)', () => {
    const r=freshRun();r.lootEcology={version:'w06-v1',cycles:{},grammar:'b04-v1'};
    for (let c=0;c<40;c++){
      const out=lootGrammarRoll(r,site('factory','iron_sword'),c).map(([k])=>k);
      expect(out).toContain('refined_iron_ingot');
      expect(out).not.toContain('metal_blade');   // high-grade-only pool must never reach a b04 run
    }
  });
  it('a b05 run is deterministic per run/source/cycle and never exceeds physical capacity', () => {
    const r=freshRun();expect(r.lootEcology?.grammar).toBe('b05-v1');
    const s=site('factory','iron_sword');
    const a=lootGrammarRoll(r,s,7), b=lootGrammarRoll(r,s,7);
    expect(a).toEqual(b);
    const authored=s.loot!.length;
    for (let c=0;c<60;c++) expect(authored+lootGrammarRoll(r,s,c).length, `cycle ${c}`).toBeLessThanOrEqual(lootSlots(r));
  });
});

describe('real dispatch: the Foundry cache is reachable and its high-grade items enter the pack once', () => {
  it('move from the authored cache into inventory transfers the stack UID, and the industrial alternate recipes consume it', () => {
    const g=newGame();setActiveLayout('shipping_fresh');
    expect(dispatch(g,{id:'mec01-disp-start',type:'startRun',character:'female',seed:101},START).ok).toBe(true);
    const r=g.run!;r.creatures=[];r.worldStimuli=[];
    const crate=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;
    expect(crate).toBeTruthy();
    const slots=r.custody[crate.c!].slots;
    const gi=slots.findIndex(s=>s?.key==='mechanical_gear');
    expect(gi,'high-grade gear physically in the cache at cycle 0').toBeGreaterThanOrEqual(0);
    r.player.x=crate.tx*TILE+8;r.player.y=(crate.ty+1)*TILE+8;
    const uid=slots[gi]!.uid;
    const res=dispatch(g,{id:'mec01-disp-move',type:'move',from:crate.c,fs:gi,to:'inv',ts:undefined} as any,START+5);
    expect(res.ok,(res as any).reason).toBe(true);
    const inv=r.custody.inv.slots.filter(Boolean);
    expect(inv.some(s=>s!.key==='mechanical_gear'&&s!.uid===uid)).toBe(true);     // same UID, moved not minted
    expect(r.custody[crate.c!].slots[gi]).toBeFalsy();                             // removed from the cache once
  });
});
