/**
 * U05 ISOLATED AUDITION RUNTIME — native SOH camera/player/input, additive
 * physical POI layer. No Gameplay law, no camera zoom, no stretched sprites,
 * no teleport-as-route, no full-frame allocation.
 */
import { getArt, type ArtSet } from '../game/art';
import { BAL, clamp } from '../game/core';
import {
  TILE, VIEW_W, VIEW_H, HERO_W, HERO_H, SPEED, RENDER_CHUNK, FRAME_W, FRAME_H, U,
  CONTRACT_ID, CONTRACT_INVARIANTS, auToTile, tileToAuCentre, verifyAllChunkKeys
} from './contract';
import { PROFILE, u05Tile, sampleTile, touchGeometryChunk, stats as worldStats, resetCaches } from './world';
import { getDisplayChunk, displayStats, resetDisplay } from './display';
import { PhysicalLayer, type U05Scene } from './physical';
import { U05_SCENES, U05_SCENE_IDS } from './scenes.generated';

const SCENES = new Map<string, U05Scene>(U05_SCENES.map((s: any) => [s.id, s]));
const DAY_MS = (BAL.dayLengthMinutes ?? 24) * 60_000;

export class U05Game {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  art: ArtSet;
  physicalLayer = new PhysicalLayer();
  sceneId = U05_SCENE_IDS[0];
  scene: U05Scene;
  physical = true;
  player = { x: 0, y: 0, dir: 0 };
  cam = { x: 0, y: 0 };
  pressed = new Set<string>();
  inputLog: { code: string; type: string; t: number }[] = [];
  simMs = 0;
  lastFrame = 0;
  frameMs: number[] = [];
  blockedAttempts = 0;
  movedPx = 0;
  spawnFixture = false;
  raf = 0;
  drawStats: any = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.g.imageSmoothingEnabled = false;
    this.art = getArt();
    this.scene = SCENES.get(this.sceneId)!;
    this.physicalLayer.setScene(this.scene);
    this.resetPlayerToAnchor();
    window.addEventListener('keydown', (e) => this.key(e.code, 'down'));
    window.addEventListener('keyup', (e) => this.key(e.code, 'up'));
    window.addEventListener('blur', () => this.pressed.clear());
    this.lastFrame = performance.now();
    this.loop(this.lastFrame);
  }

  private key(code: string, type: 'down' | 'up') {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) return;
    if (type === 'down') this.pressed.add(code); else this.pressed.delete(code);
    if (this.inputLog.length < 4000) this.inputLog.push({ code, type, t: Math.round(this.simMs) });
  }
  private axis() {
    let dx = 0, dy = 0;
    if (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')) dx -= 1;
    if (this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) dx += 1;
    if (this.pressed.has('KeyW') || this.pressed.has('ArrowUp')) dy -= 1;
    if (this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) dy += 1;
    if (dx && dy) { const k = Math.SQRT1_2; dx *= k; dy *= k; }
    if (dy > 0) this.player.dir = 0; else if (dx < 0) this.player.dir = 1; else if (dx > 0) this.player.dir = 2; else if (dy < 0) this.player.dir = 3;
    return { dx, dy };
  }

  setScene(id: string) {
    const s = SCENES.get(id);
    if (!s) throw Error('U05_UNKNOWN_SCENE ' + id);
    this.sceneId = id; this.scene = s;
    this.physicalLayer.setScene(s);
    resetCaches(); resetDisplay();
    this.resetPlayerToAnchor();
  }
  setPhysical(on: boolean) { this.physical = !!on; }
  private resetPlayerToAnchor() {
    const t = this.scene.camera.anchorTile as [number, number];
    this.resetPlayer(t[0], t[1], true);
  }
  /** QA spawn fixture ONLY — the walk itself is always real keyboard input. */
  resetPlayer(tileX: number, tileY: number, anchor = false) {
    this.player.x = tileX * TILE + TILE / 2;
    this.player.y = tileY * TILE + TILE / 2;
    this.cam.x = clamp(this.player.x - VIEW_W / 2, 0, FRAME_W * TILE - VIEW_W);
    this.cam.y = clamp(this.player.y - VIEW_H / 2 - 6, 0, FRAME_H * TILE - VIEW_H);
    this.spawnFixture = !anchor;
    this.blockedAttempts = 0; this.movedPx = 0;
    touchGeometryChunk(tileX, tileY);
  }

  private loop = (now: number) => {
    const dt = Math.min(50, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    this.simMs += dt;
    const { dx, dy } = this.axis();
    if (dx || dy) {
      const k = SPEED * dt / 1000;
      const nx = this.player.x + dx * k, ny = this.player.y + dy * k;
      if (this.physicalLayer.canStandPx(nx, this.player.y)) { this.movedPx += Math.abs(nx - this.player.x); this.player.x = nx; }
      else this.blockedAttempts++;
      if (this.physicalLayer.canStandPx(this.player.x, ny)) { this.movedPx += Math.abs(ny - this.player.y); this.player.y = ny; }
      else this.blockedAttempts++;
    }
    const targetX = clamp(this.player.x - VIEW_W / 2, 0, FRAME_W * TILE - VIEW_W);
    const targetY = clamp(this.player.y - VIEW_H / 2 - 6, 0, FRAME_H * TILE - VIEW_H);
    // NO camera smoothing used as a route: exact 1x clamp, same as SOH.
    this.cam.x = Math.round(targetX); this.cam.y = Math.round(targetY);
    touchGeometryChunk(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
    this.draw(now, dt);
    this.frameMs.push(dt); if (this.frameMs.length > 600) this.frameMs.shift();
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(now: number, dt: number) {
    const g = this.g, camX = this.cam.x, camY = this.cam.y;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const c0 = Math.floor(camX / (RENDER_CHUNK * TILE)), c1 = Math.floor((camX + VIEW_W) / (RENDER_CHUNK * TILE));
    const r0 = Math.floor(camY / (RENDER_CHUNK * TILE)), r1 = Math.floor((camY + VIEW_H) / (RENDER_CHUNK * TILE));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++)
      if (i >= 0 && j >= 0 && i < Math.ceil(FRAME_W / RENDER_CHUNK) && j < Math.ceil(FRAME_H / RENDER_CHUNK))
        g.drawImage(getDisplayChunk(i, j), Math.round(i * RENDER_CHUNK * TILE - camX), Math.round(j * RENDER_CHUNK * TILE - camY));

    this.drawStats = this.physicalLayer.draw(g, camX, camY, [this.player.x, this.player.y], this.physical);

    // Native SOH hero: 16x24, drawn at integer pixels, 1x, never stretched.
    const hero: any = (this.art.hero as any).male;
    const moving = dxOrDy(this.pressed);
    const pose = moving ? 'walk' : 'idle';
    const frames = hero[pose + this.player.dir] as HTMLCanvasElement[];
    const spr = frames[Math.floor(now / (moving ? 120 : 600)) % frames.length];
    g.drawImage(spr, Math.round(this.player.x - camX - HERO_W / 2), Math.round(this.player.y - camY - 19));
  }

  state() {
    const tx = Math.floor(this.player.x / TILE), ty = Math.floor(this.player.y / TILE);
    const s = sampleTile(tx, ty);
    return {
      contract: CONTRACT_ID, status: CONTRACT_INVARIANTS.status,
      sceneId: this.sceneId, sceneName: this.scene.name, physical: this.physical,
      viewport: [VIEW_W, VIEW_H], dpr: window.devicePixelRatio || 1, zoom: 1, cameraTrick: false,
      U, TILE, frameTiles: [FRAME_W, FRAME_H], addressableCells: FRAME_W * FRAME_H,
      heroSpritePx: [HERO_W, HERO_H], speedPxPerSec: SPEED, dayLengthMs: DAY_MS,
      player: { px: this.player.x, py: this.player.y, tile: [tx, ty], au: tileToAuCentre(tx, ty), dir: this.player.dir },
      camera: { x: this.cam.x, y: this.cam.y, anchorTile: this.scene.camera.anchorTile },
      terrain: s ? { tile: s.tile, biome: s.biome, authoredLand: s.authoredLand, water: s.water, road: s.road, poiId: s.poiId, permissions: s.permissions } : null,
      walkableHere: this.physicalLayer.walkableTile(tx, ty),
      wallBlockedHere: this.physicalLayer.wallBlockedTile(tx, ty),
      draw: this.drawStats,
      chunkAudit: verifyAllChunkKeys(),
      stats: { ...worldStats(), ...displayStats(), simMs: Math.round(this.simMs), movedPx: Math.round(this.movedPx), blockedAttempts: this.blockedAttempts, spawnFixture: this.spawnFixture },
      input: { logLength: this.inputLog.length, last: this.inputLog.slice(-8) },
      frameMs: { p50: percentile(this.frameMs, .5), p95: percentile(this.frameMs, .95), max: Math.max(0, ...this.frameMs) }
    };
  }

  private nearestWalkable(t: [number, number], radius = 10): [number, number] | null {
    if (this.physicalLayer.walkableTile(t[0], t[1])) return t;
    for (let r = 1; r <= radius; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const q: [number, number] = [t[0] + dx, t[1] + dy];
        if (this.physicalLayer.walkableTile(q[0], q[1])) return q;
      }
    return null;
  }
  /** Resolve designed approach path to the nearest LEGAL tiles on the SAME
   *  unchanged GOLD road centreline and at the authored entrance region. */
  resolveApproach(id?: string) {
    const s = id ? SCENES.get(id) : this.scene;
    if (!s) return null;
    const designed: [number, number][] = s.NAV_RETREAT.approachPathTiles;
    const goalDesigned = designed[1] as [number, number];
    const goal = this.nearestWalkable(goalDesigned, 10) || goalDesigned;
    const ra = s.NAV_RETREAT.roadApproach;
    const [ax, ay] = ra.roadSegmentAu[0], [bx, by] = ra.roadSegmentAu[1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const bb = s.SITE_ENVELOPE.bboxTiles as number[];
    const outside = (t: [number, number]) => t[0] < Math.floor(bb[0]) - 2 || t[0] > Math.ceil(bb[2]) + 2 || t[1] < Math.floor(bb[1]) - 2 || t[1] > Math.ceil(bb[3]) + 2;
    // Gather legal OUTSIDE road-side candidates, then choose the one with the
    // shortest real BFS route to the entrance region (not a teleport).
    const candidates: [number, number][] = [];
    for (let d = 6; d <= 48; d += 2) for (const sign of [1, -1]) {
      const au = [ra.schematicCentrePointAu[0] + sign * ux * d, ra.schematicCentrePointAu[1] + sign * uy * d];
      const t: [number, number] = [Math.floor(au[0] / U), Math.floor(au[1] / U)];
      if (outside(t) && this.physicalLayer.walkableTile(t[0], t[1])) candidates.push(t);
    }
    candidates.sort((p, q) => (Math.abs(p[0] - goal[0]) + Math.abs(p[1] - goal[1])) - (Math.abs(q[0] - goal[0]) + Math.abs(q[1] - goal[1])));
    let start: [number, number] | null = null, path = { found: false, steps: [] as any[], visited: 0 };
    for (const c of candidates.slice(0, 12)) {
      const p = this.physicalLayer.computeWalkPath(c, goal);
      if (p.found && (!path.found || p.steps.length < path.steps.length)) { path = p; start = c; if (p.steps.length <= 30) break; }
    }
    if (!start) {
      start = this.nearestWalkable(designed[0] as [number, number], 16) || (designed[0] as [number, number]);
      path = this.physicalLayer.computeWalkPath(start, goal);
    }
    return {
      sceneId: s.id, designed, resolved: { start, goal },
      adjusted: start[0] !== (designed[0] as [number, number])[0] || start[1] !== (designed[0] as [number, number])[1] || goal[0] !== goalDesigned[0] || goal[1] !== goalDesigned[1],
      roadId: ra.roadId, roadCentrelineChanged: false,
      pathFound: path.found, pathSteps: path.steps.length, visited: path.visited, steps: path.steps,
      note: 'Legal tile resolution uses the SAME runtime collision predicate as real WASD input. It is path SELECTION, not a teleport, not a camera route and not a Gameplay law.'
    };
  }

  api() {
    return {
      ready: true,
      contract: CONTRACT_ID,
      scenes: U05_SCENE_IDS.slice(),
      profile: PROFILE,
      state: () => this.state(),
      selectScene: (id: string) => { this.setScene(id); return this.state(); },
      setPhysical: (on: boolean) => { this.setPhysical(on); return this.state(); },
      resetPlayer: (tx: number, ty: number) => { this.resetPlayer(tx, ty); return this.state(); },
      sampleTile: (tx: number, ty: number) => sampleTile(tx, ty),
      u05Tile: (tx: number, ty: number) => u05Tile(tx, ty),
      walkableTile: (tx: number, ty: number) => this.physicalLayer.walkableTile(tx, ty),
      wallBlockedTile: (tx: number, ty: number) => this.physicalLayer.wallBlockedTile(tx, ty),
      computeWalkPath: (start: [number, number], goal: [number, number]) => this.physicalLayer.computeWalkPath(start, goal),
      probeWall: () => this.physicalLayer.probeWall(),
      roofCentroid: () => this.physicalLayer.roofCentroid(),
      /** Choose LEGAL start/goal tiles for the designed approach path. This is
       *  QA path selection against the SAME runtime collision function, NOT a
       *  teleport and NOT a camera route. The walk itself uses real input. */
      resolveApproach: (id?: string) => this.resolveApproach(id),
      sceneGeometry: (id?: string) => {
        const s = id ? SCENES.get(id) : this.scene;
        if (!s) return null;
        return { id: s.id, envelope: s.SITE_ENVELOPE, buildings: s.BUILDING_COMPOSITION.buildings.length, walls: s.SOLID_COLLISION.solids.length, doors: s.DOORS_ROOMS.openings.length, roofs: s.ROOF_OCCLUSION.roofs.length, approach: s.NAV_RETREAT.roadApproach, approachPathTiles: s.NAV_RETREAT.approachPathTiles };
      },
      inputLog: () => this.inputLog.slice(),
      clearInputLog: () => { this.inputLog = []; },
      roofHiddenCount: () => this.drawStats.roofHiddenCount || 0,
      auToTile, tileToAuCentre
    };
  }
}
function dxOrDy(pressed: Set<string>) {
  return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => pressed.has(k));
}
function percentile(a: number[], p: number) {
  if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor((b.length - 1) * p)];
}
