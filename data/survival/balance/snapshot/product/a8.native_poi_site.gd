class_name NativePoiSite
extends Node2D

## Reusable, data-authored physical POI. This scene owns no inventory or save state.
## It emits versioned transaction intents and only changes persistent presentation
## after its owner returns an authoritative projection.

signal intent_requested(intent: Dictionary)
signal player_feedback(message: String)
signal projection_applied(projection: Dictionary)

const CONTRACT_ID := "soh.native_poi.intent.v1"
const CONTRACT_VERSION := 1
const WORLD_LAYER := 1
const PLAYER_LAYER := 2

@export_file("*.json") var definition_path := ""
@export var test_harness_only := true

var definition: Dictionary = {}
var site_id := ""
var display_name := ""
var projection: Dictionary = {
	"schema_version": 1,
	"site_state": {},
	"claim_generation": {},
	"capabilities": [],
	"ready_actions": [],
	"resource_ready_at": {},
	"clock_seconds": 0.0
}
var _gate_bodies: Array[StaticBody2D] = []
var _pending: Dictionary = {}
var _choice_index := 0
var _interaction_area: Area2D
var _elapsed := 0.0


func _ready() -> void:
	if not _load_definition():
		push_error("NativePoiSite has no valid definition: %s" % definition_path)
		return
	_build_physics()
	queue_redraw()


func _process(delta: float) -> void:
	_elapsed += delta
	var profile := str(definition.get("visual_profile", ""))
	if (
		profile == "mill"
		or (profile == "orchard" and get_site_state().get("orchard_channel", "") == "flowing")
	):
		queue_redraw()


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


func set_projection(owner_projection: Dictionary) -> void:
	if int(owner_projection.get("schema_version", 0)) != 1:
		player_feedback.emit("This place cannot read that state version.")
		return
	projection = owner_projection.duplicate(true)
	_refresh_gate()
	_rebuild_choice_blockers()
	queue_redraw()
	projection_applied.emit(projection)


func get_spawn_position() -> Vector2:
	return Vector2.from_array(definition.get("spawn", [90, 510]))


func get_stand_position() -> Vector2:
	return Vector2.from_array(definition.get("approach_stand", [0, 0]))


func get_action_socket() -> Vector2:
	return Vector2.from_array(definition.get("action_socket", [0, 0]))


func get_source_id() -> String:
	return str(definition.get("source", {}).get("poi_id", site_id))


func get_site_state() -> Dictionary:
	return projection.get("site_state", {}).duplicate(true)


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
		var stand := Vector2.from_array(
			action.get("stand_position", definition.get("approach_stand", [0, 0]))
		)
		var socket := Vector2.from_array(
			action.get("socket_position", definition.get("action_socket", [0, 0]))
		)
		if is_inside_interaction_radius(actor, stand, socket):
			var key := "H" if index == 0 else "Y"
			prompts.append("%s · %s" % [key, str(action.get("label", "Work"))])
	return "  |  ".join(prompts)


func cycle_choice(direction: int) -> void:
	var choices: Array = definition.get("choices", [])
	if choices.size() < 2:
		return
	_choice_index = posmod(_choice_index + direction, choices.size())
	queue_redraw()
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
	var action_stand := Vector2.from_array(
		selected.get("stand_position", definition.get("approach_stand", [0, 0]))
	)
	var action_socket := Vector2.from_array(
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
	_pending.clear()
	var outcome := str(result.get("status", "rejected"))
	if outcome == "committed":
		set_projection(new_projection)
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
		float(action.get("unlock_after_state_seconds", 0.0)) > 0.0
		and not projection.get("ready_actions", []).has(action_id)
	):
		player_feedback.emit("The water is moving; come back after the grafts have taken root.")
		return false
	var choice_group := str(action.get("choice_group", ""))
	if not choice_group.is_empty() and site_state.has(choice_group):
		player_feedback.emit("That choice has already changed this place.")
		return false
	if _pending.size() > 0:
		return false
	return true


func _make_intent(action: Dictionary) -> Dictionary:
	var object_id := str(action.get("object_id", action.get("action_id", "")))
	var action_id := str(action.get("action_id", ""))
	var source_id := get_source_id()
	var generation := int(projection.get("claim_generation", {}).get(object_id, 0))
	var claim_id := "%s/%s/%s" % [source_id, object_id, action_id]
	if str(action.get("claim_policy", "once")) == "replenishable":
		claim_id += "/g%d" % generation
	var stable := "%s|%s|%s|%s" % [source_id, object_id, action_id, claim_id]
	return {
		"contract_id": CONTRACT_ID,
		"contract_version": CONTRACT_VERSION,
		"intent_id": stable,
		"source_id": source_id,
		"object_id": object_id,
		"action_id": action_id,
		"claim_id": claim_id,
		"claim_policy": str(action.get("claim_policy", "once")),
		"cooldown_seconds": float(action.get("cooldown_seconds", 0.0)),
		"requires_capabilities": action.get("requires_capabilities", []).duplicate(),
		"required_state": action.get("requires_state", []).duplicate(),
		"required_state_values": action.get("requires_state_values", {}).duplicate(true),
		"costs": action.get("costs", {}).duplicate(true),
		"rewards": action.get("rewards", {}).duplicate(true),
		"state_delta": action.get("set_state", {}).duplicate(true),
		"unlock_actions": action.get("unlock_actions", {}).duplicate(true),
		"choice_group": str(action.get("choice_group", "")),
		"catalog_source": str(action.get("catalog_source", "")),
		"provisional_test_only": test_harness_only
	}


func _build_physics() -> void:
	for rect_data: Array in definition.get("walls", []):
		_add_solid_rect(
			Vector2(float(rect_data[0]), float(rect_data[1])),
			Vector2(float(rect_data[2]), float(rect_data[3])),
			"Wall"
		)
	_build_choice_blockers()
	var socket_positions: Array[Vector2] = [get_action_socket()]
	for action: Dictionary in definition.get("actions", []):
		var point := Vector2.from_array(
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


func _refresh_gate() -> void:
	var gates: Array = definition.get("gates", [])
	if gates.is_empty() and definition.has("gate"):
		gates = [definition.gate]
	for index: int in range(mini(gates.size(), _gate_bodies.size())):
		var gate_body := _gate_bodies[index]
		var requirement := str(gates[index].get("requires", "cap_salvage"))
		var closed := not projection.get("capabilities", []).has(requirement)
		gate_body.set_deferred("collision_layer", WORLD_LAYER if closed else 0)
		gate_body.set_deferred("collision_mask", PLAYER_LAYER if closed else 0)


func _draw() -> void:
	if definition.is_empty():
		return
	var bounds := Vector2.from_array(definition.get("world_bounds", [960, 600]))
	var palette: Dictionary = definition.get("palette", {})
	var ground := Color.from_string(str(palette.get("ground", "#303631")), Color.DARK_SLATE_GRAY)
	var alt := Color.from_string(str(palette.get("ground_alt", "#434943")), ground.lightened(0.1))
	var ink := Color.from_string(str(palette.get("ink", "#171c1b")), Color.BLACK)
	var stone := Color.from_string(str(palette.get("stone", "#988d78")), Color.GRAY)
	var accent := Color.from_string(str(palette.get("accent", "#d4a866")), Color.GOLD)
	var water := Color.from_string(str(palette.get("water", "#65b8c9")), Color.CYAN)
	draw_rect(Rect2(Vector2.ZERO, bounds), ground)
	for y in range(34, int(bounds.y) - 25, 48):
		for x in range(34 + (int(y / 48) % 2) * 24, int(bounds.x) - 25, 48):
			draw_rect(Rect2(Vector2(x), Vector2(16, 2)), alt.darkened(0.13))
	for wall: Array in definition.get("walls", []):
		var r := Rect2(
			Vector2(float(wall[0]), float(wall[1])), Vector2(float(wall[2]), float(wall[3]))
		)
		draw_rect(r.grow(3), ink)
		draw_rect(r, stone.darkened(0.18))
		draw_line(
			r.position + Vector2(3, 4),
			r.position + Vector2(r.size.x - 4, 4),
			stone.lightened(0.18),
			3.0
		)
	var profile := str(definition.get("visual_profile", ""))
	match profile:
		"quarry":
			_draw_quarry(stone, accent, ink, water)
		"orchard":
			_draw_orchard(stone, accent, ink, water, alt)
		"mill":
			_draw_mill(accent, ink, water)
		"salt_lookout":
			_draw_salt_lookout(stone, accent, ink, water, alt)
	_draw_socket(accent, ink)
	for action: Dictionary in definition.get("actions", []):
		if action.has("socket_position"):
			_draw_socket_at(Vector2.from_array(action.socket_position), water, ink)
	_draw_gate()


func _draw_quarry(stone: Color, accent: Color, ink: Color, water: Color) -> void:
	# Layered cut faces, a live split seam, hand-set wedges and quarry haul line.
	for i: int in range(5):
		var y := 116.0 + float(i) * 63.0
		draw_line(Vector2(92, y), Vector2(206, y - 14), stone.darkened(0.24), 11.0)
		draw_line(Vector2(92, y - 2), Vector2(206, y - 16), stone.lightened(0.12), 2.0)
		for j: int in range(3):
			var x := 112.0 + float(j) * 38.0
			draw_colored_polygon(
				PackedVector2Array(
					[Vector2(x, y + 5), Vector2(x + 15, y - 6), Vector2(x + 29, y + 9)]
				),
				stone.darkened(0.12 + 0.04 * j)
			)
	draw_line(Vector2(310, 92), Vector2(612, 92), accent.darkened(0.35), 4.0)
	for x: float in [330, 410, 490, 570]:
		draw_line(Vector2(x, 92), Vector2(x, 122), ink, 3.0)
	var route: String = str(get_site_state().get("quarry_route", ""))
	for option_id: String in definition.get("choice_blockers", {}):
		if (
			(option_id == "brace_oak" and route == "east_braced")
			or (option_id == "chock_stone" and route == "west_chocked")
		):
			continue
		for rect: Array in definition["choice_blockers"][option_id]:
			draw_rect(
				Rect2(
					Vector2(float(rect[0]), float(rect[1])), Vector2(float(rect[2]), float(rect[3]))
				),
				Color("#665f55")
			)
			draw_line(
				Vector2(float(rect[0]), float(rect[1]) + float(rect[3])),
				Vector2(float(rect[0]) + float(rect[2]), float(rect[1])),
				accent,
				3.0
			)
	var spent_until := float(projection.get("resource_ready_at", {}).get("south_seam_outcrop", 0.0))
	var available := float(projection.get("clock_seconds", 0.0)) >= spent_until
	var work_color := (
		(water if int(Time.get_ticks_msec() / 380) % 2 == 0 else accent)
		if available
		else stone.darkened(0.45)
	)
	draw_circle(Vector2(505, 302), 13, ink)
	draw_circle(Vector2(505, 302), 7, work_color)


func _draw_orchard(stone: Color, accent: Color, ink: Color, water: Color, foliage: Color) -> void:
	# Four distinct old grafted fruit trees and an exposed irrigation run.
	for point: Vector2 in [
		Vector2(316, 190), Vector2(656, 190), Vector2(316, 390), Vector2(656, 390)
	]:
		_draw_ellipse(point + Vector2(2, 28), Vector2(27, 10), ink.darkened(0.24))
		draw_rect(Rect2(point + Vector2(-6, -2), Vector2(12, 47)), Color("#695341"))
		draw_line(point + Vector2(-3, 11), point + Vector2(-28, -5), Color("#795c43"), 4.0)
		draw_line(point + Vector2(3, 7), point + Vector2(25, -10), Color("#795c43"), 4.0)
		draw_circle(point + Vector2(-16, -10), 18, foliage.darkened(0.15))
		draw_circle(point + Vector2(11, -18), 20, foliage)
		draw_circle(point + Vector2(23, -2), 15, foliage.lightened(0.1))
		draw_line(point + Vector2(-4, -25), point + Vector2(4, -22), accent, 3.0)
	var flowing := get_site_state().get("orchard_channel", "") == "flowing"
	var grafts_ready := projection.get("ready_actions", []).has("read_water_marks")
	var channel_color := water if flowing else stone.darkened(0.35)
	var reeds_ready := (
		float(projection.get("clock_seconds", 0.0))
		>= float(projection.get("resource_ready_at", {}).get("sluice_reeds", 0.0))
	)
	for reed_x: float in [282.0, 724.0]:
		var reed_color := Color("#93c971") if reeds_ready else stone.darkened(0.45)
		for reed_index: int in range(3):
			draw_line(
				Vector2(reed_x + float(reed_index) * 5.0, 315),
				Vector2(reed_x + float(reed_index) * 5.0 - 3.0, 299),
				reed_color,
				2.0
			)
	draw_line(Vector2(273, 292), Vector2(714, 292), channel_color, 15.0)
	draw_line(Vector2(273, 286), Vector2(714, 286), stone, 3.0)
	if flowing:
		for offset: float in [0.0, 58.0, 116.0, 174.0, 232.0, 290.0, 348.0]:
			var x := 280.0 + fposmod(offset + _elapsed * 50.0, 420.0)
			draw_line(Vector2(x, 292), Vector2(x + 18, 292), Color("#d1f3e8"), 2.0)
	else:
		draw_line(Vector2(455, 275), Vector2(475, 307), accent, 8.0)
		draw_line(Vector2(464, 274), Vector2(487, 303), ink, 3.0)
	for mark_x: float in [500.0, 518.0, 537.0, 555.0]:
		draw_line(
			Vector2(mark_x, 265),
			Vector2(mark_x + 2, 276),
			accent if get_site_state().get("cultivation_known", false) else stone,
			2.0
		)


func _draw_mill(accent: Color, ink: Color, water: Color) -> void:
	# Mill race is visible from outside; wheel and timber walk make repair legible.
	draw_rect(Rect2(Vector2(140, 266), Vector2(650, 25)), water.darkened(0.18))
	for x: float in [160.0, 216.0, 272.0, 328.0, 384.0, 440.0, 496.0, 552.0, 608.0, 664.0, 720.0]:
		var offset := fposmod(_elapsed * 22.0, 56.0)
		draw_line(Vector2(x - offset, 272), Vector2(x + 12 - offset, 272), Color("#b0e2d8"), 2.0)
	draw_rect(Rect2(Vector2(410, 150), Vector2(236, 98)), ink)
	draw_rect(Rect2(Vector2(418, 158), Vector2(220, 82)), Color("#72563e"))
	draw_rect(Rect2(Vector2(430, 170), Vector2(196, 10)), Color("#aa8051"))
	draw_rect(Rect2(Vector2(430, 218), Vector2(196, 10)), Color("#aa8051"))
	var wheel_turning := get_site_state().get("mill_wheel", "") == "turning"
	var wheel_center := Vector2(530, 204)
	var wheel_angle := _elapsed * 0.45 if wheel_turning else 0.0
	draw_circle(wheel_center, 50, ink)
	draw_circle(wheel_center, 43, Color("#926943"))
	for i: int in range(8):
		var angle := wheel_angle + TAU * float(i) / 8.0
		var tip := wheel_center + Vector2(cos(angle), sin(angle)) * 43.0
		draw_line(wheel_center, tip, accent, 6.0)
	draw_circle(wheel_center, 8, Color("#d4c49a"))
	var gates: Array = definition.get("gates", [])
	if gates.is_empty() and definition.has("gate"):
		gates = [definition.gate]
	# The candidate fastener stack has a visibly finite ready/spent state.
	var fastener_ready := (
		float(projection.get("clock_seconds", 0.0))
		>= float(projection.get("resource_ready_at", {}).get("mill_scrap_pile", 0.0))
	)
	var fastener_color := Color("#b6a77c") if fastener_ready else Color("#555d58")
	draw_rect(Rect2(Vector2(664, 222), Vector2(29, 18)), ink)
	draw_rect(Rect2(Vector2(667, 225), Vector2(23, 12)), fastener_color)
	for bolt_x: float in [671.0, 679.0, 687.0]:
		draw_circle(
			Vector2(bolt_x, 231), 2.0, Color("#d7d2b9") if fastener_ready else Color("#727973")
		)
	for gate: Dictionary in gates:
		var gate_rect: Array = gate.get("rect", [488, 314, 76, 14])
		var blocked := not projection.get("capabilities", []).has(
			str(gate.get("requires", "cap_salvage"))
		)
		var gate_color := Color("#c2764e") if blocked else Color("#7b583d")
		draw_rect(
			Rect2(
				Vector2(float(gate_rect[0]), float(gate_rect[1])),
				Vector2(float(gate_rect[2]), float(gate_rect[3]))
			),
			gate_color
		)
		draw_line(
			Vector2(float(gate_rect[0]), float(gate_rect[1]) - 5),
			Vector2(float(gate_rect[0]) + float(gate_rect[2]), float(gate_rect[1]) - 5),
			Color("#eac47b") if blocked else Color("#98d29c"),
			3.0
		)


func _draw_salt_lookout(
	stone: Color, accent: Color, ink: Color, water: Color, ground: Color
) -> void:
	# Fourth authored type from the same worksite template, with no new engine code.
	for i: int in range(7):
		var x := 110.0 + float(i) * 110.0
		draw_line(Vector2(x, 110), Vector2(x + 28, 168), stone, 7.0)
		draw_circle(Vector2(x + 36, 176), 10.0, ground.lightened(0.18))
	draw_polyline(
		PackedVector2Array(
			[
				Vector2(130, 430),
				Vector2(245, 386),
				Vector2(368, 394),
				Vector2(492, 328),
				Vector2(622, 338),
				Vector2(810, 262)
			]
		),
		accent.darkened(0.2),
		9.0,
		true
	)
	draw_circle(Vector2(500, 328), 33, water.darkened(0.15))
	draw_circle(Vector2(500, 328), 21, water)
	draw_line(Vector2(465, 328), Vector2(535, 328), ink, 4.0)


func _draw_socket(accent: Color, ink: Color) -> void:
	_draw_socket_at(get_action_socket(), accent, ink)


func _draw_socket_at(point: Vector2, accent: Color, ink: Color) -> void:
	draw_circle(point, 21, Color(ink, 0.86))
	draw_circle(point, 15, Color(accent, 0.3))
	draw_arc(point, 16.0, 0.0, TAU, 24, accent, 2.0)
	draw_line(point + Vector2(-7, 0), point + Vector2(7, 0), accent, 2.0)
	draw_line(point + Vector2(0, -7), point + Vector2(0, 7), accent, 2.0)


func _draw_gate() -> void:
	var gates: Array = definition.get("gates", [])
	if gates.is_empty() and definition.has("gate"):
		gates = [definition.gate]
	for gate: Dictionary in gates:
		var rect: Array = gate.get("rect", [0, 0, 1, 1])
		var blocked := not projection.get("capabilities", []).has(
			str(gate.get("requires", "cap_salvage"))
		)
		var color := Color("#d47e52") if blocked else Color("#8bc895")
		draw_line(
			Vector2(float(rect[0]), float(rect[1]) - 8),
			Vector2(float(rect[0]) + float(rect[2]), float(rect[1]) - 8),
			color,
			3.0
		)


func _draw_ellipse(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i: int in range(17):
		var angle := TAU * float(i) / 16.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)
