## Faithful port of original C eventHorizon (src/spells/astral.ts:17-143).
## Stage seed for spell index 16: Rng(1000 + 16*7919) = 127704.
## Anchored at authored E=(250,106) in the 384x216 source buffer.
## blitBase adaptation: pristine floor is excluded (anti-compositing),
## so displaced "world fragments" composite as dark ink blocks — the
## VOID_INK home blocks and outlines remain authored. Documented diff.
## Duration 8.8, climax 6.45 (source constants preserved).
extends RefCounted
class_name CEventHorizon

const DURATION := 8.8
const CLIMAX := 6.45
const TD := 5.9
const TR := 6.25
const E := Vector2(250, 106)
const WHITE := Vector3.ONE
const CYAN := Vector3(0.45, 0.95, 1.0)
const MAG := Vector3(1.0, 0.35, 0.85)
const VOID_INK := Vector3(0.02, 0.01, 0.05)

var _rng: CMath.CRng
var _frs: Array = []
var _blocks: Array = []
var _ps: Array = []
var _rebound := false
var fx_shake := 0.0
var fx_kick := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0

static func _mass(t: float) -> float:
    return CMath.ease_in_out(CMath.inv(0.2, 3.0, t))

static func _rh(t: float) -> float:
    if t < 5.2:
        return 13.0 * CMath.ease_out(CMath.inv(1.0, 2.6, t))
    return CMath.lerp(13.0, 1.2, CMath.ease_in(CMath.inv(5.2, TD, t)))

static func _th_e(t: float) -> float:
    return 23.0 * _mass(t) * (1.0 + CMath.inv(5.2, TD, t) * 0.6 if t > 5.2 else 1.0)

static func _ring_scale(k: float, t: float) -> float:
    return 1.0 - CMath.ease_in(CMath.inv(5.25 + k * 0.14, 5.45 + k * 0.14, t))

func setup() -> void:
    CPalette._ensure()
    _rng = CMath.CRng.new(127704)
    _frs.clear()
    _ps.clear()
    _rebound = false
    _blocks.clear()
    for i in range(46):
        var a := _rng.r(0.0, CMath.TAU)
        var r := _rng.r(14.0, 80.0)
        var s := _rng.i(5, 10)
        _blocks.append({
            "hx": roundi(E.x + cos(a) * r * 1.2 - float(s) / 2.0),
            "hy": roundi(E.y + sin(a) * r * 0.8 - float(s) / 2.0),
            "s": s, "a": a, "A": _rng.r(30.0, 95.0), "w": _rng.r(0.8, 1.6)})

func authored_events() -> Array:
    return [
        {"t": 1.0, "kind": "horizon_open", "pos_local": Vector2(E), "emitted": false},
        {"t": 3.0, "kind": "accretion_peak", "pos_local": Vector2(E), "emitted": false},
        {"t": TD, "kind": "information_loss", "pos_local": Vector2(E), "emitted": false},
        {"t": TR, "kind": "rebound_impact", "pos_local": Vector2(E), "emitted": false},
        {"t": 7.6, "kind": "aftermath_decay", "pos_local": Vector2(E), "emitted": false},
    ]

func update(dt: float, t: float) -> void:
    CKit.particles_update(_ps, dt)
    var m := _mass(t)
    var gm := 8000.0 * m * (1.0 + CMath.inv(5.2, TD, t) * 5.0 if t > 5.2 else 1.0)
    var rh := _rh(t)
    if t > 1.2 and t < 5.3 and _rng.chance(0.35):
        var a := _rng.r(0.0, CMath.TAU)
        var r := _rng.r(45.0, 95.0)
        var v := sqrt(gm / r) * _rng.r(0.65, 0.95) * (1.0 if _rng.chance(0.75) else -1.0)
        _frs.append({"x": E.x + cos(a) * r, "y": E.y + sin(a) * r * 0.75,
            "vx": -sin(a) * v, "vy": cos(a) * v * 0.75, "tr": [], "hue": _rng.next()})
    if t < TD:
        var i := _frs.size() - 1
        while i >= 0:
            var p: Dictionary = _frs[i]
            var dx := E.x - float(p.x)
            var dy := E.y - float(p.y)
            var d2 := dx * dx + dy * dy
            var d := sqrt(d2)
            if d == 0.0:
                d = 1.0
            var acc := gm / (d2 + 40.0)
            p.vx = float(p.vx) + (dx / d) * acc * dt
            p.vy = float(p.vy) + (dy / d) * acc * dt
            var dr := exp(-dt * 0.22)
            p.vx = float(p.vx) * dr
            p.vy = float(p.vy) * dr
            p.x = float(p.x) + float(p.vx) * dt
            p.y = float(p.y) + float(p.vy) * dt
            (p.tr as Array).push_front(Vector2(float(p.x), float(p.y)))
            if (p.tr as Array).size() > 9:
                (p.tr as Array).pop_back()
            if d < rh + 1.5:
                _ps.append(CKit.pt_defaults({"x": float(p.x), "y": float(p.y), "kind": "pix", "c": WHITE, "k": 2.0, "max": 0.12}))
                _frs.remove_at(i)
            i -= 1
    else:
        _frs.clear()
    if not _rebound and t >= TR:
        _rebound = true
        fx_shake = 8.0
        fx_kick = 4.0
        fx_flash = Vector3(0.6, 0.4, 1.0)
        fx_flash_k = 0.4
        for i in range(90):
            var a := _rng.r(0.0, CMath.TAU)
            var s := _rng.r(60.0, 220.0)
            _ps.append(CKit.pt_defaults({"x": E.x, "y": E.y, "vx": cos(a) * s, "vy": sin(a) * s * 0.75,
                "drag": 1.6, "kind": "star", "col": CPalette.P["star"], "max": _rng.r(0.8, 1.8), "k": 1.0}))

func _disk(f: CFrame, t: float, front: bool, tilt: float, rot: float, sy: float, pal_a: bool, k0: float) -> void:
    var rh := _rh(t)
    if rh < 1.5 or k0 <= 0.0:
        return
    var r0 := rh * 1.5
    var r1 := rh * 4.6 * _ring_scale(3.0 if pal_a else 4.0, t)
    var ext := r1 + 2.0
    var c := cos(tilt)
    var s := sin(tilt)
    f.field(E.x - ext, E.y - ext, E.x + ext, E.y + ext, func(x: int, y: int) -> void:
        var dx := float(x) + 0.5 - E.x
        var dy := float(y) + 0.5 - E.y
        var ux := dx * c + dy * s
        var uy := (-dx * s + dy * c) / sy
        var rd := Vector2(ux, uy).length()
        if rd < r0 or rd > r1:
            return
        if (uy > 0.0) != front:
            return
        if not front and Vector2(dx, dy).length() < rh + 1.0:
            return
        var ad := atan2(uy, ux)
        var om := rot * 5.0 * pow(r0 / rd, 1.5)
        var ph := ad - om * t
        var n := CMath.noise3(rd * 0.28, cos(ph) * 2.2 + 5.0, sin(ph) * 2.2 + t * 0.15)
        var v := CMath.cl01((n - 0.35) * 1.8) * (1.0 - (rd - r0) / (r1 - r0))
        for k in range(3):
            var rk := rh * (1.9 + float(k) * 0.95) * _ring_scale(float(k), t)
            if absf(rd - rk) < 0.75 and fmod(fmod((ph * float(k + 2)) / CMath.TAU, 1.0) + 1.0, 1.0) < 0.62:
                v = maxf(v, 1.1)
        if v < 0.08:
            return
        var dop := 1.0 + 0.55 * cos(ad + (0.0 if pal_a else PI))
        var col := CPalette.ramp_d(CPalette.P["void"], 0.5 + v * 0.45, CMath.bayer(x, y)) if pal_a else Vector3(MAG.x * 0.8, MAG.y * 0.6, MAG.z)
        f.Lc(x, y, col, v * dop * k0 * (0.75 if pal_a else 0.45)))

func render(f: CFrame, t: float) -> void:
    if t >= TD and t < TR:
        f.field(0, 0, CFrame.W - 1, CFrame.H - 1, func(x: int, y: int) -> void: f.I(x, y, 0, 0, 0, 1.0))
        f.L(E.x, E.y, 1.4, 1.4, 1.6)
        return
    if t < TD:
        var m := _mass(t)
        var te := _th_e(t)
        var rh := _rh(t)
        var band := CMath.inv(2.4, 3.4, t) * (1.0 - CMath.inv(5.2, TD, t))
        f.field(E.x - 125.0, E.y - 110.0, E.x + 125.0, E.y + 110.0, func(x: int, y: int) -> void:
            var dx := float(x) + 0.5 - E.x
            var dy := (float(y) + 0.5 - E.y) / 0.85
            var d := Vector2(dx, dy).length()
            if d == 0.0:
                d = 0.01
            if d > 125.0:
                return
            var fall := CMath.cl01(1.0 - d / 125.0)
            var amt := minf(70.0, (te * te) / maxf(d, 2.0)) * fall
            var b: float = floor(d / 7.0)
            var off := fmod(fmod(t * 10.0 + b * 2.7, 7.0) + 7.0, 7.0) * band * fall
            f.D(x, y, (-dx / d) * amt + (dx / d) * off, ((-dy / d) * amt + (dy / d) * off) * 0.85)
            var dark := m * exp(-d / (16.0 + rh))
            f.S(x, y, 1.0 - 0.85 * dark)
            if d < rh + 7.0:
                f.L(x, y, -0.25 * m, -0.25 * m, -0.2 * m))
        _disk(f, t, false, 0.12, 1.0, 0.3, true, CMath.inv(1.5, 2.6, t))
        _disk(f, t, false, -0.62, -1.0, 0.5, false, CMath.inv(2.8, 3.8, t))
        if rh > 0.5:
            f.disc(E.x, E.y, rh, func(x: int, y: int, _d: float) -> void: f.I(x, y, 0, 0, 0, 1.0))
            f.ring(E.x, E.y, rh + 0.6, func(x: int, y: int, a: float) -> void: f.Lc(x, y, CPalette.ramp(CPalette.P["star"], 0.9), (1.1 + 0.6 * cos(a)) * m))
            for i in range(51):
                var a := PI + float(i) / 50.0 * PI
                f.Lc(E.x + cos(a) * rh * 1.45, E.y + sin(a) * rh * 1.2, CPalette.ramp(CPalette.P["void"], 0.85), 0.7 * CMath.inv(1.6, 2.8, t) * _ring_scale(0.0, t) * (0.6 + 0.4 * sin(a * 3.0 + t * 2.0)))
        _disk(f, t, true, 0.12, 1.0, 0.3, true, CMath.inv(1.5, 2.6, t))
        _disk(f, t, true, -0.62, -1.0, 0.5, false, CMath.inv(2.8, 3.8, t))
        for p in _frs:
            var tr: Array = p.tr
            for j in range(tr.size() - 1):
                f.line_l(tr[j].x, tr[j].y, tr[j + 1].x, tr[j + 1].y, CYAN if float(p.hue) > 0.7 else CPalette.ramp(CPalette.P["star"], 0.85), 0.9 * (1.0 - float(j) / float(tr.size())))
            f.Lc(float(p.x), float(p.y), WHITE, 1.2)
        if t > 5.2:
            f.disc_l(E.x, E.y, 1.0, WHITE, CMath.inv(5.6, TD, t) * 2.0)
    else:
        var a := t - TR
        for k in range(2):
            var r := (a - float(k) * 0.18) * 230.0
            if r > 0.0 and r < 320.0:
                CKit.shock(f, E.x, E.y, r, 22.0, 13.0 * (1.0 - r / 320.0), 0.85, 3.0)
                f.ring_l(E.x, E.y, r, CPalette.ramp(CPalette.P["void"], 0.8), 0.6 * (1.0 - r / 320.0), 0.85)
        var wob := 8.0 * exp(-a * 2.0) * cos(a * 12.0)
        if absf(wob) > 0.3:
            f.disc(E.x, E.y, 50.0, func(x: int, y: int, d: float) -> void:
                var dx := float(x) - E.x
                var dy := float(y) - E.y
                var l := Vector2(dx, dy).length()
                if l == 0.0:
                    l = 1.0
                f.D(x, y, (dx / l) * wob * (1.0 - d), (dy / l) * wob * (1.0 - d)))
        for b in _blocks:
            var q := a / 1.7
            if q >= 1.0:
                continue
            var o := float(b.A) * sin(PI * q) * exp(-q * 0.8)
            var bx := float(b.hx) + cos(float(b.a)) * o
            var by := float(b.hy) + sin(float(b.a)) * o * 0.8
            for yy in range(int(b.s)):
                for xx in range(int(b.s)):
                    f.I(float(b.hx + xx), float(b.hy + yy), VOID_INK.x, VOID_INK.y, VOID_INK.z, 1.0)
                    if CMath.hash2(b.hx + xx, b.hy + yy) > 0.96:
                        f.Lc(float(b.hx + xx), float(b.hy + yy), CPalette.ramp(CPalette.P["star"], 0.9), 0.8)
            # blitBase with zeroed base: displaced fragment = dark block
            for yy in range(int(b.s)):
                for xx in range(int(b.s)):
                    f.I(float(roundi(bx) + xx), float(roundi(by) + yy), 0, 0, 0, 1.0)
            f.poly_outline_l([Vector2(bx, by), Vector2(bx + float(b.s) - 1.0, by), Vector2(bx + float(b.s) - 1.0, by + float(b.s) - 1.0), Vector2(bx, by + float(b.s) - 1.0)], CPalette.ramp(CPalette.P["void"], 0.85), 0.4 * (1.0 - q))
        f.glow(E.x, E.y, 50.0, CPalette.ramp(CPalette.P["void"], 0.7), 0.45 * exp(-a * 3.0), 5.0)
    CKit.particles_render(f, _ps)
