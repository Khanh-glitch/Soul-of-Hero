extends Node

var _checks := 0
var _failures: Array[String] = []
var _hand_hit_weapon_ids: Array[StringName] = []
var _skill_resolutions: Array[Dictionary] = []


func start(_game: Node2D) -> void:
	_run.call_deferred()


func _run() -> void:
	for _frame: int in range(30):
		await get_tree().physics_frame
	var player := get_tree().get_first_node_in_group(&"player") as KnightController
	var enemies := get_tree().get_nodes_in_group(&"enemies")
	_expect(player != null, "Knight exposes the Living Arsenal runtime")
	_expect(not enemies.is_empty(), "runtime target exists")
	if player == null or enemies.is_empty():
		_finish()
		return
	var enemy := enemies[0] as SkeletonEnemy
	enemy.set_physics_process(false)
	enemy.max_health = 999
	enemy.health = 999
	player.global_position = Vector2(104.0, 104.0)
	player.facing_direction = Vector2.RIGHT
	player.velocity = Vector2.ZERO
	enemy.global_position = player.global_position + Vector2.RIGHT * 26.0
	await get_tree().physics_frame

	var manager := player.get_weapon_manager()
	manager.hand_attack_hit.connect(func(weapon: WeaponDefinition, _context: Dictionary) -> void:
		_hand_hit_weapon_ids.append(weapon.weapon_id)
	)
	manager.hand_skill_resolved.connect(func(weapon: WeaponDefinition, context: Dictionary) -> void:
		_skill_resolutions.append({"weapon_id": weapon.weapon_id, "context": context.duplicate(true)})
	)
	SaveService.reset_to_defaults("RESET_LIVING_ARSENAL_SAVE")
	var empty_spirits: Array[WeaponDefinition] = []
	manager.configure_loadout(preload("res://game/weapons/data/sword.tres"), empty_spirits, false)
	player._refresh_weapon_visuals()
	_expect(manager != null and manager.get_hand_weapon().weapon_id == &"sword", "Sword starts in Hand")
	_expect(player.grant_bow_reward(), "Bow reward transaction succeeds")
	_expect(UnlockService.is_weapon_unlocked(&"bow") and manager.get_spirit_weapon(0).weapon_id == &"bow", "Bow reward unlocks and equips Spirit")

	var health_before := enemy.health
	_expect(player.request_action("attack") and player.current_action == "sword_attack_1", "semantic Attack starts Sword combo hit 1")
	for _frame: int in range(24):
		await get_tree().physics_frame
	_expect(enemy.health == health_before - 18, "Sword combo profile applies confirmed melee damage once")
	_expect(_hand_hit_weapon_ids.has(&"sword"), "Sword confirmed hit routes through WeaponManager")

	var spirit_arrows_before := _count_effects(PiercingArrowEffect)
	_expect(player.request_action("dash"), "semantic Dash starts")
	await get_tree().process_frame
	_expect(_count_effects(PiercingArrowEffect) > spirit_arrows_before, "Bow Spirit fires Reverse Piercing Shot on confirmed Dash")
	for _frame: int in range(16):
		await get_tree().physics_frame

	manager.reset_all_cooldowns()
	_expect(manager.request_swap(0), "Spirit slot directly requests swap")
	for _frame: int in range(22):
		await get_tree().physics_frame
	_expect(manager.get_hand_weapon().weapon_id == &"bow" and manager.get_spirit_weapon(0).weapon_id == &"sword", "0.25s swap exchanges Hand and Spirit roles")

	# The target's AI stays frozen for deterministic positioning, but its damage
	# lock is also advanced by _physics_process. Let the Sword hit lock expire
	# before re-freezing it so the delayed Bow hit can be genuinely confirmed.
	enemy.set_physics_process(true)
	for _frame: int in range(14):
		await get_tree().physics_frame
	enemy.set_physics_process(false)
	enemy.velocity = Vector2.ZERO
	enemy.global_position = player.global_position + Vector2.RIGHT * 70.0
	enemy.health = 999
	var falling_before := _count_effects(FallingArrowEffect)
	_expect(player.request_action("attack"), "Bow Hand Attack accepts a valid assisted target")
	await get_tree().process_frame
	_expect(_count_effects(FallingArrowEffect) > falling_before, "Bow Hand creates delayed Falling Arrow instance")

	for _frame: int in range(28):
		await get_tree().physics_frame
	_expect(_hand_hit_weapon_ids.has(&"bow"), "Falling Arrow confirmed hit preserves Bow source through WeaponManager")
	manager.notify_hand_attack_started({"origin": player.global_position, "facing": Vector2.RIGHT})
	manager.notify_hand_attack_instance_created({"instance_id": 9002})
	manager.notify_hand_attack_started({"origin": player.global_position, "facing": Vector2.RIGHT})
	manager.notify_hand_attack_instance_created({"instance_id": 9003})
	await get_tree().process_frame
	_expect(_count_effects(FlyingSwordEffect) > 0, "Sword Spirit creates Flying Sword after three confirmed Hand instances")
	manager.reset_all_cooldowns()
	var volley_before := _count_effects(PiercingArrowEffect)
	var resolutions_before := _skill_resolutions.size()
	_expect(player.request_action("skill"), "Bow Hand Skill starts")
	await get_tree().process_frame
	_expect(_count_effects(PiercingArrowEffect) >= volley_before + 3, "Triple Volley creates three piercing lines")
	_expect(_skill_resolutions.size() == resolutions_before, "Triple Volley does not resolve before its projectiles complete")

	for _frame: int in range(60):
		await get_tree().physics_frame
	_expect(
		_skill_resolutions.size() == resolutions_before + 1
		and _skill_resolutions[-1].weapon_id == &"bow",
		"Triple Volley resolves once with the original Bow source"
	)
	var spirits: Array[WeaponDefinition] = [preload("res://game/weapons/data/bow.tres")]
	manager.configure_loadout(preload("res://game/weapons/data/sword.tres"), spirits, false)
	manager.reset_all_cooldowns()
	player._refresh_weapon_visuals()
	player.facing_direction = Vector2.RIGHT
	_expect(player.request_action("skill") and player.current_action == "dash_slash", "Sword Skill starts Dash Slash")
	_expect((player.collision_mask & 4) == 0, "Dash Slash temporarily ignores unit collision")
	for _frame: int in range(16):
		await get_tree().physics_frame
	_expect((player.collision_mask & 4) != 0, "Dash Slash restores enemy collision deterministically")
	_finish()


func _count_effects(effect_type: Variant) -> int:
	var count := 0
	for child: Node in get_tree().current_scene.get_children():
		if is_instance_of(child, effect_type):
			count += 1
	return count


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
		push_error("FAIL  " + message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open("res://.artifacts/living_arsenal_runtime_report.json", FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify({
			"passed": _failures.is_empty(),
			"checks": _checks,
			"failures": _failures,
		}, "  ") + "\n")
	get_tree().quit(0 if _failures.is_empty() else 1)
