# A8 → A0/A1/A3 Quarry integration candidate

**Disposition: prepared, not production-approved.** This is the one canonical handoff candidate for A8's native Quarry scene. It makes no live item grant and is not an isolated mock reward. The complete machine-readable request is `data/survival/world_content/quarry_integration_candidate.v1.json`.

## Exact source identity and refreshed pins

- Integration target: `feature/survival-rpg-foundation-20261029` at `86831332324428c7623ad431a577d101b7af5c9c`. PR #26 now targets this branch; the current Arena branch retains its shared ancestor `5214788933b1a827f3a177d11ff486433dfe5e8a` and only A8-owned paths appear in the PR diff. No history was rewritten, transplanted, or self-merged.
- A1 PR #20 current head: `2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b`. Canonical site: `world:soh_continent_v1` / `poi_crown_south_quarry`, region `r_ashen_crown`, cell `[30,280]`, four-tile radius, currently `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`. A8 now offers `south_quarry_overworld.tscn` as the compact 128×128 1:1 shell and treats `south_quarry.tscn` strictly as the separately entered local worksite; A0 still owns the live mount and transition.
- A3 PR #19 current head: `c5e80922132ca9cf89ea15c480e1a4be465ba0b7`. Existing item IDs are `oak_wood`, `stone_chunk`, and `iron_scrap`; their catalog `balance_status` is `SOH_PROPOSAL`. The current `data/survival/items/world_source_bindings.v3.json` schema is `soh.economy.world_source_bindings.v3`; its inspected rows bind Waystation cache/deadfall and Waystation/Relay actions only, with no Quarry, Orchard or Mill binding. Generic `live_oak_wood`, `live_stone_chunk`, and `live_iron_scrap` have `poi_id: null` and proposed—not authorized—rates. No A3 source currently binds the Quarry instance.
- A0 PR #21 current head: `5387bed6260cb7b9bd4d8229ee759dee08a0d918` (draft and currently conflicting with the integration base); its current Knight script exposes `get_facing_direction()`, which A8 calls first when composed. A6 PR #24 current head: `08ccb8348f2e7a75e09af47a1741c158fc46e794`. Pins are refreshed snapshots, not guarantees; owners must refresh them before merge/integration.
- The previous handoff cited A8 work-order / D051–D052 policy snapshot hashes `b19b5ef305229b7b3ee8477f15ca2ac9f679e2b2` and `9332cb9ba25da3026ede0cad578a90f0e4b5a2b6`, but neither object is present in this checkout. The accessible decision ledger ends at D050; D051–D054 remain unverified and are not treated as policy evidence in this patch.

The Quarry's durable physical instance ID is deliberately **null**. A0/A1 must resolve one from the canonical world ID, POI ID, and A1 cell; A8 does not mint a competing world identity. Mount `res://game/survival/world_content/scenes/south_quarry_overworld.tscn` at the exact A1 cell using the existing cell-to-world transform. The 960×608 `south_quarry.tscn` is an interior-only worksite reached through the versioned physical doorway contract; its local spawn is never a world position.

## A8-local source-backed art update

`data/survival/world_content/a8_art_manifest.v1.json` pins selected 16×16 terrain and source-sized prop rectangles to A1 PR #20 head `2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b`. The corresponding original-SOH atlas images are copied into A8-owned `game/survival/world_content/art/`; their SHA-256 values match the A1 atlas manifest exactly. The runtime uses a 16 px `TileMapLayer`, nearest filtering, native-size `Sprite2D`s with integer bottom-center anchors, and the shared A1 ambient day profiles. The same source frames dress all three 128×128 canonical shells and three separate 960×608 worksites; accepted owner projections update site-specific props and paths. The renderer is visual-only and adds no collision; authored substantial wall and tree masses have matching A8 collision geometry. No Drive assets, Cainos art, avatar changes, or third-party raw packs were used. This is not evidence of a reviewed native render or production mount; see the pilot status for current validation results.

## Canonical A8 action requests

| Action ID | Physical object | Owner request | Current authorization |
|---|---|---|---|
| `brace_east_shelf` | `brace_oak` | Persist `quarry_route=east_braced`; request an A3-approved `oak_wood` debit | Item exists; item and action price are `SOH_PROPOSAL`. Amount is unset. |
| `chock_west_ramp` | `chock_stone` | Persist `quarry_route=west_chocked`; request an A3-approved `stone_chunk` debit | Item exists; item and action price are `SOH_PROPOSAL`. Amount is unset. |
| `leave_seam_unworked` | `south_seam` | Persist the safe leave choice without an item transaction; keep extraction unavailable | World-state-only intent; A0 must preserve the safe-route invariant. |
| `extract_outcrop` | `south_seam_outcrop` | After a committed safe route, request one A0 atomic claim using `stone_chunk` and source candidate `live_stone_chunk` | **Blocked.** A3's source is generic, `poi_id:null`, and `SOH_PROPOSAL`; no Quarry grant, quantity, or timer is authorized. |

The action/object IDs above are exact A8 IDs. Numeric amounts, yield, and cooldowns embedded in the S2 fixture are not production prices/rates and must be ignored by a production host. A3 must approve or reject both route costs and the site-specific source mapping before any grant can be enabled.

## Owner transaction and save contract

A8 emits the versioned intent and accepts an owner result/projection; it never mutates inventory or saves site authority. A0 should expose the adapter through its SurvivalService and commit through the existing `SaveService.transact_once` boundary. The current A0 head has no A8 POI adapter, and its current survival-state sanitizer does not yet project a `world_pois` domain; those are A0-owned changes, not A8 edits.

For every request, A0 validates the canonical A1 instance, live actor stand/range/facing, capability, current persisted route, A3 item/source/action authorization, affordability, bag capacity, and once-only claim or owner-derived resource generation. It derives its stable receipt identity from `(world_id, poi_id, cell, object_id, action_id, claim generation)` rather than trusting scene-local `already_looted` or a client-chosen fresh claim key. Cost/reward, claim receipt, route state, replenishment deadline/generation, and projection revision must commit in the same SaveService candidate. Failed or interrupted pre-commit attempts return the unchanged projection and do not consume materials.

A0's persistence projection needs a migration-safe per-POI record under the existing survival namespace. The scene-facing projection consists of `schema_version`, `site_state`, `claim_generation`, `capabilities`, `ready_actions`, `resource_ready_at`, `clock_seconds`, and a revision supplied by the owner. A0, not a scene timer, computes delayed Orchard returns and replenishment.

## Selected source-code reuse: The FOG

Inspected actual The FOG files at commit `9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7`: `scripts/loot/loot_container.gd` and `scripts/loot/loot_table.gd` (source license at that commit explicitly says MIT for GDScript/scenes/shaders only; art under `assets/`, `Sprites References/`, and `images/` is all-rights-reserved). Its useful small pattern is a proximity-interaction object with clear closed/open presentation and container-specific physical dimensions. Its own `already_looted` flag and generated `InventoryGrid` are local state, not durable authority; its loot-table percentages and item definitions are not A3 data. No The FOG code or art was copied. A8 retains the useful physical socket/visual separation while keeping claim, inventory, and persistence owner-controlled.

## Mount and test instructions

1. A0 resolves `world:soh_continent_v1` + `poi_crown_south_quarry` + `[30,280]` to the one physical instance and mounts only `south_quarry_overworld.tscn` with the exact 1:1 A1 transform. On the real doorway request, A0 transitions to `south_quarry.tscn`, validates destination/return identity, and persists actual global coordinates; the local spawn remains local. Validate route clearance with A1 before enabling player entry.
2. Inject A0's adapter; reject `provisional_test_only=true` in release. Bind A3-approved item/source/action definitions only. Until A3 approval, show no extraction reward and charge no route cost.
3. Load the A0 projection before interactions; feed committed/rejected owner results back through `receive_authoritative_result()` and `set_projection()`.
4. In the native host test, cover stand/facing/range, collision clearance and retreat, missing capability, insufficient materials, full bag, interrupted commit/retry, duplicate/stale claims, and save/reload. Confirm the route change and outcrop cooldown survive a process reload.

This candidate is ready for owner review, **not live mounting**. The current A8 site harness remains test-only. Native Godot execution and capture inspection remain pending; see `A8_NATIVE_POI_PILOT.md` for exact current evidence status.
