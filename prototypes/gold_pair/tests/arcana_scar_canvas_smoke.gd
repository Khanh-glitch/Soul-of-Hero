extends SceneTree
## Native Godot raster staging smoke. DO NOT claim Pixi raster pixel parity.
const CANVAS=preload("res://prototypes/gold_pair/arcana_source_scar_canvas.gd")

func _initialize()->void:
    call_deferred("_run")

func _run()->void:
    var viewport:=SubViewport.new()
    viewport.name="ArcanaScarGoldSpace"
    viewport.size=Vector2i(480,270)
    viewport.transparent_bg=true
    viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var scar=CANVAS.new()
    viewport.add_child(scar)
    scar.begin_source_scar(1,240.0,174.0,8,68.0,5.5,0xff5a1f,0.7)
    scar.render_source_frame(0.0)
    if scar.last_ink!=30 or scar.last_glow!=23:
        _fail("source scar first frame commands mark=%d glow=%d" % [scar.last_ink,scar.last_glow])
        return
    if scar.mark_layer.source_commands.size()!=30 or scar.glow_layer.source_commands.size()!=23:
        _fail("mark/glow commands not submitted independently")
        return
    scar.set_source_to_map_transform(Transform2D(0.0,Vector2(0,0)))
    await process_frame
    await process_frame
    await RenderingServer.frame_post_draw
    var image:Image=viewport.get_texture().get_image()
    if image.get_width()!=480 or image.get_height()!=270:
        _fail("Gold logical 480x270 native image dimensions drift")
        return
    var center:Color=image.get_pixel(240,174)
    var empty:Color=image.get_pixel(30,30)
    if center.a<=0.01 or empty.a>0.01:
        _fail("source pit not rasterized at correct Gold coordinates or clear region altered: center=%s empty=%s" % [str(center),str(empty)])
        return
    var save_code:int=image.save_png("/tmp/arcana-source-scar-godot-preview.png")
    if save_code!=OK:
        _fail("cannot save source 480x270 preview")
        return
    scar.render_source_frame(3.5)
    if scar.last_ink!=30 or scar.last_glow!=15:
        _fail("source glow fading at age=3.5 drift mark=%d glow=%d" % [scar.last_ink,scar.last_glow])
        return
    scar.render_source_frame(5.2)
    if scar.last_ink!=30 or scar.last_glow!=0:
        _fail("source 5.2s aftermath must leave only ground ink")
        return
    scar.render_source_frame(5.5)
    if scar.last_ink!=0 or scar.last_glow!=0:
        _fail("source 5.5s complete scar lifetime must clean all draw ops")
        return
    await process_frame
    await process_frame
    await RenderingServer.frame_post_draw
    var cleared:Image=viewport.get_texture().get_image()
    if cleared.get_pixel(240,174).a>0.01:
        _fail("source scar remains painted after expiry")
        return
    scar.release_source_scar()
    print("ARCANA_SCAR_CANVAS: PASS / source mark+glow 480x270 GPU render / center pit / 3.5 & 5.2 aftermath / 5.5 cleanup")
    quit(0)

func _fail(message:String)->void:
    push_error("ARCANA_SCAR_CANVAS: "+message)
    quit(1)
