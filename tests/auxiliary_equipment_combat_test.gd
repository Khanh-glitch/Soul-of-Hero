extends SceneTree

const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const COMBAT_STATS := preload("res://game/meta/equipment/auxiliary_equipment_combat_stats.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const REPORT_PATH := "res://.artifacts/auxiliary_equipment_combat_report.json"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var items := _controlled_items()
	var equipped := _save_snapshot(items, true)
	var unequipped := _save_snapshot(items, false)
	_test_pure_projection(items, equipped, unequipped)
	_test_player_progression_projection(items)
	_test_active_and_reserve_manager(equipped, unequipped)
	_test_single_final_rounding()
	_finish()


func _test_pure_projection(items: Array, equipped: Dictionary, unequipped: Dictionary) -> void:
	for item: Dictionary in items:
		_expect(RULES.validate_item(item).is_empty(), "controlled combat fixture validates for %s" % item.get("slot", ""))

	var base := {"hp": 100.0, "damage": 20.0, "mana": 100.0}
	var empty_snapshot := COMBAT_STATS.derive_hero_snapshot(unequipped, SWORD, base)
	_expect_close(float(empty_snapshot.get("hp", 0.0)), 217.0397011979999, "level-seven baseline includes smooth HP growth")
	_expect_close(float(empty_snapshot.get("damage", 0.0)), 20.0, "level-seven baseline grants no automatic Power")
	_expect_close(float(empty_snapshot.get("mana", 0.0)), 158.519850599, "level-seven baseline includes smooth Mana growth")
	_expect_close(float(empty_snapshot.get("damage_multiplier", 0.0)), 1.0, "authored Power remains level-invariant without allocation")
	_expect((empty_snapshot.get("effect_hooks", []) as Array).is_empty(), "empty loadout emits no equipment effect hooks")

	var geared := COMBAT_STATS.derive_hero_snapshot(equipped, SWORD, base)
	_expect_close(float(geared.get("hp", 0.0)), 242.9324802818599, "Armor and Boots HP apply after smooth Max HP growth")
	_expect_close(float(geared.get("damage", 0.0)), 23.1, "Soul Trace raises Power through flat and percent equipment sources")
	_expect_close(float(geared.get("mana", 0.0)), 166.44584312895, "Soul Trace Mana percent applies after smooth Max Mana growth")
	_expect((geared.get("applied_modifiers", []) as Array).size() == 6, "only canonical flat/percent stat entries enter direct buckets")
	var hook_ids := _effect_hook_ids(geared)
	_expect(
		hook_ids == PackedStringArray([
			"cooldown_rate", "damage_reduction", "dash_cooldown_rate",
			"dash_speed_percent", "footwork_damage_reduction", "guard_while_attacking",
			"healing_received", "health_regen", "mana_efficiency", "mana_regen",
			"movement_speed", "movement_speed_percent",
		]),
		"every non-direct LIVE stat remains an explicit sourced effect hook"
	)
	for raw_hook: Variant in geared.get("effect_hooks", []):
		var hook := raw_hook as Dictionary
		_expect(
			String(hook.get("source_slot", "")).begins_with("soul_")
			and not String(hook.get("source_uuid", "")).is_empty()
			and String(hook.get("target_scope", "")) == "active_and_reserve_heroes",
			"each deferred effect hook keeps its exact item source and shared scope"
		)

	var dangling := equipped.duplicate(true)
	var dangling_loadout: Dictionary = dangling.get("auxiliary_loadout", {}).duplicate(true)
	dangling_loadout["soul_trace"] = "00000000-0000-0000-0000-000000000000"
	dangling["auxiliary_loadout"] = dangling_loadout
	var fail_closed := COMBAT_STATS.derive_hero_snapshot(dangling, SWORD, base)
	_expect_close(float(fail_closed.get("damage", 0.0)), 20.0, "dangling equipped UUID applies no equipment Power modifier")
	_expect(not (fail_closed.get("resolution_issues", PackedStringArray()) as PackedStringArray).is_empty(), "fail-closed resolution exposes a diagnostic issue")


func _test_player_progression_projection(items: Array) -> void:
	var progression_only := _progression_save_snapshot([], false)
	var authored := {"hp": 120.0, "damage": 30.0, "mana": 80.0}
	var progressed := COMBAT_STATS.derive_hero_snapshot(progression_only, SWORD, authored)
	_expect_close(float(progressed.get("hp", 0.0)), 604.5942124446902, "smooth levels and HP points scale authored HP without perks")
	_expect_close(float(progressed.get("damage", 0.0)), 83.64722300852068, "Power points scale authored attack power without level offense or perks")
	_expect_close(float(progressed.get("mana", 0.0)), 509.5581563061424, "smooth levels and Mana points scale authored Mana without perks")
	_expect_close(float(progressed.get("damage_multiplier", 0.0)), 2.7882407669506897, "full Power multiplier remains relative to authored Hero damage")
	_expect((progressed.get("applied_progression_modifiers", []) as Array).is_empty(), "base-stat progression emits no milestone modifiers")
	var progression_hook_ids := _effect_hook_ids_from(progressed.get("progression_effect_hooks", []))
	_expect(progression_hook_ids.is_empty(), "base-stat allocation emits no secondary-effect hooks")
	for raw_hook: Variant in progressed.get("progression_effect_hooks", []):
		var hook := raw_hook as Dictionary
		_expect(
			String(hook.get("source_kind", "")) == "player_stat_milestone"
			and String(hook.get("target_scope", "")) == "active_and_reserve_heroes"
			and int(hook.get("threshold", 0)) > 0,
			"every deferred progression milestone keeps source, threshold and team-wide scope"
		)

	var progression_and_gear := _progression_save_snapshot(items, true)
	var combined := COMBAT_STATS.derive_hero_snapshot(progression_and_gear, SWORD, authored)
	_expect_close(float(combined.get("hp", 0.0)), 657.6158073158185, "auxiliary HP applies after plain level and Stat Point growth")
	_expect_close(float(combined.get("damage", 0.0)), 89.92958415894672, "auxiliary Power preserves full allocated scaling")
	_expect_close(float(combined.get("mana", 0.0)), 535.0360641214495, "auxiliary Mana applies after full plain-stat progression")

	var malformed := _progression_save_snapshot([], false)
	(malformed["progression"]["player"] as Dictionary)["level"] = 1
	(malformed["progression"]["player"] as Dictionary)["stat_allocation"] = {"hp": 99, "damage": 0, "mana": 0}
	var failed_closed := COMBAT_STATS.derive_hero_snapshot(malformed, SWORD, authored)
	_expect_close(float(failed_closed.get("hp", 0.0)), 120.0, "overspent persisted Stat Points fail closed to authored HP")
	_expect_close(float(failed_closed.get("damage", 0.0)), 30.0, "invalid progression cannot leak a damage bonus")
	_expect(not (failed_closed.get("resolution_issues", PackedStringArray()) as PackedStringArray).is_empty(), "invalid persisted progression exposes a diagnostic issue")


func _test_active_and_reserve_manager(equipped: Dictionary, unequipped: Dictionary) -> void:
	var pure_projection := MANAGER_SCRIPT.project_hero_combat(
		equipped,
		SWORD,
		100.0,
		100.0
	)
	_expect_close(float(pure_projection.get("damage", 0.0)), 23.1, "pure Hero projection uses the canonical equipment Power buckets")
	_expect(int(pure_projection.get("formula_version", 0)) == 1, "pure Hero projection exposes the combat formula version")
	_expect(not (pure_projection.get("damage_request", {}) as Dictionary).is_empty(), "pure Hero projection is self-contained for Hub/UI consumers")

	var player := Node2D.new()
	root.add_child(player)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_team(player, SWORD, AXE), "production Active and Reserve Heroes configure for shared stats")
	_expect(manager.configure_combat_stats_from_save(unequipped, 100.0, 100.0), "manager accepts an empty SaveService snapshot projection")
	_expect(manager.scale_active_damage(20.0) == 20, "empty loadout receives no player-level offense")

	_expect(manager.configure_combat_stats_from_save(equipped, 100.0, 100.0), "manager refreshes from the equipped SaveService snapshot")
	var active := manager.get_active_combat_snapshot()
	var reserve := manager.get_reserve_combat_snapshot()
	_expect_close(float(active.get("hp", 0.0)), 242.9324802818599, "Active Hero receives smooth level growth and shared equipment HP")
	_expect_close(float(reserve.get("hp", 0.0)), 242.9324802818599, "Reserve Hero receives the same smooth growth and shared equipment HP")
	_expect_close(float(active.get("damage", 0.0)), 23.1, "Active Hero consumes shared auxiliary Power")
	_expect_close(float(reserve.get("damage", 0.0)), 23.1, "Reserve Hero consumes the same shared auxiliary Power")
	_expect_close(float(active.get("mana", 0.0)), 166.44584312895, "Active Hero receives smooth level growth and shared equipment Mana")
	_expect_close(float(reserve.get("mana", 0.0)), 166.44584312895, "Reserve Hero receives the same smooth growth and shared equipment Mana")
	_expect(manager.scale_hero_damage(SWORD.hero_id, 20.0) == 23, "Active Hero authored damage uses the full derived Power multiplier")
	_expect(manager.scale_hero_damage(AXE.hero_id, 20.0) == 23, "Reserve Hero authored damage uses its own Power snapshot")
	var runtime_effects: Dictionary = active.get("auxiliary_runtime_effects", {})
	_expect((runtime_effects.get("unsupported_effects", []) as Array).is_empty(), "all generated equipment stats have live runtime consumers")
	var defense_profile: Dictionary = active.get("defense_profile", {})
	var secondary_stats: Dictionary = active.get("secondary_stats", {})
	_expect_close(float(defense_profile.get("idle_damage_reduction_percent", -1.0)), 2.0, "projection exposes authoritative idle DR")
	_expect_close(float(defense_profile.get("moving_damage_reduction_percent", -1.0)), 5.0, "projection exposes Footwork-conditional DR")
	_expect_close(float(defense_profile.get("attacking_damage_reduction_percent", -1.0)), 7.0, "projection exposes Guard-conditional DR")
	_expect_close(float(defense_profile.get("moving_attacking_damage_reduction_percent", -1.0)), 10.0, "projection exposes the shared capped moving-attack DR")
	_expect_close(float(secondary_stats.get("health_regen_per_second", -1.0)), 2.672257283100459, "secondary projection converts regen percent and healing received into real HP per second")
	_expect_close(float(secondary_stats.get("movement_speed_percent", -1.0)), 15.0, "secondary projection exposes combined Boots movement")
	_expect_close(float(secondary_stats.get("mana_regen_per_second", -1.0)), 3.0, "secondary projection includes base and Jewelry Mana regeneration")
	_expect_close(float(secondary_stats.get("mana_cost_reduction_percent", -1.0)), 10.0, "secondary projection exposes live Mana efficiency")
	_expect_close(manager.active_move_speed(100.0), 115.0, "Boots primary and affix combine into movement speed")
	_expect_close(manager.active_dash_cooldown(4.0), 3.6, "Boots dash recovery reduces the real Dash clock")
	_expect_close(manager.active_dash_speed(100.0), 120.0, "Boots dash speed changes the real Dash velocity")
	_expect_close(manager.active_healing_amount(100.0), 110.0, "Armor healing received scales real healing")
	_expect(manager.mitigate_active_incoming_damage(100, false) == 98, "idle defense excludes conditional Footwork and Guard")
	_expect(manager.mitigate_active_incoming_damage(100, false, true) == 95, "Footwork applies only while movement is active")
	_expect(manager.mitigate_active_incoming_damage(100, true) == 93, "Guard applies during an action without inventing movement")
	_expect(manager.mitigate_active_incoming_damage(100, true, true) == 90, "moving during an action combines Footwork and Guard once")
	var idle_options := manager.build_active_incoming_damage_options(false)
	var moving_options := manager.build_active_incoming_damage_options(false, true)
	_expect_close(
		float((idle_options.get("damage_taken_multipliers", {}) as Dictionary).get("target/active_hero_soul_defense", 0.0)),
		0.98,
		"canonical context defaults movement to false for backward compatibility"
	)
	_expect_close(
		float((moving_options.get("damage_taken_multipliers", {}) as Dictionary).get("target/active_hero_soul_defense", 0.0)),
		0.95,
		"canonical context exposes the same movement-gated Footwork factor"
	)
	_expect_close(manager.active_skill_cooldown(10.0), 9.6, "Jewelry cooldown rate changes the real Active-Skill clock")
	_expect_close(manager.active_skill_mana_cost(100.0), 90.0, "Jewelry Mana efficiency changes the real resource cost")
	_expect_close(manager.active_mana_regen_per_second(), 3.0, "Jewelry Mana regeneration changes the live resource clock")
	var action_request := manager.build_hero_action_damage_request(
		SWORD.hero_id,
		&"normal_attack",
		20.0
	)
	var flat_bucket: Dictionary = action_request.get("flat_modifiers", {})
	var additive_bucket: Dictionary = action_request.get("additive_percent_modifiers", {})
	_expect_close(float(flat_bucket.get("auxiliary_damage_flat", 0.0)), 2.0, "Soul Trace flat damage occupies the flat bucket")
	_expect(not additive_bucket.has("level_damage_percent"), "player level has no damage bucket in a live action request")
	_expect_close(float(additive_bucket.get("auxiliary_damage_percent", 0.0)), 5.0, "auxiliary percent occupies the additive Power bucket")
	_expect_close(float(additive_bucket.get("allocated_power_percent", -1.0)), 0.0, "unallocated Power remains an explicit zero source")
	var action_preview := manager.preview_hero_action_damage(
		SWORD.hero_id,
		&"normal_attack",
		20.0
	)
	_expect(int(action_preview.get("expected_damage", 0)) == manager.scale_hero_action_damage(SWORD.hero_id, &"normal_attack", 20.0), "legacy action API equals resolver preview expectation")
	_expect_close(float(action_preview.get("expected_raw_damage", 0.0)), 23.1, "canonical preview applies equipment Power without level offense")
	_expect((active.get("damage_request", {}) as Dictionary) == pure_projection.get("damage_request", {}), "instance manager delegates snapshot math to the pure projection entry")

	_expect(manager.configure_combat_stats_from_save(unequipped, 100.0, 100.0), "manager accepts the unequip refresh")
	active = manager.get_active_combat_snapshot()
	reserve = manager.get_reserve_combat_snapshot()
	_expect_close(float(active.get("hp", 0.0)), 217.0397011979999, "unequip removes equipment while preserving Active Hero level HP")
	_expect_close(float(active.get("damage", 0.0)), 20.0, "unequip restores authored Power at every player level")
	_expect_close(float(reserve.get("mana", 0.0)), 158.519850599, "unequip removes equipment while preserving Reserve Hero level Mana")

	var authored_axe := AXE.duplicate(true) as HeroDefinition
	authored_axe.base_damage = 30
	_expect(manager.configure_team(player, SWORD, authored_axe), "Active Sword and authored-damage Axe configure for progression projection")
	_expect(
		manager.configure_combat_stats_from_save(_progression_save_snapshot([], false), 120.0, 80.0),
		"manager accepts account Stat Points without auxiliary equipment"
	)
	active = manager.get_active_combat_snapshot()
	reserve = manager.get_reserve_combat_snapshot()
	_expect_close(float(active.get("hp", 0.0)), 604.5942124446902, "Active Hero receives account-wide smooth level and HP-point progression")
	_expect_close(float(reserve.get("mana", 0.0)), 509.5581563061424, "Reserve Hero receives account-wide smooth level and Mana-point progression")
	_expect_close(float(active.get("damage", 0.0)), 55.76481533901379, "Sword keeps its authored base while receiving allocated Power")
	_expect_close(float(reserve.get("damage", 0.0)), 83.64722300852068, "Axe keeps its distinct authored base while receiving the same Power percentage")
	_expect(manager.scale_hero_damage(SWORD.hero_id, 20.0) == 56, "Active Sword attacks consume allocated Power")
	_expect(manager.scale_hero_damage(AXE.hero_id, 30.0) == 84, "Reserve Axe attacks consume allocated Power from its authored base")
	manager.queue_free()
	player.queue_free()


func _test_single_final_rounding() -> void:
	var items := _controlled_items()
	((items[2] as Dictionary)["primary"] as Dictionary)["value"] = 1.0
	var save := _save_snapshot(items, true)
	var tracks := PROGRESSION.empty_skill_tracks()
	tracks["normal_attack"] = 2
	var progression: Dictionary = save["progression"]
	var persisted_player: Dictionary = progression["player"]
	persisted_player["skill_allocations"] = {"sword_hero": tracks}

	var player := Node2D.new()
	root.add_child(player)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_team(player, SWORD, null), "single-round fixture configures Sword")
	_expect(manager.configure_combat_stats_from_save(save, 100.0, 100.0), "single-round fixture accepts fractional pipeline inputs")
	var preview := manager.preview_hero_action_damage(
		SWORD.hero_id,
		&"normal_attack",
		23.0
	)
	# (20 + 1 flat) * 1.05 gear * 1.15 action * 1.05 rank = 26.625375.
	# The retired two-round path produced round(round(25.3575) * 1.05) = 26.
	_expect_close(float(preview.get("expected_raw_damage", 0.0)), 26.625375, "fractional action keeps precision through the skill multiplier")
	_expect(int(preview.get("expected_damage", 0)) == 27, "fractional action rounds only once after every bucket")
	_expect(manager.scale_hero_action_damage(SWORD.hero_id, &"normal_attack", 23.0) == 27, "legacy runtime API consumes the same one-round preview")
	_expect(roundi(float(roundi(25.3575)) * 1.05) == 26, "fixture explicitly distinguishes the retired intermediate-round result")
	manager.queue_free()
	player.queue_free()

func _controlled_items() -> Array:
	var vessel := RULES.generate_item(&"soul_vessel", &"eternal", 7, 91001, &"combat_test")
	(vessel["primary"] as Dictionary)["value"] = 10.0
	vessel["affixes"] = [
		{"affix_id": "max_hp_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "damage_reduction", "unit": "percent", "value": 2.0},
		{"affix_id": "health_regen", "unit": "percent_per_second", "value": 1.0},
		{"affix_id": "healing_received", "unit": "percent", "value": 10.0},
		{"affix_id": "guard_while_attacking", "unit": "percent", "value": 5.0},
	]
	var boots := RULES.generate_item(&"soul_boots", &"eternal", 7, 91002, &"combat_test")
	(boots["primary"] as Dictionary)["value"] = 10.0
	boots["affixes"] = [
		{"affix_id": "movement_speed_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "dash_cooldown_rate", "unit": "percent", "value": 10.0},
		{"affix_id": "dash_speed_percent", "unit": "percent", "value": 20.0},
		{"affix_id": "footwork_damage_reduction", "unit": "percent", "value": 3.0},
		{"affix_id": "max_hp_from_boots_percent", "unit": "percent", "value": 2.0},
	]
	var trace := RULES.generate_item(&"soul_trace", &"eternal", 7, 91003, &"combat_test")
	(trace["primary"] as Dictionary)["value"] = 2.0
	trace["affixes"] = [
		{"affix_id": "damage_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "mana_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "mana_regen", "unit": "flat_per_second", "value": 1.0},
		{"affix_id": "cooldown_rate", "unit": "percent", "value": 4.0},
		{"affix_id": "mana_efficiency", "unit": "percent", "value": 10.0},
	]
	return [vessel, boots, trace]


func _save_snapshot(items: Array, equipped: bool) -> Dictionary:
	var loadout := {
		"soul_vessel": String((items[0] as Dictionary)["uuid"]) if equipped and items.size() >= 3 else "",
		"soul_boots": String((items[1] as Dictionary)["uuid"]) if equipped and items.size() >= 3 else "",
		"soul_trace": String((items[2] as Dictionary)["uuid"]) if equipped and items.size() >= 3 else "",
	}
	return {
		"progression": {"player": {"level": 7}},
		"inventory": {"auxiliary_equipment": items.duplicate(true)},
		"auxiliary_loadout": loadout,
	}


func _progression_save_snapshot(items: Array, equipped: bool) -> Dictionary:
	var snapshot := _save_snapshot(items, equipped)
	(snapshot["progression"]["player"] as Dictionary)["level"] = 20
	(snapshot["progression"]["player"] as Dictionary)["stat_allocation"] = {
		"hp": 10,
		"damage": 50,
		"mana": 40,
	}
	return snapshot


func _effect_hook_ids(snapshot: Dictionary) -> PackedStringArray:
	return _effect_hook_ids_from(snapshot.get("effect_hooks", []))


func _effect_hook_ids_from(hooks: Variant) -> PackedStringArray:
	var ids := PackedStringArray()
	if not hooks is Array:
		return ids
	for raw_hook: Variant in hooks:
		ids.append(String((raw_hook as Dictionary).get("effect_id", "")))
	ids.sort()
	return ids


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
		print("AUXILIARY EQUIPMENT COMBAT TEST PASSED - %d checks" % _checks)
	else:
		print("AUXILIARY EQUIPMENT COMBAT TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
