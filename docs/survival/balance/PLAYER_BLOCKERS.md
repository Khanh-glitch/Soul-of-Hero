# Player-facing blockers (A7, consolidated)

_Generated from `data/survival/balance/results/blockers.json` by `tools/survival/balance/run_analysis.py`. Do not edit by hand._

**57 observations -> 4 blockers (2 closed by measurement, 6 observations are traceability/hypothesis only).** A finding list is not a deliverable; these are the only things that currently stop a player. Verification is a static read of pinned sources — no runtime was executed, so every native claim below stays `NOT_TESTED` until its owner runs it. Proof levels are the gate's `S0`–`S5`: static work can earn at most `S3`.

| # | Blocker | Owner | Class | Closure probe |
|---|---|---|---|---|
| BLK-1 | No production mount: not one interaction is reachable with normal input | A0 (mount) with A1 (slice scene) and A8 (native site scene) | MISSING_PRODUCTION_MOUNT | `gate.entry.home_survival_keys non-empty and both chains report L1_ENTRY at S3_OWNER_SEAM_UNWIRED with no missing text` |
| BLK-2 | A1 already authorizes the first-hour cache; A3 has not adopted the binding | A3 (binding adoption), with A8 deferring to the same table | SOURCE_DATA_INCOMPATIBILITY | `binding_adoption.pending_rebind is empty and both chains report L4_AUTHORIZATION unblocked` |
| BLK-3 | The mounted player body is still Knight art and the locked avatar has no installed frames | A6 (art source + adapter) with A0 (mount) | PLAYER_FACING_VISUAL_DEFECT | `quality Q-04 PASS (mounted body resolves to a canonical source with a non-empty grade-0 sheet)` |
| BLK-4 | Every reward path that exists is fixture-only: nothing is committed, reloaded or de-duplicated | A0 (commit) with A8 (replace its fake authority) | FIXTURE_ONLY_SUCCESS | `gate.commit_seam.any_poi_calls_transact_once is true and a two-process reload test exists in the repo` |

## BLK-1 — No production mount: not one interaction is reachable with normal input

**Player impact.** The home screen offers campaign, hero roster, storage, modes, bestiary and settings. There is no survival destination, so a player cannot walk anywhere, interact with anything or find any item. A8's South Quarry scene is native and walkable, but it is only reachable through a test flag (its own emit is gated by 'test_harness_only := true').

**Owner.** A0 (mount) with A1 (slice scene) and A8 (native site scene)  
**Evidence class.** MISSING_PRODUCTION_MOUNT  
**Verified by.** integration gate over pinned bytes: waystation_cache and a8_quarry both report S0_ABSENT at L1_ENTRY; no runtime executed

**Reproduce.**

```bash
python3 tools/survival/balance/run_analysis.py
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print([(c['chain_id'],c['chain_level'],c['weakest_link']) for c in d['chains']])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['entry'])"
```

**Minimal safe correction.** A0 adds ONE home-screen destination whose scene instantiates the existing A1 world host and the existing A8 site scene behind the normal gameplay input gate (no test flag). Nothing else: no new system, no data edit, no other owner's file.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_closes_when_a_home_destination_exists`

**Still NOT_TESTED after closure.** that the mounted scene boots, is walkable and throws no console error (owner native run required)

**Gate links currently blocked.**

| Chain | Link | Level | Missing |
|---|---|---|---|
| a8_quarry | L1_ENTRY | `S0_ABSENT` | no home-screen destination reaches a survival/world/POI scene; the only entries into a world are test flags, which is exactly the 'looks integrated but is not' failure |
| a8_quarry | L2_ROUTE | `S2_FIXTURE_ONLY` | walkable inside the scene, but the scene is not placed in the A1 world graph |
| a8_quarry | L3_INTERACTION | `S2_FIXTURE_ONLY` | the interaction exists only in a test-harness scene |
| waystation_cache | L1_ENTRY | `S0_ABSENT` | no home-screen destination reaches a survival/world/POI scene; the only entries into a world are test flags, which is exactly the 'looks integrated but is not' failure |
| waystation_cache | L2_ROUTE | `S1_AUTHORED_ONLY` | the route is authored geometry; nothing native draws or collides it yet |
| waystation_cache | L3_INTERACTION | `S1_AUTHORED_ONLY` | the action exists only in authored data; no scene places the cache node |

**Evidence.**

- `a8_scene_is_harness_only` = `True`
- `chain_levels` = `{'waystation_cache': 'S0_ABSENT', 'a8_quarry': 'S0_ABSENT'}`
- `home_destinations` = `['bestiary', 'campaign', 'hero_roster', 'modes', 'settings', 'storage']`
- `home_survival_destinations` = `[]`
- `note` = `A1 records 118 POIs / 106 contract-only sites; none is reachable from a mounted screen`

**Absorbs** 4 observation(s).

## BLK-2 — A1 already authorizes the first-hour cache; A3 has not adopted the binding

**Player impact.** A1's vertical-slice contract pays iron_scrap 3 and knowledge_spares 2 from node_waystation_cache at poi_crown_waystation on a renewable 1800 s right, with the transaction key 'a1slice:poi_crown_waystation:cache_restock:1'. A3 still points those two source rows at the provisional class id 'poi:roadside_cache', so the reward has no physical instance to be paid at. A8's quarry pays its own fixed stone_chunk and records 'A3 cost authorization absent'.

**Owner.** A3 (binding adoption), with A8 deferring to the same table  
**Evidence class.** SOURCE_DATA_INCOMPATIBILITY  
**Verified by.** identity.binding_adoption over the A1 handoff contract and the pinned A3 sources: 0 of 3 authorized bindings adopted, yields already agree (3 / 2 / 2)

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['binding_adoption']['summary'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['binding_adoption']['pending_rebind'])"
```

**Minimal safe correction.** A3 adopts A1's own rebind request for road_scrap and road_supplies: set poi_id to poi_crown_waystation (class id stays a class id; the instance id is A1's), keep the yields A1 already authorizes, and list poi_crown_waystation in the a1_poi resolution. No quantity, rate or table changes. A8 then replaces its self-declared costs with the adopted table.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk2_closes_when_a3_adopts_the_a1_binding_without_changing_yields`

**Still NOT_TESTED after closure.** that the physical cache node exists in a scene, that the payment happens at runtime, and any Core rate (still absent, still not invented here)

**Gate links currently blocked.**

| Chain | Link | Level | Missing |
|---|---|---|---|
| a8_quarry | L4_AUTHORIZATION | `S0_ABSENT` | the site pays fixed quantities it declares itself; A3 never authorized them |
| waystation_cache | L4_AUTHORIZATION | `S1_AUTHORED_ONLY` | A1 authorizes the reward and its quantity, but A3's source rows still name the provisional class id 'poi:roadside_cache', so the adopted binding count is 0 |

**Evidence.**

- `a8_self_declared_costs` = `['repair_waterwheel', 'clear_irrigation', 'brace_east_shelf', 'chock_west_ramp']`
- `adopted_by_a3` = `0`
- `authorized_bindings` = `3`
- `loot_tables_referenced_by_production_code` = `[]`
- `pending_rebind` = `[{'source_id': 'road_scrap', 'a1_poi': 'poi_crown_waystation', 'a3_poi': 'poi:roadside_cache', 'yield': 3, 'yield_agrees': True}, {'source_id': 'road_supplies', 'a1_poi': 'poi_crown_waystation', 'a3_poi': 'poi:roadside_cache', 'yield': 2, 'yield_agrees': True}, {'source_id': 'live_oak_wood', 'a1_poi': 'poi_crown_waystation', 'a3_poi': None, 'yield': 2, 'yield_agrees': True}]`

**Absorbs** 48 observation(s).

## BLK-3 — The mounted player body is still Knight art and the locked avatar has no installed frames

**Player impact.** The character on screen is the old Knight. The user locked two bald unarmoured bodies (male 555940, female 419402) with armour stages driven by equipped gear; A6's new art manifest has an empty grade-0 sheet and null grades 1-2, so the adapter honestly returns SOURCE_BLOCKED and no production file references either source. A swordsman pack (180537) is not a substitute.

**Owner.** A6 (art source + adapter) with A0 (mount)  
**Evidence class.** PLAYER_FACING_VISUAL_DEFECT  
**Verified by.** quality Q-04 over the pinned A6 manifest, adapter and mounted body (A6 bed3fc81)

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/quality.json'));print([c for c in d['checks'] if c['check_id']=='Q-04'])"
```

**Minimal safe correction.** A6 installs the grade-0 idle sheet for the chosen gender from the user's Drive ZIP (one sheet, one manifest entry) and keeps grades 1-2 SOURCE_BLOCKED until gender-matched armour frames exist. A0 then swaps the mounted body. Do not report the Knight body as accepted.

**Test that proves closure.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical`

**Still NOT_TESTED after closure.** animation fidelity, feet anchors, readability at 720p-4K, licence, armour reversal on unequip (human review)

**Evidence.**

- `armor_stage_art_refs` = `[]`
- `canonical_source_doc_refs` = `{'555940': 11, '419402': 9, '180537': 5}`
- `canonical_source_production_refs` = `{'555940': 0, '419402': 0, '180537': 0}`
- `mounted_player_scene` = `game/characters/knight/knight.tscn`
- `q04_detail` = `None`
- `q04_status` = `FAIL`

**Absorbs** 1 observation(s).

## BLK-4 — Every reward path that exists is fixture-only: nothing is committed, reloaded or de-duplicated

**Player impact.** SaveService.transact_once is idempotent and records receipts, and A1's contract names the exact transaction keys to use, but no mounted path calls it. A8's pilot installs PoiAuthorityFixture, which declares itself test-only and keeps inventory in memory, so a quarry claim cannot survive a reload. The only reload evidence in the repo reuses one process, which cannot prove durable restore or prove that a replay is refused.

**Owner.** A0 (commit) with A8 (replace its fake authority)  
**Evidence class.** FIXTURE_ONLY_SUCCESS  
**Verified by.** integration gate L5/L6/L7 on both chains (S3_OWNER_SEAM_UNWIRED and S0_ABSENT), plus a read of a0 save_service.gd transact_once and the A8 fixture header

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['commit_seam']);print(d['authority_a8'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['blocked_links'])"
```

**Minimal safe correction.** A0 wires the cache claim to SaveService.transact_once with A1's transaction key, and adds the two-process reload test in gate.native_commands_for_owner['process_restart_reload'] (one process claims, a second process re-reads and asserts ALREADY_APPLIED). A8 swaps its fixture for the SaveService adapter and keeps the fixture in tests only.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_closes_when_a_mounted_path_commits_through_transact_once`

**Still NOT_TESTED after closure.** that the commit is durable across a real OS restart and that the second process reads the same document (S4 requires the owner's native two-process run)

**Gate links currently blocked.**

| Chain | Link | Level | Missing |
|---|---|---|---|
| a8_quarry | L5_COMMIT | `S3_OWNER_SEAM_UNWIRED` | a fake authority commits the reward; SaveService is never called |
| a8_quarry | L6_RELOAD | `S0_ABSENT` | site state lives only in fixture memory, so reload cannot preserve anything |
| a8_quarry | L7_NO_DUPLICATE | `S2_FIXTURE_ONLY` | claims are deduplicated inside the fixture only |
| waystation_cache | L5_COMMIT | `S3_OWNER_SEAM_UNWIRED` | the owner API and the contract key exist, but no mounted path calls them, so the reward has never been committed by a player action |
| waystation_cache | L6_RELOAD | `S3_OWNER_SEAM_UNWIRED` | no evidence anywhere restarts the OS process; A0's existing reload check reuses one process, which cannot prove durable restore |
| waystation_cache | L7_NO_DUPLICATE | `S3_OWNER_SEAM_UNWIRED` | the pieces exist on both sides but are not joined, so nothing is protected at runtime yet |

**Evidence.**

- `authority_a8` = `{'fixture_declares_test_only': True, 'fixture_keeps_state_in_memory': True, 'fixture_uses_save_service': False, 'site_emits_intent': True, 'intent_contract_id': 'soh.native_poi.intent.v1', 'harness_only_by_default': True, 'pilot_installs_fixture': True}`
- `blocked_links` = `[{'chain_id': 'a8_quarry', 'link': 'L5_COMMIT', 'level': 'S3_OWNER_SEAM_UNWIRED'}, {'chain_id': 'a8_quarry', 'link': 'L6_RELOAD', 'level': 'S0_ABSENT'}, {'chain_id': 'a8_quarry', 'link': 'L7_NO_DUPLICATE', 'level': 'S2_FIXTURE_ONLY'}, {'chain_id': 'waystation_cache', 'link': 'L5_COMMIT', 'level': 'S3_OWNER_SEAM_UNWIRED'}, {'chain_id': 'waystation_cache', 'link': 'L6_RELOAD', 'level': 'S3_OWNER_SEAM_UNWIRED'}, {'chain_id': 'waystation_cache', 'link': 'L7_NO_DUPLICATE', 'level': 'S3_OWNER_SEAM_UNWIRED'}]`
- `commit_seam` = `{'transact_once_exists': True, 'receipt_recorded': True, 'replay_rejected': True, 'survival_service_uses_transact_once': True, 'any_poi_calls_transact_once': False, 'two_process_reload_test': False}`
- `two_process_reload_evidence` = `False`

**Absorbs** 0 observation(s).

## Closed by measurement (kept for traceability)

### BLK-BOOTSTRAP — was: _First research is a bootstrap cycle, so the knowledge ladder cannot start_

**Disposition.** `CLOSED_MEASURED_FALSE` at round 3, A1 2951bf85 / A3 18e7afcb

**Why the earlier claim was wrong.** The earlier claim read only the static make_spares -> research station edge. A1's own handoff contract authorizes 2 knowledge_spares per Waystation cache claim (renewable, 1800 s) with a transaction key, and research_kit is built at a workbench, not at a research station, so the ladder can start without any station.

**Residual note.** Two cache claims are needed for 3 spares, i.e. one 1800 s cooldown wait. That is a pacing question for A3, not a dead end, and no new source or rate is proposed.

**Still with the owner.** A3 wants to confirm the 30-minute first-station wait is intended pacing.

**Evidence.**

- `cache_cooldown_seconds` = `1800`
- `cache_spares_per_claim` = `2`
- `claims_needed_for_first_station_kit` = `2`
- `no_rate_changed` = `True`
- `research_kit_spares` = `3`
- `research_kit_station` = `workbench`

### BLK-DEBUG-UI — was: _The only survival UI is developer-facing and duplicates A0's HUD job_

**Disposition.** `CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN` at round 3, A0 77e434a7 / A6 bed3fc81

**Why the earlier claim was wrong.** The old count of ~100 developer tokens was a whole-file grep. Measured on mounted surfaces the vocabulary is behind '_developer_diagnostics' (default false) and no production scene mounts the survival UI at all, so a player cannot see it. The three HUD scripts own disjoint jobs (a0.hud health, a0.overworld_hud provisions, a6 context/core/feedback), so there is no duplicate ownership to fix either.

**Residual note.** PROD-04 keeps its broad file-level token measure and stays FAIL; that is a hygiene warning, not a player-facing blocker. The moment any scene mounts this UI, Q-02 re-opens as a blocker.

**Still with the owner.** A6 keeps the debug panel opt-in when it mounts the UI.

**Evidence.**

- `developer_diagnostics_default` = `False`
- `hud_jobs` = `['a0.hud.gd=health', 'a0.overworld_hud.gd=provisions', 'a6.player_first_hud.gd=context/core/feedback']`
- `quality_checks` = `{'Q-02': 'PASS', 'Q-06': 'PASS'}`
- `survival_ui_mounted_by_a_production_scene` = `False`
