# MEC-01 five-chain industrial benchmark (generated)

Numeraire: 1 iron_ingot = 1 iron_ore (furnace); other atoms (incl. Parts) compared per material. Salvage-only: Parts (spares). LI figures are context only (LI master v5 §5; mode leaf-BOM, one-product output assumed; confidence ASSUMED; LI Parts are not SOH Mechanical Parts).
B05 eligibility: a source may underwrite a REPEATABLE craft route only when its stock class is renewable; a finite source (vault) is a non-repeatable windfall, never a loop input; world-node sources are renewable in count but their respawn clock is ORIGINAL_UNKNOWN in Web Renewable: shipping.factory.exterior.industrial-toolbox, shipping.tp.bow-cache.standard-toolbox. Finite (never repeatable): shipping.factory.vault.advanced-keycard.

Models: amortized per-unit (cheapestCraft) AND integer craft batches (integerTreePerUnit / route integerBatch) are both reported. Player travel is not modelled. Unpriced atoms compared per material: charcoal, wood, stone, leather, spares, crystal.

| Chain | Cheapest route | ingot-eq / unit | craft tree s | recycler v2 high (pinned) | recycler v3 high (new) | LI leaf BOM (context) |
|---|---|---|---|---|---|---|
| Metal Blade | metal_blade | 3 | 16 | iron_sword: OK (7 vs 13) | iron_sword: OK (2 vs 13) | 30×iron_ingot, 15×LI Parts |
| Metal Pipe | metal_pipe | 1.5 | 19 | iron_pick: OVER_RETURN (3.5 vs 3) | iron_pick: OVER_RETURN (2 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Mechanical Gear | mechanical_gear | 2 | 20 | industrial_axe: OVER_RETURN (3 vs 10.5) | industrial_axe: OVER_RETURN (1 vs 10.5) | 50×iron_ingot, 65×LI Parts |
| Iron Plate | iron_plate | 1.5 | 19 | iron_axe: OVER_RETURN (2.5 vs 3) | iron_axe: OVER_RETURN (1 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Utility Frame → Motorbike Kit | vehicle_frame | 8.5 | 61 | none: n/a | none: n/a | 100×iron_ingot, 50×LI Parts, 30×refined_iron_ingot |

Unknowns: ORIGINAL_UNKNOWN: ore-to-ingot fuel burn; ORIGINAL_UNKNOWN: travel/route cost; ORIGINAL_UNKNOWN: per-source drop rate for Metal Blade/Frame authored caches; ORIGINAL_UNKNOWN: LI per-item yields (ASSUMED only).
