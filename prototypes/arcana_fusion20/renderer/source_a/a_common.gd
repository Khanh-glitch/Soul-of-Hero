## Port of original A spells/common.ts.
extends RefCounted
class_name ACommon

static func fire_col(h: float, steps: float = 9.0) -> Vector3:
    return AMath.R("fire", floor(AMath.cl01(h) * steps) / steps)

static func ramp_step(name: String, h: float, steps: float = 8.0) -> Vector3:
    return AMath.R(name, floor(AMath.cl01(h) * steps) / steps)

static func flame_blob(fb: AFramebuffer, cx: float, cy: float, radius: float, t: float, seed_off: float, k: float, squash: float = 1.0, steps: float = 9.0) -> void:
    var rr := radius * 1.35
    ADraw.field(fb, cx - rr, cy - rr / squash, cx + rr, cy + rr / squash, func(x: int, y: int, out: Array) -> void:
        var dx := float(x) + 0.5 - cx
        var dy := (float(y) + 0.5 - cy) * squash
        var d := Vector2(dx, dy).length()
        if d > rr:
            return
        var a := atan2(dy, dx)
        var n := AMath.fbm(cos(a) * 2.4 + seed_off, sin(a) * 2.4 - t * 1.7, 3)
        var surf := radius * (0.62 + n * 0.62)
        var h := 1.0 - d / surf
        if h <= 0.0:
            return
        h *= k
        var c := fire_col(h, steps)
        out[0] = c.x
        out[1] = c.y
        out[2] = c.z)

# Branch = {pts:Array[Vector2], w, depth, grow, speed, delay, seed}
static func grow_branches(rng: AMath.ARng, x0: float, y0: float, a0: float, w0: float, o: Dictionary) -> Array:
    var out: Array = []
    var queue: Array = [{"x": x0, "y": y0, "a": a0, "w": w0, "d": 0, "delay": 0.0}]
    var guard := 0
    var bias: Callable = o.get("bias", Callable())
    while not queue.is_empty() and guard < 400:
        guard += 1
        var q: Dictionary = queue.pop_front()
        var pts: Array = [Vector2(float(q.x), float(q.y))]
        var x: float = q.x
        var y: float = q.y
        var a: float = q.a
        var n: int = maxi(3, roundi(float(o.steps) * (1.0 - float(q.d) * 0.18) * rng.rangef(0.6, 1.25)))
        for i in range(n):
            a += rng.gauss(float(o.wander)) * 0.5
            if bias.is_valid():
                a += float(bias.call(x, y, a, int(q.d))) * 0.3
            var s := float(o.step) * rng.rangef(0.7, 1.35)
            x += cos(a) * s
            y += sin(a) * s
            pts.append(Vector2(x, y))
            if int(q.d) < int(o.max_depth) and rng.next() < float(o.branch_chance):
                queue.append({"x": x, "y": y, "a": a + rng.sign() * rng.rangef(0.4, 1.3), "w": float(q.w) * float(o.width_falloff), "d": int(q.d) + 1, "delay": float(q.delay) + (float(i) / float(n)) * (1.0 / float(o.speed)) * 0.9})
        out.append({"pts": pts, "w": q.w, "depth": q.d, "grow": 0.0, "speed": float(o.speed) * rng.rangef(0.8, 1.4), "delay": q.delay, "seed": rng.intf(0, 9999)})
    return out

static func update_branches(bs: Array, t: float) -> void:
    for b in bs:
        b["grow"] = AMath.cl01((t - float(b.delay)) * float(b.speed))

static func draw_branch(fb: AFramebuffer, b: Dictionary, col_fn: Callable, width_fn: Callable, blend: bool = false) -> void:
    var pts: Array = b.pts
    var n := pts.size()
    var limit := float(b.grow) * float(n - 1)
    if limit <= 0.0:
        return
    for i in range(mini(n - 1, ceili(limit))):
        var p: Vector2 = pts[i]
        var q: Vector2 = pts[i + 1]
        var f := AMath.cl01(limit - float(i))
        var u0 := float(i) / float(n - 1)
        var ex := p.x + (q.x - p.x) * f
        var ey := p.y + (q.y - p.y) * f
        var dx := ex - p.x
        var dy := ey - p.y
        var len := maxf(1.0, Vector2(dx, dy).length())
        var s := 0.0
        while s <= len:
            var u := u0 + (s / len / float(n - 1))
            var cx := p.x + (dx * s) / len
            var cy := p.y + (dy * s) / len
            var w: float = width_fn.call(u, b)
            var nx := -dy / len
            var ny := dx / len
            var iw := ceili(w)
            for kk in range(-iw, iw + 1):
                var e := absf(float(kk)) / (w if w != 0.0 else 1.0)
                if e > 1.0:
                    continue
                var c: Variant = col_fn.call(u, e, b)
                if c == null:
                    continue
                var cc: Vector3 = c
                if blend:
                    fb.blend(roundi(cx + nx * float(kk)), roundi(cy + ny * float(kk)), cc.x, cc.y, cc.z, 1.0)
                else:
                    fb.add(cx + nx * float(kk), cy + ny * float(kk), cc.x, cc.y, cc.z, 1.0)
            s += 1.0

static func scar_decal(fb: AFramebuffer, bs: Array, heat: float, t: float, tint: Vector3 = Vector3(1, 0.35, 0.08)) -> void:
    for b in bs:
        draw_branch(fb, b, func(u: float, e: float, bb: Dictionary) -> Variant:
            var flick := 0.75 + 0.25 * AMath.vnoise(u * 18.0 + float(bb.seed), t * 3.0)
            var h := (1.0 - e) * heat * flick * (1.0 - u * 0.45)
            if h <= 0.02:
                return null
            var c := fire_col(h * 0.95)
            return Vector3(c.x * tint.x, c.y * tint.y * 1.6, c.z * tint.z * 2.2),
            func(u: float, bb: Dictionary) -> float:
                return maxf(0.6, float(bb.w) * (1.0 - u * 0.75)))

static func shard(fb: AFramebuffer, cx: float, cy: float, r: float, a: float, sides: int, seed: int, col_fn: Callable, squash: float = 1.0) -> void:
    var pts: Array = []
    for i in range(sides):
        var ang := a + (float(i) / float(sides)) * AMath.TAU
        var rr := r * (0.55 + AMath.hash2(float(seed), float(i)) * 0.8)
        pts.append(Vector2(cx + cos(ang) * rr, cy + (sin(ang) * rr) / squash))
    var min_y := 1e9
    var max_y := -1e9
    for p in pts:
        var pv: Vector2 = p
        min_y = minf(min_y, pv.y)
        max_y = maxf(max_y, pv.y)
    var xs: Array = []
    for y in range(maxi(0, floori(min_y)), mini(AFramebuffer.H - 1, ceili(max_y)) + 1):
        xs.clear()
        var yc := float(y) + 0.5
        for i in range(pts.size()):
            var p: Vector2 = pts[i]
            var q: Vector2 = pts[(i + 1) % pts.size()]
            if p.y == q.y:
                continue
            if (yc >= p.y and yc < q.y) or (yc >= q.y and yc < p.y):
                xs.append(p.x + ((yc - p.y) / (q.y - p.y)) * (q.x - p.x))
        xs.sort()
        var k := 0
        while k + 1 < xs.size():
            var xa: int = ceili(float(xs[k]))
            var xb: int = floori(float(xs[k + 1]))
            for x in range(xa, xb + 1):
                var d := Vector2(float(x) - cx, (float(y) - cy) * squash).length() / (r if r != 0.0 else 1.0)
                var edge := minf(float(x) - float(xs[k]), float(xs[k + 1]) - float(x))
                var c: Variant = col_fn.call(AMath.cl01(d), edge)
                if c != null:
                    var cc: Vector3 = c
                    fb.add(float(x), float(y), cc.x, cc.y, cc.z, 1.0)
            k += 2

static func heat_shimmer(fb: AFramebuffer, cx: float, cy: float, r: float, t: float, amp: float) -> void:
    var x0: int = maxi(1, floori(cx - r))
    var x1: int = mini(AFramebuffer.W - 2, ceili(cx + r))
    var y0: int = maxi(1, floori(cy - r))
    var y1: int = mini(AFramebuffer.H - 2, ceili(cy + r))
    if x1 <= x0 or y1 <= y0:
        return
    var w := x1 - x0 + 1
    var h := y1 - y0 + 1
    var tmp := PackedFloat32Array()
    tmp.resize(w * h * 3)
    for y in range(h):
        for x in range(w):
            var i := ((y + y0) * AFramebuffer.W + (x + x0)) * 3
            var o := (y * w + x) * 3
            tmp[o] = fb.buf[i]
            tmp[o + 1] = fb.buf[i + 1]
            tmp[o + 2] = fb.buf[i + 2]
    for y in range(h):
        for x in range(w):
            var gx := x + x0
            var gy := y + y0
            var d := Vector2(float(gx) - cx, float(gy) - cy).length() / r
            if d > 1.0:
                continue
            var f := (1.0 - d) * amp
            var dyi: int = roundi((AMath.vnoise((float(gx) + 0.5) * 0.18, (float(gy) + 0.5) * 0.1 - t * 6.0) - 0.5) * 2.0 * f)
            var dxi: int = roundi((AMath.vnoise(float(gx) * 0.12 + 40.0, float(gy) * 0.14 - t * 4.0) - 0.5) * 1.4 * f)
            var sx: int = clampi(x + dxi, 0, w - 1)
            var sy: int = clampi(y + dyi, 0, h - 1)
            var si := (sy * w + sx) * 3
            var i := (gy * AFramebuffer.W + gx) * 3
            fb.buf[i] = tmp[si]
            fb.buf[i + 1] = tmp[si + 1]
            fb.buf[i + 2] = tmp[si + 2]
