## REDESIGN_CANDIDATE spells (#13/#14/#18): biomechanical root growth,
## causal fungal network, coherent temporal crystal sequencing.
## Per FUSION_DECISIONS. Never Gold-final.
extends RefCounted
class_name ARedesignSpells2

const C := Vector2(232, 124)
const CASTER := Vector2(104, 150)

# ------------------------------------------- #13 rootwake
class RootwakeR:
    extends RefCounted
    const DUR := 8.4
    var _roots: Array = []
    var _tips: Array = []
    func setup() -> void:
        var rng := AMath.ARng.new(13131)
        _roots.clear()
        _tips.clear()
        for i in range(3):
            var bs: Array = ACommon.grow_branches(rng, CASTER.x + 10.0, CASTER.y - 4.0,
                -0.7 + float(i) * 0.55, 3.0, {"steps": 12, "step": 5.4, "wander": 0.2, "branch_chance": 0.35, "max_depth": 2, "width_falloff": 0.5, "speed": 1.5})
            _roots.append(bs)
            for b in bs:
                if int(b.depth) == 0:
                    var pts: Array = b.pts
                    _tips.append(pts[pts.size() - 1])
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.8, "kind": "roots_germinate", "pos_local": CASTER, "emitted": false}]
        for i in range(_tips.size()):
            ev.append({"t": 3.0 + float(i) * 0.4, "kind": "root_tip_impact", "pos_local": _tips[i], "emitted": false})
        ev.append({"t": 5.4, "kind": "thorn_snap_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.2, "kind": "roots_retract", "pos_local": CASTER, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        for bs in _roots:
            ACommon.update_branches(bs, t - 0.8)
    func render(fb: AFramebuffer, t: float) -> void:
        var retract := 1.0 - AMath.seg(t, 7.2, 8.4)
        var tension := AMath.seg(t, 4.4, 5.4)
        for bs in _roots:
            for b in bs:
                var bb: Dictionary = b
                ACommon.draw_branch(fb, bb,
                    func(u: float, edge: float, br: Dictionary) -> Variant:
                        var h := (1.0 - edge) * retract
                        if h < 0.05:
                            return null
                        return AMath.R("verdant", 0.22 + h * 0.5 + tension * 0.2 * (1.0 - u)),
                    func(u: float, br: Dictionary) -> float:
                        return maxf(0.7, float(br.w) * (1.0 - u * 0.6) * (1.0 + tension * 0.35)))
        if tension > 0.0:
            for tip in _tips:
                var tp: Vector2 = tip
                ADraw.streak(fb, tp.x, tp.y, tp.x + 6.0, tp.y - 14.0 * tension, 1.8, 0.5, AMath.R("verdant", 0.8), tension * retract)
                ADraw.glow(fb, tp.x, tp.y - 14.0 * tension, 6.0, AMath.R("verdant", 0.85), tension * retract)
        if t > 5.4 and t < 6.2:
            ADraw.pulse_ring(fb, C.x, C.y, 8.0 + AMath.seg(t, 5.4, 6.2) * 90.0, 2.6, AMath.R("verdant", 0.7), 0.5 * (1.0 - AMath.seg(t, 5.4, 6.2)), 1.5)

# ------------------------------------------- #14 spore nebula
class SporeNebulaR:
    extends RefCounted
    const DUR := 8.6
    var _colonies: Array = []
    var _links: Array = []
    var _ps: ADraw.APool
    func setup() -> void:
        var rng := AMath.ARng.new(14141)
        _ps = ADraw.APool.new()
        _colonies = [CASTER + Vector2(16, -6), Vector2(176, 96), Vector2(232, 142), Vector2(292, 92), Vector2(330, 146), Vector2(206, 66)]
        _links = [[0, 1], [1, 5], [5, 3], [3, 4], [1, 2], [2, 4], [5, 2]]
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.8, "kind": "seed_plant", "pos_local": _colonies[0], "emitted": false}]
        for i in range(1, _colonies.size()):
            ev.append({"t": 1.4 + float(i) * 0.5, "kind": "colony_contact", "pos_local": _colonies[i], "emitted": false})
        ev.append({"t": 5.4, "kind": "sporulation_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.4, "kind": "spores_drift", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        if t > 5.4 and t < 7.6:
            var rng := AMath.ARng.new(int(t * 977.0) + 9)
            if rng.next() < 0.85:
                var c: Vector2 = _colonies[rng.intf(0, _colonies.size() - 1)]
                _ps.spawn({"x": c.x, "y": c.y, "vx": rng.rangef(-16, 22), "vy": rng.rangef(-30, -8), "life": rng.rangef(1.0, 2.2), "size": rng.rangef(0.7, 1.6), "k": 0.9, "seed": rng.next() * 80.0})
        _ps.step(dt, 0.0)
    func render(fb: AFramebuffer, t: float) -> void:
        var fade := 1.0 - AMath.seg(t, 7.6, 8.6)
        # hyphal links grow colony-to-colony (causal propagation)
        for i in range(_links.size()):
            var u := AMath.clampf(AMath.seg(t, 1.2 + float(i) * 0.42, 2.2 + float(i) * 0.42))
            if u <= 0.0:
                continue
            var a: Vector2 = _colonies[int(_links[i][0])]
            var b: Vector2 = _colonies[int(_links[i][1])]
            var pts: Array = []
            for k in range(13):
                var s := u * float(k) / 12.0
                var p: Vector2 = a.lerp(b, s)
                p.y += sin(s * PI) * 5.0 + (AMath.hash2(float(k), float(i)) - 0.5) * 3.0
                pts.append(p)
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 1.0,
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * fade
                    if h < 0.05:
                        return null
                    return AMath.R("bio", 0.3 + h * 0.5))
            # signal pulse travelling the finished link
            if u >= 1.0 and t > 4.2:
                var pu := fmod(t * 0.55 + float(i) * 0.31, 1.0)
                var pp: Vector2 = a.lerp(b, pu)
                ADraw.glow(fb, pp.x, pp.y, 5.0, AMath.R("bio", 0.9), fade)
        for i in range(_colonies.size()):
            var g := AMath.seg(t, 0.8 + float(i) * 0.5, 1.8 + float(i) * 0.5)
            if g <= 0.0:
                continue
            var c: Vector2 = _colonies[i]
            var pul := 1.0 + 0.18 * sin(t * 2.4 + float(i) * 1.7)
            ADraw.disc(fb, c.x, c.y, (3.0 + g * 5.0) * pul, AMath.R("bio", 0.45 + g * 0.3), fade)
            ADraw.glow(fb, c.x, c.y, 12.0 * g, AMath.R("bio", 0.7), 0.7 * g * fade)
        if t > 5.4 and t < 6.2:
            ADraw.pulse_ring(fb, C.x, C.y, 8.0 + AMath.seg(t, 5.4, 6.2) * 110.0, 2.8, AMath.R("bio", 0.75), 0.55 * (1.0 - AMath.seg(t, 5.4, 6.2)), 1.4)
        _ps.each(func(p: Dictionary) -> void:
            var l := float(p.life) / float(p.max)
            ADraw.streak_p(fb, p, AMath.R("bio", 0.4 + l * 0.5), l * fade))

# ------------------------------------------- #18 chronoshard
class ChronoshardR:
    extends RefCounted
    const DUR := 8.4
    var _crystals: Array = []
    func setup() -> void:
        var rng := AMath.ARng.new(18181)
        _crystals.clear()
        for i in range(5):
            var a := -1.9 + float(i) * 0.62
            _crystals.append({"pos": Vector2(C.x + cos(a) * (58.0 + float(i % 2) * 22.0), C.y - 26.0 + sin(a) * 44.0), "size": rng.rangef(7, 13), "seed": rng.intf(0, 999), "cap": 2.2 + float(i) * 0.5})
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.9, "kind": "pre_echo", "pos_local": C, "emitted": false}]
        for i in range(_crystals.size()):
            ev.append({"t": float(_crystals[i].cap), "kind": "event_captured", "pos_local": _crystals[i].pos, "emitted": false})
        ev.append({"t": 6.2, "kind": "synchronized_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.4, "kind": "fragments_resolve", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        var resolve := 1.0 - AMath.seg(t, 7.4, 8.4)
        # pre-echo: ghost of the final convergence shown first (temporal logic)
        if t < 2.0:
            var gk := (1.0 - AMath.seg(t, 1.4, 2.0)) * 0.35
            ADraw.ring_shape(fb, C.x, C.y, 30.0, 1.4, AMath.R("frost", 0.7), gk)
        for i in range(_crystals.size()):
            var c: Dictionary = _crystals[i]
            var pos: Vector2 = c.pos
            var cap_t: float = c.cap
            var form := AMath.seg(t, 0.9 + float(i) * 0.24, 1.7 + float(i) * 0.24)
            if form <= 0.0:
                continue
            var captured := AMath.seg(t, cap_t, cap_t + 0.4)
            var rel := AMath.seg(t, 5.6, 6.2)
            var cur: Vector2 = pos.lerp(C, AMath.ease_in(rel, 2.0))
            var sz: float = float(c.size) * form * (1.0 - rel * 0.55) * resolve
            if sz <= 0.5:
                continue
            var bright := 0.45 + captured * 0.4 + rel * 0.3
            ACommon.shard(fb, cur.x, cur.y, sz, -0.4 + float(i) * 0.2, 6, int(c.seed),
                func(u: float, _edge: float) -> Variant:
                    return AMath.R("frost", bright * (1.0 - u * 0.5)))
            ADraw.glow(fb, cur.x, cur.y, sz * 1.4, AMath.R("frost", 0.75), captured * resolve)
            if captured > 0.0 and rel < 1.0:
                ADraw.streak(fb, cur.x, cur.y, C.x, C.y, 0.7, 0.3, AMath.R("frost", 0.6), captured * 0.4 * resolve)
        var it := t - 6.2
        if it >= 0.0 and it < 0.7:
            ADraw.disc(fb, C.x, C.y, 5.0 * (1.0 - it / 0.7), AMath.R("frost", 1.0), 1.0 - it / 0.7)
            ADraw.pulse_ring(fb, C.x, C.y, 6.0 + it * 150.0, 3.0, AMath.R("frost", 0.8), 0.65 * (1.0 - it / 0.7), 1.35)
