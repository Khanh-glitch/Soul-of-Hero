## Faithful port of original C engine/math.ts: deterministic Rng
## (mulberry-style imul mixer), integer hash, value noise, easing.
## JS Math.imul / >>> semantics reproduced with int64 masking.
extends RefCounted
class_name CMath

const TAU := PI * 2.0

static func imul(a: int, b: int) -> int:
    # 16-bit split keeps every partial product inside int64.
    var ua := a & 0xFFFFFFFF
    var ub := b & 0xFFFFFFFF
    var al := ua & 0xFFFF
    var ah := (ua >> 16) & 0xFFFF
    var bl := ub & 0xFFFF
    var bh := (ub >> 16) & 0xFFFF
    var r := (al * bl + (((ah * bl + al * bh) & 0xFFFF) << 16)) & 0xFFFFFFFF
    return r - 0x100000000 if r >= 0x80000000 else r

static func u32(v: int) -> int:
    return v & 0xFFFFFFFF

static func cl01(v: float, a: float = 0.0, b: float = 1.0) -> float:
    return a if v < a else (b if v > b else v)

static func lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t

static func inv(a: float, b: float, v: float) -> float:
    return clampf((v - a) / (b - a))

static func smooth(t: float) -> float:
    t = cl01(t)
    return t * t * (3.0 - 2.0 * t)

static func ease_out(t: float, p: float = 3.0) -> float:
    return 1.0 - pow(1.0 - cl01(t), p)

static func ease_in(t: float, p: float = 3.0) -> float:
    return pow(cl01(t), p)

static func ease_in_out(t: float) -> float:
    t = cl01(t)
    return 4.0 * t * t * t if t < 0.5 else 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0

static func back_out(t: float, s: float = 1.7) -> float:
    t = cl01(t) - 1.0
    return t * t * ((s + 1.0) * t + s) + 1.0

static func elastic(t: float) -> float:
    t = cl01(t)
    if t == 0.0 or t == 1.0:
        return t
    return pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * (TAU / 3.0)) + 1.0

static func win(t: float, a: float, b: float, fade: float = 0.15) -> float:
    if t < a or t > b:
        return 0.0
    var f := minf(fade, (b - a) / 2.0)
    return smooth(minf(minf((t - a) / f, (b - t) / f), 1.0))

static func ang_diff(a: float, b: float) -> float:
    var d := fmod(b - a, TAU)
    if d > PI:
        d -= TAU
    if d < -PI:
        d += TAU
    return d

static func hash1(n: int) -> float:
    var v := (n & 0xFFFFFFFF) ^ 0x27d4eb2d
    v = u32(imul(v ^ (v >> 15), 0x85ebca6b))
    v = u32(imul(v ^ (v >> 13), 0xc2b2ae35))
    v = v ^ (v >> 16)
    return float(u32(v)) / 4294967296.0

static func hash2(x: int, y: int) -> float:
    return hash1(imul(x, 374761393) + imul(y, 668265263))

static func hash3(x: int, y: int, z: int) -> float:
    return hash1(imul(x, 374761393) + imul(y, 668265263) + imul(z, 2147483647))

static func noise2(x: float, y: float) -> float:
    var xi: int = floori(x)
    var yi: int = floori(y)
    var xf := x - float(xi)
    var yf := y - float(yi)
    var u := xf * xf * (3.0 - 2.0 * xf)
    var v := yf * yf * (3.0 - 2.0 * yf)
    var a := hash2(xi, yi)
    var b := hash2(xi + 1, yi)
    var c := hash2(xi, yi + 1)
    var d := hash2(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

static func noise3(x: float, y: float, z: float) -> float:
    var zi: int = floori(z)
    var zf := z - float(zi)
    var w := zf * zf * (3.0 - 2.0 * zf)
    var a := noise2(x + float(zi) * 17.13, y + float(zi) * 31.7)
    var b := noise2(x + float(zi + 1) * 17.13, y + float(zi + 1) * 31.7)
    return a + (b - a) * w

static func fbm(x: float, y: float, z: float = 0.0, oct: int = 3) -> float:
    var s := 0.0
    var a := 0.5
    var f := 1.0
    var n := 0.0
    for i in range(oct):
        s += a * noise3(x * f, y * f, z * f)
        n += a
        a *= 0.5
        f *= 2.03
    return s / n

static func curl(x: float, y: float, z: float) -> Vector2:
    var e := 0.35
    var n1 := noise3(x, y + e, z)
    var n2 := noise3(x, y - e, z)
    var n3 := noise3(x + e, y, z)
    var n4 := noise3(x - e, y, z)
    return Vector2((n1 - n2) / (2.0 * e), -(n3 - n4) / (2.0 * e))

static func step_t(t: float, fps: float = 12.0) -> float:
    return floor(t * fps) / fps

const BAYER4 := [0.03125, 0.53125, 0.15625, 0.65625, 0.78125, 0.28125, 0.90625, 0.40625, 0.21875, 0.71875, 0.09375, 0.59375, 0.96875, 0.46875, 0.84375, 0.34375]

static func bayer(x: int, y: int) -> float:
    return float(BAYER4[(y & 3) * 4 + (x & 3)])

static func catmull(pts: Array, samples_per: int) -> Array:
    var out: Array = []
    for i in range(pts.size() - 1):
        var p0: Vector2 = pts[maxi(0, i - 1)]
        var p1: Vector2 = pts[i]
        var p2: Vector2 = pts[i + 1]
        var p3: Vector2 = pts[mini(pts.size() - 1, i + 2)]
        for s in range(samples_per):
            var t := float(s) / float(samples_per)
            var t2 := t * t
            var t3 := t2 * t
            out.append(Vector2(
                0.5 * (2.0 * p1.x + (-p0.x + p2.x) * t + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2 + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3),
                0.5 * (2.0 * p1.y + (-p0.y + p2.y) * t + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2 + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3)))
    out.append(pts[pts.size() - 1])
    return out

class CRng:
    extends RefCounted
    var s: int
    func _init(seed: int) -> void:
        s = CMath.u32(seed)
        if s == 0:
            s = 1
    func next() -> float:
        s = CMath.u32(s + 0x6D2B79F5)
        var t := CMath.imul(s ^ (CMath.u32(s) >> 15), s | 1)
        t = t ^ CMath.u32(t + CMath.imul(t ^ (CMath.u32(t) >> 7), t | 61))
        return float(CMath.u32(t ^ (CMath.u32(t) >> 14))) / 4294967296.0
    func r(a: float = 0.0, b: float = 1.0) -> float:
        return a + (b - a) * next()
    func i(a: int, b: int) -> int:
        return floori(r(float(a), float(b + 1)))
    func pick(arr: Array) -> Variant:
        return arr[floori(next() * float(arr.size()))]
    func sign() -> float:
        return -1.0 if next() < 0.5 else 1.0
    func gauss() -> float:
        return (next() + next() + next() - 1.5) / 1.5
    func chance(p: float) -> bool:
        return next() < p
