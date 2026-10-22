extends Node

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const HOME_SCENE: PackedScene = preload("res://game/ui/screens/home/home_map_screen.tscn")
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const CHEST_SCENE: PackedScene = preload("res://game/world/interactables/chest.tscn")
const CHEST_CATALOG := preload("res://game/world/interactables/chest_visual_catalog.gd")
const LEVEL_SEVEN_PATH := "res://data/levels/chapter_1_level_7.json"
const ARTIFACT_DIR := "res://.artifacts"

var _checks := 0
var _failures: Array[String] = []
var _case_name := ""
var _expected_width := 0
var _expected_height := 0
var _previous_gui_input_disabled := false
var _gui_input_guard_active := false


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_parse_arguments()
	if _case_name not in [
		"axe", "level7_beacon", "roster_souls", "roster_skills", "roster_aux", "chest_catalog",
	]:
		_fail("capture case must be a supported gameplay, roster, or chest catalog case")
		_finish()
		return
	if _expected_width <= 0 or _expected_height <= 0:
		_fail("capture requires positive --expected-width and --expected-height")
		_finish()
		return

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ARTIFACT_DIR))
	if _case_name == "axe":
		await _capture_axe_gameplay()
	elif _case_name == "level7_beacon":
		await _capture_level_seven_beacon()
	elif _case_name == "chest_catalog":
		await _capture_chest_catalog()
	else:
		await _capture_roster_case(_case_name)
	_finish()


func _capture_chest_catalog() -> void:
	_disable_gui_input_for_capture()
	var showcase := Node2D.new()
	showcase.name = "ChestCatalogShowcase"
	add_child(showcase)

	var background := ColorRect.new()
	background.size = Vector2(640.0, 360.0)
	background.color = Color("110f17")
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	showcase.add_child(background)
	showcase.add_child(_showcase_label(
		"TREASURE CHEST • THỨ TỰ TĂNG DẦN TRÁI → PHẢI",
		Vector2(24.0, 18.0), Vector2(592.0, 24.0), 17, Color("f0cc79"),
	))
	showcase.add_child(_showcase_label(
		"RƯƠNG THƯỜNG • 9 CẤP (CẤP 9 = ETERNAL JACKPOT)",
		Vector2(24.0, 63.0), Vector2(592.0, 20.0), 11, Color("8fd7ef"),
	))
	showcase.add_child(_showcase_label(
		"RƯƠNG QUÁI • 6 CẤP (RARE → ETERNAL)",
		Vector2(24.0, 203.0), Vector2(592.0, 20.0), 11, Color("e8a0c3"),
	))

	var spawned: Array[RewardChest] = []
	var seen_visual_ids := {}
	for index: int in CHEST_CATALOG.REGULAR_ENTRIES.size():
		var entry: Dictionary = CHEST_CATALOG.REGULAR_ENTRIES[index]
		var chest := CHEST_SCENE.instantiate() as RewardChest
		chest.chest_family = "regular"
		chest.rarity_override = String(entry.get("rarity", "normal"))
		chest.guaranteed_jackpot = index == CHEST_CATALOG.REGULAR_ENTRIES.size() - 1
		chest.position = Vector2(48.0 + float(index) * 68.0, 126.0)
		showcase.add_child(chest)
		spawned.append(chest)
		showcase.add_child(_showcase_label(
			"R%d" % (index + 1),
			Vector2(chest.position.x - 24.0, 139.0), Vector2(48.0, 16.0), 9,
			Color("f0cc79"),
		))

	for index: int in CHEST_CATALOG.MONSTER_ENTRIES.size():
		var entry: Dictionary = CHEST_CATALOG.MONSTER_ENTRIES[index]
		var chest := CHEST_SCENE.instantiate() as RewardChest
		chest.chest_family = "monster"
		chest.rarity_override = String(entry.get("rarity", "rare"))
		chest.position = Vector2(145.0 + float(index) * 70.0, 276.0)
		showcase.add_child(chest)
		spawned.append(chest)
		showcase.add_child(_showcase_label(
			"M%d" % (index + 1),
			Vector2(chest.position.x - 24.0, 289.0), Vector2(48.0, 16.0), 9,
			Color("e8a0c3"),
		))

	for _frame: int in 4:
		await get_tree().process_frame
	for chest: RewardChest in spawned:
		var entry := chest.get_visual_entry()
		seen_visual_ids[String(entry.get("id", ""))] = true
		_expect(chest.animated_sprite.scale == Vector2.ONE, "Chest showcase preserves native 32x32 scale")
		_expect(chest.animated_sprite.sprite_frames != null, "Chest showcase resolves runtime SpriteFrames")
	_expect(spawned.size() == 15, "Chest showcase instantiates all nine regular and six monster grades")
	_expect(seen_visual_ids.size() == 15, "Chest showcase resolves fifteen distinct authored atlas regions")

	await _settle_render(8)
	await _save_and_validate_frame("visual_acceptance_chest_catalog")
	showcase.queue_free()
	await get_tree().process_frame


func _showcase_label(
		copy: String,
		position: Vector2,
		size: Vector2,
		font_size: int,
		color: Color,
) -> Label:
	var label := Label.new()
	label.text = copy
	label.position = position
	label.size = size
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _capture_axe_gameplay() -> void:
	var game := await _spawn_game("")
	_expect(game != null, "production gameplay scene starts for the Axe capture")
	if game == null:
		return
	var knight := get_tree().get_first_node_in_group(&"player")
	var hud := game.get_node_or_null("HUD") as CanvasLayer
	_expect(knight != null and hud != null, "production Knight and HUD are present")
	if knight == null or hud == null:
		game.queue_free()
		return

	# Use the real progression authority, but only inside the GUID-scoped profile
	# supplied by the PowerShell runner. One allocated HP point is intentionally
	# enough to make the live HUD prove that progression reached combat.
	_expect(
		SaveService.grant_player_levels(1, "visual_acceptance_player_level_2", {"capture": "axe"}),
		"isolated profile reaches player level two",
	)
	_expect(
		SaveService.allocate_player_stat(&"hp", 1, "visual_acceptance_hp_point"),
		"isolated profile allocates one real HP point",
	)
	_expect(
		bool(knight.call(&"configure_soul_team_from_run", {
			"active_hero": "axe_hero",
			"reserve_souls": ["sword_hero", ""],
			"capacity": 2,
		})),
		"production Soul Team equips Axe as the active Hero",
	)
	_expect(
		bool(knight.call(&"refresh_auxiliary_equipment_from_save", SaveService.get_snapshot())),
		"live Knight consumes the isolated progression snapshot",
	)

	# Keep the Hero in an authored open room so the character, Axe form, and HUD
	# remain legible in the compact embedded-game viewport.
	(knight as Node2D).global_position = Vector2(520.0, 320.0)
	var camera := knight.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
	for enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		if enemy is CanvasItem:
			(enemy as CanvasItem).hide()
		enemy.process_mode = Node.PROCESS_MODE_DISABLED

	_expect(int(knight.get("max_health")) > 100, "progressed Max HP is greater than the authored 100")
	_expect(
		bool(knight.call(&"_begin_axe_charge")),
		"production Axe charge action begins",
	)
	knight.call(&"_handle_action", 0.58)
	# Stage an honest insufficient-Mana state so the review frame proves both
	# the current/max resource row and the Hero-aware Active Skill warning.
	knight.call(&"_set_mana", 12.0)
	knight.set_physics_process(false)
	knight.set_process(false)
	hud.call(&"_sync_hero_hud")
	var health_value := hud.get_node("%HealthValue") as Label
	var mana_value := hud.get_node("%ManaValue") as Label
	var hand_label := hud.get_node("%HandLabel") as Label
	var hand_status := hud.get_node("%HandStatus") as Label
	var charge_ratio := float(knight.call(&"get_axe_charge_ratio"))
	_expect(charge_ratio > 0.1, "live Axe charge ratio visibly advances")
	_expect(
		hand_label.text.contains("AXE") and hand_label.text.contains("TỤ LỰC") and not hand_label.text.contains("COMBO"),
		"Axe state uses Vietnamese charge copy and never the old fake combo copy",
	)
	_expect(
		hand_status.text.contains("NÉM") or hand_status.text.contains("THU HỒI"),
		"Axe state exposes throw/recall in Vietnamese",
	)
	_expect(not (hud.get_node("%WeaponPanel") as Control).visible, "capture keeps the bottom combo/weapon strip removed")
	_expect(
		hand_status.text.contains("THIẾU MANA") and hand_status.text.contains("12/24"),
		"Axe HUD visibly explains the insufficient-Mana state",
	)
	_expect(
		mana_value.text == "12/%d" % roundi(float(knight.get("max_mana"))),
		"HUD visibly reports current/max Mana",
	)
	_expect(
		health_value.text == "%d/%d" % [int(knight.get("health")), int(knight.get("max_health"))]
			and int(knight.get("max_health")) > 100,
		"HUD visibly reports progressed HP",
	)
	_expect(_rect_is_on_screen(hud.get_node("%TopRightPanel") as Control), "Axe status panel stays on-screen")
	_expect(_rect_is_on_screen(health_value), "progressed HP label stays on-screen")
	_expect(_rect_is_on_screen(mana_value), "current/max Mana label stays on-screen")

	await _settle_render(8)
	await _save_and_validate_frame("visual_acceptance_axe")
	game.queue_free()
	await get_tree().process_frame


func _capture_level_seven_beacon() -> void:
	var game := await _spawn_game(LEVEL_SEVEN_PATH)
	_expect(game != null, "production gameplay scene starts Level 7")
	if game == null:
		return
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var knight := get_tree().get_first_node_in_group(&"player")
	var runtime := game.get_node_or_null("Level7BeaconRuntime")
	var hud := game.get_node_or_null("HUD") as CanvasLayer
	_expect(entity_root != null and knight != null and runtime != null and hud != null, "Level 7 runtime, world, Knight, and HUD are live")
	if entity_root == null or knight == null or runtime == null or hud == null:
		game.queue_free()
		return

	_expect(bool(runtime.call(&"force_start_next_wave_for_test")), "real Wave 1 starts through the Beacon runtime")
	var snapshot: Dictionary = runtime.call(&"get_snapshot")
	_expect(
		int(snapshot.get("wave", 0)) == 1 and int(snapshot.get("active_enemies", 0)) == 5,
		"Wave 1 has five active authored enemies",
	)
	var beacon: Node2D
	var active_enemies: Array[Node2D] = []
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if entity_id == "l7_soul_beacon" and child is Node2D:
			beacon = child as Node2D
		elif entity_id.begins_with("l7_w1_") and child is Node2D and (child as CanvasItem).visible:
			active_enemies.append(child as Node2D)
	_expect(beacon != null and beacon.visible, "Soul Beacon is a visible world objective")
	_expect(active_enemies.size() == 5, "all five Wave 1 enemies are visible")
	if beacon == null:
		game.queue_free()
		return

	# Wave actors keep their production visuals/state but are staged near the
	# objective and frozen for a deterministic, reviewable acceptance frame.
	var offsets := [
		Vector2(-210.0, 85.0),
		Vector2(210.0, 85.0),
		Vector2(-130.0, 135.0),
		Vector2(130.0, 135.0),
		Vector2(0.0, 135.0),
	]
	for index: int in active_enemies.size():
		var enemy := active_enemies[index]
		enemy.global_position = beacon.global_position + offsets[index]
		enemy.process_mode = Node.PROCESS_MODE_DISABLED
		enemy.show()
	(knight as Node2D).global_position = beacon.global_position + Vector2(0.0, 52.0)
	knight.set_physics_process(false)
	knight.set_process(false)
	var camera := knight.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()

	var status_label := runtime.get_node_or_null("BeaconHUD/BeaconHUDRoot/BeaconStatusPanel/MarginContainer/VBoxContainer/BeaconStatusLabel") as Label
	if status_label == null:
		status_label = runtime.find_child("BeaconStatusLabel", true, false) as Label
	var health_label := runtime.find_child("BeaconHealthLabel", true, false) as Label
	var wave_label := runtime.find_child("WaveLabel", true, false) as Label
	var beacon_panel := runtime.find_child("BeaconStatusPanel", true, false) as Control
	var objective_label := hud.get_node("%ObjectiveLabel") as Label
	_expect(
		status_label != null and status_label.visible and status_label.text.contains("HẢI ĐĂNG") and status_label.text.contains("MỤC TIÊU"),
		"Beacon HUD names the live defense objective and remaining threats",
	)
	_expect(health_label != null and health_label.text.contains("/"), "Beacon HUD shows objective health")
	_expect(wave_label != null and wave_label.text.contains("1/3"), "Beacon HUD shows Wave 1/3")
	_expect(objective_label.visible and not objective_label.text.is_empty(), "shared gameplay objective remains visible")
	_expect(beacon_panel != null and _rect_is_on_screen(beacon_panel), "Beacon telemetry panel stays on-screen")
	_expect(_rect_is_on_screen(objective_label), "shared objective panel stays on-screen")

	await _settle_render(10)
	await _save_and_validate_frame("visual_acceptance_level7_beacon")
	game.queue_free()
	await get_tree().process_frame


func _capture_roster_case(capture_case: String) -> void:
	_disable_gui_input_for_capture()
	var seeded := _seed_roster_profile()
	if seeded.is_empty():
		return
	var home := HOME_SCENE.instantiate()
	_expect(home != null, "production Home Map scene starts for roster acceptance")
	if home == null:
		return
	add_child(home)
	await get_tree().process_frame
	_clear_tooltips(home)
	home.call(&"open_function", &"hero_roster")
	# open_function synchronously instantiates the production Roster. Clear its
	# unattended-hover tooltips before the first desktop frame can open a native
	# tooltip subwindow over the viewport texture.
	_clear_tooltips(home)
	for _frame: int in 6:
		await get_tree().process_frame
		_clear_tooltips(home)
	var roster := home.find_child("HeroRosterTab", true, false)
	var tabs := home.find_child("RosterTabs", true, false) as TabContainer
	_expect(roster != null and tabs != null, "production Hero Roster overlay and all tabs are live")
	if roster == null or tabs == null:
		home.queue_free()
		return

	roster.call(&"_select_soul", String(seeded.get("sword_instance_id", "")))
	roster.call(&"_refresh")
	await get_tree().process_frame
	await get_tree().process_frame
	_clear_tooltips(home)
	var sword_card := roster.find_child("SwordIdentityButton", true, false) as Button
	var axe_card := roster.find_child("AxeIdentityButton", true, false) as Button
	var soul_detail := roster.find_child("SoulDetail", true, false) as VBoxContainer
	_expect(
		sword_card != null and sword_card.text.contains("2 HERO WEAPON"),
		"Roster visibly distinguishes at least two owned Sword Hero Weapons",
	)
	_expect(
		axe_card != null and not axe_card.disabled and axe_card.text.contains("1 HERO WEAPON"),
		"Roster visibly owns Axe and its basic Hero Weapon",
	)
	_expect(soul_detail != null, "exact-instance Soul detail exists")
	var detail_text := _all_label_text(soul_detail)
	_expect(
		detail_text.contains(String(seeded.get("sword_instance_id", ""))),
		"Soul detail exposes the exact selected instance ID",
	)
	_expect(detail_text.contains("TRẠNG THÁI BẢN SAO") and detail_text.contains("ĐANG ÁP DỤNG TRONG ĐỘI"), "selected exact Sword copy is visibly live in the team")
	_expect(detail_text.contains("HP tối đa") and detail_text.contains("ĐANG ÁP DỤNG"), "supported Hero Soul affix is marked live in Vietnamese")
	_expect(detail_text.contains("Giáp ảo") and not detail_text.contains("CHƯA KÍCH HOẠT"), "every visible Hero Weapon affix is backed by live gameplay")

	# The right detail column is intentionally scrollable at 847x437. Bring the
	# adjacent live affix rows into the real clipped viewport while
	# leaving the multi-copy inventory and exact selected star visible at left.
	var barrier_label := _find_label_containing(soul_detail, "Giáp ảo")
	var live_label := _find_label_containing(soul_detail, "HP tối đa")
	var detail_scroll := soul_detail.get_parent() as ScrollContainer
	if detail_scroll != null and barrier_label != null:
		detail_scroll.ensure_control_visible(barrier_label)
		await get_tree().process_frame
		await get_tree().process_frame
	_expect(
		barrier_label != null and detail_scroll != null and _control_intersects_clip(barrier_label, detail_scroll),
		"visible Barrier row is actually visible inside the compact detail scroller",
	)
	_expect(
		live_label != null and detail_scroll != null and _control_intersects_clip(live_label, detail_scroll),
		"live HP affix row remains visible next to the Barrier row",
	)
	_expect(_rect_is_on_screen(tabs), "Roster tabs stay on-screen at 847x437")
	if capture_case == "roster_souls":
		await get_tree().create_timer(0.25, true).timeout
		await get_tree().process_frame
		await get_tree().process_frame
		await _settle_render(8)
		await _save_and_validate_frame("visual_acceptance_roster_souls")
		home.queue_free()
		await get_tree().process_frame
		return

	if capture_case == "roster_aux":
		tabs.current_tab = 3
		await get_tree().process_frame
		await get_tree().process_frame
		await get_tree().create_timer(0.25, true).timeout
		var aux_icons := roster.find_children("AuxItemIcon", "TextureRect", true, false)
		_expect(aux_icons.size() == 3, "Aux Gear renders one semantic RPG400 icon for every live slot")
		for icon_node: Node in aux_icons:
			_expect((icon_node as TextureRect).texture != null, "Aux Gear icon texture resolves in the production roster")
		var aux_copy := _all_label_text(roster)
		_expect(
			aux_copy.contains("HERO WEAPON")
				and aux_copy.contains("GIÁP")
				and aux_copy.contains("GIÀY")
				and aux_copy.contains("TRANG SỨC"),
			"Hero Equipment exposes Weapon plus the three universal gear families",
		)
		await _settle_render(8)
		await _save_and_validate_frame("visual_acceptance_roster_aux")
		home.queue_free()
		await get_tree().process_frame
		return

	# The sibling Skills tab uses the same seeded Sword/Axe ownership. Capturing
	# it separately proves the selector and the all-six-tracks-live copy survive
	# the compact viewport without relying on AppRoot's generic shell fixture.
	tabs.current_tab = 2
	await get_tree().process_frame
	await get_tree().process_frame
	# Match the production shell capture's atlas/layout settling window. Rapidly
	# changing a clipped TabContainer and reading the next render frame can omit
	# unchanged header draw commands on some GL compatibility drivers.
	await get_tree().create_timer(0.25, true).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	var sword_skill_button := roster.find_child("SwordSkillIdentityButton", true, false) as Button
	var axe_skill_button := roster.find_child("AxeSkillIdentityButton", true, false) as Button
	var all_live_label := _find_label_containing(roster, "CẢ 6 NHÁNH ÁP DỤNG TỨC THÌ")
	_expect(
		sword_skill_button != null and not sword_skill_button.disabled,
		"Skills selector enables owned Sword",
	)
	_expect(
		axe_skill_button != null and not axe_skill_button.disabled,
		"Skills selector enables owned Axe",
	)
	_expect(
		all_live_label != null and _rect_is_on_screen(all_live_label),
		"Skills tab visibly states that all six tracks are live",
	)
	await _settle_render(8)
	await _save_and_validate_frame("visual_acceptance_roster_skills")
	home.queue_free()
	await get_tree().process_frame


func _seed_roster_profile() -> Dictionary:
	_expect(
		SaveService.grant_player_levels(9, "visual_acceptance_roster_level_10", {"capture": "roster"}),
		"isolated roster profile reaches Level 10",
	)
	_expect(
		UnlockService.unlock_feature(&"skill_allocation", "visual_acceptance_skill_allocation"),
		"isolated roster profile unlocks Skill allocation",
	)
	_expect(
		UnlockService.unlock_feature(&"skill_respec", "visual_acceptance_skill_respec"),
		"isolated roster profile unlocks Skill respec",
	)
	_expect(
		SaveService.unlock_story_hero(&"axe_hero", "visual_acceptance_axe_story_unlock"),
		"isolated roster profile unlocks Axe through story authority",
	)
	var sword_soul: Dictionary = SOUL_RULES.create_instance(
		&"sword_hero",
		SOUL_RULES.Rarity.RARE,
		10,
		&"visual_acceptance_sword_copy",
		97101,
		SOUL_RULES.AFFINITY_WARRIOR,
	)
	sword_soul["affixes"] = [
		{"affix_id": "max_hp", "unit": "percent", "value": 5.0},
		{"affix_id": "barrier_capacity", "unit": "percent_max_hp", "value": 5.0},
	]
	var axe_soul := _first_inventory_hero_weapon("axe_hero")
	_expect(
		SOUL_RULES.validate_instance(sword_soul).is_empty() and SOUL_RULES.validate_instance(axe_soul).is_empty(),
		"seeded Sword/Axe Hero Souls satisfy production validation",
	)
	_expect(
		SaveService.grant_hero_soul(sword_soul, "visual_acceptance_grant_sword_copy", {"capture": "roster"}),
		"isolated profile receives a second exact Sword Soul copy",
	)
	var reserve_instance_ids: Array[String] = [String(axe_soul.get("instance_id", ""))]
	_expect(
		SaveService.set_soul_team_instances(
			String(sword_soul.get("instance_id", "")),
			reserve_instance_ids,
			"visual_acceptance_exact_soul_team",
		),
		"exact Sword copy becomes Active and exact Axe copy becomes Reserve",
	)
	_expect(
		SaveService.allocate_hero_skill(&"sword_hero", &"normal_attack", 1, "visual_acceptance_sword_rank"),
		"Sword receives one persisted live skill rank",
	)
	_expect(
		SaveService.allocate_hero_skill(&"axe_hero", &"active_skill", 1, "visual_acceptance_axe_rank"),
		"Axe receives one persisted live skill rank",
	)
	var auxiliary_items := [
		AUX_RULES.generate_item(&"soul_vessel", &"legendary", 10, 97111, &"visual_acceptance"),
		AUX_RULES.generate_item(&"soul_boots", &"crystal", 10, 97112, &"visual_acceptance"),
		AUX_RULES.generate_item(&"soul_trace", &"mythic", 10, 97113, &"visual_acceptance"),
	]
	for item_index: int in auxiliary_items.size():
		var auxiliary_item: Dictionary = auxiliary_items[item_index]
		_expect(
			SaveService.grant_auxiliary_equipment(
				auxiliary_item,
				"visual_acceptance_aux_grant_%d" % item_index,
				{"capture": "roster_aux"},
			),
			"isolated roster profile receives semantic auxiliary item %d" % (item_index + 1),
		)
		var hero_slot := StringName(["armor", "boots", "jewelry"][item_index])
		_expect(
			SaveService.equip_hero_item(
				&"sword_hero",
				hero_slot,
				String(auxiliary_item.get("uuid", "")),
				"visual_acceptance_aux_equip_%d" % item_index,
			),
			"semantic auxiliary item %d is equipped to the selected Hero" % (item_index + 1),
		)
	var inventory: Array = SaveService.get_value(["inventory", "hero_souls"], [])
	var sword_count := 0
	var axe_count := 0
	for raw_soul: Variant in inventory:
		if not raw_soul is Dictionary:
			continue
		var hero_id := String((raw_soul as Dictionary).get("hero_id", ""))
		if hero_id == "sword_hero":
			sword_count += 1
		elif hero_id == "axe_hero":
			axe_count += 1
	_expect(sword_count >= 2 and axe_count >= 1, "isolated inventory contains two Sword copies and Axe")
	if not _failures.is_empty():
		return {}
	return {
		"sword_instance_id": String(sword_soul.get("instance_id", "")),
		"axe_instance_id": String(axe_soul.get("instance_id", "")),
	}


func _first_inventory_hero_weapon(hero_id: String) -> Dictionary:
	for raw_weapon: Variant in SaveService.get_value(["inventory", "hero_souls"], []):
		if raw_weapon is Dictionary \
				and String((raw_weapon as Dictionary).get("hero_id", "")) == hero_id:
			return (raw_weapon as Dictionary).duplicate(true)
	return {}


func _spawn_game(level_path: String) -> Node2D:
	var game := GAME_SCENE.instantiate() as Node2D
	if game == null:
		return null
	if not level_path.is_empty():
		var dungeon := game.get_node("Level")
		dungeon.set("level_data_path", level_path)
		dungeon.set("watch_file_changes", false)
	add_child(game)
	for _frame: int in 4:
		await get_tree().process_frame
	await get_tree().physics_frame
	if not game.has_method(&"get_runtime_snapshot"):
		_fail("production Main script did not load")
		game.queue_free()
		await get_tree().process_frame
		return null
	var tutorial := game.get_node_or_null("LevelOneTutorial")
	if tutorial != null:
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
		var tutorial_panel := tutorial.get_node_or_null("TutorialPanel") as Control
		if tutorial_panel != null:
			tutorial_panel.hide()
	return game


func _settle_render(frame_count: int) -> void:
	for _frame: int in frame_count:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw


func _save_and_validate_frame(stem: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_expect(
		image.get_width() == _expected_width and image.get_height() == _expected_height,
		"rendered frame is exactly %dx%d" % [_expected_width, _expected_height],
	)
	var sampled := 0
	var non_dark := 0
	var min_luminance := 1.0
	var max_luminance := 0.0
	for y: int in range(0, image.get_height(), 8):
		for x: int in range(0, image.get_width(), 8):
			var color := image.get_pixel(x, y)
			var luminance := color.get_luminance()
			sampled += 1
			if luminance > 0.035:
				non_dark += 1
			min_luminance = minf(min_luminance, luminance)
			max_luminance = maxf(max_luminance, luminance)
	var non_dark_ratio := float(non_dark) / float(maxi(1, sampled))
	_expect(non_dark_ratio > 0.08, "capture is not black (sampled non-dark ratio %.3f)" % non_dark_ratio)
	_expect(max_luminance - min_luminance > 0.25, "capture has visible contrast and is not collapsed")
	if stem.begins_with("visual_acceptance_roster_"):
		var back_button := get_tree().root.find_child("BackToMapButton", true, false) as Control
		var header_render_ratio := _control_render_ratio(image, back_button)
		_expect(
			header_render_ratio > 0.25,
			"Roster shell header is actually rendered, not covered by an opaque popup (ratio %.3f)" % header_render_ratio,
		)
		print("VISUAL ACCEPTANCE ROSTER HEADER: non_dark=%.3f" % header_render_ratio)

	var filename := "%s_%dx%d.png" % [stem, _expected_width, _expected_height]
	var output_path := ProjectSettings.globalize_path("%s/%s" % [ARTIFACT_DIR, filename])
	var save_error := image.save_png(output_path)
	_expect(save_error == OK, "OpenGL frame writes %s" % filename)
	print("VISUAL ACCEPTANCE CAPTURE: %s" % output_path)
	print("VISUAL ACCEPTANCE IMAGE: %dx%d non_dark=%.3f contrast=%.3f" % [
		image.get_width(),
		image.get_height(),
		non_dark_ratio,
		max_luminance - min_luminance,
	])


func _control_render_ratio(image: Image, control: Control) -> float:
	if control == null:
		return 0.0
	var visible_size := get_viewport().get_visible_rect().size
	if visible_size.x <= 0.0 or visible_size.y <= 0.0:
		return 0.0
	var scale := Vector2(
		float(image.get_width()) / visible_size.x,
		float(image.get_height()) / visible_size.y,
	)
	var logical_rect := control.get_global_rect()
	var pixel_rect := Rect2i(
		Vector2i(floori(logical_rect.position.x * scale.x), floori(logical_rect.position.y * scale.y)),
		Vector2i(ceili(logical_rect.size.x * scale.x), ceili(logical_rect.size.y * scale.y)),
	).intersection(Rect2i(Vector2i.ZERO, image.get_size()))
	if pixel_rect.size.x < 2 or pixel_rect.size.y < 2:
		return 0.0
	var sampled := 0
	var non_dark := 0
	for y: int in range(pixel_rect.position.y, pixel_rect.end.y, 2):
		for x: int in range(pixel_rect.position.x, pixel_rect.end.x, 2):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.04:
				non_dark += 1
	return float(non_dark) / float(maxi(1, sampled))


func _rect_is_on_screen(control: Control) -> bool:
	if control == null or not control.is_visible_in_tree():
		return false
	var rect := control.get_global_rect()
	var visible_rect := get_viewport().get_visible_rect()
	return (
		rect.position.x >= -1.0
		and rect.position.y >= -1.0
		and rect.end.x <= visible_rect.end.x + 1.0
		and rect.end.y <= visible_rect.end.y + 1.0
	)


func _control_intersects_clip(control: Control, clip: Control) -> bool:
	return (
		control != null
		and clip != null
		and control.is_visible_in_tree()
		and control.get_global_rect().intersects(clip.get_global_rect(), true)
	)


func _all_label_text(root_node: Node) -> String:
	if root_node == null:
		return ""
	var lines: Array[String] = []
	for descendant: Node in root_node.find_children("*", "Label", true, false):
		lines.append((descendant as Label).text)
	return "\n".join(lines)


func _find_label_containing(root_node: Node, needle: String) -> Label:
	if root_node == null:
		return null
	for descendant: Node in root_node.find_children("*", "Label", true, false):
		var label := descendant as Label
		if label.text.contains(needle):
			return label
	return null


func _clear_tooltips(root_node: Node) -> void:
	# Native tooltip subwindows can cover a viewport-texture read when an
	# unattended capture happens to inherit the desktop cursor position. They are
	# unrelated to the UI state under review, so disable them on this scene copy.
	if root_node is Control:
		(root_node as Control).tooltip_text = ""
	for descendant: Node in root_node.find_children("*", "Control", true, false):
		(descendant as Control).tooltip_text = ""


func _disable_gui_input_for_capture() -> void:
	var viewport := get_viewport()
	_previous_gui_input_disabled = bool(viewport.get("gui_disable_input"))
	viewport.set("gui_disable_input", true)
	_gui_input_guard_active = true


func _restore_gui_input() -> void:
	if not _gui_input_guard_active:
		return
	get_viewport().set("gui_disable_input", _previous_gui_input_disabled)
	_gui_input_guard_active = false


func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--visual-case="):
			_case_name = argument.trim_prefix("--visual-case=").strip_edges()
		elif argument.begins_with("--expected-width="):
			_expected_width = int(argument.trim_prefix("--expected-width="))
		elif argument.begins_with("--expected-height="):
			_expected_height = int(argument.trim_prefix("--expected-height="))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_fail(message)


func _fail(message: String) -> void:
	_failures.append(message)
	push_error("VISUAL ACCEPTANCE FAIL: %s" % message)


func _finish() -> void:
	_restore_gui_input()
	if _failures.is_empty():
		print("VISUAL RUNTIME ACCEPTANCE PASSED - %s - %d checks" % [_case_name, _checks])
		get_tree().quit(0)
		return
	print("VISUAL RUNTIME ACCEPTANCE FAILED - %s - %d/%d checks failed" % [
		_case_name,
		_failures.size(),
		_checks,
	])
	get_tree().quit(1)
