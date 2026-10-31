## Faithful GDScript port of original B src/engine/renderer.ts (CPU HDR
## pixel renderer, native 384x216) MINUS buildFloor()/drawActors(): the
## Gold arena floor and Gold actors must never be composited into SOH
## (Venomwright pause lesson). Spell FX, decals (albedo), lights, shade,
## warp and the tone-map/dither/posterise finalize are ported 1:1.
## Transport adaptation (documented): finalize emits alpha=0 where the
## FX buffer is empty so the quad composites over the real SOH world;
## source outputs opaque alpha over its own floor.
extends RefCounted
class_name BRenderer

const W := 384
const H := 216
const N := W * H
const BAYER := [0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0]
const ADD := 0
const SET := 1
const BLEND := 2
const DITHER := 3
const MUL := 4
const SUB := 5

static func bayer(x: int, y: int) -> float:
    return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16.0

var main_buf := PackedFloat32Array()
var alt_buf := PackedFloat32Array()
var tmp_buf := PackedFloat32Array()
var alb := PackedFloat32Array()
var shade := PackedFloat32Array()
var mask := PackedByteArray()
var light_buf := PackedFloat32Array()
# Coverage is kept separately from RGB; it is only enabled for the world-pass
# producer, so the source-reference path and its parity remain unchanged.
var track_world_coverage := false
var ink_coverage := PackedFloat32Array()
var decal_coverage := PackedFloat32Array()
# XY source-pixel offsets, destination -> original scene sample, including
# ordered post warps. This is consumed against the live world, never Gold.
var world_warp := PackedFloat32Array()
var lights: Array = []
var ambient := 0.62
var tint := Vector3(0.85, 0.9, 1.15)
var flash := 0.0
var flash_col := Vector3.ONE
var shake_x := 0.0
var shake_y := 0.0
var tx := 0.0
var ty := 0.0
var ts := 1.0
var caster := Vector2(104, 132)
var target := Vector2(262, 104)
var time := 0.0

func _init() -> void:
    main_buf.resize(N * 3)
    alt_buf.resize(N * 3)
    tmp_buf.resize(N * 3)
    alb.resize(N * 3)
    shade.resize(N)
    mask.resize(N)
    light_buf.resize(N * 3)
    ink_coverage.resize(N)
    decal_coverage.resize(N)
    world_warp.resize(N * 2)

func begin() -> void:
    for i in range(main_buf.size()):
        main_buf[i] = 0.0
    for i in range(alb.size()):
        alb[i] = 0.0
    for i in range(N):
        shade[i] = 1.0
        mask[i] = 0
    if track_world_coverage:
        ink_coverage.fill(0.0)
        decal_coverage.fill(0.0)
        world_warp.fill(0.0)
    lights.clear()
    ambient = 0.62
    tint = Vector3(0.85, 0.9, 1.15)
    flash = 0.0
    flash_col = Vector3.ONE
    shake_x = 0.0
    shake_y = 0.0
    tx = 0.0
    ty = 0.0
    ts = 1.0

func lighting() -> void:
    for i in range(light_buf.size()):
        light_buf[i] = 0.0
    for l in lights:
        var lx: float = l.x
        var ly: float = l.y
        var lr: float = l.r
        var lc: Vector3 = l.c
        var li: float = l.i
        var x0 := maxi(0, floori(lx - lr))
        var x1 := mini(W - 1, ceili(lx + lr))
        var y0 := maxi(0, floori(ly - lr))
        var y1 := mini(H - 1, ceili(ly + lr))
        var ir := 1.0 / lr
        for y in range(y0, y1 + 1):
            var dy := (float(y) - ly) * ir
            for x in range(x0, x1 + 1):
                var dx := (float(x) - lx) * ir
                var d2 := dx * dx + dy * dy
                if d2 >= 1.0:
                    continue
                var f := 1.0 - sqrt(d2)
                f = f * f
                f = floor(f * 6.0 + bayer(x, y)) / 6.0
                if f <= 0.0:
                    continue
                var k := f * li
                var idx := (y * W + x) * 3
                light_buf[idx] += lc.x * k
                light_buf[idx + 1] += lc.y * k
                light_buf[idx + 2] += lc.z * k
    # Native world input replaces the missing demo floor, so retain ground,
    # shade and HDR lighting independently rather than baking albedo onto a
    # black source buffer. Original legacy parity path remains unchanged.
    if track_world_coverage:
        return
    var ar := ambient * tint.x
    var ag := ambient * tint.y
    var ab := ambient * tint.z
    for p in range(N):
        if mask[p]:
            continue
        var i := p * 3
        var s := shade[p]
        main_buf[i] += alb[i] * s * (ar + light_buf[i])
        main_buf[i + 1] += alb[i + 1] * s * (ag + light_buf[i + 1])
        main_buf[i + 2] += alb[i + 2] * s * (ab + light_buf[i + 2])

func finalize() -> PackedByteArray:
    var out := PackedByteArray()
    out.resize(N * 4)
    var sx := roundi(shake_x)
    var sy := roundi(shake_y)
    var fl := flash
    var LV := 20.0
    for y in range(H):
        var yy := mini(H - 1, maxi(0, y - sy))
        for x in range(W):
            var xx := mini(W - 1, maxi(0, x - sx))
            var i := (yy * W + xx) * 3
            var r := main_buf[i] + fl * flash_col.x
            var g := main_buf[i + 1] + fl * flash_col.y
            var b := main_buf[i + 2] + fl * flash_col.z
            var mx := maxf(r, maxf(g, b))
            var ex := (mx - 1.1) * 0.32 if mx > 1.1 else 0.0
            r = 1.0 - exp(-(r + ex) * 1.05)
            g = 1.0 - exp(-(g + ex) * 1.05)
            b = 1.0 - exp(-(b + ex) * 1.05)
            var d := bayer(x, y) - 0.5
            var o := (y * W + x) * 4
            var rb := int(floor(BMath.clampf2(r * LV + d, 0.0, LV)) / LV * 255.0)
            var gb := int(floor(BMath.clampf2(g * LV + d, 0.0, LV)) / LV * 255.0)
            var bb := int(floor(BMath.clampf2(b * LV + d, 0.0, LV)) / LV * 255.0)
            out[o] = rb
            out[o + 1] = gb
            out[o + 2] = bb
            out[o + 3] = 255 if (rb | gb | bb) != 0 else 0
    return out

# ---------------------------------------------------------------- pixel core
func plot(ix: int, iy: int, r: float, g: float, b: float, mode: int, a: float) -> void:
    if ix < 0 or iy < 0 or ix >= W or iy >= H:
        return
    var p := iy * W + ix
    var i := p * 3
    if track_world_coverage:
        match mode:
            SET:
                ink_coverage[p] = 1.0
            BLEND:
                ink_coverage[p] = a + ink_coverage[p] * (1.0 - a)
            DITHER:
                if bayer(ix, iy) < a:
                    ink_coverage[p] = 1.0
            # ADD is emissive and does not erase the real scene; MUL/SUB
            # affect the existing source ink but do not invent coverage.
    match mode:
        ADD:
            main_buf[i] += r * a
            main_buf[i + 1] += g * a
            main_buf[i + 2] += b * a
        SET:
            main_buf[i] = r
            main_buf[i + 1] = g
            main_buf[i + 2] = b
            mask[p] = 1
        BLEND:
            main_buf[i] += (r - main_buf[i]) * a
            main_buf[i + 1] += (g - main_buf[i + 1]) * a
            main_buf[i + 2] += (b - main_buf[i + 2]) * a
        DITHER:
            if bayer(ix, iy) < a:
                main_buf[i] = r
                main_buf[i + 1] = g
                main_buf[i + 2] = b
                mask[p] = 1
        MUL:
            main_buf[i] *= r
            main_buf[i + 1] *= g
            main_buf[i + 2] *= b
        SUB:
            main_buf[i] = maxf(0.0, main_buf[i] - r * a)
            main_buf[i + 1] = maxf(0.0, main_buf[i + 1] - g * a)
            main_buf[i + 2] = maxf(0.0, main_buf[i + 2] - b * a)

func X(x: float) -> float:
    return x * ts + tx

func Y(y: float) -> float:
    return y * ts + ty

func px(x: float, y: float, col: Vector3, inten: float = 1.0, mode: int = ADD) -> void:
    var k := inten if mode == ADD else 1.0
    plot(floori(X(x)), floori(Y(y)), col.x * k, col.y * k, col.z * k, mode, 1.0 if mode == ADD else inten)

func disc(x: float, y: float, rad: float, col: Vector3, inten: float = 1.0, mode: int = ADD, sy: float = 1.0) -> void:
    var cx := X(x)
    var cy := Y(y)
    var R := rad * ts
    if R < 0.5:
        px(x, y, col, inten, mode)
        return
    var Ry := R * sy
    var x0 := floori(cx - R)
    var x1 := ceili(cx + R)
    var y0 := floori(cy - Ry)
    var y1 := ceili(cy + Ry)
    var k := inten if mode == ADD else 1.0
    var a := 1.0 if mode == ADD else inten
    var r := col.x * k
    var g := col.y * k
    var b := col.z * k
    var R2 := R * R
    for yy in range(y0, y1 + 1):
        var dy := (float(yy) + 0.5 - cy) / sy
        for xx in range(x0, x1 + 1):
            var dx := float(xx) + 0.5 - cx
            if dx * dx + dy * dy <= R2:
                plot(xx, yy, r, g, b, mode, a)

func glow(x: float, y: float, rad: float, col: Vector3, inten: float = 1.0, sy: float = 1.0) -> void:
    var cx := X(x)
    var cy := Y(y)
    var R := rad * ts
    if R < 1.0:
        return
    var x0 := floori(cx - R)
    var x1 := ceili(cx + R)
    var y0 := floori(cy - R * sy)
    var y1 := ceili(cy + R * sy)
    var iR := 1.0 / R
    for yy in range(y0, y1 + 1):
        var dy := ((float(yy) + 0.5 - cy) / sy) * iR
        for xx in range(x0, x1 + 1):
            var dx := (float(xx) + 0.5 - cx) * iR
            var d2 := dx * dx + dy * dy
            if d2 >= 1.0:
                continue
            var f := 1.0 - sqrt(d2)
            f *= f * inten
            plot(xx, yy, col.x * f, col.y * f, col.z * f, ADD, 1.0)

func ring(x: float, y: float, rad: float, th: float, col: Vector3, inten: float = 1.0, mode: int = ADD, sy: float = 1.0) -> void:
    var cx := X(x)
    var cy := Y(y)
    var R := rad * ts
    var T := maxf(0.6, th * ts)
    var Ro := R + T / 2.0
    var Ri := maxf(0.0, R - T / 2.0)
    var x0 := floori(cx - Ro)
    var x1 := ceili(cx + Ro)
    var y0 := floori(cy - Ro * sy)
    var y1 := ceili(cy + Ro * sy)
    var k := inten if mode == ADD else 1.0
    var a := 1.0 if mode == ADD else inten
    for yy in range(y0, y1 + 1):
        var dy := (float(yy) + 0.5 - cy) / sy
        for xx in range(x0, x1 + 1):
            var dx := float(xx) + 0.5 - cx
            var d := sqrt(dx * dx + dy * dy)
            if d <= Ro and d >= Ri:
                plot(xx, yy, col.x * k, col.y * k, col.z * k, mode, a)

func line(x0: float, y0: float, x1: float, y1: float, col: Vector3, inten: float = 1.0, mode: int = ADD) -> void:
    var ax := X(x0)
    var ay := Y(y0)
    var bx := X(x1)
    var by := Y(y1)
    var dx := bx - ax
    var dy := by - ay
    var n := maxi(1, ceili(maxf(absf(dx), absf(dy))))
    var k := inten if mode == ADD else 1.0
    var a := 1.0 if mode == ADD else inten
    var r := col.x * k
    var g := col.y * k
    var b := col.z * k
    var lx := -9999
    var ly := -9999
    for s in range(n + 1):
        var ix := floori(ax + (dx * float(s)) / float(n))
        var iy := floori(ay + (dy * float(s)) / float(n))
        if ix == lx and iy == ly:
            continue
        lx = ix
        ly = iy
        plot(ix, iy, r, g, b, mode, a)

func thick(x0: float, y0: float, x1: float, y1: float, w: float, col: Vector3, inten: float = 1.0, mode: int = ADD) -> void:
    if w <= 1.2:
        line(x0, y0, x1, y1, col, inten, mode)
        return
    var dx := x1 - x0
    var dy := y1 - y0
    var L := sqrt(dx * dx + dy * dy)
    if L == 0.0:
        L = 1.0
    var nx := (-dy / L) * w * 0.5
    var ny := (dx / L) * w * 0.5
    poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], col, inten, mode)

func polyline(pts: Array, col: Vector3, inten: float = 1.0, mode: int = ADD, closed: bool = false) -> void:
    for k in range(0, pts.size() - 3, 2):
        line(float(pts[k]), float(pts[k + 1]), float(pts[k + 2]), float(pts[k + 3]), col, inten, mode)
    if closed and pts.size() >= 6:
        line(float(pts[pts.size() - 2]), float(pts[pts.size() - 1]), float(pts[0]), float(pts[1]), col, inten, mode)

func poly(pts: Array, col: Vector3, inten: float = 1.0, mode: int = ADD) -> void:
    var n := pts.size() >> 1
    if n < 3:
        return
    var P := PackedFloat32Array()
    P.resize(pts.size())
    var min_y := 1e9
    var max_y := -1e9
    for k in range(n):
        P[k * 2] = X(float(pts[k * 2]))
        P[k * 2 + 1] = Y(float(pts[k * 2 + 1]))
        min_y = minf(min_y, P[k * 2 + 1])
        max_y = maxf(max_y, P[k * 2 + 1])
    var y0 := maxi(0, floori(min_y))
    var y1 := mini(H - 1, ceili(max_y))
    var k2 := inten if mode == ADD else 1.0
    var a := 1.0 if mode == ADD else inten
    var r := col.x * k2
    var g := col.y * k2
    var b := col.z * k2
    var xs: Array = []
    for y in range(y0, y1 + 1):
        var sy := float(y) + 0.5
        xs.clear()
        var j := n - 1
        for k in range(n):
            var yi := P[k * 2 + 1]
            var yj := P[j * 2 + 1]
            if (yi > sy) != (yj > sy):
                xs.append(P[k * 2] + ((sy - yi) / (yj - yi)) * (P[j * 2] - P[k * 2]))
            j = k
        xs.sort()
        for q in range(0, xs.size() - 1, 2):
            var xa := maxi(0, roundi(float(xs[q])))
            var xb := mini(W - 1, roundi(float(xs[q + 1])) - 1)
            for x in range(xa, xb + 1):
                plot(x, y, r, g, b, mode, a)

func light(x: float, y: float, rad: float, col: Vector3, inten: float = 1.0) -> void:
    if inten <= 0.001 or rad < 2.0:
        return
    lights.append({"x": X(x), "y": Y(y), "r": rad * ts, "c": col, "i": inten})

func shadow(x: float, y: float, rx: float, ry: float, amt: float) -> void:
    var x0 := floori(x - rx)
    var x1 := ceili(x + rx)
    var y0 := floori(y - ry)
    var y1 := ceili(y + ry)
    for yy in range(maxi(0, y0), mini(H - 1, y1) + 1):
        var dy := (float(yy) + 0.5 - y) / ry
        for xx in range(maxi(0, x0), mini(W - 1, x1) + 1):
            var dx := (float(xx) + 0.5 - x) / rx
            var d := dx * dx + dy * dy
            if d >= 1.0:
                continue
            var f := (1.0 - d) * amt
            if bayer(xx, yy) < f * 1.6:
                shade[yy * W + xx] *= 1.0 - minf(0.85, f)

func decal(x: float, y: float, col: Vector3, a: float = 1.0) -> void:
    var ix := floori(x)
    var iy := floori(y)
    if ix < 0 or iy < 0 or ix >= W or iy >= H:
        return
    var i := (iy * W + ix) * 3
    if track_world_coverage:
        var p := iy * W + ix
        decal_coverage[p] = a + decal_coverage[p] * (1.0 - a)
    alb[i] += (col.x - alb[i]) * a
    alb[i + 1] += (col.y - alb[i + 1]) * a
    alb[i + 2] += (col.z - alb[i + 2]) * a

func decal_disc(x: float, y: float, rad: float, col: Vector3, a: float = 1.0, jag: float = 0.0) -> void:
    for yy in range(floori(y - rad), int(y + rad) + 1):
        for xx in range(floori(x - rad), int(x + rad) + 1):
            var d := Vector2(float(xx) + 0.5 - x, float(yy) + 0.5 - y).length() / rad
            var lim := 1.0 - jag * BMath.hash2(floor(atan2(float(yy) - y, float(xx) - x) * 6.0), 3.3)
            if d < lim:
                decal(float(xx), float(yy), col, a * (1.0 if d < lim * 0.7 else (1.0 if bayer(xx, yy) < 0.5 else 0.5)))

func decal_line(x0: float, y0: float, x1: float, y1: float, col: Vector3, a: float = 1.0) -> void:
    var n := maxi(1, ceili(maxf(absf(x1 - x0), absf(y1 - y0))))
    for s in range(n + 1):
        decal(x0 + ((x1 - x0) * float(s)) / float(n), y0 + ((y1 - y0) * float(s)) / float(n), col, a)

func warp(x0: float, y0: float, x1: float, y1: float, fn: Callable) -> void:
    x0 = maxf(0.0, floor(x0))
    y0 = maxf(0.0, floor(y0))
    x1 = minf(float(W - 1), ceil(x1))
    y1 = minf(float(H - 1), ceil(y1))
    tmp_buf = main_buf.duplicate()
    var previous_coverage := ink_coverage.duplicate() if track_world_coverage else PackedFloat32Array()
    var previous_warp := world_warp.duplicate() if track_world_coverage else PackedFloat32Array()
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            var o: Array = fn.call(x, y)
            var sx := floori(float(o[0]))
            var sy := floori(float(o[1]))
            if sx == x and sy == y:
                continue
            sx = 0 if sx < 0 else (W - 1 if sx >= W else sx)
            sy = 0 if sy < 0 else (H - 1 if sy >= H else sy)
            var i := (y * W + x) * 3
            var j := (sy * W + sx) * 3
            main_buf[i] = tmp_buf[j]
            main_buf[i + 1] = tmp_buf[j + 1]
            main_buf[i + 2] = tmp_buf[j + 2]
            if track_world_coverage:
                ink_coverage[y * W + x] = previous_coverage[sy * W + sx]
                var wi := (y * W + x) * 2
                var wj := (sy * W + sx) * 2
                world_warp[wi] = float(sx - x) + previous_warp[wj]
                world_warp[wi + 1] = float(sy - y) + previous_warp[wj + 1]
