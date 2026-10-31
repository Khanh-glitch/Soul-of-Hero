## Selected #16 source-level fusion candidate. The seed, four growth sheets,
## time functions, pollen simulation and bloom are ported from original A
## verdant.ts Worldseed (seed 0x5eed); live-world sheet/seed surfaces use
## original C Worldseed's leaf/bloom/gold material rules and authored ink
## coverage. Legacy candidate and original sources remain untouched.
## Source comparison / full motion / viewport post / visual approval pending.
extends RefCounted
class_name AWorldseedGrowth

const DURATION := 8.0
const C := Vector2(232, 124)
const SQ := 1.45
const CRACK := 2.0
const BLOOM := 5.3
const FOLD := 6.8
var rng: AMath.ARng
var layers: Array = []
var pollen: ADraw.APool
# false isolates the original A color/additive source for parity tests.
var use_c_material := true

func setup() -> void:
    CPalette._ensure()
    rng = AMath.ARng.new(0x5eed)
    layers.clear()
    pollen = ADraw.APool.new()
    var specs := [
        {"count": 5, "len": 26.0, "w": 0.55, "t0": 2.1, "sp": 1.1, "hue": 0.35, "tremble": 2.0},
        {"count": 8, "len": 46.0, "w": 0.42, "t0": 2.5, "sp": 0.75, "hue": 0.55, "tremble": 1.2},
        {"count": 12, "len": 74.0, "w": 0.3, "t0": 3.0, "sp": 0.5, "hue": 0.72, "tremble": 0.6},
        {"count": 16, "len": 104.0, "w": 0.22, "t0": 3.6, "sp": 0.36, "hue": 0.9, "tremble": 0.3},
    ]
    for spec in specs:
        spec.tilt = rng.angle()
        layers.append(spec)

func source_seeds() -> PackedInt32Array:
    return PackedInt32Array([0x5eed])

func authored_events() -> Array:
    # Phase markers describe geometry; they do not invent combat contact.
    return [{"t": CRACK, "kind": "seed_crack", "pos_local": C, "emitted": false},
        {"t": BLOOM, "kind": "bloom_peak", "pos_local": C, "emitted": false},
        {"t": FOLD, "kind": "petals_fold", "pos_local": C, "emitted": false}]

func update(dt: float, t: float) -> void:
    if t < CRACK and pollen.count() < 40 and rng.next() < 0.4:
        var a := rng.angle()
        pollen.spawn({"x": C.x + cos(a) * rng.rangef(8, 22), "y": C.y + sin(a) * rng.rangef(6, 16) / SQ,
            "vx": rng.rangef(-5, 5), "vy": rng.rangef(-8, 2), "life": 3.0, "k": 0.0, "seed": rng.next() * 999.0})
    if t > BLOOM and t < BLOOM + 0.7 and pollen.count() < 520:
        for i in range(24):
            var a := rng.angle()
            var speed := rng.rangef(30, 230)
            pollen.spawn({"x": C.x, "y": C.y, "vx": cos(a) * speed, "vy": sin(a) * speed / SQ,
                "life": rng.rangef(1.2, 3.0), "k": rng.next(), "a": rng.angle(), "av": rng.rangef(-4, 4),
                "size": rng.rangef(0.8, 2.4), "seed": rng.next() * 999.0})
    pollen.each(func(p: Dictionary) -> void:
        p.vx = float(p.vx) * exp(-1.1 * dt)
        p.vy = float(p.vy) * exp(-1.1 * dt) - 8.0 * dt)
    pollen.step(dt)

# C's ink is coverage-based; fractional A sheet stamps use explicit bilinear
# coverage, never a luminance key. This is a fusion adaptation, not C parity.
func _ink_splat(fb: AFramebuffer, x: float, y: float, color: Vector3) -> void:
    var x0 := floori(x)
    var y0 := floori(y)
    var fx := x - x0
    var fy := y - y0
    if fx < 0.02 and fy < 0.02:
        fb.blend(x0, y0, color.x, color.y, color.z, 1.0)
        return
    fb.blend(x0, y0, color.x, color.y, color.z, (1.0 - fx) * (1.0 - fy))
    fb.blend(x0 + 1, y0, color.x, color.y, color.z, fx * (1.0 - fy))
    fb.blend(x0, y0 + 1, color.x, color.y, color.z, (1.0 - fx) * fy)
    fb.blend(x0 + 1, y0 + 1, color.x, color.y, color.z, fx * fy)

func _c_surface(layer: int, petal: int, u: float, v: float, x: float, y: float, t: float) -> Vector3:
    var av := absf(v)
    var threshold := CMath.bayer(roundi(x), roundi(y))
    if layer == 0:
        return CPalette.ramp_d(CPalette.P.gold, 0.55 + 0.4 * (1.0 - av), threshold)
    if layer == 1:
        var cu := u * 7.0 + CMath.hash2(petal, floori(u * 7.0)) * 0.3
        var cv := (v + 1.0) * 2.5
        var wall := fmod(cu, 1.0) < 0.16 or fmod(cv, 1.0) < 0.16
        if av > 0.85:
            return CPalette.ramp(CPalette.P.bloom, 0.15)
        return CPalette.ramp_d(CPalette.P.bloom, 0.25 + 0.42 * (1.0 - av) + (0.15 if wall else 0.0), threshold)
    var unfold := AMath.ease_out(CMath.inv(2.6, 6.0, t), 2.0)
    var tone := 0.28 + 0.2 * (1.0 - av)
    if av < 0.1: tone += 0.25
    if fposmod(u * 9.0 - av * 1.5, 1.0) < 0.12: tone += 0.12
    if unfold < 1.0 and u > 0.86: tone += 0.25
    if av > 0.86: tone = 0.12
    return CPalette.ramp_d(CPalette.P.leaf, tone, threshold)

func render(fb: AFramebuffer, t: float) -> void:
    var crack := AMath.seg(t, CRACK, CRACK + 0.5)
    var fold := AMath.seg(t, FOLD, DURATION)
    var bloom_k := AMath.seg(t, BLOOM, BLOOM + 0.5)
    var seed_r := lerpf(7.0, 10.0, sin(t * 1.4) * 0.5 + 0.5) * (1.0 - crack * 0.35) * (1.0 - fold)
    if seed_r > 0.5:
        var rotation := t * 0.7
        ADraw.field(fb, C.x - seed_r * 1.4, C.y - seed_r * 1.4, C.x + seed_r * 1.4, C.y + seed_r * 1.4, func(x: int, y: int, out: Array) -> void:
            var dx := float(x) - C.x
            var dy := (float(y) - C.y) * 1.2
            var d := sqrt(dx * dx + dy * dy)
            if d > seed_r: return
            var a := atan2(dy, dx) + rotation
            var veins := absf(sin(a * 3.0 + d * 0.5))
            var h := 0.22 + (1.0 - d / seed_r) * 0.2 + veins * 0.35 * (1.0 - d / seed_r)
            if d > seed_r - 1.2: h = 0.62
            if use_c_material:
                var material := CPalette.ramp_d(CPalette.P.leaf, h, CMath.bayer(x, y))
                fb.blend(x, y, material.x, material.y, material.z, 1.0)
            else:
                var color := ACommon.ramp_step("gold", AMath.cl01(h), 7.0) * 0.55
                out[0] = color.x
                out[1] = color.y
                out[2] = color.z)
        ADraw.glow(fb, C.x, C.y, seed_r * 2.4, Vector3(1.0, 0.85, 0.4), 0.3 + crack * 0.6)
        if crack > 0.0:
            var i := -seed_r
            while i <= seed_r:
                var k := 1.0 - absf(i) / seed_r
                fb.add(C.x + i * 0.3, C.y + i, 2.4 * k * crack, 2.2 * k * crack, 1.6 * k * crack, 1.0)
                i += 1.0
    for li in range(layers.size()):
        var layer: Dictionary = layers[li]
        var u := AMath.ease_out(AMath.seg(t, float(layer.t0), float(layer.t0) + 1.0 / float(layer.sp)), 2.0)
        if fold > 0.0: u *= 1.0 - AMath.ease_out(fold, 1.6)
        if u <= 0.01: continue
        var pulse := 1.0 + 0.18 * sin(t * 7.0 - li * 1.2) * maxf(0.0, 1.0 - (t - BLOOM) * 0.6) if bloom_k > 0.0 else 1.0
        for petal in range(int(layer.count)):
            var a0 := float(layer.tilt) + float(petal) / float(layer.count) * AMath.TAU
            var length := float(layer.len) * u * pulse
            var tremble := sin(t * (3.0 + float(layer.tremble) * 3.0) + petal) * float(layer.tremble) * 0.02
            var us := maxi(6, ceili(length))
            var vs := maxi(4, ceili(length * float(layer.w) * 0.9))
            for ii in range(us + 1):
                var uu := float(ii) / float(us)
                for jj in range(vs + 1):
                    var v := float(jj) / float(vs) * 2.0 - 1.0
                    var av := absf(v)
                    var cell := AMath.fbm(uu * 7.0 + petal * 2.0, av * 5.0 - t * 1.1, 3)
                    var vein := exp(-pow(av * 4.0, 2.0)) * 0.3
                    var h := 0.16 + cell * 0.26 + vein + pow(av, 4.0) * 0.5
                    var wave := maxf(0.0, sin(uu * 8.0 - t * 5.0 + li * 1.5))
                    h += wave * 0.2 * (1.6 if bloom_k > 0.0 else 0.6)
                    h *= (1.0 - uu * 0.2) * AMath.smoothstep(0.02, 0.26, uu)
                    if h < 0.05: continue
                    var a := a0 + tremble * uu + sin(uu * 2.5) * 0.12
                    var radius := (5.0 + li * 5.0) * u + length * uu
                    var width := length * float(layer.w) * sin(pow(uu, 0.6) * PI)
                    var x := C.x + cos(a) * radius - sin(a) * v * width
                    var y := C.y + (sin(a) * radius + cos(a) * v * width) / SQ - uu * uu * 10.0 * u
                    if use_c_material:
                        _ink_splat(fb, x, y, _c_surface(li, petal, uu, v, x, y, t))
                    else:
                        var ramp := "bloom" if float(layer.hue) < 0.5 else ("verdant" if li == 3 else "bio")
                        var color := ACommon.ramp_step(ramp, AMath.cl01(h), 8.0) * 0.42
                        fb.add(x, y, color.x, color.y, color.z)
    var core_u := AMath.seg(t, 4.0, BLOOM)
    if core_u > 0.0 and fold < 1.0:
        var radius := (3.0 + core_u * 9.0) * (1.0 + bloom_k * 1.4) * (1.0 - fold)
        ADraw.glow(fb, C.x, C.y - 4.0, radius * 1.9, Vector3(1.3, 1.2, 0.7), 0.3 + bloom_k * 0.55)
        for i in range(9):
            var a := float(i) / 9.0 * AMath.TAU + t * 0.8
            var color := CPalette.ramp(CPalette.P.gold, 0.8) if use_c_material else ACommon.ramp_step("gold", 0.8, 6.0)
            ADraw.streak(fb, C.x, C.y - 4.0, C.x + cos(a) * radius, C.y - 4.0 + sin(a) * radius / SQ, 1.4, 0.4, color, 0.8)
    if bloom_k > 0.0 and bloom_k < 1.0:
        var k := sin(bloom_k * PI)
        var color := CPalette.ramp(CPalette.P.bloom, 0.5) if use_c_material else ACommon.ramp_step("bloom", 0.5, 6.0)
        ADraw.pulse_ring(fb, C.x, C.y, bloom_k * 120.0, 30.0 * (1.0 - bloom_k) + 6.0, color, k * 0.22, SQ, 0.14, 1.3)
        fb.flash.x += 0.1 * k * k
        fb.flash.y += 0.09 * k * k
    pollen.each(func(p: Dictionary) -> void:
        var l := float(p.life) / float(p.max)
        var tw := 0.55 + 0.45 * sin(t * 7.0 + float(p.seed))
        var material := "gold" if float(p.k) < 0.5 else "bloom"
        var color := CPalette.ramp(CPalette.P[material], 0.5 + l * 0.4) if use_c_material else ACommon.ramp_step(material, 0.5 + l * 0.4, 6.0)
        fb.add(float(p.x), float(p.y), color.x * 0.6 * tw, color.y * 0.6 * tw, color.z * 0.6 * tw, l)
        if float(p.size) > 1.8:
            var angle := float(p.a) + float(p.av) * (float(p.max) - float(p.life))
            fb.add(float(p.x) + cos(angle) * 1.4, float(p.y) + sin(angle), color.x * 0.4, color.y * 0.4, color.z * 0.4, l * 0.7))
