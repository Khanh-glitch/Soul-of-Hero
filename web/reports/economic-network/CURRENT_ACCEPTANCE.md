# Soul of Hero (SOH) — Current Acceptance & Verification Ledger (`WP1`–`WP6`)

**Repository:** `Khanh-glitch/Soul-of-Hero`  
**Branch:** `arena/f561fd0d-soul-of-hero` (branched from `main` @ `82089fea0b28ad1662f9f04496271b92c74c03a7`)  
**Canonical Runtime Code SHA:** `ef4c9fdb71b8e13ebc623ba397a5c0c966daa983` (`ef4c9fd`)  
**WP4 CI Visual Verification Run:** [`43160172749`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/43160172749) (Job `130989184762`, `ubuntu-24.04`, `PASS` in `2m18s`)  
**WP4 Tracked Evidence Commit:** `6130550` (`web/evidence/veyra-economy-wp4/manifest.json` + `34` PNGs)  
**Verification Date:** `2026-11-12` (UTC)  
**Authority Sources:** `web/ref/bible.md`, `web/ref/OPERATIONS.md`, `web/reports/economic-network/M5_CANON_CORRECTIVE.md`, live TypeScript runtime (`web/src/game/*`, `web/src/ui/*`, `web/src/veyra05/*`).

> **Scope Boundary:** This document is the single canonical source of truth for runtime implementation status, automated verification coverage, visual browser evidence, and unresolved Creator/Map items after completion of `D1`–`D5` and `WP1`–`WP6`. Historical counterfactuals (`M3_*`, `M4_*`) remain preserved strictly as `DESIGN_PROPOSED` / partially `CANON_REJECTED` research artifacts.

---

## 1. Master Truth Matrix (`D1`–`D5`, `WP1`–`WP6`, `M1`–`M5`)

| Workstream / Deliverable | Truth Status Tags | Commit(s) | Exact Verified Scope |
|---|---|---|---|
| **D1 — Journey Cash-Mint Isolation** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN`, `VISUALLY_VERIFIED` | `5358ce6` → `ef4c9fd` (`6130550`) | `balance.v1.json` zeroes `journeyRequisitions.{ember,hearth,beacon}.securedCash = 0`. Claiming daily milestones delivers bounded run-local items only (`req:${date}:${milestone}:0`) with ground-drop overflow (`giveOrDrop`), mapped via `supply_requisition` cues (`presentation-cues.ts`, `ui/Journey.tsx`). Physical Ragnarok `escrow_chest` remains the sole `profile.securedCash` source. Browser Phase A confirms `secured 0` after milestone inspect & reload (`02-profile-escrow.png`, `06-journey-waypoints.png`). |
| **D2 — Classic `BuildPanel` & `SurvivorScreen` Defense Parity** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN`, `VISUALLY_VERIFIED` | `5358ce6` → `7baa6d3` (`6130550`) | `catalog.ts` adds `'ir_sensor'` and `'bear_trap'` to `BUILD_ORDER` matching `BUILD_GROUPS.Defense`. `art.ts` registers `A.st` canvas sprites for `oil_pump`, `farm_controller`, `power_cable`, `power_switch`, `pressure_switch`, and `door_powered` so all `Devices` tiles render cleanly in production HTML without missing placeholders (`08-survivor-craft.png`, `0` empty `.px` imgs). |
| **D3 — Veyra `po_greywater` & `po_glade` Cache Materialization** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN` | `5358ce6` | `arch/sites.ts` relocates `po_greywater` L0 `Tackle Box` off `Cottage Ladder`; `arch/rest48.ts` provides `glade_sanctum` dry `T.FLOOR` for `po_glade`. Verified `24/24` authored caches, `58/58` archetype POIs, `680/680` authored POI props, `14,380/14,380` window props, and `0` blocked doors/stairs. |
| **D4 + `WP2` — Global Multi-Floor Physical Obstacle `wire-v1` Power & Decay Copy** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN` | `5358ce6`, `7fb3768`, `ef4c9fd` | `engine.ts` + `sim.ts` unify power resolution across `allRunEntities(r)` and `entityGlobalCoords` (`wireNodeOn`, `connectedPower`, `powerAllocation`, `basePowerBoundary`, `stepBasePower`, `syncElectricDoors`, `removeEntity`, `destroyOffscreenStructure`), enforcing Map/building wall obstacles across windows, isolating floors (`F-1`/`F0`/`F+1`), scaling in `O(N)` (`400+` nodes in `wp2-power-global-obstacles.test.ts`), and keeping exact parity between `1s` online steps and offline `settle()`. Fixes `12h` unprotected decay copy (`Game.tsx`, `journey.ts`) and aligns `stepBasePower` (`ef4c9fd`) to pass `b05-loot-matrix.test.ts`. |
| **D5 + `WP3` — Veyra `po_slag` Physical Foundry Recycler & Floor `-1` Proof** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN`, `VISUALLY_VERIFIED` | `5358ce6`, `77cbafd`, `ef4c9fd` (`6130550`) | `world.ts` anchors `VEYRA_RECYCLER_SITE = { poi: 'po_slag', tx: 2414, ty: 1896 }` on clear F0 `T.FLOOR` strictly when `isVeyra05Layout` is active (preserving legacy `direct-v1` saves). `wp3-veyra-recycler-integration.test.ts` proves natural Veyra harvest (`WP3_NATURAL_PROOF_ITEMS`, zero fixture item injection) → `damaged_drive` → real `X:drive` Foundry Recycler → `spares` → real Workbench L2 `vehicle_frame` craft → `base_generator` fuel build → physical stair to Floor `-1` (`Quench Drain`) save/reload & return. Visually confirmed in browser Phase B (`12`–`17` screenshots). |
| **WP1 — M5 Item & Route Audit Repair** | `RESEARCH_DELIVERED`, `TESTED` | `d293593` | `economic-audits-m5.ts` + `economic-network-m5-audits.test.ts` audit all **123** `ITEMS` (`SOH_ITEM_FUNCTION_AUDIT.csv`, `0` `UI_MISSING`) and **172** recipe/wreck/progression routes (`SOH_RECIPE_ROUTE_AUDIT.csv`, `0` `OVER_RETURN`), assigning honest multi-dimensional `verification_tier` labels (distinguishing runtime-tested, conditional, blocked-on-Veyra, and historical shipping-only items without inflating status). |
| **WP4 — Real-Browser Playwright Visual E2E & UI Layout Fixes** | `SOURCE_IMPLEMENTED`, `TESTED`, `VISUALLY_VERIFIED` | `269a089` → `6130550` | `.github/workflows/veyra-economy-wp4.yml` builds non-QA production HTTP bundle (`vite.http.config.ts`) and runs `web/e2e/veyra-economy-wp4.mjs` in Chromium across `1280x720` (`landscape-desktop`) and `640x360` (`compact-handheld`). Resolved `InventoryPanel` height clipping (`fee0649`), `ReturnDigest` vs `.waymark` HUD overlap (`7baa6d3`), and missing `Devices` sprite art (`7baa6d3`). Zero console/page errors and zero UI overlap across all `34` captured PNGs on `ef4c9fd`. |
| **M1 — Economic Multigraph & LI Crosswalk** | `RESEARCH_DELIVERED`, `TESTED` | `19a0a8e` → `5358ce6` | `SOH_ECONOMIC_GRAPH.json` (`597` nodes, `2,040` edges, `25` gates, `0` validation errors) + `SOH_LI_ECONOMIC_CROSSWALK.csv` (`222` LI rows). |
| **M2 — 8-Suite Runtime Simulation & MC Audit** | `RESEARCH_DELIVERED`, `TESTED` | `7d82c34` → `5358ce6` | `M2_SIMULATION_RESULTS.json`: `8/8` suites pass (`24/24` authored caches, `58/58` arch caches, `0` Journey `securedCash`, `N=400` MC Veyra `wreckDamagedDrives80Units` mean `17.43`). Hypothetical 336h archetypes are strictly labeled `SIMULATION_ASSUMPTION`. |
| **M3 / M4 — Counterfactual Rebalance & Proposals `A1`–`A7`** | `DESIGN_PROPOSED`, `CANON_REJECTED` (on `A1`–`A7`) | `8a758b7` → `e0b98e3` | Historical counterfactual research only. `LOCKED_CANON` assertions in `tests/economic-network-m3.test.ts` prevent accidental application of rejected proposals `A1`–`A7`. |

---

## 2. Verification Ledger on Final Code SHA `ef4c9fd`

All workspace TypeScript, build, and automated unit/integration sweeps below ran directly on commit `ef4c9fdb71b8e13ebc623ba397a5c0c966daa983` (`ef4c9fd`, clean working tree prior to `WP5`/`WP6` doc commit):

| Check | Command (`cwd=/home/user/Soul-of-Hero/web`) | Result | Scope & Notes |
|---|---|---|---|
| **App TypeScript** | `npm run typecheck` (`tsc --noEmit -p .`) | **PASS (`0` errors)** | Full client runtime (`src/`) |
| **Test TypeScript** | `npm run typecheck:tests` (`tsc --noEmit -p tsconfig.test.json`) | **PASS (`0` errors)** | All test suites (`tests/`, `src/**/*.test.*`) |
| **Single-File Production Build** | `npm run build` (`vite build`) | **PASS (`245 modules`)** | `dist/index.html` (`84,243.72 kB`, `gzip: 59,610.05 kB`) |
| **HTTP Production Build (WP4)** | `npx vite build --config vite.http.config.ts` | **PASS (`245 modules`)** | `dist-http/index.html` + chunked CSS/JS/assets (zero QA flags) |
| **Full Vitest Sweep — Batch 1a (`FILES[0..15]`)** | `npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:0:15}"` | **15/15 files PASS (`121` tests)** | Includes `review-r2-acceptance`, `audit-closure`, `phase-b-contracts`, `integrated-world`, `ecosystem-full`, `b03-*`, `b02-*`, `b01-*` |
| **Full Vitest Sweep — Batch 1b (`FILES[15..45]`)** | `npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:15:30}"` | **30/30 files PASS (`276` tests)** | Includes `cal01-world-calendar`, `control-tower-*`, `b1-*`, `b2-*`, `b04-*`, `b05-*` (incl. `b05-loot-matrix.test.ts` `7/7`), `creator-core-acquisition`, `c3-poi-power-feedback` |
| **Full Vitest Sweep — Batch 2 (`FILES[45..95]`)** | `npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:45:50}"` | **49 PASS / 1 pre-existing skip (`294` passed, `1` skipped)** | Includes `economic-network-m{1,2,3,5}*`, `d1-d5-corrective.test.tsx` (`5/5`), `m-core-03r-economy`, `mec01-*`, `industrial-power`, `k6-*`; sole skip is baseline `it.skip` in `tests/mec01-c3-offline-child.test.ts` |
| **Full Vitest Sweep — Batch 3 (`FILES[95..143]`)** | `npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:95}"` | **48/48 files PASS (`296` tests)** | Includes `wp3-veyra-recycler-integration` (`1/1`), `wp2-power-global-obstacles` (`3/3`), `veyra-*`, `w07-*`, `s06-*`, `territory-cabinet`, `soh`, `sys03-recycler`, `v17-*` |
| **Aggregate 143-File Suite Total** | `find src tests -name '*.test.*' \| sort` (`143` files) | **`142` active PASS (`1` baseline skip), `987` passed tests, `0` failures** | Every `.test.*` file in the web repository verified on `ef4c9fd` |

---

## 3. WP4 Real-Browser Visual Verification Scope & Artifact Index

**CI Workflow:** `.github/workflows/veyra-economy-wp4.yml` (Run `43160172749`, triggered on push to `ef4c9fd`, committed artifacts at `6130550`)  
**Harness:** `web/e2e/veyra-economy-wp4.mjs` against `vite preview --config vite.http.config.ts --host 127.0.0.1 --port 4173` (non-QA production build)

### Honest Scope Disclosure
1. **Phase A — `PURE_ZERO_FIXTURE_FRESH_BROWSER_RUN` (`01`–`11`):** Starts with clean browser storage, opens `New Game -> Veyra (U=0.5 GOLD)`, asserts Profile Escrow `securedCash === 0`, exercises real keyboard movement (`WASD`), verifies `Journey` HUD (`D1`), `BuildBar`, `SurvivorScreen -> Devices` sprite rendering (`D2`, incl. `Bear Trap` & `Base Generator`), `MapPanel`, `Esc` pause menu, and full `page.reload()` + `Continue` persistence.
2. **Phase B — `DISCLOSED_SAME_COMMIT_WP3_NATURAL_LOOP_SNAPSHOTS` (`12`–`17`):** Consumes two non-QA natural-run snapshots (`wp3_veyra_natural_loop`, `qaUsed: false`, `NOW = Date.now() - 1_200_000`) emitted during CI by `tests/wp3-veyra-recycler-integration.test.ts` directly from `ef4c9fd` (`SOH_WP3_SNAP_DIR`). These snapshots are loaded into the fresh browser context purely to reach long-haul industrial state (`po_slag` Foundry Recycler `X:drive`, built `Base Generator` + upgraded `Workbench L2` + crafted `Utility Frame`, and subterranean `Floor -1 Quench Drain`) cleanly, after which real UI clicks, HUD bounds assertions (`.hud-col--right` non-overlap between `ReturnDigest` and `.waymark`), `.sv-tile img.px` asset checks, and `page.reload()` transitions execute live inside Chromium.

### Captured Screenshots & Manifest (`web/evidence/veyra-economy-wp4/`, `34` PNGs)
- Viewports verified: **`1280×720`** (`landscape-desktop`) and **`640×360`** (`compact-handheld`).
- Both viewports recorded `verdict: "PASS"`, `errors: []`, `saveAudit: { layoutId: "veyra05-world", wreckEconomy: "recycler-v1", qaUsed: false, securedCash: 0, badReceipts: 0 }`:
  - `01-title.png` .. `11-reload-continue.png` (Phase A across `1280x720` and `640x360`)
  - `12-foundry-recycler-ui.png` .. `17-floor-return-0.png` (Phase B across `1280x720` and `640x360`)

---

## 4. Open Items (`STILL_BLOCKED` / `NEEDS_CREATOR_DECISION`)

These items remain intentionally untouched in runtime code pending Creator / Map authority or out-of-scope native builds:

1. **Missing Veyra Biome Sources (`M2-F01` / `A5`):** `chitin`, `beetle_horn`, `crawler_optic`, and `wolf_fang` have `0` static/creature spawns on Veyra, leaving `chitin_armor`, `essence_spirit` recipe craft (note `vampire_3` & Custodian direct drops exist), and `core_demon` recipe craft blocked on Veyra. Do **not** invent cross-species loot without Creator sign-off.
2. **Veyra Static Creator Cores & Tier-3 Core Unlock Design (`M2-F03`, `M2-F06` / `A4`, `A7`):** Veyra lacks Shipping's `CREATOR_LOOT_V1` static Core placements (`core_meteor`, `core_dragon`, `core_elsa`, `core_mjolnir`, `core_demon`) and Airdrop cadence; random research excludes `core_*`. Requires explicit Creator Core distribution decision.
3. **`oil_pump` Map Wellheads (`M2-F12`, `M2-F15`):** `oil_pump` remains gated behind `oilTestFixture` until Map ownership defines authorized oil wellhead tiles on Shipping/Veyra.
4. **`claimMinDistFromPoi` (`10` tiles) Guard (`M2-F08`):** `buildReason()` does not yet enforce minimum distance from POIs; pending UX check against early homestead starts.
5. **Creator Balance / Ledger Decisions (`M2-F05`, `M2-F10` / `A2`, `M2-F13` / `A3`, `M2-F16`):**
   - `base_generator` `fuel_can` (`60s` vs `coal` `80s`) and idle `1x` load allocation (`w07`/`s06` bound contract);
   - `24`-slot Territory Cabinet (`LOCKED_CANON`) and `0.25/day` upkeep credit UX;
   - `qty=1` `25%`-HP repair rounding vs cumulative fractional repair ledger;
   - Wild `crystal`/`sulfur` ceiling vs late Elder fight ammo economy.
6. **Godot Native Project (`/home/user/Soul-of-Hero/project.godot`):** Separate native workspace not built or verified in the `web/` Node/Vite/Playwright pipeline.
