class_name OverworldGate
extends Area2D
## One physical dungeon threshold in the Hollow Marches.
##
## The gate is an ordinary world interactable: it joins the same
## `player_interactable` group every chest and door in the dungeons uses, so the
## production Knight resolves it through its own `_try_interact()` on a
## left-click or the interact action. Nothing here invents a second input path.

signal gate_interacted(gate: OverworldGate, level_id: StringName, world_id: StringName)
signal gate_state_changed(level_id: StringName, state: StringName)

const GROUP := &"player_interactable"
const DETECT_RADIUS := 30.0

@export var level_id: StringName
@export var world_id: StringName
@export var display_name: String = ""
@export var subtitle: String = ""
@export var return_point: Vector2 = Vector2.ZERO

var state: StringName = &"LOCKED"   ## LOCKED | ENTER | CLEARED
var _player_near := false
var _app_flow: Node
var _title_label: Label
var _state_label: Label
var _prompt: Label


func _ready() -> void:
	add_to_group(GROUP)
	collision_layer = 0
	collision_mask = 2          # the player's body layer
	monitoring = true
	monitorable = false
	if get_child_count() == 0 or get_node_or_null("Shape") == null:
		_build_shape()
	_build_labels()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	set_process(false)


func _build_shape() -> void:
	var shape := CollisionShape2D.new()
	shape.name = "Shape"
	var rect := RectangleShape2D.new()
	rect.size = Vector2(34, 26)
	shape.shape = rect
	shape.position = Vector2(0, -6)
	add_child(shape)


func _build_labels() -> void:
	_title_label = Label.new()
	_title_label.name = "Title"
	_title_label.text = display_name
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.position = Vector2(-84, -112)
	_title_label.size = Vector2(168, 16)
	_title_label.add_theme_font_size_override("font_size", 11)
	_title_label.add_theme_color_override("font_color", Color(0.95, 0.89, 0.74))
	_title_label.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_title_label.add_theme_constant_override("outline_size", 4)
	add_child(_title_label)

	_state_label = Label.new()
	_state_label.name = "StateLabel"
	_state_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_state_label.position = Vector2(-84, -96)
	_state_label.size = Vector2(168, 14)
	_state_label.add_theme_font_size_override("font_size", 9)
	_state_label.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_state_label.add_theme_constant_override("outline_size", 4)
	add_child(_state_label)

	_prompt = Label.new()
	_prompt.name = "Prompt"
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.position = Vector2(-84, 22)
	_prompt.size = Vector2(168, 14)
	_prompt.add_theme_font_size_override("font_size", 9)
	_prompt.add_theme_color_override("font_color", Color(1.0, 0.92, 0.62))
	_prompt.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.visible = false
	add_child(_prompt)


## Ask the campaign authority for this level's state. Safe to call at any time;
## the controller defers it until the scene tree (and AppFlow) is ready.
func refresh() -> void:
	_app_flow = get_node_or_null("/root/AppFlow")
	var next: StringName = &"LOCKED"
	if _app_flow != null:
		var unlocked := bool(_app_flow.call(&"is_campaign_level_unlocked", level_id)) \
			if _app_flow.has_method(&"is_campaign_level_unlocked") else false
		var cleared := bool(_app_flow.call(&"is_campaign_level_completed", level_id)) \
			if _app_flow.has_method(&"is_campaign_level_completed") else false
		next = &"CLEARED" if cleared else (&"ENTER" if unlocked else &"LOCKED")
	if next != state:
		state = next
		gate_state_changed.emit(level_id, state)
	_apply_state_labels()


func _apply_state_labels() -> void:
	if _state_label == null:
		return
	match state:
		&"CLEARED":
			_state_label.text = "CLEARED  ·  REPLAY"
			_state_label.add_theme_color_override("font_color", Color(0.62, 0.90, 0.66))
		&"ENTER":
			_state_label.text = "ENTER"
			_state_label.add_theme_color_override("font_color", Color(1.0, 0.88, 0.58))
		_:
			_state_label.text = "SEALED"
			_state_label.add_theme_color_override("font_color", Color(0.86, 0.44, 0.44))
	if _title_label != null and subtitle.is_empty():
		_title_label.text = display_name


# ---------------------------------------------------------------------------
# player_interactable contract (consumed by KnightController._try_interact)
# ---------------------------------------------------------------------------
func can_interact(_player: Node2D) -> bool:
	return true


func interact(player: Node2D) -> bool:
	if player == null:
		return false
	if state == &"LOCKED":
		_set_prompt("The way is sealed until the Marches open it.")
		return true
	if not return_point.is_zero_approx():
		set_meta("return_point", return_point)
	gate_interacted.emit(self, level_id, world_id)
	return true


func distance_to_node(node: Node2D) -> float:
	return global_position.distance_to(node.global_position)


func _on_body_entered(body: Node) -> void:
	if not body.is_in_group(&"player"):
		return
	_player_near = true
	set_process(true)
	if _prompt != null:
		_prompt.visible = true
		_prompt.text = _prompt_text()


func _on_body_exited(body: Node) -> void:
	if not body.is_in_group(&"player"):
		return
	_player_near = false
	set_process(false)
	if _prompt != null:
		_prompt.visible = false


func _process(_delta: float) -> void:
	# Keep the call-to-action readable while the player is standing on it.
	if _prompt != null and _prompt.visible:
		var text := _prompt_text()
		if _prompt.text != text:
			_prompt.text = text


func _prompt_text() -> String:
	match state:
		&"CLEARED":
			return "[CLICK]  Return below"
		&"ENTER":
			return "[CLICK]  Descend"
		_:
			return "Sealed"


func _set_prompt(text: String) -> void:
	if _prompt == null:
		return
	_prompt.text = text
	_prompt.visible = true
