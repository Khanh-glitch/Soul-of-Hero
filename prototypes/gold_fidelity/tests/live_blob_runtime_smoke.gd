extends SceneTree

## Native-state regression of a live ORIGINAL gold smoke Blob:
## one value supplied by the seeded wave emitter, then 60 Hz source updates.
const SOURCE_BLOB = preload("res://prototypes/gold_fidelity/gold_blob_primitive.gd")
const EMITTER = preload("res://prototypes/gold_fidelity/gold_source_wave_emitter.gd")
const DT := 1.0/60.0

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var emitter = EMITTER.new(0x20261027)
    var objects: Array[Dictionary] = emitter.spawn_standard_wave(Vector2(278.0,141.0),-1)
    var smoke_source: Dictionary = {}
    for obj in objects:
        if String(obj["kind"]) == "blob" and int((obj["source"] as Dictionary).get("shape",-1)) == 2:
            smoke_source = obj["source"]
            break
    if smoke_source.is_empty():
        push_error("GOLD_LIVE_BLOB: missing original smoke instance")
        quit(1)
        return
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var ground := ColorRect.new()
    ground.size = Vector2(480,270)
    ground.color = Color("#0c0b16")
    viewport.add_child(ground)
    var instance = SOURCE_BLOB.new()
    viewport.add_child(instance)
    instance.configure(smoke_source)
    if instance.dead or instance.age != 0.0 or int(instance.z_index) != 3:
        push_error("GOLD_LIVE_BLOB: invalid source initialization")
        quit(1)
        return
    var before: Vector2 = Vector2(float(smoke_source["x"]),float(smoke_source["y"])-float(smoke_source.get("z",0.0)))
    for i in range(15):
        instance.step_gold(DT,2.5+(i+1)*DT)
    var desired := Vector2(
        float(smoke_source["x"])+float(smoke_source["gold_upd_vx"])*15.0*0.016,
        float(smoke_source["y"])+float(smoke_source["gold_upd_vy"])*15.0*0.016-
          (float(smoke_source.get("z",0.0))+float(smoke_source["gold_upd_rise"])*15.0*0.016))
    if instance.position.distance_to(desired)>0.0005:
        push_error("GOLD_LIVE_BLOB: source callback movement drift: %s vs %s from %s" %
            [str(instance.position),str(desired),str(before)])
        quit(1)
        return
    if absf(instance.age-15.0*DT)>0.0001 or instance.dead:
        push_error("GOLD_LIVE_BLOB: update clock parity failed")
        quit(1)
        return
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = viewport.get_texture().get_image()
    if image == null or image.get_width()!=480 or image.get_height()!=270:
        push_error("GOLD_LIVE_BLOB: native frame absent")
        quit(1)
        return
    var count := 0
    var bg := Color("#0c0b16")
    for y in range(80,200):
        for x in range(215,340):
            var c: Color = image.get_pixel(x,y)
            if absf(c.r-bg.r)+absf(c.g-bg.g)+absf(c.b-bg.b)>0.07:
                count+=1
    if count<20:
        push_error("GOLD_LIVE_BLOB: original shader did not render dynamically")
        quit(1)
        return
    var outdir := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(outdir)!=OK or image.save_png(outdir.path_join("live_smoke_after_15_ticks.png"))!=OK:
        push_error("GOLD_LIVE_BLOB: failed to export evidence")
        quit(1)
        return
    for i in range(180):
        if instance.dead: break
        instance.step_gold(DT,2.75+(i+1)*DT)
    if not instance.dead:
        push_error("GOLD_LIVE_BLOB: lifecycle never expires")
        quit(1)
        return
    print("GOLD_LIVE_BLOB: PASS frame=15 visible_pixels="+str(count)+" expired=true")
    quit(0)
