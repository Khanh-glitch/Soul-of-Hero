// MEC-01 P2: loot-source-v2 contract, real consumer, physical access and save/reload.
// Fixture disclosure: fresh shipping_fresh runs via the real startRun intent. No POI, door, item or coordinate is added.
import {describe,it,expect} from 'vitest';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,blockedAt,lootSiteAccess,renewableStock,lootCooldown,markDirty} from '../src/game/engine';
import {lootGrammarRoll,lootRoll,LOOT_B05_TOOLBOX_GRADE,lootSlots,LOOT_GRAMMAR_CURRENT} from '../src/game/loot-ecology';
import {SHIPPING_LOOT_SOURCES,specForSite,lootSourceContractDigest,validLootSourceContract,lootSignature,expectedAccess} from '../src/game/loot-source-spec';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {TILE,type GameState,type RunState} from '../src/game/core';
import type {StaticEnt} from '../src/game/world';

const START=Date.UTC(2026,10,5);
let n=0;
function freshGame():GameState{setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'mec01p2-'+(++n),type:'startRun',character:'female',seed:101},START).ok).toBe(true);return g;}
const world=()=>getWorld('shipping_fresh');
function site(poi:string,item:string):StaticEnt{const s=world().statics.find(x=>x.kind==='loot'&&x.poi===poi&&x.loot?.some(([k])=>k===item));if(!s)throw new Error('no authored site '+poi+' '+item);return s;}
const SPEC=(id:string)=>SHIPPING_LOOT_SOURCES.find(s=>s.id===id)!;

describe('identity: authored sourceId + poi + full loot signature, never item presence alone', () => {
  it('each spec signature matches exactly one authored shipping cache', () => {
    for (const spec of SHIPPING_LOOT_SOURCES) {
      const hits=world().statics.filter(s=>s.kind==='loot'&&s.poi===spec.match.poi&&lootSignature(s.loot)===spec.match.signature);
      expect(hits, spec.id).toHaveLength(1);
    }
  });
  it('a same-POI cache that merely contains the item is NOT the spec source (identity is the full signature)', () => {
    const decoy:StaticEnt={kind:'loot',tx:0,ty:0,poi:'factory',loot:[['iron_sword',1]]} as any;
    expect(specForSite(decoy)).toBeNull();
    expect(specForSite(site('factory','iron_sword'))?.id).toBe('factory-exterior-industrial');
  });
  it('the factory exterior cache and the Foundry ore cache are distinct sources (same POI, different identity)', () => {
    expect(specForSite(site('factory','iron_ore' as any))).toBeNull();
  });
});

describe('physical access is measured from the real collision grid, not from metadata', () => {
  it('open caches are reachable from spawn without opening a door; the vault is sealed by its keycard door', () => {
    const g=freshGame();const r=g.run!;const c=r.lootEcology!.sourceContract!;
    expect(validLootSourceContract(c)).toBe(true);
    expect(c.sites['shipping.factory.exterior.industrial-toolbox'].access).toBe('open');
    expect(c.sites['shipping.tp.bow-cache.standard-toolbox'].access).toBe('open');
    expect(c.sites['shipping.factory.vault.advanced-keycard'].access).toBe('door-required');
  });
  it('the vault door is a real collision block while closed, and the vault cache becomes reachable only once that door is opened', () => {
    const g=freshGame();const r=g.run!;
    const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.locked==='keycard')!;
    expect(door).toBeTruthy();
    expect(blockedAt(r,door.tx!,door.ty!)).toBe(true);
    expect(lootSiteAccess(r,site('factory_vault','core_fire'))).toBe('door-required');
    door.open=true;markDirty(); // engine marks collision dirty on every door opening
    expect(lootSiteAccess(r,site('factory_vault','core_fire'))).toBe('open');
  });
});

describe('fail closed: contract tampering and sealed sources roll nothing', () => {
  it('a digest mismatch (edited spec) stops every grammar roll for specified sources', () => {
    const g=freshGame();const r=g.run!;
    expect(lootGrammarRoll(r,site('factory','iron_sword'),1).length).toBeGreaterThan(0);
    r.lootEcology!.sourceContract!.digest='deadbeef';
    expect(validLootSourceContract(r.lootEcology!.sourceContract)).toBe(false);
    expect(lootGrammarRoll(r,site('factory','iron_sword'),1)).toEqual([]);
  });
  it('a run without a recorded contract rolls nothing for specified sources', () => {
    const g=freshGame();const r=g.run!;delete (r.lootEcology as any).sourceContract;
    expect(lootGrammarRoll(r,site('tp','blueprint:bow'),1)).toEqual([]);
  });
  it('the sealed vault never rolls grammar stock (gated is contract metadata, not access)', () => {
    const g=freshGame();const r=g.run!;
    for (let c=0;c<5;c++) expect(lootGrammarRoll(r,site('factory_vault','core_fire'),c)).toEqual([]);
    expect(expectedAccess(SPEC('factory-vault-advanced'))).toBe('door-required');
  });
});

describe('stock, capacity, cooldown, and unique-item exclusion', () => {
  it('renewable toolbox sources roll per cycle within capacity; finite sources never renew', () => {
    const g=freshGame();const r=g.run!;const fx=site('factory','iron_sword');
    for (let c=1;c<=12;c++) {
      const out=lootGrammarRoll(r,fx,c);
      expect(out.length, `cycle ${c}`).toBeLessThanOrEqual(SPEC('factory-exterior-industrial').capacity);
      expect(out.map(([k])=>k)).toEqual(expect.arrayContaining(['refined_iron_ingot','mechanical_gear']));
    }
    // finite: the B05 grammar pool never renews; the pinned W06 class renewal is unchanged (vault still renews its W06 stock).
    const vault=site('factory_vault','core_fire');
    const grammarKeys=['refined_iron_ingot','mechanical_gear','metal_pipe','iron_plate','fasteners','scrap'];
    expect(renewableStock(r,vault,1).some(([k])=>grammarKeys.includes(k))).toBe(false);
    expect(renewableStock(r,fx,1).some(([k])=>k==='mechanical_gear')).toBe(true);
  });
  it('cooldown comes from the versioned spec (24 h toolbox)', () => {
    const g=freshGame();expect(lootCooldown(site('factory','iron_sword'),g.run!)).toBe(24*3600*1000);
  });
  it('no grammar pool ever emits a unique or fuel/energy special item', () => {
    const g=freshGame();const r=g.run!;
    const bad=new Set(['rcash','blueprint','keycard','damaged_drive','energy_basic','energy_refined','core_blast','core_earthmother','iron_pick','iron_axe','iron_sword']);
    for (const poi of ['factory','tp'] as const) for (let c=0;c<40;c++) for (const [k] of lootGrammarRoll(r,site(poi,poi==='factory'?'iron_sword':'blueprint:bow'),c)) expect(bad.has(k)).toBe(false);
  });
  it('the grade pools are the only source of the high-grade items (digest pins the table, not a free text)', () => {
    expect(LOOT_B05_TOOLBOX_GRADE.high.fixed.map(([k])=>k)).toEqual(['refined_iron_ingot','mechanical_gear']);
    expect(lootSourceContractDigest()).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('save/reload: the recorded contract and drawn stock survive; withdrawals are never re-rolled', () => {
  it('a fresh b05 run round-trips with the same contract and the same stack UIDs', () => {
    const g=freshGame();const before=JSON.stringify(g.run!.custody);
    const back=selectSnapshots([serializeSnapshot(g),null]).gs!;
    expect(back).toBeTruthy();
    expect(back.run!.lootEcology!.grammar).toBe(LOOT_GRAMMAR_CURRENT);
    expect(validLootSourceContract(back.run!.lootEcology!.sourceContract)).toBe(true);
    expect(JSON.stringify(back.run!.custody)).toBe(before);
  });
  it('a tampered recorded contract is rejected at load (fail closed, not silently re-rolled)', () => {
    const g=freshGame();g.run!.lootEcology!.sourceContract!.digest='00000000';
    expect(() => serializeSnapshot(g)).toThrow('invalid game state');
  });
  it('partial withdrawal then reload: remaining stacks keep their UIDs and the cache is not re-rolled', () => {
    const g=freshGame();const r=g.run!;
    const crate=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&e.c&&r.custody[e.c]?.slots.some(s=>s?.key==='iron_sword'))!;
    const slots=r.custody[crate.c!].slots;
    const gi=slots.findIndex(s=>s?.key==='mechanical_gear');expect(gi).toBeGreaterThanOrEqual(0);
    r.creatures=[];r.player.x=crate.tx!*TILE+8;r.player.y=(crate.ty!+1)*TILE+8;
    const uid=slots[gi]!.uid;const remaining=slots.filter(Boolean).map(s=>s!.uid).sort();
    expect(dispatch(g,{id:'mec01p2-mv-'+(++n),type:'move',from:crate.c,fs:gi,to:'inv'} as any,START+5).ok).toBe(true);
    const back=selectSnapshots([serializeSnapshot(g),null]).gs!;
    const bc=back.run!.custody[crate.c!].slots;
    expect(bc.filter(Boolean).map(s=>s!.uid).sort()).toEqual(remaining.filter(u=>u!==uid));
    expect(back.run!.custody.inv.slots.some(s=>s?.uid===uid)).toBe(true);
    expect(lootSlots(back.run!)).toBe(12);
  });
});

describe('old-save compatibility: a b04-v1 run loads through the real save validator unchanged', () => {
  it('a b04 run has no sourceContract, keeps the B04 pinned roll, and round-trips through serialize/select', () => {
    const g=freshGame();const r=g.run!;
    // Rebuild the run as a b04 save: drop b05-only stacks so the container matches the B04 roll it would have had.
    r.lootEcology={version:'w06-v1',cycles:r.lootEcology!.cycles,grammar:'b04-v1'} as any;
    const w=world();
    for (const e of Object.values(r.entities)) {
      if (e.kind!=='loot'||!e.c) continue;
      const st=w.statics.find(s=>s.kind==='loot'&&s.tx===e.tx&&s.ty===e.ty)!;
      const allowed=new Map<string,number>();
      for (const [k,q] of [...(st.loot??[]),...lootRoll(r,st,0)]) allowed.set(k,(allowed.get(k)??0)+q);
      const slots=r.custody[e.c].slots;
      for (let i=0;i<slots.length;i++){const s=slots[i];if(!s)continue;const key=s.key==='blueprint'?`blueprint:${s.meta}`:s.key;const left=(allowed.get(key)??0)-s.qty;if(left<0){slots[i]=null;}else allowed.set(key,left);}
    }
    const text=serializeSnapshot(g);
    const back=selectSnapshots([text,null]).gs!;
    expect(back).toBeTruthy();
    expect(back.run!.lootEcology!.grammar).toBe('b04-v1');
    expect(back.run!.lootEcology!.sourceContract).toBeUndefined();
    const factory=world().statics.find(s=>s.kind==='loot'&&s.poi==='factory'&&s.loot?.some(([k])=>k==='iron_sword'))!;
    let rolled=0; for (let c=0;c<40;c++) { const drops = lootGrammarRoll(back.run!,factory,c).map(([k])=>k); rolled += drops.length; expect(drops).not.toContain('metal_blade'); } expect(rolled).toBeGreaterThan(0);               // precondition: rolls emitted; a silently-empty roll table proves nothing
  });
});
