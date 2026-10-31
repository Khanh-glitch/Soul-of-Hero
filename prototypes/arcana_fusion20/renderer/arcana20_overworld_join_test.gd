## Disposable JOIN QA: actual AppRoot menu -> AppFlow -> ready Hollow Marches.
## No production mount, no claim of gameplay or source/visual acceptance.
## One real Skeleton is injected as a diagnostic target; R4 alone changes HP.
extends SceneTree

const STEP := 1.0 / 60.0
const OUTPUT := "res://artifacts/arcana20-join"
var failures: Array[String] = []
var passes: Dictionary = {}

func _initialize() -> void:
    call_deferred("_run")

func check(ok: bool, message: String) -> void:
    print("JOIN_", "OK " if ok else "FAIL ", message)
    if not ok:
        failures.append(message)

func wait_route(app: Node, route: StringName, limit_ms: int) -> bool:
    var deadline := Time.get_ticks_msec() + limit_ms
    while Time.get_ticks_msec() < deadline:
        if StringName(app.call(&"get_current_route")) == route:
            return true
        await process_frame
    return false

func click(point: Vector2) -> void:
    var motion := InputEventMouseMotion.new()
    motion.position = point
    Input.parse_input_event(motion)
    var press := InputEventMouseButton.new()
    press.position = point
    press.button_index = MOUSE_BUTTON_LEFT
    press.pressed = true
    Input.parse_input_event(press)
    await physics_frame
    await process_frame
    var release := InputEventMouseButton.new()
    release.position = point
    release.button_index = MOUSE_BUTTON_LEFT
    release.pressed = false
    Input.parse_input_event(release)
    await physics_frame
    await process_frame

func save_frame(name: String) -> Image:
    await RenderingServer.frame_post_draw
    var image := root.get_texture().get_image()
    if image == null or image.is_empty() or image.save_png(OUTPUT + "/" + name + ".png") != OK:
        check(false, "save " + name)
    return image

# Verify every pixel occupied by the real visible HUD, including translucent
# edges. The black/white surfaces are diagnostic backgrounds BELOW the actual
# HUD, not a substitute HUD or an acceptance screenshot. Their difference
# recovers per-channel HUD transmission; for any two real-world backgrounds,
# the post-on/post-off output difference must be that transmission times the
# corresponding background difference. Two 8-bit render roundings justify a
# fixed three-code-value error budget; this is not a visual-fidelity threshold.
func check_hud_isolation(hud: CanvasLayer, post: Arcana20CViewportPost, with_post: Image, without_post: Image) -> void:
    if hud == null or not hud.visible or hud.layer <= post.layer:
        check(false, "C20 full HUD canvas must be visible and above viewport post")
        return
    hud.visible = false
    await process_frame
    await process_frame
    var background_post := await save_frame("fusion_20_collision_post_without_hud")
    post._rect.visible = false
    await process_frame
    await process_frame
    var background_plain := await save_frame("fusion_20_collision_plain_without_hud")
    hud.visible = true
    var reference := CanvasLayer.new()
    reference.layer = hud.layer - 1
    reference.process_mode = Node.PROCESS_MODE_ALWAYS
    root.add_child(reference)
    var surface := ColorRect.new()
    surface.mouse_filter = Control.MOUSE_FILTER_IGNORE
    surface.color = Color.BLACK
    reference.add_child(surface)
    surface.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    await process_frame
    await process_frame
    var black := await save_frame("fusion_20_actual_hud_on_black_diagnostic")
    surface.color = Color.WHITE
    await process_frame
    await process_frame
    var white := await save_frame("fusion_20_actual_hud_on_white_diagnostic")
    reference.queue_free()
    post._apply()
    await process_frame
    await process_frame
    var images: Array[Image] = [with_post, without_post, background_post, background_plain, black, white]
    var data: Array[PackedByteArray] = []
    for source in images:
        var copy := source.duplicate() as Image
        copy.convert(Image.FORMAT_RGBA8)
        data.append(copy.get_data())
    var covered := 0
    var opaque := 0
    var partial := 0
    var bad := 0
    var max_error := 0.0
    for i in range(0, data[0].size(), 4):
        var pixel_covered := false
        var pixel_opaque := true
        var pixel_bad := false
        for channel in range(3):
            var j := i + channel
            var transmission := int(data[5][j]) - int(data[4][j])
            if transmission < 255: pixel_covered = true
            if transmission != 0: pixel_opaque = false
            var observed := int(data[0][j]) - int(data[1][j])
            var backing := int(data[2][j]) - int(data[3][j])
            var err := absf(float(observed) - float(backing * transmission) / 255.0)
            max_error = maxf(max_error, err)
            if err > 3.0: pixel_bad = true
        if pixel_covered:
            covered += 1
            if pixel_opaque: opaque += 1
            else: partial += 1
            if pixel_bad: bad += 1
    check(covered > 0 and opaque > 0 and partial > 0 and bad == 0,
        "C20 full visible real HUD excluded from post, including translucent pixels: covered=%d opaque=%d partial=%d mismatched=%d max_error=%.3f" % [covered, opaque, partial, bad, max_error])

func _run() -> void:
    DirAccess.make_dir_recursive_absolute(OUTPUT)
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
    var save := root.get_node_or_null("SaveService")
    if save == null or not bool(save.call(&"configure_storage", "user://tests/arcana20_join.json", true)):
        check(false, "isolated save configuration")
        _finish()
        return
    var app_scene := load("res://game/app/app_root.tscn") as PackedScene
    if app_scene == null:
        check(false, "AppRoot scene missing")
        _finish()
        return
    var app := app_scene.instantiate()
    root.add_child(app)
    if not await wait_route(app, &"title", 30000):
        check(false, "normal entry title route")
        _finish()
        return
    await process_frame
    var new_game := app.find_child("NewGameButton", true, false) as Button
    if new_game == null or not new_game.is_visible_in_tree() or new_game.disabled:
        check(false, "normal entry new-game button")
        _finish()
        return
    await click(root.get_final_transform() * new_game.get_global_rect().get_center())
    if not await wait_route(app, &"home", 30000):
        check(false, "normal entry home route")
        _finish()
        return
    await process_frame
    await physics_frame
    var route_host := app.get_node("RouteHost")
    var home := route_host.get_child(0)
    var home_player := home.get("player") as CharacterBody2D
    var destinations: Dictionary = home.get("_destinations")
    var gate := destinations.get(&"campaign") as Node2D
    if home_player == null or gate == null:
        check(false, "normal entry Home player/campaign missing")
        _finish()
        return
    # Home moves its parent canvas as a follow camera, so the player's global
    # screen-like position can stay fixed while its local world position moves.
    var start := home_player.position
    await click(root.get_final_transform() * gate.get_global_transform_with_canvas().origin)
    var deadline := Time.get_ticks_msec() + 30000
    while Time.get_ticks_msec() < deadline and StringName(home.call(&"get_current_function")) != &"campaign":
        await process_frame
    if StringName(home.call(&"get_current_function")) != &"campaign":
        check(false, "normal entry campaign walk")
        _finish()
        return
    check(home_player.position.distance_to(start) > 1.0, "Home player walked to campaign through pointer")
    var enter := home.find_child("EnterOverworldButton", true, false) as Button
    if enter == null or not enter.is_visible_in_tree() or enter.disabled:
        check(false, "normal entry overworld button")
        _finish()
        return
    await click(root.get_final_transform() * enter.get_global_rect().get_center())
    if not await wait_route(app, &"overworld", 30000):
        check(false, "normal entry AppFlow overworld route")
        _finish()
        return
    var world := route_host.get_child(0)
    deadline = Time.get_ticks_msec() + 90000
    while Time.get_ticks_msec() < deadline and not bool(world.call(&"is_world_ready")):
        await process_frame
    if not bool(world.call(&"is_world_ready")):
        check(false, "overworld readiness: " + str(world.get("build_error")))
        _finish()
        return
    var player := world.get("player") as CharacterBody2D
    var camera := world.get("camera") as Camera2D
    var terrain := world.get("world") as Node2D
    if player == null or camera == null or terrain == null:
        check(false, "world player/camera/terrain missing")
        _finish()
        return
    check(true, "normal AppRoot/AppFlow route and is_world_ready")
    print("JOIN_WORLD scene=", world.scene_file_path, " player=", player.global_position, " camera=", camera.get_path(), " terrain=", terrain.get_path())
    if OS.get_environment("ARCANA20_BASELINE_ONLY") == "1":
        print("JOIN_BASELINE_NO_FX route complete; releasing app before any AVFX or R4 actor setup")
        app.queue_free()
        await process_frame
        await process_frame
        _finish()
        return

    # A real A0 Skeleton in a diagnostic test mount, not an overworld spawn or
    # gameplay aim/hit-volume proof. R4 and the untouched PR30 binding own HP.
    var skeleton_scene := load("res://game/characters/enemies/skeleton_enemy.tscn") as PackedScene
    var r4_script := load("res://prototypes/arcana_fusion20/r4/arcana20_soh_native_hit_bridge.gd") as Script
    var binding_script := load("res://prototypes/arcana_fusion20/soh_binding/arcana20_soh_binding.gd") as Script
    if skeleton_scene == null or r4_script == null or binding_script == null:
        check(false, "pinned real enemy/R4/PR30 binding missing")
        _finish()
        return
    var enemy := skeleton_scene.instantiate() as Node2D
    world.get_node("Entities").add_child(enemy)
    enemy.global_position = player.global_position + Vector2(90, 0)
    enemy.set_physics_process(false)
    var r4: Node = r4_script.new()
    var binding: Node = binding_script.new()
    world.add_child(r4)
    world.add_child(binding)
    check(bool(binding.call(&"attach_to_bridge", r4)), "PR30 attaches to R4")
    await process_frame
    await process_frame
    var hp_before := int(enemy.get("health"))
    var hit: bool = r4.call(&"request_hit", enemy, 1, player.global_position, "join-test-02", 0, &"arcana_fusion20_02", &"fire")
    check(hit and int(enemy.get("health")) == hp_before - 1, "diagnostic R4-authorized hit on actual SOH skeleton")
    check(binding.call(&"get_actor_visual", enemy) != null, "PR30 actual AnimatedSprite reaction bound")
    await process_frame
    await save_frame("real_overworld_receipt")
    if OS.has_environment("ARCANA20_PHASE_FIRST"):
        await _phase_sweep(app, world, player, enemy, camera)
        return
    if OS.get_environment("ARCANA20_SWEEP") == "1":
        await _sweep_all20(app, world, player, enemy, camera)
        return
    if OS.get_environment("ARCANA20_LIVE_INPUT") == "1":
        await _live_input_probe(app, world, player, enemy, camera)
        return
    if OS.get_environment("ARCANA20_PERF") == "1":
        await _overlap_frame_probe(app, world, player, enemy)
        return

    # Freeze the actual world while comparing the same terrain at a single
    # source tick. This is an offline diagnostic, not normal-speed gameplay.
    app.process_mode = Node.PROCESS_MODE_DISABLED
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    renderer.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(renderer)
    var c_world := Arcana20CWorldPass.new()
    var b_world := Arcana20BWorldPass.new()
    var a_world := Arcana20AWorldPass.new()
    a_world.process_mode = Node.PROCESS_MODE_ALWAYS
    c_world.process_mode = Node.PROCESS_MODE_ALWAYS
    b_world.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(c_world)
    world.add_child(b_world)
    world.add_child(a_world)
    renderer.source_pass_ready.connect(func(id: StringName, frame: Arcana20SourcePassFrame) -> void:
        passes[id] = frame
        if frame.family == &"C":
            c_world.consume(frame)
        elif frame.family == &"B":
            b_world.consume(frame)
        elif frame.family == &"A":
            a_world.consume(frame))
    renderer.cast_finished.connect(func(id: StringName) -> void:
        if String(id).ends_with("_02"):
            b_world.clear()
        elif passes.has(id) and (passes[id] as Arcana20SourcePassFrame).family == &"A":
            a_world.clear()
        else:
            c_world.clear())
    camera.force_update_scroll()
    await process_frame
    await process_frame
    var baseline := await save_frame("world_before")
    # #09 candidate graph tracks the current real injected enemy, not a Gold
    # demo formation. Moving the target is a diagnostic transform, not proof
    # of natural AI/target selection or permission to deal gameplay damage.
    var graph_id := Arcana20SourceCatalog.canonical_id(9)
    var secondary := skeleton_scene.instantiate() as Node2D
    world.get_node("Entities").add_child(secondary)
    secondary.global_position = enemy.global_position + Vector2(25, 0)
    secondary.set_physics_process(false)
    var graph_contacts := {"bound": 0, "unbound": 0}
    renderer.visual_contact.connect(func(id: StringName, _pos: Vector2, _kind: StringName) -> void:
        if id == graph_id: graph_contacts.bound += 1)
    renderer.unbound_source_contact.connect(func(id: StringName, _kind: StringName, _index: int, _t: float) -> void:
        if id == graph_id: graph_contacts.unbound += 1)
    renderer.cast_skill(graph_id, player.global_position, enemy.global_position)
    var chain := renderer._casts[graph_id] as ASourcePlayer
    chain.set_process(false)
    chain.render_enabled = false
    var graph := chain._spell as AChainVerdictGraph
    var first_anchor: Variant = graph.nodes[1]
    var old_position := enemy.global_position
    var hp_graph := int(enemy.get("health"))
    enemy.global_position += Vector2(20, 10)
    chain.advance(STEP, false)
    var moved_anchor: Variant = graph.nodes[1]
    check(first_anchor != null and moved_anchor != null and chain.local_to_world(moved_anchor).distance_to(chain.local_to_world(first_anchor) + Vector2(20, 10)) < 0.1, "A09 graph follows actual moving AnimatedSprite2D target")
    check(int(enemy.get("health")) == hp_graph, "A09 graph alone has no damage authority")
    enemy.global_position = old_position
    check(graph.nodes[2] != null, "A09 second anchor references another actual enemy")
    secondary.queue_free()
    await process_frame
    chain.advance(STEP, false)
    check(graph.nodes[2] == null, "A09 removed actor no longer serves as live anchor")
    for tick in range(330): chain.advance(STEP, false)
    check(int(graph_contacts.bound) + int(graph_contacts.unbound) == 18 and int(graph_contacts.unbound) > 0, "A09 preserves bound and unbound source contact ledger")
    check(int(enemy.get("health")) == hp_graph, "A09 source contacts do not inflict damage")
    renderer.cancel_skill(graph_id)
    passes.erase(graph_id)
    await process_frame
    await process_frame
    var after_chain := await save_frame("world_09_cancelled")
    check(images_equal(baseline, after_chain), "A09 graph cancellation restores frozen world")
    var stats: Array = []
    for num in [2, 4, 10, 17]:
        var id := Arcana20SourceCatalog.canonical_id(num)
        renderer.cast_skill(id, player.global_position, enemy.global_position)
        var source: Node = renderer._casts[id]
        source.set_process(false)
        var viewer: Node2D = b_world if num == 2 else (a_world if num == 4 else c_world)
        if source is ASourcePlayer:
            var ap := source as ASourcePlayer
            ap.render_enabled = false
            for tick in range(180):
                ap.advance(STEP, false)
            ap.render_enabled = true
            ap._render_frame()
        elif source is CSourcePlayer:
            var cp := source as CSourcePlayer
            cp.render_enabled = false
            for tick in range(180):
                cp.advance(STEP, false)
            cp.render_enabled = true
            cp._render_frame()
        else:
            var bp := source as BSourcePlayer
            bp.advance(3.0)
            bp._render_frame()
        await process_frame
        await process_frame
        var cast_img := await save_frame("world_%02d_tick180" % num)
        var pass_frame: Arcana20SourcePassFrame = passes.get(id)
        var result := contamination(baseline, cast_img, viewer, pass_frame)
        result["skill"] = num
        stats.append(result)
        save_fields(id, pass_frame)
        check(int(result.get("inside_changed", 0)) > 0, "source transforms live scene %d" % num)
        check(int(result.get("outside_changed", -1)) == 0, "no changes outside explicit influence %d: %s" % [num, str(result)])
        if num == 2 or num == 17:
            var sprite := viewer.get("_sprite") as Sprite2D
            var local_anchor := Vector2(262, 104) if num == 2 else Vector2(250, 106)
            var field_world := pass_frame.source_to_world * local_anchor
            var before_screen := sprite.get_global_transform_with_canvas() * local_anchor
            camera.offset += Vector2(40, 20)
            camera.force_update_scroll()
            viewer.call("_update_camera_basis")
            await process_frame
            await process_frame
            var after_screen := sprite.get_global_transform_with_canvas() * local_anchor
            await save_frame("world_%02d_camera_plus_40_20" % num)
            check((after_screen - before_screen).distance_to(Vector2(-40, -20)) < 0.1 and (pass_frame.source_to_world * local_anchor).distance_to(field_world) < 0.001, "camera (+40,+20) preserves %d field world position and moves screen (-40,-20)" % num)
            camera.offset -= Vector2(40, 20)
            camera.force_update_scroll()
            viewer.call("_update_camera_basis")
        renderer.cancel_skill(id)
        passes.erase(id)
        await process_frame
        await process_frame
        var clear_img := await save_frame("world_%02d_cancelled" % num)
        check(images_equal(baseline, clear_img), "cast cancel restores frozen world %d" % num)
    # Exercise two real screen consumers concurrently, without turning either
    # into combat authority. Capture each state at frozen simulation ticks.
    renderer.queue_free()
    a_world.queue_free()
    b_world.queue_free()
    c_world.queue_free()
    await process_frame
    await process_frame
    var multi := Arcana20Renderer.new()
    multi.world_pass_mode = true
    multi.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(multi)
    var mount := Arcana20WorldPassMount.new()
    mount.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(mount)
    check(mount.attach(multi), "multi-cast diagnostic mount attached")
    var id2 := Arcana20SourceCatalog.canonical_id(2)
    var id3 := Arcana20SourceCatalog.canonical_id(3)
    var id10 := Arcana20SourceCatalog.canonical_id(10)
    multi.cast_skill(id2, player.global_position, enemy.global_position)
    var b2 := multi._casts[id2] as BSourcePlayer
    b2.set_process(false)
    b2.advance(3.0)
    b2._render_frame()
    await process_frame
    await process_frame
    var only_b := await save_frame("overlap_02_only")
    multi.cast_skill(id10, player.global_position, enemy.global_position)
    var c10 := multi._casts[id10] as CSourcePlayer
    c10.set_process(false)
    c10.render_enabled = false
    for tick in range(180): c10.advance(STEP, false)
    c10.render_enabled = true
    c10._render_frame()
    await process_frame
    await process_frame
    var both := await save_frame("overlap_02_10")
    check(mount.active_viewers(id2) == 1 and mount.active_viewers(id10) == 1 and not images_equal(only_b, both), "B and C simultaneous world viewers both active")
    multi.cancel_skill(id10)
    await process_frame
    await process_frame
    var after_c_cancel := await save_frame("overlap_after_10_cancel")
    check(mount.active_viewers(id10) == 0 and images_equal(only_b, after_c_cancel), "cancel one overlapping cast restores remaining B")
    multi.cast_skill(id3, player.global_position, enemy.global_position)
    var b3 := multi._casts[id3] as BSourcePlayer
    b3.set_process(false)
    b3.advance(3.0)
    b3._render_frame()
    await process_frame
    await process_frame
    var same_family := await save_frame("overlap_02_03")
    check(mount.active_viewers(id2) == 1 and mount.active_viewers(id3) == 1 and not images_equal(only_b, same_family), "two B source casts have independent world viewers")
    multi.cancel_skill(id3)
    await process_frame
    await process_frame
    check(images_equal(only_b, await save_frame("overlap_after_03_cancel")), "same-family cancellation preserves other cast")
    multi.cancel_skill(id2)
    await process_frame
    await process_frame
    check(images_equal(baseline, await save_frame("overlap_all_cancelled")), "overlap cancellation restores frozen world")
    var id5 := Arcana20SourceCatalog.canonical_id(5)
    multi.cast_skill(id5, player.global_position, enemy.global_position)
    var bloom := multi._casts[id5] as FusionPlayer
    bloom.set_process(false)
    for part in bloom._pending:
        var child: Node = part.node
        child.set("render_enabled", false)
    for tick in range(330): bloom.advance(STEP)
    for part in bloom._pending:
        var child: Node = part.node
        child.set("render_enabled", true)
        child.call("_render_frame")
    await process_frame
    await process_frame
    var bloom_img := await save_frame("fusion_05_candidate_tick330")
    check(mount.active_viewers(id5) == 2 and not images_equal(baseline, bloom_img), "A05 lead and C05 column fields share actual world")
    # C05's +0.6s fusion offset causes its source layer to finish before the
    # shared A05 timeline. Retire its world/post state without touching A05 or
    # another concurrent C-family cast.
    var bloom_post := Arcana20CViewportPost.new()
    bloom_post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(bloom_post)
    check(bloom_post.attach(multi), "C05 early-layer post diagnostic attaches")
    var bloom_c := bloom._pending[0].node as CSourcePlayer
    bloom_c._render_frame()
    check(bloom_post._states.has(id5), "C05 live layer publishes post state")
    check(multi.cast_skill(id10, player.global_position, enemy.global_position), "overlapping C10 remains active during C05 retirement")
    var overlap_c := multi._casts[id10] as CSourcePlayer
    overlap_c.set_process(false)
    for part in bloom._pending:
        var child: Node = part.node
        child.set("render_enabled", false)
    for tick in range(155): bloom.advance(STEP)
    for part in bloom._pending:
        var child: Node = part.node
        child.set("render_enabled", true)
        if bool(child.get("_active")): child.call("_render_frame")
    await process_frame
    await process_frame
    var live_bloom_layers: Dictionary = mount._passes.get(id5, {})
    check(bloom._active and live_bloom_layers.has(&"A") and not live_bloom_layers.has(&"C") and mount.active_viewers(id10) == 1, "C05 early completion removes only its layer while A05 and independent C10 remain")
    check(not bloom_post._states.has(id5) and not bloom_c._sprite.visible and not bloom_c._light_sprite.visible, "C05 early completion clears C post and legacy sprites")
    multi.cancel_skill(id10)
    bloom_post.detach()
    bloom_post.queue_free()
    multi.cancel_skill(id5)
    await process_frame
    await process_frame
    check(mount.active_viewers(id5) == 0 and images_equal(baseline, await save_frame("fusion_05_cancelled")), "A05 C05 candidate cleanup restores frozen world")
    var id1 := Arcana20SourceCatalog.canonical_id(1)
    multi.cast_skill(id1, player.global_position, enemy.global_position)
    var crown := multi._casts[id1] as FusionPlayer
    crown.set_process(false)
    for part in crown._pending:
        var child: Node = part.node
        child.set("render_enabled", false)
    for tick in range(246): crown.advance(STEP)
    for part in crown._pending:
        var child: Node = part.node
        child.set("render_enabled", true)
        child.call("_render_frame")
    await process_frame
    await process_frame
    var crown_img := await save_frame("fusion_01_candidate_tick246")
    check(mount.active_viewers(id1) == 2 and not images_equal(baseline, crown_img), "A01 crown and selected C01 outer flame share actual world")
    multi.cancel_skill(id1)
    await process_frame
    await process_frame
    check(mount.active_viewers(id1) == 0 and images_equal(baseline, await save_frame("fusion_01_cancelled")), "A01 C01 candidate cleanup restores frozen world")
    # Original C event horizon explicitly authors screen flash/shake/chroma.
    # The opt-in consumer affects the real world/actors before the real HUD;
    # disabled and cancel comparisons enforce no unrelated residual effects.
    var post := Arcana20CViewportPost.new()
    post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(post)
    check(post.attach(multi), "C viewport post opt-in attaches")
    await process_frame
    await process_frame
    check(not post._rect.visible and images_equal(baseline, await save_frame("c_viewport_post_idle")), "C viewport post idle causes no screen contamination")
    var horizon_id := Arcana20SourceCatalog.canonical_id(17)
    multi.cast_skill(horizon_id, player.global_position, enemy.global_position)
    var horizon := multi._casts[horizon_id] as CSourcePlayer
    horizon.set_process(false)
    horizon.render_enabled = false
    for tick in range(375): horizon.advance(STEP, false)
    horizon.render_enabled = true
    horizon._render_frame()
    await process_frame
    await process_frame
    check(post._states.has(horizon_id) and post._rect.visible, "C17 authored rebound activates actual viewport impulses")
    var post_image := await save_frame("c17_rebound_viewport_post")
    post._rect.visible = false
    await process_frame
    await process_frame
    var plain_image := await save_frame("c17_rebound_without_viewport_post")
    check(not images_equal(post_image, plain_image), "C17 authored screen impulse changes actual world viewport")
    # Test the opaque fill of the actual A0 provisions HUD. It is drawn on
    # layer 20 after the post's layer 10, not a synthetic HUD or sprite.
    var hud: Node = world.get("hud")
    var fill := hud.get("_provisions_fill") as ColorRect
    if fill == null:
        check(false, "C viewport post actual HUD fill missing")
    else:
        var hud_pixel := root.get_final_transform() * (fill.get_global_transform_with_canvas() * (fill.size * 0.5))
        var hx := clampi(roundi(hud_pixel.x), 0, post_image.get_width() - 1)
        var hy := clampi(roundi(hud_pixel.y), 0, post_image.get_height() - 1)
        check(post_image.get_pixel(hx, hy) == plain_image.get_pixel(hx, hy), "C viewport post keeps actual opaque HUD pixel unchanged")
    post._apply()
    var loom_id := Arcana20SourceCatalog.canonical_id(10)
    multi.cast_skill(loom_id, player.global_position, enemy.global_position)
    var loom := multi._casts[loom_id] as CSourcePlayer
    loom.set_process(false)
    loom.render_enabled = false
    for tick in range(120): loom.advance(STEP, false)
    loom.render_enabled = true
    loom._render_frame()
    await process_frame
    multi.cancel_skill(loom_id)
    await process_frame
    check(post._states.has(horizon_id) and post._rect.visible, "cancel overlapping C cast preserves remaining authored post")
    multi.cancel_skill(horizon_id)
    await process_frame
    await process_frame
    check(not post._rect.visible and post._states.is_empty() and images_equal(baseline, await save_frame("c17_viewport_post_cancelled")), "C viewport post cancel restores exact frozen world")
    post.detach()
    post.queue_free()
    var id11 := Arcana20SourceCatalog.canonical_id(11)
    multi.cast_skill(id11, player.global_position, enemy.global_position)
    var rotor := multi._casts[id11] as ASourcePlayer
    rotor.set_process(false)
    rotor.render_enabled = false
    for tick in range(180): rotor.advance(STEP, false)
    rotor.render_enabled = true
    rotor._render_frame()
    await process_frame
    await process_frame
    var rotor_img := await save_frame("fusion_11_candidate_tick180")
    var rotor_viewers: Dictionary = mount._passes.get(id11, {})
    var rotor_result := contamination(baseline, rotor_img, rotor_viewers.get(&"A"), rotor.source_pass_frame()) if rotor_viewers.has(&"A") else {"inside_changed": 0, "outside_changed": -1}
    check(mount.active_viewers(id11) == 1 and int(rotor_result.get("inside_changed", 0)) > 0 and int(rotor_result.get("outside_changed", -1)) == 0, "A11 rotor C bolt candidate affects real world inside source influence: " + str(rotor_result))
    multi.cancel_skill(id11)
    await process_frame
    await process_frame
    check(mount.active_viewers(id11) == 0 and images_equal(baseline, await save_frame("fusion_11_cancelled")), "A11 rotor candidate cleanup restores frozen world")
    var id16 := Arcana20SourceCatalog.canonical_id(16)
    var seed_hp_before := int(enemy.get("health"))
    multi.cast_skill(id16, player.global_position, enemy.global_position)
    var seed_fusion := multi._casts[id16] as FusionPlayer
    seed_fusion.set_process(false)
    var seed_growth := seed_fusion._pending[0].node as ASourcePlayer
    var seed_debris := seed_fusion._pending[1].node as CSourcePlayer
    seed_growth.render_enabled = false
    seed_debris.render_enabled = false
    for tick in range(330): seed_fusion.advance(STEP)
    seed_growth.render_enabled = true
    seed_debris.render_enabled = true
    seed_growth._render_frame()
    seed_debris._render_frame()
    await process_frame
    await process_frame
    var seed_img := await save_frame("fusion_16_candidate_tick330")
    var seed_fx := seed_debris._fx as CWorldseedDebris
    check(seed_fx.burst and seed_fx.particles.size() == 536 and seed_debris._tick == 468, "A16 bloom triggers full original C16 seed/spore/petal burst on shared clock")
    check(seed_growth.local_to_world(AWorldseedGrowth.C).distance_to(seed_debris.local_to_world(CWorldseedDebris.C)) < 0.01, "A16 and C16 source centers share the same real-world anchor")
    var seed_pass := seed_debris.source_pass_frame()
    check(seed_pass.seeds == PackedInt32Array([119785]) and seed_pass.caster_world.is_equal_approx(player.global_position), "C16 source metadata retains original seed and real caster")
    check(mount.active_viewers(id16) == 2 and not images_equal(baseline, seed_img), "A16 source growth C material and C16 debris affect actual world")
    var seed_post := Arcana20CViewportPost.new()
    seed_post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(seed_post)
    check(seed_post.attach(multi), "C16 viewport post diagnostic attaches")
    seed_debris._render_frame()
    check(seed_post._states.has(id16), "C16 original burst publishes post state")
    seed_growth.render_enabled = false
    seed_debris.render_enabled = false
    for tick in range(145): seed_fusion.advance(STEP)
    seed_growth.render_enabled = true
    seed_growth._render_frame()
    await process_frame
    await process_frame
    var seed_layers: Dictionary = mount._passes.get(id16, {})
    check(seed_fusion._active and seed_layers.has(&"A") and not seed_layers.has(&"C") and not seed_post._states.has(id16), "C16 source completion retires debris and post while A16 remains active")
    for tick in range(6): seed_fusion.advance(STEP)
    await process_frame
    await process_frame
    check(not multi._casts.has(id16) and mount.active_viewers(id16) == 0 and images_equal(baseline, await save_frame("fusion_16_naturally_finished")), "A16 C16 full fusion naturally finishes and restores world")
    check(int(enemy.get("health")) == seed_hp_before, "A16 C16 visual fusion never changes HP")
    seed_post.detach()
    seed_post.queue_free()
    check(multi.cast_skill(id16, player.global_position, enemy.global_position), "A16 C16 restart after natural finish")
    multi.cancel_skill(id16)
    await process_frame
    await process_frame
    check(mount.active_viewers(id16) == 0 and images_equal(baseline, await save_frame("fusion_16_cancelled")), "A16 C16 restart cancellation restores frozen world")
    var id20 := Arcana20SourceCatalog.canonical_id(20)
    multi.cast_skill(id20, player.global_position, enemy.global_position)
    var rift := multi._casts[id20] as CSourcePlayer
    rift.set_process(false)
    rift.render_enabled = false
    var rift_hp_before := int(enemy.get("health"))
    var previous_tick := 0
    # Frozen actual-world captures for authored opening/build phases. These
    # are native visual evidence, not source parity or gameplay authority.
    for phase_tick in [21, 120, 180, 240, 270]:
        for tick in range(phase_tick - previous_tick): rift.advance(STEP, false)
        previous_tick = phase_tick
        rift.render_enabled = true
        rift._render_frame()
        await process_frame
        await process_frame
        await save_frame("fusion_20_phase_tick%d" % phase_tick)
        rift.render_enabled = false
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    var rift_img := await save_frame("fusion_20_candidate_tick270")
    var rift_viewers: Dictionary = mount._passes.get(id20, {})
    var rift_result := contamination(baseline, rift_img, rift_viewers.get(&"C"), rift.source_pass_frame()) if rift_viewers.has(&"C") else {"inside_changed": 0, "outside_changed": -1}
    check(mount.active_viewers(id20) == 1 and int(rift_result.get("inside_changed", 0)) > 0 and int(rift_result.get("outside_changed", -1)) == 0, "C20 contour A pull transforms live world only within source influence: " + str(rift_result))
    # Original C20 explicitly authors a short screen invert at collision.
    # Test only the opt-in world/actor viewport consumer below the real HUD.
    rift.render_enabled = false
    for tick in range(126): rift.advance(STEP, false)
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    var rift_pre_post := await save_frame("fusion_20_collision_without_post")
    var post20 := Arcana20CViewportPost.new()
    post20.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(post20)
    check(post20.attach(multi), "C20 authored collision viewport post attaches")
    rift._render_frame()
    await process_frame
    await process_frame
    var rift_post := await save_frame("fusion_20_collision_with_post")
    var rift_post_state: Dictionary = post20._states.get(id20, {})
    check(float(rift_post_state.get("invert", 0.0)) == 1.0 and post20._rect.visible and not images_equal(rift_pre_post, rift_post), "C20 authored collision inversion changes actual viewport")
    if fill != null:
        var hpixel := root.get_final_transform() * (fill.get_global_transform_with_canvas() * (fill.size * 0.5))
        var hx := clampi(roundi(hpixel.x), 0, rift_post.get_width() - 1)
        var hy := clampi(roundi(hpixel.y), 0, rift_post.get_height() - 1)
        check(rift_post.get_pixel(hx, hy) == rift_pre_post.get_pixel(hx, hy), "C20 collision viewport post leaves actual opaque HUD pixel unchanged")
    await check_hud_isolation(hud as CanvasLayer, post20, rift_post, rift_pre_post)
    post20.detach()
    post20.queue_free()
    await process_frame
    await process_frame
    check(images_equal(rift_pre_post, await save_frame("fusion_20_collision_post_detached")), "C20 opt-in collision post detaches without residual contamination")
    rift.render_enabled = false
    for tick in range(24): rift.advance(STEP, false)
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    var block_frame := rift.source_pass_frame()
    var world_blocks := 0
    for p in range(CFrame.N):
        if block_frame.c_world_fragment[p * 4 + 2] > 0.0 and block_frame.c_world_fragment[p * 4 + 3] == 0.0: world_blocks += 1
    var block_image := await save_frame("fusion_20_blocks_tick420")
    var overlap_samples := 0
    var mapped_pixels := 0
    for i in range(0, block_frame.c_live_light_index.size(), 4):
        var count := int(block_frame.c_live_light_index[i + 1])
        if count > 0: mapped_pixels += 1
        if count > 1: overlap_samples += 1
    var c20_viewer := rift_viewers.get(&"C") as Arcana20CWorldPass
    check(block_frame.c_live_light_count > 0 and mapped_pixels > 0 and overlap_samples > 0 and c20_viewer != null, "A20 mapped real-ground additive debris preserves overlapping samples: operations=%d mapped_pixels=%d overlaps=%d" % [block_frame.c_live_light_count, mapped_pixels, overlap_samples])
    if c20_viewer != null:
        c20_viewer._material.set_shader_parameter("live_light_enabled", false)
        await process_frame
        await process_frame
        var no_debris := await save_frame("fusion_20_blocks_without_a_debris")
        check(not images_equal(block_image, no_debris), "A20 additive debris samples actual SOH world")
        c20_viewer._material.set_shader_parameter("live_light_enabled", true)
        await process_frame
        await process_frame
    var block_result := contamination(baseline, block_image, rift_viewers.get(&"C"), block_frame)
    check(world_blocks > 0 and int(block_result.get("inside_changed", 0)) > 0 and int(block_result.get("outside_changed", -1)) == 0, "C20 collision blocks sample actual world within source influence: fragments=" + str(world_blocks) + " " + str(block_result))
    rift.render_enabled = false
    for tick in range(90): rift.advance(STEP, false)
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    await save_frame("fusion_20_phase_tick510")
    rift.render_enabled = false
    for tick in range(60): rift.advance(STEP, false)
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    var out_frame := rift.source_pass_frame()
    var out_fragments := 0
    for p in range(CFrame.N):
        if out_frame.c_world_fragment[p * 4 + 2] > 0.0 and out_frame.c_world_fragment[p * 4 + 3] == 2.0: out_fragments += 1
    var out_image := await save_frame("fusion_20_out_tick570")
    var out_result := contamination(baseline, out_image, rift_viewers.get(&"C"), out_frame)
    check(out_fragments > 0 and int(out_result.get("inside_changed", 0)) > 0 and int(out_result.get("outside_changed", -1)) == 0, "C20 source OUT inversion affects actual world only inside influence: fragments=" + str(out_fragments) + " " + str(out_result))
    rift.render_enabled = false
    for tick in range(30): rift.advance(STEP, false)
    rift.render_enabled = true
    rift._render_frame()
    await process_frame
    await process_frame
    await save_frame("fusion_20_phase_tick600")
    check(int(enemy.get("health")) == rift_hp_before, "C20 full visual sequence never changes SOH HP without a confirmed hit")
    multi.cancel_skill(id20)
    await process_frame
    await process_frame
    check(mount.active_viewers(id20) == 0 and images_equal(baseline, await save_frame("fusion_20_cancelled")), "C20 A pull candidate cleanup restores frozen world")
    # Separately exercise natural finish; cancel above remains independently
    # covered. The source is simulated to its authored lifecycle end.
    check(multi.cast_skill(id20, player.global_position, enemy.global_position), "C20 natural finish cast starts")
    var finishing_rift := multi._casts[id20] as CSourcePlayer
    finishing_rift.set_process(false)
    finishing_rift.render_enabled = false
    for tick in range(630):
        if is_instance_valid(finishing_rift): finishing_rift.advance(STEP, false)
    await process_frame
    await process_frame
    check(not multi._casts.has(id20) and mount.active_viewers(id20) == 0 and images_equal(baseline, await save_frame("fusion_20_naturally_finished")), "C20 full lifecycle naturally finishes and restores frozen world")
    check(int(enemy.get("health")) == rift_hp_before, "C20 natural visual completion has no damage authority")
    var id19 := Arcana20SourceCatalog.canonical_id(19)
    multi.cast_skill(id19, player.global_position, enemy.global_position)
    var constellation := multi._casts[id19] as DSourcePlayer
    constellation.set_process(false)
    constellation.render_enabled = false
    for tick in range(120): constellation.advance(STEP)
    constellation.render_enabled = true
    constellation._render_frame()
    await process_frame
    await process_frame
    var constellation_img := await save_frame("world_19_candidate_tick120")
    check(mount.active_viewers(id19) == 1 and not images_equal(baseline, constellation_img), "D19 additive source field affects actual world")
    multi.cancel_skill(id19)
    await process_frame
    await process_frame
    check(mount.active_viewers(id19) == 0 and images_equal(baseline, await save_frame("world_19_cancelled")), "D19 candidate cleanup restores frozen world")
    # Exercise the actual AppFlow route change with a still-active #20 cast
    # and its opt-in viewport post, rather than cancelling it before exiting.
    var transition_post := Arcana20CViewportPost.new()
    transition_post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(transition_post)
    check(transition_post.attach(multi) and multi.cast_skill(id20, player.global_position, enemy.global_position), "C20 scene-transition diagnostic starts active cast and post")
    var transition_rift := multi._casts[id20] as CSourcePlayer
    transition_rift.set_process(false)
    transition_rift.render_enabled = false
    for tick in range(396): transition_rift.advance(STEP, false)
    transition_rift.render_enabled = true
    transition_rift._render_frame()
    await process_frame
    await process_frame
    check(mount.active_viewers(id20) == 1 and transition_post._rect.visible, "C20 world viewer and collision post active immediately before route change")
    var old_world_ref: WeakRef = weakref(world)
    var old_mount_ref: WeakRef = weakref(mount)
    var old_renderer_ref: WeakRef = weakref(multi)
    var old_post_ref: WeakRef = weakref(transition_post)
    var flow := root.get_node_or_null("AppFlow")
    if flow == null:
        check(false, "C20 route transition AppFlow missing")
    else:
        flow.call(&"open_home")
        check(await wait_route(app, &"home", 30000), "C20 actual AppFlow overworld-to-Home route succeeds")
        await process_frame
        await process_frame
        check(old_world_ref.get_ref() == null and old_mount_ref.get_ref() == null and old_renderer_ref.get_ref() == null and old_post_ref.get_ref() == null, "C20 active cast, world viewer and viewport post are freed on scene transition")
        var home_clean := await save_frame("fusion_20_transition_home")
        await process_frame
        await process_frame
        check(images_equal(home_clean, await save_frame("fusion_20_transition_home_stable")), "C20 scene transition leaves no changing viewport residue on frozen Home")

    var f := FileAccess.open(OUTPUT + "/contamination.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"stats": stats, "scope": "frozen actual overworld; one tick; experimental A/B/C terrain passes only; #04 is an unapproved redesign candidate; not source fidelity, gameplay, post, actor depth or approval"}, "  "))
    f.close()
    passes.clear()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()

## Actual post-draw intervals for #02 plus selected #10 or #20 on the real historical overworld.
## Shared software CI is a diagnostic only, never a target-device budget.
func _perf_percentile(values: Array[float], percentile: float) -> float:
    if values.is_empty(): return 0.0
    var sorted := values.duplicate()
    sorted.sort()
    return sorted[floori(float(sorted.size() - 1) * percentile)]

func _overlap_frame_probe(app: Node, world: Node, player: Node2D, enemy: Node2D) -> void:
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    world.add_child(renderer)
    var mount := Arcana20WorldPassMount.new()
    world.add_child(mount)
    check(mount.attach(renderer), "overlap perf source mount")
    var id2 := Arcana20SourceCatalog.canonical_id(2)
    var second_skill := 20 if OS.get_environment("ARCANA20_PERF_SECOND") == "20" else 10
    var id10 := Arcana20SourceCatalog.canonical_id(second_skill)
    var before_memory := Performance.get_monitor(Performance.MEMORY_STATIC)
    var before_objects := Performance.get_monitor(Performance.OBJECT_COUNT)
    var hp := int(enemy.get("health"))
    var accepted_2 := renderer.cast_skill(id2, player.global_position, enemy.global_position)
    var accepted_10 := renderer.cast_skill(id10, player.global_position, enemy.global_position)
    check(accepted_2 and accepted_10, "overlap perf casts accepted")
    await RenderingServer.frame_post_draw
    # Capture while BOTH casts are still active, before the timing sample.
    # Screenshot encoding/OS capture are excluded from frame intervals.
    check(mount.active_viewers(id2) > 0 and mount.active_viewers(id10) > 0, "overlap screenshot has both live source viewers")
    var perf_image := await save_frame("overlap_perf_live_viewport")
    var viewport_size := perf_image.get_size()
    var physical_path := ProjectSettings.globalize_path(OUTPUT + "/overlap_perf_live_physical.png")
    var capture_output: Array = []
    var capture_status := OS.execute("python3", [ProjectSettings.globalize_path("res://prototypes/arcana_fusion20/renderer/arcana20_capture_x11.py"), physical_path], capture_output, true)
    var physical: Image = Image.load_from_file(physical_path) if capture_status == 0 else null
    var physical_size := physical.get_size() if physical != null else Vector2i.ZERO
    var window_size := DisplayServer.window_get_size()
    var expected_resolution := OS.get_environment("RESOLUTION").split("x")
    if expected_resolution.size() == 2:
        var expected := Vector2i(int(expected_resolution[0]), int(expected_resolution[1]))
        check(physical_size == expected and viewport_size == expected and window_size == expected, "X11 capture, Godot viewport and game window match requested physical resolution: " + str(capture_output))
    check(mount.active_viewers(id2) > 0 and mount.active_viewers(id10) > 0, "both source viewers persist across overlap screenshot")
    perf_image = null
    physical = null
    await RenderingServer.frame_post_draw
    var samples: Array[float] = []
    var source_tick_start := -1
    var source_tick_end := -1
    var sampled_second: Node = renderer._casts.get(id10)
    if sampled_second is CSourcePlayer: source_tick_start = (sampled_second as CSourcePlayer)._tick
    var overlapping_frames := 0
    var live_memory := before_memory
    var live_objects := before_objects
    var last := Time.get_ticks_usec()
    for i in range(60):
        await RenderingServer.frame_post_draw
        var now := Time.get_ticks_usec()
        if mount.active_viewers(id2) > 0 and mount.active_viewers(id10) > 0:
            samples.append(float(now - last) / 1000.0)
            overlapping_frames += 1
            live_memory = Performance.get_monitor(Performance.MEMORY_STATIC)
            live_objects = Performance.get_monitor(Performance.OBJECT_COUNT)
        last = now
        if not renderer._casts.has(id2) or not renderer._casts.has(id10): break
    samples.sort()
    check(samples.size() >= 2, "overlap perf produced multiple actually concurrent rendered frames")
    var percentiles := {}
    if samples.size() > 0:
        var n := samples.size()
        percentiles = {"p50_ms": samples[floori((n - 1) * 0.50)], "p95_ms": samples[floori((n - 1) * 0.95)], "p99_ms": samples[floori((n - 1) * 0.99)]}
    if is_instance_valid(sampled_second) and sampled_second is CSourcePlayer: source_tick_end = (sampled_second as CSourcePlayer)._tick
    var record := {"scope": "concurrent #02+#%02d sampled frames on real historical overworld; shared software-rendered CI, not a target-device budget or full-cast measurement" % second_skill,
        "second_source_tick_start": source_tick_start, "second_source_tick_end": source_tick_end,
        "viewport_capture_size": [viewport_size.x, viewport_size.y],
        "physical_capture_size": [physical_size.x, physical_size.y],
        "window_size": [window_size.x, window_size.y],
        "overlap_frames": overlapping_frames, "post_draw_intervals": percentiles,
        "static_bytes_live_delta": live_memory - before_memory,
        "live_object_delta": live_objects - before_objects,
        "allocation_count": "not exposed by this Godot diagnostic",
        "enemy_hp_before": hp, "enemy_hp_after": int(enemy.get("health"))}
    if is_instance_valid(sampled_second) and sampled_second is CSourcePlayer:
        var cpu_source := sampled_second as CSourcePlayer
        if cpu_source.profile_cpu and not cpu_source.profile_clear_us.is_empty():
            record["cpu_scope"] = "C source-side CPU wall time in microseconds; texture submission is asynchronous, not GPU time"
            record["cpu_sample_count"] = cpu_source.profile_clear_us.size()
            record["cpu_clear_p50_p95_p99_us"] = [_perf_percentile(cpu_source.profile_clear_us, 0.50), _perf_percentile(cpu_source.profile_clear_us, 0.95), _perf_percentile(cpu_source.profile_clear_us, 0.99)]
            record["cpu_raster_p50_p95_p99_us"] = [_perf_percentile(cpu_source.profile_raster_us, 0.50), _perf_percentile(cpu_source.profile_raster_us, 0.95), _perf_percentile(cpu_source.profile_raster_us, 0.99)]
            record["cpu_pack_p50_p95_p99_us"] = [_perf_percentile(cpu_source.profile_pack_us, 0.50), _perf_percentile(cpu_source.profile_pack_us, 0.95), _perf_percentile(cpu_source.profile_pack_us, 0.99)]
            record["cpu_submit_p50_p95_p99_us"] = [_perf_percentile(cpu_source.profile_submit_us, 0.50), _perf_percentile(cpu_source.profile_submit_us, 0.95), _perf_percentile(cpu_source.profile_submit_us, 0.99)]
    var second_viewers: Dictionary = mount._passes.get(id10, {})
    if second_viewers.has(&"C"):
        var c_viewer := second_viewers[&"C"] as Arcana20CWorldPass
        record["c_field_upload_counts"] = c_viewer.upload_counts.duplicate()
        record["c_field_raw_upload_bytes"] = c_viewer.uploaded_bytes
        record["c_field_upload_scope"] = "raw Image bytes submitted to C viewer since cast start, not GPU allocations or bandwidth"
    check(int(enemy.get("health")) == hp, "overlap visuals have no damage authority")
    renderer.cancel_all()
    await process_frame
    await process_frame
    check(mount.active_viewers(id2) == 0 and mount.active_viewers(id10) == 0, "overlap cancellation removes both source viewers")
    record["static_bytes_after_cancel_delta"] = Performance.get_monitor(Performance.MEMORY_STATIC) - before_memory
    record["objects_after_cancel_delta"] = Performance.get_monitor(Performance.OBJECT_COUNT) - before_objects
    print("JOIN_RENDERED_FRAME_PERF ", JSON.stringify(record))
    var file := FileAccess.open(OUTPUT + "/overlap_frame_perf.json", FileAccess.WRITE)
    file.store_string(JSON.stringify(record, "  "))
    file.close()
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()

## Live real-world input probe. The cast is deliberately injected by the test;
## this is NOT a claim that SOH's gameplay skill routing is already bound.
func _live_input_probe(app: Node, world: Node, player: CharacterBody2D, enemy: Node2D, camera: Camera2D) -> void:
    var terrain: Node = world.get("world")
    var choices := [
        {"action": &"move_right", "direction": Vector2.RIGHT},
        {"action": &"move_left", "direction": Vector2.LEFT},
        {"action": &"move_down", "direction": Vector2.DOWN},
        {"action": &"move_up", "direction": Vector2.UP},
    ]
    var action: StringName = &""
    for choice in choices:
        var direction: Vector2 = choice.direction
        if bool(terrain.call("is_walkable", player.global_position + direction * 24.0, 6.0)):
            action = choice.action
            break
    if action == &"":
        check(false, "live input no safe adjacent direction")
        app.queue_free()
        await process_frame
        _finish()
        return
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    world.add_child(renderer)
    var mount := Arcana20WorldPassMount.new()
    world.add_child(mount)
    check(mount.attach(renderer), "live input world mount")
    var world_anchor := player.global_position
    var screen_target := root.get_final_transform() * (player.get_global_transform_with_canvas() * Vector2(90, -20))
    var motion := InputEventMouseMotion.new()
    motion.position = screen_target
    Input.parse_input_event(motion)
    # Let the actual Knight _input/_unhandled_input path accept the pointer;
    # parse_input_event does not move the OS cursor for get_global_mouse_position.
    var press := InputEventMouseButton.new()
    press.position = screen_target
    press.button_index = MOUSE_BUTTON_RIGHT
    press.pressed = true
    Input.parse_input_event(press)
    # Parsed input is dispatched on the scene loop, not synchronously.
    await process_frame
    await process_frame
    var aimed: Vector2 = player.get("_pending_rmb_aim_world")
    # The owner may have consumed the valid flag on the intervening physics
    # frame; the captured world point remains in its input state.
    var aim_valid := not aimed.is_zero_approx()
    var release := InputEventMouseButton.new()
    release.position = screen_target
    release.button_index = MOUSE_BUTTON_RIGHT
    release.pressed = false
    Input.parse_input_event(release)
    var id := Arcana20SourceCatalog.canonical_id(2)
    check(renderer.cast_skill(id, world_anchor, aimed), "live input source cast accepted (diagnostic injection)")
    var source := renderer._casts[id] as BSourcePlayer
    var initial_transform := source.source_pass_frame().source_to_world
    var before_player := player.global_position
    var before_enemy := enemy.global_position
    var before_camera := camera.get_screen_center_position()
    var hp := int(enemy.get("health"))
    enemy.set_physics_process(true)
    Input.action_press(action)
    var elapsed_frames: Array[float] = []
    var before_memory := Performance.get_monitor(Performance.MEMORY_STATIC)
    var last_frame := Time.get_ticks_usec()
    for frame in range(35):
        await physics_frame
        var now := Time.get_ticks_usec()
        elapsed_frames.append(float(now - last_frame) / 1000.0)
        last_frame = now
    Input.action_release(action)
    await process_frame
    await process_frame
    var after_player := player.global_position
    var after_enemy := enemy.global_position
    var after_camera := camera.get_screen_center_position()
    var by_family: Dictionary = mount._passes.get(id, {})
    var stable_anchor := false
    if by_family.has(&"B"):
        var sprite := (by_family[&"B"] as Node).get("_sprite") as Sprite2D
        stable_anchor = sprite.global_transform.is_equal_approx(initial_transform) and source.source_pass_frame().source_to_world.is_equal_approx(initial_transform)
    elapsed_frames.sort()
    var count := elapsed_frames.size()
    var samples := {"count": count, "p50_ms": elapsed_frames[mini(count - 1, floori((count - 1) * 0.50))],
        "p95_ms": elapsed_frames[mini(count - 1, floori((count - 1) * 0.95))],
        "p99_ms": elapsed_frames[mini(count - 1, floori((count - 1) * 0.99))]}
    var record := {"scope": "real historical world live input, injected #02 visual; intervals between physics signals on shared software CI, not rendered frame latency, target budget, allocation count or gameplay binding",
        "action": String(action), "player_before": str(before_player), "player_after": str(after_player),
        "player_distance": before_player.distance_to(after_player), "enemy_distance": before_enemy.distance_to(after_enemy),
        "camera_distance": before_camera.distance_to(after_camera), "aimed_world": str(aimed), "source_tick": source.source_tick,
        "actor_hp_before": hp, "actor_hp_after": int(enemy.get("health")), "source_anchor_consistent": stable_anchor,
        "physics_signal_intervals": samples, "static_memory_delta_bytes": Performance.get_monitor(Performance.MEMORY_STATIC) - before_memory}
    check(aim_valid and aimed.distance_to(world_anchor + Vector2(90, -20)) < 5.0, "live input pointer maps to real world aim")
    check(before_player.distance_to(after_player) > 1.0, "live input moves actual SOH player during active cast")
    check(before_enemy.distance_to(after_enemy) > 0.1, "live input observes natural real enemy movement")
    check(int(enemy.get("health")) == hp, "injected visual cast never mutates enemy health")
    check(stable_anchor, "live input source field remains attached to authored world transform")
    print("JOIN_LIVE_INPUT ", JSON.stringify(record))
    var file := FileAccess.open(OUTPUT + "/live_input.json", FileAccess.WRITE)
    file.store_string(JSON.stringify(record, "  "))
    file.close()
    await save_frame("live_input_02")
    renderer.cancel_skill(id)
    await process_frame
    # Separate real-time #20 motion probe: cast-local world transform is fixed
    # at the selected aim, not homed to subsequently moving caster/enemy.
    # This is visual-only: no collision volume or damage receipt is invented.
    var rift_id := Arcana20SourceCatalog.canonical_id(20)
    var rift_start := player.global_position
    var rift_aim := rift_start + Vector2(160, 20)
    var rift_enemy_start := enemy.global_position
    var rift_hp := int(enemy.get("health"))
    check(renderer.cast_skill(rift_id, rift_start, rift_aim), "live C20 visual cast accepts real-world direction")
    var rift_source := renderer._casts[rift_id] as CSourcePlayer
    var rift_transform := rift_source.source_pass_frame().source_to_world
    check(rift_source.local_to_world(CRealityRipperFusion.CENTER).distance_to(rift_aim) < 0.1, "live C20 source axis matches selected world-space direction")
    # The real Skeleton AI can enter a stationary attack state. Drive the
    # actual CharacterBody2D through move_and_collide during this probe rather
    # than claiming it happened to move naturally or teleporting a fake actor.
    var moving_enemy := enemy as CharacterBody2D
    var enemy_direction := Vector2.ZERO
    if moving_enemy != null:
        moving_enemy.set_physics_process(false)
        for direction in [Vector2.RIGHT, Vector2.LEFT, Vector2.DOWN, Vector2.UP]:
            if bool(terrain.call("is_walkable", enemy.global_position + direction * 24.0, 6.0)):
                enemy_direction = direction
                break
    check(moving_enemy != null and not enemy_direction.is_zero_approx(), "live C20 actual enemy has a test-driven traversable motion direction")
    Input.action_press(action)
    for frame in range(12):
        await physics_frame
        if moving_enemy != null and not enemy_direction.is_zero_approx(): moving_enemy.move_and_collide(enemy_direction * 1.0)
    Input.action_release(action)
    await process_frame
    await process_frame
    var rift_player_distance := rift_start.distance_to(player.global_position)
    var rift_enemy_distance := rift_enemy_start.distance_to(enemy.global_position)
    var rift_stable := rift_source.source_pass_frame().source_to_world.is_equal_approx(rift_transform)
    check(rift_player_distance > 0.1 and rift_enemy_distance > 0.1 and rift_stable, "live C20 keeps nonhoming world anchor while real player and enemy move")
    check(int(enemy.get("health")) == rift_hp, "live C20 visual movement never changes enemy HP")
    print("JOIN_C20_LIVE ", JSON.stringify({"scope": "real historical overworld; visual injection and test-driven real enemy physics; no hit-volume proof", "player_distance": rift_player_distance, "enemy_distance": rift_enemy_distance, "source_tick": rift_source._tick, "anchor_stable": rift_stable, "hp_before": rift_hp, "hp_after": int(enemy.get("health"))}))
    await save_frame("live_input_20")
    renderer.cancel_skill(rift_id)
    await process_frame
    check(mount.active_viewers(rift_id) == 0, "live C20 cancellation removes world viewer")
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()

# Disable intermediate raster while still advancing each authentic source tick.
func _phase_set_render(source: Node, enabled: bool) -> void:
    if source is FusionPlayer:
        for part in (source as FusionPlayer)._pending:
            var child: Node = part.node
            if is_instance_valid(child): child.set("render_enabled", enabled)
    elif source is ASourcePlayer or source is CSourcePlayer or source is DSourcePlayer:
        source.set("render_enabled", enabled)

func _phase_advance(source: Node) -> void:
    if source is FusionPlayer: (source as FusionPlayer).advance(STEP)
    elif source is ASourcePlayer: (source as ASourcePlayer).advance(STEP, false)
    elif source is CSourcePlayer: (source as CSourcePlayer).advance(STEP, false)
    elif source is DSourcePlayer: (source as DSourcePlayer).advance(STEP)
    elif source is BSourcePlayer: (source as BSourcePlayer).advance(STEP)

func _phase_draw(source: Node) -> void:
    if source is FusionPlayer:
        for part in (source as FusionPlayer)._pending:
            var child: Node = part.node
            if is_instance_valid(child) and bool(child.get("_active")): child.call("_render_frame")
    else:
        source.call("_render_frame")

## Same frozen real overworld + actual real enemy across catalog-relative source
## ticks. These are output inspection frames, not source matching, combat,
## selected-phase correctness, GPU/device performance or creator approval.
func _phase_sweep(app: Node, world: Node, player: Node2D, enemy: Node2D, camera: Camera2D) -> void:
    app.process_mode = Node.PROCESS_MODE_DISABLED
    var lighting := OS.get_environment("ARCANA20_PHASE_LIGHT")
    if lighting == "dimmed":
        # Exercise the real scene's existing WorldTint node, not an invented
        # battlefield or a change to the authored effects. This is an explicit
        # test stimulus, not a claim the game has an authored night cycle.
        var world_tint := world.get_node_or_null("WorldTint") as CanvasModulate
        check(world_tint != null, "phase sweep finds actual world tint")
        if world_tint != null: world_tint.color *= Color(0.4, 0.4, 0.4, 1.0)
    else:
        lighting = "normal"
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    renderer.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(renderer)
    var mount := Arcana20WorldPassMount.new()
    mount.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(mount)
    check(mount.attach(renderer), "all20 multi-phase world mount")
    var post := Arcana20CViewportPost.new()
    post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(post)
    check(post.attach(renderer), "all20 multi-phase experimental real-viewport post")
    camera.force_update_scroll()
    await process_frame
    await process_frame
    var baseline := await save_frame("phase_baseline")
    var first := clampi(int(OS.get_environment("ARCANA20_PHASE_FIRST")), 1, 20)
    var records: Array = []
    for num in range(first, mini(21, first + 5)):
        var id := Arcana20SourceCatalog.canonical_id(num)
        var slot := Arcana20SourceCatalog.slot(num)
        var climax := float(slot.climax)
        var duration := float(slot.duration)
        var targets := [30, maxi(31, roundi(climax * 0.5 * 60.0)), roundi((climax - 0.15) * 60.0), roundi(climax * 60.0), roundi((climax + duration) * 30.0), roundi((duration - 0.1) * 60.0)]
        var labels := ["early", "build", "pre_catalog_climax", "catalog_climax", "aftermath", "late"]
        var accepted := renderer.cast_skill(id, player.global_position, enemy.global_position)
        if not accepted or not renderer._casts.has(id):
            check(false, "phase sweep cast starts %d" % num)
            continue
        var source: Node = renderer._casts[id]
        source.set_process(false)
        var native_duration := float(source.get("duration"))
        _phase_set_render(source, false)
        var previous := 0
        var samples: Array = []
        for sample_index in range(targets.size()):
            var requested := int(targets[sample_index])
            for tick in range(maxi(0, requested - previous)):
                if not renderer._casts.has(id): break
                _phase_advance(source)
            previous = requested
            if not renderer._casts.has(id):
                samples.append({"label": labels[sample_index], "requested_tick": requested, "expired_before_sample": true})
                continue
            _phase_set_render(source, true)
            _phase_draw(source)
            await process_frame
            await process_frame
            var image := await save_frame("phase_%02d_%s_tick%d" % [num, labels[sample_index], requested])
            var tick_value := int(source.get("source_tick")) if source is BSourcePlayer else int(source.get("_tick"))
            var families: Dictionary = mount._passes.get(id, {})
            samples.append({"label": labels[sample_index], "requested_tick": requested, "native_tick": tick_value,
                "families": families.keys(), "changed_world_image": not images_equal(baseline, image)})
            _phase_set_render(source, false)
        renderer.cancel_skill(id)
        await process_frame
        await process_frame
        var cleared := await save_frame("phase_%02d_cleared" % num)
        var restored := images_equal(baseline, cleared) and mount.active_viewers(id) == 0 and not post._states.has(id)
        check(restored, "phase sweep cancellation restores actual world %d" % num)
        var row := {"id": num, "lighting_stimulus": lighting, "experimental_c_post_enabled": true, "catalog_duration": duration, "native_duration": native_duration, "samples": samples, "restored": restored}
        records.append(row)
        print("JOIN_PHASE ", JSON.stringify(row))
    var out := FileAccess.open(OUTPUT + "/phase_sweep_%02d.json" % first, FileAccess.WRITE)
    out.store_string(JSON.stringify({"scope": "frozen historical real overworld; normal or test-dimmed WorldTint; experimental C viewport post; six catalog-relative ticks; no source parity, gameplay, target-device, or creator approval", "records": records}, "  "))
    out.close()
    post.detach()
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()

## Frozen-world matrix: smoke/anchoring only. No production performance or
## visual/source approval; all captures use the independently pinned route.
func _sweep_all20(app: Node, world: Node, player: Node2D, enemy: Node2D, camera: Camera2D) -> void:
    app.process_mode = Node.PROCESS_MODE_DISABLED
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    renderer.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(renderer)
    var mount := Arcana20WorldPassMount.new()
    mount.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(mount)
    check(mount.attach(renderer), "all20 sweep opt-in world mount")
    camera.force_update_scroll()
    await process_frame
    await process_frame
    var baseline := await save_frame("sweep_baseline")
    camera.offset += Vector2(40, 20)
    camera.force_update_scroll()
    await process_frame
    await process_frame
    await save_frame("sweep_baseline_shifted")
    camera.offset -= Vector2(40, 20)
    camera.force_update_scroll()
    await process_frame
    await process_frame
    var records: Array = []
    for num in range(1, 21):
        var id := Arcana20SourceCatalog.canonical_id(num)
        var memory_before := Performance.get_monitor(Performance.MEMORY_STATIC)
        var started := Time.get_ticks_usec()
        var accepted := renderer.cast_skill(id, player.global_position, enemy.global_position)
        if not accepted or not renderer._casts.has(id):
            check(false, "all20 cast available %d" % num)
            records.append({"id": num, "failure": "cast rejected"})
            continue
        var source: Node = renderer._casts[id]
        source.set_process(false)
        if source is FusionPlayer:
            for part in (source as FusionPlayer)._pending:
                var child: Node = part.node
                child.set("render_enabled", false)
            for tick in range(120): (source as FusionPlayer).advance(STEP)
            for part in (source as FusionPlayer)._pending:
                var child: Node = part.node
                child.set("render_enabled", true)
                child.call("_render_frame")
        elif source is ASourcePlayer:
            var a := source as ASourcePlayer
            a.render_enabled = false
            for tick in range(120): a.advance(STEP, false)
            a.render_enabled = true
            a._render_frame()
        elif source is CSourcePlayer:
            var c := source as CSourcePlayer
            c.render_enabled = false
            for tick in range(120): c.advance(STEP, false)
            c.render_enabled = true
            c._render_frame()
        elif source is DSourcePlayer:
            var d := source as DSourcePlayer
            d.render_enabled = false
            for tick in range(120): d.advance(STEP)
            d.render_enabled = true
            d._render_frame()
        elif source is BSourcePlayer:
            var b := source as BSourcePlayer
            b.advance(2.0)
            b._render_frame()
        else:
            check(false, "all20 source pass producer %d" % num)
        var source_snapshot_ms := float(Time.get_ticks_usec() - started) / 1000.0
        await process_frame
        await process_frame
        var cast_image := await save_frame("sweep_%02d" % num)
        var by_family: Dictionary = mount._passes.get(id, {})
        var screen_positions := {}
        var world_transforms := {}
        for family in by_family:
            var viewer: Node2D = by_family[family]
            var sprite := viewer.get("_sprite") as Sprite2D
            world_transforms[family] = sprite.global_transform
            screen_positions[family] = root.get_final_transform() * (sprite.get_global_transform_with_canvas() * Vector2.ZERO)
        camera.offset += Vector2(40, 20)
        camera.force_update_scroll()
        for viewer in by_family.values(): viewer.call("_update_camera_basis")
        await process_frame
        await process_frame
        await save_frame("sweep_%02d_shifted" % num)
        var world_fixed := true
        var screen_delta := Vector2.ZERO
        for family in by_family:
            var sprite := (by_family[family] as Node).get("_sprite") as Sprite2D
            var before_world: Transform2D = world_transforms[family]
            var before_screen: Vector2 = screen_positions[family]
            world_fixed = world_fixed and sprite.global_transform.is_equal_approx(before_world)
            screen_delta = root.get_final_transform() * (sprite.get_global_transform_with_canvas() * Vector2.ZERO) - before_screen
            # The logical canvas must move by -camera even if output scaling
            # changes physical pixel size.
            var logical_delta := root.get_final_transform().affine_inverse().basis_xform(screen_delta)
            world_fixed = world_fixed and logical_delta.distance_to(Vector2(-40, -20)) < 0.1
        camera.offset -= Vector2(40, 20)
        camera.force_update_scroll()
        for viewer in by_family.values(): viewer.call("_update_camera_basis")
        check(not by_family.is_empty(), "all20 viewer exists %d" % num)
        check(world_fixed and not by_family.is_empty(), "all20 field transform camera anchoring %d" % num)
        renderer.cancel_skill(id)
        await process_frame
        await process_frame
        var cleared := await save_frame("sweep_%02d_cleared" % num)
        var restored := images_equal(baseline, cleared)
        check(restored and mount.active_viewers(id) == 0, "all20 cancellation restores world %d" % num)
        var record := {"id": num, "tick": 120, "families": by_family.keys(), "world_changed": not images_equal(baseline, cast_image),
            "camera_pixel_delta": [screen_delta.x, screen_delta.y], "anchored": world_fixed,
            "restored": restored, "single_source_snapshot_ms": source_snapshot_ms,
            "static_memory_delta_bytes": Performance.get_monitor(Performance.MEMORY_STATIC) - memory_before}
        records.append(record)
        print("JOIN_SWEEP ", JSON.stringify(record))
    var file := FileAccess.open(OUTPUT + "/all20_sweep.json", FileAccess.WRITE)
    file.store_string(JSON.stringify({"scope": "frozen historical overworld; tick 120 only; not target performance or visual acceptance", "records": records}, "  "))
    file.close()
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()

func save_fields(id: StringName, frame: Arcana20SourcePassFrame) -> void:
    if frame == null:
        return
    var prefix := OUTPUT + "/" + String(id)
    var fields := {}
    if frame.family == &"A":
        fields = {"ink.rgb32f": frame.a_rgb.to_byte_array(), "ink_coverage.f32": frame.a_coverage.to_byte_array(),
            "multiplier.f32": frame.a_multiplier.to_byte_array(), "warp.rg32f": frame.a_world_warp.to_byte_array(), "influence.u8": frame.a_influence,
            "bloom.rgb32f": frame.a_bloom_rgb.to_byte_array()}
    elif frame.family == &"C":
        fields = {"ground.rgba8": frame.c_ground, "ground_coverage.f32": frame.c_ground_coverage.to_byte_array(),
            "ink.rgba32f": frame.c_ink.to_byte_array(), "light.rgba32f": frame.c_light.to_byte_array(),
            "displacement.rgba32f": frame.c_disp.to_byte_array(), "fragment.rgba32f": frame.c_world_fragment.to_byte_array(),
            "influence.u8": frame.c_influence}
    else:
        fields = {"ink.rgb32f": frame.b_ink_rgb.to_byte_array(), "ink_coverage.f32": frame.b_ink_coverage.to_byte_array(),
            "ground.rgb32f": frame.b_ground_rgb.to_byte_array(), "ground_coverage.f32": frame.b_ground_coverage.to_byte_array(),
            "shade.f32": frame.b_shade.to_byte_array(), "light.rgb32f": frame.b_light.to_byte_array(),
            "warp.rg32f": frame.b_world_warp.to_byte_array(), "influence.u8": frame.b_influence}
    for name in fields:
        var file := FileAccess.open(prefix + "." + String(name), FileAccess.WRITE)
        file.store_buffer(fields[name])
        file.close()
    var manifest := FileAccess.open(prefix + ".json", FileAccess.WRITE)
    manifest.store_string(JSON.stringify({"family": frame.family, "variant": frame.variant, "tick": frame.tick,
        "source_time": frame.source_time, "seeds": Array(frame.seeds), "source_size": [frame.source_size.x, frame.source_size.y],
        "source_to_world": [frame.source_to_world.x.x, frame.source_to_world.x.y, frame.source_to_world.y.x, frame.source_to_world.y.y, frame.source_to_world.origin.x, frame.source_to_world.origin.y],
        "flash": [frame.flash.x, frame.flash.y, frame.flash.z], "shake": [frame.shake.x, frame.shake.y], "chroma": frame.chroma,
        "scope": "raw source fields, not final world acceptance"}, "  "))
    manifest.close()

func images_equal(before: Image, after: Image) -> bool:
    if before == null or after == null or before.get_size() != after.get_size():
        return false
    return before.get_data() == after.get_data()

func contamination(before: Image, after: Image, viewer: Node2D, frame: Arcana20SourcePassFrame) -> Dictionary:
    if before == null or after == null or frame == null or before.get_size() != after.get_size():
        return {"outside_changed": -1, "reason": "image/frame missing"}
    var sprite := viewer.get("_sprite") as Sprite2D
    var influence: PackedByteArray
    if frame.family == &"A":
        influence = (viewer as Arcana20AWorldPass)._bloom_influence(frame.a_influence)
    elif frame.family == &"B":
        influence = frame.b_influence
    else:
        influence = frame.c_influence
    var transform := root.get_final_transform() * sprite.get_global_transform_with_canvas()
    var inverse := transform.affine_inverse()
    var outside := 0
    var inside := 0
    var total := 0
    for y in range(before.get_height()):
        for x in range(before.get_width()):
            if before.get_pixel(x, y) == after.get_pixel(x, y):
                continue
            total += 1
            var p := inverse * Vector2(float(x) + 0.5, float(y) + 0.5)
            var influenced := false
            # Two source pixels of conservative raster/sampling border.
            for oy in range(-2, 3):
                for ox in range(-2, 3):
                    var sx := floori(p.x) + ox
                    var sy := floori(p.y) + oy
                    if sx >= 0 and sy >= 0 and sx < frame.source_size.x and sy < frame.source_size.y and influence[sy * frame.source_size.x + sx] != 0:
                        influenced = true
                        break
                if influenced:
                    break
            if influenced:
                inside += 1
            else:
                outside += 1
    return {"changed": total, "inside_changed": inside, "outside_changed": outside}

func _finish() -> void:
    print("ARCANA20_JOIN_DIAGNOSTIC ", "PASS" if failures.is_empty() else "FAIL", " ", JSON.stringify(failures))
    quit(0 if failures.is_empty() else 1)
