## Selected #20 source-level candidate: C's seeded 9-point rift contour,
## timing/width/interior/edge, plus A Reality Ripper's bgWarp pull/fracture
## applied to the SAME real-world pixels relative to that C contour.
## Original C blocks/particles and A debris are not yet selected;
## full cast, source comparisons, actor depth and owner approval remain open.
extends RefCounted
class_name CRealityRipperFusion

const DURATION := 10.4
const CENTER := Vector2(210, 116)
const TOPEN := 3.0
const TCOL := 6.6
const W := CFrame.W
const H := CFrame.H
const MAG := Vector3(1.0, 0.35, 0.85)
const CYAN := Vector3(0.45, 0.95, 1.0)
const GOLDW := Vector3(1.0, 0.9, 0.6)
const POLYS := [
    {"v": [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
     "e": [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]},
    {"v": [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
     "e": [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]]},
    {"v": [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]],
     "e": [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]},
]
# These flags isolate component source tests; production candidate keeps polygons.
var include_polygons := true
var audit_polygons_only := false
# The original C uses Array.sort(() => rng.next() - 0.5). This is the
# reproducible V8 order for source seed 151461 after seven waypoint draws;
# its random comparator is engine-dependent and must not be re-sorted here.
const PERM := [10, 7, 11, 5, 0, 6, 3, 1, 8, 4, 2, 9]
var fx_shake := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0
var fx_kick := 0.0
var way: Array = []
var cum: Array[float] = []
var path_len := 0.0
var ts := PackedFloat32Array()
var td := PackedFloat32Array()
var tnx := PackedFloat32Array()
var tny := PackedFloat32Array()
var ttx := PackedFloat32Array()
var tty := PackedFloat32Array()
var collided := false

func setup() -> void:
    CPalette._ensure()
    var rng := CMath.CRng.new(151461)
    way.clear()
    cum.clear()
    for i in range(9):
        var u := float(i) / 8.0
        var y := lerpf(62.0, 172.0, u)
        if i != 0 and i != 8: y += rng.r(-11.0, 11.0)
        way.append({"x": lerpf(86.0, 334.0, u), "y": y})
    cum.append(0.0)
    for i in range(1, way.size()):
        var dx := float(way[i].x) - float(way[i - 1].x)
        var dy := float(way[i].y) - float(way[i - 1].y)
        cum.append(cum[i - 1] + sqrt(dx * dx + dy * dy))
    path_len = cum[-1]
    var n := W * H
    ts.resize(n); td.resize(n); tnx.resize(n); tny.resize(n); ttx.resize(n); tty.resize(n)
    ts.fill(-1.0)
    for y in range(16, 215):
        for x in range(40, 381):
            var best := 1.0e9
            var bs := 0.0
            var bd := 0.0
            var bnx := 0.0
            var bny := 0.0
            var btx := 0.0
            var bty := 0.0
            for i in range(8):
                var a: Dictionary = way[i]
                var b: Dictionary = way[i + 1]
                var dx := float(b.x) - float(a.x)
                var dy := float(b.y) - float(a.y)
                var l2 := dx * dx + dy * dy
                var length := sqrt(l2)
                var px := float(x) + 0.5 - float(a.x)
                var py := float(y) + 0.5 - float(a.y)
                var u := clampf((px * dx + py * dy) / l2, 0.0, 1.0)
                var qx := px - dx * u
                var qy := py - dy * u
                var d := sqrt(qx * qx + qy * qy)
                if d < best:
                    best = d
                    bs = (cum[i] + u * length) / path_len
                    var side := 1.0 if dx * py - dy * px >= 0.0 else -1.0
                    bd = d * side
                    bnx = -dy / length * side
                    bny = dx / length * side
                    btx = dx / length
                    bty = dy / length
            if best < 46.0:
                var k := y * W + x
                ts[k] = bs; td[k] = bd; tnx[k] = bnx; tny[k] = bny; ttx[k] = btx; tty[k] = bty
    collided = false
    fx_shake = 0.0
    fx_flash_k = 0.0
    fx_kick = 0.0

func authored_events() -> Array:
    return [{"t": TOPEN, "kind": "rift_open", "pos_local": CENTER, "emitted": false},
        {"t": TCOL, "kind": "rift_collision_impact", "pos_local": CENTER, "emitted": false},
        {"t": 7.15, "kind": "rift_stitch", "pos_local": CENTER, "emitted": false}]

func update(_dt: float, t: float) -> void:
    if not collided and t >= TCOL:
        collided = true
        fx_shake = 10.0
        fx_flash = Vector3(1.0, 0.5, 1.0)
        fx_flash_k = 0.35
        fx_kick = 6.0

func _width(s: float, t: float) -> float:
    if t < TOPEN: return 0.0
    var width := 22.0 * CMath.ease_out(CMath.inv(TOPEN, 6.0, t), 2.0) * pow(sin(PI * s), 0.7) * (1.0 + 0.35 * (CMath.noise3(s * 8.0, t * 0.6, 1.0) - 0.5))
    if t > 6.35 and t < TCOL: width *= 1.0 + 0.6 * CMath.inv(6.35, TCOL, t)
    var k := mini(11, floori(s * 12.0))
    var close_time := 7.15 + PERM.find(k) * 0.16
    return width * (1.0 - CMath.ease_in(CMath.inv(close_time, close_time + 0.22, t), 2.0))

# Align A's 1.0 open, 5.3 collide, 6.1 close phases to C's 3.0,
# 6.6 and 7.15 while preserving A's bgWarp formulas between beats.
func _a_time(t: float) -> float:
    if t < TOPEN: return 0.35 + CMath.inv(1.6, TOPEN, t) * 0.65
    if t < TCOL: return 1.0 + (t - TOPEN) * 4.3 / 3.6
    return 5.3 + (t - TCOL) * 0.8 / 0.55

func render(f: CFrame, t: float) -> void:
    if t >= TCOL and t < TCOL + 0.05: f.invert = 1.0
    # Source C's early rendering glitches affect the actual world fields.
    var early_slot := floori(t * 20.0)
    if t > 0.3 and t < 0.45:
        for x in range(130, 230):
            f.D(x, 92, 3.0, 0.0)
            f.D(x, 93, 3.0, 0.0)
    if t > 0.6 and t < 0.9:
        var x := 180.0 + t * 20.0
        var y := 120.0 - t * 6.0
        f.Lc(x, y, Vector3(0.5, 0.45, 0.6), 1.0)
        f.Lc(x + 5.0, y, Vector3(0.5, 0.45, 0.6), 1.0)
    if t > 0.95 and t < 1.2:
        for y in range(120, 129):
            for x in range(232, 247):
                f.D(x, y, (CMath.hash1(early_slot) - 0.5) * 6.0, (CMath.hash1(early_slot + 1) - 0.5) * 3.0)
                f.C(x, y, 2.0)
    if t > 1.2 and t < 1.6:
        for k in range(24):
            var p := _at(0.4 + CMath.hash1(k * 7) * 0.2)
            var light := 0.8 if CMath.hash1(k + early_slot * 3) > 0.5 else -0.3
            f.L(float(p.x), float(p.y), light, light, 0.9 if light > 0.0 else -0.3)
    if t < 1.6 or t >= 9.4: return
    var span := CMath.inv(1.6, TOPEN, t)
    var slot := floori(t * 12.0)
    var mask := PackedByteArray()
    mask.resize(W * H)
    var widths := PackedFloat32Array()
    widths.resize(257)
    for i in range(257): widths[i] = _width(float(i) / 256.0, t)
    var at := _a_time(t)
    var pull := AMath.smoothstep(1.2, 5.3, at) * (1.0 - AMath.seg(at, 6.1, 8.3) if at > 6.1 else 1.0)
    for y in range(16, 215):
        for x in range(40, 381):
            var k := y * W + x
            var s := float(ts[k])
            if s < 0.0 or absf(s - 0.5) > span * 0.5: continue
            var d := float(td[k])
            var ad := absf(d)
            var width := float(widths[roundi(s * 256.0)])
            if t < TOPEN:
                if ad < 0.8: f.L(x, y, 1.6, 1.6, 1.8)
                elif ad < 3.0: f.C(x, y, 2.0)
                continue
            var wj := width + ((CMath.hash3(x, y, slot) - 0.5) * 3.2 if width > 1.0 else 0.0)
            if ad < wj:
                mask[k] = 1
                var gy := (float(y) - 60.0) / 150.0
                var color := CPalette.ramp_d(CPalette.P.void, 0.12 + gy * 0.2, CMath.bayer(x, y))
                var n := CMath.noise3(x * 0.05, y * 0.05, t * 0.25)
                if n > 0.62:
                    f.inverted_live_fragment(x, y, 420.0 - x + sin(t * 0.7) * 10.0, 232.0 - y)
                else:
                    f.Ic(x, y, color, 1.0)
                if CMath.hash2(floori(x - t * 10.0), y) > 0.985: f.Lc(x, y, CPalette.ramp(CPalette.P.star, 0.8), 0.7)
                if CMath.hash2(floori((x + t * 26.0) / 2.0), floori((y + t * 6.0) / 2.0)) > 0.965: f.Lc(x, y, Vector3.ONE, 1.0)
                if fposmod(x * 0.7 + y * 0.3 + t * 22.0, 37.0) < 1.0: f.Lc(x, y, CYAN, 0.35)
                f.L(x, y, 0.02, 0.0, 0.05)
                continue
            if ad < wj + 1.6 and width > 0.5:
                var edge := MAG if CMath.hash3(x, y, slot + 5) > 0.5 else CYAN
                f.Ic(x, y, edge, 1.0)
                f.Lc(x, y, edge, 1.0)
                continue
            if width > 1.0 and ad < 44.0:
                # Original A bgWarp pull, stretch, folded-back strips and edge
                # glow evaluated against C's nearest point/selected opening.
                var band := floori(float(y) / 3.0)
                var bh := AMath.hash2(band, 77)
                var nearest_x := float(x) + 0.5 - float(tnx[k]) * ad
                var dir_x := -1.0 if float(x) < nearest_x else 1.0
                var distance := ad - width
                var shift := float(int(pull * 46.0 * exp(-distance / 34.0)))
                if bh > 0.78: shift = round(shift * (1.0 + bh))
                var sx := float(x) - dir_x * shift
                var sy := float(y)
                if bh > 0.93 and distance < 40.0 and pull > 0.4:
                    sx = nearest_x + (nearest_x - float(x)) * 1.1
                    sy += round((bh - 0.93) * 120.0)
                f.D(x, y, sx - float(x), sy - float(y))
                f.S(x, y, 1.0 + 1.6 * exp(-distance / 3.0))
                if CMath.hash1(floori(s * 48.0) + 31) > 0.9: f.C(x, y, 1.5)

    if audit_polygons_only:
        f.clear()
    if include_polygons:
        _render_polygons(f, t, mask)

# Original source "at(s)" keeps scalar double precision until rasterization.
func _at(s: float) -> Dictionary:
    var length := s * path_len
    var i := 0
    while i < cum.size() - 2 and cum[i + 1] < length: i += 1
    var u := (length - cum[i]) / (cum[i + 1] - cum[i])
    var a: Dictionary = way[i]
    var b: Dictionary = way[i + 1]
    var d := cum[i + 1] - cum[i]
    return {"x": lerpf(float(a.x), float(b.x), u), "y": lerpf(float(a.y), float(b.y), u),
        "nx": -(float(b.y) - float(a.y)) / d, "ny": (float(b.x) - float(a.x)) / d}

func _project(v: Array, ax: float, ay: float, scale: float) -> Dictionary:
    var x := float(v[0]); var y := float(v[1]); var z := float(v[2])
    var c := cos(ay); var si := sin(ay)
    var next_x := x * c + z * si
    z = -x * si + z * c
    x = next_x
    c = cos(ax); si = sin(ax)
    y = y * c - z * si
    return {"x": x * scale, "y": y * scale}

func _render_polygons(f: CFrame, t: float, mask: PackedByteArray) -> void:
    for i in range(POLYS.size()):
        var poly: Dictionary = POLYS[i]
        var s := fposmod(0.2 + i * 0.27 + t * 0.035, 0.8) + 0.1
        var p := _at(s)
        var ex := clampf((t - TCOL) / 0.7, 0.0, 1.0) if t >= TCOL else 0.0
        var scale := (6.0 + i * 1.5) * (1.0 + ex * 4.0)
        var cx := float(p.x) + float(p.nx) * (i - 1) * 6.0
        var cy := float(p.y) + float(p.ny) * (i - 1) * 6.0
        var vertices: Array = []
        for v in poly.v: vertices.append(_project(v, t * (0.7 + i * 0.3), t * (1.1 - i * 0.2), scale))
        for edge in poly.e:
            var va: Dictionary = vertices[int(edge[0])]
            var vb: Dictionary = vertices[int(edge[1])]
            f.line(cx + float(va.x), cy + float(va.y), cx + float(vb.x), cy + float(vb.y), func(x: int, y: int, _s: float) -> void:
                var inside := x >= 0 and y >= 0 and x < W and y < H and mask[y * W + x] == 1
                if not inside and ex == 0.0: return
                f.Lc(x, y, MAG if i == 1 else CYAN, 1.2 * (1.0 - ex) if ex > 0.0 else 1.0))
        if t > 3.8 and t < 6.4 and i == 0:
            var sp := 0.15 + (t - 3.8) * 0.12
            var q := _at(sp)
            var q2 := _at(1.0 - sp)
            f.ring(float(q.x), float(q.y), 3.0, func(x: int, y: int, _a: float) -> void:
                if x >= 0 and y >= 0 and x < W and y < H and mask[y * W + x] == 1: f.Lc(x, y, GOLDW, 1.2))
            var out := 8.0 + (t - 3.8) * 6.0
            f.ring_l(float(q2.x) + float(q2.nx) * (_width(1.0 - sp, t) + out), float(q2.y) + float(q2.ny) * (_width(1.0 - sp, t) + out), 3.0, GOLDW, 1.2)
