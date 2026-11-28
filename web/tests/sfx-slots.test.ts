/**
 * SFX slots (2026-11-28): the catalogue of every sound the game asks for, and the wiring that asks for it.
 *
 * The game ships with no sound files. Each slot plays a delivered file when one exists and otherwise the synthesized
 * stand-in the game always had. These tests hold the promises the hand-over depends on:
 *   1. the catalogue is well formed (unique names, a folder per group, stand-ins that exist);
 *   2. every effect the simulation reports is either routed to a slot or silent ON PURPOSE;
 *   3. every slot has something that triggers it: no placeholder waits for a sound nothing would ever play;
 *   4. the footstep surfaces follow the real terrain ids.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SFX_SLOTS, SFX_SLOT, SFX_GROUPS, SFX_EXTENSIONS, CREATURE_FAMILIES, ELDER_KEYS, CORE_KINDS, sfxFileName, slotOfFile } from '../src/game/sfx/slots';
import { fxRoute, receiptRoute, intentRoute, refusalRoute, panelSound, stepSurface, creatureSlot, swingSlot, SILENT_FX, ROUTED_RECEIPT_KINDS, ROUTED_INTENTS, type RouteCtx } from '../src/game/sfx/route';
import { parseIndex, resolveFiles, slotStatus, synthOf, pickTake } from '../src/game/sfx/bank';
import { bedLevels, ambienceChoices, biomeOf, itemClass, consumeKind, structMaterial, WARN_KEYS, MACHINE_KINDS, type Biome } from '../src/game/sfx/director';
import { CREATURES, ELDERS, PRIMORDIAL_ELDERS, ITEMS, STRUCTS } from '../src/game/catalog';
import { T } from '../src/game/core';

const SRC = join(__dirname, '..', 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const sources = (dir: string): string[] => readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap(d => d.isDirectory() ? sources(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : []);

const ctx = (over: Partial<RouteCtx> = {}): RouteCtx => ({
  creatureNear: () => null, heldKey: () => null, floorAt: () => null, itemClass, consumeKind, structMaterial,
  entity: () => null, human: () => null, player: () => ({ x: 0, y: 0, character: 'male' }), ...over,
});

describe('SFX catalogue', () => {
  it('has unique, well-formed slot names, each in the folder of its group', () => {
    expect(new Set(SFX_SLOTS.map(s => s.id)).size).toBe(SFX_SLOTS.length);
    for (const s of SFX_SLOTS) {
      expect(s.id, s.id).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/);
      expect(SFX_GROUPS[s.group], s.id).toBeTruthy();
      expect(s.id.startsWith(s.group + '.'), s.id).toBe(true);
      expect(s.n, s.id).toBeGreaterThanOrEqual(1);
      expect(s.when.trim().length, s.id).toBeGreaterThan(5);
      expect(s.sound.trim().length, s.id).toBeGreaterThan(5);
      expect(s.kw.length, s.id).toBeGreaterThan(0);
    }
  });
  it('names files so that a file leads back to its slot', () => {
    for (const s of SFX_SLOTS) for (const ext of SFX_EXTENSIONS) {
      const f = sfxFileName(s.id, 3, ext);
      expect(f).toBe(`${s.group}/${s.id}__03.${ext}`);
      expect(slotOfFile(f)).toBe(s.id);
    }
    expect(slotOfFile('ui/click.ogg')).toBeNull();
  });
  it('borrows only from slots that exist, without loops, and of the same kind', () => {
    for (const s of SFX_SLOTS) {
      const seen = new Set([s.id]); let cur = s.borrow, hops = 0;
      while (cur) {
        expect(SFX_SLOT[cur], `${s.id} borrows ${cur}`).toBeTruthy();
        expect(seen.has(cur), `${s.id} borrow loop`).toBe(false);
        expect(SFX_SLOT[cur].mode === 'shot', `${s.id} borrows ${cur}`).toBe(s.mode === 'shot');
        seen.add(cur); cur = SFX_SLOT[cur].borrow; hops++;
      }
      expect(hops, s.id).toBeLessThanOrEqual(4);
    }
  });
  it('names only stand-ins the synthesizer really has', () => {
    const audio = read('game/audio.ts');
    const beds = ['rain', 'wind', 'surf', 'room', 'rag']; const machines = ['furnace', 'refinery', 'generator', 'pump'];
    for (const s of SFX_SLOTS) {
      if (!s.synth) continue;
      if (s.mode === 'bed') expect(beds, s.id).toContain(s.synth);
      else if (s.mode === 'loop') expect(machines, s.id).toContain(s.synth);
      else expect(audio.includes(`case '${s.synth}':`), `${s.id} -> ${s.synth}`).toBe(true);
    }
  });
  it('covers every creature, Elder and Core the game has', () => {
    const fam = (type: string) => type.replace(/_\d+$/, '').replace(/^boss_/, '');
    for (const type of Object.keys(CREATURES)) expect(CREATURE_FAMILIES[fam(type)], type).toBeTruthy();
    for (const key of [...Object.keys(ELDERS), ...Object.keys(PRIMORDIAL_ELDERS)]) expect(ELDER_KEYS[key], key).toBeTruthy();
    for (const d of Object.values(ITEMS)) { const ck = (d as any).creatorCore; if (typeof ck === 'string') expect(CORE_KINDS[ck], ck).toBeTruthy(); }
  });
});

describe('SFX file index', () => {
  it('reads a good index and ignores what it must not trust', () => {
    const idx = parseIndex({ version: 1, slots: { 'ui.click': ['ui/ui.click__01.ogg', { f: 'ui/ui.click__02.ogg', g: 0.8 }], 'no.such': ['x.ogg'], 'ui.back': ['../secret.ogg', 'https://elsewhere/x.ogg'] } });
    expect(idx.slots['ui.click']).toEqual([{ f: 'ui/ui.click__01.ogg' }, { f: 'ui/ui.click__02.ogg', g: 0.8 }]);
    expect(idx.slots['no.such']).toBeUndefined();
    expect(idx.slots['ui.back']).toBeUndefined();
    for (const bad of [null, 'x', {}, { version: 2, slots: {} }, { version: 1 }]) expect(parseIndex(bad).slots).toEqual({});
  });
  it('falls back in order: own file, borrowed file, synthesized stand-in, silence', () => {
    const empty = parseIndex({ version: 1, slots: {} });
    expect(slotStatus(empty, 'ui.click')).toBe('synth');
    expect(slotStatus(empty, 'ui.tab')).toBe('synth');                 // borrows ui.click, which has a stand-in
    expect(slotStatus(empty, 'player.grunt.m')).toBe('silent');
    const some = parseIndex({ version: 1, slots: { 'ui.click': ['ui/ui.click__01.ogg'] } });
    expect(slotStatus(some, 'ui.click')).toBe('file');
    expect(slotStatus(some, 'ui.tab')).toBe('borrowed');
    expect(resolveFiles(some, 'ui.tab')?.from).toBe('ui.click');
    expect(synthOf('ui.tab')).toBe('ui');
  });
  it('never repeats the take that just played when there is a choice', () => {
    for (let last = 0; last < 4; last++) for (let r = 0; r < 1; r += 0.05) { const i = pickTake(4, last, r); expect(i).not.toBe(last); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(4); }
    expect(pickTake(1, 0, 0.7)).toBe(0);
  });
  it('ships an index file, and it lists only files that are really there', () => {
    const pub = join(__dirname, '..', 'public', 'sfx');
    const idx = parseIndex(JSON.parse(readFileSync(join(pub, 'index.json'), 'utf8')));
    for (const [id, files] of Object.entries(idx.slots)) for (const file of files as { f: string }[]) {
      expect(slotOfFile(file.f), file.f).toBe(id);
      expect(() => readFileSync(join(pub, file.f)), file.f).not.toThrow();
    }
  });
});

describe('SFX routing', () => {
  const emitted = new Set<string>();
  for (const f of [...sources('game'), ...sources('veyra05')]) for (const m of read(f).matchAll(/\bfx\('([a-zA-Z]+)'/g)) emitted.add(m[1]);

  it('gives every effect the simulation reports a slot, or leaves it silent on purpose', () => {
    expect(emitted.size).toBeGreaterThan(40);
    for (const type of emitted) {
      if (SILENT_FX.includes(type)) continue;
      const sample = type === 'weather' ? { type, w: 'rain' } : type === 'toast' ? { type, key: 'sb_p2_x', text: '' } : { type, x: 0, y: 0, text: 'X', style: 'burn', key: 'frost', core: 'fire' };
      const plays = fxRoute(sample, ctx());
      expect(plays.length, `effect '${type}' has no slot`).toBeGreaterThan(0);
      for (const p of plays) expect(SFX_SLOT[p.slot], `${type} -> ${p.slot}`).toBeTruthy();
    }
  });
  it('walks on the real terrain: each tile id sounds like its surface', () => {
    const want: [number, string][] = [[T.DEEP, 'water'], [T.SHALLOW, 'water'], [T.RIVER, 'water'], [T.SAND, 'sand'], [T.GRASS, 'grass'], [T.MEADOW, 'grass'], [T.FOREST, 'forest'],
      [T.MARSH, 'mud'], [T.HILL, 'stone'], [T.CLIFF, 'stone'], [T.SNOW, 'snow'], [T.ICE, 'ice'], [T.ASH, 'ash'], [T.BURNT, 'ash'], [T.ROAD, 'road'], [T.BRIDGE, 'wood'], [T.FLOOR, 'stone']];
    for (const [tile, surf] of want) { expect(stepSurface(tile), `tile ${tile}`).toBe(surf); expect(SFX_SLOT[`step.${surf}`]).toBeTruthy(); }
    // a floor the player built wins over the ground under it
    expect(fxRoute({ type: 'step', x: 0, y: 0, t: T.GRASS }, ctx({ floorAt: () => 'wood' }))[0].slot).toBe('step.wood');
    expect(fxRoute({ type: 'step', x: 0, y: 0, t: T.SNOW }, ctx())[0].slot).toBe('step.snow');
  });
  it('gives each creature its own voice and each weapon its own swing', () => {
    expect(creatureSlot('wolf', 'hurt')).toBe('cr.wolf.hurt');
    expect(creatureSlot('orc_3', 'die')).toBe('cr.orc.die');
    expect(creatureSlot('boss_ronin', 'tell')).toBe('cr.ronin.tell');
    expect(creatureSlot('unknown_thing', 'die')).toBe('cr.die');
    expect(fxRoute({ type: 'mdeath', x: 0, y: 0, type2: 0 } as any, ctx())[0].slot).toBe('cr.die');
    expect(swingSlot(undefined)).toBe('swing.fist');
    expect(swingSlot('iron_sword')).toBe('swing.blade');
    expect(swingSlot('wood_spear')).toBe('swing.spear');
    expect(swingSlot('stone_axe')).toBe('swing.heavy');
    for (const [key, d] of Object.entries(ITEMS)) if ((d as any).swing) expect(SFX_SLOT[swingSlot(key)], key).toBeTruthy();
    expect(fxRoute({ type: 'whoosh', x: 0, y: 0 }, ctx({ heldKey: () => 'bow' }))[0].slot).toBe('swing.bow.draw');
  });
  it('keeps the extra layers silent until a file exists, so a game without files sounds as before', () => {
    const hit = fxRoute({ type: 'mhit', x: 0, y: 0 }, ctx());
    expect(hit[0].legacy).toBe(true); expect(hit[0].layer).toBeFalsy();
    for (const p of hit.slice(1)) expect(p.layer).toBe(true);
    for (const type of ['phit', 'mdeath', 'pickup']) for (const p of fxRoute({ type, x: 0, y: 0, key: 'wood' }, ctx()).slice(1)) expect(p.layer, type).toBe(true);
  });
  it('routes only receipt kinds the engine really writes, to slots that exist', () => {
    const engine = [...sources('game'), ...sources('veyra05')].map(read).join('\n');
    const e = { type: 'door_wood', kind: 'struct', x: 10, y: 10 };
    for (const kind of ROUTED_RECEIPT_KINDS) {
      expect(engine.includes(`'${kind}'`), `receipt kind '${kind}' is not written anywhere`).toBe(true);
      for (const detail of ['e1:closed', 'e1:true', 'e1:idle>running', 'e1:running>fuel_out', 'e1:running>output_full', 'floor_wood@3,4', 'woodx2 inv->c1', 'trail_canteen', 'h1 by wolf'])
        for (const p of receiptRoute(kind, detail, ctx({ entity: () => e, human: () => ({ x: 5, y: 5 }) }))) expect(SFX_SLOT[p.slot], `${kind} -> ${p.slot}`).toBeTruthy();
    }
    expect(receiptRoute('door', 'e1:closed', ctx({ entity: () => e }))[0].slot).toBe('door.wood.close');
    expect(receiptRoute('door', 'e1:open', ctx({ entity: () => ({ ...e, type: 'door_iron' }) }))[0].slot).toBe('door.iron.open');
    expect(receiptRoute('station.state', 'e1:running>fuel_out', ctx({ entity: () => e }))[0].slot).toBe('station.off');
    expect(receiptRoute('station.state', 'e1:running>idle', ctx({ entity: () => e }))).toEqual([]);
    expect(receiptRoute('consume', 'trail_canteen', ctx())[0].slot).toBe('player.drink');
    expect(receiptRoute('consume', 'salted_meat', ctx())[0].slot).toBe('player.eat');
    expect(receiptRoute('consume', 'syringe', ctx())[0].slot).toBe('player.heal');
    expect(receiptRoute('no.such.kind', '', ctx())).toEqual([]);
  });
  it('routes only requests the engine really takes', () => {
    const engine = read('game/engine.ts');
    for (const type of ROUTED_INTENTS) { expect(engine.includes(`'${type}'`), type).toBe(true); for (const p of intentRoute(type)) expect(SFX_SLOT[p.slot]).toBeTruthy(); }
    expect(refusalRoute('door', 'Locked from the other side.')[0].slot).toBe('door.locked');
    expect(refusalRoute('build', 'Not enough wood.')[0].slot).toBe('ui.deny');
  });
  it('sounds a panel once when it opens and once when it closes', () => {
    const none = { kind: null, build: false };
    expect(panelSound(none, { kind: 'inv', build: false }, null, null)[0].slot).toBe('ui.panel.open');
    expect(panelSound({ kind: 'inv', build: false }, none, null, null)[0].slot).toBe('ui.panel.close');
    expect(panelSound(none, { kind: 'map', build: false }, null, null)[0].slot).toBe('ui.map.open');
    expect(panelSound(none, { kind: 'journey', build: false }, null, null)[0].slot).toBe('ui.book.open');
    expect(panelSound(none, { kind: 'container', eid: 'a', build: false }, null, { kind: 'struct', station: false })[0].slot).toBe('box.chest.open');
    expect(panelSound(none, { kind: 'container', eid: 'a', build: false }, null, { kind: 'bag', station: false })[0].slot).toBe('box.bag.open');
    expect(panelSound({ kind: 'container', eid: 'a', build: false }, none, { kind: 'struct', station: false }, null)[0].slot).toBe('box.chest.close');
    expect(panelSound(none, { kind: null, build: true }, null, null)[0].slot).toBe('ui.build.enter');
    expect(panelSound({ kind: 'inv', build: false }, { kind: 'inv', build: false }, null, null)).toEqual([]);
  });
});

describe('SFX background and wildlife', () => {
  const base = { biome: 'meadow' as Biome, night: false, indoors: false, atSea: false, rain: 0, wind: 0.25, coast: 9, rag: false, danger: false };
  it('mixes the background from the place, the hour and the weather', () => {
    expect(bedLevels(base)['bed.meadow']).toBe(1);
    expect(bedLevels({ ...base, night: true })['bed.meadow']).toBe(0);
    expect(bedLevels({ ...base, night: true })['bed.night']).toBe(1);
    expect(bedLevels({ ...base, biome: 'snow' })['bed.snow']).toBe(1);
    const wet = bedLevels({ ...base, rain: 1 });
    expect(wet['bed.rain']).toBe(1); expect(wet['bed.rain.roof']).toBe(0); expect(wet['bed.meadow']).toBeLessThan(0.5);
    const home = bedLevels({ ...base, rain: 1, indoors: true });
    expect(home['bed.rain']).toBe(0); expect(home['bed.rain.roof']).toBe(1); expect(home['bed.room']).toBe(1); expect(home['bed.meadow']).toBeLessThan(0.2);
    expect(bedLevels({ ...base, coast: 0 })['bed.surf']).toBe(1);
    expect(bedLevels({ ...base, coast: 6 })['bed.surf']).toBe(0);
    const sea = bedLevels({ ...base, atSea: true });
    expect(sea['bed.sea']).toBe(1); expect(sea['bed.meadow']).toBe(0);
    for (const id of Object.keys(bedLevels(base))) { expect(SFX_SLOT[id]?.mode, id).toBe('bed'); }
  });
  it('reads the place from the zone and the tile underfoot', () => {
    expect(biomeOf(0, T.GRASS)).toBe('meadow'); expect(biomeOf(0, T.FOREST)).toBe('forest'); expect(biomeOf(5, T.GRASS)).toBe('snow');
    expect(biomeOf(0, T.SNOW)).toBe('snow'); expect(biomeOf(6, T.GRASS)).toBe('ash'); expect(biomeOf(7, T.FLOOR)).toBe('ruins'); expect(biomeOf(8, T.GRASS)).toBe('marsh');
  });
  it('lets birds sing by day, owls by night, and nothing sing indoors', () => {
    const s = { biome: 'forest' as Biome, night: false, indoors: false, rain: 0, storm: false, wind: 0.25, coast: 9, rag: false, nearWater: false };
    const names = (o: Partial<typeof s>) => ambienceChoices({ ...s, ...o }).map(c => c[0]);
    expect(names({})).toContain('amb.bird'); expect(names({})).not.toContain('amb.owl');
    expect(names({ night: true })).toContain('amb.owl'); expect(names({ night: true })).not.toContain('amb.bird');
    expect(names({ rain: 0.6 })).not.toContain('amb.bird');
    expect(names({ indoors: true })).toEqual(['amb.house']);
    expect(names({ storm: true })).toContain('amb.thunder');
    expect(names({ biome: 'marsh' })).toContain('amb.frog');
    expect(names({ coast: 2 })).toContain('amb.gull');
  });
});

describe('SFX coverage: nothing waits for a sound that nothing plays', () => {
  it('reaches every slot from some trigger', () => {
    const reached = new Set<string>();
    const add = (plays: { slot: string }[]) => { for (const p of plays) reached.add(p.slot); };
    // effects, across the payloads that change the slot
    const kinds = ['boar', ...Object.keys(CREATURE_FAMILIES)];
    const emitted = new Set<string>(); for (const f of [...sources('game'), ...sources('veyra05')]) for (const m of read(f).matchAll(/\bfx\('([a-zA-Z]+)'/g)) emitted.add(m[1]);
    const also = ['pin', 'tab', 'ui', 'uiBack', 'deny', 'coin', 'craft', 'build', 'eat', 'jtick', 'jstamp', 'jmilestone', 'jcapability', 'jrelic', 'jepic', 'rare', 'death'];
    for (const type of [...emitted, ...also]) {
      add(fxRoute({ type, x: 0, y: 0 }, ctx()));
      for (const big of [false, true]) for (const fem of [false, true]) add(fxRoute({ type, x: 0, y: 0, big, small: big, depleted: big, soft: big, sub: big ? 1 : 0 },
        ctx({ player: () => ({ x: 0, y: 0, character: fem ? 'female' : 'male' }), heldKey: () => (big ? 'bow' : null) })));
      for (const c of kinds) add(fxRoute({ type, x: 0, y: 0, type2: c }, ctx({ creatureNear: () => ({ type: c }) })));
    }
    for (const c of kinds) { add(fxRoute({ type: 'mdeath', x: 0, y: 0 } as any, ctx())); reached.add(creatureSlot(c, 'die')); reached.add(creatureSlot(c, 'idle')); reached.add(creatureSlot(c, 'tell')); reached.add(creatureSlot(c, 'hurt')); }
    for (const what of ['tell', 'hurt', 'die', 'idle'] as const) reached.add(creatureSlot(undefined, what));
    for (const key of [...Object.keys(ELDER_KEYS), 'x']) add(fxRoute({ type: 'etell', x: 0, y: 0, key }, ctx()));
    for (const style of ['burn', 'quake', 'frostnova', 'tide', 'root', 'beam', 'slash', 'zzz']) add(fxRoute({ type: 'hazfire', x: 0, y: 0, style }, ctx()));
    for (const core of ['fire', 'frost', 'storm', 'earth', 'spirit']) { add(fxRoute({ type: 'windup', x: 0, y: 0, core }, ctx())); add(fxRoute({ type: 'cast', x: 0, y: 0, core }, ctx())); }
    for (const ck of Object.keys(CORE_KINDS)) for (const mode of ['basic', 'refined', 'signature']) add(fxRoute({ type: 'cast', x: 0, y: 0, core: 'fire', ck, mode }, ctx()));
    for (const mat of ['wood', 'stone', 'ore', 'scrap', 'plant']) add(fxRoute({ type: 'chip', x: 0, y: 0, mat }, ctx()));
    for (const key of [undefined, 'iron_sword', 'wood_spear', 'torch', 'stone_axe']) add(fxRoute({ type: 'slash', x: 0, y: 0, key }, ctx()));
    for (const surf of ['wood', 'stone', 'metal']) add(fxRoute({ type: 'step', x: 0, y: 0, t: 3 }, ctx({ floorAt: () => surf })));
    for (let t = 0; t < 20; t++) add(fxRoute({ type: 'step', x: 0, y: 0, t }, ctx()));
    for (const w of ['rain', 'storm', 'clear']) add(fxRoute({ type: 'weather', w }, ctx()));
    for (const [text, sub] of [['X AWAKENS', ''], ['X', 'T — AWAKENED'], ['RAGNAROK', ''], ['DAY 14', ''], ['The run has ended', ''], ['other', '']]) add(fxRoute({ type: 'banner', text, sub }, ctx()));
    add(fxRoute({ type: 'toast', key: 'sb_p2_1' }, ctx()));
    for (const key of Object.keys(ITEMS)) add(fxRoute({ type: 'pickup', x: 0, y: 0, key }, ctx()));
    // receipts
    const ents = [{ type: 'door_wood', kind: 'struct' }, { type: 'door_iron', kind: 'struct' }, { type: 'furnace', kind: 'struct' }, { type: 'campfire', kind: 'struct' }, { type: 'workbench', kind: 'struct' },
      { type: 'refinery', kind: 'struct' }, { type: 'oil_pump', kind: 'struct' }, { type: 'research', kind: 'struct' }, { type: undefined, kind: 'recycler' }];
    const details = ['e1:closed', 'e1:open', 'e1:true', 'e1:false', 'e1:idle>running', 'e1:running>fuel_out', 'e1:running>output_full', 'h1 by wolf', 'h1:cold'];
    for (const kind of ROUTED_RECEIPT_KINDS) {
      for (const e of ents) for (const d of details) add(receiptRoute(kind, d, ctx({ entity: () => ({ ...e, x: 0, y: 0 }) as any, human: () => ({ x: 0, y: 0 }) })));
      for (const type of Object.keys(STRUCTS)) add(receiptRoute(kind, `${type}@1,1`, ctx()));
      for (const key of Object.keys(ITEMS)) add(receiptRoute(kind, `${key}x1 a->b`, ctx()));
    }
    for (const type of ROUTED_INTENTS) add(intentRoute(type));
    add(refusalRoute('door', 'Locked.')); add(refusalRoute('x', 'no'));
    // screens
    const views = ['inv', 'map', 'journey', 'container', null]; const seen = [null, { kind: 'struct', station: false }, { kind: 'struct', station: true }, { kind: 'bag', station: false }, { kind: 'recycler', station: true }, { kind: 'loot', station: false }];
    for (const a of views) for (const b of views) for (const ea of seen) for (const eb of seen) for (const build of [false, true])
      add(panelSound({ kind: a, eid: a ? 'a' : undefined, build: false }, { kind: b, eid: b ? 'b' : undefined, build }, ea, eb));
    add(panelSound({ kind: null, build: true }, { kind: null, build: false }, null, null));
    // the watch: background, wildlife, body, machines
    for (const id of Object.keys(bedLevels({ biome: 'meadow', night: false, indoors: false, atSea: false, rain: 0, wind: 0, coast: 9, rag: false, danger: false }))) reached.add(id);
    for (const biome of ['meadow', 'forest', 'marsh', 'snow', 'ash', 'ruins'] as Biome[]) for (const night of [false, true]) for (const indoors of [false, true]) for (const storm of [false, true]) for (const rag of [false, true])
      for (const [slot] of ambienceChoices({ biome, night, indoors, rain: storm ? 1 : 0, storm, wind: storm ? 0.85 : 0.25, coast: 2, rag, nearWater: true })) reached.add(slot);
    for (const k of WARN_KEYS) reached.add(`warn.${k}`);
    for (const k of MACHINE_KINDS) reached.add(`loop.${k}`);
    // named directly in the code that plays them
    const code = ['game/sfx/director.ts', 'ui/Game.tsx', 'ui/Title.tsx', 'ui/panels.tsx', 'ui/ExpeditionMap.tsx', 'ui/hud.tsx', 'ui/BuildBar.tsx', 'App.tsx'].map(read).join('\n');
    for (const s of SFX_SLOTS) if (code.includes(`'${s.id}'`)) reached.add(s.id);

    for (const id of reached) expect(SFX_SLOT[id], `trigger names a slot that does not exist: ${id}`).toBeTruthy();
    const orphans = SFX_SLOTS.filter(s => !reached.has(s.id)).map(s => s.id);
    expect(orphans).toEqual([]);
  });
});
