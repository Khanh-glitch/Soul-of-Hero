# R13-A3-VALUE Tri-Knowledge Research Model

**Owner:** A3 (Economy)
**Branch:** `arena/7a12b27e-soul-of-hero`
**Status:** DRAFT
**SaveService:** A0 single authority, all research mutations via `transact_once`

## Three Distinct Knowledge Mechanisms

The three mechanisms must not collapse into three UI buttons for the same free
unlock. Each has distinct costs, consumption patterns, and failure modes.

### 1. Bounded Random Spares Research

Spend `knowledge_spare` (Spares) to receive a random recipe from the bounded
pool of researchable recipes. Each roll consumes Spares; duplicates are
possible and not refunded. Not a free unlock.

- **Input:** `knowledge_spare` × N (N ≥ 1)
- **Output:** One recipe learned from the researchable pool
- **Cost:** Spares consumed regardless of outcome
- **Failure modes:** `INSUFFICIENT_SPARES`, `NO_RESEARCHABLE_RECIPES`,
  `TRANSACTION_REJECTED`
- **Atomic:** Spares consumption + recipe learning in one `transact_once`

### 2. Directed Research

Spend specific materials + Spares to learn a specific recipe. All inputs must
be available; the recipe must not already be known.

- **Input:** Recipe-specific inputs (e.g., `salvage_kit` requires
  `roadside_oak_scrap` × 3, `roadside_stone_chip` × 2, `knowledge_spare` × 1)
- **Output:** The targeted recipe learned
- **Cost:** All inputs consumed atomically
- **Failure modes:** `UNKNOWN_RECIPE`, `RECIPE_ALREADY_KNOWN`,
  `INSUFFICIENT_<ITEM_ID>`, `TRANSACTION_REJECTED`
- **Atomic:** Input consumption + recipe learning in one `transact_once`

### 3. Destructive Specimen Reverse Engineering

Consume a specimen item to learn its associated recipe. The specimen is
destroyed (consumed) on success. One specimen teaches exactly one recipe.

- **Input:** Specimen item (e.g., `quarry_sample` × 1 via
  `quarry_sample_specimen`)
- **Output:** The specimen's associated recipe learned
- **Cost:** The specimen is consumed/destroyed
- **Failure modes:** `UNKNOWN_SPECIMEN`, `SPECIMEN_TEACHES_NOTHING`,
  `RECIPE_ALREADY_KNOWN`, `INSUFFICIENT_<ITEM_ID>`, `TRANSACTION_REJECTED`
- **Atomic:** Specimen consumption + recipe learning in one `transact_once`

## Specimen Registry

| Specimen ID | Item consumed | Qty | Teaches recipe | Destroy on use |
|-------------|--------------|-----|---------------|----------------|
| `quarry_sample_specimen` | `quarry_sample` | 1 | `process_quarry_sample` | yes |

## Recipe Registry

| Recipe ID | Display name | Station | Fuel cost | Queue seconds | Knowledge mechanism | Inputs | Outputs |
|-----------|-------------|---------|-----------|---------------|---------------------|--------|---------|
| `salvage_kit` | Salvage Kit | salvage_station | 5 | 300 | directed | oak×3, stone×2, spare×1 | blueprint×1 |
| `process_roadside_materials` | Process Roadside Materials | salvage_station | 10 | 600 | directed | oak×5, iron×3 | account×10 |
| `process_quarry_sample` | Process Quarry Sample | salvage_station | (discovery-gated) | — | directed | sample-based | — |

## Run-Local Discoveries

Discoveries are run-local: they reset on run reset and are not persisted across
runs. Physical inventory changes (consumed materials, spent Spares) persist
through SaveService.

- `register_discovery(material_id, use_description, recipe_id)` — mark a
  previously low-value material as useful after a run-local discovery
- `lookup_use(material_id)` — returns `{use_description, recipe_id}` or empty
  dict if unknown
- `is_discovered(material_id)` — boolean check

## Reverse-Use Lookup

The player understands why a material became useful via `lookup_use()`. Example:

```
quarry_sample → "Unlocks process_quarry_sample recipe at salvage station"
                → recipe_id: "process_quarry_sample"
```

## Test Cases (tests/survival/a3_value_economy_test.gd)

| Test | What it proves |
|------|---------------|
| `bounded_random_research` | Spares consumed, random recipe learned, insufficient Spares rejected |
| `directed_research` | Specific inputs consumed, specific recipe learned, missing input rejected, unknown recipe rejected, already-known rejected |
| `destructive_specimen_reverse_engineering` | Specimen consumed (destroyed), recipe learned, insufficient specimen rejected, unknown specimen rejected |
| `already_known_recipe` | Re-learning same recipe rejected via `RECIPE_ALREADY_KNOWN` |
| `paid_station_preparation` | Fuel paid, inputs consumed, output granted, queue recorded |
| `insufficient_fuel` | Station prep rejected, no fuel paid (atomic) |
| `insufficient_materials_for_station` | Station prep rejected for missing inputs |

## Consumer Instructions

### A0 (SaveService)
- No changes required. Research mutations use `transact_once` with atomic
  mutators that consume inputs and record learned recipes.

### A6 (UI — read-only consumer)
- `get_projections()` returns recipe knowledge state (`learned` flag per
  recipe), discovery records, and source/sink projections.
- All projection data is read-only; no state mutation.

## Negative Evidence

| Case | Expected result |
|------|----------------|
| Bounded random with 0 Spares | `{ok: false, reason: "INSUFFICIENT_SPARES"}` |
| Directed research for unknown recipe | `{ok: false, reason: "UNKNOWN_RECIPE"}` |
| Directed research for known recipe | `{ok: false, reason: "RECIPE_ALREADY_KNOWN"}` |
| Directed research with missing input | `{ok: false, reason: "INSUFFICIENT_<ITEM_ID>"}` |
| Destructive specimen, unknown specimen | `{ok: false, reason: "UNKNOWN_SPECIMEN"}` |
| Destructive specimen, insufficient qty | `{ok: false, reason: "INSUFFICIENT_<ITEM_ID>"}` |
| Reverse-engineered specimen not consumed | FAIL — specimen must be destroyed on success |
