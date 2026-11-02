## Source-field regression, not live-world visual/combat acceptance.
extends SceneTree

const STEP := 1.0 / 60.0
var failures: Array[String] = []
var received: Dictionary = {}

func check(ok: bool, name: String) -> void:
    if not ok:
        failures.append(name)
        print("::error::SOURCE_PASS_FAIL ", name)

# Previous exact 16-bit-split imul, retained solely as an independent
# regression oracle for the signed-int64 implementation.
func split_imul(a: int, b: int) -> int:
    var ua := a & 0xFFFFFFFF
    var ub := b & 0xFFFFFFFF
    var al := ua & 0xFFFF
    var ah := (ua >> 16) & 0xFFFF
    var bl := ub & 0xFFFF
    var bh := (ub >> 16) & 0xFFFF
    var result := (al * bl + (((ah * bl + al * bh) & 0xFFFF) << 16)) & 0xFFFFFFFF
    return result - 0x100000000 if result >= 0x80000000 else result

func _init() -> void:
    call_deferred("_run")

func _run() -> void:
    var edge_values := [0, 1, -1, 0x7FFFFFFF, -0x80000000, 0xFFFFFFFF, 0x100000001, -0x100000001, 0x7FFFFFFFFFFFFFFF]
    for x in edge_values:
        for y in edge_values:
            check(CMath.imul(x, y) == split_imul(x, y), "C imul signed-int64 edge identity")
    for i in range(10000):
        var x := (i * 2654435761) & 0xFFFFFFFF
        var y := ((i + 12289) * 2246822519) & 0xFFFFFFFF
        check(CMath.imul(x, y) == split_imul(x, y), "C imul signed-int64 sampled identity")
    # Regression: a fixed-step counter must report the number of executed
    # updates, not floor(accumulated floating-point time * 60).
    var bclock := BSourcePlayer.new()
    root.add_child(bclock)
    bclock.begin(Vector2.ZERO, Vector2(100, 0))
    bclock.set_process(false)
    var expected_elapsed := 0.0
    for i in range(300):
        bclock.advance(STEP)
        expected_elapsed += STEP
        check(bclock.source_tick == i + 1 and bclock.elapsed == expected_elapsed, "B exact fixed-step source tick without changing source time")
    bclock.stop()
    bclock.begin(Vector2.ZERO, Vector2(100, 0))
    bclock.set_process(false)
    bclock.advance(STEP * 2.0)
    check(bclock.source_tick == 2, "B source tick restarts and counts catch-up steps")
    bclock.stop()
    bclock.free()
    # Exercise the real B producer through the preview post consumer: the
    # source bite flash used to be dropped entirely in the world-pass path.
    # This validates transport/retirement, not linear-HDR visual fidelity.
    var b_post_host := Arcana20Renderer.new()
    b_post_host.world_pass_mode = true
    root.add_child(b_post_host)
    var b_post := Arcana20CViewportPost.new()
    root.add_child(b_post)
    check(b_post.attach(b_post_host), "B viewport-post preview attaches")
    var b_id := Arcana20SourceCatalog.canonical_id(2)
    check(b_post_host.cast_skill(b_id, Vector2(100, 200), Vector2(240, 200)), "B wyrm post source cast")
    var b_player := b_post_host._casts[b_id] as BSourcePlayer
    b_player.set_process(false)
    b_player.advance(5.0)
    b_player._render_frame()
    check(b_player._r.flash > 0.0 and b_post._states.has(b_id), "B authored bite flash reaches viewport consumer")
    if b_post._states.has(b_id):
        var state: Dictionary = b_post._states[b_id]
        var flash_value: Vector3 = state.flash
        check(flash_value.distance_to(b_player._r.flash_col * b_player._r.flash) < 0.00001, "B flash RGB remains source-authored")
        var material_b_flash: Vector3 = b_post._material.get_shader_parameter("b_flash")
        check(material_b_flash.is_equal_approx(flash_value), "B flash reaches its tone-aware shader channel")
        var inverse: Transform2D = state.dither_basis
        var source_map := b_post.get_viewport().get_final_transform() * b_post.get_viewport().canvas_transform * b_player.source_pass_frame().source_to_world
        var probe := Vector2(213.0, 109.0)
        check((inverse * (source_map * probe)).distance_to(probe) < 0.001, "B post dither follows source pixels through camera basis")
        var actual_dither_x: Vector2 = b_post._material.get_shader_parameter("b_dither_x")
        var actual_dither_y: Vector2 = b_post._material.get_shader_parameter("b_dither_y")
        check(actual_dither_x.is_equal_approx(inverse.x), "B post supplies inverse dither x")
        check(actual_dither_y.is_equal_approx(inverse.y), "B post supplies inverse dither y")
        check(b_post._rect.visible, "B authored bite flash is visible")
    # Ordered-quantized flash delta must leave an unrelated LDR world exactly
    # unchanged at F=0 and never darken it for a positive source impulse.
    for level in range(21):
        var ldr := float(level) / 20.0
        for y in range(4):
            for x in range(4):
                var d := BRenderer.bayer(x, y) - 0.5
                var base_q := floorf(clampf(ldr * 20.0 + d, 0.0, 20.0)) / 20.0
                var zero_q := floorf(clampf((1.0 - (1.0 - ldr) * exp(0.0)) * 20.0 + d, 0.0, 20.0)) / 20.0
                var flash_q := floorf(clampf((1.0 - (1.0 - ldr) * exp(-1.05 * 0.7)) * 20.0 + d, 0.0, 20.0)) / 20.0
                check(absf(zero_q - base_q) < 0.00001, "B dither delta has no zero-flash posterization pop")
                check(flash_q + 0.00001 >= base_q, "B positive flash delta never darkens")
    b_post_host.cancel_skill(b_id)
    var retired_b_flash: Vector3 = b_post._material.get_shader_parameter("b_flash")
    check(not b_post._states.has(b_id) and not b_post._rect.visible and retired_b_flash.is_zero_approx(), "B cancel retires viewport flash and shake")
    b_post.detach()
    b_post.free()
    b_post_host.free()
    # F01: C outer tongues must share A's actual crown basis/center rather
    # than independently deriving a visibly different transform. This checks
    # unclamped and clamped ranges at four bearings through the real renderer;
    # it is not a creator visual decision or a source-raster parity claim.
    var crown_host := Arcana20Renderer.new()
    crown_host.world_pass_mode = true
    root.add_child(crown_host)
    var crown_id := Arcana20SourceCatalog.canonical_id(1)
    for range_px in [35.0, 140.0, 900.0]:
        for dir in [Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT, Vector2.UP]:
            var origin := Vector2(1200.0, 800.0)
            check(crown_host.cast_skill(crown_id, origin, origin + dir * range_px), "F01 actual fusion cast")
            var fusion := crown_host._casts[crown_id] as FusionPlayer
            var lead := fusion._front as ASourcePlayer
            var outer := fusion._back as CSourcePlayer
            check(lead != null and outer != null, "F01 A lead and C outer are mounted")
            if lead != null and outer != null:
                check(lead.local_to_world(ACinderCrown.C).distance_to(outer.local_to_world(CCinderCrown.C)) < 0.001, "F01 A/C center shared %s %s" % [range_px, dir])
                check(absf(lead._scale - outer._scale) < 0.00001 and absf(lead._rot - outer._rot) < 0.00001, "F01 A/C rotation and scale shared")
            crown_host.cancel_skill(crown_id)
    # F01 uses a single timeline: A's impact and C's source tongue burst
    # must remain aligned to one 60 Hz step, without a duplicate C impact.
    var crown_events: Array[StringName] = []
    crown_host.visual_event.connect(func(id: StringName, kind: StringName, _pos: Vector2, _time: float) -> void:
        if id == crown_id: crown_events.append(kind))
    check(crown_host.cast_skill(crown_id, Vector2(1200, 800), Vector2(1340, 800)), "F01 shared-clock cast")
    var clocked_crown := crown_host._casts[crown_id] as FusionPlayer
    clocked_crown.set_process(false)
    var clocked_a := clocked_crown._front as ASourcePlayer
    var clocked_c := clocked_crown._back as CSourcePlayer
    clocked_a.render_enabled = false
    clocked_c.render_enabled = false
    for i in range(236): clocked_crown.advance(STEP)
    check(not crown_events.has(&"crown_impact") and not (clocked_c._fx as CCinderCrown)._burst, "F01 source burst not early")
    clocked_crown.advance(STEP)
    check(absf(clocked_a.source_time() - 3.95) <= STEP, "F01 lead reaches authored impact tick")
    clocked_crown.advance(STEP)
    check(crown_events.count(&"crown_impact") == 1, "F01 A crown impact exactly once within one tick")
    check((clocked_c._fx as CCinderCrown)._burst and not crown_events.has(&"crown_burst_impact"), "F01 original C tongue onset within one tick, no duplicate event")
    while clocked_crown.source_time() < 6.65: clocked_crown.advance(STEP)
    var crown_source := clocked_a._spell as ACinderCrown
    check(crown_host.is_active(crown_id) and crown_source._ash.count() > 0, "F01 original ash survives old 6.6s stage cutoff")
    while crown_host.is_active(crown_id): clocked_crown.advance(STEP)
    check(crown_source._ash.count() == 0, "F01 original ash expires before fusion OUT")
    check(not crown_host.is_active(crown_id), "F01 shared clock naturally retires both layers")
    crown_host.free()
    # F01 surface is a parallel semantic record, never a modification of the
    # original additive source or its RNG/timing. Verify only the authored
    # field interior carries coverage, with no ambient/background keying.
    var raw_crown := ACinderCrown.new()
    raw_crown.setup()
    for i in range(126): raw_crown.update(STEP, float(i + 1) * STEP)
    var raw_fb := AFramebuffer.new()
    var semantic_fb := AFramebuffer.new()
    raw_fb.track_world_fields = true
    semantic_fb.track_world_fields = true
    semantic_fb.crown_surface.resize(semantic_fb.width * semantic_fb.height * 4)
    raw_fb.clear()
    semantic_fb.clear()
    raw_crown.render(raw_fb, 2.1)
    raw_crown.render(semantic_fb, 2.1)
    check(raw_fb.buf == semantic_fb.buf and raw_fb.world_coverage == semantic_fb.world_coverage and raw_fb.world_multiplier == semantic_fb.world_multiplier and raw_fb.world_influence == semantic_fb.world_influence, "F01 authored surface record does not modify original A fields")
    var surface_count := 0
    for p in range(semantic_fb.width * semantic_fb.height):
        if semantic_fb.crown_surface[p * 4] > 0.0: surface_count += 1
    check(surface_count > 0 and surface_count < 12000 and semantic_fb.crown_surface[0] == 0.0, "F01 semantic coverage is bounded to authored procedural crown")
    semantic_fb.clear()
    raw_crown.render(semantic_fb, 6.6)
    var late_surface := 0.0
    for p in range(semantic_fb.width * semantic_fb.height): late_surface += semantic_fb.crown_surface[p * 4]
    check(late_surface == 0.0, "F01 authored material clears after the crown stage")
    # B03 meteors use a fixed source sigil centre and screen-up ballistic z,
    # not the B02 caster-target axis. Test the actual mount at four bearings.
    var meteor_mount := BSourcePlayer.new()
    meteor_mount.world_pass_mode = true
    root.add_child(meteor_mount)
    var meteor_origin := Vector2(300, 200)
    var meteor_centre := Vector2(BRenderer.W / 2.0 + 16.0, BRenderer.H / 2.0 + 4.0)
    for delta in [Vector2(140, 0), Vector2(-140, 0), Vector2(0, 140), Vector2(0, -140)]:
        var destination: Vector2 = meteor_origin + delta
        meteor_mount.begin(meteor_origin, destination, "meteor")
        meteor_mount.set_process(false)
        var meteor_frame := meteor_mount.source_pass_frame()
        var basis := meteor_frame.source_to_world
        check((basis * meteor_centre).distance_to(destination) < 0.001, "B03 actual sigil centre pins to target %s" % delta)
        check(basis.x.x > 0.0 and absf(basis.x.y) < 0.0001 and basis.y.y > 0.0 and absf(basis.y.x) < 0.0001, "B03 meteors and gravity remain world-up %s" % delta)
        check(meteor_frame.caster_world == meteor_origin and meteor_frame.target_world == destination, "B03 actual actor metadata retained")
        meteor_mount.stop()
    # B08 likewise has its own fixed vortex centre and vertical droplet z.
    var maw_centre := Vector2(BRenderer.W / 2.0 + 26.0, BRenderer.H / 2.0 + 4.0)
    for delta in [Vector2(140, 0), Vector2(-140, 0), Vector2(0, 140), Vector2(0, -140)]:
        var maw_destination: Vector2 = meteor_origin + delta
        meteor_mount.begin(meteor_origin, maw_destination, "maw")
        meteor_mount.set_process(false)
        var maw_frame := meteor_mount.source_pass_frame()
        var maw_basis := maw_frame.source_to_world
        check((maw_basis * maw_centre).distance_to(maw_destination) < 0.001, "B08 vortex centre stays at target %s" % delta)
        check(maw_basis.x.x > 0.0 and absf(maw_basis.x.y) < 0.0001 and maw_basis.y.y > 0.0 and absf(maw_basis.y.x) < 0.0001, "B08 surge and droplet gravity remain upright %s" % delta)
        check(maw_frame.caster_world == meteor_origin and maw_frame.target_world == maw_destination, "B08 actor metadata retained")
        meteor_mount.stop()
    meteor_mount.free()
    # C07's authored spire height and falling shard z share the screen-up
    # axis. Verify the real renderer mount, not just a manually set flag.
    var ice_host := Arcana20Renderer.new()
    ice_host.world_pass_mode = true
    root.add_child(ice_host)
    var ice_id := Arcana20SourceCatalog.canonical_id(7)
    for delta in [Vector2(140, 0), Vector2(-140, 0), Vector2(0, 140), Vector2(0, -140)]:
        var ice_destination: Vector2 = meteor_origin + delta
        check(ice_host.cast_skill(ice_id, meteor_origin, ice_destination), "C07 real host cast %s" % delta)
        var ice_player := ice_host._casts[ice_id] as CSourcePlayer
        ice_player.set_process(false)
        var ice_frame := ice_player.source_pass_frame()
        var ice_basis := ice_frame.source_to_world
        check((ice_basis * CMirrorfrostBasilica.Q).distance_to(ice_destination) < 0.001, "C07 authored centre stays at target %s" % delta)
        check(ice_basis.x.x > 0.0 and absf(ice_basis.x.y) < 0.0001 and ice_basis.y.y > 0.0 and absf(ice_basis.y.x) < 0.0001, "C07 spires and shard gravity remain upright %s" % delta)
        check(ice_frame.caster_world == meteor_origin and ice_frame.target_world == ice_destination, "C07 actor metadata retained")
        ice_host.cancel_skill(ice_id)
    ice_host.free()
    # Two children of the same source family must retire the shared family
    # only after the final active child; parent cancellation emits no redundant
    # layer-finished event. Exercise actual source nodes, including legacy sprite
    # cleanup, rather than fake stand-ins.
    var fusion_clock := FusionPlayer.new()
    var first_a := ASourcePlayer.new()
    var second_a := ASourcePlayer.new()
    first_a.configure(ACinderCrown.new(), 0.1)
    second_a.configure(ACinderCrown.new(), 0.2)
    var retired: Array[StringName] = []
    fusion_clock.source_layer_finished.connect(func(family: StringName) -> void: retired.append(family))
    fusion_clock.configure([
        {"node": first_a, "layer": -1, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw)},
        {"node": second_a, "layer": 1, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw)},
    ], 1.0)
    root.add_child(fusion_clock)
    fusion_clock.begin(Vector2.ZERO, Vector2(100, 0))
    fusion_clock.set_process(false)
    first_a.render_enabled = false
    second_a.render_enabled = false
    for i in range(6): fusion_clock.advance(STEP)
    check(retired.is_empty() and not first_a._active and second_a._active and not first_a._sprite.visible, "fusion keeps shared family until last child and hides finished legacy sprite")
    for i in range(6): fusion_clock.advance(STEP)
    check(retired == [&"A"] and fusion_clock._active and not second_a._sprite.visible, "fusion retires same family exactly once after last child")
    fusion_clock.stop()
    check(retired == [&"A"], "fusion parent cancellation emits no redundant layer retirement")
    fusion_clock.free()
    var cancelling_fusion := FusionPlayer.new()
    var cancelling_a := ASourcePlayer.new()
    cancelling_a.configure(ACinderCrown.new(), 0.3)
    var cancel_retired: Array[StringName] = []
    cancelling_fusion.source_layer_finished.connect(func(family: StringName) -> void: cancel_retired.append(family))
    cancelling_fusion.configure([{"node": cancelling_a, "layer": 1, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw)}], 0.3)
    root.add_child(cancelling_fusion)
    cancelling_fusion.begin(Vector2.ZERO, Vector2(100, 0))
    cancelling_fusion.stop()
    check(cancel_retired.is_empty(), "fusion cancellation suppresses child retirement signals")
    cancelling_fusion.free()
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
    c.add_live_world_light(25.0, 25.0, 4, 5, 0.75)
    c.add_live_world_light(25.0, 25.0, 8, 9, 1.25)
    var live := c.live_light_fields()
    var live_index: PackedFloat32Array = live.index
    var live_ops: PackedFloat32Array = live.operations
    var live_pixel := (25 * CFrame.W + 25) * 4
    check(int(live.count) == 2 and int(live_index[live_pixel + 1]) == 2 and live_ops[0] == 4.0 and live_ops[4] == 8.0, "C20 A additive live-world samples retain both overlapping source coordinates")
    c.add_live_world_light(26.5, 25.5, 3, 4, 1.0)
    var bilinear := c.live_light_fields()
    check(int(bilinear.count) == 6, "A20 bilinear ground sample writes all four weighted destinations")
    c.ripper_remainder_fragment(30, 41, 32, 41)
    var out_i := (41 * CFrame.W + 30) * 4
    check(c.world_fragment[out_i] == 32.0 and c.world_fragment[out_i + 1] == 41.0 and c.world_fragment[out_i + 2] == 1.0 and c.world_fragment[out_i + 3] == 2.0, "C20 OUT inversion preserves explicit live-world source coordinates and mode")
    c.I(30, 41, 0.0, 0.0, 0.0, 0.25)
    check(is_equal_approx(c.world_fragment[out_i + 2], 0.75) and is_equal_approx(c.ink[out_i + 3], 0.25), "C20 OUT fragment respects black authored ink overdraw")
    c.clear()
    check(c.world_fragment[fi + 2] == 0.0 and c.ground_coverage[2 * CFrame.W + 2] == 0.0 and c.field_activity == 0, "C world fields clear")
    var cframe := Arcana20SourcePassFrame.new()
    cframe.family = &"C"
    cframe.source_size = Vector2i(CFrame.W, CFrame.H)
    cframe.source_to_world = Transform2D.IDENTITY
    cframe.c_ground = c.ground
    cframe.c_ground_coverage = c.ground_coverage
    cframe.c_ink = c.ink
    cframe.c_light = c.light
    cframe.c_disp = c.disp
    cframe.c_world_fragment = c.world_fragment
    cframe.c_influence = c.world_influence
    cframe.c_field_activity = c.field_activity
    var viewer := Arcana20CWorldPass.new()
    root.add_child(viewer)
    viewer.consume(cframe)
    viewer.consume(cframe)
    check(int(viewer.upload_counts.get("ink", 0)) == 1 and int(viewer.upload_counts.get("ground", 0)) == 1 and int(viewer.upload_counts.get("disp", 0)) == 1, "C inactive fields are uploaded only once")
    c.I(3, 3, 0.0, 0.0, 0.0, 0.5)
    check((c.field_activity & CFrame.FIELD_FRAGMENT) == 0, "C black ink on clear fragment does not dirty fragment texture")
    cframe.c_field_activity = c.field_activity
    viewer.consume(cframe)
    check(int(viewer.upload_counts.get("ink", 0)) == 2 and int(viewer.upload_counts.get("ground", 0)) == 1, "C explicit black ink uploads even without RGB brightness")
    c.clear()
    cframe.c_field_activity = c.field_activity
    viewer.consume(cframe)
    viewer.consume(cframe)
    check(int(viewer.upload_counts.get("ink", 0)) == 3, "C active to inactive clears texture once and then reuses it")
    c.inverted_live_fragment(3, 3, 7, 8)
    c.I(3, 3, 0.0, 0.0, 0.0, 0.5)
    check((c.field_activity & CFrame.FIELD_FRAGMENT) != 0 and is_equal_approx(c.world_fragment[(3 * CFrame.W + 3) * 4 + 2], 0.5), "C black overdraw dirties and attenuates authored world fragment")
    c.clear()
    cframe.c_field_activity = -1
    viewer.consume(cframe)
    check(int(viewer.upload_counts.get("ink", 0)) == 4 and int(viewer.upload_counts.get("ground", 0)) == 2, "C unknown source activity uploads conservatively")
    viewer.free()

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

    var outer := CCinderCrown.new()
    outer.setup()
    var outer_frame := CFrame.new()
    outer_frame.track_world_fragments = true
    outer_frame.clear()
    outer.render_outer_flame(outer_frame, CCinderCrown.T_BU - 0.1)
    var pre_influence := 0
    for value in outer_frame.world_influence: pre_influence += int(value)
    check(pre_influence == 0, "C01 selected outer role excludes duplicate pre-burst crown")
    outer.render_outer_flame(outer_frame, CCinderCrown.T_BU + 0.3)
    var outer_influence := 0
    for value in outer_frame.world_influence: outer_influence += int(value)
    check(outer_influence > 0, "C01 selected original outer tongue primitive rasterizes")

    var rift := CRealityRipperFusion.new()
    var setup_start := Time.get_ticks_usec()
    rift.setup()
    var first_setup_usec := Time.get_ticks_usec() - setup_start
    var rift_cached := CRealityRipperFusion.new()
    setup_start = Time.get_ticks_usec()
    rift_cached.setup()
    var cached_setup_usec := Time.get_ticks_usec() - setup_start
    print("C20_SETUP_COST first_ms=%.3f cached_ms=%.3f scope=software_CPU_source_setup_not_frame_or_device_budget cache_payload_bytes=%d" % [float(first_setup_usec) / 1000.0, float(cached_setup_usec) / 1000.0, 6 * CFrame.N * 4 + rift.contour_indices.size() * 4])
    check(rift.ts == rift_cached.ts and rift.td == rift_cached.td and rift.tnx == rift_cached.tnx and rift.tny == rift_cached.tny and rift.ttx == rift_cached.ttx and rift.tty == rift_cached.tty and rift.blocks == rift_cached.blocks, "C20 cached immutable contour retains exact source fields and seeded blocks")
    var old_ts := rift.ts[0]
    rift_cached.ts[0] = old_ts + 1.0
    check(rift.ts[0] == old_ts and (CRealityRipperFusion._contour_cache.ts as PackedFloat32Array)[0] == old_ts, "C20 per-cast contour clone cannot mutate cache or other casts")
    check(not rift.contour_indices.is_empty() and rift.contour_indices.size() < CFrame.N, "C20 valid contour traversal is sparse")
    var old_index := rift.contour_indices[0]
    rift_cached.contour_indices[0] = -1
    check(rift.contour_indices[0] == old_index and (CRealityRipperFusion._contour_cache.indices as PackedInt32Array)[0] == old_index, "C20 contour index clone cannot mutate cache or other casts")
    var previous_index := -1
    for contour_index in rift.contour_indices:
        check(contour_index > previous_index and rift.ts[contour_index] >= 0.0, "C20 sparse contour preserves valid row-major order")
        previous_index = contour_index
    var valid_count := 0
    for sample in rift.ts:
        if sample >= 0.0: valid_count += 1
    check(valid_count == rift.contour_indices.size(), "C20 sparse contour includes every valid sample")
    for noise_z in [0.0, 0.8, 1.0, 1.775, 2.349, 4.0]:
        for noise_x in [2.0, 4.35, 9.75, 19.0, -5.0]:
            for noise_y in [0.8, 3.15, 7.3, 10.7, -3.0]:
                check(rift._contour_noise(noise_x, noise_y, noise_z) == CMath.noise3(noise_x, noise_y, noise_z), "C20 cached lattice noise equals original float64 formula")
    var rift_frame := CFrame.new()
    rift_frame.track_world_fragments = true
    rift_frame.clear()
    var pre_time := 2.0
    var a_pre_time := rift._a_time(pre_time)
    rift.render(rift_frame, pre_time)
    var pre_warp_count := 0
    for pixel in rift.contour_indices:
        var expected := 0.0
        if absf(float(rift.td[pixel])) < 1.2:
            expected = round((AMath.hash2(float(floori(float(rift.ts[pixel]) * 120.0)), float(floori(a_pre_time * 18.0))) - 0.5) * 5.0)
        check(is_equal_approx(rift_frame.disp[pixel * 4], expected), "A20 pre-open source warp on selected C contour")
        if expected != 0.0: pre_warp_count += 1
    check(pre_warp_count > 0, "A20 pre-open world displacement is present")
    rift_frame.clear()
    rift.render(rift_frame, 4.5)
    var rift_ink := 0
    var rift_inverted := 0
    var rift_warp := 0
    for i in range(CFrame.N):
        if rift_frame.ink[i * 4 + 3] > 0.0: rift_ink += 1
        if rift_frame.world_fragment[i * 4 + 3] > 0.5: rift_inverted += 1
        if rift_frame.disp[i * 4] != 0.0 or rift_frame.disp[i * 4 + 1] != 0.0: rift_warp += 1
    check(rift_ink > 0 and rift_inverted > 0 and rift_warp > 0, "C20 original contour, real-world inversion and A warp fields coexist")

    # Source-C segmented closure and both seeded debris populations must
    # finish before the cast disappears, not merely be hidden by cancellation.
    for tick in range(1, 601): rift.update(1.0 / 60.0, float(tick) / 60.0)
    check(rift.particles.is_empty() and rift.a_debris.particles.is_empty(), "F20 C and mapped A debris naturally expire before OUT")
    var all_closed := true
    for segment in range(1, 100):
        if rift._width(float(segment) / 100.0, 10.0) > 0.00001: all_closed = false
    check(all_closed, "F20 original C segmented contour fully closes by OUT")
    rift_frame.clear()
    rift.render(rift_frame, 10.0)
    check(rift_frame.field_activity == 0 and rift_frame.live_light_buckets.is_empty(), "F20 natural OUT has no residual live-world fields")

    # #11 preview split must never mutate the full source field or A/C
    # simulation. At the white-cloud beat compare the actual player's full
    # field to a fresh direct source rerender at the same object state.
    var carousel_player := ASourcePlayer.new()
    carousel_player.world_pass_mode = true
    carousel_player.source_variant = &"carousel_a_rotor_c_bolts"
    carousel_player.configure(AVoltCarouselFusion.new(), AVoltCarouselFusion.DURATION)
    root.add_child(carousel_player)
    carousel_player.begin(Vector2(200, 200), Vector2(340, 200))
    carousel_player.set_process(false)
    for i in range(327): carousel_player.advance(STEP, false)
    carousel_player._render_frame()
    var carousel_frame := carousel_player.source_pass_frame()
    var reference_full := AFramebuffer.new()
    reference_full.track_world_fields = true
    reference_full.clear()
    var carousel_spell := carousel_player._spell as AVoltCarouselFusion
    carousel_spell.render(reference_full, carousel_player.source_time())
    reference_full.compute_bloom()
    check(carousel_frame.a_rgb == reference_full.buf and carousel_frame.a_bloom_rgb == reference_full.bloom_a, "F11 complete source and original bloom remain unmodified")
    check(carousel_frame.a_carousel_rotor_rgb.size() == reference_full.buf.size() and carousel_frame.a_carousel_rotor_bloom_rgb.size() == reference_full.bloom_a.size(), "F11 same-tick rotor-only presentation fields")
    var connector_energy := 0.0
    for i in range(reference_full.buf.size()):
        connector_energy += maxf(0.0, reference_full.buf[i] - carousel_frame.a_carousel_rotor_rgb[i])
    check(connector_energy > 1.0 and carousel_spell.include_bolts, "F11 connector field retained and render state restored")
    carousel_player.stop()
    carousel_player.free()

    var graph_bolts := AChainVerdictGraph.new()
    var plain_bolt := AFramebuffer.new()
    plain_bolt.track_audit_writes = true
    plain_bolt.clear()
    graph_bolts._bolt(plain_bolt, Vector2(130, 60), Vector2(260, 135), 3.0, 1234, 1.5, 1.0, 0.32, 0)
    var branched_bolt := AFramebuffer.new()
    branched_bolt.track_audit_writes = true
    branched_bolt.clear()
    graph_bolts._bolt(branched_bolt, Vector2(130, 60), Vector2(260, 135), 3.0, 1234, 1.5, 1.0, 0.32, 5)
    var new_branch_pixels := 0
    for i in range(AFramebuffer.W * AFramebuffer.H):
        if branched_bolt.audit_writes[i] != 0 and plain_bolt.audit_writes[i] == 0: new_branch_pixels += 1
    check(new_branch_pixels > 0, "A09 C channel tree contributes source-branch writes")

    var rotor := AVoltCarouselFusion.new()
    rotor.setup()
    check(rotor.source_seeds() == PackedInt32Array([0xc0de]) and rotor.rings.size() == 6, "A11 original seeded six-ring rotor")
    var rotor_fb := AFramebuffer.new()
    rotor_fb.track_world_fields = true
    rotor_fb.clear()
    rotor.render(rotor_fb, 3.0)
    var rotor_light := 0.0
    for value in rotor_fb.buf: rotor_light += absf(value)
    check(rotor_light > 0.0, "A11 seeded rotor with C bolt-tree produces HDR fields")
    for tick in range(1, 349): rotor.update(STEP, float(tick) * STEP)
    check(rotor.frags.count() > 0, "A11 synchronized fragment lifecycle")

    var growth := AWorldseedGrowth.new()
    growth.setup()
    var growth_fb := AFramebuffer.new()
    growth_fb.track_world_fields = true
    for i in range(1, 181): growth.update(1.0 / 60.0, float(i) / 60.0)
    growth_fb.clear()
    growth.render(growth_fb, 3.0)
    var growth_coverage := 0.0
    for value in growth_fb.world_coverage: growth_coverage += value
    check(growth.source_seeds() == PackedInt32Array([0x5eed]) and growth_coverage > 0.0, "A16 seeded source growth C material uses authored ink coverage")

    # Fusion-only detached sheets begin on the seeded A surface and then
    # separate; the elected source before the fold must stay byte-identical.
    var attached := growth.fragment_pose(3, 0, AWorldseedGrowth.FOLD)
    var moving := growth.fragment_pose(3, 0, AWorldseedGrowth.FOLD + 0.6)
    check(float(attached.age) == 0.0 and (attached.points[2] as Vector2).distance_to(moving.points[2]) > 2.0, "F16 sheet fragment separates from its source surface")
    # Independently reconstruct every source sheet centreline at the exact
    # attachment time, then verify all five points move continuously on the
    # next 60 Hz step and finish their fade inside the fusion lifetime.
    var tracked_tips := 0
    var attached_exact := true
    var continuous := true
    var expiry_inside := true
    for li in range(growth.layers.size()):
        var layer: Dictionary = growth.layers[li]
        for petal in range(int(layer.count)):
            var detach := AWorldseedGrowth.FOLD + 0.025 * float((petal + li * 3) % 9)
            var pose := growth.fragment_pose(li, petal, detach)
            var next := growth.fragment_pose(li, petal, detach + STEP)
            var fold := AMath.seg(detach, AWorldseedGrowth.FOLD, AWorldseedGrowth.DURATION)
            var u := AMath.ease_out(AMath.seg(detach, float(layer.t0), float(layer.t0) + 1.0 / float(layer.sp)), 2.0) * (1.0 - AMath.ease_out(fold, 1.6))
            var pulse := 1.0 + 0.18 * sin(detach * 7.0 - li * 1.2) * maxf(0.0, 1.0 - (detach - AWorldseedGrowth.BLOOM) * 0.6)
            var angle0 := float(layer.tilt) + float(petal) / float(layer.count) * AMath.TAU
            var tremble := sin(detach * (3.0 + float(layer.tremble) * 3.0) + petal) * float(layer.tremble) * 0.02
            for j in range(5):
                var f := lerpf(0.50, 0.98, float(j) / 4.0)
                var angle := angle0 + tremble * f + sin(f * 2.5) * 0.12
                var radius := (5.0 + li * 5.0) * u + float(layer.len) * u * pulse * f
                var expected := Vector2(AWorldseedGrowth.C.x + cos(angle) * radius, AWorldseedGrowth.C.y + sin(angle) * radius / AWorldseedGrowth.SQ - f * f * 10.0 * u)
                var p0: Vector2 = pose.points[j]
                var p1: Vector2 = next.points[j]
                attached_exact = attached_exact and p0.distance_to(expected) < 0.0001
                continuous = continuous and p0.distance_to(p1) < 2.0
            expiry_inside = expiry_inside and detach + 2.0 <= AWorldseedGrowth.FUSION_DURATION + 0.00001
            tracked_tips += 1
    check(tracked_tips == 41 and attached_exact and continuous and expiry_inside, "F16 every seeded sheet tip attaches exactly, moves continuously and fades before OUT")
    var original_growth := AFramebuffer.new()
    var fused_growth := AFramebuffer.new()
    original_growth.track_world_fields = true
    fused_growth.track_world_fields = true
    original_growth.clear()
    fused_growth.clear()
    growth.use_fusion_fragments = false
    growth.render(original_growth, AWorldseedGrowth.FOLD)
    growth.use_fusion_fragments = true
    growth.render(fused_growth, AWorldseedGrowth.FOLD)
    check(original_growth.buf == fused_growth.buf and original_growth.world_coverage == fused_growth.world_coverage, "F16 continuity layer is zero at its attachment beat")
    original_growth.clear()
    fused_growth.clear()
    growth.use_fusion_fragments = false
    growth.render(original_growth, AWorldseedGrowth.FOLD + 0.6)
    growth.use_fusion_fragments = true
    growth.render(fused_growth, AWorldseedGrowth.FOLD + 0.6)
    check(original_growth.buf != fused_growth.buf, "F16 detached material contributes after separation")
    growth.use_fusion_fragments = false

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

    # C05 release is target-centered; source -Y is height, not cast-facing.
    # Test the actual host transform, including metadata, at four bearings.
    var upright := CSourcePlayer.new()
    upright.world_pass_mode = true
    upright.target_upright = true
    root.add_child(upright)
    var base := Vector2(300, 200)
    for delta in [Vector2(140, 0), Vector2(-140, 0), Vector2(0, 140), Vector2(0, -140)]:
        var dst: Vector2 = base + delta
        upright.begin(base, dst, "bloom_late")
        upright.set_process(false)
        var pass_frame := upright.source_pass_frame()
        var basis := pass_frame.source_to_world
        check((basis * CAbyssalBloomLate.C).distance_to(dst) < 0.001, "C05 target stays pinned at bearing %s" % delta)
        check(basis.x.x > 0.0 and absf(basis.x.y) < 0.0001 and basis.y.y > 0.0 and absf(basis.y.x) < 0.0001, "C05 gravity stays world-up at bearing %s" % delta)
        check(is_equal_approx(basis.x.length(), basis.y.length()) and absf(basis.x.dot(basis.y)) < 0.0001, "C05 similarity scale at bearing %s" % delta)
        check(pass_frame.caster_world == base and pass_frame.target_world == dst, "C05 actual actor metadata preserved")
        upright.stop()
    upright.free()

    # #15 snapshots the real cast origin; movement must not move source roots,
    # bloom, events or original source clock. Live position is metadata only.
    var thorn_host := Arcana20Renderer.new()
    thorn_host.world_pass_mode = true
    root.add_child(thorn_host)
    var live_caster := Node2D.new()
    root.add_child(live_caster)
    var thorn_id := Arcana20SourceCatalog.canonical_id(15)
    var thorn_open_events: Array[Vector2] = []
    thorn_host.visual_event.connect(func(id: StringName, kind: StringName, pos: Vector2, _time: float) -> void:
        if id == thorn_id and kind == &"tendrils_open": thorn_open_events.append(pos))
    for distance in [35.0, 140.0, 900.0]:
        for dir in [Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT, Vector2.UP]:
            live_caster.global_position = base
            thorn_open_events.clear()
            var dst: Vector2 = base + dir * distance
            check(thorn_host.cast_skill(thorn_id, base, dst, 1.0, live_caster), "C15 actual renderer cast")
            var thorn_player := thorn_host._casts[thorn_id] as CSourcePlayer
            thorn_player.set_process(false)
            thorn_player.render_enabled = false
            var thorn := thorn_player._fx as CThornOpera
            var roots_before: Array = []
            for td in thorn._tds: roots_before.append(td.base.duplicate())
            var focus_before := thorn._focus
            live_caster.global_position = base + Vector2(900, -600)
            for i in range(50): thorn_player.advance(STEP, false)
            for i in range(5):
                check(thorn._tds[i].base == roots_before[i], "C15 roots stay at cast origin %s %s" % [distance, dir])
            check(thorn._live_caster == CThornOpera.CASTER and thorn._focus == focus_before, "C15 original static caster and fixed bloom")
            check(thorn_open_events.size() == 1 and thorn_open_events[0].distance_to(base) < 0.001, "C15 source root event stays at cast origin")
            var world_height := thorn.particle_height_axis.rotated(thorn_player._rot)
            check(world_height.distance_to(Vector2.UP) < 0.0001, "C15 petal ballistic height stays world-up")
            var tf := thorn_player.source_pass_frame()
            check(tf.cast_origin_world == base and tf.caster_world == base and tf.has_live_caster and tf.live_caster_world == live_caster.global_position, "C15 cast origin and real moving actor metadata remain distinct")
            check(thorn_player.local_to_world(thorn._focus).distance_to(dst) < 0.001, "C15 fixed target at all ranges")
            thorn_host.cancel_skill(thorn_id)
            check(not thorn_host.is_active(thorn_id), "C15 cancel cleans cast")
    # Recast snapshots the new live origin, not a stale passed coordinate.
    live_caster.global_position = base + Vector2(100, 30)
    check(thorn_host.cast_skill(thorn_id, base, live_caster.global_position + Vector2(140, 0), 1.0, live_caster), "C15 recast with new actor origin")
    var recast := thorn_host._casts[thorn_id] as CSourcePlayer
    check(recast.source_pass_frame().cast_origin_world == live_caster.global_position, "C15 recast snapshots actor position")
    var concurrent_id := Arcana20SourceCatalog.canonical_id(3)
    check(thorn_host.cast_skill(concurrent_id, live_caster.global_position, live_caster.global_position + Vector2(140, 0)), "C15 overlaps independent B03")
    thorn_host.cancel_skill(thorn_id)
    check(not thorn_host.is_active(thorn_id) and thorn_host.is_active(concurrent_id), "C15 cancellation preserves overlapping cast")
    thorn_host.cancel_skill(concurrent_id)
    # Two independent renderer instances each own a cast-origin; cancellation
    # in one must not alter the other's snapshot. A single renderer itself
    # deliberately replaces an earlier cast of the same canonical id.
    var thorn_host2 := Arcana20Renderer.new()
    thorn_host2.world_pass_mode = true
    root.add_child(thorn_host2)
    live_caster.global_position = base
    check(thorn_host.cast_skill(thorn_id, base, base + Vector2(140, 0), 1.0, live_caster), "C15 overlap first origin")
    live_caster.global_position = base + Vector2(90, 30)
    check(thorn_host2.cast_skill(thorn_id, live_caster.global_position, live_caster.global_position + Vector2(140, 0), 1.0, live_caster), "C15 overlap second origin")
    check((thorn_host._casts[thorn_id] as CSourcePlayer)._cast_caster == base and (thorn_host2._casts[thorn_id] as CSourcePlayer)._cast_caster == live_caster.global_position, "C15 independent overlapping snapshots")
    thorn_host.cancel_skill(thorn_id)
    check(thorn_host2.is_active(thorn_id), "C15 separate renderer survives other cancel")
    thorn_host2.cancel_skill(thorn_id)
    thorn_host2.free()
    # Compare entire simulated source state and raw base field at bloom under
    # stationary and moved actors. Same source, seed, ticks, target and CKit
    # seed; player movement must change no source pixels or physics.
    var baseline_results: Array = []
    var saved_seed := CKit._auto_seed
    for moved in [false, true]:
        CKit._auto_seed = 0
        live_caster.global_position = base
        check(thorn_host.cast_skill(thorn_id, base, base + Vector2(140, -14), 1.0, live_caster), "C15 stationary baseline cast")
        var test_player := thorn_host._casts[thorn_id] as CSourcePlayer
        test_player.set_process(false)
        test_player.render_enabled = false
        if moved: live_caster.global_position += Vector2(900, -600)
        for i in range(360): test_player.advance(STEP, false)
        test_player.render_enabled = true
        test_player._render_frame()
        var test_fx := test_player._fx as CThornOpera
        var frame := test_player.source_pass_frame()
        baseline_results.append({"strands":test_fx._tds.duplicate(true), "particles":test_fx._ps.duplicate(true),
            "ink":frame.c_ink.duplicate(), "light":frame.c_light.duplicate(), "disp":frame.c_disp.duplicate()})
        thorn_host.cancel_skill(thorn_id)
    CKit._auto_seed = saved_seed
    check(baseline_results.size() == 2 and baseline_results[0] == baseline_results[1], "C15 moving player preserves exact stationary source state and bloom frame")
    live_caster.global_position = base
    check(thorn_host.cast_skill(thorn_id, base, base + Vector2(35, 0), 1.0, live_caster), "C15 natural OUT cast")
    var out_cast := thorn_host._casts[thorn_id] as CSourcePlayer
    out_cast.set_process(false)
    out_cast.render_enabled = false
    live_caster.global_position = base + Vector2(900, 0)
    for i in range(510):
        if not thorn_host.is_active(thorn_id): break
        out_cast.advance(STEP, false)
    check(not thorn_host.is_active(thorn_id), "C15 natural OUT finishes with moving actor and retires")
    # Clamp the overall source scale but keep the four target offsets and
    # bloom at the selected world point even at very short/long ranges.
    for delta in [Vector2(20, 0), Vector2(0, -20), Vector2(700, 0), Vector2(0, 700)]:
        live_caster.global_position = base
        var dst: Vector2 = base + delta
        check(thorn_host.cast_skill(thorn_id, base, dst, 1.0, live_caster), "C15 clamped-range cast")
        var thorn_player := thorn_host._casts[thorn_id] as CSourcePlayer
        thorn_player.set_process(false)
        var thorn := thorn_player._fx as CThornOpera
        check(thorn_player.local_to_world(thorn._focus).distance_to(dst) < 0.001, "C15 clamped bloom pins selected target %s" % delta)
        for i in range(CThornOpera.TARGETS.size()):
            var actual: Vector2 = thorn._targets[i]
            var original: Vector2 = CThornOpera.TARGETS[i]
            check((actual - thorn._focus).distance_to(original - CThornOpera.FZ) < 0.001, "C15 preserves authored target constellation")
        thorn_host.cancel_skill(thorn_id)
    # Long-range bloom straddles the source edge: the world adapter must
    # expose the missing pixels in an adjacent tile without shifting source
    # simulation/target or shrinking. Observe the actual emitted source field.
    var thorn_tiles_seen := {}
    thorn_host.source_pass_ready.connect(func(_id: StringName, f: Arcana20SourcePassFrame) -> void:
        if f.family == &"C" and f.c_tile != Vector2i.ZERO:
            var count := 0
            for k in range(3, f.c_ink.size(), 4):
                if f.c_ink[k] > 0.0: count += 1
            thorn_tiles_seen[f.c_tile] = {"ink": count, "transform": f.source_to_world})
    live_caster.global_position = base
    var far_dst := base + Vector2(900.0, 0.0)
    check(thorn_host.cast_skill(thorn_id, base, far_dst, 1.0, live_caster), "C15 overscan real cast")
    var overscan := thorn_host._casts[thorn_id] as CSourcePlayer
    overscan.set_process(false)
    overscan.render_enabled = false
    for i in range(360): overscan.advance(STEP, false)
    overscan.render_enabled = true
    overscan._render_frame()
    var far_thorn := overscan._fx as CThornOpera
    var right_tile := Vector2i(1, 0)
    check(thorn_tiles_seen.has(right_tile), "C15 long-range clipped bloom reaches adjacent source tile")
    if thorn_tiles_seen.has(right_tile):
        var tile_data: Dictionary = thorn_tiles_seen[right_tile]
        check(int(tile_data.ink) > 0, "C15 adjacent tile carries real bloom ink")
        var tile_basis: Transform2D = tile_data.transform
        check((tile_basis * (far_thorn._focus - Vector2(CFrame.W, 0))).distance_to(far_dst) < 0.001, "C15 tile maps to same actual target")
    check(overscan.source_pass_frame().c_tile == Vector2i.ZERO, "C15 public base frame remains original raster")
    thorn_host.cancel_skill(thorn_id)
    live_caster.free()
    thorn_host.free()
    var petal_frame := CFrame.new()
    petal_frame.track_world_fragments = true
    petal_frame.clear()
    var test_petal := CKit.pt_defaults({"x": 100.0, "y": 100.0, "z": 10.0, "kind": "petal", "col": CPalette.P["bloom"], "max": 1.0, "rot": PI / 2.0})
    CKit.draw_pt(petal_frame, test_petal, Vector2.RIGHT)
    check(petal_frame.ink[(100 * CFrame.W + 110) * 4 + 3] > 0.0, "C15 petal ink uses supplied world-up height direction")
    check(petal_frame.disp[(100 * CFrame.W + 100) * 4 + 2] < 1.0, "C15 petal shadow stays at ground coordinate")

    # A and B must execute identical elected sources. The directed variant is
    # only a separate presentation canvas and pass ordering; compare the actual
    # raw source fields after the common release tick, not screenshots or RGB
    # keys. Both runs start with the same source particle counter.
    var ab_fields: Array[Dictionary] = []
    var saved_particle_seed := CKit._auto_seed
    for directed in [false, true]:
        CKit._auto_seed = 0
        var ab_host := Arcana20Renderer.new()
        ab_host.world_pass_mode = true
        ab_host.abyssal_directed = directed
        root.add_child(ab_host)
        var ab_seen: Dictionary = {}
        ab_host.source_pass_ready.connect(func(_id: StringName, frame: Arcana20SourcePassFrame) -> void:
            ab_seen[frame.family] = frame)
        var ab_id := Arcana20SourceCatalog.canonical_id(5)
        check(ab_host.cast_skill(ab_id, Vector2(100, 200), Vector2(240, 200)), "R20 A/B source cast")
        var ab_cast := ab_host._casts[ab_id] as FusionPlayer
        ab_cast.set_process(false)
        var a_part: ASourcePlayer
        var c_part: CSourcePlayer
        for part in ab_cast._pending:
            if part.node is ASourcePlayer: a_part = part.node
            if part.node is CSourcePlayer: c_part = part.node
        check(a_part != null and c_part != null, "R20 both elected source components present")
        if a_part != null and c_part != null:
            a_part.render_enabled = false
            c_part.render_enabled = false
            for i in range(300): ab_cast.advance(STEP)
            a_part.render_enabled = true
            c_part.render_enabled = true
            a_part._render_frame()
            c_part._render_frame()
            var af: Arcana20SourcePassFrame = ab_seen.get(&"A")
            var cf: Arcana20SourcePassFrame = ab_seen.get(&"C")
            check(af != null and cf != null, "R20 both source field frames emitted")
            if af != null and cf != null:
                ab_fields.append({"a_rgb": af.a_rgb.duplicate(), "a_coverage": af.a_coverage.duplicate(),
                    "a_influence": af.a_influence.duplicate(), "a_multiplier": af.a_multiplier.duplicate(),
                    "a_warp": af.a_world_warp.duplicate(), "a_exposure": af.a_exposure, "a_bloom": af.a_bloom,
                    "a_bloom_rgb": af.a_bloom_rgb.duplicate(), "a_transform": af.source_to_world,
                    "c_ink": cf.c_ink.duplicate(), "c_light": cf.c_light.duplicate(), "c_disp": cf.c_disp.duplicate(),
                    "c_influence": cf.c_influence.duplicate(), "c_ground": cf.c_ground.duplicate(),
                    "c_coverage": cf.c_ground_coverage.duplicate(), "c_fragment": cf.c_world_fragment.duplicate(),
                    "c_transform": cf.source_to_world, "c_flash": cf.flash, "c_shake": cf.shake})
            var presentation := ab_cast.get_node_or_null("DirectedWaterPresentation")
            check((presentation != null) == directed, "R20 separate B presentation only")
        ab_host.cancel_skill(ab_id)
        ab_host.free()
    CKit._auto_seed = saved_particle_seed
    check(ab_fields.size() == 2 and ab_fields[0] == ab_fields[1], "R20 A/B selected source fields are exact")

    var graph := AChainVerdictGraph.new()
    graph.setup()
    check(graph.events.size() == 23, "A09 original graph seeded probe count")
    check(int(graph.events[0].a) == 0 and int(graph.events[0].b) == 6 and int(graph.events[0].seed) == 990, "A09 original first probe seed and endpoints")
    check(int(graph.events[2].b) == 1 and not bool(graph.events[2].fail) and is_equal_approx(float(graph.events[2].t0), 1.49), "A09 first success ordering and time")
    check(graph.event_local({"node_index": 1}) == null, "A09 absent real target has no contact anchor")
    # Cascade remnants use original A fixed-amplitude subdivision, even when
    # real moving actors converge or share a position. The former substitution
    # of 20/distance as C relative roughness made recursion expand without
    # bound and painted a huge rectangular web through the actual world.
    for distance in [0.0, 0.1, 1.0, 5.0, 20.0, 100.0]:
        var start := Vector2(170, 110)
        var end := start + Vector2(distance, 0)
        var ghost_path := AChainVerdictGraph._ghost_path(start, end, 990)
        check(ghost_path == ADraw.bolt_path(start.x, start.y, end.x, end.y, distance * 0.3, 990, 4), "A09 authored memory path %s" % distance)
        check(ghost_path.size() == 17 and ghost_path[0] == start and ghost_path[-1] == end, "A09 memory endpoints and four subdivisions %s" % distance)
        var dissolve_path := AChainVerdictGraph._dissolve_path(start, end, 990)
        check(dissolve_path == ADraw.bolt_path(start.x, start.y, end.x, end.y, 20.0, 990, 4), "A09 source-authored dissolve path %s" % distance)
        check(dissolve_path.size() == 17 and dissolve_path[0] == start and dissolve_path[-1] == end, "A09 dissolve endpoints and four subdivisions %s" % distance)
        for point in dissolve_path:
            check(point.x >= start.x - 40 and point.x <= end.x + 40 and absf(point.y - start.y) <= 40, "A09 close-node dissolve remains local %s" % distance)
    graph.nodes = [Vector2(170, 110), Vector2(170, 110), Vector2(171, 110), Vector2(172, 110), Vector2(173, 110), Vector2(174, 110), Vector2(175, 110), Vector2(176, 110)]
    var clustered := AFramebuffer.new(624, 352)
    clustered.track_audit_writes = true
    clustered.clear()
    graph.render(clustered, 5.60)
    var clustered_writes := 0
    var distant_writes := 0
    for y in range(clustered.height):
        for x in range(clustered.width):
            if clustered.audit_writes[y * clustered.width + x] != 0:
                clustered_writes += 1
                if abs(x - 173) > 64 or abs(y - 110) > 64: distant_writes += 1
    check(clustered_writes > 0 and distant_writes == 0, "A09 full clustered-node dissolve has no runaway raster")

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
    var preview := d.composite()
    check(preview[0] == 0 and preview[1] == 0 and preview[2] == 0 and preview[3] == 255, "D zero light uses opaque additive transport, not RGB-derived coverage")
    var preview_host := DSourcePlayer.new()
    root.add_child(preview_host)
    var preview_material := preview_host._sprite.material as CanvasItemMaterial
    check(preview_material != null and preview_material.blend_mode == CanvasItemMaterial.BLEND_MODE_ADD, "D legacy light preview uses additive blend")
    preview_host.begin(Vector2(10, 20), Vector2(110, 40))
    check(preview_host._eng.fx.rgba8_fragment_transfer and preview_host._eng.fx.rgba8_scene_blend, "D runtime uses source RGBA8 fragment and destination transfer")
    preview_host.stop()
    preview_host.queue_free()
    d.track_world_fields = true
    d.clear()
    d.rgba8_scene_blend = true
    d._add_px(3, 3, 0.1, 0.2, 0.3)
    d._add_px(3, 3, 0.1, 0.2, 0.3)
    var d_index := (3 * DFx.W + 3) * 3
    check(is_equal_approx(d.buf[d_index], 52.0 / 255.0) and is_equal_approx(d.buf[d_index + 1], 102.0 / 255.0), "D RGBA8 destination quantizes each blend")
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

    # Layer collection must not change the original renderer or simulation.
    var d_plain := DConstellationEngine.new()
    var d_layers := DConstellationEngine.new()
    d_plain.setup()
    d_layers.setup()
    for engine in [d_plain, d_layers]:
        engine.fx.rgba8_fragment_transfer = true
        engine.fx.rgba8_scene_blend = true
    d_layers.fx.track_world_fields = true
    d_layers.fx.collect_world_layers = true
    d_plain.update(8.15, STEP)
    d_layers.update(8.15, STEP)
    check(d_plain.fx.buf == d_layers.fx.buf, "D collecting independent layers preserves source RGBA8 bytes")
    check(d_plain._nodes == d_layers._nodes and d_plain._edges == d_layers._edges and d_plain._pulses == d_layers._pulses, "D layer collection preserves authored simulation state")
    var star_max := 0.0
    var star_raw_max := 0.0
    var center_max := 0.0
    var body_max := 0.0
    for v in d_layers.fx.world_star: star_max = maxf(star_max, v)
    for v in d_layers.fx.world_star_pretransfer: star_raw_max = maxf(star_raw_max, v)
    for v in d_layers.fx.world_center: center_max = maxf(center_max, v)
    for v in d_layers.fx.world_body: body_max = maxf(body_max, v)
    check(star_max > 0.0 and star_raw_max >= star_max and center_max > 0.0 and body_max > 0.0, "D independent raster layers carry actual light")
    d_layers.fx.clear()
    check(d_layers.fx.world_star.count(0.0) == d_layers.fx.world_star.size() and d_layers.fx.world_star_pretransfer.count(0.0) == d_layers.fx.world_star_pretransfer.size() and d_layers.fx.world_center.count(0.0) == d_layers.fx.world_center.size() and d_layers.fx.world_body.count(0.0) == d_layers.fx.world_body.size(), "D presentation layers clear for cancel and recast")

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
