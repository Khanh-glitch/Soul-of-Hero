class_name GoldRuptureSchedule
extends RefCounted
## Literal loop translation of Hairline Rupture S01 delayed explosion.
## Moving world_offset transforms all source coordinates without altering geometry.
const BASE_X := 300.0
const BASE_Y := 141.0
const MIN_X := 100.0
const MAX_X := 376.0
const SPACING := 22.0
const DELAY := 0.035
static func waves(offset: Vector2 = Vector2.ZERO) -> Array[Dictionary]:
    var results: Array[Dictionary] = []
    for k in range(11):
        for side in [-1,1]:
            var x: float = BASE_X + side*k*SPACING
            if x < MIN_X or x > MAX_X or (k == 0 and side == 1):
                continue
            results.append({"source_x":x,"position":Vector2(x,BASE_Y)+offset,
                "delay":float(k)*DELAY,"step":k,"side":side,
                "shards":9,"smoke":5,"sparks":5,"crack":1,"rubble":1})
    return results
static func between(a: float, b: float, offset: Vector2 = Vector2.ZERO) -> Array[Dictionary]:
    var emitted: Array[Dictionary] = []
    for wave: Dictionary in waves(offset):
        if float(wave["delay"]) > a and float(wave["delay"]) <= b:
            emitted.append(wave)
    return emitted
