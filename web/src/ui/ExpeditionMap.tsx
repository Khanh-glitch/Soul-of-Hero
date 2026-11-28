import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, TILE, WW, WH, type RunState } from '../game/core';
import { getMapCanvas } from '../game/render';
import { getWorld, ZONES } from '../game/world';
import { effTile, runHours, territoryForecast, cartWeight, cartLimit } from '../game/engine';
import { ITEMS } from '../game/catalog';
import { spiritDestination } from '../game/sim';
import { deathBagView } from '../game/death-view';
import { expeditionNotes, type PlaceNote } from '../game/expedition-intel';
import { displayZone } from './hud';
import { addFieldMark, discoveredCell, readFieldMarks, storeFieldMarks, type FieldMark, type MarkKind } from '../game/map-notes';
import { Panel, Icon, type Api } from './common';
import { isVeyra05Layout } from '../veyra05/scenes';
import { windowOrigin, playerGlobalAu } from '../veyra05/continuity';
import { activeFloor, onActiveFloor } from '../veyra05/floors';
import { GOLD } from '../veyra05/reader';
import { FRAME_W, FRAME_H } from '../veyra05/frame';
import {
  atlasPlaces, atlasPlace, placesByDistance, placeNear, playerGlobalTile, readDestination, storeDestination, formatDistance,
  bearing, isWaypointId, waypointId, GROUP_COLOR, type AtlasPlace, type PlaceGroup,
} from '../game/map-atlas';
import {
  VIEW_W, VIEW_H, FIT_S, SECTOR_S, ZOOM_STEP, fitCam, clampCam, toGlobal, zoomAt, panBy, isFit, wheelRatio, easeCam, reveal,
  scaleBar, rememberCam, recallCam, type Cam,
} from './atlas-camera';
import { veyraContinentTileColor, overviewSheet, detailSheet, OVERVIEW_W, OVERVIEW_H, DETAIL_TPP } from './atlas-sheet';

/** Unsurveyed ground on the sector views: the lie of the land in one flat tone per 4x4 cell, never what stands on it. */
const dimCache = new Map<string, string>();
function dimColor(hex: string, keep = 0.42): string {
  let out = dimCache.get(hex);
  if (!out) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number, base: number) => Math.round(base + (c - base) * keep);
    out = `rgb(${mix((n >> 16) & 255, 11)},${mix((n >> 8) & 255, 19)},${mix(n & 255, 25)})`;
    dimCache.set(hex, out);
  }
  return out;
}

const MARKS: { kind: MarkKind; label: string; sign: string; color: string }[] = [
  { kind: 'return', label: 'Return', sign: '◆', color: '#f2cf82' },
  { kind: 'materials', label: 'Materials', sign: '▣', color: '#80c7c2' },
  { kind: 'danger', label: 'Danger', sign: '×', color: '#e88369' },
  { kind: 'shelter', label: 'Shelter', sign: '■', color: '#a6d080' },
];

const CANVAS_W = 312;
const CANVAS_H = 260;
type LocalZoomLevel = 1 | 2 | 4;
type ZoomLevel = 0 | LocalZoomLevel;
const PX_PER_TILE: Record<LocalZoomLevel, number> = { 1: 1.3, 2: 3, 4: 6 };
const REGION_LABELS = (GOLD.project.labels as { text?: string; name?: string; at: [number, number]; style?: string }[])
  .filter(l => l.style === 'region' && (l.text ?? l.name) && (l.text ?? l.name) !== 'VEYRA')
  .map(l => ({ text: (l.text ?? l.name)!.toUpperCase(), gtx: l.at[0] * 2, gty: l.at[1] * 2 }));

/** A place mark: one shape per kind of place; hollow until the player has been there. */
function drawPlaceGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, group: PlaceGroup, visited: boolean, color: string) {
  const big = group === 'primordial';
  const small = group === 'road' || group === 'wild';
  const s = big ? 3 : small ? 1 : 2;
  const cells: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let dy = -s; dy <= s; dy++) for (let dx = -s; dx <= s; dx++) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let inShape: boolean, edge: boolean;
    if (group === 'harbour' || group === 'primordial') { inShape = ax + ay <= s; edge = ax + ay === s; }
    else if (group === 'works') { const half = Math.floor((dy + s) / 2); inShape = ax <= half; edge = ax === half || dy === s; }
    else if (group === 'ruin') { inShape = !(dx >= 1 && dy <= -1); edge = ax === s || ay === s || (dx === 0 && dy <= -1) || (dy === 0 && dx >= 1); }
    else if (group === 'science' || group === 'cache') { inShape = !(ax === s && ay === s); edge = ax === s || ay === s; }
    else { inShape = true; edge = ax === s || ay === s; }
    if (!inShape) continue;
    cells.push([dx, dy]);
    if (!edge) inner.push([dx, dy]);
  }
  ctx.fillStyle = '#05080b';
  for (const [dx, dy] of cells) ctx.fillRect(x + dx - 1, y + dy - 1, 3, 3);
  ctx.fillStyle = color;
  for (const [dx, dy] of cells) ctx.fillRect(x + dx, y + dy, 1, 1);
  if (!visited) {
    ctx.fillStyle = '#0b141a';
    for (const [dx, dy] of inner) ctx.fillRect(x + dx, y + dy, 1, 1);
  }
}

function drawPlate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = 'bold 9px monospace';
  const wTxt = Math.ceil(ctx.measureText(text).width) || text.length * 5;
  const px = Math.max(1, Math.min(CANVAS_W - wTxt - 5, x + 6));
  const py = Math.max(1, Math.min(CANVAS_H - 12, y - 5));
  ctx.fillStyle = 'rgba(5,8,11,0.88)';
  ctx.fillRect(px, py, wTxt + 4, 11);
  ctx.fillStyle = color;
  ctx.fillText(text, px + 2, py + 8);
}


const TILE_LABEL: Record<number, string> = {
  [T.GRASS]: 'Grassland', [T.MEADOW]: 'Meadow', [T.FOREST]: 'Forest', [T.SAND]: 'Coast / Sand',
  [T.SHALLOW]: 'Shallows', [T.DEEP]: 'Open Sea', [T.ROAD]: 'Road', [T.BRIDGE]: 'Bridge',
  [T.MARSH]: 'Marsh', [T.HILL]: 'Highland', [T.CLIFF]: 'Cliffside', [T.SNOW]: 'Snowfield',
  [T.ASH]: 'Ash / Cinder', [T.TOXIC]: 'Toxic Mire', [T.RIVER]: 'Fresh River', [T.LAVA]: 'Lava',
  [T.FLOOR]: 'Built Floor', [T.PWALL]: 'Built Wall', [T.BURNT]: 'Scorched Ground', [T.ICE]: 'Ice Sheet',
};

function bearingLabel(dx: number, dy: number): string {
  const d = Math.hypot(dx, dy);
  if (d < 2) return 'Here';
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const idx = Math.round(((a + 360) % 360) / 45) % 8;
  return `${Math.round(d)}t ${dirs[idx]}`;
}

/**
 * The continent overview marks only the player's own bag. Every 'bag' entity used to get the red mark, which put
 * a dot on each survivor store and corpse on the continent, charted or not: about 66 marks on a fresh run.
 */
export const isOwnBag = (e: { kind?: string; label?: string; owner?: unknown; parcel?: unknown }): boolean =>
  e.kind === 'bag' && e.label === 'Your bag' && !e.owner && !e.parcel;

function discoveredBounds(r: RunState): { minX: number; maxX: number; minY: number; maxY: number; pct: number } {
  let minX = WW, maxX = 0, minY = WH, maxY = 0, count = 0;
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      if (r.discovered[y * 50 + x]) {
        count++;
        minX = Math.min(minX, x * 4);
        maxX = Math.max(maxX, x * 4 + 3);
        minY = Math.min(minY, y * 4);
        maxY = Math.max(maxY, y * 4 + 3);
      }
    }
  }
  if (!count) {
    const ptx = Math.floor(r.player.x / TILE), pty = Math.floor(r.player.y / TILE);
    return { minX: Math.max(0, ptx - 8), maxX: Math.min(WW - 1, ptx + 8), minY: Math.max(0, pty - 8), maxY: Math.min(WH - 1, pty + 8), pct: 0 };
  }
  return { minX, maxX, minY, maxY, pct: Math.max(1, Math.round((count / 2500) * 100)) };
}

function clampCenter(cx: number, cy: number, zoom: ZoomLevel): { cx: number; cy: number } {
  if (zoom <= 1) return { cx: WW / 2, cy: WH / 2 };
  const px = PX_PER_TILE[zoom as LocalZoomLevel];
  const halfW = (CANVAS_W / px) / 2;
  const halfH = (CANVAS_H / px) / 2;
  return {
    cx: Math.max(halfW, Math.min(WW - halfW, cx)),
    cy: Math.max(halfH, Math.min(WH - halfH, cy)),
  };
}

function viewRect(cx: number, cy: number, zoom: LocalZoomLevel) {
  const px = PX_PER_TILE[zoom];
  const wTiles = CANVAS_W / px;
  const hTiles = CANVAS_H / px;
  if (zoom === 1) {
    const size = WW * px; // 260
    return { x0: 0, y0: 0, px, ox: Math.floor((CANVAS_W - size) / 2), oy: Math.floor((CANVAS_H - size) / 2), wTiles: WW, hTiles: WH };
  }
  return { x0: cx - wTiles / 2, y0: cy - hTiles / 2, px, ox: 0, oy: 0, wTiles, hTiles };
}

function screenToTile(mx: number, my: number, cx: number, cy: number, zoom: ZoomLevel, r?: RunState): { tx: number; ty: number; gtx?: number; gty?: number } {
  const v = viewRect(cx, cy, (zoom || 1) as LocalZoomLevel);
  const tx = Math.floor(v.x0 + (mx - v.ox) / v.px);
  const ty = Math.floor(v.y0 + (my - v.oy) / v.px);
  return { tx: Math.max(0, Math.min(WW - 1, tx)), ty: Math.max(0, Math.min(WH - 1, ty)) };
}

// ---------------------------------------------------------------------------
// The Veyra chart: one sheet under one camera (see atlas-camera.ts). At any scale it draws, bottom to top: the
// terrain sheets (dimmed where the player has not walked), the live picture of the sector on walked ground once the
// view is close enough, rivers and roads, region names, everything the player owns, every place mark, the
// destination, the player.
// ---------------------------------------------------------------------------
interface AtlasView {
  places: AtlasPlace[];
  hoverId: string | null;
  selectedId: string | null;
  /** The chosen destination: a named place or a spot marked by hand. */
  dest: AtlasPlace | null;
  marks: FieldMark[];
  selectedMarkId: string | null;
  cursor: { tx: number; ty: number } | null;
  hoverTile: { tx: number; ty: number } | null;
  teleportTarget?: { x: number; y: number } | null;
  markMode: boolean;
  intel: Map<string, PlaceNote>;
  onProgress?: () => void;
}

/** From this scale the detail terrain sheet is drawn over the overview. */
const DETAIL_FROM = FIT_S * 1.6;
/** From this scale walked ground shows the live picture of the sector instead of the terrain sheet. */
const LIVE_FROM = 0.5;
/** From this scale place names appear on their own, where there is room. */
const LABELS_FROM = 0.2;
/** From this scale a single tile can be picked out and inspected. */
const TILE_FROM = 0.9;
/** How close, in chart pixels, a click must land to a place mark. */
const HIT_PX = 9;

const NO_CELLS = new Int32Array(0);
const cellCache: { src: object | null; n: number; cells: Int32Array } = { src: null, n: -1, cells: NO_CELLS };
/** Walked 4x4 cells anywhere on the continent, as (cx, cy) pairs. Parsed again only when their number changes. */
function walkedCells(r: RunState): Int32Array {
  const src = r.veyraGlobalDiscovered as Record<string, unknown> | undefined;
  if (!src) return NO_CELLS;
  const keys = Object.keys(src);
  if (cellCache.src === src && cellCache.n === keys.length) return cellCache.cells;
  const out = new Int32Array(keys.length * 2);
  let n = 0;
  for (const k of keys) {
    const sep = k.indexOf(':');
    if (sep < 0) continue;
    const cx4 = Number(k.slice(0, sep)), cy4 = Number(k.slice(sep + 1));
    if (Number.isFinite(cx4) && Number.isFinite(cy4)) { out[n++] = cx4; out[n++] = cy4; }
  }
  cellCache.src = src; cellCache.n = keys.length; cellCache.cells = out.subarray(0, n);
  return cellCache.cells;
}

const textWidths = new Map<string, number>();
function plateBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): [number, number, number, number] {
  let wTxt = textWidths.get(text);
  if (wTxt === undefined) {
    ctx.font = 'bold 9px monospace';
    wTxt = Math.ceil(ctx.measureText(text).width) || text.length * 5;
    textWidths.set(text, wTxt);
  }
  return [Math.max(1, Math.min(VIEW_W - wTxt - 5, x + 6)), Math.max(1, Math.min(VIEW_H - 12, y - 5)), wTxt + 4, 11];
}
function fillPlate(ctx: CanvasRenderingContext2D, text: string, box: [number, number, number, number], color: string) {
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = 'rgba(5,8,11,0.88)';
  ctx.fillRect(box[0], box[1], box[2], box[3]);
  ctx.fillStyle = color;
  ctx.fillText(text, box[0] + 2, box[1] + 8);
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = '#05080b';
  for (let dy = -size - 1; dy <= size + 1; dy++) { const span = size + 1 - Math.abs(dy); ctx.fillRect(x - span, y + dy, span * 2 + 1, 1); }
  ctx.fillStyle = color;
  for (let dy = -size; dy <= size; dy++) { const span = size - Math.abs(dy); ctx.fillRect(x - span, y + dy, span * 2 + 1, 1); }
}

function renderAtlas(ctx: CanvasRenderingContext2D, r: RunState, cam: Cam, v: AtlasView) {
  const s = cam.s;
  const X = (g: number) => Math.round(VIEW_W / 2 + (g - cam.gx) * s);
  const Y = (g: number) => Math.round(VIEW_H / 2 + (g - cam.gy) * s);
  const gx0 = cam.gx - VIEW_W / (2 * s), gx1 = cam.gx + VIEW_W / (2 * s);
  const gy0 = cam.gy - VIEW_H / (2 * s), gy1 = cam.gy + VIEW_H / (2 * s);
  const onSheet = (x: number, y: number, pad = 10) => x >= -pad && y >= -pad && x <= VIEW_W + pad && y <= VIEW_H + pad;

  ctx.imageSmoothingEnabled = false;
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#091015';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const fx = X(0), fy = Y(0), fw = X(FRAME_W) - fx, fh = Y(FRAME_H) - fy;
  const [ox, oy] = windowOrigin(r);
  const wx = X(ox), wy = Y(oy), ww = X(ox + WW) - wx, wh = Y(oy + WH) - wy;
  const windowOnSheet = wx < VIEW_W && wy < VIEW_H && wx + ww > 0 && wy + wh > 0;
  const live = s >= LIVE_FROM;

  // Copy the part of a terrain sheet that is in view, snapped to whole sheet pixels so it never shimmers.
  const blit = (img: HTMLCanvasElement, tppX: number, tppY: number) => {
    const x0 = Math.max(0, Math.floor(gx0 / tppX)), x1 = Math.min(img.width, Math.ceil(gx1 / tppX));
    const y0 = Math.max(0, Math.floor(gy0 / tppY)), y1 = Math.min(img.height, Math.ceil(gy1 / tppY));
    if (x1 <= x0 || y1 <= y0) return;
    const dx0 = X(x0 * tppX), dy0 = Y(y0 * tppY);
    ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, dx0, dy0, X(x1 * tppX) - dx0, Y(y1 * tppY) - dy0);
  };
  const base = overviewSheet(v.onProgress);
  const closeUp = s > DETAIL_FROM;
  // Asked for at every scale so it is ready by the time the player zooms in.
  const det = detailSheet(closeUp ? v.onProgress : undefined, cam.gy);
  const terrain = () => {
    if (base) blit(base, FRAME_W / OVERVIEW_W, FRAME_H / OVERVIEW_H);
    if (det && closeUp) blit(det, DETAIL_TPP, DETAIL_TPP);
  };

  ctx.save();
  ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
  ctx.fillStyle = '#0c141b';
  ctx.fillRect(fx, fy, fw, fh);

  // The whole continent from the first minute: land, water and biome everywhere, dimmed where the player has not walked.
  terrain();
  if (base) { ctx.fillStyle = 'rgba(9, 16, 21, 0.4)'; ctx.fillRect(fx, fy, fw, fh); }
  // Below ground the sector shows that floor only: unwalked parts of it are blank, not the surface above.
  if (live && activeFloor(r) !== 0 && windowOnSheet) { ctx.fillStyle = '#0d161c'; ctx.fillRect(wx, wy, ww, wh); }

  // Walked ground at full strength. A cell is never thinner than one chart pixel, so a trail shows at any scale.
  if (base) {
    ctx.save();
    ctx.beginPath();
    const cell = (cx4: number, cy4: number) => {
      const gx = cx4 * 4, gy = cy4 * 4;
      if (gx + 4 < gx0 || gx > gx1 || gy + 4 < gy0 || gy > gy1) return;
      const x = X(gx), y = Y(gy);
      ctx.rect(x, y, Math.max(1, X(gx + 4) - x), Math.max(1, Y(gy + 4) - y));
    };
    const cells = walkedCells(r);
    for (let i = 0; i < cells.length; i += 2) cell(cells[i], cells[i + 1]);
    for (let cy4 = 0; cy4 < 50; cy4++) for (let cx4 = 0; cx4 < 50; cx4++) {
      if (r.discovered[cy4 * 50 + cx4]) cell((ox >> 2) + cx4, (oy >> 2) + cy4);
    }
    ctx.clip();
    terrain();
    ctx.restore();
  }

  // Close up, walked ground in the sector around the player shows what is really there: the live picture, tile by tile.
  if (live && windowOnSheet) {
    ctx.save();
    ctx.beginPath();
    let any = false;
    for (let cy4 = 0; cy4 < 50; cy4++) for (let cx4 = 0; cx4 < 50; cx4++) {
      if (!r.discovered[cy4 * 50 + cx4]) continue;
      const x = X(ox + cx4 * 4), y = Y(oy + cy4 * 4), x2 = X(ox + cx4 * 4 + 4), y2 = Y(oy + cy4 * 4 + 4);
      if (x2 < 0 || y2 < 0 || x > VIEW_W || y > VIEW_H) continue;
      ctx.rect(x, y, x2 - x, y2 - y);
      any = true;
    }
    if (any) {
      ctx.clip();
      ctx.drawImage(getMapCanvas(r), 0, 0, WW, WH, wx, wy, ww, wh);
      if (s >= 3) {
        for (const e of Object.values(r.entities)) {
          if (!onActiveFloor(r, e)) continue;
          if (e.kind !== 'struct' || e.poi || e.tx === undefined || e.ty === undefined) continue;
          if (!discoveredCell(r, e.tx, e.ty)) continue;
          const x = X(ox + e.tx), y = Y(oy + e.ty);
          if (!onSheet(x, y)) continue;
          ctx.fillStyle = e.type?.includes('wall') || e.type?.includes('door') ? '#d8c59e' : e.type?.includes('roof') ? '#7d634a' : '#4f5d66';
          ctx.fillRect(x, y, Math.max(2, X(ox + e.tx + 1) - x), Math.max(2, Y(oy + e.ty + 1) - y));
        }
      }
    }
    ctx.restore();
  }

  // Surveyor's grid, every 25 tiles, once tiles are large enough to count; every 5 tiles up close. It runs over the
  // whole continent, so a stretch of plain forest or open sea still shows how far the sheet has moved under the hand.
  if (s >= TILE_FROM) {
    const [g0x, g0y] = toGlobal(cam, 0, 0), [g1x, g1y] = toGlobal(cam, VIEW_W, VIEW_H);
    const x0 = Math.max(0, X(0)), x1 = Math.min(VIEW_W, X(FRAME_W)), y0 = Math.max(0, Y(0)), y1 = Math.min(VIEW_H, Y(FRAME_H));
    const rule = (step: number, alpha: number) => {
      ctx.fillStyle = `rgba(214, 196, 158, ${alpha})`;
      // lines sit on the sector's own grid (its corner is a grid corner)
      for (let g = ox + Math.ceil((g0x - ox) / step) * step; g <= g1x; g += step) if (g >= 0 && g <= FRAME_W) ctx.fillRect(X(g), y0, 1, y1 - y0);
      for (let g = oy + Math.ceil((g0y - oy) / step) * step; g <= g1y; g += step) if (g >= 0 && g <= FRAME_H) ctx.fillRect(x0, Y(g), x1 - x0, 1);
    };
    if (s >= 3) rule(5, 0.045);
    rule(25, 0.09);
  }

  // Rivers and roads from the authored centrelines (the sheets are too coarse to catch them by sampling).
  ctx.lineWidth = s >= 2 ? 2 : 1;
  const line = (pts: [number, number][], color: string, dash: number[] = []) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([ax, ay], i) => { const x = X(ax * 2) + 0.5, y = Y(ay * 2) + 0.5; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  };
  for (const rv of GOLD.project.rivers) line(rv.points, 'rgba(70, 136, 184, 0.75)');
  for (const rd of GOLD.project.roads) {
    if (rd.kind === 'ferry') line(rd.points, 'rgba(127, 216, 255, 0.4)', [1, 3]);
    else if (rd.kind === 'cart') line(rd.points, 'rgba(214, 190, 142, 0.6)');
    else line(rd.points, 'rgba(214, 190, 142, 0.38)', [2, 2]);
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  // Region names: they orient, the place marks carry the detail.
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  for (const l of REGION_LABELS) {
    const x = X(l.gtx), y = Y(l.gty);
    if (!onSheet(x, y, 60)) continue;
    ctx.fillStyle = 'rgba(5, 8, 11, 0.6)';
    for (const [hx, hy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(l.text, x + hx, y + hy);
    ctx.fillStyle = live ? 'rgba(240, 232, 208, 0.55)' : 'rgba(240, 232, 208, 0.82)';
    ctx.fillText(l.text, x, y);
  }
  ctx.textAlign = 'left';
  ctx.restore();

  ctx.strokeStyle = '#475962';
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
  // The sector the world is live in right now.
  ctx.strokeStyle = live ? 'rgba(244, 208, 137, 0.3)' : 'rgba(244, 208, 137, 0.78)';
  ctx.strokeRect(wx + 0.5, wy + 0.5, Math.max(4, ww), Math.max(4, wh));

  const dot = (gtx: number, gty: number, col: string, size = 3) => {
    const x = X(gtx), y = Y(gty);
    if (!onSheet(x, y)) return;
    ctx.fillStyle = '#05080b';
    ctx.fillRect(x - 1 - (size >> 1), y - 1 - (size >> 1), size + 2, size + 2);
    ctx.fillStyle = col;
    ctx.fillRect(x - (size >> 1), y - (size >> 1), size, size);
  };
  // Corners that carry something of their own (compass, scale bar, destination pill): names keep out of them.
  const occupied: [number, number, number, number][] = [[VIEW_W - 24, 0, 24, 24], [VIEW_W - 104, VIEW_H - 24, 104, 24]];
  if (v.dest && !v.teleportTarget) occupied.push([0, VIEW_H - 24, 176, 24]);
  const free = (b: [number, number, number, number]) => occupied.every(o => b[0] + b[2] <= o[0] || o[0] + o[2] <= b[0] || b[1] + b[3] <= o[1] || o[1] + o[3] <= b[1]);

  // What the player owns: cabinets, carts and vehicles, the bag left where they died.
  for (const e of Object.values(r.entities)) {
    if (!onActiveFloor(r, e)) continue;
    if (e.type === 'claim' && e.tx !== undefined && e.ty !== undefined) dot(ox + e.tx + 0.5, oy + e.ty + 0.5, territoryForecast(r, e).funded ? '#8fd45a' : '#e8b23c', 4);
    if (isOwnBag(e)) {
      dot(ox + e.x / TILE, oy + e.y / TILE, '#ff8e7a', 4);
      if (s >= TILE_FROM) { const b = plateBox(ctx, 'Death Bag', X(ox + e.x / TILE) + 2, Y(oy + e.y / TILE)); fillPlate(ctx, 'Death Bag', b, '#ff8e7a'); occupied.push(b); }
    }
    if ((e.kind === 'cart' || e.kind === 'vehicle') && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) dot(ox + e.x / TILE, oy + e.y / TILE, e.kind === 'cart' ? '#e8b36d' : '#7fd8ff', 3);
  }
  if (r.veyraOffscreenEntities) {
    for (const oe of Object.values(r.veyraOffscreenEntities)) {
      const gtx = oe.tx !== undefined ? oe.tx : oe.x / TILE;
      const gty = oe.ty !== undefined ? oe.ty : oe.y / TILE;
      if (oe.type === 'claim') dot(gtx, gty, '#8fd45a', 4);
      if (isOwnBag(oe)) dot(gtx, gty, '#ff8e7a', 3);
      if (oe.kind === 'cart' || oe.kind === 'vehicle') dot(gtx, gty, '#7fd8ff', 3);
    }
  }

  // The player's own notes.
  for (const m of v.marks) {
    if (!discoveredCell(r, m.tx, m.ty)) continue;
    const x = X(ox + m.tx + 0.5), y = Y(oy + m.ty + 0.5);
    if (!onSheet(x, y)) continue;
    const meta = MARKS.find(k => k.kind === m.kind)!;
    drawDiamond(ctx, x, y, 3, meta.color);
    const isSel = m.id === v.selectedMarkId;
    const isHover = !!v.hoverTile && Math.hypot(m.tx - v.hoverTile.tx, m.ty - v.hoverTile.ty) <= 1.5;
    if (isSel) { ctx.strokeStyle = '#fff3c4'; ctx.strokeRect(x - 6.5, y - 6.5, 13, 13); }
    if (m.label && (isSel || isHover)) { const b = plateBox(ctx, m.label, x + 2, y); fillPlate(ctx, m.label, b, meta.color); occupied.push(b); }
  }

  const [pgx, pgy] = playerGlobalTile(r);
  const dest = v.dest;
  if (dest) {
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.85)'; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(X(pgx) + 0.5, Y(pgy) + 0.5); ctx.lineTo(X(dest.gtx + 0.5) + 0.5, Y(dest.gty + 0.5) + 0.5); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Every place on the chart, the same size at every scale.
  const shown: { pl: AtlasPlace; x: number; y: number }[] = [];
  for (const pl of v.places) {
    const x = X(pl.gtx + 0.5), y = Y(pl.gty + 0.5);
    if (!onSheet(x, y)) continue;
    drawPlaceGlyph(ctx, x, y, pl.kind.group, pl.visited, GROUP_COLOR[pl.kind.group]);
    if (live && v.intel.has(pl.id)) { ctx.fillStyle = '#5fc8e0'; ctx.fillRect(x + 3, y - 5, 3, 3); }
    shown.push({ pl, x, y });
    occupied.push([x - 4, y - 4, 9, 9]);
  }
  if (dest?.custom) {
    // A spot marked by hand: a small flag.
    const x = X(dest.gtx + 0.5), y = Y(dest.gty + 0.5);
    if (onSheet(x, y)) {
      ctx.fillStyle = '#05080b'; ctx.fillRect(x - 1, y - 8, 7, 10);
      ctx.fillStyle = '#9fe8ff'; ctx.fillRect(x, y - 7, 1, 8); ctx.fillRect(x + 1, y - 7, 4, 3);
    }
  }

  if (v.teleportTarget) {
    const x = X(ox + v.teleportTarget.x / TILE), y = Y(oy + v.teleportTarget.y / TILE);
    if (onSheet(x, y)) {
      ctx.fillStyle = '#05080b'; ctx.fillRect(x - 5, y - 5, 11, 11);
      ctx.fillStyle = '#d9acff'; ctx.fillRect(x - 4, y - 1, 9, 2); ctx.fillRect(x - 1, y - 4, 2, 9);
      const b = plateBox(ctx, 'Blink Target', x + 3, y); fillPlate(ctx, 'Blink Target', b, '#d9acff'); occupied.push(b);
    }
  }

  // Player: a white diamond in a dark ring, larger than any place mark.
  drawDiamond(ctx, X(pgx), Y(pgy), 3, '#fff8e5');
  occupied.push([X(pgx) - 5, Y(pgy) - 5, 11, 11]);

  const ring = (pl: AtlasPlace, color: string, half: number) => {
    const x = X(pl.gtx + 0.5), y = Y(pl.gty + 0.5);
    ctx.strokeStyle = '#05080b'; ctx.lineWidth = 3;
    ctx.strokeRect(x - half + 0.5, y - half + 0.5, half * 2, half * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(x - half + 0.5, y - half + 0.5, half * 2, half * 2);
  };
  if (dest) ring(dest, '#9fe8ff', 6);
  const selected = v.selectedId ? (v.places.find(p => p.id === v.selectedId) ?? (dest && dest.id === v.selectedId ? dest : null)) : null;
  if (selected && selected !== dest) ring(selected, '#f2cf82', 5);
  const hovered = v.hoverId ? (v.places.find(p => p.id === v.hoverId) ?? (dest && dest.id === v.hoverId ? dest : null)) : null;

  // Names. The destination, the selected place and the place under the pointer always carry theirs; the others get
  // one where there is room, nearest the middle of the sheet first, and more of them the closer the view.
  const forced: { text: string; box: [number, number, number, number]; color: string }[] = [];
  const force = (pl: AtlasPlace, text: string, color: string) => {
    const x = X(pl.gtx + 0.5), y = Y(pl.gty + 0.5);
    if (!onSheet(x, y, 0)) return;
    const box = plateBox(ctx, text, x + 3, y);
    forced.push({ text, box, color }); occupied.push(box);
  };
  const named = hovered ?? selected ?? null;
  if (dest && dest !== named && !dest.custom) force(dest, dest.name, '#9fe8ff');
  if (named && !(named.custom && named !== hovered)) {
    const far = Math.hypot(named.gtx - pgx, named.gty - pgy);
    force(named, named === hovered && !named.custom ? `${named.name} · ${formatDistance(far)}` : named.custom ? formatDistance(far) : named.name, named === dest ? '#9fe8ff' : '#fff3c4');
  }
  if (s >= LABELS_FROM) {
    const skip = new Set([dest?.id, named?.id]);
    const order = shown.filter(q => !skip.has(q.pl.id)).sort((a, b) => Math.hypot(a.x - VIEW_W / 2, a.y - VIEW_H / 2) - Math.hypot(b.x - VIEW_W / 2, b.y - VIEW_H / 2));
    for (const q of order) {
      if (!onSheet(q.x, q.y, -2)) continue;       // a name without its mark on the sheet reads as a place that is not there
      const box = plateBox(ctx, q.pl.name, q.x + 3, q.y);
      if (!free(box)) continue;
      fillPlate(ctx, q.pl.name, box, q.pl.visited ? '#e6dcc0' : '#b9b4a2');
      occupied.push(box);
    }
  }
  for (const f of forced) fillPlate(ctx, f.text, f.box, f.color);

  // The tile under the pointer, and the tile being inspected, once tiles can be told apart.
  if (s >= TILE_FROM && v.hoverTile && (!v.cursor || v.hoverTile.tx !== v.cursor.tx || v.hoverTile.ty !== v.cursor.ty)) {
    const x = X(ox + v.hoverTile.tx + 0.5), y = Y(oy + v.hoverTile.ty + 0.5);
    ctx.strokeStyle = discoveredCell(r, v.hoverTile.tx, v.hoverTile.ty) ? 'rgba(244,208,137,0.45)' : 'rgba(226,84,60,0.4)';
    ctx.strokeRect(x - 5.5, y - 5.5, 11, 11);
  }
  if (live && v.cursor) {
    const xx = X(ox + v.cursor.tx + 0.5), yy = Y(oy + v.cursor.ty + 0.5);
    if (onSheet(xx, yy)) {
      ctx.strokeStyle = '#05080b'; ctx.lineWidth = 3;
      ctx.strokeRect(xx - 7.5, yy - 7.5, 15, 15);
      ctx.strokeStyle = v.markMode ? '#f2cf82' : '#5fc8e0'; ctx.lineWidth = 1;
      const b = 4;
      ctx.beginPath();
      ctx.moveTo(xx - 7.5, yy - 7.5 + b); ctx.lineTo(xx - 7.5, yy - 7.5); ctx.lineTo(xx - 7.5 + b, yy - 7.5);
      ctx.moveTo(xx + 7.5 - b, yy - 7.5); ctx.lineTo(xx + 7.5, yy - 7.5); ctx.lineTo(xx + 7.5, yy - 7.5 + b);
      ctx.moveTo(xx - 7.5, yy + 7.5 - b); ctx.lineTo(xx - 7.5, yy + 7.5); ctx.lineTo(xx - 7.5 + b, yy + 7.5);
      ctx.moveTo(xx + 7.5 - b, yy + 7.5); ctx.lineTo(xx + 7.5, yy + 7.5); ctx.lineTo(xx + 7.5, yy + 7.5 - b);
      ctx.stroke();
    }
  }

  // Scale bar: how far a stretch of the sheet is on the ground (one tile reads as one metre).
  {
    const bar = scaleBar(s);
    const text = formatDistance(bar.tiles).replace('.0 km', ' km');
    ctx.font = 'bold 9px monospace';
    const tw = Math.ceil(ctx.measureText(text).width) || text.length * 5;
    const x1 = VIEW_W - 6, x0 = x1 - bar.px, y = VIEW_H - 7;
    ctx.fillStyle = 'rgba(5,8,11,0.78)';
    ctx.fillRect(Math.min(x0, x1 - tw) - 3, y - 13, Math.max(bar.px, tw) + 6, 18);
    ctx.fillStyle = '#d8ccb0';
    ctx.fillRect(x0, y, bar.px, 1); ctx.fillRect(x0, y - 3, 1, 4); ctx.fillRect(x1 - 1, y - 3, 1, 4);
    ctx.fillText(text, x1 - tw, y - 4);
  }
}

function renderChart(
  ctx: CanvasRenderingContext2D,
  r: RunState,
  marks: FieldMark[],
  selectedMarkId: string | null,
  cursor: { tx: number; ty: number } | null,
  hover: { tx: number; ty: number } | null,
  cx: number,
  cy: number,
  zoom: LocalZoomLevel,
  teleportTarget?: { x: number; y: number } | null,
  markMode = false,
  intelByPlace: Map<string, PlaceNote> = new Map(),
  atlas: { places: AtlasPlace[]; destId: string | null; selectedId: string | null } = { places: [], destId: null, selectedId: null },
) {
  const isVeyra = !!r.layoutId && isVeyra05Layout(r.layoutId);
  const w = getWorld(r.layoutId || 'shipping');
  const v = viewRect(cx, cy, zoom);
  const toScreen = (tx: number, ty: number) => ({
    x: v.ox + (tx - v.x0) * v.px,
    y: v.oy + (ty - v.y0) * v.px,
  });

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#091015';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw base terrain inside active map bounds
  const mapImg = getMapCanvas(r);
  if (zoom === 1) {
    ctx.drawImage(mapImg, 0, 0, WW, WH, v.ox, v.oy, WW * v.px, WH * v.px);
  } else {
    ctx.drawImage(mapImg, v.x0, v.y0, v.wTiles, v.hTiles, 0, 0, CANVAS_W, CANVAS_H);
  }

  // Discovered player structures silhouette at zoomed scales
  if (zoom >= 2) {
    for (const e of Object.values(r.entities)) {
      if (isVeyra && !onActiveFloor(r, e)) continue;
      if (e.kind !== 'struct' || e.poi || e.tx === undefined || e.ty === undefined) continue;
      if (!discoveredCell(r, e.tx, e.ty)) continue;
      const sc = toScreen(e.tx, e.ty);
      if (sc.x < -v.px || sc.y < -v.px || sc.x > CANVAS_W + v.px || sc.y > CANVAS_H + v.px) continue;
      ctx.fillStyle = e.type?.includes('wall') || e.type?.includes('door') ? '#d8c59e' : e.type?.includes('roof') ? '#7d634a' : '#4f5d66';
      ctx.fillRect(Math.floor(sc.x), Math.floor(sc.y), Math.max(2, Math.ceil(v.px)), Math.max(2, Math.ceil(v.px)));
    }
  }

  // Undiscovered 4x4 cells are covered: nothing that stands or moves there is ever drawn. On the Veyra surface the
  // cover carries the lie of the land (one flat tone per cell, from the terrain alone) so a route can be planned;
  // below ground, and on the legacy island, it stays solid.
  const coarse = isVeyra && activeFloor(r) === 0;
  const startCellX = Math.max(0, Math.floor(v.x0 / 4));
  const endCellX = Math.min(49, Math.floor((v.x0 + v.wTiles) / 4));
  const startCellY = Math.max(0, Math.floor(v.y0 / 4));
  const endCellY = Math.min(49, Math.floor((v.y0 + v.hTiles) / 4));
  ctx.fillStyle = '#0d161c';
  for (let gy = startCellY; gy <= endCellY; gy++) {
    for (let gx = startCellX; gx <= endCellX; gx++) {
      if (!r.discovered[gy * 50 + gx]) {
        const sc = toScreen(gx * 4, gy * 4);
        if (coarse) ctx.fillStyle = dimColor(veyraContinentTileColor(w.tiles[Math.min(WH - 1, gy * 4 + 2) * WW + Math.min(WW - 1, gx * 4 + 2)]));
        ctx.fillRect(Math.floor(sc.x), Math.floor(sc.y), Math.ceil(4 * v.px) + 1, Math.ceil(4 * v.px) + 1);
      }
    }
  }

  // Subtle surveyed sector grid (25-tile intervals)
  ctx.fillStyle = 'rgba(214, 196, 158, 0.09)';
  for (let g = 0; g <= WW; g += 25) {
    const sx = toScreen(g, 0).x;
    if (sx >= v.ox && sx <= CANVAS_W - v.ox) ctx.fillRect(Math.round(sx), v.oy, 1, zoom === 1 ? WW * v.px : CANVAS_H);
    const sy = toScreen(0, g).y;
    if (sy >= v.oy && sy <= CANVAS_H - v.oy) ctx.fillRect(v.ox, Math.round(sy), zoom === 1 ? WW * v.px : CANVAS_W, 1);
  }

  // Outer chart border in 1x overview
  if (zoom === 1) {
    ctx.strokeStyle = '#475962';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.ox + 0.5, v.oy + 0.5, WW * v.px - 1, WH * v.px - 1);
  }

  const drawPin = (tx: number, ty: number, c: string, shape: 'dot' | 'diamond' | 'ring' | 'cross' | 'square' | 'tri', size = 3, label?: string) => {
    const sc = toScreen(tx + 0.5, ty + 0.5);
    const xx = Math.round(sc.x), yy = Math.round(sc.y);
    if (xx < -10 || yy < -10 || xx > CANVAS_W + 10 || yy > CANVAS_H + 10) return;
    ctx.fillStyle = '#05080b';
    ctx.fillRect(xx - size - 1, yy - size - 1, size * 2 + 3, size * 2 + 3);
    ctx.fillStyle = c;
    if (shape === 'cross') {
      ctx.fillRect(xx - size, yy - 1, size * 2 + 1, 2);
      ctx.fillRect(xx - 1, yy - size, 2, size * 2 + 1);
    } else if (shape === 'diamond') {
      for (let dy = -size; dy <= size; dy++) {
        const wSpan = size - Math.abs(dy);
        ctx.fillRect(xx - wSpan, yy + dy, wSpan * 2 + 1, 1);
      }
    } else if (shape === 'ring') {
      ctx.fillRect(xx - size, yy - size, size * 2 + 1, size * 2 + 1);
      ctx.fillStyle = '#091116';
      ctx.fillRect(xx - Math.max(1, size - 2), yy - Math.max(1, size - 2), Math.max(1, (size - 2) * 2 + 1), Math.max(1, (size - 2) * 2 + 1));
    } else if (shape === 'tri') {
      for (let row = 0; row <= size * 2; row++) {
        const hw = Math.floor(row / 2);
        ctx.fillRect(xx - hw, yy - size + row, hw * 2 + 1, 1);
      }
    } else {
      ctx.fillRect(xx - size + 1, yy - size + 1, size * 2 - 1, size * 2 - 1);
    }
    if (label && zoom >= 2) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(5,8,11,0.85)';
      const wTxt = ctx.measureText(label).width;
      ctx.fillRect(xx + size + 3, yy - 6, wTxt + 4, 11);
      ctx.fillStyle = c;
      ctx.fillText(label, xx + size + 5, yy + 2);
    }
  };

  // Discovered POIs
  for (const site of w.places) {
    if (!r.poiSeen.includes(site.id) || !discoveredCell(r, site.tx, site.ty)) continue;
    const col = site.kind === 'elder' ? '#ff7c66' : site.kind === 'evac' ? '#7fd8ff' : '#f4d089';
    const hasIntel = intelByPlace.has(site.id);
    drawPin(site.tx, site.ty, col, 'ring', zoom >= 2 ? 4 : 3, zoom >= 2 ? site.name : undefined);
    if (hasIntel) {
      const sc = toScreen(site.tx + 0.5, site.ty + 0.5);
      ctx.fillStyle = '#5fc8e0';
      ctx.fillRect(Math.round(sc.x) + 3, Math.round(sc.y) - 5, 3, 3);
    }
  }

  // Places the atlas names but the player has not charted yet: a hollow mark and the name, nothing else.
  const [aox, aoy] = isVeyra ? windowOrigin(r) : [0, 0];
  const shownSites = new Set(w.places.filter(site => r.poiSeen.includes(site.id) && discoveredCell(r, site.tx, site.ty)).map(site => site.id));
  for (const pl of atlas.places) {
    if (shownSites.has(pl.id)) continue;
    const tx = pl.gtx - aox, ty = pl.gty - aoy;
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) continue;
    const sc = toScreen(tx + 0.5, ty + 0.5);
    const xx = Math.round(sc.x), yy = Math.round(sc.y);
    if (xx < -10 || yy < -10 || xx > CANVAS_W + 10 || yy > CANVAS_H + 10) continue;
    drawPlaceGlyph(ctx, xx, yy, pl.kind.group, pl.visited, GROUP_COLOR[pl.kind.group]);
    if (zoom >= 2 || pl.id === atlas.selectedId || pl.id === atlas.destId) drawPlate(ctx, pl.name, xx + 2, yy, pl.id === atlas.destId ? '#9fe8ff' : '#d8ccb0');
  }

  // Chosen destination: a dashed line from the player toward it, also when it lies beyond this sector.
  const destPlace = atlas.destId ? atlas.places.find(pl => pl.id === atlas.destId) ?? null : null;
  if (destPlace) {
    const a = toScreen(r.player.x / TILE, r.player.y / TILE);
    const b = toScreen(destPlace.gtx - aox + 0.5, destPlace.gty - aoy + 0.5);
    ctx.save();
    ctx.beginPath(); ctx.rect(v.ox, v.oy, zoom === 1 ? WW * v.px : CANVAS_W, zoom === 1 ? WH * v.px : CANVAS_H); ctx.clip();
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.85)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); ctx.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (b.x >= 0 && b.y >= 0 && b.x <= CANVAS_W && b.y <= CANVAS_H) {
      ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(b.x) - 6.5, Math.round(b.y) - 6.5, 13, 13);
    }
  }

  // Owned cabinets, discovered vehicles & carts (distinct crisp shapes; text labels reserved for POIs/Bag/selected mark)
  for (const e of Object.values(r.entities)) {
    if (isVeyra && !onActiveFloor(r, e)) continue;
    if (e.type === 'claim' && e.tx !== undefined && e.ty !== undefined && discoveredCell(r, e.tx, e.ty)) {
      const f = territoryForecast(r, e);
      drawPin(e.tx, e.ty, f.funded ? '#8fd45a' : '#e8b23c', 'square', 3);
    }
    if (e.kind === 'cart' && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) {
      drawPin(e.x / TILE, e.y / TILE, '#e8b36d', 'square', 2);
    }
    if (e.kind === 'vehicle' && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) {
      drawPin(e.x / TILE, e.y / TILE, '#7fd8ff', 'tri', 3);
    }
  }

  // Death bag (draw on local sector only when within the active 200x200 window)
  const death = deathBagView(r);
  if (death.status === 'present' && death.bag.x >= 0 && death.bag.x < WW * TILE && death.bag.y >= 0 && death.bag.y < WH * TILE) {
    drawPin(death.bag.x / TILE, death.bag.y / TILE, '#ff8e7a', 'cross', 4, zoom >= 2 ? 'Death Bag' : undefined);
  }

  // Player field marks
  for (const m of marks) {
    if (!discoveredCell(r, m.tx, m.ty)) continue;
    const meta = MARKS.find(k => k.kind === m.kind)!;
    const isSel = m.id === selectedMarkId;
    const isHoverMark = !!hover && Math.hypot(m.tx - hover.tx, m.ty - hover.ty) <= 1.5;
    drawPin(m.tx, m.ty, meta.color, 'diamond', 3, zoom >= 2 && (isSel || isHoverMark) ? m.label : undefined);
    if (isSel) {
      const sc = toScreen(m.tx + 0.5, m.ty + 0.5);
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sc.x) - 6.5, Math.round(sc.y) - 6.5, 13, 13);
    }
  }

  // Spirit Core teleport target
  if (teleportTarget) {
    drawPin(teleportTarget.x / TILE, teleportTarget.y / TILE, '#d9acff', 'cross', 4, 'Blink Target');
  }

  // Player marker
  drawPin(r.player.x / TILE, r.player.y / TILE, '#fff8e5', 'diamond', 4);

  // Hover highlight (subtle bracket)
  if (hover && (!cursor || hover.tx !== cursor.tx || hover.ty !== cursor.ty)) {
    const sc = toScreen(hover.tx + 0.5, hover.ty + 0.5);
    ctx.strokeStyle = discoveredCell(r, hover.tx, hover.ty) ? 'rgba(244,208,137,0.45)' : 'rgba(226,84,60,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(sc.x) - 5.5, Math.round(sc.y) - 5.5, 11, 11);
  }

  // Active inspected / keyboard cursor (crisp crosshair brackets)
  if (cursor) {
    const sc = toScreen(cursor.tx + 0.5, cursor.ty + 0.5);
    const xx = Math.round(sc.x), yy = Math.round(sc.y);
    const col = markMode ? '#f2cf82' : '#5fc8e0';
    ctx.strokeStyle = '#05080b';
    ctx.lineWidth = 3;
    ctx.strokeRect(xx - 7.5, yy - 7.5, 15, 15);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    const b = 4;
    // Four crisp corner brackets
    ctx.beginPath();
    ctx.moveTo(xx - 7.5, yy - 7.5 + b); ctx.lineTo(xx - 7.5, yy - 7.5); ctx.lineTo(xx - 7.5 + b, yy - 7.5);
    ctx.moveTo(xx + 7.5 - b, yy - 7.5); ctx.lineTo(xx + 7.5, yy - 7.5); ctx.lineTo(xx + 7.5, yy - 7.5 + b);
    ctx.moveTo(xx - 7.5, yy + 7.5 - b); ctx.lineTo(xx - 7.5, yy + 7.5); ctx.lineTo(xx - 7.5 + b, yy + 7.5);
    ctx.moveTo(xx + 7.5 - b, yy + 7.5); ctx.lineTo(xx + 7.5, yy + 7.5); ctx.lineTo(xx + 7.5, yy + 7.5 - b);
    ctx.stroke();
  }
}

/** What the chart says about one place: its name, kind, range, one line on what it is, and the destination button. */
/** Which way a place lies, north up, as a small arrow turned to the bearing. */
const DirArrow = ({ rad }: { rad: number }) => <svg className="dir-arrow" aria-hidden="true" viewBox="0 0 10 10" width="9" height="9" style={{ transform: `rotate(${rad.toFixed(3)}rad)` }}>
  <path d="M1 5h8M5.5 1.5 9 5 5.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
</svg>;

export function PlaceCard({ place, dist, bearing, isDestination, onSet, onClear, onShowWorld, onOpenSector }: {
  place: AtlasPlace; dist: number; bearing: number; isDestination: boolean;
  onSet: () => void; onClear: () => void; onShowWorld?: () => void; onOpenSector?: () => void;
}) {
  return <div className="map-place" data-testid="map-place-card">
    <div className="map-inspector__head">
      <div>
        <b data-notr={place.custom ? undefined : true} style={{ color: place.custom ? '#9fe8ff' : GROUP_COLOR[place.kind.group] }}>{place.name}</b>
        <span><em>{place.kind.label}</em> · {formatDistance(dist)}<DirArrow rad={bearing} />{!place.custom && <> · <em>{place.visited ? 'Visited' : 'Not visited yet'}</em></>}</span>
      </div>
    </div>
    <div className="map-place__blurb">{place.kind.blurb}</div>
    {!place.visited && !place.custom && <div className="map-place__blurb map-place__blurb--dim">What is inside is not on the chart. Go there to find out.</div>}
    <div className="map-place__actions">
      {isDestination
        ? <button className="btn sm" data-testid="map-dest-clear" onClick={onClear}>Clear destination</button>
        : <button className="btn sm gold" data-testid="map-dest-set" onClick={onSet}>Set destination</button>}
      {onShowWorld && <button className="btn sm ghost" onClick={onShowWorld}>Show on World</button>}
      {onOpenSector && <button className="btn sm ghost" title="Bring this place up close on the chart" onClick={onOpenSector}>Zoom in</button>}
    </div>
  </div>;
}

// The how-to line on the sheet is shown until the player has moved the sheet once in this session.
let hintSeen = false;

export function ExpeditionMap({ api, onTeleportSelect, teleportTarget, qaSession = false }: {
  api: Api;
  onTeleportSelect?: (x: number, y: number) => void;
  teleportTarget?: { x: number; y: number } | null;
  qaSession?: boolean;
}) {
  const r = api.gs.run!;
  const isVeyra = !!r.layoutId && isVeyra05Layout(r.layoutId);
  const w = getWorld(r.layoutId || 'shipping');
  const ref = useRef<HTMLCanvasElement>(null);
  const ptx = Math.floor(r.player.x / TILE), pty = Math.floor(r.player.y / TILE);
  // Compute directly from live run state: r.discovered, r.poiSeen, and r.veyraOffscreenEntities mutate in place.
  const bounds = discoveredBounds(r);
  const computeFitZoom = (b: typeof bounds): LocalZoomLevel => {
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    return span <= 48 ? 4 : span <= 96 ? 2 : 1;
  };
  const [zoom, setZoom] = useState<ZoomLevel>(() => (isVeyra && !onTeleportSelect ? 0 : computeFitZoom(bounds)));
  useEffect(() => {
    if (onTeleportSelect && zoom === 0) setZoom(1);
  }, [Boolean(onTeleportSelect), zoom]);
  const [center, setCenter] = useState<{ cx: number; cy: number }>(() => {
    const z0: ZoomLevel = isVeyra && !onTeleportSelect ? 0 : computeFitZoom(bounds);
    return clampCenter((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, z0);
  });
  const [marks, setMarks] = useState<FieldMark[]>(() => readFieldMarks(r, qaSession));
  const [kind, setKind] = useState<MarkKind>('return');
  const [mode, setMode] = useState<'inspect' | 'mark'>('inspect');
  const [label, setLabel] = useState('');
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  // On Veyra the chart opens on places, not on a tile: nothing is inspected until the player clicks the ground.
  const [cursor, setCursor] = useState<{ tx: number; ty: number } | null>(isVeyra && !onTeleportSelect ? null : { tx: ptx, ty: pty });
  const [hover, setHover] = useState<{ tx: number; ty: number; gtx?: number; gty?: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sites' | 'marks' | 'intel'>('all');
  const [destId, setDestId] = useState<string | null>(() => readDestination(r, qaSession));
  // Opening the chart with a destination set shows that place first: where you are going, and the button to drop it.
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(destId);
  const [hoverPlaceId, setHoverPlaceId] = useState<string | null>(null);
  // How close the Veyra sheet is: decides which buttons are lit and offered. Changes rarely, unlike the camera itself.
  const [zoomBand, setZoomBand] = useState<'fit' | 'mid' | 'near'>(() => {
    if (!isVeyra || onTeleportSelect) return 'near';
    const c = recallCam(r.id);
    const [hx, hy] = windowOrigin(r);
    return !c || isFit(c) ? 'fit' : c.s >= TILE_FROM && c.gx >= hx && c.gy >= hy && c.gx <= hx + WW && c.gy <= hy + WH ? 'near' : 'mid';
  });
  const [handled, setHandledState] = useState(hintSeen);
  const setHandled = (v: boolean) => { hintSeen = hintSeen || v; setHandledState(v); };
  const dragRef = useRef<{ sx: number; sy: number; cx0: number; cy0: number; moved: boolean } | null>(null);

  const intel = expeditionNotes(r);
  const intelByPlace = useMemo(() => new Map(intel.map(n => [n.place, n])), [intel]);
  const death = deathBagView(r);
  const sites = w.places.filter(site => r.poiSeen.includes(site.id) && discoveredCell(r, site.tx, site.ty));
  // The atlas: every place a traveller can aim for, known from the first minute (secret strongboxes excepted).
  const places = atlasPlaces(r);
  const ranges = placesByDistance(r, places);
  const visitedCount = places.filter(pl => pl.visited).length;
  // The destination is a named place or a spot the player marked by hand.
  const destPlace = destId ? (places.find(pl => pl.id === destId) ?? (isWaypointId(destId) ? atlasPlace(r, destId) : null)) : null;
  const liveDestId = destPlace?.id ?? null;
  const [pgx, pgy] = isVeyra ? playerGlobalTile(r) : [0, 0];
  const rangeOf = (pl: AtlasPlace) => ranges.find(g => g.place === pl) ?? { place: pl, dist: Math.hypot(pl.gtx - pgx, pl.gty - pgy), bearing: bearing(pl.gtx - pgx, pl.gty - pgy) };
  const destRange = destPlace ? rangeOf(destPlace) : null;
  const selectedPlace = selectedPlaceId ? (places.find(pl => pl.id === selectedPlaceId) ?? (selectedPlaceId === liveDestId ? destPlace : null)) : null;
  const selectedRange = selectedPlace ? rangeOf(selectedPlace) : null;
  const [wox, woy] = isVeyra ? windowOrigin(r) : [0, 0];
  const chooseDestination = (id: string | null) => {
    const set = storeDestination(r, qaSession, id);
    setDestId(set);
    setStatusMsg(set ? 'Destination set. Close the chart: the arrow on screen points the way.' : id ? 'That place cannot be set as a destination.' : 'Destination cleared.');
    api.sfx(set ? 'pin' : 'ui');
  };
  const offscreenCount = isVeyra && r.veyraOffscreenEntities
    ? Object.values(r.veyraOffscreenEntities).filter(oe => oe.type === 'claim' || isOwnBag(oe as any) || oe.kind === 'cart' || oe.kind === 'vehicle').length
    : 0;
  const ownedCabinets = Object.values(r.entities).filter(e => (!isVeyra || onActiveFloor(r, e)) && e.type === 'claim' && e.tx !== undefined && e.ty !== undefined && discoveredCell(r, e.tx, e.ty));
  const rigs = Object.values(r.entities).filter(e => (!isVeyra || onActiveFloor(r, e)) && (e.kind === 'vehicle' || e.kind === 'cart') && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE)));

  // ---- Veyra: one sheet under one camera -------------------------------------------------------------------
  // The camera lives in a ref and the sheet is drawn straight from pointer events on the next animation frame.
  // Dragging and zooming therefore never re-render the panel (its lists, cards and 75 rows): that was the lag.
  const camRef = useRef<Cam>(null as unknown as Cam);
  if (!camRef.current) {
    camRef.current = onTeleportSelect || !isVeyra
      ? clampCam({ gx: wox + WW / 2, gy: woy + WH / 2, s: SECTOR_S })
      : recallCam(r.id) ?? fitCam();
  }
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animRef = useRef<{ kind: 'fly'; from: Cam; to: Cam; t0: number; dur: number } | { kind: 'zoom'; s: number; ax: number; ay: number } | null>(null);
  const glideRef = useRef<{ vx: number; vy: number } | null>(null);
  const hoverTileRef = useRef<{ tx: number; ty: number } | null>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef(r); runRef.current = r;
  const viewRef = useRef<AtlasView | null>(null);
  const frameRef = useRef<(now: number) => void>(() => {});
  const requestDraw = useCallback(() => {
    if (rafRef.current || typeof requestAnimationFrame === 'undefined') return;
    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(t => frameRef.current(t));
  }, []);
  viewRef.current = isVeyra ? {
    places, hoverId: hoverPlaceId, selectedId: selectedPlaceId, dest: destPlace, marks, selectedMarkId, cursor,
    hoverTile: hoverTileRef.current, teleportTarget, markMode: mode === 'mark', intel: intelByPlace, onProgress: requestDraw,
  } : null;
  const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const drawAtlas = () => {
    const ctx = ref.current?.getContext('2d');
    const view = viewRef.current;
    if (!ctx || !view) return;
    view.hoverTile = hoverTileRef.current;
    renderAtlas(ctx, runRef.current, camRef.current, view);
  };
  const syncBand = () => {
    const c = camRef.current;
    // "Sector" is lit while the sheet is close on the sector the player is in, not close on some other ground.
    const home = c.gx >= wox && c.gy >= woy && c.gx <= wox + WW && c.gy <= woy + WH;
    const band = isFit(c) ? 'fit' : c.s >= TILE_FROM && home ? 'near' : 'mid';
    setZoomBand(b => (b === band ? b : band));
  };
  frameRef.current = (now: number) => {
    rafRef.current = 0;
    const dt = Math.max(1, Math.min(50, now - lastFrameRef.current));
    lastFrameRef.current = now;
    let moving = false;
    const a = animRef.current;
    if (a?.kind === 'fly') {
      const t = (now - a.t0) / a.dur;
      camRef.current = clampCam(easeCam(a.from, a.to, t));
      if (t >= 1) animRef.current = null; else moving = true;
    } else if (a?.kind === 'zoom') {
      // Close most of the remaining gap each frame: quick to start, soft to land, and a new notch simply moves the goal.
      const c = camRef.current;
      let next = Math.exp(Math.log(c.s) + (Math.log(a.s) - Math.log(c.s)) * (1 - Math.exp(-dt / 55)));
      if (Math.abs(Math.log(a.s / next)) < 0.004) { next = a.s; animRef.current = null; } else moving = true;
      camRef.current = zoomAt(c, next, a.ax, a.ay);
    }
    const g = glideRef.current;
    if (g) {
      // The sheet keeps sliding a little after a flick, then settles.
      camRef.current = panBy(camRef.current, g.vx * dt, g.vy * dt);
      const keep = Math.exp(-dt / 150);
      g.vx *= keep; g.vy *= keep;
      if (Math.hypot(g.vx, g.vy) < 0.02) glideRef.current = null; else moving = true;
    }
    drawAtlas();
    syncBand();
    const c = camRef.current;
    if (moving) rafRef.current = requestAnimationFrame(t => frameRef.current(t));
    else if (isVeyra && !onTeleportSelect) rememberCam(runRef.current.id, c);
  };
  const stopMotion = () => { animRef.current = null; glideRef.current = null; };
  const flyTo = (to: Cam, dur = 260) => {
    glideRef.current = null;
    const goal = clampCam(to);
    if (calm) { animRef.current = null; camRef.current = goal; }
    else animRef.current = { kind: 'fly', from: camRef.current, to: goal, t0: performance.now(), dur };
    requestDraw();
  };
  const zoomTo = (ratio: number, ax = VIEW_W / 2, ay = VIEW_H / 2) => {
    glideRef.current = null;
    const from = animRef.current?.kind === 'zoom' ? animRef.current.s : camRef.current.s;
    const goal = clampCam({ ...camRef.current, s: from * ratio }).s;
    if (calm) { animRef.current = null; camRef.current = zoomAt(camRef.current, goal, ax, ay); }
    else animRef.current = { kind: 'zoom', s: goal, ax, ay };
    requestDraw();
  };
  const zoomToRef = useRef(zoomTo); zoomToRef.current = zoomTo;

  useEffect(() => {
    if (isVeyra) { drawAtlas(); syncBand(); return; }
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    renderChart(ctx, r, marks, selectedMarkId, cursor, hover, center.cx, center.cy, (zoom || 1) as LocalZoomLevel, teleportTarget, mode === 'mark', intelByPlace, { places, destId: liveDestId, selectedId: selectedPlaceId });
  });
  useEffect(() => () => {
    if (rafRef.current && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);
  // The wheel zooms the sheet on the point under the cursor. Bound natively so the page (and a trackpad pinch) is
  // held back; a React wheel handler cannot do that.
  useEffect(() => {
    const el = ref.current;
    if (!isVeyra || !el || typeof el.addEventListener !== 'function') return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      zoomToRef.current(wheelRatio(e.deltaY, e.deltaMode, e.ctrlKey), (e.clientX - rect.left) * VIEW_W / rect.width, (e.clientY - rect.top) * VIEW_H / rect.height);
      setHandled(true);
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [isVeyra]);

  const focusOn = useCallback((tx: number, ty: number, minZoom?: ZoomLevel) => {
    const baseZoom = zoom === 0 ? 1 : zoom;
    const nextZoom: ZoomLevel = minZoom && baseZoom < minZoom ? minZoom : baseZoom;
    setZoom(nextZoom);
    setCenter(clampCenter(tx, ty, nextZoom));
  }, [zoom]);

  const fitExplored = () => {
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const z: ZoomLevel = span <= 48 ? 4 : span <= 96 ? 2 : 1;
    setZoom(z);
    setCenter(clampCenter((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, z));
  };

  const changeZoom = (next: ZoomLevel, anchor?: { tx: number; ty: number; px?: number; py?: number }) => {
    setZoom(next);
    if (next === 0) return;
    const target = anchor ?? cursor ?? { tx: ptx, ty: pty };
    if (anchor?.px !== undefined && anchor.py !== undefined && next > 1) {
      // Keep the world tile under the pointer, rather than teleporting it to
      // the screen centre at every scroll notch.
      const px = PX_PER_TILE[next as LocalZoomLevel];
      setCenter(clampCenter(anchor.tx + (CANVAS_W / 2 - anchor.px) / px, anchor.ty + (CANVAS_H / 2 - anchor.py) / px, next));
    } else setCenter(clampCenter(target.tx, target.ty, next));
  };

  const saveMarks = (next: FieldMark[]) => {
    if (!storeFieldMarks(r, qaSession, next)) { setStatusMsg('Could not store notes in this browser. No game save changed.'); return; }
    setMarks(next);
  };

  const addMarkAt = (tx: number, ty: number) => {
    const outcome = addFieldMark(r, marks, tx, ty, kind, label);
    if (outcome.error) { setStatusMsg(outcome.error); return; }
    saveMarks(outcome.marks);
    setSelectedMarkId(outcome.marks.at(-1)!.id);
    setCursor({ tx, ty });
    setMode('inspect');
    setLabel('');
    setStatusMsg('Field note saved for this run.');
  };

  const removeMark = (id: string) => {
    saveMarks(marks.filter(m => m.id !== id));
    if (selectedMarkId === id) setSelectedMarkId(null);
    setStatusMsg('Field note removed.');
  };

  const inspectTile = (tx: number, ty: number, panTo = false) => {
    setCursor({ tx, ty });
    setStatusMsg(null);
    setSelectedPlaceId(isVeyra ? placeNear(places, wox + tx, woy + ty, 4)?.id ?? null : null);
    if (!discoveredCell(r, tx, ty)) {
      setSelectedMarkId(null);
      return;
    }
    const mark = marks.find(m => Math.hypot(m.tx - tx, m.ty - ty) <= 2);
    setSelectedMarkId(mark?.id ?? null);
    if (panTo) { if (isVeyra) flyTo({ gx: wox + tx + 0.5, gy: woy + ty + 0.5, s: Math.max(camRef.current.s, 3) }); else focusOn(tx, ty, 2); }
  };

  // Build real inspection readout strictly from discovered data
  const inspected = useMemo(() => {
    if (!cursor) return null;
    const { tx, ty } = cursor;
    if (!discoveredCell(r, tx, ty)) {
      return { discovered: false as const, tx, ty };
    }
    const zoneName = displayZone((w.zoneNames || ZONES)[w.zone[ty * WW + tx]]) || 'Island';
    const tileCode = effTile(r, tx, ty);
    const surface = TILE_LABEL[tileCode] ?? 'Wild terrain';
    const poi = sites.find(s => Math.hypot(s.tx - tx, s.ty - ty) <= 4) ?? null;
    const poiIntel = poi ? intelByPlace.get(poi.id) ?? null : null;
    const cab = ownedCabinets.find(c => Math.hypot((c.tx ?? 0) - tx, (c.ty ?? 0) - ty) <= 2) ?? null;
    const cabForecast = cab ? territoryForecast(r, cab) : null;
    const bagHere = death.status === 'present' && Math.hypot(death.bag.x / TILE - tx, death.bag.y / TILE - ty) <= 2 ? death : null;
    const rig = rigs.find(e => Math.hypot(e.x / TILE - tx, e.y / TILE - ty) <= 2) ?? null;
    const mark = marks.find(m => Math.hypot(m.tx - tx, m.ty - ty) <= 2) ?? null;
    const teleportReason = onTeleportSelect ? spiritDestination(r, tx * TILE + 8, ty * TILE + 8) : undefined;
    return {
      discovered: true as const, tx, ty, zoneName, surface,
      bearing: bearingLabel(tx - ptx, ty - pty),
      isPlayer: Math.hypot(tx - ptx, ty - pty) <= 1.5,
      poi, poiIntel, cab, cabForecast, bagHere, rig, mark, teleportReason,
    };
  }, [cursor, r, w, sites, intelByPlace, ownedCabinets, death, rigs, marks, ptx, pty, onTeleportSelect]);

  const canvasXY = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    const mx = (clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (clientY - rect.top) * (CANVAS_H / rect.height);
    return screenToTile(mx, my, center.cx, center.cy, zoom, r);
  };

  // ---- Veyra sheet: pointer, touch and keys -------------------------------------------------------------------
  // The handling follows what players already know from other maps: drag moves the sheet, the wheel or a pinch
  // zooms on the point under the fingers, a click picks, and a second click (or right-click, or a held press)
  // sets the destination, on a place or on any spot.
  const sheetPoint = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const k = rect.width ? VIEW_W / rect.width : 1;
    const mx = (clientX - rect.left) * k, my = (clientY - rect.top) * (rect.height ? VIEW_H / rect.height : 1);
    const [gx, gy] = toGlobal(camRef.current, mx, my);
    return { mx, my, gx, gy, k };
  };
  const placeAt = (gx: number, gy: number): AtlasPlace | null => {
    const reach = HIT_PX / camRef.current.s;
    if (destPlace?.custom && Math.hypot(destPlace.gtx + 0.5 - gx, destPlace.gty + 0.5 - gy) <= reach) return destPlace;
    return placeNear(places, gx - 0.5, gy - 0.5, reach);
  };
  const sheetTap = (clientX: number, clientY: number, how: 'pick' | 'go' | 'menu') => {
    const { gx, gy } = sheetPoint(clientX, clientY);
    const tx = Math.floor(gx) - wox, ty = Math.floor(gy) - woy;
    const inSector = tx >= 0 && ty >= 0 && tx < WW && ty < WH;
    if (mode === 'mark') {
      if (how !== 'pick') return;
      if (inSector) addMarkAt(tx, ty); else setStatusMsg('A note can only be left on ground you have walked.');
      return;
    }
    if (onTeleportSelect) {
      if (how !== 'pick') return;
      if (!inSector) { setStatusMsg('Out of reach of the core. Pick ground in the sector around you.'); return; }
      inspectTile(tx, ty);
      const reason = spiritDestination(r, tx * TILE + 8, ty * TILE + 8);
      if (reason) { setStatusMsg(reason); return; }
      onTeleportSelect(tx * TILE + 8, ty * TILE + 8);
      setStatusMsg('Core destination locked. Close map; hold and release E.');
      return;
    }
    const hit = placeAt(gx, gy);
    if (how !== 'pick') {
      if (how === 'menu' && inSector) {
        const near = Math.max(2, 5 / camRef.current.s);
        const m = marks.find(mk => Math.hypot(mk.tx - tx, mk.ty - ty) <= near);
        if (m) { removeMark(m.id); return; }
      }
      const id = hit ? hit.id : waypointId(Math.floor(gx), Math.floor(gy));
      if (!id) return;
      setCursor(null); setSelectedMarkId(null);
      if (id === liveDestId) { chooseDestination(null); setSelectedPlaceId(hit && !hit.custom ? hit.id : null); }
      else { chooseDestination(id); setSelectedPlaceId(id); }
      return;
    }
    if (hit) { setSelectedPlaceId(hit.id); setCursor(null); setSelectedMarkId(null); setStatusMsg(null); return; }
    if (inSector && camRef.current.s >= TILE_FROM) { inspectTile(tx, ty); return; }
    setSelectedPlaceId(null); setCursor(null); setSelectedMarkId(null); setStatusMsg(null);
  };
  const sheetHover = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const { gx, gy } = sheetPoint(clientX, clientY);
    const hit = placeAt(gx, gy);
    const id = hit?.id ?? null;
    setHoverPlaceId(h => (h === id ? h : id));
    el.style.cursor = mode === 'mark' || onTeleportSelect ? 'crosshair' : hit ? 'pointer' : 'grab';
    const tx = Math.floor(gx) - wox, ty = Math.floor(gy) - woy;
    const tile = camRef.current.s >= TILE_FROM && tx >= 0 && ty >= 0 && tx < WW && ty < WH ? { tx, ty } : null;
    const was = hoverTileRef.current;
    if ((was?.tx ?? -1) !== (tile?.tx ?? -1) || (was?.ty ?? -1) !== (tile?.ty ?? -1)) { hoverTileRef.current = tile; requestDraw(); }
    if (readoutRef.current) readoutRef.current.textContent = hit && !hit.custom ? hit.name : `AU ${Math.round(gx / 2)},${Math.round(gy / 2)}`;
  };
  const sheetLeave = () => {
    setHoverPlaceId(h => (h === null ? h : null));
    if (hoverTileRef.current) { hoverTileRef.current = null; requestDraw(); }
    if (readoutRef.current) readoutRef.current.textContent = `AU ${ax.toFixed(0)},${ay.toFixed(0)}`;
  };
  useEffect(() => { if (isVeyra) sheetLeave(); }, []);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: 'idle' | 'press' | 'pan' | 'pinch' | 'spent'; sx: number; sy: number; x: number; y: number; t: number; vx: number; vy: number; d0: number; s0: number; mx: number; my: number }>(
    { kind: 'idle', sx: 0, sy: 0, x: 0, y: 0, t: 0, vx: 0, vy: 0, d0: 1, s0: 1, mx: 0, my: 0 });
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetTapRef = useRef(sheetTap); sheetTapRef.current = sheetTap;
  const clearHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  useEffect(() => clearHold, []);
  const twoFingers = () => {
    const [a, b] = [...fingers.current.values()];
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  const lastPointer = useRef('mouse');
  const onSheetDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lastPointer.current = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget;
    el.focus();
    try { el.setPointerCapture(e.pointerId); } catch { /* the gesture still works without capture */ }
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopMotion();
    setHandled(true);
    const g = gesture.current;
    clearHold();
    if (fingers.current.size >= 2) {
      const two = twoFingers();
      Object.assign(g, { kind: 'pinch', d0: two.d, s0: camRef.current.s, mx: two.mx, my: two.my });
      return;
    }
    Object.assign(g, { kind: 'press', sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0 });
    // Under a finger, a held press does what a right-click does: the way to set a destination without a second
    // button. A mouse has that button, and a held mouse press is usually the start of a slow drag.
    if (e.pointerType === 'mouse') return;
    const hx = e.clientX, hy = e.clientY;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (gesture.current.kind !== 'press') return;
      gesture.current.kind = 'spent';
      lastTap.current = null;
      sheetTapRef.current(hx, hy, 'go');
    }, 520);
  };
  const onSheetMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const f = fingers.current.get(e.pointerId);
    if (!f) { if (e.pointerType !== 'touch') sheetHover(e.clientX, e.clientY); return; }
    f.x = e.clientX; f.y = e.clientY;
    const g = gesture.current;
    const { k } = sheetPoint(e.clientX, e.clientY);
    if (g.kind === 'pinch' && fingers.current.size >= 2) {
      const two = twoFingers();
      const rect = e.currentTarget.getBoundingClientRect();
      let c = zoomAt(camRef.current, g.s0 * two.d / g.d0, (two.mx - rect.left) * k, (two.my - rect.top) * k);
      c = panBy(c, (two.mx - g.mx) * k, (two.my - g.my) * k);
      g.mx = two.mx; g.my = two.my;
      camRef.current = c;
      requestDraw();
      return;
    }
    if (g.kind === 'press' && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > (e.pointerType === 'mouse' ? 4 : 9)) {
      g.kind = 'pan';
      clearHold();
      e.currentTarget.style.cursor = 'grabbing';
    }
    if (g.kind !== 'pan') return;
    const dx = (e.clientX - g.x) * k, dy = (e.clientY - g.y) * k;
    const dtm = Math.max(1, e.timeStamp - g.t);
    g.vx = g.vx * 0.5 + (dx / dtm) * 0.5; g.vy = g.vy * 0.5 + (dy / dtm) * 0.5;
    g.x = e.clientX; g.y = e.clientY; g.t = e.timeStamp;
    camRef.current = panBy(camRef.current, dx, dy);
    requestDraw();
  };
  const onSheetUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!fingers.current.has(e.pointerId)) return;
    fingers.current.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    clearHold();
    const g = gesture.current;
    const was = g.kind;
    if (was === 'pinch') {
      const rest = [...fingers.current.values()][0];
      if (rest) Object.assign(g, { kind: 'pan', x: rest.x, y: rest.y, sx: rest.x, sy: rest.y, t: e.timeStamp, vx: 0, vy: 0 });
      else g.kind = 'idle';
      return;
    }
    g.kind = 'idle';
    if (was === 'pan') {
      // Let go while still moving: the sheet glides on. Let go after stopping: it stays put.
      if (!calm && e.timeStamp - g.t < 70 && Math.hypot(g.vx, g.vy) > 0.06) { glideRef.current = { vx: g.vx, vy: g.vy }; requestDraw(); }
      else rememberCam(r.id, camRef.current);
      if (e.pointerType !== 'touch') sheetHover(e.clientX, e.clientY);
      return;
    }
    if (was !== 'press') return;
    const prev = lastTap.current;
    const twice = !!prev && e.timeStamp - prev.t < 340 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 16;
    lastTap.current = twice ? null : { t: e.timeStamp, x: e.clientX, y: e.clientY };
    sheetTap(e.clientX, e.clientY, twice ? 'go' : 'pick');
    if (e.pointerType !== 'touch') restCursor(e.clientX, e.clientY);
  };
  // What lies under the cursor may just have changed (a hand-made mark set or cleared): say so at once.
  const restCursor = (clientX: number, clientY: number) => {
    if (!ref.current) return;
    const { gx, gy } = sheetPoint(clientX, clientY);
    const named = placeNear(places, gx - 0.5, gy - 0.5, HIT_PX / camRef.current.s);
    ref.current.style.cursor = mode === 'mark' || onTeleportSelect ? 'crosshair' : named ? 'pointer' : 'grab';
  };
  const onSheetCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    fingers.current.delete(e.pointerId);
    clearHold();
    gesture.current.kind = fingers.current.size ? gesture.current.kind : 'idle';
  };
  const onSheetKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'Delete', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Home'].includes(e.code)) {
      e.preventDefault(); e.stopPropagation();
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { zoomTo(ZOOM_STEP * ZOOM_STEP); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { zoomTo(1 / (ZOOM_STEP * ZOOM_STEP)); return; }
    if (e.code === 'Home') { flyTo({ gx: pgx, gy: pgy, s: Math.max(camRef.current.s, SECTOR_S) }); return; }
    const dir: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (mode === 'mark' || onTeleportSelect) {
      // Picking a tile by keys: the cursor steps over the sector and the sheet follows it.
      const p = cursor || { tx: ptx, ty: pty };
      if (dir[e.code]) {
        const step = camRef.current.s >= 4 ? 1 : camRef.current.s >= 2 ? 2 : 4;
        const tx = Math.max(0, Math.min(WW - 1, p.tx + dir[e.code][0] * step));
        const ty = Math.max(0, Math.min(WH - 1, p.ty + dir[e.code][1] * step));
        inspectTile(tx, ty);
        const to = reveal(camRef.current, wox + tx, woy + ty);
        if (to) flyTo(to, 160);
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (mode === 'mark') addMarkAt(p.tx, p.ty);
        else if (onTeleportSelect) {
          const reason = spiritDestination(r, p.tx * TILE + 8, p.ty * TILE + 8);
          if (reason) setStatusMsg(reason);
          else { onTeleportSelect(p.tx * TILE + 8, p.ty * TILE + 8); setStatusMsg('Core destination locked.'); }
        }
      }
      return;
    }
    if (dir[e.code]) {
      // Step to the nearest place lying in that direction from the selected one (or from the player).
      const [fx, fy] = selectedPlace ? [selectedPlace.gtx, selectedPlace.gty] : [pgx, pgy];
      const [ux, uy] = dir[e.code];
      let best: AtlasPlace | null = null; let bd = Infinity;
      for (const pl of places) {
        if (pl === selectedPlace) continue;
        const dx = pl.gtx - fx, dy = pl.gty - fy;
        const along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux);
        if (along <= 0 || across > along * 1.5) continue;
        const score = along + across * 2;
        if (score < bd) { bd = score; best = pl; }
      }
      if (best) {
        setSelectedPlaceId(best.id); setCursor(null); setStatusMsg(null);
        const to = reveal(camRef.current, best.gtx, best.gty);
        if (to) flyTo(to, 200);
      }
      return;
    }
    if ((e.code === 'Enter' || e.code === 'Space') && selectedPlace) chooseDestination(selectedPlace.id === liveDestId ? null : selectedPlace.id);
    if (e.code === 'Delete' && selectedMarkId) removeMark(selectedMarkId);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.focus();
    dragRef.current = { sx: e.clientX, sy: e.clientY, cx0: center.cx, cy0: center.cy, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    setHover(canvasXY(e.clientX, e.clientY, el));
    const d = dragRef.current;
    if (!d) return;
    const dxPx = e.clientX - d.sx, dyPx = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dxPx, dyPx) > 4) d.moved = true;
    if (d.moved && zoom > 1) {
      const rect = el.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const px = PX_PER_TILE[zoom as LocalZoomLevel];
      setCenter(clampCenter(d.cx0 - (dxPx * scaleX) / px, d.cy0 - (dyPx * scaleX) / px, zoom));
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) return;
    if (e.button !== 0) return;
    const { tx, ty } = canvasXY(e.clientX, e.clientY, e.currentTarget);
    if (mode === 'mark') { addMarkAt(tx, ty); return; }
    if (onTeleportSelect) {
      inspectTile(tx, ty);
      const reason = spiritDestination(r, tx * TILE + 8, ty * TILE + 8);
      if (reason) { setStatusMsg(reason); return; }
      onTeleportSelect(tx * TILE + 8, ty * TILE + 8);
      setStatusMsg('Core destination locked. Close map; hold and release E.');
      return;
    }
    inspectTile(tx, ty);
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = canvasXY(e.clientX, e.clientY, e.currentTarget);
    const precise = { ...anchor, px: (e.clientX - rect.left) * CANVAS_W / rect.width, py: (e.clientY - rect.top) * CANVAS_H / rect.height };
    if (e.deltaY < 0) changeZoom(zoom === 0 ? 1 : zoom === 1 ? 2 : 4, precise);
    else changeZoom(zoom === 4 ? 2 : 1, precise);
  };
  const onChartKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'Delete', 'Equal', 'Minus'].includes(e.code)) {
      e.preventDefault(); e.stopPropagation();
    }
    if (e.code === 'Equal') { changeZoom(zoom === 0 ? 1 : zoom === 1 ? 2 : 4); return; }
    if (e.code === 'Minus') { changeZoom(zoom === 4 ? 2 : 1); return; }
    const p = cursor || { tx: ptx, ty: pty };
    const step = zoom === 4 ? 1 : zoom === 2 ? 2 : 4;
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    if (delta[e.code]) {
      const tx = Math.max(0, Math.min(WW - 1, p.tx + delta[e.code][0]));
      const ty = Math.max(0, Math.min(WH - 1, p.ty + delta[e.code][1]));
      inspectTile(tx, ty);
      if (zoom > 1) setCenter(clampCenter(tx, ty, zoom));
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (mode === 'mark') addMarkAt(p.tx, p.ty);
      else if (onTeleportSelect) {
        const reason = spiritDestination(r, p.tx * TILE + 8, p.ty * TILE + 8);
        if (reason) setStatusMsg(reason);
        else { onTeleportSelect(p.tx * TILE + 8, p.ty * TILE + 8); setStatusMsg('Core destination locked.'); }
      } else inspectTile(p.tx, p.ty);
    }
    if (e.code === 'Delete' && selectedMarkId) removeMark(selectedMarkId);
  };

  const zone = displayZone((w.zoneNames || ZONES)[w.zone[pty * WW + ptx]]);
  const fl = isVeyra ? activeFloor(r) : 0;
  const floorTag = fl < 0 ? ` · Basement ${Math.abs(fl)}` : fl === 0 ? '' : ` · Floor ${fl + 1}`;
  const [ax, ay] = isVeyra ? playerGlobalAu(r) : [0, 0];
  const totalSiteCount = sites.length + ownedCabinets.length;
  const showPlace = (pl: AtlasPlace) => {
    // From the list: select the place and bring it onto the sheet if it is not there already.
    setSelectedPlaceId(pl.id);
    setStatusMsg(null);
    if (!onTeleportSelect) setCursor(null);
    const to = reveal(camRef.current, pl.gtx, pl.gty);
    if (to) flyTo(to);
  };
  const placeRow = (g: { place: AtlasPlace; dist: number; bearing: number }) => (
    <button key={g.place.id} data-testid={`map-place-${g.place.id}`} className={`map-row map-row--place ${selectedPlaceId === g.place.id ? 'selected' : ''} ${g.place.id === liveDestId ? 'is-dest' : ''}`} onClick={() => showPlace(g.place)}>
      <b style={{ color: GROUP_COLOR[g.place.kind.group] }}><i aria-hidden="true" className={`pm ${g.place.id === liveDestId ? 'pm--dest' : g.place.visited ? 'pm--seen' : 'pm--new'}`} /><span data-notr={g.place.custom ? undefined : true}>{g.place.name}</span></b>
      <span><em>{g.place.kind.label}</em> · {formatDistance(g.dist)}<DirArrow rad={g.bearing} />{g.place.visited && <> · <em>Visited</em></>}</span>
    </button>
  );

  return <Panel title={<span className="map-heading">
    FIELD CHART
    <span>{zone}{isVeyra ? ` · AU ${ax.toFixed(0)},${ay.toFixed(0)}${floorTag}` : ''} · {bounds.pct}% charted · {runHours(r, api.now()).toFixed(1)}h</span>
  </span>}
    className="field-map" style={{ left: 14, top: 8, width: 612, height: 344, boxSizing: 'border-box' }} onClose={() => api.open(null)}>
    <div className="field-map__body">
      {/* LEFT: Chart Canvas + Zoom/Navigation Controls */}
      <div className="chart-column">
        <div className="chart-controls">
          <div className="chart-zoom" role="group" aria-label="Map zoom">
            {isVeyra ? <>
              <button data-testid="map-mode-continent" className={`btn sm ${zoomBand === 'fit' ? 'gold' : 'ghost'}`} onClick={() => flyTo(fitCam())} title="The whole continent: land, roads and every named place. Ground you have not walked is dimmed.">World</button>
              <button data-testid="map-mode-local" className={`btn sm ${zoomBand === 'near' ? 'gold' : 'ghost'}`} onClick={() => flyTo({ gx: wox + WW / 2, gy: woy + WH / 2, s: SECTOR_S })} title="The sector around you, close enough to read the ground you have walked.">Sector</button>
              <button className="btn sm ghost chart-zoom__step" data-testid="map-zoom-out" aria-label="Zoom out" title="Zoom out [-]" disabled={zoomBand === 'fit'} onClick={() => zoomTo(1 / (ZOOM_STEP * ZOOM_STEP))}>−</button>
              <button className="btn sm ghost chart-zoom__step" data-testid="map-zoom-in" aria-label="Zoom in" title="Zoom in [+]" onClick={() => zoomTo(ZOOM_STEP * ZOOM_STEP)}>+</button>
              <button className="btn sm ghost" data-testid="map-center-you" onClick={() => flyTo({ gx: pgx, gy: pgy, s: Math.max(camRef.current.s, SECTOR_S) })} title="Center on yourself [Home]">You</button>
            </> : <>
              {([1, 2, 4] as LocalZoomLevel[]).map(z => <button key={z} className={`btn sm ${zoom === z ? 'gold' : 'ghost'}`} onClick={() => changeZoom(z)} title={z === 1 ? 'Full sector overview' : `Zoom ${z}×`}>{z}×</button>)}
              <button className="btn sm ghost" onClick={fitExplored} title="Frame explored territory">Fit</button>
              <button className="btn sm ghost" onClick={() => { inspectTile(ptx, pty); focusOn(ptx, pty, 2); }} title="Center on player">You</button>
            </>}
          </div>
          {isVeyra
            ? <span className="chart-coords" data-notr ref={readoutRef} />
            : <span className="chart-coords">{hover ? (discoveredCell(r, hover.tx, hover.ty) ? `${hover.tx},${hover.ty}` : 'Uncharted') : `${ptx},${pty}`}</span>}
        </div>

        <div className="chart-frame">
          {isVeyra
            ? <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className="chart-canvas chart-canvas--sheet" tabIndex={0} role="img"
              aria-label="Chart of the continent. Drag to move, wheel or plus and minus to zoom, arrows step between places, Enter sets the destination."
              onPointerDown={onSheetDown} onPointerMove={onSheetMove} onPointerUp={onSheetUp} onPointerCancel={onSheetCancel}
              onPointerLeave={e => { if (!fingers.current.has(e.pointerId)) sheetLeave(); }}
              onKeyDown={onSheetKey}
              onContextMenu={e => {
                e.preventDefault();
                // A phone raises this on a held press, which the sheet has already answered itself.
                if (lastPointer.current !== 'mouse') return;
                setHandled(true); sheetTap(e.clientX, e.clientY, 'menu'); restCursor(e.clientX, e.clientY);
              }} />
            : <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className="chart-canvas" tabIndex={0} role="img"
              aria-label="Explored island map. Drag to pan, wheel or 1x/2x/4x to zoom, arrows move cursor, Enter inspects or marks."
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
              onPointerLeave={() => { dragRef.current = null; setHover(null); }}
              onWheel={onWheel} onKeyDown={onChartKey}
              onContextMenu={e => { e.preventDefault(); const { tx, ty } = canvasXY(e.clientX, e.clientY, e.currentTarget); const m = marks.find(mk => Math.hypot(mk.tx - tx, mk.ty - ty) <= 2); if (m) removeMark(m.id); }} />}
          {isVeyra && !handled && !onTeleportSelect && mode !== 'mark' && <div className="chart-hint" data-testid="map-hint">
            {coarse ? 'Drag to move · pinch to zoom · double-tap to set a destination' : 'Drag to move · scroll to zoom · double-click to set a destination'}
          </div>}
          <div className="chart-compass">N↑</div>
          {onTeleportSelect && <div className="chart-teleport-pill">CORE BLINK · select safe explored ground</div>}
          {!onTeleportSelect && destRange && <button className="chart-dest-pill" data-testid="map-dest-pill" title="Your destination. Click to show it." onClick={() => showPlace(destRange.place)}>
            <i aria-hidden="true" className="pm pm--dest" /><span data-notr={destRange.place.custom ? undefined : true}>{destRange.place.name}</span><em>{formatDistance(destRange.dist)}<DirArrow rad={destRange.bearing} /></em>
          </button>}
        </div>

        <div className="map-toolbar">
          <button className={`btn sm ${mode === 'mark' ? 'gold' : ''}`} onClick={() => setMode(m => m === 'mark' ? 'inspect' : 'mark')}>
            {mode === 'mark' ? 'Click chart to mark' : '+ Leave note'}
          </button>
          <button className="btn sm" title="Save note at your current position" onClick={() => addMarkAt(ptx, pty)}>Mark my spot</button>
          {isVeyra ? <span className="map-legend" aria-hidden="true">
            <i style={{ color: '#fff8e5' }}>◆</i>You
            <i className="pm pm--new" style={{ color: '#f4d089' }} />New
            <i className="pm pm--seen" style={{ color: '#f4d089' }} />Visited
            <i className="pm pm--dest" />Going
          </span> : <span className="map-legend" aria-hidden="true">
            <i style={{ color: '#fff8e5' }}>◆</i>You
            <i style={{ color: '#f4d089' }}>◎</i>Site
            <i style={{ color: '#8fd45a' }}>■</i>Cab
            <i style={{ color: '#ff8e7a' }}>✕</i>Bag
          </span>}
          <span className="map-key" title="Notes you have left on the chart, out of 18">{marks.length}/18</span>
        </div>
      </div>

      {/* RIGHT: Location Inspector + Connected Directory */}
      <div className="map-sidebar">
        {/* Mark composer when active */}
        {mode === 'mark' && <div className="map-add">
          <div className="map-kinds">{MARKS.map(m => <button key={m.kind} className={kind === m.kind ? 'active' : ''} title={m.label} onClick={() => setKind(m.kind)} style={{ color: m.color }}>{m.sign}<span>{m.label}</span></button>)}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            <input aria-label="Field note label" placeholder="label (optional)" maxLength={22} value={label} onChange={e => setLabel(e.target.value)} style={{ flex: 1 }} />
            {cursor && discoveredCell(r, cursor.tx, cursor.ty) && <button className="btn sm gold" onClick={() => addMarkAt(cursor.tx, cursor.ty)}>Pin ({cursor.tx},{cursor.ty})</button>}
          </div>
        </div>}

        {/* Active Inspection Card */}
        <div className="map-inspector" role="status">
          {selectedPlace && selectedRange && <PlaceCard place={selectedPlace} dist={selectedRange.dist} bearing={selectedRange.bearing} isDestination={selectedPlace.id === liveDestId}
            onSet={() => chooseDestination(selectedPlace.id)} onClear={() => chooseDestination(null)}
            onShowWorld={zoomBand !== 'fit' && !onTeleportSelect ? () => flyTo(fitCam()) : undefined}
            onOpenSector={zoomBand !== 'near' ? () => flyTo({ gx: selectedPlace.gtx + 0.5, gy: selectedPlace.gty + 0.5, s: Math.max(camRef.current.s, SECTOR_S) }, 320) : undefined} />}
          {isVeyra && !inspected ? (
            !selectedPlace && <div className="map-inspector__empty">{coarse
              ? 'Every named place is on this chart from the start. Tap one to see what it is. Double-tap or hold a place, or any spot, to set it as your destination.'
              : 'Every named place is on this chart from the start. Click one to see what it is. Double-click or right-click a place, or any spot, to set it as your destination.'}</div>
          ) : !inspected ? (
            <div className="map-inspector__empty">Click or move cursor over explored ground to inspect terrain, sites, intel, or notes.</div>
          ) : !inspected.discovered ? (
            !selectedPlace && <div className="map-inspector__fog">
              <b>Uncharted Sector · ({inspected.tx}, {inspected.ty})</b>
              <span>{isVeyra ? 'The chart shows the lie of the land here. What stands on it stays hidden until you walk it.' : 'Terrain, landmarks, and structures remain hidden until explored on foot.'}</span>
            </div>
          ) : (
            <>
              <div className="map-inspector__head">
                <div>
                  <b>{inspected.poi && !selectedPlace ? inspected.poi.name : inspected.bagHere ? 'Your Death Bag' : inspected.cab ? 'Territory Cabinet' : inspected.mark ? inspected.mark.label : inspected.zoneName}</b>
                  <span>{inspected.zoneName} · {inspected.surface} · ({inspected.tx},{inspected.ty}) · {inspected.bearing}</span>
                </div>
                <button className="btn sm ghost" title="Pin a note at this tile" onClick={() => addMarkAt(inspected.tx, inspected.ty)}>+ Pin</button>
              </div>

              {inspected.bagHere && <div className="map-inspector__tag bad">
                <b>Death Bag</b>{` · ${inspected.bagHere.stacks.length} stack${inspected.bagHere.stacks.length === 1 ? '' : 's'} (${inspected.bagHere.cause})`}
              </div>}

              {inspected.cab && inspected.cabForecast && <div className={`map-inspector__tag ${inspected.cabForecast.funded ? 'ok' : 'warn'}`}>
                <b>Cabinet</b> · {inspected.cabForecast.funded ? `Funded (~${Number.isFinite(inspected.cabForecast.hours) ? inspected.cabForecast.hours.toFixed(1) + 'h' : '∞'})` : 'UNFUNDED — structures decay'}
              </div>}

              {inspected.rig && <div className="map-inspector__tag info">
                <b>{inspected.rig.kind === 'vehicle' ? 'Motorbike' : 'Cart'}</b> · {inspected.rig.kind === 'vehicle' && inspected.rig.vehicle ? `Fuel ${inspected.rig.vehicle.fuel.toFixed(0)} · HP ${Math.ceil(inspected.rig.hp || 0)}` : `${cartWeight(r, inspected.rig.c!).toFixed(0)}/${cartLimit(inspected.rig)} kg`}
              </div>}

              {inspected.poiIntel && <div className="map-inspector__intel">
                {inspected.poiIntel.gates.map((g, i) => (
                  <div key={i} className="map-gate">
                    <Icon k={g.item} size={12} />
                    <span>{g.requirement === 'power' ? 'Power gate' : ({ vault: 'Green Card', green: 'Green Card', blue: 'Blue Card', purple: 'Purple Card' } as Record<string, string>)[g.cardClass ?? 'vault'] ?? 'Access card'} · <b>{g.have}/{g.need}</b> {g.carried ? 'carried' : g.craft ? 'craftable' : 'missing'}</span>
                    {g.craft && !g.carried && <button className="btn sm" onClick={() => api.open({ kind: 'craft', recipe: g.craft!.recipe })}>Recipe</button>}
                  </div>
                ))}
                {inspected.poiIntel.blueprints.map(b => (
                  <div key={b.recipe} className="map-gate">
                    <Icon k="blueprint" size={11} />
                    <span>{b.name} · <em>{b.state}</em></span>
                  </div>
                ))}
              </div>}

              {inspected.mark && <div className="map-inspector__tag gold" style={{ justifyContent: 'space-between' }}>
                <span><b style={{ color: MARKS.find(k => k.kind === inspected.mark!.kind)?.color }}>{MARKS.find(k => k.kind === inspected.mark!.kind)?.sign}</b> {inspected.mark.label}</span>
                <button className="map-remove" aria-label={`Remove ${inspected.mark.label}`} onClick={() => removeMark(inspected.mark!.id)}>Remove</button>
              </div>}

              {onTeleportSelect && <div className={`map-inspector__tag ${inspected.teleportReason ? 'bad' : 'info'}`} style={{ justifyContent: 'space-between' }}>
                <span>{inspected.teleportReason ? inspected.teleportReason : 'Safe open ground for Spirit Blink'}</span>
                {!inspected.teleportReason && <button className="btn sm gold" onClick={() => { onTeleportSelect(inspected.tx * TILE + 8, inspected.ty * TILE + 8); setStatusMsg('Core destination locked. Close map; hold and release E.'); }}>Set Target</button>}
              </div>}
            </>
          )}
          {statusMsg && <div className="map-inspector__status">{statusMsg}</div>}
        </div>

        {/* Connected Directory Filter */}
        <div className="map-tabs">
          {([['all', 'All'], ['sites', isVeyra ? `Places ${visitedCount}/${places.length}` : `Sites ${totalSiteCount}`], ['marks', `Notes ${marks.length}`], ['intel', `Intel ${intel.length}`]] as const).map(([id, lbl]) => (
            <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{lbl}</button>
          ))}
        </div>

        <div className="map-list scroll">
          {(filter === 'all' || filter === 'sites') && <>
            {isVeyra && offscreenCount > 0 && <div className="map-note" style={{ color: '#9ae0ff' }}>Offscreen markers: {offscreenCount} (shown on the World view)</div>}
            {death.status === 'present' && (() => {
              const btx = Math.floor(death.bag.x / TILE), bty = Math.floor(death.bag.y / TILE);
              const offWin = isVeyra && (btx < 0 || btx >= WW || bty < 0 || bty >= WH);
              return (
                <button className="map-row map-row--bag" onClick={() => offWin ? flyTo({ gx: wox + btx, gy: woy + bty, s: Math.max(camRef.current.s, LIVE_FROM) }) : inspectTile(btx, bty, true)}>
                  <b>✕ Your Death Bag{offWin ? ' (distant sector)' : ''}</b>
                  <span>{offWin ? 'Continent view' : `${btx},${bty}`} · {death.stacks.length} stacks · {bearingLabel(btx - ptx, bty - pty)}</span>
                </button>
              );
            })()}
            {death.status === 'missing' && <div className="map-note">Last death bag is gone. No stock is promised.</div>}
            {ownedCabinets.map(e => {
              const f = territoryForecast(r, e);
              return <button key={e.id} className="map-row" onClick={() => inspectTile(e.tx!, e.ty!, true)}>
                <b style={{ color: f.funded ? 'var(--good)' : 'var(--warn)' }}>■ Cabinet · {f.funded ? `${Number.isFinite(f.hours) ? f.hours.toFixed(0) + 'h' : '∞'}` : 'UNFUNDED'}</b>
                <span>{e.tx},{e.ty} · {bearingLabel(e.tx! - ptx, e.ty! - pty)}</span>
              </button>;
            })}
            {rigs.map(e => {
              const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE);
              return <button key={e.id} className="map-row" onClick={() => inspectTile(ex, ey, true)}>
                <b style={{ color: 'var(--info)' }}>{e.kind === 'vehicle' ? '▲ Motorbike' : '▣ Cart'}</b>
                <span>{ex},{ey} · {bearingLabel(ex - ptx, ey - pty)}</span>
              </button>;
            })}
            {isVeyra && destRange && placeRow(destRange)}
            {isVeyra && filter === 'all' && <>
              <div className="map-list__head">Nearest places</div>
              {ranges.filter(g => g.place.id !== liveDestId).slice(0, 5).map(placeRow)}
              {ranges.length > 6 && <button className="map-row map-row--more" onClick={() => setFilter('sites')}>All places</button>}
            </>}
            {isVeyra && filter === 'sites' && <>
              <div className="map-list__head">All places, nearest first</div>
              {ranges.filter(g => g.place.id !== liveDestId).map(placeRow)}
            </>}
            {!isVeyra && sites.map(site => {
              const n = intelByPlace.get(site.id);
              return <button key={site.id} className="map-row" onClick={() => inspectTile(site.tx, site.ty, true)}>
                <b>◎ {site.name}{n ? ` · ${n.gates.length} gate${n.gates.length === 1 ? '' : 's'}${n.blueprints.length ? ` · ${n.blueprints.length} BP` : ''}` : ''}</b>
                <span>{site.tx},{site.ty} · {bearingLabel(site.tx - ptx, site.ty - pty)}</span>
              </button>;
            })}
          </>}

          {(filter === 'all' || filter === 'marks') && marks.map(m => (
            <div key={m.id} className={`map-row map-row--mark ${selectedMarkId === m.id ? 'selected' : ''}`}>
              <button onClick={() => inspectTile(m.tx, m.ty, true)}>
                <b style={{ color: MARKS.find(k => k.kind === m.kind)!.color }}>{MARKS.find(k => k.kind === m.kind)!.sign} {m.label}</b>
                <span>{m.tx},{m.ty} · {bearingLabel(m.tx - ptx, m.ty - pty)}</span>
              </button>
              <button className="map-remove" aria-label={`Remove ${m.label}`} onClick={() => removeMark(m.id)}>×</button>
            </div>
          ))}

          {(filter === 'all' || filter === 'intel') && intel.map(n => {
            const site = w.places.find(p => p.id === n.place);
            const canJump = site && discoveredCell(r, site.tx, site.ty);
            return <div className="map-intel" key={n.place}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b>{n.name} · observed</b>
                {canJump && <button className="btn sm ghost" onClick={() => inspectTile(site!.tx, site!.ty, true)}>Locate</button>}
              </div>
              {n.gates.map((g, i) => <div className="map-gate" key={i}><Icon k={g.item} size={12} /><span>{g.requirement === 'power' ? 'Power access' : `${ITEMS[g.item]?.name ?? 'Card'} access`}<small>{g.have}/{g.need} carried · {g.carried ? 'in pack' : g.craft ? 'recipe known' : 'find it'}</small></span>
                {g.craft && !g.carried && <button className="btn sm" onClick={() => api.open({ kind: 'craft', recipe: g.craft!.recipe })}>Recipe</button>}</div>)}
              {n.blueprints.map(b => <div key={b.recipe} className="map-gate"><Icon k="blueprint" size={11} /><span>{b.name}<small>{b.state === 'seen' ? 'seen earlier · may be gone' : b.state === 'owned' ? 'in pack · not learned' : 'learned'}</small></span></div>)}
            </div>;
          })}

          {!isVeyra && filter === 'sites' && !sites.length && !ownedCabinets.length && !rigs.length && death.status !== 'present' &&
            <div className="map-note">No charted sites yet. Explore to reveal them; unknown sites stay hidden.</div>}
          {filter === 'marks' && !marks.length &&
            <div className="map-note">No notes placed. Select “Leave note”, then click explored terrain.</div>}
          {filter === 'intel' && !intel.length &&
            <div className="map-note">No field intelligence recorded. Inspect known POIs to reveal their observed access requirements.</div>}
          {!isVeyra && filter === 'all' && !sites.length && !ownedCabinets.length && !rigs.length && !marks.length && !intel.length && death.status !== 'present' &&
            <div className="map-note">Begin exploring. The chart records only the terrain you have actually visited.</div>}
        </div>
      </div>
    </div>
  </Panel>;
}
