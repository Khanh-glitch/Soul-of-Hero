extends SceneTree

const RULES := preload("res://game/meta/progression/hero_skill_combat_rules.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const WEAPON_MANAGER_SCRIPT := preload("res://game/weapons/weapon_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const AXE_WEAPON: WeaponDefinition = preload("res://game/weapons/data/axe.tres")
const REPORT_PATH := "res://.artifacts/hero_skill_combat_rules_report.json"

var _checks := 0
var _failures: Array[String] = []


class RelayPlayer:
	extends Node2D

	func begin_soul_summon(_incoming: HeroDefinition, _attacker: Node) -> Vector2:
		return global_position + Vector2.RIGHT * 24.0

	func complete_soul_relay(
			_incoming: HeroDefinition,
			_outgoing: HeroDefinition,
			_destination: Vector2
	) -> bool:
		return true

	func finish_soul_support(_incoming: HeroDefinition) -> void:
		pass


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_curves_and_fail_closed_resolution()
	_test_identity_scoped_manager_and_relay()
	_test_weapon_cooldown_clock()
	_finish()


func _test_curves_and_fail_closed_resolution() -> void:
	var zero := RULES.snapshot_from_ranks(&"sword_hero", PROGRESSION.empty_skill_tracks())
	for field: String in [
		"normal_attack_damage_multiplier",
		"active_skill_damage_multiplier",
		"active_skill_cooldown_multiplier",
		"dash_cooldown_multiplier",
		"dash_distance_multiplier",
		"dash_invulnerability_multiplier",
		"soul_ready_window_multiplier",
		"soul_ready_radius_multiplier",
		"summon_skill_damage_multiplier",
		"departure_skill_damage_multiplier",
	]:
		_expect_close(float(zero.get(field, 0.0)), 1.0, "rank zero is an identity operation for %s" % field)
	_expect(int(zero.get("soul_ready_requirement_reduction", -1)) == 0, "rank zero never lowers Soul Ready threshold")

	var tracks := _tracks({
		"normal_attack": 4,
		"active_skill": 5,
		"dash": 8,
		"soul_ready_condition": 10,
		"summon_skill": 12,
		"departure_skill": 20,
	})
	var ranked := RULES.snapshot_from_ranks(&"sword_hero", tracks)
	_expect_close(float(ranked.normal_attack_damage_multiplier), 1.10, "Normal Attack grants +2.5 percent damage per rank")
	_expect_close(float(ranked.active_skill_damage_multiplier), 1.15, "Active Skill grants +3 percent damage per rank")
	_expect_close(float(ranked.active_skill_cooldown_multiplier), 0.925, "Active Skill grants 1.5 percent cooldown recovery per rank")
	_expect_close(float(ranked.dash_cooldown_multiplier), 0.90, "Dash rank changes its live cooldown")
	_expect_close(float(ranked.dash_distance_multiplier), 1.12, "Dash rank changes travel distance")
	_expect_close(float(ranked.dash_invulnerability_multiplier), 1.06, "Dash rank changes invulnerability time")
	_expect(int(ranked.soul_ready_requirement_reduction) == 1, "Soul Ready rank ten lowers the live threshold once")
	_expect_close(float(ranked.soul_ready_window_multiplier), 1.25, "Soul Ready ranks lengthen the opportunity window every rank")
	_expect_close(float(ranked.soul_ready_radius_multiplier), 1.10, "Soul Ready ranks increase condition radius every rank")
	_expect_close(float(ranked.summon_skill_damage_multiplier), 1.36, "Summon Skill grants +3 percent damage per rank")
	_expect_close(float(ranked.departure_skill_damage_multiplier), 1.60, "Departure Skill reaches +60 percent damage at rank twenty")

	var malformed := _save_snapshot(
		{"sword_hero": {"normal_attack": 20}},
		1
	)
	var failed_closed := RULES.snapshot_from_save(malformed, &"sword_hero")
	_expect_close(float(failed_closed.normal_attack_damage_multiplier), 1.0, "malformed/overspent persisted ranks grant no combat power")
	_expect(not (failed_closed.resolution_issues as PackedStringArray).is_empty(), "fail-closed skill resolution exposes diagnostics")


func _test_identity_scoped_manager_and_relay() -> void:
	var player := RelayPlayer.new()
	root.add_child(player)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	var sword_tracks := _tracks({
		"normal_attack": 4,
		"active_skill": 5,
		"dash": 8,
		"summon_skill": 12,
		"departure_skill": 20,
	})
	var axe_tracks := _tracks({
		"normal_attack": 10,
		"active_skill": 10,
		"dash": 4,
		"soul_ready_condition": 10,
		"summon_skill": 10,
		"departure_skill": 10,
	})
	var save := _save_snapshot({"sword_hero": sword_tracks, "axe_hero": axe_tracks})
	_expect(manager.configure_team(player, SWORD, AXE), "Sword active and Axe reserve configure")
	_expect(manager.configure_combat_stats_from_save(save, 100.0, 100.0), "manager accepts persisted per-Identity ranks")
	var sword_core_damage := manager.scale_hero_damage(&"sword_hero", 20.0)
	var axe_core_damage := manager.scale_hero_damage(&"axe_hero", 20.0)
	_expect(sword_core_damage == 20 and axe_core_damage == 20, "player level never changes shared Power before per-Hero skill ranks")
	var sword_snapshot := manager.get_combat_snapshot(&"sword_hero")
	_expect(int(sword_snapshot.get("formula_version", 0)) == 1, "Hero snapshot exposes the canonical combat formula version")
	_expect(not (sword_snapshot.get("damage_request", {}) as Dictionary).is_empty(), "Hero snapshot stores its self-contained damage request")
	_expect(not (sword_snapshot.get("damage_breakdown", []) as Array).is_empty(), "Hero snapshot stores the resolver bucket breakdown")

	var sword_normal_request := manager.build_hero_action_damage_request(
		&"sword_hero", &"normal_attack", 20.0
	)
	var generic_percent: Dictionary = sword_normal_request.get("additive_percent_modifiers", {})
	var unique: Dictionary = sword_normal_request.get("unique_multipliers", {})
	_expect(not generic_percent.has("level_damage_percent"), "level damage is absent from every Hero action request")
	_expect_close(float(generic_percent.get("allocated_power_percent", -1.0)), 0.0, "zero allocated Power remains an explicit additive source")
	_expect_close(float(unique.get("skill_track_multiplier", 0.0)), 1.10, "Normal rank occupies a named unique multiplier")
	_expect_close(float(unique.get("weapon_damage_percent", 0.0)), 1.0, "baseline weapon power remains an explicit unique multiplier")
	_expect_close(float(sword_normal_request.get("action_multiplier", 0.0)), 1.0, "authored base damage produces an identity action ratio")
	var contextual_request := manager.build_hero_action_damage_request(
		&"sword_hero",
		&"normal_attack",
		20.0,
		{
			"flat_modifiers": {"temporary_edge": 3.0},
			"additive_percent_modifiers": {"party_aura": 10.0},
			"unique_multipliers": {"boss_window": 1.2},
		},
	)
	var contextual_flat: Dictionary = contextual_request.get("flat_modifiers", {})
	var contextual_additive: Dictionary = contextual_request.get("additive_percent_modifiers", {})
	var contextual_unique: Dictionary = contextual_request.get("unique_multipliers", {})
	_expect_close(float(contextual_flat.get("context/temporary_edge", 0.0)), 3.0, "new flat content plugs into the named context bucket")
	_expect_close(float(contextual_additive.get("context/party_aura", 0.0)), 10.0, "new generic percent content plugs into the additive bucket")
	_expect_close(float(contextual_unique.get("context/boss_window", 0.0)), 1.2, "new independent content plugs into the unique multiplier bucket")
	var static_action := MANAGER_SCRIPT.project_hero_action_damage(
		save,
		SWORD,
		&"normal_attack",
		SWORD.combo_damage(4),
		{
			"additive_percent_modifiers": {"party_aura": 10.0},
			"defense": {"rating": 35.0},
		},
	)
	var live_static_equivalent := manager.preview_hero_action_damage(
		&"sword_hero",
		&"normal_attack",
		SWORD.combo_damage(4),
		{
			"additive_percent_modifiers": {"party_aura": 10.0},
			"defense": {"rating": 35.0},
		},
	)
	_expect(
		int(static_action.get("expected_damage", 0))
		== int(live_static_equivalent.get("expected_damage", -1)),
		"pure action projection and live manager use the identical request pipeline",
	)
	_expect(
		(static_action.get("request", {}) as Dictionary)
		== manager.build_hero_action_damage_request(
			&"sword_hero",
			&"normal_attack",
			SWORD.combo_damage(4),
			{
				"additive_percent_modifiers": {"party_aura": 10.0},
				"defense": {"rating": 35.0},
			},
		),
		"pure projection exposes the exact self-contained live request",
	)
	_expect(
		MANAGER_SCRIPT.project_hero_action_damage(save, null, &"normal_attack", 20.0).is_empty()
		and MANAGER_SCRIPT.project_hero_action_damage(save, SWORD, &"normal_attack", NAN).is_empty(),
		"pure action projection fails closed for missing Hero or non-finite authored damage",
	)
	_expect(
		int(manager.preview_hero_action_damage(&"sword_hero", &"normal_attack", 20.0, {
			"flat_modifiers": {"temporary_edge": 3.0},
			"additive_percent_modifiers": {"party_aura": 10.0},
			"unique_multipliers": {"boss_window": 1.2},
		}).get("expected_damage", 0))
		> int(manager.preview_hero_action_damage(&"sword_hero", &"normal_attack", 20.0).get("expected_damage", 0)),
		"context extension buckets affect the same canonical preview without formula changes",
	)

	var sword_normal_preview := manager.preview_hero_action_damage(
		&"sword_hero", &"normal_attack", 20.0
	)
	var axe_normal_preview := manager.preview_hero_action_damage(
		&"axe_hero", &"normal_attack", 20.0
	)
	var sword_active_preview := manager.preview_hero_action_damage(
		&"sword_hero", &"active_skill", 20.0
	)
	var axe_active_preview := manager.preview_hero_action_damage(
		&"axe_hero", &"active_skill", 20.0
	)
	var sword_summon_preview := manager.preview_hero_action_damage(
		&"sword_hero", &"summon_skill", 20.0
	)
	var axe_departure_preview := manager.preview_hero_action_damage(
		&"axe_hero", &"departure_skill", 20.0
	)
	_expect(manager.scale_hero_action_damage(&"sword_hero", &"normal_attack", 20.0) == int(sword_normal_preview["expected_damage"]), "legacy Sword Normal API equals canonical preview expectation")
	_expect(manager.scale_hero_action_damage(&"axe_hero", &"normal_attack", 20.0) == int(axe_normal_preview["expected_damage"]), "legacy Axe Normal API equals canonical preview expectation")
	_expect(manager.scale_hero_action_damage(&"sword_hero", &"active_skill", 20.0) == int(sword_active_preview["expected_damage"]), "legacy Sword Active API equals canonical preview expectation")
	_expect(manager.scale_hero_action_damage(&"axe_hero", &"active_skill", 20.0) == int(axe_active_preview["expected_damage"]), "legacy Axe Active API equals canonical preview expectation")
	_expect(manager.scale_hero_action_damage(&"sword_hero", &"summon_skill", 20.0) == int(sword_summon_preview["expected_damage"]), "legacy reserve Summon API equals canonical preview expectation")
	_expect(manager.scale_hero_action_damage(&"axe_hero", &"departure_skill", 20.0) == int(axe_departure_preview["expected_damage"]), "legacy reserve Departure API equals canonical preview expectation")
	_expect(int(sword_normal_preview["expected_damage"]) == 22, "Sword Normal rank resolves after Power with one final round")
	_expect(int(axe_normal_preview["expected_damage"]) == 25, "Axe uses its own independent Normal rank")
	_expect(int(sword_active_preview["expected_damage"]) == 23, "Sword Active rank changes canonical damage")
	_expect(int(axe_active_preview["expected_damage"]) == 26, "Axe Active rank remains Identity-scoped")
	_expect(int(sword_summon_preview["expected_damage"]) == 27, "reserve Sword Summon rank is live before Relay")
	_expect(int(axe_departure_preview["expected_damage"]) == 26, "Axe Departure rank is live while reserve")

	var target_options := {
		"variance_percent": 10.0,
		"critical_chance_percent": 100.0,
		"critical_multiplier": 2.0,
		"damage_taken_multipliers": {"test_target_resistance": 0.5},
		"defense": {"rating": 100.0},
	}
	var deterministic_hit := manager.resolve_hero_action_hit(
		&"sword_hero",
		&"normal_attack",
		20.0,
		{"variance_roll": 1.0, "critical_roll": 1.0},
		target_options
	)
	var repeated_hit := manager.resolve_hero_action_hit(
		&"sword_hero",
		&"normal_attack",
		20.0,
		{"variance_roll": 1.0, "critical_roll": 1.0},
		target_options
	)
	_expect(deterministic_hit == repeated_hit, "explicit rolls and options resolve deterministically")
	_expect(bool(deterministic_hit.get("is_critical", false)), "explicit one-hundred-percent crit remains critical at roll one")
	_expect_close(float(deterministic_hit.get("raw_damage", 0.0)), 12.1, "target options enter variance, crit, damage-taken, and defense buckets")
	_expect(int(deterministic_hit.get("damage", 0)) == 12, "resolved target hit rounds once after the complete pipeline")
	_expect_close(manager.active_skill_cooldown(12.0), 11.10, "active Sword cooldown consumes Sword Active rank")
	_expect_close(manager.active_dash_cooldown(2.0), 1.80, "active Sword dash cooldown consumes Sword Dash rank")
	_expect_close(manager.active_dash_speed(265.0), 296.8, "active Sword dash distance consumes Sword Dash rank")
	_expect(manager.get_effective_ready_requirement() == 2, "reserve Axe Soul Ready rank lowers Crowd Pressure from three to two")
	_expect(not manager.update_crowd_pressure(1, true), "one hostile is below the ranked Axe threshold")
	_expect(manager.update_crowd_pressure(2, true), "two hostiles satisfy the ranked Axe threshold")
	_expect_close(manager.ready_seconds_left, 0.3125, "ranked Axe readiness uses the longer live window")

	_expect(manager.request_soul_relay(), "ranked reserve Axe starts its real summon state")
	manager.call("_process", 0.15)
	_expect(manager.takeover_open, "Axe authored takeover window still opens")
	_expect(manager.request_soul_relay(), "Relay completes inside the takeover window")
	_expect(manager.active_hero == AXE and manager.reserve_soul == SWORD, "Identity-scoped rank snapshots survive active/reserve exchange")
	_expect(manager.scale_active_action_damage(&"normal_attack", 20.0) == roundi(float(axe_core_damage) * 1.25), "new active Axe immediately consumes Axe Normal rank")
	_expect_close(manager.active_skill_cooldown(8.0), 6.8, "new active Axe immediately consumes Axe Active cooldown rank")
	manager.queue_free()
	player.queue_free()


func _test_weapon_cooldown_clock() -> void:
	var manager := WEAPON_MANAGER_SCRIPT.new() as WeaponManager
	root.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_loadout(AXE_WEAPON, [], false), "WeaponManager accepts Axe for cooldown integration")
	_expect(manager.request_hand_skill({"cooldown_multiplier": 0.70}), "ranked cooldown request starts through the authoritative WeaponManager clock")
	_expect_close(
		manager.get_hand_skill_cooldown_remaining(&"axe"),
		AXE_WEAPON.hand_skill.cooldown_seconds * 0.70,
		"WeaponManager stores the rank-shortened authored cooldown"
	)
	manager.queue_free()


func _tracks(overrides: Dictionary = {}) -> Dictionary:
	var result := PROGRESSION.empty_skill_tracks()
	for key: Variant in overrides:
		result[String(key)] = int(overrides[key])
	return result


func _save_snapshot(allocations: Dictionary, level := 100) -> Dictionary:
	return {
		"progression": {
			"player": {
				"level": level,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
				"skill_allocations": allocations.duplicate(true),
			}
		},
		"inventory": {"auxiliary_equipment": []},
		"auxiliary_loadout": {"soul_vessel": "", "soul_boots": "", "soul_trace": ""},
	}


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.4f, got %.4f)" % [message, expected, actual])


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
	print("HERO SKILL COMBAT RULES TEST %s - %d checks" % ["PASSED" if _failures.is_empty() else "FAILED", _checks])
	quit(0 if _failures.is_empty() else 1)
