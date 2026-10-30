class_name NativePoiSite
extends Node2D

## Reusable, data-authored physical POI. This scene owns no inventory or save state.
## It emits versioned transaction intents and only changes persistent presentation
## after its owner returns an authoritative projection.

signal intent_requested(intent: Dictionary)
signal player_feedback(message: String)
signal projection_applied(projection: Dictionary)
signal transition_requested(request: Dictionary)

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const SURFACE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_surface_contract.gd"
)
const ART_SCRIPT := preload("res://game/survival/world_content/scripts/native_poi_art.gd")
const CONTRACT_ID := "soh.native_poi.intent.v2"
const CONTRACT_VERSION := 2
const WORLD_LAYER := 1
const PLAYER_LAYER := 2
@export_file("*.json") var definition_path := ""

var definition: Dictionary = {}
var site_id := ""
var display_name := ""
var projection: Dictionary = {
	"schema_version": 1,
	"source_id": "",
	"projection_revision": -1,
	"site_state": {},
	"claim_generation": {},
	"capabilities": [],
	"ready_actions": [],
	"resource_ready_at": {},
	"clock_seconds": 0.0
}
var _projection_revision := -1
var _projection_initialized := false
var _gate_bodies: Array[StaticBody2D] = []
var _pending: Dictionary = {}
var _surface_contract: Dictionary = {}
var _surface_blockers: Array[Dictionary] = []
var _environment_projection: Dictionary = {}
var _environment_projection_revision := -1
var _choice_index := 0
var _interaction_area: Area2D
var _exit_area: Area2D
var _art: Node2D


func _ready() -> void:
	if not _load_definition():
		push_error("NativePoiSite has no valid definition: %s" % definition_path)
		return
	_surface_contract = SURFACE_SCRIPT.site_surface(get_source_id())
	_environment_projection = SURFACE_SCRIPT.unknown_environment(get_source_id())
	if not definition.has("visual_layout") and bool(definition.get("test_only", false)):
		_build_physics()
		return
	_art = ART_SCRIPT.new() as Node2D
	_art.name = "SourceBackedWorldArt"
	add_child(_art)
	if not _art.call("configure", definition, false):
		push_error("NativePoiSite art layout or source-cleared atlas failed to load: %s" % site_id)
		remove_child(_art)
		_art.queue_free()
		_art = null
		_build_physics()
		return
	_art.call("set_environment_projection", _environment_projection)
	_build_physics()


func _load_definition() -> bool:
	if definition_path.is_empty() or not FileAccess.file_exists(definition_path):
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(definition_path))
	if not parsed is Dictionary:
		return false
	definition = parsed
	site_id = str(definition.get("site_id", ""))
	display_name = str(definition.get("display_name", ""))
	return (
		not site_id.is_empty()
		and definition.has("source")
		and definition.has("choices")
		and definition.has("actions")
	)


# gdlint: disable=max-returns
func set_projection(owner_projection: Dictionary) -> bool:
	if int(owner_projection.get("schema_version", 0)) != 1:
		player_feedback.emit("This place cannot read that state version.")
		return false
	if str(owner_projection.get("source_id", "")) != get_source_id():
		player_feedback.emit("This place received state for a different site.")
		return false
	var revision_value: Variant = owner_projection.get("projection_revision", null)
	if typeof(revision_value) != TYPE_INT or int(revision_value) < 0:
		player_feedback.emit("This place received an invalid owner-state revision.")
		return false
	var revision := int(revision_value)
	if _projection_initialized:
		if revision < _projection_revision:
			player_feedback.emit("A newer owner-state revision is already active here.")
			return false
		if revision == _projection_revision:
			if _projection_payload_matches(owner_projection):
				return true
			player_feedback.emit("Conflicting site state used the same owner revision.")
			return false
	var owner_state: Variant = owner_projection.get("site_state", null)
	var generation: Variant = owner_projection.get("claim_generation", null)
	var capabilities: Variant = owner_projection.get("capabilities", null)
	var ready_actions: Variant = owner_projection.get("ready_actions", null)
	var ready_at: Variant = owner_projection.get("resource_ready_at", null)
	var owner_clock: Variant = owner_projection.get("clock_seconds", null)
	if (
		not owner_state is Dictionary
		or not generation is Dictionary
		or not capabilities is Array
		or not ready_actions is Array
		or not ready_at is Dictionary
		or (typeof(owner_clock) != TYPE_INT and typeof(owner_clock) != TYPE_FLOAT)
		or not is_finite(float(owner_clock))
		or float(owner_clock) < 0.0
	):
		player_feedback.emit("This place received malformed owner state.")
		return false
	projection = owner_projection.duplicate(true)
	_projection_revision = revision
	_projection_initialized = true
	if is_instance_valid(_art):
		_art.call("set_site_state", projection.get("site_state", {}))
	_refresh_gate()
	_rebuild_choice_blockers()
	_refresh_surface_blockers()
	projection_applied.emit(projection)
	return true


func _projection_payload_matches(candidate: Dictionary) -> bool:
	for field: String in [
		"schema_version",
		"source_id",
		"site_state",
		"claim_generation",
		"capabilities",
		"ready_actions",
		"resource_ready_at",
		"clock_seconds"
	]:
		if projection.get(field) != candidate.get(field):
			return false
	return true


func get_spawn_position() -> Vector2:
	return VECTOR_UTIL.from_pair(definition.get("spawn", [90, 510]))


func get_stand_position() -> Vector2:
	return VECTOR_UTIL.from_pair(definition.get("approach_stand", [0, 0]))


func get_action_socket() -> Vector2:
	return VECTOR_UTIL.from_pair(definition.get("action_socket", [0, 0]))


func get_exit_position() -> Vector2:
	return VECTOR_UTIL.from_pair(
		definition.get("local_transition", {}).get("exit_portal", [-1, -1]), Vector2(-1, -1)
	)


func is_at_exit(actor: Node2D) -> bool:
	var exit_position := get_exit_position()
	return (
		actor != null
		and is_instance_valid(actor)
		and exit_position.x >= 0.0
		and actor.global_position.distance_to(global_position + exit_position) <= 22.0
	)


func try_exit(actor: Node2D) -> bool:
	if not actor is CharacterBody2D or not is_at_exit(actor):
		player_feedback.emit("Follow the marked doorway to return outside.")
		return false
	if _get_actor_facing(actor).dot(Vector2.DOWN) < 0.55:
		player_feedback.emit("Face out through the doorway to return.")
		return false
	var transition: Dictionary = definition.get("local_transition", {})
	var anchor: Dictionary = transition.get("return_anchor", {}).duplicate(true)
	var canonical_cell: Vector2i = VECTOR_UTIL.from_int_pair(
		definition.get("source", {}).get("canonical_cell", [0, 0])
	)
	var request := {
		"contract_id": "soh.native_poi.transition.v1",
		"contract_version": 1,
		"transition_id": "%s|exit|%d" % [get_source_id(), Time.get_ticks_usec()],
		"direction": "exit",
		"world_id": str(definition.get("source", {}).get("world_id", "")),
		"poi_id": get_source_id(),
		"canonical_cell": canonical_cell,
		"from_scene": str(transition.get("worksite_scene", "")),
		"to_scene": str(transition.get("shell_scene", "")),
		"actor_local_position": to_local(actor.global_position),
		"return_anchor": anchor,
	}
	transition_requested.emit(request)
	return true


func get_source_id() -> String:
	return str(definition.get("source", {}).get("poi_id", site_id))


func get_site_state() -> Dictionary:
	return projection.get("site_state", {}).duplicate(true)


func apply_environment_projection(owner_context: Dictionary) -> bool:
	var normalized: Dictionary = SURFACE_SCRIPT.normalize_environment_projection(
		owner_context, get_source_id()
	)
	if normalized.is_empty():
		return false
	var revision := int(normalized.get("projection_revision", -1))
	if revision < _environment_projection_revision:
		return false
	if revision == _environment_projection_revision:
		return normalized == _environment_projection
	_environment_projection_revision = revision
	_environment_projection = normalized
	if is_instance_valid(_art):
		_art.call("set_environment_projection", _environment_projection)
	return true


func get_environment_presentation() -> Dictionary:
	return _environment_projection.duplicate(true)


func is_inside_interaction_radius(
	actor: Node2D,
	stand_override: Vector2 = Vector2(-INF, -INF),
	socket_override: Vector2 = Vector2(-INF, -INF)
) -> bool:
	if actor == null or not is_instance_valid(actor):
		return false
	var socket := get_action_socket() if socket_override.x == -INF else socket_override
	var stand := get_stand_position() if stand_override.x == -INF else stand_override
	return (
		actor.global_position.distance_to(global_position + stand) <= 30.0
		and (
			actor.global_position.distance_to(global_position + socket)
			<= float(definition.get("interaction_radius", 80.0))
		)
	)


func get_context_hint(actor: Node2D) -> String:
	var prompts: Array[String] = []
	if is_at_exit(actor):
		prompts.append("G · Return to the exterior")
	if is_inside_interaction_radius(actor, get_stand_position(), get_action_socket()):
		var choices: Array = definition.get("choices", [])
		if not choices.is_empty():
			prompts.append(
				(
					"G · %s ([ ] change)"
					% str(choices[_choice_index % choices.size()].get("label", ""))
				)
			)
	var actions: Array = definition.get("actions", [])
	for index: int in range(actions.size()):
		var action: Dictionary = actions[index]
		var stand := VECTOR_UTIL.from_pair(
			action.get("stand_position", definition.get("approach_stand", [0, 0]))
		)
		var socket := VECTOR_UTIL.from_pair(
			action.get("socket_position", definition.get("action_socket", [0, 0]))
		)
		if is_inside_interaction_radius(actor, stand, socket):
			var key := "H" if index == 0 else "Y"
			var remaining := _cooldown_remaining(action)
			if remaining > 0.0:
				prompts.append(
					(
						"%s · %s · ready in %s"
						% [key, str(action.get("label", "Work")), _format_duration(remaining)]
					)
				)
			else:
				prompts.append("%s · %s" % [key, str(action.get("label", "Work"))])
	return "  |  ".join(prompts)


func cycle_choice(direction: int) -> void:
	var choices: Array = definition.get("choices", [])
	if choices.size() < 2:
		return
	_choice_index = posmod(_choice_index + direction, choices.size())
	player_feedback.emit(str(choices[_choice_index].get("label", "")))


# gdlint: disable=max-returns
func try_interact(actor: Node2D, action_index: int = -1) -> bool:
	if not actor is CharacterBody2D:
		player_feedback.emit("Move to the marked work side first.")
		return false
	if not _pending.is_empty():
		player_feedback.emit("Finish the pending action first.")
		return false

	var choices: Array = definition.get("choices", [])
	var actions: Array = definition.get("actions", [])
	var selected: Dictionary
	if action_index < 0:
		if not choices.is_empty():
			selected = choices[_choice_index % choices.size()]
		else:
			return false
	else:
		if action_index >= actions.size():
			return false
		selected = actions[action_index]
	var action_stand := VECTOR_UTIL.from_pair(
		selected.get("stand_position", definition.get("approach_stand", [0, 0]))
	)
	var action_socket := VECTOR_UTIL.from_pair(
		selected.get("socket_position", definition.get("action_socket", [0, 0]))
	)
	if not is_inside_interaction_radius(actor, action_stand, action_socket):
		player_feedback.emit("Move to the marked work side first.")
		return false
	var facing := _get_actor_facing(actor)
	var stand_to_socket := (action_socket - action_stand).normalized()
	if facing.normalized().dot(stand_to_socket) < 0.55:
		player_feedback.emit("Face the tool marks at the socket.")
		return false
	if not _action_is_available(selected):
		return false
	var intent := _make_intent(selected)
	_pending = intent
	intent_requested.emit(intent.duplicate(true))
	return true


func receive_authoritative_result(
	intent_id: String, result: Dictionary, new_projection: Dictionary
) -> bool:
	if _pending.is_empty() or str(_pending.get("intent_id", "")) != intent_id:
		return false
	if str(result.get("intent_id", "")) != intent_id:
		return false
	var outcome := str(result.get("status", ""))
	if outcome != "committed" and outcome != "rejected" and outcome != "interrupted":
		return false
	_pending.clear()
	if outcome == "committed":
		if not set_projection(new_projection):
			player_feedback.emit(
				"The owner committed the work; refresh this site's state before continuing."
			)
			return false
		player_feedback.emit(str(result.get("feedback", "The work is done.")))
	else:
		player_feedback.emit(str(result.get("reason", "The owner rejected the work.")))
	return true


func has_pending_intent() -> bool:
	return not _pending.is_empty()


func _get_actor_facing(actor: CharacterBody2D) -> Vector2:
	if actor.has_method("get_facing_direction"):
		var method_facing: Variant = actor.call("get_facing_direction")
		if method_facing is Vector2 and method_facing.length_squared() > 0.01:
			return method_facing.normalized()
	for property: Dictionary in actor.get_property_list():
		if str(property.get("name", "")) in ["facing", "last_facing"]:
			var value: Variant = actor.get(str(property.name))
			if value is Vector2 and value.length_squared() > 0.01:
				return value.normalized()
	if actor.velocity.length_squared() > 0.01:
		return actor.velocity.normalized()
	return Vector2.UP


func _cooldown_remaining(action: Dictionary) -> float:
	# A8 only displays the owner-projected remaining time. It never authors the
	# interval or sends it with the action request.
	var object_id := str(action.get("object_id", action.get("action_id", "")))
	var ready_at := float(projection.get("resource_ready_at", {}).get(object_id, 0.0))
	return maxf(0.0, ready_at - float(projection.get("clock_seconds", 0.0)))


func _format_duration(seconds: float) -> String:
	var whole_seconds := int(ceil(seconds))
	var minutes := floori(float(whole_seconds) / 60.0)
	return "%d:%02d" % [minutes, whole_seconds % 60]


func _action_is_available(action: Dictionary) -> bool:
	for capability: String in action.get("requires_capabilities", []):
		if not projection.get("capabilities", []).has(capability):
			player_feedback.emit(
				(
					"You can inspect from here; salvage access is not yet available."
					if capability == "cap_salvage"
					else "Required capability is not available."
				)
			)
			return false
	var site_state: Dictionary = projection.get("site_state", {})
	for state_key: String in action.get("requires_state", []):
		if (
			not site_state.has(state_key)
			or site_state[state_key] == false
			or site_state[state_key] == ""
		):
			player_feedback.emit("The site has not reached that condition yet.")
			return false
	var state_value_requirements: Dictionary = action.get("requires_state_values", {})
	for state_key: String in state_value_requirements:
		if not state_value_requirements[state_key].has(site_state.get(state_key, null)):
			player_feedback.emit("The seam is still unstable; choose a safe brace route first.")
			return false
	var action_id := str(action.get("action_id", ""))
	if (
		bool(action.get("owner_ready_required", false))
		and not projection.get("ready_actions", []).has(action_id)
	):
		player_feedback.emit("The water is moving; come back after the grafts have taken root.")
		return false
	var cooldown_remaining := _cooldown_remaining(action)
	if cooldown_remaining > 0.0:
		player_feedback.emit(
			"The work face is recovering. Ready in %s." % _format_duration(cooldown_remaining)
		)
		return false
	var choice_group := str(action.get("choice_group", ""))
	if not choice_group.is_empty() and site_state.has(choice_group):
		player_feedback.emit("That choice has already changed this place.")
		return false
	if _pending.size() > 0:
		return false
	return true


func _make_intent(action: Dictionary) -> Dictionary:
	# This request carries neutral identity only. A0 must resolve the A1 source,
	# current generation, all economics and the durable receipt from owner data;
	# no scene-authored fixture amount or client flag crosses this boundary.
	var object_id := str(action.get("object_id", action.get("action_id", "")))
	var action_id := str(action.get("action_id", ""))
	var source_id := get_source_id()
	var generation := int(projection.get("claim_generation", {}).get(object_id, 0))
	var claim_id := "%s/%s/%s/g%d" % [source_id, object_id, action_id, generation]
	var stable := "%s|%s|%s|%s" % [source_id, object_id, action_id, claim_id]
	return {
		"contract_id": CONTRACT_ID,
		"contract_version": CONTRACT_VERSION,
		"intent_id": stable,
		"source_id": source_id,
		"object_id": object_id,
		"action_id": action_id,
		"claim_id": claim_id,
		"observed_projection_revision": int(projection.get("projection_revision", -1))
	}


func _build_physics() -> void:
	for rect_data: Array in definition.get("walls", []):
		_add_solid_rect(
			Vector2(float(rect_data[0]), float(rect_data[1])),
			Vector2(float(rect_data[2]), float(rect_data[3])),
			"Wall"
		)
	_build_surface_blockers()
	_build_choice_blockers()
	var socket_positions: Array[Vector2] = [get_action_socket()]
	for action: Dictionary in definition.get("actions", []):
		var point := VECTOR_UTIL.from_pair(
			action.get("socket_position", definition.get("action_socket", [0, 0]))
		)
		if not socket_positions.has(point):
			socket_positions.append(point)
	for point: Vector2 in socket_positions:
		var area := Area2D.new()
		area.name = (
			"PhysicalActionSocket"
			if point == get_action_socket()
			else "PhysicalActionSocket_%d" % socket_positions.find(point)
		)
		area.collision_layer = 0
		area.collision_mask = PLAYER_LAYER
		area.monitoring = true
		var shape := CircleShape2D.new()
		shape.radius = float(definition.get("interaction_radius", 80.0))
		var collision := CollisionShape2D.new()
		collision.shape = shape
		area.add_child(collision)
		area.position = point
		add_child(area)
		if point == get_action_socket():
			_interaction_area = area
	var gates: Array = definition.get("gates", [])
	if gates.is_empty() and definition.has("gate"):
		gates = [definition.gate]
	for index: int in range(gates.size()):
		var gate: Dictionary = gates[index]
		var rect: Array = gate.get("rect", [0, 0, 1, 1])
		var gate_body := StaticBody2D.new()
		gate_body.name = "CapabilityGate_%d" % index
		gate_body.collision_layer = WORLD_LAYER
		gate_body.collision_mask = PLAYER_LAYER
		var gate_shape := RectangleShape2D.new()
		gate_shape.size = Vector2(float(rect[2]), float(rect[3]))
		var gate_collision := CollisionShape2D.new()
		gate_collision.shape = gate_shape
		gate_body.add_child(gate_collision)
		gate_body.position = Vector2(
			float(rect[0]) + float(rect[2]) * 0.5, float(rect[1]) + float(rect[3]) * 0.5
		)
		add_child(gate_body)
		_gate_bodies.append(gate_body)
	_refresh_gate()
	var exit_position := get_exit_position()
	if exit_position.x >= 0.0:
		_exit_area = Area2D.new()
		_exit_area.name = "PhysicalExteriorExit"
		_exit_area.collision_layer = 0
		_exit_area.collision_mask = PLAYER_LAYER
		_exit_area.monitoring = true
		var exit_shape := CircleShape2D.new()
		exit_shape.radius = 22.0
		var exit_collision := CollisionShape2D.new()
		exit_collision.shape = exit_shape
		_exit_area.add_child(exit_collision)
		_exit_area.position = exit_position
		add_child(_exit_area)


func _build_surface_blockers() -> void:
	_surface_blockers.clear()
	for blocker: Dictionary in _surface_contract.get("physical_blockers", []):
		var rect: Array = blocker.get("rect_px", [])
		if rect.size() != 4 or float(rect[2]) <= 0.0 or float(rect[3]) <= 0.0:
			continue
		var body := _add_solid_rect(
			Vector2(float(rect[0]), float(rect[1])),
			Vector2(float(rect[2]), float(rect[3])),
			"SurfaceBlocker_%s" % str(blocker.get("blocker_id", "unknown"))
		)
		_surface_blockers.append({"body": body, "definition": blocker.duplicate(true)})
	_refresh_surface_blockers()


func _refresh_surface_blockers() -> void:
	var site_state: Dictionary = projection.get("site_state", {})
	for entry: Dictionary in _surface_blockers:
		var body := entry.get("body") as StaticBody2D
		if not is_instance_valid(body):
			continue
		var blocker: Dictionary = entry.get("definition", {})
		var enabled := true
		var disabled_states: Dictionary = blocker.get("when_site_state_not", {})
		for state_key: String in disabled_states:
			var allowed: Array = disabled_states[state_key]
			if allowed.has(site_state.get(state_key, null)):
				enabled = false
		body.set_deferred("collision_layer", WORLD_LAYER if enabled else 0)
		body.set_deferred("collision_mask", PLAYER_LAYER if enabled else 0)


func _build_choice_blockers() -> void:
	for option_id: String in definition.get("choice_blockers", {}):
		var expected_route := "east_braced" if option_id == "brace_oak" else "west_chocked"
		if str(projection.get("site_state", {}).get("quarry_route", "")) == expected_route:
			continue
		for rect_data: Array in definition["choice_blockers"][option_id]:
			_add_solid_rect(
				Vector2(float(rect_data[0]), float(rect_data[1])),
				Vector2(float(rect_data[2]), float(rect_data[3])),
				"ChoiceBlocker_%s" % option_id
			)


func _rebuild_choice_blockers() -> void:
	for child: Node in get_children():
		if str(child.name).begins_with("ChoiceBlocker_"):
			remove_child(child)
			child.queue_free()
	_build_choice_blockers()


func _add_solid_rect(at: Vector2, size: Vector2, label: String) -> StaticBody2D:
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
	return body


func _gate_is_blocked(gate: Dictionary) -> bool:
	if not projection.get("capabilities", []).has(str(gate.get("requires", "cap_salvage"))):
		return true
	var state_values: Dictionary = gate.get("requires_state_values", {})
	var site_state: Dictionary = projection.get("site_state", {})
	for state_key: String in state_values:
		if not state_values[state_key].has(site_state.get(state_key, null)):
			return true
	return false


func _refresh_gate() -> void:
	var gates: Array = definition.get("gates", [])
	if gates.is_empty() and definition.has("gate"):
		gates = [definition.gate]
	for index: int in range(mini(gates.size(), _gate_bodies.size())):
		var gate_body := _gate_bodies[index]
		var closed := _gate_is_blocked(gates[index])
		gate_body.set_deferred("collision_layer", WORLD_LAYER if closed else 0)
		gate_body.set_deferred("collision_mask", PLAYER_LAYER if closed else 0)
