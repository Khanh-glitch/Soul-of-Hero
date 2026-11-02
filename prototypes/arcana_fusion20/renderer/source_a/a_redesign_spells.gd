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
            var root := C + _dir * (float(i - 2) * 32.0)
            var angle := normal.angle() + (PI if i % 2 == 0 else 0.0)
            _cracks.append(ACommon.grow_branches(rng, root.x, root.y,
                angle, 2.2, {"steps": 9, "step": 5.0, "wander": 0.24, "branch_chance": 0.4, "max_depth": 2, "width_falloff": 0.55, "speed": 2.6}))
    func authored_events() -> Array:
        var events := [
            {"t": 1.2, "kind": "slit_open", "pos_local": C, "emitted": false},
            {"t": 2.6, "kind": "blade_materialise", "pos_local": C, "emitted": false},
            {"t": 3.4, "kind": "guillotine_impact", "pos_local": C, "emitted": false},
        ]
        # Visual contact cues only; the owner decides any gameplay hit. Each
        # cue coincides with its section's first visible opening.
        for section in range(5):
            var center := C + _dir * (-92.0 + (float(section) + 0.5) * 184.0 / 5.0)
            events.append({"t": 4.6 + float(section) * 0.08, "kind": "rupture_impact", "pos_local": center, "emitted": false})
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
        # the original 3.4 contact. Thirteen ticks of travel expose the mass
        # in a real-world recording instead of a three-tick teleport. Recoil
        # is recovery, never a second strike or a gameplay contact.
        var pull := 18.0 * AMath.ease_out(AMath.seg(t, 2.96, 3.18), 2.0)
        var strike := AMath.ease_in(AMath.seg(t, 3.18, 3.4), 2.0)
        var recoil := 5.0 * AMath.bump(AMath.seg(t, 3.4, 3.85))
        return 26.0 + pull - 34.0 * strike + recoil
    func _blade_direction(t: float) -> Vector2:
        # The cocked tip resolves into the original diagonal at contact.
        # This is the same single blade, not an additional glowing sweep.
        var swing := AMath.ease_in(AMath.seg(t, 3.18, 3.4), 2.0)
        return _dir.rotated(-0.16 * (1.0 - swing))
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
            var groove := 1.15 * cut
            if t < 4.95:
                ADraw.poly_fill(fb, [p0 - n * groove, p1 - n * groove, p1 + n * groove, p0 + n * groove],
                    func(_x: int, _y: int) -> Variant: return Vector3(0.025, 0.018, 0.017), true, (1.0 - AMath.seg(t, 4.6, 4.95)) * close_k)
            ADraw.streak(fb, p0.x, p0.y, p1.x, p1.y, 2.0, 2.0, AMath.R("fire", 0.9), (1.0 - AMath.seg(t, 3.5, 4.4)) * close_k)
        # The delayed wound opens segment by segment along the contact line.
        # Opaque charcoal fissures are actual geometry, not dark-keyed light.
        var rup := AMath.seg(t, 4.6, 5.4)
        if rup > 0.0:
            for section in range(5):
                var u0 := float(section) / 5.0
                var u1 := float(section + 1) / 5.0
                var a: Vector2 = p0.lerp(p1, u0)
                var b: Vector2 = p0.lerp(p1, u1)
                var open := AMath.ease_out(AMath.seg(t, 4.6 + float(section) * 0.08, 5.0 + float(section) * 0.08), 2.0) * _section_visibility(section, t)
                # Irregular opposing fracture banks, with nonzero widths at
                # section boundaries. The old repeated diamonds looked like
                # detached plates; the continuous undercut and staggered rock
                # edges instead describe one wound opening along the cut.
                var gap := 8.5 * open
                var mid_u := 0.36 + 0.19 * AMath.hash2(float(section), 14.0)
                var upper_a: Vector2 = a + n * gap * 0.34
                var upper_m: Vector2 = a.lerp(b, mid_u) + n * gap * (0.68 + 0.30 * AMath.hash2(float(section), 12.0))
                var upper_b: Vector2 = b + n * gap * 0.34
                var lower_a: Vector2 = a - n * gap * 0.34
                var lower_m: Vector2 = a.lerp(b, 0.67 - mid_u * 0.20) - n * gap * (0.45 + 0.34 * AMath.hash2(float(section), 15.0))
                var lower_b: Vector2 = b - n * gap * 0.34
                var seam := 1.3 * open
                ADraw.poly_fill(fb, [a - n * seam, b - n * seam, b + n * seam, a + n * seam],
                    func(_x: int, _y: int) -> Variant: return Vector3(0.018, 0.014, 0.014), true, open * 0.96)
                ADraw.poly_fill(fb, [upper_a, upper_m, upper_b, lower_b, lower_m, lower_a],
                    func(x: int, y: int) -> Variant:
                        var across := absf((Vector2(float(x) + 0.5, float(y) + 0.5) - a).dot(n)) / maxf(gap, 0.01)
                        var grain := AMath.hash2(floor(float(x) * 0.5), floor(float(y) * 0.5))
                        var rock := 0.025 + AMath.cl01(across) * 0.20 + grain * 0.025
                        return Vector3(rock, rock * 0.78, rock * 0.70), true, open * 0.96)
                ADraw.streak(fb, upper_a.x, upper_a.y, upper_m.x, upper_m.y, 1.2, 0.8, AMath.R("fire", 0.72), open * 0.60)
                ADraw.streak(fb, upper_m.x, upper_m.y, upper_b.x, upper_b.y, 0.8, 1.0, AMath.R("fire", 0.72), open * 0.60)
                ADraw.streak(fb, lower_a.x, lower_a.y, lower_m.x, lower_m.y, 0.9, 0.7, AMath.R("ash", 0.55), open * 0.45)
                ADraw.streak(fb, lower_m.x, lower_m.y, lower_b.x, lower_b.y, 0.7, 0.9, AMath.R("ash", 0.55), open * 0.45)
                var bs: Array = _cracks[section]
                ACommon.scar_decal(fb, bs, open * 0.9, t)
            # Fragment trajectories begin on the actual cut and separate
            # under gravity as individual fractured plates, not a second hit.
            for k in range(10):
                var age := t - (4.6 + float(k) * 0.055)
                if age <= 0.0 or age >= 1.5: continue
                var seed := float(k)
                var origin: Vector2 = p0.lerp(p1, (float(k) + 0.5) / 10.0)
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
        var u := AMath.seg(t, 4.6, 6.4)
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
        var diss := (1.0 - 0.45 * AMath.seg(t, 4.6, 6.4)) * (1.0 - AMath.seg(t, 6.8, 8.4))
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
            if u < 1.0:
                var tip := _ink_point(i, u, t)
                ADraw.disc_blend(fb, tip.x, tip.y, 2.8, Vector3(0.16, 0.49, 0.58), diss * 0.65)
                ADraw.disc(fb, tip.x, tip.y, 2.2, AMath.R("water", 0.95), diss)
        # One coherent mass of water departs the written glyph. The curved
        # crest travels across the real ground; its shoulders expand and its
        # foam dissolves, rather than three unrelated thin radial arcs.
        if t > 4.6 and t < 6.4:
            var wu := AMath.seg(t, 4.6, 6.4)
            var front := _wave_front(t)
            var wave_pts: Array = []
            var height := 12.0 + 48.0 * AMath.ease_out(wu, 2.0)
            for k in range(33):
                var v := float(k) / 32.0
                var side := v * 2.0 - 1.0
                var curl := side * side * (5.0 + 19.0 * wu)
                wave_pts.append(front + Vector2(-curl + sin(v * PI * 4.0 - t * 4.0) * 1.5, side * height))
            var wave_fade := (1.0 - AMath.seg(t, 6.1, 6.4)) * diss
            ADraw.ribbon(fb, wave_pts,
                func(v: float, _i: int) -> float: return (3.5 + 6.5 * sin(v * PI)) * (0.55 + 0.45 * wu),
                func(v: float, _i: int, edge: float) -> Variant:
                    var foam := pow(edge, 2.4)
                    var flow := 0.5 + 0.5 * sin(v * 19.0 - t * 12.0)
                    return Vector3(0.05 + 0.30 * foam, 0.24 + 0.28 * foam + 0.06 * flow, 0.34 + 0.30 * foam + 0.08 * flow),
                true, wave_fade * 0.68)
            ADraw.ribbon(fb, wave_pts,
                func(v: float, _i: int) -> float: return 1.3 + 1.0 * sin(v * PI),
                func(v: float, _i: int, edge: float) -> Variant:
                    return AMath.R("water", 0.58 + 0.20 * sin(v * 20.0 - t * 12.0)), false, wave_fade * 0.55)

# ------------------------------------------- #12 skybreaker script
class SkybreakerScriptR:
    extends RefCounted
    const DUR := 8.6
    var _glyph: Array = []
    func setup() -> void:
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
    func _frame_point(index: int) -> Vector2:
        var angle := -PI * 0.5 + float(index) * TAU / 8.0
        return Vector2(232.0 + cos(angle) * 82.0, 101.0 + sin(angle) * 69.0)
    func _frame_written(index: int, t: float) -> float:
        var begin := 1.05 + float(index) * 0.22
        return AMath.seg(t, begin, begin + 0.42)
    func _frame_remaining(index: int, t: float) -> float:
        # Outer circuit disassembles in reverse write order, ahead of cleanup.
        var begin := 7.65 + float(7 - index) * 0.095
        return 1.0 - AMath.seg(t, begin, begin + 0.27)
    func _bolt_envelope(local_time: float, duration: float) -> float:
        # Presentation hold preserves the authored strike time but makes C's
        # branching readable in sparse world captures, followed by a decay.
        return 1.0 - AMath.seg(local_time, duration * 0.24, duration)
    func update(dt: float, t: float) -> void:
        pass
    func _c_bolt(fb: AFramebuffer, a: Vector2, b: Vector2, seed: float, strength: float, width: float) -> void:
        # Actual selected C #09 generator, adapted to A's buffer. Geometry is
        # C; A's raster/color and the rest of the selected source remain an
        # unverified fusion candidate rather than C framebuffer parity.
        var tree := CKit.bolt_tree(seed, a.x, a.y, b.x, b.y, 2, 0.24)
        for branch in tree:
            ADraw.bolt_draw(fb, branch.pts, width * float(branch.w), AMath.R("volt", 0.6), AMath.R("volt", 1.0), strength * float(branch.w))
    func render(fb: AFramebuffer, t: float) -> void:
        var dis := 1.0 - AMath.seg(t, 8.45, 8.6)
        # A new authored frame, not source-A parity: an eight-part circuit
        # progressively writes around the retained internal rune. Failure
        # separates its joints before the original C-tree climax; reverse
        # order and visibility are explicit rather than a screen-wide glow.
        for i in range(8):
            var written := _frame_written(i, t)
            var left := _frame_remaining(i, t)
            if written <= 0.0 or left <= 0.0:
                continue
            var p0 := _frame_point(i)
            var p1 := _frame_point((i + 1) % 8)
            var failure := AMath.seg(t, 6.05, 6.8)
            var edge := p1 - p0
            var trim := failure * 0.08
            var start_pt := p0 + edge * trim
            var end_pt := p0 + edge * minf(written, 1.0 - trim)
            var intensity := left * dis * (0.45 + 0.30 * AMath.seg(t, 3.4, 4.3))
            # Cool ink underlay is real local coverage, making the circuit
            # read over bright terrain without changing global exposure.
            ADraw.ribbon(fb, [start_pt, end_pt],
                func(_s: float, _i: int) -> float: return 1.5,
                func(_s: float, _i: int, _e: float) -> Variant: return Vector3(0.17, 0.23, 0.42),
                true, intensity * 0.43)
            ADraw.streak(fb, start_pt.x, start_pt.y, end_pt.x, end_pt.y, 1.5, 1.1, AMath.R("volt", 0.72), intensity)
            if written > 0.92:
                var midpoint := p0.lerp(p1, 0.5)
                var radial := (midpoint - Vector2(232, 101)).normalized()
                var tang := Vector2(-radial.y, radial.x)
                var tick0 := midpoint - tang * 4.0
                var tick1 := midpoint + radial * 7.0
                var tick2 := midpoint + tang * 4.0
                ADraw.streak(fb, tick0.x, tick0.y, tick1.x, tick1.y, 0.8, 0.8, AMath.R("volt", 0.82), intensity)
                ADraw.streak(fb, tick1.x, tick1.y, tick2.x, tick2.y, 0.8, 0.8, AMath.R("volt", 0.82), intensity)
                # An actual moving charge follows each authored circuit edge.
                if t >= 3.6 and t < 6.8:
                    var travel := fmod((t - 3.6) * 0.65 + float(i) * 0.125, 1.0)
                    var charge := p0.lerp(p1, travel)
                    ADraw.disc(fb, charge.x, charge.y, 1.5, AMath.R("volt", 1.0), intensity * 0.85)
                if i % 2 == 0:
                    # Four structural bridges tie the outer circuit to the
                    # existing inner glyph rather than a second floating ring.
                    var inner_anchors: Array = [Vector2(232, 48), Vector2(264, 96), Vector2(252, 138), Vector2(200, 96)]
                    var anchor: Vector2 = inner_anchors[i >> 1]
                    var node := p0.lerp(anchor, 0.64)
                    ADraw.streak(fb, p0.x, p0.y, node.x, node.y, 0.9, 0.8, AMath.R("volt", 0.62), intensity)
                    ADraw.streak(fb, node.x, node.y, anchor.x, anchor.y, 0.8, 0.7, AMath.R("volt", 0.80), intensity)
                    var perpendicular := Vector2(-radial.y, radial.x)
                    var wing_a := node + perpendicular * 4.0
                    var wing_b := node - perpendicular * 4.0
                    ADraw.streak(fb, wing_a.x, wing_a.y, node.x, node.y, 0.65, 0.65, AMath.R("volt", 0.78), intensity)
                    ADraw.streak(fb, wing_b.x, wing_b.y, node.x, node.y, 0.65, 0.65, AMath.R("volt", 0.78), intensity)
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
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 1.8,
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * dis
                    if h < 0.05:
                        return null
                    return AMath.R("volt", 0.4 + h * 0.55))
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
            _c_bolt(fb, Vector2(C.x, 26.0), Vector2(C.x, 150.0), float(991 + int(floor(ft / 0.05)) * 7), _bolt_envelope(ft, 0.6), 3.8)
            ADraw.pulse_ring(fb, C.x, 150.0, 6.0 + ft * 120.0, 3.0, AMath.R("volt", 0.7), 0.6 * (1.0 - ft / 0.6), 1.7)
