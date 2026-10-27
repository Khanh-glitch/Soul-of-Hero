extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## VISUAL REVIEW ONLY — Source Gold Hairline Rupture #01 on genuine Chapter 1
## Level 2, production AppFlow, actual controllable Knight and real enemies.
## This user-facing Godot 4.7 scene stays open until the player closes it.
## No damage, no TileMap collision writes, no production feature enablement.
## STILL MISSING: original persistent ground-buffer writes on TileMap, full
## contact visuals, source actor reaction/animation, authoritative 7s RNG
## and hitstop. Explicitly show these limitations instead of claiming parity.
const GOLD_PLATES = preload("res://prototypes/gold_fidelity/gold_s01_world_pressure_sheets.gd")
const GOLD_RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")
const GOLD_SEAM = preload("res://prototypes/gold_fidelity/gold_s01_seam_timeline.gd")
const GOLD_WAVE = preload("res://prototypes/gold_fidelity/gold_s01_live_wave_layer.gd")
const GOLD_POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const GOLD_SEG = preload("res://prototypes/gold_fidelity/segment_math.gd")
const GOLD_PLATE_MATH = preload("res://prototypes/gold_fidelity/gold_hairline_plate_factory.gd")

var _game: Node2D
var _knight: CharacterBody2D
var _stage: Node2D
var _plates: GoldS01WorldPressureSheets
var _ribbon: GoldSourceRibbon
var _waves: GoldS01LiveWaveLayer
var _post: ShaderMaterial
var _post_rect: ColorRect
var _interface_label: Label
var _fx_elapsed := 0.0
var _casting := false
var _paused_fx := false
var _show_plates := true
var _show_waves := true
var _show_warp := true
var _cast_offset := Vector2.ZERO
var _gold_anchor := Vector2(86.0,150.0)
var _last_target: Node2D
var _is_smoke := false
var _frame_samples := 0

func _ready() -> void:
    _slot = 2
    _training = false
    _capture_point = "mid"
    _expected_size = Vector2i(1280,720)
    _is_smoke = OS.get_cmdline_user_args().has("--gold-playtest-smoke")
    _run.call_deferred()

func _run() -> void:
    if not _prepare_capture():
        push_error("Gold Playtest: could not provision isolated test save")
        return
    var game: Node2D = await _start_campaign_route()
    if game == null:
        push_error("Gold Playtest: AppFlow failed to open real Chapter 1 Level 2")
        return
    _game = game
    var level := game.get_node_or_null("Level") as DungeonLevel
    var root_entities := game.get_node_or_null("Level/Entities") as Node2D
    _knight = root_entities.get_node_or_null("Knight") as CharacterBody2D if root_entities != null else null
    if level == null or _knight == null or level.geometry.get_used_cells().is_empty():
        push_error("Gold Playtest: actual map, collision or Knight missing")
        return
    var camera := _knight.get_node_or_null("Camera") as Camera2D
    if camera == null:
        push_error("Gold Playtest: native player camera missing")
        return
    # The stage lives in the EXACT original camera/world; the real player can
    # still move and battle normally. Casting here is VFX-only.
    _stage = Node2D.new()
    _stage.name = "GoldS01_RuntimeReview_NotGameplaySkill"
    _game.add_child(_stage)
    _plates = GOLD_PLATES.new()
    _plates.name = "Original14PressureSheets"
    _stage.add_child(_plates)
    _ribbon = GOLD_RIBBON.new()
    _ribbon.name = "OriginalGoldSourceRibbon"
    _stage.add_child(_ribbon)
    _ribbon.configure({"w":1.5,"wprof":2,"style":4,
        "seed":GOLD_SEAM.SOURCE_SEED_AT_FIXTURE,
        "extra":1.0,"wobF":50.0,"life":3.6,"layer":5})
    _waves = GOLD_WAVE.new()
    _waves.name = "OriginalSource13Waves"
    _stage.add_child(_waves)
    var post_layer := CanvasLayer.new()
    post_layer.name = "GoldPostEffect_BelowProductionHUD"
    post_layer.layer = 60
    _game.add_child(post_layer)
    _post_rect = ColorRect.new()
    _post_rect.color = Color.WHITE
    _post_rect.name = "SourcePostOnActualLevel"
    _post_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _post_rect.position = Vector2.ZERO
    _post_rect.size = get_viewport().get_visible_rect().size
    post_layer.add_child(_post_rect)
    _post = ShaderMaterial.new()
    _post.shader = GOLD_POST
    _post_rect.material = _post
    _post.set_shader_parameter(&"u_res",get_viewport().get_visible_rect().size)
    _post.set_shader_parameter(&"u_amb",1.0)
    _waves.bind_post(_post)
    _make_controls()
    _reset_effect()
    _update_label()
    print("GOLD_S01_WEB_PLAYTEST_READY: real AppFlow Level2, user controls active")

    # CI smoke mode exits; manual F6 mode intentionally NEVER exits.
    if _is_smoke:
        await _smoke_capture()
        _finish()

func _make_controls() -> void:
    var hud := CanvasLayer.new()
    hud.name = "GoldVisualReviewControls"
    hud.layer = 120
    add_child(hud)
    var panel := PanelContainer.new()
    panel.position = Vector2(10,72)
    panel.custom_minimum_size = Vector2(385,0)
    hud.add_child(panel)
    var label := Label.new()
    label.name = "ReviewerHelp"
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    label.add_theme_font_size_override("font_size",13)
    panel.add_child(label)
    _interface_label = label

func _update_label() -> void:
    if _interface_label == null:
        return
    _interface_label.text = (
        "GOLD #01 / REAL LEVEL 2  [INCOMPLETE PROTOTYPE]\n" +
        "K = cast at Knight | T = stage at nearest real enemy\n" +
        "1 / 2 / 3 = Gold t1.467 / 2.05 / 2.84\n" +
        "Space = pause VFX | R = replay | G = ground warp ON/OFF\n" +
        "P = 14 pressure sheets ON/OFF | V = 13 waves ON/OFF\n" +
        "Knight still uses normal game controls; VFX deals NO damage.\n" +
        "MISSING: persistent terrain cracks / full enemy hits / source RNG.\n" +
        "t=%.3fs  %s | ground:%s plates:%s waves:%s | source frames: %d" %
        [_fx_elapsed, "PLAY" if _casting and not _paused_fx else "PAUSE",
        "ON" if _show_warp else "OFF","ON" if _show_plates else "OFF",
        "ON" if _show_waves else "OFF",_frame_samples]
    )

func _input(event: InputEvent) -> void:
    if not event is InputEventKey:
        return
    if not event.pressed or event.echo:
        return
    if _game == null:
        return
    match event.keycode:
        KEY_K:
            _start_cast(false)
        KEY_T:
            _start_cast(true)
        KEY_R:
            _replay_cast()
        KEY_SPACE:
            _paused_fx = not _paused_fx
        KEY_1:
            _seek_effect(1.466666667)
        KEY_2:
            _seek_effect(2.05)
        KEY_3:
            _seek_effect(2.84)
        KEY_G:
            _show_warp = not _show_warp
        KEY_P:
            _show_plates = not _show_plates
        KEY_V:
            _show_waves = not _show_waves
        _:
            return
    get_viewport().set_input_as_handled()
    _update_effect()
    _update_label()

func _nearest_enemy() -> Node2D:
    if _game == null or _knight == null:
        return null
    var container := _game.get_node_or_null("Level/Entities")
    if container == null:
        return null
    var best: Node2D
    var best_d := INF
    for child: Node in container.get_children():
        if child is Node2D and child.is_in_group(&"enemies"):
            var node := child as Node2D
            if not node.is_inside_tree():
                continue
            var d := node.global_position.distance_squared_to(_knight.global_position)
            if d < best_d:
                best = node
                best_d = d
    return best

func _start_cast(target_enemy: bool) -> void:
    # K: Gold's initial caster is at local (86,150), skill faces right.
    # T: enemy anchored at local (300,141) so the original Gold line crosses
    # a real target. The Knight is NOT teleported and cannot silently be
    # represented as the actual Gold hero pose when far from this anchor.
    _last_target = _nearest_enemy() if target_enemy else null
    _cast_offset = (_last_target.global_position-Vector2(300,141)
        if _last_target != null else _knight.global_position-_gold_anchor)
    _stage.position = _cast_offset
    _casting = true
    _paused_fx = false
    _fx_elapsed = 0.0
    _waves.reset()
    _update_effect()

func _replay_cast() -> void:
    if not _casting:
        _start_cast(false)
    else:
        _fx_elapsed = 0.0
        _paused_fx = false
        _waves.reset()
        _update_effect()

func _reset_effect() -> void:
    _casting = false
    _fx_elapsed = 0.0
    if _waves != null:
        _waves.reset()
    _update_effect()

func _seek_effect(t: float) -> void:
    if not _casting:
        _start_cast(false)
    _fx_elapsed = clampf(t,0.0,7.0)
    _paused_fx = true
    _update_effect()

func _process(delta: float) -> void:
    if not _casting or _paused_fx or _game == null:
        return
    _fx_elapsed = minf(7.0,_fx_elapsed+minf(delta,0.1))
    _update_effect()
    _frame_samples += 1
    if _fx_elapsed>=7.0:
        _paused_fx = true
    _update_label()

func _update_effect() -> void:
    if _post == null or _stage == null:
        return
    var t := _fx_elapsed
    _plates.seek_source_time(t)
    _plates.visible = _casting and _show_plates
    var state: Dictionary = GOLD_SEAM.state_at(t,-1.0)
    _ribbon.source_width = float(state["source_width"])
    _ribbon.source_wobble = float(state["source_wobble"])
    _ribbon.source_life = float(state["source_life"])
    _ribbon.source_fade_mode = int(state["source_fade_mode"])
    _ribbon.set_source_frame(float(state["source_age"]),
        state["source_points"],bool(state["source_live"]),
        float(state["source_end_age"]),t)
    _ribbon.visible = _ribbon.visible and _casting
    _waves.seek_seconds(maxf(0.0,t-2.5) if _casting and _show_waves else 0.0)
    _waves.visible = _casting and _show_waves
    var canvas := get_viewport().get_canvas_transform()
    var a: Vector2 = canvas*(_stage.global_position+GOLD_SEG.SOURCE_START)
    var b: Vector2 = canvas*(_stage.global_position+GOLD_SEG.SOURCE_END)
    var scale: float = canvas.x.length()
    var segments := PackedVector4Array()
    var widths := PackedVector2Array()
    var strength: float = GOLD_SEG.strength_at(t-GOLD_PLATE_MATH.CREATED_AT)
    for i in range(8):
        segments.append(Vector4(a.x,a.y,b.x,b.y) if i==0 else Vector4.ZERO)
        widths.append(Vector2(GOLD_SEG.WIDTH*scale,strength*scale) if i==0 else Vector2.ZERO)
    _post.set_shader_parameter(&"u_seg",segments)
    _post.set_shader_parameter(&"u_seg_p",widths)
    _post.set_shader_parameter(&"u_ns",1 if _casting and _show_warp and strength>0.0 else 0)
    _post.set_shader_parameter(&"u_time",t)
    _post.set_shader_parameter(&"u_res",get_viewport().get_visible_rect().size)

func _smoke_capture() -> void:
    if _game == null:
        _expect(false,"playtest could not start genuine game")
        return
    # Run three source-timed captures without keyboard injection, verifying
    # the *same scene* the user opens interactively.
    _start_cast(false)
    var out_dir := ProjectSettings.globalize_path("res://.artifacts/vfx_playtest")
    _expect(DirAccess.make_dir_recursive_absolute(out_dir)==OK,
        "real playable test evidence folder created")
    for t in [1.466666667,2.05,2.84]:
        _seek_effect(float(t))
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var frame: Image = get_viewport().get_texture().get_image()
        _expect(frame!=null and frame.get_width()==1280 and frame.get_height()==720,
            "playable scene emits 1280x720 native image")
        if frame != null:
            var name := "real_map_interactive_%04d.png" % int(roundf(float(t)*1000.0))
            _expect(frame.save_png(out_dir.path_join(name))==OK,
                "source-playable screenshot "+name)
    _expect(_plates.visible_source_plates()==0,
        "pressure sheets expire at late stage")
    _expect(int(_waves.diagnostics().get("wave_count",-1))==13,
        "live VFX source thirteen-wave emission works in playable scene")
    _expect(not _ribbon.visible,"source Ribbon expires by late phase")
    print("GOLD_S01_INTERACTIVE_PLAYTEST: PASS | real AppFlow Level2, 3 source-timed frames, user controls and source modules")
