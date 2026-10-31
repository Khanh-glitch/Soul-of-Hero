## CPU translation of original D engine (Elemental_VFX_Lab_FIXED_
## Standalone.html: batches.ts SPRITE/RIBBON/POLY fragment shaders +
## fx.ts additive layer set + renderer.ts COMP post), 480x270.
## Only the additive `g` layer set is rasterised (sp/line/poly + pool);
## floor, markers (caster/anchors), decal and warp layers are world /
## presentation in the original and are EXCLUDED here by the
## anti-compositing rule (bend() therefore has no buffer effect, as in
## the original it only displaces the floor sampling).
## WebGL->CPU translation differences (documented, unavoidable):
##  - fwidth() derivatives are approximated analytically from the
##    authored half-width in pixels.
##  - Bloom (bright/blur pyramid in COMP) is not reproduced in the
##    buffer path; ACES + saturation + dithered posterise (26 levels)
##    + flash + vignette + scanline from COMP are reproduced.
##  - Legacy zero-base preview is an explicit additive pass, never an RGB key.
##    Alpha is opaque everywhere, not source geometry coverage.
extends RefCounted
class_name DFx

const W := 480
const H := 270
const N := W * H

const DISC := 0
const SOFT := 1
const RING := 2
const STAR := 4
const FLARE := 13
const FLAKE := 18

var buf := PackedFloat32Array()
var track_world_fields := false
var world_influence := PackedByteArray()
var world_bends: Array[Dictionary] = []
var world_warp := PackedFloat32Array()
var world_warp_influence := PackedByteArray()
var _warp_has_history := false
var t := 0.0
var flash_amt := 0.0
var flash_col := Vector3.ONE
var shake := 0.0
var bloom_gain := 1.0
var warp_amt := 1.0
var decal_fade := 0.14
var rng: BMath.BRng

var _pool: Array = []

## D's RNG is raw-seeded mulberry32. B's BRng shares the mixing
## algorithm but its constructor hashes the seed for B's sources; undo that
## constructor policy rather than changing B's parity-critical generator.
static func source_rng(seed: int) -> BMath.BRng:
    var result := BMath.BRng.new(1)
    result.s = seed & 0xFFFFFFFF
    return result

func _init() -> void:
    buf.resize(N * 3)
    world_influence.resize(N)
    world_warp.resize(N * 4)
    world_warp_influence.resize(N)
    rng = source_rng(1337)

func clear() -> void:
    buf.fill(0.0)
    if track_world_fields:
        world_influence.fill(0)
        world_bends.clear()
        # Original D renderer ping-pongs warp with exp(-3.4*dt) decay.
        if _warp_has_history:
            var decay := exp(-3.4 / 60.0)
            for i in range(world_warp.size()): world_warp[i] *= decay
    flash_amt = 0.0
    shake = 0.0
    bloom_gain = 1.0
    warp_amt = 1.0
    decal_fade = 0.14

func flash(a: float, col := Vector3.ONE) -> void:
    if a > flash_amt:
        flash_amt = a
        flash_col = col

func kick(p: float) -> void:
    shake = maxf(shake, p)

func bend(x: float, y: float, size: float, ox: float, oy: float, absorb: float = 0.0, chroma: float = 0.0) -> void:
    # Preserve the authored call for a world-field implementation; no fake
    # floor or assumed bend raster. The old source-reference path remains a
    # no-op until the actual original D warp batch is ported and validated.
    if track_world_fields:
        world_bends.append({"x": x, "y": y, "size": size, "ox": ox, "oy": oy, "absorb": absorb, "chroma": chroma})
        if size <= 0.0:
            return
        _warp_has_history = true
        var x0 := maxi(0, floori(x - size))
        var x1 := mini(W - 1, ceili(x + size))
        var y0 := maxi(0, floori(y - size))
        var y1 := mini(H - 1, ceili(y + size))
        for py in range(y0, y1 + 1):
            for px in range(x0, x1 + 1):
                var dx := (float(px) + 0.5 - x) / size
                var dy := (float(py) + 0.5 - y) / size
                var falloff := 1.0 - dx * dx - dy * dy
                if falloff <= 0.0:
                    continue
                falloff *= falloff
                var at := py * W + px
                world_warp[at * 4] += ox * falloff
                world_warp[at * 4 + 1] += oy * falloff
                world_warp[at * 4 + 2] += absorb * falloff
                world_warp[at * 4 + 3] += chroma * falloff
                world_warp_influence[at] = 1

static func _h11(n: float) -> float:
    var s := sin(n * 127.1) * 43758.5453
    return s - floor(s)

static func _h21(px: float, py: float) -> float:
    var s := sin(px * 127.1 + py * 311.7) * 43758.5453
    return s - floor(s)

static func _vnoise(px: float, py: float) -> float:
    var ix: float = floor(px)
    var iy: float = floor(py)
    var fx := px - ix
    var fy := py - iy
    fx = fx * fx * (3.0 - 2.0 * fx)
    fy = fy * fy * (3.0 - 2.0 * fy)
    var a := _h21(ix, iy)
    var b := _h21(ix + 1.0, iy)
    var c := _h21(ix, iy + 1.0)
    var d := _h21(ix + 1.0, iy + 1.0)
    return lerpf(lerpf(a, b, fx), lerpf(c, d, fx), fy)

static func _fbm(px: float, py: float, oct: int = 4) -> float:
    var s := 0.0
    var a := 0.5
    var f := 1.0
    for i in range(oct):
        s += a * _vnoise(px * f, py * f)
        f *= 2.03
        a *= 0.5
    return s

static func _aa(d: float, hard: float) -> float:
    # 1 - smoothstep(-hard*0.5, hard*0.9, d)
    var x := clampf((d + hard * 0.5) / (hard * 1.4), 0.0, 1.0)
    return 1.0 - (x * x * (3.0 - 2.0 * x))

static func _ngon_r(th: float, n: float, r: float) -> float:
    return r * cos(PI / n) / cos(fmod(th, 2.0 * PI / n) - PI / n)

static func _radial(th: float, seed: float, a1: float, h1: float, a2: float, h2: float, spike: float, sharp: float) -> float:
    var p1 := _h11(seed) * 6.283
    var p2 := _h11(seed + 3.7) * 6.283
    var r := 1.0 + a1 * cos(h1 * th + p1) + a2 * cos(h2 * th + p2)
    r += spike * pow(maxf(0.0, cos(sharp * th + p1 * 2.0)), 6.0)
    return r

## Returns [alpha, rim].
static func shape_alpha(id: int, p: Vector2, seed: float, hard: float) -> Array:
    var rim := 0.0
    var r := p.length()
    var th := atan2(p.y, p.x)
    var d := 0.0
    var a := 0.0
    match id:
        DISC:
            d = r - 1.0
            a = _aa(d, hard)
        SOFT:
            a = exp(-r * r * 3.2)
            d = r - 1.0
        RING:
            var w := 0.14 + 0.3 * _h11(seed)
            d = maxf(absf(r - (1.0 - w * 0.5)) - w * 0.5, 0.0)
            a = _aa(d, hard)
        STAR:
            var pr := _radial(th, seed, 0.10, 2.0, 0.05, 4.0, 1.5, 4.0)
            d = r - pr
            a = _aa(d, hard)
        FLARE:
            var a4 := absf(fmod(th + PI, PI * 0.5) - PI * 0.25)
            var pr := 1.0 / (1.0 + 12.0 * a4 * a4)
            d = r - lerpf(pr, 1.0, 0.12)
            a = _aa(d, hard * 0.9)
        FLAKE:
            var arms := 0.0
            for i in range(3):
                var an := PI * float(i) / 3.0
                var q := Vector2(p.x * cos(an) - p.y * sin(an), p.x * sin(an) + p.y * cos(an))
                arms = maxf(arms, 1.0 - (Vector2(q.x * 6.0, q.y * 0.9).length() - 0.85))
            a = clampf(arms, 0.0, 1.0)
            var x := clampf((a - 0.1) / 0.6, 0.0, 1.0)
            a = x * x * (3.0 - 2.0 * x)
            d = 0.0
        _:
            d = r - 1.0
            a = _aa(d, hard)
    rim = exp(-absf(d) * 3.4) * (1.0 if d >= 0.0 else 0.0)
    return [a, rim]

func _add_px(x: int, y: int, r: float, g: float, b: float) -> void:
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    var i := (y * W + x) * 3
    if track_world_fields:
        world_influence[y * W + x] = 1
    buf[i] += r
    buf[i + 1] += g
    buf[i + 2] += b

## fx.sp — additive sprite (SpriteBatch + SPRITE_FS).
func sp(x: float, y: float, size: float, col: Color, shape: int = DISC, o: Dictionary = {}) -> void:
    var cx := roundi(x)
    var cy := roundi(y)
    var sx := float(o.get("sx", roundi(size)))
    var sy := float(o.get("sy", roundi(size)))
    if sx <= 0.0 or sy <= 0.0:
        return
    var rot := float(o.get("rot", 0.0))
    var seed := float(o.get("seed", x * 0.173 + y * 0.31))
    var hard := float(o.get("hard", 0.9))
    var glow := float(o.get("glow", 0.3))
    var edge := float(o.get("edge", 0.0))
    var flags := float(o.get("flags", 0.0))
    var vsz := Vector2(maxf(sx, 0.75), maxf(sy, 0.75))
    var pxs := 1.0 / ((vsz.x + vsz.y) * 0.5)
    # GPU fragments are sampled at pixel centers, and the shader only
    # runs inside the rotated sprite quad, not its surrounding SDF field.
    var ext := ceili(sqrt(sx * sx + sy * sy)) + 1
    var cs := cos(-rot)
    var sn := sin(-rot)
    for py in range(maxi(0, cy - ext), mini(H - 1, cy + ext) + 1):
        for pxx in range(maxi(0, cx - ext), mini(W - 1, cx + ext) + 1):
            var q := Vector2(float(pxx) + 0.5 - float(cx), float(py) + 0.5 - float(cy))
            var rq := Vector2(q.x * cs - q.y * sn, q.x * sn + q.y * cs)
            if absf(rq.x) > sx or absf(rq.y) > sy:
                continue
            var fl := flags
            if fl >= 4.0:
                fl -= 4.0
                rq += vsz * 0.14 * Vector2(sin(rq.y * 0.9 + t * 2.0 + seed * 9.0), cos(rq.x * 0.8 - t * 1.7 + seed * 5.0))
            if fl >= 2.0:
                rq = Vector2(floor(rq.x * 0.5) / 0.5, floor(rq.y * 0.5) / 0.5)
                fl -= 2.0
            var p := Vector2(rq.x / vsz.x, rq.y / vsz.y)
            var res := shape_alpha(shape, p, seed, hard * pxs)
            var a := float(res[0])
            if a <= 0.002:
                continue
            var dl := p.length()
            var cr := col.r
            var cg := col.g
            var cb := col.b
            var gm := lerpf(1.0, 1.0 + glow * 2.2 * exp(-dl * dl * 2.5), clampf(glow, 0.0, 1.0))
            cr *= gm
            cg *= gm
            cb *= gm
            var rim := float(res[1]) * edge * 1.6
            cr += cr * rim
            cg += cg * rim
            cb += cb * rim
            var al := col.a * a
            _add_px(pxx, py, cr * al, cg * al, cb * al)

## fx.line — additive ribbon (RibbonBatch + RIBBON_FS). pts flat [x,y,...],
## width scalar or per-point Array, col Color or per-point Array of Color.
func line(pts: Array, width: Variant, col: Variant, o: Dictionary = {}) -> void:
    var n := pts.size() / 2
    if n < 2:
        return
    var hard := float(o.get("hard", 0.8))
    var glow := float(o.get("glow", 0.0))
    var flow := float(o.get("flow", 0.0))
    var flags := float(o.get("flags", 0.0))
    var seed := float(o.get("seed", 1.0))
    var alpha_mul := float(o.get("alpha", 1.0))
    var along: Array = [0.0]
    var total := 0.0
    for i in range(1, n):
        total += Vector2(float(pts[i * 2]) - float(pts[(i - 1) * 2]), float(pts[i * 2 + 1]) - float(pts[(i - 1) * 2 + 1])).length()
        along.append(total)
    # bounding box
    var minx := 1e9
    var miny := 1e9
    var maxx := -1e9
    var maxy := -1e9
    var wmax := 0.0
    for i in range(n):
        minx = minf(minx, float(pts[i * 2]))
        miny = minf(miny, float(pts[i * 2 + 1]))
        maxx = maxf(maxx, float(pts[i * 2]))
        maxy = maxf(maxy, float(pts[i * 2 + 1]))
        wmax = maxf(wmax, _width_at(width, i))
    minx -= wmax + 2.0
    miny -= wmax + 2.0
    maxx += wmax + 2.0
    maxy += wmax + 2.0
    for py in range(maxi(0, floori(miny)), mini(H - 1, ceili(maxy)) + 1):
        for pxx in range(maxi(0, floori(minx)), mini(W - 1, ceili(maxx)) + 1):
            var pc := Vector2(float(pxx) + 0.5, float(py) + 0.5)
            var best_d := 1e9
            var best_along := 0.0
            var best_w := 1.0
            var best_fw_scale := 1.0
            var inside_single_strip := true
            var best_col := _col_at(col, 0)
            for i in range(n - 1):
                var a := Vector2(float(pts[i * 2]), float(pts[i * 2 + 1]))
                var b := Vector2(float(pts[(i + 1) * 2]), float(pts[(i + 1) * 2 + 1]))
                var ab := b - a
                var ll := ab.length_squared()
                var raw_u := 0.0 if ll == 0.0 else ((pc - a).dot(ab)) / ll
                if n == 2 and (ll == 0.0 or raw_u < 0.0 or raw_u > 1.0):
                    inside_single_strip = false
                    break
                var u := clampf(raw_u, 0.0, 1.0)
                var q := a + ab * u
                var d := (pc - q).length()
                if d < best_d:
                    best_d = d
                    best_along = float(along[i]) + ab.length() * u
                    best_w = lerpf(_width_at(width, i), _width_at(width, i + 1), u)
                    best_col = _col_at(col, i).lerp(_col_at(col, i + 1), u)
                    # fwidth(abs(across)) for a straight strip is the L1
                    # screen gradient of its normal, subject to GPU quad edges.
                    if n == 2 and ll > 0.0:
                        best_fw_scale = (absf(ab.x) + absf(ab.y)) / sqrt(ll)
            if not inside_single_strip: continue
            var w := maxf(best_w, 0.02)
            var d := best_d / w
            # A two-point RibbonBatch is one finite quad, with no round caps.
            if d > (1.0 if n == 2 else 1.6):
                continue
            var dist_px := (1.0 - d) * w / best_fw_scale
            var a := clampf(dist_px / maxf(0.8, hard), 0.0, 1.0)
            var fl := flags
            if fl >= 4.0:
                fl -= 4.0
                a *= 0.55 + 0.75 * _fbm2(best_along * 26.0, t * 2.4 - best_along * 9.0 + seed * 5.0)
            if fl >= 2.0:
                fl -= 2.0
                var dd := d + (_h11(floor(best_along * 46.0) + floor(t * 22.0) * 0.37) - 0.5) * 0.8
                a = maxf(a * 0.35, clampf((1.0 - dd) * w / best_fw_scale / 1.6, 0.0, 1.0))
                d = dd
            if a <= 0.003:
                continue
            var core := 1.0 - d * d
            var cr := best_col.r * (0.55 + 0.75 * core)
            var cg := best_col.g * (0.55 + 0.75 * core)
            var cb := best_col.b * (0.55 + 0.75 * core)
            var ga := glow * exp(-d * d * 7.0) * 2.4
            cr += best_col.r * ga
            cg += best_col.g * ga
            cb += best_col.b * ga
            if flow > 0.0:
                var ph := fmod(best_along * seed * 0.06 - t * flow, 1.0)
                if ph < 0.0:
                    ph += 1.0
                var bump := pow(ph, 6.0)
                cr += 1.0 * bump * (1.2 - d) * 1.5
                cg += 0.97 * bump * (1.2 - d) * 1.5
                cb += 0.9 * bump * (1.2 - d) * 1.5
                a = maxf(a, bump * (1.0 - d * 0.6))
            var al := best_col.a * alpha_mul * a
            _add_px(pxx, py, cr * al, cg * al, cb * al)

static func _fbm2(px: float, py: float) -> float:
    var s := 0.0
    var a := 0.5
    var f := 1.0
    for i in range(3):
        s += a * _vnoise(px * f, py * f)
        f *= 2.1
        a *= 0.5
    return s

static func _width_at(width: Variant, i: int) -> float:
    if width is Array:
        var arr: Array = width
        return float(arr[mini(arr.size() - 1, i)])
    return float(width)

static func _col_at(col: Variant, i: int) -> Color:
    if col is Array:
        var arr: Array = col
        return arr[mini(arr.size() - 1, i)]
    return col

## fx.poly — additive quad (PolyBatch + POLY_FS, non-voidSpace path).
func poly(pts8: Array, col: Color, o: Dictionary = {}) -> void:
    if pts8.size() < 8:
        return
    var glow := float(o.get("glow", 0.0))
    var edge := float(o.get("edge", 0.05))
    var alpha_mul := float(o.get("alpha", 1.0))
    var corners: Array = []
    var minx := 1e9
    var miny := 1e9
    var maxx := -1e9
    var maxy := -1e9
    for v in range(4):
        var p := Vector2(float(pts8[v * 2]), float(pts8[v * 2 + 1]))
        corners.append(p)
        minx = minf(minx, p.x)
        miny = minf(miny, p.y)
        maxx = maxf(maxx, p.x)
        maxy = maxf(maxy, p.y)
    var locs := [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]
    for py in range(maxi(0, floori(miny)), mini(H - 1, ceili(maxy)) + 1):
        for pxx in range(maxi(0, floori(minx)), mini(W - 1, ceili(maxx)) + 1):
            var pc := Vector2(float(pxx), float(py))
            var l: Variant = _quad_local(corners, locs, pc)
            if l == null:
                continue
            var lv: Vector2 = l
            var r := maxf(absf(lv.x), absf(lv.y))
            if r > 1.3:
                continue
            var half_px := maxf(1.0, (maxx - minx) * 0.5)
            var ea := clampf((1.0 - r) * half_px / maxf(0.6, edge), 0.0, 1.0)
            if ea <= 0.004:
                continue
            var cr := col.r * (1.0 + glow * (1.0 - r * r) * 2.0)
            var cg := col.g * (1.0 + glow * (1.0 - r * r) * 2.0)
            var cb := col.b * (1.0 + glow * (1.0 - r * r) * 2.0)
            var al := col.a * alpha_mul * ea
            _add_px(pxx, py, cr * al, cg * al, cb * al)

static func _quad_local(corners: Array, locs: Array, pc: Vector2) -> Variant:
    # Inverse bilinear mapping via two triangles (0,1,2) and (1,3,2).
    for tri in [[0, 1, 2], [1, 3, 2]]:
        var a: Vector2 = corners[tri[0]]
        var b: Vector2 = corners[tri[1]]
        var c: Vector2 = corners[tri[2]]
        var den := (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if den == 0.0:
            continue
        var w0 := ((b.y - c.y) * (pc.x - c.x) + (c.x - b.x) * (pc.y - c.y)) / den
        var w1 := ((c.y - a.y) * (pc.x - c.x) + (a.x - c.x) * (pc.y - c.y)) / den
        var w2 := 1.0 - w0 - w1
        if w0 >= -0.01 and w1 >= -0.01 and w2 >= -0.01:
            return locs[tri[0]] * w0 + locs[tri[1]] * w1 + locs[tri[2]] * w2
    return null

static func quad_c(cx: float, cy: float, hw: float, hh: float, rot: float = 0.0) -> Array:
    var c := cos(rot)
    var s := sin(rot)
    var out: Array = []
    for lc in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
        var lc2: Vector2 = lc
        var lx := lc2.x * hw
        var ly := lc2.y * hh
        out.append(cx + lx * c - ly * s)
        out.append(cy + lx * s + ly * c)
    return out

# ---- particle pool (particles.ts) ----
func pool_spawn(px: float, py: float, vx: float, vy: float, life: float, s0: float, s1: float, col: Color, alpha: float, o: Dictionary = {}) -> void:
    _pool.append({"x": px, "y": py, "vx": vx, "vy": vy, "life": 0.0, "max": life, "s0": s0, "s1": s1,
        "r": col.r, "g": col.g, "b": col.b, "a": alpha,
        "shape": int(o.get("shape", DISC)), "drag": float(o.get("drag", 0.0)), "grav": float(o.get("grav", 0.0)),
        "rot": float(o.get("rot", 0.0)), "spin": float(o.get("spin", 0.0)), "seed": float(o.get("seed", 1.7)),
        "hard": float(o.get("hard", 0.9)), "glow": float(o.get("glow", 0.3)), "edge": float(o.get("edge", 0.0)),
        "wob": 1.0 if bool(o.get("wob", false)) else 0.0, "flags": float(o.get("flags", 0.0)), "env": int(o.get("env", 0))})

func pool_step(dt: float) -> void:
    var i := _pool.size() - 1
    while i >= 0:
        var p: Dictionary = _pool[i]
        p.life = float(p.life) + dt
        if float(p.life) >= float(p.max):
            _pool.remove_at(i)
            i -= 1
            continue
        var dr := exp(-float(p.drag) * dt)
        p.vx = float(p.vx) * dr
        p.vy = float(p.vy) * dr
        p.vy = float(p.vy) + float(p.grav) * dt
        p.x = float(p.x) + float(p.vx) * dt
        p.y = float(p.y) + float(p.vy) * dt
        p.rot = float(p.rot) + float(p.spin) * dt
        i -= 1

static func _envelope(env: int, tt: float, seed: float) -> float:
    match env:
        0:
            return 1.0 - tt
        1:
            return minf(1.0, tt * 9.0) * pow(1.0 - tt, 1.7)
        2:
            return sin(PI * pow(tt, 0.75))
        3:
            var f := sin(tt * 60.0 + seed * 30.0) * 0.5 + 0.5
            return (1.0 - tt) * (0.55 + 0.45 * f)
        4:
            return minf(1.0, tt * 5.0) * (1.0 - pow(tt, 3.0))
    return 1.0 - tt

func pool_render() -> void:
    for p in _pool:
        var tt := clampf(float(p.life) / float(p.max), 0.0, 1.0)
        var e := _envelope(int(p.env), tt, float(p.seed))
        if e <= 0.01:
            continue
        sp(float(p.x), float(p.y), lerpf(float(p.s0), float(p.s1), tt),
            Color(float(p.r), float(p.g), float(p.b), float(p.a) * e), int(p.shape),
            {"rot": float(p.rot), "seed": float(p.seed), "hard": float(p.hard), "glow": float(p.glow),
             "edge": float(p.edge), "flags": float(p.flags)})

func pool_clear() -> void:
    _pool.clear()

## COMP post (ACES, saturation 1.1, 26-level dithered posterise, flash,
## vignette, scanline; bloom excluded — see header).
func composite() -> PackedByteArray:
    var out := PackedByteArray()
    out.resize(N * 4)
    var levels := 26.0
    for y in range(H):
        for x in range(W):
            var i := (y * W + x) * 3
            var cr := buf[i]
            var cg := buf[i + 1]
            var cb := buf[i + 2]
            cr = _aces(cr)
            cg = _aces(cg)
            cb = _aces(cb)
            var lum := cr * 0.2126 + cg * 0.7152 + cb * 0.0722
            cr = lerpf(lum, cr, 1.1)
            cg = lerpf(lum, cg, 1.1)
            cb = lerpf(lum, cb, 1.1)
            var bt := _bayer4(x, y) - 0.5
            cr = floor(clampf(cr, 0.0, 1.0) * levels + 0.5 + bt) / levels
            cg = floor(clampf(cg, 0.0, 1.0) * levels + 0.5 + bt) / levels
            cb = floor(clampf(cb, 0.0, 1.0) * levels + 0.5 + bt) / levels
            cr += flash_col.x * flash_amt
            cg += flash_col.y * flash_amt
            cb += flash_col.z * flash_amt
            var dx := float(x) / float(W) - 0.5
            var dy := float(y) / float(H) - 0.5
            var vig := 1.0 - 0.55 * (dx * dx + dy * dy) * 0.85
            var scan := 0.965 + 0.035 * (1.0 if fmod(float(y) * 0.5, 1.0) >= 0.5 else 0.0)
            cr = clampf(cr * vig * scan, 0.0, 1.0)
            cg = clampf(cg * vig * scan, 0.0, 1.0)
            cb = clampf(cb * vig * scan, 0.0, 1.0)
            var o := (y * W + x) * 4
            out[o] = int(cr * 255.0)
            out[o + 1] = int(cg * 255.0)
            out[o + 2] = int(cb * 255.0)
            # This preview texture is an additive light input, not a source
            # geometry/alpha mask. Black adds zero without color-key inference.
            out[o + 3] = 255
    return out

static func _aces(v: float) -> float:
    return clampf((v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14), 0.0, 1.0)

const BAYER16 := [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

static func _bayer4(x: int, y: int) -> float:
    return (float(BAYER16[(y & 3) * 4 + (x & 3)]) + 0.5) / 16.0

## D palette (vfx.ts PAL) + interpolated ramp.
static func ramp(pal: Array, tt: float, a: float = 1.0) -> Color:
    var n := pal.size() - 1
    var x := clampf(tt, 0.0, 1.0) * float(n)
    var i := mini(n - 1, floori(x))
    var f := x - float(i)
    var c0: Vector3 = pal[i]
    var c1: Vector3 = pal[i + 1]
    return Color(lerpf(c0.x, c1.x, f), lerpf(c0.y, c1.y, f), lerpf(c0.z, c1.z, f), a)

static func pal_astral() -> Array:
    return [Vector3(0.02, 0.01, 0.05), Vector3(0.1, 0.03, 0.2), Vector3(0.3, 0.08, 0.44),
        Vector3(0.62, 0.22, 0.78), Vector3(0.95, 0.62, 0.98), Vector3(1.0, 0.96, 1.0)]
