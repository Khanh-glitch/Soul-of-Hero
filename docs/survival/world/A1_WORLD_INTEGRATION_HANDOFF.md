# A1 world integration handoff — hash proof + A8 geography decisions

**Base review SHA:** `7d2b017c8a90b7d5e24ff85f065ff1b18548cd29` (PR20 open/unmerged). **Native status at document intake:** pending exact-head CI; this file must not be read as production acceptance.

## 1. First-hour asset discrepancy — resolved

A0 comment [#issuecomment-6524971216](https://github.com/Khanh-glitch/Soul-of-Hero/pull/20#issuecomment-6524971216) compared three values in `first_hour_visual_payload_lock.v1.json` with whole compiled `.presentation.v1.json` file SHAs. Those are different hash domains:

| Domain | Exact definition | Authority |
| --- | --- | --- |
| Whole file | SHA-256 of committed file bytes | A0 mount pin / byte integrity |
| Payload subset | SHA-256 of canonical JSON containing only `ground`, `overlays`, `props`, `lights`, `capture_views`, `ambient_day`, `ambient_night` | First-hour visual payload preservation |
| Raw crop | SHA-256 of decoded RGBA8 pixels, row-major, no PNG encoding | Actual art/crop compatibility |

Current exact examples:

| Treatment | Whole-file SHA-256 | Payload-subset SHA-256 |
| --- | --- | --- |
| Crown | `39f1a9a91614430c573aedf5bfd148808cd630422f7be3d04024d57de9b7b4c1` | `cb613125d01ed47664597035e676277eb9e08e93bfc2d4310d6c25e9ad1000e3` |
| Amberwood | `3857836c5bf389b59bed4f6b6448545e73e4b86839d22bb9cacf1c319a377cdf` | `49aaa21c06ca92c2f06b1a6d49111542aec2149fda67567c4c3b54c2b035fcaf` |
| Frost | `28d602242b7c9deb40c77f985334771ab425233687b45d09befb361bb74e7792` | `d6454c792fcd4b7fe053c89335fa7e39a15fd174faa60d00ee468b357738ef9f` |

The lock values are correct for their declared payload domain; they are not supposed to equal whole-file SHAs. The manifest `data/survival/world/art/first_hour_asset_provenance.v1.json` records both domains and exact file bytes.

**Decoded crop result:** 181/181 match `ad39bde6` (145 terrain + 36 props). Eight moved atlas coordinates only. `cache_notes` remains rect `[304,2,26,24]`, raw SHA `13d372fad04e3668c92cfe6c2fffb280e727f9db7a051bcb1856613e95dc25fd`; `cache_closed` remains `[220,2,26,24]`, raw SHA `45ca2814847c7dd92e58984196e937c4be3db102efeea6faae5985aef9fa47e4`.

**Repin decision:** `NO_BLIND_REPIN`. A0 `4b4b63f5` still has a coherent older whole-file pin set. Crop compatibility does not waive A0's whole-file update or its cross-parent foot-sort native gate. Candidate current whole-file pins are recorded in the provenance manifest; A0/A7 must adopt/test them coherently.

## 2. Existing A8 six territories — geography decisions

A8 source: `02ad8b727298284c16ea7f469d43310021b40f20`, read-only pinned copies under `data/survival/world/references/a8_02ad8b72/`. This review references the existing IDs; it does not create another six-territory system or new POIs/regions.

| Elder / canonical POI | Location decision | Ordinary safe threshold | Approach / return | Days1–11 and route correction |
| --- | --- | --- | --- | --- |
| `elder.ashen_crown` / `poi_crown_south_quarry` `[30,280]` | **APPROVE_CANONICAL_LOCATION** | `[30,278]` | `[56,218]` ↔ `[30,278]` | Early open stone/iron perimeter. Existing spur accepted; east/west phase reversal is A8 local-slice scope, not a second world road. |
| `elder.frost_observatory` / `poi_frost_observatory` `[720,180]` | **APPROVE_CANONICAL_LOCATION** | `[718,178]` | `[800,100]` ↔ `[718,178]` | Mid lens/storm-glass perimeter; inner `cap_power_1 + cap_thermal`. Named ramps/ladders/gully not present in A1 layers. |
| `elder.glasswind_light` / `poi_glasswind_light` `[930,120]` | **APPROVE_CANONICAL_LOCATION** | `[928,120]` | `[800,100]` ↔ `[928,120]` | Mid signal/storm-glass perimeter; inner `cap_seal_2`. Breakwater/tide-beach alternatives not present. |
| `elder.ember_forge` / `poi_ember_old_forge` `[580,320]` | **APPROVE_WITH_SAFE_PERIMETER_CORRECTION** | `[559,322]` | `[540,280]` ↔ `[559,322]` | Mid forge/slag perimeter; inner acid gas requires `cap_filter + cap_power_1 + cap_seal_1`. Reject degenerate same-cell spur as usable approach proof; west threshold is the ordinary alternative. |
| `elder.verdant_temple` / `poi_verdant_canopy_temple` `[640,600]` | **APPROVE_WITH_SAFE_PERIMETER_CORRECTION** | `[633,660]` | `[660,700]` ↔ `[633,660]` | Late canopy/spore perimeter; inner `cap_climb + cap_filter + cap_seal_3`. Root ladders/ramps/bridges not present; south threshold is ordinary alternative. |
| `elder.pearl_grotto` / `poi_pearl_grotto` `[900,660]` | **APPROVE_WITH_SAFE_PERIMETER_CORRECTION** | `[857,690]` | `[860,700]` ↔ `[857,690]` | Late tide/pearl perimeter; inner tide requires `cap_boat + cap_tide_ward`. North boat channel/tide paths not present; south threshold is ordinary alternative. |

All canonical identities are biome-consistent. Approval of a territory anchor does **not** make its inner hazard zone ordinary-safe or production-mounted. The three late-hazard inner anchors are not driven as ordinary safe destinations. Hazard damage and Ragnarok projections remain untested.

## 3. Existing A8 physical endpoints — approved relocated world sockets

A8 `fixture_position_px` is rejected as world coordinates. The following are A1-approved socket/stand cells for an A0 mount trial, not production acceptance. All use proposed 28×28 px collision, 62 px neutral interaction radius, and exact stand offset `[0,39]` from socket center to Hero foot.

| Endpoint / POI | Socket cell (world px) | Stand cell (Hero foot px) | Approach / return | Visual decision |
| --- | --- | --- | --- | --- |
| `endpoint.ragnarok.deposit` / `poi_crown_waystation` | `[404,202]` (`[6472,3240]`) | `[404,204]` (`[6472,3279]`) | `[404,207]` ↔ stand | `cache_closed` is coherent as a secure-chest marker; no wallet authority. |
| `endpoint.ragnarok.fixed_vendor` / `poi_crown_waystation` | `[412,202]` (`[6600,3240]`) | `[412,204]` (`[6600,3279]`) | `[412,207]` ↔ stand | Generic signpost rejected as final vendor identity; A8 machine art required. |
| `endpoint.ragnarok.recycler` / `poi_amberwood_mill` | `[126,440]` (`[2024,7048]`) | `[126,442]` (`[2024,7087]`) | `[126,445]` ↔ stand | 56×56 `mill_wheel` at 1.5× rejected as a 28 px machine footprint; A8 recycler art required. |
| `endpoint.ragnarok.evacuation` / `poi_saffron_drydock` | `[894,422]` (`[14312,6760]`) | `[894,424]` (`[14312,6799]`) | `[894,427]` ↔ stand | Generic signpost rejected as final evacuation identity; A8 drydock berth art required. |

Socket and stand cells are reserved against player building in the A1 contract. Sockets sit off maintained road; stands remain on clear approach cells. No interaction, loot, vendor stock, recycling yield, wallet or run-finalization behavior is granted by this placement review.

## 4. Native proof scope

`compile_placement_review.py` derives 10 bounded native inputs with 557 existing forward cells and zero ordinary-path hazard cells. `placement_native_test.gd` uses real Knight 12×16 physics, ordinary Input driving forward/return, source water/cliff collision, proposed endpoint bodies, swept direction/corner probes, and native 1280×720 captures. It also independently hashes all 181 raw RGBA crops in Godot.

**This is source-window and connector-fixture evidence, not a traversable production continent.** Every review row carries `AUTHORED_SOURCE_WINDOW_NOT_PRODUCTION_MOUNTED`. A0 production mount, A8 interaction, A3 economy, A5/AVFX bosses, Gold and human playtest are outside this gate.

## 5. Consumer handoff

- **A0:** use approved socket/stand cells and reserved collision only after its physical Hero loop is ready; keep production mount and SaveService ownership. Do not repin art solely from the crop result.
- **A8:** retain existing elder/endpoint IDs; replace fixture-only world assumptions with approved socket/stand offsets; supply distinct vendor/recycler/drydock visuals; emit no rewards.
- **A3:** canonical POI/source IDs are available for later authorized economy. No price, quantity, chest yield, wallet or recycling rule is approved here.
- **A7:** independently compose these exact source windows with real Hero shape, forward/return and corner probes; do not infer production access from fixture success.

Authoritative machine contract: `data/survival/world/a1_world_placement_contract.v1.json`. Native inputs/report are generated by the workflow; final SHA/CI results are appended after execution.

## 6. Executed native result (source evidence SHA `90b68287`)

Godot 4.7/Xvfb run [41105179623](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41105179623), WorldArt job `124239110476`, passed **70 checks / 0 failures / 20 captures / 10 reviews**. Direct Godot PNG decoding reported **181 crop matches / 0 mismatches**.

- All six territory forward and return paths passed: path lengths 87, 161, 149, 62, 68 and 14 cells respectively.
- All four endpoint forward and return paths passed (4 cells each); every proposed endpoint body blocked the socket face while leaving the approved stand reachable; north and diagonal corner probes collided as expected, with free lateral/return probes in the fixture.
- All 20 native captures and the authentic report are preserved in `docs/survival/world/evidence/placement/`; `placement_goals_contact.png` was visually reviewed.
- Evidence artifact `a1-world-art-native-fixture-evidence` ID `13001698146`; connector artifact `13002320919`; fallback manifest blob `63b0e4ff6579bcefc959988d6fce23eee156ee89`.

This closes the scoped A1 hash + source-window geography gate. It does not establish a traversable production continent, A0 mount, A8 interaction, A3 economy, boss/Gold acceptance or human playtest.
