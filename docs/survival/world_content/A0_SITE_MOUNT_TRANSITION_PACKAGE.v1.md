# A0 production mount and site-transition handoff (A8-owned package)

Status: **READY FOR A0 REVIEW; NOT A PRODUCTION MOUNT OR SAVE PROOF**

## Exact source pins reviewed

- A8 PR #26 working source before this package: `0e22d5f00532cf5e079b540e30a54281606fc757` (the handoff must be refreshed to the eventual commit SHA).
- A1 PR #20 current: `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`.
- A0 PR #21 current: `738e621b688e9d9890f636ef2ece48f6d29f5b01`.
- A3 PR #19 current: `b44e22df3af40939069189be14afc23ee1ce21c4`.

A0 advanced from reviewed head `eedf933e910eaf28568a63c03e51d0b864a18d5c` during this verification. The exact-head diff changes only `.github/workflows/a0-production-waystation-candidate.yml`; the current connector still disables the annex build and marks it non-playable, while `SaveService` and the legacy A0-owned `active_seconds` binding are unchanged.

A0 remains the sole production mount, transition, SaveService, durable-reload, and owner-receipt authority. A3 remains the sole Quarry authorization/economics authority. A8 supplies local scene assets, local collision, neutral intent v2, and transition request identities only.

## Canonical A1 targets and exact shell transforms

A1's canonical cell remains the location authority. With 16 px cells and the authored shell action socket at local `[64, 64]`:

| Site / A1 POI identity | Canonical cell | Global canonical anchor px `cell*16+[8,8]` | 128×128 shell root px `anchor-[64,64]` | A8 interior scene |
|---|---:|---:|---:|---|
| Quarry / `poi_crown_south_quarry` | `[30, 280]` | `[488, 4488]` | `[424, 4424]` | `res://game/survival/world_content/scenes/south_quarry.tscn` |
| Orchard / `poi_crown_south_orchard` | `[140, 360]` | `[2248, 5768]` | `[2184, 5704]` | `res://game/survival/world_content/scenes/south_orchard_ruin.tscn` |
| Mill / `poi_crown_south_mill` | `[120, 300]` | `[1928, 4808]` | `[1864, 4744]` | `res://game/survival/world_content/scenes/south_crown_mill.tscn` |

The corresponding compact shells are `south_quarry_overworld.tscn`, `south_orchard_ruin_overworld.tscn`, and `south_crown_mill_overworld.tscn`. Keep their authored 128×128 bounds, 64×64 action sockets, clear bottom doorway, original blockers, and canonical identities. The shell transform is integer, unrotated, one-to-one; do not scale A8 source art.

The three canonical cells are all outside A0 PR #21's current candidate world/annex bounds: the opt-in host is 448×256 cells; the candidate annex begins at `[384,192]` and is 64×64. Quarry y=280, Mill y=300, and Orchard y=360 exceed its 256-cell height. The current annex build policy is disabled pending a composite validator. **Do not claim the annex mounts these POIs.** A0 must use the full A1 world geography/approved world extent and make any required host/world-size change in A0's owner scope; A8 does not change A1 topology or invent a new POI marker.

A1's current transform review still contains a 960×600 local-worksite note. The actual A8 source definitions and scenes are **960×608**. Preserve 960×608 as the local interior instance. The interior is not a direct 1:1 overworld placement and must not be inferred from a shell transform.

## Transition adapter seam

A8 emits `soh.native_poi.transition.v1` requests from the compact shell and interior exit. These are event requests, **not** durable receipts and not permission to change the world. A0 should:

1. Validate `world_id`, canonical `poi_id`, canonical cell, direction, and current player's proximity against A1/A0-owned data. Resolve approved scene paths from A0's allowlist; do not trust a request-supplied `to_scene` as an authority.
2. On shell entry, capture the player's exact global SaveService/world coordinate before replacing the world scene. Enter the local A8 interior at its authored interior spawn; do not persist that local spawn as an overworld position.
3. On return, restore the owner-recorded global threshold position/transform and canonical shell. Validate an A8-return request against the current transition session; stale, replayed, or cross-site requests must fail closed.
4. Keep transition receipts, identity, idempotency, and atomic durable state in A0/SaveService. Do not persist A8's monotonic-tick `transition_id` as an owner receipt.
5. Feed the current A0/A3-authenticated site projection to `NativePoiSite.set_projection`. A8 environmental `site_id`/site identity never grants A3 permission. Quarry remains fail-closed until A3 publishes the exact binding, item-vector costs/sinks, source allocation, active-time cadence, capability effects, and evidence-bound route valuation.
6. Keep Orchard/Mill state changes owner-projected too. Neutral intent v2 carries only source/object/action/claim identity and observed revision; A8 fixture data must never reach live authority.

A0 PR #21's current `Chapter1Overworld._on_gate_interacted` captures `state.last_position`, calls `state.record_level_entry`, stages an AppFlow return payload, and routes a campaign level. That is a useful ownership analogue, **not** an existing A8 site mount. Do not disguise a POI as a campaign/dungeon level; add the explicit A0 site-transition adapter and SaveService receipt seam.

## Surface/environment consumer contract

A8's local contract is `data/survival/world_content/surface_affordances.v1.json`. It records the Orchard boardwalk/mud overlays, fixed local water collision, Mill race crossing, material classes, and authored local retreat routes. A8 creates no global footprints, trace persistence/discovery, pursuit, home targeting, raids, or second clock. Mud/snow classes do not create traces or movement modifiers. `shallow_water`/`deep_water` are unsupported for these sites; water depth stays null/`UNKNOWN`, and generic water art does not prove depth. Weather/time/tide inputs are appearance-only and may never close an authored retreat route.

A0 PR #21 current head `32bced6d` has an A0-owned `active_seconds` field in a legacy world binding, but no approved per-site presentation projection is enabled for these A8 sites. A8 therefore keeps world time, weather, and tide `UNKNOWN` until A0 explicitly supplies scoped values; no weather, tide, hunger, shelter, or elapsed-time consequences are asserted. If A0 later publishes an owner projection, A8 may only apply an explicit site-scoped visual mapping. Collision/access remains fixed except the existing A0-projected Orchard sluice and Mill power conditions.

## Acceptance boundary

This package is handoff material, not A0 acceptance. A0 must separately prove:

- the actual full-world mount/route from an A1-authored safe exterior spawn;
- physically reachable enter, retreat, and revisit for the three same canonical sites;
- global position preservation across interior transitions;
- owner-projected state and receipts with the existing A3 fail-closed Quarry gate;
- SaveService write in one process and durable reload/idempotency in a second process;
- D056 new-run reset of run-local gameplay only, retaining general achievements and historic run records.

A single Godot SceneTree `JSON.stringify` fixture snapshot is only in-process A8 test evidence. It is not A0's two-process SaveService acceptance. No A0 production mount, A3 authorization, two-process persistence proof, or human play pass is claimed by this package.
