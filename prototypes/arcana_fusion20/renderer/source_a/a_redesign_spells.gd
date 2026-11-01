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
        # Draw-back is deliberate, then a single accelerating three-tick
        # strike lands exactly on the authored 3.4 contact. A small rebound
        # carries the mass after impact without introducing a second cut.
        var pull := 8.0 * AMath.ease_out(AMath.seg(t, 3.02, 3.35), 2.0)
        var strike := AMath.ease_in(AMath.seg(t, 3.35, 3.4), 2.0)
        var recoil := 5.0 * AMath.bump(AMath.seg(t, 3.4, 3.85))
        return 26.0 + pull - 24.0 * strike + recoil
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
        var b0: Vector2 = p0 + n * off
        var b1: Vector2 = p1 + n * off
        if blade > 0.0 and t < 4.4:
            var bk := blade * (1.0 - AMath.seg(t, 3.6, 4.4)) * close_k
            var width := 42.0 * blade
            var spine1 := b1 + n * width * 0.90
            var edge0 := b0 - n * width * 0.24
            var edge1 := b1 - _dir * 18.0 - n * width * 0.24
            var tip := b1 + _dir * 11.0 + n * width * 0.10
            var shoulder := b0 + _dir * 13.0 + n * width * 0.48
            var back := b0 + _dir * 42.0 + n * width * 0.58
            ADraw.poly_fill(fb, [b0 + n * width * 0.10, shoulder, back, spine1, tip, edge1, edge0],
                func(x: int, y: int) -> Variant:
                    var q := Vector2(float(x) + 0.5, float(y) + 0.5) - b0
                    var transverse := q.dot(n) / maxf(width, 0.01)
                    var longitudinal := q.dot(_dir)
                    var grain := AMath.hash2(floor(longitudinal * 0.22), floor(transverse * 8.0))
                    var bevel := AMath.cl01((-0.04 - transverse) * 4.0)
                    var plane := AMath.cl01((0.95 - transverse) * 0.9)
                    var facet := 0.04 if int(floor((longitudinal + transverse * 12.0) / 19.0)) % 2 == 0 else 0.0
                    var metal := 0.04 + 0.14 * plane + 0.29 * bevel + 0.025 * grain + facet * plane
                    return Vector3(metal * 0.82, metal * 0.87, metal), true, bk)
            # Steel cutting bevel, a narrow molten vein and two inset marks
            # describe one solid blade rather than an emissive beam.
            ADraw.streak(fb, edge0.x, edge0.y, edge1.x, edge1.y, 1.2, 0.7, AMath.R("ash", 0.9), bk * 0.9)
            var seam0 := b0 + _dir * 20.0 + n * width * 0.20
            var seam1 := b1 - _dir * 15.0 + n * width * 0.20
            ADraw.streak(fb, seam0.x, seam0.y, seam1.x, seam1.y, 0.7, 0.5, AMath.R("fire", 0.8), bk * 0.7)
            for mark in [0.28, 0.57, 0.78]:
                var m: Vector2 = seam0.lerp(seam1, mark)
                ADraw.streak(fb, m.x - n.x * width * 0.08, m.y - n.y * width * 0.08,
                    m.x + n.x * width * 0.12 + _dir.x * 5.0, m.y + n.y * width * 0.12 + _dir.y * 5.0,
                    0.8, 0.6, AMath.R("ash", 0.55), bk * 0.65)
        if cut > 0.0:
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
                var middle := a.lerp(b, 0.52) + n * (2.0 if section % 2 == 0 else -2.0)
                var gap := 3.8 * open
                ADraw.poly_fill(fb, [a, middle + n * gap, b, middle - n * gap],
                    func(_x: int, _y: int) -> Variant: return Vector3(0.018, 0.014, 0.014), true, open * 0.96)
                ADraw.streak(fb, a.x, a.y, middle.x, middle.y, 1.0, 0.8, AMath.R("fire", 0.68), open * 0.55)
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
                var radius := 2.2 + 2.4 * AMath.hash2(seed, 7.0)
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
                var point := _stroke_pt(i, progress)
                # Original A tide.ts stroke inertia, adapted to the new
                # three-stroke glyph, not the rejected A choreography.
                point.y += sin(progress * 9.0 - t * 5.0 + float(i)) * 1.6 * (1.0 - progress)
                pts.append(point)
            var charge := AMath.seg(t, 4.2, 4.6)
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float:
                    return 5.0 * (0.35 + sin(pow(s, 0.8) * PI) * 0.95) * (1.0 + charge * 0.4),
                func(s: float, _i: int, edge: float) -> Variant:
                    # A source foam/flow logic; this is an A-buffer candidate,
                    # not a complete A/C source-fusion parity claim.
                    var flow := AMath.fbm(s * 14.0 - t * 2.4 + float(i) * 9.0, edge * 3.0, 3)
                    var h := (0.24 + flow * 0.3 + pow(edge, 2.6) * 0.65 + maxf(0.0, sin(s * 18.0 - t * 26.0 + i * 2.0)) * charge * 0.7) * diss
                    if h < 0.05: return null
                    var c := ACommon.ramp_step("water", AMath.cl01(h), 8.0)
                    return Vector3(c.x * 0.55, c.y * 0.55, c.z * 0.6))
            if u < 1.0:
                var tip := _stroke_pt(i, u)
                ADraw.disc(fb, tip.x, tip.y, 2.2, AMath.R("water", 0.95), diss)
                ADraw.glow(fb, tip.x, tip.y, 8.0, AMath.R("water", 0.75), diss)
        # weaponised wave fronts travel along stroke direction
        if t > 4.6:
            var wu := AMath.seg(t, 4.6, 6.4)
            for i in range(3):
                var base_p := _stroke_pt(i, 0.5)
                ADraw.arc_px(fb, base_p.x, base_p.y, 8.0 + wu * 76.0, -0.7 + float(i) * 0.3, 0.9 + float(i) * 0.3, AMath.R("water", 0.8), (1.0 - wu) * diss, 1.6)

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
            if lt < 0.0 or lt > 0.3:
                continue
            var tx := 200.0 + float(i) * 34.0
            _c_bolt(fb, Vector2(tx, 40.0), Vector2(tx, 118.0), float(i * 571 + int(floor(lt / 0.05)) * 13), exp(-lt * 9.0), 1.8)
        var ft := t - 6.8
        if ft >= 0.0 and ft < 0.6:
            _c_bolt(fb, Vector2(C.x, 26.0), Vector2(C.x, 150.0), float(991 + int(floor(ft / 0.05)) * 7), exp(-ft * 5.0), 3.4)
            ADraw.pulse_ring(fb, C.x, 150.0, 6.0 + ft * 120.0, 3.0, AMath.R("volt", 0.7), 0.6 * (1.0 - ft / 0.6), 1.7)
