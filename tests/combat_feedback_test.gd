extends SceneTree

const FeedbackScene := preload("res://game/feedback/combat_feedback.tscn")
const AudioRouterScript := preload("res://game/feedback/combat_audio_router.gd")
const GameEventsScript := preload("res://game/autoload/game_events.gd")

class DummyEnemy:
	extends Node2D

	var health := 100
	var max_health := 100
	var accepts_damage := true

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> void:
		if accepts_damage:
			health = maxi(0, health - amount)


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var owns_game_events := false
	var game_events: Node = root.get_node_or_null("GameEvents")
	if game_events == null:
		game_events = GameEventsScript.new()
		game_events.name = "GameEvents"
		root.add_child(game_events)
		owns_game_events = true
	var arena := Node2D.new()
	root.add_child(arena)
	var enemy := DummyEnemy.new()
	enemy.global_position = Vector2(90.0, 45.0)
	arena.add_child(enemy)

	var confirmed_events: Array[Dictionary] = []
	var cue_events: Array[Dictionary] = []
	game_events.connect(&"combat_hit_confirmed", func(
		_target: Node,
		amount: int,
		position: Vector2,
		context: Dictionary
	) -> void:
		confirmed_events.append({"amount": amount, "position": position, "context": context})
	)
	game_events.connect(&"combat_cue_requested", func(
		cue_id: StringName,
		position: Vector2,
		context: Dictionary
	) -> void:
		cue_events.append({"cue_id": cue_id, "position": position, "context": context})
	)

	_expect(
		CombatDamage.apply_confirmed(enemy, 30, Vector2.ZERO, &"sword"),
		"legacy four-argument damage calls remain valid"
	)
	_expect(enemy.health == 70, "confirmed damage still mutates the target once")
	_expect(
		confirmed_events.size() == 1 and int(confirmed_events[0]["amount"]) == 30,
		"canonical hit event reports the actual health delta"
	)
	if not confirmed_events.is_empty():
		_expect(
			(confirmed_events[0]["position"] as Vector2).is_equal_approx(enemy.global_position),
			"canonical hit event resolves the target's world position"
		)
	else:
		_expect(false, "canonical hit event resolves the target's world position")
	_expect(
		cue_events.size() == 1 and StringName(cue_events[0]["cue_id"]) == &"hit_confirmed",
		"legacy calls automatically request the default impact cue"
	)

	enemy.health = 12
	_expect(CombatDamage.apply_confirmed(enemy, 40, Vector2.ZERO, &"sword", {
		"cue_id": &"soul_echo_hit",
		"is_echo": true,
		"combo_step": 4,
	}), "context-aware Echo damage is accepted")
	_expect(
		int(confirmed_events.back()["amount"]) == 12,
		"overkill feedback reports applied damage instead of requested damage"
	)
	_expect(
		StringName(cue_events.back()["cue_id"]) == &"soul_echo_hit"
			and bool((cue_events.back()["context"] as Dictionary).get("is_echo", false)),
		"Echo keeps its distinct cue ID and presentation context"
	)

	enemy.health = 50
	enemy.accepts_damage = false
	var prior_confirmed_count := confirmed_events.size()
	_expect(
		not CombatDamage.apply_confirmed(enemy, 20, Vector2.ZERO, &"sword", {"cue_id": &"sword_hit"}),
		"rejected damage remains unconfirmed"
	)
	_expect(
		confirmed_events.size() == prior_confirmed_count,
		"rejected damage emits no false hit feedback"
	)

	var feedback := FeedbackScene.instantiate() as CombatFeedback
	arena.add_child(feedback)
	await process_frame
	_expect(feedback != null, "combat feedback scene instantiates")
	feedback.present_confirmed_hit(enemy, 17, enemy.global_position, {
		"cue_id": &"soul_echo_hit",
		"is_echo": true,
		"hit_stop_seconds": 0.0,
		"shake_seconds": 0.0,
		"show_overlay": false,
	})
	_expect(
		feedback.get_node("WorldEffects").get_child_count() == 2,
		"a confirmed hit creates a pixel number and local impact burst"
	)
	var combo_counter := feedback.get_node("PresentationLayer/ComboHitCounter") as ComboHitCounter
	_expect(combo_counter.get_hit_count() == 1 and combo_counter.visible, "confirmed hits start the HIT counter")
	game_events.emit_signal(&"hero_combo_state_changed", &"sword", 3, 3, 2.0, true)
	_expect(combo_counter.get_hit_count() == 3, "authoritative Hero combo state overrides the fallback counter")
	game_events.emit_signal(&"hero_combo_state_changed", &"sword", 0, 0, 0.0, false)
	_expect(combo_counter.visible, "forced combo reset keeps the counter visible for its authored exit")
	await create_timer(0.07).timeout
	_expect(combo_counter.scale.x < 1.0, "forced combo reset visibly shrinks instead of zooming larger on exit")
	await create_timer(0.09).timeout
	_expect(not combo_counter.visible, "combo exit animation clears the counter quickly")

	var previous_effect_count := feedback.get_node("WorldEffects").get_child_count()
	feedback.call("_on_settings_changed", {"damage_numbers": false})
	feedback.present_confirmed_hit(enemy, 9, enemy.global_position, {
		"hit_stop_seconds": 0.0,
		"shake_seconds": 0.0,
		"show_overlay": false,
	})
	_expect(
		feedback.get_node("WorldEffects").get_child_count() == previous_effect_count + 1,
		"damage-number accessibility setting preserves impact feedback while hiding numbers"
	)

	var router := AudioRouterScript.new() as CombatAudioRouter
	arena.add_child(router)
	await process_frame
	var sword_stream: Variant = router.get_cue_stream(&"sword_hit")
	var echo_stream: Variant = router.get_cue_stream(&"soul_echo_hit")
	_expect(sword_stream != null and echo_stream != null, "curated local combat cues load from project assets")
	_expect(
		sword_stream is AudioStreamWAV and echo_stream is AudioStreamWAV,
		"legacy Sword and Soul Echo cue helpers remain WAV-compatible"
	)
	_expect(
		sword_stream.resource_path.begins_with("res://assets/audio/")
			and echo_stream.resource_path.begins_with("res://assets/audio/"),
		"combat cues resolve to auditable project WAV resources"
	)
	_expect(
		sword_stream.data != echo_stream.data,
		"Soul Echo uses a distinct asset-backed sound from a normal Sword hit"
	)
	var stone_paths := router.get_cue_variant_paths(&"footstep_stone")
	_expect(
		stone_paths.size() == 5 and stone_paths[0].ends_with(".ogg"),
		"stone footsteps expose the five curated Kenney OGG variants"
	)
	var first_step := router.get_cue_stream(&"footstep_stone") as AudioStream
	var second_step := router.get_cue_stream(&"footstep_stone") as AudioStream
	_expect(
		first_step != null and second_step != null
			and first_step.resource_path != second_step.resource_path,
		"variation pools never immediately repeat the selected stream"
	)
	var axe_paths := router.get_cue_variant_paths(&"axe_hit")
	_expect(
		axe_paths.size() == 3 and axe_paths[0].contains("impactMetal_heavy"),
		"Axe impacts resolve to the curated heavy-metal family"
	)
	var bone_stream := router.get_cue_stream(&"hit_confirmed", {
		"material": &"bone",
		"impact_strength": 1.0,
	}) as AudioStream
	_expect(
		bone_stream != null and bone_stream.resource_path.contains("impactPlate_medium"),
		"generic confirmed hits route through material-aware bone audio"
	)
	var material_cases: Array[Dictionary] = [
		{"material": &"flesh", "strength": 1.0, "path_token": "impactPunch_medium"},
		{"material": &"metal", "strength": 1.4, "path_token": "impactMetal_heavy"},
		{"material": &"wood", "strength": 1.0, "path_token": "impactWood_light"},
		{"material": &"stone", "strength": 1.0, "path_token": "impactMining"},
	]
	var material_routes_valid := true
	for material_case: Dictionary in material_cases:
		var material_paths := router.get_cue_variant_paths(&"hit_confirmed", {
			"material": material_case["material"],
			"impact_strength": material_case["strength"],
		})
		if material_paths.is_empty() or not material_paths[0].contains(String(material_case["path_token"])):
			material_routes_valid = false
			break
	_expect(material_routes_valid, "flesh, metal, wood and stone hit contexts select their authored families")
	var world_cues: Array[StringName] = [
		&"chest_open", &"door_open", &"door_close", &"coin_pickup",
		&"torch_pickup", &"torch_place", &"torch_toggle",
	]
	var world_routes_valid := true
	for world_cue: StringName in world_cues:
		var world_paths := router.get_cue_variant_paths(world_cue)
		if world_paths.is_empty() or not world_paths[0].ends_with(".ogg"):
			world_routes_valid = false
			break
	_expect(world_routes_valid, "chest, door, coin and torch cue IDs resolve to Kenney OGG assets")
	var audited_pool_cues: Array[StringName] = [
		&"sword_swing_1", &"axe_cleave", &"axe_hit", &"axe_catch",
		&"footstep_stone", &"footstep_wood", &"footstep_generic",
		&"impact_bone", &"impact_bone_heavy", &"impact_flesh",
		&"impact_flesh_heavy", &"impact_metal_light", &"impact_metal_medium",
		&"impact_metal_heavy", &"impact_wood_light", &"impact_wood_heavy",
		&"impact_stone", &"chest_open", &"chest_close", &"door_open",
		&"door_close", &"coin_pickup", &"torch_pickup", &"torch_place",
		&"torch_toggle", &"book_open", &"book_close", &"book_page",
	]
	var all_pool_assets_exist := true
	for audited_cue: StringName in audited_pool_cues:
		for asset_path: String in router.get_cue_variant_paths(audited_cue):
			if not FileAccess.file_exists(asset_path):
				all_pool_assets_exist = false
				break
		if not all_pool_assets_exist:
			break
	_expect(all_pool_assets_exist, "every curated OGG path exposed by the runtime cue map exists")
	_expect(not router.has_method(&"_build_stream"), "production audio has no procedural waveform fallback")
	var played_cues: Array[StringName] = []
	router.cue_played.connect(func(cue_id: StringName) -> void: played_cues.append(cue_id))
	router.request_cue(&"soul_echo_hit", {"volume_db": -30.0})
	_expect(played_cues == [&"soul_echo_hit"], "audio router dispatches explicit cue IDs")

	var feedback_router := feedback.get_node("CombatAudioRouter") as CombatAudioRouter
	var hooked_cues: Array[StringName] = []
	feedback_router.cue_played.connect(func(cue_id: StringName) -> void: hooked_cues.append(cue_id))
	game_events.emit_signal(&"hand_attack_started", &"axe", 1)
	_expect(hooked_cues == [&"axe_cleave"], "gameplay audio hooks voice Axe actions without weapon-script coupling")

	var ui_audio := root.get_node_or_null("UiAudioFeedback")
	var probe_button := Button.new()
	arena.add_child(probe_button)
	await process_frame
	_expect(ui_audio != null and probe_button.has_meta(&"asset_ui_audio_bound"), "routed UI buttons receive shared asset-backed feedback")
	probe_button.queue_free()
	sword_stream = null
	echo_stream = null

	feedback.queue_free()
	router.queue_free()
	arena.queue_free()
	if owns_game_events:
		game_events.queue_free()
	await process_frame
	Engine.time_scale = 1.0
	if _failures.is_empty():
		print("COMBAT FEEDBACK TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("COMBAT FEEDBACK TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
