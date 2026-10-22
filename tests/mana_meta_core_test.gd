extends SceneTree

const TEST_SAVE_PATH := "user://tests/mana_meta_core_test.json"
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const HERO_SKILL_KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_PROGRESSION := preload("res://game/meta/progression/hero_progression_rules.gd")

var _checks := 0
var _failures: Array[String] = []
var _toasts: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		_finish()
		return
	_remove_generations()
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated Mana/meta profile loads")
	_test_authored_contract()
	_test_feature_security(save)
	_test_plain_core_stats_and_equipment(save)
	await _test_live_knight_and_hud(save)
	_finish()


func _test_authored_contract() -> void:
	_expect(SWORD.validate().is_empty() and AXE.validate().is_empty(), "production Sword and Axe definitions remain valid")
	_expect(is_equal_approx(SWORD.active_skill_mana_cost, 10.0), "Sword enhancement owns an authored 10 Mana activation cost")
	_expect(is_equal_approx(AXE.resolved_active_skill_mana_cost(), 24.0), "Axe Throw resolves its authored 24 Mana cost from the primary Weapon skill")
	var invalid := SWORD.duplicate(true) as HeroDefinition
	invalid.active_skill_mana_cost = 0.0
	_expect(not invalid.validate().is_empty(), "an enabled Active Skill cannot silently omit its Mana cost")


func _test_feature_security(save: LivingArsenalSaveService) -> void:
	var souls: Array[Dictionary] = []
	for seed: int in [77101, 77102, 77103, 77104]:
		var soul := SOUL_RULES.create_instance(
			&"sword_hero", SOUL_RULES.Rarity.COMMON, 8, &"mana_meta", seed
		)
		souls.append(soul)
		_expect(save.grant_hero_soul(soul, "test:mana_meta:grant:%d" % seed), "fixture Hero Soul %d grants" % seed)
	_expect(save.transact_once(
		"test:mana_meta:gold",
		func(candidate: Dictionary) -> bool:
			candidate["currencies"]["account"] = 5000
			return true
	), "fixture receives deterministic fusion Gold")
	var fusion_ids: Array[String] = []
	for index: int in 3:
		fusion_ids.append(String(souls[index]["instance_id"]))
	var sale_id := String(souls[3]["instance_id"])
	var inventory_before := (save.get_value(["inventory", "hero_souls"], []) as Array).size()
	var gold_before := int(save.get_value(["currencies", "account"], 0))
	_expect(not save.sell_hero_soul(sale_id, "test:mana_meta:sell_locked"), "raw level/inventory cannot bypass the Level 8 Sell feature")
	_expect(not save.fuse_hero_souls(fusion_ids, 77200, "test:mana_meta:fuse_locked"), "raw level/inventory cannot bypass the Level 10 Fusion feature")
	_expect((save.get_value(["inventory", "hero_souls"], []) as Array).size() == inventory_before, "rejected meta actions consume no Soul")
	_expect(int(save.get_value(["currencies", "account"], 0)) == gold_before, "rejected meta actions consume or grant no Gold")
	var receipts: Dictionary = save.get_value(["applied_transactions"], {})
	_expect(not receipts.has("test:mana_meta:sell_locked") and not receipts.has("test:mana_meta:fuse_locked"), "rejected feature gates write no transaction receipt")

	_expect(_grant_features(save, ["hero_soul_sell"], "test:mana_meta:unlock_sell"), "explicit Level 8 Sell feature fixture grants")
	_expect(save.sell_hero_soul(sale_id, "test:mana_meta:sell_live"), "Sell succeeds after the exact feature is granted")
	_expect(not save.fuse_hero_souls(fusion_ids, 77201, "test:mana_meta:fuse_still_locked"), "Sell permission never implies Fusion permission")
	_expect(_grant_features(save, ["hero_soul_fusion"], "test:mana_meta:unlock_fusion"), "explicit Level 10 Fusion feature fixture grants")
	_expect(save.fuse_hero_souls(fusion_ids, 77202, "test:mana_meta:fuse_live"), "Fusion succeeds after the exact feature is granted")


func _test_plain_core_stats_and_equipment(save: LivingArsenalSaveService) -> void:
	var host := Node2D.new()
	var manager := HeroSoulManager.new()
	host.add_child(manager)
	root.add_child(host)
	manager.set_process(false)
	_expect(manager.configure_team(host, SWORD, AXE), "Hero manager accepts production Sword/Axe team")

	_expect(manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 0), 100.0, 100.0), "zero-point snapshot configures")
	_expect_close(manager.active_mana_regen_per_second(), 2.0, "level-one base Mana regeneration is live")
	_expect_close(manager.active_skill_mana_cost(SWORD.active_skill_mana_cost), 10.0, "zero-point Sword enhancement cost stays authored")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 10), 100.0, 100.0)
	_expect_close(manager.active_mana_regen_per_second(), 2.0, "Mana points increase only Max Mana, not hidden regeneration")
	_expect_close(float(manager.get_active_combat_snapshot().get("mana", 0.0)), float(_progression_snapshot(0, 0, 10).mana), "ten Mana points compose with level growth in the real Max Mana base")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 20), 100.0, 100.0)
	_expect_close(manager.active_skill_mana_cost(32.0), 32.0, "Mana points never hide an Active Skill cost reduction")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 30), 100.0, 100.0)
	_expect_close(manager.active_skill_cooldown(12.0), 12.0, "Mana points never hide Active Skill cooldown recovery")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 40), 100.0, 100.0)
	_expect_close(float(manager.get_active_combat_snapshot().get("mana", 0.0)), float(_progression_snapshot(0, 0, 40).mana), "Mana 40 applies only level growth and visible point returns")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 50), 100.0, 100.0)
	_expect_close(manager.active_mana_regen_per_second(), 2.0, "Mana 50 remains plain Max Mana growth with base regeneration")
	_expect_close(float(manager.get_active_combat_snapshot().get("mana", 0.0)), float(_progression_snapshot(0, 0, 50).mana), "Mana 50 preserves level growth and visible point returns")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 20, 0, 0), 100.0, 100.0)
	_expect(manager.mitigate_active_incoming_damage(100, false) == 100, "HP points increase only Max HP, not hidden Defense")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 40, 0), 100.0, 100.0)
	var damage_40_snapshot := _progression_snapshot(0, 40, 0)
	var expected_normal_damage := roundi(
		100.0 * float(damage_40_snapshot.damage) / PROGRESSION.BASE_DAMAGE
	)
	_expect(manager.scale_active_action_damage(&"normal_attack", 100.0) == expected_normal_damage, "Power points scale Normal Attack without borrowing the Active milestone")
	var active_kit := manager.get_active_skill_kit_snapshot()
	var active_ranks: Dictionary = active_kit.get("skill_ranks", {})
	var expected_active_damage := roundi(
		float(expected_normal_damage) * HERO_SKILL_KITS.effective_skill_multiplier(
			int(active_kit.get("rarity", 0)), int(active_ranks.get("active_1", 1))
		)
	)
	_expect(manager.scale_active_action_damage(&"active_skill", 100.0) == expected_active_damage, "Power and the equipped Hero Weapon rank compose visibly on Active Skill damage")
	var effects: Dictionary = manager.get_active_combat_snapshot().get("auxiliary_runtime_effects", {})
	var unsupported_ids := _effect_ids(effects.get("unsupported_effects", []))
	_expect(unsupported_ids.is_empty(), "legacy stat milestones stay out of the live three-core-stat projection")
	_expect(not JSON.stringify(effects).contains("player_stat_milestone"), "combat effects expose no hidden stat-milestone hooks")

	manager.configure_combat_stats_from_save(_jewelry_resource_affix_snapshot(save), 100.0, 100.0)
	_expect_close(manager.active_mana_regen_per_second(), 2.7, "Jewelry Mana Regen affix reaches the live resource clock")
	_expect_close(manager.active_skill_mana_cost(32.0), 29.76, "Jewelry Mana Efficiency reduces the real Active cost")
	var focus_effects: Dictionary = manager.get_active_combat_snapshot().get("auxiliary_runtime_effects", {})
	var focus_live_ids := _effect_ids(focus_effects.get("applied_live_effects", []))
	_expect("mana_regen" in focus_live_ids and "mana_efficiency" in focus_live_ids, "Jewelry resource affixes are truthfully reported LIVE")

	manager.configure_combat_stats_from_save(_stat_snapshot(save, 80, 0, 0), 100.0, 100.0)
	_expect(manager.mitigate_active_incoming_damage(100, false) == 100, "high HP allocation still adds no hidden Defense")
	manager.configure_combat_stats_from_save(_stat_snapshot(save, 125, 0, 0), 100.0, 100.0)
	_expect_close(float(manager.get_active_combat_snapshot().get("hp", 0.0)), float(_progression_snapshot(125, 0, 0).hp), "HP 125 composes level growth with its visible tier returns")
	manager.configure_combat_stats_from_save(_stat_snapshot(save, 0, 0, 125), 100.0, 100.0)
	_expect_close(float(manager.get_active_combat_snapshot().get("mana", 0.0)), float(_progression_snapshot(0, 0, 125).mana), "Mana 125 composes level growth with its visible tier returns")

	manager.configure_combat_stats_from_save(_cooldown_cap_snapshot(save), 100.0, 100.0)
	_expect_close(manager.active_skill_cooldown(12.0), 7.8, "skill rank and equipment cooldown recovery share the canonical 35% cap")
	host.queue_free()


func _test_live_knight_and_hud(save: LivingArsenalSaveService) -> void:
	var world := Node2D.new()
	root.add_child(world)
	# Load production scenes only after autoload singletons are registered. A
	# top-level preload in a --script test compiles Knight before GameEvents is a
	# known singleton and would turn a test-order artifact into a false failure.
	var knight_scene := load("res://game/characters/knight/knight.tscn") as PackedScene
	var knight: Variant = knight_scene.instantiate()
	world.add_child(knight)
	await process_frame
	await physics_frame
	knight.set_physics_process(false)
	var events := root.get_node("GameEvents")
	var toast_callback := func(message: String) -> void: _toasts.append(message)
	events.toast_requested.connect(toast_callback)

	var mana_points_50 := _stat_snapshot(save, 0, 0, 50)
	_expect(knight.refresh_auxiliary_equipment_from_save(mana_points_50), "live Knight accepts the plain Mana-50 combat projection")
	var sword_cost: float = float(knight.get_active_skill_mana_cost())
	var sword_rank_profile: Dictionary = knight.call(
		&"_active_hero_ranked_skill_profile", &"active_1"
	)
	var sword_rank_cooldown: float = float(knight.hero_soul_manager.active_skill_cooldown(
		float(sword_rank_profile.get("cooldown", 10.0))
	))
	knight.call(&"_set_mana", sword_cost - 1.0)
	var mana_before_reject: float = float(knight.mana)
	var resource_state: Dictionary = knight.get_realtime_state()["hero"]["mana"]
	_expect(
		is_equal_approx(float(resource_state.get("current", 0.0)), mana_before_reject)
		and is_equal_approx(float(resource_state.get("maximum", 0.0)), knight.max_mana)
		and is_equal_approx(float(resource_state.get("regen_per_second", 0.0)), 2.0)
		and not bool(resource_state.get("can_cast", true)),
		"realtime snapshot exposes current/max Mana, regeneration, cost readiness"
	)
	_expect(not knight.request_action("skill"), "Sword Soul Echo refuses an insufficient-Mana cast")
	_expect_close(knight.mana, mana_before_reject, "rejected Sword cast spends no Mana")
	_expect(is_zero_approx(knight.soul_echo_cooldown_remaining), "rejected Sword cast starts no cooldown")
	_expect(not _toasts.is_empty() and "MANA" in _toasts[-1], "rejected Sword cast explains the Mana shortage")

	knight.call(&"_set_mana", knight.max_mana)
	var sword_before: float = float(knight.mana)
	_expect(knight.request_action("skill"), "Sword Soul Echo casts through the production action route")
	_expect_close(knight.mana, sword_before - sword_cost, "successful Sword cast spends its resolved cost exactly once")
	_expect(is_zero_approx(knight.soul_echo_cooldown_remaining) and bool(knight.get_realtime_state()["hero"]["soul_echo_active"]), "successful Sword cast starts the persistent effect without starting cooldown")
	knight.call(&"_cancel_soul_echo", &"test")
	_expect_close(
		knight.soul_echo_cooldown_remaining,
		sword_rank_cooldown,
		"cancelling the Sword enhancement starts its Hero Weapon rank cooldown",
	)
	knight.soul_echo_cooldown_remaining = 0.0

	_expect(knight.configure_soul_team_from_run({
		"active_hero": "axe_hero",
		"reserve_souls": ["sword_hero", ""],
	}), "live Knight switches to Axe Hero")
	_expect(knight.refresh_auxiliary_equipment_from_save(mana_points_50), "Axe receives the same account-wide Mana-50 projection")
	knight.get_weapon_manager().reset_all_cooldowns()
	knight.current_action = ""
	var axe_cost: float = float(knight.get_active_skill_mana_cost())
	knight.call(&"_set_mana", axe_cost - 1.0)
	var axe_reject_before: float = float(knight.mana)
	_expect(not knight.request_action("skill"), "Axe Throw refuses an insufficient-Mana cast")
	_expect_close(knight.mana, axe_reject_before, "rejected Axe Throw spends no Mana")
	_expect_close(knight.get_weapon_manager().get_hand_skill_cooldown_remaining(&"axe"), 0.0, "rejected Axe Throw starts no cooldown")

	knight.call(&"_set_mana", knight.max_mana)
	var axe_before: float = float(knight.mana)
	_expect(knight.request_action("skill"), "Axe Throw casts through the production action route")
	_expect_close(knight.mana, axe_before - axe_cost, "successful Axe Throw spends its resolved cost exactly once")
	_expect(knight.is_axe_away(), "successful Axe cast creates the real outbound weapon")
	var before_recall: float = float(knight.mana)
	_expect(knight.request_action("skill"), "Axe Recall accepts the second skill press")
	_expect_close(knight.mana, before_recall, "Axe Recall remains completely free")
	knight.call(&"_clear_axe_throw_runtime")
	knight.current_action = ""

	knight.call(&"_set_mana", 0.0)
	knight.call(&"_tick_timers", 2.0)
	_expect_close(knight.mana, 4.0, "live Knight keeps the base 2 Mana per second despite Mana allocation")
	knight.call(&"_set_mana", 17.0)
	knight.kill()
	_expect(not knight.dead and knight.hero_soul_manager.active_hero.hero_id == &"sword_hero", "active Hero death immediately transfers control to the living reserve")
	knight.respawn()
	_expect(not knight.dead and is_equal_approx(knight.mana, knight.max_mana), "respawn restores full Mana")
	_expect_close(knight.soul_echo_cooldown_remaining, 0.0, "respawn clears Active-Skill cooldown state")

	var focus_snapshot := _jewelry_and_soul_snapshot(save)
	knight.call(&"_set_mana", knight.max_mana)
	_expect(knight.refresh_auxiliary_equipment_from_save(focus_snapshot), "Jewelry/Hero Weapon projection reaches live Knight")
	var current_hero: HeroDefinition = knight.hero_soul_manager.active_hero
	var expected_max := float(HeroSoulManager.project_hero_combat(
		focus_snapshot, current_hero, current_hero.base_max_hp, current_hero.base_max_mana,
	).get("mana", 0.0))
	_expect_close(knight.max_mana, expected_max, "live equipment refresh preserves the current member of the fixed two-Hero team")
	_expect_close(knight.mana, knight.max_mana, "live Max Mana refresh preserves a full resource ratio")

	root.size = Vector2i(640, 360)
	var hud_scene := load("res://game/ui/HUD.tscn") as PackedScene
	var hud := hud_scene.instantiate() as CanvasLayer
	root.add_child(hud)
	await process_frame
	hud.call(&"_on_player_registered", knight)
	knight.call(&"_set_mana", 17.0)
	await process_frame
	_expect((hud.get_node("%ManaValue") as Label).text == "17/%d" % roundi(knight.max_mana), "production HUD shows current/max Mana numerically")
	_expect((hud.get_node("%ManaBar") as ProgressBar).value == 17.0, "production HUD Mana bar reads the live resource")
	hud.call(&"_sync_hero_hud")
	_expect("MANA" in (hud.get_node("%HandStatus") as Label).text, "Hero-aware skill panel exposes Mana cost/shortage")
	for logical_size: Vector2i in [Vector2i(640, 360), Vector2i(698, 360)]:
		root.size = logical_size
		await process_frame
		var panel := hud.get_node("HUDRoot/TopLeftPanel") as Control
		var mana_row := hud.get_node("HUDRoot/TopLeftPanel/Stats/ManaRow") as Control
		_expect(panel.get_global_rect().end.x <= float(logical_size.x) and panel.get_global_rect().end.y <= float(logical_size.y), "Mana HUD panel stays on-screen at %dx%d logical" % [logical_size.x, logical_size.y])
		_expect(mana_row.visible and mana_row.size.y >= 10.0, "Mana row remains readable at %dx%d logical" % [logical_size.x, logical_size.y])

	if events.toast_requested.is_connected(toast_callback):
		events.toast_requested.disconnect(toast_callback)
	hud.queue_free()
	world.queue_free()
	await process_frame


func _stat_snapshot(
		save: LivingArsenalSaveService,
		hp_points: int,
		damage_points: int,
		mana_points: int
) -> Dictionary:
	var snapshot := save.get_snapshot()
	var player: Dictionary = snapshot["progression"]["player"]
	var spent := hp_points + damage_points + mana_points
	player["level"] = maxi(1, ceili(float(spent) / float(PROGRESSION.STAT_POINTS_PER_LEVEL)))
	player["stat_allocation"] = {"hp": hp_points, "damage": damage_points, "mana": mana_points}
	player["skill_allocations"] = {}
	snapshot["progression"]["player"] = player
	var records: Dictionary = snapshot["progression"].get("heroes", {}).duplicate(true)
	for hero_id: String in ["sword_hero", "axe_hero"]:
		var record := HERO_PROGRESSION.empty_record(StringName(hero_id))
		record["level"] = player["level"]
		record["stat_allocation"] = {"hp": hp_points, "damage": damage_points, "mana": mana_points}
		record["skill_allocations"] = PROGRESSION.empty_skill_tracks()
		records[hero_id] = record
	snapshot["progression"]["heroes"] = records
	return snapshot


func _progression_snapshot(hp_points: int, damage_points: int, mana_points: int) -> Dictionary:
	var spent := hp_points + damage_points + mana_points
	var level := maxi(1, ceili(float(spent) / float(PROGRESSION.STAT_POINTS_PER_LEVEL)))
	var record := HERO_PROGRESSION.empty_record(&"sword_hero")
	record["level"] = level
	record["stat_allocation"] = {"hp": hp_points, "damage": damage_points, "mana": mana_points}
	var stats := HERO_PROGRESSION.combat_stats(&"sword_hero", record)
	return {"hp": stats.max_hp, "damage": stats.power, "mana": stats.max_mana}


func _jewelry_and_soul_snapshot(save: LivingArsenalSaveService) -> Dictionary:
	var snapshot := _stat_snapshot(save, 0, 0, 0)
	snapshot["progression"]["player"]["level"] = 7
	var focus := AUX_RULES.generate_item(&"soul_trace", &"normal", 7, 77301, &"mana_meta")
	snapshot["inventory"]["auxiliary_equipment"] = [focus]
	snapshot["auxiliary_loadout"]["soul_trace"] = String(focus["uuid"])
	snapshot["hero_loadouts"]["axe_hero"] = {
		"hero_weapon": "", "armor": "", "boots": "", "jewelry": String(focus["uuid"]),
	}
	var soul := SOUL_RULES.create_instance(
		&"axe_hero", SOUL_RULES.Rarity.MAGIC, 7, &"mana_meta_soul", 77302
	)
	soul["affixes"] = [{"affix_id": "max_mana", "value": 8.0}]
	soul["equipped"] = true
	var inventory: Array = snapshot["inventory"]["hero_souls"]
	for raw: Variant in inventory:
		if raw is Dictionary:
			(raw as Dictionary)["equipped"] = false
	inventory.append(soul)
	snapshot["inventory"]["hero_souls"] = inventory
	snapshot["soul_team"]["active_hero"] = "axe_hero"
	snapshot["soul_team"]["reserve_souls"] = ["sword_hero", ""]
	snapshot["soul_team"]["selected_soul_instances"]["axe_hero"] = String(soul["instance_id"])
	snapshot["hero_loadouts"]["axe_hero"]["hero_weapon"] = String(soul["instance_id"])
	return snapshot


func _cooldown_cap_snapshot(save: LivingArsenalSaveService) -> Dictionary:
	var snapshot := _stat_snapshot(save, 0, 0, 30)
	snapshot["progression"]["player"]["level"] = 100
	var sword_tracks := PROGRESSION.empty_skill_tracks()
	sword_tracks["active_skill"] = 20
	snapshot["progression"]["player"]["skill_allocations"] = {"sword_hero": sword_tracks}
	var focus := AUX_RULES.generate_item(&"soul_trace", &"magic", 30, 77303, &"mana_meta_cap")
	focus["affixes"] = [{
		"affix_id": "cooldown_rate",
		"unit": "percent",
		"value": 6.0,
	}]
	snapshot["inventory"]["auxiliary_equipment"] = [focus]
	snapshot["auxiliary_loadout"]["soul_trace"] = String(focus["uuid"])
	snapshot["hero_loadouts"]["sword_hero"]["jewelry"] = String(focus["uuid"])
	return snapshot


func _jewelry_resource_affix_snapshot(save: LivingArsenalSaveService) -> Dictionary:
	var snapshot := _stat_snapshot(save, 0, 0, 0)
	snapshot["progression"]["player"]["level"] = 30
	var focus := AUX_RULES.generate_item(&"soul_trace", &"rare", 30, 77304, &"mana_meta_jewelry_live")
	focus["affixes"] = [
		{"affix_id": "mana_regen", "unit": "flat_per_second", "value": 0.7},
		{"affix_id": "mana_efficiency", "unit": "percent", "value": 7.0},
	]
	snapshot["inventory"]["auxiliary_equipment"] = [focus]
	snapshot["auxiliary_loadout"]["soul_trace"] = String(focus["uuid"])
	snapshot["hero_loadouts"]["sword_hero"]["jewelry"] = String(focus["uuid"])
	return snapshot


func _grant_features(save: LivingArsenalSaveService, ids: Array[String], key: String) -> bool:
	return save.transact_once(
		key,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var features: Dictionary = progression.get("features", {})
			for feature_id: String in ids:
				features[feature_id] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true
	)


func _effect_ids(raw_effects: Variant) -> Array[String]:
	var result: Array[String] = []
	if not raw_effects is Array:
		return result
	for raw: Variant in raw_effects:
		if raw is Dictionary:
			result.append(String((raw as Dictionary).get("effect_id", "")))
	return result


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(absf(actual - expected) <= 0.02, "%s (actual %.3f, expected %.3f)" % [message, actual, expected])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _remove_generations() -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var path := TEST_SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func _finish() -> void:
	_remove_generations()
	if _failures.is_empty():
		print("MANA META CORE TEST PASSED — %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("MANA META CORE FAIL: %s" % failure)
	quit(1)
