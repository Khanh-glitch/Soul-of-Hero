# Two-family Gold source-locked port factory — 2026-10-28

## Contract
Continue from VFX prototype parent abf7bdc82267a55f50fd97506c8a45592b1fe145 on this new independent branch. The original gold is IMMUTABLE; no likeness-based substitutes, static-sheet approximations, erased enemy-body FX, or omitted environmental aftermath. Do not touch main, maps, game/, data/, assets/, or project.godot while the parallel map team works. No production integration without independent PR and gameplay/visual acceptance.

The user supplied and confirmed exact original archive SHA-256:
- Venomwright: \`venomwright-combat-vfx-design (4).zip\` SHA256 \`ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716\`; original code \`src/game/skills/index.ts\`, \`s1..s4.ts\`, \`src/game/world.ts\`, \`fx.ts\`, \`pixel.ts\`, \`engine.ts\`.
- ARCANA III: \`ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip\` SHA256 \`8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d\`; original code \`src/skills/{eclipse,dragonbone,fan,spindle,lantern,v2-independent,v2-fusion,remixes}.ts\`, \`src/engine/{core,draw,fx,post,pixtex,sprites,util}.ts\`.

Both uploads passed ZIP CRC and SHA-256 comparison against preexisting registry.

## Inventory / fidelity authority
93 distinct registered entries: Venomwright 21 (10 vessel, 1 transformation, 10 venom) and ARCANA 72 (20 original, 20 minor, 20 major, legacy fusion #301, 11 new fusion candidates #302–312). Source's own ARCANA documentation explicitly says the 11 new fusions have NOT passed visual review: do not label them accepted Gold despite being implemented TS candidates.

Venomwright source uses 600×340 logical world plus adaptive CPU raster, custom FX/particles, damage/status and per-cast Mulberry32. ARCANA uses 480×270 PixiJS8 multipass scene, its own particle layers, shader composition, default 0.5x camera and per-skill reseed. Keep independent rendering adapters. Only the shared *verified* Mulberry32 primitive can be reused across engines; zero-seed semantics differ (ARCANA 0→1, Venom 0 remains 0).

## Evidence executed on original user archives in the ChatGPT handoff
- Venomwright: 21/21 original TypeScript World+Fx source-only headless simulations from cast through duration+2s, seed 0x20261027, fixed 60Hz, each with timeline checkpoints, actor HP/movement, RNG and event ledger. This is not a Godot pass.
- ARCANA: 51/51 V2 developer logic/geometry check rerun; 72/72 registration-based TypeScript source skill callbacks complete a separate 30Hz *diagnostic mock-draw* timeline, ~1.94M recorded draw calls, no nonfinite coordinates. The mock has **no real PixiJS, WebGL shaders, renderer or FPS** and is not independent visual fidelity proof.
- Both original RNG implementations (Venomwright Rng.next, ARCANA rand) were compiled/executed directly. The native Godot port here contains 80 embedded source numerical outputs, including each family’s different zero-seed policy. Separate 320-value JSON oracle is in the user’s downloadable handoff.
- No Gold vs Godot whole-skill frame comparisons were made, no gameplay skill registered, all 93 \`integration_approved=false\`.

## Mandatory per-skill procedure
1. Verify ZIP hash, original registered ID/variant, function + transitive dependencies. Quarantine source candidates lacking visual Gold acceptance.
2. Reproduce source fixed-clock RNG and real call order (constructor draws, skill coroutine, shared world FX, enemy behavior, physics, light/post).
3. Generate independent Golden oracles: numerical timeline, source event/environment trace, targeted enemy-body/status visuals, world-space ground effects, render captures with no-effect baselines, matching seed/viewport/camera.
4. Port components to Godot as real dynamic primitives, not pre-rendered images. Keep 600×340 and 480×270 logical worlds separated; implement exact world↔camera↔TileMap transforms, layout/occlusion and settlement lifetime.
5. Compare multiple Gold/Native frames and continuous full-skill animation; use effect-only ROI IoU/MAE/p95 + human examination, not full-frame darkness statistics.
6. Real Level2 isolated AppFlow/actor adapter: combat authority confirms a hit exactly once; VFX subscribes to cues. Environmental FX on actual authored terrain may only affect collisions if Gold actually did so.
7. Benchmark dense combat and 1080p/1440p/2160p on real GPU. Confirm cleanup/replays/cancel and native/WebGL video. Promote individual skill only after ALL gates pass.

## Execution order
**First:** shared source RNG native proof (this PR); native CI pending until GitHub runner confirms. **Then:** Venom 001 Glassfang Hunt complete full-cast (moving enemy, body corrode, trail pools and residue), establish CPU raster and real-map adapter. **Then:** Venom batches of 3–5 sharing proven primitives, every skill independently accepted. In parallel, ARCANA 001 Black Sun Coronation as distinct WebGL multipass representative (original, not new unreviewed V2), verify full renderer/visual pass. ARCANA then batches within same proven family, but must not auto-promote 302–312 visual candidates.

No task can report 21/21 or 72/72 as Godot ports based on this source-only audit.


## 2026-10-28 08:5x ICT — validated branch progress

Branch head at this checkpoint: \`0ee5b326832b7d5ea92eaef0607cbd1d24bd0658\`. Two new Venomwright components under \`prototypes/gold_pair/\`:

- \`venom_source_decal.gd\` ports the six original source \`Decal.gnd()\` procedural ground raster variants: veins, cracks, pits, crater, crescent, scorch. Original TS oracle: 6 kinds × 4 source ages = **24/24 exact SHA-256 RGBA 600×340 frames**. Source palette, seed, point counts, source visibility/fade and glow pulse raster logic included. Commit \`4df4b810283ae61d9c135792c32d574e61cc5cb3\` initially failed due incorrect Godot API \`PackedByteArray.sha256_text()\`, not a source mismatch. Fixed to \`HashingContext.HASH_SHA256\` in commit \`bb8a1b71e8e0d8da79315a5150ff0196903e6288\`; CI \`40617696557\` SUCCESS.
- \`venom_source_decal_canvas.gd\` stages the original source RGBA output in an isolated Godot \`Sprite2D\` + \`ImageTexture\`, nearest-filtered and non-centered at the source 600×340 logical origin, with explicit source-to-map transform and NO variable-rate \`_process\` clock. \`venom_decal_canvas_smoke.gd\` checks texture dimensions, pixel hash from the original TS oracle, explicit transform, source lifetime boundary and fixed-clock policy. Commit \`0ee5b326832b7d5ea92eaef0607cbd1d24bd0658\`; CI \`40617847435\` SUCCESS (import + 24 original hashes + native staging). Shared RNG CI \`40617847557\` was triggered; verify its conclusion before subsequent edits.

**No per-skill promotion**: this is only the Decal primitive and isolated texture staging. Glassfang Hunt remains incomplete: enemy/actor animation, status, contact, particles, pools, all source runtime events and full Gold-vs-Godot skill video not yet ported. ARCANA Black Sun Coronation not yet ported. No real Level2 map adapter, real GPU capture, performance/2160p, WebGL, collision/gameplay authority or production integration is approved.

Next: access original ZIP source and isolate the actual Glassfang source function/transitive FX dependencies. Port enemy-body/status/particles, then drive original source fixed-clock full-duration fixture. Do NOT equate 24 Decal hashes with full-skill Gold parity. The ChatGPT local container was temporarily unavailable during this run; GitHub Actions provided the native Godot verification. Original archive bytes were not re-read in this run; prior SHA-256 lock remains historical evidence until archives can be independently re-opened.
