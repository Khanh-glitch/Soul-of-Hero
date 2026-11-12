# Soul of Hero (SOH) — Economic Network Analysis, Audits & Acceptance (`M1`–`M5`, `D1`–`D5`, `WP1`–`WP6`)

**Repository:** `Khanh-glitch/Soul-of-Hero`  
**Audit Branch:** `arena/f561fd0d-soul-of-hero` (from `main` @ `82089fea0b28ad1662f9f04496271b92c74c03a7`)  
**Scope:** Canonical Acceptance Ledger (`CURRENT_ACCEPTANCE.md`, `WP5`), Economic Corrective Handoff (`SOH_ECONOMIC_HANDOFF.md`, `WP6`), Control Tower Canon Corrective & Item/Route CSV Audits (`M5_CANON_CORRECTIVE.md` + `WP1`), `D1`–`D5` / `WP2`–`WP4` runtime fixes & real-browser Playwright visual verification, multigraph extraction (`M1`), simulation (`M2`), and historical counterfactual study (`M3`/`M4` — **`DESIGN_PROPOSED` / partially `CANON_REJECTED`**).

---

## 1. Deliverables Index & Strict Verification Status

| Milestone | Artifact | Status Tag | Verification / Ground Truth |
|---|---|---|---|
| **WP5 Acceptance** | **`CURRENT_ACCEPTANCE.md`** | **`SOURCE_OF_TRUTH`** | Canonical verification ledger on final runtime SHA `ef4c9fd` & `WP4` CI Run [`43160172749`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/43160172749) (`6130550`): `142/143` active test files green (`1` baseline skip), `987` passed tests, `34` Chromium screenshots (`1280×720` & `640×360`), honest Phase A/B scope & `STILL_BLOCKED` register. |
| **WP6 Handoff** | **`SOH_ECONOMIC_HANDOFF.md`** | `SOURCE_IMPLEMENTED`, `TESTED`, `PHYSICALLY_PROVEN`, `VISUALLY_VERIFIED` | Consolidated truth taxonomy across `D1`–`D5`, `WP1`–`WP6`, and `M1`–`M5` referencing exact SHAs, CSV row counts, Playwright CI evidence, and remaining Creator/Map decisions. |
| **M5 Corrective** | `M5_CANON_CORRECTIVE.md` | `RESEARCH_DELIVERED` | Reclassifies all M2 findings & `A1`–`A7` rejections; separates 7 Creator Cores vs 4 Legacy Cores. |
| **M5 Audits (`WP1`)** | `SOH_ITEM_FUNCTION_AUDIT.csv` | `RESEARCH_DELIVERED`, `TESTED` | Complete audit across all **123** `ITEMS` (`0` `UI_MISSING`, 17 honest `verification_tier` values, updated post-`D1`–`D5` & `WP1`). |
| **M5 Audits (`WP1`)** | `SOH_RECIPE_ROUTE_AUDIT.csv` | `RESEARCH_DELIVERED`, `TESTED` | Complete audit across all **172** recipe/wreck/progression routes (`0` `OVER_RETURN`, 29 honest `verification_tier` values, post-`D5` `po_slag` routes live). |
| **WP4 Visual Evidence** | `web/evidence/veyra-economy-wp4/` (`manifest.json` + 34 PNGs) | `VISUALLY_VERIFIED` | Captured by `.github/workflows/veyra-economy-wp4.yml` (`ubuntu-24.04`, `web/e2e/veyra-economy-wp4.mjs`) against non-QA `vite.http.config.ts` build at `ef4c9fd` (`verdict: "PASS"`, `errors: []`). |
| **M1** | `TASK_BRIEF.md`, `LI_SOURCE_EVIDENCE.md`, `SOH_ECONOMIC_GRAPH.json`, `SOH_LI_ECONOMIC_CROSSWALK.csv`, `M1_GRAPH_REPORT.md` | `RESEARCH_DELIVERED`, `TESTED` | `economic-network-m1.test.ts` (**597** nodes, **2,040** edges, **222** LI rows, `24/24` Veyra authored caches, `damaged_drive` live on Veyra). |
| **M2** | `M2_SIMULATION_RESULTS.json`, `M2_AUDIT_REPORT.md` | `RESEARCH_DELIVERED`, `TESTED` | `economic-network-m2.test.ts` (**8/8** tests; `24/24` authored, `58/58` arch caches, `0` Journey `securedCash`). |
| **M3** | `M3_BEFORE_AFTER_SIM.json`, `M3_REBALANCE_SPEC.md`, `M3_RISK_REGISTER.md` | `DESIGN_PROPOSED` / contains `CANON_REJECTED` | Historical counterfactual study only (`A1`–`A7` rejected per `M5_CANON_CORRECTIVE.md`, **NOT `SOURCE_IMPLEMENTED`**). |
| **M4** | `M4_MASTER_BLUEPRINT.md` | `DESIGN_PROPOSED` (Superseded) | Unapproved roadmap superseded by `M5_CANON_CORRECTIVE.md`, `SOH_ECONOMIC_HANDOFF.md`, and `CURRENT_ACCEPTANCE.md`. |

### Accompanying Source, E2E & Verification Modules

- `web/src/game/economic-graph.ts` & `web/tests/economic-network-m1.test.ts` — M1 multigraph builder & structural invariant suite (`soh.economic-graph.v1`)
- `web/src/game/economic-sim-audit.ts` & `web/tests/economic-network-m2.test.ts` — M2 8-suite live engine & Monte Carlo auditor (`8/8` tests)
- `web/src/game/economic-rebalance-m3.ts` & `web/tests/economic-network-m3.test.ts` — M3 counterfactual simulator & `LOCKED_CANON` guards (`3/3` tests)
- `web/src/game/economic-audits-m5.ts` & `web/tests/economic-network-m5-audits.test.ts` — M5 / `WP1` 123-item & 172-route CSV audit generator (`2/2` tests)
- `web/tests/d1-d5-corrective.test.tsx` — `D1`–`D5` end-to-end corrective proof (`5/5` tests)
- `web/tests/wp2-power-global-obstacles.test.ts` — `WP2` global/multi-floor obstacle & `O(N)` `wire-v1` proof (`3/3` tests)
- `web/tests/wp3-veyra-recycler-integration.test.ts` — `WP3` natural Veyra harvest -> `po_slag` Foundry Recycler -> `spares` -> Floor `-1` reload proof & `SOH_WP3_SNAP_DIR` producer (`1/1` test)
- `web/e2e/veyra-economy-wp4.mjs` & `.github/workflows/veyra-economy-wp4.yml` — `WP4` real-browser Playwright visual verification across `1280×720` and `640×360`

---

## 2. Historical Counterfactual Reference: M2 Baseline vs `M3_PROPOSED_V1`

> **Notice:** This scorecard documents the **historical `M3_PROPOSED_V1` counterfactual experiment only** (contains `CANON_REJECTED` proposals `A1`–`A7` and unapproved tuning). For **actual shipped runtime fixes and verified acceptance status**, always consult **[`CURRENT_ACCEPTANCE.md`](./CURRENT_ACCEPTANCE.md)** and **[`SOH_ECONOMIC_HANDOFF.md`](./SOH_ECONOMIC_HANDOFF.md)**.

| Domain / KPI | Baseline (M2 Live) | Target (`M3_PROPOSED_V1`) | Impact | Ref |
|---|---:|---:|---|---|
| **Veyra 81-POI Cache Materialization** | `23/24` authored, `57/58` arch | **`24/24` authored, `58/58` arch** | `81/81` POIs 100% functional *(shipped in `D3`)* | `M2-F02` / `PR-ECON-01` |
| **Veyra Uncraftable/Broken Item Paths** | `3` recipes, `3` specimens dead | **`0` broken recipes/specimens** | Counterfactual only (`A5` `CANON_REJECTED`) | `M2-F01` / `PR-ECON-01` |
| **Veyra Static Cores / BPs / Wrecks / Airdrops** | `0` Cores, `6` BPs, `0` drives/drops | **`5` Cores, `8` BPs, `16.14` drives, `14` drops** | `po_slag` Recycler shipped in `D5`; Cores/Airdrops remain `STILL_BLOCKED` (`A4`) | `M2-F03` / `PR-ECON-05` |
| **Veyra Spawn-Window Local Iron (`P50`)** | `0` nodes (only 5/12 scenes) | **`14` nodes (`min = 14`)** | Counterfactual only (`A6` `CANON_REJECTED`) | `M2-F09` / `PR-ECON-05` |
| **Brick Citadel Cabinet Autonomy** | `31.22 h` (`25%/d`, 24 slots, 9 mats) | **`496.55 h` (`10%/d`, 32 slots, 5 mats)** | Counterfactual only (`A2` `CANON_REJECTED`) | `M2-F10` / `PR-ECON-02` |
| **POI Claim Minimum Radius Guard (`10` tiles)** | Bypassed (`dist = 9` allowed) | **Enforced (`< 10` rejected)** | Pending Creator UX check (`STILL_BLOCKED`) | `M2-F08` / `PR-ECON-02` |
| **`qty=1` Structure 25%-HP Repair Overcharge** | `17` pairs charge `100%` rebuild | **`0` overcharge pairs** | Counterfactual only (`A3` `CANON_REJECTED`) | `M2-F13` / `PR-ECON-02` |
| **`base_generator` `fuel_can` Active Hours** | `0.33 h` Shipping / `0.18 h` Veyra | **`13.96 h` Shipping / `16.10 h` Veyra** | `w07`/`s06` bound contract; balance `STILL_BLOCKED` | `M2-F05`, `M2-F12` / `PR-ECON-03` |
| **Idle Empty Campfire Burn (10 min)** | `30` wood burned unattended | **`0` wood (`warmthMode` explicit)** | `b03-thermal` intended warmth; copy fixed (`12h`) in `D4` | `M2-F11` / `PR-ECON-03` |
| **Journey Requisition / Vendor Cap Ratio** | `7.74×` (`588` vs `76` cap) | **`0.61×` (`98` vs `160` cap)** | **`D1` zeroed Journey `securedCash` (`0/day`, `A1` rejected)** | `M2-F04` / `PR-ECON-04` |
| **Spares to First Random Core (`P50`, $N=400$)** | `108` fixed (`min/p50/max = 108`) | **`32` (`mean = 35.89`)** | Counterfactual only (`A7` `CANON_REJECTED`) | `M2-F06` / `PR-ECON-04` |
| **Classic `BuildPanel` Defense Parity** | `2` missing (`ir_sensor`, `bear_trap`) | **`0` missing keys** | Full UI parity *(shipped in `D2` + `WP4`)* | `M2-F07` / `PR-ECON-04` |
| **Wild Crystal `energy_refined` Cap (Shipping)** | `372` max charges | **`620` max charges (`+66.67%`)** | Counterfactual only (`BALANCE_HYPOTHESIS`) | `M2-F16` / `PR-ECON-04` |
| **Live Recycler Anti-Arbitrage (`OVER_RETURN`)** | `0` (`9/9` live rules clean) | **`0` (`LOCKED_CANON` verified)** | Zero item duplication *(verified)* | `M2-F14` / `PR-ECON-06` |

---

## 3. Reproducing All Audits, Corrective Proofs & Visual E2E

Run from `/home/user/Soul-of-Hero/web`:

```bash
# 1. Type safety across runtime and tests
npm run typecheck && npm run typecheck:tests

# 2. Production bundles (single-file + WP4 HTTP split build)
npm run build && npx vite build --config vite.http.config.ts

# 3. Corrective runtime proofs (D1-D5, WP2 global power obstacles, WP3 natural Veyra loop)
npx vitest run --testTimeout=120000 tests/d1-d5-corrective.test.tsx tests/wp2-power-global-obstacles.test.ts tests/wp3-veyra-recycler-integration.test.ts

# 4. Milestone M1-M5 audit suites
npx vitest run --testTimeout=120000 --fileParallelism=false tests/economic-network-m{1,2,3,5}*.test.ts

# 5. Full 143-file test suite sweep (sequential batches recommended for <450s runtime)
mapfile -t FILES < <(find src tests -name '*.test.*' | sort)
npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:0:15}"
npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:15:30}"
npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:45:50}"
npx vitest run --testTimeout=120000 --fileParallelism=false "${FILES[@]:95}"

# 6. WP4 Real-Browser Playwright Visual E2E (requires Playwright Chromium + preview server on :4173)
SOH_WP3_SNAP_DIR=/tmp/wp3-snaps npx vitest run --testTimeout=120000 tests/wp3-veyra-recycler-integration.test.ts
npx vite preview --config vite.http.config.ts --host 127.0.0.1 --port 4173 &
node e2e/veyra-economy-wp4.mjs
```
