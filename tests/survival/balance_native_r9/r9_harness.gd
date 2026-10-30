extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## A7 harness for round 9: production Hero traversal, physical interaction and
## adversarial economy tests against a real composed world.
##
## ## What is different from the round-8 harness
## Round 8 mounted the world and then *called product methods*. Round 9's claims
## are about what a player can do, so every state change in this family has to
## come from an event the game's own input pipeline resolved:
##
## * movement is `Input.action_press` / `action_release` (the same `Input`
##   singleton `Knight._physics_process` reads), followed by real physics frames,
##   so `move_and_slide`, corner sliding and acceleration all run;
## * a click is an `InputEventMouseButton` pushed through `Input.parse_input_event`,
##   and a pointer move is an `InputEventMouseMotion` — which is what makes the
##   viewport's stored mouse position, `get_final_transform()` and the HUD's
##   `gui_get_hovered_control()` participate.
##
## ## The one environment limit, stated once
## This sandbox has no X server and none can be installed from the hosts it can
## reach, so `--headless` is the only display available. Anything that genuinely
## requires a rasterised frame (a pixel, a screenshot, a visual verdict) is
## therefore *not* claimed here. Anything that only needs the CPU-side input and
## GUI path — hit-testing, hover, focus, placement projection — is exercised for
## real, and the probe says which of the two a check belongs to.

const WORLDS := [
	{"key": "nav", "x": -1, "y": 0},
	{"key": "south", "x": 0, "y": 1},
	{"key": "east", "x": 1, "y": 0},
	{"key": "north", "x": 0, "y": -1},
]
const MOVE_ACTIONS := ["move_left", "move_right", "move_up", "move_down"]

## Set by `_mount_production_world()`.
var production: Node = null
var world_node: Node = null
var hero: CharacterBody2D = null
var camera: Camera2D = null
var traversability: RefCounted = null
var waystation_host: Node = null
## True when the Waystation host was mounted because this probe set the product
## flag itself. Every verdict that depends on it says so.
var mounted_under_forced_flag := false
## Where the player actually started, captured at mount. A "return home" claim has
## to come back to this cell, not to a coordinate the probe liked.
var spawn_cell := Vector2i(-1, -1)


# --------------------------------------------------------------------- mounting
## Mount the shipped overworld, then bring it to READY.
##
## `force_waystation` sets `survival/a0_waystation_candidate` before the scene
## builds. That flag is a real production door — A0 reads it in
## `chapter1_overworld.gd` — but the shipped `project.godot` leaves it false, so a
## probe that turns it on is measuring "mounted and broken", never "a player has
## this today". The flag is reported in every affected verdict line.
func _mount_production_world(force_waystation: bool, viewport_size := Vector2i.ZERO) -> Node:
	if viewport_size != Vector2i.ZERO:
		# Headless reports a 0x0 window. A real viewport size is not decoration: the
		# pointer projection (`get_final_transform()`, canvas transform) is built from
		# it, so a degenerate size makes every mouse coordinate meaningless.
		root.size = viewport_size
	if force_waystation:
		if not bool(ProjectSettings.get_setting("survival/a0_waystation_candidate", false)):
			mounted_under_forced_flag = true
		ProjectSettings.set_setting("survival/a0_waystation_candidate", true)
	if not ResourceLoader.exists(WORLD_SCENE):
		_block("the production overworld %s is not in this composition" % WORLD_SCENE)
		return null
	var packed := load(WORLD_SCENE) as PackedScene
	if packed == null:
		_block("the production overworld failed to load")
		return null
	production = packed.instantiate()
	if production == null:
		_block("the production overworld did not instantiate")
		return null
	root.add_child(production)
	mounted_world = production
	var deadline := Time.get_ticks_msec() + 120_000
	while Time.get_ticks_msec() < deadline:
		if production.has_method(&"is_world_ready") and bool(production.call(&"is_world_ready")):
			break
		await process_frame
	if not (production.has_method(&"is_world_ready") and bool(production.call(&"is_world_ready"))):
		# `build_error` is the product's own account of why it stopped. Reporting
		# only "never reached READY" would blame the harness for an owner defect.
		var why := String(production.get(&"build_error"))
		_block(
			"the production overworld never reached READY (build_error=%s, flag_forced=%s)"
			% [why if not why.is_empty() else "none", str(mounted_under_forced_flag)]
		)
		return null
	world_node = production.get(&"world") as Node
	hero = production.get(&"player") as CharacterBody2D
	camera = production.get(&"camera") as Camera2D
	# `OverworldTraversability` is a RefCounted helper, not a Node; casting it to
	# Node yields null and would have made every mount look broken.
	traversability = production.get(&"traversability") as RefCounted
	waystation_host = production.get_node_or_null("WaystationRuntime")
	if hero == null:
		_block("the production world mounted without a player body")
		return null
	if traversability == null:
		_block("the production world mounted without traversability")
		return null
	# Let the first physics frame settle the body on walkable ground.
	await physics_frame
	await physics_frame
	spawn_cell = _hero_cell()
	_note("spawn_cell=%s position=%s" % [str(spawn_cell), str(hero.global_position)])
	return production


## Hold a movement action for a number of physics frames, then release it.
## This is the whole "ordinary input" claim: the Knight integrates its own
## velocity, accelerates, and calls `move_and_slide()`.
func _hold(action: String, frames: int) -> void:
	Input.action_press(action)
	for i in frames:
		await physics_frame
	Input.action_release(action)
	await physics_frame


## Press an action for one frame. Used for `interact`, `build_toggle` and the
## build slot keys, which the production code samples with
## `Input.is_action_just_pressed`.
func _tap(action: String) -> void:
	Input.action_press(action)
	await process_frame
	await physics_frame
	Input.action_release(action)
	await process_frame
	await physics_frame


## Distance the Hero has to cover along one axis at the authored walk speed. The
## frame count is derived from the production speed, not tuned: with 96 px/s at
## 60 Hz a frame covers 1.6 px, and the loop below stops early when it arrives.
func _walk_axis_toward(target: Vector2, tolerance := 2.0, max_frames := 900) -> Dictionary:
	var blocked_frames := 0
	var travelled := 0.0
	for i in max_frames:
		var delta := target - hero.global_position
		if delta.length() <= tolerance:
			return {"ok": true, "frames": i, "blocked_frames": blocked_frames, "moved": travelled}
		var action := ""
		if absf(delta.x) > tolerance * 0.5:
			action = "move_right" if delta.x > 0.0 else "move_left"
		elif absf(delta.y) > tolerance * 0.5:
			action = "move_down" if delta.y > 0.0 else "move_up"
		if action.is_empty():
			return {"ok": true, "frames": i, "blocked_frames": blocked_frames, "moved": travelled}
		Input.action_press(action)
		var before := hero.global_position
		await physics_frame
		var after := hero.global_position
		Input.action_release(action)
		var step := before.distance_to(after)
		travelled += step
		if step < 0.05:
			blocked_frames += 1
			if blocked_frames > 90:
				return {"ok": false, "frames": i, "blocked_frames": blocked_frames, "moved": travelled, "reason": "stuck"}
		else:
			blocked_frames = 0
	return {"ok": false, "frames": max_frames, "blocked_frames": blocked_frames, "moved": travelled, "reason": "timeout"}


## Walk to a point by moving along one axis at a time, which is what a player
## doing a deliberate route does with four directions.
func _walk_to_point(target: Vector2) -> Dictionary:
	var first := await _walk_axis_toward(Vector2(target.x, hero.global_position.y))
	if not bool(first["ok"]):
		return {"ok": false, "axis": "x", "detail": first}
	var second := await _walk_axis_toward(target)
	if not bool(second["ok"]):
		return {"ok": false, "axis": "y", "detail": second}
	return {"ok": true, "frames": int(first["frames"]) + int(second["frames"])}


## Cell the production traversability system reports for the Hero's feet.
func _hero_cell() -> Vector2i:
	if traversability != null and traversability.has_method(&"cell_of"):
		return traversability.call(&"cell_of", hero.global_position) as Vector2i
	return Vector2i(int(floor(hero.global_position.x / 16.0)), int(floor(hero.global_position.y / 16.0)))


## Points the production host says match right now. The host owns the rule
## (`matches_interaction`: exact stand cell plus a 24 px reach), so the probe asks
## it instead of recomputing a distance and calling that agreement.
func _in_range_points() -> Array:
	if waystation_host == null or not waystation_host.has_method(&"matches_interaction"):
		return []
	var found: Array = []
	for child: Node in waystation_host.get_children():
		if bool(waystation_host.call(&"matches_interaction", child, hero)):
			found.append(child)
	return found


## The authored collision bodies the mounted world actually owns.
func _blocker(name_prefix: String) -> StaticBody2D:
	if world_node == null:
		return null
	var blocker_root: Variant = world_node.get(&"blocker_root")
	var parent: Node = blocker_root if blocker_root is Node else world_node
	if parent == null:
		return null
	for child: Node in parent.get_children():
		if String(child.name).begins_with(name_prefix):
			return child as StaticBody2D
	return null


## Named host points by authored id, e.g. "locker", "roadside_02". A0 names the
## nodes with `id.capitalize()` ("Locker", "Roadside 02"), so the id is capitalised
## here rather than the probe hard-coding display names.
func _point(named: String) -> Node:
	if waystation_host == null:
		return null
	return waystation_host.get_node_or_null(NodePath(named.capitalize()))


# ------------------------------------------------------------------ input events
## Push a real mouse motion event, which is what updates the viewport's stored
## pointer position. Without this, `get_global_mouse_position()` keeps whatever
## the platform last reported — in headless that is (0,0).
func _mouse_move_to_world(world_point: Vector2) -> bool:
	if camera == null:
		return false
	var screen := (world_point - camera.get_screen_center_position()) * camera.zoom + Vector2(root.size) * 0.5
	var event := InputEventMouseMotion.new()
	event.position = screen
	event.global_position = screen
	Input.parse_input_event(event)
	await process_frame
	return true


## A real left click at a world point: motion first, then press/release.
func _mouse_click_world(world_point: Vector2) -> Dictionary:
	await _mouse_move_to_world(world_point)
	var screen := (world_point - camera.get_screen_center_position()) * camera.zoom + Vector2(root.size) * 0.5
	var pressed := InputEventMouseButton.new()
	pressed.button_index = MOUSE_BUTTON_LEFT
	pressed.pressed = true
	pressed.position = screen
	pressed.global_position = screen
	Input.parse_input_event(pressed)
	await process_frame
	var released := InputEventMouseButton.new()
	released.button_index = MOUSE_BUTTON_LEFT
	released.pressed = false
	released.position = screen
	released.global_position = screen
	Input.parse_input_event(released)
	await process_frame
	await physics_frame
	return {"screen": screen, "world": world_point}


func _release_all() -> void:
	for action: String in MOVE_ACTIONS:
		Input.action_release(action)
	for action: String in ["interact", "build_toggle", "build_place"]:
		Input.action_release(action)


# ------------------------------------------------------------------- reporting
## Distance between the Hero's feet cell and an authored cell. Reported as data,
## never as the assertion itself.
func _cell_gap(want: Vector2i) -> int:
	var here := _hero_cell()
	return maxi(absi(here.x - want.x), absi(here.y - want.y))


func _hero_state() -> Dictionary:
	var snapshot := _snapshot()
	return {
		"cell": _hero_cell(),
		"position": hero.global_position if hero != null else Vector2.ZERO,
		"inventory_total": int((snapshot.get("inventory", {}) as Dictionary).size()),
		"revision": int(snapshot.get("revision", 0)),
		"receipts": (snapshot.get("applied_transactions", {}) as Dictionary).size(),
	}
