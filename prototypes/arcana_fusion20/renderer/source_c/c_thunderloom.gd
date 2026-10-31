## Faithful port of original C thunderloom (src/spells/tempest.ts,
## spell index 9 -> stage seed Rng(1000 + 9*7919) = 72271).
## Woven magnetic threads wind/reverse into one spear at TSP=4.8 onto
## authored TARGETS[0]=(262,106). Duration 7.4, climax 4.84 (source).
## NOTE: original spark() uses Math.random (nondeterministic even
## between original runs). Port substitutes a dedicated CRng(999) in
## the same call order; the Node reference harness patches Math.random
## with the identical generator. Documented, distribution preserved.
extends RefCounted
class_name CThunderloom

const DURATION := 7.4
const CLIMAX := 4.84
const TSP := 4.8
const TG := Vector2(262, 106)
const CORE := Vector3(0.92, 0.96, 1.0)
const HALO := Vector3(0.28, 0.4, 1.0)
const GHOST := Vector3(0.34, 0.2, 0.7)
const VIO := Vector3(0.6, 0.4, 1.0)

var _rng: CMath.CRng
var _spark_rng: CMath.CRng
var _threads: Array = []
var _orbs: Array = []
var _fract: Array = []
var _chans: Array = []
var _reig: Array = []
var _ps: Array = []
var _om := 0.0
var _scale := 1.0
var _struck := false
var _sc := Vector2.ZERO
var fx_shake := 0.0
var fx_kick := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0

func _spark(x: float, y: float, n: int, sp: float = 120.0, z: float = 0.0) -> void:
    for i in range(n):
        var a := _spark_rng.r(0.0, CMath.TAU)
        var s := sp * (0.3 + _spark_rng.next())
        _ps.append(CKit.pt_defaults({"x": x, "y": y, "z": z, "vx": cos(a) * s, "vy": sin(a) * s * 0.7,
            "vz": 30.0 if z != 0.0 else 0.0, "grav": 120.0 if z != 0.0 else 0.0, "drag": 3.5,
            "kind": "spark", "col": CPalette.P["volt"], "max": 0.2 + _spark_rng.next() * 0.4, "k": 1.1}))

static func _flick(seed: float, t: float, fps: float = 30.0) -> float:
    return CMath.hash1(int(seed * 97.0) + floori(t * fps))

func setup() -> void:
    CPalette._ensure()
    _rng = CMath.CRng.new(72271)
    _spark_rng = CMath.CRng.new(999)
    _ps.clear()
    _struck = false
    _om = 0.0
    _scale = 1.0
    _sc = Vector2(TG.x - 4.0, 62.0)
    _threads.clear()
    var pq := [[2, 3], [3, 2], [1, 3], [3, 4], [2, 5], [1, 2]]
    for k in range(6):
        _threads.append({"p": pq[k][0], "q": pq[k][1], "R": 17.0 + float(k) * 4.5, "r": 5.0 + float(k) * 1.3,
            "ph": _rng.r(0.0, CMath.TAU), "dir": 1.0 if k % 2 else -1.0, "t0": 0.6 + float(k) * 0.28})
    _orbs.clear()
    for k in range(4):
        _orbs.append({"r": 9.0 + float(k) * 5.0, "a": _rng.r(0.0, CMath.TAU), "dir": 1.0 if k % 2 else -1.0})
    _fract.clear()
    for k in range(11):
        var a := float(k) / 11.0 * CMath.TAU + _rng.r(-0.2, 0.2)
        var l := _rng.r(18.0, 48.0)
        _fract.append(CKit.bolt_tree(float(_rng.i(1, 9999)), TG.x, TG.y, TG.x + cos(a) * l, TG.y + sin(a) * l * 0.65, 2, 0.3))
    _chans.clear()
    for k in range(9):
        _chans.append(CKit.grow_tree(_rng, {"x": TG.x, "y": TG.y, "ang": float(k) / 9.0 * CMath.TAU + _rng.r(-0.3, 0.3),
            "step": 6.0, "steps": 14, "speed": 520.0, "branch": 0.35, "spread": 0.7, "jitter": 0.5,
            "maxDepth": 2, "t0": TSP + 0.02, "sy": 0.7}))
    _reig.clear()
    for d in [0.55, 0.85, 1.2, 1.5, 1.9, 2.3]:
        _reig.append({"t": TSP + d, "c": _rng.i(0, 8), "s": 0, "done": false})

func authored_events() -> Array:
    var ev: Array = [
        {"t": 0.6, "kind": "threads_open", "pos_local": Vector2(_sc), "emitted": false},
        {"t": 2.0, "kind": "orbs_join", "pos_local": Vector2(_sc), "emitted": false},
        {"t": 4.38, "kind": "collapse", "pos_local": Vector2(_sc), "emitted": false},
        {"t": TSP, "kind": "spear_impact", "pos_local": Vector2(TG), "emitted": false},
    ]
    for r in _reig:
        ev.append({"t": float(r.t), "kind": "reignition", "pos_local": Vector2(TG), "emitted": false})
    ev.append({"t": 6.9, "kind": "aftermath_decay", "pos_local": Vector2(TG), "emitted": false})
    return ev

func _tp(th: Dictionary, s: float, t: float) -> Vector3:
    var rr := float(th.R) + float(th.r) * cos(float(th.q) * s)
    var a := float(th.p) * s + float(th.ph) + float(th.dir) * t * 0.4
    var x := rr * cos(a)
    var y := rr * sin(a)
    var z := float(th.r) * sin(float(th.q) * s)
    var c := cos(_om)
    var si := sin(_om)
    var rx := x * c - y * si
    var ry := x * si + y * c
    return Vector3(_sc.x + rx * _scale * 1.75, _sc.y + ry * 0.6 * _scale - z * 1.1 * _scale, ry)

func update(dt: float, t: float) -> void:
    CKit.particles_update(_ps, dt)
    var w := 0.6 + 7.5 * pow(CMath.inv(1.8, 4.2, t), 2.0)
    if t > 4.2:
        w = CMath.lerp(w, -14.0, CMath.inv(4.2, 4.38, t))
    _om += w * dt
    for o in _orbs:
        o.a = float(o.a) + float(o.dir) * (2.0 + 9.0 * pow(CMath.inv(2.0, 4.2, t), 2.0)) * dt * (-1.5 if t > 4.25 else 1.0)
    _scale = 1.0 - CMath.ease_in(CMath.inv(4.38, 4.78, t), 2.5)
    if not _struck and t >= TSP:
        _struck = true
        fx_shake = maxf(fx_shake, 9.0)
        fx_flash = Vector3(0.85, 0.9, 1.0)
        fx_flash_k = maxf(fx_flash_k, 0.6)
        fx_kick = maxf(fx_kick, 4.5)
        _spark(TG.x, TG.y, 60, 200.0, 2.0)
        for i in range(40):
            _ps.append(CKit.pt_defaults({"x": TG.x, "y": TG.y, "vx": _rng.r(-80.0, 80.0), "vy": _rng.r(-60.0, 60.0),
                "vz": _rng.r(40.0, 140.0), "grav": 260.0, "bounce": 0.3, "kind": "dust", "col": CPalette.P["volt"],
                "k": 0.8, "c": Vector3(0.1, 0.1, 0.15), "max": _rng.r(1.0, 2.0)}))
    for r in _reig:
        if not bool(r.done) and t >= float(r.t):
            r.done = true
            var ch: Array = _chans[int(r.c)]
            var s: Dictionary = ch[_rng.i(0, ch.size() - 1)]
            r.s = ch.find(s)
            _spark(float(s.x1), float(s.y1), 10, 70.0)

func render(f: CFrame, t: float) -> void:
    var dark := CMath.inv(0.0, 1.4, t) * (1.0 - CMath.inv(TSP, TSP + 0.4, t))
    f.shade_disc(TG.x, TG.y, 46.0 * dark + 2.0, 1.0 - 0.55 * dark, 0.55, 4.0)
    if t < TSP:
        var cl := dark * (0.75 + 0.25 * CMath.inv(4.3, 4.75, t))
        f.disc(_sc.x, _sc.y, 92.0 * maxf(_scale, 0.3), func(x: int, y: int, d: float) -> void:
            var n := CMath.noise3(float(x) * 0.08, float(y) * 0.12, t * 0.4)
            if CMath.cl01((1.0 - d) * 1.6) * (0.5 + n * 0.6) * cl > CMath.bayer(x, y):
                f.I(x, y, 0.025, 0.025, 0.06, 0.9), 0.6)
        if t > 4.38:
            f.field(0, 0, CFrame.W - 1, CFrame.H - 1, func(x: int, y: int) -> void: f.S(x, y, 1.0 - 0.6 * CMath.inv(4.38, 4.75, t)))
        var slot := floori(t * 20.0)
        var disch := 1.0 if CMath.hash1(slot * 3) > 0.5 else 0.0
        for th in _threads:
            var rv := CMath.cl01((t - float(th.t0)) / 0.8)
            if rv <= 0.0:
                continue
            var n := floori(140.0 * rv)
            for j in range(n):
                var p := _tp(th, float(j) / 140.0 * CMath.TAU, t)
                var dash := (j + floori(t * 24.0)) % 5 < 3
                var bead := j % 18 == 0
                var depth := 1.0 if p.z > 0.0 else 0.5
                if dash or bead:
                    f.Lc(p.x, p.y, CORE if bead else (HALO if j % 2 else VIO), (1.1 if bead else 0.5 + disch * 0.5) * depth * (0.5 + CMath.inv(1.0, 4.0, t) * 0.8))
        for k in range(3):
            if CMath.hash1(slot * 7 + k) < 0.45 or _scale < 0.3:
                continue
            var A: Dictionary = _threads[floori(CMath.hash1(slot + k * 3) * 6.0)]
            var B: Dictionary = _threads[floori(CMath.hash1(slot * 2 + k) * 6.0)]
            var pa := _tp(A, CMath.hash1(slot * 5 + k) * CMath.TAU, t)
            var pb := _tp(B, CMath.hash1(slot * 11 + k) * CMath.TAU, t)
            if Vector2(pa.x - pb.x, pa.y - pb.y).length() > 34.0:
                continue
            CKit.draw_bolt(f, CKit.bolt_pts(float(slot * 31 + k), pa.x, pa.y, pb.x, pb.y, 0.4, 2.0), 1.3, CORE, HALO, 1.2)
            f.glow((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0, 12.0, HALO, 0.6, 3.0)
        for o in _orbs:
            var g := CMath.inv(2.0, 2.6, t)
            if g <= 0.0:
                continue
            var x := _sc.x + cos(float(o.a)) * float(o.r) * _scale * 1.75
            var y := _sc.y + sin(float(o.a)) * float(o.r) * 0.6 * _scale
            f.disc_l(x, y, 1.6, CORE, 1.5 * g)
            f.glow(x, y, 8.0, HALO, 0.6 * g, 3.0)
        if floori(t * 30.0) % 2 == 0 and CMath.hash1(floori(t * 30.0)) > 0.6:
            var x := _sc.x + (CMath.hash1(slot * 13) - 0.5) * 100.0
            var y := _sc.y + (CMath.hash1(slot * 17) - 0.5) * 40.0
            f.L(x, y, 1.5, 1.6, 2.0)
            f.Lc(x + 1.0, y, HALO, 0.6)
            f.Lc(x - 1.0, y, HALO, 0.6)
            f.Lc(x, y + 1.0, HALO, 0.6)
            f.Lc(x, y - 1.0, HALO, 0.6)
        if t > 4.38:
            var g := CMath.inv(4.38, 4.78, t)
            f.disc_l(_sc.x, _sc.y, 1.0 + g * 2.0, CORE, 1.0 + g * 3.0)
            f.glow(_sc.x, _sc.y, 6.0 + g * 14.0, CORE, g * 1.5, 3.0)
    else:
        var a := t - TSP
        if a < 0.45:
            var k := 5.0 if a < 0.08 else 4.0 * exp(-(a - 0.08) * 9.0)
            CKit.draw_bolt(f, CKit.bolt_pts(float(9 + floori(t * 30.0) % 2), TG.x, -4.0, TG.x, TG.y - 1.0, 0.035, 3.0), k, CORE, HALO, 2.4)
            if a < 0.1:
                f.field(0, 0, CFrame.W - 1, CFrame.H - 1, func(x: int, y: int) -> void: f.S(x, y, 0.4))
        if a < 0.15:
            f.disc_l(TG.x, TG.y, 8.0, CORE, 3.0)
        elif a < 0.6:
            f.ring_l(TG.x, TG.y, 8.0 + (a - 0.15) * 140.0, CORE, 1.2 * (1.0 - a / 0.6), 0.65)
        f.glow(TG.x, TG.y, 60.0, HALO, 1.6 * exp(-a * 3.0), 5.0, 0.7)
        for fr in _fract:
            CKit.draw_bolt_tree(f, fr, 1.8 * exp(-a * 2.2) + 0.15 * _flick(float(fr.size()), t, 15.0), CORE, HALO, CMath.cl01(a * 8.0))
        if a < 0.6:
            var slot := floori(t * 30.0)
            var dec := 1.0 - a / 0.6
            for y in range(CFrame.H):
                var h := CMath.hash1((y >> 2) + slot * 57)
                if h > 0.82:
                    var dx := (CMath.hash1(y * 3 + slot) - 0.5) * 16.0 * dec
                    for x in range(CFrame.W):
                        f.D(x, y, dx, 0.0)
                        if h > 0.95:
                            f.C(x, y, 3.0 * dec)
            CKit.shock(f, TG.x, TG.y, a * 220.0, 14.0, 7.0 * dec, 0.7, 2.0)
        var g := exp(-a * 1.1)
        for ch in _chans:
            for s in ch:
                if t < float(s.t0):
                    continue
                var u := CMath.cl01((t - float(s.t0)) / (float(s.t1) - float(s.t0)))
                f.line(float(s.x0), float(s.y0), CMath.lerp(float(s.x0), float(s.x1), u), CMath.lerp(float(s.y0), float(s.y1), u), func(x: int, y: int, _ss: float) -> void:
                    f.G(x, y, 0.04, 0.04, 0.08, 0.5)
                    if CMath.hash2(x, y + floori(t * 10.0)) < g:
                        f.Lc(x, y, GHOST if int(s.depth) != 0 else VIO, 0.5 * g))
        for r in _reig:
            var q := t - float(r.t)
            if q < 0.0 or q > 0.12 or not bool(r.done):
                continue
            var ch: Array = _chans[int(r.c)]
            var s0 := maxi(0, int(r.s) - 4)
            var pts: Array = []
            for s in ch.slice(s0, int(r.s) + 1):
                if int(s.depth) == int(ch[int(r.s)].depth):
                    pts.append(Vector2(float(s.x1), float(s.y1)))
            if pts.size() > 1:
                CKit.draw_bolt(f, pts, 1.6, CORE, HALO, 1.2)
            f.glow(float(ch[int(r.s)].x1), float(ch[int(r.s)].y1), 10.0, HALO, 0.8, 3.0)
    CKit.particles_render(f, _ps)
