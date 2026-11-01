extends Node

const REPORT_PATH := "res://.artifacts/archer_hero_combat_report.json"
const KNIGHT_SCENE: PackedScene = preload("res://game/characters/knight/knight.tscn")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const BOW: WeaponDefinition = preload("res://game/weapons/data/bow.tres")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

var _checks := 0
var _failures: Array[String] = []
var _world: Node2D
var _knight: KnightController
var _dummy: ArcherDamageDummy


class ArcherDamageDummy:
	extends CharacterBody2D
	var max_health := 5000
	var health := 5000
	var stagger_received := 0.0
	var _target: Node2D

	func _init() -> void:
		collision_layer = 4
		collision_mask = 0
		var collision := CollisionShape2D.new()
		var shape := CircleShape2D.new()
		shape.radius = 8.0
		collision.shape = shape
		add_child(collision)

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> void:
		health = maxi(0, health - amount)

	func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
		stagger_received += amount

	func reset() -> void:
		health = max_health
		stagger_received = 0.0


func start(_app_root: Node) -> void:
	_run.call_deferred()


func _run() -> void:
	_test_authored_sidegrade_contract()
	_world = Node2D.new()
	_world.name = "ArcherHeroCombatWorld"
	add_child(_world)
	_knight = KNIGHT_SCENE.instantiate() as KnightController
	_world.add_child(_knight)
	_dummy = ArcherDamageDummy.new()
	_dummy.name = "ArcherDamageDummy"
	_dummy.add_to_group(&"enemies")
	_world.add_child(_dummy)
	_dummy._target = _knight
	await _physics_frames(3)
	await _test_mouse_selected_aim_and_lmb_buffer()
	await _test_live_focus_chain_and_release_timing()
	await _test_attack_facing_allows_backpedal()
	await _test_live_soul_mark_and_focus_failure_rules()
	await _test_clear_shot_readiness()
	await _test_dash_archer_visual_and_takeover()
	await _test_sword_threat_visual_and_q_takeover()
	_finish()


func _test_authored_sidegrade_contract() -> void:
	_expect(ARCHER.validate().is_empty(), "Archer HeroDefinition validates")
	_expect(BOW.get_validation_errors().is_empty(), "Archer Bow definition validates")
	_expect(
		ARCHER.production_ready and ARCHER.hero_id == &"archer_hero",
		"Archer is a production Hero identity"
	)
	_expect(ARCHER.combo_step_count() == 3, "Archer owns a three-shot Focus chain")
	_expect(
		[ARCHER.combo_damage(1), ARCHER.combo_damage(2), ARCHER.combo_damage(3)] == [20, 22, 33],
		"Archer base chain matches its authored 20/22/33 damage"
	)
	_expect(
		ARCHER.archer_piercer_focus_damage_bonus == [0, 6, 12],
		"Piercer Focus bonuses are exactly 0/6/12"
	)
	_expect(
		ARCHER.archer_piercer_focus_target_caps == [1, 2, 4],
		"Piercer target caps are exactly 1/2/4"
	)
	_expect(
		ARCHER.archer_stagger_values == [6.0, 8.0, 14.0], "Base stagger chain is exactly 6/8/14"
	)
	_expect(
		ARCHER.combo_action_durations == [0.32, 0.4, 0.7],
		"Archer action timings are exactly 0.32/0.40/0.70 seconds"
	)
	_expect(
		ARCHER.combo_hit_windows == [Vector2(0.13, 0.18), Vector2(0.16, 0.22), Vector2(0.4, 0.48)],
		"Archer releases shots in the authored animation windows"
	)
	_expect(
		ARCHER.archer_focus_min_distance == 96.0 and ARCHER.archer_focus_max_distance == 260.0,
		"Focus requires the 96-260 spacing band"
	)
	_expect(
		(
			ARCHER.archer_close_pressure_radius == 72.0
			and ARCHER.archer_close_focus_decay_seconds == 0.45
		),
		"Close pressure removes Focus at the authored rate"
	)
	_expect(BOW.normal_attack.mana_cost == 2.0, "Archer normal attacks cost exactly 2 mana")
	_expect(
		(
			BOW.normal_attack.target_rules.range == 12000.0
			and ARCHER.archer_projectile_ranges == [12000.0, 12000.0, 12000.0]
			and ARCHER.archer_soul_line_range == 12000.0
		),
		"all player Archer arrows own full-map travel range",
	)
	_expect(
		(
			ARCHER.active_skill_name == "Soul Mark"
			and ARCHER.active_skill_mana_cost == 14.0
			and ARCHER.active_skill_cooldown_seconds == 8.0
		),
		"Soul Mark costs 14 mana on an 8-second cooldown"
	)
	_expect(
		(
			ARCHER.ultimate_behavior_id == &"archer_infinite_arrows"
			and ARCHER.ultimate_duration_seconds == 3.0
			and ARCHER.ultimate_cooldown_seconds == 14.0
		),
		"Infinite Arrows is the authored three-second R ultimate"
	)
	_expect(
		ARCHER.archer_soul_line_damage == 44 and ARCHER.archer_soul_line_target_cap == 5,
		"Soul Line deals 44 and can pierce five targets"
	)
	_expect(
		(
			ARCHER.ready_condition_behavior_id == &"clear_shot"
			and ARCHER.clear_shot_hold_seconds == 1.0
		),
		"Reserve Archer uses one-second Clear Shot readiness"
	)
	_expect(
		ARCHER.takeover_windows == [Vector2(0.18, 0.3), Vector2(0.48, 0.62), Vector2(0.78, 0.94)],
		"Archer Relay exposes three authored takeover windows"
	)
	var knight_source := FileAccess.get_file_as_string("res://game/characters/knight/knight.gd")
	_expect(
		knight_source.contains(
			'scale_hero_action_damage(&"archer_hero", &"summon_skill", hero.archer_summon_damage)'
		),
		"Piercing Entry routes through the canonical Summon Skill progression track"
	)
	_expect(
		(
			knight_source
			. contains(
				'scale_hero_action_damage(&"archer_hero", &"departure_skill", hero.archer_departure_damage)'
			)
		),
		"Backstep Volley routes through the canonical Departure Skill progression track"
	)

	var sword_damage := 0
	var sword_duration := 0.0
	for step: int in range(1, SWORD.combo_step_count() + 1):
		sword_damage += SWORD.combo_damage(step)
		sword_duration += SWORD.combo_action_durations[step - 1]
	var archer_full_focus_damage := (
		ARCHER.combo_damage(1)
		+ ARCHER.combo_damage(2)
		+ ARCHER.combo_damage(3)
		+ ARCHER.archer_piercer_focus_damage_bonus[2]
	)
	var archer_duration := (
		ARCHER.combo_action_durations[0]
		+ ARCHER.combo_action_durations[1]
		+ ARCHER.combo_action_durations[2]
	)
	var sword_dps := float(sword_damage) / sword_duration
	var archer_dps := float(archer_full_focus_damage) / archer_duration
	_expect(
		sword_damage == 74 and is_equal_approx(sword_duration, 1.70),
		"Sword benchmark matches its authored 74 damage over 1.70 seconds"
	)
	_expect(
		archer_full_focus_damage == 87 and is_equal_approx(archer_duration, 1.42),
		"Full-Focus Archer chain is 87 damage over 1.42 seconds"
	)
	_expect(
		is_equal_approx(sword_dps, 74.0 / 1.70) and is_equal_approx(archer_dps, 87.0 / 1.42),
		"Sword and Full-Focus Archer retain their distinct authored raw DPS benchmarks",
	)
	_expect(
		ARCHER.combo_damage(1) + ARCHER.combo_damage(2) + ARCHER.combo_damage(3) == 75,
		"Missing the spacing loop costs Archer exactly 12 chain damage"
	)


func _test_live_focus_chain_and_release_timing() -> void:
	# Keep this authored-Archer damage fixture free of a Reserve Spirit: Sword
	# legitimately fires its independent 28-damage Flying Sword after shot three.
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "archer_hero", "reserve_souls": []}),
		"Live Knight accepts Archer as the equipped active Hero"
	)
	_expect(
		_knight.refresh_auxiliary_equipment_from_save(_baseline_save_snapshot()),
		"Live damage test removes profile-specific progression modifiers"
	)
	_expect(
		_knight.get_active_character_form_id() == &"archer_hero_form",
		"Archer equips its dedicated baked character form"
	)
	var sprite := _knight.get_node("Sprite") as AnimatedSprite2D
	_expect(
		sprite != null and sprite.sprite_frames.has_animation(&"archer_armor_piercer"),
		"Archer form exposes the authored Piercer animation"
	)
	var manager := _knight.get_weapon_manager()
	var attack_instances: Array[Dictionary] = []
	manager.hand_attack_instance_created.connect(
		func(_weapon: WeaponDefinition, context: Dictionary) -> void:
			attack_instances.append(context.duplicate(true))
	)
	_knight.call(&"_update_facing", Vector2.RIGHT)
	_dummy.global_position = Vector2(160.0, -8.0)
	_dummy.reset()

	_expect(_knight.request_action("attack"), "Quick Shot starts")
	_expect(
		attack_instances.is_empty(),
		"Quick Shot does not create a projectile before its release frame"
	)
	await _physics_frames(5)
	_expect(attack_instances.is_empty(), "Quick Shot is still held before 0.13 seconds")
	await _physics_frames(6)
	_expect(
		attack_instances.size() == 1,
		"Quick Shot creates exactly one projectile after crossing 0.13 seconds"
	)
	await _physics_frames(24)
	var damage_after_quick := _dummy.max_health - _dummy.health
	_expect(
		damage_after_quick == _expected_normal_damage(1),
		"Quick Shot confirms its canonical live damage (got %d)" % damage_after_quick,
	)
	_expect(
		int(_knight.get_realtime_state().hero.archer_focus) == 1,
		"In-band Quick Shot grants one Focus"
	)

	_expect(_knight.request_action("attack"), "Split Step starts")
	await _physics_frames(55)
	var damage_after_split := _dummy.max_health - _dummy.health
	_expect(
		damage_after_split == _expected_normal_damage(1) + _expected_normal_damage(2),
		"Split Step adds its canonical live damage (total got %d)" % damage_after_split,
	)
	_expect(
		int(_knight.get_realtime_state().hero.archer_focus) == 2,
		"In-band Split Step reaches two Focus"
	)
	_expect(
		_knight.global_position.x < -20.0 and _knight.invulnerability_remaining <= 0.0,
		"Split Step repositions about 24px without invulnerability"
	)

	_expect(_knight.request_action("attack"), "Armor Piercer starts")
	await _physics_frames(52)
	var damage_after_piercer := _dummy.max_health - _dummy.health
	_expect(
		(
			damage_after_piercer
			== (
				_expected_normal_damage(1)
				+ _expected_normal_damage(2)
				+ _expected_normal_damage(3, 2)
			)
		),
		"Two-Focus Piercer completes the canonical live chain (got %d)" % damage_after_piercer,
	)
	_expect(
		is_equal_approx(_dummy.stagger_received, 34.0),
		"Two-Focus Piercer scales total chain stagger to 6+8+20"
	)
	_expect(
		int(_knight.get_realtime_state().hero.archer_focus) == 0,
		"Piercer consumes all Focus on release"
	)
	var focus_snapshot := (
		int(attack_instances[-1].get("focus_snapshot", -1))
		if not attack_instances.is_empty()
		else -1
	)
	_expect(focus_snapshot == 2, "Piercer publishes its two-Focus release snapshot")


func _test_attack_facing_allows_backpedal() -> void:
	var manager := _knight.get_weapon_manager()
	manager.reset_hand_combo()
	_knight.call(&"_reset_archer_state", &"backpedal_facing_test")
	var origin := Vector2(320.0, 240.0)
	_knight.global_position = origin
	_knight.velocity = Vector2.ZERO
	_knight.call(&"_update_facing", Vector2.RIGHT)
	_dummy.global_position = origin + Vector2(160.0, -8.0)
	_dummy.reset()

	Input.action_press(&"move_left")
	_expect(
		_knight.request_action("attack", _dummy.global_position),
		"Archer can start a right-aimed shot while left movement is held"
	)
	await _physics_frames(8)
	var sprite := _knight.get_node("Sprite") as AnimatedSprite2D
	_expect(
		_knight.global_position.x < origin.x - 0.5,
		"Attack locomotion remains independent and moves the Archer backwards"
	)
	_expect(
		(
			_knight.current_action == "bow_attack"
			and _knight.action_direction.x > 0.9
			and _knight.facing_direction.x > 0.9
			and not sprite.flip_h
		),
		"Backpedaling cannot turn the attack visual or hit direction away from its right-aim snapshot"
	)
	await _physics_frames(24)
	_expect(
		_knight.current_action.is_empty() and _knight.facing_direction.x < -0.9 and sprite.flip_h,
		"Held movement regains visual-facing ownership immediately after attack recovery"
	)
	Input.action_release(&"move_left")
	_knight.velocity = Vector2.ZERO
	_knight.call(&"_update_facing", Vector2.RIGHT)
	manager.reset_hand_combo()
	_knight.call(&"_reset_archer_state", &"backpedal_facing_test_complete")
	await _physics_frames(2)


func _test_live_soul_mark_and_focus_failure_rules() -> void:
	var manager := _knight.get_weapon_manager()
	manager.reset_all_cooldowns()
	_expect(
		_knight.refresh_auxiliary_equipment_from_save(_advanced_archer_save_snapshot()),
		"Soul Mark fixture explicitly selects an Advanced-kit Archer Soul",
	)
	_knight.call(&"_set_mana", _knight.max_mana)
	_dummy.global_position = _knight.global_position + Vector2(160.0, -8.0)
	_dummy.reset()
	var mana_before := _knight.mana
	_expect(_knight.request_action("skill"), "Soul Mark acquires a valid ranged target")
	var ranked_mark := _knight.get_active_hero_skill_profile(&"active_1")
	var expected_mark_cost := _knight.get_hero_soul_manager().active_skill_mana_cost(
		float(ranked_mark.get("mana", 0.0))
	)
	_expect(
		is_equal_approx(mana_before - _knight.mana, expected_mark_cost),
		"Soul Mark spends its current ranked mana cost",
	)
	_expect(
		not bool(_knight.get_realtime_state().hero.archer_mark_active),
		"Soul Mark is not active before its 0.22-second cast completes"
	)
	await _physics_frames(16)
	_expect(
		bool(_knight.get_realtime_state().hero.archer_mark_active),
		"Soul Mark activates at cast completion for the next normal hit"
	)
	_expect(_knight.request_action("attack"), "A normal shot can consume Soul Mark after the cast")
	await _physics_frames(55)
	var marked_damage := _dummy.max_health - _dummy.health
	var expected_marked_damage := (
		_expected_normal_damage(1)
		+ _knight.get_hero_soul_manager().scale_active_action_damage(
			&"active_skill", ARCHER.archer_soul_line_damage
		)
	)
	_expect(
		marked_damage == expected_marked_damage,
		(
			"Marked Quick Shot plus Soul Line matches the canonical projection (got %d)"
			% marked_damage
		),
	)
	_expect(
		is_equal_approx(_dummy.stagger_received, 20.0),
		"Marked hit applies 6 normal plus 14 Soul Line stagger (got %.2f)" % _dummy.stagger_received
	)
	_expect(
		not bool(_knight.get_realtime_state().hero.archer_mark_active),
		"Confirmed normal hit consumes Soul Mark once"
	)

	_dummy.global_position = _knight.global_position + Vector2(30.0, 0.0)
	_knight.call(&"_set_archer_focus", 1, &"test_close_pressure")
	_knight.call(&"_tick_archer_state", 0.46)
	_expect(
		int(_knight.get_realtime_state().hero.archer_focus) == 0,
		"A hostile inside 72px removes one Focus after 0.45 seconds"
	)
	_dummy.global_position = _knight.global_position + Vector2(160.0, 0.0)
	_knight.call(&"_set_archer_focus", 2, &"test_timeout")
	_knight.call(&"_tick_archer_state", 4.01)
	_expect(
		int(_knight.get_realtime_state().hero.archer_focus) == 0,
		"Focus expires after four seconds without refresh"
	)


func _test_mouse_selected_aim_and_lmb_buffer() -> void:
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "archer_hero", "reserve_souls": []}),
		"Mouse-aim fixture equips Archer without a Reserve side effect"
	)
	_expect(
		_knight.refresh_auxiliary_equipment_from_save(_baseline_save_snapshot()),
		"Mouse-aim fixture removes profile-specific damage modifiers"
	)
	var manager := _knight.get_weapon_manager()
	manager.reset_all_cooldowns()
	manager.reset_hand_combo()
	_knight.call(&"_reset_archer_state", &"mouse_aim_test")
	var pointer_choice := ArcherDamageDummy.new()
	pointer_choice.name = "PointerChoiceDummy"
	pointer_choice.add_to_group(&"enemies")
	_world.add_child(pointer_choice)
	pointer_choice._target = _knight
	await _physics_frames(2)

	var attack_instances: Array[Dictionary] = []
	manager.hand_attack_instance_created.connect(
		func(_weapon: WeaponDefinition, context: Dictionary) -> void:
			attack_instances.append(context.duplicate(true))
	)
	var confirmed_hits: Array[Dictionary] = []
	var record_hit := func(
		target: Node, amount: int, _position: Vector2, context: Dictionary
	) -> void:
		if target == _dummy or target == pointer_choice:
			(
				confirmed_hits
				. append(
					{
						"target": target.name,
						"amount": amount,
						"context": context.duplicate(true),
					}
				)
			)
	GameEvents.combat_hit_confirmed.connect(record_hit)
	var origin := Vector2(12.0, 18.0)
	_knight.global_position = origin
	_knight.call(&"_update_facing", Vector2.RIGHT)
	_dummy.global_position = origin + Vector2(76.0, -48.0)
	pointer_choice.global_position = origin + Vector2(148.0, 58.0)
	_dummy.reset()
	pointer_choice.reset()
	_knight.call(&"_set_locked_attack_target", pointer_choice)
	_expect(
		_knight.request_action("attack"),
		"RMB-priority Archer request accepts the deliberately selected target"
	)
	await _physics_frames(54)
	_expect(
		(
			pointer_choice.health == pointer_choice.max_health - _expected_normal_damage(1)
			and _dummy.health == _dummy.max_health
		),
		(
			(
				"Archer shoots the farther RMB-priority enemy instead of its automatic candidate "
				+ "(pointer=%d fallback=%d shots=%d knight=%s target=%s hits=%s)"
			)
			% [
				pointer_choice.max_health - pointer_choice.health,
				_dummy.max_health - _dummy.health,
				attack_instances.size(),
				str(_knight.global_position),
				str(pointer_choice.global_position),
				JSON.stringify(confirmed_hits),
			]
		)
	)
	var expected_direction := (origin + Vector2(0.0, -8.0)).direction_to(
		pointer_choice.global_position
	)
	var published_direction := (
		attack_instances[-1].get("projectile_direction", Vector2.ZERO) as Vector2
		if not attack_instances.is_empty()
		else Vector2.ZERO
	)
	_expect(
		published_direction.dot(expected_direction) > 0.99,
		"Archer publishes the RMB-priority projectile direction"
	)

	manager.reset_hand_combo()
	_knight.call(&"_reset_archer_state", &"lmb_buffer_test")
	_knight.call(&"_clear_locked_attack_target")
	_knight.global_position = origin
	_dummy.global_position = origin + Vector2(150.0, -62.0)
	pointer_choice.global_position = origin + Vector2(150.0, 62.0)
	_dummy.reset()
	pointer_choice.reset()
	_dummy.health = 4500
	await _physics_frames(1)
	_expect(_knight.request_action("attack"), "auto-targeted buffer fixture starts Quick Shot")
	await _physics_frames(2)
	_expect(
		_knight.request_action("attack"),
		"a second LMB during bow_attack is accepted into the one-shot buffer"
	)
	await _physics_frames(72)
	_expect(
		(
			_dummy.health == 4500 - _expected_normal_damage(1) - _expected_normal_damage(2)
			and pointer_choice.health == pointer_choice.max_health
		),
		(
			"buffered LMB fires Split Step at Archer's lowest-current-HP auto target (target=%d other=%d)"
			% [
				4500 - _dummy.health,
				pointer_choice.max_health - pointer_choice.health,
			]
		)
	)
	_expect(
		_knight.current_action.is_empty(),
		"the buffered Archer chain resolves without leaving a stuck action"
	)
	GameEvents.combat_hit_confirmed.disconnect(record_hit)
	pointer_choice.queue_free()
	manager.reset_hand_combo()
	_knight.call(&"_reset_archer_state", &"mouse_aim_test_complete")
	_knight.global_position = Vector2.ZERO
	_knight.velocity = Vector2.ZERO
	_knight.call(&"_update_facing", Vector2.RIGHT)
	await _physics_frames(1)


func _test_clear_shot_readiness() -> void:
	var weapon_manager := _knight.get_weapon_manager()
	var mark_cooldown_before_equip := weapon_manager.get_hand_skill_cooldown_remaining(&"bow")
	_expect(
		mark_cooldown_before_equip > 0.0,
		"Soul Mark cooldown is still live before the same-run team Equip"
	)
	_expect(
		_knight.configure_soul_team_from_run(
			{"active_hero": "sword_hero", "reserve_souls": ["archer_hero"]}
		),
		"Archer can be explicitly equipped as the live reserve"
	)
	_expect(
		is_equal_approx(
			weapon_manager.get_hand_skill_cooldown_remaining(&"bow"), mark_cooldown_before_equip
		),
		"Same-run Equip preserves the Bow cooldown instead of resetting it"
	)
	_expect(
		_knight.refresh_auxiliary_equipment_from_save(_baseline_save_snapshot()),
		"Clear Shot test uses a rank-zero reserve projection"
	)
	_dummy._target = _knight
	_dummy.global_position = _knight.global_position + Vector2(160.0, 0.0)
	await _physics_frames(72)
	var relay := _knight.get_hero_soul_manager()
	_expect(
		relay.state == HeroSoulManager.RelayState.READY,
		"One clear hostile line held for a second makes reserve Archer Ready"
	)
	_expect(
		relay.ready_seconds_left > 0.0 and relay.ready_seconds_left <= 5.0,
		"Clear Shot readiness has the authored five-second lifetime"
	)


func _test_dash_archer_visual_and_takeover() -> void:
	var relay := _knight.get_hero_soul_manager()
	var weapon_manager := _knight.get_weapon_manager()
	weapon_manager.reset_all_cooldowns()
	_knight.dash_cooldown_remaining = 0.0
	_knight.call(&"_set_stamina", _knight.max_stamina)
	_knight.call(&"_update_facing", Vector2.RIGHT)
	var dash_origin := Vector2(48.0, 32.0)
	_knight.global_position = dash_origin
	_dummy.reset()
	_dummy._target = _knight
	_dummy.global_position = dash_origin + Vector2(-140.0, -8.0)

	_expect(_knight.request_action("dash"), "Dash starts with Archer equipped as the Reserve")
	var dash_snapshot := relay.get_state_snapshot()
	_expect(
		(
			relay.state == HeroSoulManager.RelayState.READY
			and not relay.takeover_open
			and String(dash_snapshot.summon_context) == "archer_dash"
			and is_equal_approx(float(dash_snapshot.ready_seconds), 2.0)
		),
		"Bow Dash opens a two-second Archer Ready opportunity before confirmation"
	)
	var avatar := _knight.get("_soul_support_visual") as AnimatedSprite2D
	_expect(
		(
			is_instance_valid(avatar)
			and avatar.name == "ArcherSoulAvatar"
			and avatar.global_position.is_equal_approx(dash_origin + Vector2(0.0, -24.0))
		),
		"Dash leaves the authored Archer avatar at the exact Dash origin"
	)
	_expect(
		is_instance_valid(avatar) and avatar.animation == &"archer_summon" and avatar.flip_h,
		"Dash Archer visibly draws the bow toward the reverse-Dash shot"
	)

	await _physics_frames(35)
	var reverse_shot_damage := _dummy.max_health - _dummy.health
	var expected_reverse_damage := _knight.get_hero_soul_manager().scale_active_damage(
		BOW.spirit_action.damage
	)
	_expect(
		reverse_shot_damage == expected_reverse_damage,
		(
			"Standing Dash Archer applies the canonical reverse-shot damage (got %d)"
			% reverse_shot_damage
		),
	)
	_dummy.global_position = _knight.global_position + Vector2(20.0, 0.0)
	await _physics_frames(75)
	_expect(
		(
			is_instance_valid(avatar)
			and relay.state == HeroSoulManager.RelayState.READY
			and relay.ready_seconds_left > 0.0
		),
		"Archer visual and unconfirmed Ready opportunity remain live shortly before two seconds",
	)
	await _physics_frames(22)
	_expect(
		(
			not is_instance_valid(avatar)
			and relay.state == HeroSoulManager.RelayState.IDLE
			and relay.support_cooldown_left <= 0.0
		),
		"Dash Archer fades after two seconds without adding a second cooldown"
	)
	_expect(
		not _knight.request_action("soul_relay_1"),
		"Q cannot take over after the Dash Archer window expires"
	)

	_expect(
		_knight.configure_soul_team_from_run(
			{"active_hero": "sword_hero", "reserve_souls": ["archer_hero"]}
		),
		"Dash takeover scenario resets Sword with Archer Reserve"
	)
	weapon_manager.reset_all_cooldowns()
	_knight.dash_cooldown_remaining = 0.0
	_knight.call(&"_set_stamina", _knight.max_stamina)
	_knight.call(&"_update_facing", Vector2.RIGHT)
	var takeover_origin := Vector2(-64.0, 24.0)
	_knight.global_position = takeover_origin
	_dummy.global_position = takeover_origin + Vector2(20.0, 0.0)
	_expect(_knight.request_action("dash"), "Second Dash creates an Archer ready for takeover")
	var takeover_avatar := _knight.get("_soul_support_visual") as AnimatedSprite2D
	_expect(
		_knight.request_action("soul_relay_1"), "Q arms the Archer Soul during the outgoing Dash"
	)
	_expect(relay.confirm_soul_skill(), "confirmation starts the Archer support summon")
	await _physics_frames(12)
	_expect(relay.takeover_open, "the first authored Archer takeover window is open")
	_expect(
		_knight.request_action("soul_relay_1"), "Q completes takeover inside its authored window"
	)
	await _physics_frames(1)
	_expect(
		(
			relay.active_hero == ARCHER
			and relay.reserve_soul == SWORD
			and _knight.get_weapon_manager().get_hand_weapon() == BOW
		),
		(
			"Arm, confirm, and timed Q switch the active Hero to Archer (active=%s state=%s takeover=%s)"
			% [
				String(relay.active_hero.hero_id) if relay.active_hero != null else "none",
				String(relay.get_state_name()),
				str(relay.takeover_open),
			]
		)
	)
	_expect(
		(
			_knight.global_position.is_equal_approx(relay.summon_position)
			and _knight.current_action.is_empty()
			and not is_instance_valid(takeover_avatar)
		),
		(
			"Dash takeover lands at the standing Archer and cancels the outgoing Dash "
			+ (
				"(position=%s action=%s avatar_valid=%s)"
				% [
					str(_knight.global_position),
					_knight.current_action,
					str(is_instance_valid(takeover_avatar)),
				]
			)
		)
	)


func _test_sword_threat_visual_and_q_takeover() -> void:
	var relay := _knight.get_hero_soul_manager()
	_expect(
		relay.active_hero == ARCHER and relay.reserve_soul == SWORD,
		"Sword trigger fixture starts from Archer Active and Sword Reserve"
	)
	_knight.call(&"_cancel_action_for_live_equip")
	var trigger_origin := Vector2(36.0, -20.0)
	_knight.global_position = trigger_origin
	_dummy.global_position = trigger_origin + Vector2(24.0, 0.0)
	_dummy.reset()
	GameEvents.melee_threat_emitted.emit(
		&"sword_wrong_target", _dummy, self, _dummy.global_position, 100.0
	)
	GameEvents.melee_threat_emitted.emit(
		&"sword_too_far", _dummy, _knight, trigger_origin + Vector2(400.0, 0.0), 500.0
	)
	_expect(relay.readiness_count == 0, "invalid Sword threats do not advance the live trigger")
	for index: int in 3:
		GameEvents.melee_threat_emitted.emit(
			StringName("live_sword_threat_%d" % index),
			_dummy,
			_knight,
			_dummy.global_position,
			100.0
		)
	_expect(
		(
			relay.state == HeroSoulManager.RelayState.READY
			and relay.readiness_count == relay.get_effective_ready_requirement()
		),
		"third live melee threat makes Sword Ready without summoning early"
	)
	_expect(_knight.request_action("soul_relay_1"), "Q materializes the Ready Sword support")
	var summon_snapshot := relay.get_state_snapshot()
	_expect(
		(
			relay.state == HeroSoulManager.RelayState.SUMMONING
			and String(summon_snapshot.summon_context) == "manual_q"
		),
		"Sword support summon starts with its real input context"
	)
	await _physics_frames(1)
	var effect := _knight.get("_soul_support_visual") as SoulInterceptionEffect
	var anchors: Array = effect.get("_anchors") if is_instance_valid(effect) else []
	var anchor := anchors[0] as Node if not anchors.is_empty() else null
	var ghost := (
		anchor.get_node_or_null("ResidualLayer01") as AnimatedSprite2D if anchor != null else null
	)
	_expect(
		(
			is_instance_valid(effect)
			and is_instance_valid(ghost)
			and ghost.name == "ResidualLayer01"
			and ghost.animation == &"sword_combo_1"
			and ghost.sprite_frames.has_animation(&"sword_combo_4")
		),
		(
			(
				"Soul Interception renders its dedicated anchored Sword silhouette "
				+ "(effect=%s anchors=%d ghost=%s animation=%s)"
			)
			% [
				str(is_instance_valid(effect)),
				anchors.size(),
				str(ghost.name if ghost != null else "<null>"),
				String(ghost.animation) if ghost != null else "<null>",
			]
		)
	)
	_expect(
		_knight.request_action("attack", _dummy.global_position),
		"Archer may still be inside a shot when Sword becomes takeable"
	)
	await _physics_frames(25)
	_expect(relay.takeover_open, "Sword takeover opens after its authored 0.4-second anticipation")
	Input.action_press(&"soul_relay_1")
	await _physics_frames(1)
	Input.action_release(&"soul_relay_1")
	await _physics_frames(1)
	_expect(
		(
			relay.active_hero == SWORD
			and relay.reserve_soul == ARCHER
			and _knight.get_weapon_manager().get_hand_weapon().weapon_id == &"sword"
			and _knight.get_active_character_form_id() == &"free_knight"
		),
		"one Q during the Sword visual atomically changes Hero, Hand weapon, and character form"
	)
	_expect(
		(
			_knight.global_position.is_equal_approx(relay.summon_position)
			and _knight.current_action.is_empty()
			and _knight.get("_soul_support_visual") == null
		),
		(
			"Sword takeover cancels the Archer shot, lands at the moving visual, and cleans it up "
			+ (
				"(player=%s summon=%s action=%s visual=%s)"
				% [
					str(_knight.global_position),
					str(relay.summon_position),
					_knight.current_action,
					str(_knight.get("_soul_support_visual")),
				]
			)
		)
	)


func _physics_frames(count: int) -> void:
	for _frame: int in count:
		await get_tree().physics_frame


func _expected_normal_damage(step: int, focus_stage: int = 0) -> int:
	var focus_bonus := 0
	if step == 3:
		focus_bonus = ARCHER.archer_piercer_focus_damage_bonus[clampi(
			focus_stage, 0, ARCHER.archer_focus_max
		)]
	return _knight.get_hero_soul_manager().scale_active_action_damage(
		&"normal_attack", ARCHER.combo_damage(step) + focus_bonus
	)


func _advanced_archer_save_snapshot() -> Dictionary:
	var snapshot := _baseline_save_snapshot()
	var soul := (
		HERO_SOUL_RULES
		. create_instance(
			&"archer_hero",
			HERO_SOUL_RULES.Rarity.EPIC,
			1,
			&"archer_combat_test_advanced",
			81003,
			HERO_SOUL_RULES.AFFINITY_RANGER,
		)
	)
	# This fixture selects the Advanced kit without adding unrelated affix or
	# equipment power. Rank/cost/damage still come from the live projection.
	soul["affixes"] = []
	(snapshot["inventory"] as Dictionary)["hero_souls"] = [soul]
	snapshot["soul_team"] = {
		"active_hero": "archer_hero",
		"reserve_souls": [""],
		"selected_soul_instances": {"archer_hero": String(soul["instance_id"])},
	}
	return snapshot


func _baseline_save_snapshot() -> Dictionary:
	return {
		"progression":
		{
			"player":
			{
				"level": 1,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
				"skill_allocations":
				{
					"sword_hero": PROGRESSION.empty_skill_tracks(),
					"archer_hero": PROGRESSION.empty_skill_tracks(),
				},
			}
		},
		"inventory": {"hero_souls": [], "auxiliary_equipment": []},
		"auxiliary_loadout": {"soul_vessel": "", "soul_boots": "", "soul_trace": ""},
	}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error(message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"scope":
		(
			"Playable Archer values, mouse-selected aim, buffered LMB shots, Soul Mark, "
			+ "Clear Shot, Archer Dash takeover, and live Sword trigger/visual takeover"
		),
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("ARCHER HERO COMBAT TEST PASSED - %d checks" % _checks)
	else:
		print("ARCHER HERO COMBAT TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
