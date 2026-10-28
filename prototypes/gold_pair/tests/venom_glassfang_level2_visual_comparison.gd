extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## VISUAL REVIEW CONTRACT: Original Gold FULL cast source on LEFT (published
## separately from original TS World.draw), actual SOH Level 2 on RIGHT.
## This test captures genuine Level2/production Knight/enemy/TileMaps with
## source-ported procedural Fang + acid pools at synchronized Gold frames.
## IMPORTANT: this is an INCOMPLETE source cast overlay: vial/splash/rings,
## shards, bubbles, reactions, final shader, and source enemy actor are missing.
## NEVER label the right frame "Gold 1:1" or a finished playable skill.
## Production map is checked out by CI at pinned immutable SHA, copies only
## prototypes/gold_pair/ in a disposable GitHub runner. No gameplay changes.
const MOTION=preload("res://prototypes/gold_pair/venom_glassfang_motion.gd")
const FANG_CANVAS=preload("res://prototypes/gold_pair/venom_source_fang_canvas.gd")
const POOL_CANVAS=preload("res://prototypes/gold_pair/venom_source_pool_canvas.gd")
const ENV_CANVAS=preload("res://prototypes/gold_pair/venom_glassfang_environment_canvas.gd")
const REVIEW_LEDGER=preload("res://prototypes/gold_pair/venom_glassfang_environment_review_ledger.gd")
const READABILITY=preload("res://prototypes/gold_pair/venom_combat_readability.gd")
const TICKS=[6,15,31,63,96,147,177,220,330]
const DENSITY=2
const SOURCE_PLAYER=Vector2(260.0,160.0)
const SOURCE_ENEMY=Vector2(375.0,190.0)
# Exact Pool constructor events extracted by executing unmodified original
# Venomwright source s1.ts Glassfang using World.step(1/60). No bitmaps.
# [birth frame, x, y, radius, lifetime, numBlobs, actual original seed]
const SOURCE_POOLS=[
    [8,327.94938703,176.60166725,4.0,0.9,2,507],
    [14,367.44889911,190.40112997,4.0,0.9,2,519],
    [37,388.70349280,209.40103734,4.0,0.9,2,399],
    [47,384.22203148,199.20488701,4.0,0.9,2,794],
    [70,371.00893612,163.50441808,4.0,0.9,2,35],
    [80,369.24049183,173.88068648,4.0,0.9,2,142],
    [103,360.01497282,204.06019178,4.0,0.9,2,382],
    [113,370.07181084,199.36374061,4.0,0.9,2,945],
    [136,379.38319706,170.62891264,4.0,0.9,2,847],
    [146,377.18707200,179.67915160,4.0,0.9,2,103],
    [146,360.34144458,188.48125678,6.5,4.2,3,553],
    [146,350.89385845,190.08554781,6.5,4.2,3,544],
    [146,361.05244189,195.98530640,6.5,4.2,3,980]
]
var _found_painted:int=0
var _evidence:int=0
var _map_visible:int=0
var _masked:int=0
var _source_pool_total:int=0
var _new_environment_seen:int=0
var _contrast_images:int=0
var _contrast_roi_samples:Array=[]

func _capture_campaign_state(game:Node2D)->void:
    await super._capture_campaign_state(game)
    var level:=game.get_node_or_null("Level") as DungeonLevel
    var entities:=game.get_node_or_null("Level/Entities") as Node2D
    var knight:=entities.get_node_or_null("Knight") as CharacterBody2D if entities!=null else null
    _expect(level!=null and knight!=null,"GLASSFANG_COMPARE: genuine level and Knight required")
    if level==null or knight==null:return
    var enemy:Node2D=null
    for child in entities.get_children():
        if child is Node2D and child.is_in_group("enemies"):
            if enemy==null or child.global_position.distance_squared_to(knight.global_position)<enemy.global_position.distance_squared_to(knight.global_position):
                enemy=child as Node2D
    _expect(enemy!=null,"GLASSFANG_COMPARE: actual instantiated Level2 enemy required")
    if enemy==null:return
    var camera:=knight.get_node_or_null("Camera") as Camera2D
    _expect(camera!=null and camera.is_current(),"GLASSFANG_COMPARE: real camera required")
    if camera==null:return

    # Only disposable test actors are repositioned for source-to-real alignment.
    # The authored map geometry, collision and all production scripts remain intact.
    knight.set_physics_process(false)
    enemy.set_physics_process(false)
    enemy.set_process(false)
    var real_enemy_anchor:Vector2=enemy.global_position
    var offset:Vector2=real_enemy_anchor-SOURCE_ENEMY
    knight.global_position=offset+SOURCE_PLAYER
    knight.velocity=Vector2.ZERO
    camera.reset_smoothing()
    camera.force_update_scroll()
    var knight_hp=knight.get("health")
    var enemy_hp=enemy.get("health")
    var floor_before:int=level.backdrop.get_used_cells().size()
    var walls_before:int=level.geometry.get_used_cells().size()
    _expect(floor_before>100 and walls_before>0,"GLASSFANG_COMPARE: authored floor/wall loaded")

    var stage:=Node2D.new()
    stage.name="GLASSFANG_SOURCE_PARTIAL_OVERLAY_NOT_A_FINISHED_SKILL"
    stage.position=offset
    stage.z_index=30
    game.add_child(stage)
    var fang_renderer=FANG_CANVAS.new()
    fang_renderer.name="OriginalSourceLiveFangNativeUltra"
    fang_renderer.set_source_density(DENSITY)
    stage.add_child(fang_renderer)
    var to_logical:=Transform2D(Vector2(0.5,0.0),Vector2(0.0,0.5),Vector2.ZERO)
    fang_renderer.set_source_to_map_transform(to_logical)
    fang_renderer.release_source_actor()
    var env_renderer=ENV_CANVAS.new()
    env_renderer.name="ProceduralOriginalGoldSplashesFlashRingsAndEmbeddedGroundResidue"
    env_renderer.set_source_density(DENSITY)
    stage.add_child(env_renderer)
    env_renderer.set_source_to_map_transform(to_logical)
    env_renderer.release_source_environment()

    var motion=MOTION.new()
    motion.begin(SOURCE_PLAYER.x,SOURCE_PLAYER.y,atan2(30.0,115.0),17,1765485952)
    var source_enemy={"id":17,"x":375.0,"y":190.0,"r":9.5,"dying":0.0,"hp":900,"exists":true}
    var out_dir:=ProjectSettings.globalize_path("res://.artifacts/venom_level2_compare")
    _expect(DirAccess.make_dir_recursive_absolute(out_dir)==OK,"GLASSFANG_COMPARE: output directory")
    await get_tree().process_frame
    await RenderingServer.frame_post_draw
    var baseline:=get_viewport().get_texture().get_image()
    _expect(baseline.save_png(out_dir.path_join("level2_aligned_baseline.png"))==OK,
        "GLASSFANG_COMPARE: real aligned Level2 baseline saved")
    # OPTIONAL contrast must affect only existing authored Level2 terrain;
    # original Gold procedural FX buffers and Knight/enemy are never tinted.
    var contrast=READABILITY.new()
    contrast.bind_level(level)
    var previous_bites:int=0
    var sampled:Array=[]
    for frame in range(1,331):
        source_enemy["x"]=375.0+8.0*sin(float(frame)*0.070)
        source_enemy["y"]=190.0+5.0*cos(float(frame)*0.055)
        # The real enemy is actually visible in Godot at the matching Gold
        # fixture coordinates, not a screenshot cutout or dummy sprite.
        enemy.global_position=offset+Vector2(float(source_enemy["x"]),float(source_enemy["y"]))
        motion.step_60hz([source_enemy])
        # Gold source HP tracked independently; no VFX damage to SOH enemies.
        for j in range(previous_bites,motion.bite_cues.size()):
            source_enemy["hp"]=int(source_enemy["hp"])-int(motion.bite_cues[j]["amount"])
        previous_bites=motion.bite_cues.size()
        if not TICKS.has(frame):continue

        var rendered_fang:bool=motion.fang!=null
        if rendered_fang:
            var result:Dictionary=fang_renderer.render_live_actor_frame(motion.fang,float(frame)/60.0)
            _expect(result.size()==3,"GLASSFANG_COMPARE: native live Fang 3 source passes")
        else:
            fang_renderer.release_source_actor()
        # The source event fixture contains original World.fx state at the
        # exact matched Gold tick; the renderer itself is procedural GDScript.
        # Never turn source FX events into baked texture frames.
        var environmental_events:Array=REVIEW_LEDGER.snapshot(frame)
        env_renderer.render_source_events(environmental_events)
        _new_environment_seen+=environmental_events.size()
        if frame==15:_expect(environmental_events.size()==6,
            "GLASSFANG_COMPARE: original first bite splash/ring/flash FX ledger")
        if frame==147:_expect(environmental_events.size()==27,
            "GLASSFANG_COMPARE: original finisher flash/rings+residue ledger")
        if frame==177:_expect(environmental_events.size()==22,
            "GLASSFANG_COMPARE: original persistent embeds and splash aftermath")
        var present_pool_nodes:Array[Node]=[]
        var pools_this_frame:int=0
        var source_masked:int=0
        for pool_def in SOURCE_POOLS:
            var born:int=int(pool_def[0])
            var age:float=float(frame-born+1)/60.0
            if frame<born or age>float(pool_def[4]):continue
            var pool=POOL_CANVAS.new()
            pool.name="OriginalSourceAcidPool_%d_%d" % [born,pools_this_frame]
            pool.set_source_density(DENSITY)
            stage.add_child(pool)
            pool.set_source_to_map_transform(to_logical)
            pool.begin_source_pool(float(pool_def[1]),float(pool_def[2]),
                float(pool_def[3]),float(pool_def[4]),int(pool_def[5]),
                0.1 if float(pool_def[4])<1.0 else 0.3,int(pool_def[6]))
            var two_pass:Dictionary=pool.seek_source_time(age,float(frame)/60.0)
            _expect(two_pass.size()==2,"GLASSFANG_COMPARE: native Gold Pool ground and glow")
            # A source puddle can remain in a wall/void in Gold's flat original
            # stage. In SOH, alpha is masked against ACTUAL authored floor and
            # collision, not recolored or painted over a fake map.
            source_masked+=_mask_pool_to_actual_floor(pool,stage,level,pool_def)
            pools_this_frame+=1
            present_pool_nodes.append(pool)
        _source_pool_total+=pools_this_frame
        # The scene is real AppFlow Level2 with actual camera and actors.
        await get_tree().process_frame
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var shot:Image=get_viewport().get_texture().get_image()
        _expect(shot!=null and shot.get_size()==Vector2i(1280,720),
            "GLASSFANG_COMPARE: real native map image 1280x720")
        if shot!=null:
            var name: String="level2_glassfang_partial_gold_tick_%03d.png" % frame
            _expect(shot.save_png(out_dir.path_join(name))==OK,
                "GLASSFANG_COMPARE: saved actual on-map checkpoint "+name)
            _evidence+=1
            _map_visible+=_count_lit(shot)
            if frame in [15,147,177]:
                # First capture: exact same source tick with optional assist OFF.
                # Next: luminance-based adaptive attenuation on original map
                # layers only, skill state/RNG/tick unchanged between images.
                var canvas_pos:Vector2=enemy.get_global_transform_with_canvas().origin
                var screen_center:Vector2i=Vector2i(roundi(canvas_pos.x),roundi(canvas_pos.y))
                var roi:=Rect2i(screen_center-Vector2i(180,125),Vector2i(360,250))
                # Baseline has no source Gold FX. Never sample glow/flash
                # from shot: doing so would make Gold itself trigger dimming.
                var measured:float=contrast.sample_roi(baseline,roi,5)
                var auto_strength:float=contrast.request_for_luminance(measured,true)
                contrast.set_strength(auto_strength)
                await get_tree().process_frame
                await get_tree().process_frame
                await RenderingServer.frame_post_draw
                var adjusted:Image=get_viewport().get_texture().get_image()
                var outname:String="level2_glassfang_auto_contrast_gold_tick_%03d.png" % frame
                _expect(adjusted.save_png(out_dir.path_join(outname))==OK,
                    "GLASSFANG_COMPARE: adaptive actual Level2 image saved")
                _contrast_images+=1
                var layer_changed:int=_diff_pixels(shot,adjusted)
                if auto_strength>0.015:
                    _expect(layer_changed>40,
                        "GLASSFANG_COMPARE: smart dim must change actual map pixels")
                _contrast_roi_samples.append({"source_tick":frame,
                    "viewport_roi":[roi.position.x,roi.position.y,roi.size.x,roi.size.y],
                    "measured_linear_luminance":measured,
                    "adaptive_strength":auto_strength,
                    "actual_changed_sampled_pixels":layer_changed,
                    "source_gold_actor_and_environment_buffers_modified":false})
                contrast.restore()
                await get_tree().process_frame
                await get_tree().process_frame
                await RenderingServer.frame_post_draw
            if frame in [31,63,96,147]:
                var changed:=_diff_pixels(baseline,shot)
                _found_painted=maxi(_found_painted,changed)
        _masked+=source_masked
        sampled.append({"tick":frame,"source_enemy_hp":source_enemy["hp"],
            "fang_present":rendered_fang,"active_pools":pools_this_frame,
            "source_authored_other_environment_events":environmental_events.size(),
            "masked_non_floor_px":source_masked})
        for pool in present_pool_nodes:
            pool.queue_free()
        await get_tree().process_frame

    _expect(_evidence==TICKS.size(),"GLASSFANG_COMPARE: all nine Gold timestamps")
    _expect(_contrast_images==3,"GLASSFANG_COMPARE: all three source-matched auto-contrast captures")
    _expect(contrast.strength==0.0,
        "GLASSFANG_COMPARE: map visual palette not restored after contrast captures")
    _expect(_found_painted>100,"GLASSFANG_COMPARE: original active FX changes actual level screenshot")
    _expect(_map_visible>2000,"GLASSFANG_COMPARE: game floor is visible, not transparent staging")
    _expect(motion.bite_cues.size()==5,"GLASSFANG_COMPARE: source five bite cues survived")
    _expect(_new_environment_seen>=55,"GLASSFANG_COMPARE: source-authored splash/ring/flash/embed visuals actually staged")
    _expect(_source_pool_total>=10,"GLASSFANG_COMPARE: source simultaneous pool afterlife staged")
    _expect(knight.get("health")==knight_hp and enemy.get("health")==enemy_hp,
        "GLASSFANG_COMPARE: no double damage or real game health change")
    _expect(floor_before==level.backdrop.get_used_cells().size()
        and walls_before==level.geometry.get_used_cells().size(),
        "GLASSFANG_COMPARE: no authored tile mutation")
    _expect(stage.is_inside_tree() and camera.is_current(),
        "GLASSFANG_COMPARE: actual Level2 Camera2D used")
    var level_render_tree:Array=[]
    for child in level.get_children():
        if child is CanvasItem:
            var item:CanvasItem=child
            level_render_tree.append({"name":child.name,"type":child.get_class(),
                "visible":item.visible,"z_index":item.z_index,
                "modulate":[item.modulate.r,item.modulate.g,item.modulate.b]})
        else:
            level_render_tree.append({"name":child.name,"type":child.get_class()})
    var game_render_tree:Array=[]
    for child in game.get_children():
        game_render_tree.append({"name":child.name,"type":child.get_class()})
    var evidence:Dictionary={
        "status":"PARTIAL SOURCE COMPONENT REVIEW, NEVER A FULL SKILL APPROVAL",
        "level_render_tree":level_render_tree,
        "game_render_tree":game_render_tree,
        "original_gold":"unmodified Venomwright TS World.draw in original 600x340 world at native Ultra k2",
        "level2":"real pinned Chapter1 Level2 AppFlow/TileMaps/Knight/enemy/Camera2D",
        "implemented_here":"exact source Fang 60Hz; source acid Pools on floor; ORIGINAL Splash+Flash+Ring+Embed procedural renderer with 24 standalone original Ultra image hashes, source fixture frames 15/147/177",
        "not_implemented_here":"vial projectile, shards and drop particles, bubble sprites, corrode enemy, camera shock/flash, exact full-World simultaneous FX ordering and final GLSL post; environmental overlay at 3 source checkpoint fixtures is NOT full-skill runtime",
        "original_tick_list":TICKS,
        "image_files":_evidence,
        "maximum_changed_pixels_vs_baseline":_found_painted,
        "masked_pool_pixels":_masked,
        "source_pool_instances_at_samples":_source_pool_total,
        "original_other_fx_events_procedurally_rendered_at_three_snapshots":_new_environment_seen,
        "actual_enemy_entity":enemy.name,
        "actual_map_backdrop_cells":floor_before,
        "actual_map_wall_cells":walls_before,
        "source_checkpoints":sampled,
        "readability_review":{
            "mode":"OPTIONAL native map-only auto brightness; source Gold effects unchanged",
            "captures":_contrast_images,
            "src_tick_results":_contrast_roi_samples,
            "sensor":"real Godot Level2 baseline ROI mean linear luminance",
            "map_layers_only":["Backdrop","Geometry","Decor"],
            "source_gold_visual_pixels_changed":false,
            "hero_enemy_hud_pixels_tinted":false,
            "non_authoritative_hud_or_health_state_changes":false
        }
    }
    var file=FileAccess.open(out_dir.path_join("comparison_manifest.json"),FileAccess.WRITE)
    _expect(file!=null,"GLASSFANG_COMPARE: manifest writable")
    if file!=null:
        file.store_string(JSON.stringify(evidence,"\t"))
        file.close()
    print("GLASSFANG_LEVEL2_VISUAL_COMPARE: PASS PARTIAL STAGE | real Level2 screenshots=%d contrastPairs=%d sourcePools=%d environmentFX=%d masked=%d changed=%d" %
        [_evidence,_contrast_images,_source_pool_total,_new_environment_seen,_masked,_found_painted])

func _mask_pool_to_actual_floor(pool:Node2D,stage:Node2D,level:DungeonLevel,
        definition:Array)->int:
    var masked:int=0
    var x_center:float=float(definition[1])*float(DENSITY)
    var y_center:float=float(definition[2])*float(DENSITY)
    var rad:float=float(definition[3])*float(DENSITY)
    # Original Pool SDF may expand beyond the central radius.
    var x0:int=maxi(0,int(floor(x_center-rad*2.5-8.0)))
    var x1:int=mini(1200,int(ceil(x_center+rad*2.5+8.0)))
    var y0:int=maxi(0,int(floor(y_center-rad*2.5-8.0)))
    var y1:int=mini(680,int(ceil(y_center+rad*2.5+8.0)))
    for key in ["ground","light"]:
        var im:Image=pool.images[key]
        var changed:bool=false
        for py in range(y0,y1):
            for px in range(x0,x1):
                var col:Color=im.get_pixel(px,py)
                if col.a<=0.0:continue
                var world:Vector2=stage.global_position+Vector2(float(px),float(py))/float(DENSITY)
                var tile:=level.backdrop.local_to_map(level.backdrop.to_local(world))
                var geometry_tile:=level.geometry.local_to_map(level.geometry.to_local(world))
                if level.backdrop.get_cell_source_id(tile)<0 or level.geometry.get_cell_source_id(geometry_tile)>=0:
                    im.set_pixel(px,py,Color(0.0,0.0,0.0,0.0))
                    masked+=1
                    changed=true
        if changed:
            pool.textures[key].update(im)
    return masked

func _count_lit(img:Image)->int:
    var count:int=0
    for y in range(0,img.get_height(),16):
        for x in range(0,img.get_width(),16):
            if img.get_pixel(x,y).get_luminance()>0.035:count+=1
    return count

func _diff_pixels(a:Image,b:Image)->int:
    var n:int=0
    for y in range(0,b.get_height(),4):
        for x in range(0,b.get_width(),4):
            var p:Color=a.get_pixel(x,y)
            var q:Color=b.get_pixel(x,y)
            if absf(p.r-q.r)+absf(p.g-q.g)+absf(p.b-q.b)>0.18:n+=1
    return n
