# A8 → A0 / A1 / A3: South Quarry native-content handoff

**Disposition: A8 native candidate, not production-integrated, not economy-authorized.** This handoff is constrained to A8-owned scenes/scripts/data/tests/docs. PR #26 remains the existing workstream; do not merge or create a replacement PR.

## Canonical insertion target

- A1 PR #20 current inspected head: `939720d50a0b822ff9042d4104dc69ba78ffe0f8`.
- World / POI / region / cell: `world:soh_continent_v1` / `poi_crown_south_quarry` / `r_ashen_crown` / `[30,280]`.
- A1 authored foot spur: `sp_poi_crown_south_quarry`, from `node_refuge` at `[56,218]`, no capability gate, early band.
- A8 offers two separate scene roles: `south_quarry_overworld.tscn` is a 128×128 shell with socket `[64,64]`, entry `[64,108]`; `south_quarry.tscn` is an isolated 960×608 local worksite with spawn `[480,548]`, stand `[506,378]`, socket `[506,302]`, exit `[480,560]`.
- Exact 1:1 shell root calculation is `[424,4424]`, aligning the shell socket with canonical world pixel `[488,4488]`. This is a review transform, not a production mount. A0's current Waystation host/geometry is 448×256 px and does not contain Quarry cell `[30,280]`; A0 must make the route genuinely reachable and keep world/camera/streaming bounds valid before mounting. The actionable A0-owned steps are in `A0_QUARRY_REACHABLE_WORLD_INSERTION_SPEC.v1.md`.

## Native Quarry gameplay candidate

The worksite has one normal approach/retreat route to the work stand, a physical unstable-seam choice, and two spatially distinct alternatives. `brace_east_shelf` addresses the east shelf blocker `[544,232,20,116]`; `chock_west_ramp` addresses the west blocker `[448,232,20,116]`. Only the owner-projected selected blocker is removed; the opposite route remains a physical `StaticBody2D`. Their test paths are 286 px east and 390 px west (104 px / 6.5 tiles apart). `leave_seam_unworked` is safe and item-free; it leaves a warning and extraction remains unavailable. These are traversal/risk distinctions, not measured damage rates.

The quarry's candidate action amounts in `catalog_candidates.fixture.json` and local test authority are fixture-only. A3 PR #19 current inspected head is `c5e80922132ca9cf89ea15c480e1a4be465ba0b7`; its V4 decision is `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`. No route cost, extraction yield, source binding, cooldown, capability grant, or production item receipt is authorized. Generic `live_stone_chunk` with no Quarry POI binding does not authorize an outcrop reward. A8 provides a symbolic break-even/source-sink/traversal evidence pack at `data/survival/world_content/quarry_economics_evidence.v1.json`; unknown quantities remain `null` for A3 to decide.

## Distinct Orchard and Mill experiences

- **Orchard** (`[140,360]`) is a living graft remnant: orchard rows and shed, grass/soil palette, accessible sluice choice, projected flowing water, and a delayed graft-mark return. Honey and rare herb are not live grants.
- **Mill** (`[120,300]`) is a heavy water-powered machine: ash/gravel yard, mill-house silhouette and wheel, visible stopped race, `cap_salvage` outer/inner gates, repair-or-leave branch, physical maintenance route, and a separate fastener workstation after repair. The wheel's rendered source sprite stays static; state is communicated by race/prop projection, not fabricated animation or reward.

These loops are mechanically and visually distinct, not palette-only reskins. Orchard and Mill fixture items/timers remain non-live, and A3 has no authorized bindings for either site.

## A1 visual source: compare, adopt, and reject explicitly

The imported A8 art pin `2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b` has been superseded after direct comparison with A1 PR #20 head `939720d50a0b822ff9042d4104dc69ba78ffe0f8`. A8 now copies only the two original-SOH atlas sheets into its own art root:

- `terrain.png`: SHA-256 `4317e9b1aa49dbd401fb6b8c03b67e79311acca90fb04604f9c7017626da811e`, 512×128 px.
- `props.png`: SHA-256 `8be1628352be518e1ac8d7f90a58bb74bf40b1355ff59c3861608d1c99ca2030`, 1024×186 px.

The A8 manifest now uses A1's current `atlas.v1.json` frame coordinates, 16 px terrain, nearest filtering, 1:1 integer source-size props, shared ramp, and the three A1 shell ground/road/landmark layouts. No A1 production geometry, mount, collision, or avatar code is copied or changed. A1's shell contract has per-site `a8_definition_sha256` values tied to its older A8 review snapshot (`5ccf7b3f`); A8 does **not** treat those stale definition hashes as current-source checksums. Immutable shell identity/bounds/socket/entry are checked against the present A8 definitions instead.

A8 preserves the intended A1 visual style but adjusts four props to keep real doorways clear and frames inside the shell: Quarry `handcart@[40,112]` omitted (the source anchor intersects the entrance and a left alternative overlapped the authored rock); Orchard `drying_rack@[40,96]` moved to `[24,96]` (outside the clear rectangle); Mill `handcart@[40,112]` omitted; Mill `mill_wheel@[104,80]` moved to `[100,80]` (56 px frame fully inside 128 px), and Mill house moved from `[72,64]` to `[72,76]` so its 76 px height is not clipped. The adjustments are visual-only; shell collision/entry geometry is unchanged. They are recorded in `a8_art_manifest.v1.json`.

## Owner boundaries and projection contract

A8 emits versioned intents and consumes an owner projection; it has no scene-local inventory, receipt, or production save state. The test fixture is explicitly not an autoload or economy service. A8's proposed projection contract binds `source_id` and monotonic `projection_revision`, rejects malformed/foreign/stale/conflicting projections, and checks matching receipt identity. A0 must approve/map this proposal onto its existing SaveService; the fixture's serialized JSON snapshot/restart is not production persistence evidence.

- A0 PR #21 current inspected head: `e0c797cc09eeb8cffa302aaedc5d31d40f368ff3`. A0 alone owns reachable-world mount, Hero transitions, actual global position, durable identity, projection adapter, and SaveService.
- A1 alone owns canonical world cell, route, region, and footprint geometry.
- A3 alone owns item costs/yields, source/action binding, cooldown and capability authorization.
- CT decisions D051–D054 are authoritative on `docs/ct-loot-discovery-gate-20261030`. D052 rejects filler/debug clutter and forbids declaring completion without inspected native/visual evidence; D053 requires repository-first research; D054 delegates competent non-avatar art selection and expects substantial output. This change selects the current A1 art rather than touching A6 avatar ownership. No A6 avatar files are changed.

## Evidence status (keep categories separate)

- **Source/static:** A8 atlas hash/frame/layout assertions, author-site checks and Python tests can establish serialized structure and provenance only. A1 art-source sample renders may be inspected as static composition checks; they are not native Godot captures.
- **Native:** Must be run on the pushed exact PR head using Godot 4.7: import, physics/interaction contract, entry/exit/revisit transition tests, both Quarry route tests, owner-projection serialization/restart, and any failure logs. No native PASS is claimed from static checks or a queued workflow.
- **Visual:** Inspect actual native exterior/interior captures at 1280×720, 2560×1440 and 3840×2160 when CI supplies them. Generation alone is not review.
- **Production:** Not mounted/reachable in A0 and no SaveService integration has been done. The exact A0 reachable-world insertion contract is the separate spec above; no live economy is enabled.

The old-head failure `41024526858`, job `123959371999`, is summarized by the CT review as an import-success/native-physics-step failure while preloading `poi_authority_fixture.gd`, followed by parser/inference failures in `native_poi_contract_test.gd`; later route/capture steps were skipped and no artifacts were produced. `gh run view --log-failed` itself ended with EOF, so this is CT-provided old-head evidence only. It does not establish the current-head failure cause; current native logs must be read from the exact pushed head.

## Requested review

- **A0:** Review and implement the reachable-world insertion spec under A0 ownership; do not mount the 960×608 room over the world.
- **A1:** Confirm the 128×128 visual skin against the canonical `[30,280]` shell/doorway; no route/cell change is proposed.
- **A3:** Reassess each separate route cost and a durable site-bound outcrop source only after the native route/restart evidence is available. Keep all numeric transaction values and live rewards fail-closed until new authorization.

This is an A8 evidence handoff, not a merge request, production grant, or claim of completion.
