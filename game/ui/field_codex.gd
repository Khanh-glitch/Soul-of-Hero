class_name FieldCodex
extends Control

signal closed()

const EntryScene: PackedScene = preload("res://game/ui/field_codex_entry.tscn")
const ItemTileScene: PackedScene = preload("res://game/ui/field_codex_item_tile.tscn")
const EquipmentSlotScene: PackedScene = preload("res://game/ui/field_codex_equipment_slot.tscn")
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const HERO_SKILL_KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const HERO_SOUL_MANAGER := preload("res://game/heroes/hero_soul_manager.gd")
const PLAYER_PROGRESSION_RULES := preload("res://game/meta/progression/player_progression_rules.gd")
const AUXILIARY_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const ARCHER_SOUL_ASSETS := preload("res://game/loot/archer_soul_asset_catalog.gd")
const LOOT_CATALOG := preload("res://game/loot/loot_catalog.gd")
const STACK_ITEM_CATALOG: StackItemCatalog = preload("res://data/content/items/item_catalog.tres")

const ICON_BAG := preload("res://assets/library/downloaded/rpg_arsenal_1_1/Icons_background/consumables/rpg_icons_129.png")
const ICON_HP := preload("res://assets/library/downloaded/complete_ui_book_styles_free/01_TravelBookLite/Sprites/UI_TravelBook_IconHeart01e.png")
const ICON_DAMAGE := preload("res://assets/library/downloaded/rpg_arsenal_1_1/Icons_background/axes/rpg_icons_100.png")
const ICON_MANA := preload("res://assets/library/downloaded/complete_ui_book_styles_free/01_TravelBookLite/Sprites/UI_TravelBook_IconEnergy01d.png")
const ICON_SKILL := preload("res://assets/library/downloaded/complete_ui_book_styles_free/01_TravelBookLite/Sprites/UI_TravelBook_IconStar01c.png")
const ICON_SOUL_SWORD := preload("res://assets/ui/loot/hero_soul_sword.png")
const ICON_SOUL_AXE := preload("res://assets/ui/loot/hero_soul_axe.png")
const ICON_VESSEL := preload("res://assets/library/downloaded/rpg_icons_400/Icon152.png")
const ICON_BOOTS := preload("res://assets/library/downloaded/rpg_icons_400/Icon221.png")
const ICON_TRACE := preload("res://assets/library/downloaded/rpg_icons_400/Icon241.png")
const ICON_WIZARD_SOUL := preload("res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons79.png")
const ICON_EMBER := preload("res://assets/ui/loot/soul_ember.png")

const SECTION_EQUIPMENT := &"equipment"
const SECTION_UPGRADES := &"upgrades"
const INVENTORY_SLOT_CAPACITY := 30
const INVENTORY_COLUMNS := 6

const HERO_DEFINITIONS := {
	"sword_hero": preload("res://game/heroes/data/sword_hero.tres"),
	"archer_hero": preload("res://game/heroes/data/archer_hero.tres"),
	"axe_hero": preload("res://game/heroes/data/axe_hero.tres"),
	"wizard_hero": preload("res://game/heroes/data/wizard_hero.tres"),
}

const STAT_NAMES := {&"hp": "HP", &"damage": "POWER", &"mana": "MANA"}
const STAT_ICONS := {&"hp": ICON_HP, &"damage": ICON_DAMAGE, &"mana": ICON_MANA}
const SKILL_NAMES := {
	&"normal_attack": "Đòn đánh thường",
	&"active_skill": "Kỹ năng chủ động",
	&"dash": "Lướt",
	&"soul_ready_condition": "Tích Soul",
	&"summon_skill": "Triệu hồi",
	&"departure_skill": "Rời trận",
}
const AUXILIARY_ICONS := {
	"soul_vessel": ICON_VESSEL,
	"soul_boots": ICON_BOOTS,
	"soul_trace": ICON_TRACE,
}
const STAT_DISPLAY_NAMES := {
	"max_hp": "Sinh lực",
	"max_hp_flat": "Sinh lực",
	"max_hp_percent": "Sinh lực",
	"core_damage": "Power",
	"damage_flat": "Power",
	"damage_percent": "Power",
	"max_mana": "Mana",
	"max_mana_flat": "Mana",
	"mana_percent": "Mana",
	"defense": "Sức mạnh đòn đánh thường",
	"normal_attack_power": "Sức mạnh đòn đánh thường",
	"movement": "Tốc độ di chuyển",
	"movement_speed": "Tốc độ di chuyển",
	"movement_speed_percent": "Tốc độ di chuyển",
	"dash_cooldown_rate": "Hồi Lướt",
	"dash_speed_percent": "Tốc độ Lướt",
	"footwork_damage_reduction": "Né tránh",
	"dodge_chance_percent": "Né tránh",
	"boots_power_percent": "Power từ Giày",
	"max_hp_from_boots_percent": "HP từ Giày",
	"guard_while_attacking": "Power từ Giáp",
	"damage_reduction": "Giáp ảo",
	"barrier_capacity_percent": "Giáp ảo",
	"armor_power_percent": "Power từ Giáp",
	"health_regen": "Hồi máu",
	"healing_received": "Hồi phục nhận vào",
	"critical_chance": "Tỉ lệ chí mạng",
	"critical_damage": "Sát thương chí mạng",
	"attack_speed": "Tốc đánh",
	"crit_chance": "Tỉ lệ chí mạng",
	"crit_damage": "Sát thương chí mạng",
	"cooldown_recovery": "Hồi chiêu",
	"dodge": "Né tránh hiển thị",
	"melee_damage": "Sát thương cận chiến",
	"defense_while_attacking": "Sức mạnh chuỗi đánh",
	"combo_power": "Sức mạnh chuỗi đánh",
	"stagger_resist": "Sức mạnh đòn nặng",
	"heavy_hit_power": "Sức mạnh đòn nặng",
	"stagger_resistance": "Giáp ảo",
	"low_hp_defense": "Sức mạnh đòn kết liễu",
	"execute_power": "Sức mạnh đòn kết liễu",
	"melee_threat_shield": "Giáp ảo",
	"barrier_capacity": "Giáp ảo",
	"relay_shield": "Giáp ảo khi Chuyển Hồn",
	"relay_barrier": "Giáp ảo khi Chuyển Hồn",
	"close_range_damage": "Sát thương tầm gần",
	"projectile_damage": "Sát thương đạn",
	"projectile_speed": "Tốc độ đạn",
	"dash_cooldown": "Hồi Lướt",
	"post_dash_damage": "Sát thương sau Lướt",
	"move_attack_penalty_reduction": "Giảm phạt khi vừa đi vừa đánh",
	"execute_damage": "Sát thương kết liễu",
	"active_skill_power": "Sức mạnh kỹ năng",
	"active_mana_cost": "Tiết kiệm mana kỹ năng",
	"active_cooldown": "Hồi kỹ năng chủ động",
	"summon_cooldown": "Hồi Triệu hồi",
	"effect_duration": "Thời lượng hiệu ứng",
	"area_size": "Phạm vi kỹ năng",
	"active_power": "Sức mạnh chủ động",
	"summon_power": "Sức mạnh Triệu hồi",
	"departure_power": "Sức mạnh Rời trận",
	"ready_window_seconds": "Cửa sổ sẵn sàng",
	"relay_arrival_speed": "Tốc độ Relay",
	"departure_distance_damage": "Sát thương theo khoảng cách",
	"relay_mana_restore": "Mana hồi từ Relay",
	"no_relay_refund": "Hoàn Mana khi không Chuyển Hồn",
	"summon_multi_hit_cooldown": "Hồi triệu hồi đa đòn",
	"boss_damage": "Sát thương Boss",
	"armor_penetration": "Power",
	"mana_regen": "Hồi mana",
	"cooldown_rate": "Hồi chiêu",
	"mana_efficiency": "Tiết kiệm mana",
	"skill_duration": "Thời lượng kỹ năng",
	"relay_ready_duration": "Cửa sổ Relay",
}
const HERO_NAMES := {
	"sword_hero": "Kiếm Sĩ",
	"archer_hero": "Cung Thủ",
	"axe_hero": "Chiến Binh Rìu",
	"wizard_hero": "Pháp Sư",
	# Read-only compatibility for a save which predates schema v3 migration.
	"mage_hero": "Pháp Sư",
}
const HERO_SOUL_ITEM_NAMES := {
	"sword_hero": "Kiếm Linh Hồn",
	"archer_hero": "Cung Linh Hồn",
	"axe_hero": "Rìu Linh Hồn",
	"wizard_hero": "Quyền Trượng Linh Hồn",
	"mage_hero": "Quyền Trượng Linh Hồn",
}
const SECONDARY_STAT_DEFINITIONS := [
	{
		"id": "barrier_capacity_percent",
		"label": "GIÁP ẢO",
		"unit": "percent",
		"tooltip": "Thanh HP phụ nhìn thấy được. Sát thương trừ thẳng vào Giáp ảo trước HP.",
	},
	{
		"id": "dodge_chance_percent",
		"label": "NÉ",
		"unit": "percent",
		"tooltip": "Khi kích hoạt sẽ hiện NÉ và không trừ HP; không dùng công thức giảm damage ẩn.",
	},
	{
		"id": "movement_speed_percent",
		"label": "TỐC CHẠY",
		"unit": "percent",
		"tooltip": "Tốc độ di chuyển cộng thêm đang áp dụng cho Hero hiện tại.",
	},
	{
		"id": "health_regen_per_second",
		"label": "HP/S",
		"unit": "flat",
		"tooltip": "HP thực hồi mỗi giây sau Max HP và hiệu quả hồi phục.",
	},
	{
		"id": "dash_cooldown_recovery_percent",
		"label": "HỒI LƯỚT",
		"unit": "percent",
		"tooltip": "Phần trăm rút ngắn thời gian hồi Lướt.",
	},
	{
		"id": "healing_received_percent",
		"label": "HỒI NHẬN",
		"unit": "percent",
		"tooltip": "Mọi nguồn hồi HP nhận vào được tăng theo tỉ lệ này.",
	},
	{
		"id": "dash_speed_percent",
		"label": "TỐC LƯỚT",
		"unit": "percent",
		"tooltip": "Tốc độ Lướt cộng thêm; không thay đổi tốc chạy thường.",
	},
	{
		"id": "cooldown_recovery_percent",
		"label": "HỒI CHIÊU",
		"unit": "percent",
		"tooltip": "Phần trăm rút ngắn cooldown kỹ năng chủ động.",
	},
	{
		"id": "mana_regen_per_second",
		"label": "MANA/S",
		"unit": "flat",
		"tooltip": "Mana thực hồi mỗi giây, gồm hồi cơ bản và trang bị.",
	},
	{
		"id": "active_skill_damage_percent",
		"label": "KỸ NĂNG",
		"unit": "percent",
		"tooltip": "Sát thương cộng thêm cho kỹ năng chủ động từ progression live.",
	},
	{
		"id": "mana_cost_reduction_percent",
		"label": "TIẾT KIỆM",
		"unit": "percent",
		"tooltip": "Phần trăm giảm Mana tiêu hao của kỹ năng chủ động.",
	},
]

@onready var book: Control = %Book
@onready var brand: Label = %Brand
@onready var previous_equipment_hero: Button = %PreviousEquipmentHero
@onready var next_equipment_hero: Button = %NextEquipmentHero
@onready var page_title: Label = %PageTitle
@onready var summary_label: Label = %SummaryLabel
@onready var scroll: ScrollContainer = %Scroll
@onready var entry_list: GridContainer = %EntryList
@onready var detail_area: Control = %DetailArea
@onready var detail_title: Label = %DetailTitle
@onready var detail_text: RichTextLabel = %DetailText
@onready var equip_action: Button = %EquipAction
@onready var upgrade_action: Button = %UpgradeAction
@onready var back_action: Button = %BackAction
@onready var status_label: Label = %StatusLabel
@onready var close_button: Button = %CloseButton
@onready var equipment_button: Button = %EquipmentSection
@onready var upgrade_button: Button = %UpgradeSection
@onready var equipment_slot_area: Control = %EquipmentSlotArea
@onready var equipment_slot_grid: GridContainer = %EquipmentSlotGrid
@onready var character_stats_title: Label = %CharacterStatsTitle
@onready var character_stats: Label = %CharacterStats
@onready var stats_strip: HBoxContainer = %StatsStrip
@onready var stat_hp_value: Label = %StatHpValue
@onready var stat_mana_value: Label = %StatManaValue
@onready var stat_power_value: Label = %StatPowerValue
@onready var stat_weapon_value: Label = %StatWeaponValue
@onready var stat_hp_delta: Label = %StatHpDelta
@onready var stat_mana_delta: Label = %StatManaDelta
@onready var stat_power_delta: Label = %StatPowerDelta
@onready var stat_weapon_delta: Label = %StatWeaponDelta
@onready var secondary_stats_grid: GridContainer = %SecondaryStatsGrid
@onready var upgrade_intro: Control = %UpgradeIntro
@onready var upgrade_point_summary: Label = %UpgradePointSummary
@onready var live_text: Label = %LiveText
@onready var hint: Label = %Hint
@onready var book_open_sfx: AudioStreamPlayer = %BookOpenSfx
@onready var book_close_sfx: AudioStreamPlayer = %BookCloseSfx
@onready var page_sfx: AudioStreamPlayer = %PageSfx

var _save: Node
var _player: Node
var _section := SECTION_EQUIPMENT
var _transaction_serial := 0
var _selected_payload: Dictionary = {}
var _selected_key := ""
var _selected_equipment_hero_id := ""
var _entry_nodes: Array[FieldCodexEntry] = []
var _slot_nodes: Dictionary = {}
var _inventory_used_count := 0
var _secondary_stat_value_labels: Dictionary = {}
var _secondary_stat_delta_labels: Dictionary = {}
var _pending_external_drop: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# The book intentionally leaves combat time running, but while it is visible
	# its inputs must not drive the Hero underneath it.
	add_to_group(&"gameplay_modal")
	_save = get_node_or_null("/root/SaveService")
	_build_secondary_stat_rows()
	close_button.pressed.connect(hide_codex)
	equipment_button.pressed.connect(_select_section.bind(SECTION_EQUIPMENT))
	upgrade_button.pressed.connect(_select_section.bind(SECTION_UPGRADES))
	equip_action.pressed.connect(_equip_selected)
	upgrade_action.pressed.connect(_upgrade_selected_auxiliary)
	back_action.pressed.connect(_return_to_inventory_grid)
	previous_equipment_hero.pressed.connect(_cycle_equipment_hero.bind(-1))
	next_equipment_hero.pressed.connect(_cycle_equipment_hero.bind(1))
	if _save != null and _save.has_signal(&"save_committed"):
		_save.connect(&"save_committed", _on_save_committed)
	hide()


func _exit_tree() -> void:
	if is_instance_valid(_save) and _save.is_connected(&"save_committed", _on_save_committed):
		_save.disconnect(&"save_committed", _on_save_committed)


func _input(event: InputEvent) -> void:
	if not visible or event.is_echo():
		return
	if event.is_action_pressed(&"field_codex") or event.is_action_pressed(&"pause"):
		hide_codex()
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_DRAG_BEGIN:
		_pending_external_drop.clear()
		if not visible or _section != SECTION_EQUIPMENT:
			return
		var data: Variant = get_viewport().gui_get_drag_data()
		if data is Dictionary and _is_droppable_inventory_payload(data as Dictionary):
			_pending_external_drop = (data as Dictionary).duplicate(true)
		return
	if what != NOTIFICATION_DRAG_END or _pending_external_drop.is_empty():
		return
	var payload := _pending_external_drop.duplicate(true)
	_pending_external_drop.clear()
	# A successful internal drop is handled by equipment slots. An unsuccessful
	# release only becomes a discard when it lands outside the book itself.
	if not visible or get_viewport().gui_is_drag_successful() \
			or book.get_global_rect().has_point(get_global_mouse_position()):
		return
	_drop_inventory_payload(payload)


func set_player(player: Node) -> void:
	_player = player


func is_open() -> bool:
	return visible


func toggle() -> void:
	if visible:
		hide_codex()
	else:
		show_codex()


func show_codex(section_id: StringName = SECTION_EQUIPMENT) -> void:
	_section = _normalize_section(section_id)
	show()
	book.modulate = Color(1, 1, 1, 0)
	book.scale = Vector2.ONE * 0.92
	book.pivot_offset = book.size * 0.5
	_refresh()
	book_open_sfx.play()
	var tween := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	tween.tween_property(book, "modulate:a", 1.0, 0.12)
	tween.parallel().tween_property(book, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func hide_codex() -> void:
	if not visible:
		return
	book_close_sfx.play()
	_pending_external_drop.clear()
	hide()
	closed.emit()


func _normalize_section(section_id: StringName) -> StringName:
	if section_id in [&"stats", &"skills", SECTION_UPGRADES]:
		return SECTION_UPGRADES
	return SECTION_EQUIPMENT


func _select_section(section_id: StringName) -> void:
	var normalized := _normalize_section(section_id)
	if normalized == _section:
		return
	_section = normalized
	_selected_payload.clear()
	_selected_key = ""
	page_sfx.play()
	_refresh()


func _refresh() -> void:
	_clear_container(entry_list)
	_clear_container(equipment_slot_grid)
	_entry_nodes.clear()
	_slot_nodes.clear()
	equipment_button.button_pressed = _section == SECTION_EQUIPMENT
	upgrade_button.button_pressed = _section == SECTION_UPGRADES
	equipment_slot_area.visible = _section == SECTION_EQUIPMENT
	upgrade_intro.visible = _section == SECTION_UPGRADES
	# Point counters and action state already communicate immediacy. Keeping the
	# old instructional footer duplicated information on every open.
	live_text.hide()
	hint.hide()
	detail_area.hide()
	scroll.show()
	entry_list.columns = INVENTORY_COLUMNS if _section == SECTION_EQUIPMENT else 1
	scroll.offset_bottom = 307.0 if _section == SECTION_EQUIPMENT else 304.0
	scroll.vertical_scroll_mode = (
		ScrollContainer.SCROLL_MODE_DISABLED
		if _section == SECTION_EQUIPMENT
		else ScrollContainer.SCROLL_MODE_AUTO
	)
	if _save == null or not _save.has_method(&"get_snapshot"):
		page_title.text = "DỮ LIỆU CHƯA SẴN SÀNG"
		summary_label.text = "Đóng sổ và thử lại."
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	_ensure_equipment_hero_selection(snapshot)
	_render_brand(snapshot)
	_render_upgrade_badge()
	if _section == SECTION_EQUIPMENT:
		_render_equipment(snapshot)
	else:
		_render_upgrades(snapshot)


func _render_brand(snapshot: Dictionary) -> void:
	var level := _selected_hero_level(snapshot)
	brand.text = "%s • LV %d" % [
		_hero_name(_selected_equipment_hero_id).to_upper(),
		level,
	]
	var heroes := _equipment_hero_ids(snapshot)
	var can_cycle := heroes.size() > 1 and _section == SECTION_EQUIPMENT
	previous_equipment_hero.visible = _section == SECTION_EQUIPMENT
	next_equipment_hero.visible = _section == SECTION_EQUIPMENT
	previous_equipment_hero.disabled = not can_cycle
	next_equipment_hero.disabled = not can_cycle
	brand.tooltip_text = "Đang xem 4 ô trang bị riêng của %s%s" % [
		_hero_name(_selected_equipment_hero_id),
		" • dùng mũi tên để đổi Hero" if can_cycle else "",
	]


func _equipment_hero_ids(snapshot: Dictionary) -> Array[String]:
	var team: Dictionary = snapshot.get("soul_team", {}) \
		if snapshot.get("soul_team", {}) is Dictionary else {}
	var result: Array[String] = []
	var active := String(team.get("active_hero", "sword_hero"))
	if not active.is_empty():
		result.append(active)
	var reserves: Array = team.get("reserve_souls", []) \
		if team.get("reserve_souls", []) is Array else []
	for raw_hero_id: Variant in reserves:
		var hero_id := String(raw_hero_id)
		if not hero_id.is_empty() and hero_id not in result:
			result.append(hero_id)
	return result


func _ensure_equipment_hero_selection(snapshot: Dictionary) -> void:
	var heroes := _equipment_hero_ids(snapshot)
	if heroes.is_empty():
		_selected_equipment_hero_id = "sword_hero"
	elif _selected_equipment_hero_id not in heroes:
		_selected_equipment_hero_id = heroes[0]


func _cycle_equipment_hero(direction: int) -> void:
	if _save == null or not _save.has_method(&"get_snapshot"):
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var heroes := _equipment_hero_ids(snapshot)
	if heroes.size() < 2:
		return
	var index := heroes.find(_selected_equipment_hero_id)
	_selected_equipment_hero_id = heroes[posmod(index + direction, heroes.size())]
	_selected_payload.clear()
	_selected_key = ""
	page_sfx.play()
	_refresh()


func _selected_hero_level(snapshot: Dictionary) -> int:
	var progression: Dictionary = snapshot.get("progression", {}) \
		if snapshot.get("progression", {}) is Dictionary else {}
	var heroes: Dictionary = progression.get("heroes", {}) \
		if progression.get("heroes", {}) is Dictionary else {}
	var record: Dictionary = heroes.get(_selected_equipment_hero_id, {}) \
		if heroes.get(_selected_equipment_hero_id, {}) is Dictionary else {}
	return clampi(
		int(record.get("level", 1)),
		1,
		PLAYER_PROGRESSION_RULES.PLAYER_LEVEL_CAP,
	)


func _render_upgrade_badge() -> void:
	var progression := _progression_snapshot()
	var stats: Dictionary = progression.get("stats", {}) if progression.get("stats", {}) is Dictionary else {}
	var skills: Dictionary = progression.get("skills", {}) if progression.get("skills", {}) is Dictionary else {}
	var stat_points := maxi(0, int(stats.get("unspent_points", 0)))
	var skill_points := maxi(0, int(skills.get("unspent_points", 0)))
	var total := stat_points + skill_points
	upgrade_button.text = "NÂNG CẤP  %d" % total if total > 0 else "NÂNG CẤP"
	upgrade_button.tooltip_text = "%d điểm chỉ số • %d điểm kỹ năng" % [stat_points, skill_points]


func _render_equipment(snapshot: Dictionary) -> void:
	page_title.text = "KHO 0/%d" % INVENTORY_SLOT_CAPACITY
	_render_equipment_slots(snapshot)
	_render_character_stats(snapshot)
	var inventory_value: Variant = snapshot.get("inventory", {})
	var inventory: Dictionary = inventory_value if inventory_value is Dictionary else {}
	var souls_value: Variant = inventory.get("hero_souls", [])
	var souls: Array = souls_value if souls_value is Array else []
	var equipment_value: Variant = inventory.get("auxiliary_equipment", [])
	var equipment: Array = equipment_value if equipment_value is Array else []
	var stacks_value: Variant = inventory.get("item_stacks", {})
	var stacks: Dictionary = stacks_value if stacks_value is Dictionary else {}
	# Hero Weapon, universal gear and each material stack all occupy one visible
	# inventory cell. The Book owns a fixed 6x5 surface so the complete intended
	# 30-slot capacity is inspectable without vertical scrolling.
	var payloads: Array[Dictionary] = []
	for raw_soul: Variant in souls:
		if raw_soul is Dictionary:
			payloads.append(_hero_soul_payload(raw_soul as Dictionary, snapshot))
	for raw_item: Variant in equipment:
		if raw_item is Dictionary:
			payloads.append(_auxiliary_payload(raw_item as Dictionary, snapshot))
	for raw_item_id: Variant in stacks.keys():
		var stack_value: Variant = stacks[raw_item_id]
		if stack_value is Dictionary:
			payloads.append(_stack_payload(String(raw_item_id), stack_value as Dictionary))
	payloads.sort_custom(_inventory_payload_precedes)
	var visible_count := mini(payloads.size(), INVENTORY_SLOT_CAPACITY)
	_inventory_used_count = visible_count
	for index: int in visible_count:
		_add_inventory_payload(payloads[index])
	for _index: int in range(visible_count, INVENTORY_SLOT_CAPACITY):
		_add_empty_inventory_slot()
	var overflow := maxi(0, payloads.size() - INVENTORY_SLOT_CAPACITY)
	page_title.text = "KHO %d/%d%s" % [
		visible_count,
		INVENTORY_SLOT_CAPACITY,
		" +%d" % overflow if overflow > 0 else "",
	]
	summary_label.text = ""
	if overflow > 0:
		status_label.text = "Kho đã đầy; %d món cũ được giữ an toàn nhưng chưa hiện trong 30 ô." % overflow
		status_label.add_theme_color_override(&"font_color", Color("a16a24"))

	if visible_count == 0:
		detail_title.text = "CHƯA CÓ VẬT PHẨM"
		detail_text.text = "Đồ nhặt được sẽ vào đây ngay, không cần chờ hết ải."
		equip_action.hide()
	elif not _restore_selection():
		_show_inventory_grid()


func _inventory_payload_precedes(left: Dictionary, right: Dictionary) -> bool:
	var left_equipped := bool(left.get("equipped", false))
	var right_equipped := bool(right.get("equipped", false))
	if left_equipped != right_equipped:
		return left_equipped
	var left_rarity := RarityPalette.index(left.get("rarity", &"normal"))
	var right_rarity := RarityPalette.index(right.get("rarity", &"normal"))
	if left_rarity != right_rarity:
		return left_rarity > right_rarity
	return String(left.get("title", "")).naturalnocasecmp_to(
		String(right.get("title", ""))
	) < 0


func _add_empty_inventory_slot() -> void:
	_add_entry("", "", &"normal", null, "", Callable(), true)


func _build_secondary_stat_rows() -> void:
	_secondary_stat_value_labels.clear()
	_secondary_stat_delta_labels.clear()
	for child: Node in secondary_stats_grid.get_children():
		child.queue_free()
	for definition: Dictionary in SECONDARY_STAT_DEFINITIONS:
		var stat_id := String(definition.get("id", ""))
		var row := HBoxContainer.new()
		row.name = "Secondary_%s" % stat_id
		row.custom_minimum_size = Vector2(108.0, 12.0)
		row.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_theme_constant_override(&"separation", 1)
		row.tooltip_text = String(definition.get("tooltip", ""))
		row.set_meta(&"stat_id", stat_id)

		var name_label := Label.new()
		name_label.name = "Name"
		name_label.custom_minimum_size = Vector2(52.0, 0.0)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		name_label.text = String(definition.get("label", stat_id.to_upper()))
		name_label.add_theme_color_override(&"font_color", Color("76503a"))
		name_label.add_theme_font_size_override(&"font_size", 8)

		var value_label := Label.new()
		value_label.name = "Value"
		value_label.custom_minimum_size = Vector2(25.0, 0.0)
		value_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		value_label.text = "0"
		value_label.add_theme_color_override(&"font_color", Color("80664f"))
		value_label.add_theme_font_size_override(&"font_size", 8)

		var delta_label := Label.new()
		delta_label.name = "Delta"
		delta_label.custom_minimum_size = Vector2(28.0, 0.0)
		delta_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		delta_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		delta_label.add_theme_font_size_override(&"font_size", 7)
		delta_label.hide()

		row.add_child(name_label)
		row.add_child(value_label)
		row.add_child(delta_label)
		secondary_stats_grid.add_child(row)
		_secondary_stat_value_labels[stat_id] = value_label
		_secondary_stat_delta_labels[stat_id] = delta_label


func _render_secondary_stats(projection: Dictionary) -> void:
	var profile_value: Variant = projection.get("secondary_stats", {})
	var profile := profile_value as Dictionary if profile_value is Dictionary else {}
	for definition: Dictionary in SECONDARY_STAT_DEFINITIONS:
		var stat_id := String(definition.get("id", ""))
		var value_label := _secondary_stat_value_labels.get(stat_id) as Label
		if value_label == null:
			continue
		var value := maxf(0.0, float(profile.get(stat_id, 0.0)))
		value_label.text = _format_secondary_stat_value(value, definition)
		value_label.add_theme_color_override(
			&"font_color",
			Color("452219") if value > 0.0001 else Color("9a8068"),
		)


func _format_secondary_stat_value(value: float, definition: Dictionary) -> String:
	var suffix := "%" if String(definition.get("unit", "flat")) == "percent" else ""
	return "%s%s" % [_format_number(value), suffix]


func _secondary_stat_profile(projection: Dictionary) -> Dictionary:
	var value: Variant = projection.get("secondary_stats", {})
	return value as Dictionary if value is Dictionary else {}


func _render_character_stats(snapshot: Dictionary) -> void:
	var progression_value: Variant = snapshot.get("progression", {})
	var progression := progression_value as Dictionary if progression_value is Dictionary else {}
	var hero_records: Dictionary = progression.get("heroes", {}) \
		if progression.get("heroes", {}) is Dictionary else {}
	var hero_record: Dictionary = hero_records.get(_selected_equipment_hero_id, {}) \
		if hero_records.get(_selected_equipment_hero_id, {}) is Dictionary else {}
	var level := _selected_hero_level(snapshot)
	var allocation_value: Variant = hero_record.get("stat_allocation", {})
	var allocation := allocation_value as Dictionary if allocation_value is Dictionary else {}
	var spent := 0
	for stat_id: StringName in PLAYER_PROGRESSION_RULES.STAT_IDS:
		spent += maxi(0, int(allocation.get(String(stat_id), 0)))
	var remaining := maxi(0, PLAYER_PROGRESSION_RULES.earned_stat_points(level) - spent)
	var hero_id := _selected_equipment_hero_id
	var projection := _selected_hero_projection(snapshot)
	_clear_character_stat_preview()
	if projection.is_empty():
		character_stats.text = "CHỈ SỐ NHÂN VẬT CHƯA SẴN SÀNG"
		stat_hp_value.text = "—"
		stat_mana_value.text = "—"
		stat_power_value.text = "—"
		stat_weapon_value.text = "—"
		_render_secondary_stats({})
		return
	var hp_text := _format_number(float(projection.get("hp", 0.0)))
	var mana_text := _format_number(float(projection.get("mana", 0.0)))
	var power_text := _format_number(float(projection.get("character_damage", 0.0)))
	var damage_text := _format_number(float(projection.get("damage", 0.0)))
	stat_hp_value.text = hp_text
	stat_mana_value.text = mana_text
	stat_power_value.text = power_text
	stat_weapon_value.text = damage_text
	_render_secondary_stats(projection)
	# This hidden semantic copy remains available to tests/accessibility while
	# the visible strip uses four large, glanceable values without point-count
	# annotations competing with the numbers.
	character_stats.text = "HP %s\nMANA %s\nPOWER %s\nVŨ KHÍ %s" % [
		hp_text,
		mana_text,
		power_text,
		damage_text,
	]
	stats_strip.tooltip_text = "%s • Cấp %d\n%d điểm chỉ số chưa cộng" % [
		_hero_name(hero_id),
		level,
		remaining,
	]


func _selected_hero_projection(snapshot: Dictionary) -> Dictionary:
	var hero := HERO_DEFINITIONS.get(_selected_equipment_hero_id, null) as HeroDefinition
	return (
		HERO_SOUL_MANAGER.project_hero_combat(snapshot, hero)
		if hero != null else {}
	)


func _render_character_stat_preview(payload: Dictionary) -> void:
	_clear_character_stat_preview()
	if _save == null or not _save.has_method(&"get_snapshot"):
		return
	# Hero Weapons are individual rolls. Preview their exact instance through the
	# same HeroSoulManager projection used in combat, rather than leaving the
	# four headline stats pinned to the previously selected copy.
	if StringName(payload.get("kind", &"")) == &"hero_soul":
		var candidate: Dictionary = payload.get("item", {}) if payload.get("item", {}) is Dictionary else {}
		var candidate_id := String(candidate.get("instance_id", ""))
		var candidate_hero := String(candidate.get("hero_id", ""))
		if candidate_id.is_empty() or candidate_hero.is_empty():
			return
		var snapshot: Dictionary = _save.call(&"get_snapshot")
		var team: Dictionary = snapshot.get("soul_team", {})
		if candidate_hero != _selected_equipment_hero_id:
			return
		var preview_snapshot := snapshot.duplicate(true)
		var preview_team: Dictionary = team.duplicate(true)
		var raw_selections: Variant = preview_team.get("selected_soul_instances", {})
		var selections: Dictionary = raw_selections.duplicate(true) if raw_selections is Dictionary else {}
		selections[candidate_hero] = candidate_id
		preview_team["selected_soul_instances"] = selections
		preview_snapshot["soul_team"] = preview_team
		_render_projection_delta(_selected_hero_projection(snapshot), _selected_hero_projection(preview_snapshot))
		stats_strip.tooltip_text = "So sánh Hero Weapon này với instance đang dùng"
		return
	if StringName(payload.get("kind", &"")) != &"auxiliary_equipment" \
			or bool(payload.get("equipped", false)):
		return
	var item_value: Variant = payload.get("item", {})
	if not item_value is Dictionary:
		return
	var item := item_value as Dictionary
	var slot_id := String(item.get("slot", ""))
	var uuid := String(item.get("uuid", ""))
	if slot_id.is_empty() or uuid.is_empty():
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var baseline := _selected_hero_projection(snapshot)
	var preview_snapshot := snapshot.duplicate(true)
	var hero_slot := _hero_loadout_slot(slot_id)
	if hero_slot.is_empty():
		return
	var loadouts_value: Variant = preview_snapshot.get("hero_loadouts", {})
	var preview_loadouts := (loadouts_value as Dictionary).duplicate(true) \
		if loadouts_value is Dictionary else {}
	var preview_loadout: Dictionary = preview_loadouts.get(
		_selected_equipment_hero_id,
		{"hero_weapon": "", "armor": "", "boots": "", "jewelry": ""},
	).duplicate(true)
	if String(preview_loadout.get(hero_slot, "")) == uuid:
		return
	preview_loadout[hero_slot] = uuid
	preview_loadouts[_selected_equipment_hero_id] = preview_loadout
	preview_snapshot["hero_loadouts"] = preview_loadouts
	var preview := _selected_hero_projection(preview_snapshot)
	_render_projection_delta(baseline, preview)
	stats_strip.tooltip_text = "So sánh với trang bị đang dùng"


func _render_projection_delta(baseline: Dictionary, preview: Dictionary) -> void:
	if baseline.is_empty() or preview.is_empty():
		return
	_set_character_stat_delta(stat_hp_delta, float(preview.get("hp", 0.0)) - float(baseline.get("hp", 0.0)))
	_set_character_stat_delta(stat_mana_delta, float(preview.get("mana", 0.0)) - float(baseline.get("mana", 0.0)))
	_set_character_stat_delta(
		stat_power_delta,
		float(preview.get("character_damage", 0.0)) - float(baseline.get("character_damage", 0.0)),
	)
	_set_character_stat_delta(
		stat_weapon_delta,
		float(preview.get("damage", 0.0)) - float(baseline.get("damage", 0.0)),
	)
	var baseline_secondary := _secondary_stat_profile(baseline)
	var preview_secondary := _secondary_stat_profile(preview)
	for definition: Dictionary in SECONDARY_STAT_DEFINITIONS:
		var stat_id := String(definition.get("id", ""))
		var delta_label := _secondary_stat_delta_labels.get(stat_id) as Label
		if delta_label == null:
			continue
		_set_secondary_stat_delta(
			delta_label,
			float(preview_secondary.get(stat_id, 0.0))
				- float(baseline_secondary.get(stat_id, 0.0)),
			definition,
		)


func _clear_character_stat_preview() -> void:
	for delta_label: Label in [stat_hp_delta, stat_mana_delta, stat_power_delta, stat_weapon_delta]:
		delta_label.hide()
	for raw_label: Variant in _secondary_stat_delta_labels.values():
		var delta_label := raw_label as Label
		if delta_label != null:
			delta_label.hide()


func _set_character_stat_delta(label: Label, delta: float) -> void:
	if is_zero_approx(delta):
		label.hide()
		return
	label.text = "%s%s" % ["+" if delta > 0.0 else "−", _format_number(absf(delta))]
	label.add_theme_color_override(
		&"font_color",
		Color("23733d") if delta > 0.0 else Color("a33835"),
	)
	label.show()


func _set_secondary_stat_delta(
		label: Label,
		delta: float,
		definition: Dictionary,
) -> void:
	if is_zero_approx(delta):
		label.hide()
		return
	var suffix := "%" if String(definition.get("unit", "flat")) == "percent" else ""
	label.text = "%s%s%s" % [
		"+" if delta > 0.0 else "−",
		_format_number(absf(delta)),
		suffix,
	]
	label.add_theme_color_override(
		&"font_color",
		Color("23733d") if delta > 0.0 else Color("a33835"),
	)
	label.show()


func _render_equipment_slots(snapshot: Dictionary) -> void:
	var inventory: Dictionary = snapshot.get("inventory", {})
	var souls: Array = inventory.get("hero_souls", []) if inventory.get("hero_souls", []) is Array else []
	var equipment: Array = inventory.get("auxiliary_equipment", []) if inventory.get("auxiliary_equipment", []) is Array else []
	var team: Dictionary = snapshot.get("soul_team", {})
	var selections: Dictionary = team.get("selected_soul_instances", {}) if team.get("selected_soul_instances", {}) is Dictionary else {}
	var all_loadouts: Dictionary = snapshot.get("hero_loadouts", {}) \
		if snapshot.get("hero_loadouts", {}) is Dictionary else {}
	var loadout: Dictionary = all_loadouts.get(_selected_equipment_hero_id, {}) \
		if all_loadouts.get(_selected_equipment_hero_id, {}) is Dictionary else {}
	var weapon_instance := String(loadout.get(
		"hero_weapon",
		selections.get(_selected_equipment_hero_id, ""),
	))
	var weapon := _soul_by_instance(souls, weapon_instance)
	_add_slot(
		&"hero_weapon",
		"HERO WEAPON • %s" % _hero_name(_selected_equipment_hero_id),
		&"hero_soul",
		weapon,
		_hero_soul_icon(weapon),
		true,
		"",
		_selected_equipment_hero_id,
	)

	var hero_level := _selected_hero_level(snapshot)
	for slot_id: String in AUXILIARY_DEFINITIONS.SLOT_IDS:
		var hero_slot := _hero_loadout_slot(slot_id)
		var equipped := _auxiliary_by_uuid(equipment, String(loadout.get(hero_slot, "")))
		var unlock_level := AUXILIARY_DEFINITIONS.unlock_level(slot_id)
		_add_slot(
			StringName(hero_slot),
			AUXILIARY_PRESENTATION.slot_display_name(slot_id),
			&"auxiliary_equipment",
			equipped,
			_auxiliary_icon(equipped, slot_id),
			hero_level >= unlock_level,
			str(unlock_level)
		)


func _add_slot(
		slot_id: StringName,
		title: String,
		accepted_kind: StringName,
		item: Dictionary,
		icon: Texture2D,
		unlocked: bool,
		locked_hint := "",
		accepted_hero_id := "",
) -> void:
	var slot := EquipmentSlotScene.instantiate() as FieldCodexEquipmentSlot
	equipment_slot_grid.add_child(slot)
	slot.configure(
		slot_id,
		title,
		accepted_kind,
		item,
		icon,
		unlocked,
		locked_hint,
		_slot_item_display_name(accepted_kind, item, slot_id),
		RarityPalette.display_name(item.get("rarity", &"normal")) if not item.is_empty() else "",
		accepted_hero_id,
	)
	slot.item_dropped.connect(_on_slot_item_dropped)
	slot.item_selected.connect(_on_slot_item_selected)
	_slot_nodes[slot_id] = slot


func _slot_item_display_name(
		accepted_kind: StringName,
		item: Dictionary,
		slot_id: StringName,
) -> String:
	if item.is_empty():
		return ""
	if accepted_kind == &"hero_soul":
		return _hero_soul_item_name(String(item.get("hero_id", "sword_hero")))
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	var display_name := String(presentation.get(
		"display_name",
		AUXILIARY_PRESENTATION.slot_display_name(String(slot_id)),
	))
	return _auxiliary_title(display_name, item)


func _on_slot_item_selected(accepted_kind: StringName, item: Dictionary) -> void:
	if item.is_empty() or _save == null or not _save.has_method(&"get_snapshot"):
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var payload := (
		_hero_soul_payload(item, snapshot)
		if accepted_kind == &"hero_soul"
		else _auxiliary_payload(item, snapshot)
	)
	_selected_payload = payload.duplicate(true)
	_selected_key = String(payload.get("key", ""))
	for entry: FieldCodexEntry in _entry_nodes:
		var entry_payload := entry.get_drag_payload()
		var selected := String(entry_payload.get("key", "")) == _selected_key
		entry.set_selected(selected)
	_render_item_detail(payload)


func _add_inventory_payload(payload: Dictionary) -> void:
	var entry := _add_entry(
		String(payload.get("title", "VẬT PHẨM")),
		String(payload.get("list_detail", "")),
		RarityPalette.normalize(payload.get("rarity", &"normal")),
		payload.get("icon", ICON_BAG) as Texture2D,
		"",
		Callable(),
		false,
		payload,
		Callable(self, "_select_inventory_payload").bind(payload)
	)
	_entry_nodes.append(entry)


func _select_inventory_payload(payload: Dictionary) -> void:
	for entry: FieldCodexEntry in _entry_nodes:
		if entry.get_drag_payload().get("key", "") == payload.get("key", ""):
			_select_inventory_entry(payload, entry)
			return


func _select_inventory_entry(payload: Dictionary, selected_entry: FieldCodexEntry) -> void:
	if payload.is_empty():
		return
	_selected_payload = payload.duplicate(true)
	_selected_key = String(payload.get("key", ""))
	for entry: FieldCodexEntry in _entry_nodes:
		entry.set_selected(entry == selected_entry)
	_render_item_detail(payload)


func _restore_selection() -> bool:
	if _selected_key.is_empty():
		return false
	for entry: FieldCodexEntry in _entry_nodes:
		var payload := entry.get_drag_payload()
		if String(payload.get("key", "")) == _selected_key:
			_select_inventory_entry(payload, entry)
			return true
	_selected_payload.clear()
	_selected_key = ""
	return false


func _show_inventory_grid() -> void:
	detail_area.hide()
	scroll.show()
	page_title.text = "KHO %d/%d" % [_inventory_used_count, INVENTORY_SLOT_CAPACITY]
	_clear_character_stat_preview()


func _return_to_inventory_grid() -> void:
	_selected_payload.clear()
	_selected_key = ""
	_refresh()


func _render_item_detail(payload: Dictionary) -> void:
	var rarity := RarityPalette.normalize(payload.get("rarity", &"normal"))
	scroll.hide()
	detail_area.show()
	page_title.text = "CHI TIẾT"
	summary_label.text = ""
	detail_title.text = "%s (%s)" % [
		String(payload.get("title", "Vật phẩm")),
		RarityPalette.display_name(rarity),
	]
	detail_title.add_theme_color_override(&"font_color", RarityPalette.on_light_text_color(rarity))
	detail_text.text = _detail_bbcode(payload)
	var kind := StringName(payload.get("kind", &""))
	var item: Dictionary = payload.get("item", {}) if payload.get("item", {}) is Dictionary else {}
	_render_character_stat_preview(payload)
	var equippable := kind in [&"hero_soul", &"auxiliary_equipment"]
	var auxiliary_rank := _auxiliary_upgrade_rank(item) if kind == &"auxiliary_equipment" else 0
	upgrade_action.visible = kind == &"auxiliary_equipment" \
		and auxiliary_rank < AUXILIARY_RULES.MAX_UPGRADE_RANK
	upgrade_action.disabled = _save == null or not _save.has_method(&"upgrade_auxiliary_equipment")
	upgrade_action.text = "NÂNG +1"
	if upgrade_action.visible:
		var stone := AUXILIARY_PRESENTATION.upgrade_stone_presentation(String(rarity))
		upgrade_action.tooltip_text = (
			"Cần 1 %s cùng độ hiếm. Tăng toàn bộ chỉ số từ +%d lên +%d."
			% [
				String(stone.get("display_name", "Đá Nâng Cấp")),
				auxiliary_rank,
				auxiliary_rank + 1,
			]
		)
	var equipped := bool(payload.get("equipped", false))
	var compatible := kind != &"hero_soul" \
		or String(item.get("hero_id", "")) == _selected_equipment_hero_id
	equip_action.visible = equippable
	equip_action.disabled = not equippable or equipped or not compatible
	equip_action.text = (
		"ĐANG TRANG BỊ"
		if equipped
		else ("THUỘC HERO KHÁC" if not compatible else "TRANG BỊ")
	)
	equip_action.tooltip_text = (
		"Dùng mũi tên cạnh tên Hero để chuyển sang đúng chủ sở hữu."
		if not compatible
		else "Trang bị instance này cho %s." % _hero_name(_selected_equipment_hero_id)
	)


func _detail_bbcode(payload: Dictionary) -> String:
	var kind := StringName(payload.get("kind", &""))
	var item_value: Variant = payload.get("item", {})
	if item_value is Dictionary:
		if kind == &"hero_soul":
			return _detail_rows_to_bbcode(_hero_soul_detail_rows(item_value as Dictionary))
		if kind == &"auxiliary_equipment":
			return _detail_rows_to_bbcode(_auxiliary_detail_rows(item_value as Dictionary))
	return _bbcode_escape(String(payload.get("full_detail", "Không có mô tả.")))


func _hero_soul_detail_rows(soul: Dictionary) -> Array[Dictionary]:
	var rarity_index := clampi(
		int(soul.get("rarity", 0))
		if soul.get("rarity", 0) is int or soul.get("rarity", 0) is float
		else RarityPalette.index(soul.get("rarity", &"normal")),
		0,
		HERO_SOUL_RULES.MAX_RARITY,
	)
	var item_level := clampi(int(soul.get("item_level", 1)), 1, 100)
	var affixes: Array = soul.get("affixes", []) if soul.get("affixes", []) is Array else []
	var rows: Array[Dictionary] = [
		{
			"text": "CẤP %d  •  %s" % [
				item_level,
				_hero_name(String(soul.get("hero_id", "sword_hero"))),
			],
		},
		{
			"text": "POWER VŨ KHÍ  %s%%" % _format_number(
				HERO_SOUL_RULES.weapon_damage_percent(rarity_index, item_level)
			),
			"rarity_index": rarity_index,
		},
	]
	var sorted := _sorted_affixes(affixes, rarity_index)
	for affix: Dictionary in sorted:
		var tier := clampi(int(affix.get("tier", rarity_index)), 0, HERO_SOUL_RULES.MAX_RARITY)
		var affix_id := String(affix.get("affix_id", ""))
		var display := HERO_SOUL_RULES.affix_display_metadata(
			affix_id,
			float(affix.get("value", 0.0)),
			tier,
		)
		rows.append({
			"text": "• %s  ·  %s" % [
				String(display.get("description", "Thuộc tính chưa xác định")),
				RarityPalette.display_name(tier),
			],
			"rarity_index": tier,
		})
	return rows


func _auxiliary_detail_rows(item: Dictionary) -> Array[Dictionary]:
	var slot_id := String(item.get("slot", "soul_vessel"))
	var rarity := RarityPalette.normalize(item.get("rarity", &"normal"))
	var rarity_index := RarityPalette.index(rarity)
	var item_level := clampi(int(item.get("item_level", 1)), 1, 100)
	var upgrade_multiplier := AUXILIARY_RULES.upgrade_multiplier(item)
	var primary: Dictionary = item.get("primary", {}) if item.get("primary", {}) is Dictionary else {}
	var affixes: Array = item.get("affixes", []) if item.get("affixes", []) is Array else []
	var rows: Array[Dictionary] = [
		{
			"text": "CẤP %d  •  %s" % [
				item_level,
				AUXILIARY_PRESENTATION.slot_display_name(slot_id),
			],
		},
		{
			"text": "CHÍNH  •  %s" % _format_stat_record(
				primary,
				"stat_id",
				upgrade_multiplier,
			),
			"rarity_index": rarity_index,
		},
	]
	var sorted := _sorted_affixes(affixes, rarity_index)
	for affix: Dictionary in sorted:
		var tier := clampi(int(affix.get("tier", rarity_index)), 0, RarityPalette.IDS.size() - 1)
		var affix_id := String(affix.get("affix_id", ""))
		var unit := String(affix.get("unit", ""))
		rows.append({
			"text": "• %s +%s%s  ·  %s" % [
				String(STAT_DISPLAY_NAMES.get(affix_id, "Thuộc tính")),
				_format_number(float(affix.get("value", 0.0)) * upgrade_multiplier),
				_unit_suffix(unit),
				RarityPalette.display_name(tier),
			],
			"rarity_index": tier,
		})
	return rows


func _sorted_affixes(raw_affixes: Array, fallback_tier: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for raw_affix: Variant in raw_affixes:
		if raw_affix is Dictionary:
			result.append((raw_affix as Dictionary).duplicate(true))
	result.sort_custom(_affix_precedes.bind(fallback_tier))
	return result


func _affix_precedes(left: Dictionary, right: Dictionary, fallback_tier: int) -> bool:
	var left_tier := clampi(int(left.get("tier", fallback_tier)), 0, RarityPalette.IDS.size() - 1)
	var right_tier := clampi(int(right.get("tier", fallback_tier)), 0, RarityPalette.IDS.size() - 1)
	if left_tier != right_tier:
		return left_tier > right_tier
	var left_quality := _affix_roll_quality(left)
	var right_quality := _affix_roll_quality(right)
	if not is_equal_approx(left_quality, right_quality):
		return left_quality > right_quality
	return String(left.get("affix_id", "")).naturalnocasecmp_to(
		String(right.get("affix_id", ""))
	) < 0


func _affix_roll_quality(affix: Dictionary) -> float:
	var value := float(affix.get("value", 0.0))
	var roll_min := float(affix.get("roll_min", value))
	var roll_max := float(affix.get("roll_max", value))
	if roll_max <= roll_min:
		return 0.5
	return clampf((value - roll_min) / (roll_max - roll_min), 0.0, 1.0)


func _detail_rows_to_bbcode(rows: Array[Dictionary]) -> String:
	var lines := PackedStringArray()
	for row: Dictionary in rows:
		var copy := _bbcode_escape(String(row.get("text", "")))
		if row.has("rarity_index"):
			var tier := clampi(int(row.get("rarity_index", 0)), 0, RarityPalette.IDS.size() - 1)
			copy = "[color=#%s]%s[/color]" % [
				RarityPalette.on_light_text_color(tier).to_html(false),
				copy,
			]
		lines.append(copy)
	return "\n".join(lines)


func _bbcode_escape(value: String) -> String:
	# Full-width brackets preserve readable authored copy without allowing item
	# metadata to inject RichTextLabel tags.
	return value.replace("[", "［").replace("]", "］")


func _hero_soul_full_detail(soul: Dictionary) -> String:
	var rarity_index := clampi(
		int(soul.get("rarity", 0))
		if soul.get("rarity", 0) is int or soul.get("rarity", 0) is float
		else RarityPalette.index(soul.get("rarity", &"normal")),
		0,
		HERO_SOUL_RULES.MAX_RARITY,
	)
	var item_level := clampi(int(soul.get("item_level", 1)), 1, 100)
	var affixes: Array = soul.get("affixes", []) if soul.get("affixes", []) is Array else []
	var capacity: int = HERO_SOUL_RULES.affix_slot_count(rarity_index)
	var weapon_damage_percent: float = HERO_SOUL_RULES.weapon_damage_percent(rarity_index, item_level)
	var hero_id := StringName(String(soul.get("hero_id", "sword_hero")))
	var skill_ranks: Dictionary = soul.get("skill_ranks", {}) \
		if soul.get("skill_ranks", {}) is Dictionary else {}
	var kit := HERO_SKILL_KITS.kit_snapshot(hero_id, rarity_index, skill_ranks)
	var first_skill: Dictionary = kit.get("active_1", {})
	var second_skill: Dictionary = kit.get("active_2", {})
	var lines := PackedStringArray([
		"Độ hiếm: %s" % HERO_SOUL_RULES.rarity_display_name_vi(rarity_index),
		"Cấp món: %d" % item_level,
		"Sức mạnh vũ khí: %s%% Power nhân vật" % _format_number(weapon_damage_percent),
		"Ô thuộc tính: %d/%d" % [affixes.size(), capacity],
		"Hero Weapon của: %s" % _hero_name(String(hero_id)),
		"Bộ chiêu: %s" % String(kit.get("kit_id", "basic")).replace("_", " ").to_upper(),
		"Kỹ năng 1: %s • Bậc %d • x%s" % [String(first_skill.get("name", "—")), int(skill_ranks.get("active_1", 1)), _format_number(HERO_SKILL_KITS.effective_skill_multiplier(rarity_index, int(skill_ranks.get("active_1", 1))))],
		"Kỹ năng 2: %s • Bậc %d • x%s" % [String(second_skill.get("name", "—")), int(skill_ranks.get("active_2", 1)), _format_number(HERO_SKILL_KITS.effective_skill_multiplier(rarity_index, int(skill_ranks.get("active_2", 1))))],
	])
	if String(kit.get("kit_id", "")) == "legendary_plus":
		lines.append("Legendary+: đổi Nội tại, Soul Skill và kỹ năng Rời sân.")
	if affixes.is_empty():
		lines.append("Thuộc tính: chưa có ở độ hiếm này.")
	else:
		lines.append("Thuộc tính:")
		for affix: Dictionary in _sorted_affixes(affixes, rarity_index):
			lines.append(_hero_affix_detail_line(affix, rarity_index))
	return "\n".join(lines)


func _hero_affix_detail_line(affix: Dictionary, fallback_tier: int) -> String:
	var affix_id := String(affix.get("affix_id", ""))
	var tier := clampi(int(affix.get("tier", fallback_tier)), 0, HERO_SOUL_RULES.MAX_RARITY)
	var value := float(affix.get("value", 0.0))
	var display: Dictionary = HERO_SOUL_RULES.affix_display_metadata(affix_id, value, tier)
	var roll_min := float(affix.get("roll_min", value))
	var roll_max := float(affix.get("roll_max", value))
	if HERO_SOUL_RULES.AFFIX_CATALOG.has(affix_id) \
			and not affix.has("roll_min") and not affix.has("roll_max"):
		var definition: Dictionary = HERO_SOUL_RULES.AFFIX_CATALOG[affix_id]
		var multiplier_range: Vector2 = HERO_SOUL_RULES.rarity_roll_multiplier_range(tier)
		roll_min = float(definition.get("min", value)) * multiplier_range.x
		roll_max = float(definition.get("max", value)) * multiplier_range.y
	var unit := String(
		(HERO_SOUL_RULES.AFFIX_CATALOG.get(affix_id, {}) as Dictionary).get(
			"unit", affix.get("unit", "")
		)
	)
	return "• %s • %s • khoảng %s–%s%s" % [
		String(display.get("description", "Thuộc tính chưa xác định")),
		String(display.get("tier_display_name", HERO_SOUL_RULES.affix_tier_display_name_vi(tier))),
		_format_number(roll_min),
		_format_number(roll_max),
		_unit_suffix(unit),
	]


func _auxiliary_full_detail(item: Dictionary) -> String:
	var slot_id := String(item.get("slot", "soul_vessel"))
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	var rarity := String(RarityPalette.normalize(item.get("rarity", &"normal")))
	var rarity_index := RarityPalette.index(rarity)
	var item_level := clampi(int(item.get("item_level", 1)), 1, 100)
	var upgrade_rank := _auxiliary_upgrade_rank(item)
	var upgrade_multiplier := AUXILIARY_RULES.upgrade_multiplier(item)
	var primary: Dictionary = item.get("primary", {}) if item.get("primary", {}) is Dictionary else {}
	var affixes: Array = item.get("affixes", []) if item.get("affixes", []) is Array else []
	var capacity := maxi(0, AUXILIARY_DEFINITIONS.affix_count(rarity))
	var lines := PackedStringArray([
		"Độ hiếm: %s" % RarityPalette.display_name(rarity).capitalize(),
		"Cấp món: %d" % item_level,
		"Nâng cấp: +%d/%d • x%s toàn bộ chỉ số" % [
			upgrade_rank,
			AUXILIARY_RULES.MAX_UPGRADE_RANK,
			_format_number(upgrade_multiplier),
		],
		"Phân loại: %s" % AUXILIARY_PRESENTATION.slot_display_name(slot_id),
		"Chức năng: %s" % String(presentation.get(
			"function",
			AUXILIARY_PRESENTATION.slot_function(slot_id),
		)),
		"Chỉ số chính: %s" % _format_stat_record(primary, "stat_id", upgrade_multiplier),
		"Ô thuộc tính: %d/%d" % [affixes.size(), capacity],
	])
	if affixes.is_empty():
		lines.append("Thuộc tính: chưa có ở độ hiếm này.")
	else:
		lines.append("Thuộc tính:")
		for affix: Dictionary in _sorted_affixes(affixes, rarity_index):
			lines.append(_auxiliary_affix_detail_line(
				affix,
				slot_id,
				rarity_index,
				item_level,
				upgrade_multiplier,
			))
	return "\n".join(lines)


func _auxiliary_affix_detail_line(
		affix: Dictionary,
		slot_id: String,
		rarity_index: int,
		item_level: int,
		upgrade_multiplier: float,
) -> String:
	var affix_id := String(affix.get("affix_id", ""))
	var value := float(affix.get("value", 0.0))
	var definitions: Dictionary = AUXILIARY_DEFINITIONS.affix_definitions(slot_id)
	var definition: Dictionary = definitions.get(affix_id, {}) if definitions.get(affix_id, {}) is Dictionary else {}
	var multiplier := AUXILIARY_DEFINITIONS.roll_multiplier(String(AUXILIARY_DEFINITIONS.RARITY_IDS[rarity_index]))
	var level_multiplier := 1.0 + 0.01 * float(item_level - 1)
	var roll_min := float(definition.get("min", value)) * multiplier * level_multiplier * upgrade_multiplier
	var roll_max := float(definition.get("max", value)) * multiplier * level_multiplier * upgrade_multiplier
	return "• %s +%s%s • %s • khoảng %s–%s%s" % [
		String(STAT_DISPLAY_NAMES.get(affix_id, "Thuộc tính")),
		_format_number(value * upgrade_multiplier),
		_unit_suffix(String(affix.get("unit", definition.get("unit", "")))),
		HERO_SOUL_RULES.affix_tier_display_name_vi(rarity_index),
		_format_number(roll_min),
		_format_number(roll_max),
		_unit_suffix(String(definition.get("unit", affix.get("unit", "")))),
	]


func _hero_soul_payload(soul: Dictionary, snapshot: Dictionary) -> Dictionary:
	var hero_id := String(soul.get("hero_id", "sword_hero"))
	var instance_id := String(soul.get("instance_id", ""))
	var rarity := RarityPalette.normalize(soul.get("rarity", 0))
	var team: Dictionary = snapshot.get("soul_team", {})
	var selections: Dictionary = team.get("selected_soul_instances", {}) if team.get("selected_soul_instances", {}) is Dictionary else {}
	var equipped := hero_id == _selected_equipment_hero_id \
		and String(selections.get(hero_id, "")) == instance_id
	var title := _hero_soul_item_name(hero_id)
	return {
		"key": "soul:%s" % instance_id,
		"kind": &"hero_soul",
		"item": soul.duplicate(true),
		"title": title,
		"rarity": rarity,
		"icon": _hero_soul_icon(soul),
		"equipped": equipped,
		"list_detail": "(%s)" % RarityPalette.display_name(rarity),
		"full_detail": _hero_soul_full_detail(soul),
	}


func _hero_soul_icon(soul: Dictionary) -> Texture2D:
	var hero_id := String(soul.get(
		"hero_id",
		_selected_equipment_hero_id if not _selected_equipment_hero_id.is_empty() else "sword_hero",
	))
	match hero_id:
		"archer_hero": return ARCHER_SOUL_ASSETS.icon(soul.get("rarity", 0))
		"axe_hero": return ICON_SOUL_AXE
		"wizard_hero", "mage_hero": return ICON_WIZARD_SOUL
		_: return ICON_SOUL_SWORD


func _auxiliary_upgrade_rank(item: Dictionary) -> int:
	return clampi(
		int(item.get("upgrade_rank", 0)),
		0,
		AUXILIARY_RULES.MAX_UPGRADE_RANK,
	)


func _auxiliary_title(display_name: String, item: Dictionary) -> String:
	var rank := _auxiliary_upgrade_rank(item)
	return "%s +%d" % [display_name, rank] if rank > 0 else display_name


func _auxiliary_payload(item: Dictionary, snapshot: Dictionary) -> Dictionary:
	var slot_id := String(item.get("slot", "soul_vessel"))
	var uuid := String(item.get("uuid", ""))
	var rarity := RarityPalette.normalize(item.get("rarity", &"normal"))
	var upgrade_rank := _auxiliary_upgrade_rank(item)
	var loadouts: Dictionary = snapshot.get("hero_loadouts", {}) \
		if snapshot.get("hero_loadouts", {}) is Dictionary else {}
	var loadout: Dictionary = loadouts.get(_selected_equipment_hero_id, {}) \
		if loadouts.get(_selected_equipment_hero_id, {}) is Dictionary else {}
	var equipped := String(loadout.get(_hero_loadout_slot(slot_id), "")) == uuid
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	var display_name := String(presentation.get(
		"display_name",
		AUXILIARY_PRESENTATION.slot_display_name(slot_id),
	))
	return {
		"key": "gear:%s" % uuid,
		"kind": &"auxiliary_equipment",
		"item": item.duplicate(true),
		"title": _auxiliary_title(display_name, item),
		"rarity": rarity,
		"icon": _auxiliary_icon(item, slot_id),
		"equipped": equipped,
		"list_detail": (
			"(%s • +%d)" % [RarityPalette.display_name(rarity), upgrade_rank]
			if upgrade_rank > 0
			else "(%s)" % RarityPalette.display_name(rarity)
		),
		"full_detail": _auxiliary_full_detail(item),
	}


func _auxiliary_icon(item: Dictionary, slot_id: String) -> Texture2D:
	if item.is_empty():
		return AUXILIARY_ICONS.get(slot_id, ICON_BAG) as Texture2D
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	var path := String(presentation.get("icon_path", ""))
	if not path.is_empty() and ResourceLoader.exists(path):
		var loaded := load(path) as Texture2D
		if loaded != null:
			return loaded
	return AUXILIARY_ICONS.get(slot_id, ICON_BAG) as Texture2D


func _stack_payload(stack_key: String, stack: Dictionary) -> Dictionary:
	var item_id := String(stack.get("item_id", stack_key)).strip_edges().to_lower()
	var quantity := maxi(0, int(stack.get("quantity", 0)))
	var rarity := RarityPalette.normalize(stack.get("rarity", &"normal"))
	var item_definition := STACK_ITEM_CATALOG.find(StringName(item_id)) if STACK_ITEM_CATALOG != null else null
	var is_upgrade_stone := item_id.begins_with("soul_upgrade_stone_")
	var stone_presentation := (
		AUXILIARY_PRESENTATION.upgrade_stone_presentation(String(rarity))
		if is_upgrade_stone else {}
	)
	var title := String(stack.get("display_name", "")).strip_edges()
	if title.is_empty() and item_definition != null:
		title = item_definition.display_name
	if title.is_empty():
		title = (
			String(stone_presentation.get("display_name", "Đá Nâng Cấp"))
			if is_upgrade_stone
			else "Tinh Chất Linh Hồn"
			if item_id == "soul_ember"
			else item_id.replace("_", " ").capitalize()
		)
	var icon := ICON_EMBER if item_id == "soul_ember" else ICON_BAG
	if item_definition != null and item_definition.icon != null:
		icon = item_definition.icon
	var icon_path := String(stack.get("icon_path", "")).strip_edges()
	if icon_path.is_empty() and is_upgrade_stone:
		icon_path = String(stone_presentation.get("icon_path", ""))
	if not icon_path.is_empty() and ResourceLoader.exists(icon_path):
		var loaded := load(icon_path) as Texture2D
		if loaded != null:
			icon = loaded
	var full_detail := (
		"x%d\nNâng +1 trang bị cùng độ hiếm." % quantity
		if is_upgrade_stone
		else "x%d\nVật liệu." % quantity
	)
	if item_definition != null and not item_definition.description.strip_edges().is_empty():
		full_detail = "x%d\n%s" % [quantity, item_definition.description]
	return {
		"key": "stack:%s" % stack_key,
		"kind": &"stackable",
		"item_id": StringName(item_id),
		"stack_key": StringName(stack_key),
		"item": stack.duplicate(true),
		"title": title,
		"rarity": rarity,
		"icon": icon,
		"equipped": false,
		"list_detail": "x%d • (%s)" % [quantity, RarityPalette.display_name(rarity)],
		"full_detail": full_detail,
	}


func _is_droppable_inventory_payload(payload: Dictionary) -> bool:
	var kind := StringName(payload.get("kind", &""))
	if kind not in [&"hero_soul", &"auxiliary_equipment", &"stackable"]:
		return false
	return payload.get("item", {}) is Dictionary


func _drop_inventory_payload(payload: Dictionary) -> void:
	if not _is_droppable_inventory_payload(payload) or _save == null:
		return
	if not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group(&"player")
	if not _player is Node2D:
		status_label.text = "Không thể vứt khi chưa có nhân vật trong màn chơi."
		status_label.add_theme_color_override(&"font_color", Color("a33835"))
		return
	var kind := StringName(payload.get("kind", &""))
	var item := payload.get("item", {}) as Dictionary
	var stack_item_id := StringName(payload.get("item_id", &""))
	var stack_key := StringName(payload.get("stack_key", stack_item_id))
	var loot_payload := LOOT_CATALOG.build_inventory_drop_payload(kind, item, stack_item_id)
	if loot_payload.is_empty():
		status_label.text = "Không thể tạo vật phẩm để vứt."
		status_label.add_theme_color_override(&"font_color", Color("a33835"))
		return
	var director: Node
	for candidate: Node in get_tree().get_nodes_in_group(&"loot_director"):
		if is_instance_valid(candidate) and candidate.has_method(&"spawn_player_drop"):
			director = candidate
			break
	if director == null:
		status_label.text = "Không tìm thấy vùng thả đồ trong màn chơi."
		status_label.add_theme_color_override(&"font_color", Color("a33835"))
		return
	var dropped_loot := director.call(&"spawn_player_drop", loot_payload, _player as Node2D) as GroundLoot
	if dropped_loot == null:
		status_label.text = "Không thể đặt vật phẩm xuống đất."
		status_label.add_theme_color_override(&"font_color", Color("a33835"))
		return
	var transaction_key := _key("field_drop_%s" % String(payload.get("key", kind)))
	var success := false
	match kind:
		&"hero_soul":
			success = _save.has_method(&"drop_hero_soul") and bool(_save.call(
				&"drop_hero_soul", String(item.get("instance_id", "")), transaction_key,
			))
		&"auxiliary_equipment":
			success = _save.has_method(&"drop_auxiliary_equipment") and bool(_save.call(
				&"drop_auxiliary_equipment", String(item.get("uuid", "")), transaction_key,
			))
		&"stackable":
			success = _save.has_method(&"drop_inventory_item") and bool(_save.call(
				&"drop_inventory_item", stack_key, int(item.get("quantity", 0)), transaction_key,
			))
	if not success:
		dropped_loot.queue_free()
		status_label.text = "Không thể vứt: hãy tháo món đang trang bị, hoặc kiểm tra lại kho."
		status_label.add_theme_color_override(&"font_color", Color("a33835"))
		return
	_selected_payload.clear()
	_selected_key = ""
	_refresh_live_player()
	_refresh()
	status_label.text = "Đã vứt vật phẩm xuống đất — chỉ nhặt lại thủ công."
	status_label.add_theme_color_override(&"font_color", Color("2b7a45"))


func _render_upgrades(snapshot: Dictionary) -> void:
	page_title.text = "PHÂN BỔ"
	var progression := _progression_snapshot()
	var stats: Dictionary = progression.get("stats", {}) if progression.get("stats", {}) is Dictionary else {}
	var allocation: Dictionary = stats.get("allocation", {}) if stats.get("allocation", {}) is Dictionary else {}
	var stat_points := maxi(0, int(stats.get("unspent_points", 0)))
	var skills: Dictionary = progression.get("skills", {}) if progression.get("skills", {}) is Dictionary else {}
	var skill_points := maxi(0, int(skills.get("unspent_points", 0)))
	upgrade_point_summary.text = "%d CHỈ SỐ  •  %d KỸ NĂNG" % [stat_points, skill_points]
	summary_label.text = ""

	for stat_id: StringName in [&"hp", &"damage", &"mana"]:
		var value := float(stats.get(String(stat_id), 0.0))
		var points := int(allocation.get(String(stat_id), 0))
		_add_entry(
			String(STAT_NAMES[stat_id]),
			"%s  •  +%d" % [_format_number(value), points],
			&"rare" if points >= 10 else &"normal",
			STAT_ICONS[stat_id],
			"+1",
			Callable(self, "_allocate_stat").bind(stat_id),
			stat_points <= 0
		)

	var team: Dictionary = snapshot.get("soul_team", {})
	var hero_id := String(team.get("active_hero", "sword_hero"))
	var allocations: Dictionary = skills.get("allocations", {}) if skills.get("allocations", {}) is Dictionary else {}
	var hero_tracks: Dictionary = allocations.get(hero_id, {}) if allocations.get(hero_id, {}) is Dictionary else {}
	var rank_gate := maxi(1, int(skills.get("rank_gate", 1)))
	var features: Dictionary = (snapshot.get("progression", {}) as Dictionary).get("features", {})
	var skill_unlocked := bool(features.get("skill_allocation", false))
	for track_id: StringName in SKILL_NAMES:
		var rank := maxi(0, int(hero_tracks.get(String(track_id), 0)))
		_add_entry(
			String(SKILL_NAMES[track_id]).to_upper(),
			"%s  •  %d/%d" % [_hero_name(hero_id), rank, rank_gate],
			&"magic" if rank > 0 else &"normal",
			ICON_SKILL,
			"+CẤP",
			Callable(self, "_allocate_skill").bind(StringName(hero_id), track_id),
			not skill_unlocked or skill_points <= 0 or rank >= rank_gate
		)


func _add_entry(
		title: String,
		detail: String,
		rarity: StringName,
		icon: Texture2D,
		action_text := "",
		action := Callable(),
		disabled := false,
		drag_payload: Dictionary = {},
		select_action := Callable()
) -> FieldCodexEntry:
	var scene := ItemTileScene if _section == SECTION_EQUIPMENT else EntryScene
	var entry := scene.instantiate() as FieldCodexEntry
	entry_list.add_child(entry)
	entry.configure(title, detail, rarity, icon, action_text, action, disabled, drag_payload, select_action)
	return entry


func _on_slot_item_dropped(slot_id: StringName, payload: Dictionary) -> void:
	var kind := StringName(payload.get("kind", &""))
	var item: Dictionary = payload.get("item", {}) if payload.get("item", {}) is Dictionary else {}
	var success := false
	if kind == &"auxiliary_equipment" \
			and _hero_loadout_slot(String(item.get("slot", ""))) == String(slot_id):
		success = _save != null and _save.has_method(&"equip_hero_item") and bool(_save.call(
			&"equip_hero_item",
			StringName(_selected_equipment_hero_id),
			slot_id,
			String(item.get("uuid", "")),
			_key("field_drag_gear"),
		))
	elif kind == &"hero_soul" and slot_id == &"hero_weapon" \
			and String(item.get("hero_id", "")) == _selected_equipment_hero_id:
		success = _save != null and _save.has_method(&"equip_hero_item") and bool(_save.call(
			&"equip_hero_item",
			StringName(_selected_equipment_hero_id),
			&"hero_weapon",
			String(item.get("instance_id", "")),
			_key("field_drag_weapon"),
		))
	_commit_feedback(
		success,
		"Đã trang bị cho %s; chỉ số chiến đấu cập nhật ngay." % _hero_name(_selected_equipment_hero_id),
	)


func _equip_selected() -> void:
	if _selected_payload.is_empty():
		return
	var kind := StringName(_selected_payload.get("kind", &""))
	var item: Dictionary = _selected_payload.get("item", {}) if _selected_payload.get("item", {}) is Dictionary else {}
	if kind == &"auxiliary_equipment":
		_equip_gear(String(item.get("uuid", "")))
	elif kind == &"hero_soul":
		_equip_soul_default(String(item.get("instance_id", "")))


func _upgrade_selected_auxiliary() -> void:
	if StringName(_selected_payload.get("kind", &"")) != &"auxiliary_equipment":
		return
	var item_value: Variant = _selected_payload.get("item", {})
	if not item_value is Dictionary:
		return
	var item := item_value as Dictionary
	var uuid := String(item.get("uuid", ""))
	var current_rank := _auxiliary_upgrade_rank(item)
	var retained_key := _selected_key
	var rarity := String(RarityPalette.normalize(item.get("rarity", &"normal")))
	var stone := AUXILIARY_PRESENTATION.upgrade_stone_presentation(rarity)
	var success := (
		not uuid.is_empty()
		and current_rank < AUXILIARY_RULES.MAX_UPGRADE_RANK
		and _save != null
		and _save.has_method(&"upgrade_auxiliary_equipment")
		and bool(_save.call(
			&"upgrade_auxiliary_equipment",
			uuid,
			_key("field_aux_upgrade_%s" % uuid),
		))
	)
	_selected_key = retained_key
	if success:
		_refresh_live_player()
	_refresh()
	if success:
		status_label.text = "Đã nâng vật phẩm lên +%d; toàn bộ chỉ số tăng thêm 3%%." % (current_rank + 1)
		status_label.add_theme_color_override(&"font_color", Color("2b7a45"))
		return
	status_label.text = "Không thể nâng: cần 1 %s cùng độ hiếm hoặc vật phẩm đã đạt +%d." % [
		String(stone.get("display_name", "Đá Nâng Cấp")),
		AUXILIARY_RULES.MAX_UPGRADE_RANK,
	]
	status_label.add_theme_color_override(&"font_color", Color("a33835"))


func _equip_soul_default(instance_id: String) -> void:
	if _save == null or not _save.has_method(&"get_snapshot"):
		_commit_feedback(false, "")
		return
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var souls: Array = ((snapshot.get("inventory", {}) as Dictionary).get("hero_souls", []) as Array)
	var soul := _soul_by_instance(souls, instance_id)
	if soul.is_empty():
		_commit_feedback(false, "")
		return
	var hero_id := String(soul.get("hero_id", ""))
	if hero_id != _selected_equipment_hero_id:
		status_label.text = "Hero Weapon này thuộc %s — hãy đổi Hero bằng mũi tên trên tên nhân vật." % _hero_name(hero_id)
		status_label.add_theme_color_override(&"font_color", Color("a16a24"))
		return
	var success := _save.has_method(&"equip_hero_item") and bool(_save.call(
		&"equip_hero_item",
		StringName(hero_id),
		&"hero_weapon",
		instance_id,
		_key("field_soul_copy"),
	))
	_commit_feedback(success, "Đã trang bị đúng Hero Weapon; hiệu ứng cập nhật ngay.")


func _equip_soul_to_slot(instance_id: String, slot_id: StringName) -> bool:
	if _save == null or not _save.has_method(&"get_snapshot") or not _save.has_method(&"set_soul_team_instances"):
		return false
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var inventory: Dictionary = snapshot.get("inventory", {})
	var souls: Array = inventory.get("hero_souls", []) if inventory.get("hero_souls", []) is Array else []
	var dragged := _soul_by_instance(souls, instance_id)
	if dragged.is_empty():
		return false
	var dragged_hero := String(dragged.get("hero_id", ""))
	var team: Dictionary = snapshot.get("soul_team", {})
	var selections: Dictionary = team.get("selected_soul_instances", {}) if team.get("selected_soul_instances", {}) is Dictionary else {}
	var active_hero := String(team.get("active_hero", ""))
	var active_instance := _soul_instance_for_hero(souls, selections, active_hero)
	if active_instance.is_empty():
		return false
	var raw_reserves: Array = team.get("reserve_souls", [""]) if team.get("reserve_souls", [""]) is Array else [""]
	var reserve_instances: Array[String] = []
	for index: int in 1:
		var hero_id := String(raw_reserves[index]) if index < raw_reserves.size() else ""
		reserve_instances.append(_soul_instance_for_hero(souls, selections, hero_id) if not hero_id.is_empty() else "")
	var source_reserve := reserve_instances.find(instance_id)
	var source_active := active_instance == instance_id

	if slot_id == &"soul_active":
		var old_active := active_instance
		active_instance = instance_id
		if source_reserve >= 0:
			reserve_instances[source_reserve] = old_active
		else:
			for index: int in reserve_instances.size():
				if _hero_for_instance(souls, reserve_instances[index]) == dragged_hero:
					reserve_instances[index] = ""
			if _hero_for_instance(souls, old_active) != dragged_hero and not old_active.is_empty():
				var available := 1
				for index: int in available:
					if reserve_instances[index].is_empty():
						reserve_instances[index] = old_active
						break
	else:
		var target_index := String(slot_id).trim_prefix("soul_reserve_").to_int()
		var available := 1
		if target_index < 0 or target_index >= available:
			return false
		if dragged_hero == active_hero and not source_active:
			return false
		if source_active:
			var target_instance := reserve_instances[target_index]
			if target_instance.is_empty():
				return false
			active_instance = target_instance
			reserve_instances[target_index] = instance_id
		elif source_reserve >= 0:
			var target_instance := reserve_instances[target_index]
			reserve_instances[target_index] = instance_id
			reserve_instances[source_reserve] = target_instance
		else:
			if dragged_hero == active_hero:
				return false
			for index: int in reserve_instances.size():
				if _hero_for_instance(souls, reserve_instances[index]) == dragged_hero:
					reserve_instances[index] = ""
			reserve_instances[target_index] = instance_id

	return bool(_save.call(
		&"set_soul_team_instances", active_instance, reserve_instances, _key("field_drag_soul_%s" % slot_id)
	))


func _allocate_stat(stat_id: StringName) -> void:
	var success := _save != null and _save.has_method(&"allocate_player_stat") and bool(_save.call(
		&"allocate_player_stat", stat_id, 1, _key("field_stat_%s" % stat_id)
	))
	_commit_feedback(success, "Đã tăng %s; chỉ số chiến đấu cập nhật ngay." % STAT_NAMES[stat_id])


func _allocate_skill(hero_id: StringName, track_id: StringName) -> void:
	var success := _save != null and _save.has_method(&"allocate_hero_skill") and bool(_save.call(
		&"allocate_hero_skill", hero_id, track_id, 1, _key("field_skill_%s_%s" % [hero_id, track_id])
	))
	_commit_feedback(success, "Đã tăng rank %s." % SKILL_NAMES[track_id])


func _equip_gear(uuid: String) -> void:
	var success := false
	if _save != null and _save.has_method(&"get_snapshot") and _save.has_method(&"equip_hero_item"):
		var snapshot: Dictionary = _save.call(&"get_snapshot")
		var inventory: Dictionary = snapshot.get("inventory", {})
		var equipment: Array = inventory.get("auxiliary_equipment", []) \
			if inventory.get("auxiliary_equipment", []) is Array else []
		var item := _auxiliary_by_uuid(equipment, uuid)
		var hero_slot := _hero_loadout_slot(String(item.get("slot", "")))
		if not hero_slot.is_empty():
			success = bool(_save.call(
				&"equip_hero_item",
				StringName(_selected_equipment_hero_id),
				StringName(hero_slot),
				uuid,
				_key("field_gear"),
			))
	_commit_feedback(success, "Trang bị mới đã được áp dụng cho %s." % _hero_name(_selected_equipment_hero_id))


func _commit_feedback(success: bool, success_message: String) -> void:
	status_label.text = success_message if success else "Không thể trang bị: ô không tương thích hoặc chưa mở khóa."
	status_label.add_theme_color_override(&"font_color", Color("2b7a45") if success else Color("a33835"))
	if success:
		_refresh_live_player()
	_refresh()


func _progression_snapshot() -> Dictionary:
	if _save == null or not _save.has_method(&"get_player_progression_snapshot"):
		return {}
	var value: Variant = _save.call(&"get_player_progression_snapshot")
	return value if value is Dictionary else {}


func _refresh_live_player() -> void:
	if not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group(&"player")
	if not is_instance_valid(_player) or _save == null or not _save.has_method(&"get_snapshot"):
		return
	if _player.has_method(&"refresh_runtime_meta_from_save"):
		_player.call(&"refresh_runtime_meta_from_save", _save.call(&"get_snapshot"))
	elif _player.has_method(&"refresh_auxiliary_equipment_from_save"):
		_player.call(&"refresh_auxiliary_equipment_from_save", _save.call(&"get_snapshot"))


func _on_save_committed(_snapshot: Dictionary) -> void:
	if visible:
		_refresh()


func _clear_container(container: Node) -> void:
	for child: Node in container.get_children():
		container.remove_child(child)
		child.queue_free()


func _soul_by_instance(souls: Array, instance_id: String) -> Dictionary:
	for raw_soul: Variant in souls:
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			return raw_soul as Dictionary
	return {}


func _auxiliary_by_uuid(items: Array, uuid: String) -> Dictionary:
	for raw_item: Variant in items:
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return raw_item as Dictionary
	return {}


func _soul_instance_for_hero(souls: Array, selections: Dictionary, hero_id: String) -> String:
	if hero_id.is_empty():
		return ""
	var selected_id := String(selections.get(hero_id, ""))
	if String(_soul_by_instance(souls, selected_id).get("hero_id", "")) == hero_id:
		return selected_id
	for raw_soul: Variant in souls:
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("hero_id", "")) == hero_id:
			return String((raw_soul as Dictionary).get("instance_id", ""))
	return ""


func _hero_for_instance(souls: Array, instance_id: String) -> String:
	return String(_soul_by_instance(souls, instance_id).get("hero_id", ""))


func _format_affix_list(affixes: Array) -> String:
	var parts := PackedStringArray()
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			continue
		var affix := raw_affix as Dictionary
		var id := String(affix.get("affix_id", "thuộc_tính"))
		parts.append("%s +%s%s" % [
			String(STAT_DISPLAY_NAMES.get(id, id.replace("_", " ").capitalize())),
			_format_number(float(affix.get("value", 0.0))),
			_unit_suffix(String(affix.get("unit", ""))),
		])
		if parts.size() >= 2:
			break
	return " • ".join(parts)


func _format_stat_record(
		record: Dictionary,
		id_field: String,
		value_multiplier := 1.0,
) -> String:
	var id := String(record.get(id_field, "thuộc_tính"))
	return "%s +%s%s" % [
		String(STAT_DISPLAY_NAMES.get(id, id.replace("_", " ").capitalize())),
		_format_number(float(record.get("value", 0.0)) * maxf(0.0, value_multiplier)),
		_unit_suffix(String(record.get("unit", ""))),
	]


func _unit_suffix(unit: String) -> String:
	if unit == "percent_per_second":
		return "%/s"
	if unit == "flat_per_second":
		return "/s"
	if unit.begins_with("percent"):
		return "%"
	if unit == "seconds":
		return " giây"
	return ""


func _hero_loadout_slot(legacy_slot_id: String) -> String:
	return String({
		"soul_vessel": "armor",
		"soul_boots": "boots",
		"soul_trace": "jewelry",
		"hero_weapon": "hero_weapon",
		"armor": "armor",
		"boots": "boots",
		"jewelry": "jewelry",
	}.get(legacy_slot_id, ""))


func _key(operation: String) -> String:
	_transaction_serial += 1
	return "field:%s:%d:%d" % [operation, Time.get_ticks_usec(), _transaction_serial]


func _hero_name(hero_id: String) -> String:
	return String(HERO_NAMES.get(hero_id, hero_id.replace("_", " ").to_upper()))


func _hero_soul_item_name(hero_id: String) -> String:
	return String(HERO_SOUL_ITEM_NAMES.get(hero_id, "Linh Hồn %s" % _hero_name(hero_id)))


func _format_number(value: float) -> String:
	return str(roundi(value)) if is_equal_approx(value, roundf(value)) else "%.1f" % value
