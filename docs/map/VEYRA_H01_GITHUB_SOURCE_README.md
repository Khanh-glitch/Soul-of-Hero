# VEYRA H01 — Approved Map Source Snapshot

**SOURCE ON GITHUB: YES — source files are committed under `web/` on this branch.**
**INTEGRATED INTO GAMEPLAY RUNTIME: NO — ownership/seams are not wired here.**

Source custody:
- Approved Creator handoff: `VEYRA_CURRENT_H01_SOURCE_FIXED.zip`
- ZIP SHA-256: `e08a34e5ee19c4cd1e7447002d387e88636303dcedcb08440155587654820248`
- Map-only archive: `map_sources/VEYRA_H01_APPROVED_SOURCE_ONLY.tar.gz`
- Archive SHA-256: `08920f408f4cc3956d46ea9532ad4dd994c6010a76c44910d45d0d304f68b583`
- Verified 95 map-owned source files imported, including `web/src/veyra05/arch/f01.ts`, `web/src/veyra05/arch/sites.ts`, `web/src/veyra05/poi-arch.generated.ts` and all required geography and `web/src/game/veyra` modules.
- Source docs: `web/veyra_source_docs/ARCHITECTURE_HANDOFF.md` and `SOURCE_CUSTODY.json`.
- All 81 canonical POI IDs are present in the authoring handoff. The H01 triad is `po_hook`, `po_oasis`, `po_cindercamp`.
- C03 has **not** been accepted or imported.

## Integration instructions (Gameplay agent)
The source branch is built from Gameplay `arena/a9d7aa20-soul-of-hero` at `6bcb71247322dba610ddae90977d8a2d1a955d55` and adds map-owned paths **without replacing Gameplay's current `web/src/game/engine.ts`, `sim.ts`, `render.ts`, `persist.ts`, `world.ts`, etc.**

Copy/cherry-pick **ONLY the map-owned additions** from this branch into PR #45's staging, then reconcile Game-owned engine/world/sim/render/persistence/UI entry points deliberately. Do not merge this source branch blindly into Gameplay production; it has not been runtime integrated.

Required live acceptance:
normal Start at 640×360 → Unified World → gameplay; isolated Creator Inspect → original three bespoke + H01 three; window edge transition and back; save/reload preserving all Gameplay MEC-01 authority and item/UID custody; genuine screenshots of actual POIs.

No branch or PR merge without Creator approval.
