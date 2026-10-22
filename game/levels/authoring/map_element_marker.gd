@tool
class_name MapElementMarker
extends Node2D

## Editor-only representation of one entry in a level document's `entities` array.
## Drag a preset scene below this node's authoring container. At runtime the marker
## hides itself and disables processing; game/main.gd continues to spawn the real
## gameplay scene from the validated JSON document.

const REGISTERED_ENTITY_TYPES := [
	"player",
	"skeleton",
	"skeleton_reaper",
	"bone_reaper_captain",
	"hooded_archer_miniboss",
	"vampire",
	"coin",
	"sigil",
	"checkpoint",
	"chest",
	"bow_reward",
	"exit_gate",
	"floor_door",
	"spikes",
	"torch",
]
const ENEMY_TYPES := ["skeleton", "skeleton_reaper", "bone_reaper_captain", "hooded_archer_miniboss", "vampire"]

@export_category("Map element")
@export_enum(
	"player",
	"skeleton",
	"skeleton_reaper",
	"bone_reaper_captain",
	"hooded_archer_miniboss",
	"vampire",
	"coin",
	"sigil",
	"checkpoint",
	"chest",
	"bow_reward",
	"exit_gate",
	"floor_door",
	"spikes",
	"torch"
) var entity_type := "coin":
	set(value):
		entity_type = value
		queue_redraw()
		update_configuration_warnings()

## Leave blank to derive a stable snake_case ID from the node name. Explicit IDs
## are recommended for encounter enemies because Encounter Resources reference it.
@export var entity_id := "":
	set(value):
		entity_id = value.strip_edges()
		update_configuration_warnings()

@export_multiline var authoring_note := ""

@export_category("Enemy settings")
@export_range(8.0, 600.0, 1.0) var patrol_distance := 72.0

@export_category("Chest settings")
@export_range(0, 9999, 1) var chest_score_reward := 150

@export_category("Floor door settings")
## Drag the paired destination marker here. Its current position will be exported,
## so moving either door does not require editing a coordinate by hand.
@export_node_path("Node2D") var door_target_marker: NodePath
## Used when no paired marker is assigned. The import helper preserves the JSON
## target here and automatically links paired floor-door markers where possible.
@export var door_target_position := Vector2.ZERO
@export var door_label := "Door"
@export_multiline var door_message := "Nhấn chuột trái để đi qua cửa"

@export_category("Editor preview")
@export var display_name := "Map element":
	set(value):
		display_name = value
		queue_redraw()
@export var marker_color := Color(0.32, 0.76, 1.0, 1.0):
	set(value):
		marker_color = value
		queue_redraw()
@export var preview_texture: Texture2D:
	set(value):
		preview_texture = value
		queue_redraw()
@export_range(1, 64, 1) var preview_columns := 1:
	set(value):
		preview_columns = maxi(1, value)
		queue_redraw()
@export_range(1, 64, 1) var preview_rows := 1:
	set(value):
		preview_rows = maxi(1, value)
		queue_redraw()
@export_range(0, 4095, 1) var preview_frame := 0:
	set(value):
		preview_frame = maxi(0, value)
		queue_redraw()
@export var preview_scale := Vector2.ONE:
	set(value):
		preview_scale = value
		queue_redraw()
@export var preview_offset := Vector2.ZERO:
	set(value):
		preview_offset = value
		queue_redraw()
@export var preview_tint := Color.WHITE:
	set(value):
		preview_tint = value
		queue_redraw()


func _ready() -> void:
	if Engine.is_editor_hint():
		show()
		queue_redraw()
		update_configuration_warnings()
		return
	# Authoring nodes never become gameplay actors and never duplicate the JSON
	# spawned actor. Keeping them in the packed level is therefore runtime-safe.
	hide()
	process_mode = Node.PROCESS_MODE_DISABLED
	set_process(false)
	set_physics_process(false)
	set_process_input(false)
	set_process_unhandled_input(false)


func get_effective_entity_id() -> String:
	if not entity_id.is_empty():
		return entity_id
	var fallback := String(name).to_snake_case().strip_edges()
	return fallback if not fallback.is_empty() else entity_type


func make_entity_dictionary(
		level_position: Vector2,
		resolved_door_target: Vector2 = Vector2.INF,
) -> Dictionary:
	var entity := {
		"id": get_effective_entity_id(),
		"type": entity_type,
		"position": [_clean_number(level_position.x), _clean_number(level_position.y)],
	}
	if entity_type in ENEMY_TYPES:
		entity["patrol"] = _clean_number(patrol_distance)
	elif entity_type == "chest":
		entity["score_reward"] = chest_score_reward
	elif entity_type == "floor_door":
		var target := (
			resolved_door_target
			if resolved_door_target != Vector2.INF
			else door_target_position
		)
		entity["target_position"] = [_clean_number(target.x), _clean_number(target.y)]
		entity["label"] = door_label
		entity["message"] = door_message
	return entity


func _get_configuration_warnings() -> PackedStringArray:
	var warnings := PackedStringArray()
	if entity_type not in REGISTERED_ENTITY_TYPES:
		warnings.append("Entity type is not registered by LevelSchema/main.gd.")
	if get_effective_entity_id().is_empty():
		warnings.append("Set Entity ID or give this node a non-empty name.")
	if entity_type == "floor_door" and door_target_marker.is_empty() \
			and door_target_position == Vector2.ZERO:
		warnings.append("Assign a paired Door Target Marker or a fallback target position.")
	return warnings


func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	_draw_asset_preview()
	var soft := Color(marker_color, 0.18)
	var strong := Color(marker_color, 0.92)
	draw_circle(Vector2.ZERO, 8.0, soft)
	draw_arc(Vector2.ZERO, 8.0, 0.0, TAU, 24, strong, 1.25, true)
	draw_line(Vector2(-11.0, 0.0), Vector2(11.0, 0.0), strong, 1.0)
	draw_line(Vector2(0.0, -11.0), Vector2(0.0, 11.0), strong, 1.0)
	var label := display_name if not display_name.is_empty() else entity_type
	var font := ThemeDB.fallback_font
	if font != null:
		draw_string_outline(
			font,
			Vector2(-44.0, -43.0),
			label,
			HORIZONTAL_ALIGNMENT_CENTER,
			88.0,
			11,
			2,
			Color(0.015, 0.01, 0.025, 0.95),
		)
		draw_string(
			font,
			Vector2(-44.0, -43.0),
			label,
			HORIZONTAL_ALIGNMENT_CENTER,
			88.0,
			11,
			Color(marker_color, 1.0),
		)


func _draw_asset_preview() -> void:
	if preview_texture == null:
		return
	var columns := maxi(1, preview_columns)
	var rows := maxi(1, preview_rows)
	var texture_size := preview_texture.get_size()
	var frame_size := Vector2(texture_size.x / columns, texture_size.y / rows)
	var frame_count := columns * rows
	var frame_index := clampi(preview_frame, 0, frame_count - 1)
	var source := Rect2(
		Vector2(frame_index % columns, frame_index / columns) * frame_size,
		frame_size,
	)
	var destination_size := Vector2(
		absf(frame_size.x * preview_scale.x),
		absf(frame_size.y * preview_scale.y),
	)
	var destination := Rect2(preview_offset - destination_size * 0.5, destination_size)
	draw_texture_rect_region(preview_texture, destination, source, preview_tint)


static func _clean_number(value: float) -> Variant:
	var rounded := roundf(value)
	return int(rounded) if is_equal_approx(value, rounded) else snappedf(value, 0.01)
