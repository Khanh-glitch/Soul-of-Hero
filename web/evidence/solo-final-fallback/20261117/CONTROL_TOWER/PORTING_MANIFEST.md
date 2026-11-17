# Selective NPC integration manifest — NOT merge authorization

Shared origin: e93982f87bd23805d300b464f05ccf23c04a32c0. NPC HEAD checked 2026-11-17: fdcd0be4321521eea24bbcd90c2c2a60dbcb06c5 (`arena/9025bfde-soul-of-hero`). All work stays on arena/e506bfd6-soul-of-hero. No production/NPC branch modifications authorized or performed.

| Solo commit | Class / modules | Behavior / dependencies | Save effect | NPC proof / limitations |
|---|---|---|---|---|
| inherited 3682329 + 257aae3ffdbeda1d2a142f0adf6385775a0c01b5 | SAFE_COMMON, `item-atlas.ts` load/icon; `common.tsx` drawnIconUrl ONLY | Single-flight bounded atlas, atomic successful publish, stale callback veto, lazy cached PNGs, readback hint; only requested fallback converted. Requires approved atlas/index, unchanged. | None | `../porting/icons-for-npc-fdcd0be.patch` clean applied to archived NPC source; app typecheck + 8 focused tests pass. Patch includes inherited lazy URL behavior absent on NPC. Keep human PanelState/actorId fields; do NOT copy Solo common.tsx wholesale. Full NPC runtime/save/performance remains unverified. |
| inherited 7d00481 | SAFE_COMMON candidate, `arch/sites.ts` Hook partition | x2599→2598, focused compiled/tick/door/reload proof PASS (2 tests) | Geometry only, no source ID or sourceMap digest edit intended | NPC still has original partition; focused Solo proof passes; NPC collision suite still required before port. |

Replay procedure: fetch actual NPC HEAD; archive its source into ignored workspace (no branch switch), apply selected patch with `git apply --check`, add new focused tests, run NPC app typecheck and impacted tests. Re-check if NPC HEAD changes. Full HumanWorld custody/offscreen/save/visual tests required by integration owner before merge. Never cherry-pick entire Solo branch.
