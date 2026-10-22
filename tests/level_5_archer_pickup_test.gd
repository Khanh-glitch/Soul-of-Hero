extends SceneTree

const TEST_SAVE_PATH := "user://tests/level_5_archer_pickup_test.json"
const REPORT_PATH := "res://.artifacts/level_5_archer_pickup_report.json"
const MAP_PATH := "res://data/levels/chapter_1_level_5.json"
const PICKUP_TRANSACTION_KEY := "campaign:chapter_1_level_5:archer_soul_pickup:v1"
const BOSS_ENTITY_ID := &"l5_hooded_archer_miniboss"
const PROFILE_ID := &"level_5_archer_soul"
const REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const PICKUP_BUNDLE: RewardBundleDefinition = preload(
	"res://data/content/rewards/chapter_1_level_5_archer_soul_pickup.tres"
)
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const ARCHER_DROP_RULES := preload("res://game/loot/archer_soul_drop_rules.gd")
const EncounterRuntimeStateScript := preload(
	"res://game/content/encounters/encounter_runtime_state.gd"
)
const ArcherRecruitmentRuntimeScript := preload(
	"res://game/levels/objectives/level_5_archer_recruitment_runtime.gd"
)
const ARCHER_SCENE: PackedScene = preload(
	"res://game/characters/enemies/hooded_archer_miniboss.tscn"
)
const FIELD_CODEX_SCENE: PackedScene = preload("res://game/ui/field_codex.tscn")

var _checks := 0
var _failures: Array[String] = []
var _stage: Node2D


class FakeEncounterAuthority extends Node:
	var encounter_runtime: RefCounted


	func record_encounter_event(event_id: StringName, amount: int = 1) -> bool:
		return encounter_runtime != null and bool(
			encounter_runtime.call(&"record_custom_event", event_id, amount)
		)


class FakeLivePlayer extends Node2D:
	var refresh_calls := 0


	func refresh_runtime_meta_from_save(_snapshot: Dictionary) -> bool:
		refresh_calls += 1
		return true


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		_finish(null)
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated Archer Soul profile loads")
	_stage = Node2D.new()
	root.add_child(_stage)

	_test_authored_profile_and_rarity_contract()
	await _test_first_clear_core_ground_loot(save)
	await _clear_stage_children()
	await _test_legacy_receipt_reconciliation(save)
	await _clear_stage_children()
	await _test_replay_clear(save)
	_finish(save)


func _test_authored_profile_and_rarity_contract() -> void:
	var boss_config := _boss_config_from_authored_map()
	_expect(
		StringName(boss_config.get("guaranteed_loot_profile", &"")) == PROFILE_ID,
		"Level 5 JSON authors the Bow reward as a guaranteed core-loot profile",
	)
	var fixed_soul: Dictionary = PICKUP_BUNDLE.hero_soul_grants[0].call(
		&"create_soul_instance"
	)
	_expect(String(fixed_soul.get("hero_id", "")) == "archer_hero", "first Soul is Archer")
	_expect(int(fixed_soul.get("rarity", -1)) == HERO_SOUL_RULES.Rarity.NORMAL, "first Soul is guaranteed Normal")
	_expect((fixed_soul.get("affixes", []) as Array).is_empty(), "Normal first Soul has no affix")

	for difficulty: StringName in [&"easy", &"medium", &"hard"]:
		var probabilities := ARCHER_DROP_RULES.normalized_probabilities(difficulty)
		var total := 0.0
		var decreasing := true
		for index: int in probabilities.size():
			total += probabilities[index]
			if index > 0:
				decreasing = decreasing and probabilities[index - 1] > probabilities[index]
		_expect(is_equal_approx(total, 1.0), "%s replay weights total 100%%" % difficulty)
		_expect(decreasing, "%s replay rarity chance decreases low to high" % difficulty)
	for minimum: int in range(HERO_SOUL_RULES.Rarity.MAGIC, HERO_SOUL_RULES.MAX_RARITY + 1):
		_expect(
			ARCHER_DROP_RULES.high_rarity_tail_probability(&"easy", minimum)
				< ARCHER_DROP_RULES.high_rarity_tail_probability(&"medium", minimum)
			and ARCHER_DROP_RULES.high_rarity_tail_probability(&"medium", minimum)
				< ARCHER_DROP_RULES.high_rarity_tail_probability(&"hard", minimum),
			"difficulty raises the full rarity-%d+ tail" % minimum,
		)


func _test_first_clear_core_ground_loot(save: LivingArsenalSaveService) -> void:
	var harness := _create_live_harness("archer-core-first", &"easy")
	_expect(bool(harness.get("configured", false)), "actual boss configures generic Level 5 observer")
	if not bool(harness.get("configured", false)):
		return
	var boss := harness["boss"] as HoodedArcherMiniboss
	var player := harness["player"] as FakeLivePlayer
	var runtime: RefCounted = harness["encounter_runtime"]
	var encounter: EncounterDefinition = harness["encounter"]
	var observer: Node = harness["observer"]
	var death_position := boss.global_position
	# A ranged kill must leave a visible item on the ground. Pickup still obeys
	# the same local magnet radius as every other item; no forced reward chain.
	player.global_position = death_position + Vector2(460.0, 0.0)
	_mark_all_except_boss(runtime, encounter)
	_expect(bool(runtime.call(&"mark_enemy_defeated", BOSS_ENTITY_ID)), "encounter accepts Archer defeat")
	_expect(boss.take_damage(9999), "live KingdomArcher enters death")

	var drop := await _wait_for_profile_drop(observer, 160)
	_expect(drop != null, "LootDirector creates the guaranteed reward as standard GroundLoot")
	if drop == null:
		return
	var payload := drop.get_loot_payload()
	_expect(drop.is_in_group(&"ground_loot"), "Bow reward uses the common ground_loot group")
	_expect(StringName(payload.get("loot_profile", &"")) == PROFILE_ID, "payload retains authored profile")
	_expect(StringName(payload.get("kind", &"")) == &"hero_soul", "payload is ordinary Hero Soul equipment")
	_expect(String((payload.get("item", {}) as Dictionary).get("hero_id", "")) == "archer_hero", "payload owns the Archer Soul instance")
	_expect(String(payload.get("icon_path", "")).contains("bow"), "payload uses a curated Bow image")
	_expect(bool(payload.get("first_clear", false)), "first boss clear chooses fixed acquisition payload")
	_expect(is_equal_approx(drop.auto_pickup_radius, 96.0), "Bow uses the standard GroundLoot magnet radius")
	_expect(drop.global_position.distance_to(death_position) < 80.0, "visible launch remains anchored at the defeated boss")
	_expect(_archer_souls(save.get_snapshot()).is_empty(), "launch/landing is visible before Save commit")
	for _frame: int in 50:
		await physics_frame
	_expect(_archer_souls(save.get_snapshot()).is_empty(), "ranged kill leaves Bow visibly on the ground outside magnet range")
	player.global_position = drop.global_position + Vector2(72.0, 0.0)

	_expect(await _wait_for_archer_count(save, 1, 180), "standard local magnet commits Archer Soul after the player approaches")
	var owned := _archer_souls(save.get_snapshot())
	_expect(owned.size() == 1, "first pickup stores exactly one Archer Soul")
	_expect(int(owned[0].get("rarity", -1)) == HERO_SOUL_RULES.Rarity.NORMAL, "stored first Soul remains Normal")
	_expect(save.is_transaction_applied(PICKUP_TRANSACTION_KEY), "fixed pickup receipt is durable")
	_expect(bool(save.get_value(["progression", "features", "soul_hero"], false)), "pickup unlocks Soul Hero")
	_expect(bool(save.get_value(["progression", "features", "soul_relay"], false)), "pickup unlocks Soul Relay")
	_expect(bool(runtime.call(&"is_gate_unlocked", &"l5_exit")), "generic pickup resolution unlocks Level 5 exit")
	_expect(bool(observer.call(&"get_snapshot").get("pickup_event_recorded", false)), "observer records physical pickup objective")
	await _assert_field_codex_contains_archer(save, player, String(owned[0].get("instance_id", "")))


func _test_legacy_receipt_reconciliation(save: LivingArsenalSaveService) -> void:
	_expect(save.reset_to_defaults("RESET_SOUL_OF_HERO_SAVE"), "profile resets for missing-entitlement fixture")
	_expect(save.transact_once(
		PICKUP_TRANSACTION_KEY,
		func(_candidate: Dictionary) -> bool: return true,
		{"kind": "legacy_broken_archer_pickup"},
	), "legacy fixture records receipt without granting a Soul")
	_expect(_archer_souls(save.get_snapshot()).is_empty(), "legacy fixture really has zero Archer Souls")
	var harness := _create_live_harness("archer-reconcile", &"easy")
	_expect(bool(harness.get("configured", false)), "reconciliation run configures")
	if not bool(harness.get("configured", false)):
		return
	var boss := harness["boss"] as HoodedArcherMiniboss
	var player := harness["player"] as FakeLivePlayer
	var observer: Node = harness["observer"]
	var runtime: RefCounted = harness["encounter_runtime"]
	var encounter: EncounterDefinition = harness["encounter"]
	player.global_position = boss.global_position + Vector2(440.0, 0.0)
	_mark_all_except_boss(runtime, encounter)
	runtime.call(&"mark_enemy_defeated", BOSS_ENTITY_ID)
	boss.take_damage(9999)
	var drop := await _wait_for_profile_drop(observer, 160)
	_expect(drop != null, "broken legacy receipt still materializes a physical Bow")
	if drop != null:
		_expect(bool(drop.get_loot_payload().get("first_clear", false)), "missing fixed Soul restores guaranteed Normal path")
		player.global_position = drop.global_position + Vector2(72.0, 0.0)
	_expect(await _wait_for_archer_count(save, 1, 180), "generic GroundLoot reconciles missing fixed entitlement")
	var owned := _archer_souls(save.get_snapshot())
	_expect(owned.size() == 1, "reconciliation adds exactly one deterministic Archer Soul")
	_expect(int(owned[0].get("rarity", -1)) == HERO_SOUL_RULES.Rarity.NORMAL, "reconciled entitlement is Normal")
	var reconciliation_receipts := 0
	for raw_key: Variant in (save.get_value(["applied_transactions"], {}) as Dictionary).keys():
		if String(raw_key).begins_with("loot_reconcile:"):
			reconciliation_receipts += 1
	_expect(reconciliation_receipts == 1, "missing entitlement owns one auditable repair receipt")
	await _assert_field_codex_contains_archer(save, player, String(owned[0].get("instance_id", "")))


func _test_replay_clear(save: LivingArsenalSaveService) -> void:
	var before := _archer_souls(save.get_snapshot()).size()
	var harness := _create_live_harness("archer-replay-hard", &"hard")
	_expect(bool(harness.get("configured", false)), "Hard replay configures")
	if not bool(harness.get("configured", false)):
		return
	var boss := harness["boss"] as HoodedArcherMiniboss
	var player := harness["player"] as FakeLivePlayer
	var observer: Node = harness["observer"]
	var runtime: RefCounted = harness["encounter_runtime"]
	var encounter: EncounterDefinition = harness["encounter"]
	player.global_position = boss.global_position + Vector2(500.0, 0.0)
	_mark_all_except_boss(runtime, encounter)
	runtime.call(&"mark_enemy_defeated", BOSS_ENTITY_ID)
	boss.take_damage(9999)
	var drop := await _wait_for_profile_drop(observer, 160)
	_expect(drop != null, "every replay boss clear creates one guaranteed physical Bow Soul")
	if drop != null:
		var payload := drop.get_loot_payload()
		_expect(not bool(payload.get("first_clear", true)), "replay uses difficulty rarity provider")
		_expect(String(payload.get("pickup_transaction_key", "")).contains("archer_soul_replay"), "replay owns per-run receipt")
		player.global_position = drop.global_position + Vector2(72.0, 0.0)
	_expect(await _wait_for_archer_count(save, before + 1, 180), "Hard replay adds exactly one Archer Soul")
	_expect(_archer_souls(save.get_snapshot()).size() == before + 1, "replay inventory count increments once")


func _create_live_harness(run_id: String, difficulty: StringName) -> Dictionary:
	var level := REGISTRY.find_campaign_level(5)
	var encounter := REGISTRY.find_encounter(level.entry_encounter_id) if level != null else null
	var encounter_runtime = EncounterRuntimeStateScript.new()
	var errors: PackedStringArray = encounter_runtime.configure(
		level,
		REGISTRY,
		_load_document().get("entities", []),
	)
	if not errors.is_empty() or encounter == null:
		return {"configured": false}
	var authority := FakeEncounterAuthority.new()
	authority.encounter_runtime = encounter_runtime
	_stage.add_child(authority)
	var entity_root := Node2D.new()
	authority.add_child(entity_root)
	var boss := ARCHER_SCENE.instantiate() as HoodedArcherMiniboss
	boss.set_meta(&"level_entity_id", BOSS_ENTITY_ID)
	boss.set_meta(&"level_entity_config", _boss_config_from_authored_map())
	boss.global_position = Vector2(1528.0, 1192.0)
	entity_root.add_child(boss)
	var player := FakeLivePlayer.new()
	player.add_to_group(&"player")
	entity_root.add_child(player)
	var session := root.get_node_or_null("GameSession")
	if session != null:
		session.call(&"configure_run", run_id, &"chapter_1_level_5", 5, difficulty)
	var director := root.get_node_or_null("LootDirector")
	if director == null:
		return {"configured": false}
	director.call(&"configure_world_source", boss, &"enemy")
	var observer = ArcherRecruitmentRuntimeScript.new()
	authority.add_child(observer)
	var configure_errors: PackedStringArray = observer.configure(
		authority,
		entity_root,
		encounter,
		{"run_id": run_id, "difficulty": difficulty, "stage_level": 5},
	)
	return {
		"configured": configure_errors.is_empty(),
		"encounter_runtime": encounter_runtime,
		"encounter": encounter,
		"boss": boss,
		"player": player,
		"observer": observer,
		"authority": authority,
	}


func _wait_for_profile_drop(observer: Node, maximum_frames: int) -> GroundLoot:
	for _frame: int in maximum_frames:
		var value: Variant = observer.call(&"get_drop_for_test")
		if value is GroundLoot and is_instance_valid(value):
			return value as GroundLoot
		await physics_frame
	return null


func _wait_for_archer_count(
		save: LivingArsenalSaveService,
		expected: int,
		maximum_frames: int,
) -> bool:
	for _frame: int in maximum_frames:
		if _archer_souls(save.get_snapshot()).size() >= expected:
			return true
		await physics_frame
	return false


func _assert_field_codex_contains_archer(
		_save: LivingArsenalSaveService,
		player: FakeLivePlayer,
		instance_id: String,
) -> void:
	var codex := FIELD_CODEX_SCENE.instantiate() as FieldCodex
	_stage.add_child(codex)
	codex.set_player(player)
	codex.show_codex(&"equipment")
	await process_frame
	var found := false
	var entries_value: Variant = codex.get("_entry_nodes")
	if entries_value is Array:
		for raw_entry: Variant in entries_value:
			if raw_entry is FieldCodexEntry:
				var drag_payload := (raw_entry as FieldCodexEntry).get_drag_payload()
				var item_value: Variant = drag_payload.get("item", {})
				if item_value is Dictionary \
						and String((item_value as Dictionary).get("instance_id", "")) == instance_id \
						and String((item_value as Dictionary).get("hero_id", "")) == "archer_hero":
					found = true
					break
	_expect(found, "Field Codex matrix contains the committed Archer Soul entry")
	codex.queue_free()
	await process_frame


func _mark_all_except_boss(runtime: RefCounted, encounter: EncounterDefinition) -> void:
	for wave: EncounterWaveDefinition in encounter.waves:
		for group: EncounterGroupDefinition in wave.groups:
			for entry: EncounterSpawnEntry in group.spawn_entries:
				for marker_id: String in entry.spawn_marker_ids:
					if StringName(marker_id) != BOSS_ENTITY_ID:
						runtime.call(&"mark_enemy_defeated", StringName(marker_id))


func _archer_souls(snapshot: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var inventory: Dictionary = snapshot.get("inventory", {})
	for raw_soul: Variant in inventory.get("hero_souls", []):
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("hero_id", "")) == "archer_hero":
			result.append((raw_soul as Dictionary).duplicate(true))
	return result


func _boss_config_from_authored_map() -> Dictionary:
	for raw_entity: Variant in _load_document().get("entities", []):
		if raw_entity is Dictionary \
				and StringName((raw_entity as Dictionary).get("id", &"")) == BOSS_ENTITY_ID:
			return (raw_entity as Dictionary).duplicate(true)
	return {}


func _load_document() -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MAP_PATH))
	return parsed if parsed is Dictionary else {}


func _clear_stage_children() -> void:
	for child: Node in _stage.get_children():
		child.queue_free()
	await process_frame
	await process_frame


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish(save: LivingArsenalSaveService) -> void:
	if is_instance_valid(_stage):
		_stage.queue_free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"scope": "Level 5 data profile -> LootDirector -> GroundLoot -> Save -> Field Codex",
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	print("LEVEL 5 ARCHER PICKUP TEST %s - %d checks" % [
		"PASSED" if _failures.is_empty() else "FAILED",
		_checks,
	])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	quit(exit_code)
