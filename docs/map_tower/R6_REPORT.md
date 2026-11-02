# Map Tower — Veyra network + world art status (R6 → R8)

**Latest tested code SHA: `5dce3b4` (branch `arena/103e4440-soul-of-hero`).**
CI #41398920626: spatial PASS (33/33), browser capture PASS, godot-native-attempt PASS,
godot-native-gate PASS. Evidence commit `6a637f2` (46 Chromium scenes at 640×360, 0 blank).

R8 fixed: the browser crash (`window.__veyra.s` → `window.__veyra.meta.spawns`), the fake sprint
oracle (now probe-selects a free direction, resets to the same spawn for every trial, walks with D
and runs with Shift+D over the same 700 ms window, and records positions, displacement, input state
and blocking: **walk 67.2 px, run 127.7 px, ratio 1.90, direction `a`**), and the per-cell 32 px rock
repetition (rock modules are now placed as clustered masses on a 3-cell lattice with jitter, 1.6×
scale, rubble aprons: 104 masses instead of 331 per-cell stamps).


Base: `6c3b6ce4` → this commit. Branch `arena/103e4440-soul-of-hero`. GOLD untouched
(`88780f78…a3a256`). Verdict for this round: **NETWORK_GATES_PASSED — VISUAL_REVIEW_PENDING**.
33/33 mandatory spatial gates pass; browser evidence and native integration are reported separately
and neither is claimed as accepted art.

## 1. Source topology (N1)
- 84/84 authored land roads compiled, 17/17 rivers, 12 bridges, 27 docks, 81 POIs, 8 ferry routes.
- Endpoint near-miss set: **58 pairs, all classified** — 57 `VALID_JUNCTION` (rendered corridors
  overlap: endpoint distance ≤ sum of both render half widths), 1 `VALID_SEPARATE`. No
  `SOURCE_AMBIGUITY_BLOCKED` remains.

## 2. Collision / traversal (N2, A5, A6, A7)
- **84/84 roads are walkable end-to-end** with the real 12×8 px feet box, proven twice: the
  compiler's corridor BFS and an independent validator BFS over the validator's own collision grid
  restricted to each authored corridor (deck / pier / POI cells added explicitly).
- The twelve roads that failed in the previous round are all resolved:

| road | cause found | repair | max shift |
|---|---|---|---|
| rd_0 | corridor cell majority-water beside the channel | bank realignment (recorded per point) | 1.0 u |
| rd_i | same, two points | bank realignment | 2.0 u |
| rd_w | 7 points inside the bank margin | bank realignment | 1.0 u |
| rd_x | GOLD `ford: true`, unit-grid ford detection missed it | authored ford rendered at the crossing | 2.0 u |
| rd_1f | authored ford + 2 bank points | ford + realignment | 1.41 u |
| rd_1g | trail authored inside a 2.5 u channel (0.57 u from its centre) | realigned to the bank, no ford invented | 1.41 u |
| rd_1n | 0 wet points; blocked by a later placement | placement footprint keep-out | – |
| rd_24, rd_27, rd_29, rd_2b | bank-margin cells at crossings/junctions | bank realignment | 1.0–2.0 u |
| rd_2a | authored ford + 7 bank points | ford + realignment | 2.0 u |

  Realignment is bounded to **2 GOLD units (8 px)** and every move is exported
  (`network.json → road_offsets`, 53 points on 16 roads). GOLD itself is never edited.
- Fords are only ever created from GOLD `ford: true` with a single ≤6 u channel crossing
  (`network.json → authored_fords`, 4 roads). Brook passes stay ≤2.5 u with no bridge within 14 u.
- A5: **no bridge has an off-deck route inside its corridor** (dry-land and authored-ford routes
  would be classified as such; the earlier "11 unclassified routes" were an artefact of the test —
  it opened the landing cells including the deck, so "walking around" was really "walking over").
- A7: POI clearings now run last, so nothing re-seals a site: **107 cells cleared**, every POI
  centre open, every land POI entrance anchor within 6 cells.

## 3. Rendered continuity (N3) — measured on the final image, not on masks
`out/render_pass_pre_roads.png` and `render_pass_post_roads.png` are the two final render passes at
native resolution. N3 compares them: for every authored centreline sample it computes the distance
to the nearest pixel the road pass actually changed; a sample is covered when a road pixel exists
within the class half width, or where a deck/pier/ford was built. Result: **84/84 roads ≥99.5 %**,
worst gap 0 units.

## 4. Hydrology (N4)
- Every authored source/mouth relation is checked against **the body it names**: the river end must
  be inside (or ≤1 u from) that exact lake/river/sea geometry *and* no other body may be closer —
  26/26 relations pass (8 spring/none relations have no receiving body).
- Water is labelled as 8-connected pixel components: the compiled surface is one component, and each
  river end shares its component with its named body (`water_verification`).
- 8 river ends that stopped short of the water they name were closed along their own bearing
  (`river_extensions`), so no distributary dangles in the sand. No new water connections created.

## 5. Visual work in this round
- Pixel-resolution beach: the 16 px shore tiles left stair-stepped cream slabs; the shore is now a
  5 px dry-sand band, a 2 px wet line and a soft inner band built from distance to the water.
- Placement now tests the **whole sprite footprint** (not just the anchor cell), so buildings and
  trees can no longer stand in a channel, on a road or on a bridge deck.
- Rivers keep their authored width and are drawn with round caps and a single wet bank line.

## 6. Evidence integrity
`SPATIAL_VALIDATION.json → provenance` records, for the same run: tested SHA, GOLD sha256, compiler
sha256 (all five tool files), `world.png` sha256, `world_meta.json` sha256, collision sha256,
`network.json` sha256. CI refuses to report on a mismatch (`VEYRA_REQUIRE_SHA=1`) and the browser job
asserts `BROWSER_CAPTURE.json.commit == GITHUB_SHA` before it commits captures back to this branch.

## 7. Still open (not claimed complete)
- **Browser acceptance**: the capture set (overview, GOLD/R5/R6 pairs, Greywater upstream→lake→
  downstream, junction, estuary, three cart roads × three cameras, forest paths, junctions, bridge
  and dock approaches, four spawns, fords, all twelve repaired roads) is generated by CI and
  committed back; the sandbox cannot run Chromium locally (no `libnspr4`, no root), which is why the
  previous round shipped no screenshots. Visual verdict stays with the creator.
- **Native integration**: `godot-native-gate` now runs the same binary and flags for baseline and
  candidate, keeps exit statuses, sorts lexically and fails on new errors. A launch is not gameplay.
- **Art gap**: seabed objects (694865 underwater set), Undead Tileset (695666) and Cursed Land
  (958568) remain intake items in `ASSET_INTAKE_MANIFEST.md`; nothing is substituted with placeholders.
