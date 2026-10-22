extends Control


func _ready() -> void:
	%BackButton.pressed.connect(func() -> void: AppFlow.return_from_credits())
	LivingArsenalIcons.apply_to_button(%BackButton, LivingArsenalIcons.BACK)
	%BackButton.grab_focus()


func configure(_payload: Dictionary = {}) -> void:
	pass


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"ui_cancel") and not event.is_echo():
		AppFlow.return_from_credits()
		get_viewport().set_input_as_handled()
