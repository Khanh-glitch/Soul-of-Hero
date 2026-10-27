extends SceneTree

## One SOURCE-derived non-center S01 wave at (278,141), seeded 0x20261027.
## Draws live Blob + Chunk + Part on native 480x270 viewport, 1/60 step.
## Missing in this narrow gate: ring POST distortion, ground writes,
## whole-skill ribbon/hero/enemy, full 13-wave global RNG stream.
const EMITTER = preload("res://prototypes/gold_fidelity/gold_source_wave_emitter.gd")
const BLOB = preload("res://prototypes/gold_fidelity/gold_blob_primitive.gd")
const GLYPH = preload("res://prototypes/gold_fidelity/gold_rupture_glyph.gd")
const DT := 1.0/60.0

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var emitter = EMITTER.new(0x20261027)
    var sources: Array[Dictionary] = emitter.spawn_standard_wave(Vector2(278,141),-1)
    if sources.size() != 22 or emitter.random_state() != 1023886811:
        push_error("GOLD_LIVE_WAVE: source RNG or spawn count changed")
        quit(1)
        return
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var bg := ColorRect.new()
    bg.size = Vector2(480,270)
    bg.color = Color("#0c0b16")
    viewport.add_child(bg)
    var instances: Array[Node2D] = []
    var kinds := {"blob":0,"chunk":0,"part":0,"ring":0}
    for item: Dictionary in sources:
        var kind: String = String(item["kind"])
        kinds[kind] = int(kinds.get(kind,0)) + 1
        if kind == "ring":
            continue
        var node: Node2D = BLOB.new() if kind == "blob" else GLYPH.new()
        viewport.add_child(node)
        if kind == "blob":
            node.call("configure",item["source"])
        else:
            node.call("configure",kind,item["source"])
        instances.append(node)
    if kinds != {"blob":7,"chunk":9,"part":5,"ring":1} or instances.size() != 21:
        push_error("GOLD_LIVE_WAVE: wrong original wave composition "+str(kinds))
        quit(1)
        return
    for frame in range(15):
        for instance: Node2D in instances:
            if not is_instance_valid(instance):
                continue
            if instance.get("dead"):
                continue
            if instance is GoldBlobPrimitive:
                instance.call("step_gold",DT,2.5+float(frame+1)*DT)
            else:
                instance.call("step_gold",DT)
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = viewport.get_texture().get_image()
    if image == null or image.get_width() != 480 or image.get_height() != 270:
        push_error("GOLD_LIVE_WAVE: native framebuffer invalid")
        quit(1)
        return
    var bg_color := Color("#0c0b16")
    var visible_count := 0
    for y in range(70,215):
        for x in range(190,380):
            var pix: Color = image.get_pixel(x,y)
            if absf(pix.r-bg_color.r)+absf(pix.g-bg_color.g)+absf(pix.b-bg_color.b)>0.06:
                visible_count += 1
    if visible_count < 90:
        push_error("GOLD_LIVE_WAVE: no substantial native wave image: "+str(visible_count))
        quit(1)
        return
    var folder := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(folder) != OK or image.save_png(folder.path_join("s01_live_wave_tick15.png")) != OK:
        push_error("GOLD_LIVE_WAVE: couldn't save screenshot")
        quit(1)
        return
    print("GOLD_LIVE_WAVE: PASS / 22 source objects / 21 direct visual objects / pixels="+str(visible_count))
    quit(0)
