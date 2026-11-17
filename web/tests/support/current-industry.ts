import { expect } from 'vitest';
import { TILE, type Entity, type GameState } from '../../src/game/core';
import { RECIPES, STRUCTS } from '../../src/game/catalog';
import { buildReason, C, dispatch, markDirty, stepStations } from '../../src/game/engine';
import { selectSnapshots, serializeSnapshot } from '../../src/game/persist';

let seq = 0;
export const command = (g: GameState, type: string, data: object, at: number) =>
  dispatch(g, {id:`current-industry-${++seq}`, type, ...data}, at);
export function beside(g: GameState, tx: number, ty: number) {
  g.run!.player.x = tx * TILE + 8; g.run!.player.y = ty * TILE + 8; markDirty();
}
export const reload = (g: GameState) => selectSnapshots([serializeSnapshot(g)]).gs!;
/** Already-carried materials only. Never injects resources or knowledge. Position is a fixture. */
export function buildCarried(g: GameState, type: string, at: number): Entity {
  const r = g.run!, cx = r.player.x / TILE | 0, cy = r.player.y / TILE | 0;
  const item = STRUCTS[type].item;
  let packUid: string | undefined;
  if (item?.startsWith('deploy_')) {
    expect(command(g, 'craft', {recipe:item}, at)).toMatchObject({ok:true});
    packUid = C(r, 'inv').slots.find(s=>s?.key===item)!.uid;
  }
  for (let radius=1; radius<20; radius++) for(let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++) {
    if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
    const tx=cx+dx,ty=cy+dy;beside(g,tx-1,ty);
    if(buildReason(g,type,tx,ty))continue;
    expect(command(g,'build',{struct:type,tx,ty},at+1)).toMatchObject({ok:true});
    const e=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===tx&&e.ty===ty)!;
    if(packUid)expect(e.deployed?.uid).toBe(packUid);
    return e;
  }
  throw Error(`No legal ${type} site beside ${cx},${cy}`);
}
/** Real paid queue, one millisecond early refusal, reload of pending job, output UID collection. */
export function craftCollect(g: GameState, e: Entity, recipe: string, at: number) {
  const r=g.run!,rc=RECIPES[recipe];beside(g,e.tx!-1,e.ty!);
  expect(command(g,'craft',{eid:e.id,recipe},at),recipe).toMatchObject({ok:true});
  const ms=rc.secs*1000,out=e.station!.outC;
  stepStations(g,ms-1,at+ms-1);
  expect(C(r,out).slots.some(s=>s?.key===rc.out)).toBe(false);
  const copy=reload(g);
  expect(copy.run!.entities[e.id].station!.queue).toEqual(e.station!.queue);
  stepStations(g,1,at+ms);
  const slot=C(r,out).slots.findIndex(s=>s?.key===rc.out);expect(slot).toBeGreaterThanOrEqual(0);
  const uid=C(r,out).slots[slot]!.uid;
  expect(command(g,'move',{from:out,fs:slot,to:'inv'},at+ms+1)).toMatchObject({ok:true});
  return uid;
}
