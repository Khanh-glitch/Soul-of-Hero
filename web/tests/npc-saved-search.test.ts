import {it,expect} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {humanNavigation} from '../src/game/human-navigation';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

// Release gate: on a build which drops the search frontier, the next actor
// decision is delayed even on a straight unobstructed lane. No 24h replay or
// injected routing/checkpoint state required. Run with SOH_REQUIRE_NAV_PARITY=1.
it.skipIf(process.env.SOH_REQUIRE_NAV_PARITY!=='1')('a validated Continue finishes a pending physical search on the same work slice',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,nav=humanNavigation(r);const h=Object.values(r.humanWorld!.people).find(h=>h.floor===0&&[1,2,3].every(dx=>nav.free({tx:h.gx+dx,ty:h.gy,floor:0},h)))!;
 expect(h).toBeDefined();const target={tx:h.gx+3,ty:h.gy,floor:0};
 expect(nav.route(h,target,2)).toBeNull();expect(h.routeSearch).toMatchObject({status:'PENDING_SEARCH',expanded:2});
 const loaded=selectSnapshots([serializeSnapshot(gs)]);expect(loaded.bad).toEqual([]);const copy=loaded.gs!.run!,peer=copy.humanWorld!.people[h.actorId];expect(setActiveLayout(copy.layoutId!)).toBe(true);expect(peer.routeSearch).toEqual(h.routeSearch);
 const warm=nav.route(h,target,1),cold=humanNavigation(copy).route(peer,target,1);
 expect(warm).toEqual([1,2].map(dx=>({tx:h.gx+dx,ty:h.gy,floor:0})));expect(cold).toEqual(warm);expect(peer.routeSearch).toEqual(h.routeSearch);
});
