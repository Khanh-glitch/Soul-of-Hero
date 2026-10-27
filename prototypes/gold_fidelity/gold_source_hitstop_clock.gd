class_name GoldSourceHitstopClock
extends RefCounted

## World.update(real) early-return policy in the original gold WebGL engine.
## freeze applies to world simulation and actor/ribbon life, NOT camera shake.
## Never changes combat resolver time or authoritative enemy HP.
var world_time := 0.0
var hitstop_remaining := 0.0
var skill_scale := 1.0
var skill_scale_remaining := 0.0
var last_game_dt := 0.0
var last_real_dt := 0.0
var frozen := false

func reset() -> void:
    world_time = 0.0
    hitstop_remaining = 0.0
    skill_scale = 1.0
    skill_scale_remaining = 0.0
    last_game_dt = 0.0
    last_real_dt = 0.0
    frozen = false

func request_hitstop(seconds: float) -> void:
    hitstop_remaining = maxf(hitstop_remaining,seconds)

func request_slow(scale: float, duration: float) -> void:
    skill_scale = scale
    skill_scale_remaining = duration

func advance(real_dt: float) -> float:
    last_real_dt = real_dt
    if hitstop_remaining > 0.0:
        hitstop_remaining -= real_dt
        frozen = true
        last_game_dt = 0.0
        return 0.0
    frozen = false
    if skill_scale_remaining > 0.0:
        skill_scale_remaining -= real_dt
        if skill_scale_remaining <= 0.0:
            skill_scale = 1.0
    last_game_dt = real_dt*skill_scale
    world_time += last_game_dt
    return last_game_dt
