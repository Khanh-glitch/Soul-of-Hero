# A8 native world-content pilot — current PR #26 continuation status

**Status as of 2026-10-31:** PR #26 remains open and unmerged on `arena/2d7e6d7a-soul-of-hero`. The scoped native implementation at `5da2545e325f28e9edd8857cf9bd74addbc92cdd` was accepted as **`ACCEPTED_SCOPED` only**, not production-accepted. At the later pre-refresh head `02ad8b727298284c16ea7f469d43310021b40f20`, exact-head A8 native, runtime/rendered and handoff runs `41094160608`, `41094160225` and `41094160166` were all still queued; no exact-head result existed. This continuation refreshes A8-owned pins/contracts and requires new exact-head CI. Production owner integration, visual inspection and human-play acceptance remain open. See the [2026-10-31 integration package](A8_INTEGRATION_PACKAGE_20261031.md) for exact owner-byte identities, approved/pending sockets and owner actions.

## Scope and owner boundaries

Continue the existing South Quarry, South Orchard Ruin, and South Crown Mill identities. Do not add or move canonical POIs. New authored data represents phase profiles and endpoint sockets at existing A1 anchors; sockets remain proposals until A1 approves their placement.

- **A0** alone owns the active run clock, phase/run projection, `run_id`, `run_epoch`, unique physical `site_instance_id`, scene mount/transitions, SaveService, durable receipts, evacuation, death and run finalization.
- **A1** alone owns canonical geography, source transforms and approved world/socket placement. Current PR #20 head queried is `7d2b017c8a90b7d5e24ff85f065ff1b18548cd29`. The current world-plan bytes are SHA256 `fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4`; the authored world plan is 1024×768 cells, not evidence of a production-mounted world.
- **A3** alone authorizes source/actions, costs, rewards, currency custody/prices, vending stock, recycling, cooldowns and capability effects; A0 commits an authorized transaction through the existing SaveService. Current PR #19 head queried is `35214ed8f555350b83bd8985e9bec7512f3181e8`. Quarry authorization remains `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`; no Quarry price, yield, cooldown or capability grant is approved.
- **AVFX** owns exact Gold. A8 makes no Gold changes.
- **A8** owns local physical scene presentation, collision, approach affordances and neutral request emission only. The test authority remains under `tests/fixtures` and is not A0, A3, or SaveService.

No A0 SaveService, A1 master geography, A3 economy/reward implementation, AVFX timeline, parallel clock, second save authority, direct currency credit, free item/Core, forced run finalization, or fake boss combat was added. No production mount or human-play result is claimed.

## Versioned Ragnarok site phase model

`data/survival/world_content/site_phase_transformations.v1.json` pins the A1 authored plan and current art. It defines A0-projected boundaries: ordinary `<264h`, day 12 `[264,288)`, day 13 `[288,312)`, day 14 `[312,336)`, terminal at `336h`. A8 validates the projection against those boundaries; it does not advance elapsed time. The projection includes A0-owned world/POI/site-instance/run/epoch/revision/phase/effect/environment identity. Missing, malformed, foreign, or stale projections fail closed. New runs may reset the phase revision only with a newer owner-supplied run epoch and a fresh ordinary projection.

- Quarry: data-authored phase cues and reversible east/west collision changes; day 12/day 14 leave the west local lane open, day 13 leaves the east lane open. Temporary collision never closes the authored return corridor. Owner-projected Quarry choices remain distinct from phase overlays.
- Orchard: phase cues only; the existing unknown-depth water and fixed boardwalk collision remain unchanged. A8 does not infer tide/weather.
- South Crown Mill: phase cues only; A8 does not repair the wheel, change the owner-projected site state, grant salvage, or close the retreat path.
- At terminal phase, A8 disables mutating site/endpoint interactions while keeping physical retreat available. A0 remains responsible for run expiry/finalization.

`native_poi_phase_context.gd` validates the A0 projection. `native_poi_phase_layer.gd` applies source-atlas cues and the authored non-damaging local Quarry blockers only when the matching A0 site-effect ID is present. It owns no clock, save state, reward, boss, damage, or run result.

## Physical endpoint contract and two economies

`data/survival/world_content/physical_ragnarok_endpoints.v1.json` and `native_poi_physical_endpoint.gd` author physical deposit, fixed-vendor, recycler, and evacuation sockets. The native test layout coordinates are **harness-only**, not world cells. Existing canonical anchors are referenced at Waystation `[408,200]`, Amberwood Mill `[120,440]`, and Saffron Drydock `[900,420]`; every new socket has status `A1_REVIEW_REQUIRED_SOCKET_NOT_CANONICAL`.

Endpoint intents carry the A0 run/site/phase context, canonical source, endpoint/action ID, observed phase revision and physical approach. They contain no price, yield, item/currency delta, receipt, save patch, or run result. A missing A0 phase projection emits no intent. Current A3/A0 endpoint authorization is absent and must fail closed; a neutral request is not authorization.

The proposal now uses A3's current technical identifiers `ragnarok_unbanked` and `profile.secured_ragnarok_currency`, with display registry keys `currency.ragnarok_unbanked` and `profile.secured_ragnarok_currency`. These are identifier alignment only, not permission to create a parallel wallet or authorize a deposit. A0 alone resets run-local state; secure deposits/spending require A3 validation plus an A0 atomic SaveService transaction. Candidate IDs are not an A3/A0 gameplay approval. Prices, yields, caps and drop rates remain null. `ragnarok_site_tuning.v1.json` has editable, explicitly unapproved visual-only values; A3/A5/A0-owned gameplay values remain null rather than being guessed by A8.

## Six source-grounded territory model

`data/survival/world_content/ragnarok_six_territories.v1.json` contains exactly six distinct elder/stone/milestone identities anchored to the current A1 plan and route graph:

1. South Quarry — `poi_crown_south_quarry`, `r_ashen_crown`, `[30,280]`, `sp_poi_crown_south_quarry`.
2. High Meridian Observatory — `poi_frost_observatory`, `r_frost_crown`, `[720,180]`, `sp_poi_frost_observatory`.
3. Glasswind Light — `poi_glasswind_light`, `r_glasswind_coast`, `[930,120]`, `sp_poi_glasswind_light`.
4. The Old Forge — `poi_ember_old_forge`, `r_ember_steppe`, `[580,320]`, `sp_poi_ember_old_forge`.
5. Canopy Temple — `poi_verdant_canopy_temple`, `r_verdant_fold`, `[640,600]`, `sp_poi_verdant_canopy_temple`.
6. Tide-Locked Grotto — `poi_pearl_grotto`, `r_pearl_mangroves`, `[900,660]`, `sp_poi_pearl_grotto`.

Each preserves A1's ordinary identity, purpose, materials, band and entry capabilities, then adds a distinct environmental counterplay, proposed approach/retreat routes, and a late-source identity with amount/cooldown unset. The five routes beyond the local Quarry slice are explicitly A1/native-collision proposals, not live routes. The six entries are **not** six playable bosses or new POIs; A5 combat and A3 stone/reward authorization are not implemented by A8. Shared links reference existing Refuge, Waystation, Amberwood Mill and Saffron Drydock anchors; they do not claim those systems are mounted.

## Two vertical slices and current completion boundary

- The ordinary physical baseline preserves Quarry/Orchard/Mill identity and includes a source-grounded Ashen Waystation cache opportunity. `ordinary_waystation_opportunity.v1.json` pins A1's cache cell `[406,203]`, stand `[406,202]`, 17-cell approach, 29-cell retreat, hero body/offset, static obstacles, and the A3 binding `a1_waystation_roadside_cache_v3`. A3's source binding describes 3 `iron_scrap` and 2 `knowledge_spares` on an 1800 active-second cooldown with `cap_salvage`; these are cited owner terms only, not included in the A8 request or granted by A8. The pinned A3 binding's static status still says `A3_V5_IMPLEMENTED_NATIVE_FIXTURE_PENDING_A0_MOUNT`; current A0 PR #21 separately contains a guarded candidate composition of the ordinary Waystation action through the A3 world-action adapter and the same A0 SaveService. Its production-scene test uses synthetic input and a guarded candidate setting; it is not normal-entry/full-world or human acceptance. A3 should refresh that candidate-versus-production status distinction. The A8 native shadow test separately uses a test actor, reconstructed obstacles and `request_test_motion`; this is not A0 Hero movement or evidence that A0's route wedge is fixed.
- The transformed slice is the **same** Quarry identity with owner-projected phase and site-effect context, explicit cue/collision changes, a maintained retreat, and neutral endpoint contracts. The Godot 4.7 native fixture suite passes for the reversible physical lanes and endpoint fail-closed behavior. This validates owner-independent A8 code only; the production A0 mount remains pending. The Quarry's late rare source/deposit is **not authorized** by current A3/A0, so no treasure or currency credit is claimed.

Neither slice is production-mounted. No actor teleport or injected completion is treated as physical gameplay acceptance. The Waystation's authored A1 status remains `INTERACTION_SPEC_AUTHORED_NOT_NATIVE`; the A0 guarded candidate and separate A8 physics harness are distinct test compositions and neither establishes a normal-entry canonical geography mount.

## Contracts and authoring artifacts

- `interaction_contract.v3.json`: neutral site intents now include the A0-owned run/site/phase identity and observed physical approach. `interaction_contract.v2.json` is historical/superseded; v1 is retired.
- `transition_contract.v2.json`: entry/exit requests carry owner run/site/phase identity; A0 still owns scene changes and return persistence. v1 is historical/superseded.
- `a8_a0_mount_transition_package.v2.json`: refreshed A0 review package pinned to current A0/A1/A3 heads. Production mount remains unclaimed; old v1 package is marked historical because its owner pins were stale.
- `native_poi_ragnarok_test.gd`: boundary/projection rejection, physical Quarry route/retreat, unknown-water non-stranding, fail-closed endpoint intents, and the source-grounded Waystation walk/retreat/revisit shadow test. `native_poi_contract_test.gd` and transition/surface tests were updated to require owner phase context.

## Evidence status (R0–R5)

| Gate | Scope | Current status |
|---|---|---|
| **R0 — authentic baseline and source compatibility** | Shell/schema hardening, source identity, existing Quarry/Orchard/Mill assets and A1 frame compatibility. | **Prior A8 implementation pass; refreshed-head CI pending.** At `5da2545e`, Python checks, A1 atlas compatibility and Godot 4.7 A8 native suites passed; run `41092440996` passed current-branch import/headless and Xvfb capture jobs. Its overall failure was the original-`main` baseline comparison (20/949 Chapter 2 signed-XP campaign-entry checks for Levels 11–20, plus 3/89 smoke checks for respawn combo reset, tuned light damage, and second-light input). Exact-head runs at the later `02ad8b7` checkpoint were queued; this data/source refresh requires new exact-head CI. |
| **R1 — A0-owned phase transform** | Versioned ordinary→day12/day13/day14/terminal projection, same site/run identity, physical reversible Quarry lanes, cue-only Orchard/Mill. | **A8 native fixture pass; production A0 mount pending.** Godot 4.7 accepted phase boundaries, stale/malformed rejection, fresh-run projection, reversible Quarry lanes, and cue-only Orchard/Mill behavior. A8 still owns no clock or save authority. |
| **R2 — six territory authoring model** | Six unique A1 anchors, ordinary identity, elder/stone identity, counterplay and route/retreat proposal. | **Static data pass; not playable.** Five of six route proposals require A1/native approval; no A5 boss or A3 stone grant. |
| **R3 — physical endpoints and two-economy intents** | Walk-up deposit/vendor/recycler/evacuation sockets; neutral run/site/phase request; no local transaction; source-grounded ordinary Waystation cache request. | **A8 owner-independent shadow pass; separate A0 guarded Waystation candidate; Ragnarok integration pending.** The A8 fixture exercises its reconstructed collision and neutral request boundaries, not A0 Hero movement. A0 PR #21 has a guarded ordinary-cache candidate through A3/SaveService, but this is not normal-entry/full-world acceptance or the A8 Ragnarok endpoint adapter. All four Ragnarok socket approvals and A3 authorizations are absent. |
| **R4 — production owner integration** | A0 mount/transitions/save/restart, A1 geography/socket approval, A3 source/economy binding, AVFX Gold parity. | **HOLD_PRODUCTION.** A8 edited no owner code. The separate A0 guarded candidate covers the ordinary Waystation action only; no A8 Ragnarok endpoint mount, A1 socket approval, A3 Ragnarok authorization, A5 combat, or AVFX Gold parity is accepted. |
| **R5 — rendered visual and human-play acceptance** | Inspect actual frames at target display sizes and conduct human physical traversal/return/revisit. | **`VISUAL_NOT_REVIEWED`; human play not performed.** CI generated prior captures, but the artifact download returned EOF and no actual 720p/1440p/2160p capture was visually inspected. Capture generation is not review; the scripted A1-route harness is not production-world acceptance. |

### Checks executed in this continuation

- `python3 tools/survival/world_content/author_site.py --check` — **PASS** (4 site files; references resolved).
- `python3 -m unittest discover -s tests/survival/world_content -p 'test_*.py'` — **PASS, 29 tests**.
- `python3 -m unittest discover -s tests/survival/world_content -p 'test_a1_atlas_compatibility.py'` — **PASS, 7 tests** (exact frame/crop checks).
- `python3 -m unittest discover -s tests/survival/world_content -p 'test_ragnarok_authoring_contracts.py'` — **PASS, 6 tests**.
- `gdformat` and `gdlint` — **PASS** for the changed GDScript/test files.
- Prior implementation CI at `5da2545e325f28e9edd8857cf9bd74addbc92cdd`: A8 native suites passed; run `41092440996` passed current-branch import/headless and Xvfb capture jobs, with overall failure only in the original-main baseline comparison as summarized under R0. Exact-head runs `41094160608`, `41094160225` and `41094160166` at `02ad8b727298284c16ea7f469d43310021b40f20` were queued at the last refresh; they are not passes. The post-refresh source/data head must receive its own exact-head CI. The local Godot release-asset download and prior rendered-artifact download failed with EOF.

## Current next actions

1. Retrieve and visually inspect actual 720p/1440p/2160p captures; current status is `VISUAL_NOT_REVIEWED` because the artifact download returned EOF.
2. Keep the six-route model and the four Ragnarok endpoint socket coordinates proposal-only until A1 reviews them.
3. Continue A0/A1/A3/A5/AVFX handoffs without changing protected owner code; preserve fail-closed behavior. A0 PR #21 has a guarded candidate Waystation action composition, but normal-entry/full-world mount and the separate A8 Ragnarok endpoint adapter remain pending; A3 must clarify its static `PENDING_A0_MOUNT` status.
4. Conduct separate human traversal/retreat/revisit acceptance after an approved production mount is available.
5. Do not report production mounting, authorized Ragnarok rewards/currency, boss combat, full two-slice production gameplay acceptance, or human play until those separate gates pass.
