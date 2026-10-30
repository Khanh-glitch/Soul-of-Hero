# A0 insertion specification: reachable South Quarry shell

**Owner:** A0 owns production world mounting, Hero/scene transitions, persistent world position, and SaveService. **Disposition:** actionable insertion contract for review; not an authorization to mount. A8 has not edited A0 production paths.

## Canonical identity and exact transform

Current source comparison was performed against A1 PR #20 head `ad39bde6780c92169032246898c145c568f36e6e`; A8's geometry remains an A1 read-only consumer. Canonical site:

- `world_id`: `world:soh_continent_v1`
- `poi_id`: `poi_crown_south_quarry`
- A1 region/cell: `r_ashen_crown` / `[30, 280]`
- A1 footprint radius: 4 tiles; route `sp_poi_crown_south_quarry` from `node_refuge`, foot, `early`, no capability requirement
- canonical 16 px cell center: `[488, 4488]`

Mount **only** `res://game/survival/world_content/scenes/south_quarry_overworld.tscn` into the reachable world as the compact 128×128, 1:1 shell. Its authored local action socket is `[64,64]`; exact root is `[424,4424]` using `root = cell * 16 + (8,8) - action_socket`. Its bounds are `[424,4424]`–`[552,4552]`. Rotation is 0°, scale `[1,1]`. This is an A8 transform calculation, not a new A1 anchor or a grant of production-mount authority.

**Never mount the 960×608 `south_quarry.tscn` over the overworld.** That is a separately entered local worksite with interior spawn `[480,548]`, action stand `[506,378]`, action socket `[506,302]`, and exit portal `[480,560]`. Do not scale/crop it into the 128 px shell, use its local spawn as world coordinates, or place both scenes at the same transform.

## Reachability is a required A0 integration result

The current A0 Waystation host/geometry was bounded to 448×256 px (28×16 tiles); cell `[30,280]` lies outside that host. A8's isolated shell and native harness do not make it reachable in the production game. A0 must connect the shell to the actual navigable world/streaming graph; an off-screen instance or hand-authored screenshot is not reachability evidence.

A1's route graph supplies the intended foot spur from `node_refuge` cell `[56,218]` to Quarry cell `[30,280]`, with no capability requirement and `early` risk. At 16 px/cell its authored straight segment is about 67.23 cells / 1,075.7 px; this is A1 graph geometry, **not** measured player travel time. Before enabling entry, A0 must demonstrate a continuous reachable route (including streamed chunk membership), valid walk/collision, camera/world limits following the player to the site, and a return path to the existing reachable region. If the current host cannot provide that route, leave the site unmounted/inaccessible rather than teleporting into the world.

## Entry, exit, and neutral action request

1. Place the player in the A1 world at the shell exterior. Physical portal center is local `[64,108]`; approach from the south and face north to enter.
2. At the existing A0 transition owner, validate the live actor, `world_id`, `poi_id`, canonical cell, shell scene, destination, and transition identity. Load the 960×608 worksite and set the local actor to `[480,548]`. Keep owner-saved global world position/scene identity separate from local spawn.
3. Before enabling state-dependent UI/collision, load the A0 owner projection. A8 proposes projection identity/revision, site state, claim generation, capability/readiness fields, and owner clock. `PoiAuthorityFixture` is test-only and not A0's adapter or SaveService.
4. A8's current scene request is `soh.native_poi.intent.v2`: `contract_id`, `contract_version`, `intent_id`, `source_id`, `object_id`, `action_id`, `claim_id`, and `observed_projection_revision` only. It carries **no** amount, reward, cooldown, claim policy, state delta, unlock, catalog source, client approval/provisional flag, or receipt. The neutral identity does not authorize an action. A0 must independently resolve canonical A1 identity/state and the exact A3-approved binding; reject unknown/extra fields and all actions with no current binding.
5. To exit, require physical arrival at `[480,560]`, facing south. Return to the same shell at `[64,108]`, retaining world/POI/cell. A0 restores the actual world actor/global position and persists through existing SaveService; do not create a second Quarry instance.
6. On revisit/reload, A0 projects the same canonical instance. For an accepted east brace, remove only the east collision blocker and keep the west blocker; for an accepted west chock, do the reverse. A stale/foreign projection must not reopen a prior branch.

## Acceptance evidence A0 must add

- A0-owned scene mount at the exact shell transform and route graph inclusion, without changes to A1 geometry or this A8 PR.
- Native walk to exterior cell `[30,280]`, shell doorway entry, worksite stand, both route alternatives, retreat, transition return and revisit. Include collision/camera/chunk-streaming evidence; test no-route/missing-world fail-closed behavior.
- SaveService-backed separate-process restart of the same world/POI/cell instance, monotonic owner projection revision and no duplicate claim/reward. A8's serialized fixture test is only adapter-contract evidence.
- Exact A3-approved source/action binding before any cost, yield, cooldown, capability grant or reward is enabled. Current A3 Quarry decision remains `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`; no production Quarry grant is authorized.

## Ownership boundary

A0 alone changes production mount, world transition, world identity, Hero relocation, and SaveService. A1 alone changes canonical world geometry/routes. A3 alone approves economics and source bindings. A8 supplies the isolated native site/shell, source-backed local art, neutral intent/projection proposal, test fixtures, and insertion evidence. This document requests review; it is not production authorization.
