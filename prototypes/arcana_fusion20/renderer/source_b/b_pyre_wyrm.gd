## Faithful port of original B furnaceWyrm (src/effects/pyre.ts:289-489),
## including setup (seed 202 head path / crackTree / debris), render and
## post (heat-shimmer warp). FIRE ramp, CHAR and tongue() ported from the
## same file. Duration 7.6, climax 5.12, impact TI 4.98 — as authored.
extends RefCounted
class_name BPyreWyrm

const FIRE := [Vector3(0, 0, 0), Vector3(0.3, 0.02, 0.03), Vector3(0.85, 0.07, 0.04), Vector3(1.6, 0.48, 0.06), Vector3(2.2, 1.35, 0.3), Vector3(3.0, 2.7, 2.0)]
const CHAR := Vector3(0.03, 0.02, 0.02)
const DURATION := 7.6
const CLIMAX := 5.12
const TI := 4.98

var _head_ctrl: Array = []
var _caster := Vector2.ZERO
var _target := Vector2.ZERO
var _cracks: Array = []
var _debris: Array = []

static func fire(h: float, k: float = 1.0) -> Vector3:
    return BMath.ramp(FIRE, h) * k

func _orbit(tt: float) -> Vector3:
    var u := tt - 2.1
    var ang := 2.6 + u * 3.1
    var rad := 50.0 - u * 5.0 + sin(u * 5.0) * 4.0
    return Vector3(_target.x + cos(ang) * rad, _target.y + sin(ang) * rad * 0.62, 16.0 + sin(ang + 1.0) * 11.0)

func head(tt: float) -> Vector3:
    if tt < 0.55:
        return Vector3(_caster.x + 4.0, _caster.y + 6.0, -4.0)
    if tt < 2.1:
        var u := (tt - 0.55) / 1.55
        var p := BMath.catmull(_head_ctrl, BMath.ease_in_out(u) * 0.85 + u * 0.15)
        return Vector3(p.x, p.y, minf(16.0, (tt - 0.55) * 40.0) + sin(u * 9.0) * 4.0)
    if tt < 4.45:
        return _orbit(tt)
    var o := _orbit(4.45)
    var back := BMath.ease_out(BMath.inv(4.45, 4.8, tt))
    var strike := BMath.ease_in(BMath.inv(4.8, 4.98, tt))
    var bx := _target.x + (o.x - _target.x) * (1.0 + back * 0.6)
    var by := _target.y + (o.y - _target.y) * (1.0 + back * 0.6) - back * 10.0
    return Vector3(lerpf(bx, _target.x, strike), lerpf(by, _target.y, strike), lerpf(o.z + back * 22.0, 0.0, strike))

func setup(r: BRenderer) -> void:
    var rng := BMath.BRng.new(202)
    _caster = r.caster
    _target = r.target
    var o0 := _orbit(2.1)
    _head_ctrl = [
        _caster + Vector2(4, 6), _caster + Vector2(-6, -20), _caster + Vector2(-30, -62), _caster + Vector2(30, -92),
        _caster + Vector2(90, -40), _caster + Vector2(70, 30), Vector2((_caster.x + _target.x) / 2.0 + 30.0, _target.y + 60.0), Vector2(o0.x, o0.y)]
    _cracks = BFx.crack_tree(rng, 0.0, 0.0, 9, 80.0, 0.4, 3.0)
    _debris.clear()
    for i in range(60):
        _debris.append({"a": rng.r(0.0, BMath.TAU), "v": rng.r(30.0, 170.0), "vz": rng.r(60.0, 190.0), "s": rng.r(0.5, 2.2), "seed": i})

static func tongue(r: BRenderer, x: float, y: float, h: float, w: float, t: float, seed: float, heat: float = 1.0, k: float = 1.0) -> void:
    if h < 1.0:
        return
    var sw := (BMath.noise1(t * 7.0 + seed * 13.0) - 0.5) * w * 2.4
    var sw2 := (BMath.noise1(t * 11.0 + seed * 7.0) - 0.5) * w
    var hh := h * (0.75 + 0.5 * BMath.noise1(t * 9.0 + seed * 3.0))
    var layers := [[1.0, fire(0.4 * heat + 0.1), 0.9 * k], [0.62, fire(0.65 * heat + 0.1), 0.8 * k], [0.3, fire(0.95 * heat), 0.8 * k]]
    for L in layers:
        var s: float = L[0]
        var ww := w * s
        var H2 := hh * (0.4 + s * 0.6)
        r.poly([x - ww, y, x - ww * 0.8 + sw2 * 0.5, y - H2 * 0.45, x + sw * s, y - H2, x + ww * 0.7 + sw2, y - H2 * 0.5, x + ww, y], L[1], float(L[2]))

func render(r: BRenderer, t: float) -> void:
    var T := r.target
    var C := r.caster
    var NSEG := 48
    var contract := BMath.smooth(4.78, 4.98, t)
    var lag := 0.029 * (1.0 - contract * 0.96)
    var e := t - TI
    var cr := BMath.ease_out(t / 0.55)
    if t < 6.0:
        var k := (1.0 if t < 0.6 else 0.4) * (1.0 - BMath.smooth(4.0, 6.0, t))
        r.line(C.x - 14.0 * cr, C.y + 7, C.x + 18.0 * cr, C.y + 5, fire(0.85), 1.6 * k)
        r.line(C.x - 10.0 * cr, C.y + 8, C.x + 12.0 * cr, C.y + 6, fire(0.5), 0.8 * k)
        r.decal_line(C.x - 14.0 * cr, C.y + 7, C.x + 18.0 * cr, C.y + 5, CHAR, 0.9)
        r.light(C.x, C.y + 6, 30, Vector3(1.3, 0.5, 0.1), 0.8 * k * cr)
    if t >= 0.5 and t < TI + 0.02:
        var segs: Array = []
        for i in range(NSEG):
            var tt := t - float(i) * lag
            if tt < 0.55:
                break
            var p := head(tt)
            var q := head(tt - 0.02)
            var spd := Vector2(p.x - q.x, p.y - q.y).length() / 0.02
            segs.append({"x": p.x, "y": p.y, "z": p.z, "i": i, "spd": spd, "tt": tt, "dir": atan2(p.y - q.y - (p.z - q.z), p.x - q.x)})
        for k3 in range(0, segs.size(), 3):
            var g: Dictionary = segs[k3]
            r.shadow(float(g.x), float(g.y) + 2, 5, 2.5, 0.35)
            if k3 % 9 == 0:
                r.light(float(g.x), float(g.y) - float(g.z) * 0.5, 46, Vector3(1.3, 0.45, 0.1), 0.5)
        var order := segs.duplicate()
        order.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
            return float(a.z) < float(b.z) if absf(float(a.z) - float(b.z)) > 0.001 else float(a.y) < float(b.y))
        for g in order:
            var gi: int = g.i
            var has_n := gi + 1 < segs.size()
            var taper := 1.0 - float(gi) / float(NSEG)
            var stretch := BMath.clampf2(float(g.spd) / 260.0)
            var w := (2.2 + 4.5 * taper) * (1.0 - 0.45 * stretch) * (1.0 + contract * 0.6)
            var depth_k := 0.75 + BMath.clampf2(float(g.z) / 30.0) * 0.35
            var gx: float = g.x
            var gy: float = g.y
            var gz: float = g.z
            if has_n:
                var n: Dictionary = segs[gi + 1]
                r.thick(gx, gy - gz, float(n.x), float(n.y) - float(n.z), w * 1.5, fire((0.42 + stretch * 0.25) * depth_k), 1.0, BRenderer.SET)
            r.disc(gx, gy - gz, w, fire(0.38 * depth_k + 0.05), 1.0, BRenderer.SET)
            r.disc(gx, gy - gz, w * 0.5, fire((0.62 + (1.0 - stretch) * 0.2 * BFx.flick(float(gi), t, 14.0)) * depth_k), 1.0, BRenderer.SET)
            if gi % 4 == 0:
                r.px(gx - 1, gy - gz - w * 0.5, fire(0.95), 1.0, BRenderer.SET)
            if gi % 2 == 0 and gi > 1:
                var ca := cos(float(g.dir))
                var sa := sin(float(g.dir))
                var bx := gx - ca * w * 0.4
                var by := gy - gz - sa * w * 0.4
                r.line(bx, by, bx - ca * w + -sa * w, by - sa * w + ca * w, fire(0.8 * depth_k), 1.0, BRenderer.SET)
                r.line(bx, by, bx - ca * w - -sa * w, by - sa * w - ca * w, fire(0.8 * depth_k), 1.0, BRenderer.SET)
            if gi % 3 == 1:
                tongue(r, gx, gy - gz - w * 0.4, w * 2.2 * (1.0 - stretch * 0.5), w * 0.7, t, float(gi), 0.8, 0.35)
        for k in range(70):
            var st := 0.7 + float(k) * 0.06
            var u := (t - st) / 0.7
            if u < 0.0 or u > 1.0 or st > TI:
                continue
            var j := (k * 7) % NSEG
            var o := head(st - float(j) * 0.029)
            var a := BMath.hash1(float(k)) * BMath.TAU
            for m in range(6):
                var uu := maxf(0.0, u - float(m) * 0.025)
                var epx := o.x + cos(a) * uu * 36.0 - sin(a) * sin(uu * 14.0) * 3.0
                var epy := o.y - o.z + sin(a) * uu * 22.0 + cos(a) * sin(uu * 14.0) * 3.0 - uu * 16.0
                r.px(epx, epy, fire(0.9 - float(m) * 0.08), (1.0 - u) * (1.0 - float(m) / 6.0) * 1.6)
        if not segs.is_empty():
            var h0: Dictionary = segs[0]
            var hx: float = h0.x
            var hy: float = float(h0.y) - float(h0.z)
            var a2 := float(h0.dir)
            var ca2 := cos(a2)
            var sa2 := sin(a2)
            var maw := BMath.smooth(4.45, 4.85, t)
            var jaw := 0.35 + 0.25 * sin(t * 9.0) + maw * 0.6
            var L := 9.0 + maw * 5.0
            var P := func(lx: float, ly: float) -> Array: return [hx + lx * ca2 - ly * sa2, hy + lx * sa2 + ly * ca2]
            if maw > 0.0:
                for k in range(11):
                    var ang := a2 + (float(k) / 11.0) * BMath.TAU
                    var len_ := (10.0 + float(k % 2) * 8.0) * maw * (1.0 + 0.2 * sin(t * 30.0 + float(k)))
                    var bx := hx + cos(ang) * 5.0
                    var by := hy + sin(ang) * 5.0
                    r.poly([bx + cos(ang + 1.5) * 2.5, by + sin(ang + 1.5) * 2.5, hx + cos(ang) * (5.0 + len_), hy + sin(ang) * (5.0 + len_), bx - cos(ang + 1.5) * 2.5, by - sin(ang + 1.5) * 2.5], fire(0.9), 1.2)
                r.glow(hx, hy, 26.0 * maw, Vector3(2.5, 1.4, 0.5), maw * 1.5)
                r.disc(hx, hy, 4.0 * maw, CHAR, 1.0, BRenderer.SET)
                r.ring(hx, hy, 4.0 * maw, 1, Vector3(3, 2.6, 2), 2.0)
            var p1: Array = P.call(-3, -5)
            var p2: Array = P.call(L, -jaw * 7 - 1)
            var p3: Array = P.call(L * 0.7, -1)
            var p4: Array = P.call(-1, 0)
            r.poly([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]], fire(0.55), 1.0, BRenderer.SET)
            var q1: Array = P.call(-3, 5)
            var q2: Array = P.call(L, jaw * 7 + 1)
            var q3: Array = P.call(L * 0.7, 1)
            var q4: Array = P.call(-1, 0)
            r.poly([q1[0], q1[1], q2[0], q2[1], q3[0], q3[1], q4[0], q4[1]], fire(0.55), 1.0, BRenderer.SET)
            r.disc(hx, hy, 4.5, fire(0.42), 1.0, BRenderer.SET)
            r.disc(hx + cos(a2) * 2, hy + sin(a2) * 2, 2, fire(0.7), 1.0, BRenderer.SET)
            var h1: Array = P.call(-2, -4)
            var h2: Array = P.call(-11, -9)
            r.line(float(h1[0]), float(h1[1]), float(h2[0]), float(h2[1]), fire(0.95), 1.4)
            var h3: Array = P.call(-2, 4)
            var h4: Array = P.call(-11, 9)
            r.line(float(h3[0]), float(h3[1]), float(h4[0]), float(h4[1]), fire(0.95), 1.4)
            var ey: Array = P.call(2, -2.5)
            var ey2: Array = P.call(2, 2.5)
            r.px(float(ey[0]), float(ey[1]), Vector3(3, 3, 3), 2.0, BRenderer.SET)
            r.px(float(ey2[0]), float(ey2[1]), Vector3(3, 3, 3), 2.0, BRenderer.SET)
            r.light(hx, hy, 60, Vector3(1.4, 0.6, 0.15), 1.0)
    if e >= 0.0:
        r.flash = maxf(0.0, 0.7 - e * 8.0)
        r.flash_col = Vector3(1.2, 0.7, 0.4)
        if e < 0.4:
            r.shake_x = (BMath.hash1(t * 91.0) - 0.5) * 7.0 * (1.0 - e / 0.4)
            r.shake_y = (BMath.hash1(t * 37.0) - 0.5) * 7.0 * (1.0 - e / 0.4)
        var heat := exp(-e * 0.9)
        r.light(T.x, T.y, 150, Vector3(1.4, 0.55, 0.15), 2.2 * heat)
        r.decal_disc(T.x, T.y, 14, CHAR, 0.8, 0.4)
        for cf in _cracks:
            var cd: Dictionary = cf
            if float(cd.d) > e * 4.0:
                continue
            var x0 := T.x + float(cd.x0)
            var y0 := T.y + float(cd.y0) * 0.6
            var x1 := T.x + float(cd.x1)
            var y1 := T.y + float(cd.y1) * 0.6
            r.decal_line(x0, y0, x1, y1, CHAR, 0.9)
            var g := BMath.clampf2(heat * 1.4 - float(cd.d) * 0.5 + 0.2 * sin(e * 6.0 + float(cd.d) * 20.0))
            if g > 0.03:
                r.line(x0, y0, x1, y1, fire(0.3 + g * 0.7), 1.2 * g + 0.2)
                if int(cd.gen) == 0 and g > 0.4:
                    r.line(x0, y0 - 1, x1, y1 - 1, fire(0.45), 0.5 * g)
        var burst := 1.0 - BMath.smooth(0.0, 1.4, e)
        for k in range(16):
            var a := (float(k) / 16.0) * BMath.TAU + 0.3
            var rr := 6.0 + BMath.ease_out(e / 0.4) * (16.0 + float(k % 3) * 8.0)
            tongue(r, T.x + cos(a) * rr, T.y + sin(a) * rr * 0.6, (20.0 + float(k % 4) * 6.0) * burst, 4.0 * burst + 0.5, t, float(k), burst + 0.2, burst * 0.55)
        for df in _debris:
            var dd: Dictionary = df
            var tb := (2.0 * float(dd.vz)) / 320.0
            var z: float
            var ee := e
            if ee < tb:
                z = float(dd.vz) * ee - 160.0 * ee * ee
            else:
                var e2 := ee - tb
                z = maxf(0.0, float(dd.vz) * 0.3 * e2 - 160.0 * e2 * e2)
            var gx := T.x + cos(float(dd.a)) * BMath.fly(0.0, float(dd.v), 1.2, 0.0, ee)
            var gy := T.y + sin(float(dd.a)) * BMath.fly(0.0, float(dd.v), 1.2, 0.0, ee) * 0.6
            var k := BMath.clampf2(1.6 - e * 0.45)
            if k <= 0.0:
                continue
            r.disc(gx, gy - z, float(dd.s), fire(BMath.clampf2(heat + 0.35)), k * 1.3)
            if ee > tb:
                r.decal(gx, gy, Vector3(0.25, 0.04, 0.02), 0.8)
            r.px(gx, gy, Vector3.ZERO, 0.0)
        if e < 0.5:
            r.ring(T.x, T.y, BMath.ease_out(e / 0.5) * 70.0, 2, fire(0.8), (1.0 - e / 0.5) * 1.5, BRenderer.ADD, 0.62)

func post(r: BRenderer, t: float) -> void:
    var e := t - TI
    var cx := 0.0
    var cy := 0.0
    var rad := 0.0
    var amp := 0.0
    if e > 0.0:
        cx = r.target.x
        cy = r.target.y - 10.0
        rad = 60.0
        amp = 1.6 * exp(-e * 0.6)
    elif t > 0.6:
        var h := head(t)
        cx = h.x
        cy = h.y - h.z - 10.0
        rad = 22.0
        amp = 1.0
    if amp > 0.1:
        var ccx := cx
        var ccy := cy
        var rrad := rad
        var aamp := amp
        var tt := t
        r.warp(cx - rad, cy - rad, cx + rad, cy + rad, func(x: int, y: int) -> Array:
            var d := Vector2(float(x) - ccx, float(y) - ccy).length() / rrad
            if d > 1.0:
                return [float(x), float(y)]
            return [float(x) + sin(float(y) * 0.7 + tt * 24.0) * aamp * (1.0 - d), float(y) + cos(float(x) * 0.5 + tt * 17.0) * aamp * 0.5 * (1.0 - d)])
