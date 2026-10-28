extends SceneTree

## Ultra k2 is a NEW original source raster, not k1 upscaled.
## 1200x680 exact GDScript Fang shadow/body/lit buffers + OpenGL upload/readback.
## Frame53 from unmodified original TS Fang at source logical time53/60.
## Does NOT claim entire Glassfang/full World post parity.
const FANG=preload("res://prototypes/gold_pair/venom_source_fang.gd")
const CANVAS=preload("res://prototypes/gold_pair/venom_source_fang_canvas.gd")
const GOLD_SHA={
    "shd":"e8918d1580152191d0c3a9c54e7ec93078458f7cf293661475fbdeb351e48c60",
    "up":"d4cb2aa0bcd9372a91066059c5faf0f6b72f4931e8afb74e975b46ee1d6a95bc",
    "lit":"b6baa97252e9f5c878c952b101552217808796f1043f53b548b0634bfba9f538"
}

func _initialize()->void:
    call_deferred("_run")

func _run()->void:
    var viewport:=SubViewport.new()
    viewport.size=Vector2i(1200,680)
    viewport.transparent_bg=true
    viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var canvas=CANVAS.new()
    canvas.set_source_density(2)
    viewport.add_child(canvas)
    var original=FANG.new(270.25,150.75,0.41)
    for tick in range(54):
        var tf:float=float(tick)
        if tick>0:
            original.x=270.25+55.0*(1.0-exp(-tf/25.0))+cos(tf*0.16)*4.0
            original.y=150.75+18.0*sin(tf*0.09)-8.0*sin(tf*0.06)
        original.heading=0.41+tf*0.013
        original.open=0.2+0.8*(0.5+0.5*sin(tf*0.11))
        original.z=7.0+5.0*sin(tf*0.12)
        original.scale=1.0+0.08*sin(tf*0.07)
        original.update_chain()
    var frames:Dictionary=canvas.render_live_actor_frame(original,53.0/60.0)
    if frames.size()!=3 or canvas.W!=1200 or canvas.H!=680:
        _fail("missing source true Ultra k2 buffers")
        return
    for pass_name in ["shd","up","lit"]:
        var bytes:PackedByteArray=frames[pass_name]
        if bytes.size()!=1200*680*4:
            _fail("Ultra dimensions wrong pass "+pass_name)
            return
        var ctx:=HashingContext.new()
        ctx.start(HashingContext.HASH_SHA256)
        ctx.update(bytes)
        if ctx.finish().hex_encode()!=String(GOLD_SHA[pass_name]):
            _fail("Original source Ultra per-pass SHA drift "+pass_name)
            return
        if canvas.images[pass_name].get_data()!=bytes:
            _fail("CPU Image set_data mismatch "+pass_name)
            return
        if canvas.sprites[pass_name].texture_filter!=CanvasItem.TEXTURE_FILTER_NEAREST:
            _fail("Ultra pixel rendering not nearest "+pass_name)
            return
    var additive:CanvasItemMaterial=canvas.sprites["lit"].material
    if additive==null or additive.blend_mode!=CanvasItemMaterial.BLEND_MODE_ADD:
        _fail("Gold additive glow pass missing")
        return
    await process_frame
    await process_frame
    await RenderingServer.frame_post_draw
    for pass_name in ["shd","up","lit"]:
        if canvas.textures[pass_name].get_image().get_data()!=frames[pass_name]:
            _fail("OpenGL source Ultra k2 GPU texture readback drift "+pass_name)
            return
    var screenshot:Image=viewport.get_texture().get_image()
    if screenshot.get_width()!=1200 or screenshot.get_height()!=680:
        _fail("Godot framebuffer is not original 1200x680 Ultra")
        return
    if screenshot.save_png("/tmp/glassfang-godot-original-ultra-k2.png")!=OK:
        _fail("Cannot save native Ultra screenshot")
        return
    canvas.release_source_actor()
    for pass_name in ["shd","up","lit"]:
        if canvas.sprites[pass_name].visible:
            _fail("Original Fang Ultra failed cleanup")
            return
    print("VENOM_FANG_ULTRA_GPU: PASS / exact Gold 1200x680 three-pass RGBA SHA / OpenGL texture readback / native screenshot / cleanup")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_FANG_ULTRA_GPU: "+message)
    quit(1)
