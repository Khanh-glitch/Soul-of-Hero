## Faithful port of original C engine/frame.ts (384x216 software raster:
## ground / ink / light / disp layers) + the compositor math from
## engine/gl.ts COMP shader. ADAPTATION (documented, anti-compositing):
## the Gold floor (`base`/`ground`) is forced to ZERO — C spells that
## displace or shade the ground still compute their disp field, but
## there is no fake floor to bend; SOH supplies the real world behind.
## Bloom/downsample passes of the GL compositor are NOT reproduced in
## the buffer parity path (post difference, documented); invert /
## desat / flash / chroma / shake from COMP are reproduced.
## Legacy composite() alpha: 255 iff composited RGB != 0 (same rule as B).
## Experimental native_passes() instead exposes explicit ink + additive light;
## it does not implement world ground/displacement or screen-space post.
extends RefCounted
class_name CFrame

const W := 384
const H := 216
const N := W * H
# Conservative authored-operation activity, never inferred from RGB. A clear
# resets it; consumers may reuse an already-clear texture on inactive frames.
const FIELD_GROUND := 1
const FIELD_INK := 2
const FIELD_LIGHT := 4
const FIELD_DISP := 8
const FIELD_FRAGMENT := 16
const FIELD_INFLUENCE := 32
var field_activity := 0

var ground := PackedByteArray()
# Source ground is painted over an external base. Track authored decal
# coverage independently so even a black mark can be applied to live terrain.
var ground_coverage := PackedFloat32Array()
# Source-world fragment sampling map, not a copied screenshot. Optional,
# because the legacy source reference needs the original zero-base behavior.
var track_world_fragments := false
var world_fragment := PackedFloat32Array()
# Sparse, ordered additive live-world samples. Multiple samples at one pixel
# remain distinct, so overlapping A20 debris never overwrites an earlier map.
var live_light_buckets: Dictionary = {}
# Explicit authored operation footprint for contamination checks and shader
# scissoring; independent of resulting RGB or resulting ink alpha.
var world_influence := PackedByteArray()
var ink := PackedFloat32Array()
var light := PackedFloat32Array()
var disp := PackedFloat32Array()
var _mark := PackedInt32Array()
var _gen := 1
var t := 0.0

# compositor post state (stage fx)
var shake := Vector2.ZERO
var invert := 0.0
var desat := 0.0
var chroma := 0.0
var flash := Vector3.ZERO

func _init() -> void:
    ground.resize(N * 4)
    ground_coverage.resize(N)
    world_fragment.resize(N * 4)
    world_influence.resize(N)
    ink.resize(N * 4)
    light.resize(N * 4)
    disp.resize(N * 4)
    _mark.resize(N)
    clear()

func clear() -> void:
    field_activity = 0
    ground.fill(0)
    ground_coverage.fill(0.0)
    if track_world_fragments:
        world_fragment.fill(0.0)
        world_influence.fill(0)
        live_light_buckets.clear()
    ink.fill(0.0)
    light.fill(0.0)
    for i in range(0, N * 4, 4):
        disp[i] = 0.0
        disp[i + 1] = 0.0
        disp[i + 2] = 1.0
        disp[i + 3] = 0.0

func L(x: float, y: float, r: float, g: float, b: float) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return
    var i := (yi * W + xi) * 4
    field_activity |= FIELD_LIGHT | FIELD_INFLUENCE
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
    light[i] += r
    light[i + 1] += g
    light[i + 2] += b

func Lc(x: float, y: float, c: Vector3, k: float = 1.0) -> void:
    L(x, y, c.x * k, c.y * k, c.z * k)

# Original A framebuffer.add splats a sample to up to four destination pixels.
func add_live_world_light(x: float, y: float, sx: int, sy: int, gain: float) -> void:
    var x0 := floori(x)
    var y0 := floori(y)
    var fx := x - float(x0)
    var fy := y - float(y0)
    if fx < 0.02 and fy < 0.02:
        _record_live_light(x0, y0, sx, sy, gain)
        return
    _record_live_light(x0, y0, sx, sy, gain * (1.0 - fx) * (1.0 - fy))
    _record_live_light(x0 + 1, y0, sx, sy, gain * fx * (1.0 - fy))
    _record_live_light(x0, y0 + 1, sx, sy, gain * (1.0 - fx) * fy)
    _record_live_light(x0 + 1, y0 + 1, sx, sy, gain * fx * fy)

func _record_live_light(x: int, y: int, sx: int, sy: int, gain: float) -> void:
    if not track_world_fragments or gain <= 0.0 or x < 0 or y < 0 or x >= W or y >= H: return
    var p := y * W + x
    if not live_light_buckets.has(p): live_light_buckets[p] = []
    (live_light_buckets[p] as Array).append(Vector3(sx, sy, gain))
    world_influence[p] = 1
    field_activity |= FIELD_INFLUENCE

func add_bilinear_light(x: float, y: float, c: Vector3) -> void:
    var x0 := floori(x); var y0 := floori(y)
    var fx := x - float(x0); var fy := y - float(y0)
    if fx < 0.02 and fy < 0.02:
        Lc(x0, y0, c)
        return
    Lc(x0, y0, c, (1.0 - fx) * (1.0 - fy))
    Lc(x0 + 1, y0, c, fx * (1.0 - fy))
    Lc(x0, y0 + 1, c, (1.0 - fx) * fy)
    Lc(x0 + 1, y0 + 1, c, fx * fy)

# Compressed-row offsets/counts plus a dense float atlas of source mappings.
# No maximum overlaps per pixel; the original order is preserved in each row.
func live_light_fields() -> Dictionary:
    var index := PackedFloat32Array()
    index.resize(N * 4)
    var ops := PackedFloat32Array()
    var count := 0
    for pixel in live_light_buckets:
        var bucket: Array = live_light_buckets[pixel]
        index[int(pixel) * 4] = float(count)
        index[int(pixel) * 4 + 1] = float(bucket.size())
        for v in bucket:
            var operation: Vector3 = v
            ops.append(operation.x)
            ops.append(operation.y)
            ops.append(operation.z)
            ops.append(0.0)
            count += 1
    var height := maxi(1, ceili(float(count) / float(W)))
    ops.resize(W * height * 4)
    return {"index": index, "operations": ops, "height": height, "count": count}

func I(x: float, y: float, r: float, g: float, b: float, a: float = 1.0) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H or a <= 0.0:
        return
    if a > 1.0:
        a = 1.0
    var i := (yi * W + xi) * 4
    var ia := 1.0 - a
    field_activity |= FIELD_INK | FIELD_INFLUENCE
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
        # Source-over ink changes fragment coverage only where one exists.
        # This tests authored coverage, never black vs bright RGB.
        if world_fragment[i + 2] != 0.0:
            field_activity |= FIELD_FRAGMENT
        world_fragment[i + 2] *= ia
    ink[i] = r * a + ink[i] * ia
    ink[i + 1] = g * a + ink[i + 1] * ia
    ink[i + 2] = b * a + ink[i + 2] * ia
    ink[i + 3] = a + ink[i + 3] * ia

## Original blitBase writes a source-world fragment into ink. For the world
## path keep its source coordinates and coverage rather than black pixels;
## the compositor samples the real scene at these positions. On the legacy
## zero-base path preserve the old reference behavior exactly.
func blit_world_fragment(sx: int, sy: int, w: int, h: int, dx: int, dy: int) -> void:
    for yy in range(h):
        for xx in range(w):
            var x := dx + xx
            var y := dy + yy
            if x < 0 or y < 0 or x >= W or y >= H:
                continue
            if not track_world_fragments:
                I(float(x), float(y), 0.0, 0.0, 0.0, 1.0)
                continue
            var i := (y * W + x) * 4
            field_activity |= FIELD_FRAGMENT | FIELD_INFLUENCE
            ink[i] = 0.0
            ink[i + 1] = 0.0
            ink[i + 2] = 0.0
            ink[i + 3] = 0.0
            world_influence[y * W + x] = 1
            world_fragment[i] = float(clampi(sx + xx, 0, W - 1))
            world_fragment[i + 1] = float(clampi(sy + yy, 0, H - 1))
            world_fragment[i + 2] = 1.0
            world_fragment[i + 3] = 0.0

func Ic(x: float, y: float, c: Vector3, a: float = 1.0) -> void:
    I(x, y, c.x, c.y, c.z, a)

func Id(x: float, y: float, c: Vector3, a: float) -> void:
    if a > CMath.bayer(int(x), int(y)):
        I(x, y, c.x, c.y, c.z, 1.0)

func G(x: float, y: float, r: float, g: float, b: float, a: float = 1.0) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return
    var i := (yi * W + xi) * 4
    var ia := 1.0 - a
    field_activity |= FIELD_GROUND | FIELD_INFLUENCE
    ground_coverage[yi * W + xi] = a + ground_coverage[yi * W + xi] * ia
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
    ground[i] = int(ground[i] * ia + r * 255.0 * a)
    ground[i + 1] = int(ground[i + 1] * ia + g * 255.0 * a)
    ground[i + 2] = int(ground[i + 2] * ia + b * 255.0 * a)

func Gc(x: float, y: float, c: Vector3, a: float = 1.0) -> void:
    G(x, y, c.x, c.y, c.z, a)

## Original C Reality Ripper baseAt inversion, but sampled from the real world.
## `world_fragment.w` records the authored transform, never a color key.
func inverted_live_fragment(x: int, y: int, sx: float, sy: float) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    if not track_world_fragments:
        I(x, y, 0.65, 0.2, 0.65, 1.0)
        return
    var i := (y * W + x) * 4
    field_activity |= FIELD_FRAGMENT | FIELD_INFLUENCE
    ink[i] = 0.0
    ink[i + 1] = 0.0
    ink[i + 2] = 0.0
    ink[i + 3] = 0.0
    world_fragment[i] = clampi(int(sx), 0, W - 1)
    world_fragment[i + 1] = clampi(int(sy), 0, H - 1)
    world_fragment[i + 2] = 1.0
    world_fragment[i + 3] = 1.0
    world_influence[y * W + x] = 1

## C20 closing region: source samples a neighboring live-world pixel and
## applies its authored channel-specific inversion. This must not key by RGB.
func ripper_remainder_fragment(x: int, y: int, sx: int, sy: int) -> void:
    if x < 0 or y < 0 or x >= W or y >= H: return
    if not track_world_fragments:
        I(x, y, 1.0, 1.0, 1.0, 1.0)
        return
    var i := (y * W + x) * 4
    field_activity |= FIELD_FRAGMENT | FIELD_INFLUENCE
    ink[i] = 0.0
    ink[i + 1] = 0.0
    ink[i + 2] = 0.0
    ink[i + 3] = 0.0
    world_fragment[i] = clampi(sx, 0, W - 1)
    world_fragment[i + 1] = clampi(sy, 0, H - 1)
    world_fragment[i + 2] = 1.0
    world_fragment[i + 3] = 2.0
    world_influence[y * W + x] = 1

func D(x: float, y: float, dx: float, dy: float) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return
    var i := (yi * W + xi) * 4
    field_activity |= FIELD_DISP | FIELD_INFLUENCE
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
    disp[i] += dx
    disp[i + 1] += dy

func S(x: float, y: float, m: float) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return
    field_activity |= FIELD_DISP | FIELD_INFLUENCE
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
    disp[(yi * W + xi) * 4 + 2] *= m

func C(x: float, y: float, v: float) -> void:
    var xi := int(x)
    var yi := int(y)
    if xi < 0 or yi < 0 or xi >= W or yi >= H:
        return
    field_activity |= FIELD_DISP | FIELD_INFLUENCE
    if track_world_fragments:
        world_influence[yi * W + xi] = 1
    disp[(yi * W + xi) * 4 + 3] += v

func field(x0: float, y0: float, x1: float, y1: float, fn: Callable) -> void:
    var ax := maxi(0, floori(x0))
    var ay := maxi(0, floori(y0))
    var bx := mini(W - 1, ceili(x1))
    var by := mini(H - 1, ceili(y1))
    for y in range(ay, by + 1):
        for x in range(ax, bx + 1):
            fn.call(x, y)

func line(x0: float, y0: float, x1: float, y1: float, fn: Callable) -> void:
    var ax := roundi(x0)
    var ay := roundi(y0)
    var bx := roundi(x1)
    var by := roundi(y1)
    var dx := absi(bx - ax)
    var dy := -absi(by - ay)
    var sx := 1 if ax < bx else -1
    var sy := 1 if ay < by else -1
    var err := dx + dy
    var n := maxi(dx, -dy)
    var k := 0
    if n > 2000:
        return
    while true:
        fn.call(ax, ay, float(k) / float(n) if n != 0 else 0.0)
        if ax == bx and ay == by:
            break
        var e2 := 2 * err
        if e2 >= dy:
            err += dy
            ax += sx
        if e2 <= dx:
            err += dx
            ay += sy
        k += 1

func line_l(x0: float, y0: float, x1: float, y1: float, c: Vector3, k: float = 1.0) -> void:
    line(x0, y0, x1, y1, func(x: int, y: int, _s: float) -> void: L(x, y, c.x * k, c.y * k, c.z * k))

func line_i(x0: float, y0: float, x1: float, y1: float, c: Vector3, a: float = 1.0) -> void:
    line(x0, y0, x1, y1, func(x: int, y: int, _s: float) -> void: I(x, y, c.x, c.y, c.z, a))

func polyline_l(pts: Array, c: Vector3, k: float = 1.0) -> void:
    for i in range(pts.size() - 1):
        line_l(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, c, k)

func disc(cx: float, cy: float, r: float, fn: Callable, sy: float = 1.0) -> void:
    if r <= 0.0:
        return
    var ry := r * sy
    field(cx - r - 1.0, cy - ry - 1.0, cx + r + 1.0, cy + ry + 1.0, func(x: int, y: int) -> void:
        var dx := (float(x) + 0.5 - cx) / r
        var dy := (float(y) + 0.5 - cy) / ry
        var d := dx * dx + dy * dy
        if d <= 1.0:
            fn.call(x, y, sqrt(d)))

func disc_l(cx: float, cy: float, r: float, c: Vector3, k: float = 1.0, sy: float = 1.0) -> void:
    if r < 0.7:
        L(cx, cy, c.x * k, c.y * k, c.z * k)
        return
    disc(cx, cy, r, func(x: int, y: int, _d: float) -> void: L(x, y, c.x * k, c.y * k, c.z * k), sy)

func disc_i(cx: float, cy: float, r: float, c: Vector3, a: float = 1.0, sy: float = 1.0) -> void:
    if r < 0.7:
        I(cx, cy, c.x, c.y, c.z, a)
        return
    disc(cx, cy, r, func(x: int, y: int, _d: float) -> void: I(x, y, c.x, c.y, c.z, a), sy)

func ring(cx: float, cy: float, r: float, fn: Callable, sy: float = 1.0) -> void:
    if r < 0.5:
        fn.call(floori(cx), floori(cy), 0.0)
        return
    var n := maxi(8, ceili(r * 7.0))
    var lx := -9999
    var ly := -9999
    for i in range(n):
        var a := float(i) / float(n) * CMath.TAU
        var x := floori(cx + cos(a) * r)
        var y := floori(cy + sin(a) * r * sy)
        if x == lx and y == ly:
            continue
        lx = x
        ly = y
        fn.call(x, y, a)

func ring_l(cx: float, cy: float, r: float, c: Vector3, k: float = 1.0, sy: float = 1.0) -> void:
    ring(cx, cy, r, func(x: int, y: int, _a: float) -> void: L(x, y, c.x * k, c.y * k, c.z * k), sy)

func glow(cx: float, cy: float, r: float, c: Vector3, k: float = 1.0, bands: float = 4.0, sy: float = 1.0) -> void:
    if r <= 0.0 or k == 0.0:
        return
    disc(cx, cy, r, func(x: int, y: int, d: float) -> void:
        var f: float = ceil((1.0 - d) * bands) / bands
        var v := f * f * k
        L(x, y, c.x * v, c.y * v, c.z * v), sy)

func shade_disc(cx: float, cy: float, r: float, m: float, sy: float = 1.0, bands: float = 3.0) -> void:
    disc(cx, cy, r, func(x: int, y: int, d: float) -> void:
        var f: float = ceil((1.0 - d) * bands) / bands
        S(x, y, 1.0 - (1.0 - m) * f), sy)

func poly(pts: Array, fn: Callable) -> void:
    if pts.size() < 3:
        return
    var min_y := 1e18
    var max_y := -1e18
    for p in pts:
        min_y = minf(min_y, p.y)
        max_y = maxf(max_y, p.y)
    var y0 := maxi(0, floori(min_y))
    var y1 := mini(H - 1, ceili(max_y))
    var xs: Array = []
    for y in range(y0, y1 + 1):
        var sy := float(y) + 0.5
        xs.clear()
        var j := pts.size() - 1
        for i in range(pts.size()):
            var a: Vector2 = pts[i]
            var b: Vector2 = pts[j]
            if (a.y <= sy and b.y > sy) or (b.y <= sy and a.y > sy):
                xs.append(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x))
            j = i
        xs.sort()
        var k := 0
        while k + 1 < xs.size():
            var xa := maxi(0, roundi(float(xs[k])))
            var xb := mini(W - 1, roundi(float(xs[k + 1])) - 1)
            for x in range(xa, xb + 1):
                fn.call(x, y)
            k += 2

func poly_l(pts: Array, c: Vector3, k: float = 1.0) -> void:
    poly(pts, func(x: int, y: int) -> void: L(x, y, c.x * k, c.y * k, c.z * k))

func poly_i(pts: Array, c: Vector3, a: float = 1.0) -> void:
    poly(pts, func(x: int, y: int) -> void: I(x, y, c.x, c.y, c.z, a))

func poly_outline_l(pts: Array, c: Vector3, k: float = 1.0) -> void:
    for i in range(pts.size()):
        var a: Vector2 = pts[i]
        var b: Vector2 = pts[(i + 1) % pts.size()]
        line_l(a.x, a.y, b.x, b.y, c, k)

func ribbon(pts: Array, widths: Variant, fn: Callable) -> void:
    if pts.size() < 2:
        return
    _gen += 1
    var g := _gen
    var n := pts.size() - 1
    for i in range(n):
        var a: Vector2 = pts[i]
        var b: Vector2 = pts[i + 1]
        var wa := float(widths) if widths is float or widths is int else float(widths[i])
        var wb := float(widths) if widths is float or widths is int else float(widths[i + 1])
        if wa <= 0.0 and wb <= 0.0:
            continue
        var mw := maxf(wa, wb) + 1.0
        var x0 := maxi(0, floori(minf(a.x, b.x) - mw))
        var x1 := mini(W - 1, ceili(maxf(a.x, b.x) + mw))
        var y0 := maxi(0, floori(minf(a.y, b.y) - mw))
        var y1 := mini(H - 1, ceili(maxf(a.y, b.y) + mw))
        var dx := b.x - a.x
        var dy := b.y - a.y
        var ll := dx * dx + dy * dy
        if ll == 0.0:
            ll = 1e-6
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                var idx := y * W + x
                if _mark[idx] == g:
                    continue
                var px := float(x) + 0.5 - a.x
                var py := float(y) + 0.5 - a.y
                var u := CMath.cl01((px * dx + py * dy) / ll)
                var qx := px - dx * u
                var qy := py - dy * u
                var d := Vector2(qx, qy).length()
                var w := wa + (wb - wa) * u
                if d <= w + 0.001 and w > 0.25:
                    _mark[idx] = g
                    var side := 1.0 if dx * py - dy * px >= 0.0 else -1.0
                    fn.call(x, y, (float(i) + u) / float(n), (d / maxf(w, 0.5)) * side)

## COMP shader from gl.ts, ground forced to zero (see header).
func composite() -> PackedByteArray:
    var out := PackedByteArray()
    out.resize(N * 4)
    var shx := roundi(shake.x)
    var shy := roundi(shake.y)
    for fy in range(H):
        for fx in range(W):
            var qx := clampi(fx - shx, 0, W - 1)
            var qy := clampi(fy - shy, 0, H - 1) # buffers already top-down (no GL Y-flip)
            var qi := (qy * W + qx) * 4
            var d0 := disp[qi]
            var d1 := disp[qi + 1]
            var d2 := disp[qi + 2]
            var d3 := disp[qi + 3]
            var spx := clampi(qx + floori(d0 + 0.5), 0, W - 1)
            var spy := clampi(qy + floori(d1 + 0.5), 0, H - 1)
            var ch := d3 + chroma
            var gr := 0.0
            var gg := 0.0
            var gb := 0.0
            var lr := 0.0
            var lg := 0.0
            var lb := 0.0
            if ch > 0.2:
                var o2 := ceili(ch)
                var gi := (spy * W + clampi(spx + o2, 0, W - 1)) * 4
                var gi2 := (spy * W + clampi(spx - o2, 0, W - 1)) * 4
                gr = float(ground[gi]) / 255.0
                gg = float(ground[(spy * W + spx) * 4 + 1]) / 255.0
                gb = float(ground[gi2 + 2]) / 255.0
                gi = (qy * W + clampi(qx + o2, 0, W - 1)) * 4
                gi2 = (qy * W + clampi(qx - o2, 0, W - 1)) * 4
                lr = light[gi]
                lg = light[qi + 1]
                lb = light[gi2 + 2]
            else:
                var gi3 := (spy * W + spx) * 4
                gr = float(ground[gi3]) / 255.0
                gg = float(ground[gi3 + 1]) / 255.0
                gb = float(ground[gi3 + 2]) / 255.0
                lr = light[qi]
                lg = light[qi + 1]
                lb = light[qi + 2]
            gr *= d2
            gg *= d2
            gb *= d2
            var lum := gr * 0.3 + gg * 0.55 + gb * 0.15
            gr = lerpf(gr, lum * 0.85, desat)
            gg = lerpf(gg, lum * 0.95, desat)
            gb = lerpf(gb, lum * 1.15, desat)
            var ia := ink[qi + 3]
            var cr := gr * (1.0 - ia) + ink[qi]
            var cg := gg * (1.0 - ia) + ink[qi + 1]
            var cb := gb * (1.0 - ia) + ink[qi + 2]
            var th := CMath.bayer(qx, qy) - 0.5
            var lqr: float = floor(lr * 8.0 + th + 0.5) / 8.0
            var lqg: float = floor(lg * 8.0 + th + 0.5) / 8.0
            var lqb: float = floor(lb * 8.0 + th + 0.5) / 8.0
            cr += lqr
            cg += lqg
            cb += lqb
            var ovr := maxf(cr - 1.0, 0.0)
            var ovg := maxf(cg - 1.0, 0.0)
            var ovb := maxf(cb - 1.0, 0.0)
            var ov := (ovr + ovg + ovb) * 0.45
            cr += ov
            cg += ov
            cb += ov
            cr = CMath.cl01(cr)
            cg = CMath.cl01(cg)
            cb = CMath.cl01(cb)
            if invert != 0.0:
                var ir := 1.0 - cg
                var ig := 1.0 - cb
                var ib := 1.0 - cr
                cr = lerpf(cr, ir, invert)
                cg = lerpf(cg, ig, invert)
                cb = lerpf(cb, ib, invert)
            cr = CMath.cl01(cr + flash.x)
            cg = CMath.cl01(cg + flash.y)
            cb = CMath.cl01(cb + flash.z)
            var o := (fy * W + fx) * 4
            out[o] = int(cr * 255.0)
            out[o + 1] = int(cg * 255.0)
            out[o + 2] = int(cb * 255.0)
            out[o + 3] = 255 if (out[o] != 0 or out[o + 1] != 0 or out[o + 2] != 0) else 0
    return out

## Experimental world-transport passes. Unlike composite(), neither pass
## contains floor, screen flash, invert, shake or displacement. Ink already
## carries source coverage in ink.a (premultiplied RGB); light is additive
## and therefore uses an opaque black neutral element, never RGB keying.
## This is NOT a parity replacement for the original post compositor: real
## scene displacement, screen effects and occlusion still need integration.
func native_passes() -> Dictionary:
    var ink_bytes := PackedByteArray()
    var light_bytes := PackedByteArray()
    ink_bytes.resize(N * 4)
    light_bytes.resize(N * 4)
    for y in range(H):
        for x in range(W):
            var i := (y * W + x) * 4
            var a := clampf(ink[i + 3], 0.0, 1.0)
            if a > 0.0:
                ink_bytes[i] = int(clampf(ink[i] / a, 0.0, 1.0) * 255.0)
                ink_bytes[i + 1] = int(clampf(ink[i + 1] / a, 0.0, 1.0) * 255.0)
                ink_bytes[i + 2] = int(clampf(ink[i + 2] / a, 0.0, 1.0) * 255.0)
            ink_bytes[i + 3] = int(a * 255.0)
            var th := CMath.bayer(x, y) - 0.5
            for channel in range(3):
                var q: float = floor(light[i + channel] * 8.0 + th + 0.5) / 8.0
                light_bytes[i + channel] = int(clampf(q, 0.0, 1.0) * 255.0)
            # CanvasItemMaterial.BLEND_MODE_ADD: black contributes nothing.
            light_bytes[i + 3] = 255
    return {"ink": ink_bytes, "light": light_bytes}
