class_name OverworldDiscovery
extends Area2D
## An optional find off the road: a cache, a shrine, a lore stone or a sigil.
## The visible prop stays in the world (it is part of the geography); what
## disappears is the interactable marker, so a re-visit reads as "already
## searched" instead of as a missing prop.

signal discovered(discovery_id: StringName, position: Vector2)

const GROUP := &"player_interactable"

@export var discovery_id: StringName
@export var kind: String = "coin_cache"
@export var found_hint: String = "Already searched"

var found: bool = false
var _marker: Polygon2D
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
		var circle := CircleShape2D.new()
		circle.radius = 16.0
		shape.shape = circle
		shape.position = Vector2(0, -8)
		add_child(shape)
	_build_visuals()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _build_visuals() -> void:
	# A small glint, not a floating icon: it reads as "something catches the
	# light here" at gameplay scale and vanishes once searched.
	_marker = Polygon2D.new()
	_marker.name = "Glint"
	_marker.polygon = PackedVector2Array([
		Vector2(0, -22), Vector2(3, -19), Vector2(0, -16), Vector2(-3, -19),
	])
	_marker.color = Color(1.0, 0.90, 0.58, 0.85)
	add_child(_marker)
	_prompt = Label.new()
	_prompt.name = "Prompt"
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.position = Vector2(-64, 8)
	_prompt.size = Vector2(128, 14)
	_prompt.add_theme_font_size_override("font_size", 9)
	_prompt.add_theme_color_override("font_color", Color(1.0, 0.92, 0.62))
	_prompt.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.visible = false
	_prompt.text = "[CLICK]  Search"
	add_child(_prompt)


func set_found(value: bool) -> void:
	found = value
	if _marker != null:
		_marker.visible = not found
	if _prompt != null:
		_prompt.text = found_hint if found else "[CLICK]  Search"


func can_interact(_player: Node2D) -> bool:
	return true


func interact(_player: Node2D) -> bool:
	if found:
		if _prompt != null:
			_prompt.text = found_hint
		return true
	discovered.emit(discovery_id, global_position)
	return true


func _on_body_entered(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = true


func _on_body_exited(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = false
