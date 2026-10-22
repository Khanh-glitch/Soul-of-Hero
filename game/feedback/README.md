# Combat feedback

Gameplay remains authoritative. This folder only presents confirmed events from
`GameEvents`, so camera, audio, UI, and VFX can be tuned without changing combat
rules or hitboxes.

## Hit contract

Existing four-argument calls remain valid:

```gdscript
CombatDamage.apply_confirmed(target, damage, global_position, &"sword")
```

New attacks may pass a presentation context as the optional fifth argument:

```gdscript
CombatDamage.apply_confirmed(target, echo_damage, global_position, &"sword", {
    "cue_id": &"soul_echo_hit",
    "is_echo": true,
    "combo_step": combo_step,
    "combo_count": combo_step,
    "impact_strength": 1.25,
})
```

The emitted `combat_hit_confirmed` amount is the actual health delta, including
overkill clamping. Useful optional keys include `hit_position`, `cue_id`,
`impact_strength`, `hit_stop_seconds`, `shake_seconds`, `combo_count`,
`combo_window_seconds`, `is_critical`, `show_damage_number`, `show_impact`,
`show_overlay`, and per-effect color/duration overrides.

`soul_echo_hit` has a distinct white/ivory spectral treatment and a quieter
asset-backed cue. Built-in IDs cover Sword, Soul Echo/Relay, Axe, Reaper,
Vampire, dash, checkpoint, sigil, objective, unlock, death, and UI combo
feedback. `CombatAudioRouter` maps those IDs to a reviewed mix of legacy WAV
cues and Kenney OGG pools; it never synthesizes a fallback waveform. Pools use
random selection with a strict no-immediate-repeat rule. `GameplayAudioHooks`
converts shared game events into cue requests without coupling weapons or
enemies to an audio player implementation. Audio provenance is recorded in
`res://assets/audio/SOURCES.md`.

Material-aware hits may keep `cue_id = &"hit_confirmed"` and add `material` as
`bone`, `flesh`, `metal`, `wood`, or `stone`; `impact_strength >= 1.25` selects
the heavy family where one exists. Explicit IDs are also available for
`impact_bone`, `impact_flesh`, `impact_metal_*`, `impact_wood_*`, and
`impact_stone`. World presentation can request `chest_open/close`,
`door_open/close`, `coin_pickup`, `torch_pickup/place/toggle`, and
`book_open/close/page`. Stone and wood footsteps use complete five-sample
cycles, while the existing Sword/Soul WAV helper behavior remains compatible.

## Combo contract

The Sword controller should emit:

```gdscript
GameEvents.hero_combo_state_changed.emit(
    &"sword", combo_step, hit_count, reset_seconds, active
)
```

When that signal is unavailable, the feedback scene maintains a two-second
confirmed-hit counter as a safe presentation fallback.

The system reads `damage_numbers`, `screen_shake`, `reduced_flashes`, and
`reduced_motion` from `SaveService`. Spatial combat uses the `SFX` bus; routed
menu controls use the `UI` bus, and both follow the persisted SFX volume.
