## Experimental standalone wrapper: real AppRoot and real overworld, AVFX
## visual-only controls. This is not a combat integration or production mount.
extends Node

const APP_PATH := "res://game/app/app_root.tscn"
const ENEMY_PATH := "res://game/characters/enemies/skeleton_enemy.tscn"
var app: Node
var world: Node
var player: Node2D
var renderer: Arcana20Renderer
var mount: Arcana20WorldPassMount
var post: Arcana20CViewportPost
var selector: OptionButton
var abyssal_selector: OptionButton
var d19_selector: OptionButton
var target_selector: OptionButton
var spawn_selector: OptionButton
var status: Label
var panel: Control
var tint: CanvasModulate
var normal_tint := Color.WHITE
var dimmed := false
var mobile_enemies := false
var spawned: Array[Node2D] = []

func _ready() -> void:
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://avfx_playtest"))
    var save := get_node_or_null("/root/SaveService")
    if save == null or not bool(save.call(&"configure_storage", "user://avfx_playtest/save.json", true)):
        push_error("AVFX_PLAYTEST_FAIL isolated save unavailable")
        if _smoke(): get_tree().quit(1)
        return
    var app_scene := load(APP_PATH) as PackedScene
    if app_scene == null:
        push_error("AVFX_PLAYTEST_FAIL app scene unavailable")
        if _smoke(): get_tree().quit(1)
        return
    app = app_scene.instantiate()
    add_child(app)
    _make_ui()
    if _smoke(): _run_smoke.call_deferred()
    elif OS.get_cmdline_user_args().has("--avfx-live-capture"):
        var capture_path := "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_ab_capture.gd" if OS.get_environment("AVFX_AB_LOCK") == "1" else "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd"
        if OS.get_environment("AVFX_C15_MATRIX") == "1":
            capture_path = "res://prototypes/arcana_fusion20/renderer/playtest/arcana20_thorn_matrix_capture.gd"
        var script := load(capture_path) as Script
        if script == null:
            push_error("AVFX_LIVE_FAIL capture script missing")
            get_tree().quit(1)
            return
        var capture := script.new() as Node
        add_child(capture)
        capture.call_deferred(&"start", self)

func _smoke() -> bool:
    return OS.get_cmdline_user_args().has("--avfx-playtest-smoke")

func _make_ui() -> void:
    var layer := CanvasLayer.new()
    layer.layer = 40
    add_child(layer)
    panel = PanelContainer.new()
    panel.position = Vector2(8, 42)
    panel.custom_minimum_size = Vector2(230, 0)
    panel.visible = false
    layer.add_child(panel)
    var box := VBoxContainer.new()
    panel.add_child(box)
    var heading := Label.new()
    heading.text = "AVFX THỬ NGHIỆM • F4 ẨN/HIỆN"
    box.add_child(heading)
    selector = OptionButton.new()
    for number in range(1, 21):
        var slot := Arcana20SourceCatalog.slot(number)
        selector.add_item("%02d  %s" % [number, slot.name], number)
    box.add_child(selector)
    abyssal_selector = OptionButton.new()
    abyssal_selector.add_item("#05 A • Nguyên bản A + C", 0)
    abyssal_selector.add_item("#05 B • Dàn dựng sóng nước", 1)
    abyssal_selector.tooltip_text = "Chỉ ảnh hưởng #05. Đổi phiên bản sẽ hủy lần thi triển #05 hiện tại."
    abyssal_selector.item_selected.connect(_select_abyssal_variant)
    box.add_child(abyssal_selector)
    d19_selector = OptionButton.new()
    d19_selector.add_item("#19 A • D_SOURCE_FAITHFUL (LDR)", 0)
    d19_selector.add_item("#19 B • D_ART_DIRECTED_LDR (SOH mới)", 1)
    d19_selector.tooltip_text = "Chuyển ngay trong lần thi triển; B là cách trình bày mới, không phải HDR hoặc nguyên bản."
    d19_selector.item_selected.connect(_select_d19_variant)
    box.add_child(d19_selector)
    target_selector = OptionButton.new()
    target_selector.add_item("Mục tiêu: quái gần nhất", 0)
    target_selector.add_item("Mục tiêu: vị trí chuột", 1)
    box.add_child(target_selector)
    spawn_selector = OptionButton.new()
    spawn_selector.add_item("Thêm quái: theo hàng", 0)
    spawn_selector.add_item("Thêm quái: vòng quanh người chơi", 1)
    box.add_child(spawn_selector)
    _button(box, "Thi triển [F6]", _cast_selected)
    _button(box, "Thêm bộ xương [F7]", _spawn_enemy)
    _button(box, "Quái đứng yên / di chuyển [F8]", _toggle_enemies)
    _button(box, "Sáng / tối [F9]", _toggle_light)
    _button(box, "Hủy tất cả [F10]", _cancel_all)
    status = Label.new()
    status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    status.custom_minimum_size = Vector2(225, 0)
    status.text = "Mẫu VFX; chưa tích hợp va chạm/sát thương."
    box.add_child(status)

func _button(box: VBoxContainer, text: String, callback: Callable) -> void:
    var button := Button.new()
    button.text = text
    button.pressed.connect(callback)
    box.add_child(button)

func _process(_delta: float) -> void:
    if not is_instance_valid(app): return
    var route := StringName(app.call(&"get_current_route"))
    if route != &"overworld":
        if panel.visible: panel.visible = false
        world = null
        player = null
        renderer = null
        return
    var host := app.get_node_or_null("RouteHost")
    if host == null or host.get_child_count() == 0: return
    var candidate: Node = host.get_child(0)
    if not candidate.has_method(&"is_world_ready") or not bool(candidate.call(&"is_world_ready")): return
    if world != candidate or not is_instance_valid(renderer): _attach(candidate)

func _attach(candidate: Node) -> void:
    world = candidate
    player = world.get("player") as Node2D
    if player == null: return
    renderer = Arcana20Renderer.new()
    renderer.world_pass_mode = true
    renderer.abyssal_directed = abyssal_selector.selected == 1
    renderer.d19_collect_material_layers = true
    world.add_child(renderer)
    mount = Arcana20WorldPassMount.new()
    world.add_child(mount)
    if not mount.attach(renderer): push_error("AVFX_PLAYTEST_FAIL world mount")
    mount.set_d19_art_directed(d19_selector.selected == 1)
    post = Arcana20CViewportPost.new()
    world.add_child(post)
    if not post.attach(renderer): push_error("AVFX_PLAYTEST_FAIL viewport post")
    tint = world.get_node_or_null("WorldTint") as CanvasModulate
    if tint != null: normal_tint = tint.color
    dimmed = false
    spawned.clear()
    panel.visible = true
    status.text = "Mẫu VFX: F7 thêm quái. Hiệu ứng không gây sát thương."
    print("AVFX_PLAYTEST_ATTACHED ", world.scene_file_path)

func _unhandled_key_input(event: InputEvent) -> void:
    if not event is InputEventKey or not event.pressed or event.echo or not is_instance_valid(renderer): return
    match event.keycode:
        KEY_F4: panel.visible = not panel.visible
        KEY_F6: _cast_selected()
        KEY_F7: _spawn_enemy()
        KEY_F8: _toggle_enemies()
        KEY_F9: _toggle_light()
        KEY_F10: _cancel_all()
        _: return
    get_viewport().set_input_as_handled()

func _select_d19_variant(index: int) -> void:
    if is_instance_valid(mount): mount.set_d19_art_directed(index == 1)

func _select_abyssal_variant(index: int) -> void:
    if not is_instance_valid(renderer): return
    # Existing casts cannot retain a stale pass order after the choice changes.
    renderer.cancel_skill(Arcana20SourceCatalog.canonical_id(5))
    renderer.abyssal_directed = index == 1
    if is_instance_valid(status):
        status.text = "#05: " + ("B • sóng nước dàn dựng" if index == 1 else "A • nguồn nguyên bản") + " • thi triển lại để xem"

func _nearest_enemy() -> Node2D:
    var closest: Node2D
    var best := INF
    for node in get_tree().get_nodes_in_group(&"enemies"):
        if not node is Node2D or not is_instance_valid(node): continue
        var candidate := node as Node2D
        var health: Variant = candidate.get("health")
        if health != null and int(health) <= 0: continue
        var dist := player.global_position.distance_squared_to(candidate.global_position)
        if dist < best:
            best = dist
            closest = candidate
    return closest

func _cast_selected() -> void:
    if not is_instance_valid(renderer) or not is_instance_valid(player): return
    var target := player.get_global_mouse_position()
    if target_selector.selected == 0:
        var enemy := _nearest_enemy()
        if enemy == null:
            status.text = "Không có quái gần đây; F7 để thêm, hoặc chọn chuột."
            return
        target = enemy.global_position
    var id := Arcana20SourceCatalog.canonical_id(selector.get_selected_id())
    # Explicit real caster reference lets the #09 source canvas follow the
    # moving player; this remains a visual-only call, not a combat receipt.
    var ok := renderer.cast_skill(id, player.global_position, target, 1.0, player)
    status.text = ("Đã thi triển " if ok else "Không thể thi triển ") + String(id) + " • chỉ hình ảnh"

func _spawn_enemy() -> void:
    if not is_instance_valid(world) or not is_instance_valid(player): return
    var entities := world.get_node_or_null("Entities") as Node2D
    if entities == null:
        status.text = "Không tìm thấy lớp thực thể của bản đồ."
        return
    var enemy_scene := load(ENEMY_PATH) as PackedScene
    if enemy_scene == null:
        status.text = "Không tải được bộ xương thật."
        return
    var enemy := enemy_scene.instantiate() as Node2D
    var offset := Vector2(100 + spawned.size() * 20, 0)
    if spawn_selector.selected == 1:
        # Test-only formation of genuine scene instances; after spawning the
        # normal enemy AI/collisions remain in charge of every actor movement.
        var angle := TAU * float(spawned.size() % 7) / 7.0
        var radius := 110.0 + 24.0 * floorf(float(spawned.size()) / 7.0)
        offset = Vector2(cos(angle), sin(angle)) * radius
    enemy.position = entities.to_local(player.global_position + offset)
    entities.add_child(enemy)
    enemy.set_physics_process(mobile_enemies)
    spawned.append(enemy)
    status.text = "Đã thêm bộ xương thật; " + ("đang di chuyển." if mobile_enemies else "đứng yên.")

func _toggle_enemies() -> void:
    mobile_enemies = not mobile_enemies
    for enemy in spawned:
        if is_instance_valid(enemy): enemy.set_physics_process(mobile_enemies)
    status.text = "Quái: " + ("AI di chuyển (có thể tấn công người chơi)." if mobile_enemies else "đứng yên.")

func _toggle_light() -> void:
    if not is_instance_valid(tint): return
    dimmed = not dimmed
    tint.color = normal_tint * (Color(0.4, 0.4, 0.4, 1.0) if dimmed else Color.WHITE)
    status.text = "Ánh sáng thử nghiệm: " + ("tối." if dimmed else "bình thường.")

func _cancel_all() -> void:
    if is_instance_valid(renderer): renderer.cancel_all()
    status.text = "Đã hủy các hiệu ứng."

func _exit_tree() -> void:
    if is_instance_valid(renderer): renderer.cancel_all()
    if is_instance_valid(tint): tint.color = normal_tint

func _wait_route(route: StringName, timeout_ms: int) -> bool:
    var deadline := Time.get_ticks_msec() + timeout_ms
    while Time.get_ticks_msec() < deadline:
        if StringName(app.call(&"get_current_route")) == route: return true
        await get_tree().process_frame
    return false

func _click(point: Vector2) -> void:
    var motion := InputEventMouseMotion.new()
    motion.position = point
    Input.parse_input_event(motion)
    var press := InputEventMouseButton.new()
    press.position = point
    press.button_index = MOUSE_BUTTON_LEFT
    press.pressed = true
    Input.parse_input_event(press)
    await get_tree().physics_frame
    await get_tree().process_frame
    var release := InputEventMouseButton.new()
    release.position = point
    release.button_index = MOUSE_BUTTON_LEFT
    release.pressed = false
    Input.parse_input_event(release)
    await get_tree().physics_frame
    await get_tree().process_frame

func _smoke_fail(message: String) -> void:
    push_error("AVFX_PLAYTEST_FAIL " + message)
    get_tree().quit(1)

func _run_smoke() -> void:
    if not await _wait_route(&"title", 30000):
        _smoke_fail("title"); return
    var new_game := app.find_child("NewGameButton", true, false) as Button
    if new_game == null or not new_game.is_visible_in_tree() or new_game.disabled:
        _smoke_fail("new game"); return
    await _click(get_viewport().get_final_transform() * new_game.get_global_rect().get_center())
    if not await _wait_route(&"home", 30000):
        _smoke_fail("home"); return
    var host := app.get_node("RouteHost")
    var home := host.get_child(0)
    var destinations: Dictionary = home.get("_destinations")
    var gate := destinations.get(&"campaign") as Node2D
    if gate == null:
        _smoke_fail("home campaign"); return
    await _click(get_viewport().get_final_transform() * gate.get_global_transform_with_canvas().origin)
    var deadline := Time.get_ticks_msec() + 30000
    while Time.get_ticks_msec() < deadline and StringName(home.call(&"get_current_function")) != &"campaign":
        await get_tree().process_frame
    var enter := home.find_child("EnterOverworldButton", true, false) as Button
    if enter == null or not enter.is_visible_in_tree() or enter.disabled:
        _smoke_fail("enter overworld"); return
    await _click(get_viewport().get_final_transform() * enter.get_global_rect().get_center())
    if not await _wait_route(&"overworld", 30000):
        _smoke_fail("overworld route"); return
    deadline = Time.get_ticks_msec() + 90000
    while Time.get_ticks_msec() < deadline and not is_instance_valid(renderer):
        await get_tree().process_frame
    if not is_instance_valid(renderer) or not is_instance_valid(player) or not panel.visible:
        _smoke_fail("world ready and mount"); return
    # Exercise the actual player's normal movement input; try cardinal
    # directions because the spawned location may have real collision.
    var moved := false
    for action in [&"move_right", &"move_down", &"move_left", &"move_up"]:
        var start := player.global_position
        Input.action_press(action)
        for tick in range(30): await get_tree().physics_frame
        Input.action_release(action)
        await get_tree().physics_frame
        if player.global_position.distance_to(start) > 2.0:
            moved = true
            break
    if not moved:
        _smoke_fail("real player movement"); return
    _spawn_enemy()
    if spawned.is_empty():
        _smoke_fail("real enemy spawn"); return
    var enemy := spawned[0]
    var before := int(enemy.get("health"))
    for id in range(1, 21):
        selector.select(id - 1)
        _cast_selected()
        if not renderer.is_active(Arcana20SourceCatalog.canonical_id(id)):
            _smoke_fail("skill %d refused" % id); return
        renderer.cancel_skill(Arcana20SourceCatalog.canonical_id(id))
    selector.select(18)
    _cast_selected()
    var constellation_id := Arcana20SourceCatalog.canonical_id(19)
    var original_d := renderer._casts.get(constellation_id) as DSourcePlayer
    d19_selector.select(1)
    _select_d19_variant(1)
    if original_d == null or renderer._casts.get(constellation_id) != original_d or not mount.d19_art_directed:
        _smoke_fail("#19 B switched or restarted source"); return
    d19_selector.select(0)
    _select_d19_variant(0)
    if renderer._casts.get(constellation_id) != original_d or mount.d19_art_directed:
        _smoke_fail("#19 A not restored on same source"); return
    renderer.cancel_skill(constellation_id)
    selector.select(4)
    abyssal_selector.select(1)
    _select_abyssal_variant(1)
    _cast_selected()
    var bloom_id := Arcana20SourceCatalog.canonical_id(5)
    var b_cast := renderer._casts.get(bloom_id) as FusionPlayer
    if b_cast == null or b_cast.get_node_or_null("DirectedWaterPresentation") == null:
        _smoke_fail("#05 B presentation absent"); return
    abyssal_selector.select(0)
    _select_abyssal_variant(0)
    if renderer.is_active(bloom_id):
        _smoke_fail("#05 switch must cancel current cast"); return
    target_selector.select(1) # actual global mouse target, not a fake actor
    _cast_selected()
    var a_cast := renderer._casts.get(bloom_id) as FusionPlayer
    if a_cast == null or a_cast.get_node_or_null("DirectedWaterPresentation") != null:
        _smoke_fail("#05 A reference missing or contaminated"); return
    renderer.cancel_skill(bloom_id)
    target_selector.select(0)
    selector.select(9)
    _cast_selected()
    selector.select(16)
    _cast_selected()
    if not renderer.is_active(Arcana20SourceCatalog.canonical_id(10)) or not renderer.is_active(Arcana20SourceCatalog.canonical_id(17)):
        _smoke_fail("overlap"); return
    await get_tree().process_frame
    _cancel_all()
    if int(enemy.get("health")) != before:
        _smoke_fail("visual-only cast changed enemy HP"); return
    _toggle_light()
    _toggle_light()
    print("AVFX_PLAYTEST_SMOKE PASS normal route, real actor, 20 start/cancel, overlap, tint, visual-only HP")
    get_tree().quit(0)
