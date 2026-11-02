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
    func _root_curve(origin: Vector2, target: Vector2, index: int, u: float) -> Vector2:
        # A stable bowed path, with a staggered side-to-side exploratory bend.
        var delta := target - origin
        var normal := Vector2(-delta.y, delta.x).normalized()
        # Distinct asymmetrical exploratory trajectories rather than three
        # concentric arcs. Endpoints stay exact for the real source cue.
        var bend: float = [-23.0, 8.0, 34.0][index]
        var phase: float = [0.1, 1.7, 3.0][index]
        var skew := pow(u, [0.65, 1.25, 0.85][index])
        return origin.lerp(target, u) + normal * sin(PI * u) * (bend + 10.0 * sin(skew * TAU + phase))
    func setup() -> void:
        _roots.clear()
        _tips.clear()
        for i in range(3):
            var origin: Vector2 = CASTER + [Vector2(4, -12), Vector2(10, -4), Vector2(14, 6)][i]
            # Unequal destinations form a spreading root system, not the
            # closed lens made by three trunks reconverging at one point.
            var destination: Vector2 = C + [Vector2(-28, -38), Vector2(0, 10), Vector2(-12, 42)][i]
            var points: Array = []
            for n in range(25):
                points.append(_root_curve(origin, destination, i, float(n) / 24.0))
            var bs: Array = [{"pts": points, "w": [2.0, 5.4, 2.6][i], "depth": 0, "grow": 0.0, "seed": 13131 + i, "attach": 0.0}]
            # Each trunk has its own irregular branch population and origin
            # beats; do not reconstruct the rejected uniform cage.
            for j in range([2, 4, 3][i]):
                var attach: float = [0.16, 0.37, 0.58, 0.79][j] + float(i) * 0.035
                # Parent node and child start are literally the same point.
                var parent_index := roundi(float(attach) * 24.0)
                attach = float(parent_index) / 24.0
                var base: Vector2 = points[parent_index]
                var tangent: Vector2 = (points[mini(parent_index + 1, 24)] - points[maxi(parent_index - 1, 0)]).normalized()
                var normal := Vector2(-tangent.y, tangent.x) * (-1.0 if (i + j) % 2 == 0 else 1.0)
                var child: Array = []
                for n in range(13):
                    var u := float(n) / 12.0
                    var seed := float(i * 4 + j)
                    var reach := 12.0 + 16.0 * AMath.hash2(seed, 13.0)
                    var spread := 9.0 + 17.0 * AMath.hash2(seed, 17.0)
                    child.append(base + tangent * (reach * u) + normal * (spread * sin(u * PI * 0.5) + (2.0 + 7.0 * AMath.hash2(seed, 23.0)) * u * u))
                bs.append({"pts": child, "w": 1.8 - float(j) * 0.15, "depth": 1, "grow": 0.0, "seed": 13300 + i * 4 + j, "attach": attach})
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
            var main_growth := AMath.cl01((t - 0.8 - float(i) * 0.4) / 2.2)
            _roots[i][0].grow = main_growth
            for j in range(1, _roots[i].size()):
                var branch: Dictionary = _roots[i][j]
                var attach := float(branch.attach)
                # A branch cannot emerge before its parent reaches its base.
                branch.grow = AMath.cl01((main_growth - attach) / 0.22)
    func _lifted_points(branch: Dictionary, lift: float) -> Array:
        var result: Array = []
        var pts: Array = branch.pts
        var attach := float(branch.attach)
        for n in range(pts.size()):
            var u := float(n) / float(pts.size() - 1)
            var along := u if int(branch.depth) == 0 else lerpf(attach, 1.0, u)
            var point: Vector2 = pts[n]
            # All child junctions inherit exactly the parent's loaded bend.
            result.append(point - Vector2(lift * 0.38, lift) * sin(PI * along))
        return result
    func render(fb: AFramebuffer, t: float) -> void:
        var retract := 1.0 - AMath.seg(t, 7.2, 8.4)
        var tension := AMath.seg(t, 4.0, 5.4) * retract
        var thickening := AMath.seg(t, 1.6, 3.6)
        for bs in _roots:
            var main: Dictionary = bs[0]
            var visible_main := _visible_growth(float(main.grow), t)
            for b in bs:
                var bb: Dictionary = (b as Dictionary).duplicate()
                var attach := float(bb.attach)
                bb.grow = visible_main if int(bb.depth) == 0 else float(bb.grow) * AMath.cl01((visible_main - attach) / (1.0 - attach))
                bb.pts = _lifted_points(bb, tension * 15.0)
                ACommon.draw_branch(fb, bb,
                    func(u: float, edge: float, br: Dictionary) -> Variant:
                        if edge > 0.95:
                            return Vector3(0.09, 0.13, 0.06)
                        var grain := 0.84 + 0.16 * AMath.hash2(floor(u * 35.0), float(br.seed))
                        var bark := 0.62 + 0.38 * (1.0 - edge)
                        return Vector3(0.32, 0.30, 0.13) * bark * grain,
                    func(u: float, br: Dictionary) -> float:
                        return maxf(0.8, float(br.w) * (0.65 + thickening * 1.45) * (1.0 - u * 0.65)), true)
                ACommon.draw_branch(fb, bb,
                    func(u: float, edge: float, _br: Dictionary) -> Variant:
                        if edge > 0.8: return null
                        return Vector3(0.37, 0.48, 0.18) * (1.0 - edge * 0.4),
                    func(u: float, br: Dictionary) -> float:
                        return maxf(0.5, float(br.w) * 0.35 * (1.0 - u * 0.6)))
        if tension > 0.0:
            # One principal target-driven thorn, supported by the other two
            # unequal living trunks; three equal arches made a static cage.
            for i in [1]:
                var main: Dictionary = _roots[i][0]
                var visible_main := _visible_growth(float(main.grow), t)
                var attached := AMath.cl01((visible_main - 0.75) / 0.25)
                if attached <= 0.001:
                    continue
                var raised: Array = _lifted_points(main, tension * 15.0)
                # Begin exactly on an existing main-root node, not in midair.
                var tp: Vector2 = raised[18]
                var endpoint: Vector2 = tp.lerp(_tips[i], AMath.ease_in(tension, 2.0) * attached)
                var control := tp.lerp(endpoint, 0.5) + Vector2(float(i - 1) * 7.0, -34.0 * tension * attached)
                var points: Array = []
                for step in range(13):
                    var u := float(step) / 12.0
                    points.append(tp * (1.0 - u) * (1.0 - u) + control * 2.0 * (1.0 - u) * u + endpoint * u * u)
                ADraw.ribbon(fb, points,
                    func(u: float, _j: int) -> float: return (5.6 - u * 3.7) * tension * attached,
                    func(_u: float, _j: int, edge: float) -> Variant:
                        return Vector3(0.16, 0.24, 0.07) if edge > 0.65 else Vector3(0.35, 0.42, 0.13), true, retract)
                # A single prominent wedge is grown out of the same arch
                # and aims toward the target with the visible tension. This
                # remains visual-only: no asserted contact or on-body effect.
                var attack := AMath.ease_in(AMath.seg(t, 4.65, 5.4), 2.0) * attached * retract
                var direction: Vector2 = (_tips[i] as Vector2 - tp).normalized()
                var thorn_side := Vector2(-direction.y, direction.x)
                var thorn_base: Vector2 = points[8]
                var point: Vector2 = thorn_base.lerp(_tips[i] + direction * 15.0, attack)
                var thorn_foot := thorn_side * (6.5 * attack)
                if attack > 0.0:
                    ADraw.poly_fill(fb, [thorn_base - thorn_foot, point, thorn_base + thorn_foot],
                        func(_x: int, _y: int) -> Variant: return Vector3(0.33, 0.42, 0.12), true, attack)
                    ADraw.streak(fb, thorn_base.x, thorn_base.y, point.x, point.y, 0.9, 0.35, AMath.R("verdant", 0.9), attack * 0.6)
                # Two actual barbs have their bases on the same arch.
                for barb_value in [0.36, 0.68]:
                    var barb: float = barb_value
                    var base: Vector2 = tp * (1.0 - barb) * (1.0 - barb) + control * 2.0 * (1.0 - barb) * barb + endpoint * barb * barb
                    var tangent: Vector2 = ((control - tp) * (1.0 - barb) + (endpoint - control) * barb).normalized()
                    var side: Vector2 = Vector2(-tangent.y, tangent.x) * (-1.0 if i % 2 == 0 else 1.0)
                    var tip_point: Vector2 = base + (tangent * 8.0 + side * 9.0) * tension * attached
                    var foot: Vector2 = tangent * 2.8 * tension * attached
                    ADraw.poly_fill(fb, [base - foot, tip_point, base + foot],
                        func(_x: int, _y: int) -> Variant: return Vector3(0.19, 0.31, 0.08), true, tension * retract * attached)
                    ADraw.streak(fb, base.x, base.y, tip_point.x, tip_point.y, 0.8, 0.4, AMath.R("verdant", 0.7), tension * retract * attached * 0.5)

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
    var art_direction := "A"
    func setup() -> void:
        art_direction = "B" if OS.get_environment("ARCANA20_ART14") == "B" else "A"
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
    func _draw_cap(fb: AFramebuffer, origin: Vector2, width: float, height: float, opacity: float) -> void:
        # Deliberately broad, low dome + pale stipe and visible underside.
        # The previous all-green tapered canopy read as trees at 1x. These
        # are opaque source shapes, not bloom or an RGB transparency key.
        var neck := origin + Vector2(0, -height * 0.65)
        ADraw.poly_fill_solid(fb, [origin + Vector2(-width * 0.25, 0), origin + Vector2(width * 0.25, 0),
            neck + Vector2(width * 0.18, 0), neck + Vector2(-width * 0.18, 0)], Vector3(0.56, 0.48, 0.32), true, opacity)
        ADraw.line(fb, origin.x - width * 0.11, origin.y - height * 0.06,
            neck.x - width * 0.09, neck.y, Vector3(0.86, 0.75, 0.53), opacity * 0.7)
        var cap := neck + Vector2(0, -height * 0.20)
        # A deeper rounded cap prevents the earlier silhouette collapsing
        # into a thin purple slat at native overworld scale.
        ADraw.poly_fill_solid(fb, [cap + Vector2(-width, 0), cap + Vector2(-width * 0.90, -height * 0.34),
            cap + Vector2(-width * 0.60, -height * 0.75), cap + Vector2(-width * 0.20, -height * 0.90),
            cap + Vector2(width * 0.35, -height * 0.86), cap + Vector2(width * 0.72, -height * 0.60),
            cap + Vector2(width * 0.95, -height * 0.24), cap + Vector2(width, 0)], Vector3(0.36, 0.16, 0.38), true, opacity)
        ADraw.poly_fill_solid(fb, [cap + Vector2(-width, 0), cap + Vector2(-width * 0.72, height * 0.16),
            cap + Vector2(0, height * 0.25), cap + Vector2(width * 0.72, height * 0.16), cap + Vector2(width, 0)], Vector3(0.82, 0.67, 0.40), true, opacity * 0.94)
        ADraw.line(fb, cap.x - width, cap.y, cap.x + width, cap.y, Vector3(1.1, 0.72, 0.64), opacity)
        for side in [-0.7, -0.35, 0.0, 0.35, 0.7]:
            var offset := float(side)
            ADraw.line(fb, cap.x + offset * width * 0.12, cap.y + height * 0.03,
                cap.x + offset * width, cap.y + height * 0.15, Vector3(1.0, 0.88, 0.59), opacity * 0.8)
        # Sparse cap freckles remain tangible pixels rather than luminous fog.
        for spot in [-0.48, 0.0, 0.43]:
            var offset := float(spot)
            fb.add_px(roundi(cap.x + width * offset), roundi(cap.y - height * (0.44 + 0.14 * (1.0 - absf(offset)))),
                0.95, 0.58, 1.1, opacity * 0.8)

    func _hypha_point(a: Vector2, b: Vector2, link: int, s: float) -> Vector2:
        # Endpoints remain the authored colony anchors. A deterministic
        # lateral meander avoids seven ruler-straight edges reading as a cage.
        var axis := (b - a).normalized()
        var normal := Vector2(-axis.y, axis.x)
        var envelope := sin(s * PI)
        var phase := AMath.hash2(float(link), 14.0) * TAU
        var lateral := envelope * (9.0 * sin(s * PI + phase) + 4.0 * sin(s * 4.0 * PI + phase))
        return a.lerp(b, s) + normal * lateral

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
                pts.append(_hypha_point(a, b, i, s))
            # Fine living thread rather than thick electric-looking cables.
            ADraw.ribbon(fb, pts,
                func(_s: float, _i: int) -> float: return 0.9,
                func(_s: float, _i: int, edge: float) -> Variant:
                    if edge > 0.95: return null
                    return Vector3(0.24, 0.58, 0.42) * fade * 0.55)
            # Fine, asymmetrical hyphae bud progressively from the same
            # growing front. They branch from the real link geometry rather
            # than appearing as a simultaneous geometric lattice. The
            # existing link, bloom, colony births and event schedule remain.
            var axis := (b - a).normalized()
            var normal := Vector2(-axis.y, axis.x)
            for junction in range(1, 4 + (i % 3)):
                var s := AMath.cl01(float(junction) / 7.0 + AMath.hash2(float(i * 23 + junction), 31.0) * 0.08)
                var grow := AMath.cl01((u - s) * 6.0)
                if grow <= 0.0: continue
                var point := _hypha_point(a, b, i, s)
                var side := 1.0 if (junction + i) % 2 == 0 else -1.0
                var reach := (12.0 + AMath.hash2(float(i * 19 + junction), 14.0) * 8.0) * grow
                var bend := point + normal * side * reach * 0.55 + axis * reach * 0.2
                var tip := point + normal * side * reach + axis * reach * 0.55
                var hypha := Vector3(0.25, 0.57, 0.40)
                ADraw.line(fb, point.x, point.y, bend.x, bend.y, hypha, fade * 0.4)
                ADraw.line(fb, bend.x, bend.y, tip.x, tip.y, hypha, fade * 0.55)
                if grow > 0.45:
                    var fork := bend + normal * side * reach * 0.16 - axis * reach * 0.35
                    ADraw.line(fb, bend.x, bend.y, fork.x, fork.y, hypha, fade * 0.55)
            # One legible signal propagates along completed links in the
            # same graph order, reaching the network before sporulation.
            var pulse_start := 4.15 + (start - 1.2) * 0.35
            var pulse_end := 4.15 + (end - 1.2) * 0.35
            if t >= pulse_start and t < pulse_end:
                var pu := AMath.seg(t, pulse_start, pulse_end)
                var pp := _hypha_point(a, b, i, pu)
                ADraw.disc(fb, pp.x, pp.y, 2.2, AMath.R("bio", 0.9), fade)
                ADraw.glow(fb, pp.x, pp.y, 5.0, AMath.R("bio", 0.7), fade * 0.6)
        for i in range(_colonies.size()):
            var g := AMath.seg(t, float(_births[i]), float(_births[i]) + 0.75)
            if g <= 0.0:
                continue
            var c: Vector2 = _colonies[i]
            var pul := 1.0 + 0.08 * sin(t * 2.4 + float(i) * 1.7)
            # Two deliberately different art directions share the same causal
            # colony schedule: clustered shelf fungi vs. a single tall cup.
            # Covered bodies affect the actual world, not a copied floor.
            var k := g * fade
            var spread := AMath.ease_out(g, 2.0)
            var foot := 24.0 * spread
            ADraw.poly_fill_solid(fb, [c + Vector2(-foot, 0), c + Vector2(-foot * 0.6, -foot * 0.3),
                c + Vector2(0, -foot * 0.43), c + Vector2(foot * 0.7, -foot * 0.22),
                c + Vector2(foot, 0), c + Vector2(foot * 0.35, foot * 0.3),
                c + Vector2(-foot * 0.5, foot * 0.25)], Vector3(0.026, 0.095, 0.055), true, k * 0.84)
            if art_direction == "A":
                # Low, broad fruiting caps share one ground colony. The
                # prior tall stacked silhouettes read as leafy little trees
                # in the real overworld. Keep distinct short pale stipes and
                # overlapping domes rather than a branching canopy.
                # Separate staggered domes: the previous broad overlapping
                # caps collapsed into one flat purple platform with three legs.
                var middle := AMath.ease_out(AMath.seg(t, float(_births[i]), float(_births[i]) + 0.72), 2.0)
                var left := AMath.ease_out(AMath.seg(t, float(_births[i]) + 0.12, float(_births[i]) + 0.86), 2.0)
                var right := AMath.ease_out(AMath.seg(t, float(_births[i]) + 0.27, float(_births[i]) + 1.0), 2.0)
                if i % 3 == 0:
                    # A broad low shelf with young buds on its lee side.
                    _draw_cap(fb, c + Vector2(-6, -2) * middle, 15.0 * middle * pul, 13.0 * middle, fade * middle)
                    _draw_cap(fb, c + Vector2(11, 4) * right, 6.0 * right * pul, 8.0 * right, fade * right)
                elif i % 3 == 1:
                    # Tall central fruit and a pair of small staggered caps.
                    _draw_cap(fb, c + Vector2(-12, 2) * left, 6.0 * left * pul, 10.0 * left, fade * left)
                    _draw_cap(fb, c + Vector2(0, -3) * middle, 10.0 * middle * pul, 25.0 * middle, fade * middle)
                    _draw_cap(fb, c + Vector2(11, 3) * right, 7.0 * right * pul, 12.0 * right, fade * right)
                else:
                    # A close ring of four small emerging fruiting bodies.
                    for bud in range(4):
                        var growth: float = [left, middle, right, middle][bud]
                        var size := 5.0 + float(bud % 3) * 1.5
                        _draw_cap(fb, c + Vector2(float(bud - 2) * 7.0, float(bud % 2) * 4.0) * growth, size * growth * pul, (8.0 + size * 0.7) * growth, fade * growth)
            else:
                # Alternate: one upright, hollow-looking fruiting body with
                # a scalloped mouth; not simply a palette variation.
                _draw_cap(fb, c, 23.0 * spread * pul, 31.0 * spread, k)
                ADraw.arc_px(fb, c.x, c.y - 31.0 * spread, 13.0 * spread,
                    0.1, PI - 0.1, AMath.R("bio", 0.8), k * 0.8, 1.6)
            # Directional reproductive bursts start at each colony, not at
            # random battlefield locations. Their two-part flight and fade
            # remain visible through the biological OUT.
            var release := t - 5.4 - float(i) * 0.055
            if release >= 0.0 and release < 2.3:
                var bloom := AMath.ease_out(AMath.cl01(release / 1.25), 2.0)
                var alive := (1.0 - AMath.seg(release, 1.5, 2.3)) * fade
                for spore in range(15):
                    var phase := AMath.hash2(float(spore), float(i) + 40.0)
                    var angle := -PI * (0.92 - 0.84 * phase)
                    var distance := (20.0 + phase * 42.0) * bloom
                    var tip := c + Vector2(cos(angle) * distance + release * release * 6.0, sin(angle) * distance - 12.0 * spread)
                    ADraw.streak(fb, tip.x, tip.y + 4.0, tip.x, tip.y - 2.0,
                        1.1, 0.6, Vector3(0.55, 1.05, 0.65), alive * 0.9)
                    ADraw.disc(fb, tip.x, tip.y, 2.2, Vector3(0.70, 1.3, 0.8), alive)
        _ps.each(func(p: Dictionary) -> void:
            var l := float(p.life) / float(p.max)
            ADraw.streak_p(fb, p, AMath.R("bio", 0.4 + l * 0.5), l * fade))

# ------------------------------------------- #18 chronoshard
class ChronoshardR:
    extends RefCounted
    const DUR := 8.4
    const STORED_TAU := [0.15, 0.35, 0.60, 0.82, 1.15]
    var _crystals: Array = []
    var art_direction := "A"
    func setup() -> void:
        art_direction = "B" if OS.get_environment("ARCANA20_ART18") == "B" else "A"
        var rng := AMath.ARng.new(18181)
        _crystals.clear()
        for i in range(5):
            # Five retained moments surround the event rather than forming an
            # unrelated off-to-one-side row. Their staggered reverse release
            # still converges on the single authored impact at C.
            var a := -PI * 0.5 + float(i) * TAU / 5.0
            _crystals.append({"pos": Vector2(C.x + cos(a) * 76.0, C.y - 8.0 + sin(a) * 55.0), "size": rng.rangef(7, 13), "seed": rng.intf(0, 999), "cap": 2.2 + float(i) * 0.5})
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.9, "kind": "pre_echo", "pos_local": C, "emitted": false}]
        for i in range(_crystals.size()):
            ev.append({"t": float(_crystals[i].cap), "kind": "event_captured", "pos_local": _crystals[i].pos, "emitted": false})
        # Visual-only markers preserve both out-of-order echo beats without
        # representing them as confirmed contacts or gameplay damage.
        ev.append({"t": 4.3, "kind": "reverse_echo_visual", "pos_local": C, "emitted": false})
        ev.append({"t": 4.3375, "kind": "forward_echo_visual", "pos_local": C, "emitted": false})
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
    # B #18 stores the same projectile/impact at several distinct tau values
    # inside clipped crystal frames (astral.ts:163-240). This adapts its
    # miniature geometry to A's raster and our retimed causal sequence; it is
    # not the full B renderer/post or a parity claim.
    func _mini_disc(fb: AFramebuffer, p: Vector2, radius: float, hex: PackedVector2Array, color: Vector3, intensity: float) -> void:
        # Keep the retained event legible as actual pixels inside the face;
        # this is the redesign's enlarged mark, not a B-raster parity claim.
        var rr := maxf(1.15, radius)
        for yy in range(floori(p.y - rr), ceili(p.y + rr) + 1):
            for xx in range(floori(p.x - rr), ceili(p.x + rr) + 1):
                var sample := Vector2(float(xx) + 0.5, float(yy) + 0.5)
                if sample.distance_squared_to(p) <= rr * rr and Geometry2D.is_point_in_polygon(sample, hex):
                    fb.add_px(xx, yy, color.x, color.y, color.z, intensity)

    func _mini_star(fb: AFramebuffer, center: Vector2, tau: float, scale: float, hex: PackedVector2Array, intensity: float) -> void:
        # Original B's alternating 6/3-radius four-vertex projectile head,
        # clipped to the crystal; this is still an adapted A raster, not B
        # renderer/post parity and not a recorded gameplay hit.
        var points := PackedVector2Array()
        for q in range(4):
            var angle := tau * 20.0 + float(q) * PI * 0.5
            var radius := (3.0 if q % 2 else 6.0) * scale
            points.append(center + Vector2(cos(angle), sin(angle)) * radius)
        var reach := 6.0 * scale + 1.0
        for y in range(floori(center.y - reach), ceili(center.y + reach) + 1):
            for x in range(floori(center.x - reach), ceili(center.x + reach) + 1):
                var sample := Vector2(float(x) + 0.5, float(y) + 0.5)
                if Geometry2D.is_point_in_polygon(sample, hex) and Geometry2D.is_point_in_polygon(sample, points):
                    fb.add_px(x, y, 1.4, 1.4, 2.0, intensity)

    func _held_tau(index: int, t: float) -> float:
        # Reverse the same retained moment as its crystal releases; the
        # temporal image runs backward while the carrier moves to the common
        # arrival. Visual only, never a combat receipt.
        return float(STORED_TAU[index]) * (1.0 - AMath.ease_in(_release(index, t), 2.0))

    func _mini_attack(fb: AFramebuffer, hex: PackedVector2Array, center: Vector2, tau: float, color: Vector3, intensity: float) -> void:
        # Retell the B-like event with an unmistakable directional head and
        # continuous trailing body rather than the subpixel clipped B dots.
        # Every shard displays the SAME icon at a distinct time, with the
        # last one showing the burst; this is NEW design, not B raster parity.
        if tau < 0.0 or tau > 2.2:
            return
        if tau <= 1.0:
            var u := AMath.cl01(tau)
            var head := center + Vector2(lerpf(-11.0, 10.0, u), -2.0 - 3.0 * sin(u * PI))
            # Tapering comet rather than a UI arrow: bright pointed head,
            # two swept, uneven tails and a separate trajectory, so its
            # stored shape is the same physical visual as the world echo.
            var shape := PackedVector2Array([
                head + Vector2(7, 0), head + Vector2(0, -3),
                head + Vector2(-5, -2), head + Vector2(-13, -4),
                head + Vector2(-9, -1), head + Vector2(-14, 1),
                head + Vector2(-5, 2), head + Vector2(0, 3)])
            for y in range(floori(head.y - 5), ceili(head.y + 5) + 1):
                for x in range(floori(head.x - 15), ceili(head.x + 8) + 1):
                    var pixel := Vector2(float(x) + 0.5, float(y) + 0.5)
                    if Geometry2D.is_point_in_polygon(pixel, hex) and Geometry2D.is_point_in_polygon(pixel, shape):
                        fb.add_px(x, y, color.x, color.y, color.z, intensity)
        else:
            var impact := center + Vector2(9, -2)
            for q in range(8):
                var angle := float(q) * TAU / 8.0
                for step in range(3, 11):
                    _mini_disc(fb, impact + Vector2(cos(angle), sin(angle)) * float(step), 0.8, hex, color, intensity)
            _mini_disc(fb, impact, 3.0, hex, Vector3(2.0, 1.6, 0.8), intensity)

    func _central_tau(t: float) -> float:
        # B's physical attack advances, freezes, then resumes into the shared
        # synchronization. Times are adapted to this candidate's 6.2 impact.
        if t < 2.6:
            return -1.0
        var frozen := 0.45 / 1.1
        if t < 3.05:
            return (t - 2.6) / 1.1
        if t < 5.25:
            return frozen
        if t < 6.2:
            return lerpf(frozen, 1.0, AMath.seg(t, 5.25, 6.2))
        return 1.0 + (t - 6.2)

    func _world_attack(fb: AFramebuffer, tau: float, tint: Vector3, k: float) -> void:
        # Source-B attack function (astral.ts:163-185), drawn in the real
        # world instead of only as clipped snapshots. These are visual echoes,
        # not confirmed combat hits. No opaque copied actors/backgrounds.
        if tau < 0.0 or tau > 2.2 or k <= 0.0:
            return
        var a := CASTER + Vector2(6, -14)
        var b := C + Vector2(0, -4)
        if tau <= 1.0:
            for m in range(1, 10):
                var u := maxf(0.0, tau - float(m) * 0.025)
                var trail := a.lerp(b, u) + Vector2(0, -sin(u * PI) * 24.0)
                ADraw.disc(fb, trail.x, trail.y, 3.0 - float(m) * 0.25, tint, k * (1.0 - float(m) / 10.0) * 0.7)
            var head := a.lerp(b, tau) + Vector2(0, -sin(tau * PI) * 24.0)
            var heading := (b - a).normalized()
            var side := Vector2(-heading.y, heading.x)
            var arrow := [head + heading * 8.0, head - heading * 3.0 + side * 5.0,
                head - heading * 2.0, head - heading * 3.0 - side * 5.0]
            ADraw.poly_fill_solid(fb, arrow, Vector3(2.0, 1.4, 0.55), false, k)
        else:
            var e := tau - 1.0
            var radius := AMath.ease_out(e / 1.2) * 34.0
            var fade := k * maxf(0.0, 1.0 - e / 1.2) * 1.5
            var prev := b + Vector2(radius, 0)
            for q in range(1, 37):
                var angle := float(q) * TAU / 36.0
                var next := b + Vector2(cos(angle), sin(angle) * 0.7) * radius
                ADraw.line(fb, prev.x, prev.y, next.x, next.y, tint, fade)
                prev = next

    func render(fb: AFramebuffer, t: float) -> void:
        # The same recognizable event appears as a pre-echo before its
        # frozen stages are stored: a projectile travels caster -> target.
        if t < 2.0:
            var gk := AMath.seg(t, 0.9, 1.05) * (1.0 - AMath.seg(t, 1.4, 2.0)) * 0.7
            var u := AMath.seg(t, 0.9, 1.45)
            var from_point := CASTER + Vector2(6, -14)
            var ghost := from_point.lerp(C, u) + Vector2(0, -sin(u * PI) * 24.0)
            var tail := from_point.lerp(C, maxf(0.0, u - 0.18)) + Vector2(0, -sin(maxf(0.0, u - 0.18) * PI) * 24.0)
            ADraw.streak(fb, tail.x, tail.y, ghost.x, ghost.y, 1.1, 2.0, Vector3(0.55, 0.9, 1.8), gk)
            ADraw.disc(fb, ghost.x, ghost.y, 2.0, Vector3(1.4, 1.3, 2.0), gk)
            ADraw.ring_shape(fb, C.x, C.y, 30.0, 1.4, AMath.R("frost", 0.7), gk * 0.5)
        if t >= 2.6 and t < 6.7:
            _world_attack(fb, _central_tau(t), Vector3(1.4, 0.8, 1.8), 0.85)
        # One event unfolds early while another unwinds: source B's forwards
        # and backwards causes, deliberately not gameplay hit receipts.
        var forward_age := t - 3.9
        if forward_age >= 0.0 and forward_age < 1.2:
            _world_attack(fb, 0.3 + forward_age * 1.6, Vector3(1.8, 1.3, 0.5), 0.65 * (1.0 - AMath.seg(forward_age, 0.9, 1.2)))
        var reverse_age := t - 4.3
        if reverse_age >= 0.0 and reverse_age < 1.05:
            _world_attack(fb, 1.45 - reverse_age * 1.5, Vector3(0.5, 0.9, 2.0), 0.65 * (1.0 - AMath.seg(reverse_age, 0.8, 1.05)))
        for i in range(_crystals.size()):
            var c: Dictionary = _crystals[i]
            var pos: Vector2 = c.pos
            var cap_t: float = c.cap
            var form := AMath.seg(t, 0.9 + float(i) * 0.24, 1.7 + float(i) * 0.24)
            if form <= 0.0:
                continue
            var captured := AMath.seg(t, cap_t, cap_t + 0.4)
            var capture_beat := AMath.seg(t, cap_t, cap_t + 0.08) * (1.0 - AMath.seg(t, cap_t + 0.08, cap_t + 0.35))
            var rel := _release(i, t)
            var resolve := _resolve(i, t)
            var cur: Vector2 = pos.lerp(C, AMath.ease_in(rel, 2.0))
            # B astral.ts:216-243 study: six-vertex 17px crystal, dark
            # covered face, violet faceted frame. This is not the complete B
            # clipped attack contents or a claim of B raster/source parity.
            var impact_fold := 1.0 - 0.8 * AMath.seg(t, 6.2, 6.8)
            var sz: float = (26.0 + float(c.size) * 0.45) * form * (1.0 - rel * 0.5) * resolve * impact_fold
            if sz <= 0.5:
                continue
            # B's six-sided glass frame is reinterpreted as an elongated,
            # beveled crystal rather than a revolving flat hexagonal tile.
            # Keep the silhouette nearly stationary while time is held.
            var tilt := -0.3 + float(i) * 0.12 + 0.08 * sin(t * 0.8 + float(i))
            var outline := [Vector2(-0.10, -1.25), Vector2(0.68, -0.65), Vector2(0.80, 0.48), Vector2(0.08, 1.16), Vector2(-0.72, 0.62), Vector2(-0.82, -0.50)]
            var hex: Array = []
            for point in outline:
                hex.append(cur + (point as Vector2).rotated(tilt) * sz)
            ADraw.poly_fill_solid(fb, hex, Vector3(0.045, 0.055, 0.14), true, 0.70 * resolve)
            # Shallow edge facets imply thickness but leave the retained
            # event unobstructed in the transparent middle of the crystal.
            for q in range(6):
                var a: Vector2 = hex[q]
                var b: Vector2 = hex[(q + 1) % 6]
                var inner_a := a.lerp(cur, 0.20)
                var inner_b := b.lerp(cur, 0.20)
                var facet := Vector3(0.28, 0.35, 0.65) if q % 2 == 0 else Vector3(0.12, 0.18, 0.39)
                ADraw.poly_fill_solid(fb, [a, b, inner_b, inner_a], facet, true, 0.65 * resolve)
            for q in range(6):
                var a: Vector2 = hex[q]
                var b: Vector2 = hex[(q + 1) % 6]
                ADraw.line(fb, a.x, a.y, b.x, b.y, Vector3(1.2, 1.4, 2.0), resolve * (0.75 + capture_beat * 0.8))
                if q % 2 == 0:
                    ADraw.line(fb, cur.x, cur.y, a.x, a.y, Vector3(0.6, 0.6, 1.2), resolve * 0.35)
            # Each fragment visibly contains a different frozen moment of
            # the same projectile/impact, clipped to the moving crystal face.
            if captured > 0.0:
                # Five sequential snapshots of one amber event, in capture
                # order around the ring; release travels in reverse order.
                var mark := Vector3(2.0, 1.2, 0.45)
                _mini_attack(fb, PackedVector2Array(hex), cur, _held_tau(i, t), mark, captured * resolve)
            ADraw.glow(fb, cur.x, cur.y, sz * 1.4, AMath.R("frost", 0.75), captured * resolve * 0.35)
            if captured > 0.0 and rel < 1.0:
                ADraw.streak(fb, cur.x, cur.y, C.x, C.y, 0.7, 0.3, AMath.R("frost", 0.6), captured * 0.4 * resolve)
            if rel > 0.0 and rel < 1.0:
                # Release the retained projectile as a small physical mark
                # travelling ahead of its own crystal toward the shared
                # arrival. This is a visual-only continuation of B's attack,
                # not a CT/R4 hit, actor snapshot, or large cover-up glow.
                var head := cur.lerp(C, AMath.ease_out(rel, 2.0))
                var prev_rel := maxf(0.0, rel - 0.16)
                var previous_crystal := pos.lerp(C, AMath.ease_in(prev_rel, 2.0))
                var tail := previous_crystal.lerp(C, AMath.ease_out(prev_rel, 2.0))
                var k := captured * resolve * (1.0 - AMath.seg(rel, 0.84, 1.0))
                ADraw.streak(fb, tail.x, tail.y, head.x, head.y, 1.4, 0.7, Vector3(1.8, 1.3, 0.5), k * 0.8)
                var forward := (C - head).normalized()
                var side := Vector2(-forward.y, forward.x)
                var arrow := [head + forward * 7.0, head - forward * 3.0 + side * 4.0,
                    head - forward * 2.0, head - forward * 3.0 - side * 4.0]
                ADraw.poly_fill_solid(fb, arrow, Vector3(2.0, 1.4, 0.55), false, k)
        var it := t - 6.2
        if it >= 0.0 and it < 0.7:
            ADraw.disc(fb, C.x, C.y, 5.0 * (1.0 - it / 0.7), AMath.R("frost", 1.0), 1.0 - it / 0.7)
            ADraw.pulse_ring(fb, C.x, C.y, 6.0 + it * 150.0, 3.0, AMath.R("frost", 0.8), 0.65 * (1.0 - it / 0.7), 1.35)
        # A shattering fan versus B a broken clock-face: both emerge from
        # the same synchronized arrival, without changing the contact ledger.
        # The covered violet faces and bright bevels create actual solid shards;
        # they contract/fade rather than leaving a detached glow or particles.
        if it >= 0.0 and it < 1.25:
            var travel := AMath.ease_out(AMath.cl01(it / 0.8), 2.0)
            var life := 1.0 - AMath.seg(it, 0.55, 1.25)
            for fragment in range(8):
                var angle := float(fragment) * TAU / 8.0 - PI * 0.5
                var axis := Vector2(cos(angle), sin(angle) * 0.75)
                var across := Vector2(-sin(angle), cos(angle) * 0.75)
                var center := C + axis * (15.0 + 72.0 * travel)
                var long_side := (32.0 if art_direction == "A" else 18.0) * (1.0 - travel * 0.35)
                var short_side := (12.0 if art_direction == "A" else 19.0) * (1.0 - travel * 0.25)
                var front := center + axis * long_side
                var rear := center - axis * long_side * 0.55
                var left := center - across * short_side
                var right := center + across * short_side
                ADraw.poly_fill_solid(fb, [front, right, rear, left], Vector3(0.10, 0.10, 0.28), true, life * 0.9)
                ADraw.poly_fill_solid(fb, [front, center, left], Vector3(0.34, 0.46, 0.85), true, life * 0.9)
                ADraw.streak(fb, front.x, front.y, left.x, left.y, 1.8, 1.0, Vector3(1.4, 1.6, 2.4), life)
                ADraw.streak(fb, front.x, front.y, right.x, right.y, 1.6, 0.9, Vector3(1.0, 1.2, 2.0), life * 0.85)
                ADraw.line(fb, left.x, left.y, rear.x, rear.y, Vector3(0.6, 0.7, 1.5), life * 0.75)
            if art_direction == "B":
                # A broken clock face reads as one temporal device, rather
                # than the divergent pointed shards of direction A.
                var dial := 30.0 + travel * 45.0
                for arc in range(4):
                    var start := float(arc) * PI * 0.5 + it * 0.4
                    ADraw.arc_px(fb, C.x, C.y, dial, start, start + 1.0,
                        Vector3(1.2, 1.4, 2.3), life, 0.75)
        # B astral.ts synchronization wave: its alternating 14-point,
        # elliptical crystal boundary, cubic expansion and 1.4s fade are
        # retained here on the candidate's retimed 6.2s single impact.
        # This adapts B's shape to A raster; B's post and clipped miniature
        # attacks remain separate, unimplemented source operations.
        if it > 0.0 and it < 1.4:
            var radius := AMath.ease_out(it / 1.4, 3.0) * 260.0
            var vertices: Array = []
            for q in range(14):
                var angle := float(q) / 14.0 * TAU + it
                var rr := radius * (0.94 if q % 2 == 1 else 1.0)
                vertices.append(C + Vector2(cos(angle) * rr, sin(angle) * rr * 0.75))
            var strength := 1.6 * (1.0 - AMath.cl01(it / 1.4))
            for q in range(14):
                var a: Vector2 = vertices[q]
                var b: Vector2 = vertices[(q + 1) % 14]
                ADraw.line(fb, a.x, a.y, b.x, b.y, Vector3(1.4, 1.6, 2.4), strength)
