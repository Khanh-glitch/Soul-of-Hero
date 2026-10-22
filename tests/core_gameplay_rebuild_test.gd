extends SceneTree

const SAVE_PATH := "user://tests/core_gameplay_rebuild.json"
const KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const SOUL_AFFIXES := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const RESOLVER := preload("res://game/combat/combat_resolver.gd")
const AUTHORED_ZONE := preload("res://game/combat/authored_skill_zone.gd")
const VFX := preload("res://game/vfx/vfx_catalog.gd")
const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUX_COMBAT := preload("res://game/meta/equipment/auxiliary_equipment_combat_stats.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const LEVEL_5_REWARD: RewardBundleDefinition = preload("res://data/content/rewards/chapter_1_level_5_reward.tres")
const LEVEL_20_REWARD: RewardBundleDefinition = preload("res://data/content/rewards/chapter_2_level_20_reward.tres")
const ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_skill_kits_and_base_stats()
	_test_visible_damage_contract()
	_test_authored_skill_assets()
	await _test_q_requires_confirm()
	_test_save_unlock_storage_and_xp()
	_test_campaign_shard_rewards()
	_finish()


func _test_skill_kits_and_base_stats() -> void:
	var expected_totals := [2, 4, 6, 2, 6, 2, 4, 6]
	for rarity: int in expected_totals.size():
		_expect(KITS.total_ranks_for_rarity(rarity) == expected_totals[rarity], "rarity %d has approved total skill ranks" % rarity)
		var ranks := KITS.roll_skill_ranks(rarity, 9127, "test_item")
		_expect(KITS.validate_skill_ranks(rarity, ranks), "rarity %d always rolls a valid 1-5 split" % rarity)
	_expect(
		KITS.effective_skill_multiplier(3, 1) > KITS.effective_skill_multiplier(2, 5),
		"Epic rank 1 remains stronger than Rare rank 5 because the active kit changes",
	)
	_expect(
		KITS.effective_skill_multiplier(5, 1) > KITS.effective_skill_multiplier(4, 5),
		"Crystal Legendary+ rank 1 remains stronger than Legendary rank 5",
	)
	var expected_stats := {
		"sword_hero": [1100.0, 20.0, 90.0, 1.0],
		"archer_hero": [850.0, 22.0, 90.0, 1.08],
		"axe_hero": [1450.0, 30.0, 70.0, 0.88],
		"wizard_hero": [800.0, 17.0, 140.0, 0.96],
	}
	for hero_id: String in expected_stats:
		var stats := KITS.base_stats(StringName(hero_id))
		var expected: Array = expected_stats[hero_id]
		_expect(is_equal_approx(float(stats.get("max_hp", 0.0)), expected[0]), "%s has approved base HP" % hero_id)
		_expect(is_equal_approx(float(stats.get("power", 0.0)), expected[1]), "%s has approved base Power" % hero_id)
		_expect(is_equal_approx(float(stats.get("max_mana", 0.0)), expected[2]), "%s has approved base Mana" % hero_id)
		_expect(is_equal_approx(float(stats.get("move_speed", 0.0)), expected[3]), "%s has approved move speed" % hero_id)
	var legendary := KITS.kit_snapshot(&"sword_hero", 5, {"active_1": 1, "active_2": 1})
	_expect(String(legendary.get("kit_id", "")) == "legendary_plus", "Crystal selects Legendary+ behavior")
	_expect(int((legendary.get("passive", {}) as Dictionary).get("combo_hits", 0)) == 5, "Legendary+ Knight exposes the five-hit combo")
	var basic_knight := KITS.kit_snapshot(&"sword_hero", 0, {"active_1": 1, "active_2": 1})
	var fan_charge: Dictionary = basic_knight.get("active_2", {})
	_expect(
		is_equal_approx(float(fan_charge.get("damage_ratio_min", -1.0)), 0.0)
			and is_equal_approx(float(fan_charge.get("damage_ratio_max", -1.0)), 2.0),
		"Knight fan charge scales continuously from zero to 200 percent damage",
	)
	var shadow: Dictionary = basic_knight.get("active_1", {})
	var rank_one := KITS.rank_adjusted_profile(shadow, 1)
	var rank_three := KITS.rank_adjusted_profile(shadow, 3)
	var rank_five := KITS.rank_adjusted_profile(shadow, 5)
	_expect(
		is_equal_approx(float(rank_three.get("mana", 0.0)), 22.0)
			and is_equal_approx(float(rank_three.get("duration", 0.0)), 4.0)
			and is_equal_approx(float(rank_three.get("cooldown", 0.0)), 5.0),
		"Hero Weapon skill rank 3 preserves every authored baseline parameter",
	)
	_expect(
		float(rank_one.get("mana", 0.0)) > 22.0
			and float(rank_one.get("duration", 0.0)) < 4.0
			and float(rank_one.get("cooldown", 0.0)) > 5.0,
		"skill rank 1 is weaker than the authored rank-3 baseline",
	)
	_expect(
		float(rank_five.get("mana", 999.0)) < 22.0
			and float(rank_five.get("duration", 0.0)) > 4.0
			and float(rank_five.get("cooldown", 999.0)) < 5.0,
		"skill rank 5 improves cost, duration, and cooldown together",
	)


func _test_visible_damage_contract() -> void:
	var plain := RESOLVER.resolve_hit({"base": 100.0}, {"variance_roll": 0.5, "critical_roll": 1.0})
	var armored := RESOLVER.resolve_hit(
		{"base": 100.0, "defense": {"rating": 9999.0, "percent_penetration": 40.0}},
		{"variance_roll": 0.5, "critical_roll": 1.0},
	)
	_expect(int(plain.get("damage", 0)) == 100, "plain 100 damage removes 100 HP")
	_expect(int(armored.get("damage", 0)) == 100, "hidden defense cannot shrink displayed direct damage")
	_expect(float(armored.get("damage_reduction", -1.0)) == 0.0, "resolver reports zero hidden reduction")
	var legacy_weapon := SOULS.create_instance(
		&"sword_hero", SOULS.Rarity.LEGENDARY, 8, &"visible_affix_compatibility_test", 77213,
		SOULS.AFFINITY_WARRIOR,
	)
	legacy_weapon["affixes"] = [
		{"affix_id": "damage_reduction", "value": 4.0},
		{"affix_id": "dodge", "value": 3.0},
		{"affix_id": "melee_threat_shield", "value": 6.0},
		{"affix_id": "armor_penetration", "value": 5.0},
	]
	var conversion_snapshot := {
		"soul_team": {"selected_soul_instances": {
			"sword_hero": String(legacy_weapon.get("instance_id", "")),
		}},
		"inventory": {"hero_souls": [legacy_weapon]},
	}
	var legacy_projection := SOUL_AFFIXES.derive(conversion_snapshot, &"sword_hero")
	var legacy_totals: Dictionary = legacy_projection.get("percent_totals", {})
	_expect(
		is_equal_approx(float(legacy_totals.get("barrier_capacity", 0.0)), 10.0),
		"legacy numeric mitigation and shield become one visible Barrier pool",
	)
	_expect(
		is_equal_approx(float(legacy_totals.get("dodge", 0.0)), 3.0),
		"dodge remains a visible all-or-nothing defense",
	)
	_expect(
		is_equal_approx(float(legacy_totals.get("core_damage", 0.0)), 5.0),
		"legacy armor penetration becomes visible Power",
	)
	_expect(
		is_equal_approx(float(legacy_projection.get("damage_taken_multiplier", 0.0)), 1.0),
		"legacy Hero Weapon affixes never reduce incoming damage behind the UI",
	)


func _test_authored_skill_assets() -> void:
	for effect_id: StringName in [&"axe_spin", &"dark_rift", &"dark_burst"]:
		_expect(VFX.has_effect(effect_id), "%s skill feedback uses an authored VFX asset" % effect_id)
	var owner := Node2D.new()
	var zone := AUTHORED_ZONE.new() as AuthoredSkillZone
	root.add_child(owner)
	root.add_child(zone)
	_expect(
		zone.setup(
			owner, Vector2.ZERO, &"wizard_hero", &"wizard_black_sun",
			1.0, 0.25, 11, 92.0, &"dark_burst",
		),
		"timed skill zone accepts an asset-backed plain-HP damage profile",
	)
	var distributed: Array[int] = zone._pulse_damages
	var distributed_total := 0
	for amount: int in distributed:
		distributed_total += amount
	_expect(
		distributed.size() == 4 and distributed_total == 11,
		"timed skill pulses preserve exact displayed damage without hidden loss",
	)
	zone.queue_free()
	owner.queue_free()


func _test_q_requires_confirm() -> void:
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	var player := Node2D.new()
	root.add_child(player)
	player.add_child(manager)
	_expect(manager.configure_team(player, SWORD, ARCHER), "Soul manager accepts a fixed two-Hero team")
	manager.state = HeroSoulManager.RelayState.READY
	manager.ready_seconds_left = 5.0
	_expect(manager.request_soul_relay(), "Q arms the ready Soul skill")
	_expect(manager.state == HeroSoulManager.RelayState.READY and manager.is_soul_skill_armed(), "Q alone does not auto-summon")
	_expect(manager.confirm_soul_skill(null), "LMB confirmation accepts no locked target and starts the armed Soul skill")
	_expect(manager.state == HeroSoulManager.RelayState.SUMMONING, "confirmed Soul skill enters summon state")
	player.queue_free()
	await process_frame


func _test_save_unlock_storage_and_xp() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		return
	_remove_save_generations()
	_expect(save.configure_storage(SAVE_PATH, true), "isolated schema-4 save loads")
	_expect(int(save.get_value(["schema_version"], 0)) == 4, "new saves use schema 4")
	var capacity := save.get_inventory_capacity_snapshot()
	_expect(int(capacity.get("bag_capacity", 0)) == 30, "combat bag has 30 slots")
	_expect(int(capacity.get("storage_capacity", 0)) == 50, "Home chest has 50 slots")

	_expect(save.grant_hero_shards(&"archer_hero", 10, "test:archer_shards_10"), "Archer can receive shards")
	_expect(save.get_hero_shards(&"archer_hero") == 10, "Archer shard amount persists separately")
	_expect(save.grant_hero_shards(&"archer_hero", 40, "test:archer_shards_40"), "Archer reaches fifty shards")
	_expect(save.unlock_hero_with_shards(&"archer_hero", "test:unlock_archer"), "fifty shards unlock Archer")
	_expect(save.get_hero_shards(&"archer_hero") == 0, "unlock consumes exactly fifty shards")
	_expect(bool(save.get_value(["progression", "unlocked_heroes", "archer_hero"], false)), "Archer identity is unlocked")
	var archer_weapons := _weapons_for(save.get_snapshot(), "archer_hero")
	_expect(archer_weapons.size() == 1, "unlock grants one basic Archer Hero Weapon when none exists")
	if not archer_weapons.is_empty():
		_expect(int((archer_weapons[0] as Dictionary).get("rarity", -1)) == SOULS.Rarity.NORMAL, "starter Hero Weapon is Normal")
		_expect(String((archer_weapons[0] as Dictionary).get("item_kind", "")) == "hero_weapon", "starter item is a Hero Weapon")

	_expect(not save.grant_hero_shards(&"axe_hero", 50, "test:axe_shards"), "Axe never accepts shards")
	_expect(not save.unlock_hero_with_shards(&"axe_hero", "test:axe_shard_unlock"), "Axe cannot unlock through shards")
	_expect(save.unlock_story_hero(&"axe_hero", "test:axe_story_unlock"), "Axe unlocks only through story authority")
	_expect(_weapons_for(save.get_snapshot(), "axe_hero").size() == 1, "story unlock still grants Axe's basic Hero Weapon")
	var sword_weapons := _weapons_for(save.get_snapshot(), "sword_hero")
	var axe_weapons := _weapons_for(save.get_snapshot(), "axe_hero")
	var sword_weapon_id := String(sword_weapons[0].get("instance_id", ""))
	var archer_weapon_id := String(archer_weapons[0].get("instance_id", ""))
	var axe_weapon_id := String(axe_weapons[0].get("instance_id", ""))
	_expect(
		save.set_soul_team_instances(sword_weapon_id, [archer_weapon_id], "test:fixed_pair"),
		"one active and one reserve Hero form the fixed run pair",
	)
	var pair: Dictionary = save.get_value(["soul_team"], {})
	_expect(
		int(pair.get("capacity", 0)) == 1 and (pair.get("reserve_souls", []) as Array).size() == 1,
		"save schema canonicalizes the team to exactly one reserve",
	)
	_expect(
		not save.set_soul_team_instances(
			sword_weapon_id, [archer_weapon_id, axe_weapon_id], "test:reject_third_hero"
		),
		"a third Hero cannot enter the fixed pair",
	)

	var legacy_guard := AUX_RULES.generate_item(
		&"soul_vessel", &"magic", 7, 88110, &"test_visible_gear",
		PackedStringArray(["armor_power_percent"]),
	)
	var guard_id := String(legacy_guard.get("uuid", ""))
	_expect(save.grant_auxiliary_equipment(legacy_guard, "test:grant_guard"), "universal Armor enters the bag")
	_expect(save.equip_hero_item(&"sword_hero", &"armor", guard_id, "test:equip_guard_sword"), "any Hero can equip universal Armor")
	_expect(save.equip_hero_item(&"archer_hero", &"armor", guard_id, "test:move_guard_archer"), "equipping one instance to another Hero moves it atomically")
	var moved_loadouts: Dictionary = save.get_value(["hero_loadouts"], {})
	_expect(
		String((moved_loadouts.get("sword_hero", {}) as Dictionary).get("armor", "")).is_empty()
			and String((moved_loadouts.get("archer_hero", {}) as Dictionary).get("armor", "")) == guard_id,
		"one equipment instance cannot remain equipped to two Heroes",
	)
	var archer_projection := AUX_COMBAT.derive_hero_snapshot(save.get_snapshot(), ARCHER)
	var power_modifiers: Dictionary = (archer_projection.get("modifiers", {}) as Dictionary).get("damage", {})
	_expect(float(power_modifiers.get("percent", 0.0)) > 0.0, "Armor's readable Power affix applies directly")
	_expect(
		not JSON.stringify(archer_projection.get("effect_hooks", [])).contains("damage_reduction"),
		"new equipment exposes no hidden damage-reduction hook",
	)
	var visible_armor := AUX_RULES.generate_item(
		&"soul_vessel", &"magic", 7, 88111, &"test_visible_barrier",
		PackedStringArray(["barrier_capacity_percent"]),
	)
	var visible_boots := AUX_RULES.generate_item(
		&"soul_boots", &"magic", 7, 88112, &"test_visible_dodge",
		PackedStringArray(["dodge_chance_percent"]),
	)
	_expect(save.grant_auxiliary_equipment(visible_armor, "test:grant_visible_armor"), "visible-Barrier Armor enters the bag")
	_expect(save.grant_auxiliary_equipment(visible_boots, "test:grant_visible_boots"), "visible-Dodge Boots enter the bag")
	_expect(save.equip_hero_item(&"sword_hero", &"armor", String(visible_armor.get("uuid", "")), "test:equip_visible_armor"), "Sword equips visible-Barrier Armor")
	_expect(save.equip_hero_item(&"sword_hero", &"boots", String(visible_boots.get("uuid", "")), "test:equip_visible_boots"), "Sword equips visible-Dodge Boots")
	var visible_projection := MANAGER_SCRIPT.project_hero_combat(save.get_snapshot(), SWORD)
	var visible_secondary: Dictionary = visible_projection.get("secondary_stats", {})
	_expect(
		float(visible_secondary.get("barrier_capacity_percent", 0.0)) > 0.0
			and float(visible_secondary.get("dodge_chance_percent", 0.0)) > 0.0,
		"Armor and Boots project real visible Barrier and NÉ stats",
	)
	_expect(
		float(visible_secondary.get("damage_reduction_percent", -1.0)) == 0.0,
		"visible defenses do not reactivate hidden numeric mitigation",
	)
	_expect(not save.sell_auxiliary_equipment(guard_id, "test:sell_equipped_guard"), "equipped per-Hero gear cannot be sold")

	var stone := ITEM_CATALOG.find(&"hero_xp_stone_small")
	_expect(stone != null and stone.hero_xp_value == 60, "small Hero XP stone is catalog-authored")
	_expect(save.grant_inventory_item(&"hero_xp_stone_small", &"consumable", 1, "test:xp_stone", stone.to_inventory_metadata()), "XP stone enters the bag")
	_expect(save.transact_once(
		"test:set_hero_at_cap",
		func(candidate: Dictionary) -> bool:
			candidate["progression"]["campaign"]["average_enemy_level_cap"] = 5
			candidate["progression"]["heroes"]["sword_hero"]["level"] = 5
			candidate["progression"]["heroes"]["sword_hero"]["xp"] = 0
			return true,
	), "test places Sword at the current stage enemy-level cap")
	var rejected := save.consume_hero_xp_stone(&"sword_hero", &"hero_xp_stone_small", 1, "test:stone_rejected")
	_expect(not bool(rejected.get("applied", false)), "a fully capped Hero cannot consume an XP stone")
	_expect(int(save.get_value(["inventory", "item_stacks", "hero_xp_stone_small", "quantity"], 0)) == 1, "rejected capped use preserves the stone")
	_expect(save.transact_once(
		"test:below_cap",
		func(candidate: Dictionary) -> bool:
			candidate["progression"]["campaign"]["average_enemy_level_cap"] = 5
			candidate["progression"]["heroes"]["sword_hero"]["level"] = 1
			candidate["progression"]["heroes"]["sword_hero"]["xp"] = 0
			return true,
	), "test places Sword below the average enemy level five cap")
	var applied := save.consume_hero_xp_stone(&"sword_hero", &"hero_xp_stone_small", 1, "test:stone_applied")
	_expect(bool(applied.get("applied", false)) and int(applied.get("xp_applied", 0)) == 60, "XP stone grants XP only to the selected Hero")
	_expect(int(save.get_hero_progression_snapshot(&"archer_hero").get("xp", -1)) == 0, "other Heroes receive none of the selected Hero's XP")
	_expect(int(save.get_value(["inventory", "item_stacks", "hero_xp_stone_small", "quantity"], 0)) == 0, "successful use consumes one stone")


func _test_campaign_shard_rewards() -> void:
	_expect(int(LEVEL_5_REWARD.hero_shards.get("archer_hero", 0)) == 10, "level 5 grants ten Archer shards")
	_expect(int(LEVEL_20_REWARD.hero_shards.get("wizard_hero", 0)) == 10, "level 20 grants ten Wizard shards")
	_expect(not LEVEL_5_REWARD.hero_shards.has("axe_hero") and not LEVEL_20_REWARD.hero_shards.has("axe_hero"), "campaign shard rewards never include Axe")
	_expect(LEVEL_5_REWARD.hero_soul_grants.is_empty() and LEVEL_20_REWARD.hero_soul_grants.is_empty(), "Archer and Wizard milestones no longer grant Hero Weapon drops")


func _weapons_for(snapshot: Dictionary, hero_id: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var inventory: Dictionary = snapshot.get("inventory", {})
	var storage: Dictionary = snapshot.get("storage", {})
	for collection: Variant in [inventory.get("hero_souls", []), storage.get("hero_weapons", [])]:
		if not collection is Array:
			continue
		for raw: Variant in collection as Array:
			if raw is Dictionary and String((raw as Dictionary).get("hero_id", "")) == hero_id:
				result.append((raw as Dictionary).duplicate(true))
	return result


func _remove_save_generations() -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v4.bak", ".pre_v3.bak", ".pre_v2.bak"]:
		var absolute := ProjectSettings.globalize_path(SAVE_PATH + suffix)
		if FileAccess.file_exists(absolute):
			DirAccess.remove_absolute(absolute)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("CORE GAMEPLAY REBUILD TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("CORE GAMEPLAY REBUILD TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
