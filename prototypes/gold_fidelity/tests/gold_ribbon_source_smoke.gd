extends SceneTree

## Original World.Ribbon.draw strip topology / exact source shader native render.
## This is a controlled renderer fixture, NOT a complete S01 gold-reference frame.
const RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var viewport := SubViewport.new()
    viewport.size = Vector2i(480,270)
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    root.add_child(viewport)
    var bg := ColorRect.new()
    bg.color = Color("#0c0b16")
    bg.size = Vector2(480,270)
    viewport.add_child(bg)
    var rb = RIBBON.new()
    viewport.add_child(rb)
    rb.configure({"w":6.0,"wprof":2,"style":4,"seed":0.45,"wobble":0.0,
        "extra":1.0,"layer":5,"life":3.6})
    var line := PackedVector2Array([Vector2(100,140),Vector2(200,140)])
    rb.set_source_frame(1.1,line,true)
    var stats: Dictionary = rb.source_summary()
    if int(stats["triangle_count"]) != 8 or int(stats["point_count"]) != 2:
        push_error("GOLD_RIBBON: source strip tessellation not 4x2 triangles "+str(stats))
        quit(1)
        return
    var arrays: Array = rb.mesh.surface_get_arrays(0)
    var pts: PackedVector2Array = arrays[Mesh.ARRAY_VERTEX]
    var uv: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
    var vertex_col: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
    if pts.size()!=24 or absf(pts[0].x-100.0)>0.0001 or absf(pts[0].y-140.9)>0.0005:
        push_error("GOLD_RIBBON: expected original end-cap profile at first point "+str(pts[0]))
        quit(1)
        return
    if uv[0]!=Vector2(0,-1) or uv[2].x<=uv[0].x or vertex_col[0].r!=0.0:
        push_error("GOLD_RIBBON: original source UV/normalized-distance attrs drift")
        quit(1)
        return
    # Test cutoff / reversed-seek reconstruction from source.
    rb.source_fade_mode=1
    rb.source_life=1.0
    rb.set_source_frame(0.5,line,false,0.0)
    arrays=rb.mesh.surface_get_arrays(0)
    pts=arrays[Mesh.ARRAY_VERTEX]
    if pts.size()==0 or pts[0].x < 148.0:
        push_error("GOLD_RIBBON: backward cut failed to trim early path")
        quit(1)
        return
    rb.source_fade_mode=0
    rb.source_life=3.6
    rb.source_wobble=2.0
    rb.source_width=5.5
    rb.set_source_frame(1.5,PackedVector2Array([Vector2(94,141),Vector2(146,141),
        Vector2(204,141),Vector2(280,141),Vector2(384,141)]),true)
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = viewport.get_texture().get_image()
    if image==null or image.get_width()!=480 or image.get_height()!=270:
        push_error("GOLD_RIBBON: could not capture native 480x270 framebuffer")
        quit(1)
        return
    var lit := 0
    var background := Color("#0c0b16")
    for y in range(122,160):
        for x in range(92,388):
            var pix := image.get_pixel(x,y)
            if absf(pix.r-background.r)+absf(pix.g-background.g)+absf(pix.b-background.b)>0.09:
                lit += 1
    if lit<80:
        push_error("GOLD_RIBBON: original shader output missing, pixels="+str(lit))
        quit(1)
        return
    var folder := ProjectSettings.globalize_path("res://.artifacts/gold_fidelity")
    if DirAccess.make_dir_recursive_absolute(folder)!=OK or image.save_png(folder.path_join("source_ribbon_style4.png"))!=OK:
        push_error("GOLD_RIBBON: evidence PNG export failed")
        quit(1)
        return
    print("GOLD_RIBBON_NATIVE: PASS exact vertex topology, end caps, UVs, cut and moving shader; lit=%d" % lit)
    quit(0)
