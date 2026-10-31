extends Node

## Native visual-capture driver for the A6 avatar integration.
##
## Drives the real product routes (title -> New Game -> identity choice -> Home ->
## overworld) with the production Knight and saves full-frame renders so a human
## can inspect sprite sharpness, animation continuity, HUD visibility and VFX
## contrast at a given resolution. Nothing is mocked and no sprite sheet is
## exported; only whole rendered frames are written.
##
## Usage (after `--`):
##   --avatar-visual-capture --avatar-gender=male|female
##   --capture-dir=<absolute directory> [--capture-tag=male_720p]

const OVERWORLD_ROUTE := &"overworld"
const HOME_ROUTE := &"home"
const DEATH_HOLD_SECONDS := 1.6
## A held directional input must move the actor at least this far, or the frame is
## not a walk and the capture fails instead of publishing a misleading picture.
const MIN_WALK_DISPLACEMENT := 4.0

var _app_root: Node
var _phase := "full"
## Exercise the whole capture journey without a renderer. CI has a display, so
## this mode exists to prove the driving flow (routes, clips, death, respawn)
## on a headless machine before looking at pixels.
var _dry_run := false
var _frames: Array[Dictionary] = []
var _gender := "male"
var _capture_dir := ""
var _tag := "capture"
var _index := 0
var _failures: Array[String] = []
var _knight: Node = null


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	_gender = _argument_value(args, "--avatar-gender", "male")
	_capture_dir = _argument_value(args, "--capture-dir", "user://captures")
	_tag = _argument_value(args, "--capture-tag", "%s" % _gender)
	_phase = _argument_value(args, "--avatar-phase", "full")
	_dry_run = args.has("--capture-dry-run")
	var absolute_dir := _capture_dir if _capture_dir.is_absolute_path() else ProjectSettings.globalize_path(_capture_dir)
	DirAccess.make_dir_recursive_absolute(absolute_dir)
	print("A6 CAPTURE: dir=%s tag=%s gender=%s viewport=%s" % [
		absolute_dir, _tag, _gender, str(get_viewport().get_visible_rect().size),
	])
	await _capture("01_title")
	if not await _wait_for_route(&"title", 15000):
		_fail("title route")
		return _finish()
	if _phase == "continue":
		await _run_continue_phase()
		return _finish()
	var title := _current_screen()
	var new_game_button := title.find_child("NewGameButton", true, false) as Button if title != null else null
	if new_game_button == null:
		_fail("NewGameButton")
		return _finish()
	new_game_button.pressed.emit()
	if not await _wait_for_route(&"avatar_choice", 8000):
		_fail("avatar_choice route")
		return _finish()
	await _wait_frames(8)
	await _capture("02_identity_choice")
	var choice := _current_screen()
	var button_name := "MaleButton" if _gender == "male" else "FemaleButton"
	var identity_button := choice.find_child(button_name, true, false) as Button if choice != null else null
	if identity_button == null:
		_fail("identity button")
		return _finish()
	identity_button.pressed.emit()
	if not await _wait_for_route(HOME_ROUTE, 8000):
		_fail("home route")
		return _finish()
	await _wait_frames(20)
	await _capture("03_home_avatar_idle")
	Input.action_press(&"move_left")
	await _wait_frames(14)
	await _capture("04_home_avatar_walk")
	Input.action_release(&"move_left")
	await _wait_frames(6)

	AppFlow.open_overworld()
	if not await _wait_for_route(OVERWORLD_ROUTE, 15000):
		_fail("overworld route")
		return _finish()
	await _wait_frames(30)
	_knight = _find_player()
	if _knight == null:
		_fail("player actor")
		return _finish()
	await _capture("05_overworld_avatar_idle")
	Input.action_press(&"move_right")
	for index in range(3):
		await _wait_frames(7)
		await _capture("06_overworld_walk_%d" % (index + 1))
	Input.action_release(&"move_right")
	await _wait_frames(6)
	Input.action_press(&"attack")
	await _wait_frames(3)
	Input.action_release(&"attack")
	await _wait_frames(3)
	await _capture("07_overworld_attack_1")
	await _wait_frames(5)
	await _capture("07_overworld_attack_2")
	await _wait_frames(24)
	_take_damage(6)
	await _wait_frames(4)
	await _capture("08_overworld_hurt")
	await _wait_frames(20)
	_take_damage(999999)
	await _wait_frames(10)
	await _capture("09_overworld_death")
	await get_tree().create_timer(DEATH_HOLD_SECONDS).timeout
	await _capture("09_overworld_death_hold")
	if _knight != null and _knight.has_method(&"respawn"):
		_knight.call(&"respawn")
	await _wait_frames(10)
	await _capture("10_overworld_respawn")
	_finish()


## Second, independent process: the freshly booted game must restore the chosen
## character from A0's save on Continue, and the restored avatar must animate.
func _run_continue_phase() -> void:
	var title := _current_screen()
	var continue_button := title.find_child("ContinueButton", true, false) as Button if title != null else null
	if continue_button == null:
		_fail("ContinueButton")
		return
	continue_button.pressed.emit()
	if not await _wait_for_route(HOME_ROUTE, 10000):
		_fail("continue -> home route")
		return
	await _wait_frames(20)
	var home_player := _find_avatar_host(_current_screen())
	if home_player == null:
		_fail("restored Home actor")
		return
	var home_state := _presenter_state(home_player)
	await _capture("20_continue_home_idle")
	await _walk_and_capture("21_continue_home_walk", home_player)
	AppFlow.open_overworld()
	if not await _wait_for_route(OVERWORLD_ROUTE, 20000):
		_fail("continue -> overworld route")
		return
	await _wait_frames(40)
	_knight = _find_player()
	if _knight == null:
		_fail("restored overworld player")
		return
	# A0 keeps a pending death across processes: the reload restores the corpse AND
	# the death card the previous process opened. Recovering by respawning the actor
	# directly leaves that card on screen, and because it is registered as a gameplay
	# modal, A0's input gate then suppresses every movement press for the rest of the
	# run - the frame looks like a broken character when the harness is what is wrong.
	await _answer_death_card()
	if bool(_knight.get("dead")):
		var survival := get_tree().root.get_node_or_null(^"SurvivalService")
		if survival != null and survival.has_method(&"finish_overworld_death"):
			survival.call(&"finish_overworld_death", _knight.get(&"global_position"))
		_knight.call(&"respawn", _knight.get(&"global_position"))
		await _wait_frames(14)
		await _answer_death_card()
	var player_state := _presenter_state(_knight)
	await _capture("22_continue_overworld_idle")
	# The card can appear one or two frames after the route settles, so settle again
	# immediately before the press rather than trusting an earlier look.
	await _answer_death_card()
	await _walk_and_capture("23_continue_overworld_walk", _knight)
	await _wait_frames(30)
	await _capture("24_continue_overworld_idle_after_walk")
	var restored_gender := String(player_state.get("gender", ""))
	if restored_gender != _gender:
		_fail("restored identity is %s, expected %s" % [restored_gender, _gender])
	if String(player_state.get("status", "")) != "READY":
		_fail("restored avatar is not presented (%s)" % String(player_state.get("status", "")))
	print("A6 CAPTURE: continue phase restored %s (home=%s overworld=%s)" % [
		restored_gender,
		String(home_state.get("status", "")),
		String(player_state.get("status", "")),
	])


func _presenter_state(host: Node) -> Dictionary:
	var presenter := host.get_node_or_null(^"AvatarPresenter")
	if presenter == null or not presenter.has_method(&"get_presentation_state"):
		return {}
	return presenter.call(&"get_presentation_state")


func _take_damage(amount: int) -> void:
	if _knight == null:
		return
	_knight.set(&"invulnerability_remaining", 0.0)
	_knight.call(&"take_damage", amount, _knight.get(&"global_position") + Vector2(16, 0))


func _find_avatar_host(root: Node) -> Node:
	if root == null:
		return null
	for candidate: Node in root.find_children("*", "CharacterBody2D", true, false):
		if candidate.get_node_or_null(^"AvatarPresenter") != null:
			return candidate
	return null


## Answers A0's pending-death card if it is up, through the card's own button. Waits
## for the card to settle first, because A0 opens it a frame or two after the route
## appears and checking once is how a harness lies to itself.
## Returns true when no card is left on screen.
func _answer_death_card() -> bool:
	for _attempt in range(3):
		await _wait_frames(6)
		var death_card := _death_card()
		if death_card == null or not death_card.is_visible_in_tree():
			return true
		print("A6 CAPTURE: A0's pending-death card is up; answering it through the card")
		var answer := death_card.find_child("Respawn", true, false) as Button
		if answer == null:
			_fail("pending-death card has no answer button")
			return false
		answer.pressed.emit()
		await _wait_frames(20)
	var remaining := _death_card()
	if remaining != null and remaining.is_visible_in_tree():
		_fail("pending-death card stayed visible after the player answered it")
		return false
	return true


func _death_card() -> CanvasItem:
	var overworld := _overworld_of(_knight) if is_instance_valid(_knight) else null
	if overworld == null:
		overworld = _current_screen()
	if overworld == null:
		return null
	# The card is a child of the HUD CanvasLayer, not of the overworld root, so this
	# has to search rather than take a direct path.
	return overworld.find_child("OverworldDeath", true, false) as CanvasItem


## The overworld that owns this actor, found by walking up to the node that carries
## the HUD. Used to reach the death card the way a player does.
func _overworld_of(actor: Node) -> Node:
	var node := actor
	while node != null:
		# Ask the property list rather than get(): reading an undeclared property is
		# an error in Godot, and most nodes on the way up have no `hud`.
		for entry: Dictionary in node.get_property_list():
			if String(entry.get("name", "")) == "hud" and node.get("hud") != null:
				return node
		node = node.get_parent()
	return null


func _find_player() -> Node:
	var players := get_tree().get_nodes_in_group(&"player")
	for candidate: Node in players:
		if candidate.has_method(&"take_damage"):
			return candidate
	return null


func _capture(label: String) -> void:
	await _wait_frames(2)
	if _dry_run:
		_index += 1
		var host: Node = _knight if is_instance_valid(_knight) else _find_avatar_host(_current_screen())
		var dry_state := _presenter_state(host) if host != null else {}
		print("A6 CAPTURE(dry): %02d %s status=%s action=%s/%s" % [
			_index, label, String(dry_state.get("status", "n/a")),
			String(dry_state.get("action", "n/a")), String(dry_state.get("direction", "n/a")),
		])
		return
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_index += 1
	var file_name := "%s_%02d_%s.png" % [_tag, _index, label]
	var path := _capture_dir.path_join(file_name)
	if not _capture_dir.is_absolute_path():
		path = ProjectSettings.globalize_path(path)
	var error := image.save_png(path)
	if error != OK:
		_fail("saved %s (%d)" % [file_name, error])
		return
	var evidence := {
		"file": file_name,
		"label": label,
		"width": image.get_width(),
		"height": image.get_height(),
		"route": String(_app_root.call(&"get_current_route")) if is_instance_valid(_app_root) else "",
	}
	var host: Node = _knight if is_instance_valid(_knight) else _find_avatar_host(_current_screen())
	evidence["motion"] = _motion_of(host)
	var state := _presenter_state(host) if host != null else {}
	if not state.is_empty():
		evidence["avatar"] = {
			"status": String(state.get("status", "")),
			"gender": String(state.get("gender", "")),
			"action": String(state.get("action", "")),
			"direction": String(state.get("direction", "")),
			"appearance_gate": String(state.get("appearance_gate", "")),
		}
	_frames.append(evidence)
	print("A6 CAPTURE: wrote %s (%dx%d)" % [path, image.get_width(), image.get_height()])


## A frame labelled "walk" proven nothing unless the actor actually moved. This
## records what the character is doing - position, velocity and whether the input is
## visible to the world at all - so a still frame says whether the harness, the input
## gate or the animation is the one that failed.
func _motion_of(host: Node) -> Dictionary:
	if host == null or not is_instance_valid(host):
		return {}
	var body := host as Node2D
	if body == null:
		return {}
	var out := {
		"position": [body.global_position.x, body.global_position.y],
		"input_pressed": Input.is_action_pressed(&"move_right"),
	}
	if body is CharacterBody2D:
		var velocity := (body as CharacterBody2D).velocity
		out["velocity"] = [velocity.x, velocity.y]
	return out


## Walks the actor and asserts it really displaced. The home actor lives inside an
## authored movement bound, so pressing toward that bound is correct gameplay and a
## perfectly still frame: the harness has to walk where there is room rather than
## declare the character broken. Returns true when a frame was captured while the
## actor was moving.
func _walk_and_capture(label: String, host: Node) -> bool:
	if host == null or not is_instance_valid(host):
		_fail("%s: no actor to walk" % label)
		return false
	var last_detail := ""
	for action: StringName in [&"move_right", &"move_left"]:
		var from := (host as Node2D).global_position
		Input.action_press(action)
		await _wait_frames(14)
		var moved := ((host as Node2D).global_position - from).length()
		await _capture(label)
		Input.action_release(action)
		if moved >= MIN_WALK_DISPLACEMENT:
			print("A6 CAPTURE: %s displaced %.1f px via %s" % [label, moved, action])
			return true
		last_detail += " [%s moved %.2f px]" % [action, moved]
		# Read-only: what A0's own actor says about why it cannot move. A failed
		# walk is worth nothing to the owner without these four facts.
		last_detail += " {%s}" % _actor_diagnosis(host)
		await _wait_frames(6)
	_fail("%s: walked neither direction (needs %.1f px)%s permitted=%s modals=%s "
		+ "velocity=%s route=%s dead=%s"
		% [label, MIN_WALK_DISPLACEMENT, last_detail,
			str(_gate_permits()),
			str(_visible_modals()),
			str((host as CharacterBody2D).velocity) if host is CharacterBody2D else "n/a",
			str(_app_root.call(&"get_current_route")) if is_instance_valid(_app_root) else "",
			str(host.get(&"dead"))])
	return false


## Dense, decisive state of A0's home actor, read without changing it. The four
## candidates for "velocity set, position pinned" are a collapsed movement bound, a
## refused walkability candidate, a disabled control set, and a live slide collision.
## Naming which ones are actually true is the difference between a handoff and a guess.
func _actor_diagnosis(host: Node) -> String:
	var bounds: Variant = host.get(&"_movement_bounds")
	var bounds_text := "none"
	if bounds is Rect2:
		var rect: Rect2 = bounds
		bounds_text = "%d,%d %dx%d%s" % [int(rect.position.x), int(rect.position.y),
			int(rect.size.x), int(rect.size.y), " collapsed" if rect.size.x <= 1.0 else ""]
	var test: Variant = host.get(&"_walkability_test")
	var walkability := "none"
	if test is Callable:
		walkability = "on" if (test as Callable).is_valid() else "dead"
	var collisions := "0"
	if host is CharacterBody2D:
		var body: CharacterBody2D = host
		var count := body.get_slide_collision_count()
		if count > 0:
			var first := body.get_slide_collision(0)
			var collider := first.get_collider()
			collisions = "%d:%s" % [count, String(collider.name) if collider else "?"]
	return "bounds=%s controls=%s walkable=%s auto=%s slides=%s" % [
		bounds_text, str(host.get(&"controls_enabled")), walkability,
		str(host.call(&"is_auto_moving")) if host.has_method(&"is_auto_moving") else "?",
		collisions,
	]


## Whether A0's gameplay gate would let a movement action through right now. A gate
## that latched the press under a modal keeps the actor still while the key is held.
func _gate_permits() -> String:
	var gate := get_tree().root.get_node_or_null(^"GameplayInputGate")
	if gate == null:
		for node: Node in get_tree().root.find_children("*", "", true, false):
			if node.has_method(&"permits"):
				gate = node
				break
	if gate == null or not gate.has_method(&"permits"):
		return "no-gate"
	return str(gate.call(&"permits", &"move_right"))


## The nodes A0's gate is actually consulting. A refused press names its blocker
## instead of leaving the next run to guess between a latch and a stale modal.
func _visible_modals() -> Array[String]:
	var out: Array[String] = []
	for node: Node in get_tree().get_nodes_in_group(&"gameplay_modal"):
		if node is CanvasItem and (node as CanvasItem).is_visible_in_tree():
			out.append(String(node.name))
	return out


func _wait_for_route(route_id: StringName, timeout_msec := 6000) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_msec
	while Time.get_ticks_msec() < deadline:
		if is_instance_valid(_app_root) and StringName(_app_root.call(&"get_current_route")) == route_id:
			await get_tree().process_frame
			return true
		await get_tree().create_timer(0.02).timeout
	return false


func _wait_frames(count: int) -> void:
	for _index_frame in range(count):
		await get_tree().process_frame


func _current_screen() -> Node:
	if not is_instance_valid(_app_root):
		return null
	var host := _app_root.get_node_or_null(^"RouteHost")
	return host.get_child(0) if host != null and host.get_child_count() == 1 else null


func _argument_value(args: PackedStringArray, key: String, fallback: String) -> String:
	for argument: String in args:
		if argument.begins_with(key + "="):
			return argument.substr((key + "=").length()).strip_edges()
	return fallback


func _fail(label: String) -> void:
	_failures.append(label)
	push_error("A6 CAPTURE FAIL: %s" % label)
	# GitHub renders `::error::` lines from stdout as annotations. Job logs cannot be
	# downloaded from the review sandbox, so a failure that only reaches stderr is a
	# failure nobody can read; this puts the reason where it can be seen.
	print("::error::A6 CAPTURE FAIL: %s" % label)


func _finish() -> void:
	var manifest_path := _capture_dir.path_join("%s_frames.json" % _tag)
	if not _capture_dir.is_absolute_path():
		manifest_path = ProjectSettings.globalize_path(manifest_path)
	var handle := FileAccess.open(manifest_path, FileAccess.WRITE)
	if handle != null:
		handle.store_string(JSON.stringify({
			"schema": "soh.a6.visual_capture.v1",
			"tag": _tag,
			"phase": _phase,
			"gender": _gender,
			"engine": Engine.get_version_info().get("string", ""),
			"frames": _frames,
			"failures": _failures,
		}, "  ", false))
		handle.close()
		print("A6 CAPTURE: manifest %s (%d frames)" % [manifest_path, _frames.size()])
	if _failures.is_empty():
		print("A6 VISUAL CAPTURE COMPLETE — %d frames" % _index)
		get_tree().quit(0)
	else:
		print("A6 VISUAL CAPTURE INCOMPLETE — %d failures" % _failures.size())
		get_tree().quit(1)
