import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, TILE, WW, WH, type RunState } from '../game/core';
import { getMapCanvas } from '../game/render';
import { getWorld, ZONES } from '../game/world';
import { effTile, runHours, territoryForecast, cartWeight, cartLimit } from '../game/engine';
import { spiritDestination } from '../game/sim';
import { deathBagView } from '../game/death-view';
import { expeditionNotes, type PlaceNote } from '../game/expedition-intel';
import { addFieldMark, discoveredCell, readFieldMarks, storeFieldMarks, type FieldMark, type MarkKind } from '../game/map-notes';
import { Panel, Icon, type Api } from './common';
import { isVeyra05Layout } from '../veyra05/scenes';
import { windowOrigin, playerGlobalAu } from '../veyra05/continuity';
import { activeFloor, onActiveFloor } from '../veyra05/floors';
import { POIS, sampleTile } from '../veyra05/reader';
import { FRAME_W, FRAME_H } from '../veyra05/frame';

const continentCellColorCache = new Map<string, string>();
const PRIMORDIAL_POI_IDS = new Set(['po_surtur', 'po_typhon', 'po_elderwood', 'po_gate', 'po_hall_eyes', 'po_necropolis']);
function veyraContinentTileColor(t: number): string {
  switch (t) {
    case T.DEEP: return '#14243a';
    case T.SHALLOW: case T.RIVER: return '#265c84';
    case T.SAND: return '#b8a26e';
    case T.GRASS: case T.MEADOW: return '#426e3c';
    case T.FOREST: return '#284a2a';
    case T.MARSH: return '#3a5442';
    case T.HILL: case T.CLIFF: return '#68625c';
    case T.SNOW: return '#cad8e4';
    case T.ASH: return '#4e3c38';
    case T.TOXIC: return '#5a6e2e';
    case T.ROAD: case T.FLOOR: return '#9a8462';
    default: return '#426e3c';
  }
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
const CONT_OX = 6;
const CONT_OY = 25;
const CONT_W = 300;
const CONT_H = 210;

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
  if (zoom === 0 && r) {
    const gtx = Math.max(0, Math.min(FRAME_W - 1, Math.floor(((mx - CONT_OX) / CONT_W) * FRAME_W)));
    const gty = Math.max(0, Math.min(FRAME_H - 1, Math.floor(((my - CONT_OY) / CONT_H) * FRAME_H)));
    const [ox, oy] = windowOrigin(r);
    return {
      tx: Math.max(0, Math.min(WW - 1, gtx - ox)),
      ty: Math.max(0, Math.min(WH - 1, gty - oy)),
      gtx,
      gty,
    };
  }
  const v = viewRect(cx, cy, (zoom || 1) as LocalZoomLevel);
  const tx = Math.floor(v.x0 + (mx - v.ox) / v.px);
  const ty = Math.floor(v.y0 + (my - v.oy) / v.px);
  return { tx: Math.max(0, Math.min(WW - 1, tx)), ty: Math.max(0, Math.min(WH - 1, ty)) };
}

function renderContinentChart(
  ctx: CanvasRenderingContext2D,
  r: RunState,
  hoverGlobal: { gtx: number; gty: number } | null,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#091015';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#0c141b';
  ctx.fillRect(CONT_OX, CONT_OY, CONT_W, CONT_H);
  ctx.strokeStyle = 'rgba(214, 196, 158, 0.08)';
  ctx.lineWidth = 1;
  for (let gx = CONT_OX + 30; gx < CONT_OX + CONT_W; gx += 30) {
    ctx.beginPath(); ctx.moveTo(gx + 0.5, CONT_OY); ctx.lineTo(gx + 0.5, CONT_OY + CONT_H); ctx.stroke();
  }
  for (let gy = CONT_OY + 30; gy < CONT_OY + CONT_H; gy += 30) {
    ctx.beginPath(); ctx.moveTo(CONT_OX, gy + 0.5); ctx.lineTo(CONT_OX + CONT_W, gy + 0.5); ctx.stroke();
  }

  const [ox, oy] = windowOrigin(r);
  const discKeys = new Set<string>(r.veyraGlobalDiscovered ? Object.keys(r.veyraGlobalDiscovered) : []);
  for (let cy4 = 0; cy4 < 50; cy4++) {
    for (let cx4 = 0; cx4 < 50; cx4++) {
      if (r.discovered[cy4 * 50 + cx4]) discKeys.add(`${(ox >> 2) + cx4}:${(oy >> 2) + cy4}`);
    }
  }
  const sx = CONT_W / FRAME_W;
  const sy = CONT_H / FRAME_H;
  const cellW = Math.max(1, Math.ceil(4 * sx));
  const cellH = Math.max(1, Math.ceil(4 * sy));
  for (const k of discKeys) {
    const sep = k.indexOf(':');
    if (sep < 0) continue;
    const cx4 = Number(k.slice(0, sep)), cy4 = Number(k.slice(sep + 1));
    if (!Number.isFinite(cx4) || !Number.isFinite(cy4)) continue;
    let col = continentCellColorCache.get(k);
    if (!col) {
      const tx = Math.min(FRAME_W - 1, Math.max(0, cx4 * 4 + 2));
      const ty = Math.min(FRAME_H - 1, Math.max(0, cy4 * 4 + 2));
      col = veyraContinentTileColor(sampleTile(tx, ty).tile);
      if (continentCellColorCache.size > 24000) continentCellColorCache.clear();
      continentCellColorCache.set(k, col);
    }
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(CONT_OX + cx4 * 4 * sx), Math.floor(CONT_OY + cy4 * 4 * sy), cellW, cellH);
  }

  ctx.strokeStyle = '#475962';
  ctx.strokeRect(CONT_OX + 0.5, CONT_OY + 0.5, CONT_W - 1, CONT_H - 1);

  // Active 200x200 sector window frame
  ctx.strokeStyle = 'rgba(244, 208, 137, 0.78)';
  ctx.strokeRect(
    Math.round(CONT_OX + ox * sx) + 0.5,
    Math.round(CONT_OY + oy * sy) + 0.5,
    Math.max(4, Math.round(WW * sx)),
    Math.max(4, Math.round(WH * sy)),
  );

  const dot = (gtx: number, gty: number, col: string, s = 3) => {
    const rx = Math.round(CONT_OX + gtx * sx);
    const ry = Math.round(CONT_OY + gty * sy);
    ctx.fillStyle = '#05080b';
    ctx.fillRect(rx - 1 - (s >> 1), ry - 1 - (s >> 1), s + 2, s + 2);
    ctx.fillStyle = col;
    ctx.fillRect(rx - (s >> 1), ry - (s >> 1), s, s);
  };

  // Discovered continent POIs (po.at is in AU; 1 AU = 2 tiles on the 4000x2800 continent frame)
  for (const po of POIS) {
    if (!r.poiSeen.includes(po.id)) continue;
    const pCol = PRIMORDIAL_POI_IDS.has(po.id) ? '#ff7c66' : po.arche === 'port' || po.arche === 'heli' ? '#7fd8ff' : '#f4d089';
    dot(po.at[0] * 2, po.at[1] * 2, pCol, 3);
  }

  for (const e of Object.values(r.entities)) {
    if (!onActiveFloor(r, e)) continue;
    if (e.type === 'claim') dot(ox + e.tx!, oy + e.ty!, '#8fd45a', 4);
    if (e.kind === 'bag') dot(ox + e.x / TILE, oy + e.y / TILE, '#ff8e7a', 3);
    if (e.kind === 'cart' || e.kind === 'vehicle') dot(ox + e.x / TILE, oy + e.y / TILE, '#7fd8ff', 3);
  }
  if (r.veyraOffscreenEntities) {
    for (const oe of Object.values(r.veyraOffscreenEntities)) {
      const gtx = oe.tx !== undefined ? oe.tx : oe.x / TILE;
      const gty = oe.ty !== undefined ? oe.ty : oe.y / TILE;
      if (oe.type === 'claim') dot(gtx, gty, '#8fd45a', 4);
      if (oe.kind === 'bag') dot(gtx, gty, '#ff8e7a', 3);
      if (oe.kind === 'cart' || oe.kind === 'vehicle') dot(gtx, gty, '#7fd8ff', 3);
    }
  }

  dot(ox + r.player.x / TILE, oy + r.player.y / TILE, '#fff8e5', 4);

  if (hoverGlobal) {
    const hx = Math.round(CONT_OX + hoverGlobal.gtx * sx);
    const hy = Math.round(CONT_OY + hoverGlobal.gty * sy);
    ctx.strokeStyle = 'rgba(244,208,137,0.55)';
    ctx.strokeRect(hx - 4.5, hy - 4.5, 9, 9);
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

  // Solid fog of war over every undiscovered 4x4 cell — never reveal terrain or entities
  const startCellX = Math.max(0, Math.floor(v.x0 / 4));
  const endCellX = Math.min(49, Math.floor((v.x0 + v.wTiles) / 4));
  const startCellY = Math.max(0, Math.floor(v.y0 / 4));
  const endCellY = Math.min(49, Math.floor((v.y0 + v.hTiles) / 4));
  ctx.fillStyle = '#0d161c';
  for (let gy = startCellY; gy <= endCellY; gy++) {
    for (let gx = startCellX; gx <= endCellX; gx++) {
      if (!r.discovered[gy * 50 + gx]) {
        const sc = toScreen(gx * 4, gy * 4);
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

  // Death bag
  const death = deathBagView(r);
  if (death.status === 'present') {
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
  const bounds = useMemo(() => discoveredBounds(r), [r.discovered]);
  const initialZoom: ZoomLevel = useMemo(() => {
    if (isVeyra && !onTeleportSelect) return 0;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    return span <= 48 ? 4 : span <= 96 ? 2 : 1;
  }, [bounds, isVeyra, Boolean(onTeleportSelect)]);

  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom);
  useEffect(() => {
    if (onTeleportSelect && zoom === 0) setZoom(1);
  }, [Boolean(onTeleportSelect), zoom]);
  const [center, setCenter] = useState<{ cx: number; cy: number }>(() =>
    clampCenter((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, initialZoom),
  );
  const [marks, setMarks] = useState<FieldMark[]>(() => readFieldMarks(r, qaSession));
  const [kind, setKind] = useState<MarkKind>('return');
  const [mode, setMode] = useState<'inspect' | 'mark'>('inspect');
  const [label, setLabel] = useState('');
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ tx: number; ty: number } | null>({ tx: ptx, ty: pty });
  const [hover, setHover] = useState<{ tx: number; ty: number; gtx?: number; gty?: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sites' | 'marks' | 'intel'>('all');
  const dragRef = useRef<{ sx: number; sy: number; cx0: number; cy0: number; moved: boolean } | null>(null);

  const intel = expeditionNotes(r);
  const intelByPlace = useMemo(() => new Map(intel.map(n => [n.place, n])), [intel]);
  const death = deathBagView(r);
  const sites = w.places.filter(site => r.poiSeen.includes(site.id) && discoveredCell(r, site.tx, site.ty));
  const seenContinentPois = useMemo(() => (isVeyra ? POIS.filter(po => r.poiSeen.includes(po.id)) : []), [isVeyra, r.poiSeen]);
  const offscreenCount = useMemo(() => (
    isVeyra && r.veyraOffscreenEntities
      ? Object.values(r.veyraOffscreenEntities).filter(oe => oe.type === 'claim' || oe.kind === 'bag' || oe.kind === 'cart' || oe.kind === 'vehicle').length
      : 0
  ), [isVeyra, r.veyraOffscreenEntities]);
  const ownedCabinets = Object.values(r.entities).filter(e => (!isVeyra || onActiveFloor(r, e)) && e.type === 'claim' && e.tx !== undefined && e.ty !== undefined && discoveredCell(r, e.tx, e.ty));
  const rigs = Object.values(r.entities).filter(e => (!isVeyra || onActiveFloor(r, e)) && (e.kind === 'vehicle' || e.kind === 'cart') && discoveredCell(r, Math.floor(e.x / TILE), Math.floor(e.y / TILE)));

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    if (zoom === 0 && isVeyra) {
      renderContinentChart(ctx, r, hover?.gtx !== undefined && hover?.gty !== undefined ? { gtx: hover.gtx, gty: hover.gty } : null);
    } else {
      renderChart(ctx, r, marks, selectedMarkId, cursor, hover, center.cx, center.cy, (zoom || 1) as LocalZoomLevel, teleportTarget, mode === 'mark', intelByPlace);
    }
  }, [r, isVeyra, marks, selectedMarkId, cursor, hover, center, zoom, teleportTarget, mode, intelByPlace]);

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
    if (!discoveredCell(r, tx, ty)) {
      setSelectedMarkId(null);
      return;
    }
    const mark = marks.find(m => Math.hypot(m.tx - tx, m.ty - ty) <= 2);
    setSelectedMarkId(mark?.id ?? null);
    if (panTo) focusOn(tx, ty, 2);
  };

  // Build real inspection readout strictly from discovered data
  const inspected = useMemo(() => {
    if (!cursor) return null;
    const { tx, ty } = cursor;
    if (!discoveredCell(r, tx, ty)) {
      return { discovered: false as const, tx, ty };
    }
    const zoneName = (w.zoneNames || ZONES)[w.zone[ty * WW + tx]] ?? 'Island';
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
    const pt = canvasXY(e.clientX, e.clientY, e.currentTarget);
    const { tx, ty } = pt;
    if (zoom === 0 && isVeyra) {
      const [ox, oy] = windowOrigin(r);
      if (pt.gtx !== undefined && pt.gty !== undefined && pt.gtx >= ox && pt.gtx < ox + WW && pt.gty >= oy && pt.gty < oy + WH) {
        setZoom(1);
        inspectTile(tx, ty);
      } else if (pt.gtx !== undefined && pt.gty !== undefined) {
        setStatusMsg(`Continent AU ${Math.round(pt.gtx / 2)},${Math.round(pt.gty / 2)} · switch to 1× for active 200×200 sector.`);
      }
      return;
    }
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
    else changeZoom(zoom === 4 ? 2 : zoom === 2 ? 1 : (isVeyra && !onTeleportSelect ? 0 : 1), precise);
  };
  const onChartKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'Delete', 'Equal', 'Minus'].includes(e.code)) {
      e.preventDefault(); e.stopPropagation();
    }
    if (e.code === 'Equal') { changeZoom(zoom === 0 ? 1 : zoom === 1 ? 2 : 4); return; }
    if (e.code === 'Minus') { changeZoom(zoom === 4 ? 2 : zoom === 2 ? 1 : (isVeyra && !onTeleportSelect ? 0 : 1)); return; }
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

  const zone = (w.zoneNames || ZONES)[w.zone[pty * WW + ptx]];
  const fl = isVeyra ? activeFloor(r) : 0;
  const floorTag = fl < 0 ? `B${Math.abs(fl)}` : fl === 0 ? 'F1' : `F${fl + 1}`;
  const [ax, ay] = isVeyra ? playerGlobalAu(r) : [0, 0];
  const totalSiteCount = (isVeyra ? Math.max(sites.length, seenContinentPois.length) : sites.length) + ownedCabinets.length;

  return <Panel title={<span className="map-heading">
    FIELD CHART
    <span>{zone}{isVeyra ? ` · AU ${ax.toFixed(0)},${ay.toFixed(0)} · ${floorTag}` : ''} · {bounds.pct}% charted · {runHours(r, api.now()).toFixed(1)}h</span>
  </span>}
    className="field-map" style={{ left: 14, top: 8, width: 612, height: 344, boxSizing: 'border-box' }} onClose={() => api.open(null)}>
    <div className="field-map__body">
      {/* LEFT: Chart Canvas + Zoom/Navigation Controls */}
      <div className="chart-column">
        <div className="chart-controls">
          <div className="chart-zoom" role="group" aria-label="Map zoom">
            {isVeyra && <button data-testid="map-mode-continent" className={`btn sm ${zoom === 0 ? 'gold' : 'ghost'}`} onClick={() => changeZoom(0)} title="Veyra Continent 4000×2800 Fog of War">Cont</button>}
            {([1, 2, 4] as LocalZoomLevel[]).map(z => <button key={z} data-testid={isVeyra && z === 1 ? 'map-mode-local' : undefined} className={`btn sm ${zoom === z ? 'gold' : 'ghost'}`} onClick={() => changeZoom(z)} title={z === 1 ? 'Full sector overview' : z === 2 ? 'Sector zoom' : 'Tactical zoom'}>{z}×</button>)}
            <button className="btn sm ghost" onClick={fitExplored} title="Frame explored territory">Fit</button>
            <button className="btn sm ghost" onClick={() => { inspectTile(ptx, pty); focusOn(ptx, pty, 2); }} title="Center on player">You</button>
          </div>
          <span className="chart-coords">
            {zoom === 0 && isVeyra
              ? (hover?.gtx !== undefined && hover?.gty !== undefined ? `AU ${Math.round(hover.gtx / 2)},${Math.round(hover.gty / 2)}` : `AU ${ax.toFixed(0)},${ay.toFixed(0)}`)
              : (hover ? (discoveredCell(r, hover.tx, hover.ty) ? `${hover.tx},${hover.ty}` : 'Uncharted') : `${ptx},${pty}`)}
          </span>
        </div>

        <div className="chart-frame">
          <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className="chart-canvas" tabIndex={0} role="img"
            aria-label="Explored island map. Drag to pan, wheel or 1x/2x/4x to zoom, arrows move cursor, Enter inspects or marks."
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerLeave={() => { dragRef.current = null; setHover(null); }}
            onWheel={onWheel} onKeyDown={onChartKey}
            onContextMenu={e => { e.preventDefault(); const { tx, ty } = canvasXY(e.clientX, e.clientY, e.currentTarget); const m = marks.find(mk => Math.hypot(mk.tx - tx, mk.ty - ty) <= 2); if (m) removeMark(m.id); }} />
          <div className="chart-compass">N↑</div>
          {onTeleportSelect && <div className="chart-teleport-pill">CORE BLINK · select safe explored ground</div>}
        </div>

        <div className="map-toolbar">
          <button className={`btn sm ${mode === 'mark' ? 'gold' : ''}`} onClick={() => setMode(m => m === 'mark' ? 'inspect' : 'mark')}>
            {mode === 'mark' ? 'Click chart to mark' : '+ Leave note'}
          </button>
          <button className="btn sm" title="Save note at your current position" onClick={() => addMarkAt(ptx, pty)}>Mark my spot</button>
          <span className="map-legend" aria-hidden="true">
            <i style={{ color: '#fff8e5' }}>◆</i>You
            <i style={{ color: '#f4d089' }}>◎</i>Site
            <i style={{ color: '#8fd45a' }}>■</i>Cab
            <i style={{ color: '#ff8e7a' }}>✕</i>Bag
          </span>
          <span className="map-key">{marks.length}/18</span>
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
          {!inspected ? (
            <div className="map-inspector__empty">Click or move cursor over explored ground to inspect terrain, sites, intel, or notes.</div>
          ) : !inspected.discovered ? (
            <div className="map-inspector__fog">
              <b>Uncharted Sector · ({inspected.tx}, {inspected.ty})</b>
              <span>Terrain, landmarks, and structures remain hidden until explored on foot.</span>
            </div>
          ) : (
            <>
              <div className="map-inspector__head">
                <div>
                  <b>{inspected.poi ? inspected.poi.name : inspected.bagHere ? 'Your Death Bag' : inspected.cab ? 'Territory Cabinet' : inspected.mark ? inspected.mark.label : inspected.zoneName}</b>
                  <span>{inspected.zoneName} · {inspected.surface} · ({inspected.tx},{inspected.ty}) · {inspected.bearing}</span>
                </div>
                <button className="btn sm ghost" title="Pin a note at this tile" onClick={() => addMarkAt(inspected.tx, inspected.ty)}>+ Pin</button>
              </div>

              {inspected.bagHere && <div className="map-inspector__tag bad">
                <b>Death Bag</b> · {inspected.bagHere.stacks.length} stack{inspected.bagHere.stacks.length === 1 ? '' : 's'} ({inspected.bagHere.cause})
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
                    <span>{g.requirement === 'power' ? 'Power gate' : `${g.cardClass ?? 'Vault'} keycard`} · <b>{g.have}/{g.need}</b> {g.carried ? 'carried' : g.craft ? 'craftable' : 'missing'}</span>
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
          {([['all', 'All'], ['sites', `Sites ${totalSiteCount}`], ['marks', `Notes ${marks.length}`], ['intel', `Intel ${intel.length}`]] as const).map(([id, lbl]) => (
            <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{lbl}</button>
          ))}
        </div>

        <div className="map-list scroll">
          {(filter === 'all' || filter === 'sites') && <>
            {isVeyra && offscreenCount > 0 && <div className="map-note" style={{ color: '#9ae0ff' }}>Offscreen markers: {offscreenCount} (shown on Cont view)</div>}
            {death.status === 'present' && (
              <button className="map-row map-row--bag" onClick={() => inspectTile(Math.floor(death.bag.x / TILE), Math.floor(death.bag.y / TILE), true)}>
                <b>✕ Your Death Bag</b>
                <span>{Math.floor(death.bag.x / TILE)},{Math.floor(death.bag.y / TILE)} · {death.stacks.length} stacks · {bearingLabel(Math.floor(death.bag.x / TILE) - ptx, Math.floor(death.bag.y / TILE) - pty)}</span>
              </button>
            )}
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
            {sites.map(site => {
              const n = intelByPlace.get(site.id);
              return <button key={site.id} className="map-row" onClick={() => inspectTile(site.tx, site.ty, true)}>
                <b>◎ {site.name}{n ? ` · ${n.gates.length} gate${n.gates.length === 1 ? '' : 's'}${n.blueprints.length ? ` · ${n.blueprints.length} BP` : ''}` : ''}</b>
                <span>{site.tx},{site.ty} · {bearingLabel(site.tx - ptx, site.ty - pty)}</span>
              </button>;
            })}
            {isVeyra && seenContinentPois.filter(po => !sites.some(s => s.id === po.id)).map(po => (
              <button key={po.id} className="map-row" onClick={() => changeZoom(0)}>
                <b style={{ color: PRIMORDIAL_POI_IDS.has(po.id) ? '#ff8a7a' : '#f4d089' }}>◎ {po.name}</b>
                <span>Continent AU {po.at[0]},{po.at[1]}</span>
              </button>
            ))}
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
              {n.gates.map((g, i) => <div className="map-gate" key={i}><Icon k={g.item} size={12} /><span>{g.requirement === 'power' ? 'Power access' : 'Keycard access'}<small>{g.have}/{g.need} carried · {g.carried ? 'in pack' : g.craft ? 'recipe known' : 'find it'}</small></span>
                {g.craft && !g.carried && <button className="btn sm" onClick={() => api.open({ kind: 'craft', recipe: g.craft!.recipe })}>Recipe</button>}</div>)}
              {n.blueprints.map(b => <div key={b.recipe} className="map-gate"><Icon k="blueprint" size={11} /><span>{b.name}<small>{b.state === 'seen' ? 'seen earlier · may be gone' : b.state === 'owned' ? 'in pack · not learned' : 'learned'}</small></span></div>)}
            </div>;
          })}

          {filter === 'sites' && !sites.length && !ownedCabinets.length && !rigs.length && death.status !== 'present' &&
            <div className="map-note">No charted sites yet. Explore to reveal them; unknown sites stay hidden.</div>}
          {filter === 'marks' && !marks.length &&
            <div className="map-note">No notes placed. Select “Leave note”, then click explored terrain.</div>}
          {filter === 'intel' && !intel.length &&
            <div className="map-note">No field intelligence recorded. Inspect known POIs to reveal their observed access requirements.</div>}
          {filter === 'all' && !sites.length && !ownedCabinets.length && !rigs.length && !marks.length && !intel.length && death.status !== 'present' &&
            <div className="map-note">Begin exploring. The chart records only the terrain you have actually visited.</div>}
        </div>
      </div>
    </div>
  </Panel>;
}
