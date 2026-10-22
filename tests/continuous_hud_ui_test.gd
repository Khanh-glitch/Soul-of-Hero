extends SceneTree

const PROGRESSION_SCENE := preload("res://game/ui/progression_focus_hud.tscn")
const CODEX_SCENE := preload("res://game/ui/field_codex.tscn")
const FEEDBACK_SCENE := preload("res://game/feedback/combat_feedback.tscn")
const COMPLETION_SCENE := preload("res://game/ui/completion_choice.tscn")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_PRESENTATION := preload(
	"res://game/meta/equipment/auxiliary_equipment_presentation.gd"
)
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

const SCREEN_SIZE := Vector2(640.0, 360.0)
const TOUCH_DASH_RECT := Rect2(548.0, 322.0, 84.0, 34.0)

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node("SaveService")
	var arena := Control.new()
	arena.size = SCREEN_SIZE
	root.add_child(arena)

	var progression := PROGRESSION_SCENE.instantiate() as ProgressionFocusHud
	var codex := CODEX_SCENE.instantiate() as FieldCodex
	var completion := COMPLETION_SCENE.instantiate() as CompletionChoice
	arena.add_child(progression)
	arena.add_child(codex)
	arena.add_child(completion)
	await process_frame
	await process_frame

	var hud_source := FileAccess.get_file_as_string("res://game/ui/hud.gd")
	_expect(
		hud_source.contains("progression_focus_hud.tscn")
			and hud_source.contains("field_codex.tscn")
			and hud_source.contains("completion_choice.tscn"),
		"HUD installs the three authored continuous-flow scenes"
	)
	var codex_source := FileAccess.get_file_as_string("res://game/ui/field_codex.gd")
	_expect(
		not hud_source.contains("get_tree().paused = _field_codex.is_open()")
			and not codex_source.contains("get_tree().paused = true")
			and not codex_source.contains("_owns_world_pause"),
		"Field Codex and its HUD toggle preserve live combat instead of taking ownership of SceneTree pause",
	)

	progression.call("_on_experience_changed", 35, 100, 35)
	await process_frame
	_expect(progression.get_node("XpPanel/XpBar").max_value == 100.0, "XP bar consumes the realtime required-XP bucket")
	_expect(progression.get_node("XpPanel/XpPopupOrigin").get_child_count() == 1, "accepted XP creates a +XP popup above the bar")
	var xp_popup := progression.get_node("XpPanel/XpPopupOrigin").get_child(0) as XpGainPopup
	_expect(
		xp_popup.get_node_or_null("Paper") == null
			and xp_popup.get_node_or_null("Accent") == null
			and progression.get_node_or_null("XpPanel/Backdrop") == null,
		"+XP is raw compact text and the permanent XP strip has no decorative card behind it"
	)
	progression.call("_on_level_changed", 2, 1)
	_expect((progression.get_node("LevelUpBanner") as Control).visible, "level transition shows the level-up banner")
	_expect(
		progression.get_node_or_null("FocusPanel/Paper") == null
			and progression.get_node_or_null("FocusPanel/FocusKind") == null
			and progression.get_node_or_null("FocusPanel/FocusRarity") == null,
		"target focus uses raw rarity-colored text and health instead of nesting another panel"
	)
	var localized_targets := {
		"skeleton": "CHIẾN BINH XƯƠNG",
		"skeleton_reaper": "TỬ THẦN XƯƠNG",
		"bone_reaper_captain": "ĐỘI TRƯỞNG TỬ THẦN",
		"vampire": "MA CÀ RỒNG",
		"crimson_reaper": "TỬ THẦN HUYẾT SẮC",
		"vampire_castellan": "THÀNH CHỦ MA CÀ RỒNG",
	}
	var all_target_names_localized := true
	for entity_type: String in localized_targets:
		var enemy := Node2D.new()
		enemy.set_meta(&"level_entity_type", entity_type)
		all_target_names_localized = all_target_names_localized and progression.call("_enemy_display_name", enemy) == localized_targets[entity_type]
		enemy.free()
	_expect(all_target_names_localized, "top target plate localizes every authored enemy and boss identity")
	var level_enemy := Node2D.new()
	level_enemy.set_meta(&"level_entity_type", "skeleton")
	level_enemy.set_meta(&"stage_level", 6)
	level_enemy.set_meta(&"rarity", &"rare")
	progression.call("_present_enemy_focus", level_enemy)
	_expect(
		(progression.get_node("FocusPanel/FocusName") as Label).text == "CHIẾN BINH XƯƠNG (Cấp 6)",
		"target name exposes the stage-scaled enemy level in one uncluttered line"
	)
	level_enemy.free()

	var xp_rect := (progression.get_node("XpPanel") as Control).get_global_rect()
	var weapon_rect := Rect2(149.0, 248.0, 342.0, 59.0)
	_expect(not weapon_rect.intersects(xp_rect), "desktop action deck sits above the permanent XP strip")
	var xp_popup_sweep := Rect2(335.0, 319.0, 74.0, 30.0)
	_expect(not weapon_rect.intersects(xp_popup_sweep), "+XP popup rises between the action deck and XP strip without crossing controls")
	var max_scale_dash := _scaled_about_center(TOUCH_DASH_RECT, 1.5)
	var mirrored_dash := Rect2(SCREEN_SIZE.x - TOUCH_DASH_RECT.end.x, TOUCH_DASH_RECT.position.y, TOUCH_DASH_RECT.size.x, TOUCH_DASH_RECT.size.y)
	var max_scale_mirrored_dash := _scaled_about_center(mirrored_dash, 1.5)
	_expect(
		not max_scale_dash.intersects(xp_rect) and not max_scale_mirrored_dash.intersects(xp_rect),
		"640x360 XP strip clears the touch Dash button in both hands at maximum UI scale"
	)

	var focus_rect := (progression.get_node("FocusPanel") as Control).get_global_rect()
	var top_left_rect := Rect2(8.0, 8.0, 208.0, 80.0)
	var toast_rect := Rect2(180.0, 85.0, 280.0, 29.0)
	var tutorial_rect := Rect2(116.0, 118.0, 408.0, 33.0)
	var tutorial_source := FileAccess.get_file_as_string("res://game/tutorial/level_one_tutorial.tscn")
	_expect(
		not focus_rect.intersects(top_left_rect)
			and not tutorial_rect.intersects(focus_rect)
			and not tutorial_rect.intersects(toast_rect)
			and tutorial_source.contains("UI_TravelBook_Popup01a.png")
			and tutorial_source.contains("offset_top = 118.0"),
		"tutorial prompt is asset-backed and stacked below focus/toast UI"
	)

	var was_paused := paused
	# Build one real auxiliary item and one alternate Hero Soul. These remain
	# isolated in the runner's unique save and exercise the same atomic APIs used
	# by pickup/equipment during play.
	save.call(&"grant_hero_experience", &"sword_hero", 100, "test:continuous_ui:sword_level_two")
	var vessel := AUXILIARY_RULES.generate_item(
		&"soul_vessel",
		&"magic",
		2,
		771201,
		&"continuous_ui",
		PackedStringArray(["armor_power_percent"]),
	)
	var vessel_presentation: Dictionary = AUXILIARY_PRESENTATION.presentation_for(vessel)
	_expect(bool(save.call(&"grant_auxiliary_equipment", vessel, "test:continuous_ui:vessel")), "fixture grants one real equippable Vessel")
	var axe_soul := HERO_SOUL_RULES.create_instance(
		&"axe_hero", HERO_SOUL_RULES.Rarity.MAGIC, 2, &"continuous_ui", 771202, HERO_SOUL_RULES.AFFINITY_WARRIOR
	)
	_expect(bool(save.call(&"unlock_story_hero", &"axe_hero", "test:continuous_ui:axe_unlock")), "fixture unlocks Axe through story authority")
	_expect(bool(save.call(&"grant_hero_soul", axe_soul, "test:continuous_ui:axe_soul")), "fixture grants one real alternate Hero Soul equipment item")
	var pair_snapshot: Dictionary = save.call(&"get_snapshot")
	var pair_selections: Dictionary = (pair_snapshot.get("soul_team", {}) as Dictionary).get("selected_soul_instances", {})
	var sword_weapon_id := String(pair_selections.get("sword_hero", ""))
	var reserve_weapon_ids: Array[String] = [String(axe_soul.get("instance_id", ""))]
	_expect(bool(save.call(
		&"set_soul_team_instances",
		sword_weapon_id,
		reserve_weapon_ids,
		"test:continuous_ui:fixed_pair",
	)), "fixture fixes Sword and Axe as the two-Hero run pair")
	codex.show_codex(&"equipment")
	await process_frame
	_expect(codex.visible and paused == was_paused, "opening Field Codex preserves the live combat pause state")
	var left_page := codex.get_node("Book/LeftPage") as TextureRect
	var right_page := codex.get_node("Book/RightPage") as TextureRect
	_expect(left_page.texture.resource_path.contains("BookPageLeft") and right_page.texture.resource_path.contains("BookPageRight"), "Field Codex uses both authored BookLite page assets")
	var sections := codex.get_node("Book/Sections")
	_expect(
		sections.get_child_count() == 2
			and codex.get_node_or_null("Book/Sections/EquipmentSection") != null
			and codex.get_node_or_null("Book/Sections/UpgradeSection") != null
			and codex.get_node_or_null("Book/Tabs") == null,
		"Field Codex has exactly two large sections instead of five fragmented tabs"
	)
	var slot_grid := codex.get_node("Book/EquipmentSlotArea/EquipmentSlotGrid")
	var empty_slot_count := 0
	for raw_slot: Node in slot_grid.get_children():
		var slot := raw_slot as FieldCodexEquipmentSlot
		if slot != null and slot.get_equipped_item().is_empty():
			empty_slot_count += 1
	_expect(slot_grid.get_child_count() == 4 and empty_slot_count >= 3, "equipment page exposes the selected Hero's four-slot loadout, including visible empty slots")
	var weapon_slot := slot_grid.get_child(0) as FieldCodexEquipmentSlot
	var boots_slot := slot_grid.get_child(2) as FieldCodexEquipmentSlot
	var jewelry_slot := slot_grid.get_child(3) as FieldCodexEquipmentSlot
	_expect(
		weapon_slot != null and weapon_slot.get_equipment_slot_id() == &"hero_weapon"
			and boots_slot != null
			and boots_slot.get_equipment_slot_id() == &"boots"
			and jewelry_slot != null
			and jewelry_slot.get_equipment_slot_id() == &"jewelry",
		"the four slots are Hero Weapon, Armor, Boots and Jewelry",
	)
	var inventory_grid := codex.get_node("Book/Scroll/EntryList") as GridContainer
	var inventory_scroll := codex.get_node("Book/Scroll") as ScrollContainer
	var character_stats := codex.get_node("Book/EquipmentSlotArea/CharacterStats") as Label
	var secondary_stats_grid := codex.get_node("Book/EquipmentSlotArea/SecondaryStatsGrid") as GridContainer
	_expect(
		inventory_grid.columns == 6
			and inventory_grid.get_child_count() == 30
			and inventory_scroll.vertical_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED,
		"equipment inventory exposes the complete 6x5 thirty-slot surface without vertical scrolling",
	)
	_expect(
		character_stats.text.contains("HP")
			and character_stats.text.contains("MANA")
			and character_stats.text.contains("POWER")
			and character_stats.text.contains("VŨ KHÍ"),
		"effective character HP, Mana, Power and weapon output share the equipment/inventory page",
	)
	var barrier_row := _secondary_stat_row(secondary_stats_grid, "barrier_capacity_percent")
	var dodge_row := _secondary_stat_row(secondary_stats_grid, "dodge_chance_percent")
	var mana_regen_row := _secondary_stat_row(secondary_stats_grid, "mana_regen_per_second")
	_expect(
		secondary_stats_grid.get_child_count() == 11
			and barrier_row != null and (barrier_row.get_node("Value") as Label).text == "0%"
			and dodge_row != null and (dodge_row.get_node("Value") as Label).text == "0%"
			and mana_regen_row != null and (mana_regen_row.get_node("Value") as Label).text == "2",
		"the compact secondary table exposes visible Barrier, Dodge and base Mana regeneration",
	)
	_expect(
		(codex.get_node("Book/PageTitle") as Label).text.begins_with("KHO ")
			and not (codex.get_node("Book/SummaryLabel") as Label).visible
			and (codex.get_node("Book/Brand") as Label).text.contains("LV"),
		"Field Codex uses one compact inventory count header and moves hero context to the opposite page",
	)

	var vessel_entry: FieldCodexEntry
	var axe_entry: FieldCodexEntry
	for raw_entry: Node in codex.get_node("Book/Scroll/EntryList").get_children():
		var entry := raw_entry as FieldCodexEntry
		if entry == null:
			continue
		var payload := entry.get_drag_payload()
		if StringName(payload.get("kind", &"")) == &"auxiliary_equipment":
			vessel_entry = entry
		elif StringName(payload.get("kind", &"")) == &"hero_soul" \
				and String((payload.get("item", {}) as Dictionary).get("hero_id", "")) == "axe_hero" \
				and String((payload.get("item", {}) as Dictionary).get("instance_id", "")) \
					== String(axe_soul.get("instance_id", "")):
			axe_entry = entry
	_expect(vessel_entry != null and axe_entry != null, "one inventory stream contains ordinary gear and Hero Soul equipment together")
	var vessel_tile_title := vessel_entry.get_node("Title") as Label
	var vessel_tile_rarity := vessel_entry.get_node("Detail") as Label
	_expect(
		vessel_tile_title.text == String(vessel_presentation.get("display_name", ""))
			and vessel_tile_rarity.text == "(MA THUẬT)"
			and not vessel_tile_title.text.contains("+")
			and not vessel_tile_rarity.text.contains("Cấp")
			and not vessel_tile_rarity.text.contains("ILVL"),
		"inventory tiles show only the item name and Vietnamese rarity, without cramped stat effects",
	)
	var vessel_payload := vessel_entry.get_drag_payload()
	codex.call("_select_inventory_payload", vessel_payload)
	var vessel_detail := codex.get_node("Book/DetailArea/DetailText") as RichTextLabel
	var vessel_detail_copy := vessel_detail.get_parsed_text()
	_expect(
		(codex.get_node("Book/DetailArea/DetailTitle") as Label).text \
			== "%s (MA THUẬT)" % String(vessel_presentation.get("display_name", ""))
			and vessel_detail_copy.contains("CẤP 2")
			and vessel_detail_copy.contains("CHÍNH")
			and vessel_detail_copy.contains("MA THUẬT")
			and not vessel_detail_copy.contains("CHỨC NĂNG")
			and not vessel_detail_copy.contains("HIẾM NHẤT Ở TRÊN")
			and vessel_detail.text.contains("[color=#")
			and (codex.get_node("Book/DetailArea/EquipAction") as Button).text == "TRANG BỊ",
		"gear detail keeps only decision-relevant localized stats, rarity color and a clear action"
	)
	var preview_delta_visible := false
	for delta_name: String in ["StatHpDelta", "StatManaDelta", "StatPowerDelta", "StatWeaponDelta"]:
		preview_delta_visible = preview_delta_visible or (codex.get_node("%%%s" % delta_name) as Label).visible
	_expect(
		preview_delta_visible,
		"selecting unequipped gear previews its authoritative combat projection as a +/− stat delta",
	)
	_expect(
		(codex.get_node("%StatPowerDelta") as Label).visible,
		"Armor Power previews through the same authoritative Hero projection",
	)
	var upgrade_action := codex.get_node("Book/DetailArea/UpgradeAction") as Button
	_expect(
		upgrade_action.visible
			and upgrade_action.text == "NÂNG +1"
			and upgrade_action.tooltip_text.contains("cùng độ hiếm"),
		"gear detail exposes the live same-rarity stone upgrade action without adding inventory clutter",
	)
	_expect(
		not (codex.get_node("Book/Scroll") as ScrollContainer).visible
			and (codex.get_node("Book/DetailArea") as Control).visible
			and (codex.get_node("Book/DetailArea/BackAction") as Button).text == "QUAY LẠI",
		"item selection replaces the grid with a roomy authored detail view that can return to the matrix",
	)
	codex.call("_equip_selected")
	_expect(
		String(_save_value(save, ["hero_loadouts", "sword_hero", "armor"], "")) == String(vessel.get("uuid", "")),
		"detail Equip action commits Armor to the selected Hero loadout"
	)
	var preview_cleared := true
	for delta_name: String in ["StatHpDelta", "StatManaDelta", "StatPowerDelta", "StatWeaponDelta"]:
		preview_cleared = preview_cleared and not (codex.get_node("%%%s" % delta_name) as Label).visible
	_expect(preview_cleared, "equipping the previewed item clears comparison deltas after live stats refresh")
	var vessel_slot := codex.get_node("Book/EquipmentSlotArea/EquipmentSlotGrid").get_child(1) as FieldCodexEquipmentSlot
	var active_soul_slot := codex.get_node("Book/EquipmentSlotArea/EquipmentSlotGrid").get_child(0) as FieldCodexEquipmentSlot
	var axe_payload := axe_entry.get_drag_payload()
	_expect(
		vessel_slot.can_accept_payload(vessel_payload)
			and not vessel_slot.can_accept_payload(axe_payload)
			and not active_soul_slot.can_accept_payload(axe_payload)
			and not active_soul_slot.can_accept_payload(vessel_payload),
		"drag targets reject wrong gear families and Hero Weapons belonging to another Hero"
	)
	codex.call("_select_inventory_payload", axe_payload)
	var axe_detail_label := codex.get_node("Book/DetailArea/DetailText") as RichTextLabel
	var axe_detail := axe_detail_label.get_parsed_text()
	_expect(
		axe_detail.contains("POWER VŨ KHÍ")
			and axe_detail.contains("CẤP 2")
			and axe_detail.contains("MA THUẬT")
			and not axe_detail.contains("HIẾM NHẤT Ở TRÊN")
			and axe_detail_label.text.contains("[color=#"),
		"Hero Soul detail exposes authoritative weapon Power and rarity-colored affixes without helper copy",
	)
	var sorted_affixes: Array = codex.call("_sorted_affixes", [
		{"affix_id": "lower", "tier": 2, "value": 8.0},
		{"affix_id": "higher", "tier": 6, "value": 1.0},
	], 0)
	_expect(
		int((sorted_affixes[0] as Dictionary).get("tier", -1)) == 6,
		"equipment detail sorting places the rarest affix before numerically larger lower-tier affixes",
	)
	codex.call("_equip_selected")
	_expect(
		String(_save_value(save, ["soul_team", "active_hero"], "")) == "sword_hero",
		"equipping from the wrong Hero page cannot mutate the fixed run pair"
	)
	(codex.get_node("%NextEquipmentHero") as Button).emit_signal(&"pressed")
	_expect(
		(codex.get_node("Book/Brand") as Label).text.contains("CHIẾN BINH RÌU")
			and String(_save_value(save, ["soul_team", "active_hero"], "")) == "sword_hero",
		"Hero selector changes the inspected loadout without switching the live combat Hero",
	)
	active_soul_slot = codex.get_node("Book/EquipmentSlotArea/EquipmentSlotGrid").get_child(0) as FieldCodexEquipmentSlot
	_expect(
		active_soul_slot.can_accept_payload(axe_payload)
			and String(active_soul_slot.get_equipped_item().get("instance_id", ""))
				== String(axe_soul.get("instance_id", "")),
		"Axe page exposes Axe's own Hero Weapon in its dedicated slot",
	)

	codex.call("_select_section", &"upgrades")
	await process_frame
	var has_stat_entry := false
	var has_skill_entry := false
	for raw_entry: Node in codex.get_node("Book/Scroll/EntryList").get_children():
		var title := (raw_entry.get_node("Title") as Label).text
		has_stat_entry = has_stat_entry or title in ["HP", "POWER", "MANA"]
		has_skill_entry = has_skill_entry or title == "ĐÒN ĐÁNH THƯỜNG"
	_expect(
		has_stat_entry and has_skill_entry
			and not (codex.get_node("Book/DetailArea") as Control).visible
			and (codex.get_node("Book/UpgradeIntro") as Control).visible,
		"the second large section combines Stat and Skill upgrades in one scrollable page"
	)
	(codex.get_node("Book/Sections/UpgradeSection") as Button).grab_focus()
	var tab_event := InputEventAction.new()
	tab_event.action = &"field_codex"
	tab_event.pressed = true
	codex.call("_input", tab_event)
	_expect(not codex.visible, "Tab closes Field Codex even while a Book button owns GUI focus")
	codex.hide_codex()

	completion.present({"level_id": "chapter_1_level_1", "level_display_name": "Hầm Mộ I"}, {
		"current_level_id": "chapter_1_level_1",
		"current_difficulty": &"easy",
		"can_continue": true,
		"can_replay": true,
		"levels": [
			{"level_id": "chapter_1_level_1", "display_name": "Hầm Mộ I", "unlocked": true, "completed": true},
			{"level_id": "chapter_1_level_2", "display_name": "Hầm Mộ II", "unlocked": true, "completed": false},
		],
	})
	_expect(completion.visible and not (completion.get_node("Card/MainChoices/Buttons/NextButton") as Button).disabled, "completion question offers immediate continuation")
	completion.call("_show_picker")
	await process_frame
	var picker_list := completion.get_node("Card/Picker/LevelScroll/PickerList")
	_expect((completion.get_node("Card/Picker") as Control).visible and picker_list.get_child_count() == 2, "completion question exposes cleared and newly unlocked levels")
	completion.call("_select_difficulty", &"hard")
	await process_frame
	var cleared_action := picker_list.get_child(0).get_node("ActionButton") as Button
	var uncleared_action := picker_list.get_child(1).get_node("ActionButton") as Button
	_expect(not cleared_action.disabled and uncleared_action.disabled, "Hard replay is available only after that level has been cleared on Easy")
	completion.hide()

	var feedback := FEEDBACK_SCENE.instantiate() as CombatFeedback
	arena.add_child(feedback)
	await process_frame
	feedback.present_confirmed_hit(null, 42, Vector2(80, 80), {
		"is_critical": true,
		"hit_stop_seconds": 0.0,
		"shake_seconds": 0.0,
		"show_overlay": false,
	})
	var damage_number := feedback.get_node("WorldEffects").get_child(0) as PixelDamageNumber
	var damage_glyphs := damage_number.get_node_or_null("GlyphText") as PixelGlyphSpriteText if damage_number != null else null
	_expect(
		damage_number != null
			and damage_number.get_node_or_null("Paper") == null
			and damage_glyphs != null
			and is_equal_approx(damage_glyphs.get_pixel_size(), 1.5)
			and damage_glyphs.get_text_color().is_equal_approx(Color("ff4d55"))
			and damage_number.scale.x < 0.8,
		"critical damage keeps the original 1.5px glyph, reads red, and starts its fast zoom from a compact scale"
	)
	await create_timer(0.055, true).timeout
	_expect(damage_number != null and damage_number.scale.x > 1.2, "critical damage reaches a stronger but controlled zoom peak")
	var combo := feedback.get_node("PresentationLayer/ComboHitCounter") as ComboHitCounter
	combo.register_confirmed_hit(4, 2.0)
	var combo_glyphs := combo.get_node_or_null("GlyphText") as PixelGlyphSpriteText
	_expect(
		combo.get_node_or_null("Paper") == null
			and combo_glyphs != null
			and combo_glyphs.get_text() == "4 HIT"
			and is_equal_approx(combo_glyphs.get_pixel_size(), 2.0)
			and combo.scale.x < 0.8,
		"combo popup keeps the original 2px '%d HIT' glyphs and starts its fast zoom from a compact scale"
	)
	await create_timer(0.055, true).timeout
	_expect(combo.scale.x > 1.15, "combo popup reaches its quick punch peak before settling")
	var damage_source := FileAccess.get_file_as_string("res://game/feedback/pixel_damage_number.gd")
	var combo_source := FileAccess.get_file_as_string("res://game/feedback/combo_hit_counter.gd")
	var glyph_source := FileAccess.get_file_as_string("res://game/feedback/pixel_glyph_sprite_text.gd")
	_expect(
		not damage_source.contains("func _draw")
			and not combo_source.contains("func _draw")
			and not glyph_source.contains("func _draw")
			and damage_source.contains("Vector2.ONE * 0.16")
			and combo_source.contains("Vector2.ONE * 0.14"),
		"damage/combo use the static glyph atlas and shrink away instead of zooming larger on exit"
	)

	# Stop authored UI SFX before tearing the scene down. Headless Godot keeps an
	# audio playback reference for one mix tick after a playing node is freed,
	# which otherwise turns a green contract run into an ObjectDB leak failure.
	for audio_node: Node in arena.find_children("*", "AudioStreamPlayer", true, false):
		(audio_node as AudioStreamPlayer).stop()
	await create_timer(0.10, true).timeout
	arena.free()
	await create_timer(0.10, true).timeout
	Engine.time_scale = 1.0
	if _failures.is_empty():
		print("CONTINUOUS HUD UI TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("CONTINUOUS HUD UI TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _secondary_stat_row(grid: GridContainer, stat_id: String) -> Control:
	if grid == null:
		return null
	for child: Node in grid.get_children():
		if String(child.get_meta(&"stat_id", "")) == stat_id:
			return child as Control
	return null


func _scaled_about_center(rect: Rect2, scale_factor: float) -> Rect2:
	var scaled_size := rect.size * scale_factor
	return Rect2(rect.get_center() - scaled_size * 0.5, scaled_size)


func _save_value(save: Node, path: Array, fallback: Variant) -> Variant:
	var cursor: Variant = save.call(&"get_snapshot")
	for raw_segment: Variant in path:
		var segment := String(raw_segment)
		if not cursor is Dictionary or not (cursor as Dictionary).has(segment):
			return fallback
		cursor = (cursor as Dictionary)[segment]
	return cursor


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
