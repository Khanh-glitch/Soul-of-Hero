## Source-field regression, not live-world visual/combat acceptance.
extends SceneTree

const STEP := 1.0 / 60.0
var failures: Array[String] = []
var received: Dictionary = {}

func check(ok: bool, name: String) -> void:
    if not ok:
        failures.append(name)
        print("::error::SOURCE_PASS_FAIL ", name)

func _init() -> void:
    call_deferred("_run")

func _run() -> void:
    var c := CFrame.new()
    c.track_world_fragments = true
    c.G(2, 2, 0.0, 0.0, 0.0, 0.5)
    c.I(3, 2, 0.0, 0.0, 0.0, 0.5)
    c.L(4, 2, -0.5, 0.1, 0.0)
    c.D(5, 2, 3.0, -2.0)
    c.S(5, 2, 0.4)
    c.C(5, 2, 2.0)
    c.blit_world_fragment(10, 20, 2, 2, 30, 40)
    c.I(30, 40, 0.8, 0.0, 0.0, 0.25)
    check(is_equal_approx(c.ground_coverage[2 * CFrame.W + 2], 0.5), "C black ground coverage")
    check(is_equal_approx(c.ink[(2 * CFrame.W + 3) * 4 + 3], 0.5), "C black ink coverage")
    check(c.light[(2 * CFrame.W + 4) * 4] < 0.0, "C negative HDR light retained")
    var di := (2 * CFrame.W + 5) * 4
    check(c.disp[di] == 3.0 and c.disp[di + 1] == -2.0 and is_equal_approx(c.disp[di + 2], 0.4) and c.disp[di + 3] == 2.0, "C displacement shade chroma")
    var fi := (40 * CFrame.W + 30) * 4
    check(c.world_fragment[fi] == 10.0 and c.world_fragment[fi + 1] == 20.0 and is_equal_approx(c.world_fragment[fi + 2], 0.75), "C live fragment coordinates and subsequent ink")
    check(is_equal_approx(c.ink[fi + 3], 0.25), "C overdraw on live fragment")
    check(c.world_influence[40 * CFrame.W + 30] == 1 and c.world_influence[0] == 0, "C explicit authored influence")
    c.clear()
    check(c.world_fragment[fi + 2] == 0.0 and c.ground_coverage[2 * CFrame.W + 2] == 0.0, "C world fields clear")

    var b := BRenderer.new()
    b.track_world_coverage = true
    b.begin()
    b.plot(10, 10, 0.0, 0.0, 0.0, BRenderer.SET, 1.0)
    b.plot(11, 10, 0.4, 0.3, 0.2, BRenderer.ADD, 1.0)
    b.decal(12, 10, Vector3.ZERO, 0.5)
    check(b.ink_coverage[10 * BRenderer.W + 10] == 1.0, "B black SET coverage")
    check(b.ink_coverage[10 * BRenderer.W + 11] == 0.0, "B additive emission does not erase scene")
    check(is_equal_approx(b.decal_coverage[10 * BRenderer.W + 12], 0.5), "B black decal coverage")
    b.warp(11, 10, 11, 10, func(_x: int, _y: int) -> Array: return [10, 10])
    check(b.ink_coverage[10 * BRenderer.W + 11] == 1.0, "B warp transports explicit coverage")
    var wi := (10 * BRenderer.W + 11) * 2
    check(b.world_warp[wi] == -1.0 and b.world_warp[wi + 1] == 0.0, "B warp maps actual world sampling")
    check(b.world_influence[10 * BRenderer.W + 11] == 1 and b.world_influence[0] == 0, "B explicit authored influence")
    b.begin()
    check(b.ink_coverage[10 * BRenderer.W + 11] == 0.0 and b.world_warp[wi] == 0.0, "B world fields clear")

    # Exact JS Number + signed bitwise hash results, generated from the
    # original engine/math.ts expression, not tuned image thresholds.
    check(int(AMath.hash2(1, 2) * 4294967296.0) == 502195985, "A hash2 JS signed/float 1,2")
    check(int(AMath.hash2(-5, 9) * 4294967296.0) == 626332117, "A hash2 JS signed/float -5,9")
    check(int(AMath.hash2(10, 20) * 4294967296.0) == 1032709357, "A hash2 JS signed/float 10,20")
    var hash_large := AMath.hash2(9000, 1244)
    var debug_h := AMath._signed32(int(9000.0 * 374761393.0 + 1244.0 * 668265263.0))
    var debug_mix := debug_h ^ (debug_h >> 13)
    var debug_product := AMath._signed32(int(float(debug_mix) * 1274126177.0))
    check(int(hash_large * 4294967296.0) == 38368201, "A hash2 JS signed/float 9000,1244 actual=%.17f h=%d mix=%d product=%d" % [hash_large, debug_h, debug_mix, debug_product])
    check(int(AMath.hash3(1, 2, 3) * 4294967296.0) == 1285237403, "A hash3 JS signed/float 1,2,3")
    check(int(AMath.hash3(-3, 9, -4) * 4294967296.0) == 2007782188, "A hash3 JS signed/float -3,9,-4")

    var bloom_lead := AAbyssalBloomLead.new()
    bloom_lead.setup()
    check(bloom_lead.petals.size() == 7 and bloom_lead.inner.size() == 7 and bloom_lead.bubbles.size() == 46, "A05 original seeded opening structures")
    check(absf(float(bloom_lead.petals[0].len) - 71.08114593848586) < 0.00001, "A05 original seed sequence")
    var bloom_fb := AFramebuffer.new()
    bloom_fb.track_world_fields = true
    bloom_fb.clear()
    bloom_lead.render(bloom_fb, 1.5)
    var marked := 0
    for value in bloom_fb.world_influence:
        marked += int(value)
    check(marked > 0, "A05 selected opening writes source-operation footprint")

    var bloom_late := CAbyssalBloomLate.new()
    bloom_late.setup()
    check(bloom_late.pets.size() == 24, "C05 source petal input to eruption")
    for tick in range(1, 361): bloom_late.update(STEP, float(tick) * STEP)
    check(bloom_late.erupted and bloom_late.particles.size() > 0, "C05 column eruption spawns original gravity particles")
    var late_frame := CFrame.new()
    late_frame.track_world_fragments = true
    late_frame.clear()
    bloom_late.render(late_frame, 6.0)
    var late_marked := 0
    for value in late_frame.world_influence: late_marked += int(value)
    check(late_marked > 0, "C05 late source column/pool fields")

    var graph := AChainVerdictGraph.new()
    graph.setup()
    check(graph.events.size() == 23, "A09 original graph seeded probe count")
    check(int(graph.events[0].a) == 0 and int(graph.events[0].b) == 6 and int(graph.events[0].seed) == 990, "A09 original first probe seed and endpoints")
    check(int(graph.events[2].b) == 1 and not bool(graph.events[2].fail) and is_equal_approx(float(graph.events[2].t0), 1.49), "A09 first success ordering and time")
    check(graph.event_local({"node_index": 1}) == null, "A09 absent real target has no contact anchor")

    var a := AFramebuffer.new()
    a.track_world_fields = true
    a.clear()
    a.blend(9, 9, 0.0, 0.0, 0.0, 0.5)
    a.add_px(10, 9, 0.8, 0.2, 0.1, 1.0)
    a.mul(11, 9, 0.3)
    check(is_equal_approx(a.world_coverage[9 * AFramebuffer.W + 9], 0.5), "A dark blend coverage")
    check(a.world_coverage[9 * AFramebuffer.W + 10] == 0.0 and a.world_influence[9 * AFramebuffer.W + 10] == 1, "A emissive footprint without keyed alpha")
    check(is_equal_approx(a.world_multiplier[9 * AFramebuffer.W + 11], 0.3), "A multiplier field")
    a.clear()
    check(a.world_influence[9 * AFramebuffer.W + 9] == 0 and a.world_multiplier[9 * AFramebuffer.W + 11] == 1.0, "A world fields clear")
    ADraw.field(a, 20, 20, 21, 21, func(_x: int, _y: int, _out: Array) -> void: pass)
    check(a.world_influence[20 * AFramebuffer.W + 20] == 1, "A direct field records operation bounds without RGB key")
    ADraw.field_mul(a, 30, 30, 30, 30, func(_x: int, _y: int) -> float: return 0.5)
    check(is_equal_approx(a.world_multiplier[30 * AFramebuffer.W + 30], 0.5), "A direct field multiplier affects real world")
    ACommon.heat_shimmer(a, 80, 80, 20, 0.25, 20)
    var warp_count := 0
    for v in a.world_warp:
        if v != 0.0: warp_count += 1
    check(warp_count > 0 and a.world_influence[80 * AFramebuffer.W + 80] == 1, "A authored shimmer records live-world coordinate displacement")

    var d := DFx.new()
    d.track_world_fields = true
    d.clear()
    d._add_px(4, 4, 0.0, 0.0, 0.0)
    d.bend(10.0, 11.0, 12.0, 1.0, -2.0, 0.5, 0.8)
    check(d.world_influence[4 * DFx.W + 4] == 1, "D authored additive operation footprint")
    check(d.world_bends.size() == 1 and float(d.world_bends[0].chroma) == 0.8, "D authored bend parameters retained")
    var warp_index := (11 * DFx.W + 10) * 4
    var warp_before := float(d.world_warp[warp_index + 3])
    check(warp_before > 0.0 and d.world_warp_influence[11 * DFx.W + 10] == 1, "D original warp shader falloff records field")
    d.clear()
    check(d.world_bends.is_empty() and d.world_influence[4 * DFx.W + 4] == 0, "D per-frame world light fields clear")
    check(is_equal_approx(float(d.world_warp[warp_index + 3]), warp_before * exp(-3.4 / 60.0)) and d.world_warp_influence[11 * DFx.W + 10] == 1, "D persistent warp decays by original 60Hz ping-pong factor")

    var host := Arcana20Renderer.new()
    host.world_pass_mode = true
    root.add_child(host)
    host.source_pass_ready.connect(func(id: StringName, frame: Arcana20SourcePassFrame) -> void:
        received[id] = frame)
    var caster := Vector2(201, 301)
    var target := Vector2(351, 281)
    for num in [2, 10, 17]:
        var id := Arcana20SourceCatalog.canonical_id(num)
        check(host.cast_skill(id, caster, target), "cast world producer %d" % num)
        var node: Node = host._casts[id]
        node.set_process(false)
        var sprite: Sprite2D
        if node is CSourcePlayer:
            var cp := node as CSourcePlayer
            cp.render_enabled = false
            for tick in range(180):
                cp.advance(1.0 / 60.0, false)
            cp.render_enabled = true
            cp._render_frame()
            sprite = cp._sprite
        else:
            var bp := node as BSourcePlayer
            bp.advance(3.0)
            bp._render_frame()
            sprite = bp._sprite
        var frame: Arcana20SourcePassFrame = received.get(id)
        check(frame != null, "source fields forwarded %d" % num)
        if frame != null:
            var original_caster := Vector2(104, 132) if num == 2 else Vector2(112, 126)
            check((frame.source_to_world * original_caster).distance_to(caster) < 0.001, "world caster transform %d" % num)
            var world_point: Vector2 = frame.source_to_world * Vector2(192, 108)
            var camera_before := Transform2D(0.0, Vector2.ZERO)
            var camera_after := Transform2D(0.0, Vector2(-40, -20))
            check((camera_after * world_point - camera_before * world_point).distance_to(Vector2(-40, -20)) < 0.001, "camera transform math %d" % num)
            check(not sprite.visible, "legacy quad suppressed %d" % num)
        host.cancel_skill(id)
        received.erase(id)
    host.free()

    # Every current source-family candidate can publish a world-field frame
    # without showing its unsafe legacy sprite. This does not certify original
    # fusion components, native compositor availability, or visual acceptance.
    var all_host := Arcana20Renderer.new()
    all_host.world_pass_mode = true
    root.add_child(all_host)
    var families: Dictionary = {}
    all_host.source_pass_ready.connect(func(id: StringName, frame: Arcana20SourcePassFrame) -> void:
        var list: Array = families.get(id, [])
        list.append(frame.family)
        families[id] = list)
    for num in range(1, 21):
        var id := Arcana20SourceCatalog.canonical_id(num)
        check(all_host.cast_skill(id, Vector2(200, 300), Vector2(340, 300)), "all-world cast %d" % num)
        var node: Node = all_host._casts[id]
        node.set_process(false)
        if node is FusionPlayer:
            var fusion := node as FusionPlayer
            fusion.advance(STEP)
            for part in fusion._pending:
                var part_node: Node = part.node
                var sprite := part_node.get("_sprite") as Sprite2D
                check(sprite != null and not sprite.visible, "fusion legacy sprite suppressed %d" % num)
        elif node is ASourcePlayer:
            var ap := node as ASourcePlayer
            ap._render_frame()
            check(not ap._sprite.visible, "A legacy sprite suppressed %d" % num)
        elif node is BSourcePlayer:
            var bp := node as BSourcePlayer
            bp._render_frame()
            check(not bp._sprite.visible, "B legacy sprite suppressed %d" % num)
        elif node is CSourcePlayer:
            var cp := node as CSourcePlayer
            cp._render_frame()
            check(not cp._sprite.visible, "C legacy sprite suppressed %d" % num)
        elif node is DSourcePlayer:
            var dp := node as DSourcePlayer
            dp._render_frame()
            check(not dp._sprite.visible, "D legacy sprite suppressed %d" % num)
        check(families.has(id), "all-world source frame %d" % num)
        if num == 1 or num == 5:
            check(families.has(id) and (families[id] as Array).has(&"A") and (families[id] as Array).has(&"C"), "fusion publishes both unapproved candidate layers %d" % num)
        all_host.cancel_skill(id)
    all_host.free()
    print("ARCANA20_SOURCE_PASS_RESULT ", "PASS" if failures.is_empty() else "FAIL", " ", JSON.stringify(failures))
    quit(0 if failures.is_empty() else 1)
