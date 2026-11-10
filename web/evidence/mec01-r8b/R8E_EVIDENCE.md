# MEC-01 R8E — K6 upkeep for processed planks (base 8791a96)

## Bug (confirmed before fix, real engine)
- `wall_plank` costs 3 `plank`, but `BAL.territory.materials` did not list `plank`. `planTerritory()` builds per-material rates only from that list, so a plank wall added 0 upkeep.
- BEFORE: `mec01-r8e-plank-upkeep.test.ts` failed 4 of 6: `rates.plank` undefined; a cabinet with zero planks reported `funded` (`homeStatus`); settled upkeep never debited planks; save/reload forecast had no plank rate.

## Fix (one authority)
- `web/src/game/balance.v1.json`: `"plank"` added to `territory.materials`. Nothing else changes: no recipe, no wall HP, no rare-ore value.
- Same list drives: `planTerritory` rates, `stepTerritory` debits, `homeStatus` stock and prepaid, `return-report` stock, offline cabinet report, and the W08 benchmark. All read the one list.

## Numbers (K6, SOH_PROVISIONAL, unchanged)
- upkeepFractionPerDay 0.25 → `wall_plank`: 3 × 0.25 = 0.75 plank/day per wall (per-ms rate = 0.75 / (24 h)).
- Debit: whole stacks against fractional credit. Over a settled window: removed − credit = 0.75 × days (tested for 3 days).
- Repair: `structureRepairCost(wall_plank)` = [['plank', 1]] (ceil(3 × 0.25)); `wall_wood` = [['wood', 2]] (unchanged).
- Reclaim refunds: generic from `STRUCTS.cost` × `reclaimRefund`; plank refunds through the same path (no change needed).

## Tests (mec01-r8e-plank-upkeep.test.ts, 6, real engine functions and fixture injection)
1. Rate: a wall_plank adds 0.75 plank/day to its cabinet.
2. Negative: no planks → cabinet `unfunded`; wood-only stock does not fund it; 6 planks → `funded`/`low`, `per24h.plank` 0.75.
3. Settle 3 days via the real offline path: removed − credit = 0.75 × 3 (no over-debit).
4. Save/validate round trip: 6 planks preserved; forecast identical (no re-bill, no double debit).
5. Repair: plank wall repair 1 plank; wood wall repair 2 wood.
6. Raw-wood shelter unchanged: wood-only cabinet has `rates.wood` > 0 and no `rates.plank`.
- Also re-run: w08-home-status and rest-supply: all pass (26 tests in the three files).

## P1 check (only changed keys)
- `plank`: consumers = `wall_plank` cost (build), cabinet upkeep (now), repair (1 plank), reclaim refund. No other recipe uses plank. No gap found beyond upkeep.
- `wall_plank`: build list (BUILD_ORDER, Shell panel) ✓; sprite is the plank-board kind (R8C) ✓.
- `rich_iron_ore`: consumed only by `refined_iron_rich` (furnace). Not in the recycler or industrial-proof recovery plans as an output; valued as an atom (R8C). No gap found.
- `refined_iron_rich`: furnace station, fuel and timed queue as any furnace job; covered by R8C tests.

## Gates
- tsc --noEmit: exit 0.
- Targeted (plank upkeep + w08 + rest-supply): 26 passed, exit 0.
- Full Vitest --testTimeout=60000: 117 files passed / 1 skipped; 833 tests passed / 1 skipped; exit 0.
- Default `npx vite build`: exit 0; 1 file; 30,354,350 bytes.

## Next grounded capability (P2, not implemented in this round)
- Candidate: plank as a **cabinet-protected** upgrade path is already live; the next gap is repair. `repairStructure` restores HP with a flat 25% of the build cost, regardless of material. Plank wall repair (1 plank per 25% HP) therefore costs the same plank as a 0%→25% repair. This is a design decision for Creator, not a proven defect, so it is listed, not changed.
- Alternative next gap: rich-ore source yield is not tied to graded tool durability (durability is 1 per successful swing for all tools).
