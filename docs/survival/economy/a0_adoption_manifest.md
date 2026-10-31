# A0 Adoption Manifest — A3 Value Economy (R13)

**Version:** 1.0  
**Status:** OWNER_NATIVE_READY / PRODUCT_COMPOSED_NOT_TESTED  
**Branch:** `arena/7a12b27e-soul-of-hero`  
**Exact SHA:** `9d751d57` (baseline) → pending push of this manifest  
**Owner:** A3 (economy)  
**Consumer:** A0 (SaveService composition), A6 (UI projections), A7 (product acceptance)

---

## 1. Purpose

Deliver a single trustworthy, native-tested, A0-adoptable paid economy chain
with meaningful player choices and no duplicate authority. A3 owns all source
code listed below; A0 composes it into the production save/load tree without
editing A3 files.

The chain: lawful roadside material + Spares → bounded/directed/destructive
research → newly learned recipe revalues stored ingredients → paid station
operation (physical fuel escrow, not account currency) → durable return payout
→ choice of next route or material sink.

---

## 2. A3-Owner Files for A0 Composition

| File | Role | A0 Action |
|------|------|-----------|
| `game/survival/economy/a3_economy_service.gd` | A3 economy orchestrator (RefCounted, class_name `A3EconomyService`) | Instantiate once, configure with the A0 SaveService autoload node via `configure(save_node)`. Never create a second SaveService. |
| `tests/survival/a3_value_economy_test.gd` | R13 native test suite (SceneTree-based, Godot 4.7) | Run as mandatory CI gate. Supports `A3_TEST_ROLE=process_1\|process_2` for true two-process proof. |
| `tools/run_a3_value_economy_tests.ps1` | Local Windows runner (convenience only, not CI) | Not required for A0 composition. |
| `data/content/items/roadside_oak_scrap.tres` | Item definition (material) | Include in item catalog. |
| `data/content/items/roadside_stone_chip.tres` | Item definition (material) | Include in item catalog. |
| `data/content/items/roadside_iron_scrap.tres` | Item definition (material) | Include in item catalog. |
| `data/content/items/knowledge_spare.tres` | Item definition (material) — physical fuel | Include in item catalog. |
| `data/content/items/quarry_sample.tres` | Item definition (material) — specimen | Include in item catalog. |
| `data/content/items/quarry_core_fragment.tres` | Item definition (material) — processed output | Include in item catalog. |
| `data/content/items/salvage_kit_blueprint.tres` | Item definition (blueprint) | Include in item catalog. |
| `data/content/items/stone_pick.tres` | Item definition (material) — harvest tool | Include in item catalog. |
| `data/content/items/iron_pick.tres` | Item definition (material) — harvest tool | Include in item catalog. |
| `data/content/items/item_catalog.tres` | StackItemCatalog (17 items) | Updated to include all 9 new items. |

**Files NOT to edit:** `game/autoload/save_service.gd` (A0), A1 world files,
A8 scene files, A6 UI files.

---

## 3. APIs A0 / A6 Consume

### `configure(save_node: Node) -> bool`
Bind the service to the A0 SaveService autoload. Loads run-local state from
SaveService mastery (`a3_run_id`, `a3_learned_recipes`, `a3_discoveries`,
`a3_authenticated_sources`, `a3_station_jobs`, `a3_job_counter`). Returns false
if `save_node` is null.

### `get_save() -> Node`
Expose the SaveService node for test/orchestration use.

### `authenticate_source(source_id: String, owner_domain: String) -> bool`
Physically bind a source under an owner domain. A1 roadside sources authenticate
when `owner_domain == "A1"` and the contract exists. A8 Quarry sources require
`a8_authorized == true` in the source contract — a bare string `"A8"` never
mints entitlement. Persisted through `SaveService.transact_once`.

### `is_source_authenticated(source_id: String) -> bool`
Fail-closed gate. Reads SaveService mastery first, falls back to in-memory
cache. Returns false for unknown sources.

### `harvest(source_id: String, tool_id: String) -> Dictionary`
Atomic harvest: tool wear + yield grant in one `transact_once`. Returns
`{ok, reason, yield, tool_condition_remaining, source_yields_remaining,
transaction_key}`. Fail-closed on: unknown source, not authenticated, unknown
tool, broken tool, source exhausted, inventory full, transaction rejected.

### `bounded_random_research(spares_quantity: int) -> Dictionary`
Spend Spares, learn a random recipe from the researchable pool. Atomic spend+
learn in one transaction. Returns `{ok, reason, recipe_learned,
spares_consumed, mechanism}`.

### `directed_research(recipe_id: String) -> Dictionary`
Spend specific inputs, learn a specific recipe. Atomic. Returns
`{ok, reason, recipe_learned, inputs_consumed, mechanism}`.

### `reverse_engineer_specimen(specimen_id: String) -> Dictionary`
Consume a specimen, destroy it, learn its taught recipe. The taught recipe must
be registered in the recipe registry. Atomic. Returns
`{ok, reason, recipe_learned, specimen_consumed, specimen_quantity,
mechanism}`.

### `prepare_at_station(recipe_id: String, station_id: String) -> Dictionary`
Escrow physical fuel + inputs, create a unique job. Outputs NOT granted at
prepare. Returns `{ok, reason, job_id, recipe, station, fuel_item,
fuel_quantity, queue_seconds, outputs, transaction_key, status}`.

### `claim_offline_production(job_id: String) -> Dictionary`
Grant outputs exactly once after queue maturity. Atomic output+claimed flag.
Returns `{ok, reason, job_id, recipe, station, outputs, transaction_key}`.
Rejected on: not found, already claimed, queue not ready, transaction rejected
(full bag).

### `cancel_station_job(job_id: String) -> Dictionary`
Refund fuel, remove job. Inputs remain spent. Idempotent.

### `register_discovery(material_id, use_description, recipe_id) -> bool`
Register a reverse-use lookup. Persisted through SaveService.

### `lookup_use(material_id: String) -> Dictionary`
Return discovered use description + recipe_id for a material.

### `is_discovered(material_id: String) -> bool`
Check if a material's use has been discovered this run.

### `get_projections() -> Dictionary`
Read-only source/recipe/discovery/learned-recipes projections for A6 UI
consumers. No state mutation.

### `set_time_source(source: Callable) -> void`
Inject an external clock for queue readiness. Tests use simulated time;
production A0 injects the authoritative active-session time host.

---

## 4. Item / Source Namespaces

### Item IDs (all in `data/content/items/item_catalog.tres`, 17 total)

| Item ID | Kind | Source |
|---------|------|--------|
| `roadside_oak_scrap` | material | Harvest from `roadside_oak_1` |
| `roadside_stone_chip` | material | Harvest from `roadside_stone_1` |
| `roadside_iron_scrap` | material | Harvest from `roadside_iron_1` |
| `knowledge_spare` | material | Harvest bonus, research fuel, station fuel |
| `quarry_sample` | material | Harvest from `quarry_deep_1` (when authorized) |
| `quarry_core_fragment` | material | Output of `process_roadside_materials`, `process_quarry_sample` |
| `salvage_kit_blueprint` | blueprint | Output of `salvage_kit` |
| `stone_pick` | material | Harvest tool (max_condition 100, wear 25/use) |
| `iron_pick` | material | Harvest tool (max_condition 200, wear 10/use) |

### Source IDs

| Source ID | Owner | Kind | POI ID | Instance ID | Action ID | Authorized |
|-----------|-------|------|--------|-------------|-----------|------------|
| `roadside_oak_1` | A1 | roadside | — | — | — | Yes (A1) |
| `roadside_stone_1` | A1 | roadside | — | — | — | Yes (A1) |
| `roadside_iron_1` | A1 | roadside | — | — | — | Yes (A1) |
| `quarry_deep_1` | A8 | quarry | `poi_crown_south_quarry` | `south_seam_outcrop` | `extract_outcrop` | **No** (fail-closed) |

### Recipe IDs

| Recipe ID | Station | Fuel Item | Fuel Qty | Queue Seconds | Outputs |
|-----------|---------|-----------|----------|---------------|---------|
| `salvage_kit` | salvage_station | knowledge_spare | 1 | 300 | salvage_kit_blueprint x1 |
| `process_roadside_materials` | salvage_station | knowledge_spare | 2 | 600 | quarry_core_fragment x5 |
| `process_quarry_sample` | salvage_station | knowledge_spare | 1 | 120 | quarry_core_fragment x6 |

---

## 5. Migration Needs

None. All A3 state is stored under `mastery.a3_*` keys in SaveService, which
A0 already owns. No schema migration, no data transformation, no backward
compatibility shims required. On a true new-run reset (SaveService
`RESET_ALL_TOKEN`), all A3 run-local state is cleared.

---

## 6. Exact Tests (R13 Suite)

**File:** `tests/survival/a3_value_economy_test.gd`  
**Runner:** Godot 4.7 headless, `--script res://tests/survival/a3_value_economy_test.gd`  
**Exit code:** 0 = pass, 1 = fail

### Single-process mode (default)
24 test groups:

| Group | Tests | What they verify |
|-------|-------|------------------|
| SETUP | 1 | Service configures with SaveService autoload |
| SOURCE_CUSTODY_ROADSIDE | 6 | Auth, unauth fail, exhaustion, tool wear, breakage, inventory full |
| QUARRY_SOURCE_FAIL_CLOSED | 3 | Physical identity, fail-closed, bare A8 rejection |
| RESEARCH_MODEL | 6 | Bounded random, directed, duplicate, persistence, specimen, craftable-only |
| PAID_PRODUCTION | 8 | Escrow-at-prepare, exactly-once, duplicate, early, cancel, unique job ID, wrong run, full bag |
| NEGATIVE_CONTROLS | 5 | Premature claim, capacity overflow, canceled job, stale run, replay |
| TWO_PROCESS_PERSISTENCE_SIMULATED | 1 | Simulated 2P within one process |
| STRATEGIC_ROADSIDE_CHAIN | 1 | Salvage → discovery → research → paid processing → expedition choice |

### Two-process mode (CI)
Run two distinct Godot invocations against the same durable save:

1. `A3_TEST_ROLE=process_1` — authenticate source, harvest, research, prepare,
   write receipt marker to `user://tests/a3_p1_receipt.json`, exit 0.
2. `A3_TEST_ROLE=process_2` — reload same save, verify inventory/knowledge,
   verify job persisted, mature queue, claim once, refuse duplicate, exit 0.

Both must print `P1 PASSED` / `P2 PASSED` respectively. CI uses
`tools/ci/gate_log.sh` to check exit codes, clean error logs, and required
pass lines.

---

## 7. Negative Controls (all must pass)

| Control | Scenario | Expected |
|---------|----------|----------|
| Premature claim | Claim at 1s (queue 600s) | `QUEUE_NOT_READY` |
| Capacity overflow | Full bag (30 stacks) at claim | `TRANSACTION_REJECTED`, no output |
| Canceled job | Cancel then claim | `QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED`, no output |
| Stale run | Change run ID, then claim | `QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED` |
| Replay after claim | Re-claim after success with matured clock | `ALREADY_CLAIMED`, no duplicate output |
| Duplicate research | Research same recipe twice | `RECIPE_ALREADY_KNOWN` |
| Duplicate specimen | Reverse-engineer same specimen twice | `RECIPE_ALREADY_KNOWN` |
| Unauthenticated harvest | Harvest without auth | `SOURCE_NOT_AUTHENTICATED` |
| Unauthorized Quarry | Harvest quarry without A8 approval | `SOURCE_NOT_AUTHENTICATED` |
| Bare A8 string | `authenticate_source("quarry_deep_1", "A8")` without approval | `false` |

---

## 8. Balance / Source→Sink Receipts

| Flow | Input Cost | Fuel Cost | Output | Tool Wear | Time |
|------|-----------|-----------|--------|-----------|------|
| Harvest oak | — | — | 1 oak_scrap | 25 (stone_pick) | — |
| Harvest iron | — | — | 1 iron_scrap | 10 (iron_pick) | — |
| Directed research: salvage_kit | 3 oak + 2 stone + 1 spare | — | recipe learned | — | — |
| Directed research: process_roadside | 5 oak + 3 iron | — | recipe learned | — | — |
| Prepare: salvage_kit | — | 1 spare | deferred | — | 300s queue |
| Prepare: process_roadside | 5 oak + 3 iron | 2 spare | deferred | — | 600s queue |
| Prepare: process_quarry_sample | 3 quarry_sample | 1 spare | deferred | — | 120s queue |
| Claim: process_roadside | — | — | 5 core_fragment | — | — |
| Claim: process_quarry_sample | — | — | 6 core_fragment | — | — |
| Cancel: any recipe | — | fuel refunded | — | inputs spent | — |

**Competing choices:**
- `process_roadside_materials`: 5 core_fragment, cost 2 fuel + 5 oak + 3 iron, 600s
- `process_quarry_sample`: 6 core_fragment, cost 1 fuel + 3 quarry_sample, 120s
  (requires quarry authorization + specimen reverse engineering)

**No unearned Core:** `quarry_core_fragment` only comes from processing recipes,
never from direct harvest or currency substitution.

---

## 9. Source→Paid Job→Collected Output Proof (2PID)

Process 1 writes receipt to `user://tests/a3_p1_receipt.json` with:
- `job_id`, `recipe`, `station`, `fuel_item`, `fuel_quantity`, `queue_seconds`,
  `outputs`, `transaction_key`, pre/post quantities

Process 2 verifies:
- Same `job_id` exists in SaveService mastery `a3_station_jobs`
- Pre-purchase inventory quantities match receipt
- Learned recipe persisted
- Claim once succeeds with correct output quantity
- Duplicate claim refused with `ALREADY_CLAIMED`
- Inventory unchanged after refused duplicate

---

## 10. Handoff to A0 / A6 / A7

### A0 (SaveService composition)
- Instantiate `A3EconomyService` once, call `configure(SaveService_autoload_node)`
- Do NOT create a second SaveService, wallet, or clock
- Do NOT edit `save_service.gd`
- All A3 state lives under `mastery.a3_*` keys — no schema migration needed
- Production time source: inject via `set_time_source()` with authoritative clock

### A6 (UI consumers)
- Call `get_projections()` for read-only source/recipe/discovery data
- `authenticated` field per source shows fail-closed status
- `learned` field per recipe shows research state
- No state mutation through projections

### A7 (product acceptance)
- R13 test suite is the mandatory CI gate
- Do not silence failures or report old suites as R13 success
- A0 + A7 control product acceptance on the exact composed tree
- Report `OWNER_NATIVE_PASS` only after native CI run URL and matching SHA
  are confirmed

---

## 11. Current Status

| Milestone | Status |
|-----------|--------|
| A3 source code complete | ✅ |
| R13 test suite (source-level fixed) | ✅ |
| Godot 4.7 CI workflow added | ✅ |
| True two-process test (P1/P2) | ✅ |
| Native CI run executed | ❌ (awaiting Godot 4.7 CI) |
| Run URL + SHA match confirmed | ❌ |
| A0 composition of A3 files | ❌ (pending A0 action) |
| Product acceptance (A0 + A7) | ❌ |

**Do not merge.** A0 composes at its own pace. A3 does not self-declare
production readiness.
