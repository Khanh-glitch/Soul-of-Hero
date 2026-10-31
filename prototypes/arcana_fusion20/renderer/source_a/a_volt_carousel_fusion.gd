## #11 selected fusion candidate: original A seeded rotor rings, timing,
## synchronization and fragments, with C #09 bolt-tree geometry replacing A
## bridge/flash bolt generators. Not source-composite or owner approval.
extends RefCounted
class_name AVoltCarouselFusion

const DURATION := 7.2
const C := Vector2(232, 124)
const SYNC := 5.3
const CORE := Vector3(3.2, 3.4, 3.6)
var rng: AMath.ARng
var rings: Array = []
var frags: ADraw.APool

func setup() -> void:
    rng = AMath.ARng.new(0xc0de)
    rings.clear()
    frags = ADraw.APool.new()
    for i in range(6):
        rings.append({"r": 18.0 + i * 13.0 + rng.rangef(-4, 4), "squash": rng.rangef(1.1, 2.6),
            "tilt": rng.angle(), "sp": rng.rangef(0.5, 2.2) * (1.0 if i % 2 else -1.0),
            "ph": rng.angle(), "segs": rng.intf(3, 7), "gap": rng.rangef(0.25, 0.6),
            "drift": rng.rangef(-10, 10), "jump": rng.rangef(0, 6)})

func source_seeds() -> PackedInt32Array:
    return PackedInt32Array([0xc0de])

func authored_events() -> Array:
    return [{"t": SYNC, "kind": "rotor_sync_impact", "pos_local": C, "emitted": false},
        {"t": SYNC + 0.4, "kind": "rotor_fracture", "pos_local": C, "emitted": false}]

func _seg_pos(r: Dictionary, k: int, t: float, scale: float) -> Dictionary:
    var angle := float(r.ph) + float(r.sp) * t * (1.0 + 0.4 * sin(t * 0.7 + float(r.jump))) + float(k) / float(r.segs) * AMath.TAU
    var radius := (float(r.r) + sin(t * 0.9 + float(r.jump)) * float(r.drift)) * scale
    var lx := cos(angle) * radius
    var ly := sin(angle) * radius / float(r.squash)
    return {"x": C.x + lx * cos(float(r.tilt)) - ly * sin(float(r.tilt)),
        "y": C.y + lx * sin(float(r.tilt)) + ly * cos(float(r.tilt)), "a": angle, "rr": radius}

func update(dt: float, t: float) -> void:
    if t > SYNC + 0.35 and t < SYNC + 0.6:
        for ring in rings:
            for k in range(int(ring.segs)):
                var p := _seg_pos(ring, k, t, 1.0)
                var angle := atan2(float(p.y) - C.y, float(p.x) - C.x)
                frags.spawn({"x": p.x, "y": p.y, "vx": cos(angle) * 70.0, "vy": sin(angle) * 50.0,
                    "life": 1.6, "a": angle, "av": rng.rangef(-6, 6), "size": rng.rangef(2, 6), "seed": rng.next() * 999.0})
    frags.each(func(p: Dictionary) -> void:
        p.vx = float(p.vx) * exp(-0.9 * dt)
        p.vy = float(p.vy) * exp(-0.9 * dt))
    frags.step(dt)

func _volt(h: float) -> Vector3:
    return ACommon.ramp_step("volt", h, 8.0)

func _bolt(fb: AFramebuffer, x0: float, y0: float, x1: float, y1: float, t: float, seed: float, width: float, k: float, chaos: float) -> void:
    if k <= 0.01: return
    var frame := floori(t * 28.0)
    var tree := CKit.bolt_tree(seed * 131.0 + frame * 7919.0, x0, y0, x1, y1, 1, chaos)
    for branch in tree:
        ADraw.bolt_draw(fb, branch.pts, width * float(branch.w), _volt(0.62), CORE, k * float(branch.w))
    var dx := x1 - x0
    var dy := y1 - y0
    ADraw.glow(fb, (x0 + x1) * 0.5, (y0 + y1) * 0.5, minf(16.0, sqrt(dx * dx + dy * dy) * 0.25), _volt(0.45), 0.07 * k)

func render(fb: AFramebuffer, t: float) -> void:
    var build := AMath.seg(t, 0.15, 1.8)
    var energy := AMath.seg(t, 1.5, SYNC)
    var sync := AMath.seg(t, SYNC, SYNC + 0.55)
    var after := AMath.seg(t, SYNC + 0.4, SYNC + 1.9)
    var scale := AMath.ease_out(build, 2.0) * (1.0 + sync * 0.1) * (1.0 + after * 0.4 if after > 0.0 else 1.0)
    var vis := 1.0 - AMath.cl01(after * 1.6)
    if vis > 0.0:
        for ri in range(rings.size()):
            var ring: Dictionary = rings[ri]
            var growth := AMath.cl01((build - ri * 0.08) * 1.6)
            if growth <= 0.0: continue
            for k in range(int(ring.segs)):
                var p := _seg_pos(ring, k, t, scale)
                var span := (1.0 - float(ring.gap)) / float(ring.segs) * AMath.TAU
                var steps := maxi(5, ceili(float(p.rr) * span))
                var px := 0.0
                var py := 0.0
                for s in range(steps + 1):
                    var aa := float(p.a) + (float(s) / float(steps) - 0.5) * span
                    var lx := cos(aa) * float(p.rr)
                    var ly := sin(aa) * float(p.rr) / float(ring.squash)
                    var x := C.x + lx * cos(float(ring.tilt)) - ly * sin(float(ring.tilt))
                    var y := C.y + lx * sin(float(ring.tilt)) + ly * cos(float(ring.tilt))
                    if s > 0:
                        var color := _volt(0.45 + 0.3 * sin(s * 0.7 - t * 9.0 + ri) + energy * 0.2 + sync * 0.3)
                        var burn := 1.0 - sync * 0.6
                        ADraw.streak(fb, px, py, x, y, 1.4 + sync * 0.6, 1.4 + sync * 0.6, color, (0.4 + energy * 0.35) * growth * vis * burn)
                        ADraw.line(fb, px, py, x, y, CORE, 0.45 * growth * vis * burn)
                    px = x
                    py = y
                ADraw.glow(fb, float(p.x), float(p.y), 4.0 + sync * 3.0, _volt(0.7), (0.3 + energy * 0.3) * growth * vis)
        var all: Array = []
        for ri in range(rings.size()):
            if AMath.cl01((build - ri * 0.08) * 1.6) <= 0.0: continue
            var ring: Dictionary = rings[ri]
            for k in range(int(ring.segs)):
                var p := _seg_pos(ring, k, t, scale)
                all.append({"x": p.x, "y": p.y, "ri": ri})
        var threshold := 70.0 if sync > 0.0 else 26.0 + energy * 24.0
        var bi := 0
        for i in range(all.size()):
            for j in range(i + 1, all.size()):
                if int(all[i].ri) == int(all[j].ri): continue
                var dx := float(all[i].x) - float(all[j].x)
                var dy := float(all[i].y) - float(all[j].y)
                var d := sqrt(dx * dx + dy * dy)
                if d > threshold: continue
                var k := sin(AMath.cl01(sync * 1.4) * PI) * 0.8 if sync > 0.0 else AMath.cl01(1.0 - d / threshold) * (0.4 + energy)
                _bolt(fb, float(all[i].x), float(all[i].y), float(all[j].x), float(all[j].y), t, bi * 97.0, 1.0, k * vis, 0.22)
                bi += 1
        ADraw.glow(fb, C.x, C.y, 6.0 + energy * 14.0 + sync * 26.0, _volt(0.6), (0.3 + energy * 0.6 + sync * 0.7) * vis)
    if sync > 0.0:
        var intensity := sin(AMath.cl01(sync) * PI)
        ADraw.pulse_ring(fb, C.x, C.y, sync * 280.0, 16.0 * (1.0 - sync), _volt(0.6), (1.0 - sync) * 0.6, 1.3)
        for i in range(12):
            var angle := float(i) / 18.0 * AMath.TAU + sync
            var length := AMath.ease_out(sync, 2.0) * 200.0
            _bolt(fb, C.x, C.y, C.x + cos(angle) * length, C.y + sin(angle) * length / 1.4, t, i * 31.0, 1.1, intensity * 0.7, 0.16)
    frags.each(func(p: Dictionary) -> void:
        var l := float(p.life) / float(p.max)
        var angle := float(p.a) + float(p.av) * (float(p.max) - float(p.life))
        var s := -float(p.size)
        while s <= float(p.size):
            var color := _volt(0.35 + l * 0.35)
            fb.add(float(p.x) + cos(angle) * s, float(p.y) + sin(angle) * s / 1.5, color.x, color.y, color.z, l * 0.45)
            s += 1.0
        if sin(t * 30.0 + float(p.seed)) > 0.75:
            var e := float(p.size)
            _bolt(fb, float(p.x) - cos(angle) * e, float(p.y) - sin(angle) * e / 1.5, float(p.x) + cos(angle) * e, float(p.y) + sin(angle) * e / 1.5, t, float(p.seed), 0.6, l * 0.35, 0.6))
