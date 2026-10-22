class_name AuxiliaryEquipmentCombatStats
extends RefCounted

## Pure runtime projection from persisted account progression and the shared
## auxiliary loadout to one Hero's combat-stat snapshot. The deterministic
## order is authored Hero base -> plain HP/Mana/Power growth -> equipment
## flat/percent modifiers. Base-stat allocation never emits perk/effect hooks;
## special behavior belongs exclusively to equipment and skill systems.

const DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const PLAYER_PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_PROGRESSION_RULES := preload("res://game/meta/progression/hero_progression_rules.gd")

const SUPPORTED_STAT_IDS := {
	"max_hp_flat": {"field": "hp", "unit": "flat"},
	"max_hp_percent": {"field": "hp", "unit": "percent"},
	"max_hp_from_boots_percent": {"field": "hp", "unit": "percent"},
	"damage_flat": {"field": "damage", "unit": "flat"},
	"damage_percent": {"field": "damage", "unit": "percent"},
	"armor_power_percent": {"field": "damage", "unit": "percent"},
	"boots_power_percent": {"field": "damage", "unit": "percent"},
	"max_mana_flat": {"field": "mana", "unit": "flat"},
	"mana_percent": {"field": "mana", "unit": "percent"},
	"armor_mana_percent": {"field": "mana", "unit": "percent"},
}


static func derive_hero_snapshot(
		save_snapshot: Dictionary,
		hero: HeroDefinition,
		base_stats: Dictionary = {}
) -> Dictionary:
	var hero_id := String(hero.hero_id) if hero != null else ""
	var authored_base := {
		"hp": _positive_base(base_stats.get("hp", hero.base_max_hp if hero != null else PLAYER_PROGRESSION_RULES.BASE_HP), PLAYER_PROGRESSION_RULES.BASE_HP),
		"damage": _positive_base(
			base_stats.get(
				"damage",
				float(hero.base_power) if hero != null else PLAYER_PROGRESSION_RULES.BASE_DAMAGE
			),
			PLAYER_PROGRESSION_RULES.BASE_DAMAGE
		),
		"mana": _positive_base(base_stats.get("mana", hero.base_max_mana if hero != null else PLAYER_PROGRESSION_RULES.BASE_MANA), PLAYER_PROGRESSION_RULES.BASE_MANA),
	}
	var progression_resolution := resolve_hero_progression(save_snapshot, StringName(hero_id))
	var progression_snapshot: Dictionary = progression_resolution.get("snapshot", {})
	var progression_base := _apply_player_progression(authored_base, progression_snapshot)
	var progression_modifiers := _progression_direct_modifiers(progression_snapshot)
	var progression_effect_hooks := _progression_effect_hooks(progression_snapshot)
	var modifiers := {
		"hp": {"flat": 0.0, "percent": 0.0},
		"damage": {"flat": 0.0, "percent": 0.0},
		"mana": {"flat": 0.0, "percent": 0.0},
	}
	var applied_modifiers: Array[Dictionary] = []
	var effect_hooks: Array[Dictionary] = progression_effect_hooks.duplicate(true)
	var resolution := resolve_equipped_items(save_snapshot, StringName(hero_id))
	var equipped_items: Dictionary = resolution.get("items", {})

	for slot_id: String in DEFINITIONS.SLOT_IDS:
		if not equipped_items.has(slot_id):
			continue
		var item: Dictionary = equipped_items[slot_id]
		var upgrade_multiplier := RULES.upgrade_multiplier(item)
		_accumulate_entry(
			modifiers,
			applied_modifiers,
			effect_hooks,
			item.get("primary", {}),
			"stat_id",
			slot_id,
			String(item.get("uuid", "")),
			&"primary",
			upgrade_multiplier,
		)
		for raw_affix: Variant in item.get("affixes", []):
			if raw_affix is Dictionary:
				_accumulate_entry(
					modifiers,
					applied_modifiers,
					effect_hooks,
					raw_affix as Dictionary,
					"affix_id",
					slot_id,
					String(item.get("uuid", "")),
					&"affix",
					upgrade_multiplier,
				)

	var hp := _apply_direct_modifiers(float(progression_base["hp"]), modifiers["hp"])
	var damage := _apply_direct_modifiers(float(progression_base["damage"]), modifiers["damage"])
	var mana := _apply_direct_modifiers(float(progression_base["mana"]), modifiers["mana"])
	var resolution_issues := (progression_resolution.get("issues", PackedStringArray()) as PackedStringArray).duplicate()
	resolution_issues.append_array(resolution.get("issues", PackedStringArray()) as PackedStringArray)
	return {
		"hero_id": hero_id,
		"hp": hp,
		"damage": damage,
		"mana": mana,
		"base": authored_base,
		"authored_base": authored_base.duplicate(true),
		"progression_base": progression_base,
		"progression": progression_snapshot,
		"progression_modifiers": progression_modifiers,
		"modifiers": modifiers,
		"damage_multiplier": damage / float(authored_base["damage"]),
		"applied_modifiers": applied_modifiers,
		"applied_progression_modifiers": progression_modifiers.duplicate(true),
		"progression_effect_hooks": progression_effect_hooks.duplicate(true),
		"effect_hooks": effect_hooks,
		"equipped_item_uuids": resolution.get("equipped_item_uuids", {}).duplicate(true),
		"resolution_issues": resolution_issues,
	}


## Normalizes the persisted allocation without trusting callers to have passed
## a SaveService-derived convenience snapshot. Missing stat keys mean zero;
## malformed or overspent allocations fail closed as all-zero progression.
static func resolve_player_progression(save_snapshot: Dictionary) -> Dictionary:
	var issues := PackedStringArray()
	var player_level := _account_level(save_snapshot)
	var raw_allocation: Variant = {}
	var progression_value: Variant = save_snapshot.get("progression", {})
	if progression_value is Dictionary:
		var player_value: Variant = (progression_value as Dictionary).get("player", {})
		if player_value is Dictionary:
			raw_allocation = (player_value as Dictionary).get("stat_allocation", {})
		else:
			issues.append("Save snapshot progression.player must be a Dictionary.")
	else:
		issues.append("Save snapshot progression must be a Dictionary.")

	var normalized := {"hp": 0, "damage": 0, "mana": 0}
	var valid := raw_allocation is Dictionary
	if not valid:
		issues.append("Save snapshot stat_allocation must be a Dictionary.")
	else:
		var allocation := raw_allocation as Dictionary
		for raw_key: Variant in allocation.keys():
			if StringName(raw_key) not in PLAYER_PROGRESSION_RULES.STAT_IDS:
				valid = false
				issues.append("Unknown persisted Stat Point ID '%s'." % raw_key)
		for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
			var key := String(stat_id)
			var raw_points: Variant = allocation.get(stat_id, allocation.get(key, 0))
			if not raw_points is int:
				valid = false
				issues.append("Persisted Stat Points for '%s' must be an integer." % key)
				continue
			normalized[key] = int(raw_points)
	if valid and not PLAYER_PROGRESSION_RULES.validate_stat_allocation(player_level, normalized):
		valid = false
		issues.append("Persisted Stat Point allocation is invalid for player level %d." % player_level)
	if not valid:
		normalized = {"hp": 0, "damage": 0, "mana": 0}

	return {
		"snapshot": PLAYER_PROGRESSION_RULES.stat_snapshot(player_level, normalized),
		"issues": issues,
	}


static func resolve_hero_progression(save_snapshot: Dictionary, hero_id: StringName) -> Dictionary:
	var normalized := String(hero_id).strip_edges().to_lower()
	var issues := PackedStringArray()
	var record := HERO_PROGRESSION_RULES.empty_record(hero_id)
	var progression_value: Variant = save_snapshot.get("progression", {})
	if progression_value is Dictionary:
		var records_value: Variant = (progression_value as Dictionary).get("heroes", {})
		if records_value is Dictionary and (records_value as Dictionary).get(normalized, {}) is Dictionary:
			record.merge(((records_value as Dictionary).get(normalized, {}) as Dictionary), true)
		else:
			issues.append("Missing per-Hero progression for '%s'." % normalized)
	else:
		issues.append("Save snapshot progression must be a Dictionary.")
	var level := clampi(int(record.get("level", 1)), 1, PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP)
	var allocation_value: Variant = record.get("stat_allocation", {})
	var allocation := {"hp": 0, "damage": 0, "mana": 0}
	if allocation_value is Dictionary:
		for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
			allocation[String(stat_id)] = int((allocation_value as Dictionary).get(String(stat_id), 0))
	if not PLAYER_PROGRESSION_RULES.validate_stat_allocation(level, allocation):
		issues.append("Invalid per-Hero Stat Point allocation for '%s'." % normalized)
		allocation = {"hp": 0, "damage": 0, "mana": 0}
	return {
		"snapshot": PLAYER_PROGRESSION_RULES.stat_snapshot(level, allocation),
		"issues": issues,
	}


## Resolves SaveService's compact slot -> UUID representation without mutating
## the save. Invalid, duplicated, locked, missing, or slot-mismatched entries
## fail closed per slot and are reported for diagnostics.
static func resolve_equipped_items(save_snapshot: Dictionary, hero_id: StringName = &"") -> Dictionary:
	var issues := PackedStringArray()
	var resolved := {}
	var equipped_item_uuids := {}
	var inventory_value: Variant = save_snapshot.get("inventory", {})
	var loadout_value: Variant = save_snapshot.get("auxiliary_loadout", {})
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	if not normalized_hero.is_empty():
		var hero_loadouts_value: Variant = save_snapshot.get("hero_loadouts", {})
		if hero_loadouts_value is Dictionary \
				and (hero_loadouts_value as Dictionary).get(normalized_hero, {}) is Dictionary:
			var hero_loadout: Dictionary = (hero_loadouts_value as Dictionary).get(normalized_hero, {})
			loadout_value = {
				"soul_vessel": String(hero_loadout.get("armor", "")),
				"soul_boots": String(hero_loadout.get("boots", "")),
				"soul_trace": String(hero_loadout.get("jewelry", "")),
			}
	if not inventory_value is Dictionary:
		issues.append("Save snapshot inventory must be a Dictionary.")
		return {"items": resolved, "equipped_item_uuids": equipped_item_uuids, "issues": issues}
	if not loadout_value is Dictionary:
		issues.append("Save snapshot auxiliary_loadout must be a Dictionary.")
		return {"items": resolved, "equipped_item_uuids": equipped_item_uuids, "issues": issues}

	var inventory := inventory_value as Dictionary
	var items_value: Variant = inventory.get("auxiliary_equipment", [])
	if not items_value is Array:
		issues.append("Save snapshot auxiliary equipment inventory must be an Array.")
		return {"items": resolved, "equipped_item_uuids": equipped_item_uuids, "issues": issues}

	var items_by_uuid := {}
	var ambiguous_uuids := {}
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			issues.append("Auxiliary equipment inventory contains a non-Dictionary entry.")
			continue
		var item := raw_item as Dictionary
		var item_errors := RULES.validate_item(item)
		if not item_errors.is_empty():
			issues.append("Invalid auxiliary item ignored: %s" % "; ".join(item_errors))
			continue
		var uuid := String(item.get("uuid", ""))
		if items_by_uuid.has(uuid):
			ambiguous_uuids[uuid] = true
			items_by_uuid.erase(uuid)
			continue
		if not ambiguous_uuids.has(uuid):
			items_by_uuid[uuid] = item

	var loadout := loadout_value as Dictionary
	var seen_uuids := {}
	for slot_id: String in DEFINITIONS.SLOT_IDS:
		var uuid := String(loadout.get(slot_id, "")).strip_edges().to_lower()
		if uuid.is_empty():
			continue
		if ambiguous_uuids.has(uuid):
			issues.append("Auxiliary slot '%s' references a duplicated UUID." % slot_id)
			continue
		if seen_uuids.has(uuid):
			issues.append("Auxiliary UUID '%s' cannot occupy multiple shared slots." % uuid)
			continue
		seen_uuids[uuid] = true
		if not items_by_uuid.has(uuid):
			issues.append("Auxiliary slot '%s' references a missing or invalid item UUID." % slot_id)
			continue
		var item: Dictionary = items_by_uuid[uuid]
		if String(item.get("slot", "")) != slot_id:
			issues.append("Auxiliary item UUID '%s' does not belong to slot '%s'." % [uuid, slot_id])
			continue
		resolved[slot_id] = item.duplicate(true)
		equipped_item_uuids[slot_id] = uuid

	return {
		"items": resolved,
		"equipped_item_uuids": equipped_item_uuids,
		"issues": issues,
	}


static func _apply_player_progression(authored_base: Dictionary, progression_snapshot: Dictionary) -> Dictionary:
	var allocation: Dictionary = progression_snapshot.get("allocation", {})
	var player_level := int(progression_snapshot.get("player_level", 1))
	var level_growth := PLAYER_PROGRESSION_RULES.level_growth_snapshot(player_level)
	var hp_points := int(allocation.get("hp", 0))
	var damage_points := int(allocation.get("damage", 0))
	var mana_points := int(allocation.get("mana", 0))
	return {
		"hp": float(authored_base["hp"])
			+ float(level_growth.get("hp_flat", 0.0))
			+ PLAYER_PROGRESSION_RULES.stat_bonus(&"hp", hp_points),
		"damage": PLAYER_PROGRESSION_RULES.power_from_core(
			float(authored_base["damage"]),
			damage_points,
		),
		"mana": float(authored_base["mana"])
			+ float(level_growth.get("mana_flat", 0.0))
			+ PLAYER_PROGRESSION_RULES.stat_bonus(&"mana", mana_points),
	}


static func _progression_direct_modifiers(_progression_snapshot: Dictionary) -> Array[Dictionary]:
	return []


static func _progression_effect_hooks(_progression_snapshot: Dictionary) -> Array[Dictionary]:
	return []


static func _milestone_ids_for_stat(stat_id: StringName) -> Array:
	match stat_id:
		&"hp":
			return PLAYER_PROGRESSION_RULES.HP_MILESTONES
		&"damage":
			return PLAYER_PROGRESSION_RULES.DAMAGE_MILESTONES
		&"mana":
			return PLAYER_PROGRESSION_RULES.MANA_MILESTONES
	return []


static func _accumulate_entry(
		modifiers: Dictionary,
		applied_modifiers: Array[Dictionary],
		effect_hooks: Array[Dictionary],
	entry: Dictionary,
	id_field: String,
	slot_id: String,
	uuid: String,
	source_kind: StringName,
	value_multiplier: float = 1.0,
) -> void:
	var stat_id := String(entry.get(id_field, ""))
	var unit := String(entry.get("unit", ""))
	var rolled_value := float(entry.get("value", 0.0))
	var value := rolled_value * maxf(1.0, value_multiplier)
	var source := {
		"stat_id": stat_id,
		"unit": unit,
		"value": value,
		"rolled_value": rolled_value,
		"upgrade_multiplier": maxf(1.0, value_multiplier),
		"source_kind": String(source_kind),
		"source_slot": slot_id,
		"source_uuid": uuid,
		"target_scope": "equipped_hero_only",
	}
	if not SUPPORTED_STAT_IDS.has(stat_id):
		source["effect_id"] = stat_id
		effect_hooks.append(source)
		return
	var definition: Dictionary = SUPPORTED_STAT_IDS[stat_id]
	if String(definition.get("unit", "")) != unit:
		# Valid equipment cannot reach this branch, but a mismatched semantic is
		# still surfaced rather than being applied as a different operation.
		source["effect_id"] = stat_id
		source["reason"] = "unit_mismatch"
		effect_hooks.append(source)
		return
	var field := String(definition["field"])
	var field_modifiers: Dictionary = modifiers[field]
	field_modifiers[unit] = float(field_modifiers.get(unit, 0.0)) + value
	modifiers[field] = field_modifiers
	source["field"] = field
	applied_modifiers.append(source)


## Direct modifiers have an explicit two-stage interpretation: all flat values
## establish the modified base, then the catalog's percent values multiply it.
## No other affix unit is interpreted here.
static func _apply_direct_modifiers(base_value: float, field_modifiers: Dictionary) -> float:
	var modified_base := base_value + float(field_modifiers.get("flat", 0.0))
	return maxf(0.0, modified_base * (1.0 + float(field_modifiers.get("percent", 0.0)) / 100.0))


static func _account_level(save_snapshot: Dictionary) -> int:
	var progression_value: Variant = save_snapshot.get("progression", {})
	if progression_value is Dictionary:
		var player_value: Variant = (progression_value as Dictionary).get("player", {})
		if player_value is Dictionary:
			return maxi(1, int((player_value as Dictionary).get("level", 1)))
	return 1


static func _positive_base(value: Variant, fallback: float) -> float:
	if (value is int or value is float) and is_finite(float(value)) and float(value) > 0.0:
		return float(value)
	return fallback
