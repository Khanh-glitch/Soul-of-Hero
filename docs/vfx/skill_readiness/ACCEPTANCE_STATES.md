# GOLD93 acceptance states (per skill)

Each state is tracked separately. A green CI run only proves the state it tests.
Only the project owner can set OWNER_VISUAL_APPROVED.

| State | Meaning |
|---|---|
| SOURCE_NATIVE_EXECUTABLE | The native generator runs headlessly in Godot 4.7 (CI load + run). |
| SOURCE_PARITY_VERIFIED | Tick-by-tick differential against the original TypeScript passes (hits, cues, sampled raster hashes). |
| HOST_CASTABLE_VERIFIED | Library level only. The public `Gold93SkillRuntime` casts, steps, cancels, replays and disposes the skill, and the isolated Lab drives the same id (CI host-adapter gate). No production game code is touched. Not the same as host integration. |
| HOST_ADAPTER_VERIFIED | A host (Soul of Hero) adapter casts the skill and routes damage, hits and anchors through real host code. Not set by any skill yet. |
| GOLD_VISUAL_COMPARISON_READY | Original GOLD renderer frames, native frames and in-game frames exist on one synchronized timeline. |
| GAMEPLAY_MOTION_VERIFIED | Movement, aim, targets, retargeting, interruption and cleanup match the original behaviour. |
| ENVIRONMENT_INTEGRATION_VERIFIED | Ground, terrain, glow and screen effects are visible on the real map and enemies. |
| OWNER_VISUAL_APPROVED | Owner has visually approved the in-game result. Not set by the agent. |
| PRODUCTION_INTEGRATED | Merged into production game files and skill assignments, with owner authorisation. |

## Status at branch head (see commit history for dates)

| Skill | SOURCE_NATIVE_EXECUTABLE | SOURCE_PARITY_VERIFIED | HOST_ADAPTER_VERIFIED | GOLD_VISUAL_COMPARISON_READY | GAMEPLAY_MOTION_VERIFIED | ENVIRONMENT_INTEGRATION_VERIFIED | OWNER_VISUAL_APPROVED | PRODUCTION_INTEGRATED |
|---|---|---|---|---|---|---|---|---|
| 006 Graft Caravan | yes (CI PASS, run 40861447433) | yes (seeds 7 and 21, run 40826230558) | no: no host-integration adapter in production (library-level HOST_CASTABLE_VERIFIED is yes, see table below) | no: 006 captures are native renders only; original GOLD renderer needs source archive re-provisioned | no | no | no | no |
| 010 The Walking Crucible | yes (CI PASS, run 40861447433) | yes (seed 7, run 40832336038) | no: no host-integration adapter in production (library-level HOST_CASTABLE_VERIFIED is yes, see table below) | no | no | no | no | no |

## Venomwright library status (CI, branch head bec65d1)

Evidence: native runtime run `40930552334` at `bec65d1`. Verdicts were read from check-run annotations, not from overall job conclusions. Every SOURCE_NATIVE_EXECUTABLE, SOURCE_PARITY and HOST_CASTABLE entry below was confirmed in CI. The parity entries are carried forward from the earlier differential runs listed in the parity index.

| Skill | SOURCE_NATIVE_EXECUTABLE | SOURCE_PARITY_VERIFIED | HOST_CASTABLE_VERIFIED | Open item |
|---|---|---|---|---|
| 001 Glassfang Hunt | yes (gold_pair Glassfang engine, not the venom engine) | yes (seeds 7, 21, 99) | yes (host PASS) | none recorded |
| 002 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 003 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 004 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 005 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 006 Graft Caravan | yes | yes (seeds 7, 21) | yes (host PASS) | pilot headless and real map PASS, not GOLD visual |
| 007 | no | no | no | candidate tick-90 raster mismatch (candidate job failed); unresolved queue |
| 008 | no | no | no | candidate tick-125 raster mismatch (candidate job failed); unresolved queue |
| 009 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 010 The Walking Crucible | yes | yes (seed 7) | yes (host PASS) | pilot headless and real map PASS, not GOLD visual |
| 011 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 012 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 013 | runs (probe) | no: tick-320 raster | no adapter | differential FAIL at `40930552334`; unresolved queue |
| 014 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 015 | runs (probe) | no: event-32 knockback | no adapter | differential FAIL at `40930552334`; unresolved queue |
| 016 | runs (probe) | no: tick-195 raster | no adapter | differential FAIL at `40930552334`; unresolved queue |
| 017 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 018 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 019 | yes | yes (seed 7) | yes (host PASS) | none recorded |
| 020 | no (not registered) | no | no | tick-180 raster blocked on original TypeScript; see VENOMWRIGHT_020_TICK180_BLOCKER.md |
| 021 | yes | yes (seed 7) | yes (host PASS) | none recorded |

All HOST_CASTABLE entries are library-level (15 verified at `bec65d1`; 008 host job added at `4bf0769`, verdict pending). None of them is HOST_ADAPTER_VERIFIED, GOLD_VISUAL_COMPARISON_READY, OWNER_VISUAL_APPROVED or PRODUCTION_INTEGRATED. The 21/21 target is not met: 007, 013, 015, 016 and 020 remain open. ARCANA III: original source available; foundation (util RNG/easing/noise) ported and Node-verified, renderer port not started (see `arcana/ARCANA_001_SOURCE_AUDIT.md`).

## Gaps recorded from the repo (not yet closed)

1. RESOLVED 2026-10-30: both original ZIPs are committed in-branch at `prototypes/skill_readiness/original_sources/` and SHA-256 verified (`8402633c…677d`, `ab0dba56…d716`). The earlier private-vault 403 and `GOLD93_ARCHIVE_KEY` gaps are superseded for this branch. Original Node reference renders view A locally; extracted sources stay in `/tmp`, never committed.
2. `docs/vfx/skill_readiness/captures/venomwright_006/` contains frames produced by the native port (manifest `engine`). They are not GOLD reference frames.
3. The generic `integration/external_adapter_sample.gd` is not wired to any venomwright skill id.
4. 013, 015 and 016 are not verified (see RESTART_CHECKPOINT.md). They are not registered as host-castable.
5. 020 is unregistered. Its tick-180 raster mismatch needs the original per-object state (see VENOMWRIGHT_020_TICK180_BLOCKER.md).
