extends SceneTree

const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const WIZARD: HeroDefinition = preload("res://game/heroes/data/wizard_hero.tres")
const BOW: WeaponDefinition = preload("res://game/weapons/data/bow.tres")


class FallenEnemy:
	extends CharacterBody2D

	var max_health := 100
	var health := 0
	var attack_damage := 17
	var movement_speed := 60.0
	var attack_cooldown := 0.75
	var attack_range := 32.0

	func _init() -> void:
		var sprite := AnimatedSprite2D.new()
		sprite.name = "Sprite"
		var frames := SpriteFrames.new()
		frames.remove_animation(&"default")
		for animation: StringName in [&"idle", &"move", &"attack"]:
			frames.add_animation(animation)
		sprite.sprite_frames = frames
		sprite.animation = &"idle"
		add_child(sprite)


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(640, 360)
	var main_scene := load("res://game/main.tscn") as PackedScene
	var game := main_scene.instantiate() as Node2D
	root.add_child(game)
	await process_frame
	await physics_frame
	var knight := get_first_node_in_group(&"player")
	_expect(knight != null, "production player is available")
	if knight == null:
		_finish(game)
		return
	knight.set_physics_process(false)

	_test_authored_contracts()
	await _test_knight_ultimate(knight)
	await _test_archer_ultimate(knight)
	await _test_wizard_ultimate(game, knight)
	_finish(game)


func _test_authored_contracts() -> void:
	_expect(SWORD.ultimate_behavior_id == &"knight_cavalry_charge" and SWORD.ultimate_mana_cost == 15.0 and SWORD.ultimate_cooldown_seconds == 8.0 and SWORD.ultimate_power_multiplier == 3.0, "Knight Phi Mã owns the 15-Mana, 8-second, 300-percent contract")
	_expect(ARCHER.ultimate_behavior_id == &"archer_infinite_arrows" and ARCHER.ultimate_duration_seconds == 3.0 and ARCHER.ultimate_cooldown_seconds == 14.0 and ARCHER.ultimate_power_multiplier == 3.0, "Archer Infinite Arrows owns the three-second x3 contract")
	_expect(WIZARD.ultimate_behavior_id == &"wizard_raise_defeated" and WIZARD.ultimate_mana_cost == 30.0 and WIZARD.ultimate_cooldown_seconds == 20.0, "Wizard Raise Defeated owns the 30-Mana, 20-second contract")
	_expect(BOW.normal_attack.mana_cost == 2.0 and BOW.hand_skill.mana_cost == 14.0 and BOW.hand_skill.cooldown_seconds == 8.0, "Archer normal and current skill resource costs match the requested balance")


func _test_knight_ultimate(knight: Node) -> void:
	_expect(bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "sword_hero", "reserve_souls": ["archer_hero"]})), "Knight becomes active for Phi Mã")
	knight.call(&"_set_mana", knight.get("max_mana"))
	var normal_mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "attack", Vector2.RIGHT)), "Knight can perform a normal unenhanced attack")
	_expect(is_equal_approx(normal_mana_before, float(knight.get("mana"))), "unenhanced Knight normal attacks cost no mana")
	knight.call(&"_handle_action", 2.0)
	var activation_mana_before := float(knight.get("mana"))
	var enhancement_cost := float(knight.call(&"get_active_skill_mana_cost"))
	var enhancement_profile: Dictionary = knight.call(
		&"_active_hero_ranked_skill_profile", &"active_1"
	)
	var enhancement_cooldown := float(knight.hero_soul_manager.active_skill_cooldown(
		float(enhancement_profile.get("cooldown", 10.0))
	))
	_expect(bool(knight.call(&"request_action", "skill")), "Knight enables the persistent enhancement")
	_expect(is_equal_approx(activation_mana_before - float(knight.get("mana")), enhancement_cost), "Knight enhancement activation spends its Hero Weapon rank cost")
	var enhanced_attack_mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "attack", Vector2.RIGHT)), "enhanced Knight can perform a normal attack")
	_expect(is_equal_approx(enhanced_attack_mana_before - float(knight.get("mana")), 4.0), "Knight normal attacks spend mana only while enhanced")
	knight.call(&"_handle_action", 2.0)
	_expect(bool(knight.call(&"request_action", "skill")), "Knight cancels the enhancement with a second skill press")
	_expect(is_equal_approx(float(knight.get("soul_echo_cooldown_remaining")), enhancement_cooldown), "Knight enhancement cooldown starts at its Hero Weapon rank value only after cancellation")
	knight.call(&"_set_mana", knight.get("max_mana"))
	var mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "ultimate", Vector2.RIGHT)), "Knight activates Phi Mã through the public action route")
	_expect(is_equal_approx(mana_before - float(knight.get("mana")), 15.0), "Phi Mã spends exactly 15 mana")
	_expect(is_equal_approx(float(knight.call(&"get_ultimate_cooldown_remaining")), 8.0), "Phi Mã starts an eight-second cooldown")
	await process_frame
	var charges := get_nodes_in_group(&"knight_cavalry")
	_expect(charges.size() == 1, "Phi Mã creates one cavalry formation")
	if not charges.is_empty():
		var rider_count := 0
		var rider_positions: Array[Vector2] = []
		var line_count := 0
		for child: Node in (charges[0] as Node).get_children():
			if child is AnimatedSprite2D:
				rider_count += 1
				rider_positions.append((child as AnimatedSprite2D).position)
			if child is Line2D:
				line_count += 1
		_expect(rider_count == 14, "Phi Mã formation contains fourteen mounted riders")
		var row_counts := {16: 0, -13: 0, -42: 0}
		for rider_position: Vector2 in rider_positions:
			var row_x := roundi(rider_position.x)
			if row_counts.has(row_x):
				row_counts[row_x] = int(row_counts[row_x]) + 1
		_expect(
			int(row_counts[16]) == 4 and int(row_counts[-13]) == 6 and int(row_counts[-42]) == 4,
			"Phi Mã riders use the dense staggered 4-6-4 formation inside the original hitbox",
		)
		_expect(
			is_equal_approx(float((charges[0] as Node).get("formation_half_width")), 54.0),
			"Phi Mã keeps the original formation hitbox while increasing rider density",
		)
		_expect(line_count == 0, "Phi Mã no longer draws artificial Line2D trails")
		_expect(
			(charges[0] as Node).get("_riders")[0].modulate.r > (charges[0] as Node).get("_riders")[0].modulate.b
				and (charges[0] as Node).get("_riders")[0].modulate.r < 0.5,
			"Phi Mã spectral riders use the dark ominous-red tint",
		)
		var charge_constants := ((charges[0] as Node).get_script() as Script).get_script_constant_map()
		_expect(
			float(charge_constants.get("AFTERIMAGE_INTERVAL", 1.0)) <= 0.05,
			"Phi Mã emits black afterimages at a dense high frequency",
		)
		(charges[0] as Node).queue_free()
	await process_frame


func _test_archer_ultimate(knight: Node) -> void:
	_expect(bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "archer_hero", "reserve_souls": ["sword_hero"]})), "Archer becomes active for Infinite Arrows")
	knight.call(&"_set_mana", knight.get("max_mana"))
	var mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "ultimate")), "Archer activates Infinite Arrows through the public action route")
	_expect(is_equal_approx(mana_before, float(knight.get("mana"))), "Infinite Arrows has no activation mana cost")
	_expect(is_equal_approx(float(knight.call(&"get_ultimate_cooldown_remaining")), 14.0), "Infinite Arrows starts a fourteen-second cooldown")
	_expect(bool(knight.call(&"is_archer_infinite_arrows_active")) and is_equal_approx(float(knight.call(&"_archer_attack_speed_multiplier")), 3.0), "Infinite Arrows applies the live x3 attack-speed multiplier")
	var shot_mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "attack", Vector2.RIGHT)), "Archer can shoot while Infinite Arrows is active")
	_expect(is_equal_approx(shot_mana_before, float(knight.get("mana"))), "Archer normal shots cost no mana during Infinite Arrows")
	knight.call(&"_handle_action", 2.0)


func _test_wizard_ultimate(game: Node2D, knight: Node) -> void:
	_expect(bool(knight.call(&"configure_soul_team_from_run", {"active_hero": "wizard_hero", "reserve_souls": ["sword_hero"]})), "Wizard becomes active for Raise Defeated")
	knight.call(&"_set_mana", knight.get("max_mana"))
	var mana_before := float(knight.get("mana"))
	_expect(bool(knight.call(&"request_action", "ultimate")), "Wizard activates Raise Defeated through the public action route")
	_expect(is_equal_approx(mana_before - float(knight.get("mana")), 30.0), "Raise Defeated spends exactly 30 mana")
	_expect(is_equal_approx(float(knight.call(&"get_ultimate_cooldown_remaining")), 20.0), "Raise Defeated starts a twenty-second cooldown")
	var runtime := knight.get("wizard_runtime") as Node
	_expect(runtime != null and bool((runtime.call(&"get_state_snapshot") as Dictionary).get("raise_defeated_active", false)), "Wizard resurrection mode remains active for the stage")
	if runtime == null:
		return
	var fallen := FallenEnemy.new()
	fallen.name = "FallenTestEnemy"
	fallen.global_position = (knight as Node2D).global_position + Vector2(48.0, 0.0)
	game.add_child(fallen)
	runtime.call(&"_on_enemy_killed", fallen, &"sword")
	await process_frame
	await process_frame
	var summons := get_nodes_in_group(&"wizard_summons")
	_expect(summons.size() == 1, "a defeated non-boss returns as one Wizard ally")
	if not summons.is_empty():
		var ally := summons[0] as Node
		_expect(int(ally.get("max_health")) == 20, "resurrected enemy has 20 percent of its original HP")
		_expect(int(ally.get("attack_damage")) == 17, "resurrected enemy keeps 100 percent of its original attack")
		var visual := ally.get_node_or_null("ReanimatedVisual") as AnimatedSprite2D
		_expect(visual != null and visual.modulate.b > visual.modulate.g, "resurrected enemy reuses its visual with a purple Wizard tint")
	var boss := FallenEnemy.new()
	boss.add_to_group(&"bosses")
	game.add_child(boss)
	runtime.call(&"_on_enemy_killed", boss, &"sword")
	await process_frame
	_expect(int((runtime.call(&"get_state_snapshot") as Dictionary).get("raised_ally_count", 0)) == 1, "bosses are excluded from resurrection")
	runtime.call(&"_on_map_changed", "test_stage_change")
	await process_frame
	var cleared_state := runtime.call(&"get_state_snapshot") as Dictionary
	_expect(not bool(cleared_state.get("raise_defeated_active", true)) and int(cleared_state.get("raised_ally_count", -1)) == 0, "new-stage transition clears resurrection mode and all raised allies")
	fallen.queue_free()
	boss.queue_free()


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish(game: Node) -> void:
	if is_instance_valid(game):
		game.queue_free()
	if _failures.is_empty():
		print("HERO ULTIMATE RUNTIME TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("HERO ULTIMATE FAIL: " + failure)
		print("HERO ULTIMATE RUNTIME TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)
