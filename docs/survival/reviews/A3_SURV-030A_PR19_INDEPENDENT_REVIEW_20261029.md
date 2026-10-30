# A3 SURV-030A independent audit and six-agent dispatch, 2026-10-29

## Operational verdict
**KEEP SAME A3; CONTINUE_WITH_TARGETED_CORRECTIONS, PR #19 remains OPEN / NOT APPROVED FOR MERGE.** The authored standalone economy is a **credible, significantly implemented and native-tested technical milestone**, not yet production-safe or a verified full survival economy. No evidence merits replacing A3. Do not restart design or move A3 into A0's live construction code.

PR [#19](https://github.com/Khanh-glitch/Soul-of-Hero/pull/19) live `arena/7a12b27e-soul-of-hero` head `a579b3130652553e25bb2defa1de92a864c86ad7`, base `feature/survival-rpg-foundation-20261029`. 27 changed files. Exact [CI 40869212146](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40869212146) at **same SHA**: A3 CATALOG/BALANCE CONTRACTS and A3 NATIVE SAVE ADAPTER both SUCCESS. GitHub job logs actually inspected: 7 Python tests PASS; Godot 4.7 real SaveService adapter **178 assertions across 12 cases PASS**, import pass. These are **fixture-backed native engine tests**, not player world station placement, original 10 dungeons, actual Gold source parity, or human gameplay.

## What was inspected
Actual full `game/survival/economy/economy_service.gd` 609 lines; GDScript tests `tests/survival/catalog/economy_adapter_test.gd` 253 lines; Python tests, .github A3 workflow, recipes/items/capability schemas, A1 material mapping, migration proposals, validator/balance reports, and SaveService's `transact_once`, `get_inventory_stacks`, `add_items_to_candidate`, `remove_items_from_candidate`, `drop_inventory_item`, `_prepare_document` and root sanitization. Source original Atlas hash is tracked; no independent new player playthrough. Original 56 items / 36 recipes / 5 technologies / 36 sources / 7 stations catalog; no production recipe graph source claims beyond this.

**Strengths:**
- A3 is `RefCounted` adapter, not second SaveService/autoload; uses authoritative candidate transactions to debit inputs, queue work, output and Core instance state. Duplicate command IDs hash payload + SaveService receipt; known recipes and physical blueprint/specimen/technology separate.
- Escrow and all-or-nothing output collection via candidate trial, rejecting full inventory; native tests actually cover cancel/refund, reload, repeated collection, failed research, A4 fail-closed/no charge when unavailable, stale revision and finite Core charges, reconstruction/repair and stack migration.
- Explicit A1 mapping 27 material contracts **7 direct, 8 suggested aliases, 12 MISSING**, not surreptitiously rewriting A1; e.g. `frost_resin→frost_shard`, `venom_sac→venom_spine` are **not provenance-identical**. Existing `ancient_catalyst` ≠ A1 `aether_crystal`. No A1/SaveService/A4/overworld source touched.
- CI log 178 checks is meaningful scoped native evidence, not a blanket game system PASS.

## Review findings with actual code grounding

**E-01 / UNIQUE TOKEN OWNERSHIP IS NOT ENFORCED AT THE SHARED INVENTORY BOUNDARY — HOLD PRODUCTION INTEGRATION; coordinate A0.**
`EconomyService.grant_instance` creates `soh_i_...` tokens as `key_item` stack quantity 1, with detailed attributes in `survival_economy.instances`. `SaveService.drop_inventory_item` (source lines ~913-943) deletes an ordinary stack without consulting `survival_economy.instances`, leaving a persistent instance that thinks location="bag" while physical token is absent. Also shared `add_items_to_candidate` can combine equivalent token IDs into an ordinary quantity>1 stack if called with id again; `EconomyService.commit_cast` at lines 577-597 checks `item_stacks.has(instance_id)`, not **quantity exactly 1 and verified kind=key_item**. `owned_instances` at lines 107-117 similarly checks presence but not quantity. `inventory_totals` detects quantity!=1 but merely skips, and isn't a gate for commit_cast. Thus unique-token invariants are **not globally protected**; current isolated tests do not cover generic SaveService drop/transfer/merge paths. This is a **source-demonstrated risk**, not a confirmed user-reproduced duplication or already shipped economy regression. A0 owns SaveService generic routing/refusal; A3 can add candidate-side fail-closed validation and adversarial tests in owned files; make a clear A0 contract requiring token quantity exactly 1, drop intent with ownership transfer, no orphan or dupe, original homes/stash/overworld loot compatibility.

**E-02 / TICK AUTHORITY — HOLD WORLD STATION TICK WIRING.**
`EconomyService.advance(station_id, ticks, event_id)` accepts arbitrary supplied ticks 0..3600 and will advance queued production by that amount without a built-in proof of elapsed actual active session time. Native test intentionally calls `advance(...,1000,...)` to fast-forward. On its own, isolated method can be called repeatedly with new event IDs to finish recipes immediately if the eventual host isn't authoritative. Not a flaw in deterministic fixture design, but **unverified trust boundary** for any gameplay integration. Demand A0-authorized fixed-step time receipt, bounded cumulative progression tied to session/station ID, pause-on-power-off and reload, atomic station/job validation, no offline progress unless user decides to allow it. A3 should document exact host protocol and add double-tick/replay/changed-station negative tests; do not invent realtime or server verification.

**E-03 / SKILL GATE ATTESTATION IS A CONTRACT, NOT ACTUAL GOLD VERIFICATION.**
`commit_cast` checks ready + matching `abstract_skill_id` from **caller-supplied Callable**. In native test the positive gate is a local synthetic `{"ready":true,"abstract_skill_id":id}`. No Gold original source/tick-by-tick enemy/terrain FX proof is imported to the A3 module. Integration must obtain A4's independently verified source/skill/version attestation, context-bound cast ID and action commit semantics; do NOT equate a fabricated ready Dict to a real skill or debit before cast authority. Current fail-closed default without gate is good. A3 cannot create faux Gold attestations; define strict versioned interface and negative tests for wrong ID, wrong version, unverified, replay, stale state.

**E-04 / A1 ↔ A3 ECONOMY SEMANTICS OPEN.**
Of A1's 27 world material keys, 7 direct mapping, 8 proposed aliases, 12 have NO A3 item. `frost_resin` not `frost_shard`, `venom_sac` not `venom_spine`, `peat` not `coal` by default; alias is **SOH adaptation proposal** only. A1 World PR #20 authored, not native. A3 must keep MISSING explicit, cooperate with A1 to approve/split only a causally justified minimal set and avoid adding 12 items blindly. A0 will spawn resources by stable IDs in later world integration; A6 uses read-only placeholders for missing. No current A3 bug from absent world items if source is labeled.

**E-05 / STATION REMOVAL AND SAVE MIGRATION — A0-OWNED INTEGRATION GATE.**
`_station` receives a callable fixture resolver; source does not prove a production `SurvivalStructure`/power/breakage lifecycle. There is no A0 rule yet forbidding removal of a station with queued/paused/uncollected jobs; material escrow can become unrecoverable if station/locator disappears without recovery. Additional `survival_economy` namespace persistence was exercised in actual SaveService tests, but a full legacy migration/host cross-branch merge and invalid-instance/schema crash test remain separate. A0 must reconcile with latest SURV-020 topology/door/roof/bed and keep constructing until that task is complete.

**E-06 / Secondary quality cases for targeted follow-up.**
`EconomyService._new_instance(..., quantity:=1)` does not use quantity, and `_finish_job` creates a single instance for each unique output key; current recipes examined produce unique Core outputs with quantity=1 so **not an observed catalog failure**, but flag/reject future qty>1 rather than silently underproduce. Command history `survival_economy.commands` plus `applied_transactions` grows with events; measure 14-day production save-size/perf and define explicit retention strategy if significant. `_station` resolver validity and `advance` queue fairness should be tested on mixed station kinds, power toggles, cancel/resume and collect.

## Gate matrix
| Dimension | Result |
|---|---|
| Source/code delivered | VERIFIED: PR19 actual 27 files |
| CI exact SHA | PASS 40869212146 |
| Godot SaveService adapter | PASS scoped: 178 assertions/12 cases |
| Python catalog / simulation | PASS scoped: 7 tests and contract audit |
| Additional independent negative reproductions | NOT RUN this review; source-based E-01/E-02 risks |
| Production station/power/world spawning | NOT DONE, A0 owns |
| A1 source material correspondence | PARTIAL, explicit 8 aliases + 12 missing |
| Physical token across all SaveService APIs | NOT APPROVED, E-01 |
| A4 exact skill attestation and Gold parity | NOT DONE |
| A6 UX in production / player gameplay value | NOT DONE |
| PR19 merge readiness | HOLD pending E-01/E-02 safe contract/tests and independent review |
| Agent replacement | NOT WARRANTED |

## Exact next owner decisions
- **A3 SAME AGENT:** Continue with focused E-01/E-02/E-03 hardening in its isolated source/test paths; add negative tests for unique-token stack quantity corruption and generic APIs, event identity conflicts, one trustworthy tick host example / fail-closed, producer skill attestation version, cancellation/bed/reload and all-or-nothing outputs. Sync mapping decision proposals to A1 without self-approving aliases. No permission to change SaveService or A4 native FX. Push corrections to PR19 with native run + docs and request **authored economy/adapter milestone** review only.
- **A0:** Receive **contract request, not immediate diversion** from SURV-020 roof/bed. Before integrating A3 Economy: guard generic drop/transfer/merge for `soh_i_*`, station removal/capacity/power/time resolver, preserve additive namespace and test saves+legacy. Do not edit A3 independently before their PR review. Continue roof/bed critical path now.
- **A1:** Review 8 proposed aliases & 12 missing; only approve with provenance/biome/research contract. Protect build authority W-01 from previous A1/A0 audit. **A4:** Only supply validated source-backed skill/version contract after successful Gold differential; no unverified skill casting. **A6:** Consume A3 catalogs and Core charges as read-only fixture/contract; no local SaveService write.
- **Coordinator:** Do not merge PR19 based solely on green CI; independent test/merge with latest A0 foundation and early actual Godot-world station sequence later. Update Control Tower / Google Docs. Next feedback from A3 should be evaluated against E-01/E-02, not simply more recipes/POIs.
