extends SceneTree

## Tests the translated ORIGINAL gold shader in an actual 480x270 native draw.
## The grid is a diagnostic fixture, NOT a replacement skill visual.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var viewport := SubViewport.new()
    viewport.name = "Gold480x270"
    viewport.size = Vector2i(480, 270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    viewport.transparent_bg = false
    root.add_child(viewport)
    var ground := ColorRect.new()
    ground.color = Color(0.13, 0.15, 0.19, 1.0)
    ground.size = Vector2(480, 270)
    viewport.add_child(ground)
    for x in range(0, 480, 24):
        var tile := ColorRect.new()
        tile.color = Color(0.3, 0.34, 0.4) if (x / 24) % 2 == 0 else Color(0.21, 0.23, 0.27)
        tile.position = Vector2(x, 100)
        tile.size = Vector2(22, 80)
        viewport.add_child(tile)
    var overlay := ColorRect.new()
    overlay.name = "GoldPostShader"
    overlay.color = Color.WHITE
    overlay.size = Vector2(480, 270)
    var mat := ShaderMaterial.new()
    var code := load("res://prototypes/gold_fidelity/gold_post.gdshader") as Shader
    if code == null:
        push_error("GOLD_SHADER: missing source shader")
        quit(1)
        return
    mat.shader = code
    var segments := PackedVector4Array()
    var profiles := PackedVector2Array()
    for i in 8:
        segments.append(Vector4(104.0, 141.0, 356.0, 141.0) if i == 0 else Vector4.ZERO)
        profiles.append(Vector2(14.0, 1.8) if i == 0 else Vector2.ZERO)
    mat.set_shader_parameter(&"u_seg", segments)
    mat.set_shader_parameter(&"u_seg_p", profiles)
    mat.set_shader_parameter(&"u_ns", 1)
    mat.set_shader_parameter(&"u_time", 1.47)
    overlay.material = mat
    viewport.add_child(overlay)
    await process_frame
    await RenderingServer.frame_post_draw
    var image := viewport.get_texture().get_image()
    if image == null or image.get_width() != 480 or image.get_height() != 270:
        push_error("GOLD_SHADER: image absent or wrong dimensions")
        quit(1)
        return
    var export_dir := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(export_dir) != OK:
        push_error("GOLD_SHADER: cannot create evidence directory")
        quit(1)
        return
    var result := image.save_png(export_dir.path_join("post_shader_diagnostic.png"))
    if result != OK:
        push_error("GOLD_SHADER: cannot save PNG")
        quit(1)
        return
    print("GOLD_POST_SHADER_NATIVE: PASS 480x270 source-math diagnostic captured")
    quit(0)
