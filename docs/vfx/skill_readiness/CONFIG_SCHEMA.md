# Gold 93 — external configuration schema (G7 handoff)

**Status:** schema complete, **every gameplay field unconfigured**. No damage,
cooldown, mana cost, range, input binding, stagger, status rule or unlock
condition has been invented for any of the 93 skills.

The native library is complete enough that the project owner decides **how a
skill behaves** by filling in a rule packet. The VFX, animation, lifecycle,
ground/environment operations, camera, post and cleanup are already native and
are **not** re-ported when a rule packet changes.

## The three states, kept strictly separate

| Axis | Meaning | Current |
|---|---|---|
| `native_port_ready` | EPIC acceptance gate; needs every evidence key (source numeric oracle, native full-cast video, original-vs-native comparison, real-map overlay, native test run, WebGL test run, 2K/4K performance) | `0 / 93` |
| `native_executable` | **Not** an EPIC axis. A real Godot module with a source-locked authored generator exists and a full cast runs through the native runtime | `1 / 93` (`venomwright:001`) |
| `gold_visual_approved` | Independent Gold-vs-native visual sign-off | `0 / 93` |
| `gameplay_configured` | Owner-approved combat/input numbers | `0 / 93` |
| `production_integrated` | Approved overworld / Hero / UI / save binding | `0 / 93` |

Reporting rule: **never** say “93 usable” because 93 rows are registered. The
current honest roll-up is `0/93 NATIVE_PORT_READY`, `0/93 SOURCE_VISUAL_APPROVED`,
`0/93 PRODUCTION_INTEGRATED`, `1/93 native-executable`, `92/93 source-material
blocked`.

## Rule packet schema

Every field below is `null` until the owner supplies a value. A packet is only
accepted when **all** slots are non-null — partial packets are refused, never
partially applied (`Gold93SkillParameters.set_gameplay`).

| Field | Type | Meaning | Invented default |
|---|---|---|---|
| `input_binding` | `StringName` | Action / hotkey / gesture the host maps | **none** |
| `input_mode` | `String` (`tap`, `hold`, `drag_release`, `target_pick`, `multi_stage`) | Which control envelope is enabled | **none** |
| `aim_policy` | `String` (`caster_facing`, `free_360`, `free_360_preview`, `drag_path`, `target_pick`) | How the cast direction is chosen | **none** |
| `target_policy` | `String` (`nearest`, `picked`, `auto_retarget`, `all_in_area`) | Target selection | **none** |
| `mana_cost` | `float` | Resource cost | **none** |
| `cooldown_seconds` | `float` | Recharge | **none** |
| `range` | `float` | Cast range in world units | **none** |
| `damage` | `float` | Damage multiplier / value applied through `CombatPort` | **none** |
| `stagger` | `float` | Stagger duration | **none** |
| `status_rules` | `Dictionary` | Status id → duration / magnitude | **none** |
| `unlock_rules` | `Dictionary` | Progression / unlock gating | **none** |

Presentation/technical slots (`source_seed`, `source_hz`,
`native_raster_density`, `presentation.backdrop_readability_aid`,
`presentation.capture_frames`) are engine concerns, not balance, and carry
neutral defaults. Any value produced by the lab is stamped `lab_only = true`
and must never be shipped as gameplay configuration.

## Capability envelope (per skill, no gameplay decisions)

`Gold93SkillCatalog.supported_controls(id)` returns the capability flags the
future configuration may bind to: `tap`, `hold`, `drag_release`, `target_pick`,
`free_360_aim`, `trajectory_path`, `multi_stage`, `gamepad`. These describe what
the **native runtime can already accept**; they do not choose anything.

The original unidirectional demo geometry is **not** forced: any direction, any
drag path, any target pick and any multi-stage sequence is representable through
`CastContext.set_world_aim` / `set_aim_direction` / `set_drag_path`.

## Integration touch points

The host opts in by injecting ports into `CastContext`. With no ports the VFX
still runs to completion in the lab and records everything without touching the
game.

| Port | Contract |
|---|---|
| `CombatPort` | Single authority for health mutation. Rejects everything while rules are unconfigured. Once-only hit admission prevents double application. |
| `TerrainPort` | Read-only occupancy sampling plus **cosmetic** ground marks. `can_mutate_collision()` is `false`; no TileMap collision is ever rewritten. |
| `SoundPort` | Plays Gold-authored cues only. Silent when the original source has no audio. |
| `CameraPort` | Shake / shock / framing cues. Zero when the original authored none. |
| `TargetResolver` | Maps live host actors into the original source actor shape (`{id, x, y, r, exists, dying}`). |

## Minimal host usage

```gdscript
var adapter := Gold93ExternalAdapter.new()

# VFX-only preview (no gameplay numbers, nothing is applied):
var handle = adapter.cast("venomwright:001", knight, aim_world_position)

# Later, once the owner approves numbers:
adapter.configure("venomwright:001", {
    "input_binding": &"skill_1",
    "input_mode": "tap",
    "aim_policy": "free_360",
    "target_policy": "nearest",
    "mana_cost": 0.0,
    "cooldown_seconds": 0.0,
    "range": 0.0,
    "damage": 0.0,
    "stagger": 0.0,
    "status_rules": {},
    "unlock_rules": {},
})
```

`Gold93ExternalAdapter.handoff_all()` emits one descriptor per canonical id with
its module path, blocker, capability envelope, dependency graph and the exact
slots waiting for owner input.
