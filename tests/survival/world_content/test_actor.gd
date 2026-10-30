extends CharacterBody2D

var facing := Vector2.UP
var motion_finished := false
var last_collision: KinematicCollision2D
var _requested_motion := Vector2.ZERO


func request_test_motion(displacement: Vector2) -> void:
	_requested_motion = displacement
	motion_finished = false


func _physics_process(_delta: float) -> void:
	if _requested_motion == Vector2.ZERO:
		return
	last_collision = move_and_collide(_requested_motion)
	_requested_motion = Vector2.ZERO
	motion_finished = true
