## Frozen actual-world diagnostic of an explicit pre-HUD input seam, not
## real-time gameplay, original D source parity or an owner integration.
## The input snapshot is the actual A0 world, never a fabricated battlefield.
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
    check(mount.attach(renderer), "D pre-HUD prototype attaches isolated world mount")
    var id := Arcana20SourceCatalog.canonical_id(19)
    var hp := int(enemy.get("health"))
    check(renderer.cast_skill(id, player.global_position, enemy.global_position), "D pre-HUD #19 starts")
    var source := renderer._casts[id] as DSourcePlayer
    source.set_process(false)
    source.render_enabled = false
    for tick in range(489): source.advance(STEP)
    source.render_enabled = true
    source._render_frame()
    camera.force_update_scroll()
    await process_frame
    await process_frame
    var baseline := await save_frame("d_prehud_real_world_before_post")
    var hud := world.get("hud") as CanvasLayer
    check(hud != null and hud.visible, "D pre-HUD actual HUD available")
    if hud == null:
        _finish()
        return
    hud.visible = false
    await process_frame
    await process_frame
    var world_only := await save_frame("d_prehud_world_only_input")
    hud.visible = true
    await process_frame
    await process_frame
    # Diagnostic one-frame readback explicitly cannot satisfy live same-frame
    # production contract; owner should supply a separate viewport texture.
    var snapshot := ImageTexture.create_from_image(world_only)
    var adapter := Arcana20DPreHudPrototype.new()
    adapter.process_mode = Node.PROCESS_MODE_ALWAYS
    world.add_child(adapter)
    check(adapter.attach(snapshot), "D prototype accepts separate real-world pre-HUD snapshot")
    var state := source.source_pass_frame()
    adapter.set_bloom_gain(state.d_bloom_gain)
    for i in range(24):
        await process_frame
        await RenderingServer.frame_post_draw
    var result := await save_frame("d_prehud_real_world_experimental_post")
    check(not images_equal(result, baseline), "D prototype affects actual world snapshot")
    await check_hud_isolation(hud, adapter._output, result, baseline, "D prototype")
    adapter.detach()
    await process_frame
    await process_frame
    check(images_equal(baseline, await save_frame("d_prehud_real_world_detached")), "D prototype detaches and restores frozen world")
    check(int(enemy.get("health")) == hp, "D prototype has no HP authority")
    renderer.cancel_skill(id)
    mount.detach()
    app.queue_free()
    await process_frame
    await process_frame
    _finish()
