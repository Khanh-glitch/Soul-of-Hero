extends SceneTree

const TUTORIAL_SCENE_PATH := "res://game/tutorial/level_one_tutorial.tscn"
const TUTORIAL_ORDER: Array[StringName] = [
	&"movement",
	&"dash",
	&"sword_combo",
	&"passing_slash",
	&"crescent_recoil",
	&"pursuit_execution",
	&"soul_echo",
]
const COMBO_STEPS: Array[StringName] = [
	&"sword_combo",
	&"passing_slash",
	&"crescent_recoil",
	&"pursuit_execution",
]

var _checks := 0
var _failures: Array[String] = []
var _save: Node
var _events: Node
var _save_path := ""


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_save = root.get_node("/root/SaveService")
	_events = root.get_node("/root/GameEvents")
	_save_path = "user://tests/level_one_tutorial_learning_%d.json" % Time.get_ticks_usec()
	_remove_generations(_save_path)
	_expect(
		bool(_save.call(&"configure_storage", _save_path, true)),
		"focused tutorial starts from an isolated fresh save",
	)
	var app_flow := root.get_node_or_null("/root/AppFlow")
	var active_run: Dictionary = (
		app_flow.call(&"get_active_run")
		if app_flow != null and app_flow.has_method(&"get_active_run")
		else {}
	)
	_expect(active_run.is_empty(), "direct editor-style launch has no active AppFlow run")

	var tutorial_scene := load(TUTORIAL_SCENE_PATH) as PackedScene
	_expect(tutorial_scene != null, "Level 1 tutorial resource loads after autoload initialization")
	var tutorial := tutorial_scene.instantiate() if tutorial_scene != null else null
	_expect(tutorial != null, "Level 1 tutorial scene instantiates")
	if tutorial == null:
		_finish()
		return
	root.add_child(tutorial)
	await process_frame
	_expect(_active_step(tutorial) == &"movement", "fresh tutorial starts with movement")
	_expect((tutorial.get_node("TutorialPanel") as Control).visible, "direct editor launch keeps the tutorial visible")

	var player := Node2D.new()
	root.add_child(player)
	player.global_position = Vector2(64.0, 64.0)
	_events.emit_signal(&"player_registered", player)
	await process_frame
	_expect(not _is_completed(&"movement"), "registering a player without displacement does not complete movement")
	player.global_position += Vector2(27.0, 0.0)
	await process_frame
	_expect(not _is_completed(&"movement"), "movement below the authored distance remains practice in progress")
	player.global_position += Vector2(2.0, 0.0)
	await process_frame
	_expect(_is_completed(&"movement"), "real displacement completes movement")
	_expect(_active_step(tutorial) == &"dash", "movement advances to Dash in canonical order")

	Input.action_press(&"dash")
	await process_frame
	Input.action_release(&"dash")
	_expect(not _is_completed(&"dash"), "a raw Dash input without the gameplay event does not complete Dash")
	_events.emit_signal(&"dash_started", Vector2.RIGHT)
	_expect(_is_completed(&"dash"), "the confirmed Dash event completes Dash")
	_expect(_active_step(tutorial) == &"sword_combo", "Dash advances to Sword combo step one")

	for index: int in COMBO_STEPS.size():
		var combo_step := index + 1
		var tutorial_step := COMBO_STEPS[index]
		_expect(_active_step(tutorial) == tutorial_step, "Sword lesson %d is active in order" % combo_step)
		_events.emit_signal(
			&"hero_combo_state_changed",
			&"sword_hero",
			combo_step,
			0,
			0.0,
			true,
		)
		_events.emit_signal(
			&"combat_cue_requested",
			StringName("sword_swing_%d" % combo_step),
			Vector2.ZERO,
			{"hero_id": &"sword_hero", "combo_step": combo_step},
		)
		_expect(not _is_completed(tutorial_step), "starting Sword step %d without a hit cannot complete it" % combo_step)

		_emit_hit(0, &"sword_hero", combo_step)
		_emit_hit(12, &"axe_hero", combo_step)
		_emit_hit(12, &"sword_hero", 1 + (combo_step % 4))
		_expect(not _is_completed(tutorial_step), "zero damage, wrong Hero, and wrong combo cannot complete Sword step %d" % combo_step)

		_emit_hit(12, &"sword_hero", combo_step)
		_expect(_is_completed(tutorial_step), "a positive confirmed Sword hit completes step %d" % combo_step)
		_expect(
			bool(_save.call(&"is_transaction_applied", "tutorial:level1:%s" % tutorial_step)),
			"Sword step %d writes its canonical durable receipt" % combo_step,
		)
		if index + 1 < COMBO_STEPS.size():
			var next_step := COMBO_STEPS[index + 1]
			_emit_hit(12, &"sword_hero", combo_step)
			_expect(not _is_completed(next_step), "repeating Sword step %d cannot skip the next lesson" % combo_step)

	_expect(_active_step(tutorial) == &"soul_echo", "four confirmed Sword hits advance to Soul Echo")
	_events.emit_signal(
		&"combat_cue_requested",
		&"soul_echo_activate",
		Vector2.ZERO,
		{"hero_id": &"sword_hero"},
	)
	_expect(not _is_completed(&"soul_echo"), "Soul Echo activation cue alone cannot complete the lesson")
	_emit_hit(18, &"sword_hero", 4, false)
	_emit_hit(0, &"sword_hero", 4, true)
	_emit_hit(18, &"axe_hero", 4, true)
	_expect(not _is_completed(&"soul_echo"), "Soul Echo requires positive damage, Sword identity, and is_echo confirmation")
	_emit_hit(18, &"sword_hero", 4, true)
	_expect(_is_completed(&"soul_echo"), "a positive confirmed Soul Echo hit completes the lesson")
	_expect(_active_step(tutorial).is_empty(), "all learned actions close the tutorial panel")
	_expect(not (tutorial.get_node("TutorialPanel") as Control).visible, "completed tutorial is hidden")

	for step: StringName in TUTORIAL_ORDER:
		_expect(_is_completed(step), "tutorial completion persists in memory: %s" % step)
		_expect(
			bool(_save.call(&"is_transaction_applied", "tutorial:level1:%s" % step)),
			"tutorial completion keeps its canonical receipt: %s" % step,
		)

	tutorial.free()
	player.free()
	_expect(bool(_save.call(&"reload_save")), "tutorial save reloads from disk")
	for step: StringName in TUTORIAL_ORDER:
		_expect(_is_completed(step), "tutorial completion survives reload: %s" % step)
	var reloaded_tutorial := tutorial_scene.instantiate()
	root.add_child(reloaded_tutorial)
	await process_frame
	_expect(_active_step(reloaded_tutorial).is_empty(), "reloaded completed tutorial has no pending lesson")
	_expect(not (reloaded_tutorial.get_node("TutorialPanel") as Control).visible, "reloaded completed tutorial remains hidden")
	reloaded_tutorial.free()
	_finish()


func _emit_hit(
	actual_amount: int,
	hero_id: StringName,
	combo_step: int,
	is_echo := false,
) -> void:
	_events.emit_signal(
		&"combat_hit_confirmed",
		root,
		actual_amount,
		Vector2.ZERO,
		{
			"hero_id": hero_id,
			"combo_step": combo_step,
			"is_echo": is_echo,
		},
	)


func _active_step(tutorial: Node) -> StringName:
	return StringName(tutorial.get("_active_step"))


func _is_completed(step: StringName) -> bool:
	var tutorials: Dictionary = _save.call(&"get_snapshot").get("tutorials", {})
	return bool(tutorials.get(String(step), false))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(_save_path)
	if _failures.is_empty():
		print("LEVEL ONE TUTORIAL LEARNING TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("LEVEL ONE TUTORIAL LEARNING TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
