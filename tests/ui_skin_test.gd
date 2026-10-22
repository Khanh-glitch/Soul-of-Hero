extends SceneTree

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var theme := load("res://game/ui/theme/living_arsenal_theme.tres") as Theme
	_expect(theme != null, "shared UI theme loads")
	if theme != null:
		_expect(theme.default_font != null and theme.default_font.resource_path.ends_with("Handjet-SemiBold.ttf"), "Handjet is the Vietnamese-capable UI font")
		_expect(theme.get_font(&"font", &"DisplayLabel").resource_path.ends_with("GrenzeGotisch-SemiBold.ttf"), "Grenze Gotisch owns display headings")
		_expect(theme.get_font(&"font", &"NumberLabel").resource_path.ends_with("VT323-Regular.ttf"), "VT323 owns compact HUD numbers")
		var action_style := theme.get_stylebox(&"normal", &"ActionButton")
		_expect(action_style is StyleBoxTexture, "mobile action controls use an asset-backed style")
		if action_style is StyleBoxTexture:
			var texture := (action_style as StyleBoxTexture).texture
			_expect(
				texture != null and texture.resource_path.ends_with("Inventory_select.png"),
				"Free Inventory frame is wired into the action-control skin"
			)
	_expect(FileAccess.file_exists("res://assets/ui/free_inventory/License.txt"), "Free Inventory license ships beside imported UI art")

	var title := (load("res://game/ui/screens/title/title_screen.tscn") as PackedScene).instantiate()
	root.add_child(title)
	await process_frame
	_expect(title.get_node_or_null("DungeonBackdrop") != null, "Title uses the existing dungeon-art backdrop")
	_expect((title.get_node("ChapterKeyArt") as TextureRect).texture.resource_path.ends_with("chapter_1_key_art_imagen.png"), "Title uses the approved Chapter I key art")
	_expect((title.get_node("SafeMargin/MainRow/Brand/Emblem") as TextureRect).texture.resource_path.ends_with("soul_hero_emblem_imagen.png"), "Title uses the approved Soul emblem")
	var continue_button := title.get_node("SafeMargin/MainRow/ProfileChoice/ContinueButton") as Button
	var new_game_button := title.get_node("SafeMargin/MainRow/ProfileChoice/NewGameButton") as Button
	_expect(
		continue_button.icon != null
			and continue_button.icon.resource_path.ends_with("UI_TravelBook_IconPlay01a.png"),
		"Title Continue CTA uses its authored TravelBook icon"
	)
	_expect(
		new_game_button.icon != null
			and new_game_button.icon.resource_path.ends_with("UI_TravelBook_IconRestart01a.png"),
		"Title New Game CTA uses its authored TravelBook icon"
	)
	title.free()

	root.size = Vector2i(640, 360)
	var home := (load("res://game/ui/screens/home/home_map_screen.tscn") as PackedScene).instantiate()
	root.add_child(home)
	await process_frame
	_expect(home.get_node_or_null("MapWorld") != null, "Home Map owns a world-art canvas instead of tab navigation")
	_expect((home.get_node("TopSafe/Header/Row/Emblem") as TextureRect).texture.resource_path.ends_with("soul_hero_emblem_imagen.png"), "Home Map uses the approved Soul emblem")
	for function_id: StringName in [&"campaign", &"hero_roster", &"modes", &"bestiary", &"settings"]:
		home.call("configure", {"function_id": function_id})
		await process_frame
		_expect(bool(home.call("is_function_open")), "%s opens inside the Home Map function layer" % function_id)
		home.call("close_function")
	home.free()
	for atlas_path: String in [
		"res://assets/environment/ocean_cainos/ocean_tileset_grass.png",
		"res://assets/environment/ocean_cainos/ocean_tileset_stone_ground.png",
		"res://assets/environment/ocean_cainos/ocean_tileset_wall.png",
		"res://assets/environment/ocean_cainos/ocean_struct.png",
		"res://assets/environment/ocean_cainos/ocean_plant.png",
		"res://assets/environment/ocean_cainos/ocean_props.png",
	]:
		_expect(load(atlas_path) is Texture2D, "Home Map atlas loads: %s" % atlas_path.get_file())

	var hud := (load("res://game/ui/HUD.tscn") as PackedScene).instantiate()
	root.add_child(hud)
	await process_frame
	var attack := hud.get_node("HUDRoot/VirtualControls/LightAttackButton") as Button
	_expect(attack.theme_type_variation == &"ActionButton" and attack.icon != null, "combat Attack control has themed frame and icon")
	var attack_prompt := hud.get_node("HUDRoot/WeaponPanel/WeaponMargin/WeaponRows/ActionDeck/AttackSlot/Content/Prompt") as TextureRect
	_expect(attack_prompt.texture is AtlasTexture and (attack_prompt.texture as AtlasTexture).atlas.resource_path.ends_with("tilemap_packed.png"), "desktop action deck uses Kenney input prompts")
	var prompt_regions := {
		"HUDRoot/WeaponPanel/WeaponMargin/WeaponRows/ActionDeck/AttackSlot/Content/Prompt": Rect2(384, 48, 16, 16), # J
		"HUDRoot/WeaponPanel/WeaponMargin/WeaponRows/ActionDeck/SkillSlot/Content/Prompt": Rect2(400, 48, 16, 16), # K
		"HUDRoot/WeaponPanel/WeaponMargin/WeaponRows/ActionDeck/DashSlot/Content/Prompt": Rect2(304, 32, 16, 16), # E
		"HUDRoot/WeaponPanel/WeaponMargin/WeaponRows/ActionDeck/RelaySlot/Content/Prompt": Rect2(272, 32, 16, 16), # Q
		"HUDRoot/ToastPanel/ToastMargin/ToastRow/Prompt": Rect2(144, 0, 16, 16), # Left mouse
		"HUDRoot/PauseButton": Rect2(272, 0, 16, 16), # Esc
	}
	for node_path: String in prompt_regions:
		var prompt_node := hud.get_node(node_path)
		var prompt_texture: Texture2D = (
			(prompt_node as TextureRect).texture
			if prompt_node is TextureRect
			else (prompt_node as Button).icon
		)
		_expect(prompt_texture is AtlasTexture and (prompt_texture as AtlasTexture).region == prompt_regions[node_path], "Kenney prompt region is correct: %s" % node_path.get_file())
	hud.free()

	var panel := (load("res://game/ui/components/settings_panel.tscn") as PackedScene).instantiate()
	root.add_child(panel)
	await process_frame
	var ui_bus := AudioServer.get_bus_index(&"UI")
	_expect(ui_bus >= 0, "UI audio bus exists")
	if ui_bus >= 0:
		(panel.get_node("Content/Values/SfxSlider") as HSlider).value = 0.4
		await process_frame
		_expect(absf(AudioServer.get_bus_volume_db(ui_bus) - linear_to_db(0.4)) < 0.05, "SFX slider applies live to UI bus")
		AudioServer.set_bus_volume_db(ui_bus, 0.0)
	var aim_slider := panel.get_node("Content/Values/AimSlider") as HSlider
	var aim_label := panel.get_node("Content/Values/AimLabel") as Label
	_expect(
		aim_slider.editable and not aim_label.text.contains("SẮP CÓ"),
		"Aim Assist is a mouse-editable live setting instead of a coming-soon control"
	)
	panel.free()

	var app_root_source := FileAccess.get_file_as_string("res://game/app/app_root.gd")
	_expect("_apply_bus_volume(&\"UI\", float(settings.get(\"sfx_volume\"" in app_root_source, "persisted SFX volume restores the UI bus")

	if _failures.is_empty():
		print("UI SKIN TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("UI SKIN FAIL: %s" % failure)
		print("UI SKIN TEST FAILED — %d/%d" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)
