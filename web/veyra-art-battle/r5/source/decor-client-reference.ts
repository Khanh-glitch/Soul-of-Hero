import {makeUrbanHarborSprites,drawUrbanHarborDeckTile} from './c01-art';
/**
 * VEYRA05 DECOR & ARCHITECTURAL PROP CLIENT — draws biome decor, non-solid
 * POI landmark props (stone village well, street lanterns, astrolabe sundial,
 * forge anvil, ore cart, benches, harbour bollards), and reservation markers
 * through the live renderer's sanctioned compositor hook (`depthItems`).
 *
 * Pure visual storytelling only: solid=false, harvestable=false, zero gameplay
 * rewards or interactions invented.
 */
import * as comp from '../game/compositor';
import { T, TILE, WW, WH, VIEW_W, VIEW_H, hash2, type GameState, type RunState } from '../game/core';
import { mk, type Sprite } from '../game/art';
import { getWorld } from '../game/world';
import { isVeyra05Layout } from './scenes';
import { getWindowWorld } from './window';
import { cellAtGlobal } from './chunks';
import { decorKit } from './art-nature';
import { activeFloor } from './floors';
import {makeWaterfrontSprites,drawWaterfrontDeckTile} from './c04-art';

let state: GameState | null = null;
let enabled = true;
export function observeVeyraDecor(gs: GameState) { state = gs; }
export function setDecorEnabled(v: boolean) { enabled = v; }
export function decorEnabled() { return enabled; }

let LANDMARK_SPRITES: Record<string, Sprite> | null = null;
function landmarkSprites(): Record<string, Sprite> {
  if (LANDMARK_SPRITES) return LANDMARK_SPRITES;
  const well = mk(18, 22, g => {
    // Stone village well with timber A-frame roof & bucket
    g.fillStyle = '#5a5a64'; g.fillRect(2, 11, 14, 9);
    g.fillStyle = '#8a8a94'; g.fillRect(3, 12, 12, 4);
    g.fillStyle = '#24486e'; g.fillRect(5, 13, 8, 3); // water inside curb
    g.fillStyle = '#6a4426'; g.fillRect(3, 5, 2, 8); g.fillRect(13, 5, 2, 8); // posts
    g.fillStyle = '#9a6a3e'; g.fillRect(1, 3, 16, 3); g.fillStyle = '#c89a60'; g.fillRect(2, 2, 14, 2); // roof
    g.fillStyle = '#b0804a'; g.fillRect(7, 8, 4, 3); // bucket
  });
  const lantern = mk(10, 22, g => {
    g.fillStyle = '#3a3e46'; g.fillRect(3, 18, 4, 3); g.fillRect(4, 6, 2, 13);
    g.fillStyle = '#24262c'; g.fillRect(2, 2, 6, 5);
    g.fillStyle = '#ffe27a'; g.fillRect(3, 3, 4, 3);
    g.fillStyle = '#ffffff'; g.fillRect(4, 4, 2, 1);
  });
  const sundial = mk(16, 18, g => {
    g.fillStyle = '#6a6a74'; g.fillRect(2, 12, 12, 5);
    g.fillStyle = '#9a9aa4'; g.fillRect(4, 7, 8, 6);
    g.fillStyle = '#d4aa48'; g.fillRect(3, 5, 10, 3); // brass astrolabe dial
    g.fillStyle = '#ffe690'; g.fillRect(7, 2, 2, 4); // gnomon
  });
  const forge = mk(16, 16, g => {
    g.fillStyle = '#4a4e56'; g.fillRect(2, 6, 12, 8);
    g.fillStyle = '#2e3238'; g.fillRect(3, 8, 10, 4);
    g.fillStyle = '#8a94a0'; g.fillRect(1, 5, 14, 2); // anvil horn
    g.fillStyle = '#ff7a2a'; g.fillRect(11, 9, 3, 3); // glowing coal pan
  });
  const ore_cart = mk(18, 16, g => {
    g.fillStyle = '#5a3a22'; g.fillRect(1, 13, 16, 2); // rail tie
    g.fillStyle = '#4a4e56'; g.fillRect(2, 5, 14, 7);
    g.fillStyle = '#6e7480'; g.fillRect(3, 6, 12, 4);
    g.fillStyle = '#b87a4a'; g.fillRect(4, 3, 4, 3); g.fillRect(9, 4, 4, 2); // raw ore chunks
    g.fillStyle = '#22242a'; g.fillRect(4, 12, 3, 3); g.fillRect(11, 12, 3, 3);
  });
  const bench = mk(16, 12, g => {
    g.fillStyle = '#9a6a3e'; g.fillRect(2, 4, 12, 3);
    g.fillStyle = '#6a4426'; g.fillRect(3, 7, 2, 4); g.fillRect(11, 7, 2, 4);
  });
  const bollard = mk(10, 14, g => {
    g.fillStyle = '#6a4426'; g.fillRect(3, 4, 4, 9);
    g.fillStyle = '#9a6a3e'; g.fillRect(2, 3, 6, 2);
    g.fillStyle = '#c8b080'; g.fillRect(2, 8, 6, 2); // coiled mooring rope
  });
  const px = (w: number, h: number, fn: (g: CanvasRenderingContext2D) => void) => mk(w, h, g => fn(g));
  const bed = px(16, 18, g => { g.fillStyle = '#6a4426'; g.fillRect(2, 2, 12, 15); g.fillStyle = '#c8b48a'; g.fillRect(3, 5, 10, 11); g.fillStyle = '#e8dcc0'; g.fillRect(3, 3, 10, 4); g.fillStyle = '#8a4a4a'; g.fillRect(3, 10, 10, 6); });
  const table = px(18, 14, g => { g.fillStyle = '#8a5e36'; g.fillRect(1, 3, 16, 6); g.fillStyle = '#b0804a'; g.fillRect(1, 3, 16, 2); g.fillStyle = '#5a3a22'; g.fillRect(3, 9, 2, 4); g.fillRect(13, 9, 2, 4); });
  const shelf = px(16, 18, g => { g.fillStyle = '#6a4426'; g.fillRect(1, 1, 14, 16); g.fillStyle = '#9a6a3e'; for (let y = 4; y < 16; y += 5) g.fillRect(2, y, 12, 2); g.fillStyle = '#c8a060'; g.fillRect(4, 2, 2, 2); g.fillRect(9, 7, 3, 2); });
  const bookshelf = px(16, 20, g => { g.fillStyle = '#4a3020'; g.fillRect(1, 1, 14, 18); for (let y = 3; y < 18; y += 5) { g.fillStyle = '#7a5230'; g.fillRect(2, y + 3, 12, 1); for (let x = 2; x < 14; x += 2) { g.fillStyle = ['#8a3a3a', '#3a5a8a', '#7a6a2a', '#3a6a4a'][(x + y) % 4]; g.fillRect(x, y, 2, 3); } } });
  const barrel_stack = px(18, 16, g => { for (const [x, y] of [[1, 6], [9, 6], [5, 0]]) { g.fillStyle = '#7a5230'; g.fillRect(x, y, 8, 10); g.fillStyle = '#9a6a3e'; g.fillRect(x + 1, y + 1, 6, 8); g.fillStyle = '#4a3020'; g.fillRect(x, y + 3, 8, 1); g.fillRect(x, y + 7, 8, 1); } });
  const crate_stack = px(18, 16, g => { for (const [x, y] of [[1, 6], [9, 7], [4, 0]]) { g.fillStyle = '#8a5e36'; g.fillRect(x, y, 8, 8); g.fillStyle = '#b0804a'; g.fillRect(x + 1, y + 1, 6, 6); g.fillStyle = '#5a3a22'; g.fillRect(x, y + 4, 8, 1); } });
  const hearth = px(20, 16, g => { g.fillStyle = '#6e6a66'; g.fillRect(1, 4, 18, 11); g.fillStyle = '#3a3634'; g.fillRect(4, 7, 12, 8); g.fillStyle = '#ff7a2a'; g.fillRect(6, 11, 8, 3); g.fillStyle = '#ffd070'; g.fillRect(8, 12, 4, 2); });
  const furnace_big = px(24, 26, g => { g.fillStyle = '#4a4048'; g.fillRect(2, 2, 20, 23); g.fillStyle = '#6a5e66'; g.fillRect(4, 4, 16, 18); g.fillStyle = '#2a1a14'; g.fillRect(7, 12, 10, 9); g.fillStyle = '#ff6a1e'; g.fillRect(8, 15, 8, 6); g.fillStyle = '#ffe070'; g.fillRect(10, 18, 4, 3); g.fillStyle = '#3a3e46'; g.fillRect(9, 0, 6, 3); });
  const anvil = px(16, 12, g => { g.fillStyle = '#3a3e46'; g.fillRect(2, 3, 12, 4); g.fillRect(6, 7, 4, 4); g.fillStyle = '#6a7280'; g.fillRect(2, 3, 12, 1); g.fillRect(1, 4, 3, 2); });
  const desk = px(18, 14, g => { g.fillStyle = '#6a4426'; g.fillRect(1, 4, 16, 7); g.fillStyle = '#8a5e36'; g.fillRect(1, 4, 16, 2); g.fillStyle = '#e8e0c8'; g.fillRect(4, 2, 6, 3); });
  const safe = px(14, 16, g => { g.fillStyle = '#2e3238'; g.fillRect(1, 1, 12, 14); g.fillStyle = '#4a5058'; g.fillRect(2, 2, 10, 12); g.fillStyle = '#c8a060'; g.fillRect(6, 7, 3, 3); });
  const rubble = px(18, 12, g => { for (const [x, y, s] of [[2, 6, 4], [8, 4, 5], [13, 7, 3], [6, 8, 3]]) { g.fillStyle = '#6e6a66'; g.fillRect(x, y, s, s - 1); g.fillStyle = '#9a9690'; g.fillRect(x, y, s, 1); } });
  const bones = px(16, 10, g => { g.fillStyle = '#d8d0c0'; g.fillRect(2, 5, 9, 2); g.fillRect(3, 3, 2, 2); g.fillRect(11, 4, 3, 3); });
  const pipes = px(20, 14, g => { g.fillStyle = '#5a6268'; g.fillRect(0, 3, 20, 4); g.fillRect(0, 9, 20, 3); g.fillStyle = '#8a949c'; g.fillRect(0, 3, 20, 1); g.fillStyle = '#3a4046'; g.fillRect(6, 2, 2, 6); g.fillRect(14, 8, 2, 5); });
  const coal_pile = px(18, 12, g => { g.fillStyle = '#26262c'; g.beginPath(); g.moveTo(1, 11); g.lineTo(9, 2); g.lineTo(17, 11); g.closePath(); g.fill(); g.fillStyle = '#42424c'; g.fillRect(6, 7, 2, 2); g.fillRect(11, 8, 2, 2); });
  const ore_pile = px(18, 12, g => { g.fillStyle = '#7a4a32'; g.beginPath(); g.moveTo(1, 11); g.lineTo(9, 3); g.lineTo(17, 11); g.closePath(); g.fill(); g.fillStyle = '#b87a4a'; g.fillRect(7, 7, 3, 2); g.fillRect(11, 9, 2, 2); });
  const ingot_stack = px(18, 12, g => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) { g.fillStyle = '#8a949c'; g.fillRect(2 + j * 5 + i * 2, 8 - i * 3, 5, 3); g.fillStyle = '#c0cad2'; g.fillRect(2 + j * 5 + i * 2, 8 - i * 3, 5, 1); } });
  const chain_hoist = px(12, 24, g => { g.fillStyle = '#3a3e46'; g.fillRect(4, 0, 3, 16); g.fillStyle = '#6a7280'; for (let y = 0; y < 16; y += 3) g.fillRect(4, y, 3, 1); g.fillStyle = '#8a949c'; g.fillRect(2, 16, 7, 4); g.fillStyle = '#c8a060'; g.fillRect(4, 20, 3, 3); });
  const crane_controls = px(18, 16, g => { g.fillStyle = '#3a4046'; g.fillRect(1, 4, 16, 11); g.fillStyle = '#5a6268'; g.fillRect(2, 5, 14, 6); g.fillStyle = '#ffcf6e'; g.fillRect(4, 7, 3, 2); g.fillStyle = '#7aff6a'; g.fillRect(9, 7, 2, 2); g.fillStyle = '#c94a3a'; g.fillRect(13, 7, 2, 2); });
  const screen_mesh = px(18, 14, g => { g.fillStyle = '#4a5058'; g.fillRect(1, 2, 16, 10); g.fillStyle = '#8a949c'; for (let x = 2; x < 17; x += 3) g.fillRect(x, 3, 1, 8); for (let y = 3; y < 12; y += 3) g.fillRect(2, y, 14, 1); });
  const pump = px(18, 18, g => { g.fillStyle = '#3a4a52'; g.fillRect(2, 6, 14, 11); g.fillStyle = '#5a7480'; g.fillRect(3, 7, 12, 6); g.fillStyle = '#8a949c'; g.fillRect(7, 1, 4, 6); g.fillStyle = '#c8a060'; g.fillRect(5, 14, 8, 2); });
  const water_pool = px(20, 12, g => { g.fillStyle = '#24506e'; g.beginPath(); g.ellipse(10, 6, 9, 5, 0, 0, 6.3); g.fill(); g.fillStyle = '#4a90c0'; g.fillRect(5, 4, 6, 1); g.fillRect(11, 7, 4, 1); });
  const smoke_rack = px(18, 18, g => { g.fillStyle = '#6a4426'; g.fillRect(1, 2, 16, 2); g.fillStyle = '#8a5e36'; for (let x = 3; x < 16; x += 4) { g.fillRect(x, 4, 1, 6); g.fillStyle = '#a06a4a'; g.fillRect(x - 1, 9, 3, 5); g.fillStyle = '#8a5e36'; } });
  const net_rack = px(18, 16, g => { g.fillStyle = '#6a4426'; g.fillRect(1, 1, 2, 14); g.fillRect(15, 1, 2, 14); g.fillStyle = '#8a9a7a'; for (let x = 3; x < 15; x += 3) for (let y = 2; y < 14; y += 3) g.fillRect(x, y, 2, 1); });
  const boat_hull = px(26, 16, g => { g.fillStyle = '#5a3e2a'; g.beginPath(); g.moveTo(1, 8); g.quadraticCurveTo(13, 18, 25, 8); g.lineTo(23, 5); g.quadraticCurveTo(13, 12, 3, 5); g.closePath(); g.fill(); g.fillStyle = '#7a5a3a'; g.fillRect(6, 6, 14, 2); });
  const grain_sack = px(16, 14, g => { g.fillStyle = '#c8a878'; g.fillRect(2, 4, 12, 9); g.fillStyle = '#e0c898'; g.fillRect(3, 5, 10, 4); g.fillStyle = '#8a7048'; g.fillRect(5, 2, 6, 3); });
  const market_stall = px(24, 20, g => { g.fillStyle = '#8a5e36'; g.fillRect(1, 10, 22, 6); g.fillStyle = '#6a4426'; g.fillRect(2, 16, 2, 4); g.fillRect(20, 16, 2, 4); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c85a4a' : '#e8dcc0'; g.fillRect(1 + i * 4, 4, 4, 6); } g.fillStyle = '#c8a060'; g.fillRect(4, 11, 4, 3); g.fillStyle = '#7a9a4a'; g.fillRect(12, 11, 5, 3); });
  const lookout = px(16, 18, g => { g.fillStyle = '#6a4426'; g.fillRect(2, 14, 12, 3); g.fillStyle = '#8a5e36'; g.fillRect(3, 4, 2, 10); g.fillRect(11, 4, 2, 10); g.fillStyle = '#c8a060'; g.fillRect(2, 2, 12, 3); });
  const banner = px(12, 24, g => { g.fillStyle = '#5a3a22'; g.fillRect(5, 0, 2, 24); g.fillStyle = '#7a3a8a'; g.fillRect(1, 2, 10, 13); g.fillStyle = '#c8a0ff'; g.fillRect(4, 6, 4, 4); });
  const lectern = px(14, 18, g => { g.fillStyle = '#6a4426'; g.fillRect(5, 6, 4, 11); g.fillStyle = '#8a5e36'; g.fillRect(1, 2, 12, 5); g.fillStyle = '#e8e0c8'; g.fillRect(3, 3, 8, 3); });
  const orrery = px(18, 18, g => { g.fillStyle = '#6a6a74'; g.fillRect(7, 12, 4, 5); g.fillStyle = '#c8a060'; g.beginPath(); g.arc(9, 8, 6, 0, 6.3); g.stroke(); g.strokeStyle = '#c8a060'; g.beginPath(); g.arc(9, 8, 6, 0, 6.3); g.stroke(); g.fillStyle = '#ffe27a'; g.fillRect(8, 7, 3, 3); g.fillStyle = '#8ad0ff'; g.fillRect(14, 6, 2, 2); });
  const telescope = px(22, 18, g => { g.fillStyle = '#3a3e46'; g.fillRect(9, 10, 4, 7); g.save(); g.translate(11, 9); g.rotate(-0.5); g.fillStyle = '#6a7280'; g.fillRect(-9, -3, 18, 6); g.fillStyle = '#c8d0d8'; g.fillRect(6, -3, 3, 6); g.restore(); });
  const map_table = px(22, 16, g => { g.fillStyle = '#6a4426'; g.fillRect(1, 3, 20, 10); g.fillStyle = '#d8cfa8'; g.fillRect(2, 4, 18, 8); g.fillStyle = '#7a9a6a'; g.fillRect(4, 6, 6, 4); g.fillStyle = '#4a90c0'; g.fillRect(12, 5, 5, 5); });
  const cart_broken = px(22, 14, g => { g.fillStyle = '#6a4426'; g.fillRect(2, 4, 16, 6); g.fillStyle = '#8a5e36'; g.fillRect(3, 5, 14, 3); g.fillStyle = '#3a3e46'; g.beginPath(); g.arc(6, 11, 3, 0, 6.3); g.fill(); g.fillRect(15, 9, 4, 2); });
  const stair_up = px(16, 16, g => { g.fillStyle = '#4a3a2a'; g.fillRect(1, 1, 14, 14); for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#a08050' : '#c8a878'; g.fillRect(2, 12 - i * 3, 12, 3); } g.fillStyle = '#ffe27a'; g.fillRect(7, 1, 2, 4); g.fillRect(5, 3, 6, 1); }, );
  const stair_down = px(16, 16, g => { g.fillStyle = '#241c18'; g.fillRect(1, 1, 14, 14); for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#5a4a3a' : '#7a6450'; g.fillRect(2, 2 + i * 3, 12, 3); } g.fillStyle = '#8ad0ff'; g.fillRect(7, 11, 2, 4); g.fillRect(5, 12, 6, 1); });
  const rug = px(22, 16, g => { g.fillStyle = '#7a3a4a'; g.fillRect(1, 2, 20, 12); g.fillStyle = '#9a5a5a'; g.fillRect(3, 4, 16, 8); g.fillStyle = '#c8a060'; g.fillRect(5, 6, 12, 4); g.fillStyle = '#5a2a34'; for (let x = 1; x < 21; x += 2) { g.fillRect(x, 1, 1, 1); g.fillRect(x, 14, 1, 1); } });
  const floor_wear = px(16, 16, g => { g.fillStyle = 'rgba(30,22,16,0.20)'; g.fillRect(2, 6, 11, 5); g.fillStyle = 'rgba(255,240,210,0.07)'; g.fillRect(4, 3, 7, 2); }, );
  const pier_shadow = px(16, 12, g => { g.fillStyle = 'rgba(8,6,14,0.35)'; g.beginPath(); g.ellipse(8, 5, 7, 4, 0, 0, 6.3); g.fill(); });
  LANDMARK_SPRITES = { ...makeWaterfrontSprites(mk), ...makeUrbanHarborSprites(mk), rug, floor_wear, pier_shadow, well, lantern, sundial, forge, ore_cart, bench, bollard, bed, table, shelf, bookshelf, barrel_stack, crate_stack, hearth, furnace_big, anvil, desk, safe, rubble, bones, pipes, coal_pile, ore_pile, ingot_stack, chain_hoist, crane_controls, screen_mesh, pump, water_pool, smoke_rack, net_rack, boat_hull, grain_sack, market_stall, lookout, banner, lectern, orrery, telescope, map_table, cart_broken, stair_up, stair_down };
  return LANDMARK_SPRITES;
}

const featureCache = new Map<string, Uint8Array>();
function featureMap(layoutId: string): Uint8Array {
  let f = featureCache.get(layoutId); if (f) return f;
  const { win } = getWindowWorld(layoutId); f = new Uint8Array(WW * WH);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const c = cellAtGlobal(win.originTx + x, win.originTy + y);
    if (c) f[y * WW + x] = c.c.feature[c.i];
  }
  featureCache.set(layoutId, f);
  if (featureCache.size > 4) featureCache.delete(featureCache.keys().next().value!);
  return f;
}
let drawn = 0, lastFrameItems = 0;
export const decorStats = () => ({ drawnTotal: drawn, lastFrameItems, cachedWindows: featureCache.size });

function items(g: CanvasRenderingContext2D): comp.DepthItem[] {
  const r: RunState | null | undefined = state?.run;
  if (!enabled || !r || !r.layoutId || !isVeyra05Layout(r.layoutId)) return [];
  const w = getWorld(r.layoutId);
  const ww = getWindowWorld(r.layoutId);
  const feats = featureMap(r.layoutId);
  const kit = decorKit();
  const lmSprites = landmarkSprites();
  const m = g.getTransform(); const cx = -m.e, cy = -m.f;
  const vx0 = Math.max(0, Math.floor(cx / TILE) - 1), vx1 = Math.min(WW - 1, Math.floor((cx + VIEW_W) / TILE) + 1);
  const vy0 = Math.max(0, Math.floor(cy / TILE) - 1), vy1 = Math.min(WH - 1, Math.floor((cy + VIEW_H) / TILE) + 2);
  const occupied = new Set<number>();
  for (const e of Object.values(r.entities)) {
    if (e.tx !== undefined && e.ty !== undefined) occupied.add(e.ty * WW + e.tx);
    else occupied.add(Math.floor(e.y / TILE) * WW + Math.floor(e.x / TILE));
  }

  const out: comp.DepthItem[] = [];
  const vFloorNow = activeFloor(r);

  // Ground reservation outlines (e.g., MGP-D07 Beacon grounded helicopter reservation — outline only, no sprite)
  for (const res of ww.reservations) {
    const rx = res.x * TILE, ry = res.y * TILE, rw = res.w * TILE, rh = res.h * TILE;
    if (rx + rw < cx || rx > cx + VIEW_W || ry + rh < cy || ry > cy + VIEW_H) continue;
    out.push({
      y: ry - 2,
      f: () => {
        g.save();
        g.strokeStyle = 'rgba(255, 226, 122, 0.72)';
        g.lineWidth = 1;
        g.setLineDash([4, 3]);
        g.strokeRect(rx + 2.5, ry + 2.5, rw - 5, rh - 5);
        g.setLineDash([]);
        const mx = Math.round(rx + rw / 2), my = Math.round(ry + rh / 2);
        g.fillStyle = 'rgba(255, 226, 122, 0.45)';
        g.fillRect(mx - 6, my - 7, 2, 14);
        g.fillRect(mx + 4, my - 7, 2, 14);
        g.fillRect(mx - 4, my - 1, 8, 2);
        g.restore();
      },
    });
  }

  // ── authored multi-storey compound: props + stair markers for the ACTIVE storey only
  const vFloor = activeFloor(r);
  const layer = ww.floors.layers.get(vFloor);
  if (layer) {
    // Authored C04 piles, elevated galleries and ruined platforms. This is a
    // separate physical surface over GOLD water, not a geography rewrite.
    if (vFloor >= 0) {
      const deckCells = new Map<number,string>();
      for (const rr of layer.rooms) if (rr.open && rr.carve && /^po_(westbank|dpier|gullpier)\./.test(rr.id)) {
        for (const [ax,ay,aw,ah] of rr.rects) for(let dy=ay;dy<ay+ah;dy++) for(let dx=ax;dx<ax+aw;dx++) deckCells.set(dy*WW+dx,rr.id);
      }
      for (const [key,pid] of deckCells){
        const tx=key%WW,ty=(key/WW)|0;
        if(tx<vx0||tx>vx1||ty<vy0||ty>vy1||w.tiles[key]!==T.FLOOR)continue;
        const edgeMask=(deckCells.has((ty-1)*WW+tx)?0:1)|(deckCells.has((ty+1)*WW+tx)?0:2)|(deckCells.has(ty*WW+tx-1)?0:4)|(deckCells.has(ty*WW+tx+1)?0:8);
        out.push({y:ty*TILE-2,f:()=>{drawWaterfrontDeckTile(g,tx,ty,pid,edgeMask);drawn++;}});
      }
    }
    // C01 physically authored urban quays & elevated stone/wood skywalks.
    if (vFloor >= 0) {
      const urbanDecks = new Map<number,string>();
      for (const rr of layer.rooms) if (rr.open && rr.carve && /^po_(gulfhead|westmouth|saltharbor)\./.test(rr.id)) {
        for (const [ax,ay,aw,ah] of rr.rects) for (let yy=ay;yy<ay+ah;yy++) for (let xx=ax;xx<ax+aw;xx++) urbanDecks.set(yy*WW+xx,rr.id);
      }
      for (const [key,pid] of urbanDecks) {
        const tx=key%WW,ty=(key/WW)|0;
        if (tx<vx0||tx>vx1||ty<vy0||ty>vy1||w.tiles[key]!==T.FLOOR) continue;
        const edgeMask=(urbanDecks.has((ty-1)*WW+tx)?0:1)|(urbanDecks.has((ty+1)*WW+tx)?0:2)|(urbanDecks.has(ty*WW+tx-1)?0:4)|(urbanDecks.has(ty*WW+tx+1)?0:8);
        out.push({y:ty*TILE-2,f:()=>{drawUrbanHarborDeckTile(g,tx,ty,pid,edgeMask);drawn++;}});
      }
    }
    for (const p of layer.props) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const spr = lmSprites[p.kind]; if (!spr) continue;
      const X = p.x * TILE + 8 - (spr.width >> 1), Y = p.y * TILE + 15 - spr.height;
      const decal = p.kind === 'rug' || p.kind === 'floor_wear' || p.kind === 'pier_shadow';
      out.push({ y: decal ? p.y * TILE - 3 : p.y * TILE + 13, f: () => { g.drawImage(spr, X, decal ? p.y * TILE : Y); drawn++; } });
    }
    const ox = Math.round((r.sourceMap?.veyra?.originAu?.[0] ?? 0) / 0.5), oy = Math.round((r.sourceMap?.veyra?.originAu?.[1] ?? 0) / 0.5);
    for (const st of layer.stairs) {
      const here = st.from === vFloor ? [st.x, st.y] : [st.tx, st.ty];
      const up = st.from === vFloor ? st.to > vFloor : st.from > vFloor;
      const x = here[0] - ox, y = here[1] - oy;
      if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      const spr = up ? lmSprites.stair_up : lmSprites.stair_down;
      out.push({ y: y * TILE + 2, f: () => { g.drawImage(spr, x * TILE, y * TILE); drawn++; } });
    }
  }
  // Architectural POI landmarks (ground only)
  if (vFloorNow === 0)
  for (const lm of vFloorNow === 0 ? ww.landmarks : []) {
    if (lm.tx < vx0 || lm.tx > vx1 || lm.ty < vy0 || lm.ty > vy1) continue;
    const i = lm.ty * WW + lm.tx;
    if (occupied.has(i) || w.sourceV3[i]) continue;
    const spr = lmSprites[lm.kind];
    if (!spr) continue;
    const X = lm.tx * TILE + 8 - Math.floor(spr.width / 2);
    const Y = lm.ty * TILE + 15 - spr.height;
    out.push({ y: lm.ty * TILE + 12, f: () => { g.drawImage(spr, X, Y); drawn++; } });
  }

  if (vFloorNow === 0) for (let ty = vy0; ty <= vy1; ty++) for (let tx = vx0; tx <= vx1; tx++) {
    const i = ty * WW + tx, code = feats[i]; if (!code) continue;
    const t = w.tiles[i];
    if (t === T.FLOOR || t === T.PWALL || t === T.ROAD) continue;
    if (w.sourceV3[i] || occupied.has(i) || r.terrain[i]) continue;
    const a = kit.get(code); if (!a) continue;
    const v = a.variants[Math.floor(hash2(tx, ty, 0xdec0) * a.variants.length)];
    const jx = a.layer === 'object' ? Math.floor(hash2(tx, ty, 0xdec1) * 5) - 2 : 0;
    const X = tx * TILE + a.anchor[0] + jx, Y = ty * TILE + a.anchor[1] + (TILE - a.h);
    out.push({ y: a.layer === 'decal' ? ty * TILE - 1 : ty * TILE + TILE - 1, f: () => { g.drawImage(v, X, Y); drawn++; } });
  }
  lastFrameItems = out.length;
  return out;
}

// QA-only read-only inspection & path-finding helper (never mutates player coordinates or GameState)
function findWalkWaypoints(targetGlobalTx: number, targetGlobalTy: number): [number, number][] {
  const r = state?.run; if (!r) return [];
  const o = r.sourceMap?.veyra?.originAu || [0, 0];
  const ox = Math.round(o[0] / 0.5), oy = Math.round(o[1] / 0.5);
  const w = getWorld(r.layoutId || 'shipping');
  const sx = Math.floor(r.player.x / TILE), sy = Math.floor(r.player.y / TILE);
  const gx = Math.max(2, Math.min(WW - 3, targetGlobalTx - ox));
  const gy = Math.max(2, Math.min(WH - 3, targetGlobalTy - oy));
  const doorTiles = new Set<number>();
  for (const e2 of Object.values(r.entities)) if (e2.kind === 'door' && e2.tx !== undefined && e2.ty !== undefined && (((e2 as any).floor ?? 0) === ((r as any).veyraFloor ?? 0))) doorTiles.add(e2.ty * WW + e2.tx);
  for (const st of w.statics) if (st.kind === 'door') doorTiles.add(st.ty * WW + st.tx);
  const blocked = (tx: number, ty: number) => {
    const i = ty * WW + tx, t = w.tiles[i];
    if (doorTiles.has(i)) return false;
    if (t === T.DEEP || t === T.SHALLOW || t === T.RIVER || t === T.CLIFF || t === T.PWALL || t === T.LAVA) return true;
    if (w.sourceV3[i] && ['oak','pine','snowpine','palm','willow','deadtree','rock','iron','coalv','crystal','salt_shale','sulfur'].includes(w.sourceV3[i]!)) return true;
    return false;
  };
  const prev = new Int32Array(WW * WH).fill(-1), seen = new Uint8Array(WW * WH), q = new Int32Array(WW * WH);
  let h = 0, tail = 0; const start = sy * WW + sx, goal = gy * WW + gx;
  q[tail++] = start; seen[start] = 1;
  let best = start, bestD = Math.hypot(gx - sx, gy - sy);
  while (h < tail) {
    const cur = q[h++], x = cur % WW, y = (cur / WW) | 0;
    const d = Math.hypot(gx - x, gy - y); if (d < bestD) { best = cur; bestD = d; }
    if (cur === goal) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 2 || ny < 2 || nx >= WW - 2 || ny >= WH - 2) continue;
      const ni = ny * WW + nx;
      if (!seen[ni] && !blocked(nx, ny)) { seen[ni] = 1; prev[ni] = cur; q[tail++] = ni; }
    }
  }
  const out: [number, number][] = [];
  for (let cur = seen[goal] ? goal : best; cur !== -1 && cur !== start; cur = prev[cur]) {
    out.push([ox + (cur % WW), oy + ((cur / WW) | 0)]);
  }
  out.reverse();
  return out;
}
if (typeof window !== 'undefined') (window as any).__veyra05 = { setDecorEnabled, decorStats, findWalkWaypoints, streamStats: () => import('./chunks').then(m => m.streamStats()) };
if (import.meta.hot) comp.unregisterVfxClient('veyra05-decor');
comp.registerVfxClient({ id: 'veyra05-decor', depthItems: g => items(g) });