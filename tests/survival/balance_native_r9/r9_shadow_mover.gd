extends CharacterBody2D
## A7's reproduction of the mover A8's own native test uses.
##
## ## Why this exists as a copy
## `tests/survival/world_content/native_poi_ragnarok_test.gd` walks an actor that
## A8 defines in `tests/survival/world_content/test_actor.gd`. Those are A8 test
## files, and the composed tree carries only A8's `game/` and `data/` prefixes, so
## the original class is not loadable from the composition under test. Rather than
## claim "A8's actor", this file reproduces it exactly as published — the same
## `CharacterBody2D`, the same `move_and_collide` with **one full displacement per
## call**, the same completion signal — and the probe labels it
## `SHADOW_MOVER (A8 harness pattern)`.
##
## The properties that differ from the production Hero are the point of the
## comparison, so they are declared here rather than inferred:
##
## | | A8 harness mover | production `Knight` |
## |---|---|---|
## | motion | one `move_and_collide` of the whole step | `move_and_slide`, many frames |
## | speed | unbounded per call | 96 px/s with acceleration |
## | slide | none — the call stops dead | slides along the surface |
## | collision_mask | 1 (world) | 5 (world + enemies) |
## | body | 12x16 @ (0,-8) for A1, r=10 circle for sites | 12x16 @ (0,-8) |

signal step_completed

var last_collision: KinematicCollision2D
var steps := 0
var _pending := Vector2.ZERO
var _busy := false


func configure_world_only(a1_rectangle: bool) -> void:
	collision_layer = 2
	collision_mask = 1
	var shape: Shape2D
	if a1_rectangle:
		var rect := RectangleShape2D.new()
		rect.size = Vector2(12, 16)
		shape = rect
	else:
		var circle := CircleShape2D.new()
		circle.radius = 10.0
		shape = circle
	var collision := CollisionShape2D.new()
	collision.shape = shape
	if a1_rectangle:
		collision.position = Vector2(0, -8)
	add_child(collision)


func step(displacement: Vector2) -> void:
	_pending = displacement
	_busy = not displacement.is_zero_approx()
	if not _busy:
		step_completed.emit()


func await_step() -> void:
	if _busy:
		await step_completed


func _physics_process(_delta: float) -> void:
	if not _busy:
		return
	last_collision = move_and_collide(_pending)
	_pending = Vector2.ZERO
	_busy = false
	steps += 1
	step_completed.emit()
