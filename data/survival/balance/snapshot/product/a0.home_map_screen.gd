extends Control

const WORLD_SIZE := Vector2(1200.0, 1200.0)
const HOME_WORLD_SCALE := 1.25
const LANDMARK_POSITIONS := {
	&"campaign": Vector2(740.0, 705.0),
	&"hero_roster": Vector2(430.0, 740.0),
	&"storage": Vector2(640.0, 835.0),
	&"modes": Vector2(720.0, 288.0),
	&"bestiary": Vector2(790.0, 1000.0),
	&"settings": Vector2(850.0, 800.0),
	&"credits": Vector2(430.0, 990.0),
}

# Exact main-floor cells exported from `Layer 1 - Grass`, with `Layer 1 - Wall`
# removed, then reduced to the 271-cell component containing SC Demo's official
# player spawn. Values are inclusive x ranges for each Unity grid row. Keeping
# every Home function on this one component avoids false shortcuts between the
# demo's three elevation layers until its stair triggers are ported.
const DEMO_GRID_ORIGIN := Vector2(544.0, 720.0)
const DEMO_GRID_SIZE := 32.0
const DEMO_WALKABLE_ROWS := {
	16: [-3, 0, 7, 7],
	15: [-3, 7],
	14: [-3, 7],
	13: [-3, 9],
	12: [-3, 9],
	11: [5, 8],
	10: [6, 7],
	9: [6, 7],
	8: [6, 7],
	7: [6, 7],
	6: [6, 7],
	5: [6, 7],
	4: [-2, 9],
	3: [-2, 9],
	2: [-6, 7],
	1: [-6, 10],
	0: [-6, 9],
	-1: [-6, 9],
	-2: [-4, 9],
	-3: [-4, 9],
	-4: [-4, 9],
	-5: [7, 9],
	-6: [-9, -9, 3, 4, 7, 9, 12, 12],
	-7: [-9, -9, 3, 4, 7, 9, 12, 12],
	-8: [-9, 12],
	-9: [-9, 12],
	-10: [3, 8],
	-11: [3, 8],
}

const FUNCTION_SCENE_PATHS := {
	&"campaign": "res://game/ui/screens/hub/tabs/campaign_tab.tscn",
	&"hero_roster": "res://game/ui/screens/hub/tabs/arsenal_tab.tscn",
	&"storage": "res://game/ui/screens/home/home_storage_screen.tscn",
	&"modes": "res://game/ui/screens/hub/tabs/modes_tab.tscn",
	&"bestiary": "res://game/ui/screens/hub/tabs/bestiary_tab.tscn",
	&"settings": "res://game/ui/screens/hub/tabs/settings_tab.tscn",
}
const FUNCTION_COPY := {
	&"campaign": {
		"title": "CỔNG CHIẾN DỊCH",
		"subtitle": "Chọn hành trình hoặc trở lại sân tập.",
	},
	&"hero_roster": {
		"title": "ĐIỆN SOUL",
		"subtitle": "Sắp xếp cặp Hero, Hero Weapon và trang bị theo từng Hero.",
	},
	&"storage": {
		"title": "RƯƠNG KHO",
		"subtitle": "Cất hoặc lấy trang bị giữa túi 30 ô và kho 50 ô.",
	},
	&"modes": {
		"title": "SÂN THỬ THÁCH",
		"subtitle": "Những nghi thức chiến đấu ngoài chiến dịch.",
	},
	&"bestiary": {
		"title": "THƯ KHỐ QUÁI VẬT",
		"subtitle": "Ghi chép kẻ địch, hành vi và điểm yếu đã biết.",
	},
	&"settings": {
		"title": "QUẢN GIA THÁNH ĐỊA",
		"subtitle": "Âm thanh, hiển thị, điều khiển và trợ năng.",
	},
}
const DESTINATION_SCENE := preload("res://game/ui/screens/home/home_destination.tscn")
const ARCHER_TEXTURE: Texture2D = preload("res://assets/characters/home_npcs/gatekeeper_archer_idle.png")
const KNIGHT_TEXTURE: Texture2D = preload("res://assets/characters/knight/_Idle.png")
const AXE_TEXTURE: Texture2D = preload("res://assets/characters/axe_warrior/_Idle.png")
const VAMPIRE_TEXTURE: Texture2D = preload("res://assets/characters/enemies/enemies-vampire_idle.png")
const MARTIAL_TEXTURE: Texture2D = preload("res://assets/characters/home_npcs/ash_steward_idle.png")
const PROPS_TEXTURE: Texture2D = preload("res://assets/environment/cainos_demo/cainos_props.png")
const STORAGE_CHEST_TEXTURE: Texture2D = preload("res://assets/environment/dungeon/items/chest/chest_4.png")

const DESTINATION_DATA := [
	{
		"function_id": &"campaign",
		"display_name": "NGƯỜI GIỮ CỔNG",
		"role": "Chiến dịch & Sân tập",
		"accent": Color("f0b95c"),
		"texture": ARCHER_TEXTURE,
		"region": Rect2(0, 0, 64, 64),
		"scale": Vector2(0.50, 0.50),
		"visual_offset": Vector2(0, -18),
	},
	{
		"function_id": &"hero_roster",
		"display_name": "HỘ VỆ LINH HỒN",
		"role": "Đội hình & Trang bị",
		"accent": Color("66d4dc"),
		"texture": KNIGHT_TEXTURE,
		"region": Rect2(0, 0, 120, 80),
		"scale": Vector2(0.50, 0.50),
		"visual_offset": Vector2(0, -16),
	},
	{
		"function_id": &"storage",
		"display_name": "RƯƠNG KHO LỚN",
		"role": "Kho đồ 50 ô",
		"accent": Color("e7aa4f"),
		"texture": STORAGE_CHEST_TEXTURE,
		"region": Rect2(0, 0, 48, 40),
		"scale": Vector2(1.4, 1.4),
		"visual_offset": Vector2(0, -12),
	},
	{
		"function_id": &"modes",
		"display_name": "BẬC THẦY THỬ THÁCH",
		"role": "Chế độ chiến đấu",
		"accent": Color("ed775f"),
		"texture": AXE_TEXTURE,
		"region": Rect2(0, 0, 120, 80),
		"scale": Vector2(0.50, 0.50),
		"visual_offset": Vector2(0, -16),
	},
	{
		"function_id": &"bestiary",
		"display_name": "NGƯỜI CHÉP SỬ",
		"role": "Thư khố quái vật",
		"accent": Color("b58ae8"),
		"texture": VAMPIRE_TEXTURE,
		"region": Rect2(0, 0, 32, 32),
		"scale": Vector2(1.0, 1.0),
		"visual_offset": Vector2(0, -14),
	},
	{
		"function_id": &"settings",
		"display_name": "QUẢN GIA TRO TÀN",
		"role": "Cài đặt & Trợ năng",
		"accent": Color("7ccfa0"),
		"texture": MARTIAL_TEXTURE,
		"region": Rect2(0, 0, 200, 200),
		"scale": Vector2(0.46, 0.46),
		"visual_offset": Vector2(0, -18),
	},
	{
		"function_id": &"credits",
		"display_name": "ĐÀI TƯỞNG NIỆM",
		"role": "Ghi công",
		"accent": Color("c7b590"),
		"texture": PROPS_TEXTURE,
		"region": Rect2(445, 20, 37, 73),
		"scale": Vector2(0.72, 0.72),
		"visual_offset": Vector2(0, -27),
	},
]

@onready var world_root: Node2D = %WorldRoot
@onready var map_world: Node2D = %MapWorld
@onready var destination_layer: Node2D = %DestinationLayer
@onready var player: CharacterBody2D = %Player
@onready var function_overlay: Control = %FunctionOverlay
@onready var content_host: Control = %ContentHost
@onready var prompt_key: Label = %PromptKey
@onready var prompt_label: Label = %PromptLabel

var _destinations: Dictionary = {}
var _landmark_positions: Dictionary = {}
var _requested_function := &""
var _current_function := &""
var _nearby_destination: Node2D
var _pending_destination: Node2D
var _player_positioned := false
var _overlay_open := false
var _input_modality := &"keyboard_mouse"
var _ignore_mouse_modality_until_msec := 0


func _ready() -> void:
	world_root.scale = Vector2.ONE * HOME_WORLD_SCALE
	if DisplayServer.is_touchscreen_available() or OS.get_environment("GODOT_FORCE_TOUCH_CONTROLS") == "1":
		_input_modality = &"touch"
	%BackToMapButton.pressed.connect(close_function)
	player.manual_navigation_started.connect(_on_player_manual_navigation_started)
	player.call("set_walkability_test", Callable(self, "_is_walkable_position"))
	_build_destinations()
	_refresh_profile()
	resized.connect(_layout_world)
	function_overlay.hide()
	_layout_world()
	_apply_requested_function.call_deferred()
	set_process(true)


func configure(payload: Dictionary = {}) -> void:
	var raw_function: Variant = payload.get("function_id", payload.get("hub_tab", &""))
	_requested_function = _normalize_function(StringName(raw_function))
	if is_node_ready():
		_apply_requested_function.call_deferred()


func get_destination_count() -> int:
	return _destinations.size()


func get_world_size() -> Vector2:
	return WORLD_SIZE


func get_world_scale() -> float:
	return HOME_WORLD_SCALE


func is_function_open() -> bool:
	return _overlay_open


func get_current_function() -> StringName:
	return _current_function


func open_function(function_id: StringName) -> void:
	function_id = _normalize_function(function_id)
	if function_id == &"credits":
		player.cancel_auto_move()
		AppFlow.open_credits(&"home")
		return
	if not FUNCTION_SCENE_PATHS.has(function_id):
		return
	_clear_content()
	var scene_path := String(FUNCTION_SCENE_PATHS[function_id])
	var packed := load(scene_path) as PackedScene
	if packed == null:
		push_error("Home Map could not load function scene: %s" % scene_path)
		return
	var content := packed.instantiate()
	content_host.add_child(content)
	if content is Control:
		(content as Control).set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var copy: Dictionary = FUNCTION_COPY[function_id]
	%FunctionTitle.text = String(copy.get("title", "THÁNH ĐỊA"))
	%FunctionSubtitle.text = String(copy.get("subtitle", ""))
	_current_function = function_id
	_requested_function = &""
	_overlay_open = true
	function_overlay.show()
	player.cancel_auto_move()
	player.controls_enabled = false
	_pending_destination = null
	if AppFlow.has_method(&"set_current_home_function"):
		AppFlow.call(&"set_current_home_function", function_id)
	%BackToMapButton.grab_focus()


func close_function() -> void:
	if not _overlay_open:
		return
	_clear_content()
	function_overlay.hide()
	_overlay_open = false
	_current_function = &""
	player.controls_enabled = true
	if AppFlow.has_method(&"set_current_home_function"):
		AppFlow.call(&"set_current_home_function", &"")
	update_prompt.call_deferred()


func _process(_delta: float) -> void:
	_update_camera()
	if _overlay_open:
		return
	_update_destination_focus()
	if _pending_destination != null and is_instance_valid(_pending_destination):
		if player.position.distance_to(_pending_destination.position) <= float(_pending_destination.interaction_radius):
			var reached := _pending_destination
			_pending_destination = null
			player.cancel_auto_move()
			open_function(StringName(reached.function_id))
			return
	if Input.is_action_just_pressed(&"interact") and _nearby_destination != null:
		open_function(StringName(_nearby_destination.function_id))
	update_prompt()


func update_prompt() -> void:
	if _overlay_open:
		return
	if _pending_destination != null and is_instance_valid(_pending_destination):
		prompt_key.text = "•••"
		prompt_label.text = "ĐANG ĐẾN  •  %s" % String(_pending_destination.display_name)
		return
	if _nearby_destination != null:
		prompt_key.text = _interaction_prompt_key()
		prompt_label.text = "%s  •  %s" % [
			String(_nearby_destination.display_name),
			String(_nearby_destination.role_text),
		]
		return
	prompt_key.text = _movement_prompt_key()
	match _input_modality:
		&"touch":
			prompt_label.text = "Chạm mặt đất để đi • Chạm một người giữ chức năng để tương tác"
		&"gamepad":
			prompt_label.text = "Dùng cần trái để di chuyển • Đến gần người quản chức và nhấn A"
		_:
			prompt_label.text = "Di chuyển tự do • Nhấp vào địa điểm hoặc người quản chức để tới nơi"


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		_ignore_mouse_modality_until_msec = Time.get_ticks_msec() + 300
		_set_input_modality(&"touch")
	elif event is InputEventJoypadButton:
		if (event as InputEventJoypadButton).pressed:
			_set_input_modality(&"gamepad")
	elif event is InputEventJoypadMotion:
		if absf((event as InputEventJoypadMotion).axis_value) >= 0.35:
			_set_input_modality(&"gamepad")
	elif event is InputEventKey:
		if (event as InputEventKey).pressed:
			_set_input_modality(&"keyboard_mouse")
	elif event is InputEventMouseButton:
		if (event as InputEventMouseButton).pressed and Time.get_ticks_msec() >= _ignore_mouse_modality_until_msec:
			_set_input_modality(&"keyboard_mouse")
	elif event is InputEventMouseMotion:
		if (event as InputEventMouseMotion).relative.length_squared() > 0.25 and Time.get_ticks_msec() >= _ignore_mouse_modality_until_msec:
			_set_input_modality(&"keyboard_mouse")


func _gui_input(event: InputEvent) -> void:
	if _overlay_open:
		return
	var pointer_position := Vector2.ZERO
	var pressed := false
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		pressed = mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed
		pointer_position = mouse_event.position
	elif event is InputEventScreenTouch:
		var touch_event := event as InputEventScreenTouch
		pressed = touch_event.pressed
		pointer_position = touch_event.position
	if not pressed or _pointer_hits_hud(pointer_position):
		return
	var world_position := _screen_to_world(pointer_position)
	if not Rect2(Vector2.ZERO, WORLD_SIZE).has_point(world_position):
		return
	var clicked_destination := _destination_at_point(world_position)
	if clicked_destination != null:
		_walk_to_destination(clicked_destination)
	else:
		_pending_destination = null
		if not _is_walkable_position(world_position):
			return
		player.call("move_along", _find_world_path(player.position, world_position))
	accept_event()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_echo():
		return
	if not _overlay_open and event.is_action_pressed(&"ui_accept") and _nearby_destination != null:
		open_function(StringName(_nearby_destination.function_id))
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed(&"ui_cancel") or event.is_action_pressed(&"pause"):
		if _overlay_open:
			close_function()
		else:
			open_function(&"settings")
		get_viewport().set_input_as_handled()


func _build_destinations() -> void:
	for data: Dictionary in DESTINATION_DATA:
		var destination := DESTINATION_SCENE.instantiate() as Node2D
		destination.name = String(data.get("function_id", "destination")).to_pascal_case()
		destination.call("setup", data)
		destination_layer.add_child(destination)
		_destinations[StringName(data.get("function_id", &""))] = destination


func _layout_world() -> void:
	if not is_node_ready() or _destinations.is_empty():
		return
	_landmark_positions = LANDMARK_POSITIONS.duplicate()
	for raw_id: Variant in _landmark_positions:
		var function_id := StringName(raw_id)
		(_destinations[function_id] as Node2D).position = _landmark_positions[function_id]
	var bounds := Rect2(150.0, 44.0, WORLD_SIZE.x - 300.0, WORLD_SIZE.y - 88.0)
	player.set_movement_bounds(bounds)
	if not _player_positioned:
		# SC Demo's original player transform (5.82, 2.31), converted at
		# 32 px/unit into the full 1200x1200 scene overview.
		player.position = Vector2(730.0, 646.0)
		_player_positioned = true
	map_world.call("set_map_layout", WORLD_SIZE, _landmark_positions)
	_update_camera()
	if _pending_destination != null and is_instance_valid(_pending_destination):
		_walk_to_destination(_pending_destination)


func _refresh_profile() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	var account_currency := 0
	var chapter := 1
	if save_service != null and save_service.has_method(&"get_value"):
		var account_path: Array[String] = ["currencies", "account"]
		var chapter_path: Array[String] = ["progression", "campaign", "chapter"]
		account_currency = int(save_service.call(&"get_value", account_path, 0))
		chapter = int(save_service.call(&"get_value", chapter_path, 1))
	%ProfileLabel.text = "CHƯƠNG %02d  •  %04d VÀNG" % [chapter, account_currency]


func _update_destination_focus() -> void:
	var closest: Node2D
	var closest_distance := INF
	var hover: Node2D
	if _input_modality == &"keyboard_mouse":
		var hover_point := _screen_to_world(get_local_mouse_position())
		if Rect2(Vector2.ZERO, WORLD_SIZE).has_point(hover_point):
			hover = _destination_at_point(hover_point)
	for raw_destination: Variant in _destinations.values():
		var destination := raw_destination as Node2D
		var distance := player.position.distance_to(destination.position)
		if distance < closest_distance:
			closest = destination
			closest_distance = distance
		destination.call("set_hovered", destination == hover)
	_nearby_destination = closest if closest != null and closest_distance <= float(closest.interaction_radius) else null
	for raw_destination: Variant in _destinations.values():
		var destination := raw_destination as Node2D
		destination.call("set_focused", destination == _nearby_destination)


func _destination_near_point(point: Vector2, radius: float) -> Node2D:
	var closest: Node2D
	var closest_distance := radius
	for raw_destination: Variant in _destinations.values():
		var destination := raw_destination as Node2D
		var distance := point.distance_to(destination.position)
		if distance <= closest_distance:
			closest = destination
			closest_distance = distance
	return closest


func _destination_at_point(point: Vector2) -> Node2D:
	var closest: Node2D
	var closest_distance := INF
	for raw_destination: Variant in _destinations.values():
		var destination := raw_destination as Node2D
		if not bool(destination.call("contains_world_point", point)):
			continue
		var distance := point.distance_squared_to(destination.position)
		if distance < closest_distance:
			closest = destination
			closest_distance = distance
	return closest


func _walk_to_destination(destination: Node2D) -> void:
	_pending_destination = destination
	var approach_direction := (player.position - destination.position).normalized()
	if approach_direction.length_squared() < 0.01:
		approach_direction = Vector2.DOWN
	var approach_point := destination.position + approach_direction * 27.0
	if not _is_walkable_position(approach_point):
		approach_point = destination.position
	player.call("move_along", _find_world_path(player.position, approach_point))


func _update_camera() -> void:
	if world_root == null or player == null:
		return
	var scaled_world_size := WORLD_SIZE * HOME_WORLD_SCALE
	var desired := size * 0.5 - player.position * HOME_WORLD_SCALE
	if size.x >= scaled_world_size.x:
		desired.x = (size.x - scaled_world_size.x) * 0.5
	else:
		desired.x = clampf(desired.x, size.x - scaled_world_size.x, 0.0)
	if size.y >= scaled_world_size.y:
		desired.y = (size.y - scaled_world_size.y) * 0.5
	else:
		desired.y = clampf(desired.y, size.y - scaled_world_size.y, 0.0)
	world_root.position = desired.round()


func _screen_to_world(screen_position: Vector2) -> Vector2:
	return (screen_position - world_root.position) / HOME_WORLD_SCALE


func _pointer_hits_hud(pointer_position: Vector2) -> bool:
	for control: Control in [$TopSafe, $PromptSafe]:
		if Rect2(control.position, control.size).has_point(pointer_position):
			return true
	return false


func _is_walkable_position(point: Vector2) -> bool:
	return _is_walkable_cell(_world_to_demo_cell(point))


func _world_to_demo_cell(point: Vector2) -> Vector2i:
	return Vector2i(
		floori((point.x - DEMO_GRID_ORIGIN.x) / DEMO_GRID_SIZE),
		floori((DEMO_GRID_ORIGIN.y - point.y) / DEMO_GRID_SIZE)
	)


func _demo_cell_center(cell: Vector2i) -> Vector2:
	return Vector2(
		DEMO_GRID_ORIGIN.x + (float(cell.x) + 0.5) * DEMO_GRID_SIZE,
		DEMO_GRID_ORIGIN.y - (float(cell.y) + 0.5) * DEMO_GRID_SIZE
	)


func _is_walkable_cell(cell: Vector2i) -> bool:
	var ranges: Array = DEMO_WALKABLE_ROWS.get(cell.y, [])
	for index: int in range(0, ranges.size(), 2):
		if cell.x >= int(ranges[index]) and cell.x <= int(ranges[index + 1]):
			return true
	return false


func _find_world_path(start_point: Vector2, end_point: Vector2) -> Array[Vector2]:
	var start := _world_to_demo_cell(start_point)
	var goal := _world_to_demo_cell(end_point)
	var fallback: Array[Vector2] = [end_point]
	if not _is_walkable_cell(start) or not _is_walkable_cell(goal):
		return fallback
	if start == goal:
		return fallback

	var frontier: Array[Vector2i] = [start]
	var frontier_index := 0
	var came_from := {start: start}
	while frontier_index < frontier.size():
		var current := frontier[frontier_index]
		frontier_index += 1
		if current == goal:
			break
		for direction: Vector2i in [Vector2i.RIGHT, Vector2i.DOWN, Vector2i.LEFT, Vector2i.UP]:
			var next := current + direction
			if came_from.has(next) or not _is_walkable_cell(next):
				continue
			came_from[next] = current
			frontier.append(next)
	if not came_from.has(goal):
		return fallback

	var reversed_cells: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		reversed_cells.append(cursor)
		cursor = came_from[cursor]
	reversed_cells.append(start)
	reversed_cells.reverse()

	# Keep only grid corners; the actor then follows long straight stretches
	# smoothly rather than stopping at every 32 px tile center.
	var result: Array[Vector2] = []
	var previous_direction := Vector2i.ZERO
	for index: int in range(1, reversed_cells.size()):
		var direction := reversed_cells[index] - reversed_cells[index - 1]
		if index > 1 and direction != previous_direction:
			result.append(_demo_cell_center(reversed_cells[index - 1]))
		previous_direction = direction
	result.append(end_point)
	return result


func _on_player_manual_navigation_started() -> void:
	_pending_destination = null
	update_prompt()


func _set_input_modality(value: StringName) -> void:
	if _input_modality == value:
		return
	_input_modality = value
	update_prompt()


func _interaction_prompt_key() -> String:
	match _input_modality:
		&"touch":
			return "CHẠM"
		&"gamepad":
			return "A"
		_:
			return "E"


func _movement_prompt_key() -> String:
	match _input_modality:
		&"touch":
			return "CHẠM"
		&"gamepad":
			return "LS"
		_:
			return "WASD"


func _apply_requested_function() -> void:
	if _requested_function != &"" and not _overlay_open:
		open_function(_requested_function)


func _clear_content() -> void:
	for child: Node in content_host.get_children():
		content_host.remove_child(child)
		child.queue_free()


func _normalize_function(function_id: StringName) -> StringName:
	if function_id == &"arsenal":
		return &"hero_roster"
	if function_id in [&"campaign", &"hero_roster", &"storage", &"modes", &"bestiary", &"settings", &"credits"]:
		return function_id
	return &""
