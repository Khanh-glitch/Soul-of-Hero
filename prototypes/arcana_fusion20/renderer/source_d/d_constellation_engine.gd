## Port of original D Constellation Engine (Elemental_VFX_Lab_FIXED_
## Standalone.html engineSpell, id 19): 14 nodes solve a geometry,
## edges flicker/reform, pulses travel edges, finale converges into a
## crystalline star at 8.15s. Duration 9.8, climax 7.9 (verified in
## the D HTML; matches FUSION_DECISIONS retime note).
## OUT phase: the D lifecycle ends at 9.8 with the star still lit.
## FUSION_DECISIONS mandates an authored OUT (unwind/retract, withdraw
## light, motes converge/disappear; the separate OUT study is an
## unapproved reference only and was NOT copied). OUT here (8.6-9.8):
## finale ring contracts to the centre, filament/node/star light
## withdraws with the same phase curve, pool motes keep their authored
## envelopes to expiry. Labelled OUT_AUTHORED_EXTENSION.
## fx.rng reseeds per frame as RNG((time*977)|0) in the original
## renderer; reproduced with the frame index (time = spell t at 60Hz).
extends RefCounted
class_name DConstellationEngine

const DURATION := 9.8
const CLIMAX := 7.9
const CENTER := Vector2(244, 132)
const OUT_START := 8.6

var _nodes: Array = []
var _edges: Array = []
var _pulses: Array = []
var _star := 0
var fx: DFx

static func _phase(tt: float, a: float, b: float) -> float:
    return clampf((tt - a) / (b - a), 0.0, 1.0)

static func _ease_out_cubic(tt: float) -> float:
    return 1.0 - pow(1.0 - tt, 3.0)

static func _ease_out_expo(tt: float) -> float:
    return 1.0 if tt >= 1.0 else 1.0 - pow(2.0, -10.0 * tt)

func setup() -> void:
    fx = DFx.new()
    var rng := DFx.source_rng(97)
    _nodes.clear()
    _edges.clear()
    _pulses.clear()
    _star = 0
    for i in range(14):
        var a := rng.r(0.0, BMath.TAU)
        var rr := rng.r(20.0, 105.0)
        var home := Vector2(CENTER.x + cos(a) * rr, CENTER.y + sin(a) * rr * 0.86)
        _nodes.append({"x": home.x, "y": home.y, "tx": home.x, "ty": home.y,
            "ph": rng.r(0.0, 6.0), "sp": rng.r(0.6, 1.6), "home": home})

func authored_events() -> Array:
    return [
        {"t": 1.2, "kind": "nodes_awaken", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 3.2, "kind": "nodes_slide", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 5.2, "kind": "pulse_travel", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 6.4, "kind": "lattice_form", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 7.4, "kind": "finale_converge", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 8.15, "kind": "star_impact", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": OUT_START, "kind": "out_unwind", "pos_local": Vector2(CENTER), "emitted": false},
        {"t": 9.8, "kind": "out_complete", "pos_local": Vector2(CENTER), "emitted": false},
    ]

func _out_fade(t: float) -> float:
    return 1.0 - _phase(t, OUT_START, DURATION)

func update(t: float, dt: float) -> void:
    fx.clear()
    # The spell timeline and renderer shader clock differ on the reset frame:
    # spell t advances 1/60, but Renderer.frame advances by only 0.0001.
    # Ribbon/sprite shader animation uses renderer.time, not spell t.
    var renderer_time := maxf(0.0001, t - 1.0 / 60.0 + 0.0001)
    fx.t = renderer_time
    fx.rng = DFx.source_rng(int(renderer_time * 977.0))
    var rng := DFx.source_rng(600 + floori(t * 30.0))
    var P := DFx.pal_astral()
    var finale := t > 7.4
    var out_f := _out_fade(t)
    var out_k := _ease_out_cubic(_phase(t, OUT_START, DURATION))
    for i in range(_nodes.size()):
        var n: Dictionary = _nodes[i]
        if t > 3.2 and not finale:
            var c: Dictionary = _nodes[(i * 5 + 3) % _nodes.size()]
            var a := t * float(n.sp) * (1.0 if i % 2 else -1.0) + float(n.ph)
            var rr := 22.0 + float(i % 4) * 12.0
            n.tx = lerpf(float(n.tx), (float(n.x) + float(c.x)) / 2.0 + cos(a) * rr, dt * 2.0)
            n.ty = lerpf(float(n.ty), (float(n.y) + float(c.y)) / 2.0 + sin(a) * rr * 0.86, dt * 2.0)
        elif finale:
            var k := _ease_out_cubic(_phase(t, 7.4, 8.2))
            var a := float(i) / float(_nodes.size()) * BMath.TAU * 2.0 + 0.4
            var home: Vector2 = n.home
            var rr := lerpf(Vector2(home.x - CENTER.x, home.y - CENTER.y).length(), 96.0 if i % 2 else 54.0, k)
            rr = lerpf(rr, 6.0, out_k)
            n.tx = lerpf(float(n.tx), CENTER.x + cos(a) * rr, dt * 6.0)
            n.ty = lerpf(float(n.ty), CENTER.y + sin(a) * rr * 0.86, dt * 6.0)
        n.x = lerpf(float(n.x), float(n.tx), dt * 3.2)
        n.y = lerpf(float(n.y), float(n.ty), dt * 3.2)
        var beat := 0.55 + 0.45 * sin(t * (1.4 + float(n.sp)) + float(n.ph))
        var col := DFx.ramp(P, 0.8 + beat * 0.2, 1.0)
        col.a = 0.95 * out_f
        fx.sp(float(n.x), float(n.y), 2.2 + beat * 1.4, col, DFx.STAR, {"rot": t * 0.6 + float(n.ph), "hard": 1.1, "glow": 1.0})
        var soft := DFx.ramp(P, 0.7, 0.5)
        soft.a = 0.4 * out_f
        fx.sp(float(n.x), float(n.y), 7.0 + beat * 4.0, soft, DFx.SOFT, {"hard": 1.0})
        var fl := DFx.ramp(P, 0.8 + beat * 0.2, 1.0)
        fl.a = 0.5 * out_f
        fx.sp(float(n.x), float(n.y), 5.0 + beat * 3.0, fl, DFx.FLARE, {"rot": float(n.ph) + t * 0.3, "hard": 1.2})
    if not finale:
        if fx.rng.r(0.0, 1.0) < 0.24:
            var i := floori(rng.r(0.0, float(_nodes.size())))
            var ds: Array = []
            for j in range(_nodes.size()):
                if j != i:
                    ds.append({"j": j, "d": Vector2(float(_nodes[j].x) - float(_nodes[i].x), float(_nodes[j].y) - float(_nodes[i].y)).length()})
            ds.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.d) < float(b.d))
            for k in range(mini(2, ds.size())):
                _edges.append({"a": i, "b": int(ds[k].j), "born": t, "die": t + rng.r(0.4, 1.5)})
        var ei := _edges.size() - 1
        while ei >= 0:
            var e: Dictionary = _edges[ei]
            if t > float(e.die):
                _edges.remove_at(ei)
                ei -= 1
                continue
            var A: Dictionary = _nodes[int(e.a)]
            var B: Dictionary = _nodes[int(e.b)]
            var grow := _ease_out_cubic(_phase(t, float(e.born), float(e.born) + 0.3))
            var die := 1.0 - _phase(t, float(e.die) - 0.25, float(e.die))
            var flick := 0.5 + 0.5 * sin(t * 17.0 + float(e.a) * 3.0)
            var pts: Array = [float(A.x), float(A.y),
                lerpf(float(A.x), float(B.x), 0.5) + sin(t * 3.0 + float(e.a)) * 3.0, lerpf(float(A.y), float(B.y), 0.5),
                float(B.x), float(B.y)]
            var c1 := DFx.ramp(P, 0.5, 1.0)
            c1.a = 0.35 * grow * die
            fx.line(pts, 0.4 * grow, c1, {"hard": 1.4, "flags": 4.0})
            var c2 := DFx.ramp(P, 0.9, 1.0)
            c2.a = (0.35 + 0.4 * flick) * grow * die
            fx.line(pts, 0.22 * grow, c2, {"hard": 1.0, "glow": 0.8})
            ei -= 1
        if _edges.size() > 40:
            _edges = _edges.slice(12)
    else:
        var k := _ease_out_cubic(_phase(t, 7.4, 8.1)) * out_f
        for i in range(_nodes.size()):
            var A: Dictionary = _nodes[i]
            var B: Dictionary = _nodes[(i + 1) % _nodes.size()]
            var C: Dictionary = _nodes[(i + 5) % _nodes.size()]
            var c1 := DFx.ramp(P, 0.9, 1.0)
            c1.a = 0.8 * k
            fx.line([float(A.x), float(A.y), float(B.x), float(B.y)], 0.9 * k, c1, {"hard": 1.0, "glow": 1.0, "flow": 2.6})
            if i % 2 == 0:
                var c2 := DFx.ramp(P, 0.7, 1.0)
                c2.a = 0.5 * k
                fx.line([float(A.x), float(A.y), float(C.x), float(C.y)], 0.5 * k, c2, {"hard": 1.2, "glow": 0.6})
        for i in range(0, _nodes.size(), 2):
            var A: Dictionary = _nodes[i]
            var c3 := DFx.ramp(P, 0.95, 1.0)
            c3.a = 0.7 * k
            fx.line([float(A.x), float(A.y), lerpf(float(A.x), CENTER.x, 0.5), lerpf(float(A.y), CENTER.y, 0.5), CENTER.x, CENTER.y],
                [0.7, 1.4, 0.3], c3, {"hard": 1.0, "glow": 1.0, "flow": 3.2})
        var su := _ease_out_expo(_phase(t, 7.55, 8.1)) * out_f
        for i in range(8):
            var a := float(i) / 8.0 * BMath.TAU + t * 0.4
            var rr := 22.0 * su * (0.45 if i % 2 else 1.0)
            var pc := DFx.ramp(P, 0.9, 0.85)
            pc.a = 0.7 * su
            fx.poly(DFx.quad_c(CENTER.x, CENTER.y, rr, rr * 0.4, a), pc, {"glow": 1.0, "edge": 0.6})
            var lc := DFx.ramp(P, 1.0, 1.0)
            lc.a = 0.7 * su
            fx.line([CENTER.x, CENTER.y, CENTER.x + cos(a) * rr * 1.2, CENTER.y + sin(a) * rr * 0.9], 0.6, lc, {"hard": 1.0, "glow": 1.0})
        var sc1 := DFx.ramp(P, 1.0, 1.0)
        sc1.a = 0.95 * su
        fx.sp(CENTER.x, CENTER.y, 8.0 + 20.0 * su, sc1, DFx.STAR, {"rot": t * 1.2, "hard": 1.2, "glow": 1.4})
        var sc2 := DFx.ramp(P, 0.8, 0.5)
        sc2.a = 0.45 * su
        fx.sp(CENTER.x, CENTER.y, 30.0 + 50.0 * su, sc2, DFx.SOFT, {"hard": 1.0})
        fx.bend(CENTER.x, CENTER.y, 70.0 * su, 0.0, 0.0, 0.0, 1.4 * su)
        if t > 8.15 and _star == 0:
            _star = 1
            fx.flash(0.8, Vector3(0.95, 0.9, 1.0))
            fx.kick(7.0)
            for s in range(5):
                var a := float(s) / 5.0 * BMath.TAU
                var pts: Array = []
                for i in range(13):
                    var u := float(i) / 12.0
                    var aa := a + u * 1.2 * (1.0 if s % 2 else -1.0)
                    pts.append(CENTER.x + cos(aa) * u * 130.0)
                    pts.append(CENTER.y + sin(aa) * u * 110.0)
                var lc := DFx.ramp(P, 0.95, 1.0)
                lc.a = 0.95
                fx.line(pts, [3.4, 1.2, 0.2], lc, {"hard": 1.0, "glow": 1.2, "flow": 3.0})
            for i in range(130):
                var a := rng.r(0.0, BMath.TAU)
                fx.pool_spawn(CENTER.x, CENTER.y, cos(a) * rng.r(30.0, 230.0), sin(a) * rng.r(24.0, 190.0),
                    rng.r(0.6, 2.4), rng.r(1.0, 3.0), 0.3, DFx.ramp(P, rng.r(0.7, 1.0), 1.0), 0.95,
                    {"shape": DFx.FLAKE if rng.r(0.0, 1.0) < 0.4 else DFx.DISC, "drag": 1.2, "grav": -6.0,
                     "rot": rng.r(0.0, BMath.TAU), "spin": rng.r(-6.0, 6.0), "env": 4, "hard": 1.0})
    if t > 5.2 and fx.rng.r(0.0, 1.0) < 0.3 and not _edges.is_empty():
        var e: Dictionary = _edges[floori(rng.r(0.0, float(_edges.size())))]
        _pulses.append({"a": int(e.a), "b": int(e.b), "u": 0.0, "sp": rng.r(0.8, 2.0), "life": 0.0})
    var pi := _pulses.size() - 1
    while pi >= 0:
        var p: Dictionary = _pulses[pi]
        p.u = float(p.u) + dt * float(p.sp)
        if float(p.u) >= 1.0:
            var nb := _edges.filter(func(e: Dictionary) -> bool: return int(e.a) == int(p.b))
            if not nb.is_empty() and rng.r(0.0, 1.0) < 0.5:
                _pulses.append({"a": int(nb[0].a), "b": int(nb[0].b), "u": 0.0, "sp": float(p.sp) * 0.9, "life": 0.0})
            _pulses.remove_at(pi)
            pi -= 1
            continue
        var A: Dictionary = _nodes[int(p.a)]
        var B: Dictionary = _nodes[int(p.b)]
        var x := lerpf(float(A.x), float(B.x), float(p.u))
        var y := lerpf(float(A.y), float(B.y), float(p.u))
        var sc := DFx.ramp(P, 1.0, 1.0)
        sc.a = 0.95 * out_f
        fx.sp(x, y, 2.2, sc, DFx.STAR, {"rot": float(p.u) * 9.0, "hard": 1.2, "glow": 1.3})
        var lc := DFx.ramp(P, 0.95, 1.0)
        lc.a = 0.8 * out_f
        fx.line([lerpf(float(A.x), float(B.x), maxf(0.0, float(p.u) - 0.14)), lerpf(float(A.y), float(B.y), maxf(0.0, float(p.u) - 0.14)), x, y],
            1.1, lc, {"hard": 1.0, "glow": 1.0})
        pi -= 1
    fx.warp_amt = 1.0
    fx.decal_fade = 0.14
    fx.bloom_gain = 1.0 + (0.5 if finale else 0.1) + (0.6 * exp(-(t - 8.15) * 2.0) if _star else 0.0)
    fx.pool_step(dt)
    fx.pool_render()

func frame_bytes() -> PackedByteArray:
    return fx.composite()
