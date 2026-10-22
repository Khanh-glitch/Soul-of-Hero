extends SceneTree

const OUTGOING := preload("res://game/combat/enemy_outgoing_damage.gd")
const SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const SPECTRAL_DISC_SCENE: PackedScene = preload("res://game/characters/enemies/spectral_disc.tscn")
const ARCHER_ARROW_SCENE: PackedScene = preload("res://game/characters/enemies/archer_enemy_arrow.tscn")
const HOODED_ARCHER_DEFINITION: EnemyDefinition = preload("res://data/content/enemies/hooded_archer_miniboss.tres")
const REAPER_CAPTAIN_DEFINITION: EnemyDefinition = preload("res://data/content/enemies/bone_reaper_captain.tres")
const CRIMSON_REAPER_DEFINITION: EnemyDefinition = preload("res://data/content/enemies/crimson_reaper.tres")
const CASTELLAN_DEFINITION: EnemyDefinition = preload("res://data/content/enemies/vampire_castellan.tres")
const REPORT_PATH := "res://.artifacts/enemy_outgoing_damage_report.json"


class FakeDamageTarget extends Node2D:
	var received_damage := -1
	var received_source_position := Vector2.ZERO

	func take_damage(amount: int, source_position := Vector2.ZERO) -> bool:
		received_damage = amount
		received_source_position = source_position
		return amount > 0


class FakeCanonicalTarget extends Node2D:
	var received_damage := -1
	var legacy_calls := 0
	var resolved_calls := 0
	var resolution_context: Dictionary = {}

	func get_incoming_damage_context() -> Dictionary:
		return {}

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		legacy_calls += 1
		received_damage = amount
		return true

	func take_resolved_damage(
			amount: int,
			_source_position := Vector2.ZERO,
			context: Dictionary = {},
	) -> bool:
		resolved_calls += 1
		received_damage = amount
		resolution_context = context.duplicate(true)
		return amount > 0


class FakePartialTarget extends Node2D:
	var received_damage := -1

	func get_incoming_damage_context() -> Dictionary:
		return {"damage_taken_multipliers": {"target/must_not_apply": 0.10}}

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		received_damage = amount
		return true


class FakeConfiguredEnemy extends Node2D:
	var contact_damage := 13
	var _profile := {"damage": 13, "max_health": 100}

	func get_combat_profile() -> Dictionary:
		return _profile.duplicate(true)

	func set_combat_profile(profile: Dictionary) -> bool:
		_profile = profile.duplicate(true)
		return true


class FakeTaggedEnemy extends Node2D:
	var max_health := 100
	var health := 100
	var contact_damage := 13
	var patrol_speed := 30.0
	var chase_speed := 50.0
	var detection_range := 150.0
	var disengage_range := 220.0
	var score_reward := 300


var _checks := 0
var _failures: Array[String] = []
var _sample_projection: Dictionary = {}


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_current_damage_parity_and_no_double_scale()
	_test_named_context_and_breakdown()
	_test_target_defense_and_penetration()
	_test_unknown_modifier_fails_safe()
	_test_scaler_and_live_application_share_request()
	_test_canonical_target_single_round_and_legacy_fallback()
	_test_configured_provenance_single_round_across_current_paths()
	_test_generic_boss_contract()
	_finish()


func _test_current_damage_parity_and_no_double_scale() -> void:
	var enemy := Node.new()
	enemy.set_meta(SCALER.DAMAGE_MULTIPLIER_META, 1.35)
	var authored := SCALER.project_authored_damage(enemy, 14)
	_expect(int(authored.get("damage", 0)) == 19, "authored direct damage preserves round(14 * 1.35)")
	_expect(
		SCALER.scale_direct_damage(enemy, 14) == int(authored.get("damage", 0)),
		"legacy direct scaler delegates to the same canonical projection",
	)
	var authored_request: Dictionary = authored.get("request", {})
	var authored_sources: Dictionary = authored_request.get("unique_multipliers", {})
	_expect_close(
		float(authored_sources.get(SCALER.AUTHORED_DAMAGE_SOURCE, 0.0)),
		1.35,
		"difficulty is a named source on authored requests",
	)

	var runtime := SCALER.project_runtime_damage(enemy, 19)
	_expect(int(runtime.get("damage", 0)) == 19, "runtime-projected damage is not difficulty-scaled twice")
	var runtime_request: Dictionary = runtime.get("request", {})
	var runtime_sources: Dictionary = runtime_request.get("unique_multipliers", {})
	_expect_close(
		float(runtime_sources.get(SCALER.RUNTIME_DAMAGE_SOURCE, 0.0)),
		1.0,
		"runtime requests name their already-projected identity source",
	)
	_expect(int(SCALER.project_runtime_damage(enemy, 0).get("damage", -1)) == 0, "zero runtime damage remains zero")
	enemy.free()


func _test_named_context_and_breakdown() -> void:
	var projection := OUTGOING.project(
		20,
		{"difficulty/stage_projection": 1.5},
		{
			"context_modifiers": {
				"temporary_edge": {"bucket": "flat", "value": 5.0},
				"enraged_window": {"bucket": "unique", "value": 1.2},
			},
		},
	)
	_expect(int(projection.get("damage", 0)) == 45, "named context buckets compose through the canonical formula")
	var request: Dictionary = projection.get("request", {})
	var flat: Dictionary = request.get("flat_modifiers", {})
	var unique: Dictionary = request.get("unique_multipliers", {})
	_expect_close(float(flat.get("context/temporary_edge", 0.0)), 5.0, "flat context keeps a named request source")
	_expect_close(float(unique.get("context/enraged_window", 0.0)), 1.2, "unique context keeps a named request source")
	var preview: Dictionary = projection.get("preview", {})
	var breakdown: Array = preview.get("breakdown", [])
	_expect(breakdown.size() == 9, "enemy preview exposes the full direct-damage breakdown")
	_expect(_breakdown_has_source(breakdown, "difficulty/stage_projection"), "breakdown identifies the difficulty source")
	_expect(_breakdown_has_source(breakdown, "context/enraged_window"), "breakdown identifies the context source")


func _test_target_defense_and_penetration() -> void:
	var enemy := Node.new()
	var options := {
		"defense": {
			"rating": 100.0,
			"percent_penetration": 50.0,
			"flat_penetration": 10.0,
		},
	}
	var projection := SCALER.project_runtime_damage(enemy, 100, options)
	_expect(int(projection.get("damage", 0)) == 100, "hidden target defense and penetration cannot shrink displayed damage")
	var preview: Dictionary = projection.get("preview", {})
	var defense: Dictionary = preview.get("defense", {})
	_expect_close(float(defense.get("effective_rating", -1.0)), 0.0, "hidden defense resolves to zero effective rating")
	_expect(bool(defense.get("ignored_hidden_defense", false)), "preview explicitly reports ignored hidden defense")
	var resolved := SCALER.resolve_runtime_damage(
		enemy,
		100,
		{"variance_roll": 0.5, "critical_roll": 1.0},
		options,
	)
	var hit: Dictionary = resolved.get("hit", {})
	_expect(int(hit.get("damage", 0)) == 100, "resolved enemy hit preserves direct visible damage")
	_expect_close(float(hit.get("effective_defense_rating", -1.0)), 0.0, "resolved hit reports zero effective hidden defense")
	enemy.free()


func _test_unknown_modifier_fails_safe() -> void:
	var projection := OUTGOING.project(
		40,
		{"runtime/difficulty_already_applied": 1.0},
		{
			"unique_multipliers": {"malformed_future_modifier": "not-a-number"},
			"context_modifiers": {
				"unknown_operation": {"bucket": "replace_final_damage", "value": 9999.0},
				"malformed_spec": 9999.0,
			},
		},
	)
	_expect(int(projection.get("damage", 0)) == 40, "unknown or malformed modifiers fail to identity instead of changing damage")
	var request: Dictionary = projection.get("request", {})
	var ignored: Array = request.get("ignored_context_modifiers", [])
	_expect(ignored.has("context/unknown_operation"), "unknown context operation is reported for audit")
	_expect(ignored.has("context/malformed_spec"), "malformed context entry is reported for audit")
	_expect(
		not (request.get("unique_multipliers", {}) as Dictionary).has("context/unknown_operation"),
		"unknown context never enters a numeric resolver bucket",
	)


func _test_scaler_and_live_application_share_request() -> void:
	var enemy := Node.new()
	enemy.set_meta(SCALER.DAMAGE_MULTIPLIER_META, 1.5)
	var target := FakeDamageTarget.new()
	root.add_child(target)
	var source_position := Vector2(12.0, 34.0)
	var applied := SCALER.apply_authored_damage_hit(
		enemy,
		target,
		20,
		source_position,
		{"defense": {"rating": 50.0, "flat_penetration": 10.0}},
	)
	_expect(bool(applied.get("applied", false)) and bool(applied.get("confirmed", false)), "live helper applies its projected hit to the target")
	_expect(target.received_damage == int(applied.get("damage", 0)), "target receives exactly the projected canonical damage")
	_expect(target.received_damage == 30, "difficulty scales direct damage while hidden defense is ignored at the hit seam")
	_expect(target.received_source_position == source_position, "live helper preserves hit source position")
	var request: Dictionary = applied.get("request", {})
	var preview: Dictionary = applied.get("preview", {})
	_expect(StringName(request.get("request_kind", &"")) == OUTGOING.REQUEST_KIND, "live application exposes the enemy request kind")
	_expect(not (preview.get("breakdown", []) as Array).is_empty(), "live application retains its auditable preview")
	_sample_projection = applied.duplicate(true)
	target.free()
	enemy.free()


func _test_canonical_target_single_round_and_legacy_fallback() -> void:
	var enemy := Node.new()
	enemy.set_meta(SCALER.DAMAGE_MULTIPLIER_META, 1.35)
	var canonical := FakeCanonicalTarget.new()
	root.add_child(canonical)
	var applied := SCALER.apply_authored_damage_hit(enemy, canonical, 13)
	_expect(bool(applied.get("used_canonical_target_seam", false)), "complete target handshake selects the resolved-damage route")
	_expect(canonical.resolved_calls == 1 and canonical.legacy_calls == 0, "canonical target receives one resolved hit and never re-enters legacy mitigation")
	_expect(canonical.received_damage == 18, "difficulty retains precision until one final round")
	_expect(int(applied.get("damage", 0)) == 18, "live target receives the exact canonical preview result")
	var preview: Dictionary = applied.get("preview", {})
	_expect_close(float(preview.get("expected_raw_damage", 0.0)), 17.55, "single-round preview keeps authored * difficulty at full precision")
	var request: Dictionary = applied.get("request", {})
	var taken: Dictionary = request.get("damage_taken_multipliers", {})
	_expect(taken.is_empty(), "canonical target injects no hidden damage reduction")
	_expect(not canonical.resolution_context.is_empty(), "resolved target receives the request/preview audit context")

	var partial := FakePartialTarget.new()
	root.add_child(partial)
	var legacy := SCALER.apply_authored_damage_hit(enemy, partial, 13)
	_expect(not bool(legacy.get("used_canonical_target_seam", true)), "partial target handshake falls back to legacy take_damage")
	_expect(int(legacy.get("damage", 0)) == 18 and partial.received_damage == 18, "legacy target receives difficulty-scaled parity without injected target mitigation")
	var legacy_request: Dictionary = legacy.get("request", {})
	_expect((legacy_request.get("damage_taken_multipliers", {}) as Dictionary).is_empty(), "partial target context is ignored to prevent double mitigation")
	var zero_hit := SCALER.apply_runtime_damage_hit(enemy, canonical, 0)
	_expect(
		bool(zero_hit.get("applied", false))
			and not bool(zero_hit.get("confirmed", true))
			and int(zero_hit.get("damage", -1)) == 0,
		"canonical target rejects an attempted zero-damage resolution instead of confirming a hit",
	)
	canonical.free()
	partial.free()
	enemy.free()


func _test_configured_provenance_single_round_across_current_paths() -> void:
	var enemy := FakeConfiguredEnemy.new()
	root.add_child(enemy)
	var provenance := SCALER.capture_authored_damage_provenance(enemy)
	_expect(
		float((provenance.get(String(SCALER.PROPERTY_CONTACT_DAMAGE_CHANNEL), {}) as Dictionary).get("base", 0.0)) == 13.0,
		"contact provenance captures the authored property before telemetry projection",
	)
	_expect(
		float((provenance.get(String(SCALER.PROFILE_DAMAGE_CHANNEL), {}) as Dictionary).get("base", 0.0)) == 13.0,
		"profile provenance captures the authored damage before telemetry projection",
	)
	enemy.set_meta(SCALER.DAMAGE_MULTIPLIER_META, 1.35)
	# Public values intentionally remain the old rounded telemetry projection.
	enemy.contact_damage = 18
	enemy._profile["damage"] = 18
	var old_two_stage := roundi(float(enemy.contact_damage) * 0.93)
	_expect(old_two_stage == 17, "counterexample identifies the old round(base * difficulty) then reduce result")

	var contact_target := FakeCanonicalTarget.new()
	root.add_child(contact_target)
	var contact_hit := SCALER.apply_configured_damage_hit(
		enemy,
		contact_target,
		SCALER.PROPERTY_CONTACT_DAMAGE_CHANNEL,
		enemy.contact_damage,
	)
	_expect(int(contact_hit.get("damage", 0)) == 18, "Skeleton contact keeps base * difficulty until one final round")
	_expect(contact_target.received_damage == 18 and contact_target.resolved_calls == 1, "contact target receives the single-round configured hit")
	var contact_request: Dictionary = contact_hit.get("request", {})
	_expect(float(contact_request.get("base", 0.0)) == 13.0, "contact request uses authored base instead of rounded telemetry damage")
	_expect(StringName(contact_request.get("damage_input_kind", &"")) == SCALER.INPUT_KIND_CONFIGURED_AUTHORED, "contact request exposes configured-authored input kind")

	var profile_target := FakeCanonicalTarget.new()
	root.add_child(profile_target)
	var profile_hit := SCALER.apply_configured_damage_hit(
		enemy,
		profile_target,
		SCALER.PROFILE_DAMAGE_CHANNEL,
		int(enemy._profile["damage"]),
	)
	_expect(int(profile_hit.get("damage", 0)) == 18, "Advanced Vampire profile hit bypasses its rounded telemetry value")
	_expect_close(
		float((profile_hit.get("preview", {}) as Dictionary).get("expected_raw_damage", 0.0)),
		17.55,
		"profile hit preserves authored full precision without hidden reduction",
	)

	var disc_target := FakeCanonicalTarget.new()
	root.add_child(disc_target)
	var disc := SPECTRAL_DISC_SCENE.instantiate() as SpectralDisc
	root.add_child(disc)
	disc.setup(
		enemy,
		enemy.global_position + Vector2.RIGHT * 100.0,
		int(enemy._profile["damage"]),
		disc_target,
		SCALER.INPUT_KIND_CONFIGURED_AUTHORED,
		SCALER.PROFILE_DAMAGE_CHANNEL,
	)
	var disc_hit: Dictionary = disc.call(&"_apply_damage_hit", disc_target)
	_expect(disc.get_damage_input_kind() == SCALER.INPUT_KIND_CONFIGURED_AUTHORED, "Reaper projectile carries configured-authored input kind")
	_expect(disc.get_damage_channel() == SCALER.PROFILE_DAMAGE_CHANNEL, "Reaper projectile carries profile provenance channel")
	_expect(int(disc_hit.get("damage", 0)) == 18 and disc_target.received_damage == 18, "Spectral Disc resolves authored profile damage without hidden reduction")
	disc.free()

	var arrow_target := FakeCanonicalTarget.new()
	root.add_child(arrow_target)
	var arrow := ARCHER_ARROW_SCENE.instantiate() as ArcherEnemyArrow
	root.add_child(arrow)
	arrow.setup(
		enemy,
		Vector2.RIGHT,
		13,
		390.0,
		320.0,
		6.0,
		&"quick",
		SCALER.INPUT_KIND_AUTHORED,
		&"",
	)
	var arrow_hit: Dictionary = arrow.call(&"_apply_damage_hit", arrow_target)
	_expect(arrow.get_damage_input_kind() == SCALER.INPUT_KIND_AUTHORED, "Archer projectile carries raw authored input kind")
	_expect(int(arrow_hit.get("damage", 0)) == 18 and arrow_target.received_damage == 18, "Archer projectile applies difficulty directly in its impact request")
	arrow.free()

	var precision_owner := Node2D.new()
	root.add_child(precision_owner)
	var precision_target := FakeCanonicalTarget.new()
	root.add_child(precision_target)
	var precision_arrow := ARCHER_ARROW_SCENE.instantiate() as ArcherEnemyArrow
	root.add_child(precision_arrow)
	precision_arrow.setup(
		precision_owner,
		Vector2.RIGHT,
		13.45,
		390.0,
		320.0,
		6.0,
		&"quick",
		SCALER.INPUT_KIND_AUTHORED,
		&"",
	)
	var precision_hit: Dictionary = precision_arrow.call(&"_apply_damage_hit", precision_target)
	_expect_close(precision_arrow.get_damage_input_value(), 13.45, "projectile setup preserves fractional authored input independently of integer telemetry")
	_expect(precision_arrow.damage == 13, "projectile keeps a rounded integer telemetry field for compatibility")
	_expect_close(float((precision_hit.get("preview", {}) as Dictionary).get("expected_raw_damage", 0.0)), 13.45, "fractional authored projectile input reaches CombatResolver at full precision")
	_expect(int(precision_hit.get("damage", 0)) == 13, "fractional projectile input rounds only at the final damage step")
	precision_arrow.free()
	precision_target.free()
	precision_owner.free()

	var identity := SCALER.project_configured_damage(
		enemy,
		SCALER.PROPERTY_CONTACT_DAMAGE_CHANNEL,
		enemy.contact_damage,
	)
	_expect(int(identity.get("damage", 0)) == 18, "empty target modifiers preserve the current rounded damage number")

	contact_target.free()
	profile_target.free()
	disc_target.free()
	arrow_target.free()
	enemy.free()


func _test_generic_boss_contract() -> void:
	for definition: EnemyDefinition in [
		HOODED_ARCHER_DEFINITION,
		REAPER_CAPTAIN_DEFINITION,
		CRIMSON_REAPER_DEFINITION,
		CASTELLAN_DEFINITION,
	]:
		_expect(definition.role_tags.has("boss"), "%s carries the generic boss role tag" % definition.enemy_id)

	var future_boss := FakeTaggedEnemy.new()
	root.add_child(future_boss)
	future_boss.set_meta(&"level_entity_type", "future_chapter_boss_unknown_to_scaler")
	future_boss.set_meta(&"enemy_role_tags", PackedStringArray(["boss", "future_content"]))
	SCALER.apply_to(future_boss, 3, &"easy")
	var future_projection: Dictionary = future_boss.get_meta(SCALER.EXPERIENCE_PROJECTION_META, {})
	_expect(bool(future_projection.get("is_boss", false)), "a future boss opts in through data tags without a scaler code branch")

	var grouped_boss := FakeTaggedEnemy.new()
	root.add_child(grouped_boss)
	grouped_boss.add_to_group(&"boss_enemies")
	SCALER.apply_to(grouped_boss, 3, &"easy")
	var grouped_projection: Dictionary = grouped_boss.get_meta(SCALER.EXPERIENCE_PROJECTION_META, {})
	_expect(bool(grouped_projection.get("is_boss", false)), "runtime boss group satisfies the same generic contract")

	var stale_id_only := FakeTaggedEnemy.new()
	root.add_child(stale_id_only)
	stale_id_only.set_meta(&"level_entity_type", "vampire_castellan")
	SCALER.apply_to(stale_id_only, 3, &"easy")
	var stale_projection: Dictionary = stale_id_only.get_meta(SCALER.EXPERIENCE_PROJECTION_META, {})
	_expect(not bool(stale_projection.get("is_boss", true)), "legacy enemy ID alone no longer creates an implicit boss exception")
	future_boss.free()
	grouped_boss.free()
	stale_id_only.free()


func _breakdown_has_source(breakdown: Array, source_name: String) -> bool:
	for raw_row: Variant in breakdown:
		if not raw_row is Dictionary:
			continue
		var sources: Variant = (raw_row as Dictionary).get("sources", [])
		if not sources is Array:
			continue
		for raw_source: Variant in sources:
			if raw_source is Dictionary and String((raw_source as Dictionary).get("name", "")) == source_name:
				return true
	return false


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
				"damage": _sample_projection.get("damage", 0),
				"request_kind": (_sample_projection.get("request", {}) as Dictionary).get("request_kind", ""),
				"formula_version": (_sample_projection.get("preview", {}) as Dictionary).get("formula_version", 0),
			},
		}, "\t") + "\n")
		report.close()
	print("ENEMY OUTGOING DAMAGE TEST %s - %d checks" % [
		"PASSED" if _failures.is_empty() else "FAILED",
		_checks,
	])
	quit(0 if _failures.is_empty() else 1)
