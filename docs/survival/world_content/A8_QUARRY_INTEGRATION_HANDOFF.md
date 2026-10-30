# A8 → A0 / A1 / A3: South Quarry native-content handoff

**Disposition: A8 source candidate; A0/A3 integration HOLD.** This is focused owner closeout on existing PR #26 only. It is not a new PR, merge request, POI expansion, production grant, or claim of completion.

## Exact review pins and target

- PR #26 source base before the current physical-quality package: `0e22d5f00532cf5e079b540e30a54281606fc757`; the final implementation SHA is the current PR head after this package is pushed.
- A1 PR #20 current inspected head: `5aed8e8647c896e9a79ea812735ec237342462c4`.
- A3 PR #19 inspected head: `4bfba38d87bb2b6529745bf4a3caf2ba0ca07947`; Quarry remains `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`.
- A0 PR #21 inspected head: `32bced6d612958838cdf337b437685316c6d9009`; A0 alone owns production mount, transitions, durable identity, projection adapter, and SaveService.
- Canonical Quarry: `world:soh_continent_v1` / `poi_crown_south_quarry` / `r_ashen_crown` / `[30,280]`; A1 foot spur `sp_poi_crown_south_quarry` is early/no-capability.
- Preserve shell `128×128` at root `[424,4424]` with local socket `[64,64]`; local worksite is a separate `960×608` interior with spawn `[480,548]`, stand `[506,378]`, socket `[506,302]`, exit `[480,560]`. A0 mount/reachability/transition is unproven; do not treat the transform as a production mount.

## Corrected economic intent boundary

A8 sends neutral `soh.native_poi.intent.v2` only: `contract_id`, `contract_version`, `intent_id`, `source_id`, `object_id`, `action_id`, `claim_id`, and `observed_projection_revision`. It sends **no** costs, rewards, cooldown, claim policy, state delta, unlock, `catalog_source`, A3 approval/client flag, or receipt. A0 must independently resolve the canonical A1 object/current state and exact A3-approved action binding; unknown/extra fields and all unapproved actions fail closed. The default nonfixture scene has no fixture-mode flag. Fake costs, rewards, readiness timers and item quantities reside only in `tests/fixtures/survival/world_content/a8_native_poi_action_catalog.fixture.json` and the test-only fixture authority. A0 must use its existing SaveService for independently resolved authorization, atomic debit/grant/state/cooldown, and durable receipt.

Quarry paths remain physically distinct: east brace path 286 px; west chock path 390 px; difference 104 px / 6.5 tiles. This proves only route geometry, not strategic value. A8 now uses per-item inventory vectors and bounded source/sink evidence in `data/survival/world_content/quarry_economics_evidence.v2.json`; it does not subtract oak counts or an unknown exposure term from stone. Approved binding, source allocation, costs, yields, active cooldowns, capability grant and opportunity value remain `null`.

## Direct A3 decision request

A3: decide whether the Quarry can be approved as **one explicitly bound source and action** under the evidence in `quarry_economics_evidence.v2.json`. If yes, publish the canonical binding, item-vector costs/yields, source allocation, active-time cadence, capability effects and any measured route/risk valuation in A3-owned data. If no, state the missing evidence or reject the proposal; keep A0 dispatch disabled. Current generic stone source (`poi_id:null`) and recipe sinks are evidence only, not Quarry authorization. A3 also owns any Orchard/Mill material terms; A8 does not propose live values for them.

## A1 atlas compatibility: exact helpful frames only

The A8 complete texture pin remains at A1 `939720d50a0b822ff9042d4104dc69ba78ffe0f8`; current A1 PR #20 head is `5aed8e8647c896e9a79ea812735ec237342462c4`. `data/survival/world_content/a1_atlas_compatibility.v1.json` and `tests/survival/world_content/test_a1_atlas_compatibility.py` compare exact per-frame RGBA crop pixels for every terrain/prop frame referenced by the three sites. All 23 terrain and 25 prop crops match; 23 used prop rectangles moved in A1 but the pixels remain identical. A8 retains its complete older pin and exact original Gold; it does not repin its own local coordinates. Current A1 has 80 shore-transition masks, of which 40 are in the three sites’ candidate-family union, plus two unrelated notes-crate props; none of those is adopted because A8 has no neighbor compositor and the crates are unrelated. Separately, A8 adopts only five exact current-A1 crops into its small local surface strip (mud variants and one boardwalk tile) for the authored Orchard bank/bridge; its existing four snow frames are also pixel-verified but remain unapplied while weather is UNKNOWN. Preserve canonical cells/identity, real path/blocker/doorway geometry, original ten dungeons, and shell/interior split. No A1 edit or source provenance change is proposed.

State-linked low-risk cues: Quarry seam warning hides only after owner-projected brace/chock; Orchard deadfall warning hides only after owner-projected flowing channel; Mill seized-race warning remains visible at baseline. These cues indicate authored state only; no invented hazards, damage, or loot.

## Player-facing intent and evidence

- **Quarry:** approach, choose east brace or west chock or leave the seam untouched; a selected owner-projected route changes exactly one blocker, the other remains closed; retreat and return. No economic term is live.
- **Orchard:** choose to clear the sluice or leave it; projected water flow changes the deadfall cue; no honey/herb grant is authorized.
- **Mill:** inspect the seized wheel, choose repair or leave; the stopped race remains legible, and only owner-projected state changes the cue/path. No fastener reward is authorized.
- These are A8 local interaction/art intentions, not proof a player can reach any site in A0 or that the choices are strategically balanced.

## Evidence status — do not conflate

- **A8 source/static:** `author_site.py --check`, all 23 Python world-content tests, `gdformat`, and `gdlint` pass locally. These verify source/data and static syntax only. Exact-head CI for this patch starts after push.
- **Godot native:** HOLD pending execution. Godot 4.7 is being built from the official source because no executable is preinstalled; the native interaction/transition/surface tests have not yet run. Older exact-head CI is not evidence for this patch. No 720p/1440p/2160p captures or visual acceptance are claimed.
- **A0 production:** HOLD. Current-world reachability, mount, actor entry/exit, persistent world position, SaveService restart and durable owner receipt are not demonstrated. See `A0_QUARRY_REACHABLE_WORLD_INSERTION_SPEC.v1.md`.
- **A3 economics:** HOLD. No Quarry binding, item cost/yield, cooldown, capability grant, source allocation or route opportunity value is approved. `quarry_economics_evidence.v2.json` is a fail-closed decision request only.
- **Human play:** HOLD. No native inspected playthrough proves a recognizable strategic choice or safe retreat/revisit.

The old-head failure `41024526858` / job `123959371999` belongs to `5ccf7b3…`; CT summarized import success then a native physics/interaction preload/parser failure in that old test. The log retrieval ended with EOF, so do not infer a precise cause or apply it to current source.

## Requests

- **A0:** own reachable-world mount/entry/exit, authoritative A1/A3 resolution, SaveService atomic commit/restart, and exact-path native play; do not promote fixture values or invent a second authority.
- **A1:** no source change requested. Current A1 frames used by the three sites are pixel-identical to the retained A8 pin; new transition masks are not adopted without a compositor.
- **A3:** issue a decision under the evidence in `quarry_economics_evidence.v2.json`, or keep the source/action unbound and state missing evidence.

No merge is requested or performed.
