class_name EnemyOutgoingDamage
extends RefCounted

## Data-only adapter from enemy attack context to the canonical CombatResolver
## request. Enemy controllers supply authored/runtime damage plus named context;
## this class owns no scene-tree state and contains no enemy-id branches.

const CombatResolverScript := preload("res://game/combat/combat_resolver.gd")

const REQUEST_KIND := &"enemy_outgoing_hit"
const CONTEXT_PREFIX := "context/"
const FALLBACK_SOURCE := "source/enemy_runtime_damage"


## Builds the same request shape used by every other damage projection.
##
## `source_multipliers` describes how the input entered the runtime (for example
## a stage/difficulty projection or an already-projected profile value). Options
## may use the regular named CombatResolver buckets, or `context_modifiers`:
## {
##   "enraged": {"bucket": "unique_multipliers", "value": 1.25},
##   "warded": {"bucket": "damage_taken_multipliers", "value": 0.80},
## }
## Unknown structured buckets are ignored and reported on the request instead of
## changing damage. This lets new data fail closed until its operation is wired.
static func build_request(
		base_damage: Variant,
		source_multipliers: Dictionary = {},
		options: Dictionary = {},
) -> Dictionary:
	var buckets := {
		"flat_modifiers": _prefixed_bucket(options.get("flat_modifiers", {})),
		"additive_percent_modifiers": _prefixed_bucket(
			options.get("additive_percent_modifiers", {})
		),
		"unique_multipliers": source_multipliers.duplicate(true),
		"damage_taken_multipliers": _prefixed_bucket(
			options.get("damage_taken_multipliers", {})
		),
	}
	if (buckets["unique_multipliers"] as Dictionary).is_empty():
		(buckets["unique_multipliers"] as Dictionary)[FALLBACK_SOURCE] = 1.0

	var option_unique: Dictionary = _prefixed_bucket(options.get("unique_multipliers", {}))
	for source_name: Variant in option_unique.keys():
		(buckets["unique_multipliers"] as Dictionary)[source_name] = option_unique[source_name]

	var ignored_context_modifiers: Array[String] = []
	_merge_structured_context(
		buckets,
		options.get("context_modifiers", {}),
		ignored_context_modifiers,
	)

	var defense: Dictionary = {}
	var raw_defense: Variant = options.get("defense", {})
	if raw_defense is Dictionary:
		defense = (raw_defense as Dictionary).duplicate(true)

	return {
		"request_kind": REQUEST_KIND,
		"base": base_damage,
		"flat_modifiers": buckets["flat_modifiers"],
		"additive_percent_modifiers": buckets["additive_percent_modifiers"],
		"action_multiplier": options.get("action_multiplier", 1.0),
		"unique_multipliers": buckets["unique_multipliers"],
		"variance_percent": options.get("variance_percent", 0.0),
		"critical_chance_percent": options.get("critical_chance_percent", 0.0),
		"critical_multiplier": options.get("critical_multiplier", 1.0),
		"damage_taken_multipliers": buckets["damage_taken_multipliers"],
		"defense": defense,
		"ignored_context_modifiers": ignored_context_modifiers,
	}


## Returns the request and its deterministic min/expected/max preview together,
## so a runtime hit and an audit surface cannot accidentally use different math.
static func project(
		base_damage: Variant,
		source_multipliers: Dictionary = {},
		options: Dictionary = {},
) -> Dictionary:
	var request := build_request(base_damage, source_multipliers, options)
	var preview := CombatResolverScript.preview(request)
	return {
		"request": request,
		"preview": preview,
		"damage": int(preview.get("expected_damage", 0)),
	}


## Deterministic resolution seam for future variance/critical enemy attacks.
## Runtime RNG remains caller-owned, matching CombatResolver's pure contract.
static func resolve(
		base_damage: Variant,
		rolls: Dictionary,
		source_multipliers: Dictionary = {},
		options: Dictionary = {},
) -> Dictionary:
	var request := build_request(base_damage, source_multipliers, options)
	var hit := CombatResolverScript.resolve_hit(request, rolls)
	return {
		"request": request,
		"hit": hit,
		"damage": int(hit.get("damage", 0)),
	}


static func _prefixed_bucket(raw_bucket: Variant) -> Dictionary:
	var result := {}
	if not raw_bucket is Dictionary:
		return result
	for raw_name: Variant in (raw_bucket as Dictionary).keys():
		result["%s%s" % [CONTEXT_PREFIX, String(raw_name)]] = (raw_bucket as Dictionary)[raw_name]
	return result


static func _merge_structured_context(
		buckets: Dictionary,
		raw_modifiers: Variant,
		ignored: Array[String],
) -> void:
	if not raw_modifiers is Dictionary:
		if raw_modifiers != null:
			ignored.append("context_modifiers")
		return
	var names: Array = (raw_modifiers as Dictionary).keys()
	names.sort_custom(func(left: Variant, right: Variant) -> bool: return String(left) < String(right))
	for raw_name: Variant in names:
		var source_name := "%s%s" % [CONTEXT_PREFIX, String(raw_name)]
		var raw_spec: Variant = (raw_modifiers as Dictionary)[raw_name]
		if not raw_spec is Dictionary:
			ignored.append(source_name)
			continue
		var spec := raw_spec as Dictionary
		var bucket_name := _canonical_bucket_name(spec.get("bucket", ""))
		if bucket_name.is_empty() or not buckets.has(bucket_name):
			ignored.append(source_name)
			continue
		(buckets[bucket_name] as Dictionary)[source_name] = spec.get("value", null)


static func _canonical_bucket_name(raw_bucket: Variant) -> String:
	match String(raw_bucket):
		"flat", "flat_modifiers":
			return "flat_modifiers"
		"additive_percent", "additive_percent_modifiers":
			return "additive_percent_modifiers"
		"unique", "unique_multipliers":
			return "unique_multipliers"
		"damage_taken", "damage_taken_multipliers":
			return "damage_taken_multipliers"
		_:
			return ""
