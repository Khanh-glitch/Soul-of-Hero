# A8 Round 12 worklog — real Hero input, readable three-site projection, one withheld source candidate

**Disposition: `PARTIAL_WITH_BLOCKERS`.** This is a continuation of the already-open PR #26 on `arena/2d7e6d7a-soul-of-hero`; do not create another PR, merge, or claim production acceptance. Latest exact A8 source head recorded here is `efead2ad0cefc0113dd81185072c022efd8f0af2`. Exact-head A8 native CI passed, but production mounting, A0 durable restart/no-duplicate evidence, A3 authorization, and human visual/play acceptance remain open. The exact-head addendum at the end supersedes earlier pending CI notes below; this report keeps A8 fixture evidence separate from A0/A1/A3 production evidence.

## Round 12 source and owner refresh

- PR #26: `https://github.com/Khanh-glitch/Soul-of-Hero/pull/26`, open; base checkout head before this patch `6337533f7cc0d39487921e279d3967ac29a59297`.
- A0 PR #21: `738e621b688e9d9890f636ef2ece48f6d29f5b01`, open.
- A1 PR #20: `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`, open.
- A3 PR #19: `b44e22df3af40939069189be14afc23ee1ce21c4`, open; Quarry authorization remains `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`.
- A1 current `atlas.v1.json` SHA256 is `83d69373ca6c1258e8727800d0aa0c288851c34d25539c69c21ec9f5fc9d769a`; terrain `6128d8f41abe6962fe705431db20e762e0cca613ffc3eca29065727422737d1c`; props `8d4acf4028e0e065b901e78c59c65e5a68677fb75d46c04c7e5a029a76d27324`. These hashes were checked against A1 PR #20 head `9ca1453`; they equal the existing A8 source compatibility evidence. The A8 visual art remains its existing pinned source art.
- A3 current item/source/recipe/world-binding/Quarry-authorization source snapshots were checked against A3 PR #19 head `b44e22d…`; items `cd1a27c48078a69489904e86182dc63750941d9fc296830f711dd5d574615520`, sources `bc88143efb61f2202ae37c96373e07a1643cc29b7fc9a38abc84e4958fe2b984`, recipes `4dbf48da0dbb841bedd3333f0def33f328af4ed55c0e1f919b4a19cc3385539c`, world bindings `7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b`, Quarry authorization `379573cc54475b9901b63378d8bbf67edf5462cfc757859ae15f0c208f12191c`.
- `knight.tscn` in the A8 checkout is byte-identical to the A0 PR #21 current-head scene snapshot (SHA256 `2b29011bf361ac7e5cdde97c1fc454c69684dcb6c08e1c23186c05910a52e195`). It has a 12×16 px RectangleShape2D at `(0,-8)` and points to `knight.gd`. The A8 checkout's `knight.gd` SHA256 is `78814d7d29122d91c4aafa1eb4052b02cf77948cf6113f207fabcc6d8ba3d750`; the current A0 PR script SHA256 is `d5a573d1933f5693b696c8016a14268124de7e51a01a74b56f218fa0b7249f49`. This A8 checkout's script declares `move_speed=96`, then `config/gameplay_tuning.json` resolves it at runtime to 112 px/s. That script difference is explicit: journey evidence uses the current Hero **scene** but not the exact A0-head Hero implementation or production mount.

## Implemented A8-owned changes

- **Real Hero input:** `poi_pilot.gd` now instantiates `res://game/characters/knight/knight.tscn`; the frame-driven A8 journey no longer instantiates `player_probe.gd` or caps a stand-in's speed. The journey snapshot reports scene/script paths, measured body shape, `move_speed`, viewport size and camera zoom. The checked-out Hero script declares `move_speed=96`, while `config/gameplay_tuning.json` resolves the runtime value to 112 px/s, as reported by the headless route measurement. Input, movement, collision, doorway entry, route interaction, retreat and revisit remain frame-driven; no test assigns journey positions or injects completed actions.
- **Capture framing:** camera zoom is an integer 1×/2×/3× for the 1280×720 / 2560×1440 / 3840×2160 captures, with local bounds and smoothing disabled for consistent framing. The header now shows site identity and A1 cell; the footer gives readable action/fixture warnings without the previous large opaque status strip. Result feedback is held briefly so the site-specific consequence is not overwritten by a nearby prompt.
- **Source-backed environment context:** `native_poi_art.gd` paints each existing `context_ground` definition behind the small shell/interior footprint. The layer is built from existing A1 atlas families and paths; it is decorative only, with no collision, POI/world extension, mount, route permission or A1 geography edit. The view is expected to be physically filled by world art rather than a black field or an overlay hiding it; eye review is still pending.
- **Quarry choice and source honesty:** current owner-projected east/west/leave choices keep their distinct routes/props. `extract_outcrop` now requires an owner-readiness projection. Without it the Hero can approach and press H, receives an explicit no-ready explanation, emits no intent, increments no claim generation, and gets no item. The source candidate in `quarry_economics_evidence.v2.json#a3_candidate_source` names existing A1/A8/A3 identities, local socket/stand, path distances, proposed A0 durable state fields and the blockers below. The A0 site-instance ID remains null; this is not a production source binding.
- **Orchard:** base narrow water remains visible; owner-projected `orchard_channel=flowing` widens the channel. `read_water_marks` now requires the `flowing` value in addition to readiness. Depth remains unknown, and the fixed safe boardwalk/retreat contract remains unchanged.
- **Mill:** base narrow race remains visible; owner-projected `mill_wheel=turning` widens it and rotates the source-art wheel; `seized` shows deadfall and keeps the wheel still. The existing physical boardwalk and south retreat do not depend on wheel power. Capability/readiness gates remain owner-projected fixture evidence only.
- Added `native_poi_visual_presentation_test.gd` for context fill, thin-vs-wide Orchard/Mill water, seized-vs-turning wheel animation and source-art states. Added authoring assertions for context, state gating and A3 fail-closed Quarry extraction; workflow now runs this visual-state contract alongside native journeys.
- Refreshed active A0/A1/A3 source pins and corresponding exact-head tests. Revalidated the A1 atlas/texture hashes at current A1 head before updating its head label. A3 items hash was changed only after checking the exact A3 current-head source snapshot.

## A8.3 one-source candidate — exact facts and remaining blockers

| Field | Current candidate evidence | Status / authority boundary |
|---|---|---|
| A1 locator | `world:soh_continent_v1`, `r_ashen_crown`, `poi_crown_south_quarry`, cell `[30,280]`, route `sp_poi_crown_south_quarry` | A1 authoring evidence; not proof of A0 production reachability. |
| A8 source/action | Local scene `south_quarry.tscn`; source `poi_crown_south_quarry`; object `south_seam_outcrop`; action `extract_outcrop` | Existing A8 identities; no new source ID minted. |
| Physical stand/socket | Stand `[506,378]`, socket `[506,302]`, range 86 px; distance 76 px. Spawn `[480,548]` to stand is 196 px axis-aligned; stand to south return `[480,560]` is 208 px axis-aligned. | Local A8 route geometry only. Native test prints live Hero input/path-frame measurements at the exact-hosted run; those results are pending. A1 world-route length is authored graph geometry, not measured A0 movement. |
| Actor | `knight.tscn`, collider `[12,16]` at `[0,-8]`, checked-out `move_speed=96` | Current A8 checkout Hero scene/body, not exact A0 current-head script/mount. |
| A3 source candidate | Existing generic `live_stone_chunk` → `stone_chunk`; A3 generic row says 2/claim, 480 source-record seconds, risk label `low`, `poi_id=null`, `SOH_PROPOSAL` | Not Quarry-bound; the 480 seconds are not an A0-authoritative active clock and “low” is not a Quarry risk measurement. Site yield, source stock/capacity and approved cooldown are null. |
| Capacity / sink | Item stack limit 50. Existing `stone_pick` recipe uses 3 `stone_chunk` + 2 `oak_wood`, but is `persistent_home`-only and `SOH_PROPOSAL`. | A stack limit is not source capacity; the current sink is not a survival-run sink. A3 must approve a run-mode sink or identify an existing approved one. A0 run-bag capacity is not supplied. |
| Durable state / instance | Candidate owner projection fields for A0 review: `site_state.quarry_route`, `claim_generation.south_seam_outcrop`, `resource_ready_at.south_seam_outcrop`, `projection_revision`; A0 SaveService only. | `site_instance_id=null`; proposed storage keys are not a production schema or persistence claim. No restart test. A0 must resolve/mount the canonical instance and own idempotent durable commit. |
| Risk / reward | Unstable seam gives an exclusive safe-route choice; no damage, exposure, failure probability, or loss rate is authored. | A3 authorization rejected; no item, capability, cost, yield, cooldown or inventory result is approved. Reward remains explicitly withheld. |

This is the most complete evidence candidate A8 can produce without crossing owner boundaries, but it does **not** satisfy the production-instance, capacity, usable-sink or durable-state portions of A8.3. Keep the binding list empty and all actual terms null until A3 and A0 approve and prove the exact source.

## Tests and evidence status at this local working-tree checkpoint

| Check | Result | Scope |
|---|---|---|
| `python3 tools/survival/world_content/author_site.py --check` | PASS; 4 site files, references resolved | Static source-data validation only. |
| `python3 -m unittest discover -s tests/survival/world_content -p 'test_*.py'` | PASS; 30 tests | Static/contract/data checks; not Godot runtime. |
| `.venv/bin/gdformat --check ...` and `.venv/bin/gdlint ...` on changed GDScript/tests | PASS | Format/lint only. |
| Workflow YAML parse / `git diff --check` | PASS | Syntax/whitespace only. |
| Godot project import | PASS with local custom Godot 4.7 build | Import logs contain this toolchain's system-font/fontconfig warnings; project import returned zero. |
| `native_poi_contract_test.gd` | PASS; 381 assertions | Local headless native interaction/collision/neutral-owner contracts; fixture-only results, no production SaveService. |
| `native_poi_transition_test.gd` | PASS; 327 assertions | Local headless physical shell/worksite transition contracts. |
| `native_poi_input_journey_test.gd` | PASS; 291 assertions | Current checked-out Hero scene, physical fixture journeys/choice/collision/revisit/source-withheld checks. Capture code explicitly reports `renderer=headless` and skips image output. |
| `native_poi_visual_presentation_test.gd` | PASS; 24 assertions | Headless context-ground cells, Orchard/Mill water-state frames, seized-vs-turning wheel state; not screenshot review. |
| `native_poi_surface_contract_test.gd` | PASS; 13 assertions | Headless local surface/owner-reset contract. |
| `native_poi_ragnarok_test.gd` | PASS; 224 assertions | Existing A8 boundary regression suite; not Round12 A0/A3 production evidence. |
| 720p/1440p/2160p current screenshots reviewed by eye | NOT REVIEWED | Await exact pushed-SHA artifact; capture generation is not review. Use image viewer/readback when artifact is retrievable. |
| Human play / exact A0 production mount / separate-process save restart | NOT DONE | A0 owns the production mount, `site_instance_id`, existing SaveService and durable restart. |

The local measured A8 fixture route on Quarry was: spawn `(480.0,544.7778)` to reached stand `(510.3272,379.6538)`, Manhattan input path `188.76 px`, 107 held physics frames (109 total including two settle frames), `1.817 s` elapsed at 60 Hz; the current runtime-configured Hero speed printed as `112 px/s`, with the 12×16 px collider. One physical H press for the withheld source attempt occupied two physics frames (`0.033 s`). These are *local harness route/input measurements*, not A0 world-travel, material cost, risk or economic viability. The native journey assertions verify that an unready Quarry source action emits no source intent, creates no claim generation and grants no inventory. No local screenshot was captured or visually inspected.

## R0–R5 and nine strict gates

| Review layer | Status | Honest scope |
|---|---|---|
| **R0 — source/intent** | PASS (scoped) | Round 12 A8 work order, current product contract, D062–D074 and refreshed A0/A1/A3 references checked; source hashes above. No obsolete lifecycle/reset rule is introduced. |
| **R1 — patch/ownership** | PASS (scoped) | Only A8 data/scripts/tests/workflow/docs changed; no A0 SaveService, A1 master geography, A3 economic implementation or AVFX Gold edit. |
| **R2 — independent test oracle** | PASS (scoped) | 30 Python tests, six local Godot headless suites (1,260 assertions), GDScript format/lint all pass on the current working tree; fixtures remain fixture evidence. |
| **R3 — native/rendered truth** | PASS headless / visual review pending | Local Godot 4.7 project import and frame-driven physical Hero journeys pass; headless mode skips screenshot rendering. No exact pushed-SHA hosted run or inspected screenshot yet. |
| **R4 — player value / long-run system** | NOT_TESTED | Site-state readability is improved in authored data; no A3 source-to-run-sink authorization, net value, risk rate, 14-day replay or human choice evidence. |
| **R5 — integration / binary verdict** | HOLD | A0 production mount, durable reload/no-dupe, A1 world reachability, A3 approval, and human play are absent. Overall `PARTIAL_WITH_BLOCKERS`. |

| Strict gate | Status | Evidence boundary |
|---|---|---|
| `RESEARCH_PROVENANCE` | PASS (scoped) | A1 atlas hashes and A3 files checked at current heads; no new art/source introduced. |
| `ARCHITECTURE` | PASS (scoped) | A8 continues to send neutral physical requests and consume owner projections; fixture disclaimer is explicit. |
| `CODE_RUNTIME` | PASS (local scoped) | Custom Godot 4.7 project import and native headless test suites pass; exact pushed-SHA GitHub CI remains pending. |
| `TEST_ORACLE` | PASS (local scoped) | Current Hero frame-driven journey and new visual-state suite pass headlessly; visual capture path skips screenshots without a renderer. |
| `VISUAL_UX` | PARTIAL / NOT REVIEWED | Context ground/camera/UI and state-dependent presentation pass headless cell/state assertions; no 720p/1440p/2160p capture has been viewed by a human. |
| `SYSTEM_VALUE` | NOT_TESTED | Quarry candidate lacks A3 binding, usable run sink, finite site capacity and measured site risk. |
| `SAVE_MIGRATION` | NOT_APPLICABLE_TO_A8_FIXTURE / A0_HOLD | A8 introduces no persistence. A0 SaveService restart/idempotency is required before production. |
| `INTEGRATION` | HOLD | A0/A1/A3 owner composition and production entry are not present in this checkout. |
| `BALANCE_REPLAY` | NOT_TESTED | No approved rates/terms or human/14-day replay. |

## Remaining actions after the exact-head A8 pass

1. Refresh the A0/A1 source pins at their advanced current heads and verify only relevant compatibility sources; do not edit owner-owned code.
2. Retrieve the three-resolution artifact from A8 run `41183381361` and inspect the images by eye if access succeeds. The first download attempt returned Azure Blob `EOF`; record screenshots inspected or the continuing access limitation. Do not substitute CI capture success or Python tests for visual review.
3. Obtain owner-approved A0 canonical `site_instance_id`, real world mount, transition and separate-process SaveService restart/idempotency proof; A1 route/socket approval; and A3 source binding, run capacity, site-specific risk, authorized run sink, costs/yield/cooldown/capability before production claims.
4. Conduct separate human choice/play acceptance after approved composition. Keep R0–R5 and the nine strict gates scoped honestly, preserve the unapproved reward fail-closed behavior, and keep PR #26 open/unmerged.


## Exact-head Round 12 addendum — 2026-10-31

- **PR #26:** open and unmerged at `efead2ad0cefc0113dd81185072c022efd8f0af2` ([PR #26](https://github.com/Khanh-glitch/Soul-of-Hero/pull/26)). No merge or production acceptance is claimed.
- **A8 native pilot:** exact-head run [41183381361](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41183381361) **passed**. It completed native contracts, transitions, the three-site input journey, source-backed presentation, surface/owner reset, Ragnarok route/endpoint checks, and captures at 1280×720, 2560×1440, and 3840×2160. The journey uses the A8 pilot and current checkout Hero scene/controller; it does not prove the canonical A0 production mount or compatibility with A0's advanced current head.
- **Local Hero journey:** custom Godot 4.7 headless run passed **291 assertions**; headless mode skipped image writes. GDScript formatting/lint and `git diff --check` passed for the journey changes; the workflow YAML parsed successfully.
- **Godot Runtime Validation:** exact-head run [41183381442](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41183381442) passed current-branch import/headless runtime tests and Xvfb rendered gameplay captures. Its original-main control comparison failed: 20 Chapter 2 campaign-entry signed-XP assertions and 3 combat smoke assertions failed on original main. This is recorded as a baseline/control failure, not represented as a current-branch pass for those original-main tests.
- **Handoff Contract:** exact-head run [41183381701](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41183381701) **passed**.
- The A8 artifact was listed but download failed with Azure Blob `EOF`; therefore the 720p/1440p/2160p captures were generated by CI but **not reviewed by eye**. No human gameplay acceptance has occurred.
- A0/A1 owner heads have advanced since the source pins recorded in the earlier sections: A0 PR #21 is now `ee837fb06ab5108b40533f516cca95f6b56ce61f`, A1 PR #20 is now `c17c04f853ec4c95fbeb1de3561783d56fee9c22`, and A3 PR #19 remains `b44e22df3af40939069189be14afc23ee1ce21c4`. The earlier A0/A1 source-hash comparisons are historical to their cited heads; refresh and compare the relevant source pins before making any current-owner compatibility claim.
- **A8.1–A8.4 disposition remains partial:** no canonical production `site_instance_id`/A0 world composition, separate-process SaveService restart/idempotency proof, A1 production route approval, A3 Quarry binding/cost/yield/cooldown/capacity/risk/sink authorization, or by-eye/human play acceptance. `a3_approved_bindings=[]`; prices, yields, and cooldowns remain null; unapproved source rewards remain withheld. Keep R0–R5 and the nine strict gates scoped as before and PR #26 open/unmerged.
