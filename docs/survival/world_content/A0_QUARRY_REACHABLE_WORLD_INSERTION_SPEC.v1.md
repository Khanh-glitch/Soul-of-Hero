# A0 insertion specification: reachable South Quarry shell

**Owner:** A0 owns production world mounting, Hero/scene transitions, persistent world position, and SaveService. **Disposition:** actionable insertion contract for review; not an authorization to mount. A8 has not edited A0 production paths.

## Canonical identity and exact transform

Use A1 PR #20 head `939720d50a0b822ff9042d4104dc69ba78ffe0f8` as the current read-only source pin. The canonical site is:

- `world_id`: `world:soh_continent_v1`
- `poi_id`: `poi_crown_south_quarry`
- A1 region/cell: `r_ashen_crown` / `[30, 280]`
- A1 footprint radius: 4 tiles; route `sp_poi_crown_south_quarry` from `node_refuge`, foot, `early`, no capability requirement
- canonical 16 px cell center: `[488, 4488]`

Mount **only** `res://game/survival/world_content/scenes/south_quarry_overworld.tscn` into the reachable world as the compact 128×128, 1:1 shell. Its authored local action socket is `[64,64]`; exact root is `[424,4424]` using `root = cell * 16 + (8,8) - action_socket`. Its bounds are `[424,4424]`–`[552,4552]`. Rotation is 0°, scale `[1,1]`. This is an A8 transform calculation, not a new A1 anchor or a grant of production-mount authority.

**Never mount the 960×608 `south_quarry.tscn` over the overworld.** That is a separately entered local worksite with interior spawn `[480,548]`, action stand `[506,378]`, action socket `[506,302]`, and exit portal `[480,560]`. Do not scale/crop it into the 128 px shell, use its local spawn as world coordinates, or place both scenes at the same transform.

## Reachability is a required A0 integration result

The current A0 Waystation host/geometry is explicitly bounded to 448×256 px (28×16 tiles). Cell `[30,280]` is outside that host. A8's isolated shell and native harness do not make it reachable in the production game. A0 must therefore connect the shell to the actual navigable world/streaming graph; do not treat an off-screen scene instance or a hand-authored screenshot as reachability evidence.

A1's route graph supplies the intended foot spur from `node_refuge` cell `[56,218]` to the Quarry cell `[30,280]`, with no capability requirement and `early` risk. At 16 px/cell its authored straight segment is about 67.23 cells / 1,075.7 px; this is the A1 graph polyline length, **not** measured player travel time. Before enabling entry, A0 must demonstrate a continuous reachable route (including streamed chunk membership), valid walk/collision along the route, camera/world limits that follow the player to the site, and a return path to the existing reachable region. If the current host cannot provide that route, the site remains unmounted/inaccessible rather than being teleported into the world.

## Entry, exit, and owner projection

1. Place the player in the A1 world at the shell exterior. Physical portal center is local `[64,108]`; the actor approaches from the south and faces north to enter. The shell has a real south doorway and collision walls on the other sides.
2. On the doorway request, validate the live actor, `world_id`, `poi_id`, canonical cell, shell scene, destination, and transition identity at A0's existing transition owner. Load the 960×608 worksite and set the local actor to `[480,548]`. Keep the owner-saved global world position/scene identity separate from the local spawn.
3. Load the owner projection before enabling state-dependent UI/collision. The A8 proposal requires canonical `source_id`, monotonic `projection_revision`, site state, claim generation, capability/readiness fields, and owner clock. A8's `PoiAuthorityFixture` is test-only and is not A0's adapter or SaveService.
4. To exit, require physical arrival at `[480,560]`, facing south. The return anchor is the same shell at `[64,108]`, retaining `world_id`, `poi_id`, and `[30,280]`. A0 restores the actual world actor/global position and persists it with the existing SaveService; it does not create a second Quarry instance.
5. On revisit/reload, A0 projects the same canonical instance. For a committed east brace, the east collision blocker is absent and the west blocker remains; for a west chock, the reverse is true. A stale or foreign projection must never reopen an old branch.

## Acceptance evidence A0 must add

- A0-owned scene mount at the exact shell transform and route graph inclusion, without changes to A1 geometry or this A8 PR.
- Native walk to the exterior at `[30,280]` from the current player route, shell doorway entry, worksite stand, both route choices, retreat, transition return, and revisit. Include collision/camera/chunk-streaming evidence; also test no-route/missing-world fail-closed behavior.
- SaveService-backed restart of the same world/POI/cell instance, with monotonic owner projection revision and no duplicate claim/reward. A8's serialized fixture test is only adapter-contract evidence.
- A3-approved source/action binding before any cost, yield, cooldown, capability grant, or reward is enabled. Current A3 decision is `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`; no production Quarry grant is authorized.

## Ownership boundary

A0 alone changes production mount, world transition, world identity, Hero relocation, and SaveService. A1 alone changes canonical world geometry/routes. A3 alone approves economics and source bindings. A8 supplies the isolated native site/shell, source-backed local art, fail-closed intent/projection proposal, test fixtures, and the insertion evidence above. This document requests review; it is not production authorization.
