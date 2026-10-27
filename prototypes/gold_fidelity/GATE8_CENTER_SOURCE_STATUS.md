# Gate 8 — S01 center ring, light, contact descriptors

Date: 2026-10-27. Branch: `feature/vfx-lab-gate0-20261027`.
**Status: PARTIAL Gold fidelity; NOT an approved full skill port.**

## Source-derived work shipped

Original source: user's `top-down-sword-vfx-laboratory.zip`, `src/skills/skills1.ts` `s01.run`, `src/engine/fxlib.ts` `groundRing`, `contact`, `lightAt`, and `src/engine/world.ts` `LightFx` / `RingFx`.

- `gold_s01_center_events.gd` describes the exact deterministic nonrandom S01 center additions: RingFx at (300,147), r0=4, r1=90, wd=27, amplitude=5.7, life=.54; cool light at (300,141), rendered y=133 after z=8, radius 150, strength 1.6, color (0.62,.78,1.0), life=.5.
- Separate visual-only cues: enemy[0] at center (direction PI, power430, lift170, down1.4, stop=.09) and enemy[1]/enemy[2] as the right-side wave reaches local x344 (lift60). Moving wave origin does not change local trigger criteria.
- `gold_s01_live_wave_layer.gd` now incorporates center ring and light through the same original 480x270 Godot postshader, with the WebGL 12-ring limit and strongest-first light ordering. No gameplay HP/stat writes.
- `tests/s01_center_source_contract.gd`: standalone GDScript source constants / three contact descriptors / offset invariants; included in filtered composite CI. Integrated `tests/s01_composite_runtime_smoke.gd` checks center ring/light/contact markers and rewind replay.

CI [Gate 8 Godot 4.7 composite + oracle](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40540975961) **PASS** at commit `174dab9`. Native artifact: `SOH_Gate8_CenterRing_Light_Native.zip`, three unretouched 480x270 frames from the same scene at 1.4667, 2.05, 2.84 seconds. Comparing these with Gate 7 at identical stages: first two PNG images byte-for-byte equal; late image changed in 21,522 pixels by >5 RGB levels, confirming central lighting/displacement enters only its own timeline phase.

## Explicit incompleteness / priority for the next automated session

1. **Original contact FX and actor attachment** are not yet ported. Source `contact(w,e,...)` creates RNG-driven FlashAt and sparks at `e.center()`, causes actual enemy pose/knockback, and triggers hitstop/shake; this implementation *only emits descriptors* without changing damage, physics or drawing those contact particles. Enemy center is moving in gold, cannot be replaced with fixed (300,137) and called equivalent.
2. The enlarged ground-ring also creates a shader Blob with a random seed. The spatial RingFx is ported; this extra Blob is **not**. Requires complete source RNG state at the relevant frame or an oracle recording the original seeded object.
3. Whole-cast global RNG, pre-cast sparks, hero ghosts, actual hero/enemy sprite, post camera shake/flash, hitstop 0.03/0.09, and 7-second frame/video fidelity remain unverified. Prior `gold_source_camera_fx.gd` / `gold_source_hitstop_clock.gd` source maths are verified but are **not yet wired** to this scene.
4. This is still controlled local 480x270 world space; no imported production Knight or real map; do not merge to gameplay or state that S01 is 1:1 complete.
5. The original WebGL runner may not be accessible to every worker because local Playwright/Chromium file/localhost access can be blocked. Source ZIP, original TypeScript, existing saved gold screenshots/oracles and source event descriptors remain valid. Report a gold-oracle blocker rather than guessing global seed.

Do not modify `game/`, `data/`, `assets/`, `project.godot` or team maps. Keep new smoke tests path-filtered. The next significant gate is source-derived contact Blob/spark + moving enemy responses and real-time hitstop/flash/shake under one authoritative time clock.
