class_name CompletionChoice
extends Control

const EntryScene: PackedScene = preload("res://game/ui/field_codex_entry.tscn")

@onready var title_label: Label = %TitleLabel
@onready var question_label: Label = %QuestionLabel
@onready var next_button: Button = %NextButton
@onready var picker_button: Button = %PickerButton
@onready var home_button: Button = %HomeButton
@onready var main_choices: Control = %MainChoices
@onready var picker: Control = %Picker
@onready var picker_list: VBoxContainer = %PickerList
@onready var picker_status: Label = %PickerStatus
@onready var difficulty_buttons := {
	&"easy": %EasyButton,
	&"medium": %MediumButton,
	&"hard": %HardButton,
}
@onready var back_button: Button = %BackButton
@onready var victory_sfx: AudioStreamPlayer = %VictorySfx
@onready var page_sfx: AudioStreamPlayer = %PageSfx

var _result: Dictionary = {}
var _options: Dictionary = {}
var _selected_difficulty := &"easy"
var _event_bus: Node


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	next_button.pressed.connect(_continue_next)
	picker_button.pressed.connect(_show_picker)
	home_button.pressed.connect(_return_home)
	back_button.pressed.connect(_show_main_choices)
	for difficulty_id: StringName in difficulty_buttons:
		(difficulty_buttons[difficulty_id] as Button).pressed.connect(_select_difficulty.bind(difficulty_id))
	var bus := get_node_or_null("/root/GameEvents")
	if bus != null and bus.has_signal(&"run_completion_ready"):
		bus.connect(&"run_completion_ready", present)
		_event_bus = bus
	hide()


func _exit_tree() -> void:
	if is_instance_valid(_event_bus) and _event_bus.is_connected(&"run_completion_ready", present):
		_event_bus.disconnect(&"run_completion_ready", present)
	_event_bus = null


func present(result: Dictionary, options: Dictionary = {}) -> void:
	_result = result.duplicate(true)
	_options = options.duplicate(true)
	var flow := get_node_or_null("/root/AppFlow")
	if _options.is_empty() and flow != null and flow.has_method(&"get_continuation_options"):
		var value: Variant = flow.call(&"get_continuation_options")
		if value is Dictionary:
			_options = value
	_selected_difficulty = StringName(_options.get("current_difficulty", &"easy"))
	if _selected_difficulty not in difficulty_buttons:
		_selected_difficulty = &"easy"
	var level_name := String(_result.get("level_display_name", "")).strip_edges()
	if level_name.is_empty():
		level_name = String(_options.get("current_level_id", _result.get("level_id", "ẢI"))).replace("_", " ").to_upper()
	title_label.text = "%s ĐÃ HOÀN TẤT" % level_name.to_upper()
	question_label.text = "Bạn muốn đi tiếp qua ải sau hay trở về nhà?"
	next_button.disabled = not bool(_options.get("can_continue", false))
	next_button.text = "ĐI ẢI KẾ" if not next_button.disabled else "ĐÃ HẾT CHƯƠNG"
	picker_button.disabled = not bool(_options.get("can_replay", true))
	_show_main_choices()
	show()
	victory_sfx.play()


func _show_main_choices() -> void:
	picker.hide()
	main_choices.show()


func _show_picker() -> void:
	main_choices.hide()
	picker.show()
	page_sfx.play()
	_refresh_difficulty_buttons()
	_render_level_picker()


func _select_difficulty(difficulty_id: StringName) -> void:
	_selected_difficulty = difficulty_id
	_refresh_difficulty_buttons()
	_render_level_picker()
	page_sfx.play()


func _refresh_difficulty_buttons() -> void:
	for difficulty_id: StringName in difficulty_buttons:
		(difficulty_buttons[difficulty_id] as Button).button_pressed = difficulty_id == _selected_difficulty
	picker_status.text = "Độ khó: %s • chọn một ải đã mở" % _difficulty_name(_selected_difficulty)


func _render_level_picker() -> void:
	for child: Node in picker_list.get_children():
		picker_list.remove_child(child)
		child.queue_free()
	var levels_value: Variant = _options.get("levels", [])
	var levels: Array = levels_value if levels_value is Array else []
	for raw_level: Variant in levels:
		var level_id := ""
		var display_name := ""
		var unlocked := true
		var completed := false
		if raw_level is Dictionary:
			var level := raw_level as Dictionary
			level_id = String(level.get("level_id", level.get("id", "")))
			display_name = String(level.get("display_name", level.get("name", "")))
			unlocked = bool(level.get("unlocked", true))
			completed = bool(level.get("completed", false))
		else:
			level_id = String(raw_level)
		if level_id.is_empty() or not unlocked:
			continue
		if display_name.is_empty():
			display_name = level_id.replace("chapter_1_level_", "ẢI ").replace("_", " ").to_upper()
		# Medium/Hard are farming variants for levels the player has already
		# cleared. A newly-unlocked next level must still be first-cleared on Easy.
		var can_play_selected_difficulty := completed or _selected_difficulty == &"easy"
		var detail := "Đã hoàn thành • có thể cày lại boss/rương" if completed else "Lần đầu bắt buộc độ khó Dễ"
		var entry := EntryScene.instantiate() as FieldCodexEntry
		picker_list.add_child(entry)
		entry.configure(
			display_name.to_upper(),
			detail + " • " + _difficulty_name(_selected_difficulty),
			&"rare" if completed else &"normal",
			null,
			"CHƠI" if can_play_selected_difficulty else "CẦN QUA ĐỘ KHÓ DỄ",
			Callable(self, "_start_picked_level").bind(level_id),
			not can_play_selected_difficulty
		)
	if picker_list.get_child_count() == 0:
		var fallback_id := String(_options.get("current_level_id", _result.get("level_id", "")))
		if not fallback_id.is_empty():
			var entry := EntryScene.instantiate() as FieldCodexEntry
			picker_list.add_child(entry)
			entry.configure("CHƠI LẠI ẢI NÀY", _difficulty_name(_selected_difficulty), &"normal", null, "CHƠI", Callable(self, "_start_picked_level").bind(fallback_id))


func _difficulty_name(difficulty_id: StringName) -> String:
	match difficulty_id:
		&"medium":
			return "TRUNG BÌNH"
		&"hard":
			return "KHÓ"
	return "DỄ"


func _continue_next() -> void:
	var flow := get_node_or_null("/root/AppFlow")
	if flow == null or not flow.has_method(&"continue_to_next_campaign_level"):
		_set_failure("Luồng ải kế chưa sẵn sàng.")
		return
	get_tree().paused = false
	if bool(flow.call(&"continue_to_next_campaign_level")):
		hide()
	else:
		get_tree().paused = true
		_set_failure("Không thể mở ải kế tiếp.")


func _start_picked_level(level_id: String) -> void:
	var flow := get_node_or_null("/root/AppFlow")
	if flow == null or not flow.has_method(&"start_campaign_level_from_picker"):
		_set_failure("Bộ chọn ải chưa sẵn sàng.")
		return
	get_tree().paused = false
	if bool(flow.call(&"start_campaign_level_from_picker", StringName(level_id), _selected_difficulty)):
		hide()
	else:
		get_tree().paused = true
		_set_failure("Ải hoặc độ khó này chưa thể khởi động.")


func _return_home() -> void:
	var flow := get_node_or_null("/root/AppFlow")
	if flow == null or not flow.has_method(&"return_home_after_completion"):
		_set_failure("Không thể trở về nhà lúc này.")
		return
	get_tree().paused = false
	flow.call(&"return_home_after_completion")
	hide()


func _set_failure(message: String) -> void:
	picker_status.text = message
	picker_status.add_theme_color_override(&"font_color", Color("a33835"))
