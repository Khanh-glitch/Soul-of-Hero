## Faithful port of original A CinderCrown (spells/pyre.ts:39-331),
## RNG(0xc01d), ARENA_C=(232,124). Duration 6.6 (A index), climax 0.66.
extends RefCounted
class_name ACinderCrown

const DURATION := 6.6
const CLIMAX_N := 0.66
const C := Vector2(232, 124)

var _rng: AMath.ARng
var _frags: Array = []
var _suns: Array = []
var _petals: Array = []
var _ash: ADraw.APool

func setup() -> void:
    _rng = AMath.ARng.new(0xc01d)
    _ash = ADraw.APool.new()
    _frags.clear()
    _suns.clear()
    _petals.clear()
    var n := 13
    for i in range(n):
        var a := (float(i) / float(n)) * AMath.TAU + _rng.rangef(-0.08, 0.08)
        var sa := _rng.angle()
        _frags.append({
            "a": a, "r": 30.0 + _rng.rangef(-4, 5),
            "sp": _rng.rangef(-1.5, 1.5) * (2.4 if i % 3 == 0 else 1.0),
            "size": _rng.rangef(1.6, 4.2),
            "sx": C.x + cos(sa) * _rng.rangef(150, 260),
            "sy": C.y + sin(sa) * _rng.rangef(110, 190),
            "x": 0.0, "y": 0.0, "px": 0.0, "py": 0.0,
            "spike": _rng.rangef(8, 26) * (1.0 if i % 2 else 0.62),
            "w": _rng.rangef(0.1, 0.26),
            "tail": 1 if _rng.next() < 0.45 else 0,
            "delay": _rng.rangef(0, 0.55)})
    for i in range(3):
        _suns.append({"r": 9.0 + float(i) * 5.5, "sp": _rng.rangef(1.4, 3.4) * _rng.sign(), "ph": _rng.angle(), "s": _rng.rangef(1.4, 2.6)})
    for i in range(11):
        _petals.append({
            "a": (float(i) / 11.0) * AMath.TAU + _rng.rangef(-0.22, 0.22),
            "len": _rng.rangef(46, 148), "curve": _rng.rangef(-1.5, 1.5),
            "delay": _rng.rangef(0, 0.42), "sp": _rng.rangef(0.7, 1.9),
            "w": _rng.rangef(7, 20), "back": 1 if _rng.next() < 0.28 else 0})

func authored_events() -> Array:
    return [
        {"t": 1.1, "kind": "crown_build", "pos_local": C, "emitted": false},
        {"t": 3.0, "kind": "inhale_start", "pos_local": C, "emitted": false},
        {"t": 3.95, "kind": "crown_impact", "pos_local": C, "emitted": false},
        {"t": 5.4, "kind": "petals_unfold", "pos_local": C, "emitted": false},
    ]

func update(dt: float, t: float) -> void:
    if t > 3.95 and t < 5.6 and _ash.count() < 260:
        for i in range(7):
            var a := _rng.angle()
            var sp := _rng.rangef(20, 150)
            _ash.spawn({
                "x": C.x + cos(a) * _rng.rangef(0, 24),
                "y": C.y + sin(a) * _rng.rangef(0, 18),
                "vx": cos(a) * sp, "vy": sin(a) * sp * 0.7 - 12.0,
                "life": _rng.rangef(0.7, 2.4), "size": _rng.rangef(0.6, 1.8),
                "k": _rng.rangef(0.5, 1), "seed": _rng.next() * 1000.0})
    if t > 1.0 and t < 3.3 and _ash.count() < 150 and _rng.next() < 0.55:
        var a := _rng.angle()
        _ash.spawn({
            "x": C.x + cos(a) * 60.0, "y": C.y + sin(a) * 46.0,
            "vx": -cos(a) * 34.0, "vy": -sin(a) * 28.0,
            "life": 1.4, "size": 1.0, "k": 0.6, "seed": _rng.next() * 1000.0})
    _ash.each(func(p: Dictionary) -> void:
        p["vy"] = float(p.vy) - 26.0 * dt
        p["vx"] = float(p.vx) * exp(-1.1 * dt)
        p["vy"] = float(p.vy) * exp(-0.9 * dt))
    _ash.step(dt, 0.0)
    var gather := AMath.seg(t, 0.0, 1.55)
    for f in _frags:
        f["px"] = f["x"]
        f["py"] = f["y"]
        var g := AMath.ease_out(AMath.cl01((gather - float(f.delay) * 0.3) / 0.9), 2.6)
        var ang: float = float(f.a) + float(f.sp) * t
        var collapse := 1.0 - 0.92 * AMath.smoothstep(3.0, 3.8, t)
        var tx := C.x + cos(ang) * float(f.r) * collapse
        var ty := C.y + (sin(ang) * float(f.r) * collapse) / 1.25
        f["x"] = lerpf(float(f.sx), tx, g)
        f["y"] = lerpf(float(f.sy), ty, g)

func render(fb: AFramebuffer, t: float) -> void:
    var build := AMath.seg(t, 1.1, 3.0)
    var inhale := AMath.seg(t, 3.0, 3.86)
    var blackout := AMath.smoothstep(3.78, 3.9, t) * (1.0 - AMath.smoothstep(3.93, 3.99, t))
    var burst := AMath.seg(t, 3.95, 5.4)
    var after := AMath.seg(t, 5.2, 6.4)
    for f in _frags:
        var d := Vector2(float(f.x) - float(f.px), float(f.y) - float(f.py)).length()
        if d > 0.5 and t < 3.9:
            var c := ACommon.fire_col(0.55 + AMath.cl01(d / 14.0) * 0.45)
            ADraw.streak(fb, float(f.px), float(f.py), float(f.x), float(f.y), float(f.size) * 0.5, float(f.size) * 0.9, c, 0.9)
    if build > 0.0 and burst < 1.0:
        var open_ := 1.0 - inhale * 0.55
        var base := 26.0 * open_
        var bright := 1.0 - blackout * 0.98
        var r_max := 60.0
        var frags := _frags
        ADraw.field(fb, C.x - r_max, C.y - r_max / 1.2, C.x + r_max, C.y + r_max / 1.2, func(x: int, y: int, out: Array) -> void:
            var dx := float(x) + 0.5 - C.x
            var dy := (float(y) + 0.5 - C.y) * 1.2
            var d := Vector2(dx, dy).length()
            if d > r_max:
                return
            var a := atan2(dy, dx)
            var surf := base
            for f in frags:
                var ang: float = float(f.a) + float(f.sp) * t
                var da: float = absf(fmod(a - ang + PI * 3.0, AMath.TAU) - PI)
                var g := exp(-(da * da) / (float(f.w) * float(f.w) * 2.0))
                surf += float(f.spike) * g * build * (1.0 - inhale * 0.72)
            var flick := AMath.fbm(cos(a) * 3.0 + 11.0, sin(a) * 3.0 - t * 2.2, 3)
            surf *= 0.82 + flick * 0.34
            var inner := base * 0.52 * (1.0 - inhale * 0.9)
            if d > surf or d < inner:
                return
            var h: float = AMath.cl01(minf((surf - d) / 9.0, (d - inner) / 5.0)) * build
            var rim := AMath.cl01(1.0 - absf(d - surf) / 2.1)
            var heat := lerpf(h * 0.85, 0.08, inhale * 0.85) * bright
            heat += rim * (0.55 + inhale * 0.9)
            var c := ACommon.fire_col(AMath.cl01(heat))
            out[0] = c.x
            out[1] = c.y
            out[2] = c.z)
        var spoke_k := build * (1.0 - inhale * 0.3)
        for i in range(_frags.size()):
            var f: Dictionary = _frags[i]
            var ang: float = float(f.a) + float(f.sp) * t
            var r1 := (base * 0.52 + (float(f.spike) * build) * 0.5) * (1.0 - inhale * 0.6)
            var c := ACommon.fire_col(0.55 + 0.35 * sin(t * 7.0 + float(i)) * (1.0 - blackout))
            ADraw.line(fb, C.x + cos(ang) * base * 0.5, C.y + (sin(ang) * base * 0.5) / 1.2,
                C.x + cos(ang) * (base + r1 * 0.6), C.y + (sin(ang) * (base + r1 * 0.6)) / 1.2,
                c, spoke_k * 0.75 * (1.0 - blackout))
        for s in _suns:
            var a: float = float(s.ph) + float(s.sp) * t
            var rr: float = float(s.r) * (1.0 - inhale * 0.8)
            var sx := C.x + cos(a) * rr
            var sy := C.y + (sin(a) * rr) / 1.2
            ADraw.glow(fb, sx, sy, float(s.s) * 2.6 * (1.0 - blackout * 0.9), AMath.R("fire", 0.92), 1.1 * build)
            fb.add(sx, sy, 3.0, 2.6, 2.0, build * (1.0 - blackout * 0.8))
        var core_r := lerpf(3.0, 10.0, inhale) * (1.0 - blackout * 0.5)
        ADraw.glow(fb, C.x, C.y, core_r * 1.5, AMath.R("fire", 0.9), 0.4 + inhale * 1.1)
        if inhale > 0.2:
            ADraw.field_mul(fb, C.x - 46.0, C.y - 40.0, C.x + 46.0, C.y + 40.0, func(x: int, y: int) -> float:
                var d := Vector2(float(x) - C.x, (float(y) - C.y) * 1.2).length()
                return lerpf(1.0, 0.2, inhale * AMath.cl01(1.0 - d / 30.0)) if d < 30.0 else 1.0)
    if burst > 0.0 and burst < 1.0:
        var e := burst
        for p in _petals:
            var u := AMath.cl01((e - float(p.delay) * 0.3) * float(p.sp))
            if u <= 0.0:
                continue
            var grow := AMath.ease_out(u, 4.5)
            var len_: float = float(p.len) * grow * (0.6 + 0.4 * sin(u * 3.0) if int(p.back) else 1.0)
            var pts: Array = []
            var steps := 12
            var r0 := 14.0 + u * 26.0
            for i in range(steps + 1):
                var s := float(i) / float(steps)
                var a: float = float(p.a) + float(p.curve) * s * s * 0.75 * (-1.5 if int(p.back) else 1.0)
                var rr := r0 + len_ * s
                pts.append(Vector2(C.x + cos(a) * rr, C.y + (sin(a) * rr) / 1.22))
            var fade := 1.0 - AMath.cl01((u - 0.55) / 0.45)
            var pw: float = p.w
            var pa: float = p.a
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float:
                    return pw * (0.2 + sin(pow(s, 0.8) * PI) * 0.95) * (1.0 - u * 0.3),
                func(s: float, _i: int, edge: float) -> Variant:
                    var n := AMath.fbm(s * 7.0 + pa * 4.0, edge * 4.0 - t * 3.4, 3)
                    var h := (1.0 - edge) * (1.0 - s * 0.5) * (0.35 + n * 0.75) * fade * 0.95
                    if h < 0.06:
                        return null
                    return ACommon.fire_col(AMath.cl01(h)))
        var fl := pow(1.0 - AMath.cl01(burst * 9.0), 2.0)
        fb.flash += Vector3(0.45, 0.22, 0.08) * fl
        ADraw.pulse_ring(fb, C.x, C.y, 10.0 + AMath.ease_out(burst, 2.0) * 210.0, 5.0 * (1.0 - burst), AMath.R("fire", 0.62), 0.45 * pow(1.0 - burst, 2.0), 1.25)
        ACommon.heat_shimmer(fb, C.x, C.y, 70.0 + burst * 60.0, t, 3.0 * (1.0 - burst))
    if after > 0.0:
        var k := (1.0 - after) * 0.9
        for f in _frags:
            var ang: float = float(f.a) + float(f.sp) * 3.9
            var rr := (26.0 + float(f.spike) * 0.8) * (1.0 + after * 0.25)
            var x := C.x + cos(ang) * rr
            var y := C.y + (sin(ang) * rr) / 1.2
            var flick := 0.5 + 0.5 * AMath.vnoise(float(f.a) * 9.0, t * 5.0)
            ADraw.glow(fb, x, y, 3.4, ACommon.fire_col(0.42 * flick), k * 1.2)
        for i in range(40):
            var a := (float(i) / 40.0) * AMath.TAU
            var rr := 26.0 * (1.0 + after * 0.25)
            var f := 0.5 + 0.5 * sin(a * 7.0 + t * 2.0)
            fb.add(C.x + cos(a) * rr, C.y + (sin(a) * rr) / 1.2, 0.6, 0.18, 0.05, k * f * 0.8)
    _ash.each(func(p: Dictionary) -> void:
        var l := float(p.life) / float(p.max)
        var c := ACommon.fire_col(l * 0.95 * float(p.k) + 0.05)
        ADraw.streak_p(fb, p, c, l * 0.9)
        if float(p.size) > 1.3:
            fb.add(float(p.x), float(p.y), c.x, c.y, c.z, l))
