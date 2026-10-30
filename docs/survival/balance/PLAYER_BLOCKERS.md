# Player-facing blockers (A7, consolidated)

_Generated from `data/survival/balance/results/blockers.json` by `tools/survival/balance/run_analysis.py`. Do not edit by hand._

**57 observations -> 5 blockers (3 observations are traceability/hypothesis only).** A finding list is not a deliverable; these are the only things that currently stop a player. Verification is a static read of pinned sources — no runtime was executed, so every native claim below stays `NOT_TESTED` until its owner runs it.

| # | Blocker | Owner | Class | Closure probe |
|---|---|---|---|---|
| BLK-1 | The player cannot enter the survival loop at all | A0 (mount) with A1 (world scene) | RUNTIME_MOUNT_GAP | `product.PROD-01 must report PASS with a survival-like home destination key` |
| BLK-2 | Authored loot has no host, and its identifiers do not join A1's world | A1 (identifier contract + instances) with A3 (bindings) and A0 (container mount) | STATIC_AUTHORING_GAP | `product.PROD-02 PASS (a mounted container references an authored table) and identity.targets_resolving_to_a1_instance is non-empty` |
| BLK-3 | The player body is still Knight art, and the locked avatar/armour sources are not in the build | A0 (mount) with A6 (art source) | SOURCE_BLOCKED | `product.PROD-03 PASS requires a production scene path matching the canonical source` |
| BLK-4 | First research is a bootstrap cycle, so the knowledge ladder cannot start | A3 | STATIC_AUTHORING_GAP | `the bootstrap-cycle finding disappears from findings.json while the loot table is unchanged` |
| BLK-5 | The only survival UI is developer-facing and duplicates A0's HUD job | A6 | PRODUCT_SURFACE_GAP | `product.PROD-04 PASS (zero debug literals on visible label paths) and PROD-06 PASS (one status surface)` |

## BLK-1 — The player cannot enter the survival loop at all

**Player impact.** From the home screen the player can only open campaign, hero roster, storage, modes, bestiary and settings. There is no world, POI, container or survival destination, so no exploring, gathering, looting or Core discovery can happen in the running game.

**Owner.** A0 (mount) with A1 (world scene)  
**Evidence class.** RUNTIME_MOUNT_GAP  
**Verified by.** static read of pinned bytes (A0 9d287f33, A6 8bc561df); no runtime executed

**Reproduce.**

```bash
python3 tools/survival/balance/run_analysis.py --print-blockers
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][0]['evidence'])"
```

**Minimal safe correction.** A0 adds ONE home-screen destination whose scene instantiates the existing A1 world host, behind the existing gameplay input gate. No new gameplay system, no data change, no other owner's file.

**Test that proves closure.** `tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk1_closes_when_one_survival_destination_exists`

**Still NOT_TESTED after closure.** that the mounted scene runs, is reachable on foot and does not error (native run required)

**Evidence.**

- `home_destinations` = `['bestiary', 'campaign', 'hero_roster', 'modes', 'settings', 'storage']`
- `mounted_survival_ui_scenes` = `[]`
- `note` = `A1 records 118 POIs / 106 contract-only sites; none is reachable from a mounted screen`
- `playable_pois_in_authored_contract` = `0`

**Absorbs** 4 observation(s).

## BLK-2 — Authored loot has no host, and its identifiers do not join A1's world

**Player impact.** Even with a world on screen there would be nothing to open: no production script mentions any A3 loot table, and the 16 loot records address 10 class-style ids ('poi:roadside_cache') in a namespace A1 never uses. A1 authors no container vocabulary at all, so the whole loot layer has no counterpart in the world.

**Owner.** A1 (identifier contract + instances) with A3 (bindings) and A0 (container mount)  
**Evidence class.** STATIC_AUTHORING_GAP  
**Verified by.** static read of pinned A1/A3 data + pinned A0/A6 code; no runtime executed

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/access.json'));print(d['loot_identity'])"
```
```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][1]['evidence'])"
```

**Minimal safe correction.** A1 publishes ONE identifier rule (class id + region id + instance id) and authors N container instances on existing POIs; A3 rewrites its 16 records to use that rule; A0 mounts one container scene. Start with a single class ('roadside_cache') at one already-reachable POI: it proves the contract without touching loot weights.

**Test that proves closure.** `tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk2_closes_when_a_container_is_hosted_and_ids_join`

**Still NOT_TESTED after closure.** drop behaviour in play, duplication across reload (A0 test required), Core rate (still absent)

**Evidence.**

- `a1_container_vocabulary` = `[]`
- `distinct_targets` = `10`
- `loot_records` = `16`
- `loot_tables_referenced_by_production_code` = `[]`
- `regions_unresolved` = `['mire_wetlands', 'opening_marches', 'sealed_archive']`
- `targets_resolving_to_a1_instance` = `[]`

**Absorbs** 48 observation(s).

## BLK-3 — The player body is still Knight art, and the locked avatar/armour sources are not in the build

**Player impact.** The character on screen is the old Knight. The user locked exactly two bald unarmoured Craftpix bodies (male 555940, female 419402) with armour-1/armour-2 stages driven by equipped gear; zero production files reference either source, no armour stage exists, and the swordsman pack 180537 is not a valid substitute for either gender.

**Owner.** A0 (mount) with A6 (art source)  
**Evidence class.** SOURCE_BLOCKED  
**Verified by.** static read of pinned A0/A6 bytes (18 captured files) + tree-wide art index

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][2]['evidence'])"
```

**Minimal safe correction.** Mount the chosen gender body from the user's Drive ZIP and mark armour-1/armour-2 SOURCE_BLOCKED until the gender-matched frames are handed over. Do not draw a swordsman as the female body and do not report the current Knight body as accepted.

**Test that proves closure.** `tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk3_closes_when_the_mounted_body_is_canonical`

**Still NOT_TESTED after closure.** animation fidelity, feet anchors, 720p-4K clarity, licence, armour reversal on unequip (native + human)

**Evidence.**

- `armor_stage_art_refs` = `[]`
- `canonical_source_doc_refs` = `{'555940': 3, '419402': 3, '180537': 1}`
- `canonical_source_production_refs` = `{'555940': 0, '419402': 0, '180537': 0}`
- `mounted_player_scene` = `game/characters/knight/knight.tscn`

**Absorbs** 1 observation(s).

## BLK-4 — First research is a bootstrap cycle, so the knowledge ladder cannot start

**Player impact.** knowledge_spares come only from loot that is not mounted, and the research station needs spares to be built: the player cannot take the first research step even in a perfect world with loot hosted. Expected claims for the smelting technology are now 3.53 (corrected from 2.53) of a container that does not exist.

**Owner.** A3  
**Evidence class.** STATIC_AUTHORING_GAP  
**Verified by.** exact arithmetic over pinned A3 tables + static A1/A3 dependency read

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/sensitivity.json'));print(d['research_gate'])"
```

**Minimal safe correction.** A3 names ONE non-loot source of knowledge_spares (a native reward, a harvest node, or an explicit one-time Waystation cache quantity) and keeps the loot table unchanged. No rate is invented.

**Test that proves closure.** `tests/survival/balance/test_adversarial.py::BootstrapClosureTests::test_cycle_clears_when_one_non_loot_spare_source_exists`

**Still NOT_TESTED after closure.** that the player finds it, or that 3.53 claims feels acceptable

**Evidence.**

- `bootstrap_findings` = `4`
- `knowledge_spares_sources` = `['BOOTSTRAP_DEPENDENCY_CYCLE', 'SOURCE_REQUIREMENT_UNMAPPED', 'RESISTANCE_CHAIN_BLOCKED', 'RESISTANCE_CHAIN_BLOCKED']`

**Absorbs** 4 observation(s).

## BLK-5 — The only survival UI is developer-facing and duplicates A0's HUD job

**Player impact.** 93 player-visible strings in the survival UI carry developer vocabulary (FIXTURE, PROJECTION, BLOCKED_PENDING, raw ids). The survival UI also only preloads itself: no production scene references it, while A0's HUD and A0's overworld HUD already render health/provisions. Mounting it as-is would put debug text on screen and ship a second HUD.

**Owner.** A6  
**Evidence class.** PRODUCT_SURFACE_GAP  
**Verified by.** static read of pinned A6 bytes; no runtime executed

**Reproduce.**

```bash
python3 -c "import json;d=json.load(open('data/survival/balance/results/product.json'));print([c for c in d['checks'] if c['check_id'] in ('PROD-04','PROD-06')])"
```

**Minimal safe correction.** A6 moves provenance/fixture vocabulary behind an opt-in debug panel and declares one owner for status/needs (A0), keeping its survival panel as a child view. No new UI system.

**Test that proves closure.** `tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk5_closes_when_debug_text_and_duplication_are_gone`

**Still NOT_TESTED after closure.** readability at 720p/2K/4K and comprehension (human capture review)

**Evidence.**

- `debug_token_count` = `93`
- `debug_tokens` = `['BLOCKED_PENDING', 'FIXTURE', 'NO OWNER SNAPSHOT', 'NOT NATIVE', 'NOT_NATIVE', 'OWNER_PROJECTION', 'PREVIEW  ·', 'PROJECTION', 'schema']`
- `product_checks` = `{'PROD-04': 'FAIL', 'PROD-06': 'WARN'}`
- `status_surfaces` = `['a0.hud.gd', 'a0.overworld_hud.gd', 'a6.player_first_hud.gd']`
- `survival_ui_closed_island` = `['game/survival/ui/expedition_planner.tscn', 'game/survival/ui/survival_journal.tscn']`

**Absorbs** 3 observation(s).
