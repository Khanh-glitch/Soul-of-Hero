class_name HeroProgressionRules
extends RefCounted

## Per-Hero progression. Account/player level is retained only as legacy UI
## data; combat growth and every XP source use these records.

const PLAYER_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const SKILL_KIT_RULES := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const LEVEL_CAP := PLAYER_RULES.PLAYER_LEVEL_CAP
const DEFAULT_ENEMY_LEVELS_PER_STAGE := 5


static func empty_record(hero_id: StringName) -> Dictionary:
	return {
		"level": 1,
		"xp": 0,
		"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
		"skill_allocations": PLAYER_RULES.empty_skill_tracks(),
		"base_stats": SKILL_KIT_RULES.base_stats(hero_id),
	}


static func xp_required_for_level(level: int) -> int:
	return PLAYER_RULES.xp_required_for_level(level)


static func level_cap_for_average_enemy_level(average_enemy_level: int) -> int:
	return clampi(maxi(1, average_enemy_level), 1, LEVEL_CAP)


static func default_average_enemy_level(campaign_slot: int) -> int:
	return maxi(1, campaign_slot) * DEFAULT_ENEMY_LEVELS_PER_STAGE


static func resolve_experience_gain(
		level: int,
		xp: int,
		amount: int,
		average_enemy_level_cap: int,
) -> Dictionary:
	var start_level := clampi(level, 1, LEVEL_CAP)
	var current_level := start_level
	var current_xp := maxi(0, xp)
	var level_cap := level_cap_for_average_enemy_level(average_enemy_level_cap)
	if current_level >= level_cap:
		return {
			"level": current_level,
			"xp": 0,
			"xp_required": xp_required_for_level(current_level),
			"levels_gained": 0,
			"xp_applied": 0,
			"xp_discarded": maxi(0, amount),
			"level_cap": level_cap,
			"capped": true,
		}
	var remaining := maxi(0, amount)
	var applied := 0
	while remaining > 0 and current_level < level_cap:
		var required := xp_required_for_level(current_level)
		current_xp = mini(current_xp, required - 1)
		var accepted := mini(remaining, required - current_xp)
		current_xp += accepted
		remaining -= accepted
		applied += accepted
		if current_xp >= required:
			current_level += 1
			current_xp = 0
	if current_level >= level_cap:
		current_xp = 0
	return {
		"level": current_level,
		"xp": current_xp,
		"xp_required": xp_required_for_level(current_level),
		"levels_gained": current_level - start_level,
		"xp_applied": applied,
		"xp_discarded": remaining,
		"level_cap": level_cap,
		"capped": current_level >= level_cap,
	}


static func combat_stats(hero_id: StringName, record: Dictionary) -> Dictionary:
	var base := SKILL_KIT_RULES.base_stats(hero_id)
	var level := clampi(int(record.get("level", 1)), 1, LEVEL_CAP)
	var allocation_value: Variant = record.get("stat_allocation", {})
	var allocation: Dictionary = allocation_value if allocation_value is Dictionary else {}
	var legacy_projection := PLAYER_RULES.stat_snapshot(level, allocation)
	var legacy_base_hp := maxf(1.0, PLAYER_RULES.BASE_HP)
	var legacy_base_mana := maxf(1.0, PLAYER_RULES.BASE_MANA)
	var hp_growth := float(legacy_projection.get("hp", legacy_base_hp)) - legacy_base_hp
	var mana_growth := float(legacy_projection.get("mana", legacy_base_mana)) - legacy_base_mana
	var power_multiplier := float(legacy_projection.get("damage", PLAYER_RULES.BASE_DAMAGE)) \
		/ maxf(1.0, PLAYER_RULES.BASE_DAMAGE)
	return {
		"level": level,
		"max_hp": maxf(1.0, float(base["max_hp"]) + hp_growth),
		"power": maxf(1.0, float(base["power"]) * power_multiplier),
		"max_mana": maxf(0.0, float(base["max_mana"]) + mana_growth),
		"move_speed": float(base["move_speed"]),
	}
