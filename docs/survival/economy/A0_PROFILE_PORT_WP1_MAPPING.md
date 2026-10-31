# CT ROUND11 P1 — WP1: A3 meta-economy ↔ A0 profile port signature/hash mapping

Status: A3-owned reference only. The real A0 profile port lives in A0's repo
(commit `84ac9c1afe19627044c572f6f76794f4923334d6`, path
`game/survival/economy/a0_profile_port.gd`). It is NOT in this clone and must
NOT be edited here — WP1 treats it as read-only reference material.
`no A0 branch edits` stands.

## 1. Contracts referenced

- A0 profile port: `soh.economy.a0_profile_port.v1` / run context
  `soh.economy.a0_run_context.v1`
- A3 meta-economy planner: `soh.economy.meta_economy_planner.v1`, policy
  `data/survival/recipes/meta_economy.v1.json` (policy_revision 1)
- A3 offline planner: `soh.economy.offline_operation_planner.v1`, policy
  `data/survival/recipes/offline_operations.v1.json`
- A3 tool-use callable: `soh.economy.tool_use.v1`

## 2. Exact method mapping (A0 port → A3 callable)

| A0 profile port method | A3 method (game/survival/economy/economy_service.gd) | Ownership | Notes |
|---|---|---|---|
| `run_context()` -> `{contract,run_id,run_epoch,run_started_at_unix,now_unix,expires_at_unix,status}` | none — A3 validates `status == "active"` and `now_unix < expires_at_unix` against `RUN_MAX_SECONDS` (1209600 = 336h) from creator-locked policy | A0 owns RunLifecycle; A3 never invents run expiry | Init vector: A0 calls `ensure_run(max_seconds)` before A3 planning |
| `endpoint_authority(endpoint_id)` -> `{...,visited,operational,hero_cell}` | none — A3 checks `visited && operational` and hero-on-stand at the endpoint cell | A1/A8 placement + A0 authority | UI flags never authorize |
| `source_authority(source_id, source_instance_id)` -> `{...,generation,opened,depleted,phase}` | none — A3 checks generation/opened/depleted/phase before any source claim | A8/A0 source identity; no A3 POI logic | Forged generation → `source_generation_forgery` |
| `read_profile(candidate)` -> `{secured_ragnarok_currency, achievements.elder_stones, run_history}` | none — A3 reads the same SaveService candidate | A0 sole profile authority | No second wallet; no A3 profile autoload |
| `apply_profile_delta(candidate, delta, receipt)` -> bool | `_meta_economy.apply_deposit(...)` inside A0's `SaveService.transact_once` mutator | A0 commits once; key `soh.a3.meta_deposit.<proposal_id>` | Rejects negative balance; idempotent replay key |

## 3. Deposit seam wiring (exact, consumable by A0)

A0's `commit_meta_deposit(proposal_id, applier, payload)` calls
`applier.call(candidate)` with ONE argument inside ONE
`SaveService.transact_once(key="soh.a3.meta_deposit.<proposal_id>")`. A3's
`apply_meta_deposit(candidate, proposal, request)` takes THREE arguments, so
the composition root must bind `proposal` and `request`:

```gdscript
## A0-side composition-root example (not A3 code):
var applier := func(_candidate: Dictionary):
    return economy_service.apply_meta_deposit(_candidate, proposal, request)
var commit_result := profile_port.commit_meta_deposit(proposal_id, applier, payload)
```

Equivalent A3-side shim shape (bound request reordered to candidate-first):

```gdscript
func meta_deposit_port_applier(proposal: Dictionary, request: Variant) -> Callable:
    return Callable(self, "_apply_meta_deposit_bound").bind(proposal, request)

func _apply_meta_deposit_bound(proposal: Dictionary, request: Variant, candidate: Dictionary) -> Dictionary:
    return apply_meta_deposit(candidate, proposal, request)
```

Inside the mutator: A3 re-plans from the candidate, removes exact physical
tokens (currency custody at an authorized deposit endpoint), marks them
deposited, then calls `port.apply_profile_delta(+amount)`; A0 commits the
candidate once. Replayed key returns `duplicate`; interrupted write leaves the
old candidate intact. No chest open, boss kill, home storage, death, expiry or
reset may call `apply_profile_delta` without physical token custody.

## 4. Offline seam (already paid work)

`plan_offline_operations(host)` is read-only; A0 commits with key
`soh.a3.offline_settle.<proposal_id>` via `transact_once` calling
`apply_offline_operation_plan(candidate, proposal, request)`. Paid inputs are
reserved at enqueue/arm time; production time is projected only from armed
jobs; claim-once via proposal id; full storage keeps output in job escrow;
cancellation refunds reserved inputs; destroyed/station-revision-changed
station yields `station_revision_mismatch` and pauses; run expiry clamps
`effective_end_unix` and forbids post-expiry progress. No second clock: the
offline time host is opt-in fixture-only (`NOT_USER_LOCKED`), never the system
wall clock.

## 5. Tool-use / harvest seam (atomic with A0's node hit)

`plan_tool_use(request)` is read-only: kind match, node kind known, tool
revision fresh, tool owned, `condition >= condition_cost` (exactly 1, no yield
multiplier). A0 performs its node hit + yield grant and
`apply_tool_use_plan(candidate, plan)` inside ONE `SaveService.transact_once`
(keyed by the harvest event id). Insufficient durability → `TOOL_BROKEN`
before any swing; interrupted write rolls back wear and yield; full inventory
rejects before wear; no duplicate resource via idempotent event key.

## 6. Event / receipt hash mapping

| Purpose | Key format | Owner | Idempotency |
|---|---|---|---|
| Meta deposit settlement | `soh.a3.meta_deposit.<proposal_id>` | A0 commits | `is_transaction_applied` → duplicate, no re-mint |
| Meta source claim | `soh.a3.meta_source.<source>.<instance>.<event>` | A0 commits | proposal id |
| Offline settlement | `soh.a3.offline_settle.<proposal_id>` | A0 commits | proposal id |
| Profile currency receipt | `soh.a0.profile.currency.<sha256(receipt_id)>` | A0 port | A0-side receipt dedup |
| Tool-use harvest | harvest event id (A0 transaction key) | A0 transact_once | key replay rejected |

`proposal_id` is generated by A3's read-only plan (`plan_meta_*`); `receipt_id`
is A0's deposit receipt. No second wallet: `secured_ragnarok_currency` lives
only in the profile inside the A0 SaveService document.

## 7. Stale vendored economy bytes — decision

A0's `game/survival/economy/vendor/a3_economy_service.gd` pin `acbe03b0...`
references A3 files pinned at `4bfba38d` (V5-era data + scripts:
`vendor/a3_economy_service.gd acbe03b0`, `world_source_adapter.gd 8bab2441`,
`vendor/a3_world_source_c23292be.gd 689a9b89`). The vendored copy at A0
commit `84ac9c1a` was fetched and is BYTE-IDENTICAL to this repo's
`game/survival/economy/economy_service.gd` at `35214ed8` — which proves the
vendored bytes are a STALE V5 snapshot, not the V7 canonical.

Decision: the vendored bytes are WP1 reference only and MUST NOT be treated as
canonical or copied into A3. A3 canonical V7 is `economy_service.gd` at
`35214ed8` (PR #19 head). A0 production must re-pin or explicitly fail-closed;
A3 will not edit the A0 branch and will not promote stale vendored bytes.
`apply_meta_deposit` against an absent port returns
`A0_PROFILE_BOUNDARY_ABSENT` (native tested).

## 8. What is NOT claimed here

No A0 production mount, no human playtest, no native execution in this
environment (no Godot binary available; native GDScript tests run on hosted
CI), no visual capture. V7 evidence level:
`OWNER_CONTRACT_CANDIDATE / NATIVE_FIXTURE_PASS / WORLD_NOT_INTEGRATED /
NOT_HUMAN_PLAYTESTED`.