extends Control

var _target_progress := 0.04
var _displayed_progress := 0.0
var _elapsed := 0.0


func _ready() -> void:
	%LoadingBar.value = 0.0
	%Percent.text = "00%"


func set_loading_progress(value: float, status_text := "Đang dựng Thánh Địa") -> void:
	_target_progress = clampf(value, 0.0, 1.0)
	%LoadingStatus.text = status_text


func _process(delta: float) -> void:
	_elapsed += delta
	_displayed_progress = move_toward(_displayed_progress, _target_progress, delta * 1.9)
	%LoadingBar.value = _displayed_progress * 100.0
	%Percent.text = "%02d%%" % int(round(_displayed_progress * 100.0))
	%Sigil.rotation = sin(_elapsed * 1.35) * 0.08
	%Sigil.modulate.a = 0.72 + (sin(_elapsed * 2.4) + 1.0) * 0.12
