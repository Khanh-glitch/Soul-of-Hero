## Faithful port of original C engine/kit.ts: particles, lightning,
## timed branch growth, shock/haze displacement, geometry helpers.
## NOTE: kit Particles.add uses Math.random for a default seed in the
## original; spells pass explicit seeds. Where they do not, we use a
## deterministic counter (documented divergence, keeps runs reproducible).
extends RefCounted
class_name CKit

static var _auto_seed := 0

static func pt_defaults(o: Dictionary) -> Dictionary:
    CPalette._ensure()
    _auto_seed += 1
    var p := {
        "x": 0.0, "y": 0.0, "z": 0.0, "vx": 0.0, "vy": 0.0, "vz": 0.0,
        "life": 0.0, "max": 1.0, "drag": 0.0, "grav": 0.0, "kind": "ember",
        "col": CPalette.P.get("ember", []), "k": 1.0, "size": 1.0,
        "seed": float(_auto_seed * 7919 % 1000000), "rot": 0.0, "spin": 0.0,
        "delay": 0.0, "ax": 0.0, "ay": 0.0,
    }
    for key in o.keys():
        p[key] = o[key]
    p["px"] = p["x"]
    p["py"] = p["y"]
    p["pz"] = p["z"]
    return p

static func particles_update(list: Array, dt: float) -> void:
    var i := list.size() - 1
    while i >= 0:
        var p: Dictionary = list[i]
        if float(p.delay) > 0.0:
            p.delay = float(p.delay) - dt
            i -= 1
            continue
        p.px = p.x
        p.py = p.y
        p.pz = p.z
        p.life = float(p.life) + dt
        if float(p.life) >= float(p.max):
            list[i] = list[list.size() - 1]
            list.pop_back()
            i -= 1
            continue
        var d := exp(-float(p.drag) * dt)
        p.vx = (float(p.vx) + float(p.ax) * dt) * d
        p.vy = (float(p.vy) + float(p.ay) * dt) * d
        var home_v: Variant = p.get("home")
        if home_v is Vector2:
            var hk := float(p.get("homeK", p.get("home_k", 4.0)))
            var home: Vector2 = home_v
            p.vx = float(p.vx) + (home.x - float(p.x)) * hk * dt
            p.vy = float(p.vy) + (home.y - float(p.y)) * hk * dt
        p.vz = float(p.vz) - float(p.grav) * dt
        p.x = float(p.x) + float(p.vx) * dt
        p.y = float(p.y) + float(p.vy) * dt
        p.z = float(p.z) + float(p.vz) * dt
        p.rot = float(p.rot) + float(p.spin) * dt
        if float(p.z) < 0.0 and float(p.grav) > 0.0:
            p.z = 0.0
            if p.has("onLand"):
                (p.onLand as Callable).call(p)
            if p.has("bounce") and float(p.bounce) != 0.0:
                p.vz = -float(p.vz) * float(p.bounce)
                p.vx = float(p.vx) * 0.6
                p.vy = float(p.vy) * 0.6
                if absf(float(p.vz)) < 8.0:
                    p.vz = 0.0
                    p.grav = 0.0
            elif String(p.kind) == "drop":
                p.life = p.max
            else:
                p.vz = 0.0
                p.grav = 0.0
                p.vx = float(p.vx) * 0.3
                p.vy = float(p.vy) * 0.3
        i -= 1

static func particles_render(f: CFrame, list: Array) -> void:
    for p in list:
        if float(p.delay) <= 0.0:
            draw_pt(f, p)

static func draw_pt(f: CFrame, p: Dictionary) -> void:
    var u := float(p.life) / float(p.max)
    var sx := float(p.x)
    var sy := float(p.y) - float(p.z)
    if float(p.z) > 1.5:
        f.S(sx, float(p.y), 0.6)
    match String(p.kind):
        "ember":
            var c := CPalette.ramp(p.col, 1.0 - u * 0.9)
            var sp := Vector2(float(p.vx), float(p.vy) - float(p.vz)).length()
            if sp > 50.0:
                f.line_l(sx, sy, float(p.px), float(p.py) - float(p.pz), c, float(p.k) * 0.8)
            f.Lc(sx, sy, c, float(p.k) * 1.3)
            if float(p.size) > 1.0:
                f.Lc(sx + 1.0, sy, c, float(p.k) * 0.6)
                f.Lc(sx, sy + 1.0, c, float(p.k) * 0.6)
        "spark":
            var c := CPalette.ramp(p.col, 1.0 - u)
            f.line_l(sx, sy, float(p.px) - (float(p.x) - float(p.px)), float(p.py) - float(p.pz) - ((float(p.y) - float(p.z)) - (float(p.py) - float(p.pz))), c, float(p.k))
            f.Lc(sx, sy, Vector3.ONE, float(p.k) * (1.0 - u))
        "drop":
            var c: Vector3 = p.get("c", Vector3(0.55, 0.85, 0.95))
            f.I(sx, sy, c.x * 0.5, c.y * 0.6, c.z * 0.8, 0.85)
            if float(p.size) > 1.0:
                f.I(sx, sy - 1.0, c.x, c.y, c.z, 0.9)
                f.L(sx, sy - 1.0, 0.25, 0.4, 0.45)
            else:
                f.L(sx, sy, c.x * 0.4, c.y * 0.5, c.z * 0.6)
            if absf(float(p.vz)) > 60.0:
                f.I(sx, sy + signf(float(p.vz)), c.x * 0.3, c.y * 0.5, c.z * 0.7, 0.6)
        "foam":
            var a := 1.0 - u
            if a > CMath.bayer(int(sx), int(sy)) * 0.9:
                f.I(sx, sy, 0.85, 0.97, 1.0, 1.0)
                f.L(sx, sy, 0.1, 0.18, 0.2)
        "shard":
            var s := float(p.size) * (1.0 - (u - 0.7) / 0.3 if u > 0.7 else 1.0)
            var pts: Array = []
            for i in range(3):
                pts.append(Vector2(sx + cos(float(p.rot) + float(i) * 2.2 + (0.5 if i == 1 else 0.0)) * s, sy + sin(float(p.rot) + float(i) * 2.2) * s * 0.8))
            var c: Vector3 = p.get("c", CPalette.ramp(p.col, 0.5 + 0.5 * sin(float(p.rot) * 2.0)))
            f.poly_i(pts, c, 1.0)
            var gl := maxf(0.0, sin(float(p.rot) * 3.0 + float(p.seed)))
            f.Lc(pts[0].x, pts[0].y, CPalette.ramp(p.col, 1.0), float(p.k) * (0.4 + gl))
        "petal":
            var c := CPalette.ramp(p.col, 0.45 + 0.4 * absf(sin(float(p.rot))))
            var a := 1.0 - (u - 0.8) / 0.2 if u > 0.8 else 1.0
            f.Ic(sx, sy, c, a)
            var fl := cos(float(p.rot))
            if fl > 0.2:
                f.Ic(sx + 1.0, sy, c, a)
            elif fl < -0.2:
                f.Ic(sx, sy + 1.0, CPalette.ramp(p.col, 0.3), a)
            if float(p.k) > 0.0:
                f.Lc(sx, sy, c, 0.15 * float(p.k))
        "spore", "seed":
            var tw := 0.6 + 0.4 * sin(float(p.life) * 7.0 + float(p.seed))
            var fade := u / 0.1 if u < 0.1 else (1.0 - (u - 0.75) / 0.25 if u > 0.75 else 1.0)
            var c: Vector3 = p.get("c", CPalette.ramp(p.col, 0.8))
            f.Lc(sx, sy, c, float(p.k) * tw * fade)
            if String(p.kind) == "seed":
                f.Lc(sx + 1.0, sy, c, float(p.k) * 0.4 * fade)
                f.Lc(sx, sy + 1.0, c, float(p.k) * 0.4 * fade)
                f.Lc(float(p.px), float(p.py) - float(p.pz), c, float(p.k) * 0.3 * fade)
        "ash":
            var c := CPalette.ramp(CPalette.P["ash"], 0.3 + 0.5 * CMath.hash1(int(p.seed)))
            var a := 1.0 - (u - 0.7) / 0.3 if u > 0.7 else 1.0
            f.Id(sx, sy, c, a)
            if u < 0.25:
                f.Lc(sx, sy, CPalette.ramp(CPalette.P["ember"], 0.6), (0.25 - u) * 3.0)
        "smoke":
            var r := float(p.size) * (0.5 + u)
            var a := (1.0 - u) * float(p.k)
            var c: Vector3 = p.get("c", Vector3(0.06, 0.05, 0.06))
            f.disc(sx, sy, r, func(x: int, y: int, d: float) -> void:
                if a * (1.0 - d * 0.6) > CMath.bayer(x, y):
                    f.I(x, y, c.x, c.y, c.z, 0.85))
        "star":
            var tw := (0.5 + 0.5 * sin(float(p.life) * 9.0 + float(p.seed))) * (1.0 - u)
            var c: Vector3 = p.get("c", CPalette.ramp(p.col, 0.9))
            f.Lc(sx, sy, c, float(p.k) * (0.6 + tw))
            if tw > 0.6:
                f.Lc(sx + 1.0, sy, c, float(p.k) * 0.5)
                f.Lc(sx - 1.0, sy, c, float(p.k) * 0.5)
                f.Lc(sx, sy + 1.0, c, float(p.k) * 0.5)
                f.Lc(sx, sy - 1.0, c, float(p.k) * 0.5)
        "dust":
            var c: Vector3 = p.get("c", Vector3(0.12, 0.1, 0.1))
            f.Ic(sx, sy, c, 1.0)
            if float(p.size) > 1.0:
                f.Ic(sx + 1.0, sy, c, 1.0)
            if float(p.k) > 0.0:
                f.Lc(sx, sy, CPalette.ramp(p.col, 1.0 - u), float(p.k) * (1.0 - u))
        "pix":
            var c: Vector3 = p.get("c", Vector3.ONE)
            f.Lc(sx, sy, c, float(p.k) * (1.0 - u))

# ---- lightning ----
static func bolt_pts(seed: float, ax: float, ay: float, bx: float, by: float, rough: float = 0.28, min_len: float = 3.0) -> Array:
    var out: Array = [Vector2(ax, ay)]
    var state := {"k": 0}
    _bolt_rec(out, state, seed, ax, ay, bx, by, rough, min_len, 0)
    return out

static func _bolt_rec(out: Array, state: Dictionary, seed: float, x0: float, y0: float, x1: float, y1: float, rough: float, min_len: float, depth: int) -> void:
    var len := Vector2(x1 - x0, y1 - y0).length()
    if len < min_len or depth > 10:
        out.append(Vector2(x1, y1))
        return
    var k := int(state.k)
    state.k = k + 1
    var off := (CMath.hash1(int(seed * 131.0) + k * 7) - 0.5) * len * rough * 2.0
    var mx := (x0 + x1) / 2.0 + (-(y1 - y0) / len) * off
    var my := (y0 + y1) / 2.0 + ((x1 - x0) / len) * off
    _bolt_rec(out, state, seed, x0, y0, mx, my, rough, min_len, depth + 1)
    _bolt_rec(out, state, seed, mx, my, x1, y1, rough, min_len, depth + 1)

static func bolt_tree(seed: float, ax: float, ay: float, bx: float, by: float, branches: int = 4, rough: float = 0.28, depth: int = 0) -> Array:
    var main := bolt_pts(seed, ax, ay, bx, by, rough)
    var res: Array = [{"pts": main, "w": 1.0 / (1.0 + float(depth) * 1.4), "depth": depth}]
    if depth > 1:
        return res
    var len := Vector2(bx - ax, by - ay).length()
    for i in range(branches):
        var h := CMath.hash1(int(seed * 17.0) + i * 101 + depth * 7)
        var idx := floori((0.15 + h * 0.7) * float(main.size() - 1))
        var p: Vector2 = main[idx]
        var q: Vector2 = main[mini(main.size() - 1, idx + 1)]
        var ang := atan2(q.y - p.y, q.x - p.x) + (CMath.hash1(int(seed) + i * 3) - 0.5) * 2.0
        var bl := len * (0.15 + 0.3 * CMath.hash1(int(seed * 3.0) + i)) / float(1 + depth)
        res.append_array(bolt_tree(seed * 7.0 + float(i) * 13.0 + 1.0, p.x, p.y, p.x + cos(ang) * bl, p.y + sin(ang) * bl, maxi(0, branches - 2), rough * 1.1, depth + 1))
    return res

static func draw_bolt(f: CFrame, pts: Array, k: float, core := Vector3.ONE, halo := Vector3(0.35, 0.5, 1.0), width: float = 1.4, reveal: float = 1.0) -> void:
    if k <= 0.01:
        return
    var n := maxi(2, ceili(float(pts.size()) * CMath.cl01(reveal)))
    var sub := pts.slice(0, n)
    f.ribbon(sub, width, func(x: int, y: int, _s: float, e: float) -> void:
        var a := absf(e)
        if a < 0.45:
            f.L(x, y, core.x * k * 1.3, core.y * k * 1.3, core.z * k * 1.3)
        else:
            f.L(x, y, halo.x * k * (1.2 - a), halo.y * k * (1.2 - a), halo.z * k * (1.2 - a)))

static func draw_bolt_tree(f: CFrame, tree: Array, k: float, core := Vector3.ONE, halo := Vector3(0.35, 0.5, 1.0), reveal: float = 1.0) -> void:
    for b in tree:
        draw_bolt(f, b.pts, k * float(b.w), core, halo, 1.0 if int(b.depth) != 0 else 1.6, CMath.cl01(reveal * 1.5 - 0.3) if int(b.depth) != 0 else reveal)

# ---- timed branching growth ----
static func grow_tree(rng: CMath.CRng, o: Dictionary) -> Array:
    var segs: Array = []
    _grow_rec(segs, rng, o, float(o.x), float(o.y), float(o.ang), int(o.steps), float(o.get("t0", 0.0)), 0, 1.0)
    return segs

static func _grow_rec(segs: Array, rng: CMath.CRng, o: Dictionary, x: float, y: float, ang: float, steps: int, t: float, depth: int, w: float) -> void:
    var sy := float(o.get("sy", 1.0))
    var cx := x
    var cy := y
    var ca := ang
    var ct := t
    var cw := w
    for i in range(steps):
        ca += rng.gauss() * float(o.jitter)
        var a := ca
        if o.has("snap") and float(o.snap) != 0.0:
            a = round(a / float(o.snap)) * float(o.snap)
        var st := float(o.step) * (0.6 + rng.next() * 0.8)
        var nx := cx + cos(a) * st
        var ny := cy + sin(a) * st * sy
        var t1 := ct + st / float(o.speed)
        segs.append({"x0": cx, "y0": cy, "x1": nx, "y1": ny, "t0": ct, "t1": t1, "depth": depth, "w": cw})
        if depth < int(o.maxDepth) and rng.chance(float(o.branch)):
            _grow_rec(segs, rng, o, nx, ny, ca + rng.sign() * float(o.spread) * (0.6 + rng.next() * 0.6), floori(float(steps - i) * 0.6), t1, depth + 1, cw * 0.6)
        cx = nx
        cy = ny
        ct = t1
        cw *= float(o.get("decay", 0.97))

static func draw_tree(f: CFrame, segs: Array, t: float, fn: Callable) -> void:
    for s in segs:
        if t < float(s.t0):
            continue
        var u := CMath.cl01((t - float(s.t0)) / (float(s.t1) - float(s.t0)))
        f.line(float(s.x0), float(s.y0), CMath.lerp(float(s.x0), float(s.x1), u), CMath.lerp(float(s.y0), float(s.y1), u), func(x: int, y: int, _ss: float) -> void: fn.call(x, y, s, t - float(s.t0)))

# ---- displacement helpers ----
static func shock(f: CFrame, cx: float, cy: float, r: float, width: float, amp: float, sy: float = 1.0, chroma: float = 0.0) -> void:
    if amp == 0.0 or r <= 0.0:
        return
    var R := r + width
    f.field(cx - R, cy - R * sy, cx + R, cy + R * sy, func(x: int, y: int) -> void:
        var dx := float(x) + 0.5 - cx
        var dy := (float(y) + 0.5 - cy) / sy
        var d := Vector2(dx, dy).length()
        var b := (d - r) / width
        if b < -1.0 or b > 1.0:
            return
        var w := cos(b * PI / 2.0)
        var s := -amp * w * sin(b * PI) / (d if d != 0.0 else 1.0)
        f.D(x, y, dx * s, dy * s * sy)
        if chroma != 0.0:
            f.C(x, y, chroma * w))

static func haze(f: CFrame, cx: float, cy: float, r: float, t: float, amp: float, sy: float = 1.0) -> void:
    if amp <= 0.05:
        return
    f.disc(cx, cy, r, func(x: int, y: int, d: float) -> void:
        var k := amp * (1.0 - d)
        f.D(x, y, (CMath.noise3(float(x) * 0.15, float(y) * 0.3 + t * 3.0, t) - 0.5) * k * 2.0, (CMath.noise3(float(x) * 0.2 + 9.0, float(y) * 0.15 - t * 4.0, t) - 0.5) * k * 2.0), sy)

static func rand_poly(rng: CMath.CRng, n: int, r: float, irr: float = 0.4) -> Array:
    var pts: Array = []
    for i in range(n):
        var a := float(i) / float(n) * CMath.TAU + rng.r(-0.2, 0.2)
        var rr := r * (1.0 - irr / 2.0 + rng.next() * irr)
        pts.append(Vector2(cos(a) * rr, sin(a) * rr))
    return pts

static func xform(pts: Array, x: float, y: float, rot: float, s: float = 1.0, sy: float = 1.0) -> Array:
    var c := cos(rot)
    var si := sin(rot)
    var out: Array = []
    for p in pts:
        out.append(Vector2(x + (p.x * c - p.y * si) * s, y + (p.x * si + p.y * c) * s * sy))
    return out

static func pip(pts: Array, x: float, y: float) -> bool:
    var c := false
    var j := pts.size() - 1
    for i in range(pts.size()):
        var a: Vector2 = pts[i]
        var b: Vector2 = pts[j]
        if (a.y > y) != (b.y > y) and x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x:
            c = not c
        j = i
    return c

static func seg_intersect(a: Vector2, b: Vector2, c: Vector2, d: Vector2) -> Variant:
    var r := Vector2(b.x - a.x, b.y - a.y)
    var s := Vector2(d.x - c.x, d.y - c.y)
    var den := r.x * s.y - r.y * s.x
    if absf(den) < 1e-6:
        return null
    var t := ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den
    var u := ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den
    if t >= 0.0 and t <= 1.0 and u >= 0.0 and u <= 1.0:
        return Vector2(a.x + r.x * t, a.y + r.y * t)
    return null

class Spine:
    extends RefCounted
    var hist: Array = []
    func push(p: Vector2) -> void:
        hist.push_front(Vector2(p))
        if hist.size() > 1200:
            hist.pop_back()
    func sample(n: int, spacing: float) -> Array:
        var out: Array = []
        if hist.is_empty():
            return out
        out.append(hist[0])
        var acc := 0.0
        var j := 0
        for i in range(1, n):
            var want := float(i) * spacing
            var placed := false
            while j < hist.size() - 1:
                var a: Vector2 = hist[j]
                var b: Vector2 = hist[j + 1]
                var l := (b - a).length()
                if acc + l >= want:
                    var u := (want - acc) / l if l != 0.0 else 0.0
                    out.append(a.lerp(b, u))
                    placed = true
                    break
                acc += l
                j += 1
            if not placed:
                out.append(hist[hist.size() - 1])
        return out
