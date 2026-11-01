extends CharacterBody2D

## Invisible harness actor: deliberately no character art or substitute avatar.
## A0 supplies the canonical male/female Hero at integration time.

@export var speed := 190.0
var facing := Vector2.UP


func _physics_process(_delta: float) -> void:
	var input_vector := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if input_vector.length_squared() > 0.01:
		facing = input_vector.normalized()
	velocity = input_vector * speed
	move_and_slide()
	queue_redraw()


func _draw() -> void:
	# Ground-level position/facing marker only; never a humanoid visual.
	draw_circle(Vector2.ZERO, 13.0, Color(0.05, 0.09, 0.08, 0.58))
	draw_arc(Vector2.ZERO, 11.0, 0.0, TAU, 24, Color("#f4df9b"), 2.0)
	draw_line(Vector2.ZERO, facing.normalized() * 18.0, Color("#f4df9b"), 3.0)
	draw_circle(facing.normalized() * 18.0, 2.5, Color("#f4df9b"))
