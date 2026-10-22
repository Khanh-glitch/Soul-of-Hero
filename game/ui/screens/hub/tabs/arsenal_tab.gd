extends VBoxContainer

const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const HERO_SOUL_MANAGER := preload("res://game/heroes/hero_soul_manager.gd")
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const SOUL_COMBAT := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const HERO_SKILL_KITS := preload("res://game/meta/hero_souls/hero_skill_kit_rules.gd")
const AUX := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUX_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const TEXT_SCENE := preload("res://game/ui/screens/hub/tabs/components/arsenal_runtime_text.tscn")
const ACTION_BUTTON_SCENE := preload("res://game/ui/screens/hub/tabs/components/arsenal_action_button.tscn")
const DATA_ROW_SCENE := preload("res://game/ui/screens/hub/tabs/components/arsenal_data_row.tscn")
const DATA_STACK_SCENE := preload("res://game/ui/screens/hub/tabs/components/arsenal_data_stack.tscn")
const AUX_ITEM_ICON_SCENE := preload("res://game/ui/screens/hub/tabs/components/arsenal_aux_item_icon.tscn")
const HERO_DEFINITIONS := {
	"sword_hero": preload("res://game/heroes/data/sword_hero.tres"),
	"archer_hero": preload("res://game/heroes/data/archer_hero.tres"),
	"axe_hero": preload("res://game/heroes/data/axe_hero.tres"),
	"wizard_hero": preload("res://game/heroes/data/wizard_hero.tres"),
}

const STAT_NAMES := {"hp": "HP", "mana": "Mana", "damage": "POWER"}
const TRACK_NAMES := {
	"normal_attack": "ĐÒN ĐÁNH THƯỜNG", "active_skill": "KỸ NĂNG CHỦ ĐỘNG", "dash": "LƯỚT",
	"soul_ready_condition": "ĐIỀU KIỆN SẴN SÀNG", "summon_skill": "TRIỆU HỒI", "departure_skill": "RỜI SÂN",
}
const RARITY_COLORS := [
	Color("e8edf2"), Color("4f8dff"), Color("ffd84a"), Color("a96cff"),
	Color("ff8a32"), Color("38c8ff"), Color("ed4b55"), Color("35e5a1"),
]
const LIVE_AUXILIARY_EFFECT_IDS := [
	"max_hp_percent", "barrier_capacity_percent", "armor_power_percent", "armor_mana_percent", "health_regen", "healing_received",
	"movement_speed_percent", "dodge_chance_percent", "dash_cooldown_rate",
	"dash_speed_percent", "boots_power_percent", "max_hp_from_boots_percent",
	"damage_percent", "mana_percent", "mana_regen", "cooldown_rate", "mana_efficiency",
]
var _save: Node
var _selected_soul_id := ""
var _selected_skill_hero_id := ""
var _selected_equipment_hero_id := ""
var _fusion_ids: Array[String] = []
var _status: Label
var _tabs: TabContainer
var _stats_list: VBoxContainer
var _skills_list: VBoxContainer
var _team_list: VBoxContainer
var _soul_list: VBoxContainer
var _soul_detail: VBoxContainer
var _fusion_button: Button
var _aux_list: VBoxContainer
var _stat_reallocation_active := false
var _stat_reallocation_draft: Dictionary = {}


func _ready() -> void:
	_save = get_node_or_null("/root/SaveService")
	_build_ui()
	if _save != null and _save.has_signal("save_committed"):
		_save.save_committed.connect(func(_snapshot: Dictionary) -> void: _refresh())
	_refresh()


func _build_ui() -> void:
	_status = %PlayerSummary
	_tabs = %RosterTabs
	_stats_list = %StatsList
	_skills_list = %SkillsList
	_team_list = %SoulTeamSummary
	_soul_list = %SoulInventoryList
	_soul_detail = %SoulDetail
	_aux_list = %AuxList
	_tabs.set_tab_title(0, "THƯ VIỆN TƯỚNG")
	_tabs.set_tab_title(1, "ĐỘI HÌNH & HERO WEAPON")
	_tabs.set_tab_title(2, "CHỈ SỐ")
	_tabs.set_tab_title(3, "KỸ NĂNG")
	_tabs.set_tab_title(4, "TRANG BỊ HERO")
	_tabs.current_tab = 0


func _refresh() -> void:
	if _save == null or not _save.has_method("get_player_progression_snapshot"):
		_status.text = "SAVE API KHÔNG KHẢ DỤNG • CHỈ ĐỌC"
		return
	var snapshot: Dictionary = _save.get_player_progression_snapshot()
	var full_snapshot := _full_save_snapshot()
	var level := int(snapshot.get("player_level", 1))
	var xp := int(snapshot.get("xp", 0))
	var gold := int(_save.get_value(_path("currencies", "account"), 0))
	_status.text = "CẤP %d  •  XP %d  •  %d VÀNG" % [level, xp, gold]
	_refresh_stats(snapshot, full_snapshot, level)
	_refresh_skills(snapshot, level, gold)
	_refresh_souls(level, gold, full_snapshot)
	_refresh_aux(level)


func _refresh_stats(snapshot: Dictionary, full_snapshot: Dictionary, level: int) -> void:
	_clear(_stats_list)
	var stats: Dictionary = snapshot.get("stats", {})
	var active_hero_id := _active_hero_id(full_snapshot)
	var hero := _hero_definition_for_id(active_hero_id)
	var projection := _project_hero(full_snapshot, active_hero_id)
	if hero == null or projection.is_empty():
		_stats_list.add_child(_label(
			"CHỈ SỐ HIỆU DỤNG  •  KHÔNG THỂ ĐỌC HERO/SAVE  •  CHỈ ĐỌC",
			11,
			Color("d6aa72")
		))
		return
	var formula_version := int(projection.get("formula_version", 0))
	_stats_list.add_child(_label(
		"CHỈ SỐ HIỆU DỤNG  •  %s  •  CẤP %d  •  CÒN %d ĐIỂM" % [
			_identity_name(active_hero_id),
			level,
			int(stats.get("unspent_points", 0)),
		],
		11,
		Color("7ed7ff")
	))
	var allocation: Dictionary = stats.get("allocation", {})
	var stat_economy_value: Variant = snapshot.get("stat_economy", {})
	var stat_economy := (
		stat_economy_value as Dictionary if stat_economy_value is Dictionary else {}
	)
	var free_reallocation_credits := int(stat_economy.get("free_reallocation_credits", 0))
	if _stat_reallocation_active and free_reallocation_credits < 1:
		_stat_reallocation_active = false
		_stat_reallocation_draft.clear()
	if _stat_reallocation_active:
		_render_stat_reallocation(allocation, level)
		return
	var damage_preview_value: Variant = projection.get("damage_preview", {})
	var damage_preview := (
		damage_preview_value as Dictionary
		if damage_preview_value is Dictionary
		else {}
	)
	var effective_summary := _label(
		"HP %s  •  MANA %s  •  POWER %s\nĐÒN CƠ BẢN / VŨ KHÍ %d  •  KHOẢNG %d–%d  •  CÔNG THỨC V%d" % [
			_number_copy(float(projection.get("hp", 0.0))),
			_number_copy(float(projection.get("mana", 0.0))),
			_number_copy(float(projection.get("character_damage", 0.0))),
			int(damage_preview.get("expected_damage", 0)),
			int(damage_preview.get("minimum_damage", 0)),
			int(damage_preview.get("maximum_damage", 0)),
			formula_version,
		],
		10,
		Color("9fd7ba")
	)
	effective_summary.name = "EffectiveCombatSummary"
	_stats_list.add_child(effective_summary)
	for stat_id: String in ["hp", "mana", "damage"]:
		var row := _data_row()
		var points := int(allocation.get(stat_id, 0))
		var value := _effective_stat_value(projection, stat_id)
		var can_allocate := int(stats.get("unspent_points", 0)) > 0 and points < 200
		var next_copy := "KHÔNG KHẢ DỤNG"
		if can_allocate:
			var next_projection := _next_stat_projection(
				full_snapshot,
				hero,
				StringName(stat_id)
			)
			if not next_projection.is_empty():
				var delta := _effective_stat_value(next_projection, stat_id) - value
				next_copy = _signed_number_copy(delta)
				if stat_id == "damage":
					next_copy += "  •  ĐÒN %s" % _signed_number_copy(
						float(next_projection.get("damage", 0.0))
						- float(projection.get("damage", 0.0))
					)
		var info := _label(
			"%s  %d/200   •   HIỆN TẠI %s   •   ĐIỂM TIẾP %s" % [
				STAT_NAMES[stat_id],
				points,
				_number_copy(value),
				next_copy,
			],
			10
		)
		info.name = "EffectiveStat%s" % stat_id.to_pascal_case()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		var add := _action_button()
		add.text = "+1"
		add.custom_minimum_size = Vector2(54, 30)
		add.disabled = not can_allocate
		add.tooltip_text = "Không còn điểm hoặc chỉ số đã đạt tối đa" if add.disabled else "Cộng vĩnh viễn 1 điểm chỉ số"
		add.pressed.connect(_allocate_stat.bind(StringName(stat_id)))
		row.add_child(add)
		_stats_list.add_child(row)
	if free_reallocation_credits > 0:
		var reallocate := _action_button()
		reallocate.name = "FreeStatReallocationButton"
		reallocate.text = "PHÂN BỔ LẠI STAT • MIỄN PHÍ 1 LẦN"
		reallocate.tooltip_text = "Build hiện tại vẫn được giữ cho tới khi xác nhận allocation mới."
		reallocate.pressed.connect(_begin_stat_reallocation.bind(allocation))
		_stats_list.add_child(reallocate)


func _render_stat_reallocation(current_allocation: Dictionary, level: int) -> void:
	if _stat_reallocation_draft.is_empty():
		_stat_reallocation_draft = current_allocation.duplicate(true)
	var earned := PROGRESSION.earned_stat_points(level)
	var assigned := 0
	for stat_id: String in ["hp", "mana", "damage"]:
		assigned += int(_stat_reallocation_draft.get(stat_id, 0))
	var remaining := maxi(0, earned - assigned)
	_stats_list.add_child(_label(
		"PHÂN BỔ LẠI ATOMIC  •  ĐÃ DÙNG %d/%d  •  CÒN %d" % [assigned, earned, remaining],
		10,
		Color("f2cf74")
	))
	for stat_id: String in ["hp", "mana", "damage"]:
		var row := _data_row()
		var points := int(_stat_reallocation_draft.get(stat_id, 0))
		var info := _label("%s  %d/200" % [STAT_NAMES[stat_id], points], 10)
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		for delta: int in [-10, -1, 1, 10]:
			var adjust := _action_button()
			adjust.text = "%+d" % delta
			adjust.custom_minimum_size = Vector2(48, 30)
			adjust.disabled = points <= 0 if delta < 0 else remaining <= 0 or points >= 200
			adjust.pressed.connect(_adjust_stat_reallocation.bind(stat_id, delta, earned))
			row.add_child(adjust)
		_stats_list.add_child(row)
	var actions := _data_row()
	var cancel := _action_button()
	cancel.text = "HỦY"
	cancel.pressed.connect(_cancel_stat_reallocation)
	actions.add_child(cancel)
	var confirm := _action_button()
	confirm.name = "ConfirmStatReallocationButton"
	confirm.text = "XÁC NHẬN PHÂN BỔ"
	confirm.disabled = _stat_reallocation_draft == current_allocation
	confirm.pressed.connect(_confirm_stat_reallocation)
	actions.add_child(confirm)
	_stats_list.add_child(actions)


func _begin_stat_reallocation(allocation: Dictionary) -> void:
	_stat_reallocation_draft = allocation.duplicate(true)
	_stat_reallocation_active = true
	_refresh()


func _adjust_stat_reallocation(stat_id: String, delta: int, earned: int) -> void:
	if not _stat_reallocation_active or stat_id not in ["hp", "mana", "damage"]:
		return
	var assigned := 0
	for key: String in ["hp", "mana", "damage"]:
		assigned += int(_stat_reallocation_draft.get(key, 0))
	var current := int(_stat_reallocation_draft.get(stat_id, 0))
	var actual_delta := delta
	if delta > 0:
		actual_delta = mini(delta, mini(earned - assigned, 200 - current))
	else:
		actual_delta = -mini(-delta, current)
	if actual_delta == 0:
		return
	_stat_reallocation_draft[stat_id] = current + actual_delta
	_refresh()


func _cancel_stat_reallocation() -> void:
	_stat_reallocation_active = false
	_stat_reallocation_draft.clear()
	_refresh()


func _confirm_stat_reallocation() -> void:
	if not _stat_reallocation_active or _save == null \
			or not _save.has_method(&"reallocate_player_stats"):
		return
	var replacement := _stat_reallocation_draft.duplicate(true)
	# Clear before the synchronous save signal refreshes the tab. Restore draft
	# mode only when the atomic transaction is rejected.
	_stat_reallocation_active = false
	var ok := bool(_save.call(
		&"reallocate_player_stats",
		replacement,
		true,
		_key("ui_stat_reallocation"),
	))
	if ok:
		_stat_reallocation_draft.clear()
	else:
		_stat_reallocation_active = true
	_commit(
		ok,
		"Đã áp dụng phân bổ HP / Mana / Power mới.",
		"Không thể phân bổ lại; allocation cũ vẫn được giữ nguyên.",
	)


func _refresh_skills(snapshot: Dictionary, level: int, gold: int) -> void:
	_clear(_skills_list)
	var skill_allocation_unlocked := bool(
		_save.get_value(_path("progression", "features"), {}).get("skill_allocation", false)
	)
	var skill_respec_unlocked := bool(
		_save.get_value(_path("progression", "features"), {}).get("skill_respec", false)
	)
	var skills: Dictionary = snapshot.get("skills", {})
	var allocations: Dictionary = skills.get("allocations", {})
	var owned_heroes := _owned_skill_hero_ids()
	var team: Dictionary = _save.get_value(_path("soul_team"), {})
	var active_hero_id := String(team.get("active_hero", "sword_hero"))
	if _selected_skill_hero_id not in owned_heroes:
		_selected_skill_hero_id = active_hero_id if active_hero_id in owned_heroes else String(owned_heroes[0])
	var tracks: Dictionary = allocations.get(_selected_skill_hero_id, PROGRESSION.empty_skill_tracks())
	var gate := int(skills.get("rank_gate", 1))
	var selector := _data_row()
	selector.name = "SkillIdentitySelector"
	selector.add_theme_constant_override("separation", 5)
	for hero_id: String in ["sword_hero", "archer_hero", "axe_hero", "wizard_hero"]:
		var hero_button := _action_button()
		hero_button.name = "%sSkillIdentityButton" % hero_id.trim_suffix("_hero").to_pascal_case()
		hero_button.text = "%s%s" % [_identity_name(hero_id), " • ĐANG DÙNG" if hero_id == active_hero_id else ""]
		hero_button.toggle_mode = true
		hero_button.clip_text = true
		hero_button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		hero_button.custom_minimum_size.x = 96
		hero_button.button_pressed = hero_id == _selected_skill_hero_id
		hero_button.disabled = hero_id not in owned_heroes
		hero_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hero_button.tooltip_text = "Cần mở khóa Hero này." if hero_button.disabled else "Xem và nâng sáu nhánh kỹ năng riêng của %s." % _identity_name(hero_id)
		if not hero_button.disabled:
			hero_button.pressed.connect(_select_skill_identity.bind(hero_id))
		LivingArsenalIcons.apply_to_button(hero_button, _identity_icon(hero_id), 18)
		selector.add_child(hero_button)
	_skills_list.add_child(selector)
	var identity_name := _identity_name(_selected_skill_hero_id).to_upper()
	_skills_list.add_child(_label("%s  •  CÒN %d ĐIỂM  •  GIỚI HẠN BẬC %d" % [identity_name, int(skills.get("unspent_points", 0)), gate], 11, Color("7ed7ff")))
	_skills_list.add_child(_label("CẢ 6 NHÁNH ÁP DỤNG TỨC THÌ  •  Hero Weapon quyết định bộ chiêu và cấp từng kỹ năng.", 8, Color("91e6b3")))
	if not skill_allocation_unlocked:
		_skills_list.add_child(_label("CHƯA MỞ  •  Hoàn thành Ải 6 để cộng điểm kỹ năng.", 9, Color("d18a8a")))
	for track_id: StringName in PROGRESSION.SKILL_TRACK_IDS:
		var row := _data_row()
		var rank := int(tracks.get(String(track_id), 0))
		var info := _label("%s   BẬC %d / %d" % [TRACK_NAMES.get(String(track_id), String(track_id).to_upper()), rank, gate], 10)
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		var add := _action_button()
		add.text = "+1"
		add.custom_minimum_size = Vector2(54, 30)
		add.disabled = not skill_allocation_unlocked or rank >= gate or int(skills.get("unspent_points", 0)) < 1
		add.tooltip_text = "Cần hoàn thành Ải 6, còn điểm và chưa chạm giới hạn bậc." if add.disabled else "Tăng 1 bậc kỹ năng nền của %s." % identity_name.capitalize()
		add.pressed.connect(_allocate_skill.bind(StringName(_selected_skill_hero_id), track_id))
		row.add_child(add)
		_skills_list.add_child(row)
	var spent := 0
	for value: Variant in tracks.values(): spent += int(value)
	var respec := _action_button()
	var cost := PROGRESSION.respec_cost(level)
	respec.text = "ĐẶT LẠI %s • %s" % [identity_name, "MIỄN PHÍ" if cost == 0 else "%d VÀNG" % cost]
	respec.disabled = not skill_respec_unlocked or spent == 0 or gold < cost
	respec.tooltip_text = "Hoàn thành Ải 6; chỉ dùng tại Thánh Địa khi đã phân bổ bậc và đủ Vàng."
	respec.pressed.connect(_respec_skills.bind(StringName(_selected_skill_hero_id)))
	_skills_list.add_child(respec)


func _refresh_souls(level: int, gold: int, full_snapshot: Dictionary) -> void:
	_clear(_team_list)
	_clear(_soul_list)
	_clear(_soul_detail)
	var inventory: Array = _save.get_value(_path("inventory", "hero_souls"), [])
	_refresh_team(inventory)
	_soul_list.add_child(_label("TÚI ĐỒ  •  %d HERO WEAPON" % inventory.size(), 11, Color("7ed7ff")))
	for value: Variant in inventory:
		if not value is Dictionary: continue
		var soul := value as Dictionary
		var rarity := clampi(int(soul.get("rarity", 0)), 0, 7)
		var button := _action_button()
		button.text = "%s  (%s)" % [
			_soul_item_name(String(soul.get("hero_id", ""))),
			SOULS.rarity_display_name_vi(rarity).to_upper(),
		]
		button.toggle_mode = true
		button.button_pressed = String(soul.get("instance_id", "")) == _selected_soul_id
		button.add_theme_color_override("font_color", RARITY_COLORS[rarity])
		button.tooltip_text = "Chọn để xem đầy đủ thông số, thuộc tính và so sánh."
		button.pressed.connect(_select_soul.bind(String(soul.get("instance_id", ""))))
		_soul_list.add_child(button)
	if inventory.is_empty():
		_soul_list.add_child(_label("Chưa có Hero Weapon trong túi đồ; hãy kiểm tra Rương ở Home.", 9))
	var selected := _find_soul(inventory, _selected_soul_id)
	if selected.is_empty() and not inventory.is_empty() and inventory[0] is Dictionary:
		selected = inventory[0]
		_selected_soul_id = String(selected.get("instance_id", ""))
	_render_soul_detail(selected, inventory, level, gold, full_snapshot)


func _refresh_team(inventory: Array) -> void:
	var team: Dictionary = _save.get_value(_path("soul_team"), {})
	var active_id := String(team.get("active_hero", "sword_hero"))
	var reserves: Array = team.get("reserve_souls", [""])
	var reserve_one := String(reserves[0]) if reserves.size() > 0 else ""
	_team_list.add_child(_label(
		"CẶP HERO CỐ ĐỊNH KHI VÀO ẢI  •  CHỦ LỰC %s  •  DỰ BỊ %s" % [
			_identity_name(active_id),
			_identity_name(reserve_one) if not reserve_one.is_empty() else "TRỐNG",
		],
		9,
		Color("7ed7ff"),
		true
	))
	var unlocked: Dictionary = _save.get_value(_path("progression", "unlocked_heroes"), {})
	var cards := _data_row()
	cards.name = "IdentityCards"
	cards.add_theme_constant_override("separation", 5)
	_team_list.add_child(cards)
	for hero_id: String in ["sword_hero", "archer_hero", "axe_hero", "wizard_hero"]:
		var owned := _souls_for_hero(inventory, hero_id)
		var role := _team_role(hero_id, active_id, reserves)
		var card := _action_button()
		card.name = "%sIdentityButton" % hero_id.trim_suffix("_hero").to_pascal_case()
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		card.custom_minimum_size = Vector2(120, 38)
		card.clip_text = true
		card.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		var shards := int(_save.call(&"get_hero_shards", StringName(hero_id))) \
			if _save.has_method(&"get_hero_shards") else 0
		if owned.is_empty() and not bool(unlocked.get(hero_id, false)) \
				and hero_id in ["archer_hero", "wizard_hero"]:
			card.text = "%s - CHUA MO\nMANH %d / 50" % [_identity_name(hero_id), shards]
			card.disabled = shards < 50
			card.tooltip_text = "Can 50 manh de mo khoa Hero. Khi mo se duoc cap Hero Weapon Normal neu tui va kho chua co vu khi cua Hero nay."
			if shards >= 50:
				card.pressed.connect(_unlock_hero_from_shards.bind(hero_id))
		elif owned.is_empty():
			var lock_copy := "CHƯA MỞ" if not bool(unlocked.get(hero_id, false)) else "HERO WEAPON ĐANG Ở RƯƠNG / CHƯA NHẬN"
			var source_copy := "RƯƠNG HOME / PHẦN THƯỞNG CHỜ"
			if hero_id == "axe_hero" and not bool(unlocked.get(hero_id, false)):
				source_copy = "CHỈ MỞ QUA CỐT TRUYỆN"
			card.text = "%s  •  %s\n0 HERO WEAPON TRONG TÚI  •  %s" % [_identity_name(hero_id), lock_copy, source_copy]
			card.disabled = true
			card.tooltip_text = (
				"Cung Thủ và Pháp Sư cần đủ 50 mảnh để mở; mỗi Boss tương ứng chỉ thưởng 10 mảnh."
				if hero_id in ["archer_hero", "wizard_hero"]
				else ("Chiến binh Rìu không rơi mảnh và chỉ mở qua cốt truyện." if hero_id == "axe_hero" else "Hãy chuyển Hero Weapon từ Rương Home vào túi.")
			)
			if hero_id == "wizard_hero":
				card.tooltip_text = "Boss Pháp Sư cho 10 mảnh; cần đủ 50 mảnh để mở khóa Hero."
		else:
			var best := _best_soul(owned)
			var rarity := clampi(int(best.get("rarity", 0)), 0, SOULS.RARITY_NAMES.size() - 1)
			card.text = "%s  •  %s\n%d HERO WEAPON  •  CAO NHẤT %s" % [_identity_name(hero_id), _team_role_copy(role), owned.size(), SOULS.rarity_display_name_vi(rarity).to_upper()]
			card.add_theme_color_override("font_color", RARITY_COLORS[rarity])
			card.tooltip_text = "Chọn Hero Weapon tốt nhất đang có trong túi của %s." % _identity_name(hero_id)
			card.pressed.connect(_select_soul.bind(String(best.get("instance_id", ""))))
		LivingArsenalIcons.apply_to_button(card, _identity_icon(hero_id), 18)
		cards.add_child(card)


func _unlock_hero_from_shards(hero_id: String) -> void:
	if _save == null or not _save.has_method(&"unlock_hero_with_shards"):
		return
	var key := "arsenal:shard_unlock:%s:%d" % [hero_id, Time.get_ticks_usec()]
	if bool(_save.call(&"unlock_hero_with_shards", StringName(hero_id), key)):
		GameEvents.toast_requested.emit("Da mo khoa %s va cap Hero Weapon co ban." % _identity_name(hero_id))
	else:
		GameEvents.toast_requested.emit("Chua du 50 manh de mo khoa Hero nay.")


func _render_soul_detail(
		soul: Dictionary,
		inventory: Array,
		_level: int,
		gold: int,
		full_snapshot: Dictionary
) -> void:
	if soul.is_empty():
		_soul_detail.add_child(_label("CHỌN MỘT HERO WEAPON", 11))
		return
	var rarity := clampi(int(soul.get("rarity", 0)), 0, 7)
	var hero_id := String(soul.get("hero_id", ""))
	_soul_detail.add_child(_label("%s  (%s)" % [_soul_item_name(hero_id), SOULS.rarity_display_name_vi(rarity).to_upper()], 14, RARITY_COLORS[rarity], false))
	_soul_detail.add_child(_label("CẤP VẬT PHẨM %d  •  HỆ %s\nMÃ %s" % [int(soul.get("item_level", 1)), _affinity_copy(String(soul.get("affinity", "warrior"))), String(soul.get("instance_id", ""))], 8))
	_soul_detail.add_child(_label("SỨC MẠNH VŨ KHÍ  •  %.2f%% POWER NHÂN VẬT" % SOULS.weapon_damage_percent(rarity, int(soul.get("item_level", 1))), 10, Color("f2cf74"), false))
	var skill_ranks: Dictionary = soul.get("skill_ranks", {}) \
		if soul.get("skill_ranks", {}) is Dictionary else {}
	var kit := HERO_SKILL_KITS.kit_snapshot(StringName(hero_id), rarity, skill_ranks)
	var first_skill: Dictionary = kit.get("active_1", {})
	var second_skill: Dictionary = kit.get("active_2", {})
	_soul_detail.add_child(_label(
		"BỘ CHIÊU %s  •  %s BẬC %d (x%.2f)  •  %s BẬC %d (x%.2f)" % [
			_skill_kit_tier_name(String(kit.get("kit_id", "basic"))),
			String(first_skill.get("name", "Kỹ năng 1")), int(skill_ranks.get("active_1", 1)),
			HERO_SKILL_KITS.effective_skill_multiplier(rarity, int(skill_ranks.get("active_1", 1))),
			String(second_skill.get("name", "Kỹ năng 2")), int(skill_ranks.get("active_2", 1)),
			HERO_SKILL_KITS.effective_skill_multiplier(rarity, int(skill_ranks.get("active_2", 1))),
		],
		9, Color("c7a7ff"), false,
	))
	if String(kit.get("kit_id", "")) == "legendary_plus":
		var passive: Dictionary = kit.get("passive", {})
		var soul_skill: Dictionary = kit.get("soul", {})
		var departure: Dictionary = kit.get("departure", {})
		_soul_detail.add_child(_label(
			"LEGENDARY+  •  NỘI TẠI %s  •  SOUL %s  •  RỜI SÂN %s" % [
				String(passive.get("id", "—")).replace("_", " ").to_upper(),
				String(soul_skill.get("name", "—")),
				String(departure.get("name", "—")),
			],
			8, Color("f0cf78"), false,
		))
	var team: Dictionary = _save.get_value(_path("soul_team"), {})
	var reserves: Array = team.get("reserve_souls", [""])
	var role := _team_role(hero_id, String(team.get("active_hero", "sword_hero")), reserves)
	var selections: Dictionary = team.get("selected_soul_instances", {})
	var is_selected_copy := String(selections.get(hero_id, "")) == String(soul.get("instance_id", ""))
	var is_live_in_team := is_selected_copy and role != "BENCH"
	_soul_detail.add_child(_label("VỊ TRÍ TRONG ĐỘI  •  %s" % _team_role_copy(role), 9, Color("72dce4"), false))
	_soul_detail.add_child(_label(
		"TRẠNG THÁI BẢN SAO  •  %s" % (
			"ĐANG ÁP DỤNG TRONG ĐỘI"
			if is_live_in_team
			else ("ĐÃ CHỌN (TRONG KHO)" if is_selected_copy else "CHƯA CHỌN")
		),
		9,
		Color("91e6b3") if is_selected_copy else Color("a99bb2"),
		false
	))
	var protection := _protection_copy(soul, inventory)
	_soul_detail.add_child(_label("BẢO VỆ  •  %s" % protection, 9, Color("f0cf78") if protection != "KHÔNG" else Color("8f8998"), false))
	var team_actions := _data_row()
	team_actions.name = "TeamActions"
	var active := _action_button()
	active.text = "BẢN SAO CHỦ LỰC" if role == "ACTIVE" and is_selected_copy else ("DÙNG BẢN SAO NÀY" if role == "ACTIVE" else "ĐẶT LÀM CHỦ LỰC")
	active.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	active.disabled = (role == "ACTIVE" and is_selected_copy) or not _save.has_method("set_soul_team_instances")
	active.tooltip_text = "Trang bị đúng Hero Weapon này và đặt Hero làm chủ lực."
	active.pressed.connect(_assign_selected_team.bind(&"active"))
	team_actions.add_child(active)
	var reserve := _action_button()
	reserve.text = "HERO WEAPON DỰ BỊ" if role == "RESERVE" and is_selected_copy else ("DÙNG INSTANCE NÀY" if role == "RESERVE" else "ĐẶT LÀM DỰ BỊ")
	reserve.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	reserve.disabled = role == "ACTIVE" or (role == "RESERVE" and is_selected_copy) or not _save.has_method("set_soul_team_instances")
	reserve.tooltip_text = "Trang bị đúng Hero Weapon này và đặt Hero làm dự bị."
	reserve.pressed.connect(_assign_selected_team.bind(&"reserve_one"))
	team_actions.add_child(reserve)
	_soul_detail.add_child(team_actions)
	var equip_copy := _action_button()
	equip_copy.text = "BẢN SAO ĐÃ CHỌN" if is_selected_copy else "CHỌN BẢN SAO NÀY"
	equip_copy.disabled = is_selected_copy or not _save.has_method("select_hero_soul_instance")
	equip_copy.tooltip_text = "Chọn đúng bản sao này cho nhân vật mà không đổi vị trí trong đội."
	equip_copy.pressed.connect(_equip_selected_soul_copy)
	_soul_detail.add_child(equip_copy)
	var affixes: Array = soul.get("affixes", [])
	_soul_detail.add_child(_label("THUỘC TÍNH %d / %d" % [affixes.size(), SOULS.AFFIX_SLOT_COUNTS[rarity]], 10, Color("d8c3eb")))
	if affixes.is_empty():
		_soul_detail.add_child(_label("Độ hiếm này chưa có ô thuộc tính.", 9, Color("91899a")))
	for raw: Variant in affixes:
		if raw is Dictionary:
			var affix := raw as Dictionary
			var affix_id := String(affix.get("affix_id", ""))
			var affix_value := float(affix.get("value", 0.0))
			var live_status := (
				"ĐANG ÁP DỤNG"
				if is_live_in_team
				else ("ĐÃ CHỌN / TRONG KHO" if is_selected_copy else "CHƯA ÁP DỤNG")
			)
			if not SOUL_COMBAT.is_live_affix(affix_id):
				live_status = "CHƯA KÍCH HOẠT"
			var tier := int(affix.get("tier", SOULS.affix_tier_for_rarity(rarity)))
			var display := SOULS.affix_display_metadata(affix_id, affix_value, tier)
			_soul_detail.add_child(_label(
				"• [%s] %s\n  %s  •  %s" % [
					String(display.get("tier_display_name", "")),
					String(display.get("description", "")),
					live_status,
					"Khoảng cuộn %.2f–%.2f" % [float(affix.get("roll_min", affix_value)), float(affix.get("roll_max", affix_value))],
				],
				9,
				Color("91e6b3") if live_status == "ĐANG ÁP DỤNG" else Color("c8c3cf")
			))
	var equipped := _find_soul(inventory, String(selections.get(hero_id, "")))
	var comparison := _label(
		_comparison_copy(soul, equipped, full_snapshot),
		9,
		Color("9fd7ba")
	)
	comparison.name = "SoulCombatComparison"
	_soul_detail.add_child(comparison)
	var protected := protection != "KHÔNG"
	var features: Dictionary = _save.get_value(_path("progression", "features"), {})
	var sell_unlocked := bool(features.get("hero_soul_sell", false))
	var fusion_unlocked := bool(features.get("hero_soul_fusion", false))
	var sell := _action_button()
	sell.text = "BÁN  •  %d VÀNG" % SOULS.sell_value(soul)
	sell.disabled = not sell_unlocked or protected
	sell.tooltip_text = "Hoàn thành Ải 8 để mở chức năng bán Hero Weapon." if not sell_unlocked else ("Không thể bán vật phẩm đang dùng, yêu thích hoặc đã khóa." if protected else "Bán đúng instance này.")
	sell.pressed.connect(_sell_selected)
	_soul_detail.add_child(sell)
	var toggle_fusion := _action_button()
	var included := _fusion_ids.has(_selected_soul_id)
	toggle_fusion.text = "BỎ KHỎI GHÉP" if included else "THÊM VÀO GHÉP"
	toggle_fusion.disabled = not fusion_unlocked or protected or rarity >= SOULS.Rarity.ETERNAL
	toggle_fusion.tooltip_text = "Hoàn thành Ải 10 để mở ghép Hero Weapon." if not fusion_unlocked else "Không thể ghép Hero Weapon đang được bảo vệ hoặc thuộc độ hiếm Vĩnh hằng."
	toggle_fusion.pressed.connect(_toggle_fusion_selected)
	_soul_detail.add_child(toggle_fusion)
	_fusion_button = _action_button()
	var inputs := _fusion_inputs(inventory)
	var errors := SOULS.fusion_errors(inputs) if inputs.size() == 3 else PackedStringArray(["Chọn đúng 3 Hero Weapon cùng Hero."])
	var cost := SOULS.fusion_cost_for_inputs(inputs) if errors.is_empty() else 0
	_fusion_button.text = "GHÉP %d/3%s" % [_fusion_ids.size(), " • %d VÀNG" % cost if cost > 0 else ""]
	_fusion_button.disabled = not fusion_unlocked or not errors.is_empty() or gold < cost
	_fusion_button.tooltip_text = (
		"Hoàn thành Ải 10 để mở ghép Hero Weapon."
		if not fusion_unlocked
		else ("Sẵn sàng: chắc chắn tăng 1 bậc hiếm." if not _fusion_button.disabled else ("Chọn đúng 3 Hero Weapon cùng Hero và cùng độ hiếm." if not errors.is_empty() else "Không đủ Vàng."))
	)
	_fusion_button.pressed.connect(_fuse_selected)
	_soul_detail.add_child(_fusion_button)


func _refresh_aux(level: int) -> void:
	_clear(_aux_list)
	_aux_list.add_child(_label("4 Ô RIÊNG MỖI HERO  •  HERO WEAPON  •  GIÁP  •  GIÀY  •  TRANG SỨC", 11, Color("7ed7ff")))
	var inventory: Dictionary = _save.get_value(_path("inventory"), {})
	var gear: Array = inventory.get("auxiliary_equipment", inventory.get("auxiliary_items", []))
	var hero_weapons: Array = inventory.get("hero_souls", []) \
		if inventory.get("hero_souls", []) is Array else []
	var unlocked_heroes := _owned_skill_hero_ids()
	var team: Dictionary = _save.get_value(_path("soul_team"), {})
	if unlocked_heroes.is_empty():
		_aux_list.add_child(_label("CHƯA CÓ HERO ĐỂ XẾP TRANG BỊ", 10, Color("d6aa72")))
		return
	if _selected_equipment_hero_id not in unlocked_heroes:
		var active_id := String(team.get("active_hero", "sword_hero"))
		_selected_equipment_hero_id = active_id if active_id in unlocked_heroes else unlocked_heroes[0]
	var selected_hero_level := level
	if _save.has_method("get_hero_progression_snapshot"):
		var hero_progression: Dictionary = _save.call(
			"get_hero_progression_snapshot",
			StringName(_selected_equipment_hero_id),
		)
		selected_hero_level = int(hero_progression.get("level", level))
	var selector := _data_row()
	selector.name = "EquipmentHeroSelector"
	for hero_id: String in unlocked_heroes:
		var hero_button := _action_button()
		hero_button.text = _identity_name(hero_id)
		hero_button.toggle_mode = true
		hero_button.button_pressed = hero_id == _selected_equipment_hero_id
		hero_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hero_button.pressed.connect(_select_equipment_hero.bind(hero_id))
		LivingArsenalIcons.apply_to_button(hero_button, _identity_icon(hero_id), 18)
		selector.add_child(hero_button)
	_aux_list.add_child(selector)
	_aux_list.add_child(_label(
		"ĐANG XẾP TRANG BỊ CHO %s  •  MỖI INSTANCE CHỈ THUỘC MỘT HERO" % _identity_name(_selected_equipment_hero_id),
		9, Color("91e6b3"),
	))
	var all_loadouts: Dictionary = _save.get_value(_path("hero_loadouts"), {})
	var loadout: Dictionary = all_loadouts.get(_selected_equipment_hero_id, {})
	var supports_mutation := _save.has_method("equip_hero_item") \
		and _save.has_method("sell_auxiliary_equipment") \
		and _save.has_method("set_auxiliary_equipment_favorite") \
		and _save.has_method("set_auxiliary_equipment_locked")
	var selections: Dictionary = team.get("selected_soul_instances", {}) \
		if team.get("selected_soul_instances", {}) is Dictionary else {}
	var equipped_weapon_id := String(loadout.get(
		"hero_weapon",
		selections.get(_selected_equipment_hero_id, ""),
	))
	var weapon_candidates: Array[Dictionary] = []
	for raw_weapon: Variant in hero_weapons:
		if raw_weapon is Dictionary \
				and String((raw_weapon as Dictionary).get("hero_id", "")) == _selected_equipment_hero_id:
			weapon_candidates.append(raw_weapon as Dictionary)
	_aux_list.add_child(_label(
		"HERO WEAPON  •  %s" % (
			"ĐANG TRỐNG"
			if equipped_weapon_id.is_empty()
			else "ĐANG DÙNG %s" % equipped_weapon_id.left(8)
		),
		11,
		Color("a8e6b0"),
	))
	if weapon_candidates.is_empty():
		_aux_list.add_child(_label(
			"Không có Hero Weapon phù hợp trong túi; kiểm tra Rương Home.",
			8,
			Color("827b88"),
		))
	else:
		for weapon: Dictionary in weapon_candidates:
			var instance_id := String(weapon.get("instance_id", ""))
			var rarity := clampi(int(weapon.get("rarity", 0)), 0, 7)
			var row := _data_row()
			var summary := _label(
				"%s  •  CẤP %d  •  %d THUỘC TÍNH" % [
					SOULS.rarity_display_name_vi(rarity).to_upper(),
					int(weapon.get("item_level", 1)),
					(weapon.get("affixes", []) as Array).size()
						if weapon.get("affixes", []) is Array else 0,
				],
				9,
				RARITY_COLORS[rarity],
			)
			summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(summary)
			var equip_weapon := _action_button()
			var is_equipped_weapon := instance_id == equipped_weapon_id
			equip_weapon.text = "ĐANG DÙNG" if is_equipped_weapon else "TRANG BỊ"
			equip_weapon.disabled = is_equipped_weapon or not _save.has_method("equip_hero_item")
			equip_weapon.pressed.connect(_equip_weapon_for_selected_hero.bind(instance_id))
			row.add_child(equip_weapon)
			_aux_list.add_child(row)
	for slot_id: String in AUX.SLOT_IDS:
		var hero_slot := _hero_loadout_slot(slot_id)
		var unlock := AUX.unlock_level(slot_id)
		var unlocked := selected_hero_level >= unlock
		_aux_list.add_child(_label("%s  •  %s" % [_aux_slot_name(slot_id), "ĐÃ MỞ" if unlocked else "MỞ Ở CẤP %d" % unlock], 11, Color("a8e6b0") if unlocked else Color("a77f86")))
		var slot_items: Array[Dictionary] = []
		for raw: Variant in gear:
			if raw is Dictionary and String((raw as Dictionary).get("slot", "")) == slot_id:
				slot_items.append(raw as Dictionary)
		var equipped_uuid := String(loadout.get(hero_slot, ""))
		_aux_list.add_child(_label("Đang có %d  •  %s" % [slot_items.size(), "ĐANG TRỐNG" if equipped_uuid.is_empty() else "ĐANG DÙNG %s" % equipped_uuid.left(8)], 8, Color("a99bb2")))
		if slot_items.is_empty():
			_aux_list.add_child(_label("Chưa có vật phẩm cho ô này.", 8, Color("827b88")))
			continue
		for item: Dictionary in slot_items:
			var uuid := String(item.get("uuid", ""))
			var is_equipped := uuid == equipped_uuid
			var worn_by := _hero_wearing_item(all_loadouts, uuid)
			var equipped_elsewhere := not worn_by.is_empty() and worn_by != _selected_equipment_hero_id
			var protected := bool(item.get("favorite", false)) or bool(item.get("locked", false))
			var presentation := AUX_PRESENTATION.presentation_for(item)
			var rarity_index := clampi(AUX.rarity_index(String(item.get("rarity", "normal"))), 0, 7)
			var item_box := _data_stack()
			item_box.add_theme_constant_override("separation", 2)
			var visual_row := _data_row()
			visual_row.name = "AuxItemVisual_%s" % uuid.left(8)
			var icon := _aux_item_icon(presentation)
			visual_row.add_child(icon)
			var summary := _label(
				_aux_item_summary(item, is_equipped),
				8,
				RARITY_COLORS[rarity_index],
			)
			summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			visual_row.add_child(summary)
			item_box.add_child(visual_row)
			var actions := _data_row()
			var equip := _action_button()
			equip.text = "THÁO" if is_equipped else ("CHUYỂN TỪ %s" % _identity_name(worn_by) if equipped_elsewhere else "TRANG BỊ")
			equip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			equip.custom_minimum_size.x = 82.0
			equip.disabled = not supports_mutation or not unlocked
			equip.tooltip_text = "Instance này sẽ được chuyển sang %s và tự tháo khỏi Hero cũ." % _identity_name(_selected_equipment_hero_id)
			if is_equipped:
				equip.pressed.connect(_unequip_aux_for_hero.bind(StringName(hero_slot)))
			else:
				equip.pressed.connect(_equip_aux_for_hero.bind(StringName(hero_slot), uuid))
			actions.add_child(equip)
			var favorite := _action_button()
			favorite.text = "BỎ YÊU THÍCH" if bool(item.get("favorite", false)) else "YÊU THÍCH"
			favorite.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			favorite.custom_minimum_size.x = 96.0
			favorite.disabled = not supports_mutation
			favorite.pressed.connect(_set_aux_favorite.bind(uuid, not bool(item.get("favorite", false))))
			actions.add_child(favorite)
			var lock := _action_button()
			lock.text = "MỞ KHÓA" if bool(item.get("locked", false)) else "KHÓA"
			lock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			lock.custom_minimum_size.x = 72.0
			lock.disabled = not supports_mutation
			lock.pressed.connect(_set_aux_locked.bind(uuid, not bool(item.get("locked", false))))
			actions.add_child(lock)
			var sell := _action_button()
			sell.text = "BÁN %d" % AUX_RULES.sell_value(item)
			sell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			sell.custom_minimum_size.x = 72.0
			sell.disabled = not supports_mutation or not worn_by.is_empty() or protected
			sell.tooltip_text = "Không thể bán vật phẩm đang dùng, yêu thích hoặc đã khóa." if sell.disabled else "Bán đúng vật phẩm này để nhận Vàng."
			sell.pressed.connect(_sell_aux.bind(uuid))
			actions.add_child(sell)
			item_box.add_child(actions)
			_aux_list.add_child(item_box)
	_aux_list.add_child(_label("TRANG BỊ  •  YÊU THÍCH  •  KHÓA  •  BÁN đều được lưu theo từng instance.", 9, Color("8ecbb0") if supports_mutation else Color("d6aa72")))


func _aux_item_summary(item: Dictionary, is_equipped: bool) -> String:
	var primary: Dictionary = item.get("primary", {})
	var presentation := AUX_PRESENTATION.presentation_for(item)
	var upgrade_rank := int(item.get("upgrade_rank", 0))
	var upgrade_multiplier := AUX_RULES.upgrade_multiplier(item)
	var lines: Array[String] = ["%s%s  •  %s%s  •  CẤP VẬT PHẨM %d  •  %s +%s  •  %d THUỘC TÍNH" % [
		String(presentation.get(
			"display_name",
			AUX_PRESENTATION.slot_display_name(String(item.get("slot", ""))),
		)),
		" +%d" % upgrade_rank if upgrade_rank > 0 else "",
		RarityPalette.display_name(item.get("rarity", "normal")),
		" ★" if is_equipped else "",
		int(item.get("item_level", 1)),
		_aux_stat_name(String(primary.get("stat_id", "primary"))),
		_number_copy(float(primary.get("value", 0.0)) * upgrade_multiplier),
		(item.get("affixes", []) as Array).size(),
	]]
	for raw_affix: Variant in item.get("affixes", []):
		if not raw_affix is Dictionary:
			continue
		var affix := raw_affix as Dictionary
		var affix_id := String(affix.get("affix_id", ""))
		var status := (
			("ĐANG ÁP DỤNG" if is_equipped else "CHƯA ÁP DỤNG")
			if affix_id in LIVE_AUXILIARY_EFFECT_IDS
			else "CHƯA KÍCH HOẠT"
		)
		lines.append("  %s +%s • %s" % [
			_aux_stat_name(affix_id),
			_number_copy(float(affix.get("value", 0.0)) * upgrade_multiplier),
			status,
		])
	return "\n".join(lines)


func _aux_item_icon(presentation: Dictionary) -> TextureRect:
	var icon := AUX_ITEM_ICON_SCENE.instantiate() as TextureRect
	var icon_path := String(presentation.get("icon_path", ""))
	if ResourceLoader.exists(icon_path):
		icon.texture = load(icon_path) as Texture2D
	icon.tooltip_text = String(presentation.get("display_name", "Trang bị phụ"))
	return icon


func _allocate_stat(stat_id: StringName) -> void:
	_commit(_save.allocate_player_stat(stat_id, 1, _key("ui_stat_%s" % stat_id)), "Đã cộng 1 điểm chỉ số.", "Không thể cộng điểm; hãy kiểm tra điểm còn lại và giới hạn chỉ số.")


func _select_skill_identity(hero_id: String) -> void:
	_selected_skill_hero_id = hero_id
	_refresh()


func _select_equipment_hero(hero_id: String) -> void:
	_selected_equipment_hero_id = hero_id
	_refresh()


func _equip_weapon_for_selected_hero(instance_id: String) -> void:
	_commit(
		_save.has_method("equip_hero_item") and bool(_save.call(
			"equip_hero_item",
			StringName(_selected_equipment_hero_id),
			&"hero_weapon",
			instance_id,
			_key("ui_hero_weapon"),
		)),
		"Đã trang bị Hero Weapon cho %s." % _identity_name(_selected_equipment_hero_id),
		"Không thể trang bị; Hero Weapon phải thuộc đúng Hero và còn ở trong túi.",
	)


func _allocate_skill(hero_id: StringName, track_id: StringName) -> void:
	_commit(
		_save.allocate_hero_skill(hero_id, track_id, 1, _key("ui_skill_%s_%s" % [hero_id, track_id])),
		"Đã tăng 1 bậc kỹ năng cho %s." % _identity_name(String(hero_id)),
		"Không thể tăng bậc; hãy kiểm tra Hero đã mở và điểm còn lại."
	)


func _respec_skills(hero_id: StringName) -> void:
	_commit(
		_save.respec_hero_skills(hero_id, true, _key("ui_respec_%s" % hero_id)),
		"Đã đặt lại các bậc kỹ năng của %s." % _identity_name(String(hero_id)),
		"Không thể đặt lại; hãy kiểm tra bậc đã cộng và số Vàng."
	)


func _owned_skill_hero_ids() -> Array[String]:
	var owned: Array[String] = []
	var unlocked: Dictionary = _save.get_value(_path("progression", "unlocked_heroes"), {})
	for hero_id: String in ["sword_hero", "archer_hero", "axe_hero", "wizard_hero"]:
		if bool(unlocked.get(hero_id, false)):
			owned.append(hero_id)
	if owned.is_empty():
		# SaveService always restores the starter Sword Hero, but keeping this
		# fail-safe prevents a malformed development snapshot from crashing UI.
		owned.append("sword_hero")
	return owned


func _select_soul(instance_id: String) -> void:
	_selected_soul_id = instance_id
	_refresh()


func _assign_selected_team(destination: StringName) -> void:
	var inventory: Array = _save.get_value(_path("inventory", "hero_souls"), [])
	var selected := _find_soul(inventory, _selected_soul_id)
	if selected.is_empty():
		_commit(false, "", "Hãy chọn một Hero Weapon đang có trong túi trước.")
		return
	var hero_id := String(selected.get("hero_id", ""))
	var team: Dictionary = _save.get_value(_path("soul_team"), {})
	var active_id := String(team.get("active_hero", "sword_hero"))
	var raw_reserves: Array = team.get("reserve_souls", [""])
	var reserves: Array[StringName] = []
	reserves.append(StringName(String(raw_reserves[0]) if not raw_reserves.is_empty() else ""))
	if destination == &"active":
		var old_active := active_id
		var existing_index := reserves.find(StringName(hero_id))
		if existing_index >= 0:
			reserves[existing_index] = StringName(old_active)
		active_id = hero_id
	elif destination == &"reserve_one":
		if hero_id == active_id:
			_commit(false, "", "Nhân vật chủ lực không thể đồng thời nằm ở ô dự bị.")
			return
		reserves[0] = StringName(hero_id)
	else:
		_commit(false, "", "Vị trí trong cặp Hero không hợp lệ.")
		return
	var selections: Dictionary = team.get("selected_soul_instances", {}).duplicate(true)
	selections[hero_id] = _selected_soul_id
	var active_instance_id := _instance_id_for_hero(inventory, selections, active_id)
	if active_instance_id.is_empty():
		_commit(false, "", "Hero chủ lực chưa có Hero Weapon hợp lệ trong túi.")
		return
	var reserve_instance_ids: Array[String] = []
	for reserve_hero_id: StringName in reserves:
		if reserve_hero_id.is_empty():
			reserve_instance_ids.append("")
			continue
		var reserve_instance_id := _instance_id_for_hero(inventory, selections, String(reserve_hero_id))
		if reserve_instance_id.is_empty():
			_commit(false, "", "Hero dự bị chưa có Hero Weapon hợp lệ trong túi.")
			return
		reserve_instance_ids.append(reserve_instance_id)
	_commit(
		_save.set_soul_team_instances(active_instance_id, reserve_instance_ids, _key("ui_soul_team_exact")),
		"Đã cập nhật cặp Hero và Hero Weapon tương ứng.",
		"Không thể cập nhật đội; bản sao có thể đã bị khóa, bị thiếu hoặc đang ở vị trí khác."
	)


func _equip_selected_soul_copy() -> void:
	_commit(
		_save.select_hero_soul_instance(_selected_soul_id, _key("ui_soul_instance")),
		"Đã trang bị đúng Hero Weapon cho Hero.",
		"Không thể trang bị Hero Weapon; instance có thể không còn trong túi."
	)


func _sell_selected() -> void:
	_commit(_save.sell_hero_soul(_selected_soul_id, _key("ui_sell")), "Đã bán Hero Weapon.", "Không thể bán; Hero Weapon có thể đang được trang bị, bảo vệ hoặc là bản cuối cùng của Hero.")


func _toggle_fusion_selected() -> void:
	if _fusion_ids.has(_selected_soul_id): _fusion_ids.erase(_selected_soul_id)
	elif _fusion_ids.size() < 3: _fusion_ids.append(_selected_soul_id)
	_refresh()


func _fuse_selected() -> void:
	var ids := _fusion_ids.duplicate()
	var ok: bool = _save.fuse_hero_souls(ids, int(Time.get_ticks_usec()), _key("ui_fusion"))
	if ok: _fusion_ids.clear()
	_commit(ok, "Ghép thành công: độ hiếm tăng 1 bậc.", "Không thể ghép; hãy kiểm tra các Hero Weapon đã chọn và số Vàng.")


func _equip_aux_for_hero(slot_id: StringName, uuid: String) -> void:
	_commit(
		_save.equip_hero_item(
			StringName(_selected_equipment_hero_id), slot_id, uuid,
			_key("ui_hero_aux_equip"),
		),
		"Đã trang bị cho %s." % _identity_name(_selected_equipment_hero_id),
		"Không thể trang bị; hãy kiểm tra Hero, ô đồ và instance trong túi.",
	)


func _unequip_aux_for_hero(slot_id: StringName) -> void:
	_commit(
		_save.equip_hero_item(
			StringName(_selected_equipment_hero_id), slot_id, "",
			_key("ui_hero_aux_unequip"),
		),
		"Đã tháo trang bị khỏi %s." % _identity_name(_selected_equipment_hero_id),
		"Không thể tháo trang bị khỏi Hero này.",
	)


func _sell_aux(uuid: String) -> void:
	_commit(_save.sell_auxiliary_equipment(uuid, _key("ui_aux_sell")), "Đã bán vật phẩm và nhận Vàng.", "Không thể bán vật phẩm đang dùng hoặc được bảo vệ.")


func _set_aux_favorite(uuid: String, favorite: bool) -> void:
	_commit(_save.set_auxiliary_equipment_favorite(uuid, favorite, _key("ui_aux_favorite")), "Đã cập nhật trạng thái yêu thích.", "Không thể cập nhật trạng thái yêu thích.")


func _set_aux_locked(uuid: String, locked: bool) -> void:
	_commit(_save.set_auxiliary_equipment_locked(uuid, locked, _key("ui_aux_locked")), "Đã cập nhật khóa vật phẩm.", "Không thể cập nhật khóa vật phẩm.")


func _commit(ok: bool, success: String, failure: String) -> void:
	_status.text = success if ok else failure
	if not ok: _refresh.call_deferred()


func _key(prefix: String) -> String:
	return "%s:%d" % [prefix, Time.get_ticks_usec()]


func _path(first: String, second := "") -> Array[String]:
	var result: Array[String] = [first]
	if not second.is_empty(): result.append(second)
	return result


func _full_save_snapshot() -> Dictionary:
	if _save == null or not _save.has_method("get_snapshot"):
		return {}
	var value: Variant = _save.call(&"get_snapshot")
	return (value as Dictionary).duplicate(true) if value is Dictionary else {}


func _active_hero_id(save_snapshot: Dictionary) -> String:
	if save_snapshot.is_empty():
		return ""
	var team_value: Variant = save_snapshot.get("soul_team", null)
	if not team_value is Dictionary:
		return ""
	var hero_id := String((team_value as Dictionary).get("active_hero", ""))
	return hero_id if HERO_DEFINITIONS.has(hero_id) else ""


func _hero_definition_for_id(hero_id: String) -> HeroDefinition:
	if not HERO_DEFINITIONS.has(hero_id):
		return null
	return HERO_DEFINITIONS[hero_id] as HeroDefinition


## This is the only Arsenal seam into combat math. Every current value,
## what-if allocation, and candidate-Soul comparison delegates here.
func _project_hero(save_snapshot: Dictionary, hero_id: String) -> Dictionary:
	var hero := _hero_definition_for_id(hero_id)
	if save_snapshot.is_empty() or hero == null:
		return {}
	return HERO_SOUL_MANAGER.project_hero_combat(save_snapshot, hero)


func _next_stat_projection(
		save_snapshot: Dictionary,
		hero: HeroDefinition,
		stat_id: StringName
) -> Dictionary:
	if save_snapshot.is_empty() or hero == null or stat_id not in PROGRESSION.STAT_IDS:
		return {}
	var candidate := save_snapshot.duplicate(true)
	var progression_value: Variant = candidate.get("progression", null)
	if not progression_value is Dictionary:
		return {}
	var progression := progression_value as Dictionary
	var player_value: Variant = progression.get("player", null)
	if not player_value is Dictionary:
		return {}
	var player := player_value as Dictionary
	var allocation_value: Variant = player.get("stat_allocation", null)
	if not allocation_value is Dictionary:
		return {}
	var allocation := (allocation_value as Dictionary).duplicate(true)
	for required_id: StringName in PROGRESSION.STAT_IDS:
		var raw_points: Variant = allocation.get(required_id, allocation.get(String(required_id), null))
		if not raw_points is int:
			return {}
	var key := String(stat_id)
	allocation[key] = int(allocation.get(stat_id, allocation.get(key, 0))) + 1
	var player_level := int(player.get("level", 0))
	if not PROGRESSION.validate_stat_allocation(player_level, allocation):
		return {}
	player["stat_allocation"] = allocation
	progression["player"] = player
	candidate["progression"] = progression
	return _project_hero(candidate, String(hero.hero_id))


func _effective_stat_value(projection: Dictionary, stat_id: String) -> float:
	match stat_id:
		"hp": return float(projection.get("hp", 0.0))
		"mana": return float(projection.get("mana", 0.0))
		"damage": return float(projection.get("character_damage", 0.0))
	return 0.0


func _snapshot_with_selected_soul(
		save_snapshot: Dictionary,
		hero_id: String,
		instance_id: String
) -> Dictionary:
	if save_snapshot.is_empty() or _hero_definition_for_id(hero_id) == null \
			or instance_id.is_empty():
		return {}
	var inventory_value: Variant = save_snapshot.get("inventory", null)
	if not inventory_value is Dictionary:
		return {}
	var souls_value: Variant = (inventory_value as Dictionary).get("hero_souls", null)
	if not souls_value is Array:
		return {}
	var found := false
	for raw_soul: Variant in souls_value:
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id \
				and String((raw_soul as Dictionary).get("hero_id", "")) == hero_id:
			found = true
			break
	if not found:
		return {}
	var candidate := save_snapshot.duplicate(true)
	var team_value: Variant = candidate.get("soul_team", null)
	if not team_value is Dictionary:
		return {}
	var team := team_value as Dictionary
	var selections_value: Variant = team.get("selected_soul_instances", null)
	if not selections_value is Dictionary:
		return {}
	var selections := selections_value as Dictionary
	selections[hero_id] = instance_id
	team["selected_soul_instances"] = selections
	candidate["soul_team"] = team
	return candidate


func _find_soul(inventory: Array, instance_id: String) -> Dictionary:
	for raw: Variant in inventory:
		if raw is Dictionary and String((raw as Dictionary).get("instance_id", "")) == instance_id: return raw
	return {}


func _instance_id_for_hero(inventory: Array, selections: Dictionary, hero_id: String) -> String:
	var selected_id := String(selections.get(hero_id, ""))
	var selected := _find_soul(inventory, selected_id)
	if not selected.is_empty() and String(selected.get("hero_id", "")) == hero_id:
		return selected_id
	var owned := _souls_for_hero(inventory, hero_id)
	return String(_best_soul(owned).get("instance_id", ""))


func _souls_for_hero(inventory: Array, hero_id: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for raw: Variant in inventory:
		if raw is Dictionary and String((raw as Dictionary).get("hero_id", "")) == hero_id:
			result.append(raw as Dictionary)
	return result


func _best_soul(souls: Array[Dictionary]) -> Dictionary:
	var result: Dictionary = {}
	for soul: Dictionary in souls:
		if result.is_empty() \
				or int(soul.get("rarity", 0)) > int(result.get("rarity", 0)) \
				or (int(soul.get("rarity", 0)) == int(result.get("rarity", 0)) \
				and int(soul.get("item_level", 1)) > int(result.get("item_level", 1))):
			result = soul
	return result


func _identity_name(hero_id: String) -> String:
	match hero_id:
		"sword_hero":
			return "KIẾM SĨ"
		"archer_hero":
			return "CUNG THỦ"
		"axe_hero":
			return "CHIẾN BINH RÌU"
		"wizard_hero":
			return "PHÁP SƯ"
		"":
			return "TRỐNG"
	return hero_id.trim_suffix("_hero").replace("_", " ").to_upper()


func _soul_item_name(hero_id: String) -> String:
	match hero_id:
		"sword_hero":
			return "HERO WEAPON KIẾM SĨ"
		"archer_hero":
			return "HERO WEAPON CUNG THỦ"
		"axe_hero":
			return "HERO WEAPON CHIẾN BINH RÌU"
		"wizard_hero":
			return "HERO WEAPON PHÁP SƯ"
	return "HERO WEAPON"


func _affinity_copy(affinity: String) -> String:
	match affinity.strip_edges().to_lower():
		"warrior":
			return "CHIẾN BINH"
		"ranger":
			return "XẠ THỦ"
		"mage", "magician":
			return "PHÁP SƯ"
		"guardian":
			return "HỘ VỆ"
	return affinity.replace("_", " ").to_upper()


func _identity_icon(hero_id: String) -> Vector2i:
	match hero_id:
		"archer_hero":
			return LivingArsenalIcons.BOW
		"axe_hero":
			return LivingArsenalIcons.AXE
		"wizard_hero":
			return LivingArsenalIcons.STAFF
	return LivingArsenalIcons.SWORD


func _team_role(hero_id: String, active_id: String, reserves: Array) -> String:
	if hero_id == active_id:
		return "ACTIVE"
	if reserves.size() > 0 and hero_id == String(reserves[0]):
		return "RESERVE"
	return "BENCH"


func _team_role_copy(role: String) -> String:
	match role:
		"ACTIVE":
			return "CHỦ LỰC"
		"RESERVE":
			return "DỰ BỊ"
	return "TRONG KHO"


func _protection_copy(soul: Dictionary, inventory: Array = []) -> String:
	var reasons: Array[String] = []
	if bool(soul.get("equipped", false)):
		reasons.append("ĐANG DÙNG")
	if bool(soul.get("favorite", false)):
		reasons.append("YÊU THÍCH")
	if bool(soul.get("locked", false)):
		reasons.append("ĐÃ KHÓA")
	var identity_count := 0
	var hero_id := String(soul.get("hero_id", ""))
	for raw: Variant in inventory:
		if raw is Dictionary and String((raw as Dictionary).get("hero_id", "")) == hero_id:
			identity_count += 1
	if not hero_id.is_empty() and identity_count <= 1:
		reasons.append("BẢN SAO CUỐI")
	return " + ".join(reasons) if not reasons.is_empty() else "KHÔNG"


func _comparison_copy(
		soul: Dictionary,
		equipped: Dictionary,
		save_snapshot: Dictionary
) -> String:
	var hero_id := String(soul.get("hero_id", ""))
	var candidate_id := String(soul.get("instance_id", ""))
	var baseline := _project_hero(save_snapshot, hero_id)
	var candidate_snapshot := _snapshot_with_selected_soul(
		save_snapshot,
		hero_id,
		candidate_id
	)
	var candidate := _project_hero(candidate_snapshot, hero_id)
	if baseline.is_empty() or candidate.is_empty():
		return "SO SÁNH HIỆU DỤNG  •  THIẾU HERO/SAVE HỢP LỆ  •  CHỈ ĐỌC"
	var base_hit_delta := float(candidate.get("damage", 0.0)) \
		- float(baseline.get("damage", 0.0))
	var hp_delta := float(candidate.get("hp", 0.0)) - float(baseline.get("hp", 0.0))
	var mana_delta := float(candidate.get("mana", 0.0)) - float(baseline.get("mana", 0.0))
	var comparison_target := "BẢN ĐANG CHỌN" if not equipped.is_empty() else "KHÔNG TRANG BỊ"
	var secondary := ""
	if not equipped.is_empty():
		var rarity_delta := int(soul.get("rarity", 0)) - int(equipped.get("rarity", 0))
		var level_delta := int(soul.get("item_level", 1)) - int(equipped.get("item_level", 1))
		secondary = "  •  ĐỘ HIẾM %s%d  •  CẤP %s%d" % [
			_sign(rarity_delta),
			rarity_delta,
			_sign(level_delta),
			level_delta,
		]
	return "SO VỚI %s  •  ĐÒN CƠ BẢN %s  •  HP %s  •  MANA %s%s" % [
		comparison_target,
		_signed_number_copy(base_hit_delta),
		_signed_number_copy(hp_delta),
		_signed_number_copy(mana_delta),
		secondary,
	]


func _aux_slot_name(slot_id: String) -> String:
	return AUX_PRESENTATION.slot_display_name(slot_id).to_upper()


func _skill_kit_tier_name(kit_id: String) -> String:
	match kit_id:
		"advanced":
			return "NÂNG CAO"
		"legendary_plus":
			return "LEGENDARY+"
	return "CƠ BẢN"


func _hero_loadout_slot(legacy_slot_id: String) -> String:
	return String({
		"soul_vessel": "armor",
		"soul_boots": "boots",
		"soul_trace": "jewelry",
	}.get(legacy_slot_id, ""))


func _hero_wearing_item(loadouts: Dictionary, uuid: String) -> String:
	if uuid.is_empty():
		return ""
	for raw_hero_id: Variant in loadouts.keys():
		var raw_loadout: Variant = loadouts[raw_hero_id]
		if raw_loadout is Dictionary and uuid in (raw_loadout as Dictionary).values():
			return String(raw_hero_id)
	return ""


func _aux_stat_name(stat_id: String) -> String:
	const NAMES := {
		"max_hp_flat": "HP tối đa", "max_hp_percent": "HP tối đa", "damage_reduction": "Giáp ảo",
		"barrier_capacity_percent": "Giáp ảo", "dodge_chance_percent": "Né tránh",
		"health_regen": "Hồi HP", "healing_received": "Hiệu quả hồi máu", "guard_while_attacking": "Power từ Giáp",
		"armor_power_percent": "Power từ Giáp", "armor_mana_percent": "Mana từ Giáp",
		"movement_speed": "Tốc độ di chuyển", "movement_speed_percent": "Tốc độ di chuyển",
		"dash_cooldown_rate": "Hồi Lướt", "dash_speed_percent": "Tốc độ Lướt",
		"footwork_damage_reduction": "Né tránh", "boots_power_percent": "Power từ Giày", "max_hp_from_boots_percent": "HP từ Giày",
		"damage_flat": "Power", "damage_percent": "Power",
		"mana_percent": "Mana tối đa", "mana_regen": "Hồi Mana", "cooldown_rate": "Tốc độ hồi chiêu",
		"mana_efficiency": "Hiệu suất Mana",
	}
	return String(NAMES.get(stat_id, stat_id.replace("_", " ").capitalize()))


func _sign(value: int) -> String: return "+" if value >= 0 else ""


func _signed_number_copy(value: float) -> String:
	if absf(value) < 0.005:
		return "0"
	return "%s%s" % ["+" if value > 0.0 else "", _number_copy(value)]


func _number_copy(value: float) -> String:
	var copy := "%.2f" % value
	while copy.contains(".") and copy.ends_with("0"):
		copy = copy.trim_suffix("0")
	return copy.trim_suffix(".")


func _fusion_inputs(inventory: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for id: String in _fusion_ids:
		var soul := _find_soul(inventory, id)
		if not soul.is_empty(): result.append(soul)
	return result


func _label(text: String, size := 10, color := Color.WHITE, wrap := true) -> Label:
	var label := TEXT_SCENE.instantiate() as Label
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if wrap else TextServer.AUTOWRAP_OFF
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


func _action_button() -> Button:
	var button := ACTION_BUTTON_SCENE.instantiate() as Button
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	return button


func _data_row() -> HBoxContainer:
	return DATA_ROW_SCENE.instantiate() as HBoxContainer


func _data_stack() -> VBoxContainer:
	return DATA_STACK_SCENE.instantiate() as VBoxContainer


func _clear(node: Node) -> void:
	for child: Node in node.get_children(): child.queue_free()
