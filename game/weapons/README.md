# Living Arsenal weapon core

`WeaponDefinition` is the single data entry point for a weapon. It composes a
normal attack, Hand skill, Spirit trigger, Spirit action, targeting rules, and
future mastery/Monster Part/rarity hooks. Current authored definitions are:

- `res://game/weapons/data/sword.tres`
- `res://game/weapons/data/bow.tres`

## Runtime integration

Create a `WeaponManager`, then call:

```gdscript
weapon_manager.configure_loadout(sword, [bow], false)
weapon_manager.request_swap(0)
```

The third argument gates the second Spirit slot. Slot indices are direct: `0`
maps to Q/first icon and `1` maps to E/second icon. A successful swap emits
`weapon_swap_transition_started`; after the configured 0.25-second transition
it emits `weapon_swapped`. The shared cooldown is 1.5 seconds.

The player controller owns action safety and informs the manager with
`notify_action_uninterruptible()` and `notify_action_interruptible()`. A valid
request made during the unsafe window is retained and begins when the latter is
called. The `queued` argument of `weapon_swap_requested` tells presentation code
whether it should wait before entering its SWAP animation.

Forward confirmed combat events only after their gameplay object/state exists:

```gdscript
weapon_manager.notify_hand_attack_started()
weapon_manager.notify_hand_attack_instance_created({"attack": attack_node})
weapon_manager.request_hand_skill()
weapon_manager.notify_hand_skill_resolved({"impact_position": endpoint})
weapon_manager.notify_dash_started(dash_direction)
weapon_manager.notify_dash_completed(dash_direction)
```

Do not increment Sword Spirit on raw button input. Bow receives a normalized
`dash_vector`; its action context exposes the opposite vector as
`action_direction` even when there is no target.

Connect `spirit_action_started` to the effect factory. Call
`notify_spirit_effect_created(weapon_id)` once a projectile/hitbox has actually
spawned and `notify_spirit_action_completed(weapon_id)` after cleanup. A created
effect survives a role swap; only a cancellable pre-cast is cancelled.

Use `set_target_provider()` to inject the combat target service. The callback
receives `(WeaponTargetRules, context)` and returns an array of valid Nodes, so
the manager never performs a per-frame global enemy search.

HUD state is pullable through cooldown/progress getters and
`get_runtime_state()`, with `loadout_changed`, `cooldowns_changed`, and
`spirit_trigger_progressed` providing event-driven refresh points.

Equipped IDs serialize through `to_save_data()` and restore through
`restore_loadout_from_save(data, weapon_registry)`. Cooldowns and trigger
progress remain runtime state and are intentionally not permanent save data.

Run the isolated contract test with:

```powershell
.tools\godot\Godot_v4.7-stable_win64.exe --headless --path . --script res://tests/weapons/weapon_manager_test.gd
```
