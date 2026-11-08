# VEYRA H01 → Web Gameplay: staging intake (2026-11-08)

**STATUS: SOURCE INTAKE / INTEGRATION NOT YET IMPLEMENTED. Not playable or merge-ready from this branch.**

## Authority & frozen inputs
- Target base: `arena/d4bfcfff-soul-of-hero` at `2a4db2a62a78a874df3931f4856fe2fe7cc7c1e8`; branch is created from this exact commit, **not** from `main`.
- Map input: **`VEYRA_CURRENT_H01_SOURCE_FIXED.zip`** supplied by the Creator in the Arena handoff. SHA-256: `e08a34e5ee19c4cd1e7447002d387e88636303dcedcb08440155587654820248`.
- This ZIP is authoritative **for VEYRA map/environment/art/POIs only**. Its `src/game/**`, `src/ui/**`, build configs and tests are earlier snapshot integrations and **must never replace newer Gameplay files wholesale**.
- Main locations to preserve: 81 canonical POIs, the original bespoke Greywater/Argus/Ironholm, H01 (`po_hook`, `po_oasis`, `po_cindercamp`) and F01 settlement methods.
- Reference source code in ZIP: `src/veyra05/**`, `geography/veyra-lr01/**`, `geography/veyra-lr02/**`, `src/game/veyra/**`; inspect `docs/SOURCE_CUSTODY.json`, `src/veyra05/integration-manifest.ts` and `docs/ARCHITECTURE_HANDOFF.md` before porting.
- Actual H01 authoring lives in `src/veyra05/arch/sites.ts` and `src/veyra05/arch/f01.ts`; exact code from ZIP must be imported, not replaced with placeholders. The authored H01 POI IDs are `po_hook`, `po_oasis`, `po_cindercamp`.

## What is different in the two trees
- ZIP's Gameplay-derived code was synchronized to an older Gameplay commit; newer Gameplay now has extra work in `engine`, `persist`, `core`, `catalog`, `world`, `sim`, `render`, economy and UI.
- The current Gameplay branch does **not** contain `web/src/veyra05/`. The ZIP does. Port the map subsystem into `web/src/veyra05/` and the canonical geography into `web/geography/` first, then adapt the smallest necessary integration seams.
- Current `web/src/game/world-window.ts` is an identity-only helper: **it is not proof that a playable streaming world already exists in Gameplay**. Preserve gameplay-world identity and save invariants when adding window transitions.
- The ZIP's fixed standalone HTML was generated with an offline bridge from a previous bundle and is **not a substitute for a fresh build of the combined current sources**.

## Work order for Gameplay integration owner
1. Read the ZIP and compare with HEAD before any edit; verify ZIP SHA-256 and 81 canonical IDs. Record exact merged source/base SHAs.
2. Vendor the actual VEYRA-only code & geography without overwriting existing Gameplay source. Keep GOLD 4000×2800 coordinates and the 81 canonical POI identities unchanged.
3. Reconcile the minimum source seams one at a time: `world` layout registry and live windows; `core` identity; `sim` transition; `render` architecture; `engine` legal spawn/Creator inspection; `persist` durable identity/offscreen state; `Title` selection + fixed footer; `Game/App` inspection. Use ZIP `src/veyra05/integration-manifest.ts` only as a **historical diff guide**, not blindly applicable current code.
4. Keep older gameplay mechanics, cash/loot/resource authority, inventory and save logic. No legacy save erasure or fake static replacements.
5. Build the **combined tree** with the repo's installed build tooling; create one deployable HTML/static web artifact from that same source. Do not ship stale `SoulOfHero-*.html` checked into archives.
6. In browser verify: Start visible at 640×360 → Unified World → normal run; separate isolated Creator Inspect → three H01 POIs and original three; cross a world window edge and return; save/reload after traversal without duplication or lost state. Separate proof of genuine gameplay from source-level or mocked browser checks.
7. If blocked by tooling, preserve source and name the actual blocker; do not degrade gameplay/map to force a green test.
8. Report exact artifact, changed files, tests/visual observations, remaining blockers. Leave as draft; **no production merge** without Creator approval.

## Guardrails
Map owns canonical terrain, art, structures, floors, connectivity and possible interaction sockets. Gameplay owns interactions, persistence, loot and economy authority. Avoid inventing gameplay rules while porting map. Do not replace current Gameplay with ZIP's older runtime. Do not set acceptance from compilation alone.

## Next Arena rounds
Keep VEYRA map authorship independent and ingest only accepted triads. Current accepted map handoff is H01; C03 never produced a newer accepted ZIP. After integration, Arena resumes one three-POI design-family pilot at a time using a pinned source snapshot.
