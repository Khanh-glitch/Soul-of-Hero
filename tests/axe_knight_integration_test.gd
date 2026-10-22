extends Node

const AXE: WeaponDefinition = preload("res://game/weapons/data/axe.tres")
const SWORD: WeaponDefinition = preload("res://game/weapons/data/sword.tres")

var _checks := 0
var _failures: Array[String] = []


func start(_game: Node2D) -> void:
	_run.call_deferred()


func _run() -> void:
	await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	_expect(knight != null, "runtime Knight is available for Axe integration")
	if knight == null:
		_finish()
		return
	var manager := knight.get_weapon_manager()
	var body_shape := knight.get_node("BodyShape") as CollisionShape2D
	var stable_shape := body_shape.shape
	var stable_shape_position := body_shape.position
	var stable_collision_layer := knight.collision_layer
	var stable_collision_mask := knight.collision_mask
	var stable_position := knight.global_position
	var stable_flip := (knight.get_node("Sprite") as AnimatedSprite2D).flip_h
	_expect(manager.configure_loadout(SWORD, [AXE], false), "Knight accepts Axe as a Spirit weapon before the form swap")
	_expect(knight.get_active_character_form_id() == &"free_knight", "Sword Hand begins in the FreeKnight character form")
	_expect(manager.request_swap(0), "Axe Spirit requests a full Hand character-form swap")
	await _physics_frames(18)
	_expect(manager.get_hand_weapon() == AXE, "Axe becomes the Hand weapon after the 0.25-second transition")
	_expect(knight.get_active_character_form_id() == &"axe_warrior_rpg", "completed Axe swap replaces the entire character raster library")
	var sprite := knight.get_node("Sprite") as AnimatedSprite2D
	_expect(sprite != null and sprite.sprite_frames.get_frame_count(&"idle") == 10 and sprite.scale == Vector2(0.75, 0.75), "AxeWarriorRPG exposes its ten-frame Idle with the top-down readability scale")
	_expect(knight.is_hand_weapon_baked_into_character() and not knight.get_node("HandWeaponVisual").visible, "baked Axe form hides the duplicate procedural Hand weapon")
	_expect(body_shape.shape == stable_shape and body_shape.position == stable_shape_position, "character-form swap preserves the player collider")
	_expect(knight.collision_layer == stable_collision_layer and knight.collision_mask == stable_collision_mask, "character-form swap preserves collision routing")
	_expect(knight.global_position.distance_to(stable_position) < 0.1 and sprite.flip_h == stable_flip, "character-form swap preserves world position and facing")
	var realtime_form: Dictionary = knight.get_realtime_state().get("character_form", {})
	_expect(realtime_form.get("id", "") == "axe_warrior_rpg" and bool(realtime_form.get("baked_hand_weapon", false)), "realtime state publishes the active Axe character form")
	var original_collision_mask := knight.collision_mask
	knight.collision_mask = 0
	var attack_instances: Array[Dictionary] = []
	var attack_starts: Array[Dictionary] = []
	var skill_starts: Array[Dictionary] = []
	var skill_resolutions: Array[Dictionary] = []
	manager.hand_attack_started.connect(func(_weapon: WeaponDefinition, context: Dictionary) -> void: attack_starts.append(context.duplicate(true)))
	manager.hand_attack_instance_created.connect(func(_weapon: WeaponDefinition, context: Dictionary) -> void: attack_instances.append(context.duplicate(true)))
	manager.hand_skill_started.connect(func(_weapon: WeaponDefinition, context: Dictionary) -> void: skill_starts.append(context.duplicate(true)))
	manager.hand_skill_resolved.connect(func(_weapon: WeaponDefinition, context: Dictionary) -> void: skill_resolutions.append(context.duplicate(true)))

	_expect(knight.request_action("attack"), "scripted request_action creates a deterministic quick cleave")
	_expect(knight.current_action == "axe_cleave" and attack_starts.size() == 1 and attack_instances.size() == 1, "quick cleave creates exactly one confirmed attack instance")
	_expect(is_equal_approx(float(attack_instances[0].charge_ratio), 0.0) and int(attack_instances[0].damage) == 30, "quick cleave emits its data-driven zero-charge payload")
	await _physics_frames(30)

	Input.action_press(&"move_right")
	Input.action_press(&"attack")
	await _physics_frames(4)
	_expect(knight.current_action == "axe_charge" and attack_instances.size() == 1, "physical Attack press starts charge without creating an attack instance")
	_expect(sprite.animation == &"attack" and sprite.frame == 0 and not sprite.is_playing() and sprite.scale == Vector2(0.75, 0.75), "Axe charge holds the upright authored wind-up at the stable form scale instead of collapsing into the low spin frame")
	_expect(knight.velocity.x > 0.0 and knight.velocity.length() <= knight.move_speed * AXE.normal_attack.movement_speed_multiplier + 0.1, "Knight can move at the configured slow speed while charging")
	await _physics_frames(12)
	Input.action_release(&"attack")
	Input.action_release(&"move_right")
	knight.collision_mask = original_collision_mask
	await _physics_frames(2)
	_expect(knight.current_action == "axe_cleave" and attack_instances.size() == 2, "physical Attack release creates one charged cleave instance")
	_expect(sprite.animation == &"attack" and sprite.is_playing() and sprite.scale == Vector2(0.75, 0.75), "Axe release restarts the scale-consistent four-frame cleave strip without changing form scale")
	_expect(float(attack_instances[1].charge_ratio) > 0.0 and int(attack_instances[1].damage) > 30, "held charge increases the emitted cleave damage")
	await _physics_frames(30)

	_expect(knight.request_action("skill"), "Knight starts Throw & Recall once")
	_expect(skill_starts.size() == 1 and knight.is_axe_away(), "Throw creation marks Axe away and emits one skill-start signal")
	await _physics_frames(22)
	var instances_before_away_attack := attack_instances.size()
	_expect(not knight.request_action("attack") and attack_instances.size() == instances_before_away_attack, "Axe normal attack is disabled while the weapon is away")
	_expect(knight.request_action("dash"), "Dash remains usable while the Axe is away")
	_expect(knight.request_action("skill"), "Skill press during Axe cooldown manually recalls the active throw")
	_expect(skill_starts.size() == 1, "manual recall does not emit a second skill-start or reset cooldown")
	await _physics_frames(45)
	_expect(not knight.is_axe_away() and skill_resolutions.size() == 1, "Axe return resolves its Hand skill once and clears away state")
	_expect(bool(skill_resolutions[0].has_meaningful_endpoint) and int(skill_resolutions[0].skill_instance_id) > 0, "Axe resolution carries a meaningful principal endpoint and stable skill receipt")
	_expect(knight.request_action("attack"), "normal Axe attack becomes available again after cleanup")

	Input.action_release(&"attack")
	Input.action_release(&"move_right")
	await _physics_frames(30)
	_expect(manager.request_swap(0), "Sword Spirit can request the reverse character-form swap")
	await _physics_frames(18)
	_expect(manager.get_hand_weapon() == SWORD and knight.get_active_character_form_id() == &"free_knight" and sprite.scale == Vector2.ONE, "swapping away from Axe restores the FreeKnight form and presentation scale")
	_expect(knight.is_hand_weapon_baked_into_character() and not knight.get_node("HandWeaponVisual").visible, "swapping back to Sword keeps its authored weapon baked into the Hero and never restores a floating duplicate")
	_finish()


func _finish() -> void:
	if _failures.is_empty():
		print("AXE KNIGHT INTEGRATION TEST PASSED — %d checks" % _checks)
		get_tree().quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("AXE KNIGHT INTEGRATION TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		get_tree().quit(1)


func _physics_frames(count: int) -> void:
	for _frame: int in count:
		await get_tree().physics_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
