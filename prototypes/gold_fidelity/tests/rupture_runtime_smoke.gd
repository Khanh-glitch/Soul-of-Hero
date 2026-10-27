extends SceneTree

## Headless native visual/physics test for all 13 base gold rupture waves.
## Does not claim full seven-second skill fidelity.
const RUNTIME = preload("res://prototypes/gold_fidelity/gold_rupture_runtime.gd")
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var background := ColorRect.new()
    background.color=Color("#0c0b16")
    background.size=Vector2(480,270)
    viewport.add_child(background)
    var runtime = RUNTIME.new()
    viewport.add_child(runtime)
    runtime.start(0x20261027,Vector2.ZERO)
    for t in range(27):
        runtime.tick_60hz()
    var data: Dictionary=runtime.snapshot()
    if int(data["waves"]) != 13 or int(data["spawned_source"]) != 286 or int(data["spawned_visual"]) != 273:
        push_error("GOLD_13_WAVE_RUNTIME: incomplete wave/object counts: "+str(data))
        quit(1)
        return
    if int(data["active_rings"]) > 12:
        push_error("GOLD_13_WAVE_RUNTIME: post ring buffer overflow: "+str(data))
        quit(1)
        return
    await process_frame
    await RenderingServer.frame_post_draw
    var frame: Image=viewport.get_texture().get_image()
    if frame==null or frame.get_width()!=480 or frame.get_height()!=270:
        push_error("GOLD_13_WAVE_RUNTIME: invalid image")
        quit(1)
        return
    var occupied := 0
    var base := Color("#0c0b16")
    for y in range(55,210):
        for x in range(65,415):
            var px: Color=frame.get_pixel(x,y)
            if absf(px.r-base.r)+absf(px.g-base.g)+absf(px.b-base.b)>0.1:
                occupied += 1
    if occupied < 250:
        push_error("GOLD_13_WAVE_RUNTIME: image empty/too small occupied="+str(occupied))
        quit(1)
        return
    var dir := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(dir)!=OK or frame.save_png(dir.path_join("s01_thirteen_wave_runtime_tick27.png"))!=OK:
        push_error("GOLD_13_WAVE_RUNTIME: evidence PNG failed")
        quit(1)
        return
    print("GOLD_13_WAVE_RUNTIME: PASS "+str(data)+" source_pixels="+str(occupied))
    quit(0)
