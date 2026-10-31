# Round 10 — the current-head audit: one hash, one player path, and what is not there

_Executed 2026-10-31 against compositions `1d39e92e75d8` (`r10_full`),
`acb955c71744` (`r10_core`) and `edbe909f6834` (`r10_a0`), with the real engine
built from `godotengine/godot@4.7-stable` (`4.7.stable.custom_build`, editor
target, headless, scons). Ledger row for row:
`data/survival/balance/results/native_runs.v1.json`, written by
`python3 tools/survival/balance/run_native.py --composition refs/comp/r10_full --write`.
Logs (hashed into the ledger) are in `.artifacts/native_runs/1d39e92e75d8/`.
Round 8 and round 9 ledgers are untouched; round 9's payload is preserved byte for
byte as `native_runs.r9_full.v1.json`._

Round 10 exists because CT asked two questions that a fixture count cannot answer:
**is A0's new profile port on the ordinary player path**, and **can a new player
actually play any of the four rehearsed journeys**. Both are answered below by
measurement at the current owner bytes, including the two things CT warned about:

* the old claim "A0 has no run record or profile port" is **obsolete as a source
  claim** — the port exists, and this round drives it for real (§5, §6);
* the old placement-HUD/ClickBlocker theory is **not repeated** — round 9 retracted
  it and no probe here re-tests it.

## 1. The composition, exactly

`tools/survival/balance/compose.py` builds an immutable commit from live owner
refs; no owner file is edited to build one. Round 10 adds the `r10_*` profiles and
repoints A6 at its **active** branch (`arena/05e0328d`), not the old PR24
`63d3fae5`.

| profile | commit | files | base | overlays |
|---|---|---|---|---|
| `r10_a0` | `edbe909f6834` | 5154 | A0 `84ac9c1a` | — |
| `r10_core` | `acb955c71744` | 5433 | A0 `84ac9c1a` | A1, A3 |
| **`r10_full`** | **`1d39e92e75d8`** | **5511** | A0 `84ac9c1a` | A1, A3, A6, A8 |

Sources, exact: A0 `refs/live/arena-dea2428e` `84ac9c1a` · A1
`refs/live/arena-e385312a` `439d5ef1` · A3 `refs/live/arena-7a12b27e` `35214ed8` ·
A6 `refs/live/arena-05e0328d` `3fa646cb` · A8 `refs/live/arena-2d7e6d7a` `3a7ab461` ·
CT `refs/live/feature-survival-rpg-foundation` `257a248f` ·
AVFX `refs/live/arena-c7b0c4e8` (provenance only, not composed).

Replace-vs-merge, stated as the rule that produced the tree:

| prefix | owner | mode |
|---|---|---|
| `data/survival/world/` | A1 | replace |
| `data/survival/items/`, `data/survival/recipes/`, `data/survival/economy/`, `game/survival/economy/` | A3 | replace |
| `game/survival/ui/` | A6 | replace |
| `game/survival/world_content/`, `data/survival/world_content/` | A8 | replace |
| everything else | A0 base | never overlaid |

`data/survival/balance/results/compositions.v1.json` now carries nine rows: the
round-8 and round-9 rows exactly as they were pinned, and the three round-10 rows
beside them. No historical row was rewritten.

`r10_a0` is new in this round and it is the reason §3 exists: it is **A0's own
bytes alone**, which is the tree A0's own CI actually runs.

## 2. Result at a glance

| verdict | count | meaning |
|---|---|---|
| PASS | 3 | executed and asserted on these bytes |
| FAIL | 3 | implemented and violated — a real defect with an owner |
| BLOCKED | 1 | genuinely unmeasurable here, cause named |
| RED_NOT_IMPLEMENTED | 1 | the journey has no door to walk through |

| probe | verdict | checks | what it established |
|---|---|---|---|
| `r10_seam_probe` | FAIL | 23, 6 failed | the fence conflict, the null session, and four port boundaries with zero production callers |
| `r10_port_lifecycle_probe` | FAIL | 20, 1 failed | one run, one wallet, a closed commit boundary — and a deposit that is accepted after the run expired |
| `r10_v7_custody_probe` | PASS | 16 | V7 custody driven through A0's real port, including the `hero_cell` trust boundary |
| `r10_waystation_probe` | BLOCKED | 5 | the forced Waystation refuses to mount because the economy session is null |
| `r10_restart_probe` | PASS | 13 | a paid structure, a wallet receipt and the run record survive a genuine second OS process |
| `r10_a8_differential_probe` | PASS | 8 | A8's mover versus the production Hero, quantified, and the Mill's gate data |
| `r10_a6_projection_probe` | FAIL | 5, 1 failed | A6 mounts and shows nothing, because no owner publishes anything |
| `r10_journey_probe` | RED_NOT_IMPLEMENTED | 10, 8 missing | the four CT journeys, clause by clause, with the exact missing symbol |

The same eight probes were re-run on `r10_a0` and `r10_core` where the question
changes meaning, and those runs are quoted in §3, §5 and §6.

## 3. The headline: it is **one item in one file**, and it is A0's pin versus A3's bytes

This is the sharpest result of the round, because it is now attributable rather
than argued.

| composition | `V5_PINS.verify()` | `economy_session` | Waystation candidate |
|---|---|---|---|
| `r10_a0` (A0 alone) | `""` — clean, `drifted_pins=[]` | **non-null** (`survival_build=present`, `build_error=""`) | refuses (A3 absent) |
| `r10_core` (A0+A1+A3) | `a3_data_pin_mismatch:res://data/survival/items/items.json` | **null** | refuses |
| `r10_full` | same | **null** | `Waystation candidate requires the A3 economy session` |

The hashes, recomputed on current bytes:

* A0's fence `game/survival/economy/a0_v5_source_pins.gd` pins
  `res://data/survival/items/items.json` = `cc3c11659fc191529fb56e6a50a1bd27a29f091e2857e2f4d7b7e7d993e15a4a`;
* A3's own bytes for the same path are
  `cd1a27c48078a69489904e86182dc63750941d9fc296830f711dd5d574615520`;
* the difference is **exactly one item**: `ragnarok_unbanked` (A0 56 items, A3 57;
  0 items changed, 0 removed). `sources.json` is identical (`bc88143e…`) and A0's
  other six data pins and three script pins all match.

So the survival economy is not "unimplemented": A0 alone configures it, the
session is non-null, and A3's catalogue loads 36 recipes in a bare service. It is
**switched off by one stale hash the moment A3 is composed**, which is why a
player — who always gets the composed product — never sees it. This is a
single-file, single-item, single-hash conflict, and it is owner fix #1.

## 4. The new A0 profile port: what it is, and where it is not

The file `game/survival/economy/a0_profile_port.gd` exists at `84ac9c1a` and is
well formed (`soh.economy.a0_profile_port.v1`): `run_context`, `endpoint_authority`,
`source_authority`, `read_profile`, `apply_profile_delta`, `ensure_run`,
`commit_meta_deposit`, `commit_profile_delta`. The question CT asked is not whether
it exists but whether a player's game can reach it, and the answer is measured in
three states:

| state | measurement |
|---|---|
| `SOURCE_PRESENT` | yes — declared and instanceable |
| `REACHABLE` | **no** — `configure_meta_profile_port`, `ensure_run`, `commit_meta_deposit` and the filename `a0_profile_port.gd` each have **0 callers anywhere in `game/`** |
| `EXERCISED` | yes — this round drove it against the real `SaveService` (§5, §6) |

The only non-test exerciser in the tree is `tests/survival_a0_profile_port_test.gd`
plus `.github/workflows/a0-production-waystation-candidate.yml` (which wires
`RUN_MAX_SECONDS := 1209600`, endpoints `preservation_kiosk_01` /
`vending_kiosk_01` / `recycler_01`, POI `poi_crown_waystation`). That is a guarded
candidate, not the ordinary path.

Consequence, stated as one line: **the port is real, the wiring is absent.** A0's
CI can be green on it and a player can still never touch it. Both are true at the
same SHA, which is exactly the distinction CT asked for.

## 5. The run: one run, one wallet, a closed door — and one hole

`r10_port_lifecycle_probe`, 20 checks, 1 failed:

* `ensure_run(1209600)` returns the **same** `run_id` on a second call
  (`run-1793417487-0` both times) — no second wallet;
* the run record is durable (`profile.run{run_id, run_epoch,
  run_started_at_unix, max_seconds, expires_at_unix}`), and `run_context()` reports
  `status=active` with `expires_at_unix = start + 1209600`;
* `apply_profile_delta` is refused outside the commit boundary
  (`a0_profile_commit_boundary_absent`), and receipts are idempotent
  (`already_applied` on replay);
* **FAIL — `commit_profile_delta` accepts a deposit after `run_context().status ==
  "expired"`** (`ok=true`, `balance=10`). The port enforces expiry on the *clock*
  it reports and not on the *write*. `elapsed` at the 336 h bound against the
  950 400 s finale was measured at `0` versus `950400 s` remaining, so the boundary
  itself is right; only the refusal is missing.

That single acceptance is what turns "the run expires" from a rule into a display:
a player past expiry can still bank. Owner fix #3.

## 6. V7 custody: real, and enforced through A0's own door

`r10_v7_custody_probe` PASS — 16 checks, 0 failed — on **both** `r10_core` and
`r10_full`, so nothing in it depends on A6 or A8. It mounts the production world so
`hero_cell=(56,218)` is a real cell, and then:

* a purchase refuses because the deposit cannot be committed
  (`endpoint_not_visited_or_offline` fires **before** the stand-cell rule, so a
  lying `hero_cell` alone is not sufficient — the ordering was measured, not
  assumed);
* recycling needs `item_id` and a positive `profile_delta`, and refuses by name;
* a premature Ragnarok claim is refused (`premature_ragnarok_claim`);
* a forged hour-264 context yields `source_not_openable`;
* two deposits with distinct receipts behave, and a duplicate receipt is
  `already_applied`.

With `r10_restart_probe` (13 checks): a paid structure, four receipts, `oak_wood
38`, `balance 4` and the run record are all read back by a **second OS process**
(`pid 15903`).

## 7. A8 current red: four root causes, three of them A8's, one of them the test's

CT's report (`41113688323`) is reproduced at `3a7ab461` by running A8's own suites
headless in an A8 worktree (logs: `.artifacts/a8red/`):

| suite | result |
|---|---|
| `native_poi_surface_contract_test` | PASS (`exit 0`) |
| `native_poi_contract_test` | 12 failures / 379 assertions |
| `native_poi_transition_test` | 2 / 324 |
| `native_poi_input_journey_test` | 22 / 57 |
| `native_poi_ragnarok_test` | 1 / 208 |

**7.1 — Doorway entry always rejected: an Array type comparison (A8 defect).**
`game/survival/world_content/scripts/poi_pilot.gd:242` compares
`return_anchor.get("canonical_cell", [])` (JSON floats) with
`[shell_cell.x, shell_cell.y]` (ints from `Vector2i`). In Godot 4.7 scalar
`30 == 30.0` is true but **`[30, 280] == [30.0, 280.0]` is false** (measured:
`A7DIAG2 array_eq=false`). So every entry prints "The exterior return point was
rejected.", 7 journeys lose their 3 doorway assertions each (21), and the capture
count adds the 22nd. One-line fix in A8's own file (compare `Vector2i`s, or
`int()` both sides). This is **not** a faulty test expectation: the journey's
expectation ("the doorway mounts the worksite") is the product contract.

**7.2 — The Mill can never be repaired: readiness has no producer (A8 defect).**
`repair_waterwheel` and `recover_fastener` are `owner_ready_required: true`, so
`native_poi_site.gd:519-524` requires `projection.ready_actions` to contain the
action id. The fixture can only fill `ready_actions` from `unlock_at`
(`poi_authority_fixture.gd:115-123`), which is only filled from `unlock_actions` —
and A8's own fixture catalogue gives **every mill action `unlock_actions: {}`**
(the orchard, by contrast, ships `clear_irrigation → {read_water_marks: 20.0}`, which
is why the orchard journeys reach their actions). Measured directly:
`repair attempt pos=(528.0, 410.0) ready=[] caps=["cap_salvage"]` ⇒ "The owner has
not projected this action as ready." Nine contract failures and both transition
failures cascade from this one line of data.

**7.3 — The closed inner gate does not block (A8 defect, physical).**
The Mill's second gate is `requires_state_values: {mill_wheel: [turning]}` at rect
`[488, 314, 76, 14]` with `retreat_one_way: true`. With `mill_wheel: seized`, the
site reports `_gate_is_blocked(gates[1]) == true`, and yet the real actor walked
**410 → 250** straight through the rect with `collision=null`. The leave branch then
ends at `y=538`, so `try_exit` fails ("safe no-repair branch keeps the return
doorway usable") and the final retreat assertion fails. Three failures, one cause:
a "closed" one-way gate that is transparent to an upward walk. This is the
"retreat" half of CT's Mill item and it is a physical hole, not an expectation.

**7.4 — The Ragnarok negative claim is a stale test (A8's test is wrong).**
`native_poi_ragnarok_test.gd:427` asserts
`a0_production_receipt_or_save_grant == "NOT_INTEGRATED"`. The data at
`data/survival/world_content/ordinary_waystation_opportunity.v1.json:275` says
`A0_PR21_GUARDED_CANDIDATE_COMPOSES_A3_WORLD_ACTION_WITH_A0_SAVESERVICE; …`, and
A8's own Python authoring contract asserts exactly that
(`test_ragnarok_authoring_contracts.py:168`, and all 29 Python tests pass on this
head). The data and the Python test moved; this one GDScript assertion did not.
Correct expectation: the string contains `A0_PR21_GUARDED_CANDIDATE`, not
`NOT_INTEGRATED`.

**What A7 does not claim.** No A8 file was edited. `r10_a8_differential_probe`
(PASS, 8 checks) quantifies the mover difference instead of arguing it: the
production Hero is a `RectangleShape2D` body with `mask=5` and one motion per step,
A8's actor is a `CircleShape2D r=10` with `mask=1` and a single `move_and_collide`;
same wall, same frames — Hero `dy=-95.73`, A8 actor `dy=-9.77`. Route claims
transfer as geometry, not as movement.

## 8. A6: mounted, correct, and blind

`r10_a6_projection_probe` mounts the return layer on the composition
(`a6_layer_mounted=true`, 1 child) and reads all five owner projections it is
allowed to show: `season_clock`, `run_facts`, `return_digest`, `site_cue`,
`run_history` — **all `empty`**, `projections_with_data=0 of 5`. A static check of
`game/` finds **0 of 12** candidate methods A6 would call. So:

* the A6 *layer* is mounted and does not invent anything (that negative holds);
* no owner publishes what A6 needs, so every card sits in its `unavailable` state;
* the avatar clause is `A6_SOURCE_UNAVAILABLE` by name: the manifest says
  `PRIVATE_RUNTIME_STAGING_REQUIRED` and *"No source sprites are included in Git"*,
  **0** sprite files are staged, and **0** files in `game/` call
  `avatar_sprite_pipeline.gd`. The Hero a player actually sees is A0's own
  `Player/Sprite=AnimatedSprite2D(34 anims)` — A6's selected avatar never reaches it.

`VISUAL_NOT_REVIEWED`: headless, no frame was rasterised, so none of this is a
statement about how anything looks.

## 9. The journeys, clause by clause

`r10_journey_probe` on `r10_full`: 10 checks, 0 failed, **8 missing** ⇒
`RED_NOT_IMPLEMENTED`. Each gate is stated as a `MISSING` line with its exact
symbol, and the assertions that *could* be measured all passed.

| gate | verdict | measured basis |
|---|---|---|
| **J01** A0 first hour + A6 avatar + A1 broader spawn | **RED** (`A6_SOURCE_UNAVAILABLE`) | Hero spawns collidable with A0's own sprite; 2 of 4 directions walkable from `(56,218)`; real keys move the Hero (`(56,218) → east`); one real click = one SaveService receipt (measured by `r10_restart_probe`: 4 receipts, `oak_wood 38`). Avatar unavailable as above. |
| **J02** Core cast/store/research + authentic AVFX | **RED** + `GOLD_WAIT` | the `research` *station kind* and its recipe table exist; **no** `cast_core`/`core_cast` API exists under `game/`; AVFX is a separate branch not in this composition ⇒ `GOLD_WAIT`, not silence |
| **J03** one funded job, offline, settled once | **RED** | `economy_session=null` (the fence in §3) closes the door before Gold; A3's 36 recipes load in a bare service but no player can queue one; A6's `run_facts/return_digest/run_history` are all `empty`, so nothing could display the result |
| **J04/J05** A8 POI + A3-approved source + retreat + hazard/death bag | **RED** | **0 of 15** sources and endpoints in A3's own policy are approved (all `OWNER_CONTRACT_CANDIDATE_A1_A8`/`_A8`); A8's retreat is the §7.3 hole; **0** `take_damage`/`apply_damage`/`health -=` hits in `game/survival/`; **0** knife implementations outside `combat_audio_router.gd`; the death bag exists (`survival_death_bag.gd`) and the bed exists (`survival_service.activate_bed`, requiring a `bed_wood` piece) but nothing can kill the player to produce either |
| **J06/J07** late chest + kiosk deposit + 336 h reset + one wallet | **RED** | all 4 composed ragnarok endpoints are `A1_REVIEW_REQUIRED_SOCKET_NOT_CANONICAL` and `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`; `commit_meta_deposit` has **0** callers; `ensure_run` is idempotent (same `run_id`) and the run expires, but the expiry write is the §5 hole |
| **PLAYER_RETURN_S1** | **PARTIAL_WITH_BLOCKERS** | avatar `A6_SOURCE_UNAVAILABLE`; paid home **PASS**; three caches **BLOCKED** (A3 settlement needs the session); A6 return UI **RED**; continuation/claim **RED**; visual **VISUAL_NOT_REVIEWED** |
| **PLAYER_POI_S1** (secondary) | **BLOCKED** | A8's own red (§7) precedes it; the differential is quantified in §7 but no journey claim is made |

## 10. Gameplay-missing gate report

Measured against **player action**, not inferred from a catalogue or a document.

| gate | verdict | what is actually there / missing |
|---|---|---|
| ordinary knife / real threat | **RED_NOT_IMPLEMENTED** | no knife item, no melee swing, no damage API in `game/survival/` |
| Core USE / STORE / RESEARCH + AVFX cast & charge | **RED_NOT_IMPLEMENTED** (+ `GOLD_WAIT` for FX) | research station kind + recipes; no cast/charge, no AVFX in composition |
| hazards / weather | **RED_NOT_IMPLEMENTED** | A8's surface contract reports `"weather": "UNKNOWN"` and owns no global weather; no hazard applies damage |
| 336 h / last-72 h physical bank & evac | **RED_NOT_IMPLEMENTED** | 4 endpoints exist as data, all `NOT_CANONICAL`; no deposit caller; expiry not enforced on write |
| run-local starter chain (D057) | **PASS (A0 scope)** | profile → home → paid door → harvest → workbench, with a real 2-PID restart (`r10_restart_probe`) — but **without** A3 crafting, which is §3 |
| D071 cargo / pets | **NOT_TESTED** | no cargo and no pet code exists in the composed tree to test against |
| 2K/4K actual screenshots, human look | **NOT_TESTED** | headless; nothing was rasterised |
| fun / pacing judgement | **NOT_TESTED** | not a machine-verifiable claim, and no human ran it |

## 11. Nine gates, binary

| gate | statement | verdict |
|---|---|---|
| G1 | the shipped overworld builds and boots under its shipped `project.godot` | **PASS** |
| G2 | a player can harvest and place a structure for exactly its cost | **PASS** |
| G3 | a committed action survives a genuine second OS process | **PASS** |
| G4 | a player has the survival economy (crafting + meta actions) | **FAIL** — `economy_session=null` once A3 is composed |
| G5 | A0's profile port is reachable from the ordinary player path | **FAIL** — 0 production callers |
| G6 | an expired run refuses further mutation | **FAIL** — deposit accepted after `status=expired` |
| G7 | A6 shows the return state the run actually produced | **FAIL** — all 5 projections `empty` |
| G8 | A8's POIs are playable (approved source, retreat, doorway) | **FAIL** — candidates only, plus §7.1/§7.2/§7.3 |
| G9 | the late-72 h bank/evac exists as a physical player action | **FAIL** — endpoints `NOT_CANONICAL`, no deposit caller |

## 12. R0–R5

| level | state |
|---|---|
| **R0** compiles and boots | **yes** — real Godot 4.7 on three pinned compositions, 8 round-10 probes plus A8's five suites |
| **R1** the journey runs | **partly** — first hour, harvest, paid build, restart; no crafting, no POI, no death |
| **R2** the run exists | **yes in source and on the port's own door, no for a player** — `ensure_run`/`run_context` work when driven, 0 production callers |
| **R3** the finale exists | **no** — endpoints are authored plans, not native sockets |
| **R4** the two economies hold | **no** — V7 custody is proven (16/16) and unreachable (0 callers, expired-write hole) |
| **R5** the 14-day experience is coherent | **no** — gated on R2–R4 |

## 13. Owner corrections, ranked

1. **A0 — re-pin one hash, in the open.** `a0_v5_source_pins.DATA["res://data/survival/items/items.json"]`
   `cc3c1165… → cd1a27c4…`, with A3's approval reference recorded in the fence.
   One item (`ragnarok_unbanked`) is the whole difference. This single line turns
   on crafting, the meta economy and the Waystation candidate. *Impact: G4, J03,
   PLAYER_RETURN_S1 caches.* Nothing else in this round unlocks as much.
2. **A0 — wire the port it already owns.** Call `configure_meta_profile_port` and
   `ensure_run` from the composition root (the same place that builds the
   `EconomySession`), and make `commit_profile_delta`/`commit_meta_deposit` refuse
   when `run_context().status == "expired"`. *Impact: G5, G6, J06/J07, and every
   14-day consequence.*
3. **A6 — publish five projections and stage the avatar, or say it cannot.** The
   return layer is mounted and honest; it is blind because `game/` declares 0 of 12
   candidate producers. Stage the D051–D054 sprite bytes privately and call
   `avatar_sprite_pipeline.gd` from the character-select path. *Impact: G7, J01
   avatar, `A6_SOURCE_UNAVAILABLE`.*
4. **A8 — three defects with exact repairs** (§7.1 `poi_pilot.gd:242` int/float
   Array compare; §7.2 mill `unlock_actions`/`ready_actions` producer; §7.3
   `retreat_one_way` gate transparency) and one stale assertion to correct
   (§7.4 `native_poi_ragnarok_test.gd:427`). *Impact: 37 of A8's 37 current
   failures, G8, J04/J05.*
5. **A1/A3/A8 — promote one real socket.** Approve at least one
   `preservation_kiosk_01` / `endpoint.ragnarok.deposit` pair to
   `APPROVED` and place it on a canonical A1 cell; today all 15 are candidates and
   4 endpoints are `NOT_CANONICAL`. *Impact: G9, J06/J07.*
6. **A0 — a damage source and a knife, or withdraw the promise.** `game/survival/`
   has no damage path at all, while the death bag and the bed already exist.
   *Impact: J04/J05's "same death bag and bed" cannot be attempted.*

## 14. What the player can actually do on `1d39e92e75d8`

| The player can | The player cannot |
|---|---|
| boot, load a save, walk the overworld with real input, gather and build for exact cost | craft, forge, research or bank anything — the economy session never configures |
| see a Hero with A0's own 34-animation sprite and a camera that follows | choose or see an A6 avatar (`A6_SOURCE_UNAVAILABLE`) |
| place a paid structure and find it intact after quitting and relaunching the game (second OS process, verified) | see a run clock, a season, an expiry, or any consequence of a restart being a *new* run — the port exists and nothing calls it |
| harvest, hold a bag, reach a bed and a death-bag root in the world | be hurt, die, be fought, or lose a bag: no damage source exists in `game/survival/` |
| enter an A8 POI exterior in A8's own pilot | enter one as a player: the doorway request is rejected at `poi_pilot.gd:242`, and the Mill cannot be repaired |
| see A6's return layer mount | see a single number on it — all five projections are empty |

What is real at the end of round 10: three immutable compositions at current owner
bytes, eight independently executed Godot 4.7 probes plus A8's five suites, a
one-hash/one-item diagnosis that replaces a two-round-old guess, an attribution
method (`r10_a0`) that separates a base defect from a composition artefact, four A8
root causes with file:line repairs, and a journey ledger that says RED per clause
instead of PASS per fixture.
