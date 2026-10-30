# Player-facing blockers (A7, consolidated v4)

_Generated from `data/survival/balance/results/blockers.json` by `tools/survival/balance/run_analysis.py`. Do not edit by hand._

**55 observations -> 5 blockers (3 closed, 5 A7 self-corrections, 6 observations traceability only).** Proof levels are the gate's `S0`–`S5`. Source text can reach `S3`; `S4` requires a green native run on the pinned commit, which no owner has yet. Nothing below was executed by A7.

| # | Blocker | Owner | Class | Closure probe |
|---|---|---|---|---|
| BLK-1 | The world is reachable, but the A1 cache and A8 site are not mounted in it | A0 (mount) with A1 (cell + instance identity) and A8 (scene) | MISSING_PRODUCTION_MOUNT | `gate L2 reaches a non-empty mounted content set and both chains lose their L2 blocker` |
| BLK-2 | A0 ships a stale copy of A3's source catalog, so two owners disagree about the first-hour cache | A0 | SOURCE_DATA_INCOMPATIBILITY | `quality Q-03 reports the A0 mirror as MATCH (36/36 identical rows)` |
| BLK-3 | The mounted player body is not the locked avatar, and no grade-0 sheet is installed | A6 (art import + adapter) with A0 (mount) | PLAYER_FACING_VISUAL_DEFECT | `Q-04 static verdict REFERENCE_CONSISTENT (canonical mount + every claimed sheet exists)` |
| BLK-4 | No A1-contract-keyed claim exists, and no native run verifies the reload path | A0 (claim + native run) with A8 (drop its fixture) | FIXTURE_ONLY_SUCCESS | `gate commit_seam.static_state == MOUNTED_A1_CONTRACT_CALLER AND evidence a0_two_process_reload == VERIFIED on the pinned head` |
| BLK-5 | A8's quarry route actions have an item id but no authorized quantity | A3 | UNAUTHORIZED_COST | `gate a8_candidate.unpriced_actions is empty and the A8 chain L4 unblocks` |

## BLK-1 — The world is reachable, but the A1 cache and A8 site are not mounted in it

**Player impact.** A player can now walk the menu route Home -> Campaign -> Enter Overworld into A0's own overworld. That world contains no A1 city node and no A8 site scene, so there is nothing to loot: the Waystation cache exists only as an authored contract and the quarry only as a harness scene.

**Owner.** A0 (mount) with A1 (cell + instance identity) and A8 (scene)  
**Evidence class.** MISSING_PRODUCTION_MOUNT  
**Verified by.** gate L2 on both chains (source_state absent-of-content) plus a grep of every pinned A0 byte for poi_crown_waystation / node_waystation_cache / crown_south_quarry  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['entry_content'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print([(c['chain_id'],c['chain_level'],c['weakest_link']) for c in d['chains']])"
```

**Minimal safe correction.** A0 places ONE thing into the overworld the route already reaches: the A1 slice node node_waystation_cache at poi_crown_waystation, or the A8 quarry scene at its A1 cell. A1 supplies the cell and the persistent instance identity; A8/A1 supply the scene. No new system, no data edit.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_closes_when_content_is_mounted`

**Still NOT_TESTED after closure.** that the mounted node boots and is walkable (native run required)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L1_ENTRY | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | route exists in source; native run is STALE_HEAD |
| a8_quarry | L2_ROUTE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | walkable inside its own harness scene only; not placed in the reachable world and it declares physical_instance_id = null |
| a8_quarry | L3_INTERACTION | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | the interaction only runs inside a test-harness scene |
| waystation_cache | L1_ENTRY | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | the route exists in source, but the native run that would prove it executes is STALE_HEAD |
| waystation_cache | L2_ROUTE | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the reachable overworld contains no A1 city node and no A8 site scene, so there is no walkable route to the interaction yet |
| waystation_cache | L3_INTERACTION | `S1_AUTHORED_ONLY` | NOT_TESTED | `S1_AUTHORED_ONLY` | the action exists only in authored data; no mounted scene places the cache node |

**Evidence.**

- `a1_instance_refs_in_a0` = `[]`
- `a8_instance_refs_in_a0` = `[]`
- `a8_site_scenes_in_overworld` = `[]`
- `content_mounted` = `ABSENT`
- `entry_route_exists` = `SOURCE_PRESENT`

## BLK-2 — A0 ships a stale copy of A3's source catalog, so two owners disagree about the first-hour cache

**Player impact.** A3 adopted A1's rebind at c23292be: road_scrap and road_supplies now point at poi_crown_waystation / node_waystation_cache with A1's own 3 and 2 yields, so A7 changed no loot rate. A0's mirrored data/survival/items/sources.json still says poi:roadside_cache for exactly those two rows (34/36 identical), so a runtime that reads A0's copy would look for a container that no longer exists. Measured consequence of the rebind: the first-hour safe loop now returns 3 iron_scrap + 2 knowledge_spares from a single crown claim, and research_kit needs 3 spares, so the first station costs a second claim after the 1800 s restock - pacing, not a dead end.

**Owner.** A0  
**Evidence class.** SOURCE_DATA_INCOMPATIBILITY  
**Verified by.** quality Q-03 mirror comparison over the pinned A0 mirror and the pinned A3 catalog (34/36 rows identical)  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/quality.json'));print([c for c in d['checks'] if c['check_id']=='Q-03'][0]['evidence'][-1])"
```

**Minimal safe correction.** A0 re-syncs the two drifted rows (or deletes the mirror and reads A3's file). One file, two rows, no quantity change: the yields already agree.

**Test that proves closure.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk2_closes_when_the_a0_mirror_matches_a3`

**Still NOT_TESTED after closure.** that the runtime actually reads the catalog at claim time

**Evidence.**

- `a1_cache_restock_seconds` = `[1800]`
- `a3_rebind_adopted` = `2`
- `a3_rebind_required` = `2`
- `binding_adoption` = `3/3 A1-authorized source bindings are adopted by A3 (2/2 instance rebinds, 1 live-source reuse).`
- `mirror` = `[{'fact': 'A0 mirror of the A3 catalog', 'value': {'status': 'DRIFT', 'mirror_rows': 36, 'a3_rows': 36, 'identical_rows': 34, 'divergent': ['road_scrap', 'road_supplies'], 'only_in_mirror': [], 'only_in_a3': []}}]`

## BLK-3 — The mounted player body is not the locked avatar, and no grade-0 sheet is installed

**Player impact.** The body on screen is the old Knight. A6 declares the two locked identities (Craftpix 555940 male, 419402 female) but every claimed sheet is empty, the adapter honestly returns SOURCE_BLOCKED, and armour grades 1-2 are null. A player sees the wrong character.

**Owner.** A6 (art import + adapter) with A0 (mount)  
**Evidence class.** PLAYER_FACING_VISUAL_DEFECT  
**Verified by.** quality Q-04: identity + claimed-sheet existence against the pinned tree  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/quality.json'));print([c for c in d['checks'] if c['check_id']=='Q-04'][0])"
```

**Minimal safe correction.** A6 installs the grade-0 idle sheet for ONE gender from the user's authorised ZIP and points the manifest at the installed file; A0 mounts the canonical body. Grades 1-2 stay SOURCE_BLOCKED until gender-matched armour art is chosen. Never substitute Knight/Swordsman for the base identity.

**Test that proves closure.** `tests/survival/balance/test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical`

**Still NOT_TESTED after closure.** directional animation, equipment swap and rendered frames (visual_state stays NOT_TESTED; S5 needs a human)

**Evidence.**

- `mounted_player_scene` = `game/characters/knight/knight.tscn`
- `q04` = `WRONG_MOUNTED_IDENTITY`
- `visual_state` = `NOT_TESTED`

## BLK-4 — No A1-contract-keyed claim exists, and no native run verifies the reload path

**Player impact.** A0's SaveService is idempotent, eight proven mounted callers commit through it (harvest and transfers in SurvivalService, five campaign paths in AppFlow) and A0 ships a genuine two-process reload test. What does not exist is a caller keyed on A1's cache contract, so the Waystation reward cannot be paid; A8's quarry commits through an in-memory fixture. On top of that, every owner workflow at the pinned heads is still queued, so no native run has verified any of it.

**Owner.** A0 (claim + native run) with A8 (drop its fixture)  
**Evidence class.** FIXTURE_ONLY_SUCCESS  
**Verified by.** gate L5/L6/L7 (static seam state + evidence file); the evidence file records every run with its commit, so a green run on another commit cannot be spent here  
**Native run required to close.** True

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['commit_seam']['static_state'], d['commit_seam']['mounted_caller_count'], d['commit_seam']['rejected_count'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['native_states'])"
```

**Minimal safe correction.** A0 adds ONE caller keyed on 'a1slice:poi_crown_waystation:cache_restock:1' that pays the A1 binding through add_items_to_candidate inside transact_once; then lands the queued a0-normal-entry-home-restart workflow green on this commit. A8 swaps its fixture for that caller.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_both_a_contract_caller_and_native_evidence`

**Still NOT_TESTED after closure.** durability on a real device, and interaction feel (human)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L5_COMMIT | `S2_SCENE_FIXTURE` | STALE_HEAD | `S2_SCENE_FIXTURE` | a fake authority commits the reward; SaveService is never called on this path |
| a8_quarry | L6_RELOAD | `S0_ABSENT` | STALE_HEAD | `S0_ABSENT` | site state lives only in fixture memory, so reload cannot preserve anything |
| a8_quarry | L7_NO_DUPLICATE | `S2_SCENE_FIXTURE` | NOT_TESTED | `S2_SCENE_FIXTURE` | claims are deduplicated inside the fixture only |
| waystation_cache | L5_COMMIT | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | survival commits are live (harvest/structures/death) and campaign rewards are live, but no caller is keyed on an A1 contract key: the Waystation cache has no claim path, and A8's POI still commits through an in-memory fixture (3 survival callers, 0 A1-contract callers) |
| waystation_cache | L6_RELOAD | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | a real two-process reload test exists in source, but its native run is STALE_HEAD |
| waystation_cache | L7_NO_DUPLICATE | `S3_PRODUCTION_SEAM` | STALE_HEAD | `S3_PRODUCTION_SEAM` | the guard exists and A1 defines the duplicate outcome, but no native run proves a second process refuses the replay |

**Evidence.**

- `mounted_caller_count` = `8`
- `native_states` = `{'a0_normal_entry_home': {'evidence_id': 'a0_normal_entry_home', 'state': 'STALE_HEAD', 'run_id': None, 'head_sha': None, 'phrase_found': False, 'other_commit_runs': [{'run_id': 41018366655, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'status': 'queued', 'conclusion': ''}, {'run_id': 41018227483, 'head_sha': '7e1f5b030425c85a37c8238afdef3499234a96ce', 'status': 'queued', 'conclusion': ''}], 'proves': 'a normal menu route reaches the overworld in native Godot'}, 'a0_two_process_reload': {'evidence_id': 'a0_two_process_reload', 'state': 'STALE_HEAD', 'run_id': None, 'head_sha': None, 'phrase_found': False, 'other_commit_runs': [{'run_id': 41018366655, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'status': 'queued', 'conclusion': ''}, {'run_id': 41018227483, 'head_sha': '7e1f5b030425c85a37c8238afdef3499234a96ce', 'status': 'queued', 'conclusion': ''}], 'proves': 'an independent second Godot process restores the same save with no duplicates'}, 'a8_native_poi_contract': {'evidence_id': 'a8_native_poi_contract', 'state': 'QUEUED', 'run_id': 41019689728, 'head_sha': '2d7f10d355cb57692a321f3ca633550d31385157', 'phrase_found': False, 'other_commit_runs': [{'run_id': 41019182407, 'head_sha': '2ad531f9e099cc3a29709da176e7a34b05a9a15b', 'status': 'queued', 'conclusion': ''}, {'run_id': 41019032228, 'head_sha': 'c0ae902542a31c37bdfdc8f72d452cbf430e6747', 'status': 'queued', 'conclusion': ''}, {'run_id': 41015986080, 'head_sha': 'f9ed82b91e8d1eed52f109247ae511c4f862ffd1', 'status': 'queued', 'conclusion': ''}, {'run_id': 41015980806, 'head_sha': 'f9ed82b91e8d1eed52f109247ae511c4f862ffd1', 'status': 'queued', 'conclusion': ''}, {'run_id': 41013849680, 'head_sha': '17d0692cc591f70b45818f73b75199e4969bd328', 'status': 'queued', 'conclusion': ''}, {'run_id': 41013834329, 'head_sha': '17d0692cc591f70b45818f73b75199e4969bd328', 'status': 'queued', 'conclusion': ''}], 'proves': 'the native POI scene loads and its intent contract runs'}, 'a0_runtime_validation': {'evidence_id': 'a0_runtime_validation', 'state': 'STALE_HEAD', 'run_id': None, 'head_sha': None, 'phrase_found': False, 'other_commit_runs': [{'run_id': 41018366731, 'head_sha': 'a3d0255ab09ba59ec5f9212243619f69d85d2948', 'status': 'queued', 'conclusion': ''}, {'run_id': 41018227367, 'head_sha': '7e1f5b030425c85a37c8238afdef3499234a96ce', 'status': 'queued', 'conclusion': ''}, {'run_id': 41017622318, 'head_sha': '77e434a7046760d4660f8579c9ad0563b023e3c2', 'status': 'queued', 'conclusion': ''}, {'run_id': 41012744088, 'head_sha': 'cdd1b7f3055637882fb6b7b3ac0f168becbb7ec6', 'status': 'queued', 'conclusion': ''}, {'run_id': 41012438709, 'head_sha': '9d287f3337af3874720d9444e8c258e26162f24c', 'status': 'queued', 'conclusion': ''}, {'run_id': 41010284056, 'head_sha': '61ada9cfa0f0ad02bb6714628ee83a19e7fd65b9', 'status': 'queued', 'conclusion': ''}, {'run_id': 41008847954, 'head_sha': '1c5d4413685c8498be253c7b3cf50ef774f3053b', 'status': 'completed', 'conclusion': 'success'}, {'run_id': 41008469947, 'head_sha': 'bffb872d43a4c0e9e9b75a401c95d81f104213de', 'status': 'completed', 'conclusion': 'success'}], 'proves': 'the survival runtime scripts parse and run headless'}}`
- `raw_token_occurrences` = `65`
- `rejected_call_sites` = `13`
- `static_seam_state` = `MOUNTED_SURVIVAL_SYSTEM_CALLER`
- `two_process_test_in_source` = `True`
- `unproven_caller_count` = `8`

## BLK-5 — A8's quarry route actions have an item id but no authorized quantity

**Player impact.** Bracing the east shelf and chocking the west ramp both name their item (oak_wood, stone_chunk) but carry cost_quantity null and their own authorization note says no approved price exists. Even with the scene mounted, neither action could be paid, so the quarry route cannot open.

**Owner.** A3  
**Evidence class.** UNAUTHORIZED_COST  
**Verified by.** gate L4 on the A8 chain over A8's own quarry_integration_candidate.v1.json  
**Native run required to close.** False

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/gate.json'));print(d['a8_candidate']['unpriced_actions'])"
```

**Minimal safe correction.** A3 authorizes a quantity for the two route actions (a one-time construction cost, not a loot rate). A8 then replaces its self-declared value with A3's number.

**Test that proves closure.** `tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk5_closes_when_a3_prices_the_two_route_actions`

**Still NOT_TESTED after closure.** that the paid cost produces the collision change the player expects (native)

**Blocked gate links.**

| Chain | Link | Source state | Native | Level | Missing |
|---|---|---|---|---|---|
| a8_quarry | L4_AUTHORIZATION | `S0_ABSENT` | NOT_TESTED | `S0_ABSENT` | A8's two route actions have an item id but no authorized quantity, so neither can be paid |

**Evidence.**

- `candidate_status` = `S2_CANDIDATE_BLOCKED_ON_A1_A3_A0_OWNER_INTEGRATION`
- `unpriced_actions` = `[{'action_id': 'brace_east_shelf', 'item_id': 'oak_wood', 'cost_quantity': None, 'authorization': 'BLOCKED: item ID exists in current A3 PR19, but no approved price for this Quarry action.'}, {'action_id': 'chock_west_ramp', 'item_id': 'stone_chunk', 'cost_quantity': None, 'authorization': 'BLOCKED: item ID exists in current A3 PR19, but no approved price for this Quarry action.'}]`

## Closed, kept for traceability

### BLK-BINDING — was: _A1 authorizes the first-hour cache but A3 has not adopted the binding_

**Disposition.** `CLOSED_BY_OWNER_SOURCE` at A3 PR19 head c23292be, re-checked against A1 PR20 head 7fd000e1

**Why.** A3 adopted A1's rebind: road_scrap and road_supplies now carry poi_crown_waystation, instance node_waystation_cache, region r_ashen_crown, status A1_PINNED_A3_BOUND, with A1's own yields (3 iron_scrap, 2 knowledge_spares) and the same 1800 active-second renewable window. A1's third binding is a live-source reuse, not a rebind, and A3 satisfies it as authored.

**Residual.** A0's mirrored copy of the catalog still has the pre-adoption rows — now BLK-2.

**Still with the owner.** nothing from A3 for this item.

**Evidence.**

- `cooldown_active_seconds` = `1800`
- `live_source_reuse` = `1`
- `note` = `no loot rate was requested or changed by A7 at any point`
- `rebind_adopted` = `2`
- `rebind_required` = `2`
- `yields_changed` = `False`

### BLK-BOOTSTRAP — was: _First research is a bootstrap cycle, so the knowledge ladder cannot start_

**Disposition.** `CLOSED_MEASURED_FALSE` at round 3, re-verified round 4

**Why.** A1 authorizes 2 knowledge_spares per Waystation cache claim (renewable, 1800 s) and research_kit is a workbench recipe needing 3 spares, so the ladder starts without any station.

**Residual.** two claims = one 1800 s cooldown wait; a pacing question for A3, not a dead end.

**Still with the owner.** A3 confirms the first-station wait is intended.

**Evidence.**

- `cache_spares_per_claim` = `2`
- `claims_needed_for_first_station_kit` = `2`
- `no_rate_changed` = `True`
- `research_kit_spares` = `3`
- `research_kit_station` = `workbench`

### BLK-DEBUG-UI — was: _The only survival UI is developer-facing and duplicates A0's HUD_

**Disposition.** `CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN` at round 3, re-verified round 4

**Why.** Measured on mounted surfaces the developer vocabulary sits behind _developer_diagnostics (default false), no production scene mounts the survival UI, and the three HUD scripts own disjoint jobs.

**Residual.** PROD-04 keeps its broad file-level FAIL as a hygiene warning, not a player blocker.

**Still with the owner.** A6 keeps the panel opt-in when it mounts.

**Evidence.**

- `developer_diagnostics_default` = `False`
- `hud_jobs` = `['a0.hud=health', 'a0.overworld_hud=provisions', 'a6=context/core/feedback']`
- `survival_ui_mounted` = `False`

## A7 self-corrections (round 4)

### CORR-1 — `WRONG_AS_STATED`

**Round-3 claim.** There is no survival entry: the home screen has no survival destination, so no interaction is reachable.

**What is actually true.** A0 ships an ordinary menu route — Home hub -> campaign destination -> EnterOverworldButton -> AppFlow.open_overworld — with no test flag. The A7 detector searched only for a home function key named 'survival'.

**What remains true.** The route reaches A0's own overworld; it contains no A1 slice node and no A8 site scene, and no native run has verified it (every run at the pinned heads is queued).

**Fix in this round.** gate.entry_claims separates A (route in source), B (native), C (content mounted), D (reward claimable).

### CORR-2 — `WRONG_AS_STATED`

**Round-3 claim.** No mounted path calls SaveService.transact_once, so every reward path is fixture-only.

**What is actually true.** Mounted callers do commit through transact_once: harvest and inventory transfers in SurvivalService plus five campaign-progression paths in AppFlow, with a replay guard inside _transact_once_internal. Eight further SurvivalService actions (place_structure, death/bag, bed, door, remove_structure, learn_recipe) are called from files A7 does not pin, so they are reported as unproven rather than counted.

**What remains true.** No caller is keyed on an A1 contract key, so the Waystation cache cannot be paid; A8 still commits through an in-memory fixture; and no native run has verified the two-process reload path.

**Fix in this round.** gate.commit_seam classifies each caller and lists every rejected match with its reason.

### CORR-3 — `OVERTAKEN_BY_OWNER_WORK`

**Round-3 claim.** A3's binding adoption is the second blocker; A1 authorizes but A3 has not adopted.

**What is actually true.** A3 adopted it at c23292be with unchanged yields.

**What remains true.** A0's mirrored copy of the catalog still carries the pre-adoption rows.

**Fix in this round.** binding adoption is a closed item; the stale mirror is BLK-2.

### CORR-4 — `SELF_INFLICTED_FALSE_POSITIVE`

**Round-3 claim.** The avatar check passes when a manifest points at a sheet and the scene name changes.

**What is actually true.** An invented res:// path is not an installed image.

**What remains true.** Nothing is installed at this pin; the check now requires tree existence.

**Fix in this round.** Q-04 checks identity, sheet existence and substitute code paths separately from visual readiness.

### CORR-5 — `SELF_INFLICTED_FALSE_POSITIVE`

**Round-3 claim.** Injecting a call-shaped string into text is enough to close the commit blocker.

**What is actually true.** Comments, strings, test files, unmounted files and dead functions are not production.

**What remains true.** Closing BLK-4 needs the caller plus a VERIFIED native run on the pinned commit.

**Fix in this round.** gdscan strips comments/strings, checks mounting and dead code; evidence gates S4.
