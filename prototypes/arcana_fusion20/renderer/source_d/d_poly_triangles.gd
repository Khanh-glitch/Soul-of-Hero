## Isolated CPU candidate for D PolyBatch's non-void quad path. Actual source
## triangles, interpolation and fragment discard; GPU rounding remains open.
extends RefCounted
class_name DPolyTriangles

static func render(fx: Variant, pts: Array, color: Color, opts: Dictionary = {}) -> void:
    if pts.size() < 8: return
    var positions: Array[Vector2] = []
    var locals: Array[Vector2] = []
    var coords: Array = opts.get("local", [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0])
    if coords.size() < 8: return
    for i in range(4):
        positions.append(Vector2(float(pts[2 * i]), float(pts[2 * i + 1])))
        locals.append(Vector2(float(coords[2 * i]), float(coords[2 * i + 1])))
    _triangle(fx, positions[0], positions[1], positions[2], locals[0], locals[1], locals[2], color, opts)
    _triangle(fx, positions[1], positions[3], positions[2], locals[1], locals[3], locals[2], color, opts)

static func _edge(a: Vector2, b: Vector2, p: Vector2) -> float:
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

static func _top_left(a: Vector2, b: Vector2) -> bool:
    return b.y < a.y or (b.y == a.y and b.x > a.x)

static func _radius(x: float, y: float) -> float:
    return maxf(absf(x), absf(y))

static func _triangle(fx: Variant, a: Vector2, b: Vector2, c: Vector2, l0: Vector2, l1: Vector2, l2: Vector2, color: Color, opts: Dictionary) -> void:
    var area := _edge(a, b, c)
    if absf(area) < 1.0e-8: return
    if area < 0.0:
        var ptmp := b
        b = c
        c = ptmp
        var ltmp := l1
        l1 = l2
        l2 = ltmp
        area = -area
    var gx := Vector2(((b.y - c.y) * l0.x + (c.y - a.y) * l1.x + (a.y - b.y) * l2.x) / area,
        ((b.y - c.y) * l0.y + (c.y - a.y) * l1.y + (a.y - b.y) * l2.y) / area)
    var gy := Vector2(((c.x - b.x) * l0.x + (a.x - c.x) * l1.x + (b.x - a.x) * l2.x) / area,
        ((c.x - b.x) * l0.y + (a.x - c.x) * l1.y + (b.x - a.x) * l2.y) / area)
    var xmin := maxi(0, floori(minf(a.x, minf(b.x, c.x))))
    var xmax := mini(479, ceili(maxf(a.x, maxf(b.x, c.x))))
    var ymin := maxi(0, floori(minf(a.y, minf(b.y, c.y))))
    var ymax := mini(269, ceili(maxf(a.y, maxf(b.y, c.y))))
    var edge := float(opts.get("edge", 0.05))
    var glow := float(opts.get("glow", 0.0))
    var alpha := color.a * float(opts.get("alpha", 1.0))
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
            var lx := l0.x * w0 + l1.x * w1 + l2.x * w2
            var ly := l0.y * w0 + l1.y * w1 + l2.y * w2
            var r := _radius(lx, ly)
            # WebGL's default derivatives are coarse on the tested backend:
            # every pixel in the 2x2 helper quad uses the same x derivative
            # from its framebuffer-even (top-coordinate odd) row and y
            # derivative from its x-even column. Using per-row/column fine
            # derivatives was visibly wrong where max(abs(x),abs(y)) switches
            # axes near a corner. Other GPU backends may choose differently.
            var qx := lx - float(x & 1) * gx.x
            var qy := ly - float(x & 1) * gx.y
            var bottom_x := qx + float(1 - (y & 1)) * gy.x
            var bottom_y := qy + float(1 - (y & 1)) * gy.y
            var top_x := qx - float(y & 1) * gy.x
            var top_y := qy - float(y & 1) * gy.y
            var fw := maxf(absf(_radius(bottom_x + gx.x, bottom_y + gx.y) - _radius(bottom_x, bottom_y)) + absf(_radius(top_x + gy.x, top_y + gy.y) - _radius(top_x, top_y)), 0.0001)
            var dist_px := (1.0 - r) / fw
            var coverage := clampf(dist_px / maxf(0.6, edge), 0.0, 1.0)
            if coverage <= 0.004: continue
            var mult := 1.0 + glow * (1.0 - r * r) * 2.0
            mult += exp(-maxf(0.0, -dist_px) / 2.6) * clampf(edge, 0.0, 1.0) * 1.3
            # The original g target is normalized RGBA8: GL clamps each
            # fragment output before SRC_ALPHA/ONE blending, not just the
            # accumulated scene at the end. Preserve this source transfer.
            var src_alpha := clampf(alpha * coverage, 0.0, 1.0)
            fx._add_px(x, y, clampf(color.r * mult, 0.0, 1.0) * src_alpha,
                clampf(color.g * mult, 0.0, 1.0) * src_alpha,
                clampf(color.b * mult, 0.0, 1.0) * src_alpha)
