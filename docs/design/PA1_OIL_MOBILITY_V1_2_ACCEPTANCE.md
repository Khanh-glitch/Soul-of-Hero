# PA1 oil & first-ride mobility — v1.2 source/provenance corrective (2026-11-13)

**Status:** IMPLEMENTED (natural wreck oil custody receipt and Veyra source proof); **NOT IMPLEMENTED** (paper v1.2 formulas/family-unlock and full first-bike route). **Draft only. Never merge until cutover and real gameplay verification.**

**Supercedes only the oil/motorbike portion of PA1 v1.1 master** (original SHA-256 `b45b157e27f39688d22cc1319de43fec663aecbed8b63bd5b2cb92a6831c5537`). Corrected v1.2 full JSON SHA-256: `f4fcf26c9da05ed6ae26bbe1d25304596b328d2add4722ee5ced1c4c07128ede`. This repository document records the fixed law; the full corrected machine master is delivered separately as the v1.2 artifact.

## 1. Correction: first-fuel was double-spent in paper

PA1 v1.1 proposed `motorbike_kit` costs a `fuel_can`. But real `engine.ts` `placeMotorbike` starts `vehicle.fuel=0`, and `vehicleRefuel` then consumes another physical can. As a consequence, the **standard lube + craft-two-cans** path would require **7 salvaged_oil**, not 4 (one for Lubricant + 3 per can). This is a paper defect, not a runtime exploit.

**v1.2 dry-kit:** `vehicle_frame ×1 + vehicle_drive ×1 + iron_plate ×2 + fasteners ×2`. The kit carries **no free fuel**. After genuine placement, `vehicleRefuel` consumes **one physical fuel_can** (3 salvaged_oil + glass if produced via the standard Refinery recipe). There is no additional/implicit starter can.

The special alternative `vehicle_drive_geared` does not require Lubricant. Therefore three **distinct conditional plans**, not one "minimum":

| Real plan | Minimum *salvaged oil* conditional on the other inputs/authorized physical access |
| --- | ---: |
| Standard vehicle_drive with lubricant + craft own first can | 4 |
| Gear-based alternative drive, no lubricant + craft own can | 3 |
| Gear-based alternative + acquire a **real** fuel_can from source/POI | 0 |

A paper-only 4-oil vendor offer is not a universal guarantee to reach the refinery, vendor, glass, livestock, salt, required technologies, or survive on Veyra.

## 2. Correction: retired fuel_can research target

The v1.1 item still had `studyRecipe:'fuel_can'`, while the separate `fuel_can` recipe was marked RETIRE (zero output). Remove the dangling pointer. New fuel recipes belong to one paid ENERGY research family; old queued jobs MUST be protected with explicit versioning at the future cutover.

## 3. What is actually verified on Veyra, and what isn't

- Runtime `sourceLayoutVersion=3` finite wreck harvesting uses `SALVAGED_OIL_WRECK_CHANCE=0.35`. **No change to RNG or grant rate.** New `harvest.oil` receipts join the exact `wreck@localTile` to the exact oil stack UID, before pickup.
- On seeded Veyra `region=1, seed=901`, the existing WP3 traversal now produces **14 authentic oil** and **9 authentic damaged drives** and reaches the real recycler at `po_slag`, crafts physical PA1 device packs and a `vehicle_frame`, then descends to Floor -1, reloads and returns without changing those oil units. This is **collision-graph path stepping, NOT live keyboard walking**; creatures are disabled in the integration fixture. No raw item `addItem` used by the actual route.
- Existing M2 map corpus contains **five authored Veyra Fuel Can caches**: `po_academy` (Floor 0), `po_greywater` (Floor -1), `po_ironharbor` (Floor 0), `po_pumphouse` (Floor 0), `po_sawaion` (Floor 0). Map placement alone is not proof of player reach. New test explicitly tries to walk to `po_greywater` Floor -1 and take its exact stack UID.
- Production `authorizedOilSource` remains test-fixture-only. No real Map-authorized oil well, hence `pump_crude` is NOT an infinite no-input resource on Veyra. Never create a synthetic oil well from a missing POI.
- Vendor `salvaged_oil` stock is four per run at five Spares each; its accessibility, physical purchases and survival budget are NOT proven by this Wreck-only test.

## 4. What LI actually supports (cross-era and modes MUST stay separate)

- **Publisher, 2022-09-28:** https://hero.yingxiong.com/info/2022/0928/12880.html says there is an offshore POI with a Refinery and finite red oil barrels. A **vehicle material package** contains refined ingots ×200, frame ×1, gears ×30, plates ×30 and low-grade fuel ×100. A packaged event reward is NOT proof this is a universal crafting recipe or that fuel is included in every hand-crafted vehicle.
- **Publisher, 2020-01-08:** https://hero.yingxiong.com/info/2020/0108/8968.html documents fuel generators, refining devices, territory-dependent thermal heat and geographically distinct vehicles / loot. Not a numerical refinery yield table.
- **Atlas v1–v6 historical:** 51 matched recipe inputs, 82 loot edges, 19 POI/access edges. **Unknown LI output batch sizes and exact modern mode rules.** v7–v11 are SOH integration/system documents, not additional LI game-item recipe coverage.

**Chosen learning from LI:** route value and competing sources (craft, finite wreck, authored cache, vendor, recycler), not unverified historical oil rates.

## 5. Remaining STRICT gates

1. Natural or physically purchased oil → paid refinery pack with Workbench-II → refinery fuel/lube (time & input) → physically obtained motorbike components → Level-III research → vehicle **mount/drive** → cargo/UID persistence → separate process restart. End-to-end must not inject materials, teleport, disable survival, or assert QA as real player evidence.
2. Apply the entire **148-item / 128-active-recipe v1.2 spec** transactionally, including ENERGY/MOBILITY family tech and legacy queued-job save migration. **Not done by this PR**.
3. Balance 336h / fuel, physical purchase cap, Veyra regional ore + glass/animal supply, authorized POI transition; no false guarantee across all seeds.
4. Browser screenshots/video at exact SHA showing an actual player harvest, craft, refuel and ride, with the important UX and visual quality reviewed.

**Disposition:** source & custody proof can be accepted as a bounded increment; full PA1 economics and First Ride stay BLOCKED until above gates are physically proven. Do not merge this branch as a replacement for PA1 v1.1 recipes.
