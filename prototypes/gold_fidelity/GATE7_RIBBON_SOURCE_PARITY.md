# Gate 7: source Gold S01 ribbon parity and shared camera/time math

**2026-10-27 / Soul of Hero / VFX-only branch**

## Definitive source of truth
The user-supplied `top-down-sword-vfx-laboratory.zip` is the source. Original modules:
- `src/engine/world.ts`: `Ribbon.draw()`, `World.trail()`, `World.move()`, `World.updateCam()`, `World.update()`.
- `src/engine/shaders.ts`: `FRAG.ribbon()` and `POST_FRAG`.
- `src/skills/skills1.ts`: `s01.run`, Hairline Rupture.

Do NOT use the older hand-drawn `prototypes/vfx_lab/native_lab.tscn` as fidelity evidence.

## Committed native components
- `gold_source_ribbon.gd`: actual source-length sampling, end caps, 6-vertex strips, cubic width profiles, cut/reveal, live/endT/life. No baked frames.
- `gold_source_ribbon.gdshader`: fragment style0..5 translation of original per-pixel palette, procedural noise and Bayer dithering. Only style4 has been compared pixel-by-pixel with original WebGL.
- `gold_s01_seam_timeline.gd`: source `World.move` eased 86->376 x dash, actual per-tick `World.trail` at minD 2. Uses an EXPLICIT fixture seed; a production cast must provide the complete original RNG state.
- `hairline_source_composite_lab.tscn`: S01 component lab now includes source Ribbon + original ground writes + fourteen pressure sheets + thirteen dynamic waves in the same 480x270 viewport, with post effects. This is NOT the complete S01 visual.
- `gold_source_camera_fx.gd`, `gold_source_hitstop_clock.gd`: source real-time flash, shake, ambience, haze and hitstop/slow clock decoupling, tested numerically. Not yet connected to the final S01 cast.

## Original WebGL vs Godot isolated ribbon
One identical source seed and source-frame oracles extracted from actual **running** original WebGL gold (not hand-generated geometry). Original Gold frame 35 has 2 trail points; frame 52 has 16 points ending at x 383.05449526692246. Frame 105 source width 2.345; frame125 width 6, shader wobble -2.6.

Frames 52,105,125,160 (source simulator frame indices) all have 100% effect-mask IoU using a >40 RGB-distance threshold from controlled dark ground in the identical 480x270 isolated viewport.
| Frame | Mask IoU | Full-frame mean abs RGB error 0-255 | Maximum channel error | Pixels channel error > 5 |
| --- | ---: | ---: | ---: | ---: |
| 52 | 100.00% | 0.117971 | 16 | 226 |
| 105 | 100.00% | 0.107523 | 1 | 0 |
| 125 | 100.00% | 0.109645 | 1 | 0 |
| 160 | 100.00% | 0.109120 | 1 | 0 |

These figures describe the **isolated seam Ribbon**, not full S01 fidelity, nor other renderer styles or hardware targets. The first frame's 226 thin-edge pixels with channel error >5 remain a difference that must not be concealed. Gold screenshots, native screenshots and JSON measurement results are in the ChatGPT artifact `SOH_Gold_Fidelity_Gate7_Ribbon_Proof.zip` (with 4-frame companion captures).

## Source CI
- [Ribbon source 4-frame native CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40537453990): success for all frames at that commit.
- [Integrated S01 floor, plates, Ribbon and waves CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40537056097): success for 1.4667, 2.05, 2.84 seconds; smoke visual evidence.
- [Reusable original Camera/Hitstop CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40538423678): success for source update formulas.

## Unfinished, blocking any 'complete Gold S01' claim
1. Source real-world Knight/hero sprite pose and enemy multi-target reactions, authoritative combat cue adapter.
2. Full RNG integration across all source nodes, including pre-cast hero particles, flash and per-tick signed ribbon wobble; using one isolated deterministic fixture does NOT recreate that global stream.
3. Full hitstop and camera feedback synchronized with the exact gold timeline and center-wave additions.
4. Complete 7-second frame/video matching under source ground and actors, performance and scaling 1080p/1440p/4K.
5. Runtime collision/z-order contract with actual changing production maps.

CI isolation: no `game/`, `data/`, `assets/`, `project.godot` or production level mutations.
