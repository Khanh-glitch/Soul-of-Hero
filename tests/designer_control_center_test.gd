extends SceneTree

const VFX_LIBRARY: VfxLibrary = preload("res://data/content/vfx/vfx_library.tres")
const VFX_CATALOG := preload("res://game/vfx/vfx_catalog.gd")
const BALANCE: GameplayTuningProfile = preload("res://data/content/tuning/gameplay_tuning.tres")
const ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")
const LEVEL_ONE_REWARD: RewardBundleDefinition = preload("res://data/content/rewards/chapter_1_level_1_reward.tres")
const WIZARD_HERO: HeroDefinition = preload("res://game/heroes/data/wizard_hero.tres")
const SWORD_WEAPON: WeaponDefinition = preload("res://game/weapons/data/sword.tres")
const SKELETON_ENEMY: EnemyDefinition = preload("res://data/content/enemies/skeleton_swordsman.tres")
const ELITE_POLICY: EliteSpawnPolicy = preload("res://data/content/elite_policies/elite_20_percent_guaranteed.tres")
const LEVEL_ONE_ENCOUNTER: EncounterDefinition = preload("res://data/content/encounters/chapter_1_level_1_crypt.tres")
const MAP_SERIALIZER := preload("res://game/levels/authoring/map_entity_authoring_serializer.gd")
const WORKBENCH: PackedScene = preload("res://game/levels/authoring/level_workbench.tscn")
const DESIGNER_SUITE_PLUGIN := preload("res://addons/designer_suite/designer_suite_plugin.gd")

var _checks := 0
var _failures := 0


func _initialize() -> void:
	call_deferred(&"_run")


func _run() -> void:
	_expect(DESIGNER_SUITE_PLUGIN != null, "Designer Suite plugin compiles before any content test runs")
	_expect(BALANCE.get_validation_errors().is_empty(), "Balance profile uses the runtime schema")
	_expect(BALANCE.to_document().get("player", {}) is Dictionary, "Balance profile exports player tuning")
	_expect(BALANCE.to_document().get("combat", {}) is Dictionary, "Balance profile exports combat tuning")

	_expect(VFX_LIBRARY.get_validation_errors().is_empty(), "VFX library is valid")
	_expect(VFX_LIBRARY.profiles.size() == 22, "VFX library owns every migrated one-shot effect")
	for effect_id: StringName in [&"blade_impact", &"bow_impact", &"axe_charge", &"world_portal"]:
		_expect(VFX_CATALOG.has_effect(effect_id), "VFX runtime resolves %s from the library" % effect_id)
		var profile := VFX_LIBRARY.find(effect_id)
		_expect(profile != null and profile.texture != null, "%s keeps a Designer-editable texture" % effect_id)

	_expect(ITEM_CATALOG.get_validation_errors().is_empty(), "Item catalog is valid")
	for item_id: StringName in [&"crypt_bone_shard", &"blood_crucible_blueprint", &"soul_ember"]:
		var item := ITEM_CATALOG.find(item_id)
		_expect(item != null and item.icon != null, "Item catalog resolves %s with an icon" % item_id)
	_expect(LEVEL_ONE_REWARD.get_validation_errors().is_empty(), "Existing reward remains valid with its item definition")
	var first_stack := LEVEL_ONE_REWARD.item_stacks[0]
	_expect(first_stack.item_definition != null, "Existing Level 1 reward points to the Item Catalog")
	_expect(first_stack.get_effective_item_id() == &"crypt_bone_shard", "Reward resolves a stable item ID")
	_expect(WIZARD_HERO.primary_weapon != null, "Hero balance links to its own weapon and skill profiles")
	_expect(WIZARD_HERO.wizard_rmb_density_damage_ratios.size() >= 7, "Hero ratios expose every Wizard density tier")
	_expect(SWORD_WEAPON.normal_attack != null and SWORD_WEAPON.hand_skill != null, "Weapon balance exposes normal attack and hand skill separately")
	_expect(SKELETON_ENEMY.max_health > 0.0 and SKELETON_ENEMY.attack_damage >= 0.0, "Enemy balance exposes health and damage separately")
	_expect(ELITE_POLICY.chance_per_camp >= 0.0 and ELITE_POLICY.chance_per_camp <= 1.0, "Elite spawn policy exposes a safe per-camp probability")
	_expect(not LEVEL_ONE_ENCOUNTER.waves.is_empty(), "Encounter balance exposes authored waves and groups")

	var stage := Node2D.new()
	root.add_child(stage)
	var container := Node2D.new()
	stage.add_child(container)
	var first_import: Dictionary = MAP_SERIALIZER.deserialize_level_file(container, "res://data/levels/crypt_entrance.json", stage)
	var second_import: Dictionary = MAP_SERIALIZER.deserialize_level_file(container, "res://data/levels/crypt_entrance.json", stage)
	_expect(bool(first_import.get("ok", false)) and bool(second_import.get("ok", false)), "Map workbench can reload entity previews")
	_expect(_count_markers(container) == int(second_import.get("count", -1)), "Reloading map preview never duplicates markers")
	stage.queue_free()

	var workbench := WORKBENCH.instantiate()
	_expect(workbench != null, "Dedicated map workbench scene instantiates")
	_expect(_count_live_levels(workbench) == 1, "Map workbench has exactly one editable live level")
	workbench.free()

	if _failures == 0:
		print("DESIGNER CONTROL CENTER PASSED: %d checks" % _checks)
		quit(0)
	else:
		push_error("DESIGNER CONTROL CENTER FAILED: %d/%d checks" % [_failures, _checks])
		quit(1)


func _count_markers(node: Node) -> int:
	var count := 0
	for child: Node in node.get_children():
		if child is MapElementMarker:
			count += 1
		else:
			count += _count_markers(child)
	return count


func _count_live_levels(node: Node) -> int:
	var count := 1 if node.is_in_group(&"live_level") else 0
	for child: Node in node.get_children():
		count += _count_live_levels(child)
	return count


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if condition:
		print("[PASS] ", label)
	else:
		_failures += 1
		push_error("[FAIL] %s" % label)
