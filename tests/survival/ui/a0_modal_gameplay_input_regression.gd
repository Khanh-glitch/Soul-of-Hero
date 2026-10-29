extends Node
## Executable A0 handoff regression. Runs the real overworld and real Knight under
## a visible gameplay_modal root while build, movement, attack, skill and pointer input are tested.
## Current A0 is expected to expose its ungated Knight polls; no A0 code is edited.
const OVERWORLD := preload("res://game/overworld/chapter1_overworld.tscn")


func _ready() -> void:
	call_deferred("_run")


func _run() -> void:
	for action: StringName in [
		&"move_left",
		&"move_right",
		&"move_up",
		&"move_down",
		&"light_attack",
		&"heavy_attack",
		&"skill",
		&"build_toggle",
		&"build_place"
	]:
		Input.action_release(action)
	var world: Variant = OVERWORLD.instantiate()
	get_tree().root.add_child(world)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().physics_frame
	if world.get("player") == null or world.get("survival_build") == null:
		printerr(
			"A0_MODAL_PROBE_UNAVAILABLE: production overworld did not expose player/build host"
		)
		get_tree().quit(3)
		return
	var modal_host := Control.new()
	modal_host.name = "A6ModalHost"
	modal_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world.add_child(modal_host)
	var modal := Control.new()
	modal.name = "A6InputGateRegressionModal"
	modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal.mouse_filter = Control.MOUSE_FILTER_STOP
	modal.add_to_group(&"gameplay_modal")
	modal_host.add_child(modal)
	var nested_modal := Control.new()
	nested_modal.name = "NestedA6InputGateRegressionModal"
	nested_modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	nested_modal.mouse_filter = Control.MOUSE_FILTER_STOP
	nested_modal.add_to_group(&"gameplay_modal")
	modal.add_child(nested_modal)
	await get_tree().process_frame
	var nested_modal_registered := bool(world.call("_has_gameplay_modal"))
	modal_host.visible = false
	await get_tree().process_frame
	await get_tree().process_frame
	var hidden_parent_clears_modal := not bool(world.call("_has_gameplay_modal"))
	modal_host.visible = true
	await get_tree().process_frame
	var visible_parent_restores_modal := bool(world.call("_has_gameplay_modal"))
	if (
		not nested_modal_registered
		or not hidden_parent_clears_modal
		or not visible_parent_restores_modal
	):
		printerr(
			(
				"A0_MODAL_LIFECYCLE_CONTRACT_FAIL: nested=%s hidden_parent=%s restored=%s"
				% [
					nested_modal_registered,
					hidden_parent_clears_modal,
					visible_parent_restores_modal
				]
			)
		)
		get_tree().quit(3)
		return
	var before: Vector2 = world.player.global_position
	var build_before := bool(world.survival_build.active)
	Input.action_press(&"move_right")
	Input.action_press(&"light_attack")
	Input.action_press(&"skill")
	Input.action_press(&"build_toggle")
	await get_tree().physics_frame
	await get_tree().physics_frame
	var moved := world.player.global_position.distance_to(before) > 0.5
	var action := String(world.player.current_action)
	var combat_action := not action.is_empty()
	var build_changed := bool(world.survival_build.active) != build_before
	for key: StringName in [&"move_right", &"light_attack", &"skill", &"build_toggle"]:
		Input.action_release(key)
	Input.action_release(&"attack")
	for _frame in range(90):
		if String(world.player.current_action).is_empty():
			break
		await get_tree().physics_frame
	var action_before_click := String(world.player.current_action)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = get_tree().root.get_visible_rect().size * 0.5
	click.pressed = true
	get_tree().root.push_input(click, true)
	await get_tree().physics_frame
	var action_after_click := String(world.player.current_action)
	var click_through := (
		action_before_click.is_empty()
		and not action_after_click.is_empty()
		and action_after_click != action_before_click
	)
	click.pressed = false
	get_tree().root.push_input(click, true)
	Input.action_release(&"attack")
	await get_tree().physics_frame
	Input.action_press(&"move_right")
	await get_tree().physics_frame
	modal.visible = false
	await get_tree().physics_frame
	var held_input_after_close := world.player.move_input.x > 0.5
	for key: StringName in [&"move_right", &"light_attack", &"skill", &"build_toggle", &"attack"]:
		Input.action_release(key)
	await get_tree().physics_frame
	modal_host.queue_free()
	await get_tree().process_frame
	var tree_exit_clears_modal := not bool(world.call("_has_gameplay_modal"))
	if not tree_exit_clears_modal:
		printerr("A0_MODAL_LIFECYCLE_CONTRACT_FAIL: tree exit left modal registered")
		world.queue_free()
		get_tree().quit(3)
		return
	world.queue_free()
	await get_tree().process_frame
	if moved or combat_action or build_changed or click_through or held_input_after_close:
		printerr(
			(
				"A0_MODAL_INPUT_GATE_LEAK: movement=%s combat_action=%s current_action=%s build_toggle=%s click_through=%s held_after_close=%s"
				% [
					moved,
					combat_action,
					action,
					build_changed,
					click_through,
					held_input_after_close
				]
			)
		)
		get_tree().quit(2)
		return
	print(
		"A0_MODAL_INPUT_GATE_PASS: nested/hidden/tree-exit modal states valid; simultaneous gameplay inputs suppressed; pointer did not click through"
	)
	get_tree().quit(0)
