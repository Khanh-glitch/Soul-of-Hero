# A7 · R14 — cross-system player-capability certification

_2026-10-31, revision 3. Independent QA. This report **does not** merge, does not edit an owner's
gameplay file, does not grant in-game rewards and does not claim a human playtest._

**Headline: `FAIL` · maturity `TEST_HARNESS_VALID` · composition `f6d5cf789995` ·
32 cases — PASS 5 · FAIL 5 · BLOCKED 17 · NOT_IMPLEMENTED 5.**

Two independent defects stop Track 1, and they were hiding behind each other:

1. **Composition (A0 metadata).** `tools/a0/ownership.json:82` declares an `a0_resolution` that
   copies `tools/a0/merges/chapter1_overworld.gd.merged` (1366 lines) over A0's own committed
   controller (1642 lines). The composed product therefore runs the **legacy `384×256` sidecar**,
   measured in the engine, not inferred: `A7C AUTHORITY live_source=legacy_sidecar`,
   `controller_runnable=true`, `runtime_authority_verified=false`.
2. **Native (A0 source).** `game/survival/a0_world_authority.gd:157` calls `_spawn_cell()`, which
   does not exist (the class defines `spawn_cell()` at `:265`). The script **loads but cannot be
   instantiated**: `A7C NATIVE_LOAD {"authority_loads":true,"authority_can_instantiate":false}`.
   So even with the resolution dropped — the reconciled control — the authored world still does not
   run: `controller_mode: "authored"`, `live_frame: [0,0]`, `live_source:
   UNRESOLVED_AUTHORITY_NOT_RUNNABLE`.

`SOURCE_AUTHORITY_PRESENT` and `RUNTIME_AUTHORITY_VERIFIED` are different sentences. This revision
of the report keeps them apart, and the harness now refuses to promote a tree that the engine cannot
run.

**Correction record (this round, in order).**

| revision | claim | why it was wrong |
|---|---|---|
| 1 | `SIDECAR_WORLD`, A0 source defect | the probe called `data/overworld/hollow_marches.json` "the live world" without asking the controller which world it mounts |
| 2 | "the control proves A0's authored world works; only the resolution is at fault" | the probe scanned controller **text** and never loaded it. Godot was printing `SCRIPT ERROR: Function "_spawn_cell()" not found in base self.` and `Failed to compile depended scripts` while `A7C AUTHORITY` reported `authored 1024×768` and the run ended `A7C_DONE` |
| 3 (this) | source presence ≠ running product; `COMPOSITION_DROPS_OWNER_WORK` stands, and a second native defect is named | — |

---

## 0. What is new, what is not, what is not claimed

| | |
|---|---|
| **New** | harness `tools/survival/balance/a7_certify.py` (32 cases, four tracks); A7-owned Godot 4.7 probe `tests/survival/a7_certification_probe.gd`; CI workflow with a **reconciled control tree** and **engine-native verification**; 67 adversarial self-test controls; committed evidence and machine report |
| **Not new** | the six R13 static oracles and their correction; any owner's code |
| **Not claimed** | human acceptance, E2, "fun", a product PASS, or any capability without a runtime receipt |

## 1. The pipeline, and what a verdict means

```
source  →  contract  →  runtime  →  receipt  →  player outcome
```

A case stops at its first non-`VALID` stage, so `PASS` at `source` means *the symbol exists*, not
that a player did anything. Maturity levels never collapse into one another:

| level | meaning | status |
|---|---|---|
| `TEST_HARNESS_VALID` | the harness rejects every known-bad control | **reached** — 67/67, CI-asserted |
| `OWNER_SOURCE_VALID` | all source stages valid, none failing | **not reached** |
| `PRODUCT_COMPOSED` | runtime + receipt + outcome on the exact tree | **not reached** |
| `HUMAN_ACCEPTED` | a human played it | **never granted by this program** |

New in revision 3 — three verdict rules, each because a real wrong answer was produced:

* **Text is not a program.** `T1.7` requires the controller and the authority to `load()`,
  `can_instantiate()` and `new()` in Godot 4.7. Engine errors (`SCRIPT ERROR`, `Parse Error`,
  `Compile Error`, `Failed to load script`) are captured per tree into `composed.native.txt` and
  `control.native.txt`; any of them blocks promotion.
* **Unknown is `BLOCKED`.** When the engine cannot resolve which world is live, `T1.3`/`T1.4` report
  `null` and the harness refuses to convert that into PASS *or* FAIL.
* **An environment failure is not an owner's fault.** If scripts load and can instantiate but
  `new()` fails, the code is `BLOCKED_INSTANTIATION_ERROR`, not a defect.

## 2. Baseline identity

| step | result |
|---|---|
| owner pins | A0 `a6e37978` · A1 `e1e4e9a4` · A3 `80fe8cec` · A6 `816cc22a` · A8 `5bf5c8f9` |
| composition | `tools/a0/compose_owners.py`, `conflicts=0 unresolved=0`; 314 / 22 / 117 / 67 files copied |
| tree | **`f6d5cf789995ccd775cfab9b2f3c98a7ecc667b0`**, recomputed by the harness (`git write-tree`) on every run |
| engine | Godot **4.7-stable (official)**, reported from inside each tree |

**Source presence versus runtime truth** — the table this round exists to produce:

| | certified composition | reconciled control |
|---|---|---|
| controller file | 1366 lines, `818cfe61…` (A0's declared merge artifact) | 1642 lines, `53f3dac2…` (A0's committed file) |
| controller loads / instantiates | **true / true** | **true / true** |
| controller's own mode resolver | `""` (the artifact has no authority resolver) | **`"authored"`** |
| mounts `A0WorldAuthority` (source) | false | **true** |
| `a0_world_authority.gd` loads | true | true |
| `a0_world_authority.gd` **can instantiate** | **false** | **false** |
| `runtime_authority_verified` | false | **false** |
| engine-resolved live world | `legacy_sidecar`, `384×256` | `UNRESOLVED_AUTHORITY_NOT_RUNNABLE`, `[0,0]` |
| engine errors logged | 3 | 4 |

`a0_world_authority.gd` SHA-256 `cc823725…` in both trees. The authority never runs in either.

## 3. Results by track

### Track 1 — world, player, geography — **FAIL**

| case | verdict | code | owner | evidence |
|---|---|---|---|---|
| T1.1 composition identity | **PASS** | `COMPOSITION_IDENTITY` | A7 | declared tree reproduces byte for byte |
| T1.2 one authoritative world | **FAIL** | `COMPOSITION_DROPS_OWNER_WORK` | **A0 (metadata)** | composed controller lacks `A0WorldAuthority` while A0's committed controller mounts it; the declared resolution substitutes a 1366-line artifact for a 1642-line file |
| T1.3 spawn | **FAIL** | `SPAWN_OUTSIDE_LIVE_WORLD` | **A0 (composition)** | spawn `(389,291)` `standable=true` but outside the engine-measured live world `384×256`; the control reports `in_live_world=null`, so the control is **not** quoted as a working world |
| T1.4 POI approaches | **FAIL** | `SITE_OUTSIDE_LIVE_WORLD` | **A0 (composition)** | 3/3 A8 cells outside `(384,256)`, measured in the engine |
| T1.5 input bootstrap | **PASS** | `INPUT_BOOTSTRAP_INDEPENDENT` | A7 | reader `ok=true` before *and* after the bootstrap: a two-sided control, so the round-12 input refusal is not A1's fault |
| T1.6 movement/collision | **BLOCKED** | `BLOCKED_NO_MOVEMENT_RUN` | A0 | no walked player with collision on this tree |
| **T1.7 native authority** | **FAIL** | `AUTHORITY_SCRIPT_DOES_NOT_RUN` | **A0 (source)** | `a0_world_authority.gd` loads but cannot instantiate: `Function "_spawn_cell()" not found in base self.` at `:157`; `spawn_cell()` is defined at `:265` |

### Track 2 — discovery, preparation, revisiting — **BLOCKED**

| case | verdict | code | owner | evidence |
|---|---|---|---|---|
| T2.1 site scenes | BLOCKED | `BLOCKED_NO_ENTRY_RUN` | A8 | three scenes resolve; nothing enters them; package `…NOT_MOUNTED` |
| T2.2 route | BLOCKED | `BLOCKED_NO_ROUTE_RUN` | A0 | a teleport is rejected as a route by construction |
| T2.3 knife-first | **BLOCKED** | `BLOCKED_NO_MELEE_RUN` | A3 | 57 item ids, none knife-like; **but** the starting melee is a different subsystem (`knight.gd:220 weapon_manager`, 5 equipment ids incl. 3 tools) and no combat run exists — so "no knife" is a catalog gap, **not** "melee is unplayable" |
| T2.4 earned capability | BLOCKED | `BLOCKED_NO_EARNED_EVIDENCE` | A7 | no run declares `fixture_grants=0`; a fixture grant is a FAIL, never a pass |
| T2.5 revisit | BLOCKED | `BLOCKED_NO_REVISIT_RECEIPT` | A8 | no exit/return receipt pair for the same site instance |
| T2.6 blocked access | BLOCKED | `BLOCKED_NO_BLOCKED_ACCESS_RUN` | A8 | 7 gates declared; no observed threshold refusal |

### Track 3 — material, knowledge, offline return — **BLOCKED**

| case | verdict | code | evidence |
|---|---|---|---|
| T3.1 harvest | BLOCKED | `BLOCKED_NO_HARVEST_RUN` | bindings exist; no receipt |
| T3.2 tool wear | **BLOCKED** | `BLOCKED_NO_TOOL_WEAR_RUN` | A3's V7 contract is real (`economy_service.gd:255 condition_cost`, `:269 apply_tool_use_plan`) and A0 consumes it (`a0_economy_adapter.gd:51`), but no run shows a tool losing condition. A contract is not wear |
| T3.3 research methods | BLOCKED | `BLOCKED_NO_RESEARCH_RUN` | three escrow shapes; nobody has spent them |
| T3.4 recipe sinks | BLOCKED | `BLOCKED_NO_CRAFT_RUN` | six sink sections; nothing crafted |
| T3.5 provenance | **BLOCKED** | `BLOCKED_NO_PROVENANCE_REJECTION` | **revised**: `input_escrow_mismatch`/`fuel_escrow_mismatch` are escrow-integrity invariants, not source authorisation. No provenance rejection exists in the composed product (`authenticate_source` is absent from A0's vendored copy and nothing calls it) |
| T3.6 fuel | PASS | `FUEL_REQUIRED` | `offline_operation_planner.gd:257` refuses a missing fuel escrow |
| T3.7 duplicate | PASS | `DUPLICATE_REFUSED` | idempotency key (`a0_offline_host.gd:17`) |
| T3.8 stale run | PASS | `STALE_RUN_REFUSED` | `run_id_mismatch` / `run_expired` |
| T3.9 paid 2PID | BLOCKED | `BLOCKED_NO_2PID_RECEIPT` | the probe refuses to fabricate custody |
| T3.10 next choice | BLOCKED | `BLOCKED_NO_OUTCOME_RUN` | no before/after choice |
| **T3.11 submitted service composed** | **FAIL** | `A3_SERVICE_REFUSED_BY_SCOPE` | A3's `game/survival/economy/a3_economy_service.gd` and `offline_operation_planner.gd` are **refused as out of scope** (7 A3 economy files); the product runs A0's vendored fork (`vendor/a3_economy_service.gd`, 1789 lines). Consumer tests above therefore measure a **copy**, not A3's submitted service |

### Track 4 — forward compatibility — **BLOCKED (fail-closed)**

`T4.1` Core use, `T4.2` Core-gated research, `T4.3` threat+bag, `T4.5` last72 Elders, `T4.7`
fixed deposits: **`NOT_IMPLEMENTED`** (absent symbols; a refusal string or a profile field is not a
feature). `T4.4` run reset, `T4.6` chest currency, `T4.8` evacuation: symbols exist, no run →
**`BLOCKED`**. A7 implements none of this.

## 4. Adversarial controls — 67/67

`--self-test` builds synthetic trees and evidence and asserts both verdict **and** code. Every wrong
answer from this round is now a permanent control:

```
T1.7 authority cannot load → FAIL AUTHORITY_SCRIPT_DOES_NOT_RUN
T1.7 authority runs → PASS RUNTIME_AUTHORITY_VERIFIED
T1.7 loader control fails → FAIL HARNESS_LOADER_BROKEN
T1.7 engine errors beat every source claim → FAIL ENGINE_REPORTED_SCRIPT_ERRORS
T1.7 no native marker → BLOCKED                      T1.7 scripts load, new() fails → BLOCKED
T1.3 live world unknown → BLOCKED                    T1.4 live world unknown → BLOCKED
T1.4 source inference never overrules the engine     T1.4 no placement marker → BLOCKED
T1.2 dead control is never quoted as a working world
T2.3 no knife id → BLOCKED (not "melee unplayable")  T2.2 teleport is not a route → FAIL
T3.5 escrow codes alone never PASS                   T3.5 owner string accepted → FAIL
T3.5 owner string refused in a run → PASS            T3.2 contract present, no run → BLOCKED
T3.2 no contract at all → FAIL                       T3.2 run without wear → FAIL
T3.2 run loses condition → PASS                      T3.11 service composed → PASS
T3.11 service refused by scope → FAIL                T3.11 no composition report → BLOCKED
T2.4 fixture grant → FAIL                            T2.6 refused=null → BLOCKED
T4.1 absent → NOT_IMPLEMENTED                        T4.1 present+gate fails → FAIL
maturity never grants HUMAN_ACCEPTED                 evidence split keeps product ≠ control markers
```

## 5. Artifacts and CI receipt

| artifact | path |
|---|---|
| harness (32 cases, 4 tracks) | `tools/survival/balance/a7_certify.py` |
| native probe (A7-owned) | `tests/survival/a7_certification_probe.gd` |
| workflow | `.github/workflows/a7-certification.yml` |
| manifest | `docs/survival/balance/certification/manifest.r14.json` |
| machine report | `data/survival/balance/certification/a7_certification.r14.v2.json` |
| committed evidence | `docs/survival/balance/certification/r14_ci/` — `report.json`, `report.md`, `probe.txt`, `probe_control.txt`, **`composed.native.txt`**, **`control.native.txt`**, `import*.txt`, `control_delta.txt`, `selftest.txt` |

**CI receipt: run `41226124443` on head `a18b977f`** — every step green: self-test (`N/N`,
back-reference), compose, Godot 4.7, composed probe (`A7C_DONE`), **reconciled control probe**,
certify, evidence committed (`91beb49f`). Earlier runs this round: `41221364880`, `41222614730`,
`41225025702` (probe emitted no `NATIVE_LOAD` — the case that produced this revision), `41225392699`
(workflow grep pinned a stale self-test count and failed; now `N/N`).

Method: the probe runs on a copy of the certified tree differing by exactly one A7-owned file; the
certified tree is graded pristine; each tree is `--import`ed first, because an unimported tree
reports missing global classes and invites false owner attributions.

## 6. What each owner must fix — reproduced

| owner | finding | repro |
|---|---|---|
| **A0** | declared resolution substitutes a stale merge artifact for its own controller; the composed product runs the `384×256` sidecar | `tools/a0/ownership.json:82`; `git show a6e37978:game/overworld/chapter1_overworld.gd \| wc -l` → 1642 vs `wc -l tools/a0/merges/chapter1_overworld.gd.merged` → 1366 |
| **A0** | the authority script cannot be instantiated, so the authored world cannot run even in A0's own tree | `game/survival/a0_world_authority.gd:157` calls `_spawn_cell()`; the class defines `spawn_cell()` at `:265`. Fix: use `spawn_cell()` (or define the helper) and re-run `godot --headless --path . --script res://tests/survival/a7_certification_probe.gd` |
| **A0** | tool wear has a contract and a consumer but no run | `economy_service.gd:255,269`; `a0_economy_adapter.gd:51`; needs `A7C T3.2 {condition_before,condition_after}` |
| **A0** | economy scope refuses A3's submitted service, so the product runs a fork | `.composition/composition.json → refused_out_of_scope.a3` (7 economy files) |
| **A3** | no knife-like item id (57 ids) — catalog gap for the knife-first journey, not a melee verdict | `data/survival/items/items.json` |
| **A3** | provenance rejection absent from the composed path; escrow mismatch is a different invariant | no `authenticate_source` in `vendor/a3_economy_service.gd` |
| **A8** | three scenes resolve, nothing mounts or enters them | probe `A7C T2.1`; package `…NOT_MOUNTED` |
| **AVFX/A0** | Core use/store/research absent | `FEATURE_PROBES.core_*` → 0 hits |

A7's own defects this round, all fixed and controlled: missing-observation-as-failure; assuming the
legacy document is live; **scanning controller text instead of loading it**; a probe that aborted on
`new()` and lost its native marker; and a CI grep pinned to a self-test count that had moved.

## 7. Verdict, hold, and the exact trigger

**`FAIL` at `PRODUCT_COMPOSED`, `PASS` at `TEST_HARNESS_VALID`, status `PAUSE_DEPENDENCY`.** No merge,
no owner gameplay edit, no fabricated reward, no human claim.

A7 waits on **one event**: A0 publishes a **new exact composed SHA** that

1. recomputes to the declared tree (`git write-tree`) with A3 and A6's **new** heads included;
2. mounts A0's own controller (resolution regenerated or dropped), so `A7C AUTHORITY
   source_authority_present=true`;
3. **instantiates it**: `A7C NATIVE_LOAD controller_instantiates=true`,
   `authority_can_instantiate=true`, `controller_mode="authored"`, and therefore
   `runtime_authority_verified=true` with `live=1024×768`;
4. keeps `composed.native.txt` free of `SCRIPT ERROR`/`Parse Error`;
5. brings native input with it: a walked two-site route with a durable revisit, and one funded
   exactly-once two-process settlement.

Only then does the unchanged harness re-run for a full certification. Documentation, cosmetic or
harness-only commits never trigger a full journey run.

_Receipt: PR #25 unmerged. A Git comment or a Docs page is a record, not an Arena dispatch._
