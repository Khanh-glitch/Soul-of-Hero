# Integration & data contracts (initial architectural RFC)

**Status:** DRAFT interface contract. The contract text below is unchanged and still
the design authority. What exists in code is tracked separately in
[Implementation status](#implementation-status-a0-slice-surv-010) at the end of this
file — anything not listed there is unimplemented, and a listing there is a claim
about *code paths plus named tests*, never about art, balance or acceptance.

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

---

## Implementation status — A0 slice (SURV-010)

The first slice implements the contracts below against the existing authorities. It
adds no second inventory, no second save file and no second world.

| Contract | What the code does | Where | Proven by |
| --- | --- | --- | --- |
| CT-01 (one save document) | Survival state lives at `save["survival"]` and is read/written only through `SaveService.transact_once`. The namespace is additive: an older build's `_merge_defaults` leaves it alone, and a newer schema is refused rather than guessed at. | `game/survival/survival_state.gd` | `survival_foundation_test.gd` cases 08, 11 |
| CT-02 (harvest is atomic and idempotent) | One swing = one transaction keyed `survival.harvest.<node>.<next_harvest_count>`. The key is derived from the *committed* counter, so a replay, a double-click or a retried event finds it already applied and pays nothing. Respawn is evaluated inside the same transaction, so two swings racing a ripe node cannot both be paid. | `SurvivalService.harvest` | cases 01, 02, 12 |
| CT-03 (containers round-trip) | Deposits and withdrawals move both halves in one candidate document; a full bag or a missing stack aborts the whole transfer. `deposit_all` / `withdraw_all` sweep a container in a single commit and never half-move a stack. | `SurvivalService._transfer`, `_transfer_all` | cases 07, 08 |
| CT-04 (authored terrain is not blocked) | Placement refuses solid terrain, water, protected landmarks and camps, route detail, shortcut clearances and cells outside reach, and the traversability endpoints are re-asserted after the survival layer exists. | `SurvivalBuildSystem.validate_cell`, `SurvivalService.place_structure` | cases 05, 10 |
| CT-05 (dynamic collision) | A placed solid piece carries a `StaticBody2D` on the terrain layer, so the Knight's existing mask stops it with no player-code change. Foundations deliberately have no body. | `SurvivalStructure`, `SurvivalBuildSystem._materialize` | case 09 |
| CT-06 (build pays and creates once) | Payment and entity creation are in the same mutator; the entity id is allocated inside the transaction from the document's own counter. A failed commit leaves the save byte-identical. | `SurvivalService.place_structure` | cases 03, 04, 06 |
| CT-07 (reload restores exactly) | The scene is a projection of the document: `rebuild_from_save` on world build, `reconcile_from_save` on every state signal (add/remove/refresh only), and the chest's prompt is re-derived. Nothing else may add a structure node. | `SurvivalBuildSystem`, `SurvivalStructure` | cases 08, 12 |
| CT-08 (recipe knowledge is permanent) | `learn_recipe` writes to `survival.knowledge.recipes` under its own transaction key; learning is idempotent and never grants items. | `SurvivalService.learn_recipe` | data-contract gate (no runtime case yet) |

**Verified run:** [40845406213](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40845406213) —
`SURVIVAL FOUNDATION PASSED - 125 checks` on Godot 4.7 under Xvfb, all twelve cases,
engine exit 0. That run is the evidence for every row above; the rows are not a
design intent.

### Deliberately not claimed

* **Roofed rooms, beds, respawn, farming, smelting, research stations, Skill Cores**
  are later slices (SURV-020/030/040). Nothing here fakes them.
* **Building art** is a labelled placeholder atlas written by
  `tools/survival/build_art.py`; the `BUILD-ART` blocker stands.
* **Balance numbers** (4 pieces, 5 resource kinds, 91 nodes) are a playable draft for
  A7 to re-tune against `ECONOMY_AND_14DAY_REPLAY_BALANCE.md`, not a design verdict.
* **A green CI run is the only thing allowed to move `STATE.json`'s
  `code_claims.survival_system_integrated` to `true`.**

### SURV-020 WIP storage safety (not shelter acceptance)

- Demolition of a nonempty container is rejected within the save transaction; its contents, structure and inventory remain intact. No automatic refund or evacuation is claimed.
- Repeated whole-container sweeps use a committed `survival.counters.container_sweeps` sequence and `survival.transfer.all.v2.*` receipts rather than quantity signatures. This additive counter defaults to zero for v1 survival documents, and existing receipts are skipped if an older build dropped the counter. As with existing sweep calls, separate calls are separate user actions; caller-supplied replay keys are not available on this API.
- Evidence: [native run 40849106485](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40849106485), code commit `77c639331d8d4b0c472e86e7538275e6778aa697`; 132 foundation checks. This does not verify rooms, roofs, beds, respawn, shelter visuals or Web shelter behavior.

### SURV-020 WIP — bounded derived room topology and layered occupancy

At tested code `4afe3d94cea92be9cc2355f3fb8362ab358907f4`, room interiors are derived from persisted wall/door cells and never separately saved. Eight-way open-space connectivity rejects diagonal corner leaks. Disconnected wall clusters have independent bounding boxes; clusters above 16,384 local cells report overflow and produce no room. Boundary signatures include nested seals; unaffected cluster floods are cached. Construction-state changes still index the current set of structure records, so no claim is made of constant-time updates or of dynamic navigation.

A cell has one floor slot and one object slot, enforced by both the build validator and `SurvivalService.place_structure` transaction. Existing v1 survival records remain compatible without an outer save schema migration. Visual floor/furniture ordering, actual door traversability, door threshold continuity, roof rendering and bed/respawn are **not** established by this change. Doors currently count as seals even though their physical open/closed state is not implemented.

[Godot native run 40862246794](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40862246794) passed 132 foundation and 50 topology/storage checks. This is not SURV-020 acceptance and does not constitute screenshots or human playtesting. Replaying a caller-keyed single-item transfer is tested, but whole-container sweeps still lack logical command IDs.

### SURV-020 WIP door projection (native-limited)

`door_open` and `door_revision` are additive per-structure fields inside the existing survival namespace; absent fields default to closed/revision zero. The service opens/toggles in one SaveService candidate transaction, with optional caller-provided request key; closing requires a scene-owned validator. A `SurvivalStructure` projects that state to its named existing `StaticBody2D` shape via `set_deferred`, with conservative player clearance. This is not a promise of safe closure around NPCs, AI navigation updates, backward downgrade preservation, or complete visual UX. Placement also checks live world collision while excluding owned structures to preserve floor/object layering. [Native run 40863794097](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40863794097) at `30cb746e4f1881c86abefc6cdd229ee0c2ef6011` tests Hero collision using `test_move`, close rejection and reload; no actual player-input walk or shelter acceptance is claimed.
