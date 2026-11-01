## #05 selected C tide.ts late role: original C pool, radial shock,
## roaring column, seeded droplets/foam, ripples and water returning home.
## A owns the opening. After release, C's authored remaining membrane,
## mini-bloom, bubbles and glow are overtaken by its expanding shock; this
## preserves the original transition rather than replacing it with generic
## water. This is an unverified fusion component.
extends RefCounted
class_name CAbyssalBloomLate

const DURATION := 8.6
const C := Vector2(252, 112)
const SY := 0.72
const TF := 5.0
const TP := 5.6
const FOAM := Vector3(0.86, 0.97, 1.0)
var fx_shake := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0
var fx_kick := 0.0
var rng: CMath.CRng
var pets: Array = []
var bubbles: Array = []
var particles: Array = []
var ripples: Array = []
var erupted := false
var _tabs: Array = []

func setup() -> void:
    CPalette._ensure()
    rng = CMath.CRng.new(32676) # 1000 + source index 4 * 7919
    pets.clear()
    bubbles.clear()
    particles.clear()
    ripples.clear()
    erupted = false
    for k in range(6): pets.append({"ang": float(k) / 6.0 * CMath.TAU, "L": 30.0, "w": 6.0, "t0": 0.9 + k * 0.05, "dur": 1.3, "twist": 0.9, "seed": k})
    for k in range(6): pets.append({"ang": (float(k) + 0.5) / 6.0 * CMath.TAU, "L": 56.0, "w": 14.0, "t0": 1.8 + k * 0.07, "dur": 1.7, "twist": -0.35, "seed": k + 10})
    for k in range(12): pets.append({"ang": (float(k) + 0.25) / 12.0 * CMath.TAU, "L": 76.0, "w": 3.4, "t0": 3.0 + (k % 3) * 0.08, "dur": 1.4, "twist": 0.25, "seed": k + 20})
    # Preserve source setup RNG order; these bubbles remain until the C shock
    # reaches them during the release (they are not drawn in A's opening).
    for i in range(30):
        bubbles.append({"ang": rng.r(0, CMath.TAU), "r": rng.r(6, 40),
            "speed": rng.r(0.6, 1.6) * rng.sign(), "phase": rng.r(0, CMath.TAU)})
    _tabs.clear()
    for p in pets:
        var angles := PackedFloat32Array()
        var halfwidths := PackedFloat32Array()
        angles.resize(84)
        halfwidths.resize(84)
        _tabs.append({"len": 0.0, "ang": angles, "hw": halfwidths})

func authored_events() -> Array:
    # The A role emits the one pressure contact; this is a presentation event.
    return [{"t": TP, "kind": "column_erupt", "pos_local": C, "emitted": false}]

func _pet_len(p: Dictionary, t: float) -> float:
    var mt := minf(t, TF)
    var symmetry := CMath.inv(4.3, TF, t)
    return float(p.L) * CMath.ease_out((mt - float(p.t0)) / float(p.dur), 3.0) * (1.0 + 0.06 * sin(mt * 2.0 + float(p.seed)) * (1.0 - symmetry))

func _build_tabs(t: float) -> void:
    var mt := minf(t, TF)
    var motion := 1.0 - CMath.inv(4.3, TF, t)
    var fold := CMath.inv(2.4, 4.6, mt)
    for i in range(pets.size()):
        var p: Dictionary = pets[i]
        var tab: Dictionary = _tabs[i]
        var length := _pet_len(p, t)
        tab.len = length
        var angles: PackedFloat32Array = tab.ang
        var halfwidths: PackedFloat32Array = tab.hw
        for r in range(84):
            angles[r] = float(p.ang) + float(p.twist) * fold * (float(r) / float(p.L)) + sin(r * 0.12 - mt * 2.4 + float(p.seed)) * 0.13 * motion
            halfwidths[r] = 0.0 if float(r) > length or length < 1.0 else float(p.w) * pow(sin(PI * minf(1.0, float(r) / length)), 0.6) * (1.0 + 0.16 * sin(r * 0.5 - mt * 5.0 + float(p.seed)) * motion)
        tab.ang = angles
        tab.hw = halfwidths

func _covered(radius: float, angle: float) -> bool:
    var ri := mini(83, roundi(radius))
    for tab in _tabs:
        if float(tab.len) < 1.0 or radius > float(tab.len): continue
        if float(tab.hw[ri]) - absf(CMath.ang_diff(float(tab.ang[ri]), angle)) * radius > 0.0:
            return true
    return false

func update(dt: float, t: float) -> void:
    CKit.particles_update(particles, dt)
    if t > 1.5 and t < TF and rng.chance(0.25):
        var p: Dictionary = pets[rng.i(0, pets.size() - 1)]
        var length := _pet_len(p, t)
        if length > 10.0:
            var angle := float(p.ang)
            # Original early onLand uses q.life + source t.
            var ripple_list := ripples
            var landed := func(q: Dictionary) -> void: ripple_list.append({"x": q.x, "y": q.y, "t": float(q.life) + t, "r": 6.0})
            particles.append(CKit.pt_defaults({"x": C.x + cos(angle) * length, "y": C.y + sin(angle) * length * SY, "z": 2.0,
                "vx": cos(angle) * 18.0, "vy": sin(angle) * 12.0, "vz": rng.r(20, 50), "grav": 160.0,
                "kind": "drop", "max": 2.0, "onLand": landed}))
    if not erupted and t >= TP:
        erupted = true
        fx_shake = 5.0
        fx_flash = Vector3(0.5, 0.85, 1.0)
        fx_flash_k = 0.5
        fx_kick = 2.0
        _build_tabs(TF)
        # Capture the array and RNG, not the owning RefCounted: particles
        # storing this callback must not create a self-reference cycle.
        var ripple_list := ripples
        var source_rng := rng
        var landed := func(q: Dictionary) -> void: ripple_list.append({"x": float(q.x), "y": float(q.y), "t": 0.0, "r": source_rng.r(5, 9)})
        for i in range(700):
            var radius := rng.r(2, 78)
            var angle := rng.r(0, CMath.TAU)
            if not _covered(radius, angle): continue
            var sp := rng.r(30, 120)
            particles.append(CKit.pt_defaults({"x": C.x + cos(angle) * radius, "y": C.y + sin(angle) * radius * SY, "z": 4.0,
                "vx": cos(angle) * sp, "vy": sin(angle) * sp * SY, "vz": rng.r(50, 210), "grav": 250.0,
                "kind": "drop", "size": 2.0 if rng.chance(0.3) else 1.0, "max": 3.0, "delay": radius / 240.0, "onLand": landed}))
        for i in range(160):
            var angle := rng.r(0, CMath.TAU)
            var sp := rng.r(5, 40)
            particles.append(CKit.pt_defaults({"x": C.x, "y": C.y, "z": 2.0, "vx": cos(angle) * sp, "vy": sin(angle) * sp * SY,
                "vz": rng.r(220, 430), "grav": 300.0, "kind": "drop", "size": 2.0 if rng.chance(0.4) else 1.0,
                "max": 3.5, "onLand": landed, "c": Vector3(0.75, 0.95, 1.0)}))
        for i in range(70):
            var angle := rng.r(0, CMath.TAU)
            var sp := rng.r(20, 90)
            particles.append(CKit.pt_defaults({"x": C.x + cos(angle) * 6.0, "y": C.y + sin(angle) * 4.0,
                "vx": cos(angle) * sp, "vy": sin(angle) * sp * SY, "drag": 2.0, "kind": "foam", "max": rng.r(0.8, 1.6)}))
    for ripple in ripples:
        if float(ripple.t) == 0.0: ripple.t = t
    if erupted and t > 6.3 and t < 7.8 and rng.chance(0.6):
        var angle := rng.r(0, CMath.TAU)
        var radius := rng.r(50, 90)
        particles.append(CKit.pt_defaults({"x": C.x + cos(angle) * radius, "y": C.y + sin(angle) * radius * SY,
            "vx": -sin(angle) * 50.0, "vy": cos(angle) * 35.0, "home": C, "homeK": 2.4, "drag": 1.6,
            "kind": "spore", "col": CPalette.P.water, "c": Vector3(0.4, 0.8, 0.95), "k": 0.9, "max": rng.r(1.2, 1.8)}))

# Original C tide.ts remaining membrane after TP. The source keeps the
# petal tables frozen at TF, then clears them from the center at 240 px/s.
# This is intentionally release-only: the creator chose A for the opening.
func _render_release_membrane(f: CFrame, t: float, pulse_r: float) -> void:
    var bound := 82.0
    f.field(C.x - bound, C.y - bound * SY, C.x + bound, C.y + bound * SY, func(x: int, y: int) -> void:
        var dx := float(x) + 0.5 - C.x
        var dy := (float(y) + 0.5 - C.y) / SY
        var radius := sqrt(dx * dx + dy * dy)
        if radius > 80.0 or radius < pulse_r: return
        var angle := atan2(dy, dx)
        var ri := mini(83, roundi(radius))
        var coverage := 0
        var edge := 99.0
        for tab in _tabs:
            if float(tab.len) < 1.0 or radius > float(tab.len): continue
            var delta := absf(CMath.ang_diff(float(tab.ang[ri]), angle)) * radius
            var inside := float(tab.hw[ri]) - delta
            if inside > 0.0:
                coverage += 1
                edge = minf(edge, inside)
        if coverage == 0: return
        var n := CMath.noise3(radius * 0.11 - TF * 1.3, angle * 2.6, 1.0 + TF * 0.25)
        var color := CPalette.ramp_d(CPalette.P.water, 0.3 + coverage * 0.11 + (1.0 - radius / 80.0) * 0.12, CMath.bayer(x, y))
        var alpha := 0.32 + 0.12 * coverage
        if n > 0.63:
            color = CPalette.ramp(CPalette.P.deep, 0.6)
            alpha = 0.55
        f.Ic(x, y, color, alpha)
        f.D(x, y, cos(angle) * coverage * 0.8, sin(angle) * coverage * 0.8)
        # The original frozen glint is only for TF <= t < TP, not release.
        if edge < 1.15:
            f.Ic(x, y, FOAM, 0.7)
            f.Lc(x, y, FOAM, 0.3)
        elif CMath.hash3(x, y, floori(TF * 8.0)) > 0.987:
            f.Lc(x, y, Vector3.ONE, 0.6)
        if radius - pulse_r < 4.0: f.Lc(x, y, Vector3.ONE, 1.2))
    for i in range(6):
        var a := float(i) / 6.0 * CMath.TAU
        var radius := 40.0
        if radius < pulse_r: continue
        var cx := C.x + cos(a) * radius
        var cy := C.y + sin(a) * radius * SY
        var growth := CMath.ease_out((TF - (2.6 + i * 0.06)) / 0.9)
        for j in range(5):
            var b := float(j) / 5.0 * CMath.TAU + TF * 0.8
            f.ribbon([Vector2(cx, cy), Vector2(cx + cos(b) * 8.0 * growth, cy + sin(b) * 6.0 * growth)],
                [0.5, 2.4 * growth], func(x: int, y: int, _s: float, e: float) -> void:
                    f.Ic(x, y, CPalette.ramp(CPalette.P.water, 0.62), 0.55)
                    if absf(e) > 0.6: f.Lc(x, y, FOAM, 0.35))
        f.Lc(cx, cy, Vector3.ONE, 0.8 * growth)
    for bubble in bubbles:
        var radius := float(bubble.r) + sin(TF * 2.0 + float(bubble.phase)) * 3.0
        if radius < pulse_r: continue
        var angle := float(bubble.ang) + TF * float(bubble.speed)
        var x := C.x + cos(angle) * radius
        var y := C.y + sin(angle) * radius * SY - fmod(TF * 6.0 + float(bubble.phase) * 3.0, 8.0)
        f.Lc(x - 1.0, y, FOAM, 0.35)
        f.Lc(x + 1.0, y, FOAM, 0.35)
        f.Lc(x, y - 1.0, FOAM, 0.35)
        f.Lc(x, y + 1.0, FOAM, 0.2)
        f.Lc(x - 1.0, y - 1.0, Vector3.ONE, 0.4)
    f.glow(C.x, C.y, 70.0, CPalette.ramp(CPalette.P.water, 0.6), 0.12, 4.0, SY)

func render(f: CFrame, t: float) -> void:
    if t < TP: return
    var tp := minf(t, TF)
    var pr := 15.0 * CMath.ease_out(CMath.inv(0, 0.9, t)) * (1.0 - 0.4 * CMath.inv(7.6, 8.6, t))
    f.disc(C.x, C.y, pr + 26.0, func(x: int, y: int, dd: float) -> void:
        var d := dd * (pr + 26.0)
        if d > pr:
            var k := sin(d * 0.9 - tp * 4.0) * (1.0 - (d - pr) / 26.0)
            f.D(x, y, 0.0, k * 1.2)
            f.S(x, y, 1.0 - maxf(0.0, k) * 0.15)
            return
        var wave := sin(d * 1.1 - tp * 5.0 + sin(x * 0.3) * 0.5)
        var color := CPalette.ramp_d(CPalette.P.water, 0.3 + 0.12 * wave + (1.0 - d / pr) * 0.1, CMath.bayer(x, y))
        f.Ic(x, y, color, 0.72)
        if wave > 0.85: f.Lc(x, y, FOAM, 0.25)
        if d > pr - 1.2: f.Lc(x, y, FOAM, 0.35), SY)
    var age := t - TP
    if age < 0.5:
        _render_release_membrane(f, t, age * 240.0)
    if age < 0.6:
        CKit.shock(f, C.x, C.y, age * 240.0, 14.0, 9.0 * (1.0 - age / 0.6), SY, 1.5)
        f.ring_l(C.x, C.y, age * 240.0, FOAM, 1.0 - age / 0.6, SY)
    if age < 1.2:
        var hcol := 70.0 * sin(minf(1.0, age / 1.2) * PI)
        f.ribbon([C, C + Vector2(0, -hcol)], [9.0 * (1.0 - age), 3.0], func(x: int, y: int, s: float, e: float) -> void:
            var n := CMath.noise3(x * 0.3, y * 0.2 + t * 12.0, 2.0)
            f.Ic(x, y, CPalette.ramp_d(CPalette.P.water, 0.45 + n * 0.4 + s * 0.2, CMath.bayer(x, y)), 0.75)
            if absf(e) > 0.7 or n > 0.7: f.Lc(x, y, FOAM, 0.5))
    for ripple in ripples:
        var a := t - float(ripple.t)
        if a < 0.0 or a > 0.6: continue
        f.ring(float(ripple.x), float(ripple.y), 1.0 + a * float(ripple.r),
            func(x: int, y: int, _angle: float) -> void: f.I(x, y, 0.5, 0.8, 0.9, 0.5 * (1.0 - a / 0.6)), 0.55)
    CKit.particles_render(f, particles)
