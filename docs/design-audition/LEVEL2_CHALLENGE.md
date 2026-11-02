# Soul of Hero — Level 2 Design Audition (identical brief for A and B)

**Audience:** autonomous AI candidate for the position of **Level Designer**, not just QA engineer.
**Source baseline:** `1c21a49c2eb3775c4b421dab86d057c7256f5964`
**Target content:** `data/levels/chapter_1_level_2.json`
**Required Godot:** official **4.7 stable**. No changes to `main`, `integration/chapter1-2-hero-web-playtest`, the Arena or Hero branches.
**Evaluation:** candidate A and B receive this **exact same challenge**. Do not copy or inspect the other candidate's branch.

## Why we are replacing the previous process

The prior map agent achieved extensive technical tests while leaving several Chapter 1 map files essentially unchanged. The desired deliverable is a *different, legible, enjoyable place*, not merely a schema-valid dungeon. The previous instruction in `docs/CHAPTER_1_MAP_AUDIT.md` to preserve old silhouettes **does not apply to this audition**. You are explicitly commissioned to **change the level's spatial grammar and floor silhouettes** while preserving mission/game contracts below. Technical test coverage is necessary but insufficient.

## Existing Level 2 — hard facts from pinned baseline

- `Ngã Ba Cốt Trắng` / **Ossuary Fork**; top-down LevelSchema v2, 16-pixel tile grid, **112×80 cells**.
- Layers: `Backdrop` 4,460 tiles, `Geometry` 1,134 tiles, `Decor` 25 tiles. These are baseline counts, **not required final counts**.
- **64 authored entities**: player 1, Skeleton 15, floor_door 4 (two reciprocal pairs), Sigil 4, checkpoint 2, exit_gate 1, chest 2, spikes 15, torch 10, coin 10.
- `metadata.rooms` 13 anchors; `metadata.combat_camps` 3; `metadata.required_sigils` 3, `layout_profile=three_floor_fork_and_recombine`.
- Use the *actual* JSON, `docs/LEVEL_DESIGN.md`, `game/levels/level_schema.gd`, `game/main.gd` and production capture harness as your source of truth. Do not imagine missing assets or fabricate game systems.

## Design objective

Design an evocative ossuary whose layout itself tells the story: the player sees **two genuinely different ways** through a dangerous site, understands why choosing either is meaningful, and converges at a memorable final encounter. There must be actual route choice, not two identical corridors with different enemies.

- **Floor 1 — Intrigue / readable choice:** orient the player using a landmark and expose high-risk/high-reward vs exploratory/tactical routes. Leave room for combat telegraphs and for movement.
- **Floor 2 — Spatial payoff:** make geometry, line-of-sight, cover, trap lanes and traversal express the earlier route choice, with purposeful pacing and a safe recovery beat.
- **Floor 3 — Convergence:** recombine the routes into one distinctive culminating arena and intentional exit approach. Reward discovery; don't hide the exit behind unrelated cleanup.
- Visual identity: legible tomb architecture, a memorable focal structure per floor, sensible light/torch rhythm, negative space and prop placement. Avoid homogeneous rectangles, filler corridors, mirrored copy-paste, noisy debris fields and enemy piles in spawn.
- The three floors should NOT use the previous repeated left-entry → central-room → right-wing formula. You may adjust map dimensions and room geometry if schema and runtime contracts allow.
- Use **existing licensed project assets**, actual tile atlas coordinates and authored entity types; no speculative texture references. `Decor` and non-colliding torch/props must enhance rather than obscure combat silhouettes.

## Non-negotiable gameplay/integration contracts

1. Every one of the **64 original entity IDs** survives with its original **type**; you may REPOSITION them thoughtfully, but do not delete monsters, hazards, Sigils, the physical chest/loot, checkpoint, floor-door pairs or exit gate. Added entities are allowed only if supported by schema/runtime, unique IDs and explicit justification, and must be listed separately.
2. Preserve the existing objective semantics (required 3 Sigils; 4 authored Sigils), inventory/reward provenance, campaign entry/completion, two reciprocal floor-door pairs and the correct completion exit. Existing room anchor IDs consumed by objective tests and spawn/mid/end captures must remain resolvable. The location/shape of a room anchor may change.
3. Keep progression, Hero Soul/Archer unlock rules, SaveService and combat contracts unchanged. Never change unrelated script/test assertions merely to pass CI.
4. `Backdrop` = playable floor, `Geometry` = real solid 16px obstruction, `Decor` = nonblocking imagery. No enemy, chest, trap, pickup, transition or player origin in walls/void. Ensure Knight collision clearance, enemy motion, dodge width and fair telegraphs.
5. If a generator is the actual authoring authority for Level 2, modify generator and output **reproducibly**. If the map is hand authored, document why generator sync is inapplicable. Never let a regeneration silently erase the redesign.
6. No changes outside Level 2, its necessary generator, audition-specific notes/tests/artifacts unless you first justify a required integration dependency. **Do not modify the deployed Web Playtest branch**.

## Deliverables — visual proof first, engineering proof second

**Gate 0 — Concept (before rewriting thousands of tile entries):**
Submit `docs/design-audition/LEVEL2_CONCEPT.md`: annotated diagram of the three-floor traversal graph (ASCII, Mermaid, SVG or another static view); two meaningful route decisions; combat/pressure/rest pacing; landmarks, visual palette and exact use of current assets; risks to the legacy objectives. Explain how this differs from baseline. The concept must remain your own—this document offers intent, not a layout to trace.

**Gate 1 — Executed prototype:**
Implement complete Level 2 layout in its JSON (and generator if applicable), preserving real population. Include `docs/design-audition/LEVEL2_DELIVERY.md` with rationale, changed route graph and list of original/new entity IDs. Run `python3 tools/design/level2_audition_audit.py` (baseline/diff integrity) and targeted Godot 4.7 validations. Include exact commit SHA and CI run link.

**Gate 2 — Actual production images and review:**
Export **before/after full-map floor footprints at identical scale** with labeled branches and rooms, plus at least **three real Godot 1280×720 gameplay captures** (spawn, mid, end) using the existing `tests/chapter_1_campaign_level_visual_capture.tscn` (not JSON thumbnails pretending to be real gameplay). Provide side-by-side same-camera comparisons when possible. At least one captured encounter frame must include live enemies, hazards and loot/exit where applicable. Identify any visual clipping, top-down perspective or asset limitation.

**Gate 3 — Functional proof:**
Run actual Godot 4.7 Level 2 schema/geometry, floor-door/objective reachability and Knight-sized live collision route gates. No unresolved errors or mocked entities. Explain measured route lengths, branch risk/reward and player-oriented 90–180-second pacing hypotheses; distinguish hypotheses from observed timings.

## Audition economy and stop rules

- **One substantive build + at most one targeted revision.** Do not burn cycles debugging baseline failures from unrelated `main` branch tests or adding 1,000 assertions to compensate for weak design.
- Use selective CI and captured images. Do not run the 60-minute comprehensive suite on every tiny tile change.
- No claim of design completion without before/after image evidence. No claim of full playthrough without actual input/path observation.
- If the candidate cannot produce a substantially differentiated, visually coherent, genuinely traversable prototype using current assets, say so plainly. Do not fill the gap with more prose or fabricated screenshots.

## Scoring / candidate acceptance

**Design (100):** spatial identity & distinct layout 30; encounter/combat-space readability 20; visual composition 20; exploration/pacing 15; quality/feasibility of implementation 15.

**Pass threshold:** >=80/100 *after independent visual review* PLUS all hard technical gates above. A technically green but visually indistinguishable dungeon is an audition failure. Technical integrity is not itself a design score.

**Reviewer:** compare candidate A and B without revealing identity, on the same camera, same content and same technical criteria. No edits to the baseline or production Pages preview during audition.

## Local useful commands

```bash
python3 tools/design/level2_audition_audit.py
godot --headless --editor --path . --import --quit
godot --headless --path . --script res://tests/chapter_1_campaign_map_design_test.gd
godot --headless --path . res://tests/chapter_1_collision_route_test.tscn
```

The candidate branch also contains a focused `Level 2 Audition QA` Actions workflow which stores three Godot production captures in its own artifact. Manual reviewer assesses the images rather than counting them as visual success merely because PNGs exist.
