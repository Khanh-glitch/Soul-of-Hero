## Experimental CPU raster for the original D RibbonBatch triangle strip.
## It reproduces the source vertex construction and interpolated fragment
## inputs; GPU float32/derivative/edge/blend rounding remains under test.
## This is not source or live-world visual approval.
extends RefCounted
class_name DRibbonTriangles

static func _edge(a: Vector2, b: Vector2, p: Vector2) -> float:
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

static func _top_left(a: Vector2, b: Vector2) -> bool:
    return b.y < a.y or (b.y == a.y and b.x > a.x)

static func _color_at(col: Variant, i: int) -> Color:
    if col is Array:
        var colors: Array = col
        return colors[mini(i, colors.size() - 1)]
    return col

static func _width_at(width: Variant, i: int) -> float:
    if width is Array:
        var widths: Array = width
        return float(widths[mini(i, widths.size() - 1)])
    return float(width)

static func render(fx: Variant, pts: Array, width: Variant, col: Variant, opts: Dictionary = {}) -> void:
    var count := int(pts.size() / 2)
    if count < 2: return
    var vertices: Array[Dictionary] = []
    var along := 0.0
    var alpha_mul := float(opts.get("alpha", 1.0))
    for i in range(count):
        var px := float(pts[i * 2])
        var py := float(pts[i * 2 + 1])
        if i > 0:
            var dx := px - float(pts[(i - 1) * 2])
            var dy := py - float(pts[(i - 1) * 2 + 1])
            along += sqrt(dx * dx + dy * dy)
        var prev := maxi(0, i - 1)
        var next := mini(count - 1, i + 1)
        var dx := float(pts[next * 2]) - float(pts[prev * 2])
        var dy := float(pts[next * 2 + 1]) - float(pts[prev * 2 + 1])
        var length := sqrt(dx * dx + dy * dy)
        if length == 0.0: length = 1.0
        var w := maxf(0.02, _width_at(width, i))
        var color := _color_at(col, i)
        color.a *= alpha_mul
        for side in [-1.0, 1.0]:
            # Vector2, Color and PackedFloat32Array match the source's VBO
            # attribute storage; source direction math is evaluated first.
            var pos := Vector2(px - dy / length * w * side, py + dx / length * w * side)
            var packed := PackedFloat32Array([along])
            vertices.append({"pos": pos, "across": float(side), "along": float(packed[0]), "color": color})
    for i in range(vertices.size() - 2):
        _draw_triangle(fx, vertices[i], vertices[i + 1], vertices[i + 2], opts)

static func _draw_triangle(fx: Variant, v0: Dictionary, v1: Dictionary, v2: Dictionary, opts: Dictionary) -> void:
    var a: Vector2 = v0.pos
    var b: Vector2 = v1.pos
    var c: Vector2 = v2.pos
    var area := _edge(a, b, c)
    if absf(area) < 1.0e-8: return
    if area < 0.0:
        var tmp := v1
        v1 = v2
        v2 = tmp
        b = v1.pos
        c = v2.pos
        area = -area
    var xmin := maxi(0, floori(minf(a.x, minf(b.x, c.x))))
    var xmax := mini(479, ceili(maxf(a.x, maxf(b.x, c.x))))
    var ymin := maxi(0, floori(minf(a.y, minf(b.y, c.y))))
    var ymax := mini(269, ceili(maxf(a.y, maxf(b.y, c.y))))
    var hard := float(opts.get("hard", 0.8))
    var glow := float(opts.get("glow", 0.0))
    var flow := float(opts.get("flow", 0.0))
    var flags := float(opts.get("flags", 0.0))
    var seed := float(opts.get("seed", 1.0))
    var s0 := float(v0.across)
    var s1 := float(v1.across)
    var s2 := float(v2.across)
    # Across is affine within a GPU triangle. Derive its one-pixel gradient;
    # fwidth(abs(across)) uses the actual 2x2 helper-quad finite differences.
    var grad_x := ((b.y - c.y) * s0 + (c.y - a.y) * s1 + (a.y - b.y) * s2) / area
    var grad_y := ((c.x - b.x) * s0 + (a.x - c.x) * s1 + (b.x - a.x) * s2) / area
    for y in range(ymin, ymax + 1):
        for x in range(xmin, xmax + 1):
            var p := Vector2(float(x) + 0.5, float(y) + 0.5)
            var e0 := _edge(b, c, p)
            var e1 := _edge(c, a, p)
            var e2 := _edge(a, b, p)
            if e0 < 0.0 or e1 < 0.0 or e2 < 0.0: continue
            if (e0 == 0.0 and not _top_left(b, c)) or (e1 == 0.0 and not _top_left(c, a)) or (e2 == 0.0 and not _top_left(a, b)): continue
            var w0 := e0 / area
            var w1 := e1 / area
            var w2 := e2 / area
            var across := w0 * s0 + w1 * s1 + w2 * s2
            var d := absf(across)
            var even_x := x & 1
            var even_y := y & 1
            var x0 := across - float(even_x) * grad_x
            var y0 := across - float(even_y) * grad_y
            var fw := maxf(absf(absf(x0 + grad_x) - absf(x0)) + absf(absf(y0 + grad_y) - absf(y0)), 0.0001)
            var along := w0 * float(v0.along) + w1 * float(v1.along) + w2 * float(v2.along)
            var alpha := clampf((1.0 - d) / fw / maxf(0.8, hard), 0.0, 1.0)
            var fl := flags
            if fl >= 4.0:
                fl -= 4.0
                alpha *= 0.55 + 0.75 * fx._fbm2(along * 26.0, float(fx.t) * 2.4 - along * 9.0 + seed * 5.0)
            if fl >= 2.0:
                fl -= 2.0
                d += (fx._h11(floorf(along * 46.0) + floorf(float(fx.t) * 22.0) * 0.37) - 0.5) * 0.8
                alpha = maxf(alpha * 0.35, clampf((1.0 - d) / fw / 1.6, 0.0, 1.0))
            if alpha <= 0.003: continue
            var c0: Color = v0.color
            var c1: Color = v1.color
            var c2: Color = v2.color
            var cr := float(c0.r) * w0 + float(c1.r) * w1 + float(c2.r) * w2
            var cg := float(c0.g) * w0 + float(c1.g) * w1 + float(c2.g) * w2
            var cb := float(c0.b) * w0 + float(c1.b) * w1 + float(c2.b) * w2
            var ca := float(c0.a) * w0 + float(c1.a) * w1 + float(c2.a) * w2
            var mult := 0.55 + 0.75 * (1.0 - d * d) + glow * exp(-d * d * 7.0) * 2.4
            cr *= mult
            cg *= mult
            cb *= mult
            if flow > 0.0:
                var phase := fposmod(along * seed * 0.06 - float(fx.t) * flow, 1.0)
                var bump := pow(phase, 6.0)
                cr += bump * (1.2 - d) * 1.5
                cg += 0.97 * bump * (1.2 - d) * 1.5
                cb += 0.9 * bump * (1.2 - d) * 1.5
                alpha = maxf(alpha, bump * (1.0 - d * 0.6))
            fx._add_px(x, y, cr * ca * alpha, cg * ca * alpha, cb * ca * alpha)
