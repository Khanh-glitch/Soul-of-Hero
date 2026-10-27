extends SceneTree
const SHADER = preload("res://prototypes/gold_fidelity/gold_s01_blob.gdshader")

func _initialize() -> void:
    call_deferred("_run")

func _quad(center: Vector2,extent: Vector2,parameters: Dictionary) -> MeshInstance2D:
    var node := MeshInstance2D.new()
    var vertices := PackedVector2Array()
    var uv := PackedVector2Array()
    var xy := [Vector2(-1,-1),Vector2(1,-1),Vector2(1,1),Vector2(-1,1)]
    for i in [0,1,2,0,2,3]:
        var p: Vector2 = xy[i]
        vertices.append(center+Vector2(p.x*extent.x,p.y*extent.y))
        uv.append(p)
    var data := []
    data.resize(Mesh.ARRAY_MAX)
    data[Mesh.ARRAY_VERTEX] = vertices
    data[Mesh.ARRAY_TEX_UV] = uv
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,data,[],{},Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    node.mesh = mesh
    # Preserve original Renderer LAYER ordering instead of Canvas child order.
    var mode: int = int(parameters.get("u_shape",0))
    node.z_index = 6 if mode==5 else (3 if mode==2 else 1)
    var material := ShaderMaterial.new()
    material.shader = SHADER
    for key: String in parameters:
        material.set_shader_parameter(StringName(key),parameters[key])
    node.material = material
    node.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    return node

func _run() -> void:
    var view := SubViewport.new()
    view.size = Vector2i(480,270)
    view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(view)
    var ground := ColorRect.new()
    ground.color = Color("#0c0b16")
    ground.size = Vector2(480,270)
    view.add_child(ground)
    # Actual S01 source flash seed and original blob geometry.
    view.add_child(_quad(Vector2(278,141),Vector2(15,13.5),{
        "u_shape":5,"u_palette":1,"u_seed":6.117601008154452,
        "u_k1":6.0,"u_progress":0.25,"u_alpha":1.0,"u_time":2.7}))
    # Actual gold smoke initial geometry + Blob.draw's easeOut extent.
    var p := 0.38
    var ease: float = 1.0-pow(1.0-p,3.0)
    var pos := Vector2(281.96684472914785,141.47207214217633-2.5945086274296045)
    var size := Vector2(lerpf(14.125454440712929,43.73031478598713,ease),lerpf(12.927180910203605,39.48210337590426,ease))
    view.add_child(_quad(pos,size,{"u_shape":2,"u_palette":2,
        "u_seed":0.45555063989013433,"u_progress":p,
        "u_alpha":0.92,"u_time":2.7}))
    # Gold source shock ring expanding via easeOut, not a drawn circle.
    var ring_p := 0.3
    var re: float = 1.0-pow(1.0-ring_p,3.0)
    view.add_child(_quad(Vector2(278,147),Vector2(lerpf(4,26,re),lerpf(3.12,20.28,re)),{
        "u_shape":1,"u_palette":1,"u_seed":0.237136734649539,
        "u_progress":ring_p,"u_alpha":1.0,"u_k1":0.2,"u_time":2.7}))
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = view.get_texture().get_image()
    if image == null or image.get_width()!=480 or image.get_height()!=270:
        push_error("BLOB_SHADERS: no 480x270 render")
        quit(1)
        return
    var bg := Color("#0c0b16")
    var count := 0
    for y in range(95,185):
        for x in range(235,330):
            var col: Color = image.get_pixel(x,y)
            if absf(col.r-bg.r)+absf(col.g-bg.g)+absf(col.b-bg.b)>0.08:
                count += 1
    var output := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(output)!=OK or image.save_png(output.path_join("source_blob_modes_1_2_5.png"))!=OK:
        push_error("BLOB_SHADERS: PNG export failed")
        quit(1)
        return
    if count<50:
        push_error("BLOB_SHADERS: no source visual emitted")
        quit(1)
        return
    print("GOLD_BLOB_SHADER_NATIVE: PASS 480x270 visible_pixels="+str(count))
    quit(0)
