/**
 * Item Ontology V2 — acceptance tracker (Control Tower ruling on PR #61 at 7b78a554, 2026-11-14).
 *
 * One row per DEFECT or DELIVERABLE, not per proposal. Three acceptance states and nothing else:
 *   IMPLEMENTED_AND_VERIFIED  working code in the named PR at the named SHA, and the named gate passed there.
 *   HANDOFF_ACKNOWLEDGED      Control Tower dispatched it to the named owner. NOT a fix. No SHA exists yet.
 *   BLOCKED_OR_UNRESOLVED     nobody can close it as things stand; `gate` says what is missing.
 * A document never moves a row to IMPLEMENTED_AND_VERIFIED. `tests/item-ontology-v2.test.ts` enforces that a row without
 * a fix SHA cannot be verified and that every HANDED_OFF proposal stays out of the verified state.
 */
export type Acceptance = 'IMPLEMENTED_AND_VERIFIED' | 'HANDOFF_ACKNOWLEDGED' | 'BLOCKED_OR_UNRESOLVED';

export interface TrackerRow {
  id: string;
  /** Proposal this row belongs to, if any. */
  proposal?: string;
  defect: string;
  owner: string;
  /** PR that carries (or must carry) the fix. null = Control Tower has not named one in the repository. */
  pr: number | null;
  /** SHA at which the gate passed. null until the owner posts one. */
  sha: string | null;
  /** The acceptance gate, stated so that it can be checked. */
  gate: string;
  acceptance: Acceptance;
  note?: string;
}

/** SHA of PR #61 that Control Tower accepted as the round-3 increment. */
export const ROUND3_ACCEPTED_SHA = '7b78a55444ee489b7870ea46c7ac095b5f70e4c0';
const V = (id: string, proposal: string, defect: string, gate: string): TrackerRow =>
  ({ id, proposal, defect, owner: 'Item V2', pr: 61, sha: ROUND3_ACCEPTED_SHA, gate, acceptance: 'IMPLEMENTED_AND_VERIFIED' });

export const ACCEPTANCE_TRACKER: readonly TrackerRow[] = [
  V('T-P1', 'P1', 'Two items competed for the word "Parts"', 'item-ontology-v2 suite; pa1-research-visible browser driver reads "5 Parts + 2 Iron Ingot"'),
  V('T-P2', 'P2', 'Fasteners vs Machine Parts merge question', 'Closed as KEEP; item-ontology-v2-round3 pins both items and all Fasteners consumers unchanged'),
  V('T-P3', 'P3', 'Utility Frame ignored Metal Pipe (frame only)', 'round2 + round3 suites: rev-3 BOM live, rev-1/rev-2 queued jobs finish and refund under their own BOM across two restarts'),
  V('T-P4', 'P4', 'Salvager Axe had no blade', 'round2 + round3 suites: rev-3 BOM, frozen rev-2 entry, Recycler return not larger than the embedded materials'),
  V('T-P5', 'P5', 'Iron Plate had no Recycler rule', 'round2 suite: X:plate-v1 pays once, survives restart, loop is lossy'),
  V('T-P7', 'P7', 'Mixed-language display names', 'item-ontology-v2 suite; item box screenshots'),
  V('T-P10', 'P10', 'Four legacy cores indistinguishable from the seven Creator Cores', 'round3 suite (classes, three Creator Core crates, save); 147-item browser layout sweep at 640x360'),
  V('T-P9-TEXT', 'P9', 'Oil text claimed an "authorized oil site" that no world contains', 'round3 suite source scan + four oil states; b05 oil suites; pa1-deploy-custody browser driver'),
  { id: 'T-P6', proposal: 'P6', defect: 'Plank Wall (240 HP) and Brick Wall (600 HP) cannot be obtained; Plank has no reachable consumer',
    owner: 'PA1 Building', pr: 56, sha: null, acceptance: 'HANDOFF_ACKNOWLEDGED',
    gate: 'Optional upgrades Wood→Reinforced Wood, Wood→Stone, Reinforced Wood→Stone, Stone→Brick work through real build intents; resources debited; save/restart; browser; formula graph. Saved Plank stacks, placed Plank Walls, queued jobs and reclaim refunds conserved (an old Plank Wall must not refund from the live cost table).',
    note: 'Work order: docs/design/PA1_BUILDING_ONTOLOGY_WALL_TIER_HANDOFF_2026-11-14.md. No building code in PR #61.' },
  { id: 'T-P8-MATERIALS', proposal: 'P8', defect: 'Ash Chitin and Crawler Optic have no source on Veyra',
    owner: 'Veyra World / Ecology', pr: null, sha: null, acceptance: 'HANDOFF_ACKNOWLEDGED',
    gate: 'Creature placed in a fitting Veyra habitat, actually spawns, is fought, drops loot that is physically picked up, survives restart. Before any renewable Scrap Crawler population: measured Parts per hour, research pace and farming exploit check. No invented drops, no changed probabilities without design authority.',
    note: 'Work order: docs/design/VEYRA_WORLD_SOURCE_REPAIR_ORDER_2026-11-14.md. No Keycard work: Veyra has 0 keycard doors.' },
  { id: 'T-P8-RESEARCH', proposal: 'P8', defect: 'Wolf Fang and Beetle Horn (research routes) have no source on Veyra',
    owner: 'Veyra World / Ecology', pr: null, sha: null, acceptance: 'HANDOFF_ACKNOWLEDGED',
    gate: 'Owner evaluates the research routes and either places a source under the gate above or rules the routes Shipping-only.' },
  { id: 'T-P9-PUMP', proposal: 'P9', defect: 'Oil Pump is not runnable in natural play; Crude Petroleum is fixture-only',
    owner: 'Oil / World Production', pr: 59, sha: null, acceptance: 'HANDOFF_ACKNOWLEDGED',
    gate: 'Map-owned oil site, normal placement, finite stock debit, production output, separate-process restart. Salvaged Oil (real) kept distinct from pumped Crude Petroleum.',
    note: 'PR #59 is the current oil/mobility work; whether the pump lands there is the owner\'s call.' },
  { id: 'T-LI-137', defect: 'Last Island crosswalk covers the 86-id atlas, not the 137-id research set',
    owner: 'Item V2', pr: 61, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'The 137-id CSV and the 137-vs-86 diff (53 missing historical ids, 2 crosswalk-only ids) are in the repository as reference-only inputs; crosswalk graded by evidence, version, alias and gameplay role; no production item added to match a count.',
    note: 'Inputs not delivered: absent from the session, every branch and PR head, and the connected Drive (checked again 2026-11-14 after the ruling).' },
  { id: 'T-E2E', defect: 'Browser drivers whose strings were edited in round 2 but which cannot be run to completion',
    owner: 'Item V2', pr: 61, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Each driver either passes on this head or is listed in web/e2e/QUARANTINE.json with the step it stops at on base and on head.',
    note: 'Quarantined, not fixed: see web/e2e/QUARANTINE.json.' },
  { id: 'T-INTEGRATION-59', defect: 'PR #61 and PR #59 merge without text conflicts, but the merged tree fails tests/wp3-veyra-recycler-integration.test.ts (passes on PR #59 alone): its natural-harvest route crafts the Utility Frame with the rev-2 bill and never makes the Metal Pipe that rev 3 requires',
    owner: 'Whichever of PR #59 / PR #61 merges second', pr: null, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'On the merged tree the wp3 route obtains 1 Metal Pipe by natural play (no injection) and the test passes; tsc clean.',
    note: 'Measured 2026-11-14 on a probe merge of 7b78a554 + b3a2c64e: tsc clean; round-3, oil and recipe-migration suites 83/83; wp3 1 failed at the vehicle_frame craft.' },
  { id: 'T-BASELINE', defect: '179 Vitest failures inherited from the PR #56 head (devices built from raw materials, which PA1 forbids)',
    owner: 'PA1 Building', pr: 56, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Failures fixed or retired on PR #56. Until then the Web suite is NOT green; PR #61 only shows it adds none.',
    note: 'Breakdown: web/evidence/item-ontology-v2/round3-test-baseline.md.' },
];

export function trackerMd(): string {
  const o: string[] = ['| Id | Defect / deliverable | Owner | PR | SHA | Acceptance | Gate |', '|---|---|---|---|---|---|---|'];
  for (const r of ACCEPTANCE_TRACKER) {
    o.push(`| ${r.id} | ${r.defect}${r.note ? ` — ${r.note}` : ''} | ${r.owner} | ${r.pr ? '#' + r.pr : 'not named'} | ${r.sha ? '`' + r.sha.slice(0, 8) + '`' : 'none'} | **${r.acceptance}** | ${r.gate} |`);
  }
  return o.join('\n');
}
