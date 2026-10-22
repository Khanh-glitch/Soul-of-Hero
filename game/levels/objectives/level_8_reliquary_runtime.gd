class_name LevelEightReliquaryRuntime
extends Node

signal branch_selected(branch_id: StringName)
signal branch_cleared(branch_id: StringName)
signal elite_chest_claimed

const HUD_SCENE := preload("res://game/ui/objectives/level_8_reliquary_hud.tscn")
const EliteEnemyApplicator := preload("res://game/characters/enemies/elite_enemy_applicator.gd")
const TRIPLE_ELITE: Resource = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")
const REAPER_SEAL_ID := &"l8_reaper_seal"
const VAMPIRE_SEAL_ID := &"l8_vampire_seal"
const CHEST_ID := &"l8_elite_chest"

var _game_root: Node
var _entity_root: Node2D
var _encounter: EncounterDefinition
var _seals: Dictionary = {}
var _branch_marker_ids: Dictionary = {}
var _active_enemy_ids: Dictionary = {}
var _defeated_enemy_ids: Dictionary = {}
var _chest: Node
var _selected_branch: StringName
var _elite_entity_id: StringName
var _branch_is_clear := false
var _chest_claimed := false
var _spawned_count := 0
var _event_commit_override_for_test: Callable
var _branch_spawn_override_for_test: Callable
var _elite_apply_override_for_test: Callable

var _status_label: Label
var _progress_label: Label
var _choice_label: Label


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
		errors.append("Level 8 Reliquary runtime requires game, entity root, and encounter.")
		return errors

	_build_branch_plan(errors)
	_index_interactables(errors)
	if not errors.is_empty():
		return errors

	for branch_id: StringName in [&"reaper", &"vampire"]:
		var seal := _seals.get(branch_id) as ReliquaryBranchSeal
		seal.set_branch_state(ReliquaryBranchSeal.SealState.AVAILABLE)
		seal.set_choice_authority(_select_branch)
		var callback := _on_branch_seal_chosen
		if not seal.branch_chosen.is_connected(callback):
			seal.branch_chosen.connect(callback)
	_chest.call(&"set_interaction_locked", true, "Hạ nhánh đã chọn và Elite để mở rương.")
	_chest.call(&"set_open_authority", _authorize_chest_open)
	if not _chest.is_connected(&"opened", _on_chest_opened):
		_chest.connect(&"opened", _on_chest_opened)
	_build_hud()
	_refresh_hud()
	return errors


func get_snapshot() -> Dictionary:
	var elite := _live_entity(_elite_entity_id)
	return {
		"configured": _encounter != null and _seals.size() == 2 and _chest != null,
		"selected_branch": String(_selected_branch),
		"other_branch_locked": not _selected_branch.is_empty(),
		"spawned_count": _spawned_count,
		"active_enemies": _active_enemy_ids.size(),
		"defeated_enemies": _defeated_enemy_ids.size(),
		"elite_entity_id": String(_elite_entity_id),
		"elite_applied": not _elite_entity_id.is_empty() and _live_entity(_elite_entity_id) != null \
			and _live_entity(_elite_entity_id).has_meta(&"elite_modifier_id"),
		"elite_combat_axes": (
			(elite.get_meta(&"elite_combat_axes", {}) as Dictionary).duplicate(true)
			if is_instance_valid(elite) and elite.get_meta(&"elite_combat_axes", {}) is Dictionary
			else {}
		),
		"branch_clear": _branch_is_clear,
		"chest_locked": bool(_chest.call(&"is_interaction_locked")) if is_instance_valid(_chest) else true,
		"chest_claimed": _chest_claimed,
	}


func choose_branch_for_test(branch_id: StringName) -> bool:
	return _select_branch(branch_id)


func get_branch_seal(branch_id: StringName) -> ReliquaryBranchSeal:
	return _seals.get(branch_id) as ReliquaryBranchSeal


## Fault-injection seams used by live authority tests. Empty Callables restore
## the production path without changing the authored encounter.
func set_event_commit_override_for_test(override: Callable) -> void:
	_event_commit_override_for_test = override


func set_branch_spawn_override_for_test(override: Callable) -> void:
	_branch_spawn_override_for_test = override


func set_elite_apply_override_for_test(override: Callable) -> void:
	_elite_apply_override_for_test = override


func _build_branch_plan(errors: PackedStringArray) -> void:
	_branch_marker_ids = {
		&"reaper": PackedStringArray(),
		&"vampire": PackedStringArray(),
	}
	for wave: EncounterWaveDefinition in _encounter.waves:
		if wave == null:
			continue
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			for entry: EncounterSpawnEntry in group.spawn_entries:
				if entry == null:
					continue
				var branch_id := &"reaper" if entry.entry_id == &"reaper_branch" else (&"vampire" if entry.entry_id == &"vampire_branch" else &"")
				if branch_id.is_empty():
					continue
				_branch_marker_ids[branch_id] = entry.spawn_marker_ids.duplicate()
	if (_branch_marker_ids[&"reaper"] as PackedStringArray).size() != 6:
		errors.append("Level 8 requires exactly six authored Reaper markers.")
	if (_branch_marker_ids[&"vampire"] as PackedStringArray).size() != 3:
		errors.append("Level 8 requires exactly three authored Vampire markers.")


func _index_interactables(errors: PackedStringArray) -> void:
	for child: Node in _entity_root.get_children():
		var entity_id := StringName(child.get_meta(&"level_entity_id", ""))
		match entity_id:
			REAPER_SEAL_ID:
				_seals[&"reaper"] = child
			VAMPIRE_SEAL_ID:
				_seals[&"vampire"] = child
			CHEST_ID:
				_chest = child
	if not _seals.get(&"reaper") is ReliquaryBranchSeal:
		errors.append("Level 8 cannot find its Reaper branch seal.")
	if not _seals.get(&"vampire") is ReliquaryBranchSeal:
		errors.append("Level 8 cannot find its Vampire branch seal.")
	if _chest == null:
		errors.append("Level 8 cannot find l8_elite_chest.")
	for branch_id: StringName in _branch_marker_ids:
		for marker_id: String in _branch_marker_ids[branch_id]:
			if _live_entity(StringName(marker_id)) != null:
				errors.append("Deferred Level 8 branch marker '%s' spawned before the player chose." % marker_id)


func _on_branch_seal_chosen(branch_id: StringName, _seal: ReliquaryBranchSeal) -> void:
	if _selected_branch.is_empty():
		_select_branch(branch_id, _seal)


func _select_branch(branch_id: StringName, _seal: ReliquaryBranchSeal = null) -> bool:
	if not _selected_branch.is_empty() or not _branch_marker_ids.has(branch_id):
		return false
	var other_branch := &"vampire" if branch_id == &"reaper" else &"reaper"
	var selected_markers: PackedStringArray = _branch_marker_ids[branch_id]
	var pending_enemies: Array[Node2D] = []
	var pending_by_id: Dictionary = {}
	for marker_value: String in selected_markers:
		var marker_id := StringName(marker_value)
		var enemy := _spawn_branch_entity(marker_id)
		if enemy == null:
			push_warning("Level 8 could not spawn selected branch marker '%s'; branch choice rolled back." % marker_id)
			_rollback_pending_branch(pending_enemies)
			return false
		pending_enemies.append(enemy)
		pending_by_id[marker_id] = enemy

	if pending_enemies.size() != selected_markers.size():
		push_warning("Level 8 selected branch did not spawn its exact authored count; branch choice rolled back.")
		_rollback_pending_branch(pending_enemies)
		return false
	var pending_elite_id := StringName(selected_markers[0])
	var elite := pending_by_id.get(pending_elite_id) as Node2D
	if elite == null or not _apply_branch_elite(elite):
		push_warning("Level 8 could not apply the authored Elite pressure axes; branch choice rolled back.")
		_rollback_pending_branch(pending_enemies)
		return false

	_selected_branch = branch_id
	_elite_entity_id = pending_elite_id
	_spawned_count = pending_enemies.size()
	for marker_value: String in selected_markers:
		var marker_id := StringName(marker_value)
		var enemy := pending_by_id.get(marker_id) as Node2D
		_active_enemy_ids[marker_id] = true
		if enemy != null and enemy.has_signal(&"died"):
			var callback := _on_enemy_died.bind(marker_id)
			if not enemy.is_connected(&"died", callback):
				enemy.connect(&"died", callback)
	(_seals[branch_id] as ReliquaryBranchSeal).set_branch_state(ReliquaryBranchSeal.SealState.CHOSEN)
	(_seals[other_branch] as ReliquaryBranchSeal).set_branch_state(ReliquaryBranchSeal.SealState.LOCKED)
	var unselected_markers: PackedStringArray = _branch_marker_ids[other_branch]
	if _game_root.has_method(&"deactivate_encounter_enemies"):
		_game_root.call(&"deactivate_encounter_enemies", unselected_markers)

	_toast("ĐÃ CHỌN %s • %d HỘ VỆ • 1 ELITE" % [_branch_display(branch_id), _spawned_count])
	branch_selected.emit(branch_id)
	_refresh_hud()
	return true


func _spawn_branch_entity(marker_id: StringName) -> Node2D:
	if _branch_spawn_override_for_test.is_valid():
		return _branch_spawn_override_for_test.call(marker_id) as Node2D
	if not _game_root.has_method(&"spawn_deferred_level_entity"):
		return null
	return _game_root.call(&"spawn_deferred_level_entity", marker_id) as Node2D


func _apply_branch_elite(enemy: Node2D) -> bool:
	if _elite_apply_override_for_test.is_valid():
		return bool(_elite_apply_override_for_test.call(enemy, TRIPLE_ELITE))
	return EliteEnemyApplicator.apply_to(enemy, TRIPLE_ELITE)


func _rollback_pending_branch(pending_enemies: Array[Node2D]) -> void:
	for enemy: Node2D in pending_enemies:
		if not is_instance_valid(enemy):
			continue
		var parent := enemy.get_parent()
		if parent != null:
			parent.remove_child(enemy)
		if not enemy.is_queued_for_deletion():
			enemy.queue_free()
	_active_enemy_ids.clear()
	_defeated_enemy_ids.clear()
	_spawned_count = 0
	_elite_entity_id = &""
	_selected_branch = &""
	_branch_is_clear = false
	for branch_id: StringName in [&"reaper", &"vampire"]:
		var seal := _seals.get(branch_id) as ReliquaryBranchSeal
		if seal != null:
			seal.set_branch_state(ReliquaryBranchSeal.SealState.AVAILABLE)
	_refresh_hud()


func _on_enemy_died(_enemy: Node, entity_id: StringName) -> void:
	if not _active_enemy_ids.has(entity_id):
		return
	_active_enemy_ids.erase(entity_id)
	_defeated_enemy_ids[entity_id] = true
	if _active_enemy_ids.is_empty():
		_clear_selected_branch()
	else:
		_refresh_hud()


func _clear_selected_branch() -> void:
	if _branch_is_clear or _selected_branch.is_empty():
		return
	_branch_is_clear = true
	_chest.call(&"set_interaction_locked", false)
	_toast("ĐÃ DỌN NHÁNH • RƯƠNG ELITE ĐÃ MỞ • NHẤN E")
	branch_cleared.emit(_selected_branch)
	_refresh_hud()


func _on_chest_opened(_score_reward: int, _contained_sigil: bool) -> void:
	if _chest_claimed or not _branch_is_clear:
		return
	_chest_claimed = true
	_toast("ĐÃ NHẬN DI VẬT SỬ THI • LỐI RA ĐÃ MỞ")
	elite_chest_claimed.emit()
	_refresh_hud()


func _authorize_chest_open(
		_score_reward: int,
		_contained_sigil: bool,
		chest: RewardChest,
) -> bool:
	if chest != _chest or _chest_claimed or not _branch_is_clear:
		return false
	var committed := false
	if _event_commit_override_for_test.is_valid():
		committed = bool(_event_commit_override_for_test.call(&"elite_chest_claimed", 1))
	elif _game_root.has_method(&"record_encounter_event"):
		committed = bool(_game_root.call(&"record_encounter_event", &"elite_chest_claimed", 1))
	if not committed:
		push_warning("Level 8 rejected the Elite chest interaction before physical rewards were granted.")
	return committed


func _live_entity(entity_id: StringName) -> Node2D:
	if _entity_root == null:
		return null
	for child: Node in _entity_root.get_children():
		if StringName(child.get_meta(&"level_entity_id", "")) == entity_id:
			return child as Node2D
	return null


func _toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"toast_requested"):
		events.emit_signal(&"toast_requested", message)


func _refresh_hud() -> void:
	if _status_label == null:
		return
	if _selected_branch.is_empty():
		_status_label.text = "DI VẬT TÁCH NHÁNH • CHỌN MỘT LỐI"
		_progress_label.text = "6 TỬ THẦN / 3 MA CÀ RỒNG"
		_choice_label.text = "LẦN CHỌN ĐẦU SẼ KHÓA LỐI CÒN LẠI"
	elif not _branch_is_clear:
		_status_label.text = "NHÁNH %s • QUÁI TINH NHUỆ ĐANG CHIẾN" % _branch_display(_selected_branch)
		_progress_label.text = "CÒN %d/%d HỘ VỆ" % [_active_enemy_ids.size(), _spawned_count]
		_choice_label.text = "LỐI CÒN LẠI ĐÃ KHÓA"
	elif not _chest_claimed:
		_status_label.text = "ĐÃ DỌN NHÁNH • NHẬN RƯƠNG TINH NHUỆ"
		_progress_label.text = "RƯƠNG ĐÃ MỞ"
		_choice_label.text = "LẠI GẦN • NHẤN E"
	else:
		_status_label.text = "ĐÃ NHẬN DI VẬT SỬ THI • LỐI RA ĐÃ MỞ"
		_progress_label.text = "ĐÃ NHẬN RƯƠNG"
		_choice_label.text = "VÀO CỔNG PHÍA BẮC"


func _branch_display(branch_id: StringName) -> String:
	return "TỬ THẦN" if branch_id == &"reaper" else "MA CÀ RỒNG"


func _build_hud() -> void:
	var canvas := HUD_SCENE.instantiate() as CanvasLayer
	add_child(canvas)
	_status_label = canvas.get_node("%ReliquaryStatusLabel") as Label
	_progress_label = canvas.get_node("%BranchProgressLabel") as Label
	_choice_label = canvas.get_node("%BranchChoiceLabel") as Label
