## Diagnostic only: real route and input-controlled moving player, with twelve
## explicit visual-only ground targets. No teleports, fake hits or combat.
## Zoom is widened solely to inspect both ends of extreme ranges; this is not
## the ordinary creator-camera view or a modification of effect scale.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

func _v(p: Vector2) -> Array:
    return [p.x, p.y]

func _point_margin(p: Vector2) -> float:
    return minf(minf(p.x, p.y), minf(384.0 - p.x, 216.0 - p.y))

# Edge activity comes from the emitted actual C raster fields, not bounds
# inferred from vertex positions. Adjacent edge counts are seam indicators,
# not proof that every displayed pixel or other frame is correct.
var tile_edges: Dictionary = {}
func _record_tile(id: StringName, frame: Arcana20SourcePassFrame) -> void:
    if id != Arcana20SourceCatalog.canonical_id(15) or frame.family != &"C": return
    var counts := {"top_ink":0, "bottom_ink":0, "left_ink":0, "right_ink":0,
        "top_light":0, "bottom_light":0, "left_light":0, "right_light":0}
    for x in range(CFrame.W):
        for entry in [[x, "top"], [(CFrame.H - 1) * CFrame.W + x, "bottom"]]:
            var pixel := int(entry[0]) * 4
            var side: String = entry[1]
            if frame.c_ink[pixel + 3] > 0.0: counts[side + "_ink"] += 1
            if frame.c_light[pixel] != 0.0 or frame.c_light[pixel + 1] != 0.0 or frame.c_light[pixel + 2] != 0.0: counts[side + "_light"] += 1
    for y in range(1, CFrame.H - 1):
        for entry in [[y * CFrame.W, "left"], [y * CFrame.W + CFrame.W - 1, "right"]]:
            var pixel := int(entry[0]) * 4
            var side: String = entry[1]
            if frame.c_ink[pixel + 3] > 0.0: counts[side + "_ink"] += 1
            if frame.c_light[pixel] != 0.0 or frame.c_light[pixel + 1] != 0.0 or frame.c_light[pixel + 2] != 0.0: counts[side + "_light"] += 1
    tile_edges["%d,%d" % [frame.c_tile.x, frame.c_tile.y]] = counts

func _measure(cp: CSourcePlayer) -> Dictionary:
    var fx := cp._fx as CThornOpera
    var vertices: Array = []
    var roots: Array = []
    var outside := 0
    var uncovered := 0
    var margin := INF
    var tip_focus_distances: Array = []
    for td in fx._tds:
        var root := Vector2(float(td.base[0]), float(td.base[1]))
        roots.append(_v(root))
        var tip: Array = td.pos[-1]
        tip_focus_distances.append(Vector2(float(tip[0]), float(tip[1])).distance_to(fx._focus))
        for point in td.pos:
            var p := Vector2(float(point[0]), float(point[1]))
            vertices.append(_v(p))
            var d := _point_margin(p)
            margin = minf(margin, d)
            if d < 0.0: outside += 1
            var cell := Vector2i(floori(p.x / 384.0), floori(p.y / 216.0))
            if cell != Vector2i.ZERO and not cp._thorn_active_tiles.has(cell): uncovered += 1
    var active_tiles: Array = []
    for cell in cp._thorn_active_tiles: active_tiles.append([cell.x, cell.y])
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
        "source_bounds": [0, 0, 384, 216],
        "base_raster_note": "margin and edge pixels above are the original tile only",
        "active_overscan_tiles": active_tiles, "tile_cap_reached": cp._thorn_tile_truncated,
        "vertices_without_tile": uncovered, "raster_tile_edge_activity":tile_edges.duplicate(true),
        "tip_focus_distances_source_px":tip_focus_distances,
        "cast_origin_world":_v(cp._cast_caster)}

var motion_samples: Array = []
var motion_start_usec := 0

func _motion_frame(folder: String, tick: int, player: Node2D, camera: Camera2D) -> bool:
    await RenderingServer.frame_post_draw
    var captured_usec := Time.get_ticks_usec()
    var image := get_viewport().get_texture().get_image()
    var name := "frame_%05d.png" % motion_samples.size()
    if image == null or image.is_empty() or image.save_png(folder + "/" + name) != OK: return false
    motion_samples.append({"file": name, "wall_s": float(captured_usec - motion_start_usec) / 1000000.0,
        "source_tick_last_observed": tick, "player": _v(player.global_position),
        "camera": _v(camera.get_screen_center_position())})
    return true

func start(wrapper: Node) -> void:
    host = wrapper
    if not await _route():
        _fail("thorn matrix real route"); return
    var renderer: Arcana20Renderer = host.get("renderer")
    renderer.source_pass_ready.connect(_record_tile)
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
    var short_only := OS.get_environment("AVFX_C15_SHORT_ONLY") == "1"
    var distances := [35.0] if short_only else [35.0, 140.0, 900.0]
    for distance in distances:
        for bearing in range(1 if short_only else 4):
            await get_tree().process_frame
            tile_edges.clear()
            var start_pos := player.global_position
            var target: Vector2 = start_pos + directions[bearing] * distance
            if not renderer.cast_skill(id, start_pos, target, 1.0, player):
                _fail("thorn matrix cast refused"); return
            var cp := renderer._casts[id] as CSourcePlayer
            if cp == null:
                _fail("thorn matrix missing source"); return
            var shots: Array = []
            var short_motion: bool = distance == 35.0 and bearing == 0
            var motion_dir := output + "/short_motion"
            var next_motion_tick := 0
            var last_tick_seen := 0
            if short_motion:
                motion_samples.clear()
                DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(motion_dir))
                motion_start_usec = Time.get_ticks_usec()
            var deadline := Time.get_ticks_msec() + 180000
            var marks := [200, 350, 440]
            var mark_index := 0
            var actions: Array[StringName] = [&"move_right", &"move_down", &"move_left", &"move_up"]
            var action := actions[bearing]
            Input.action_press(action)
            while is_instance_valid(cp) and renderer.is_active(id) and (mark_index < marks.size() or short_motion) and Time.get_ticks_msec() < deadline:
                await get_tree().process_frame
                if not is_instance_valid(cp) or not renderer.is_active(id): break
                last_tick_seen = cp._tick
                if short_motion and cp._tick >= next_motion_tick:
                    if not await _motion_frame(motion_dir, cp._tick, player, camera):
                        Input.action_release(action); _fail("thorn short motion frame save"); return
                    if not is_instance_valid(cp) or not renderer.is_active(id): break
                    next_motion_tick = cp._tick + 8
                if mark_index >= marks.size() or cp._tick < marks[mark_index]: continue
                await RenderingServer.frame_post_draw
                var img := get_viewport().get_texture().get_image()
                var name := "d%d_b%d_tick%d.png" % [int(distance), bearing, cp._tick]
                if img == null or img.is_empty() or img.save_png(output + "/" + name) != OK:
                    Input.action_release(action); _fail("thorn matrix frame save"); return
                shots.append({"file":name, "tick_last_observed":cp._tick, "player_world":_v(player.global_position),
                    "camera_world":_v(camera.get_screen_center_position()), "measurement":_measure(cp)})
                mark_index += 1
            Input.action_release(action)
            if mark_index != marks.size() or (short_motion and renderer.is_active(id)):
                _fail("thorn matrix timed out before observed beats or natural OUT"); return
            if short_motion:
                if not await _motion_frame(motion_dir, last_tick_seen, player, camera):
                    _fail("thorn short OUT frame save"); return
                var timeline := FileAccess.open(motion_dir + "/timeline.json", FileAccess.WRITE)
                if timeline == null: _fail("thorn motion timeline save"); return
                timeline.store_string(JSON.stringify({"scope":"real route, actual moving caster, visual target 35 units right, camera zoom 0.32; natural OUT, no fake hits", "lighting":OS.get_environment("AVFX_LIVE_LIGHT"), "caster_start_world":_v(start_pos), "target_world":_v(target), "frames":motion_samples}, "  "))
                timeline.close()
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
    print("AVFX_THORN_MATRIX_PASS cases=", cases.size(), " screenshots=", cases.size() * 3, " short_motion=", motion_samples.size(), " output=", ProjectSettings.globalize_path(output))
    get_tree().quit(0)
