extends SceneTree
const LAB=preload("res://prototypes/gold_fidelity/hairline_source_components_lab.tscn")
func _initialize() -> void:
    call_deferred("_render")

func _render() -> void:
    var scene := LAB.instantiate() as Node2D
    root.add_child(scene)
    scene.set("_playing",false)
    var dir := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(dir)!=OK:
        push_error("GOLD_SOURCE_COMPOSITE: artifact directory failure")
        quit(1);return
    await process_frame
    for rec in [{"name":"hairline_ground_plates_146","time":1.4666666666666663},{"name":"hairline_ground_rupture_270","time":2.7}]:
        scene.call("set_gold_time",float(rec["time"]))
        await process_frame
        await RenderingServer.frame_post_draw
        var texture: Texture2D=scene.call("get_gold_texture")
        var frame: Image=texture.get_image()
        if frame==null or frame.get_size()!=Vector2i(480,270):
            push_error("GOLD_SOURCE_COMPOSITE: 480x270 viewport is not rendered")
            quit(1);return
        var name: String=String(rec["name"])
        if frame.save_png(dir.path_join(name+".png"))!=OK:
            push_error("GOLD_SOURCE_COMPOSITE: failed to save native PNG")
            quit(1);return
        print("GOLD_SOURCE_COMPOSITE_FRAME: %s at %.6fs" % [name,rec["time"]])
    print("GOLD_SOURCE_COMPOSITE: PASS 2 native snapshots")
    quit(0)
