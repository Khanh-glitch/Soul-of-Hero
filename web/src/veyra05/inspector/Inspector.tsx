/**
 * UNIFIED VEYRA WORLD OVERVIEW & INSPECTOR (TASK 2 & TASK 7).
 *
 * Covers the complete 4000x2800-tile (2000x1400 AU) canonical Veyra frame in ONE
 * interactive map without ever materialising an 11.2M-cell array or 4000x2800
 * full-resolution canvas:
 *   - Progressive stride-8 base island canvas (500x350) + lazy bounded 1:1 tile
 *     detail viewport canvas (<= 680x500) streamed from getChunk(cx, cy).
 *   - Full-island pan & zoom (Fit, 0.5x, 1x, 2x, wheel zoom, drag pan).
 *   - 5 toggleable layers: Terrain, Roads/Bridges/Docks, POIs/Buildings (81),
 *     Sources (live compileEconomy preview), Regions/Windows/Player.
 *   - Two distinct operating modes:
 *       * GAMEPLAY MAP: enforces player fog-of-war (r.discovered / global) &
 *         r.poiSeen; hides undiscovered secrets; forbids teleportation.
 *       * CREATOR INSPECTION: unrestricted inspection of all 81 POIs, generated
 *         buildings/roofs/doors/walls/floors, MGP-D01..D10 blockers, 1x native
 *         actual-game visual preview (renderGamePreview), and controlled
 *         Creator inspection launch at any POI/tile (marks run QA).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { T, TILE, WW, WH, type GameState } from '../../game/core';
import { FRAME_W, FRAME_H, CHUNK, U, auToTile, windowAround } from '../frame';
import { sampleTile, GOLD, POIS, SOURCE, BIOME_NAMES } from '../reader';
import { getChunk, streamStats, CL } from '../chunks';
import { VEYRA05_SCENES, windowForLayout, layoutIdAt } from '../scenes';
import { getAllPoiLayouts, getPoiLayout, slicePoisForWindow, type GlobalPoiLayout } from '../poi-kit';
import { getWindowWorld } from '../window';
import { decorKit, DECOR_INVENTORY } from '../art-nature';
import { renderGamePreview } from '../preview-render';
import { playerGlobalTile, playerGlobalAu, windowOrigin } from '../continuity';
import { PATCH_HUNKS } from '../integration-manifest';

const STRIDE = 8;
const OW = FRAME_W / STRIDE; // 500
const OH = FRAME_H / STRIDE; // 350

const COL: Record<number, string> = {
  [T.DEEP]: '#1e3c6a', [T.SHALLOW]: '#3478aa', [T.RIVER]: '#3478a8',
  [T.SAND]: '#dcc68e', [T.GRASS]: '#4f8a3a', [T.MEADOW]: '#7aa84a',
  [T.FOREST]: '#33662a', [T.MARSH]: '#4a6a3e', [T.HILL]: '#8a7a62',
  [T.CLIFF]: '#6e6a66', [T.SNOW]: '#e6eef6', [T.ASH]: '#4a4044',
  [T.TOXIC]: '#6a7038', [T.ROAD]: '#a08060', [T.BRIDGE]: '#8a6038',
  [T.FLOOR]: '#c88c52', [T.PWALL]: '#e6d8c0', [T.LAVA]: '#c83a1e',
  [T.BURNT]: '#2e2826', [T.ICE]: '#b8e0f0',
};

export type OverviewMode = 'gameplay' | 'creator';

export interface InspectorProps {
  gs: GameState;
  initialMode?: OverviewMode;
  onClose: () => void;
  onLaunchCreatorInspect: (layoutId: string, tx: number, ty: number, label: string) => void;
}

export default function Inspector({ gs, initialMode = 'creator', onClose, onLaunchCreatorInspect }: InspectorProps) {
  const run = gs.run && !gs.run.ended ? gs.run : null;
  const hasGameplayRun = !!run && !!run.layoutId?.startsWith('veyra05-');

  const [mode, setMode] = useState<OverviewMode>(initialMode);
  const [drawer, setDrawer] = useState<'none' | 'matrix' | 'audit' | 'assets' | 'patch'>('none');

  // Toggleable map layers
  const [layers, setLayers] = useState({
    terrain: true,
    roads: true,
    pois: true,
    sources: false,
    regions: true,
  });
  const toggleLayer = (k: keyof typeof layers) => setLayers(prev => ({ ...prev, [k]: !prev[k] }));

  // Viewport pan & zoom in global tile coordinates (4000 x 2800)
  const VIEW_PX_W = 760, VIEW_PX_H = 532; // fits cleanly inside 1280x720 alongside the 460px inspector panel
  const FIT_ZOOM = VIEW_PX_W / FRAME_W;   // 0.19 px/tile
  const [zoom, setZoom] = useState<number>(FIT_ZOOM);
  const [camTile, setCamTile] = useState<{ x: number; y: number }>({ x: FRAME_W / 2, y: FRAME_H / 2 });
  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);

  // Selected POI or global tile
  const [selPoiId, setSelPoiId] = useState<string>('po_greywater');
  const [selTile, setSelTile] = useState<{ tx: number; ty: number }>({ tx: 1624, ty: 1184 });
  const [hoverInfo, setHoverInfo] = useState<string>('Hover over Veyra to inspect coordinates, biome, chunk & POI');
  const [poiFilter, setPoiFilter] = useState<'all' | 'pilot' | 'enclosed' | 'open' | 'river'>('all');
  const [poiQuery, setPoiQuery] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  const baseCvRef = useRef<HTMLCanvasElement | null>(null);
  const viewCvRef = useRef<HTMLCanvasElement>(null);
  const previewCvRef = useRef<HTMLCanvasElement>(null);
  const sheetCvRef = useRef<HTMLCanvasElement>(null);

  const allPois = useMemo<GlobalPoiLayout[]>(() => getAllPoiLayouts(), []);
  const selectedPoi = useMemo(() => (selPoiId ? getPoiLayout(selPoiId) : null), [selPoiId]);

  const filteredPois = useMemo(() => {
    const q = poiQuery.trim().toLowerCase();
    return allPois.filter(p => {
      if (mode === 'gameplay' && (!run || !run.poiSeen.includes(p.id))) return false;
      if (poiFilter === 'pilot' && p.mode !== 'PILOT_U05') return false;
      if (poiFilter === 'enclosed' && p.mode !== 'KIT_ENCLOSED') return false;
      if (poiFilter === 'open' && p.mode !== 'KIT_OPEN_AIR') return false;
      if (poiFilter === 'river' && !p.conflicts.some(c => c.includes('MGP-D09'))) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q) && !p.arche.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allPois, poiFilter, poiQuery, mode, run]);

  // Build progressive stride-8 offscreen island canvas (500x350) once
  useEffect(() => {
    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    baseCvRef.current = cv;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(OW, 1);
    let y = 0, raf = 0;
    const step = () => {
      const t0 = performance.now();
      while (y < OH && performance.now() - t0 < 14) {
        for (let x = 0; x < OW; x++) {
          const s = sampleTile(x * STRIDE + 4, y * STRIDE + 4);
          let col = COL[s.tile] || '#4f8a3a';
          if (s.poi >= 0 && s.land && !s.river && !s.lake) col = '#d8b46a';
          const n = parseInt(col.slice(1), 16);
          img.data[x * 4] = n >> 16;
          img.data[x * 4 + 1] = (n >> 8) & 255;
          img.data[x * 4 + 2] = n & 255;
          img.data[x * 4 + 3] = 255;
        }
        g.putImageData(img, 0, y);
        y++;
      }
      setProgress(y / OH);
      if (y < OH) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Build lookup of discovered 4x4 cells for GAMEPLAY MAP mode
  const discoveredSet = useMemo(() => {
    const s = new Set<string>();
    if (!run) return s;
    if (run.veyraGlobalDiscovered) {
      for (const k of Object.keys(run.veyraGlobalDiscovered)) s.add(k);
    }
    const [ox, oy] = hasGameplayRun ? windowOrigin(run) : [0, 0];
    for (let cy4 = 0; cy4 < 50; cy4++) {
      for (let cx4 = 0; cx4 < 50; cx4++) {
        if (run.discovered[cy4 * 50 + cx4]) s.add(`${(ox >> 2) + cx4}:${(oy >> 2) + cy4}`);
      }
    }
    return s;
  }, [run, hasGameplayRun]);

  // Active window sources (when Sources layer is enabled)
  const activeWinWorld = useMemo(() => {
    if (!layers.sources || mode !== 'creator') return null;
    const win = windowAround(selTile.tx, selTile.ty);
    return getWindowWorld(layoutIdAt(win.originTx, win.originTy));
  }, [layers.sources, mode, selTile]);

  // Draw main interactive map canvas (pan + zoom + lazy 1:1 tile detail + fog-of-war + overlays)
  useEffect(() => {
    const cv = viewCvRef.current;
    if (!cv) return;
    cv.width = VIEW_PX_W;
    cv.height = VIEW_PX_H;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0c1628';
    g.fillRect(0, 0, VIEW_PX_W, VIEW_PX_H);

    const halfW = VIEW_PX_W / (2 * zoom);
    const halfH = VIEW_PX_H / (2 * zoom);
    const tx0 = camTile.x - halfW;
    const ty0 = camTile.y - halfH;
    const toScreenX = (tx: number) => (tx - tx0) * zoom;
    const toScreenY = (ty: number) => (ty - ty0) * zoom;

    // 1. Base terrain layer
    if (layers.terrain && baseCvRef.current) {
      g.drawImage(
        baseCvRef.current,
        0, 0, OW, OH,
        toScreenX(0), toScreenY(0), FRAME_W * zoom, FRAME_H * zoom,
      );
    }

    // 2. When zoomed in (zoom >= 0.65), lazily stream 1:1 exact U=0.5 tiles & POI buildings for the visible rectangle!
    if (layers.terrain && zoom >= 0.65) {
      const gxStart = Math.max(0, Math.floor(tx0));
      const gyStart = Math.max(0, Math.floor(ty0));
      const gxEnd = Math.min(FRAME_W, Math.ceil(tx0 + VIEW_PX_W / zoom));
      const gyEnd = Math.min(FRAME_H, Math.ceil(ty0 + VIEW_PX_H / zoom));
      const wTiles = gxEnd - gxStart, hTiles = gyEnd - gyStart;
      if (wTiles > 0 && hTiles > 0 && wTiles * hTiles <= 700_000) {
        const win = windowAround(Math.round((gxStart + gxEnd) / 2), Math.round((gyStart + gyEnd) / 2));
        const slice = slicePoisForWindow(win);
        const detailCv = document.createElement('canvas');
        detailCv.width = wTiles;
        detailCv.height = hTiles;
        const dg = detailCv.getContext('2d')!;
        const img = dg.createImageData(wTiles, hTiles);
        for (let y = 0; y < hTiles; y++) {
          const gy = gyStart + y;
          const cy = Math.floor(gy / CHUNK);
          for (let x = 0; x < wTiles; x++) {
            const gx = gxStart + x;
            const cx = Math.floor(gx / CHUNK);
            const c = getChunk(cx, cy);
            const ci = (gy - cy * CHUNK) * CHUNK + (gx - cx * CHUNK);
            const lx = gx - win.originTx, ly = gy - win.originTy;
            const ov = (lx >= 0 && ly >= 0 && lx < WW && ly < WH) ? slice.tileOverrides.get(ly * WW + lx) : undefined;
            const t = ov !== undefined ? ov : c.tile[ci];
            let col = COL[t] || '#4f8a3a';
            if (ov === undefined && (c.clim[ci] & CL.INTERIOR) && t === T.FOREST) col = '#24501e';
            const n = parseInt(col.slice(1), 16);
            const o = (y * wTiles + x) * 4;
            img.data[o] = n >> 16;
            img.data[o + 1] = (n >> 8) & 255;
            img.data[o + 2] = n & 255;
            img.data[o + 3] = 255;
          }
        }
        dg.putImageData(img, 0, 0);
        g.drawImage(detailCv, toScreenX(gxStart), toScreenY(gyStart), wTiles * zoom, hTiles * zoom);

        // Draw registered building roof footprints in detail zoom
        if (layers.pois) {
          for (const b of slice.buildings) {
            const bx = toScreenX(win.originTx + b.x), by = toScreenY(win.originTy + b.y);
            g.fillStyle = b.roof === 'tile' ? 'rgba(200,90,60,0.65)' : b.roof === 'tin' ? 'rgba(140,165,180,0.65)' : b.roof === 'light' ? 'rgba(240,80,70,0.75)' : 'rgba(215,175,95,0.65)';
            g.fillRect(bx, by, b.w * zoom, b.h * zoom);
            g.strokeStyle = '#140c14';
            g.lineWidth = 1;
            g.strokeRect(bx + 0.5, by + 0.5, b.w * zoom - 1, b.h * zoom - 1);
          }
        }
      }
    }

    // 3. Roads, Bridges (12 unresolved) & Docks (27)
    if (layers.roads) {
      g.strokeStyle = 'rgba(220, 185, 130, 0.72)';
      g.lineWidth = Math.max(1, zoom * 1.4);
      for (const rd of GOLD.project.roads) {
        if (rd.kind === 'ferry') continue;
        g.beginPath();
        rd.points.forEach(([ax, ay], idx) => {
          const sx = toScreenX(ax * 2), sy = toScreenY(ay * 2);
          if (idx === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
        });
        g.stroke();
      }
      // Unresolved bridge nodes (MGP-D01)
      for (const br of GOLD.project.bridges) {
        const sx = toScreenX(br.at[0] * 2), sy = toScreenY(br.at[1] * 2);
        if (sx < -12 || sy < -12 || sx > VIEW_PX_W + 12 || sy > VIEW_PX_H + 12) continue;
        g.strokeStyle = '#ff5a4a';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(sx - 3, sy - 3); g.lineTo(sx + 3, sy + 3);
        g.moveTo(sx + 3, sy - 3); g.lineTo(sx - 3, sy + 3);
        g.stroke();
      }
      // Docks (MGP-D03)
      g.fillStyle = '#5af0ff';
      for (const dk of GOLD.project.docks) {
        const sx = toScreenX(dk.at[0] * 2), sy = toScreenY(dk.at[1] * 2);
        if (sx < -8 || sy < -8 || sx > VIEW_PX_W + 8 || sy > VIEW_PX_H + 8) continue;
        g.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }

    // 4. Live Sources overlay (on focused 200x200 window in Creator mode)
    if (layers.sources && activeWinWorld && mode === 'creator') {
      const { world, win } = activeWinWorld;
      for (let y = 0; y < WH; y++) {
        for (let x = 0; x < WW; x++) {
          const sk = world.sourceV3[y * WW + x];
          if (!sk) continue;
          const sx = toScreenX(win.originTx + x), sy = toScreenY(win.originTy + y);
          if (sx < 0 || sy < 0 || sx > VIEW_PX_W || sy > VIEW_PX_H) continue;
          g.fillStyle = sk === 'rock' || sk === 'iron' || sk === 'coalv' ? '#d0d8e0' : sk === 'bush' || sk === 'herb' ? '#ff7aa0' : '#7aff6a';
          g.fillRect(sx, sy, Math.max(1.5, zoom), Math.max(1.5, zoom));
        }
      }
    }

    // 5. Regions, Authored Windows & Labels
    if (layers.regions) {
      if (mode === 'creator') {
        for (const sc of VEYRA05_SCENES) {
          const w = windowForLayout(sc.id)!.win;
          const sx = toScreenX(w.originTx), sy = toScreenY(w.originTy);
          g.strokeStyle = sc.firstHour ? 'rgba(255, 217, 138, 0.7)' : 'rgba(138, 208, 255, 0.55)';
          g.lineWidth = 1;
          g.strokeRect(sx, sy, w.w * zoom, w.h * zoom);
        }
        // 4 GOLD spawns
        for (const sp of GOLD.project.spawns) {
          const sx = toScreenX(sp.at[0] * 2), sy = toScreenY(sp.at[1] * 2);
          g.fillStyle = '#7aff6a';
          g.beginPath(); g.arc(sx, sy, 3.5, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#000'; g.stroke();
        }
      }
      g.font = '10px ui-monospace, monospace';
      g.textAlign = 'center';
      for (const lb of GOLD.project.labels) {
        const sx = toScreenX(lb.at[0] * 2), sy = toScreenY(lb.at[1] * 2);
        if (sx < 10 || sy < 10 || sx > VIEW_PX_W - 10 || sy > VIEW_PX_H - 10) continue;
        const txt = (lb as any).text || (lb as any).name || '';
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillText(txt, sx + 1, sy + 1);
        g.fillStyle = 'rgba(255, 245, 220, 0.88)';
        g.fillText(txt, sx, sy);
      }
      g.textAlign = 'left';
    }

    // 6. All 81 POIs (filtered by discovery in GAMEPLAY MAP mode)
    if (layers.pois) {
      for (const p of allPois) {
        if (mode === 'gameplay' && (!run || !run.poiSeen.includes(p.id))) continue;
        const sx = toScreenX(p.atTile[0]), sy = toScreenY(p.atTile[1]);
        if (sx < -16 || sy < -16 || sx > VIEW_PX_W + 16 || sy > VIEW_PX_H + 16) continue;
        const isSel = selectedPoi?.id === p.id;
        const r = isSel ? 5.5 : p.mode === 'PILOT_U05' ? 4.2 : 3.2;
        g.fillStyle = p.mode === 'PILOT_U05' ? '#ffd98a' : p.mode === 'KIT_ENCLOSED' ? '#5af0ff' : '#c89aff';
        g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = p.conflicts.some(c => c.includes('MGP-D09')) ? '#ff4a3a' : '#120c18';
        g.lineWidth = isSel ? 2 : 1;
        g.stroke();
        if (isSel || zoom >= 0.45) {
          g.font = isSel ? 'bold 11px ui-monospace, monospace' : '9px ui-monospace, monospace';
          g.fillStyle = '#000';
          g.fillText(p.name, sx + 7, sy + 4);
          g.fillStyle = isSel ? '#ffe27a' : '#fff';
          g.fillText(p.name, sx + 6, sy + 3);
        }
      }
    }

    // 7. GAMEPLAY MAP Fog-of-War (enforced when mode === 'gameplay')
    if (mode === 'gameplay') {
      g.fillStyle = 'rgba(10, 8, 18, 0.86)';
      // Coarse 32-tile (2-chunk) fog blocks across the visible viewport
      const step = 16; // 16 tiles = 4x4 cell group
      const gx0 = Math.max(0, Math.floor(tx0 / step) * step);
      const gy0 = Math.max(0, Math.floor(ty0 / step) * step);
      const gx1 = Math.min(FRAME_W, Math.ceil((tx0 + VIEW_PX_W / zoom) / step) * step);
      const gy1 = Math.min(FRAME_H, Math.ceil((ty0 + VIEW_PX_H / zoom) / step) * step);
      for (let gy = gy0; gy < gy1; gy += step) {
        for (let gx = gx0; gx < gx1; gx += step) {
          let any = false;
          for (let dy = 0; dy < 4 && !any; dy++) for (let dx = 0; dx < 4 && !any; dx++) {
            if (discoveredSet.has(`${(gx >> 2) + dx}:${(gy >> 2) + dy}`)) any = true;
          }
          if (!any) {
            g.fillRect(toScreenX(gx), toScreenY(gy), step * zoom + 0.5, step * zoom + 0.5);
          }
        }
      }
    }

    // 8. Active 200x200 window & live player position
    const activeWin = windowAround(selTile.tx, selTile.ty);
    if (mode === 'creator') {
      g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      g.lineWidth = 1.5;
      g.setLineDash([4, 3]);
      g.strokeRect(toScreenX(activeWin.originTx), toScreenY(activeWin.originTy), activeWin.w * zoom, activeWin.h * zoom);
      g.setLineDash([]);
    }
    if (hasGameplayRun && run) {
      const [ptx, pty] = playerGlobalTile(run);
      const [ox, oy] = windowOrigin(run);
      g.strokeStyle = '#7aff6a';
      g.lineWidth = 1.5;
      g.strokeRect(toScreenX(ox), toScreenY(oy), WW * zoom, WH * zoom);
      const psx = toScreenX(ptx), psy = toScreenY(pty);
      g.fillStyle = '#ff4a8a';
      g.beginPath(); g.arc(psx, psy, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
  }, [zoom, camTile, layers, mode, allPois, selectedPoi, selTile, progress, discoveredSet, activeWinWorld, hasGameplayRun, run]);

  // Render 1x native actual-game visual preview (320x180) near the selected POI/tile
  useEffect(() => {
    if (!previewCvRef.current) return;
    if (mode === 'gameplay' && (!run || (selectedPoi && !run.poiSeen.includes(selectedPoi.id)))) {
      const g = previewCvRef.current.getContext('2d')!;
      previewCvRef.current.width = 320; previewCvRef.current.height = 180;
      g.fillStyle = '#120c18'; g.fillRect(0, 0, 320, 180);
      g.fillStyle = '#8a7a9a'; g.font = '11px ui-monospace, monospace';
      g.fillText('Undiscovered in Gameplay Map mode', 42, 92);
      return;
    }
    renderGamePreview(previewCvRef.current, selTile.tx, selTile.ty);
  }, [selTile, mode, run, selectedPoi]);

  // Candidate art sheet when drawer === 'assets'
  useEffect(() => {
    if (drawer !== 'assets' || !sheetCvRef.current) return;
    const kit = decorKit();
    const cv = sheetCvRef.current;
    cv.width = 640; cv.height = 240;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#3f7a32'; g.fillRect(0, 0, 640, 120);
    g.fillStyle = '#7aa84a'; g.fillRect(0, 120, 640, 120);
    let x = 6, y = 6;
    for (const a of kit.values()) {
      const v = a.variants[0];
      if (x + v.width > 632) { x = 6; y += 26; }
      g.drawImage(v, x, y + 20 - v.height);
      x += Math.max(v.width, 16) + 6;
    }
    g.fillStyle = '#fff'; g.font = '10px monospace';
    g.fillText('1x native gameplay scale', 6, 115);
    let x2 = 6, y2 = 126;
    for (const a of kit.values()) {
      const v = a.variants[0];
      if (x2 + v.width * 2 > 632) { x2 = 6; y2 += 42; }
      if (y2 > 215) break;
      g.drawImage(v, x2, y2 + 34 - v.height * 2, v.width * 2, v.height * 2);
      x2 += Math.max(v.width * 2, 24) + 8;
    }
    g.fillStyle = '#fff';
    g.fillText('2x inspection scale', 6, 235);
  }, [drawer]);

  const inventory = useMemo(() => (typeof document !== 'undefined' ? DECOR_INVENTORY() : []), []);
  const stats = streamStats();

  const focusPoi = (p: GlobalPoiLayout) => {
    setSelPoiId(p.id);
    setSelTile({ tx: p.atTile[0], ty: p.atTile[1] });
    setCamTile({ x: p.atTile[0], y: p.atTile[1] });
    if (zoom < 0.75) setZoom(1.0);
  };

  const screenToGlobalTile = (clientX: number, clientY: number, rect: DOMRect): [number, number] => {
    const sx = clientX - rect.left, sy = clientY - rect.top;
    const tx = Math.max(0, Math.min(FRAME_W - 1, Math.floor(camTile.x - VIEW_PX_W / (2 * zoom) + sx / zoom)));
    const ty = Math.max(0, Math.min(FRAME_H - 1, Math.floor(camTile.y - VIEW_PX_H / (2 * zoom) + sy / zoom)));
    return [tx, ty];
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, cx: camTile.x, cy: camTile.y, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.sx, dy = e.clientY - dragRef.current.sy;
      if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        setCamTile({
          x: Math.max(0, Math.min(FRAME_W, dragRef.current.cx - dx / zoom)),
          y: Math.max(0, Math.min(FRAME_H, dragRef.current.cy - dy / zoom)),
        });
        return;
      }
    }
    const [tx, ty] = screenToGlobalTile(e.clientX, e.clientY, rect);
    const s = sampleTile(tx, ty);
    const chunkX = Math.floor(tx / CHUNK), chunkY = Math.floor(ty / CHUNK);
    const nearPoi = allPois
      .filter(p => mode === 'creator' || (run && run.poiSeen.includes(p.id)))
      .map(p => ({ p, d: Math.hypot(p.atTile[0] - tx, p.atTile[1] - ty) }))
      .sort((a, b) => a.d - b.d)[0];
    setHoverInfo(
      `Tile ${tx},${ty} · AU ${(tx * U).toFixed(1)},${(ty * U).toFixed(1)} · Chunk veyra05|${chunkX}:${chunkY} · ${s.land ? (s.river ? 'river' : s.lake ? 'lake' : s.road ? 'road' : BIOME_NAMES[s.biome]) : 'sea'}` +
      (nearPoi && nearPoi.d < 36 ? ` · ${nearPoi.p.name} (${nearPoi.p.id})` : ''),
    );
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDrag = dragRef.current?.moved;
    dragRef.current = null;
    if (wasDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [tx, ty] = screenToGlobalTile(e.clientX, e.clientY, rect);
    const nearPoi = allPois
      .filter(p => mode === 'creator' || (run && run.poiSeen.includes(p.id)))
      .map(p => ({ p, d: Math.hypot(p.atTile[0] - tx, p.atTile[1] - ty) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearPoi && nearPoi.d <= Math.max(24, 14 / zoom)) {
      setSelPoiId(nearPoi.p.id);
      setSelTile({ tx: nearPoi.p.atTile[0], ty: nearPoi.p.atTile[1] });
    } else {
      setSelPoiId('');
      setSelTile({ tx, ty });
    }
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.35 : 1 / 1.35;
    setZoom(z => Math.max(FIT_ZOOM, Math.min(3.0, Number((z * factor).toFixed(3)))));
  };

  const selSample = sampleTile(selTile.tx, selTile.ty);
  const selWin = windowAround(selTile.tx, selTile.ty);
  const selChunk = [Math.floor(selTile.tx / CHUNK), Math.floor(selTile.ty / CHUNK)];

  const handleLaunchInspect = () => {
    if (mode !== 'creator') return;
    // Choose the POI's walkable exterior approach / door outside tile if a POI is selected
    let targetTx = selTile.tx, targetTy = selTile.ty;
    let label = `Inspect ${selTile.tx},${selTile.ty}`;
    if (selectedPoi) {
      label = selectedPoi.name;
      if (selectedPoi.doors.length > 0) {
        const d = selectedPoi.doors[0];
        targetTx = d.tx; targetTy = d.ty + 2;
      } else {
        targetTx = selectedPoi.atTile[0]; targetTy = selectedPoi.atTile[1];
      }
    }
    const win = windowAround(targetTx, targetTy);
    const lid = layoutIdAt(win.originTx, win.originTy);
    onLaunchCreatorInspect(lid, targetTx - win.originTx, targetTy - win.originTy, label);
  };

  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', color: '#e8e0f0', background: '#100b16', width: '100vw', height: '100vh', overflow: 'auto', padding: 10, boxSizing: 'border-box' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #382c46', paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '4px 10px', background: '#ffd98a', color: '#140c18', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back to Game
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffd98a' }}>VEYRA WORLD OVERVIEW (4000×2800 · U=0.5)</span>
          <span style={{ fontSize: 11, color: '#b8a8c8' }}>
            GOLD {SOURCE.goldSha256.slice(0, 8)} · {SOURCE.wmp04r1} · {Math.round(progress * 100)}% streamed
          </span>
        </div>

        {/* Operating Mode Switcher: GAMEPLAY MAP vs CREATOR INSPECTION */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            data-testid="mode-gameplay" onClick={() => setMode('gameplay')}
            style={{
              padding: '4px 9px', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
              background: mode === 'gameplay' ? '#4f8a3a' : '#221a2c',
              color: mode === 'gameplay' ? '#fff' : '#b8a8c8',
              border: '1px solid #5a4a6a', fontWeight: mode === 'gameplay' ? 700 : 400,
            }}
            title="Normal player discovery rules (fog-of-war + poiSeen; no teleportation)"
          >
            GAMEPLAY MAP
          </button>
          <button
            data-testid="mode-creator" onClick={() => setMode('creator')}
            style={{
              padding: '4px 9px', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
              background: mode === 'creator' ? '#c8902a' : '#221a2c',
              color: mode === 'creator' ? '#140c18' : '#b8a8c8',
              border: '1px solid #5a4a6a', fontWeight: mode === 'creator' ? 700 : 400,
            }}
            title="Unrestricted development inspection of all 81 POIs, buildings & Creator spawn fixtures"
          >
            CREATOR INSPECTION
          </button>
          <button data-testid="tab-matrix" onClick={() => setDrawer(d => d === 'matrix' ? 'none' : 'matrix')} style={{ padding: '4px 8px', fontFamily: 'inherit', fontSize: 11, background: drawer === 'matrix' ? '#5a4a6a' : '#1b1424', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>
            81-POI Matrix
          </button>
          <button data-testid="tab-audit" onClick={() => setDrawer(d => d === 'audit' ? 'none' : 'audit')} style={{ padding: '4px 8px', fontFamily: 'inherit', fontSize: 11, background: drawer === 'audit' ? '#5a4a6a' : '#1b1424', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>
            Exploration Audit
          </button>
          <button onClick={() => setDrawer(d => d === 'assets' ? 'none' : 'assets')} style={{ padding: '4px 8px', fontFamily: 'inherit', fontSize: 11, background: drawer === 'assets' ? '#5a4a6a' : '#1b1424', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>
            Art Kit
          </button>
          <button onClick={() => setDrawer(d => d === 'patch' ? 'none' : 'patch')} style={{ padding: '4px 8px', fontFamily: 'inherit', fontSize: 11, background: drawer === 'patch' ? '#5a4a6a' : '#1b1424', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>
            Custody
          </button>
        </div>
      </div>

      {/* Main 1280x720 Two-Column Workspace */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left: Interactive Map + Layer & Zoom Controls */}
        <div style={{ width: VIEW_PX_W }}>
          {/* Layer & Zoom Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, flexWrap: 'wrap', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['terrain', 'Terrain'],
                ['roads', 'Roads/Bridges'],
                ['pois', 'POIs (81)'],
                ['sources', 'Sources'],
                ['regions', 'Regions'],
              ] as const).map(([k, label]) => (
                <label key={k} style={{ cursor: 'pointer', opacity: k === 'sources' && mode !== 'creator' ? 0.45 : 1 }}>
                  <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} /> {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => { setZoom(FIT_ZOOM); setCamTile({ x: FRAME_W / 2, y: FRAME_H / 2 }); }} style={{ padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, background: '#241c30', color: '#ffd98a', border: '1px solid #4a3a5a', cursor: 'pointer' }}>Fit</button>
              <button onClick={() => setZoom(z => Math.max(FIT_ZOOM, Number((z / 1.4).toFixed(3))))} style={{ padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, background: '#241c30', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>-</button>
              <button onClick={() => setZoom(z => Math.min(3.0, Number((z * 1.4).toFixed(3))))} style={{ padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, background: '#241c30', color: '#e8e0f0', border: '1px solid #4a3a5a', cursor: 'pointer' }}>+</button>
              <button onClick={() => setZoom(1.0)} style={{ padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, background: zoom >= 0.9 ? '#4f8a3a' : '#241c30', color: '#fff', border: '1px solid #4a3a5a', cursor: 'pointer' }}>1:1 Tile</button>
              <span style={{ fontSize: 10, color: '#b8a8c8' }}>{zoom.toFixed(2)}×</span>
            </div>
          </div>

          <canvas
            ref={viewCvRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { dragRef.current = null; }}
            onWheel={onWheel}
            style={{ width: VIEW_PX_W, height: VIEW_PX_H, border: '1px solid #4a3a5a', cursor: 'grab', display: 'block' }}
          />

          <div style={{ fontSize: 11, marginTop: 4, color: '#d8cce8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <span>{hoverInfo}</span>
          </div>
          <div style={{ fontSize: 10, color: '#9e8eb0', marginTop: 2 }}>
            Legend: <span style={{ color: '#ffd98a' }}>● U05 Pilot (6: 5 built, 1 open-air)</span> · <span style={{ color: '#5af0ff' }}>● Kit Enclosed (50)</span> · <span style={{ color: '#c89aff' }}>● Kit Open-Air / No Door MGP-D04 (25)</span> · <span style={{ color: '#ff5a4a' }}>× Unresolved Bridge MGP-D01 (12)</span> · <span style={{ color: '#5af0ff' }}>■ Dock (27)</span>
          </div>
        </div>

        {/* Right: POI & Coordinate Inspector + 1x Actual-Game Preview */}
        <div style={{ flex: '1 1 440px', maxWidth: 480, background: '#171220', border: '1px solid #3c3048', padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: mode === 'creator' ? '#ffd98a' : '#7aff6a' }}>
              {mode === 'creator' ? 'CREATOR INSPECTION' : 'GAMEPLAY MAP (DISCOVERY ONLY)'}
            </span>
            <span style={{ fontSize: 10, color: '#b8a8c8' }}>
              LRU {stats.resident}/{stats.maxResident} chunks · 0 full-frame alloc
            </span>
          </div>

          {/* Coordinate Readout */}
          <div style={{ background: '#100c18', border: '1px solid #2e243a', padding: '5px 7px', fontSize: 11, marginBottom: 6 }}>
            <div>
              <b>Tile:</b> {selTile.tx}, {selTile.ty} · <b>AU:</b> {(selTile.tx * U).toFixed(1)}, {(selTile.ty * U).toFixed(1)} · <b>Chunk:</b> veyra05|{selChunk[0]}:{selChunk[1]}
            </div>
            <div>
              <b>Surface:</b> {selSample.land ? (selSample.river ? 'River (water)' : selSample.lake ? 'Lake (water)' : selSample.road ? 'Road' : BIOME_NAMES[selSample.biome]) : 'Sea (water)'} · <b>Window:</b> {selWin.originTx},{selWin.originTy}
              {hasGameplayRun && run && <> · <b>Player:</b> {playerGlobalTile(run).join(',')} (AU {playerGlobalAu(run).join(',')})</>}
            </div>
          </div>

          {/* POI Filter & Quick Selector (including Greywater Hamlet) */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
              {([
                ['all', 'All (81)'],
                ['pilot', 'Pilots (6)'],
                ['enclosed', 'Kit (50)'],
                ['open', 'Open-Air (25)'],
                ['river', 'River (3)'],
              ] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setPoiFilter(k)} style={{ padding: '2px 6px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', background: poiFilter === k ? '#ffd98a' : '#241c30', color: poiFilter === k ? '#120c18' : '#d8cce8', border: '1px solid #4a3a5a' }}>
                  {lbl}
                </button>
              ))}
              <input
                type="text"
                value={poiQuery}
                onChange={e => setPoiQuery(e.target.value)}
                placeholder="Search POI..."
                style={{ flex: 1, minWidth: 90, background: '#0e0b14', color: '#fff', border: '1px solid #4a3a5a', padding: '2px 5px', fontSize: 10, fontFamily: 'inherit' }}
              />
            </div>
            <select
              data-testid="poi-select"
              value={selPoiId}
              onChange={e => { const p = allPois.find(x => x.id === e.target.value); if (p) focusPoi(p); }}
              style={{ width: '100%', background: '#0e0b14', color: '#ffd98a', border: '1px solid #4a3a5a', padding: '4px 6px', fontSize: 11, fontFamily: 'inherit' }}
            >
              <option value="">— Select from {filteredPois.length} POIs —</option>
              {filteredPois.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id}) · {p.arche} · {p.mode === 'PILOT_U05' ? 'PILOT' : p.mode === 'KIT_ENCLOSED' ? `${p.metrics.buildingCount} bld` : 'open-air'}
                </option>
              ))}
            </select>
          </div>

          {/* Selected POI Detail Card */}
          {selectedPoi && (mode === 'creator' || (run && run.poiSeen.includes(selectedPoi.id))) ? (
            <div style={{ background: '#120d1b', border: '1px solid #3c3048', padding: 6, fontSize: 11, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ color: '#ffd98a', fontSize: 12 }}>{selectedPoi.name}</b>
                <span style={{ fontSize: 10, padding: '1px 5px', background: selectedPoi.mode === 'PILOT_U05' ? '#5a4214' : selectedPoi.mode === 'KIT_ENCLOSED' ? '#16424a' : '#3a264a', color: '#fff' }}>
                  {selectedPoi.mode}
                </span>
              </div>
              <div style={{ color: '#b8a8c8', fontSize: 10, marginTop: 2 }}>
                ID: {selectedPoi.id} · Archetype: {selectedPoi.arche} · Anchor: {selectedPoi.atTile.join(',')} (AU {(selectedPoi.atTile[0] * U).toFixed(0)},{(selectedPoi.atTile[1] * U).toFixed(0)})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 5, fontSize: 10, background: '#0c0912', padding: 4 }}>
                <div>Buildings: <b>{selectedPoi.metrics.buildingCount}</b></div>
                <div>Roofs: <b>{selectedPoi.metrics.roofCount}</b> ({selectedPoi.metrics.roofTiles}t)</div>
                <div>Doors: <b>{selectedPoi.metrics.doorCount}</b></div>
                <div>Floor cells: <b>{selectedPoi.metrics.floorCells}</b></div>
                <div>Wall cells: <b>{selectedPoi.metrics.wallCells}</b></div>
                <div>Accessible: <b style={{ color: '#7aff6a' }}>{selectedPoi.metrics.accessibleInteriors}/{selectedPoi.metrics.buildingCount}</b></div>
              </div>
              {selectedPoi.conflicts.length > 0 && (
                <div style={{ marginTop: 4, color: '#ff9a7a', fontSize: 10 }}>
                  {selectedPoi.conflicts.map((c, i) => <div key={i}>⚠ {c}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#120d1b', border: '1px solid #3c3048', padding: 6, fontSize: 11, marginBottom: 6, color: '#b8a8c8' }}>
              {mode === 'gameplay'
                ? 'Select a discovered POI or explore Veyra in real gameplay to reveal locations.'
                : 'No POI selected — click any marker or tile on the island map.'}
            </div>
          )}

          {/* Representative 1x Actual-Game Visual Preview (320x180 native SOH sprites) */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: '#b8a8c8', marginBottom: 2 }}>
              1× Native SOH Pixel Preview (320×180 · actual terrain, walls, doors & roofs)
            </div>
            <canvas ref={previewCvRef} style={{ width: 320, height: 180, border: '1px solid #4a3a5a', imageRendering: 'pixelated' }} />
          </div>

          {/* Controlled Creator Inspection Launch Button */}
          {mode === 'creator' ? (
            <button
              onClick={handleLaunchInspect}
              style={{ width: '100%', padding: '7px 10px', background: '#ffd98a', color: '#140c18', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ▶ Inspect & Play at {selectedPoi ? selectedPoi.name : `Tile ${selTile.tx},${selTile.ty}`} (Creator Fixture)
            </button>
          ) : (
            <div style={{ fontSize: 10, color: '#8a7a9a', padding: '4px 6px', border: '1px solid #2e243a' }}>
              Gameplay Map mode: teleportation disabled. Walk in-game to explore regions & discover POIs.
            </div>
          )}
        </div>
      </div>

      {/* Expandable Bottom Drawers */}
            {drawer === 'audit' && (
        <div style={{ marginTop: 10, background: '#15101e', border: '1px solid #4a3a5a', padding: 8, fontSize: 11 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffd98a', marginBottom: 4 }}>Veyra Exploration Density & Route Audit (U = 0.5 AU/tile · 72 px/s = 4.5 tiles/s)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: '#0e0b14', padding: 6, marginBottom: 6, fontSize: 10 }}>
            <div>Authored Land: <b>964,200 AU² (34.4%)</b></div>
            <div>Canonical POIs: <b>81 (55 built / 136 bld, 26 open-air)</b></div>
            <div>Nominal Density: <b>0.84 POIs / 100×100 AU</b></div>
            <div>Artificial Edge Walls: <b style={{ color: '#7aff6a' }}>0 (continuous slide)</b></div>
          </div>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginBottom: 6 }}>
            <thead>
              <tr style={{ color: '#ffd98a', borderBottom: '1px solid #4a3a5a', textAlign: 'left' }}>
                <th>GOLD Spawn</th><th>Nearest POI (Walk)</th><th>Nearest Built POI</th><th>Reachable ≤240t</th><th>River/Sea Blocked ≤240t</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['sp_lake (Greywater South)', 'Greywater Hamlet — 80t (17.8s)', 'Greywater Hamlet — 80t (17.8s)', '1', '4 (unbridged river MGP-D01)'],
                ['sp_west (Westmouth Shore)', 'West Evac Pad — 88t (19.6s)', 'Westmouth Harbour — 116t (25.8s)', '2', '1 (Threshold Isle MGP-D08)'],
                ['sp_hook (Hook Peninsula)', 'Mere Pier — 88t (19.6s)', 'Strait Port — 200t (44.4s)', '3', '2 (unbridged river MGP-D01)'],
                ['sp_gulf (Gulf West Bank)', 'West Bank Pier — 80t (17.8s)', 'Old Pump Facility — 130t (28.9s)', '3', '0'],
              ].map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #261e32' }}>
                  <td style={{ color: '#7aff6a' }}>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td style={{ color: '#ff9a7a' }}>{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: '#cfc2dc', lineHeight: 1.35 }}>
            <b>Diagnosis:</b> (A) Canonical GOLD spacing averages ~140×140 AU between POIs (18–45s walk from spawns). (B) Former runtime suppression (0 POI buildings & artificial window edge cliffs) is <b>RESOLVED</b>. (C) 12 unbridged river crossings (MGP-D01) & 27 unboarded docks (MGP-D03) block 80% of nearby POIs from sp_lake (Creator/Gameplay law required). (D) <b>3-Tier System:</b> Tier 1 = 81 Canonical POIs; Tier 2 (Proposal) = wayside trail cairns, bridge warning posts & cart camps; Tier 3 (Active) = 46 biome/road micro-decor assets + 7 POI landmark prop types.
          </div>
        </div>
      )}

      {drawer === 'matrix' && (
        <div style={{ marginTop: 10, background: '#15101e', border: '1px solid #4a3a5a', padding: 8, maxHeight: 320, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffd98a', marginBottom: 4 }}>All 81 Canonical POIs — Construction, Visibility & Accessibility Matrix (Click any row to focus)</div>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#ffd98a', borderBottom: '1px solid #4a3a5a', textAlign: 'left' }}>
                <th>#</th><th>ID</th><th>Name</th><th>Archetype</th><th>Tile (U=0.5)</th><th>AU</th><th>Mode</th><th>Bld</th><th>Roofs</th><th>Doors</th><th>Floors</th><th>Walls</th><th>Access</th><th>Conflicts / Notes</th>
              </tr>
            </thead>
            <tbody>
              {allPois.map((p, idx) => (
                <tr key={p.id} onClick={() => focusPoi(p)} style={{ borderBottom: '1px solid #261e32', cursor: 'pointer', background: selectedPoi?.id === p.id ? '#2a2038' : undefined }}>
                  <td>{idx + 1}</td>
                  <td>{p.id}</td>
                  <td style={{ color: '#ffd98a' }}>{p.name}</td>
                  <td>{p.arche}</td>
                  <td>{p.atTile.join(',')}</td>
                  <td>{(p.atTile[0] * U).toFixed(0)},{(p.atTile[1] * U).toFixed(0)}</td>
                  <td>{p.mode}</td>
                  <td>{p.metrics.buildingCount}</td>
                  <td>{p.metrics.roofCount}</td>
                  <td>{p.metrics.doorCount}</td>
                  <td>{p.metrics.floorCells}</td>
                  <td>{p.metrics.wallCells}</td>
                  <td style={{ color: '#7aff6a' }}>{p.metrics.accessibleInteriors}/{p.metrics.buildingCount}</td>
                  <td style={{ color: p.conflicts.length ? '#ff9a7a' : '#8a7a9a' }}>{p.conflicts.join('; ') || 'Clear'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer === 'assets' && (
        <div style={{ marginTop: 10, background: '#15101e', border: '1px solid #4a3a5a', padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffd98a', marginBottom: 4 }}>Isolated Candidate Environment Art Kit (46 assets, solid=false, harvestable=false)</div>
          <canvas ref={sheetCvRef} style={{ width: 640, height: 240, border: '1px solid #4a3a5a', imageRendering: 'pixelated', marginBottom: 6 }} />
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#ffd98a', textAlign: 'left' }}><th>Code</th><th>Name</th><th>Layer</th><th>Px</th><th>Biomes</th><th>Placement Rule</th></tr></thead>
              <tbody>
                {inventory.map(a => (
                  <tr key={a.code} style={{ borderBottom: '1px solid #261e32' }}>
                    <td>{a.code}</td><td>{a.name}</td><td>{a.layer}</td><td>{a.px}</td><td>{a.biomes.join(', ')}</td><td>{a.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawer === 'patch' && (
        <div style={{ marginTop: 10, background: '#15101e', border: '1px solid #4a3a5a', padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffd98a', marginBottom: 4 }}>Source Custody & Minimal Gameplay Integration Hunks</div>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: '#ffd98a', textAlign: 'left' }}><th>Hunk</th><th>Live File</th><th>Change</th><th>Purpose</th><th>Legacy Guarantee</th></tr></thead>
            <tbody>
              {PATCH_HUNKS.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #261e32' }}>
                  <td>{h.id}</td><td>{h.file}</td><td>{h.change}</td><td>{h.why}</td><td>{h.legacy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
