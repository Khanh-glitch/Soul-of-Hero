extends "res://tests/survival_foundation_test.gd"
## Partial fresh-save journey: real physics and injected ordinary input only.
## No fixture grants, actor teleports, direct harvest calls or mocked time. This
## does not yet establish the larger shelter/production/death journey.

func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_normal_input_%d.json" % Time.get_ticks_usec()
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await _boot()
	if _host != null:
		await _body()
		if not _body_complete:
			_expect(false, "test body ran to completion")
	_teardown()
	# Let queued world and GUI nodes finish cleanup before engine shutdown.
	await process_frame
	await process_frame
	_finish()

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL NORMAL INPUT GATHER PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL NORMAL INPUT GATHER FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _set_direction(delta: Vector2) -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	# A held key has no deadband: a one-pixel correction is still a real press.
	# A 3px threshold here silently refused every sub-3px correction, which pinned
	# the Hero against a wall corner while it was 1.02px below the next waypoint.
	if delta.x < -0.05:
		Input.action_press("move_left")
	elif delta.x > 0.05:
		Input.action_press("move_right")
	if delta.y < -0.05:
		Input.action_press("move_up")
	elif delta.y > 0.05:
		Input.action_press("move_down")

func _walk_to_kind(ow: Node, hero: CharacterBody2D, navigation: OverworldTraversability, kind: String) -> SurvivalResourceNode:
	var start := navigation.cell_of(hero.global_position)
	var distances := navigation.reachable_from(start)
	var goal := Vector2i(-1, -1)
	var selected: SurvivalResourceNode = null
	var best := 2147483647
	for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
		var node := raw as SurvivalResourceNode
		if node == null or node.resource_kind != kind or not bool(_survival().call(&"is_node_harvestable", node.node_id, kind)):
			continue
		var node_cell := navigation.cell_of(node.global_position)
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var cell := node_cell + Vector2i(dx, dy)
				if not navigation.in_bounds(cell):
					continue
				var distance := distances[cell.y * navigation.width + cell.x]
				if distance >= 0 and distance < best:
					best = distance
					goal = cell
					selected = node
	if selected == null:
		return null
	var path: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		var here := distances[cursor.y * navigation.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var neighbour := cursor + step
			if navigation.in_bounds(neighbour) and distances[neighbour.y * navigation.width + neighbour.x] == here - 1:
				previous = neighbour
				break
		if previous == cursor:
			return null
		cursor = previous
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 6.0 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 6.0:
			_set_direction(Vector2.ZERO)
			print("NORMAL_GATHER_TRACE stuck at %s target %s" % [str(hero.global_position), str(point)])
			return null
	_set_direction(Vector2.ZERO)
	return selected if selected.can_interact(hero) else null

func _click_window(position: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = position
	Input.parse_input_event(motion)
	var click := InputEventMouseButton.new()
	click.position = position
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	Input.parse_input_event(click)
	await physics_frame
	await process_frame
	click.pressed = false
	Input.parse_input_event(click)
	await process_frame

func _owning_scroll(control: Control) -> ScrollContainer:
	var ancestor := control.get_parent() if control != null else null
	while ancestor != null:
		if ancestor is ScrollContainer:
			return ancestor as ScrollContainer
		ancestor = ancestor.get_parent()
	return null

func _scroll_to(scroll: ScrollContainer, control: Control) -> bool:
	for _i: int in range(60):
		if scroll.get_global_rect().has_point(control.get_global_rect().get_center()):
			return true
		var wheel := InputEventMouseButton.new()
		wheel.position = root.get_final_transform() * (scroll.get_global_transform_with_canvas() * (scroll.size * 0.5))
		wheel.button_index = MOUSE_BUTTON_WHEEL_UP if control.get_global_rect().get_center().y < scroll.get_global_rect().position.y else MOUSE_BUTTON_WHEEL_DOWN
		wheel.pressed = true
		Input.parse_input_event(wheel)
		await process_frame
		wheel.pressed = false
		Input.parse_input_event(wheel)
		await process_frame
	print("NORMAL_SCROLL_TRACE scroll=%s target=%s value=%d max=%.1f visible=%s target_parent=%s" % [str(scroll.get_global_rect()), str(control.get_global_rect()), scroll.scroll_vertical, scroll.get_v_scroll_bar().max_value, str(control.is_visible_in_tree()), str(control.get_parent())])
	return scroll.get_global_rect().has_point(control.get_global_rect().get_center())

func _collect_receipt_count() -> int:
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	var receipts: Dictionary = snapshot.get("applied_transactions", {})
	var count := 0
	for receipt: Variant in receipts.values():
		if receipt is Dictionary and String((receipt.get("metadata", {}) as Dictionary).get("operation", "")) == "collect":
			count += 1
	return count

func _tap_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	await process_frame
	event.pressed = false
	Input.parse_input_event(event)
	await process_frame

func _body() -> void:
	var ow := _host.get_child(0)
	var hero: CharacterBody2D = ow.get(&"player")
	var navigation: OverworldTraversability = ow.get(&"traversability")
	var start := navigation.cell_of(hero.global_position)
	var distances := navigation.reachable_from(start)
	var goal := Vector2i(-1, -1)
	var target: SurvivalResourceNode = null
	var best := 2147483647
	for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
		var node := raw as SurvivalResourceNode
		if node == null or node.resource_kind != "scrap_pile":
			continue
		var node_cell := navigation.cell_of(node.global_position)
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var cell := node_cell + Vector2i(dx, dy)
				if not navigation.in_bounds(cell):
					continue
				var distance := distances[cell.y * navigation.width + cell.x]
				if distance < 0 or distance >= best:
					continue
				best = distance
				goal = cell
				target = node
	_expect(target != null, "fresh spawn has a reachable planned scrap node")
	if target == null:
		_body_complete = true
		return
	var path: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		var here := distances[cursor.y * navigation.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var neighbour := cursor + step
			if navigation.in_bounds(neighbour) and distances[neighbour.y * navigation.width + neighbour.x] == here - 1:
				previous = neighbour
				break
		if previous == cursor:
			_expect(false, "reachable path can be reconstructed")
			_body_complete = true
			return
		cursor = previous
	var travelled := true
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 6.0 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 6.0:
			travelled = false
			print("NORMAL_GATHER_TRACE stuck at %s target %s" % [str(hero.global_position), str(point)])
			break
	_set_direction(Vector2.ZERO)
	_expect(travelled and not bool(hero.get(&"dead")) and target.can_interact(hero), "ordinary movement reaches a scrap node from fresh spawn")
	if not travelled or not target.can_interact(hero):
		_body_complete = true
		return
	var before := _count(IRON)
	var camera: Camera2D = ow.get(&"camera")
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var click := InputEventMouseButton.new()
	click.position = root.get_final_transform() * (root.get_visible_rect().size * 0.5)
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	Input.parse_input_event(click)
	await physics_frame
	await process_frame
	click.pressed = false
	Input.parse_input_event(click)
	await process_frame
	_expect(_count(IRON) == before + 1, "ordinary world pointer gathers actual nearby scrap")
	await create_timer(0.3).timeout
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(_count(IRON) == before + 2, "second world click obtains the rest of the starter scrap")
	var wood_before := _count(WOOD)
	var oak := await _walk_to_kind(ow, hero, navigation, "oak_tree")
	_expect(oak != null and not bool(hero.get(&"dead")), "ordinary movement reaches an oak without teleport")
	if oak == null:
		_body_complete = true
		return
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	for swing: int in range(3):
		if swing > 0:
			await create_timer(0.3).timeout
		await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(_count(WOOD) == wood_before + 6, "ordinary world clicks collect starter wood")
	var fibre_before := _count("reed_fibre")
	for group_index: int in range(2):
		var reed := await _walk_to_kind(ow, hero, navigation, "reed_clump")
		_expect(reed != null and not bool(hero.get(&"dead")), "ordinary movement reaches a harvestable reed node")
		if reed == null:
			_body_complete = true
			return
		camera.reset_smoothing()
		camera.force_update_scroll()
		await process_frame
		var hits := 2 if group_index == 0 else 1
		for swing: int in range(hits):
			if swing > 0:
				await create_timer(0.3).timeout
			await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(_count("reed_fibre") == fibre_before + 3, "ordinary world clicks collect the workbench's reed inputs")
	var toggle := InputEventAction.new()
	toggle.action = &"economy_toggle"
	toggle.pressed = true
	Input.parse_input_event(toggle)
	await process_frame
	toggle.pressed = false
	Input.parse_input_event(toggle)
	await process_frame
	var panel: Node = ow.get(&"economy_panel")
	var recipe_button := panel.find_child("Recipe_workbench_kit_hand", true, false) as Button
	_expect(recipe_button != null and recipe_button.is_visible_in_tree(), "ordinary C action exposes the starter kit")
	if recipe_button == null or not recipe_button.is_visible_in_tree():
		_body_complete = true
		return
	# The starter list is longer than one 640x360 panel page on a fresh save, so
	# an ordinary player has to wheel the row into view before it can be clicked.
	var recipe_scroll := _owning_scroll(recipe_button)
	var revealed := recipe_scroll != null and await _scroll_to(recipe_scroll, recipe_button)
	_expect(revealed, "ordinary wheel input reveals the starter kit recipe")
	if not revealed:
		_body_complete = true
		return
	var button_position := root.get_final_transform() * (recipe_button.get_global_transform_with_canvas() * (recipe_button.size * 0.5))
	await _click_window(button_position)
	var host: Node = ow.get(&"economy_session")
	var job_id := ""
	for key: Variant in (host.call(&"jobs") as Dictionary).keys():
		var job: Dictionary = (host.call(&"jobs") as Dictionary)[key]
		if String(job.get("target", "")) == "workbench_kit":
			job_id = String(key)
	_expect(not job_id.is_empty() and _count(WOOD) == wood_before and _count(IRON) == before, "GUI reserves the resources gathered by ordinary input")
	if job_id.is_empty():
		_body_complete = true
		return
	toggle.pressed = true
	Input.parse_input_event(toggle)
	await process_frame
	toggle.pressed = false
	Input.parse_input_event(toggle)
	await process_frame
	_expect(not bool(panel.call(&"is_open")), "ordinary C action closes the panel to resume active work")
	if bool(panel.call(&"is_open")):
		_body_complete = true
		return
	var deadline := Time.get_ticks_msec() + 35000
	var job: Dictionary = (host.call(&"jobs") as Dictionary).get(job_id, {})
	while Time.get_ticks_msec() < deadline and String(job.get("status", "")) != "ready":
		await process_frame
		job = (host.call(&"jobs") as Dictionary).get(job_id, {})
	_expect(String(job.get("status", "")) == "ready", "active ordinary gameplay completes the starter kit queue")
	if String(job.get("status", "")) != "ready":
		_body_complete = true
		return
	await _tap_action(&"economy_toggle")
	var collect_button: Button = null
	for value: Node in panel.find_children("*", "Button", true, false):
		if (value as Button).text == "Collect":
			collect_button = value as Button
			break
	var scroll := _owning_scroll(collect_button)
	_expect(collect_button != null and scroll != null, "completed escrow exposes a GUI collect control inside its scroll owner")
	if collect_button == null or scroll == null:
		_body_complete = true
		return
	var collect_visible := await _scroll_to(scroll, collect_button)
	_expect(collect_visible, "ordinary wheel input reaches the collect control")
	if not collect_visible:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (collect_button.get_global_transform_with_canvas() * (collect_button.size * 0.5)))
	_expect(_count("workbench_kit") == 1, "ordinary GUI pointer collects the manufactured kit")
	await _tap_action(&"economy_toggle")
	await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_7")
	var build: SurvivalBuildSystem = ow.get(&"survival_build")
	_expect(build.active and build.selected_piece == "station_workbench", "ordinary build inputs select the workbench")
	if not build.active or build.selected_piece != "station_workbench":
		_body_complete = true
		return
	var centre := navigation.cell_of(hero.global_position)
	var placement := Vector2i(-1, -1)
	for dy: int in range(-3, 4):
		if placement.x >= 0:
			break
		for dx: int in range(-3, 4):
			var candidate := centre + Vector2i(dx, dy)
			if build.validate_cell(candidate).is_empty():
				placement = candidate
				break
	_expect(placement.x >= 0, "reachable ground supports the paid station footprint")
	if placement.x < 0:
		_body_complete = true
		return
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var world_point := Vector2(placement.x * 16 + 8, placement.y * 16 + 8)
	var window_point := root.get_final_transform() * (camera.get_canvas_transform() * world_point)
	# Placement polls the actual viewport cursor, unlike GUI event coordinates.
	# Move the Xvfb pointer as a user would; parse_input_event alone does not warp it.
	Input.warp_mouse(window_point)
	await process_frame
	await process_frame
	await _click_window(window_point)
	print("NORMAL_BUILD_TRACE target=%s world=%s window=%s preview=%s mouse_view=%s final=%s camera_canvas=%s hovered=%s rejection=%s kit=%d" % [str(placement), str(world_point), str(window_point), str(build.preview_cell()), str(root.get_mouse_position()), str(root.get_final_transform()), str(camera.get_canvas_transform()), str(root.gui_get_hovered_control()), build.last_rejection(), _count("workbench_kit")])
	var structures: Dictionary = _survival().call(&"structures")
	var station_id := ""
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == "station_workbench":
			station_id = String(key)
	_expect(not station_id.is_empty() and _count("workbench_kit") == 0, "ordinary placement input pays for the physical workbench")
	if station_id.is_empty():
		_body_complete = true
		return
	await _tap_action(&"economy_toggle")
	var weave_button := panel.find_child("Recipe_weave_cloth_%s" % station_id, true, false) as Button
	var weave_scroll := _owning_scroll(weave_button)
	_expect(weave_button != null and weave_scroll != null, "nearby paid bench exposes its real weave recipe inside its scroll owner")
	if weave_button == null or weave_scroll == null:
		_body_complete = true
		return
	var weave_visible := await _scroll_to(weave_scroll, weave_button)
	_expect(weave_visible, "ordinary wheel input reaches the workbench recipe")
	if not weave_visible:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (weave_button.get_global_transform_with_canvas() * (weave_button.size * 0.5)))
	var weave_id := ""
	for key: Variant in (host.call(&"jobs") as Dictionary).keys():
		var candidate_job: Dictionary = (host.call(&"jobs") as Dictionary)[key]
		if String(candidate_job.get("target", "")) == "weave_cloth":
			weave_id = String(key)
	_expect(not weave_id.is_empty() and _count("reed_fibre") == fibre_before, "workbench GUI reserves player-gathered reeds")
	if weave_id.is_empty():
		_body_complete = true
		return
	await _tap_action(&"economy_toggle")
	var weave_deadline := Time.get_ticks_msec() + 30000
	var weave_job: Dictionary = (host.call(&"jobs") as Dictionary).get(weave_id, {})
	while Time.get_ticks_msec() < weave_deadline and String(weave_job.get("status", "")) != "ready":
		await process_frame
		weave_job = (host.call(&"jobs") as Dictionary).get(weave_id, {})
	_expect(String(weave_job.get("status", "")) == "ready", "active ordinary gameplay completes workbench production")
	if String(weave_job.get("status", "")) != "ready":
		_body_complete = true
		return
	await _tap_action(&"economy_toggle")
	var output_button: Button = null
	for value: Node in panel.find_children("*", "Button", true, false):
		var candidate := value as Button
		var row := candidate.get_parent()
		var label := row.get_child(0) as Label if row != null and row.get_child_count() > 0 else null
		if candidate.text == "Collect" and label != null and label.text.begins_with("weave cloth: ready"):
			output_button = candidate
			break
	var output_scroll := _owning_scroll(output_button)
	_expect(output_button != null and output_scroll != null, "produced cloth exposes a GUI collection control inside its scroll owner")
	if output_button == null or output_scroll == null:
		_body_complete = true
		return
	var output_visible := await _scroll_to(output_scroll, output_button)
	_expect(output_visible, "ordinary wheel input reaches produced cloth")
	if not output_visible:
		_body_complete = true
		return
	var cloth_before := _count("binding_cloth")
	var receipts_before := _collect_receipt_count()
	_expect(cloth_before == 0, "fresh journey has no cloth before collection")
	await _click_window(root.get_final_transform() * (output_button.get_global_transform_with_canvas() * (output_button.size * 0.5)))
	_expect(_count("binding_cloth") == 2 and _collect_receipt_count() == receipts_before + 1, "ordinary GUI collects exactly two cloth with one committed receipt")
	await _tap_action(&"economy_toggle")
	_expect(bool(_save().call(&"reload_save")) and not (_survival().call(&"resolve_station", station_id) as Dictionary).is_empty() and _count("binding_cloth") == cloth_before + 2 and _collect_receipt_count() == receipts_before + 1, "paid workbench, exact cloth and collection receipt survive reload")
	_body_complete = true
