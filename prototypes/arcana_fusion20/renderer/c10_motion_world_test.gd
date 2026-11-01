## Every native #10 tick against the real world, with scripted camera/actor
## transforms. This is not natural gameplay, a combat hit, or approval.
## Historical and candidate renderers use this identical test adapter.
extends "res://prototypes/arcana_fusion20/renderer/arcana20_overworld_join_test.gd"

func _phase_sweep(app: Node, world: Node, player: Node2D, enemy: Node2D, camera: Camera2D) -> void:
    app.process_mode = Node.PROCESS_MODE_DISABLED
    var tint := world.get_node_or_null("WorldTint") as CanvasModulate
    if OS.get_environment("ARCANA20_PHASE_LIGHT") == "dimmed" and tint != null:
        tint.color *= Color(0.4, 0.4, 0.4, 1.0)
    var renderer := Arcana20Renderer.new()
    renderer.world_pass_mode = true
    renderer.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(renderer)
    var mount := Arcana20WorldPassMount.new()
    mount.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(mount)
    check(mount.attach(renderer), "C10 full-motion world mount")
    var post := Arcana20CViewportPost.new()
    post.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(post)
    check(post.attach(renderer), "C10 full-motion viewport post")
    var id := Arcana20SourceCatalog.canonical_id(10)
    var hp := int(enemy.get("health"))
    check(renderer.cast_skill(id, player.global_position, enemy.global_position), "C10 full-motion cast starts")
    var source := renderer._casts[id] as CSourcePlayer
    source.set_process(false)
    var enemy_start := enemy.global_position
    var player_start := player.global_position
    var camera_start := camera.offset
    var aligned := true
    for tick in range(444):
        # Test-driven, small periodic movement. Targeting remains the original
        # cast-time anchor; this explicitly does not prove moving-target hits.
        var t := float(tick) / 60.0
        enemy.global_position = enemy_start + Vector2(10.0 * sin(t * 0.8), 5.0 * sin(t * 1.1))
        player.global_position = player_start + Vector2(6.0 * sin(t * 0.6), 3.0 * sin(t * 0.9))
        camera.offset = camera_start + Vector2(26.0 * sin(t * 0.7), 14.0 * sin(t * 0.5))
        camera.force_update_scroll()
        if tick > 0:
            source.render_enabled = false
            source.advance(STEP, false)
        source.render_enabled = true
        source._render_frame()
        if mount.has_method("_ensure_c_stage"):
            var stage: Node2D = mount.get("_c_stage")
            stage.call("_sync_view")
            if stage.visible and not stage.get_global_transform_with_canvas().is_equal_approx(Transform2D.IDENTITY): aligned = false
        await process_frame
        await process_frame
        await save_frame("c10_motion_%03d" % tick)
    check(aligned, "C10 full-motion viewport stage remains aligned under scripted camera movement when supported")
    check(int(enemy.get("health")) == hp, "C10 full-motion presentation never changes actor HP")
    renderer.cancel_skill(id)
    await process_frame
    await process_frame
    check(mount.active_viewers(id) == 0 and post._states.is_empty(), "C10 full-motion cancellation retires its consumers")
    post.detach()
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()
