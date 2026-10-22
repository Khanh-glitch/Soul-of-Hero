class_name LevelNineCrimsonGateRuntime
extends Node

signal all_seals_broken
signal crimson_reaper_spawned(enemy: Node2D)
signal crimson_reaper_defeated

const HUD_SCENE := preload("res://game/ui/objectives/level_9_crimson_gate_hud.tscn")
const EliteEnemyApplicator := preload("res://game/characters/enemies/elite_enemy_applicator.gd")
const CRIMSON_ELITE: Resource = preload("res://data/content/elite_modifiers/crimson_reaper_elite.tres")
const EXPECTED_SEAL_COUNT := 3

var _game_root: Node
var _entity_root: Node2D
var _encounter: EncounterDefinition
var _seals: Dictionary = {}
var _activated_seals: Dictionary = {}
var _boss_entity_id: StringName
var _boss: Node2D
var _boss_spawned := false
var _boss_defeated := false
var _event_commit_override_for_test: Callable

var _status_label: Label
var _progress_label: Label
var _instruction_label: Label


func configure(
		game_root: Node,
		entity_root: Node2D,
		encounter: EncounterDefinition,
) -> PackedStringArray:
	var errors := PackedStringArray()
	_game_root = game_root
	_entity_root = entity_root
	_encounter = encounter
	if _game_root == null or _entity_root == null or _encounter == null:
		errors.append("Level 9 Crimson Gate runtime requires game, entity root, and encounter.")
		return errors
	_index_authored_contract(errors)
	if not errors.is_empty():
		return errors
	for seal_value: Variant in _seals.values():
		var seal := seal_value as GateSeal
		if seal != null:
			seal.set_activation_authority(_authorize_gate_seal_activation)
			if not seal.seal_activated.is_connected(_on_gate_seal_activated):
				seal.seal_activated.connect(_on_gate_seal_activated)
	_build_hud()
	_refresh_hud()
	return errors


func get_snapshot() -> Dictionary:
	return {
		"configured": _encounter != null and _seals.size() == EXPECTED_SEAL_COUNT and not _boss_entity_id.is_empty(),
		"seal_count": _seals.size(),
		"activated_seals": _activated_seals.size(),
		"all_seals_broken": _activated_seals.size() == EXPECTED_SEAL_COUNT,
		"boss_entity_id": String(_boss_entity_id),
		"boss_spawned": _boss_spawned,
		"boss_defeated": _boss_defeated,
		"boss_runtime_identity": String(_boss.get_meta(&"runtime_enemy_id", "")) if is_instance_valid(_boss) else "",
		"boss_display_name": String(_boss.get_meta(&"display_name", "")) if is_instance_valid(_boss) else "Crimson Reaper",
		"elite_modifier_id": String(_boss.get_meta(&"elite_modifier_id", "")) if is_instance_valid(_boss) else "",
		"elite_combat_axes": (
			(_boss.get_meta(&"elite_combat_axes", {}) as Dictionary).duplicate(true)
			if is_instance_valid(_boss) and _boss.get_meta(&"elite_combat_axes", {}) is Dictionary
			else {}
		),
	}


func get_gate_seal(seal_id: StringName) -> GateSeal:
	return _seals.get(seal_id) as GateSeal


func get_crimson_reaper() -> Node2D:
	return _boss


func set_event_commit_override_for_test(override: Callable) -> void:
	_event_commit_override_for_test = override


func _index_authored_contract(errors: PackedStringArray) -> void:
	var metadata: Dictionary = _game_root.level.level_data.get("metadata", {}) if _game_root.get("level") != null else {}
	var authored_seals: Array = metadata.get("gate_seal_ids", [])
	_boss_entity_id = StringName(metadata.get("crimson_reaper_id", ""))
	if authored_seals.size() != EXPECTED_SEAL_COUNT:
		errors.append("Level 9 requires exactly three authored Gate Seal IDs.")
	if _boss_entity_id.is_empty():
		errors.append("Level 9 requires one authored Crimson Reaper marker ID.")
	for child: Node in _entity_root.get_children():
		var entity_id := StringName(child.get_meta(&"level_entity_id", ""))
		if authored_seals.has(String(entity_id)):
			if not child is GateSeal:
				errors.append("Level 9 marker '%s' is not a physical GateSeal." % entity_id)
			else:
				_seals[entity_id] = child
		if entity_id == _boss_entity_id:
			errors.append("Crimson Reaper spawned before all three physical seals were broken.")
	if _seals.size() != EXPECTED_SEAL_COUNT:
		errors.append("Level 9 could not resolve exactly three live Gate Seal interactables.")


func _on_gate_seal_activated(seal_id: StringName, seal: GateSeal) -> void:
	if not _seals.has(seal_id) or _seals[seal_id] != seal or _activated_seals.has(seal_id):
		return
	_activated_seals[seal_id] = true
	_toast("ĐÃ PHÁ ẤN CỔNG %d/%d" % [_activated_seals.size(), EXPECTED_SEAL_COUNT])
	if _activated_seals.size() == EXPECTED_SEAL_COUNT:
		_spawn_crimson_reaper()
	_refresh_hud()


func _authorize_gate_seal_activation(seal_id: StringName, seal: GateSeal) -> bool:
	if not _seals.has(seal_id) or _seals[seal_id] != seal or _activated_seals.has(seal_id):
		return false
	var committed := false
	if _event_commit_override_for_test.is_valid():
		committed = bool(_event_commit_override_for_test.call(&"gate_seal_collected", 1))
	elif _game_root.has_method(&"record_encounter_event"):
		committed = bool(_game_root.call(&"record_encounter_event", &"gate_seal_collected", 1))
	if not committed:
		push_warning("Level 9 rejected the Gate Seal interaction before physical progress was granted.")
	return committed


func _spawn_crimson_reaper() -> bool:
	if _boss_spawned or _activated_seals.size() != EXPECTED_SEAL_COUNT:
		return false
	_boss = _game_root.call(&"spawn_deferred_level_entity", _boss_entity_id) as Node2D
	if _boss == null:
		push_error("Level 9 could not spawn its authored Crimson Reaper marker.")
		return false
	if not EliteEnemyApplicator.apply_to(_boss, CRIMSON_ELITE):
		push_error("Level 9 could not apply its Crimson Reaper Elite pressure axes.")
		_boss.queue_free()
		_boss = null
		return false
	_boss.set_meta(&"runtime_enemy_id", &"crimson_reaper")
	_boss.set_meta(&"display_name", "Crimson Reaper")
	if _boss.has_signal(&"died") and not _boss.is_connected(&"died", _on_crimson_reaper_died):
		_boss.connect(&"died", _on_crimson_reaper_died)
	_boss_spawned = true
	_toast("Crimson Reaper THỨC TỈNH • ELITE")
	all_seals_broken.emit()
	crimson_reaper_spawned.emit(_boss)
	_refresh_hud()
	return true


func _on_crimson_reaper_died(_enemy: Node) -> void:
	if _boss_defeated:
		return
	_boss_defeated = true
	_toast("ĐÃ HẠ Crimson Reaper • LỐI RA ĐÃ MỞ")
	crimson_reaper_defeated.emit()
	_refresh_hud()


func _refresh_hud() -> void:
	if _status_label == null:
		return
	if _activated_seals.size() < EXPECTED_SEAL_COUNT:
		_status_label.text = "CỔNG HUYẾT SẮC"
		_progress_label.text = "ẤN CỔNG %d/%d" % [_activated_seals.size(), EXPECTED_SEAL_COUNT]
		_instruction_label.text = "TÌM TỪNG ẤN • NHẤN E"
	elif not _boss_defeated:
		_status_label.text = "Crimson Reaper • ELITE"
		_progress_label.text = "ĐÃ PHÁ ĐỦ 3 ẤN"
		_instruction_label.text = "HẠ 3 QUÁI TINH NHUỆ"
	else:
		_status_label.text = "ĐÃ HẠ Crimson Reaper"
		_progress_label.text = "ẤN CỔNG 3/3"
		_instruction_label.text = "VÀO CỔNG PHÍA BẮC"


func _build_hud() -> void:
	var canvas := HUD_SCENE.instantiate() as CanvasLayer
	add_child(canvas)
	_status_label = canvas.get_node("%CrimsonGateStatusLabel") as Label
	_progress_label = canvas.get_node("%SealProgressLabel") as Label
	_instruction_label = canvas.get_node("%GateInstructionLabel") as Label


func _toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"toast_requested"):
		events.emit_signal(&"toast_requested", message)
