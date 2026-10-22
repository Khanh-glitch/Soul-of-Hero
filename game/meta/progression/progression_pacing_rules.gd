class_name ProgressionPacingRules
extends RefCounted

## Canonical supplementary kill-XP pacing. Campaign first-clear rewards remain
## the primary +1 level source; kills expose a small, inspectable fraction of the
## stage's current XP bucket without rounding every enemy up to one XP.

const PLAYER_PROGRESSION_RULES := preload(
	"res://game/meta/progression/player_progression_rules.gd"
)
const ORDINARY_STAGE_BUDGET_RATIO := 0.15
const BOSS_STAGE_BUDGET_RATIO := 0.10
const ORDINARY_REFERENCE_SCORE := 100.0
const BOSS_REFERENCE_SCORE := 650.0
const MIN_THREAT_WEIGHT := 0.65
const MAX_THREAT_WEIGHT := 1.75
const EXPERIENCE_PROJECTION_REVISION := 3


static func stage_budget_breakdown(
	stage_level: int,
	population_context: Dictionary = {},
) -> Dictionary:
	var stage := clampi(stage_level, 1, PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP)
	var xp_required := PLAYER_PROGRESSION_RULES.xp_required_for_level(stage)
	var context_validation := validate_population_context(population_context, stage)
	var context_valid := bool(context_validation.get("valid", false))
	var reference_population := (
		int(population_context.get("reference_easy_population", 0))
		if context_valid
		else 0
	)
	var ordinary_budget := float(xp_required) * ORDINARY_STAGE_BUDGET_RATIO
	var boss_budget := float(xp_required) * BOSS_STAGE_BUDGET_RATIO
	return {
		"revision": EXPERIENCE_PROJECTION_REVISION,
		"valid": context_valid,
		"error": String(context_validation.get("error", "")),
		"stage_level": stage,
		"xp_required": xp_required,
		"population_context_revision": int(population_context.get("revision", 0)),
		"population_source": String(population_context.get("source", "")),
		"population_plan_signature": String(population_context.get("plan_signature", "")),
		"reference_easy_population": reference_population,
		"realized_population": int(population_context.get("realized_population", 0)),
		# Compatibility key for report consumers. Its meaning is now explicitly
		# the current level's Easy plan, never the generic three-floor stage plan.
		"canonical_easy_members": reference_population,
		"ordinary_budget_ratio": ORDINARY_STAGE_BUDGET_RATIO,
		"ordinary_budget_units": ordinary_budget,
		"ordinary_units_per_reference_kill": (
			ordinary_budget / float(reference_population)
			if context_valid and reference_population > 0
			else 0.0
		),
		"boss_budget_ratio": BOSS_STAGE_BUDGET_RATIO,
		"boss_budget_units": boss_budget,
		"nominal_total_units": ordinary_budget + boss_budget,
	}


static func validate_population_context(
	population_context: Dictionary,
	stage_level: int,
) -> Dictionary:
	if population_context.is_empty():
		return {
			"valid": false,
			"error": "XP projection requires a realized encounter population context.",
		}
	if not bool(population_context.get("valid", false)):
		return {
			"valid": false,
			"error": String(population_context.get(
				"error",
				"Encounter population context is invalid.",
			)),
		}
	var stage := clampi(stage_level, 1, PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP)
	if int(population_context.get("stage_level", 0)) != stage:
		return {
			"valid": false,
			"error": "Encounter population context belongs to a different stage.",
		}
	if int(population_context.get("reference_easy_population", 0)) <= 0:
		return {
			"valid": false,
			"error": "XP reference Easy population must be positive.",
		}
	if int(population_context.get("realized_population", -1)) < 0:
		return {
			"valid": false,
			"error": "Realized encounter population cannot be negative.",
		}
	if String(population_context.get("plan_signature", "")).is_empty():
		return {
			"valid": false,
			"error": "Encounter population context requires a plan signature.",
		}
	return {"valid": true, "error": ""}


## Score is a content-wide threat proxy. Square-root weighting lets stronger
## enemies pay more without a few large score values consuming the whole curve.
static func threat_weight(
	base_score: float,
	is_boss := false,
	reward_score_scale := 1.0,
) -> float:
	var reference_score := BOSS_REFERENCE_SCORE if is_boss else ORDINARY_REFERENCE_SCORE
	var score_ratio := maxf(0.0, base_score) / reference_score
	# Elite score is already included in base_score. Scale the safety bounds by
	# the same square-root response so the ordinary cap cannot erase an authored
	# Elite reward axis. A 2.5x Elite score therefore remains sqrt(2.5)x the XP
	# of its otherwise-identical normal enemy even when either reaches a bound.
	var bound_scale := sqrt(maxf(1.0, reward_score_scale))
	return clampf(
		sqrt(score_ratio),
		MIN_THREAT_WEIGHT * bound_scale,
		MAX_THREAT_WEIGHT * bound_scale,
	)


static func project_enemy_reward(
	base_score: float,
	stage_level: int,
	is_boss := false,
	population_context: Dictionary = {},
	reward_score_scale := 1.0,
) -> Dictionary:
	var budget := stage_budget_breakdown(stage_level, population_context)
	var base_units := float(
		budget["boss_budget_units"]
		if is_boss
		else budget["ordinary_units_per_reference_kill"]
	)
	if not bool(budget.get("valid", false)):
		base_units = 0.0
	var safe_reward_score_scale := maxf(1.0, reward_score_scale)
	var bound_scale := sqrt(safe_reward_score_scale)
	var weight := threat_weight(base_score, is_boss, safe_reward_score_scale)
	return {
		"revision": EXPERIENCE_PROJECTION_REVISION,
		"valid": bool(budget.get("valid", false)),
		"error": String(budget.get("error", "")),
		"stage_level": int(budget["stage_level"]),
		"is_boss": is_boss,
		"base_score": maxf(0.0, base_score),
		"reference_score": BOSS_REFERENCE_SCORE if is_boss else ORDINARY_REFERENCE_SCORE,
		"threat_weight": weight,
		"reward_score_scale": safe_reward_score_scale,
		"min_threat_weight": MIN_THREAT_WEIGHT * bound_scale,
		"max_threat_weight": MAX_THREAT_WEIGHT * bound_scale,
		"base_reward_units": base_units,
		"reward_units": base_units * weight,
		"population_source": String(budget.get("population_source", "")),
		"population_plan_signature": String(budget.get("population_plan_signature", "")),
		"reference_easy_population": int(budget.get("reference_easy_population", 0)),
		"realized_population": int(budget.get("realized_population", 0)),
	}


static func enemy_experience_reward_units(
	base_score: float,
	stage_level: int,
	is_boss := false,
	population_context: Dictionary = {},
) -> float:
	return float(project_enemy_reward(
		base_score,
		stage_level,
		is_boss,
		population_context,
	)["reward_units"])


## Projects the density contribution independently of stat scaling. Hard can
## earn somewhat more by materializing more enemies, while every per-kill unit
## is still divided by the canonical Easy population.
static func project_population_budget(
	stage_level: int,
	difficulty_id: Variant,
	base_score := ORDINARY_REFERENCE_SCORE,
	population_context: Dictionary = {},
) -> Dictionary:
	var budget := stage_budget_breakdown(stage_level, population_context)
	var expected_members := maxi(0, int(population_context.get("realized_population", 0)))
	var reward := project_enemy_reward(
		base_score,
		stage_level,
		false,
		population_context,
	)
	var expected_units := float(reward["reward_units"]) * float(expected_members)
	var xp_required := int(budget["xp_required"])
	return {
		"revision": EXPERIENCE_PROJECTION_REVISION,
		"valid": bool(budget.get("valid", false)),
		"error": String(budget.get("error", "")),
		"stage_level": int(budget["stage_level"]),
		"difficulty": String(population_context.get(
			"difficulty",
			String(difficulty_id),
		)),
		"canonical_easy_members": int(budget["canonical_easy_members"]),
		"reference_easy_population": int(budget.get("reference_easy_population", 0)),
		"expected_members": expected_members,
		"realized_population": expected_members,
		"population_plan_signature": String(budget.get("population_plan_signature", "")),
		"base_score": maxf(0.0, base_score),
		"reward_units_per_kill": float(reward["reward_units"]),
		"expected_ordinary_units": expected_units,
		"xp_required": xp_required,
		"xp_bucket_ratio": expected_units / float(xp_required) if xp_required > 0 else 0.0,
	}


## Splits a fractional kill reward into durable whole XP and a run-local carry.
## The carry invariant guarantees that abandoning a scene can discard less than
## one XP, never one rounded-up XP per enemy.
static func resolve_fractional_carry(current_carry: float, reward_units: float) -> Dictionary:
	var total_units := maxf(0.0, current_carry) + maxf(0.0, reward_units)
	var whole_xp := floori(total_units)
	var next_carry := total_units - float(whole_xp)
	return {
		"input_carry": maxf(0.0, current_carry),
		"reward_units": maxf(0.0, reward_units),
		"total_units": total_units,
		"whole_xp": whole_xp,
		"carry": next_carry,
	}


static func project_fractional_sequence(
	reward_units: Array,
	starting_carry := 0.0,
) -> Dictionary:
	var carry := maxf(0.0, starting_carry)
	var committed_xp := 0
	var input_units := 0.0
	for raw_units: Variant in reward_units:
		var units := maxf(0.0, float(raw_units))
		input_units += units
		var projection := resolve_fractional_carry(carry, units)
		committed_xp += int(projection["whole_xp"])
		carry = float(projection["carry"])
	return {
		"starting_carry": maxf(0.0, starting_carry),
		"input_units": input_units,
		"whole_xp": committed_xp,
		"carry": carry,
		"conserved_units": float(committed_xp) + carry,
	}
