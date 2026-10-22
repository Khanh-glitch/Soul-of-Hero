extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_5.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const BOSS_ENTITY_ID := &"l5_hooded_archer_miniboss"
const PROFILE_ID := &"level_5_archer_soul"
const REPORT_PATH := "res://.artifacts/chapter_1_level_5_live_loot_report.json"

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := get_node_or_null("/root/SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		_finish()
		return
	_expect(
		save.reset_to_defaults("RESET_SOUL_OF_HERO_SAVE"),
		"live Level 5 regression starts from a clean profile",
	)
	_expect(_archer_souls(save.get_snapshot()).is_empty(), "clean profile owns no Archer Soul")

	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "game/main.tscn instantiates")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().physics_frame

	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as KnightController \
		if entity_root != null else null
	var boss := _find_entity(entity_root, BOSS_ENTITY_ID) as HoodedArcherMiniboss
	var observer := game.get_node_or_null("Level5ArcherRecruitmentRuntime")
	_expect(
		entity_root != null and player != null and boss != null and observer != null,
		"real Level 5 boots Knight, KingdomArcher and its observer runtime",
	)
	if entity_root == null or player == null or boss == null or observer == null:
		await _teardown_game(game)
		_finish()
		return

	# Keep the real boss/death animation active, but freeze unrelated packs so
	# this regression observes only the authored reward route.
	for enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		if enemy != boss and game.is_ancestor_of(enemy):
			enemy.set_physics_process(false)
			enemy.set_process(false)
	player.set_physics_process(false)

	var boss_config_value: Variant = boss.get_meta(&"level_entity_config", {})
	var boss_config: Dictionary = boss_config_value if boss_config_value is Dictionary else {}
	_expect(
		StringName(boss_config.get("guaranteed_loot_profile", &"")) == PROFILE_ID,
		"live KingdomArcher retains the authored guaranteed Bow profile metadata",
	)
	_expect(
		await _wait_for_meta(boss, &"loot_source_configured", 90),
		"LootDirector automatically observes the real spawned boss",
	)

	var boss_position := boss.global_position
	player.global_position = boss_position + Vector2(520.0, 0.0)
	var archer_count_before := _archer_souls(save.get_snapshot()).size()
	_expect(boss.take_damage(999999, player.global_position), "real KingdomArcher enters its authored death")

	var bow_drop := await _wait_for_bow_drop(game, 240)
	_expect(bow_drop != null, "boss death creates one standard GroundLoot Bow")
	if bow_drop == null:
		await _teardown_game(game)
		_finish()
		return
	var live_bow_drops := _profile_drops(game)
	_expect(live_bow_drops.size() == 1, "one boss death creates exactly one guaranteed Bow-profile GroundLoot")
	var payload := bow_drop.get_loot_payload()
	var soul_value: Variant = payload.get("item", {})
	var soul: Dictionary = soul_value if soul_value is Dictionary else {}
	_expect(
		bow_drop.is_in_group(&"ground_loot")
			and StringName(payload.get("loot_profile", &"")) == PROFILE_ID
			and StringName(payload.get("kind", &"")) == &"hero_soul"
			and String(soul.get("hero_id", "")) == "archer_hero",
		"guaranteed reward uses the common GroundLoot payload and Archer identity",
	)
	_expect(
		String(payload.get("icon_path", "")).begins_with("res://assets/ui/loot/archer_soul/bow_"),
		"physical item uses the curated Bow-pack asset selected by rarity",
	)
	_expect(
		is_equal_approx(bow_drop.auto_pickup_radius, 96.0),
		"live Bow keeps the standard 96px GroundLoot magnet radius",
	)

	_expect(
		await _wait_for_landing(bow_drop, 120),
		"guaranteed Bow completes the standard visible launch before pickup",
	)
	player.global_position = bow_drop.global_position + Vector2(bow_drop.auto_pickup_radius + 24.0, 0.0)
	for _frame: int in 45:
		await get_tree().physics_frame
	_expect(
		is_instance_valid(bow_drop)
			and bow_drop.is_available_for_pickup()
			and _archer_souls(save.get_snapshot()).size() == archer_count_before,
		"outside the standard radius the Bow remains visible and grants nothing",
	)
	player.global_position = bow_drop.global_position + Vector2(bow_drop.auto_pickup_radius - 20.0, 0.0)
	_expect(
		await _wait_for_archer_count(save, archer_count_before + 1, 180),
		"entering the standard radius completes suction and writes Archer Soul to Save",
	)
	var owned := _archer_souls(save.get_snapshot())
	_expect(owned.size() == archer_count_before + 1, "physical pickup grants exactly one Archer Soul")
	_expect(
		int(owned.back().get("rarity", -1)) == 0,
		"fresh live pickup is guaranteed Normal rarity",
	)
	var observer_snapshot: Dictionary = observer.call(&"get_snapshot")
	_expect(
		bool(observer_snapshot.get("pickup_event_recorded", false))
			and bool(observer_snapshot.get("pickup_transaction_applied", false)),
		"real observer records both pickup objective and durable transaction",
	)

	var codex := game.find_child("FieldCodex", true, false) as FieldCodex
	_expect(codex != null, "real gameplay HUD mounts FieldCodex")
	if codex != null:
		codex.show_codex(&"equipment")
		await get_tree().process_frame
		var archer_entry := _find_archer_entry(codex, String(owned.back().get("instance_id", "")))
		_expect(archer_entry != null, "committed Archer Soul appears immediately in the live inventory matrix")
		if archer_entry != null:
			var title := archer_entry.get_node("Title") as Label
			var rarity := archer_entry.get_node("Detail") as Label
			var icon := archer_entry.get_node("Icon") as TextureRect
			_expect(
				title.text == "Cung Linh Hồn"
					and rarity.text == "(THƯỜNG)"
					and icon.texture != null
					and icon.texture.resource_path == String(payload.get("icon_path", "")),
				"live Codex tile shows Vietnamese name, rarity and the same Bow asset",
			)

	await _teardown_game(game)
	_finish()


func _wait_for_bow_drop(game: Node, maximum_frames: int) -> GroundLoot:
	for _frame: int in maximum_frames:
		var drops := _profile_drops(game)
		if not drops.is_empty():
			return drops[0]
		await get_tree().physics_frame
	return null


func _profile_drops(game: Node) -> Array[GroundLoot]:
	var result: Array[GroundLoot] = []
	for candidate: Node in get_tree().get_nodes_in_group(&"ground_loot"):
		var loot := candidate as GroundLoot
		if loot == null or not game.is_ancestor_of(loot) or loot.is_queued_for_deletion():
			continue
		if StringName(loot.get_loot_payload().get("loot_profile", &"")) == PROFILE_ID:
			result.append(loot)
	return result


func _wait_for_archer_count(
		save: LivingArsenalSaveService,
		expected: int,
		maximum_frames: int,
) -> bool:
	for _frame: int in maximum_frames:
		if _archer_souls(save.get_snapshot()).size() >= expected:
			return true
		await get_tree().physics_frame
	return false


func _wait_for_landing(loot: GroundLoot, maximum_frames: int) -> bool:
	for _frame: int in maximum_frames:
		if not is_instance_valid(loot):
			return false
		if loot.is_available_for_pickup():
			return true
		await get_tree().physics_frame
	return false


func _wait_for_meta(node: Node, key: StringName, maximum_frames: int) -> bool:
	for _frame: int in maximum_frames:
		if is_instance_valid(node) and bool(node.get_meta(key, false)):
			return true
		await get_tree().physics_frame
	return false


func _find_entity(entity_root: Node2D, entity_id: StringName) -> Node:
	if entity_root == null:
		return null
	for child: Node in entity_root.get_children():
		if StringName(child.get_meta(&"level_entity_id", &"")) == entity_id:
			return child
	return null


func _find_archer_entry(codex: FieldCodex, instance_id: String) -> FieldCodexEntry:
	var entry_list := codex.find_child("EntryList", true, false)
	if entry_list == null:
		return null
	for child: Node in entry_list.get_children():
		var entry := child as FieldCodexEntry
		if entry == null:
			continue
		var payload := entry.get_drag_payload()
		var item_value: Variant = payload.get("item", {})
		if item_value is Dictionary \
				and String((item_value as Dictionary).get("hero_id", "")) == "archer_hero" \
				and String((item_value as Dictionary).get("instance_id", "")) == instance_id:
			return entry
	return null


func _archer_souls(snapshot: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var inventory_value: Variant = snapshot.get("inventory", {})
	if not inventory_value is Dictionary:
		return result
	for raw_soul: Variant in (inventory_value as Dictionary).get("hero_souls", []):
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("hero_id", "")) == "archer_hero":
			result.append((raw_soul as Dictionary).duplicate(true))
	return result


func _teardown_game(game: Node) -> void:
	if not is_instance_valid(game):
		return
	get_tree().paused = false
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer", true, false):
		(audio_node as AudioStreamPlayer).stop()
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer2D", true, false):
		(audio_node as AudioStreamPlayer2D).stop()
	game.queue_free()
	await get_tree().process_frame
	await get_tree().create_timer(0.10, true).timeout


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 5 LIVE LOOT FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	var report := {
		"checks": _checks,
		"passed": _checks - _failures.size(),
		"failures": _failures.duplicate(),
		"scope": "game/main.tscn Level 5 boss -> standard GroundLoot -> Save -> live FieldCodex",
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	print("CHAPTER 1 LEVEL 5 LIVE LOOT %s - %d checks" % [
		"PASSED" if _failures.is_empty() else "FAILED",
		_checks,
	])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
