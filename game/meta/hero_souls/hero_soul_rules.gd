class_name HeroSoulRules
extends RefCounted

## Pure, deterministic rules for owned Hero Weapon items.
##
## HeroDefinition describes an identity/kit. A Hero Soul dictionary describes
## the individual item the player owns. Keeping these rules free of scene and
## save dependencies makes loot, shop, fusion and tests share one contract.

enum Rarity {
	NORMAL = 0,
	COMMON = 0, # Compatibility alias for prototype saves and callers.
	MAGIC = 1,
	RARE = 2,
	EPIC = 3,
	LEGENDARY = 4,
	CRYSTAL = 5,
	MYTHIC = 6,
	ETERNAL = 7,
}

const RARITY_NAMES := [
	"Normal",
	"Magic",
	"Rare",
	"Epic",
	"Legendary",
	"Crystal",
	"Mythic",
	"Eternal",
]
const RARITY_DISPLAY_NAMES_VI := [
	"Thường",
	"Phép thuật",
	"Hiếm",
	"Sử thi",
	"Huyền thoại",
	"Kim cương",
	"Thần thánh",
	"Bất tử",
]
## Dungeon-loot contract: every rarity step opens one additional affix slot.
const AFFIX_SLOT_COUNTS := [0, 1, 2, 3, 4, 5, 6, 7]
const AFFIX_TIER_BY_RARITY := [0, 1, 2, 3, 4, 5, 6, 7]
const AFFIX_TIER_DISPLAY_NAMES_VI := [
	"Không bậc", "Bậc I", "Bậc II", "Bậc III", "Bậc IV", "Bậc V", "Bậc VI", "Bậc VII",
]
const ROLL_MULTIPLIER_RANGES := [
	Vector2(0.0, 0.0),
	Vector2(0.80, 1.00),
	Vector2(1.10, 1.30),
	Vector2(1.45, 1.70),
	Vector2(1.90, 2.20),
	Vector2(2.45, 2.80),
	Vector2(3.10, 3.55),
	Vector2(3.90, 4.50),
]
## Compatibility surface for callers that previously read one multiplier.
## Each entry is now the upper bound of the corresponding V0.4 roll range.
const ROLL_MULTIPLIERS := [0.0, 1.00, 1.30, 1.70, 2.20, 2.80, 3.55, 4.50]
## Every equipped Hero Soul is the weapon item. This value is the weapon's
## basic hit as a percentage of the character's plain Power stat; action/combo
## ratios multiply it afterwards. A Rare Lv9 Sword is therefore visibly
## stronger even when neither of its two affixes happens to be core damage.
## Upper tiers are deliberately rarer, so each step must feel like a genuine
## build breakpoint rather than a small colour swap.
const WEAPON_DAMAGE_PERCENT_BY_RARITY := [100.0, 108.0, 122.0, 162.0, 205.0, 262.0, 338.0, 440.0]
const WEAPON_DAMAGE_PERCENT_PER_ITEM_LEVEL := 0.75
const SELL_WEIGHTS := [1, 3, 9, 27, 81, 243, 729, 2187]
const VARIANT_CHANCES := [0.0, 0.0, 0.0, 0.0, 0.05, 0.08, 0.12, 0.20]
const VARIANT_RARITY_OFFSET := 4
const VARIANT_PITY_ATTEMPT := 5
const MAX_RARITY := Rarity.ETERNAL
const FUSION_INPUT_COUNT := 3
const FUSION_SELL_MULTIPLIER := 2
const BASE_SELL_VALUE := 10
const MAX_AFFIXES_PER_STACKING_GROUP := 2
const COMBAT_AFFIXES_SCRIPT_PATH := "res://game/meta/hero_souls/hero_soul_combat_affixes.gd"
const SKILL_KIT_RULES := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")

const AFFINITY_WARRIOR: StringName = &"warrior"
const AFFINITY_RANGER: StringName = &"ranger"
const AFFINITY_MAGICIAN: StringName = &"magician"
const VALID_AFFINITIES := [AFFINITY_WARRIOR, AFFINITY_RANGER, AFFINITY_MAGICIAN]

const POOL_UNIVERSAL := "universal"
const POOL_AFFINITY := "affinity"
const POOL_SOUL_ACTION := "soul_action"
const POOL_LEGACY := "legacy"
const BUCKET_MATCHING_AFFINITY := "matching_affinity"
const BUCKET_OFF_AFFINITY := "off_affinity"
const AFFIX_BUCKET_ORDER := [
	POOL_UNIVERSAL,
	BUCKET_MATCHING_AFFINITY,
	POOL_SOUL_ACTION,
	BUCKET_OFF_AFFINITY,
]
const AFFIX_POOL_WEIGHTS_BELOW_LEGENDARY := {
	"universal": 35.0,
	"matching_affinity": 45.0,
	"soul_action": 15.0,
	"off_affinity": 5.0,
}
const AFFIX_POOL_WEIGHTS_LEGENDARY_PLUS := {
	"universal": 35.0,
	"matching_affinity": 40.0,
	"soul_action": 15.0,
	"off_affinity": 10.0,
}

## The generation pool is deliberately smaller than the readable catalog.
## Every ID here has a concrete runtime consumer and visible feedback; old or
## future definitions remain valid migration inputs but cannot roll as a
## display-only property on a newly generated Hero Weapon.
const CANONICAL_LIVE_AFFIX_IDS := [
	"max_hp", "core_damage", "max_mana", "movement", "dodge", "healing_received",
	"normal_attack_power", "melee_damage", "combo_power", "heavy_hit_power",
	"execute_power", "close_range_damage", "projectile_damage",
	"active_skill_power", "active_power", "summon_power", "barrier_capacity",
	"relay_barrier", "departure_power", "cooldown_recovery", "active_cooldown",
	"active_mana_cost",
]

## V0.4 rollable catalog: 12 Universal, 6 per affinity and 10 Soul Action.
## Values are percentage points except definitions whose unit states otherwise.
## A stacking_group is a roll-family constraint, not a gameplay stat category.
## Legacy prototype IDs remain readable by SaveService but are never rolled.
const AFFIX_CATALOG := {
	# Universal (12).
	"max_hp": {"field": "hp", "unit": "percent", "min": 4.0, "max": 6.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "health", "survivability"], "stacking_group": "health"},
	"core_damage": {"field": "damage", "unit": "percent", "min": 3.0, "max": 5.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "offense", "core"], "stacking_group": "core_offense"},
	"max_mana": {"field": "mana", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "mana", "resource"], "stacking_group": "mana"},
	"normal_attack_power": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "normal_attack", "offense"], "required_action_tags": ["normal_attack"], "stacking_group": "normal_attack"},
	"movement": {"field": "movement", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "movement", "mobility"], "stacking_group": "mobility"},
	"attack_speed": {"field": "damage", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "offense", "speed"], "stacking_group": "core_offense"},
	"crit_chance": {"field": "damage", "unit": "percent", "min": 1.5, "max": 3.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "offense", "critical"], "stacking_group": "critical"},
	"crit_damage": {"field": "damage", "unit": "percent", "min": 8.0, "max": 12.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "offense", "critical"], "stacking_group": "critical"},
	"cooldown_recovery": {"field": "cooldown", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "cooldown", "tempo"], "stacking_group": "cooldown"},
	"mana_regen": {"field": "mana", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "mana", "resource"], "stacking_group": "mana"},
	"dodge": {"field": "visible_defense", "unit": "percent", "min": 1.5, "max": 3.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "visible_defense", "mobility"], "stacking_group": "visible_defense"},
	"healing_received": {"field": "hp", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_UNIVERSAL, "tags": ["universal", "health", "healing"], "stacking_group": "health"},

	# Warrior affinity (6).
	"melee_damage": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "melee", "offense"], "required_action_tags": ["melee"], "stacking_group": "melee_offense"},
	"combo_power": {"field": "damage", "unit": "percent", "min": 3.0, "max": 5.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "normal_attack", "combo"], "required_action_tags": ["melee", "normal_attack"], "stacking_group": "normal_attack"},
	"heavy_hit_power": {"field": "damage", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "normal_attack", "heavy"], "required_action_tags": ["melee", "normal_attack"], "stacking_group": "melee_offense"},
	"execute_power": {"field": "damage", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "normal_attack", "finisher"], "required_action_tags": ["melee", "normal_attack"], "stacking_group": "melee_offense"},
	"barrier_capacity": {"field": "visible_defense", "unit": "percent_max_hp", "min": 3.0, "max": 6.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "visible_defense", "barrier"], "required_action_tags": ["melee"], "stacking_group": "visible_defense"},
	"close_range_damage": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "warrior", "tags": ["affinity", "warrior", "melee", "offense"], "required_action_tags": ["melee"], "stacking_group": "melee_offense"},

	# Ranger affinity (6).
	"projectile_damage": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "projectile", "offense"], "required_action_tags": ["projectile"], "stacking_group": "projectile"},
	"projectile_speed": {"field": "damage", "unit": "percent", "min": 6.0, "max": 10.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "projectile", "speed"], "required_action_tags": ["projectile"], "stacking_group": "projectile"},
	"dash_cooldown": {"field": "cooldown", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "dash", "cooldown"], "required_action_tags": ["dash"], "stacking_group": "cooldown"},
	"post_dash_damage": {"field": "damage", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "dash", "offense"], "required_action_tags": ["dash"], "stacking_group": "conditional_offense"},
	"move_attack_penalty_reduction": {"field": "movement", "unit": "percent", "min": 10.0, "max": 20.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "movement", "attacking"], "required_action_tags": ["moving_attack"], "stacking_group": "mobility"},
	"execute_damage": {"field": "damage", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_AFFINITY, "affinity": "ranger", "tags": ["affinity", "ranger", "execute", "offense"], "required_action_tags": ["projectile"], "stacking_group": "projectile"},

	# Magician affinity (6).
	"active_skill_power": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "active", "power"], "required_action_tags": ["active"], "stacking_group": "skill_power"},
	"active_mana_cost": {"field": "mana", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "active", "resource"], "required_action_tags": ["active"], "stacking_group": "mana"},
	"active_cooldown": {"field": "cooldown", "unit": "percent", "min": 3.0, "max": 5.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "active", "cooldown"], "required_action_tags": ["active"], "stacking_group": "cooldown"},
	"summon_cooldown": {"field": "cooldown", "unit": "percent", "min": 3.0, "max": 5.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "summon", "cooldown"], "required_action_tags": ["summon"], "stacking_group": "cooldown"},
	"effect_duration": {"field": "duration", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "duration", "effect"], "stacking_group": "effect_shape"},
	"area_size": {"field": "area", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_AFFINITY, "affinity": "magician", "tags": ["affinity", "magician", "area", "effect"], "stacking_group": "effect_shape"},

	# Soul Action (10).
	"active_power": {"field": "soul_action", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "active", "power"], "required_action_tags": ["active"], "stacking_group": "skill_power"},
	"summon_power": {"field": "soul_action", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "summon", "power"], "required_action_tags": ["summon"], "stacking_group": "skill_power"},
	"departure_power": {"field": "soul_action", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "departure", "power"], "required_action_tags": ["departure"], "stacking_group": "skill_power"},
	"relay_barrier": {"field": "visible_defense", "unit": "percent_max_hp", "min": 4.0, "max": 8.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "relay", "visible_defense", "barrier"], "required_action_tags": ["relay"], "stacking_group": "visible_defense"},
	"ready_window_seconds": {"field": "soul_action", "unit": "seconds", "min": 0.10, "max": 0.18, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "relay", "ready_window"], "required_action_tags": ["relay"], "stacking_group": "relay"},
	"no_relay_refund": {"field": "mana", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "relay", "refund"], "required_action_tags": ["relay"], "stacking_group": "relay_resource"},
	"relay_arrival_speed": {"field": "soul_action", "unit": "percent", "min": 3.0, "max": 6.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "relay", "speed"], "required_action_tags": ["relay"], "stacking_group": "relay"},
	"departure_distance_damage": {"field": "soul_action", "unit": "percent", "min": 5.0, "max": 10.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "departure", "distance", "power"], "required_action_tags": ["departure"], "stacking_group": "skill_power"},
	"relay_mana_restore": {"field": "mana", "unit": "percent_max_mana", "min": 2.0, "max": 4.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "relay", "mana"], "required_action_tags": ["relay"], "stacking_group": "relay_resource"},
	"summon_multi_hit_cooldown": {"field": "cooldown", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_SOUL_ACTION, "tags": ["soul_action", "summon", "multi_hit", "cooldown"], "required_action_tags": ["summon"], "stacking_group": "cooldown"},

	# Read-only compatibility definitions from the six-tier prototype.
	"defense": {"field": "damage", "unit": "percent", "min": 4.0, "max": 7.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_defense"},
	"defense_while_attacking": {"field": "damage", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_defense_while_attacking"},
	"stagger_resist": {"field": "damage", "unit": "percent", "min": 6.0, "max": 10.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_stagger_resist"},
	"low_hp_defense": {"field": "damage", "unit": "percent", "min": 5.0, "max": 8.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_low_hp_defense"},
	"melee_threat_shield": {"field": "soul_action", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_melee_threat_shield"},
	"relay_shield": {"field": "soul_action", "unit": "percent", "min": 2.0, "max": 4.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_relay_shield"},
	"max_hp_flat": {"field": "hp", "unit": "flat", "min": 8.0, "max": 18.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_max_hp_flat"},
	"max_hp_percent": {"field": "hp", "unit": "percent", "min": 2.0, "max": 5.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_max_hp_percent"},
	"damage_reduction": {"field": "hp", "unit": "percent", "min": 1.0, "max": 3.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_damage_reduction"},
	"health_regen": {"field": "hp", "unit": "percent_per_second", "min": 0.15, "max": 0.50, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_health_regen"},
	"stagger_resistance": {"field": "hp", "unit": "percent", "min": 4.0, "max": 10.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_stagger_resistance"},
	"damage_flat": {"field": "damage", "unit": "flat", "min": 1.0, "max": 3.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_damage_flat"},
	"critical_chance": {"field": "damage", "unit": "percent", "min": 1.0, "max": 4.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_critical_chance"},
	"critical_damage": {"field": "damage", "unit": "percent", "min": 5.0, "max": 14.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_critical_damage"},
	"active_skill_damage": {"field": "damage", "unit": "percent", "min": 3.0, "max": 9.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_active_skill_damage"},
	"summon_skill_damage": {"field": "damage", "unit": "percent", "min": 3.0, "max": 9.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_summon_skill_damage"},
	"departure_skill_damage": {"field": "damage", "unit": "percent", "min": 3.0, "max": 9.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_departure_skill_damage"},
	"boss_damage": {"field": "damage", "unit": "percent", "min": 3.0, "max": 8.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_boss_damage"},
	"armor_penetration": {"field": "damage", "unit": "percent", "min": 2.0, "max": 6.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_armor_penetration"},
	"max_mana_flat": {"field": "mana", "unit": "flat", "min": 5.0, "max": 14.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_max_mana_flat"},
	"cooldown_rate": {"field": "mana", "unit": "percent", "min": 2.0, "max": 6.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_cooldown_rate"},
	"mana_efficiency": {"field": "mana", "unit": "percent", "min": 2.0, "max": 7.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_mana_efficiency"},
	"skill_duration": {"field": "mana", "unit": "percent", "min": 3.0, "max": 9.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_skill_duration"},
	"relay_ready_duration": {"field": "mana", "unit": "percent", "min": 4.0, "max": 12.0, "pool": POOL_LEGACY, "tags": ["legacy"], "stacking_group": "legacy_relay_ready_duration"},
}

## Central Vietnamese copy for every rollable affix. IDs stay stable English
## persistence keys; UI must consume this display API instead of exposing them.
const AFFIX_DISPLAY_NAMES_VI := {
	"max_hp": "HP tối đa",
	"core_damage": "Power",
	"max_mana": "Mana tối đa",
	"normal_attack_power": "Sức mạnh đòn đánh thường",
	"movement": "Tốc độ di chuyển",
	"attack_speed": "Tốc độ đánh",
	"crit_chance": "Tỉ lệ chí mạng",
	"crit_damage": "Sát thương chí mạng",
	"cooldown_recovery": "Hồi chiêu",
	"mana_regen": "Hồi Mana",
	"dodge": "Né tránh hiển thị",
	"healing_received": "Hồi phục nhận vào",
	"melee_damage": "Sát thương cận chiến",
	"combo_power": "Sức mạnh chuỗi đánh",
	"heavy_hit_power": "Sức mạnh đòn nặng",
	"execute_power": "Sức mạnh đòn kết liễu",
	"barrier_capacity": "Giáp ảo",
	"close_range_damage": "Sát thương tầm gần",
	"projectile_damage": "Sát thương đạn",
	"projectile_speed": "Tốc độ đạn",
	"dash_cooldown": "Hồi Lướt",
	"post_dash_damage": "Sát thương sau Lướt",
	"move_attack_penalty_reduction": "Giảm phạt khi vừa đi vừa đánh",
	"execute_damage": "Sát thương kết liễu",
	"active_skill_power": "Sức mạnh kỹ năng chủ động",
	"active_mana_cost": "Tiết kiệm Mana kỹ năng",
	"active_cooldown": "Hồi kỹ năng chủ động",
	"summon_cooldown": "Hồi kỹ năng triệu hồi",
	"effect_duration": "Thời lượng hiệu ứng",
	"area_size": "Phạm vi kỹ năng",
	"active_power": "Sát thương kỹ năng chủ động",
	"summon_power": "Sát thương triệu hồi",
	"departure_power": "Sát thương rời sân",
	"relay_barrier": "Giáp ảo khi Chuyển Hồn",
	"ready_window_seconds": "Cửa sổ sẵn sàng",
	"no_relay_refund": "Hoàn Mana khi không Chuyển Hồn",
	"relay_arrival_speed": "Tốc độ nhập sân",
	"departure_distance_damage": "Sát thương rời sân theo khoảng cách",
	"relay_mana_restore": "Hồi Mana khi Chuyển Hồn",
	"summon_multi_hit_cooldown": "Hồi triệu hồi đa đòn",
}


static func rarity_name(rarity: int) -> String:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return "Invalid"
	return RARITY_NAMES[rarity]


static func rarity_display_name_vi(rarity: int) -> String:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return "Không hợp lệ"
	return RARITY_DISPLAY_NAMES_VI[rarity]


static func affix_slot_count(rarity: int) -> int:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return 0
	return AFFIX_SLOT_COUNTS[rarity]


static func affix_tier_for_rarity(rarity: int) -> int:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return 0
	return AFFIX_TIER_BY_RARITY[rarity]


static func affix_tier_display_name_vi(tier: int) -> String:
	if tier < 0 or tier >= AFFIX_TIER_DISPLAY_NAMES_VI.size():
		return "Không hợp lệ"
	return AFFIX_TIER_DISPLAY_NAMES_VI[tier]


static func weapon_damage_percent(rarity: int, item_level: int) -> float:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return 0.0
	return snappedf(
		float(WEAPON_DAMAGE_PERCENT_BY_RARITY[rarity])
		+ float(clampi(item_level, 1, 100) - 1) * WEAPON_DAMAGE_PERCENT_PER_ITEM_LEVEL,
		0.01
	)


static func affix_display_metadata(
		affix_id: String,
		value: Variant = 0.0,
		tier: int = 0,
) -> Dictionary:
	var normalized := canonical_affix_id(affix_id)
	if not AFFIX_DISPLAY_NAMES_VI.has(normalized) or not AFFIX_CATALOG.has(normalized):
		return {
			"display_name": "Thuộc tính không xác định",
			"description": "Thuộc tính này chưa có mô tả tiếng Việt.",
			"tier_display_name": affix_tier_display_name_vi(tier),
		}
	var display_name := String(AFFIX_DISPLAY_NAMES_VI.get(normalized, normalized))
	var numeric: float = 0.0
	if value is int or value is float:
		numeric = float(value)
	var amount := _format_number(numeric)
	var unit := String((AFFIX_CATALOG[normalized] as Dictionary).get("unit", ""))
	var suffix := "%"
	if unit == "seconds":
		suffix = " giây"
	elif unit == "flat":
		suffix = ""
	return {
		"display_name": display_name,
		"description": "+%s%s %s" % [amount, suffix, display_name],
		"tier_display_name": affix_tier_display_name_vi(tier),
	}


## Old IDs are translated at the persistence boundary. Runtime and UI only see
## concrete, readable effects; no item advertises an invisible defense stat or
## a "converted" pseudo-affix.
static func canonical_affix_id(affix_id: String) -> String:
	var normalized := affix_id.strip_edges().to_lower()
	return String({
		"defense": "barrier_capacity",
		"dodge": "dodge",
		"defense_while_attacking": "combo_power",
		"stagger_resist": "heavy_hit_power",
		"low_hp_defense": "execute_power",
		"melee_threat_shield": "barrier_capacity",
		"relay_shield": "relay_barrier",
		"max_hp_flat": "max_hp",
		"max_hp_percent": "max_hp",
		"damage_reduction": "barrier_capacity",
		"stagger_resistance": "barrier_capacity",
		"health_regen": "healing_received",
		"damage_flat": "core_damage",
		"critical_chance": "crit_chance",
		"critical_damage": "crit_damage",
		"active_skill_damage": "active_skill_power",
		"summon_skill_damage": "summon_power",
		"departure_skill_damage": "departure_power",
		"armor_penetration": "core_damage",
	}.get(normalized, normalized))


static func rarity_roll_multiplier_range(rarity: int) -> Vector2:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return Vector2.ZERO
	return ROLL_MULTIPLIER_RANGES[rarity]


static func player_can_obtain_rarity(hero_minimum_rarity: int, rolled_rarity: int) -> bool:
	return (
		hero_minimum_rarity >= Rarity.NORMAL
		and hero_minimum_rarity <= MAX_RARITY
		and rolled_rarity >= hero_minimum_rarity
		and rolled_rarity <= MAX_RARITY
	)


static func variant_minimum_rarity(hero_minimum_rarity: int) -> int:
	if hero_minimum_rarity < Rarity.NORMAL or hero_minimum_rarity > MAX_RARITY:
		return -1
	return mini(MAX_RARITY, hero_minimum_rarity + VARIANT_RARITY_OFFSET)


static func variant_chance(hero_minimum_rarity: int, rolled_rarity: int) -> float:
	if not player_can_obtain_rarity(hero_minimum_rarity, rolled_rarity):
		return 0.0
	if rolled_rarity < variant_minimum_rarity(hero_minimum_rarity):
		return 0.0
	return float(VARIANT_CHANCES[rolled_rarity])


static func variant_chance_for_attempt(
	hero_minimum_rarity: int,
	rolled_rarity: int,
	eligible_attempt_number: int
) -> float:
	var base_chance := variant_chance(hero_minimum_rarity, rolled_rarity)
	if base_chance <= 0.0 or eligible_attempt_number < 1:
		return 0.0
	if eligible_attempt_number >= VARIANT_PITY_ATTEMPT:
		return 1.0
	return minf(1.0, base_chance + 0.05 * float(eligible_attempt_number - 1))


static func next_variant_attempt_number(current_attempt_number: int, variant_was_rolled: bool) -> int:
	if variant_was_rolled:
		return 1
	return mini(VARIANT_PITY_ATTEMPT, maxi(1, current_attempt_number) + 1)


static func should_roll_variant(
	hero_minimum_rarity: int,
	rolled_rarity: int,
	eligible_attempt_number: int,
	seed: int
) -> bool:
	var chance := variant_chance_for_attempt(hero_minimum_rarity, rolled_rarity, eligible_attempt_number)
	if chance <= 0.0:
		return false
	if chance >= 1.0:
		return true
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	return rng.randf() < chance


static func create_instance(
	hero_id: StringName,
	rarity: int,
	item_level: int,
	source_id: StringName,
	seed: int,
	affinity: StringName = AFFINITY_WARRIOR,
	variant_id: StringName = &"",
	supported_action_tags: PackedStringArray = PackedStringArray(["*"]),
	allowed_affix_ids: PackedStringArray = PackedStringArray(["*"])
) -> Dictionary:
	var normalized_hero := String(hero_id).strip_edges().to_lower()
	var normalized_source := String(source_id).strip_edges().to_lower()
	if normalized_hero.is_empty() or rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return {}
	if not VALID_AFFINITIES.has(affinity):
		affinity = AFFINITY_WARRIOR
	var stable_key := "%s:%s:%d:%d:%d" % [
		normalized_hero,
		normalized_source,
		rarity,
		maxi(1, item_level),
		seed,
	]
	var level := maxi(1, item_level)
	var skill_ranks := SKILL_KIT_RULES.roll_skill_ranks(rarity, seed, stable_key)
	return {
		"instance_id": stable_key.sha256_text().substr(0, 24),
		"hero_id": normalized_hero,
		"rarity": rarity,
		"item_level": level,
		"rarity_display_name": rarity_display_name_vi(rarity),
		"affix_slot_capacity": affix_slot_count(rarity),
		"affix_tier": affix_tier_for_rarity(rarity),
		"weapon_damage_percent": weapon_damage_percent(rarity, level),
		"item_kind": "hero_weapon",
		"skill_kit_tier": SKILL_KIT_RULES.kit_tier_for_rarity(rarity),
		"skill_kit_id": String(SKILL_KIT_RULES.kit_id_for_rarity(rarity)),
		"skill_ranks": skill_ranks,
		"affinity": String(affinity),
		"variant_id": String(variant_id).strip_edges().to_lower(),
		"affixes": roll_affixes(
			rarity,
			affinity,
			seed,
			supported_action_tags,
			allowed_affix_ids
		),
		"monster_soul_id": "",
		"locked": false,
		"favorite": false,
		"equipped": false,
		"source_id": normalized_source,
	}


static func get_rollable_affix_ids() -> PackedStringArray:
	var result := PackedStringArray()
	for affix_id: String in CANONICAL_LIVE_AFFIX_IDS:
		if AFFIX_CATALOG.has(affix_id) \
				and String((AFFIX_CATALOG[affix_id] as Dictionary).get(
					"pool", POOL_LEGACY
				)) != POOL_LEGACY:
			result.append(affix_id)
	result.sort()
	return result


## A wildcard keeps legacy callers generic. Passing a concrete tag list is
## fail-closed: definitions with unmet required_action_tags cannot be selected.
static func roll_affixes(
	rarity: int,
	affinity: StringName,
	seed: int,
	supported_action_tags: PackedStringArray = PackedStringArray(["*"]),
	allowed_affix_ids: PackedStringArray = PackedStringArray(["*"])
) -> Array[Dictionary]:
	var target_count := affix_slot_count(rarity)
	if target_count <= 0:
		return []
	if not VALID_AFFINITIES.has(affinity):
		affinity = AFFINITY_WARRIOR
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var affix_tier := affix_tier_for_rarity(rarity)
	var tier_display_name := affix_tier_display_name_vi(affix_tier)
	var roll_range := rarity_roll_multiplier_range(rarity)
	var remaining: Array[String] = []
	for affix_id: String in get_rollable_affix_ids():
		if not allowed_affix_ids.has("*") and not allowed_affix_ids.has(affix_id):
			continue
		remaining.append(affix_id)
	var group_counts := {}
	var rolled: Array[Dictionary] = []
	for _slot: int in target_count:
		var force_synergy := rarity >= Rarity.LEGENDARY and _slot == 0
		var chosen_id := _select_affix_id(
			remaining,
			affinity,
			rarity,
			group_counts,
			rng,
			supported_action_tags,
			force_synergy
		)
		if chosen_id.is_empty():
			break
		remaining.erase(chosen_id)
		var definition: Dictionary = AFFIX_CATALOG[chosen_id]
		var multiplier := snappedf(rng.randf_range(roll_range.x, roll_range.y), 0.001)
		var base_value := rng.randf_range(float(definition["min"]), float(definition["max"]))
		var value := snappedf(base_value * multiplier, 0.01)
		var stacking_group := String(definition["stacking_group"])
		group_counts[stacking_group] = int(group_counts.get(stacking_group, 0)) + 1
		var tags: Array = definition.get("tags", [])
		var display := affix_display_metadata(chosen_id, value, affix_tier)
		rolled.append({
			"affix_id": chosen_id,
			"display_name": String(display["display_name"]),
			"description": String(display["description"]),
			"tier": affix_tier,
			"tier_display_name": tier_display_name,
			"field": definition["field"],
			"unit": definition["unit"],
			"value": value,
			"roll_multiplier": multiplier,
			"roll_min": snappedf(float(definition["min"]) * roll_range.x, 0.01),
			"roll_max": snappedf(float(definition["max"]) * roll_range.y, 0.01),
			"pool": definition["pool"],
			"stacking_group": stacking_group,
			"tags": tags.duplicate(),
		})
	return rolled


static func validate_instance(soul: Dictionary) -> PackedStringArray:
	var errors := PackedStringArray()
	var instance_id := String(soul.get("instance_id", "")).strip_edges().to_lower()
	var hero_id := String(soul.get("hero_id", "")).strip_edges().to_lower()
	var rarity := int(soul.get("rarity", -1))
	if instance_id.is_empty():
		errors.append("Hero Soul instance_id is required.")
	if hero_id.is_empty():
		errors.append("Hero Soul hero_id is required.")
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		errors.append("Hero Soul rarity is invalid.")
	var item_level := int(soul.get("item_level", 0))
	if item_level < 1:
		errors.append("Hero Weapon item_level must be at least 1.")
	if soul.has("weapon_damage_percent") and rarity >= Rarity.NORMAL and rarity <= MAX_RARITY \
			and not is_equal_approx(
				float(soul.get("weapon_damage_percent", 0.0)),
				weapon_damage_percent(rarity, item_level)
			):
		errors.append("Hero Soul weapon_damage_percent does not match rarity and item level.")
	var skill_kit_tier := int(soul.get(
		"skill_kit_tier",
		SKILL_KIT_RULES.kit_tier_for_rarity(rarity),
	))
	if rarity >= Rarity.NORMAL and rarity <= MAX_RARITY \
			and skill_kit_tier != SKILL_KIT_RULES.kit_tier_for_rarity(rarity):
		errors.append("Hero Weapon skill kit does not match rarity.")
	var ranks_value: Variant = soul.get("skill_ranks", {})
	if not ranks_value is Dictionary \
			or not SKILL_KIT_RULES.validate_skill_ranks(rarity, ranks_value as Dictionary):
		errors.append("Hero Weapon skill ranks do not match rarity total.")
	var affinity := StringName(String(soul.get("affinity", AFFINITY_WARRIOR)))
	if not VALID_AFFINITIES.has(affinity):
		errors.append("Hero Soul affinity is invalid.")
	var affixes: Variant = soul.get("affixes", [])
	if not affixes is Array:
		errors.append("Hero Soul affixes must be an Array.")
		return errors
	if rarity >= Rarity.NORMAL and rarity <= MAX_RARITY and (affixes as Array).size() > affix_slot_count(rarity):
		errors.append("Hero Soul has more affixes than its rarity allows.")
	var seen_affix_ids := {}
	var group_counts := {}
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			errors.append("Hero Soul affixes must use Dictionary records.")
			continue
		var affix: Dictionary = raw_affix
		var affix_id := String(affix.get("affix_id", "")).strip_edges().to_lower()
		if not AFFIX_CATALOG.has(affix_id):
			errors.append("Hero Soul contains unknown affix '%s'." % affix_id)
			continue
		if seen_affix_ids.has(affix_id):
			errors.append("Hero Soul cannot contain duplicate affix '%s'." % affix_id)
		else:
			seen_affix_ids[affix_id] = true
		var raw_value: Variant = affix.get("value", 0.0)
		if (not raw_value is int and not raw_value is float) or not is_finite(float(raw_value)):
			errors.append("Hero Soul affix '%s' has an invalid value." % affix_id)
		if affix.has("tier"):
			var raw_tier: Variant = affix.get("tier")
			if not raw_tier is int or int(raw_tier) < 1 \
					or int(raw_tier) > affix_tier_for_rarity(rarity):
				errors.append("Hero Soul affix '%s' has an invalid rarity tier." % affix_id)
		var definition: Dictionary = AFFIX_CATALOG[affix_id]
		var stacking_group := String(affix.get("stacking_group", ""))
		if not stacking_group.is_empty() and stacking_group != String(definition["stacking_group"]):
			errors.append("Hero Soul affix '%s' has an invalid stacking group." % affix_id)
			continue
		if stacking_group.is_empty():
			continue
		group_counts[stacking_group] = int(group_counts.get(stacking_group, 0)) + 1
		if int(group_counts[stacking_group]) > MAX_AFFIXES_PER_STACKING_GROUP:
			errors.append("Hero Soul cannot contain more than %d affixes from stacking group '%s'." % [MAX_AFFIXES_PER_STACKING_GROUP, stacking_group])
	return errors


static func fusion_errors(inputs: Array[Dictionary]) -> PackedStringArray:
	var errors := PackedStringArray()
	if inputs.size() != FUSION_INPUT_COUNT:
		errors.append("Fusion requires exactly three Hero Souls.")
		return errors
	var hero_id := String(inputs[0].get("hero_id", ""))
	var rarity := int(inputs[0].get("rarity", -1))
	var seen_ids := {}
	for soul: Dictionary in inputs:
		for error: String in validate_instance(soul):
			errors.append(error)
		var instance_id := String(soul.get("instance_id", ""))
		if seen_ids.has(instance_id):
			errors.append("Fusion inputs must be three different instances.")
		seen_ids[instance_id] = true
		if String(soul.get("hero_id", "")) != hero_id:
			errors.append("Fusion inputs must share one Hero Identity.")
		if int(soul.get("rarity", -1)) != rarity:
			errors.append("Fusion inputs must share one rarity.")
		if bool(soul.get("locked", false)) or bool(soul.get("favorite", false)) or bool(soul.get("equipped", false)):
			errors.append("Locked, favorite, or equipped Hero Souls cannot be fused.")
		if not String(soul.get("monster_soul_id", "")).is_empty():
			errors.append("Remove the Monster Soul before fusion.")
	if rarity >= MAX_RARITY:
		errors.append("Eternal Hero Souls cannot be fused upward.")
	return errors


static func fusion_cost(source_rarity: int, output_item_level: int) -> int:
	if source_rarity < Rarity.NORMAL or source_rarity >= MAX_RARITY:
		return 0
	return FUSION_SELL_MULTIPLIER * FUSION_INPUT_COUNT * sell_value_for(source_rarity, output_item_level)


static func fusion_cost_for_inputs(inputs: Array[Dictionary]) -> int:
	if inputs.size() != FUSION_INPUT_COUNT:
		return 0
	var total_sell_value := 0
	for soul: Dictionary in inputs:
		var value := sell_value(soul)
		if value <= 0:
			return 0
		total_sell_value += value
	return FUSION_SELL_MULTIPLIER * total_sell_value


static func fuse(inputs: Array[Dictionary], seed: int) -> Dictionary:
	if not fusion_errors(inputs).is_empty():
		return {}
	var roll_contract := _prototype_fusion_roll_contract(
		StringName(inputs[0].get("hero_id", ""))
	)
	if roll_contract.is_empty():
		return {}
	var supported_action_tags: PackedStringArray = roll_contract.get(
		"supported_action_tags", PackedStringArray()
	)
	var allowed_affix_ids: PackedStringArray = roll_contract.get(
		"allowed_affix_ids", PackedStringArray()
	)
	if supported_action_tags.is_empty() or allowed_affix_ids.is_empty():
		return {}
	var source_rarity := int(inputs[0]["rarity"])
	var output_level := 1
	var inherited_variant := String(inputs[0].get("variant_id", ""))
	for soul: Dictionary in inputs:
		output_level = maxi(output_level, int(soul.get("item_level", 1)))
		if String(soul.get("variant_id", "")) != inherited_variant:
			inherited_variant = ""
	var result := create_instance(
		StringName(inputs[0]["hero_id"]),
		source_rarity + 1,
		output_level,
		&"fusion",
		seed,
		StringName(inputs[0].get("affinity", "warrior")),
		StringName(inherited_variant),
		supported_action_tags,
		allowed_affix_ids
	)
	if (result.get("affixes", []) as Array).size() != affix_slot_count(source_rarity + 1):
		return {}
	result["fusion_cost"] = fusion_cost_for_inputs(inputs)
	result["consumed_instance_ids"] = inputs.map(func(soul: Dictionary) -> String: return String(soul["instance_id"]))
	return result


## HeroSoulCombatAffixes already consumes HeroSoulRules to validate selected
## inventory instances. Late-loading the consumer here keeps that dependency
## one-way at parse time while letting Fusion use the runtime's canonical live
## affix/action contract instead of maintaining a second list in the rules.
static func _prototype_fusion_roll_contract(hero_id: StringName) -> Dictionary:
	var combat_affixes: Variant = load(COMBAT_AFFIXES_SCRIPT_PATH)
	if combat_affixes == null or not combat_affixes.has_method(
		"prototype_fusion_roll_contract"
	):
		return {}
	var contract: Variant = combat_affixes.call("prototype_fusion_roll_contract", hero_id)
	if not contract is Dictionary:
		return {}
	return (contract as Dictionary).duplicate(true)


static func sell_value_for(rarity: int, item_level: int) -> int:
	if rarity < Rarity.NORMAL or rarity > MAX_RARITY:
		return 0
	var level_multiplier := 1.0 + 0.01 * float(maxi(1, item_level) - 1)
	return maxi(1, roundi(float(BASE_SELL_VALUE * SELL_WEIGHTS[rarity]) * level_multiplier))


static func sell_value(soul: Dictionary) -> int:
	if not validate_instance(soul).is_empty():
		return 0
	return sell_value_for(int(soul["rarity"]), int(soul["item_level"]))


static func salvage_materials(soul: Dictionary) -> int:
	if not validate_instance(soul).is_empty():
		return 0
	return 1 << int(soul["rarity"])


static func _select_affix_id(
	remaining: Array[String],
	affinity: StringName,
	rarity: int,
	group_counts: Dictionary,
	rng: RandomNumberGenerator,
	supported_action_tags: PackedStringArray,
	force_synergy: bool
) -> String:
	var candidates_by_bucket := {
		POOL_UNIVERSAL: [],
		BUCKET_MATCHING_AFFINITY: [],
		POOL_SOUL_ACTION: [],
		BUCKET_OFF_AFFINITY: [],
	}
	for affix_id: String in remaining:
		var definition: Dictionary = AFFIX_CATALOG[affix_id]
		if not _definition_supports_action_tags(definition, supported_action_tags):
			continue
		var stacking_group := String(definition["stacking_group"])
		if int(group_counts.get(stacking_group, 0)) >= MAX_AFFIXES_PER_STACKING_GROUP:
			continue
		var bucket := _affix_bucket(definition, affinity)
		if bucket.is_empty():
			continue
		(candidates_by_bucket[bucket] as Array).append(affix_id)
	var weights: Dictionary = (
		AFFIX_POOL_WEIGHTS_LEGENDARY_PLUS
		if rarity >= Rarity.LEGENDARY
		else AFFIX_POOL_WEIGHTS_BELOW_LEGENDARY
	)
	var selection_buckets: Array = (
		[BUCKET_MATCHING_AFFINITY, POOL_SOUL_ACTION]
		if force_synergy
		else AFFIX_BUCKET_ORDER
	)
	var total_weight := 0.0
	for bucket: String in selection_buckets:
		if not (candidates_by_bucket[bucket] as Array).is_empty():
			total_weight += float(weights[bucket])
	if total_weight <= 0.0:
		return ""
	var needle := rng.randf_range(0.0, total_weight)
	var selected_bucket := ""
	for bucket: String in selection_buckets:
		if (candidates_by_bucket[bucket] as Array).is_empty():
			continue
		needle -= float(weights[bucket])
		if needle <= 0.0:
			selected_bucket = bucket
			break
	if selected_bucket.is_empty():
		for bucket: String in selection_buckets:
			if not (candidates_by_bucket[bucket] as Array).is_empty():
				selected_bucket = bucket
	var candidates: Array = candidates_by_bucket[selected_bucket]
	return String(candidates[rng.randi_range(0, candidates.size() - 1)])


static func _affix_bucket(definition: Dictionary, affinity: StringName) -> String:
	match String(definition.get("pool", POOL_LEGACY)):
		POOL_UNIVERSAL:
			return POOL_UNIVERSAL
		POOL_SOUL_ACTION:
			return POOL_SOUL_ACTION
		POOL_AFFINITY:
			return BUCKET_MATCHING_AFFINITY if StringName(definition.get("affinity", "")) == affinity else BUCKET_OFF_AFFINITY
		_:
			return ""


static func _definition_supports_action_tags(
	definition: Dictionary,
	supported_action_tags: PackedStringArray
) -> bool:
	if supported_action_tags.has("*"):
		return true
	var required_tags: Variant = definition.get("required_action_tags", [])
	if not required_tags is Array or (required_tags as Array).is_empty():
		return true
	for required_tag: String in required_tags:
		if not supported_action_tags.has(required_tag):
			return false
	return true


static func _format_number(value: float) -> String:
	var result := "%.2f" % value
	while result.contains(".") and result.ends_with("0"):
		result = result.trim_suffix("0")
	return result.trim_suffix(".")
