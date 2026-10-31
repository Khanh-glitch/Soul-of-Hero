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
    mount.detach()
    mount.queue_free()
    multi.queue_free()
    await process_frame

    var f := FileAccess.open(OUTPUT + "/contamination.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"stats": stats, "scope": "frozen actual overworld; one tick; experimental A/B/C terrain passes only; #04 is an unapproved redesign candidate; not source fidelity, gameplay, post, actor depth or approval"}, "  "))
    f.close()
    passes.clear()
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
