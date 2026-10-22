class_name DifficultyRules
extends RefCounted

const PLAYER_PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const PROGRESSION_PACING_RULES := preload("res://game/meta/progression/progression_pacing_rules.gd")

## One canonical contract for campaign difficulty, encounter pressure and luck.
## Runtime systems consume a copied modifier Dictionary so no caller can mutate
## the balance table for another run.

const EASY: StringName = &"easy"
const MEDIUM: StringName = &"medium"
const HARD: StringName = &"hard"
const DEFAULT_DIFFICULTY: StringName = EASY
const DIFFICULTY_IDS: Array[StringName] = [EASY, MEDIUM, HARD]
const MUTANT_UNLOCK_STAGE := 4
## Enemy pressure is authored independently from player progression. These
## values preserve the pre-Power stage curve while player level stops granting
## damage, preventing a player-system change from silently weakening monsters.
const ENEMY_DAMAGE_PERCENT_PER_STAGE := 5.0
const ENEMY_DAMAGE_GROWTH_DECAY := 0.99

const _MODIFIERS := {
	"easy": {
		"enemy_health": 1.0,
		"enemy_damage": 1.0,
		"enemy_speed": 1.0,
		"spawn_quantity": 1.12,
		"mutant_chance": 0.03,
		"luck": 1.0,
		"rare_chest_chance": 1.0,
		"rare_drop_chance": 1.0,
	},
	"medium": {
		"enemy_health": 1.35,
		"enemy_damage": 1.25,
		"enemy_speed": 1.08,
		"spawn_quantity": 1.25,
		"mutant_chance": 0.10,
		"luck": 1.35,
		"rare_chest_chance": 1.45,
		"rare_drop_chance": 1.45,
	},
	"hard": {
		"enemy_health": 1.75,
		"enemy_damage": 1.55,
		"enemy_speed": 1.15,
		"spawn_quantity": 1.50,
		"mutant_chance": 0.20,
		"luck": 1.85,
		"rare_chest_chance": 2.10,
		"rare_drop_chance": 2.10,
	},
}


static func normalize_id(value: Variant) -> StringName:
	var normalized := StringName(String(value).strip_edges().to_lower())
	return normalized if normalized in DIFFICULTY_IDS else DEFAULT_DIFFICULTY


static func is_valid_id(value: Variant) -> bool:
	return StringName(String(value).strip_edges().to_lower()) in DIFFICULTY_IDS


static func get_modifiers(difficulty_id: Variant) -> Dictionary:
	var normalized := normalize_id(difficulty_id)
	var result: Dictionary = (_MODIFIERS[String(normalized)] as Dictionary).duplicate(true)
	result["id"] = String(normalized)
	return result


static func get_options() -> Array[Dictionary]:
	return [
		{
			"id": EASY,
			"display_name": "Easy",
			"description": "Nhịp chiến đấu chuẩn, tỉ lệ rơi đồ cơ bản.",
			"modifiers": get_modifiers(EASY),
		},
		{
			"id": MEDIUM,
			"display_name": "Medium",
			"description": "Nhiều quái và đột biến hơn, tăng may mắn rương/đồ hiếm.",
			"modifiers": get_modifiers(MEDIUM),
		},
		{
			"id": HARD,
			"display_name": "Hard",
			"description": "Áp lực cao nhất, đổi lại tỉ lệ rương và vật phẩm hiếm tốt nhất.",
			"modifiers": get_modifiers(HARD),
		},
	]


static func available_ids(level_completed: bool) -> Array[StringName]:
	return DIFFICULTY_IDS.duplicate() if level_completed else [EASY]


## Enemy level is the campaign stage. HP follows the campaign durability curve;
## enemy damage owns a separate stage-pressure curve. Easy/Medium/Hard applies
## on top. Equipment and allocated Stat Points remain the player's earned
## advantage rather than being silently copied to enemies.
static func stage_modifiers(stage_level: int, difficulty_id: Variant) -> Dictionary:
	var stage := clampi(stage_level, 1, 100)
	var growth := PLAYER_PROGRESSION_RULES.level_growth_snapshot(stage)
	var hp_growth := float(growth.get("hp_flat", 0.0))
	var damage_growth_percent := enemy_stage_damage_growth_percent(stage)
	var steps := float(stage - 1)
	var result := get_modifiers(difficulty_id)
	result["base_mutant_chance"] = float(result.get("mutant_chance", 0.0))
	result["mutant_chance"] = effective_mutant_chance(stage, difficulty_id)
	result["stage_level"] = stage
	result["enemy_level"] = stage
	result["stage_growth_surges"] = 0 # Compatibility metadata; numeric surges retired.
	result["stage_growth_curve"] = "geometric_decay"
	result["stage_growth_decay"] = PLAYER_PROGRESSION_RULES.LEVEL_GROWTH_DECAY
	result["stage_damage_growth_curve"] = "independent_geometric_decay"
	result["stage_damage_growth_decay"] = ENEMY_DAMAGE_GROWTH_DECAY
	result["stage_health"] = (
		PLAYER_PROGRESSION_RULES.BASE_HP + hp_growth
	) / PLAYER_PROGRESSION_RULES.BASE_HP
	result["stage_damage"] = 1.0 + damage_growth_percent / 100.0
	result["stage_speed"] = 1.0 + minf(0.30, steps * 0.006)
	result["health_multiplier"] = float(result["enemy_health"]) * float(result["stage_health"])
	result["damage_multiplier"] = float(result["enemy_damage"]) * float(result["stage_damage"])
	result["speed_multiplier"] = float(result["enemy_speed"]) * float(result["stage_speed"])
	return result


static func enemy_stage_damage_growth_percent(stage_level: int) -> float:
	var stage := clampi(stage_level, 1, 100)
	var completed_stages := stage - 1
	if completed_stages <= 0:
		return 0.0
	var geometric_sum := (
		1.0 - pow(ENEMY_DAMAGE_GROWTH_DECAY, float(completed_stages))
	) / (1.0 - ENEMY_DAMAGE_GROWTH_DECAY)
	return geometric_sum * ENEMY_DAMAGE_PERCENT_PER_STAGE


static func density_bonus_count(authored_enemy_count: int, difficulty_id: Variant) -> int:
	var count := maxi(0, authored_enemy_count)
	var multiplier := float(get_modifiers(difficulty_id).get("spawn_quantity", 1.0))
	var bonus := maxi(0, roundi(float(count) * multiplier) - count)
	# Even a small safe camp should communicate the denser default cadence.
	if count > 0 and multiplier > 1.0:
		bonus = maxi(1, bonus)
	return bonus


static func deterministic_roll(run_id: String, entity_id: StringName, channel := "mutant") -> float:
	var digest := "%s|%s|%s" % [run_id.strip_edges(), String(entity_id), channel]
	var hex := digest.sha256_text().substr(0, 8)
	var bucket := hex.hex_to_int()
	return clampf(float(bucket) / 4294967296.0, 0.0, 0.999999999)


static func effective_mutant_chance(stage_level: int, difficulty_id: Variant) -> float:
	if clampi(stage_level, 1, 100) < MUTANT_UNLOCK_STAGE:
		return 0.0
	return clampf(
		float(get_modifiers(difficulty_id).get("mutant_chance", 0.0)),
		0.0,
		1.0,
	)


static func should_spawn_mutant(
		run_id: String,
		entity_id: StringName,
		difficulty_id: Variant,
		stage_level: int,
) -> bool:
	var chance := effective_mutant_chance(stage_level, difficulty_id)
	return deterministic_roll(run_id, entity_id) < chance


static func enemy_experience_reward(
		base_score: int,
		stage_level: int,
		is_boss := false,
		population_context: Dictionary = {},
) -> float:
	return PROGRESSION_PACING_RULES.enemy_experience_reward_units(
		float(maxi(0, base_score)),
		stage_level,
		is_boss,
		population_context,
	)
