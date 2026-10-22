extends SceneTree

const RESOLVER := preload("res://game/combat/combat_resolver.gd")
const REPORT_PATH := "res://.artifacts/combat_resolver_report.json"

var _checks := 0
var _failures: Array[String] = []
var _sample_preview: Dictionary = {}
var _sample_hit: Dictionary = {}


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_identity_and_zero_contract()
	_test_full_formula_and_bucket_semantics()
	_test_variance_and_critical_boundaries()
	_test_defense_and_penetration()
	_test_sanitization_and_single_rounding()
	_test_human_readable_breakdown()
	_finish()


func _test_identity_and_zero_contract() -> void:
	var preview: Dictionary = RESOLVER.preview({"base": 100.0})
	_expect(int(preview["formula_version"]) == RESOLVER.FORMULA_VERSION, "preview exposes the formula version")
	_expect(int(preview["minimum_damage"]) == 100, "identity preview minimum preserves base damage")
	_expect(int(preview["expected_damage"]) == 100, "identity preview expectation preserves base damage")
	_expect(int(preview["maximum_damage"]) == 100, "identity preview maximum preserves base damage")
	var hit: Dictionary = RESOLVER.resolve_hit(
		{"base": 100.0},
		{"variance_roll": 0.5, "critical_roll": 0.5}
	)
	_expect(int(hit["damage"]) == 100, "identity hit preserves base damage")
	_expect(not bool(hit["is_critical"]), "zero critical chance cannot crit")
	_expect_close(float(hit["raw_damage"]), 100.0, "identity hit retains full precision")

	var zero_preview: Dictionary = RESOLVER.preview({
		"base": 0.0,
		"action_multiplier": 99.0,
		"unique_multipliers": {"large_bonus": 99.0},
	})
	_expect(int(zero_preview["minimum_damage"]) == 0, "zero offensive input previews as zero")
	_expect(int(zero_preview["expected_damage"]) == 0, "zero offensive input has zero expectation")
	_expect(int(zero_preview["maximum_damage"]) == 0, "zero offensive input cannot be multiplied into damage")
	var zero_hit: Dictionary = RESOLVER.resolve_hit(
		{"base": 0.0},
		{"variance_roll": 1.0, "critical_roll": 0.0}
	)
	_expect(int(zero_hit["damage"]) == 0, "zero offensive input resolves as zero")


func _test_full_formula_and_bucket_semantics() -> void:
	var request := {
		"base": 100.0,
		"flat_modifiers": {"weapon": 20.0, "progression": 10.0},
		"additive_percent_modifiers": {"gear": 20.0, "buff": 10.0},
		"action_multiplier": 1.5,
		"unique_multipliers": {"signature": 1.2, "boss_bonus": 1.1},
		"variance_percent": 20.0,
		"critical_chance_percent": 50.0,
		"critical_multiplier": 2.0,
		"damage_taken_multipliers": {"vulnerable": 1.25, "resistance": 0.8},
		"defense": {
			"rating": 100.0,
			"percent_penetration": 25.0,
			"flat_penetration": 25.0,
			"constant": 100.0,
		},
	}
	var preview: Dictionary = RESOLVER.preview(request)
	_expect(int(preview["minimum_damage"]) == 268, "preview minimum uses low variance and no hidden defense")
	_expect(int(preview["expected_damage"]) == 502, "preview expectation composes crit probability without hidden mitigation")
	_expect(int(preview["maximum_damage"]) == 803, "preview maximum preserves the visible high-damage result")
	_expect_close(float(preview["minimum_raw_damage"]), 267.696, "minimum remains full precision until output")
	_expect_close(float(preview["expected_raw_damage"]), 501.93, "expected damage adds percent sources before named multipliers")
	_expect_close(float(preview["maximum_raw_damage"]), 803.088, "maximum preserves multiplier products")

	var hit: Dictionary = RESOLVER.resolve_hit(
		request,
		{"variance_roll": 0.75, "critical_roll": 0.49}
	)
	_expect(bool(hit["is_critical"]), "explicit critical roll below chance resolves a critical hit")
	_expect_close(float(hit["variance_multiplier"]), 1.1, "variance roll maps linearly across the symmetric range")
	_expect_close(float(hit["effective_defense_rating"]), 0.0, "legacy defense and penetration are ignored by direct damage")
	_expect_close(float(hit["raw_damage"]), 736.164, "resolved hit follows the visible formula without intermediate rounding")
	_expect(int(hit["damage"]) == 736, "resolved hit rounds exactly once at the end")
	_sample_preview = preview
	_sample_hit = hit


func _test_variance_and_critical_boundaries() -> void:
	var capped_request := {
		"base": 100.0,
		"variance_percent": 90.0,
		"critical_chance_percent": 250.0,
		"critical_multiplier": 0.25,
	}
	var low: Dictionary = RESOLVER.resolve_hit(
		capped_request,
		{"variance_roll": -5.0, "critical_roll": 1.0}
	)
	var high: Dictionary = RESOLVER.resolve_hit(
		capped_request,
		{"variance_roll": 5.0, "critical_roll": 1.0}
	)
	_expect_close(float(low["variance_roll"]), 0.0, "negative variance rolls clamp to zero")
	_expect_close(float(high["variance_roll"]), 1.0, "variance rolls above one clamp to one")
	_expect_close(float(low["variance_multiplier"]), 0.75, "variance percent is capped at twenty-five percent")
	_expect_close(float(high["variance_multiplier"]), 1.25, "capped variance remains symmetric")
	_expect(bool(low["is_critical"]) and bool(high["is_critical"]), "one-hundred-percent crit chance includes the roll-one boundary")
	_expect_close(float(low["applied_critical_multiplier"]), 1.0, "critical multiplier cannot fall below one")
	_expect(int(low["damage"]) == 75 and int(high["damage"]) == 125, "variance cap produces deterministic low and high outcomes")

	var never_crit: Dictionary = RESOLVER.resolve_hit(
		{"base": 10.0, "critical_chance_percent": 0.0, "critical_multiplier": 3.0},
		{"variance_roll": 0.5, "critical_roll": 0.0}
	)
	_expect(not bool(never_crit["is_critical"]), "zero critical chance excludes the roll-zero boundary")
	var repeated: Dictionary = RESOLVER.resolve_hit(capped_request, {
		"variance_roll": 0.25,
		"critical_roll": 0.75,
	})
	var repeated_again: Dictionary = RESOLVER.resolve_hit(capped_request, {
		"variance_roll": 0.25,
		"critical_roll": 0.75,
	})
	_expect(repeated == repeated_again, "identical explicit rolls produce identical complete results")


func _test_defense_and_penetration() -> void:
	var baseline: Dictionary = RESOLVER.resolve_hit(
		{"base": 100.0, "defense": {"rating": 100.0}},
		{"variance_roll": 0.5, "critical_roll": 1.0}
	)
	_expect_close(float(baseline["damage_reduction"]), 0.0, "hidden defense produces no reduction")
	_expect(int(baseline["damage"]) == 100, "one hundred displayed damage removes one hundred HP")

	var penetrated: Dictionary = RESOLVER.resolve_hit(
		{
			"base": 100.0,
			"defense": {
				"rating": 100.0,
				"percent_penetration": 50.0,
				"flat_penetration": 10.0,
			},
		},
		{"variance_roll": 0.5, "critical_roll": 1.0}
	)
	_expect_close(float(penetrated["effective_defense_rating"]), 0.0, "penetration has no hidden defensive rating to resolve")
	_expect_close(float(penetrated["damage_reduction"]), 0.0, "direct damage has no invisible reduction stage")
	_expect(int(penetrated["damage"]) == 100, "legacy defense fields cannot shrink damage")

	var over_penetrated: Dictionary = RESOLVER.resolve_hit(
		{
			"base": 100.0,
			"defense": {
				"rating": 50.0,
				"percent_penetration": 200.0,
				"flat_penetration": 500.0,
			},
		},
		{"variance_roll": 0.5, "critical_roll": 1.0}
	)
	_expect_close(float(over_penetrated["effective_defense_rating"]), 0.0, "effective defense cannot become negative")
	_expect(int(over_penetrated["damage"]) == 100, "over-penetration never amplifies damage through negative defense")


func _test_sanitization_and_single_rounding() -> void:
	var malformed: Dictionary = RESOLVER.resolve_hit(
		{
			"base": INF,
			"flat_modifiers": {"negative": -10.0, "not_a_number": NAN},
			"additive_percent_modifiers": {"negative": -50.0, "infinite": INF},
			"action_multiplier": INF,
			"unique_multipliers": {"negative": -2.0, "infinite": INF},
			"variance_percent": NAN,
			"critical_chance_percent": -20.0,
			"critical_multiplier": NAN,
			"damage_taken_multipliers": {"infinite": INF},
			"defense": {
				"rating": -100.0,
				"constant": -1.0,
			},
		},
		{"variance_roll": NAN, "critical_roll": INF}
	)
	_expect(int(malformed["damage"]) == 0, "non-finite and negative additive input cannot create damage")
	_expect(_dictionary_numbers_are_finite(malformed), "resolver output contains no non-finite numeric values")

	var minimum_positive: Dictionary = RESOLVER.resolve_hit(
		{"base": 0.1},
		{"variance_roll": 0.5, "critical_roll": 1.0}
	)
	_expect_close(float(minimum_positive["raw_damage"]), 0.1, "sub-one positive damage remains precise before finalization")
	_expect(int(minimum_positive["damage"]) == 1, "a positive result has a minimum of one damage")

	var single_round: Dictionary = RESOLVER.resolve_hit(
		{"base": 1.4, "action_multiplier": 1.4},
		{"variance_roll": 0.5, "critical_roll": 1.0}
	)
	_expect_close(float(single_round["raw_damage"]), 1.96, "base is not rounded before the action multiplier")
	_expect(int(single_round["damage"]) == 2, "full precision is rounded only after the complete pipeline")


func _test_human_readable_breakdown() -> void:
	var breakdown: Array = _sample_hit.get("breakdown", [])
	var expected_ids := [
		"base",
		"flat",
		"additive_percent",
		"action",
		"unique",
		"variance",
		"critical",
		"damage_taken",
		"final",
	]
	_expect(breakdown.size() == expected_ids.size(), "breakdown exposes every formula bucket and finalization")
	for index: int in range(mini(breakdown.size(), expected_ids.size())):
		var row: Dictionary = breakdown[index]
		_expect(String(row.get("id", "")) == expected_ids[index], "breakdown bucket %d keeps canonical order" % index)
		_expect(not String(row.get("label", "")).is_empty(), "breakdown bucket %d has a human-readable label" % index)
		_expect(not String(row.get("text", "")).is_empty(), "breakdown bucket %d has a human-readable explanation" % index)
	var preview_breakdown: Array = _sample_preview.get("breakdown", [])
	_expect(not preview_breakdown.is_empty(), "preview exposes the same bucket breakdown contract")
	_expect(String(_sample_preview.get("formula", "")).contains("sum(additive_percent)"), "output publishes the invariant formula")


func _dictionary_numbers_are_finite(value: Variant) -> bool:
	if value is float:
		return not is_nan(float(value)) and not is_inf(float(value))
	if value is Dictionary:
		for child: Variant in (value as Dictionary).values():
			if not _dictionary_numbers_are_finite(child):
				return false
	elif value is Array:
		for child: Variant in value:
			if not _dictionary_numbers_are_finite(child):
				return false
	return true


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.6f, got %.6f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error(message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify({
			"ok": _failures.is_empty(),
			"checks": _checks,
			"failures": _failures,
			"sample": {
				"preview": {
					"minimum_damage": _sample_preview.get("minimum_damage", 0),
					"expected_damage": _sample_preview.get("expected_damage", 0),
					"maximum_damage": _sample_preview.get("maximum_damage", 0),
				},
				"resolved_hit": {
					"damage": _sample_hit.get("damage", 0),
					"raw_damage": _sample_hit.get("raw_damage", 0.0),
					"is_critical": _sample_hit.get("is_critical", false),
					"variance_multiplier": _sample_hit.get("variance_multiplier", 0.0),
					"effective_defense_rating": _sample_hit.get("effective_defense_rating", 0.0),
				},
			},
		}, "\t") + "\n")
		report.close()
	print("COMBAT RESOLVER TEST %s - %d checks" % [
		"PASSED" if _failures.is_empty() else "FAILED",
		_checks,
	])
	quit(0 if _failures.is_empty() else 1)
