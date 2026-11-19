# Milestone M5 — Control Tower Canon Corrective & Proposal Reclassification

**Repository:** `Khanh-glitch/Soul-of-Hero`  
**Branch:** `arena/f561fd0d-soul-of-hero`  
**Supersedes / Qualifies:** `M3_REBALANCE_SPEC.md`, `M3_BEFORE_AFTER_SIM.json`, `M4_MASTER_BLUEPRINT.md` (which remain preserved strictly as unapproved diagnostic/counterfactual research artifacts, **not** authorized runtime balance or approved production plans).  
**Authority Sources:** `web/ref/bible.md`, `web/ref/OPERATIONS.md`, live runtime (`web/src/game/*`, `web/src/veyra05/*`), Control Tower M1–M4 Verdict.

---

## 1. Status Taxonomy (Mandatory Handoff Vocabulary)

Every artifact, proposal, and fix across M1–M5 is explicitly categorized under the Control Tower truth tags:
- `RESEARCH_DELIVERED` — Code-grounded graph/simulation/audit artifacts delivered and reproducible.
- `DESIGN_PROPOSED` — Counterfactual or architectural proposals documented, **not** authorized for implementation.
- `CANON_REJECTED` — Explicitly rejected by `bible.md`, `OPERATIONS.md`, or Control Tower verdict; **must not be implemented**.
- `SOURCE_IMPLEMENTED` — Merged into active runtime source code.
- `TESTED` — Verified by automated `tsc` + `vitest` + `vite build`.
- `PHYSICALLY_PROVEN` — Verified end-to-end across real source → interaction → UID → workstation/consumer → save/restart.
- `VISUALLY_VERIFIED` — Verified at the same SHA with headless Chromium screenshots (`640×360` / viewport).
- `STILL_BLOCKED` — Unresolved dependencies (e.g., Creator decision, native/Godot build, human playtest).

---

## 2. Reclassification of All 7 Rejected M3 Proposals (`A1`–`A7`)

| ID | M3/M4 Proposal | Verdict Category | Canon & Engineering Proof | Correct Replacement Action |
|---|---|---|---|---|
| **A1** | Reduce `journeyRequisitions` `securedCash` minting from `42/day` (`588/14d`) to `7/day` (`98/14d`) & expand `VENDOR_SECURED` | **`CANON_REJECTED` (`CANON_CONFLICT`)** | `bible.md §0.2 [CHỐT]`: Profile economic value comes **exclusively** from finite physical `rcash` deposited via owned `escrow_chest`. Minting `7/day` is still an unauthorized off-map profile currency leak. | **`SAFE_FIX` (`D1`):** Block **all** `securedCash` minting inside `journeyRequisition` (`0` added to `profile.securedCash`), preserving daily ledger points & run-local item supply bundles without clawing back pre-existing legitimate balances. |
| **A2** | Expand `STRUCTS.claim.slots` from `24 -> 32` & cut `upkeepFractionPerDay` `0.25 -> 0.10` | **`CANON_REJECTED` (`CANON_CONFLICT` + `BALANCE_HYPOTHESIS`)** | `24` slots on Territory Cabinet are **Creator-locked** (`STRUCTS.claim.slots === 24`). Lowering `0.25 -> 0.10` was derived from an invented citadel archetype rather than real world acquisition/storage/credit measurements. | Keep `24` slots locked in `LOCKED_CANON` tests. Investigate storage layout, fractional prepaid credit (`cabinet.credit`), and material access separately before touching `0.25`. |
| **A3** | Exempt `qty=1` repair ingredients below `50%` structure damage | **`CANON_REJECTED` (`CANON_CONFLICT`)** | Repeated repairs below `50%` damage restore unlimited HP at zero cost for `qty=1` components (`wood`, `rope`, `iron_ingot`, `mechanical_gear`, `torch`). | **`REQUIRES_CREATOR_DECISION`:** Keep discrete `max(1, ceil(q*0.25))` until replaced by a cumulative repair ledger or explicit integer threshold with zero free-HP exploit. |
| **A4** | Distribute `core_fire`, `core_storm`, `core_frost`, `core_meteor`, `core_dragon` + `blueprint:core_earth` as "Creator Cores" on Veyra | **`CANON_REJECTED` (`CANON_CONFLICT`)** | `catalog.ts:36–42` vs `123–126`: **`core_fire`, `core_earth`, `core_storm`, `core_frost` are Legacy `core` charge items**, NOT Creator Core Gold SKUs. The **7 authentic Creator Core Gold SKUs** (`ITEMS[k].creatorCore`) are `core_blast`, `core_earthmother`, `core_meteor`, `core_dragon`, `core_elsa`, `core_mjolnir`, `core_demon` (paired with 6 energy SKUs: `energy_basic`, `energy_refined`, `essence_fire/nature/water/spirit`). | Separate Legacy Cores from the 7 Creator Core Gold SKUs in all audits and `LOCKED_CANON` tests; propose Veyra distribution strictly around authentic Creator Core SKUs after provenance review. |
| **A5** | Add `wolf_fang` to `fox`, `beetle_horn` to `slime_3`, `chitin` to `orc_3`, `crawler_optic` to `vampire_2` | **`CANON_REJECTED` (`CANON_CONFLICT`)** | Fabricates cross-species biological drops purely to green reachability checks, violating Veyra biome/creature provenance (`bible.md` K5/K3, `OPERATIONS.md`). | Mark affected items (`chitin`, `beetle_horn`, `crawler_optic`, `wolf_fang`) accurately as `MISSING_VEYRA_SOURCE` in `SOH_ITEM_FUNCTION_AUDIT.csv`; pursue coherent biome sources (`crab` / salvage / tannery / ash fauna) only with Creator sign-off. |
| **A6** | Guarantee `14 iron` + `8 coal` nodes inside every Veyra spawn window | **`CANON_REJECTED` (`CANON_CONFLICT`)** | Erases deliberate Veyra regional geography (`bible.md §0.2`: regional resource variation drives travel/freight trade routes K7). | Verify real neighbor-region routes (`greywater -> greyback -> gulf -> slag`) and salvage alternatives first; preserve regional geology differences. |
| **A7** | Enable rapid random Tier-3 Core lottery after 4 recipe unlocks | **`CANON_REJECTED` (`CANON_CONFLICT`)** | Turns late/rare physical Core acquisition into an early random lottery, undermining special sources and specimen/blueprint exploration (`K3`/`K4`). | Keep Tier-3 directed block & random `!core_` guard intact pending an explicit, non-bypassable Core acquisition contract (`REQUIRES_CREATOR_DECISION`). |

---

## 3. Reclassification of All 16 M2 Findings (`M2-F01`–`M2-F16`)

*Note: All 336h hypothetical player archetypes from M2 (`casualOffline14Day`, `fortifier14Day`, etc.) are classified strictly as **diagnostic scenario probes (`SIMULATION_ASSUMPTION`)**, NOT authoritative balance justification. Mechanics-level accounting, geometry materialization, `settle()` chronology, and `recycler`/`industrial-proof` conservation measurements remain valid technical evidence.*

| ID | M2 Title | Reclassified Control Tower Status | Actionable Resolution Path |
|---|---|---|---|
| **M2-F01** | Veyra legacy creature biome gap (`chitin`, `beetle_horn`, `crawler_optic`, `shell`) | `STATIC_SOURCE_DEFECT` + `REQUIRES_CREATOR_DECISION` (`A5`) | Record missing drop paths transparently in `SOH_ITEM_FUNCTION_AUDIT.csv`; do **not** invent cross-species drops. |
| **M2-F02** | `po_greywater` Tackle Box collision & `po_glade` `T.ROAD` dropping caches | `CONFIRMED_DEFECT` → **`SAFE_FIX` (`D3`)** | Relocate `Tackle Box` off Cottage Ladder inside same room (`sites.ts:75`); provide legal `T.FLOOR` clearing/fallback for `po_glade` (`rest48.ts:116`) without changing geography authority. |
| **M2-F03** | Veyra Recycler / `damaged_drive` / Airdrop / Creator Core gap | Mixed: **`CONFIRMED_DEFECT` (Recycler chain missing on Veyra = `SAFE_FIX` `D5` at `po_slag`)** + `REQUIRES_CREATOR_DECISION` (Airdrops & 7-Creator-Core placement `A4`) | Integrate real Veyra Recycler chain at existing authored **`po_slag` (*Slagworks Foundry*)** (`f03.ts`, `wreck-economy.ts`, `world.ts`, `persist.ts`). |
| **M2-F04** | `journeyRequisition` off-map `securedCash` minting | `CONFIRMED_DEFECT` → **`SAFE_FIX` (`D1`)** *(while `A1` `7/day` is `CANON_REJECTED`)* | Zero out Journey-to-profile `securedCash` minting (`0` added); enforce cash-only physical `escrow` provenance in `engine.ts` + negative tests. |
| **M2-F05** | `base_generator` `60s` `fuel_can` vs `80s` `coal` & idle `Math.max(1, alloc.length)` | Mixed: **`INTENDED_CONTRACT` (1× idling draw verified by `tests/w07-power-offline-parity.test.ts:82` & `tests/s06-circuits.test.ts:31`)** + `BALANCE_HYPOTHESIS` (`fuel_can` `60s` duration) | **Do NOT break `w07` / `s06` generator contracts.** Investigate whether zero-allocation draw requires explicit switch-off (`basePower { enabled: false }`) vs switchable standby; keep `60s` flagged `BALANCE_HYPOTHESIS`. |
| **M2-F06** | Random research excludes `core_*` | `REQUIRES_CREATOR_DECISION` (`A7` lottery rejected) | Keep current guard intact until Creator approves Core unlock architecture. |
| **M2-F07** | Classic `BuildPanel` omits `ir_sensor` and `bear_trap` from `BUILD_ORDER` | `CONFIRMED_DEFECT` → **`SAFE_FIX` (`D2`)** | Add `ir_sensor`, `bear_trap` to `BUILD_ORDER` (`catalog.ts:450`) + `BuildPanel` UI & placement test. |
| **M2-F08** | `claimMinDistFromPoi` (`10`) unchecked in `buildReason()` | `CONFIRMED_DEFECT` (`SAFE_FIX` after checking start/road tolerance) | Add clean POI distance guard (`claimMinDistFromPoi`) verified against all Shipping/Veyra starts. |
| **M2-F09** | Veyra regional ore concentration | `PRODUCT_DECISION` / `CANON_CONFLICT` (`A6` rejected) | Preserve regional geography; audit real neighbor-scene ore access in `SOH_ITEM_FUNCTION_AUDIT.csv`. |
| **M2-F10** | 24-slot Territory Cabinet & 25%/day upkeep | `CANON_CONFLICT` (`A2` 32 slots rejected) + `BALANCE_HYPOTHESIS` (25% rate) | Retain `24` slots (`LOCKED_CANON`); separately study credit/stack priority UX. |
| **M2-F11** | Campfire burns loaded fuel while idle + stale `~2h` copy | Split: **`INTENDED_WARMTH_BEHAVIOR` (`b03-thermal.test.ts:53`, `comfortV1`)** + **`CONFIRMED_DEFECT` (`~2h` tooltip vs actual `12h` = `SAFE_FIX`)** | Do **not** disable empty-queue campfire fuel burn (breaks `winter`/`comfortV1` heating). Fix stale `"~2h"` text in `Game.tsx:825` & `journey.ts:81`. |
| **M2-F12** | `oil_pump` gated behind `oilTestFixture` | `STATIC_CONTRACT` (`Map owner pending`, `engine.ts:1414`) | Do **not** invent map wellheads without Map owner authority. Keep `oilTestFixture` cleanly tagged. |
| **M2-F13** | `qty=1` 25%-HP repair charges `100%` | `BALANCE_HYPOTHESIS` / `REQUIRES_CREATOR_DECISION` (`A3` free <50% rejected) | Keep paid cost; design non-exploitable cumulative ledger separately. |
| **M2-F14** | Live `recycler.ts` anti-arbitrage | **`VERIFIED_INVARIANT`** | `0` `OVER_RETURN` across all live rules. |
| **M2-F15** | Offscreen `oil_pump` skipped on Veyra | `STATIC_CONTRACT` (tied to `M2-F12` pending Map wellheads) | Wait on Map-authorized oil wellhead decision (`M2-F12`). |
| **M2-F16** | Wild `crystal`/`sulfur` ceiling vs `energy_refined` | `BALANCE_HYPOTHESIS` | Requires real Elder combat-ammo telemetry before tuning. |

---

## 4. Creator Core Gold SKUs vs Legacy Cores (Verified Inventory)

| Item ID | Classification | Authority Field (`catalog.ts`) | Actions / Reserve / Charge Mechanics | Current Recipes & Loot Status |
|---|---|---|---|---|
| `core_blast` | **Creator Core Gold SKU #1** | `creatorCore: 'blast'`, `essence: 'fire'` | 3 Gold fire actions; fueled by `energy_basic`, `energy_refined`, `essence_fire` | Known at start (`ALWAYS_KNOWN_RECIPES`) |
| `core_earthmother` | **Creator Core Gold SKU #2** | `creatorCore: 'earthmother'`, `essence: 'nature'` | 3 Gold nature actions; fueled by `energy_basic`, `energy_refined`, `essence_nature` | Known at start (`ALWAYS_KNOWN_RECIPES`) |
| `core_meteor` | **Creator Core Gold SKU #3** | `creatorCore: 'meteor'`, `essence: 'fire'` | Fireball / target meteor / 10-meteor storm | Shipping `CREATOR_LOOT_V1` (`light_top`); craftable T2 (`wb_l2`); **absent on Veyra static loot** |
| `core_dragon` | **Creator Core Gold SKU #4** | `creatorCore: 'dragon'`, `essence: 'fire'` | Flamethrower / fire tornado / dragon dive | Shipping `CREATOR_LOOT_V1` (`factory_vault`); craftable T3 (`wb_l3`); **absent on Veyra static loot** |
| `core_elsa` | **Creator Core Gold SKU #5** | `creatorCore: 'elsa'`, `essence: 'water'` | Ice bolt / self-freeze / viewport freeze | Shipping `CREATOR_LOOT_V1` (`wreck`); craftable T2 (`wb_l2`); **absent on Veyra static loot** |
| `core_mjolnir` | **Creator Core Gold SKU #6** | `creatorCore: 'mjolnir'`, `essence: 'nature'` | Thunder punch / 5 lightning / shock pull | Shipping `CREATOR_LOOT_V1` (`watch`); craftable T2 (`wb_l2`); **absent on Veyra static loot** |
| `core_demon` | **Creator Core Gold SKU #7** | `creatorCore: 'demon'`, `essence: 'spirit'` | Rays / beam / map-selected teleport | Shipping `CREATOR_LOOT_V1` (`factory_vault`); craftable T2 (`wb_l2`); **blocked recipe on Veyra (`crawler_optic`) & absent in static loot** |
| `core_fire`, `core_earth`, `core_storm`, `core_frost` | **Legacy Cores (Pre-Gold)** | `core: 'fire'|'earth'|'storm'|'frost'`, `charge: 3..4` | Single finite charge action; NOT Gold Creator SKUs | Placed in legacy Shipping `world.ts` chests & replaced when `creatorLootV1 === true`; **never classify as Creator Core SKUs** |
