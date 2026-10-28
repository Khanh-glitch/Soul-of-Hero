# Gate 3 — Glassfang Hunt full-cast motion, live actor pixels and acid Pool geometry

Date: 2026-10-28. **Status: COMPONENT GATES PASS; FULL SKILL NOT APPROVED.**
Branch: `feature/gold-venom-arcana-factory-20261028`.
Original Venomwright ZIP SHA256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716` was read from the uploaded file, unchanged.

## Original source method
Re-compiled **original** user ZIP files `src/game/{world,fx,pixel,mats,actors}.ts` and `src/game/skills/{lib,s1,s2,s3,s4,index}.ts` into CommonJS without editing source logic (TypeScript 5.9); executed `World.step(1/60)`, exact `SKILL_BY_ID[1].run(c)`, 600x340 logical world, World seed `0x20261027`, per-cast RNG source seed `1765485952`. For deterministic controlled **input** oracle, reset one or two enemy positions to known sine trajectories BEFORE each World step; Gold itself performs all cast, contact, Chain, World FX and enemy updates. Death-retarget case has initial grunt HP30 and second elite HP900.

The native GDScript is NOT frame playback: it implements the original generator phases, calculates moving-target contact, leap, recoil, orbit, retarget and finisher every source tick. It consumes the original RNG draw in `heading += c.rng.range(-.1,.1)*0` even though visual angle is unchanged. It emits **bite cues only**, without applying gameplay damage a second time; test harness simulates HP solely for deterministic target death.

## New PASS gates

| Test | Exact evidence | GitHub |
| --- | --- | --- |
| 60Hz moving target and death retarget | **480/480 frame source motion SHA** across x/y/z/heading/open + all 8 Chain segment coordinates + cast RNG; exactly 10 bite cues, 5 per scenario. Original source hashes: `1566f11ef3a7617431a4dc48abcea2c7e5a3e1f550b8bbe675bd74fb66e60e74` and `f9a4f9e1deb1271799c65fa3e952d55a1cb05eec28f7374fbdd04e4755eb6481`. | [CI 40623297935](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40623297935) |
| Native **live** procedural Fang, not canned frames | 24/24 complete source RGB/alpha SHA256 across four source-time checkpoints for each of two real-cast scenarios, three passes each (`shd`, `up`, `lit`). Real OpenGL GPU upload/readback; native 600x340 screenshots attached for `single` and `retarget`. The final fixture transcription error (one 65-digit hash rather than 64) was diagnosed via exact source 51-pixel set and corrected from original Gold; a 64-digit validation guard was added. | [CI 40623900103](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40623900103) |
| Glassfang **fluid/acid ground SDF** | 10/10 complete `Float32Array` source original `Field.disc` masks reproduced on Godot `PackedFloat32Array`, including all blob overlaps and oscillating boundary radii. Trail pool (`rad4,` life0.9s, seed696, grow0.1, blobs2), finisher pool (`rad6.5`, life4.2s, seed404, grow0.3, blobs3); exact 600x340 binary SHA256 at five ages each. No generic circle approximation. | [CI 40624134418](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40624134418) |

Previously validated Venom: original Mulberry32 seed policy 80 samples; Decal six ground families 24/24 source RGBA image hashes; Fang Chain 96/96 coordinates; isolated Fang 18/18 frame RGBA hashes.

## Source-only aftermath and cue inventory, NOT ported
Gold full World.sim with moving elite: bite frames 14,47,80,113,146; acid damage frame156 after finisher. Dead-then-retarget: bites frame14 (grunt),31,64,97,130 (elite); acid damage frames140 and213. **The acid hits and their particles, persistent pools and corpse effects have NOT been integrated into actual Soul of Hero combat.** Do not hide this behind motion/renderer PASS.

## Remaining blockers — mandatory next engineering passes
1. Port source `Field.shade` with original `nz1/nz2` noise, MAT.acid 6-color ramp, rim/highlights, source dither and flow with 600x340 RGBA Gold/native frame hashes. The SDF mask alone is *not* visual fluid parity.
2. Port Pool tick/boil/particle children with independent original world RNG, exact lifetime/fade/callback order. Emit impact/status cues from confirmed production CombatDamage; prevent double damage, preserve acid after Fang has died.
3. Full Glassfang cast: source vial trajectory, shards, drops, splash, ring/flash, crystal/corrode overlays on actual enemies, camera shake/flash/shock and hitstop, finisher plates, three 4.2s aftershock pools and sound cues where authored.
4. Overlay into disposable copy of original Chapter1 Level2; full source-to-map coordinate + moving camera, wall/void mask, environment proof with Gold before/after ROIs and 60Hz tests; **do not modify game/, data/, assets/, project.godot or map branches** in this branch.
5. Native/WebGL GPU continuous footage, 1080p–2160p tests and performance stress, real actor motion and collision. Full 1:1 only after each gate.

ARCANA III remains a **separate Pixi multipass family**. Existing full-color `crackScar` draw ledger and native OpenGL scar staging passed, but full Black Sun Coronation is not integrated. All 93 skills remain `integration_approved=false`. 11 fusion candidate skills from ARCANA are still visually unreviewed.

## Honest progress
**0/21 Venomwright and 0/72 ARCANA III skills fully approved for actual game integration**. This is the correct state until authored skill behaviors, environment aftermath, camera post and playable combat are all reproduced. Continue on the same isolated branch; never force-push or mutate map team files.
