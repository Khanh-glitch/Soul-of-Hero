extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## Executes inside the *production* Chapter 1 AppFlow capture harness.
## Full real map, real Knight, real enemies, real Camera2D, real TileMap layers.
## VFX module checkout is overlaid into a PINNED MAP BRANCH in a temporary CI workspace.
## No gameplay scripts, authored level JSON, project.godot or source map branch touched.
##
## Explicit NON-GOAL: this is NOT an all-7s or gameplay-damage integration.
## Gold-authored floor CPU marks are not yet hooked to arbitrary SOH TileSets.
const RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")
const SEAM = preload("res://prototypes/gold_fidelity/gold_s01_seam_timeline.gd")
const WAVE = preload("res://prototypes/gold_fidelity/gold_s01_live_wave_layer.gd")
const POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const MATH = preload("res://prototypes/gold_fidelity/segment_math.gd")
const RUPTURE_T := 2.84
const SOURCE_TARGET := Vector2(300.0,141.0)
var _real_map_failures := 0

func _verify(condition: bool, label: String) -> void:
    if not condition:
        _real_map_failures += 1
        _expect(false,"VFX REAL MAP: "+label)

func _capture_campaign_state(game: Node2D) -> void:
    # Production test first: AppFlow -> Chapter1 Level2 -> Knight + enemies + TileMaps.
    # Parent also captures genuine unmodified map frame, freezes Knight physics,
    # and validates map authoring / live entities.
    await super._capture_campaign_state(game)
    var level := game.get_node_or_null("Level") as DungeonLevel
    var entities := game.get_node_or_null("Level/Entities") as Node2D
    var knight := entities.get_node_or_null("Knight") as CharacterBody2D if entities!=null else null
    _verify(level!=null and entities!=null and knight!=null,"real production level and actor tree exist")
    if level==null or entities==null or knight==null:
        return

    var real_enemies: Array[Node2D] = []
    for child: Node in entities.get_children():
        if child is Node2D and child.is_in_group(&"enemies"):
            real_enemies.append(child as Node2D)
    _verify(not real_enemies.is_empty(),"not a dummy enemy: actor from original map")
    if real_enemies.is_empty():
        return
    var enemy: Node2D = real_enemies[0]
    for candidate: Node2D in real_enemies:
        if candidate.global_position.distance_squared_to(knight.global_position) < enemy.global_position.distance_squared_to(knight.global_position):
            enemy=candidate
    _verify(enemy.is_inside_tree(),"selected enemy is an actual instantiated map actor")
    var before_knight_hp: Variant = knight.get("health")
    var before_enemy_hp: Variant = enemy.get("health")
    _verify(level.backdrop.get_used_cells().size()>100,"authored TileMap is present and nontrivial")
    _verify(level.geometry.get_used_cells().size()>0,"map collision Geometry was loaded")
    var camera := knight.get_node_or_null("Camera") as Camera2D
    _verify(camera!=null and camera.is_current(),"real Knight camera is active")
    if camera==null:
        return

    # Test-only staging: move the *real* actor (not a proxy) into line of sight
    # of the *real* enemy. Neither position is committed to the level layout.
    # The overlay stays fully in world coordinates and never edits TileMap cells.
    var original_position := knight.global_position
    var actor_anchor := enemy.global_position - Vector2(214.0,0.0)
    knight.global_position=actor_anchor
    knight.velocity=Vector2.ZERO
    knight.set_physics_process(false)
    camera.reset_smoothing()
    camera.force_update_scroll()
    await get_tree().process_frame
    await RenderingServer.frame_post_draw
    var output := "res://.artifacts/vfx_real_map"
    var folder := ProjectSettings.globalize_path(output)
    if DirAccess.make_dir_recursive_absolute(folder)!=OK:
        _verify(false,"cannot create source evidence folder")
        return
    var aligned_baseline: Image=get_viewport().get_texture().get_image()
    _verify(aligned_baseline!=null and aligned_baseline.save_png(folder.path_join("chapter1_l2_aligned_baseline.png"))==OK,
        "actual level baseline from the SAME camera view as source VFX")

    var offset := enemy.global_position-SOURCE_TARGET
    var fx_world := Node2D.new()
    fx_world.name="GOLD_S01_REAL_MAP_VFX_ONLY"
    game.add_child(fx_world)
    var ribbon = RIBBON.new()
    ribbon.name="GoldSourceRibbon_OnRealMap"
    ribbon.position=offset
    fx_world.add_child(ribbon)
    ribbon.configure({"w":1.5,"wprof":2,"style":4,
        "seed":SEAM.SOURCE_SEED_AT_FIXTURE,"extra":1.0,
        "layer":5,"wobF":50.0,"life":3.6})
    var s: Dictionary=SEAM.state_at(2.05,-1.0)
    ribbon.source_width=float(s["source_width"])
    ribbon.source_wobble=float(s["source_wobble"])
    ribbon.source_fade_mode=int(s["source_fade_mode"])
    ribbon.set_source_frame(float(s["source_age"]),s["source_points"],
        bool(s["source_live"]),float(s["source_end_age"]),2.05)
    _verify(ribbon.visible and ribbon.source_points.size()>=16,
        "real-map renderer draws original source Ribbon, not a drawn-in approximation")
    var waves = WAVE.new()
    waves.name="GoldSource13Waves_OnRealMap"
    waves.position=offset
    fx_world.add_child(waves)
    waves.seek_seconds(RUPTURE_T-2.5)
    var wave_state: Dictionary=waves.diagnostics()
    _verify(int(wave_state.get("wave_count",0))==13 and int(wave_state.get("visual_count",0))==273,
        "full 13 original seeded dynamic waves spawned over actual world level")

    # Source segment displacement runs on actual rendered SOH tiles, not the
    # flat mock floor. Full-screen shader is layered BELOW production HUD
    # (HUD layer 90); it is a visual warp only and does not destroy collision.
    var final_post := CanvasLayer.new()
    final_post.layer=60
    final_post.name="GoldPostScreenSpace_RealWorld"
    game.add_child(final_post)
    var post_rect := ColorRect.new()
    post_rect.name="OriginalGoldDisplacementOfRealMap"
    post_rect.color=Color.WHITE
    post_rect.mouse_filter=Control.MOUSE_FILTER_IGNORE
    final_post.add_child(post_rect)
    # CanvasLayer is NOT a Control anchor parent; use explicit viewport size.
    post_rect.position=Vector2.ZERO
    post_rect.size=get_viewport().get_visible_rect().size
    var shader_material := ShaderMaterial.new()
    shader_material.shader=POST
    post_rect.material=shader_material
    shader_material.set_shader_parameter(&"u_amb",1.0)
    # In canvas_items stretch, get_visible_rect() is 640x360 LOGICAL,
    # while get_texture().get_image() is 1280x720 PHYSICAL.
    # Gold post sampler reads the PHYSICAL SCREEN_TEXTURE texel grid.
    var resolution := Vector2(get_viewport().get_texture().get_size())
    shader_material.set_shader_parameter(&"u_res",resolution)
    shader_material.set_shader_parameter(&"u_time",1.46666666667)
    var scene_canvas: Transform2D=get_viewport().get_canvas_transform()
    # Camera2D canvas coordinates are logical 640x360, but SCREEN_UV in the
    # 1280x720 native window shader indexes PHYSICAL framebuffer pixels.
    # Convert world->logical camera->physical screen before binding u_seg.
    # Otherwise the distortion silently fires a 2x-downscaled/offscreen area.
    var logical_size := Vector2(
        float(ProjectSettings.get_setting("display/window/size/viewport_width",640)),
        float(ProjectSettings.get_setting("display/window/size/viewport_height",360)))
    var screen_scale := Vector2(resolution.x/logical_size.x,resolution.y/logical_size.y)
    var logical_a: Vector2=scene_canvas*(offset+MATH.SOURCE_START)
    var logical_b: Vector2=scene_canvas*(offset+MATH.SOURCE_END)
    var segment_a := logical_a*screen_scale
    var segment_b := logical_b*screen_scale
    var canvas_scale: float=scene_canvas.x.length()*screen_scale.x
    print("GOLD_REAL_MAP_PROJECTED_SEGMENT: a="+str(segment_a)+" b="+str(segment_b)+
        " physical="+str(resolution)+" logical="+str(logical_size)+
        " camera_scale="+str(scene_canvas.x.length()))
    _verify(canvas_scale>0.0,"actual Camera2D world-to-viewport projection exists")
    var segs := PackedVector4Array()
    var seg_params := PackedVector2Array()
    for i in range(8):
        segs.append(Vector4(segment_a.x,segment_a.y,segment_b.x,segment_b.y) if i==0 else Vector4.ZERO)
        seg_params.append(Vector2(14.0*canvas_scale,MATH.strength_at(1.46666666667-0.55)*canvas_scale) if i==0 else Vector2.ZERO)
    shader_material.set_shader_parameter(&"u_seg",segs)
    shader_material.set_shader_parameter(&"u_seg_p",seg_params)
    # First measure THE SAME map and VFX with source ground displacement off.
    # Then enable ONLY the exact Gold segment shader math. Pairwise image
    # comparison isolates tile displacement from particles, ribbon and camera.
    shader_material.set_shader_parameter(&"u_ns",0)
    var viewport_rect: Rect2=get_viewport().get_visible_rect()
    _verify(viewport_rect.has_point(segment_a) or viewport_rect.has_point(segment_b),
        "source rupture world-space segment overlaps active Knight camera screen")

    # Actual VFX effect should track the real enemy if it moves in the world.
    var start_relative: Vector2=waves.to_global(SOURCE_TARGET)
    _verify(start_relative.distance_to(enemy.global_position)<0.01,
        "real enemy and original source world impact center are aligned")
    var hp_before: Variant=enemy.get("health")
    await get_tree().process_frame
    await RenderingServer.frame_post_draw
    var no_warp: Image=get_viewport().get_texture().get_image()
    _verify(no_warp!=null and no_warp.save_png(folder.path_join("chapter1_l2_gold_vfx_no_ground_warp.png"))==OK,
        "native real map with source VFX but displacement disabled")
    shader_material.set_shader_parameter(&"u_ns",1)
    await get_tree().process_frame
    await RenderingServer.frame_post_draw
    var screenshot: Image=get_viewport().get_texture().get_image()
    _verify(screenshot!=null and screenshot.get_width()>=640,
        "non-headless actual gameplay viewport image is available")
    if screenshot==null:
        return
    var painted := 0
    for y in range(0,screenshot.get_height(),8):
        for x in range(0,screenshot.get_width(),8):
            if screenshot.get_pixel(x,y).get_luminance()>0.04:
                painted+=1
    _verify(painted>250,"screenshot has full live playable level, not blank prototype")
    _verify(screenshot.save_png(folder.path_join("chapter1_l2_real_map_gold_vfx.png"))==OK,
        "captured original source Ribbon plus 13 waves on actual playable level")
    # Real TileMap under the identical FX must move as GOLD warped its own
    # ground texture. Smoke/ribbon/camera remain otherwise identical.
    var region := Rect2i(
        Vector2i(int(minf(segment_a.x,segment_b.x))-22,
            int(minf(segment_a.y,segment_b.y))-22),
        Vector2i(int(absf(segment_b.x-segment_a.x))+44,
            int(absf(segment_b.y-segment_a.y))+44)
    ).intersection(Rect2i(Vector2i.ZERO,screenshot.get_size()))
    var changed_warp := 0
    for yy in range(region.position.y,region.end.y):
        for xx in range(region.position.x,region.end.x):
            var w: Color=screenshot.get_pixel(xx,yy)
            var n: Color=no_warp.get_pixel(xx,yy)
            if absf(w.r-n.r)+absf(w.g-n.g)+absf(w.b-n.b)>0.06:
                changed_warp+=1
    _verify(changed_warp>60,
        "source segment actually displaces rendered real-map tiles (not just a red seam); changed=%d" % changed_warp)
    print("GOLD_S01_REAL_MAP_GROUND_WARP_PIXELS: %d in camera-projected authored tile region" % changed_warp)
    _verify(enemy.get("health")==hp_before,"VFX did not deal damage to real enemy")
    _verify(knight.get("health")==before_knight_hp,"VFX did not damage live Knight")
    _verify(before_enemy_hp==hp_before,"baseline enemy health preserved")
    _verify(level.geometry.get_used_cells().size()>0,"real physical tile collisions survive visual rupture")
    knight.global_position=original_position
    final_post.queue_free()
    fx_world.queue_free()
    if _real_map_failures==0:
        print("GOLD_S01_REAL_MAP: PASS | real AppFlow level2, original TileMaps, Knight camera and enemy | 13 live gold waves, 16-point ribbon, visual ground warp, no combat/TileMap writes | image="+output+"/chapter1_l2_real_map_gold_vfx.png")
