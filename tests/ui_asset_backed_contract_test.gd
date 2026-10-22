extends SceneTree

const UI_ROOT := "res://game/ui"
const RUNTIME_UI_ROOT := "res://game/levels/objectives"
const SOURCE_EXTENSIONS := [&"gd", &"tscn", &"tres"]
const UI_FORBIDDEN_TOKENS := [
	"StyleBoxFlat",
	"ColorRect",
	"CanvasLayer.new(",
	"Control.new(",
	"PanelContainer.new(",
	"MarginContainer.new(",
	"HBoxContainer.new(",
	"VBoxContainer.new(",
	"GridContainer.new(",
	"ScrollContainer.new(",
	"Label.new(",
	"Button.new(",
	"ProgressBar.new(",
	"TextureRect.new(",
	"func _draw",
	"draw_circle(",
	"draw_arc(",
	"draw_line(",
	"draw_rect(",
	"draw_colored_polygon(",
	"GradientTexture",
	"Polygon2D",
]
const RUNTIME_FORBIDDEN_TOKENS := [
	"StyleBoxFlat",
	"CanvasLayer.new(",
	"Control.new(",
	"PanelContainer.new(",
	"MarginContainer.new(",
	"HBoxContainer.new(",
	"VBoxContainer.new(",
	"Label.new(",
	"Button.new(",
	"ProgressBar.new(",
	"ColorRect.new(",
	"TextureRect.new(",
	"func _draw",
]

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var ui_sources: PackedStringArray = []
	_collect_sources(UI_ROOT, ui_sources)
	var runtime_sources: PackedStringArray = []
	_collect_sources(RUNTIME_UI_ROOT, runtime_sources)
	var game_sources: PackedStringArray = []
	_collect_sources("res://game", game_sources)

	_expect(not ui_sources.is_empty(), "production UI sources are discoverable")
	_expect(_sources_avoid_tokens(ui_sources, UI_FORBIDDEN_TOKENS), "all game/ui visuals avoid procedural drawing, flat style boxes, and flat color panels")
	_expect(_sources_avoid_tokens(runtime_sources, RUNTIME_FORBIDDEN_TOKENS), "level objective HUDs avoid procedural UI visuals")
	_expect(
		_sources_use_readable_typography(game_sources),
		"all production scenes cap outlines at one pixel and contain no opaque offset text shadows",
	)

	var theme_source := FileAccess.get_file_as_string("res://game/ui/theme/living_arsenal_theme.tres")
	_expect(theme_source.contains("StyleBoxTexture") and not theme_source.contains("StyleBoxFlat"), "shared UI theme is texture-backed")
	_expect(theme_source.contains("complete_ui_book_styles_free/01_TravelBookLite"), "shared UI theme consumes TravelBookLite assets")
	_expect(
		theme_source.contains("Label/colors/font_shadow_color = Color(0, 0, 0, 0)")
			and theme_source.contains("Label/constants/shadow_offset_x = 0")
			and theme_source.contains("Label/constants/shadow_offset_y = 0")
			and theme_source.contains("ActionButton/constants/outline_size = 0")
			and theme_source.contains("Button/constants/outline_size = 0")
			and theme_source.contains("DisplayLabel/constants/outline_size = 1")
			and theme_source.contains("NumberLabel/constants/outline_size = 1"),
		"shared typography keeps original fonts/sizes without the global duplicate shadow or thick button outlines",
	)

	var joystick_source := FileAccess.get_file_as_string("res://game/ui/virtual_joystick.gd")
	var hud_scene_source := FileAccess.get_file_as_string("res://game/ui/HUD.tscn")
	_expect(not joystick_source.contains("func _draw") and hud_scene_source.contains("BaseAsset") and hud_scene_source.contains("KnobAsset"), "virtual joystick is composed from authored asset nodes")
	var thin_gameplay_type := true
	for path: String in [
		"res://game/ui/HUD.tscn",
		"res://game/ui/progression_focus_hud.tscn",
		"res://game/ui/xp_gain_popup.tscn",
		"res://game/ui/completion_choice.tscn",
	]:
		var source := FileAccess.get_file_as_string(path)
		thin_gameplay_type = thin_gameplay_type \
			and source.contains("theme_override_font_sizes/font_size") \
			and not source.contains("outline_size = 2") \
			and not source.contains("outline_size = 3") \
			and not source.contains("outline_size = 4")
	_expect(thin_gameplay_type, "gameplay HUD keeps authored font sizes and caps every local outline at one pixel")
	var hud_source := FileAccess.get_file_as_string("res://game/ui/hud.gd")
	_expect(
		not hud_source.contains("AtlasTexture.new(")
			and hud_scene_source.contains("IconAttack")
			and hud_scene_source.contains("IconSkill")
			and hud_scene_source.contains("IconDash"),
		"gameplay action icons are authored atlas resources in the HUD scene instead of code-built assets",
	)
	var codex_scene_source := FileAccess.get_file_as_string("res://game/ui/field_codex.tscn")
	var item_tile_source := FileAccess.get_file_as_string("res://game/ui/field_codex_item_tile.tscn")
	_expect(
		codex_scene_source.contains("name=\"EntryList\" type=\"GridContainer\"")
			and codex_scene_source.contains("columns = 3")
			and item_tile_source.contains("Inventory_Slot.png")
			and item_tile_source.contains("Inventory_select.png"),
		"Field Codex inventory is an authored three-column asset-backed matrix",
	)
	var codex_source := FileAccess.get_file_as_string("res://game/ui/field_codex.gd")
	var codex_entry_source := FileAccess.get_file_as_string("res://game/ui/field_codex_entry.gd")
	var equipment_slot_script := FileAccess.get_file_as_string("res://game/ui/field_codex_equipment_slot.gd")
	var equipment_slot_source := FileAccess.get_file_as_string("res://game/ui/field_codex_equipment_slot.tscn")
	_expect(
		not item_tile_source.contains("outline_size")
			and not item_tile_source.contains("font_shadow")
			and not equipment_slot_source.contains("outline_size")
			and codex_source.contains('"list_detail": "(%s)"')
			and codex_source.contains("weapon_damage_percent")
			and codex_source.contains("affix_slot_count")
			and codex_source.contains("affix_display_metadata"),
		"Codex tiles avoid blurry text effects while selected detail consumes authoritative weapon and affix metadata",
	)
	_expect(
		codex_source.contains("RarityPalette.on_light_text_color(rarity)")
			and codex_entry_source.contains("RarityPalette.on_light_text_color(_rarity)")
			and equipment_slot_script.contains("RarityPalette.on_light_text_color(rarity)"),
		"rarity remains color-coded with a dedicated high-contrast palette on the light BookLite pages",
	)
	var glyph_source := FileAccess.get_file_as_string("res://game/feedback/pixel_glyph_sprite_text.gd")
	_expect(
		glyph_source.count("_build_layer(") == 2
			and not glyph_source.contains("+ Vector2.ONE, _shadow_color"),
		"damage/combo preserve the original glyph atlas and base size while rendering one crisp layer",
	)

	var home_source := FileAccess.get_file_as_string("res://game/ui/screens/home/home_map_screen.gd")
	var destination_scene := FileAccess.get_file_as_string("res://game/ui/screens/home/home_destination.tscn")
	_expect(home_source.contains("DESTINATION_SCENE.instantiate()") and destination_scene.contains("AssetSelection") and destination_scene.contains("AssetMarker"), "Home destinations are authored asset-backed scenes")

	var hub_scene := FileAccess.get_file_as_string("res://game/ui/screens/hub/hub_screen.tscn")
	var campaign_source := FileAccess.get_file_as_string("res://game/ui/screens/hub/tabs/campaign_tab.gd")
	var arsenal_source := FileAccess.get_file_as_string("res://game/ui/screens/hub/tabs/arsenal_tab.gd")
	var arsenal_scene := FileAccess.get_file_as_string("res://game/ui/screens/hub/tabs/arsenal_tab.tscn")
	_expect(
		hub_scene.contains("theme = ExtResource(\"1_theme\")")
			and campaign_source.contains("CHAPTER_BUTTON_SCENE.instantiate()")
			and campaign_source.contains("CAMPAIGN_SLOT_SCENE.instantiate()")
			and not campaign_source.contains("Button.new(")
			and not campaign_source.contains("Label.new(")
			and not campaign_source.contains("PanelContainer.new(")
			and arsenal_source.contains("TEXT_SCENE.instantiate()")
			and arsenal_source.contains("ACTION_BUTTON_SCENE.instantiate()")
			and not arsenal_source.contains("Label.new(")
			and not arsenal_source.contains("Button.new(")
			and arsenal_scene.contains("SoulInventorySplit")
			and arsenal_scene.contains("StatsList")
			and arsenal_scene.contains("SkillsList")
			and arsenal_scene.contains("AuxList"),
		"Campaign and Arsenal presentation is authored in reusable scenes and inherits the asset-backed Hub theme"
	)

	var objective_theme_contract := true
	for path: String in [
		"res://game/levels/objectives/level_5_archer_recruitment_runtime.gd",
		"res://game/levels/objectives/level_7_beacon_runtime.gd",
		"res://game/levels/objectives/level_8_reliquary_runtime.gd",
		"res://game/levels/objectives/level_9_crimson_gate_runtime.gd",
		"res://game/levels/objectives/level_10_castellan_runtime.gd",
	]:
		var source := FileAccess.get_file_as_string(path)
		objective_theme_contract = objective_theme_contract \
			and (source.contains("HUD_SCENE.instantiate()") or source.contains("BOSS_HUD_SCENE.instantiate()")) \
			and not source.contains("PanelContainer.new(") \
			and not source.contains("Label.new(") \
			and not source.contains("Button.new(")
	for path: String in [
		"res://game/ui/objectives/level_5_kingdom_archer_hud.tscn",
		"res://game/ui/objectives/level_7_beacon_hud.tscn",
		"res://game/ui/objectives/level_8_reliquary_hud.tscn",
		"res://game/ui/objectives/level_9_crimson_gate_hud.tscn",
		"res://game/ui/objectives/level_10_castellan_hud.tscn",
	]:
		var scene_source := FileAccess.get_file_as_string(path)
		objective_theme_contract = objective_theme_contract \
			and scene_source.contains("living_arsenal_theme.tres") \
			and scene_source.contains("type=\"MarginContainer\"") \
			and not scene_source.contains("outline_size = 2") \
			and not scene_source.contains("outline_size = 3") \
			and not scene_source.contains("outline_size = 4")
	var level_five_scene := FileAccess.get_file_as_string("res://game/ui/objectives/level_5_kingdom_archer_hud.tscn")
	var boss_scene := FileAccess.get_file_as_string("res://game/ui/objectives/level_10_castellan_hud.tscn")
	objective_theme_contract = objective_theme_contract \
		and level_five_scene.contains("name=\"BossPanel\" type=\"MarginContainer\"") \
		and not level_five_scene.contains("name=\"BossPanel\" type=\"PanelContainer\"") \
		and boss_scene.contains("name=\"BossPanel\" type=\"MarginContainer\"") \
		and not boss_scene.contains("name=\"BossPanel\" type=\"PanelContainer\"") \
		and boss_scene.contains("StyleBoxTexture") \
		and boss_scene.contains("UI_TravelBook_Fill01a.png")
	_expect(objective_theme_contract, "runtime Level 5 and Level 7-10 objective HUDs instantiate authored, panel-free gameplay scenes")

	if _failures.is_empty():
		print("UI ASSET-BACKED CONTRACT TEST PASSED (%d checks)" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("UI ASSET-BACKED CONTRACT TEST FAILED (%d failures / %d checks)" % [_failures.size(), _checks])
	quit(1)


func _collect_sources(root_path: String, output: PackedStringArray) -> void:
	var directory := DirAccess.open(root_path)
	if directory == null:
		_failures.append("Cannot open %s" % root_path)
		return
	directory.list_dir_begin()
	var entry := directory.get_next()
	while not entry.is_empty():
		if not entry.begins_with("."):
			var path := root_path.path_join(entry)
			if directory.current_is_dir():
				_collect_sources(path, output)
			elif SOURCE_EXTENSIONS.has(path.get_extension()):
				output.append(path)
		entry = directory.get_next()
	directory.list_dir_end()


func _sources_avoid_tokens(paths: PackedStringArray, forbidden_tokens: Array) -> bool:
	var clean := true
	for path: String in paths:
		var source := FileAccess.get_file_as_string(path)
		for raw_token: Variant in forbidden_tokens:
			var token := String(raw_token)
			if source.contains(token):
				_failures.append("%s still contains procedural UI token: %s" % [path, token])
				clean = false
	return clean


func _sources_use_readable_typography(paths: PackedStringArray) -> bool:
	var clean := true
	for path: String in paths:
		if path.get_extension() not in ["tscn", "tres"]:
			continue
		for line: String in FileAccess.get_file_as_string(path).split("\n"):
			var stripped := line.strip_edges()
			if "outline_size =" in stripped and int(stripped.get_slice("=", 1).strip_edges()) > 1:
				_failures.append("%s contains a text outline thicker than one pixel: %s" % [path, stripped])
				clean = false
			elif "font_shadow_color =" in stripped and not stripped.ends_with("Color(0, 0, 0, 0)"):
				_failures.append("%s contains an opaque text shadow: %s" % [path, stripped])
				clean = false
			elif ("shadow_offset_x =" in stripped or "shadow_offset_y =" in stripped) \
					and int(stripped.get_slice("=", 1).strip_edges()) != 0:
				_failures.append("%s contains an offset text shadow: %s" % [path, stripped])
				clean = false
	return clean


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
