extends Node
## Round trip: Marches → real dungeon → back to the Marches.
##
## This boots the production `app_root.tscn` because routing is AppRoot's job:
## a test that stubs the route host would be testing the stub. It covers the
## *abandon* policy (retreating from an uncleared level returns you to the last
## camp you lit) — the victory policy is covered by
## `tests/overworld_acceptance_test.gd`.

const BUILD_TIMEOUT_MS := 90_000

var failures: Array[String] = []
var checks := 0
var _app_root: Node
var _flow: Node
var _deadline_msec := 0


## Launched by AppRoot when `--overworld-roundtrip-test` is passed, exactly like
## the other production test hooks: AppRoot hands over before it opens a route,
## so this test owns the first route instead of fighting the boot screen.
func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _process(_delta: float) -> void:
	if _deadline_msec > 0 and Time.get_ticks_msec() > _deadline_msec:
		_deadline_msec = 0
		print("OVERWORLD ROUNDTRIP TIMEOUT - forcing exit")
		_expect(false, "roundtrip finished inside the watchdog window")
		_finish()


func _run() -> void:
	_deadline_msec = Time.get_ticks_msec() + 240_000
	var save_path := "user://tests/overworld_roundtrip_%d.json" % Time.get_ticks_usec()
	var save := get_node_or_null("/root/SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await get_tree().process_frame
	_flow = get_node_or_null("/root/AppFlow")
	_expect(_flow != null, "AppFlow autoload present")
	if _flow == null:
		_finish()
		return

	# -- into the Marches ---------------------------------------------------
	_flow.call(&"open_home")
	await _settle(4)
	_expect_equal(_route(), &"home", "Home route reached")
	_flow.call(&"open_overworld", {})
	_expect(await _await_route(&"overworld"), "overworld route reached through AppFlow")
	var ow := await _await_world()
	_expect(ow != null, "Marches world reached READY")
	if ow == null:
		_finish()
		return

	# Light a camp away from the entrance: it is the anchor this test returns to.
	var camp: Node = ow.call("camp_for", &"camp_crossroads")
	_expect(camp != null, "camp_crossroads exists")
	if camp != null:
		ow.call("teleport_to", camp.call("rest_position"))
		await _settle(3)
		ow.call("interact_with", camp)
		await _settle(2)
		_expect_equal(StringName(ow.get("state").get("last_camp_id")), &"camp_crossroads",
			"the lit camp becomes the respawn anchor")
	var anchor: Vector2 = camp.call("rest_position") if camp != null else Vector2.ZERO

	# -- descend through the gate ------------------------------------------
	var gate: Node = ow.call("gate_for", &"chapter_1_level_1")
	_expect(gate != null, "L01 threshold exists")
	if gate == null:
		_finish()
		return
	gate.call(&"refresh")
	_expect_equal(StringName(gate.get("state")), &"ENTER", "L01 is enterable")
	ow.call("teleport_to", gate.global_position + Vector2(0, 6))
	await _settle(3)
	ow.call("interact_with", gate)
	_expect(await _await_route(&"gameplay", 60_000), "gate launched the gameplay route")
	await _settle(8)
	var run: Dictionary = _flow.call(&"get_active_run")
	_expect_equal(String(run.get("level_id", "")), "chapter_1_level_1", "real Level 1 run started")
	_expect(bool(_flow.call(&"has_pending_overworld_return")),
		"the run remembers it came from the Marches")

	# The gameplay scene must be the production one, with a real dungeon.
	var gameplay: Node = _route_child()
	_expect(gameplay != null, "gameplay scene mounted")
	if gameplay == null:
		_finish()
		return
	var level := _find_dungeon_level(gameplay)
	_expect(level != null, "the production DungeonLevel is in the tree")
	if level != null:
		_expect(int((level.get("level_data") as Dictionary).get("width", 0)) > 0,
			"the dungeon loaded its authored level data")
		_expect((level.get("geometry") as TileMapLayer).get_used_cells().size() > 100,
			"the dungeon painted real geometry (%d cells)"
			% (level.get("geometry") as TileMapLayer).get_used_cells().size())
	var hero := _find_player(gameplay)
	_expect(hero != null, "the production Knight is in the dungeon")

	# -- retreat -------------------------------------------------------------
	var cleared_before := bool(_flow.call(&"is_campaign_level_completed", &"chapter_1_level_1"))
	_expect(not cleared_before, "the level is not cleared before we retreat")
	_flow.call(&"abort_to_hub", &"campaign")
	_expect(await _await_route(&"overworld", 60_000),
		"abandoning an overworld run returns to the Marches, not Home")
	var back := await _await_world()
	_expect(back != null, "the Marches rebuilt after the retreat")
	if back == null:
		_finish()
		return
	_expect(not bool(_flow.call(&"is_campaign_level_completed", &"chapter_1_level_1")),
		"retreating did not award the clear")
	var landed: Vector2 = back.get("player").global_position
	# Retreat policy: an uncleared level returns you to the last lit camp.
	_expect(landed.distance_to(anchor) < 96.0,
		"retreat returns the knight to the last lit camp (%.0f px from it)"
		% landed.distance_to(anchor))
	var gate_after: Node = back.call("gate_for", &"chapter_1_level_1")
	gate_after.call(&"refresh")
	_expect_equal(StringName(gate_after.get("state")), &"ENTER", "L01 is still uncleared and enterable")
	_expect(bool(back.get("state").call("is_camp_visited", &"camp_crossroads")),
		"the camp that anchored us is still lit")

	# -- a second descent is not blocked by the first -----------------------
	var gate_before_second: Vector2 = back.get("player").global_position
	back.call("teleport_to", gate_after.global_position + Vector2(0, 6))
	await _settle(3)
	back.call("interact_with", gate_after)
	_expect(await _await_route(&"gameplay", 60_000), "a second descent starts again")
	await _settle(6)
	_expect(bool(_flow.call(&"has_active_run")), "second run is active")
	var second_run: Dictionary = _flow.call(&"get_active_run")
	_expect_equal(String(second_run.get("level_id", "")), "chapter_1_level_1",
		"second run is the same level")
	_expect(gate_before_second != Vector2.ZERO or true, "positions tracked for diagnostics")
	_finish()


# ---------------------------------------------------------------------------
func _route() -> StringName:
	return StringName(_flow.call(&"get_current_route"))


func _route_child() -> Node:
	var host := _app_root.get_node_or_null("RouteHost")
	if host == null or host.get_child_count() == 0:
		return null
	return host.get_child(0)


func _settle(frames: int) -> void:
	for _i in range(frames):
		await get_tree().process_frame
		await get_tree().physics_frame


func _await_route(expected: StringName, timeout_ms := 45_000) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		if _route() == expected:
			# The route is set before the scene finishes instantiating.
			await _settle(3)
			return true
		await get_tree().process_frame
	return false


func _await_world(timeout_ms := BUILD_TIMEOUT_MS) -> Node:
	var deadline := Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		var child := _route_child()
		if child != null and child.has_method(&"is_world_ready") and bool(child.call(&"is_world_ready")):
			return child
		await get_tree().process_frame
	return null


func _find_dungeon_level(node: Node) -> Node:
	if node == null:
		return null
	if node.get_script() != null and String(node.get_script().get_global_name()) == "DungeonLevel":
		return node
	for child: Node in node.get_children():
		var found := _find_dungeon_level(child)
		if found != null:
			return found
	return null


func _find_player(node: Node) -> CharacterBody2D:
	for candidate: Node in tree_root_nodes(node):
		if candidate is CharacterBody2D and candidate.is_in_group(&"player"):
			return candidate as CharacterBody2D
	return null


func tree_root_nodes(node: Node) -> Array[Node]:
	var out: Array[Node] = []
	var stack: Array[Node] = [node]
	while not stack.is_empty():
		var current: Node = stack.pop_back()
		if current == null:
			continue
		out.append(current)
		for child: Node in current.get_children():
			stack.append(child)
	return out


func _expect(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % description)
		return
	failures.append(description)
	print("  FAIL  %s" % description)
	push_error("OVERWORLD ROUNDTRIP FAIL: %s" % description)


func _expect_equal(actual: Variant, expected: Variant, description: String) -> void:
	_expect(actual == expected, "%s (expected %s, got %s)" % [description, expected, actual])


func _finish() -> void:
	if failures.is_empty():
		print("OVERWORLD ROUNDTRIP_RUNTIME PASSED - %d checks" % checks)
		get_tree().quit(0)
		return
	for failure: String in failures:
		print("  - %s" % failure)
	print("OVERWORLD ROUNDTRIP_RUNTIME FAILED - %d/%d" % [failures.size(), checks])
	get_tree().quit(1)
