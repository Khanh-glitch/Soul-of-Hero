## Faithful port of original C mirrorfrostBasilica (src/spells/tide.ts,
## spell index 6 -> stage seed Rng(1000 + 6*7919) = 48514).
## Cathedral of ice facets grows, pulses, then fails in sequence from a
## break point at TB=6.4. Duration 9.2, climax 6.62 (source constants).
## Adaptation: frost lattice writes CFrame.G (ground layer) which the
## anti-compositing transport zeroes — its light component remains;
## giving frost to the real SOH ground is the environmental pass (later).
extends RefCounted
class_name CMirrorfrostBasilica

const DURATION := 9.2
const CLIMAX := 6.62
const TB := 6.4
const Q := Vector2(244, 112)
const SY := 0.72
const LA := -2.3
const WHITE := Vector3.ONE

var _rng: CMath.CRng
var _fcts: Array = []
var _frost: Array = []
var _shards: Array = []
var _ps: Array = []
var _broke := false
var _bpt := Vector2.ZERO
var fx_shake := 0.0
var fx_kick := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0

static func _p2(r: float, a: float, h: float = 0.0) -> Vector2:
    return Vector2(Q.x + cos(a) * r * 1.08, Q.y + sin(a) * r * SY - h)

static func _sh(a: float) -> float:
    return 0.5 + 0.42 * cos(a - LA)

func _add(pts: Array, shade: float, birth: float, extra: Dictionary = {}) -> void:
    var cx := 0.0
    var cy := 0.0
    for p in pts:
        cx += p.x
        cy += p.y
    cx /= float(pts.size())
    cy /= float(pts.size())
    var fc := {"pts": pts, "shade": CMath.cl01(shade), "birth": birth, "cx": cx, "cy": cy,
        "seed": float(_fcts.size() * 7 + 3), "tb": 0.0, "broke": false}
    for k in extra.keys():
        fc[k] = extra[k]
    _fcts.append(fc)

func setup() -> void:
    CPalette._ensure()
    _rng = CMath.CRng.new(48514)
    _fcts.clear()
    _shards.clear()
    _ps.clear()
    _broke = false
    var sec: Array = []
    for i in range(6):
        sec.append(_rng.r(0.0, 0.35))
    var apex := _p2(0.0, 0.0, 9.0)
    for k in range(12):
        var a0 := float(k) / 12.0 * CMath.TAU
        var a1 := float(k + 1) / 12.0 * CMath.TAU
        _add([apex, _p2(17.0, a0), _p2(17.0, a1)], _sh((a0 + a1) / 2.0), 1.3 + float(k) * 0.05 + _rng.r(0.0, 0.05))
    for k in range(6):
        var a := (float(k) + 0.5) / 6.0 * CMath.TAU
        var b := 2.0 + float(k) * 0.12 + float(sec[k])
        var in1 := _p2(19.0, a - 0.22)
        var in2 := _p2(19.0, a + 0.22)
        var s1 := _p2(33.0, a - 0.3)
        var s2 := _p2(33.0, a + 0.3)
        var tip := _p2(48.0, a)
        var ridge := _p2(30.0, a, 6.0)
        _add([in1, ridge, tip, s1], _sh(a - 0.5), b, {"hole": [_p2(24.0, a - 0.13), _p2(29.0, a - 0.04, 3.0), _p2(29.0, a - 0.17)]})
        _add([in2, s2, tip, ridge], _sh(a + 0.5), b + 0.06, {"hole": [_p2(24.0, a + 0.13), _p2(29.0, a + 0.17), _p2(29.0, a + 0.04, 3.0)]})
    for k in range(6):
        var a := float(k) / 6.0 * CMath.TAU
        _add([_p2(24.0, a), _p2(38.0, a - 0.13), _p2(41.0, a, 4.0), _p2(38.0, a + 0.13)], _sh(a), 2.8 + float(k) * 0.05 + float(sec[k]) * 0.5)
    for k in range(12):
        var a := float(k) / 12.0 * CMath.TAU + 0.12
        var h := _rng.r(12.0, 22.0)
        var r1 := _rng.r(64.0, 76.0)
        var b := 3.2 + float(k) * 0.07 + float(sec[k % 6]) * 0.6
        var bl := _p2(48.0, a - 0.07)
        var br := _p2(48.0, a + 0.07)
        var m := _p2(51.0, a, 3.0)
        var tip := _p2(r1, a, h)
        _add([bl, m, tip], _sh(a - 0.6), b, {"spire": {"base": _p2(50.0, a), "tip": _p2(r1, a)}})
        _add([m, br, tip], _sh(a + 0.6), b + 0.04)
    for k in range(20):
        var a := float(k) / 20.0 * CMath.TAU + 0.05
        var c := _p2(84.0 + float(k % 2) * 4.0, a)
        var pts: Array = []
        for i in range(6):
            pts.append(Vector2(c.x + cos(float(i) * CMath.TAU / 6.0) * 3.0, c.y + sin(float(i) * CMath.TAU / 6.0) * 2.4))
        _add(pts, _sh(a + 1.0), 3.7 + _rng.r(0.0, 0.6))
    _frost.clear()
    for k in range(6):
        _frost.append_array(CKit.grow_tree(_rng, {"x": Q.x, "y": Q.y, "ang": float(k) / 6.0 * CMath.TAU + 0.26,
            "step": 3.6, "steps": 18, "speed": 48.0 + _rng.r(0.0, 18.0), "branch": 0.42, "spread": PI / 3.0,
            "jitter": 0.2, "maxDepth": 2, "sy": SY, "snap": PI / 6.0}))
    var spires := _fcts.filter(func(fc: Dictionary) -> bool: return fc.has("spire"))
    _bpt = spires[3].spire.tip
    for fc in _fcts:
        fc.tb = TB + Vector2(float(fc.cx) - _bpt.x, float(fc.cy) - _bpt.y).length() / 165.0 + CMath.hash1(int(fc.seed)) * 0.05

func authored_events() -> Array:
    return [
        {"t": 1.3, "kind": "dome_rise", "pos_local": Vector2(Q), "emitted": false},
        {"t": 3.2, "kind": "spires_rise", "pos_local": Vector2(Q), "emitted": false},
        {"t": 4.4, "kind": "pulse", "pos_local": Vector2(Q), "emitted": false},
        {"t": TB, "kind": "fracture_impact", "pos_local": Vector2(_bpt), "emitted": false},
        {"t": 7.9, "kind": "aftermath_dissolve", "pos_local": Vector2(Q), "emitted": false},
    ]

func _pulse(x: float, y: float, t: float) -> float:
    var v := 0.0
    for p0 in [4.4, 4.95, 5.5]:
        var r := (t - p0) * 150.0
        if r < 0.0 or r > 120.0:
            continue
        var d := Vector2(x - Q.x, (y - Q.y) / SY).length() - r
        v += exp(-(d * d) / 40.0) * (1.0 - r / 120.0)
    return v

func update(dt: float, t: float) -> void:
    CKit.particles_update(_ps, dt)
    if not _broke and t >= TB:
        _broke = true
        fx_shake = maxf(fx_shake, 3.0)
        fx_kick = maxf(fx_kick, 2.0)
        fx_flash = Vector3(0.7, 0.9, 1.0)
        fx_flash_k = maxf(fx_flash_k, 0.3)
    for fc in _fcts:
        if not bool(fc.broke) and t >= float(fc.tb):
            fc.broke = true
            var pts: Array = fc.pts
            var n := pts.size()
            var dx := float(fc.cx) - _bpt.x
            var dy := float(fc.cy) - _bpt.y
            var l := Vector2(dx, dy).length()
            if l == 0.0:
                l = 1.0
            for i in range(n):
                var a: Vector2 = pts[i]
                var b: Vector2 = pts[(i + 1) % n]
                var cx := (a.x + b.x + float(fc.cx)) / 3.0
                var cy := (a.y + b.y + float(fc.cy)) / 3.0
                var sp := _rng.r(25.0, 95.0)
                var out := Vector2(cx - Q.x, cy - Q.y)
                var ol := out.length()
                if ol == 0.0:
                    ol = 1.0
                var rel: Array = []
                for p in [a, b, Vector2(float(fc.cx), float(fc.cy))]:
                    rel.append(Vector2(p.x - cx, p.y - cy))
                _shards.append({"pts": rel, "x": cx, "y": cy, "z": 0.0,
                    "vx": (dx / l) * sp * 0.6 + (out.x / ol) * sp * 0.6,
                    "vy": (dy / l) * sp * 0.5 + (out.y / ol) * sp * 0.5,
                    "vz": _rng.r(20.0, 100.0), "rot": 0.0, "spin": _rng.r(-7.0, 7.0),
                    "shade": float(fc.shade), "life": 0.0, "max": _rng.r(1.4, 2.4)})
            for k in range(4):
                _ps.append(CKit.pt_defaults({"x": float(fc.cx), "y": float(fc.cy), "vx": _rng.r(-60.0, 60.0), "vy": _rng.r(-50.0, 30.0),
                    "drag": 2.5, "kind": "star", "col": CPalette.P["ice"], "max": _rng.r(0.5, 1.3), "k": 1.0}))
            if _rng.chance(0.15):
                fx_shake = maxf(fx_shake, 2.0)
    var i := _shards.size() - 1
    while i >= 0:
        var s: Dictionary = _shards[i]
        s.life = float(s.life) + dt
        if float(s.life) > float(s.max):
            _shards.remove_at(i)
            i -= 1
            continue
        s.vz = float(s.vz) - 230.0 * dt
        s.x = float(s.x) + float(s.vx) * dt
        s.y = float(s.y) + float(s.vy) * dt
        s.z = float(s.z) + float(s.vz) * dt
        s.rot = float(s.rot) + float(s.spin) * dt
        if float(s.z) < 0.0:
            s.z = 0.0
            s.vz = -float(s.vz) * 0.25
            s.vx = float(s.vx) * 0.5
            s.vy = float(s.vy) * 0.5
            s.spin = float(s.spin) * 0.5
        i -= 1

func render(f: CFrame, t: float) -> void:
    var dis := 1.0 - CMath.inv(6.7, 7.9, t)
    CKit.draw_tree(f, _frost, t, func(x: int, y: int, s: Dictionary, _age: float) -> void:
        if dis < CMath.bayer(x, y):
            return
        f.Gc(x, y, Vector3(0.55, 0.75, 0.9), 0.35)
        f.Lc(x, y, CPalette.ramp(CPalette.P["ice"], 0.75 - float(s.depth) * 0.15), 0.32 * (1.0 - float(s.depth) * 0.25)))
    for s in _frost:
        if t > float(s.t1) and CMath.hash1(roundi(float(s.x1) * 7.0 + float(s.y1))) > 0.8 and dis > 0.4:
            f.Lc(float(s.x1), float(s.y1), WHITE, 0.6)
            f.Lc(float(s.x1) + 1.0, float(s.y1), CPalette.ramp(CPalette.P["ice"], 0.7), 0.3)
            f.Lc(float(s.x1) - 1.0, float(s.y1), CPalette.ramp(CPalette.P["ice"], 0.7), 0.3)
            f.Lc(float(s.x1), float(s.y1) - 1.0, CPalette.ramp(CPalette.P["ice"], 0.7), 0.3)
            f.Lc(float(s.x1), float(s.y1) + 1.0, CPalette.ramp(CPalette.P["ice"], 0.7), 0.3)
    f.glow(Q.x, Q.y, 100.0, CPalette.ramp(CPalette.P["ice"], 0.55), 0.1 * CMath.inv(0.5, 4.0, t) * dis, 4.0, SY)
    for fc in _fcts:
        if not fc.has("spire") or bool(fc.broke) or t < float(fc.birth):
            continue
        var g := CMath.cl01((t - float(fc.birth)) / 0.4)
        var b: Vector2 = fc.spire.base
        var tp: Vector2 = fc.spire.tip
        var ex := tp.x + (tp.x - b.x) * 0.4 + 10.0
        var ey := tp.y + (tp.y - b.y) * 0.4 + 14.0
        f.poly([Vector2(b.x - 2.0, b.y), Vector2(b.x + 2.0, b.y), Vector2(CMath.lerp(b.x, ex, g), CMath.lerp(b.y, ey, g))],
            func(x: int, y: int) -> void: f.S(x, y, 0.62))
        f.line(b.x, b.y + 2.0, b.x + (tp.x - b.x) * 0.3 * g + 6.0, b.y + 26.0 * g, func(x: int, y: int, ss: float) -> void:
            if (1.0 - ss) * 0.8 > CMath.bayer(x, y):
                f.Lc(x, y, CPalette.ramp(CPalette.P["ice"], 0.8), 0.25))
    var order := _fcts.filter(func(fc: Dictionary) -> bool: return t >= float(fc.birth) - 0.3 and not bool(fc.broke))
    order.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.cy) < float(b.cy))
    var crack_l := CMath.inv(4.9, TB, t)
    for fc in order:
        if t < float(fc.birth):
            var q := 1.0 - (float(fc.birth) - t) / 0.3
            f.line_l(CMath.lerp(Q.x, float(fc.cx), q * 0.7), CMath.lerp(Q.y, float(fc.cy), q * 0.7),
                CMath.lerp(Q.x, float(fc.cx), q), CMath.lerp(Q.y, float(fc.cy), q), CPalette.ramp(CPalette.P["ice"], 0.9), 0.8)
            continue
        var sc := CMath.back_out(CMath.cl01((t - float(fc.birth)) / 0.32), 2.2)
        var pts: Array = []
        for p in fc.pts:
            pts.append(Vector2(float(fc.cx) + (p.x - float(fc.cx)) * sc, float(fc.cy) + (p.y - float(fc.cy)) * sc))
        var flash := maxf(0.0, 1.0 - (t - float(fc.birth)) / 0.25)
        var warn := 1.0 if t > float(fc.tb) - 0.25 else 0.0
        var hole: Array = fc.get("hole", [])
        f.poly(pts, func(x: int, y: int) -> void:
            if not hole.is_empty() and sc > 0.95 and CKit.pip(hole, float(x) + 0.5, float(y) + 0.5):
                f.S(x, y, 0.55)
                return
            var pv := _pulse(float(x), float(y), t)
            var sheen := 0.18 if (x * 2 + y * 3 + int(fc.seed)) % 13 == 0 else 0.0
            var c := CPalette.ramp_d(CPalette.P["ice"], float(fc.shade) * 0.72 + 0.1 + sheen + pv * 0.35 + flash * 0.4, CMath.bayer(x, y))
            f.Ic(x, y, c, 0.88)
            if pv > 0.1:
                f.Lc(x, y, CPalette.ramp(CPalette.P["ice"], 0.85), pv * 0.6))
        f.poly_outline_l(pts, CPalette.ramp(CPalette.P["ice"], 0.95), 0.32 + flash + warn * 0.6)
        if not hole.is_empty() and sc > 0.95:
            f.poly_outline_l(hole, CPalette.ramp(CPalette.P["ice"], 0.9), 0.5)
        var nc := floori(crack_l * (2.0 + 4.0 * CMath.hash1(int(fc.seed))))
        for k in range(nc):
            var n := pts.size()
            var e1 := floori(CMath.hash1(int(fc.seed) + k * 3) * float(n))
            var e2 := (e1 + 1 + floori(CMath.hash1(int(fc.seed) + k * 5) * float(n - 1))) % n
            var u1 := CMath.hash1(int(fc.seed) + k * 7)
            var u2 := CMath.hash1(int(fc.seed) + k * 11)
            var a := pts[e1].lerp(pts[(e1 + 1) % n], u1)
            var b := pts[e2].lerp(pts[(e2 + 1) % n], u2)
            f.line_l(a.x, a.y, b.x, b.y, WHITE, 0.35 + warn * 0.8 + 0.2 * sin(t * 30.0 + float(k)))
    if t >= TB:
        var r := (t - TB) * 165.0
        if r < 220.0:
            f.ring_l(_bpt.x, _bpt.y, r, WHITE, 0.8, 0.8)
            CKit.shock(f, _bpt.x, _bpt.y, r, 8.0, 4.0, 0.8, 1.5)
        if t - TB < 0.15:
            f.glow(_bpt.x, _bpt.y, 14.0, WHITE, 2.0, 3.0)
    for s in _shards:
        var u := float(s.life) / float(s.max)
        var sq := cos(float(s.rot) * 0.7)
        var pts: Array = []
        for p in s.pts:
            var c := cos(float(s.rot))
            var si := sin(float(s.rot))
            pts.append(Vector2(float(s.x) + (p.x * c - p.y * si), float(s.y) - float(s.z) + (p.x * si + p.y * c) * sq))
        if float(s.z) > 1.0:
            f.S(float(s.x), float(s.y), 0.6)
        var gl := maxf(0.0, sin(float(s.rot) * 2.3))
        f.poly(pts, func(x: int, y: int) -> void: f.Id(x, y, CPalette.ramp_d(CPalette.P["ice"], float(s.shade) * 0.6 + 0.2 + gl * 0.4, CMath.bayer(x, y)), 1.0 - u * u))
        if gl > 0.8:
            f.Lc(pts[0].x, pts[0].y, WHITE, 1.2 * (1.0 - u))
    CKit.particles_render(f, _ps)
