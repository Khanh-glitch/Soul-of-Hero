# Soul of Heroes — Gold VFX Factory v1

Scope: 155 audited *entries* (135 Web-authored, 20 ARCANA Fusion planned-only). No claim that 155 independent gameplay skills or Godot ports currently exist.

## Non-negotiable gold contract
The user-supplied gold package is immutable. Maintain its source SHA-256, source skill ID, exact selected variant, rendering family, fixed clock/seed and per-stage shader dependencies. No 'looks similar' substitutes or pre-rendered PNG sequences for source procedural dynamics. Unported steps stay marked incomplete. Ground deformation is visual unless gold changes collision, and visual damage NEVER owns gameplay damage authority.

## Avoid 155 separate miniature research projects
Port **families and reusable primitives**, not generic identical effects. A renderer component is qualified with one representative *real gold* reference before inheriting technical infrastructure, but every distinct skill still must pass its own locked-seed full-timeline parity. This reduces redundant coding **without** allowing acceptance-by-inheritance.

Four authored families:

- `webgl2-7-layer-ground` — 21 Top-down Sword: ground raster, pressure sheets, ribbons, source physics, post displacement, hit/lighting.
- `cpu-pixel-dual-rv` — 21 K-Night: 480×270 CPU pixel, separate OG/RV engines; RV only for selected 07/08/17.
- `pixi-cpu-procedural` — 21 Venomwright: per-target status/attachment + procedural CPU pixel pipeline.
- `pixijs8-webgl-multipass` — 72 ARCANA III: multiple shader buffers and composition passes; visually unverified new entries are **not** pre-approved.

Separate fifth group: 20 ARCANA Fusion *design plans* (`unresolved-multi-engine-design`). Do not port presumed 'final' visuals that do not exist. Resolve accepted A/B/C/D per spell, preserve all enemy-body A effects, then establish a gold source first.

## Gates and batch sizing

| Gate | Automated evidence | Cannot be faked by |
|---|---|---|
| 0 Source Lock | Source archive SHA-256, source implementation, selected variant and reference timestamps | A renamed/similar effect |
| 1 Primitive Parity | Source-versus-Godot geometry, RNG, lifetime, shader tests | A smoke test with manually authored shapes |
| 2 Visual Fidelity | Same 60 Hz tick/seed/viewport/camera, multi-frame side-by-side + effect-ROI IoU/MAE/p95 | Background-dominated MAE or one flattering still |
| 3 Dynamic Fidelity | Full animation, moving enemy, occlusion, multiple targets, cancel/hit-stop/cleanup | GIF or finite still sequence |
| 4 Environment Fidelity (MANDATORY) | Per-skill source audit of ALL environmental events, with frame-timed world-ground grooves/cracks/scorch/rubble/debris/shaders/lights, persistent effects and cleanup on an ACTUAL authored map | Smoke/character-only effect; decorated static scar; missing terrain layers; simulated empty floor |
| 5 Native Integration | Godot actor/enemy, combat event authority, tile interactions in *isolated* scene | A stand-alone HTML only |
| 6 Load + Quality | Dense combat, overlap, 1080p/1440p/2160p nearest scaling and real GPU benchmarks | One software renderer FPS |

**Environmental policy applies to all 155 entries:** A skill cannot be approved until every source environment call is classified and its rendered consequences reproduced on an actual map. Classify a truly environment-free skill as `source_verified_none` ONLY with a cited original code-audit proof; do not assume a missing port feature was absent from Gold. Particle/dust/spark/ground displacement/terrain damage or aftermath are NEVER safe to silently omit. If Gold deforms terrain only visually, do not invent physical TileMap collision destruction. Environmental image/temporal parity on a live, authored terrain is a separate acceptance gate from actor VFX and generic shader parity. The source color/compositing operation must be applied to map texture without replacing it with Gold's example room.

**Queue logic:** establish ONE gold-diagnostic representative per rendering family. Finish S01 to full skill parity first. Then batch **3–5 skills sharing verified components** per PR, each with explicit source-diff and frame-level evidence. Do not promise a batch completion date. If a primitive is wrong, quarantine dependent skills and fix the primitive once. Keep Fusion design-only entries outside the integration queue.

## Throughput design
- Register and deduplicate all 155 source entries with `tools/vfx/build_registry.py`; registry is inventory, not a progress scoreboard. The 135 entries with Web code may contain different levels of visual verification.
- `tools/vfx/validate_registry.py` prohibits promotion to ready/approved without locked gold source, paired frames, native runtime and every acceptance gate passing.
- `tools/vfx/compare_gold_frames.py manifest.json --report report.json` performs strict source-versus-Godot image checks. A manifest MUST specify both reference images and their corresponding no-effect baselines, same logical resolution and simulation tick, foreground pixel threshold, IoU minimum, effect-ROI MAE and p95. Empty foreground cannot pass. This is a component-level gate, NOT the final human/temporal acceptance.
- CI uses **one cheap catalog/test job** for metadata changes; native Godot jobs run only when corresponding port code/workflows change. Reuse scripts instead of writing one bespoke CI pipeline for each skill.
- Human visual review remains required for the full animated skill; do not use a metric as permission to silently alter art.

## Scope safety
All initial authoring under `prototypes/gold_fidelity`, `docs/vfx`, `tools/vfx`, and `.github/workflows`. Do not edit `game/`, `data/`, `assets/`, `project.godot`, level files, map scenes or other work branches while the level-design team is active. Main/combat integrations happen as separately reviewed future PRs.

## Current pilot truth
Top-down Sword S01 Hairline Rupture: source ground buffer, 14 plates, displacement, source wave emitter, select live Blob/Chunk/Part and single-wave ring post were separately proved, but **no full seven-second gold-vs-Godot matched skill** exists. A source 13-wave Godot sequence has code; native CI must pass and full-chain original RNG needs verification. Keep `gold_visual_acceptance=false` and `integration_approved=false`.