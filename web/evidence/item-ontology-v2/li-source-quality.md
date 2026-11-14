# Last Island historical crosswalk — reference-quality correction (before / after)

Base `7307442c2a39a9b88a4cf11198c4888aa681e354` (139-id coverage accepted by Control Tower). One corrective commit on PR #61. No item, recipe, loot, balance, save or Core change; recipe revision 3.

## Raw inputs: unchanged

| File | SHA-256 before | SHA-256 after |
|---|---|---|
| `LI_137_ITEM_HISTORICAL_ATLAS_AUDIT.csv` | `e4a1b066429d7afc8b9e91dc024ceed317058738e45163f02662d6315a4570c5` | same |
| `LI_137_VS_86_ITEM_DIFF_20261114.txt` | `67b8fb988ddda6039fee6d21f048f527dc6931eebc54cbc80271aca572430d04` | same |

## Before / after

| | Before (`7307442c`) | After |
|---|---|---|
| Rows / decisions | 139, one per id | 139, unchanged |
| Verdict, SOH equivalent, relation per row | — | identical on all 139 rows |
| Source support per row | none; one paragraph said "several" rows cite the atlas wrongly | `source_support_status` on every row: 76 DIRECT, 23 INDIRECT, 23 LEGACY_CLAIM, 15 UNSUPPORTED_CITATION |
| Citation to `ATLAS_v2.json` for a non-atlas id | reproduced with no flag | 26 rows flagged: 22 `CITED_SOURCE_LACKS_ID`, 4 `CITED_SOURCE_MENTIONS_ONLY`; `verified_source_url` never points at the atlas for them |
| Dates | none | `2022-11-09` on the 14 ids the official notice documents or names; UNKNOWN on the other 125 |
| `OFFICIAL_MODERN` (8) | read as a grade | marked as an inherited label: 3 backed by the notice, 5 unsupported |
| `mountain_bicycle_blueprint` | `ROLE_GAP`, "fuel-free personal vehicle" | `DESIGN_CANDIDATE`; pedalling consumes lung air, exhaustion costs HP; not approved |
| `refined_iron_helmet` | `ROLE_GAP`, "genuine gap" | `DESIGN_CANDIDATE` for an additional head-armour tier; SOH already has head protection; not approved |
| Catalog vs live | not distinguished | `soh_live_status` on all 56 `HAVE_*` rows: 52 live, 3 live with a limit, 1 catalog-only |
| `electric_door` → `door_powered` | `HAVE_SAME_ROLE` with no caveat | same verdict, `CATALOG_PRESENT_NOT_LIVE` (MODULE_PENDING) |
| `crude_oil` → `salvaged_oil` | `HAVE_SAME_ROLE` with no caveat | same verdict, `LIVE_WITH_LIMIT`: pumped crude is not live; no working Oil Pump is implied |
| Tracker | `T-LI-137` verified | `T-LI-137` still verified; new `T-LI-SOURCES` blocked |
| Tests in `item-ontology-v2-li-historical.test.ts` | 13 | 22 |

## Official notice of 2022-11-09

https://hero.yingxiong.com/info/2022/1109/13052.html (read 2026-11-14). Applied to these ids only.

| Id | What the notice documents |
|---|---|
| `mountain_bicycle_blueprint` | New one-seat vehicle; blueprint may drop from any toolbox; pedalling consumes lung air, coasting restores it, exhaustion costs HP; can be picked up; not placeable in radiation zones |
| `self_revive_defibrillator` | New item; port boss and Avenger drops; used while downed, 10 seconds |
| `electric_resistor` | Only that the toolbox category drops it |
| `birthday_cake_2022`, `cream`, `egg`, `flour` | Event of 2022-11-10 to 11-16: three drops, 10 + 10 + 10 recipe, edible |
| `glider_legacy`, `iron_folding_ladder`, `large_furnace`, `territory_cabinet`, `green_card`, `blue_card`, `purple_card` | Named in passing only (bug fix, skin name, card-room name). Support stays INDIRECT |

## Unresolved citations (reported separately, not repaired)

**No supporting source at all (15):** `animal_hide`, `bizon_smg`, `charcoal`, `egg_flour`, `flamethrower`, `flamethrower_gas_ammo`, `inferno_chariot`, `inferno_chariot_blueprint`, `low_quality_fuel_can`, `molotov_cocktail`, `nettle_seed`, `old_military_mine`, `red_bean_paste`, `suicide_robot`, `wild_berry_seed`.

**Cited page not re-read (23 LEGACY_CLAIM):** listed in `LI_HISTORICAL_CROSSWALK.md` under "Unresolved citations". Includes `reunion_mooncake_lottery_pack`, which cites a different official page.

Closing either list needs sources from the research owner. Tracked as `T-LI-SOURCES`.

## Verification

Local only (GitHub Actions do not run on this branch): ontology suites 87/87, `tsc --noEmit` clean, artifacts regenerated with no drift. The full Web suite was not re-run and is not green (179 inherited failures).
