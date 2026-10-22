class_name XpGainPopup
extends Control

@onready var amount_label: Label = %AmountLabel

var _amount := 0
var _stack_index := 0
var _configured := false


func configure(amount: int, stack_index := 0) -> void:
	_amount = maxi(0, amount)
	_stack_index = maxi(0, stack_index)
	_configured = true
	if is_node_ready():
		_play()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	process_mode = Node.PROCESS_MODE_ALWAYS
	if _configured:
		_play()


func _play() -> void:
	amount_label.text = "+%d XP" % _amount
	position += Vector2(float((_stack_index % 3) - 1) * 13.0, -float(_stack_index % 2) * 3.0)
	pivot_offset = size * 0.5
	scale = Vector2.ONE * 1.72
	modulate = Color(1, 1, 1, 0)
	var rest_position := position
	var tween := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	# Preserve the compact original glyph treatment. Only motion changes: an
	# oversized, fast snap-in followed by a short punch-out instead of a slow
	# floating card.
	tween.tween_property(self, "modulate:a", 1.0, 0.035)
	tween.parallel().tween_property(self, "scale", Vector2.ONE, 0.095).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(self, "position", rest_position + Vector2(0, -5), 0.095).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tween.tween_interval(0.42)
	tween.tween_property(self, "modulate:a", 0.0, 0.11)
	tween.parallel().tween_property(self, "scale", Vector2.ONE * 1.48, 0.11).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(self, "position", rest_position + Vector2(0, -11), 0.11).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_IN)
	tween.tween_callback(queue_free)
