# MEC-01 five-chain industrial benchmark (generated)

Numeraire: 1 iron_ingot = 1 iron_ore (furnace) = 3 scrap (scrap_ingot); other atoms compared per material. Salvage-only: damaged_drive. LI figures are context only (LI master v5 §5; mode leaf-BOM, one-product output assumed; confidence ASSUMED; LI Parts are not SOH Mechanical Parts).

| Chain | Cheapest route | ingot-eq / unit | craft tree s | recycler v2 high (pinned) | recycler v3 high (new) | LI leaf BOM (context) |
|---|---|---|---|---|---|---|
| Metal Blade | metal_blade | 4.833 | 22 | iron_sword: OVER_RETURN (11 vs 5) | iron_sword: OK (2.333 vs 5) | 30×iron_ingot, 15×LI Parts |
| Metal Pipe | metal_pipe | 3.833 | 44 | iron_pick: OVER_RETURN (6.167 vs 3) | iron_pick: OK (2.333 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Mechanical Gear | mechanical_gear | 4.111 | 35.333 | industrial_axe: OVER_RETURN (7.111 vs 4.667) | industrial_axe: OK (3 vs 4.667) | 50×iron_ingot, 65×LI Parts |
| Iron Plate | iron_plate | 3.833 | 44 | iron_axe: OVER_RETURN (6 vs 3) | iron_axe: OK (2.167 vs 3) | 30×LI Parts, 5×refined_iron_ingot |
| Utility Frame → Motorbike Kit | vehicle_frame | 4.667 | 37 | none: n/a | none: n/a | 100×iron_ingot, 50×LI Parts, 30×refined_iron_ingot |

Unknowns: ore-to-ingot fuel burn; travel/route cost; per-source drop rate for Metal Blade/Frame; LI per-item yields (ASSUMED only).
