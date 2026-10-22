@tool
class_name WeaponTargetRules
extends Resource

enum TargetMode {
	NONE,
	NEAREST_IN_FACING,
	LOCKED_POSITION,
	UP_TO_N_TARGETS,
	AIM_DIRECTION,
	CONFIRMED_EVENT_VECTOR,
}

@export var mode: TargetMode = TargetMode.NEAREST_IN_FACING
@export_range(0.0, 20000.0, 1.0) var range: float = 160.0
@export_range(0.0, 360.0, 1.0) var facing_cone_degrees: float = 120.0
@export_range(0, 16, 1) var maximum_targets: int = 1
@export_range(0.0, 1.0, 0.01) var low_health_preference: float = 0.0
@export_range(0.0, 1.0, 0.01) var movement_prediction_seconds: float = 0.0
@export_range(0.0, 256.0, 1.0) var forgiving_radius: float = 0.0
@export var require_target: bool = true


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if range < 0.0:
		errors.append("Target range cannot be negative.")
	if maximum_targets < 0:
		errors.append("Maximum targets cannot be negative.")
	if facing_cone_degrees < 0.0 or facing_cone_degrees > 360.0:
		errors.append("Facing cone must be between 0 and 360 degrees.")
	return errors
