extends SceneTree

const CATALOG := preload("res://game/world/interactables/chest_visual_catalog.gd")
const CHEST_SCENE_PATH := "res://game/world/interactables/chest.tscn"
const REPORT_PATH := "res://.artifacts/chest_visual_catalog_report.json"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_catalog_contract()
	await _test_runtime_selection()
	_finish()


func _test_catalog_contract() -> void:
	var errors := CATALOG.get_catalog_errors()
	_expect(errors.is_empty(), "Chest visual catalog validates: %s" % "; ".join(errors))
	_expect(CATALOG.REGULAR_ENTRIES.size() == 9, "atlas exposes nine regular chest grades")
	_expect(CATALOG.MONSTER_ENTRIES.size() == 6, "atlas exposes six monster chest grades")

	var expected_regular_rarities := [
		&"normal", &"magic", &"rare", &"epic", &"legendary", &"crystal", &"mythic",
		&"eternal", &"eternal",
	]
	var expected_monster_rarities := [
		&"rare", &"epic", &"legendary", &"crystal", &"mythic", &"eternal",
	]
	for index: int in CATALOG.REGULAR_ENTRIES.size():
		var entry: Dictionary = CATALOG.REGULAR_ENTRIES[index]
		_expect(entry.get("rarity") == expected_regular_rarities[index],
			"regular tier %d maps to the approved rarity" % (index + 1))
		_assert_entry_regions(entry, index / 3, index % 3)
	for index: int in CATALOG.MONSTER_ENTRIES.size():
		var entry: Dictionary = CATALOG.MONSTER_ENTRIES[index]
		_expect(entry.get("rarity") == expected_monster_rarities[index],
			"monster tier %d maps Rare through Eternal" % (index + 1))
		_assert_entry_regions(entry, 3 + index / 3, index % 3)

	var jackpot: Dictionary = CATALOG.entry_for(&"eternal", &"regular", true)
	_expect(int(jackpot.get("tier", 0)) == 9, "regular jackpot selects visual grade nine")
	_expect(jackpot.get("rarity") == &"eternal", "grade nine remains core Eternal rarity")
	_expect(jackpot.get("special") == CATALOG.SPECIAL_JACKPOT,
		"grade nine declares its jackpot presentation role")
	_expect(CATALOG.entry_for(&"normal", &"monster").get("tier") == 1,
		"monster visuals clamp below-Rare input to tier one")
	_expect(CATALOG.entry_for(&"eternal", &"monster").get("tier") == 6,
		"Eternal monster input selects tier six")

	var frames := CATALOG.make_sprite_frames(CATALOG.REGULAR_ENTRIES[0])
	_expect(frames.has_animation(&"closed") and frames.get_frame_count(&"closed") == 1,
		"closed animation owns one atlas frame")
	_expect(frames.has_animation(&"opening") and frames.get_frame_count(&"opening") == 2,
		"opening animation transitions closed to open")
	_expect(frames.has_animation(&"open") and frames.get_frame_count(&"open") == 1,
		"open animation owns one atlas frame")


func _assert_entry_regions(entry: Dictionary, expected_column: int, expected_pair_row: int) -> void:
	var closed_region := CATALOG.frame_region(entry, false)
	var open_region := CATALOG.frame_region(entry, true)
	var expected_x := float(expected_column * 32)
	var expected_closed_y := float(expected_pair_row * 64)
	_expect(closed_region == Rect2(expected_x, expected_closed_y, 32.0, 32.0),
		"%s closed frame follows column-major atlas order" % entry.get("id"))
	_expect(open_region == Rect2(expected_x, expected_closed_y + 32.0, 32.0, 32.0),
		"%s open frame is directly below its closed frame" % entry.get("id"))
	var texture := CATALOG.make_frame_texture(entry, false)
	_expect(texture.atlas == CATALOG.ATLAS_TEXTURE and texture.region == closed_region,
		"%s resolves to the shared authored atlas" % entry.get("id"))


func _test_runtime_selection() -> void:
	var chest_scene := load(CHEST_SCENE_PATH) as PackedScene
	_expect(chest_scene != null, "runtime chest scene loads after project autoload registration")
	if chest_scene == null:
		return
	var world := Node2D.new()
	world.name = "ChestVisualTestWorld"
	root.add_child(world)

	var regular := chest_scene.instantiate() as RewardChest
	regular.rarity_override = "normal"
	world.add_child(regular)
	await process_frame
	var regular_entry := regular.get_visual_entry()
	_expect(regular.get_chest_family() == CATALOG.FAMILY_REGULAR,
		"ordinary chest defaults to the regular family")
	_expect(regular.get_loot_rarity() == &"normal" and regular_entry.get("tier") == 1,
		"Normal regular chest automatically selects grade one")
	_expect(regular.get_display_name() == "Rương Gỗ Khóa Sắt",
		"regular display name comes from the selected visual entry")
	_expect(regular.animated_sprite.scale == Vector2.ONE,
		"32x32 atlas renders at native scene scale")

	regular.set_loot_rarity(&"eternal")
	_expect(regular.get_visual_entry().get("tier") == 8,
		"Eternal regular chest automatically selects grade eight")
	regular.set_guaranteed_jackpot(true)
	_expect(regular.get_visual_entry().get("tier") == 9,
		"guaranteed jackpot API promotes regular presentation to grade nine")
	_expect(regular.get_display_name() == "Đại Bảo Khố Vĩnh Hằng",
		"jackpot presentation exposes its authored name")
	await process_frame
	_expect(regular.get_loot_rarity() == &"eternal",
		"guaranteed jackpot API enforces Eternal without creating a ninth rarity")

	var sigil_monster := chest_scene.instantiate() as RewardChest
	sigil_monster.contains_sigil = true
	sigil_monster.rarity_override = "normal"
	world.add_child(sigil_monster)
	await process_frame
	_expect(sigil_monster.get_chest_family() == CATALOG.FAMILY_MONSTER,
		"contains_sigil automatically selects the monster family")
	_expect(sigil_monster.get_loot_rarity() == &"rare",
		"monster family enforces the Rare source floor even over a Normal override")
	_expect(sigil_monster.get_visual_entry().get("tier") == 1,
		"Rare monster chest selects tier one")
	_expect(sigil_monster.get_display_name() == "Rương Oán Cốt",
		"Rare monster chest exposes its authored name")
	var director := root.get_node_or_null("LootDirector")
	var source_payload: Dictionary = (
		director.call(&"get_world_source_payload", sigil_monster)
		if director != null
		else {}
	)
	_expect(source_payload.get("rarity") == &"rare",
		"LootDirector stores the monster chest Rare floor")
	_expect(source_payload.get("display_name") == "Rương Oán Cốt",
		"LootDirector stores the name after applying the resolved rarity visual")

	var explicit_monster := chest_scene.instantiate() as RewardChest
	explicit_monster.chest_family = "monster"
	explicit_monster.rarity_override = "eternal"
	world.add_child(explicit_monster)
	await process_frame
	_expect(explicit_monster.get_chest_family() == CATALOG.FAMILY_MONSTER,
		"explicit family selects monster without a sigil")
	_expect(explicit_monster.get_visual_entry().get("tier") == 6,
		"Eternal explicit monster selects tier six")
	_expect(explicit_monster.get_display_name() == "Mimic Hắc Uyên",
		"Eternal monster chest exposes the final authored name")

	world.queue_free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"regular_grades": CATALOG.REGULAR_ENTRIES.size(),
		"monster_grades": CATALOG.MONSTER_ENTRIES.size(),
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("CHEST VISUAL CATALOG TEST PASSED - %d checks" % _checks)
	else:
		print("CHEST VISUAL CATALOG TEST FAILED - %d/%d checks failed" % [
			_failures.size(), _checks,
		])
	quit(0 if _failures.is_empty() else 1)
