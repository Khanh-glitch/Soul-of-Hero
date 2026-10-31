## Original D scene input through native GPU bloom stages on a neutral source
## base. This isolates bloom from D geometry differences and never fabricates
## a SOH scene; it is not live-world composite or visual acceptance.
extends SceneTree
const OUT := "res://artifacts/arcana19-pass-source"

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var bloom := DOriginalBloom.new()
    root.add_child(bloom)
    var manifest_file := FileAccess.open(OUT + "/source_manifest.json", FileAccess.READ)
    if manifest_file == null:
        push_error("Missing original source manifest")
        quit(1)
        return
    var manifest: Dictionary = JSON.parse_string(manifest_file.get_as_text())
    var captures: Array = manifest.captures
    var first := true
    var capture_index := 0
    for tick in [72, 192, 312, 489, 510]:
        var path := OUT + "/original_%d.scene.rgba8" % tick
        var file := FileAccess.open(path, FileAccess.READ)
        if file == null:
            push_error("Missing original scene input: " + path)
            quit(1)
            return
        var data := file.get_buffer(file.get_length())
        if data.size() != 480 * 270 * 4:
            push_error("Incorrect source scene byte count: " + str(data.size()))
            quit(1)
            return
        var img := Image.create_from_data(480, 270, false, Image.FORMAT_RGBA8, data)
        img.flip_y() # WebGL gl.readPixels is bottom-up; Godot images are top-down.
        var tex := ImageTexture.create_from_image(img)
        if first:
            bloom.setup(tex)
            first = false
        else:
            bloom.set_scene(tex)
        var capture: Dictionary = captures[capture_index]
        if int(capture.tick) != tick:
            push_error("Original post parameters do not match source tick")
            quit(1)
            return
        bloom.set_post_params(capture.postParams)
        capture_index += 1
        # The chain consists of eleven distinct viewport dependencies. Keep the
        # input fixed long enough for the rendering graph to settle even on
        # backends that process dependent viewport textures one frame later.
        for frame in range(16):
            await process_frame
            await RenderingServer.frame_post_draw
        var small := bloom.small_texture().get_image()
        var wide := bloom.wide_texture().get_image()
        var post := bloom.post_texture().get_image()
        if small.is_empty() or wide.is_empty() or post.is_empty() or small.get_size() != Vector2i(240, 135) or wide.get_size() != Vector2i(120, 67) or post.get_size() != Vector2i(480, 270):
            push_error("Native D bloom render targets unavailable or wrong size")
            quit(1)
            return
        small.convert(Image.FORMAT_RGBA8)
        wide.convert(Image.FORMAT_RGBA8)
        post.convert(Image.FORMAT_RGBA8)
        for item in [["bloomSmall", small], ["bloom2", wide], ["post", post]]:
            var out := FileAccess.open(OUT + "/native_%d.%s.rgba8" % [tick, item[0]], FileAccess.WRITE)
            out.store_buffer((item[1] as Image).get_data())
            out.close()
        for i in range(10):
            var stage := bloom.stage_texture(i).get_image()
            if stage.is_empty():
                push_error("Native bloom intermediate unavailable: " + str(i))
                quit(1)
                return
            stage.convert(Image.FORMAT_RGBA8)
            var stage_file := FileAccess.open(OUT + "/native_%d.stage%d.rgba8" % [tick, i], FileAccess.WRITE)
            stage_file.store_buffer(stage.get_data())
            stage_file.close()
        print("D19_NATIVE_BLOOM_CAPTURE ", tick)
    bloom.free()
    print("D19_NATIVE_BLOOM_CAPTURE_COMPLETE")
    quit(0)
