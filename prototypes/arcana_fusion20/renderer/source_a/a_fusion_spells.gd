## Authored FUSION_CANDIDATE choreographies built from the ported source
## engines' own primitives/palettes (see FUSION_DECISIONS.md). Each is
## ONE authored timeline with shared anchors and a typed event ledger —
## not three layered casts. #05 Abyssal Bloom (A opening/peak lead +
## C water column/rain replacing A's explosion tails), #09 Chain Verdict
## (A chain logic + B two-colour lightning + C bolt density/impact).
extends RefCounted
class_name AFusionSpells

const C := Vector2(232, 124)
const CASTER := Vector2(104, 150)

# ---------------------------------------------------------------- #05
class AbyssalBloom:
    extends RefCounted
    const DUR := 7.6
    var _rng: AMath.ARng
    var _petals: Array = []
    var _rain: Array = []
    var _ps: ADraw.APool
    func setup() -> void:
        _rng = AMath.ARng.new(50505)
        _ps = ADraw.APool.new()
        _petals.clear()
        for i in range(9):
            _petals.append({"a": (float(i) / 9.0) * AMath.TAU + _rng.rangef(-0.2, 0.2), "len": _rng.rangef(52, 96), "w": _rng.rangef(10, 22), "del": _rng.rangef(0, 0.3), "curl": _rng.rangef(-0.8, 0.8)})
        _rain.clear()
        for i in range(240):
            _rain.append({"x": C.x + _rng.rangef(-120, 120), "y0": _rng.rangef(-150, -20), "sp": _rng.rangef(120, 210), "del": _rng.rangef(0, 1.6)})
    func authored_events() -> Array:
        return [
            {"t": 0.8, "kind": "membrane_open", "pos_local": C, "emitted": false},
            {"t": 3.4, "kind": "bloom_release_impact", "pos_local": C, "emitted": false},
            {"t": 3.6, "kind": "column_rise", "pos_local": C, "emitted": false},
            {"t": 5.2, "kind": "rain_fall", "pos_local": C, "emitted": false},
            {"t": 6.8, "kind": "puddle_recede", "pos_local": C, "emitted": false},
        ]
    func update(dt: float, t: float) -> void:
        if t > 3.4 and t < 5.8 and _rng.next() < 0.8:
            var a := _rng.angle()
            _ps.spawn({"x": C.x + cos(a) * _rng.rangef(0, 30), "y": C.y + sin(a) * _rng.rangef(0, 16),
                "vx": cos(a) * _rng.rangef(10, 60), "vy": -_rng.rangef(30, 90),
                "life": _rng.rangef(0.5, 1.4), "size": _rng.rangef(0.7, 1.8), "k": 0.9, "seed": _rng.next() * 100.0})
        _ps.each(func(p: Dictionary) -> void:
            p["vy"] = float(p.vy) + 150.0 * dt)
        _ps.step(dt, 0.0)
    func render(fb: AFramebuffer, t: float) -> void:
        var open_ := AMath.seg(t, 0.8, 3.2)
        var peak := AMath.seg(t, 3.2, 3.5)
        var col_k := AMath.seg(t, 3.6, 4.4) * (1.0 - AMath.seg(t, 5.6, 6.8))
        var out_k := 1.0 - AMath.seg(t, 6.6, 7.6)
        # A lead: liquid membranes fold open (polar membrane field)
        if open_ > 0.0:
            var r_max := 110.0
            ADraw.field(fb, C.x - r_max, C.y - r_max, C.x + r_max, C.y + r_max, func(x: int, y: int, out: Array) -> void:
                var dx := float(x) + 0.5 - C.x
                var dy := (float(y) + 0.5 - C.y) * 1.15
                var d := Vector2(dx, dy).length()
                if d > r_max:
                    return
                var a := atan2(dy, dx)
                var folds := 0.5 + 0.5 * sin(a * 9.0 + open_ * 2.2)
                var surf := (18.0 + 62.0 * AMath.ease_out(open_, 2.4)) * (0.8 + folds * 0.35)
                var mem := 1.0 - absf(d - surf) / 7.0
                if mem <= 0.0:
                    return
                var h := mem * (0.35 + 0.65 * peak) * out_k
                var c := AMath.R("water", 0.25 + h * 0.7)
                out[0] = c.x * h
                out[1] = c.y * h
                out[2] = c.z * h)
            for p in _petals:
                var u := AMath.cl01((open_ - float(p.del) * 0.3) * 1.6)
                if u <= 0.0:
                    continue
                var pts: Array = []
                for i in range(9):
                    var s := float(i) / 8.0
                    var a: float = float(p.a) + float(p.curl) * s * s
                    var rr := 12.0 + float(p.len) * AMath.ease_out(u, 3.0) * s
                    pts.append(Vector2(C.x + cos(a) * rr, C.y + sin(a) * rr * 0.8))
                var pw: float = p.w
                ADraw.ribbon(fb, pts,
                    func(s: float, _i: int) -> float: return pw * sin(s * PI) * (1.0 - u * 0.2),
                    func(s: float, _i: int, edge: float) -> Variant:
                        var h := (1.0 - edge) * (1.0 - s * 0.4) * out_k
                        if h < 0.05:
                            return null
                        return AMath.R("water", 0.3 + h * 0.65))
        ADraw.glow(fb, C.x, C.y, 26.0 + peak * 30.0, AMath.R("water", 0.85), (0.4 + peak) * out_k)
        # C contribution: coherent water column + falling rain with gravity
        if col_k > 0.0:
            for k in range(26):
                var wob := sin(t * 9.0 + float(k) * 1.7) * 3.0
                var x := C.x + wob + (AMath.hash2(float(k), floor(t * 12.0)) - 0.5) * 22.0
                var top := C.y - 90.0 * col_k
                ADraw.streak(fb, x, C.y, x + wob * 0.4, top, 1.6, 0.4, AMath.R("water", 0.75), col_k * 0.8)
        if t > 5.0:
            for r in _rain:
                var lt := t - 5.0 - float(r.del)
                if lt < 0.0:
                    continue
                var y: float = float(r.y0) + float(r.sp) * lt
                if y > C.y + 26.0:
                    continue
                ADraw.streak(fb, float(r.x), y - 7.0, float(r.x), y, 0.8, 0.4, AMath.R("water", 0.8), 0.7 * out_k)
            ADraw.ring_shape(fb, C.x, C.y + 24.0, 30.0 + AMath.seg(t, 5.0, 7.0) * 60.0, 2.0, AMath.R("water", 0.5), 0.4 * out_k)
        _ps.each(func(p: Dictionary) -> void:
            var l := float(p.life) / float(p.max)
            ADraw.streak_p(fb, p, AMath.R("water", 0.4 + l * 0.5), l))

# ---------------------------------------------------------------- #09
class ChainVerdict:
    extends RefCounted
    const DUR := 7.2
    var _nodes: Array = []
    var _links: Array = []
    func setup() -> void:
        var rng := AMath.ARng.new(90909)
        _nodes = [CASTER,
            Vector2(180, 84), Vector2(252, 66), Vector2(318, 96), Vector2(344, 150),
            Vector2(286, 178), Vector2(206, 188), Vector2(150, 140)]
        # A chain logic: hub-and-branch conduction order (authored)
        _links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [1, 6], [2, 5]]
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.7, "kind": "chain_launch", "pos_local": CASTER, "emitted": false}]
        for i in range(_links.size()):
            ev.append({"t": 1.2 + float(i) * 0.34, "kind": "link_impact", "pos_local": _nodes[int(_links[i][1])], "emitted": false})
        ev.append({"t": 5.0, "kind": "verdict_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 6.4, "kind": "strands_die", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        var die := 1.0 - AMath.seg(t, 6.4, 7.2)
        for i in range(_links.size()):
            var lt := t - (1.2 + float(i) * 0.34)
            if lt < 0.0:
                continue
            var a: Vector2 = _nodes[int(_links[i][0])]
            var b: Vector2 = _nodes[int(_links[i][1])]
            # chain strand (A): sagging catenary-ish ribbon
            var pts: Array = []
            for k in range(13):
                var s := float(k) / 12.0
                var p: Vector2 = a.lerp(b, s)
                p.y += sin(s * PI) * 7.0
                pts.append(p)
            var age_k := exp(-lt * 0.55) * die
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 1.1,
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * (0.25 + age_k * 0.6)
                    return AMath.R("volt", 0.3 + h * 0.5))
            # bolt (B two-colour + C density): re-struck each 0.12s window
            var win := floor(lt / 0.12)
            var wk := exp(-fmod(lt, 0.12) * 22.0) * die
            if wk > 0.03:
                var seed := i * 977 + int(win) * 131
                var bp := ADraw.bolt_path(a.x, a.y, b.x, b.y, 13.0, seed, 4)
                var hot := i % 2 == 0
                ADraw.bolt_draw(fb, bp, 2.4,
                    AMath.R("volt", 0.55) if hot else AMath.R("fire", 0.6),
                    AMath.R("volt", 0.98) if hot else AMath.R("fire", 0.95), wk)
                if i % 3 == 0:
                    var mid: Vector2 = bp[bp.size() / 2]
                    var bp2 := ADraw.bolt_path(mid.x, mid.y, mid.x + (AMath.hash2(seed, 7) - 0.5) * 44.0, mid.y + (AMath.hash2(seed, 8) - 0.5) * 36.0, 8.0, seed + 5, 3)
                    ADraw.bolt_draw(fb, bp2, 1.4, AMath.R("volt", 0.5), AMath.R("volt", 0.9), wk * 0.8)
            ADraw.glow(fb, b.x, b.y, 7.0, AMath.R("volt", 0.8), (0.3 + age_k) * die)
        if t > 5.0:
            ADraw.pulse_ring(fb, C.x, C.y, 8.0 + AMath.ease_out(AMath.seg(t, 5.0, 5.9), 2.0) * 120.0, 3.0, AMath.R("volt", 0.7), 0.5 * (1.0 - AMath.seg(t, 5.0, 6.2)))
