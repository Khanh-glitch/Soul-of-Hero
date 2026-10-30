class_name NativePoiShell
extends Node2D

## Compact canonical overworld footprint. A0 owns production mounting and transitions.

signal transition_requested(request: Dictionary)
signal player_feedback(message: String)

const TRANSITION_CONTRACT_ID := "soh.native_poi.transition.v1"
const TRANSITION_CONTRACT_VERSION := 1
const WORLD_LAYER := 1
const PLAYER_LAYER := 2
const SHELL_BOUNDS := Vector2(128.0, 128.0)
const DOORWAY_CENTER := Vector2(64.0, 108.0)
const DOORWAY_FACING := Vector2.UP
const PROP_FRAMES: Dictionary = {
	"rock_a": Rect2(2, 424, 26, 20),
	"rock_d": Rect2(296, 400, 30, 22),
	"cart": Rect2(170, 396, 38, 26),
	"barrel": Rect2(30, 424, 16, 20),
	"camp_crate": Rect2(175, 428, 18, 16),
	"fence": Rect2(139, 426, 34, 18),
}

@export_file("*.json") var definition_path := ""

var definition: Dictionary = {}
var _entry_area: Area2D
var _props_atlas: Texture2D


func _ready() -> void:
	if not _load_definition():
		push_error("NativePoiShell has no valid site definition: %s" % definition_path)
		return
	_props_atlas = load("res://assets/environment/overworld/overworld_props.png") as Texture2D
	_build_physics()
	queue_redraw()


func _load_definition() -> bool:
	if definition_path.is_empty() or not FileAccess.file_exists(definition_path):
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(definition_path))
	if not parsed is Dictionary:
		return false
	definition = parsed
	var shell: Dictionary = definition.get("overworld_shell", {})
	return (
		definition.get("scene_role", "") == "local_worksite"
		and shell.get("bounds_px", []) == [128, 128]
		and shell.get("action_socket", []) == [64, 64]
		and definition.get("source", {}).has("poi_id")
	)


func get_source_id() -> String:
	return str(definition.get("source", {}).get("poi_id", ""))


func get_entry_position() -> Vector2:
	return Vector2.from_array(definition.get("overworld_shell", {}).get("entry_portal", [64, 108]))


func get_action_socket() -> Vector2:
	return Vector2.from_array(definition.get("overworld_shell", {}).get("action_socket", [64, 64]))


func get_canonical_cell() -> Vector2i:
	var cell: Array = definition.get("source", {}).get("canonical_cell", [0, 0])
	return Vector2i(int(cell[0]), int(cell[1]))


func get_context_hint(actor: Node2D) -> String:
	if _is_at_door(actor):
		return "G · Enter %s" % str(definition.get("display_name", "the worksite"))
	return ""


func _is_at_door(actor: Node2D) -> bool:
	return (
		actor != null
		and is_instance_valid(actor)
		and actor.global_position.distance_to(global_position + get_entry_position()) <= 22.0
	)


func try_enter(actor: Node2D) -> bool:
	if not actor is CharacterBody2D:
		player_feedback.emit("Move through the marked entrance first.")
		return false
	if not _is_at_door(actor):
		player_feedback.emit("Move through the marked entrance first.")
		return false
	if _get_actor_facing(actor).dot(DOORWAY_FACING) < 0.55:
		player_feedback.emit("Face into the doorway to enter.")
		return false
	var shell: Dictionary = definition.get("overworld_shell", {})
	var transition: Dictionary = definition.get("local_transition", {})
	var request := {
		"contract_id": TRANSITION_CONTRACT_ID,
		"contract_version": TRANSITION_CONTRACT_VERSION,
		"transition_id": "%s|enter|%d" % [get_source_id(), Time.get_ticks_usec()],
		"direction": "enter",
		"world_id": str(definition.get("source", {}).get("world_id", "")),
		"poi_id": get_source_id(),
		"canonical_cell": get_canonical_cell(),
		"from_scene": str(shell.get("scene", "")),
		"to_scene": str(transition.get("worksite_scene", "")),
		"actor_local_position": to_local(actor.global_position),
		"interior_spawn": Vector2.from_array(transition.get("interior_entry", [])),
		"return_anchor": transition.get("return_anchor", {}).duplicate(true),
	}
	transition_requested.emit(request)
	return true


func _get_actor_facing(actor: CharacterBody2D) -> Vector2:
	if actor.has_method("get_facing_direction"):
		var hero_facing: Variant = actor.call("get_facing_direction")
		if hero_facing is Vector2 and hero_facing.length_squared() > 0.01:
			return hero_facing.normalized()
	for property: Dictionary in actor.get_property_list():
		if str(property.get("name", "")) in ["facing", "last_facing"]:
			var value: Variant = actor.get(str(property.name))
			if value is Vector2 and value.length_squared() > 0.01:
				return value.normalized()
	return actor.velocity.normalized() if actor.velocity.length_squared() > 0.01 else Vector2.UP


func _build_physics() -> void:
	var anchor_socket := Marker2D.new()
	anchor_socket.name = "AnchorActionSocket"
	anchor_socket.position = get_action_socket()
	add_child(anchor_socket)
	_add_solid_rect(Vector2(0, 0), Vector2(128, 8), "ShellWallNorth")
	_add_solid_rect(Vector2(0, 0), Vector2(8, 120), "ShellWallWest")
	_add_solid_rect(Vector2(120, 0), Vector2(8, 120), "ShellWallEast")
	_add_solid_rect(Vector2(0, 120), Vector2(44, 8), "ShellWallSouthWest")
	_add_solid_rect(Vector2(84, 120), Vector2(44, 8), "ShellWallSouthEast")
	_entry_area = Area2D.new()
	_entry_area.name = "PhysicalEntryPortal"
	_entry_area.collision_layer = 0
	_entry_area.collision_mask = PLAYER_LAYER
	var shape := CircleShape2D.new()
	shape.radius = 22.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	_entry_area.add_child(collision)
	_entry_area.position = get_entry_position()
	add_child(_entry_area)


func _add_solid_rect(at: Vector2, size: Vector2, label: String) -> void:
	var body := StaticBody2D.new()
	body.name = label
	body.collision_layer = WORLD_LAYER
	body.collision_mask = PLAYER_LAYER
	var shape := RectangleShape2D.new()
	shape.size = size
	var collision := CollisionShape2D.new()
	collision.shape = shape
	body.add_child(collision)
	body.position = at + size * 0.5
	add_child(body)


func _draw() -> void:
	if definition.is_empty():
		return
	var shell: Dictionary = definition.get("overworld_shell", {})
	var palette: Dictionary = definition.get("palette", {})
	var bounds := Rect2(Vector2.ZERO, SHELL_BOUNDS)
	var ground := Color.from_string(str(palette.get("ground", "#343b37")), Color.DARK_SLATE_GRAY)
	var soil := Color.from_string(str(palette.get("ground_alt", "#454c43")), ground.lightened(0.12))
	var stone := Color.from_string(str(palette.get("stone", "#918a76")), Color.GRAY)
	var accent := Color.from_string(str(palette.get("accent", "#d7ad69")), Color.GOLD)
	var ink := Color.from_string(str(palette.get("ink", "#1b2420")), Color.BLACK)
	var water := Color.from_string(str(palette.get("water", "#63b7c7")), Color.CYAN)
	draw_rect(bounds, ground)
	for y: int in range(10, 118, 16):
		for x: int in range(10 + (y / 16 % 2) * 8, 118, 24):
			draw_rect(Rect2(Vector2(x, y), Vector2(10, 2)), soil.darkened(0.15))
	_draw_footpath(stone, ink)
	match str(shell.get("profile", "")):
		"quarry":
			_draw_quarry_shell(stone, accent, ink)
		"orchard":
			_draw_orchard_shell(stone, accent, ink, water)
		"mill":
			_draw_mill_shell(stone, accent, ink, water)
	_draw_door(stone, accent, ink)


func _draw_footpath(stone: Color, ink: Color) -> void:
	draw_rect(Rect2(54, 76, 20, 40), ink)
	draw_rect(Rect2(56, 76, 16, 38), stone.darkened(0.2))
	draw_rect(Rect2(60, 108, 8, 12), Color("#d4c49b"))


func _draw_door(stone: Color, accent: Color, ink: Color) -> void:
	draw_rect(Rect2(40, 34, 48, 46), ink)
	draw_rect(Rect2(44, 34, 40, 42), stone.darkened(0.28))
	draw_rect(Rect2(50, 42, 28, 36), accent.darkened(0.35))
	draw_rect(Rect2(54, 46, 20, 32), ink)
	draw_rect(Rect2(60, 59, 4, 4), accent)
	draw_rect(Rect2(54, 82, 20, 4), ink)


func _draw_quarry_shell(stone: Color, accent: Color, ink: Color) -> void:
	draw_rect(Rect2(30, 28, 68, 58), ink)
	draw_rect(Rect2(34, 30, 60, 52), stone.darkened(0.1))
	draw_rect(Rect2(38, 38, 52, 36), stone.lightened(0.12))
	_draw_prop("rock_a", Rect2(8, 42, 26, 20), Color.WHITE)
	_draw_prop("rock_d", Rect2(94, 50, 30, 22), Color.WHITE)
	draw_line(Vector2(30, 28), Vector2(48, 20), accent, 3.0)
	draw_line(Vector2(48, 20), Vector2(66, 28), accent, 3.0)
	draw_line(Vector2(66, 28), Vector2(84, 20), accent, 3.0)
	draw_line(Vector2(84, 20), Vector2(98, 28), accent, 3.0)
	draw_rect(Rect2(18, 74, 12, 18), ink)
	draw_rect(Rect2(20, 76, 8, 14), accent.darkened(0.25))
	draw_line(Vector2(22, 78), Vector2(26, 86), ink, 2.0)


func _draw_orchard_shell(stone: Color, accent: Color, ink: Color, water: Color) -> void:
	draw_rect(Rect2(28, 24, 72, 66), ink)
	draw_rect(Rect2(32, 26, 64, 60), Color("#536b43"))
	for bed: Rect2 in [
		Rect2(34, 34, 22, 18), Rect2(72, 34, 20, 18), Rect2(34, 62, 22, 16), Rect2(72, 62, 20, 16)
	]:
		draw_rect(bed, stone.darkened(0.18))
		draw_rect(bed.grow(-3), Color("#667c4b"))
		draw_circle(bed.position + bed.size * 0.5, 4.0, Color("#9bb46b"))
	draw_line(Vector2(46, 54), Vector2(82, 54), water, 3.0)
	draw_line(Vector2(46, 54), Vector2(46, 69), water, 2.0)
	draw_line(Vector2(82, 54), Vector2(82, 69), water, 2.0)
	draw_line(Vector2(30, 26), Vector2(98, 26), accent.darkened(0.15), 3.0)
	draw_line(Vector2(32, 24), Vector2(32, 34), accent, 2.0)
	draw_line(Vector2(96, 24), Vector2(96, 34), accent, 2.0)
	draw_circle(Vector2(20, 38), 10.0, Color("#6a8b4d"))
	draw_circle(Vector2(108, 42), 9.0, Color("#789958"))
	draw_rect(Rect2(18, 48, 4, 15), stone.darkened(0.15))
	draw_rect(Rect2(106, 51, 4, 15), stone.darkened(0.15))
	draw_rect(Rect2(18, 76, 12, 10), ink)
	draw_rect(Rect2(20, 78, 8, 6), accent)


func _draw_mill_shell(stone: Color, accent: Color, ink: Color, water: Color) -> void:
	draw_rect(Rect2(28, 22, 72, 68), ink)
	draw_rect(Rect2(32, 26, 64, 60), stone.darkened(0.2))
	draw_rect(Rect2(36, 32, 56, 46), Color("#705a3e"))
	draw_rect(Rect2(42, 38, 44, 36), stone.darkened(0.12))
	draw_line(Vector2(30, 28), Vector2(64, 16), accent, 4.0)
	draw_line(Vector2(64, 16), Vector2(98, 28), accent, 4.0)
	draw_line(Vector2(44, 38), Vector2(84, 70), ink, 3.0)
	draw_line(Vector2(84, 38), Vector2(44, 70), ink, 3.0)
	draw_circle(Vector2(64, 54), 14.0, accent.darkened(0.15))
	draw_circle(Vector2(64, 54), 5.0, ink)
	draw_line(Vector2(64, 70), Vector2(64, 82), water, 3.0)
	draw_line(Vector2(52, 82), Vector2(76, 82), water, 3.0)
	_draw_prop("cart", Rect2(12, 54, 38, 26), Color.WHITE)
	_draw_prop("barrel", Rect2(98, 72, 16, 20), Color.WHITE)


func _draw_prop(frame_name: String, destination: Rect2, tint: Color) -> void:
	if _props_atlas == null or not PROP_FRAMES.has(frame_name):
		return
	draw_texture_rect_region(_props_atlas, destination, PROP_FRAMES[frame_name], tint, false, true)
