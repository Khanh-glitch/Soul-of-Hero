# Player-facing blockers (A7, consolidated v6)

_Generated from `data/survival/balance/results/blockers.json` by `tools/survival/balance/run_analysis.py`. Do not edit by hand._

**54 observations -> 5 blockers (2 earlier claims closed, 5 A7 self-corrections, 6 observations traceability only).** Proof levels are the gate's `S0`–`S5`. Source text can reach `S3`; `S4` requires a green native run on the pinned commit, which no owner has yet. Nothing below was executed by A7.

| # | Blocker | Owner | Class | Closure probe |
|---|---|---|---|---|
| BLK-1 | The only Waystation in production code is a candidate behind a project setting the shipped game does not enable | A0 | MISSING_PRODUCTION_MOUNT | `claim C is MOUNTED_BY_DEFAULT and guard.enabled_by_default is true` |
| BLK-2 | The Waystation cache cannot resolve its own reward: A0 sends the si: instance id, A0's vendored catalog still holds the alias | A0 (re-vendor) with A3 (canonical id) | CROSS_OWNER_IDENTITY_MISMATCH | `oracle.instance_identity is IDENTITY_CONSISTENT and no host request is unresolved` |
| BLK-3 | A8's 15 invented Vector2.from_array calls are fixed in source, and still unproven natively | A8 | SOURCE_FIXED_NATIVE_PENDING | `a8_native_poi_contract is VERIFIED on the pinned sha` |
| BLK-4 | No native proof anywhere on the current sha: the only paid receipt is a fixture that bypasses the host | A0 | FIXTURE_ONLY_SUCCESS | `gate s4_granted is true: all five clauses hold on the pinned sha` |
| BLK-5 | The player body is still the Knight; the D051 bald male/female art is still not imported | A6 (import + adapter) with A0 (mount) | PLAYER_FACING_VISUAL_DEFECT | `Q-04 PASS with the canonical body mounted and every claimed sheet present` |

## BLK-1 — The only Waystation in production code is a candidate behind a project setting the shipped game does not enable

**Player impact.** A0 9269739e now builds a real physical host: five interaction points with stand cells, a range check, and A1's actual slice geometry mounted from byte-identical A1 939720d5 bytes. But the whole branch hangs on ProjectSettings survival/a0_waystation_candidate, and the shipped project.godot does not contain that key. Godot's fallback is false, so a normal player never enters the branch: the first useful reward in the game is unreachable by ordinary play even though the code exists.

**Owner.** A0  
**Evidence class.** MISSING_PRODUCTION_MOUNT  
**Verified by.** gate entry_content.guard, read from the pinned project.godot and chapter1_overworld.gd, plus the byte comparison of A0's vendored slice against A1's current slice  
**Native run required to close.** True

**Run it natively (owner-side, exact command).**

```bash
# A0: prove the guarded branch boots at all, on the pinned sha
godot --headless --path . --user-data-dir artifacts/ud_entry --import
xvfb-run -a godot --path . --resolution 1280x720 --script res://tests/survival_normal_entry_home_restart_test.gd
# and prove the CANDIDATE branch specifically (currently never executed by CI).
# Godot 4 has no CLI switch for a project setting, so the branch is proved one
# of two ways: put the key in project.godot (the fix) and run the same script, or
# run A7's probe with --force-branch, which sets it in memory and labels the run
# SOURCE_PRESENT_BEHIND_GUARD rather than acceptance:
xvfb-run -a godot --path . --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --force-branch
```

**Reproduce the static finding.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['entry_claims']['C_content_is_mounted']['state'], d['entry_content']['guard'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/snapshot/product_manifest.json'));print([f['sha256'][:12] for f in d['files'] if f['path'].endswith('poi_crown_waystation.slice.json')])"
```

**Minimal safe correction.** A0 decides the guard's default. Either set survival/a0_waystation_candidate=true in project.godot once the interaction is proven, or mount the host unconditionally and keep the flag for the annex geometry only. One line, no new system.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_needs_a_production_path_not_a_test_harness`

**Still NOT_TESTED after closure.** that the branch boots and the points are interactable (native run)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L1_ENTRY | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | route exists in source; native run is STALE_HEAD |
| a8_quarry | L2_ROUTE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | walkable inside its own harness scene only; not placed in the reachable world and it declares physical_instance_id = null |
| a8_quarry | L3_INTERACTION | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | the interaction only runs inside a test-harness scene |
| waystation_cache | L1_ENTRY | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | the route exists in source, but the native run that would prove it executes is STALE_HEAD |
| waystation_cache | L2_ROUTE | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the host is behind `survival/a0_waystation_candidate`, which the shipped project.godot does not set, so a normal player never takes that branch |

**Evidence.**

- `claim_C` = `SOURCE_PRESENT_BEHIND_DISABLED_FLAG`
- `claims_needed_for_first_station` = `2`
- `guard` = `{'setting': 'survival/a0_waystation_candidate', 'guarded': True, 'declared_in_project': False, 'enabled_by_default': False, 'why': 'ProjectSettings.get_setting(key, false) returns false when the shipped project.godot omits the key, so an absent key is a disabled guard, not a neutral default.'}`
- `knowledge_gate` = `SEEDED_ONLY_BY_LOOT`
- `mount_state` = `SOURCE_PRESENT_BEHIND_DISABLED_FLAG`
- `non_circular_spare_recipes` = `[]`
- `non_production_refs_excluded` = `['a0.survival_waystation_authority_test.gd', 'a0.survival_waystation_input_restart_test.gd']`
- `production_a8_refs` = `[]`
- `production_instance_refs` = `['a0.economy_session.gd:290', 'a0.economy_session.gd:311', 'a0.waystation_host.gd:6']`
- `spare_loot_sources` = `['road_supplies']`

## BLK-2 — The Waystation cache cannot resolve its own reward: A0 sends the si: instance id, A0's vendored catalog still holds the alias

**Player impact.** A0 9269739e's host sends {poi_crown_waystation, cache_restock, si:r_ashen_crown:waystation_cache:01}. Its own lookup is exact string equality over those three fields, and the catalog it ships still says node_waystation_cache, because A0 vendors a pre-V4 copy of A3 (b1d291d0) while A3 c5e80922 is 622a277f. The result is deterministic: the first useful reward in the game fails with unknown_source_instance, and the only test that ever 'paid' 3 scrap + 2 spares used the alias directly, so it never touched the host path.

**Owner.** A0 (re-vendor) with A3 (canonical id)  
**Evidence class.** CROSS_OWNER_IDENTITY_MISMATCH  
**Verified by.** oracle.instance_identity: the shipped host's POINTS table replayed against the catalog A0 actually loads, with A3's canonical table alongside; plus Q-03 mirror drift naming the same three rows  
**Native run required to close.** False

**Run it natively (owner-side, exact command).**

```bash
# A0: the reward path, replayed without Godot (the runtime does the same string comparison)
python3 tools/survival/balance/run_analysis.py
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'))['instance_identity'];print(d['a3_only_bindings'])"
# then the native check that should now pay. Godot has no CLI switch for a
# project setting, so either ship the key in project.godot or run A7's probe
# with --force-branch (in-memory, classed SOURCE_PRESENT_BEHIND_GUARD):
xvfb-run -a godot --path . --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --force-branch
```

**Reproduce the static finding.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'))['instance_identity'];print(d['verdict']);[print(x['point'],x['instance_id']) for x in d['unresolved_host_requests']]"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'))['instance_identity'];print('fixture ids absent from host:', d['fixture_ids_absent_from_host'])"
```

**Minimal safe correction.** A0 re-vendors A3 c5e80922's world_source_bindings.v3.json byte-for-byte (three bindings, si ids, instance_id + interaction_node_id + identity), and changes its authority test to send the host's request instead of the alias. No quantity, cooldown or price changes.

**Test that proves closure.** `tests/survival/balance/test_oracle.py::InstanceIdentityOracleTests::test_the_alias_cannot_stand_in_for_the_world_instance`

**Still NOT_TESTED after closure.** that the transaction commits durably (BLK-4)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| waystation_cache | L3_INTERACTION | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the action exists only in authored data; no mounted scene places the cache node |

**Evidence.**

- `a3_only_bindings` = `['cache_restock@si:r_ashen_crown:waystation_cache:01', 'salvage_roadside_notes@si:r_ashen_crown:roadside_supply:01']`
- `divergent_bindings` = `['node_waystation_approach_deadfall']`
- `fixture_ids_absent_from_host` = `['node_waystation_cache']`
- `host_instance_ids` = `['node_waystation_approach_deadfall', 'si:r_ashen_crown:waystation_cache:01']`
- `identity_verdict` = `HOST_ACTION_UNRESOLVED`
- `q03` = `FAIL`
- `unresolved_host_requests` = `[{'point': 'cache', 'action_id': 'cache_restock', 'instance_id': 'si:r_ashen_crown:waystation_cache:01', 'poi_id': 'poi_crown_waystation', 'resolved_in_a0_catalog': False, 'resolved_in_a3_catalog': True, 'a0_binding_id': None, 'a3_binding_id': 'a1_waystation_roadside_cache_v3'}]`

## BLK-3 — A8's 15 invented Vector2.from_array calls are fixed in source, and still unproven natively

**Player impact.** At the previous pin the native POI scenes read every position through Vector2.from_array, which no Godot release exposes. A8 c8b4bc88 replaced them with native_poi_vectors.gd and the audited call count is now zero. That is a real fix and it is not a native pass: A8's contract step has never been green on this sha, and the last failing log died at a preload of poi_authority_fixture.gd.

**Owner.** A8  
**Evidence class.** SOURCE_FIXED_NATIVE_PENDING  
**Verified by.** oracle.engine_api over the pinned c8b4bc88 sources (0 unknown calls) plus the recorded CI outcomes for a8-world-content-native.yml on this sha (none green)  
**Native run required to close.** True

**Run it natively (owner-side, exact command).**

```bash
# A8: the fix exists; these two native steps are what would close it
godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd
godot --headless --path . --script tests/survival/world_content/native_poi_transition_test.gd
```

**Reproduce the static finding.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/oracle.json'))['engine_api'];print(d['verdict'], d['unknown_call_count'], d['static_call_count'])"
```
```bash
git grep -n 'from_array' refs/a8 -- '*.gd' | head
```

**Minimal safe correction.** A8 lands those two native steps green on a pushed sha and uploads the artifact. No code change is implied by this blocker any more.

**Test that proves closure.** `tests/survival/balance/test_oracle.py::EngineApiOracleTests::test_a8_call_sites_disappear_after_the_conversion`

**Still NOT_TESTED after closure.** that the scenes are reachable in A0's world (BLK-1)

**Evidence.**

- `a8_completed_runs` = `[{'run_id': 41015986080, 'head_sha': 'f9ed82b91e8d1eed52f109247ae511c4f862ffd1', 'failed': []}, {'run_id': 41019032228, 'head_sha': 'c0ae902542a31c37bdfdc8f72d452cbf430e6747', 'failed': []}, {'run_id': 41019182407, 'head_sha': '2ad531f9e099cc3a29709da176e7a34b05a9a15b', 'failed': []}, {'run_id': 41019689728, 'head_sha': '2d7f10d355cb57692a321f3ca633550d31385157', 'failed': []}, {'run_id': 41024442152, 'head_sha': '9c180ef115bc53b1aa48e39a46a1a8fa7426c602', 'failed': []}, {'run_id': 41024526858, 'head_sha': '5ccf7b3f9824daa138b5d98106b74a2899c7592b', 'failed': []}]`
- `a8_native_state` = `STALE_HEAD`
- `audited_types` = `['Color', 'JSON', 'Vector2', 'Vector2i', 'Vector3']`
- `static_calls_checked` = `23`
- `unknown_engine_calls` = `0`

## BLK-4 — No native proof anywhere on the current sha: the only paid receipt is a fixture that bypasses the host

**Player impact.** Every required native assertion resolves STALE_HEAD at this pin: entry, second process, real input, save precision and negative replay. S4 is 0 of 5 clauses. The one run that has ever paid the cache reward funds its own inventory, advances its own clock and sends an instance id the shipped host never sends, so it proves the transaction helper and nothing about a player.

**Owner.** A0  
**Evidence class.** FIXTURE_ONLY_SUCCESS  
**Verified by.** evidence.s4_clauses over the recorded runs plus oracle.instance_identity's fixture check  
**Native run required to close.** True

**Run it natively (owner-side, exact command).**

```bash
# A0: one ordinary-input run on the sha, then the separate-process half
xvfb-run -a godot --path . --user-data-dir artifacts/ud_entry --resolution 1280x720 \
  --script res://tests/survival_normal_entry_home_restart_test.gd
xvfb-run -a godot --path . --user-data-dir artifacts/ud_entry --resolution 1280x720 \
  --script res://tests/survival_normal_entry_home_restart_test.gd -- --verify-separate-process
```

**Reproduce the static finding.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print({k:v['state'] for k,v in d['native_states'].items()})"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['s4']['s4_granted'], {k:v['state'] for k,v in d['s4']['clauses'].items()})"
```

**Minimal safe correction.** A0 runs the two halves on the pinned sha and cites the green runs. Nothing else in A7's scope can move this: S4 is owner-native evidence only.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_all_five_s4_clauses`

**Still NOT_TESTED after closure.** that a human finds the route and enjoys it (S5)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L5_COMMIT | `S2_SCENE_FIXTURE` | STALE_HEAD | `S2_SCENE_FIXTURE` | a fake authority commits the reward; SaveService is never called on this path |
| a8_quarry | L6_RELOAD | `S0_ABSENT` | STALE_HEAD | `S0_ABSENT` | site state lives only in fixture memory, so reload cannot preserve anything |
| a8_quarry | L7_NO_DUPLICATE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | claims are deduplicated inside the fixture only |
| waystation_cache | L5_COMMIT | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | survival commits are live (harvest/structures/death) and campaign rewards are live, but no caller is keyed on an A1 contract key: the Waystation cache has no claim path, and A8's POI still commits through an in-memory fixture (5 survival callers, 0 A1-contract callers) |
| waystation_cache | L6_RELOAD | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | a real two-process reload test exists in source, but its native run is STALE_HEAD |
| waystation_cache | L7_NO_DUPLICATE | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | the guard exists and A1 defines the duplicate outcome, but no native run proves a second process refuses the replay |

**Evidence.**

- `failing_native_labels` = `[{'run_id': 41018366655, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022220148, 'head_sha': '122294f2237c1836d6f04561e090fe6aa6c6c0cf', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022547918, 'head_sha': 'f61afa23132ec5890834fa2cd0476d0edc8a51b1', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022975300, 'head_sha': '594730ea15a3e6db8d620fb89aef94e97fd6db11', 'failed': ['separate process restores exact ordinary and unique inventory', 'separate process restores exact structures, chests and permanent knowledge', 'world reconstruction does not duplicate carried items']}, {'run_id': 41022220324, 'head_sha': '122294f2237c1836d6f04561e090fe6aa6c6c0cf', 'failed': ['same-process disk reload preserves custody and rights']}, {'run_id': 41022547962, 'head_sha': 'f61afa23132ec5890834fa2cd0476d0edc8a51b1', 'failed': ['interrupted candidate leaves disk unchanged', 'same-process disk reload preserves custody and rights']}, {'run_id': 41022975283, 'head_sha': '594730ea15a3e6db8d620fb89aef94e97fd6db11', 'failed': ['interrupted candidate leaves disk unchanged', 'same-process disk reload preserves custody and rights']}]`
- `mounted_caller_count` = `11`
- `native_states` = `{'a0_normal_entry_home': 'STALE_HEAD', 'a0_second_process_restart': 'STALE_HEAD', 'a0_waystation_player_input': 'STALE_HEAD', 'a0_replay_negative': 'STALE_HEAD', 'a3_authority_fixture': 'STALE_HEAD', 'a0_save_precision': 'STALE_HEAD', 'a8_native_poi_contract': 'STALE_HEAD', 'a0_runtime_validation': 'STALE_HEAD'}`
- `s4_clauses` = `{'C1_exact_source_identity': 'NOT_HOLDS', 'C2_normal_entry': 'NOT_HOLDS', 'C3_independent_process': 'NOT_HOLDS', 'C4_authorised_commit': 'NOT_HOLDS', 'C5_negative_replay': 'NOT_HOLDS'}`
- `s4_granted` = `False`
- `save_fidelity` = `ROUND_TRIP_EXACT`
- `static_seam_state` = `MOUNTED_SURVIVAL_SYSTEM_CALLER`

## BLK-5 — The player body is still the Knight; the D051 bald male/female art is still not imported

**Player impact.** chapter1_overworld.gd still preloads game/characters/knight/knight.tscn and instantiates it as the player. A6 08ccb834 added a sprite pipeline, but its manifest still declares BASE_ART_NOT_IMPORTED with grade-0 idle_sheet empty for both 555940 and 419402, so there is nothing to mount. A player would control a Knight in a game whose locked identity is a bald human adventurer. A second A6 item rides along: acceptance_journeys.gd:241 and :340 hand fixture vocabulary to a Label, so mounting that viewer as-is would put 'READ-ONLY SCENARIO FIXTURE' on screen (PROD-04 WARN today; it becomes FAIL the moment the viewer is mounted).

**Owner.** A6 (import + adapter) with A0 (mount)  
**Evidence class.** PLAYER_FACING_VISUAL_DEFECT  
**Verified by.** quality Q-04 over the pinned tree (mounted scene identity, claimed sheets, adapter fallback)  
**Native run required to close.** False

**Run it natively (owner-side, exact command).**

```bash
# A6 + A0: the acceptance is a rendered body, not a string
godot --headless --path . --import
godot --path . --resolution 1280x720
# spawn from normal entry, then die, reload and respawn: the body must stay 555940/419402
```

**Reproduce the static finding.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/quality.json'));print([c for c in d['checks'] if c['check_id']=='Q-04'][0]['status'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/snapshot/product/a6.avatar_art_manifest.json'));print(d['status']);print({g:c['armor_grades']['0']['idle_sheet'] for g,c in d['characters'].items()})"
```

**Minimal safe correction.** Two A6 edits, neither of which needs A0: import the grade-0 idle sheet for ONE gender from the authorised archive and point the manifest at the installed file; and drop the two fixture labels from acceptance_journeys.gd before that viewer is mounted. A0 then mounts the scene behind the existing avatar seam. Grades 1-2 stay SOURCE_BLOCKED; no Knight substitution.

**Test that proves closure.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical`

**Still NOT_TESTED after closure.** 4-direction animation, armour swap and rendered frames (S5, human)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L4_AUTHORIZATION | `S0_ABSENT` | NOT_TESTED | `S0_ABSENT` | A8's two route actions have an item id but no authorized quantity, so neither can be paid |

**Evidence.**

- `canonical_avatar_production_refs` = `{'555940': 0, '419402': 0, '180537': 0}`
- `mounted_player_scene` = `game/characters/knight/knight.tscn`
- `q04` = `FAIL`
- `visual_state` = `NOT_TESTED`

## Closed, kept for traceability

### BLK-ENGINE-API — was: _A8's scenes call Vector2.from_array, which no Godot release exposes (15 sites)_

**Disposition.** `CLOSED_IN_SOURCE_RECLASSIFIED_BLK-3` at A8 c8b4bc88

**Why.** A8 added native_poi_vectors.gd with from_pair/from_int_pair and replaced every call. The oracle now reports ENGINE_API_CONSISTENT with 0 unknown calls over the pinned sources. It is not a native pass, so the residual moved to BLK-3 as SOURCE_FIXED_PENDING_NATIVE.

**Residual.** the native contract/transition steps have never been green on this sha.

**Still with the owner.** A8 runs its own two native steps.

**Evidence.**

- `engine_api` = `ENGINE_API_CONSISTENT`
- `historical_pin` = `5ccf7b3f: 15`
- `unknown_calls` = `0`

### BLK-MIRROR — was: _A0 shipped a stale copy of A3's source catalog (Q-03 drift)_

**Disposition.** `REOPENED_AS_BLK-2` at A3 c5e80922

**Why.** Round 5 closed this at A3 100b3406 where both copies matched. A3's V4 canonicalised the instance id to si:*, so A0's copy drifted again in exactly the three waystation rows - and this time the drift breaks the interaction. Reopened as BLK-2 rather than logged as a repeated finding.

**Residual.** until A0 re-vendors, the cache action cannot be authorized.

**Still with the owner.** A0 re-vendors A3's catalog bytes.

**Evidence.**

- `divergent` = `['road_notes', 'road_scrap', 'road_supplies']`
- `identical_rows` = `33`
- `q03` = `FAIL`

## A7 self-corrections

### CORR-9 — `STALE AT THE PIN, FIXED AT THE LIVE HEAD`

**A7's earlier claim.** BLK-2: A8 has 15 Vector2.from_array source errors and the scenes cannot position anything.

**What is actually true.** True of A8 5ccf7b3f, which round 5 pinned. A8 c8b4bc88 replaced all of them; the pinned sources now contain the string only inside a comment explaining why the constructor does not exist.

**What remains true.** no native evidence exists for the fixed code, so nothing is S4.

**Fix in this round.** classified SOURCE_FIXED_PENDING_NATIVE by comparing the pin, not by re-running the old claim.

### CORR-10 — `WRONG AT THE LIVE HEAD, RIGHT AT THE OLD PIN`

**A7's earlier claim.** Claim C: the A1 cache and A8 site are in no world a player can reach (ABSENT).

**What is actually true.** A0 9269739e mounts A1's real slice geometry and a five-point interaction host. The content is in production code. It is also behind a ProjectSettings key absent from project.godot, so the player still cannot reach it.

**What remains true.** no normal-input journey reaches the cache today.

**Fix in this round.** claim C gained MOUNTED_BY_DEFAULT / SOURCE_PRESENT_BEHIND_DISABLED_FLAG / ABSENT.

### CORR-11 — `TRUE AS NAMING, FALSE AS RUNTIME`

**A7's earlier claim.** The A1/A3 instance-id seam is closed: both ids are published for one object.

**What is actually true.** A3 publishes both, but only the si:* id is in the binding table, and A0's host sends the si:* id while A0's vendored table still keys the alias. Exact-string lookup therefore fails. The seam exists and does not connect.

**What remains true.** no quantity, price or cooldown is wrong; this is identity, not balance.

**Fix in this round.** oracle.instance_identity replays the shipped request against the loaded catalog.

### CORR-12 — `IT PROVES THE TRANSACTION HELPER, NOT THE ROUTE`

**A7's earlier claim.** The A0 authority fixture proves an A3-authorized reward commits.

**What is actually true.** The fixture hardcodes instance_id node_waystation_cache, an id the shipped host never sends, and funds its own inventory and clock. It cannot observe the mismatch it hides.

**What remains true.** the A3 transaction machinery does commit and does refuse replays.

**Fix in this round.** the oracle compares fixture instance ids against the host's request set.

### CORR-13 — `A CHECK CANNOT BE BOTH FAILING AND CLOSED, AND TWO OF ITS HITS WERE NOT TEXT AT ALL`

**A7's earlier claim.** PROD-04 can FAIL while the same payload records it as closed - 'a broad FAIL kept as a hygiene warning'.

**What is actually true.** Two defects, both in A7's own tooling. (1) 'schema' sat in the debug-vocabulary list, so a wire key (intent.get('schema'), 'schema': INTENT_SCHEMA) was counted as player prose. (2) Every string literal in an A6 file counted as player-visible, including logs and test summaries, so 107 hits hid the 2 that are actually handed to a Label. PROD-04 also mapped to the closed bucket, which silently dropped a red check.

**What remains true.** The two real hits are real: game/survival/ui/acceptance_journeys.gd:241 shows 'A6 READ-ONLY SCENARIO FIXTURE - NOT LIVE GAMEPLAY' on a Label, and :340 shows 'Fixture progress only ...'. They are latent, not live, because no shipped scene mounts A6's survival UI.

**Fix in this round.** PROD-04 now splits display-sink literals from unbound ones, reports FAIL only when the surface is mounted and WARN when it is latent, and maps to traceability rather than a closed bucket. 'schema' is off the token list.
