// PA1 DEPLOY custody: the readiness projection the UI renders and the transaction the engine
// commits must agree for EVERY packed device, not just for the one example a reviewer tries by hand.
//
// The split this pins: BUILDING = 15 wooden shapes, paid in materials, never an inventory item
// (covered by pa1-building-ontology.test.ts). DEPLOY = crafted devices whose placement SPENDS the
// packed item; the material list was already paid at the bench and must not be demanded twice.
import {afterAll,describe,it,expect} from 'vitest';
import {TILE,T,WW,type GameState} from '../src/game/core';
import {DEPLOYABLE_TYPES,ITEMS,STRUCTS} from '../src/game/catalog';
import {newGame,dispatch,addItem,C,buildReason,markDirty,countItem} from '../src/game/engine';
import {getWorld,getActiveLayout,setActiveLayout} from '../src/game/world';
import {structurePreparation} from '../src/game/action-readiness';

const T0=Date.UTC(2026,10,13,9);let serial=0;
const act=(g:GameState,type:string,p:object={})=>dispatch(g,{id:'pdc-'+ ++serial,type,...p},Math.max(T0,g.run?.clock.lastSimAt??T0));

/** A cleared 9x9 yard far from protected ground, so tile legality never masks the custody rule. */
function setup(){
  setActiveLayout('shipping');
  const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:1717}).ok).toBe(true);
  const r=g.run!,w=getWorld(),avoid=w.accessCorridors?.mask;
  r.creatures=[];
  let xx=0,yy=0;
  outer:for(let y=8;y<185;y++)for(let x=8;x<185;x++){
    let ok=true;
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const i=(y+dy)*WW+x+dx;
      if(w.economyMap.protected[i]||avoid?.[i]||(w.enforceMasks&&!w.economyMap.buildable[i]))ok=false;
    }
    if(ok){xx=x;yy=y;break outer;}
  }
  expect(xx).toBeGreaterThan(0);
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const i=(yy+dy)*WW+xx+dx;
    r.terrain[i]={t:T.GRASS};
    if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};
  }
  r.player.x=(xx-1)*TILE+8;r.player.y=(yy+1)*TILE+8;markDirty();
  return {g,r,x:xx,y:yy};
}
afterAll(()=>setActiveLayout('shipping'));

// Four devices carry a placement precondition this yard cannot satisfy, so they are named instead of
// quietly skipped: a cabinet needs an owned foundation, the Refinery and the Garden Tender need a
// level-2 Workbench in reach, and an oil pump needs a Map-authorized site. All four are still held to
// "ore is never charged at placement"; the other twenty are placed for real. The equality pins below
// mean a new precondition cannot hide, and a removed one forces this list to shrink.
const PRECONDITION_GATED=new Set(['claim','refinery','farm_controller']);
const SOURCE_GATED=new Set(['oil_pump']);
const GATED=(k:string)=>PRECONDITION_GATED.has(k)||SOURCE_GATED.has(k);

describe('PA1 device custody — every Deploy row states what placement really spends',()=>{
  it('declares exactly the device list this test walks, so a new device cannot dodge it',()=>{
    expect(DEPLOYABLE_TYPES.length).toBe(24);
    for(const k of DEPLOYABLE_TYPES){
      const d=STRUCTS[k];
      expect(typeof d.item,'structure '+k+' must name its pack').toBe('string');
      expect(d.item).toBe('deploy_'+k);
    }
  });
  it('for every device: raw materials alone never read as prepared, and the engine refuses too',()=>{
    const o=setup();const r=o.r;
    for(const k of DEPLOYABLE_TYPES){
      const d=STRUCTS[k];
      for(const [i,n] of d.cost) addItem(r,'inv',i,n);           // pay the material list, hold no pack
      const prep=structurePreparation(r,k);
      expect(prep.pack?.key,k+' must project a pack requirement').toBe('deploy_'+k);
      expect(prep.materials,k+' must not claim readiness from ore alone').toBe(false);
      if(SOURCE_GATED.has(k)) expect(prep.next,k+' source gating outranks custody').toMatch(/authorized oil site/);
      else expect(prep.next,k+' must name the packed device the player still needs').toMatch(/packed/i);
      // The engine's own placement cost for a device is the PACK. If it ever listed raw ore here,
      // the projection and the transaction would disagree and the material list would be charged twice.
      const reasons=new Set<string>();
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) reasons.add((buildReason(o.g,k,o.x+dx,o.y+dy)??'').trim());
      for(const x of reasons) expect(/Missing materials/.test(x),k+' must not be charged ore at placement: '+x).toBe(false);
      if(!GATED(k)) expect(reasons.has('Need an intact packed device.'),k+' engine refusal must match the projection').toBe(true);
      for(const [i] of d.cost){const s=C(r,'inv').slots;const j=s.findIndex(x=>x?.key===i);if(j>=0&&--s[j]!.qty<=0)s[j]=null;}
    }
  });
  it('for every device: an intact pack flips the projection green and placement spends only the pack',()=>{
    const o=setup();const r=o.r;
    let proven=0;const sourceGated:string[]=[];const preconditionGated:string[]=[];const used=new Set<string>();
    for(const k of DEPLOYABLE_TYPES){
      const d=STRUCTS[k],pack=d.item!;
      if(SOURCE_GATED.has(k)){
        // Source gating outranks custody, and it must say so rather than pretending the pack is enough.
        addItem(r,'inv',pack,1);
        const p=structurePreparation(r,k);
        expect(p.sourceBlocked,k).toBe(true);
        expect(p.materials,k).toBe(false);
        expect(p.next,k).toMatch(/authorized oil site/);
        sourceGated.push(k);
        continue;
      }
      addItem(r,'inv',pack,1);
      const slot=C(r,'inv').slots.findIndex(s=>s?.key===pack);
      r.custody.inv.slots[slot]!.dur=d.hp;                        // an intact, single-unit pack
      const prep=structurePreparation(r,k);
      expect(prep.materials,k+' must read prepared with an intact pack').toBe(true);
      expect(prep.pack?.carried,k).toBe(1);
      // Find a fresh tile where nothing but custody blocks, then prove the pack is the only payment.
      // Each device keeps its own tile: the yard is shared and a placed device would read as 'Tile occupied.'
      if(PRECONDITION_GATED.has(k)){
        // Pack in hand, precondition unmet: the projection must stay honest about BOTH, and never
        // imply that holding the pack alone is enough to place here.
        expect(structurePreparation(r,k).materials,k+' may read prepared; placement still needs its site').toBe(true);
        let anyLegal=false;
        for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++) if(!buildReason(o.g,k,o.x+dx,o.y+dy)) anyLegal=true;
        expect(anyLegal,k+' must be blocked everywhere in the yard: '+k).toBe(false);
        preconditionGated.push(k);
        continue;
      }
      let tile:{dx:number,dy:number}|null=null;
      outer:for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        if(used.has(o.x+dx+','+(o.y+dy)))continue;
        if(!buildReason(o.g,k,o.x+dx,o.y+dy)){tile={dx,dy};break outer;}
      }
      if(!tile){sourceGated.push(k);continue;}                     // e.g. oil_pump needs an authorized site
      const before={pack:countItem(r,'inv',pack),mats:d.cost.map(([i])=>countItem(r,'inv',i))};
      const res=act(o.g,'build',{struct:k,tx:o.x+tile.dx,ty:o.y+tile.dy});
      expect(res.ok,k+' placement of an armed pack must succeed: '+res.msg).toBe(true);
      used.add((o.x+tile.dx)+','+(o.y+tile.dy));
      expect(countItem(r,'inv',pack),k+' placement must consume the pack').toBe(before.pack-1);
      expect(d.cost.map(([i])=>countItem(r,'inv',i)),k+' placement must not re-pay materials').toEqual(before.mats);
      proven++;
    }
    expect(proven+sourceGated.length+preconditionGated.length).toBe(DEPLOYABLE_TYPES.length);
    expect(proven,'every ungated device must be placed for real').toBe(DEPLOYABLE_TYPES.length-SOURCE_GATED.size-PRECONDITION_GATED.size);
    expect(sourceGated.sort().join(',')).toBe([...SOURCE_GATED].sort().join(','));
    expect(preconditionGated.sort().join(',')).toBe([...PRECONDITION_GATED].sort().join(','));
  });
  it('a spent-down pack reads as blocked and asks for a repair, and the engine refuses it too',()=>{
    const o=setup();const r=o.r;const k='chest_small';
    addItem(r,'inv','wood',8);
    expect(act(o.g,'craft',{recipe:'deploy_chest_small'}).ok).toBe(true);
    const slot=C(r,'inv').slots.findIndex(s=>s?.key==='deploy_chest_small');
    r.custody.inv.slots[slot]!.dur=0;
    const prep=structurePreparation(r,k);
    expect(prep.materials).toBe(false);
    expect(prep.next).toMatch(/damaged/);
    expect(buildReason(o.g,k,o.x,o.y)).toBe('Need an intact packed device.');
  });
});
