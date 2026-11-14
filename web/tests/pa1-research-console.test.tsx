// No-op canvas stub for static markup rendering in Node (matches gold-intake-integration.test.tsx).
const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), apply: () => noop, set: () => true });
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = { createElement: () => ({ getContext: () => noop, toDataURL: () => 'data:,', width: 0, height: 0 }) };
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { setActiveLayout } from '../src/game/world';
import { buildQaSandbox, resetQaSandboxFlags } from '../src/game/qa-sandbox';
import { ITEMS, STRUCTS, familyMembers } from '../src/game/catalog';
import { TILE } from '../src/game/core';
import { ContainerPanel } from '../src/ui/panels';
import type { Api } from '../src/ui/common';

// ============================================================================
// PA1 P1 — the family ledger must live in the panel the SHIPPED router opens.
//
// `ContainerPanel` returns `StationConsole` for any non-compact station, so a section rendered only in the
// older `ResearchBody` column is invisible in the game: a store-level test for the ledger stayed green
// while the browser gate found a console with no family list at all (Chromium pressed E 28 times, the
// prompt said "Use Research Table", and 'Technology families' never appeared). This file pins that route in
// Node so it cannot regress quietly, and it pins the fixture the Chromium gate drives: one table on free
// ground, close enough that the prompt cannot name anything else.
// ============================================================================

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

const stubApi = (gs: any, stationConsoleTab?: 'make' | 'study' | 'families'): Api => ({
  stationConsoleTab,
  gs,
  now: () => Date.now(),
  act: () => ({ ok: true }),
  toast: () => {},
  open: () => {},
  panel: null,
  sel: null,
  setSel: () => {},
  setBuild: () => {},
  buildType: null,
  reclaim: false,
  setReclaim: () => {},
  repairMode: false,
  setRepairMode: () => {},
  upgradeMode: false,
  setUpgradeMode: () => {},
  sfx: () => {},
  rerender: () => {},
} as unknown as Api);

/** Render the console the router chooses, optionally with the Technology tab already open. */
const renderStation = (gs: any, eid: string, tab?: 'make' | 'study' | 'families') =>
  renderToStaticMarkup(<ContainerPanel api={stubApi(gs, tab)} eid={eid} />);
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');

function fixture() {
  const built = buildQaSandbox('research_access', 'female', NOW);
  const r = built.gs.run!;
  const table = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'research' && !!e.station)!;
  return { gs: built.gs, r, table };
}

afterAll(() => {
  resetQaSandboxFlags();
  setActiveLayout('shipping');
});

describe('PA1 P1: the research_access fixture the Chromium gate drives', () => {
  it('builds without throwing, and grants a pack key that is a real item', () => {
    const { r, table } = fixture();
    expect(table).toBeTruthy();
    // `deploy_` + structure type is how catalog.ts synthesizes deployables; a plausible-sounding noun
    // phrase is not an item, and addItem would silently hand the whole quantity back.
    expect(ITEMS.deploy_research).toBeTruthy();
    const pack = r.custody.inv.slots.find(s => s?.key === 'deploy_research');
    expect(pack?.qty).toBe(1);
  });

  it('leaves the table the nearest interactable to the spawn, so the prompt cannot name a rival', () => {
    const { r, table } = fixture();
    const p = r.player;
    const d = (x: number, y: number) => Math.hypot(x - p.x, y - p.y);
    const toTable = d(table.x, table.y);
    // Within a tile of reach: the Chromium gate's orbit closes the last ~6 px by stepping once south.
    expect(toTable).toBeLessThanOrEqual(3 * TILE);
    // findInteract keeps the nearest interactable within 30 px of a point 6 px ahead of the aim, so a
    // rival station anywhere near the table is enough to make the panel unreachable by keyboard.
    // Only prompt-bearing structures can compete: findInteract gives a label to a station, a chest, a
    // door, a bed, a garden/barrel, a turret, a generator or the Cabinet — and `continue`s on geometry,
    // which is why a stone floor under the player is not a rival.
    const names = (t: string) => !!STRUCTS[t] && (STRUCTS[t].station || STRUCTS[t].slots || t.startsWith('door') || ['claim', 'bed_straw', 'garden', 'barrel', 'escrow'].includes(t));
    const rivals = Object.values(r.entities)
      .filter(e => e.kind === 'struct' && e.id !== table.id && (names(e.type!) || !!e.turret || !!e.basePower))
      .map(e => ({ type: e.type, d: d(e.x, e.y) }))
      .filter(o => o.d < toTable);
    expect(rivals, 'a structure nearer to the player than the Research Table would win the prompt: ' + JSON.stringify(rivals)).toEqual([]);
  });
});

describe('PA1 P1: the shipped router reaches the technology-family ledger', () => {
  it('the console opens on Blueprints and offers a named Technology control', () => {
    const { gs, table } = fixture();
    const html = renderStation(gs, table.id);
    // The console header proves this is StationConsole (the router's choice), not the retired column.
    expect(html).toContain('Research table');
    // Discoverability is the control itself: a player-readable tab label, present on the default surface.
    expect(html).toContain('data-testid="research-tab-families"');
    expect(plain(html)).toContain('Technology');
    // The recovered craft views are not displaced by it.
    expect(plain(html)).toContain('Blueprints');
    expect(plain(html)).toContain('Specimens');
    expect(plain(html)).toContain('Tinker');
    expect(plain(html)).toContain('Directed study');
    // And on that default surface the ledger is deliberately NOT stacked under the scroll area: it is the
    // Technology tab's content, which the Chromium gate proves is inside the viewport once selected.
    expect(html).not.toContain('Technology families');
  });

  it('the Technology tab renders the ledger in a pane of its own', () => {
    const { gs, table } = fixture();
    const html = renderStation(gs, table.id, 'families');
    expect(html).toContain('data-testid="research-family-pane"');
    expect(plain(html)).toContain('Technology families');
    expect(plain(html)).toContain('One paid study unlocks a family');
    // No source commentary may leak into shipped text (an earlier revision rendered raw `//` lines).
    const text = plain(html);
    expect(text).not.toMatch(/\/\//);
    for (const leaked of ['ContainerPanel', 'ResearchBody', 'browser gate', 'StationConsole for any']) {
      expect(text, `source commentary leaked into shipped UI text: ${leaked}`).not.toContain(leaked);
    }
  });

  it('no tab paints source commentary, and only the Technology tab carries the ledger', () => {
    // The leak this pins is specific and has bitten twice: a `//` line left in the JSX children list is not
    // a comment, it is text. Checking the rendered string of every tab — rather than trusting a source scan
    // — is what makes that impossible to ship again silently.
    const { gs, table } = fixture();
    const TABS = ['make', 'study', 'families'] as const;
    for (const tab of TABS) {
      const text = plain(renderStation(gs, table.id, tab));
      expect(text, `raw // commentary painted in the ${tab} view`).not.toMatch(/\/\//);
      for (const leaked of ['ContainerPanel', 'ResearchBody', 'StationConsole for any', 'initialTab', 'test/inspection seam', 'Chromium']) {
        expect(text, `${leaked} leaked into the ${tab} view`).not.toContain(leaked);
      }
      if (tab === 'families') {
        expect((text.match(/open design · no authorized cost/g) ?? []).length).toBeGreaterThanOrEqual(10);
      } else {
        expect(text, 'the ledger is stacked back into the craft column instead of its own tab').not.toContain('Technology families');
      }
    }
  });

  it('every recovered family is listed, priced where the paper priced it, and undecided where it is not', () => {
    const { gs, table } = fixture();
    const html = renderStation(gs, table.id, 'families');
    const text = plain(html);
    for (const fam of ['ENERGY', 'METALLURGY', 'MOBILITY', 'ELECTRICAL', 'AGRICULTURE', 'ARMORY', 'EXPLORATION', 'ARCANA', 'STEEL', 'DEFENSE', 'CORE_SPECIFIC']) {
      expect(text, `${fam} is missing from the console the player actually sees`).toContain(fam);
    }
    const energy = text.match(/ENERGY[\s\S]{0,220}?(?=METALLURGY|MOBILITY|ELECTRICAL|AGRICULTURE|ARMORY|EXPLORATION|ARCANA|STEEL|DEFENSE|CORE_SPECIFIC|$)/)?.[0] ?? '';
    expect(energy).toContain('cost recorded (5 Spares + 2 Iron Ingot)');
    expect(energy).toContain(`${familyMembers('ENERGY').length} formulas`);
    expect(energy).toContain('nothing withheld in this build');
    // An enforced/buyable row would be a gate the paper has not approved.
    expect(text).not.toContain('Commission study');
    expect((text.match(/open design · no authorized cost/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it('reads as studied once the family is owned, and still offers no unapproved purchase', () => {
    // Same rows, other side of the rule: ownership must change the wording, and nothing may invent a
    // buy button while enforcement is unapproved (ledger: no family is withheld in this build).
    const { gs, r, table } = fixture();
    r.tech = { ...(r.tech ?? { families: [] }), families: [...((r.tech?.families) ?? []), 'ENERGY'] };
    const html = renderStation(gs, table.id, 'families');
    const text = plain(html);
    expect(text).toContain('studied · 9 formulas');
    expect(text).not.toContain('Commission study');
    expect(text).not.toContain('pay 5 Spares');
    expect(r.entities[table.id]?.station?.queue.length).toBe(0);
  });
});
