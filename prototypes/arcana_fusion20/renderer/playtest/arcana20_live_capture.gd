## Development-only real-route, real-time visual capture. No owner combat hit
## request, target teleport, frozen world, fixed-step injection or approval.
extends Node

var host: Node
var cast_id: StringName
var finished := false
var ticks_seen: Array[int] = []
var contacts: Array = []
var unbound_contacts: Array = []
var samples: Array = []
var capture_start_usec := 0
var crown_probe_next := 0
const CROWN_PROBE_TARGETS := [120, 233]

func _fail(message: String) -> void:
    for action in [&"move_right", &"move_down", &"move_left", &"move_up"]:
        Input.action_release(action)
    push_error("AVFX_LIVE_FAIL " + message)
    get_tree().quit(1)

func _route() -> bool:
    var app: Node = host.get("app")
    if not await host.call(&"_wait_route", &"title", 30000): return false
    var new_game := app.find_child("NewGameButton", true, false) as Button
    if new_game == null or not new_game.is_visible_in_tree() or new_game.disabled: return false
    await host.call(&"_click", get_viewport().get_final_transform() * new_game.get_global_rect().get_center())
    if not await host.call(&"_wait_route", &"home", 30000): return false
    var home := app.get_node("RouteHost").get_child(0)
    var destinations: Dictionary = home.get("_destinations")
    var gate := destinations.get(&"campaign") as Node2D
    if gate == null: return false
    await host.call(&"_click", get_viewport().get_final_transform() * gate.get_global_transform_with_canvas().origin)
    var deadline := Time.get_ticks_msec() + 30000
    while Time.get_ticks_msec() < deadline and StringName(home.call(&"get_current_function")) != &"campaign":
        await get_tree().process_frame
    var enter := home.find_child("EnterOverworldButton", true, false) as Button
    if enter == null or not enter.is_visible_in_tree() or enter.disabled: return false
    await host.call(&"_click", get_viewport().get_final_transform() * enter.get_global_rect().get_center())
    if not await host.call(&"_wait_route", &"overworld", 30000): return false
    deadline = Time.get_ticks_msec() + 90000
    while Time.get_ticks_msec() < deadline and not is_instance_valid(host.get("renderer")):
        await get_tree().process_frame
    return is_instance_valid(host.get("renderer")) and is_instance_valid(host.get("player"))

func _frame(path: String, player: Node2D, enemy: Node2D, camera: Camera2D) -> bool:
    await RenderingServer.frame_post_draw
    # Presentation timestamp must precede synchronous PNG encoding and disk
    # I/O; otherwise variable save latency is attributed to the wrong frame.
    var presented_usec := Time.get_ticks_usec()
    var image := get_viewport().get_texture().get_image()
    if image == null or image.is_empty(): return false
    var index := samples.size()
    var name := "frame_%05d.png" % index
    if image.save_png(path + "/" + name) != OK: return false
    var enemy_pos := enemy.global_position if is_instance_valid(enemy) else Vector2.ZERO
    samples.append({"file": name, "wall_s": float(presented_usec - capture_start_usec) / 1000000.0, "source_tick_last_observed": ticks_seen[-1] if not ticks_seen.is_empty() else 0,
        "player": [player.global_position.x, player.global_position.y], "enemy": [enemy_pos.x, enemy_pos.y],
        "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y]})
    if OS.get_environment("AVFX_CROWN_MATCHED") == "1" and not await _crown_matched_probe(path, player, camera): return false
    return true

# Strictly diagnostic matched captures. Existing real-world actor/camera and
# BOTH authentic fusion child ticks are frozen, then only the presentation
# uniform is switched old/new/old with four completed draws per state.
func _crown_matched_probe(path: String, player: Node2D, camera: Camera2D) -> bool:
    if crown_probe_next >= CROWN_PROBE_TARGETS.size(): return true
    var renderer := host.get("renderer") as Arcana20Renderer
    if not is_instance_valid(renderer) or not renderer.is_active(cast_id): return true
    var fusion := renderer._casts.get(cast_id) as FusionPlayer
    if not is_instance_valid(fusion) or fusion._tick < CROWN_PROBE_TARGETS[crown_probe_next]: return true
    var mount := host.get("mount") as Arcana20WorldPassMount
    var viewer := (mount._passes.get(cast_id, {}) as Dictionary).get(&"A") as Arcana20AWorldPass
    if not is_instance_valid(viewer) or viewer._material == null: return false
    var tree := get_tree()
    var actors: Array = host.get("spawned")
    var suspended: Array = [host.get("world"), player, camera, fusion]
    for actor in actors:
        if is_instance_valid(actor): suspended.append(actor)
    var modes: Array = []
    for node in suspended:
        modes.append(node.process_mode)
        node.process_mode = Node.PROCESS_MODE_DISABLED
    var old_pause := tree.paused
    tree.paused = true
    var caster_pos := player.global_position
    var camera_pos := camera.get_screen_center_position()
    var tick := fusion._tick
    var child_ticks: Array = []
    for part in fusion._pending: child_ticks.append(int(part.node.get("_tick")))
    var actor_positions: Array = []
    for actor in actors: actor_positions.append(actor.global_position)
    var names: Array[String] = []
    for enabled in [false, true, false]:
        viewer._material.set_shader_parameter("crown_material_enabled", enabled)
        for settle in range(4):
            await tree.process_frame
            await RenderingServer.frame_post_draw
        var image := get_viewport().get_texture().get_image()
        var name := "crown_pair_%d_%d.png" % [crown_probe_next, names.size()]
        if image == null or image.is_empty() or image.save_png(path.path_join(name)) != OK:
            push_error("F01_MATCH_FAIL image")
            return false
        names.append(name)
    var stable := tick == fusion._tick and caster_pos == player.global_position and camera_pos == camera.get_screen_center_position()
    for i in range(actors.size()): stable = stable and actor_positions[i] == actors[i].global_position
    for i in range(fusion._pending.size()): stable = stable and child_ticks[i] == int(fusion._pending[i].node.get("_tick"))
    var report := {"tick": tick, "child_ticks": child_ticks, "player": [caster_pos.x, caster_pos.y],
        "camera": [camera_pos.x, camera_pos.y], "stable": stable, "files": names,
        "scope": "same-state original R25 additive preview versus F01 source-surface material; actor, camera and C unchanged"}
    var file := FileAccess.open(path.path_join("crown_pair_%d.json" % crown_probe_next), FileAccess.WRITE)
    if file == null: return false
    file.store_string(JSON.stringify(report, "  "))
    file.close()
    viewer._material.set_shader_parameter("crown_material_enabled", true)
    tree.paused = old_pause
    for i in range(suspended.size()): suspended[i].process_mode = modes[i]
    crown_probe_next += 1
    print("F01_MATCH ", JSON.stringify(report))
    return stable

func start(wrapper: Node) -> void:
    host = wrapper
    var skill := int(OS.get_environment("AVFX_LIVE_SKILL"))
    if skill < 1 or skill > 20:
        _fail("AVFX_LIVE_SKILL must be 1..20"); return
    cast_id = Arcana20SourceCatalog.canonical_id(skill)
    if not await _route():
        _fail("real AppRoot/Home/overworld route"); return
    var renderer: Arcana20Renderer = host.get("renderer")
    var player: Node2D = host.get("player")
    var world: Node = host.get("world")
    var camera := world.get("camera") as Camera2D
    if camera == null:
        _fail("real camera missing"); return
    # #09's selected A actor graph needs seven real potential targets, not a
    # single disconnected node. Other spells still exercise multiple actors.
    var enemy_count := 7 if skill == 9 else 3
    var formation := host.get("spawn_selector") as OptionButton
    if formation != null and OS.get_environment("AVFX_LIVE_SPAWN_RING") == "1":
        formation.select(1) # real scene enemies; normal AI/terrain still apply
    for i in range(enemy_count): host.call(&"_spawn_enemy")
    var spawned: Array = host.get("spawned")
    if spawned.size() != enemy_count:
        _fail("real Skeleton spawns"); return
    var enemy := spawned[0] as Node2D
    var enemies_hp: Array[int] = []
    var enemy_starts: Array[Vector2] = []
    var enemy_moves: Array[float] = []
    for actor in spawned:
        var real_enemy := actor as Node2D
        real_enemy.set_physics_process(true) # actual Skeleton AI, no scripted transforms
        enemies_hp.append(int(real_enemy.get("health")))
        enemy_starts.append(real_enemy.global_position)
        enemy_moves.append(0.0)
    var enemy_hp := enemies_hp[0]
    var player_start := player.global_position
    var enemy_start := enemy.global_position
    var camera_start := camera.get_screen_center_position()
    var selected := host.get("selector") as OptionButton
    selected.select(skill - 1)
    if skill == 5:
        var choice := 1 if OS.get_environment("AVFX_05_VARIANT") == "B" else 0
        var variant := host.get("abyssal_selector") as OptionButton
        variant.select(choice)
        host.call(&"_select_abyssal_variant", choice)
    # Same presentation as the creator's F4 control: do not cover the actual
    # world with the diagnostic panel during the review recording.
    var panel := host.get("panel") as Control
    if panel != null: panel.visible = false
    if OS.get_environment("AVFX_LIVE_LIGHT") == "dimmed": host.call(&"_toggle_light")
    renderer.cast_finished.connect(func(id: StringName) -> void:
        if id == cast_id: finished = true)
    renderer.source_tick.connect(func(id: StringName, tick: int, _phase: StringName) -> void:
        if id == cast_id: ticks_seen.append(tick))
    renderer.visual_contact.connect(func(id: StringName, pos: Vector2, kind: StringName) -> void:
        if id == cast_id: contacts.append({"kind": String(kind), "position": [pos.x, pos.y]}))
    renderer.unbound_source_contact.connect(func(id: StringName, kind: StringName, index: int, time: float) -> void:
        if id == cast_id: unbound_contacts.append({"kind": String(kind), "node_index": index, "source_time": time}))
    var folder := "user://avfx_live_capture"
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(folder))
    print("AVFX_LIVE_OUTPUT ", ProjectSettings.globalize_path(folder))
    var capture := OS.get_environment("AVFX_LIVE_CAPTURE") != "0"
    var no_fx := OS.get_environment("AVFX_LIVE_NO_FX") == "1"
    var wait_s := maxf(1.0, float(OS.get_environment("AVFX_LIVE_WAIT_S")))
    var overlap_skill := int(OS.get_environment("AVFX_LIVE_OVERLAP"))
    var overlap_id: StringName = Arcana20SourceCatalog.canonical_id(overlap_skill) if overlap_skill >= 1 and overlap_skill <= 20 else &""
    if overlap_id == cast_id:
        _fail("overlap must use a different skill"); return
    var overlap_started := false
    var overlap_completed := [false]
    renderer.cast_finished.connect(func(id: StringName) -> void:
        if id == overlap_id: overlap_completed[0] = true)
    var cast_target_world = null
    var start_usec := Time.get_ticks_usec()
    capture_start_usec = start_usec
    if capture and not await _frame(folder, player, enemy, camera):
        _fail("baseline frame"); return
    if not no_fx:
        var selected_target := host.get("target_selector") as OptionButton
        if selected_target != null and selected_target.selected == 0:
            var cast_enemy := host.call(&"_nearest_enemy") as Node2D
            if is_instance_valid(cast_enemy): cast_target_world = [cast_enemy.global_position.x, cast_enemy.global_position.y]
        else:
            var mouse_world := player.get_global_mouse_position()
            cast_target_world = [mouse_world.x, mouse_world.y]
        host.call(&"_cast_selected")
        if not renderer.is_active(cast_id):
            _fail("real-scene cast refused"); return
    # Non-shipping, opt-in evidence camera. This does not change player input,
    # source transform, duration, cast anchor or the production follow camera.
    # Keep a separate normal gameplay recording; center once on the actual
    # world-space source center, at the real camera zoom and rotation.
    var fixed_camera := OS.get_environment("AVFX_FIXED_WORLD_CAMERA") == "1"
    var fixed_anchor := Vector2.ZERO
    if fixed_camera:
        if skill == 20:
            var rift_source := renderer._casts.get(cast_id) as CSourcePlayer
            if not is_instance_valid(rift_source):
                _fail("fixed camera expected #20 C source"); return
            fixed_anchor = rift_source.local_to_world(CRealityRipperFusion.CENTER)
        elif skill == 16:
            var seed_source := renderer._casts.get(cast_id) as FusionPlayer
            if not is_instance_valid(seed_source) or not (seed_source._back is ASourcePlayer):
                _fail("fixed camera expected #16 A source"); return
            fixed_anchor = (seed_source._back as ASourcePlayer).local_to_world(AWorldseedGrowth.C)
        else:
            _fail("fixed camera is diagnostic-only for #16/#20"); return
        var view := Camera2D.new()
        view.name = "AVFXDiagnosticWorldFixedCamera"
        view.process_mode = Node.PROCESS_MODE_ALWAYS
        world.add_child(view)
        view.top_level = true
        view.zoom = camera.zoom
        view.global_rotation = camera.global_rotation
        view.position_smoothing_enabled = false
        view.global_position = fixed_anchor
        view.make_current()
        view.force_update_scroll()
        camera = view
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        camera_start = camera.get_screen_center_position()
        print("AVFX_FIXED_CAMERA ", JSON.stringify({"anchor": [fixed_anchor.x, fixed_anchor.y], "center": [camera_start.x, camera_start.y], "zoom": [camera.zoom.x, camera.zoom.y], "scope": "diagnostic only; world-fixed after cast; actor input and source anchors unchanged"}))
        if camera_start.distance_to(fixed_anchor) > 1.0:
            _fail("diagnostic camera not calibrated to source center"); return
        # Drop the earlier gameplay-follow baseline; all fixed-camera footage
        # shares a single calibrated world-fixed viewport from this point.
        samples.clear()
        capture_start_usec = Time.get_ticks_usec()
        if capture and not await _frame(folder, player, enemy, camera):
            _fail("fixed camera initial frame"); return
    var deadline := Time.get_ticks_msec() + 180000
    var current_action := &""
    var max_player := 0.0
    var max_enemy := 0.0
    var max_camera := 0.0
    var frame_times: Array[float] = []
    var previous_frame := Time.get_ticks_usec()
    while Time.get_ticks_msec() < deadline:
        var elapsed := float(Time.get_ticks_usec() - start_usec) / 1000000.0
        if no_fx:
            if elapsed >= wait_s: break
        elif not renderer.is_active(cast_id) and (overlap_id == &"" or (overlap_started and not renderer.is_active(overlap_id))):
            break
        if not no_fx and overlap_id != &"" and not overlap_started and elapsed >= 1.0:
            selected.select(overlap_skill - 1)
            host.call(&"_cast_selected")
            overlap_started = renderer.is_active(overlap_id)
            selected.select(skill - 1)
            if not overlap_started:
                _fail("overlap cast refused"); return
        # Real input is consumed by the player controller; collisions and
        # camera following are not overridden. Four directions reduce the risk
        # of a single wall preventing any movement.
        var directions: Array[StringName] = [&"move_right", &"move_down", &"move_left", &"move_up"]
        var action: StringName = directions[int(elapsed / 0.75) % directions.size()]
        if action != current_action:
            if current_action != &"": Input.action_release(current_action)
            Input.action_press(action)
            current_action = action
        await get_tree().process_frame
        if not is_instance_valid(player) or not is_instance_valid(enemy) or not is_instance_valid(renderer):
            _fail("actor or renderer left scene during cast"); return
        max_player = maxf(max_player, player.global_position.distance_to(player_start))
        max_enemy = maxf(max_enemy, enemy.global_position.distance_to(enemy_start))
        for i in range(spawned.size()):
            var real_enemy := spawned[i] as Node2D
            if not is_instance_valid(real_enemy):
                _fail("real Skeleton left scene"); return
            enemy_moves[i] = maxf(enemy_moves[i], real_enemy.global_position.distance_to(enemy_starts[i]))
        max_camera = maxf(max_camera, camera.get_screen_center_position().distance_to(camera_start))
        var now := Time.get_ticks_usec()
        frame_times.append(float(now - previous_frame) / 1000.0)
        previous_frame = now
        if capture:
            if samples.size() >= 1800:
                _fail("frame budget exceeded"); return
            if not await _frame(folder, player, enemy, camera):
                _fail("native capture frame"); return
    if current_action != &"": Input.action_release(current_action)
    var cast_duration_s := float(Time.get_ticks_usec() - start_usec) / 1000000.0
    if no_fx and cast_duration_s < wait_s:
        _fail("no-FX baseline did not finish its matched duration"); return
    if not no_fx and (not finished or renderer.is_active(cast_id)):
        _fail("natural full cast did not complete before deadline"); return
    if not no_fx and overlap_id != &"" and (not overlap_started or not bool(overlap_completed[0]) or renderer.is_active(overlap_id)):
        _fail("overlap did not naturally complete"); return
    for i in range(spawned.size()):
        if not is_instance_valid(spawned[i]) or int(spawned[i].get("health")) != enemies_hp[i]:
            _fail("visual cast unexpectedly changed or removed enemy HP"); return
    # Show a post-finish world frame before a separate restart/cancel check.
    for i in range(3): await get_tree().process_frame
    if capture and not await _frame(folder, player, enemy, camera):
        _fail("out frame"); return
    var mount: Arcana20WorldPassMount = host.get("mount")
    var post: Arcana20CViewportPost = host.get("post")
    if mount.active_viewers(cast_id) != 0 or post._states.has(cast_id):
        _fail("viewer or post survived normal finish"); return
    if overlap_id != &"" and (mount.active_viewers(overlap_id) != 0 or post._states.has(overlap_id)):
        _fail("overlap viewer or post survived normal finish"); return
    if not no_fx:
        host.call(&"_cast_selected")
        if not renderer.is_active(cast_id):
            _fail("restart refused"); return
        renderer.cancel_skill(cast_id)
        await get_tree().process_frame
        await get_tree().process_frame
        if renderer.is_active(cast_id) or mount.active_viewers(cast_id) != 0 or post._states.has(cast_id):
            _fail("restart cancel cleanup"); return
    frame_times.sort()
    var p50 := frame_times[frame_times.size() / 2] if not frame_times.is_empty() else 0.0
    var p95 := frame_times[mini(frame_times.size() - 1, int(ceil(frame_times.size() * 0.95)) - 1)] if not frame_times.is_empty() else 0.0
    var p99 := frame_times[mini(frame_times.size() - 1, int(ceil(frame_times.size() * 0.99)) - 1)] if not frame_times.is_empty() else 0.0
    var record := {"scope": "actual game route, visual-only; automatic real player input and unmodified Skeleton AI; not combat receipts or device FPS",
        "skill": skill, "lighting": OS.get_environment("AVFX_LIVE_LIGHT"), "captured": capture, "frames": samples,
        "cast_target_world": cast_target_world,
        "no_fx": no_fx, "overlap_skill": overlap_skill, "cast_duration_s": cast_duration_s,
        "camera_mode": "diagnostic_world_fixed" if fixed_camera else "gameplay_follow",
        "fixed_camera_anchor": [fixed_anchor.x, fixed_anchor.y] if fixed_camera else null,
        "last_tick": ticks_seen[-1] if not ticks_seen.is_empty() else 0, "events": contacts, "unbound_events": unbound_contacts,
        "enemy_count": enemy_count, "spawn_formation": "ring" if formation != null and formation.selected == 1 else "line",
        "enemy_max_displacements": enemy_moves,
        "player_max_displacement": max_player, "enemy_max_displacement": max_enemy, "camera_max_displacement": max_camera,
        "enemy_hp_before": enemy_hp, "enemy_hp_after": int(enemy.get("health")),
        "observed_wall_frame_ms": {"p50": p50, "p95": p95, "p99": p99, "count": frame_times.size()},
        "frame_timing_note": "capture I/O and shared software rendering included; not hardware FPS",
        "capture_timestamp_note": "frame_post_draw before PNG encoding; last-observed source tick can lag displayed state"}
    var out := FileAccess.open(folder + "/timeline.json", FileAccess.WRITE)
    if out == null:
        _fail("timeline output"); return
    out.store_string(JSON.stringify(record, "  "))
    out.close()
    var moving_enemies := 0
    for movement in enemy_moves:
        if movement >= 1.0: moving_enemies += 1
    print("AVFX_LIVE_RESULT ", JSON.stringify({"id": skill, "frames": samples.size(), "last_tick": record.last_tick,
        "player_move": max_player, "enemy_move": max_enemy, "enemies": enemy_count, "moving_enemies": moving_enemies,
        "unbound_events": unbound_contacts.size(), "camera_move": max_camera, "p50_ms": p50, "p95_ms": p95, "p99_ms": p99}))
    if OS.get_environment("AVFX_CROWN_MATCHED") == "1" and crown_probe_next != CROWN_PROBE_TARGETS.size():
        _fail("matched crown pairs missing"); return
    if max_player < 1.0 or moving_enemies < 2 or (not fixed_camera and max_camera < 1.0):
        _fail("real player, multiple enemies and gameplay camera movement not observed"); return
    if fixed_camera and max_camera > 1.0:
        _fail("diagnostic camera drifted from world anchor"); return
    if no_fx:
        print("AVFX_LIVE_PASS no-FX wrapper baseline, real input/AI; no combat receipt")
    else:
        print("AVFX_LIVE_PASS full visual timeline, real input/AI, natural finish and restart/cancel; no combat receipt")
    get_tree().quit(0)
