## Authored FUSION_CANDIDATE interpretations on the A framebuffer.
## #11/#16/#20 do not run the selected original A/C spell components;
## source preservation, real actor/terrain interaction and visual quality
## remain open. See FUSION_REDESIGN_AUDIT.md.
extends RefCounted
class_name AFusionSpells2

const C := Vector2(232, 124)
const CASTER := Vector2(104, 150)

# ---------------------------------------------------------------- #11
class VoltCarousel:
    extends RefCounted
    const DUR := 8.0
    var _conns: Array = []
    func setup() -> void:
        var rng := AMath.ARng.new(11111)
        _conns.clear()
        for i in range(6):
            _conns.append({"a0": (float(i) / 6.0) * AMath.TAU, "r": 62.0 + float(i % 2) * 26.0, "sp": (0.9 if i % 2 == 0 else -0.65), "ph": rng.rangef(0, 6)})
    func _conn_pos(c: Dictionary, t: float) -> Vector2:
        var a: float = float(c.a0) + float(c.sp) * t
        return Vector2(C.x + cos(a) * float(c.r), C.y + sin(a) * float(c.r) * 0.72)
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.9, "kind": "carousel_spinup", "pos_local": C, "emitted": false}]
        for i in range(6):
            var event_t := 2.2 + float(i) * 0.55
            ev.append({"t": event_t, "kind": "conduction_impact", "pos_local": _conn_pos(_conns[i], event_t), "emitted": false})
        ev.append({"t": 5.6, "kind": "alignment_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.2, "kind": "rotors_fracture", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        var spin := AMath.ease_out(AMath.seg(t, 0.9, 2.2), 2.0)
        var brake := 1.0 - AMath.seg(t, 7.2, 8.0)
        var speed_k := spin * brake
        var tt := t * (0.35 + speed_k * 0.65)
        ADraw.arc_px(fb, C.x, C.y, 62.0, 0.0, AMath.TAU, AMath.R("volt", 0.5), 0.6 * speed_k, 1.38)
        ADraw.arc_px(fb, C.x, C.y, 88.0, 0.0, AMath.TAU, AMath.R("volt", 0.45), 0.5 * speed_k, 1.38)
        for i in range(_conns.size()):
            var c: Dictionary = _conns[i]
            var p := _conn_pos(c, tt)
            var n: Dictionary = _conns[(i + 1) % _conns.size()]
            var q := _conn_pos(n, tt)
            if speed_k > 0.05:
                var seg_pts := ADraw.bolt_path(p.x, p.y, q.x, q.y, 9.0, i * 331 + int(floor(t * 9.0)) * 17, 4)
                var wk := (0.35 + 0.65 * absf(sin(t * 7.0 + float(c.ph)))) * speed_k
                ADraw.bolt_draw(fb, seg_pts, 1.9, AMath.R("volt", 0.55), AMath.R("volt", 0.97), wk)
                var sp := ADraw.bolt_path(p.x, p.y, C.x, C.y, 7.0, i * 733 + int(floor(t * 9.0)) * 29, 3)
                ADraw.bolt_draw(fb, sp, 1.3, AMath.R("volt", 0.5), AMath.R("volt", 0.9), wk * 0.8)
            ADraw.disc(fb, p.x, p.y, 3.0, AMath.R("volt", 0.85), speed_k)
            ADraw.glow(fb, p.x, p.y, 9.0, AMath.R("volt", 0.7), 0.7 * speed_k)
        ADraw.glow(fb, C.x, C.y, 15.0 + sin(t * 5.0) * 3.0, AMath.R("volt", 0.9), 0.8 * speed_k)
        if t > 5.6 and t < 6.4:
            ADraw.pulse_ring(fb, C.x, C.y, 10.0 + AMath.seg(t, 5.6, 6.4) * 130.0, 3.0, AMath.R("volt", 0.75), 0.6 * (1.0 - AMath.seg(t, 5.6, 6.4)))

# ---------------------------------------------------------------- #16
class Worldseed:
    extends RefCounted
    const DUR := 8.2
    var _petals: Array = []
    var _ps: ADraw.APool
    func setup() -> void:
        var rng := AMath.ARng.new(16161)
        _ps = ADraw.APool.new()
        _petals.clear()
        for layer in range(3):
            for i in range(6):
                _petals.append({"a": (float(i) / 6.0) * AMath.TAU + float(layer) * 0.5, "len": 34.0 + float(layer) * 22.0 + rng.rangef(-6, 8), "w": 9.0 + float(layer) * 4.0, "layer": layer, "curl": rng.rangef(-0.6, 0.6)})
    func authored_events() -> Array:
        return [
            {"t": 0.7, "kind": "seed_crack", "pos_local": C, "emitted": false},
            {"t": 2.0, "kind": "first_unfold", "pos_local": C, "emitted": false},
            {"t": 4.2, "kind": "petal_expansion_impact", "pos_local": C + Vector2(70, 0), "emitted": false},
            {"t": 6.4, "kind": "full_bloom", "pos_local": C, "emitted": false},
            {"t": 7.4, "kind": "petals_fold", "pos_local": C, "emitted": false},
        ]
    func update(dt: float, t: float) -> void:
        if t > 6.4 and t < 7.8:
            var rng := AMath.ARng.new(int(t * 977.0) + 4)
            if rng.next() < 0.7:
                _ps.spawn({"x": C.x + rng.rangef(-50, 50), "y": C.y + rng.rangef(-30, 20), "vx": rng.rangef(-8, 14), "vy": rng.rangef(-16, -4), "life": rng.rangef(0.8, 1.8), "size": 1.1, "k": 0.8, "seed": rng.next() * 90.0})
        _ps.step(dt, 0.0)
    func render(fb: AFramebuffer, t: float) -> void:
        var fold := 1.0 - AMath.seg(t, 7.4, 8.2)
        ADraw.disc(fb, C.x, C.y, 5.0 + AMath.seg(t, 0.7, 2.0) * 4.0, AMath.R("verdant", 0.55), fold)
        for p in _petals:
            var layer: int = int(p.layer)
            var u := AMath.cl01(AMath.seg(t, 2.0 + float(layer) * 0.9, 4.2 + float(layer) * 0.9))
            u *= fold
            if u <= 0.0:
                continue
            var pts: Array = []
            for i in range(10):
                var s := float(i) / 9.0
                var a: float = float(p.a) + float(p.curl) * s * s + sin(t * 0.8 + float(p.a)) * 0.03
                var rr := 6.0 + float(p.len) * AMath.ease_out(u, 2.2) * s
                pts.append(Vector2(C.x + cos(a) * rr, C.y - 4.0 - s * 10.0 + sin(a) * rr * 0.62))
            var pw: float = p.w
            var lay := layer
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return pw * sin(s * PI * 0.9),
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * (1.0 - s * 0.35)
                    if h < 0.05:
                        return null
                    return AMath.R("verdant", 0.3 + h * 0.62) if lay < 2 else AMath.R("bloom", 0.35 + h * 0.6))
        ADraw.glow(fb, C.x, C.y - 6.0, 20.0, AMath.R("bloom", 0.85), AMath.seg(t, 4.2, 6.4) * fold)
        _ps.each(func(p: Dictionary) -> void:
            var l := float(p.life) / float(p.max)
            ADraw.streak_p(fb, p, AMath.R("verdant", 0.5 + l * 0.4), l))

# ---------------------------------------------------------------- #20
class RealityRipper:
    extends RefCounted
    const DUR := 7.8
    var _shards: Array = []
    func setup() -> void:
        var rng := AMath.ARng.new(20202)
        _shards.clear()
        for i in range(16):
            var a := rng.rangef(0, AMath.TAU)
            _shards.append({"a": a, "sp": rng.rangef(60, 210), "size": rng.rangef(2, 5), "spin": rng.rangef(-4, 4), "del": rng.rangef(0, 0.25)})
    func authored_events() -> Array:
        return [
            {"t": 1.0, "kind": "rift_tear", "pos_local": C, "emitted": false},
            {"t": 2.8, "kind": "rift_widen", "pos_local": C, "emitted": false},
            {"t": 4.4, "kind": "external_impact", "pos_local": C, "emitted": false},
            {"t": 5.6, "kind": "debris_return", "pos_local": C, "emitted": false},
            {"t": 7.0, "kind": "rift_seal", "pos_local": C, "emitted": false},
        ]
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        var tear := AMath.ease_out(AMath.seg(t, 1.0, 2.2), 2.0)
        var widen := AMath.seg(t, 2.8, 4.2)
        var seal := 1.0 - AMath.seg(t, 7.0, 7.8)
        var hw := (8.0 + widen * 65.0) * tear * seal
        var hh := (26.0 + widen * 30.0) * tear * seal
        if hw > 0.5:
            ADraw.field(fb, C.x - hw - 8.0, C.y - hh - 8.0, C.x + hw + 8.0, C.y + hh + 8.0, func(x: int, y: int, out: Array) -> void:
                var dx := float(x) + 0.5 - C.x
                var dy := float(y) + 0.5 - C.y
                var jag := (AMath.hash2(floor(dy * 0.5), 3.0) - 0.5) * 10.0
                var d := absf(dx - jag * AMath.cl01(1.0 - absf(dy) / hh)) / maxf(1.0, hw) + absf(dy) / maxf(1.0, hh)
                if d > 1.0:
                    return
                var edge := AMath.cl01(1.0 - absf(d - 0.82) * 6.0)
                var core := AMath.cl01(1.0 - d)
                var c := AMath.R("astral", 0.25 + core * 0.4)
                out[0] = c.x * core * 0.35 + 1.9 * edge
                out[1] = c.y * core * 0.35 + 1.7 * edge
                out[2] = c.z * core * 0.5 + 2.1 * edge)
            ADraw.glow(fb, C.x, C.y, 40.0 + widen * 30.0, AMath.R("astral", 0.7), 0.5 * tear * seal)
        if t > 4.4:
            var e := t - 4.4
            for s in _shards:
                var lt := e - float(s.del)
                if lt < 0.0 or lt > 1.6:
                    continue
                var back := AMath.seg(t, 5.6, 6.8)
                var dist: float = float(s.sp) * lt * (1.0 - back * back)
                var x := C.x + cos(float(s.a)) * dist
                var y := C.y + sin(float(s.a)) * dist * 0.7 - lt * 12.0 * (1.0 - back)
                ACommon.shard(fb, x, y, float(s.size), float(s.a) + lt * float(s.spin), 5, int(float(s.a) * 100.0),
                    func(u: float, _edge: float) -> Variant:
                        return AMath.R("astral", 0.5 + (1.0 - u) * 0.45))
            if e < 0.8:
                ADraw.pulse_ring(fb, C.x, C.y, 6.0 + e * 190.0, 3.5, AMath.R("astral", 0.8), 0.7 * (1.0 - e / 0.8), 1.3)
