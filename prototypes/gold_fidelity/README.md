# Gold-fidelity port / Hairline Rupture #01

**Status: partial source-derived renderer component, NOT complete 1:1 skill. Do not merge.**

Gold input: the user-supplied `top-down-sword-vfx-laboratory.zip`, skill in `src/skills/skills1.ts`. All source-hash manifests, standalone ORIGINAL-WebGL reference, 15 reproducible gold captures and full differential report live in the companion handoff archive `SOH_Hairline_Rupture_GOLD_Gate2.zip` (delivered separately in ChatGPT). The gold source files are not copied wholesale into the public game repository.

Confirmed original architecture: 480x270 logical world, seven scene layers, 60Hz fixed simulation, shader postwarp after all scene layers. The apparent terrain tear is a combination of **pixel-space ground buffer groove/crack/rubble writes**, segment post-displacement, 14 distinct animated pressure sheets and later propagating impact/shards/smoke, not a changed TileMap collision grid.

## What is actually ported and proven

- `segment_math.gd`: equation-for-equation translation of `SegFx` envelope plus signed, oscillating distance-to-segment displacement. Source S01 anchor (104,141)-(356,141); width 14, strength 1.8, 2s life, hold 0.8.
- `gold_post.gdshader`: translated `POST_FRAG`, including segment, ring, haze, Bayer lighting quantization, shake, flash and vignette. OpenGL framebuffer origin is explicitly adapted to Godot top-left UV. Requires a **480x270 native rendering surface** with nearest filtering.
- `tests/segment_math_smoke.gd` and `tests/gold_shader_smoke.gd`: Godot 4.7 tests, software-rendered images uploaded by CI.

[Native source-math and shader evidence CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40493574115): **PASS** at commit a3360fdf. On an identical grid stimulus, original WebGL and Godot shader each move 1,707 pixels by RGB >5; RGB maximum difference between their output images is 1/255 per channel (test baseline and warp). This proves the isolated shader translation under the exact fixture only; it does NOT prove the full 21-skill bundle, scene compatibility, actual terrain handling, source pixel parity in combat or 2K/4K rendering.

## Remaining required before any skill can be called "ported"

1. Actual original skill's dynamic ribbon and hero trail (including shimmer and fade/cut) with sprite matching.
2. Fourteen separately seeded quads with the original plate GLSL Voronoi fracture and geometry evolution (not simple polygons).
3. Ground CPU memory buffer `groove/crack/rubble` bound to the local game environment and persistent cosmetic traces.
4. Scheduled outward rupture around target x300, original spark/shard/chunk/smoke/light/contact sequencer; true enemy anchors and lifecycle.
5. Compare synchronized **gold vs Godot** frames across the whole 7s sequence and motion under camera/target changes; quantify difference; verify clipping, load and quality scales.

Previous `prototypes/vfx_lab/native_lab.*` was a **rejected visual approximation**; never use it as a fidelity reference or import it as the finished skill. Source of truth is the original WebGL renderer and original code.

Work remains isolated in `prototypes/gold_fidelity/`, with no gameplay, map, `project.godot` or `assets/` changes. Do not write game damage or force map TileMap edits while porting graphics. Ground tears in gold are rendered visual changes, not persistent collision destruction.
