# B0 evidence matrix — what a player can and cannot do at this pin

_Generated from `data/survival/balance/results/matrix.json`. Do not edit by hand; regenerate with `python3 tools/survival/balance/run_analysis.py`._

**Heads.** A0 `9269739e` · A1 `939720d5` · A3 `c5e80922` · A6 `08ccb834` · A8 `c8b4bc88`

**B0 verdict.** `B0_NOT_MET` — strongest row `SOURCE_FIXED_PENDING_NATIVE`.

**Anti-vacuity.** `NO_KNOWN_SPOOF_SURVIVES` — 15/15 spoof probes rejected; open holes: [].

| Gap | What a player can do now | Owner | State | May claim |
|---|---|---|---|---|
| `GAP-1` | A player can open the survival overworld through the ordinary menu and walk it. They cannot reach the Waystation: the mount is behind a project setting the shipped game does not enable, and no native run has ever walked there. | A0 | `SOURCE_PRESENT_BEHIND_GUARD` | `SOURCE_ABSENT`, `SOURCE_PRESENT_BEHIND_GUARD` |
| `GAP-2` | Standing at the cache and pressing interact fails: the request A0 sends uses the A3 world instance id si:r_ashen_crown:waystation_cache:01, and the catalog A0 ships still keys the old alias node_waystation_cache. The player sees a refusal, not 3 scrap + 2 spares. | A0 (re-vendor) + A3 (canonical id) | `SOURCE_PRESENT_UNRESOLVED` | `SOURCE_PRESENT_UNRESOLVED` |
| `GAP-3` | Nothing about A8's sites is visible to a player: they are not in the mounted world. The scenes themselves no longer call a non-existent engine method, and their native contract step has not been green on this sha. | A8 | `SOURCE_FIXED_PENDING_NATIVE` | `SOURCE_FIXED_PENDING_NATIVE` |
| `GAP-4` | A player on this build has no evidence-backed guarantee that a session survives a restart, because no run on this sha has executed entry, real input, a second process or a replay refusal. S4 is 0 of 5 clauses. | A0 | `RUNTIME_UNKNOWN` | `RUNTIME_UNKNOWN` |
| `GAP-5` | A player controls a Knight. The two user-locked bald bodies (555940 male, 419402 female) exist as inspected source archives, not as imported sheets, so nothing can be shown even if A0 swapped the scene today. | A6 (import) + A0 (mount) | `SOURCE_ABSENT` | `SOURCE_ABSENT` |
| `GAP-7` | No player can reach an A8 site, and enabling the Waystation flag would not change that: the mounted world is 448x256 tiles, its one imported annex is (384,192)-(448,256), and the three site anchors sit at y=280, 300 and 360. A scene cannot be walked to from outside the map. | A1 (anchors) + A0 (mount mode) + A8 (shell footprint) | `SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD` | `SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD` |
| `GAP-6` | A player can harvest wood and stone all hour and still never build the first research station: every spare recipe needs a station, the kit costs 3 spares, and the only non-circular seed is the cache reward that cannot be paid yet. | A1 + A3 (data), A0 (mount) | `SOURCE_PRESENT_BEHIND_GUARD` | `SOURCE_PRESENT_BEHIND_GUARD` |

## GAP-1 — The Waystation exists in production code but no normal player can reach it

**Now.** A player can open the survival overworld through the ordinary menu and walk it. They cannot reach the Waystation: the mount is behind a project setting the shipped game does not enable, and no native run has ever walked there.

**Smallest safe fix.** A0 decides the guard's default. Either set survival/a0_waystation_candidate=true in project.godot once the interaction is proven, or mount the host unconditionally and keep the flag for the annex geometry only. One line, no new system.

**Closure probe.** claim C is MOUNTED_BY_DEFAULT and guard.enabled_by_default is true

**Test that flips.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_needs_a_production_path_not_a_test_harness`

**Reproduce.** `xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 --script res://tests/survival/balance_native/first_hour_route_probe.gd`

**Still unproven after closure.** that the branch boots and the points are interactable (native run)

**Evidence.**

- `claim_C` = `SOURCE_PRESENT_BEHIND_DISABLED_FLAG`
- `entry_native` = `{'evidence_id': 'a0_normal_entry_home', 'state': 'STALE_HEAD', 'run_id': None, 'head_sha': None, 'phrase_found': False, 'other_commit_runs': [{'run_id': 41040890904, 'head_sha': '7f3ca17e90948c20e0355622d3960bf31f5455c7', 'status': 'queued', 'conclusion': ''}, {'run_id': 41034571991, 'head_sha': '2203ea9ff33df2cba48f313355e31e4a43f87607', 'status': 'queued', 'conclusion': ''}, {'run_id': 41034207749, 'head_sha': '7460f40f28b2d05a02d60389e7e6d6c5150cff6d', 'status': 'queued', 'conclusion': ''}, {'run_id': 41033678046, 'head_sha': '34f5e27ed5c144a7155c857990a5ff29d31fe24e', 'status': 'queued', 'conclusion': ''}, {'run_id': 41029607430, 'head_sha': '51f2cce8d09f55e474935f71e7ed76d77bd81ae0', 'status': 'queued', 'conclusion': ''}, {'run_id': 41029252684, 'head_sha': '8a0dbd4943b9a909373f32c578d3d242000dae8d', 'status': 'queued', 'conclusion': ''}, {'run_id': 41029028350, 'head_sha': 'cdbcffcdeae2e1dced5e27b89d0d7e713158fbb9', 'status': 'queued', 'conclusion': ''}, {'run_id': 41022975300, 'head_sha': '594730ea15a3e6db8d620fb89aef94e97fd6db11', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41022547918, 'head_sha': 'f61afa23132ec5890834fa2cd0476d0edc8a51b1', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41022220148, 'head_sha': '122294f2237c1836d6f04561e090fe6aa6c6c0cf', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41018366655, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'status': 'completed', 'conclusion': 'failure'}], 'proves': 'a normal menu route reaches the overworld in native Godot'}`
- `guard_declared_in_project` = `False`
- `guard_enabled_by_default` = `False`
- `guard_setting` = `survival/a0_waystation_candidate`
- `reproduce` = `python3 tools/survival/balance/run_analysis.py`

## GAP-2 — The cache reward cannot resolve even if the player enables the guard

**Now.** Standing at the cache and pressing interact fails: the request A0 sends uses the A3 world instance id si:r_ashen_crown:waystation_cache:01, and the catalog A0 ships still keys the old alias node_waystation_cache. The player sees a refusal, not 3 scrap + 2 spares.

**Smallest safe fix.** A0 re-vendors A3 c5e80922's world_source_bindings.v3.json byte-for-byte (three bindings, si ids, instance_id + interaction_node_id + identity), and changes its authority test to send the host's request instead of the alias. No quantity, cooldown or price changes.

**Closure probe.** oracle.instance_identity is IDENTITY_CONSISTENT and no host request is unresolved

**Test that flips.** `tests/survival/balance/test_oracle.py::InstanceIdentityOracleTests::test_the_alias_cannot_stand_in_for_the_world_instance`

**Reproduce.** `python3 tools/survival/balance/run_analysis.py && python3 -c "import json;print([r for r in json.load(open('data/survival/balance/results/oracle.json'))['instance_identity']['unresolved_host_requests']])"`

**Still unproven after closure.** that the transaction commits durably (BLK-4)

**Evidence.**

- `a3_only_bindings` = `['cache_restock@si:r_ashen_crown:waystation_cache:01', 'salvage_roadside_notes@si:r_ashen_crown:roadside_supply:01']`
- `fixture_ids_absent_from_host` = `['node_waystation_cache']`
- `host_instance_ids` = `['node_waystation_approach_deadfall', 'si:r_ashen_crown:waystation_cache:01']`
- `identity_verdict` = `HOST_ACTION_UNRESOLVED`
- `unresolved` = `[{'point': 'cache', 'action_id': 'cache_restock', 'instance_id': 'si:r_ashen_crown:waystation_cache:01', 'poi_id': 'poi_crown_waystation', 'resolved_in_a0_catalog': False, 'resolved_in_a3_catalog': True, 'a0_binding_id': None, 'a3_binding_id': 'a1_waystation_roadside_cache_v3'}]`

## GAP-3 — A8's native POI steps are fixed in source and unproven in the engine

**Now.** Nothing about A8's sites is visible to a player: they are not in the mounted world. The scenes themselves no longer call a non-existent engine method, and their native contract step has not been green on this sha.

**Smallest safe fix.** A8 lands those two native steps green on a pushed sha and uploads the artifact. No code change is implied by this blocker any more.

**Closure probe.** a8_native_poi_contract is VERIFIED on the pinned sha

**Test that flips.** `tests/survival/balance/test_oracle.py::EngineApiOracleTests::test_a8_call_sites_disappear_after_the_conversion`

**Reproduce.** `gh run list --workflow a8-world-content-native.yml --commit c8b4bc88 && gh run view <run-id> --log`

**Still unproven after closure.** that the scenes are reachable in A0's world (BLK-1)

**Evidence.**

- `historical_pin` = `5ccf7b3f had 15 unknown calls`
- `native_state` = `{'evidence_id': 'a8_native_poi_contract', 'state': 'QUEUED', 'run_id': 41033849972, 'head_sha': 'c8b4bc881d6744bac0f0826a639624ee1434e534', 'phrase_found': False, 'other_commit_runs': [{'run_id': 41040398338, 'head_sha': '1426a0eb250a0a680081c2dfabfe4eb339f61f5d', 'status': 'queued', 'conclusion': ''}, {'run_id': 41037830473, 'head_sha': '6223a02ccb3822d5d397ed185af048f7159687fc', 'status': 'queued', 'conclusion': ''}, {'run_id': 41033322405, 'head_sha': 'd6f1172846881b7d3992e5120350643eac53a8c3', 'status': 'queued', 'conclusion': ''}, {'run_id': 41032553904, 'head_sha': 'f54d8f1776b091b6e7e0b9344c51f18e4330e711', 'status': 'queued', 'conclusion': ''}, {'run_id': 41024526858, 'head_sha': '5ccf7b3f9824daa138b5d98106b74a2899c7592b', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41024442152, 'head_sha': '9c180ef115bc53b1aa48e39a46a1a8fa7426c602', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41019689728, 'head_sha': '2d7f10d355cb57692a321f3ca633550d31385157', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41019182407, 'head_sha': '2ad531f9e099cc3a29709da176e7a34b05a9a15b', 'status': 'completed', 'conclusion': 'failure'}, {'run_id': 41019032228, 'head_sha': 'c0ae902542a31c37bdfdc8f72d452cbf430e6747', 'status': 'completed', 'conclusion': 'failure'}], 'proves': 'the native POI scene loads and its intent contract runs'}`
- `unknown_engine_calls` = `0`

## GAP-4 — No native journey on the current sha: every required run is stale or queued

**Now.** A player on this build has no evidence-backed guarantee that a session survives a restart, because no run on this sha has executed entry, real input, a second process or a replay refusal. S4 is 0 of 5 clauses.

**Smallest safe fix.** A0 runs the two halves on the pinned sha and cites the green runs. Nothing else in A7's scope can move this: S4 is owner-native evidence only.

**Closure probe.** gate s4_granted is true: all five clauses hold on the pinned sha

**Test that flips.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_all_five_s4_clauses`

**Reproduce.** `xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 --script res://tests/survival/balance_native/bed_death_bag_probe.gd -- --verify-separate-process`

**Still unproven after closure.** that a human finds the route and enjoys it (S5)

**Evidence.**

- `clauses` = `{'C1_exact_source_identity': 'NOT_HOLDS', 'C2_normal_entry': 'NOT_HOLDS', 'C3_independent_process': 'NOT_HOLDS', 'C4_authorised_commit': 'NOT_HOLDS', 'C5_negative_replay': 'NOT_HOLDS'}`
- `native_states` = `{'a0_normal_entry_home': 'STALE_HEAD', 'a0_second_process_restart': 'STALE_HEAD', 'a0_waystation_player_input': 'STALE_HEAD', 'a0_replay_negative': 'STALE_HEAD', 'a3_authority_fixture': 'STALE_HEAD', 'a0_save_precision': 'STALE_HEAD', 'a8_native_poi_contract': 'QUEUED', 'a0_runtime_validation': 'QUEUED'}`
- `probe_evidence_class` = `NATIVE_UNEXECUTED`
- `probe_verdict` = `PROBES_STATICALLY_SOUND_NOT_EXECUTED`
- `probes` = `['/home/user/Soul-of-Hero/tests/survival/balance_native/avatar_body_probe.gd', '/home/user/Soul-of-Hero/tests/survival/balance_native/bed_death_bag_probe.gd', '/home/user/Soul-of-Hero/tests/survival/balance_native/first_hour_route_probe.gd']`
- `s4_granted` = `False`
- `save_fidelity` = `ROUND_TRIP_EXACT`

## GAP-5 — The playable body is the Knight, not the locked bald adventurer

**Now.** A player controls a Knight. The two user-locked bald bodies (555940 male, 419402 female) exist as inspected source archives, not as imported sheets, so nothing can be shown even if A0 swapped the scene today.

**Smallest safe fix.** Two A6 edits, neither of which needs A0: import the grade-0 idle sheet for ONE gender from the authorised archive and point the manifest at the installed file; and drop the two fixture labels from acceptance_journeys.gd before that viewer is mounted. A0 then mounts the scene behind the existing avatar seam. Grades 1-2 stay SOURCE_BLOCKED; no Knight substitution.

**Closure probe.** Q-04 PASS with the canonical body mounted and every claimed sheet present

**Test that flips.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical`

**Reproduce.** `xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 --script res://tests/survival/balance_native/avatar_body_probe.gd`

**Still unproven after closure.** 4-direction animation, armour swap and rendered frames (S5, human)

**Evidence.**

- `adapter_referenced_from_a0` = `[]`
- `mounted_scene` = `game/characters/knight/knight.tscn`
- `q04` = `FAIL`
- `q09` = `FAIL`

## GAP-7 — Every A8 site anchor lies outside the world A0 actually mounts

**Now.** No player can reach an A8 site, and enabling the Waystation flag would not change that: the mounted world is 448x256 tiles, its one imported annex is (384,192)-(448,256), and the three site anchors sit at y=280, 300 and 360. A scene cannot be walked to from outside the map.

**Smallest safe fix.** A1 must either move the anchors inside the mounted world or author the extension; A0 must then mount it as one contiguous surface (annex_build is disabled pending a composite validator) or declare the sites interior instances entered from a canonical anchor. A8 supplies a shell whose collision footprint fits the authored radius.

**Closure probe.** every site's canonical_cell satisfies 0 <= cell < world_bounds and its direct_overworld_mount_decision is not REJECT

**Test that flips.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_q08_passes_when_anchors_are_inside_and_the_mount_decision_is_not_reject`

**Reproduce.** `python3 tools/survival/balance/run_analysis.py && python3 -c "import json;print([c['status'] for c in json.load(open('data/survival/balance/results/quality.json'))['checks'] if c['check_id']=='Q-08'])"`

**Still unproven after closure.** that the composed surface has no seam the Hero can fall through (native walk required)

**Evidence.**

- `annex` = `(384, 192, 448, 256)`
- `q08` = `FAIL`
- `sites` = `[{'site_id': 'crown_south_quarry', 'canonical_cell': [30, 280], 'inside_mounted_world': False, 'inside_imported_annex': False, 'decision': 'REJECT_FOOTPRINT_MISMATCH', 'fits_authored_footprint_1_to_1': False, 'site_root_position_px': [-18, 4186]}, {'site_id': 'crown_south_orchard', 'canonical_cell': [140, 360], 'inside_mounted_world': False, 'inside_imported_annex': False, 'decision': 'REJECT_FOOTPRINT_MISMATCH', 'fits_authored_footprint_1_to_1': False, 'site_root_position_px': [1738, 5476]}, {'site_id': 'crown_south_mill', 'canonical_cell': [120, 300], 'inside_mounted_world': False, 'inside_imported_annex': False, 'decision': 'REJECT_FOOTPRINT_MISMATCH', 'fits_authored_footprint_1_to_1': False, 'site_root_position_px': [1400, 4514]}]`
- `world_bounds` = `{'w': 448, 'h': 256}`

## GAP-6 — The research ladder has exactly one seed, and that seed is behind GAP-1/GAP-2

**Now.** A player can harvest wood and stone all hour and still never build the first research station: every spare recipe needs a station, the kit costs 3 spares, and the only non-circular seed is the cache reward that cannot be paid yet.

**Evidence.**

- `claims_needed` = `2`
- `non_circular_recipes` = `[]`
- `seeded_by` = `['road_supplies']`
- `verdict` = `SEEDED_ONLY_BY_LOOT`

## Rule

A row may never claim more than its weakest column. SOURCE_FIXED_PENDING_NATIVE is not a native pass; NATIVE_VERIFIED requires a green owner run on this sha; VISUAL_INSPECTED requires frames a human looked at.
