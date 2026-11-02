## Experimental #09 fusion: the original A ChainVerdict node order, seeded
## probe schedule, 5s cascade and spark simulation, with B's ARC colors and
## C's bolt_pts primitive. Anchors are weak references to real SOH enemies;
## missing/dead actors have no node or contact. No combat authority here.
## This is a source-level integration candidate, not a parity/approval claim:
## actor selection, dynamic frame anchoring, B raster, C thickness, OUT and
## source post still require gameplay and same-tick original comparison.
extends RefCounted
class_name AChainVerdictGraph

const DUR := 7.2
const FINAL := 5.0
const B_CORE := Vector3(2.6, 2.8, 3.4)
const B_MID := Vector3(0.7, 1.1, 3.0)
const B_VIOLET := Vector3(0.5, 0.2, 1.3)
# Preview adaptation: thin, already-authored remembered edges disappear against
# SOH terrain once the live channel subsides. Increase only their B-violet
# radiance; preserve paths, envelope, actor depth, other ink and live C bolts.
# This is not original-A intensity parity or an on-body/hit cue.
const GHOST_WORLD_GAIN := 2.4
const ORDER := [0, 1, 2, 7, 3, 4, 5, 6, 7, 2]
var rng: AMath.ARng
var nodes: Array = [] # nullable Vector2 source-local; node 0 is caster hand
var events: Array = []
var sparks: ADraw.APool
var actor_refs: Array = []
var host: ASourcePlayer
var c_channel := CChainChannel.new()
# Integer raster-window translation only; simulation/events stay in original
# actor-local coordinates. The host applies its inverse to the world pass.
var raster_offset := Vector2.ZERO
var raster_size := Vector2i(AFramebuffer.W, AFramebuffer.H)

func source_raster_size() -> Vector2i:
    # More world-space coverage without magnifying or rescaling the authored
    # source pixels. It is still finite; out-of-window nodes are reported.
    return Vector2i(624, 352)

func setup() -> void:
    rng = AMath.ARng.new(0x9c4a)
    sparks = ADraw.APool.new()
    nodes = [ASourcePlayer.CASTER_LOCAL + Vector2(14, -8), null, null, null, null, null, null, null]
    events.clear()
    var tt := 1.35
    for i in range(ORDER.size() - 1):
        # The TS loop evaluates r.int(1,2) at *each condition*, not once.
        var f := 0
        while f < rng.intf(1, 2):
            events.append({"a": ORDER[i], "b": rng.intf(0, 7), "t0": tt,
                "fail": true, "seed": rng.intf(0, 9999)})
            tt += 0.07
            f += 1
        events.append({"a": ORDER[i], "b": ORDER[i + 1], "t0": tt,
            "fail": false, "seed": rng.intf(0, 9999)})
        tt += rng.rangef(0.22, 0.42)

func source_seeds() -> PackedInt32Array:
    return PackedInt32Array([0x9c4a])

func bind_targets(player: ASourcePlayer, target_world: Vector2) -> void:
    host = player
    actor_refs.clear()
    var candidates: Array[Node2D] = []
    for n in player.get_tree().get_nodes_in_group(&"enemies"):
        if n is Node2D and _actor_live(n):
            candidates.append(n)
    candidates.sort_custom(func(a: Node2D, b: Node2D) -> bool:
        var da := a.global_position.distance_squared_to(target_world)
        var db := b.global_position.distance_squared_to(target_world)
        return a.get_instance_id() < b.get_instance_id() if is_equal_approx(da, db) else da < db)
    for i in range(mini(7, candidates.size())):
        actor_refs.append(weakref(candidates[i]))
    _update_anchors()

func _actor_live(actor: Node2D) -> bool:
    if not is_instance_valid(actor) or actor.is_queued_for_deletion() or not actor.is_inside_tree():
        return false
    for property in actor.get_property_list():
        if StringName(property.name) == &"health":
            return float(actor.get("health")) > 0.0
    return true

func _update_anchors() -> void:
    if not is_instance_valid(host):
        return
    for i in range(1, nodes.size()):
        nodes[i] = null
        if i - 1 >= actor_refs.size():
            continue
        var actor := actor_refs[i - 1].get_ref() as Node2D
        if not _actor_live(actor):
            continue
        var sprite := actor.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
        if sprite == null or not sprite.is_visible_in_tree():
            continue
        # Use the current real animated sprite's transformed anchor, never a
        # demo battlefield/synthetic enemy or a baked static source actor.
        var local := (sprite.global_position - host._origin).rotated(-host._rot) / host._scale + ASourcePlayer.CASTER_LOCAL
        nodes[i] = local

func authored_events() -> Array:
    var out: Array = []
    for i in range(events.size()):
        var ev: Dictionary = events[i]
        if not bool(ev.fail):
            out.append({"t": float(ev.t0), "kind": "link_impact", "pos_local": Vector2.ZERO,
                "node_index": int(ev.b), "emitted": false})
    for i in range(9):
        var j := 0
        for ev in events:
            if not bool(ev.fail):
                if j == i:
                    out.append({"t": FINAL + (float(i) * 0.028 + 0.02), "kind": "cascade_contact",
                        "pos_local": Vector2.ZERO, "node_index": int(ev.b), "emitted": false})
                    break
                j += 1
    out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.t) < float(b.t))
    return out

func event_local(ev: Dictionary) -> Variant:
    var i := int(ev.node_index)
    return nodes[i] if i >= 0 and i < nodes.size() else null

static func _window_axis(minimum: float, maximum: float, size: float, margin: float) -> float:
    # Preserve units: no clamping of actors, rescaling, or camera movement.
    # Keep an already-fitting source window stable; center only when needed.
    var low := margin - minimum
    var high := size - margin - maximum
    if low <= high:
        return round(clampf(0.0, low, high))
    return round((size - minimum - maximum) * 0.5)

func source_raster_offset() -> Vector2:
    var found := false
    var lo := Vector2.ZERO
    var hi := Vector2.ZERO
    for value in nodes:
        if value == null: continue
        var p: Vector2 = value
        if not found:
            lo = p
            hi = p
            found = true
        else:
            lo = lo.min(p)
            hi = hi.max(p)
    if not found: return Vector2.ZERO
    # Room for authored channel branches and node glows where possible. If
    # actor span exceeds a frame, a translated window alone cannot fix it.
    return Vector2(_window_axis(lo.x, hi.x, float(raster_size.x), 32.0),
        _window_axis(lo.y, hi.y, float(raster_size.y), 32.0))

func source_raster_uncontained_nodes() -> int:
    var count := 0
    for value in nodes:
        if value == null: continue
        var point: Vector2 = value + raster_offset
        if point.x < 0.0 or point.y < 0.0 or point.x >= raster_size.x or point.y >= raster_size.y:
            count += 1
    return count

func _spawn_sparks(at: Vector2, count: int, lo: float, hi: float, life_lo: float, life_hi: float) -> void:
    for i in range(count):
        var a := rng.angle()
        var sp := rng.rangef(lo, hi)
        sparks.spawn({"x": at.x, "y": at.y, "vx": cos(a) * sp,
            "vy": sin(a) * sp * 0.6, "life": rng.rangef(life_lo, life_hi), "seed": rng.next() * 99.0})

func update(dt: float, t: float) -> void:
    _update_anchors()
    for ev in events:
        var target: Variant = nodes[int(ev.b)]
        if not bool(ev.fail) and target != null and t > float(ev.t0) and t < float(ev.t0) + 0.1:
            _spawn_sparks(target, 10, 30, 150, 0.15, 0.6)
    if t > FINAL and t < FINAL + 0.8 and rng.next() < 0.9:
        var n: Variant = nodes[rng.intf(0, nodes.size() - 1)]
        if n != null:
            _spawn_sparks(n, 6, 60, 260, 0.2, 0.9)
    sparks.each(func(p: Dictionary) -> void: p.vy = float(p.vy) + 60.0 * dt)
    sparks.step(dt, 2.4)

# C #09 channel generator adapted to A's live actor graph: C's three
# time-slotted variants and deterministic branch placement stay in charge of
# geometry; B owns colors. Recompute endpoints as real actors move. This is
# still a candidate, not full C raster/slot-source parity.
func _bolt(fb: AFramebuffer, a: Vector2, b: Vector2, t: float, seed: int, width: float, k: float, rough: float, branch_count: int = 5, glow_k: float = -1.0) -> void:
    c_channel.draw(fb, a, b, t, float(seed), k, B_CORE, B_MID, width, rough, branch_count)
    ADraw.glow(fb, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5, minf(16.0, a.distance_to(b) * 0.25), B_MID, 0.07 * (k if glow_k < 0.0 else glow_k))

# The faint cascade remnants are A's authored fixed-amplitude boltPath,
# not a live C channel. C's recursive relative roughness is not interchangeable:
# 20 / a short actor distance can exceed one and recursively explode into a
# screen-sized web. Keep C's branching builder on the actual live discharges.
static func _dissolve_path(a: Vector2, b: Vector2, seed: int) -> Array:
    return ADraw.bolt_path(a.x, a.y, b.x, b.y, 20.0, seed, 4)

# A's remembered successful paths also have a fixed four-subdivision
# boltPath, with an initial amplitude proportional to endpoint separation.
# C's recursively relative bolt_pts produces a different shape/subdivision
# count. Keep C's channel exclusively for the live branched discharges.
static func _ghost_path(a: Vector2, b: Vector2, seed: int) -> Array:
    return ADraw.bolt_path(a.x, a.y, b.x, b.y, a.distance_to(b) * 0.3, seed, 4)

func render(fb: AFramebuffer, t: float) -> void:
    # Translate only raster inputs, never simulation, event or actor state.
    # Integer translation keeps source pixel-grid sampling unchanged.
    var original_nodes := nodes
    nodes = []
    for value in original_nodes:
        if value == null:
            nodes.append(null)
        else:
            var point: Vector2 = value
            nodes.append(point + raster_offset)
    var final := AMath.seg(t, FINAL, FINAL + 1.0)
    for i in range(nodes.size()):
        if nodes[i] == null: continue
        var n: Vector2 = nodes[i]
        var armed := i == 0
        for ev in events:
            if not bool(ev.fail) and int(ev.b) == i and t > float(ev.t0): armed = true
        var base := 0.8 if armed else 0.35 * AMath.smoothstep(0.1, 1.2, t)
        var r := AMath.ARng.new(floori(t * 20.0) + i * 13)
        for j in range(3):
            var angle := r.angle()
            var length := r.rangef(3, 11) * base
            _bolt(fb, n, n + Vector2(cos(angle), sin(angle)) * length, t, r.intf(0, 999), 0.9, base * 0.8, 0.6, 1)
        ADraw.glow(fb, n.x, n.y, 4 + base * 5, B_MID, 0.2 + base * 0.3)
        fb.add(n.x, n.y, B_CORE.x, B_CORE.y, B_CORE.z, 0.5 * base)
    var success_index := 0
    for ev in events:
        var a: Variant = nodes[int(ev.a)]
        var b: Variant = nodes[int(ev.b)]
        var fail := bool(ev.fail)
        var age := t - float(ev.t0)
        var seed := int(ev.seed)
        if a == null or b == null:
            if not fail: success_index += 1
            continue
        if not fail and age >= 0.0:
            var ghost := maxf(0.0, 0.22 - age * 0.02)
            if ghost > 0.01:
                var path := _ghost_path(a, b, seed)
                for j in range(path.size() - 1):
                    var p: Vector2 = path[j]
                    var q: Vector2 = path[j + 1]
                    ADraw.line(fb, p.x, p.y, q.x, q.y, B_VIOLET, ghost * GHOST_WORLD_GAIN * (0.7 + 0.3 * sin(t * 9 + j)))
        if fail and age >= 0 and age <= 0.16:
            var u := 1.0 - age / 0.16
            _bolt(fb, a, a.lerp(b, 0.45 * u), t, seed, 0.9, u * 0.55, 0.45, 3)
        elif not fail and age >= 0 and age <= 0.26:
            # A owns this 0.26 s success window and actor/event graph. Use
            # the original C #09 channel's discharge energy on its C ribbon;
            # retain A's own envelope for the separate impact glow/flash.
            # B's elected HDR core/halo colors are still applied unchanged.
            var k := pow(1.0 - age / 0.26, 1.5)
            var discharge := 2.6 * exp(-age * 7.0) + 0.5 * CMath.hash1(seed * 97 + floori(t * 30.0))
            if seed % 3 == 0:
                var mid: Vector2 = (a + b) * 0.5
                var normal := Vector2(-(b.y - a.y) * 0.3, (b.x - a.x) * 0.3)
                _bolt(fb, a, mid + normal, t, seed, 1.4, discharge, 0.2, 5, k)
                _bolt(fb, mid + normal, b, t, seed + 1, 1.4, discharge, 0.2, 5, k)
                _bolt(fb, a, mid - normal, t, seed + 2, 1.2, discharge * 0.8, 0.2, 5, k * 0.8)
                _bolt(fb, mid - normal, b, t, seed + 3, 1.2, discharge * 0.8, 0.2, 5, k * 0.8)
            else:
                _bolt(fb, a, b, t, seed, 1.6, discharge, 0.32, 5, k)
            ADraw.glow(fb, b.x, b.y, 14 * k, B_MID, k)
            fb.flash.z += 0.05 * k
        if not fail:
            var u := (final - success_index * 0.028) / 0.1
            if final > 0 and final < 1 and u >= 0 and u <= 1:
                _bolt(fb, a, b, t, seed, 2.2, sin(u * PI) * 1.4, 0.18)
            success_index += 1
    if final > 0 and final < 1:
        var web := sin(AMath.cl01(final * 1.3) * PI)
        fb.flash.z += 0.3 * web * web
        fb.flash.x += 0.1 * web * web
        for node in nodes:
            if node != null: ADraw.glow(fb, node.x, node.y, 8 + web * 10, B_MID, web * 0.55)
        if final > 0.55:
            var dissolve := AMath.seg(t, FINAL + 0.55, FINAL + 1.6)
            for ev in events:
                if bool(ev.fail): continue
                var a: Variant = nodes[int(ev.a)]
                var b: Variant = nodes[int(ev.b)]
                if a == null or b == null: continue
                var path := _dissolve_path(a, b, int(ev.seed))
                for j in range(path.size() - 1):
                    if AMath.hash2(float(ev.seed), j) > dissolve:
                        var p: Vector2 = path[j]
                        var q: Vector2 = path[j + 1]
                        ADraw.line(fb, p.x, p.y, q.x, q.y, B_MID, (1.0 - dissolve) * 0.5)
    sparks.each(func(p: Dictionary) -> void:
        var life := float(p.life) / float(p.max)
        fb.add(float(p.x) + raster_offset.x, float(p.y) + raster_offset.y, B_MID.x, B_MID.y, B_MID.z, life)
        fb.add(float(p.px) + raster_offset.x, float(p.py) + raster_offset.y, B_MID.x, B_MID.y, B_MID.z, life * 0.4))
    nodes = original_nodes
