extends CharacterBody2D

signal manual_navigation_started

const IDLE_TEXTURE: Texture2D = preload("res://assets/characters/knight/_Idle.png")
const RUN_TEXTURE: Texture2D = preload("res://assets/characters/knight/_Run.png")
const FRAME_SIZE := Vector2(120.0, 80.0)
const FRAME_COUNT := 10

@export_range(40.0, 240.0, 1.0) var move_speed := 112.0

var controls_enabled := true
var _movement_bounds := Rect2(28.0, 56.0, 584.0, 266.0)
var _move_target := Vector2.ZERO
var _has_move_target := false
var _waypoints: Array[Vector2] = []
var _walkability_test := Callable()

@onready var sprite: AnimatedSprite2D = %Sprite


func _ready() -> void:
	_build_animations()


func set_movement_bounds(value: Rect2) -> void:
	_movement_bounds = value
	position = _clamp_to_bounds(position)


func move_to(point: Vector2) -> void:
	move_along([point])


func move_along(points: Array[Vector2]) -> void:
	if not controls_enabled:
		return
	_waypoints.clear()
	for point: Vector2 in points:
		_waypoints.append(_clamp_to_bounds(point))
	if _waypoints.is_empty():
		cancel_auto_move()
		return
	_move_target = _waypoints.pop_front()
	_has_move_target = true


func set_walkability_test(test: Callable) -> void:
	_walkability_test = test


func cancel_auto_move() -> void:
	_has_move_target = false
	_waypoints.clear()
	velocity = Vector2.ZERO


func is_auto_moving() -> bool:
	return _has_move_target


func get_final_move_target() -> Vector2:
	return _waypoints[-1] if not _waypoints.is_empty() else _move_target


func _physics_process(_delta: float) -> void:
	if not controls_enabled:
		velocity = Vector2.ZERO
		_play_animation(false)
		return
	var input_direction := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	if input_direction.length_squared() > 0.02:
		if _has_move_target:
			_has_move_target = false
			_waypoints.clear()
			manual_navigation_started.emit()
		velocity = input_direction.normalized() * move_speed
	elif _has_move_target:
		var offset := _move_target - position
		if offset.length() <= 3.0:
			position = _move_target
			if _waypoints.is_empty():
				_has_move_target = false
				velocity = Vector2.ZERO
			else:
				_move_target = _waypoints.pop_front()
				velocity = (_move_target - position).normalized() * move_speed
		else:
			velocity = offset.normalized() * move_speed
	else:
		velocity = Vector2.ZERO
	var previous_position := position
	move_and_slide()
	position = _resolve_walkable_position(previous_position, _clamp_to_bounds(position))
	if absf(velocity.x) > 0.5:
		sprite.flip_h = velocity.x < 0.0
	_play_animation(velocity.length_squared() > 1.0)


func _build_animations() -> void:
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	_add_animation(frames, &"idle", IDLE_TEXTURE, 7.0)
	_add_animation(frames, &"run", RUN_TEXTURE, 11.0)
	sprite.sprite_frames = frames
	sprite.position = Vector2(0.0, -16.0)
	# Combined with the Home world's 1.25 camera scale this renders at 0.975x,
	# visually matching the combat Knight's authored 1.0x form.
	sprite.scale = Vector2(0.78, 0.78)
	sprite.play(&"idle")


func _add_animation(frames: SpriteFrames, animation_name: StringName, texture: Texture2D, speed: float) -> void:
	frames.add_animation(animation_name)
	frames.set_animation_loop(animation_name, true)
	frames.set_animation_speed(animation_name, speed)
	for frame_index in range(FRAME_COUNT):
		var frame := AtlasTexture.new()
		frame.atlas = texture
		frame.region = Rect2(Vector2(frame_index * int(FRAME_SIZE.x), 0.0), FRAME_SIZE)
		frames.add_frame(animation_name, frame)


func _play_animation(moving: bool) -> void:
	var next_animation := &"run" if moving else &"idle"
	if sprite.animation != next_animation:
		sprite.play(next_animation)


func _clamp_to_bounds(point: Vector2) -> Vector2:
	return Vector2(
		clampf(point.x, _movement_bounds.position.x, _movement_bounds.end.x),
		clampf(point.y, _movement_bounds.position.y, _movement_bounds.end.y)
	)


func _resolve_walkable_position(previous: Vector2, candidate: Vector2) -> Vector2:
	if not _walkability_test.is_valid() or bool(_walkability_test.call(candidate)):
		return candidate
	var horizontal := Vector2(candidate.x, previous.y)
	if bool(_walkability_test.call(horizontal)):
		return horizontal
	var vertical := Vector2(previous.x, candidate.y)
	if bool(_walkability_test.call(vertical)):
		return vertical
	if _has_move_target:
		cancel_auto_move()
	return previous
