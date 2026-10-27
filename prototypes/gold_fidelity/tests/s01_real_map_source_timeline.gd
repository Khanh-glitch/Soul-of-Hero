extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## Gate 11 on the REAL Chapter 1 Level 2 map (pinned separate map branch):
## Gold source time 1.4667 / 2.05 / 2.84 on the SAME real Knight camera.
## Uses source 14 pressure sheets + source 16-point Ribbon + 13 live waves,
## with Gold segment displacement and source ring/light post shader.
## Does NOT paint the original gold persistent CPU ground buffer onto
## arbitrary authored tiles, run full-cast RNG, move real enemies via
## combat authority, or deliver gameplay damage. NOT a finished skill.
const PLATES = preload("res://prototypes/gold_fidelity/gold_s01_world_pressure_sheets.gd")
const RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")
const SEAM = preload("res://prototypes/gold_fidelity/gold_s01_seam_timeline.gd")
const WAVE = preload("res://prototypes/gold_fidelity/gold_s01_live_wave_layer.gd")
const POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const SEG = preload("res://prototypes/gold_fidelity/segment_math.gd")
const PLATE_MATH = preload("res://prototypes/gold_fidelity/gold_hairline_plate_factory.gd")
const TARGET := Vector2(300.0,141.0)
var _extra_failures := 0

func _vcheck(ok: bool, label: String) -> void:
    if not ok:
        _extra_failures += 1
        _expect(false,"GOLD S01 TRUE MAP TIMELINE: "+label)

func _capture_campaign_state(game: Node2D) -> void:
    await super._capture_campaign_state(game)
    var level := game.get_node_or_null("Level") as DungeonLevel
    var root_entities := game.get_node_or_null("Level/Entities") as Node2D
    var knight := root_entities.get_node_or_null("Knight") as CharacterBody2D if root_entities!=null else null
    _vcheck(level!=null and root_entities!=null and knight!=null,"production scene and Knight exist")
    if level==null or root_entities==null or knight==null:
        return
    var enemies: Array[Node2D] = []
    for child: Node in root_entities.get_children():
        if child is Node2D and child.is_in_group(&"enemies"):
            enemies.append(child as Node2D)
    _vcheck(enemies.size()>=1,"at least one real production enemy exists")
    if enemies.is_empty():
        return
    var enemy: Node2D=enemies[0]
    for e: Node2D in enemies:
        if e.global_position.distance_squared_to(knight.global_position)<enemy.global_position.distance_squared_to(knight.global_position):
            enemy=e
    var camera := knight.get_node_or_null("Camera") as Camera2D
    _vcheck(camera!=null and camera.is_current(),"production Knight Camera2D is active")
    if camera==null:
        return
    # Test-only staging, never authored into the game JSON or character scripts.
    var hp_before: Variant=enemy.get("health")
    var knight_hp: Variant=knight.get("health")
    var cell_count: int=level.geometry.get_used_cells().size()
    knight.set_physics_process(false)
    var spawn_position: Vector2=knight.global_position
    knight.global_position=enemy.global_position-Vector2(214,0)
    knight.velocity=Vector2.ZERO
    camera.reset_smoothing()
    camera.force_update_scroll()
    await get_tree().process_frame

    var offset: Vector2=enemy.global_position-TARGET
    var stage := Node2D.new()
    stage.name="Gold_S01_RealWorldTimeline_SourceOnly"
    game.add_child(stage)
    var sheets = PLATES.new()
    sheets.name="Gold14PressureSheets_SourceGeometry"
    sheets.position=offset
    stage.add_child(sheets)
    var ribbon = RIBBON.new()
    ribbon.name="GoldSeamRibbon_OriginalSource"
    ribbon.position=offset
    stage.add_child(ribbon)
    ribbon.configure({"w":1.5,"wprof":2,"style":4,
        "seed":SEAM.SOURCE_SEED_AT_FIXTURE,"extra":1.0,"wobF":50.0,
        "life":3.6,"layer":5})
    var wave = WAVE.new()
    wave.name="Gold_13Waves_ActualSourceRuntime"
    wave.position=offset
    stage.add_child(wave)

    # Production HUD lives in CanvasLayer 90; image post is BELOW it, at 60.
    var post_layer := CanvasLayer.new()
    post_layer.name="GoldScreenPost_BelowRealHUD"
    post_layer.layer=60
    game.add_child(post_layer)
    var screen_rect := ColorRect.new()
    screen_rect.name="GoldShader_DistortionOnActualTileMap"
    screen_rect.mouse_filter=Control.MOUSE_FILTER_IGNORE
    screen_rect.color=Color.WHITE
    post_layer.add_child(screen_rect)
    screen_rect.position=Vector2.ZERO
    var logical: Vector2=get_viewport().get_visible_rect().size
    screen_rect.size=logical
    var post_material := ShaderMaterial.new()
    post_material.shader=POST
    screen_rect.material=post_material
    post_material.set_shader_parameter(&"u_amb",1.0)
    post_material.set_shader_parameter(&"u_res",logical)
    wave.bind_post(post_material)
    var scene_canvas: Transform2D=get_viewport().get_canvas_transform()
    var a: Vector2=scene_canvas*(offset+SEG.SOURCE_START)
    var b: Vector2=scene_canvas*(offset+SEG.SOURCE_END)
    var scale: float=scene_canvas.x.length()
    var canvas_bounds: Rect2=get_viewport().get_visible_rect()
    _vcheck(canvas_bounds.has_point(a) or canvas_bounds.has_point(b),
        "world-positioned source segment intersects real camera view")
    var out_path: String=ProjectSettings.globalize_path("res://.artifacts/vfx_real_map")
    _vcheck(DirAccess.make_dir_recursive_absolute(out_path)==OK,"evidence directory can be created")
    var expected: Array[Dictionary]=[
        {"time":1.4666666667,"sheets":14,"waves":0,"ribbon":true,"name":"s01_map_source_146.png"},
        {"time":2.05,"sheets":14,"waves":0,"ribbon":true,"name":"s01_map_source_205.png"},
        {"time":2.84,"sheets":0,"waves":13,"ribbon":false,"name":"s01_map_source_284.png"}
    ]
    for mark: Dictionary in expected:
        var t: float=float(mark["time"])
        sheets.seek_source_time(t)
        var rb: Dictionary=SEAM.state_at(t,-1.0)
        ribbon.source_width=float(rb["source_width"])
        ribbon.source_wobble=float(rb["source_wobble"])
        ribbon.source_life=float(rb["source_life"])
        ribbon.source_fade_mode=int(rb["source_fade_mode"])
        ribbon.set_source_frame(float(rb["source_age"]),rb["source_points"],
            bool(rb["source_live"]),float(rb["source_end_age"]),t)
        wave.seek_seconds(maxf(0.0,t-2.5))
        var wave_state: Dictionary=wave.diagnostics()
        _vcheck(int(wave_state["wave_count"])==int(mark["waves"]),
            "source-timed 13-wave trigger count at t="+str(t))
        _vcheck(sheets.visible_source_plates()==int(mark["sheets"]),
            "source-timed fourteen sheets lifetime at t="+str(t))
        _vcheck(ribbon.visible==bool(mark["ribbon"]),
            "source-timed seam lifespan at t="+str(t))
        post_material.set_shader_parameter(&"u_time",t)
        # Source segment: born at PLATE_MATH.CREATED_AT (0.98333s).
        # NO frozen 1.4667 strength when other effects are at 2.84s.
        var strength: float=SEG.strength_at(t-PLATE_MATH.CREATED_AT)
        var seg_data := PackedVector4Array()
        var seg_widths := PackedVector2Array()
        for i in range(8):
            seg_data.append(Vector4(a.x,a.y,b.x,b.y) if i==0 else Vector4.ZERO)
            seg_widths.append(Vector2(SEG.WIDTH*scale,strength*scale) if i==0 else Vector2.ZERO)
        post_material.set_shader_parameter(&"u_seg",seg_data)
        post_material.set_shader_parameter(&"u_seg_p",seg_widths)
        post_material.set_shader_parameter(&"u_ns",1 if strength>0.0 else 0)
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var frame: Image=get_viewport().get_texture().get_image()
        _vcheck(frame!=null and frame.get_width()==1280 and frame.get_height()==720,
            "real-map PNG is 1280x720 at "+str(t))
        if frame!=null:
            _vcheck(frame.save_png(out_path.path_join(String(mark["name"])))==OK,
                "real-map Gold source timeline frame captured at "+str(t))
        print("GOLD_S01_TRUE_MAP_TIMELINE_FRAME: time=%.4f sheets=%d ribbon=%s waves=%d dist=%.5f" %
            [t,sheets.visible_source_plates(),str(ribbon.visible),int(wave_state["wave_count"]),strength])
    _vcheck(enemy.get("health")==hp_before and knight.get("health")==knight_hp,
        "original HP remains under gameplay authority")
    _vcheck(level.geometry.get_used_cells().size()==cell_count,
        "actual collision TileMap has not been rewritten")
    knight.global_position=spawn_position
    post_layer.queue_free()
    stage.queue_free()
    if _extra_failures==0:
        print("GOLD_S01_TRUE_MAP_TIMELINE: PASS / 3 native real-map frames source-timed, 14 sheets, seam cleanup, 13 waves; NO gameplay writes")
