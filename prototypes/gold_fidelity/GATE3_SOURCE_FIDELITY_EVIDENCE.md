# Gate 3 — Gold Hairline Rupture #01 source-component fidelity

Date: 2026-10-27
Status: **GATE 3 SOURCE-COMPONENT TESTS PASS; COMPLETE SKILL STILL BLOCKED**

## Gold authority and source provenance
The user-provided `top-down-sword-vfx-laboratory.zip` controls ALL visuals and behavior. The source files are `src/skills/skills1.ts` and `src/engine/{ground,world,shaders,gl}.ts`. Original seeded execution was instrumented read-only to capture factory parameters and actual ground operations. The golden renderer was unmodified except TypeScript transpilation and diagnostic removal of non-tested layers.

Original frame and object coordinates: 480x270 source pixels. The actor/particles/ribbons were deliberately removed from BOTH reference and native images for an apples-to-apples **component** comparison. This is not a full-skill visual parity claim.

## Source-derived components on this branch
- `gold_hairline_plate_factory.gd`: ALL 14 exact randomly-generated pressure-sheet source descriptors for the fixed reference seed. The source `easeOut` cubic and individual delays/height/skew are executed dynamically. Random variation across multiple casts is NOT implemented yet.
- `hairline_plate.gdshader`: Shader formula port of actual GLSL plate style 0 / AIR palette. Voronoi cells, threshold, Bayer dither, mask 0/2, red fissures. Geometry uses native 2D triangles with explicit UVs; never the discarded hand-drawn approximation.
- `hairline_source_floor.gd`: original flagstone courtyard procedural RGBA source-generation code.
- `hairline_ground.gd`: original RGBA groove, recursive branched crack and rubble writes with source LCG and Uint8ClampedArray rounding. Changes source pixel data, not physics collision.
- `segment_math.gd` / `gold_post.gdshader`: previously verified source post-displacement.
- `hairline_source_components_lab.tscn`: Godot native composition of the above components, with fixed-step seek controls. It is a presentation-only scene in `prototypes/`, not a replacement combat implementation.

## Evidence

Latest composed-scene CI run: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40499431613 — successful native Godot 4.7 import, source geometry contract, exact floor SHA, all 28 ground writes byte-wise, 14-sheet shader native rendering, and 2 native composite screen captures.

- Exact original gold floor at 480x270 (518,400 RGBA bytes), SHA256 `92e4c6668b0383bb21b69e23807f4e4f88300cbdd246c5f5543abc2998499af7`: byte-identical.
- Pure dynamic ground operations against **same** 40/44/56/255 input: both TS gold and GDScript pass identical SHA256 at 0, 1, 2, 14, and 28 mutations. This proves the full 28-operation buffer transformation for the fixture.
- 56 native sheet-geometry vertices compare to original gold source at 1.46667s within 0.002 source pixels. The offline reference geometry reproduced across 8 source times as well.
- Mask of only 14 pressure sheets at 1.46667s: gold/native IoU **0.9976286**.
- Composed gold floor + 14 sheets + segment warp at 1.46667s: gold/native lit-mask IoU **0.9989166**, mean absolute per RGB channel across image **0.2538/255**. A small number of divergent edge pixels remain.
- Composed gold ground after crack/rubble operation at 2.7s: gold/native lit-mask IoU **0.9989127**, mean RGB error **0.1907/255**, maximum per-channel error **1/255**, 0 pixels with channel difference >5.
- These are CPU/software OpenGL reference comparisons, NOT gameplay, 4K or hardware-GPU performance benchmarks.

## Rejected and missing
The old `prototypes/vfx_lab/native_lab.*` redrawing remains a rejected **technical sandbox**, never gold VFX artwork.

**MISSING FOR COMPLETE GOLD SKILL**: exact live silver-red ribbon sampling, hero sword and afterimages, pressure spark ignition, all scheduled chunks/shards/smoke/rings/light flashes, enemy contact/animation reaction, gold camera shake/hit-stop, pause/cancel, actor world-space transforms, masking by real terrain, true ability-to-combat wiring and frame-by-frame whole-skill acceptance. Source's terrain cut is a visual framebuffer/cosmetic alteration; gold does not change level collision. Production world adapter must preserve the original looks/behavior without destroying authored TileMap.

## Isolation
Only `prototypes/`, `docs/vfx/`, and isolated CI workflows modified. No `game/`, `assets/`, `data/`, map scene or `project.godot` modifications. Not merged to main. **Do not declare the ability production-ready**.
