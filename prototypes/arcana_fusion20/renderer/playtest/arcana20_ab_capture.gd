## R20 diagnostic: six actual-scene matched A/B moments within one B cast.
## The source simulations, camera, actors and clock are frozen; only the
## separate presentation layer and C-vs-A local pass order are switched.
## Normal full-cast recording remains the parent harness's genuine motion.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

var milestones := [150, 270, 300, 330, 360, 450]
var taken := 0

func _frame(path: String, player: Node2D, enemy: Node2D, camera: Camera2D) -> bool:
    if not await super._frame(path, player, enemy, camera): return false
    if taken >= milestones.size(): return true
    var renderer := host.get("renderer") as Arcana20Renderer
    if renderer == null or not renderer.is_active(cast_id): return true
    var cast := renderer._casts.get(cast_id) as FusionPlayer
    var mount := host.get("mount") as Arcana20WorldPassMount
    if cast == null or mount == null or cast._tick < int(milestones[taken]): return true
    var layer := cast.get_node_or_null("DirectedWaterPresentation") as AbyssalDirectedPresentation
    var viewer := (mount._passes.get(cast_id, {}) as Dictionary).get(&"C") as Arcana20CWorldPass
    if layer == null or viewer == null:
        push_error("R20_AB_FAIL missing directed layer or C world pass")
        return false
    var old_paused := get_tree().paused
    var old_scale := Engine.time_scale
    var old_z := viewer.z_index
    var old_visible := layer.visible
    get_tree().paused = true
    Engine.time_scale = 0.0
    await RenderingServer.frame_post_draw
    await RenderingServer.frame_post_draw
    var tick := cast._tick
    var player_before := player.global_position
    var camera_before := camera.get_screen_center_position()
    var positions: Array[Vector2] = []
    for actor in host.get("spawned"): positions.append(actor.global_position)
    var names: Array[String] = []
    var ok := true
    for mode in ["a", "b", "restore"]:
        var directed: bool = String(mode) == "b"
        layer.visible = directed
        layer.queue_redraw()
        viewer.z_index = -23 if directed else -24
        await RenderingServer.frame_post_draw
        await RenderingServer.frame_post_draw
        var img := get_viewport().get_texture().get_image()
        var name := "ab_%02d_%s.png" % [taken, mode]
        if img == null or img.is_empty() or img.save_png(path.path_join(name)) != OK:
            ok = false
            break
        names.append(name)
    ok = ok and cast._tick == tick and player.global_position == player_before and camera.get_screen_center_position() == camera_before
    var actors: Array = host.get("spawned")
    for i in range(positions.size()):
        ok = ok and is_instance_valid(actors[i]) and actors[i].global_position == positions[i]
    viewer.z_index = old_z
    layer.visible = old_visible
    layer.queue_redraw()
    get_tree().paused = old_paused
    Engine.time_scale = old_scale
    if not ok:
        push_error("R20_AB_FAIL frozen-state lock or PNG capture")
        return false
    samples[-1]["ab_tick"] = tick
    samples[-1]["ab_files"] = names
    samples[-1]["ab_requested_tick"] = milestones[taken]
    taken += 1
    print("R20_AB_CAPTURE ", JSON.stringify({"tick": tick, "requested": milestones[taken - 1], "files": names}))
    return true
