class_name AuxiliaryEquipmentDefinitions
extends RefCounted

## Canonical data for the three universal item families. Any Hero can equip an
## instance, but the same physical instance belongs to only one Hero at once.
##
## These definitions intentionally have no SaveService, scene, Hero, or
## progression dependency. Runtime/UI layers may query them, but cannot invent
## alternate rarity IDs, unlock levels, primaries, or cross-slot affix pools.

const SLOT_SOUL_VESSEL := "soul_vessel"
const SLOT_SOUL_BOOTS := "soul_boots"
const SLOT_SOUL_TRACE := "soul_trace"
## Save migration may still inspect this key, but it is never a live equipment
## slot. Crystals are stackable upgrade materials from equipment schema v2 on.
const LEGACY_SLOT_SOUL_FOCUS := "soul_focus"
const SLOT_IDS := [SLOT_SOUL_VESSEL, SLOT_SOUL_BOOTS, SLOT_SOUL_TRACE]

## The first random equipment lesson intentionally exposes only effects that
## are already applied by the live combat pipeline and are readable without a
## conditional trigger, relay state, or hidden proc rule.
const SIMPLE_LIVE_AFFIX_IDS := {
	SLOT_SOUL_VESSEL: ["max_hp_percent", "barrier_capacity_percent"],
	SLOT_SOUL_BOOTS: ["movement_speed_percent", "dodge_chance_percent"],
	SLOT_SOUL_TRACE: ["damage_percent"],
}

## Canonical intersection with the effects consumed by
## AuxiliaryEquipmentCombatStats and HeroSoulManager.  Random generation must
## use this map instead of the larger persistence/catalog pool: the remaining
## authored affixes are valid for old saves and previews but are not LIVE yet.
const LIVE_AFFIX_IDS := {
	SLOT_SOUL_VESSEL: [
		"max_hp_percent", "barrier_capacity_percent", "armor_power_percent", "health_regen",
		"healing_received", "armor_mana_percent",
	],
	SLOT_SOUL_BOOTS: [
		"movement_speed_percent", "dodge_chance_percent", "dash_cooldown_rate", "dash_speed_percent",
		"boots_power_percent", "max_hp_from_boots_percent",
	],
	SLOT_SOUL_TRACE: [
		"damage_percent", "mana_percent", "mana_regen", "cooldown_rate",
		"mana_efficiency",
	],
}

const RARITY_IDS := [
	"normal",
	"magic",
	"rare",
	"epic",
	"legendary",
	"crystal",
	"mythic",
	"eternal",
]
const RARITY_AFFIX_COUNTS := [0, 1, 2, 3, 4, 4, 4, 5]
const RARITY_SELL_WEIGHTS := [1, 3, 9, 27, 81, 243, 729, 2187]
const RARITY_ROLL_MULTIPLIERS := [0.80, 0.90, 1.00, 1.12, 1.25, 1.38, 1.52, 1.70]

const MIN_ITEM_LEVEL := 1
const MAX_ITEM_LEVEL := 100
const VALID_UNITS := ["flat", "percent", "flat_per_second", "percent_per_second"]

const SLOT_DEFINITIONS := {
	SLOT_SOUL_VESSEL: {
		"unlock_level": 2,
		"primary": {
			"stat_id": "max_hp_flat",
			"unit": "flat",
			"min": 80.0,
			"max": 180.0,
		},
		"affixes": {
			"max_hp_percent": {"unit": "percent", "min": 2.0, "max": 5.0},
			"barrier_capacity_percent": {"unit": "percent", "min": 3.0, "max": 7.0},
			"armor_power_percent": {"unit": "percent", "min": 2.0, "max": 5.0},
			"health_regen": {"unit": "percent_per_second", "min": 0.15, "max": 0.50},
			"healing_received": {"unit": "percent", "min": 3.0, "max": 8.0},
			"armor_mana_percent": {"unit": "percent", "min": 3.0, "max": 7.0},
		},
	},
	SLOT_SOUL_BOOTS: {
		"unlock_level": 4,
		"primary": {
			"stat_id": "movement_speed",
			"unit": "percent",
			"min": 2.0,
			"max": 5.0,
		},
		"affixes": {
			"movement_speed_percent": {"unit": "percent", "min": 1.0, "max": 3.0},
			"dodge_chance_percent": {"unit": "percent", "min": 1.0, "max": 2.5},
			"dash_cooldown_rate": {"unit": "percent", "min": 2.0, "max": 6.0},
			"dash_speed_percent": {"unit": "percent", "min": 3.0, "max": 8.0},
			"boots_power_percent": {"unit": "percent", "min": 1.5, "max": 4.0},
			"max_hp_from_boots_percent": {"unit": "percent", "min": 1.0, "max": 3.0},
		},
	},
	SLOT_SOUL_TRACE: {
		"unlock_level": 7,
		"primary": {
			"stat_id": "damage_flat",
			"unit": "flat",
			"min": 10.0,
			"max": 30.0,
		},
		"affixes": {
			"damage_percent": {"unit": "percent", "min": 2.0, "max": 6.0},
			"mana_percent": {"unit": "percent", "min": 2.0, "max": 6.0},
			"mana_regen": {"unit": "flat_per_second", "min": 0.20, "max": 0.70},
			"cooldown_rate": {"unit": "percent", "min": 2.0, "max": 6.0},
			"mana_efficiency": {"unit": "percent", "min": 2.0, "max": 7.0},
		},
	},
}


static func is_valid_slot(slot_id: String) -> bool:
	return slot_id in SLOT_IDS


static func is_valid_rarity(rarity_id: String) -> bool:
	return rarity_id in RARITY_IDS


static func rarity_index(rarity_id: String) -> int:
	return RARITY_IDS.find(rarity_id)


static func affix_count(rarity_id: String) -> int:
	var index := rarity_index(rarity_id)
	return RARITY_AFFIX_COUNTS[index] if index >= 0 else -1


static func sell_weight(rarity_id: String) -> int:
	var index := rarity_index(rarity_id)
	return RARITY_SELL_WEIGHTS[index] if index >= 0 else 0


static func roll_multiplier(rarity_id: String) -> float:
	var index := rarity_index(rarity_id)
	return RARITY_ROLL_MULTIPLIERS[index] if index >= 0 else 0.0


static func slot_definition(slot_id: String) -> Dictionary:
	if not is_valid_slot(slot_id):
		return {}
	return (SLOT_DEFINITIONS[slot_id] as Dictionary).duplicate(true)


static func unlock_level(slot_id: String) -> int:
	if not is_valid_slot(slot_id):
		return 0
	return int((SLOT_DEFINITIONS[slot_id] as Dictionary)["unlock_level"])


static func primary_definition(slot_id: String) -> Dictionary:
	if not is_valid_slot(slot_id):
		return {}
	return ((SLOT_DEFINITIONS[slot_id] as Dictionary)["primary"] as Dictionary).duplicate(true)


static func affix_definitions(slot_id: String) -> Dictionary:
	if not is_valid_slot(slot_id):
		return {}
	return ((SLOT_DEFINITIONS[slot_id] as Dictionary)["affixes"] as Dictionary).duplicate(true)


static func simple_live_affix_ids(slot_id: String) -> PackedStringArray:
	if not SIMPLE_LIVE_AFFIX_IDS.has(slot_id):
		return PackedStringArray()
	return PackedStringArray(SIMPLE_LIVE_AFFIX_IDS[slot_id])


static func live_affix_ids(slot_id: String) -> PackedStringArray:
	if not LIVE_AFFIX_IDS.has(slot_id):
		return PackedStringArray()
	return PackedStringArray(LIVE_AFFIX_IDS[slot_id])


static func get_catalog_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if RARITY_IDS.size() != 8 or RARITY_AFFIX_COUNTS.size() != 8 \
			or RARITY_SELL_WEIGHTS.size() != 8 or RARITY_ROLL_MULTIPLIERS.size() != 8:
		errors.append("Auxiliary equipment requires exactly eight aligned rarity definitions.")
	if SLOT_IDS.size() != 3:
		errors.append("Auxiliary equipment requires exactly three shared slots.")
	var seen_rarities := {}
	for index: int in RARITY_IDS.size():
		var rarity_id := String(RARITY_IDS[index])
		if not _is_valid_id(rarity_id) or seen_rarities.has(rarity_id):
			errors.append("Invalid or duplicate rarity ID '%s'." % rarity_id)
		seen_rarities[rarity_id] = true
		if int(RARITY_AFFIX_COUNTS[index]) < 0:
			errors.append("Rarity '%s' has a negative affix count." % rarity_id)
		if int(RARITY_SELL_WEIGHTS[index]) <= 0 or float(RARITY_ROLL_MULTIPLIERS[index]) <= 0.0:
			errors.append("Rarity '%s' has invalid economy or roll weight." % rarity_id)

	var seen_stats := {}
	for slot_id: String in SLOT_IDS:
		if not SLOT_DEFINITIONS.has(slot_id) or not _is_valid_id(slot_id):
			errors.append("Missing or invalid slot definition '%s'." % slot_id)
			continue
		var definition: Dictionary = SLOT_DEFINITIONS[slot_id]
		if int(definition.get("unlock_level", 0)) < 1:
			errors.append("Slot '%s' requires a positive unlock level." % slot_id)
		var primary: Variant = definition.get("primary", {})
		if not primary is Dictionary:
			errors.append("Slot '%s' primary must be a Dictionary." % slot_id)
		else:
			_validate_stat_definition(errors, slot_id, String((primary as Dictionary).get("stat_id", "")), primary as Dictionary)
		var affixes: Variant = definition.get("affixes", {})
		if not affixes is Dictionary or (affixes as Dictionary).size() < 5:
			errors.append("Slot '%s' requires an affix pool of at least five entries." % slot_id)
			continue
		for raw_affix_id: Variant in (affixes as Dictionary).keys():
			var affix_id := String(raw_affix_id)
			_validate_stat_definition(errors, slot_id, affix_id, (affixes as Dictionary)[raw_affix_id])
			if seen_stats.has(affix_id):
				errors.append("Affix '%s' leaks across slots '%s' and '%s'." % [affix_id, seen_stats[affix_id], slot_id])
			else:
				seen_stats[affix_id] = slot_id
	var simple_vessel_affixes := simple_live_affix_ids(SLOT_SOUL_VESSEL)
	if simple_vessel_affixes != PackedStringArray(["max_hp_percent", "barrier_capacity_percent"]):
		errors.append("Armor simple LIVE affixes must be Max HP and visible Barrier.")
	if simple_live_affix_ids(SLOT_SOUL_BOOTS) != PackedStringArray([
		"movement_speed_percent", "dodge_chance_percent",
	]):
		errors.append("Soul Boots simple LIVE affixes must be Movement and visible Dodge.")
	if simple_live_affix_ids(SLOT_SOUL_TRACE) != PackedStringArray(["damage_percent"]):
		errors.append("Soul Trace simple LIVE affix must be damage_percent.")
	for slot_id: String in SLOT_IDS:
		var slot_pool := affix_definitions(slot_id)
		var live_ids := live_affix_ids(slot_id)
		if live_ids.is_empty():
			errors.append("Slot '%s' requires at least one LIVE affix." % slot_id)
		for affix_id: String in live_ids:
			if not slot_pool.has(affix_id):
				errors.append("LIVE affix '%s' is missing from slot '%s'." % [affix_id, slot_id])
		for affix_id: String in simple_live_affix_ids(slot_id):
			if not live_ids.has(affix_id):
				errors.append("Simple affix '%s' is not in slot '%s' LIVE pool." % [affix_id, slot_id])
	return errors


## Old saves can contain mitigation-named rolls. They are mapped at the save
## boundary to explicit effects a player can see happen: a cyan Barrier pool,
## a NÉ/0-DAMAGE proc, or sheet Power. No retired affix becomes anonymous HP.
static func canonical_affix_id(affix_id: String) -> String:
	var normalized := affix_id.strip_edges().to_lower()
	return String({
		"damage_reduction": "barrier_capacity_percent",
		"guard_while_attacking": "armor_power_percent",
		"footwork_damage_reduction": "dodge_chance_percent",
	}.get(normalized, normalized))


static func _validate_stat_definition(
		errors: PackedStringArray,
		slot_id: String,
		stat_id: String,
		definition: Variant
) -> void:
	if not _is_valid_id(stat_id):
		errors.append("Slot '%s' contains invalid stat ID '%s'." % [slot_id, stat_id])
	if not definition is Dictionary:
		errors.append("Stat '%s' definition must be a Dictionary." % stat_id)
		return
	var stat: Dictionary = definition
	var unit := String(stat.get("unit", ""))
	var minimum: Variant = stat.get("min", 0.0)
	var maximum: Variant = stat.get("max", 0.0)
	if unit not in VALID_UNITS:
		errors.append("Stat '%s' has unsupported unit '%s'." % [stat_id, unit])
	if (not minimum is int and not minimum is float) or (not maximum is int and not maximum is float):
		errors.append("Stat '%s' bounds must be numeric." % stat_id)
	elif not is_finite(float(minimum)) or not is_finite(float(maximum)) \
			or float(minimum) <= 0.0 or float(maximum) < float(minimum):
		errors.append("Stat '%s' bounds are invalid." % stat_id)


static func _is_valid_id(value: String) -> bool:
	if value.is_empty():
		return false
	var previous_underscore := false
	for index: int in value.length():
		var code := value.unicode_at(index)
		var is_letter := code >= 97 and code <= 122
		var is_digit := code >= 48 and code <= 57
		if index == 0 and not is_letter:
			return false
		if not is_letter and not is_digit and code != 95:
			return false
		if code == 95:
			if previous_underscore:
				return false
			previous_underscore = true
		else:
			previous_underscore = false
	return not previous_underscore
