class_name CombatResolver
extends RefCounted

## Pure, deterministic authority for resolving one damage hit. The resolver has
## no scene-tree, save, or random-number-generator dependency so runtime hits and
## UI previews can consume the exact same formula.

const FORMULA_VERSION := 2
const DEFAULT_DEFENSE_CONSTANT := 100.0 # Deprecated compatibility field.
const MAX_VARIANCE_PERCENT := 25.0
const FORMULA_TEXT := "(base + sum(flat)) * (1 + sum(additive_percent) / 100) * action_multiplier * product(unique) * variance * critical * product(explicit_damage_taken)"


## Returns deterministic minimum, expected, and maximum damage projections.
##
## Request contract:
## {
##   "base": number,
##   "flat_modifiers": {source_name: number},
##   "additive_percent_modifiers": {source_name: number},
##   "action_multiplier": number,
##   "unique_multipliers": {source_name: number},
##   "variance_percent": number, # symmetric and capped at 25
##   "critical_chance_percent": number, # capped at 100
##   "critical_multiplier": number, # clamped to at least 1
##   "damage_taken_multipliers": {source_name: number},
##   "defense": {
##     "rating": number,
##     "percent_penetration": number,
##     "flat_penetration": number,
##     "constant": number, # defaults to 100
##   },
## }
static func preview(request: Dictionary) -> Dictionary:
	var context := _sanitize_request(request)
	var variance_percent := float(context["variance_percent"])
	var variance_min := 1.0 - variance_percent / 100.0
	var variance_max := 1.0 + variance_percent / 100.0
	var critical_chance := float(context["critical_chance_percent"]) / 100.0
	var configured_critical := float(context["critical_multiplier"])
	var minimum_critical := configured_critical if critical_chance >= 1.0 else 1.0
	var maximum_critical := configured_critical if critical_chance > 0.0 else 1.0
	var expected_critical := 1.0 + critical_chance * (configured_critical - 1.0)

	var minimum_stages := _resolve_stages(context, variance_min, minimum_critical)
	var expected_stages := _resolve_stages(context, 1.0, expected_critical)
	var maximum_stages := _resolve_stages(context, variance_max, maximum_critical)
	var minimum_raw := float(minimum_stages["final"])
	var expected_raw := float(expected_stages["final"])
	var maximum_raw := float(maximum_stages["final"])
	var expected_details := {
		"mode": "preview",
		"variance_roll": 0.5,
		"variance_multiplier": 1.0,
		"critical_roll": -1.0,
		"critical_multiplier": expected_critical,
		"is_critical": false,
	}

	return {
		"formula_version": FORMULA_VERSION,
		"formula": FORMULA_TEXT,
		"minimum_damage": _final_damage(minimum_raw),
		"expected_damage": _final_damage(expected_raw),
		"maximum_damage": _final_damage(maximum_raw),
		"minimum_raw_damage": minimum_raw,
		"expected_raw_damage": expected_raw,
		"maximum_raw_damage": maximum_raw,
		"variance": {
			"percent": variance_percent,
			"minimum_multiplier": variance_min,
			"expected_multiplier": 1.0,
			"maximum_multiplier": variance_max,
		},
		"critical": {
			"chance_percent": float(context["critical_chance_percent"]),
			"configured_multiplier": configured_critical,
			"minimum_multiplier": minimum_critical,
			"expected_multiplier": expected_critical,
			"maximum_multiplier": maximum_critical,
		},
		"defense": (context["defense"] as Dictionary).duplicate(true),
		"breakdown": _build_breakdown(context, expected_stages, expected_details),
	}


## Resolves one hit from caller-provided normalized rolls. No RNG is consumed.
## `variance_roll` and `critical_roll` are clamped to [0, 1]. A missing or
## malformed variance roll resolves to the midpoint; a missing or malformed
## critical roll resolves to a non-critical roll unless chance is 100 percent.
static func resolve_hit(request: Dictionary, rolls: Dictionary) -> Dictionary:
	var context := _sanitize_request(request)
	var variance_roll := _normalized_roll(rolls.get("variance_roll", 0.5), 0.5)
	var critical_roll := _normalized_roll(rolls.get("critical_roll", 1.0), 1.0)
	var variance_percent := float(context["variance_percent"])
	var variance_min := 1.0 - variance_percent / 100.0
	var variance_max := 1.0 + variance_percent / 100.0
	var variance_multiplier := lerpf(variance_min, variance_max, variance_roll)
	var chance_ratio := float(context["critical_chance_percent"]) / 100.0
	var is_critical := chance_ratio >= 1.0 or (chance_ratio > 0.0 and critical_roll < chance_ratio)
	var applied_critical := float(context["critical_multiplier"]) if is_critical else 1.0
	var stages := _resolve_stages(context, variance_multiplier, applied_critical)
	var raw_damage := float(stages["final"])
	var details := {
		"mode": "resolved",
		"variance_roll": variance_roll,
		"variance_multiplier": variance_multiplier,
		"critical_roll": critical_roll,
		"critical_multiplier": applied_critical,
		"is_critical": is_critical,
	}
	var defense: Dictionary = context["defense"]

	return {
		"formula_version": FORMULA_VERSION,
		"formula": FORMULA_TEXT,
		"damage": _final_damage(raw_damage),
		"raw_damage": raw_damage,
		"is_critical": is_critical,
		"variance_roll": variance_roll,
		"variance_multiplier": variance_multiplier,
		"critical_roll": critical_roll,
		"critical_chance_percent": float(context["critical_chance_percent"]),
		"configured_critical_multiplier": float(context["critical_multiplier"]),
		"applied_critical_multiplier": applied_critical,
		"effective_defense_rating": float(defense["effective_rating"]),
		"damage_reduction": float(defense["damage_reduction"]),
		"defense_multiplier": float(defense["multiplier"]),
		"breakdown": _build_breakdown(context, stages, details),
	}


static func _sanitize_request(request: Dictionary) -> Dictionary:
	var flat := _sanitize_named_bucket(request.get("flat_modifiers", {}), false)
	var additive_percent := _sanitize_named_bucket(
		request.get("additive_percent_modifiers", {}),
		false
	)
	var unique := _sanitize_named_bucket(request.get("unique_multipliers", {}), true)
	var damage_taken := _sanitize_named_bucket(
		request.get("damage_taken_multipliers", {}),
		true
	)
	var defense_request: Dictionary = {}
	var requested_defense: Variant = request.get("defense", {})
	if requested_defense is Dictionary:
		defense_request = requested_defense
	var defense_constant := _positive_finite(
		defense_request.get("constant", DEFAULT_DEFENSE_CONSTANT),
		DEFAULT_DEFENSE_CONSTANT
	)
	var defense_rating := _non_negative_finite(defense_request.get("rating", 0.0), 0.0)
	var percent_penetration := _non_negative_finite(
		defense_request.get("percent_penetration", 0.0),
		0.0
	)
	var flat_penetration := _non_negative_finite(
		defense_request.get("flat_penetration", 0.0),
		0.0
	)

	return {
		"base": _non_negative_finite(request.get("base", 0.0), 0.0),
		"flat": flat,
		"additive_percent": additive_percent,
		"action_multiplier": _non_negative_finite(request.get("action_multiplier", 1.0), 1.0),
		"unique": unique,
		"variance_percent": clampf(
			_non_negative_finite(request.get("variance_percent", 0.0), 0.0),
			0.0,
			MAX_VARIANCE_PERCENT
		),
		"critical_chance_percent": clampf(
			_non_negative_finite(request.get("critical_chance_percent", 0.0), 0.0),
			0.0,
			100.0
		),
		"critical_multiplier": maxf(
			1.0,
			_non_negative_finite(request.get("critical_multiplier", 1.0), 1.0)
		),
		"damage_taken": damage_taken,
		"defense": {
			"rating": defense_rating,
			"percent_penetration": percent_penetration,
			"flat_penetration": flat_penetration,
			"constant": defense_constant,
			"effective_rating": 0.0,
			"damage_reduction": 0.0,
			"multiplier": 1.0,
			"ignored_hidden_defense": defense_rating > 0.0 or percent_penetration > 0.0 or flat_penetration > 0.0,
		},
	}


static func _sanitize_named_bucket(raw_bucket: Variant, multiply: bool) -> Dictionary:
	var raw_sources: Dictionary = {}
	if raw_bucket is Dictionary:
		raw_sources = raw_bucket
	elif raw_bucket is int or raw_bucket is float:
		raw_sources = {"unnamed": raw_bucket}

	var keys: Array = raw_sources.keys()
	keys.sort_custom(func(left: Variant, right: Variant) -> bool: return String(left) < String(right))
	var sources: Array[Dictionary] = []
	var combined := 1.0 if multiply else 0.0
	for key: Variant in keys:
		var fallback := 1.0 if multiply else 0.0
		var value := _non_negative_finite(raw_sources[key], fallback)
		sources.append({"name": String(key), "value": value})
		combined = _safe_multiply(combined, value) if multiply else _safe_add(combined, value)

	return {
		"sources": sources,
		"combined": combined,
	}


static func _resolve_stages(
		context: Dictionary,
		variance_multiplier: float,
		critical_multiplier: float
) -> Dictionary:
	var flat: Dictionary = context["flat"]
	var additive_percent: Dictionary = context["additive_percent"]
	var unique: Dictionary = context["unique"]
	var damage_taken: Dictionary = context["damage_taken"]
	var additive_multiplier := 1.0 + float(additive_percent["combined"]) / 100.0
	var stages := {
		"base": float(context["base"]),
	}
	stages["after_flat"] = _safe_add(float(stages["base"]), float(flat["combined"]))
	stages["after_additive_percent"] = _safe_multiply(
		float(stages["after_flat"]),
		additive_multiplier
	)
	stages["after_action"] = _safe_multiply(
		float(stages["after_additive_percent"]),
		float(context["action_multiplier"])
	)
	stages["after_unique"] = _safe_multiply(
		float(stages["after_action"]),
		float(unique["combined"])
	)
	stages["after_variance"] = _safe_multiply(
		float(stages["after_unique"]),
		variance_multiplier
	)
	stages["after_critical"] = _safe_multiply(
		float(stages["after_variance"]),
		critical_multiplier
	)
	stages["after_damage_taken"] = _safe_multiply(
		float(stages["after_critical"]),
		float(damage_taken["combined"])
	)
	stages["final"] = float(stages["after_damage_taken"])
	return stages


static func _build_breakdown(
		context: Dictionary,
		stages: Dictionary,
		details: Dictionary
) -> Array[Dictionary]:
	var flat: Dictionary = context["flat"]
	var additive_percent: Dictionary = context["additive_percent"]
	var unique: Dictionary = context["unique"]
	var damage_taken: Dictionary = context["damage_taken"]
	var defense: Dictionary = context["defense"]
	var mode := String(details["mode"])
	var breakdown: Array[Dictionary] = []
	breakdown.append({
		"id": "base",
		"label": "Base / Core",
		"operation": "set",
		"combined_value": float(context["base"]),
		"running_value": float(stages["base"]),
		"text": "Base / Core: %.4f" % float(context["base"]),
	})
	breakdown.append({
		"id": "flat",
		"label": "Flat damage",
		"operation": "sum_then_add",
		"sources": (flat["sources"] as Array).duplicate(true),
		"combined_value": float(flat["combined"]),
		"running_value": float(stages["after_flat"]),
		"text": "Flat damage: +%.4f from %d named source(s)" % [
			float(flat["combined"]),
			(flat["sources"] as Array).size(),
		],
	})
	var additive_multiplier := 1.0 + float(additive_percent["combined"]) / 100.0
	breakdown.append({
		"id": "additive_percent",
		"label": "Additive damage percent",
		"operation": "sum_then_multiply",
		"sources": (additive_percent["sources"] as Array).duplicate(true),
		"combined_value": float(additive_percent["combined"]),
		"multiplier": additive_multiplier,
		"running_value": float(stages["after_additive_percent"]),
		"text": "Additive damage percent: +%.2f%% -> x%.4f" % [
			float(additive_percent["combined"]),
			additive_multiplier,
		],
	})
	breakdown.append({
		"id": "action",
		"label": "Skill / Action",
		"operation": "multiply",
		"multiplier": float(context["action_multiplier"]),
		"running_value": float(stages["after_action"]),
		"text": "Skill / Action: x%.4f" % float(context["action_multiplier"]),
	})
	breakdown.append({
		"id": "unique",
		"label": "Unique multipliers",
		"operation": "multiply_each",
		"sources": (unique["sources"] as Array).duplicate(true),
		"combined_value": float(unique["combined"]),
		"running_value": float(stages["after_unique"]),
		"text": "Unique multipliers: x%.4f from %d named source(s)" % [
			float(unique["combined"]),
			(unique["sources"] as Array).size(),
		],
	})
	var variance_text := "Variance: expected x%.4f within +/-%.2f%%" % [
		float(details["variance_multiplier"]),
		float(context["variance_percent"]),
	]
	if mode == "resolved":
		variance_text = "Variance: roll %.4f -> x%.4f within +/-%.2f%%" % [
			float(details["variance_roll"]),
			float(details["variance_multiplier"]),
			float(context["variance_percent"]),
		]
	breakdown.append({
		"id": "variance",
		"label": "Symmetric variance",
		"operation": "multiply",
		"roll": float(details["variance_roll"]),
		"multiplier": float(details["variance_multiplier"]),
		"running_value": float(stages["after_variance"]),
		"text": variance_text,
	})
	var critical_text := "Critical: %.2f%% chance at x%.4f -> expected x%.4f" % [
		float(context["critical_chance_percent"]),
		float(context["critical_multiplier"]),
		float(details["critical_multiplier"]),
	]
	if mode == "resolved":
		critical_text = "Critical: roll %.4f against %.2f%% -> %s, x%.4f" % [
			float(details["critical_roll"]),
			float(context["critical_chance_percent"]),
			"critical" if bool(details["is_critical"]) else "normal",
			float(details["critical_multiplier"]),
		]
	breakdown.append({
		"id": "critical",
		"label": "Critical hit",
		"operation": "multiply",
		"chance_percent": float(context["critical_chance_percent"]),
		"configured_multiplier": float(context["critical_multiplier"]),
		"roll": float(details["critical_roll"]),
		"is_critical": bool(details["is_critical"]),
		"multiplier": float(details["critical_multiplier"]),
		"running_value": float(stages["after_critical"]),
		"text": critical_text,
	})
	breakdown.append({
		"id": "damage_taken",
		"label": "Target damage-taken multipliers",
		"operation": "multiply_each",
		"sources": (damage_taken["sources"] as Array).duplicate(true),
		"combined_value": float(damage_taken["combined"]),
		"running_value": float(stages["after_damage_taken"]),
		"text": "Target damage-taken multipliers: x%.4f from %d named source(s)" % [
			float(damage_taken["combined"]),
			(damage_taken["sources"] as Array).size(),
		],
	})
	breakdown.append({
		"id": "final",
		"label": "Final damage",
		"operation": "round_once",
		"raw_value": float(stages["final"]),
		"rounded_value": _final_damage(float(stages["final"])),
		"text": "Final damage: %.4f -> %d (rounded once)" % [
			float(stages["final"]),
			_final_damage(float(stages["final"])),
		],
	})
	return breakdown


static func _normalized_roll(value: Variant, fallback: float) -> float:
	return clampf(_finite_float(value, fallback), 0.0, 1.0)


static func _positive_finite(value: Variant, fallback: float) -> float:
	var numeric := _finite_float(value, fallback)
	return numeric if numeric > 0.0 else fallback


static func _non_negative_finite(value: Variant, fallback: float) -> float:
	return maxf(0.0, _finite_float(value, fallback))


static func _finite_float(value: Variant, fallback: float) -> float:
	if not (value is int or value is float):
		return fallback
	var numeric := float(value)
	return numeric if _is_finite_number(numeric) else fallback


static func _is_finite_number(value: float) -> bool:
	return not is_nan(value) and not is_inf(value)


static func _safe_add(left: float, right: float) -> float:
	var result := left + right
	return maxf(0.0, result) if _is_finite_number(result) else 0.0


static func _safe_multiply(left: float, right: float) -> float:
	var result := left * right
	return maxf(0.0, result) if _is_finite_number(result) else 0.0


static func _final_damage(raw_damage: float) -> int:
	if not _is_finite_number(raw_damage) or raw_damage <= 0.0:
		return 0
	return maxi(1, roundi(raw_damage))
