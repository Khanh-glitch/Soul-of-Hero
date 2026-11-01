# Chapter 1 map audit and redesign plan

## Scope and authoring contract

Campaign maps are authored as LevelSchema v2 JSON in `data/levels/`. `DungeonLevel` renders three 16 px TileMapLayers (`Backdrop`, `Geometry`, `Decor`); entity markers and floor transitions are serialized in the same document. Level-specific objective/runtime controllers remain separate from map layout and must keep their existing IDs and contracts. The review is deliberately non-destructive: preserve the established encounter/objective systems and distinctive map silhouettes unless a measured navigation or render issue justifies changing them.

## Existing campaign identities

| Slot | Layout signature | Navigation/mechanic to preserve |
|---:|---|---|
| 1 | Three-floor tutorial progression (`crypt_entrance`) | Safe onboarding, three camps, reciprocal floor doors, three required Sigils |
| 2 | Ossuary Fork | A visible risk/reward branch that recombines across three floors |
| 3 | Crossfire Archive | Cover and Reaper sightline pressure across three floors |
| 4 | Spiral Reliquary | Spiral movement through deliberate trap fields |
| 5 | Blood Crucible | Escalating guards, a breather, and the required Archer miniboss/pickup route |
| 6 | Soul Anchor Relay | Stepped first Anchor approach, split-diamond reverse-Relay lanes, an east-to-west final return loop, and three guarded cores |
| 7 | Failing Beacon | Four-lane open defense arena, real Beacon threat, and three escalating waves |
| 8 | Divided Reliquary | A physical, exclusive branch choice with a manually claimed reward |
| 9 | Crimson Gate | Three physical seals gate a named Elite showdown |
| 10 | Castellan Throne | Safe checkpoint approach and a readable two-phase boss arena |

## Structural observations

The first Godot 4.7 campaign-wide geometry run confirmed unique profiles and distinct floor silhouettes, reciprocal floor-door connectivity, spike-safe objective reachability, and dodge clearance. It also caught five Level 10 markers (three torches and two coin pickups) placed outside the walkable floor; their stable entity IDs were preserved while the markers were moved onto adjacent playable cells. All authored entities and floor-door destinations are now required to land on walkable floor. The follow-up Godot 4.7 run passed the corrected geometry gate and captured all ten production Chapter 1 scenes after the correction. These structural facts and nonblank captures are not substitutes for a full human playthrough or manual screenshot review.

The externally reviewed Godot captures confirmed that Levels 1–6 were not merely sharing a safe opening: the full maps repeated a three-band left-entry → central chamber → right-wing grammar. Independent floor-mask comparison agreed: Levels 5 and 6 had a 0.761 Jaccard overlap, Levels 3 and 4 had 0.697, and Levels 2 and 3 had 0.579. The roles and interior hazards differed, but the whole-map route composition was too similar; Level 6 versus Level 5 was the strongest redesign priority. Level 1 remains the deliberate tutorial baseline.

The Level 6 redesign now preserves all 73 stable entity IDs and nine room/capture anchors while changing the actual floor graph: a stepped northeast first approach, a beveled split-diamond second chamber with two lanes around its center, and an east-to-west final loop. The authored map has 5,170 floor cells in exactly three door-linked components and 24 spike markers with authored dodge space. Offline floor-mask review measured 5,146/5,146 spike-free cells as connected and reduced the Level 5/6 Jaccard overlap to approximately 0.564. These are design-review figures, not substitutes for the Godot schema, live Knight collision, objective, promotion, and rendered-route gates below.

Level 7's large open rectangle is intentional for defense readability; its lanes need clear visual cues, not extra collision that blocks the Beacon or enemy routes. Levels 8–10 have differentiated branch, three-seal, and throne-arena silhouettes. The reported Level 8–9 enemy-label/health/effect clutter still needs to be reassessed in production-route captures before any shared UI change; move or stagger level-specific content only if a real in-game route reproduces it.

The previous campaign screenshot harness instantiated `Main` directly with no AppFlow run. That made the tutorial's documented empty-run editor/test fallback visible in unrelated slots and did not validate campaign setup. The capture harness now unlocks through an isolated SaveService fixture and launches each map through the real AppRoot/AppFlow campaign gate; it captures spawn, a named mid-level room, and the representative end room for every slot. The orange Level 1 tutorial is intentionally driven by confirmed play events, not elapsed time: the existing learning test verifies that normal movement, Dash, four confirmed Sword hits, and a confirmed Sword Soul Echo complete and persist all seven lessons, after which the panel hides. It can remain during a fresh Level 1 run until those actions have actually been learned.

Training remains `SANDBOX` with campaign slot zero, but no longer reuses Level 1. `crypt_training_sandbox.json` authors a separate 2,096-cell, one-floor practice loop with a safe west entry, five named Skeleton markers around a central island, and a free east exit. `crypt_skeleton_sandbox` binds those exact markers and declares no reward or feature grant. The production `Main` encounter projection now accepts registered sandbox definitions as well as campaign definitions; `AppFlow.start_training()` remains the only route authority and never commits campaign completion. Zero Sigils are valid only with the explicit non-campaign `training_contract`; uncontracted maps retain the previous 1–99 schema rule. The Training route gate uses the real AppRoot/AppFlow/Main path, the live Knight collision shape, all five production death callbacks, duplicate-death idempotency, and a non-empty full-Backdrop assertion. Spawn, combat-loop, and exit captures run separately from the thirty campaign captures.

## Validation gates added for the redesign pass

1. `tests/chapter_1_campaign_map_design_test.gd` checks all ten map files for schema, bounds, unique entity IDs, authored room/profile identity, walkability, door connectivity, hazard dodge space, objective reachability, and pairwise silhouette difference.
2. Existing `tests/chapter_1_map_design_test.gd` keeps its deeper three-floor camp, roster, trap, and runtime-loader checks for slots 1–5.
3. `tests/chapter_1_campaign_level_visual_capture.gd` captures each route through the production `AppRoot`/`AppFlow` campaign entry at 1280×720 for spawn, named mid-level, and representative end rooms. PNGs and per-capture logs are retained in CI; they are snapshots, not traversability proof.
4. `tests/chapter_1_collision_route_test.gd` instantiates every production map under Godot, queries real `Geometry` physics with a Knight-sized clearance shape, avoids authored spikes, traverses reciprocal floor-door teleports, and checks objectives/doors/endpoints.
5. Existing Level 5–10 objective/runtime gates remain authoritative for miniboss recruitment, Soul Anchors, Beacon defense, Reliquary branching, Crimson Gate, and the Castellan. The Godot 4.7 workflow runs the focused Level 6–10 route/runtime/fresh-save gates plus sandbox content and tutorial learning checks.
6. `tests/training_sandbox_live_route_test.gd` verifies the dedicated Training schema contract (including rejection without that contract), production route identity, five-enemy encounter completion and idempotency, unchanged campaign progression, and real Knight-clear traversability.
7. The workflow runs both redesigned generators under Godot and requires a clean `git diff` for their committed JSON. It also rejects Training script/out-of-tree engine errors explicitly and captures Training at spawn, mid-loop, and exit in addition to all Chapter 1 spawn/mid/end captures.

## Redesign guardrails

- Keep Level 1's route/tutorial simple, readable, and forgiving; preserve the three-floor progression and the stable marker IDs used by saves, encounters, and tests.
- Preserve objectives, enemy rosters, required Sigils, unique encounter gates, and all runtime entity IDs while refining geometry/decor.
- Do not add collision to a lane or boss arena without rechecking player/enemy reachability, patrol clearance, projectile sightlines, spike fairness, and encounter trigger paths.
- Use landmarks and low-density decoration to clarify direction and objective rooms; do not clutter the combat plane or obscure telegraphs.
- Author distinct room silhouettes and route cadence, not just a new title, palette, or random tile scatter.
- Validate every structural edit in Godot and inspect the resulting rendered artifact before calling that map redesigned.

## Evidence separation and completion contract

Godot 4.7 stable remains the required runtime. The authoritative checks are the exact commands in `.github/workflows/godot-runtime-validation.yml`, their per-test counts, the live collision reports, and the `godot-4.7-rendered-gameplay` artifact. Generator reproducibility, non-empty runtime maps, and explicit engine-error rejection prevent a green exit code from standing in for missing content.

The original-`main` comparator is intentionally separate: its campaign-entry and smoke failures are baseline evidence, not current-head regressions. Likewise, rendered PNGs are visual snapshots rather than proof of traversability or a full human playthrough. Completion for this redesign requires the current-head runtime jobs and all campaign/Training captures to pass together; earlier failures during the schema/Training bring-up must not be rewritten as passes.
