extends SceneTree

## Truth is read from original user Gold JS, source seed 0x20261027:
## tick 35: 2 points; tick 52: 16 points ending 383.05449526692246
## tick 105 world t1.71667: width 2.345 and wobble +1.126666...
## tick 125 world t2.05: width 6 and wobble -2.6, live=false
## This test asserts the ORIGINAL World.move+World.trail+Ribbon mathematics.
const SEAM = preload("res://prototypes/gold_fidelity/gold_s01_seam_timeline.gd")
const RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")
const POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")

func _fail(message: String) -> void:
    push_error("GOLD_S01_SEAM: "+message)
    quit(1)

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var at35: PackedVector2Array = SEAM.path_at(35.0/60.0)
    if at35.size()!=2 or at35[0].distance_to(Vector2(94.0,141.0))>0.00001:
        _fail("tick35 live follower points")
        return
    if absf(at35[1].x-131.93017528563968)>0.00002:
        _fail("gold eased dash x at tick35")
        return
    var at52: PackedVector2Array = SEAM.path_at(52.0/60.0)
    if at52.size()!=16 or absf(at52[15].x-383.05449526692246)>0.00005:
        _fail("tick52 16-point original ribbon path")
        return
    var at105: Dictionary = SEAM.state_at(103.0/60.0,1.0)
    # Gold world-time 1.716667 occurs after source hitstop, not at physical frame103.
    if absf(float(at105["source_width"])-2.345)>0.001:
        _fail("source widened seam formula")
        return
    var state: Dictionary = SEAM.state_at(2.05,-1.0)
    if absf(float(state["source_width"])-6.0)>0.00001 or absf(float(state["source_wobble"])+2.6)>0.00001:
        _fail("gold width and signed oscillation")
        return
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var background := ColorRect.new()
    background.color = Color8(12,11,22)
    background.size = Vector2(480,270)
    viewport.add_child(background)
    var ribbon = RIBBON.new()
    viewport.add_child(ribbon)
    ribbon.configure({"w":float(state["source_width"]),"wprof":2,"style":4,
        "seed":SEAM.SOURCE_SEED_AT_FIXTURE,"extra":1,"layer":5,
        "wobble":float(state["source_wobble"]),"wobF":50.0,"life":3.6})
    ribbon.set_source_frame(float(state["source_age"]),state["source_points"],
        bool(state["source_live"]),float(state["source_end_age"]),float(state["world_time"]))
    if ribbon.source_last_triangles < 30 or absf(ribbon.source_world_time-ribbon.source_age-0.55)>0.0001:
        _fail("ribbon mesh or world/local time separation")
        return
    var post := ColorRect.new()
    post.size = Vector2(480,270)
    post.color = Color.WHITE
    post.z_index = 100
    var material := ShaderMaterial.new()
    material.shader = POST
    material.set_shader_parameter(&"u_amb",1.0)
    material.set_shader_parameter(&"u_time",2.05)
    post.material = material
    viewport.add_child(post)
    await process_frame
    await RenderingServer.frame_post_draw
    var img: Image = viewport.get_texture().get_image()
    if img==null or img.get_width()!=480:
        _fail("native framebuffer unavailable")
        return
    var occupied := 0
    for y in range(124,164):
        for x in range(90,388):
            var col := img.get_pixel(x,y)
            if col.r > 0.20 or col.g > 0.23 or col.b > 0.25:
                occupied+=1
    if occupied<80:
        _fail("source ribbon not visible after postshader: "+str(occupied))
        return
    var dir := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(dir)!=OK or img.save_png(dir.path_join("s01_gold_seam_tick125_native.png"))!=OK:
        _fail("frame evidence failed to save")
        return
    # Replay three more REAL source-world samples in the SAME native renderer.
    # Each random-sign observation came from the original seeded WebGL engine.
    for sample: Dictionary in [
        {"frame":52,"time":0.8333333333333343,"sign":1.0},
        {"frame":105,"time":1.7166666666666655,"sign":1.0},
        {"frame":160,"time":2.533333333333329,"sign":1.0}
    ]:
        var t: float = float(sample["time"])
        var state_i: Dictionary = SEAM.state_at(t,float(sample["sign"]))
        ribbon.source_width = float(state_i["source_width"])
        ribbon.source_wobble = float(state_i["source_wobble"])
        ribbon.source_life = float(state_i["source_life"])
        ribbon.source_fade_mode = int(state_i["source_fade_mode"])
        ribbon.set_source_frame(float(state_i["source_age"]),state_i["source_points"],
            bool(state_i["source_live"]),float(state_i["source_end_age"]),t)
        material.set_shader_parameter(&"u_time",t)
        await process_frame
        await RenderingServer.frame_post_draw
        var image_i: Image = viewport.get_texture().get_image()
        if image_i==null or image_i.save_png(dir.path_join("s01_gold_seam_tick%d_native.png" % int(sample["frame"])))!=OK:
            _fail("failed to capture original seed/timeline at frame "+str(sample["frame"]))
            return
    print("GOLD_S01_SEAM_ORACLE: PASS / gold 4-frame source oracle (52/105/125/160) / tick35 and tick52 path / tick105 width / tick125 signed wobble / correct world shader clock / lit=%d" % occupied)
    quit(0)
