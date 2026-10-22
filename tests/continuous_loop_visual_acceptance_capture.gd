extends Node

## OpenGL-only visual acceptance for the continuous combat/progression loop.
## The fixture deliberately uses the production gameplay scene, HUD, physical
## GroundLoot pickup, SaveService inventory, Field Codex and completion chooser.

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const GROUND_LOOT_SCENE: PackedScene = preload("res://game/loot/ground_loot.tscn")
const ENEMY_RARITY_PRESENTATION := preload(
	"res://game/characters/enemies/enemy_rarity_presentation.gd"
)
const IMPACT_BURST_SCRIPT := preload("res://game/feedback/impact_burst.gd")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const ARTIFACT_DIR := "res://.artifacts"

var _expected_size := Vector2i.ZERO
var _checks := 0
var _failures: Array[String] = []
var _previous_gui_input_disabled := false


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_parse_arguments()
	if _expected_size.x <= 0 or _expected_size.y <= 0:
		_fail("capture requires positive --expected-width and --expected-height")
		_finish()
		return
	if DisplayServer.get_name() == "headless":
		_fail("continuous-loop visual acceptance requires a real OpenGL display")
		_finish()
		return
	_previous_gui_input_disabled = bool(get_viewport().get("gui_disable_input"))
	get_viewport().set("gui_disable_input", true)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ARTIFACT_DIR))
	await _exercise_production_loop()
	_finish()


func _exercise_production_loop() -> void:
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "production gameplay scene instantiates")
	if game == null:
		return
	add_child(game)
	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame

	var knight := get_tree().get_first_node_in_group(&"player") as Node2D
	var hud := game.get_node_or_null("HUD") as CanvasLayer
	var progression_hud := hud.find_child("ProgressionFocusHud", true, false) as Control if hud != null else null
	var field_codex := hud.find_child("FieldCodex", true, false) as Control if hud != null else null
	var completion_choice := hud.find_child("CompletionChoice", true, false) as Control if hud != null else null
	_expect(
		knight != null and hud != null and progression_hud != null
			and field_codex != null and completion_choice != null,
		"production Knight, HUD, progression strip, Field Codex and completion chooser are live",
	)
	if knight == null or hud == null or progression_hud == null \
			or field_codex == null or completion_choice == null:
		game.queue_free()
		return

	var tutorial := game.get_node_or_null("LevelOneTutorial")
	if tutorial != null:
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
		var tutorial_panel := tutorial.find_child("TutorialPanel", true, false) as Control
		if tutorial_panel != null:
			tutorial_panel.hide()

	# The production map remains visible, but actors are staged in an authored
	# open room so the review frame is stable at both supported aspect ratios.
	knight.global_position = Vector2(520.0, 320.0)
	knight.set_process(false)
	knight.set_physics_process(false)
	var camera := knight.find_child("Camera", true, false) as Camera2D
	if camera != null:
		camera.reset_smoothing()

	var target := _stage_enemy_target(knight)
	_expect(target != null, "an authored enemy is staged as the selected Rare target")
	if target == null:
		game.queue_free()
		return
	var target_sprite := target.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
	_expect(
		target.get_node_or_null("LootRarityAura") == null
			and target.get_node_or_null("EliteAura") == null
			and target_sprite != null
			and target_sprite.material is ShaderMaterial
			and StringName(target.get_meta(&"enemy_rarity_presented", &"")) == &"rare",
		"selected Rare enemy uses silhouette glow/scale and owns no circular rear aura",
	)

	var world_tint := game.get_node_or_null("WorldTint") as CanvasModulate
	_expect(
		world_tint != null and world_tint.color.get_luminance() > 0.95
			and world_tint.color.a > 0.99,
		"default gameplay has no dark CanvasModulate overlay",
	)

	GameEvents.combat_hit_confirmed.emit(target, 18, target.global_position, {
		"source": &"continuous_loop_visual_acceptance",
	})
	GameEvents.hero_experience_changed.emit(&"sword_hero", 52, 100, 32)
	await get_tree().create_timer(0.10, true).timeout
	await _settle_render(2)
	var world_effects := game.get_node_or_null("CombatFeedback/WorldEffects")
	_expect(
		_has_direct_script_child(world_effects, IMPACT_BURST_SCRIPT),
		"the round shape in the hit frame is a transient CombatImpactBurst, not enemy rarity state",
	)

	var focus_panel := progression_hud.find_child("FocusPanel", true, false) as Control
	var focus_name := progression_hud.find_child("FocusName", true, false) as Label
	var focus_health := progression_hud.find_child("FocusHealth", true, false) as Control
	var xp_panel := progression_hud.find_child("XpPanel", true, false) as Control
	var xp_bar := progression_hud.find_child("XpBar", true, false) as TextureProgressBar
	var xp_value := progression_hud.find_child("XpValue", true, false) as Label
	var action_deck := hud.find_child("ActionDeck", true, false) as Control
	var objective_panel := hud.find_child("ObjectivePanel", true, false) as Control
	var xp_popup := progression_hud.find_child("XpGainPopup", true, false) as Control
	var xp_amount := xp_popup.find_child("AmountLabel", true, false) as Label if xp_popup != null else null
	var top_left_panel := hud.find_child("TopLeftPanel", true, false) as Control
	var top_right_panel := hud.find_child("TopRightPanel", true, false) as Control
	_expect(focus_panel != null and focus_panel.is_visible_in_tree(), "raw selected-target focus is visible")
	_expect(focus_name != null and focus_name.text.contains("(Cấp "), "raw selected-target name includes its stage-scaled level in Vietnamese")
	_expect(focus_health != null and focus_health.is_visible_in_tree(), "raw selected-target focus includes live enemy HP")
	_expect(
		progression_hud.find_child("Paper", true, false) == null
			or progression_hud.find_child("Paper", true, false).get_parent().name != "FocusPanel",
		"selected-target focus has no decorative backing panel",
	)
	_expect(xp_panel != null and _rect_is_on_screen(xp_panel), "long XP strip is fully on-screen")
	_expect(xp_bar != null and is_equal_approx(xp_bar.max_value, 100.0), "XP strip exposes the current XP bucket")
	_expect(xp_value != null and xp_value.text.contains("52 / 100 XP"), "XP strip exposes numeric current/required XP")
	_expect(xp_amount != null and xp_amount.text == "+32 XP" and _rect_is_on_screen(xp_amount), "+XP popup is visible above the strip")
	_expect(action_deck != null and not action_deck.is_visible_in_tree(), "the obsolete four-card desktop action deck stays removed")
	_expect(top_right_panel != null and not top_right_panel.is_visible_in_tree(), "score/sigil/sync telemetry no longer occupies the top-right playfield")
	_expect(top_left_panel is MarginContainer, "player resources use a raw compact margin layout without a backing panel")
	_expect(objective_panel is MarginContainer, "the objective header is raw outlined text without a backing panel")
	_expect(not _controls_overlap(action_deck, xp_panel, 1.0), "combat action deck does not overlap the permanent XP strip")
	_expect(not _controls_overlap(action_deck, xp_popup, 1.0), "+XP popup does not cover combat actions")
	_expect(not _controls_overlap(objective_panel, focus_panel, 1.0), "objective header does not overlap the selected-target plate")
	_expect(not _controls_overlap(top_left_panel, focus_panel, 1.0), "player stats do not overlap the selected-target plate")
	_expect(not _controls_overlap(top_right_panel, focus_panel, 1.0), "score/status panel does not overlap the selected-target plate")
	await _save_and_validate_frame("continuous_loop_enemy_xp", [focus_panel, xp_panel, xp_amount])
	await get_tree().create_timer(0.42, true).timeout
	await _settle_render(2)
	_expect(
		not _has_direct_script_child(world_effects, IMPACT_BURST_SCRIPT)
			and target.get_node_or_null("LootRarityAura") == null
			and target.get_node_or_null("EliteAura") == null,
		"hit burst expires while the Rare enemy keeps only its silhouette-bound presentation",
	)

	# Clear the selected target, then use a real production GroundLoot actor. The
	# fixture first lands outside the magnet radius so the raw rarity/name focus can
	# be captured without reviving the obsolete E-pickup prompt.
	target.hide()
	var loot := await _stage_legendary_ground_loot(game, knight)
	_expect(loot != null, "production Legendary GroundLoot lands near the player")
	if loot == null:
		game.queue_free()
		return
	GameEvents.loot_focus_changed.emit(loot, "TINH CHẤT LINH HỒN", &"legendary", false)
	await _settle_render(4)
	var pickup_prompt := progression_hud.find_child("PickupPrompt", true, false) as Control
	_expect(bool(loot.call(&"is_available_for_pickup")), "ground loot remains physically on the floor outside the magnet radius")
	_expect(not bool(loot.call(&"can_interact", knight)), "ground loot no longer exposes an E interaction contract")
	_expect(pickup_prompt != null and not pickup_prompt.is_visible_in_tree(), "top-center loot focus omits the obsolete E pickup prompt")
	_expect(
		focus_name.text.to_upper().contains("TINH CHẤT LINH HỒN"),
		"top-center raw loot focus names the nearby item with readable capitalization",
	)
	_expect(
		focus_name.text.contains(RarityPalette.display_name(&"legendary"))
			and progression_hud.find_child("FocusRarity", true, false) == null,
		"top-center raw loot name includes the canonical Legendary label without a separate badge",
	)
	var aura := loot.find_child("LootRarityAura", true, false) as CanvasItem
	_expect(aura != null and aura.is_visible_in_tree(), "ground loot renders its rarity aura/VFX")
	_expect(_rect_is_on_screen(focus_panel) and _rect_is_on_screen(xp_panel), "loot focus and XP strip both stay on-screen")
	await _save_and_validate_frame("continuous_loop_ground_loot", [focus_panel, xp_panel])

	# Moving inside the magnet radius must visibly collect the same physical object
	# and mutate the in-run inventory before any result route opens. The production
	# Field Codex reads that live save.
	var revision_before := int(SaveService.get_value(["revision"], -1))
	loot.set(&"global_position", knight.global_position + Vector2(88.0, 3.0))
	await get_tree().create_timer(0.72, true).timeout
	var inventory: Dictionary = SaveService.get_value(["inventory"], {})
	var stacks_value: Variant = inventory.get("item_stacks", {})
	var stacks: Dictionary = stacks_value if stacks_value is Dictionary else {}
	var ember_value: Variant = stacks.get("soul_ember", {})
	var ember: Dictionary = ember_value if ember_value is Dictionary else {}
	_expect(int(ember.get("quantity", 0)) == 7, "pickup immediately commits all seven Soul Embers")
	_expect(int(SaveService.get_value(["revision"], -1)) == revision_before + 1, "pickup commits exactly one durable save revision")
	_expect(not get_tree().paused, "opening inventory during combat does not require pausing the run")
	var level_transaction: Dictionary = SaveService.grant_player_experience(
		100,
		"test:visual_codex:level_two",
	)
	_expect(
		bool(level_transaction.get("applied", false)),
		"visual Codex fixture reaches the Armor unlock through the real XP transaction",
	)
	var comparison_vessel := AUXILIARY_RULES.generate_item(
		&"soul_vessel",
		&"magic",
		2,
		847437,
		&"visual_codex",
		PackedStringArray(["armor_power_percent"]),
	)
	var auxiliary_transaction := SaveService.grant_auxiliary_equipment(
		comparison_vessel,
		"test:visual_codex:comparison_vessel",
	)
	_expect(
		auxiliary_transaction,
		"visual Codex fixture owns one unequipped Magic Armor comparison",
	)
	field_codex.call(&"show_codex", &"equipment")
	await get_tree().create_timer(0.22, true).timeout
	await _settle_render(4)
	var book := field_codex.find_child("Book", true, false) as Control
	var left_page := field_codex.find_child("LeftPage", true, false) as TextureRect
	var right_page := field_codex.find_child("RightPage", true, false) as TextureRect
	var summary := field_codex.find_child("SummaryLabel", true, false) as Label
	var entry_list := field_codex.find_child("EntryList", true, false) as Control
	var live_text := field_codex.find_child("LiveText", true, false) as Control
	var character_stats := field_codex.find_child("CharacterStats", true, false) as Label
	var stats_strip := field_codex.find_child("StatsStrip", true, false) as Control
	var secondary_stats_grid := field_codex.find_child("SecondaryStatsGrid", true, false) as GridContainer
	var section_row := field_codex.find_child("Sections", true, false) as Control
	var equipment_slots := field_codex.find_child("EquipmentSlotGrid", true, false) as Control
	var page_title := field_codex.find_child("PageTitle", true, false) as Label
	_expect(field_codex.is_visible_in_tree() and book != null, "Field Codex opens inside the live gameplay scene")
	_expect(_rect_is_on_screen(book), "BookLite Codex is not cropped at the current viewport")
	_expect(_is_booklite_texture(left_page) and _is_booklite_texture(right_page), "Codex uses the BookLite left/right page assets")
	_expect(
		page_title != null and page_title.text == "KHO 3/30"
			and summary != null and not summary.visible,
		"Codex presents one compact inventory-capacity header without duplicate helper copy",
	)
	_expect(entry_list != null and entry_list.get_child_count() == 30, "picked Soul Embers appear beside visible empty capacity cells immediately")
	_expect(entry_list is GridContainer and (entry_list as GridContainer).columns == 6, "inventory uses a fixed six-by-five matrix without vertical scrolling")
	var first_inventory_tile: Control
	var comparison_inventory_tile: Control
	var first_empty_tile: Control
	if entry_list != null and entry_list.get_child_count() > 0:
		first_inventory_tile = entry_list.get_child(0) as Control
		_expect(
			first_inventory_tile != null
				and first_inventory_tile.scene_file_path.ends_with("field_codex_item_tile.tscn"),
			"inventory matrix instantiates the authored asset-backed item tile",
		)
		var tile_title := first_inventory_tile.find_child("Title", true, false) as Label
		var tile_rarity := first_inventory_tile.find_child("Detail", true, false) as Label
		_expect(
			tile_title != null and tile_rarity != null
				and tile_rarity.text.begins_with("(") and tile_rarity.text.ends_with(")")
				and not tile_title.visible and not tile_rarity.visible
				and not tile_rarity.text.contains("ILVL") and not tile_rarity.text.contains("+"),
			"compact inventory cells keep identity in tooltip/detail instead of cramped inline copy",
		)
	var inventory_tiles: Array[Node] = entry_list.get_children() if entry_list != null else []
	for raw_tile: Node in inventory_tiles:
		var tile := raw_tile as Control
		if tile == null or not tile.has_method(&"get_drag_payload"):
			continue
		var tile_payload: Dictionary = tile.call(&"get_drag_payload")
		if tile_payload.is_empty() and first_empty_tile == null:
			first_empty_tile = tile
		elif StringName(tile_payload.get("kind", &"")) == &"auxiliary_equipment":
			comparison_inventory_tile = tile
	if first_empty_tile != null:
		var empty_border := first_empty_tile.find_child("RarityBorder", true, false) as CanvasItem
		var empty_glow := first_empty_tile.find_child("RarityGlow", true, false) as CanvasItem
		_expect(
			first_empty_tile != null and empty_border != null and not empty_border.visible
				and empty_glow != null and not empty_glow.visible,
			"empty inventory capacity stays visually quiet without rarity border or glow",
		)
	_expect(
		character_stats != null and not character_stats.visible
			and character_stats.text.contains("HP")
			and character_stats.text.contains("MANA")
			and character_stats.text.contains("POWER")
			and stats_strip != null and stats_strip.is_visible_in_tree()
			and _rect_is_on_screen(stats_strip)
			and secondary_stats_grid != null
			and secondary_stats_grid.get_child_count() == 11
			and _rect_is_on_screen(secondary_stats_grid)
			and _control_inside_with_margin(secondary_stats_grid, left_page, 6.0),
		"equipment page exposes four primary values plus eleven compact live secondary stats",
	)
	_expect(live_text != null and not live_text.visible, "generic upgrade hint yields the lower left page to effective equipment stats")
	_expect(section_row != null and section_row.get_child_count() == 2, "Codex visibly exposes exactly two large sections")
	_expect(equipment_slots != null and equipment_slots.get_child_count() == 4, "Codex visibly exposes the selected Hero's four authored equipment slots")
	_expect(not get_tree().paused, "Field Codex remains non-pausing while visible")
	await _save_and_validate_frame(
		"continuous_loop_field_codex",
		[book, stats_strip, secondary_stats_grid, equipment_slots, entry_list],
	)

	# Detail is a decision surface, not a second instruction page. Capture one
	# real owned item to protect the compact title/stat/action hierarchy.
	var detail_inventory_tile := (
		comparison_inventory_tile if comparison_inventory_tile != null else first_inventory_tile
	)
	if detail_inventory_tile != null:
		var first_payload: Variant = detail_inventory_tile.call(&"get_drag_payload")
		field_codex.call(&"_select_inventory_payload", first_payload)
		await _settle_render(4)
		var inventory_detail_area := field_codex.find_child("DetailArea", true, false) as Control
		var inventory_detail_title := field_codex.find_child("DetailTitle", true, false) as Label
		var inventory_detail_text := field_codex.find_child("DetailText", true, false) as RichTextLabel
		var inventory_detail_copy := inventory_detail_text.get_parsed_text() if inventory_detail_text != null else ""
		var has_primary_delta := false
		for primary_delta_name: String in [
			"StatHpDelta", "StatManaDelta", "StatPowerDelta", "StatWeaponDelta",
		]:
			var primary_delta := field_codex.find_child(primary_delta_name, true, false) as Label
			has_primary_delta = has_primary_delta or (
				primary_delta != null and primary_delta.visible
			)
		var has_secondary_delta := false
		for raw_row: Node in secondary_stats_grid.get_children():
			var delta := raw_row.get_node_or_null("Delta") as Label
			has_secondary_delta = has_secondary_delta or (delta != null and delta.visible)
		_expect(
			page_title.text == "CHI TIẾT"
				and inventory_detail_area != null and inventory_detail_area.is_visible_in_tree()
				and inventory_detail_title != null and not inventory_detail_title.text.is_empty()
				and (has_primary_delta or has_secondary_delta)
				and not inventory_detail_copy.contains("HIẾM NHẤT Ở TRÊN")
				and not inventory_detail_copy.contains("Thông số đầy đủ"),
			"item detail keeps only identity, effective stats and actions without helper-copy repetition",
		)
		await _save_and_validate_frame(
			"continuous_loop_field_codex_item_detail",
			[book, inventory_detail_area, inventory_detail_title, inventory_detail_text],
		)
		field_codex.call(&"_return_to_inventory_grid")
		await _settle_render(2)

	# The second (and only other) large section must visibly combine Stat and
	# Skill upgrades on one BookLite spread at both acceptance resolutions.
	field_codex.call(&"_select_section", &"upgrades")
	await _settle_render(4)
	var upgrade_intro := field_codex.find_child("UpgradeIntro", true, false) as Control
	var detail_area := field_codex.find_child("DetailArea", true, false) as Control
	var upgrade_scroll := field_codex.find_child("Scroll", true, false) as ScrollContainer
	var stat_entry: Control
	var skill_entry: Control
	for raw_entry: Node in entry_list.get_children():
		var title := raw_entry.find_child("Title", true, false) as Label
		if title == null:
			continue
		if stat_entry == null and title.text in ["HP", "POWER", "MANA"]:
			stat_entry = raw_entry as Control
		elif skill_entry == null and title.text == "ĐÒN ĐÁNH THƯỜNG":
			skill_entry = raw_entry as Control
	_expect(page_title != null and page_title.text == "PHÂN BỔ", "Upgrade spread uses one short action title for the combined Stat + Skill section")
	_expect(
		upgrade_intro != null and upgrade_intro.is_visible_in_tree()
			and detail_area != null and not detail_area.visible,
		"combined Upgrade spread replaces equipment detail with one shared Stat + Skill introduction",
	)
	_expect(stat_entry != null and skill_entry != null, "combined Upgrade list visibly contains both Stat and Skill rows")
	_expect(
		_rect_is_on_screen(upgrade_intro)
			and _rect_is_on_screen(upgrade_scroll)
			and _rect_is_on_screen(stat_entry)
			and _rect_is_on_screen(skill_entry),
		"combined Upgrade content stays uncropped at the current viewport",
	)
	_expect(
		not _controls_overlap(section_row, upgrade_intro, 1.0)
			and not _controls_overlap(page_title, summary, 1.0)
			and not _controls_overlap(summary, upgrade_scroll, 1.0)
			and not _controls_overlap(stat_entry, skill_entry, 1.0),
		"combined Upgrade controls preserve clear spacing without overlap",
	)
	_expect(not get_tree().paused, "combined Upgrade section remains realtime and non-pausing")
	await _save_and_validate_frame(
		"continuous_loop_field_codex_upgrades",
		[book, upgrade_intro, upgrade_scroll, stat_entry, skill_entry],
	)

	field_codex.call(&"hide_codex")
	await get_tree().process_frame
	var completion_options := {
		"current_level_id": &"chapter_1_level_3",
		"current_difficulty": &"easy",
		"can_continue": true,
		"can_replay": true,
		"levels": [
			{
				"level_id": &"chapter_1_level_1",
				"display_name": "STAGE 1 - OUTER CRYPT",
				"unlocked": true,
				"completed": true,
			},
			{
				"level_id": &"chapter_1_level_2",
				"display_name": "STAGE 2 - BONE HALL",
				"unlocked": true,
				"completed": true,
			},
			{
				"level_id": &"chapter_1_level_3",
				"display_name": "STAGE 3 - REAPER HALL",
				"unlocked": true,
				"completed": true,
			},
			{
				"level_id": &"chapter_1_level_4",
				"display_name": "STAGE 4 - NORTH GATE",
				"unlocked": true,
				"completed": false,
			},
		],
	}
	completion_choice.call(&"present", {
		"level_id": &"chapter_1_level_3",
		"level_display_name": "STAGE 3 - REAPER HALL",
		"outcome": &"victory",
	}, completion_options)
	get_tree().paused = true
	await _settle_render(4)
	var completion_card := completion_choice.find_child("Card", true, false) as Control
	var main_choices := completion_choice.find_child("MainChoices", true, false) as Control
	var win_overlay := hud.find_child("WinOverlay", true, false) as Control
	_expect(completion_choice.is_visible_in_tree() and _rect_is_on_screen(completion_card), "continuation chooser is visible and uncropped")
	_expect(main_choices != null and main_choices.is_visible_in_tree(), "Next / choose level / Home choices are visible")
	_expect(win_overlay != null and not win_overlay.visible, "legacy result/win summary is not shown")
	_expect(_buttons_are_on_screen(completion_choice, ["NextButton", "PickerButton", "HomeButton"]), "all three continuation choices stay on-screen")
	await _save_and_validate_frame("continuous_loop_completion_choice", [completion_card, main_choices])

	completion_choice.call(&"_show_picker")
	completion_choice.call(&"_select_difficulty", &"hard")
	await _settle_render(5)
	var picker := completion_choice.find_child("Picker", true, false) as Control
	var picker_list := completion_choice.find_child("PickerList", true, false) as Control
	var hard_button := completion_choice.find_child("HardButton", true, false) as BaseButton
	var level_scroll := completion_choice.find_child("LevelScroll", true, false) as Control
	_expect(picker != null and picker.is_visible_in_tree() and _rect_is_on_screen(picker), "level/difficulty picker is visible and uncropped")
	_expect(hard_button != null and hard_button.button_pressed, "Hard difficulty is visibly selected")
	_expect(picker_list != null and picker_list.get_child_count() >= 4, "picker exposes cleared farming stages and the next stage")
	_expect(level_scroll != null and _rect_is_on_screen(level_scroll), "scrollable stage list stays inside the viewport")
	_expect(_buttons_are_on_screen(completion_choice, ["EasyButton", "MediumButton", "HardButton", "BackButton"]), "difficulty row and Back button stay on-screen")
	await _save_and_validate_frame("continuous_loop_level_picker", [completion_card, picker])

	get_tree().paused = false
	game.queue_free()
	await get_tree().process_frame


func _stage_enemy_target(knight: Node2D) -> Node2D:
	var target: Node2D
	for raw_enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not raw_enemy is Node2D:
			continue
		var enemy := raw_enemy as Node2D
		enemy.process_mode = Node.PROCESS_MODE_DISABLED
		enemy.hide()
		if target == null:
			target = enemy
	if target == null:
		return null
	target.global_position = knight.global_position + Vector2(48.0, 4.0)
	target.set_meta(&"loot_rarity", &"rare")
	target.set_meta(&"display_name", "MUTANT BONE SENTINEL")
	target.set_meta(&"stage_level", 3)
	ENEMY_RARITY_PRESENTATION.apply_to(target, &"rare")
	target.show()
	return target


func _has_direct_script_child(parent: Node, script: Script) -> bool:
	if parent == null or script == null:
		return false
	for child: Node in parent.get_children():
		if child.get_script() == script:
			return true
	return false


func _stage_legendary_ground_loot(game: Node2D, knight: Node2D) -> Node:
	var payload := {
		"loot_id": "continuous-loop-legendary-ember",
		"kind": &"stackable",
		"family": &"material",
		"display_name": "Tinh Chất Linh Hồn",
		"icon_path": "res://assets/ui/loot/soul_ember.png",
		"item_id": &"soul_ember",
		"inventory_kind": &"material",
		"quantity": 7,
		"rarity": &"legendary",
		"item_level": 3,
		"source": &"boss",
		"source_id": &"continuous_loop_visual_acceptance",
	}
	var loot := GROUND_LOOT_SCENE.instantiate()
	if loot == null or not bool(loot.call(&"configure", payload)):
		if loot != null:
			loot.queue_free()
		return null
	var parent := game.get_node_or_null("Level/Entities")
	if parent == null:
		parent = game.get_node_or_null("Level")
	if parent == null:
		loot.queue_free()
		return null
	parent.add_child(loot)
	loot.call(
		&"launch_from",
		knight.global_position + Vector2(0.0, -32.0),
		knight.global_position + Vector2(118.0, 3.0),
		0.12,
		22.0,
	)
	await get_tree().create_timer(0.22, true).timeout
	await get_tree().process_frame
	return loot


func _is_booklite_texture(texture_rect: TextureRect) -> bool:
	if texture_rect == null or texture_rect.texture == null:
		return false
	return String(texture_rect.texture.resource_path).contains("TravelBookLite")


func _buttons_are_on_screen(root_node: Node, names: Array[String]) -> bool:
	for node_name: String in names:
		var button := root_node.find_child(node_name, true, false) as Control
		if not _rect_is_on_screen(button):
			return false
	return true


func _controls_overlap(first: Control, second: Control, margin := 0.0) -> bool:
	if first == null or second == null or not first.is_visible_in_tree() or not second.is_visible_in_tree():
		return false
	var first_rect := first.get_global_rect().grow(-margin)
	var second_rect := second.get_global_rect().grow(-margin)
	return first_rect.intersects(second_rect, true)


func _control_inside_with_margin(child: Control, parent: Control, margin: float) -> bool:
	if child == null or parent == null \
			or not child.is_visible_in_tree() or not parent.is_visible_in_tree():
		return false
	return parent.get_global_rect().grow(-margin).encloses(child.get_global_rect())


func _rect_is_on_screen(control: Control) -> bool:
	if control == null or not control.is_visible_in_tree():
		return false
	var rect := control.get_global_rect()
	var viewport_rect := get_viewport().get_visible_rect()
	return (
		rect.size.x > 0.0 and rect.size.y > 0.0
		and rect.position.x >= viewport_rect.position.x - 1.0
		and rect.position.y >= viewport_rect.position.y - 1.0
		and rect.end.x <= viewport_rect.end.x + 1.0
		and rect.end.y <= viewport_rect.end.y + 1.0
	)


func _settle_render(frame_count: int) -> void:
	for _frame: int in frame_count:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw


func _save_and_validate_frame(stem: String, key_controls: Array) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(image.get_size() == _expected_size, "%s renders exactly %dx%d" % [stem, _expected_size.x, _expected_size.y])
	var sampled := 0
	var non_dark := 0
	var min_luminance := 1.0
	var max_luminance := 0.0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			var luminance := image.get_pixel(x, y).get_luminance()
			sampled += 1
			if luminance > 0.045:
				non_dark += 1
			min_luminance = minf(min_luminance, luminance)
			max_luminance = maxf(max_luminance, luminance)
	var non_dark_ratio := float(non_dark) / float(maxi(1, sampled))
	_expect(non_dark_ratio > 0.16, "%s is not dark/black (sampled non-dark %.3f)" % [stem, non_dark_ratio])
	_expect(max_luminance - min_luminance > 0.30, "%s retains visible contrast" % stem)
	for raw_control: Variant in key_controls:
		var control := raw_control as Control
		_expect(_rect_is_on_screen(control), "%s key control '%s' is not cropped" % [stem, control.name if control != null else "null"])
		var render_ratio := _control_render_ratio(image, control)
		_expect(render_ratio > 0.18, "%s key control '%s' visibly renders (ratio %.3f)" % [stem, control.name if control != null else "null", render_ratio])
	var filename := "%s_%dx%d.png" % [stem, _expected_size.x, _expected_size.y]
	var output_path := ProjectSettings.globalize_path("%s/%s" % [ARTIFACT_DIR, filename])
	_expect(image.save_png(output_path) == OK, "%s writes its OpenGL PNG" % stem)
	print("CONTINUOUS LOOP CAPTURE: %s" % output_path)
	print("CONTINUOUS LOOP IMAGE: %s non_dark=%.3f contrast=%.3f" % [
		filename,
		non_dark_ratio,
		max_luminance - min_luminance,
	])


func _control_render_ratio(image: Image, control: Control) -> float:
	if control == null:
		return 0.0
	var visible_size := get_viewport().get_visible_rect().size
	if visible_size.x <= 0.0 or visible_size.y <= 0.0:
		return 0.0
	var scale := Vector2(float(image.get_width()) / visible_size.x, float(image.get_height()) / visible_size.y)
	var rect := control.get_global_rect()
	var pixel_rect := Rect2i(
		Vector2i(floori(rect.position.x * scale.x), floori(rect.position.y * scale.y)),
		Vector2i(ceili(rect.size.x * scale.x), ceili(rect.size.y * scale.y)),
	).intersection(Rect2i(Vector2i.ZERO, image.get_size()))
	if pixel_rect.size.x < 2 or pixel_rect.size.y < 2:
		return 0.0
	var sampled := 0
	var visible_pixels := 0
	for y: int in range(pixel_rect.position.y, pixel_rect.end.y, 2):
		for x: int in range(pixel_rect.position.x, pixel_rect.end.x, 2):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.045:
				visible_pixels += 1
	return float(visible_pixels) / float(maxi(1, sampled))


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--expected-width="):
			_expected_size.x = int(argument.trim_prefix("--expected-width="))
		elif argument.begins_with("--expected-height="):
			_expected_size.y = int(argument.trim_prefix("--expected-height="))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_fail(message)


func _fail(message: String) -> void:
	_failures.append(message)
	push_error("CONTINUOUS LOOP VISUAL FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	get_viewport().set("gui_disable_input", _previous_gui_input_disabled)
	if _failures.is_empty():
		print("CONTINUOUS LOOP VISUAL ACCEPTANCE PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("CONTINUOUS LOOP VISUAL ACCEPTANCE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
