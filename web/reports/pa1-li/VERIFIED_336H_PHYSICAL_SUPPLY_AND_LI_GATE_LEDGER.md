# PA1 × Last Island — Physical Economy & 336h Audit Handoff (2026-11-13)

**Canonical verdict: AUDIT TESTS PASS, PLAYER REACHABILITY/BALANCE NOT ACCEPTED.** This branch is an audit-only overlay atop PA1 draft PR #56; no catalog recipe, map loot, balance, or production engine behavior was modified. Do not merge into production as proof of game economy quality.

**Same SHA:** `ca2a8aee43420cfabce6ad98cd8492f645032160`.
**Evidence:** [Actions #43376540509](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/43376540509) two jobs PASS:
- `economic-runtime`: full `tsc`, legacy 8-suite 336h/400-seed M2 audit, M5 catalog/route audits, new PA1 actual-vs-paper gate test — **11/11 tests pass**.
- `full-world-physical`: 11.2m-tile 4000×2800 **terrain-only** raster and 30 actual bounded collision-window source/spawn probes — **2/2 pass**.
- Artifacts on same run: `pa1-li-m2-m5-source-evidence-ca2a8ae...`, `pa1-li-veyra-full-world-source-evidence-ca2a8ae...`.

## Reproduced and sourced results

| Metric | Measured value | Evidence boundary |
| --- | --- | --- |
| Current runtime | 147 item IDs, 113 recipes; 15 Building forms | `web/tests/pa1-li-reality-gates.test.ts`, HEAD PA1 |
| Approved paper v1.1 | 148 proposed item IDs, 128 active recipes | **DESIGN ONLY**, not game code; SHA256 `b45b157e27f39688d22cc1319de43fec663aecbed8b63bd5b2cb92a6831c5537` |
| Global Veyra | 11.2M exact terrain tiles + 4-neighbor components | Terrain passability is only upper bound; no enemies, doors, player travel |
| Representative localities | 30 samples; 13 legal spawn, 17 rejected | 17 rejected are mostly non-spawn localities, not proven defects |
| Actual collision BFS ≤175 steps, one 200×200 window | Scrap reachable 11/30; ore reachable 3/30; loot containers reachable 4/30 | No across-window travel, pickup action, cargo, hunger, path-back or hazard proof |
| Paid PA1 fortifier over 336 hours | Shipping 617 upkeep units/18 protected structures; Veyra 494/17 | **Fixture-material-funded**, different building layouts; NOT natural progression |
| Casual 2h-active + 22h-offline/day scenario | 14 deaths/14 days, no `startRest` supplied-bed scenario | Does not establish bed/offline mechanic is inherently broken |
| POI claim distance | `BAL.economy.claimMinDistFromPoi=10`; **validly placed at 9** | Real PA1 craft of claim pack + source-run engine placement; FAIL distance law |
| One-load base generator | 1 Fuel Can / 60s → 20,160 cans for 14 days continuously active | Pathological continuous load scenario; active/idle mix still untested |
| Research | 78 recipes known at start, 26 unknown non-core, 104 Spares before first random Core | Current runtime; v1.1 11-family one-fee research NOT implemented |
| Legacy drops on Veyra | chitin, beetle_horn, crawler_optic, wolf_fang missing creature source in M5 | Do not relabel "available" or conjure POI loot |

### Why the old M2 failed and how it was fixed

Old M2 harness attempted direct raw-paid `build(claim|furnace|workbench|chest...)` and direct `wall_brick`/ `door_iron` after PA1 introduced **craft real packed UID → place** and **upgrade from wood**. Therefore its "no claim upkeep" and "cannot claim near POI" results were **false evidence**. This branch repairs the **test harness only** in `src/game/economic-sim-audit.ts`, using real paid `craft` then real `build` intent and valid cabinet upgrade; old assertions retained unchanged. With that repair, all M2 suites pass **and the claim-distance exploit is reproducible**. Fixture supplies are explicit and NOT natural harvesting.

### Optimistic integer-MILP industrial bounds — *not gameplay proof*

The external paper v1.1 model (full script and JSON delivered in user evidence package, source SHA in manifest) uses 128 recipes, one-time family fees, station costs and finite vendors. Basic wild harvest ingredients are treated as unlimited but require no travel, transport, risk or combat. `pump_crude` requires a genuine oil source authority, so zero-input crafting was expressly disabled (otherwise it falsely mints free petroleum).
- One Motorbike Kit, **no lucky POI loot**, up to **4 vendor Salvaged Oil**: **45 externally earned Spares** optimistic minimum.
- Same setup without vendor oil and lucky loot: **infeasible in those constrained inputs** (not globally impossible in game).
- One externally looted Fuel Can: **21 Spares** optimistic minimum, conditional on that real loot.
- Forced Refinery Fuel Can route, vendor oil max3: **47 Spares**.
- First Mechanical Gear: **4 Spares** optimistic minimum.
This mathematical model does NOT assert any of these are physically reachable, or attainable in 336h.

### What we can and cannot learn from Last Island

Read `web/ref/atlas` and `web/reports/economic-network/LI_SOURCE_EVIDENCE.md`, not mythical "one definitive Last Island recipe law". 132 aggregated LI ID labels /58 historical formulas are **cross-era partial** evidence; 82 recorded loot edges are not probabilities; LI outputs are UNKNOWN. LI 2019 blueprint research is not identical to LI's 2026 **Zombie Horde Trial mode**, which unlocks recipes via Territory Cabinet progression. SOH should learn **multiple physical acquisition routes + meaningful competing sinks + time/distance costs**, not copy LI's old material quantities and declare success.

## Prioritized gates (must pass before implementing whole paper)

1. **P0 Claim/POI**: enforce map-aware minimum distance 10, including when claim pack exists. Failed build must preserve UID and materials; prove Shipping and Veyra at 9/10/11 tiles.
2. **P0 Physical supply**: certify source/POI identity and accessibility for Spares, Mechanical Parts, Oil, iron/coal/scrap across windows, from actual spawn, with loot chances and P10/P50/P90 outcomes.
3. **P0 Motorbike**: demonstrable New Run→acquire iron/scrap/oil→physical workbench→tech→part craft→fuel→ride→return→save/relaunch, no injected items, 336h time limit.
4. **P0 Fuel**: base generator active/idle/offline loads and economics; do not change POI generator accidentally.
5. **P1 One-time family research**: implement paper 148/128 with atomic payments and versioned old-job/save migration after previous gates; do not silently migrate historical LI assumptions.
6. **P1 Visual and playability**: inspect screenshots on current production scene and human play session, not just build logs.

**Disposition: HOLD production merge.** Verification is measured and delivered; complete LI gameplay parity and PA1 real-world item reachability are NOT proven.
