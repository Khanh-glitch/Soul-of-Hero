extends VBoxContainer


func _ready() -> void:
	%CreditsButton.pressed.connect(func() -> void: AppFlow.open_credits(&"home"))
	%NewProfileButton.pressed.connect(func() -> void: %ResetConfirmation.popup_centered())
	%ResetConfirmation.confirmed.connect(_reset_progression)
	LivingArsenalIcons.apply_to_button(%CreditsButton, LivingArsenalIcons.BOOK, 14)
	LivingArsenalIcons.apply_to_button(%NewProfileButton, LivingArsenalIcons.RETRY, 14)


func _reset_progression() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"reset_progression_keep_settings"):
		return
	var reset_ok := bool(save_service.call(
		&"reset_progression_keep_settings",
		LivingArsenalSaveService.RESET_PROGRESSION_KEEP_SETTINGS_TOKEN
	))
	if reset_ok:
		AppFlow.open_home()
