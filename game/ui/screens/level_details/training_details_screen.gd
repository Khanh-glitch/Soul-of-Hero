extends Control

const HERO_NAMES := {
	"sword_hero": "KIẾM SĨ",
	"archer_hero": "CUNG THỦ",
	"axe_hero": "CHIẾN BINH RÌU",
	"wizard_hero": "PHÁP SƯ",
}

@onready var kicker: Label = %Kicker
@onready var title: Label = %Title
@onready var objective: Label = %Objective
@onready var reward: Label = %Reward
@onready var difficulty_section: VBoxContainer = %DifficultySection

var _level_id := &"chapter_1_level_1"
var _mode_id := &"campaign"
var _level_details: Dictionary = {}
var _selected_difficulty: StringName = &"easy"


func _ready() -> void:
	%BackButton.pressed.connect(func() -> void: AppFlow.open_hub(&"campaign"))
	%LoadoutButton.pressed.connect(func() -> void: AppFlow.open_hub(&"hero_roster"))
	%StartButton.pressed.connect(_start_selected_level)
	%DifficultyEasy.pressed.connect(_select_difficulty.bind(&"easy"))
	%DifficultyMedium.pressed.connect(_select_difficulty.bind(&"medium"))
	%DifficultyHard.pressed.connect(_select_difficulty.bind(&"hard"))
	LivingArsenalIcons.apply_to_button(%BackButton, LivingArsenalIcons.BACK)
	LivingArsenalIcons.apply_to_button(%LoadoutButton, LivingArsenalIcons.ARSENAL)
	LivingArsenalIcons.apply_to_button(%StartButton, LivingArsenalIcons.PLAY, 20)
	if _level_details.is_empty():
		_level_details = AppFlow.get_level_details(_level_id)
	_apply_level_copy()
	_refresh_difficulty_controls()
	_refresh_soul_team()
	%StartButton.grab_focus()


func configure(payload: Dictionary = {}) -> void:
	_level_id = StringName(payload.get("level_id", &"chapter_1_level_1"))
	_mode_id = StringName(payload.get("mode_id", &"campaign"))
	var provided: Variant = payload.get("level", {})
	_level_details = provided.duplicate(true) if provided is Dictionary else AppFlow.get_level_details(_level_id)
	if is_node_ready():
		_apply_level_copy()
		_refresh_difficulty_controls()
		_refresh_soul_team()


func _start_selected_level() -> void:
	if _mode_id == &"training":
		AppFlow.start_training()
	else:
		AppFlow.start_campaign_level(_level_id, _selected_difficulty)


func _apply_level_copy() -> void:
	var is_training := _mode_id == &"training"
	if is_training:
		difficulty_section.visible = false
		kicker.text = "LUYỆN TẬP • SÂN THỬ • KHÔNG TÍNH CHIẾN DỊCH"
		title.text = "SÂN TẬP HẦM MỘ"
		objective.text = "Luyện lướt, chuỗi đòn Kiếm sĩ 1–4 và Soul Echo với 5 Skeleton quanh sân vòng; có thể thoát qua cổng phía đông khi sẵn sàng."
		reward.text = "Không có phần thưởng chiến dịch. Kết quả luyện tập không thay đổi tiến trình."
		%StartButton.text = "BẮT ĐẦU LUYỆN TẬP"
		%StartButton.disabled = false
		return
	difficulty_section.visible = true
	var chapter := int(_level_details.get("chapter_number", 1))
	var chapter_level := int(_level_details.get("chapter_level_number", 1))
	kicker.text = "CHIẾN DỊCH • CHƯƠNG %d • MÀN %02d" % [chapter, chapter_level]
	title.text = String(_level_details.get("display_name", "Lối Vào Hầm Mộ")).to_upper()
	objective.text = String(_level_details.get(
		"objective_summary",
		"Khám phá ba tầng hầm mộ, thu thập 3 ấn ký và mở cổng thoát."
	))
	reward.text = "Hoàn thành lần đầu sẽ được ghi vào tiến trình Chiến dịch và mở đường cho màn kế tiếp khi nội dung sẵn sàng."
	%StartButton.text = "BẮT ĐẦU MÀN %02d" % chapter_level
	%StartButton.disabled = not bool(_level_details.get("unlocked", false))


func _refresh_difficulty_controls() -> void:
	if _mode_id == &"training" or not is_node_ready():
		return
	_level_details = AppFlow.get_level_details(_level_id)
	_selected_difficulty = StringName(_level_details.get("selected_difficulty", &"easy"))
	var available_value: Variant = _level_details.get("available_difficulties", [&"easy"])
	var available: Array = available_value if available_value is Array else [&"easy"]
	var buttons := {
		&"easy": %DifficultyEasy as Button,
		&"medium": %DifficultyMedium as Button,
		&"hard": %DifficultyHard as Button,
	}
	for difficulty_id: StringName in buttons:
		var button := buttons[difficulty_id] as Button
		button.disabled = difficulty_id not in available
		button.button_pressed = difficulty_id == _selected_difficulty
		button.tooltip_text = (
			"Hoàn thành ải ở độ khó Dễ để mở độ khó này."
			if button.disabled
			else "Chọn độ khó %s cho lượt chơi kế tiếp." % _difficulty_name(difficulty_id)
		)


func _select_difficulty(difficulty_id: StringName) -> void:
	if not AppFlow.select_campaign_level_difficulty(_level_id, difficulty_id):
		_refresh_difficulty_controls()
		return
	_selected_difficulty = difficulty_id
	_refresh_difficulty_controls()


func _refresh_soul_team() -> void:
	var active_id := "sword_hero"
	var reserve_id := ""
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_method(&"get_value"):
		var active_path: Array[String] = ["soul_team", "active_hero"]
		var reserves_path: Array[String] = ["soul_team", "reserve_souls"]
		active_id = String(save_service.call("get_value", active_path, "sword_hero"))
		var raw_reserves: Variant = save_service.call("get_value", reserves_path, ["", ""])
		if raw_reserves is Array and not raw_reserves.is_empty():
			reserve_id = String(raw_reserves[0]).strip_edges()
	%LoadoutValue.text = "HERO CHỦ LỰC: %s\nHERO DỰ BỊ: %s" % [
		_hero_name(active_id),
		_hero_name(reserve_id) if not reserve_id.is_empty() else "TRỐNG",
	]


func _hero_name(hero_id: String) -> String:
	return String(HERO_NAMES.get(hero_id.to_lower(), hero_id.to_upper()))


func _difficulty_name(difficulty_id: StringName) -> String:
	match difficulty_id:
		&"medium":
			return "Trung bình"
		&"hard":
			return "Khó"
	return "Dễ"


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"ui_cancel") and not event.is_echo():
		AppFlow.open_hub(&"campaign")
		get_viewport().set_input_as_handled()
