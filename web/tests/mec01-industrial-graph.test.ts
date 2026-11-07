// MEC-01 B: anchors the five SOH industrial benchmark chains to the live recipe registry, and checks PER-MATERIAL raw
// conservation: every recycler rule's outputs, fully expanded to raw materials, must not exceed the raw expansion of the
// craft that produced the item. Unit counts are not compared (they mix unlike materials).
// LI historical figures are reference only (see PR handoff); they are not balance inputs here.
import {describe,it,expect} from 'vitest';
import {RECIPES} from '../src/game/catalog';
import BAL from '../src/game/balance.v1.json';

const ins=(k:string)=>Object.fromEntries((RECIPES[k].ins as [string,number][]).map(([i,q])=>[i,q]));
type Vec=Record<string,number>;
const addTo=(a:Vec,b:Vec,m:number)=>{for(const[k,q]of Object.entries(b))a[k]=(a[k]??0)+q*m;return a;};
/** Recursive raw expansion. Items with no craft recipe are raw. Returns null on a cycle (fails the test). */
function rawOf(item:string,qty:number,depth=0):Vec|null{
  if(depth>12)return null;
  const rc=Object.values(RECIPES).find(x=>x.out===item&&!(x as any).alias) as any;
  if(!rc)return {[item]:qty};
  const v:Vec={};
  for(const[i,q]of rc.ins as [string,number][]){const r=rawOf(i,qty*q/rc.qty,depth+1);if(!r)return null;addTo(v,r,1);}
  return v;
}
// Salvage-only materials: produced by recycler rules but consumed by no craft in the registry. Designed salvage, not a loop.
const fmt=(n:number)=>String(Math.round(n*100)/100);
const SALVAGE_ONLY=new Set(['scrap','coal','damaged_drive']);
// Pinned open findings (balance owner, not changed here): non-salvage raw overflows that already exist in the tables.
const PINNED_OVERFLOWS=['recyclerV2.iron_pick.high.iron_ore:4>3'];

describe('MEC-01 five-chain SOH benchmark is anchored to the registry', () => {
  it('metal blade: 4 iron + 1 mechanical part at bench II', () => {
    expect(ins('metal_blade')).toEqual({iron_ingot:4,mechanical_parts:1}); expect(RECIPES.metal_blade.stationLevel).toBe(2);
  });
  it('metal pipe: 2 refined iron + 1 mechanical part at bench II', () => {
    expect(ins('metal_pipe')).toEqual({refined_iron_ingot:2,mechanical_parts:1}); expect(RECIPES.metal_pipe.stationLevel).toBe(2);
  });
  it('mechanical gear: 2 iron + 2 mechanical parts + 1 fastener at bench II', () => {
    expect(ins('mechanical_gear')).toEqual({iron_ingot:2,mechanical_parts:2,fasteners:1}); expect(RECIPES.mechanical_gear.stationLevel).toBe(2);
  });
  it('iron plate: 2 refined iron + 1 pipe + 1 mechanical part → 2 plates', () => {
    expect(ins('iron_plate')).toEqual({refined_iron_ingot:2,metal_pipe:1,mechanical_parts:1}); expect(RECIPES.iron_plate.qty).toBe(2);
  });
  it('utility frame: 3 iron + 2 mechanical parts + 2 spares at bench II', () => {
    expect(ins('vehicle_frame')).toEqual({iron_ingot:3,mechanical_parts:2,spares:2}); expect(RECIPES.vehicle_frame.stationLevel).toBe(2);
  });
});

describe('per-material raw conservation of recycler rules (no profitable recycle→recraft loop)', () => {
  it('every recycler output expands to raw materials that do not exceed the craft raw expansion, except salvage-only and pinned findings', () => {
    const found:string[]=[];
    for (const ver of ['recyclerV1','recyclerV2'] as const) {
      const rules=(BAL as any)[ver].rules as Record<string,Record<string,[string,number][]|undefined>>;
      for (const [item,rule] of Object.entries(rules)) {
        const base=rawOf(item,1);
        expect(base,`${item} craft expansion must be acyclic`).not.toBeNull();
        if (!Object.values(RECIPES).find(x=>x.out===item&&!(x as any).alias)) continue; // unrecoverable-by-craft (e.g. drive) covered by its own rule
        for (const tier of ['base','mid','high'] as const) {
          if (!rule[tier]) continue;
          const rec:Vec={};
          for (const [o,q] of rule[tier]!) { const r=rawOf(o,q); expect(r,`${item}.${tier} output ${o} acyclic`).not.toBeNull(); addTo(rec,r!,1); }
          for (const [m,q] of Object.entries(rec)) {
            if (SALVAGE_ONLY.has(m)) continue;
            if (q > (base![m]??0)+1e-9) found.push(`${ver}.${item}.${tier}.${m}:${fmt(q)}>${fmt(base![m]??0)}`);
          }
        }
      }
    }
    expect(found.sort()).toEqual([...PINNED_OVERFLOWS].sort());
  });
});
