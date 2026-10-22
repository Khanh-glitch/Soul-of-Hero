extends Node

const TEST_SAVE_PATH := "user://tests/gameplay_click_auto_pickup_test.json"
const GROUND_LOOT_SCENE: PackedScene = preload("res://game/loot/ground_loot.tscn")


class FakeInteractable extends Node2D:
	var available := true
	var interactions := 0


	func can_interact(_player: Node2D) -> bool:
		return available


	func interact(_player: Node2D) -> bool:
		interactions += 1
		return true


class FakeTarget extends CharacterBody2D:
	var health := 100
	var max_health := 100


	func take_damage(amount: int, _source := Vector2.ZERO) -> bool:
		health = maxi(0, health - amount)
		return true


var _checks := 0
var _failures: Array[String] = []


func start(_app_root: Node) -> void:
	_run.call_deferred()


func _run() -> void:
	get_tree().paused = false
	_remove_generations(TEST_SAVE_PATH)
	var save := get_tree().root.get_node_or_null("SaveService")
	_expect(save != null and bool(save.call(&"configure_storage", TEST_SAVE_PATH, true)), "hồ sơ test riêng được tải")
	var world := Node2D.new()
	get_tree().root.add_child(world)
	var knight := (load("res://game/characters/knight/knight.tscn") as PackedScene).instantiate() as KnightController
	world.add_child(knight)
	knight.global_position = Vector2.ZERO
	await get_tree().process_frame
	await _test_click_routing(knight, world)
	await _test_ground_loot_suction(knight, world, save)
	world.free()
	await get_tree().process_frame
	await get_tree().process_frame
	if _failures.is_empty():
		print("GAMEPLAY CLICK + AUTO PICKUP TEST PASSED — %d checks" % _checks)
		get_tree().quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("GAMEPLAY CLICK + AUTO PICKUP TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		get_tree().quit(1)


func _test_click_routing(knight: KnightController, world: Node2D) -> void:
	var press := _left_click(true)
	var release := _left_click(false)
	knight.call(&"_input", press)
	knight.call(&"_resolve_frame_pointer_clicks")
	_expect(not bool(knight.call(&"_gameplay_attack_just_pressed")), "click UI không lọt thành đòn đánh thường")
	knight.call(&"_input", release)
	knight.call(&"_input", press)
	knight.call(&"_unhandled_input", press)
	knight.call(&"_resolve_frame_pointer_clicks")
	_expect(bool(knight.call(&"_gameplay_attack_just_pressed")), "click nền gameplay trống vẫn là đòn đánh thường")
	_expect(knight.call(&"_frame_attack_pointer_aim") == null, "LMB không còn dùng tọa độ chuột làm hướng đánh")
	knight.call(&"_input", release)

	var target := _spawn_target(world, Vector2(84.0, 0.0), 80, 100)
	var lowest_health := _spawn_target(world, Vector2(160.0, 20.0), 20, 100)
	var lowest_ratio := _spawn_target(world, Vector2(240.0, 40.0), 30, 300)
	await get_tree().physics_frame
	await get_tree().physics_frame
	_expect(
		knight.call(&"_select_auto_attack_target", false) == target,
		"Knight auto-targets the nearest visible enemy without requiring RMB",
	)
	_expect(
		bool(knight.call(&"request_action", "attack")),
		"LMB/attack can start immediately from an automatic target",
	)
	knight.call(&"_handle_action", 2.0)
	_expect(
		bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "archer_hero", "reserve_souls": ["wizard_hero"]})),
		"targeting fixture activates Archer",
	)
	_expect(
		knight.call(&"_select_auto_attack_target", false) == lowest_health,
		"Archer auto-targets the visible enemy with the lowest current HP",
	)
	_expect(
		bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "wizard_hero", "reserve_souls": ["sword_hero"]})),
		"targeting fixture activates Wizard",
	)
	_expect(
		knight.call(&"_select_auto_attack_target", false) == lowest_ratio,
		"Wizard auto-targets the visible enemy with the lowest HP percentage",
	)
	var direct_targets := TargetingService.acquire_near_point(
		knight, knight.global_position, target.global_position, 4096.0, 30.0, 1,
	)
	_expect(direct_targets.size() == 1 and direct_targets[0] == target, "physics query sees the exact hostile under RMB")
	var target_screen_position := knight.get_canvas_transform() * target.global_position
	var target_press := _right_click(true, target_screen_position)
	knight.call(&"_input", target_press)
	knight.call(&"_unhandled_input", target_press)
	knight.call(&"_resolve_frame_pointer_clicks")
	_expect(bool(knight.call(&"_consume_frame_target_selection")), "RMB gameplay được dành riêng cho chọn mục tiêu")
	_expect(not bool(knight.call(&"_gameplay_skill_just_pressed")), "RMB chọn mục tiêu không còn kích hoạt kỹ năng")
	var captured_pointer: Variant = knight.call(&"_frame_attack_pointer_aim")
	_expect(
		captured_pointer is Vector2
			and (captured_pointer as Vector2).is_equal_approx(target.global_position),
		"đòn đánh lấy chính xác vị trí mục tiêu đã khóa bằng RMB (captured=%s target=%s locked=%s)" % [
			captured_pointer,
			target.global_position,
			"%s pending=%s" % [knight.get("_locked_attack_target"), knight.get("_frame_rmb_aim_world")],
		]
	)
	await get_tree().process_frame
	var target_indicator := knight.get("_locked_target_visual") as Node2D
	_expect(
		target_indicator != null
			and target_indicator.get_child_count() == 4
			and target_indicator.get_children().all(func(child: Node) -> bool: return child is Line2D),
		"target selection uses only one four-corner broken square under the enemy",
	)
	_expect(
		float(knight.call(&"_full_screen_projectile_distance", 150.0))
			> knight.get_viewport_rect().size.length(),
		"Knight Crescent Wave travel covers the complete visible screen",
	)
	_expect(
		bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "sword_hero", "reserve_souls": ["archer_hero"]})),
		"combo pursuit fixture restores Knight",
	)
	target.global_position = knight.global_position + Vector2(520.0, 0.0)
	knight.set("current_action", "sword_attack_3")
	knight.set("action_elapsed", 0.0)
	knight.set("_current_sword_attack_instance_id", 7001)
	knight.set("_sword_pursuit_target", null)
	knight.call(&"_on_sword_crescent_wave_target_hit", target, 10)
	_expect(
		knight.get("_sword_pursuit_target") == target
			and bool(knight.get("_sword_combo_buffered"))
			and float(knight.get("action_elapsed")) >= float(knight.call(&"_get_action_duration", "sword_attack_3")),
		"a confirmed hit-three wave queues Pursuit immediately without a recovery gap",
	)
	knight.call(&"_finish_action")
	_expect(knight.get("current_action") == "sword_attack_4", "confirmed wave hit advances directly into Knight hit four")
	_expect(
		float(knight.get("_current_sword_pursuit_dash_distance")) >= 520.0,
		"Knight hit four has enough full-screen travel to reach the enemy struck by the wave",
	)
	knight.set("_sword_combo_buffered", true)
	knight.set("_queued_weapon_attack", true)
	knight.call(&"_finish_action")
	_expect(knight.get("current_action") == "sword_attack_1", "Knight hit four loops into the next combo without cooldown")
	knight.call(&"_handle_action", 2.0)
	target.queue_free()
	lowest_health.queue_free()
	lowest_ratio.queue_free()
	var locked := FakeInteractable.new()
	locked.available = false
	locked.add_to_group(&"player_interactable")
	world.add_child(locked)
	locked.global_position = knight.global_position + Vector2(12.0, 0.0)
	knight.call(&"_input", press)
	knight.call(&"_unhandled_input", press)
	knight.call(&"_resolve_frame_pointer_clicks")
	_expect(bool(knight.call(&"_consume_frame_world_interaction")), "tương tác bị khóa vẫn tiêu thụ click gần")
	_expect(locked.interactions == 1 and not bool(knight.call(&"_gameplay_attack_just_pressed")), "click tương tác không nối thêm đòn đánh")
	knight.call(&"_input", release)
	locked.queue_free()


func _test_ground_loot_suction(knight: KnightController, world: Node2D, save: Node) -> void:
	var payload := {
		"loot_id": "auto_suction_stack_001",
		"kind": &"stackable",
		"family": &"material",
		"display_name": "Tinh Chất Thử Nghiệm",
		"icon_path": "res://assets/ui/loot/soul_ember.png",
		"item_id": &"auto_suction_ember",
		"inventory_kind": &"material",
		"quantity": 2,
		"rarity": &"rare",
		"item_level": 3,
		"source": &"enemy",
		"source_id": &"click_auto_test",
	}
	var loot := GROUND_LOOT_SCENE.instantiate() as GroundLoot
	world.add_child(loot)
	_expect(loot.configure(payload), "loot thử nghiệm hợp lệ")
	loot.launch_from(Vector2(92.0, -22.0), Vector2(92.0, 0.0), 0.12, 18.0)
	await get_tree().create_timer(0.18).timeout
	var distance_before := loot.global_position.distance_to(knight.global_position)
	await get_tree().create_timer(0.12).timeout
	_expect(is_instance_valid(loot) and loot.global_position.distance_to(knight.global_position) < distance_before, "GroundLoot hút rõ ràng về nhân vật trong bán kính chuẩn")
	await get_tree().create_timer(0.55).timeout
	var stack_path: Array[String] = ["inventory", "item_stacks", "auto_suction_ember", "quantity"]
	_expect(int(save.call(&"get_value", stack_path, 0)) == 2, "auto-pickup commit vật phẩm vào tủ đồ")
	_expect(not is_instance_valid(loot) or loot.is_queued_for_deletion(), "visual chỉ mất sau receipt thành công")
	var duplicate := GROUND_LOOT_SCENE.instantiate() as GroundLoot
	world.add_child(duplicate)
	_expect(duplicate.configure(payload), "visual trùng receipt vẫn là payload hợp lệ")
	duplicate.launch_from(Vector2(80.0, -18.0), Vector2(80.0, 0.0), 0.12, 16.0)
	await get_tree().create_timer(0.75).timeout
	_expect(int(save.call(&"get_value", stack_path, 0)) == 2, "receipt chặn trả vật phẩm lần hai")
	_expect(not is_instance_valid(duplicate) or duplicate.is_queued_for_deletion(), "visual trùng được thu hồi, không lặp hút vô hạn")


func _left_click(pressed: bool) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	event.position = Vector2(320.0, 180.0)
	return event


func _right_click(pressed: bool, position: Vector2) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_RIGHT
	event.pressed = pressed
	event.position = position
	return event


func _spawn_target(world: Node2D, position: Vector2, current_health: int, maximum_health: int) -> FakeTarget:
	var target := FakeTarget.new()
	target.add_to_group(&"enemies")
	target.collision_layer = 4
	target.collision_mask = 0
	target.global_position = position
	target.health = current_health
	target.max_health = maximum_health
	var collision := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 12.0
	collision.shape = shape
	target.add_child(collision)
	world.add_child(target)
	return target


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var absolute := ProjectSettings.globalize_path(path + suffix)
		if FileAccess.file_exists(absolute):
			DirAccess.remove_absolute(absolute)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
