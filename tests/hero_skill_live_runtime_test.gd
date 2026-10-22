extends Node

const KNIGHT_SCENE: PackedScene = preload("res://game/characters/knight/knight.tscn")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE_REAPER_DROP_SCENE: PackedScene = preload("res://game/heroes/axe/axe_reaper_drop.tscn")
const AXE_LAST_ORBIT_SCENE: PackedScene = preload("res://game/heroes/axe/axe_last_orbit.tscn")
const SWORD_SUMMON_SCENE: PackedScene = preload("res://game/heroes/sword/soul_interception.tscn")
const SWORD_DEPARTURE_SCENE: PackedScene = preload("res://game/heroes/sword/returning_blade.tscn")
const REPORT_PATH := "res://.artifacts/hero_skill_live_runtime_report.json"

var _checks := 0
var _failures: Array[String] = []
var _world: Node2D
var _knight: KnightController
var _dummy: DamageDummy


class DamageDummy:
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
		shape.radius = 7.0
		collision.shape = shape
		add_child(collision)

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> void:
		health = maxi(0, health - amount)

	func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
		stagger_received += amount

	func reset_health() -> void:
		health = max_health
		stagger_received = 0.0


func start(_app_root: Node) -> void:
	_run.call_deferred()


func _run() -> void:
	_world = Node2D.new()
	_world.name = "HeroSkillLiveRuntimeWorld"
	add_child(_world)
	_knight = KNIGHT_SCENE.instantiate() as KnightController
	_world.add_child(_knight)
	_knight.global_position = Vector2.ZERO
	_dummy = DamageDummy.new()
	_dummy.name = "HeroSkillDamageDummy"
	_dummy.add_to_group(&"enemies")
	_world.add_child(_dummy)
	_dummy._target = _knight
	await _physics_frames(3)

	await _test_axe_normal_active_and_dash_hits()
	await _test_live_readiness_and_relay_identity()
	_test_axe_summon_and_departure_hits()
	_test_sword_summon_and_departure_hits()
	_test_sword_active_cooldown_and_damage_projection()
	_finish()


func _test_axe_normal_active_and_dash_hits() -> void:
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "axe_hero", "reserve_souls": ["sword_hero"]}),
		"real Knight configures Axe active and Sword reserve"
	)
	var zero := _save_snapshot(_tracks(), _tracks())
	var ranked_axe := _tracks({
		"normal_attack": 10,
		"active_skill": 10,
		"dash": 10,
		"soul_ready_condition": 10,
		"summon_skill": 10,
		"departure_skill": 10,
	})
	var ranked := _save_snapshot(_tracks(), ranked_axe)
	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "real Knight consumes a rank-zero SaveService-shaped snapshot")
	var expected_zero_normal_hit := _knight.scale_hero_action_damage(&"axe_hero", &"normal_attack", 30.0)

	_dummy.global_position = Vector2(28.0, -8.0)
	_dummy.reset_health()
	var before := _dummy.health
	_expect(_knight.request_action("attack"), "rank-zero Axe starts its real quick cleave")
	await _physics_frames(32)
	var zero_normal_hit := before - _dummy.health
	_expect(zero_normal_hit == expected_zero_normal_hit, "rank-zero Axe quick cleave preserves authored damage without automatic level offense")

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "real Knight refreshes allocated Axe ranks without mutating content resources")
	var expected_ranked_normal_hit := _knight.scale_hero_action_damage(&"axe_hero", &"normal_attack", 30.0)
	_dummy.reset_health()
	before = _dummy.health
	_expect(_knight.request_action("attack"), "rank-ten Axe starts the same real quick cleave")
	await _physics_frames(32)
	var ranked_normal_hit := before - _dummy.health
	_expect(ranked_normal_hit == expected_ranked_normal_hit and ranked_normal_hit > zero_normal_hit, "Normal Attack rank multiplies the level-scaled confirmed hit")

	# Throw & Recall is a real physics projectile. Keep the dummy on the outbound
	# path and read the health delta before automatic/manual return can hit again.
	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Axe can return to a rank-zero runtime projection")
	var expected_zero_active_hit := _knight.scale_hero_action_damage(&"axe_hero", &"active_skill", 26.0)
	_knight.get_weapon_manager().reset_all_cooldowns()
	_knight.call(&"_set_mana", _knight.max_mana)
	_dummy.global_position = Vector2(64.0, -8.0)
	_dummy.reset_health()
	before = _dummy.health
	_expect(_knight.request_action("skill"), "rank-zero Axe launches the real Throw & Recall effect")
	await _physics_frames(14)
	var zero_active_hit := before - _dummy.health
	_expect(zero_active_hit == expected_zero_active_hit, "rank-zero Throw & Recall preserves its authored outbound hit without automatic level offense")
	_expect_close(
		_knight.get_weapon_manager().get_hand_skill_cooldown_remaining(&"axe") + 14.0 / 60.0,
		6.5,
		"rank-zero Axe starts the authored 6.5-second cooldown clock",
		0.04
	)
	_dummy.global_position = Vector2(400.0, 400.0)
	await _physics_frames(8)
	_knight.request_action("skill")
	await _physics_frames(55)

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "allocated Active rank refreshes on the same live Axe")
	var expected_ranked_active_hit := _knight.scale_hero_action_damage(&"axe_hero", &"active_skill", 26.0)
	_knight.get_weapon_manager().reset_all_cooldowns()
	_knight.call(&"_set_mana", _knight.max_mana)
	_dummy.global_position = Vector2(64.0, -8.0)
	_dummy.reset_health()
	before = _dummy.health
	_expect(_knight.request_action("skill"), "rank-ten Axe launches the same Throw & Recall effect")
	var ranked_cooldown_start := _knight.get_weapon_manager().get_hand_skill_cooldown_remaining(&"axe")
	await _physics_frames(14)
	var ranked_active_hit := before - _dummy.health
	_expect(ranked_active_hit == expected_ranked_active_hit and ranked_active_hit > zero_active_hit, "Active Skill rank multiplies the level-scaled projectile hit")
	_expect_close(ranked_cooldown_start, 5.525, "Active Skill rank shortens the real Axe cooldown from 6.5 to 5.525 seconds")
	_dummy.global_position = Vector2(400.0, 400.0)
	await _physics_frames(8)
	_knight.request_action("skill")
	await _physics_frames(55)

	# Compare the values captured at the exact instant the semantic Dash begins.
	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Dash baseline restores rank zero")
	_knight.dash_cooldown_remaining = 0.0
	_expect(_knight.request_action("dash"), "rank-zero semantic Dash begins")
	var zero_dash_cooldown := _knight.dash_cooldown_remaining
	var zero_dash_speed := _knight.velocity.length()
	var zero_dash_iframes := _knight.invulnerability_remaining
	await _physics_frames(14)
	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Dash ranks refresh on live Axe")
	_knight.dash_cooldown_remaining = 0.0
	_expect(_knight.request_action("dash"), "rank-ten semantic Dash begins")
	_expect_close(zero_dash_cooldown, 2.0, "rank-zero Dash keeps the authored cooldown")
	_expect_close(_knight.dash_cooldown_remaining, 1.75, "Dash rank shortens live cooldown")
	_expect_close(zero_dash_speed, 265.0, "rank-zero Dash keeps authored travel speed")
	_expect_close(_knight.velocity.length(), 304.75, "Dash rank increases live travel distance through speed")
	_expect_close(zero_dash_iframes, 0.18, "rank-zero Dash keeps authored invulnerability")
	_expect_close(_knight.invulnerability_remaining, 0.1935, "Dash rank lengthens live invulnerability")
	await _physics_frames(14)


func _test_live_readiness_and_relay_identity() -> void:
	var zero := _save_snapshot(_tracks(), _tracks())
	var axe_ranked := _tracks({"soul_ready_condition": 10, "normal_attack": 10})
	var ranked := _save_snapshot(_tracks(), axe_ranked)
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "sword_hero", "reserve_souls": ["axe_hero"]}),
		"real Knight configures Sword active and Axe reserve for Crowd Pressure"
	)
	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "rank-zero readiness snapshot applies")
	var manager := _knight.get_hero_soul_manager()
	_expect(manager.get_effective_ready_requirement() == 3, "rank-zero live Axe requires three nearby hostiles")
	var second_hostile := DamageDummy.new()
	second_hostile.name = "HeroSkillSecondCrowdHostile"
	second_hostile.add_to_group(&"enemies")
	second_hostile._target = _knight
	_world.add_child(second_hostile)
	_dummy._target = _knight
	_dummy.global_position = _knight.global_position + Vector2(28.0, 0.0)
	second_hostile.global_position = _knight.global_position + Vector2(-28.0, 0.0)
	await _physics_frames(10)
	_expect(manager.state == HeroSoulManager.RelayState.IDLE, "two real nearby attackers cannot satisfy rank-zero Crowd Pressure")

	# Reconfigure clears the failed live pressure snapshot before applying ranks.
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "sword_hero", "reserve_souls": ["axe_hero"]}),
		"team reset clears prior readiness state"
	)
	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "rank-ten reserve Axe readiness applies")
	manager = _knight.get_hero_soul_manager()
	_expect(manager.get_effective_ready_requirement() == 2, "Soul Ready rank ten lowers the live threshold to two")
	await _physics_frames(10)
	_expect(manager.state == HeroSoulManager.RelayState.READY, "production Knight polling makes the same two attackers open Soul Ready")
	_expect_close(manager.get_effective_ready_window_seconds(), 0.3125, "Soul Ready rank lengthens the authored live Axe window")
	_expect(manager.ready_seconds_left > 0.0 and manager.ready_seconds_left <= 0.3125, "production readiness clock is actively ticking inside the ranked window")
	_expect(manager.request_soul_relay(), "ranked Axe begins its real Reaper Drop summon")
	manager.call("_process", 0.15)
	_expect(manager.request_soul_relay(), "ranked Axe completes Relay inside its authored takeover window")
	_expect(manager.active_hero.hero_id == &"axe_hero", "Axe becomes the active live Hero")
	var relayed_axe_core := _knight.scale_hero_damage(&"axe_hero", 20.0)
	_expect(_knight.scale_hero_action_damage(&"axe_hero", &"normal_attack", 20.0) == roundi(float(relayed_axe_core) * 1.25), "Axe keeps its allocated Normal rank after reserve-to-active Relay")
	second_hostile.queue_free()


func _test_axe_summon_and_departure_hits() -> void:
	var zero := _save_snapshot(_tracks(), _tracks())
	var ranked := _save_snapshot(_tracks(), _tracks({"summon_skill": 10, "departure_skill": 10}))
	_dummy.global_position = Vector2(120.0, 40.0)

	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Axe Soul actions begin from rank zero")
	var expected_zero_summon_hit := _knight.scale_hero_action_damage(&"axe_hero", &"summon_skill", AXE.base_damage * 1.35)
	_dummy.reset_health()
	var before := _dummy.health
	var zero_summon := AXE_REAPER_DROP_SCENE.instantiate() as AxeReaperDropEffect
	_world.add_child(zero_summon)
	zero_summon.global_position = _dummy.global_position
	_expect(zero_summon.setup(_knight, AXE, _dummy), "rank-zero Reaper Drop effect configures")
	zero_summon.finish_now()
	var zero_summon_hit := before - _dummy.health
	_expect(zero_summon_hit == expected_zero_summon_hit, "rank-zero Reaper Drop confirms Power-scaled damage through CombatDamage")

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Axe Summon/Departure ranks refresh")
	var expected_ranked_summon_hit := _knight.scale_hero_action_damage(&"axe_hero", &"summon_skill", AXE.base_damage * 1.35)
	_dummy.reset_health()
	before = _dummy.health
	var ranked_summon := AXE_REAPER_DROP_SCENE.instantiate() as AxeReaperDropEffect
	_world.add_child(ranked_summon)
	ranked_summon.global_position = _dummy.global_position
	_expect(ranked_summon.setup(_knight, AXE, _dummy), "rank-ten Reaper Drop effect configures")
	ranked_summon.finish_now()
	var ranked_summon_hit := before - _dummy.health
	_expect(ranked_summon_hit == expected_ranked_summon_hit and ranked_summon_hit > zero_summon_hit, "Summon Skill rank multiplies the level-scaled Axe summon hit")

	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Axe Departure baseline restores rank zero")
	var expected_zero_departure_hit := _knight.scale_hero_action_damage(&"axe_hero", &"departure_skill", AXE.base_damage * 1.05)
	_dummy.reset_health()
	before = _dummy.health
	var zero_departure := AXE_LAST_ORBIT_SCENE.instantiate() as AxeLastOrbitEffect
	_world.add_child(zero_departure)
	_expect(zero_departure.setup(_knight, AXE, Vector2(80.0, 40.0), Vector2(160.0, 40.0)), "rank-zero Last Orbit configures")
	zero_departure.global_position = _dummy.global_position
	zero_departure.call("_confirm_path_hits")
	var zero_departure_hit := before - _dummy.health
	_expect(zero_departure_hit == expected_zero_departure_hit, "rank-zero Last Orbit confirms Power-scaled damage through CombatDamage")
	zero_departure.queue_free()

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Axe Departure rank refreshes")
	var expected_ranked_departure_hit := _knight.scale_hero_action_damage(&"axe_hero", &"departure_skill", AXE.base_damage * 1.05)
	_dummy.reset_health()
	before = _dummy.health
	var ranked_departure := AXE_LAST_ORBIT_SCENE.instantiate() as AxeLastOrbitEffect
	_world.add_child(ranked_departure)
	_expect(ranked_departure.setup(_knight, AXE, Vector2(80.0, 40.0), Vector2(160.0, 40.0)), "rank-ten Last Orbit configures")
	ranked_departure.global_position = _dummy.global_position
	ranked_departure.call("_confirm_path_hits")
	var ranked_departure_hit := before - _dummy.health
	_expect(ranked_departure_hit == expected_ranked_departure_hit and ranked_departure_hit > zero_departure_hit, "Departure Skill rank multiplies the level-scaled Axe departure hit")
	ranked_departure.queue_free()


func _test_sword_summon_and_departure_hits() -> void:
	var zero := _save_snapshot(_tracks(), _tracks())
	var ranked := _save_snapshot(_tracks({"summon_skill": 10, "departure_skill": 10}), _tracks())
	_dummy.global_position = Vector2(210.0, 40.0)

	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Sword Soul actions begin from rank zero")
	var expected_zero_summon_hit := (
		_knight.scale_hero_action_damage(&"sword_hero", &"summon_skill", SWORD.base_damage * 0.55)
		+ _knight.scale_hero_action_damage(&"sword_hero", &"summon_skill", SWORD.base_damage * 1.25)
	)
	_dummy.reset_health()
	var before := _dummy.health
	var zero_summon := SWORD_SUMMON_SCENE.instantiate() as SoulInterceptionEffect
	_world.add_child(zero_summon)
	zero_summon.global_position = _dummy.global_position
	zero_summon.setup(_knight, SWORD, _dummy)
	zero_summon.set_process(false)
	zero_summon.call("_process", 0.70)
	var zero_summon_hit := before - _dummy.health
	_expect(zero_summon_hit == expected_zero_summon_hit, "rank-zero Soul Interception confirms both level-scaled authored hits")
	zero_summon.finish_now()

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Sword Summon/Departure ranks refresh")
	var expected_ranked_summon_hit := (
		_knight.scale_hero_action_damage(&"sword_hero", &"summon_skill", SWORD.base_damage * 0.55)
		+ _knight.scale_hero_action_damage(&"sword_hero", &"summon_skill", SWORD.base_damage * 1.25)
	)
	_dummy.reset_health()
	before = _dummy.health
	var ranked_summon := SWORD_SUMMON_SCENE.instantiate() as SoulInterceptionEffect
	_world.add_child(ranked_summon)
	ranked_summon.global_position = _dummy.global_position
	ranked_summon.setup(_knight, SWORD, _dummy)
	ranked_summon.set_process(false)
	ranked_summon.call("_process", 0.70)
	var ranked_summon_hit := before - _dummy.health
	_expect(ranked_summon_hit == expected_ranked_summon_hit and ranked_summon_hit > zero_summon_hit, "Summon Skill rank multiplies both level-scaled Sword summon hits")
	ranked_summon.finish_now()

	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Sword Departure baseline restores rank zero")
	var expected_zero_departure_hit := _knight.scale_hero_action_damage(&"sword_hero", &"departure_skill", SWORD.base_damage * 0.9)
	_dummy.reset_health()
	before = _dummy.health
	var zero_departure := SWORD_DEPARTURE_SCENE.instantiate() as ReturningBladeEffect
	_world.add_child(zero_departure)
	zero_departure.setup(_knight, SWORD, Vector2(180.0, 40.0), Vector2(240.0, 40.0))
	zero_departure.global_position = _dummy.global_position
	zero_departure.call("_confirm_path_hits")
	var zero_departure_hit := before - _dummy.health
	_expect(zero_departure_hit == expected_zero_departure_hit, "rank-zero Returning Blade confirms its Power-scaled damage")
	zero_departure.queue_free()

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Sword Departure rank refreshes")
	var expected_ranked_departure_hit := _knight.scale_hero_action_damage(&"sword_hero", &"departure_skill", SWORD.base_damage * 0.9)
	_dummy.reset_health()
	before = _dummy.health
	var ranked_departure := SWORD_DEPARTURE_SCENE.instantiate() as ReturningBladeEffect
	_world.add_child(ranked_departure)
	ranked_departure.setup(_knight, SWORD, Vector2(180.0, 40.0), Vector2(240.0, 40.0))
	ranked_departure.global_position = _dummy.global_position
	ranked_departure.call("_confirm_path_hits")
	var ranked_departure_hit := before - _dummy.health
	_expect(ranked_departure_hit == expected_ranked_departure_hit and ranked_departure_hit > zero_departure_hit, "Departure Skill rank multiplies the level-scaled Sword departure hit")
	ranked_departure.queue_free()


func _test_sword_active_cooldown_and_damage_projection() -> void:
	var zero := _save_snapshot(_tracks(), _tracks())
	var ranked := _save_snapshot(_tracks({"active_skill": 10}), _tracks())
	_expect(
		_knight.configure_soul_team_from_run({"active_hero": "sword_hero", "reserve_souls": ["axe_hero"]}),
		"real Knight returns to Sword active for Soul Echo"
	)
	_expect(_knight.refresh_auxiliary_equipment_from_save(zero), "Sword Active baseline restores rank zero")
	_knight.call(&"_set_mana", _knight.max_mana)
	_expect(_knight.request_action("skill"), "rank-zero Sword activates the real Soul Echo node")
	_expect_close(_knight.soul_echo_cooldown_remaining, 0.0, "rank-zero enhancement stays active without starting cooldown")
	_knight.call("_cancel_soul_echo", &"test")
	_expect_close(_knight.soul_echo_cooldown_remaining, 10.0, "rank-zero enhancement starts its authored cooldown when cancelled")
	_knight.soul_echo_cooldown_remaining = 0.0

	_expect(_knight.refresh_auxiliary_equipment_from_save(ranked), "Sword Active rank refreshes")
	_knight.call(&"_set_mana", _knight.max_mana)
	_expect(_knight.request_action("skill"), "rank-ten Sword activates the same real Soul Echo node")
	_expect_close(_knight.soul_echo_cooldown_remaining, 0.0, "rank-ten enhancement remains active indefinitely")
	var ranked_sword_core := _knight.scale_hero_damage(&"sword_hero", 20.0)
	_expect(_knight.scale_hero_action_damage(&"sword_hero", &"active_skill", 20.0) == roundi(float(ranked_sword_core) * 1.30), "Sword Active Skill rank multiplies its Power-scaled damage input")
	_knight.call("_cancel_soul_echo", &"test")
	_expect_close(_knight.soul_echo_cooldown_remaining, 8.5, "Active Skill rank shortens the cooldown that begins on cancellation")


func _tracks(overrides: Dictionary = {}) -> Dictionary:
	var result := PROGRESSION.empty_skill_tracks()
	for key: Variant in overrides:
		result[String(key)] = int(overrides[key])
	return result


func _save_snapshot(sword_tracks: Dictionary, axe_tracks: Dictionary) -> Dictionary:
	return {
		"progression": {
			"player": {
				"level": 100,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
				"skill_allocations": {
					"sword_hero": sword_tracks.duplicate(true),
					"axe_hero": axe_tracks.duplicate(true),
				},
			}
		},
		"inventory": {"auxiliary_equipment": []},
		"auxiliary_loadout": {"soul_vessel": "", "soul_boots": "", "soul_trace": ""},
	}


func _physics_frames(count: int) -> void:
	for _frame: int in count:
		await get_tree().physics_frame


func _expect_close(actual: float, expected: float, message: String, tolerance := 0.001) -> void:
	_expect(absf(actual - expected) <= tolerance, "%s (expected %.4f, got %.4f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error(message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify({
			"ok": _failures.is_empty(),
			"checks": _checks,
			"failures": _failures,
		}, "\t") + "\n")
		report.close()
	print("HERO SKILL LIVE RUNTIME TEST %s - %d checks" % ["PASSED" if _failures.is_empty() else "FAILED", _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
