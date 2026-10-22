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
| 6 | Soul Anchor Relay | Three guarded Anchor clusters and optional two-way Sword/Archer Relay practice |
| 7 | Failing Beacon | Four-lane open defense arena, real Beacon threat, and three escalating waves |
| 8 | Divided Reliquary | A physical, exclusive branch choice with a manually claimed reward |
| 9 | Crimson Gate | Three physical seals gate a named Elite showdown |
| 10 | Castellan Throne | Safe checkpoint approach and a readable two-phase boss arena |

## Structural observations

The first Godot 4.7 campaign-wide geometry run confirmed unique profiles and distinct floor silhouettes, reciprocal floor-door connectivity, spike-safe objective reachability, and dodge clearance. It also caught five Level 10 markers (three torches and two coin pickups) placed outside the walkable floor; their stable entity IDs were preserved while the markers were moved onto adjacent playable cells. All authored entities and floor-door destinations are now required to land on walkable floor. The follow-up Godot 4.7 run passed the corrected geometry gate and captured all ten production Chapter 1 scenes after the correction. These structural facts and nonblank captures are not substitutes for a full human playthrough or manual screenshot review.

The externally reviewed Godot captures confirm that Levels 1–6 are not merely sharing a safe opening: the full maps repeat a three-band left-entry → central chamber → right-wing grammar. Independent floor-mask comparison agrees: Levels 5 and 6 have a 0.761 Jaccard overlap, Levels 3 and 4 have 0.697, and Levels 2 and 3 have 0.579. The roles and interior hazards differ, but the whole-map route composition is too similar; the strongest redesign priority is Level 6 versus Level 5, followed by changing the room cadence of Levels 2–4 without losing their fork, crossfire, and spiral contracts. Level 1 remains the deliberate tutorial baseline.

Level 7's large open rectangle is intentional for defense readability; its lanes need clear visual cues, not extra collision that blocks the Beacon or enemy routes. Levels 8–10 have differentiated branch, three-seal, and throne-arena silhouettes. The reported Level 8–9 enemy-label/health/effect clutter still needs to be reassessed in production-route captures before any shared UI change; move or stagger level-specific content only if a real in-game route reproduces it.

The previous campaign screenshot harness instantiated `Main` directly with no AppFlow run. That made the tutorial's documented empty-run editor/test fallback visible in unrelated slots and did not validate campaign setup. The capture harness now unlocks through an isolated SaveService fixture and launches each map through the real AppRoot/AppFlow campaign gate; it captures spawn, a named mid-level room, and the representative end room for every slot. The orange Level 1 tutorial is intentionally driven by confirmed play events, not elapsed time: the existing learning test verifies that normal movement, Dash, four confirmed Sword hits, and a confirmed Sword Soul Echo complete and persist all seven lessons, after which the panel hides. It can remain during a fresh Level 1 run until those actions have actually been learned.

The sandbox catalog is correctly marked `SANDBOX` and stays outside campaign slots, but `crypt_entrance_sandbox` currently reuses `crypt_entrance.json`, the Level 1 campaign map, while its registered five-Skeleton encounter is documented as data-only rather than the live objective authority. The campaign-map route gate does not turn that encounter stub into a playable sandbox. Keep this mismatch visible as an open training-scope item; decide whether the shared crypt is an intentional tutorial practice space or should receive a separate, genuinely free-practice layout/encounter before declaring the training/sandbox scope done.

## Validation gates added for the redesign pass

1. `tests/chapter_1_campaign_map_design_test.gd` checks all ten map files for schema, bounds, unique entity IDs, authored room/profile identity, walkability, door connectivity, hazard dodge space, objective reachability, and pairwise silhouette difference.
2. Existing `tests/chapter_1_map_design_test.gd` keeps its deeper three-floor camp, roster, trap, and runtime-loader checks for slots 1–5.
3. `tests/chapter_1_campaign_level_visual_capture.gd` captures each route through the production `AppRoot`/`AppFlow` campaign entry at 1280×720 for spawn, named mid-level, and representative end rooms. PNGs and per-capture logs are retained in CI; they are snapshots, not traversability proof.
4. `tests/chapter_1_collision_route_test.gd` instantiates every production map under Godot, queries real `Geometry` physics with a Knight-sized clearance shape, avoids authored spikes, traverses reciprocal floor-door teleports, and checks objectives/doors/endpoints.
5. Existing Level 5–10 objective/runtime gates remain authoritative for miniboss recruitment, Soul Anchors, Beacon defense, Reliquary branching, Crimson Gate, and the Castellan. The Godot 4.7 workflow now runs the focused Level 6–10 route/runtime/fresh-save gates plus sandbox content and tutorial learning checks.

## Redesign guardrails

- Keep Level 1's route/tutorial simple, readable, and forgiving; preserve the three-floor progression and the stable marker IDs used by saves, encounters, and tests.
- Preserve objectives, enemy rosters, required Sigils, unique encounter gates, and all runtime entity IDs while refining geometry/decor.
- Do not add collision to a lane or boss arena without rechecking player/enemy reachability, patrol clearance, projectile sightlines, spike fairness, and encounter trigger paths.
- Use landmarks and low-density decoration to clarify direction and objective rooms; do not clutter the combat plane or obscure telegraphs.
- Author distinct room silhouettes and route cadence, not just a new title, palette, or random tile scatter.
- Validate every structural edit in Godot and inspect the resulting rendered artifact before calling that map redesigned.

## Latest CI evidence

GitHub Actions run [39800500658](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39800500658) used Godot 4.7 stable at head `04365155`. Current-head Chapter 1 geometry, Chapter 2 map/entry checks, production gameplay smoke, combat regression checks, and all ten initial Chapter 1 captures succeeded. The workflow is marked failed by its separate original-`main` comparator, whose campaign-entry and smoke checks fail on the baseline; those are not failures on the current head. The user externally reviewed the rendered `godot-4.7-rendered-gameplay` artifact and supplied the findings recorded above. Those captures are spawn-camera snapshots only and do not prove traversability or complete gameplay.
