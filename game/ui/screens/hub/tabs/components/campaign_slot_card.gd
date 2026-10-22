extends PanelContainer

@onready var number_label: Label = %Number
@onready var title_label: Label = %Title
@onready var state_label: Label = %State
@onready var play_button: Button = %PlayButton


func configure(slot: int, summary: Dictionary) -> void:
	name = "CampaignSlot%02d" % slot
	add_to_group(&"campaign_slot_card")
	var level_id := StringName(summary.get("level_id", &""))
	var unlocked := bool(summary.get("unlocked", false))
	var completed := bool(summary.get("completed", false))
	set_meta(&"level_id", level_id)
	set_meta(&"playable", unlocked)
	tooltip_text = String(summary.get("objective_summary", ""))
	number_label.text = "MÀN %02d" % slot
	number_label.add_theme_color_override(&"font_color", Color("ffd072") if unlocked else Color("71687a"))
	title_label.text = String(summary.get("display_name", "Màn chiến dịch")).to_upper()
	state_label.text = "ĐÃ HOÀN THÀNH" if completed else ("CÓ THỂ CHƠI" if unlocked else "ĐANG KHÓA")
	state_label.add_theme_color_override(&"font_color", Color("7fe0b1") if unlocked else Color("71687a"))
	play_button.text = "CHƠI" if unlocked else "KHÓA"
	play_button.disabled = not unlocked
	play_button.theme_type_variation = &"PrimaryButton" if unlocked else &"Button"
	LivingArsenalIcons.apply_to_button(play_button, LivingArsenalIcons.PLAY if unlocked else LivingArsenalIcons.LOCK, 14)
	if unlocked:
		play_button.pressed.connect(func() -> void: AppFlow.open_level_details(level_id))


func configure_missing(slot: int) -> void:
	name = "CampaignSlot%02d" % slot
	add_to_group(&"campaign_slot_card")
	set_meta(&"playable", false)
	tooltip_text = "Màn %02d chưa có nội dung chiến dịch." % slot
	number_label.text = "MÀN %02d" % slot
	number_label.add_theme_color_override(&"font_color", Color("b99ad1"))
	title_label.hide()
	state_label.text = "CHƯA CÓ NỘI DUNG"
	state_label.add_theme_font_size_override(&"font_size", 8)
	state_label.add_theme_color_override(&"font_color", Color("71687a"))
	play_button.hide()

