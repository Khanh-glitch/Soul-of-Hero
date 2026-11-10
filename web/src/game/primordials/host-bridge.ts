import { VIEW_W, VIEW_H, WW, WH, TILE, dirFromAngle, clamp, type Creature, type GameState, type RunState } from '../core';
import { PRIMORDIAL_ELDERS } from '../catalog';
import { World, v, dist, type Actor, type MapAdapter, type Shape } from './game/core';
import { spawnBoss, spawnPlayer, stepWorld } from './game/sim';
import { installFx } from './game/fx';
import { SIGNATURE, skillsFor } from './game/registry';
import type { BossId, Form } from './art/clips';
import { FB, renderWorld, type RenderOpts } from './render/frame';

interface MountedBoss {
  actorId: number;
  creatureId: string;
  key: BossId;
  form: Form;
  lastSyncedHp: number;
}

export interface PrimordialHostSession {
  world: World;
  playerActor: Actor;
  mounted: Map<string, MountedBoss>;
}

const sessions = new WeakMap<RunState, PrimordialHostSession>();

export function isPrimordialElderKey(key: string | undefined): key is BossId {
  return !!key && Object.prototype.hasOwnProperty.call(PRIMORDIAL_ELDERS, key);
}

function createHostMapAdapter(r: RunState, isBlockedTile: (r: RunState, tx: number, ty: number) => boolean): MapAdapter {
  const bounds = { x: TILE * 2, y: TILE * 2, w: (WW - 4) * TILE, h: (WH - 4) * TILE };
  const pointBlocked = (px: number, py: number, rad: number): boolean => {
    if (px < bounds.x + rad || py < bounds.y + rad || px > bounds.x + bounds.w - rad || py > bounds.y + bounds.h - rad) {
      return true;
    }
    const checkR = Math.max(2, rad * 0.55);
    const pts = [
      [px, py],
      [px - checkR, py - checkR],
      [px + checkR, py - checkR],
      [px - checkR, py + checkR],
      [px + checkR, py + checkR],
    ];
    for (const [cx, cy] of pts) {
      const tx = Math.floor(cx / TILE);
      const ty = Math.floor(cy / TILE);
      if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1) return true;
      if (isBlockedTile(r, tx, ty)) return true;
    }
    return false;
  };

  return {
    bounds,
    obstacles: [],
    queryValidPosition(p, rad) {
      if (!pointBlocked(p.x, p.y, rad)) return p;
      for (let ring = 1; ring <= 6; ring++) {
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const cx = p.x + Math.cos(ang) * ring * Math.max(6, rad * 0.6);
          const cy = p.y + Math.sin(ang) * ring * Math.max(6, rad * 0.6);
          if (!pointBlocked(cx, cy, rad)) return v(cx, cy);
        }
      }
      return null;
    },
    raycast(a, b) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(d / 6));
      for (let i = 1; i <= steps; i++) {
        const px = a.x + ((b.x - a.x) * i) / steps;
        const py = a.y + ((b.y - a.y) * i) / steps;
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1 || isBlockedTile(r, tx, ty)) {
          return { hit: true, p: v(px, py) };
        }
      }
      return { hit: false, p: b };
    },
  };
}

function getOrCreateSession(
  r: RunState,
  isBlockedTile: (r: RunState, tx: number, ty: number) => boolean,
): PrimordialHostSession {
  let s = sessions.get(r);
  if (s) return s;
  const adapter = createHostMapAdapter(r, isBlockedTile);
  const world = new World({ seed: (r.seed ^ 0x6b9d15) >>> 0, adapter, difficulty: 1, quality: 'maximum_vfx' });
  installFx(world);
  const playerActor = spawnPlayer(world, { x: r.player.x, y: r.player.y }, 'keyboard', 'adventurer');
  playerActor.hp = 1000;
  playerActor.maxHp = 1000;
  s = { world, playerActor, mounted: new Map() };
  sessions.set(r, s);
  return s;
}

/** Explicitly clean up all owned hazards/summons/portals/eyes for one boss or the entire run session. */
export function cleanupPrimordialBoss(r: RunState | null | undefined, creatureId?: string, reason = 'host unload'): void {
  if (!r) return;
  const s = sessions.get(r);
  if (!s) {
    delete r.player?.primordialSlowMul;
    delete r.player?.primordialSlowUntil;
    return;
  }
  if (creatureId) {
    const mb = s.mounted.get(creatureId);
    if (mb) {
      const actor = s.world.actor(mb.actorId);
      if (actor?.boss?.runner) actor.boss.runner.cancel();
      s.world.cleanupOwner(mb.actorId, reason);
      if (actor) actor.alive = false;
      s.world.actors = s.world.actors.filter(a => a.id !== mb.actorId && a.summon?.owner !== mb.actorId);
      s.mounted.delete(creatureId);
    }
    if (s.mounted.size === 0) {
      delete r.player?.primordialSlowMul;
      delete r.player?.primordialSlowUntil;
    }
    return;
  }
  for (const mb of s.mounted.values()) {
    const actor = s.world.actor(mb.actorId);
    if (actor?.boss?.runner) actor.boss.runner.cancel();
    s.world.cleanupOwner(mb.actorId, reason);
  }
  delete r.player?.primordialSlowMul;
  delete r.player?.primordialSlowUntil;
  sessions.delete(r);
}

/** Read-only / test inspection of the live Primordial host session bound to a real RunState. */
export function inspectPrimordialHostSession(r: RunState | null | undefined) {
  if (!r) return null;
  return sessions.get(r) ?? null;
}

/** Step any nearby or active Primordial Elders on the current floor using the 48-skill ELDER_6 combat engine. */
export function stepPrimordialHost(
  gs: GameState,
  dtSec: number,
  now: number,
  deps: {
    isBlockedTile: (r: RunState, tx: number, ty: number) => boolean;
    /** True ONLY at Day 14 Elder Awakening (`phaseOf(r, now) === 'awakening'`, >= 312h), NEVER at 264h danger! */
    isAwakening: boolean;
    hurtPlayer: (gs: GameState, amount: number, now: number, cause: string) => void;
    killCreature: (gs: GameState, m: Creature, now: number) => void;
  },
): void {
  const r = gs.run;
  if (!r || dtSec <= 0) return;

  const candidates = r.creatures.filter(
    m =>
      m.state !== 'dead' &&
      m.elder &&
      isPrimordialElderKey(m.elder.key) &&
      (Math.hypot(m.x - r.player.x, m.y - r.player.y) < 620 || m.state !== 'sleep' || sessions.get(r)?.mounted.has(m.id)),
  );

  const existing = sessions.get(r);
  if (candidates.length === 0 && (!existing || existing.mounted.size === 0)) {
    return;
  }

  const sess = getOrCreateSession(r, deps.isBlockedTile);
  const { world, playerActor, mounted } = sess;

  // Unmount any creature no longer live in `r.creatures` (e.g. died, despawned, or shifted off-window/floor)
  const liveMap = new Map(candidates.map(m => [m.id, m]));
  for (const [cid, mb] of Array.from(mounted.entries())) {
    const m = liveMap.get(cid);
    if (!m || m.hp <= 0 || m.state === 'dead') {
      cleanupPrimordialBoss(r, cid, !m ? 'unloaded' : 'defeated');
      continue;
    }
    // Leash disengage if player retreated > 700px away from sanctuary anchor
    const dHome = Math.hypot(r.player.x - m.homeX, r.player.y - m.homeY);
    if (dHome > 720 && Math.hypot(r.player.x - m.x, r.player.y - m.y) > 640) {
      cleanupPrimordialBoss(r, cid, 'sanctuary disengage');
      m.x = m.homeX;
      m.y = m.homeY;
      m.state = 'sleep';
      m.hp = m.maxHp;
      continue;
    }
  }

  // Mount or form-shift active Primordial Elders
  for (const m of candidates) {
    const key = m.elder!.key as BossId;
    const dPlayer = Math.hypot(m.x - r.player.x, m.y - r.player.y);
    if (!mounted.has(m.id) && dPlayer > 440 && m.state === 'sleep') continue;

    const wantForm: Form = deps.isAwakening || m.elder!.awake ? 'ultimate' : 'mini';
    const pDef = PRIMORDIAL_ELDERS[key];
    const cur = mounted.get(m.id);

    if (cur && cur.form !== wantForm) {
      const ratio = m.maxHp > 0 ? clamp(m.hp / m.maxHp, 0.05, 1) : 1;
      cleanupPrimordialBoss(r, m.id, 'ragnarok form awakening');
      m.elder!.awake = true;
      m.maxHp = pDef.hpAwake;
      m.hp = Math.max(1, Math.round(pDef.hpAwake * ratio));
    }

    if (!mounted.has(m.id)) {
      if (wantForm === 'ultimate' && !m.elder!.awake) {
        const ratio = m.maxHp > 0 ? clamp(m.hp / m.maxHp, 0.05, 1) : 1;
        m.elder!.awake = true;
        m.maxHp = pDef.hpAwake;
        m.hp = Math.max(1, Math.round(pDef.hpAwake * ratio));
      }
      const b = spawnBoss(world, key, wantForm, { x: m.x, y: m.y }, true);
      b.maxHp = m.maxHp;
      b.hp = clamp(m.hp, 1, m.maxHp);
      mounted.set(m.id, {
        actorId: b.id,
        creatureId: m.id,
        key,
        form: wantForm,
        lastSyncedHp: b.hp,
      });
      m.state = 'chase';
    }
  }

  if (mounted.size === 0) return;

  // Sync SOH -> PrimordialWorld before stepping
  playerActor.alive = !r.player.dead;
  playerActor.pos.x = r.player.x;
  playerActor.pos.y = r.player.y;
  playerActor.vel.x = r.player.vx;
  playerActor.vel.y = r.player.vy;
  playerActor.hp = 1000;
  playerActor.maxHp = 1000;
  if (r.player.invuln > 0) {
    playerActor.iframesUntil = Math.max(playerActor.iframesUntil, world.t + r.player.invuln);
  }
  const prevPx = playerActor.pos.x;
  const prevPy = playerActor.pos.y;

  for (const [cid, mb] of Array.from(mounted.entries())) {
    const m = liveMap.get(cid);
    const b = world.actor(mb.actorId);
    if (!m || !b || !b.alive) continue;
    if (m.hp < mb.lastSyncedHp) {
      const delta = mb.lastSyncedHp - m.hp;
      b.hp = Math.max(0, m.hp);
      b.lastHurt = world.t;
      if (b.boss) {
        b.boss.poise -= delta * 1.35;
      }
      (playerActor as any).lastHitBoss = world.t;
      if (b.hp <= 0) {
        cleanupPrimordialBoss(r, cid, 'boss defeated');
        deps.killCreature(gs, m, now);
        continue;
      }
    }
    mb.lastSyncedHp = m.hp;
  }

  // Step ELDER_6 simulation
  world.dt = Math.min(0.05, dtSec);
  stepWorld(world);

  // Sync PrimordialWorld -> SOH after stepping
  for (const [cid, mb] of mounted.entries()) {
    const m = liveMap.get(cid);
    const b = world.actor(mb.actorId);
    if (!m || !b) continue;
    m.x = clamp(b.pos.x, TILE * 2, (WW - 2) * TILE);
    m.y = clamp(b.pos.y, TILE * 2, (WH - 2) * TILE);
    m.dir = dirFromAngle(Math.atan2(b.facing.y, b.facing.x));
    m.state = b.boss?.runner ? 'attack' : b.boss?.target != null ? 'chase' : 'idle';
    m.patternKey = b.boss?.runner?.skill.id;
  }

  // Apply any pull / knockback displacement on the player proxy back to SOH player safely
  if (!r.player.dead) {
    const dx = playerActor.pos.x - prevPx;
    const dy = playerActor.pos.y - prevPy;
    if (Math.hypot(dx, dy) > 0.05 && Math.hypot(dx, dy) < 96) {
      const valid = world.map.queryValidPosition(v(r.player.x + dx, r.player.y + dy), 6);
      if (valid) {
        r.player.x = valid.x;
        r.player.y = valid.y;
      }
    }

    // Route damage dealt by boss skills/hazards/summons through SOH's real hurtPlayer
    const dmgTaken = 1000 - playerActor.hp;
    if (dmgTaken > 0) {
      const nearest = Array.from(mounted.values())[0];
      const causeName = nearest ? PRIMORDIAL_ELDERS[nearest.key]?.name ?? nearest.key : 'Primordial Elder';
      deps.hurtPlayer(gs, Math.max(1, Math.round(dmgTaken * 0.85)), now, causeName);
    }

    // Local time/chill slow on player BEFORE next tick's moveBody — NEVER touches the 336h UTC run clock!
    if (playerActor.slowUntil > world.t && playerActor.slowMul < 1) {
      const mul = clamp(playerActor.slowMul, 0.35, 1);
      const remMs = Math.min(3000, Math.max(120, Math.round((playerActor.slowUntil - world.t) * 1000)));
      r.player.primordialSlowMul = mul;
      r.player.primordialSlowUntil = now + remMs;
      r.player.vx *= mul;
      r.player.vy *= mul;
    } else if (r.player.primordialSlowUntil !== undefined && now >= r.player.primordialSlowUntil) {
      delete r.player.primordialSlowMul;
      delete r.player.primordialSlowUntil;
    }
  }
}

/** Allow SOH melee swings, arrows, and Creator Cores to hit summoned Primordial minions (Anubis wraiths, Typhon brood). */
export function damagePrimordialSummons(r: RunState, x: number, y: number, radius: number, dmg: number): number {
  const sess = sessions.get(r);
  if (!sess) return 0;
  let hits = 0;
  for (const a of sess.world.actors) {
    if (!a.alive || a.kind !== 'summon') continue;
    if (dist(a.pos, v(x, y)) <= radius + a.r) {
      a.hp -= dmg;
      a.lastHurt = sess.world.t;
      hits++;
      if (a.hp <= 0) sess.world.kill(a);
    }
  }
  return hits;
}

export function isCreatureRenderedByPrimordialRig(r: RunState, m: Creature): boolean {
  if (!m.elder || !isPrimordialElderKey(m.elder.key)) return false;
  const sess = sessions.get(r);
  return !!sess?.mounted.has(m.id);
}

let overlayFb: FB | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;
let overlayImgData: ImageData | null = null;

const OVERLAY_OPTS: RenderOpts = {
  floor: 'dark',
  transparentBg: true,
  hidePlayerProxy: true,
  layers: { ground: true, hazards: true, actors: true, fx: true },
  hitboxes: false,
  heatmap: false,
  silhouette: false,
  noVfx: false,
  warnings: true,
  shake: 0.65,
};

/** Render all active Primordial Boss rigs, telegraphs, hazards, portals, eyes, chains, summons, and VFX onto `g`. */
export function renderPrimordialOverlay(
  g: CanvasRenderingContext2D,
  r: RunState,
  camX: number,
  camY: number,
): boolean {
  const sess = sessions.get(r);
  if (!sess || sess.mounted.size === 0) return false;
  if (typeof document === 'undefined') return false;

  if (!overlayFb || overlayFb.w !== VIEW_W || overlayFb.h !== VIEW_H) {
    overlayFb = new FB(VIEW_W, VIEW_H);
  }
  if (!overlayCanvas) {
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = VIEW_W;
    overlayCanvas.height = VIEW_H;
  }

  renderWorld(overlayFb, sess.world, camX, camY, OVERLAY_OPTS);

  const octx = overlayCanvas.getContext('2d');
  if (!octx) return false;
  if (!overlayImgData || overlayImgData.width !== VIEW_W || overlayImgData.height !== VIEW_H) {
    overlayImgData = octx.createImageData(VIEW_W, VIEW_H);
  }
  overlayImgData.data.set(overlayFb.data);
  octx.putImageData(overlayImgData, 0, 0);

  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(overlayCanvas, 0, 0);
  g.restore();
  return true;
}

export { SIGNATURE, skillsFor };
export type { BossId, Form, Shape };
