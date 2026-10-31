## Isolated original SpriteBatch cases on a transparent native GPU target.
extends SceneTree
const OUT := "res://artifacts/arcana19-sprite"
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var cases: Array = JSON.parse_string(FileAccess.get_file_as_string("res://tools/arcana19_sprite_compare/cases.json"))
    for item in cases:
        var c: Dictionary = item
        for coverage in [false,true]:
            var vp := SubViewport.new()
            vp.size = Vector2i(480,270)
            vp.disable_3d = true
            vp.transparent_bg = true
            vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
            root.add_child(vp)
            var rgba: Array = c.color
            var color := Color(float(rgba[0]),float(rgba[1]),float(rgba[2]),float(rgba[3]))
            for _repeat in range(int(c.get("repeat",1))):
                vp.add_child(DSpriteGPU.create(float(c.x),float(c.y),float(c.size),color,int(c.shape),c.opts,float(c.time),bool(coverage)))
            for _frame in range(3):
                await process_frame
                await RenderingServer.frame_post_draw
            var image := vp.get_texture().get_image()
            if image.is_empty() or image.get_size() != vp.size:
                push_error("D sprite GPU output unavailable")
                quit(1)
                return
            image.convert(Image.FORMAT_RGBA8)
            var suffix := ".gpu.coverage.rgba8" if coverage else ".gpu.rgba8"
            var file := FileAccess.open(OUT + "/%s%s" % [c.name,suffix],FileAccess.WRITE)
            file.store_buffer(image.get_data())
            file.close()
            vp.queue_free()
            await process_frame
        print("D19_SPRITE_GPU_CAPTURE ",c.name)
    print("D19_SPRITE_GPU_CAPTURE_COMPLETE")
    quit()
