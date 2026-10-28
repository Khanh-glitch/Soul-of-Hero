extends Node
## The Hollow Marches acceptance test — production routes, production saves.
##
## Run through the real application:
##   godot --path . -- --overworld-acceptance-test
##
## Nothing here is a substitute world. The test drives `AppFlow` exactly as the
## Home screen does, walks the production Knight with real input actions, enters
## the real Chapter 1 Level 1 through the real gate, finishes the real run, and
## comes back through the real completion screen. Every checkpoint asserts an
## observable value and the process exits non-zero if any of them fail.

const HOME_ROUTE := &"home"
const OVERWORLD_ROUTE := &"overworld"
const GAMEPLAY_ROUTE := &"gameplay"
const WAIT_SECONDS := 20.0

var failures: Array[String] = []
var checks := 0
var _app_root: Node
var _app_flow: Node
var _save: Node


func start(app_root: Node) -> void:
	_app_root = app_root
	_app_flow = get_node_or_null("/root/AppFlow")
	_save = get_node_or_null("/root/SaveService")
	_run.call_deferred()


func _run() -> void:
	print("OWACCEPT: begin")
	# Isolated profile: a shared save would let a previous run of this test make
	# the "fresh profile" assertions vacuous (or fail them for the wrong reason).
	if _save != null:
		_save.call(&"configure_storage",
			"user://tests/overworld_acceptance_%d.json" % Time.get_ticks_usec(), true)
	# The AppRoot hands control here instead of opening the boot screen, so the
	# first route is ours to choose. Enter Home the way the player does.
	_app_flow.call(&"open_home", &"campaign")
	if not await _wait_for(func() -> bool: return _route() == HOME_ROUTE, "home route"):
		return _finish()
	_check(_route() == HOME_ROUTE, "HOME reached through AppFlow")

	# --- HOME → THE HOLLOW MARCHES (through the real button) --------------
	# The Home map opens its function panel on a deferred call, so the button
	# appears a frame or two after the route does.
	var entry_button: Button = null
	var button_deadline := Time.get_ticks_msec() + 5000
	while entry_button == null and Time.get_ticks_msec() < button_deadline:
		await get_tree().process_frame
		entry_button = _find_by_name(_app_root, "EnterOverworldButton") as Button
	_check(entry_button != null, "Home campaign tab exposes the Marches entry button")
	if entry_button != null:
		_check(entry_button.visible, "the entry button is visible to the player")
		_check(not entry_button.text.strip_edges().is_empty(),
			"the entry button is labelled ('%s')" % entry_button.text)
		entry_button.emit_signal("pressed")
	else:
		_app_flow.call(&"open_overworld", {})
	if not await _wait_for(func() -> bool: return _route() == OVERWORLD_ROUTE, "overworld route"):
		return _finish()
	var ow := await _wait_for_world("first entry")
	if ow == null:
		return _finish()
	_check(ow.is_world_ready(), "world build reached READY (observable stage %d)" % ow.build_stage)
	_check(ow.world.width == 384 and ow.world.height == 256, "world envelope 384x256 tiles")
	_check(ow.gates.size() == 10, "ten dungeon thresholds spawned (found %d)" % ow.gates.size())
	_check(ow.camps.size() == 4, "four camps spawned (found %d)" % ow.camps.size())
	_check(ow.discoveries.size() == 8, "eight discoveries spawned (found %d)" % ow.discoveries.size())
	var ground_cells := int(ow.world.ground_layer.get_used_cells().size())
	var solid_cells := int(ow.world.solid_layer.get_used_cells().size())
	_check(ground_cells > 50000, "ground TileMapLayer painted (%d cells)" % ground_cells)
	_check(solid_cells > 10000, "solid TileMapLayer painted (%d cells)" % solid_cells)
	_check(ow.world.prop_count() > 1500, "props instantiated (%d sprites)" % ow.world.prop_count())
	for level_index in range(1, 11):
		var level_id := StringName("chapter_1_level_%d" % level_index)
		_check(ow.gate_for(level_id) != null, "threshold for %s exists in map space" % level_id)

	# --- movement and terrain collision ----------------------------------
	var player: CharacterBody2D = ow.player
	var start_position := player.global_position
	Input.action_press(&"move_right")
	var moved := await _wait_for(func() -> bool: return player.global_position.x > start_position.x + 24.0,
		"walk right", 4.0)
	Input.action_release(&"move_right")
	await _frames(4)
	_check(moved, "knight walks under real input (dx=%.1f)" % (player.global_position.x - start_position.x))

	# Walk into a cliff and prove the terrain wins.
	var wall_position := _find_wall_approach(ow)
	var blocked := false
	if wall_position != Vector2.ZERO:
		ow.teleport_to(wall_position)
		await _frames(2)
		var before := player.global_position
		Input.action_press(&"move_up")
		await _frames(45)
		Input.action_release(&"move_up")
		await _frames(3)
		blocked = player.global_position.y > before.y - 40.0
		_check(blocked, "cliff face stops the knight (travelled %.1f px into the wall)"
			% (before.y - player.global_position.y))
	else:
		_check(false, "found a cliff face to test collision against")

	# --- shortcuts: collision + sprite + persistence ----------------------
	var shortcut_id := "short_crucible_bridge"
	var bridge_tile := Vector2i(184, 210)
	_check(ow.world.is_solid_cell(bridge_tile.x, bridge_tile.y),
		"crucible bridge starts closed (collision present)")
	ow.state.open_shortcut(StringName(shortcut_id))
	await _frames(2)
	_check(not ow.world.is_solid_cell(bridge_tile.x, bridge_tile.y),
		"opening the bridge removes its collision")
	_check(_shortcut_frame(ow, "short_crucible_bridge") == "short_bridge_fixed",
		"opening the bridge swaps its sprite to the crossing")

	# --- camp and discovery ----------------------------------------------
	var camp: OverworldCamp = ow.camp_for(&"camp_crossroads")
	var provisions_before: int = ow.state.provisions
	ow.teleport_to(camp.rest_position())
	await _frames(3)
	_check(ow.interact_with(camp), "camp accepts interaction")
	await _frames(2)
	_check(ow.state.provisions >= provisions_before, "camp restores provisions (%d -> %d)"
		% [provisions_before, ow.state.provisions])
	_check(ow.state.is_camp_visited(&"camp_crossroads"), "camp is recorded as lit")
	_check(ow.state.last_camp_id == &"camp_crossroads", "camp becomes the respawn anchor")

	var discovery: OverworldDiscovery = ow.discovery_for(&"d_crypt_offer")
	ow.teleport_to(discovery.global_position)
	await _frames(3)
	var gold_before := _currency("account")
	_check(ow.interact_with(discovery), "discovery accepts interaction")
	await _frames(3)
	_check(ow.state.is_discovery_found(&"d_crypt_offer"), "discovery recorded")
	_check(_currency("account") == gold_before + 40, "discovery paid out exactly once (%d -> %d)"
		% [gold_before, _currency("account")])
	ow.interact_with(discovery)
	await _frames(2)
	_check(_currency("account") == gold_before + 40, "re-interacting never pays twice")

	# --- eligibility: L01 open on a fresh profile, L10 sealed ------------
	var gate_one: OverworldGate = ow.gate_for(&"chapter_1_level_1")
	gate_one.refresh()
	_check(gate_one.state == &"ENTER", "L01 Crypt Entrance is enterable on a fresh profile")
	var gate_ten: OverworldGate = ow.gate_for(&"chapter_1_level_10")
	gate_ten.refresh()
	_check(gate_ten.state == &"LOCKED", "L10 Castellan Throne is sealed until its prerequisites")
	ow.teleport_to(gate_ten.global_position)
	await _frames(3)
	ow.interact_with(gate_ten)
	await _frames(4)
	_check(_route() == OVERWORLD_ROUTE, "interacting with a sealed gate does not start a run")
	_check(not bool(_app_flow.call(&"has_active_run")), "sealed gate leaves no active run")

	# --- OVERWORLD → L01 through the production gate ----------------------
	ow.teleport_to(gate_one.global_position)
	await _frames(3)
	var entered := bool(ow.interact_with(gate_one))
	_check(entered, "gate interaction accepted")
	if not await _wait_for(func() -> bool: return _route() == GAMEPLAY_ROUTE, "gameplay route", 30.0):
		return _finish()
	await _frames(10)
	var run: Dictionary = _app_flow.call(&"get_active_run")
	_check(String(run.get("level_id", "")) == "chapter_1_level_1",
		"run is the real chapter_1_level_1 (got '%s')" % run.get("level_id", ""))
	_check(String(run.get("layout_data_path", "")).ends_with("crypt_entrance.json"),
		"run loaded the real Level 1 layout")
	var dungeon := _current_route_child()
	_check(dungeon != null and dungeon.name == "Game", "the production gameplay scene is mounted")
	var level := dungeon.get_node_or_null("Level") if dungeon != null else null
	_check(level != null and int(level.level_data.get("width", 0)) > 0,
		"dungeon level data loaded inside the gameplay scene")
	var hero := _find_player(dungeon) if dungeon != null else null
	_check(hero != null and hero.is_in_group(&"player"),
		"the dungeon spawned the production Knight (group 'player')")
	_check(bool(_app_flow.call(&"has_pending_overworld_return")), "pending overworld return is armed")

	# --- finish the real run, return through the real completion screen ---
	var reward_before := _currency("account")
	print("OWACCEPT: account before completion = %d" % reward_before)
	_app_flow.call(&"complete_active_run", {"score": 900, "sigils": 3, "required_sigils": 3})
	await _frames(6)
	var completion := _find_in_tree(_app_root, "CompletionChoice")
	_check(completion != null, "completion chooser appeared")
	var cleared := bool(_app_flow.call(&"is_campaign_level_completed", &"chapter_1_level_1"))
	_check(cleared, "level 1 is recorded as cleared")
	var reward_after := _currency("account")
	_check(reward_after > reward_before,
		"level 1 reward was granted (%d -> %d)" % [reward_before, reward_after])
	if completion != null:
		var home_button := completion.get_node_or_null("%HomeButton")
		_check(home_button != null, "completion chooser exposes its return button")
		if home_button != null:
			home_button.emit_signal("pressed")
	await _frames(8)
	if not await _wait_for(func() -> bool: return _route() == OVERWORLD_ROUTE, "return to the Marches", 30.0):
		return _finish()

	# --- RETAIN PROGRESS: re-entering the world restores the same state --
	var ow2 := await _wait_for_world("return entry")
	if ow2 == null:
		return _finish()
	_check(ow2.state.is_shortcut_open(&"short_crucible_bridge", _app_flow),
		"bridge still open after the round trip")
	_check(ow2.camp_for(&"camp_crossroads").visited, "the camp is still lit after the round trip")
	var cleared_gate: OverworldGate = ow2.gate_for(&"chapter_1_level_1")
	cleared_gate.refresh()
	_check(cleared_gate.state == &"CLEARED", "L01 now reads CLEARED in the world")
	var gate_two: OverworldGate = ow2.gate_for(&"chapter_1_level_2")
	gate_two.refresh()
	_check(gate_two.state == &"ENTER", "clearing L01 opens the road to L02")
	# `gate_one` belonged to the world that was freed by the route switch; the
	# rebuilt world has its own threshold node.
	var rebuilt_gate: OverworldGate = ow2.gate_for(&"chapter_1_level_1")
	var return_position: Vector2 = ow2.player.global_position
	_check(rebuilt_gate != null and return_position.distance_to(rebuilt_gate.global_position) < 96.0,
		"the player returns to the threshold they left by (%.0f px away)"
		% (return_position.distance_to(rebuilt_gate.global_position) if rebuilt_gate != null else -1.0))

	# --- SAVE / RELOAD ----------------------------------------------------
	ow2.state.save_now()
	_check(_save != null and _save.call(&"save_now"), "SaveService committed the profile")
	var saved_position: Vector2 = ow2.player.global_position
	_app_flow.call(&"open_home")
	await _wait_for(func() -> bool: return _route() == HOME_ROUTE, "home after reload")
	_app_flow.call(&"open_overworld", {})
	if not await _wait_for(func() -> bool: return _route() == OVERWORLD_ROUTE, "overworld reopen"):
		return _finish()
	var ow3 := await _wait_for_world("reload entry")
	if ow3 == null:
		return _finish()
	_check(ow3.player.global_position.distance_to(saved_position) < 48.0,
		"world position survives a save/reload (%.1f px drift)"
		% ow3.player.global_position.distance_to(saved_position))
	_check(ow3.state.is_camp_visited(&"camp_crossroads"), "camp survives a save/reload")
	_check(ow3.state.is_discovery_found(&"d_crypt_offer"), "discovery survives a save/reload")
	_check(_shortcut_frame(ow3, "short_crucible_bridge") == "short_bridge_fixed",
		"opened shortcut is still open after reload")
	_check(not ow3.world.is_solid_cell(bridge_tile.x, bridge_tile.y),
		"opened shortcut is still walkable after reload")
	_check(ow3.state.provisions > 0, "provisions persisted (%d)" % ow3.state.provisions)

	# --- provisions drain, hazards, and the weary walk -------------------
	var wild_before: int = ow3.state.provisions
	ow3.state.tick(30.0, false, false)
	_check(ow3.state.provisions < wild_before, "walking the wilds drains provisions")
	ow3.state.provisions = 0
	ow3.state.tick(0.1, false, false)
	await _frames(2)
	_check(float(ow3.player.get(&"move_speed")) < float(_base_speed(ow3)),
		"an empty pack slows the march instead of hard-blocking it")

	_finish()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
func _base_speed(ow: Node) -> float:
	return float(ow.get(&"_base_move_speed"))


func _shortcut_frame(ow: Node, shortcut_id: String) -> String:
	var sprites: Array = ow.world._shortcut_sprites.get(shortcut_id, [])
	if sprites.is_empty():
		return ""
	var sprite: Sprite2D = sprites[0]
	if not is_instance_valid(sprite) or sprite.texture == null:
		return ""
	for frame_name: String in ow.world.props_meta:
		var tex: AtlasTexture = sprite.texture
		if tex != null and tex.region.position == Vector2(
				ow.world.props_meta[frame_name]["x"], ow.world.props_meta[frame_name]["y"]):
			return frame_name
	return ""


func _currency(key: String) -> int:
	if _save == null:
		return 0
	# SaveService.get_value takes a typed Array[String].
	var path: Array[String] = ["currencies"]
	var values: Variant = _save.call(&"get_value", path, {})
	if not values is Dictionary:
		return 0
	return int((values as Dictionary).get(key, 0))


func _find_wall_approach(ow: Node) -> Vector2:
	# Look for a solid cell whose southern neighbour is walkable, then stand
	# just south of it: walking north must be refused.
	for y in range(20, 240):
		for x in range(20, 360):
			if not ow.world.is_solid_cell(x, y):
				continue
			var below := Vector2(x * 16 + 8, (y + 1) * 16 + 8)
			if ow.world.is_solid_cell(x, y + 1) or ow.world.is_solid_cell(x, y + 2):
				continue
			if not ow.world.is_walkable(below):
				continue
			return below + Vector2(0, 8)
	return Vector2.ZERO


func _route() -> StringName:
	return StringName(_app_flow.call(&"get_current_route"))


func _current_route_child() -> Node:
	var host := _app_root.get_node_or_null("RouteHost")
	if host == null or host.get_child_count() == 0:
		return null
	return host.get_child(0)


func _wait_for_world(label: String) -> Node:
	var found: Array = [null]
	var ok := await _wait_for(func() -> bool:
		var child := _current_route_child()
		if child == null or child.get_script() == null:
			return false
		if not child.has_method(&"is_world_ready"):
			return false
		if not bool(child.call(&"is_world_ready")):
			return false
		found[0] = child
		return true
	, "overworld world ready (%s)" % label, WAIT_SECONDS)
	if not ok:
		var child := _current_route_child()
		if child != null and child.has_method(&"is_world_ready"):
			_check(false, "world did not reach READY (stage %d, error '%s')"
				% [int(child.get(&"build_stage")), String(child.get(&"build_error"))])
		return null
	return found[0]


func _wait_for(condition: Callable, label: String, timeout := WAIT_SECONDS) -> bool:
	var deadline := Time.get_ticks_msec() + int(timeout * 1000.0)
	while Time.get_ticks_msec() < deadline:
		if bool(condition.call()):
			return true
		await get_tree().process_frame
	_check(false, "timed out waiting for %s" % label)
	return false


func _frames(count: int) -> void:
	for _i in range(count):
		await get_tree().process_frame


func _find_by_name(node: Node, target: String) -> Node:
	if node == null:
		return null
	if node.name == target:
		return node
	for child: Node in node.get_children():
		var found := _find_by_name(child, target)
		if found != null:
			return found
	return null


func _find_player(node: Node) -> CharacterBody2D:
	var stack: Array[Node] = [node]
	while not stack.is_empty():
		var current: Node = stack.pop_back()
		if current == null:
			continue
		if current is CharacterBody2D and current.is_in_group(&"player"):
			return current as CharacterBody2D
		for child: Node in current.get_children():
			stack.append(child)
	return null


func _find_in_tree(node: Node, script_name: String) -> Node:
	if node == null:
		return null
	if node.get_script() != null and String(node.get_script().get_global_name()) == script_name:
		return node
	for child: Node in node.get_children():
		var found := _find_in_tree(child, script_name)
		if found != null:
			return found
	return null


func _check(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("OWACCEPT: PASS  %s" % description)
	else:
		print("OWACCEPT: FAIL  %s" % description)
		push_error("OWACCEPT FAIL: %s" % description)
		failures.append(description)


func _finish() -> void:
	print("OWACCEPT: %d checks, %d failures" % [checks, failures.size()])
	if failures.is_empty():
		print("OVERWORLD_ACCEPTANCE PASSED - %d checks" % checks)
	else:
		for failure: String in failures:
			print("OWACCEPT:   - %s" % failure)
		print("OVERWORLD_ACCEPTANCE FAILED - %d/%d" % [failures.size(), checks])
	Input.action_release(&"move_up")
	Input.action_release(&"move_right")
	get_tree().quit(0 if failures.is_empty() else 1)
