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
        for i in range(5):
            _cracks.append(ACommon.grow_branches(rng, C.x - 40.0 + float(i) * 18.0, C.y + 18.0,
                0.5 + float(i) * 0.22, 2.2, {"steps": 9, "step": 5.0, "wander": 0.24, "branch_chance": 0.4, "max_depth": 2, "width_falloff": 0.55, "speed": 2.6}))
    func authored_events() -> Array:
        return [
            {"t": 1.2, "kind": "slit_open", "pos_local": C, "emitted": false},
            {"t": 2.6, "kind": "blade_materialise", "pos_local": C, "emitted": false},
            {"t": 3.4, "kind": "guillotine_impact", "pos_local": C, "emitted": false},
            {"t": 4.6, "kind": "rupture_impact", "pos_local": C + Vector2(40, 26), "emitted": false},
            {"t": 6.6, "kind": "wound_close", "pos_local": C, "emitted": false},
        ]
    func _section_visibility(index: int, t: float) -> float:
        var begin := 6.6 + float(index) * 0.22
        return 1.0 - AMath.seg(t, begin, begin + 0.52)
    func update(dt: float, t: float) -> void:
        for bs in _cracks:
            ACommon.update_branches(bs, maxf(0.0, t - 4.6))
    func render(fb: AFramebuffer, t: float) -> void:
        var slit := AMath.seg(t, 1.2, 2.4)
        var blade := AMath.seg(t, 2.6, 3.35)
        var cut := AMath.seg(t, 3.4, 3.52)
        var close_k := 1.0 - AMath.seg(t, 6.6, 8.0)
        var n := Vector2(-_dir.y, _dir.x)
        var p0: Vector2 = C - _dir * 92.0
        var p1: Vector2 = C + _dir * 92.0
        # thin slit first (readable telegraph along the diagonal)
        if slit > 0.0 and cut < 1.0:
            ADraw.streak(fb, p0.x, p0.y, p1.x, p1.y, 0.7, 0.7, AMath.R("fire", 0.65), slit * 0.8 * close_k)
        # blade materialises offset along normal, then one ultra-fast cut
        var off := (1.0 - cut) * (26.0 - blade * 22.0)
        var b0: Vector2 = p0 + n * off
        var b1: Vector2 = p1 + n * off
        if blade > 0.0 and t < 4.4:
            var bk := blade * (1.0 - AMath.seg(t, 3.6, 4.4)) * close_k
            ADraw.streak(fb, b0.x, b0.y, b1.x, b1.y, 3.2, 3.2, AMath.R("ash", 0.9), bk)
            ADraw.streak(fb, b0.x, b0.y, b1.x, b1.y, 1.2, 1.2, AMath.R("fire", 0.95), bk)
        if cut > 0.0:
            ADraw.streak(fb, p0.x, p0.y, p1.x, p1.y, 2.0, 2.0, AMath.R("fire", 0.9), (1.0 - AMath.seg(t, 3.5, 4.4)) * close_k)
        # Close the wound sections in order, not as one global fade.
        var rup := AMath.seg(t, 4.6, 5.4)
        if rup > 0.0:
            for section in range(_cracks.size()):
                var bs: Array = _cracks[section]
                ACommon.scar_decal(fb, bs, rup * _section_visibility(section, t) * 0.9, t)
            for k in range(9):
                var s := float(k) / 8.0
                var base_p: Vector2 = p0.lerp(p1, s)
                var section_fade := 1.0 - AMath.seg(t, 6.6 + float(k) * 0.1, 7.2 + float(k) * 0.1)
                var h := (14.0 + AMath.hash2(float(k), 2.0) * 22.0) * rup * section_fade
                ADraw.streak(fb, base_p.x, base_p.y + 14.0, base_p.x, base_p.y + 14.0 - h, 1.6, 0.5, ACommon.fire_col(0.5 + 0.4 * rup), rup * section_fade * 0.8)

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
        ev.append({"t": 4.6, "kind": "wave_release_impact", "pos_local": C + Vector2(60, 10), "emitted": false})
        ev.append({"t": 6.8, "kind": "strokes_dissolve", "pos_local": C, "emitted": false})
        return ev
    func update(dt: float, t: float) -> void:
        pass
    func render(fb: AFramebuffer, t: float) -> void:
        var diss := 1.0 - AMath.seg(t, 6.8, 8.4)
        for i in range(_strokes.size()):
            var u := AMath.cl01(AMath.seg(t, 1.0 + float(i) * 1.1, 2.0 + float(i) * 1.1))
            if u <= 0.0:
                continue
            var pts: Array = []
            for k in range(25):
                pts.append(_stroke_pt(i, u * float(k) / 24.0))
            ADraw.ribbon(fb, pts,
                func(s: float, _i: int) -> float: return 2.6 * (0.4 + 0.6 * sin(s * PI)),
                func(s: float, _i: int, edge: float) -> Variant:
                    var h := (1.0 - edge) * diss
                    if h < 0.05:
                        return null
                    return AMath.R("water", 0.35 + h * 0.6))
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
            ev.append({"t": 4.4 + float(i) * 0.7, "kind": "circuit_strike_impact", "pos_local": Vector2(200 + i * 34, 96), "emitted": false})
        ev.append({"t": 6.8, "kind": "skybreaker_impact", "pos_local": C, "emitted": false})
        ev.append({"t": 7.8, "kind": "glyph_disassemble", "pos_local": C, "emitted": false})
        return ev
    func _stroke_remaining(index: int, t: float) -> float:
        var begin := 7.8 + float(_glyph.size() - 1 - index) * 0.15
        return 1.0 - AMath.seg(t, begin, begin + 0.25)
    func update(dt: float, t: float) -> void:
        pass
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
        # ordered circuit strikes, then climactic strike (C #09 bolt craft)
        for i in range(3):
            var lt := t - (4.4 + float(i) * 0.7)
            if lt < 0.0 or lt > 0.3:
                continue
            var tx := 200.0 + float(i) * 34.0
            var bp := ADraw.bolt_path(tx, 40.0, tx, 118.0, 10.0, i * 571 + int(floor(lt / 0.05)) * 13, 4)
            ADraw.bolt_draw(fb, bp, 1.8, AMath.R("volt", 0.55), AMath.R("volt", 0.95), exp(-lt * 9.0))
        var ft := t - 6.8
        if ft >= 0.0 and ft < 0.6:
            var bp := ADraw.bolt_path(C.x, 26.0, C.x, 150.0, 16.0, 991 + int(floor(ft / 0.05)) * 7, 5)
            ADraw.bolt_draw(fb, bp, 3.4, AMath.R("volt", 0.6), AMath.R("volt", 1.0), exp(-ft * 5.0))
            ADraw.pulse_ring(fb, C.x, 150.0, 6.0 + ft * 120.0, 3.0, AMath.R("volt", 0.7), 0.6 * (1.0 - ft / 0.6), 1.7)
