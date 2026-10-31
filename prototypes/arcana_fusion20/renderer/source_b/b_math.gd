## Faithful GDScript port of original B src/engine/math.ts.
## Deterministic: mulberry32 RNG is integer-exact (int64 masked);
## hash/noise use sin() like the source (JS Math.sin vs Godot sin may
## differ in the last ulp on some platforms — noted, not hidden).
extends RefCounted
class_name BMath

const TAU := PI * 2.0

static func clampf2(x: float, a: float = 0.0, b: float = 1.0) -> float:
    return a if x < a else (b if x > b else x)

static func lerpf2(a: float, b: float, t: float) -> float:
    return a + (b - a) * t

static func inv(a: float, b: float, x: float) -> float:
    return clampf2((x - a) / (b - a))

static func smooth(a: float, b: float, x: float) -> float:
    var t := inv(a, b, x)
    return t * t * (3.0 - 2.0 * t)

static func ease_out(t: float) -> float:
    return 1.0 - pow(1.0 - clampf2(t), 3.0)

static func ease_in(t: float) -> float:
    return pow(clampf2(t), 3.0)

static func ease_in_out(t: float) -> float:
    t = clampf2(t)
    return 4.0 * t * t * t if t < 0.5 else 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0

static func pulse(a: float, b: float, x: float) -> float:
    if x <= a or x >= b:
        return 0.0
    return sin(((x - a) / (b - a)) * PI)

static func hash1(n: float) -> float:
    var x := sin(n * 127.1 + 311.7) * 43758.5453123
    return x - floor(x)

static func hash2(a: float, b: float) -> float:
    return hash1(a * 12.9898 + b * 78.233)

static func noise2(x: float, y: float) -> float:
    var xi: float = floor(x)
    var yi: float = floor(y)
    var xf: float = x - xi
    var yf: float = y - yi
    var u := xf * xf * (3.0 - 2.0 * xf)
    var v := yf * yf * (3.0 - 2.0 * yf)
    var a := hash2(xi, yi)
    var b := hash2(xi + 1.0, yi)
    var c := hash2(xi, yi + 1.0)
    var d := hash2(xi + 1.0, yi + 1.0)
    return lerpf2(lerpf2(a, b, u), lerpf2(c, d, u), v)

static func fbm(x: float, y: float, oct: int = 3) -> float:
    var s := 0.0
    var a := 0.5
    var f := 1.0
    var n := 0.0
    for i in range(oct):
        s += noise2(x * f, y * f) * a
        n += a
        a *= 0.5
        f *= 2.03
    return s / n

static func noise1(x: float) -> float:
    var i: float = floor(x)
    var f: float = x - i
    var u := f * f * (3.0 - 2.0 * f)
    return lerpf2(hash1(i), hash1(i + 1.0), u)

static func catmull(pts: Array, u: float) -> Vector2:
    var n := pts.size() - 1
    var f := clampf2(u) * float(n)
    var i := mini(floori(f), n - 1)
    var t := f - float(i)
    var p0: Vector2 = pts[maxi(0, i - 1)]
    var p1: Vector2 = pts[i]
    var p2: Vector2 = pts[i + 1]
    var p3: Vector2 = pts[mini(n, i + 2)]
    var t2 := t * t
    var t3 := t2 * t
    var kx := 0.5 * (2.0 * p1.x + (-p0.x + p2.x) * t + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2 + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3)
    var ky := 0.5 * (2.0 * p1.y + (-p0.y + p2.y) * t + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2 + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3)
    return Vector2(kx, ky)

static func fly(p0: float, v0: float, drag: float, acc: float, t: float) -> float:
    if drag <= 0.0001:
        return p0 + v0 * t + 0.5 * acc * t * t
    var e := exp(-drag * t)
    return p0 + (v0 - acc / drag) * (1.0 - e) / drag + (acc / drag) * t

static func ramp(stops: Array, t: float) -> Vector3:
    t = clampf2(t) * float(stops.size() - 1)
    var i := mini(floori(t), stops.size() - 2)
    var f := t - float(i)
    var a: Vector3 = stops[i]
    var b: Vector3 = stops[i + 1]
    return a.lerp(b, f)

static func scale_c(c: Vector3, k: float) -> Vector3:
    return c * k

class BRng:
    var s: int
    func _init(seed: int = 1) -> void:
        s = int((seed * 2654435761) & 0xFFFFFFFF)
        if s == 0:
            s = 1
    func next() -> float:
        s = int((s + 0x6D2B79F5) & 0xFFFFFFFF)
        var t := s
        t = int(((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF)
        t = int((t ^ ((t + int(((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF)) & 0xFFFFFFFF)
        return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    func r(a: float = 0.0, b: float = 1.0) -> float:
        return a + (b - a) * next()
    func i(a: int, b: int) -> int:
        return floori(r(float(a), float(b + 1)))
    func sign() -> float:
        return -1.0 if next() < 0.5 else 1.0
    func gauss() -> float:
        return (next() + next() + next() - 1.5) / 1.5
