class_name HeroEquipmentPreview
extends RefCounted

## Read-only what-if equip. Reuses SaveService's exact-instance loadout
## semantics and the authoritative HeroSoulManager combat projection.
## Never writes SaveService, consumes resources or guesses a damage formula.
const MANAGER := preload("res://game/heroes/hero_soul_manager.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const HEROES := {
	"sword_hero": preload("res://game/heroes/data/sword_hero.tres"),
	"archer_hero": preload("res://game/heroes/data/archer_hero.tres"),
	"axe_hero": preload("res://game/heroes/data/axe_hero.tres"),
	"wizard_hero": preload("res://game/heroes/data/wizard_hero.tres"),
}
const SLOT_TO_AUX := {
	"armor": "soul_vessel",
	"boots": "soul_boots",
	"jewelry": "soul_trace",
}
const CORE_KEYS := ["hp", "mana", "character_damage", "damage"]


static func compare(snapshot: Dictionary, hero_id: String, slot: String, instance_id: String) -> Dictionary:
	var hero := HEROES.get(hero_id) as HeroDefinition
	if hero == null or not (slot == "hero_weapon" or SLOT_TO_AUX.has(slot)) \
			or instance_id.is_empty():
		return {}
	var progression_value: Variant = snapshot.get("progression", {})
	if progression_value is Dictionary:
		var unlocked_value: Variant = (progression_value as Dictionary).get("unlocked_heroes", null)
		if unlocked_value is Dictionary and not bool((unlocked_value as Dictionary).get(hero_id, false)):
			return {}
	var inventory_value: Variant = snapshot.get("inventory", null)
	if not inventory_value is Dictionary:
		return {}
	var inventory := inventory_value as Dictionary
	var items_value: Variant = (
		inventory.get("hero_souls", []) if slot == "hero_weapon"
		else inventory.get("auxiliary_equipment", [])
	)
	if not items_value is Array:
		return {}
	var count := 0
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			continue
		var item := raw_item as Dictionary
		if String(item.get("instance_id" if slot == "hero_weapon" else "uuid", "")) != instance_id:
			continue
		if slot == "hero_weapon":
			if String(item.get("hero_id", "")) != hero_id:
				return {}
		else:
			if String(item.get("slot", "")) != SLOT_TO_AUX[slot] \
					or not AUX_RULES.validate_item(item).is_empty():
				return {}
		count += 1
	# Ambiguous/duplicated inventory instance IDs must never produce a preview.
	if count != 1:
		return {}
	var baseline := MANAGER.project_hero_combat(snapshot, hero)
	if baseline.is_empty():
		return {}
	var candidate := snapshot.duplicate(true)
	var loadouts_value: Variant = candidate.get("hero_loadouts", {})
	if not loadouts_value is Dictionary:
		return {}
	var loadouts := loadouts_value as Dictionary
	var transferred_from := ""
	for other_id: Variant in loadouts.keys():
		var other_value: Variant = loadouts[other_id]
		if not other_value is Dictionary:
			return {}
		var other := other_value as Dictionary
		for other_slot: String in ["hero_weapon", "armor", "boots", "jewelry"]:
			if String(other.get(other_slot, "")) == instance_id:
				if String(other_id) != hero_id:
					transferred_from = String(other_id)
				other[other_slot] = ""
		loadouts[other_id] = other
	var current_value: Variant = loadouts.get(hero_id, {})
	if not current_value is Dictionary:
		return {}
	var target := current_value as Dictionary
	target[slot] = instance_id
	loadouts[hero_id] = target
	candidate["hero_loadouts"] = loadouts
	if slot == "hero_weapon":
		var team_value: Variant = candidate.get("soul_team", {})
		if not team_value is Dictionary:
			return {}
		var team := team_value as Dictionary
		var selected_value: Variant = team.get("selected_soul_instances", {})
		if not selected_value is Dictionary:
			return {}
		var selected := selected_value as Dictionary
		selected[hero_id] = instance_id
		team["selected_soul_instances"] = selected
		candidate["soul_team"] = team
	var projected := MANAGER.project_hero_combat(candidate, hero)
	if projected.is_empty():
		return {}
	var differences := {}
	for key: String in CORE_KEYS:
		differences[key] = float(projected.get(key, 0.0)) - float(baseline.get(key, 0.0))
	var original_secondary: Dictionary = baseline.get("secondary_stats", {})
	var target_secondary: Dictionary = projected.get("secondary_stats", {})
	var secondary := {}
	for raw_key: Variant in target_secondary.keys():
		var key := String(raw_key)
		var after: Variant = target_secondary[key]
		var before: Variant = original_secondary.get(key, 0.0)
		if (after is float or after is int) and (before is float or before is int):
			var difference := float(after) - float(before)
			if absf(difference) > 0.0001:
				secondary[key] = difference
	return {
		"baseline": baseline,
		"projected": projected,
		"delta": differences,
		"secondary_delta": secondary,
		"transferred_from": transferred_from,
		"preview_slot": slot,
		"preview_instance": instance_id,
	}
