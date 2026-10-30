# A8 native world-content pilot — source, native, visual, and production status

**Scope:** A8-owned native content for South Quarry, South Orchard Ruin, and South Crown Mill. This is not an A0 production mount, A3-approved economy, full-game approval, or release-ready integration. Work remains on the existing PR #26 branch.

## Player-visible content implemented in A8-owned roots

- Each canonical site has a **128×128 1:1 exterior shell** and a separate **960×608 interior**. Quarry shell identity stays at A1 cell `[30,280]`; its local interaction stand, portal, and scene spawn are separate interior coordinates. A0 owns reachable-world mounting and transitions.
- Shells use five physical boundary segments around a real south doorway; interiors retain authored collision walls and a central south egress. Typed entry/exit requests carry world/POI/cell identity and local anchors. A8 does not relocate the production Hero, persist world coordinates, or substitute a second SaveService.
- The Quarry has a normal work-side route, two distinct physical preparation branches, and an honest unchosen blocker. East brace opens only `[544,232,20,116]`; west chock opens only `[448,232,20,116]`. Fixture-tested axis-aligned route lengths are 286 px east and 390 px west; the unchosen body remains. Leaving the seam is safe, item-free, and keeps a warning/extraction lock. These are physical traversal distinctions, not simulated damage rates.
- Orchard is a living graft remnant: amber grass/soil, orchard rows and shed, sluice choice, projected flowing channel, and delayed graft-mark return. Mill is a heavy stopped watermill: ash/gravel yard, mill-house/wheel, capability-gated maintenance, repair-or-leave branch, projected race/repair evidence, and a distinct fastener workstation. Their mechanics and native silhouettes differ; they are not palette-only reskins.
- A8 art is visual-only and contributes no collision. A1 route geometry, A0 mount/SaveService, A3 authorization, and A6 avatars are not changed. No duplicate POI, filler placeholder, debug UI, third-party/Cainos art, or fake production receipt is introduced.

## A1 art comparison and exact disposition

The previous A8-local art pin at A1 PR #20 commit `2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b` is superseded by the directly inspected current A1 head `939720d50a0b822ff9042d4104dc69ba78ffe0f8`. A8 copied only the two original-SOH atlas textures into its owned root and refreshed all manifest rectangles from current A1 `atlas.v1.json`:

- `terrain.png`: SHA-256 `4317e9b1aa49dbd401fb6b8c03b67e79311acca90fb04604f9c7017626da811e`, 512×128 px.
- `props.png`: SHA-256 `8be1628352be518e1ac8d7f90a58bb74bf40b1355ff59c3861608d1c99ca2030`, 1024×186 px.

Adopted: A1's 16 px grid, current shared ramp, nearest filtering, source-sized integer props, per-site shell ground rows/road overlays, and authored Quarry/Orchard/Mill landmarks. A1 shell JSON's `a8_definition_sha256` values refer to the older A8 review snapshot (`5ccf7b3f`) and are not treated as current-definition hashes; current identity, bounds, socket, and entry are checked directly. Doorway/bounds corrections are explicit in `a8_art_manifest.v1.json`: omit Quarry handcart and Mill handcart that intrude on the portal, move the Orchard rack left of the clear doorway, shift the Mill wheel left to avoid four-pixel clipping, and move the Mill-house anchor down so the 76 px source frame stays inside its 128 px shell. These corrections change no geometry or collision.

A static atlas-composition preview was used only to review the A1 sprite layout; it is not a native capture and is not visual acceptance.

## A0 reachable-world insertion contract

The actionable A0-owned insertion steps are in `A0_QUARRY_REACHABLE_WORLD_INSERTION_SPEC.v1.md`. The exact Quarry shell transform is root `[424,4424]`, local socket `[64,64]`, canonical pixel center `[488,4488]`, scale `[1,1]`, rotation 0°. A0 must mount only the 128 px shell, and make A1's `node_refuge` → `sp_poi_crown_south_quarry` foot route reachable through world/streaming/camera/collision. A0's current Waystation host is 448×256 px and does not include cell `[30,280]`; current reachability is therefore unproved. The 960×608 worksite is transition-only, never an overworld mount.

A1 PR #20 current inspected head is `939720d50a0b822ff9042d4104dc69ba78ffe0f8`. A0 PR #21 current inspected head is `e0c797cc09eeb8cffa302aaedc5d31d40f368ff3`. A0 remains sole owner of the production mount, live actor/transition checks, global coordinates, durable instance identity, owner adapter, and existing SaveService.

## A3 Quarry economics evidence pack

The machine-readable pack is `data/survival/world_content/quarry_economics_evidence.v1.json`. It records A1 route geometry, distinct interior paths/blockers, extant oak/stone sources and sinks, a proposed-but-unallocated site-bound identity, and symbolic net-yield/break-even scenarios. Unknown route prices, Quarry yield, active cooldown, risk opportunity cost, and source binding remain `null`.

A3 PR #19 current inspected head is `c5e80922132ca9cf89ea15c480e1a4be465ba0b7`. Its Quarry V4 verdict is `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`: no route costs, extraction quantity/source, cooldown, capability grant, or Quarry binding is authorized. Generic `live_stone_chunk` with `poi_id:null` and S2 fixture numbers are not Quarry authority. A3's production adapter must remain fail-closed until A3 issues a new authorization.

## Owner projection and restart boundary

A8 now tests a versioned owner-projection proposal bound to canonical `source_id` and monotonically increasing `projection_revision`. It rejects foreign, malformed, older, and conflicting same-revision snapshots, and requires receipt identity to match the pending intent. A fixture snapshot is JSON-serialized/reloaded to verify that the adapter contract preserves route, claim-generation, clock, and identity semantics. This is fixture-only evidence; it is not A0 SaveService persistence. A0 must map the proposal to its existing service and prove a real process restart with no second reward before production.

The test fixture has fake inventory and candidate values solely for isolated owner-boundary tests. Native scenes default to non-fixture intents; no live Quarry, Orchard, or Mill reward is authorized. No local scene keeps durable state.

## Evidence status — do not conflate categories

### Source/static

- `python3 -m unittest discover -s tests/survival/world_content -p 'test_*.py'` checks the current texture hashes/dimensions, frame rectangles, interior/shell layouts, doorway clearance, wrapper references, source identity, projection contract fields, and price-free UI labels; **13 tests passed** at the source refresh.
- `gdformat --check` and `gdlint` parse/format-check the changed GDScript contracts. Static success does not substitute for Godot runtime behavior.
- A8 code/schema/source checks and the A1 art-composition check are static evidence only.

### Native

- No local Godot 4 executable is installed. For the pushed source `6223a02ccb3822d5d397ed185af048f7159687fc`, A8 run [41037830473](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41037830473) / job `124002951536`, runtime/capture run [41037830464](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41037830464) / jobs `124002951690`, `124002952113`, `124002952131`, and handoff run [41037830541](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41037830541) / job `124002951525` were still **QUEUED** on the GitHub run pages after about 19 minutes: no job steps, duration, logs, or artifacts were available. `gh run view` then hit GitHub API rate limit (HTTP 403); this is not an authentication error and not evidence of a source failure. Native import, physical movement, interactions, exact-head transition tests, serialized restart behavior, and visual review remain unverified. These run IDs apply only to `6223a02`; any later source commit requires fresh exact-head checks.
- The last **old-head** failure, run `41024526858`, job `123959371999`, is described by the CT review as import success followed by failure in the native physics/interaction step while preloading `poi_authority_fixture.gd`, with parser/inference cascades in `native_poi_contract_test.gd`; later steps were skipped and the run had zero artifacts. Direct `gh run view --log-failed` retrieval ended with EOF. Do not infer a particular API call as the cause, and do not apply this old-head result to new source without current-head logs.

### Visual

- When the exact-head CI capture runs, inspect actual native captures at 1280×720, 2560×1440, and 3840×2160. Capture generation alone is not review. Static previews do not meet this criterion.

### Production

- Not mounted or demonstrated reachable in A0, no A0 SaveService adapter, no live site binding, and no A3 authorization. This pilot is not production-integrated or complete.

## Cross-owner decisions

CT decisions D051–D054 are authoritative on `docs/ct-loot-discovery-gate-20261030`. D052 prohibits AI-work clutter, meaningless POIs/debug labels, and declaring completion without inspected native/visual evidence. D053 requires repository-first research. D054 delegates competent non-avatar art selection and expects substantive native output. This work adopts the inspected A1 visual contract and leaves A6 avatar ownership untouched; no A6 files are modified.

- **A0:** review/implement the reachable-world spec within A0 ownership and prove live reachability/transition/SaveService restart.
- **A1:** retain the canonical cell/route/footprint; review the doorway-clear shell visual skin, which is visual-only.
- **A3:** reassess each route cost and site-bound extraction source only after native route/restart evidence. Keep live values and transactions blocked until a new authorization.

No merge is requested or performed.
