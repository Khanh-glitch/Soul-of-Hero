# SURV-030A — A3 Economy Architect

Status: **implementation authored; catalog/balance contracts and native SaveService adapter CI pass; production integration and gameplay-design PASS NOT claimed.**

## What this slice owns

- Machine-readable economy catalogs: `data/survival/items/{items,sources,loot_tables,migration_map}.json`, `data/survival/recipes/{recipes,stations,research}.json` and JSON Schemas.
- Isolated runtime adapter: `game/survival/economy/economy_service.gd` (RefCounted, **not** an autoload, **not** a second save authority).
- Validation/simulation: `tools/survival/economy/{validate_economy,simulate_economy}.py`.
- Tests: `tests/survival/catalog/` (Python contract/balance tests + Godot adapter test against the real SaveService).
- CI: `.github/workflows/survival-a3-economy.yml`.

## What this slice does NOT own or claim

- No edits to A0 SaveService, SurvivalService/State, construction, production overworld, or existing SURV-010 catalog.
- No Gold skill/VFX port, no enemy/terrain effect changes, no invented native skill ids. A4 readiness is injected and fail-closed.
- No A1 world spawn/POI implementation. Proposed sources are explicitly `PROPOSED_A1` / `PROPOSED_WORLD`.
- No human playtest, no DPS/HP/travel-time balance claim, no offline production.

## Core architecture

`survival_economy` is an additive save namespace mutated inside one `SaveService.transact_once` together with inventory and `survival.knowledge.recipes`:

- `instances`: unique equipment/Core identity, condition, finite uses, revision, location (`bag` XOR escrow/consumed).
- `jobs`: queued/running/paused/ready/collected/cancelled production with ingredient/fuel/specimen escrow.
- `technologies`: permanent profile knowledge, separate from physical blueprints and known recipes.
- `commands`: payload-signature binding for idempotent event ids.
- `counter`: monotonic instance/job ids.

Unique items are qty-1 `key_item` stacks whose token id is `soh_i_%012d_<md5(kind)[0:8]>`. Attributes live in `survival_economy.instances`, never in stack metadata (SaveService sanitization strips unknown stack fields).

## Economic spine

`oak_wood / stone_chunk / iron_scrap / reed_fibre` → charcoal / ingot / steel / parts / cloth → station kits & tiers → knowledge spares / research notes → technologies → `charged_blank` (requires exploration-only `ancient_catalyst`) → Venom/Frost/Ember Cores → protection gear → deeper POIs.

- Roadside caches and specimen/sealed-archive loot are meaningful alongside dangerous POIs.
- Cultivation returns its own seed and consumes compost; it never creates rare catalysts or Cores.
- Salvage is strictly lossy. Core charges are never repaired; reconstruction consumes the old shell plus materials and creates a new instance.
- Research has three paths: physical blueprint, Core specimen sacrifice, or targeted knowledge spend. Duplicate research is refused without payment.

## Commands (local)

```bash
python -m pip install -r tools/survival/economy/requirements.txt
python tools/survival/economy/validate_economy.py --json docs/survival/economy/validation_report.json --index docs/survival/economy/reverse_index.json
python -m unittest discover -s tests/survival/catalog -p 'test_*.py' -v
python tools/survival/economy/simulate_economy.py --json docs/survival/economy/balance_report.json
# Native adapter (requires Godot 4.7):
godot --headless --path . --script res://tests/survival/catalog/economy_adapter_test.gd
```

## Acceptance status

| Gate | Status | Evidence |
|---|---|---|
| Schema/reference/accessibility/cycle audit | PASS (catalog contract feasibility) | `validation_report.json` |
| Python adversarial/balance tests | PASS | `tests/survival/catalog/test_economy_contracts.py` |
| Deterministic balance model | PASS for conservation invariants; **not** a playtest | `balance_report.json` |
| Native SaveService adapter | PASS (CI) | Godot 4.7 run [40868045642](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40868045642), PR run [40868053966](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40868053966) |
| A0 station/power/unique-token guard integration | PENDING | `migration_map.json` |
| A1 source/POI/risk integration | PENDING | `sources.json` proposed entries |
| A4 verified skill attestation | BLOCKED_PENDING_A4 | item `skill_readiness` |
| Gameplay-design PASS | NOT CLAIMED | requires human playtest + integrated world |

## Known unresolved risks

1. Generic SaveService drop/transfer/merge can violate unique-token invariants unless A0 routes or refuses `soh_i_*` tokens.
2. Station resolver is injected; production placement/power/condition/removal guards are A0-owned.
3. Balance model currently shows knowledge-spare pressure can delay Core manufacture under baseline yields; this is a tuning finding, not a fun claim.
4. Google Docs tab 04 sync is `DOCS_SYNC_PENDING` (connector disconnected).

## CI evidence

- Push run `40868045642`: `A3 CATALOG / BALANCE CONTRACTS` and `A3 NATIVE SAVE ADAPTER` both succeeded at `23d9cca8`.
- PR #19 run `40868053966`: A3 jobs succeeded. The unrelated `Original main baseline comparison` job in the repository-wide Godot workflow failed; it is not an A3 gate and does not alter the A3 adapter result.
- Native suite exercises the real SaveService autoload: fuel-gated smelting, station/knowledge/event identity, cancellation/full-bag/reload, specimen/blueprint/targeted research, technology prerequisites, A4-gated finite cast debit, repair/reconstruction identity, lossy salvage, legacy stack shapes, cultivation seed neutrality, and paused-job resume.
