class_name OverworldCamp
extends Area2D
## A rest camp. Interacting restores provisions, sets the respawn anchor and
## (through the controller) makes the site permanently lit on this profile.

signal camp_touched(camp_id: StringName, position: Vector2)

const GROUP := &"player_interactable"

@export var camp_id: StringName
@export var camp_name: String = "Camp"
## Where the player is placed when they wake here.
@export var rest_point: Vector2 = Vector2.ZERO

var visited: bool = false
var _label: Label
var _prompt: Label


func _ready() -> void:
	add_to_group(GROUP)
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	monitorable = false
	if get_node_or_null("Shape") == null:
		var shape := CollisionShape2D.new()
		shape.name = "Shape"
		var rect := RectangleShape2D.new()
		rect.size = Vector2(48, 36)
		shape.shape = rect
		shape.position = Vector2(0, -8)
		add_child(shape)
	_build_labels()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _build_labels() -> void:
	_label = Label.new()
	_label.name = "Title"
	_label.text = camp_name
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.position = Vector2(-70, -74)
	_label.size = Vector2(140, 14)
	_label.add_theme_font_size_override("font_size", 9)
	_label.add_theme_color_override("font_color", Color(0.95, 0.85, 0.62))
	_label.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_label.add_theme_constant_override("outline_size", 4)
	add_child(_label)

	_prompt = Label.new()
	_prompt.name = "Prompt"
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.position = Vector2(-70, 18)
	_prompt.size = Vector2(140, 14)
	_prompt.add_theme_font_size_override("font_size", 9)
	_prompt.add_theme_color_override("font_color", Color(1.0, 0.92, 0.62))
	_prompt.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.visible = false
	_prompt.text = "[CLICK]  Rest"
	add_child(_prompt)


func set_visited(value: bool) -> void:
	visited = value
	if _label != null:
		_label.text = camp_name
		_label.add_theme_color_override(
			"font_color", Color(0.72, 0.92, 0.68) if visited else Color(0.95, 0.85, 0.62)
		)


func can_interact(_player: Node2D) -> bool:
	return true


func interact(_player: Node2D) -> bool:
	camp_touched.emit(camp_id, rest_point if not rest_point.is_zero_approx() else global_position)
	return true


func rest_position() -> Vector2:
	return rest_point if not rest_point.is_zero_approx() else global_position + Vector2(0, 10)


func _on_body_entered(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = true


func _on_body_exited(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = false
