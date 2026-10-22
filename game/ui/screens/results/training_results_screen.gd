extends Control

const RARITY_COLORS := {
	"normal": "#c6c6c6",
	"magic": "#67a9ff",
	"rare": "#61d987",
	"epic": "#c285ff",
	"legendary": "#ffb44d",
	"crystal": "#69f1ef",
	"mythic": "#ff6d9e",
	"eternal": "#ffe78a",
}
const CURRENCY_NAMES := {
	"account": "Vàng",
	"hero_materials": "Nguyên liệu Hero",
	"monster_fragments": "Mảnh quái",
}
const ITEM_NAMES := {
	"crypt_bone_shard": "Mảnh xương Hầm Mộ",
	"reaper_essence": "Tinh chất Reaper",
	"blood_crucible_blueprint": "Bản vẽ Blood Crucible",
}
const HERO_NAMES := {
	"sword_hero": "Kiếm sĩ",
	"axe_hero": "Chiến binh Rìu",
	"archer_hero": "Cung thủ",
	"wizard_hero": "Pháp Sư",
}
const FEATURE_NAMES := {
	"soul_jewelry": "Ô Trang sức Linh Hồn",
	"skill_allocation": "Cộng điểm kỹ năng",
	"skill_respec": "Đặt lại điểm kỹ năng",
	"hero_soul_inventory": "Kho Hero Weapon",
	"hero_soul_sell": "Bán Hero Weapon",
	"chapter_1_boss_gate": "Cổng Boss Chương 1",
	"hero_soul_fusion": "Ghép Hero Weapon",
	"chapter_2_access": "Mở Chương 2: Xưởng Hắc Phù",
	"hunt_replay": "Thưởng săn lại boss Ải 10",
}
const STAT_NAMES := {
	"max_hp_flat": "Máu tối đa",
	"max_hp_percent": "Máu tối đa",
	"damage_reduction": "Giáp ảo",
	"barrier_capacity_percent": "Giáp ảo",
	"dodge_chance_percent": "Né tránh",
	"health_regen": "Hồi máu",
	"healing_received": "Hiệu quả hồi máu",
	"guard_while_attacking": "Power từ Giáp",
	"armor_power_percent": "Power từ Giáp",
	"movement_speed": "Tốc độ di chuyển",
	"movement_speed_percent": "Tốc độ di chuyển",
	"dash_cooldown_rate": "Hồi Lướt",
	"dash_speed_percent": "Tốc độ Lướt",
	"footwork_damage_reduction": "Né tránh",
	"boots_power_percent": "Power từ Giày",
	"max_hp_from_boots_percent": "Máu tối đa từ Giày",
	"damage_flat": "Sát thương",
	"damage_percent": "Power",
	"max_mana_flat": "Mana tối đa",
	"mana_percent": "Mana tối đa",
	"mana_regen": "Hồi Mana",
	"cooldown_rate": "Hồi chiêu",
	"mana_efficiency": "Hiệu suất Mana",
}


func _ready() -> void:
	%RetryButton.pressed.connect(func() -> void: AppFlow.retry_active_run())
	%ArsenalButton.pressed.connect(func() -> void: AppFlow.abort_to_hub(&"hero_roster"))
	%HubButton.pressed.connect(func() -> void: AppFlow.abort_to_home())
	LivingArsenalIcons.apply_to_button(%RetryButton, LivingArsenalIcons.RETRY)
	LivingArsenalIcons.apply_to_button(%ArsenalButton, LivingArsenalIcons.ARSENAL)
	LivingArsenalIcons.apply_to_button(%HubButton, LivingArsenalIcons.HOME)
	%RetryButton.grab_focus()
	_apply_result(AppFlow.get_last_result())


func configure(payload: Dictionary = {}) -> void:
	var raw: Variant = payload.get("result", {})
	if raw is Dictionary and is_node_ready():
		_apply_result(raw)


func _apply_result(result: Dictionary) -> void:
	var is_campaign := StringName(result.get("mode_id", &"training")) == &"campaign"
	var campaign_slot := maxi(1, int(result.get("campaign_slot", 1)))
	var level_display_name := String(result.get("level_display_name", "")).strip_edges()
	%Kicker.text = (
		"KẾT QUẢ CHIẾN DỊCH • TIẾN TRÌNH ĐÃ ĐƯỢC GHI"
		if is_campaign
		else "KẾT QUẢ LUYỆN TẬP • KHÔNG CÓ PHẦN THƯỞNG CHIẾN DỊCH"
	)
	if is_campaign:
		%Title.text = "HOÀN THÀNH MÀN %02d" % campaign_slot
		var completed_level := "Màn %02d" % campaign_slot
		if not level_display_name.is_empty():
			completed_level += " — %s" % level_display_name
		_apply_campaign_reward(result.get("reward", {}))
		%Notice.text = "%s đã hoàn thành. Trang bị mới có thể quản lý trong Đội hình & Trang bị." % completed_level
	else:
		%Title.text = "ĐÃ VƯỢT HẦM MỘ"
		%RewardSummary.visible = false
		%RewardPanel.visible = false
		%Notice.text = "Sân tập chỉ dùng để luyện chuỗi đòn Kiếm sĩ và Soul Echo; kết quả không đổi tiến trình."
	%ScoreValue.text = "%06d" % int(result.get("score", 0))
	%SigilValue.text = "%d/%d" % [int(result.get("sigils", 0)), int(result.get("required_sigils", 0))]
	var duration := float(result.get("duration_seconds", 0.0))
	%TimeValue.text = "%02d:%02d" % [int(duration) / 60, int(duration) % 60]


func _apply_campaign_reward(reward_value: Variant) -> void:
	%RewardSummary.visible = true
	%RewardPanel.visible = true
	if not reward_value is Dictionary or (reward_value as Dictionary).is_empty():
		%RewardState.text = "PHẦN THƯỞNG KHÔNG KHẢ DỤNG"
		%LevelProgress.text = ""
		%RewardList.text = "Không tìm thấy dữ liệu phần thưởng của màn này."
		return
	var reward: Dictionary = reward_value
	var granted := bool(reward.get("granted", false))
	var replay := bool(reward.get("already_claimed", false))
	if granted:
		%RewardState.text = "LẦN ĐẦU VƯỢT ẢI  •  ĐÃ NHẬN"
		%RewardState.add_theme_color_override("font_color", Color("79e598"))
	elif replay and bool((reward.get("replay_reward", {}) as Dictionary).get("granted", false)):
		%RewardState.text = "CÀY LẠI  •  ĐÃ NHẬN THƯỞNG BOSS"
		%RewardState.add_theme_color_override("font_color", Color("e8c879"))
	elif replay:
		%RewardState.text = "CÀY LẠI  •  KHÔNG LẶP THƯỞNG LẦN ĐẦU"
		%RewardState.add_theme_color_override("font_color", Color("b8a7c4"))
	else:
		%RewardState.text = "GIAO DỊCH PHẦN THƯỞNG LỖI"
		%RewardState.add_theme_color_override("font_color", Color("ff7777"))

	var previous_level := int(reward.get("previous_player_level", 1))
	var current_level := int(reward.get("current_player_level", previous_level))
	var gained := int(reward.get("player_level_gained", 0))
	%LevelProgress.text = (
		"CẤP NHÂN VẬT %d → %d  (+%d)" % [previous_level, current_level, gained]
		if gained > 0
		else "CẤP NHÂN VẬT %d" % current_level
	)

	var lines: Array[String] = []
	if replay:
		var replay_reward: Dictionary = reward.get("replay_reward", {})
		if bool(replay_reward.get("granted", false)):
			lines.append("[color=#e8c879][b]Thưởng vừa nhận khi cày lại boss:[/b][/color]")
			_append_currency_lines(lines, replay_reward.get("currencies", {}))
		elif not replay_reward.is_empty():
			lines.append("[color=#b8a7c4]Thưởng cày lại của lượt này đã được ghi; không có phần thưởng nào bị nhân đôi.[/color]")
		lines.append("[color=#b8a7c4]Hero Weapon, mảnh Hero và nội dung mở khóa lần đầu được bảo vệ khỏi nhận trùng.[/color]")
		lines.append("[b]Nội dung gói thưởng lần đầu:[/b]")
	elif not granted:
		lines.append("[color=#ff7777]Không thể ghi phần thưởng. Tiến trình không được trả một phần.[/color]")
	else:
		lines.append("[b]Phần thưởng vừa nhận:[/b]")

	_append_currency_lines(lines, reward.get("currencies", {}))
	_append_hero_shard_lines(lines, reward.get("hero_shards", {}))
	_append_stack_lines(lines, reward.get("items", []))
	_append_hero_soul_lines(lines, reward.get("hero_souls", []))
	_append_auxiliary_lines(lines, reward.get("auxiliary_equipment", []), granted)
	_append_unlock_lines(lines, reward.get("unlocks", []))
	if lines.size() <= 1:
		lines.append("Không có vật phẩm trong gói thưởng này.")
	%RewardList.text = "\n".join(lines)


func _append_unlock_lines(lines: Array[String], unlocks_value: Variant) -> void:
	if not unlocks_value is Array:
		return
	for raw_feature: Variant in unlocks_value:
		var feature_id := String(raw_feature)
		lines.append("• MỞ KHÓA  [color=#79e598][b]%s[/b][/color]" % FEATURE_NAMES.get(
			feature_id,
			feature_id.replace("_", " ").capitalize(),
		))


func _append_currency_lines(lines: Array[String], currencies_value: Variant) -> void:
	if not currencies_value is Dictionary:
		return
	var currencies: Dictionary = currencies_value
	for currency_id: String in ["account", "hero_materials", "monster_fragments"]:
		var amount := int(currencies.get(currency_id, 0))
		if amount > 0:
			lines.append("• +%d %s" % [amount, CURRENCY_NAMES.get(currency_id, currency_id.capitalize())])


func _append_hero_shard_lines(lines: Array[String], shards_value: Variant) -> void:
	if not shards_value is Dictionary:
		return
	for raw_hero_id: Variant in (shards_value as Dictionary).keys():
		var amount := int((shards_value as Dictionary)[raw_hero_id])
		if amount <= 0:
			continue
		var hero_id := String(raw_hero_id)
		lines.append("• +%d MẢNH HERO  [b]%s[/b]  •  CẦN 50 ĐỂ MỞ" % [
			amount, HERO_NAMES.get(hero_id, hero_id.capitalize()),
		])


func _append_stack_lines(lines: Array[String], items_value: Variant) -> void:
	if not items_value is Array:
		return
	for raw_item: Variant in items_value:
		if not raw_item is Dictionary:
			continue
		var item: Dictionary = raw_item
		var item_id := String(item.get("item_id", ""))
		lines.append("• +%d %s" % [
			int(item.get("quantity", 0)),
			ITEM_NAMES.get(item_id, item_id.capitalize()),
		])


func _append_hero_soul_lines(lines: Array[String], souls_value: Variant) -> void:
	if not souls_value is Array:
		return
	for raw_soul: Variant in souls_value:
		if not raw_soul is Dictionary:
			continue
		var soul: Dictionary = raw_soul
		var rarity_id := String(soul.get("rarity_name", "normal")).to_lower()
		var color := String(RARITY_COLORS.get(rarity_id, RARITY_COLORS["normal"]))
		var hero_id := String(soul.get("hero_id", ""))
		lines.append("• HERO WEAPON  [color=%s][b]%s[/b][/color] %s • Cấp %d" % [
			color,
			RarityPalette.display_name(rarity_id),
			HERO_NAMES.get(hero_id, hero_id.capitalize()),
			int(soul.get("item_level", 1)),
		])
		_append_affix_lines(lines, soul.get("affixes", []))


func _append_auxiliary_lines(
		lines: Array[String],
		equipment_value: Variant,
		granted: bool,
) -> void:
	if not equipment_value is Array:
		return
	for raw_item: Variant in equipment_value:
		if not raw_item is Dictionary:
			continue
		var item: Dictionary = raw_item
		var rarity_id := String(item.get("rarity", "normal"))
		var color := String(RARITY_COLORS.get(rarity_id, RARITY_COLORS["normal"]))
		var equip_note := ""
		if granted and bool(item.get("auto_equipped", false)):
			equip_note = "  [color=#79e598][b]ĐÃ TỰ TRANG BỊ[/b][/color]"
		elif granted and not bool(item.get("equipped", false)):
			equip_note = "  [color=#e8c879]MỞ ĐỘI HÌNH & TRANG BỊ ĐỂ SỬ DỤNG[/color]"
		lines.append("• TRANG BỊ  [color=%s][b]%s[/b][/color] %s • Cấp %d%s" % [
			color,
			RarityPalette.display_name(rarity_id),
			String(item.get("slot_name", String(item.get("slot", "")).capitalize())),
			int(item.get("item_level", 1)),
			equip_note,
		])
		var primary: Variant = item.get("primary", {})
		if primary is Dictionary:
			lines.append("    ↳ %s" % _format_stat(primary as Dictionary, "stat_id"))
		_append_affix_lines(lines, item.get("affixes", []))


func _append_affix_lines(lines: Array[String], affixes_value: Variant) -> void:
	if not affixes_value is Array:
		return
	for raw_affix: Variant in affixes_value:
		if raw_affix is Dictionary:
			lines.append("    ↳ %s" % _format_stat(raw_affix as Dictionary, "affix_id"))


func _format_stat(stat: Dictionary, id_key: String) -> String:
	var stat_id := String(stat.get(id_key, ""))
	var unit := String(stat.get("unit", "flat"))
	var value := float(stat.get("value", 0.0))
	var value_text := "%.1f" % value
	if value_text.ends_with(".0"):
		value_text = value_text.trim_suffix(".0")
	var suffix := ""
	if unit in ["percent", "percent_per_second"]:
		suffix = "%"
	if unit in ["flat_per_second", "percent_per_second"]:
		suffix += "/giây"
	return "+%s%s %s" % [value_text, suffix, STAT_NAMES.get(stat_id, stat_id.capitalize())]


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"ui_cancel") and not event.is_echo():
		AppFlow.abort_to_home()
		get_viewport().set_input_as_handled()
