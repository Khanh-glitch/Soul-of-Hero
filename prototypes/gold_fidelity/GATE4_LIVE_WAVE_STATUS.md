# Hairline Rupture 01 — Gate 4 live-source VFX status

Date: 2026-10-27. Branch: `feature/vfx-lab-gate0-20261027`.

## Native test evidence (not a complete skill)

- Source of truth: uploaded `top-down-sword-vfx-laboratory.zip`, skill `src/skills/skills1.ts` and original WebGL engine `src/engine/world.ts`, `fxlib.ts`.
- A single **standard non-center S01 wave** is spawned using source LCG seed `0x20261027` at gold-space `(278,141)`, yielding 22 source objects: 7 Blob, 9 Chunk, 5 Part, 1 post-processing RingFx.
- Godot `gold_source_wave_emitter.gd` reproduces the source initial state and final LCG from an original-TypeScript oracle. `gold_blob_primitive.gd` renders source shader Blobs; `gold_rupture_glyph.gd` renders live Part/Chunk geometries; `gold_fx_dynamics.gd` updates original 60 Hz physics; `gold_post.gdshader` handles the ring displacement and post processing.
- Live native captures at ticks 15 / 30 / 60 have passed on Godot 4.7 GL Compatibility under llvmpipe. [Capture CI](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40516207643). The gold images are rendered from ORIGINAL WebGL2 at the same ticks and seed, with actors and ground writes disabled in both for this focused fixture. The complete reproducible gold/native screenshots and offline analysis were provided to the user in `SOH_Hairline_Rupture_Gate4_Live_Wave_Evidence.zip`.
- ROI mask threshold: non-background when any channel differs from RGB(12,11,22) by >6. At ticks 15/30/60 the effect-mask intersection/union is respectively **84.35%, 87.13%, 92.12%**. Full-frame per-channel mean absolute RGB error on 0–255 scale: **0.1258, 0.1175, 0.1170**; beware dominance of background pixels. Max per-channel error remains 241, 70, 220 at isolated pixels. These numbers indicate partial parity and leave visible differences; they are NOT fidelity approval.

## Live outward propagation

`gold_rupture_sequence.gd` is a new presentation-only 60 Hz orchestrator for the original 13 spatial wave events. It preserves source delay `k*0.035`, the signed/outward positioning, a continuous source RNG for sequential waves, deep copies of 22 object spawn attributes per wave, and explicit markers for the unported center-wave additions. The 13-wave source-only component emits 286 base source objects (13x22) **without claiming the central hero contact, extra light/large ring, or pre-cast RNG interleaving is ported**. Native deterministic replay CI is required before accepting this component.

## Still required / MUST NOT misrepresent

1. The sword blade, dash, shock at first enemy contact, seam ribbon and its source update callback.
2. The player/enemy animations, original spatial anchoring, hit-stop, screen shake, flash, and 3-enemy contact reactions.
3. The existing Gate 3 original 14 pressure sheets + ground image modifications merged into the live 13-wave scene with correct renderer layers and world space.
4. The center wave's extra `contact`, `lightAt(150,1.6,COOL)`, `groundRing(r90)` and all concurrent lights.
5. Dynamic spawn/interleaved RNG source reproduction for the WHOLE 7s skill rather than a standalone wave fixture.
6. Native side-by-side moving footage across complete 7s, Godot real Knight/enemy test, FPS across density and 1080p/1440p/2160p pixel-scaling proof.
7. A real map-integration adapter that obeys geometry, occlusion, z-order and never reassigns damage ownership to VFX.

**Not production ready.** Do not call this 1:1 complete. Do not merge into map/game branches. These are 480x270 source-space controlled fixtures. No modifications to production `game/`, `data/`, `assets/`, `project.godot` or maps.
