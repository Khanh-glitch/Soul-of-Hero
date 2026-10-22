extends Node

var _errors: Array[String] = []


func start(_game: Node2D) -> void:
	_capture.call_deferred()


func _capture() -> void:
	for _frame: int in 10:
		await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	if knight == null:
		_fail("Sword combo capture could not find the Hero.")
		_finish()
		return
	var primary_enemy: Node2D
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D:
			continue
		candidate.process_mode = Node.PROCESS_MODE_DISABLED
		if primary_enemy == null:
			primary_enemy = candidate as Node2D
		else:
			(candidate as CanvasItem).hide()
	knight.global_position = Vector2(520.0, 410.0)
	knight.facing_direction = Vector2.RIGHT
	if primary_enemy != null:
		primary_enemy.global_position = knight.global_position + Vector2(74.0, 0.0)
		primary_enemy.set("health", 999)
	var camera := knight.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
	await get_tree().process_frame

	await _capture_step(knight, 1, 8, "sword_combo_1_fixed_frames.png")
	await _wait_for_action_end(knight)
	await _capture_step(knight, 2, 9, "sword_combo_2_fixed_frames.png")
	await _wait_for_action_end(knight)
	await _capture_step(knight, 3, 15, "sword_combo_3_wave_recoil.png")
	await _wait_for_action_end(knight)
	await _capture_step(knight, 4, 14, "sword_combo_4_fixed_frames.png")
	await _wait_for_action_end(knight)

	# Visual contract: Soul Echo is one delayed white spectral Sword, not a
	# chain of frozen snapshots. Capture Combo 1 while that delayed actor is in
	# its authored slash strip so changes to tint/delay remain reviewable.
	knight.global_position = Vector2(520.0, 410.0)
	knight.facing_direction = Vector2.RIGHT
	if primary_enemy != null:
		primary_enemy.global_position = knight.global_position + Vector2(74.0, 0.0)
	if camera != null:
		camera.reset_smoothing()
	await get_tree().process_frame
	if not knight.request_action("skill"):
		_fail("Soul Echo activation was rejected during visual capture.")
	else:
		for _frame: int in 2:
			await get_tree().physics_frame
		await _capture_step(knight, 1, 8, "sword_soul_echo_combo_1_white.png")
		await _wait_for_action_end(knight)
		# Combo 2 places the delayed Echo across the target, making the separation
		# between the real Sword and the single mirrored silhouette unambiguous.
		await _capture_step(knight, 2, 9, "sword_soul_echo_white_afterimage.png")
		await _wait_for_action_end(knight)
	_finish()


func _capture_step(knight: KnightController, step: int, physics_frames: int, filename: String) -> void:
	if not knight.request_action("attack"):
		_fail("Combo %d request was rejected." % step)
		return
	for _frame: int in physics_frames:
		await get_tree().physics_frame
	var sprite := knight.get_node("Sprite") as AnimatedSprite2D
	var expected := StringName("sword_combo_%d" % step)
	if sprite.animation != expected:
		_fail("Combo %d played '%s', expected '%s'." % [step, sprite.animation, expected])
	if sprite.sprite_frames.get_frame_count(expected) <= 0:
		_fail("Combo %d has no authored frames." % step)
	var error := await _save_frame(filename)
	if error != OK:
		_fail("Could not save %s (error %d)." % [filename, error])
	print("SWORD CAPTURE step=%d animation=%s frame=%d position=%s" % [
		step, sprite.animation, sprite.frame, knight.global_position
	])


func _wait_for_action_end(knight: KnightController) -> void:
	var frames := 0
	while not knight.current_action.is_empty() and frames < 90:
		await get_tree().physics_frame
		frames += 1
	for _frame: int in 3:
		await get_tree().physics_frame


func _save_frame(filename: String) -> int:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var output := ProjectSettings.globalize_path("res://.artifacts/" + filename)
	var error := image.save_png(output)
	print("SWORD COMBO CAPTURE: %s (error %d)" % [output, error])
	return error


func _fail(message: String) -> void:
	_errors.append(message)
	push_error(message)


func _finish() -> void:
	if _errors.is_empty():
		print("SWORD COMBO CAPTURE PASSED — all four authored animation strips rendered")
		get_tree().quit(0)
	else:
		print("SWORD COMBO CAPTURE FAILED — %d issue(s)" % _errors.size())
		get_tree().quit(1)
