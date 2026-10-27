class_name GoldS01SeamTimeline
extends RefCounted

## S01 source skill dash: World.move() with ease=1-(1-p)^2.2,
## World.trail() minD=2, and original Ribbon.update() profile.
## This computes live VECTOR PATHS, not baked animation frames.
## Values are for GOLD's 480x270 local coordinate space and setup actor.
const DT := 1.0/60.0
const BEGIN_TIME := 0.55
const MOVE_DURATION := 0.27
const HERO_START := 86.0
const HERO_END := 376.0
const BLADE_X_OFFSET := 8.0
const BLADE_Y := 141.0
const MIN_DISTANCE := 2.0
const SAMPLES := 16
const END_AGE := 0.2833333333333333
const SOURCE_SEED_AT_FIXTURE := 0.9286294893827289

static func hero_x_for_dash_step(i: int) -> float:
    var p := float(i)*DT/MOVE_DURATION
    return lerpf(HERO_START,HERO_END,1.0-pow(1.0-p,2.2))

static func path_at(world_time: float) -> PackedVector2Array:
    var result := PackedVector2Array()
    if world_time <= BEGIN_TIME:
        return result
    var eligible: int = clampi(int(floor((world_time-BEGIN_TIME+0.000001)/DT)),0,SAMPLES)
    for i in range(eligible):
        var point := Vector2(hero_x_for_dash_step(i)+BLADE_X_OFFSET,BLADE_Y)
        if result.is_empty() or result[-1].distance_to(point)>=MIN_DISTANCE:
            result.append(point)
    return result

static func state_at(world_time: float, random_sign: float = 1.0) -> Dictionary:
    var age: float = maxf(0.0,world_time-BEGIN_TIME)
    var a: float = clampf((age-1.0)*2.6,0.0,1.0)
    var widened := a*a*4.5+1.5
    var wobble := a*2.6*signf(random_sign)
    var terminated := world_time >= 2.5
    return {
        "source_points":path_at(world_time),
        "source_age":age,
        "world_time":world_time,
        "source_width":widened,
        "source_wobble":wobble,
        "source_live":age <= END_AGE + 0.000001,
        "source_end_age":END_AGE if not terminated else 1.9333333333333313,
        "source_life":0.3 if terminated else 3.6,
        "source_fade_mode":1 if terminated else 0
    }
