# Player-facing blockers (A7, consolidated v5)

_Generated from `data/survival/balance/results/blockers.json` by `tools/survival/balance/run_analysis.py`. Do not edit by hand._

**55 observations -> 5 blockers (4 closed, 3 A7 self-corrections, 6 observations traceability only).** Proof levels are the gate's `S0`–`S5`. Source text can reach `S3`; `S4` requires a green native run on the pinned commit, which no owner has yet. Nothing below was executed by A7.

| # | Blocker | Owner | Class | Closure probe |
|---|---|---|---|---|
| BLK-1 | The A1 cache and A8 site are placed in no world a player can reach | A0 (mount) with A1 (cell + instance identity) and A8 (scene) | MISSING_PRODUCTION_MOUNT | `gate claim C is SOURCE_PRESENT from a production path and both chains lose their L2/L3 blocker` |
| BLK-2 | A8's scene scripts call Vector2.from_array, which no Godot release exposes | A8 | NATIVE_RUNTIME_FAILURE | `oracle engine_api unknown_call_count is 0 and A8's contract step passes on the pinned sha` |
| BLK-3 | The float-precision fix is in A0's tree but no native run on the pinned sha has exercised it | A0 | SOURCE_OF_TRUTH_DEFECT | `oracle save_fidelity is ROUND_TRIP_EXACT and a0_save_precision is VERIFIED on the pinned sha` |
| BLK-4 | The only A3-authorized cache reward is proved by a fixture, and its reload checks fail | A0 (player-input path) with A3 (event identity) | FIXTURE_ONLY_SUCCESS | `gate s4_granted is true: all five clauses hold on the pinned sha` |
| BLK-5 | The player body is still the Knight; the locked avatar art is not imported | A6 (import + adapter) with A0 (mount) | PLAYER_FACING_VISUAL_DEFECT | `Q-04 static verdict REFERENCE_CONSISTENT with the canonical body mounted` |

## BLK-1 — The A1 cache and A8 site are placed in no world a player can reach

**Player impact.** The menu route into A0's overworld works in source, and A1's corridor authors exactly four physical bodies, but none of them is placed in that world: no production A0 file names poi_crown_waystation, node_waystation_cache or any A8 site scene. The consequence is sharper than 'nothing to loot' - knowledge_spares has exactly one non-circular source in the whole catalog (that cache), because every spare recipe needs a research station, so a player can harvest stone and wood all hour and still never begin research.

**Owner.** A0 (mount) with A1 (cell + instance identity) and A8 (scene)  
**Evidence class.** MISSING_PRODUCTION_MOUNT  
**Verified by.** gate claim C over production paths only (tests/.github/tools excluded and reported separately), plus A1's own corridor status SOURCE_AND_ISOLATED_NATIVE_FIXTURE_SCOPE_NOT_PRODUCTION and production_native_playable=false, plus oracle.knowledge_gate  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['entry_content']['a1_instance_references_in_a0_surface'], d['entry_content']['mounted'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'));k=d['knowledge_gate'];print(k['verdict'], k['non_circular_spare_recipes'], list(k['spare_loot_sources']))"
```
```bash
git show refs/a1:data/survival/world/corridor/crown_roadside.corridor.v1.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['status'], d['production_native_playable'])"
```

**Minimal safe correction.** A0 places the existing A1 instance node_waystation_cache at poi_crown_waystation inside the one production overworld the route already reaches. No new system, no data edit, no rate change: A1 supplies the cell and identity, A3 already prices the reward.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_needs_a_production_path_not_a_test_harness`

**Still NOT_TESTED after closure.** that the mounted node boots, is walkable and is interactable (native run)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L1_ENTRY | `S3_PRODUCTION_SEAM` | QUEUED | `S3_PRODUCTION_SEAM` | route exists in source; native run is QUEUED |
| a8_quarry | L2_ROUTE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | walkable inside its own harness scene only; not placed in the reachable world and it declares physical_instance_id = null |
| a8_quarry | L3_INTERACTION | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | the interaction only runs inside a test-harness scene |
| waystation_cache | L1_ENTRY | `S3_PRODUCTION_SEAM` | QUEUED | `S3_PRODUCTION_SEAM` | the route exists in source, but the native run that would prove it executes is QUEUED |
| waystation_cache | L2_ROUTE | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the reachable overworld contains no A1 city node and no A8 site scene, so there is no walkable route to the interaction yet |
| waystation_cache | L3_INTERACTION | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the action exists only in authored data; no mounted scene places the cache node |

**Evidence.**

- `claim_C` = `ABSENT`
- `claims_needed_for_first_station` = `2`
- `content_mounted` = `False`
- `knowledge_gate` = `SEEDED_ONLY_BY_LOOT`
- `non_circular_spare_recipes` = `[]`
- `non_production_refs_excluded` = `['a0.survival_waystation_authority_test.gd', 'a0.survival_waystation_input_restart_test.gd']`
- `production_a8_refs` = `[]`
- `production_instance_refs` = `[]`
- `spare_loot_sources` = `['road_supplies']`

## BLK-2 — A8's scene scripts call Vector2.from_array, which no Godot release exposes

**Player impact.** Every A8 scene position, portal, socket and interior spawn is read through Vector2.from_array(...) - 15 live call sites across native_poi_site.gd, native_poi_shell.gd and poi_pilot.gd. Godot's Vector2 has exactly one static method (from_angle), so these calls cannot resolve; the scenes cannot position anything, and A8's own contract step fails while the import-only step above it passes and uploads no artifact.

**Owner.** A8  
**Evidence class.** NATIVE_RUNTIME_FAILURE  
**Verified by.** oracle.engine_api against the engine's own class documentation, plus A8 run 41019689728 at 2d7f10d3: import succeeded, 'Run native physics, intent and persistence contracts' failed, no artifacts produced  
**Native run required to close.** True

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'));print(d['engine_api']['unknown_call_count']);[print(r['file'],r['line'],r['call']) for r in d['engine_api']['unknown_calls'][:5]]"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/engine_api.v1.json'));print(sorted(d['static_methods']['Vector2']))"
```

**Minimal safe correction.** A8 replaces each call with the array form that exists - Vector2(arr[0], arr[1]) on a two-element array, or Vector2i(...) where the value is a cell. Mechanical, 15 sites, no design change.

**Test that proves closure.** `tests/survival/balance/test_oracle.py::EngineApiOracleTests::test_a8_call_sites_disappear_after_the_conversion`

**Still NOT_TESTED after closure.** that the repaired scenes reach the player's world (BLK-1)

**Evidence.**

- `a8_last_run` = `{'run_id': 41015986080, 'workflow': 'a8-world-content-native.yml', 'head_sha': 'f9ed82b91e8d1eed52f109247ae511c4f862ffd1', 'conclusion': 'failure', 'failed_checks': [], 'failed_steps': ['Run native physics, intent and persistence contracts']}`
- `audited_types` = `['Color', 'JSON', 'Vector2', 'Vector2i', 'Vector3']`
- `sample` = `[{'file': 'a8.native_poi_shell.gd', 'line': 62, 'call': 'Vector2.from_array', 'is_engine_static': False}, {'file': 'a8.native_poi_shell.gd', 'line': 66, 'call': 'Vector2.from_array', 'is_engine_static': False}, {'file': 'a8.native_poi_shell.gd', 'line': 111, 'call': 'Vector2.from_array', 'is_engine_static': False}, {'file': 'a8.native_poi_site.gd', 'line': 107, 'call': 'Vector2.from_array', 'is_engine_static': False}, {'file': 'a8.native_poi_site.gd', 'line': 111, 'call': 'Vector2.from_array', 'is_engine_static': False}]`
- `static_calls_checked` = `42`
- `unknown_engine_calls` = `15`

## BLK-3 — The float-precision fix is in A0's tree but no native run on the pinned sha has exercised it

**Player impact.** At this pin the authoritative writer is correct - JSON.stringify(snapshot, "\t", false, true) at save_service.gd:2459 - so the oracle now reads ROUND_TRIP_EXACT. But the only native word on the defect is two failed runs on the older tree, where whole-document equality broke while every targeted integer comparison passed, and the workflow that proves the fix triggers only on A0's own branch. Until a green a0-save-precision run is cited on the pinned sha, a player's profile still has no evidence that it reloads exactly as written.

**Owner.** A0  
**Evidence class.** SOURCE_OF_TRUTH_DEFECT  
**Verified by.** oracle.save_fidelity over the pinned writer (ROUND_TRIP_EXACT, one authoritative writer) plus the failure labels recorded verbatim from 41018366655 and 41022547962  
**Native run required to close.** True

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'));f=d['save_fidelity'];print(f['verdict'], f['authoritative_writer_count']);[print(w['file'],w['line'],w['full_precision']) for w in f['writers'] if w['authoritative']]"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['native_states']['a0_save_precision']['state'])"
```

**Minimal safe correction.** A0 dispatches a0-save-precision on the pinned sha (its trigger is branch-locked to A0's own branch) and cites the green run. No code change is needed any more; the fix is already in the tree.

**Test that proves closure.** `tests/survival/balance/test_oracle.py::SaveFidelityOracleTests::test_whole_document_reload_is_impossible_to_prove_without_full_precision`

**Still NOT_TESTED after closure.** durability across a real OS restart or power loss (a simulated boundary is not that)

**Evidence.**

- `authoritative_writers` = `1`
- `failing_native_labels` = `[{'run_id': 41018366655, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022220148, 'head_sha': '122294f2237c1836d6f04561e090fe6aa6c6c0cf', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022547918, 'head_sha': 'f61afa23132ec5890834fa2cd0476d0edc8a51b1', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022975300, 'head_sha': '594730ea15a3e6db8d620fb89aef94e97fd6db11', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022220324, 'head_sha': '122294f2237c1836d6f04561e090fe6aa6c6c0cf', 'failed': ['same-process disk reload preserves custody and rights']}, {'run_id': 41022547962, 'head_sha': 'f61afa23132ec5890834fa2cd0476d0edc8a51b1', 'failed': ['interrupted candidate leaves disk unchanged', 'same-process disk reload preserves custody and rights']}, {'run_id': 41022975283, 'head_sha': '594730ea15a3e6db8d620fb89aef94e97fd6db11', 'failed': ['interrupted candidate leaves disk unchanged', 'same-process disk reload preserves custody and rights']}]`
- `formula` = `decimals = max(1, 14 - floor(log10(abs(value)))) when full_precision is false`
- `lossy_writers` = `[]`
- `save_precision_native_state` = `QUEUED`
- `verdict` = `ROUND_TRIP_EXACT`

## BLK-4 — The only A3-authorized cache reward is proved by a fixture, and its reload checks fail

**Player impact.** The single run that has ever paid 3 iron_scrap + 2 knowledge_spares is survival_waystation_authority_test.gd, whose own header says it 'does not prove player input, physical reach, production mount or OS restart' and which funds its own inventory and advances its own clock. It fails two of its own whole-snapshot checks (41022547962). The player-input half of the same workflow was skipped, so real input has never produced a receipt, and the S4 conjunction is 0 of 5 clauses at this pin.

**Owner.** A0 (player-input path) with A3 (event identity)  
**Evidence class.** FIXTURE_ONLY_SUCCESS  
**Verified by.** evidence.s4_clauses (exact sha + normal entry + independent process + authorized commit + negative replay) and the skipped step in run 41022547962  
**Native run required to close.** True

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['s4']['s4_granted']);[print(k,v['state']) for k,v in d['s4']['clauses'].items()]"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['commit_seam']['static_state'], d['commit_seam']['mounted_caller_count'])"
```

**Minimal safe correction.** A0 makes the player-input half run and pass on the pinned sha - the same event earning the same receipt through real input, with the second process refusing a replay. No new reward, no new key.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_all_five_s4_clauses`

**Still NOT_TESTED after closure.** that the reward is useful (BLK-1) or repeatable by a human (S5)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L5_COMMIT | `S2_SCENE_FIXTURE` | QUEUED | `S2_SCENE_FIXTURE` | a fake authority commits the reward; SaveService is never called on this path |
| a8_quarry | L6_RELOAD | `S0_ABSENT` | QUEUED | `S0_ABSENT` | site state lives only in fixture memory, so reload cannot preserve anything |
| a8_quarry | L7_NO_DUPLICATE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | claims are deduplicated inside the fixture only |
| waystation_cache | L5_COMMIT | `S3_PRODUCTION_SEAM` | QUEUED | `S3_PRODUCTION_SEAM` | survival commits are live (harvest/structures/death) and campaign rewards are live, but no caller is keyed on an A1 contract key: the Waystation cache has no claim path, and A8's POI still commits through an in-memory fixture (3 survival callers, 0 A1-contract callers) |
| waystation_cache | L6_RELOAD | `S3_PRODUCTION_SEAM` | QUEUED | `S3_PRODUCTION_SEAM` | a real two-process reload test exists in source, but its native run is QUEUED |
| waystation_cache | L7_NO_DUPLICATE | `S3_PRODUCTION_SEAM` | QUEUED | `S3_PRODUCTION_SEAM` | the guard exists and A1 defines the duplicate outcome, but no native run proves a second process refuses the replay |

**Evidence.**

- `mounted_caller_count` = `8`
- `native_states` = `{'a0_normal_entry_home': 'QUEUED', 'a0_second_process_restart': 'QUEUED', 'a0_waystation_player_input': 'QUEUED', 'a0_replay_negative': 'QUEUED', 'a3_authority_fixture': 'QUEUED', 'a0_save_precision': 'QUEUED', 'a8_native_poi_contract': 'STALE_HEAD', 'a0_runtime_validation': 'QUEUED'}`
- `s4_clauses` = `{'C1_exact_source_identity': 'NOT_HOLDS', 'C2_normal_entry': 'NOT_HOLDS', 'C3_independent_process': 'NOT_HOLDS', 'C4_authorised_commit': 'NOT_HOLDS', 'C5_negative_replay': 'NOT_HOLDS'}`
- `s4_granted` = `False`
- `static_seam_state` = `MOUNTED_SURVIVAL_SYSTEM_CALLER`

## BLK-5 — The player body is still the Knight; the locked avatar art is not imported

**Player impact.** The mounted body is game/characters/knight/knight.tscn. A6 is honest about the replacement: its manifest says BASE_ART_NOT_IMPORTED, runtime_status NOT_IMPORTED and idle_sheet "" for the authorised identities (Craftpix 555940 male, 419402 female), and the adapter returns SOURCE_BLOCKED instead of substituting another character. So nothing is faked - and nothing is visible either.

**Owner.** A6 (import + adapter) with A0 (mount)  
**Evidence class.** PLAYER_FACING_VISUAL_DEFECT  
**Verified by.** quality Q-04 over the pinned tree (mounted scene identity, claimed sheets, adapter fallback)  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/quality.json'));print([c for c in d['checks'] if c['check_id']=='Q-04'][0]['static_verdict'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/product.json'));print(d['player_surface_facts']['mounted_player_scene'])"
```

**Minimal safe correction.** A6 imports the grade-0 idle sheet for ONE gender from the authorised archive, points the manifest at the installed file, and A0 mounts that scene. Grades 1-2 stay SOURCE_BLOCKED; no Knight/Swordsman substitution.

**Test that proves closure.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical`

**Still NOT_TESTED after closure.** directional animation, armour swap and rendered frames (S5, human)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L4_AUTHORIZATION | `S0_ABSENT` | NOT_TESTED | `S0_ABSENT` | A8's two route actions have an item id but no authorized quantity, so neither can be paid |

**Evidence.**

- `canonical_avatar_production_refs` = `{'555940': 0, '419402': 0, '180537': 0}`
- `mounted_player_scene` = `game/characters/knight/knight.tscn`
- `q04` = `WRONG_MOUNTED_IDENTITY`
- `visual_state` = `NOT_TESTED`

## Closed, kept for traceability

### BLK-MIRROR — was: _A0 shipped a stale copy of A3's source catalog (34/36 rows, 2 drifted)_

**Disposition.** `CLOSED_BY_OWNER_SOURCE` at A0 2faf005b, re-checked against A3 100b3406

**Why.** Q-03 now reports MATCH over all 36 rows: A0's mirrored data/survival/items/sources.json carries the adopted A1 binding for road_scrap and road_supplies. No quantity changed, because A1 and A3 already agreed on 3 and 2.

**Residual.** the mirror is still a copy; drift can return on the next A3 edit, which is why Q-03 stays.

**Still with the owner.** nothing for this item.

**Evidence.**

- `divergent` = `[]`
- `mirror_rows` = `36`
- `q03` = `PASS`

### BLK-BINDING — was: _A1 authorizes the first-hour cache but A3 had not adopted the binding_

**Disposition.** `CLOSED_BY_OWNER_SOURCE` at A3 100b3406 built on c23292be; re-checked against A1 2f6edd3f

**Why.** A3 adopted both instance rebinds and keeps A1's own yields (3 iron_scrap, 2 knowledge_spares) and the 1800 active-second window. The third binding is a live-source reuse, satisfied as authored. A7 requested no rate change at any point.

**Residual.** the reward still has nowhere to be paid - now BLK-1/BLK-4.

**Still with the owner.** nothing from A3 for this item.

**Evidence.**

- `cooldown` = `1800`
- `rebind_adopted` = `2`
- `rebind_required` = `2`
- `yields_changed` = `False`

### BLK-INSTANCE-ID — was: _A1's physical instance id (si:r_ashen_crown:waystation_cache:01) and A3's node_waystation_cache might not meet_

**Disposition.** `CLOSED_BY_OWNER_SOURCE` at A1 2f6edd3f, A3 100b3406

**Why.** A1 publishes both ids for one object - instance_id for the physical body and interaction_node_id for the interaction - and A3 binds the interaction node id. The vocabularies meet at a named seam instead of being silently aliased, which was the actual risk.

**Residual.** A1 still declares production_native_playable=false for the corridor (BLK-1).

**Still with the owner.** nothing for the id contract.

**Evidence.**

- `a1_instance` = `si:r_ashen_crown:waystation_cache:01`
- `a1_interaction_node` = `node_waystation_cache`
- `a3_instance` = `node_waystation_cache`

### BLK-DEBUG-UI — was: _The only survival UI is developer-facing and duplicates A0's HUD_

**Disposition.** `CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN` at round 3, re-verified at A6 8bc0af5a

**Why.** No production scene mounts the survival UI, the developer vocabulary sits behind _developer_diagnostics (default false), and the three HUD scripts own disjoint jobs.

**Residual.** PROD-04 keeps its file-level FAIL as hygiene, not as a player blocker.

**Still with the owner.** A6 keeps the panel opt-in when it mounts.

**Evidence.**

- `hud_jobs` = `['a0.hud=health', 'a0.overworld_hud=provisions', 'a6=context/core/feedback']`
- `survival_ui_mounted` = `False`

## A7 self-corrections

### CORR-6 — `TRUE ONLY ONCE THE CACHE IS MOUNTED`

**A7's earlier claim.** The first-research bootstrap cycle is CLOSED_MEASURED_FALSE: 2 spares per claim, 3 needed, so two claims reach it.

**What is actually true.** Walking the catalog: every recipe that yields knowledge_spares (make_spares, study_predator_jaw, study_axe_insignia) requires a research station, and the research station costs a research_kit that needs 3 spares. The only non-circular seed is road_supplies from the A1 cache, which is mounted nowhere. At this pin the cycle is real.

**What remains true.** with the cache mounted, two claims (one 1800 s restock) do reach the kit, as round 4 said.

**Fix in this round.** the closure is now expressed as a conditional and computed by oracle.knowledge_gate, not asserted.

### CORR-7 — `WOULD HAVE PRODUCED A FALSE POSITIVE`

**A7's earlier claim.** Claim C (content mounted) reads every pinned A0 byte.

**What is actually true.** Round 5 pins A0's own test harness, which names node_waystation_cache. Counting test references as a production mount flipped claim C to SOURCE_PRESENT in this round's first run - the exact defect the claim exists to catch, produced by A7's own pinning change.

**What remains true.** no production A0 file names the instance; the mount is still absent.

**Fix in this round.** entry_content now reads production paths only and reports the excluded test references separately.

### CORR-8 — `NOT WHAT THE BYTES SAY`

**A7's earlier claim.** A6 'points the manifest at an invented sheet' was the central avatar risk.

**What is actually true.** A6 declares BASE_ART_NOT_IMPORTED, idle_sheet "" and runtime_status NOT_IMPORTED, and its adapter returns SOURCE_BLOCKED. It is not spoofing anything; the defect is that the locked identity is not imported at all.

**What remains true.** the mounted body is still the Knight, so a player sees the wrong character.

**Fix in this round.** BLK-5 states the honest condition and Q-04 keeps grading the real mount.
