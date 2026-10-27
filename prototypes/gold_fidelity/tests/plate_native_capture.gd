extends SceneTree

## Evidence only: original 14-sheet geometry + translated source shader at 480x270.
## No actors, gameplay, TileMap, approximated sprite art or fake tear.
const FACTORY = preload("res://prototypes/gold_fidelity/gold_hairline_plate_factory.gd")
const PLATE_SHADER = preload("res://prototypes/gold_fidelity/hairline_plate.gdshader")
const SAMPLE_TIME := 1.466666666666667

func _initialize() -> void:
    call_deferred("_render_sample")

static func source_mesh(c: PackedVector2Array) -> ArrayMesh:
    var array := []
    array.resize(Mesh.ARRAY_MAX)
    array[Mesh.ARRAY_VERTEX] = PackedVector2Array([c[0],c[1],c[2],c[0],c[2],c[3]])
    array[Mesh.ARRAY_TEX_UV] = PackedVector2Array([
        Vector2(0,0),Vector2(1,0),Vector2(1,1),
        Vector2(0,0),Vector2(1,1),Vector2(0,1)])
    var mesh := ArrayMesh.new()
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,array,[],{},Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    return mesh

func _render_sample() -> void:
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.transparent_bg = false
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var bg := ColorRect.new()
    bg.size = Vector2(480,270)
    bg.color = Color(0,0,0,1)
    viewport.add_child(bg)
    var stage := Node2D.new()
    viewport.add_child(stage)
    var rendered := 0
    for i in FACTORY.PLATES.size():
        var corners: PackedVector2Array = FACTORY.vertices_at(i,SAMPLE_TIME)
        var mesh_node := MeshInstance2D.new()
        mesh_node.mesh = source_mesh(corners)
        mesh_node.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
        var p: Array = FACTORY.PLATES[i]
        var width := (corners[0].distance_to(corners[1])+corners[2].distance_to(corners[3]))/2.0
        var height := (corners[0].distance_to(corners[3])+corners[1].distance_to(corners[2]))/2.0
        var m := ShaderMaterial.new()
        m.shader = PLATE_SHADER
        m.set_shader_parameter("u_time",SAMPLE_TIME)
        m.set_shader_parameter("u_prog",(SAMPLE_TIME-FACTORY.CREATED_AT)/FACTORY.LIFE)
        m.set_shader_parameter("u_seed",float(p[7]))
        m.set_shader_parameter("u_wpx",width)
        m.set_shader_parameter("u_hpx",height)
        m.set_shader_parameter("u_crack",FACTORY.crack_at(i,SAMPLE_TIME))
        m.set_shader_parameter("u_alpha",FACTORY.opacity_at(SAMPLE_TIME))
        m.set_shader_parameter("u_mask",int(p[6]))
        mesh_node.material = m
        stage.add_child(mesh_node)
        rendered += 1
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = viewport.get_texture().get_image()
    if image == null or image.get_width()!=480 or image.get_height()!=270:
        push_error("GOLD_PLATES: native image absent or incorrect resolution")
        quit(1)
        return
    var lit := 0
    for y in range(270):
        for x in range(480):
            var px := image.get_pixel(x,y)
            if px.r>0.07 or px.g>0.07 or px.b>0.07:
                lit += 1
    var path := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(path)!=OK:
        push_error("GOLD_PLATES: evidence path creation failure")
        quit(1)
        return
    var result := image.save_png(path.path_join("hairline_14_source_plates.png"))
    if result!=OK or lit<300:
        push_error("GOLD_PLATES: empty/error native shader output, lit=%d save=%d" % [lit,result])
        quit(1)
        return
    print("GOLD_PRESSURE_SHEETS_NATIVE: PASS sheets=%d lit=%d time=%.6f" % [rendered,lit,SAMPLE_TIME])
    quit(0)
