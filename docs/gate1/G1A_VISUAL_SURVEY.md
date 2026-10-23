# Gate 1 — G1-A physical survey and first composition direction

**Status:** initial baseline inspection complete; composition proposal, *not yet implemented*. Source: A's actual `data/levels/chapter_1_level_3.json` at `f27e8b7`, Gate 0 authored placements, B's `room.json` at `e7cad36`, and reviewed Godot runtime frames. Do not turn estimates below into geometry edits without checking actual collision and scene framing.

## Observed geometry, not an invented room

- A Level 3: **116 × 96 cells**; **3,351 Backdrop / 1,702 Geometry / 73 Decor**, **79 entities**. Verified player spawn `player_spawn` at **(280,216) px / cell (17,13)**.
- Near the entrance, key hazard/route markers include `l3_spikes_01=(520,200)`, `l3_spikes_02=(600,248)`, `l3_spikes_03=(744,344)`; torches `(184,184), (376,168), (584,184)`; coins `(376,200), (472,200)`. These are **immutable by default**.
- Study area survey should start about **cells x=5..43, y=7..26**, but the polygon cannot be rectangularly rewritten: there is complex wall/void interleaving, an onward corridor to the east and live spike hazards just beyond. Snapshot original occupancy before touching it.
- The north backdrop edge is only a few cells deep and repeatedly segmented by A's masonry. Gate 0's north presses lie at world `(296,176)`, `(440,176)`, `(504,176)`: **three 48×32 furnishings**, visually subordinate to the HUD banner.
- Gate 0's strong furniture is along the bottom at `long_table=(256,320)` (96×34) and `shelf_collapsed=(184,320)`; `rubble_large=(392,352)` was pushed east 8px in the latest focused fix. These may be rearranged only with an explicit collision and route plan.
- B's audition, in contrast, authored a **50 × 30** room, **66 props**, **9 wall items**, **19 local lights**, with 16px floor/face/caps/decals/water/stair artwork and the recognizable large **136×64 armarium_open** (per B's `props.json`). Gate 1 is **not** to import all 66 props or 19 lights; its benefit is architectural hierarchy.

## Visual inspection: before/after and B comparison

- B's genuine native `archive_room_end.png` has a dominant framed illuminated manuscript cabinet, coherent side alcoves, wall piers and a readable diagonal approach. Its `archive_room_overview.png` shows material zoning and purpose-driven props as one composition.
- Gate 0's latest `after_spawn.png` shows a few cabinets and desks among repeated gray masonry, large empty/void blocks and a broad tutorial bar. `after_destination.png` still shows the **upper part of the wall press obscured** by the real tutorial banner. Additional props alone won't fix it.
- Small stools and a lectern are legible only at close range. Spikes, torches, hero scaling and gray floor cadence still dominate the rhythm; new structure should **reduce**, not amplify, visual noise.
- B's wall-cap geometry and lighting must be assessed in the live game's existing depth order and tint; a separate audition capture does not establish compatibility.

## Suggested arrangement to prototype (creative freedom preserved)

1. **Arrival:** distinct damaged threshold with an immediately visible 1× archive cue at the Knight's true spawn/camera position, even with the tutorial overlay. The first 3 seconds must no longer read as a generic stone corridor. Keep the mechanics and current objective UI.
2. **Workshop:** consolidate disparate small desks and shelves into one architecturally credible work bay. Carve/restack only where the underlying geometry can support piers, floor and safe player movement; do not place a shelf beside an open void without framing it as damage.
3. **Manuscript landmark:** create a structurally credible recess/apse for **one large B armarium**, and put it in a real gameplay sightline that is *not behind the tutorial bar*. Examine two layout variants before choosing:
   - **Variant A — side-bay destination** branching briefly off the existing east-west passage; preserves the main hazard lane and allows a strong 1× focal vista.
   - **Variant B — recessed north archive wall** with locally changed wall thickness and a deliberately adjusted approach/camera composition.
   
   Choose based on physical support, entity clearance and what actually appears in a 1280×720 screen, not on the top-down map silhouette. Do not force a side-bay if it creates a meaningless dead end.
4. **Damage and evacuation:** keep exactly one legible collapse event with a clear cause and silhouette. Make rubble/water/beam support the narrative; the floor-door frame should be constructed, not visually engulfed.
5. **Transition:** make the exit from the work area into A's crossfire corridor explicit. Preserve the first spike telegraph and the functional combat space; do not permit big cabinets to mask SpectralDisc line-of-sight reads or dodge routes.

## Evidence required before layout approval

- Annotate a real A occupancy diagram showing the chosen zone boundary, HUD-occluded screen band, preserved entity anchors, walkable route in and out, and new cut/recess.
- Provide two first-frame screenshots at **the exact Knight spawn** for candidate layout A/B, with production HUD/lighting visible. Pick one design; no artificial text overlay to explain the archive identity.
- Do a 1:1 source-canvas vs game-canvas check on armarium, columns, corners, doors and floor transitions. Opaque tile joins must actually be continuous, not merely pass schema.
- Show a negative space plan: no arbitrary torches, banners, repeated bins or density stamping.
- If a playable geometry change is required, keep derived candidate JSON in `prototypes/gate1/`; **do not edit canonical data/** on this branch.

## Pending decision

**G1-A survey/provenance started**; Gate 1 implementation, native candidate screenshot and gameplay/CI tests **not yet done**. No merge/production approval is implied.