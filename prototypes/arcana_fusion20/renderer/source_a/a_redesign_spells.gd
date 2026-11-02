## REDESIGN_CANDIDATE spells (#04/#06/#12): serious authored redesigns
## per FUSION_DECISIONS user notes, NOT reproductions of the rejected
## originals. Built on the ported A engine. Never Gold-final.
extends RefCounted
class_name ARedesignSpells

const C := Vector2(232, 124)
const CASTER := Vector2(104, 150)

# ------------------------------------------- #04 diagonal guillotine
class AshenGuillotineR:
    extends RefCounted
    const DUR := 8.0
    var _cracks: Array = []
    var _dir := Vector2(0.83, 0.55).normalized()
    func setup() -> void:
        var rng := AMath.ARng.new(40404)
        _cracks.clear()
        # Roots originate on the same cut line; alternate sides so delayed
        # branches visibly grow from the wound rather than an unrelated axis.
        var normal := Vector2(-_dir.y, _dir.x)
        for i in range(5):
            var root := _fault_point((float(i) + 0.5) / 5.0)
            var angle := normal.angle() + (PI if i % 2 == 0 else 0.0)
            _cracks.append(ACommon.grow_branches(rng, root.x, root.y,
                angle, 2.2, {"steps": 7, "step": 3.4, "wander": 0.48, "branch_chance": 0.38, "max_depth": 2, "width_falloff": 0.55, "speed": 2.6}))
    func authored_events() -> Array:
        var events := [
            {"t": 1.2, "kind": "slit_open", "pos_local": C, "emitted": false},
            {"t": 2.6, "kind": "blade_materialise", "pos_local": C, "emitted": false},
            {"t": 3.4, "kind": "guillotine_impact", "pos_local": C, "emitted": false},
        ]
        # These are visual opening markers, NOT additional contacts; the
        # single guillotine_impact above is the only blade contact cue.
        for section in range(5):
            var center := _fault_point((float(section) + 0.5) / 5.0)
            events.append({"t": 4.6 + float(section) * 0.08, "kind": "rupture_open", "pos_local": center, "emitted": false})
        events.append({"t": 6.6, "kind": "wound_close", "pos_local": C, "emitted": false})
        return events
    func _section_visibility(index: int, t: float) -> float:
        var begin := 6.6 + float(index) * 0.22
        return 1.0 - AMath.seg(t, begin, begin + 0.52)
    func update(dt: float, t: float) -> void:
        for i in range(_cracks.size()):
            ACommon.update_branches(_cracks[i], maxf(0.0, t - 4.6 - float(i) * 0.08))
    func _blade_offset(t: float) -> float:
        # A visible draw-back then one accelerating physical stroke lands at
        # the original 3.4 contact. Twenty-two ticks of travel expose the mass
        # in a real-world recording instead of a three-tick teleport. Recoil
        # is recovery, never a second strike or a gameplay contact.
        var pull := 18.0 * AMath.ease_out(AMath.seg(t, 2.72, 3.04), 2.0)
        var strike := AMath.ease_in(AMath.seg(t, 3.04, 3.4), 2.0)
        var recoil := 5.0 * AMath.bump(AMath.seg(t, 3.4, 3.85))
        return 26.0 + pull - 34.0 * strike + recoil
    func _blade_direction(t: float) -> Vector2:
        # The cocked tip resolves into the original diagonal at contact.
        # This is the same single blade, not an additional glowing sweep.
        var swing := AMath.ease_in(AMath.seg(t, 3.04, 3.4), 2.0)
        return _dir.rotated(-0.16 * (1.0 - swing))
    func _fault_point(u: float) -> Vector2:
        # A cut is a connected broken ground trace, not a straight plank.
        # Shared endpoints ensure all banks and branches stay on the wound.
        var n := Vector2(-_dir.y, _dir.x)
        var bend := sin(u * PI) * (11.5 * sin(u * PI * 3.0 + 0.4) + 3.5 * sin(u * PI * 7.0))
        return C + _dir * lerpf(-92.0, 92.0, u) + n * bend
    func _bank_sample(u: float, side: float, t: float, outer: bool) -> Vector2:
        # Each bank is one connected displaced surface, not placed chips.
        var section := mini(4, floori(u * 5.0))
        var opening := AMath.ease_out(AMath.seg(t, 4.6 + float(section) * 0.08, 5.0 + float(section) * 0.08), 2.0) * _section_visibility(section, t)
        var tangent := (_fault_point(minf(1.0, u + 0.003)) - _fault_point(maxf(0.0, u - 0.003))).normalized()
        var normal := Vector2(-tangent.y, tangent.x) * side
        var taper := pow(maxf(0.0, sin(PI * u)), 0.38)
        var rough := AMath.hash2(floor(u * 17.0), 61.0 + side * 7.0)
        var width := (1.7 + 3.3 * rough) * opening * taper
        if outer:
            width += (8.0 + 14.0 * AMath.hash2(floor(u * 11.0), 43.0 + side * 4.0)) * opening * taper
        var shear := tangent * (side * opening * (1.0 + 2.5 * rough) * taper)
        return _fault_point(u) + normal * width + shear

    func render(fb: AFramebuffer, t: float) -> void:
        var slit := AMath.seg(t, 1.2, 2.4)
        var blade := AMath.seg(t, 2.6, 3.35)
        var cut := AMath.seg(t, 3.4, 3.44)
        var close_k := 1.0 - AMath.seg(t, 6.6, 8.0)
        var n := Vector2(-_dir.y, _dir.x)
        var p0: Vector2 = C - _dir * 92.0
        var p1: Vector2 = C + _dir * 92.0
        # thin slit first (readable telegraph along the diagonal)
        if slit > 0.0 and cut < 1.0:
            ADraw.streak(fb, p0.x, p0.y, p1.x, p1.y, 0.7, 0.7, AMath.R("fire", 0.65), slit * 0.8 * close_k)
        # One faceted cleaver-like slab: asymmetric shoulder, broad dark
        # steel face and a slanted cutting tip. The geometry is genuinely
        # covered, including the dark metal; it is never keyed by brightness.
        var off := _blade_offset(t)
        var blade_dir := _blade_direction(t)
        var blade_n := Vector2(-blade_dir.y, blade_dir.x)
        var b0: Vector2 = C - blade_dir * 92.0 + blade_n * off
        var b1: Vector2 = C + blade_dir * 92.0 + blade_n * off
        if blade > 0.0 and t < 4.4:
            var bk := blade * (1.0 - AMath.seg(t, 3.6, 4.4)) * close_k
            var width := 30.0 * blade
            # The earlier broad slab's short point was difficult to read at
            # world scale. Taper both steel edges over a longer section while
            # retaining one opaque blade, its edge, and the contact line.
            var spine1 := b1 - blade_dir * 46.0 + blade_n * width * 0.90
            var edge0 := b0 - blade_n * width * 0.24
            var edge1 := b1 - blade_dir * 46.0 - blade_n * width * 0.24
            var tip := b1 + blade_dir * 8.0 + blade_n * width * 0.12
            var shoulder := b0 + blade_dir * 13.0 + blade_n * width * 0.48
            var back := b0 + blade_dir * 42.0 + blade_n * width * 0.58
            ADraw.poly_fill(fb, [b0 + blade_n * width * 0.10, shoulder, back, spine1, tip, edge1, edge0],
                func(x: int, y: int) -> Variant:
                    var q := Vector2(float(x) + 0.5, float(y) + 0.5) - b0
                    var transverse := q.dot(blade_n) / maxf(width, 0.01)
                    var longitudinal := q.dot(blade_dir)
                    var grain := AMath.hash2(floor(longitudinal * 0.22), floor(transverse * 8.0))
                    var bevel := AMath.cl01((-0.04 - transverse) * 4.0)
                    var plane := AMath.cl01((0.95 - transverse) * 0.9)
                    var facet := 0.04 if int(floor((longitudinal + transverse * 12.0) / 19.0)) % 2 == 0 else 0.0
                    var metal := 0.04 + 0.14 * plane + 0.29 * bevel + 0.025 * grain + facet * plane
                    return Vector3(metal * 0.82, metal * 0.87, metal), true, bk)
            # Steel cutting bevel, a narrow molten vein and two inset marks
            # describe one solid blade rather than an emissive beam.
            ADraw.streak(fb, edge0.x, edge0.y, edge1.x, edge1.y, 1.2, 0.7, AMath.R("ash", 0.9), bk * 0.9)
            ADraw.streak(fb, edge1.x, edge1.y, tip.x, tip.y, 0.7, 0.3, AMath.R("ash", 0.9), bk * 0.9)
            var seam0 := b0 + blade_dir * 20.0 + blade_n * width * 0.20
            var seam1 := b1 - blade_dir * 15.0 + blade_n * width * 0.20
            ADraw.streak(fb, seam0.x, seam0.y, seam1.x, seam1.y, 0.7, 0.5, AMath.R("fire", 0.8), bk * 0.7)
            for mark in [0.28, 0.57, 0.78]:
                var m: Vector2 = seam0.lerp(seam1, mark)
                ADraw.streak(fb, m.x - blade_n.x * width * 0.08, m.y - blade_n.y * width * 0.08,
                    m.x + blade_n.x * width * 0.12 + blade_dir.x * 5.0, m.y + blade_n.y * width * 0.12 + blade_dir.y * 5.0,
                    0.8, 0.6, AMath.R("ash", 0.55), bk * 0.65)
        if cut > 0.0:
            # The blade's whole edge lands as ONE diagonal cut. A shallow
            # charcoal groove remains physically present through the delay;
            # the subsequent fissure grows out of this same ground line.
            var groove := 0.8 * cut
            if t < 4.95:
                for segment in range(12):
                    var start := _fault_point(float(segment) / 12.0)
                    var finish := _fault_point(float(segment + 1) / 12.0)
                    var side := Vector2(-(finish - start).y, (finish - start).x).normalized() * groove
                    ADraw.poly_fill(fb, [start - side, finish - side, finish + side, start + side],
                        func(_x: int, _y: int) -> Variant: return Vector3(0.20, 0.14, 0.10), true, 0.65 * (1.0 - AMath.seg(t, 4.6, 4.95)) * close_k)
            ADraw.streak(fb, p0.x, p0.y, p1.x, p1.y, 2.0, 2.0, AMath.R("fire", 0.9), (1.0 - AMath.seg(t, 3.5, 4.4)) * close_k)
        # A single continuous cavity opens as two unequal connected rock
        # banks physically displace. Shared jagged inner/outer boundaries
        # replace the old repeated rows of pale polygon chips.
        var rup := AMath.seg(t, 4.6, 5.4)
        if rup > 0.0:
            var left: Array = []
            var right: Array = []
            for i in range(25):
                var u := float(i) / 24.0
                left.append(_bank_sample(u, -1.0, t, false))
                right.append(_bank_sample(u, 1.0, t, false))
            var cavity: Array = left.duplicate()
            var reversed := right.duplicate()
            reversed.reverse()
            cavity.append_array(reversed)
            ADraw.poly_fill(fb, cavity,
                func(x: int, y: int) -> Variant:
                    var grit := AMath.hash2(floor(float(x) * 0.43), floor(float(y) * 0.43))
                    return Vector3(0.12 + grit * 0.055, 0.10 + grit * 0.045, 0.075 + grit * 0.035), true, minf(0.72, rup * 1.3) * close_k)
            for side_value in [-1.0, 1.0]:
                var side: float = side_value
                var inner: Array = []
                var outer: Array = []
                for i in range(25):
                    var u := float(i) / 24.0
                    inner.append(_bank_sample(u, side, t, false))
                    outer.append(_bank_sample(u, side, t, true))
                var bank: Array = inner.duplicate()
                var reverse_outer := outer.duplicate()
                reverse_outer.reverse()
                bank.append_array(reverse_outer)
                if fb.track_world_fields:
                    # Destination pixels sample the real underlying terrain
                    # towards the incision, physically shifting the bank out
                    # from the cut. This is an authored polygon footprint, not
                    # a brightness mask or a pasted fabricated floor. The
                    # offset decays at the outside edge and during closure.
                    ADraw.poly_fill(fb, bank,
                        func(x: int, y: int) -> Variant:
                            var pixel := Vector2(float(x) + 0.5, float(y) + 0.5)
                            var u := clampf((pixel - C).dot(_dir) / 184.0 + 0.5, 0.0, 1.0)
                            var section := mini(4, floori(u * 5.0))
                            var opening := AMath.ease_out(AMath.seg(t, 4.6 + float(section) * 0.08, 5.0 + float(section) * 0.08), 2.0) * _section_visibility(section, t)
                            var inward := _bank_sample(u, side, t, false)
                            var outward := _bank_sample(u, side, t, true)
                            var across := clampf(pixel.distance_to(inward) / maxf(1.0, inward.distance_to(outward)), 0.0, 1.0)
                            var mass := opening * (1.0 - across * across)
                            var shift := -n * side * (5.0 + 1.5 * AMath.hash2(floor(u * 9.0), side + 33.0)) * mass
                            shift += _dir * (AMath.hash2(floor(u * 9.0), side + 56.0) - 0.5) * 2.2 * mass
                            var index := y * fb.width + x
                            fb.world_warp[index * 2] += shift.x
                            fb.world_warp[index * 2 + 1] += shift.y
                            fb.world_multiplier[index] *= 1.0 - 0.13 * mass
                            fb.world_influence[index] = 1
                            return null)
                else:
                    # Standalone diagnostics have no real world to displace.
                    ADraw.poly_fill(fb, bank,
                        func(x: int, y: int) -> Variant:
                            var stone := AMath.hash2(floor(float(x) * 0.22), floor(float(y) * 0.25) + side * 7.0)
                            var value := 0.18 + 0.09 * stone
                            return Vector3(value * 1.03, value * 0.94, value * 0.80), true, minf(1.0, rup * 1.6) * close_k)
                # Lithic fractures connect the cavity lip to the outer bank;
                # irregular joint spacing cuts the connected surface into
                # uneven blocks without floating separate stone decorations.
                for joint in [3, 7, 12, 16, 21]:
                    var start: Vector2 = inner[joint]
                    var finish: Vector2 = outer[joint]
                    var midway: Vector2 = start.lerp(finish, 0.48) + _dir * (float((joint * 7) % 5) - 2.0) * rup
                    ADraw.streak(fb, start.x, start.y, midway.x, midway.y, 1.1, 0.7, Vector3(0.06, 0.05, 0.04), rup * close_k)
                    ADraw.streak(fb, midway.x, midway.y, finish.x, finish.y, 0.7, 0.4, Vector3(0.08, 0.07, 0.06), rup * close_k)
            for section in range(5):
                var open := AMath.seg(t, 4.6 + float(section) * 0.08, 5.0 + float(section) * 0.08) * _section_visibility(section, t)
                for branch in _cracks[section]:
                    var authored: Array = branch.pts
                    var limit := float(branch.grow) * float(authored.size() - 1)
                    if limit <= 0.0: continue
                    var visible: Array = [authored[0]]
                    for k in range(mini(authored.size() - 1, ceili(limit))):
                        var va: Vector2 = authored[k]
                        var vb: Vector2 = authored[k + 1]
                        visible.append(va.lerp(vb, AMath.cl01(limit - float(k))))
                    ADraw.ribbon(fb, visible,
                        func(u: float, _i: int) -> float: return maxf(0.5, float(branch.w) * (1.0 - 0.75 * u)) * open,
                        func(_u: float, _i: int, edge: float) -> Variant:
                            return Vector3(0.31, 0.28, 0.23) if edge > 0.68 else Vector3(0.08, 0.07, 0.06),
                        true, open * 0.8)
            # Fragment trajectories begin on the actual cut and separate
            # under gravity as individual fractured plates, not a second hit.
            for k in range(10):
                var age := t - (4.6 + float(k) * 0.055)
                if age <= 0.0 or age >= 1.5: continue
                var seed := float(k)
                var origin: Vector2 = _fault_point((float(k) + 0.5) / 10.0)
                var side := -1.0 if k % 2 == 0 else 1.0
                var travel := (14.0 + 14.0 * AMath.hash2(seed, 3.0)) * age * side
                var lift := -42.0 * age + 30.0 * age * age
                var center := origin + n * travel + Vector2(0.0, lift)
                var radius := 3.5 + 3.5 * AMath.hash2(seed, 7.0)
                var spin := age * (2.0 + AMath.hash2(seed, 9.0)) * side
                var axis := Vector2(cos(spin), sin(spin)) * radius
                var cross := Vector2(-axis.y, axis.x) * 0.65
                var fade := (1.0 - AMath.seg(age, 0.9, 1.5)) * _section_visibility(k / 2, t)
                ADraw.poly_fill(fb, [center - axis, center - cross, center + axis, center + cross],
                    func(_x: int, _y: int) -> Variant: return Vector3(0.09, 0.07, 0.06), true, fade)
                ADraw.streak(fb, (center - axis).x, (center - axis).y, (center - cross).x, (center - cross).y,
                    0.6, 0.5, AMath.R("fire", 0.6), fade * 0.5)

# ------------------------------------------- #06 riptide calligraphy
class RiptideCalligraphyR:
    extends RefCounted
    const DUR := 8.4
    var _strokes: Array = []
    func setup() -> void:
        # authored legible glyph: three strokes (hook, sweep, dot-slash)
        _strokes = [
            [Vector2(168, 78), Vector2(196, 66), Vector2(222, 84), Vector2(216, 118), Vector2(188, 128)],
            [Vector2(238, 70), Vector2(268, 92), Vector2(292, 128), Vector2(322, 142)],
            [Vector2(196, 158), Vector2(240, 148), Vector2(286, 162), Vector2(318, 152)],
        ]
    func _stroke_pt(si: int, u: float) -> Vector2:
        return AMath.catmull_pt(_strokes[si], u)
    func _ink_point(si: int, u: float, t: float) -> Vector2:
        # Both ribbon and moving visual tip use the same actual water path.
        var point := _stroke_pt(si, u)
        point.y += sin(u * 9.0 - t * 5.0 + float(si)) * 1.6 * (1.0 - u)
        return point
    func _wave_front(t: float) -> Vector2:
        # The wave is released from the first authored stroke and advects in
        # one direction, rather than appearing as unrelated expanding rings.
        var u := AMath.seg(t, 4.6, 6.75)
        return _stroke_pt(0, 0.5) + Vector2(8.0 + 150.0 * u, 0.0)
    func authored_events() -> Array:
        var ev: Array = []
        for i in range(3):
            ev.append({"t": 2.0 + float(i) * 1.1, "kind": "stroke_tip_contact", "pos_local": _stroke_pt(i, 0.98), "emitted": false})
        # First visible wavefront starts at the first written stroke's
        # midpoint, not an unrelated point beyond the glyph.
        ev.append({"t": 4.6, "kind": "wave_release_impact", "pos_local": _stroke_pt(0, 0.5) + Vector2(8, 0), "emitted": false})
        ev.append({"t": 6.8, "kind": "strokes_dissolve", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        # Ink drains into the released water, so the traveling mass becomes
        # visibly independent rather than another thick glyph stroke.
        var diss := (1.0 - 0.82 * AMath.seg(t, 4.6, 6.4)) * (1.0 - AMath.seg(t, 6.8, 8.4))
        for i in range(_strokes.size()):
            var u := AMath.cl01(AMath.seg(t, 1.0 + float(i) * 1.1, 2.0 + float(i) * 1.1))
            if u <= 0.0:
                continue
            var pts: Array = []
            for k in range(25):
                var progress := u * float(k) / 24.0
                # A tide.ts stroke inertia, adapted to this new glyph; not
                # a claim of full original A/C source-fusion parity.
                pts.append(_ink_point(i, progress, t))
            var charge := AMath.seg(t, 4.2, 4.6)
            # Explicit translucent water body carries dark, saturated liquid
            # and a light foam edge. It is geometric coverage, never an RGB
            # brightness key; the thinner source-inspired light remains.
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float:
                    return 7.2 * (0.35 + sin(pow(s, 0.8) * PI) * 0.95) * (1.0 + charge * 0.25),
                func(s: float, _i: int, edge: float) -> Variant:
                    var flow := AMath.fbm(s * 14.0 - t * 2.4 + float(i) * 9.0, edge * 3.0, 3)
                    var foam := pow(edge, 3.0)
                    return Vector3(0.04 + flow * 0.07 + foam * 0.32, 0.20 + flow * 0.12 + foam * 0.38, 0.28 + flow * 0.18 + foam * 0.42),
                true, diss * 0.64)
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float:
                    return 4.5 * (0.35 + sin(pow(s, 0.8) * PI) * 0.95) * (1.0 + charge * 0.4),
                func(s: float, _i: int, edge: float) -> Variant:
                    var flow := AMath.fbm(s * 14.0 - t * 2.4 + float(i) * 9.0, edge * 3.0, 3)
                    var h := (0.24 + flow * 0.3 + pow(edge, 2.6) * 0.65 + maxf(0.0, sin(s * 18.0 - t * 26.0 + i * 2.0)) * charge * 0.7) * diss
                    if h < 0.05: return null
                    var c := ACommon.ramp_step("water", AMath.cl01(h), 8.0)
                    return Vector3(c.x * 0.55, c.y * 0.55, c.z * 0.6))
            # Flowing surface rivulets advect along each written stroke.
            # Broken, tapered highlights travel through the retained liquid;
            # they are curved material features, not a static glyph outline.
            for stream in range(4):
                var travel := fposmod(t * (0.24 + float(i) * 0.025) + float(stream) * 0.25 + float(i) * 0.11, 1.0) * u
                var tail := maxf(0.0, travel - 0.13 * u)
                var a := _ink_point(i, tail, t)
                var b := _ink_point(i, travel, t)
                ADraw.streak(fb, a.x, a.y, b.x, b.y, 0.4, 1.1, Vector3(0.38, 0.85, 1.0), diss * 0.55)
            if u < 1.0:
                var tip := _ink_point(i, u, t)
                ADraw.disc_blend(fb, tip.x, tip.y, 2.8, Vector3(0.16, 0.49, 0.58), diss * 0.65)
                ADraw.disc(fb, tip.x, tip.y, 2.2, AMath.R("water", 0.95), diss)
        # Release a single connected rolling water mass, not another drawn
        # ribbon or a thin turquoise fin. Its changing irregular leading edge,
        # deep body, entrained foam and shedding droplets share one motion.
        if t > 4.6 and t < 6.85:
            var age := AMath.seg(t, 4.6, 6.85)
            var front := _wave_front(t)
            var formation := AMath.ease_out(AMath.seg(t, 4.6, 5.05), 2.0)
            var fade := 1.0 - AMath.seg(t, 6.45, 6.85)
            var halfspan := (18.0 + 34.0 * formation) * (1.0 - 0.18 * age)
            var thickness := (20.0 + 31.0 * formation) * (1.0 - 0.28 * age)
            # A traveling continuum of five overlapping, irregular rotating
            # eddies replaces the flat filled slab. Each lobe is part of the
            # same front: its material coverage and foam come from its own
            # signed elliptical distance, not from the color of the world.
            var lobes: Array = []
            for lobe in range(5):
                var seed := float(lobe)
                var v := float(lobe) / 4.0 * 2.0 - 1.0 + (AMath.hash2(seed, 76.0) - 0.5) * 0.18
                var center := front + Vector2(-thickness * (0.30 + 0.13 * AMath.hash2(seed, 77.0) + 0.08 * sin(t * 3.0 + seed * 2.1)), v * halfspan * 0.72)
                var rx := thickness * (0.32 + 0.16 * AMath.hash2(seed, 78.0))
                var ry := halfspan * (0.30 + 0.10 * AMath.hash2(seed, 79.0))
                lobes.append({"center": center, "radii": Vector2(rx, ry), "seed": seed})
            var bounds := [front + Vector2(-thickness * 1.1, -halfspan * 1.1), front + Vector2(10, -halfspan * 1.1),
                front + Vector2(10, halfspan * 1.1), front + Vector2(-thickness * 1.1, halfspan * 1.1)]
            ADraw.poly_fill(fb, bounds,
                func(x: int, y: int) -> Variant:
                    var p := Vector2(float(x) + 0.5, float(y) + 0.5)
                    var nearest := 10.0
                    for item in lobes:
                        var q: Vector2 = (p - (item.center as Vector2)) / (item.radii as Vector2)
                        var d := q.length()
                        # Smooth union removes the hard Voronoi seams that
                        # made the previous circles look like stacked coins.
                        var h := maxf(0.55 - absf(nearest - d), 0.0) / 0.55
                        nearest = minf(nearest, d) - h * h * 0.1375
                    var jitter := (AMath.fbm(float(x) * 0.15 - t, float(y) * 0.14 + t * 0.5, 2) - 0.5) * 0.25
                    if nearest > 1.0 + jitter: return null
                    var flow := AMath.fbm((float(x) - front.x) * 0.105 - t * 1.4, float(y) * 0.085 + t * 0.55, 3)
                    var crest := AMath.cl01((nearest - 0.68) * 2.2) * AMath.cl01((p.x - front.x + thickness * 0.58) / (thickness * 0.52))
                    var foam := AMath.cl01((flow - 0.60) * 4.0) * AMath.cl01((nearest - 0.15) * 2.5) + crest * 0.70
                    var grain := AMath.hash2(float(x), float(y) + floor(t * 6.0))
                    var c := Vector3(0.05, 0.25, 0.32) + Vector3(0.15, 0.20, 0.24) * (1.0 - nearest) + Vector3(0.42, 0.49, 0.47) * minf(1.0, foam) + Vector3.ONE * grain * 0.035
                    return c, true, fade * 0.72)
            var leading: Array = []
            for k in range(33):
                var v := float(k) / 32.0
                var side := v * 2.0 - 1.0
                leading.append(front + Vector2(-6.0 * side * side + 3.0 * sin(v * 19.0 - t * 5.4), side * halfspan))
            for drop in range(18):
                var seed := float(drop)
                var birth := 0.12 + AMath.hash2(seed, 91.0) * 0.58
                var life := AMath.seg(age, birth, minf(1.0, birth + 0.22))
                var side := AMath.hash2(seed, 92.0) * 2.0 - 1.0
                var origin: Vector2 = leading[clampi(roundi((side * 0.5 + 0.5) * 32.0), 0, 32)]
                var p := origin + Vector2((5.0 + 15.0 * AMath.hash2(seed, 93.0)) * life, side * 14.0 * life)
                var r := (0.8 + 2.2 * AMath.hash2(seed, 94.0)) * formation
                var k := fade * sin(life * PI)
                ADraw.disc_blend(fb, p.x, p.y, r, Vector3(0.12, 0.42, 0.51), k)
                ADraw.disc(fb, p.x - 0.4, p.y - 0.4, maxf(0.5, r * 0.35), Vector3(0.5, 0.9, 1.0), k)

# ------------------------------------------- #12 skybreaker script
class SkybreakerScriptR:
    extends RefCounted
    const DUR := 8.6
    var _glyph: Array = []
    var _c_fractures: Array = []
    func setup() -> void:
        # Reuse C Thunderloom's own seeded radial fracture trees, translated
        # to this new rune's visual impact, not invented branch counts.
        var thunderloom := CThunderloom.new()
        thunderloom.setup()
        _c_fractures = thunderloom._fract.duplicate(true)
        _glyph = [
            [Vector2(196, 60), Vector2(232, 48), Vector2(268, 60)],
            [Vector2(232, 48), Vector2(232, 96)],
            [Vector2(200, 96), Vector2(232, 84), Vector2(264, 96)],
            [Vector2(232, 96), Vector2(214, 132), Vector2(252, 138)],
        ]
    func authored_events() -> Array:
        var ev: Array = [{"t": 0.8, "kind": "glyph_write", "pos_local": C, "emitted": false}]
        for i in range(3):
            ev.append({"t": 4.4 + float(i) * 0.7, "kind": "circuit_strike_impact", "pos_local": Vector2(200 + i * 34, 118), "emitted": false})
        ev.append({"t": 6.8, "kind": "skybreaker_impact", "pos_local": C + Vector2(0, 26), "emitted": false})
        ev.append({"t": 7.8, "kind": "glyph_disassemble", "pos_local": C, "emitted": false})
        return ev
    func _stroke_remaining(index: int, t: float) -> float:
        var begin := 7.8 + float(_glyph.size() - 1 - index) * 0.15
        return 1.0 - AMath.seg(t, begin, begin + 0.25)
    # Four unequal subsidiary inscriptions, each with its own short angular
    # strokes. They write around the major rune, then retract in reverse
    # inscription order. These are new shapes, not source A parity.
    func _minor_edge(index: int) -> Array:
        var centers := [Vector2(159, 70), Vector2(298, 67), Vector2(157, 137), Vector2(304, 137)]
        var patterns := [
            [[Vector2(-8, -11), Vector2(-2, 10)], [Vector2(-2, 10), Vector2(10, -5)], [Vector2(-5, -1), Vector2(6, 1)]],
            [[Vector2(-8, -8), Vector2(7, -12)], [Vector2(7, -12), Vector2(2, 11)], [Vector2(-5, 0), Vector2(7, 1)]],
            [[Vector2(-9, -9), Vector2(0, -12)], [Vector2(0, -12), Vector2(8, 9)], [Vector2(-7, 8), Vector2(8, 9)]],
            [[Vector2(-9, -10), Vector2(8, -5)], [Vector2(8, -5), Vector2(-4, 10)], [Vector2(-4, 10), Vector2(7, 12)]]]
        var glyph := floori(float(index) / 3.0)
        var stroke: Array = patterns[glyph][index % 3]
        return [centers[glyph] + (stroke[0] as Vector2), centers[glyph] + (stroke[1] as Vector2)]
    func _minor_written(index: int, t: float) -> float:
        var begin := 1.2 + float(index) * 0.17
        return AMath.seg(t, begin, begin + 0.40)
    func _minor_remaining(index: int, t: float) -> float:
        var begin := 7.15 + float(11 - index) * 0.075
        return 1.0 - AMath.seg(t, begin, begin + 0.28)
    func _bolt_envelope(local_time: float, duration: float) -> float:
        # Presentation hold preserves the authored strike time but makes C's
        # branching readable in sparse world captures, followed by a decay.
        return 1.0 - AMath.seg(local_time, duration * 0.24, duration)
    func update(dt: float, t: float) -> void:
        pass
    func _c_bolt(fb: AFramebuffer, a: Vector2, b: Vector2, seed: float, strength: float, width: float, taper_start: bool = false) -> void:
        # Actual selected C #09 generator, adapted to A's buffer. Geometry is
        # C; A's raster/color and the rest of the selected source remain an
        # unverified fusion candidate rather than C framebuffer parity.
        var tree := CKit.bolt_tree(seed, a.x, a.y, b.x, b.y, 2, 0.24)
        for branch in tree:
            if taper_start and int(branch.depth) == 0:
                # Fade the same C-generated trunk into its in-bounds sky
                # origin instead of cutting a luminous rectangle at the edge
                # of the local world texture. No scene-wide flash or shader.
                var pts: Array = branch.pts
                for i in range(pts.size() - 1):
                    var pa: Vector2 = pts[i]
                    var pb: Vector2 = pts[i + 1]
                    var f0 := AMath.cl01(float(i) * 4.0 / float(pts.size() - 1))
                    var f1 := AMath.cl01(float(i + 1) * 4.0 / float(pts.size() - 1))
                    ADraw.streak(fb, pa.x, pa.y, pb.x, pb.y, maxf(0.1, width * f0), maxf(0.1, width * f1), AMath.R("volt", 0.6), strength * 0.9)
                    ADraw.line(fb, pa.x, pa.y, pb.x, pb.y, AMath.R("volt", 1.0), strength * (f0 + f1) * 0.5)
            else:
                ADraw.bolt_draw(fb, branch.pts, width * float(branch.w), AMath.R("volt", 0.6), AMath.R("volt", 1.0), strength * float(branch.w))
    func render(fb: AFramebuffer, t: float) -> void:
        var dis := 1.0 - AMath.seg(t, 8.45, 8.6)
        # Subsidiary inscriptions appear in four uneven clusters rather
        # than one enclosing octagonal cage/crossed circuit. They are finer
        # than the central major rune and withdraw in reverse write order.
        for i in range(12):
            var written := _minor_written(i, t)
            var remaining := _minor_remaining(i, t)
            if written <= 0.0 or remaining <= 0.0: continue
            var edge: Array = _minor_edge(i)
            var start: Vector2 = edge[0]
            var end: Vector2 = start.lerp(edge[1], written * remaining)
            ADraw.ribbon(fb, [start, end],
                func(_s: float, _j: int) -> float: return 1.9,
                func(_s: float, _j: int, e: float) -> Variant:
                    return Vector3(0.12, 0.15, 0.28) if e > 0.7 else Vector3(0.22, 0.28, 0.46), true, 0.85 * remaining)
            ADraw.streak(fb, start.x, start.y, end.x, end.y, 0.7, 0.6, AMath.R("volt", 0.75), 0.70 * remaining)
            if written > 0.99 and t > 3.5 and t < 6.8:
                var travel := fposmod((t - 3.5) * 0.7 + float(i) * 0.29, 1.0)
                var charge: Vector2 = start.lerp(end, travel)
                ADraw.disc(fb, charge.x, charge.y, 1.2, AMath.R("volt", 1.0), 0.75 * remaining)
        for i in range(_glyph.size()):
            var u := AMath.cl01(AMath.seg(t, 0.8 + float(i) * 0.55, 1.35 + float(i) * 0.55)) * _stroke_remaining(i, t)
            if u <= 0.0:
                continue
            var pts: Array = AMath.catmull_pt([Vector2.ZERO], 0.0) if false else []
            var stroke: Array = _glyph[i]
            pts.clear()
            for k in range(17):
                var su := u * float(k) / 16.0
                pts.append(AMath.catmull_pt(stroke, su) if stroke.size() > 2 else stroke[0].lerp(stroke[stroke.size() - 1], su))
            # A faceted indigo-metal body under each written rune stroke
            # gives the central calligraphy a hierarchy over its fine web.
            # The gradually written path, tips and reverse OUT are unchanged.
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 5.0 * (0.65 + 0.35 * sin(s * PI)),
                func(s: float, _i: int, edge: float) -> Variant:
                    var facet := 0.15 + 0.12 * (1.0 - edge) + 0.04 * sin(s * PI * 5.0)
                    return Vector3(facet * 0.65, facet * 0.83, facet * 1.35), true, 0.8 * dis)
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 2.3,
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * dis
                    if h < 0.05:
                        return null
                    return AMath.R("volt", 0.4 + h * 0.55))
            # Beveled wedge terminals grow from the actual end of each
            # completed rune stroke, not detached ornaments or a new ring.
            if u > 0.92:
                var end: Vector2 = pts[pts.size() - 1]
                var before: Vector2 = pts[pts.size() - 3]
                var axis := (end - before).normalized()
                var side := Vector2(-axis.y, axis.x)
                ADraw.poly_fill_solid(fb, [end + axis * 7.0, end - axis * 2.0 + side * 3.5,
                    end - axis * 4.0, end - axis * 2.0 - side * 3.5], Vector3(0.38, 0.50, 0.90), true, dis * _stroke_remaining(i, t))
            # circuit pulse travelling the written stroke
            if t > 3.6:
                var pu := fmod(t * 0.7 + float(i) * 0.23, 1.0)
                var pp: Vector2 = pts[mini(pts.size() - 1, int(pu * float(pts.size())))]
                ADraw.glow(fb, pp.x, pp.y, 6.0, AMath.R("volt", 0.9), dis)
        # Ordered circuit strikes and final strike use the original C
        # branch geometry, rendered through A; complete fusion parity is open.
        for i in range(3):
            var lt := t - (4.4 + float(i) * 0.7)
            if lt < 0.0 or lt > 0.42:
                continue
            var tx := 200.0 + float(i) * 34.0
            _c_bolt(fb, Vector2(tx, 40.0), Vector2(tx, 118.0), float(i * 571 + int(floor(lt / 0.05)) * 13), _bolt_envelope(lt, 0.42), 2.1)
        var ft := t - 6.8
        if ft >= 0.0 and ft < 0.6:
            _c_bolt(fb, Vector2(C.x - 18.0, 12.0), Vector2(C.x, 150.0), float(991 + int(floor(ft / 0.05)) * 7), _bolt_envelope(ft, 0.6), 4.8, true)
            # C Thunderloom's actual seeded fracture tree, translated as a
            # visual-only impact material and rasterized by A. It does not
            # claim C's framebuffer, stage post or gameplay hit parity.
            for fracture in _c_fractures:
                for branch in fracture:
                    var points: Array = []
                    for point in branch.pts:
                        points.append((point as Vector2) - CThunderloom.TG + Vector2(C.x, 150.0))
                    var tree_strength := (1.8 * exp(-ft * 2.2) + 0.15) * _bolt_envelope(ft, 0.6)
                    ADraw.bolt_draw(fb, points, 1.7 * float(branch.w), AMath.R("volt", 0.6), AMath.R("volt", 1.0), tree_strength * float(branch.w))
            ADraw.pulse_ring(fb, C.x, 150.0, 6.0 + ft * 120.0, 3.0, AMath.R("volt", 0.7), 0.6 * (1.0 - ft / 0.6), 1.7)
