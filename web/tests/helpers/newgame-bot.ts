// ARENA 1 round 2 — New-Game route bot.
//
// Drives a REAL New Game on Veyra through the same surface the browser client uses:
//   * movement and tool swings are `tick()` Input (direction booleans, aim, attack) — no teleport;
//   * every other action is a `dispatch()` intent (craft, build, move, pickup, useItem, upgradeStation ...);
//   * the active hotbar slot is `player.active`, which is exactly what the Hotbar click handler writes (Game.tsx).
// It never calls addItem/mkStack/mkContainer, never writes an entity, never edits terrain, never removes creatures.
// It is an ENGINE-LEVEL bot, not a browser play-through: no rendering, no HUD, no human pacing. Every proof built on
// it is labelled that way.
import { ITEMS, RECIPES, STRUCTS } from '../../src/game/catalog';
import { TILE, WW, WH, type Entity, type GameState, type RunState } from '../../src/game/core';
import { C, blockGrid, buildReason, countItem, dispatch, newGame, sourceAt, startRun } from '../../src/game/engine';
import { tick, type Input } from '../../src/game/sim';
import { getWorld, setActiveLayout } from '../../src/game/world';
import { U05_WORLD_LAYOUT_ID } from '../../src/veyra05/scenes';
import { windowOrigin } from '../../src/veyra05/continuity';

export const BOT_T0 = Date.UTC(2026, 10, 14, 12);
const DT = 50;
export class BotStop extends Error {}

export class Bot {
  gs: GameState; r: RunState; now = BOT_T0; seq = 0;
  /** Veyra streams a 200x200 window and re-bases local tile coordinates when the player nears its edge. The bot keeps
   *  every target in GLOBAL tiles and re-plans after a shift. */
  started = new Set<string>(); toolsRemade = 0; repairs = 0;
  drinks = 0; resided = 0; stashed = 0; bandages = 0; hunts = 0; refuels = 0; fightTicks = 0; shifts = 0; private origin: [number, number] = [0, 0];
  failures: Record<string, number> = {}; private fail(why: string) { this.failures[why] = (this.failures[why] || 0) + 1; }
  /** GLOBAL tiles the bot must not build on (e.g. the seep it intends to pump). */
  keepClear: [number, number][] = [];
  private unreachable = new Set<string>();
  private deadSeen = new Set<string>();
  log: string[] = []; ate: Record<string, number> = {}; kills: Record<string, number> = {}; damageTaken = 0; ticks = 0;
  constructor(public seed: number, character: 'male' | 'female' = 'male') {
    if (!setActiveLayout(U05_WORLD_LAYOUT_ID)) throw new Error('layout');
    this.gs = newGame(); const rc = startRun(this.gs, character, BOT_T0, null, seed);
    if (!rc.ok) throw new Error('startRun: ' + JSON.stringify(rc)); this.r = this.gs.run!; this.origin = windowOrigin(this.r);
  }
  get p() { return this.r.player; }
  toGlobal(tx: number, ty: number): [number, number] { const [ox, oy] = windowOrigin(this.r); return [tx + ox, ty + oy]; }
  toLocal(gx: number, gy: number): [number, number] { const [ox, oy] = windowOrigin(this.r); return [gx - ox, gy - oy]; }
  get tile(): [number, number] { return [Math.floor(this.p.x / TILE), Math.floor(this.p.y / TILE)]; }
  minutes() { return (this.now - BOT_T0) / 60000; }
  note(s: string) { this.log.push(`[${this.minutes().toFixed(1)}m] ${s}`); }
  inv(key: string) { return countItem(this.r, 'inv', key); }
  /** Slot of a carried item; a tool with durability left is preferred over a worn-out one of the same kind. */
  slotOf(key: string) { const sl = C(this.r, 'inv').slots; const ok = sl.findIndex(s => s?.key === key && (s.dur === undefined || s.dur > 0)); return ok >= 0 ? ok : sl.findIndex(s => s?.key === key); }
  act(type: string, p: object = {}) { this.now += 10; return dispatch(this.gs, { id: `bot-${this.seed}-${++this.seq}`, type, ...p } as any, this.now) as any; }
  must(type: string, p: object = {}) { const rc = this.act(type, p); if (!rc.ok) throw new BotStop(`${type} ${JSON.stringify(p)} refused: ${rc.reason}`); return rc; }

  private idle(): Input { return { up: false, down: false, left: false, right: false, mx: this.p.x + Math.cos(this.p.aim) * 20, my: this.p.y + Math.sin(this.p.aim) * 20, attack: false, attackPressed: false, roll: false, cancel: false } as Input; }
  /** One real simulation step. A hostile in reach takes priority: the bot turns and swings its knife at it. */
  step(inp?: Partial<Input>, defend = true) {
    let input: Input = { ...this.idle(), ...(inp ?? {}) } as Input;
    if (defend) {
      // Self-defence: a creature that is hunting the bot and is close gets fought, on foot, with the best blade carried.
      const foe = this.r.creatures.filter(c => (c as any).hp > 0 && c.state !== 'dead' && (c.state === 'chase' || c.state === 'tell' || c.state === 'attack' || c.state === 'recover') && Math.hypot(c.x - this.p.x, c.y - this.p.y) < 44).sort((x, y) => Math.hypot(x.x - this.p.x, x.y - this.p.y) - Math.hypot(y.x - this.p.x, y.y - this.p.y))[0];
      if (foe) {
        this.hold(this.weapon()); const dx = foe.x - this.p.x, dy = foe.y - this.p.y, far = Math.hypot(dx, dy) > 15; this.fightTicks++;
        input = { ...this.idle(), left: far && dx < -3, right: far && dx > 3, up: far && dy < -3, down: far && dy > 3, mx: foe.x, my: foe.y, attack: true, attackPressed: !this.p.action } as Input;
      }
    }
    // A hurt player binds the wound with a carried bandage (ordinary `useItem`).
    if (this.p.hp > 0 && this.p.hp < 50 && !this.p.action) { const s = this.slotOf('bandage'); if (s >= 0 && this.act('useItem', { slot: s }).ok) this.bandages++; }
    const hp0 = this.p.hp, alive = new Map(this.r.creatures.map(c => [c.id, c.type] as const));
    this.now += DT; tick(this.gs, input, DT, this.now); this.ticks++;
    const o = windowOrigin(this.r); if (o[0] !== this.origin[0] || o[1] !== this.origin[1]) { this.origin = o; this.shifts++; }
    if (this.p.hp < hp0) this.damageTaken += hp0 - this.p.hp;
    for (const [id, type] of alive) { const c = this.r.creatures.find(x => x.id === id); if (c && (c.state === 'dead' || (c as any).hp <= 0) && !this.deadSeen.has(id)) { this.deadSeen.add(id); this.kills[type] = (this.kills[type] || 0) + 1; } }
    if (this.p.dead) throw new BotStop(`player died at ${this.minutes().toFixed(1)} min (hunger ${this.p.hunger.toFixed(0)}, thirst ${this.p.thirst.toFixed(0)})`);
  }
  wait(ms: number) { for (let t = 0; t < ms; t += DT) this.step(); }

  /** Put an item on the hotbar and select it (the Hotbar click). Returns false if not carried. */
  hold(key: string): boolean {
    let i = this.slotOf(key); if (i < 0) return false;
    if (i >= 8) { const free = C(this.r, 'inv').slots.findIndex((s, k) => k < 8 && (!s || !ITEMS[s.key].power)); if (free < 0) return false; this.must('move', { from: 'inv', fs: i, to: 'inv', ts: free }); i = this.slotOf(key); if (i >= 8) return false; }
    this.p.active = i; return true;
  }
  weapon(): string { let best = 'knife', bd = 0; for (const s of C(this.r, 'inv').slots) if (s && (s.dur === undefined || s.dur > 0)) { const d = ITEMS[s.key].dmg ?? 0; if (d > bd && !ITEMS[s.key].ranged) { bd = d; best = s.key; } } return best; }
  /** G1A: a source with its own harvest table is struck with whatever carried tool that table rates highest. */
  toolFor(def: { mat: string; harvestBy?: Record<string, number> }): string | null {
    if (!def.harvestBy) return this.bestTool(def.mat);
    // A player keeps an edge on the knife (it is also the weapon and what stone tools are re-cut with): below a fifth
    // of its life the bot stops spending it on salvage and falls back to a stone tool, which it can remake by hand.
    let best: string | null = null, bp = 0, bd = -1;
    for (const s of C(this.r, 'inv').slots) if (s && (s.dur === undefined || s.dur > 0)) {
      const pw = def.harvestBy[s.key] ?? Math.min(1, (ITEMS[s.key].power as Record<string, number> | undefined)?.[def.mat] ?? 0); if (pw <= 0) continue;
      if (s.key === 'knife' && s.dur !== undefined && s.dur < (ITEMS.knife.dur ?? 300) / 5) continue;
      const d = s.dur ?? 1e9; if (pw > bp || (pw === bp && d > bd)) { bp = pw; bd = d; best = s.key; }
    }
    return best;
  }
  bestTool(mat: string): string | null {
    let best: string | null = null, bp = 0;
    for (const s of C(this.r, 'inv').slots) if (s && (s.dur === undefined || s.dur > 0)) { const pw = ITEMS[s.key].power?.[mat] ?? 0; if (pw > bp) { bp = pw; best = s.key; } }
    return best;
  }

  /** Free ground, wadeable water, and a ladder over a cliff (foot-only crossing). */
  private passable(g: Uint8Array | number[], i: number) { return g[i] === 0 || g[i] === 4 || g[i] === 6; }
  /** BFS over the engine's own block grid. `adjacent`: stop on a free tile 4-adjacent to the target. */
  path(tx: number, ty: number, adjacent: boolean): number[] | null {
    const g = blockGrid(this.r) as any, [sx, sy] = this.tile, start = sy * WW + sx, from = new Int32Array(WW * WH).fill(-2), q = new Int32Array(WW * WH); let h = 0, t = 0;
    const goal = (i: number) => adjacent ? (Math.abs(i % WW - tx) + Math.abs(Math.floor(i / WW) - ty) === 1) : i === ty * WW + tx;
    from[start] = -1; q[t++] = start; let end = -1;
    while (h < t) { const i = q[h++]; if (goal(i)) { end = i; break; } const x = i % WW, y = Math.floor(i / WW);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * WW + nx; if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1 || from[j] !== -2 || !this.passable(g, j)) continue; from[j] = i; q[t++] = j; } }
    if (end < 0) return null; const out: number[] = []; for (let i = end; i !== -1; i = from[i]) out.push(i); return out.reverse();
  }
  /** BFS to the nearest free tile for which `goal(index)` holds. */
  pathWhere(goal: (i: number) => boolean, maxSteps = 140): number[] | null {
    const g = blockGrid(this.r) as any, [sx, sy] = this.tile, start = sy * WW + sx, from = new Int32Array(WW * WH).fill(-2), dist = new Int32Array(WW * WH), q = new Int32Array(WW * WH); let h = 0, t = 0;
    from[start] = -1; q[t++] = start; let end = -1;
    while (h < t) { const i = q[h++]; if (goal(i)) { end = i; break; } if (dist[i] >= maxSteps) continue; const x = i % WW, y = Math.floor(i / WW);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * WW + nx; if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1 || from[j] !== -2 || !this.passable(g, j)) continue; from[j] = i; dist[j] = dist[i] + 1; q[t++] = j; } }
    if (end < 0) return null; const out: number[] = []; for (let i = end; i !== -1; i = from[i]) out.push(i); return out.reverse();
  }
  /** Walk to the nearest fresh water and drink until no longer thirsty (the E prompt at a bank). Refills the flask. */
  drink(): boolean {
    const w = getWorld();
    for (let tries = 0; tries < 6; tries++) {
      const fresh = (i: number) => [1, -1, WW, -WW].some(d => w.fresh[i + d]);
      const p = this.pathWhere(fresh) ?? this.pathWhere(fresh, 600); if (!p) { this.note('drink: no fresh water within 600 steps'); return false; }
      if (!this.walk(p)) continue;
      const [tx, ty] = this.tile, i = ty * WW + tx, d = [1, -1, WW, -WW].find(k => w.fresh[i + k]); if (d === undefined) continue;
      const wx = ((i + d) % WW) * TILE + 8, wy = Math.floor((i + d) / WW) * TILE + 8; let n = 0;
      while (this.p.thirst < 90 && n++ < 6) { if (!this.act('drink', { x: wx, y: wy }).ok) break; this.drinks++; }
      return n > 0;
    }
    return false;
  }
  /** Walk a path with real movement input. Returns false if the bot could not follow it. */
  walk(path: number[]): boolean {
    const shifts0 = this.shifts;
    for (const i of path.slice(1)) {
      if (this.shifts !== shifts0) return false;
      const cx = (i % WW) * TILE + 8, cy = Math.floor(i / WW) * TILE + 8; let k = 0;
      while (Math.hypot(this.p.x - cx, this.p.y - cy) > 3.5) { if (++k > 120) return false; const dx = cx - this.p.x, dy = cy - this.p.y; this.step({ left: dx < -2, right: dx > 2, up: dy < -2, down: dy > 2, mx: cx, my: cy }); }
    }
    return true;
  }
  /** Walk to a free tile beside a GLOBAL tile. Re-plans after a window shift or a blocked step. */
  goNearGlobal(gx: number, gy: number): boolean {
    for (let tries = 0; tries < 8; tries++) { const [tx, ty] = this.toLocal(gx, gy); if (tx < 1 || ty < 1 || tx >= WW - 1 || ty >= WH - 1) return false; const p = this.path(tx, ty, true); if (!p) return false; if (this.walk(p)) return true; }
    return false;
  }
  /** Long-distance travel to a GLOBAL tile that may lie outside the streamed window: walk toward the window edge and
   *  let the engine re-base, then finish with a normal approach. */
  travel(gx: number, gy: number): boolean {
    for (let leg = 0; leg < 40; leg++) {
      const [tx, ty] = this.toLocal(gx, gy);
      if (tx >= 3 && ty >= 3 && tx < WW - 3 && ty < WH - 3) { if (this.goNearGlobal(gx, gy)) return true; }
      const cx = Math.max(6, Math.min(WW - 7, tx)), cy = Math.max(6, Math.min(WH - 7, ty)), s0 = this.shifts, at0 = this.tile.join(',');
      const p = this.pathWhere(i => Math.max(Math.abs(i % WW - cx), Math.abs(Math.floor(i / WW) - cy)) <= 5, 600); if (!p) return false;
      this.walk(p); if (this.shifts === s0 && this.tile.join(',') === at0) return false;
    }
    return false;
  }
  /** Walk back to a structure by id and stand beside it. `home` is a GLOBAL tile near it, used when the structure has
   *  been streamed out of the window. Throws if it cannot be reached. */
  at(id: string, home: [number, number]): Entity {
    for (let k = 0; k < 4; k++) { const e = this.r.entities[id]; if (e && this.goNear(e.tx!, e.ty!)) return e; if (!this.travel(home[0], home[1])) break; }
    throw new BotStop('cannot walk back to ' + id);
  }
  goNear(tx: number, ty: number): boolean { const [gx, gy] = this.toGlobal(tx, ty); return this.goNearGlobal(gx, gy); }

  /** Nearest live sources of the given kinds (engine `sourceAt`, so depletion and regrowth are respected). */
  sources(kinds: string[], max = 12): { tx: number; ty: number; key: string; d: number }[] {
    const w = getWorld(), [px, py] = this.tile, out: { tx: number; ty: number; key: string; d: number }[] = [];
    for (let i = 0; i < w.sourceV3.length; i++) { const k = w.sourceV3[i]; if (!k || !kinds.includes(k)) continue; const tx = i % WW, ty = Math.floor(i / WW); out.push({ tx, ty, key: k, d: Math.abs(tx - px) + Math.abs(ty - py) }); }
    out.sort((a, b) => a.d - b.d); const live: typeof out = [];
    for (const s of out) { if (this.unreachable.has(this.toGlobal(s.tx, s.ty).join(','))) continue; const src = sourceAt(this.r, s.tx, s.ty, this.now); if (src && src.stock > 0 && src.key === s.key) { live.push(s); if (live.length >= max) break; } }
    return live;
  }
  pickupNearby(): number {
    let n = 0;
    for (let pass = 0; pass < 3; pass++) for (const e of Object.values(this.r.entities)) if (e.kind === 'drop' && Math.hypot(e.x - this.p.x, e.y - this.p.y) < 2.4 * TILE && !this.leave.has(C(this.r, e.c!)?.slots[0]?.key ?? '')) { if (this.act('pickup', { eid: e.id }).ok) n++; }
    return n;
  }
  /** Swing the best carried tool at one source until it is empty; pick up what falls. */
  harvestOne(s: { tx: number; ty: number; key: string }): boolean {
    const src0 = sourceAt(this.r, s.tx, s.ty, this.now); if (!src0 || src0.stock <= 0) return false;
    const tool = this.toolFor(src0.def); if (!tool) return false;
    const [gx, gy] = this.toGlobal(s.tx, s.ty);
    if (!this.goNearGlobal(gx, gy)) { this.unreachable.add(gx + ',' + gy); this.fail(`${s.key}: no walkable route`); return false; } if (!this.hold(tool)) { this.fail(`${s.key}: cannot put ${tool} on the hotbar`); return false; }
    let lastHp = -1, stale = 0; const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 900; k++) {
      const [tx, ty] = this.toLocal(gx, gy); const src = sourceAt(this.r, tx, ty, this.now); if (!src || src.stock <= 0) break;
      // A swing that never bites (the node cannot be struck from this side) is abandoned after 4 s and not retried.
      const hpNow = src.stock * 1000 + src.hp; if (hpNow === lastHp) { if (++stale > 80) {
        // Like a player, step round to another side of the node before giving up (a neighbouring node can soak the swing).
        let moved = false;
        while (sides.length && !moved) { const [dx, dy] = sides.shift()!; const pth = this.path(tx + dx, ty + dy, false); if (pth && pth.length < 30 && this.walk(pth) && this.tile[0] === tx + dx && this.tile[1] === ty + dy) moved = true; }
        if (!moved) { this.unreachable.add(gx + ',' + gy); this.fail(`${s.key}: swing never connected from any side`); return false; }
        this.resided++; stale = 0;
      } } else { stale = 0; lastHp = hpNow; }
      if (Math.abs(this.tile[0] - tx) + Math.abs(this.tile[1] - ty) > 1 && !this.goNearGlobal(gx, gy)) return false;   // pushed away (a fight, a shift)
      this.hold(tool); this.step({ mx: tx * TILE + 8, my: ty * TILE + 8, attack: true, attackPressed: !this.p.action }); if (k % 20 === 19) this.pickupNearby();
    }
    this.wait(200); this.pickupNearby(); this.act('sort', { c: 'inv' });
    { const [tx, ty] = this.toLocal(gx, gy); const left = sourceAt(this.r, tx, ty, this.now)?.stock ?? 0; if (left > 0) this.fail(`${s.key}: ${left} left after 45 s of swinging ${tool}`); }
    return true;
  }
  /** Gather until `count` of `item` is carried. Returns false (with a note) if the world within reach runs out. */
  gather(item: string, count: number, kinds: string[], maxNodes = 60): boolean {
    for (let n = 0; n < maxNodes && this.inv(item) < count; n++) {
      const cands = this.sources(kinds, 8); let done = false;
      if (cands.length && !this.toolFor(sourceAt(this.r, cands[0].tx, cands[0].ty, this.now)!.def)) { this.note(`gather ${item}: no working tool carried for ${cands[0].key}`); this.fail(`${cands[0].key}: no working tool`); return false; }
      for (const s of cands) { if (this.harvestOne(s)) { done = true; break; } }
      if (!done) { for (const s of cands) this.unreachable.add(this.toGlobal(s.tx, s.ty).join(','));   // tried and failed: look further out next pass
        if (cands.length) continue; this.note(`gather ${item}: no reachable ${kinds.join('/')} (have ${this.inv(item)}/${count})`); return false; }
    }
    return this.inv(item) >= count;
  }
  /** Hunt the nearest animal of the given kinds on foot with the carried blade. Real chase, real swings; gives up after
   *  `maxSec`. Returns true if it died (its drops are then picked up). */
  hunt(types: string[], maxSec = 25, maxTiles = 30): boolean {
    const prey = this.r.creatures.filter(c => types.includes(c.type) && (c as any).hp > 0 && c.state !== 'dead' && Math.hypot(c.x - this.p.x, c.y - this.p.y) < maxTiles * TILE).sort((x, y) => Math.hypot(x.x - this.p.x, x.y - this.p.y) - Math.hypot(y.x - this.p.x, y.y - this.p.y))[0];
    if (!prey) return false; this.hunts++;
    for (let k = 0; k < maxSec * 1000 / DT; k++) {
      const c = this.r.creatures.find(x => x.id === prey.id);
      if (!c || c.state === 'dead' || (c as any).hp <= 0) { this.wait(300); for (const e of Object.values(this.r.entities)) if (e.kind === 'drop' && Math.hypot(e.x - prey.x, e.y - prey.y) < 3 * TILE) { this.goNear(Math.floor(e.x / TILE), Math.floor(e.y / TILE)); } this.pickupNearby(); this.act('sort', { c: 'inv' }); return !!c || true; }
      if (this.p.hp < 45) { this.note(`hunt of ${prey.type} broken off at ${Math.round(this.p.hp)} hp`); return false; }
      this.hold(this.weapon()); const dx = c.x - this.p.x, dy = c.y - this.p.y, far = Math.hypot(dx, dy) > 14;
      this.step({ left: far && dx < -3, right: far && dx > 3, up: far && dy < -3, down: far && dy > 3, mx: c.x, my: c.y, attack: !far || Math.hypot(dx, dy) < 22, attackPressed: !this.p.action && Math.hypot(dx, dy) < 22 }, false);
    }
    return false;
  }
  /** Pay for a directed study at a Research Table, wait for it, carry the blueprint and read it. */
  study(table: Entity, recipe: string) {
    this.must('research', { eid: table.id, mode: 'directed', recipe }); if (!this.runStation(table)) throw new BotStop('research table stalled');
    const bp = C(this.r, 'inv').slots.findIndex(s => s?.key === 'blueprint' && s.meta === recipe); if (bp < 0) throw new BotStop(`no ${recipe} blueprint came out of the table`);
    this.must('useItem', { slot: bp }); if (!this.r.knowledge.recipes.includes(recipe)) throw new BotStop(`${recipe} was not learned`);
  }
  eat(key: string): boolean { const i = this.slotOf(key); if (i < 0) return false; const rc = this.act('useItem', { slot: i }); if (rc.ok) this.ate[key] = (this.ate[key] || 0) + 1; return rc.ok; }
  craft(recipe: string, eid?: string) { return this.must('craft', eid ? { recipe, eid } : { recipe }); }
  /** Hand-craft the packed device, then place it on a free tile beside the bot. Returns the placed entity. */
  place(struct: string): Entity {
    const keep = this.keepClear.map(g => this.toLocal(g[0], g[1]).join(','));
    if (ITEMS['deploy_' + struct] && this.inv('deploy_' + struct) < 1) this.craft('deploy_' + struct);
    const [px, py] = this.tile, before = new Set(Object.keys(this.r.entities));
    for (let rad = 1; rad <= 3; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      if (keep.includes(`${px + dx},${py + dy}`) || buildReason(this.gs, struct, px + dx, py + dy)) continue;
      // Never wall yourself in: after this build the bot's own tile must keep two open sides (a player sees this; the bot must check).
      if (Math.abs(dx) + Math.abs(dy) === 1) { const g = blockGrid(this.r); let open = 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!(ax === dx && ay === dy) && this.passable(g, (py + ay) * WW + px + ax)) open++; if (open < 2) continue; }
      if (!this.act('build', { struct, tx: px + dx, ty: py + dy }).ok) continue;
      const e = Object.values(this.r.entities).find(x => !before.has(x.id) && x.type === struct); if (e) { this.note(`placed ${STRUCTS[struct].name}`); return e; }
    }
    throw new BotStop(`no place for ${struct}: ${buildReason(this.gs, struct, px + 1, py)}`);
  }
  /** Repair every carried tool below `frac` durability at an owned station the bot stands beside (the bench's Repair
   *  action). Returns how many were repaired. */
  repairTools(bench: Entity, frac = 0.35, intent = 'maintainItem'): number {
    let n = 0; const inv = C(this.r, 'inv');
    for (let i = 0; i < inv.slots.length; i++) { const s = inv.slots[i]; const d = s && ITEMS[s.key]; if (!s || !d || !d.repair || !d.dur || s.dur === undefined || s.dur > d.dur * frac) continue;
      if (this.act(intent, { eid: bench.id, slot: i, uid: s.uid, mode: 'repair' }).ok) { n++; this.repairs++; } }
    return n;
  }
  /** True if a tool of this id with durability left is carried. */
  working(key: string): boolean { return C(this.r, 'inv').slots.some(s => s?.key === key && (s.dur === undefined || s.dur > 0)); }
  /** Put everything except `keep` into an owned chest the bot stands beside (drag pack -> chest). Returns stacks stored. */
  stash(chest: Entity, keep: string[], toolsToo = false): number {
    let n = 0; const inv = C(this.r, 'inv');
    for (let i = 0; i < inv.slots.length; i++) { const s = inv.slots[i]; if (!s || keep.includes(s.key) || (!toolsToo && (ITEMS[s.key].power || ITEMS[s.key].dmg))) continue; if (this.act('move', { from: 'inv', fs: i, to: chest.c! }).ok) n++; }
    this.act('sort', { c: 'inv' }); this.stashed += n; return n;
  }
  /** Pack full: put by-products this route has no use for on the ground (the ordinary `drop` intent), as a player would. */
  leave = new Set<string>();
  dropJunk(keys: string[]): number {
    const inv = C(this.r, 'inv'); let n = 0; for (const k of keys) this.leave.add(k);   // and do not pick them back up
    for (let i = 0; i < inv.slots.length; i++) { const s = inv.slots[i]; if (s && keys.includes(s.key) && this.act('drop', { c: 'inv', slot: i }).ok) n++; }
    // Drops within ~2 tiles are pulled back into the pack after 0.4 s, so step well clear straight away.
    if (n) { const [px, py] = this.tile; const pth = this.pathWhere(i => Math.max(Math.abs((i % WW) - px), Math.abs(Math.floor(i / WW) - py)) >= 5, 60); if (pth) this.walk(pth); }
    if (n) this.note(`pack full: dropped ${n} stack(s) of by-products`); return n;
  }
  /** Take every stack of the listed items back out of an owned chest the bot stands beside. */
  withdraw(chest: Entity, keys: string[]): number {
    let n = 0; const c = C(this.r, chest.c!);
    for (let i = 0; i < c.slots.length; i++) { const s = c.slots[i]; if (s && keys.includes(s.key) && this.act('move', { from: c.id, fs: i, to: 'inv' }).ok) n++; }
    this.act('sort', { c: 'inv' }); return n;
  }
  /** Put one whole stack of a burnable into a station's fuel container (the drag from pack to the fuel slot). */
  fuel(e: Entity, key: string) { this.act('sort', { c: 'inv' }); const i = this.slotOf(key); if (i < 0) throw new BotStop('no ' + key + ' for fuel'); this.must('move', { from: 'inv', fs: i, to: e.station!.fuelC }); }
  /** Wait (real ticks) until the station queue is empty, then carry its outputs. If the job stops moving the bot does
   *  what a player does: empties the output slots, then feeds the fire from the wood it carries. */
  runStation(e: Entity, maxMs = 900000): boolean {
    const collect = () => { this.goNear(e.tx!, e.ty!); const out = C(this.r, e.station!.outC); for (let i = 0; i < out.slots.length; i++) if (out.slots[i]) { const rc = this.act('move', { from: out.id, fs: i, to: 'inv' }); if (!rc.ok) throw new BotStop(`cannot collect ${out.slots[i]!.key} from ${e.type}: ${rc.reason}`); } };
    let last = -1, stale = 0, rescues = 0;
    for (let t = 0; t < maxMs && e.station!.queue.length; t += DT) {
      this.step(); const left = e.station!.queue.reduce((n, j) => n + j.left, 0);
      if (left !== last) { last = left; stale = 0; continue; }
      if (++stale < 100) continue; stale = 0;
      if (++rescues > 12) { this.note(`${e.type}: job stopped and could not be restarted`); return false; }
      collect();
      // Fire out and no wood carried: fetch some, as a player would, instead of watching a cold furnace.
      if (this.inv('wood') < 1 && C(this.r, e.station!.fuelC).slots.length && !(e.station!.burn! > 0) && !C(this.r, e.station!.fuelC).slots.some(Boolean)) { this.gather('wood', 8, ['oak', 'pine', 'snowpine', 'palm', 'willow', 'deadtree'], 8); this.goToEntity(e); }
      if (this.inv('wood') > 0 && C(this.r, e.station!.fuelC).slots.length) { this.fuel(e, 'wood'); this.refuels++; }
    }
    const ok = e.station!.queue.length === 0; collect(); return ok;
  }
  /** Walk back to a placed structure. Its local tile is re-read every try: the engine re-bases it on a window shift. */
  goToEntity(e: Entity): boolean { for (let k = 0; k < 4; k++) { const live = this.r.entities[e.id]; if (!live) return false; if (this.goNear(live.tx!, live.ty!)) return true; } return false; }
  summary() { return { seed: this.seed, minutes: +this.minutes().toFixed(1), ticks: this.ticks, hp: Math.round(this.p.hp), hunger: Math.round(this.p.hunger), thirst: Math.round(this.p.thirst), drinks: this.drinks, toolsRemade: this.toolsRemade, toolRepairs: this.repairs, nodesStruckFromAnotherSide: this.resided, stacksStashed: this.stashed, bandages: this.bandages, hunts: this.hunts, refuels: this.refuels, fightSeconds: Math.round(this.fightTicks * DT / 1000), shifts: this.shifts, damageTaken: Math.round(this.damageTaken), failures: this.failures, ate: this.ate, kills: this.kills }; }
}
export const recipeBill = (id: string) => RECIPES[id].ins.map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ');
