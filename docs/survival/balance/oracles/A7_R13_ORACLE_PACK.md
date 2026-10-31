# A7 · R13-A7-GATE — fail-closed oracle pack, baseline disposition

_2026-10-31. Independent QA only. This document does not merge, does not edit an owner's
source, and does not dispatch an Arena prompt. It is a **reusable oracle pack plus the
disposition of one frozen baseline**, not a full product review and not a playtest._

## 0. What this round is, and what it deliberately is not

Round 12 accepted evidence it should have refused. The fix is not another multi-hour review of
a moving tree: it is a small set of oracles that **fail closed on exactly those patterns**, run
against one frozen composition, with a synthetic self-test proving they discriminate.

- **In scope:** the six required behaviours (§2), their automation, their known-negative
  controls (§5), and the baseline verdict per scope with one root blocker each (§4).
- **Out of scope by instruction:** a new full-game review, re-reviewing cosmetic commits,
  any change to A0/A1/A3/A6/A8 source, any merge, any E2 or "human enjoyment" claim.
- **No score.** A verdict is PASS only with positive evidence; missing evidence is `BLOCKED`;
  one `FAIL` fails the pack. There is no average and no percentage.

## 1. Baseline identity — reproduced, not remembered

| step | command | result |
|---|---|---|
| owner pins read live | `gh api repos/.../branches/<b> --jq .commit.sha` | A0 `ee5f9f5160c8e4385f35a63b355ddda957f93d10` · A1 `a030cb89a5033ba5faba39995762b4bea1332cec` · A3 `b44e22df3af40939069189be14afc23ee1ce21c4` · A6 `6d1e8bcee0bbb09be0ff04f14de1f7e59f06cfb8` · A8 `0f885df862d7d34f18ca456e80b1aaac05b23de0` |
| composition rebuilt | `tools/a0/compose_owners.py --repo . --out .composition --copy-base --owner a1=… --owner a3=… --owner a8=… --owner a6=…` | `a1 309` / `a3 22` / `a6 114` / `a8 64` files copied, `conflicts=0 unresolved=0` |
| independent tree identity | `git add --force --all && git write-tree` in the composed tree | **`fbe54383881c6cc29c30874782721ea63155e661`** — byte-identical to the declared baseline |

The pack repeats that `write-tree` itself on every run (`O6`), so a future candidate whose
declared SHA and recomputed SHA disagree can never be scored as current product evidence.

**The frozen tree is a baseline, not proof.** Nothing below says the product is playable because
this tree exists. Source identity is not player capability.

## 2. The six oracles

| id | rejects | refuses to pass when | owner of the defect | kind |
|---|---|---|---|---|
| **O1** | `PLAYER_INPUT_*` refusal read as an A1 source failure | a pre-bootstrap refusal has no bootstrapped control; bootstrapped run succeeds → harness defect, bootstrapped run fails → A1 contract | A7 (harness) / A1 (contract) | test-only / source-contract |
| **O2** | A1 chunks rendered beside the legacy 384×256 collision map | live bounds ≠ authored frame, or the mount declares a sidecar, or A8 sites fall outside the live world | A0 | source-contract, then real-gameplay |
| **O3** | 31 green assertions next to `PHYSICAL_NOT_TESTED` | fewer than two distinct sites are entered, left and returned from by the real player | A8 | real-gameplay |
| **O4** | a "paid 2PID factory" with `prefix_complete=false`, a freed GUI row, no funded job, a skipped second process, or `nothing_to_settle` | any of those, or no duplicate-claim control | A0 | real-gameplay |
| **O5** | `error=0` on a black/blank frame | a frame is blank, flat, under 640×360, or fewer distinct resolutions than required | A7 | visual-product |
| **O6** | a stale pin, a foreign composition, a workflow pinning someone else's SHA | any stale pin; recomputed tree ≠ declared tree; evidence stamped with another composition | A0 (its workflows) | evidence-integrity |

Implementation: [`tools/survival/balance/a7_oracle_pack.py`](../../../tools/survival/balance/a7_oracle_pack.py).
Machine output: [`data/survival/balance/oracles/a7_oracle_pack.r13.v1.json`](../../../data/survival/balance/oracles/a7_oracle_pack.r13.v1.json).
Pins used: [`pins.r13.json`](pins.r13.json).

**Self-test (`--self-test`) proves the oracles discriminate, not that they are green** — one case per
known-bad evidence shape, asserting the verdict **and** the code:

```
31/31 oracle expectations met
O1 harness false blocker → FAIL TEST_BOOTSTRAP_FALSE_NEGATIVE   | O1 clean → PASS
O1 real A1 failure      → FAIL A1_SOURCE_CONTRACT               | O2 sidecar → FAIL SIDECAR_WORLD
O2 clean, no run        → BLOCKED (never PASS)                  | O3 31 ok + NOT_TESTED → FAIL
O4 prefix false + freed → FAIL PREFIX_INCOMPLETE                | O4 green exits, nothing to settle → FAIL
O5 black frame          → FAIL BLANK_FRAME                      | O5 one resolution only → FAIL
O6 stale pin (CURRENT)  → FAIL STALE_PIN                        | O6 tree mismatch → FAIL STALE_COMPOSITION
```

## 3. Baseline run — real evidence, not fixtures

Command (evidence = round 14's own captured artifacts):

```bash
python3 tools/survival/balance/a7_oracle_pack.py \
  --composition <composed fbe54383881c> \
  --evidence docs/survival/balance/visual/r14 \
  --pins docs/survival/balance/oracles/pins.r13.json \
  --expected-tree fbe54383881c6cc29c30874782721ea63155e661
```

| oracle | verdict | code | owner | what the evidence actually said |
|---|---|---|---|---|
| O1 | **BLOCKED** | `BLOCKED_NO_BOOTSTRAP_EVIDENCE` | A7 | no before/after bootstrap pair exists in A7's evidence; the input refusal remains **unattributable** |
| O2 | **FAIL** | `SIDECAR_WORLD` | A0 | live world 384×256 vs authored 1024×768; all three A8 sites (30,280)(140,360)(120,300) outside it; mount declares `render_legacy := true` and "mounted *beside* it" |
| O3 | **BLOCKED** | `BLOCKED_NO_PHYSICAL_EVIDENCE` | A7 | 33 assertions printed, **none** about entering a site; no `A7_O3` record |
| O4 | **FAIL** | `FREED_GUI_NODE` | A0 | `prefix_complete=true`, then a `previously freed` row; both processes exit 1; no departure, no settlement |
| O5 | **PASS** | `FRAMES_HAVE_CONTENT` | A7 | six frames, three resolutions, 15–16k colours, stdev ≈ 21, non-modal 0.97 — the images are real and reviewable |
| O6 | **FAIL** | `STALE_PIN` | A0 | 15 stale pins across 7 workflows; composition identity itself verified equal |

**Pack verdict: `FAIL`.** First blocker: **O2 `SIDECAR_WORLD`, owner A0.**

## 4. First root blocker per scope, with the exact line

Each row names the first falsifiable source-level fact, not a symptom.

| scope | first root blocker | source | owner | kind |
|---|---|---|---|---|
| **world / mount** | the player's authoritative world is still the legacy 384×256 document while A1's authored 1024×768 continent is streamed beside it | `game/survival/a0_authored_world_mount.gd:12` ("mounted *beside* it, never instead of it"), `:29` (`var render_legacy := true`); `game/survival/a1_authored_source.gd:30` (`AUTHORED_FRAME := Vector2i(1024, 768)`); `data/overworld/hollow_marches.json` `world_bounds.w/h = 384/256` | **A0** | source-contract |
| **POI** | A0's own mount refuses every A8 site because the runtime world is too small | `game/survival/a0_poi_mount.gd:69` (`A1_RUNTIME_WORLD_EXTENT_ABSENT`), `:21–22`; A8 package `package_status = A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED` | **A0** (refusal) / **A8** (no physical entry) | real-gameplay |
| **factory / offline** | the panel rebuilds its rows and frees them while the journey still holds one | `game/survival/economy/economy_panel.gd:198–205` (`_refresh()` → `remove_child` + `queue_free`); `tests/survival_normal_connected_journey_test.gd:515` and `:145` | **A0** frees the row; **A7** mishandles it (typed parameter binds before the body's guard) | real-gameplay + test-only |
| **offline payoff** | `nothing_to_settle` is a legal *and currently reachable* outcome of the second process | `game/survival/economy/a0_offline_host.gd:175` | **A0** | real-gameplay |
| **input bootstrap** | the authored-reader gate depends on `InputMap` actions that only exist after the `InputBootstrap` autoload entered the tree | `game/survival/world/a1_runtime_compatibility.gd:124–131`; `project.godot:20` | **A7** (if un-bootstrapped) / **A1** (if still refuses after) | test-only / source-contract |
| **visual** | no defect at this layer from the pack; the frames are real. The round-14 read (roof hides door and interior, clipped labels, colliding prompts) stands separately | `docs/survival/balance/ROUND13_JOINED_PRODUCT_ACCEPTANCE.md` §11.4–§11.5 | **A0** | visual-product |
| **provenance** | seven workflows carry fifteen owner pins that no longer match any live head; two "current" composition workflows pin different owner sets | `.github/workflows/a0-a6-composition-validation.yml`, `a0-a6-v4-latest-composition.yml`, `a0-connected-journey.yml`, `a0-connector-endpoints.yml`, `a0-connector-pilot.yml`, `a0-round12-composition.yml`, `a0-waystation-input-restart.yml` | **A0** | evidence-integrity |

Stale pins in full (A0's workflows, baseline SHAs → expected):

```
a0-a6-composition-validation.yml   A6 6b801554a6af  A1 2cb1a3c5f093  A3 18e7afcbd576
a0-a6-v4-latest-composition.yml    A6 8bc0af5a1f5f  A1 7fd000e1c017  A3 c363c7e7599d
a0-connected-journey.yml           A1 8551a323e444  A6 6d71410a370d  A8 06d1758e2cf7
a0-round12-composition.yml         A1 9ca1453ccdd3  A6 81c1f57ea013  A8 6337533f7cc0
a0-connector-endpoints.yml         A1 2951bf8559…
a0-connector-pilot.yml             A1 2951bf8559…
a0-waystation-input-restart.yml    A1 2951bf8559…
```

None of these may be quoted as "current product evidence" until the pin set equals the live
matrix. This is the third pattern the round-12 review named, and it is still present.

## 5. Known-negative controls actually exercised

| control | source | expected | observed |
|---|---|---|---|
| round-14 journey log (real) | `docs/survival/balance/visual/r14/journey/` | reject | `FAIL FREED_GUI_NODE` |
| round-13 journey log (real) | `docs/survival/balance/visual/r13/journey/` | reject | `FAIL NO_NORMAL_DEPARTURE` — a *different* code from *different* real evidence |
| round-14 frames (real) | `docs/survival/balance/visual/r14/*.png` | accept | `PASS FRAMES_HAVE_CONTENT` — the pack does not blanket-fail |
| synthetic negative/positive pairs | `--self-test` | 17/17 | 17/17 |

Two real logs failing with two different codes is the discrimination that round 12 lacked.

## 6. Evidence contract for the next candidate

The pack reads these lines and nothing else. An owner's run that does not emit them is
`BLOCKED`, not passed.

```
CT_BOOTSTRAP_BEFORE   action_registered=<bool> reader_ok=<bool> reason=<code>     # pre-bootstrap control
CT_BOOTSTRAP_READER_AFTER ok=<bool> reason=<code>                                # same reader, bootstrapped
A7_O1_RESULT          <free text>                                                # what the runner concluded
A7_O2              same_source=<bool> authority=<authored|legacy|split>          # one world or two
A7_O3              site=<poi_id> entry=<bool> exit=<bool> return=<bool>          # per site, twice
A0_CONNECTED          prefix_complete=<bool> checks=<n> failures=<n>
A0_CONNECTED_DEPARTURE     {"ok": true, …}
A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": "<not nothing_to_settle>", …}
A0_CONNECTED_RESETTLE      {"duplicate": true, "paid": false}
process1.exit / process2.exit  0
```

Plus, for `O5`: three real captures at 1280×720 / 2560×1440 / 3840×2160 and no `error=0` claim
without a file of that name.

## 7. Baseline disposition and the trigger for the next review

**Disposition: `HOLD_PRODUCTION` · baseline `fbe5438381` accepted only as a frozen source
matrix · product acceptance `FAIL` on O2/O4/O6 and `BLOCKED` on O1/O3.** No merge, no E2, no
owner source edited, no input remapped, no grant or teleport used anywhere.

A7 now enters **dependency-ready** state. It re-runs the *same pack* when, and only when, A0
publishes a **new composed tree** — i.e. a new exact 40-character owner set whose recomputed
`write-tree` equals the declared SHA. Not on a documentation commit, not on a cosmetic commit,
not on a new comment.

When that happens the run is finite and already specified:

1. `O6` first: is this tree current, and does every workflow pin agree?
2. `O2` then: one world, or a sidecar? Real player position, collision, camera, resources,
   building and traversability from the same authority.
3. `O3`/`O4`: two physical sites entered and returned from; a funded job settled exactly once
   across two OS processes, with the duplicate claim refused.
4. `O5`: three resolutions, 1× review, blank/flat rejected automatically.
5. Only then R0–R5 and the nine veto gates for the new tree.

Until then A7 adds no new conclusions and spends no CI on cosmetics.

## 7.1 CI receipt — the pack runs on the repo, not only on my laptop

`.github/workflows/a7-oracle-pack.yml` (push on the pack's own paths, plus `workflow_dispatch`
with owner-SHA inputs) does three things and nothing else: it runs `--self-test`, it composes
the exact owner matrix from the five 40-character SHAs, and it runs the pack against that tree
with the declared `expected_tree`. It uses a blob-less partial clone, so it never downloads the
full 4.4 GB history up front.

Run **`41214690921`** (head `c2188052e5`): all six steps succeeded —
`Oracle self-test` **success** (the step's own `17/17` grep is part of it), `Compose the exact
owner matrix` **success**, `Run the pack against that tree and the recorded evidence` **success**.

What that success does and does not mean:

* it **does** mean the composition identity assertion inside the step did not fire — that check
  exits non-zero when the recomputed `write-tree` differs from the declared `expected_tree`, so
  a silent divergence would have failed the job;
* it does **not** mean the product passed. The step deliberately ends `exit 0` after the
  provenance gate, because on this baseline the pack is *expected* to return `FAIL`;
* the precise CI-measured numbers are **not quoted**, because the artifact and log downloads
  from `productionresultssa*.blob.core.windows.net` failed with `EOF` in this environment (the
  same failure mode recorded in round 14). The numbers in §3 come from the local run against
  the same tree and the same evidence directory.

`workflow_dispatch` itself returned **403** for this token, so the dispatch-only inputs could not
be exercised; the push trigger uses the same defaults and is what ran.

## 8. Receipt

| action | evidence |
|---|---|
| owner pins refreshed from GitHub | §1, five full SHAs |
| composition rebuilt and identity reproduced | tree `fbe54383881c6cc29c30874782721ea63155e661`, `conflicts=0` |
| oracle pack written, self-tested | `tools/survival/balance/a7_oracle_pack.py`, 17/17 |
| pack run on the real baseline | `data/survival/balance/oracles/a7_oracle_pack.r13.v1.json` |
| pack run in CI, composition identity gate untripped | run `41214690921` on head `c2188052e5`, all steps success |
| PR | #25, branch `arena/353cf120-soul-of-hero`, **unmerged** |
| not done | no owner file edited, no merge, no dispatch, no E2 claim — a Git comment or a Docs edit does **not** start an Arena prompt |

## 9. R13 final correction — CT review P0s, and what changed

CT's independent review of `301baf85e1` (`issuecomment-6545572507`) found two fail-closed defects
that blocked scoped acceptance. Both are fixed here; nothing else in the pack was re-architected,
and no owner source was touched.

### 9.1 P0-A7-01 — O4 accepted the absence of a duplicate *claim*

The old rule was `if not resettle.duplicate and resettle.paid: FAIL`. It accepted
`{"duplicate": false, "paid": false}` — a record that never claimed a refusal at all. Corrected
contract, all of it mandatory:

| requirement | rejection code | verdict |
|---|---|---|
| a funded first settlement (`ok=true`, reason not `nothing_to_settle`/empty) | `NOTHING_TO_SETTLE` | FAIL |
| a non-empty receipt identity on that settlement | `BLOCKED_MISSING_RECEIPT_IDENTITY` | BLOCKED |
| a countable grant equal to **exactly one** output | `BLOCKED_MISSING_GRANT_DETAIL` / `WRONG_GRANT_COUNT` | BLOCKED / FAIL |
| the first settlement is not itself a duplicate | `FIRST_SETTLEMENT_WAS_A_DUPLICATE` | FAIL |
| a custody line that agrees (`ingots=1 parts=0`) when one exists | `CUSTODY_MISMATCH` | FAIL |
| a second attempt **explicitly** `duplicate=true` | `NO_DUPLICATE_REFUSAL` | FAIL |
| …and `paid=false` where the field exists, plus zero regranted output | `SECOND_PAYOUT` | FAIL |
| …naming the **same** receipt identity as the paid one | `RECEIPT_IDENTITY_MISMATCH` / `BLOCKED_MISSING_RECEIPT_IDENTITY` | FAIL / BLOCKED |

A log marker alone can no longer manufacture custody proof: `applied` / `operations` are read from
A0's real host receipt shape (`a0_offline_host.gd:167–190`), and an uncountable receipt is BLOCKED,
never PASS.

### 9.2 P0-A7-02 — O1 crashed on a half pair instead of blocking

`CT_BOOTSTRAP_READER_AFTER` present with no `CT_BOOTSTRAP_BEFORE` used to dereference a missing
match and raise (the runner caught it as `ORACLE_CRASHED`, which could read as "untested").
Now: a half pair returns **`BLOCKED_MISSING_BOOTSTRAP_CONTROL`** with the missing half named, and
a genuine refusal *after* a real bootstrap returns **`FAIL A1_SOURCE_CONTRACT`** — harness setup
and A1 source are now distinguishable in the code, not in the prose.

### 9.3 Scope corrections CT required, now enforced in code

* **O5 is a non-blank gate, not an art verdict.** Code renamed `FRAMES_HAVE_CONTENT` →
  `NONBLANK_FRAMES_ONLY`; measurements carry `visual_quality: NOT_GRADED` and
  `scope: nonblank_gate_only`. No report may cite this PASS as visual acceptance.
* **O6 distinguishes historical from current.** `workflow_pin_policy.json` declares six frozen
  workflows (each with the wording in its own `name:` as the reason); **anything undeclared is
  CURRENT and is held to the live pins** — the default fails closed. A tree with only historical
  workflows returns `BLOCKED_NO_CURRENT_WORKFLOW` rather than a quiet PASS.
* **The two P0s above were the only contract changes.** O2/O3 remain evidence gates: they judge
  what a run *reported*, not live native implementation.

### 9.4 Baseline re-run after the correction

Same frozen tree `fbe5438381`, same round-14 evidence, now with the pin policy:

| oracle | verdict | code | note |
|---|---|---|---|
| O1 | **BLOCKED** | `BLOCKED_NO_BOOTSTRAP_EVIDENCE` | unchanged in substance, no longer able to crash |
| O2 | **FAIL** | `SIDECAR_WORLD` | A0, source-contract |
| O3 | **BLOCKED** | `BLOCKED_NO_PHYSICAL_EVIDENCE` | 33 assertions, none about entering a site |
| O4 | **FAIL** | `FREED_GUI_NODE` | A0; the exactly-once branch is never even reached |
| O5 | **PASS** | `NONBLANK_FRAMES_ONLY` | non-blank only; **visual quality NOT_GRADED** |
| O6 | **FAIL** | `STALE_PIN` | **3** stale pins in the **one** CURRENT workflow (`a0-connected-journey.yml`: A1 `8551a323` vs `a030cb89`, A6 `6d71410a` vs `6d1e8bce`, A8 `06d1758e` vs `0f885df8`); six historical workflows labelled, not forgiven |

Machine output: `data/survival/balance/oracles/a7_oracle_pack.r13.v2.json`. The v1 file is kept as
history and is **superseded** — it contains the O4 acceptance defect CT found.

### 9.5 What this does and does not establish

* **Establishes:** the pack now refuses every old false-green shape, demonstrated by 31 synthetic
  controls that assert codes, plus two real journey logs failing with different codes and real
  frames passing the non-blank gate.
* **Does not establish:** that the product works. The baseline is still `FAIL`; O2/O4/O6 belong to
  A0, and O1/O3 are missing evidence rather than results.

**Status: `ACCEPT_SCOPED_ORACLE` — the oracle contract is closed. `PAUSE_DEPENDENCY` until A0
publishes a NEW composed production tree** whose recomputed `write-tree` equals its declared SHA.
No merge, no other-owner edits, no invented player PASS.
