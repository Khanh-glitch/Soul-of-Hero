// No-op canvas stub for static markup rendering in Node (matches b05-parcel-panel.test.tsx).
const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), apply: () => noop, set: () => true });
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = { createElement: () => ({ getContext: () => noop, toDataURL: () => 'data:,', width: 0, height: 0 }) };
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { BAL, type GameState } from '../src/game/core';
import { C, countItem, dispatch, markDirty, newGame } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { isVeyra05Layout } from '../src/veyra05/scenes';
import { CREATURE_ATLAS_SPECS, creatureHeadTopY, hasCreatureAtlas } from '../src/game/creature-sprites';
import { VFX_TEST_KIT } from '../src/game/vfx/testkit';
import * as vfxDirector from '../src/game/vfx/director';
import { buildQaSandbox, resetQaSandboxFlags } from '../src/game/qa-sandbox';
import { ingestJourney, isMilestoneRequisitioned, loadJourney } from '../src/game/journey';
import { deriveCues } from '../src/game/presentation-cues';
import { FIELD_REFERENCE_GROUPS } from '../src/game/field-notes';
import { JourneyLedger } from '../src/ui/Journey';
import { ExpeditionMap } from '../src/ui/ExpeditionMap';
import type { Api } from '../src/ui/common';

const NOW = Date.UTC(2026, 10, 9, 10, 0, 0);

afterAll(() => {
  resetQaSandboxFlags();
  setActiveLayout('shipping');
});

describe('Stage A: Native 1:1 creature sprite grounding & head clearance', () => {
  it('registers measured 1:1 atlases (drawW===cellW, drawH===cellH) and non-floating head clearance for all 18 creature atlases', () => {
    const keys = Object.keys(CREATURE_ATLAS_SPECS);
    expect(keys).toHaveLength(18);
    for (const type of keys) {
      const spec = CREATURE_ATLAS_SPECS[type];
      expect(spec.drawW).toBe(spec.cellW);
      expect(spec.drawH).toBe(spec.cellH);
      expect(hasCreatureAtlas(type)).toBe(true);
      const headY = creatureHeadTopY({ type } as any);
      expect(headY).toBe(spec.headOffsetY);
      expect(headY).toBeGreaterThanOrEqual(14);
      expect(headY).toBeLessThanOrEqual(48);
    }
    // Side bosses have taller silhouettes than small wildlife
    expect(creatureHeadTopY({ type: 'boss_ronin' } as any)).toBeGreaterThan(creatureHeadTopY({ type: 'hare' } as any));
    expect(creatureHeadTopY({ type: 'boss_custodian' } as any)).toBeGreaterThan(creatureHeadTopY({ type: 'fox' } as any));
  });
});

describe('Stage B: VFX engine & QA sandbox isolation (VFX_TEST_KIT)', () => {
  it('keeps VFX_TEST_KIT disabled in normal survival runs and enables it only in vfx_showcase', () => {
    resetQaSandboxFlags();
    expect(VFX_TEST_KIT).toBe(false);

    // Normal survival run must NOT receive free Creator Cores
    setActiveLayout('shipping_fresh');
    const prod = newGame();
    expect(dispatch(prod, { id: 'prod-start', type: 'startRun', character: 'female', seed: 42 }, NOW).ok).toBe(true);
    const prodCores = C(prod.run!, 'inv').slots.filter(s => s?.key.startsWith('core_'));
    expect(prodCores).toHaveLength(0);

    // QA Sandbox `vfx_showcase` enables VFX_TEST_KIT on Veyra and loads all 7 Creator Cores in slots 1..7
    const qa = buildQaSandbox('vfx_showcase', 'female', NOW);
    expect(VFX_TEST_KIT).toBe(true);
    expect(isVeyra05Layout(qa.gs.run!.layoutId || '')).toBe(true);
    const qaCores = C(qa.gs.run!, 'inv').slots.slice(1, 8).map(s => s?.key);
    expect(qaCores).toEqual([
      'core_blast', 'core_meteor', 'core_dragon', 'core_elsa',
      'core_earthmother', 'core_mjolnir', 'core_demon',
    ]);

    // Switching to another QA preset or resetting clears VFX_TEST_KIT immediately
    buildQaSandbox('fresh', 'female', NOW);
    expect(VFX_TEST_KIT).toBe(false);
    resetQaSandboxFlags();
    expect(VFX_TEST_KIT).toBe(false);

    // Director claims Core cast FX cleanly without throwing in headless Node
    vfxDirector.reset();
    const claimed = vfxDirector.onEvent({ type: 'coreCast', core: 'core_dragon', mode: 'basic', x: 100, y: 100, tx: 140, ty: 100 }, prod);
    expect(typeof claimed).toBe('boolean');
    vfxDirector.reset();
  });
});

describe('Stage C: Authoritative Journey Requisitions & Unified Veyra ExpeditionMap', () => {
  it('enforces threshold, credits securedCash + physical items, emits B06 cue, and blocks duplicate claims', () => {
    setActiveLayout('shipping_fresh');
    const gs: GameState = newGame();
    expect(dispatch(gs, { id: 'j-start', type: 'startRun', character: 'female', seed: 77 }, NOW).ok).toBe(true);
    const r = gs.run!;
    C(r, 'inv').slots = Array(24).fill(null);
    markDirty();

    const date = '2026-11-09';
    // Below threshold -> rejected
    const low = dispatch(gs, { id: 'req-low', type: 'journeyRequisition', date, milestone: 'ember', points: 20 }, NOW + 10);
    expect(low.ok).toBe(false);
    expect(gs.profile.securedCash).toBe(0);

    // Valid Ember (25 pts), Hearth (50 pts), and Beacon (75 pts) claims
    const seqBefore = r.receipts.at(-1)?.seq ?? 0;
    const c1 = dispatch(gs, { id: 'req-ember', type: 'journeyRequisition', date, milestone: 'ember', points: 30 }, NOW + 20);
    expect(c1.ok).toBe(true);
    expect(gs.profile.securedCash).toBe(BAL.journeyRequisitions.ember.securedCash);
    expect(countItem(r, 'inv', 'bandage')).toBe(3);
    expect(countItem(r, 'inv', 'cooked_meat')).toBe(3);
    expect(isMilestoneRequisitioned(gs, date, 'ember')).toBe(true);

    // Duplicate claim on the same day -> rejected
    const dup = dispatch(gs, { id: 'req-ember-dup', type: 'journeyRequisition', date, milestone: 'ember', points: 40 }, NOW + 30);
    expect(dup.ok).toBe(false);
    expect(gs.profile.securedCash).toBe(BAL.journeyRequisitions.ember.securedCash);

    // Hearth + Beacon claims
    expect(dispatch(gs, { id: 'req-hearth', type: 'journeyRequisition', date, milestone: 'hearth', points: 55 }, NOW + 40).ok).toBe(true);
    expect(dispatch(gs, { id: 'req-beacon', type: 'journeyRequisition', date, milestone: 'beacon', points: 80 }, NOW + 50).ok).toBe(true);
    expect(gs.profile.securedCash).toBe(
      BAL.journeyRequisitions.ember.securedCash + BAL.journeyRequisitions.hearth.securedCash + BAL.journeyRequisitions.beacon.securedCash,
    );
    expect(countItem(r, 'inv', 'crystal')).toBe(1);

    // B06 presentation cue traced from 'journey.requisition' receipt
    const cues = deriveCues(r.receipts, seqBefore);
    expect(cues.filter(c => c.cause === 'journey.requisition' && c.kind === 'cash_secured')).toHaveLength(3);
  });

  it('tracks creature.kill receipts in Journey and renders 4-ribbon JourneyLedger + unified Veyra ExpeditionMap', () => {
    const qa = buildQaSandbox('vfx_showcase', 'female', NOW);
    resetQaSandboxFlags();
    const gs = qa.gs;
    const r = gs.run!;

    // Emit a creature.kill receipt and ingest Journey
    r.receipts.push({ id: 'rk1', seq: (r.receipts.at(-1)?.seq ?? 0) + 1, at: NOW + 100, kind: 'creature.kill', detail: 'boar:m1' });
    const j0 = loadJourney(gs, true);
    const jRes = ingestJourney(j0, gs, NOW + 200);
    expect(jRes.changed).toBe(true);

    // Verify Husbandry & Waymark group exists in Field Reference
    expect(FIELD_REFERENCE_GROUPS.some(g => g.title === 'Husbandry & Waymark')).toBe(true);

    // Render JourneyLedger (all 4 ribbons)
    const ledgerHtml = renderToStaticMarkup(
      <JourneyLedger
        gs={gs}
        store={jRes.store}
        now={NOW + 200}
        onTrack={() => {}}
        onLesson={() => {}}
        onReroll={() => {}}
        onSeen={() => {}}
        onClose={() => {}}
        onOpenNotes={() => {}}
      />,
    );
    expect(ledgerHtml).toContain('Fieldcraft');
    expect(ledgerHtml).toContain('Waypoints');
    expect(ledgerHtml).toContain('Chronicle');
    expect(ledgerHtml).toContain('Field Reference');

    // Render Unified ExpeditionMap on Veyra (shows Continent button + Local 1x/2x/4x buttons + AU readout)
    const dummyApi: Api = {
      gs,
      now: () => NOW + 200,
      act: () => ({ ok: true } as any),
      toast: () => {},
      open: () => {},
      panel: { kind: 'map' },
      sel: null,
      setSel: () => {},
      setBuild: () => {},
      buildType: null,
      reclaim: false,
      setReclaim: () => {},
      repairMode: false,
      setRepairMode: () => {},
      setUpgradeMode: () => {},
      sfx: () => {},
      rerender: () => {},
    };
    const mapHtml = renderToStaticMarkup(<ExpeditionMap api={dummyApi} qaSession />);
    expect(mapHtml).toContain('data-testid="map-mode-continent"');
    expect(mapHtml).toContain('data-testid="map-mode-local"');
    expect(mapHtml).toContain('AU ');
  });
});
