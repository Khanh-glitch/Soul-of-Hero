## Port of original A engine/framebuffer.ts at 416x234 (A's VIEW size).
## HDR buf + trail persistence + quarter-res bloom (2 passes, W_K) +
## ACES-ish tm + impact-frame modes + BAYER8 ordered-dither quantize.
## Differences vs original: (a) bg/base are ZERO (arena floor + floor
## warp excluded — floor is SOH terrain); (b) camera resample/waves
## resampling not applied (spells' refraction is a World concern; the
## spell light buffer itself is presented un-resampled, matching the
## engine's `idle` path); (c) alpha = 255 iff quantised RGB != black.
extends RefCounted
class_name AFramebuffer

const W := 416
const H := 234
const BAYER8: Array = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21]
const WK: Array = [0.0702, 0.1311, 0.1907, 0.216, 0.1907, 0.1311, 0.0702]

var buf := PackedFloat32Array()
var base := PackedFloat32Array()
var trail := PackedFloat32Array()
var bloom_a := PackedFloat32Array()
var bloom_b := PackedFloat32Array()
var track_world_fields := false
var world_coverage := PackedFloat32Array()
var world_multiplier := PackedFloat32Array()
var world_influence := PackedByteArray()
var bw: int
var bh: int
var exposure := 1.0
var flash := Vector3.ZERO
var bloom_amt := 0.75
var levels := 26
var chroma := 0.0
var impact_frames := 0
var impact_tint := Vector3.ONE

func _init() -> void:
    var n := W * H * 3
    buf.resize(n)
    world_coverage.resize(W * H)
    world_multiplier.resize(W * H)
    world_influence.resize(W * H)
    base.resize(n)
    trail.resize(n)
    bw = W >> 2
    bh = H >> 2
    bloom_a.resize(bw * bh * 3)
    bloom_b.resize(bw * bh * 3)

func clear() -> void:
    buf.fill(0.0)
    if track_world_fields:
        world_coverage.fill(0.0)
        world_multiplier.fill(1.0)
        world_influence.fill(0)
    exposure = 1.0
    flash = Vector3.ZERO
    bloom_amt = 0.75
    chroma = 0.0

func add(x: float, y: float, r: float, g: float, b: float, a: float = 1.0) -> void:
    var x0: int = floori(x)
    var y0: int = floori(y)
    var fx := x - float(x0)
    var fy := y - float(y0)
    if fx < 0.02 and fy < 0.02:
        if x0 < 0 or y0 < 0 or x0 >= W or y0 >= H:
            return
        var i := (y0 * W + x0) * 3
        if track_world_fields and a != 0.0:
            world_influence[y0 * W + x0] = 1
        buf[i] += r * a
        buf[i + 1] += g * a
        buf[i + 2] += b * a
        return
    _splat(x0, y0, r, g, b, (1.0 - fx) * (1.0 - fy) * a)
    _splat(x0 + 1, y0, r, g, b, fx * (1.0 - fy) * a)
    _splat(x0, y0 + 1, r, g, b, (1.0 - fx) * fy * a)
    _splat(x0 + 1, y0 + 1, r, g, b, fx * fy * a)

func _splat(x: int, y: int, r: float, g: float, b: float, wgt: float) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    var i := (y * W + x) * 3
    if track_world_fields and wgt != 0.0:
        world_influence[y * W + x] = 1
    buf[i] += r * wgt
    buf[i + 1] += g * wgt
    buf[i + 2] += b * wgt

func add_px(x: int, y: int, r: float, g: float, b: float, a: float = 1.0) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    var i := (y * W + x) * 3
    if track_world_fields and a != 0.0:
        world_influence[y * W + x] = 1
    buf[i] += r * a
    buf[i + 1] += g * a
    buf[i + 2] += b * a

func blend(x: int, y: int, r: float, g: float, b: float, a: float) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    var i := (y * W + x) * 3
    var ia := 1.0 - a
    if track_world_fields:
        var p := y * W + x
        world_coverage[p] = a + world_coverage[p] * ia
        world_influence[p] = 1
    buf[i] = buf[i] * ia + r * a
    buf[i + 1] = buf[i + 1] * ia + g * a
    buf[i + 2] = buf[i + 2] * ia + b * a

func mul(x: int, y: int, m: float) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    var i := (y * W + x) * 3
    if track_world_fields:
        world_multiplier[y * W + x] *= m
        world_influence[y * W + x] = 1
    buf[i] *= m
    buf[i + 1] *= m
    buf[i + 2] *= m

func get_px(x: int, y: int) -> Vector3:
    if x < 0 or y < 0 or x >= W or y >= H:
        return Vector3.ZERO
    var i := (y * W + x) * 3
    return Vector3(buf[i], buf[i + 1], buf[i + 2])

func scale_all(m: float) -> void:
    for i in range(buf.size()):
        buf[i] *= m

func mark_base() -> void:
    base = buf.duplicate()

func apply_trail(persist: float, decay: float, advance: bool = true) -> void:
    for i in range(buf.size()):
        var fx := buf[i] - base[i]
        var tr := trail[i]
        buf[i] += tr * persist
        if advance:
            var d := tr * decay
            trail[i] = fx if fx > d else d

func reset_trail() -> void:
    trail.fill(0.0)

static func _tm(x: float) -> float:
    if x <= 0.0:
        return 0.0
    var v := (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
    return minf(1.0, pow(v, 1.0 / 1.42))

func compute_bloom() -> void:
    # Original threshold/downsample and two separable blur passes. Shared by
    # the reference composite and the separate live-world source field.
    # bloom threshold + downsample
    bloom_a.fill(0.0)
    for y in range(H):
        # The source allocates floor(H / 4) rows. JS typed-array writes
        # outside that allocation are ignored; GDScript throws instead.
        # Preserve the source's discarded partial bottom block explicitly.
        if (y >> 2) >= bh:
            continue
        var by := (y >> 2) * bw
        for x in range(W):
            var i := (y * W + x) * 3
            var o := (by + (x >> 2)) * 3
            var l := buf[i] * 0.3 + buf[i + 1] * 0.55 + buf[i + 2] * 0.15
            if l > 0.65:
                var k := ((l - 0.65) / (l + 1e-5)) * 0.0625
                bloom_a[o] += buf[i] * k
                bloom_a[o + 1] += buf[i + 1] * k
                bloom_a[o + 2] += buf[i + 2] * k
    for pass_i in range(2):
        for y in range(bh):
            for x in range(bw):
                var o := (y * bw + x) * 3
                for c in range(3):
                    var s := 0.0
                    for k in range(-3, 4):
                        var xx: int = clampi(x + k, 0, bw - 1)
                        s += bloom_a[(y * bw + xx) * 3 + c] * float(WK[k + 3])
                    bloom_b[o + c] = s
        for y in range(bh):
            for x in range(bw):
                var o := (y * bw + x) * 3
                for c in range(3):
                    var s := 0.0
                    for k in range(-3, 4):
                        var yy: int = clampi(y + k, 0, bh - 1)
                        s += bloom_b[(yy * bw + x) * 3 + c] * float(WK[k + 3])
                    bloom_a[o + c] = s

func present() -> PackedByteArray:
    compute_bloom()
    var bytes := PackedByteArray()
    bytes.resize(W * H * 4)
    var q := float(levels - 1)
    var ex := exposure
    var imf := impact_frames
    if imf == 1:
        ex *= 1.4
    var cx := W * 0.5
    var cy := H * 0.5
    var inv_r := 1.0 / sqrt(cx * cx + cy * cy)
    var itm := maxf(maxf(impact_tint.x, impact_tint.y), maxf(impact_tint.z, 1e-9))
    for y in range(H):
        var byf: float = cl01((float(y) + 0.5) * 0.25 - 0.5, 0.0, float(bh) - 1.001)
        var by0: int = floori(byf)
        var by1: int = mini(bh - 1, by0 + 1)
        var bfy := byf - float(by0)
        for x in range(W):
            var i := (y * W + x) * 3
            var bxf: float = cl01((float(x) + 0.5) * 0.25 - 0.5, 0.0, float(bw) - 1.001)
            var bx0: int = floori(bxf)
            var bfx := bxf - float(bx0)
            var i00 := (by0 * bw + bx0) * 3
            var i01 := (by1 * bw + bx0) * 3
            var w00 := (1.0 - bfx) * (1.0 - bfy)
            var w10 := bfx * (1.0 - bfy)
            var w01 := (1.0 - bfx) * bfy
            var w11 := bfx * bfy
            var br := bloom_a[i00] * w00 + bloom_a[i00 + 3] * w10 + bloom_a[i01] * w01 + bloom_a[i01 + 3] * w11
            var bg2 := bloom_a[i00 + 1] * w00 + bloom_a[i00 + 4] * w10 + bloom_a[i01 + 1] * w01 + bloom_a[i01 + 4] * w11
            var bb := bloom_a[i00 + 2] * w00 + bloom_a[i00 + 5] * w10 + bloom_a[i01 + 2] * w01 + bloom_a[i01 + 5] * w11
            var r := (buf[i] + br * bloom_amt + flash.x) * ex
            var g := (buf[i + 1] + bg2 * bloom_amt + flash.y) * ex
            var b := (buf[i + 2] + bb * bloom_amt + flash.z) * ex
            var d := Vector2(float(x) - cx, float(y) - cy).length() * inv_r
            var vig := 1.0 - 0.38 * d * d
            r = _tm(r * vig)
            g = _tm(g * vig)
            b = _tm(b * vig)
            if imf >= 2:
                var l2 := r * 0.3 + g * 0.55 + b * 0.15
                if imf == 3:
                    var v := 1.0 if l2 > 0.2 else 0.0
                    r = v
                    g = v * 0.97
                    b = v * 0.93
                elif l2 > 0.2:
                    r = 0.02 * impact_tint.x / itm + 0.001
                    g = 0.015 * impact_tint.y / itm + 0.001
                    b = 0.03 * impact_tint.z / itm + 0.001
                    # original: fixed dark tint (0.02,0.015,0.03); kept:
                    r = 0.02
                    g = 0.015
                    b = 0.03
            var dth := ((float(BAYER8[(y & 7) * 8 + (x & 7)]) / 64.0 - 0.5) * 0.8) / q
            var o := (y * W + x) * 4
            var rb: int = clampi(int(floor((cl01(r + dth) * q + 0.5)) / q * 255.0), 0, 255)
            var gb: int = clampi(int(floor((cl01(g + dth) * q + 0.5)) / q * 255.0), 0, 255)
            var bbb: int = clampi(int(floor((cl01(b + dth) * q + 0.5)) / q * 255.0), 0, 255)
            bytes[o] = rb
            bytes[o + 1] = gb
            bytes[o + 2] = bbb
            bytes[o + 3] = 255 if (rb != 0 or gb != 0 or bbb != 0) else 0
    return bytes

static func cl01(v: float, a: float = 0.0, b: float = 1.0) -> float:
    return a if v < a else (b if v > b else v)
