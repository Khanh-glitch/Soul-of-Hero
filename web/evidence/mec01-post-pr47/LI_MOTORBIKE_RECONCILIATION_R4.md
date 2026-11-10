# LI ↔ SOH reconciliation: Motorcycle, Mechanical Gear, Vehicle Frame (R4)

Status: reconciliation only. No LI-origin number was changed. No SOH balance number was changed.
LI source: Atlas branch `docs/gameplay-mechanics-first-policy-20261105` @ `5f4e6c44`, archive SHA `8b4fdeda…`.
Files: `LI_MASTER_ATLAS_v5.xlsx` (sheets Recipes, Materials, Sources, Trade Prices, Research Gaps), `SOH_LI_1to1_FULL_DEPTH_AUDIT_v6.xlsx` (sheets 405 Audit, 51 Recipe Paths).
Atlas mode/version column: LI v5 BOM, one-output leaf mode assumed. Confidence: B (source-level, not measured in-game).

## LI values (verbatim from Atlas) and recomputed totals
| LI item | LI recipe | LI bench | Source (Atlas) | Confidence |
|---|---|---|---|---|
| motorcycle | 200 refined_iron_ingot + 1 vehicle_frame + 30 mechanical_gear + 30 iron_plate | 3 | 9game news 3676549 (s_motor) | B |
| vehicle_frame | 100 iron_ingot + 30 refined_iron_ingot + 50 parts | 3 | shouyou 135015 | B |
| mechanical_gear | 50 iron_ingot + 65 parts | 2 | 9game daihaoyingxiong 3279007 | B |
| iron_plate | 5 refined_iron_ingot + 30 parts | 2 | 9game news 3334146 | (per 51 Recipe Paths) |
| motorcycle trade | 1000 coins, Trade Zone 2022, 0 run-hours | — | game.xiaomi viewpoint | UNASSESSED in Atlas |

Recomputed LI leaf totals (one motorcycle, one-output mode): refined 380, iron 1600, parts 2900. These match Atlas's stated totals. The arithmetic is verified; the underlying recipe values are source-level B, not confirmed.

## SOH values (from code: catalog.ts recipes, balance.v1.json)
| SOH item | SOH recipe | Bench | Time | Status |
|---|---|---|---|---|
| mechanical_gear | 2 iron + 2 mechanical_parts + 1 fastener | 2 | 20 s | SOH_PROVISIONAL (catalog) |
| vehicle_frame (base) | 3 iron + 2 MP + 2 spares | 2 | 25 s | ALWAYS_KNOWN |
| vehicle_frame_piped | 1 metal_pipe + 2 iron + 2 MP + 2 spares | 2 | 22 s | alt |
| vehicle_drive_geared | 1 gear + 1 iron + 2 fasteners + 2 spares | 2 | 22 s | alt |
| motorbike_kit | frame + drive + 2 iron + 2 fasteners | 3 | 40 s | requires research blueprint (9 spares, 45 s, directed) |
| motorbike fuel/wear | tank 300, canFuel 100, fuelPerPixel 0.05, wearPerPixel 0.002, repairHp 50, maxHp 200, maxWeight 80, slots 12 | — | — | SOH_PROVISIONAL; ORIGINAL_UNKNOWN per Atlas gap LEGACY-U11 |

SOH C1 path (one kit, geared drive) raw: iron 8, mechanical_parts 4, fasteners 5, spares 4 (plus research 9 spares, plus L3 upgrade).

## Reconciliation rows
| Row | LI (value, mode, conf) | SOH (value, status) | Classification | Action this round |
|---|---|---|---|---|
| Motorcycle raw scale | 380 refined / 1600 iron / 2900 parts (B, one-output) | ~8 iron + 4 MP + 5 fasteners + 4 spares (C1 path) | Scale difference ~232× by count. Atlas itself calls the LI scale "industrial, not reasonable under SOH small-stock nodes" | NO balance change. Needs Creator/balance authorization and a causal advantage row (§0.1b) |
| Refined iron in motorcycle | 200 refined | 0 refined in kit path | Ingredient-identity difference (SOH uses MP, not LI "parts") | Recorded as SOH_EQUIVALENT_OR_AUTHORIZED_DIFFERENCE pending authorization. LI "parts" ≠ SOH Mechanical Parts |
| Frame | 100 iron + 30 refined + 50 parts, bench 3 | 3 iron + 2 MP + 2 spares, bench 2 | Quantity and bench-tier difference | Recorded only |
| Gear | 50 iron + 65 parts, bench 2 | 2 iron + 2 MP + 1 fastener, bench 2 | Quantity difference | Recorded only |
| Gear sourcing | LI drops from yellow_blue_barrel/military_box/advanced_military_box/supply_box, probability NOT inferred (LI-LOOT-078..081) | SOH: loot-ecology toolbox/mid/high pools include mechanical_gear (SOH-only probabilities) | SOH has a physical source. LI probabilities are not published, so no parity claim | Recorded |
| Gear recycle | LI-RECYCLE-003: gear→parts, quantity UNPUBLISHED | SOH X:gear-v1: 1 gear → 2 MP + 1 iron, 15 s (d0e8fcbb, SOH_PROVISIONAL) | SOH-only quantity | Recorded |
| Motorcycle trade | LI 1000 coins, Trade Zone 2022 | No parts-priced vendor. Vendor uses Ragnarok securedCash | PARTIAL_CONFLICT (different currency authority) | Not implemented; needs owner decision |
| Fuel / wear / speed / storage | ORIGINAL_UNKNOWN (LI gap LEGACY-U11) | SOH_PROVISIONAL constants above | Cannot claim LI parity; not transplanted | Recorded |
| Research gate | LI: "separate recipe-knowledge gate" | SOH: research table, 9 spares, 45 s directed | SOH mechanic, authorized as SOH implementation | Recorded |

## What is NOT claimed
- No LI 100% parity for motorcycle, gear or frame.
- No SOH balance change in this round. The scale gap is a Creator/balance decision, not a silent edit.
- Fuel, wear, speed and capacity have no LI measurement. Any comparison is SOH-internal only.
