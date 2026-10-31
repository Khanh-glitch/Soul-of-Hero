class_name NativePoiPhysicalEndpoint
extends Node2D

## A8 physical socket. It emits neutral intent only; owners decide every result.

signal intent_requested(intent: Dictionary)
signal player_feedback(message: String)

const CONTEXT_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_phase_context.gd"
)
const ENDPOINT_DATA_PATH := "res://data/survival/world_content/physical_ragnarok_endpoints.v1.json"
const INTENT_CONTRACT := "soh.a8.physical_intent.v1"
const INTENT_VERSION := 1
const WORLD_LAYER := 1
const PLAYER_LAYER := 2

var definition: Dictionary = {}
var _context: NativePoiPhaseContext
var _endpoint_id := ""
var _source_id := ""
var _world_id := ""
var _pending_request_id := ""
var _presentation_key := ""
var _interaction_area: Area2D
var _collision_body: StaticBody2D
var _art: Sprite2D


# gdlint: disable=max-returns
func configure(
	endpoint_id: String,
	fixture_position_override: Vector2 = Vector2(-INF, -INF),
	catalog_path: String = ENDPOINT_DATA_PATH
) -> bool:
	var file := FileAccess.open(catalog_path, FileAccess.READ)
	if file == null:
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		return false
	var catalog_schema := str(parsed.get("schema", ""))
	if (
		catalog_schema
		not in [
			"soh.a8.physical_ragnarok_endpoints.v1", "soh.a8.ordinary_waystation_opportunity.v1"
		]
	):
		return false
	_world_id = str(parsed.get("world_id", ""))
	for endpoint_value: Variant in parsed.get("endpoints", []):
		if (
			endpoint_value is Dictionary
			and str(endpoint_value.get("endpoint_id", "")) == endpoint_id
		):
			definition = endpoint_value.duplicate(true)
			break
	if definition.is_empty() or _world_id.is_empty():
		return false
	_endpoint_id = str(definition.get("endpoint_id", ""))
	_source_id = str(definition.get("existing_poi_id", ""))
	_presentation_key = str(definition.get("presentation_key", ""))
	if _endpoint_id.is_empty() or _source_id.is_empty() or _presentation_key.is_empty():
		return false
	_context = CONTEXT_SCRIPT.new() as NativePoiPhaseContext
	if not _context.configure({"source": {"poi_id": _source_id, "world_id": _world_id}}):
		return false
	position = (
		fixture_position_override
		if fixture_position_override.x != -INF
		else Vector2(
			float(definition.fixture_position_px[0]), float(definition.fixture_position_px[1])
		)
	)
	_build_physical_object()
	return true


func apply_run_phase_projection(projection: Dictionary) -> bool:
	if _context == null:
		return false
	return _context.apply_projection(projection)


func get_endpoint_id() -> String:
	return _endpoint_id


func get_source_id() -> String:
	return _source_id


func get_presentation_key() -> String:
	return _presentation_key


func get_interaction_stand_position() -> Vector2:
	var stand_offset: Array = definition.get("fixture_stand_offset_px", [0, 42])
	if stand_offset.size() != 2:
		return global_position + Vector2(0.0, 42.0)
	return global_position + Vector2(float(stand_offset[0]), float(stand_offset[1]))


func get_fixture_position() -> Vector2:
	return position


func get_run_context() -> Dictionary:
	return _context.get_run_context() if _context != null else {}


func has_pending_request() -> bool:
	return not _pending_request_id.is_empty()


func get_pending_request_id() -> String:
	return _pending_request_id


func get_interaction_area() -> Area2D:
	return _interaction_area


func get_collision_body() -> StaticBody2D:
	return _collision_body


# gdlint: disable=max-returns
func try_interact(actor: Node2D) -> bool:
	if actor == null or not is_instance_valid(actor) or not actor is CharacterBody2D:
		player_feedback.emit("Move to the marked machine stand first.")
		return false
	if _context == null or not _context.is_initialized() or not _context.permits_mutating_intents():
		player_feedback.emit("The run owner has not supplied an active phase.")
		return false
	var available_phases: Array = definition.get("available_phases", [])
	if not available_phases.has(_context.get_phase_id()):
		player_feedback.emit("This physical station is not available in the owner-projected phase.")
		return false
	if not _pending_request_id.is_empty():
		player_feedback.emit("The owner still has this physical request pending.")
		return false
	var stand := get_interaction_stand_position()
	var socket_world := global_position
	if actor.global_position.distance_to(stand) > 18.0:
		player_feedback.emit("Approach the marked side of the station.")
		return false
	var interaction_radius := float(definition.get("interaction_radius_px", 62.0))
	if actor.global_position.distance_to(socket_world) > interaction_radius:
		player_feedback.emit("Move closer to the station.")
		return false
	var toward_socket := (socket_world - actor.global_position).normalized()
	if _get_actor_facing(actor).dot(toward_socket) < 0.55:
		player_feedback.emit("Face the station's marked interaction side.")
		return false
	var context := _context.get_run_context()
	var actor_local_position := to_local(actor.global_position)
	var actor_facing := _get_actor_facing(actor)
	var request_id := (
		"%s|%s|%s|%s|%d|%s|%d"
		% [
			context.run_id,
			context.site_instance_id,
			_endpoint_id,
			str(definition.get("action_id", "")),
			int(context.run_epoch),
			str(context.phase_id),
			int(context.observed_phase_projection_revision)
		]
	)
	var intent := {
		"contract_id": INTENT_CONTRACT,
		"contract_version": INTENT_VERSION,
		"request_id": request_id,
		"world_id": _world_id,
		"run_id": str(context.get("run_id", "")),
		"run_epoch": int(context.get("run_epoch", -1)),
		"phase_id": str(context.get("phase_id", "")),
		"observed_phase_projection_revision":
		int(context.get("observed_phase_projection_revision", -1)),
		"poi_id": _source_id,
		"site_instance_id": str(context.get("site_instance_id", "")),
		"endpoint_id": _endpoint_id,
		"action_id": str(definition.get("action_id", "")),
		"actor_local_position": actor_local_position,
		"actor_facing": actor_facing
	}
	_pending_request_id = request_id
	intent_requested.emit(intent.duplicate(true))
	return true


func resolve_owner_disposition(request_id: String, disposition: String) -> bool:
	if request_id != _pending_request_id:
		return false
	if disposition != "rejected" and disposition != "interrupted":
		return false
	_pending_request_id = ""
	return true


func _build_physical_object() -> void:
	_collision_body = StaticBody2D.new()
	_collision_body.name = "PhysicalEndpointCollision"
	_collision_body.collision_layer = WORLD_LAYER
	_collision_body.collision_mask = PLAYER_LAYER
	var shape := RectangleShape2D.new()
	var collision_size: Array = definition.get("collision_size_px", [28, 28])
	if collision_size.size() != 2:
		collision_size = [28, 28]
	shape.size = Vector2(float(collision_size[0]), float(collision_size[1]))
	var collision := CollisionShape2D.new()
	collision.shape = shape
	var collision_offset: Array = definition.get("collision_offset_px", [0, 0])
	if collision_offset.size() == 2:
		collision.position = Vector2(float(collision_offset[0]), float(collision_offset[1]))
	_collision_body.add_child(collision)
	add_child(_collision_body)

	_interaction_area = Area2D.new()
	_interaction_area.name = "PhysicalInteractionArea"
	_interaction_area.collision_layer = 0
	_interaction_area.collision_mask = PLAYER_LAYER
	_interaction_area.monitoring = true
	var area_shape := CircleShape2D.new()
	area_shape.radius = float(definition.get("interaction_radius_px", 62.0))
	var area_collision := CollisionShape2D.new()
	area_collision.shape = area_shape
	_interaction_area.add_child(area_collision)
	add_child(_interaction_area)

	var manifest := _load_art_manifest()
	if manifest.is_empty():
		return
	_art = _make_source_sprite(
		manifest,
		str(definition.get("art_frame", "")),
		"SourceAtlasEndpointPresentation",
		Vector2.ZERO,
		float(definition.get("art_scale", 1.5))
	)
	if _art != null:
		_art.set_meta("presentation_key", _presentation_key)
	var accent_value: Variant = definition.get("accent_art_frame", "")
	var accent_frame := str(accent_value) if accent_value is String else ""
	if not accent_frame.is_empty():
		var accent_position: Array = definition.get("accent_art_position_px", [0, -12])
		var accent_offset := (
			Vector2(float(accent_position[0]), float(accent_position[1]))
			if accent_position.size() == 2
			else Vector2(0.0, -12.0)
		)
		var accent := _make_source_sprite(
			manifest,
			accent_frame,
			"SourceAtlasEndpointAccent",
			accent_offset,
			float(definition.get("accent_art_scale", 1.0))
		)
		if accent != null:
			accent.set_meta("presentation_key", _presentation_key)
	var label_text := str(definition.get("trial_affordance_label", ""))
	if not label_text.is_empty():
		var affordance := Label.new()
		affordance.name = "TrialAffordanceLabel"
		affordance.text = label_text
		affordance.position = Vector2(-48.0, -34.0)
		affordance.size = Vector2(96.0, 16.0)
		affordance.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		affordance.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		affordance.add_theme_font_size_override("font_size", 10)
		affordance.add_theme_color_override("font_color", Color("#f6e5ae"))
		affordance.add_theme_color_override("font_outline_color", Color("#17211d"))
		affordance.add_theme_constant_override("outline_size", 2)
		affordance.mouse_filter = Control.MOUSE_FILTER_IGNORE
		affordance.set_meta("is_trial_affordance_only", true)
		add_child(affordance)


func _load_art_manifest() -> Dictionary:
	var manifest_file := FileAccess.open(
		"res://data/survival/world_content/a8_art_manifest.v1.json", FileAccess.READ
	)
	if manifest_file == null:
		return {}
	var manifest_value: Variant = JSON.parse_string(manifest_file.get_as_text())
	manifest_file.close()
	return manifest_value if manifest_value is Dictionary else {}


func _make_source_sprite(
	manifest: Dictionary,
	frame_name: String,
	node_name: String,
	local_position: Vector2,
	sprite_scale: float
) -> Sprite2D:
	var frame: Array = manifest.get("props_frames", {}).get(frame_name, [])
	if frame.size() != 4:
		return null
	var texture_path := str(manifest.get("textures", {}).get("props", {}).get("path", ""))
	var atlas := load(texture_path) as Texture2D
	if atlas == null:
		return null
	var atlas_texture := AtlasTexture.new()
	atlas_texture.atlas = atlas
	atlas_texture.region = Rect2(float(frame[0]), float(frame[1]), float(frame[2]), float(frame[3]))
	var sprite := Sprite2D.new()
	sprite.name = node_name
	sprite.texture = atlas_texture
	sprite.scale = Vector2.ONE * sprite_scale
	sprite.position = local_position
	sprite.z_index = 10
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(sprite)
	return sprite

func _get_actor_facing(actor: CharacterBody2D) -> Vector2:
	if actor.has_method("get_facing_direction"):
		var facing_value: Variant = actor.call("get_facing_direction")
		if facing_value is Vector2 and facing_value.length_squared() > 0.01:
			return facing_value.normalized()
	for property: Dictionary in actor.get_property_list():
		if str(property.get("name", "")) in ["facing", "last_facing"]:
			var value: Variant = actor.get(str(property.name))
			if value is Vector2 and value.length_squared() > 0.01:
				return value.normalized()
	return actor.velocity.normalized() if actor.velocity.length_squared() > 0.01 else Vector2.UP
