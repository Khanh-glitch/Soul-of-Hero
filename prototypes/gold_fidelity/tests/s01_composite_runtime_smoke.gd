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
    # An EARLIER frame must be captured from this very same scene while
    # source pressure sheets are still alive, before any rupture wave.
    instance.call("set_gold_time",1.466666666666667)
    var sheets: Array = instance.get("_meshes")
    var visible_sheets := 0
    for plate: MeshInstance2D in sheets:
        if plate.visible:
            visible_sheets += 1
    if visible_sheets != 14:
        push_error("GOLD_COMPOSITE: expected 14 gold pressure sheets at t1.4667, got %d" % visible_sheets)
        quit(1)
        return
    var early_seam: Dictionary = instance.call("ribbon_diagnostics")
    if not bool(early_seam.get("visible",false)) or int(early_seam.get("point_count",-1))!=16:
        push_error("GOLD_COMPOSITE: Gold Ribbon source path missing in 14-sheet phase: "+str(early_seam))
        quit(1)
        return
    await process_frame
    await RenderingServer.frame_post_draw
    var first_tex: Texture2D = instance.call("get_gold_texture")
    var first_img: Image = first_tex.get_image()
    var folder := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if first_img == null or first_img.get_width()!=480 or DirAccess.make_dir_recursive_absolute(folder)!=OK or first_img.save_png(folder.path_join("s01_composite_146.png"))!=OK:
        push_error("GOLD_COMPOSITE: cannot capture sheet-phase evidence")
        quit(1)
        return
    instance.call("set_gold_time",2.05)
    var mid_seam: Dictionary = instance.call("ribbon_diagnostics")
    if not bool(mid_seam.get("visible",false)) or absf(float(mid_seam.get("width",0.0))-6.0)>0.0001:
        push_error("GOLD_COMPOSITE: original silver-red seam did not widen to 6px: "+str(mid_seam))
        quit(1)
        return
    await process_frame
    await RenderingServer.frame_post_draw
    var mid_img: Image = (instance.call("get_gold_texture") as Texture2D).get_image()
    if mid_img==null or mid_img.get_width()!=480 or mid_img.save_png(folder.path_join("s01_composite_205.png"))!=OK:
        push_error("GOLD_COMPOSITE: original seam mid-phase framebuffer export failed")
        quit(1)
        return
    instance.call("set_gold_time",2.40)
    if not _check("before rupture",instance.call("wave_diagnostics"),0,0,0):
        quit(1)
        return
    instance.call("set_gold_time",2.52)
    if not _check("first wave",instance.call("wave_diagnostics"),1,22,21):
        quit(1)
        return
    instance.call("set_gold_time",2.84)
    var late_seam: Dictionary = instance.call("ribbon_diagnostics")
    if bool(late_seam.get("visible",true)):
        push_error("GOLD_COMPOSITE: source Ribbon persists past endT + 0.3 lifespan: "+str(late_seam))
        quit(1)
        return
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
    if DirAccess.make_dir_recursive_absolute(folder) != OK or img.save_png(folder.path_join("s01_composite_284.png")) != OK:
        push_error("GOLD_COMPOSITE: cannot save native evidence")
        quit(1)
        return
    print("GOLD_S01_COMPOSITE: PASS / floor+14 sheets+source Ribbon+13 waves+286 source objects / deterministic rewind / 480x270 / probes=%d" % sample)
    quit(0)
