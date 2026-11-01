## Diagnostic only: real route and input-controlled moving player, with eight
## explicit visual-only ground targets. No teleports, fake hits or combat.
## Zoom is widened solely to inspect both ends of extreme ranges; this is not
## the ordinary creator-camera view or a modification of effect scale.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

func _v(p: Vector2) -> Array:
    return [p.x, p.y]

func _point_margin(p: Vector2) -> float:
    return minf(minf(p.x, p.y), minf(384.0 - p.x, 216.0 - p.y))

func _measure(cp: CSourcePlayer) -> Dictionary:
    var fx := cp._fx as CThornOpera
    var vertices: Array = []
    var roots: Array = []
    var outside := 0
    var margin := INF
    for td in fx._tds:
        var root := Vector2(float(td.base[0]), float(td.base[1]))
        roots.append(_v(root))
        for point in td.pos:
            var p := Vector2(float(point[0]), float(point[1]))
            vertices.append(_v(p))
            var d := _point_margin(p)
            margin = minf(margin, d)
            if d < 0.0: outside += 1
    var targets: Array = []
    for target in fx._targets: targets.append(_v(target))
    var ink_edge := 0
    var light_edge := 0
    for y in range(216):
        for x in range(384):
            if x != 0 and x != 383 and y != 0 and y != 215: continue
            var i := (y * 384 + x) * 4
            if cp._frame.ink[i + 3] > 0.0: ink_edge += 1
            if cp._frame.light[i] > 0.0 or cp._frame.light[i + 1] > 0.0 or cp._frame.light[i + 2] > 0.0: light_edge += 1
    return {"roots_local": roots, "vertices_local": vertices, "vertices_outside": outside,
        "vertex_min_margin_px": margin, "focus_local": _v(fx._focus),
        "focus_margin_px": _point_margin(fx._focus), "targets_local": targets,
        "target_margins_px": targets.map(func(p: Array) -> float: return _point_margin(Vector2(p[0], p[1]))),
        "ink_pixels_on_edge": ink_edge, "light_pixels_on_edge": light_edge,
        "height_axis_local": _v(fx.particle_height_axis), "scale": cp._scale, "rotation": cp._rot,
        "source_bounds": [0, 0, 384, 216]}

func start(wrapper: Node) -> void:
    host = wrapper
    if not await _route():
        _fail("thorn matrix real route"); return
    var renderer: Arcana20Renderer = host.get("renderer")
    var player: Node2D = host.get("player")
    var world: Node = host.get("world")
    var camera := world.get("camera") as Camera2D
    if camera == null:
        _fail("thorn matrix camera"); return
    var panel := host.get("panel") as Control
    if panel != null: panel.visible = false
    if OS.get_environment("AVFX_LIVE_LIGHT") == "dimmed": host.call(&"_toggle_light")
    # Test-only observation zoom: range 900 remains within this wide viewport.
    camera.zoom = Vector2(0.32, 0.32)
    var output := "user://avfx_thorn_matrix"
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
    var id := Arcana20SourceCatalog.canonical_id(15)
    var cases: Array = []
    var directions := [Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT, Vector2.UP]
    for distance in [35.0, 900.0]:
        for bearing in range(4):
            await get_tree().process_frame
            var start_pos := player.global_position
            var target: Vector2 = start_pos + directions[bearing] * distance
            if not renderer.cast_skill(id, start_pos, target, 1.0, player):
                _fail("thorn matrix cast refused"); return
            var cp := renderer._casts[id] as CSourcePlayer
            if cp == null:
                _fail("thorn matrix missing source"); return
            var shots: Array = []
            var deadline := Time.get_ticks_msec() + 180000
            var marks := [200, 350, 440]
            var mark_index := 0
            var actions: Array[StringName] = [&"move_right", &"move_down", &"move_left", &"move_up"]
            var action := actions[bearing]
            Input.action_press(action)
            while is_instance_valid(cp) and renderer.is_active(id) and mark_index < marks.size() and Time.get_ticks_msec() < deadline:
                await get_tree().process_frame
                if cp._tick < marks[mark_index]: continue
                await RenderingServer.frame_post_draw
                var img := get_viewport().get_texture().get_image()
                var name := "d%d_b%d_tick%d.png" % [int(distance), bearing, cp._tick]
                if img == null or img.is_empty() or img.save_png(output + "/" + name) != OK:
                    Input.action_release(action); _fail("thorn matrix frame save"); return
                shots.append({"file":name, "tick_last_observed":cp._tick, "player_world":_v(player.global_position),
                    "camera_world":_v(camera.get_screen_center_position()), "measurement":_measure(cp)})
                mark_index += 1
            Input.action_release(action)
            if mark_index != marks.size():
                _fail("thorn matrix timed out before three observed beats"); return
            renderer.cancel_skill(id)
            await get_tree().process_frame
            cases.append({"distance":distance, "bearing":bearing, "caster_start_world":_v(start_pos),
                "target_world":_v(target), "shots":shots})
    var file := FileAccess.open(output + "/matrix.json", FileAccess.WRITE)
    if file == null:
        _fail("thorn matrix metadata save"); return
    file.store_string(JSON.stringify({"scope":"real-route, moving real caster, explicit visual-only target; zoom 0.32 diagnostic, no enemy hit claimed",
        "lighting":OS.get_environment("AVFX_LIVE_LIGHT"), "source_role":"C Thorn Opera", "cases":cases}, "  "))
    file.close()
    print("AVFX_THORN_MATRIX_PASS cases=8 screenshots=24 output=", ProjectSettings.globalize_path(output))
    get_tree().quit(0)
