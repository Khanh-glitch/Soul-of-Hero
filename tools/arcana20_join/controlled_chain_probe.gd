## Disposable matched-world #09 ghost comparison. Real route/input/AI; freeze
## actors and source only for each pair, then restore everything and continue.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

var _targets: Array[int] = [160, 300]
var _next := 0

func _settle() -> void:
    for frame in range(4):
        await get_tree().process_frame
        await RenderingServer.frame_post_draw

func _frame(path: String, player: Node2D, enemy: Node2D, camera: Camera2D) -> bool:
    if not await super._frame(path, player, enemy, camera): return false
    if _next >= _targets.size(): return true
    var renderer := host.get("renderer") as Arcana20Renderer
    if not is_instance_valid(renderer) or not renderer.is_active(cast_id): return true
    var source := renderer._casts.get(cast_id) as ASourcePlayer
    if not is_instance_valid(source) or source._tick < _targets[_next]: return true
    var tree := get_tree()
    var suspended: Array = [host.get("world"), player, camera, source]
    var spawned: Array = host.get("spawned")
    for actor in spawned:
        if is_instance_valid(actor): suspended.append(actor)
    var old_modes: Array = []
    for node in suspended:
        old_modes.append(node.process_mode)
        node.process_mode = Node.PROCESS_MODE_DISABLED
    var old_pause := tree.paused
    tree.paused = true
    var before_player := player.global_position
    var before_camera := camera.get_screen_center_position()
    var tick := source._tick
    var positions: Array = []
    for actor in spawned: positions.append(actor.global_position)
    var names: Array[String] = []
    for legacy in [true, false, true]:
        OS.set_environment("AVFX_R24_LEGACY_GHOST", "1" if legacy else "0")
        source._render_frame()
        await _settle()
        var image := get_viewport().get_texture().get_image()
        var name := "chain_pair_%d_%d.png" % [_next, names.size()]
        if image == null or image.is_empty() or image.save_png(path.path_join(name)) != OK:
            push_error("R24_CHAIN_FAIL cannot save image")
            return false
        names.append(name)
    var stable := tick == source._tick and before_player == player.global_position and before_camera == camera.get_screen_center_position()
    var coordinates: Array = []
    for i in range(spawned.size()):
        stable = stable and positions[i] == spawned[i].global_position
        coordinates.append([positions[i].x, positions[i].y])
    var report := {"tick": tick, "player": [before_player.x, before_player.y],
        "camera": [before_camera.x, before_camera.y], "actors": coordinates,
        "stable": stable, "files": names,
        "note": "actual AI; paused same-state old C ghost/new A ghost/old C ghost; C live branches unchanged"}
    var output := FileAccess.open(path.path_join("chain_pair_%d.json" % _next), FileAccess.WRITE)
    output.store_string(JSON.stringify(report, "  "))
    output.close()
    OS.set_environment("AVFX_R24_LEGACY_GHOST", "0")
    source._render_frame()
    tree.paused = old_pause
    for i in range(suspended.size()): suspended[i].process_mode = old_modes[i]
    _next += 1
    print("R24_CHAIN_PAIR ", JSON.stringify(report))
    if not stable:
        push_error("R24_CHAIN_FAIL source, actors or camera moved during pair")
        return false
    return true
