class_name OverworldCamera
extends Camera2D

const DEFAULT_ZOOM := Vector2(2.0, 2.0)
const SMOOTH := 6.0

func _ready() -> void:
	zoom = DEFAULT_ZOOM
	smoothing_enabled = true
	smoothing_speed = Vector2(6.0, 6.0)
	position_smoothing_speed = 10.0
	ignore_rotation = true


func set_bounds(world_bounds: Rect2) -> void:
	limit_left = int(world_bounds.position.x)
	limit_top = int(world_bounds.position.y)
	limit_right = int(world_bounds.end.x)
	limit_bottom = int(world_bounds.end.y)
	reset_smoothing()


func set_target(node: Node2D) -> void:
	# The Camera is attached to the player; ensure smoothing resets on attach.
	reset_smoothing()
