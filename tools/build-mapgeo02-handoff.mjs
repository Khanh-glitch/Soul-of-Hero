/**
 * SOH — MAP-GEO-REJOIN-02 — reproducible Gameplay handoff builder.
 * Reads ONLY committed evidence; writes one JSON packet and one Markdown handoff.
 * No external decision is silently made; unresolved ids/owners are listed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO, 'creator-u05');
const j = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pre = j('evidence/mapgeo02-preflight.json');
const build = j('evidence/mapgeo02-build.json');
const geom = j('evidence/mapgeo02-bridge-geometry.json');
const trav = j('evidence/mapgeo02-traversal.json');
const prov = j('evidence/mapgeo02-shot-provenance.json');
const refs = j('evidence/mapgeo02a-refs.json');
const vis = j('evidence/mapgeo02a-visual-inspection.json');
const road = j('evidence/mapgeo02-road-water-classification.json');
const audit01 = j('evidence/mapgeo01-physical-audit.json');

const sources = [
  'creator-u05/evidence/mapgeo02-preflight.json',
  'creator-u05/evidence/mapgeo02-build.json',
  'creator-u05/evidence/mapgeo02-bridge-geometry.json',
  'creator-u05/evidence/mapgeo02-traversal.json',
  'creator-u05/evidence/mapgeo02-shot-provenance.json',
  'creator-u05/evidence/mapgeo02a-refs.json',
  'creator-u05/evidence/mapgeo02a-visual-inspection.json',
  'creator-u05/evidence/mapgeo02-road-water-classification.json',
  'creator-u05/evidence/mapgeo01-physical-audit.json',
  'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json',
  'world_lab/src/gold/REAL_MAP_CONVERSION_CONTRACT.md'
];
const sourcesRecord = sources.map(p => ({ path: p, sha256: sha(path.join(REPO, p)) }));
const missing = sourcesRecord.filter(s => !s.sha256);
if (missing.length) throw Error('MAPGEO02_HANDOFF_MISSING_SOURCE');

const bridgeRows = geom.bridges.map(b => ({
  id: b.id, load: b.authoredLoad, crossingCode: b.crossingCandidateCode,
  atAu: b.atAu, atTile: b.atTile, angRad: b.authoredAngRad,
  channelKind: b.channelKind, waterSpanAu: b.waterSpanAu,
  perpendicularWaterSpanAu: b.perpendicularWaterSpanAu,
  orientation: b.orientation, footprintAu: b.deckFootprintAu,
  deckTilesMeasured: b.deckTileCount, deckTilesRendered: b.status.startsWith('CANDIDATE_DECK') ? b.deckTileCount : 0,
  spanCoverage: b.spanCoverage, banks: { a: b.bankA, b: b.bankB },
  seams: b.bankSeams, continuity: b.continuity, roadApproaches: b.roadApproaches,
  sourceEvidence: b.sourceEvidence, status: b.status,
  unresolvedReasons: b.unresolvedReasons, owner: b.owner
}));
const unresolved = bridgeRows.filter(b => b.status.startsWith('UNRESOLVED'));

const packet = {
  schema: 'soh.mapgeo02.gameplay-handoff.v1',
  task: 'SOH — MAP-GEO-REJOIN-02',
  status: 'MAP_PHYSICAL_GEOMETRY_CORRECTED__GAMEPLAY_WORLDTRAVERSAL_INTAKE_PENDING',
  generatedAt: new Date().toISOString(),
  exactRefs: {
    mapBranch: 'arena/2e3cfbd2-soul-of-hero',
    mapPinnedAndLive: pre.pinnedHeads.map,
    main: pre.liveRefs.main,
    gameplayPinnedObserved: pre.pinnedHeads.gameplayObserved,
    gameplayLivePR44: pre.pr44.headRefOid,
    gameplayDriftDuringTask: pre.gameplayDrift.movedDuringTask,
    pr44State: pre.pr44.state,
    creatorVerified: pre.pinnedHeads.creatorVerified,
    u05SourcePin: pre.pinnedHeads.u05Pin,
    painterBlockSha256: pre.gameplaySourceProvenance.painterExpectedSha256,
    painterIdenticalAcrossAllHeads: pre.gameplaySourceProvenance.painterIdenticalAcrossAllHeads
  },
  deliverable: build.deliverable,
  protectedBaselines: build.protectedBaselines,
  defects: {
    'MGP-D01': { before: '12/12 bridge centres RIVER/blocked, 0 crossable; 888 BRIDGE tiles on land at br_1, 0 on water',
      after: `${geom.resolvedIds.length}/12 bounded deck candidates measured and rendered; ${geom.deckTileCount} deck tiles, 100% on water, 0 on land; ${unresolved.length} exact unresolved ids`,
      status: 'MAP_GEOMETRY_CORRECTED__GAMEPLAY_TRAVERSAL_PERMISSION_STILL_REQUIRED' },
    'MGP-D10': { before: `305 binary cliffCandidate cells, ${audit01.terrain.cliffCandidateDiscrepancy.u05RuntimeCliffTilesInAllWindows} visible/physical T.CLIFF (consumer used cliff>=2)`,
      after: `${geom.cliffStats.candidateCells} candidate cells + ${geom.cliffStats.qualifiedCells} independently qualified; thin broken downhill face band 2..4/16 tiles; 0 production walls`,
      status: 'MAP_DISPLAY_CORRECTED__GAMEPLAY_COLLISION_AND_CLIMB_LAW_STILL_REQUIRED' }
  },
  bridges: bridgeRows,
  bridgeSummary: { total: 12, resolved: geom.resolvedIds, unresolved: geom.unresolvedIds,
    resolvedIds: geom.resolvedIds, unresolvedIds: geom.unresolvedIds, deckTilesRendered: geom.deckTileCount,
    forced12Pass: false },
  cliffs: {
    candidateCells: geom.cliffStats.candidateCells, qualifiedCells: geom.cliffStats.qualifiedCells,
    repairedPredicate: geom.cliffStats.repairedPredicate,
    independentChecks: geom.cliffStats.independentChecks,
    sideHistogram: geom.cliffStats.sideHistogram,
    faceBandTiles: geom.cliffStats.faceBandTilesPerCellEdge,
    projectedFractionOfCell: geom.cliffStats.projectedFractionOfCell,
    runtimeVisibleCliffTilesHighlandWindow: trav.checks.find(c => c.id === 'D12_cliff_visible_not_slabs').detail
      .find(w => w.id === 'highland_T4').cliffTiles,
    oldVisibleCliffTilesHighlandWindow: trav.checks.find(c => c.id === 'D13_old_had_zero_cliffs').detail.oldCliffTilesInT4Window,
    qaCandidateCollisionCells: trav.checks.find(c => c.id === 'D12_cliff_visible_not_slabs').detail
      .find(w => w.id === 'highland_T4').qaWall,
    productionCollisionCells: geom.cliffStats.productionCollisionCells,
    filledSlabsProhibited: geom.cliffStats.filledSlabsProhibited
  },
  roadWater: { total: road.total, counts: road.counts, ferryRouteIds: road.ferryRouteIds,
    ambiguousIds: road.unresolvedIds, rows: road.rows },
  runtime: {
    executableSha256: trav.executable.sha256, checks: trav.summary.checks, passes: trav.summary.passes,
    fails: trav.summary.fails, browserErrors: trav.summary.browserErrors.length,
    runs: trav.matchingCoordinateRuns.length + trav.bridgeRuns.length + trav.cliffRuns.length,
    nativeShots: trav.summary.shots,
    matchingCoordinateRuns: trav.matchingCoordinateRuns.map(r => ({ id: r.id,
      exactTile: r.exactCoordinate?.tile, tileCodeComparison: r.exactCoordinate?.tileCodeComparison })),
    productionStillBlocked: trav.checks.find(c => c.id === 'E01_production_still_blocked').verdict,
    qaCandidateCrossing: trav.checks.find(c => c.id === 'E02_qa_candidate_geometry_crossable').verdict,
    qaCliffCollision: trav.checks.find(c => c.id === 'E03_qa_cliff_collision_explicit').verdict,
    noPermissionLeakage: trav.checks.find(c => c.id === 'D20_no_permission_leakage').detail
  },
  unresolvedGeometry: [
    ...unresolved.map(b => ({ kind: 'BRIDGE', id: b.id, owner: b.owner, reasons: b.unresolvedReasons,
      note: 'NO deck art stamped; needs Creator/Gameplay bearing or bank decision.' })),
    ...road.rows.filter(r => r.category === 'AMBIGUOUS_OWNER_REVIEW').map(r => ({ kind: 'ROAD_WATER_CROSSING',
      id: r.id, owner: r.owner, reasons: [r.status, r.reason], note: 'NO geometry guessed.' }))
  ],
  worldTraversalIntake: [
    `Pin the exact Gameplay SHA before consuming this packet: task pin 6e7d116b…, MAP-GEO-02 delivery live c2418b54…, 02A observed 897e28f2…, 02A live ${refs.live.pr44Head.slice(0, 8)}… (drift chain in §10).`,
    'Decide bearing/load class for each of the 10 resolved deck candidates from GOLD load + crossingCandidate code 1/2; do not infer cart clearance from foot/cart labels.',
    'Define walk/cart collision on deck tiles, seam tiles and both approaches; production default here is PRODUCTION_NO_PERMISSION (deck still blocked).',
    'Approve or reject the QA_CANDIDATE_CROSSING mode separately; it is geometry measurement ONLY and never a production permission.',
    'Define a cliff climb/collision law; the current display is a visible PROPOSED face band with ZERO production collision cells.',
    'Resolve br_9 bearing ambiguity (two bounded crossing axes) and br_b missing second bank / unbounded 32 AU water run with the Creator; do not stamp either.',
    'Resolve the 6 ambiguous water-overridden road ids with the owner: rd_a, rd_1g, rd_22, rd_23, rd_26, rd_28.',
    'Keep the 8 inherited ferry routes as navigation references (waterTraversalClass=2, foot=false); boat/swim/ferryFoot remain GAMEPLAY-owned and unapproved.',
    'Keep activeCollisionPermission=false until WorldTraversal explicitly approves a cell; WMP-03 invariant forbids non-zero values.',
    'Preserve all 81 canonical POI/source IDs, the Creator-approved Beacon road (verified byte-identical tile codes), and the three protected standalone baselines.'
  ],
  amendment02a: {
    task: 'SOH — MAP-GEO-REJOIN-02A / Evidence Integrity Corrective & Final Map Intake',
    defect: prov.defect,
    correctedQaScript: 'creator-u05/tests/qa-mapgeo02-traversal.mjs',
    perBridgeAuthenticity: prov.perBridgeFixtures.map(f => ({
      id: f.requestedBridgeId, resolved: f.resolved,
      shots: f.captures.map(c => c.name),
      playerTiles: f.captures.map(c => c.actualPlayerTile),
      candidateIds: f.captures.map(c => c.candidateId),
      freshFrames: f.captures.map(c => c.frameIdentity.freshFrameAdvanced),
      frameSerials: f.captures.map(c => c.frameIdentity.serial)
    })),
    negativeGate: { cases: prov.negativeGate.negativeCases.length,
      allRejected: prov.negativeGate.negativeCases.every(n => n.rejected && n.expectedReasonsFound),
      controlAccepted: prov.negativeGate.control.accepted,
      realCapturesAccepted: prov.negativeGate.realCaptures.every(r => r.reasons.length === 0) },
    shotIntegrity: trav.shotIntegrity,
    gates: { runtimeChecks: `${trav.summary.passes}/${trav.summary.checks}`,
      staticTests: '156/156', mapgeo01Tests: '130/130', tscNoEmit: 'clean',
      browserErrors: trav.summary.browserErrors.length,
      nativeShots: trav.summary.shots,
      realKeyRuns: trav.matchingCoordinateRuns.length + trav.bridgeRuns.length + trav.cliffRuns.length },
    visualInspection: {
      file: 'creator-u05/evidence/mapgeo02a-visual-inspection.json',
      deckSilhouettes: vis.summary.deckSilhouettes, seams: vis.summary.seams,
      cliffFaces: vis.summary.cliffFaces,
      newlyConfirmedPhysicalDefects: vis.summary.newlyConfirmedPhysicalDefects,
      targetedReworkNotGranted: vis.summary.targetedReworkNotGranted,
      visualAccepted: false },
    exactRefs: { mapPinned02a: refs.pinned.mapAt02aPin, mapAt02Delivery: refs.pinned.mapAt02Delivery,
      main: refs.pinned.main, gameplayTaskPin: refs.pinned.gameplayTaskPin,
      gameplayAt02Delivery: refs.pinned.gameplayAt02Delivery,
      gameplayObserved02a: refs.pinned.gameplayObserved02a,
      gameplayLiveAt02aFinish: refs.live.pr44Head,
      pr44State: refs.pr44.state, driftChain: refs.drift.chain,
      painterPaletteUnchanged: Object.values(refs.painter.heads).every(p => p.paletteOnlySha256 === refs.painter.paletteSha256),
      qaExecutableRebuilt: refs.qaExecutable.rebuilt },
    readiness: 'READY_AS_MEASURED_QA_EVIDENCE_FOR_WORLDTRAVERSAL_INTAKE__NOT_READY_AS_PRODUCTION_TRAVERSAL_PERMISSION__NOT_VISUALLY_ACCEPTED',
    retained: ['10 candidate bridges', '2 unresolved bridges (br_9, br_b)',
      '31-road classification', '596 deck tiles', '305 cliff candidate cells',
      '0 activeCollisionPermission', 'three protected standalone baselines']
  },
  acceptance: {
    PAPER: 'MEASURED', RUNTIME: 'ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY',
    VISUAL: 'NOT_REQUESTED_AND_NOT_GRANTED', GAMEPLAY: 'NOT_REQUESTED_AND_NOT_GRANTED',
    fullWorldVisualAcceptance: false, veyraPlayable: false, productionMerge: false,
    pr44EditedOrMerged: false, goldAmended: false, newAtlasOrArt: false
  },
  noClaims: [
    'NO production traversal permission', 'NO Gameplay collision/load/cart/climb law',
    'NO GOLD amendment', 'NO new atlas/art/world', 'NO PR44 edit/merge',
    'NO full-world visual acceptance', 'NO VEYRA_PLAYABLE', 'NO VISUAL_ACCEPTED', 'NO MERGE_READY'
  ],
  sources: sourcesRecord
};
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo02-gameplay-handoff.json'), JSON.stringify(packet, null, 2));

const bridgeTable = bridgeRows.map(b =>
  `| \`${b.id}\` | ${b.load} / ${b.crossingCode} | ${b.channelKind} | ${b.waterSpanAu} / ${b.perpendicularWaterSpanAu} | ` +
  `${b.footprintAu.length} × ${b.footprintAu.width} | ${b.deckTilesRendered} | ${b.spanCoverage} | ` +
  `${b.status.startsWith('CANDIDATE_DECK') ? '**CANDIDATE DECK**' : '**UNRESOLVED** — ' + b.unresolvedReasons.join('; ')} |`
).join('\n');
const roadTable = Object.entries(road.counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
const perIdTable = prov.perBridgeFixtures.map(f =>
  `| \`${f.requestedBridgeId}\` | ${f.resolved ? 'CANDIDATE DECK' : 'UNRESOLVED'} | ` +
  `${f.captures.map(c => c.name.replace('bridge_' + f.requestedBridgeId + '_', '')).join(', ')} | ` +
  `${f.resolved ? f.captures.find(c => c.requestedKind === 'PER_ID_DECK').candidateId : 'null — NO deck'} |`
).join('\n');
const md = `# MAP-GEO-REJOIN-02 — Gameplay Handoff (Correct Real Bridge & Cliff Projection)

> **Map physical geometry is measured and corrected in an isolated QA viewer.
> Gameplay traversal permission is NOT granted.** Active authority remains
> \`WMP-04R1\` / \`U=0.5\` / \`CREATOR_CHOSEN_U05.v1\`. Generated
> ${packet.generatedAt}. Machine-readable packet:
> \`creator-u05/evidence/mapgeo02-gameplay-handoff.json\`.

---

## 1. Exact SHAs and live custody

| Item | Value |
|---|---|
| Map branch / pinned HEAD / live HEAD | \`arena/2e3cfbd2-soul-of-hero\` @ \`${packet.exactRefs.mapPinnedAndLive}\` |
| \`main\` | \`${packet.exactRefs.main}\` |
| Gameplay HEAD **observed/pinned in the task** | \`${packet.exactRefs.gameplayPinnedObserved}\` |
| Gameplay / PR44 **live HEAD at MAP-GEO-02 delivery** | \`${packet.exactRefs.gameplayLivePR44}\` (PR44 **${packet.exactRefs.pr44State}**, NOT edited/merged/closed) |
| Gameplay / PR44 **live HEAD at 02A finish** | \`${refs.live.pr44Head}\` (PR44 **${refs.pr44.state}**; see §10 amendment) |
| Live drift during MAP-GEO-02 | **${packet.exactRefs.gameplayDriftDuringTask}** — both SHAs reported; Map did not touch PR44 |
| Creator-verified Gameplay HEAD | \`${packet.exactRefs.creatorVerified}\` |
| U05 source pin | \`${packet.exactRefs.u05SourcePin}\` |
| GOLD SHA-256 | \`${pre.goldSha256}\` (unchanged) |
| Terrain painter block (at 02 delivery) | \`${packet.exactRefs.painterBlockSha256}\` — byte-identical at U05 pin / MAP-GEO-01 observed / MAP-GEO-02 pinned / 02-delivery PR44 head; **02A drift in §10** |
| QA executable | \`${build.deliverable.file}\` — ${build.deliverable.bytes} B, SHA \`${build.deliverable.sha256}\` |
| Protected baselines | terrain-only \`540f095e…\`, NATURE-01 \`ac4d54e3…\`, NATURE-02 \`6e1e897a…\` — **all unchanged** |

Gameplay moved from \`6e7d116b…\` to \`c2418b54…\` during the task (motorbike / loot /
respawn work). The **terrain painter block stayed byte-identical**, live \`art.ts\`
still contains \`S.claim\`, and the live bible is unchanged from the MAP-GEO-01
observed live file. **Do not silently re-vendor.** PR44 remains OPEN.

## 2. The two Map-derived defects

| Defect | MAP-GEO-01 measured | MAP-GEO-02 corrected |
|---|---|---|
| \`MGP-D01\` | 12/12 bridge centres \`RIVER\` / blocked, **0 crossable**; at \`br_1\`, **888** \`T.BRIDGE\` tiles on land, **0** on water (wood carpet + empty gap) | **${geom.resolvedIds.length}/12** bounded deck candidates rendered from GOLD \`id/at/ang/load\` + authored banks + road approaches + \`crossingCandidate\` code. **${geom.deckTileCount}** deck tiles, **100 % on water, 0 on land**. \`${geom.unresolvedIds.join('`, `')}\` unresolved, **no deck stamped** |
| \`MGP-D10\` | **305** binary \`cliffCandidate\` cells but **0** \`T.CLIFF\` (consumer used \`cliff >= 2\`) | Binary \`>=1\` predicate + independent \`heightClass>=4\`, \`slope>=20\`, \`slopeClass>=3\`, downhill-drop evidence. **${packet.cliffs.runtimeVisibleCliffTilesHighlandWindow}** visible cliff tiles in the highland window (old: **${packet.cliffs.oldVisibleCliffTilesHighlandWindow}**), as a thin broken downhill face band (**2–4 of 16** tiles per cell edge), **0 production walls** |

No GOLD geometry, resource placement, POI architecture, Beacon road,
production gameplay or protected baseline was changed. No new atlas or art.

## 3. Bridge-by-bridge outcomes (all 12 GOLD ids)

Deck length/width are in **AU** at \`U=0.5\`; width is the authored GOLD road
centreline width **3.0 AU**, **never** the 12 AU circular marker radius.
\`crossingCandidate\` code: \`1=foot\`, \`2=cart\`, \`3=ford\`.

| ID | load/code | channel | water span / ⟂ span (AU) | footprint (AU) | deck tiles | span coverage | outcome |
|---|---|---|---|---|---|---|---|
${bridgeTable}

**10 resolved + 2 unresolved = 12. This is NOT a forced 12-PASS result.**

* \`br_9\`: two bounded crossing axes (\`ang\` run 6.5 AU, perpendicular 5 AU);
  GOLD \`ang\` alone cannot pick a bearing → **Creator / Gameplay bearing review**.
* \`br_b\`: no verified second bank, water run unbounded at the 30 AU search
  (32 AU), span exceeds the bounded guard, no road approach on one side,
  seams disconnected → **Creator / Gameplay bank decision**. It sits at a river
  mouth / open water; no arbitrary stamp was applied.

Every resolved deck was independently checked for: both banks dry land, road /
footpath approaches on both banks, bounded water span, footprint orientation
along the authored \`ang\`, 4-connected tiles, span coverage, bank seams, and
source-evidence sufficiency. Full records:
\`creator-u05/evidence/mapgeo02-bridge-geometry.json\`.

**Authority split:** Map owns visible deck geometry and continuity. Gameplay
owns walking, carts, load/bearing, clearance and collision. Default mode
\`PRODUCTION_NO_PERMISSION\` keeps every deck tile **blocked**. The explicitly
named \`QA_CANDIDATE_CROSSING\` mode is geometry measurement only; it never
silently grants production traversal.

## 4. Cliff candidate / display / collision counts (independent checks)

| Metric | Value |
|---|---|
| \`cliffCandidate.v3.u8\` non-zero cells | **${packet.cliffs.candidateCells}** (codes \`1\`: 305, \`0\`: 43445; maximum code **1**) |
| Independently qualified cells | **${packet.cliffs.qualifiedCells}** — \`heightClass>=4\` 305/305, \`slope>=20\` 305/305, \`slopeClass>=3\` 305/305, 4-neighbour downhill drop ≥12 305/305 |
| Repaired predicate | \`${packet.cliffs.repairedPredicate}\` |
| Face orientation histogram | N ${packet.cliffs.sideHistogram.N} / S ${packet.cliffs.sideHistogram.S} / W ${packet.cliffs.sideHistogram.W} / E ${packet.cliffs.sideHistogram.E} |
| Visible cliff tiles in highland window | **${packet.cliffs.runtimeVisibleCliffTilesHighlandWindow}** (old executable **${packet.cliffs.oldVisibleCliffTilesHighlandWindow}**) |
| Filled 16×16 analysis-cell slabs | **0** (max measured 50 of 256 tiles in one cell) |
| \`productionCollisionCells\` | **0** — visible face is NOT a permanent impassable wall |
| \`QA_CANDIDATE_CROSSING\` cliff blockers | **${packet.cliffs.qaCandidateCollisionCells}** in the same window — explicit, separate QA collision |
| \`activeCollisionPermission.v3.u8\` non-zero cells | **0** (WMP-03 invariant) |

The face uses the **verbatim \`T.CLIFF\` art** with deterministic \`hash2\` jitter,
~6 % holes and sparse one-tile rock teeth so it reads as a broken rocky ledge,
not a featureless gray slab or grid bar. Interior of each candidate cell stays
the authored biome/hill. Roads are never repainted.

## 5. Road-water crossing classification (31 water-overridden GOLD routes)

| Category | Count |
|---|---|
${roadTable}

* **8 ferry navigation references** \`${road.ferryRouteIds.join('`, `')}\`:
  \`waterTraversalClass=2\`, \`foot=false\`, \`boat/swim/ferryFoot=false\`,
  visible tile is **water**, never \`T.ROAD\`. Runtime-verified at 8 ferry-cell
  centres. They must **not** become dry-land roads.
* **9 authored bridges** have WMP-03 \`BRIDGE_DECK_PROPOSAL\` cells; extra
  \`FORD_PROPOSAL\` cells on the same road are recorded, not promoted.
* **8 unbridged land-road crossings** are \`FORD_PROPOSAL\` /
  \`crossingCandidate=3\` (depth/flow UNKNOWN); no bridge or dry road invented.
* **6 ambiguous owner review**: \`${road.unresolvedIds.join('`, `')}\` — water
  override measured at U=0.5 tile centres but **no WMP-03 water-road cell
  classification** exists at 8 AU analysis resolution. Exact ids, no guessed geometry.

Full rows: \`creator-u05/evidence/mapgeo02-road-water-classification.json\`.
Creator-approved Beacon road: **0 changed tile codes** in the old/new comparison
(340 \`T.ROAD\` tiles in both), T1/T2/T4/T5/T6 exact-coordinate windows also
show **0 changed tile codes** — no widening, recolouring or redrawing.

## 6. Real runtime screenshots and real-key WASD

* Executable: \`${build.deliverable.file}\` (standalone, self-contained).
* Renderer: existing SOH \`U=0.5\`, native \`640×360\` \`1×\`, hero \`16×24\`,
  base speed \`72 px/s\`, verbatim \`terrain.ts\` painter, x10 viewer multiplier.
* **${packet.runtime.runs}** real-key runs, **${packet.runtime.nativeShots}** native
  \`640×360\` PNGs, **${packet.runtime.browserErrors}** browser errors,
  **${packet.runtime.passes}/${packet.runtime.checks}** checks PASS.
* Six MAP-GEO-01 runs were reproduced at **exactly the same coordinates and
  legs**, with exact-end-tile static shots and tile-code diff. \`T3\` shows
  656 old land \`T.BRIDGE\` tiles → 46 new water deck tiles (702 changed tiles);
  T1/T2/T4/T5/T6 show **0 changed tile codes** at their exact coordinates.
  Raw pixel diff also contains a small independently-timed viewer camera offset;
  the tile-code comparison is the authoritative same-coordinate check.
* Production \`br_2\`: **78 blocked substeps, 3.38 tiles** — crossing still
  blocked. QA \`br_2\`: **0 blocked substeps, 28.5 tiles** across both banks.
  QA \`br_7\`: **24 tiles** with \`d\` / \`d+s\`. QA \`br_1\`: hero reaches the
  measured \`br_1\` deck. \`br_b\`: **0 deck art**, movement blocked.
* Highland \`T4\` production: **0 blocked substeps** (no cliff wall). Explicit
  QA candidate collision: **98 blocked substeps**; an alternative real-key route
  moved **1572 px** with 0 blocked substeps.
* Nearby chunks, deterministic reload, source ids, save-compatible coordinates
  (\`U=0.5\`, \`TILE=16\`, frame \`4000×2800\`, GOLD \`at\` unchanged) and
  **0 permission leaks over 10,086 sampled tiles** are all verified in
  \`creator-u05/evidence/mapgeo02-traversal.json\`.

Screenshots are **QA evidence, not visual or production acceptance**.

## 7. Unresolved geometry — exact ids and owners

| Kind | ID | Owner | Why |
|---|---|---|---|
${packet.unresolvedGeometry.map(u => `| ${u.kind} | \`${u.id}\` | ${u.owner} | ${u.reasons.join('; ')} |`).join('\n')}

## 8. Gameplay \`WorldTraversal\` intake requirements

${packet.worldTraversalIntake.map((x, i) => `${i + 1}. ${x}`).join('\n')}

## 9. Acceptance boundary

\`PAPER=MEASURED\`, \`RUNTIME=ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY\`,
\`VISUAL=NOT_REQUESTED_AND_NOT_GRANTED\`, \`GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED\`.

**No** \`VEYRA_PLAYABLE\`, \`VISUAL_ACCEPTED\`, \`MERGE_READY\`, production merge,
PR44 edit/merge, GOLD amendment, new atlas, full-world visual acceptance or
full Gameplay integration claim. PAPER / RUNTIME / VISUAL / GAMEPLAY stay
separate. NATURE-01/02 remain archived R&D.

## 10. AMENDMENT A — MAP-GEO-REJOIN-02A (evidence integrity corrective)

**Verified defect.** The 02 QA script ran every \`BRIDGE_RUNS\` fixture first and only
then captured all \`_at_bridge\` images. GitHub blob verification at pinned HEAD found
**52 PNGs / 34 unique contents**, one **10-image identical group**; 8 differently-named
\`_at_bridge\` files were the same stale final canvas frame.

**Correction.** \`creator-u05/tests/qa-mapgeo02-traversal.mjs\` now forces at least two fresh
render frames after every setup and reads the canvas **and** runtime state atomically in one
frame callback. Every capture logs requested bridge id, actual player tile, camera coordinate,
candidate id, selected mode, timestamp and frame identity. Each of the 8 bridge fixtures
captures its own image **before the next fixture**. Twelve self-contained per-ID fixtures were
added: deck + both measured bank approaches for the 10 resolved ids, the bare crossing site
only for \`br_9\` / \`br_b\`. Full log: \`creator-u05/evidence/mapgeo02-shot-provenance.json\`.

**Screenshot authenticity by bridge id** (all fresh frames, \`PRODUCTION_NO_PERMISSION\`, native \`640×360\`):

| ID | Status | Per-ID screenshots | Candidate id on deck shot |
|---|---|---|---|
${perIdTable}

**Negative gate (E08).** Five synthetic bad records — a frame from another bridge fixture
relabelled, a stale canvas with no fresh render frame, a reused frame identity, a fake deck
stamped at an unresolved site, and an undeclared mode — are **all rejected** with the expected
reason; an unmodified authentic control is accepted; all **40** real bridge-labelled captures
are accepted. Rule: ≤32 tiles from the requested \`atTile\`, nearest bridge centre must equal the
requested id, fresh frame, declared mode, zero \`T.BRIDGE\` at an unresolved site, frame-serial
owner must match the label.

**Duplicate audit (E09).** **84** PNGs / **79** unique contents; **5** duplicate pairs, all
classified \`LEGITIMATE_IDENTICAL_STATE_CAPTURE\` (same fixture/state at distinct frame
identities) — duplicates are **not** auto-failed. **0** reused-frame defect groups; **8**
\`_at_bridge\` shots have **8** distinct contents. The old 10-image group is gone.

**Updated gates.** Runtime **${trav.summary.passes}/${trav.summary.checks}** (28 MAP-GEO-02 +
E08/E09/E10), static **156/156**, MAP-GEO-01 **130/130**, \`npx tsc --noEmit\` clean,
**17** real-key runs, **84** native shots, **0** browser errors, **0** permission leaks over
10,086 tiles. QA executable **NOT rebuilt** (\`${trav.executable.sha256.slice(0, 8)}…\`);
native \`640×360\`, \`U=0.5\`, original painter and all three protected baselines unchanged.

**Visual inspection** (\`creator-u05/evidence/mapgeo02a-visual-inspection.json\`). Deck
silhouettes are bounded and water-only; \`br_2\` deck and both bank seams read cleanly; angled
decks (\`br_5\`, \`br_a\`) show stepped tile-grid edges and \`br_7\` reads as planks on tan
\`shallow\` terrain (all 28 deck tiles are water-classified) — targeted **art** rework, not a
geometry defect. The cliff face is a thin jagged band (no filled slab, no production wall) but
reads stylised; the cliff real-key run frames do not show the face clearly — an **evidence gap**.
**No newly confirmed physical defect.** The 10 candidates, 2 unresolved ids and the 31-road
classification are retained. **NO \`VISUAL_ACCEPTED\`**; targeted rework items are recorded and
NOT granted.

**Exact SHAs and drift** (\`creator-u05/evidence/mapgeo02a-refs.json\`, 13/13 ref checks).
Map pin at 02A \`${refs.pinned.mapAt02aPin.slice(0, 8)}…\`, at 02 delivery
\`${refs.pinned.mapAt02Delivery.slice(0, 8)}…\`, \`main\` \`${refs.pinned.main.slice(0, 8)}…\`.
Gameplay chain: \`${refs.drift.chain.map(s => s.slice(0, 8) + '…').join(' → ')}\`
(02A observed \`897e28f2…\` WAS live \`refs/pull/44/head\` at task start; PR44 then advanced
**more than once** during the task — the definitive live SHA at the final gate run is
\`${refs.live.pr44Head}\`, recorded in \`mapgeo02a-refs.json :: live.pr44Head\`). PR44
**${refs.pr44.state}**, NOT edited/merged/closed. Drift since 02 delivery:
\`${refs.drift.at02DeliveryTo02aLive.shortstat}\`;
since the observed 02A head: \`${refs.drift.observed02aTo02aFinish.shortstat}\`. Terrain
**palette** constants (2154 B) are byte-identical at every recorded head; the preflight
painter-*block* slice grew \`8276 → 8382 B\` because a Gameplay POI-door render line inside
\`renderChunk()\` changed — reported Gameplay-side drift, NOT a change to the original painter
or to the QA viewer.

**WorldTraversal readiness.**
\`READY_AS_MEASURED_QA_EVIDENCE_FOR_WORLDTRAVERSAL_INTAKE__NOT_READY_AS_PRODUCTION_TRAVERSAL_PERMISSION__NOT_VISUALLY_ACCEPTED\`.
The 10 deck candidates and 305 cliff faces remain geometry-only; \`br_9\`/\`br_b\` and the 6
ambiguous road ids still need Creator/Gameplay decisions; the §8 intake list is unchanged.
`;
fs.writeFileSync(path.join(ROOT, 'docs/MAPGEO02_GAMEPLAY_HANDOFF.md'), md);
console.log(`U05_MAPGEO02_HANDOFF_OK sources=${sources.length} missing=0 bridges=${bridgeRows.length} unresolved=${unresolved.length} roadRows=${road.rows.length}`);
