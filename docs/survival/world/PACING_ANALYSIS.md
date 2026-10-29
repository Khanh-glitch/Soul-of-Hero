# SURV-050A Pacing / Scale Audit

Status: `AUTHORED_ESTIMATE_NOT_PLAYTESTED`

Travel is foot-equivalent at 96 px/s along authored polylines; resource-site links are straight-line detour estimates. Combat, crafting, gathering animation, inventory management and day-equivalent playtime are **NOT_TESTED**. Capability source POIs grant a starter capability/recipe on first visit; material runs model sustain/repair after the grant.

## Concrete journeys

| Journey | Route tiles | Travel min | Detour ratio | Hazard exposure (tiles) | Grants |
|---|---:|---:|---:|---|---|
| early_legacy_home | 224 | 0.62 | - | none | - |
| early_buffer_salvage_power | 1055.08 | 2.93 | 1.316 | none | poi_crown_waystation, poi_crown_relay_shed |
| first_hour_safe_preparation_and_retreat | 1541.72 | 4.28 | 1.176 | none | poi_crown_waystation, poi_crown_relay_shed, poi_amberwood_apothecary |
| mid_filter_bootstrap_and_sustain | 2925.51 | 8.13 | 2.024 | hz_ashwater_miasma:220.88 | poi_amberwood_apothecary |
| mid_climb_bootstrap_and_sustain | 2608.86 | 7.25 | 2.609 | hz_crown_heat:64.68, hz_crown_rot:103.57, hz_ember_gas:99.44 | poi_ember_piton_works |
| mid_thermal_bootstrap_and_sustain | 1314.41 | 3.65 | 1.167 | hz_crown_heat:129.36, hz_crown_rot:207.14 | poi_frost_wardhouse |
| mid_seal2_forge_run | 1731.04 | 4.81 | 1.396 | hz_crown_heat:129.36, hz_crown_rot:207.14, hz_ember_gas:323.64 | poi_ember_old_forge |
| mid_boat_bootstrap_and_sustain | 3207.21 | 8.91 | 1.669 | hz_crown_heat:129.36, hz_crown_rot:207.14, hz_ember_gas:193.5, hz_pearl_tide:79.18, hz_saffron_heat:1.0, hz_verdant_spore:397.54 | poi_saffron_drydock |
| late_tide_ward_run | 2971.97 | 8.26 | 1.645 | hz_crown_heat:129.36, hz_crown_rot:207.14, hz_ember_gas:194.5, hz_pearl_tide:205.68, hz_saffron_heat:1.0, hz_verdant_spore:397.54 | poi_pearl_stilt_village |
| late_seal3_customs_run | 3166.94 | 8.8 | 1.636 | hz_crown_heat:129.36, hz_crown_rot:207.14, hz_ember_gas:203.14, hz_pearl_tide:680.52, hz_saffron_heat:2.0 | poi_pearl_customs |
| late_deepward_root_lift_run | 4101.6 | 11.39 | 1.585 | hz_crown_heat:129.36, hz_crown_rot:207.14, hz_ember_gas:371.72, hz_frost_ridge:470.3, hz_verdant_spore:235.12 | poi_verdant_root_lift |

## Early legacy home loop

Shelter: 4x4 room: 11 walls + 1 door + 4 floors + 1 chest. Cost: {'oak_wood': 36, 'iron_scrap': 2}. Node visits: 7. Gather hits: 20. Grid travel estimate: 0.62 min. Respawn revisit: {'oak_wood': 300, 'iron_scrap': 600}. Gathering/crafting seconds NOT_TESTED.

## Post-14d goals (travel only, not day-count proof)

| Goal | POI | Reachable late | Travel min | Required caps |
|---|---|---|---:|---|
| goal_tide_customs | poi_pearl_customs | True | 3.79 | cap_boat, cap_seal_2, cap_tide_ward |
| goal_karst_dive | poi_sunken_cenote | True | 1.28 | cap_deepward |
| goal_fen_purification | poi_ashwater_pump | True | 1.79 | cap_filter, cap_power_1, cap_seal_2 |
| goal_storm_signal | poi_glasswind_light | True | 2.99 | cap_seal_2 |
| goal_canopy_lift | poi_verdant_root_lift | True | 2.81 | cap_climb, cap_filter, cap_thermal |

## Outpost logistics

| Hub | From spawn min | Nearest site round-trip min |
|---|---:|---|
| node_refuge | 0.0 | src_amber_timber:1.5; src_crown_salvage:1.99; src_crown_iron:2.33 |
| node_crown_east | 0.93 | src_crown_salvage:0.12; src_crown_iron:0.46; src_crown_tuff:0.49 |
| node_crown_south | 1.63 | src_crown_reed:0.2; src_mere_pearl:1.49; src_crown_salvage:1.51 |
| node_amber_north | 0.51 | src_amber_timber:0.47; src_amber_herb:1.75; src_sunken_herb:1.77 |
| node_amber_south | 1.16 | src_amber_herb:0.45; src_amber_honey:0.56; src_sunken_herb:1.65 |
| node_mirrormere | 1.47 | src_mere_pearl:0.28; src_mere_clay:0.4; src_mere_reed:0.55 |
| node_mere_south | 1.91 | src_fen_venom:0.25; src_fen_bogiron:0.36; src_fen_peat:0.5 |
| node_frost | 1.59 | src_frost_resin:0.22; src_frost_skarn:0.25; src_ember_sulfur:1.22 |
| node_glasswind | 2.62 | src_glass_timber:0.25; src_glass_storm:0.56; src_frost_vug:0.68 |
| node_ember | 2.02 | src_ember_sulfur:0.37; src_ember_copper:0.4; src_ember_obsidian:0.7 |
| node_saffron | 3.05 | src_saffron_salt:0.46; src_saffron_copper:0.79; src_saffron_fibre:0.8 |
| node_verdant | 2.81 | src_verdant_hardwood:0.25; src_verdant_sap:0.33; src_verdant_venom:0.56 |
| node_pearl | 3.63 | src_pearl_bed:0.35; src_pearl_abyss:0.87; src_saffron_salt:1.61 |
| node_sunken | 1.28 | src_sunken_herb:0.25; src_sunken_lime:0.25; src_fen_bogiron:1.14 |
| node_ashwater | 1.79 | src_fen_bogiron:0.11; src_fen_peat:0.25; src_fen_venom:0.5 |

## Alternate-route detours

| Cut edge | Base min | Alternate min | Detour min |
|---|---:|---:|---:|
| rt_crown_frost | 1.59 | 2.48 | 0.89 |
| rt_frost_coast | 1.03 | 2.44 | 1.41 |
| rt_ember_mere | 0.58 | 2.38 | 1.8 |
| rt_saffron_pearl | 0.58 | 2.71 | 2.14 |

## First-hour hazard bootstrap counterfactual

Safe first-hour journey ok: True; hazard exposure: {}.
Prepared shortcut `rt_east_seam` still exposes: {'hz_crown_heat': {'tiles': 64.68, 'seconds': 10.78}, 'hz_crown_rot': {'tiles': 103.57, 'seconds': 17.26}}. It requires `cap_filter`; danger is preserved, not disabled.
Safe approach `rt_crown_safe_approach` exposure: {}. Circular bootstrap requirements: none.
Native damage/mitigation is NOT_TESTED; A0/A3 must adopt `hazard_damage_contract.json` and `novice_bootstrap_contract.json`.


## Revisit value and caveat

5 post-14d goals, 33 resource sites with authored renewal policies, outer-cache restock vs one-time specimen vaults, and per-region revisit hooks are present. This does **not** prove fourteen-day playtime. Native pacing, hazard damage, recipe yields, combat and inventory friction remain separate A0/A3/A6 integration gates.
