extends SceneTree

const TEST_SAVE_PATH := "user://tests/archer_soul_codex_test.json"
const REPORT_PATH := "res://.artifacts/archer_soul_codex_report.json"
const FIELD_CODEX_SCENE: PackedScene = preload("res://game/ui/field_codex.tscn")
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const ARCHER_SOUL_ASSETS := preload("res://game/loot/archer_soul_asset_catalog.gd")
const ARCHER_DROP_RULES := preload("res://game/loot/archer_soul_drop_rules.gd")

var _checks := 0
var _failures: Array[String] = []
var _fixture_root: Control


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		_finish()
		return

	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated Archer Codex profile loads")

	var archer_soul := HERO_SOUL_RULES.create_instance(
		&"archer_hero",
		HERO_SOUL_RULES.Rarity.NORMAL,
		5,
		&"chapter_1_level_5_archer_drop",
		15005,
		HERO_SOUL_RULES.AFFINITY_RANGER,
		&"",
		PackedStringArray(["normal_attack", "ranged", "projectile", "active", "summon", "departure", "relay"]),
	)
	_expect(
		not archer_soul.is_empty() and HERO_SOUL_RULES.validate_instance(archer_soul).is_empty(),
		"Normal Level 5 Archer Soul fixture validates",
	)
	_expect(
		save.grant_hero_soul(
			archer_soul,
			"test:archer_soul_codex:grant",
			{"equipment_id": "bow", "equipment_family": "hero_soul"},
		),
		"Archer Soul enters inventory.hero_souls through the authoritative API",
	)
	var boots := AUXILIARY_RULES.generate_item(&"soul_boots", &"rare", 5, 15006, &"codex_upgrade_ui")
	_expect(not boots.is_empty(), "Rare boots fixture is generated for the upgrade UI")
	_expect(
		save.grant_auxiliary_equipment(boots, "test:archer_soul_codex:grant_boots"),
		"Rare boots enter the shared equipment inventory",
	)
	var stone := AUXILIARY_PRESENTATION.upgrade_stone_presentation("rare")
	_expect(
		save.grant_inventory_item(
			StringName(stone.get("item_id", "")),
			&"material",
			1,
			"test:archer_soul_codex:grant_upgrade_stone",
			stone,
		),
		"one stored-icon Rare upgrade stone enters the inventory",
	)
	var ground_loot_payload := ARCHER_DROP_RULES.build_guaranteed_payload(
		{"run_id": "archer-codex-asset-check", "difficulty": &"hard", "stage_level": 5},
		save.get_snapshot(),
	)
	var ground_loot_soul: Dictionary = ground_loot_payload.get("item", {}) \
		if ground_loot_payload.get("item", {}) is Dictionary else {}
	_expect(
		String(ground_loot_payload.get("icon_path", "")) \
			== ARCHER_SOUL_ASSETS.icon_path(ground_loot_soul.get("rarity", 0)),
		"physical GroundLoot payload selects its Bow icon from the same rarity catalog",
	)

	_fixture_root = Control.new()
	_fixture_root.size = Vector2(1280.0, 720.0)
	root.add_child(_fixture_root)
	var codex := FIELD_CODEX_SCENE.instantiate() as FieldCodex
	_fixture_root.add_child(codex)
	codex.show_codex(&"equipment")
	await process_frame
	await process_frame

	var matrix := codex.get_node("Book/Scroll/EntryList") as GridContainer
	var equipment_grid := codex.get_node("Book/EquipmentSlotArea/EquipmentSlotGrid") as GridContainer
	var equipment_slot_ids := PackedStringArray()
	for raw_slot: Node in equipment_grid.get_children():
		var equipment_slot := raw_slot as FieldCodexEquipmentSlot
		if equipment_slot != null:
			equipment_slot_ids.append(String(equipment_slot.get_equipment_slot_id()))
	_expect(
		equipment_slot_ids == PackedStringArray([
			"soul_active",
			"soul_reserve_0",
			"soul_reserve_1",
			"soul_vessel",
			"soul_boots",
			"soul_trace",
		]),
		"equipment grid keeps Armor fourth, Boots fifth, and Jewelry sixth with no Soul Focus slot",
	)
	var boots_slot_icon := codex.call(&"_auxiliary_icon", {}, "soul_boots") as Texture2D
	var jewelry_slot_icon := codex.call(&"_auxiliary_icon", {}, "soul_trace") as Texture2D
	_expect(
		boots_slot_icon != null and boots_slot_icon.resource_path.ends_with("Icon221.png")
			and jewelry_slot_icon != null and jewelry_slot_icon.resource_path.ends_with("Icon241.png"),
		"canonical empty slot icons use Boots 221 and Jewelry 241",
	)
	var archer_entry: FieldCodexEntry
	var archer_payload: Dictionary = {}
	var boots_entry: FieldCodexEntry
	var boots_payload: Dictionary = {}
	var stone_entry: FieldCodexEntry
	var stone_payload: Dictionary = {}
	for raw_entry: Node in matrix.get_children():
		var entry := raw_entry as FieldCodexEntry
		if entry == null:
			continue
		var payload := entry.get_drag_payload()
		var item: Dictionary = payload.get("item", {}) if payload.get("item", {}) is Dictionary else {}
		if StringName(payload.get("kind", &"")) == &"hero_soul" \
				and String(item.get("hero_id", "")) == "archer_hero":
			archer_entry = entry
			archer_payload = payload
		elif StringName(payload.get("kind", &"")) == &"auxiliary_equipment" \
				and String(item.get("uuid", "")) == String(boots.get("uuid", "")):
			boots_entry = entry
			boots_payload = payload
		elif String(payload.get("key", "")) == "stack:%s" % String(stone.get("item_id", "")):
			stone_entry = entry
			stone_payload = payload

	_expect(
		matrix.columns == 6 and matrix.get_child_count() == 30,
		"inventory uses the fixed 6x5 matrix without vertical overflow",
	)
	_expect(archer_entry != null, "Archer Soul is visible as one inventory matrix tile")
	_expect(boots_entry != null, "Rare boots are visible as one inventory matrix tile")
	_expect(stone_entry != null, "Rare upgrade stone is visible as one material tile")
	if archer_entry == null or boots_entry == null or stone_entry == null:
		_finish()
		return
	_expect(
		String(boots_payload.get("title", "")).ends_with("+0")
			and String(boots_payload.get("list_detail", "")).contains("+0"),
		"new auxiliary gear exposes +0 in both inventory title and detail",
	)
	var stone_icon := stone_payload.get("icon", null) as Texture2D
	_expect(
		stone_icon != null and stone_icon.resource_path == String(stone.get("icon_path", "")),
		"upgrade-stone tile renders the icon_path stored in its stack record",
	)

	var title := archer_entry.get_node("Title") as Label
	var rarity := archer_entry.get_node("Detail") as Label
	var icon := archer_entry.get_node("Icon") as TextureRect
	_expect(
		title.text == "Cung Linh Hồn" and rarity.text == "(THƯỜNG)",
		"matrix tile shows only the Vietnamese Archer name and Normal rarity",
	)
	_expect(
		icon.visible and icon.texture != null \
			and icon.texture.resource_path == ARCHER_SOUL_ASSETS.icon_path(HERO_SOUL_RULES.Rarity.NORMAL),
		"Archer Soul tile uses the authored Bow atlas asset",
	)
	var distinct_bow_paths := {}
	for rarity_index: int in range(HERO_SOUL_RULES.MAX_RARITY + 1):
		var bow_path := ARCHER_SOUL_ASSETS.icon_path(rarity_index)
		distinct_bow_paths[bow_path] = true
		_expect(ResourceLoader.exists(bow_path), "rarity %d resolves one imported Bow asset" % rarity_index)
	_expect(distinct_bow_paths.size() == 8, "all eight Archer Soul rarities use distinct curated Bow icons")
	_expect(
		String(archer_payload.get("key", "")) == "soul:%s" % String(archer_soul.get("instance_id", "")),
		"matrix tile points at the exact collected Soul instance",
	)

	codex.call(&"_select_inventory_payload", archer_payload)
	await process_frame
	var detail_title := codex.get_node("Book/DetailArea/DetailTitle") as Label
	var detail_text := codex.get_node("Book/DetailArea/DetailText") as RichTextLabel
	var equip_action := codex.get_node("Book/DetailArea/EquipAction") as Button
	var upgrade_action := codex.get_node("Book/DetailArea/UpgradeAction") as Button
	_expect(
		detail_title.text == "Cung Linh Hồn (THƯỜNG)",
		"clicking the tile opens the matching Vietnamese detail title",
	)
	_expect(
		detail_text.text.contains("POWER VŨ KHÍ  103%")
			and detail_text.text.contains("0/0 THUỘC TÍNH")
			and detail_text.text.contains("Chưa có thuộc tính ở độ hiếm này."),
		"details expose Bow weapon scaling and the Normal rarity affix capacity",
	)
	_expect(
		equip_action.visible and not equip_action.disabled and equip_action.text == "TRANG BỊ",
		"Archer Soul detail exposes an enabled Equip action",
	)
	_expect(not upgrade_action.visible, "Hero Soul detail never exposes the auxiliary upgrade action")

	codex.call(&"_equip_selected")
	await process_frame
	var team: Dictionary = save.get_value(["soul_team"], {})
	var selected: Dictionary = team.get("selected_soul_instances", {}) if team.get("selected_soul_instances", {}) is Dictionary else {}
	_expect(
		(team.get("reserve_souls", []) as Array).has("archer_hero")
			and String(selected.get("archer_hero", "")) == String(archer_soul.get("instance_id", "")),
		"Equip places the exact Archer Soul into a Reserve slot",
	)
	var saved_archers := 0
	var inventory: Dictionary = save.get_value(["inventory"], {})
	for raw_soul: Variant in inventory.get("hero_souls", []):
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("hero_id", "")) == "archer_hero":
			saved_archers += 1
	_expect(saved_archers == 1, "Codex Equip preserves exactly one owned Archer Soul")

	codex.call(&"_select_inventory_payload", stone_payload)
	await process_frame
	_expect(not upgrade_action.visible, "upgrade material detail never exposes an Upgrade action")

	codex.call(&"_select_inventory_payload", boots_payload)
	await process_frame
	_expect(
		detail_title.text.ends_with("+0 (HIẾM)")
			and detail_text.text.contains("+0/5")
			and detail_text.text.contains("1 ĐÁ CÙNG ĐỘ HIẾM"),
		"auxiliary detail exposes rank, cap, and same-rarity stone requirement",
	)
	_expect(
		upgrade_action.visible and not upgrade_action.disabled
			and upgrade_action.text == "NÂNG +1"
			and upgrade_action.tooltip_text.contains("cùng độ hiếm"),
		"rank-zero auxiliary detail exposes one clear enabled Upgrade action",
	)
	upgrade_action.emit_signal(&"pressed")
	await process_frame
	await process_frame
	var upgraded_item: Dictionary = {}
	var upgraded_inventory: Dictionary = save.get_value(["inventory"], {})
	for raw_item: Variant in upgraded_inventory.get("auxiliary_equipment", []):
		if raw_item is Dictionary \
				and String((raw_item as Dictionary).get("uuid", "")) == String(boots.get("uuid", "")):
			upgraded_item = raw_item as Dictionary
			break
	_expect(
		int(upgraded_item.get("upgrade_rank", -1)) == 1
			and not (upgraded_inventory.get("item_stacks", {}) as Dictionary).has(
				String(stone.get("item_id", "")),
			),
		"Upgrade button consumes exactly one same-rarity stone and advances exactly one rank",
	)
	_expect(
		String(codex.get("_selected_key")) == "gear:%s" % String(boots.get("uuid", ""))
			and detail_title.text.ends_with("+1 (HIẾM)")
			and detail_text.text.contains("+1/5"),
		"successful upgrade refreshes the detail in place and retains selection by UUID",
	)
	var max_rank_item := upgraded_item.duplicate(true)
	max_rank_item["upgrade_rank"] = AUXILIARY_RULES.MAX_UPGRADE_RANK
	var max_rank_payload: Dictionary = codex.call(
		&"_auxiliary_payload",
		max_rank_item,
		save.get_snapshot(),
	)
	codex.call(&"_render_item_detail", max_rank_payload)
	_expect(
		not upgrade_action.visible and detail_text.text.contains("ĐÃ TỐI ĐA"),
		"+5 auxiliary detail hides Upgrade and communicates the hard cap",
	)

	_finish()


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if is_instance_valid(_fixture_root):
		for audio_node: Node in _fixture_root.find_children("*", "AudioStreamPlayer", true, false):
			(audio_node as AudioStreamPlayer).stop()
		_fixture_root.free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {
		"checks": _checks,
		"passed": _checks - _failures.size(),
		"failures": _failures.duplicate(),
		"scope": "6x5 Field Codex inventory, Hero Soul actions, auxiliary +N details, stored stone icon, and atomic Upgrade action",
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("ARCHER SOUL CODEX TEST PASSED - %d checks" % _checks)
		_finish_after_cleanup.call_deferred(0)
		return
	for failure: String in _failures:
		push_error("ARCHER SOUL CODEX FAIL: " + failure)
	_finish_after_cleanup.call_deferred(1)


func _finish_after_cleanup(exit_code: int) -> void:
	await process_frame
	await create_timer(0.10, true).timeout
	quit(exit_code)


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
