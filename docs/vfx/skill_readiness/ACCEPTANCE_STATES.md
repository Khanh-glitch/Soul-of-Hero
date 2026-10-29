# GOLD93 acceptance states (per skill)

Each state is tracked separately. A green CI run only proves the state it tests.
Only the project owner can set OWNER_VISUAL_APPROVED.

| State | Meaning |
|---|---|
| SOURCE_NATIVE_EXECUTABLE | The native generator runs headlessly in Godot 4.7 (CI load + run). |
| SOURCE_PARITY_VERIFIED | Tick-by-tick differential against the original TypeScript passes (hits, cues, sampled raster hashes). |
| HOST_ADAPTER_VERIFIED | A host (Soul of Hero) adapter casts the skill and routes damage, hits and anchors through real host code. |
| GOLD_VISUAL_COMPARISON_READY | Original GOLD renderer frames, native frames and in-game frames exist on one synchronized timeline. |
| GAMEPLAY_MOTION_VERIFIED | Movement, aim, targets, retargeting, interruption and cleanup match the original behaviour. |
| ENVIRONMENT_INTEGRATION_VERIFIED | Ground, terrain, glow and screen effects are visible on the real map and enemies. |
| OWNER_VISUAL_APPROVED | Owner has visually approved the in-game result. Not set by the agent. |
| PRODUCTION_INTEGRATED | Merged into production game files and skill assignments, with owner authorisation. |

## Status at branch head (see commit history for dates)

| Skill | SOURCE_NATIVE_EXECUTABLE | SOURCE_PARITY_VERIFIED | HOST_ADAPTER_VERIFIED | GOLD_VISUAL_COMPARISON_READY | GAMEPLAY_MOTION_VERIFIED | ENVIRONMENT_INTEGRATION_VERIFIED | OWNER_VISUAL_APPROVED | PRODUCTION_INTEGRATED |
|---|---|---|---|---|---|---|---|---|
| 006 Graft Caravan | yes (CI PASS, run 40861447433) | yes (seeds 7 and 21, run 40826230558) | no: no Graft-specific host adapter found in repo | no: 006 captures are native renders only; original GOLD renderer needs source archive re-provisioned | no | no | no | no |
| 010 The Walking Crucible | yes (CI PASS, run 40861447433) | yes (seed 7, run 40832336038) | no: no host adapter found | no | no | no | no | no |

## Gaps recorded from the repo (not yet closed)

1. The original TypeScript sources are not present in this session (`/tmp/gold93-src` is gone). The archive key `GOLD93_ARCHIVE_KEY` is not set in the environment, so the decrypt script cannot run. Without the original sources there is no GOLD renderer and no reference frames.
2. `docs/vfx/skill_readiness/captures/venomwright_006/` contains frames produced by the native port (manifest `engine`). They are not GOLD reference frames.
3. The generic `integration/external_adapter_sample.gd` is not wired to any venomwright skill id.
4. 013, 015 and 016 are not verified (see RESTART_CHECKPOINT.md).
