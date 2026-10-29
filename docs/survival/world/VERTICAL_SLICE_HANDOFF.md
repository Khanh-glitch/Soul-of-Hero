# A1 SURV-050A — Native-ready two-POI vertical-slice handoff

Status: `NATIVE_READY_CONTRACT_NOT_MOUNTED` · `native_playable=false`

This checkpoint makes **only** the two existing early POIs implementation-ready
for A0 native Godot integration:

- `poi_crown_waystation` — Ashen Waystation
- `poi_crown_relay_shed` — Crown Relay Shed

It does **not** regenerate the continent, add new POIs, import prototype
TypeScript, implement P1–P3 research mechanics, edit A0/A3/A6 production files,
or claim Hero movement, combat, damage, SaveService persistence or native
playability. The isolated Godot fixture is a contract reader/reducer only.

## Reviewable artifacts

| Path | Purpose |
|---|---|
| `data/survival/world/vertical_slice/manifest.json` | Slice identity, pinned world-plan SHA, file hashes, owners, research firewall |
| `data/survival/world/vertical_slice/poi_crown_waystation.slice.json` | Exact Waystation footprint, nav, obstacles, actions, persistence, A6 projection |
| `data/survival/world/vertical_slice/poi_crown_relay_shed.slice.json` | Exact Relay footprint, nav, obstacles, actions, persistence, A6 projection |
| `data/survival/world/vertical_slice/handoff_contracts.json` | Minimal A0/A3/A6 adapter contracts and native-compatible payload examples |
| `data/survival/world/vertical_slice/test_vectors.json` | 10 executable vectors, including the 7 required adversarial cases |
| `data/survival/world/schemas/{vertical_slice_manifest,poi_slice,slice_handoff,slice_test_vectors}.schema.json` | New schemas; existing 15 schemas preserved |
| `tools/survival/worldgen/compile_slice.py` | Deterministic slice compiler from existing plan/specs |
| `tools/survival/worldgen/validate_slice.py` | Contract/geometry/A3/research-firewall validator |
| `tools/survival/worldgen/slice_state.py` | Python reference reducer for pytest vectors |
| `tests/survival/world/godot/slice_reader.gd` | Isolated Godot manifest/chunk/nav/spawn reader |
| `tests/survival/world/godot/slice_state_machine.gd` | Isolated Godot contract reducer/journal fixture |
| `tests/survival/world/godot/slice_test.gd` | Isolated Godot vector runner; PASS phrase `SURVIVAL SLICE CONTRACT PASSED` |
| `docs/survival/world/previews/vertical_slice_detail.png` | Static inspection diagram, not a gameplay screenshot |

## Exact geography

Tile size is 16 px. Hero collision body is the preserved Knight
`RectangleShape2D` 12×16 px at offset `(0,-8)`. Required navigation cells are
chunk-backed `walk=1`, `hazard=0`. Static obstacles are slice overlay props; they
must not intersect required nav, entrance clearance or stand cells. Dynamic
spawns are empty in slice v1, and the spawn policy still rejects Hero cells,
doorway clearance and required nav for any future spawn.

| POI | Anchor | Footprint rect | Entrance | Approach | Retreat |
|---|---:|---|---|---|---|
| Waystation | `[408,200]` | `[403,195,11,11]` | `[403,200]` | `[392,200] → [408,200]` | `[408,200] → [408,206] → [392,206] → [392,200]` |
| Relay | `[440,236]` | `[434,230,13,13]` | `[434,232]` | `[392,200] → [424,224] → [434,232] → [436,232] → [440,232] → [440,236]` | `[440,236] → [440,243] → [424,224] → [392,200]` |

Waystation stand cells: locker `[408,199]`, ledger `[410,202]`, cache `[406,202]`,
approach deadfall `[398,201]`. Relay stand cells: hand crank `[442,234]`, breaker
`[443,236]`, deferred copper panel `[443,238]`.

The filter-gated eastern seam `rt_east_seam` remains an **optional** shortcut
requiring `cap_filter`; it is not required for the slice. The safe approach
`rt_crown_safe_approach` and both retreat paths remain zero-hazard.

## Action and state contract

Each POI has an A0-owned persistent state under the proposed additive namespace
`world_slice.pois.<poi_id>` (`soh.world.slice_state.v1`). A0 must add the
sanitizer/migration before production use; A1 does not edit A0 SaveService.
One-shot entitlements and renewable claims use `SaveService.transact_once` with
stable keys:

- `a1slice:poi_crown_waystation:pry_locker:1` → `cap_salvage`
- `a1slice:poi_crown_waystation:seal_ledger:1` → `cap_seal_1`
- `a1slice:poi_crown_waystation:cache_restock:{claim_index}` → renewable `iron_scrap ×3`, `knowledge_spares ×2`, 1800 active seconds
- `a1slice:poi_crown_waystation:gather_deadfall:{claim_index}` → renewable `oak_wood ×2`, 300 active seconds
- `a1slice:poi_crown_relay_shed:hand_crank_bypass:1` → consumes `iron_scrap ×2`, `oak_wood ×1`; grants `cap_power_1`, sets `bus_powered`
- `breaker_reset` is reusable, grants no reward, and requires `cap_power_1`
- `copper_upgrade` is **disabled/deferred** because `copper` is not in the current A3 catalog; it consumes nothing

State transitions are explicit in the vectors and reducers:

1. `UNEXPLORED → DISCOVERED` by A0 activation/discovery; no reward.
2. `DISCOVERED → ACTION_PENDING` only after discovery, stand-cell range,
   capability, item, one-time receipt and active-tick cooldown guards pass.
3. `ACTION_PENDING → COMMITTED` only through one atomic A0 candidate-document
   transaction applying item consumption/grants, capability grants, POI flags,
   cooldown fields and receipt together.
4. Missing prerequisite / out-of-range / deferred action → `REJECTED`; no key,
   material, capability, cooldown or entitlement is consumed.
5. Interrupt or reload while pending → pending discarded; durable state unchanged.
6. Reload after commit → durable flags/receipts/cooldowns survive.
7. Repeated one-time interaction → `ALREADY_APPLIED`; no duplicate reward.
8. Renewable claim before cooldown → `COOLDOWN`; after cooldown a new claim index
   is required. Active-session ticks only; no offline catch-up.
9. Retreat / death / return → Hero return cell resets, but POI flags, receipts,
   cooldowns and reward rights do not reset.

## A3 exact IDs and disputed aliases

Current A3 model reviewed at `origin/arena/7a12b27e-soul-of-hero@08711ea7`.
Exact catalog items used by the slice: `iron_scrap`, `oak_wood`,
`knowledge_spares`. Exact source IDs: `road_scrap`, `road_supplies`,
`live_oak_wood`, `live_iron_scrap`.

- `early_roadside_salvage`: **REJECT** as a separate legacy roadside POI. The safe
  bootstrap is the Waystation approach/cache, not a new POI.
- `a1_crown_salvage`: **SPLIT**. The safe Waystation cache requires `cap_salvage`
  only; `cap_filter` belongs to the optional eastern-seam shortcut, not the
  first-hour cache.
- `specimen_ember`, `specimen_frost`, `specimen_venom`, `catalyst_vault`:
  **DEFER** outside this two-POI slice.
- `hardwood → oak_wood`: **REJECT** alias; `oak_wood` is the exact catalog item.

A3 owns catalog/source semantics. A0 owns the atomic commit boundary. A3 helpers
may mutate the same candidate document, but must not write a side journal or
grant rewards outside the A0 mutator.

## A6 discovered-only projection

`soh.world.slice.a6_projection.v1` hides private action/reward/prerequisite/map
metadata until A0 activation marks the POI discovered. After discovery it exposes
clues, map status, missing-prerequisite reasons and environmental hazard
telegraphs. The eastern-seam telegraphs name heat/rot and `cap_filter`; they do
not disable the hazard or turn it into an arbitrary level barrier. A6 sends
intents; A0 remains authoritative.

## Required adversarial vectors

| Vector | Requirement |
|---|---|
| VS-01 | Novice first-hour both POIs + return |
| VS-02 | Filter-gated shortcut blocked unprepared; safe approach open |
| VS-03 | No permanently blocked required route/doorway/retreat |
| VS-04 | No duplicated one-time reward after reload/re-entry |
| VS-05 | Stable route/POI/transaction identity across compilation |
| VS-06 | No dynamic spawn on Hero or blocking a required doorway |
| VS-07 | Failed action consumes no key/material/entitlement |
| VS-08 | Interrupted operation and reload during/after transition |
| VS-09 | Renewable cache cooldown and duplicate claim index |
| VS-10 | A6 discovered-only projection |

## Research firewall

Prototype P1 Core-world interactions, P2 dynamic weather and P3 physical carts
remain `RESEARCH_ONLY_NOT_IMPLEMENTED`. This slice documents existing seams only:
the Relay `bus_powered` flag is a future CT-08 power-bus seam; static hazard rects
remain static; trunk/spur roads remain authored 2-tile roads. No TypeScript is
imported and the world is not regenerated.

## Local validation snapshot

- `compile_slice.py`: ok, manifest SHA recorded in `vertical_slice/manifest.json`
- `validate_slice.py`: 0 errors, 5 slice documents schema-checked, 10 vectors
- `validate_world.py`: 0 errors, existing world schemas preserved
- `pytest tests/survival/world`: **74 passed**
- `check_determinism.py`: **230 artifacts**, tree SHA `429f0fabe8ff950918b32ff97e358a3eb8e68106d92a64cc64e40e57ca64c123`
- Godot 4.7 isolated slice runner is executed by CI; local sandbox has no Godot.

Native integration remains an A0 gate: real scene mounting, collision, activation,
SaveService migration/persistence, A3 reward adapter and A6 UI projection must be
implemented and independently reviewed before `native_playable` can become true.
