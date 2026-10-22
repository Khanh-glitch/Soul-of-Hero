extends Node

const REPORT_PATH := "res://.artifacts/hero_soul_instance_knight_runtime_report.json"
const RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const SWORD_HERO: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")

var _checks := 0
var _failures: Array[String] = []


func start(_game: Node2D) -> void:
	_run.call_deferred()


func _run() -> void:
	await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	_expect(knight != null, "live gameplay Knight is available")
	if knight == null:
		_finish()
		return
	knight.set_physics_process(false)
	var soul_a := _soul_a()
	var soul_b := _soul_b()
	_expect(SaveService.grant_hero_soul(soul_a, "test:instance_knight:grant_a"), "live profile receives first Sword Soul copy")
	_expect(SaveService.grant_hero_soul(soul_b, "test:instance_knight:grant_b"), "live profile receives second Sword Soul copy")
	_expect(
		SaveService.select_hero_soul_instance(String(soul_a["instance_id"]), "test:instance_knight:select_a"),
		"live profile selects first exact copy"
	)
	_expect(
		knight.configure_soul_team_from_run(SaveService.get_value(["soul_team"], {})),
		"live Knight consumes full selected Soul state"
	)
	var first := knight.get_combat_stat_snapshot()
	var eternal_level_20_weapon_multiplier := RULES.weapon_damage_percent(
		RULES.Rarity.ETERNAL,
		20,
	) / 100.0
	var expected_first_damage := float(SWORD_HERO.base_damage) \
		* 1.05 * eternal_level_20_weapon_multiplier
	var expected_first_normal_attack := roundi(
		float(roundi(float(SWORD_HERO.combo_damage(1)) * 1.05 \
			* eternal_level_20_weapon_multiplier)) * 1.07
	)
	_expect(knight.max_health == 105, "first selected Soul changes live Knight Max HP")
	_expect(is_equal_approx(knight.max_mana, 108.0), "first selected Soul changes live Knight Max Mana")
	_expect_close(float(first.get("damage", 0.0)), expected_first_damage, "first selected Soul composes core Power, its Eternal weapon percentage and core-damage affix")
	_expect(
		int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) \
			== expected_first_normal_attack,
		"first selected Soul applies weapon percentage and melee affix to an actual Knight normal attack"
	)

	_expect(
		SaveService.select_hero_soul_instance(String(soul_b["instance_id"]), "test:instance_knight:select_b"),
		"live profile switches to the second same-Identity copy"
	)
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "live Knight refreshes after exact-copy switch")
	var second := knight.get_combat_stat_snapshot()
	_expect(knight.max_health == 100 and is_equal_approx(knight.max_mana, 100.0), "switch removes the previous copy's live HP and Mana")
	_expect_close(float(second.get("damage", 0.0)), float(SWORD_HERO.base_damage) * eternal_level_20_weapon_multiplier, "switch removes the previous core-damage affix while preserving the selected Eternal weapon percentage")
	_expect_close(knight.get_hero_soul_manager().active_skill_cooldown(10.0), 9.6, "second copy changes live Active Skill cooldown")
	_expect(
		String(second.get("selected_hero_soul_instance_id", "")) == String(soul_b["instance_id"]),
		"live Knight snapshot exposes the exact second instance"
	)

	knight.health = knight.max_health
	knight.invulnerability_remaining = 0.0
	knight.current_action = ""
	_expect(knight.take_damage(100), "live Knight accepts an idle incoming hit")
	_expect(knight.health == 7, "unconditional defense reduces an actual live incoming hit")
	knight.dead = false
	knight.process_mode = Node.PROCESS_MODE_INHERIT
	knight.health = knight.max_health
	knight.invulnerability_remaining = 0.0
	knight.current_action = "axe_cleave"
	_expect(knight.take_damage(100), "live Knight accepts a hit during an attack action")
	_expect(knight.health == 11, "defense_while_attacking reduces an actual live attack-time hit")
	knight.dead = false
	knight.process_mode = Node.PROCESS_MODE_INHERIT
	knight.health = knight.max_health
	knight.invulnerability_remaining = 0.0
	knight.current_action = ""
	var health_before_zero_hit := knight.health
	_expect(
		not knight.take_damage(0)
			and knight.health == health_before_zero_hit
			and is_zero_approx(knight.invulnerability_remaining)
			and knight.current_action.is_empty(),
		"legacy Knight entry rejects zero damage without triggering hurt state or iframes",
	)
	_expect(
		not knight.take_resolved_damage(0)
			and knight.health == health_before_zero_hit
			and is_zero_approx(knight.invulnerability_remaining)
			and knight.current_action.is_empty(),
		"canonical Knight entry rejects zero damage without triggering hurt state or iframes",
	)
	var enemy := Node.new()
	enemy.set_meta(ENEMY_SCALER.DAMAGE_MULTIPLIER_META, 1.35)
	var canonical_hit := ENEMY_SCALER.apply_authored_damage_hit(enemy, knight, 13)
	_expect(bool(canonical_hit.get("used_canonical_target_seam", false)), "enemy hit discovers Knight's canonical incoming context handshake")
	_expect(int(canonical_hit.get("damage", 0)) == 16 and knight.health == 84, "live Knight applies difficulty and seven-percent defense with one final round")
	_expect(StringName(canonical_hit.get("applied_damage_method", &"")) == &"take_resolved_damage", "canonical enemy hit bypasses Knight's legacy mitigation entry point")
	enemy.free()
	_test_live_auxiliary_effects(knight)
	_finish()


func _test_live_auxiliary_effects(knight: KnightController) -> void:
	_expect(SaveService.grant_player_levels(6, "test:instance_knight:aux_level"), "live fixture reaches all three auxiliary slots")
	var vessel := AUX_RULES.generate_item(&"soul_vessel", &"rare", 7, 98211, &"instance_knight_aux")
	vessel["affixes"] = [
		{"affix_id": "health_regen", "unit": "percent_per_second", "value": 0.5},
		{"affix_id": "damage_reduction", "unit": "percent", "value": 3.0},
	]
	var boots := AUX_RULES.generate_item(&"soul_boots", &"magic", 7, 98212, &"instance_knight_aux")
	(boots["primary"] as Dictionary)["value"] = 4.0
	boots["affixes"] = [
		{"affix_id": "movement_speed_percent", "unit": "percent", "value": 5.0},
	]
	var trace := AUX_RULES.generate_item(&"soul_trace", &"magic", 7, 98213, &"instance_knight_aux")
	trace["affixes"] = [
		{"affix_id": "cooldown_rate", "unit": "percent", "value": 6.0},
	]
	_expect(SaveService.grant_auxiliary_equipment(vessel, "test:instance_knight:grant_vessel"), "live profile receives regen/defense Vessel")
	_expect(SaveService.grant_auxiliary_equipment(boots, "test:instance_knight:grant_boots"), "live profile receives movement Boots")
	_expect(SaveService.grant_auxiliary_equipment(trace, "test:instance_knight:grant_trace"), "live profile receives cooldown Jewelry")
	_expect(SaveService.equip_auxiliary_equipment(String(vessel["uuid"]), "test:instance_knight:equip_vessel"), "live profile equips effect Vessel")
	_expect(SaveService.equip_auxiliary_equipment(String(boots["uuid"]), "test:instance_knight:equip_boots"), "live profile equips effect Boots")
	_expect(SaveService.equip_auxiliary_equipment(String(trace["uuid"]), "test:instance_knight:equip_trace"), "live profile equips effect Jewelry")
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "live Knight consumes auxiliary effect hooks")
	var manager := knight.get_hero_soul_manager()
	_expect_close(manager.active_skill_cooldown(10.0), 9.0, "Soul and auxiliary cooldown recovery combine and cap on live skill cooldown")
	_expect(manager.mitigate_active_incoming_damage(100, false) == 90, "auxiliary damage reduction combines with Soul defense")
	_expect(manager.mitigate_active_incoming_damage(100, true) == 86, "combined attack-time defense remains deterministic")
	_expect_close(manager.active_move_speed(100.0), 109.0, "Boots primary and affix reach the live Knight movement clock")
	var effects: Dictionary = knight.get_combat_stat_snapshot().get("auxiliary_runtime_effects", {})
	_expect((effects.get("applied_live_effects", []) as Array).size() == 5, "snapshot reports all five auxiliary effect hooks as live")
	_expect((effects.get("unsupported_effects", []) as Array).is_empty(), "generated equipment exposes no fake or unsupported stat")
	knight.dead = false
	knight.health = maxi(1, knight.max_health - 10)
	var before_regen := knight.health
	knight.call(&"_regenerate_health", 5.0)
	_expect(knight.health > before_regen, "health_regen restores actual live Knight HP over time")


func _soul_a() -> Dictionary:
	var soul: Dictionary = RULES.create_instance(
		&"sword_hero", RULES.Rarity.ETERNAL, 20, &"instance_knight_a", 98201,
		RULES.AFFINITY_WARRIOR
	)
	soul["affixes"] = [
		{"affix_id": "max_hp", "value": 5.0},
		{"affix_id": "core_damage", "value": 5.0},
		{"affix_id": "max_mana", "value": 8.0},
		{"affix_id": "melee_damage", "value": 7.0},
		{"affix_id": "active_power", "value": 7.0},
	]
	return soul


func _soul_b() -> Dictionary:
	var soul: Dictionary = RULES.create_instance(
		&"sword_hero", RULES.Rarity.ETERNAL, 20, &"instance_knight_b", 98202,
		RULES.AFFINITY_WARRIOR
	)
	soul["affixes"] = [
		{"affix_id": "summon_power", "value": 8.0},
		{"affix_id": "departure_power", "value": 8.0},
		{"affix_id": "cooldown_recovery", "value": 4.0},
		{"affix_id": "defense", "value": 7.0},
		{"affix_id": "defense_while_attacking", "value": 4.0},
	]
	return soul


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
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
	if _failures.is_empty():
		print("HERO SOUL INSTANCE KNIGHT RUNTIME TEST PASSED - %d checks" % _checks)
	else:
		print("HERO SOUL INSTANCE KNIGHT RUNTIME TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_audio_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_audio_cleanup(exit_code: int) -> void:
	# Granting the fixture levels intentionally exercises the live HUD, including
	# its authored level-up SFX. The dummy/headless mixer can retain that stream
	# when the process quits in the same frame, producing a nondeterministic
	# ObjectDB/resource leak after every functional assertion has passed.
	var scene := get_tree().current_scene
	if is_instance_valid(scene):
		for audio_node: Node in scene.find_children("*", "AudioStreamPlayer", true, false):
			(audio_node as AudioStreamPlayer).stop()
		for audio_node: Node in scene.find_children("*", "AudioStreamPlayer2D", true, false):
			(audio_node as AudioStreamPlayer2D).stop()
	await get_tree().create_timer(0.10, true, false, true).timeout
	# Keep this tiny test controller alive while the production scene, its live
	# loot, VFX and imported resources leave the tree. Relying on process exit to
	# tear them down made an otherwise green suite report intermittent ObjectDB
	# leaks when it followed another full-game test.
	if is_instance_valid(scene) and scene != self:
		reparent(get_tree().root)
		scene.queue_free()
		await get_tree().process_frame
		await get_tree().create_timer(0.10, true, false, true).timeout
	get_tree().quit(exit_code)
