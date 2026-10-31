# A1 Round 12 — deep world runtime handoff

Status: **SOURCE IMPLEMENTATION / NATIVE CI PENDING**. This is an additive A1 source reader and isolated native fixture, not an A0 production mount. PR20 remains open; A0 owns production adoption.

## Consumable files

- `game/survival/world/a1_authored_world_reader.gd` — Godot 4.7 `RefCounted` reader.
- `game/survival/world/a1_authored_world_stream.gd` — optional bounded `Node2D` source stream.
- `data/survival/world/a1_round12_runtime_contract.v1.json` — coherent source pins, routes, spawn policy, A8 references, visual bindings and owner fences.
- `data/survival/world/a1_round12_spawn_index.v1.json` — deterministic derived spawn candidates; contains no runtime inventory or player state.
- `data/survival/world/references/a8_e1fe550b/` — byte-copied, hash-pinned A8 reference contracts only; no A8 scenes or mechanics are vendored as mounted production.
- `tools/survival/worldgen/compile_round12_runtime.py` — read-only compiler for the spawn index and native packet.

Regenerate and check the derived files:

```bash
python tools/survival/worldgen/compile_round12_runtime.py \
  --out artifacts/a1-round12/round12_native_inputs.json
python -m pytest tests/survival/world/test_round12_deep_world.py -q
```

The compiler does not rewrite the masterplan, any chunk, original legacy data, A8 references, or art payloads.

## A0-compatible reader seam

```gdscript
const A1Reader := preload("res://game/survival/world/a1_authored_world_reader.gd")
var reader := A1Reader.new()
if not reader.configure("res://data/survival/world"):
    push_error(reader.last_error)
```

The original adapter calls remain available with their existing result dictionaries:

- `configure`
- `load_chunk`
- `cell_layers`
- `resolve_cell`
- `resolve_build`
- `check_seam`
- `chunk_id_at`

`configure` verifies the complete coherent dependency set and all **192** chunks. The frame is exactly **1024×768 cells / 16 px / 64×64 chunks**. Out-of-frame queries return `CELL_BOUNDS`; the reader never fabricates water or walkable cells to satisfy a larger advertised bounds rectangle.

Additive queries include:

- `cell_identity`, `named_value`, `traversal_profile`
- `poi_by_id`, `poi_cells`, `pois_near`, `pois_in_chunk`
- `resource_nodes_near`, `resource_nodes_in_chunk`, `opportunities_near`
- `roadside_sources_in_chunk`, `physical_site`, `route_graph`
- `choose_safe_spawn`, `spawn_candidates`
- `source_report`, `temporal_context`
- `world_frame`, `world_pixels`, `authored_chunk_manifest`, `is_ready`

The original build rule is unchanged: `build_permission=2` delegates to A0, historical `build=0` is not a denial, and only `walk`/`road` overlays are mutable. Preserved cells reject overlays.

## Spawn contract

The current derived index contains **27,445** eligible cells in **20 chunks** across Ashen Crown, Amberwood and Mirrormere. These are broad source candidates, not three spawn fixtures. Selection hashes `world_id|run_seed|round12-spawn-v1`, then chooses a candidate chunk and local cell deterministically. A0 must persist the selected cell run-locally; the same seed/query is reproducible.

Eligibility includes safe 3×3 terrain, zero hazard, non-preserved source, safe-region capability rules, POI/A8/roadside body clearance, road distance and nearby ordinary material opportunity. The native matrix uses 36 fixed seeds and physically drives 12 non-trivial road-return cases. This does not approve A0's final spawn policy.

## Optional live stream

```gdscript
const A1Stream := preload("res://game/survival/world/a1_authored_world_stream.gd")
var stream := A1Stream.new()
add_child(stream)
stream.configure("res://data/survival/world", reader, false)
stream.update_stream(hero.global_position,
    Rect2(hero.global_position - Vector2(480, 360), Vector2(960, 720)))
```

The stream mounts only real chunk IDs intersecting the supplied rect plus the Hero chunk. It records mount/drain events, source hashes, timings and bounded active counts. It does not stream outside the authored continent.

- Outside the inset, merged `walk=0` rectangles supply terrain collision.
- The original `OverworldWorld` remains rendering/collision/build authority for the **384×256** inset. The isolated driver applies only the two authored seam carves to its temporary world; original prop bodies remain blocking.
- Exact curated presentation windows retain their accepted ground/overlay/prop payloads. Other cells use source-surface mappings and explicit material-frame source proxies; this is not a 192-chunk art repaint or final D015 approval.
- Resource and generic landmark proxies have canonical identity metadata but no drops, interaction, or new collision rules. Exact A8 and roadside bodies use their pinned source rectangles.
- Curated warm lights use A1's private light mask. Gold, Hero VFX, avatars and production lighting are not repainted.

## Dynamic run-local descriptor

`apply_structure` is an isolated stream-fixture seam, not paid construction approval:

```gdscript
stream.apply_structure(cell, "walk", 0, expected_base, revision, structure_id)
```

It requires non-preserved `build_permission=1`, `walk=1`, `hazard=0`, a matching expected base and a newer revision. The fixture creates a visible `fence_h` and matching full-cell body. A stale revision is refused. The native test reconstructs reader/stream from a plain descriptor, remounts the structure's chunk, repeats the real-Knight physical refusal after reload, captures the visible structure, and drives a real detour and return.

This is **not SaveService**, A0 build validation, construction cost, inventory, health, or production persistence. `temporal_context(world_time_seconds, run_elapsed_seconds)` is pure: identical inputs produce identical online/offline context, and the 336-hour boundary never changes master geography. Production 2PID/save/reset/Ragnarok behavior remains `NOT_TESTED`.

## Physical and visual evidence scope

The isolated driver uses the real A0-comparable Knight scene, 12×16 body, 96/900/1100 movement constants and stand camera. It drives inset → existing roadside salvage → exact Quarry/Orchard/Mill outer approaches → inset, with no within-route teleport. It separately proves dynamic baseline/block/reload/detour and two warned hazard retreats. A8 interiors, interactions, rewards, damage and production mounting are not executed.

The report uses the CT journey IDs without upgrading their scope: J01 broad spawn/explore-first geography, J03 locked-POI discovery and alternate access, J04 preparation/retreat, J06 home/outpost logistics, J07 route cost/opportunity alternatives, and J12 three non-dungeon geographic options. Home-first value, credential/power activation, carrying, A3 net loot value, three productive sessions and dungeon-preparation outcomes remain explicitly untested.

Captures come from the live source stream at **1280×720, 2560×1440 and 3840×2160**, across all 11 regions, with paired day/night views. Hazard probe stands are labelled with their required preparation and are not called safe spawns. Pillow sheets remain supplementary only. Capture filenames are artifact-portable even when a logical day/night pair ID contains `:`. The automated nonblank check rejects solid/two-tone samples; it does not score art richness or grant visual acceptance.

CI first runs a 64-cell **budget probe** with 720p/1440p/2160p captures plus one explicit single-resolution 720p branch capture. The full process will not launch unless a measured, margined timeout fits the 1,800-second cap. A probe is always `NATIVE_FIXTURE_PASS=NOT_TESTED`; any Godot `SCRIPT ERROR` fails the job even if later assertions continue.

## Dispositions

Each gate is independent:

- `SOURCE_READY`: source pins, compiler and reader contract only.
- `NATIVE_FIXTURE_PASS`: the completed isolated Godot matrix only.
- `PRODUCTION_MOUNTED`: A0 production integration; not established by A1.
- `PLAYER_PLAYABLE`: production player/E2 experience; not established by a fixture.
- `VISUALLY_ACCEPTED`: separate visual review; never inferred from successful capture creation.
- `NOT_TESTED`: explicit absence of evidence, not a failure or silent pass.

No loot, POI economics, production save behavior, Gold effects, boss behavior, weather/cargo/pets, six-Elder recreation, or final movement/friction balance is authorized here.
