# A3 Product-Facing Economy Progression / Balance Audit — V2

Status: **SIMULATION_ONLY_SOH_DESIGN_PROPOSAL / NOT_HUMAN_PLAYTESTED / WORLD_NOT_INTEGRATED**  
PR #19, branch `arena/7a12b27e-soul-of-hero`. Prior CI-green checkpoint `08711ea7fdf887f8cb0b4df2c352220d9dbc4a78`; hardening code `17e0358b` and native adapter **362 checks / 20 cases** preserved. V2 refreshes A1 source to PR #20 head `91a3544983ff2712e66fd77997df24f59efb3a44`.

## 1. Separate from the immutable technical conservation fixture

`tools/survival/economy/simulate_economy.py` and `docs/survival/economy/balance_report.json` remain byte-identical. Their 14-session baseline produces **156 found Core specimens, 0 manufactured Cores, 0 finite-cast uses**. That is a conservation/save-growth stress fixture, **not** a realistic player journey.

Preserved fixture SHA-256:
- `simulate_economy.py`: `1528ec792d690b998f9d1b40fd1a5a8ec6e7469ebdd32e06d4741eaacb6c106f`
- `balance_report.json`: `45bceb2d6f9e190c9fd89b540cc11d088d98ebb6efcef36bb0f977cadc437e71`

The product model is `tools/survival/economy/model_progression.py`, data `data/survival/recipes/progression_model.json`, report `docs/survival/economy/progression_report.json`. It does not execute Gold casts, edit SaveService, or approve A1 aliases.

## 2. A1 source reconciliation (V2)

Read-only A1 PR #20 files are hash-pinned in `progression_model.json.source_refs`. Adoption contract: `data/survival/items/a1_source_adoption.v2.json`.

- **Adopted source-specific only**: `src_crown_reed → reed_fibre`; `src_amber_herb → moonleaf` (conditional sink verified: `minor_salve` + filter lesson proposal).
- **Rejected global aliases** remain blocked: `frost_resin`, `venom_sac`, `peat`, `hardwood`, `bog_iron`, `glacial_iron`, `fibre`, `rare_herb`. In particular `frost_resin != frost_shard`, `venom_sac != venom_spine`, `peat != coal`.
- **Proposed not catalogged**: frost_resin, venom_sac, peat, bog_iron, glacial_iron, dry_fibre, karst_herb, hardwood.
- **Missing items explicit**: copper, rubber_sap, limestone, honey, salt, pearl, silica_sand, storm_glass, obsidian, basalt, abyssal_pearl, aether_crystal. None first-hour blocking.
- **First hour reconciled**: Refuge → Ashen Waystation (locker/ledger) → Crown Relay Shed (hand-crank) → Refuge → Orchard Apothecary (filter lesson). The V1 provisional `early_roadside_salvage` bootstrap is superseded and not used.
- **Route truth**: `rt_crown_safe_approach` zero exposure; `rt_east_seam` requires `cap_filter`. Unprepared rush is `shortcut_locked`, not an invented permission or silent unmitigated crossing.
- **Hazard access ≠ mitigation**: `cap_filter`/`cap_thermal` are preparation/access grammar. A3 proposes 0.6 mitigation fraction from A1 hazard contract, not full immunity; `toxin_mask venom:60` is not heat/acid_gas/poison coverage. Concrete gear/resistance remains an A3 extension gap.

## 3. Model rules and explicit proposals

- Finite inventory: 30 bag slots; stack limits from A3 items; unique tokens occupy one slot. Home starts with one 12-slot chest; extra chests cost A0 `chest_wood`.
- Shelter cost derived from actual A0 pieces: **36 oak_wood + 2 iron_scrap**.
- Active production: 1 tick = 1 second is a **SOH proposal**. Jobs progress only during active session time; no offline catch-up. Queue capacities from `stations.json`.
- Capability grants: novice caps come from explicit A1 world actions with real costs/rewards, not free craft/source grants. Late caps remain blocked while A1 materials are missing/unresolved.
- Rarity: Ember/Frost/Venom specimens are one-time authored POI discoveries. `ancient_catalyst` is a one-time vault proposal (70% discovery chance), not a historical drop rate.
- Core choice: USE is loadout allocation only (`native_casts_executed=0`); STORE preserves the physical instance; SACRIFICE consumes it for permanent recipe knowledge. Manufacture requires learned recipe, advanced workbench, charged_blank, catalyst and family reagents.
- RNG streams are separated (death/loot/rare) so adding a gather/craft action does not silently reroll unrelated outcomes. Baseline seed recalibrated to 31 after A1 first-hour actions changed RNG consumption; adversity scenarios retain explicit bad-luck seeds.

## 4. Baseline 14 × 45-minute journey (sparse scenario model)

First milestones: novice caps session 1; home session 3; Ember discovery session 3; Frost discovery session 5; Core Binding tech session 5; Ember sacrifice session 8; Ember manufacture session 9. Manufactured Ember creates **8 finite uses in the model**, but **0 native Gold casts**.

| Session | Active s | Station work s | Unused s | Cores |
|---:|---:|---:|---:|---:|
| 1 | 2651 | 26 | 49 | 0 |
| 2 | 2660 | 0 | 40 | 0 |
| 3 | 2700 | 128 | 0 | 1 |
| 4 | 2700 | 142 | 0 | 1 |
| 5 | 2700 | 302 | 0 | 2 |
| 6 | 2445 | 170 | 255 | 2 |
| 7 | 1913 | 104 | 787 | 2 |
| 8 | 1654 | 64 | 1046 | 2 |
| 9 | 1237 | 66 | 1463 | 3 |
| 10 | 1019 | 0 | 1681 | 3 |
| 11 | 411 | 0 | 2289 | 3 |
| 12 | 411 | 0 | 2289 | 3 |
| 13 | 411 | 0 | 2289 | 3 |
| 14 | 411 | 0 | 2289 | 3 |

**Time audit:** scheduled budget 37,800 s; active modeled 23,323 s; unused 14,477 s; station work 1,002 s (overlaps active). Categories: travel 7,167 s; exploration/interaction 13,830 s; gathering 1,201 s; crafting handling 162 s; research handling 17 s; construction 192 s; station wait 754 s. Combat duration and human read/plan/decide time are **0 s modeled / unmodeled**, not claimed as zero real time. Late sessions are explicitly sparse; unused budget is **not** engagement and is not padded.

Required native/human evidence: A0 station queue + active-time receipts; A0/A1 combat/retreat durations; A1 POI traversal/puzzle timings; A3/A0 gather cooldown/yield; A6 human decision/inventory friction; human 45-minute session observation.

## 5. USE / STORE / SACRIFICE and manufacturing

Baseline decision: session 8 SACRIFICE Ember specimen → permanent `craft_core_ember`; session 9 manufacture one Ember Core (8 finite uses). Frost is stored; Frost/Venom manufacture remain blocked by unresolved reagents.

- `use_now`: field-use candidates; no sacrifice; no manufactured Ember; no Gold effect claimed.
- `store_all`: stored specimens; no sacrifice; no manufactured Ember.
- `research_first`: sacrifices first eligible specimen; manufactured Ember session 9.
- Fair USE vs SACRIFICE comparison is **not yet fair**. Missing: A4-verified USE effect/uses/condition/risk delta; atomic sacrifice confirmation; manufacture cost/catalyst availability; time-to-replacement; encounter outcomes with/without USE; human valuation.

## 6. Sensitivity / adversity scenarios (15)

| Scenario | Ember disc. | Frost disc. | Ember manuf. | Deaths | Active s | Unused s | Technical |
|---|---:|---:|---:|---:|---:|---:|---|
| baseline | 3 | 5 | 9 | 0 | 23323 | 14477 | PASS |
| poor_loot | 5 | 7 | — | 1 | 32924 | 4876 | PASS |
| lost_specimen | 3 | 5 | 9 | 1 | 23323 | 14477 | PASS |
| material_shortage | 3 | — | — | 0 | 19637 | 18163 | PASS |
| failed_expeditions | 3 | 5 | 10 | 2 | 26284 | 11516 | PASS |
| limited_playtime | 12 | — | — | 0 | 16687 | 113 | PASS |
| use_now | 3 | 5 | — | 0 | 23254 | 14546 | PASS |
| research_first | 3 | 5 | 9 | 0 | 23323 | 14477 | PASS |
| store_all | 3 | 5 | — | 0 | 23254 | 14546 | PASS |
| rush_east_unprepared | 3 | — | — | 2 | 10672 | 128 | PASS |
| early_loss_no_fallback | 3 | 5 | — | 4 | 24755 | 13045 | PASS |
| early_loss_targeted_fallback | 3 | 5 | — | 4 | 24758 | 13042 | PASS |
| safe_route_blocked | 3 | 5 | 9 | 0 | 23668 | 14132 | PASS |
| catalyst_drought | 3 | 5 | — | 1 | 27642 | 10158 | PASS |
| queue_interruption | 3 | 6 | — | 2 | 27497 | 10303 | PASS |

Interpretation: poor loot/limited playtime delay milestones; shortage/drought/queue interruption block manufacture; early loss removes the physical Core while knowledge/home persist; targeted fallback costs 6 spares + 2 notes and does **not** restore the physical Core; blocked safe route forces a longer path; unprepared east rush is locked. These are deterministic sensitivity probes, not probability forecasts or human outcomes.

## 7. Remaining late-game goals

Five late goals remain (tide customs, karst dive, fen purification, storm signal, canopy lift), gated by missing/unresolved materials and capabilities. They are authored destinations, **not proven 14-day engagement**.

## 8. Owner-ready handoffs

- A0 producer: `A0_ECONOMY_PRODUCER_CONTRACT.v2.json` (+ existing SaveService guard / active-tick host contracts).
- A6 read-only consumer: `A6_ECONOMY_READ_ONLY_CONTRACT.v2.json`.
- Summary / asks: `OWNER_HANDOFFS_V2.md`.
- UI flags never authorize transactions. SaveService remains sole inventory authority. Physical Core vs permanent recipe, uses/condition/equipment/readiness, station queue + authoritative active time, and atomic sacrifice confirmation are specified.

## 9. Reproduction and tests

```bash
python tools/survival/economy/validate_economy.py --json docs/survival/economy/validation_report.json
python tools/survival/economy/model_progression.py --json docs/survival/economy/progression_report.json
python -m unittest discover -s tests/survival/catalog -p 'test_*.py' -v
```

- Python: **30 tests PASS** (10 preserved hardening/catalog + 11 V1 progression + 9 V2 regressions). One V1 assertion updated to A1 PR #20 truth: unprepared east rush is `shortcut_locked`, not `abort_unprepared_hazard`.
- Native adapter: **362 checks / 20 cases PASS** (unchanged).
- Immutable `balance_report.json` unchanged.
- V2 code SHA / CI: pending final commit; prior checkpoint `08711ea7` was CI-green (push 40888589145, PR 40888602324).

## 10. Next integration boundary

1. A1: approve/reject source-specific adoptions, missing-item additions, specimen/catalyst bindings, native POI action state/renewal.
2. A0: generic SaveService token guards, production station/time host, home placement, death/respawn, hazard damage; merged native review.
3. A4: real Gold skill verification and authoritative cast commit; only then can USE become a verified tactical action.
4. A6: read-only snapshots, sacrifice confirmation, provenance labels, human decision-clarity playtest.
5. Human playtest: measure fun, rarity excitement, pacing, fatigue, and voluntary continuation.

**NEXT_ATOMIC_ACTION:** Control Tower / A0 / A1 / A6 review of V2 adoption + producer/consumer contracts; do not merge PR #19 or claim gameplay balance approval from simulation alone.
