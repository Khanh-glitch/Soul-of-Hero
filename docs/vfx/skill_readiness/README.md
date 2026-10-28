# Gold 93 Native Skill Readiness Factory — executable handoff contract

**Canonical EPIC:** https://github.com/Khanh-glitch/Soul-of-Hero/issues/6
**Owned branch:** `feature/gold-93-skill-readiness-20261028`
**Forked from Gold factory immutable snapshot:** `bd24daa607e65d9423c53a29f6dd94b601de0d75`
**Date:** 2026-10-28
**Status:** PLANNED / INITIAL INVENTORY; **0 / 93 native port-ready** at task creation. Catalog or source-only TS validation is NOT a ready skill.

## Execution log 2026-10-28 (this working run)

Implemented on the Arena working branch (the platform fixes the branch name; the
canonical epic branch `feature/gold-93-skill-readiness-20261028` is an ancestor
and both are kept in the CI trigger list).

**Built and running (real code, real Godot 4.7 runtime):**

- `prototypes/skill_readiness/core/` — `Gold93SkillCatalog`, `Gold93CastContext`,
  `Gold93SkillParameters`, `Gold93Intents` (+ once-only `Bus`),
  `Gold93Ports` (Combat / Terrain / Sound / Camera / TargetResolver + recording
  implementations), `Gold93SkillModule`, `Gold93SkillHandle`,
  `Gold93SkillRuntime`.
- `prototypes/skill_readiness/families/` — `VenomFamilyRuntime`
  (600×340 logical, native Ultra k2 1200×680, 60 Hz, zero seed stays 0) and
  `ArcanaFamilyRuntime` (480×270 logical, 2×, own RNG with the ARCANA
  zero-seed→1 policy, source-locked `crackScar` / `draw.ts` ground layer).
- `prototypes/skill_readiness/skills/venomwright/v001_glassfang_hunt.gd` — the
  complete original Glassfang Hunt #001 cast driven by the source-locked
  factory components (`prototypes/gold_pair/**`, READ-ONLY): vial throw, Fang
  spawn, four leap/bite/recoil/orbit cycles, retarget on dying enemy, finisher,
  11+6 shard and 28 droplet burst, three cast-seeded 4.2 s acidic aftershock
  pools, afterlife and cleanup.
- `prototypes/skill_readiness/lab/` — `SkillReadinessLab` scene + script: browse
  all 93, cast / step / run / cancel / release, free 360-degree click and
  drag-release aim, live intent / terrain / RNG inspection, plus a headless
  probe that walks all 93 ids in CI.
- `prototypes/skill_readiness/integration/external_adapter_sample.gd` — host
  adapter that consumes any of the 93 ids without recoding VFX.
- `prototypes/skill_readiness/tests/` — nine native Godot tests (catalog/API,
  full lifecycle + fail-closed coverage, port authority + concurrency,
  two-family clock/RNG/scar, lab 93-id probe, **per-skill independent native
  harness for all 93**, **G7 host adapter contract**, Venomwright 21-skill
  authored baseline oracle) plus the disposable real-map overlay test.
- `.github/workflows/gold-93-readiness-runtime.yml` — path ownership, a native
  Godot job with nine test steps and a **disposable immutable Level 2 overlay**
  job (`f9fb8d4b7490a2579426bd5c4ee4667704d3a05e`).

**Honest status after this run:**

```
0/93  NATIVE_PORT_READY        (EPIC evidence gate: video, Gold-vs-native, WebGL, 2K/4K still open)
0/93  SOURCE_VISUAL_APPROVED   (no original Gold renderer available to compare against)
0/93  GAMEPLAY_CONFIGURED      (intentionally — owner supplies the numbers)
0/93  PRODUCTION_INTEGRATED    (intentionally out of scope)
1/93  native-executable        (venomwright:001, full native cast + native tests)
92/93 source-material blocked  (original ZIP bytes unavailable)
```

**Per-skill native harness (all 93, measured):** every canonical id is driven
through its own isolated harness instance — own runtime, own family runtime, own
stage, own caster, own port bundle — running cast → start → free 360-degree
re-aim → drag-release path → 32 ticks at the family's original clock → cancel →
no-further-emission check → dispose → resource release → zero-leaked-node check.
Castable ids additionally run a full start-to-afterlife cast. Machine-readable
evidence: `res://.artifacts/gold93/per_skill_harness.json`.

Measured for `venomwright:001` in the harness: 398 source ticks, 5 authored
bites, 145 terrain/environment operations, 4 family render surfaces attached and
released, 0 leaked nodes, deterministic trace digest
`311efcba6853bed121403217893213cb6d3d229cc8337605fb728227d29a924d`.

**Render-path defects found and fixed by that harness** (both were live bugs in
the Venomwright family adapter, invisible to every earlier test because none of
them attached the render surfaces):

1. `present_source_feedback()` was called with an untyped `[]` where the source
   component declares `Array[Vector4]`; GDScript rejected it at runtime, so the
   **entire Venomwright render pass threw on every single tick**. The adapter
   now builds the shock array and flash from the module's emitted camera
   intents, typed correctly.
2. The shared particle/actor surfaces keep a monotonic per-cast clock, so a
   second cast on one attached family runtime logged
   `Original source particle clock moved backwards`, and `release_source_actor()`
   asserted when the authored Fang had not spawned yet. `release_cast()` now
   rearms the per-cast surface clock and only releases layers that exist.

**The one genuine blocker:** neither this repository nor this execution
environment contains the original archive bytes
(`venomwright-combat-vfx-design (4).zip` SHA-256 `ab0dba56…`,
`ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip` SHA-256 `8402633c…`). The registry, the
port matrix and the 21-cast baseline table are provenance records only. Per the
epic’s own rule, the authored generators for the remaining 92 skills were
**not** invented to work around this; instead the complete infrastructure was
built and each id fails closed with a precise, machine-readable blocker.
Dropping a source-locked module at the registered path is all that is needed —
no infrastructure change.

## The user-defined boundary

**Deliver full native callable readiness for all 93 first; leave the combat design to the user later.** When the user chooses each skill's control scheme, hotkey/drag gesture, damage, range, mana, recharge, mana regen, hit timing, effect strength, target selection, synergy or unlock conditions, the game should load its existing native VFX/lifecycle module and bind a rule schema, not migrate/port Gold again. Do not invent balance numbers, combat semantics or force binding to production Sword/Archer. The library must have a disposable laboratory that can actually play each full source skill without production registration.

Three independent axes:
- `native_port_ready`: exact original-world procedural FX, animation, statuses/targets, terrain/light/audio/post, reusable native cast/aim/cancel/replay lifecycle, acceptance evidence; **this is the target of this epic**.
- `gameplay_configured`: user-approved combat numbers, control mapping and unlock definition; remains false until explicitly provided.
- `production_integrated`: overworld/Hero/UI/save binding merged with owner approval; remains false and is OUT OF SCOPE of this epic.

`gold_visual_approved` is a fourth independent axis, backed by original Gold-vs-native evidence; ARCANA #302..312 are unapproved candidate designs even though TypeScript functions exist. A port may run in the lab without being claimed gold-approved.

## Existing authority and what is not yet true

Read `docs/vfx/gold_skill_registry.json` (155 total, select **exactly 93**), `docs/vfx/VENOM_ARCANA_FACTORY_HANDOFF_2026_10_28.md`, `docs/vfx/VENOM_ARCANA_TWO_FAMILY_GATE2_EVIDENCE_2026_10_28.md`, `docs/vfx/GOLD_VFX_ORIGINAL_VS_REAL_LEVEL2_VISUAL_REVIEW_PROTOCOL_2026_10_28.md`, `docs/vfx/VENOM_21_SOURCE_RUNTIME_ULTRA_ALL_CAST_BASELINES.md`, Gate5–8.

- Venomwright **21**: original ZIP `venomwright-combat-vfx-design (4).zip`, SHA256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`; authored `World.step(1/60)`, native Ultra 1200×680 from logical 600×340. Source-only 21/21 baseline, components and real Level2 Glassfang partial comparison exist; **no full native skill accepted**.
- ARCANA III **72**: original ZIP `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip`, SHA256 `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d`; original 480×270 PixiJS8 WebGL multipass. IDs `1..20,101..120,201..220,301..312`. Source code callbacks were mock-drawn at diagnostic 30 Hz **without real renderer; do not promote this to native visual acceptance**. Fusion #302..312 require independent visual review.
- Original archived ZIP bytes are not included in Git tree. The source hashes are historical provenance until the task obtains exact bytes. Do not fabricate transcripts of source code; build engine-independent interfaces, native catalog and CI even if archives need provisioning. Before final fidelity claims, original ZIP and real WebGL must be executable in the verification environment.

## Branch and file isolation (hard contract)

From this branch only write:
- `docs/vfx/skill_readiness/**` — specifications, manifests, evidence.
- `prototypes/skill_readiness/**` — GDScript runtime/API, both native family adapters, isolated scenes, tests, non-Gold source mirrors if licensed/authorized.
- `.github/workflows/gold-93-readiness-*.yml` — CI.
No `game/**`, `data/**`, `assets/**`, `config/**`, `addons/**`, `tests/**`, `tools/**`, `project.godot`, `README.md`, existing `prototypes/gold_pair/**`, `main`, any map/overworld/hero/system branch. Overworld branch name not currently visible in remote branch list; treat **all non-owned branches as READ-ONLY**. No auto merge/force push/rebase across parallel branches. All authored map checks run by **disposable runner checkout** of immutable Level2 SHA `f9fb8d4b7490a2579426bd5c4ee4667704d3a05e`; test imports own new files and existing Gold components without editing game map.

When future overworld is ready, write a separate tiny integration PR with port injection at owner-approved seam. Never integrate before approval.

## Development plan — build actual runtime, not only registries

**G0 Provenance/coverage.** Enumerate exactly 93 from registry with source ID/family/variant/original parser entrypoint, style/clock, full transitive dependencies, actor-target/body FX, status/collision/terrain mutations, camera/audio, post, cleanup, source seed and per-skill candidate approval. Confirm all source ZIP CRC/hash at execution time; dynamic original reference snapshots and complete Gold source stage. Every entry initially NOT PORTED.

**G1 Public native API.** Implement type-safe `GoldSkillCatalog.get(id)`, `CastContext` with caster/targets/world camera/map transforms/source seed/free 360° aim/drag path, `GoldSkillRuntime.cast(id,ctx)`, `SkillHandle.tick_source/cancel/dispose/update_aim`; native event ports `CombatIntent`, `StatusIntent`, `EnemyVisualIntent`, `TerrainVisualIntent`, `AudioIntent`, `CameraIntent` with strictly once ids. No damage applied unless user-provided `CombatRules`; do not manufacture defaults. Every input configuration value may be explicitly unconfigured, but effects can be previewed in LAB.

**G2 Separate family source runtimes.** Port entire Venom procedural CPU frames at original k2, original World FX, shared RNG, actor/enemy/camera/post and original 60Hz; port ARCANA independently with full PixiJS multipass geometry, original per-skill clock verified against source, shader/lighting and RNG. No forced shared renderer, no frame baking or claiming native 2K by enlarging source 1K.

**G3 Per-skill full conversion.** Execute full source-generator timeline for every skill (93 individually) with live target movement, real concurrent particles/ground marks/enemy overlays/hit intents/finisher/afterlife, cleanup, interrupt and deterministic replay. Transformation (#11) and Venom ultimates (#10/#21) need lifecycle transitions. ARCANA fusion candidates can port to LAB but not mark Gold-visual-approved without original reference.

**G4 Simulation LAB.** A self-contained Godot 4.7 Lab under owned path to select any of 93, inject diagnostic targets/context without production edits, aim 360° with click/hold/drag/drop, run/replay/abort and inspect event/FX/source clocks, status/rng, QA screenshots. Test parameters clearly marked `LAB_ONLY`; no claim they are production balance.

**G5 Paired full visual proof.** For EACH skill: actual unmodified original Gold on Gold background/actors, final real WebGL post, actual native Godot on real Level2 AppFlow/TileMaps/Knight/enemy/Camera at same seed and source ticks, continuous video and closeups, terrain aftermath and cleanup; no fake screenshot painting. Use per-layer FX ROI, geometry, color error, source traces. Optional map-only luminance aid must leave Gold FX/hero/enemy/HUD untouched. No absolute visuals threshold invented without baseline.

**G6 Operational checks.** 93/93 full non-stub native runnable modules from ID, free-direction data contract, independent ability cancellation, resource teardown, overlapping casts, per-cast RNG, no fake game HP. Integration port explicitly applies CombatDamage once with confirmed hits, but gameplay config remains unconfigured until user input. Real native/WebGL 1080p/1440p/2160p GPU/CPU budget, native k2 detail and readability, no shader/performance regression.

**G7 Handoff.** Document per-skill schema/entry ID, gameplay configuration slots that can be filled by the user and the minimal later integration PR. Native readiness can reach 93/93 while `gameplay_configured` and `production_integrated` intentionally stay 0/93; keep every count separate.

## Acceptance rules and autonomous execution

Every run: inspect exact HEAD and latest CI; choose real next missing functional component (not another inventory-only cycle); implement, run relevant native Godot import + runtime tests, commit on OWNED branch, wait for CI evidence and fix failed gates. Do not spin/halt waiting for a routine instruction. Only request user action for unavailable immutable Gold ZIP, missing permitted deployment credentials or architectural integration requiring owner approval. Never announce 93/93 until every original skill is actual runnable native and individually audited; never falsify Gold source outcomes.

Use `readiness_manifest.json` as machine-owned per-skill truth; only transition a status on commit with verified evidence. The inventory CI MUST enforce allowed paths vs baseline SHA and exact 93 IDs; future native CI MUST reject fake port-ready entries without module/test/whole-skill evidence.

**Immediate first implementation slice:** owned manifest + ownership CI; native API/context/handle and isolated runnable LAB; Venom #001 and ARCANA #001 real native reference adapters from existing read-only source components; expand 93 independently while retaining fidelity requirements. Related master issue: #6.
