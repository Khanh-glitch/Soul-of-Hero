class_name EnemyDifficultyScaler
extends RefCounted

## Applies one immutable run's stage/difficulty projection exactly once to any
## current enemy implementation. This adapter supports both exported-property
## enemies and the profile-backed advanced archetypes while they converge on a
## shared data resource model.

const APPLIED_META := &"difficulty_scaling_applied"
const DIFFICULTY_META := &"difficulty_id"
const STAGE_META := &"stage_level"
const MODIFIERS_META := &"difficulty_modifiers"
const DAMAGE_MULTIPLIER_META := &"enemy_damage_multiplier"
const SPEED_MULTIPLIER_META := &"enemy_speed_multiplier"
const PURSUIT_MULTIPLIER_META := &"enemy_pursuit_multiplier"
const EXPERIENCE_REWARD_META := &"experience_reward"
const EXPERIENCE_PROJECTION_META := &"experience_reward_projection"
const EXPERIENCE_POPULATION_CONTEXT_META := &"experience_population_context"
const COMBAT_PROJECTION_REVISION_META := &"enemy_combat_projection_revision"
const EXPERIENCE_FINALIZED_REVISION_META := &"experience_finalized_combat_revision"
const DAMAGE_PROVENANCE_META := &"enemy_authored_damage_provenance"
const CombatResolverScript := preload("res://game/combat/combat_resolver.gd")
const EnemyOutgoingDamageScript := preload("res://game/combat/enemy_outgoing_damage.gd")
const EncounterPackRules := preload("res://game/content/encounters/encounter_pack_rules.gd")
const ProgressionPacingRules := preload(
	"res://game/meta/progression/progression_pacing_rules.gd"
)
const PlayerProgressionRules := preload(
	"res://game/meta/progression/player_progression_rules.gd"
)
const AUTHORED_DAMAGE_SOURCE := "difficulty/stage_projection"
const ELITE_DAMAGE_SOURCE := "elite/combat_stat_projection"
const RUNTIME_DAMAGE_SOURCE := "runtime/difficulty_already_applied"
const CONFIGURED_FALLBACK_SOURCE := "configured/unprovenanced_runtime"
const PROPERTY_CONTACT_DAMAGE_CHANNEL := &"property/contact_damage"
const PROFILE_DAMAGE_CHANNEL := &"profile/damage"
const PROFILE_CONTACT_DAMAGE_CHANNEL := &"profile/contact_damage"
const INPUT_KIND_AUTHORED := &"authored"
const INPUT_KIND_CONFIGURED_AUTHORED := &"configured_authored"
const INPUT_KIND_RUNTIME_PROJECTED := &"runtime_projected"
const TARGET_CONTEXT_METHOD := &"get_incoming_damage_context"
const RESOLVED_DAMAGE_METHOD := &"take_resolved_damage"


static func apply_to(enemy: Node, stage_level: int, difficulty_id: Variant) -> Dictionary:
	if enemy == null:
		return {}
	if bool(enemy.get_meta(APPLIED_META, false)):
		var existing: Variant = enemy.get_meta(MODIFIERS_META, {})
		return (existing as Dictionary).duplicate(true) if existing is Dictionary else {}
	capture_authored_damage_provenance(enemy)

	var modifiers := DifficultyRules.stage_modifiers(stage_level, difficulty_id)
	var health_multiplier := float(modifiers.get("health_multiplier", 1.0))
	var damage_multiplier := float(modifiers.get("damage_multiplier", 1.0))
	var speed_multiplier := float(modifiers.get("speed_multiplier", 1.0))
	var pursuit_multiplier := float(
		EncounterPackRules.get_stage_profile(stage_level).get("pursuit_multiplier", 1.0)
	)
	modifiers["pursuit_multiplier"] = pursuit_multiplier
	var mutant := bool(enemy.get_meta(&"mutant", false))
	if mutant:
		health_multiplier *= 1.40
		damage_multiplier *= 1.25
		speed_multiplier *= 1.08
		modifiers["mutant"] = true
		modifiers["mutant_health_multiplier"] = 1.40
		modifiers["mutant_damage_multiplier"] = 1.25
		modifiers["mutant_speed_multiplier"] = 1.08
	# HP and damage use one shared presentation scale across Heroes, enemies and
	# breakables. Difficulty/reward math deliberately keeps the semantic stage
	# multipliers so larger combat numbers do not inflate XP or score.
	var reward_health_multiplier := health_multiplier
	var reward_damage_multiplier := damage_multiplier
	var combat_number_scale := maxf(1.0, PlayerProgressionRules.COMBAT_NUMBER_SCALE)
	health_multiplier *= combat_number_scale
	damage_multiplier *= combat_number_scale
	modifiers["combat_number_scale"] = combat_number_scale
	modifiers["runtime_health_multiplier"] = health_multiplier
	modifiers["runtime_damage_multiplier"] = damage_multiplier
	var property_names := _property_names(enemy)
	var profile_scaled := false

	if enemy.has_method(&"get_combat_profile") and enemy.has_method(&"set_combat_profile"):
		var profile_value: Variant = enemy.call(&"get_combat_profile")
		if profile_value is Dictionary:
			var profile := (profile_value as Dictionary).duplicate(true)
			_scale_profile(
				profile,
				health_multiplier,
				damage_multiplier,
				speed_multiplier,
				pursuit_multiplier,
			)
			enemy.call(&"set_combat_profile", profile)
			profile_scaled = true

	if not profile_scaled:
		_scale_property(enemy, property_names, &"max_health", health_multiplier, true)
		_scale_property(enemy, property_names, &"contact_damage", damage_multiplier, true)
		for speed_property: StringName in [&"patrol_speed", &"chase_speed"]:
			_scale_property(enemy, property_names, speed_property, speed_multiplier, false)
		for pursuit_property: StringName in [&"detection_range", &"disengage_range"]:
			_scale_property(enemy, property_names, pursuit_property, pursuit_multiplier, false)

	# Direct-damage bosses consume this metadata at their attack sites. Profile
	# enemies already had every damage entry scaled above.
	enemy.set_meta(DAMAGE_MULTIPLIER_META, damage_multiplier)
	enemy.set_meta(SPEED_MULTIPLIER_META, speed_multiplier)
	enemy.set_meta(PURSUIT_MULTIPLIER_META, pursuit_multiplier)
	if property_names.has(&"health") and property_names.has(&"max_health"):
		enemy.set(&"health", enemy.get(&"max_health"))

	var reward_multiplier := sqrt(maxf(
		1.0,
		reward_health_multiplier * reward_damage_multiplier,
	)) \
		* (1.60 if mutant else 1.0)
	_scale_property(enemy, property_names, &"score_reward", reward_multiplier, true)
	enemy.set_meta(APPLIED_META, true)
	enemy.set_meta(DIFFICULTY_META, String(DifficultyRules.normalize_id(difficulty_id)))
	enemy.set_meta(STAGE_META, clampi(stage_level, 1, 100))
	enemy.set_meta(MODIFIERS_META, modifiers.duplicate(true))
	mark_combat_projection_changed(enemy, &"stage_difficulty")
	var experience_projection := finalize_experience_reward(enemy)
	modifiers["experience_reward_units"] = float(experience_projection.get("reward_units", 0.0))
	modifiers["experience_threat_weight"] = float(experience_projection.get("threat_weight", 0.0))
	modifiers["experience_projection_valid"] = bool(experience_projection.get("valid", false))
	modifiers["experience_population_plan_signature"] = String(
		experience_projection.get("population_plan_signature", "")
	)
	enemy.set_meta(MODIFIERS_META, modifiers.duplicate(true))
	if mutant:
		enemy.add_to_group(&"mutant_enemies")
		enemy.add_to_group(&"elite_enemies")
		var sprite := enemy.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
		if sprite != null:
			sprite.self_modulate = Color(0.92, 0.64, 1.0, 1.0)
	return modifiers


## Every combat projection that can change risk or score increments this
## revision. Kill XP is payable only when its reward metadata was finalized
## against the same revision and the same realized encounter plan.
static func mark_combat_projection_changed(
	enemy: Node,
	source: StringName = &"runtime_modifier",
) -> int:
	if enemy == null:
		return 0
	var revision := int(enemy.get_meta(COMBAT_PROJECTION_REVISION_META, 0)) + 1
	enemy.set_meta(COMBAT_PROJECTION_REVISION_META, revision)
	enemy.set_meta(&"enemy_last_combat_projection_source", source)
	return revision


static func finalize_experience_reward(
	enemy: Node,
	population_context: Dictionary = {},
) -> Dictionary:
	if enemy == null:
		return {
			"valid": false,
			"error": "Cannot finalize XP for a null enemy.",
			"reward_units": 0.0,
		}
	if not population_context.is_empty():
		enemy.set_meta(
			EXPERIENCE_POPULATION_CONTEXT_META,
			population_context.duplicate(true),
		)
	var raw_context: Variant = enemy.get_meta(EXPERIENCE_POPULATION_CONTEXT_META, {})
	var context: Dictionary = (
		(raw_context as Dictionary).duplicate(true)
		if raw_context is Dictionary
		else {}
	)
	var stage_level := int(enemy.get_meta(STAGE_META, 0))
	var final_score_projection := _final_score_projection(enemy)
	var is_boss := _is_boss(enemy)
	var raw_axes: Variant = enemy.get_meta(&"elite_combat_axes", {})
	var elite_axes: Dictionary = (
		(raw_axes as Dictionary).duplicate(true)
		if raw_axes is Dictionary
		else {}
	)
	var reward_score_scale := maxf(1.0, float(elite_axes.get("reward_score", 1.0)))
	var projection := ProgressionPacingRules.project_enemy_reward(
		float(final_score_projection.get("score", 0.0)),
		stage_level,
		is_boss,
		context,
		reward_score_scale,
	)
	var combat_revision := int(enemy.get_meta(COMBAT_PROJECTION_REVISION_META, 0))
	projection["finalized"] = bool(projection.get("valid", false))
	projection["combat_projection_revision"] = combat_revision
	projection["final_score"] = float(final_score_projection.get("score", 0.0))
	projection["final_score_source"] = String(final_score_projection.get("source", ""))
	projection["elite_modifier_id"] = String(enemy.get_meta(&"elite_modifier_id", ""))
	projection["elite_combat_axes"] = elite_axes.duplicate(true)
	var valid := bool(projection.get("valid", false)) and combat_revision > 0
	if not valid and bool(projection.get("valid", false)):
		projection["valid"] = false
		projection["finalized"] = false
		projection["error"] = "XP cannot finalize before the combat projection exists."
	var reward_units := float(projection.get("reward_units", 0.0)) if valid else 0.0
	projection["reward_units"] = reward_units
	enemy.set_meta(EXPERIENCE_REWARD_META, reward_units)
	enemy.set_meta(EXPERIENCE_PROJECTION_META, projection.duplicate(true))
	enemy.set_meta(
		EXPERIENCE_FINALIZED_REVISION_META,
		combat_revision if valid else -1,
	)
	return projection


static func is_experience_reward_current(enemy: Node) -> bool:
	if enemy == null:
		return false
	var combat_revision := int(enemy.get_meta(COMBAT_PROJECTION_REVISION_META, 0))
	var finalized_revision := int(enemy.get_meta(EXPERIENCE_FINALIZED_REVISION_META, -1))
	var raw_projection: Variant = enemy.get_meta(EXPERIENCE_PROJECTION_META, {})
	return (
		combat_revision > 0
		and finalized_revision == combat_revision
		and raw_projection is Dictionary
		and bool((raw_projection as Dictionary).get("valid", false))
		and bool((raw_projection as Dictionary).get("finalized", false))
	)


static func _final_score_projection(enemy: Node) -> Dictionary:
	var property_names := _property_names(enemy)
	if property_names.has(&"score_reward"):
		var score_value: Variant = enemy.get(&"score_reward")
		if score_value is int or score_value is float:
			var score := maxf(0.0, float(score_value))
			if score > 0.0:
				return {"score": score, "source": "runtime_score_reward"}
	if property_names.has(&"max_health"):
		var health_value: Variant = enemy.get(&"max_health")
		if health_value is int or health_value is float:
			return {
				"score": maxi(100, roundi(maxf(0.0, float(health_value)) * 0.5)),
				"source": "runtime_max_health_fallback",
			}
	return {"score": 0.0, "source": "missing_runtime_score"}


static func scale_direct_damage(enemy: Node, authored_damage: int) -> int:
	return int(project_authored_damage(enemy, authored_damage).get("damage", 0))


## Captures configured damage before any integer telemetry projection. The data
## is keyed by semantic field path rather than enemy identity, so current and
## future controllers can share the same authored-hit request path.
static func capture_authored_damage_provenance(enemy: Node) -> Dictionary:
	if enemy == null:
		return {}
	var raw_existing: Variant = enemy.get_meta(DAMAGE_PROVENANCE_META, {})
	var provenance: Dictionary = (
		(raw_existing as Dictionary).duplicate(true)
		if raw_existing is Dictionary
		else {}
	)
	if enemy.has_method(&"get_combat_profile"):
		var raw_profile: Variant = enemy.call(&"get_combat_profile")
		if raw_profile is Dictionary:
			_capture_damage_entry(
				provenance,
				PROFILE_DAMAGE_CHANNEL,
				(raw_profile as Dictionary).get("damage", null),
				&"combat_profile",
			)
			_capture_damage_entry(
				provenance,
				PROFILE_CONTACT_DAMAGE_CHANNEL,
				(raw_profile as Dictionary).get("contact_damage", null),
				&"combat_profile",
			)
	var property_names := _property_names(enemy)
	if property_names.has(&"contact_damage"):
		_capture_damage_entry(
			provenance,
			PROPERTY_CONTACT_DAMAGE_CHANNEL,
			enemy.get(&"contact_damage"),
			&"exported_property",
		)
	if not provenance.is_empty():
		enemy.set_meta(DAMAGE_PROVENANCE_META, provenance.duplicate(true))
	return provenance.duplicate(true)


static func get_authored_damage_provenance(enemy: Node) -> Dictionary:
	if enemy == null:
		return {}
	var raw: Variant = enemy.get_meta(DAMAGE_PROVENANCE_META, {})
	return (raw as Dictionary).duplicate(true) if raw is Dictionary else {}


## Authored damage has not received stage/difficulty yet. The named difficulty
## multiplier enters the canonical request and is rounded only by CombatResolver.
static func build_authored_damage_request(
		enemy: Node,
		authored_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	var difficulty_multiplier: Variant = 1.0
	if enemy != null:
		difficulty_multiplier = enemy.get_meta(DAMAGE_MULTIPLIER_META, 1.0)
	var request := EnemyOutgoingDamageScript.build_request(
		authored_damage,
		_authored_source_multipliers(enemy, difficulty_multiplier),
		options,
	)
	request["damage_input_kind"] = INPUT_KIND_AUTHORED
	request["source_enemy_instance_id"] = enemy.get_instance_id() \
		if is_instance_valid(enemy) else 0
	return request


## Configured profile/property damage keeps its authored base in provenance even
## though the public integer is still projected for telemetry compatibility.
## Difficulty, Elite and target context therefore remain full precision until
## CombatResolver's single final round.
static func build_configured_damage_request(
		enemy: Node,
		damage_channel: StringName,
		configured_runtime_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	var provenance := get_authored_damage_provenance(enemy)
	var raw_entry: Variant = provenance.get(String(damage_channel), {})
	var has_authored_base := (
		raw_entry is Dictionary
		and ((raw_entry as Dictionary).get("base", null) is int
			or (raw_entry as Dictionary).get("base", null) is float)
	)
	var request: Dictionary
	if has_authored_base:
		var difficulty_multiplier: Variant = (
			enemy.get_meta(DAMAGE_MULTIPLIER_META, 1.0)
			if enemy != null
			else 1.0
		)
		request = EnemyOutgoingDamageScript.build_request(
			(raw_entry as Dictionary).get("base", 0.0),
			_authored_source_multipliers(enemy, difficulty_multiplier),
			options,
		)
		request["damage_input_kind"] = INPUT_KIND_CONFIGURED_AUTHORED
		request["damage_provenance"] = (raw_entry as Dictionary).duplicate(true)
	else:
		request = EnemyOutgoingDamageScript.build_request(
			configured_runtime_damage,
			{CONFIGURED_FALLBACK_SOURCE: 1.0},
			options,
		)
		request["damage_input_kind"] = &"configured_runtime_fallback"
		request["damage_provenance"] = {}
	request["damage_channel"] = damage_channel
	request["configured_runtime_damage"] = configured_runtime_damage
	request["source_enemy_instance_id"] = enemy.get_instance_id() \
		if is_instance_valid(enemy) else 0
	return request


## Escape hatch for callers that genuinely own a final-ish runtime number. All
## built-in property/profile attacks use the configured-authored path above, and
## built-in projectiles carry authored/configured provenance to impact instead.
static func build_runtime_damage_request(
		enemy: Node,
		runtime_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	var request := EnemyOutgoingDamageScript.build_request(
		runtime_damage,
		{RUNTIME_DAMAGE_SOURCE: 1.0},
		options,
	)
	request["damage_input_kind"] = INPUT_KIND_RUNTIME_PROJECTED
	request["source_enemy_instance_id"] = enemy.get_instance_id() \
		if is_instance_valid(enemy) else 0
	return request


static func project_authored_damage(
		enemy: Node,
		authored_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	return _project_request(build_authored_damage_request(enemy, authored_damage, options))


static func project_runtime_damage(
		enemy: Node,
		runtime_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	return _project_request(build_runtime_damage_request(enemy, runtime_damage, options))


static func project_configured_damage(
		enemy: Node,
		damage_channel: StringName,
		configured_runtime_damage: Variant,
		options: Dictionary = {},
) -> Dictionary:
	return _project_request(build_configured_damage_request(
		enemy,
		damage_channel,
		configured_runtime_damage,
		options,
	))


static func resolve_authored_damage(
		enemy: Node,
		authored_damage: Variant,
		rolls: Dictionary,
		options: Dictionary = {},
) -> Dictionary:
	return _resolve_request(
		build_authored_damage_request(enemy, authored_damage, options),
		rolls,
	)


static func resolve_runtime_damage(
		enemy: Node,
		runtime_damage: Variant,
		rolls: Dictionary,
		options: Dictionary = {},
) -> Dictionary:
	return _resolve_request(
		build_runtime_damage_request(enemy, runtime_damage, options),
		rolls,
	)


## Applies the previewed expectation used by today's deterministic enemy hits.
## `options` is the future-facing target/context seam (defense, penetration,
## named multipliers, variance/crit configuration). Empty options preserve every
## existing authored damage number exactly.
static func apply_authored_damage_hit(
		enemy: Node,
		target: Node,
		authored_damage: Variant,
		source_position: Vector2 = Vector2.ZERO,
		options: Dictionary = {},
) -> Dictionary:
	var target_binding := _prepare_target_binding(target, options)
	return _apply_projection(
		target,
		source_position,
		project_authored_damage(
			enemy,
			authored_damage,
			target_binding.get("options", options),
		),
		target_binding,
	)


static func apply_runtime_damage_hit(
		enemy: Node,
		target: Node,
		runtime_damage: Variant,
		source_position: Vector2 = Vector2.ZERO,
		options: Dictionary = {},
) -> Dictionary:
	var target_binding := _prepare_target_binding(target, options)
	return _apply_projection(
		target,
		source_position,
		project_runtime_damage(
			enemy,
			runtime_damage,
			target_binding.get("options", options),
		),
		target_binding,
	)


static func apply_configured_damage_hit(
		enemy: Node,
		target: Node,
		damage_channel: StringName,
		configured_runtime_damage: Variant,
		source_position: Vector2 = Vector2.ZERO,
		options: Dictionary = {},
) -> Dictionary:
	var target_binding := _prepare_target_binding(target, options)
	return _apply_projection(
		target,
		source_position,
		project_configured_damage(
			enemy,
			damage_channel,
			configured_runtime_damage,
			target_binding.get("options", options),
		),
		target_binding,
	)


static func _project_request(request: Dictionary) -> Dictionary:
	var preview := CombatResolverScript.preview(request)
	return {
		"request": request,
		"preview": preview,
		"damage": int(preview.get("expected_damage", 0)),
	}


static func _resolve_request(request: Dictionary, rolls: Dictionary) -> Dictionary:
	var hit := CombatResolverScript.resolve_hit(request, rolls)
	return {
		"request": request,
		"hit": hit,
		"damage": int(hit.get("damage", 0)),
	}


static func _apply_projection(
		target: Node,
		source_position: Vector2,
		projection: Dictionary,
		target_binding: Dictionary = {},
) -> Dictionary:
	var result := projection.duplicate(true)
	var use_resolved_seam := bool(target_binding.get("canonical", false))
	var damage_method := RESOLVED_DAMAGE_METHOD if use_resolved_seam else &"take_damage"
	result["target_valid"] = is_instance_valid(target) and target.has_method(damage_method)
	result["applied"] = false
	result["confirmed"] = false
	result["used_canonical_target_seam"] = use_resolved_seam
	result["applied_damage_method"] = damage_method
	result["target_context"] = (
		(target_binding.get("target_context", {}) as Dictionary).duplicate(true)
		if target_binding.get("target_context", {}) is Dictionary
		else {}
	)
	if not bool(result["target_valid"]):
		return result
	var call_result: Variant
	if use_resolved_seam:
		call_result = target.call(
			RESOLVED_DAMAGE_METHOD,
			int(result.get("damage", 0)),
			source_position,
			{
				"request": (result.get("request", {}) as Dictionary).duplicate(true),
				"preview": (result.get("preview", {}) as Dictionary).duplicate(true),
				"target_context": (result["target_context"] as Dictionary).duplicate(true),
			},
		)
	else:
		call_result = target.call(
			&"take_damage",
			int(result.get("damage", 0)),
			source_position,
		)
	result["applied"] = true
	result["confirmed"] = bool(call_result)
	return result


## Target context is consumed only when the target also exposes the matching
## resolved-damage receiver. A partial/legacy target stays entirely on its local
## `take_damage` mitigation path, so the same reduction cannot run twice.
static func _prepare_target_binding(target: Node, source_options: Dictionary) -> Dictionary:
	var binding := {
		"canonical": false,
		"options": source_options.duplicate(true),
		"target_context": {},
	}
	if (
		not is_instance_valid(target)
		or not target.has_method(TARGET_CONTEXT_METHOD)
		or not target.has_method(RESOLVED_DAMAGE_METHOD)
	):
		return binding
	var raw_context: Variant = target.call(TARGET_CONTEXT_METHOD)
	var target_context: Dictionary = (
		(raw_context as Dictionary).duplicate(true)
		if raw_context is Dictionary
		else {}
	)
	binding["canonical"] = true
	binding["target_context"] = target_context
	binding["options"] = _merge_damage_options(source_options, target_context)
	return binding


static func _merge_damage_options(
		source_options: Dictionary,
		target_options: Dictionary,
) -> Dictionary:
	var merged := source_options.duplicate(true)
	for bucket_name: String in [
		"flat_modifiers",
		"additive_percent_modifiers",
		"unique_multipliers",
		"damage_taken_multipliers",
		"context_modifiers",
	]:
		var combined := {}
		var source_bucket: Variant = source_options.get(bucket_name, {})
		if source_bucket is Dictionary:
			combined.merge((source_bucket as Dictionary).duplicate(true), true)
		var target_bucket: Variant = target_options.get(bucket_name, {})
		if target_bucket is Dictionary:
			combined.merge((target_bucket as Dictionary).duplicate(true), true)
		if not combined.is_empty():
			merged[bucket_name] = combined

	var combined_defense := {}
	var source_defense: Variant = source_options.get("defense", {})
	if source_defense is Dictionary:
		combined_defense.merge((source_defense as Dictionary).duplicate(true), true)
	var target_defense: Variant = target_options.get("defense", {})
	if target_defense is Dictionary:
		combined_defense.merge((target_defense as Dictionary).duplicate(true), true)
	if not combined_defense.is_empty():
		merged["defense"] = combined_defense
	return merged


static func _authored_source_multipliers(
		enemy: Node,
		difficulty_multiplier: Variant,
) -> Dictionary:
	var elite_multiplier: Variant = 1.0
	if enemy != null:
		var raw_axes: Variant = enemy.get_meta(&"elite_combat_axes", {})
		if raw_axes is Dictionary:
			elite_multiplier = float((raw_axes as Dictionary).get("damage", 1.0))
	return {
		AUTHORED_DAMAGE_SOURCE: difficulty_multiplier,
		ELITE_DAMAGE_SOURCE: elite_multiplier,
	}


static func _capture_damage_entry(
		provenance: Dictionary,
		channel: StringName,
		value: Variant,
		origin: StringName,
) -> void:
	var channel_key := String(channel)
	if provenance.has(channel_key) or not (value is int or value is float):
		return
	provenance[channel_key] = {
		"base": value,
		"channel": channel,
		"origin": origin,
	}


static func _scale_profile(
		profile: Dictionary,
		health_multiplier: float,
		damage_multiplier: float,
		speed_multiplier: float,
		pursuit_multiplier: float,
) -> void:
	if profile.has("max_health"):
		profile["max_health"] = maxi(1, roundi(float(profile["max_health"]) * health_multiplier))
	for key: String in ["damage", "contact_damage"]:
		if profile.has(key):
			profile[key] = maxi(1, roundi(float(profile[key]) * damage_multiplier))
	for key: String in ["patrol_speed", "chase_speed", "strike_speed"]:
		if profile.has(key):
			profile[key] = maxf(1.0, float(profile[key]) * speed_multiplier)
	for key: String in ["detection", "disengage"]:
		if profile.has(key):
			profile[key] = maxf(1.0, float(profile[key]) * pursuit_multiplier)


static func _scale_property(
		enemy: Object,
		property_names: Dictionary,
		property_name: StringName,
		multiplier: float,
		as_integer: bool,
) -> void:
	if not property_names.has(property_name):
		return
	var current: Variant = enemy.get(property_name)
	if not current is int and not current is float:
		return
	var scaled := float(current) * multiplier
	enemy.set(property_name, maxi(0, roundi(scaled)) if as_integer else maxf(0.0, scaled))


static func _property_names(object: Object) -> Dictionary:
	var names := {}
	for property: Dictionary in object.get_property_list():
		names[StringName(property.get("name", &""))] = true
	return names


static func _is_boss(enemy: Node) -> bool:
	if enemy == null:
		return false
	if bool(enemy.get_meta(&"is_boss_enemy", false)):
		return true
	if enemy.has_method(&"is_boss_enemy") and bool(enemy.call(&"is_boss_enemy")):
		return true
	var raw_tags: Variant = enemy.get_meta(&"enemy_role_tags", PackedStringArray())
	var tags: Array[String] = []
	if raw_tags is PackedStringArray:
		for tag: String in raw_tags:
			tags.append(tag)
	elif raw_tags is Array:
		for raw_tag: Variant in raw_tags:
			tags.append(String(raw_tag))
	for boss_tag: String in ["boss", "miniboss"]:
		if tags.has(boss_tag):
			return true
	for boss_group: StringName in [&"boss_enemies", &"bosses", &"boss", &"minibosses"]:
		if enemy.is_in_group(boss_group):
			return true
	return false
