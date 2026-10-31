# A0 Adoption Manifest — A3 Value Economy (R13-A3-CLOSE, v2)

**Version:** 2.0
**Status:** `OWNER_NATIVE_PENDING_EXACT_HEAD_CI` → `PRODUCT_COMPOSED_NOT_TESTED`
(never `PRODUCT_COMPOSED_PASS` from an A3 branch)
**Machine-readable contract:** [`A0_ADOPTION_CONTRACT_V2.json`](A0_ADOPTION_CONTRACT_V2.json)
— regenerated from the tree by `python tools/survival/economy/a3_adoption_contract.py`,
so every SHA-256 in it is the file that was tested.
**Branch:** `arena/daadd745-soul-of-hero`
**Predecessor:** `b751a29f213d3c934caa204eb8d2d86943f07b65` (PR #19) — audited, not trusted
**Audit of record:** [`R13_A3_CLOSE_AUDIT.md`](R13_A3_CLOSE_AUDIT.md)

---

## 1. Why v1 was withdrawn

The predecessor manifest stated "zero migration", "OWNER_NATIVE_READY" and described
`authenticate_source(source_id, "A1")` as *physical* authentication. All three were
wrong:

* the API only compared a caller-supplied owner string, so any caller could mint
  source entitlement;
* four source ids (`roadside_oak_1`, `roadside_stone_1`, `roadside_iron_1`,
  `quarry_deep_1`) exist in no A1 binding;
* the R13 native suite never executed (nine hard Godot 4.7 `Variant` inference errors
  on the exact audited SHA), so "ready" had no engine evidence.

A7 R17 separately recorded `A3_SERVICE_REFUSED_BY_SCOPE` against the composed tree.

## 2. What A0 is asked to compose

The full list with SHA-256, role and per-file action is in
`A0_ADOPTION_CONTRACT_V2.json` (`files[]`). Summary:

| Group | Files | Action |
|---|---|---|
| Canonical economy core (V5–V7) | `economy_service.gd`, `offline_operation_planner.gd`, `meta_economy_planner.gd`, `world_source_adapter.gd` | **Replace any A0 vendored fork** by the exact hashes in the contract |
| R13 custody layer | `a3_economy_service.gd` | Instantiate **after** the canonical service; configure with the same SaveService |
| Catalogs | `data/survival/items/*.json` (58 items, 5 pinned A1 bindings, sources, loot), `data/survival/recipes/*.json` (38 recipes, stations, research, offline/meta policies + schemas) | Include |
| SOUL item resources | `data/content/items/item_catalog.tres` + 7 R13 `.tres` | Include |
| Gates | `tests/survival/a3_value_economy_test.gd`, `economy_adapter_test.gd`, `tools/ci/gd_r13_static_check.py`, `tools/ci/verify_r13_receipts.py` | Run as gates |

**Removed in this round (do not resurrect):**
`game/survival/economy/roadside_source.gd`, `game/survival/economy/quarry_source.gd`
— fabricated source identities superseded by the pinned A1 binding document.

## 3. Composition order (exact)

1. A0 `SaveService` remains the single inventory/transaction authority.
2. `economy_service.configure(SaveService, station_resolver)`.
3. `economy_service.configure_time_host(active_tick_receipt_host)` — the
   `soh.economy.active_tick.v1` producer.
4. `economy_service.configure_world_host(world_host)` (only when A1 discovery/cells
   are wired) and, if used, `configure_offline_time_host(offline_projection_host)`.
5. `a3_economy_service.new()`; `configure(SaveService, economy_service)`;
   `configure_source_host(A1_source_host)`.
6. Nothing else. A3 never creates a SaveService, wallet, clock, queue or catalog loader.

## 4. One authority per concern

| Concern | Owner | Evidence in code |
|---|---|---|
| Inventory, receipts, durability | A0 `SaveService.transact_once` | every A3 mutation goes through one transaction |
| Station queue, escrow, maturity | canonical `EconomyService` (`enqueue`/`advance`/`collect`/`cancel`) | `prepare_at_station`, `advance_station`, `claim_production`, `cancel_production` are thin delegations |
| Recipe knowledge (3 mechanisms) | canonical `research_recipe(blueprint|specimen|targeted)` → `survival.knowledge.recipes` | `research_blueprint` / `research_specimen` / `research_targeted` |
| Clock | A0 active-tick receipt | no `set_time_source`, no wall-clock maturity, absent host fails closed |
| Physical source identity | pinned A1 bindings + injected A0/A1 source receipt | `verify_source_receipt` |
| Quarry | A8 authorization document | REJECTED → fail closed; no Quarry binding exists |
| UI | A6, read-only | `get_projections()` mutates nothing |

## 5. Save namespaces

| Namespace | Written by | Purpose |
|---|---|---|
| `inventory.item_stacks` | A0 only | materials/Core tokens |
| `applied_transactions[...]` | A0 | `soh.a3.source_claim.<source>.<n>`, `soh.a3.source_auth.<source>.<h>`, `soh.a3.discovery.<h>`, canonical `soh.a3.*` receipts |
| `survival_economy` | canonical | schema/instances/jobs/technologies/counter/time/offline/meta |
| `survival.knowledge.recipes` | canonical | learned recipes |
| `world_slice` | canonical `world_action` | A1 discovery/claim counters/reward receipts |
| `mastery.a3_source_receipts` | A3 | binding identity + binding-document SHA + host session/sequence |
| `mastery.a3_discoveries` | A3 | reverse-use display knowledge (never authorises a grant) |

## 6. Migration

**No schema migration is required.** R13 has never been composed into a shipped save.
Three predecessor keys are **removed** and are no longer read for authority:

* `mastery.a3_station_jobs`
* `mastery.a3_job_counter`
* `mastery.a3_learned_recipes`

If an experimental save contains them, they are inert and `SaveService.RESET_ALL`
clears them. V5–V7 documents (`survival_economy` schema 2, legacy v1) keep loading
unchanged; the adapter/offline/meta regression tests run on every push.

## 7. Verification A0 must reproduce

| Gate | Command | Proves |
|---|---|---|
| Static hazard | `python3 tools/ci/gd_r13_static_check.py` | no Variant inference, no duplicate `var`, no second authority, no cross-step shell state |
| Import | `godot --headless --path . --import` | the script actually parses on Godot 4.7 |
| Process 1 | `A3_TEST_ROLE=process_1` + shared `SOUL_OF_HERO_SAVE_PATH` | authenticate → harvest (wear) → research → paid enqueue |
| Process 2 | `A3_TEST_ROLE=process_2`, same save, **separate step** | reload → refuse early → mature → collect once → refuse duplicate |
| Receipts | `python3 tools/ci/verify_r13_receipts.py --p1 ... --p2 ...` | distinct PIDs, one paid settlement, conservation |
| Negative controls | default role | forgery ×7, cooldown, one-time exhaustion, tool wear, full bag, obstructed disk write, cancel, stale run, reset |
| Canonical regression | adapter + offline + meta + tool-use + restart suites | V5–V7 behaviour unchanged |

## 8. Consumer handoff

* **A6:** `get_projections()` and `route_comparison()` are read-only. UI flags never
  authorise a claim, grant, craft or research event.
* **A7:** do not mark `PRODUCT_COMPOSED_PASS`, balance or acceptance from an A3 branch.
  The Quarry remains `BLOCKED_PENDING_A8`.
* **A8:** supply a durable site instance, native two-route collision/reload proof and a
  new **APPROVED** authorization SHA before any Quarry source, cost or reward exists.

## 9. Status table

| Milestone | Status |
|---|---|
| A3 source + catalogs | ✅ this branch |
| Static hazard gate | ✅ executes on every push |
| Godot 4.7 native R13 (two processes + negatives) | ⏳ exact-head CI on this branch |
| V5–V7 canonical regression | ✅ on the same workflow |
| A0 composition of the 29 files | ❌ pending A0 |
| Product acceptance / human playtest / balance verdict | ❌ not claimed |
