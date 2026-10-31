## Faithful port of original A engine/math.ts: xorshift RNG, sin-free
## integer hash noise, ramps. JS float hash (x*374761393...) is NOT
## integer-exact (products exceed 2^53 for large coords in the original
## too); reproduced with float math in the same order.
extends RefCounted
class_name AMath

const TAU := PI * 2.0

static func cl01(v: float, a: float = 0.0, b: float = 1.0) -> float:
    return a if v < a else (b if v > b else v)

static func lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t

static func smoothstep(e0: float, e1: float, x: float) -> float:
    var d := e1 - e0
    var t := cl01((x - e0) / (d if d != 0.0 else 1e-6))
    return t * t * (3.0 - 2.0 * t)

static func smootherstep(e0: float, e1: float, x: float) -> float:
    var d := e1 - e0
    var t := cl01((x - e0) / (d if d != 0.0 else 1e-6))
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

static func seg(t: float, a: float, b: float) -> float:
    var d := b - a
    return cl01((t - a) / (d if d != 0.0 else 1e-6))

static func segu(t: float, a: float, b: float) -> float:
    var d := b - a
    return (t - a) / (d if d != 0.0 else 1e-6)

static func bump(t: float) -> float:
    return sin(cl01(t) * PI)

static func ease_out(t: float, p: float = 3.0) -> float:
    return 1.0 - pow(1.0 - cl01(t), p)

static func ease_in(t: float, p: float = 3.0) -> float:
    return pow(cl01(t), p)

static func ease_in_out(t: float) -> float:
    var x := cl01(t)
    return 4.0 * x * x * x if x < 0.5 else 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0

static func elastic_out(t: float) -> float:
    var x := cl01(t)
    if x == 0.0 or x == 1.0:
        return x
    return pow(2.0, -10.0 * x) * sin((x * 10.0 - 0.75) * (TAU / 3.0)) + 1.0

static func back_out(t: float, s: float = 1.7) -> float:
    var x := cl01(t) - 1.0
    return x * x * ((s + 1.0) * x + s) + 1.0

static func _signed32(value: int) -> int:
    var v := value & 0xFFFFFFFF
    return v - 0x100000000 if v >= 0x80000000 else v

static func hash2(x: float, y: float) -> float:
    # JS bitwise operations first coerce Number to signed int32; >> is an
    # arithmetic shift. The following multiplication is JS float64, *not*
    # exact integer multiplication. Coerce its rounded result back to int32.
    var h := _signed32(int(x * 374761393.0 + y * 668265263.0))
    var mixed := h ^ (h >> 13)
    var product := _signed32(int(float(mixed) * 1274126177.0))
    return float((product ^ (product >> 16)) & 0xFFFFFFFF) / 4294967296.0

static func hash3(x: float, y: float, z: float) -> float:
    var h := _signed32(int(x * 374761393.0 + y * 668265263.0 + z * 2147483647.0))
    var mixed := h ^ (h >> 13)
    var product := _signed32(int(float(mixed) * 1274126177.0))
    return float((product ^ (product >> 16)) & 0xFFFFFFFF) / 4294967296.0

static func vnoise(x: float, y: float) -> float:
    var xi: int = floori(x)
    var yi: int = floori(y)
    var xf := x - float(xi)
    var yf := y - float(yi)
    var u := xf * xf * (3.0 - 2.0 * xf)
    var v := yf * yf * (3.0 - 2.0 * yf)
    var a := hash2(float(xi), float(yi))
    var b := hash2(float(xi + 1), float(yi))
    var c := hash2(float(xi), float(yi + 1))
    var d := hash2(float(xi + 1), float(yi + 1))
    return lerpf(lerpf(a, b, u), lerpf(c, d, u), v)

static func vnoise3(x: float, y: float, z: float) -> float:
    var xi: int = floori(x)
    var yi: int = floori(y)
    var zi: int = floori(z)
    var xf := x - float(xi)
    var yf := y - float(yi)
    var zf := z - float(zi)
    var u := xf * xf * (3.0 - 2.0 * xf)
    var v := yf * yf * (3.0 - 2.0 * yf)
    var w := zf * zf * (3.0 - 2.0 * zf)
    var x00 := lerpf(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u)
    var x10 := lerpf(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u)
    var x01 := lerpf(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u)
    var x11 := lerpf(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u)
    return lerpf(lerpf(x00, x10, v), lerpf(x01, x11, v), w)

static func fbm(x: float, y: float, oct: int = 4, lac: float = 2.0, gain: float = 0.5) -> float:
    var a := 0.5
    var s := 0.0
    var n := 0.0
    var xx := x
    var yy := y
    for i in range(oct):
        s += a * vnoise(xx, yy)
        n += a
        xx *= lac
        yy *= lac
        a *= gain
    return s / n

static func fbm3(x: float, y: float, z: float, oct: int = 3) -> float:
    var a := 0.5
    var s := 0.0
    var n := 0.0
    var xx := x
    var yy := y
    var zz := z
    for i in range(oct):
        s += a * vnoise3(xx, yy, zz)
        n += a
        xx *= 2.0
        yy *= 2.0
        zz *= 2.0
        a *= 0.5
    return s / n

static func curl(x: float, y: float, t: float, e: float = 0.6) -> Vector2:
    var n1 := vnoise3(x + e, y, t) - vnoise3(x - e, y, t)
    var n2 := vnoise3(x, y + e, t) - vnoise3(x, y - e, t)
    return Vector2(n2 / (2.0 * e), -n1 / (2.0 * e))

static func hsv(h: float, s: float, v: float) -> Vector3:
    h = fmod(fmod(h, 1.0) + 1.0, 1.0)
    var i := floori(h * 6.0)
    var f := h * 6.0 - float(i)
    var p := v * (1.0 - s)
    var q := v * (1.0 - f * s)
    var u := v * (1.0 - (1.0 - f) * s)
    match i % 6:
        0: return Vector3(v, u, p)
        1: return Vector3(q, v, p)
        2: return Vector3(p, v, u)
        3: return Vector3(p, q, v)
        4: return Vector3(u, p, v)
    return Vector3(v, p, q)

static func ramp(stops: Array, t: float) -> Vector3:
    t = cl01(t)
    for i in range(stops.size() - 1):
        var a: Array = stops[i]
        var b: Array = stops[i + 1]
        if t >= float(a[0]) and t <= float(b[0]):
            var d := float(b[0]) - float(a[0])
            var k := (t - float(a[0])) / (d if d != 0.0 else 1e-6)
            return Vector3(lerpf(float(a[1]), float(b[1]), k), lerpf(float(a[2]), float(b[2]), k), lerpf(float(a[3]), float(b[3]), k))
    var l: Array = stops[stops.size() - 1]
    return Vector3(float(l[1]), float(l[2]), float(l[3]))

static var RAMPS: Dictionary = {}

static func _ensure_ramps() -> void:
    if not RAMPS.is_empty():
        return
    RAMPS = {
        "fire": [[0.0, 0.05, 0.01, 0.02], [0.18, 0.42, 0.04, 0.08], [0.38, 0.95, 0.17, 0.06], [0.6, 1.5, 0.6, 0.1], [0.82, 2.2, 1.5, 0.5], [1.0, 3.0, 2.8, 2.2]],
        "ash": [[0.0, 0.03, 0.02, 0.03], [0.5, 0.18, 0.12, 0.14], [1.0, 0.42, 0.3, 0.3]],
        "water": [[0.0, 0.01, 0.04, 0.1], [0.25, 0.03, 0.18, 0.42], [0.5, 0.08, 0.45, 0.8], [0.75, 0.4, 0.86, 1.1], [1.0, 1.6, 2.0, 2.2]],
        "frost": [[0.0, 0.03, 0.08, 0.16], [0.3, 0.12, 0.3, 0.55], [0.6, 0.45, 0.75, 1.0], [0.85, 0.9, 1.3, 1.6], [1.0, 2.2, 2.6, 3.0]],
        "volt": [[0.0, 0.03, 0.03, 0.12], [0.22, 0.18, 0.1, 0.55], [0.45, 0.35, 0.5, 1.4], [0.7, 0.8, 1.2, 2.2], [1.0, 2.6, 2.9, 3.2]],
        "verdant": [[0.0, 0.03, 0.06, 0.04], [0.22, 0.08, 0.22, 0.1], [0.45, 0.16, 0.5, 0.2], [0.68, 0.5, 1.0, 0.35], [0.86, 1.1, 1.7, 0.7], [1.0, 2.2, 2.6, 1.8]],
        "bio": [[0.0, 0.04, 0.08, 0.1], [0.3, 0.06, 0.4, 0.38], [0.55, 0.2, 0.9, 0.7], [0.8, 0.9, 1.6, 1.0], [1.0, 2.0, 2.4, 1.8]],
        "astral": [[0.0, 0.03, 0.02, 0.07], [0.25, 0.22, 0.08, 0.35], [0.5, 0.55, 0.25, 0.85], [0.72, 0.9, 0.7, 1.5], [0.9, 1.6, 1.5, 2.4], [1.0, 3.0, 2.9, 3.0]],
        "gold": [[0.0, 0.08, 0.04, 0.01], [0.4, 0.6, 0.28, 0.05], [0.7, 1.3, 0.9, 0.25], [1.0, 2.6, 2.3, 1.4]],
        "bloom": [[0.0, 0.1, 0.02, 0.08], [0.35, 0.5, 0.1, 0.3], [0.65, 1.1, 0.4, 0.6], [0.85, 1.8, 1.0, 1.1], [1.0, 2.6, 2.2, 2.2]],
    }

static func R(name: String, t: float) -> Vector3:
    _ensure_ramps()
    return ramp(RAMPS[name], t)

static func ang_lerp(a: float, b: float, t: float) -> float:
    var d := fmod(b - a + PI * 3.0, TAU) - PI
    return a + d * t

static func catmull_pt(pts: Array, u: float) -> Vector2:
    var n := pts.size()
    if n == 0:
        return Vector2.ZERO
    if n == 1:
        return pts[0]
    var f := cl01(u) * float(n - 1)
    var i := mini(floori(f), n - 2)
    var t := f - float(i)
    var p0: Vector2 = pts[maxi(0, i - 1)]
    var p1: Vector2 = pts[i]
    var p2: Vector2 = pts[i + 1]
    var p3: Vector2 = pts[mini(n - 1, i + 2)]
    var t2 := t * t
    var t3 := t2 * t
    return Vector2(
        0.5 * (2.0 * p1.x + (-p0.x + p2.x) * t + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2 + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3),
        0.5 * (2.0 * p1.y + (-p0.y + p2.y) * t + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2 + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3))

class ARng:
    extends RefCounted
    var s: int
    func _init(seed: int = 1) -> void:
        s = seed & 0xFFFFFFFF
        if s == 0:
            s = 1
    func next() -> float:
        var x := s
        x = (x ^ ((x << 13) & 0xFFFFFFFF)) & 0xFFFFFFFF
        x = (x ^ (x >> 17)) & 0xFFFFFFFF
        x = (x ^ ((x << 5) & 0xFFFFFFFF)) & 0xFFFFFFFF
        s = x
        return float(s) / 4294967296.0
    func rangef(a: float, b: float) -> float:
        return a + (b - a) * next()
    func intf(a: int, b: int) -> int:
        return floori(rangef(float(a), float(b + 1)))
    func sign() -> float:
        return -1.0 if next() < 0.5 else 1.0
    func pick(arr: Array) -> Variant:
        return arr[floori(next() * float(arr.size())) % arr.size()]
    func angle() -> float:
        return next() * AMath.TAU
    func gauss(sd: float = 1.0) -> float:
        var u := 0.0
        var v := 0.0
        while u == 0.0:
            u = next()
        while v == 0.0:
            v = next()
        return sqrt(-2.0 * log(u)) * cos(AMath.TAU * v) * sd
