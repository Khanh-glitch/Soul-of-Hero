class_name GoldSegmentMath
extends RefCounted

## Direct translation: src/engine/world.ts SegFx + World.draw, and shaders.ts POST_FRAG.
## One authentic renderer component; this is NOT a complete skill port.
const SOURCE_START := Vector2(104.0, 141.0)
const SOURCE_END := Vector2(356.0, 141.0)
const WIDTH := 14.0
const STRENGTH := 1.8
const DURATION := 2.0
const HOLD := 0.8

static func strength_at(age: float) -> float:
    if age < 0.0 or age >= DURATION:
        return 0.0
    var p := age / DURATION
    var k := minf(1.0, p / 0.15) if p < HOLD else 1.0 - (p - HOLD) / (1.0 - HOLD)
    return STRENGTH * k

static func displacement_at(point: Vector2, t: float, age: float, a: Vector2 = SOURCE_START, b: Vector2 = SOURCE_END) -> Vector2:
    var strength := strength_at(age)
    if strength <= 0.0:
        return Vector2.ZERO
    var ab := b - a
    var l2 := maxf(ab.dot(ab), 0.001)
    var tt := clampf((point - a).dot(ab) / l2, 0.0, 1.0)
    var closest := a + ab * tt
    var dv := point - closest
    var k := 1.0 - dv.length() / WIDTH
    if k <= 0.0:
        return Vector2.ZERO
    var normal := Vector2(-ab.y, ab.x).normalized()
    var signed_side := signf(dv.dot(normal) + 0.0001)
    var wobble := 0.6 + 0.4 * sin(tt * 30.0 + t * 40.0)
    return normal * signed_side * k * strength * wobble
