# Soul of Hero — Level 3 Archive Environment Redesign (Gate 1)

## Authority and intent

**Status:** design brief / execution gate prepared. This is a NEW experimental branch, not a production map change and not an accepted redesign.

The point of Gate 1 is to recover the visual quality of Candidate B's original Archive Room audition **inside the real playable Chapter 1 Level 3 from Candidate A**. Gate 0 proved B's atlas can be rendered with A's Knight/HUD/collision; its approach of arranging a few small props inside unchanged gray corridors does **not** achieve the artistic goal.

**Working branch:** `integration/level3-archive-redesign` (created from the accepted Gate 0 technical proof at `31a2ec7cf001fe057fb7d3c27ecf35de77553831`).
**Immobilized baseline:** `integration/gate0-archive-art` at `31a2ec7` and its verified native captures, especially evidence commit `f1b6e911b0b05430da691eb2d214c267658f48bb`.
**Candidate A map:** `f27e8b7fe03f33b2001b08579543e5010a0a1b9d`.
**Candidate B visual benchmark and original art:** `e7cad36f8f21e746abefe44ac6cfa54db9a378e6`, `prototypes/environment_art/archive_audition/`.

**Do not modify** either Arena branch, Gate 0 baseline branch, PR #4, main, accepted Level 2, other campaign maps, any combat code, game save/campaign unlocks or shared tests. Do not merge, deploy, create another PR or move PR #4.

## The observed artistic failure (reviewed from actual Godot frames)

1. B's audition has a convincing spatial composition: strong illuminated manuscript wall, intentional approach from a damaged entrance, distinct masonry/floor value zoning, believable integrated columns and furniture, and controlled local lighting. Its large central armarium is an immediately recognizable visual destination.
2. Gate 0 only places 15 small props (10 solids) on A's unchanged gray, repetitive masonry. The original central armarium is **missing**. The hero, existing 2× torch scale, repetitive floor, purple spikes and HUD dominate the camera instead of the archive.
3. A's large tutorial banner obscures the north press tops in the true 1280×720 gameplay frames. A superficial prop swap does not correct visual hierarchy.
4. The missing information is **architectural meaning and player journey**, not more decorative clutter. Treat this as environment redesign, not a density/polish pass.

References (real 1280×720 Godot output):
- B's architectural destination: `prototypes/environment_art/archive_audition/captures/archive_room_end.png` at `e7cad36`.
- B's full-room composition: `prototypes/environment_art/archive_audition/captures/archive_room_overview.png` at `e7cad36`.
- Gate 0 true-game comparison: `docs/gate0/evidence/comparison_spawn.png`, `comparison_destination.png`, and `after_spawn.png` at `f1b6e911`.
- Gate 0 source of truth: `tools/gate0/author_overlay.py`, `prototypes/gate0/overlay_level3_archive.json`, and `docs/gate0/INTEGRATION_REVIEW.md`.

## Prototype to build

Redesign **one contiguous playable archive entrance/environment zone** in A's existing Chapter 1 Level 3 (`Thư Khố Giao Hỏa`). Suggested survey region: roughly cells x=5..43, y=7..26, with an inspected transition band connecting to unchanged Level 3. The exact editable polygon is an authored decision; **do not** use these numbers blindly. Identify the existing player spawn, doors, entity art, traversable routes, sightlines and crossfire hazards before touching topology.

Gate 1 explicitly **permits prototype-only changes to floor, wall arrangement, architectural thickness, wall caps, minor room topology, material zoning and lighting** within the designated region. This permission exists precisely because the original narrow north wall (2–4 tiles) could not host B's 136×64 armarium and the Gate 0 result was artistically weak.

Design for three beats:

- **Arrival — breached archive, not another gray corridor:** an unmistakable damaged threshold with a readable contrast between stable construction and purposeful destruction. The first REAL gameplay camera frame must contain a visual cue such as legible manuscripts/workstation/shelves, not merely a featureless stone wall. Preserve the live tutorial HUD and evaluate with it ON.
- **Discovery/workspace:** create a real spatial hierarchy — believable writing area, circulation, shelves attached to construction and localized light/material contrast. Distinct subareas should have reasons to exist. Do not stamp a formulaic row of identical cabinets, banners, spikes or props.
- **Destination — one memorable archive composition:** recover the B audition's architectural emphasis on a substantial illuminated armarium or an equivalently coherent archive landmark. **Rebuild sufficient wall thickness or a real recess around it**, rather than hanging deep-wall art on a flat wall or placing it over open void. Ensure it is visible below gameplay HUD and framed by actual approach/sightlines. It must not obstruct the intended gameplay onward route.

The composition should read as a **damaged monastic archive**, and its danger, abandonment and evacuation should be explained by the architecture and object placement. Do not imitate B's isolated 50×30 room by simply pasting it into A's map.

## Implementation architecture

- Keep this work **experimental and reversible**. Prefer `prototypes/gate1/`, `tools/gate1/`, `docs/gate1/` and `.github/workflows/gate1-archive-redesign.yml` while exploring.
- Preserve the original canonical `data/levels/chapter_1_level_3.json`, `game/**`, `tests/**`, and `project.godot` in Git. Author a *derived, deterministic, separate trial Level 3 document* from Candidate A's pinned map; materialize it to the canonical path **only inside ephemeral CI runners** for accurate production-scene tests. Do not overwrite campaign source in this branch.
- A's canonical schema has Backdrop/Geometry/Decor and accepts tile sources 0/1. B's original room uses custom floor, face, caps, water, stairs, decals and light layers. Use a **prototype-only GDScript adapter** for custom visual layers/props and keep collision synchronized with the derived trial geometry. Avoid introducing unsupported tile-source IDs into campaign JSON.
- Copy B's original tiles, wall-caps and required art/lighting provenance (at B pinned SHA), checksum them, and make an explicit mapping of visual material to in-game location. Retain whole-sprite multi-tile compositions. Do not rebuild bookshelves out of grates, sewer arrows, holes or thin masonry pretending to be cabinets.
- Reuse the REAL `game/main.tscn`, Knight camera, enemy rendering, HUD, entity placement, hazards and interactions. Never use a standalone audition room as proof of successful Level 3 integration.
- Audit `reload_from_disk` behavior, number of level entities and overlay bookkeeping. Prototype additions must not be counted as campaign entities, interfere with objectives, create duplicate heroes/HUD or alter save behavior.
- Match B's deliberate lighting and material zoning as closely as practical, but do not paste all 19 audition lights. Prevent HUD/readability conflicts and preserve the game's palette/visual scale. If local renderer limitations are material, disclose them.

## Gameplay and regression invariants

- Retain all original 79 entity **IDs and types**, required sigil/reward contracts, encounter semantics and exit destination. If a critical entity within the prototype polygon must move, list exact old/new positions and prove function in Godot; do not silently delete or replace it.
- Preserve Level 3's valid route to subsequent areas, reachable gameplay/objective anchors and SkeletonReaper crossfire identity. No new solid art may overlap a Knight body, hazard, interactable or meaningful combat dodge lane.
- Keep the remainder of Level 3 beyond the chosen transition zone unchanged. Level 2 and other levels must remain byte-identical.
- Technical validations must include deterministic authoring, schema, geometry/collision, objectives, actual Knight navigation (no teleports as movement proof), and focused combat occlusion/playtest. An assertion counter alone can never count as visual acceptance.

## Mandatory native visual evidence

Run on Godot 4.7 (not PIL, static composites or an unmodified standalone B scene). Capture BEFORE vs AFTER at the **same real playable locations**, 1280×720 with real HUD and live Knight:

1. **Spawn/first 3 seconds** — player identifies an archive even with tutorial banner.
2. **Discovery/workspace** — one readable work area and believable wall/furniture relationships.
3. **Armarium/destination** — strong focal point and correct multi-tile construction, not covered by HUD.
4. **Transition to combat** — hazard telegraphing and open dodge/sightline remain usable.
5. **4× nearest-neighbor detail pairs** of wall joints, major furniture, door, lighting and rubble threshold.
6. **Before/after player-walk route trace** plus collision and entity ledger.

Commit screenshots and logs under `docs/gate1/evidence/` so they survive ephemeral runners. Include a single honest visual defect register of unresolved issues. The reviewer must independently inspect the actual pixels.

## Acceptance criteria / stopping rules

**Visual must improve substantially beyond Gate 0**, approaching or exceeding the original B audition's coherence; a technically passing overlay with unchanged gray corridors is a FAIL. The test must exhibit:

- recognizable damaged archive on arrival and a memorable architectural destination;
- believable structural connections: no chopped walls, floating armaria/doorways, black transparency slits, cropped multi-tile sprites or mismatched scale;
- purposeful changes to room proportions/materials/lighting/approach, not formulaic additional props;
- functional traversal, readable combat, intact objectives, no baseline regressions.

Use a 100-point independent review: architectural/environmental identity **30**, wall/floor/asset assembly **25**, camera/framing/experience **20**, environmental storytelling/prop purpose **15**, reproducible Godot/gameplay evidence **10**. Require **≥85/100** and no major visual failure. Do not self-certify production readiness.

### Checkpoints (push each BEFORE moving on)

- **G1-A** Source pins, visual survey and 1-page composition plan (including baseline screenshot annotations). No implementation yet.
- **G1-B** Experimental derived geometry/floor and B architectural material import, with preview screenshots and entity/route ledger.
- **G1-C** Prototype runtime integration (real game), Godot 4.7 captures + focused collision/traversal tests.
- **G1-D** Independent-ready evidence committed to GitHub with before/after comparison, candid defect register and concise handoff.

Stop after G1-D; **do not merge or deploy**. Clearly distinguish successful technical execution from production visual approval.

## Notes on custody

This document is the source of truth for the NEXT experiment. The prior Gate 0 branch remains the rollback target and should never be mutated as part of Gate 1. Art acceptance and wider campaign integration are separate follow-up decisions, not implicit permissions.
