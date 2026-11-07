// Controlled fixture: the CURRENT unprovisioned survival law. Real settle(), real death, real bag, real respawn.
// Thirst/hunger are not suspended and shelter is not made immune. This test documents the baseline the
// provisioning mechanic must respect; it is not a natural-play acceptance.
import {describe,it,expect} from 'vitest';
import {TILE,T,WW,HOUR} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,markDirty,respawn} from '../src/game/engine';
import {getWorld} from '../src/game/world';
import {settle} from '../src/game/sim';

const T0=Date.UTC(2026,0,1);let serial=0;
function setup(){
  const gs=newGame();expect(dispatch(gs,{id:'sv-start'+ ++serial,type:'startRun',character:'female',seed:98},T0).ok).toBe(true);
  const r=gs.run!;r.creatures=[];const w=getWorld();let x=0,y=0;
  for(let yy=5;yy<190&&!x;yy++)for(let xx=5;xx<190;xx++){let ok=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=(yy+dy)*WW+xx+dx;if(w.economyMap.protected[i]||w.accessCorridors?.mask[i]||((w.packageContract||w.enforceMasks)&&!w.economyMap.buildable[i]))ok=false;}if(ok){x=xx;y=yy;break;}}
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const i=(y+dy)*WW+x+dx;r.terrain[i]={t:T.GRASS};if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};}
  r.player.x=(x)*TILE+8;r.player.y=(y)*TILE+8;markDirty();
  return {gs,r,x,y};
}
describe('unprovisioned survival baseline (controlled)',()=>{
  it('a player with no food or water dies offline with inventory in a real bag, and respawn does not return the bag contents',()=>{
    const o=setup();
    addItem(o.r,'inv','wood',25);addItem(o.r,'inv','stone',9);
    o.r.player.hunger=100;o.r.player.thirst=100;
    settle(o.gs,T0+30*HOUR,true);
    expect(o.r.player.dead).toBe(true);
    const bags=Object.values(o.r.entities).filter(e=>e.kind==='bag');
    expect(bags.length).toBeGreaterThan(0);
    const inBag=bags.reduce((n,b)=>n+countItem(o.r,b.c!,'wood'),0);
    expect(inBag).toBe(25);
    expect(countItem(o.r,'inv','wood')).toBe(0);
    expect(o.r.receipts.some(q=>q.kind==='death')).toBe(true);
    // Respawn restores a living player; the bag keeps its exact contents (no duplication, no free return).
    const res=respawn(o.gs,T0+30*HOUR);
    expect(res.ok).toBe(true);
    expect(o.r.player.dead).toBe(false);
    expect(bags.reduce((n,b)=>n+countItem(o.r,b.c!,'wood'),0)).toBe(25);
    expect(countItem(o.r,'inv','wood')).toBe(0);
  });
});
