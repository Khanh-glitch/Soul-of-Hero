# MEC-01 five-chain industrial benchmark (generated)

Numeraire: 1 iron_ingot = 1 iron_ore (furnace) = 3 scrap (scrap_ingot); other atoms compared per material. Salvage-only: damaged_drive. LI figures are context only (LI master v5 §5; mode leaf-BOM, one-product output assumed; confidence ASSUMED; LI Parts are not SOH Mechanical Parts).
B05 eligibility: a source may underwrite a REPEATABLE craft route only when its stock class is renewable; a finite source (vault) is a non-repeatable windfall, never a loop input; world-node sources are renewable in count but their respawn clock is ORIGINAL_UNKNOWN in Web Renewable: shipping.factory.exterior.industrial-toolbox, shipping.tp.bow-cache.standard-toolbox. Finite (never repeatable): shipping.factory.vault.advanced-keycard.

Models: amortized per-unit (cheapestCraft) AND integer craft batches (integerTreePerUnit / route integerBatch) are both reported. Player travel is not modelled. Unpriced atoms compared per material: coal, wood, stone, leather, spares, crystal.

| Chain | Cheapest route | ingot-eq / unit | craft tree s | recycler v2 high (pinned) | recycler v3 high (new) | LI leaf BOM (context) |
|---|---|---|---|---|---|---|
| Metal Blade | metal_blade | 4.833 | 22 | iron_sword: OVER_RETURN (11 vs 5) | iron_sword: OK (2.333 vs 5) | 30×iron_ingot, 15×LI Parts |
| Metal Pipe | metal_pipe | 1.917 | 22 | iron_pick: OVER_RETURN (4.25 vs 3) | iron_pick: OK (2.333 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Mechanical Gear | mechanical_gear | 4.611 | 45.333 | industrial_axe: OVER_RETURN (7.611 vs 4.667) | industrial_axe: OK (3 vs 4.667) | 50×iron_ingot, 65×LI Parts |
| Iron Plate | iron_plate | 1.722 | 20.667 | iron_axe: OVER_RETURN (3.889 vs 3) | iron_axe: OK (2.167 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Utility Frame → Motorbike Kit | vehicle_frame | 4.667 | 37 | none: n/a | none: n/a | 100×iron_ingot, 50×LI Parts, 30×refined_iron_ingot |

Unknowns: ORIGINAL_UNKNOWN: ore-to-ingot fuel burn; ORIGINAL_UNKNOWN: travel/route cost; ORIGINAL_UNKNOWN: per-source drop rate for Metal Blade/Frame authored caches; ORIGINAL_UNKNOWN: LI per-item yields (ASSUMED only).
