class_name PlayerProgressionRules
extends RefCounted

## Pure, deterministic player-progression contract for the 100-level campaign.
## Stat points are account-wide. Skill ranks share one global point pool but are
## stored per Hero Identity so equal track IDs never bleed between Heroes.

const PLAYER_LEVEL_CAP := 100
const STAT_POINTS_PER_LEVEL := 5
## Skill Points are a specialization budget, not a completion checklist. Two
## points per account level let one Hero reach all six rank-20 tracks while
## still funding most of a reserve Hero, but can never max the minimum two-Hero
## roster. Adding another Hero therefore adds choices without requiring a new
## point curve or invalidating the existing economy.
const SKILL_POINTS_PER_LEVEL := 2
const STAT_POINT_CAP := 200
const SKILL_RANK_CAP := 20
const SKILL_LEVEL_CAP := SKILL_RANK_CAP # Compatibility alias.
const SKILL_TRACK_COUNT := 6
const MINIMUM_BUILD_HERO_IDENTITIES := 2
const RESPEC_COST_CAP := 2500
const FREE_RESPEC_LEVEL_CAP := 20

const MILESTONE_STEP := 10 # Compatibility alias for the early milestones.
const LAST_SPECIAL_MILESTONE := 200

## HP and damage use a x10 readable combat unit. Ratios and time-to-kill stay
## authored, but a confirmed 200 hit visibly removes 200 HP instead of being
## compressed into tiny two-digit feedback.
const COMBAT_NUMBER_SCALE := 10.0
const BASE_HP := 1000.0
const BASE_DAMAGE := 200.0
const BASE_MANA := 100.0

## A level-up expands survivability and resource capacity without silently
## increasing offense. Each completed level grants 99% of the previous level's
## HP and Mana return; Power is exclusively player-allocated below. This keeps
## progression useful while making offensive growth an explicit build choice.
const LEVEL_GROWTH_DECAY := 0.99
const HP_PER_PLAYER_LEVEL := 200.0
const DAMAGE_PERCENT_PER_PLAYER_LEVEL := 0.0 # Compatibility alias: level offense is retired.
const MANA_PER_PLAYER_LEVEL := 10.0
const LEVEL_GROWTH_SURGE_INTERVAL := 0 # Deprecated compatibility alias.
const HP_PER_LEVEL_SURGE := 0.0 # Deprecated compatibility alias.
const DAMAGE_PERCENT_PER_LEVEL_SURGE := 0.0 # Deprecated compatibility alias.
const MANA_PER_LEVEL_SURGE := 0.0 # Deprecated compatibility alias.

const BASE_XP_REQUIRED := 100
const XP_LINEAR_GROWTH := 25
const XP_CURVE_GROWTH := 3.0

## Initial-return aliases retained for callers that display the first point.
## The stable save key remains `damage`, but its player-facing meaning is Power:
## percentage points of shared character attack power, never flat hit damage.
const HP_PER_POINT := 140.0
const POWER_PERCENT_PER_POINT := 4.0
const DAMAGE_PER_POINT := POWER_PERCENT_PER_POINT # Stable compatibility alias.
const MANA_PER_POINT := 7.0
const STAT_DIMINISHING_RETURN_STRENGTH := 1.0

## Canonical player-facing base-stat schema. STAT_IDS remains an alias for
## save/UI compatibility, but no fourth allocatable resource is permitted.
const STAT_POWER: StringName = &"damage" # Stable persisted/runtime key.
const CORE_STAT_IDS := [&"hp", &"mana", STAT_POWER]
const STAT_IDS := CORE_STAT_IDS
const CORE_STAT_DEFINITIONS := {
	"hp": {
		"display_name": "HP",
		"unit": "flat",
		"has_secondary_effects": false,
	},
	"mana": {
		"display_name": "Mana",
		"unit": "flat",
		"has_secondary_effects": false,
	},
	"damage": {
		"display_name": "POWER",
		"unit": "percent_of_core",
		"has_secondary_effects": false,
	},
}
## One shared, content-independent curve drives all allocatable core stats.
## Point 200 returns exactly half of point one at strength 1.0. The legacy
## milestone catalogs below remain inspectable IDs only and never enter this
## numeric projection.
const STAT_CURVE_DEFINITIONS := {
	"hp": {"initial_return": HP_PER_POINT, "unit": "flat"},
	"damage": {"initial_return": POWER_PERCENT_PER_POINT, "unit": "percent_of_core"},
	"mana": {"initial_return": MANA_PER_POINT, "unit": "flat"},
}

const SKILL_TRACK_NORMAL_ATTACK: StringName = &"normal_attack"
const SKILL_TRACK_ACTIVE_SKILL: StringName = &"active_skill"
const SKILL_TRACK_DASH: StringName = &"dash"
const SKILL_TRACK_SOUL_READY_CONDITION: StringName = &"soul_ready_condition"
const SKILL_TRACK_SUMMON_SKILL: StringName = &"summon_skill"
const SKILL_TRACK_DEPARTURE_SKILL: StringName = &"departure_skill"
const SKILL_TRACK_IDS := [
	SKILL_TRACK_NORMAL_ATTACK,
	SKILL_TRACK_ACTIVE_SKILL,
	SKILL_TRACK_DASH,
	SKILL_TRACK_SOUL_READY_CONDITION,
	SKILL_TRACK_SUMMON_SKILL,
	SKILL_TRACK_DEPARTURE_SKILL,
]

const MILESTONE_THRESHOLDS := [
	10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
]
const HP_MILESTONES := [
	"max_hp_5_percent",
	"defense_5_percent",
	"healing_and_hp_pickup_effectiveness_10_percent",
	"stagger_resistance_10_percent",
	"max_hp_5_percent_2",
	"low_hp_damage_reduction_5_percent",
	"shield_effectiveness_10_percent",
	"defense_5_percent_2",
	"hero_skill_healing_received_10_percent",
	"last_soul",
	"max_hp_5_percent_3",
	"elite_boss_damage_reduction_5_percent",
	"stagger_resistance_15_percent",
	"relay_guard_8_percent_max_hp",
]
const DAMAGE_MILESTONES := [
	"critical_chance_2_percent",
	"attack_speed_5_percent",
	"critical_damage_10_percent",
	"active_skill_damage_5_percent",
	"core_damage_5_percent",
	"summon_damage_6_percent",
	"departure_damage_6_percent",
	"armor_penetration_5_percent",
	"elite_boss_damage_8_percent",
	"relay_overdrive_12_percent",
	"attack_speed_5_percent_2",
	"critical_chance_4_percent",
	"critical_damage_15_percent",
	"execution_damage_15_percent",
]
const MANA_MILESTONES := [
	"mana_regen_1_5_per_second",
	"active_skill_mana_cost_reduction_5_percent",
	"active_skill_cooldown_recovery_5_percent",
	"max_mana_5_percent",
	"mana_regen_1_5_per_second_2",
	"reserve_soul_support_cooldown_reduction_5_percent",
	"skill_area_and_duration_8_percent",
	"global_skill_cooldown_recovery_5_percent",
	"relay_restores_max_mana_8_percent",
	"flow_state_15_percent_remaining_cooldown",
	"max_mana_5_percent_2",
	"all_skill_mana_cost_reduction_8_percent",
	"global_skill_cooldown_recovery_5_percent_2",
	"soul_reservoir",
]

## Complete milestone records are kept separately from the stable ID arrays so
## UI and runtime systems can inspect exact effects without parsing an ID.
const HP_MILESTONE_TABLE := [
	{"threshold": 10, "id": "max_hp_5_percent", "description": "+5% Max HP"},
	{"threshold": 20, "id": "defense_5_percent", "description": "+5% Max HP"},
	{"threshold": 30, "id": "healing_and_hp_pickup_effectiveness_10_percent", "description": "+10% healing and HP-pickup effectiveness"},
	{"threshold": 40, "id": "stagger_resistance_10_percent", "description": "+4% Max HP"},
	{"threshold": 50, "id": "max_hp_5_percent_2", "description": "+5% Max HP"},
	{"threshold": 60, "id": "low_hp_damage_reduction_5_percent", "description": "+5% Max HP"},
	{"threshold": 70, "id": "shield_effectiveness_10_percent", "description": "+10% shield effectiveness"},
	{"threshold": 80, "id": "defense_5_percent_2", "description": "+5% Max HP"},
	{"threshold": 90, "id": "hero_skill_healing_received_10_percent", "description": "+10% healing received from Hero skills"},
	{"threshold": 100, "id": "last_soul", "description": "Once per level, lethal damage leaves 1 HP and grants 0.8 seconds of invulnerability"},
	{"threshold": 125, "id": "max_hp_5_percent_3", "description": "+5% Max HP"},
	{"threshold": 150, "id": "elite_boss_damage_reduction_5_percent", "description": "+5% Max HP"},
	{"threshold": 175, "id": "stagger_resistance_15_percent", "description": "+6% Max HP"},
	{"threshold": 200, "id": "relay_guard_8_percent_max_hp", "description": "After Q2 Relay, gain an 8% Max HP shield for 3 seconds; 12-second internal cooldown"},
]
const DAMAGE_MILESTONE_TABLE := [
	{"threshold": 10, "id": "critical_chance_2_percent", "description": "+2% Critical Chance"},
	{"threshold": 20, "id": "attack_speed_5_percent", "description": "+5% Attack Speed"},
	{"threshold": 30, "id": "critical_damage_10_percent", "description": "+10% Critical Damage"},
	{"threshold": 40, "id": "active_skill_damage_5_percent", "description": "+5% Active Skill damage"},
	{"threshold": 50, "id": "core_damage_5_percent", "description": "+5% Core Damage"},
	{"threshold": 60, "id": "summon_damage_6_percent", "description": "+6% Summon Skill damage"},
	{"threshold": 70, "id": "departure_damage_6_percent", "description": "+6% Departure Skill damage"},
	{"threshold": 80, "id": "armor_penetration_5_percent", "description": "+5% Core Damage"},
	{"threshold": 90, "id": "elite_boss_damage_8_percent", "description": "+8% damage against elites and bosses"},
	{"threshold": 100, "id": "relay_overdrive_12_percent", "description": "After Q2 Relay, gain +12% damage for 4 seconds; 10-second internal cooldown"},
	{"threshold": 125, "id": "attack_speed_5_percent_2", "description": "+5% Attack Speed"},
	{"threshold": 150, "id": "critical_chance_4_percent", "description": "+4% Critical Chance"},
	{"threshold": 175, "id": "critical_damage_15_percent", "description": "+15% Critical Damage"},
	{"threshold": 200, "id": "execution_damage_15_percent", "description": "+15% damage against enemies below 25% HP"},
]
const MANA_MILESTONE_TABLE := [
	{"threshold": 10, "id": "mana_regen_1_5_per_second", "description": "+1.5 Mana regenerated per second"},
	{"threshold": 20, "id": "active_skill_mana_cost_reduction_5_percent", "description": "-5% Active Skill Mana cost"},
	{"threshold": 30, "id": "active_skill_cooldown_recovery_5_percent", "description": "+5% Active Skill cooldown recovery"},
	{"threshold": 40, "id": "max_mana_5_percent", "description": "+5% Max Mana"},
	{"threshold": 50, "id": "mana_regen_1_5_per_second_2", "description": "+1.5 Mana regenerated per second"},
	{"threshold": 60, "id": "reserve_soul_support_cooldown_reduction_5_percent", "description": "-5% reserve-Soul support cooldown"},
	{"threshold": 70, "id": "skill_area_and_duration_8_percent", "description": "+8% skill area and effect duration"},
	{"threshold": 80, "id": "global_skill_cooldown_recovery_5_percent", "description": "+5% global skill cooldown recovery"},
	{"threshold": 90, "id": "relay_restores_max_mana_8_percent", "description": "Q2 Relay restores 8% Max Mana"},
	{"threshold": 100, "id": "flow_state_15_percent_remaining_cooldown", "description": "Q2 Relay removes 15% of the active Hero Skill's remaining cooldown"},
	{"threshold": 125, "id": "max_mana_5_percent_2", "description": "+5% Max Mana"},
	{"threshold": 150, "id": "all_skill_mana_cost_reduction_8_percent", "description": "-8% all Skill Mana costs"},
	{"threshold": 175, "id": "global_skill_cooldown_recovery_5_percent_2", "description": "+5% global skill cooldown recovery"},
	{"threshold": 200, "id": "soul_reservoir", "description": "First Active Skill within 4 seconds after Relay costs no Mana; 15-second internal cooldown"},
]

## Deprecated V0.4 milestone payload retained only so old inspectors and content
## references can still resolve their stable IDs. Core Balance V1 deliberately
## does not consume this table: stat_snapshot exposes no milestone hooks and the
## compatibility helpers below return zero/false. New mechanics must register a
## real runtime consumer instead of reviving a hidden point-threshold bonus.
const DIRECT_CORE_MILESTONE_BONUS_PERCENT := {
	"hp": {
		"max_hp_5_percent": 5.0,
		"max_hp_5_percent_2": 5.0,
		"max_hp_5_percent_3": 5.0,
	},
	"damage": {
		"core_damage_5_percent": 5.0,
	},
	"mana": {
		"max_mana_5_percent": 5.0,
		"max_mana_5_percent_2": 5.0,
	},
}

const MAX_EARNED_STAT_POINTS := PLAYER_LEVEL_CAP * STAT_POINTS_PER_LEVEL
const MAX_EARNED_SKILL_POINTS := PLAYER_LEVEL_CAP * SKILL_POINTS_PER_LEVEL
## Sum of the normalized marginal curve for point indices 1..200 at strength
## 1.0. Keeping this exact derived value beside the public caps makes the
## global contract cheap to inspect while exhaustive tests guard against drift.
const STAT_CURVE_UNIT_SUM_AT_CAP := 138.68660300078949
const MAX_HP_STAT_BONUS := HP_PER_POINT * STAT_CURVE_UNIT_SUM_AT_CAP
const MAX_CORE_DAMAGE_BONUS_PERCENT := DAMAGE_PER_POINT * STAT_CURVE_UNIT_SUM_AT_CAP
const MAX_MANA_STAT_BONUS := MANA_PER_POINT * STAT_CURVE_UNIT_SUM_AT_CAP
const MAX_SKILL_POINTS_PER_IDENTITY := SKILL_TRACK_COUNT * SKILL_RANK_CAP
const MINIMUM_BUILD_SKILL_CAPACITY := (
	MINIMUM_BUILD_HERO_IDENTITIES * MAX_SKILL_POINTS_PER_IDENTITY
)
const ENDGAME_SPECIALIZATION_GAP := MINIMUM_BUILD_SKILL_CAPACITY - MAX_EARNED_SKILL_POINTS
const TOTAL_COOLDOWN_REDUCTION_CAP_PERCENT := 35.0
const TOTAL_DODGE_CHANCE_CAP_PERCENT := 20.0
const TOTAL_BARRIER_CAPACITY_CAP_PERCENT := 40.0
const TOTAL_BONUS_ATTACK_SPEED_CAP_PERCENT := 60.0
const TOTAL_CRITICAL_CHANCE_CAP_PERCENT := 60.0
const GLOBAL_CAPS := {
	"player_level": PLAYER_LEVEL_CAP,
	"stat_points_per_stat": STAT_POINT_CAP,
	"earned_stat_points": MAX_EARNED_STAT_POINTS,
	"hp_stat_bonus": MAX_HP_STAT_BONUS,
	"core_damage_bonus_percent": MAX_CORE_DAMAGE_BONUS_PERCENT,
	"mana_stat_bonus": MAX_MANA_STAT_BONUS,
	"earned_skill_points": MAX_EARNED_SKILL_POINTS,
	"skill_tracks_per_identity": SKILL_TRACK_COUNT,
	"skill_rank_per_track": SKILL_RANK_CAP,
	"skill_points_per_identity": MAX_SKILL_POINTS_PER_IDENTITY,
	"minimum_build_hero_identities": MINIMUM_BUILD_HERO_IDENTITIES,
	"minimum_build_skill_capacity": MINIMUM_BUILD_SKILL_CAPACITY,
	"endgame_specialization_gap": ENDGAME_SPECIALIZATION_GAP,
	"respec_cost": RESPEC_COST_CAP,
	"total_cooldown_reduction_percent": TOTAL_COOLDOWN_REDUCTION_CAP_PERCENT,
	"total_dodge_chance_percent": TOTAL_DODGE_CHANCE_CAP_PERCENT,
	"total_barrier_capacity_percent": TOTAL_BARRIER_CAPACITY_CAP_PERCENT,
	"total_bonus_attack_speed_percent": TOTAL_BONUS_ATTACK_SPEED_CAP_PERCENT,
	"total_critical_chance_percent": TOTAL_CRITICAL_CHANCE_CAP_PERCENT,
}


static func earned_stat_points(player_level: int) -> int:
	return maxi(0, mini(player_level, PLAYER_LEVEL_CAP)) * STAT_POINTS_PER_LEVEL


static func earned_skill_points(player_level: int) -> int:
	return maxi(0, mini(player_level, PLAYER_LEVEL_CAP)) * SKILL_POINTS_PER_LEVEL


static func xp_required_for_level(player_level: int) -> int:
	var level := clampi(player_level, 1, PLAYER_LEVEL_CAP)
	if level >= PLAYER_LEVEL_CAP:
		return 0
	var completed_levels := float(level - 1)
	return BASE_XP_REQUIRED + (level - 1) * XP_LINEAR_GROWTH \
		+ floori(XP_CURVE_GROWTH * pow(completed_levels, 1.35))


## Pure rollover used by SaveService and tests. XP is the progress inside the
## current level rather than an ever-growing lifetime total.
static func resolve_experience_gain(
		player_level: int,
		current_xp: int,
		gained_xp: int,
) -> Dictionary:
	var level := clampi(player_level, 1, PLAYER_LEVEL_CAP)
	var xp := maxi(0, current_xp)
	var accepted := maxi(0, gained_xp)
	var levels_gained := 0
	if level >= PLAYER_LEVEL_CAP:
		xp = 0
	else:
		xp += accepted
		var required := xp_required_for_level(level)
		while level < PLAYER_LEVEL_CAP and required > 0 and xp >= required:
			xp -= required
			level += 1
			levels_gained += 1
			required = xp_required_for_level(level)
		if level >= PLAYER_LEVEL_CAP:
			xp = 0
	return {
		"previous_level": clampi(player_level, 1, PLAYER_LEVEL_CAP),
		"level": level,
		"xp": xp,
		"xp_required": xp_required_for_level(level),
		"gained": accepted,
		"levels_gained": levels_gained,
	}


static func level_growth_snapshot(player_level: int) -> Dictionary:
	var level := clampi(player_level, 1, PLAYER_LEVEL_CAP)
	var completed_levels := level - 1
	var geometric_sum := 0.0
	if completed_levels > 0:
		geometric_sum = (
			1.0 - pow(LEVEL_GROWTH_DECAY, float(completed_levels))
		) / (1.0 - LEVEL_GROWTH_DECAY)
	return {
		"player_level": level,
		"completed_levels": completed_levels,
		"surge_count": 0,
		"surge_interval": 0,
		"hp_flat": geometric_sum * HP_PER_PLAYER_LEVEL,
		# Explicit zero is retained in the inspection snapshot so tests and tools
		# can prove that account level never contributes offensive power.
		"damage_percent": 0.0,
		"mana_flat": geometric_sum * MANA_PER_PLAYER_LEVEL,
		"next_level_is_surge": false,
	}


static func validate_stat_allocation(player_level: int, allocation: Dictionary) -> bool:
	return stat_allocation_errors(player_level, allocation).is_empty()


static func stat_allocation_errors(player_level: int, allocation: Dictionary) -> PackedStringArray:
	var errors := PackedStringArray()
	if player_level < 1:
		errors.append("Player level must be at least one.")
	for raw_key: Variant in allocation.keys():
		if not STAT_IDS.has(StringName(raw_key)):
			errors.append("Unknown stat ID '%s'." % raw_key)

	var spent := 0
	for stat_id: StringName in STAT_IDS:
		var value: Variant = _dictionary_value(allocation, stat_id, null)
		if value == null:
			errors.append("Stat allocation requires '%s'." % stat_id)
			continue
		if not value is int:
			errors.append("Stat '%s' points must be an integer." % stat_id)
			continue
		var points := int(value)
		if points < 0 or points > STAT_POINT_CAP:
			errors.append("Stat '%s' points must stay between 0 and %d." % [stat_id, STAT_POINT_CAP])
			continue
		spent += points
	if spent > earned_stat_points(player_level):
		errors.append(
			"Stat allocation spends %d points but level %d has earned %d." % [
				spent,
				player_level,
				earned_stat_points(player_level),
			]
		)
	return errors


static func stat_snapshot(player_level: int, allocation: Dictionary) -> Dictionary:
	if not validate_stat_allocation(player_level, allocation):
		return {}
	var hp_points := int(_dictionary_value(allocation, &"hp", 0))
	var damage_points := int(_dictionary_value(allocation, &"damage", 0))
	var mana_points := int(_dictionary_value(allocation, &"mana", 0))
	var spent := hp_points + damage_points + mana_points
	var hp_bonus := stat_bonus(&"hp", hp_points)
	var damage_bonus_percent := stat_bonus(&"damage", damage_points)
	var mana_bonus := stat_bonus(&"mana", mana_points)
	var level_growth := level_growth_snapshot(player_level)
	return {
		"player_level": clampi(player_level, 1, PLAYER_LEVEL_CAP),
		"account_level": clampi(player_level, 1, PLAYER_LEVEL_CAP),
		"spent_points": spent,
		"unspent_points": earned_stat_points(player_level) - spent,
		"allocation": {
			"hp": hp_points,
			"damage": damage_points,
			"mana": mana_points,
		},
		"core_stat_ids": CORE_STAT_IDS.duplicate(),
		"core_stat_definitions": core_stat_definitions(),
		"hp": BASE_HP + float(level_growth["hp_flat"]) + hp_bonus,
		"hp_bonus": hp_bonus,
		# Use the Power authority directly. The level-shaped compatibility API
		# remains below only for old callers and cannot add offense.
		"damage": power_from_core(BASE_DAMAGE, damage_points),
		"core_damage": BASE_DAMAGE,
		"core_damage_bonus_percent": damage_bonus_percent,
		"mana": BASE_MANA + float(level_growth["mana_flat"]) + mana_bonus,
		"mana_bonus": mana_bonus,
		"level_growth": level_growth,
		"direct_milestone_bonus_percent": {"hp": 0.0, "mana": 0.0, "damage": 0.0},
		"secondary_effects": [],
		"next_point_returns": {
			"hp": next_stat_point_return(&"hp", hp_points),
			"damage": next_stat_point_return(&"damage", damage_points),
			"mana": next_stat_point_return(&"mana", mana_points),
		},
		# The old milestone catalog remains below for save/content inspection only.
		# It is deliberately absent from the live base-stat projection.
		"milestones": {"hp": [], "mana": [], "damage": []},
		"milestone_details": {"hp": [], "mana": [], "damage": []},
	}


static func core_stat_definitions() -> Dictionary:
	return CORE_STAT_DEFINITIONS.duplicate(true)


## Returns the marginal value granted by the one-based stat point index.
## Power uses percentage points of core damage; HP and Mana use flat units.
static func stat_point_return(stat_id: StringName, point_index: int) -> float:
	if point_index < 1 or point_index > STAT_POINT_CAP:
		return 0.0
	var definition_value: Variant = STAT_CURVE_DEFINITIONS.get(String(stat_id), null)
	if not definition_value is Dictionary:
		return 0.0
	var initial_return := float((definition_value as Dictionary).get("initial_return", 0.0))
	if initial_return <= 0.0:
		return 0.0
	var normalized_index := float(point_index - 1) / float(STAT_POINT_CAP - 1)
	return initial_return / (
		1.0 + STAT_DIMINISHING_RETURN_STRENGTH * normalized_index
	)


static func next_stat_point_return(stat_id: StringName, current_points: int) -> float:
	return stat_point_return(stat_id, current_points + 1)


static func stat_bonus(stat_id: StringName, points: int) -> float:
	var clamped_points := clampi(points, 0, STAT_POINT_CAP)
	var total := 0.0
	for point_index: int in range(1, clamped_points + 1):
		total += stat_point_return(stat_id, point_index)
	return total


static func power_from_core(core_damage: float, power_points: int) -> float:
	var safe_core_damage := maxf(0.0, core_damage)
	return safe_core_damage * (1.0 + stat_bonus(STAT_POWER, power_points) / 100.0)


## Compatibility entry point for callers and save fixtures using the stable
## technical key `damage`.
static func damage_from_core(core_damage: float, damage_points: int) -> float:
	return power_from_core(core_damage, damage_points)


static func damage_from_core_with_level(
		core_damage: float,
		_player_level: int,
		damage_points: int,
) -> float:
	# Level is accepted only for API compatibility. Offense comes from Power.
	return power_from_core(core_damage, damage_points)


## Adds only milestones which directly change the requested core stat. The
## input value is expected to include ordinary point returns already.
static func apply_direct_core_milestone_bonus(
		value: float,
		_stat_id: StringName,
		_points: int
) -> float:
	# Compatibility entry point: V0.4 milestone IDs are intentionally inert.
	return maxf(0.0, value)


static func direct_core_milestone_bonus_percent(_stat_id: StringName, _points: int) -> float:
	return 0.0


static func is_direct_core_milestone(_stat_id: StringName, _milestone_id: StringName) -> bool:
	return false


static func unlocked_milestones(points: int, definitions: Array) -> Array[String]:
	var unlocked: Array[String] = []
	var clamped_points := clampi(points, 0, STAT_POINT_CAP)
	for index: int in mini(definitions.size(), MILESTONE_THRESHOLDS.size()):
		if clamped_points < int(MILESTONE_THRESHOLDS[index]):
			break
		unlocked.append(String(definitions[index]))
	return unlocked


static func unlocked_milestone_entries(points: int, table: Array) -> Array[Dictionary]:
	var unlocked: Array[Dictionary] = []
	var clamped_points := clampi(points, 0, STAT_POINT_CAP)
	for raw_entry: Variant in table:
		if not raw_entry is Dictionary:
			continue
		var entry := raw_entry as Dictionary
		if clamped_points < int(entry.get("threshold", STAT_POINT_CAP + 1)):
			break
		unlocked.append(entry.duplicate(true))
	return unlocked


static func milestone_table(stat_id: StringName) -> Array:
	match stat_id:
		&"hp":
			return HP_MILESTONE_TABLE.duplicate(true)
		&"damage":
			return DAMAGE_MILESTONE_TABLE.duplicate(true)
		&"mana":
			return MANA_MILESTONE_TABLE.duplicate(true)
	return []


static func _milestone_ids_for_stat(stat_id: StringName) -> Array:
	match stat_id:
		&"hp":
			return HP_MILESTONES
		&"damage":
			return DAMAGE_MILESTONES
		&"mana":
			return MANA_MILESTONES
	return []


static func empty_skill_tracks() -> Dictionary:
	var result := {}
	for track_id: StringName in SKILL_TRACK_IDS:
		result[String(track_id)] = 0
	return result


static func skill_rank_gate(player_level: int) -> int:
	return clampi(ceili(float(mini(player_level, PLAYER_LEVEL_CAP)) / 5.0), 1, SKILL_RANK_CAP)


static func validate_hero_skill_allocation(
	player_level: int,
	hero_id: StringName,
	track_allocation: Dictionary,
) -> bool:
	return skill_allocation_errors(
		player_level,
		{String(hero_id): track_allocation},
	).is_empty()


static func validate_skill_allocations(player_level: int, allocations: Dictionary) -> bool:
	return skill_allocation_errors(player_level, allocations).is_empty()


static func skill_allocation_errors(player_level: int, allocations: Dictionary) -> PackedStringArray:
	var errors := PackedStringArray()
	if player_level < 1:
		errors.append("Player level must be at least one.")
	var total_spent := 0
	var rank_gate := skill_rank_gate(player_level)
	for raw_hero_id: Variant in allocations.keys():
		var hero_id := StringName(raw_hero_id)
		if not _is_valid_identity_id(hero_id):
			errors.append("Hero Identity ID '%s' must use lower_snake_case." % raw_hero_id)
		var tracks_value: Variant = allocations[raw_hero_id]
		if not tracks_value is Dictionary:
			errors.append("Hero Identity '%s' skill allocation must be a dictionary." % raw_hero_id)
			continue
		var tracks := tracks_value as Dictionary
		for raw_track_id: Variant in tracks.keys():
			if not SKILL_TRACK_IDS.has(StringName(raw_track_id)):
				errors.append("Hero Identity '%s' has unknown skill track '%s'." % [raw_hero_id, raw_track_id])
		for track_id: StringName in SKILL_TRACK_IDS:
			var rank_value: Variant = _dictionary_value(tracks, track_id, null)
			if rank_value == null:
				errors.append("Hero Identity '%s' requires skill track '%s'." % [raw_hero_id, track_id])
				continue
			if not rank_value is int:
				errors.append("Hero Identity '%s' track '%s' rank must be an integer." % [raw_hero_id, track_id])
				continue
			var rank := int(rank_value)
			if rank < 0 or rank > SKILL_RANK_CAP:
				errors.append("Hero Identity '%s' track '%s' rank must stay between 0 and %d." % [raw_hero_id, track_id, SKILL_RANK_CAP])
				continue
			if rank > rank_gate:
				errors.append("Hero Identity '%s' track '%s' rank %d exceeds level %d gate %d." % [raw_hero_id, track_id, rank, player_level, rank_gate])
				continue
			total_spent += rank
	if total_spent > earned_skill_points(player_level):
		errors.append(
			"Skill allocations spend %d points but level %d has earned %d." % [
				total_spent,
				player_level,
				earned_skill_points(player_level),
			]
		)
	return errors


static func skill_snapshot(player_level: int, allocations: Dictionary) -> Dictionary:
	if not validate_skill_allocations(player_level, allocations):
		return {}
	var normalized := {}
	var spent := 0
	for raw_hero_id: Variant in allocations.keys():
		var tracks := allocations[raw_hero_id] as Dictionary
		var normalized_tracks := {}
		for track_id: StringName in SKILL_TRACK_IDS:
			var rank := int(_dictionary_value(tracks, track_id, 0))
			normalized_tracks[String(track_id)] = rank
			spent += rank
		normalized[String(raw_hero_id)] = normalized_tracks
	return {
		"player_level": clampi(player_level, 1, PLAYER_LEVEL_CAP),
		"rank_gate": skill_rank_gate(player_level),
		"spent_points": spent,
		"unspent_points": earned_skill_points(player_level) - spent,
		"track_ids": SKILL_TRACK_IDS.duplicate(),
		"allocations": normalized,
	}


static func can_upgrade_skill(
	current_rank: int,
	available_points: int,
	player_level: int = PLAYER_LEVEL_CAP,
) -> bool:
	return (
		current_rank >= 0
		and current_rank < SKILL_RANK_CAP
		and current_rank < skill_rank_gate(player_level)
		and available_points >= 1
	)


static func can_upgrade_hero_skill(
	player_level: int,
	hero_id: StringName,
	track_id: StringName,
	allocations: Dictionary,
) -> bool:
	if not _is_valid_identity_id(hero_id) or not SKILL_TRACK_IDS.has(track_id):
		return false
	if not validate_skill_allocations(player_level, allocations):
		return false
	var hero_tracks_value: Variant = _dictionary_value(allocations, hero_id, null)
	if not hero_tracks_value is Dictionary:
		return false
	var current_rank := int(_dictionary_value(hero_tracks_value as Dictionary, track_id, -1))
	var snapshot := skill_snapshot(player_level, allocations)
	return can_upgrade_skill(current_rank, int(snapshot.get("unspent_points", 0)), player_level)


static func maximum_skill_ranks(player_level: int, hero_identity_count: int) -> int:
	return int(skill_budget_snapshot(player_level, hero_identity_count).get(
		"maximum_spendable_points",
		0,
	))


## Inspectable choice-pressure model used by UI, audits and future roster
## additions. Hero count expands capacity only; it never mints account points.
## This is the core invariant which lets a new Hero be added as content without
## retuning or migrating the global progression curve.
static func skill_budget_snapshot(
	player_level: int,
	hero_identity_count: int,
) -> Dictionary:
	if player_level < 1 or hero_identity_count < 1:
		return {
			"valid": false,
			"player_level": maxi(0, player_level),
			"hero_identity_count": maxi(0, hero_identity_count),
			"rank_gate": 0,
			"earned_points": 0,
			"available_rank_capacity": 0,
			"maximum_spendable_points": 0,
			"specialization_gap": 0,
		}
	var level := clampi(player_level, 1, PLAYER_LEVEL_CAP)
	var rank_gate := skill_rank_gate(level)
	var earned := earned_skill_points(level)
	var capacity := hero_identity_count * SKILL_TRACK_COUNT * rank_gate
	return {
		"valid": true,
		"player_level": level,
		"hero_identity_count": hero_identity_count,
		"rank_gate": rank_gate,
		"earned_points": earned,
		"available_rank_capacity": capacity,
		"maximum_spendable_points": mini(earned, capacity),
		"specialization_gap": maxi(0, capacity - earned),
	}


static func respec_cost(player_level: int) -> int:
	if player_level <= FREE_RESPEC_LEVEL_CAP:
		return 0
	return mini(RESPEC_COST_CAP, 100 + maxi(1, player_level) * 25)


## Produces a deterministic per-Identity respec transaction. Callers own the
## gold deduction; this contract only supplies the cost, refund, and new state.
static func respec_hero_identity(
	player_level: int,
	hero_id: StringName,
	allocations: Dictionary,
	is_outside_combat: bool,
) -> Dictionary:
	if not is_outside_combat or not _is_valid_identity_id(hero_id):
		return {}
	if not validate_skill_allocations(player_level, allocations):
		return {}
	var hero_tracks_value: Variant = _dictionary_value(allocations, hero_id, null)
	if not hero_tracks_value is Dictionary:
		return {}
	var refunded_points := 0
	for track_id: StringName in SKILL_TRACK_IDS:
		refunded_points += int(_dictionary_value(hero_tracks_value as Dictionary, track_id, 0))

	var updated_allocations := allocations.duplicate(true)
	if updated_allocations.has(hero_id):
		updated_allocations[hero_id] = empty_skill_tracks()
	else:
		updated_allocations[String(hero_id)] = empty_skill_tracks()
	return {
		"hero_id": String(hero_id),
		"cost": respec_cost(player_level),
		"refunded_points": refunded_points,
		"allocations": updated_allocations,
	}


static func global_caps() -> Dictionary:
	return GLOBAL_CAPS.duplicate(true)


static func global_combat_caps() -> Dictionary:
	return {
		"cooldown_reduction_percent": TOTAL_COOLDOWN_REDUCTION_CAP_PERCENT,
		"dodge_chance_percent": TOTAL_DODGE_CHANCE_CAP_PERCENT,
		"barrier_capacity_percent": TOTAL_BARRIER_CAPACITY_CAP_PERCENT,
		"bonus_attack_speed_percent": TOTAL_BONUS_ATTACK_SPEED_CAP_PERCENT,
		"critical_chance_percent": TOTAL_CRITICAL_CHANCE_CAP_PERCENT,
	}


static func _dictionary_value(dictionary: Dictionary, key: StringName, fallback: Variant) -> Variant:
	if dictionary.has(key):
		return dictionary[key]
	var string_key := String(key)
	return dictionary.get(string_key, fallback)


static func _is_valid_identity_id(hero_id: StringName) -> bool:
	var value := String(hero_id)
	if value.is_empty() or value.ends_with("_") or value.contains("__"):
		return false
	var first := value.unicode_at(0)
	if first < 97 or first > 122:
		return false
	for index: int in value.length():
		var code := value.unicode_at(index)
		if not (code >= 97 and code <= 122) and not (code >= 48 and code <= 57) and code != 95:
			return false
	return true
