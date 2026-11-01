## #11 selected fusion candidate: original A seeded rotor rings, timing,
## synchronization and fragments. C #09 channels replace six stable selected
## bridge bolts; other A bolts retain their source algorithm. This adapts C's
## six successful channels to A's moving graph, not source-composite or approval.
extends RefCounted
class_name AVoltCarouselFusion

const DURATION := 7.2
const C := Vector2(232, 124)
const SYNC := 5.3
const CORE := Vector3(3.2, 3.4, 3.6)
# Original C #09 defines six successful channels; this is a count-based
# assignment to A connectors, not the original C channel schedule/composite.
const C_SELECTED_CHANNELS := 6
var rng: AMath.ARng
var rings: Array = []
var frags: ADraw.APool
# Test-only isolation of A rotor/aftermath from intentionally replaced bolts.
var include_bolts := true
# Isolated source-reference tests can disable C replacement; never exposed in
# the creator preview and not a replacement for reviewing the fusion.
var include_c_role := true
var c_channel := CChainChannel.new()

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

# Stable source-seed ranking; the original six-channel C count bounds how
# many A bridges receive a C variant. This does not copy C's own event times.
static func _selected_c_bridge_seeds(bridges: Array[Dictionary]) -> Dictionary:
    var ranked := bridges.duplicate()
    ranked.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
        return float(a.rank) < float(b.rank) if a.rank != b.rank else float(a.seed) < float(b.seed))
    var selected := {}
    for i in range(mini(C_SELECTED_CHANNELS, ranked.size())):
        selected[ranked[i].seed] = true
    return selected

func _bolt(fb: AFramebuffer, x0: float, y0: float, x1: float, y1: float, t: float, seed: float, width: float, k: float, chaos: float, use_c: bool = false) -> void:
    if not include_bolts or k <= 0.01: return
    var a := Vector2(x0, y0)
    var b := Vector2(x1, y1)
    var distance := a.distance_to(b)
    if use_c:
        # C's five-branch successful channel on this moving A connector.
        # A still supplies the endpoint, time envelope, color and width.
        c_channel.draw(fb, a, b, t, seed * 131.0, k, CORE, _volt(0.62), width, 0.32, 5)
    else:
        # Unmodified A tempest bolt algorithm for the remaining A connectors.
        var slot := floori(t * 28.0)
        var pts := ADraw.bolt_path(x0, y0, x1, y1, distance * chaos, int(seed * 131.0) + slot * 7919, 5)
        ADraw.bolt_draw(fb, pts, width, _volt(0.62), CORE, k)
        var r := AMath.ARng.new(int(seed * 31.0) + slot)
        var count := maxi(1, floori(distance / 40.0))
        for i in range(count):
            var p: Vector2 = pts[r.intf(3, pts.size() - 3)]
            var angle := r.angle()
            var length := distance * r.rangef(0.07, 0.24)
            var sub := ADraw.bolt_path(p.x, p.y, p.x + cos(angle) * length, p.y + sin(angle) * length, length * 0.5, r.intf(0, 9999), 3)
            ADraw.bolt_draw(fb, sub, width * 0.55, _volt(0.5), _volt(0.92), k * 0.6)
    ADraw.glow(fb, (x0 + x1) * 0.5, (y0 + y1) * 0.5, minf(16.0, distance * 0.25), _volt(0.45), 0.07 * k)

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
        var bridges: Array[Dictionary] = []
        for i in range(all.size()):
            for j in range(i + 1, all.size()):
                if int(all[i].ri) == int(all[j].ri): continue
                var dx := float(all[i].x) - float(all[j].x)
                var dy := float(all[i].y) - float(all[j].y)
                var d := sqrt(dx * dx + dy * dy)
                if d > threshold: continue
                var k := sin(AMath.cl01(sync * 1.4) * PI) * 0.8 if sync > 0.0 else AMath.cl01(1.0 - d / threshold) * (0.4 + energy)
                bridges.append({"a": Vector2(all[i].x, all[i].y), "b": Vector2(all[j].x, all[j].y),
                    "k": k * vis, "seed": bi * 97.0, "rank": CMath.hash1(bi * 97 * 131)})
                bi += 1
        # C #09 authored six successful paths, not hundreds. Select at most
        # six moving A connectors deterministically; preserve every other A
        # connector with its original A bolt, rather than suppressing it.
        var c_seeds := _selected_c_bridge_seeds(bridges) if include_c_role else {}
        for bridge in bridges:
            var a: Vector2 = bridge.a
            var b: Vector2 = bridge.b
            _bolt(fb, a.x, a.y, b.x, b.y, t, float(bridge.seed), 1.0, float(bridge.k), 0.22, c_seeds.has(bridge.seed))
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
