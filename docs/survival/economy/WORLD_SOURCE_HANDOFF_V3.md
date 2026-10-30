# A3 V3 — Source-authoritative world loot / production handoff

Status: **A3-scoped implementation; native-fixture CI queued (GitHub hosted-runner backlog); production world mount pending A0.**
This is not a documentation-only completion and not a claim of S3+ world integration.

Verification at the V3 code SHA: Python 39 tests OK; catalog validator PASS; independent tree-sitter-gdscript syntax oracle reports 0 errors for `economy_service.gd`, `world_source_adapter.gd` and `economy_adapter_test.gd` (syntax only, not runtime). Godot 4.7 native cases 21–23 are authored and wired into `.github/workflows/survival-a3-economy.yml`; the native run must be confirmed green when runners recover. Logs: `docs/survival/economy/verification/v3/`.

## Canonical A1/A3 contracts (pinned A1 PR #20 @ 2951bf85)

| Site | Action / instance | Cost | Reward | Policy |
|---|---|---|---|---|
| Waystation locker | `pry_locker` | — | `cap_salvage`, **0 items** | one-time |
| Waystation ledger | `seal_ledger` | — | `cap_seal_1`, **0 items** | one-time, requires `cap_salvage` |
| Waystation outside cache | `cache_restock` / `node_waystation_cache` | — | `iron_scrap 3 + knowledge_spares 2` | 1800 **active** s, generation receipt |
| Waystation approach deadfall | `gather_deadfall` / `node_waystation_approach_deadfall` | — | `oak_wood 2` | 300 **active** s |
| Relay shed | `hand_crank_bypass` | `iron_scrap 2 + oak_wood 1` | `cap_power_1`, `bus_powered/bypass_installed` | one-time, requires `cap_salvage` |

Binding data: `data/survival/items/world_source_bindings.v3.json` (schema `soh.economy.world_source_bindings.v3`).
Identity is `source_class | region_id | poi_id | instance_id`; rewards are deterministic, no Core, no Gold-valued grant, no random first-Core table. The superseded A3 locker reward (2 scrap + 2 spares) is removed from `sources` adoption and the progression model.

## A0 integration API (SaveService remains the sole authority)

```gdscript
eco.configure_world_host(host_callable)          # A0 composition root only
eco.advance_world_time(poi_id, event_id)         # call from the pausable active clock
eco.world_action({"poi_id":…, "action_id":…, "instance_id":…}, event_id)
eco.world_projection(poi_id)                     # read-only A6/A0 projection
eco.has_capability(capability_id)
```

`world_action` accepts **only** `poi_id`, `action_id`, optional `instance_id`. Costs, rewards, cooldown, generation, capability and receipt are derived from the pinned binding + host, never from the caller or UI.

Host receipt (`soh.economy.world_host.v1`) must be produced by A0 from authoritative state:
`contract, poi_id, discovered, hero_cell:Vector2i, active_seconds, session_id, session_index, sequence, world_revision`.
`active_seconds` is cumulative **active** gameplay time (max quantum 3600 per receipt). A new session rebaselines the host counter; offline time is never credited. Cooldowns compare the stored cumulative counter, so remaining cooldown survives reload/new session.

All world state is written inside the existing four-argument `_transact` → `SaveService.transact_once` candidate under `world_slice` (`soh.world.slice_state.v1`): `capabilities[]`, `pois.<poi_id>`, `clock`. Canonical A1 keys (`a1slice:<poi>:<action>:<claim_index>`) live in `pois.*.reward_receipts` and receipt metadata `a1_transaction_key`. There is no side journal and no second inventory/save authority. Capacity is prechecked on a duplicate candidate before any cost/state mutation; full bag rejects the whole claim (`inventory_full`). Missing costs reject without partial consumption. Failed authoritative save leaves inventory, world state and receipts unchanged.

## Complete source → research → output example (native case 23)

`pry_locker` → `seal_ledger` → 4× canonical cache (1800 active s apart; 12 scrap / 8 spares) → deadfall → relay (−2 scrap −1 oak, `cap_power_1`) → live `SurvivalService.harvest` oak/stone/reed/iron → SaveService home-storage round trip → hand-craft workbench/furnace kits → charcoal + 4× smelt_iron → weave_cloth → research_kit (−3 spares) → 2× make_notes + 3× make_spares → targeted `research_recipe(iron_pick)` (−6 spares −2 notes) → craft physical `iron_pick` → reload preserves capability, learned recipe, instance and cumulative active clock.

Progression-model consequence: with the canonical zero-item locker, the 45-minute sparse model now reaches `research_kit` in session 3 and first manufacture in session 8 (V2 had free locker Spares). This is the honest cost of the corrected A1 contract, not an arbitrary rebalance; the renewable outside cache funds the loop without a new grant.

Catalyst honesty: `crypt_bone_shard` and `soul_ember` have **no live renewable world node** in the current catalog. Case 23 obtains them only through explicit `legacy_chapter1_2` reward fixture setup, labelled as existing rewards, not a new A3 free grant. The canonical cache alone can bootstrap Spares over repeated active-time claims; production binding of bone/ember catalysts remains A1-pending.

## Minimum A0 mounting step (A3 cannot self-certify production)

1. Refresh `game/survival/economy/vendor/a3_economy_service.gd` and the pinned A3 source SHA in `create_pinned_economy_port`. Current A3 service SHA256: `4f9165468cf98b557984c63168b84ace4dae264ef56e659ca7fe42c06802e82c`; adapter helper SHA256: `689a9b89dba4d756387b6b5c5f09b54d90ff0a787395f5e2fb523da496836efe`; binding data SHA256: `b1d291d035c9e543e69281da268b378c8e1bb498be561b2f15e67c840792b353`.
2. Keep `EconomySession` as the active-time host; add a world-host callable that reads the same pausable clock plus A1 discovery/stand-cell authority and returns the receipt above.
3. Route one reachable A1 container/A8 intent (`soh.native_poi.intent.v1`) to `world_action`; A0 re-checks actor/access/capability/identity/capacity/costs/idempotency and commits items + ledger + cooldown + site state in the one SaveService transaction.
4. Ensure `data/survival/items/world_source_bindings.v3.json` is present in the production data mount.

Until A0 does this, the broader Godot runtime validation may report a vendored-hash mismatch; that is the expected handoff boundary, not an A3 catalog failure.

## External reuse (pinned, license-checked)

- The FOG `9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7` (MIT source; art excluded): discovered-vs-learned research gating referenced. Its consume-then-refund crafting was **rejected**.
- GLoot `6b09b87ac07a8536779ef1ab0fafc7e99830f948` (MIT): capacity precheck / split-merge ordering ideas referenced; no second inventory service ported.
- Survival Core Lite `df0c9c03…` and Nouf `c481ba60…`: partial-loss / naive inventory crafting **rejected**.
- A1 `slice_state_machine.gd` is a test-only contract model; A3 reimplements the reducer shape in the production SaveService adapter rather than porting a second authority.
