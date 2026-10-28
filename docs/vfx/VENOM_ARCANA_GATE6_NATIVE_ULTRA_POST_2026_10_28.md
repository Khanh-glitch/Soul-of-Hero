# Gate 6 — Source original Ultra native visuals and post stage (2026-10-28)

## Why this gate was required
User observed that the previous isolated VFX previews looked odd. Manual visual audit discovered previous **Classic k=1 600×340 isolated source components** had no actual world, actor/enemy, camera, other particles or original GLSL post. Original Venomwright `Game.quality=ultra`, `renderScale=2`, native pixel density **k=2**, 1200×680 raster. This is native 2x original source sampling, not upscaling Classic.

Two immutable original Gold archives: Venomwright `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716` (21 authored), ARCANA `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d` (72 authored). **0/93 production full skills accepted**, no game/map files touched. Source full-cast original TS pre-post samples are locked in Gate5 `docs/vfx/VENOM_ARCANA_GATE5_ULTRA_VISUAL_SOURCE_AUDIT_2026_10_28.md`.

## Current validated source vs native stages

| Gate | Scope/evidence | Status |
|---|---|---|
| Venom Gold Ultra Fang | Exact original 6 ticks × shd/up/lit 18 full 1200×680 RGBA SHA256, plus original Classic 18/18 nonregression, true native OpenGL 3-pass image texture, screenshot and cleanup | PASS — [run 40636459038](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40636459038) |
| Venom Gold Ultra acid Pool Field and shade | Two original pools, 7 ages × true 1200×680 Float32 field, whole color RGBA and whole additive light RGBA, 21/21 strict source SHA256; old Classic Pool color nonregression | PASS — [run 40636875913](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40636875913) |
| Venom Gold Ultra acid Pool actual native image | Original ground and separate additive light uploaded to real 1200×680 ImageTextures, checked exact Gold CPU SHA and OpenGL GPU readback, native screenshot saved, both layers expired/cleaned; quality set *before* allocating GPU texture | PASS — [run 40637100677](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40637100677); artifact `venom-acid-pool-original-ultra-k2` |
| Original Venom Post GLSL | `src/game/display.ts` original FRAG transcribed to `venom_source_display_post.gdshader`: 4 shock bands, shake, 2px and 5px glow halo, Bayer4 stepped vignette, dim/desat/flash, 31-step 5-bit quantization; `venom_source_display_post.gd` mirrors Display.present() k scaling and original grade mapping | Native OpenGL smoke **PASS** Classic+Ultra on synthetic color/glow and GPU screenshots [run 40637433117](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40637433117). **Does not yet prove Pixi WebGL-Godot framebuffer parity**. |

## Honest remaining visual blockers
1. **Actual full-cast Gold vs Godot frame matching still open.** The original TS Gold full-cast scene+glow at 9 source ticks 6,15,31,63,96,147,177,220,330 was generated and SHA locked at Gate5. Complete original World.draw, including actor, enemy reaction, vial, shard, splash, particle, corrode, all 3 finisher Pools, and authored ground, must be reproduced continuously in Godot at same 60Hz seed and source viewport.
2. Original Full Gold **postprocessed WebGL 1200×680 browser snapshots** are not yet a validated independent oracle. Need capture Chromium WebGL source renderer under identical uniform sequence, stage original post in Godot (which presently only passes synthetic smoke), and compare final full-color frames/animation at matched time and seed with ROI and visual inspection. Avoid "looks similar" claims.
3. Original Gold source Pool in isolated preview appears visually tiny relative to 1200×680 arena because author set trail radius4/finisher6.5 logical units; not a native texture loss or license to inflate skill assets. Scene-world, camera zoom, total pools, enemy and background establish intended readable context.
4. Native 1080p/1440p/2160p resizing, multi-hit enemy visual reaction, map floor/void masking, collision and FPS budgets remain untested; no gameplay production changes yet.
5. ARCANA III is separate PixiJS8 graphics family; existing crackScar primitive passes do not certify full Black Sun cast. ARCANA eleven V2 fusion candidates #302–312 have not independently passed visual acceptance.

## Branch constraints & next engineering
Single branch `feature/gold-venom-arcana-factory-20261028`, do not modify main, game/, data/, assets/, project.godot, or map team branches. Do not fake cached PNG sprite sheets. Match source by porting whole World render/multi-layer event state, then original GLSL post and real Level2 disposable overlay. Only then, and after practical playability and performance proofs, mark Glassfang #01 approved; iterate remaining 20 Venom and 72 ARCANA individually.
