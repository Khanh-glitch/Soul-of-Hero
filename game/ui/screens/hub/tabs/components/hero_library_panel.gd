class_name HeroLibraryPanel
extends HSplitContainer

const CATALOG := preload("res://game/heroes/hero_library_catalog.gd")
const KNIGHT_IDLE: Texture2D = preload("res://assets/characters/knight/_Idle.png")

@onready var hero_list: VBoxContainer = %HeroList
@onready var detail: VBoxContainer = %HeroDetail


func _ready() -> void:
	_build_hero_list()
	_show_hero(&"sword_hero")


func _build_hero_list() -> void:
	for child: Node in hero_list.get_children():
		child.queue_free()
	var kicker := _label("THƯ VIỆN TƯỚNG", 12, Color("75d8ff"))
	hero_list.add_child(kicker)
	var intro := _label(
		"Hồ sơ chiến đấu dùng chung dữ liệu với runtime.",
		9,
		Color("9da8b8"),
	)
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hero_list.add_child(intro)
	for hero_id: StringName in CATALOG.hero_ids():
		var profile := CATALOG.profile(hero_id)
		var button := Button.new()
		button.name = "%sLibraryButton" % String(hero_id).to_pascal_case()
		button.custom_minimum_size = Vector2(172.0, 58.0)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.text = "%s\n%s" % [
			String(profile.get("display_name", "")),
			String(profile.get("title", "")),
		]
		button.tooltip_text = String(profile.get("summary", ""))
		button.pressed.connect(_show_hero.bind(hero_id))
		hero_list.add_child(button)


func _show_hero(hero_id: StringName) -> void:
	for child: Node in detail.get_children():
		child.queue_free()
	var profile := CATALOG.profile(hero_id)
	if profile.is_empty():
		return
	_build_header(profile)
	_build_rarity_strip(profile)
	_build_stats(profile)
	_build_bullets("BẢN SẮC", profile.get("identity", []), Color("e5bd72"))
	_build_entries("NỘI TẠI • TỨ KIẾM ÂM GIỚI", profile.get("combo", []), Color("f07870"))
	_build_entries("BỂ KỸ NĂNG • THƯỜNG–HIẾM", profile.get("basic_skills", []), Color("76a9ff"))
	_build_entries("BỂ KỸ NĂNG • SỬ THI+", profile.get("advanced_skills", []), Color("bd7dff"))
	_build_entries("DẠNG LINH HỒN • Q", profile.get("soul_skills", []), Color("55dfc4"))
	_build_entries("RỜI SÂN", profile.get("departure_skills", []), Color("ec707e"))
	_build_lore(profile)


func _build_header(profile: Dictionary) -> void:
	var panel := PanelContainer.new()
	panel.theme_type_variation = &"ElevatedPanel"
	var margin := MarginContainer.new()
	margin.add_theme_constant_override(&"margin_left", 10)
	margin.add_theme_constant_override(&"margin_top", 8)
	margin.add_theme_constant_override(&"margin_right", 10)
	margin.add_theme_constant_override(&"margin_bottom", 8)
	panel.add_child(margin)
	var row := HBoxContainer.new()
	row.add_theme_constant_override(&"separation", 12)
	margin.add_child(row)
	var portrait := TextureRect.new()
	portrait.name = "KNightPortrait"
	portrait.custom_minimum_size = Vector2(76.0, 76.0)
	portrait.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var atlas := AtlasTexture.new()
	atlas.atlas = KNIGHT_IDLE
	atlas.region = Rect2(0.0, 0.0, 48.0, 48.0)
	portrait.texture = atlas
	row.add_child(portrait)
	var copy := VBoxContainer.new()
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(copy)
	copy.add_child(_label(String(profile["display_name"]).to_upper(), 22, Color("f2d08a")))
	copy.add_child(_label(String(profile["title"]).to_upper(), 12, Color("dc5562")))
	copy.add_child(_label(String(profile["role"]), 10, Color("84d9e8")))
	var summary := _label(String(profile["summary"]), 10, Color("c7cbd3"))
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	copy.add_child(summary)
	detail.add_child(panel)


func _build_rarity_strip(profile: Dictionary) -> void:
	var strip := HBoxContainer.new()
	strip.name = "RarityStrip"
	strip.add_theme_constant_override(&"separation", 4)
	var names: Array = profile.get("rarities", [])
	var colors: Array = profile.get("rarity_colors", [])
	for index: int in names.size():
		var rarity := _label(String(names[index]).to_upper(), 8, colors[index])
		rarity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		rarity.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		rarity.tooltip_text = "Bậc %d/8" % (index + 1)
		strip.add_child(rarity)
	detail.add_child(strip)


func _build_stats(profile: Dictionary) -> void:
	var stats: Dictionary = profile.get("stats", {})
	var row := HBoxContainer.new()
	row.name = "BaseStats"
	row.add_theme_constant_override(&"separation", 5)
	for stat_name: String in ["HP", "MP", "DMG", "Di chuyển"]:
		var card := PanelContainer.new()
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		card.theme_type_variation = &"HudPanel"
		var label := _label(
			"%s\n%s" % [stat_name.to_upper(), str(stats.get(stat_name, "—"))],
			10,
			Color("e8edf2"),
		)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card.add_child(label)
		row.add_child(card)
	detail.add_child(row)
	var growth := _label(String(stats.get("Tăng trưởng", "")), 9, Color("98a7b7"))
	growth.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	detail.add_child(growth)


func _build_bullets(title: String, values: Array, color: Color) -> void:
	_add_section_title(title, color)
	for value: Variant in values:
		var copy := _label("◆  %s" % String(value), 10, Color("cbd2da"))
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		detail.add_child(copy)


func _build_entries(title: String, entries: Array, color: Color) -> void:
	_add_section_title(title, color)
	for raw_entry: Variant in entries:
		if not raw_entry is Dictionary:
			continue
		var entry := raw_entry as Dictionary
		var row := VBoxContainer.new()
		row.add_theme_constant_override(&"separation", 1)
		row.add_child(_label(String(entry.get("name", "")), 11, color))
		var copy := _label(String(entry.get("copy", "")), 9, Color("b8c0ca"))
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(copy)
		detail.add_child(row)


func _build_lore(profile: Dictionary) -> void:
	_add_section_title("CỐT TRUYỆN", Color("d6b8ef"))
	var lore := String(profile.get("lore", ""))
	var pending := bool(profile.get("lore_pending", false))
	var panel := PanelContainer.new()
	panel.name = "LorePlaceholder"
	panel.theme_type_variation = &"HudPanel"
	var copy := _label(
		"ĐANG CHỜ CẬP NHẬT NỘI DUNG CHÍNH THỨC"
		if pending and lore.is_empty()
		else lore,
		10,
		Color("8d8296") if pending and lore.is_empty() else Color("d4c5df"),
	)
	copy.custom_minimum_size = Vector2(0.0, 48.0)
	copy.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	copy.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(copy)
	detail.add_child(panel)


func _add_section_title(copy: String, color: Color) -> void:
	var separator := HSeparator.new()
	separator.modulate = Color(color, 0.55)
	detail.add_child(separator)
	detail.add_child(_label(copy, 11, color))


func _label(copy: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = copy
	label.add_theme_font_size_override(&"font_size", size)
	label.add_theme_color_override(&"font_color", color)
	return label
