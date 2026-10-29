# Integration & data contracts (initial architectural RFC)

**Status:** DRAFT interface contract; **no runtime code is claimed implemented**.

## Ownership matrix

| Domain | Existing authority | Extension seam / invariant |
| --- | --- | --- |
| Hero/skills/VFX | Existing Hero, weapon and VFX modules | Skill Core issues a cast request against a source-approved skill adapter; presentation unchanged |
| Inventory and rewards | `game/autoload/save_service.gd` | One transaction for removing ingredients and granting item; never clone inventory manager |
| Loot | `game/loot/loot_catalog.gd` | Seeded loot rows call typed item grants; persistent unique loot source IDs |
| Static terrain | `game/overworld/overworld_world.gd` | Authored baked layers immutable at runtime except explicitly modeled world-state route transitions |
| Dynamic buildings | NEW `WorldConstructionService` module | Persistent object/room ID, occupied cell map, collision update, roof interior transitions |
| Exploration/provisions | `game/overworld/overworld_state.gd` | Keep existing save/shortcut contracts; new dynamic world-state in versioned namespace |
| Craft/research | NEW recipe/workstation/knowledge modules | Recipe known != item owned; learned knowledge permanently persisted; exact atomic consumes |
| Resources/farms | NEW resource node/production module | Finite gather nodes, regenerative ecology with controlled clocks, idempotent harvest |

## Suggested normalized data schemas (names not frozen, semantics are)

- `item_definition`: `item_id, kind, stack_limit, icon_ref, provenance, tags`. Kinds include material, equipment, consumable, blueprint, key item, skill_core.
- `item_instance`: `instance_id, item_id, rarity, condition, remaining_uses, max_uses, affixes, created_at_tick`. Persistent unique ID. Skill Cores are NON-stackable if their uses/affixes differ.
- `skill_core_recipe`: `recipe_id, output_core_item_id, required_materials, station_type, workstation_tier, unlock_knowledge_id, crafting_cost`.
- `learned_knowledge`: set of recipe IDs with idempotent unlock source.
- `world_entity`: `persistent_id, region_id, local_cell, orientation, type_id, state, occupancy, container_id`.
- `building_room`: `room_id, region_id, enclosed_footprint, exterior_portals, roof_state`; rebuild room graph when wall/door changes.
- `harvest_node`: `node_id, resource_type, yield, remaining_hits, depletion_tick, respawn_policy`.
- `save_state.survival_v1`: `world_entities, containers, learned_recipes, core_instances, resource_nodes, crafting_queues, crops, spawn_anchor, hazard_flags` within a validated migration.

No final IDs or balance numbers are invented here. Actual names may change, but migrations/tests must preserve logical content.

## Transaction invariants

1. **Atomicity:** placement/crafting/research must validate all costs, capacity, world-state and collision, then commit removal + creation as a single transaction (or reject without side effects).
2. **Idempotency:** deterministic operation ID per action; replay/reload never creates duplicate loot, free blueprints or repeated purchases.
3. **Capacity:** inventory full -> refund/leave loot in source without silent loss; multiple containers have stable IDs and contents.
4. **Authored terrain safety:** no blocked dungeon gate, dead-end spawn or sealed route; building placement rules prevent blocking critical 10-dungeon routing and chosen spawn/camp exits.
5. **Room safety:** player inside room -> roof fades for that room only; visibility logic does not change collision/hit authority.
6. **Core safety:** a valid gameplay cast decrements once, cancels/interrupts follow explicit policies; failure to render VFX does NOT secretly consume without logging/handling.
7. **Source fidelity:** source-locked Gold cannot be marked ready until complete original full-cycle plus native same-seed proof, real map/enemy interaction, cleanup and perf.
8. **Web safety:** no desktop-only file paths, GDExtension or native external dependencies in code shipped to browser unless explicitly validated.

## Architecture sequencing

- Build the smallest **functionally complete vertical slice**, not three incompatible parallel source-of-truth systems.
- Use asset placeholders temporarily with clearly labeled development status; no loss of preexisting 10 dungeon art.
- Make construction and harvesting data-driven and region-agnostic before applying to the entire designed continent.
- Only adopt MIT components after reviewing pinned source code, addon dependencies, source license vs art license, export compatibility and integration tests.
