# A1 → A3 Material Source Mapping

Status: `A3_REVIEW_MAPPING_NOT_NATIVE_INTEGRATED`.
Source: A1 PR #20 `data/survival/world/material_source_contracts.json` (read-only; not copied into A3 as world truth).

## Counts

- A1 material contracts: 27
- Mapped to existing A3 ids: 7
- Proposed functional aliases (require A1/A3 agreement): 8
- Explicitly missing A3 item/recipe: 12

## Mapping table

| material_key | status | A3 item ids | A1 nodes/sites | A1 renewal | A3 sources | A3 sinks |
|---|---|---|---:|---|---:|---:|
| `abyssal_pearl` | MISSING_A3_ITEM | — | 3/1 | tide-gated bed | 0 | 0 |
| `aether_crystal` | MISSING_A3_ITEM | — | 4/1 | finite vug | 0 | 0 |
| `basalt` | MISSING_A3_ITEM | — | 6/1 | finite flow | 0 | 0 |
| `bog_iron` | MAPPED_PROPOSED_ALIAS | `iron_ore` | 5/1 | slow redox renewal | 1 | 1 |
| `clay` | MAPPED_EXISTING | `clay` | 5/1 | finite lens | 1 | 1 |
| `copper` | MISSING_A3_ITEM | — | 11/2 | finite vein | 0 | 0 |
| `fibre` | MAPPED_PROPOSED_ALIAS | `reed_fibre` | 11/2 | seasonal regrowth | 1 | 3 |
| `frost_resin` | MAPPED_PROPOSED_ALIAS | `frost_shard` | 6/1 | tapped stand cooldown | 1 | 3 |
| `glacial_iron` | MAPPED_PROPOSED_ALIAS | `iron_ore` | 6/1 | thaw-season vein | 1 | 1 |
| `hardwood` | MAPPED_PROPOSED_ALIAS | `oak_wood` | 6/1 | slow grove | 1 | 7 |
| `honey` | MISSING_A3_ITEM | — | 4/1 | hive cooldown | 0 | 0 |
| `iron` | MAPPED_EXISTING | `iron_ore` | 5/1 | finite vein | 1 | 1 |
| `limestone` | MISSING_A3_ITEM | — | 6/1 | finite quarry | 0 | 0 |
| `obsidian` | MISSING_A3_ITEM | — | 4/1 | fumarole-cycle exposure | 0 | 0 |
| `pearl` | MISSING_A3_ITEM | — | 10/2 | bed cooldown | 0 | 0 |
| `peat` | MAPPED_PROPOSED_ALIAS | `coal` | 6/1 | very slow cut | 1 | 2 |
| `rare_herb` | MAPPED_PROPOSED_ALIAS | `moonleaf` | 11/2 | plot or wild patch | 1 | 5 |
| `reed_fibre` | MAPPED_EXISTING | `reed_fibre` | 7/1 | seasonal bed | 1 | 3 |
| `rubber_sap` | MISSING_A3_ITEM | — | 5/1 | tapped grove | 0 | 0 |
| `salt` | MISSING_A3_ITEM | — | 6/1 | dry-wind renewal | 0 | 0 |
| `salvage` | MAPPED_EXISTING | `iron_scrap`, `knowledge_spares` | 6/1 | road cache restock | 3 | 24 |
| `silica_sand` | MISSING_A3_ITEM | — | 6/1 | tidal placer | 0 | 0 |
| `stone` | MAPPED_EXISTING | `stone_chunk` | 6/1 | finite outcrop, slow renewal | 1 | 3 |
| `storm_glass` | MISSING_A3_ITEM | — | 4/1 | storm-event placer | 0 | 0 |
| `sulfur` | MAPPED_EXISTING | `sulfur` | 6/1 | fumarole cycle | 1 | 1 |
| `timber` | MAPPED_EXISTING | `oak_wood` | 13/2 | regrowing stand | 1 | 7 |
| `venom_sac` | MAPPED_PROPOSED_ALIAS | `venom_spine` | 10/2 | fauna respawn | 2 | 3 |

## Explicit missing A3 items

- `abyssal_pearl`: No pearl/abyssal item in A3. A1 tier-3 seal/abyssal core sink has no A3 recipe yet.
- `aether_crystal`: A3 core catalyst is ancient_catalyst from sealed archives, not a hydrothermal vug. Do not silently alias; design decision required.
- `basalt`: Heat-proof construction is A0 construction material; no A3 inventory item/recipe.
- `copper`: No copper ingot/wire/power-circuit item. A3 power contract currently uses charcoal as placeholder fuel.
- `honey`: No honey/fermentation item; field_meal uses grain/wild_berries.
- `limestone`: Mortar/filter/grafting bed has no A3 item; A0 construction/A1 world prep owns it.
- `obsidian`: Precision cores/blades not represented; A3 spring/steel path is separate.
- `pearl`: Seal inlay/trade/lens has no A3 item; access seals are key_item credentials, not pearl crafts.
- `rubber_sap`: Seals/boat/insulation has no A3 item; A0/A1 preparation capability gap.
- `salt`: Food preservation/flux/trade has no A3 item or recipe.
- `silica_sand`: Glass furnace/lens path absent; storm_glass also missing.
- `storm_glass`: Signal tower/storm core absent; A3 core_ember is soul_ember-based, not storm glass.

## Proposed aliases / provenance mismatches — A1 approval UNRESOLVED

All eight aliases are now explicitly marked `a1_approval = UNRESOLVED_PENDING_A1_PR20` and `provenance_equivalent = false` in `a1_material_mapping.json`. They are adaptation proposals, not approved renames.

| material_key | proposed A3 id | A3 review decision | rationale / smallest next action |
|---|---|---|---|
| `bog_iron` | `iron_ore` | HOLD_ALIAS_PENDING_A1 | Functional iron feedstock, but A1 bog redox renewal is not A3 finite vein. A1 may approve functional alias only with node provenance retained. |
| `fibre` | `reed_fibre` | HOLD_ALIAS_PENDING_A1 | A1 generic fibre spans oasis/forest/seasonal sources; A3 reed_fibre is wetland-specific. Prefer A1 source-side split or explicit adaptation contract; no new A3 item without a distinct sink. |
| `frost_resin` | `frost_shard` | HOLD_ALIAS_PENDING_A1 | Ecological tapped resin is not mineral frost_shard. Propose separate `frost_resin` only if A1 confirms tapped-stand source and A3 authors a real frost_extract/ward sink. |
| `glacial_iron` | `iron_ore` | HOLD_ALIAS_PENDING_A1 | High-grade iron can smelt like iron_ore, but thaw-season vein provenance differs. No separate glacial steel recipe is authored. |
| `hardwood` | `oak_wood` | HOLD_ALIAS_PENDING_A1 | A3 oak_wood is generic wood; A1 hardwood implies slow grove/boat hull/boardwalk semantics partly owned by A0. Decide construction tag vs distinct item before any A3 split. |
| `peat` | `coal` | HOLD_ALIAS_PENDING_A1 | Cut peat is not coal by default. Propose separate `peat` fuel only if A1 confirms cuttable bog source and A3 authors a peat_charcoal or furnace-fuel sink. |
| `rare_herb` | `moonleaf` | HOLD_ALIAS_PENDING_A1 | A1 rare_herb is broader than A3 moonleaf. A1 may map specific herb nodes to moonleaf; do not collapse all rare_herb without provenance contract. |
| `venom_sac` | `venom_spine` | HOLD_ALIAS_PENDING_A1 | Fauna venom sac is not venom_spine reward. Propose separate `venom_sac` only if A1 confirms fauna source and A3 authors a real extract_venom/toxin_mask sink. |

Smallest proposed split/new-item set: **`frost_resin`, `venom_sac`, `peat`** — proposal only, conditional on A1 source confirmation and real A3 sinks. The 12 MISSING items remain explicit; no unused filler items were added to reduce the missing count.

## Capability gaps

| capability | status | A3 item ids | note |
|---|---|---|---|
| `cap_boat` | MISSING_A3_ITEM | — | No boat item; A1/A0 world traversal capability. |
| `cap_climb` | MISSING_A3_ITEM | — | No climb gear item; A1/A0 world traversal capability. |
| `cap_deepward` | MISSING_A3_ITEM | — | No deepward credential/gear; A3 seals are access_tier placeholders. |
| `cap_filter` | PARTIAL_A3_GEAR | `toxin_mask` | A3 toxin_mask gives venom:60; generic filter/acid capability not fully modeled. |
| `cap_thermal` | PARTIAL_A3_GEAR | `frost_cloak` | A3 frost_cloak gives frost:60; heat/thermal power capability not fully modeled. |

## Economic findings

- A1 `salvage`, `stone`, `iron`, `timber`, `reed_fibre`, `clay`, `sulfur` have direct A3 feedstock paths and existing recipe sinks.
- A1 `venom_sac`, `frost_resin`, `rare_herb`, `peat`, `fibre`, `hardwood`, `bog_iron`, `glacial_iron` are functional aliases, not provenance-equivalent. A3 must not silently rename A1 world keys.
- A1 copper/power-circuit, glass/lens, pearl/seal-inlay, salt/preservation, rubber/insulation, honey/fermentation, limestone/mortar, obsidian/precision, basalt/heat-proof construction, storm_glass/signal tower, abyssal_pearl/tier-3 seal, aether_crystal/core-blank power have no current A3 inventory item or recipe. These are explicit gaps, not hidden conversions.
- A3 `ancient_catalyst` remains exploration-gated sealed-archive loot; it is not automatically interchangeable with A1 `aether_crystal` or `storm_glass`.
- A1 renewal descriptions are qualitative (`finite vein`, `seasonal regrowth`, `road cache restock`). A3 numeric yields/replenishment remain `SOH_PROPOSAL` until A0/A1 native integration and playtest.

## Next actions

1. A1/A3 review proposed aliases and decide whether to split A3 item ids (e.g. generic fibre vs reed_fibre, venom_sac vs venom_spine).
2. A0 bind `CONTRACT_NOT_SPAWNED` nodes/POIs to native spawning and SaveService-keyed depletion before any live economy claim.
3. A3 add missing items/recipes only after design agreement; do not fabricate Gold skill effects.
4. Report mismatches to PR #20 / Control Tower; keep this mapping read-only for A6.
