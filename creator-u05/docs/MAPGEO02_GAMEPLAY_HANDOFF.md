# MAP-GEO-REJOIN-02 — Gameplay Handoff (Correct Real Bridge & Cliff Projection)

> **Map physical geometry is measured and corrected in an isolated QA viewer.
> Gameplay traversal permission is NOT granted.** Active authority remains
> `WMP-04R1` / `U=0.5` / `CREATOR_CHOSEN_U05.v1`. Generated
> 2026-11-05T15:46:35.318Z. Machine-readable packet:
> `creator-u05/evidence/mapgeo02-gameplay-handoff.json`.

---

## 1. Exact SHAs and live custody

| Item | Value |
|---|---|
| Map branch / pinned HEAD / live HEAD | `arena/2e3cfbd2-soul-of-hero` @ `3e02fde05a24f6d645ea00ed5ab78900655e1272` |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` |
| Gameplay HEAD **observed/pinned in the task** | `6e7d116b4400ea3c24373fe884b7fad258f4f7bc` |
| Gameplay / PR44 **live HEAD at MAP-GEO-02 delivery** | `c2418b5405ff3325e0ac4806a5309785e816b093` (PR44 **OPEN**, NOT edited/merged/closed) |
| Gameplay / PR44 **live HEAD at 02A finish** | `e79d9e7edc46693729b8c4732162dfbf7c9158d9` (PR44 **OPEN**; see §10 amendment) |
| Live drift during MAP-GEO-02 | **true** — both SHAs reported; Map did not touch PR44 |
| Creator-verified Gameplay HEAD | `5b3e683402bbc8540dea9404576164097e753f97` |
| U05 source pin | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9` |
| GOLD SHA-256 | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` (unchanged) |
| Terrain painter block (at 02 delivery) | `f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803` — byte-identical at U05 pin / MAP-GEO-01 observed / MAP-GEO-02 pinned / 02-delivery PR44 head; **02A drift in §10** |
| QA executable | `creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html` — 1421388 B, SHA `41b2203bbbab47c0f4f215461e9e7571c2d1a46b0d982a7a2fbf177bbcac2339` |
| Protected baselines | terrain-only `540f095e…`, NATURE-01 `ac4d54e3…`, NATURE-02 `6e1e897a…` — **all unchanged** |

Gameplay moved from `6e7d116b…` to `c2418b54…` during the task (motorbike / loot /
respawn work). The **terrain painter block stayed byte-identical**, live `art.ts`
still contains `S.claim`, and the live bible is unchanged from the MAP-GEO-01
observed live file. **Do not silently re-vendor.** PR44 remains OPEN.

## 2. The two Map-derived defects

| Defect | MAP-GEO-01 measured | MAP-GEO-02 corrected |
|---|---|---|
| `MGP-D01` | 12/12 bridge centres `RIVER` / blocked, **0 crossable**; at `br_1`, **888** `T.BRIDGE` tiles on land, **0** on water (wood carpet + empty gap) | **10/12** bounded deck candidates rendered from GOLD `id/at/ang/load` + authored banks + road approaches + `crossingCandidate` code. **596** deck tiles, **100 % on water, 0 on land**. `br_9`, `br_b` unresolved, **no deck stamped** |
| `MGP-D10` | **305** binary `cliffCandidate` cells but **0** `T.CLIFF` (consumer used `cliff >= 2`) | Binary `>=1` predicate + independent `heightClass>=4`, `slope>=20`, `slopeClass>=3`, downhill-drop evidence. **187** visible cliff tiles in the highland window (old: **0**), as a thin broken downhill face band (**2–4 of 16** tiles per cell edge), **0 production walls** |

No GOLD geometry, resource placement, POI architecture, Beacon road,
production gameplay or protected baseline was changed. No new atlas or art.

## 3. Bridge-by-bridge outcomes (all 12 GOLD ids)

Deck length/width are in **AU** at `U=0.5`; width is the authored GOLD road
centreline width **3.0 AU**, **never** the 12 AU circular marker radius.
`crossingCandidate` code: `1=foot`, `2=cart`, `3=ford`.

| ID | load/code | channel | water span / ⟂ span (AU) | footprint (AU) | deck tiles | span coverage | outcome |
|---|---|---|---|---|---|---|---|
| `br_0` | cart / 2 | RIVER | 5 / 7.5 | 5.5 × 3 | 53 | 1 | **CANDIDATE DECK** |
| `br_1` | cart / 2 | RIVER | 4 / 7 | 4.5 × 3 | 46 | 1 | **CANDIDATE DECK** |
| `br_2` | cart / 2 | RIVER | 7 / 15.5 | 7.5 × 3 | 77 | 0.9375 | **CANDIDATE DECK** |
| `br_3` | cart / 2 | RIVER | 7 / 24.5 | 7.5 × 3 | 83 | 1 | **CANDIDATE DECK** |
| `br_4` | cart / 2 | RIVER | 4 / 13 | 4.5 × 3 | 46 | 1 | **CANDIDATE DECK** |
| `br_5` | cart / 2 | RIVER | 7 / 47.5 | 7.5 × 3 | 84 | 1 | **CANDIDATE DECK** |
| `br_6` | foot / 1 | RIVER | 4 / 20.5 | 4.5 × 3 | 49 | 1 | **CANDIDATE DECK** |
| `br_7` | cart / 2 | RIVER | 2 / 20.5 | 2.5 × 3 | 28 | 1 | **CANDIDATE DECK** |
| `br_8` | foot / 1 | RIVER | 6 / 27 | 6.5 × 3 | 75 | 1 | **CANDIDATE DECK** |
| `br_9` | foot / 1 | RIVER | 6.5 / 5 | 7 × 3 | 0 | 0.9333 | **UNRESOLVED** — MULTIPLE_BOUNDED_CROSSING_AXES__OWNER_BEARING_REVIEW |
| `br_a` | foot / 1 | RIVER | 5 / 7 | 5.5 × 3 | 55 | 0.9167 | **CANDIDATE DECK** |
| `br_b` | foot / 1 | RIVER | 32 / 37.5 | 32.5 × 3 | 0 | 1 | **UNRESOLVED** — NO_VERIFIED_BOTH_BANKS; WATER_RUN_UNBOUNDED_AT_30_AU_SEARCH; WATER_SPAN_EXCEEDS_BOUNDED_CANDIDATE_GUARD; ROAD_OR_FOOTPATH_APPROACH_MISSING; BANK_SEAMS_NOT_CONNECTED; SOURCE_EVIDENCE_INSUFFICIENT |

**10 resolved + 2 unresolved = 12. This is NOT a forced 12-PASS result.**

* `br_9`: two bounded crossing axes (`ang` run 6.5 AU, perpendicular 5 AU);
  GOLD `ang` alone cannot pick a bearing → **Creator / Gameplay bearing review**.
* `br_b`: no verified second bank, water run unbounded at the 30 AU search
  (32 AU), span exceeds the bounded guard, no road approach on one side,
  seams disconnected → **Creator / Gameplay bank decision**. It sits at a river
  mouth / open water; no arbitrary stamp was applied.

Every resolved deck was independently checked for: both banks dry land, road /
footpath approaches on both banks, bounded water span, footprint orientation
along the authored `ang`, 4-connected tiles, span coverage, bank seams, and
source-evidence sufficiency. Full records:
`creator-u05/evidence/mapgeo02-bridge-geometry.json`.

**Authority split:** Map owns visible deck geometry and continuity. Gameplay
owns walking, carts, load/bearing, clearance and collision. Default mode
`PRODUCTION_NO_PERMISSION` keeps every deck tile **blocked**. The explicitly
named `QA_CANDIDATE_CROSSING` mode is geometry measurement only; it never
silently grants production traversal.

## 4. Cliff candidate / display / collision counts (independent checks)

| Metric | Value |
|---|---|
| `cliffCandidate.v3.u8` non-zero cells | **305** (codes `1`: 305, `0`: 43445; maximum code **1**) |
| Independently qualified cells | **305** — `heightClass>=4` 305/305, `slope>=20` 305/305, `slopeClass>=3` 305/305, 4-neighbour downhill drop ≥12 305/305 |
| Repaired predicate | `cliffCandidate >= 1 AND heightClass >= 4 AND slopeRaw >= 20 AND 4-neighbour downhill drop >= 12` |
| Face orientation histogram | N 105 / S 62 / W 64 / E 74 |
| Visible cliff tiles in highland window | **187** (old executable **0**) |
| Filled 16×16 analysis-cell slabs | **0** (max measured 50 of 256 tiles in one cell) |
| `productionCollisionCells` | **0** — visible face is NOT a permanent impassable wall |
| `QA_CANDIDATE_CROSSING` cliff blockers | **187** in the same window — explicit, separate QA collision |
| `activeCollisionPermission.v3.u8` non-zero cells | **0** (WMP-03 invariant) |

The face uses the **verbatim `T.CLIFF` art** with deterministic `hash2` jitter,
~6 % holes and sparse one-tile rock teeth so it reads as a broken rocky ledge,
not a featureless gray slab or grid bar. Interior of each candidate cell stays
the authored biome/hill. Roads are never repainted.

## 5. Road-water crossing classification (31 water-overridden GOLD routes)

| Category | Count |
|---|---|
| AUTHORED_BRIDGE | 9 |
| AMBIGUOUS_OWNER_REVIEW | 6 |
| UNBRIDGED_LAND_ROAD_CROSSING | 8 |
| FERRY_NAVIGATION_REFERENCE | 8 |

* **8 ferry navigation references** `rd_2c`, `rd_2d`, `rd_2e`, `rd_2f`, `rd_2g`, `rd_2h`, `rd_2i`, `rd_2j`:
  `waterTraversalClass=2`, `foot=false`, `boat/swim/ferryFoot=false`,
  visible tile is **water**, never `T.ROAD`. Runtime-verified at 8 ferry-cell
  centres. They must **not** become dry-land roads.
* **9 authored bridges** have WMP-03 `BRIDGE_DECK_PROPOSAL` cells; extra
  `FORD_PROPOSAL` cells on the same road are recorded, not promoted.
* **8 unbridged land-road crossings** are `FORD_PROPOSAL` /
  `crossingCandidate=3` (depth/flow UNKNOWN); no bridge or dry road invented.
* **6 ambiguous owner review**: `rd_a`, `rd_1g`, `rd_22`, `rd_23`, `rd_26`, `rd_28` — water
  override measured at U=0.5 tile centres but **no WMP-03 water-road cell
  classification** exists at 8 AU analysis resolution. Exact ids, no guessed geometry.

Full rows: `creator-u05/evidence/mapgeo02-road-water-classification.json`.
Creator-approved Beacon road: **0 changed tile codes** in the old/new comparison
(340 `T.ROAD` tiles in both), T1/T2/T4/T5/T6 exact-coordinate windows also
show **0 changed tile codes** — no widening, recolouring or redrawing.

## 6. Real runtime screenshots and real-key WASD

* Executable: `creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html` (standalone, self-contained).
* Renderer: existing SOH `U=0.5`, native `640×360` `1×`, hero `16×24`,
  base speed `72 px/s`, verbatim `terrain.ts` painter, x10 viewer multiplier.
* **17** real-key runs, **84** native
  `640×360` PNGs, **0** browser errors,
  **31/31** checks PASS.
* Six MAP-GEO-01 runs were reproduced at **exactly the same coordinates and
  legs**, with exact-end-tile static shots and tile-code diff. `T3` shows
  656 old land `T.BRIDGE` tiles → 46 new water deck tiles (702 changed tiles);
  T1/T2/T4/T5/T6 show **0 changed tile codes** at their exact coordinates.
  Raw pixel diff also contains a small independently-timed viewer camera offset;
  the tile-code comparison is the authoritative same-coordinate check.
* Production `br_2`: **78 blocked substeps, 3.38 tiles** — crossing still
  blocked. QA `br_2`: **0 blocked substeps, 28.5 tiles** across both banks.
  QA `br_7`: **24 tiles** with `d` / `d+s`. QA `br_1`: hero reaches the
  measured `br_1` deck. `br_b`: **0 deck art**, movement blocked.
* Highland `T4` production: **0 blocked substeps** (no cliff wall). Explicit
  QA candidate collision: **98 blocked substeps**; an alternative real-key route
  moved **1572 px** with 0 blocked substeps.
* Nearby chunks, deterministic reload, source ids, save-compatible coordinates
  (`U=0.5`, `TILE=16`, frame `4000×2800`, GOLD `at` unchanged) and
  **0 permission leaks over 10,086 sampled tiles** are all verified in
  `creator-u05/evidence/mapgeo02-traversal.json`.

Screenshots are **QA evidence, not visual or production acceptance**.

## 7. Unresolved geometry — exact ids and owners

| Kind | ID | Owner | Why |
|---|---|---|---|
| BRIDGE | `br_9` | CREATOR/GAMEPLAY (exact id reported) | MULTIPLE_BOUNDED_CROSSING_AXES__OWNER_BEARING_REVIEW |
| BRIDGE | `br_b` | CREATOR/GAMEPLAY (exact id reported) | NO_VERIFIED_BOTH_BANKS; WATER_RUN_UNBOUNDED_AT_30_AU_SEARCH; WATER_SPAN_EXCEEDS_BOUNDED_CANDIDATE_GUARD; ROAD_OR_FOOTPATH_APPROACH_MISSING; BANK_SEAMS_NOT_CONNECTED; SOURCE_EVIDENCE_INSUFFICIENT |
| ROAD_WATER_CROSSING | `rd_a` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |
| ROAD_WATER_CROSSING | `rd_1g` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |
| ROAD_WATER_CROSSING | `rd_22` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |
| ROAD_WATER_CROSSING | `rd_23` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |
| ROAD_WATER_CROSSING | `rd_26` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |
| ROAD_WATER_CROSSING | `rd_28` | CREATOR / GAMEPLAY owner | UNRESOLVED__NO_SOURCE_BACKED_CROSSING_EVIDENCE; Water override measured at U=0.5 tile centres but NO WMP-03 water-road cell classification exists for this road at 8 AU analysis resolution. Exact id reported; no geometry guessed. |

## 8. Gameplay `WorldTraversal` intake requirements

1. Pin the exact Gameplay SHA before consuming this packet: task pin 6e7d116b…, MAP-GEO-02 delivery live c2418b54…, 02A observed 897e28f2…, 02A live e79d9e7e… (drift chain in §10).
2. Decide bearing/load class for each of the 10 resolved deck candidates from GOLD load + crossingCandidate code 1/2; do not infer cart clearance from foot/cart labels.
3. Define walk/cart collision on deck tiles, seam tiles and both approaches; production default here is PRODUCTION_NO_PERMISSION (deck still blocked).
4. Approve or reject the QA_CANDIDATE_CROSSING mode separately; it is geometry measurement ONLY and never a production permission.
5. Define a cliff climb/collision law; the current display is a visible PROPOSED face band with ZERO production collision cells.
6. Resolve br_9 bearing ambiguity (two bounded crossing axes) and br_b missing second bank / unbounded 32 AU water run with the Creator; do not stamp either.
7. Resolve the 6 ambiguous water-overridden road ids with the owner: rd_a, rd_1g, rd_22, rd_23, rd_26, rd_28.
8. Keep the 8 inherited ferry routes as navigation references (waterTraversalClass=2, foot=false); boat/swim/ferryFoot remain GAMEPLAY-owned and unapproved.
9. Keep activeCollisionPermission=false until WorldTraversal explicitly approves a cell; WMP-03 invariant forbids non-zero values.
10. Preserve all 81 canonical POI/source IDs, the Creator-approved Beacon road (verified byte-identical tile codes), and the three protected standalone baselines.

## 9. Acceptance boundary

`PAPER=MEASURED`, `RUNTIME=ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY`,
`VISUAL=NOT_REQUESTED_AND_NOT_GRANTED`, `GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED`.

**No** `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`, `MERGE_READY`, production merge,
PR44 edit/merge, GOLD amendment, new atlas, full-world visual acceptance or
full Gameplay integration claim. PAPER / RUNTIME / VISUAL / GAMEPLAY stay
separate. NATURE-01/02 remain archived R&D.

## 10. AMENDMENT A — MAP-GEO-REJOIN-02A (evidence integrity corrective)

**Verified defect.** The 02 QA script ran every `BRIDGE_RUNS` fixture first and only
then captured all `_at_bridge` images. GitHub blob verification at pinned HEAD found
**52 PNGs / 34 unique contents**, one **10-image identical group**; 8 differently-named
`_at_bridge` files were the same stale final canvas frame.

**Correction.** `creator-u05/tests/qa-mapgeo02-traversal.mjs` now forces at least two fresh
render frames after every setup and reads the canvas **and** runtime state atomically in one
frame callback. Every capture logs requested bridge id, actual player tile, camera coordinate,
candidate id, selected mode, timestamp and frame identity. Each of the 8 bridge fixtures
captures its own image **before the next fixture**. Twelve self-contained per-ID fixtures were
added: deck + both measured bank approaches for the 10 resolved ids, the bare crossing site
only for `br_9` / `br_b`. Full log: `creator-u05/evidence/mapgeo02-shot-provenance.json`.

**Screenshot authenticity by bridge id** (all fresh frames, `PRODUCTION_NO_PERMISSION`, native `640×360`):

| ID | Status | Per-ID screenshots | Candidate id on deck shot |
|---|---|---|---|
| `br_0` | CANDIDATE DECK | bankA, deck, bankB | br_0 |
| `br_1` | CANDIDATE DECK | bankA, deck, bankB | br_1 |
| `br_2` | CANDIDATE DECK | bankA, deck, bankB | br_2 |
| `br_3` | CANDIDATE DECK | bankA, deck, bankB | br_3 |
| `br_4` | CANDIDATE DECK | bankA, deck, bankB | br_4 |
| `br_5` | CANDIDATE DECK | bankA, deck, bankB | br_5 |
| `br_6` | CANDIDATE DECK | bankA, deck, bankB | br_6 |
| `br_7` | CANDIDATE DECK | bankA, deck, bankB | br_7 |
| `br_8` | CANDIDATE DECK | bankA, deck, bankB | br_8 |
| `br_9` | UNRESOLVED | site | null — NO deck |
| `br_a` | CANDIDATE DECK | bankA, deck, bankB | br_a |
| `br_b` | UNRESOLVED | site | null — NO deck |

**Negative gate (E08).** Five synthetic bad records — a frame from another bridge fixture
relabelled, a stale canvas with no fresh render frame, a reused frame identity, a fake deck
stamped at an unresolved site, and an undeclared mode — are **all rejected** with the expected
reason; an unmodified authentic control is accepted; all **40** real bridge-labelled captures
are accepted. Rule: ≤32 tiles from the requested `atTile`, nearest bridge centre must equal the
requested id, fresh frame, declared mode, zero `T.BRIDGE` at an unresolved site, frame-serial
owner must match the label.

**Duplicate audit (E09).** **84** PNGs / **79** unique contents; **5** duplicate pairs, all
classified `LEGITIMATE_IDENTICAL_STATE_CAPTURE` (same fixture/state at distinct frame
identities) — duplicates are **not** auto-failed. **0** reused-frame defect groups; **8**
`_at_bridge` shots have **8** distinct contents. The old 10-image group is gone.

**Updated gates.** Runtime **31/31** (28 MAP-GEO-02 +
E08/E09/E10), static **156/156**, MAP-GEO-01 **130/130**, `npx tsc --noEmit` clean,
**17** real-key runs, **84** native shots, **0** browser errors, **0** permission leaks over
10,086 tiles. QA executable **NOT rebuilt** (`41b2203b…`);
native `640×360`, `U=0.5`, original painter and all three protected baselines unchanged.

**Visual inspection** (`creator-u05/evidence/mapgeo02a-visual-inspection.json`). Deck
silhouettes are bounded and water-only; `br_2` deck and both bank seams read cleanly; angled
decks (`br_5`, `br_a`) show stepped tile-grid edges and `br_7` reads as planks on tan
`shallow` terrain (all 28 deck tiles are water-classified) — targeted **art** rework, not a
geometry defect. The cliff face is a thin jagged band (no filled slab, no production wall) but
reads stylised; the cliff real-key run frames do not show the face clearly — an **evidence gap**.
**No newly confirmed physical defect.** The 10 candidates, 2 unresolved ids and the 31-road
classification are retained. **NO `VISUAL_ACCEPTED`**; targeted rework items are recorded and
NOT granted.

**Exact SHAs and drift** (`creator-u05/evidence/mapgeo02a-refs.json`, 13/13 ref checks).
Map pin at 02A `accca454…`, at 02 delivery
`3e02fde0…`, `main` `52147889…`.
Gameplay chain: `6e7d116b… → c2418b54… → 897e28f2… → e79d9e7e…`
(02A observed `897e28f2…` WAS live `refs/pull/44/head` at task start; PR44 then advanced
**more than once** during the task — the definitive live SHA at the final gate run is
`e79d9e7edc46693729b8c4732162dfbf7c9158d9`, recorded in `mapgeo02a-refs.json :: live.pr44Head`). PR44
**OPEN**, NOT edited/merged/closed. Drift since 02 delivery:
`42 files changed, 1059 insertions(+), 66 deletions(-)`;
since the observed 02A head: `29 files changed, 672 insertions(+), 37 deletions(-)`. Terrain
**palette** constants (2154 B) are byte-identical at every recorded head; the preflight
painter-*block* slice grew `8276 → 8382 B` because a Gameplay POI-door render line inside
`renderChunk()` changed — reported Gameplay-side drift, NOT a change to the original painter
or to the QA viewer.

**WorldTraversal readiness.**
`READY_AS_MEASURED_QA_EVIDENCE_FOR_WORLDTRAVERSAL_INTAKE__NOT_READY_AS_PRODUCTION_TRAVERSAL_PERMISSION__NOT_VISUALLY_ACCEPTED`.
The 10 deck candidates and 305 cliff faces remain geometry-only; `br_9`/`br_b` and the 6
ambiguous road ids still need Creator/Gameplay decisions; the §8 intake list is unchanged.
