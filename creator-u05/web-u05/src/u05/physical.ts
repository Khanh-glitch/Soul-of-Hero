/**
 * U05 PHYSICAL POI LAYER — the additive, isolated overlay for the six P3 scenes.
 * Geometry is REPROJECTED from GOLD + WMP-03 PROPOSED architecture. Rendering
 * REUSES the verified live Gameplay art.ts structure sprites (no new atlas).
 * Grey boxes / reused sprites are WHITEBOX PHYSICAL PROOF, not final pixel art.
 */
import { getArt, type ArtSet } from '../game/art';
import { TILE, VIEW_W, VIEW_H } from './contract';
import { pointInPolygon, distToSegment, terrainBlocked, sampleTile } from './world';

type Pt = [number, number];
type Poly = Pt[];
export interface U05Scene { [k: string]: any }

interface Wall { id: string; a: Pt; b: Pt; half: number; sprite: string }
interface Roof { id: string; poly: Poly; sprite: string; bbox: [number, number, number, number] }
interface Door { id: string; tile: Pt; sprite: string; kind: string }
interface Building { id: string; poly: Poly; bbox: [number, number, number, number]; floor: string; wall: string; roof: string }
interface Area { id: string; kind: string; poly: Poly; bbox: [number, number, number, number]; art: string }
interface Prop { id: string; tile: Pt; sprite: string }

const PROP_SPRITES = new Set(['barrel', 'cargo', 'cart', 'research', 'workbench', 'furnace', 'furnace_lit', 'gen', 'evac', 'vendor', 'campfire', 'chest_small', 'chest_large', 'claim', 'torch_post', 'base_generator']);
const FLOOR_SPRITES = new Set(['floor_wood', 'floor_stone']);

function bboxOf(poly: Poly): [number, number, number, number] {
  return [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];
}
const centroid = (poly: Poly): Pt => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];

export class PhysicalLayer {
  scene: U05Scene | null = null;
  art: ArtSet | null = null;
  walls: Wall[] = [];
  roofs: Roof[] = [];
  doors: Door[] = [];
  buildings: Building[] = [];
  areas: Area[] = [];
  props: Prop[] = [];
  markers: any[] = [];
  lastDraw = { roofDrawn: 0, roofHiddenCount: 0, wallsDrawn: 0, doorsDrawn: 0, floorsDrawn: 0, propsDrawn: 0 };

  constructor() { this.art = getArt(); }

  setScene(scene: U05Scene) {
    this.scene = scene;
    this.walls = (scene.SOLID_COLLISION?.solids || []).map((s: any) => ({
      id: s.id, a: s.aTile as Pt, b: s.bTile as Pt,
      half: (s.thicknessTiles || 2) / 2, sprite: s.sprite || 'wall_stone'
    }));
    this.roofs = (scene.ROOF_OCCLUSION?.roofs || []).map((r: any) => ({
      id: r.id, poly: r.polygonTiles as Poly, sprite: r.sprite || 'roof_tile', bbox: bboxOf(r.polygonTiles as Poly)
    }));
    this.doors = (scene.DOORS_ROOMS?.openings || []).map((o: any) => ({
      id: o.id, tile: o.centreTile as Pt, kind: o.kind,
      sprite: o.kind === 'EXTERIOR_ENTRANCE' ? 'door_wood_open' : 'poi_door_open'
    }));
    this.buildings = (scene.BUILDING_COMPOSITION?.buildings || []).map((b: any) => ({
      id: b.id, poly: (b.footprintTiles || b.polygonTiles) as Poly, bbox: (b.footprintBboxTiles || b.bboxTiles) as [number, number, number, number],
      floor: b.floorSprite || 'floor_stone', wall: b.wallSprite || 'wall_stone', roof: b.roofSprite || 'none'
    }));
    this.areas = (scene.BUILDING_COMPOSITION?.spatialProgrammeAreas || []).map((a: any) => ({
      id: a.id, kind: a.kind, poly: a.polygonTiles as Poly, bbox: a.bboxTiles as [number, number, number, number], art: a.art || 'none'
    }));
    this.markers = scene.markers || [];
    this.props = [];
    for (const a of this.areas) {
      if (!PROP_SPRITES.has(a.art)) continue;
      const c = centroid(a.poly);
      const t: Pt = [Math.floor(c[0]), Math.floor(c[1])];
      if (this.walkableTile(t[0], t[1])) this.props.push({ id: `prop:${a.id}`, tile: t, sprite: a.art });
    }
  }

  /** Wall collision only (separate from terrain) so QA can prove a DISTINCT
   *  structure's solid collision rather than a water boundary. */
  wallBlockedTile(tx: number, ty: number): boolean {
    const px = tx + 0.5, py = ty + 0.5;
    for (const w of this.walls) if (distToSegment(px, py, w.a, w.b) <= w.half + 0.25) return true;
    return false;
  }
  walkableTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= 4000 || ty >= 2800) return false;
    return !terrainBlocked(tx, ty) && !this.wallBlockedTile(tx, ty);
  }
  /** The SAME predicate is used by real WASD input and by QA/path BFS. */
  canStandPx(px: number, py: number): boolean {
    return this.walkableTile(Math.floor(px / TILE), Math.floor(py / TILE));
  }
  wallBlockedAtPx(px: number, py: number): boolean {
    const t = px / TILE, u = py / TILE;
    for (const w of this.walls) if (distToSegment(t, u, w.a, w.b) <= w.half + 0.25) return true;
    return false;
  }

  /** Bounded 4-neighbour BFS on the SAME runtime collision predicate.
   *  Returns single-tile key steps; QA dispatches REAL keyboard events for each. */
  computeWalkPath(start: Pt, goal: Pt): { steps: { code: string; tile: Pt }[]; found: boolean; visited: number } {
    const bb = this.scene?.SITE_ENVELOPE?.bboxTiles || [0, 0, 0, 0];
    const pad = 26;
    const x0 = Math.max(0, Math.floor(Math.min(start[0], bb[0])) - pad), x1 = Math.min(3999, Math.ceil(Math.max(start[0], bb[2])) + pad);
    const y0 = Math.max(0, Math.floor(Math.min(start[1], bb[1])) - pad), y1 = Math.min(2799, Math.ceil(Math.max(start[1], bb[3])) + pad);
    const key = (x: number, y: number) => y * 4000 + x;
    const startK = key(start[0], start[1]), goalK = key(goal[0], goal[1]);
    const prev = new Map<number, number>();
    const q: number[] = [startK]; const seen = new Set<number>([startK]);
    const dirs: [number, number, string][] = [[1, 0, 'KeyD'], [-1, 0, 'KeyA'], [0, 1, 'KeyS'], [0, -1, 'KeyW']];
    let found = false, qi = 0;
    while (qi < q.length) {
      const k = q[qi++];
      if (k === goalK) { found = true; break; }
      const x = k % 4000, y = Math.floor(k / 4000);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const nk = key(nx, ny);
        if (seen.has(nk) || !this.walkableTile(nx, ny)) continue;
        seen.add(nk); prev.set(nk, k); q.push(nk);
      }
    }
    if (!found) return { steps: [], found: false, visited: seen.size };
    const tiles: Pt[] = []; let k = goalK;
    while (k !== startK) { tiles.push([k % 4000, Math.floor(k / 4000)]); k = prev.get(k)!; }
    tiles.reverse();
    const steps = []; let cur = start;
    for (const t of tiles) {
      const code = t[0] > cur[0] ? 'KeyD' : t[0] < cur[0] ? 'KeyA' : t[1] > cur[1] ? 'KeyS' : 'KeyW';
      steps.push({ code, tile: t }); cur = t;
    }
    return { steps, found: true, visited: seen.size };
  }

  /** Find a WALL-adjacent (terrain-walkable, wall-blocked neighbour) probe. */
  probeWall(): { tile: Pt; code: string; wallIds: string[] } | null {
    const bb = this.scene?.SITE_ENVELOPE?.bboxTiles || [0, 0, 0, 0];
    const dirs: [number, number, string][] = [[1, 0, 'KeyD'], [-1, 0, 'KeyA'], [0, 1, 'KeyS'], [0, -1, 'KeyW']];
    for (let ty = Math.floor(bb[1]) - 4; ty <= Math.ceil(bb[3]) + 4; ty++)
      for (let tx = Math.floor(bb[0]) - 4; tx <= Math.ceil(bb[2]) + 4; tx++) {
        if (!this.walkableTile(tx, ty)) continue;
        for (const [dx, dy, code] of dirs) {
          const nx = tx + dx, ny = ty + dy;
          if (this.wallBlockedTile(nx, ny) && !terrainBlocked(nx, ny)) {
            const ids = this.walls.filter((w) => distToSegment(nx + .5, ny + .5, w.a, w.b) <= w.half + .25).map((w) => w.id);
            return { tile: [tx, ty], code, wallIds: ids };
          }
        }
      }
    return null;
  }

  roofCentroid(): Pt | null {
    if (!this.roofs.length) return null;
    const c = centroid(this.roofs[0].poly);
    return [Math.floor(c[0]), Math.floor(c[1])];
  }

  private sprite(name: string): HTMLCanvasElement | null {
    const st: any = this.art?.st || {};
    return st[name] || st.wall_stone || null;
  }
  private blit(g: CanvasRenderingContext2D, s: HTMLCanvasElement | null, x: number, y: number, camX: number, camY: number, yOff = 0) {
    if (!s) return;
    const X = Math.round(x - camX), Y = Math.round(y - camY + yOff);
    if (X < -40 || X > VIEW_W + 40 || Y < -40 || Y > VIEW_H + 40) return;
    g.drawImage(s, X, Y);
  }
  private fillPoly(g: CanvasRenderingContext2D, poly: Poly, spriteName: string, camX: number, camY: number) {
    if (!spriteName || spriteName === 'none') return;
    const s = this.sprite(spriteName);
    if (!s) return;
    const bb = bboxOf(poly);
    for (let ty = Math.floor(bb[1]); ty <= Math.ceil(bb[3]); ty++)
      for (let tx = Math.floor(bb[0]); tx <= Math.ceil(bb[2]); tx++)
        if (pointInPolygon(tx + .5, ty + .5, poly)) this.blit(g, s, tx * TILE, ty * TILE, camX, camY);
  }

  draw(g: CanvasRenderingContext2D, camX: number, camY: number, playerPx: [number, number], physical: boolean) {
    const d = { roofDrawn: 0, roofHiddenCount: 0, wallsDrawn: 0, doorsDrawn: 0, floorsDrawn: 0, propsDrawn: 0 };
    if (!physical || !this.scene) { this.lastDraw = d; return d; }
    g.imageSmoothingEnabled = false;

    // 1. building floors + explicitly floored circulation areas
    for (const b of this.buildings) if (b.floor && b.floor !== 'none') { this.fillPoly(g, b.poly, b.floor, camX, camY); d.floorsDrawn++; }
    for (const a of this.areas) if (FLOOR_SPRITES.has(a.art)) this.fillPoly(g, a.poly, a.art, camX, camY);

    // 2. static solid wall spans, stepped at exactly one 16px tile
    for (const w of this.walls) {
      const s = this.sprite(w.sprite);
      const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
      const n = Math.max(1, Math.ceil(len));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = w.a[0] + (w.b[0] - w.a[0]) * t, y = w.a[1] + (w.b[1] - w.a[1]) * t;
        this.blit(g, s, x * TILE, y * TILE, camX, camY, -8);
      }
      d.wallsDrawn++;
    }

    // 3. visible door thresholds (static holes; dynamic lock state is UNKNOWN)
    for (const dr of this.doors) {
      this.blit(g, this.sprite(dr.sprite), dr.tile[0] * TILE, dr.tile[1] * TILE, camX, camY, -8);
      d.doorsDrawn++;
    }

    // 4. sparse, NAMED reused props only (no random clutter, zero for Beacon)
    for (const p of this.props) { this.blit(g, this.sprite(p.sprite), p.tile[0] * TILE, p.tile[1] * TILE, camX, camY, -8); d.propsDrawn++; }

    // 5. roofs LAST, with real occlusion: hide the roof the player stands under
    const pt: Pt = [playerPx[0] / TILE, playerPx[1] / TILE];
    for (const r of this.roofs) {
      if (pointInPolygon(pt[0], pt[1], r.poly)) { d.roofHiddenCount++; continue; }
      this.fillPoly(g, r.poly, r.sprite, camX, camY);
      d.roofDrawn++;
    }

    // 6. helicopter/helipad RESERVATION outline ONLY. No helicopter sprite,
    //    no car wreck, no ship hull, no substitute. PROVEN_MISSING.
    if (this.scene.id === 'po_beacon') {
      const h = this.markers.find((m: any) => m.id === 'poi_beacon_engine_out_helicopter');
      if (h) {
        const x = Math.round(h.atTile[0] * TILE - camX), y = Math.round(h.atTile[1] * TILE - camY);
        g.save(); g.strokeStyle = 'rgba(240,240,240,0.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
        g.strokeRect(x - 24, y - 24, 48, 48); g.setLineDash([]); g.restore();
      }
    }
    this.lastDraw = d;
    return d;
  }
}
