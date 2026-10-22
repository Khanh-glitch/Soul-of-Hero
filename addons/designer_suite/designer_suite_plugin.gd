@tool
extends EditorPlugin

const MapSerializer := preload("res://game/levels/authoring/map_entity_authoring_serializer.gd")
const MapMarkerScript := preload("res://game/levels/authoring/map_element_marker.gd")
const UI_WORKBENCH := "res://game/ui/designer/workbench/ui_workbench.tscn"
const SHARED_THEME := "res://game/ui/theme/living_arsenal_theme.tres"
const MAP_WORKBENCH := "res://game/levels/authoring/level_workbench.tscn"
const MAP_OVERVIEW := "res://tools/map_overview.tscn"
const TUNING_PROFILE := "res://data/content/tuning/gameplay_tuning.tres"
const TUNING_JSON := "res://config/gameplay_tuning.json"
const VFX_LIBRARY := "res://data/content/vfx/vfx_library.tres"
const TUNING_GUIDE := "res://docs/DESIGNER_TUNING_GUIDE_VI.md"
const AUTHORING_LABELS := {
	"base_damage": "Sát thương nền",
	"max_health": "Máu tối đa",
	"movement_speed": "Tốc độ di chuyển",
	"attack_damage": "Sát thương đòn đánh",
	"stagger_damage": "Sát thương khựng",
	"attack_cooldown_seconds": "Hồi giữa các đòn",
	"cooldown_seconds": "Hồi chiêu",
	"active_skill_cooldown_seconds": "Hồi kỹ năng chủ động",
	"active_skill_mana_cost": "Mana kỹ năng chủ động",
	"mana_cost": "Mana tiêu hao",
	"telegraph_seconds": "Thời gian báo đòn",
	"recovery_seconds": "Thời gian hồi sau đòn",
	"preferred_range": "Khoảng cách quái muốn đứng",
	"attack_range": "Tầm đánh",
	"awareness_range": "Tầm phát hiện người chơi",
	"crowd_control_resistance": "Kháng khống chế",
	"stagger_resistance": "Kháng khựng",
	"chance_per_camp": "Tỉ lệ Elite mỗi camp",
	"health_multiplier": "Hệ số máu",
	"damage_multiplier": "Hệ số sát thương",
	"attack_rate_multiplier": "Hệ số tốc độ đánh",
	"movement_multiplier": "Hệ số tốc độ di chuyển",
	"reward_score_multiplier": "Hệ số phần thưởng",
	"start_delay_seconds": "Chờ trước khi wave bắt đầu",
	"inter_group_delay_seconds": "Nghỉ giữa các group",
	"normal_attack": "Đòn đánh thường",
	"hand_skill": "Kỹ năng tay",
	"spirit_trigger": "Điều kiện kích hoạt Linh hồn",
	"spirit_action": "Kỹ năng Linh hồn",
	"combo_damage": "Sát thương từng nhát combo",
	"combo_damage_multipliers": "Hệ số sát thương từng nhát combo",
	"wizard_rmb_density_damage_ratios": "Tỉ lệ sát thương chuột phải Wizard theo tầng",
	"target_cap": "Số mục tiêu tối đa",
	"projectile_speed": "Tốc độ đạn",
	"outbound_speed": "Tốc độ bay đi",
	"return_speed": "Tốc độ bay về",
	"radius": "Bán kính",
	"range": "Tầm ảnh hưởng",
	"width": "Độ rộng vùng trúng",
}

const MAP_LAYOUTS := [
	["C1-01 | Ham Mo Khai An", "res://data/levels/crypt_entrance.json"],
	["C1-02 | Nga Ba Cot Trang", "res://data/levels/chapter_1_level_2.json"],
	["C1-03 | Thu Kho Giao Hoa", "res://data/levels/chapter_1_level_3.json"],
	["C1-04 | Thanh Tich Xoan Oc", "res://data/levels/chapter_1_level_4.json"],
	["C1-05 | Lo Hien Te Huyet Cot", "res://data/levels/chapter_1_level_5.json"],
	["C1-06 | Two Souls, One Path", "res://data/levels/chapter_1_level_6.json"],
	["C1-07 | The Failing Beacon", "res://data/levels/chapter_1_level_7.json"],
	["C1-08 | The Divided Reliquary", "res://data/levels/chapter_1_level_8.json"],
	["C1-09 | The Crimson Gate", "res://data/levels/chapter_1_level_9.json"],
	["C1-10 | Lord of the Sealed Crypt", "res://data/levels/chapter_1_level_10.json"],
	["C2-11 | Cong Roi", "res://data/levels/chapter_2_level_11.json"],
	["C2-12 | Mach Doc Tro", "res://data/levels/chapter_2_level_12.json"],
	["C2-13 | Rung Den Tat", "res://data/levels/chapter_2_level_13.json"],
	["C2-14 | Xom Gia Kim", "res://data/levels/chapter_2_level_14.json"],
	["C2-15 | Ke Pha Khe", "res://data/levels/chapter_2_level_15.json"],
	["C2-16 | Me Lo Cong Nguyen", "res://data/levels/chapter_2_level_16.json"],
	["C2-17 | Nghi Le Giu Lua", "res://data/levels/chapter_2_level_17.json"],
	["C2-18 | Di Vat Biet Tho", "res://data/levels/chapter_2_level_18.json"],
	["C2-19 | Sabbath Ma Duc", "res://data/levels/chapter_2_level_19.json"],
	["C2-20 | Trai Tim Xuong Hac Phu", "res://data/levels/chapter_2_level_20.json"],
]

const UI_SCREENS := [
	["Boot", "res://game/ui/screens/boot/boot_screen.tscn"],
	["HUD combat", "res://game/ui/HUD.tscn"],
	["Title", "res://game/ui/screens/title/title_screen.tscn"],
	["Hub shell", "res://game/ui/screens/hub/hub_screen.tscn"],
	["Campaign tab", "res://game/ui/screens/hub/tabs/campaign_tab.tscn"],
	["Arsenal tab", "res://game/ui/screens/hub/tabs/arsenal_tab.tscn"],
	["Bestiary tab", "res://game/ui/screens/hub/tabs/bestiary_tab.tscn"],
	["Modes tab", "res://game/ui/screens/hub/tabs/modes_tab.tscn"],
	["Settings tab", "res://game/ui/screens/hub/tabs/settings_tab.tscn"],
	["Level details", "res://game/ui/screens/level_details/training_details_screen.tscn"],
	["Results", "res://game/ui/screens/results/training_results_screen.tscn"],
	["Settings", "res://game/ui/screens/settings/settings_screen.tscn"],
	["Credits", "res://game/ui/screens/credits/credits_screen.tscn"],
]

const UI_COMPONENTS := [
	["Brand header", "res://game/ui/designer/components/brand_header.tscn"],
	["Stat cluster", "res://game/ui/designer/components/stat_cluster.tscn"],
	["Action deck", "res://game/ui/designer/components/action_deck.tscn"],
	["Content card", "res://game/ui/designer/components/content_card.tscn"],
	["Dialog card", "res://game/ui/designer/components/dialog_card.tscn"],
	["Navigation bar", "res://game/ui/designer/components/navigation_bar.tscn"],
	["Prompt toast", "res://game/ui/designer/components/prompt_toast.tscn"],
	["Inventory slot", "res://game/ui/designer/components/inventory_slot.tscn"],
	["New fullscreen", "res://game/ui/designer/templates/fullscreen_screen_template.tscn"],
	["New HUD overlay", "res://game/ui/designer/templates/hud_overlay_template.tscn"],
]

const ASSET_RESOURCES := [
	["Theme", SHARED_THEME],
	["Input prompts", "res://assets/ui/input_prompts/tilemap_packed.png"],
	["Fantasy icons", "res://assets/ui/fantasy_icons.png"],
	["Inventory frames", "res://assets/ui/free_inventory/Inventory_background.png"],
	["Chapter key art", "res://assets/branding/chapter_1_key_art_imagen.png"],
	["Soul emblem", "res://assets/branding/soul_hero_emblem_imagen.png"],
	["Handjet", "res://assets/fonts/Handjet-SemiBold.ttf"],
	["Grenze Gotisch", "res://assets/fonts/GrenzeGotisch-SemiBold.ttf"],
	["VT323", "res://assets/fonts/VT323-Regular.ttf"],
]

var _dock: VBoxContainer
var _content: VBoxContainer
var _status: Label
var _map_path_label: Label
var _map_pull_button: Button
var _map_push_button: Button
var _map_link_button: Button
var _map_selector: OptionButton
var _content_selector: OptionButton
var _content_paths: PackedStringArray = []
var _balance_form: VBoxContainer
var _balance_open_button: Button
var _balance_spins: Dictionary = {}
var _content_category_selector: OptionButton
var _content_visible_paths: PackedStringArray = []
var _authoring_form: VBoxContainer
var _authoring_title: Label
var _authoring_summary: Label
var _authoring_fields: VBoxContainer
var _authoring_resource: Resource
var _authoring_root_resource: Resource
var _authoring_root_path := ""
var _authoring_history: Array[Dictionary] = []


func _enter_tree() -> void:
	_build_dock()
	add_control_to_dock(EditorPlugin.DOCK_SLOT_LEFT_BL, _dock)
	if not scene_changed.is_connected(_on_scene_changed):
		scene_changed.connect(_on_scene_changed)
	call_deferred(&"_refresh_map_context")


func _exit_tree() -> void:
	if scene_changed.is_connected(_on_scene_changed):
		scene_changed.disconnect(_on_scene_changed)
	if _dock != null:
		remove_control_from_docks(_dock)
		_dock.queue_free()
	_dock = null


func _build_dock() -> void:
	_dock = VBoxContainer.new()
	_dock.name = "Designer"
	_dock.custom_minimum_size = Vector2(286.0, 0.0)

	var title := Label.new()
	title.text = "SOUL OF HERO — DESIGNER"
	title.add_theme_font_size_override(&"font_size", 17)
	_dock.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Chỉnh trực tiếp ngay trong Designer. Không cần sửa script hay tìm Inspector."
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.modulate = Color(0.72, 0.78, 0.86)
	_dock.add_child(subtitle)
	var guide_button := Button.new()
	guide_button.text = "📘 Hướng dẫn chỉnh game bằng tiếng Việt"
	guide_button.tooltip_text = "Giải thích ý nghĩa từng loại thông số, ví dụ chỉnh độ khó và những thứ không nên đổi."
	guide_button.pressed.connect(_open_tuning_guide)
	_dock.add_child(guide_button)

	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_dock.add_child(scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_content)

	_add_separator()
	_add_heading("MAP")
	_add_map_controls()
	_add_scene_button("Xem toàn cảnh map", MAP_OVERVIEW)
	_map_path_label = Label.new()
	_map_path_label.text = "Mở một scene level để bắt đầu."
	_map_path_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_map_path_label.modulate = Color(0.66, 0.82, 0.92)
	_content.add_child(_map_path_label)
	var sync_row := HBoxContainer.new()
	_map_pull_button = Button.new()
	_map_pull_button.text = "↓ Nạp element"
	_map_pull_button.tooltip_text = "Tạo marker kéo-thả từ entities trong JSON hiện tại."
	_map_pull_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_map_pull_button.pressed.connect(_pull_map_entities.bind(true))
	sync_row.add_child(_map_pull_button)
	_map_push_button = Button.new()
	_map_push_button.text = "↑ Lưu element"
	_map_push_button.tooltip_text = "Validate rồi lưu vị trí/thuộc tính marker về JSON."
	_map_push_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_map_push_button.pressed.connect(_push_map_entities)
	sync_row.add_child(_map_push_button)
	_content.add_child(sync_row)
	_map_link_button = Button.new()
	_map_link_button.text = "⇄ Nối 2 cửa tầng đang chọn"
	_map_link_button.tooltip_text = "Chọn đúng hai Floor Door marker trong Scene Tree rồi bấm để liên kết hai chiều."
	_map_link_button.pressed.connect(_link_selected_floor_doors)
	_content.add_child(_map_link_button)

	var palette_label := Label.new()
	palette_label.text = "Thêm element tại giữa viewport"
	palette_label.modulate = Color(0.78, 0.82, 0.9)
	_content.add_child(palette_label)
	var palette := GridContainer.new()
	palette.columns = 2
	palette.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for entity_type: String in MapSerializer.PRESET_PATHS:
		var button := Button.new()
		button.text = "+ %s" % entity_type.replace("_", " ").capitalize()
		button.tooltip_text = "Thêm preset %s; sau đó kéo marker bằng chuột trong viewport 2D." % entity_type
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_add_map_element.bind(entity_type))
		palette.add_child(button)
	_content.add_child(palette)
	var map_hint := Label.new()
	map_hint.text = "Kéo preset từ game/levels/authoring/presets vào AuthoringEntities rồi đặt bằng chuột."
	map_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	map_hint.modulate = Color(0.68, 0.72, 0.8)
	_content.add_child(map_hint)

	_add_separator()
	_add_heading("BALANCE + CONTENT")
	_add_balance_controls()
	_add_content_browser()
	_add_authoring_form()
	_add_vfx_controls()

	_add_separator()
	_add_heading("UI WORKBENCH")
	_add_scene_button("Mở UI Workbench", UI_WORKBENCH)
	_add_resource_button("Chỉnh theme dùng chung", SHARED_THEME)

	var screen_grid := GridContainer.new()
	screen_grid.columns = 2
	screen_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for entry: Array in UI_SCREENS:
		var button := Button.new()
		button.text = String(entry[0])
		button.tooltip_text = String(entry[1])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_open_scene.bind(String(entry[1])))
		screen_grid.add_child(button)
	_content.add_child(screen_grid)

	var component_label := Label.new()
	component_label.text = "Component kéo-thả"
	component_label.modulate = Color(0.78, 0.82, 0.9)
	_content.add_child(component_label)
	var component_grid := GridContainer.new()
	component_grid.columns = 2
	component_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for entry: Array in UI_COMPONENTS:
		var button := Button.new()
		button.text = String(entry[0])
		button.tooltip_text = "Mở component mẫu; cũng có thể kéo scene này từ FileSystem vào UI đang chỉnh.\n%s" % String(entry[1])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_open_scene.bind(String(entry[1])))
		component_grid.add_child(button)
	_content.add_child(component_grid)

	_add_separator()
	_add_heading("ASSET LIBRARY")
	var asset_grid := GridContainer.new()
	asset_grid.columns = 2
	asset_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for entry: Array in ASSET_RESOURCES:
		var button := Button.new()
		button.text = String(entry[0])
		button.tooltip_text = "Mở resource trong bảng Designer:\n%s" % String(entry[1])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_open_authoring_resource.bind(String(entry[1])))
		asset_grid.add_child(button)
	_content.add_child(asset_grid)

	_add_separator()
	var play_button := Button.new()
	play_button.text = "▶ Chạy scene đang chỉnh"
	play_button.pressed.connect(func() -> void: get_editor_interface().play_current_scene())
	_content.add_child(play_button)

	_status = Label.new()
	_status.text = "Sẵn sàng."
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(0.0, 44.0)
	_status.modulate = Color(0.58, 0.9, 0.68)
	_content.add_child(_status)


func _open_tuning_guide() -> void:
	var open_error: Error = OS.shell_open(ProjectSettings.globalize_path(TUNING_GUIDE))
	if open_error != OK:
		_set_status("Không mở được hướng dẫn. File nằm tại %s" % TUNING_GUIDE, true)


func _add_map_controls() -> void:
	_add_scene_button("Mở Map Workbench", MAP_WORKBENCH)
	var row := HBoxContainer.new()
	_map_selector = OptionButton.new()
	_map_selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_map_selector.tooltip_text = "Chọn map cần vẽ/đặt element. Workbench chỉ là bản xem trước; JSON là dữ liệu map thật."
	for entry: Array in MAP_LAYOUTS:
		_map_selector.add_item(String(entry[0]))
	row.add_child(_map_selector)
	var open_button := Button.new()
	open_button.text = "Mở map"
	open_button.tooltip_text = "Mở map đã chọn trong workbench riêng, không sửa scene game chính."
	open_button.pressed.connect(_open_selected_map)
	row.add_child(open_button)
	_content.add_child(row)
	var hint := Label.new()
	hint.text = "Map: chọn ải → Mở map → kéo/vẽ → dùng Lưu element và Push layer → chạy thử. Không cần lưu scene workbench."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.modulate = Color(0.68, 0.78, 0.92)
	_content.add_child(hint)


func _add_balance_controls() -> void:
	var balance_row := HBoxContainer.new()
	_balance_open_button = Button.new()
	_balance_open_button.text = "1. Chỉnh Balance"
	_balance_open_button.tooltip_text = "Mở bảng chỉnh số ngay tại đây. Không cần tìm Inspector."
	_balance_open_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_balance_open_button.pressed.connect(_toggle_balance_form)
	balance_row.add_child(_balance_open_button)
	var apply_button := Button.new()
	apply_button.text = "2. Áp dụng"
	apply_button.tooltip_text = "Validate rồi ghi các số vào config chạy game. Game đang chạy sẽ tự nạp lại."
	apply_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	apply_button.pressed.connect(_apply_balance_profile)
	balance_row.add_child(apply_button)
	_content.add_child(balance_row)
	var reload_button := Button.new()
	reload_button.text = "Nạp số Balance đang chạy"
	reload_button.tooltip_text = "Bỏ thay đổi Balance chưa áp dụng và nạp lại từ config/gameplay_tuning.json."
	reload_button.pressed.connect(_reload_balance_profile)
	_content.add_child(reload_button)
	_add_balance_form()


func _add_balance_form() -> void:
	_balance_form = VBoxContainer.new()
	_balance_form.visible = false
	_balance_form.add_theme_constant_override(&"separation", 6)
	_content.add_child(_balance_form)
	var title := Label.new()
	title.text = "Bảng Balance — đổi số, sau đó bấm 2. Áp dụng"
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.modulate = Color(0.82, 0.9, 1.0)
	_balance_form.add_child(title)
	_add_balance_group("Di chuyển")
	_add_balance_field("Tốc độ chạy", &"move_speed", 1.0, 600.0, 1.0, "px/giây")
	_add_balance_field("Tốc độ cúi", &"crouch_speed", 1.0, 600.0, 1.0, "px/giây")
	_add_balance_field("Gia tốc", &"acceleration", 1.0, 5000.0, 1.0, "px/giây²")
	_add_balance_field("Ma sát", &"friction", 1.0, 5000.0, 1.0, "px/giây²")
	_add_balance_field("Tốc độ lướt", &"dash_speed", 1.0, 1200.0, 1.0, "px/giây")
	_add_balance_field("Thời gian lướt", &"dash_duration", 0.05, 5.0, 0.01, "giây")
	_add_balance_field("Hồi lướt", &"dash_cooldown", 0.0, 10.0, 0.01, "giây")
	_add_balance_field("Tốc độ lăn", &"roll_speed", 1.0, 1200.0, 1.0, "px/giây")
	_add_balance_field("Thời gian lăn", &"roll_duration", 0.05, 5.0, 0.01, "giây")
	_add_balance_field("Tốc độ trượt", &"slide_speed", 1.0, 1200.0, 1.0, "px/giây")
	_add_balance_field("Thời gian trượt", &"slide_duration", 0.05, 5.0, 0.01, "giây")
	_add_balance_field("Tốc độ nhảy", &"hop_speed", 1.0, 1200.0, 1.0, "px/giây")
	_add_balance_field("Thời gian nhảy", &"hop_duration", 0.05, 5.0, 0.01, "giây")
	_add_balance_field("Độ cao nhảy", &"hop_height", 0.0, 128.0, 0.5, "px")
	_add_balance_group("Máu và thể lực")
	_add_balance_field("Máu tối đa", &"max_health", 1.0, 9999.0, 1.0, "HP")
	_add_balance_field("Thể lực tối đa", &"max_stamina", 1.0, 2000.0, 1.0, "")
	_add_balance_field("Hồi thể lực", &"stamina_regen", 0.0, 2000.0, 1.0, "/giây")
	_add_balance_group("Chiến đấu cơ bản")
	_add_balance_field("Sát thương đánh nhẹ", &"light_damage", 0.0, 9999.0, 1.0, "")
	_add_balance_field("Sát thương đánh mạnh", &"heavy_damage", 0.0, 9999.0, 1.0, "")
	_add_balance_field("Sát thương khi cúi", &"crouch_damage", 0.0, 9999.0, 1.0, "")
	_add_balance_field("Thời gian reset combo", &"combo_reset_time", 0.05, 10.0, 0.01, "giây")
	_add_balance_field("Bất tử sau khi trúng", &"hit_invulnerability", 0.0, 10.0, 0.01, "giây")


func _add_balance_group(label_text: String) -> void:
	var label := Label.new()
	label.text = label_text
	label.modulate = Color(0.96, 0.76, 0.4)
	_balance_form.add_child(label)


func _add_balance_field(label_text: String, property_name: StringName, minimum: float, maximum: float, step: float, unit: String) -> void:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = "%s%s" % [label_text, " (%s)" % unit if not unit.is_empty() else ""]
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.add_child(label)
	var spin := SpinBox.new()
	spin.min_value = minimum
	spin.max_value = maximum
	spin.step = step
	spin.rounded = step >= 1.0
	spin.custom_minimum_size = Vector2(118.0, 0.0)
	spin.tooltip_text = "%s: từ %s đến %s" % [label_text, minimum, maximum]
	spin.value_changed.connect(_on_balance_value_changed.bind(property_name))
	row.add_child(spin)
	_balance_spins[property_name] = spin
	_balance_form.add_child(row)


func _toggle_balance_form() -> void:
	if _balance_form == null:
		return
	_balance_form.visible = not _balance_form.visible
	_balance_open_button.text = "Ẩn bảng Balance" if _balance_form.visible else "1. Chỉnh Balance"
	if _balance_form.visible:
		var profile := load(TUNING_PROFILE) as GameplayTuningProfile
		if profile == null:
			_set_status("Không nạp được Balance profile.", true)
			return
		_sync_balance_form_from_profile(profile)
		_set_status("Đổi số trong bảng bên dưới, rồi bấm 2. Áp dụng.")


func _on_balance_value_changed(value: float, property_name: StringName) -> void:
	var profile := load(TUNING_PROFILE) as GameplayTuningProfile
	if profile == null:
		return
	profile.set(property_name, int(value) if property_name in [&"max_health", &"light_damage", &"heavy_damage", &"crouch_damage"] else value)
	profile.emit_changed()


func _sync_balance_form_from_profile(profile: GameplayTuningProfile) -> void:
	for property_name: StringName in _balance_spins:
		var spin := _balance_spins[property_name] as SpinBox
		if spin != null:
			spin.set_value_no_signal(float(profile.get(property_name)))


func _add_content_browser() -> void:
	var label := Label.new()
	label.text = "Balance chi tiết — chọn loại, rồi chọn đúng tướng / quái / chiêu / tỉ lệ cần chỉnh"
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.modulate = Color(0.78, 0.82, 0.9)
	_content.add_child(label)
	_content_paths = _collect_design_content_paths()
	_content_category_selector = OptionButton.new()
	_content_category_selector.tooltip_text = "Lọc theo loại nội dung để không phải tìm trong một danh sách dài."
	for category_name: String in [
		"Tất cả nội dung",
		"Tướng + chiêu",
		"Vũ khí + kỹ năng",
		"Quái + Elite + tỉ lệ",
		"Đợt quái / Encounter",
		"Thưởng + Item",
		"Map / ải",
		"VFX",
	]:
		_content_category_selector.add_item(category_name)
	_content_category_selector.item_selected.connect(_refresh_content_selector)
	_content.add_child(_content_category_selector)
	var row := HBoxContainer.new()
	_content_selector = OptionButton.new()
	_content_selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content_selector.tooltip_text = "Chọn data cần chỉnh. Bảng chỉnh hiện ngay trong Designer, không cần Inspector."
	row.add_child(_content_selector)
	var open_button := Button.new()
	open_button.text = "Chỉnh"
	open_button.pressed.connect(_open_selected_content)
	row.add_child(open_button)
	_content.add_child(row)
	_refresh_content_selector(0)
	var check_button := Button.new()
	check_button.text = "Kiểm tra nội dung đang chỉnh"
	check_button.tooltip_text = "Kiểm tra Balance, VFX hoặc nội dung đang mở trước khi chạy game."
	check_button.pressed.connect(_validate_design_controls)
	_content.add_child(check_button)


func _add_vfx_controls() -> void:
	var row := HBoxContainer.new()
	var open_button := Button.new()
	open_button.text = "Chỉnh thư viện VFX"
	open_button.tooltip_text = "Một nơi cho texture, ô frame, FPS, scale, màu, vị trí và z-index của mọi VFX dùng lại."
	open_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	open_button.pressed.connect(_open_authoring_resource.bind(VFX_LIBRARY))
	row.add_child(open_button)
	var test_button := Button.new()
	test_button.text = "Chạy test VFX"
	test_button.tooltip_text = "Mở test tự động trong terminal bằng tools/run_vfx_tests.ps1."
	test_button.pressed.connect(_run_vfx_tests)
	row.add_child(test_button)
	_content.add_child(row)


func _open_selected_map() -> void:
	if _map_selector == null or _map_selector.selected < 0 or _map_selector.selected >= MAP_LAYOUTS.size():
		_set_status("Hãy chọn map trước.", true)
		return
	var layout_path := String(MAP_LAYOUTS[_map_selector.selected][1])
	_open_scene(MAP_WORKBENCH)
	call_deferred(&"_configure_workbench_for_level", layout_path)


func _configure_workbench_for_level(layout_path: String) -> void:
	var context := _get_map_context()
	if not bool(context.get("ok", false)):
		_set_status("Không mở được Map Workbench: %s" % context.get("error", "unknown error"), true)
		return
	var level := context["level"] as Node
	level.set("level_data_path", layout_path)
	if level.has_method(&"reload_from_disk"):
		level.call(&"reload_from_disk")
	var result: Dictionary = MapSerializer.deserialize_level_file(
		context["container"],
		layout_path,
		context["root"],
	)
	if not bool(result.get("ok", false)):
		_set_status("Không thể nạp map: %s" % result.get("error", "unknown error"), true)
		return
	get_editor_interface().mark_scene_as_unsaved()
	_refresh_map_context()
	_set_status("Đang thiết kế %s: đã nạp %d element. Chỉ dùng Lưu element/Push layer để chốt map." % [
		layout_path.get_file(),
		int(result.get("count", 0)),
	])


func _reload_balance_profile() -> void:
	var profile := load(TUNING_PROFILE) as GameplayTuningProfile
	if profile == null:
		_set_status("Không nạp được Balance profile.", true)
		return
	var read := _read_json_document(TUNING_JSON)
	if not bool(read.get("ok", false)):
		_set_status("Không nạp được Balance: %s" % read.get("error", "unknown error"), true)
		return
	var result: Dictionary = profile.load_document(read["document"])
	if not bool(result.get("ok", false)):
		_set_status("Balance trong game không hợp lệ: %s" % result.get("error", "unknown error"), true)
		return
	var save_error := ResourceSaver.save(profile, TUNING_PROFILE)
	if save_error != OK:
		_set_status("Đã nạp nhưng không lưu được profile: %s" % error_string(save_error), true)
		return
	_sync_balance_form_from_profile(profile)
	_set_status("Đã nạp số Balance đang chạy vào bảng Balance.")


func _apply_balance_profile() -> void:
	var profile := load(TUNING_PROFILE) as GameplayTuningProfile
	if profile == null:
		_set_status("Không nạp được Balance profile.", true)
		return
	var errors := profile.get_validation_errors()
	if not errors.is_empty():
		_set_status("Balance chưa hợp lệ: %s" % errors[0], true)
		return
	var profile_error := ResourceSaver.save(profile, TUNING_PROFILE)
	if profile_error != OK:
		_set_status("Không lưu được Balance profile: %s" % error_string(profile_error), true)
		return
	var written := _write_json_document(TUNING_JSON, profile.to_document())
	if not bool(written.get("ok", false)):
		_set_status("Không áp dụng Balance: %s" % written.get("error", "unknown error"), true)
		return
	_set_status("Đã validate và áp dụng Balance. Nếu game đang chạy, nó sẽ tự nạp lại sau ít hơn 2 giây.")


func _open_selected_content() -> void:
	if _content_selector == null or _content_selector.selected < 0 or _content_selector.selected >= _content_visible_paths.size():
		_set_status("Không có content asset để mở.", true)
		return
	_open_authoring_resource(_content_visible_paths[_content_selector.selected])


func _refresh_content_selector(_selected_index := 0) -> void:
	if _content_selector == null or _content_category_selector == null:
		return
	var selected_category := _content_category_selector.get_item_text(_content_category_selector.selected)
	_content_selector.clear()
	_content_visible_paths = PackedStringArray()
	for path: String in _content_paths:
		if _matches_content_category(path, selected_category):
			_content_visible_paths.append(path)
			_content_selector.add_item(_content_label(path))


func _matches_content_category(path: String, category: String) -> bool:
	if category == "Tất cả nội dung":
		return true
	match category:
		"Tướng + chiêu":
			return path.begins_with("res://game/heroes/")
		"Vũ khí + kỹ năng":
			return path.begins_with("res://game/weapons/")
		"Quái + Elite + tỉ lệ":
			return "/enemies/" in path or "/elite_" in path
		"Đợt quái / Encounter":
			return "/encounters/" in path or "/rosters/" in path
		"Thưởng + Item":
			return "/rewards/" in path or "/items/" in path or "/progression/" in path
		"Map / ải":
			return "/levels/" in path
		"VFX":
			return "/vfx/" in path
	return false


func _add_authoring_form() -> void:
	_authoring_form = VBoxContainer.new()
	_authoring_form.visible = false
	_authoring_form.add_theme_constant_override(&"separation", 8)
	_content.add_child(_authoring_form)
	_authoring_form.add_child(HSeparator.new())
	_authoring_title = Label.new()
	_authoring_title.add_theme_font_size_override(&"font_size", 16)
	_authoring_title.modulate = Color(1.0, 0.83, 0.45)
	_authoring_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_authoring_form.add_child(_authoring_title)
	_authoring_summary = Label.new()
	_authoring_summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_authoring_summary.modulate = Color(0.72, 0.8, 0.9)
	_authoring_form.add_child(_authoring_summary)
	var actions := HBoxContainer.new()
	var save_button := Button.new()
	save_button.text = "Lưu nội dung này"
	save_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	save_button.pressed.connect(_save_authoring_resource)
	actions.add_child(save_button)
	var back_button := Button.new()
	back_button.text = "Quay lại"
	back_button.pressed.connect(_authoring_back)
	actions.add_child(back_button)
	var close_button := Button.new()
	close_button.text = "Đóng bảng"
	close_button.pressed.connect(func() -> void: _authoring_form.visible = false)
	actions.add_child(close_button)
	_authoring_form.add_child(actions)
	var note := Label.new()
	note.text = "Mỗi ô có giới hạn an toàn. Với mục có mũi tên Mở, bấm vào để chỉnh chiêu / profile / phần con của nó."
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.modulate = Color(0.68, 0.74, 0.82)
	_authoring_form.add_child(note)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0.0, 440.0)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_authoring_form.add_child(scroll)
	_authoring_fields = VBoxContainer.new()
	_authoring_fields.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_authoring_fields.add_theme_constant_override(&"separation", 6)
	scroll.add_child(_authoring_fields)


func _open_authoring_resource(target: Variant, nested := false) -> void:
	var resource: Resource
	var path := ""
	if target is String:
		path = String(target)
		resource = load(path) as Resource
	elif target is Resource:
		resource = target as Resource
		path = resource.resource_path
	if resource == null:
		_set_status("Không nạp được nội dung để chỉnh.", true)
		return
	if nested and _authoring_resource != null:
		_authoring_history.append({
			"resource": _authoring_resource,
			"root_resource": _authoring_root_resource,
			"root_path": _authoring_root_path,
		})
	else:
		_authoring_history.clear()
	if not nested or not path.is_empty():
		_authoring_root_resource = resource
		_authoring_root_path = path
	_present_authoring_resource(resource)


func _present_authoring_resource(resource: Resource) -> void:
	_authoring_resource = resource
	_authoring_form.visible = true
	_authoring_title.text = "Đang chỉnh: %s" % _authoring_display_name(resource)
	_authoring_summary.text = (
		"Lưu sẽ ghi vào %s." % _authoring_root_path
		if not _authoring_root_path.is_empty()
		else "Đây là phần con của resource đang chỉnh; nút Lưu sẽ ghi resource cha.")
	_build_authoring_fields(resource)
	_set_status("Đang chỉnh %s ngay trong Designer." % _authoring_display_name(resource))


func _authoring_back() -> void:
	if _authoring_history.is_empty():
		_set_status("Bạn đang ở nội dung gốc.")
		return
	var previous: Dictionary = _authoring_history.pop_back()
	_authoring_root_resource = previous.get("root_resource") as Resource
	_authoring_root_path = String(previous.get("root_path", ""))
	_present_authoring_resource(previous.get("resource") as Resource)


func _authoring_display_name(resource: Resource) -> String:
	var display_name := String(resource.get("display_name")) if _resource_has_property(resource, &"display_name") else ""
	if not display_name.strip_edges().is_empty():
		return display_name
	var resource_path := resource.resource_path
	return resource_path.get_file().get_basename() if not resource_path.is_empty() else resource.get_class()


func _authoring_label(property_name: StringName) -> String:
	var key := String(property_name)
	return String(AUTHORING_LABELS.get(key, key.replace("_", " ").capitalize()))


func _authoring_help(property_name: StringName) -> String:
	var key := String(property_name)
	var exact := {
		"max_health": "Máu tối đa. Giảm 10–15% nếu quái mất quá lâu để hạ.",
		"attack_damage": "Damage một đòn. Giảm 10% nếu quái gây áp lực quá cao.",
		"attack_cooldown_seconds": "Số giây giữa hai lần ra đòn. Tăng lên để quái đánh chậm hơn.",
		"telegraph_seconds": "Số giây báo trước khi đòn trúng. Tăng lên giúp người chơi dễ né hơn.",
		"recovery_seconds": "Số giây nghỉ sau đòn. Tăng lên tạo thêm thời gian phản công.",
		"chance_per_camp": "Xác suất: 0.20 nghĩa là 20% camp có Elite.",
		"health_multiplier": "Hệ số: 2.0 nghĩa là máu gấp đôi quái thường.",
		"damage_multiplier": "Hệ số: 1.25 nghĩa là damage tăng 25%.",
		"wizard_rmb_density_damage_ratios": "Danh sách hệ số damage; 1.0 = 100% sát thương nền.",
	}
	if exact.has(key):
		return String(exact[key])
	if "chance" in key:
		return "Tỉ lệ từ 0 đến 1: 0.20 = 20%, 1.0 = 100%."
	if "ratio" in key or "multiplier" in key:
		return "Hệ số: 1.0 = 100%, 0.5 = 50%, 1.5 = 150%."
	if "cooldown" in key or "seconds" in key or "duration" in key or "delay" in key:
		return "Thời gian, đơn vị giây. Số nhỏ hơn thường làm hành động xảy ra thường xuyên hơn."
	if "speed" in key:
		return "Tốc độ, thường tính bằng pixel/giây. Tăng từ từ 5–10% mỗi lần."
	if "range" in key or "radius" in key or "distance" in key or "width" in key:
		return "Khoảng cách/vùng ảnh hưởng, thường tính bằng pixel. Tăng quá nhiều sẽ làm skill dễ trúng hơn."
	if "damage" in key:
		return "Sát thương. Chỉ đổi 5–15% mỗi lần để dễ cảm nhận khác biệt."
	if "cap" in key or "count" in key or "maximum" in key:
		return "Số lượng tối đa mục tiêu/đối tượng mà hiệu ứng có thể tác động."
	return "Rê chuột lên các ô khác hoặc xem nút Hướng dẫn tiếng Việt để biết cách chỉnh theo mục tiêu."


func _build_authoring_fields(resource: Resource) -> void:
	for child: Node in _authoring_fields.get_children():
		child.queue_free()
	var field_count := 0
	for info: Dictionary in resource.get_property_list():
		var usage := int(info.get("usage", 0))
		var property_type := int(info.get("type", TYPE_NIL))
		var property_name := StringName(info.get("name", ""))
		if property_type == TYPE_NIL and (usage & PROPERTY_USAGE_CATEGORY) != 0:
			_add_authoring_category(String(property_name))
			continue
		if (usage & PROPERTY_USAGE_STORAGE) == 0 or not _is_authoring_property(property_name):
			continue
		_add_authoring_property(resource, property_name, property_type, info)
		field_count += 1
	if field_count == 0:
		var empty := Label.new()
		empty.text = "Resource này không có thông số trực tiếp để chỉnh. Hãy mở một phần con hoặc dùng công cụ chuyên dụng bên trên."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_authoring_fields.add_child(empty)


func _is_authoring_property(property_name: StringName) -> bool:
	return property_name not in [&"resource_path", &"resource_name", &"resource_local_to_scene", &"script"]


func _resource_has_property(resource: Resource, property_name: StringName) -> bool:
	for info: Dictionary in resource.get_property_list():
		if StringName(info.get("name", "")) == property_name:
			return true
	return false


func _add_authoring_category(category_name: String) -> void:
	var separator := HSeparator.new()
	_authoring_fields.add_child(separator)
	var category := Label.new()
	category.text = _authoring_category_label(category_name)
	category.add_theme_font_size_override(&"font_size", 14)
	category.modulate = Color(0.96, 0.76, 0.4)
	_authoring_fields.add_child(category)


func _authoring_category_label(category_name: String) -> String:
	var labels := {
		"Identity": "Nhận dạng — không đổi ID nếu chưa chắc",
		"Runtime": "Vận hành trong game",
		"Vitals and movement": "Máu và di chuyển",
		"Attack readability": "Nhịp đánh và khả năng né",
		"Resistance and rewards": "Kháng hiệu ứng và phần thưởng",
		"Presentation hooks": "Hình ảnh, âm thanh và VFX",
		"Normal attack": "Đòn đánh thường",
		"Permanent active skill": "Kỹ năng chủ động",
		"Ordered content": "Nội dung theo thứ tự (wave/group)",
		"Currencies": "Tiền tệ",
		"Stackable inventory": "Vật phẩm cộng dồn",
	}
	return String(labels.get(category_name, category_name))


func _add_authoring_property(resource: Resource, property_name: StringName, property_type: int, info: Dictionary) -> void:
	var value: Variant = resource.get(property_name)
	var label_text := _authoring_label(property_name)
	match property_type:
		TYPE_BOOL:
			_add_authoring_bool(resource, property_name, label_text, bool(value))
		TYPE_INT, TYPE_FLOAT:
			if int(info.get("hint", PROPERTY_HINT_NONE)) == PROPERTY_HINT_ENUM:
				_add_authoring_enum(resource, property_name, label_text, int(value), String(info.get("hint_string", "")))
			else:
				_add_authoring_number(resource, property_name, label_text, float(value), property_type == TYPE_INT, String(info.get("hint_string", "")))
		TYPE_STRING, TYPE_STRING_NAME:
			_add_authoring_text(resource, property_name, label_text, String(value), int(info.get("hint", PROPERTY_HINT_NONE)) == PROPERTY_HINT_MULTILINE_TEXT, property_type == TYPE_STRING_NAME)
		TYPE_COLOR:
			_add_authoring_color(resource, property_name, label_text, value as Color)
		TYPE_VECTOR2:
			_add_authoring_vector2(resource, property_name, label_text, value as Vector2)
		TYPE_OBJECT:
			_add_authoring_resource_link(resource, property_name, label_text, value, String(info.get("hint_string", "")))
		TYPE_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY, TYPE_PACKED_STRING_ARRAY, TYPE_PACKED_VECTOR2_ARRAY:
			_add_authoring_collection(resource, property_name, label_text, value)
		_:
			_add_authoring_read_only(label_text, "Kiểu dữ liệu này chưa cần chỉnh trực tiếp.")


func _add_authoring_row(label_text: String, property_name := StringName()) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var help := _authoring_help(property_name) if not property_name.is_empty() else ""
	row.tooltip_text = help
	var label := Label.new()
	label.text = label_text
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.tooltip_text = help
	row.add_child(label)
	_authoring_fields.add_child(row)
	return row


func _add_authoring_bool(resource: Resource, property_name: StringName, label_text: String, value: bool) -> void:
	var row := _add_authoring_row(label_text, property_name)
	var field := CheckBox.new()
	field.button_pressed = value
	field.toggled.connect(_set_authoring_property.bind(resource, property_name))
	row.add_child(field)


func _add_authoring_number(resource: Resource, property_name: StringName, label_text: String, value: float, integer: bool, hint: String) -> void:
	var row := _add_authoring_row(label_text, property_name)
	var range := _range_from_hint(hint, integer)
	var field := SpinBox.new()
	field.min_value = float(range[0])
	field.max_value = float(range[1])
	field.step = float(range[2])
	field.rounded = integer
	field.value = value
	field.custom_minimum_size = Vector2(130.0, 0.0)
	field.value_changed.connect(_set_authoring_number.bind(resource, property_name, integer))
	row.add_child(field)


func _range_from_hint(hint: String, integer: bool) -> Array[float]:
	var fallback_step := 1.0 if integer else 0.01
	var result: Array[float] = [-999999.0, 999999.0, fallback_step]
	var values := hint.split(",", false)
	if values.size() >= 3 and values[0].is_valid_float() and values[1].is_valid_float() and values[2].is_valid_float():
		result = [float(values[0]), float(values[1]), float(values[2])]
	return result


func _add_authoring_enum(resource: Resource, property_name: StringName, label_text: String, value: int, hint: String) -> void:
	var row := _add_authoring_row(label_text, property_name)
	var field := OptionButton.new()
	var selected_index := 0
	for option: String in hint.split(",", false):
		var parts := option.split(":", false, 1)
		var option_label := parts[0]
		var option_value := int(parts[1]) if parts.size() > 1 and parts[1].is_valid_int() else field.item_count
		field.add_item(option_label, option_value)
		if option_value == value:
			selected_index = field.item_count - 1
	field.select(selected_index)
	field.item_selected.connect(_set_authoring_enum.bind(field, resource, property_name))
	row.add_child(field)


func _add_authoring_text(resource: Resource, property_name: StringName, label_text: String, value: String, multiline: bool, string_name: bool) -> void:
	if multiline:
		var label := Label.new()
		label.text = label_text
		_authoring_fields.add_child(label)
		var field := TextEdit.new()
		field.text = value
		field.custom_minimum_size = Vector2(0.0, 86.0)
		field.text_changed.connect(_set_authoring_multiline.bind(field, resource, property_name, string_name))
		_authoring_fields.add_child(field)
		return
	var row := _add_authoring_row(label_text, property_name)
	var field := LineEdit.new()
	field.text = value
	field.custom_minimum_size = Vector2(190.0, 0.0)
	field.text_changed.connect(_set_authoring_text.bind(resource, property_name, string_name))
	row.add_child(field)


func _add_authoring_color(resource: Resource, property_name: StringName, label_text: String, value: Color) -> void:
	var row := _add_authoring_row(label_text, property_name)
	var field := ColorPickerButton.new()
	field.color = value
	field.color_changed.connect(_set_authoring_property.bind(resource, property_name))
	row.add_child(field)


func _add_authoring_vector2(resource: Resource, property_name: StringName, label_text: String, value: Vector2) -> void:
	var row := _add_authoring_row(label_text, property_name)
	for component: String in ["X", "Y"]:
		var field := SpinBox.new()
		field.min_value = -5000.0
		field.max_value = 5000.0
		field.step = 0.5
		field.value = value.x if component == "X" else value.y
		field.custom_minimum_size = Vector2(88.0, 0.0)
		field.tooltip_text = "%s %s" % [label_text, component]
		field.value_changed.connect(_set_authoring_vector_component.bind(resource, property_name, component))
		row.add_child(field)


func _add_authoring_resource_link(resource: Resource, property_name: StringName, label_text: String, value: Variant, expected_type: String) -> void:
	var row := _add_authoring_row(label_text, property_name)
	if value is Resource:
		var open_button := Button.new()
		open_button.text = "Mở: %s" % _authoring_display_name(value as Resource)
		open_button.tooltip_text = "Chỉnh phần con này ngay trong Designer."
		open_button.pressed.connect(_open_authoring_resource.bind(value, true))
		row.add_child(open_button)
	var choose_button := Button.new()
	choose_button.text = "Đổi file" if value is Resource else "Chọn file"
	choose_button.tooltip_text = "Chọn texture, scene hoặc resource khác từ project."
	choose_button.pressed.connect(_pick_authoring_resource_file.bind(resource, property_name, expected_type))
	row.add_child(choose_button)


func _pick_authoring_resource_file(resource: Resource, property_name: StringName, expected_type: String) -> void:
	var dialog := EditorFileDialog.new()
	dialog.title = "Chọn file cho %s" % String(property_name).replace("_", " ")
	dialog.file_mode = EditorFileDialog.FILE_MODE_OPEN_FILE
	dialog.access = EditorFileDialog.ACCESS_RESOURCES
	if expected_type.contains("Texture"):
		dialog.add_filter("*.png, *.webp, *.jpg, *.jpeg, *.svg, *.tres ; Texture")
	elif expected_type.contains("PackedScene"):
		dialog.add_filter("*.tscn ; Scene")
	else:
		dialog.add_filter("*.tres, *.res, *.tscn ; Godot resource")
	dialog.file_selected.connect(_set_authoring_resource_file.bind(dialog, resource, property_name, expected_type))
	get_editor_interface().get_base_control().add_child(dialog)
	dialog.popup_centered_ratio(0.75)


func _set_authoring_resource_file(path: String, dialog: EditorFileDialog, resource: Resource, property_name: StringName, expected_type: String) -> void:
	dialog.queue_free()
	var selected := load(path) as Resource
	if selected == null:
		_set_status("Không nạp được file đã chọn.", true)
		return
	if not expected_type.is_empty() and expected_type != "Resource" and not selected.is_class(expected_type):
		_set_status("File này không đúng loại %s." % expected_type, true)
		return
	_set_authoring_property(selected, resource, property_name)
	_build_authoring_fields(_authoring_resource)
	_set_status("Đã chọn %s cho %s. Hãy bấm Lưu nội dung này." % [path.get_file(), String(property_name)])


func _add_authoring_collection(resource: Resource, property_name: StringName, label_text: String, value: Variant) -> void:
	var values: Array = []
	for entry: Variant in value:
		values.append(entry)
	if not values.is_empty() and values[0] is Resource:
		var label := Label.new()
		label.text = "%s (%d mục)" % [label_text, values.size()]
		_authoring_fields.add_child(label)
		for index: int in values.size():
			var child_resource := values[index] as Resource
			if child_resource == null:
				continue
			var open_button := Button.new()
			open_button.text = "Mở %s %d: %s" % [label_text, index + 1, _authoring_display_name(child_resource)]
			open_button.pressed.connect(_open_authoring_resource.bind(child_resource, true))
			_authoring_fields.add_child(open_button)
		return
	var row := _add_authoring_row("%s (ngăn cách bằng dấu phẩy)" % label_text, property_name)
	var field := LineEdit.new()
	field.text = _collection_to_text(value)
	field.custom_minimum_size = Vector2(240.0, 0.0)
	field.text_changed.connect(_set_authoring_collection.bind(resource, property_name, value))
	row.add_child(field)


func _collection_to_text(value: Variant) -> String:
	var parts := PackedStringArray()
	for entry: Variant in value:
		if entry is Vector2:
			parts.append("%s:%s" % [entry.x, entry.y])
		else:
			parts.append(str(entry))
	return ", ".join(parts)


func _add_authoring_read_only(label_text: String, message: String) -> void:
	var row := _add_authoring_row(label_text)
	var detail := Label.new()
	detail.text = message
	detail.modulate = Color(0.62, 0.66, 0.72)
	row.add_child(detail)


func _set_authoring_property(value: Variant, resource: Resource, property_name: StringName) -> void:
	resource.set(property_name, value)
	resource.emit_changed()


func _set_authoring_number(value: float, resource: Resource, property_name: StringName, integer: bool) -> void:
	_set_authoring_property(int(value) if integer else value, resource, property_name)


func _set_authoring_enum(_selected_index: int, field: OptionButton, resource: Resource, property_name: StringName) -> void:
	_set_authoring_property(field.get_selected_id(), resource, property_name)


func _set_authoring_text(value: String, resource: Resource, property_name: StringName, string_name: bool) -> void:
	_set_authoring_property(StringName(value) if string_name else value, resource, property_name)


func _set_authoring_multiline(field: TextEdit, resource: Resource, property_name: StringName, string_name: bool) -> void:
	_set_authoring_text(field.text, resource, property_name, string_name)


func _set_authoring_vector_component(value: float, resource: Resource, property_name: StringName, component: String) -> void:
	var next_value := resource.get(property_name) as Vector2
	if component == "X":
		next_value.x = value
	else:
		next_value.y = value
	_set_authoring_property(next_value, resource, property_name)


func _set_authoring_collection(text: String, resource: Resource, property_name: StringName, current_value: Variant) -> void:
	var tokens := text.split(",", false)
	if current_value is PackedFloat32Array:
		var values := PackedFloat32Array()
		for token: String in tokens:
			if token.strip_edges().is_valid_float():
				values.append(float(token.strip_edges()))
		_set_authoring_property(values, resource, property_name)
	elif current_value is PackedStringArray:
		var values := PackedStringArray()
		for token: String in tokens:
			if not token.strip_edges().is_empty():
				values.append(token.strip_edges())
		_set_authoring_property(values, resource, property_name)
	elif current_value is Array:
		var values: Array = []
		var wants_float: bool = not current_value.is_empty() and current_value[0] is float
		var wants_int: bool = not current_value.is_empty() and current_value[0] is int
		var wants_vector: bool = not current_value.is_empty() and current_value[0] is Vector2
		for token: String in tokens:
			var clean := token.strip_edges()
			if wants_vector:
				var coordinates := clean.split(":", false)
				if coordinates.size() == 2 and coordinates[0].is_valid_float() and coordinates[1].is_valid_float():
					values.append(Vector2(float(coordinates[0]), float(coordinates[1])))
			elif wants_int and clean.is_valid_int():
				values.append(int(clean))
			elif wants_float and clean.is_valid_float():
				values.append(float(clean))
			elif not clean.is_empty():
				values.append(clean)
		_set_authoring_property(values, resource, property_name)


func _save_authoring_resource() -> void:
	if _authoring_root_resource == null or _authoring_root_path.is_empty():
		_set_status("Không xác định được file gốc để lưu.", true)
		return
	var errors := _resource_validation_errors(_authoring_root_resource)
	if not errors.is_empty():
		_set_status("Chưa lưu: %s" % errors[0], true)
		return
	var save_error := ResourceSaver.save(_authoring_root_resource, _authoring_root_path)
	if save_error != OK:
		_set_status("Không lưu được nội dung: %s" % error_string(save_error), true)
		return
	_set_status("Đã lưu %s." % _authoring_root_path.get_file())


func _resource_validation_errors(resource: Resource) -> PackedStringArray:
	if resource.has_method(&"get_validation_errors"):
		return resource.call(&"get_validation_errors") as PackedStringArray
	if resource.has_method(&"validate"):
		return resource.call(&"validate") as PackedStringArray
	return PackedStringArray()


func _validate_design_controls() -> void:
	var errors := PackedStringArray()
	for path: String in [TUNING_PROFILE, VFX_LIBRARY]:
		var resource := load(path)
		if resource == null:
			errors.append("Không nạp được %s." % path)
		elif resource.has_method(&"get_validation_errors"):
			for error: String in resource.call(&"get_validation_errors") as PackedStringArray:
				errors.append("%s: %s" % [path.get_file(), error])
	if errors.is_empty():
		_set_status("Balance và thư viện VFX đều hợp lệ.")
		return
	for error: String in errors:
		push_error("Designer validation: %s" % error)
	_set_status("Có %d lỗi thiết kế. Xem Output để đọc chi tiết; lỗi đầu: %s" % [errors.size(), errors[0]], true)


func _run_vfx_tests() -> void:
	var output_lines: Array = []
	var exit_code := OS.execute("powershell", ["-ExecutionPolicy", "Bypass", "-File", ProjectSettings.globalize_path("res://tools/run_vfx_tests.ps1")], output_lines, true)
	_set_status("VFX test %s. Chi tiết ở Output/terminal." % ("đạt" if exit_code == 0 else "không đạt"), exit_code != 0)


func _collect_design_content_paths() -> PackedStringArray:
	var paths: Array[String] = [TUNING_PROFILE, VFX_LIBRARY]
	for directory: String in [
		"res://game/heroes/data",
		"res://game/weapons/data",
		"res://data/content",
	]:
		_collect_tres_paths(directory, paths)
	paths.sort()
	var unique := {}
	var result := PackedStringArray()
	for path: String in paths:
		if not unique.has(path):
			unique[path] = true
			result.append(path)
	return result


func _collect_tres_paths(directory: String, output: Array[String]) -> void:
	for file_name: String in DirAccess.get_files_at(directory):
		if file_name.ends_with(".tres"):
			output.append(directory.path_join(file_name))
	for child_directory: String in DirAccess.get_directories_at(directory):
		_collect_tres_paths(directory.path_join(child_directory), output)


func _content_label(path: String) -> String:
	return "%s / %s" % [path.get_base_dir().get_file(), path.get_file().get_basename()]


func _read_json_document(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"ok": false, "error": "File does not exist: %s" % path}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"ok": false, "error": "Cannot read: %s" % path}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		return {"ok": false, "error": "JSON must be an object: %s" % path}
	return {"ok": true, "document": parsed}


func _write_json_document(path: String, document: Dictionary) -> Dictionary:
	var target := ProjectSettings.globalize_path(path)
	var lock_path := target + ".write.lock"
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return {"ok": false, "error": "Another writer currently owns the balance lock."}
	var result := {"ok": false, "error": "Unknown balance write failure."}
	var temporary := "%s.tmp.%d" % [target, Time.get_ticks_usec()]
	var contents := JSON.stringify(document, "  ", false, true) + "\n"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		result = {"ok": false, "error": "Cannot create temporary balance file."}
	else:
		file.store_string(contents)
		file.flush()
		var write_error := file.get_error()
		file.close()
		if write_error != OK:
			DirAccess.remove_absolute(temporary)
			result = {"ok": false, "error": "Temporary balance write failed: %s" % error_string(write_error)}
		elif FileAccess.get_file_as_string(temporary).sha256_text() != contents.sha256_text():
			DirAccess.remove_absolute(temporary)
			result = {"ok": false, "error": "Temporary balance verification failed."}
		else:
			result = _replace_json_file(target, temporary, contents.sha256_text())
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Designer could not remove balance write lock: %s" % error_string(unlock_error))
	return result


func _replace_json_file(target: String, temporary: String, expected_signature: String) -> Dictionary:
	if OS.get_name() != "Windows":
		var rename_error := DirAccess.rename_absolute(temporary, target)
		if rename_error != OK:
			return {"ok": false, "error": error_string(rename_error)}
		return {
			"ok": FileAccess.get_file_as_string(target).sha256_text() == expected_signature,
			"error": "Promoted balance file failed verification.",
		}
	var backup := target + ".write.backup"
	var backup_error := DirAccess.rename_absolute(target, backup)
	if backup_error != OK:
		DirAccess.remove_absolute(temporary)
		return {"ok": false, "error": "Could not create balance backup: %s" % error_string(backup_error)}
	var promote_error := DirAccess.rename_absolute(temporary, target)
	if promote_error != OK:
		DirAccess.rename_absolute(backup, target)
		DirAccess.remove_absolute(temporary)
		return {"ok": false, "error": "Could not replace balance; old file was restored."}
	if FileAccess.get_file_as_string(target).sha256_text() != expected_signature:
		DirAccess.remove_absolute(target)
		DirAccess.rename_absolute(backup, target)
		return {"ok": false, "error": "Promoted balance file failed verification; old file was restored."}
	var cleanup_error := DirAccess.remove_absolute(backup)
	if cleanup_error != OK:
		push_warning("Balance applied but recovery backup remains: %s" % error_string(cleanup_error))
	return {"ok": true}


func _add_separator() -> void:
	_content.add_child(HSeparator.new())


func _add_heading(text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override(&"font_size", 14)
	label.modulate = Color(0.96, 0.76, 0.4)
	_content.add_child(label)


func _add_scene_button(label: String, path: String) -> void:
	var button := Button.new()
	button.text = label
	button.tooltip_text = path
	button.pressed.connect(_open_scene.bind(path))
	_content.add_child(button)


func _add_resource_button(label: String, path: String) -> void:
	var button := Button.new()
	button.text = label
	button.tooltip_text = path
	button.pressed.connect(_open_authoring_resource.bind(path))
	_content.add_child(button)


func _on_scene_changed(_scene_root: Node) -> void:
	call_deferred(&"_refresh_map_context")
	call_deferred(&"_pull_map_entities_if_empty")


func _refresh_map_context() -> void:
	var context := _get_map_context()
	var ready := bool(context.get("ok", false))
	if _map_path_label != null:
		_map_path_label.text = (
			"Level data: %s" % String(context.get("path", ""))
			if ready
			else String(context.get("error", "Mở một scene level để bắt đầu."))
		)
	for button: Button in [_map_pull_button, _map_push_button, _map_link_button]:
		if button != null:
			button.disabled = not ready
	if ready and _map_selector != null:
		var active_path := String(context.get("path", ""))
		for index: int in MAP_LAYOUTS.size():
			if String(MAP_LAYOUTS[index][1]) == active_path:
				_map_selector.select(index)
				break


func _pull_map_entities_if_empty() -> void:
	var context := _get_map_context()
	if not bool(context.get("ok", false)):
		return
	var container := context.get("container") as Node2D
	if container == null or _count_map_markers(container) > 0:
		return
	_pull_map_entities(false)


func _pull_map_entities(manual := true) -> void:
	var context := _get_map_context()
	if not bool(context.get("ok", false)):
		_set_status(String(context.get("error", "Không có level đang mở.")), true)
		return
	var result: Dictionary = MapSerializer.deserialize_level_file(
		context["container"],
		String(context["path"]),
		context["root"],
	)
	if not bool(result.get("ok", false)):
		_set_status("Không thể nạp element: %s" % result.get("error", "unknown error"), true)
		return
	get_editor_interface().mark_scene_as_unsaved()
	_set_status("Đã nạp %d element%s." % [
		int(result.get("count", 0)),
		" từ JSON" if manual else " tự động khi mở level",
	])


func _push_map_entities() -> void:
	var context := _get_map_context()
	if not bool(context.get("ok", false)):
		_set_status(String(context.get("error", "Không có level đang mở.")), true)
		return
	var result: Dictionary = MapSerializer.serialize_level_file(
		context["container"],
		String(context["path"]),
	)
	if not bool(result.get("ok", false)):
		_set_status("Không thể lưu element: %s" % result.get("error", "unknown error"), true)
		return
	var warning_count := (result.get("warnings", PackedStringArray()) as PackedStringArray).size()
	_set_status("Đã validate và lưu %d element%s." % [
		int(result.get("count", 0)),
		" (%d cảnh báo)" % warning_count if warning_count > 0 else "",
	])


func _add_map_element(entity_type: String) -> void:
	var context := _get_map_context()
	if not bool(context.get("ok", false)):
		_set_status(String(context.get("error", "Không có level đang mở.")), true)
		return
	var preset_path := String(MapSerializer.PRESET_PATHS.get(entity_type, ""))
	var preset := load(preset_path) as PackedScene
	var marker := preset.instantiate() as Node2D if preset != null else null
	if marker == null or marker.get_script() != MapMarkerScript:
		if marker != null:
			marker.free()
		_set_status("Preset không hợp lệ: %s" % preset_path, true)
		return
	var container := context["container"] as Node2D
	var root := context["root"] as Node
	var entity_id := _next_entity_id(container, entity_type)
	marker.name = entity_id.to_pascal_case()
	marker.set("entity_id", entity_id)
	marker.position = _editor_view_center_in(container)

	var history := get_undo_redo()
	history.create_action("Add map element: %s" % entity_type)
	history.add_do_method(container, &"add_child", marker)
	history.add_do_method(marker, &"set_owner", root)
	history.add_do_reference(marker)
	history.add_undo_method(container, &"remove_child", marker)
	history.commit_action()

	var selection := get_editor_interface().get_selection()
	selection.clear()
	selection.add_node(marker)
	_set_status("Đã thêm %s. Kéo marker tới vị trí mong muốn rồi bấm Lưu element." % entity_id)


func _link_selected_floor_doors() -> void:
	var selected: Array[Node] = get_editor_interface().get_selection().get_selected_nodes()
	var doors: Array[Node] = []
	for node: Node in selected:
		if node.get_script() == MapMarkerScript and String(node.get("entity_type")) == "floor_door":
			doors.append(node)
	if doors.size() != 2:
		_set_status("Hãy chọn đúng hai Floor Door marker trong Scene Tree.", true)
		return
	var first := doors[0]
	var second := doors[1]
	var first_previous := NodePath(first.get("door_target_marker"))
	var second_previous := NodePath(second.get("door_target_marker"))
	var history := get_undo_redo()
	history.create_action("Link two floor doors")
	history.add_do_property(first, &"door_target_marker", first.get_path_to(second))
	history.add_do_property(second, &"door_target_marker", second.get_path_to(first))
	history.add_undo_property(first, &"door_target_marker", first_previous)
	history.add_undo_property(second, &"door_target_marker", second_previous)
	history.commit_action()
	_set_status("Đã nối hai cửa tầng theo hai chiều.")


func _get_map_context() -> Dictionary:
	var root := get_editor_interface().get_edited_scene_root()
	if root == null:
		return {"ok": false, "error": "Mở một scene level để bắt đầu."}
	var levels: Array[Node] = []
	_collect_live_levels(root, levels)
	if levels.size() != 1:
		return {
			"ok": false,
			"error": "Scene cần đúng một node level; hiện có %d." % levels.size(),
		}
	var level := levels[0]
	var path := String(level.get(&"level_data_path")).strip_edges()
	var container := level.get_node_or_null("AuthoringEntities") as Node2D
	if path.is_empty() or container == null:
		return {"ok": false, "error": "Level thiếu level_data_path hoặc AuthoringEntities."}
	return {"ok": true, "root": root, "level": level, "container": container, "path": path}


func _collect_live_levels(node: Node, result: Array[Node]) -> void:
	if node.is_in_group(&"live_level") and _has_property(node, &"level_data_path"):
		result.append(node)
	for child: Node in node.get_children():
		_collect_live_levels(child, result)


func _has_property(object: Object, property_name: StringName) -> bool:
	for property: Dictionary in object.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return true
	return false


func _count_map_markers(container: Node) -> int:
	var count := 0
	for child: Node in container.get_children():
		if child.get_script() == MapMarkerScript:
			count += 1
		else:
			count += _count_map_markers(child)
	return count


func _next_entity_id(container: Node, entity_type: String) -> String:
	var used := {}
	_collect_entity_ids(container, used)
	if not used.has(entity_type):
		return entity_type
	var index := 2
	while used.has("%s_%02d" % [entity_type, index]):
		index += 1
	return "%s_%02d" % [entity_type, index]


func _collect_entity_ids(node: Node, output: Dictionary) -> void:
	for child: Node in node.get_children():
		if child.get_script() == MapMarkerScript:
			output[String(child.call(&"get_effective_entity_id"))] = true
		else:
			_collect_entity_ids(child, output)


func _editor_view_center_in(container: Node2D) -> Vector2:
	var viewport := get_editor_interface().get_editor_viewport_2d()
	if viewport == null or not container.is_inside_tree():
		return Vector2.ZERO
	var viewport_center := Vector2(viewport.get_visible_rect().size) * 0.5
	var world_position := viewport.global_canvas_transform.affine_inverse() * viewport_center
	return container.to_local(world_position)


func _open_scene(path: String) -> void:
	if not FileAccess.file_exists(path):
		_set_status("Chưa tìm thấy scene: %s" % path, true)
		return
	get_editor_interface().open_scene_from_path(path)
	_set_status("Đã mở %s" % path.get_file())


func _edit_resource(path: String) -> void:
	var resource := load(path)
	if resource == null:
		_set_status("Không thể mở asset: %s" % path, true)
		return
	get_editor_interface().edit_resource(resource)
	_set_status("Đang chỉnh %s trong Inspector." % path.get_file())


func _set_status(message: String, is_error := false) -> void:
	if _status == null:
		return
	_status.text = message
	_status.modulate = Color(1.0, 0.55, 0.5) if is_error else Color(0.58, 0.9, 0.68)
