## Synthetic impulse is a mathematical pipeline diagnostic, not gameplay or a
## substituted battlefield. Real-world/color-space verification remains open.
extends SceneTree

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var image := Image.create(480, 270, false, Image.FORMAT_RGBA8)
    image.fill(Color.BLACK)
    for y in range(119, 151):
        for x in range(224, 256): image.set_pixel(x, y, Color(1, 1, 1, 1))
    var tex := ImageTexture.create_from_image(image)
    var scene := TextureRect.new()
    scene.texture = tex
    scene.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    scene.stretch_mode = TextureRect.STRETCH_SCALE
    scene.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    root.add_child(scene)
    var adapter := Arcana20DPreHudPrototype.new()
    root.add_child(adapter)
    if not adapter.attach(tex):
        push_error("D_PREHUD_FAIL separate input attach")
        quit(1)
        return
    # Offscreen viewports may be rendered in a dependency order that takes
    # several frames. This test only asserts eventual steady state.
    for i in range(24):
        await process_frame
        await RenderingServer.frame_post_draw
    var small := adapter._passes[4].get_texture().get_image()
    var wide := adapter._passes[9].get_texture().get_image()
    if small == null or wide == null or small.is_empty() or wide.is_empty():
        push_error("D_PREHUD_FAIL empty pyramid render targets")
        quit(1)
        return
    var small_center := small.get_pixel(120, 67).r
    var small_halo := small.get_pixel(133, 67).r
    var wide_center := wide.get_pixel(60, 33).r
    var wide_halo := wide.get_pixel(70, 33).r
    print("D_PREHUD_PYRAMID ", JSON.stringify({"small_center": small_center, "small_halo": small_halo, "wide_center": wide_center, "wide_halo": wide_halo}))
    if small_center <= 0.05 or small_halo <= 0.0 or wide_center <= 0.005 or wide_halo <= 0.0:
        push_error("D_PREHUD_FAIL missing bright/blur energy")
        quit(1)
        return
    adapter.set_bloom_gain(1.0)
    await process_frame
    await RenderingServer.frame_post_draw
    var with_bloom := root.get_texture().get_image()
    adapter.set_bloom_gain(0.0)
    await process_frame
    await RenderingServer.frame_post_draw
    var no_bloom := root.get_texture().get_image()
    var cx := with_bloom.get_width() / 2
    var cy := with_bloom.get_height() / 2
    var px := mini(with_bloom.get_width() - 1, cx + roundi(with_bloom.get_width() * 0.06))
    var b := with_bloom.get_pixel(px, cy).r
    var n := no_bloom.get_pixel(px, cy).r
    print("D_PREHUD_COMPOSITE ", JSON.stringify({"bloom": b, "no_bloom": n, "sample": [px, cy]}))
    if b <= n:
        push_error("D_PREHUD_FAIL no bloom contribution outside impulse")
        quit(1)
        return
    adapter.detach()
    await process_frame
    await RenderingServer.frame_post_draw
    if not adapter._passes.is_empty() or adapter._output != null:
        push_error("D_PREHUD_FAIL detach")
        quit(1)
        return
    print("D_PREHUD_PASS synthetic steady-state only; live world and same-frame ordering unverified")
    quit(0)
