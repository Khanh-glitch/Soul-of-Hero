import { getWorld } from '../../src/game/world';
import type { RuntimeMapPackage } from '../../src/game/map-package';
import { WW } from '../../src/game/core';
/** Loader integration fixture cloned from the shipping world, NOT a new playable
 * geography. The minimal metadata deliberately does not prove real POI routes. */
export function manifest():RuntimeMapPackage {
 const w=getWorld('shipping');const e=structuredClone(w.economyMap);e.id='loader_fixture';
 const a=(v:ArrayLike<number>)=>Array.from(v);Object.assign(e,{elevation:a(e.elevation),slope:a(e.slope),moisture:a(e.moisture),temperature:a(e.temperature),freshwater:a(e.freshwater),coast:a(e.coast),walkable:a(e.walkable),buildable:a(e.buildable),cargoPassable:a(e.cargoPassable),road:a(e.road),protected:a(e.protected),industrial:a(e.industrial)});
 let r=-1;for(let i=0;i<WW*WW-1;i++)if(i%WW<WW-1&&e.road[i]&&e.road[i+1]&&e.cargoPassable[i]&&e.cargoPassable[i+1]&&e.walkable[i]&&e.walkable[i+1]&&e.protected[i]&&e.protected[i+1]){r=i;break;}if(r<0)throw Error('no road');
 const cash=w.statics.find(s=>s.kind==='cash')!,vendor=w.statics.find(s=>s.kind==='vendor')!,evac=w.statics.find(s=>s.kind==='evac')!;const idx=(s:{tx:number,ty:number})=>s.ty*WW+s.tx;
 const build=Array.from({length:WW*WW},(_,i)=>i).find(i=>e.buildable[i]&&e.cargoPassable[i]&&!e.protected[i])!;
 return {schemaVersion:1,id:e.id,revision:e.revision,seed:e.seed,title:'Internal loader test',description:'Clone, not an authored alternate map',tiles:a(w.tiles),fresh:a(w.fresh),zone:a(w.zone),seaDist:a(w.seaDist),buildings:structuredClone(w.buildings),statics:structuredClone(w.statics),places:structuredClone(w.places),geometry:{economy:e,roads:[{id:'road-fragment',cells:[r,r+1],surface:'road',widthTiles:1,bridgeCells:[],cargoPassable:true}],pois:[{id:'fixture',kind:'other',footprint:[r,r+1],entrances:[r],rooms:[],doors:[],powerNodes:[],hazardCells:[],exteriorLootSites:[],interiorLootSites:[],retreatPaths:[[r,r+1]]}],criticalPaths:[[r,r+1]],buildSites:[{id:'test',cells:[build],loadingCells:[r]}],nonbossCashSites:[idx(cash)],vendorSites:[idx(vendor)],evacuationSites:[idx(evac)]}};
}
