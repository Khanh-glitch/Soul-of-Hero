class_name HeroSoulCombatAffixes
extends RefCounted

## Fail-closed runtime projection for the first player-facing Hero Soul affixes.
##
## The inventory item remains the source of truth. Only the exact instance ID
## selected by SaveService for a Hero Identity is read here; an `equipped` flag
## by itself can never activate an affix.

const RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

const MAX_CORE_PERCENT := 50.0
const MAX_ACTION_PERCENT := 60.0
# Keep the per-Soul projection aligned with the final cross-source combat cap;
# UI/debug snapshots must never advertise 40% when runtime clamps the combined
# skill-rank + milestone + Soul + gear total at 35%.
const MAX_COOLDOWN_REDUCTION_PERCENT := 35.0
const MAX_DEFENSE_PERCENT := 50.0

const LIVE_AFFIX_IDS := RULES.CANONICAL_LIVE_AFFIX_IDS

## Read compatibility only. SaveService rewrites these records to canonical
## affixes before committing the document.
const LEGACY_AFFIX_IDS := [
	"defense", "dodge", "defense_while_attacking", "stagger_resist",
	"low_hp_defense", "melee_threat_shield", "relay_shield",
	"damage_reduction",
	"stagger_resistance",
	"armor_penetration",
]
const LEGACY_CONVERTED_AFFIX_IDS := LEGACY_AFFIX_IDS # Compatibility alias.

## Fusion is a player-authored source, so its output must be immediately useful
## instead of rolling a future/display-only affix. Keep this contract beside the
## runtime consumer: when an affix or Hero action becomes live, there is one
## canonical place to update before Fusion can expose it.
const PROTOTYPE_HERO_ACTION_TAGS := {
	"sword_hero": [
		"melee", "normal_attack", "active", "summon", "departure", "relay", "dash",
	],
	"axe_hero": [
		"melee", "normal_attack", "active", "summon", "departure", "relay", "dash",
	],
	"archer_hero": [
		"ranged", "projectile", "normal_attack", "active", "summon", "departure", "relay", "dash",
	],
	"wizard_hero": [
		"magic", "area", "normal_attack", "active", "summon", "departure", "relay", "dash",
	],
}


static func prototype_fusion_roll_contract(hero_id: StringName) -> Dictionary:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	if not PROTOTYPE_HERO_ACTION_TAGS.has(normalized_hero):
		return {}
	return {
		"hero_id": normalized_hero,
		"supported_action_tags": PackedStringArray(
			PROTOTYPE_HERO_ACTION_TAGS[normalized_hero] as Array
		),
		"allowed_affix_ids": PackedStringArray(LIVE_AFFIX_IDS),
	}


static func selected_instance(save_snapshot: Dictionary, hero_id: StringName) -> Dictionary:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	if normalized_hero.is_empty():
		return {}
	var team_value: Variant = save_snapshot.get("soul_team", {})
	var inventory_value: Variant = save_snapshot.get("inventory", {})
	if not team_value is Dictionary or not inventory_value is Dictionary:
		return {}
	var selections_value: Variant = (team_value as Dictionary).get("selected_soul_instances", {})
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", [])
	if not selections_value is Dictionary or not souls_value is Array:
		return {}
	var selected_id := String((selections_value as Dictionary).get(normalized_hero, "")).strip_edges().to_lower()
	if selected_id.is_empty():
		return {}
	for raw_soul: Variant in souls_value:
		if not raw_soul is Dictionary:
			continue
		var soul := raw_soul as Dictionary
		if String(soul.get("instance_id", "")).strip_edges().to_lower() != selected_id:
			continue
		if String(soul.get("hero_id", "")).strip_edges().to_lower() != normalized_hero:
			return {}
		if not RULES.validate_instance(soul).is_empty():
			return {}
		return soul.duplicate(true)
	var storage_value: Variant = save_snapshot.get("storage", {})
	if storage_value is Dictionary:
		var stored_value: Variant = (storage_value as Dictionary).get("hero_weapons", [])
		if stored_value is Array:
			for raw_weapon: Variant in stored_value:
				if not raw_weapon is Dictionary:
					continue
				var weapon := raw_weapon as Dictionary
				if String(weapon.get("instance_id", "")).strip_edges().to_lower() == selected_id \
						and String(weapon.get("hero_id", "")).strip_edges().to_lower() == normalized_hero \
						and RULES.validate_instance(weapon).is_empty():
					return weapon.duplicate(true)
	return {}


static func derive(save_snapshot: Dictionary, hero_id: StringName) -> Dictionary:
	var soul := selected_instance(save_snapshot, hero_id)
	var result := _empty_projection(hero_id)
	if soul.is_empty():
		return result
	result["selected"] = true
	result["instance_id"] = String(soul.get("instance_id", ""))
	result["rarity"] = int(soul.get("rarity", 0))
	result["item_level"] = int(soul.get("item_level", 1))
	result["rarity_display_name"] = RULES.rarity_display_name_vi(int(result["rarity"]))
	result["affix_slot_capacity"] = RULES.affix_slot_count(int(result["rarity"]))
	result["affix_tier"] = RULES.affix_tier_for_rarity(int(result["rarity"]))
	result["weapon_damage_percent"] = RULES.weapon_damage_percent(
		int(result["rarity"]), int(result["item_level"])
	)
	result["weapon_damage_multiplier"] = float(result["weapon_damage_percent"]) / 100.0
	result["affinity"] = String(soul.get("affinity", "warrior"))
	result["variant_id"] = String(soul.get("variant_id", ""))

	var totals := {
		"max_hp": 0.0,
		"core_damage": 0.0,
		"max_mana": 0.0,
		"movement": 0.0,
		"dodge": 0.0,
		"healing_received": 0.0,
		"barrier_capacity": 0.0,
		"relay_barrier": 0.0,
		"normal_attack": 0.0,
		"active_power": 0.0,
		"summon_power": 0.0,
		"departure_power": 0.0,
		"cooldown": 0.0,
		"mana_efficiency": 0.0,
	}
	var applied: Array[Dictionary] = []
	var unsupported: Array[Dictionary] = []
	for raw_affix: Variant in soul.get("affixes", []):
		if not raw_affix is Dictionary:
			continue
		var affix := raw_affix as Dictionary
		var persisted_affix_id := String(affix.get("affix_id", "")).strip_edges().to_lower()
		var affix_id := RULES.canonical_affix_id(persisted_affix_id)
		var value := _safe_positive_percent(affix.get("value", 0.0))
		if (
			affix_id not in LIVE_AFFIX_IDS
		) or value <= 0.0:
			unsupported.append({
				"affix_id": affix_id,
				"value": value,
				"status": "not_yet_live",
			})
			continue
		match affix_id:
			"max_hp": totals["max_hp"] += value
			"core_damage": totals["core_damage"] += value
			"max_mana": totals["max_mana"] += value
			"movement": totals["movement"] += value
			"dodge": totals["dodge"] += value
			"healing_received": totals["healing_received"] += value
			"barrier_capacity": totals["barrier_capacity"] += value
			"relay_barrier": totals["relay_barrier"] += value
			"normal_attack_power", "melee_damage", "combo_power", \
					"heavy_hit_power", "execute_power", "close_range_damage", \
					"projectile_damage":
				totals["normal_attack"] += value
			"active_skill_power", "active_power": totals["active_power"] += value
			"summon_power": totals["summon_power"] += value
			"departure_power": totals["departure_power"] += value
			"cooldown_recovery", "active_cooldown": totals["cooldown"] += value
			"active_mana_cost": totals["mana_efficiency"] += value
		applied.append({
			"affix_id": affix_id,
			"display_name": String(RULES.affix_display_metadata(
				affix_id, value, int(result["affix_tier"])
			).get("display_name", affix_id)),
			"value": value,
			"status": "live",
			"effect": live_effect_copy(affix_id, value),
		})

	totals["max_hp"] = minf(MAX_CORE_PERCENT, float(totals["max_hp"]))
	totals["core_damage"] = minf(MAX_CORE_PERCENT, float(totals["core_damage"]))
	totals["max_mana"] = minf(MAX_CORE_PERCENT, float(totals["max_mana"]))
	totals["movement"] = minf(25.0, float(totals["movement"]))
	totals["dodge"] = minf(20.0, float(totals["dodge"]))
	totals["healing_received"] = minf(30.0, float(totals["healing_received"]))
	totals["barrier_capacity"] = minf(40.0, float(totals["barrier_capacity"]))
	totals["relay_barrier"] = minf(40.0, float(totals["relay_barrier"]))
	totals["normal_attack"] = minf(MAX_ACTION_PERCENT, float(totals["normal_attack"]))
	totals["active_power"] = minf(MAX_ACTION_PERCENT, float(totals["active_power"]))
	totals["summon_power"] = minf(MAX_ACTION_PERCENT, float(totals["summon_power"]))
	totals["departure_power"] = minf(MAX_ACTION_PERCENT, float(totals["departure_power"]))
	totals["cooldown"] = minf(MAX_COOLDOWN_REDUCTION_PERCENT, float(totals["cooldown"]))
	totals["mana_efficiency"] = minf(50.0, float(totals["mana_efficiency"]))

	result["percent_totals"] = totals
	result["max_hp_multiplier"] = 1.0 + float(totals["max_hp"]) / 100.0
	result["core_damage_multiplier"] = 1.0 + float(totals["core_damage"]) / 100.0
	result["max_mana_multiplier"] = 1.0 + float(totals["max_mana"]) / 100.0
	result["move_speed_multiplier"] = 1.0 + float(totals["movement"]) / 100.0
	result["dodge_chance_percent"] = float(totals["dodge"])
	result["healing_received_percent"] = float(totals["healing_received"])
	result["barrier_capacity_percent"] = float(totals["barrier_capacity"])
	result["relay_barrier_percent"] = float(totals["relay_barrier"])
	result["normal_attack_multiplier"] = 1.0 + float(totals["normal_attack"]) / 100.0
	result["active_power_multiplier"] = 1.0 + float(totals["active_power"]) / 100.0
	result["summon_power_multiplier"] = 1.0 + float(totals["summon_power"]) / 100.0
	result["departure_power_multiplier"] = 1.0 + float(totals["departure_power"]) / 100.0
	result["active_cooldown_multiplier"] = 1.0 - float(totals["cooldown"]) / 100.0
	result["active_mana_cost_multiplier"] = 1.0 - float(totals["mana_efficiency"]) / 100.0
	result["damage_taken_multiplier"] = 1.0
	result["attacking_damage_taken_multiplier"] = 1.0
	result["applied_live_affixes"] = applied
	result["unsupported_affixes"] = unsupported
	return result


static func action_damage_multiplier(projection: Dictionary, action_track: StringName) -> float:
	match String(action_track).strip_edges().to_lower():
		"normal_attack": return float(projection.get("normal_attack_multiplier", 1.0))
		"active_skill", "ultimate":
			return float(projection.get("active_power_multiplier", 1.0))
		"summon", "summon_skill": return float(projection.get("summon_power_multiplier", 1.0))
		"departure", "departure_skill": return float(projection.get("departure_power_multiplier", 1.0))
	return 1.0


static func is_live_affix(affix_id: String) -> bool:
	var normalized := affix_id.strip_edges().to_lower()
	return RULES.canonical_affix_id(normalized) in LIVE_AFFIX_IDS


static func live_effect_copy(affix_id: String, value: float) -> String:
	var amount := _number_copy(value)
	match RULES.canonical_affix_id(affix_id):
		"max_hp": return "+%s%% Max HP" % amount
		"core_damage": return "+%s%% Power" % amount
		"max_mana": return "+%s%% Max Mana" % amount
		"movement": return "+%s%% Movement Speed" % amount
		"dodge": return "+%s%% Dodge; successful dodge displays NÉ" % amount
		"healing_received": return "+%s%% Healing Received" % amount
		"barrier_capacity": return "+%s%% Max HP as visible Barrier" % amount
		"relay_barrier": return "+%s%% Max HP as visible Barrier on Relay" % amount
		"normal_attack_power", "melee_damage", "combo_power", "heavy_hit_power", \
				"execute_power", "close_range_damage", "projectile_damage":
			return "+%s%% Normal Attack damage" % amount
		"active_skill_power", "active_power": return "+%s%% Active Skill damage" % amount
		"summon_power": return "+%s%% Soul Summon damage" % amount
		"departure_power": return "+%s%% Soul Departure damage" % amount
		"cooldown_recovery", "active_cooldown": return "-%s%% Active Skill cooldown" % amount
		"active_mana_cost": return "-%s%% Active Skill Mana cost" % amount
	return "Not yet live"


static func _empty_projection(hero_id: StringName) -> Dictionary:
	return {
		"hero_id": String(hero_id),
		"selected": false,
		"instance_id": "",
		"rarity": -1,
		"item_level": 0,
		"rarity_display_name": "",
		"affix_slot_capacity": 0,
		"affix_tier": 0,
		"weapon_damage_percent": 100.0,
		"weapon_damage_multiplier": 1.0,
		"affinity": "",
		"variant_id": "",
		"percent_totals": {},
		"max_hp_multiplier": 1.0,
		"core_damage_multiplier": 1.0,
		"max_mana_multiplier": 1.0,
		"move_speed_multiplier": 1.0,
		"dodge_chance_percent": 0.0,
		"healing_received_percent": 0.0,
		"barrier_capacity_percent": 0.0,
		"relay_barrier_percent": 0.0,
		"normal_attack_multiplier": 1.0,
		"active_power_multiplier": 1.0,
		"summon_power_multiplier": 1.0,
		"departure_power_multiplier": 1.0,
		"active_cooldown_multiplier": 1.0,
		"active_mana_cost_multiplier": 1.0,
		"damage_taken_multiplier": 1.0,
		"attacking_damage_taken_multiplier": 1.0,
		"applied_live_affixes": [],
		"unsupported_affixes": [],
	}


static func _safe_positive_percent(value: Variant) -> float:
	if not value is int and not value is float:
		return 0.0
	var numeric := float(value)
	if not is_finite(numeric):
		return 0.0
	return clampf(numeric, 0.0, 1000.0)


static func _number_copy(value: float) -> String:
	var result := "%.2f" % value
	while result.contains(".") and result.ends_with("0"):
		result = result.trim_suffix("0")
	return result.trim_suffix(".")
