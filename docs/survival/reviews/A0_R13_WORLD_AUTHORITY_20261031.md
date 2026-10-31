# A0 R13 — the authored continent is the player's world

Round: **R13-A0-WORLD**. Order: make A1's authored 1024×768 continent the
authoritative traversable world for the real player, keep the legacy Chapter-1 content
on a reusable route, persist a real spawn in A0's one save, and prove the whole thing
in two OS processes with ordinary input.

This document records what was **measured**. Anything not measured is marked
NOT_TESTED and is not counted as a pass.

---

## 1. Player verdict

**The player boots on A1's continent, is the Adventurer they chose, walks real
authored terrain with the camera following, harvests a physical authored source with
the interact key, walks to A8's South Quarry, enters through its doorway, works its
socket, is refused by A3 with a receipt, retreats, then crosses the continent to the
South Orchard by a different route, enters, retreats, returns toward shelter, saves —
and a second OS process resumes the same run, world, spawn, position and bag.**

That journey passes natively in the composed tree:
`A0 AUTHORED WORLD ROUTE PASSED - 43..46 checks (play)` and
`A0 AUTHORED WORLD ROUTE PASSED - 15 checks (verify)`, hosted run **41244927885**
(step “R13 A0 authored continent route — real player, two OS processes” = success),
and eleven consecutive local iterations (five play/verify pairs) after the final
three fixes.

**Not claimed:** the A8/A3 award path still refuses to pay (by design — A3 has not
authorized either source), Factory 2PID debt stays UNACCEPTED, and the avatar's
*art* is A6/A1 source-blocked, so avatar pixels are NOT_TESTED.

---

## 2. SHAs and files

| what | value |
| --- | --- |
| A0 branch head | `caf813d901a0abed6ab02faa3a96872154170d37` |
| A0 base before R13 | `ee5f9f5160c8e4385f35a63b355ddda957f93d10` |
| A1 pinned | `a030cb89a5033ba5faba39995762b4bea1332cec` |
| A3 pinned | `b44e22df3af40939069189be14afc23ee1ce21c4` |
| A6 pinned | `6d1e8bcee0bbb09be0ff04f14de1f7e59f06cfb8` |
| A8 pinned | `0f885df862d7d34f18ca456e80b1aaac05b23de0` |
| composed tree | the workflow’s `.composition` from those five refs; seat check `COMPOSITION SEATS PASSED` (2106 checks, 0 problems, 2 known-stale) |
| hosted runs | 41244927885 (green route gate), 41243436165, 41240557613, 41237459493, 41235266282, 41233127002, 41232108976, 41230745072 |

### A0-owned files changed

| file | why |
| --- | --- |
| `game/survival/a0_world_authority.gd` | new: the authored-continent join — reader/stream mount, spawn commit, site mount, interior transitions, receipts, `collision_roots()`, `spawn_resume_decision()` |
| `game/survival/a0_authored_traversability.gd` | new: walkability over A1 terrain **and** A8 shells; `refresh_bodies()` learns streamed bodies |
| `game/survival/a0_authored_world_view.gd` | new: the authored world as a query surface for the build/HUD code |
| `game/overworld/chapter1_overworld.gd` (+ `tools/a0/merges/chapter1_overworld.gd.merged`) | authored build path, annex retained as the reusable route, departure flush, carry projection restored |
| `game/autoload/save_service.gd` (+ `.merged`) | `authored_world` section and its sanitizer — the spawn commit's durable home |
| `game/autoload/input_bootstrap.gd` | `interact` gets the desktop `G` binding A8's own prompt prints |
| `tests/survival_a0_authored_world_route_test.gd` | new: the two-process product gate |
| `tests/survival_a0_authored_world_capture_test.gd` | new: native frames at 720p/1440p/2160p |
| `tests/survival_foundation_test.gd`, `survival_connector_pilot_test.gd`, `survival_production_waystation_candidate_test.gd` | the legacy Chapter-1 suites ask for the retained annex world **explicitly** |
| `.github/workflows/a0-round12-composition.yml` | composed steps now actually run in `.composition`; failure digest finds its logs; capture + pixel-probe steps |

No owner source was rewritten: A1's reader/stream, A3's economy, A8's shell/site/phase
context and A6's presentation are consumed as published.

---

## 3. What was broken, and what fixed it

Every item below was found by a red gate, not by reading code.

| symptom | cause | fix |
| --- | --- | --- |
| process 2 re-rolled the spawn although the save held a record | the spawn lived at `save.survival.authored_world`; the survival namespace is rebuilt from a fixed key list, so the record was erased on the next survival commit | A0's own top-level `authored_world` section with a real sanitizer |
| verify phase reported `stored_record_absent` | `get_value()` was handed an untyped `Array` where the API wants `Array[String]`, and the call failed silently | typed path in `_stored_spawn()` |
| `AUTHORED_SPAWN_REFUSED:` with an empty reason | the resumed path returned the raw spawn record, not the `{ok, reason, resumed, spawn}` shape | one return shape on every path |
| the body resumed 25 px off | the site return anchor (`door + (0,18)`) overlapped the shell's collision | return to the published approach point |
| the saved position was not the position the loader would accept | quitting on scenery stored an unstandable position | departure stores the nearest standable cell of that footprint (the body is **not** moved — leaving is not a teleport) |
| the route planned through a quarry wall | walkability knew only A1's terrain | `collision_roots()` = terrain + site shells + interior |
| the last 70 px into a doorway never closed | a shell's walls are marked blocked and a door gap is narrower than a map cell | a local 8-px physics-ray grid around the door, walked with the ordinary keys, plus a forecourt staging point |
| whole journeys failed on one spawn in three | planning nodes demanded a clear ring of four neighbours, which rejects every one-cell neck on A1's terrain | clearance is the *step* rule (a diagonal needs both shoulders) |
| a journey died 1.4 km from the quarry | a clear physics ray was allowed to override the map, so the walker strolled into water and no plan could start there | the map decides ordinary stepping; the physics grid is local to the building only |
| six composed suites had always been red | the steps ran `--path .` at the workspace root (A0's checkout) instead of `.composition` | `cd .composition` in every composed step |
| a red job was undiagnosable | the digest globbed `../artifacts/*.log`, which matched nothing | reads `./artifacts`, and prints the engine version + one transcript |

---

## 4. The two-process gate — evidence chain

### 4.1 Process 1 (New Game → continent → two sites → save)

* identity: `A0_AUTHORED_AVATAR {"gender":"male","schema":"soh.player_avatar.v1","selection_source":"r13_gate"}` — chosen through `set_player_avatar`, the same call A6's avatar screen makes.
* world: `A0_AUTHORED_REPORT {"frame":[1024,768],"reader":"world:soh_continent_v1","reader_source":"a1_production"}`; `mode=authored`; camera bounds `16384×12288` (continent, not the 384×256 inset).
* spawn: `{"candidates":27445,"candidate_chunks":20,"cell":[81,437],"region_id":"r_amberwood","seed":…,"saved":true}` — drawn from A1's safe index, walkable in the running world, on the stored cell at t=0, bound to the run standing in it.
* collision: `A0_AUTHORED_COLLISION bodies=23 marked_cells=155 chunks=1` measured **after** the walk (chunks stream in as the player moves).
* harvest: `{"node_id":"res:src_crown_tuff:03","kind":"stone_outcrop","item":"stone_chunk","before":0,"after":2,"cell":[430,276]}` — reached on foot, `G` pressed as a real `InputEventKey`.
* quarry: `walk_px 3212..6036`, `at_door_px 5.2..18.0`, `entered=true`, `reached_stand=true`, `retreated=true`.
* orchard: `walk_px 2141..2156`, `at_door_px 15.1..17.4`, `entered=true`, `retreated=true`.
* receipts (one per site, verbatim shape):
  `{"poi_id":"poi_crown_south_quarry","action_id":"brace_east_shelf","status":"rejected","reason":"A3_SOURCE_AUTHORIZATION_ABSENT: R13-A3-VALUE has not authorized this source yet, so A0 will not mint a reward.","run_revision":4,"intent_id":"…"}`
* departure: `{"persisted":true,"position":[2248,5816],"body_position":[2248,5810.85],"settle":{"ok":true,"reason":"nothing_to_settle"},…}`

### 4.2 Process 2 (different OS process, same save)

* `A0_SPAWN_RESUMED {… "resumed":true …}` — the stored record is resumed, not re-rolled.
* same run id, same spawn cell `[81,437]` vs `[81,437]`, same body position `(2248, 5816)` vs `(2248, 5816)`.
* bag identical (1 item kind), 3 sites mounted and visible, the same male Adventurer presented, the body still walks authored terrain after the relaunch (51.6 px), world record still in the one save.
* `A0 AUTHORED WORLD ROUTE PASSED - 15 checks (verify)`.

### 4.3 Input, not teleports

* movement: `Input.action_press("move_left/right/up/down")` only; the body is moved by `move_and_slide` into real collision.
* interaction: a real `InputEventKey` for `G` (`physical_keycode = KEY_G`), two frames pressed, two released — a missing binding fails the gate.
* the only position writes are the product's own: A8's interior spawn on entering a site, and the return anchor on exit. The gate never writes `global_position`.
* `Engine.time_scale = 3.0` is a test speed control; physics rules, collision, streaming and input are untouched.

### 4.4 Negative oracles that really execute

| case | how | result |
| --- | --- | --- |
| outside the frame | `cell_is_walkable((-1,0))`, `(1024,768)` | not walkable |
| never-streamed chunk | `cell_is_walkable((100000,100000))` | not walkable |
| water | A1 surface of a nearby water cell | not walkable when one exists, else NOT_APPLICABLE, printed |
| blocked neighbour | a prop cell within 7 cells | walking into it stops the body short |
| foreign world / foreign run / no cell / unwalkable cell | `spawn_resume_decision()` asked about four forged records (pure question, nothing written) | all four refused, with `FOREIGN_WORLD`, `FOREIGN_RUN`, `NO_CELL`, `CELL_NOT_WALKABLE` |
| positive control | the run's own record | `resumed:true` |
| unauthorized source | A8 intent → A0 answer | `rejected` receipt with `A3_SOURCE_AUTHORIZATION_ABSENT`, site state and bag unchanged |
| door refusal | a doorway attempt from >22 px | logged with the measured distance |

---

## 5. Native frames

`A0 AUTHORED CAPTURE PASSED` at **1280×720 (29 checks)**, **2560×1440 (19)** and
**3840×2160 (29)** in run 41244927885, from the same production scene: spawn, after
walking, terrain, source, source-after-`G`. Each frame is accepted only if it is the
size it claims, has ≥24 distinct sampled colours, real luminance spread (sd ≥ 2) and a
HUD that paints text; the untouched PNGs are in the run artifact
(`artifacts/visual_authored_*.png`).

The sandbox this review was written in **cannot reach the artifact host**, so the
full-resolution originals were not opened at 1× here — see §8 for what that does and
does not mean.

---

## 6. Gate disposition

| gate | disposition | evidence |
| --- | --- | --- |
| R0 build/parse | PASS (composed) | import step, `--import` with no `SCRIPT ERROR`/`Parse Error` |
| R1 world authority | PASS | `mode=authored`, 1024×768 frame, camera limits, stream chunks, `A1_AUTHORED_INTERFACE_ABSENT` only in a tree without A1 (reported as `degraded`) |
| R2 spawn identity | PASS | 27445-cell safe index, persisted record resumed across processes |
| R3 traversal | PASS | 3 km–6 km journeys by input, both sites, camera follows |
| R4 site entry/exit | PASS (entry, work, retreat) | both shells entered through doorways, sockets answered |
| R5 reward | **FAIL by design** | A3 has not authorized; A0 refuses and records why |
| nine gates | unchanged from Round 12C except R13 rows above | no B0/E2/HUMAN PLAY/Gold claim |
| Factory 2PID | UNACCEPTED, existing failed evidence kept | not re-litigated this round |
| avatar pixels | NOT_TESTED | presenter `SOURCE_BLOCKED`, “Identity-specific runtime action sheets are not installed” |

---

## 7. Blockers

**Producer (A1).** The authored source refuses its own byte pin in this composition:
`A0 AUTHORED WORLD CONTRACT PARTIAL … BLOCKED by A1` with `A0_AUTHORED_WORLD_BLOCKED
owner=A1`. A0's sixteen spatial checks pass. A1 must publish a lock whose hashes
match the payloads it ships.

**Producer (A3).** Neither South Quarry nor South Orchard is authorized:
`A3_SOURCE_AUTHORIZATION_ABSENT: R13-A3-VALUE has not authorized this source yet`.
Until A3 authorizes, no POI reward may be claimed — and none is.

**Producer (A6).** The composed A6 suite step is red on A6's own startup test
(`STARTUP PROFILE CHOICE TEST FAILED — 2/29 checks`) while printing `A6 NATIVE GATES
PASSED`; the same step was red at the pre-R13 baseline run 41215828923, so this is
pre-existing and A6-owned, not an R13 regression. The avatar art gate is also A6/A1:
`has_avatar_sprite: false`.

**Consumer (A0).** Avatar pixels cannot be verified from inside this repository: the
presenter reports `SOURCE_BLOCKED` and the art sheets are private. A0 verifies the
identity is chosen, stored, presented as the same gender, and moves the body.

---

## 8. What this document does not claim

* No POI reward, no A8 payout, no A3 authorization.
* No human play, no balance judgement, no B0/E2 acceptance.
* No claim that the 2160p frames were inspected at 1× in this review environment: the
  artifact host is unreachable. The capture test's own pixel assertions (size, colour
  variety, luminance spread, HUD text) ran at all three resolutions, and the frames
  are in the artifact for a reviewer with access.

---

## 9. Next primary capability

**A0: close the Factory 2PID debt** (freed-Control reference and input-event lifecycle
— both A0 oracle bugs), then re-run the paid-factory two-process journey against the
one SaveService. External dependencies: A3 must authorize at least one source so the
receipt path can be exercised end to end, and A1 must publish a matching byte lock.
