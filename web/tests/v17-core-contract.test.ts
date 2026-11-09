import {afterEach,describe,expect,it} from 'vitest';
import {CREATOR_CORE_KEYS,creatorContractV1} from '../src/game/creator-contract';
import {CREATOR_LOOT_V1,creatorLootV1} from '../src/game/creator-loot';
import {RECIPES} from '../src/game/catalog';
import {getWorld,setActiveLayout} from '../src/game/world';
import {newGame,dispatch,C} from '../src/game/engine';
const T=Date.UTC(2026,10,5);afterEach(()=>setActiveLayout('shipping'));
describe('versioned Creator acquisition contracts',()=>{
 it('binds each guaranteed body to one real authored Shipping crate and its runtime recipe',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'v17-contract',type:'startRun',character:'female',seed:91},T).ok).toBe(true);const r=g.run!,w=getWorld();
  expect(CREATOR_CORE_KEYS).toHaveLength(7);expect(new Set(CREATOR_LOOT_V1.map(x=>x.id)).size).toBe(5);
  for(const key of CREATOR_CORE_KEYS){const c=creatorContractV1(key),recipe=RECIPES[key];expect(c.recipe.inputs).toEqual(recipe.ins);expect(c.recipe.seconds).toBe(recipe.secs);expect(c.essence).toBeTruthy();if(c.source.siteId){const sites=w.statics.filter(s=>creatorLootV1(s)===key);expect(sites).toHaveLength(1);const site=sites[0];const ents=Object.values(r.entities).filter(e=>e.kind==='loot'&&e.tx===site.tx&&e.ty===site.ty);expect(ents).toHaveLength(1);const stacks=C(r,ents[0].c!).slots.filter(s=>s?.key===key);expect(stacks).toHaveLength(1);expect(stacks[0]?.reserves?.signature).toBe(c.source.initialSignature);}else expect(recipe.base).toBe(true);}
 });
 it('does not advertise invented WMP site identities or unique rewards',()=>{setActiveLayout('shipping_fresh');const ctrl=getWorld();expect(ctrl.statics.filter(s=>creatorLootV1(s))).not.toHaveLength(0);setActiveLayout('wmp04r1-cinder-shore');const w=getWorld();expect(w.statics).toHaveLength(0);expect(w.statics.filter(s=>creatorLootV1(s))).toHaveLength(0);for(const k of CREATOR_CORE_KEYS)expect(creatorContractV1(k).wmpAccess).toBe('owner-contract-missing');});
});
