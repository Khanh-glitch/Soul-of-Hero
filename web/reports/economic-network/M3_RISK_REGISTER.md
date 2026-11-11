# Milestone M3 Risk Register (`DESIGN_PROPOSED` — Counterfactual Policy Risks)

> **CONTROL TOWER STATUS BANNER (`M5_CANON_CORRECTIVE.md`):**
> - **Artifact Status:** `RESEARCH_DELIVERED` / `DESIGN_PROPOSED` (Non-authoritative counterfactual risk study; **NOT approved for runtime rollout**).
> - Entries referencing `32` cabinet slots (`A2`), `7/day` Journey cash (`A1`), `fuel_can=360s` / zero-load idle cutoff (conflicts with `tests/w07-power-offline-parity.test.ts:82` & `tests/s06-circuits.test.ts:31`), random Core unlocks (`A7`), or forced Veyra drops/ores (`A5`/`A6`) are **`CANON_REJECTED`** or **`REQUIRES_CREATOR_DECISION`** per `M5_CANON_CORRECTIVE.md`.

**Scope:** Risk identification, save/backwards-compatibility controls, exploit/regression bounds, and rollback triggers across the `M3_PROPOSED_V1` counterfactual deltas defined in `M3_REBALANCE_SPEC.md`.

---

## 1. Save Compatibility & Migration Risks

| Risk ID | Target Change | Failure Mode | Severity | Mitigation & Compatibility Contract | Verification Test |
|---|---|---|---|---|---|
| **M3-R01** | `STRUCTS.claim.slots: 24 -> 32` (`M2-F10`) | Existing saved runs hold `Container.slots.length === 24` inside `r.custody`. Expanding catalog alone breaks UI or fails to upgrade in-progress saves. | **MEDIUM** | In `persist.validate()`, extend existing `claim` custody arrays dynamically (`while (c.slots.length < STRUCTS.claim.slots) c.slots.push(null)`), additive-only, zero truncation on older slots. | `b1-integrity.test.ts` / `b1-storage.test.ts` + new migration test loading 24-slot snapshot and asserting length `32`. |
| **M3-R02** | `oilRefineryV1.recipes.crude` yield (`1 -> 2` cans) (`M2-F05`/`M2-F12`) | In-flight refinery queue jobs serialized before patch store old recipe reference or expect `1` output. | **LOW** | Keep legacy `'crude'` qty fallback or bump recipe id `'crude-v2'` for new jobs while honoring in-flight `'crude'` jobs (identical pattern to `recycler.ts` `X:recover-v2` vs `X:recover-v3`). | `station-migration` test verifying both queued legacy `'crude'` and new `'crude-v2'` jobs commit deterministically. |
| **M3-R03** | `BAL.territory.materials` trimmed (`M2-F10`) | Pre-patch `cabinet.credit` may hold fractional credit for `spares`, `mechanical_parts`, `fasteners`, or `glass`. | **LOW** | `stepTerritory` iterates `Object.entries(f.rates)`; exempt materials stop generating new `f.rates` entries immediately without crashing if orphaned `credit` keys remain in `c.cabinet.credit`. Add cleanup prune in `planTerritory` if desired (`<= 1` line). | Load pre-M3 citadel save with `credit.fasteners = 0.75` and tick `stepTerritory` 24h without `NaN` or throw. |

---

## 2. Gameplay Economy & Exploit Risks

| Risk ID | Target Change | Potential Exploit / Balance Drift | Severity | Guardrail / Cap | Verification Invariant |
|---|---|---|---|---|---|
| **M3-R04** | `base_generator` `fuel_can = 360s` (`M2-F05`) | Could players burn `fuel_can` inside `furnace`/`campfire` or exploit `base_generator` vs POI generator? | **HIGH** | `stationBurnable('fuel_can')` MUST remain `false`; ONLY `stepBasePower` and `motorbike` accept `fuel_can`. Furthermore, `energy_refined` (`fuel_can` never produces ingots/food) remains separated from smelter loops. | `industrial-proof` + unit test asserting `dispatch(stationFuel, 'fuel_can')` fails on `campfire`, `furnace`, and `refinery`. |
| **M3-R05** | `oil_pump` graduated from `test-fixture-v1` to `map-v1` (`M2-F12`/`M2-F15`) | Infinite crude farming via demolishing/rebuilding `oil_pump` or placing pumps on arbitrary tiles. | **HIGH** | Keep `oilSources[oilSourceKey(tx, ty)]` tied to fixed tile coordinate + `authority: 'map-v1'` initialized once per run in `startRun` (never refilled on rebuild/reclaim). Preserve `test-fixture-v1` flag exclusively for unit tests. | Rebuild `oil_pump` 5× on depleted pad (`stock === 0`) -> `buildReason` blocks with `'No oil remains here'` or pump refuses to run. |
| **M3-R06** | `upkeepFractionPerDay: 0.25 -> 0.10` (`M2-F10`) | Over-expansion / megabase spam without upkeep penalty across 336h. | **MEDIUM** | Keep `BAL.economy.maxClaims = 2` and `claimRadius = 25` (`LOCKED_CANON`). At `10%/day`, a 127-structure `Brick_Citadel` still demands **1,016 total items** across 14 days (`1.4×` full rebuild cost), preserving genuine harvest pressure while removing sub-36h collapse tedium. | `Brick_Citadel` 14d upkeep > `1,000` items; 0 collapses at 24h fill; collapse still triggers within `unfundedCollapseHours = 12h` if unfilled. |
| **M3-R07** | Random research `core_*` weighted unblock (`M2-F06`) | Players rush Day-1 `core_dragon` before building basic workbench/tools, or bypass Tier-3 directed research rules. | **MEDIUM** | Enforce `unlockedCount >= 4` before `core_*` enters the random pool AND `coreRandomWeight = 0.5`. `permitsDirectedResearch` continues rejecting `tier >= 3` directed unlocks. In $N=400$ MC, `min` spares to first Core is `20` (5 full random rolls = 20 spares + Workbench + Research Table). | Assert `permitsDirectedResearch(RECIPES.core_dragon) === false` and rolls 1–4 never roll `core_*`. |
| **M3-R08** | `journeyRequisitions` reduced `42 -> 7/day` (`M2-F04`) | Players who already accrued `securedCash` before M3 retain legacy balance; new players perceive daily rewards as low unless non-cash rewards stay visible. | **LOW** | Existing profile `securedCash` is never clawed back (`K8` profile fairness). Parcel item quantities (`bandage x3`, `cooked_meat x3`, `medkit x2`, `mechanical_parts x3`, `spares x3`, `fuel_can x1`, `crystal x1`) stay identical so daily milestones remain rewarding inside the current run without distorting cross-run meta currency. | Assert `milestoneRewardSpec('beacon').items` unchanged and `14 * 7 = 98 <= 160` vendor cap. |
| **M3-R09** | `claimMinDistFromPoi = 10` enforced in `buildReason()` (`M2-F08`) | Existing saves might have a cabinet placed at `dist = 9` near `tp` prior to the fix, OR Veyra POI radius (`POIS` centers vary in footprint `12–30` tiles) might block legitimate roadside houses if distance is measured improperly. | **MEDIUM** | Measure Euclidean distance against `economyMap.protected` bounding box / POI core center `(poi.tx, poi.ty)` with `10`-tile guard ONLY for new placements (`buildReason`), leaving pre-existing placed cabinets intact cleanly without bricking loaded saves. Also validate all 4 Shipping starts + all 4 Veyra spawn anchors maintain generous buildable plots outside radius `10`. | Automated walkability & buildable area test across all 8 start/spawn anchors (`>= 40` buildable tiles within 30 steps outside POI `10`-tile halo). |
| **M3-R10** | Veyra `airdropV1` + spawn iron floor (`M2-F03`/`M2-F09`) | Airdrops landing outside active `115×115` Veyra window or inside deep water/cliff walls; starter iron veins blocking spawn exit paths. | **MEDIUM** | Target Veyra airdrops only inside current loaded `windowOrigin` buildable flat ground (`maxSlope <= 0.35`, `!protected`, `!road`), and place guaranteed spawn iron belts only on verified walkable non-road outer-ring tiles (`dist 25–55` from spawn). | Run `diagnoseStarts` + `buildReason` + reachability BFS across all 12 Veyra scenes (`0` blocked starts or stuck containers). |
| **M3-R11** | Campfire idle auto-pause (`M2-F11`) | Players lighting a campfire solely for night **Warmth** (`comfortV1.campfireBurning = +18` score) or visibility in `winter` could freeze if campfire turns OFF whenever its roast queue is empty! | **HIGH** | **Explicit Mode Split:** Default idle roasting stops burn on empty queue *unless* player toggles `Keep Warmth Fire` (`st.warmthMode = true`, burning at slower simmer `0.5×` fuel rate, OR `torch_post` / `campfire` explicit "Stoke for Warmth" button!). That protects idle wood budgets while preserving `comfortV1` thermal gameplay in `winter`! | Winter overnight warmth test verifying both empty-queue idle auto-stop (`0 wood`) AND `warmthMode: true` (`+18 comfortV1` active). |

---

## 3. Verification & Rollback Plan

1. **Automated Regression Gate (Mandatory Before Every M4 PR Merge):**
   - `npm run typecheck && npm run typecheck:tests && npm run build`
   - `npx vitest run` (entire existing suite + `economic-network-m1.test.ts` + `economic-network-m2.test.ts` + `economic-network-m3.test.ts`)
2. **Economic Telemetry Invariants (Live Assertable):**
   - `overReturns === 0` across all `RECIPES` & `COMPONENT_RULES`.
   - `81 / 81` Veyra POIs materialize 100% of authored (`24/24`) and archetype (`58/58`) containers.
   - `Brick_Citadel` 32-slot cabinet autonomy >= `168h` (`496.55h` achieved).
   - `requisitionOverVendorCapRatio < 1.0` (`0.61×` achieved).
3. **Clean Per-PR Rollback:** Each workstream (Territory, Energy/Oil, Veyra Parity, Progression/UI) decomposes into an isolated feature PR in **M4** (`M4_MASTER_BLUEPRINT.md`), allowing independent cherry-pick revert without cross-system merge conflicts.
