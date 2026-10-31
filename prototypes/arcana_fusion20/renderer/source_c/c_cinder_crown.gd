## Faithful port of original C cinderCrown (spells/pyre.ts:34-330),
## seed 1000 (stage Rng(1000+0*7919)). C=(244,116) [FOCUS(252,112)+(-8,+4)],
## LIFT=28, SY=0.46, T_SW=3.15, T_BL=4.4, T_BU=4.64. Duration 7.8.
## Used as the C partner of fusion #01 (outer flame geometry); standalone
## it is NOT the voted #01 visual (vote was A+C fusion).
extends RefCounted
class_name CCinderCrown

const DURATION := 7.8
const CLIMAX := 4.82
const C := Vector2(244, 116)
const LIFT := 28.0
const SY := 0.46
const T_SW := 3.15
const T_BL := 4.4
const T_BU := 4.64
const DARK := Vector3(0.09, 0.02, 0.025)

var fx_shake := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0
var fx_kick := 0.0

var _rng: CMath.CRng
var _segs: Array = []
var _embers: Array = []
var _petals: Array = []
var _ps: Array = []
var _burst := false
var _hub := Vector2.ZERO

static func fire(h: float) -> Vector3:
    return CPalette.ramp(CPalette.P["fire"], h)

func setup() -> void:
    CPalette._ensure()
    _rng = CMath.CRng.new(1000)
    _hub = Vector2(C.x, C.y - LIFT)
    _segs.clear()
    for i in range(10):
        var fast := i == 3 or i == 8
        var spikes: Array = []
        if not fast:
            for k in range(_rng.i(1, 2)):
                spikes.append({"u": _rng.r(0.15, 0.85), "h": _rng.r(7, 17)})
        _segs.append({
            "r": 20.0 + float(i) * 3.3 + _rng.r(-1, 1.5), "a0": _rng.r(0, CMath.TAU),
            "len": _rng.r(0.7, 1.7), "w": _rng.r(2.8, 5.2),
            "sp": _rng.sign() * 7.5 if fast else _rng.r(0.45, 1.5) * _rng.sign(),
            "fast": fast, "z": _rng.r(-5, 5), "tail": i % 3 == 1,
            "asm0": 0.6 + float(i) * 0.12 + _rng.r(0, 0.3), "spikes": spikes})
    _embers.clear()
    for i in range(110):
        _embers.append({"seg": i % _segs.size(), "u": _rng.next(), "a": _rng.r(0, CMath.TAU), "rad": _rng.r(60, 150), "arr": _rng.r(0.6, 1.9), "spin": _rng.r(1.5, 3.5) * _rng.sign()})
    _petals.clear()
    for i in range(7):
        _petals.append({"a": (float(i) / 7.0) * CMath.TAU + _rng.r(-0.4, 0.4), "L": _rng.r(48, 118), "w": _rng.r(9, 20), "dur": _rng.r(0.16, 0.5), "del": _rng.r(0, 0.12), "curl": _rng.r(-0.9, 0.9), "seed": i * 13 + 5, "peel": _rng.r(60, 140)})
    _burst = false

func authored_events() -> Array:
    return [
        {"t": 0.6, "kind": "crown_assemble", "pos_local": C, "emitted": false},
        {"t": T_SW, "kind": "swallow_start", "pos_local": _hub, "emitted": false},
        {"t": T_BL, "kind": "blackout", "pos_local": _hub, "emitted": false},
        {"t": T_BU, "kind": "crown_burst_impact", "pos_local": C, "emitted": false},
        {"t": 5.5, "kind": "ghost_rise", "pos_local": C, "emitted": false},
    ]

func _angle(s: Dictionary, t: float) -> float:
    var tt := minf(t, T_BU)
    return float(s.a0) + float(s.sp) * tt + float(s.sp) * pow(maxf(0.0, tt - T_SW), 2.0) * 1.6

func _asm(s: Dictionary, t: float) -> float:
    return CMath.cl01((t - float(s.asm0)) / 0.8)

func _seg_pt(s: Dictionary, a: float, lift: float) -> Vector2:
    return Vector2(C.x + cos(a) * float(s.r), C.y - lift + float(s.z) + sin(a) * float(s.r) * SY)

func _tongue(f: CFrame, x: float, y: float, ang: float, len: float, wid: float, t: float, seed: float, heat: float = 1.0, curl: float = 0.0) -> void:
    if len < 1.5 or heat <= 0.02:
        return
    var n: int = maxi(3, ceili(len / 3.0))
    var ts := CMath.step_t(t, 15.0)
    var pts: Array = []
    var ws: Array = []
    for i in range(n + 1):
        var s := float(i) / float(n)
        var a := ang + curl * s * s
        var wob := (CMath.noise3(seed * 0.37, s * 2.5 - ts * 5.0, ts * 0.7) - 0.5) * len * 0.42 * s
        pts.append(Vector2(x + cos(a) * len * s - sin(a) * wob, y + sin(a) * len * s + cos(a) * wob))
        ws.append(wid * pow(sin(PI * minf(1.0, s * 1.5 + 0.12)), 0.8) * (1.0 - s * 0.55))
    f.ribbon(pts, ws, func(px: float, py: float, s: float, e: float) -> void:
        var nz := CMath.noise3(px * 0.28, py * 0.28 - ts * 7.0, seed)
        var h := CMath.cl01((1.0 - absf(e)) * 1.15 - s * 0.7 + (nz - 0.5) * 0.6) * heat
        if h < 0.1:
            return
        f.Lc(px, py, fire(h), 0.4 + h * 0.7))

func _draw_segs(f: CFrame, t: float, front: bool, mode: String, lift: float, alpha: float = 1.0) -> void:
    var dr := CMath.inv(T_SW, T_BL, t) if mode == "live" else 0.0
    var black := mode == "live" and t >= T_BL
    var heat_g := 0.55 + 0.45 * CMath.inv(0.8, 2.8, t) if mode == "live" else 1.0
    for s in _segs:
        var A := _asm(s, t) if mode == "live" else 1.0
        if A <= 0.0:
            continue
        var a := _angle(s, t)
        var cy := C.y - lift + float(s.z)
        var ext := float(s.r) + float(s.w)
        if bool(s.fast):
            if mode != "live":
                continue
            f.ring(C.x, cy, float(s.r), func(x: float, y: float, pa: float) -> void:
                if (sin(pa) > 0.0) != front:
                    return
                var on := fmod(fmod((pa / CMath.TAU) * 15.0 - t * float(s.sp) * 0.8, 1.0) + 1.0, 1.0) < 0.55 * A
                if not on:
                    return
                if black:
                    f.L(x, y, 2.2, 2.1, 1.9)
                else:
                    f.Lc(x, y, fire(0.75 + 0.25 * (1.0 - dr)), (1.2 if front else 0.7) * (1.0 + dr * 1.5)), SY)
            continue
        var span := float(s.len) * A
        var sr: float = s.r
        var sw: float = s.w
        f.field(C.x - ext - 1.0, cy - ext * SY - 1.0, C.x + ext + 1.0, cy + ext * SY + 1.0, func(x: float, y: float) -> void:
            var dx := x + 0.5 - C.x
            var dy := (y + 0.5 - cy) / SY
            var rr := Vector2(dx, dy).length()
            var off := absf(rr - sr)
            if off > sw * 0.5 + 0.4:
                return
            var pa := atan2(dy, dx)
            if (sin(pa) > 0.0) != front:
                return
            var d := fmod(fmod(pa - a, CMath.TAU) + CMath.TAU, CMath.TAU)
            if d > span:
                return
            var edge := off > sw * 0.5 - 0.85 or d * rr < 1.3 or (span - d) * rr < 1.3
            if mode == "scar":
                var cool := exp(-(t - T_BU) * 0.8)
                f.G(x, y, 0.02, 0.01, 0.01, 0.55)
                if CMath.hash2(x, y) > 0.55:
                    f.Lc(x, y, fire(0.2 + 0.5 * cool), cool * 0.9)
                return
            if mode == "ghost":
                if edge and alpha > CMath.bayer(x, y):
                    f.Lc(x, y, fire(0.6), 0.5)
                return
            if black:
                f.I(x, y, 0, 0, 0, 1)
                if edge:
                    f.L(x, y, 2.4, 2.2, 2)
                return
            var band := 1.0 - off / (sw * 0.5)
            var n := CMath.noise3(pa * 5.0 + t * 2.0, rr * 0.3, CMath.step_t(t, 12.0) * 2.0)
            var h := CMath.cl01((0.45 + 0.55 * n) * (0.55 + 0.45 * band) * heat_g)
            var k := 1.0 if front else 0.55
            var ic := fire(h * (0.95 if front else 0.7) * (1.1 if edge else 1.0))
            var kd := (1.0 - dr) * (1.0 if front else 0.7)
            f.I(x, y, float(ic[0]) * kd, float(ic[1]) * kd, float(ic[2]) * kd, 1.0)
            if edge:
                f.Lc(x, y, fire(minf(1.0, h + 0.25 + dr)), k * (0.3 + dr * 2.6))
            else:
                f.Lc(x, y, fire(h), k * 0.22 * h * (1.0 - dr) * (1.0 - dr)))
        for sp in s.spikes:
            if float(sp.u) * float(s.len) > span:
                continue
            var pa := a + float(sp.u) * float(s.len)
            if (sin(pa) > 0.0) != front:
                continue
            var B := _seg_pt(s, pa, lift)
            var tx := -sin(pa)
            var ty := cos(pa) * SY
            var tl := Vector2(tx, ty).length()
            if tl == 0.0:
                tl = 1.0
            var hh := float(sp.h) * CMath.cl01(A * 1.4 - float(sp.u) * 0.4)
            var tip := Vector2(B.x + cos(pa) * 2.0, B.y - hh)
            var tri: Array = [Vector2(B.x - (tx / tl) * 2.6, B.y - (ty / tl) * 2.6), Vector2(B.x + (tx / tl) * 2.6, B.y + (ty / tl) * 2.6), tip]
            if mode == "ghost":
                if alpha > 0.4:
                    f.poly_outline_l(tri, fire(0.6), 0.4 * alpha)
                continue
            if mode == "scar":
                continue
            if black:
                f.poly_i(tri, Vector3.ZERO, 1.0)
                f.poly_outline_l(tri, Vector3(1, 0.95, 0.85), 2.2)
                continue
            f.poly_i(tri, DARK, 1.0)
            f.poly(tri, func(x: float, y: float) -> void:
                var q := 1.0 - (B.y - y) / maxf(1.0, hh)
                f.Lc(x, y, fire(0.35 + q * 0.5 * heat_g), (1.0 if front else 0.55) * (1.0 - dr) * (1.0 - dr)))
            f.poly_outline_l(tri, fire(0.8), (0.8 if front else 0.45) * (1.0 + dr * 2.0))
        if bool(s.tail) and mode == "live" and not black:
            var dir := signf(float(s.sp))
            var pts: Array = []
            var ws: Array = []
            for k in range(14):
                var pa := a - dir * float(k) * 0.07 + (span if dir < 0.0 else 0.0)
                if (sin(pa) > 0.0) != front:
                    break
                pts.append(_seg_pt(s, pa, lift - float(k) * 0.45))
                ws.append(1.8 * (1.0 - float(k) / 14.0) * A)
            if pts.size() > 1:
                f.ribbon(pts, ws, func(x: float, y: float, q: float, _edge: float) -> void:
                    f.Lc(x, y, fire(0.85 - q * 0.6), (1.0 - q) * 1.1 * (1.0 - dr)))

func update(dt: float, t: float) -> void:
    CKit.particles_update(_ps, dt)
    if t > 1.0 and t < T_BL:
        for s in _segs:
            if bool(s.tail) and _rng.chance(0.25):
                var p := _seg_pt(s, _angle(s, t) + _rng.r(0, float(s.len)), 0.0)
                _ps.append(CKit.pt_defaults({"x": p.x, "y": p.y + LIFT, "z": LIFT - float(s.z), "vz": -5.0, "grav": 90.0, "vx": _rng.r(-5, 5), "max": 1.2, "kind": "ember", "k": 0.9}))
    if not _burst and t >= T_BU:
        _burst = true
        fx_shake = 7.0
        fx_flash = Vector3(1, 0.75, 0.45)
        fx_flash_k = 0.4
        fx_kick = 3.0
        for s in _segs:
            var cnt := 4 if bool(s.fast) else 7
            for k in range(cnt):
                var pa := _angle(s, t) + _rng.r(0, CMath.TAU if bool(s.fast) else float(s.len))
                var p := _seg_pt(s, pa, 0.0)
                var sp := _rng.r(40, 190)
                var roll := _rng.next()
                var vx := cos(pa) * sp
                var vy := sin(pa) * sp * 0.6
                _ps.append(CKit.pt_defaults({
                    "x": p.x, "y": p.y + LIFT, "z": LIFT - float(s.z),
                    "vx": vx * 0.04 if roll < 0.2 else vx, "vy": vy * 0.04 if roll < 0.2 else vy,
                    "vz": _rng.r(-10, 70), "grav": 0.0 if roll < 0.2 else 80.0,
                    "drag": 6.0 if roll < 0.2 else 1.2, "kind": "shard", "col": CPalette.P["fire"],
                    "size": _rng.r(1.6, 3.4), "spin": _rng.r(-9, 9),
                    "max": _rng.r(1.4, 2.2) if roll < 0.2 else _rng.r(1, 2.2), "k": 1.2,
                    "home": Vector2(C.x + _rng.r(-10, 10), C.y) if roll > 0.72 else null, "home_k": 3.5, "bounce": 0.3}))
        for i in range(240):
            var a := _rng.r(0, CMath.TAU)
            var sp := _rng.r(30, 270)
            _ps.append(CKit.pt_defaults({"x": C.x, "y": C.y, "z": LIFT, "vx": cos(a) * sp, "vy": sin(a) * sp * 0.62, "vz": _rng.r(-30, 90), "grav": 70.0, "drag": 2.4, "kind": "ember", "max": _rng.r(0.5, 1.9), "size": 2.0 if _rng.chance(0.2) else 1.0, "k": 1.2}))
    if _burst and t < 6.8 and _rng.chance(0.7):
        _ps.append(CKit.pt_defaults({"x": C.x + _rng.r(-70, 70), "y": C.y + _rng.r(-40, 30), "z": _rng.r(20, 60), "grav": 12.0, "vx": _rng.r(-6, 6), "max": _rng.r(2, 3.2), "kind": "ash"}))

func render(f: CFrame, t: float) -> void:
    var dr := CMath.inv(T_SW, T_BL, t)
    if t < 2.3:
        for e in _embers:
            var s: Dictionary = _segs[int(e.seg)]
            var pos = func(tt: float) -> Dictionary:
                var p := CMath.ease_in_out(CMath.cl01(tt / float(e.arr)))
                var ang: float = float(e.a) + (1.0 - p) * float(e.spin)
                var ax := C.x + cos(ang) * float(e.rad)
                var ay := C.y - LIFT + sin(ang) * float(e.rad) * 0.6
                var tg := _seg_pt(s, _angle(s, tt) + float(e.u) * float(s.len), LIFT)
                return {"x": lerpf(ax, tg.x, p), "y": lerpf(ay, tg.y, p), "p": p}
            var a: Dictionary = pos.call(t)
            if float(a.p) >= 1.0:
                continue
            var b: Dictionary = pos.call(t - 0.05)
            f.line_l(float(b.x), float(b.y), float(a.x), float(a.y), CPalette.ramp(CPalette.P["ember"], 0.5), 0.6)
            f.Lc(float(a.x), float(a.y), CPalette.ramp(CPalette.P["ember"], 0.9), 1.4)
    if t < T_BU:
        f.shade_disc(C.x, C.y, 30.0, 0.55, SY, 3.0)
        f.glow(C.x, C.y, 50.0, fire(0.5), 0.18 * CMath.inv(0.5, 2.5, t) * (1.0 - dr), 4.0, SY)
        _draw_segs(f, t, false, "live", LIFT)
        var arch := CMath.inv(1.5, 2.7, t)
        if arch > 0.0 and t < T_BL:
            for i in range(_segs.size()):
                var s: Dictionary = _segs[i]
                if bool(s.fast):
                    continue
                var m := _seg_pt(s, _angle(s, t) + float(s.len) * 0.5 * _asm(s, t), LIFT)
                var ex := lerpf(_hub.x, m.x, arch)
                var ey := lerpf(_hub.y, m.y, arch)
                var fl := 0.5 + 0.5 * CMath.hash1(float(i * 7) + floor(t * 15.0))
                f.line(_hub.x, _hub.y, ex, ey, func(x: float, y: float, q: float) -> void:
                    if ((int(x + y) & 1) == 0 or fl > 0.7):
                        f.Lc(x, y, fire(0.55 + q * 0.3), arch * fl * (0.6 + dr * 1.5)))
                var s2: Dictionary = _segs[(i + 2) % _segs.size()]
                if not bool(s2.fast):
                    var m2 := _seg_pt(s2, _angle(s2, t) + float(s2.len) * 0.5, LIFT)
                    for k in range(21):
                        var q := float(k) / 20.0
                        var bx := lerpf(lerpf(m.x, _hub.x, q), lerpf(_hub.x, m2.x, q), q)
                        var by := lerpf(lerpf(m.y, _hub.y - 8.0, q), lerpf(_hub.y - 8.0, m2.y, q), q)
                        var bead := absf(fmod(t * 1.3 + float(i) * 0.17, 1.0) - q) < 0.06
                        if k % 2 == 0 or bead:
                            f.Lc(bx, by, fire(0.95 if bead else 0.5), arch * (1.6 if bead else 0.5))
            for k in range(4):
                var oa := t * (2.6 - float(k) * 0.45) * (-1.0 if k % 2 else 1.0) + float(k) * 1.7
                var r := 6.0 + float(k) * 3.2
                var sx := _hub.x + cos(oa) * r
                var sy := _hub.y + sin(oa) * r * SY
                f.disc_l(sx, sy, 1.6, fire(1.0), 1.6 * arch)
                f.ring_l(sx, sy, 3.5, fire(0.6), 0.35 * arch, 0.6)
        if t >= T_SW:
            f.glow(_hub.x, _hub.y, 80.0, Vector3(-1, -0.9, -0.8), 0.42 * dr, 5.0, 0.75)
            f.shade_disc(C.x, C.y, 110.0, 1.0 - 0.6 * dr, 0.6, 4.0)
            f.disc(_hub.x, _hub.y, 64.0, func(x: float, y: float, d: float) -> void:
                var k := 2.4 * dr * (1.0 - d)
                var dx := _hub.x - x
                var dy := _hub.y - y
                var l := Vector2(dx, dy).length()
                if l == 0.0:
                    l = 1.0
                f.D(x, y, -dx / l * k, -dy / l * k))
            for k in range(46):
                var ph := fmod(t * 1.5 + CMath.hash1(float(k)), 1.0)
                var r := 75.0 * (1.0 - ph)
                var a := CMath.hash1(float(k + 9)) * CMath.TAU + ph * 2.5
                var x := _hub.x + cos(a) * r
                var y := _hub.y + sin(a) * r * 0.6
                var r2 := r + 6.0
                var x2 := _hub.x + cos(a - 0.2) * r2
                var y2 := _hub.y + sin(a - 0.2) * r2 * 0.6
                f.line_l(x2, y2, x, y, fire(0.9), dr * 0.9 * ph)
            f.disc_l(_hub.x, _hub.y, lerpf(6.0, 1.0, dr), Vector3.ONE, 1.0 + dr * 3.0)
        else:
            f.glow(_hub.x, _hub.y, 9.0, fire(0.9), 0.7 * CMath.inv(1.2, 2.5, t), 3.0)
        _draw_segs(f, t, true, "live", LIFT)
        if t >= T_BL:
            f.field(0.0, 0.0, 383.0, 215.0, func(x: float, y: float) -> void:
                f.S(x, y, 0.3))
            f.L(_hub.x, _hub.y, 3, 3, 3)
            f.desat = 0.5
    else:
        _draw_segs(f, t, false, "scar", 0.0)
        _draw_segs(f, t, true, "scar", 0.0)
        var tb := t - T_BU
        if t > 5.5 and t < 6.9:
            var g := 1.0 - CMath.inv(5.5, 6.9, t)
            _draw_segs(f, T_BU - 0.01, false, "ghost", LIFT + (t - 5.5) * 12.0, g * (0.5 + 0.5 * sin(t * 40.0)))
            _draw_segs(f, T_BU - 0.01, true, "ghost", LIFT + (t - 5.5) * 12.0, g)
        for p in _petals:
            var q := CMath.ease_out((tb - float(p.del)) / float(p.dur), 4.0)
            if q <= 0.0:
                continue
            var fade := 1.0 - CMath.inv(0.25, 1.5, tb)
            if fade <= 0.0:
                continue
            var a: float = p.a
            var dir_y := sin(a) * 0.72
            var ang := atan2(dir_y, cos(a))
            _tongue(f, _hub.x, _hub.y, ang, float(p.L) * q, float(p.w), t, float(p.seed), 0.85 * fade + 0.1, float(p.curl) * q)
            _tongue(f, _hub.x, _hub.y, ang + 0.05, float(p.L) * q * 0.68, float(p.w) * 0.42, t, float(p.seed) + 3.0, 1.5 * fade, float(p.curl) * q * 0.6)
            var po := tb * float(p.peel)
            _tongue(f, _hub.x + cos(ang) * po, _hub.y + sin(ang) * po, ang, float(p.L) * 0.4 * q, float(p.w) * 0.5, t, float(p.seed) + 7.0, 0.7 * fade * (1.0 - CMath.inv(0.1, 0.8, tb)), -float(p.curl))
        if tb < 0.15:
            f.disc_l(_hub.x, _hub.y, 12.0 * (1.0 - tb / 0.15), Vector3.ONE, 2.0)
        f.glow(_hub.x, _hub.y, 70.0, fire(0.6), maxf(0.0, 0.4 - tb * 0.4), 5.0, 0.8)
        if tb < 0.7:
            CKit.shock(f, C.x, C.y, tb * 260.0, 14.0, 9.0 * (1.0 - tb / 0.7), 0.62, 1.5)
            f.ring_l(C.x, C.y, tb * 260.0, fire(0.8), (1.0 - tb / 0.7) * 1.2, 0.62)
        CKit.haze(f, C.x, C.y - 10.0, 60.0, t, 2.2 * maxf(0.0, 1.0 - tb * 0.5), 0.8)
    CKit.particles_render(f, _ps)
