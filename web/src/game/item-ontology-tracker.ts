/**
 * Item Ontology V2 — acceptance tracker (Control Tower ruling on PR #61 at 7b78a554, 2026-11-14).
 *
 * One row per DEFECT or DELIVERABLE, not per proposal. Three acceptance states and nothing else:
 *   IMPLEMENTED_AND_VERIFIED  working code in the named PR at the named SHA, and the named gate passed there.
 *   HANDOFF_ACKNOWLEDGED      the responsible owner has RECEIVED the work order on their own PR (`receipt`) and Control Tower
 *                             confirmed it. NOT a fix. No SHA exists yet. A notice nobody accepted does not qualify.
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
  /** URL of the notice on the owner's own PR. Required for HANDOFF_ACKNOWLEDGED. */
  receipt?: string;
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
    receipt: 'https://github.com/Khanh-glitch/Soul-of-Hero/pull/56#issuecomment-6877505704',
    gate: 'Optional upgrades Wood→Reinforced Wood, Wood→Stone, Reinforced Wood→Stone, Stone→Brick work through real build intents; resources debited; save/restart; browser; formula graph. Saved Plank stacks, placed Plank Walls, queued jobs and reclaim refunds conserved (an old Plank Wall must not refund from the live cost table).',
    note: 'Work order: docs/design/PA1_BUILDING_ONTOLOGY_WALL_TIER_HANDOFF_2026-11-14.md. No building code in PR #61.' },
  { id: 'T-P8-MATERIALS', proposal: 'P8', defect: 'Ash Chitin and Crawler Optic have no source on Veyra',
    owner: 'UNASSIGNED — Veyra World / Ecology has no confirmed owner or PR', pr: null, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Creature placed in a fitting Veyra habitat, actually spawns, is fought, drops loot that is physically picked up, survives restart. Before any renewable Scrap Crawler population: measured Parts per hour, research pace and farming exploit check. No invented drops, no changed probabilities without design authority.',
    note: 'Work order: docs/design/VEYRA_WORLD_SOURCE_REPAIR_ORDER_2026-11-14.md. No Keycard work: Veyra has 0 keycard doors. The order exists only as a document in PR #61; nobody responsible has received or accepted it.' },
  { id: 'T-P8-RESEARCH', proposal: 'P8', defect: 'Wolf Fang and Beetle Horn (research routes) have no source on Veyra',
    owner: 'UNASSIGNED — Veyra World / Ecology has no confirmed owner or PR', pr: null, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Owner evaluates the research routes and either places a source under the gate above or rules the routes Shipping-only.' },
  { id: 'T-P9-PUMP', proposal: 'P9', defect: 'Oil Pump is not runnable in natural play; Crude Petroleum is fixture-only',
    owner: 'Oil / World Production', pr: 59, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Map-owned oil site, normal placement, finite stock debit, production output, separate-process restart. Salvaged Oil (real) kept distinct from pumped Crude Petroleum.',
    note: 'Notice posted on PR #59 (issuecomment-6878207281); no reply, so not acknowledged. Whether the pump lands in PR #59 is the owner\'s call.' },
  { id: 'T-LI-137', defect: 'Last Island crosswalk covered the 86-id atlas, not the 137-id historical set',
    owner: 'Item V2', pr: 61, sha: '56f32e0c4d051a89357730058d1c6782ee1768cc', acceptance: 'IMPLEMENTED_AND_VERIFIED',
    gate: 'The 137-id CSV and the 137-vs-86 diff (53 missing historical ids, 2 crosswalk-only ids) are in the repository as reference-only inputs; crosswalk graded by evidence, version, alias and gameplay role; no production item added to match a count.',
    note: 'Inputs delivered and verified 2026-11-14 (Drive access granted; both files match the published size and SHA-256 byte for byte) and stored reference-only under web/ref/item-ontology-v2/li-historical/. Crosswalk: 139 rows = 137 historical ids (84 shared with the atlas, 53 historical-only) + 2 atlas-only ids, one explicit decision each, in LI_HISTORICAL_CROSSWALK.md and li-historical-crosswalk.csv. Two design candidates recorded (not approved), none added. Source attribution is tracked separately in T-LI-SOURCES. Gate run: tests/item-ontology-v2-li-historical.test.ts. Local run only; GitHub Actions do not run on this branch.' },
  { id: 'T-LI-SOURCES', defect: 'The supplied Last Island historical CSV carries citations that do not bear out the row: 26 rows cite ATLAS_v2.json for ids that are not atlas ids (22 do not occur in the file at all)',
    owner: 'Control Tower (research source)', pr: null, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Every historical row is DIRECT or INDIRECT against a source that was opened, or is explicitly retired; today 15 rows are UNSUPPORTED_CITATION and 23 are LEGACY_CLAIM (cited page not re-read).',
    note: 'Annotated, not repaired. The raw CSV is kept byte for byte; the derived columns source_support_status / citation_check / verified_source_url / evidence_date sit next to it in li-historical-crosswalk.csv. Only the official notice of 2022-11-09 was opened beyond the repository, and its date is applied to the 14 ids it documents and to nothing else. Closing this needs sources from the research owner, not Item V2 code.' },
  { id: 'T-E2E', defect: 'Browser drivers whose strings were edited in round 2 but which cannot be run to completion',
    owner: 'Item V2', pr: 61, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Each driver either passes on this head or is listed in web/e2e/QUARANTINE.json with the step it stops at on base and on head.',
    note: 'Quarantined, not fixed: see web/e2e/QUARANTINE.json.' },
  { id: 'T-INTEGRATION-59', defect: 'PR #61 + PR #59 merge without text conflicts, but tests/wp3-veyra-recycler-integration.test.ts (PR #59 version) crafts the Utility Frame without the Metal Pipe that recipe revision 3 requires',
    owner: 'PR #59 owner (their test file); fix prepared by Item V2', pr: 59, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'The patch (or an equivalent) is on PR #59 or on the integration branch, and wp3 passes on the merged tree with tsc clean.',
    note: 'Fix written and measured, NOT landed: docs/integration/PR59_x_PR61_wp3_metal_pipe_route.patch adds a zero-injection route (Tall Grass→Fiber→Rope, Boulder→Stone, hand-crafted Stone Pickaxe, real Coal Seam, Furnace-refined iron, Workbench L2 pipe). The recipe is unchanged. Evidence: web/evidence/item-ontology-v2/integration-pr59.md. PR #59 was not modified.' },
  { id: 'T-BASELINE', defect: '179 Vitest failures inherited from the PR #56 head (devices built from raw materials, which PA1 forbids)',
    owner: 'PA1 Building', pr: 56, sha: null, acceptance: 'BLOCKED_OR_UNRESOLVED',
    gate: 'Failures fixed or retired on PR #56. Until then the Web suite is NOT green; PR #61 only shows it adds none.',
    note: 'Breakdown: web/evidence/item-ontology-v2/round3-test-baseline.md.' },
];

export function trackerMd(): string {
  const o: string[] = ['| Id | Defect / deliverable | Owner | PR | SHA | Acceptance | Gate |', '|---|---|---|---|---|---|---|'];
  for (const r of ACCEPTANCE_TRACKER) {
    o.push(`| ${r.id} | ${r.defect}${r.note ? ` — ${r.note}` : ''} | ${r.owner} | ${r.pr ? '#' + r.pr : 'not named'} | ${r.sha ? '`' + r.sha + '`' : 'none'} | **${r.acceptance}** | ${r.gate} |`);
  }
  return o.join('\n');
}
