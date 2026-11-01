class_name NativePoiShell
extends Node2D

## Compact canonical overworld footprint. A0 owns production mounting and transitions.

signal transition_requested(request: Dictionary)
signal player_feedback(message: String)

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const ART_SCRIPT := preload("res://game/survival/world_content/scripts/native_poi_art.gd")
const PHASE_CONTEXT_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_phase_context.gd"
)
const TRANSITION_CONTRACT_ID := "soh.native_poi.transition.v2"
const TRANSITION_CONTRACT_VERSION := 2
const WORLD_LAYER := 1
const PLAYER_LAYER := 2
const SHELL_BOUNDS := Vector2(128.0, 128.0)
const DOORWAY_CENTER := Vector2(64.0, 108.0)
const DOORWAY_FACING := Vector2.UP
@export_file("*.json") var definition_path := ""

var definition: Dictionary = {}
var definition_error := ""
var _entry_area: Area2D
var _art: Node2D
var _run_phase_context: NativePoiPhaseContext
var _transition_sequence := 0


func _ready() -> void:
	if not _load_definition():
		push_error(
			"NativePoiShell rejected site definition (%s): %s" % [definition_error, definition_path]
		)
		return
	_run_phase_context = PHASE_CONTEXT_SCRIPT.new() as NativePoiPhaseContext
	if not _run_phase_context.configure(definition):
		push_error("NativePoiShell could not configure its A0 run boundary: %s" % get_source_id())
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
	definition_error = ""
	if definition_path.is_empty() or not FileAccess.file_exists(definition_path):
		definition_error = "definition_file_missing"
		return false
	var parser := JSON.new()
	var parse_result := parser.parse(FileAccess.get_file_as_string(definition_path))
	if parse_result != OK:
		definition_error = "invalid_json:%s" % parser.get_error_message()
		return false
	definition_error = validate_definition(parser.data)
	if not definition_error.is_empty():
		return false
	definition = parser.data
	return true


static func validate_definition(candidate: Variant) -> String:
	if not candidate is Dictionary:
		return "json_root_not_object"
	var schema_version: Variant = candidate.get("schema_version", null)
	if (
		(typeof(schema_version) != TYPE_INT and typeof(schema_version) != TYPE_FLOAT)
		or float(schema_version) != 1.0
	):
		return "unsupported_schema_version"
	if str(candidate.get("scene_role", "")) != "local_worksite":
		return "wrong_scene_role"
	var source: Variant = candidate.get("source", null)
	if not source is Dictionary or typeof(source.get("poi_id", null)) != TYPE_STRING:
		return "source_identity_missing"
	var poi_id: String = source.get("poi_id", "")
	if poi_id.is_empty():
		return "source_identity_missing"
	var source_cell := VECTOR_UTIL.from_int_pair(source.get("canonical_cell", []), Vector2i(-1, -1))
	if source_cell.x < 0 or source_cell.y < 0:
		return "source_canonical_cell_invalid"
	var shell: Variant = candidate.get("overworld_shell", null)
	if not shell is Dictionary:
		return "overworld_shell_missing"
	var bounds := VECTOR_UTIL.from_int_pair(shell.get("bounds_px", []), Vector2i(-1, -1))
	if bounds != Vector2i(128, 128):
		return "shell_bounds_invalid"
	var action_socket := VECTOR_UTIL.from_int_pair(shell.get("action_socket", []), Vector2i(-1, -1))
	if action_socket != Vector2i(64, 64):
		return "action_socket_invalid"
	var shell_cell := VECTOR_UTIL.from_int_pair(shell.get("canonical_cell", []), Vector2i(-1, -1))
	if shell_cell != source_cell:
		return "canonical_cell_mismatch"
	var rotation: Variant = shell.get("rotation_degrees", null)
	var scale := VECTOR_UTIL.from_int_pair(shell.get("scale", []), Vector2i(-1, -1))
	if (
		(typeof(rotation) != TYPE_INT and typeof(rotation) != TYPE_FLOAT)
		or float(rotation) != 0.0
		or scale != Vector2i.ONE
	):
		return "noncanonical_transform"
	var transition: Variant = candidate.get("local_transition", null)
	if not transition is Dictionary:
		return "local_transition_missing"
	var shell_scene: Variant = shell.get("scene", null)
	var transition_shell: Variant = transition.get("shell_scene", null)
	if (
		typeof(shell_scene) != TYPE_STRING
		or shell_scene.is_empty()
		or shell_scene != transition_shell
	):
		return "shell_scene_reference_mismatch"
	if not ResourceLoader.exists(shell_scene, "PackedScene"):
		return "shell_scene_resource_missing"
	var worksite_scene: Variant = transition.get("worksite_scene", null)
	if typeof(worksite_scene) != TYPE_STRING or worksite_scene.is_empty():
		return "worksite_scene_reference_missing"
	if not ResourceLoader.exists(worksite_scene, "PackedScene"):
		return "worksite_scene_resource_missing"
	var return_anchor: Variant = transition.get("return_anchor", null)
	if not return_anchor is Dictionary:
		return "return_anchor_missing"
	if (
		str(return_anchor.get("poi_id", "")) != poi_id
		or (
			VECTOR_UTIL.from_int_pair(return_anchor.get("canonical_cell", []), Vector2i(-1, -1))
			!= source_cell
		)
		or str(return_anchor.get("shell_scene", "")) != shell_scene
	):
		return "return_anchor_identity_mismatch"
	return ""


func get_source_id() -> String:
	return str(definition.get("source", {}).get("poi_id", ""))


func set_visual_depth_actor(actor: Node2D) -> void:
	# A8 art-only depth sorting; this does not alter shell collision or transition state.
	if is_instance_valid(_art):
		_art.call("set_depth_actor", actor)


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


func apply_run_phase_projection(owner_projection: Dictionary) -> bool:
	return _run_phase_context != null and _run_phase_context.apply_projection(owner_projection)


func get_run_phase_context() -> Dictionary:
	return _run_phase_context.get_run_context() if _run_phase_context != null else {}


func get_context_hint(actor: Node2D) -> String:
	if _is_at_door(actor):
		return "G · Enter %s" % str(definition.get("display_name", "the worksite"))
	if actor != null and is_instance_valid(actor):
		var clue: Dictionary = definition.get("approach_clue", {})
		var clue_position := VECTOR_UTIL.from_pair(clue.get("local_px", [-1, -1]), Vector2(-1, -1))
		var clue_text := str(clue.get("text", ""))
		if (
			clue_position.x >= 0.0
			and not clue_text.is_empty()
			and actor.global_position.distance_to(global_position + clue_position) <= 22.0
		):
			return clue_text
	return ""


func _is_at_door(actor: Node2D) -> bool:
	return (
		actor != null
		and is_instance_valid(actor)
		and actor.global_position.distance_to(global_position + get_entry_position()) <= 22.0
	)


func try_enter(actor: Node2D) -> bool:
	if (
		_run_phase_context == null
		or not _run_phase_context.is_initialized()
		or not _run_phase_context.permits_mutating_intents()
	):
		player_feedback.emit("The run owner has not supplied a valid active phase.")
		return false
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
	var run_context := _run_phase_context.get_run_context()
	_transition_sequence += 1
	var request := {
		"contract_id": TRANSITION_CONTRACT_ID,
		"contract_version": TRANSITION_CONTRACT_VERSION,
		"transition_id":
		(
			"%s|%s|%d|enter|%d"
			% [get_source_id(), run_context.run_id, run_context.run_epoch, _transition_sequence]
		),
		"direction": "enter",
		"poi_id": get_source_id(),
		"canonical_cell": get_canonical_cell(),
		"from_scene": str(shell.get("scene", "")),
		"to_scene": str(transition.get("worksite_scene", "")),
		"actor_local_position": to_local(actor.global_position),
		"actor_facing": _get_actor_facing(actor),
		"interior_spawn":
		VECTOR_UTIL.from_pair(transition.get("interior_entry", []), Vector2(64, 548)),
		"return_anchor": transition.get("return_anchor", {}).duplicate(true),
	}
	request.merge(run_context, true)
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
