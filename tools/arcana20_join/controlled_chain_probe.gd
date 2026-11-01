## Diagnostic-only controlled A/B. Uses the real route and cast; briefly
## pauses the SAME scene between captures, changing only #09 A pass draw order.
## Foreground is an occlusion hypothesis, not an actor-depth implementation.
extends "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"

var controlled: Array = []

func _frame(path: String, player: Node2D, enemy: Node2D, camera: Camera2D) -> bool:
    if not await super._frame(path, player, enemy, camera): return false
    var renderer := host.get("renderer") as Arcana20Renderer
    var mount := host.get("mount") as Arcana20WorldPassMount
    if not is_instance_valid(renderer) or not renderer.is_active(cast_id): return true
    var source := renderer._casts.get(cast_id) as ASourcePlayer
    var viewer := (mount._passes.get(cast_id, {}) as Dictionary).get(&"A") as Arcana20AWorldPass
    if not is_instance_valid(source) or not is_instance_valid(viewer): return true
    var original_z := viewer.z_index
    var old_scale := Engine.time_scale
    var old_pause := get_tree().paused
    get_tree().paused = true
    Engine.time_scale = 0.0
    # Synchronize the frozen camera/render tree before recording the lock.
    await RenderingServer.frame_post_draw
    await RenderingServer.frame_post_draw
    var tick := source._tick
    var position_before := player.global_position
    var camera_before := camera.get_screen_center_position()
    var actors: Array = []
    for actor in host.get("spawned"):
        actors.append([actor.global_position.x, actor.global_position.y])
    var i := samples.size() - 1
    var files: Array[String] = []
    for z in [original_z, 1, original_z]:
        viewer.z_index = z
        # Two draws allow screen-copy order and the same frozen viewport to settle.
        await RenderingServer.frame_post_draw
        await RenderingServer.frame_post_draw
        var img := get_viewport().get_texture().get_image()
        var name := "controlled_%05d_%d.png" % [i, files.size()]
        if img == null or img.is_empty() or img.save_png(path.path_join(name)) != OK:
            get_tree().paused = old_pause
            Engine.time_scale = old_scale
            viewer.z_index = original_z
            return false
        files.append(name)
    var unchanged := source._tick == tick and player.global_position == position_before and camera.get_screen_center_position() == camera_before
    var spawned: Array = host.get("spawned")
    var actor_after: Array = []
    for n in range(spawned.size()):
        actor_after.append([spawned[n].global_position.x, spawned[n].global_position.y])
        unchanged = unchanged and spawned[n].global_position == Vector2(actors[n][0], actors[n][1])
    if not unchanged:
        print("R18_STATE_MISMATCH ", JSON.stringify({"tick_before":tick,"tick_after":source._tick,"player_before":str(position_before),"player_after":str(player.global_position),"camera_before":str(camera_before),"camera_after":str(camera.get_screen_center_position()),"actors_before":actors,"actors_after":actor_after}))
    viewer.z_index = original_z
    get_tree().paused = old_pause
    Engine.time_scale = old_scale
    if not unchanged:
        push_error("R18_CONTROLLED_FAIL source, actors or camera moved during paired capture")
        return false
    samples[-1]["controlled_tick"] = tick
    samples[-1]["controlled_files"] = files
    samples[-1]["controlled_actor_positions"] = actors
    samples[-1]["controlled_z"] = [original_z, 1, original_z]
    controlled.append(tick)
    return true
