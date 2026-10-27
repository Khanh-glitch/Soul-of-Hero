extends SceneTree

## Gate 6 integrated runtime regression. One REAL Godot 4.7 scene and
## actual source-derived ground, 14 sheets, 13 live waves in one viewport.
## NOT a full skill-fidelity certificate.
const SCENE = preload("res://prototypes/gold_fidelity/hairline_source_composite_lab.tscn")

func _initialize() -> void:
    call_deferred("_run")

func _check(where: String, state: Dictionary, waves: int, sources: int, visuals: int) -> bool:
    if int(state.get("wave_count",-1)) != waves or int(state.get("source_count",-1)) != sources or int(state.get("visual_count",-1)) != visuals:
        push_error("GOLD_COMPOSITE: %s expected waves/sources/visuals %d/%d/%d, got %s" % [where,waves,sources,visuals,str(state)])
        return false
    return true

func _run() -> void:
    var instance = SCENE.instantiate()
    root.add_child(instance)
    current_scene = instance
    instance.set("_playing",false)
    instance.call("set_gold_time",2.40)
    if not _check("before rupture",instance.call("wave_diagnostics"),0,0,0):
        quit(1)
        return
    instance.call("set_gold_time",2.52)
    if not _check("first wave",instance.call("wave_diagnostics"),1,22,21):
        quit(1)
        return
    instance.call("set_gold_time",2.84)
    var state: Dictionary = instance.call("wave_diagnostics")
    if not _check("all 13 source waves",state,13,286,273):
        quit(1)
        return
    if int(state.get("ring_count",-1)) < 1 or int(state.get("ring_count",-1)) > 12:
        push_error("GOLD_COMPOSITE: original rings absent or unbounded: "+str(state))
        quit(1)
        return
    # Rewind and replay must preserve exactly one copy of every emitted object.
    instance.call("set_gold_time",2.35)
    if not _check("rewind",instance.call("wave_diagnostics"),0,0,0):
        quit(1)
        return
    instance.call("set_gold_time",2.84)
    var again: Dictionary = instance.call("wave_diagnostics")
    if not _check("deterministic replay",again,13,286,273):
        quit(1)
        return
    # Isolated behavior test can pass while shader outputs blank, so require pixels.
    await process_frame
    await RenderingServer.frame_post_draw
    var tex: Texture2D = instance.call("get_gold_texture")
    var img: Image = tex.get_image()
    if img == null or img.get_width()!=480 or img.get_height()!=270:
        push_error("GOLD_COMPOSITE: invalid original logical viewport")
        quit(1)
        return
    var sample := 0
    for y in range(90,190,2):
        for x in range(100,378,2):
            var c: Color = img.get_pixel(x,y)
            if c.r > 0.16 or c.g > 0.16 or c.b > 0.22:
                sample += 1
    if sample < 500:
        push_error("GOLD_COMPOSITE: scene may be blank (%d lit probe samples)" % sample)
        quit(1)
        return
    var folder := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(folder) != OK or img.save_png(folder.path_join("s01_composite_284.png")) != OK:
        push_error("GOLD_COMPOSITE: cannot save native evidence")
        quit(1)
        return
    print("GOLD_S01_COMPOSITE: PASS / floor+14 sheets+13 waves+286 source objects / deterministic rewind / 480x270 / probes=%d" % sample)
    quit(0)
