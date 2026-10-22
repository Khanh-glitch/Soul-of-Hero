extends Control

const TAB_SCENES := {
	&"campaign": preload("res://game/ui/screens/hub/tabs/campaign_tab.tscn"),
	&"hero_roster": preload("res://game/ui/screens/hub/tabs/arsenal_tab.tscn"),
	&"modes": preload("res://game/ui/screens/hub/tabs/modes_tab.tscn"),
	&"bestiary": preload("res://game/ui/screens/hub/tabs/bestiary_tab.tscn"),
	&"settings": preload("res://game/ui/screens/hub/tabs/settings_tab.tscn"),
}
const TAB_TITLES := {
	&"campaign": "CHIẾN DỊCH",
	&"hero_roster": "ĐỘI HÌNH & TRANG BỊ",
	&"modes": "CHẾ ĐỘ",
	&"bestiary": "QUÁI VẬT",
	&"settings": "CÀI ĐẶT",
}

@onready var content_host: Control = %ContentHost

var _requested_tab := &"campaign"
var _active_tab := &""


func _ready() -> void:
	%CampaignButton.pressed.connect(func() -> void: _show_tab(&"campaign"))
	%ArsenalButton.pressed.connect(func() -> void: _show_tab(&"hero_roster"))
	%ModesButton.pressed.connect(func() -> void: _show_tab(&"modes"))
	%BestiaryButton.pressed.connect(func() -> void: _show_tab(&"bestiary"))
	%SettingsButton.pressed.connect(func() -> void: _show_tab(&"settings"))
	%TitleButton.pressed.connect(func() -> void: AppFlow.open_title())
	_apply_navigation_icons()
	_refresh_top_bar()
	# AppRoot configures a screen immediately after add_child(), which means
	# _ready() has already run. Show the safe default now; configure() may then
	# replace it synchronously. A deferred default would otherwise overwrite an
	# explicitly requested Hero Roster/Modes/Bestiary/Settings route one frame later.
	_show_tab(_requested_tab)


func configure(payload: Dictionary = {}) -> void:
	_requested_tab = StringName(payload.get("hub_tab", &"campaign"))
	if _requested_tab == &"arsenal":
		_requested_tab = &"hero_roster"
	if is_node_ready():
		_show_tab(_requested_tab)


func _show_tab(tab_id: StringName) -> void:
	if not TAB_SCENES.has(tab_id):
		tab_id = &"campaign"
	for child: Node in content_host.get_children():
		content_host.remove_child(child)
		child.queue_free()
	var tab := (TAB_SCENES[tab_id] as PackedScene).instantiate()
	content_host.add_child(tab)
	if tab is Control:
		(tab as Control).set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_active_tab = tab_id
	_requested_tab = tab_id
	%SectionLabel.text = String(TAB_TITLES.get(tab_id, "CHIẾN DỊCH"))
	_update_tab_buttons()
	_refresh_top_bar()


func _update_tab_buttons() -> void:
	var buttons := {
		&"campaign": %CampaignButton,
		&"hero_roster": %ArsenalButton,
		&"modes": %ModesButton,
		&"bestiary": %BestiaryButton,
		&"settings": %SettingsButton,
	}
	for tab_id: StringName in buttons:
		var button := buttons[tab_id] as Button
		button.button_pressed = tab_id == _active_tab


func _refresh_top_bar() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	var account_currency := 0
	var chapter := 1
	if save_service != null and save_service.has_method(&"get_value"):
		var account_path: Array[String] = ["currencies", "account"]
		var chapter_path: Array[String] = ["progression", "campaign", "chapter"]
		account_currency = int(save_service.call("get_value", account_path, 0))
		chapter = int(save_service.call("get_value", chapter_path, 1))
	%ProfileLabel.text = "CHƯƠNG %d  •  %04d VÀNG" % [chapter, account_currency]


func _apply_navigation_icons() -> void:
	%CampaignButton.icon = LivingArsenalIcons.texture(LivingArsenalIcons.CAMPAIGN)
	%ArsenalButton.icon = LivingArsenalIcons.texture(LivingArsenalIcons.ARSENAL)
	%ModesButton.icon = LivingArsenalIcons.texture(LivingArsenalIcons.MODES)
	%BestiaryButton.icon = LivingArsenalIcons.texture(LivingArsenalIcons.BESTIARY)
	%SettingsButton.icon = LivingArsenalIcons.texture(LivingArsenalIcons.SETTINGS)
	for button: Button in [%CampaignButton, %ArsenalButton, %ModesButton, %BestiaryButton, %SettingsButton]:
		button.expand_icon = true
		button.add_theme_constant_override(&"icon_max_width", 18)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"ui_cancel") and not event.is_echo():
		AppFlow.open_title()
		get_viewport().set_input_as_handled()
