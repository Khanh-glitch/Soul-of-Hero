## Faithful port of original B undertowMaw (src/effects/tide.ts:570-737),
## seed 808: inward ripples, spiral streams, per-pixel log-polar shaft,
## stillness pin at TC=4.65, inverse surge at TX=5.05, collapsing tunnels,
## airborne droplets, post environment-twist + surge warps.
## Duration 8.5, climax 5.3 (source-authored constants preserved).
extends RefCounted
class_name BUndertowMaw

const WATER := [Vector3(0.01, 0.03, 0.1), Vector3(0.03, 0.14, 0.34), Vector3(0.1, 0.42, 0.78), Vector3(0.42, 1.0, 1.4), Vector3(1.5, 1.9, 2.1)]
const FOAM := Vector3(1.6, 1.95, 2.1)
const DURATION := 8.5
const CLIMAX := 5.3
const TS_ := 4.35
const TC := 4.65
const TX := 5.05

var _drops: Array = []
var _tunnels: Array = []
var _C := Vector2.ZERO

static func water(h: float, k: float = 1.0) -> Vector3:
    return BMath.ramp(WATER, h) * k

func setup(r: BRenderer) -> void:
    var rng := BMath.BRng.new(808)
    _C = Vector2(BRenderer.W / 2.0 + 26.0, BRenderer.H / 2.0 + 4.0)
    _drops.clear()
    for i in range(220):
        _drops.append({"a": rng.r(0.0, BMath.TAU), "v": rng.r(40.0, 200.0), "vz": rng.r(60.0, 220.0), "s": i})
    _tunnels.clear()
    for i in range(7):
        _tunnels.append({"a": rng.r(0.0, BMath.TAU), "d": rng.r(30.0, 90.0), "t0": rng.r(0.2, 1.2), "R": rng.r(6.0, 12.0)})

func authored_events() -> Array:
    var ev: Array = []
    ev.append({"t": 0.9, "kind": "vortex_open", "pos_local": Vector2(_C), "emitted": false})
    for tt in [2.0, 3.0, 4.0]:
        ev.append({"t": tt, "kind": "pull", "pos_local": Vector2(_C), "emitted": false})
    ev.append({"t": TC, "kind": "stillness", "pos_local": Vector2(_C), "emitted": false})
    ev.append({"t": TX, "kind": "surge_impact", "pos_local": Vector2(_C), "emitted": false})
    ev.append({"t": 6.8, "kind": "aftermath_wet", "pos_local": Vector2(_C), "emitted": false})
    return ev

func render(r: BRenderer, t: float) -> void:
    var C := _C
    var tf := minf(t, TS_)
    var violence := BMath.smooth(2.0, TS_, tf)
    var open := BMath.ease_out(BMath.inv(0.9, 3.2, t))
    var contract := 1.0 - BMath.ease_in(BMath.inv(TC, TX - 0.1, t))
    var R := 82.0 * open * contract
    var e := t - TX
    r.ambient = 0.62 - violence * 0.15 - (0.2 if t > TS_ and t < TX else 0.0)
    if t < 3.0:
        var k := 1.0 - BMath.smooth(2.0, 3.0, t)
        for q in range(4):
            var rr := 90.0 - fmod(t * 25.0 + float(q) * 22.0, 88.0)
            r.ring(C.x, C.y, rr, 1, Vector3(0.75, 0.8, 0.9), k, BRenderer.MUL, 0.78)
    if t < TS_ + 0.01:
        for k in range(7):
            for m in range(40):
                var u := fmod(tf * 0.5 + float(k) / 7.0 + float(m) * 0.006, 1.0)
                var rr := 110.0 * (1.0 - u)
                var a := float(k) * 0.9 + u * 5.0 + tf * 0.5
                r.px(C.x + cos(a) * rr, C.y + sin(a) * rr * 0.78, FOAM if m < 4 else water(0.7), (1.0 - float(m) / 40.0) * BMath.smooth(0.2, 1.0, t) * 0.8)
    if R > 1.5:
        var Rm := R * 1.25
        var stopped := t > TS_
        for y in range(floori(C.y - Rm), int(C.y + Rm) + 1):
            for x in range(floori(C.x - Rm), int(C.x + Rm) + 1):
                var dx := float(x) + 0.5 - C.x
                var dy := (float(y) + 0.5 - C.y) / 0.78
                var th := atan2(dy, dx)
                var Re := R * (1.0 + 0.2 * violence * sin(3.0 * th - tf * 2.2) + 0.06 * sin(7.0 * th + tf * 3.0))
                var d := Vector2(dx, dy).length() / Re
                if d > 1.0:
                    continue
                var depth := -log(d + 0.015) * 3.2 + tf * 1.8
                var ang := th + tf * (0.6 + 1.6 / (d + 0.12)) * (0.6 + violence)
                var band: float = depth - floor(depth)
                var bri := pow(d, 0.75)
                var nz := BMath.noise2(cos(ang) * 3.0 + sin(ang) * 2.0, depth * 1.6 + sin(ang * 3.0) * 0.5)
                var nz2 := BMath.noise2(ang * 4.0 + 20.0, depth * 2.2)
                var col := water(0.08 + bri * 0.5)
                if band < 0.1:
                    col = water(0.25 + bri * 0.5)
                if nz2 > 0.74:
                    col = FOAM * (bri * 0.9)
                elif nz > 0.7:
                    col = water(0.45 + bri * 0.4)
                if d < 0.07:
                    col = Vector3(0, 0, 0.01)
                if d > 0.93 and BRenderer.bayer(x, y) > (1.0 - d) * 14.0:
                    continue
                if stopped:
                    col = col * 0.8
                r.plot(x, y, col.x, col.y, col.z, BRenderer.SET, 1.0)
        var a := 0.0
        while a < BMath.TAU:
            var Re := R * (1.0 + 0.2 * violence * sin(3.0 * a - tf * 2.2) + 0.06 * sin(7.0 * a + tf * 3.0))
            if BMath.hash1(floor(a * 50.0) + floor(tf * 8.0)) > 0.45:
                r.px(C.x + cos(a) * Re, C.y + sin(a) * Re * 0.78, FOAM, 0.9)
            a += 0.02
        for k in range(50):
            var u := fmod(tf * 0.35 + BMath.hash1(float(k)), 1.0)
            for m in range(4):
                var uu := maxf(0.0, u - float(m) * 0.01)
                var r2 := R * 1.15 * pow(1.0 - uu, 1.6)
                var a2 := BMath.hash1(float(k + 4)) * BMath.TAU + uu * uu * 9.0 + tf * 0.4
                r.px(C.x + cos(a2) * r2, C.y + sin(a2) * r2 * 0.78, FOAM, (1.0 - float(m) / 4.0) * (1.0 - u))
        if violence > 0.3:
            for k in range(3):
                var a0 := tf * 1.3 + float(k) * 2.1
                for q in range(50):
                    var u := float(q) / 50.0
                    var rr := R * (0.95 - u * 0.85)
                    var aa := a0 + u * 3.2
                    r.px(C.x + cos(aa) * rr, C.y + sin(aa) * rr * 0.78, water(0.9), violence * (1.0 - u) * 1.1)
        r.light(C.x, C.y, R * 1.8, Vector3(0.2, 0.5, 1.0), 0.5)
    if t > TC and t < TX + 0.05:
        r.disc(C.x, C.y, 1.5, Vector3.ZERO, 1.0, BRenderer.SET)
        r.ring(C.x, C.y, 2.5, 1, FOAM, 1.2)
    if e >= 0.0:
        if e < 0.1:
            r.flash = 0.6
        if e < 0.6:
            r.shake_x = (BMath.hash1(t * 50.0) - 0.5) * 9.0 * (1.0 - e / 0.6)
            r.shake_y = (BMath.hash1(t * 55.0) - 0.5) * 7.0 * (1.0 - e / 0.6)
        for k in range(3):
            var rr := BMath.fly(4.0, 260.0 - float(k) * 60.0, 1.6 + float(k) * 0.4, 0.0, e)
            var life := 1.0 - BMath.smooth(0.6 + float(k) * 0.3, 1.6 + float(k) * 0.3, e)
            if life <= 0.0:
                continue
            var h := 12.0 * life * (1.0 - float(k) * 0.25)
            r.ring(C.x, C.y, rr - 4.0, 9, water(0.3), 0.5 * life, BRenderer.BLEND, 0.78)
            var a := 0.0
            while a < BMath.TAU:
                var wob := sin(a * 9.0 + float(k) * 3.0 + e * 6.0) * 2.5
                var x := C.x + cos(a) * (rr + wob)
                var y := C.y + sin(a) * (rr + wob) * 0.78
                r.px(x, y, water(0.75), life)
                r.px(x, y - h * (0.6 + 0.4 * sin(a * 5.0 + float(k))), FOAM, life * 1.1)
                if BMath.hash1(a * 100.0 + float(k)) > 0.7:
                    r.px(x, y - h * 0.5, water(0.85), life * 0.8)
                a += 0.015
        for tn in _tunnels:
            var u := (e - float(tn.t0)) / 0.7
            if u < 0.0 or u > 1.0:
                continue
            var x := C.x + cos(float(tn.a)) * float(tn.d)
            var y := C.y + sin(float(tn.a)) * float(tn.d) * 0.78
            r.ring(x, y, float(tn.R) * (1.0 - BMath.ease_in(u)), 2, FOAM, 1.0 - u, BRenderer.ADD, 0.6)
            r.disc(x, y, float(tn.R) * (1.0 - BMath.ease_in(u)) * 0.7, water(0.1), 0.6 * (1.0 - u), BRenderer.BLEND, 0.6)
        for dd in _drops:
            var tl := (2.0 * float(dd.vz)) / 320.0
            var ee := minf(e, tl)
            var rr := BMath.fly(3.0, float(dd.v), 0.6, 0.0, ee)
            var gx := C.x + cos(float(dd.a)) * rr
            var gy := C.y + sin(float(dd.a)) * rr * 0.78
            if e < tl:
                var z := float(dd.vz) * e - 160.0 * e * e
                r.px(gx, gy - z, FOAM, 1.0)
            elif e - tl < 3.0:
                r.decal(gx, gy, Vector3(0.04, 0.1, 0.16), 0.5 * (1.0 - (e - tl) / 3.0))
        var wet := 1.0 - BMath.smooth(1.5, 3.5, e)
        if wet > 0.0:
            r.light(C.x, C.y, 120, Vector3(0.3, 0.7, 1.2), wet * 0.8)

func post(r: BRenderer, t: float) -> void:
    var C := _C
    var tf := minf(t, TS_)
    var amp := BMath.smooth(0.2, 3.5, tf) * (1.0 - BMath.smooth(TS_ + 0.3, TX, t)) * 1.1
    var R := 140.0
    if amp > 0.02:
        r.warp(C.x - R, C.y - R, C.x + R, C.y + R, func(x: int, y: int) -> Array:
            var dx := float(x) - C.x
            var dy := (float(y) - C.y) / 0.78
            var d := Vector2(dx, dy).length() / R
            if d > 1.0 or d < 0.6:
                return [float(x), float(y)]
            var tw := amp * pow(1.0 - d, 2.0) * 2.4
            var a := atan2(dy, dx) + tw
            var rr := Vector2(dx, dy).length() * (1.0 - amp * 0.02 * (1.0 - d))
            return [C.x + cos(a) * rr, C.y + sin(a) * rr * 0.78])
    var e := t - TX
    if e > 0.0 and e < 1.2:
        var rr2 := e * 240.0
        var A := 5.0 * (1.0 - e / 1.2)
        r.warp(0, 0, BRenderer.W - 1, BRenderer.H - 1, func(x: int, y: int) -> Array:
            var dx := float(x) - C.x
            var dy := (float(y) - C.y) / 0.78
            var d := Vector2(dx, dy).length()
            var k := exp(-pow((d - rr2) / 9.0, 2.0)) * A
            if k < 0.4 or d == 0.0:
                return [float(x), float(y)]
            return [float(x) - (dx / d) * k, float(y) - (dy / d) * k])
