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

## --- shared body-shaped planning and walking -------------------------------

## The Hero is a 12x16 rectangle whose origin sits at its feet, so a stand cell
## places the body one pixel into the row above. A cell-centre query alone is
## therefore not proof that the body can *travel* between two cells: the planner
## also casts the same shape along each candidate segment.
func _shape_placement(cell: Vector2i, hero: CharacterBody2D) -> Transform2D:
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	return Transform2D(0.0, Vector2(cell.x * 16 + 8, cell.y * 16 + 15) + shape.position)

func _shape_query(hero: CharacterBody2D) -> PhysicsShapeQueryParameters2D:
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape.shape
	query.collision_mask = hero.collision_mask
	query.exclude = [hero.get_rid()]
	query.collide_with_bodies = true
	query.collide_with_areas = false
	return query

func _shape_clear(cell: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	if not nav.in_bounds(cell) or not nav.is_free(cell):
		cache[cell] = false
		return false
	var query := _shape_query(hero)
	query.transform = _shape_placement(cell, hero)
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	cache[cell] = clear
	return clear

## Swept clearance for one 16px step. Both endpoints may be clear while the
## straight segment clips a corner, which is exactly how a walker wedges.
##
## If the Hero already overlaps something it cannot be judged from here; the
## step is allowed and the walker's own contact handling deals with it. That
## keeps a body that is momentarily inside a doorway from losing its whole path.
func _sweep_clear(from: Vector2i, to: Vector2i, hero: CharacterBody2D) -> bool:
	var space := hero.get_world_2d().direct_space_state
	var query := _shape_query(hero)
	query.transform = _shape_placement(from, hero)
	if not space.intersect_shape(query, 1).is_empty():
		return true
	query.motion = _shape_placement(to, hero).origin - query.transform.origin
	var fractions := space.cast_motion(query)
	return fractions.size() >= 2 and fractions[0] >= 0.999

func _route(start: Vector2i, goal: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D) -> Array[Vector2i]:
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {start: start}
	var cache: Dictionary = {}
	var cursor := 0
	while cursor < queue.size() and not previous.has(goal):
		var cell := queue[cursor]
		cursor += 1
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT]:
			var next := cell + step
			if previous.has(next) or not _shape_clear(next, nav, hero, cache):
				continue
			if cache.has("edge:" + str(cell) + ">" + str(next)):
				if not bool(cache["edge:" + str(cell) + ">" + str(next)]):
					continue
			elif not _sweep_clear(cell, next, hero):
				cache["edge:" + str(cell) + ">" + str(next)] = false
				continue
			cache["edge:" + str(cell) + ">" + str(next)] = true
			previous[next] = cell
			queue.append(next)
	var path: Array[Vector2i] = []
	if not previous.has(goal):
		return path
	while goal != start:
		path.push_front(goal)
		goal = previous[goal]
	return path

## Ordinary continuous walking, one planned cell at a time.
##
## A player holds a direction and, when the body stops moving, tries another
## direction until the corner is cleared; that is reproduced here. When the body
## makes no progress the slide contacts are printed with their colliders and
## normals so a wedge is diagnosable instead of merely failing.
func _walk_path(hero: CharacterBody2D, path: Array[Vector2i]) -> bool:
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		var stalled := 0
		var escapes := 0
		var escape_frames := 0
		var escape_direction := Vector2.ZERO
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			if escape_frames > 0:
				escape_frames -= 1
				_set_direction(escape_direction)
				await physics_frame
				continue
			var before := hero.global_position
			_set_direction(point - before)
			await physics_frame
			stalled = stalled + 1 if hero.global_position.distance_to(before) < 0.25 else 0
			if stalled < 5:
				continue
			escapes += 1
			if escapes > 6:
				break
			_report_wedge(hero, cell, before, escapes)
			escape_direction = _escape_direction(hero, before, point, escapes)
			escape_frames = 10
			stalled = 0
		if hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			print("HOME_ROUTE_FAIL actor=%s target=%s" % [str(hero.global_position), str(cell)])
			return false
	_set_direction(Vector2.ZERO)
	return true

## Slide contacts prove whether a stall is a real physical contact and against
## what; the normals say which directions the body can still slide.
func _report_wedge(hero: CharacterBody2D, cell: Vector2i, at: Vector2, attempt: int) -> void:
	var contacts: Array[String] = []
	for index: int in hero.get_slide_collision_count():
		var collision := hero.get_slide_collision(index)
		var other := collision.get_collider()
		contacts.append("%s normal=%s position=%s" % [
			other.name if other is Node else str(other),
			str(collision.get_normal()), str(collision.get_position())])
	print("A0_WALK_STALL cell=%s at=%s velocity=%s motion=%s attempt=%d contacts=%d [%s]" % [
		str(cell), str(at), str(hero.velocity), str(hero.get_last_motion()), attempt,
		contacts.size(), "; ".join(contacts)])

## A player wiggles: try the four cardinal directions in a rotating order that
## starts with the one most likely to slide along the contact.
func _escape_direction(hero: CharacterBody2D, at: Vector2, point: Vector2, attempt: int) -> Vector2:
	var to_target := (point - at).normalized()
	var order: Array[Vector2] = []
	if absf(to_target.x) >= absf(to_target.y):
		order = [Vector2(0, -signf(to_target.x)), Vector2(0, signf(to_target.x)),
			Vector2(to_target.x, 0), Vector2(-to_target.x, 0)]
	else:
		order = [Vector2(-signf(to_target.y), 0), Vector2(signf(to_target.y), 0),
			Vector2(0, to_target.y), Vector2(0, -to_target.y)]
	for candidate: Vector2 in order:
		if candidate.length() < 0.5:
			continue
		var query := _shape_query(hero)
		query.transform = Transform2D(0.0, hero.global_position + (hero.get_node("BodyShape") as CollisionShape2D).position)
		query.motion = candidate * 6.0
		var fractions := hero.get_world_2d().direct_space_state.cast_motion(query)
		if fractions.size() >= 2 and fractions[0] > 0.5:
			return candidate
	return order[(attempt - 1) % order.size()] if not order.is_empty() else Vector2.ZERO

## `exclude` lets a caller that already failed on one node ask for the next one
## instead of retrying the same blocked node forever. It is a search filter, not
## a grant: the returned node is still reached on foot and harvested by input.
func _walk_to_kind(ow: Node, hero: CharacterBody2D, navigation: OverworldTraversability, kind: String,
		exclude: Array = []) -> SurvivalResourceNode:
	var start := navigation.cell_of(hero.global_position)
	var distances := navigation.reachable_from(start)
	var goal := Vector2i(-1, -1)
	var selected: SurvivalResourceNode = null
	var best := 2147483647
	var reachable_stands: Dictionary = {}
	for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
		var node := raw as SurvivalResourceNode
		if node == null or node.resource_kind != kind or exclude.has(node.node_id):
			continue
		if not bool(_survival().call(&"is_node_harvestable", node.node_id, kind)):
			continue
		var node_cell := navigation.cell_of(node.global_position)
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var cell := node_cell + Vector2i(dx, dy)
				if not navigation.in_bounds(cell):
					continue
				var distance := distances[cell.y * navigation.width + cell.x]
				if distance < 0:
					continue
				reachable_stands[str(cell) + "|" + node.node_id] = {"cell": cell, "distance": distance, "node": node}
				if distance < best:
					best = distance
					goal = cell
					selected = node
	if selected == null:
		return null
	# The nav graph says a cell is walkable, not that a 12x16 body fits between
	# two of them: a prop collider inside a free cell still blocks the Hero, and
	# that is exactly how this walk stalled 20px short of an oak with 66k cells
	# still "reachable". So the nearest stand is only a target; the route comes
	# from the same swept, shape-aware planner the rest of the journey uses, and
	# a stand the body cannot reach falls back to the next nearest one.
	var path: Array[Vector2i] = _route(start, goal, navigation, hero)
	if path.is_empty() and start != goal:
		var alternatives: Array = []
		for raw_cell: Variant in reachable_stands.values():
			alternatives.append(raw_cell)
		alternatives.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.distance) < int(b.distance))
		for entry: Dictionary in alternatives:
			var candidate: Vector2i = entry.cell
			var candidate_path := _route(start, candidate, navigation, hero)
			if not candidate_path.is_empty():
				path = candidate_path
				selected = entry.node
				break
	if path.is_empty() and start != goal:
		print("NORMAL_GATHER_TRACE no shaped stand start=%s goal=%s" % [str(start), str(goal)])
		return null
	if not path.is_empty():
		if not await _walk_path(hero, path):
			return null
	_set_direction(Vector2.ZERO)
	if not selected.can_interact(hero):
		# The planned stand is a nav cell, the node has its own reach. A player
		# keeps walking toward what they want to hit instead of giving up, so close
		# the gap with ordinary input before declaring the node out of reach.
		var close := Time.get_ticks_msec() + 2000
		while not selected.can_interact(hero) and Time.get_ticks_msec() < close and not bool(hero.get(&"dead")):
			_set_direction(selected.global_position - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		print("NORMAL_GATHER_TRACE approach node=%s hero=%s node_pos=%s distance=%.2f interact=%s harvestable=%s" % [
			selected.node_id, str(hero.global_position), str(selected.global_position),
			hero.global_position.distance_to(selected.global_position),
			str(_within(hero, selected)), str(bool(_survival().call(&"is_node_harvestable", selected.node_id, kind)))])
	return selected if selected.can_interact(hero) else null

func _within(hero: CharacterBody2D, node: SurvivalResourceNode) -> bool:
	return hero.global_position.distance_to(node.global_position) <= SurvivalResourceNode.REACH

## The job id whose target recipe is `target`, or "" when nothing queued.
func _job_target(target: String) -> String:
	var host: Node = _host.get_child(0).get(&"economy_session")
	for key: Variant in (host.call(&"jobs") as Dictionary).keys():
		var job: Dictionary = (host.call(&"jobs") as Dictionary)[key]
		if String(job.get("target", "")) == target:
			return String(key)
	return ""


func _click_window(position: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = position
	Input.parse_input_event(motion)
	# A parsed event object must not be re-sent for the release: Godot reports
	# "Input.parse_input_event: reusing an event object" and the second parse is not
	# guaranteed to be delivered as a fresh press/release pair.
	var press := InputEventMouseButton.new()
	press.position = position
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	Input.parse_input_event(press)
	await physics_frame
	await process_frame
	var release := InputEventMouseButton.new()
	release.position = position
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	Input.parse_input_event(release)
	await process_frame

## The panel joins the target and the status word with its own separator ("weave
## cloth · ready 12/12"), so a gate must match the words, not one owner's
## punctuation: the recipe must be this target and the status must be ready.
## Open the economy panel the way a player does - press until it is on screen. A
## blind toggle at a panel that is already open closes it, which is how a real
## recipe list can be read as "missing".
func _close_panel(panel: Node) -> bool:
	for _i: int in range(3):
		if not bool(panel.call(&"is_open")):
			return true
		await _tap_action(&"economy_toggle")
		await process_frame
	return not bool(panel.call(&"is_open"))


func _open_panel(panel: Node) -> bool:
	for _i: int in range(3):
		if bool(panel.call(&"is_open")):
			return true
		await _tap_action(&"economy_toggle")
		await process_frame
	return bool(panel.call(&"is_open"))


## Print what the panel and the session actually contain when a row is missing, so
## the failure is a fact rather than a guess.
func _dump_panel(panel: Node, ow: Node, station_id: String) -> void:
	var session: Node = ow.get(&"economy_session")
	var rows: Array[String] = []
	for value: Node in panel.find_children("*", "Button", true, false):
		rows.append(String(value.name))
	var stations: Array[String] = []
	for entry: Variant in (session.call(&"nearby_stations") as Array):
		var station: Dictionary = entry
		stations.append("%s:%s:t%d" % [String(station.get("station_id", "")),
			String(station.get("kind", "")), int(station.get("tier", 0))])
	var recipes: Array[String] = []
	for entry: Variant in (session.call(&"available_recipes", station_id) as Array):
		recipes.append(String((entry as Dictionary).get("id", "")))
	print("A0_GATHER_PANEL open=%s station=%s recipes=%s stations=%s buttons=%s" % [
		str(bool(panel.call(&"is_open"))), station_id, str(recipes), str(stations), str(rows.slice(0, 20))])


## Walk up to a structure the player just built, with ordinary directional input,
## until the product's own station policy says it is in reach. A player who placed a
## bench three cells away has to walk to it; nothing here moves the body.
func _stand_by(ow: Node, hero: CharacterBody2D, station_id: String) -> bool:
	var structures: Dictionary = _survival().call(&"structures")
	var record: Dictionary = structures.get(station_id, {})
	var definition: Dictionary = _survival().call(&"piece_definition", String(record.get("piece", "")))
	var node: Node2D = (ow.get(&"survival_build") as SurvivalBuildSystem).structure_node(station_id)
	if node == null:
		return false
	var deadline := Time.get_ticks_msec() + 6000
	var target := SurvivalStationReach.anchor_for(node, definition)
	while not SurvivalStationReach.in_reach(hero.global_position, node, definition) and Time.get_ticks_msec() < deadline:
		_set_direction(target - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	return SurvivalStationReach.in_reach(hero.global_position, node, definition)


## A job row is [progress bar, words, action]; the words are not child 0, so a
## gate that grabs the first child gets the bar and silently finds no row.
func _row_label(row: Node) -> Label:
	if row == null:
		return null
	for child: Node in row.get_children():
		if child is Label:
			return child as Label
	return null


func _ready_label(label: Label, target: String) -> bool:
	var text := label.text.to_lower()
	return text.begins_with(target.to_lower()) and text.contains("ready")


func _owning_scroll(control: Control) -> ScrollContainer:
	var ancestor := control.get_parent() if control != null else null
	while ancestor != null:
		if ancestor is ScrollContainer:
			return ancestor as ScrollContainer
		ancestor = ancestor.get_parent()
	return null

func _scroll_to(scroll: ScrollContainer, control: Control) -> bool:
	var inside := 0
	for _i: int in range(60):
		# Two consecutive frames, because a container re-lays out the frame after a
		# scroll and one reading can still be the pre-scroll geometry.
		if scroll.get_global_rect().has_point(control.get_global_rect().get_center()):
			inside += 1
			if inside >= 2:
				return true
			await process_frame
			continue
		inside = 0
		# The pointer has to be over the list, and each notch needs its own event
		# object: the engine drops a re-parsed one, which is why a re-used wheel
		# object looked like "wheel input does not scroll".
		var point: Vector2 = root.get_final_transform() * (scroll.get_global_transform_with_canvas() * (scroll.size * 0.5))
		var motion := InputEventMouseMotion.new()
		motion.position = point
		Input.parse_input_event(motion)
		await process_frame
		var wheel := InputEventMouseButton.new()
		wheel.position = point
		wheel.button_index = MOUSE_BUTTON_WHEEL_UP if control.get_global_rect().get_center().y < scroll.get_global_rect().position.y else MOUSE_BUTTON_WHEEL_DOWN
		wheel.pressed = true
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
	var panel: Node = ow.get(&"economy_panel")
	_expect(await _open_panel(panel), "ordinary C action opens the economy panel")
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
	await _close_panel(panel)
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
	await _open_panel(panel)
	var collect_button: Button = null
	for value: Node in panel.find_children("*", "Button", true, false):
		if (value as Button).text.to_lower() == "collect":
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
	_expect(await _stand_by(ow, hero, station_id), "ordinary movement brings the player to the bench it built")
	await _open_panel(panel)
	var weave_button := panel.find_child("Recipe_weave_cloth_%s" % station_id, true, false) as Button
	if weave_button == null:
		_dump_panel(panel, ow, station_id)
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
	var weave_live := panel.find_child(String(weave_button.name), true, false) as Button
	if weave_live == null:
		weave_live = weave_button
	await _click_window(root.get_final_transform() * (weave_live.get_global_transform_with_canvas() * (weave_live.size * 0.5)))
	var weave_id := _job_target("weave_cloth")
	# The panel tells the player why a press did not take; print that sentence, the
	# button's real state and both rects so the next run is diagnosis, not guesswork.
	var texts: Array[String] = []
	for value: Node in panel.find_children("*", "Label", true, false):
		texts.append(String((value as Label).text).substr(0, 60))
	print("A0_CONNECTED_WEAVE_CLICK job=%s disabled=%s row=%s scroll=%s focus=%s labels=%s" % [
		weave_id, str(weave_live.disabled), str(weave_live.get_global_rect()),
		str(weave_scroll.get_global_rect()), str(root.gui_get_focus_owner()), str(texts.slice(0, 4))])
	if weave_id.is_empty():
		# A player whose first click does not take clicks again rather than
		# concluding the bench is broken; the second press is ordinary input too.
		await create_timer(0.4).timeout
		weave_live = panel.find_child(String(weave_button.name), true, false) as Button
		if weave_live == null:
			weave_live = weave_button
		await _click_window(root.get_final_transform() * (weave_live.get_global_transform_with_canvas() * (weave_live.size * 0.5)))
		weave_id = _job_target("weave_cloth")
	# Two facts, two labels: a missing job and an unchanged reed count are different
	# failures and must not share one sentence.
	_expect(not weave_id.is_empty(), "workbench GUI queues the weave job (%s)" % weave_id)
	_expect(_count("reed_fibre") == fibre_before,
		"workbench GUI reserves player-gathered reeds (reed_fibre %d->%d)" % [fibre_before, _count("reed_fibre")])
	if weave_id.is_empty():
		_body_complete = true
		return
	await _close_panel(panel)
	var weave_deadline := Time.get_ticks_msec() + 30000
	var weave_job: Dictionary = (host.call(&"jobs") as Dictionary).get(weave_id, {})
	while Time.get_ticks_msec() < weave_deadline and String(weave_job.get("status", "")) != "ready":
		await process_frame
		weave_job = (host.call(&"jobs") as Dictionary).get(weave_id, {})
	_expect(String(weave_job.get("status", "")) == "ready", "active ordinary gameplay completes workbench production")
	if String(weave_job.get("status", "")) != "ready":
		_body_complete = true
		return
	await _open_panel(panel)
	var output_button: Button = null
	for value: Node in panel.find_children("*", "Button", true, false):
		var candidate := value as Button
		var label := _row_label(candidate.get_parent())
		if candidate.text.to_lower() == "collect" and label != null and _ready_label(label, "weave cloth"):
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
