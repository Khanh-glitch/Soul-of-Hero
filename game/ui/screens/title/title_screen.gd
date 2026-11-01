extends Control

@onready var continue_button: Button = %ContinueButton
@onready var new_game_button: Button = %NewGameButton
@onready var status_label: Label = %StatusLabel


func _ready() -> void:
	continue_button.pressed.connect(_continue_profile)
	new_game_button.pressed.connect(_start_new_game)
	status_label.hide()
	continue_button.grab_focus()
func configure(_payload: Dictionary = {}) -> void:
	pass


func _continue_profile() -> void:
	_set_actions_enabled(false)
	AppFlow.open_home()


func _start_new_game() -> void:
	_set_actions_enabled(false)
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"reset_progression_keep_settings"):
		_show_reset_error("Không thể truy cập dữ liệu lưu.")
		return
	var reset_ok := bool(save_service.call(
		&"reset_progression_keep_settings",
		LivingArsenalSaveService.RESET_PROGRESSION_KEEP_SETTINGS_TOKEN
	))
	if not reset_ok:
		_show_reset_error("Không thể tạo hồ sơ mới. Dữ liệu cũ vẫn được giữ nguyên.")
		return
	# A new profile is a new RUN: the durable run-local state was just cleared by
	# the reset above, and the run identity/deadline is opened here so the first
	# hour already belongs to a real 336 h run instead of "no run at all".
	var lifecycle := get_node_or_null("/root/RunLifecycle")
	if lifecycle != null and lifecycle.has_method(&"start_run"):
		var started: Dictionary = lifecycle.call(&"start_run")
		if not bool(started.get("ok", false)):
			_show_reset_error("Không thể bắt đầu một lượt chơi mới.")
			return
	AppFlow.open_home()


func _set_actions_enabled(enabled: bool) -> void:
	continue_button.disabled = not enabled
	new_game_button.disabled = not enabled


func _show_reset_error(message: String) -> void:
	status_label.text = message
	status_label.show()
	_set_actions_enabled(true)
	new_game_button.grab_focus()
