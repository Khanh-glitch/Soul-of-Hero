# R13-A3-VALUE Source Contracts — Roadside & Quarry

**Owner:** A3 (Economy)
**Branch:** `arena/7a12b27e-soul-of-hero`
**Status:** DRAFT — fail-closed by default
**SaveService:** A0 single authority (`LivingArsenalSaveService`), no parallel ledger

## Source Identities

All source identities are explicit, finite, and fail-closed. An unauthenticated
source ID yields nothing and never grants inventory. A1 authenticates roadside
sources; A8 authenticates Quarry sources. A3 only enforces the allowlist.

### Roadside sources (A1 — safe, lawful, low-risk)

| Source ID | Display name | Owner | Max yields | Base yield per harvest | Spare chance | Tool required | Tool wear/use | Risk | Availability |
|-----------|-------------|-------|-----------|----------------------|-------------|---------------|---------------|------|-------------|
| `roadside_oak_1` | Roadside Oak Outcrop | A1 | 3 | 1× `roadside_oak_scrap` | 33% | `stone_pick` | 25 | low | always |
| `roadside_stone_1` | Roadside Stone Outcrop | A1 | 3 | 1× `roadside_stone_chip` | 33% | `stone_pick` | 25 | low | always |
| `roadside_iron_1` | Roadside Iron Deposit | A1 | 2 | 1× `roadside_iron_scrap` | 25% | `iron_pick` | 10 | low | always |

### Quarry sources (A8 — expedition, high-risk, finite)

| Source ID | Display name | Owner | Max yields | Base yield per harvest | Core chance | Tool required | Tool wear/use | Risk | Availability |
|-----------|-------------|-------|-----------|----------------------|-------------|---------------|---------------|------|-------------|
| `quarry_deep_1` | Deep Quarry Face | A8 | 5 | 2× `quarry_sample` | 20% | `iron_pick` | 10 | high | expedition_only |

## Fail-Closed Behavior

- `is_source_authenticated(source_id)` returns `false` for any source not
  authenticated by its owner domain (A1 for roadside, A8 for Quarry).
- `harvest(source_id, tool_id)` returns `{ok: false, reason: "SOURCE_NOT_AUTHENTICATED"}`
  for unauthenticated sources — no inventory is granted.
- `harvest()` returns `{ok: false, reason: "UNKNOWN_SOURCE"}` for source IDs not
  in the contract registry.
- Wrong-owner authentication is rejected: A8 cannot authenticate A1 roadside
  sources; A1 cannot authenticate A8 Quarry sources.

## Finite Yields & Idempotency

Each source has `max_yields`. Harvest count is derived from SaveService
`applied_transactions` keys (`harvest:<source_id>:<index>`). Once `max_yields`
harvests are committed, further harvests return `{ok: false, reason:
"SOURCE_EXHAUSTED"}`. Duplicate transaction keys are rejected by SaveService
idempotency — a harvest cannot yield twice for the same transaction.

## Tool Wear

Each source requires a specific tool. Tool condition degrades by
`tool_wear_per_use` per harvest. At condition 0, the tool is broken and all
harvests return `{ok: false, reason: "TOOL_BROKEN"}`. Tool wear and yield grant
commit atomically in one `SaveService.transact_once` — a rejected harvest wears
no tool and grants no yield.

## Inventory Capacity

Harvest pre-checks bag capacity (30 shared slots). If adding the expected new
stacks would exceed capacity, the harvest returns `{ok: false, reason:
"INVENTORY_FULL"}` before any mutation. `_grant_to_candidate` enforces the same
limit inside the transaction — double protection.

## Item Definitions (data/content/items/)

| Item ID | Display name | Kind | Rarity | Stack cap | Source |
|---------|-------------|------|--------|-----------|--------|
| `roadside_oak_scrap` | Voi Giai Dan | material | normal | 50 | roadside_oak_1 |
| `roadside_stone_chip` | Vai Doc Bien | material | normal | 50 | roadside_stone_1 |
| `roadside_iron_scrap` | Sat Luoi Bien | material | normal | 50 | roadside_iron_1 |
| `knowledge_spare` | Phu Kien Tri Thuc | consumable | normal | 50 | roadside (chance) |
| `quarry_sample` | Mau Khoang San | material | normal | 50 | quarry_deep_1 |
| `quarry_core_fragment` | Parc Viet To Khoang San | material | rare | 50 | quarry_deep_1 (chance) |
| `salvage_kit_blueprint` | Bao Thiet Ke Bo Cuu Thu | blueprint | normal | 50 | research output |

## Consumer Instructions

### A0 (SaveService)
- No changes required. A3 uses existing `transact_once`, `grant_inventory_item`,
  `consume_inventory_item`, `is_transaction_applied`, `get_snapshot`.
- A0 remains the single SaveService mutator/composer.

### A1 (World/POI)
- Authenticate roadside sources at mount time:
  `eco.authenticate_source("roadside_oak_1", "A1")`
- Source IDs must match the contract registry exactly. Do not invent new source
  IDs without updating `roadside_source.gd` and `a3_economy_service.gd`.

### A8 (POI scenes)
- Authenticate Quarry sources at mount time:
  `eco.authenticate_source("quarry_deep_1", "A8")`
- Quarry sites are expedition-only availability; do not place in safe zones.

### A6 (UI — read-only consumer)
- Use `eco.get_projections()` for read-only source/sink and technology
  projections. No state mutation.
- Projections include: source authentication status, yields remaining, recipe
  knowledge state, fuel costs, queue times, discovered materials.

## Negative Evidence (Fail-Closed)

| Case | Expected result |
|------|----------------|
| Unknown source ID | `{ok: false, reason: "UNKNOWN_SOURCE"}` |
| Unauthenticated source | `{ok: false, reason: "SOURCE_NOT_AUTHENTICATED"}` |
| Wrong owner domain authenticates | `false` |
| Broken tool (condition 0) | `{ok: false, reason: "TOOL_BROKEN"}` |
| Unknown tool | `{ok: false, reason: "UNKNOWN_TOOL"}` |
| Source exhausted (max_yields reached) | `{ok: false, reason: "SOURCE_EXHAUSTED"}` |
| Full inventory (30/30 stacks) | `{ok: false, reason: "INVENTORY_FULL"}` |
| Duplicate transaction key | Rejected by SaveService idempotency |
