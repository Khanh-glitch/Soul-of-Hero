// Survivor Handbook (Journey · Fieldcraft): every mechanic explained, no single way to play enforced,
// one-time supply bundle per chapter. Creator decision 2026-11-22.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dispatchCarryingPack } from './helpers/build-kit';
import { ITEMS, STRUCTS } from '../src/game/catalog';
import { TILE, WW, type GameState, type RunState } from '../src/game/core';
import { addItem, blockGrid, C, countItem, dispatch, newGame, receipt } from '../src/game/engine';
import {
  FIELDCRAFT, FIELDCRAFT_BY_ID, TIER_MARKS, beginNpcReceipt, chapterView, endNpcReceipt, stepKey, syncHandbook,
} from '../src/game/handbook';
import { setLang } from '../src/game/i18n';
import { freshStore, ingestJourney, lessonClaimable, lessonComplete, resolveTrack, suggestLesson } from '../src/game/journey';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';

const T0 = Date.UTC(2026, 10, 9, 8, 0, 0);
let clock = T0;
const tickNow = () => (clock += 50);

afterEach(() => { PROJ.length = 0; HAZ.length = 0; FX.length = 0; setActiveLayout('shipping'); setLang('en'); clock = T0; });

function start(seed = 7): { gs: GameState; r: RunState } {
  const gs = newGame();
  expect(dispatch(gs, { id: `hb-start-${seed}`, type: 'startRun', character: 'female', seed }, T0).ok).toBe(true);
  return { gs, r: gs.run! };
}
let n = 0;
const act = (gs: GameState, type: string, extra: Record<string, unknown> = {}) => dispatch(gs, { id: `hb-${++n}`, type, ...extra } as any, tickNow());
const done = (r: RunState, chapter: string, step: string) => !!r.handbook?.done.includes(stepKey(chapter, step));
const slotOf = (r: RunState, key: string) => C(r, 'inv').slots.findIndex(s => s?.key === key);
/** Commit a receipt exactly as the engine does (the public `receipt()` is the engine's own commit path). */
const commit = (r: RunState, kind: string, detail: string) => receipt(r, tickNow(), kind, detail);

describe('Survivor Handbook · definitions', () => {
  it('has eleven chapters with unique ids, bilingual text and a real supply bundle each', () => {
    expect(FIELDCRAFT.map(l => l.id)).toEqual(['landfall', 'shelter', 'industry', 'knowledge', 'provisions', 'expedition', 'combat', 'residents', 'machines', 'cores', 'ragnarok']);
    const keys = new Set<string>();
    for (const l of FIELDCRAFT) {
      expect(l.title && l.motto && l.vi.title && l.vi.motto).toBeTruthy();
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.reward.length).toBeGreaterThan(0);
      for (const [key, qty] of l.reward) {
        const def = ITEMS[key];
        expect(def, `${l.id} reward ${key}`).toBeTruthy();
        expect(String(def.desc ?? '').startsWith('Retired'), `${key} is a retired item`).toBe(false);
        expect(qty).toBeGreaterThan(0);
        expect(qty).toBeLessThanOrEqual(def.max ?? 1);
        // No currency and nothing that carries value out of the run.
        expect(['rcash', 'escrow_chest', 'keycard']).not.toContain(key);
      }
      for (const id of l.needs ?? []) expect(l.steps.some(s => s.id === id)).toBe(true);
      for (const s of l.steps) {
        const k = stepKey(l.id, s.id);
        expect(keys.has(k)).toBe(false); keys.add(k);
        expect(s.title && s.how && s.why && s.vi.title && s.vi.how && s.vi.why).toBeTruthy();
        expect(s.target).toBeGreaterThan(0);
        expect(s.kinds.length).toBeGreaterThan(0);
      }
    }
    expect(keys.size).toBe(40);
  });

  it('every bundle is a soft starter: a ready-made piece of a feature the chapter did not teach, with one line saying what it opens', () => {
    // Creator ruling on build 98ee24ac: the player never has to make everything alone.
    const keysOf = (id: string) => FIELDCRAFT_BY_ID[id].reward.map(([k]) => k);
    // The run already starts (and every wake-up restarts) with a Stone Axe, so the first bundle does not repeat it; the pickaxe no longer exists.
    expect(keysOf('landfall')).toEqual(['wood_club', 'deploy_claim', 'deploy_campfire', 'cooked_meat']);
    expect(keysOf('shelter')).toEqual(['deploy_workbench', 'deploy_chest_small', 'deploy_bed_straw', 'torch']);
    expect(keysOf('industry')).toEqual(['deploy_research', 'iron_ingot', 'charcoal', 'rope']);
    expect(keysOf('knowledge')).toEqual(['deploy_garden', 'seed_sunroot', 'spares', 'electronic_parts']);
    expect(keysOf('provisions')).toEqual(['lead_rope', 'deploy_feed_trough', 'trail_canteen', 'seed_wildberry']);
    expect(keysOf('expedition')).toEqual(['cart_kit', 'trail_pack', 'bandage']);
    // The first six each hand over something to place at once: a packed device or a kit, no crafting needed.
    for (const l of FIELDCRAFT.slice(0, 6)) expect(l.reward.some(([k]) => k.startsWith('deploy_') || k.endsWith('_kit')), l.id).toBe(true);
    // No bundle hands back the starting axe, and none holds a retired pickaxe.
    for (const l of FIELDCRAFT) for (const [k] of l.reward) expect(['stone_axe', 'stone_pick', 'iron_pick', 'industrial_pick'], l.id).not.toContain(k);
    // One line per chapter, in both languages, says what the bundle opens.
    for (const l of FIELDCRAFT) { expect(l.opens.en.length, l.id).toBeGreaterThan(20); expect(l.opens.vi.length, l.id).toBeGreaterThan(20); expect(l.opens.en).not.toBe(l.opens.vi); }
    // A placed bundle piece is a real structure the player may build with nothing else in hand.
    for (const l of FIELDCRAFT.slice(0, 6)) for (const [k] of l.reward) if (k.startsWith('deploy_')) expect(STRUCTS[k.slice('deploy_'.length)]?.item, k).toBe(k);
  });

  it('early bundles hand over the next chore; later bundles are the bigger ones', () => {
    expect(FIELDCRAFT.slice(0, 3).every(l => l.tier === 1)).toBe(true);
    expect(FIELDCRAFT.slice(3, 7).every(l => l.tier === 2)).toBe(true);
    expect(FIELDCRAFT.slice(7).every(l => l.tier === 3)).toBe(true);
    expect(FIELDCRAFT_BY_ID.combat.reward.map(([k]) => k)).toContain('bow');
    expect(TIER_MARKS[3]).toBeGreaterThan(TIER_MARKS[1]);
  });

  it('every receipt kind a step listens for is really emitted by the engine', () => {
    const dir = join(__dirname, '..', 'src', 'game');
    const src = readdirSync(dir).filter(f => f.endsWith('.ts') && !['handbook.ts', 'journey.ts', 'presentation-cues.ts', 'field-notes.ts'].includes(f))
      .map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const missing: string[] = [];
    for (const l of FIELDCRAFT) for (const s of l.steps) for (const kind of s.kinds) {
      const k = kind.replace(/\./g, '\\.');
      const emitted = new RegExp(`\\bok\\(\\s*'${k}'`).test(src) || new RegExp(`receipt\\([^;\\n]{0,80}?'${k}'`).test(src);
      if (!emitted) missing.push(`${l.id}.${s.id}:${kind}`);
    }
    expect(missing).toEqual([]);
  });

  it('every step answers to at least one of its own kinds and to nothing unrelated', () => {
    const unrelated = { id: 'x', seq: 1, at: T0, kind: 'human.work', detail: 'h1:strike:bush@1,1' };
    for (const l of FIELDCRAFT) for (const s of l.steps) expect(s.count(unrelated as any)).toBe(0);
  });
});

describe('Survivor Handbook · progress is unordered and receipt-backed', () => {
  it('credits a later step done before the earlier ones, then completes the chapter in any order', () => {
    const { gs, r } = start();
    // Eat first: Landfall's THIRD step, before gathering or crafting anything.
    const berry = slotOf(r, 'berries');
    r.player.hunger = 40;
    expect(act(gs, 'useItem', { slot: berry }).ok).toBe(true);
    expect(done(r, 'landfall', 'sustain')).toBe(true);
    expect(done(r, 'landfall', 'gather')).toBe(false);
    // Craft second (step two) with materials in the pack.
    addItem(r, 'inv', 'fiber', 8);
    expect(act(gs, 'craft', { recipe: 'bandage' }).ok).toBe(true);
    expect(done(r, 'landfall', 'tool')).toBe(true);
    expect(chapterView(r, FIELDCRAFT_BY_ID.landfall).claimable).toBe(false);
    // Gather last (step one).
    commit(r, 'harvest', 'oak@10,10 -2');
    expect(r.handbook!.steps[stepKey('landfall', 'gather')]).toBe(2);
    commit(r, 'harvest', 'oak@10,10 -1');
    expect(done(r, 'landfall', 'gather')).toBe(true);
    const v = chapterView(r, FIELDCRAFT_BY_ID.landfall);
    expect(v.complete && v.claimable && !v.claimed).toBe(true);
    // The same bandage also counted for another chapter without being asked to: nothing is a chain.
    const bandage = slotOf(r, 'bandage');
    r.player.hp = 50;
    expect(act(gs, 'useItem', { slot: bandage }).ok).toBe(true);
    expect(done(r, 'combat', 'heal')).toBe(true);
  });

  it('keeps progress when the 250-receipt ring evicts the original receipts', () => {
    const { r } = start();
    commit(r, 'harvest', 'oak@1,1 -1');
    for (let i = 0; i < 400; i++) commit(r, 'human.work', `h${i}:strike:bush@1,1`);
    expect(r.receipts.some(rc => rc.kind === 'harvest')).toBe(false);
    commit(r, 'harvest', 'oak@1,1 -2');
    expect(done(r, 'landfall', 'gather')).toBe(true);
  });

  it('folds receipts appended outside receipt() on the next sync, exactly once', () => {
    const { r } = start();
    const seq = r.seq + 1;
    r.receipts.push({ id: `r${seq}`, seq, at: T0 + 10, kind: 'build', detail: 'wall_wood@3,3' } as any); r.seq = seq;
    syncHandbook(r); syncHandbook(r);
    expect(r.handbook!.steps[stepKey('shelter', 'walls')]).toBe(1);
  });

  it('"any one of" steps accept every listed approach and pay the same either way', () => {
    for (const kind of ['human.exchange', 'human.aid.commit', 'human.repair', 'human.kitchen.contribute', 'human.follow', 'human.order', 'human.threaten', 'human.loot']) {
      const { r } = start();
      commit(r, kind, 'h1:x');
      expect(done(r, 'residents', 'deal'), kind).toBe(true);
    }
    for (const kind of ['evac.board', 'elder.defeat']) {
      const { r } = start();
      commit(r, kind, 'x');
      expect(done(r, 'ragnarok', 'ending'), kind).toBe(true);
    }
    for (const kind of ['garden.harvest', 'creature.kill', 'husbandry.tame']) {
      const { r } = start();
      commit(r, kind, 'x:y');
      expect(done(r, 'provisions', 'yield'), kind).toBe(true);
    }
  });

  it('never credits a resident\'s work to the player', () => {
    const { r } = start();
    // A resident hunter's kill is wrapped by the engine in the NPC attribution flag.
    beginNpcReceipt(); commit(r, 'creature.kill', 'boar:m1'); endNpcReceipt();
    expect(done(r, 'combat', 'defend')).toBe(false);
    expect(r.dailyLedger!.lastSeq).toBe(r.seq);
    // A furnace owned by a community finishing a job is not the player's smelt.
    r.entities['npcF'] = { id: 'npcF', kind: 'struct', type: 'furnace', x: 8, y: 8, tx: 0, ty: 0, owner: 'community-1' } as any;
    commit(r, 'job.done', 'npcF:iron_ingot');
    expect(done(r, 'industry', 'smelt')).toBe(false);
    r.entities['myF'] = { id: 'myF', kind: 'struct', type: 'furnace', x: 24, y: 8, tx: 1, ty: 0 } as any;
    commit(r, 'job.done', 'myF:iron_ingot');
    expect(done(r, 'industry', 'smelt')).toBe(true);
    // A settlement's generator burning fuel is not the player working with fuel; the player's own generator is.
    r.entities['npcG'] = { id: 'npcG', kind: 'struct', type: 'base_generator', x: 8, y: 24, tx: 0, ty: 1, owner: 'com:po_ironmine' } as any;
    commit(r, 'power.fuel', 'npcG:charcoal');
    expect(done(r, 'machines', 'fuel')).toBe(false);
    r.entities['myG'] = { id: 'myG', kind: 'struct', type: 'base_generator', x: 24, y: 24, tx: 1, ty: 1 } as any;
    commit(r, 'power.fuel', 'myG:charcoal');
    expect(done(r, 'machines', 'fuel')).toBe(true);
    // The player's own kill counts.
    commit(r, 'creature.kill', 'boar:m2');
    expect(done(r, 'combat', 'defend')).toBe(true);
  });

  it('restores what an older save still proves (achievements, discovered places)', () => {
    const { r } = start();
    delete r.handbook;
    r.receipts = r.receipts.filter(rc => rc.kind !== 'run.start');
    r.achievements.push('first_home', 'ragnarok');
    r.poiSeen.push('a', 'b');
    syncHandbook(r);
    expect(done(r, 'shelter', 'home')).toBe(true);
    expect(done(r, 'ragnarok', 'omen')).toBe(true);
    expect(done(r, 'expedition', 'discover')).toBe(true);
  });
});

describe('Survivor Handbook · one supply bundle per chapter per run', () => {
  function finishLandfall(r: RunState) {
    commit(r, 'harvest', 'oak@1,1 -3'); commit(r, 'craft.hand', 'rope'); commit(r, 'consume', 'berries');
  }

  it('refuses before the chapter is done, issues the items once, and survives a reload', () => {
    const { gs, r } = start();
    expect(act(gs, 'handbookClaim', { chapter: 'landfall' }).ok).toBe(false);
    expect(act(gs, 'handbookClaim', { chapter: 'nope' }).ok).toBe(false);
    expect(act(gs, 'handbookClaim', { chapter: '__proto__' }).ok).toBe(false);
    finishLandfall(r);
    const before = Object.fromEntries(FIELDCRAFT_BY_ID.landfall.reward.map(([k]) => [k, countItem(r, 'inv', k)]));
    const res = act(gs, 'handbookClaim', { chapter: 'landfall' });
    expect(res.ok).toBe(true);
    for (const [k, q] of FIELDCRAFT_BY_ID.landfall.reward) expect(countItem(r, 'inv', k) - before[k], k).toBe(q);
    expect(r.receipts.at(-1)).toMatchObject({ kind: 'journey.handbook', detail: 'landfall:items' });
    expect(act(gs, 'handbookClaim', { chapter: 'landfall' }).ok).toBe(false);

    const snap = serializeSnapshot(gs);
    expect(validate(JSON.parse(JSON.parse(snap).payload))).toBeTruthy();
    const again = selectSnapshots([snap, null]).gs!;
    expect(again.run!.handbook!.claimed).toEqual(['landfall']);
    expect(dispatch(again, { id: 'hb-reload-claim', type: 'handbookClaim', chapter: 'landfall' } as any, clock + 100).ok).toBe(false);
  });

  it('drops what does not fit instead of deleting it', () => {
    const { gs, r } = start();
    finishLandfall(r);
    const inv = C(r, 'inv');
    for (let i = 0; i < inv.slots.length; i++) if (!inv.slots[i]) addItem(r, 'inv', 'wood_club', 1);
    expect(inv.slots.every(Boolean)).toBe(true);
    const drops = () => Object.values(r.entities).filter(e => e.kind === 'drop').length;
    const d0 = drops();
    expect(act(gs, 'handbookClaim', { chapter: 'landfall' }).ok).toBe(true);
    expect(drops()).toBeGreaterThan(d0);
  });

  it('is refused in a QA-modified run', () => {
    const { gs, r } = start();
    finishLandfall(r);
    r.qaUsed = true;
    expect(act(gs, 'handbookClaim', { chapter: 'landfall' }).ok).toBe(false);
    expect(r.handbook!.claimed).toEqual([]);
  });

  it('opens the Ragnarok cache the moment Ragnarok begins, before the ending is chosen', () => {
    const { gs, r } = start();
    commit(r, 'achievement', 'ragnarok');
    const v = chapterView(r, FIELDCRAFT_BY_ID.ragnarok);
    expect(v.claimable).toBe(true);
    expect(v.complete).toBe(false);
    expect(act(gs, 'handbookClaim', { chapter: 'ragnarok' }).ok).toBe(true);
  });

  it('rejects a malformed ledger on load', () => {
    const { gs } = start();
    const payload = JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    expect(validate(JSON.parse(JSON.stringify(payload)))).toBeTruthy();
    for (const bad of [
      { v: 2, lastSeq: 0, steps: {}, done: [], claimed: [] },
      { v: 1, lastSeq: 1e9, steps: {}, done: [], claimed: [] },
      { v: 1, lastSeq: 0, steps: { a: -1 }, done: [], claimed: [] },
      { v: 1, lastSeq: 0, steps: {}, done: ['a', 'a'], claimed: [] },
      { v: 1, lastSeq: 0, steps: {}, done: [], claimed: 'landfall' },
    ]) {
      const p = JSON.parse(JSON.stringify(payload)); p.run.handbook = bad;
      expect(validate(p), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('Survivor Handbook · Journey store, tracker and language', () => {
  it('announces steps and the waiting bundle, grants Marks once, and adopts another run quietly', () => {
    const { gs, r } = start();
    let store = freshStore();
    let res = ingestJourney(store, gs, tickNow()); store = res.store;
    expect(res.events.filter(e => e.kind === 'step')).toEqual([]);
    commit(r, 'harvest', 'oak@1,1 -3');
    res = ingestJourney(store, gs, tickNow()); store = res.store;
    expect(res.events.some(e => e.kind === 'step' && e.title === 'Gather with your axe')).toBe(true);
    commit(r, 'craft.hand', 'rope'); commit(r, 'consume', 'berries');
    res = ingestJourney(store, gs, tickNow()); store = res.store;
    expect(lessonComplete(store, FIELDCRAFT_BY_ID.landfall)).toBe(true);
    expect(lessonClaimable(store, FIELDCRAFT_BY_ID.landfall)).toBe(true);
    expect(res.events.some(e => e.kind === 'reward' && e.title === 'Starter kit ready')).toBe(true);
    expect(store.marks).toBe(TIER_MARKS[1]);
    expect(store.chronicle.some(c => c.id === 'lesson:landfall')).toBe(true);
    // The tracker offers the waiting bundle first.
    expect(suggestLesson(store)?.id).toBe('landfall');
    expect(resolveTrack(store, 1)).toMatchObject({ suggested: true, claimable: true, title: 'Starter kit ready' });
    expect(act(gs, 'handbookClaim', { chapter: 'landfall' }).ok).toBe(true);
    res = ingestJourney(store, gs, tickNow()); store = res.store;
    expect(res.events.some(e => e.kind === 'reward' && e.title === 'Starter kit received')).toBe(true);
    expect(lessonClaimable(store, FIELDCRAFT_BY_ID.landfall)).toBe(false);
    expect(suggestLesson(store)?.id).toBe('shelter');

    // A second run on the same profile: progress is per run, shown without a parade, Marks are not paid twice.
    const second = start(8);
    commit(second.r, 'harvest', 'oak@1,1 -3'); commit(second.r, 'craft.hand', 'rope'); commit(second.r, 'consume', 'berries');
    res = ingestJourney(store, second.gs, tickNow()); store = res.store;
    expect(res.events.filter(e => e.kind === 'step' || e.kind === 'reward')).toEqual([]);
    expect(lessonClaimable(store, FIELDCRAFT_BY_ID.landfall)).toBe(true);
    expect(store.marks).toBe(TIER_MARKS[1]);
  });

  it('suggests by context but never forces: a nearby survivor or Ragnarok changes the offer, untrack silences it', () => {
    const { gs } = start();
    const store = ingestJourney(freshStore(), gs, tickNow()).store;
    expect(suggestLesson(store)?.id).toBe('landfall');
    expect(suggestLesson(store, { nearSurvivor: true })?.id).toBe('residents');
    expect(suggestLesson(store, { ragnarok: true, nearSurvivor: true })?.id).toBe('ragnarok');
    expect(resolveTrack({ ...store, trackQuiet: true }, 1)).toBeNull();
    const aside = { ...store, lessons: { ...store.lessons, landfall: { ...store.lessons.landfall, status: 'dismissed' as const } } };
    expect(suggestLesson(aside)?.id).toBe('shelter');
  });

  it('shows the tracker in Vietnamese when the language is switched, with item names left in English', () => {
    const { gs } = start();
    const store = ingestJourney(freshStore(), gs, tickNow()).store;
    setLang('vi');
    const v = resolveTrack(store, 1)!;
    expect(v.title).toBe('Thu hoạch bằng rìu');
    expect(v.group).toBe('Đặt chân');
    expect(v.reward).toContain('Gói khởi đầu');
    expect(v.reward).toContain('Wood Club');
    setLang('en');
    expect(resolveTrack(store, 1)!.title).toBe('Gather with your axe');
  });
});

describe('Survivor Handbook · real intents (no fixture receipts)', () => {
  it('a real 2x2 cabin built in the "wrong" order completes Hearth & Wall, and a real chest deposit counts for Beyond the Treeline', () => {
    const { gs, r } = start(11);
    r.creatures = [];
    const w = getWorld(), grid = blockGrid(r);
    let site: { x: number; y: number } | null = null;
    for (let yy = 20; yy < 180 && !site; yy++) for (let xx = 20; xx < 180 && !site; xx++) {
      let ok = true;
      for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 2 && ok; dx++) { const i = (yy + dy) * WW + xx + dx; ok = grid[i] === 0 && !w.sourceV3[i] && !!w.economyMap.buildable[i] && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; }
      if (ok) site = { x: xx, y: yy };
    }
    expect(site).toBeTruthy();
    const { x, y } = site!;
    const stand = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; };
    const build = (struct: string, tx: number, ty: number) => {
      const res = dispatchCarryingPack(gs, { id: `hb-b-${++n}`, type: 'build', struct, tx, ty } as any, tickNow());
      expect({ struct, tx, ty, why: res.ok ? '' : (res as any).reason }).toEqual({ struct, tx, ty, why: '' });
    };
    addItem(r, 'inv', 'wood', 300); addItem(r, 'inv', 'fiber', 120); addItem(r, 'inv', 'rope', 4);
    stand(x, y + 1);
    // Walls FIRST (the chapter lists them third), then the door, then the floor, then the cabinet.
    for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
      const ox = dx < 0 ? -1 : dx > 1 ? 1 : 0, oy = dy < 0 ? -1 : dy > 1 ? 1 : 0;
      stand(x + dx + ox, y + dy + oy);
      build(dx === 0 && dy === 2 ? 'door_wood' : 'wall_wood', x + dx, y + dy);
    }
    expect(done(r, 'shelter', 'walls')).toBe(true);
    expect(done(r, 'shelter', 'door')).toBe(true);
    expect(done(r, 'shelter', 'floor')).toBe(false);
    stand(x, y + 1);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('floor_wood', x + dx, y + dy);
    expect(done(r, 'shelter', 'floor')).toBe(true);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('roof_thatch', x + dx, y + dy);
    build('claim', x + 1, y);
    expect(done(r, 'shelter', 'claim')).toBe(true);
    expect(done(r, 'shelter', 'home')).toBe(false);
    build('bed_straw', x, y);
    expect(r.achievements).toContain('first_home');
    expect(done(r, 'shelter', 'home')).toBe(true);
    expect(chapterView(r, FIELDCRAFT_BY_ID.shelter).claimable).toBe(true);

    // The Hearth & Wall bundle contains a packed chest: claim it, place it, store something in it.
    expect(act(gs, 'handbookClaim', { chapter: 'shelter' }).ok).toBe(true);
    expect(countItem(r, 'inv', 'deploy_chest_small')).toBe(1);
    const placed = dispatch(gs, { id: `hb-b-${++n}`, type: 'build', struct: 'chest_small', tx: x + 1, ty: y + 1 } as any, tickNow());
    expect(placed.ok ? '' : (placed as any).reason).toBe('');
    expect(countItem(r, 'inv', 'deploy_chest_small')).toBe(0);
    const chest = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'chest_small')!;
    expect(done(r, 'expedition', 'carry')).toBe(false);
    const res = act(gs, 'move', { from: 'inv', fs: slotOf(r, 'fiber'), to: chest.c });
    expect(res.ok ? '' : (res as any).reason).toBe('');
    expect(done(r, 'expedition', 'carry')).toBe(true);
  });
});
