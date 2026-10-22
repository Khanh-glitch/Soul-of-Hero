@tool
class_name VfxDefinition
extends Resource

## A complete one-shot spritesheet effect.  Designers edit these values in the
## Inspector; gameplay only refers to the stable effect_id.

@export_category("Identity")
@export var effect_id: StringName
@export var display_name := ""
@export_multiline var authoring_notes := ""

@export_category("Spritesheet")
@export var texture: Texture2D
@export var cell_size := Vector2i(32, 32)
@export_range(1, 256, 1) var frame_count := 1
@export_range(1, 256, 1) var columns := 1
@export_range(1.0, 120.0, 0.5) var frames_per_second := 16.0

@export_category("Look")
@export var base_scale := Vector2.ONE
@export var tint := Color.WHITE
@export var use_monochrome_tint := true
@export_range(-100, 200, 1) var default_z_index := 100
## Applied after each gameplay call's position/angle. This makes a consistent
## pivot correction possible without hunting through combat scripts.
@export_category("Placement correction")
@export var local_position_offset := Vector2.ZERO
@export_range(-180.0, 180.0, 0.5) var rotation_offset_degrees := 0.0


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if effect_id.is_empty():
		errors.append("VFX ID is required.")
	if display_name.strip_edges().is_empty():
		errors.append("VFX display name is required.")
	if texture == null:
		errors.append("VFX texture is required.")
	if cell_size.x <= 0 or cell_size.y <= 0:
		errors.append("VFX cell size must be positive.")
	if frame_count <= 0 or columns <= 0 or frames_per_second <= 0.0:
		errors.append("VFX frame count, columns, and FPS must be positive.")
	if base_scale.x == 0.0 or base_scale.y == 0.0:
		errors.append("VFX base scale cannot contain zero.")
	return errors
