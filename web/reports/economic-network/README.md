# Soul of Hero (SOH) — Economic Network Analysis, Audit & Rebalance Blueprint (`M1–M4`)

**Repository:** `Khanh-glitch/Soul-of-Hero`  
**Audit Branch:** `arena/f561fd0d-soul-of-hero` (from `main` @ `82089fea0b28ad1662f9f04496271b92c74c03a7`)  
**Scope:** Complete economic graph extraction, multi-archetype & Monte Carlo runtime auditing (`Shipping` + `81-POI Veyra`), non-breaking counterfactual rebalance design, and PR-by-PR engineering integration blueprint.

---

## 1. Deliverables Index

| Milestone | Artifact | Purpose | Verification / Ground Truth |
|---|---|---|---|
| **M1** | `TASK_BRIEF.md` | Project charter, authority hierarchy, provenance rules, acceptance criteria | Reviewed |
| **M1** | `LI_SOURCE_EVIDENCE.md` | Provenance ledger across repo LI archive (`web/ref/atlas/*`, `bible.md`) & live LI docs | Verified URLs & hashes |
| **M1** | `SOH_ECONOMIC_GRAPH.json` | Machine-readable multigraph: **595** nodes, **2,037** directed edges, **25** gates | `economic-network-m1.test.ts` |
| **M1** | `SOH_LI_ECONOMIC_CROSSWALK.csv` | **222**-row reconciliation across LI (`S01..S17`, `XEDGE`, `A00..A31`, `H01..H36`, `U01..U12`) & SOH | Byte-deterministic |
| **M1** | `M1_GRAPH_REPORT.md` | Full structural topology, gate inventory, and static 81-POI audit report | `economic-network-m1.test.ts` |
| **M2** | `M2_SIMULATION_RESULTS.json` | Complete 8-suite empirical simulation output (`0h–336h`, 4-season `settle()`, $N=400$ MC, 16 probes) | `economic-network-m2.test.ts` (8/8 pass) |
| **M2** | `M2_AUDIT_REPORT.md` | Comprehensive simulation findings & 16 live code-proven defects (`M2-F01`–`M2-F16`) | Verified verbatim from JSON |
| **M3** | `M3_BEFORE_AFTER_SIM.json` | Deterministic counterfactual simulation comparing M2 baseline vs `M3_PROPOSED_V1` | `economic-network-m3.test.ts` |
| **M3** | `M3_REBALANCE_SPEC.md` | Concrete tuning equations, file targets, and `LOCKED_CANON` invariant proof | Verified `6/6` canon checks |
| **M3** | `M3_RISK_REGISTER.md` | Save-migration, anti-exploit, rollback, and edge-case guardrail register (`M3-R01`–`M3-R11`) | Verified |
| **M4** | `M4_MASTER_BLUEPRINT.md` | Implementation-ready **6-PR** engineering roadmap, code/schema diffs, & telemetry thresholds | Traceable to line anchors |
| **M4** | `README.md` | Executive summary & reproduction guide (this index) | Final deliverable |

### Accompanying Source & Test Modules (Non-Breaking)

- `web/src/game/economic-graph.ts` — M1 multigraph builder & validator (`soh.economic-graph.v1`)
- `web/tests/economic-network-m1.test.ts` — M1 Vitest structural invariant & generator suite
- `web/src/game/economic-sim-audit.ts` — M2 8-suite live engine & Monte Carlo auditor (`soh.economic-sim-audit.v1`)
- `web/tests/economic-network-m2.test.ts` — M2 Vitest verification suite (`8/8` tests)
- `web/src/game/economic-rebalance-m3.ts` — M3 counterfactual rebalance simulator (`soh.economic-rebalance-m3.v1`)
- `web/tests/economic-network-m3.test.ts` — M3 Vitest `LOCKED_CANON` & Before/After suite

---

## 2. Executive Scorecard: Before (M2 Audit) vs After (`M3_PROPOSED_V1`)

| Domain / KPI | Baseline (M2 Live) | Target (`M3_PROPOSED_V1`) | Impact | Ref |
|---|---:|---:|---|---|
| **Veyra 81-POI Cache Materialization** | `23/24` authored, `57/58` arch | **`24/24` authored, `58/58` arch** | `81/81` POIs 100% functional | `M2-F02` / `PR-ECON-01` |
| **Veyra Uncraftable/Broken Item Paths** | `3` recipes, `3` specimens dead | **`0` broken recipes/specimens** | 100% ecology parity | `M2-F01` / `PR-ECON-01` |
| **Veyra Static Cores / BPs / Wrecks / Airdrops** | `0` Cores, `6` BPs, `0` drives/drops | **`5` Cores, `8` BPs, `16.14` drives, `14` drops** | Full progression parity | `M2-F03` / `PR-ECON-05` |
| **Veyra Spawn-Window Local Iron (`P50`)** | `0` nodes (only 5/12 scenes) | **`14` nodes (`min = 14`)** | Eliminates early-game softlocks | `M2-F09` / `PR-ECON-05` |
| **Brick Citadel Cabinet Autonomy** | `31.22 h` (`25%/d`, 24 slots, 9 mats) | **`496.55 h` (`10%/d`, 32 slots, 5 mats)** | **`15.90×`** autonomy gain | `M2-F10` / `PR-ECON-02` |
| **POI Claim Minimum Radius Guard (`10` tiles)** | Bypassed (`dist = 9` allowed) | **Enforced (`< 10` rejected)** | Closes landmark griefing | `M2-F08` / `PR-ECON-02` |
| **`qty=1` Structure 25%-HP Repair Overcharge** | `17` pairs charge `100%` rebuild | **`0` overcharge pairs** | Eliminates early repair trap | `M2-F13` / `PR-ECON-02` |
| **`base_generator` `fuel_can` Active Hours** | `0.33 h` Shipping / `0.18 h` Veyra | **`13.96 h` Shipping / `16.10 h` Veyra** | **`42.3×`–`89.4×`** runtime + `0` idle drain | `M2-F05`, `M2-F12` / `PR-ECON-03` |
| **Idle Empty Campfire Burn (10 min)** | `30` wood burned unattended | **`0` wood (`warmthMode` explicit)** | Stops fuel leak safely | `M2-F11` / `PR-ECON-03` |
| **Journey Requisition / Vendor Cap Ratio** | `7.74×` (`588` vs `76` cap) | **`0.61×` (`98` vs `160` cap)** | Restores `rcash` + `escrow` loop | `M2-F04` / `PR-ECON-04` |
| **Spares to First Random Core (`P50`, $N=400$)** | `108` fixed (`min/p50/max = 108`) | **`32` (`mean = 35.89`)** | `-66.8%` grind, Tier-3 lock intact | `M2-F06` / `PR-ECON-04` |
| **Classic `BuildPanel` Defense Parity** | `2` missing (`ir_sensor`, `bear_trap`) | **`0` missing keys** | Full UI parity | `M2-F07` / `PR-ECON-04` |
| **Wild Crystal `energy_refined` Cap (Shipping)** | `372` max charges | **`620` max charges (`+66.67%`)** | Supports 6-Elder Signature fight | `M2-F16` / `PR-ECON-04` |
| **Live Recycler Anti-Arbitrage (`OVER_RETURN`)** | `0` (`9/9` live rules clean) | **`0` (`LOCKED_CANON` verified)** | Zero item duplication | `M2-F14` / `PR-ECON-06` |

---

## 3. Reproducing All Audits & Verification Suites

Run from `/home/user/Soul-of-Hero/web`:

```bash
# 1. Type safety across runtime and tests
npm run typecheck && npm run typecheck:tests

# 2. Production bundle verification
npm run build

# 3. Milestone M1 — Multigraph Extraction & LI Crosswalk (~5s)
npx vitest run tests/economic-network-m1.test.ts

# 4. Milestone M2 — Full 8-Suite Runtime & N=400 Monte Carlo Audit (~120s)
npx vitest run tests/economic-network-m2.test.ts

# 5. Milestone M3 — Counterfactual Before/After Simulation & LOCKED_CANON Proof (~2s)
npx vitest run tests/economic-network-m3.test.ts

# 6. Full baseline regression check (existing gameplay, recycler & persistence suites)
npx vitest run
```
