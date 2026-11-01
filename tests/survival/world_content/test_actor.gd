class_name WorldContentTestActor
extends CharacterBody2D

signal test_motion_completed

var facing := Vector2.UP
var motion_finished := false
var last_collision: KinematicCollision2D
var _requested_motion := Vector2.ZERO


func request_test_motion(displacement: Vector2) -> void:
	_requested_motion = displacement
	last_collision = null
	motion_finished = displacement.is_zero_approx()
	if motion_finished:
		test_motion_completed.emit()


func await_test_motion() -> void:
	if not motion_finished:
		await test_motion_completed


func _physics_process(_delta: float) -> void:
	if _requested_motion == Vector2.ZERO:
		return
	last_collision = move_and_collide(_requested_motion)
	_requested_motion = Vector2.ZERO
	motion_finished = true
	test_motion_completed.emit()
