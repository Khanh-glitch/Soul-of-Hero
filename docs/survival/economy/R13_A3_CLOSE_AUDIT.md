# R13-A3 CLOSE — independent audit of the predecessor implementation

**Audited predecessor:** `b751a29f213d3c934caa204eb8d2d86943f07b65`
(`arena/7a12b27e-soul-of-hero`, PR #19)
**Audited CI:** `Survival A3 Economy Validation` run **41228370691** (R13 job FAIL),
`Godot 4.7 Runtime Validation` run **41228370661** (`original main baseline comparison` FAIL, unrelated)
**Takeover branch:** `arena/daadd745-soul-of-hero` (fast-forwarded onto the exact audited SHA;
the predecessor branch and PR were not reset, rebased or force-pushed)

This document is the audit of record. The predecessor's own adoption manifest was
treated as a **hypothesis**, not as certification.

## 1. What the predecessor actually shipped

| Feature | Predecessor claim | Verified state | Classification |
|---|---|---|---|
| R13 native suite runs | "R13 two-process CI added" | Import passes; script fails to load. Nine `var x := <Variant>` declarations (`test.gd:83,344,506,522,608,813,985,1066,1071`) are hard Godot 4.7 errors, so no assertion ever executed | **INCORRECT / UNTESTED** |
| Process 2 gate | "true two-process proof" | Step 2 read `$rc1` created in step 1. GitHub Actions steps do not share shell state, so the guard was always empty and Process 2 was skipped after Process 1 failed | **INCORRECT** |
| Station queue | `mastery.a3_station_jobs`, `a3_job_counter`, `queued_at_unix` | A second queue with its own job identity, its own escrow and its own maturity model, competing with the canonical V6/V7 `survival_economy.jobs` | **DUPLICATED** |
| Queue clock | `set_time_source(Callable) -> {"now": int}` and `Time.get_unix_time_from_system()` | A caller-supplied clock; canonical maturity is the A0 `soh.economy.active_tick.v1` receipt | **INCORRECT** |
| Learned recipes | `mastery.a3_learned_recipes` | Second knowledge store beside `survival.knowledge.recipes`; canonical `known()` never saw R13 research | **DUPLICATED** |
| Research mechanisms | bounded random / directed / destructive specimen | Re-implemented on top of the duplicate knowledge store; canonical `research_recipe()` already provides blueprint / specimen / targeted | **DUPLICATED** |
| Source authentication | `authenticate_source(source_id, owner_domain)` called "physical" | Only compared a caller-supplied string (`"A1" == contract.owner`). Any caller could mint entitlement. A well-written test asserts the wrong property | **INCORRECT (security)** |
| Source identity | `roadside_oak_1`, `roadside_stone_1`, `roadside_iron_1`, `quarry_deep_1` | None of these ids exist in any A1 binding (`world_source_bindings.v3.json` has five real bindings). Fabricated physical sources | **INCORRECT** |
| Quarry / A8 | "fail-closed, bare `A8` rejected" | Correct in intent: `a8_authorized == false` blocked it. But it also *simulated approval in a test* by flipping the contract flag, which proves nothing about A8 custody | **SOURCE_ONLY** |
| Items | 9 `.tres` items + `item_catalog.tres` | Present and consistent (`data/content/items`, 19 catalog entries) | **WORKING_NATIVE (catalog only)** |
| Two-process receipts | JSON receipt marker (`a3_p1_receipt.json`) | Written by P1, never verified by CI; Process 2 was never reached | **UNTESTED** |
| Transactional candidate inventory | wear + grant in one mutator; re-read candidate after each grant; full-bag → mutator false | Genuinely good engineering, preserved in the takeover (same pattern, now with A1 reward data and instance-tool wear) | **WORKING_NATIVE (pattern kept)** |
| V5–V7 canonical economy | `economy_service.gd`, offline/meta planners, adapter tests | Real, native-tested on the predecessor head (adapter + offline + meta + tool-use + 3 restart tests PASS) | **WORKING_NATIVE (preserved untouched)** |
| A0 composition | adoption manifest "zero migration, ready" | A7 R17 recorded `A3_SERVICE_REFUSED_BY_SCOPE`: the composed tree rejects seven A3 files and ships a 1789-line A0 vendored fork | **OUTSIDE_OWNER (A0)** |
| Balance / pacing models | Python progression/meta models | Run and passing on the catalog job; simulation only | **WORKING_NATIVE (simulation)** |
| Human playtest, Web playtest | not claimed | not run | **OUTSIDE_OWNER** |

## 2. Root cause of the nine CI errors

Godot 4.7 refuses `:=` when the right-hand side is `Variant` (`.call()`, `Dictionary.get()`,
`.duplicate()`, JSON parse). The expression is not a warning in practice — the script
fails to load, which is why the R13 job reported nothing except the parse failure.

The takeover therefore adds `tools/ci/gd_r13_static_check.py`, which fails the build
*before* the engine is started for:

* `:=` over a Variant-returning expression (typed constructors such as `String(...)`,
  `int(...)`, `bool(...)` are recognised as safe),
* duplicate `var` names inside one function (Godot 4.7 rejects nested re-declaration —
  this is exactly what stopped native attempt 41230653382),
* a re-introduced second A3 authority (`a3_station_jobs`, `set_time_source`,
  `a3_learned_recipes`, `a3_job_counter`, `owner_domain`),
* a two-process workflow step that reads a shell variable created by another step,
* a missing receipt-verification or static-gate step.

## 3. What the takeover changed

1. **One queue.** `a3_station_jobs`, `a3_job_counter`, `queued_at_unix` and
   `set_time_source` were deleted. `prepare_at_station` / `advance_station` /
   `claim_production` / `cancel_production` delegate to the canonical
   `enqueue` / `advance` / `collect` / `cancel`.
2. **One knowledge store.** Recipe knowledge is written only by canonical
   `research_recipe()` into `survival.knowledge.recipes`. The three mechanisms are
   blueprint (physical plan), specimen (destructive instance) and targeted
   (physical knowledge materials).
3. **One clock.** Queue maturity requires the A0 `soh.economy.active_tick.v1` receipt;
   an absent host fails closed (`time_host_unavailable`).
4. **Physical source identity, not owner strings.** Sources are the five pinned A1
   bindings. `authenticate_source(receipt)` accepts a
   `soh.economy.source_receipt.v1` dictionary only if it is field-for-field what the
   injected A0/A1 host returns right now, matches the pinned binding identity, stands
   on an A1-authored cell, is discovered, and (for the Quarry) matches an APPROVED A8
   verdict. Harvest additionally refuses a source that canonical `world_action`
   already settled.
5. **Quarry stays closed.** `A8_QUARRY_AUTHORIZATION_V4.json` is REJECTED; the service
   reads that document and its SHA. A fabricated `quarry_deep_1` is
   `UNKNOWN_SOURCE_BINDING`, not a source.
6. **Ordinary material vs Skill Core.** `quarry_core_fragment` is a stackable ordinary
   material produced by `process_roadside_materials` and consumed by
   `sort_core_fragments`. A Skill Core is an instance-backed `skill_core` with finite
   uses (`core_ember` etc.). `skill_core_distinction()` exposes the difference, and
   specimen research destroys the studied Core instead of duplicating it.
7. **Two competitive routes** with catalog-derived, measurable costs
   (`route_comparison()`): material route (bulk salvage → fragments → Core Blank) vs
   knowledge route (sparse notes/spares → research → consumables). Both are limited by
   finite A1 supply: three one-time bindings (`max_claims == 1`) and two renewable
   bindings with 300 s / 1800 s **active** cooldowns.
8. **Evidence instead of a claim.** Two independent Godot processes write JSON
   receipts; `tools/ci/verify_r13_receipts.py` is the CI oracle and checks distinct
   PIDs, the same durable save, the same A1 binding document, preparation expense,
   refusal before maturity, exactly one grant, duplicate refusal and conservation.

## 4. What remains outside this owner

| Item | Owner | State |
|---|---|---|
| Composition of the 29 A3 files into the product tree, replacement of the A0 vendored fork | A0 | requested in `A0_ADOPTION_CONTRACT_V2.json`; not granted |
| Real A8 Quarry instance, collision/reload proof, APPROVED authorization SHA | A8 + A1 | not supplied — Quarry stays closed |
| A1 source host callable in production (discovery, stand cell, active seconds) | A1 + A0 | contract defined; not mounted |
| A6 UI consumption of projections | A6 | read-only contract defined; not integrated |
| Balance/acceptance verdict on the composed tree | A7 | blocked on A0 |
| Human/browser playtest | user + A7 | not run |

No claim of product integration, visual gameplay, human acceptance or final balance is
made here, and `PRODUCT_COMPOSED_PASS` must not be written from this branch.

## 5. Final verification on the takeover branch

Exact-SHA run [41236254354](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41236254354)
on `ac148f877fffbc30ec66cbd5ac90cbb888717c31`:

* `A3 CATALOG / BALANCE CONTRACTS` — success
* `A3 NATIVE SAVE ADAPTER` — success (V5 adapter 566 checks / 27 cases, world
  restart, V6 offline + two-process settlement, V5 tool use, V7 meta +
  two-process deposits)
* `R13 A3 VALUE ECONOMY NATIVE (GODOT 4.7)` — success: static gate, real-engine
  import, process 1, process 2, two-process receipt verification and the
  single-process negative suite (`R13 NATIVE PASSED - 135 checks`).

Evidence details and the unresolved owner seams are in
[`R13_A3_CLOSE_HANDOFF.md`](R13_A3_CLOSE_HANDOFF.md). No product-composition,
balance, human-playtest or acceptance claim is made from this branch.
