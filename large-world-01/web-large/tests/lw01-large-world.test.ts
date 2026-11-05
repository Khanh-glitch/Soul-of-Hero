/**
 * LW-01 regression suite: real re-architecture proofs, not constant edits.
 * Runs in the same Vitest project as the 34 verbatim Gameplay test files.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES, profileById, SCENES, SOURCE } from '../src/game/large/profile';
import { chunkKey, parseChunkKey, index, unindex, inFrame, toChunk, chunkOrigin, verifyNoAliasing, verifyAllChunkKeys, verifyRenderChunkKeys } from '../src/game/large/coords';
import { sampleAt, GOLD_GEOMETRY_STATS } from '../src/game/large/geometry';
import { ChunkStore } from '../src/game/large/chunk';
import { DurableStore, LW_SAVE_VERSION, validateLwSave } from '../src/game/large/state';
import { runNegativeFixtures, runDurableNegativeFixtures, validateChunkPackage, validateRuntimePackageProfile } from '../src/game/large/validate';
import { T } from '../src/game/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = path.resolve(ROOT, '..');
const src = (p: string) => path.join(ROOT, p);
const cap = profileById('capacity-2000x2000');
const u1 = profileById('veyra-u1');

describe('LW-G0 source custody & explicit profiles', () => {
  it('pins the active WMP-04R1 authority and live source heads', () => {
    expect(SOURCE.activeRevision).toBe('WMP-04R1');
    expect(SOURCE.mapHead).toBe('f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1');
    expect(SOURCE.gameplayHead).toBe('e11a9b4471a0832cd6d039b5510725b10ee0275c');
    expect(SOURCE.analysisGrid).toMatchObject({ w: 250, h: 175, cellAu: 8 });
    expect(SOURCE.goldFrameAu).toEqual([2000, 1400]);
    expect(Object.keys(SOURCE.rasterDigests).length).toBe(21);
  });
  it('keeps 10x LINEAR = 100x CELLS and does NOT pad Veyra to a square', () => {
    expect(200 * 200).toBe(40_000);
    expect(cap.w * cap.h).toBe(4_000_000);
    expect(cap.kind).toBe('CAPACITY_FIXTURE');
    expect(u1.w).toBe(2000); expect(u1.h).toBe(1400); expect(u1.w * u1.h).toBe(2_800_000);
    expect(u1.kind).toBe('AUTHORED_VEYRA');
    expect(PROFILES.find(p => p.id === 'veyra-u2')!.w * PROFILES.find(p => p.id === 'veyra-u2')!.h).toBe(700_000);
    expect(profileById('beacon-u05').boundedPilot).toContain('BEACON_ONLY');
    for (const p of PROFILES) expect(p.note.toLowerCase()).not.toContain('production');
  });
  it('samples authored GOLD geometry, not an 8-AU nearest-neighbour grid', () => {
    expect(GOLD_GEOMETRY_STATS.landRings).toBeGreaterThanOrEqual(8);
    expect(GOLD_GEOMETRY_STATS.poiFootprints).toBe(81);
    expect(GOLD_GEOMETRY_STATS.segments).toBeGreaterThan(92); // 92 GOLD road polylines + 17 river polylines, split into segments
    expect(fs.readFileSync(src('src/game/large/geometry.ts'), 'utf8')).toContain('distSeg');
    const coast = sampleAt(u1, 1367, 746);
    expect(coast.water).toBe(false);
    expect(coast.permissions.boat).toBe(false);
    expect(coast.permissions.swim).toBe(false);
    expect(coast.permissions.ferryFoot).toBe(false);
    expect(coast.permissions.build).toBe(false);
    expect(coast.permissions.gameplayAuthority).toBe('GAMEPLAY_ONLY__NOT_APPROVED');
  });
  it('has exactly five authored scene anchors in authoring units', () => {
    expect(SCENES.length).toBe(5);
    expect(SCENES.find(s => s.id === 'beacon')!.atAu).toEqual([272, 652]);
    expect(SCENES.find(s => s.id === 'beacon')!.helicopter).toBe(true);
  });
});

describe('LW-G1 generic 2,000 x 2,000 engine capacity', () => {
  it('enumerates every chunk with a unique profile-scoped key', () => {
    const all = verifyAllChunkKeys(cap);
    expect(all.totalChunks).toBe(63 * 63);
    expect(all.uniqueKeys).toBe(all.totalChunks);
    expect(all.collisions).toBe(0);
    // 32-tile streaming chunks stay under cx=100, so no in-frame collision there.
    expect(all.legacyKeyCollisions).toBe(0);
    // The ORIGINAL 16-tile renderer cache DOES alias inside a 2,000-wide frame.
    const rk = verifyRenderChunkKeys(cap);
    expect(rk.renderChunksX).toBe(125);
    expect(rk.legacyKeyCollisions).toBeGreaterThan(0);
    expect(rk.newKeyCollisions).toBe(0);
  });
  it('demonstrates the legacy cy*100+cx collision explicitly', () => {
    expect(0 * 100 + 100).toBe(1 * 100 + 0);
    expect(chunkKey(cap.id, 100, 0)).not.toBe(chunkKey(cap.id, 0, 1));
    expect(parseChunkKey(chunkKey(cap.id, -3, 62))).toEqual({ profileId: cap.id, cx: -3, cy: 62 });
  });
  it('never aliases linear indices across chunk/stride boundaries', () => {
    const a = verifyNoAliasing(cap);
    expect(a.collisions).toBe(0);
    expect(a.negativeSafe).toBe(true); expect(a.edgeSafe).toBe(true);
    expect(a.legacyKeyCollisions).toBeGreaterThan(0);
    for (const [x, y] of [[0, 0], [1999, 1999], [1, 1999], [1999, 1], [2000, 0]] as [number, number][]) {
      if (!inFrame(cap, x, y)) { expect(inFrame(cap, x, y)).toBe(false); continue; }
      expect(unindex(cap, index(cap, x, y))).toEqual({ x, y });
    }
    expect(() => index(cap, 2000, 0)).toThrow(/OUT_OF_FRAME/);
  });
  it('materializes only a bounded chunk window, not a 4M-cell copy', () => {
    const store = new ChunkStore(cap);
    const keys = store.updateWindow(1000, 1000);
    expect(keys.length).toBe(25);
    expect(store.chunks.size).toBe(25);
    expect(store.stats.loads).toBe(25);
    expect(store.stats.resident).toBe(25);
    expect(store.stats.residentBytes).toBeLessThan(200_000);
    expect(store.stats.peakResident).toBe(25);
    const c = store.get(31, 31)!;
    expect(c.tiles.length).toBe(32 * 32);
    expect(validateChunkPackage(cap, c)).toEqual([]);
    store.updateWindow(1400, 1000);
    expect(store.stats.unloads).toBeGreaterThan(0);
    expect(store.chunks.size).toBeLessThanOrEqual(cap.maxResidentChunks);
    expect(store.stats.residentBytes).toBeLessThan(250_000);
  });
  it('has NO hard-coded WW/WH=200 or cy*100+cx in the new large-world path', () => {
    const files = ['profile.ts', 'coords.ts', 'geometry.ts', 'chunk.ts', 'state.ts', 'sim.ts', 'compat.ts', 'runtime.ts', 'validate.ts']
      .map(f => fs.readFileSync(src('src/game/large/' + f), 'utf8')).join('\n');
    // Comments may quote the legacy form; only real declarations are forbidden.
    expect(files).not.toMatch(/\b(?:const|let|var)\s+WW\s*=\s*200|\b(?:const|let|var)\s+WH\s*=\s*200/);
    const render = fs.readFileSync(src('src/game/render.ts'), 'utf8');
    expect(render).not.toMatch(/\bWW\b|\bWH\b|cy\s*\*\s*100\s*\+\s*cx/);
    expect(render).toContain('chunkKey(');
    expect(render).toContain('LW.w'); expect(render).toContain('LW.h');
    // the legacy app remains verbatim 200x200
    const legacyRender = fs.readFileSync(path.join(PILOT, 'web-legacy/src/game/render.ts'), 'utf8');
    expect(legacyRender).toContain('cy * 100 + cx');
  });
  it('keeps the exact package validator profile-aware without weakening legacy', () => {
    const errs = validateRuntimePackageProfile(u1, { id: 'x', w: 2000, h: 1400, layers: [
      { name: 'tiles', bytes: 2_800_000, stride: 2000 }, { name: 'fresh', bytes: 2_800_000, stride: 2000 }] });
    expect(errs).toEqual([]);
    expect(validateRuntimePackageProfile(u1, { id: 'x', w: 200, h: 200, layers: [
      { name: 'tiles', bytes: 40_000, stride: 200 }] })).toContain('package 200x200 != profile 2000x1400');
    expect(validateRuntimePackageProfile(u1, { id: 'x', w: 2000, h: 1400, layers: [
      { name: 'tiles', bytes: 40_000, stride: 200 }] })).toContain('tiles length 40000 != 2800000');
  });
});

describe('LW-G2 geographic continuity & typed permission boundary', () => {
  it('passes all deterministic negative fixtures on U=1 Veyra', () => {
    const neg = runNegativeFixtures(u1);
    for (const n of neg) expect(n.pass, `${n.id}: ${JSON.stringify(n.detail)}`).toBe(true);
    expect(neg.length).toBeGreaterThanOrEqual(10);
  });
  it('never grants foot on sea, ferry, cliffs or unapproved build/cart permission', () => {
    const probes: [number, number][] = [];
    for (let x = 1200; x < 1500; x += 7) for (let y = 700; y < 820; y += 7) probes.push([x, y]);
    for (const [x, y] of probes) {
      const s = sampleAt(u1, x, y);
      if (s.water) expect(s.permissions.foot).toBe(false);
      expect(s.permissions.boat).toBe(false);
      expect(s.permissions.swim).toBe(false);
      expect(s.permissions.ferryFoot).toBe(false);
      expect(s.permissions.build).toBe(false);
    }
  });
  it('does not duplicate beach/land: inland water is RIVER, ocean is SHALLOW/DEEP', () => {
    for (let x = 900; x < 1100; x += 3) for (let y = 700; y < 780; y += 3) {
      const s = sampleAt(u1, x, y);
      if (!s.authoredLand) expect([T.SHALLOW, T.DEEP]).toContain(s.tile);
      if (s.lake || s.river) expect(s.tile).toBe(T.RIVER);
    }
  });
});

describe('LW-G3 world-global durable identities & versioned save', () => {
  it('is idempotent for source, loot, transaction and placement grants', () => {
    const neg = runDurableNegativeFixtures(new DurableStore(u1, 12345));
    for (const n of neg) expect(n.pass, `${n.id}: ${JSON.stringify(n.detail)}`).toBe(true);
  });
  it('round-trips global coords, records, receipts, inventory, delayed events and monsters', () => {
    const d = new DurableStore(u1, 42);
    d.harvest('wood:rs_4#586,257', { x: 586, y: 257 });
    d.place('claim:587,257', 'claim', { x: 587, y: 257 });
    d.setMonster('distant-boar', { x: 1500, y: 900 }, { hp: 30, state: 'idle' });
    d.setOwnership('home:587,257', { x: 587, y: 257 }, { owner: 'player' });
    d.addTrace('trace:586,257', { x: 586, y: 257 }, {});
    d.transact('txn:1', { x: 586, y: 257 }, {});
    d.schedule('tick:1', 60_000, 'tick', {});
    d.simMs = 12_345;
    const save = d.serialize({ x: 586 * 16 + 8, y: 257 * 16 + 8, hp: 100, stamina: 100, hunger: 100, thirst: 100, warmth: 100, active: 0, dir: 0 });
    expect(save.version).toBe(LW_SAVE_VERSION);
    expect(save.profileW).toBe(2000); expect(save.profileH).toBe(1400);
    expect(validateLwSave(save, u1)).toEqual([]);
    const restored = DurableStore.deserialize(JSON.parse(JSON.stringify(save)), u1)!;
    expect(restored).not.toBeNull();
    expect(restored.records.size).toBe(d.records.size);
    expect(restored.receipts.size).toBe(d.receipts.size);
    expect([...restored.records.keys()].sort()).toEqual([...d.records.keys()].sort());
    expect(restored.inv()).toEqual(d.inv());
    expect(restored.simMs).toBe(12_345);
    expect(restored.delayedEvents.length).toBe(1);
    const capResult = restored.offlineCatchUp(120_000, 5000);
    expect(capResult.processed).toBe(1);
    expect(restored.delayedEvents.length).toBe(0);
    // re-harvest after restore must be rejected, never duplicated
    expect(restored.harvest('wood:rs_4#586,257', { x: 586, y: 257 }).duplicate).toBe(true);
    // a different profile must NOT silently migrate the save
    expect(DurableStore.deserialize(save, cap)).toBeNull();
  });
  it('keeps legacy 200x200 save keys separate and read-only', () => {
    expect(fs.readFileSync(src('src/game/large/state.ts'), 'utf8')).toContain('soh.state.v3');
    expect(fs.readFileSync(src('src/game/large/state.ts'), 'utf8')).not.toContain("localStorage.setItem('soh.state.v3'");
  });
});

describe('LW-G4 scale evidence honesty', () => {
  it('explicitly refuses to declare an approved final U or production merge', () => {
    const profileText = fs.readFileSync(src('src/game/large/profile.ts'), 'utf8');
    expect(profileText).toContain('NOT an approved final scale');
    expect(profileText).toContain('Bounded scale triage only');
    expect(profileText).toContain('Full 4,000×2,800 traversal / streaming is NOT claimed');
    expect(profileText).toContain('no padded rows');
  });
});
