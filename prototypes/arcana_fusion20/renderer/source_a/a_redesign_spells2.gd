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
        _roots.clear()
        _tips.clear()
        var origin := CASTER + Vector2(5, 0)
        var destination := C + Vector2(-32, 6)
        var trunk: Array = []
        for n in range(33):
            var u := float(n) / 32.0
            var bend := sin(u * PI) * (10.0 * sin(u * 5.0 + 0.5) + 5.0 * sin(u * 12.0))
            trunk.append(origin.lerp(destination, u) + Vector2(0, bend))
        var branches: Array = [{"pts": trunk, "w": 9.0, "depth": 0, "grow": 0.0, "seed": 13131, "attach": 0.0, "parent": -1, "along0": 0.0}]
        # Asymmetrical primary roots emerge from exact trunk joints. Each
        # may carry a smaller branch from its own already-formed joint.
        for j in range(5):
            var parent_index: int = [5, 11, 17, 22, 27][j]
            var attach := float(parent_index) / 32.0
            var base: Vector2 = trunk[parent_index]
            var tangent: Vector2 = (trunk[parent_index + 1] - trunk[parent_index - 1]).normalized()
            var side := -1.0 if j % 2 == 0 else 1.0
            var normal := Vector2(-tangent.y, tangent.x) * side
            var child: Array = []
            var reach: float = [25.0, 34.0, 22.0, 30.0, 20.0][j]
            var spread: float = [27.0, 37.0, 29.0, 35.0, 24.0][j]
            for n in range(17):
                var u := float(n) / 16.0
                var jag := sin(u * PI) * (4.0 * sin(u * 10.0 + float(j) * 1.8))
                child.append(base + tangent * (reach * u + jag) + normal * (spread * u + sin(u * PI) * 5.0))
            var child_index := branches.size()
            branches.append({"pts": child, "w": 4.8 - float(j) * 0.25, "depth": 1, "grow": 0.0, "seed": 13200 + j, "attach": attach, "parent": 0, "along0": attach})
            var joint := 8 + j % 4
            var child_attach := float(joint) / 16.0
            var leaf_base: Vector2 = child[joint]
            var leaf_tangent: Vector2 = (child[joint + 1] - child[joint - 1]).normalized()
            var leaf_normal := Vector2(-leaf_tangent.y, leaf_tangent.x) * (-side)
            var twig: Array = []
            for n in range(9):
                var u := float(n) / 8.0
                twig.append(leaf_base + leaf_tangent * (14.0 * u) + leaf_normal * ((12.0 + float(j) * 1.7) * u + 3.0 * sin(u * PI)))
            branches.append({"pts": twig, "w": 2.4, "depth": 2, "grow": 0.0, "seed": 13300 + j, "attach": child_attach, "parent": child_index, "along0": lerpf(attach, 1.0, child_attach)})
        _roots.append(branches)
        _tips.append(destination)

    func authored_events() -> Array:
        return [
            {"t": 0.8, "kind": "roots_germinate", "pos_local": CASTER, "emitted": false},
            {"t": 3.5, "kind": "root_tip_grown", "pos_local": _tips[0], "emitted": false},
            {"t": 5.4, "kind": "thorn_snap_visual", "pos_local": C, "emitted": false},
            {"t": 7.2, "kind": "roots_retract", "pos_local": CASTER, "emitted": false}]

    func _visible_growth(growth: float, t: float) -> float:
        return growth * (1.0 - AMath.seg(t, 7.2, 8.4))

    func update(_dt: float, t: float) -> void:
        var branches: Array = _roots[0]
        branches[0].grow = AMath.cl01((t - 0.8) / 2.7)
        for i in range(1, branches.size()):
            var branch: Dictionary = branches[i]
            var parent: Dictionary = branches[int(branch.parent)]
            branch.grow = AMath.cl01((float(parent.grow) - float(branch.attach)) / 0.30)

    func _lifted_points(branch: Dictionary, lift: float) -> Array:
        var result: Array = []
        var pts: Array = branch.pts
        var along0 := float(branch.along0)
        for n in range(pts.size()):
            var u := float(n) / float(pts.size() - 1)
            var along := lerpf(along0, 1.0, u)
            result.append((pts[n] as Vector2) + Vector2(-lift * 0.3, -lift) * sin(PI * along * 0.65))
        return result

    func render(fb: AFramebuffer, t: float) -> void:
        var tension := AMath.seg(t, 4.05, 5.1) * (1.0 - AMath.seg(t, 5.4, 6.1))
        var branches: Array = _roots[0]
        var visible: Array[float] = []
        for i in range(branches.size()):
            var original: Dictionary = branches[i]
            var b: Dictionary = original.duplicate()
            var remain := 1.0 - AMath.seg(t, 7.2, 8.4)
            var g := minf(float(original.grow), remain)
            if int(b.parent) >= 0:
                var parent_visible := visible[int(b.parent)]
                g = minf(g, AMath.cl01((parent_visible - float(b.attach)) / 0.30))
            visible.append(g)
            b.grow = g
            b.pts = _lifted_points(original, tension * 13.0)
            ACommon.draw_branch(fb, b,
                func(u: float, edge: float, br: Dictionary) -> Variant:
                    var grain := AMath.hash2(floor(u * 45.0), float(br.seed) + floor(edge * 8.0) * 11.0)
                    if edge > 0.82: return Vector3(0.10, 0.075, 0.035)
                    var bark := 0.27 + grain * 0.13 + (1.0 - edge) * 0.07
                    return Vector3(bark, bark * 0.58, bark * 0.27),
                func(u: float, br: Dictionary) -> float:
                    var rough := 0.78 + 0.22 * AMath.hash2(floor(u * 15.0), float(br.seed))
                    return maxf(0.6, float(br.w) * (1.0 - 0.86 * u) * rough), true)
        # A separate narrow thorn extrudes only after the trunk tensions.
        # Its base is literally the deformed parent tip; it never represents
        # a hit or adds an actor-relative combat event.
        var launch := AMath.ease_in(AMath.seg(t, 5.08, 5.4), 2.0) * (1.0 - AMath.seg(t, 6.4, 7.2))
        if launch > 0.0 and visible[0] > 0.99:
            var raised := _lifted_points(branches[0], tension * 13.0)
            var base: Vector2 = raised[-1]
            var dir: Vector2 = (C + Vector2(18, 0) - base).normalized()
            var side := Vector2(-dir.y, dir.x)
            var tip: Vector2 = base + dir * (52.0 * launch)
            var shoulder: Vector2 = base + dir * (8.0 * launch)
            ADraw.poly_fill_solid(fb, [base - side * 3.5, shoulder - side * 3.0, tip, shoulder + side * 3.0, base + side * 3.5], Vector3(0.25, 0.34, 0.10), true, launch)
            ADraw.streak(fb, shoulder.x, shoulder.y, tip.x, tip.y, 0.8, 0.2, Vector3(0.65, 0.69, 0.28), launch)


# ------------------------------------------- #14 spore nebula
class SporeNebulaR:
    extends RefCounted
    const DUR := 8.6
    var _colonies: Array = []
    var _links: Array = []
    # Each link grows from an already-founded colony; birth happens at the
    # first incoming link arrival; the five links form a causal branching tree.
    var _births := [0.8, 2.2, 3.0, 3.6, 4.2, 2.9]
    var _link_times := [[1.2, 2.2], [2.2, 2.9], [2.9, 3.6], [3.6, 4.2], [2.2, 3.0]]
    var _ps: ADraw.APool
    var art_direction := "A"
    func setup() -> void:
        art_direction = "B" if OS.get_environment("ARCANA20_ART14") == "B" else "A"
        _ps = ADraw.APool.new()
        _colonies = [CASTER + Vector2(16, -6), Vector2(171, 120), Vector2(224, 153), Vector2(270, 92), Vector2(327, 137), Vector2(215, 79)]
        _links = [[0, 1], [1, 5], [5, 3], [3, 4], [1, 2]]
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
    func _draw_fruiting_cup(fb: AFramebuffer, base: Vector2, width: float, height: float, tilt: float, seed: float, opacity: float) -> void:
        # An uneven hollow cup rises from its own bed; the open, lobed rim
        # and attached stalk are a different silhouette from domes/shelves.
        # Geometry owns coverage even for the dark interior of the cup.
        var axis := Vector2(sin(tilt), -cos(tilt))
        var side := Vector2(-axis.y, axis.x)
        var lip := base + axis * height
        var body := [base - side * width * 0.18,
            base + axis * height * 0.42 - side * width * 0.28,
            lip - axis * height * 0.27 - side * width * 0.82,
            lip + axis * height * 0.04 - side * width,
            lip + axis * height * 0.12 - side * width * 0.54,
            lip - axis * height * 0.03 - side * width * 0.18,
            lip + axis * height * 0.08 + side * width * 0.22,
            lip - axis * height * 0.04 + side * width * 0.62,
            lip + axis * height * 0.09 + side * width,
            lip - axis * height * 0.30 + side * width * 0.76,
            base + axis * height * 0.40 + side * width * 0.24,
            base + side * width * 0.18]
        ADraw.poly_fill(fb, body,
            func(x: int, y: int) -> Variant:
                var grain := AMath.hash2(floor(float(x) * 0.45), floor(float(y) * 0.45) + seed)
                return Vector3(0.25 + grain * 0.08, 0.14 + grain * 0.06, 0.20 + grain * 0.08), true, opacity)
        var hollow := [lip - side * width * 0.84, lip + axis * height * 0.06 - side * width * 0.42,
            lip - axis * height * 0.03, lip + side * width * 0.54,
            lip + side * width * 0.82, lip - axis * height * 0.19 + side * width * 0.38,
            lip - axis * height * 0.25 - side * width * 0.24]
        ADraw.poly_fill_solid(fb, hollow, Vector3(0.10, 0.045, 0.12), true, opacity * 0.88)
        for i in range(hollow.size()):
            var a: Vector2 = hollow[i]
            var b: Vector2 = hollow[(i + 1) % hollow.size()]
            ADraw.streak(fb, a.x, a.y, b.x, b.y, 0.45, 0.35, Vector3(0.72, 0.48, 0.55), opacity * 0.60)
        for spot in range(3):
            var shift := (AMath.hash2(seed + float(spot), 70.0) - 0.5) * width
            var p := lip - axis * height * (0.42 + float(spot) * 0.08) + side * shift
            ADraw.disc(fb, p.x, p.y, 0.6 + AMath.hash2(seed, float(spot)) * 0.7, Vector3(0.55, 0.75, 0.41), opacity * 0.5)


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
            # A covered, living mycelial strand physically connects the
            # beds. Its growing head and asymmetrical fuzzy sides replace
            # the former diagram-like set of thin luminous graph edges.
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 2.0 + 2.1 * AMath.hash2(floor(s * 11.0), float(i) + 22.0),
                func(s: float, _i: int, edge: float) -> Variant:
                    var grain := AMath.hash2(floor(s * 37.0), floor(edge * 7.0) + float(i) * 9.0)
                    return Vector3(0.09 + grain * 0.07, 0.18 + grain * 0.10, 0.09 + grain * 0.06), true, fade * 0.75)
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
            # Each colony's mycelium follows its own asymmetric irregular
            # footprint instead of six identical solid hexagonal stamps.
            var island: Array = []
            var foot := (14.0 + 9.0 * AMath.hash2(float(i), 41.0)) * spread
            for edge in range(15):
                var angle := float(edge) * TAU / 15.0
                var jag := 0.62 + 0.38 * AMath.hash2(float(i * 17 + edge), 81.0)
                island.append(c + Vector2(cos(angle) * foot * jag, sin(angle) * foot * jag * 0.43))
            ADraw.poly_fill(fb, island,
                func(x: int, y: int) -> Variant:
                    var grain := AMath.hash2(floor(float(x) * 0.45), floor(float(y) * 0.44) + float(i))
                    return Vector3(0.035 + grain * 0.06, 0.12 + grain * 0.08, 0.06 + grain * 0.05), true, k * 0.56)
            # Each bed produces an uneven cluster of attached hollow cups,
            # with different heights, tilts, birth order and sizes. No
            # independent graphic cap or stacked shelf can float off-bed.
            var count := 2 + i % 3
            for fruit in range(count):
                var seed := float(i * 19 + fruit * 7)
                var delay := float(fruit) * 0.13
                var grow := AMath.ease_out(AMath.seg(t, float(_births[i]) + delay, float(_births[i]) + delay + 0.78), 2.0)
                if grow <= 0.0: continue
                var offset := Vector2((float(fruit) - float(count - 1) * 0.5) * 8.0,
                    (AMath.hash2(seed, 52.0) - 0.5) * 5.0) * spread
                var w := (4.5 + 4.0 * AMath.hash2(seed, 53.0)) * grow * pul
                var h := (12.0 + 15.0 * AMath.hash2(seed, 54.0)) * grow
                var tilt := (AMath.hash2(seed, 55.0) - 0.5) * 0.55
                _draw_fruiting_cup(fb, c + offset, w, h, tilt, seed, fade * grow)
            # Directional reproductive bursts start at each colony, not at
            # random battlefield locations. Their two-part flight and fade
            # remain visible through the biological OUT.
            var release := t - 5.4 - float(i) * 0.055
            if release >= 0.0 and release < 2.3:
                var bloom := AMath.ease_out(AMath.cl01(release / 1.25), 2.0)
                var alive := (1.0 - AMath.seg(release, 1.5, 2.3)) * fade
                for spore in range(28):
                    var phase := AMath.hash2(float(spore), float(i) + 40.0)
                    var scatter := AMath.hash2(float(spore * 3 + i), 76.0)
                    var angle := -PI * (0.95 - 0.90 * phase)
                    var distance := (12.0 + scatter * 69.0) * bloom
                    var tip := c + Vector2(cos(angle) * distance + release * release * (4.0 + scatter * 9.0), sin(angle) * distance - 12.0 * spread)
                    var size := 0.75 + 1.6 * AMath.hash2(float(spore), float(i) + 66.0)
                    ADraw.streak(fb, tip.x - scatter * 2.0, tip.y + size * 2.2, tip.x, tip.y,
                        size * 0.42, size * 0.2, Vector3(0.55, 1.05, 0.65), alive * 0.7)
                    ADraw.disc(fb, tip.x, tip.y, size, Vector3(0.70, 1.3, 0.8), alive)
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
        ev.append({"t": 5.20, "kind": "forward_echo_visual", "pos_local": C, "emitted": false})
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

    func _mini_ember_body(fb: AFramebuffer, p: Vector2, radius: float, hex: PackedVector2Array, intensity: float) -> void:
        # Covered red-orange material makes the miniature fireball distinct
        # from white glass glints; unlike brightness-keying, coverage follows
        # the clipped physical disc even for dark pixels.
        for yy in range(floori(p.y - radius), ceili(p.y + radius) + 1):
            for xx in range(floori(p.x - radius), ceili(p.x + radius) + 1):
                var sample := Vector2(float(xx) + 0.5, float(yy) + 0.5)
                if sample.distance_squared_to(p) <= radius * radius and Geometry2D.is_point_in_polygon(sample, hex):
                    fb.blend(xx, yy, 0.72, 0.12, 0.035, clampf(intensity * 0.92, 0.0, 1.0))

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

    # A single spinning crescent travels along a curved path. The exact same
    # covered geometry is used in the world and within each clipped face.
    # This is new symbolic choreography, not a B source-parity claim.
    func _crescent(fb: AFramebuffer, center: Vector2, angle: float, radius: float, intensity: float, clip: PackedVector2Array = PackedVector2Array()) -> void:
        var extent := radius + 1.0
        for y in range(floori(center.y - extent), ceili(center.y + extent) + 1):
            for x in range(floori(center.x - extent), ceili(center.x + extent) + 1):
                var sample := Vector2(float(x) + 0.5, float(y) + 0.5)
                if not clip.is_empty() and not Geometry2D.is_point_in_polygon(sample, clip):
                    continue
                var q := (sample - center).rotated(-angle) / radius
                var outer := q.length()
                var inner := (q - Vector2(0.43, 0.0)).length()
                if outer <= 1.0 and inner >= 0.80:
                    var edge := outer > 0.84 or inner < 0.94
                    var metal := Vector3(0.96, 0.79, 0.43) if edge else Vector3(0.36, 0.25, 0.10)
                    fb.blend(x, y, metal.x, metal.y, metal.z, clampf(intensity, 0.0, 1.0))

    func _held_tau(index: int, t: float) -> float:
        # Hold, visibly reverse all retained times, then carry the common
        # event forward together. Stored positions stay distinct until rewind.
        var reverse := AMath.seg(t, 4.30, 5.20)
        return float(STORED_TAU[index]) * (1.0 - reverse)

    func _mini_attack(fb: AFramebuffer, hex: PackedVector2Array, center: Vector2, tau: float, _color: Vector3, intensity: float) -> void:
        var u := AMath.cl01(tau)
        var position := center + Vector2(lerpf(-10.0, 10.0, u), -4.0 * sin(u * PI))
        _crescent(fb, position, u * TAU * 1.1, 9.5, intensity, hex)

    func _central_tau(t: float) -> float:
        if t < 2.6: return -1.0
        if t < 3.05: return (t - 2.6) / 1.1
        if t < 4.30: return 0.45 / 1.1
        if t < 5.20: return (0.45 / 1.1) * (1.0 - AMath.seg(t, 4.30, 5.20))
        if t < 6.20: return AMath.seg(t, 5.20, 6.20)
        return 1.0 + (t - 6.20)

    func _world_attack(fb: AFramebuffer, tau: float, _tint: Vector3, k: float) -> void:
        if tau < 0.0 or tau > 1.3 or k <= 0.0: return
        var u := AMath.cl01(tau)
        var head := (CASTER + Vector2(6, -14)).lerp(C + Vector2(0, -4), u) + Vector2(0, -sin(u * PI) * 24.0)
        _crescent(fb, head, u * TAU * 1.1, 13.0, k * (1.0 - AMath.seg(tau, 1.0, 1.3)))

    func render(fb: AFramebuffer, t: float) -> void:
        # The same recognizable event appears as a pre-echo before its
        # frozen stages are stored: a projectile travels caster -> target.
        if t < 2.0:
            var gk := AMath.seg(t, 0.9, 1.05) * (1.0 - AMath.seg(t, 1.4, 2.0)) * 0.7
            var u := AMath.seg(t, 0.9, 1.45)
            _world_attack(fb, u, Vector3(0.55, 0.9, 1.8), gk)
            ADraw.ring_shape(fb, C.x, C.y, 30.0, 1.4, AMath.R("frost", 0.7), gk * 0.5)
        if t >= 2.6 and t < 6.7:
            _world_attack(fb, _central_tau(t), Vector3(1.4, 0.8, 1.8), 0.85)
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
                _crescent(fb, head, rel * TAU * 1.1, 7.5, k)
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
