## #05 component port: A tide.ts AbyssalBloom's original seeded opening,
## membrane sheet raster, bubbles and freeze peak. Deliberately excludes A's
## eruption tails/pressure and drops so the separately ported C column/fall
## can own the late role. This component is NOT yet a complete fusion and is
## not wired into the default candidate. Compare selected passes before use.
extends RefCounted
class_name AAbyssalBloomLead

const C := Vector2(232, 124)
const SQ := 1.5
const BURST := 5.0
const DURATION := 8.6
var rng: AMath.ARng
var petals: Array = []
var inner: Array = []
var bubbles: Array = []

func setup() -> void:
    rng = AMath.ARng.new(0xb100)
    petals.clear()
    inner.clear()
    bubbles.clear()
    for i in range(7):
        petals.append({"a": float(i) / 7.0 * AMath.TAU + rng.rangef(-0.05, 0.05),
            "len": rng.rangef(58, 82), "w": rng.rangef(0.42, 0.62),
            "curl": rng.rangef(-0.5, 0.5), "delay": rng.rangef(0, 0.4), "twist": rng.rangef(-0.3, 0.3)})
    for i in range(7):
        inner.append({"a": float(i) / 7.0 * AMath.TAU + PI / 7.0,
            "len": rng.rangef(28, 44), "w": rng.rangef(0.3, 0.48), "delay": rng.rangef(0.3, 0.9)})
    for i in range(46):
        bubbles.append({"a": rng.angle(), "r": rng.rangef(6, 52),
            "sp": rng.rangef(0.5, 2.2) * rng.sign(), "z": rng.next(), "s": rng.rangef(0.5, 1.6)})

func source_seeds() -> PackedInt32Array:
    return PackedInt32Array([0xb100])

func authored_events() -> Array:
    # A's pressure cue is retained; only R4 may authorize an actual hit.
    return [{"t": BURST, "kind": "bloom_release_impact", "pos_local": C, "emitted": false}]

func update(_dt: float, _t: float) -> void:
    pass

func _petal(fb: AFramebuffer, t: float, burst: float, open: float, fade: float, freeze: float,
        a0: float, length: float, width: float, curl: float, growth: float, depth: float, twist: float) -> void:
    var size := length * growth * open
    if size < 2.0:
        return
    var us := maxi(8, ceili(size * 1.1))
    var vs := maxi(6, ceili(size * width * 1.3))
    # Original tide.ts sheet raster walks parametric (u,v) and stamps at
    # subpixel coordinates into the source framebuffer, not a polygon proxy.
    for i in range(us + 1):
        var u := float(i) / float(us)
        for j in range(vs + 1):
            var v := float(j) / float(vs) * 2.0 - 1.0
            var av := absf(v)
            var flow := AMath.fbm(u * 6.0 - t * 1.6, v * 3.0 + a0 * 2.0, 3)
            var h := (0.26 + flow * 0.3 + pow(av, 3.0) * 0.55) * (1.0 - u * 0.25) * depth * fade
            if freeze > 0.0: h += freeze * 0.18
            if h < 0.04: continue
            var color := ACommon.ramp_step("water", AMath.cl01(h), 8.0) * 0.5
            var angle := a0 + curl * u * u + sin(t * 1.3 + u * 3.0 + a0) * 0.08 * twist
            var rr := size * u
            var wid := size * width * sin(pow(u, 0.65) * PI) * (1.0 - burst * 0.2)
            var rip := sin(u * 7.0 - t * 4.0 + a0 * 3.0) * 2.2 * u + AMath.fbm(u * 5.0 + a0, t * 0.9, 2) * 3.0 * u
            var lateral := v * wid + rip * v * 0.3
            var x := C.x + cos(angle) * rr - sin(angle) * lateral
            var y := C.y + (sin(angle) * rr + cos(angle) * lateral) / SQ - u * u * 6.0 * growth
            fb.add(x, y, color.x, color.y, color.z)
    if fade > 0.2:
        for i in range(5):
            var u := 0.55 + AMath.hash2(i, floor(a0 * 97.0)) * 0.45
            var ph := t * 2.0 + i
            var angle := a0 + curl * u * u
            var wid := size * width * sin(pow(u, 0.65) * PI)
            var side := 1.0 if sin(ph) > 0.0 else -1.0
            var fraction := fposmod(ph, 1.0)
            var x := C.x + cos(angle) * size * u - sin(angle) * side * (wid + 2.0 + fraction * 5.0)
            var y := C.y + (sin(angle) * size * u + cos(angle) * side * (wid + 2.0 + fraction * 5.0)) / SQ
            fb.add(x, y, 1.1, 1.8, 2.2, 0.5 * fade * (1.0 - fraction))

func render(fb: AFramebuffer, t: float) -> void:
    var ring := AMath.seg(t, 0, 1)
    var grow := AMath.seg(t, 0.8, 3.6)
    var freeze := AMath.smoothstep(4.3, 4.6, t) * (1.0 - AMath.smoothstep(BURST, BURST + 0.05, t))
    var burst := AMath.seg(t, BURST, BURST + 1.9)
    var open := 1.0 + AMath.ease_out(burst, 2.0) * 0.9 if burst > 0 else 1.0
    var fade := 1.0 - AMath.cl01(burst * 1.5)
    if fade > 0.0 or burst > 0.0:
        var rr := lerpf(10.0, 40.0, AMath.ease_out(ring, 2.0)) * (1.0 + burst * 2.2)
        var k := (0.8 - burst * 0.5) * (1.0 if ring > 0.0 else 0.0)
        if k > 0.0:
            ADraw.field(fb, C.x - rr * 1.6, C.y - rr * 1.6 / SQ, C.x + rr * 1.6, C.y + rr * 1.6 / SQ,
                func(x: int, y: int, out: Array) -> void:
                    var dx := float(x) + 0.5 - C.x
                    var dy := (float(y) + 0.5 - C.y) * SQ
                    var d := Vector2(dx, dy).length()
                    if d > rr * 1.5: return
                    var wave := sin(d * 0.55 - t * 3.4 + AMath.fbm(dx * 0.05, dy * 0.05 + t * 0.3, 3) * 4.0)
                    var edge := AMath.cl01(1.0 - absf(d - rr) / (rr * 0.55))
                    var h := (0.28 + wave * 0.3) * edge * k
                    if h <= 0.02: return
                    var color := ACommon.ramp_step("water", AMath.cl01(h * 1.6), 7.0)
                    out[0] = color.x
                    out[1] = color.y
                    out[2] = color.z)
    for p in petals:
        var g := AMath.ease_out(AMath.cl01((grow - float(p.delay) * 0.25) / 0.8), 2.0)
        _petal(fb, t, burst, open, fade, freeze, p.a, p.len, p.w, p.curl, g, 1.0, p.twist)
    for p in inner:
        var g := AMath.ease_out(AMath.cl01((grow - float(p.delay) * 0.4) / 0.7), 2.0)
        _petal(fb, t, burst, open, fade, freeze, p.a, p.len, p.w, -0.35, g, 1.35, 0.6)
    if fade > 0.1:
        for b in bubbles:
            var angle: float = float(b.a) + float(b.sp) * t * (0.4 + float(b.z))
            var rr: float = float(b.r) * (0.4 + grow * 0.75) * open
            var x := C.x + cos(angle) * rr
            var y := C.y + sin(angle) * rr / SQ - float(b.z) * 8.0 * grow
            var k: float = (0.25 + float(b.z) * 0.6) * fade
            fb.add(x, y, 0.5, 1.1, 1.6, k)
            if float(b.s) > 1.2: fb.add(x, y - 1.0, 1.2, 1.9, 2.3, k * 0.6)
    if freeze > 0:
        ADraw.glow(fb, C.x, C.y, 34, Vector3(0.5, 1.0, 1.5), 0.5 * freeze)
        for i in range(90):
            var angle := float(i) / 90.0 * AMath.TAU
            var rr := 64.0 + sin(angle * 7.0) * 4.0
            fb.add(C.x + cos(angle) * rr, C.y + sin(angle) * rr / SQ, 1.0, 1.7, 2.1, 0.45 * freeze)
