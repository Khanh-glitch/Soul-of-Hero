class_name HeroSkillKitRules
extends RefCounted

const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")

## Authoritative Hero Weapon skill-kit and rank contract.
##
## A Hero Weapon selects the kit band from its rarity and rolls five total
## ranks across its two active skills.  The higher kit bands intentionally have
## stronger authored coefficients: an Epic 1/1 weapon must feel like a kit
## upgrade instead of a Rare weapon whose ranks were reset.

enum KitTier {
	BASIC = 0,
	ADVANCED = 1,
	LEGENDARY_PLUS = 2,
}

const KIT_IDS := [&"basic", &"advanced", &"legendary_plus"]
const TOTAL_RANKS_BY_RARITY := [2, 4, 6, 2, 6, 2, 4, 6]
const VALID_SPLITS_BY_TOTAL := {
	2: [Vector2i(1, 1)],
	4: [Vector2i(1, 3), Vector2i(2, 2), Vector2i(3, 1)],
	6: [Vector2i(1, 5), Vector2i(2, 4), Vector2i(3, 3), Vector2i(4, 2), Vector2i(5, 1)],
}
const RANK_MULTIPLIERS := [0.76, 0.88, 1.0, 1.14, 1.30]
## Rank 3 is the authored baseline. Damage uses RANK_MULTIPLIERS above; these
## curves make the rest of a skill's readable parameters move with its rank.
const RANK_COOLDOWN_MULTIPLIERS := [1.12, 1.06, 1.0, 0.94, 0.88]
const RANK_MANA_MULTIPLIERS := [1.08, 1.04, 1.0, 0.97, 0.94]
const RANK_CHARGE_TIME_MULTIPLIERS := [1.10, 1.05, 1.0, 0.95, 0.90]
const RANK_POSITIVE_PARAMETER_MULTIPLIERS := [0.90, 0.95, 1.0, 1.06, 1.12]
## Lowest roll of a new kit remains above the strongest rank of the old kit.
const KIT_BASE_POWER_MULTIPLIERS := [1.0, 1.75, 3.05]

const HERO_BASE_STATS := {
	"sword_hero": {"max_hp": 1100.0, "power": 20.0, "max_mana": 110.0, "move_speed": 1.00},
	"archer_hero": {"max_hp": 850.0, "power": 22.0, "max_mana": 90.0, "move_speed": 1.08},
	"axe_hero": {"max_hp": 1450.0, "power": 30.0, "max_mana": 70.0, "move_speed": 0.88},
	"wizard_hero": {"max_hp": 800.0, "power": 17.0, "max_mana": 140.0, "move_speed": 0.96},
}

## This catalog is both runtime data and the balance specification used by UI.
## Numeric values describe rank-3 values before the kit multiplier.
const KIT_CATALOG := {
	"sword_hero": {
		"strength": "Cân bằng, combo nhanh và cơ động.",
		"basic": {
			"active_1": {"id": "knight_shadow_double", "name": "Song Ảnh", "aim": "self", "mana": 22.0, "duration": 4.0, "cooldown": 5.0, "cooldown_anchor": "effect_end", "damage_ratio": 1.60, "move_speed": 1.50},
			"active_2": {"id": "knight_fan_charge", "name": "Trảm Quạt Tụ Lực", "aim": "charge_cone", "mana": 0.0, "charge": 4.0, "cooldown": 10.0, "damage_ratio_min": 0.0, "damage_ratio_max": 2.00, "stun": 2.0, "charge_move_speed": 0.20, "invulnerable_while_charging": true, "overcharge_cancels": true},
		},
		"advanced": {
			"active_1": {"id": "soul_echo", "name": "Soul Echo", "aim": "self", "legacy_rank_3": true},
			"active_2": {"id": "knight_cavalry_charge", "name": "Phi Mã", "aim": "line", "legacy_rank_3": true},
		},
		"legendary_plus": {
			"passive": {"id": "knight_five_hit_cavalry", "combo_hits": 5, "combo_speed": 2.0, "inserted_hit": 3, "final_requires_previous_hit": true, "short_pass_only": true},
			"soul": {"id": "knight_cavalry_guard", "name": "Băng Xích Thố Hộ Tống", "follows_active": true},
			"departure": {"id": "knight_phantom_combo", "name": "Ảo Ảnh NgÅ© Liên", "combo_count": 1, "combo_hits": 5, "speed": 3.0, "target": "highest_hp_visible"},
		},
	},
	"archer_hero": {
		"strength": "Tầm xa, chọn vị trí và độ chính xác.",
		"basic": {
			"active_1": {"id": "archer_wind_arrow", "name": "Phong Tiễn", "aim": "self", "mana": 18.0, "charges": 3, "duration": 6.0, "side_arrow_ratio": 0.35, "cooldown": 6.0, "cooldown_anchor": "effect_end"},
			"active_2": {"id": "archer_heart_piercer", "name": "Nhất Tiễn Xuyên Tâm", "aim": "charge_line", "mana": 25.0, "charge": 2.5, "cooldown": 10.0, "damage_ratio_min": 0.80, "damage_ratio_max": 2.80, "penetration_decay": 0.15, "penetration_floor": 0.55, "full_charge_stun": 2.0, "boss_stun": 0.75, "charge_move_speed": 0.35, "auto_release": true},
		},
		"advanced": {
			"active_1": {"id": "archer_soul_mark", "name": "Soul Mark", "aim": "single_target", "legacy_rank_3": true},
			"active_2": {"id": "archer_infinite_arrows", "name": "Vô Hạn Tiễn", "aim": "area", "legacy_rank_3": true},
		},
		"legendary_plus": {
			"passive": {"id": "archer_four_hit_focus", "combo_hits": 4, "combo_speed": 1.5, "focus_max": 4, "echo_delay": 0.18, "echo_ratio": 0.40, "parallel_line_target_cap": 2},
			"soul": {"id": "archer_phantom_crossfire", "name": "Tứ Ảnh Hộ Tiễn", "phantoms": 4, "duration": 4.0, "interval": 0.6, "target": "highest_hp_visible"},
			"departure": {"id": "archer_triple_sweep", "name": "Tam Hướng Xuyên Tâm", "sweeps": 2, "finishers": 3, "target": "highest_hp_or_marked"},
		},
	},
	"axe_hero": {
		"strength": "Nhiều máu, đòn nặng và stagger cao; di chuyển chậm.",
		"unlock": "story_only",
		"basic": {
			"active_1": {"id": "axe_whirl", "name": "Toàn Phủ", "aim": "self", "mana": 20.0, "cooldown": 7.0, "damage_ratio": 1.40, "prepare_move_speed": 0.40, "edge_pull": true, "knockback": "small"},
			"active_2": {"id": "axe_execution", "name": "Trảm Quyết", "aim": "single_target", "mana": 30.0, "cooldown": 12.0, "damage_ratio": 2.20, "missing_hp_bonus_max": 1.80, "damage_ratio_max": 4.00, "execute_marker_hp_ratio": 0.25, "instant_kill": false, "stun": 1.5, "boss_stun": 0.5},
		},
		"advanced": {
			"active_1": {"id": "axe_throw_recall", "name": "Throw & Recall", "aim": "line", "legacy_rank_3": true},
			"active_2": {"id": "axe_blood_wheel", "name": "Huyết Luân", "aim": "area", "mana": 32.0, "duration": 3.0, "cooldown": 11.0, "cooldown_anchor": "axe_return", "early_recall": true},
		},
		"legendary_plus": {
			"passive": {"id": "axe_phantom_cleave", "charge_speed": 1.4, "phantom_delay": 0.25, "phantom_ratio": 0.65, "fracture_detonation_ratio": 1.20},
			"soul": {"id": "axe_triangular_slam", "name": "Tam Phủ Trấn Địa", "axes": 3, "pull_to_center": true, "stun": true},
			"departure": {"id": "axe_tidal_axes", "name": "Vạn Phủ Hồi Triều", "axes": 5, "target": "highest_hp_visible", "stun": true},
		},
	},
	"wizard_hero": {
		"strength": "Nhiều mana, AoE và setup mạnh; ít máu.",
		"basic": {
			"active_1": {"id": "wizard_shade_prison", "name": "Ảnh Tù", "aim": "single_target", "mana": 20.0, "duration": 2.0, "cooldown": 7.0, "damage_ratio": 1.50, "boss_control": "visible_slow"},
			"active_2": {"id": "wizard_black_sun", "name": "Hắc Nhật", "aim": "charge_area", "mana": 32.0, "charge": 1.5, "duration": 2.0, "cooldown": 12.0, "damage_ratio_min": 1.60, "damage_ratio_max": 2.60, "stationary": true, "invulnerable_while_charging": false},
		},
		"advanced": {
			"active_1": {"id": "wizard_dark_passage", "name": "Dark Passage", "aim": "area", "legacy_rank_3": true},
			"active_2": {"id": "wizard_raise_defeated", "name": "Raise Defeated", "aim": "area", "legacy_rank_3": true},
		},
		"legendary_plus": {
			"passive": {"id": "wizard_dark_network", "unique_bounces": 3, "network_min_points": 3, "line_damage_ratio": 0.45, "line_internal_cooldown": true, "passage_detonates_network": true},
			"soul": {"id": "wizard_soul_matrix", "name": "Ma Trận Hồi Hồn", "duration": 5.0, "soul_max": 5, "follows_active": true},
			"departure": {"id": "wizard_grand_grave_collapse", "name": "Đại Mộ Sụp Đổ", "target": "highest_hp_visible", "base_explosion_without_points": true, "final_black_sun": true},
		},
	},
}

## K-Night replaces the legacy Sword kit without rewriting the other hero
## catalog entries. Keeping this override explicit also protects old save IDs.
const K_NIGHT_KIT_CATALOG := {
	"strength": "Combo bốn nhịp, truy kích hành quyết và dư ảnh âm giới.",
	"basic": {
		"active_1": {
			"id": "k_night_warrior_soul",
			"name": "Linh Hồn Chiến Binh",
			"aim": "self",
			"k_night_exact_profile": true,
		},
		"active_2": {
			"id": "k_night_soul_cleave",
			"name": "Đoạt Hồn Trảm",
			"aim": "cone",
			"k_night_exact_profile": true,
		},
		"soul": {
			"id": "k_night_soul_guardian",
			"name": "Hộ Vệ Linh Tử",
			"cooldown": 20.0,
		},
		"departure": {
			"id": "k_night_final_breath",
			"name": "Hơi Thở Cuối Cùng",
		},
	},
	"advanced": {
		"active_1": {
			"id": "k_night_void_phantom",
			"name": "Hư Ảnh",
			"aim": "self",
			"k_night_exact_profile": true,
		},
		"active_2": {
			"id": "k_night_underworld_legion",
			"name": "Binh Đoàn Âm Giới",
			"aim": "line",
			"k_night_exact_profile": true,
		},
		"soul": {
			"id": "k_night_soul_guardian",
			"name": "Hộ Vệ Linh Tử",
			"cooldown": 20.0,
		},
		"departure": {
			"id": "k_night_final_breath",
			"name": "Hơi Thở Cuối Cùng",
		},
	},
	"legendary_plus": {
		"passive": {"id": "k_night_four_hit_execution", "combo_hits": 4},
		"soul": {
			"id": "k_night_revenge_legion",
			"name": "Binh Đoàn Báo Thù",
			"duration": 5.0,
			"cooldown": 30.0,
		},
		"departure": {
			"id": "k_night_vengeful_soul",
			"name": "Oán Hồn",
			"duration": 5.0,
			"speed": 3.0,
			"target": "lowest_hp_visible",
		},
	},
}


static func kit_tier_for_rarity(rarity: int) -> int:
	if rarity >= 5:
		return KitTier.LEGENDARY_PLUS
	if rarity >= 3:
		return KitTier.ADVANCED
	return KitTier.BASIC


static func kit_id_for_rarity(rarity: int) -> StringName:
	return KIT_IDS[kit_tier_for_rarity(rarity)]


static func total_ranks_for_rarity(rarity: int) -> int:
	if rarity < 0 or rarity >= TOTAL_RANKS_BY_RARITY.size():
		return 0
	return TOTAL_RANKS_BY_RARITY[rarity]


static func roll_skill_ranks(rarity: int, seed: int, stable_key := "") -> Dictionary:
	var total := total_ranks_for_rarity(rarity)
	var choices: Array = VALID_SPLITS_BY_TOTAL.get(total, [])
	if choices.is_empty():
		return {"active_1": 1, "active_2": 1}
	var mixed_seed := seed ^ stable_key.hash() ^ (rarity * 104729)
	var index := posmod(mixed_seed, choices.size())
	var split: Vector2i = choices[index]
	return {"active_1": split.x, "active_2": split.y}


static func validate_skill_ranks(rarity: int, ranks: Dictionary) -> bool:
	var first := int(ranks.get("active_1", 0))
	var second := int(ranks.get("active_2", 0))
	return first >= 1 and first <= 5 and second >= 1 and second <= 5 \
		and first + second == total_ranks_for_rarity(rarity)


static func rank_multiplier(rank: int) -> float:
	return RANK_MULTIPLIERS[clampi(rank, 1, 5) - 1]


static func effective_skill_multiplier(rarity: int, rank: int) -> float:
	return KIT_BASE_POWER_MULTIPLIERS[kit_tier_for_rarity(rarity)] * rank_multiplier(rank)


static func rank_adjusted_profile(profile: Dictionary, rank: int) -> Dictionary:
	if bool(profile.get("k_night_exact_profile", false)):
		return KNightRules.skill_profile(StringName(profile.get("id", &"")), rank)
	var result := profile.duplicate(true)
	var index := clampi(rank, 1, 5) - 1
	var positive := float(RANK_POSITIVE_PARAMETER_MULTIPLIERS[index])
	result["skill_rank"] = index + 1
	result["rank_damage_multiplier"] = float(RANK_MULTIPLIERS[index])
	if result.has("cooldown"):
		result["cooldown"] = float(result["cooldown"]) \
			* float(RANK_COOLDOWN_MULTIPLIERS[index])
	if result.has("mana"):
		result["mana"] = float(result["mana"]) * float(RANK_MANA_MULTIPLIERS[index])
	if result.has("charge"):
		result["charge"] = float(result["charge"]) \
			* float(RANK_CHARGE_TIME_MULTIPLIERS[index])
	for key: String in [
		"duration", "range", "radius", "cone_degrees", "width", "stun",
		"boss_stun", "full_charge_stun",
	]:
		if result.has(key):
			result[key] = float(result[key]) * positive
	for movement_key: String in ["move_speed", "charge_move_speed", "prepare_move_speed"]:
		if not result.has(movement_key):
			continue
		var authored := clampf(float(result[movement_key]), 0.0, 4.0)
		if authored >= 1.0:
			result[movement_key] = 1.0 + (authored - 1.0) * positive
		else:
			# Higher ranks loosen movement penalties without ever removing them.
			result[movement_key] = clampf(
				authored + (1.0 - authored) * (positive - 1.0), 0.05, 0.95
			)
	return result


static func kit_snapshot(hero_id: StringName, rarity: int, ranks: Dictionary = {}) -> Dictionary:
	var normalized := String(hero_id).strip_edges().to_lower()
	var hero: Dictionary = (
		K_NIGHT_KIT_CATALOG
		if normalized == "sword_hero"
		else KIT_CATALOG.get(normalized, {})
	)
	if hero.is_empty():
		return {}
	var kit_id := String(kit_id_for_rarity(rarity))
	var result: Dictionary = (hero.get(kit_id, {}) as Dictionary).duplicate(true)
	if kit_id == "legendary_plus":
		var advanced: Dictionary = hero.get("advanced", {})
		result["active_1"] = (advanced.get("active_1", {}) as Dictionary).duplicate(true)
		result["active_2"] = (advanced.get("active_2", {}) as Dictionary).duplicate(true)
	result["hero_id"] = normalized
	result["kit_id"] = kit_id
	result["kit_tier"] = kit_tier_for_rarity(rarity)
	result["skill_ranks"] = ranks.duplicate(true)
	result["kit_power_multiplier"] = KIT_BASE_POWER_MULTIPLIERS[kit_tier_for_rarity(rarity)]
	result["strength"] = String(hero.get("strength", ""))
	return result


static func base_stats(hero_id: StringName) -> Dictionary:
	return (HERO_BASE_STATS.get(String(hero_id), HERO_BASE_STATS["sword_hero"]) as Dictionary).duplicate(true)
