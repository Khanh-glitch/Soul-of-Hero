## Shared source-native drawing primitives for ARCANA Fusion20.
## Pixel-snapped stamps (no antialiased vector art), deterministic per-cast
## RNG, element ramps. Used by every skill driver; B02 keeps its own
## source-ported geometry class and is hosted unchanged.
extends Node2D
class_name Arcana20Primitives

const RAMPS := {
    "fire": [Vector3(0.0,0.0,0.0), Vector3(0.3,0.02,0.03), Vector3(0.85,0.07,0.04), Vector3(1.6,0.48,0.06), Vector3(2.2,1.35,0.3), Vector3(3.0,2.7,2.0)],
    "water": [Vector3(0.0,0.02,0.08), Vector3(0.02,0.15,0.35), Vector3(0.05,0.4,0.8), Vector3(0.2,0.75,1.4), Vector3(0.6,1.2,1.9), Vector3(1.4,2.0,2.4)],
    "ice": [Vector3(0.02,0.05,0.1), Vector3(0.1,0.3,0.5), Vector3(0.3,0.65,1.0), Vector3(0.6,1.1,1.6), Vector3(1.1,1.7,2.2), Vector3(1.9,2.4,2.8)],
    "volt": [Vector3(0.05,0.0,0.15), Vector3(0.35,0.1,0.8), Vector3(0.6,0.35,1.6), Vector3(0.5,0.8,2.2), Vector3(1.2,1.8,2.6), Vector3(2.4,2.6,3.0)],
    "verdant": [Vector3(0.0,0.05,0.0), Vector3(0.05,0.3,0.05), Vector3(0.15,0.7,0.15), Vector3(0.5,1.3,0.4), Vector3(1.2,1.9,0.8), Vector3(2.0,2.6,1.6)],
    "astral": [Vector3(0.03,0.0,0.08), Vector3(0.2,0.05,0.45), Vector3(0.5,0.2,1.1), Vector3(0.9,0.5,1.7), Vector3(1.5,1.1,2.2), Vector3(2.4,2.2,2.9)],
}

static func ramp_color(element: String, h: float, alpha: float = 1.0) -> Color:
    var ramp: Array = RAMPS.get(element, RAMPS["astral"])
    var q := clampf(h, 0.0, 1.0) * float(ramp.size() - 1)
    var i := mini(floori(q), ramp.size() - 2)
    var c: Vector3 = ramp[i].lerp(ramp[i + 1], q - float(i))
    return Color(clampf(c.x, 0.0, 1.0), clampf(c.y, 0.0, 1.0), clampf(c.z, 0.0, 1.0), clampf(alpha, 0.0, 1.0))

static func smooth(a: float, b: float, t: float) -> float:
    var u := clampf((t - a) / maxf(0.000001, b - a), 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)

static func ease_out(u: float) -> float:
    var x := clampf(u, 0.0, 1.0)
    return 1.0 - pow(1.0 - x, 3.0)

static func ease_in(u: float) -> float:
    var x := clampf(u, 0.0, 1.0)
    return x * x * x

# --- pixel-snapped painters (canvas-local coordinates) ---
func px(p: Vector2, col: Color, size: float = 1.0) -> void:
    var s := maxf(1.0, roundf(size))
    draw_rect(Rect2(Vector2(roundf(p.x - s * 0.5), roundf(p.y - s * 0.5)), Vector2(s, s)), col, true)

func stroke(a: Vector2, b: Vector2, width: float, col: Color) -> void:
    var d := a.distance_to(b)
    var count := maxi(1, ceili(d))
    for j in range(count + 1):
        px(a.lerp(b, float(j) / float(count)), col, width)

func disc(p: Vector2, r: float, col: Color) -> void:
    var radius := maxi(1, roundi(r))
    for y in range(-radius, radius + 1):
        var dx := floori(sqrt(maxf(0.0, float(radius * radius - y * y))))
        for x in range(-dx, dx + 1):
            px(p + Vector2(x, y), col)

func ring(p: Vector2, r: float, col: Color, squash: float = 0.62) -> void:
    var steps := maxi(16, ceili(TAU * r * 1.5))
    for i in range(steps):
        var a := TAU * float(i) / float(steps)
        px(p + Vector2(cos(a) * r, sin(a) * r * squash), col, 1.0)

func bolt(a: Vector2, b: Vector2, col: Color, jitter: float, rng: RandomNumberGenerator, width: float = 1.0) -> void:
    var segs := maxi(2, int(a.distance_to(b) / 9.0))
    var prev := a
    for i in range(1, segs):
        var u := float(i) / float(segs)
        var p := a.lerp(b, u) + Vector2(rng.randf_range(-jitter, jitter), rng.randf_range(-jitter, jitter)) * (1.0 - absf(u - 0.5) * 1.2)
        stroke(prev, p, width, col)
        prev = p
    stroke(prev, b, width, col)
