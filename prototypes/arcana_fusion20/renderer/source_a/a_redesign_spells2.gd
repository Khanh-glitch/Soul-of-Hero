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
            # Preserve the grown, branched morphology but map each entire
            # organism coherently onto a target-side anchor. Uniform rotation
            # and scale keep parent/child branch junctions connected.
            var root: Dictionary = bs[0]
            var root_pts: Array = root.pts
            var origin: Vector2 = root_pts[0]
            var old_axis: Vector2 = root_pts[root_pts.size() - 1] - origin
            var destination := C + Vector2(float(i - 1) * 12.0, 7.0 + float(i % 2) * 3.0)
            var new_axis := destination - origin
            var angle := new_axis.angle() - old_axis.angle()
            var scale := new_axis.length() / maxf(old_axis.length(), 0.001)
            var speed_factor := (1.0 / 2.2) / float(root.speed)
            for b in bs:
                var pts: Array = b.pts
                for j in range(pts.size()):
                    var point: Vector2 = pts[j]
                    pts[j] = origin + (point - origin).rotated(angle) * scale
                b.speed = float(b.speed) * speed_factor
            _roots.append(bs)
            _tips.append(destination)
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.8, "kind": "roots_germinate", "pos_local": CASTER, "emitted": false}]
        for i in range(_tips.size()):
            ev.append({"t": 3.0 + float(i) * 0.4, "kind": "root_tip_impact", "pos_local": _tips[i], "emitted": false})
        ev.append({"t": 5.4, "kind": "thorn_snap_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.2, "kind": "roots_retract", "pos_local": CASTER, "emitted": false})
        return ev
    func _visible_growth(growth: float, t: float) -> float:
        return growth * (1.0 - AMath.seg(t, 7.2, 8.4))
    func update(dt: float, t: float) -> void:
        for i in range(_roots.size()):
            # Main tips arrive on their authored 3.0/3.4/3.8 contact beats.
            ACommon.update_branches(_roots[i], maxf(0.0, t - 0.8 - float(i) * 0.4))
    func render(fb: AFramebuffer, t: float) -> void:
        var retract := 1.0 - AMath.seg(t, 7.2, 8.4)
        var tension := AMath.seg(t, 4.4, 5.4)
        for bs in _roots:
            for b in bs:
                var bb: Dictionary = (b as Dictionary).duplicate()
                bb.grow = _visible_growth(float(bb.grow), t)
                ACommon.draw_branch(fb, bb,
                    func(u: float, edge: float, br: Dictionary) -> Variant:
                        var h := (1.0 - edge) * retract
                        if h < 0.05:
                            return null
                        # Opaque woody core is geometry, not additive glow.
                        var bark := 0.35 + 0.65 * (1.0 - edge) * (1.0 - u * 0.3)
                        return Vector3(0.065, 0.16, 0.045) * bark,
                    func(u: float, br: Dictionary) -> float:
                        return maxf(1.0, float(br.w) * 2.1 * (1.0 - u * 0.6) * (1.0 + tension * 0.35)), true)
                ACommon.draw_branch(fb, bb,
                    func(u: float, edge: float, _br: Dictionary) -> Variant:
                        var h := (1.0 - edge) * retract
                        return AMath.R("verdant", 0.25 + h * 0.45) if h >= 0.05 else null,
                    func(u: float, br: Dictionary) -> float:
                        return maxf(0.6, float(br.w) * 0.38 * (1.0 - u * 0.6)))
        if tension > 0.0:
            for i in range(_tips.size()):
                var tp: Vector2 = _tips[i]
                var endpoint := tp.lerp(C, AMath.ease_in(tension, 2.0))
                var control := tp.lerp(C, 0.5) + Vector2(float(i - 1) * 5.0, -20.0 * sin(tension * PI * 0.75))
                var points: Array = []
                for step in range(13):
                    var u := float(step) / 12.0
                    points.append(tp * (1.0 - u) * (1.0 - u) + control * 2.0 * (1.0 - u) * u + endpoint * u * u)
                ADraw.ribbon(fb, points,
                    func(u: float, _j: int) -> float: return (2.8 - u * 2.0) * tension,
                    func(u: float, _j: int, edge: float) -> Variant:
                        return AMath.R("verdant", 0.35 + (1.0 - edge) * 0.4) * retract)
                # Two tapered barbs grow out of the arched tendon itself;
                # their bases follow its curve and point toward the target.
                for barb_value in [0.36, 0.68]:
                    var barb: float = barb_value
                    var base: Vector2 = tp * (1.0 - barb) * (1.0 - barb) + control * 2.0 * (1.0 - barb) * barb + endpoint * barb * barb
                    var tangent: Vector2 = ((control - tp) * (1.0 - barb) + (endpoint - control) * barb).normalized()
                    var side: Vector2 = Vector2(-tangent.y, tangent.x) * (-1.0 if i % 2 == 0 else 1.0)
                    var tip_point: Vector2 = base + (tangent * 6.0 + side * 8.0) * tension
                    var foot: Vector2 = tangent * 2.2 * tension
                    ADraw.poly_fill(fb, [base - foot, tip_point, base + foot],
                        func(_x: int, _y: int) -> Variant: return Vector3(0.12, 0.28, 0.07), true, tension * retract)
                    ADraw.streak(fb, base.x, base.y, tip_point.x, tip_point.y, 0.8, 0.4, AMath.R("verdant", 0.7), tension * retract * 0.5)
                ADraw.disc(fb, endpoint.x, endpoint.y, 1.5, AMath.R("verdant", 0.8), tension * retract)
        if t > 5.4 and t < 6.2:
            ADraw.pulse_ring(fb, C.x, C.y, 8.0 + AMath.seg(t, 5.4, 6.2) * 90.0, 2.6, AMath.R("verdant", 0.7), 0.5 * (1.0 - AMath.seg(t, 5.4, 6.2)), 1.5)

# ------------------------------------------- #14 spore nebula
class SporeNebulaR:
    extends RefCounted
    const DUR := 8.6
    var _colonies: Array = []
    var _links: Array = []
    # Each link grows from an already-founded colony; birth happens at the
    # first incoming link arrival. Later links are meaningful reconnections.
    var _births := [0.8, 2.2, 3.0, 3.6, 4.2, 2.9]
    var _link_times := [[1.2, 2.2], [2.2, 2.9], [2.9, 3.6], [3.6, 4.2], [2.2, 3.0], [3.0, 4.2], [2.9, 3.4]]
    var _ps: ADraw.APool
    func setup() -> void:
        var rng := AMath.ARng.new(14141)
        _ps = ADraw.APool.new()
        _colonies = [CASTER + Vector2(16, -6), Vector2(176, 96), Vector2(232, 142), Vector2(292, 92), Vector2(330, 146), Vector2(206, 66)]
        _links = [[0, 1], [1, 5], [5, 3], [3, 4], [1, 2], [2, 4], [5, 2]]
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.8, "kind": "seed_plant", "pos_local": _colonies[0], "emitted": false}]
        for i in range(1, _colonies.size()):
            ev.append({"t": float(_births[i]), "kind": "colony_contact", "pos_local": _colonies[i], "emitted": false})
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
            var timing: Array = _link_times[i]
            var start: float = timing[0]
            var end: float = timing[1]
            var u := AMath.cl01(AMath.seg(t, start, end))
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
                func(s: float, _i: int) -> float: return 2.0,
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * fade
                    if h < 0.05:
                        return null
                    return AMath.R("bio", 0.3 + h * 0.5))
            # One legible signal propagates along completed links in the
            # same graph order, reaching the network before sporulation.
            var pulse_start := 4.15 + (start - 1.2) * 0.35
            var pulse_end := 4.15 + (end - 1.2) * 0.35
            if t >= pulse_start and t < pulse_end:
                var pu := AMath.seg(t, pulse_start, pulse_end)
                var pp: Vector2 = a.lerp(b, pu)
                pp.y += sin(pu * PI) * 5.0 + (AMath.hash2(floor(pu * 12.0), float(i)) - 0.5) * 3.0
                ADraw.disc(fb, pp.x, pp.y, 2.2, AMath.R("bio", 0.9), fade)
                ADraw.glow(fb, pp.x, pp.y, 5.0, AMath.R("bio", 0.7), fade * 0.6)
        for i in range(_colonies.size()):
            var g := AMath.seg(t, float(_births[i]), float(_births[i]) + 0.75)
            if g <= 0.0:
                continue
            var c: Vector2 = _colonies[i]
            var pul := 1.0 + 0.18 * sin(t * 2.4 + float(i) * 1.7)
            # A small anchored fungal cap and stem, not an anonymous point
            # light: covered dark material supports the bioluminescent rim.
            # Keep the cap and its stem legible at the actual world scale;
            # growth still originates at the authored arrival, not a light.
            var size := (6.0 + g * 10.0) * pul
            var cap_y := c.y - size * 0.35
            ADraw.poly_fill(fb, [c + Vector2(-size * 0.14, 1.0), c + Vector2(size * 0.14, 1.0),
                Vector2(c.x + size * 0.18, cap_y), Vector2(c.x - size * 0.18, cap_y)],
                func(_x: int, _y: int) -> Variant: return Vector3(0.06, 0.16, 0.10), true, g * fade)
            ADraw.poly_fill(fb, [Vector2(c.x - size, cap_y), Vector2(c.x - size * 0.6, cap_y - size * 0.45),
                Vector2(c.x, cap_y - size * 0.65), Vector2(c.x + size * 0.6, cap_y - size * 0.45), Vector2(c.x + size, cap_y)],
                func(_x: int, _y: int) -> Variant: return Vector3(0.045, 0.14, 0.11), true, g * fade)
            ADraw.streak(fb, c.x - size, cap_y, c.x + size, cap_y, 1.4, 1.0, AMath.R("bio", 0.75), g * fade * 0.8)
            # Short radial gills describe the cap rather than adding a
            # second detached particle or a screen-space halo.
            for gill_value in [-0.5, 0.0, 0.5]:
                var gill: float = gill_value
                ADraw.streak(fb, c.x + size * gill * 0.45, cap_y - size * 0.34,
                    c.x + size * gill, cap_y - size * 0.04, 0.8, 0.5,
                    AMath.R("bio", 0.6), g * fade * 0.65)
            ADraw.glow(fb, c.x, cap_y, 10.0 * g, AMath.R("bio", 0.7), 0.45 * g * fade)
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
    func _release(index: int, t: float) -> float:
        var begin := 5.0 + float(_crystals.size() - 1 - index) * 0.2
        # Staggered reverse release, common arrival at the single 6.2 impact.
        return AMath.seg(t, begin, 6.2)
    func _resolve(index: int, t: float) -> float:
        var begin := 7.4 + float(_crystals.size() - 1 - index) * 0.16
        return 1.0 - AMath.seg(t, begin, begin + 0.36)
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        # pre-echo: ghost of the final convergence shown first (temporal logic)
        if t < 2.0:
            var gk := AMath.seg(t, 0.9, 1.05) * (1.0 - AMath.seg(t, 1.4, 2.0)) * 0.35
            ADraw.ring_shape(fb, C.x, C.y, 30.0, 1.4, AMath.R("frost", 0.7), gk)
        for i in range(_crystals.size()):
            var c: Dictionary = _crystals[i]
            var pos: Vector2 = c.pos
            var cap_t: float = c.cap
            var form := AMath.seg(t, 0.9 + float(i) * 0.24, 1.7 + float(i) * 0.24)
            if form <= 0.0:
                continue
            var captured := AMath.seg(t, cap_t, cap_t + 0.4)
            var rel := _release(i, t)
            var resolve := _resolve(i, t)
            var cur: Vector2 = pos.lerp(C, AMath.ease_in(rel, 2.0))
            # B astral.ts:216-243 study: six-vertex 17px crystal, dark
            # covered face, violet faceted frame. This is not the complete B
            # clipped attack contents or a claim of B raster/source parity.
            var impact_fold := 1.0 - 0.8 * AMath.seg(t, 6.2, 6.8)
            var sz: float = 17.0 * form * (1.0 - rel * 0.5) * resolve * impact_fold
            if sz <= 0.5:
                continue
            var rotation := t * (0.4 + float(i) * 0.15) * (-1.0 if i % 2 == 0 else 1.0)
            var hex: Array = []
            for q in range(6):
                var angle := rotation + float(q) / 6.0 * TAU
                hex.append(cur + Vector2(cos(angle) * sz, sin(angle) * sz * 0.85))
            ADraw.poly_fill(fb, hex, func(_x: int, _y: int) -> Variant: return Vector3(0.03, 0.02, 0.08), true, 0.75 * resolve)
            for q in range(6):
                var a: Vector2 = hex[q]
                var b: Vector2 = hex[(q + 1) % 6]
                ADraw.line(fb, a.x, a.y, b.x, b.y, Vector3(1.2, 1.4, 2.0), resolve * 0.75)
                if q % 2 == 0:
                    ADraw.line(fb, cur.x, cur.y, a.x, a.y, Vector3(0.6, 0.6, 1.2), resolve * 0.35)
            # An explicit temporal mark within the frame, not a substitute
            # for B's still-unported clipped miniature attack.
            if captured > 0.0:
                var mark := Vector3(1.8, 1.3, 0.5) if i % 2 == 0 else Vector3(0.5, 0.9, 2.0)
                ADraw.streak(fb, cur.x - sz * 0.35, cur.y, cur.x + sz * 0.35, cur.y - sz * 0.15, 0.7, 0.3, mark, captured * resolve * 0.7)
            ADraw.glow(fb, cur.x, cur.y, sz * 1.4, AMath.R("frost", 0.75), captured * resolve * 0.35)
            if captured > 0.0 and rel < 1.0:
                ADraw.streak(fb, cur.x, cur.y, C.x, C.y, 0.7, 0.3, AMath.R("frost", 0.6), captured * 0.4 * resolve)
        var it := t - 6.2
        if it >= 0.0 and it < 0.7:
            ADraw.disc(fb, C.x, C.y, 5.0 * (1.0 - it / 0.7), AMath.R("frost", 1.0), 1.0 - it / 0.7)
            ADraw.pulse_ring(fb, C.x, C.y, 6.0 + it * 150.0, 3.0, AMath.R("frost", 0.8), 0.65 * (1.0 - it / 0.7), 1.35)
