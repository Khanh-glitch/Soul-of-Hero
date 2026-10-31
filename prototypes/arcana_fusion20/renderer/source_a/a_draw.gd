## Port of original A engine/draw.ts + particles.ts (Pool/streakP).
## field shaders take Callable(x, y, out:Array)->void mutating out[0..2].
extends RefCounted
class_name ADraw

static func field(fb: AFramebuffer, x0: float, y0: float, x1: float, y1: float, fn: Callable) -> void:
    var xa: int = maxi(0, floori(x0))
    var ya: int = maxi(0, floori(y0))
    var xb: int = mini(AFramebuffer.W - 1, ceili(x1))
    var yb: int = mini(AFramebuffer.H - 1, ceili(y1))
    var out := [0.0, 0.0, 0.0]
    for y in range(ya, yb + 1):
        var i := (y * AFramebuffer.W + xa) * 3
        for x in range(xa, xb + 1):
            out[0] = 0.0
            out[1] = 0.0
            out[2] = 0.0
            fn.call(x, y, out)
            if float(out[0]) != 0.0 or float(out[1]) != 0.0 or float(out[2]) != 0.0:
                fb.buf[i] += float(out[0])
                fb.buf[i + 1] += float(out[1])
                fb.buf[i + 2] += float(out[2])
            i += 3

static func field_mul(fb: AFramebuffer, x0: float, y0: float, x1: float, y1: float, fn: Callable) -> void:
    var xa: int = maxi(0, floori(x0))
    var ya: int = maxi(0, floori(y0))
    var xb: int = mini(AFramebuffer.W - 1, ceili(x1))
    var yb: int = mini(AFramebuffer.H - 1, ceili(y1))
    for y in range(ya, yb + 1):
        var i := (y * AFramebuffer.W + xa) * 3
        for x in range(xa, xb + 1):
            var m: float = fn.call(x, y)
            if m != 1.0:
                fb.buf[i] *= m
                fb.buf[i + 1] *= m
                fb.buf[i + 2] *= m
            i += 3

static func px(fb: AFramebuffer, x: float, y: float, c: Vector3, a: float = 1.0) -> void:
    fb.add(x, y, c.x, c.y, c.z, a)

static func glow(fb: AFramebuffer, cx: float, cy: float, r: float, c: Vector3, k: float = 1.0) -> void:
    if r <= 0.0 or k <= 0.0:
        return
    var inv := 1.0 / r
    field(fb, cx - r, cy - r, cx + r, cy + r, func(x: int, y: int, out: Array) -> void:
        var dx := (float(x) + 0.5 - cx) * inv
        var dy := (float(y) + 0.5 - cy) * inv
        var d2 := dx * dx + dy * dy
        if d2 >= 1.0:
            return
        var m := 1.0 - d2
        var f := m * m * m * k
        out[0] = c.x * f
        out[1] = c.y * f
        out[2] = c.z * f)

static func disc(fb: AFramebuffer, cx: float, cy: float, r: float, c: Vector3, a: float = 1.0) -> void:
    var r2 := r * r
    field(fb, cx - r - 1.0, cy - r - 1.0, cx + r + 1.0, cy + r + 1.0, func(x: int, y: int, out: Array) -> void:
        var dx := float(x) + 0.5 - cx
        var dy := float(y) + 0.5 - cy
        if dx * dx + dy * dy > r2:
            return
        out[0] = c.x * a
        out[1] = c.y * a
        out[2] = c.z * a)

static func disc_blend(fb: AFramebuffer, cx: float, cy: float, r: float, c: Vector3, a: float = 1.0) -> void:
    var r2 := r * r
    var xa: int = maxi(0, floori(cx - r - 1.0))
    var xb: int = mini(AFramebuffer.W - 1, ceili(cx + r + 1.0))
    var ya: int = maxi(0, floori(cy - r - 1.0))
    var yb: int = mini(AFramebuffer.H - 1, ceili(cy + r + 1.0))
    for y in range(ya, yb + 1):
        for x in range(xa, xb + 1):
            var dx := float(x) + 0.5 - cx
            var dy := float(y) + 0.5 - cy
            if dx * dx + dy * dy > r2:
                continue
            fb.blend(x, y, c.x, c.y, c.z, a)

static func ring_shape(fb: AFramebuffer, cx: float, cy: float, r: float, w: float, c: Vector3, a: float = 1.0) -> void:
    var ro := r + w * 0.5
    var ri := maxf(0.0, r - w * 0.5)
    field(fb, cx - ro - 1.0, cy - ro - 1.0, cx + ro + 1.0, cy + ro + 1.0, func(x: int, y: int, out: Array) -> void:
        var d := Vector2(float(x) + 0.5 - cx, float(y) + 0.5 - cy).length()
        if d > ro or d < ri:
            return
        out[0] = c.x * a
        out[1] = c.y * a
        out[2] = c.z * a)

static func pulse_ring(fb: AFramebuffer, cx: float, cy: float, r: float, w: float, c: Vector3, k: float = 1.0, squash: float = 1.0, rough: float = 0.22, seed: float = 0.0) -> void:
    if k <= 0.003 or w <= 0.0:
        return
    var kk := k * 0.5
    var ro := r * (1.0 + rough) + w * 3.0
    field(fb, cx - ro - 1.0, cy - ro / squash - 1.0, cx + ro + 1.0, cy + ro / squash + 1.0, func(x: int, y: int, out: Array) -> void:
        var dx := float(x) + 0.5 - cx
        var dy := (float(y) + 0.5 - cy) * squash
        var d := Vector2(dx, dy).length()
        var a := atan2(dy, dx)
        var rr := r * (1.0 + rough * (sin(a * 3.0 + seed) * 0.34 + sin(a * 7.0 - seed * 1.7) * 0.2 + sin(a * 13.0 + seed * 0.6) * 0.1))
        var q := (d - rr) / w
        var f := 0.0
        if q > 0.0:
            f = exp(-q * q * 9.0)
        else:
            f = exp(q * 2.4) * 0.55
        if f < 0.02:
            return
        var brk := 0.3 + 0.7 * AMath.vnoise(cos(a) * 3.5 + seed * 3.0 + r * 0.02, sin(a) * 3.5 + r * 0.03)
        var ff := f * f * kk * brk
        out[0] = c.x * ff
        out[1] = c.y * ff
        out[2] = c.z * ff)

static func streak(fb: AFramebuffer, x0: float, y0: float, x1: float, y1: float, w0: float, w1: float, c: Vector3, k: float = 1.0) -> void:
    var dx := x1 - x0
    var dy := y1 - y0
    var len := Vector2(dx, dy).length()
    if len < 0.001:
        glow(fb, x0, y0, maxf(w0, 0.8), c, k)
        return
    var w_max := maxf(w0, w1) + 1.0
    var il2 := 1.0 / (len * len)
    field(fb, minf(x0, x1) - w_max, minf(y0, y1) - w_max, maxf(x0, x1) + w_max, maxf(y0, y1) + w_max, func(x: int, y: int, out: Array) -> void:
        var px0 := float(x) + 0.5 - x0
        var py0 := float(y) + 0.5 - y0
        var t: float = AMath.clampf((px0 * dx + py0 * dy) * il2)
        var qx := px0 - dx * t
        var qy := py0 - dy * t
        var d := Vector2(qx, qy).length()
        var w := lerpf(w0, w1, t)
        if d > w:
            return
        var f := 1.0 - d / w
        f = f * f * k
        out[0] = c.x * f
        out[1] = c.y * f
        out[2] = c.z * f)

static func line(fb: AFramebuffer, x0f: float, y0f: float, x1f: float, y1f: float, c: Vector3, a: float = 1.0) -> void:
    var x0: int = int(x0f)
    var y0: int = int(y0f)
    var x1: int = int(x1f)
    var y1: int = int(y1f)
    var dx: int = absi(x1 - x0)
    var sx: int = 1 if x0 < x1 else -1
    var dy: int = -absi(y1 - y0)
    var sy: int = 1 if y0 < y1 else -1
    var err := dx + dy
    var guard := 0
    while true:
        fb.add(float(x0), float(y0), c.x, c.y, c.z, a)
        if (x0 == x1 and y0 == y1) or guard > 4000:
            break
        guard += 1
        var e2 := 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy

static func ribbon(fb: AFramebuffer, pts: Array, width_fn: Callable, col_fn: Callable, blend: bool = false, alpha: float = 1.0) -> void:
    var n := pts.size()
    if n < 2:
        return
    for i in range(n - 1):
        var t0 := float(i) / float(n - 1)
        var t1 := float(i + 1) / float(n - 1)
        var p0: Vector2 = pts[i]
        var p1: Vector2 = pts[i + 1]
        var nx := -(p1.y - p0.y)
        var ny := p1.x - p0.x
        var l := Vector2(nx, ny).length()
        if l == 0.0:
            l = 1.0
        nx /= l
        ny /= l
        var w0: float = width_fn.call(t0, i)
        var w1: float = width_fn.call(t1, i + 1)
        var seg_len := p0.distance_to(p1)
        var steps: int = maxi(1, ceili(seg_len))
        for s in range(steps):
            var u := float(s) / float(steps)
            var t := lerpf(t0, t1, u)
            var cx := lerpf(p0.x, p1.x, u)
            var cy := lerpf(p0.y, p1.y, u)
            var w := lerpf(w0, w1, u)
            var iw := ceili(w)
            for k in range(-iw, iw + 1):
                var e := absf(float(k)) / (w if w != 0.0 else 1.0)
                if e > 1.0:
                    continue
                var c: Variant = col_fn.call(t, i, e)
                if c == null:
                    continue
                var cc: Vector3 = c
                if blend:
                    fb.blend(roundi(cx + nx * float(k)), roundi(cy + ny * float(k)), cc.x, cc.y, cc.z, alpha)
                else:
                    fb.add(cx + nx * float(k), cy + ny * float(k), cc.x, cc.y, cc.z, alpha)

static func poly_fill(fb: AFramebuffer, pts: Array, col_fn: Callable, blend: bool = false, alpha: float = 1.0) -> void:
    var n := pts.size()
    if n < 3:
        return
    var min_y := 1e9
    var max_y := -1e9
    for p in pts:
        var pv: Vector2 = p
        min_y = minf(min_y, pv.y)
        max_y = maxf(max_y, pv.y)
    var y0: int = maxi(0, floori(min_y))
    var y1: int = mini(AFramebuffer.H - 1, ceili(max_y))
    var xs: Array = []
    for y in range(y0, y1 + 1):
        xs.clear()
        var yc := float(y) + 0.5
        for i in range(n):
            var a: Vector2 = pts[i]
            var b: Vector2 = pts[(i + 1) % n]
            if a.y == b.y:
                continue
            if (yc >= a.y and yc < b.y) or (yc >= b.y and yc < a.y):
                xs.append(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x))
        if xs.size() < 2:
            continue
        xs.sort()
        var k := 0
        while k + 1 < xs.size():
            var xa: int = maxi(0, ceili(float(xs[k]) - 0.5))
            var xb: int = mini(AFramebuffer.W - 1, floori(float(xs[k + 1]) - 0.5))
            for x in range(xa, xb + 1):
                var c: Variant = col_fn.call(x, y)
                if c == null:
                    continue
                var cc: Vector3 = c
                if blend:
                    fb.blend(x, y, cc.x, cc.y, cc.z, alpha)
                else:
                    fb.add(float(x), float(y), cc.x, cc.y, cc.z, alpha)
            k += 2

static func bolt_path(x0: float, y0: float, x1: float, y1: float, chaos: float, seed: int, depth: int = 5) -> Array:
    var pts: Array = [Vector2(x0, y0), Vector2(x1, y1)]
    var amp := chaos
    var s := seed
    for d in range(depth):
        var next: Array = [pts[0]]
        for i in range(pts.size() - 1):
            var a: Vector2 = pts[i]
            var b: Vector2 = pts[i + 1]
            var mx := (a.x + b.x) * 0.5
            var my := (a.y + b.y) * 0.5
            var nx := -(b.y - a.y)
            var ny := b.x - a.x
            var l := Vector2(nx, ny).length()
            if l == 0.0:
                l = 1.0
            nx /= l
            ny /= l
            var r := AMath.hash2(float(s), float(i * 31 + d * 7)) - 0.5
            s += 1
            next.append(Vector2(mx + nx * r * amp, my + ny * r * amp))
            next.append(b)
        pts = next
        amp *= 0.55
    return pts

static func bolt_draw(fb: AFramebuffer, pts: Array, w: float, sheath: Vector3, core: Vector3, k: float = 1.0) -> void:
    for i in range(pts.size() - 1):
        var a: Vector2 = pts[i]
        var b: Vector2 = pts[i + 1]
        streak(fb, a.x, a.y, b.x, b.y, w, w, sheath, k * 0.9)
    for i in range(pts.size() - 1):
        var a: Vector2 = pts[i]
        var b: Vector2 = pts[i + 1]
        line(fb, a.x, a.y, b.x, b.y, core, k)

static func band(v: float, steps: float) -> float:
    return floor(AMath.clampf(v) * steps) / steps

static func arc_px(fb: AFramebuffer, cx: float, cy: float, r: float, a0: float, a1: float, c: Vector3, a: float = 1.0, squash: float = 1.0) -> void:
    var steps: int = maxi(4, ceili(absf(a1 - a0) * r))
    for i in range(steps + 1):
        var ang := lerpf(a0, a1, float(i) / float(steps))
        fb.add(cx + cos(ang) * r, cy + (sin(ang) * r) / squash, c.x, c.y, c.z, a)

class APool:
    extends RefCounted
    var items: Array = []
    func spawn(o: Dictionary) -> Dictionary:
        var p: Dictionary = {}
        for q in items:
            if bool(q.dead):
                p = q
                break
        if p.is_empty():
            p = {"x": 0.0, "y": 0.0, "vx": 0.0, "vy": 0.0, "life": 1.0, "max": 1.0, "size": 1.0, "seed": 0.0, "k": 1.0, "a": 0.0, "av": 0.0, "dead": false, "px": 0.0, "py": 0.0, "tag": 0}
            items.append(p)
        p["vx"] = 0.0
        p["vy"] = 0.0
        p["size"] = 1.0
        p["k"] = 1.0
        p["a"] = 0.0
        p["av"] = 0.0
        p["tag"] = 0
        p["dead"] = false
        for key in o.keys():
            p[key] = o[key]
        p["max"] = p["life"]
        p["px"] = p["x"]
        p["py"] = p["y"]
        return p
    func alive() -> Array:
        var out: Array = []
        for p in items:
            if not bool(p.dead):
                out.append(p)
        return out
    func each(fn: Callable) -> void:
        for p in items:
            if not bool(p.dead):
                fn.call(p)
    func count() -> int:
        var n := 0
        for p in items:
            if not bool(p.dead):
                n += 1
        return n
    func step(dt: float, drag: float = 0.0, gx: float = 0.0, gy: float = 0.0) -> void:
        for p in items:
            if bool(p.dead):
                continue
            p["px"] = p["x"]
            p["py"] = p["y"]
            p["vx"] = float(p.vx) + gx * dt
            p["vy"] = float(p.vy) + gy * dt
            if drag != 0.0:
                var d := exp(-drag * dt)
                p["vx"] = float(p.vx) * d
                p["vy"] = float(p.vy) * d
            p["x"] = float(p.x) + float(p.vx) * dt
            p["y"] = float(p.y) + float(p.vy) * dt
            p["a"] = float(p.a) + float(p.av) * dt
            p["life"] = float(p.life) - dt
            if float(p.life) <= 0.0:
                p["dead"] = true
    func clear_pool() -> void:
        for p in items:
            p["dead"] = true

static func streak_p(fb: AFramebuffer, p: Dictionary, c: Vector3, k: float) -> void:
    var dx := float(p.x) - float(p.px)
    var dy := float(p.y) - float(p.py)
    var n: int = clampi(ceili(Vector2(dx, dy).length()), 1, 12)
    for i in range(n + 1):
        var u := float(i) / float(n)
        var f := (0.35 + 0.65 * u) * k
        fb.add(float(p.px) + dx * u, float(p.py) + dy * u, c.x, c.y, c.z, f)
