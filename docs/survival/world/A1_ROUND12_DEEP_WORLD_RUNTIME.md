# A1 Round 12 — deep world runtime handoff

Status: **SOURCE READY / ISOLATED + COMPOSED NATIVE FIXTURE PASS / PRODUCTION + VISUAL HOLD**. Native target `2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6` passed the isolated, frozen-composed and forward-composed Godot matrices. This remains an additive A1 source reader and isolated native fixture, not an A0 production mount. PR20 remains open; A0 owns production adoption.

## Consumable files

- `game/survival/world/a1_authored_world_reader.gd` — Godot 4.7 `RefCounted` reader.
- `game/survival/world/a1_runtime_compatibility.gd` — fail-closed semantic player/legacy-interface checks; mutable hashes are observations, not pins.
- `game/survival/world/a1_authored_world_stream.gd` — optional bounded `Node2D` source stream.
- `data/survival/world/a1_round12_runtime_contract.v1.json` — immutable world/art/A8 source pins plus a separate semantic runtime-interface contract, routes, spawn policy and owner fences.
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

`configure` verifies the complete immutable dependency set, semantic runtime interfaces and all **192** chunks. The frame is exactly **1024×768 cells / 16 px / 64×64 chunks**. Out-of-frame queries return `CELL_BOUNDS`; the reader never fabricates water or walkable cells to satisfy a larger advertised bounds rectangle.

## Immutable integrity versus mutable runtime compatibility

`source_pins` is restricted to authored world data, legacy data/art, A1 art/contracts and vendored A8 references. The plan and every chunk retain exact SHA-256 verification. The spawn index binds the whole world-plan and runtime-contract hashes and is additionally checked for world/frame/chunk/policy identity, per-chunk candidate-cell hashes, sorted source cells, 3×3 walk/hazard safety, region entry rules and chunk/global region accounting. Deterministic compiler `--check` independently rebuilds the complete index from source.

Mutable Knight/controller/world-script/project bytes are **observations, not replacement pins**. `a1_runtime_compatibility.gd` instead validates the real composed player body and required legacy APIs. Player checks cover enabled 12×16 collision at (0,-8), floating motion, collision layer/mask, numeric motion/health properties, camera offset/smoothing and bound movement actions. They do not require Knight script, sprite or visual identity. `configure(world_root, player_scene_override)` and the corresponding optional stream argument allow a compatible D051 Male/Female Adventurer consumer scene; actual Adventurer visual/native acceptance remains an A0/A6/A7 gate.

Failures are named, including `runtime_interface:PLAYER_BODY_SHAPE_SIZE` and `runtime_interface:LEGACY_WORLD_METHOD_IS_WALKABLE`. Native mutation probes cover plan, chunk, A8 source, legacy tile art, spawn cell hash, stale spawn binding, player shape and world API. Reintroducing a mutable byte pin is itself refused. A compatible actor change never relaxes chunk, route, POI, collision or art checks.

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

The isolated driver loads the exact composed consumer scene from the native packet (the current A0/A6 Knight-hosted technical body), with 12×16 collision, 96/900/1100 movement constants and stand camera; it does not treat legacy Knight artwork as D051 identity. It drives inset → existing roadside salvage → exact Quarry/Orchard/Mill outer approaches → inset, with no within-route teleport. It separately proves dynamic baseline/block/reload/detour and two warned hazard retreats. A8 interiors, interactions, rewards, damage and production mounting are not executed.

The native reader also queries all 11 region viewpoints and requires 11 distinct climate channels and regional material signatures, plus multiple surface/effort proposals. These are source geography queries only: no A0 movement adoption, A3 inventory cost or hazard damage is applied.

The report uses the CT journey IDs without upgrading their scope: J01 broad spawn/explore-first geography, J03 locked-POI discovery and alternate access, J04 preparation/retreat, J06 home/outpost logistics, J07 route cost/opportunity alternatives, and J12 three non-dungeon geographic options. Home-first value, credential/power activation, carrying, A3 net loot value, three productive sessions and dungeon-preparation outcomes remain explicitly untested.

Captures come from the live source stream at **1280×720, 2560×1440 and 3840×2160**, across all 11 regions, with paired day/night views. Hazard probe stands are labelled with their required preparation and are not called safe spawns. Pillow sheets remain supplementary only. Capture filenames are artifact-portable even when a logical day/night pair ID contains `:`. The automated nonblank check rejects solid/two-tone samples; it does not score art richness or grant visual acceptance.

CI first runs a 64-cell **budget probe** with 720p/1440p/2160p captures plus one explicit single-resolution 720p branch capture. The full process will not launch unless a measured, margined timeout fits the 1,800-second cap. A probe is always `NATIVE_FIXTURE_PASS=NOT_TESTED`; any Godot `SCRIPT ERROR` fails the job even if later assertions continue.

## Exact-head evidence and visual review

Native target: **`2a4f6e7964ec38e41ce3af8344f2bc3c37f48cc6`**, engine **Godot `4.7.stable.official.5b4e0cb0f`**, workflow [41199262481](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481). Historical `8551a323` results (249 native/128 oracle checks) are not evidence for this patch.

| Profile | Immutable owner composition | Pre-import composed Git tree | Exact job | Git-blob evidence manifest |
|---|---|---|---|---|
| Isolated A1 | A1 `2a4f6e79`; repository runtime only | N/A — no composed tree claimed | [124531620666](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620666) | `23eb972ea529d9829fd03f6492f4237d139b8af5` |
| Frozen reproduction | A0 `62f6a32d08d319bfdcd28235786558f54f49b420`; A1 `2a4f6e79`; A6 `6d71410a370df805f8b29a018b61380d6c233b65` | `efb776c3e430eeb21aaad9e33add45703552a524` | [124531620685](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620685) | `1dd48a7abae5f58c02c01eea6b61fcaf986582a6` |
| Forward | A0 `86ac20ba6ad6e80e964ef15af8f1fe48f11ee020`; A1 `2a4f6e79`; A6 `6518c09835a273ac1e7b91dc5e6712d6a4c3863e` | `e844bf142e858a5de070204b87fbad8c2bcf3665` | [124531620652](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41199262481/job/124531620652) | `19eaab7c425cb7b708197af78ca9a7dd50268eb3` |

Each profile passed **263 native assertions + 132 independent oracle checks**, **37 driven journeys**, **36 spawn cases / 12 physical**, **69 portable captures**, all eight named integrity/interface refusals, complete reader/stream initialization and zero unexpected contacts, within-route teleports or stream violations. Both composed runners verified **280 exact A1 owner files**, their pinned A0/A6 runtime provenance and no out-of-scope source mutation. The oracle validates runtime observations, spawn bindings and capture bytes; capture dimensions and SHA-256 values are checked against actual PNG bytes. The isolated evidence was additionally fetched from its immutable manifest and passed the oracle locally. Source gates are **160/160 world pytest**, deterministic compiler regeneration and handoff validation. Measured configure/mount/capture timings remain in the native report; headless CI software rendering is not a target-hardware performance certification.

Fresh review of the actual Godot frames covers every region, the physical Quarry/Orchard/Mill approaches, the reloaded palisade, day/night variants and all three resolutions. All 69 same-position capture hashes are identical across isolated, frozen and forward profiles, so the inspected isolated contact sheet and full-size 720p frames represent the composed pixels as well; a composed Quarry frame was also opened directly. The source windows are legible and the technical body remains at a consistent 1× world scale, but visual review is **HOLD/DEFECT**: repetitive or empty fields, crude/abrupt banks and paths, weak night landmark contrast and staged proxy composition still prevent visual acceptance. The visible Knight-hosted body is not D051 Adventurer identity evidence. Successful capture creation and physical traversal do not override that review.

## Dispositions

Each gate is independent:

- `SOURCE_READY`: immutable source pins, deterministic derived data and semantic reader contract only.
- `NATIVE_FIXTURE_PASS`: completed isolated or explicitly named composed Godot matrix at the exact head cited in PR20; each profile is reported separately.
- `PRODUCTION_MOUNTED`: A0 production integration; not established by A1.
- `PLAYER_PLAYABLE`: production player/E2 experience; not established by a fixture.
- `VISUALLY_ACCEPTED`: separate visual acceptance; never inferred from successful capture creation. The current source-window review is HOLD/DEFECT.
- `NOT_TESTED`: explicit absence of evidence, not a failure or silent pass.

No loot, POI economics, production save behavior, Gold effects, boss behavior, weather/cargo/pets, six-Elder recreation, or final movement/friction balance is authorized here.
