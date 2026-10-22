extends Node

const SWORD: WeaponDefinition = preload("res://game/weapons/data/sword.tres")
const AXE: WeaponDefinition = preload("res://game/weapons/data/axe.tres")


func start(_game: Node2D) -> void:
	_capture.call_deferred()


func _capture() -> void:
	for _frame: int in 8:
		await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	if knight == null:
		push_error("Axe form capture could not find the player.")
		get_tree().quit(1)
		return
	var manager := knight.get_weapon_manager()
	if not manager.configure_loadout(SWORD, [AXE], false) or not manager.request_swap(0):
		push_error("Axe form capture could not configure the swap.")
		get_tree().quit(1)
		return
	for _frame: int in 24:
		await get_tree().physics_frame
	# Put the actor in an open room so the captured form is not hidden behind
	# the spawn-side HUD and camera boundary.
	knight.global_position = Vector2(520.0, 320.0)
	var camera := knight.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
	await get_tree().process_frame
	await get_tree().process_frame
	var errors: Array[int] = []
	errors.append(await _save_frame("axe_character_form_runtime.png"))

	Input.action_press(&"move_right")
	for _frame: int in 8:
		await get_tree().physics_frame
	errors.append(await _save_frame("axe_attack_transition_run.png"))

	Input.action_press(&"attack")
	for _frame: int in 3:
		await get_tree().physics_frame
	errors.append(await _save_frame("axe_attack_transition_charge.png"))

	Input.action_release(&"attack")
	Input.action_release(&"move_right")
	for _frame: int in 7:
		await get_tree().physics_frame
	errors.append(await _save_frame("axe_attack_transition_cleave.png"))

	Input.action_release(&"attack")
	Input.action_release(&"move_right")
	get_tree().quit(0 if errors.all(func(error: int) -> bool: return error == OK) else 1)


func _save_frame(filename: String) -> int:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var output := ProjectSettings.globalize_path("res://.artifacts/" + filename)
	var error := image.save_png(output)
	print("AXE FORM CAPTURE: %s (error %d)" % [output, error])
	return error
