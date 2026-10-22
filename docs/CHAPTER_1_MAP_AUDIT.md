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

The first Godot 4.7 campaign-wide geometry run confirmed unique profiles and distinct floor silhouettes, reciprocal floor-door connectivity, spike-safe objective reachability, and dodge clearance. It also caught five Level 10 markers (three torches and two coin pickups) placed outside the walkable floor; their stable entity IDs were preserved while the markers were moved onto adjacent playable cells. All authored entities and floor-door destinations are now required to land on walkable floor. The first Xvfb render run captured all ten production Chapter 1 scenes successfully; rerun both gates after the Level 10 placement correction. These structural facts and nonblank captures are not substitutes for a full human playthrough.

The six three-floor entries provide useful onboarding and progression, but their shared stacked-floor grammar risks repetition. The redesign pass should preserve each map's objective and identity while varying room cadence, intermediate landmarks, and safe/pressure transitions. Level 7's large open rectangle is intentional for defense readability; its lanes need clear visual cues, not extra collision that blocks the Beacon or enemy routes. Levels 8–10 already have strongly differentiated branch, three-wing, and throne-arena silhouettes; change them only where the production capture or runtime routes expose an actual flaw.

## Validation gates added for the redesign pass

1. `tests/chapter_1_campaign_map_design_test.gd` checks all ten map files for schema, bounds, unique entity IDs, authored room/profile identity, walkability, door connectivity, hazard dodge space, objective reachability, and pairwise silhouette difference.
2. Existing `tests/chapter_1_map_design_test.gd` keeps its deeper three-floor camp, roster, trap, and runtime-loader checks for slots 1–5.
3. `tests/chapter_1_campaign_level_visual_capture.gd` captures the actual production `Main` scene at a 1280×720 viewport for slots 1–10 under Godot 4.7/Xvfb. The PNGs and per-slot logs are retained as CI artifacts. Capture success proves a rendered, nonblank scene and exact layer application; it does not by itself replace human gameplay review.
4. Existing Level 5–10 objective/runtime gates remain authoritative for miniboss recruitment, Soul Anchors, Beacon defense, Reliquary branching, Crimson Gate, and the Castellan.

## Redesign guardrails

- Keep Level 1's route/tutorial simple, readable, and forgiving; preserve the three-floor progression and the stable marker IDs used by saves, encounters, and tests.
- Preserve objectives, enemy rosters, required Sigils, unique encounter gates, and all runtime entity IDs while refining geometry/decor.
- Do not add collision to a lane or boss arena without rechecking player/enemy reachability, patrol clearance, projectile sightlines, spike fairness, and encounter trigger paths.
- Use landmarks and low-density decoration to clarify direction and objective rooms; do not clutter the combat plane or obscure telegraphs.
- Author distinct room silhouettes and route cadence, not just a new title, palette, or random tile scatter.
- Validate every structural edit in Godot and inspect the resulting rendered artifact before calling that map redesigned.
