extends SceneTree

const LOGICAL_VIEWPORT_SIZE := Vector2(640.0, 360.0)
const HOME_WORLD_SIZE := Vector2(1200.0, 1200.0)

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.size = Vector2i(640, 360)
	var packed := load("res://game/ui/screens/home/home_map_screen.tscn") as PackedScene
	var home := packed.instantiate() as Control
	root.add_child(home)
	await process_frame
	await process_frame
	_check_home_map(home)
	_check_camera_scroll(home)
	_check_pointer_navigation(home)
	await _check_navigation_resize(home)
	for function_id: StringName in [&"campaign", &"hero_roster", &"modes", &"bestiary", &"settings"]:
		home.call("open_function", function_id)
		await process_frame
		await process_frame
		_check_function_overlay(home, function_id)
		home.call("close_function")
		await process_frame
	home.free()

	var hud := (load("res://game/ui/HUD.tscn") as PackedScene).instantiate()
	root.add_child(hud)
	await process_frame
	var hud_root := hud.get_node("HUDRoot") as Control
	for node_path: String in ["TopLeftPanel", "ObjectivePanel", "TopRightPanel", "PauseButton", "WeaponPanel"]:
		var control := hud_root.get_node(node_path) as Control
		_expect(_inside(control.get_rect(), Rect2(Vector2.ZERO, Vector2(640, 360))), "HUD %s stays inside 640x360 (%s)" % [node_path, control.get_rect()])
	_expect(hud_root.get_node("TopLeftPanel") is MarginContainer, "desktop resources use a compact panel-free margin layout")
	_expect(hud_root.get_node("ObjectivePanel") is MarginContainer, "desktop objective uses raw outlined text without a backing panel")
	_expect(not (hud_root.get_node("TopRightPanel") as Control).visible, "obsolete top-right telemetry panel stays removed")
	_expect(not (hud_root.get_node("WeaponPanel/WeaponMargin/WeaponRows/ActionDeck") as Control).visible, "obsolete four-card status deck stays removed")
	_expect(not (hud_root.get_node("WeaponPanel") as Control).visible, "bottom combo/weapon strip stays removed on desktop")
	var pause_button := hud_root.get_node("PauseButton") as Button
	var codex_button := hud_root.find_child("CodexButton", true, false) as Button
	_expect(
		codex_button != null and pause_button.size.is_equal_approx(codex_button.size),
		"Pause and Codex use balanced authored button dimensions",
	)
	if OS.get_environment("GODOT_FORCE_TOUCH_CONTROLS") == "1":
		var virtual_controls := hud_root.get_node("VirtualControls") as Control
		_expect(virtual_controls.visible, "mobile virtual controls are visible")
		_expect(not (hud_root.get_node("WeaponPanel") as Control).visible, "mobile hides the duplicate desktop action deck")
		for node_path: String in ["InteractButton", "LightAttackButton", "HeavyAttackButton", "JumpButton", "DashButton"]:
			var button := virtual_controls.get_node(node_path) as Button
			_expect(button.visible and _inside(button.get_rect(), Rect2(Vector2.ZERO, Vector2(640, 360))), "mobile %s is visible and inside viewport" % node_path)
		var primary_size := (virtual_controls.get_node("LightAttackButton") as Button).size
		for node_path: String in ["InteractButton", "HeavyAttackButton", "JumpButton"]:
			_expect((virtual_controls.get_node(node_path) as Button).size.is_equal_approx(primary_size), "mobile %s matches the primary 2x2 action grid" % node_path)
	hud.call("_show_toast", "Nhấn chuột trái để mở rương")
	await process_frame
	var toast_prompt := hud_root.get_node("ToastPanel/ToastMargin/ToastRow/Prompt") as TextureRect
	var toast_label := hud_root.get_node("ToastPanel/ToastMargin/ToastRow/ToastLabel") as Label
	if OS.get_environment("GODOT_FORCE_TOUCH_CONTROLS") == "1":
		_expect(not toast_prompt.visible and toast_label.text.begins_with("DÙNG"), "mobile interaction toast uses the touch action")
	else:
		_expect(toast_prompt.visible and toast_prompt.texture is AtlasTexture, "desktop interaction toast uses the Kenney left-mouse prompt")
	hud.free()

	if _failures.is_empty():
		print("UI RESPONSIVE TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("UI RESPONSIVE FAIL: %s" % failure)
		quit(1)


func _check_home_map(home: Control) -> void:
	var viewport_bounds := Rect2(Vector2.ZERO, LOGICAL_VIEWPORT_SIZE)
	var world_bounds := Rect2(Vector2.ZERO, HOME_WORLD_SIZE)
	var world_scale := float(home.call("get_world_scale"))
	var world_root := home.get_node_or_null("%WorldRoot") as Node2D
	var map_world := home.get_node_or_null("%MapWorld") as Node2D
	var map_bounds := home.get_global_rect()
	_expect(_inside(map_bounds, viewport_bounds), "Home Map root stays inside 640x360 (%s)" % map_bounds)
	_expect(world_root != null, "Home Map exposes the scrolling WorldRoot")
	_expect(map_world != null and map_world.get_parent() == world_root, "Home Map canvas belongs to WorldRoot")
	_expect(home.call("get_world_size") == HOME_WORLD_SIZE, "Home Map preserves the 1200x1200 Cainos demo overview")
	_expect(is_equal_approx(world_scale, 1.25), "Home Map uses the authored 1.25 close gameplay scale")
	if world_root == null or map_world == null:
		return
	var scrolled_world_bounds := Rect2(world_root.position, HOME_WORLD_SIZE * world_scale)
	_expect(_inside(viewport_bounds, scrolled_world_bounds), "the scrolled 1200x1200 world covers the 640x360 viewport")
	_expect(world_root.position != Vector2.ZERO, "Home Map starts at a meaningful camera offset")
	var player_sprite := home.get_node_or_null("%Player/Sprite") as AnimatedSprite2D
	_expect(
		player_sprite != null
			and is_equal_approx(player_sprite.scale.x * world_scale, 0.975),
		"Home actor apparent scale closely matches the combat Knight",
	)
	_check_world_node(home.get_node_or_null("%Player"), world_root, world_bounds, "player")
	var destinations := _nodes_in_group_below(home, &"home_destination")
	_expect(destinations.size() == 6, "all six Home Map destinations are present in the Cainos demo world")
	for destination: Node in destinations:
		_check_world_node(destination, world_root, world_bounds, String(destination.name))


func _check_camera_scroll(home: Control) -> void:
	var world_root := home.get_node_or_null("%WorldRoot") as Node2D
	var player := home.get_node_or_null("%Player") as CharacterBody2D
	_expect(world_root != null and player != null, "Home camera fixtures exist")
	if world_root == null or player == null:
		return
	player.call("cancel_auto_move")
	player.position = Vector2(42.0, 48.0)
	home.call("_update_camera")
	_expect(world_root.position.is_equal_approx(Vector2.ZERO), "camera clamps at the world's upper-left edge")
	player.position = Vector2(1158.0, 1152.0)
	home.call("_update_camera")
	_expect(
		world_root.position.is_equal_approx(Vector2(-860.0, -1140.0)),
		"camera clamps at the world's lower-right edge"
	)
	player.position = Vector2(600.0, 600.0)
	home.call("_update_camera")
	_expect(world_root.position.is_equal_approx(Vector2(-430.0, -570.0)), "camera centers on the scaled player away from world edges")
	_expect(
		player.global_position.is_equal_approx(LOGICAL_VIEWPORT_SIZE * 0.5),
		"camera-scroll keeps a mid-world player centered in the viewport"
	)
	player.position = Vector2(730.0, 646.0)
	home.call("_update_camera")


func _check_pointer_navigation(home: Control) -> void:
	var world_root := home.get_node_or_null("%WorldRoot") as Node2D
	var player := home.get_node_or_null("%Player") as CharacterBody2D
	var destination := home.get_node_or_null("WorldRoot/DestinationLayer/HeroRoster") as Node2D
	_expect(world_root != null and player != null and destination != null, "Home pointer-navigation fixtures exist")
	if world_root == null or player == null or destination == null:
		return
	player.call("cancel_auto_move")
	player.position = Vector2(500.0, 740.0)
	home.call("_update_camera")
	var world_scale := float(home.call("get_world_scale"))
	var destination_screen_position := world_root.position + destination.position * world_scale
	_expect(
		Rect2(Vector2.ZERO, LOGICAL_VIEWPORT_SIZE).has_point(destination_screen_position),
		"the pointer test destination is visible through the camera"
	)
	_expect(
		(home.call("_screen_to_world", destination_screen_position) as Vector2).is_equal_approx(destination.position),
		"screen-to-world conversion removes the active camera offset"
	)
	var destination_click := InputEventMouseButton.new()
	destination_click.button_index = MOUSE_BUTTON_LEFT
	destination_click.pressed = true
	destination_click.position = destination_screen_position
	home.call("_gui_input", destination_click)
	_expect(home.get("_pending_destination") == destination, "clicking a visible landmark selects that world destination")
	_expect(bool(player.call("is_auto_moving")), "landmark click starts camera-world auto-navigation")
	var destination_target: Vector2 = player.call("get_final_move_target")
	_expect(destination_target.distance_to(destination.position) <= 27.5, "landmark click routes to its interaction approach point")

	var ground_world_position := Vector2(600.0, 700.0)
	var ground_screen_position := world_root.position + ground_world_position * world_scale
	var ground_click := InputEventMouseButton.new()
	ground_click.button_index = MOUSE_BUTTON_LEFT
	ground_click.pressed = true
	ground_click.position = ground_screen_position
	home.call("_gui_input", ground_click)
	var retargeted_position: Vector2 = player.call("get_final_move_target")
	_expect(home.get("_pending_destination") == null, "ground click clears the pending landmark")
	_expect(bool(player.call("is_auto_moving")), "ground click retargets an active auto-walk")
	_expect(
		retargeted_position.is_equal_approx(ground_world_position) and retargeted_position != destination_target,
		"ground click retargets to world coordinates rather than raw screen coordinates"
	)
	player.call("cancel_auto_move")
	home.set("_pending_destination", null)


func _check_navigation_resize(home: Control) -> void:
	var player := home.get_node_or_null("%Player") as CharacterBody2D
	var world_root := home.get_node_or_null("%WorldRoot") as Node2D
	var destination := home.get_node_or_null("WorldRoot/DestinationLayer/Campaign") as Node2D
	_expect(player != null and destination != null, "Home resize navigation fixtures exist")
	if player == null or world_root == null or destination == null:
		return
	player.position = Vector2(730.0, 646.0)
	home.call("_update_camera")
	home.call("_walk_to_destination", destination)
	var old_destination_position := destination.position
	var old_camera_position := world_root.position
	root.size = Vector2i(800, 360)
	await process_frame
	await process_frame
	var resized_target: Vector2 = player.call("get_final_move_target")
	_expect(destination.position == old_destination_position, "viewport resize does not relayout authored world landmarks")
	_expect(home.call("get_world_size") == HOME_WORLD_SIZE, "viewport resize preserves the Cainos demo world")
	_expect(world_root.position != old_camera_position, "camera offset adapts to a wider viewport")
	_expect(home.get("_pending_destination") == destination, "viewport resize preserves the pending world destination")
	_expect(bool(player.call("is_auto_moving")), "viewport resize preserves active world navigation")
	_expect(
		resized_target.distance_to(destination.position) <= 27.5,
		"resized auto-navigation still approaches the authored destination"
	)
	_expect(
		_inside(
			Rect2(Vector2.ZERO, Vector2(800.0, 360.0)),
			Rect2(world_root.position, HOME_WORLD_SIZE * float(home.call("get_world_scale")))
		),
		"the camera keeps the wider viewport covered by the world"
	)
	root.size = Vector2i(640, 360)
	await process_frame
	await process_frame
	player.call("cancel_auto_move")
	home.set("_pending_destination", null)
	player.position = Vector2(730.0, 646.0)
	home.call("_update_camera")


func _check_function_overlay(home: Control, function_id: StringName) -> void:
	var viewport_bounds := Rect2(Vector2.ZERO, Vector2(640, 360))
	var overlay := home.get_node_or_null("%FunctionOverlay") as Control
	var content_host := home.get_node_or_null("%ContentHost") as Control
	var back_button := home.get_node_or_null("%BackToMapButton") as Button
	_expect(overlay != null and overlay.visible, "%s overlay is visible at 640x360" % function_id)
	_expect(content_host != null and content_host.get_child_count() == 1, "%s has one responsive content scene" % function_id)
	_expect(back_button != null and back_button.visible, "%s keeps Back to Map visible" % function_id)
	if overlay == null or content_host == null or back_button == null:
		return
	var overlay_bounds := overlay.get_global_rect()
	_expect(_inside(overlay_bounds, viewport_bounds), "%s overlay stays inside 640x360 (%s)" % [function_id, overlay_bounds])
	_expect(_inside(content_host.get_global_rect(), overlay_bounds), "%s content host stays inside its overlay" % function_id)
	_expect(_inside(back_button.get_global_rect(), overlay_bounds), "%s Back to Map stays inside its overlay" % function_id)


func _check_world_node(node: Node, world_root: Node2D, world_bounds: Rect2, label: String) -> void:
	_expect(node != null, "Home Map %s exists" % label)
	if node is Node2D:
		var node_2d := node as Node2D
		var world_position := world_root.to_local(node_2d.global_position)
		_expect(
			node_2d.is_visible_in_tree() and world_bounds.has_point(world_position),
			"Home Map %s stays inside the authored world" % label
		)
	elif node != null:
		_expect(false, "Home Map %s provides a 2D visual node" % label)


func _nodes_in_group_below(node: Node, group: StringName) -> Array[Node]:
	var matches: Array[Node] = []
	if node.is_in_group(group):
		matches.append(node)
	for child: Node in node.get_children():
		matches.append_array(_nodes_in_group_below(child, group))
	return matches


func _inside(inner: Rect2, outer: Rect2) -> bool:
	return inner.position.x >= outer.position.x - 0.5 and inner.position.y >= outer.position.y - 0.5 \
		and inner.end.x <= outer.end.x + 0.5 and inner.end.y <= outer.end.y + 0.5


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
