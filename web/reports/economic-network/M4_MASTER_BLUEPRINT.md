# Milestone M4 Report — Soul of Hero Economic Integration & Engineering Master Blueprint

**Repository Baseline:** `arena/f561fd0d-soul-of-hero` (branched from `main` @ `82089fea`)  
**Prerequisites:** M1 (`19a0a8e`), M2 (`7d82c34`), M3 (`8a758b7`)  
**Target Policy Specification:** `M3_PROPOSED_V1` (`soh.economic-rebalance-m3.v1`)  
**Scope:** Implementation-ready PR-by-PR roadmap, exact code/schema diffs, save-compatibility contracts, telemetry invariants, and acceptance suites resolving all 16 M2 audit findings without breaking `LOCKED_CANON`.

---

## 1. Release Sequencing & Dependency Architecture

The rebalance ships cleanly across **6 scoped, independently revertible pull requests**:

```
PR-ECON-01 (Veyra 81-POI Geometry & Creature Drop Parity)
     │
     ├──► PR-ECON-02 (Territory Upkeep, 32-Slot Cabinet, Repair Parity & POI Radius Guard)
     │
     ├──► PR-ECON-03 (Generator Fuel Scaling, Zero-Load Fix, Campfire Auto-Pause & Map Oil Sites)
     │         │
     │         └──► PR-ECON-05 (Veyra Cores/Blueprints/Airdrops/Drives & Spawn Ore Floor)
     │
     └──► PR-ECON-04 (Journey Requisitions, VENDOR_SECURED Sinks, Weighted Research & UI Sync)
               │
               ▼
         PR-ECON-06 (CI Economic Telemetry Gate, Regression Matrix & Balance Alerts)
```

*Note on `persist.ts` Digest Safety:* Because `persist.ts:62` validates `sourceDigest(world.sourceV3)` and `poiContractDigest(w)`, PRs touching `sources` or `POIS` (`PR-ECON-01`, `PR-ECON-03`, `PR-ECON-05`) MUST keep backward-compatible validation or bump a clean schema rule for pre-patch saves (`save_schema_compat`), never bricking existing valid runs.

---

## 2. Pull Request Specifications (PR-ECON-01 through PR-ECON-06)

### PR-ECON-01: Veyra 81-POI Container Integrity & Creature Drop Parity

- **Resolves:** `M2-F01` (CRITICAL), `M2-F02` (CRITICAL)
- **Files Modified:**
  1. `web/src/veyra05/arch/sites.ts` (`75`)
  2. `web/src/veyra05/arch/rest48.ts` (`112–118`)
  3. `web/src/game/catalog.ts` (`214–235`)
  4. `web/src/game/engine.ts` (`261–273`)

#### Exact Implementation Diffs

1. **`web/src/veyra05/arch/sites.ts`** — relocate `Tackle Box` off `Cottage Ladder` (`1642, 1176`):
   ```diff
   -  b.cache(1642, 1176, 0, 'Tackle Box', [['rope', 3], ['fiber', 5], ['meat', 1]]);
   +  b.cache(1640, 1174, 0, 'Tackle Box', [['rope', 3], ['fiber', 5], ['meat', 1]]);
   ```
2. **`web/src/veyra05/arch/rest48.ts`** — paint walkable `floor` clearing pad inside `po_glade` so `floors.ts:375` `pickCell()` finds valid `T.FLOOR`:
   ```diff
      if (isSacred) {
   -    open(p, 'grove_ring', 'Ancient open clearing', 0, [[x - 6, y - 9, 13, 9], [x - 11, y - 4, 21, 4]], 'stone');
   +    open(p, 'grove_ring', 'Ancient open clearing', 0, [[x - 6, y - 9, 13, 9], [x - 11, y - 4, 21, 4]], 'wood');
        p.prop(x - 1, y - 1, 0, 'sundial');
   ```
   *(Or if keeping `'stone'` appearance on `po_glade`, designate explicit `b.cache` anchor on a paved `'floor'` sanctuary plinth `[[x - 2, y - 3, 5, 5]]` in `rest48.ts`.)*
3. **`web/src/game/catalog.ts`** — bind missing components/specimens to active Veyra ecology:
   ```diff
   -  vampire_2: { ..., drops: [['cloth', 2, 0.9], ['herb', 2, 0.7], ['crystal', 1, 0.45]], ... },
   +  vampire_2: { ..., drops: [['cloth', 2, 0.9], ['herb', 2, 0.7], ['crystal', 1, 0.45], ['crawler_optic', 1, 0.35]], ... },
   -  orc_3: { ..., drops: [['iron_ore', 2, 0.9], ['coal', 1, 0.7], ['scrap', 2, 0.75], ['fasteners', 1, 0.4]], ... },
   +  orc_3: { ..., drops: [['iron_ore', 2, 0.9], ['coal', 1, 0.7], ['scrap', 2, 0.75], ['fasteners', 1, 0.4], ['chitin', 1, 0.5]], ... },
   -  slime_1: { ..., drops: [['herb', 1, 0.8], ['berries', 2, 0.6], ['raw_salt', 1, 0.45]], ... },
   +  slime_1: { ..., drops: [['herb', 1, 0.8], ['berries', 2, 0.6], ['raw_salt', 1, 0.45], ['shell', 1, 0.7]], ... },
   -  slime_3: { ..., drops: [['sulfur', 2, 0.9], ['coal', 2, 0.8], ['essence_fire', 1, 0.35]], ... },
   +  slime_3: { ..., drops: [['sulfur', 2, 0.9], ['coal', 2, 0.8], ['essence_fire', 1, 0.35], ['chitin', 1, 0.7], ['beetle_horn', 1, 0.25]], ... },
   -  fox: { ..., drops: [['fur', 1, 1], ['meat', 1, 0.8]], ... },
   +  fox: { ..., drops: [['fur', 1, 1], ['meat', 1, 0.8], ['wolf_fang', 1, 0.35]], ... },
   ```
4. **`web/src/game/engine.ts`** — add coastal `crab` to Veyra beach spawning:
   ```diff
   -  [T.SAND]: ['orc_1', 'slime_1'],
   +  [T.SAND]: ['orc_1', 'slime_1', 'crab'],
   ```

#### Acceptance Criteria
- `authoredLootMaterialized === 24` (`24/24`) and `archetypePoisMaterialized === 58` (`58/58`).
- Veyra graph reachability check (`economic-graph.ts`) confirms **`0` unreachable crafting recipes** and **`0` unobtainable study specimens**.

---

### PR-ECON-02: Territory Upkeep Scaling, 32-Slot Cabinet, Repair Parity & POI Guard

- **Resolves:** `M2-F08` (HIGH), `M2-F10` (MEDIUM), `M2-F13` (LOW)
- **Files Modified:**
  1. `web/src/game/balance.v1.json` (`territory`)
  2. `web/src/game/catalog.ts` (`STRUCTS.claim`)
  3. `web/src/game/engine.ts` (`structureRepairCost` line `624`, `buildReason` lines `1428–1458`)
  4. `web/src/game/persist.ts` (`validate()` cabinet slot auto-expansion)

#### Exact Implementation & Schema Diffs

1. **`web/src/game/balance.v1.json`:**
   ```json
   "territory": {
     "unprotectedCollapseHours": 12,
     "unfundedCollapseHours": 12,
     "upkeepFractionPerDay": 0.10,
     "materials": ["wood", "plank", "stone", "fiber", "rope", "brick", "iron_ingot", "scrap"]
   }
   ```
2. **`web/src/game/catalog.ts` (`STRUCTS.claim`):** Set `slots: 32` (up from `24`).
3. **`web/src/game/engine.ts` (`buildReason`):** Enforce `BAL.economy.claimMinDistFromPoi` (`10`):
   ```ts
   if (type === 'claim') {
     const minD = BAL.economy.claimMinDistFromPoi;
     const blockedPoi = w.places.some(p => p.kind !== 'start' && Math.hypot(p.tx - tx, p.ty - ty) < minD);
     if (blockedPoi) return `Too close to a landmark (minimum ${minD} tiles).`;
   }
   ```
   *(On Veyra, map global POI tile `(gx, gy)` cleanly via `windowOrigin(r)` so global POI boundaries check `Math.hypot(poiGx - gx, poiGy - gy) < minD` identically.)*
4. **`web/src/game/engine.ts` (`structureRepairCost`):** Eliminate 100%-cost overcharge on `q === 1` ingredients when repairing `< 50%` missing HP:
   ```ts
   export function structureRepairCost(e: Entity): [string, number][] {
     const def = STRUCTS[e.type!]; if (!def || def.item) return [];
     const missingFrac = ((e.maxHp ?? 100) - (e.hp ?? 0)) / Math.max(1, e.maxHp ?? 100);
     return def.cost.flatMap(([k, q]): [string, number][] => {
       if (q === 1) return missingFrac >= 0.5 ? [[k, 1]] : [];
       return [[k, Math.max(1, Math.ceil(q * 0.25))]];
     });
   }
   ```
5. **`web/src/game/persist.ts` (`Save Migration Contract`):**
   - When loading any pre-M4 snapshot whose `claim` container has `slots.length === 24`, pad `while (c.slots.length < STRUCTS.claim.slots) c.slots.push(null)` in memory during `validate()`, preserving all item UIDs and prepaid `cabinet.credit` entries without loss.

#### Acceptance Criteria
- `Brick_Citadel_6x6_Armed` weighted 32-slot autonomy >= `400h` (`496.55h` simulated).
- `buildReason(gs, 'claim', tp.tx, tp.ty - 9)` returns non-null error.
- `qty=1` structure-ingredient 25%-HP overcharge count drops `17 -> 0`.

---

### PR-ECON-03: Generator Fuel Scaling, Zero-Load Fix, Campfire Pause & Map Oil Chain

- **Resolves:** `M2-F05` (HIGH), `M2-F11` (MEDIUM), `M2-F12` (MEDIUM), `M2-F15` (LOW)
- **Files Modified:**
  1. `web/src/game/balance.v1.json` (`fuel`, `oilRefineryV1.recipes`, `oilPumpV1`)
  2. `web/src/game/engine.ts` (`stepBasePower` lines `861–874`, `stepStations` lines `2419–2470`, `authorizedOilSource`, `startRun`)
  3. `web/src/game/world.ts` & `web/src/veyra05/window.ts` (`oilSites` placement)
  4. `web/src/ui/Game.tsx:825` & `web/src/game/journey.ts:81`

#### Exact Implementation & Schema Diffs

1. **Generator-Specific Liquid Fuel Rating (`balance.v1.json` + `engine.ts:865–872`):**
   - Add `"baseGeneratorFuelCanSeconds": 360` to `BAL.fuel`.
   - In `stepBasePower` & `basePowerBoundary`:
     ```ts
     const alloc = powerAllocation(r, e, online);
     if (alloc.length === 0) continue; // Zero idle drain when switches/turrets/benches are off
     const load = alloc.length;
     // Inside fuel pop:
     const secs = slot.key === 'fuel_can' ? BAL.fuel.baseGeneratorFuelCanSeconds : ITEMS[slot.key].fuel!;
     power.energy = secs * 1000;
     ```
   - `stationBurnable('fuel_can')` stays **`false`**, blocking any smelter/campfire burn loop (`LOCKED_CANON`).
2. **Campfire Idle Auto-Pause (`engine.ts:2461`):**
   - Require `const burning = !!job || (kind === 'campfire' && !!st.warmthMode);` (`warmthMode?: boolean` explicit HUD toggle for cold survival at `0.5×` fuel rate). Unattended cooking stops consuming wood the instant the last roast completes (`30 -> 0` wood lost in 10m idle probe).
3. **Map-Authorized Oil Production (`map-v1`) & Offscreen Stepping (`engine.ts:1413, 2419`):**
   - Expand `authorizedOilSource` to honor both `'test-fixture-v1'` (unit tests) and `'map-v1'` (static world oil sites seeded cleanly in `startRun`):
     - `shipping_fresh`: 2 finite oil pads (`stock = 120` each = `240` crude total).
     - `veyra05`: 2 finite oil pads at `po_pumphouse` & `po_oldpump` (`stock = 150` each = `300` crude total).
   - Remove `if (!r.entities[e.id] && e.type === 'oil_pump') continue;` in `engine.ts:2419` so offscreen Veyra oil pumps step cleanly.
   - Add `'crude-v2'` (`4 crude_petroleum + 1 glass -> 2 fuel_can`, `16s`) while retaining `'crude'` decode fallback in `persist.ts` for legacy in-flight saves.
4. **UI Decay Copy Sync (`Game.tsx:825`, `journey.ts:81`):**
   - Replace hardcoded `"~2h"` string literals with dynamic `BAL.territory.unprotectedCollapseHours` (`"12h"`).

#### Acceptance Criteria
- `fuel_can` powers 1 active generator load for `360s` (`6 min`), `0` drain when `powerAllocation === []`.
- Empty idle `campfire` without `warmthMode` consumes `0` wood in `10m`.
- `oilPumpOffscreenSkipped === false`; rebuilding `oil_pump` on empty `stock === 0` pad still fails (`K3` finite law).

---

### PR-ECON-04: Currency Sinks, Weighted Research Cores, Crystal Scaling & UI Sync

- **Resolves:** `M2-F04` (HIGH), `M2-F06` (HIGH), `M2-F07` (HIGH), `M2-F14` (INFO verified), `M2-F16` (MEDIUM)
- **Files Modified:**
  1. `web/src/game/balance.v1.json` (`journeyRequisitions`)
  2. `web/src/game/catalog.ts` (`BUILD_ORDER`, `VENDOR_SECURED`, `SOURCES.{crystal,sulfur}`, `RECIPES.energy_refined`)
  3. `web/src/game/engine.ts` (`research` line `2383`)

#### Exact Implementation Diffs

1. **`balance.v1.json:journeyRequisitions`:**
   ```diff
   -  "ember":  { "points": 25, "securedCash": 5,  ... }
   -  "hearth": { "points": 50, "securedCash": 12, ... }
   -  "beacon": { "points": 75, "securedCash": 25, ... }
   +  "ember":  { "points": 25, "securedCash": 1, ... }
   +  "hearth": { "points": 50, "securedCash": 2, ... }
   +  "beacon": { "points": 75, "securedCash": 4, ... }
   ```
2. **`catalog.ts` (`VENDOR_SECURED`):** Add late-run spendable consumables raising per-run sink cap `76 -> 160`:
   - `salvaged_oil: { price: 6, stock: 3 }` (+`18`)
   - `energy_refined: { price: 5, stock: 6 }` (+`30`)
   - `spares_pack` / `spares: { price: 5, stock: 4 }` (+`20`)
   - `field_repair_kit: { price: 8, stock: 2 }` (+`16`)
   *(Total cap: `76 + 84 = 160`, dropping `requisitionOverVendorCapRatio` from `7.74x -> 0.61x`.)*
3. **`catalog.ts` (`BUILD_ORDER` line `450`):** Append `'ir_sensor'`, `'bear_trap'`.
4. **`catalog.ts` (`SOURCES`, `RECIPES`):** Raise `crystal.stock: 3 -> 4`, `sulfur.stock: 3 -> 4`, `RECIPES.energy_refined.qty: 4 -> 5` (`372 -> 620` wild refined charges on Shipping).
5. **`engine.ts` (`research` line `2383`):** Replace strict `!k.startsWith('core_')` filter with unlocked-count threshold (`>= 4` non-starter learned recipes) and `0.5` weight on `core_*` entries while preserving `permitsDirectedResearch(recipe) === recipe.tier < 3`.

#### Acceptance Criteria
- `BUILD_ORDER` contains 100% of `BUILD_GROUPS` keys (`0` missing).
- $N=400$ research Monte Carlo `P50` spares to first random Core <= `40` (`32` simulated vs `108` prior).
- `industrial-proof.ts` reports **`0` `OVER_RETURN`** across all active recipes.

---

### PR-ECON-05: Veyra Static Cores, Blueprints, Wrecks, Airdrops & Spawn Ore Floor

- **Resolves:** `M2-F03` (CRITICAL), `M2-F09` (MEDIUM)
- **Files Modified:**
  1. `web/src/veyra05/arch/sites.ts` / `floors.ts` (distribute 5 static Creator Cores + `blueprint:arrow` + `blueprint:core_earth`)
  2. `web/src/game/wreck-economy.ts` & `catalog.ts` (enable `damaged_drive` on Veyra wrecks cleanly with workbench `recover_drive` fallback)
  3. `web/src/game/airdrop.ts` (`supportsAirdrops` + window-local drop site check for `veyra05`)
  4. `web/src/veyra05/window.ts` (`spawnWindowMinIronNodes = 14`, `minCoal = 8`)

#### Acceptance Criteria & Save Migration Note
- Static Creator Cores on Veyra: `0 -> 5`; Static Blueprints: `6 -> 8`.
- Veyra spawn-window median (`P50`) iron nodes rises `0 -> 14`; `wreckDamagedDrives80` mean rises `0 -> 16.14`; `airdropEvents` rises `0 -> 14`.
- Pre-patch saves record `sourceLayoutVersion` / `veyraOreFloorVersion` safely inside `RunState` so `persist.validate()` keeps older run source digests accepted alongside v4 windows.

---

### PR-ECON-06: CI Economic Telemetry Gate & Regression Guardrails

- **Resolves:** Permanent continuous regression protection (`M2-F14`, `M1`–`M3`)
- **Files Wired into `package.json` CI script:**
  1. `npx vitest run tests/economic-network-m1.test.ts` (graph completeness & 0 dangling/duplicate IDs)
  2. `npx vitest run tests/economic-network-m3.test.ts` (before/after counterfactual checks, `LOCKED_CANON` assertions, recycler `0 OVER_RETURN`, `81/81` POI verification)
  3. `npx vitest run tests/sys03-recycler.test.ts tests/b1-integrity.test.ts tests/b1-storage.test.ts tests/territory-cabinet.test.ts tests/s10-oil-refinery.test.ts tests/s12-airdrop.test.ts` (anti-arbitrage, persistence/storage, territory cabinet, refinery, & airdrop regression suites)
  4. `npm run typecheck && npm run typecheck:tests && npm run build`

---

## 3. Production Telemetry Invariants & Alert Thresholds

| Telemetry KPI | Target Envelope | Alert Trigger | Linked PR |
|---|---|---|---|
| `veyra.poi_materialization_rate` | `100%` (`81/81` POIs) | `< 81` | `PR-ECON-01` |
| `recycler.over_return_count` | `0` | `> 0` (Release Blocker) | `PR-ECON-04`, `PR-ECON-06` |
| `territory.citadel_weighted_autonomy_h` | `>= 168 h` (`496.55 h` target) | `< 72 h` | `PR-ECON-02` |
| `territory.claim_min_poi_violation_count` | `0` | `> 0` | `PR-ECON-02` |
| `energy.idle_zero_load_gen_cans_24h` | `0` | `> 0` | `PR-ECON-03` |
| `energy.idle_campfire_unattended_wood_10m` | `0` | `> 0` | `PR-ECON-03` |
| `currency.requisition_to_vendor_cap_ratio` | `<= 0.75×` (`0.61×` target) | `>= 1.00×` | `PR-ECON-04` |
| `research.first_core_spares_p50` | `<= 40` (`32` target) | `>= 60` | `PR-ECON-04` |
| `veyra.spawn_window_iron_nodes_p50` | `>= 12` (`14` target) | `< 8` | `PR-ECON-05` |
| `locked_canon.all_invariants_pass` | `true` (`6/6`) | `false` (Release Blocker) | `PR-ECON-06` |
