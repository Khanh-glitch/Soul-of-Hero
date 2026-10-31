## Faithful port of original B meteorLoom (src/effects/pyre.ts:489-707),
## seed 303: heptagram sigil verts, 8 authored meteors (one split parent),
## per-impact crack scars with reactivation, sigil tracing at SIG=6.45,
## ballistic tails/fragments, post heat-wave warp. Duration 10, climax 7.25.
extends RefCounted
class_name BMeteorLoom

const DURATION := 10.0
const CLIMAX := 7.25
const SIG := 6.45

var _C := Vector2.ZERO
var _verts: Array = []
var _mets: Array = []
var _cracks: Array = []
var _debris: Array = []

func setup(r: BRenderer) -> void:
    var rng := BMath.BRng.new(303)
    _C = Vector2(BRenderer.W / 2.0 + 16.0, BRenderer.H / 2.0 + 4.0)
    _verts.clear()
    for k in range(7):
        var a := -PI / 2.0 + (float(k) / 7.0) * BMath.TAU
        _verts.append(_C + Vector2(cos(a) * 92.0, sin(a) * 66.0))
    var mk := func(vi: int, ti: float, tt: float, dir: float, kind: int, size: float) -> Dictionary:
        return {"P": _C if vi < 0 else _verts[vi], "ti": ti, "tt": tt,
            "D": Vector2(cos(dir) * 230.0, sin(dir) * 90.0), "z0": 230.0, "kind": kind, "size": size,
            "shape": BMath.shard_shape(rng, rng.i(5, 7), 0.5), "spin": rng.r(-4.0, 4.0), "seed": rng.i(0, 999), "split": []}
    _mets = [
        mk.call(0, 1.7, 1.6, PI + 0.3, 0, 7.0),
        mk.call(3, 2.35, 0.55, -0.4, 2, 5.0),
        mk.call(6, 3.2, 1.0, PI * 1.25, 1, 4.0), mk.call(2, 3.35, 1.1, PI * 1.25, 0, 4.0), mk.call(5, 3.5, 1.2, PI * 1.25, 1, 4.0),
        mk.call(1, 4.3, 0.8, 0.2, 2, 5.0),
        mk.call(4, 4.95, 1.3, PI - 0.6, 1, 6.0),
        mk.call(-1, 5.9, 1.4, PI * 1.5 + 0.2, 1, 9.0),
    ]
    _mets[2]["split"] = [3, 4]
    _cracks.clear()
    _debris.clear()
    # TS consumes RNG in two separate mets.map passes (cracks, then
    # debris); interleaving them corrupts both streams.
    for i in range(_mets.size()):
        _cracks.append(BFx.crack_tree(rng, 0.0, 0.0, 5 + (i % 3), 34.0 + float(_mets[i].size) * 2.0, 0.45, 3.0))
    for i in range(_mets.size()):
        var deb: Array = []
        for k in range(16):
            deb.append({"a": rng.r(0.0, BMath.TAU), "v": rng.r(20.0, 90.0), "vz": rng.r(40.0, 150.0), "s": rng.r(0.6, 2.0)})
        _debris.append(deb)

func _pos_at(m: Dictionary, u: float) -> Dictionary:
    var P: Vector2 = m.P
    var D: Vector2 = m.D
    var gx := P.x + D.x * (1.0 - u)
    var gy := P.y + D.y * (1.0 - u)
    var z := float(m.z0) * pow(1.0 - u, 1.35)
    return {"gx": gx, "gy": gy, "x": gx, "y": gy - z * 0.8, "z": z}

func authored_events() -> Array:
    var ev: Array = []
    for i in range(_mets.size()):
        var m: Dictionary = _mets[i]
        ev.append({"t": float(m.ti), "kind": "meteor_impact", "pos_local": Vector2(m.P), "emitted": false})
    ev.append({"t": SIG, "kind": "sigil_ignition", "pos_local": Vector2(_C), "emitted": false})
    ev.append({"t": 8.6, "kind": "aftermath_cooling", "pos_local": Vector2(_C), "emitted": false})
    return ev

func render(r: BRenderer, t: float) -> void:
    r.ambient = 0.5
    for i in range(_mets.size()):
        var m: Dictionary = _mets[i]
        var mi_ti := float(m.ti)
        var e := t - mi_ti
        if e < 0.0:
            continue
        var P: Vector2 = m.P
        var g := exp(-e * 1.3) * 1.3
        for j in range(_mets.size()):
            if j == i:
                continue
            var ej := t - float(_mets[j].ti)
            var Pj: Vector2 = _mets[j].P
            var d := P.distance_to(Pj)
            var arr := ej - d / 170.0
            if arr > 0.0:
                g += exp(-arr * 2.2) * exp(-d / 95.0) * 1.4
        g += BMath.pulse(SIG, SIG + 2.2, t) * 0.8
        var fade := 1.0 - BMath.smooth(8.0, 10.0, t) * 0.7
        g *= fade
        r.decal_disc(P.x, P.y, 6.0 + float(m.size) * 0.8, BPyreWyrm.CHAR, 0.85, 0.35)
        for cf in _cracks[i]:
            var cd: Dictionary = cf
            if float(cd.d) > e * 3.2:
                continue
            var x0 := P.x + float(cd.x0)
            var y0 := P.y + float(cd.y0) * 0.7
            var x1 := P.x + float(cd.x1)
            var y1 := P.y + float(cd.y1) * 0.7
            r.decal_line(x0, y0, x1, y1, BPyreWyrm.CHAR, 0.9)
            var gg := BMath.clampf2(g * (1.1 - float(cd.d) * 0.7))
            if gg > 0.04:
                r.line(x0, y0, x1, y1, BPyreWyrm.fire(0.3 + gg * 0.65), 0.4 + gg)
        r.disc(P.x, P.y, 3.0 + float(m.size) * 0.4, BPyreWyrm.fire(0.35 + BMath.clampf2(g) * 0.6), BMath.clampf2(g) + 0.15)
        r.light(P.x, P.y, 50.0 + float(m.size) * 6.0, Vector3(1.4, 0.5, 0.12), BMath.clampf2(g) * 1.2)
        if e < 0.3:
            r.glow(P.x, P.y, 40.0 + float(m.size) * 3.0, Vector3(2.4, 1.6, 0.8), (1.0 - e / 0.3) * 1.6)
            r.flash = maxf(r.flash, (0.6 + float(m.size) * 0.06) * (1.0 - e / 0.12))
            r.shake_x += (BMath.hash1(t * 50.0 + float(i)) - 0.5) * float(m.size) * (1.0 - e / 0.3)
            r.shake_y += (BMath.hash1(t * 70.0 + float(i)) - 0.5) * float(m.size) * (1.0 - e / 0.3)
            r.ring(P.x, P.y, BMath.ease_out(e / 0.3) * (40.0 + float(m.size) * 5.0), 1.5, BPyreWyrm.fire(0.8), 1.0 - e / 0.3, BRenderer.ADD, 0.7)
        for k in range(9):
            var a := BMath.hash1(float(i * 20 + k)) * BMath.TAU
            var rr := BMath.ease_out(e / 1.8) * (14.0 + BMath.hash1(float(k + i)) * 18.0)
            var x := P.x + cos(a) * rr
            var y := P.y + sin(a) * rr * 0.6 - e * 8.0
            var life := BMath.clampf2(1.0 - e / 2.6)
            if life <= 0.0:
                continue
            r.disc(x, y, 3.0 + e * 4.0, BPyreWyrm.fire(0.6) if e < 0.5 else Vector3(0.12, 0.09, 0.08), life * 0.6, BRenderer.ADD if e < 0.5 else BRenderer.DITHER)
        for df in _debris[i]:
            var dd: Dictionary = df
            var z := maxf(0.0, float(dd.vz) * e - 170.0 * e * e)
            var gx := P.x + cos(float(dd.a)) * BMath.fly(0.0, float(dd.v), 1.5, 0.0, e)
            var gy := P.y + sin(float(dd.a)) * BMath.fly(0.0, float(dd.v), 1.5, 0.0, e) * 0.65
            if z <= 0.0 and e > 0.3:
                r.decal(gx, gy, Vector3(0.1, 0.05, 0.04))
                continue
            r.disc(gx, gy - z, float(dd.s), Vector3(0.15, 0.08, 0.06), 1.0, BRenderer.SET)
            r.px(gx, gy - z - 1, BPyreWyrm.fire(0.8), 1.2 * exp(-e))
    if t > SIG:
        var bright := BMath.pulse(SIG, SIG + 2.6, t)
        var cool := BMath.smooth(SIG + 1.4, 10.0, t)
        for k in range(7):
            var a: Vector2 = _verts[k]
            var b: Vector2 = _verts[(k + 3) % 7]
            var p := BMath.ease_in_out((t - SIG - float(k) * 0.06) / 0.55)
            if p <= 0.0:
                continue
            var n := ceili(a.distance_to(b) / 2.0)
            var dx := b.x - a.x
            var dy := b.y - a.y
            var L := a.distance_to(b)
            for q in range(int(float(n) * p) + 1):
                var u := float(q) / float(n)
                var j := (BMath.noise1(u * 18.0 + float(k) * 7.0) - 0.5) * 3.0
                var x := a.x + dx * u + (-dy / L) * j
                var y := a.y + dy * u + (dx / L) * j
                r.decal(x, y, BPyreWyrm.CHAR, 0.9)
                r.decal(x, y + 1, BPyreWyrm.CHAR, 0.5)
                var head := exp(-absf(u - p) * 20.0) * (1.0 if p < 1.0 else 0.0)
                r.px(x, y, BPyreWyrm.fire(0.55 + bright * 0.45 - cool * 0.3 + head * 0.3), 0.5 + bright * 1.3 + head * 2.0)
                if bright > 0.4:
                    r.px(x, y - 1, BPyreWyrm.fire(0.5), bright * 0.6)
            if k % 2 == 0:
                r.light((a.x + b.x) / 2.0, (a.y + b.y) / 2.0, 70, Vector3(1.3, 0.5, 0.15), bright * 0.8)
        var rp := BMath.ease_in_out((t - SIG - 0.3) / 0.8)
        for q in range(int(700.0 * rp)):
            var a := -PI / 2.0 + (float(q) / 700.0) * BMath.TAU
            var x := _C.x + cos(a) * 100.0
            var y := _C.y + sin(a) * 73.0
            r.decal(x, y, BPyreWyrm.CHAR, 0.8)
            r.px(x, y, BPyreWyrm.fire(0.6 + bright * 0.35 - cool * 0.3), 0.4 + bright * 1.2)
        r.light(_C.x, _C.y, 160, Vector3(1.2, 0.45, 0.12), bright * 1.4)
        if t < SIG + 0.6:
            r.flash = maxf(r.flash, BMath.pulse(SIG + 0.45, SIG + 0.75, t) * 0.8)
    for i in range(_mets.size()):
        var m: Dictionary = _mets[i]
        var parent := -1
        for pi in range(_mets.size()):
            var sp: Array = _mets[pi].split
            if not sp.is_empty() and sp.has(i):
                parent = pi
                break
        var u := (t - (float(m.ti) - float(m.tt))) / float(m.tt)
        if u < 0.0 or u >= 1.0:
            continue
        if parent >= 0:
            var pm: Dictionary = _mets[parent]
            var pu := (t - (float(pm.ti) - float(pm.tt))) / float(pm.tt)
            if pu < 0.55:
                continue
        var split_arr: Array = m.split
        if not split_arr.is_empty() and u > 0.55 and u < 0.6:
            var sp0 := _pos_at(m, u)
            r.glow(float(sp0.x), float(sp0.y), 14, Vector3(2, 1.2, 0.5), 1.5)
        var p := _pos_at(m, u)
        r.shadow(float(p.gx), float(p.gy), 3.0 + float(p.z) * 0.07, 1.5 + float(p.z) * 0.035, 0.25 + u * 0.6)
        r.light(float(p.gx), float(p.gy), 30.0 + float(p.z) * 0.15, Vector3(1.4, 0.6, 0.2), 0.3 + u * 0.9)
        r.light(float(p.x), float(p.y), 40, Vector3(1.4, 0.6, 0.2), 0.5)
        for k in range(18, 0, -1):
            var q := _pos_at(m, maxf(0.0, u - float(k) * 0.011 * (1.6 if int(m.kind) == 2 else 1.0)))
            var w := float(m.size) * (1.0 - float(k) / 20.0) * (0.8 if int(m.kind) == 2 else 0.6)
            r.disc(float(q.x), float(q.y), w, BPyreWyrm.fire(0.95 - float(k) * 0.035), 0.5)
        for k in range(10):
            var us := float(k) * 0.09 + 0.05
            if us > u:
                break
            var q0 := _pos_at(m, us)
            var q1 := _pos_at(m, us + 0.01)
            var vx := (float(q1.x) - float(q0.x)) * 30.0 + (BMath.hash1(float(m.seed) + float(k)) - 0.5) * 40.0
            var vy := (float(q1.y) - float(q0.y)) * 30.0 + (BMath.hash1(float(m.seed) + float(k) + 50.0) - 0.5) * 30.0
            var ee := (u - us) * float(m.tt)
            if ee > 0.9:
                continue
            var x := BMath.fly(float(q0.x), vx, 1.5, 0.0, ee)
            var y := BMath.fly(float(q0.y), vy, 1.5, 90.0, ee)
            r.px(x, y, BPyreWyrm.fire(0.8 - ee * 0.5), (1.0 - ee / 0.9) * 1.6)
        var rot := float(m.spin) * t
        var pn := _pos_at(m, minf(1.0, u + 0.01))
        var va := atan2(float(pn.y) - float(p.y), float(pn.x) - float(p.x))
        if int(m.kind) == 2:
            var ca := cos(va)
            var sa := sin(va)
            var sz := float(m.size)
            var pts: Array = []
            for k in range(10):
                var a := (float(k) / 10.0) * BMath.TAU
                var lx := cos(a) * sz * (3.2 if cos(a) < 0.0 else 1.1) * (1.0 + (BMath.hash1(float(m.seed) + float(k)) - 0.5) * 0.4)
                var ly := sin(a) * sz * 0.8
                pts.append(float(p.x) + lx * ca - ly * sa)
                pts.append(float(p.y) + lx * sa + ly * ca)
            r.poly(pts, BPyreWyrm.fire(0.75), 1.2)
            r.disc(float(p.x), float(p.y), sz * 0.5, BPyreWyrm.fire(1.0), 1.5)
        else:
            var pts := BMath.shard_pts(m.shape, float(p.x), float(p.y), float(m.size), rot)
            if int(m.kind) == 0:
                r.poly(pts, Vector3(0.07, 0.03, 0.06), 1.0, BRenderer.SET)
                r.polyline(pts, BPyreWyrm.fire(0.8), 1.2, BRenderer.ADD, true)
                for k in range(3):
                    var a := rot * 1.3 + float(k) * 2.1
                    r.line(float(p.x), float(p.y), float(p.x) + cos(a) * float(m.size) * 0.8, float(p.y) + sin(a) * float(m.size) * 0.8, BPyreWyrm.fire(0.95), 1.2)
            else:
                r.poly(pts, BPyreWyrm.fire(1.0), 1.4)
                var rind := BMath.shard_pts(m.shape, float(p.x), float(p.y), float(m.size), rot)
                for k in range(0, rind.size(), 4):
                    r.disc(float(rind[k]), float(rind[k + 1]), float(m.size) * 0.35, Vector3(0.1, 0.04, 0.03), 1.0, BRenderer.SET)
            r.glow(float(p.x), float(p.y), float(m.size) * 3.0, BPyreWyrm.fire(0.7), 0.8)

func post(r: BRenderer, t: float) -> void:
    for m in _mets:
        var e := t - float(m.ti)
        if e < 0.0 or e > 0.8:
            continue
        var R := e * 150.0
        var amp := 3.0 * (1.0 - e / 0.8)
        var Px: float = m.P.x
        var Py: float = m.P.y
        r.warp(Px - R - 6, Py - R - 6, Px + R + 6, Py + R + 6, func(x: int, y: int) -> Array:
            var dx := float(x) - Px
            var dy := (float(y) - Py) / 0.7
            var d := Vector2(dx, dy).length()
            var k := exp(-pow((d - R) / 5.0, 2.0)) * amp
            if k < 0.3:
                return [float(x), float(y)]
            var dd := d if d != 0.0 else 1.0
            return [float(x) - (dx / dd) * k, float(y) - (dy / dd) * k * 0.7])
