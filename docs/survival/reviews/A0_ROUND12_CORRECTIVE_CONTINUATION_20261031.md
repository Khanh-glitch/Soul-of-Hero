# A0 Round 12 — corrective continuation: from fixtures to one normal-input journey

SHA at time of writing: `c3c2321e` + the round-12 corrective set on branch
`arena/dea2428e-soul-of-hero` (draft PR #21, never self-merged).
Composition pinned for execution: A1 `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`,
A3 `b44e22df3af40939069189be14afc23ee1ce21c4`, A6 `6d71410a370df805f8b29a018b61380d6c233b65`,
A8 `06d1758e2cf7e44c588d158745359d7617fe32d6`.
Engine: Godot `4.7.stable.custom_build`, headless for logic, `xvfb-run` + GL compatibility for
pointer/window runs.

Hosted CI logs are **not downloadable** from this sandbox (`gh run view --log`,
`--log-failed`, `gh run download` all return `EOF`; the results blob host is outside the
network allowlist). Every hosted number below is therefore taken from the job **annotations**
the workflow itself publishes, and every local number from a log path named next to it.

---

## 1. The acceptance problem this round had to fix

`tests/survival_a0_player_return_test.gd` proves a lot — 26 checks over the one
`SaveService`: tool instance, harvest grant, receipt, replay refusal, restart idempotency —
but it does it with `hero.global_position = …`, `node.interact(hero)` and direct
`queue_recipe`/`collect` calls. That is a **component/transaction probe**, not a player
journey, and it was previously counted as one.

Actions taken:

* the file keeps every check and is now labelled in its header and in its own PASS banner
  (`A0 PLAYER COMPONENT PROBE PASSED - 26 checks (teleport + direct interact; NOT a player journey)`);
* a **new** gate `tests/survival_normal_connected_journey_test.gd` carries the journey,
  extending the proven gather→bench→cloth prefix and continuing it into the furnace half.
  It is forbidden from teleporting, from calling gameplay methods in place of input, and
  from granting items, stations, keys or rewards;
* the gate is **falsifiable** — and it falsified itself eight times, which is the subject of
  the next section.

Two things make the gate honest by construction:

* a run without `DisplayServer.FEATURE_MOUSE` (headless) prints
  `A0 CONNECTED NOT_TESTED - this environment exposes no mouse feature…` and exits 0, so a
  headless environment can never be mistaken for a pass;
* the workflow requires the literal banner `A0 CONNECTED SURVIVAL JOURNEY PASSED` from the
  second process, not just exit codes, so `NOT_TESTED` cannot read as green in CI either.

---

## 2. Eight ways the previous "green" was not playing

Each row was a real defect in the gate (or in what the gate believed about the product),
found by executing the new journey in the composition at 1280×720 with a real pointer.

| # | Defect | Effect | Fix |
| - | ------ | ------ | --- |
| 1 | The audit file and the save document were the **same path** (`user://tests/a0_connected_journey.json`) | Process 2 "read the audit" from the save it had just loaded; run id, furnace id and job id all came back empty, so the second process failed four checks for the wrong reason | the audit has its own path; the play phase deletes a stale one; continuation fields are flattened to the top level |
| 2 | Collect controls were matched against `text == "Collect"` | the panel renders `COLLECT`, so two real collection steps reported false failures | case-insensitive comparison in prefix and continuation |
| 3 | Job rows were read as `row.get_child(0) as Label` | a job row is `[progress bar, words, action]`, so the label was never found and the cloth/output collection controls were never located | `_row_label()` searches the row for its Label |
| 4 | A recipe row was matched by the **output item** name (`iron ingot`) | the panel names the row after the recipe the station resolved (`smelt iron`), so the row was never found | rows are matched by the recipe words the panel prints |
| 5 | The continuation priced its craft but not its **inputs** | kit eats 8 stone + 3 scrap, charcoal needs 2 oak, the smelt needs 3 more scrap: the sequence could never reach the fuelled queue | one trip gathers 8 stone, 2 oak, 6 scrap before anything is spent |
| 6 | The player walked **to the placed furnace cell** | that cell is now occupied by the furnace; "reach the station" could never succeed | the player walks at the station with directional input until it is within `SurvivalStructure.REACH`, and a failure reports the distance it stopped at |
| 7 | The panel was opened with a blind `C` press | a blind press closes a panel that is already open, so the furnace recipe list could be read while closed | `_open_panel()` / `_close_panel()` are idempotent and each step states which it wants |
| 8 | A long list opened earlier keeps a stale row layout | scrolling to a recipe row could never succeed and the row was called missing | `_scroll_recipe()` wheels to the row and, if it stays out of view, closes and reopens the panel and re-finds the row in the rebuilt list |

Rows 1–3 were the reason the *previous* hosted run "passed" the prefix and then failed the
relaunch; rows 4–8 are why the continuation never reached the paid work.

---

## 3. What the journey proves today (hosted, 1280×720, real pointer)

Run `41182037977` / `41182699109` / `41183204402` / `41184627637` annotations:

```
A0_CONNECTED prefix_complete=true checks=29 failures=0
```

That prefix is the whole first hour, through ordinary input only (fresh profile, no grants):

1. fresh spawn → walk → click scrap, oak, stone, reeds;
2. `C` opens the panel, wheel reaches the starter kit, click queues it, active gameplay
   completes it, click collects it;
3. `B` selects the workbench, the pointer places it, the kit is paid;
4. walk to the bench, wheel to `weave cloth`, queue, complete, collect the cloth;
5. wall-clock gathering for the furnace's own inputs (8 stone, 2 oak, 6 scrap);
6. `furnace_kit` queued and collected through the GUI;
7. `station_furnace` placed with the build pointer, kit paid, station registered on a cell;
8. the player walks up to the furnace it built.

Where it currently stops, and the last observed reasons:

```
FAIL  the physical furnace offers its own charcoal recipe
```

Two distinct causes were found for the furnace step, one product and one harness:

* **Product (A0/A3 station window mismatch).** `economy_session.nearby_stations()`
  (`game/survival/economy/economy_session.gd:565-582`) lists a station only when the hero is
  within **64 px of `structure.global_position + Vector2(16, 16)`**, i.e. the centre of the
  footprint, while A0 lets the player work a station within `SurvivalStructure.REACH` (**44 px**)
  of the origin cell. For the 2×2 furnace those two windows disagree, so a player at a legal
  interaction distance can be standing next to a furnace the panel does not consider nearby and
  see no furnace recipes at all. The journey now walks up close enough that both windows agree
  and asserts `the panel counts the built furnace as a nearby station` before asking for recipes.
* **Harness (screen-space scrolling).** Bringing a recipe row into view failed with a fixed
  handful of wheel clicks, and the reopen fallback reused the freed button node, turning a flake
  into a false "row is missing". The gate now wheels in the row's direction until the row is
  inside the viewport or the list stops moving, re-finds the row by name after a rebuild, and
  prints `A0_CONNECTED_SCROLL row=… offset=… viewport=… row_center=…` so the next run states the
  offset it stopped at instead of only that the row was "missing". A hosted run at `757359cb`
  still fails at this step, so the step remains unclaimed.

`tools/probe` (local, headless) shows the placed piece resolves as
`station_kind=furnace, station_tier=1, queue_capacity=3`, and A3's own `recipes.json` at
`b44e22df` has `burn_charcoal` (2 oak → 2 charcoal, 8 ticks, station `furnace`) and
`smelt_iron` (3 scrap + 1 charcoal fuel → 1 ingot, 12 ticks, station `furnace`). So the
recipe is authored and the station is real; what is still unproven is that the panel lists it
at that station for that player. The gate prints a full dump
(`A0_CONNECTED_PANEL open=… recipes=… stations=… buttons=…`) whenever it fails to find the
row, and CI promotes that dump to an error annotation.

The step is intermittent rather than absent: the same build reached the furnace and the recipe
lookup in some runs and reported the row missing in others, which is exactly why it is not
claimed. A hosted run that prints `A0_CONNECTED_PANEL open=true … buttons=[Recipe_burn_charcoal_…]`
and then completes the fuelled queue is the bar for claiming it.

**Verdict for the connected journey: FAIL (not yet a completed journey).** Everything up to
and including a physically placed, paid furnace passes; the fuelled work, the departure, the
independent relaunch and the offline settlement are written and executed but not yet green, so
they are **not** claimed.

---

## 4. Departure / offline homecoming surface (written, partially proven)

* `economy_session.prepare_work_away(station_id := "")` arms exactly the jobs that are
  `queued|running` (and, when given, at that station) through A3's own
  `arm_offline_operation`; nothing is re-implemented, nothing is granted. Duplicates report
  `already_prepared`; an empty queue reports `nothing_in_progress`.
* `economy_session.prepared_work()` is a read-only projection of `offline_operation_state`.
* `chapter1_overworld.PREPARE_WORK_ACTION` is bound to physical `KEY_P`, and
  `chapter1_overworld.depart_world(now_unix := -1)` settles, prepares and re-stamps through
  `economy_composition._offline`.
* `depart_world()` now **flushes the one SaveService** (`report.persisted`) before returning,
  and `NOTIFICATION_WM_CLOSE_REQUEST` calls it. Closing the window is a normal exit and can no
  longer be the event that loses the paid furnace.
* The second process is proven to *load the same run*: hosted DIAG lines show
  `path=user://tests/a0_connected_journey.json exists=true size=16373 run_id=run-… state=active`
  in process 1 and the identical run id in process 2's `phase_state=active`.
* The offline settlement itself currently reports
  `{"ok":true,"reason":"nothing_to_settle"}` in the relaunch, which is correct and expected
  while the smelt is never queued: **no offline operation has been paid for yet, so nothing is
  settled.** No settlement result is claimed.

---

## 5. Threat / death measurement (corrected, still not lethal)

`tests/survival_a0_production_threat_test.gd` no longer reports the bogus `damage_per_hit`
denominator. It now sums the real per-hit decrements:

```
A0_THREAT_LETHALITY {"damage_observed":70,"damage_per_hit":14,"enemy_attack_range":38.0,
 "enemy_contact_damage":14,"enemy_disengaged":true,"hits":5,"hp_after":1016,"hp_before":1100,
 "max_health":1086,"player_pool_max":1100,"site_cell":[82,227]}
```

5 landed hits × 14 = 70 observed damage against a 1100 pool: the previous `damage_per_hit = 17`
was `hp_before - last_hp` over `hits`, i.e. an off-by-one-hit denominator, exactly as reported.

Balance was **not** touched to make a death test pass. A legitimate death still needs
79 landed hits from a 14-damage contact source against an 1100 pool, which the 160 px disengage
leash never allows — so `A0_THREAT_DEATH_NOT_TESTED` stands (owner-tagged in §7).

---

## 6. Composition executed at the refreshed pins

```
python3 tools/a0/compose_owners.py … --owner a1=9ca1453c… --owner a3=b44e22df… --owner a8=06d1758e… --owner a6=6d71410a…
  a1 copied= 295 out_of_scope= 152 | a3 22/132 | a6 104/89 | a8 64/11
  conflicts=0 unresolved=0
python3 tools/a0/check_composition.py /tmp/c14
  seat checks: 2087, problems: 0, known stale: 2  → COMPOSITION SEATS PASSED
```

Executed inside that composition (`/tmp/c14`, clean profile per suite):

| Suite | Result |
| ----- | ------ |
| `survival_foundation_test` | PASSED 144 |
| `survival_a0_authored_world_contract_test --require-authored` | PASSED 22 |
| `survival_a0_player_return_test` (component probe) | PASSED 26 |
| `survival_a0_tool_and_offline_test` | PASSED 47 |
| `survival_a0_run_lifecycle_test --survival-run-clock-test` | PASSED 49 |
| `survival_a0_production_threat_test --keep-threat` | PASSED 25 |
| `survival_a0_poi_mount_test --require-a8` | PASSED 31 |
| `survival_production_waystation_candidate_test` | PASSED 33 |
| A6 avatar identity (hosted, composed) | PASSED 31 (full) |
| A6 duplicate `_manifest_has_staged_art` at `81c1f57e` | did **not** recur at `6d71410a` |
| A8 `e1fe550b` failure | did **not** recur at `06d1758e` |

Import of the composition: `0` errors, `0` `SCRIPT ERROR`/`Parse Error` lines.

Authored-world contract, executed with A1's reader present:

```
composed_cells=114688  authored_frame_cells=786432 (0.1458)
legacy_cells_compared=98256  legacy_layer_diffs=142  bounds [368,199,383,201]
carve_cells=48  seam_rows=3  annex_walkable_cells=4096/4096
POIs 118 → 15/103  regions 11 declared / 1 sampled  pilot_native_playable=false
```

Read plainly: the composed world is the legacy 384×256 frame plus a 64×64 authored annex —
**0.1458 of the authored continent** — and the pilot is not declared natively playable by A1.
A0 did not widen the bounds over empty terrain to hide that.

---

## 7. Blockers (owner-tagged, fail-closed)

1. **A1/A8 — POI coordinates sit outside the playable frame.** A8's three sites are at
   `poi_crown_south_quarry [30,280]`, `poi_crown_orchard [140,360]`, `poi_crown_mill [120,300]`;
   the composed frame is 448×256, so all three are below `y=256` and can never be reached on
   foot. A0's POI mount therefore refuses with `A1_RUNTIME_WORLD_EXTENT_ABSENT` and the POI
   journey stays `A0_POI_MOUNT_PHYSICAL_NOT_TESTED`. Owner action: either A1 publishes an
   annex that contains those cells, or A8 restates the sites in the pilot frame with A1
   authority. A0 does not invent coordinates or widen the frame.
2. **A3/A4 — no authentic lethality.** `14` contact damage against a `1100` hero pool; the
   authored hazard contract carries `unmitigated_hp_per_second_proposal` (a proposal, not an
   authorized value), so A0 cannot deal real environmental damage either. Owner action: an
   authored survival damage/health policy (or an encounter damage value) that A0 may apply to a
   hero it owns. Until then `A0_THREAT_DEATH_NOT_TESTED` and no death bag/respawn acceptance.
3. **A1 — runtime reader contract.** Production still has to reach A1's reader through the
   pinned `tests/survival/world/godot/chunk_reader.gd` path; A0 has recorded that dependency and
   requests a stable runtime-reader entry point rather than forking the file.
4. **A1 — roadside art pin drift.** A1's pinned roadside art at `9ca1453c` no longer matches the
   bytes A0's waystation host validates (`A1_ROADSIDE_ART_PIN_DRIFT`); the candidate world fails
   closed. Owner action: one stable reviewed byte-set per release, so A0 can re-pin to a named
   payload instead of a moving hash.
5. **Environment — no visual capture in this sandbox.** CI produces the 720p/1440p/2160p images
   and uploads them, but the results blob host is outside the allowlist, so no image can be opened
   here at 1×. `VISUAL_UX` therefore stays `NOT_TESTED`; no defect is invented and no image is
   claimed.

---

## 8. R5 nine gates (scoped)

| Gate | Verdict | Scope / why |
| ---- | ------- | ----------- |
| RESEARCH_PROVENANCE | PASS (scoped) | A1/A3/A6/A8 pins refreshed, verified at fetch time, composition manifest stored |
| ARCHITECTURE | PASS (scoped) | one SaveService, A3 economy authority, no second wallet/clock/planner; departure uses A3's own arm endpoint |
| CODE_RUNTIME | PASS | composition imports clean; all suites in §6 executed |
| TEST_ORACLE | PASS (scoped) | component probe relabelled, new journey gate added, threat denominator corrected without touching balance; hosted gate requires the PASS banner |
| VISUAL_UX | NOT_TESTED | images uploaded by CI but not openable here (§7.5) |
| SYSTEM_VALUE | FAIL | the first hour's *second* act (fuelled production → departure → offline homecoming) is still red |
| SAVE_MIGRATION | PASS (scoped) | 49 run-lifecycle checks, 47 tool/offline checks, departure flush proven durable |
| INTEGRATION | FAIL (scoped) | the journey stops at the furnace recipe row; A8 POI mount blocked on coordinates; A1 art pin drift blocks the candidate world |
| BALANCE_REPLAY | NOT_TESTED | no death, no lethal hazard, no replay of the 14-day loop |

---

## 9. Next primary capability

**Make the placed furnace's own work reachable and paid.** One thing, in order:

1. settle why `available_recipes(<placed furnace>)` does not surface `burn_charcoal` for the
   player (the dump is already printed on failure and promoted to a CI error), fix whatever the
   answer actually is on the A0 side of the seam;
2. then `KEY_P` prepare → `depart_world()` (already durable) → second process →
   the single offline settlement pays the ingot exactly once, and a second settlement pays
   nothing;
3. then the same route with the *ingot* as the reason to keep playing (`make_parts` becomes
   orderable).

At most two external dependencies are needed for that: **A3's answer on why a real furnace
station does not list its authored recipe**, and **A1/A8 agreement on POI cells inside the
playable frame** for the following capability.
