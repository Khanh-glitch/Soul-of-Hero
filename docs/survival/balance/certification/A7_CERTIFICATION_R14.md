# A7 · R14 — cross-system player-capability certification

_2026-10-31. Independent QA. This report **does not** merge, does not edit an owner's gameplay file,
does not grant in-game rewards and does not claim a human playtest. It certifies one exact
composition across four connected tracks and states plainly what is proven, what is missing and
who owns each gap._

**Headline: `FAIL` · maturity `TEST_HARNESS_VALID` · composition `f6d5cf789995` ·
30 cases — PASS 6 · FAIL 5 · BLOCKED 14 · NOT_IMPLEMENTED 5.**

The most important single fact, and the one this round got wrong first: **the composed product
starts the player at `(389, 291)` — a cell `standable=true` in `1024×768`, but outside the
`384×256` world the composed build actually runs.** That is not A0's gameplay source: A0's own
committed controller mounts `A0WorldAuthority` and activates the authored continent. The composed
tree replaced that controller with **A0's declared resolution artifact**
(`tools/a0/merges/chapter1_overworld.gd.merged`), which is **1366 lines against A0's 1642** — 331 of
A0's lines absent — and still mounts the legacy sidecar. Restoring that one file is the entire difference: the same probe
then measures `live = authored = 1024×768`, `spawn in_live_world=true`, `T1.4 outside=0`.

**Correction record.** The first answer this round called this a source-level `SIDECAR_WORLD` defect
in A0. It was wrong, and wrong in the exact way this project keeps punishing: the probe treated
`data/overworld/hollow_marches.json` as "the live world" without asking the production controller
which world it mounts. The correction is in code, not in prose — the probe now resolves the live
world from `game/overworld/chapter1_overworld.gd` (`A7C AUTHORITY`), the harness grades
`COMPOSITION_DROPS_OWNER_WORK` when a control tree proves the base owner committed what the
composition dropped, and two controls lock both behaviours in place.

---

## 0. What is new in this round, and what is not

| | |
|---|---|
| **New** | a reusable certification harness (`tools/survival/balance/a7_certify.py`), a native Godot 4.7 probe (`tests/survival/a7_certification_probe.gd`), four connected track definitions, 30 named cases, 43 adversarial self-test controls, a committed machine report, and this document |
| **Not new** | the six R13 static oracles and their correction (accepted separately, unchanged here); the round-13/14 visual findings; any owner's code |
| **Not claimed** | human acceptance, E2, "fun", a product PASS, or any capability that lacks a runtime receipt |

## 1. The pipeline every case must walk

```
source  →  contract  →  runtime  →  receipt  →  player outcome
```

A case stops at its first non-`VALID` stage. The verdict therefore carries its own scope:
`PASS` at `contract` means *the owner's contract is real*, **not** that a player did it.

Four maturity levels are tracked separately and never conflated:

| level | meaning | what grants it here |
|---|---|---|
| `TEST_HARNESS_VALID` | the harness rejects known-bad controls | 43/43 self-test, CI-asserted |
| `OWNER_SOURCE_VALID` | every case's source stage is `VALID` and none is `FAIL` | requires all 30 source stages; **not reached** |
| `PRODUCT_COMPOSED` | runtime + receipt + outcome all `PASS` on the exact tree | requires real journeys; **not reached** |
| `HUMAN_ACCEPTED` | a human played it | **never granted by this program** |

## 2. Baseline identity — recomputed, not remembered

| step | result |
|---|---|
| live owner heads (`gh api …/branches/<b>`) | A0 `a6e3797879915510b2e86be0d2ee521f53967c94` · A1 `e1e4e9a4d4a0f7f0d38360d638715a0c9f144208` · A3 `80fe8ceca6de02523985a6eb53e9567639885f0e` · A6 `816cc22ab532f297dd7c480fccf34e84f482957a` · A8 `5bf5c8f93e5905db96f98e2f20e716e0bffbce68` |
| composition | `tools/a0/compose_owners.py` → `conflicts=0 unresolved=0`, 314 / 22 / 117 / 67 files copied |
| tree | **`f6d5cf789995ccd775cfab9b2f3c98a7ecc667b0`**, recomputed by the harness itself (`git write-tree`) on every run and compared to the declared value |
| engine | **Godot 4.7-stable (official)**, reported by the probe from inside the composed tree |

All five owners moved since the previous baseline (`fbe5438381`): A0 +2,025 lines across 7 files
(including a new 815-line `a0_world_authority.gd`), A1 +3,669, A3 +2,571, A8 +1,480. That is why
nothing from the earlier ledger is inherited here.

**Which world is live — measured, not assumed** (`A7C AUTHORITY`, composed vs reconciled control):

| | composed tree (certified) | reconciled control |
|---|---|---|
| `game/overworld/chapter1_overworld.gd` | 1366 lines, `sha 818cfe61…` | 1642 lines, `sha 53f3dac2…` (A0's own file) |
| mounts `A0WorldAuthority` | **false** | **true** |
| mounts `A0AuthoredWorldMount` | true | false |
| authority default `authored` | false | true |
| `survival/a0_world_authority` in `project.godot` | not declared (code default governs) | not declared |
| resolved `live_source` / live frame | `legacy_sidecar` / `384×256` | `authored_authority` / `1024×768` |
| T1.3 spawn `(389,291)` | `in_live_world=false` | `in_live_world=true`, `standable=true` |
| T1.4 sites outside | `3/3` | `0/3` |

## 3. Results by track

### Track 1 — world, player and geography — **FAIL**

| case | verdict | code | owner | evidence |
|---|---|---|---|---|
| T1.1 composition | **PASS** | `COMPOSITION_IDENTITY` | A7 | declared tree reproduces byte for byte |
| T1.2 one authority | **FAIL** | `COMPOSITION_DROPS_OWNER_WORK` | **A0** | composed controller `1366` lines, `mounts_authority=false`, `mounts_sidecar=true`, `live_source=legacy_sidecar` → live `384×256`; A0's own committed controller is `1642` lines, `mounts_authority=true`, `authority_default_authored=true`; the declared resolution at `tools/a0/compose_owners.py`-ruled path substitutes the stale merge artifact |
| T1.3 spawn | **FAIL** | `SPAWN_OUTSIDE_LIVE_WORLD` | **A0** | composed probe: `(389,291)`, chunk `6:4`, `standable=true`, `in_live_world=false`, live `384×256`; reconciled control: same cell, `in_live_world=true`, live `1024×768` |
| T1.4 approaches | **FAIL** | `SITE_OUTSIDE_LIVE_WORLD` | **A0** | quarry `(30,280)`, orchard `(140,360)`, mill `(120,300)` — 3/3 outside in the composed tree (`A0_WORLD_ABSENT`); the reconciled control measures `outside=0` |
| T1.5 bootstrap | **PASS** | `INPUT_BOOTSTRAP_INDEPENDENT` | A7 | probe: reader `ok=true` **both** before and after the bootstrap; the round-12 `PLAYER_INPUT_*` failure does not reproduce on this tree |
| T1.6 movement | **BLOCKED** | `BLOCKED_NO_MOVEMENT_RUN` | A0 | needs a walked player with collision; no such run exists |

The honest reading of T1.2: A0 **built** the right thing (`A0WorldAuthority`, whose header says
"one world, one authority, no sidecar") and **did not mount it**. `chapter1_overworld.gd:65,275`
still resolves `survival/a0_authored_stream` with a `false` default, and that setting is not even
declared in `project.godot`. Shipping a reader is not mounting a continent.

### Track 2 — discovery, preparation, revisiting — **FAIL**

| case | verdict | code | owner | evidence |
|---|---|---|---|---|
| T2.1 site scenes | **BLOCKED** | `BLOCKED_NO_ENTRY_RUN` | A8 | probe: all three scenes resolve (`exists=true`); `package_status=A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED` |
| T2.2 route | **BLOCKED** | `BLOCKED_NO_ROUTE_RUN` | A0 | no walked route; a teleport is rejected by this harness |
| T2.3 knife-first | **FAIL** | `NO_KNIFE_ITEM` | **A3** | 57 item ids, **zero** knife-like |
| T2.4 earned capability | **BLOCKED** | `BLOCKED_NO_EARNED_EVIDENCE` | A7 | no run declares `fixture_grants=0` |
| T2.5 revisit | **BLOCKED** | `BLOCKED_NO_REVISIT_RECEIPT` | A8 | no exit/return receipt pair |
| T2.6 blocked access | **BLOCKED** | `BLOCKED_NO_BLOCKED_ACCESS_RUN` | A8 | 7 gates declared; the probe observed no threshold refusal |

### Track 3 — material, knowledge, offline return — **FAIL**

| case | verdict | code | owner | evidence |
|---|---|---|---|---|
| T3.1 source → inventory | **BLOCKED** | `BLOCKED_NO_HARVEST_RUN` | A3 | bindings exist (`world_source_bindings.v3.json`); no harvest receipt |
| T3.2 tool wear | **FAIL** | `TOOL_WEAR_ABSENT` | **A0** | no `durability` / `tool_wear` symbol anywhere in `game/survival` |
| T3.3 three research methods | **BLOCKED** | `BLOCKED_NO_RESEARCH_RUN` | A3 | `offline_operation_planner.gd` distinguishes targeted / blueprint / specimen escrows (`:275-289`); nobody has spent them |
| T3.4 recipe sinks | **BLOCKED** | `BLOCKED_NO_CRAFT_RUN` | A3 | `progression_model.json` declares 6 sink sections; nothing crafted |
| T3.5 owner-string-only auth refused | **PASS** | `ESCROW_MISMATCH_REFUSED` | A3 | `input_escrow_mismatch` `:255`, `fuel_escrow_mismatch` `:257`, `arm_job_id_mismatch` `:138` |
| T3.6 physical fuel required | **PASS** | `FUEL_REQUIRED` | A3 | `fuel_escrow_mismatch` at `offline_operation_planner.gd:257` |
| T3.7 duplicate job / early claim | **PASS** | `DUPLICATE_REFUSED` | A0 | SaveService idempotency key (`a0_offline_host.gd:17`), `proposal_id` as idempotent transaction key (planner `:521`) |
| T3.8 stale run / expiry | **PASS** | `STALE_RUN_REFUSED` | A0 | `run_id_mismatch` planner `:316`; `run_expired` host `:194` |
| T3.9 paid 2PID | **BLOCKED** | `BLOCKED_NO_2PID_RECEIPT` | A0 | the probe refuses to fabricate custody; the R13 O4 rules apply unchanged |
| T3.10 meaningful next choice | **BLOCKED** | `BLOCKED_NO_OUTCOME_RUN` | A3 | no before/after choice recorded |

Track 3's four `PASS` results are **contract-stage** PASSes: they prove A3/A0 *refuse* the wrong
things by name. They do not prove a player ever funded, smelted or learned anything.

### Track 4 — full-game forward compatibility — **BLOCKED (fail-closed)**

| case | verdict | feature state |
|---|---|---|
| T4.1 Core carried/used/stored | **NOT_IMPLEMENTED** | no `use_core` / `activate_core` (`world_action_core_reward_forbidden` is a *refusal string*, not Core use) |
| T4.2 physical Core gates research | **NOT_IMPLEMENTED** | none (AVFX) |
| T4.3 trace-based threat + bag | **NOT_IMPLEMENTED** | no `apply_damage` / `take_damage` |
| T4.4 336-hour run ends and resets | **BLOCKED** | `reset_run_preserving_profile` exists (`a0_run_lifecycle.gd:58`), no run proves an ending |
| T4.5 last72 Elder transformation | **NOT_IMPLEMENTED** | `elder_stones` is a profile field, not a territory transformation |
| T4.6 chest-sourced Ragnarok cash | **BLOCKED** | a `ragnarok_unbanked` field exists in A3 bytes; no chest interaction exists |
| T4.7 multiple fixed-site deposits | **NOT_IMPLEMENTED** | none |
| T4.8 evacuation + run-local wipe | **BLOCKED** | `"evacuation"` is an accepted `end_run` reason (`:224`) and `reset_run_preserving_profile` exists; no player-facing evacuation exists |

A gate here is `PASS` only when the feature exists **and** a runtime marker says it behaved.
Absent feature → `NOT_IMPLEMENTED`; present but unrun → `BLOCKED`. Both are fail-closed; neither
is a pass.

## 4. Adversarial controls — 43/43

`--self-test` builds synthetic compositions and receipts and asserts the verdict **and** code.
The ones that matter most, because each is a former false green:

```
T1.2 sidecar world → FAIL SIDECAR_WORLD              T1.2 one world, no run → BLOCKED
T1.3 spawn outside live world → FAIL                 T1.3 unstandable spawn → FAIL
T1.5 harness false negative → FAIL TEST_BOOTSTRAP_FALSE_NEGATIVE
T1.5 half pair → BLOCKED                             T1.5 both halves clean → PASS
T1.6 no collision → FAIL                             T2.2 teleport is not a route → FAIL
T2.4 fixture grant → FAIL                            T2.6 refused=null → BLOCKED (not FAIL)
T3.3 two methods → FAIL                              T3.6 no fuel escrow → FAIL
T3.9 two granted → FAIL                              T3.9 not exactly once → FAIL
T3.9 not-this-probe → BLOCKED                        T4.1 absent feature → NOT_IMPLEMENTED
T4.1 present + gate passes → PASS                    T4.1 present, no run → BLOCKED
T1.1 tree diverges → FAIL                            probe parser keeps T1.5_BEFORE markers
composed drops A0's authority → COMPOSITION_DROPS_OWNER_WORK (not SIDECAR_WORLD)
authority missing in both trees → SIDECAR_WORLD       legacy doc cannot overrule an authored controller
control evidence never overwrites a product marker    maturity never grants HUMAN_ACCEPTED
```

Two of those controls are new this round because the **harness itself** first got them wrong in
CI: a probe that declares `refused: null` and a factory marker that says `NOT_THIS_PROBE` were
being turned into `FAIL`. Missing evidence is `BLOCKED`; only an explicit negative observation is
a failure. That correction is in the tool and has two permanent controls.

## 5. Evidence artifacts

| artifact | path |
|---|---|
| harness | `tools/survival/balance/a7_certify.py` |
| native probe (A7-owned) | `tests/survival/a7_certification_probe.gd` |
| manifest | `docs/survival/balance/certification/manifest.r14.json` |
| machine report | `data/survival/balance/certification/a7_certification.r14.v2.json` |
| CI run evidence | `docs/survival/balance/certification/r14_ci/` — `report.json`, `report.md`, `probe.txt`, `import.txt`, `selftest.txt`, `certify.txt` |
| reconciled control evidence | `docs/survival/balance/certification/r14_ci/probe_control.txt`, `import_control.txt`, `control_delta.txt` |
| workflow | `.github/workflows/a7-certification.yml` |

**CI receipt.** Run **`41222614730`** on head **`5669a916`** (supersedes `41221364880` on
`15f83a2a`, which carried the wrong attribution): self-test success (greps
`A7_CERT_SELFTEST 43/43`), compose success, Godot 4.7 setup success, composed probe success
(`A7C_DONE`, engine `4.7-stable (official)`), **reconciled control probe** success, certify success,
evidence committed back as `docs/survival/balance/certification/r14_ci/`. Earlier runs of the same
workflow: `41219910428` failed, then `41220088262`, `41220276784`, `41220567028`, `41220906463`,
`41221364880` succeeded. Artifact and log downloads from
`productionresultssa*.blob.core.windows.net` return `EOF` in this environment, which is why the run
commits its own evidence into Git instead.

**The control, stated precisely.** The reconciled control tree is byte-identical to the certified
composition except for `game/overworld/chapter1_overworld.gd`, which is restored to A0's committed
version (`control_delta.txt` records the hash). It is evidence about *where the defect lives*, never
a substitute for the product verdict: `T1.2` still fails on the certified tree, and the control's
green measurements are reported as control measurements only.

**Method note.** The probe runs on a copy of the certified tree that differs by exactly one
A7-owned file (`tests/survival/a7_certification_probe.gd`); the certified tree is graded pristine,
so the identity assertion cannot be satisfied by the probe's own presence. The tree is imported
(`godot --headless --import`) before probing: an unimported tree reports missing global script
classes, and round 14 nearly certified that as an owner defect.

## 6. What each owner must do — reproduced, with file:line

**Composition artifact (A0-owned metadata, not A0 gameplay code).** `tools/a0/compose_owners.py`
applies A0-declared `a0_resolution` rulings by copying `tools/a0/merges/<file>.merged` over the A0
base. For `game/overworld/chapter1_overworld.gd` that artifact is **stale by 276 lines relative to
A0's own commit**: it still mounts `A0AuthoredWorldMount` behind `survival/a0_authored_stream`
(`get_setting(…, false)`, and the setting is not declared in `project.godot`), and it has no
`A0WorldAuthority` at all. A0's committed file, by contrast, mounts the authority and defaults to
`authored`. The composition tool already reports a resolution as "stale" when a *non-A0* owner stops
touching the file; it never compares the artifact against the base owner's own later work.

Reproduction, no Godot required:

```bash
git show a6e37978:game/overworld/chapter1_overworld.gd | wc -l          # 1642
wc -l tools/a0/merges/chapter1_overworld.gd.merged                      # 1366
diff <(git show a6e37978:game/overworld/chapter1_overworld.gd) \
     tools/a0/merges/chapter1_overworld.gd.merged | grep -c '^<'        # 331 lines dropped
git show a6e37978:game/overworld/chapter1_overworld.gd | grep -n A0WorldAuthority   # :1, :75, :123
```

**The repair is one of:** regenerate `tools/a0/merges/chapter1_overworld.gd.merged` from A0's
current file, or delete the `a0_resolution` ruling for that path so the base owner's file is kept.
Then re-declare the composition, recompute the tree, and say so — the harness re-runs unchanged.

| owner | finding | repro |
|---|---|---|
| **A0** | declared resolution substitutes a stale merge artifact for their own controller, so the composed product runs the legacy sidecar | `tools/a0/merges/chapter1_overworld.gd.merged` (1366 lines) vs `game/overworld/chapter1_overworld.gd` at `a6e37978` (1642 lines); probe `A7C AUTHORITY` in `r14_ci/probe.txt` vs `r14_ci/probe_control.txt` |
| **A0** | on the composed tree, A1's safe spawn and every A8 cell fall outside the live world | probe `A7C T1.3 {"cell":[389,291],"in_live_world":false}`; `A7C T1.4 {"outside":3}`; control: `in_live_world=true`, `outside=0` |
| **A0** | no tool wear exists anywhere in the survival service | `grep -rn "durability\|tool_wear" game/survival` → 0 hits |
| **A1** | safe spawn `(389,291)` is `standable=true` in the authored frame — this part is **not** a defect (control confirms it lands inside `1024×768`) | `A1C T1.3` in `r14_ci/probe_control.txt` |
| **A3** | no knife item, so P3 cannot be played | `data/survival/items/items.json` (57 ids, 0 knife-like) |
| **A8** | scenes exist but nothing physically enters or leaves them | probe `A7C T2.1`, package `…NOT_MOUNTED` |
| **AVFX / A0** | no Core use, store or research exists, so Track 4's Core gates stay `NOT_IMPLEMENTED` | `FEATURE_PROBES.core_*` → 0 hits |

A7's own defects this round, all fixed and controlled: missing-observation-as-failure in T2.6 and
T3.9; an unimported tree producing false owner attributions in the first CI run; and **treating the
legacy document as the live world**, which produced the false `SIDECAR_WORLD` attribution corrected
above. Two controls now assert that the live frame comes from the controller and that a control
tree's markers can never overwrite a product's.

## 7. Verdict and the precise trigger for the next certification

**`FAIL` at `PRODUCT_COMPOSED`; `PASS` at `TEST_HARNESS_VALID`.** Product acceptance is not
granted, no player capability is claimed beyond the six `PASS` rows above, and E2/human enjoyment
remains `NOT_TESTED`.

A7 now waits on **one event**: A0 publishes a **new composed tree** whose recomputed
`write-tree` equals its declared SHA *and* whose live scene mounts a single authoritative world —
which, per §6, is already true of A0's committed file and is lost only by the stale resolution.
Then — and only then — the same harness re-runs unchanged, and the following must hold for Track 1
to move at all:

1. the composed `chapter1_overworld.gd` mounts `A0WorldAuthority` (A0's own file already does;
   the composition must stop replacing it), so the probe's `A7C AUTHORITY` reports
   `live_source=authored_authority` and `live == authored == 1024×768`;
2. the probe's `T1.3` reports `in_live_world=true` with `standable=true`;
3. all three A8 cells report `inside_live_world=true` and `T1.4.outside == 0`;
4. a walked route (`T2.2 walked=true, teleported=false`) reaches two distinct sites and returns
   with the same `site_instance_id` in a second process;
5. a funded job settles exactly once across two OS processes with a duplicate refusal
   (`T3.9`), and one before/after choice changes (`T3.10`).

Nothing re-runs for a documentation or cosmetic commit, and this harness never turns a missing
stage into a pass.

_Receipt: PR #25 unmerged; no owner gameplay file edited; no merge; no fabricated reward; no human
claim. A Git comment or a Docs page is a record, not an Arena dispatch._
