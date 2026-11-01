# A8 Integration Package — 2026-10-31

## R13-A8-POI2 continuation overlay

**Assignment:** PR #26 only; build distinct South Quarry and South Orchard physical destinations while preserving A1's canonical `[30,280]` and `[140,360]` anchors. Do not relocate either POI to fit A0's legacy-sized host. The new A8-owned mount/identity/collision handoff is [`a8_physical_destinations_r13.v1.json`](../../../data/survival/world_content/a8_physical_destinations_r13.v1.json); round evidence is in [`A8_R13_POI2_WORKLOG_20261031.md`](A8_R13_POI2_WORKLOG_20261031.md).

PR #26 remains **OPEN / UNMERGED**. Refreshed owner references: A0 PR #21 `ee5f9f5160c8e4385f35a63b355ddda957f93d10`, A1 PR #20 `a030cb89a5033ba5faba39995762b4bea1332cec`, A3 PR #19 `b44e22df3af40939069189be14afc23ee1ce21c4`. A1's current runtime contract retains the 1024×768 authored geography and canonical anchors; A8 shell roots computed from the 16px cell-center transform are Quarry `[424,4424]` and Orchard `[2184,5704]`. The Quarry safe threshold is A1 `[30,278]`; Orchard approach `[140,362]` is explicitly an A8 proposal requiring A1 review. The current A0 owner still controls production composition, route reachability, transitions, durable instance IDs, and SaveService. Neither site is production-mounted by this PR.

A3's exact current Quarry authorization `379573cc54475b9901b63378d8bbf67edf5462cfc757859ae15f0c208f12191c` is `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`: no Quarry binding, cost, yield, cooldown, source allocation, or capability grant is authorized. The new Quarry deep section requires only existing owner-projected `cap_salvage` + `cap_power_1`, a prepared route, and an A0-projected open gate; A8 grants nothing. The scene's marked scree is a collision/route challenge only—damage/exposure authority remains unproven. Orchard stays a separate water/graft geography with a physical sluice/boardwalk route and owner-ready graft-mark information action; there is no Orchard item/yield binding. New neutral test actions add empty fixture costs/rewards and no cooldown or receipt.

Current verdict remains **`PARTIAL_WITH_BLOCKERS`**. Exact implementation SHA, hosted CI, image eye-review, and owner handoff must be updated in the R13 worklog before any stronger claim. A8 fixture results do not establish an A0 mount, durable SaveService restart, production economic action, human acceptance, or product completion.

**Historical Round 9 decision:** `ACCEPTED_SCOPED` for the A8-owned native pilot only; `HOLD_PRODUCTION`; PR #26 stays open and unmerged. This did not accept production gameplay, economy, human play, or visuals.

## Round 12 A8 continuation overlay (2026-10-31; supersedes Round 10 code-status wording)

PR #26 remains open and unmerged on `arena/2d7e6d7a-soul-of-hero`. The current implementation patch is a working-tree continuation based on A8 head `6337533f7cc0d39487921e279d3967ac29a59297`; exact implementation SHA/hosted runs will be recorded after push. Refreshed open owner heads: A0 PR #21 `738e621b688e9d9890f636ef2ece48f6d29f5b01`, A1 PR #20 `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`, A3 PR #19 `b44e22df3af40939069189be14afc23ee1ce21c4`. Source hashes for the A1 atlas/terrain/props and A3 data files were checked against those exact heads before updating active pins; content hashes remain unchanged except A3 `items.json` (`cd1a27c48078a69489904e86182dc63750941d9fc296830f711dd5d574615520`).

Round 12 changes the frame-driven journeys from `player_probe.gd` to the current checkout's `knight.tscn`, reports the measured collider/speed, centers an integer-scaled camera, adds source-atlas context ground around the existing worksite/shell bounds, and implements stateful Orchard water width, Mill race/wheel presentation, Quarry readiness gating and one source-evidence candidate. This does **not** create an A0 production mount, durable instance, SaveService restart proof, A3 approval, source capacity, active cooldown, reward, or production-play proof. The A0 current-head `knight.tscn` matches the A8 checkout scene, but the A0 current-head `knight.gd` differs from the script in this checkout; do not label the A8 journey as exact A0 mounted gameplay. Local runtime tuning resolves `move_speed=112 px/s` (the checked-out script's base declaration is 96 before `config/gameplay_tuning.json`); the measured body remains 12×16 px at offset `(0,-8)`.

Local checks currently pass: 30 Python tests, `author_site.py --check`, GDScript `gdformat`/`gdlint`, workflow YAML and `git diff --check`; local Godot 4.7 import and six headless suites pass (1,260 assertions). Headless journey output explicitly skips image capture. Exact pushed-SHA hosted CI, current 720p/1440p/2160p image capture and eye review remain pending. Quarry source candidate is explicitly blocked: `a3_approved_bindings=[]`, all actual costs/yields/cooldowns null, A0 instance null; generic `live_stone_chunk` remains unbound, and existing `stone_pick` is `persistent_home`-only. See `A8_ROUND12_WORKLOG_20261031.md` when committed and updated with exact CI evidence. Overall status remains `PARTIAL_WITH_BLOCKERS`; no merge.

## Round 10 current-status overlay (2026-10-31; historical after Round 12)

The current continuation verdict is **`PARTIAL_WITH_BLOCKERS`**, not Round 10 complete. New frame-driven Quarry/Orchard/Mill input journeys, owner-readiness gates, and a three-resolution Xvfb capture run are implemented, but their exact pushed-SHA Godot execution/CI and actual visual inspection are still required. Mill repair/fastener remain `WAITING_FOR_A3_A0`; no production mount or human play is accepted. See [`A8_ROUND10_WORKLOG_20261031.md`](A8_ROUND10_WORKLOG_20261031.md) and [`A8_ROUND10_PR_HANDOFF_20261031.md`](A8_ROUND10_PR_HANDOFF_20261031.md) for WP0–WP6, missions A–F, nine strict gates, current blockers, and owner requests. The historical statuses/tables below describe the earlier checkpoint and are superseded where this overlay differs.

## Exact review identities and CI

| Owner | PR | Current head queried | Relevant verified source identity |
|---|---:|---|---|
| A0 | [#21](https://github.com/Khanh-glitch/Soul-of-Hero/pull/21) | `4b4b63f56b92c2f7b50d770554afd96d5d0a098b` | Candidate slice `data/survival/connector/a0_candidate/slices/poi_crown_waystation.slice.json`: `3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f`; `waystation_host.gd`: `23c7f6c2c04ab40e1008943336029e278244ed58a604f265452afeb6bab97243`; `economy_session.gd`: `06ce3c98a90f3b296cdaae961162b903d171fcf2796283a0fb7670be461b159b`; `save_service.gd`: `7d07873381b6d9e8bdc44ea7845ffe191b632f66b6c677cc8208025b4390f21b`. |
| A1 | [#20](https://github.com/Khanh-glitch/Soul-of-Hero/pull/20) | `7d2b017c8a90b7d5e24ff85f065ff1b18548cd29` | Waystation slice `3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f`; Waystation authoring `8f2e437a9c4200f737e1b048be70030e4affde37012f1f05421efe7a2e8064cf`; world plan `fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4`; route graph `8e49506889149cde043ed69cf5007b219c9ba9464cb7d3eeb25f0eef108d24a9`. |
| A3 | [#19](https://github.com/Khanh-glitch/Soul-of-Hero/pull/19) | `35214ed8f555350b83bd8985e9bec7512f3181e8` | `world_source_bindings.v3.json`: `7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b`; `meta_economy.v1.json`: `bbe1095ca589a767742bf0a54ffd4f012d2135410713baa274bafee97cbf91bf`; V7 A0 meta integration contract: `69f52eac22cd15d66464a6b07fe2af2c157032f273b8e42a502715be0882b50b`; display registry: `bc5dc5173a13ffcea691289c860baa5532c79b246ad4685ecc2572f75c707c59`. |

Source-byte verification found A0's candidate Waystation slice **byte-identical** to A1's canonical Waystation slice. The six A1 files pinned by A3's current world-source binding were also checked against A1 PR #20 head and are byte-identical; A3's own Waystation binding hash is unchanged across current A0/A3 heads. The earlier A8 world-plan digest `fc541282…` was incorrect; the exact file digest is `fc5412df…`. The corrected digest was independently computed from the file at the older A1 checkpoint and the current A1 head; those file bytes are identical. No owner branch was edited.

**Stale-pin corrections:** A8's A1 head `61cd8d37…` is refreshed to `7d2b017c…`; A8's A3 head `a5d11141…` is refreshed to `35214ed8…`; and A8's A0 head `5b932fd4…` is refreshed to `4b4b63f5…`. The Waystation slice/authoring, A3 binding, route graph and other recorded content hashes were checked against current owner bytes and retained when identical. A3's binding file itself contains an older A1 `current_head` note (`939720d5…`); all six file digests referenced by that binding were checked byte-identical at the current A1 head, so those content pins remain valid, but A3 should refresh the embedded head note. The A3 binding's `A0_MOUNT_PENDING` status is also now underspecified given A0 PR #21's guarded candidate; A3 should distinguish that candidate from normal-entry/full-world production acceptance. No A3 data was edited.

At the pre-refresh A8 checkpoint `02ad8b727298284c16ea7f469d43310021b40f20`, exact-head runs [41094160608](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41094160608), [41094160225](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41094160225), and [41094160166](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41094160166) were all queried and remained **queued**. There was no exact-head CI result. A8 native evidence at `5da2545e325f28e9edd8857cf9bd74addbc92cdd` remains prior evidence only; subsequent source/data refresh requires its own exact-head CI. Earlier run links: [41092440747 — A8 native suites](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41092440747) and [41092440996 — runtime/rendered + baseline comparison](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41092440996).

## Approved/source-grounded versus pending sockets

### Existing, source-grounded ordinary interaction

- The existing A1 Waystation cache is `poi_crown_waystation` / `node_waystation_cache`, object cell `[406,203]`, stand cell `[406,202]`, A3 binding `a1_waystation_roadside_cache_v3`, source instance `si:r_ashen_crown:waystation_cache:01`.
- This is an A1-authored existing interaction, **not** a new A8 socket or POI. A0 PR #21 contains a guarded candidate composition: the current A0 Waystation host resolves that ordinary action, its economy session calls the A3 world-action adapter, and the adapter is configured on the same A0 SaveService. Its production-scene candidate test uses synthetic input and a guarded candidate setting; it is not normal-entry/full-world acceptance, human play, or proof of a full A1 geography mount.
- The A8 native Waystation test remains a separate shadow-physics harness using a reconstructed obstacle subset and `request_test_motion`. It is not ordinary A0 Hero movement and does not fix or establish the A0 production route wedge.

### Pending — no Ragnarok socket approved

All four proposed endpoints remain `A1_REVIEW_REQUIRED_SOCKET_NOT_CANONICAL`: deposit at Waystation, fixed vendor at Waystation, recycler at Amberwood Mill, and evacuation at Saffron Drydock. Their `fixture_position_px` coordinates are test-harness pixels, not canonical world cells. Referencing existing POI anchors does not approve new physical placement. A1 must supply canonical endpoint cell(s), stand cell, clearance/collision and route/retreat evidence and explicitly approve each socket. No POI count increase is authorized.

The six territory entries point to current A1-authored POIs/routes and retain their ordinary identities, but do not establish native geometry, approved sub-sockets, playable encounters, or bosses. The anchors remain authored-plan-only; five of the six route/counterplay variants still need A1/native review. No A8 socket is approved at an Elder site by this package.

## Contract comparison and mismatches

### A8 Waystation vs A0/A1/A3

- **A1:** Waystation slice and authoring bytes at current PR #20 match the A8 pinned source files. Its ordinary cache stand/action identity is consistent with the current A0 candidate slice and A3 binding.
- **A3:** The current binding names `cache_restock`, `cap_salvage`, canonical instance `si:r_ashen_crown:waystation_cache:01`, output of 3 `iron_scrap` plus 2 `knowledge_spares`, and 1800 active seconds. These are A3 terms, not A8 payload fields or grants.
- **A0:** PR #21's guarded candidate implements the ordinary Waystation A3 action path with an A0 SaveService composition. This corrects the old A8 statement that the ordinary receipt/save path was wholly unintegrated. The wider normal-entry/full-world production mount and human acceptance remain open. A3's current binding's static `...PENDING_A0_MOUNT` status therefore needs A3 to distinguish a guarded A0 candidate from a fully accepted production mount.
- **A8:** The neutral A8 intent is not the same as A0's ordinary `try_waystation_interaction` API. Preserve the separate A8 shadow proof and do not treat it as evidence of the guarded A0 candidate's movement.

### Six territories and A3 economy naming

The current A1 plan contains the six referenced canonical POIs and routes, with the same source cells and routes as the prior A1 checkpoint. All remain `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`. The A3 V7 policy says the physical item identifier is `ragnarok_unbanked`, the profile balance field is `profile.secured_ragnarok_currency`, and the display registry keys are `currency.ragnarok_unbanked` and `profile.secured_ragnarok_currency` (both display labels are marked `WORKING_TITLE`). A8's prior `wallet.ragnarok.unbanked`, `profile.ragnarok.secured`, and dotted `.display_name` candidates did not match the current A3 schema; A8 data now uses the A3 technical IDs while retaining proposal-only status. This is identifier reconciliation only—not approval to grant, deposit, spend, or create a parallel wallet. Rates remain AI-tunable/proposed, not creator-approved.

### Ragnarok endpoint A0/A3 seams

A8's `soh.a8.physical_intent.v1` requests carry owner-projected run, epoch, phase/revision, site-instance, endpoint/action and observed physical approach. A0 PR #21's existing Waystation candidate API handles its pinned ordinary actions; the reviewed A0 source does not supply an A8 Ragnarok endpoint authorization/commit adapter. A3's V7 meta contract remains `OWNER_CONTRACT_CANDIDATE_A0_ABSENT_FAIL_CLOSED`; its meta callables are candidate-only. Therefore all Ragnarok endpoint intents remain non-authoritative, unavailable owner endpoints fail closed, and A8 must not locally mutate save, inventory, currency, price, stock, reward, receipt, or run outcome.

## Owner actions and external dependencies

| Owner | Required action before production acceptance |
|---|---|
| **A0** | Specify/review the A8 intent adapter; validate active run, epoch, phase projection revision, exact site/endpoint identity, actor/world transform, physical range/facing, and duplicate request before owner transaction. Keep receipts and durable idempotency in existing SaveService. Mount only after exact normal-entry A0 Hero movement, collision, approach/retreat/revisit, restart, expiry and rollback gates. The A0 guarded candidate does not prove the A8 endpoint route or resolve the route wedge. |
| **A1** | Confirm the refreshed source pins and review/approve or reject every proposed Ragnarok socket's canonical cell/stand/collision/route. Review the five non-local territory route/counterplay proposals. Do not add POIs or silently move existing anchors. |
| **A3** | Publish endpoint-bound authorization/action contracts for deposit, fixed stock/prices and recycler plans; preserve fail-closed status until live A0 composition is accepted. Reconcile the binding's pending-mount wording against A0 PR #21's guarded candidate. Keep policy rates versioned and explicitly unapproved; use the exact current IDs/display registry. |
| **A5 / AVFX** | A5 owns real boss/combat/stone outcomes; AVFX owns exact Gold content and timeline. Neither is implemented or substituted by A8. |
| **A8** | Keep intent payloads neutral, preserve the existing three-site and six-territory identities, update pins only after source-byte checks, and keep fixture/shadow evidence separate from owner integration. |
| **Human / QA** | Inspect actual 720p/1440p/2160p captures and conduct normal-entry physical play, return/revisit, failure and restart acceptance after an approved production mount. |

### Required negative/integration tests

Existing A8 native fixtures cover stale/conflicting/foreign/malformed A0 phase projections, missing site identity, phase/time mismatch, terminal interaction rejection, physical collision and facing, missing-owner fail-closed emission, neutral payload fields, duplicate pending requests, owner rejection and physical approach/retreat/revisit. They use A8's test fixture authority and reconstructed collision—not A0 production authority.

Before acceptance, owner-composed tests must also prove that unavailable A0/A3 endpoints emit no commit and leave the same SaveService candidate unchanged; stale run/epoch/phase revision, foreign site, wrong actor, out-of-range/wrong-facing, unsupported socket and duplicate/replayed requests are rejected; interrupted save/restart cannot double grant; missing A3 source/action binding cannot mutate; and run expiry/reset, vendor/recycler, currency and evacuation remain owner-authorized only. Any fail-closed negative path must leave inventory, profile fields, receipts and run lifecycle unchanged.

## Local validation for this A8-owned refresh

- `python3 -m unittest discover -s tests/survival/world_content -p 'test_*.py'` — **29/29 passed** after the refreshed A0/A1/A3 pins and A3 identifier alignment.
- `python3 tools/survival/world_content/author_site.py --check` — **passed** (4 site files; references resolved).
- No owner code was changed. Godot native tests were not rerun locally just to recreate prior evidence; the new exact-head CI must validate this source/data refresh.

## R0–R5 status

| Gate | Status | Evidence / boundary |
|---|---|---|
| **R0 — source and baseline compatibility** | **Scoped A8 pass at prior tested implementation; refreshed-head CI pending.** | Exact relevant owner bytes/hashes above; A8 native run 41092440747 and 29 Python world-content tests at implementation SHA `5da2545e`. Runtime differential run 41092440996 passed current-branch import/headless and Xvfb captures; its overall failure was original-main baseline comparison only (20/949 Chapter 2 signed-XP checks for Levels 11–20, and 3/89 smoke checks for respawn combo reset, hot-tuned light damage, and second-light input). These do not change A8 scope. |
| **R1 — A0 phase projection / A8 site transforms** | **A8 fixture behavior scoped; A0 production mount pending.** | Phase projection parsing, stale rejection, reversible Quarry lane fixtures and cue-only Orchard/Mill are owner-independent. A8 owns no clock, SaveService or run lifecycle. |
| **R2 — six Elder territories** | **Authoring model only.** | Six distinct identities/routes are represented; not six playable bosses, not native-integrated A1 geography, no A5 combat or A3 stone grants. |
| **R3 — physical endpoints / Waystation** | **A8 shadow pass; ordinary A0 guarded candidate exists; Ragnarok sockets and transactions pending.** | The A8 Waystation movement test uses `request_test_motion`, not A0 Hero input. A0 PR #21's guarded candidate is a separate test composition, not normal-entry/full-world acceptance. All four Ragnarok sockets remain unapproved. |
| **R4 — A0/A1/A3/A5/AVFX production integration** | **HOLD_PRODUCTION.** | No A8 production mount, A1 socket approval, A3 Ragnarok authorization, A5 boss implementation, or AVFX Gold parity is claimed. |
| **R5 — rendered visual / human acceptance** | **`VISUAL_NOT_REVIEWED`; human play not performed.** | The prior rendered artifact exists on Actions, but the artifact download returned EOF and no actual 720p/1440p/2160p capture was visually inspected. Capture generation is not review. No human journey was performed. |

## Scope and negative claims

This package does not edit owner PRs or A0 SaveService/A1 master geography/A3 economy/AVFX Gold. It creates no A0 clock, second save authority, direct currency credit, free item/Core, invented reward, forced run finalization, teleport-based acceptance or fake boss fight. `request_test_motion` shadow movement does not fix A0's production route wedge. The native milestone is `ACCEPTED_SCOPED`, never production-accepted; keep PR #26 open and unmerged.
