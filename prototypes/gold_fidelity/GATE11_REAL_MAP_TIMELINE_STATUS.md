# Gate 11 — Source-timed GOLD S01 on real Chapter 1 Level 2

**Status:** Native integration **PASS** for visual-component compatibility. **NOT full Gold-skill fidelity or deployable combat skill.**

## Reproducible production-map test

- **Map source:** Git branch `arena/bc641b4c-soul-of-hero`, immutable commit `f9fb8d4b7490a2579426bd5c4ee4667704d3a05e`.
- **VFX code:** isolated branch `feature/vfx-lab-gate0-20261027`; CI checks out the pinned map commit and the VFX triggering commit into two separate runner directories; overlays VFX-only `prototypes/gold_fidelity` files in the runner's disposable workspace.
- **Actual game flow:** production AppFlow starts campaign Level 2, resulting in DungeonLevel authored Backdrop/Geometry/Decor TileMaps, Knight's actual Camera2D, 18 native enemies and full production HUD. Camera and Knight are repositioned **temporarily in the test runner only**, and VFX never writes game health, collisions, JSON, assets or save progression.
- Original Gold source component space is 480x270, retargeted into live 640x360 logical camera-space at the actual enemy's world anchor, rendered as 1280x720 PNG through native 2D stretch.
- Native CI: [Gate 11 success](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40550686150), after independent earlier [Gate 10 A/B success](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40549937404).

## Evidence A: actual TileMap pixels physically move in the image

`tests/s01_real_campaign_map_integration.gd` captures one **camera-aligned** baseline and a controlled before/after pair where only the ORIGINAL source Gold segment post-process toggles. An A/B probe checks a camera-projected, PNG-scaled region; the passing Gate 10 run measured **10,872 changed pixels** in this region. The later full Gate 11 run still passed this regression (10,822 changed pixels; the live scene may advance frames).

**CRITICAL coordinate contract:** Source postshader `u_res` and `u_seg` must be in logical 640x360 screen units, **not** Godot backing texture dimensions (2560x1440) nor PNG capture dimensions (1280x720). For measurements only, project logical segment bounds to PNG pixels using the actual image resolution / logical viewport ratio. The earlier CI falsely reported 0 due to comparing logical bounds to output physical pixels; then an overcorrection used backing resolution and was invalid. Gate 10 regression prevents this recurrence.

Screenshot artifacts include baseline, no-warp control and source Gold warp. Successful frames show source Ribbon + 13 live, seeded waves; **this technical A/B fixture deliberately mixed 2.05s Ribbon and 2.84s waves** to maximize test coverage and must never be described as a physically synchronized cast.

## Evidence B: faithful sequential presentation in the SAME real map

`tests/s01_real_map_source_timeline.gd` and `gold_s01_world_pressure_sheets.gd` reuse the source-derived 14 plate descriptors, original plate GLSL, exact vertex layout, source Ribbon mesh GLSL, continuous 13-wave native source renderer, and original segment post-distortion on the SAME map and camera:
| Gold source world time | Pressure sheets | Ribbon | Live wave releases | Segment strength |
| --- | ---: | --- | ---: | ---: |
| 1.4666666667 s | 14 | visible | 0 | 1.800 |
| 2.0500000000 s | 14 | visible/widened | 0 | 1.800 |
| 2.8400000000 s | 0 | cleaned up | 13 | 0.645 |

Files: `s01_map_source_146.png`, `s01_map_source_205.png`, `s01_map_source_284.png`. This demonstrates **native world-space presentation/lifetime**, not all seven-second Gold parity, live damage, or real skill input execution.

## Protected map boundaries

GitHub compare `main` baseline `52147889` to feature shows **no changes to `game/`, `data/`, `assets/` or `project.godot`**. All additions are prototype modules and CI. Real-map source branch is never pushed/modified. Godot-generated untracked `.import` and `.uid` files in disposable CI workspace are not edits to authored assets; CI explicitly rejects **tracked** content changes.

## Outstanding to make Gold #01 actually usable

1. **Ground buffer paint adapter**: source gold uses a mutable 480x270 CPU ground RGBA buffer with 2 grooves + 13 cracks + 13 rubble commands. The real authored DungeonLevel has TileMaps, not the Gold buffer. Implement equivalent *persistent local cosmetic* ground texture modifications on arbitrary real map tiles, not just transient post displacement; preserve proper persistence/lifetime and do not rewrite TileMap collisions. Compare against original gold ground-buffer operations on a native fixture first.
2. Global source RNG across hero movement, pressure sheets, actor/target contact sparks, ring blobs, source hero/enemy animation and all 13 waves; current visual test still uses original isolated source **fixture** seed, not real cast seed synchronization.
3. Actor animation, enemy-center attachment during physical moves, full source hitstop/camera/flash/scene light ordering, and gameplay combat API integration while preventing double damage.
4. Continuous native **full-cast 7s** video vs source WebGL Gold video, dynamic camera/target tests, production FPS/render scalability 1080p/2K/4K.
5. Integration into a real player-triggered skill only after evidence; production-map workers must not have their branch merged without review.

Do not shortcut original gold visuals with hand-drawn approximations, flat sprite-sheet playback, or changing source timings. Passing a map pilot is NOT completion of the source skill.
