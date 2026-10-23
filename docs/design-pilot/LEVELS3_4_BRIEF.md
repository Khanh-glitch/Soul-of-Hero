# Soul of Hero — Candidate A · Pilot Levels 3–4

**Stage:** conditional second-stage design pilot, **not** permission to redesign the whole chapter.
**Base revision:** `2903a305c610fc547581cc82268f3b7e37e8e75a` (candidate A Level 2 audition, PR #4).
**Branch:** `design-pilot/levels3-4-candidate-a`
**Scope:** `data/levels/chapter_1_level_3.json`, `data/levels/chapter_1_level_4.json`, *only* their necessary generation/authoring sources and focused pilot documentation/QA.
**Source of truth:** real LevelSchema v2, current 16-px atlases, `docs/LEVEL_DESIGN.md`, `docs/design-audition/LEVEL2_CHALLENGE.md`, runtime production scene, canonical objective contracts.
**Non-scope:** `main`, deployed Web/integration branch, Levels 1–2 or 5–10, SaveService, Knight/Combat, Hero Soul progression, and unrelated schema/test rewrites.

## Goal: prove design transfer, not just a second cathedral

Level 2 demonstrates architectural landmarks and restrained encounter composition. Prove you can **deliberately switch spatial language** across two very different missions instead of stamping Level 2's switchback/cathedral template onto both. The maps should be readable from the live player camera, not only impressive in footprint charts.

### Level 3 — Crossfire Archive / Thư Khố Giao Hỏa

- **Pinned baseline:** 116×84 tiles, 5,004 Backdrop, 1,104 Geometry, 29 Decor, **77 entities**.
- Existing types: 1 player, 15 Skeleton, 5 Skeleton Reaper, 4 floor doors, 5 Sigils (**4 required**), 2 checkpoints, 1 exit, 2 chests, 18 spikes, 12 torches, 12 coins.
- **11 canonical room IDs** and 3 camps (`l3_camp_1_far_anchors`, `l3_camp_2_pincer_fire`, `l3_camp_3_split_lane`).
- **Design identity:** an ancient archive with meaningful visibility lanes, blocked sightlines, shelves/pillars as **real colliding cover**, and a readable flank-vs-direct-fire route choice. Let the player bait Reapers, dodge/reposition and interrupt pressured sightlines. Make three floors function as a deliberate pressure curve: scout / crossfire / tactical resolution.
- **Test what is actually implemented:** if the current Reaper does not use line-of-sight occlusion, explicitly disclose that. Design cover and movement honestly; do not claim mechanics the engine lacks. Do not alter enemy AI just to implement imagined features.
- Preserve the known mid capture anchor `l3_f2_ring` and end `l3_f3_exit` even if their shapes change.

### Level 4 — Spiral Reliquary / Bảo Khố Xoắn Ốc

- **Pinned baseline:** 116×84, 4,582 Backdrop, 1,154 Geometry, 24 Decor, **74 entities**.
- Existing types: 1 player, 10 Skeleton, 5 Skeleton Reaper, 4 floor doors, 4 Sigils (**all 4 required**), 2 checkpoints, 1 exit, 2 chests, 21 spikes, 12 torches, 12 coins.
- **9 canonical room IDs** and 3 camps (`l4_camp_1_spiral_release`, `l4_camp_2_elite_pin`, `l4_camp_3_broken_cross`).
- **Design identity:** genuinely navigable spiral/radial progression through a reliquary — alternate compression and release, readable trap anticipation, clear safe route(s), and a visible central landmark that changes meaning as the player loops back. All 21 authored spikes should create **fair, purposeful** pressure, not wallpaper or unavoidable chip damage.
- A loop must produce a discoverable shortcut or changing viewpoint; do not construct a single exhausting thin corridor. Preserve `l4_f2_relay_ring` and `l4_f3_exit` for real captures.

## Technical contract — no substitution

1. Every original authored entity ID and **type** must survive. Same boss/reaper/sigil/floor-door/chest semantics, all reward payloads and genuine pickup interactions; include a before/after inventory of changed positions. Extras require explicit justification and remain nonblocking unless independently tested.
2. Keep 3-floor reciprocal transitions (4 doors), required sigil counts (L3=4/5; L4=4/4), camp membership and legacy room/camp IDs as well as checkpoint/exit reachability.
3. Actual Godot 4.7: Knight-sized collision-clear routes, trap-avoidant required objectives, player/enemy clearance, real action/encounter render; no missing resources, disconnected regions, walls under spawn/loot, or camera bleed between floors.
4. Existing Level 2 **must not change**, including its reproducible generator; Level 1 and Level 5 **must not drift** if generator is run. Use separate deterministic authoring builders for Levels 3 and 4, or explain and prove an equally safe stable generation workflow.
5. Prefer compact, content-rich, camera-readable worlds. As a review trigger, if either new floor area exceeds ~140% of its prior floor cell count, justify the density/route length with visual and spatial evidence. Do not optimize for maximum number of rewritten JSON lines.
6. No weakening of existing tests, omitting failures or calling generated screenshots “human playtest”. A passing gate is not proof of fun.

## Delivery and review sequence

**Stage 0 — Concept before implementation:** `docs/design-pilot/LEVELS3_4_CONCEPT.md` with two distinct three-floor traversal diagrams; landmarks, enemy pressure and breathing room, risk/reward, expected camera framing; clear differences both from baseline and **from Level 2**. Assess actual asset/AI limitations honestly.

**Stage 1 — Level 3 implemented and self-reviewed:** update Level 3 & generator only; pinned-baseline entity + footprint diff; exact Godot geometry/collision; three production gameplay screenshots `spawn/mid/end` at 1280×720; brief critique of clipped or cluttered combat views. Stop if failed. Do not proceed to Level 4 until Level 3 is green and visibly different.

**Stage 2 — Level 4 implemented and self-reviewed:** same evidence for Level 4 plus rerun Level 2 generator parity/regression. No gameplay runtime files modified.

**Stage 3 — Independent reviewer decision:** publish a compact gallery of **both** Level 3 and 4: before/after floor maps at same scale, 3 paired real Godot captures per level, route length/encounter notes, core test results and exact commit. PR stays Draft until external evaluation.

**Acceptance:** Each level must separately score **at least 80/100** (spatial identity 30, encounter 20, visual legibility 20, exploration/pacing 15, implementation 15) **and** satisfy the technical hard gates. Distinctive design, not assertion volume, is decisive.

**Time/iteration budget:** One substantive implementation per level; max **one focused correction** per level. Do not spend multiple cycles making a failing design superficially pass by writing larger reports/tests. If results are weak or cannot be evidenced, say so and stop.

**No deployment to public Web playtest and no merge to main.** Preserve the approved Level 2 version for later integration only after independent design review.
