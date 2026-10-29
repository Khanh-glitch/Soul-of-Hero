extends "res://tests/survival_foundation_test.gd"
## Temporary CI overlay only: the actual pinned A6 workspace in the real A0
## overworld. Inputs are injected, not human play. No production UI mount.

func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/a6_composition_%d.json" % Time.get_ticks_usec()
	_save().call(&"configure_storage", save_path, true)
	await _boot()
	if _host != null:
		await _body()
	_teardown()
	await process_frame
	await process_frame
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("A0 A6 COMPOSITION %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _key(code: Key, down: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.pressed = down
	Input.parse_input_event(event)

func _joy(button: JoyButton, down: bool) -> void:
	var event := InputEventJoypadButton.new()
	event.device = 0
	event.button_index = button
	event.pressed = down
	Input.parse_input_event(event)

func _body() -> void:
	var world := _host.get_child(0)
	var hero := world.get(&"player") as CharacterBody2D
	var workspace_scene := load("res://game/survival/ui/expedition_workspace.tscn") as PackedScene
	_expect(hero != null and workspace_scene != null, "production Knight and pinned A6 workspace load")
	if hero == null or workspace_scene == null:
		return
	var overlay := CanvasLayer.new()
	world.add_child(overlay)
	var workspace := workspace_scene.instantiate() as Control
	overlay.add_child(workspace)
	workspace.call(&"open_workspace")
	await process_frame
	await physics_frame
	_expect(workspace.is_visible_in_tree() and workspace.is_in_group(&"gameplay_modal"), "actual A6 workspace is open and registered")
	var before := hero.global_position
	var build: Variant = world.get(&"survival_build")
	var build_before := bool(build.get(&"active"))
	_key(KEY_D, true)
	_key(KEY_J, true)
	_key(KEY_E, true)
	_key(KEY_Q, true)
	_key(KEY_B, true)
	_joy(JOY_BUTTON_A, true)
	# Godot queues parsed events until a process frame. Do not close the
	# workspace before the actual key/controller presses reach the input gate.
	await process_frame
	await physics_frame
	await process_frame
	await physics_frame
	var gate := hero.get_node("GameplayInputGate")
	print("A6_INPUT_TRACE open move=%s attack=%s dash=%s latched=%s held=%s" % [str(Input.is_action_pressed(&"move_right")), str(Input.is_action_pressed(&"attack")), str(Input.is_action_pressed(&"dash")), str(gate.get(&"_event_latches")), str(gate.get(&"_held_under_modal"))])
	_expect(Input.is_action_pressed(&"move_right") and Input.is_action_pressed(&"attack") and Input.is_action_pressed(&"dash"), "injected keyboard and controller presses reached Input before close")
	_expect(hero.global_position.distance_to(before) < 0.5 and String(hero.get(&"current_action")).is_empty(), "injected keyboard movement and combat do not leak under A6")
	_expect(bool(build.get(&"active")) == build_before, "build toggle does not leak under A6")
	for action: StringName in [&"move_right", &"attack", &"skill", &"soul_relay_1", &"build_toggle", &"dash"]:
		_expect(not bool(hero.call(&"gameplay_input_allowed", action)), "visible workspace denies " + String(action))
	workspace.call(&"close_workspace")
	await physics_frame
	await physics_frame
	print("A6_INPUT_TRACE closed move=%s attack=%s dash=%s latched=%s held=%s" % [str(Input.is_action_pressed(&"move_right")), str(Input.is_action_pressed(&"attack")), str(Input.is_action_pressed(&"dash")), str(gate.get(&"_event_latches")), str(gate.get(&"_held_under_modal"))])
	_expect((hero.get(&"move_input") as Vector2).length() < 0.01 and String(hero.get(&"current_action")).is_empty(), "held gameplay inputs remain suppressed after closing A6")
	for action: StringName in [&"move_right", &"attack", &"skill", &"soul_relay_1", &"build_toggle", &"dash"]:
		_expect(not bool(hero.call(&"gameplay_input_allowed", action)), "held press remains suppressed after close: " + String(action))
	_key(KEY_D, false)
	_key(KEY_J, false)
	_key(KEY_E, false)
	_key(KEY_Q, false)
	_key(KEY_B, false)
	_joy(JOY_BUTTON_A, false)
	await physics_frame
	await process_frame
	for action: StringName in [&"move_right", &"attack", &"skill", &"soul_relay_1", &"build_toggle", &"dash"]:
		_expect(bool(hero.call(&"gameplay_input_allowed", action)), "release rearms " + String(action))
	_key(KEY_D, true)
	await physics_frame
	await physics_frame
	_expect((hero.get(&"move_input") as Vector2).x > 0.5, "fresh movement press works after release")
	_key(KEY_D, false)
	await physics_frame
	workspace.call(&"open_workspace")
	await process_frame
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = root.get_final_transform() * (root.get_visible_rect().size * 0.5)
	root.warp_mouse(click.position)
	await process_frame
	click.pressed = true
	Input.parse_input_event(click)
	await process_frame
	await physics_frame
	_expect(String(hero.get(&"current_action")).is_empty(), "actual A6 workspace pointer press does not attack")
	workspace.call(&"close_workspace")
	await process_frame
	_expect(not bool(hero.call(&"gameplay_input_allowed", &"attack")) and not bool(hero.call(&"gameplay_input_allowed", &"build_place")), "held A6 pointer press remains suppressed after close")
	click.pressed = false
	Input.parse_input_event(click)
	await process_frame
	await physics_frame
	_expect(bool(hero.call(&"gameplay_input_allowed", &"attack")), "pointer release rearms attack")
	# Existing non-A6 overlays also opt into the same A0 gate.
	var codex_scene := load("res://game/ui/field_codex.tscn") as PackedScene
	var codex := codex_scene.instantiate() as Control
	overlay.add_child(codex)
	codex.call(&"set_player", hero)
	codex.call(&"show_codex")
	await process_frame
	Input.action_press(&"move_right")
	await physics_frame
	await process_frame
	_expect(codex.is_in_group(&"gameplay_modal") and (hero.get(&"move_input") as Vector2).length() < 0.01, "existing field codex blocks movement without pausing world time")
	codex.call(&"hide_codex")
	await physics_frame
	_expect(not bool(hero.call(&"gameplay_input_allowed", &"move_right")), "codex press remains blocked after close")
	Input.action_release(&"move_right")
	await physics_frame
	codex.queue_free()
	var hud: Node = world.get(&"hud")
	hud.call(&"show_death", "Modal input test")
	await process_frame
	var death_panel := hud.find_child("OverworldDeath", true, false) as Control
	_expect(death_panel != null and death_panel.is_in_group(&"gameplay_modal") and not bool(hero.call(&"gameplay_input_allowed", &"attack")), "existing overworld death panel participates in the gate")
	hud.call(&"hide_death")
	workspace.call(&"open_workspace")
	await process_frame
	paused = true
	_key(KEY_D, true)
	await process_frame
	workspace.call(&"close_workspace")
	paused = false
	await physics_frame
	_expect((hero.get(&"move_input") as Vector2).length() < 0.01, "always-processing gate preserves a press made while paused")
	_key(KEY_D, false)
	await physics_frame
	overlay.queue_free()
	_body_complete = true
