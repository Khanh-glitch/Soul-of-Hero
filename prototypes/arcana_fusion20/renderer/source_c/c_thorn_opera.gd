## Faithful port of original C thornOpera (src/spells/verdant.ts,
## spell index 14 -> stage seed Rng(1000 + 14*7919) = 111866).
## Five verlet tendrils with authored choreography visit the four
## authored TARGETS, curl into a bud at FOCUS=(252,112), bloom at
## TB=5.85 with lashes. Duration 8.4, climax 6.0 (source constants).
extends RefCounted
class_name CThornOpera

const DURATION := 8.4
const CLIMAX := 6.0
const M := 24
const LS := 6.2
const TB := 5.85
const CASTER := Vector2(112, 126)
const TARGETS := [Vector2(262, 106), Vector2(306, 156), Vector2(214, 164), Vector2(312, 62)]
const FZ := Vector2(252, 112)
const GOLD := Vector3(1.0, 0.85, 0.4)

var _rng: CMath.CRng
var _tds: Array = []
var _lashes: Array = []
var _ps: Array = []
var _bloomed := false
var fx_shake := 0.0
var fx_kick := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0

static func flower(f: CFrame, x: float, y: float, g: float, rot: float, size: float = 4.0, pal: Array = []) -> void:
    if g <= 0.0:
        return
    if pal.is_empty():
        pal = CPalette.P["bloom"]
    for k in range(5):
        var a := rot + float(k) / 5.0 * CMath.TAU
        f.ribbon([Vector2(x, y), Vector2(x + cos(a) * size * g, y + sin(a) * size * g * 0.8)], [0.6, 1.7 * g],
            func(px: int, py: int, _s: float, e: float) -> void: f.Ic(px, py, CPalette.ramp(pal, 0.45 if absf(e) > 0.6 else 0.75), 1.0))
    f.Ic(x, y, CPalette.ramp(CPalette.P["gold"], 0.8), 1.0)
    f.Lc(x, y, GOLD, 0.5 * g)
    f.glow(x, y, size * 2.5, CPalette.ramp(pal, 0.7), 0.25 * g, 3.0)

func setup() -> void:
    CPalette._ensure()
    _rng = CMath.CRng.new(111866)
    _ps.clear()
    _bloomed = false
    _tds.clear()
    var angs := [-1.15, -0.55, 0.05, 0.6, 1.2]
    var ks := [26.0, 13.0, 9.0, 17.0, 5.5]
    for i in range(5):
        var a: float = angs[i]
        var base := Vector2(CASTER.x + 4.0 + cos(a) * 6.0, CASTER.y + sin(a) * 4.0 + 1.0)
        var pos: Array = []
        var prev: Array = []
        for j in range(M):
            pos.append(Vector2(base))
            prev.append(Vector2(base))
        _tds.append({"a": a, "i": i, "base": base, "pos": pos, "prev": prev, "tip": Vector2(base), "k": ks[i]})
    _lashes.clear()
    for k in range(3):
        _lashes.append({"t": TB + 0.04 + float(k) * 0.1, "a0": -2.4 + float(k) * 1.9 + _rng.r(-0.3, 0.3),
            "dir": -1.0 if k % 2 else 1.0, "r": 50.0 + float(k) * 10.0})

func authored_events() -> Array:
    return [
        {"t": 0.75, "kind": "tendrils_open", "pos_local": Vector2(CASTER), "emitted": false},
        {"t": 1.5, "kind": "tendril_touch", "pos_local": Vector2(TARGETS[0]), "emitted": false},
        {"t": 2.7, "kind": "choreography_shift", "pos_local": Vector2(CASTER), "emitted": false},
        {"t": 4.9, "kind": "bud_form", "pos_local": Vector2(FZ), "emitted": false},
        {"t": TB, "kind": "bloom_impact", "pos_local": Vector2(FZ), "emitted": false},
        {"t": 6.2, "kind": "lash", "pos_local": Vector2(FZ), "emitted": false},
        {"t": 7.6, "kind": "aftermath_fade", "pos_local": Vector2(FZ), "emitted": false},
    ]

func _cho(i: int, t: float) -> Vector2:
    var td: Dictionary = _tds[i]
    var b: Vector2 = td.base
    var rest := Vector2(b.x + cos(float(td.a)) * 55.0 + sin(t * 1.3 + float(i)) * 8.0, b.y + sin(float(td.a)) * 40.0 + cos(t * 1.1 + float(i) * 2.0) * 6.0)
    if t < 0.75:
        var g := CMath.ease_out(t / 0.75)
        var a := float(td.a) + (1.0 - g) * 2.5
        return Vector2(b.x + cos(a) * 34.0 * g, b.y + sin(a) * 26.0 * g)
    if t < 2.7:
        var q := (t - 0.75 - float(i) * 0.37) / 0.55
        if q < 0.0 or q > 1.0:
            return rest
        match i:
            0:
                return Vector2(TARGETS[0].x, TARGETS[0].y - 6.0) if q < 0.35 else rest
            1:
                if q < 0.3:
                    var a := q * 34.0
                    return Vector2(b.x + 26.0 + cos(a) * 14.0, b.y - 4.0 + sin(a) * 10.0)
                return Vector2(TARGETS[2].x, TARGETS[2].y - 5.0)
            2:
                if q < 0.45:
                    var u := q / 0.45
                    return Vector2(CMath.lerp(rest.x, TARGETS[1].x, u), CMath.lerp(rest.y, TARGETS[1].y, u) + sin(u * 14.0) * 22.0)
                return Vector2(TARGETS[1].x - 34.0, TARGETS[1].y - 30.0)
            3:
                if q < 0.5:
                    var a := CMath.lerp(-1.1, 1.0, q / 0.5)
                    return Vector2(CASTER.x + cos(a) * 112.0, CASTER.y + sin(a) * 80.0)
                return Vector2(CASTER.x + 60.0, CASTER.y - 44.0)
            4:
                if q < 0.45:
                    var u := q * 9.0
                    return Vector2(rest.x + sin(u) * 22.0, rest.y + sin(u * 2.0) * 12.0)
                return Vector2(TARGETS[3].x, TARGETS[3].y - 6.0)
    if t < 3.9:
        var u := CMath.ease_in_out(CMath.cl01((t - 2.7 - float(i >> 1) * 0.16) / 0.75))
        var a := CMath.lerp(1.1, -1.1, u) if i % 2 else CMath.lerp(-1.1, 1.1, u)
        return Vector2(CASTER.x + cos(a) * 118.0, CASTER.y + sin(a) * 86.0)
    if t < 4.7:
        var a := float(i - 2) * 0.42
        var r := 72.0 + 52.0 * absf(sin((t - 3.9) * PI * 2.5))
        return Vector2(CASTER.x + cos(a) * r, CASTER.y + sin(a) * r * 0.8)
    if t < TB:
        var q := CMath.inv(4.7, 5.6, t)
        var a := float(i) / 5.0 * CMath.TAU + (t - 4.7) * 3.2
        var r := 18.0 * (1.0 - q * 0.6)
        return Vector2(FZ.x + cos(a) * r, FZ.y + sin(a) * r * 0.75)
    if t < 6.5:
        var a := float(i) / 5.0 * CMath.TAU + 0.3
        return Vector2(FZ.x + cos(a) * 85.0, FZ.y + sin(a) * 62.0)
    return Vector2(b.x + cos(float(td.a)) * 30.0, b.y + sin(float(td.a)) * 18.0 + 10.0)

func update(dt: float, t: float) -> void:
    CKit.particles_update(_ps, dt)
    var grow := CMath.ease_out(CMath.inv(0.05, 0.8, t)) * (1.0 - 0.88 * CMath.inv(6.6, 8.0, t))
    var rl := LS * (0.12 + 0.88 * grow)
    for td in _tds:
        var tg := _cho(int(td.i), t)
        var k := float(td.k) * 1.6 if (t > 0.75 and t < 2.7) else (30.0 if (t > TB and t < 6.2) else float(td.k))
        var tip: Vector2 = td.tip
        tip += (tg - tip) * (1.0 - exp(-dt * k))
        td.tip = tip
        var P2: Array = td.pos
        var PV: Array = td.prev
        for j in range(1, M):
            var vx := (P2[j].x - PV[j].x) * 0.93
            var vy := (P2[j].y - PV[j].y) * 0.93
            PV[j] = Vector2(P2[j])
            P2[j] = Vector2(P2[j].x + vx, P2[j].y + vy)
        var tip_prev := Vector2(PV[M - 1])
        P2[M - 1] = Vector2(P2[M - 1].x + (tip.x - P2[M - 1].x) * 0.3, P2[M - 1].y + (tip.y - P2[M - 1].y) * 0.3)
        for it in range(10):
            P2[0] = Vector2(td.base)
            for j in range(M - 1):
                var a: Vector2 = P2[j]
                var b: Vector2 = P2[j + 1]
                var dx := b.x - a.x
                var dy := b.y - a.y
                var d := Vector2(dx, dy).length()
                if d == 0.0:
                    d = 1e-4
                var df := (d - rl) / d
                if j == 0:
                    P2[j + 1] = Vector2(b.x - dx * df, b.y - dy * df)
                else:
                    P2[j] = Vector2(a.x + dx * df * 0.5, a.y + dy * df * 0.5)
                    P2[j + 1] = Vector2(b.x - dx * df * 0.5, b.y - dy * df * 0.5)
            for j in range(M - 2):
                var a: Vector2 = P2[j]
                var c: Vector2 = P2[j + 2]
                var dx := c.x - a.x
                var dy := c.y - a.y
                var d := Vector2(dx, dy).length()
                if d == 0.0:
                    d = 1e-4
                if d < rl * 1.55:
                    var df := (d - rl * 1.55) / d * 0.25
                    if j > 0:
                        P2[j] = Vector2(a.x + dx * df, a.y + dy * df)
                    P2[j + 2] = Vector2(c.x - dx * df, c.y - dy * df)
        var sp := (Vector2(P2[M - 1]) - tip_prev).length() / dt
        if sp > 230.0 and _rng.chance(0.5):
            _ps.append(CKit.pt_defaults({"x": P2[M - 2].x, "y": P2[M - 2].y, "z": 3.0,
                "vx": (P2[M - 1].x - tip_prev.x) / dt * 0.25 + _rng.r(-20.0, 20.0),
                "vy": (P2[M - 1].y - tip_prev.y) / dt * 0.25 + _rng.r(-20.0, 20.0),
                "vz": _rng.r(10.0, 40.0), "grav": 18.0, "drag": 1.2, "spin": _rng.r(-8.0, 8.0),
                "kind": "petal", "col": CPalette.P["leaf"] if _rng.chance(0.5) else CPalette.P["bloom"], "max": _rng.r(1.2, 2.2)}))
    if not _bloomed and t >= TB:
        _bloomed = true
        fx_shake = maxf(fx_shake, 7.0)
        fx_kick = maxf(fx_kick, 2.0)
        fx_flash = Vector3(1.0, 0.6, 0.8)
        fx_flash_k = maxf(fx_flash_k, 0.25)
        for i in range(230):
            var a := _rng.r(0.0, CMath.TAU)
            var s := _rng.r(20.0, 150.0)
            _ps.append(CKit.pt_defaults({"x": FZ.x + cos(a) * 6.0, "y": FZ.y + sin(a) * 4.0, "z": _rng.r(4.0, 14.0),
                "vx": cos(a) * s, "vy": sin(a) * s * 0.7, "vz": _rng.r(10.0, 60.0), "grav": 16.0, "drag": 1.4,
                "spin": _rng.r(-9.0, 9.0), "kind": "petal", "col": CPalette.P["bloom"], "max": _rng.r(1.8, 3.4),
                "k": 1.0, "delay": _rng.r(0.0, 0.3)}))

func render(f: CFrame, t: float) -> void:
    for td in _tds:
        var pts := CMath.catmull(td.pos, 2)
        var n := pts.size()
        var ws: Array = []
        for j in range(n):
            ws.append(CMath.lerp(3.6, 0.7, float(j) / float(n - 1)))
        var shifted: Array = []
        for p in pts:
            shifted.append(Vector2(p.x + 1.0, p.y + 2.0))
        f.ribbon(shifted, ws, func(x: int, y: int, _s: float, _e: float) -> void: f.S(x, y, 0.62))
        f.ribbon(pts, ws, func(x: int, y: int, _s: float, e: float) -> void:
            var tone := 0.08 if absf(e) > 0.82 else (0.68 if e < -0.4 else (0.3 if e > 0.45 else 0.5))
            f.Ic(x, y, CPalette.ramp(CPalette.P["leaf"], tone), 1.0)
            if absf(e) < 0.2:
                f.Lc(x, y, CPalette.ramp(CPalette.P["leaf"], 0.85), 0.1))
        var j := 2
        while j < M - 1:
            var p: Vector2 = td.pos[j]
            var a: Vector2 = td.pos[j - 1]
            var b: Vector2 = td.pos[j + 1]
            var tx := b.x - a.x
            var ty := b.y - a.y
            var tl := Vector2(tx, ty).length()
            if tl == 0.0:
                tl = 1.0
            var ux := tx / tl
            var uy := ty / tl
            var sd := 1.0 if j % 4 < 2 else -1.0
            var nx := -uy * sd
            var ny := ux * sd
            var w := CMath.lerp(3.6, 0.7, float(j) / float(M - 1))
            var len := 2.4 + 2.0 * (1.0 - float(j) / float(M))
            var bx := p.x + nx * w * 0.8
            var by := p.y + ny * w * 0.8
            var tip := Vector2(bx + (nx * 0.85 - ux * 0.55) * len, by + (ny * 0.85 - uy * 0.55) * len)
            f.poly_i([Vector2(bx - ux * 1.3, by - uy * 1.3), Vector2(bx + ux * 1.3, by + uy * 1.3), tip], CPalette.ramp(CPalette.P["bark"], 0.25), 1.0)
            f.Lc(tip.x, tip.y, CPalette.ramp(CPalette.P["leaf"], 0.95), 0.45)
            if j % 6 == 4:
                flower(f, p.x - nx * w, p.y - ny * w, 0.35, float(j) + t, 3.0, CPalette.P["leaf"])
            j += 2
        f.Lc(td.pos[M - 1].x, td.pos[M - 1].y, CPalette.ramp(CPalette.P["leaf"], 1.0), 0.7)
    if t > 4.9 and t < TB:
        var g := CMath.inv(4.9, 5.7, t)
        f.disc(FZ.x, FZ.y - 2.0, 3.0 + g * 8.0, func(x: int, y: int, d: float) -> void:
            f.Ic(x, y, CPalette.ramp(CPalette.P["bloom"], 0.25 + (1.0 - d) * 0.35), 1.0)
            if absf(sin(atan2(float(y) - FZ.y, float(x) - FZ.x) * 3.0 + t)) < 0.15:
                f.Lc(x, y, CPalette.ramp(CPalette.P["bloom"], 0.9), 0.8 * g), 0.8)
        f.glow(FZ.x, FZ.y, 24.0, CPalette.ramp(CPalette.P["bloom"], 0.7), 0.4 * g, 4.0)
    if t >= TB:
        var op := CMath.back_out(CMath.inv(TB, TB + 0.28, t), 2.2)
        var fade := 1.0 - CMath.inv(6.6, 7.6, t)
        if fade > 0.0:
            var R := 44.0 * op
            f.field(FZ.x - R - 2.0, FZ.y - R - 2.0, FZ.x + R + 2.0, FZ.y + R + 2.0, func(x: int, y: int) -> void:
                var dx := float(x) + 0.5 - FZ.x
                var dy := (float(y) + 0.5 - FZ.y) / 0.78
                var r := Vector2(dx, dy).length()
                var pa := atan2(dy, dx)
                if r > R:
                    return
                for k in range(7):
                    var ang := float(k) / 7.0 * CMath.TAU + 0.2 + (1.0 - op) * 0.8
                    var u := r / R
                    var hw := 13.0 * pow(sin(PI * minf(1.0, u * 1.05)), 0.7) * op
                    var m := hw - absf(CMath.ang_diff(ang, pa)) * r
                    if m <= 0.0:
                        continue
                    var serr := m < 1.6 and CMath.hash2(floori(r * 0.8), k) > 0.45
                    if serr:
                        f.Ic(x, y, CPalette.ramp(CPalette.P["bark"], 0.2), 1.0 if fade > CMath.bayer(x, y) else 0.0)
                        return
                    if fade < CMath.bayer(x, y):
                        return
                    f.Ic(x, y, CPalette.ramp_d(CPalette.P["bloom"], 0.25 + (1.0 - u) * 0.45 + (0.1 if m > hw * 0.8 else 0.0), CMath.bayer(x, y)), 1.0)
                    if absf(CMath.ang_diff(ang, pa)) * r < 0.6:
                        f.Lc(x, y, CPalette.ramp(CPalette.P["bloom"], 0.9), 0.4)
                    return)
            f.disc(FZ.x, FZ.y, 6.0 * op, func(x: int, y: int, d: float) -> void: f.Ic(x, y, CPalette.ramp(CPalette.P["gold"], 0.4 + (1.0 - d) * 0.5), fade), 0.8)
            f.glow(FZ.x, FZ.y, 60.0, CPalette.ramp(CPalette.P["bloom"], 0.7), 0.35 * fade * exp(-(t - TB) * 1.5) + 0.05, 4.0, 0.8)
        for l in _lashes:
            var q := (t - float(l.t)) / 0.34
            if q < 0.0 or q > 1.0:
                continue
            var span := 2.6
            var head := float(l.a0) + float(l.dir) * span * CMath.ease_out(minf(1.0, q * 1.6))
            var pts: Array = []
            for j in range(31):
                var a := CMath.lerp(float(l.a0), head, float(j) / 30.0)
                pts.append(Vector2(FZ.x + cos(a) * float(l.r) * 1.1, FZ.y + sin(a) * float(l.r) * 0.75))
            var fade2 := 1.0 - q
            var ws2: Array = []
            for j in range(31):
                ws2.append(float(j) / 30.0 * 4.5 * fade2 + 0.4)
            f.ribbon(pts, ws2, func(x: int, y: int, s: float, e: float) -> void:
                if fade2 * (0.4 + s) < CMath.bayer(x, y):
                    return
                f.Ic(x, y, CPalette.ramp(CPalette.P["leaf"], 0.75 if e * float(l.dir) > 0.3 else 0.45), 1.0)
                if s > 0.85:
                    f.Lc(x, y, CPalette.ramp(CPalette.P["leaf"], 1.0), 0.8))
            var j := 4
            while j < 30:
                var p: Vector2 = pts[j]
                var a := CMath.lerp(float(l.a0), head, float(j) / 30.0)
                f.line_i(p.x, p.y, p.x + cos(a) * 4.0, p.y + sin(a) * 3.0, CPalette.ramp(CPalette.P["bark"], 0.2), fade2)
                j += 3
            CKit.shock(f, pts[30].x, pts[30].y, 6.0 + q * 10.0, 5.0, 3.0 * fade2, 1.0)
    CKit.particles_render(f, _ps)
