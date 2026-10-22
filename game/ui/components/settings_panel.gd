class_name LivingArsenalSettingsPanel
extends ScrollContainer

signal settings_saved

@onready var master_slider: HSlider = %MasterSlider
@onready var music_slider: HSlider = %MusicSlider
@onready var sfx_slider: HSlider = %SfxSlider
@onready var shake_slider: HSlider = %ShakeSlider
@onready var aim_slider: HSlider = %AimSlider
@onready var ui_scale_slider: HSlider = %UiScaleSlider
@onready var joystick_opacity_slider: HSlider = %JoystickOpacitySlider
@onready var joystick_size_slider: HSlider = %JoystickSizeSlider
@onready var button_scale_slider: HSlider = %ButtonScaleSlider
@onready var master_value: Label = %MasterValue
@onready var music_value: Label = %MusicValue
@onready var sfx_value: Label = %SfxValue
@onready var shake_value: Label = %ShakeValue
@onready var aim_value: Label = %AimValue
@onready var ui_scale_value: Label = %UiScaleValue
@onready var joystick_opacity_value: Label = %JoystickOpacityValue
@onready var joystick_size_value: Label = %JoystickSizeValue
@onready var button_scale_value: Label = %ButtonScaleValue
@onready var vibration_toggle: CheckButton = %VibrationToggle
@onready var damage_toggle: CheckButton = %DamageToggle
@onready var flashes_toggle: CheckButton = %FlashesToggle
@onready var motion_toggle: CheckButton = %MotionToggle
@onready var fullscreen_toggle: CheckButton = %FullscreenToggle
@onready var contrast_toggle: CheckButton = %ContrastToggle
@onready var left_handed_toggle: CheckButton = %LeftHandedToggle
@onready var palette_option: OptionButton = %PaletteOption
@onready var status_label: Label = %StatusLabel


func _ready() -> void:
	_setup_palette_options()
	%SaveButton.pressed.connect(_save)
	%DefaultsButton.pressed.connect(_set_defaults)
	for slider: HSlider in [
		master_slider, music_slider, sfx_slider, shake_slider, aim_slider,
		ui_scale_slider, joystick_opacity_slider, joystick_size_slider, button_scale_slider,
	]:
		slider.value_changed.connect(_on_value_changed)
	for toggle: CheckButton in [
		vibration_toggle, damage_toggle, flashes_toggle, motion_toggle,
		fullscreen_toggle, contrast_toggle, left_handed_toggle,
	]:
		toggle.toggled.connect(_on_toggle_changed)
	palette_option.item_selected.connect(_on_palette_selected)
	reload_from_save()


func configure(_payload: Dictionary = {}) -> void:
	if is_node_ready():
		reload_from_save()


func reload_from_save() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	var settings: Dictionary = {}
	if save_service != null and save_service.has_method(&"get_value"):
		var settings_path: Array[String] = ["settings"]
		var raw: Variant = save_service.call("get_value", settings_path, {})
		if raw is Dictionary:
			settings = raw
	master_slider.value = float(settings.get("master_volume", 1.0))
	music_slider.value = float(settings.get("music_volume", 1.0))
	sfx_slider.value = float(settings.get("sfx_volume", 1.0))
	shake_slider.value = float(settings.get("screen_shake", 1.0))
	aim_slider.value = float(settings.get("aim_assist", 0.5))
	ui_scale_slider.value = float(settings.get("ui_scale", 1.0))
	joystick_opacity_slider.value = float(settings.get("joystick_opacity", 0.7))
	joystick_size_slider.value = float(settings.get("joystick_size", 1.0))
	button_scale_slider.value = float(settings.get("button_scale", 1.0))
	vibration_toggle.button_pressed = bool(settings.get("vibration", true))
	damage_toggle.button_pressed = bool(settings.get("damage_numbers", true))
	flashes_toggle.button_pressed = bool(settings.get("reduced_flashes", false))
	motion_toggle.button_pressed = bool(settings.get("reduced_motion", false))
	fullscreen_toggle.button_pressed = bool(settings.get("fullscreen", false))
	contrast_toggle.button_pressed = bool(settings.get("high_contrast", false))
	left_handed_toggle.button_pressed = bool(settings.get("left_handed", false))
	_select_palette(String(settings.get("telegraph_palette", "standard")))
	status_label.text = ""
	_update_value_labels()
	_apply_audio()


func _on_value_changed(_value: float) -> void:
	_update_value_labels()
	_apply_audio()
	status_label.text = "Có thay đổi chưa lưu"


func _on_toggle_changed(_enabled: bool) -> void:
	status_label.text = "Có thay đổi chưa lưu"


func _on_palette_selected(_index: int) -> void:
	status_label.text = "Có thay đổi chưa lưu"


func _update_value_labels() -> void:
	master_value.text = "%d%%" % roundi(master_slider.value * 100.0)
	music_value.text = "%d%%" % roundi(music_slider.value * 100.0)
	sfx_value.text = "%d%%" % roundi(sfx_slider.value * 100.0)
	shake_value.text = "%d%%" % roundi(shake_slider.value * 100.0)
	aim_value.text = "%d%%" % roundi(aim_slider.value * 100.0)
	ui_scale_value.text = "%d%%" % roundi(ui_scale_slider.value * 100.0)
	joystick_opacity_value.text = "%d%%" % roundi(joystick_opacity_slider.value * 100.0)
	joystick_size_value.text = "%d%%" % roundi(joystick_size_slider.value * 100.0)
	button_scale_value.text = "%d%%" % roundi(button_scale_slider.value * 100.0)


func _set_defaults() -> void:
	master_slider.value = 1.0
	music_slider.value = 0.8
	sfx_slider.value = 1.0
	shake_slider.value = 0.8
	aim_slider.value = 0.5
	ui_scale_slider.value = 1.0
	joystick_opacity_slider.value = 0.7
	joystick_size_slider.value = 1.0
	button_scale_slider.value = 1.0
	vibration_toggle.button_pressed = true
	damage_toggle.button_pressed = true
	flashes_toggle.button_pressed = false
	motion_toggle.button_pressed = false
	fullscreen_toggle.button_pressed = false
	contrast_toggle.button_pressed = false
	left_handed_toggle.button_pressed = false
	_select_palette("standard")
	status_label.text = "Đã đặt mặc định — nhấn LƯU để áp dụng"


func _save() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"transact_once"):
		status_label.text = "Không thể truy cập dữ liệu lưu"
		return
	var settings := {
		"master_volume": master_slider.value,
		"music_volume": music_slider.value,
		"sfx_volume": sfx_slider.value,
		"screen_shake": shake_slider.value,
		"vibration": vibration_toggle.button_pressed,
		"damage_numbers": damage_toggle.button_pressed,
		"aim_assist": aim_slider.value,
		"ui_scale": ui_scale_slider.value,
		"joystick_opacity": joystick_opacity_slider.value,
		"joystick_size": joystick_size_slider.value,
		"button_scale": button_scale_slider.value,
		"reduced_flashes": flashes_toggle.button_pressed,
		"reduced_motion": motion_toggle.button_pressed,
		"fullscreen": fullscreen_toggle.button_pressed,
		"high_contrast": contrast_toggle.button_pressed,
		"left_handed": left_handed_toggle.button_pressed,
		"telegraph_palette": String(palette_option.get_selected_metadata()),
	}
	var applied := false
	if save_service.has_method(&"update_settings"):
		applied = bool(save_service.call("update_settings", settings))
	else:
		var snapshot: Dictionary = save_service.call("get_snapshot")
		var transaction_key := "settings:update:%d:%d" % [
			int(snapshot.get("revision", 0)),
			Time.get_ticks_msec(),
		]
		applied = bool(save_service.call(
			"transact_once",
			transaction_key,
			func(candidate: Dictionary) -> bool:
				var merged: Dictionary = candidate.get("settings", {}).duplicate(true)
				merged.merge(settings, true)
				candidate["settings"] = merged
				return true,
			{"kind": "settings_update"}
		))
	if not applied:
		status_label.text = "Lưu cài đặt thất bại"
		return
	_apply_audio()
	_apply_window_mode()
	status_label.text = "Đã lưu cài đặt"
	settings_saved.emit()


func _apply_audio() -> void:
	_apply_bus_volume(&"Master", master_slider.value)
	_apply_bus_volume(&"Music", music_slider.value)
	_apply_bus_volume(&"SFX", sfx_slider.value)
	_apply_bus_volume(&"UI", sfx_slider.value)


func _apply_bus_volume(bus_name: StringName, linear_value: float) -> void:
	var bus_index := AudioServer.get_bus_index(bus_name)
	if bus_index < 0:
		return
	var safe_value := clampf(linear_value, 0.0, 1.0)
	AudioServer.set_bus_volume_db(bus_index, -80.0 if safe_value <= 0.001 else linear_to_db(safe_value))


func _setup_palette_options() -> void:
	palette_option.clear()
	for entry: Dictionary in [
		{"label": "Chuẩn", "id": "standard"},
		{"label": "Hỗ trợ mù màu", "id": "colorblind"},
		{"label": "Tương phản cao", "id": "high_contrast"},
	]:
		palette_option.add_item(String(entry.label))
		palette_option.set_item_metadata(palette_option.item_count - 1, String(entry.id))


func _select_palette(palette_id: String) -> void:
	for index: int in palette_option.item_count:
		if String(palette_option.get_item_metadata(index)) == palette_id:
			palette_option.select(index)
			return
	palette_option.select(0)


func _apply_window_mode() -> void:
	if DisplayServer.get_name() == "headless":
		return
	DisplayServer.window_set_mode(
		DisplayServer.WINDOW_MODE_FULLSCREEN if fullscreen_toggle.button_pressed else DisplayServer.WINDOW_MODE_WINDOWED
	)
