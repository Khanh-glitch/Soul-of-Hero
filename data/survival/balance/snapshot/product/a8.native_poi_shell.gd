class_name NativePoiShell
extends Node2D

## Compact canonical overworld footprint. A0 owns production mounting and transitions.

signal transition_requested(request: Dictionary)
signal player_feedback(message: String)

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const ART_SCRIPT := preload("res://game/survival/world_content/scripts/native_poi_art.gd")
const TRANSITION_CONTRACT_ID := "soh.native_poi.transition.v1"
const TRANSITION_CONTRACT_VERSION := 1
const WORLD_LAYER := 1
const PLAYER_LAYER := 2
const SHELL_BOUNDS := Vector2(128.0, 128.0)
const DOORWAY_CENTER := Vector2(64.0, 108.0)
const DOORWAY_FACING := Vector2.UP
@export_file("*.json") var definition_path := ""

var definition: Dictionary = {}
var _entry_area: Area2D
var _art: Node2D


func _ready() -> void:
	if not _load_definition():
		push_error("NativePoiShell has no valid site definition: %s" % definition_path)
		return
	_art = ART_SCRIPT.new() as Node2D
	_art.name = "CanonicalFootprintArt"
	add_child(_art)
	if not _art.call("configure", definition, true):
		push_error("NativePoiShell source-cleared art failed to load: %s" % get_source_id())
		remove_child(_art)
		_art.queue_free()
		_art = null
	_build_physics()


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
	return VECTOR_UTIL.from_pair(
		definition.get("overworld_shell", {}).get("entry_portal", [64, 108])
	)


func get_action_socket() -> Vector2:
	return VECTOR_UTIL.from_pair(
		definition.get("overworld_shell", {}).get("action_socket", [64, 64])
	)


func get_canonical_cell() -> Vector2i:
	return VECTOR_UTIL.from_int_pair(definition.get("source", {}).get("canonical_cell", [0, 0]))


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
		"interior_spawn":
		VECTOR_UTIL.from_pair(transition.get("interior_entry", []), Vector2(64, 548)),
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
	var obstacles: Array = definition.get("overworld_shell", {}).get("obstacles_px", [])
	for index: int in range(obstacles.size()):
		var obstacle: Variant = obstacles[index]
		if not obstacle is Array or obstacle.size() != 4:
			continue
		var position := VECTOR_UTIL.from_int_pair([obstacle[0], obstacle[1]], Vector2i(-1, -1))
		var size := VECTOR_UTIL.from_int_pair([obstacle[2], obstacle[3]], Vector2i.ZERO)
		if position.x < 0 or position.y < 0 or size.x <= 0 or size.y <= 0:
			continue
		_add_solid_rect(Vector2(position), Vector2(size), "ShellPropObstacle_%d" % index)
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
