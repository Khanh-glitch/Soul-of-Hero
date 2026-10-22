class_name ChapterTwoSpawnDirector
extends Node

## Keeps Chapter 2 readable while retaining every authored encounter marker.
## EncounterRuntimeState still tracks the full level contract; this director
## only releases the next safe batch, preventing a screen-filling mob dump.

signal queue_advanced(spawned_entity_id: StringName)

const DIFFICULTY_CAPS := {
	&"easy": 7,
	&"medium": 8,
	&"hard": 9,
}

var _main: Node
var _entity_root: Node2D
var _pending_ids: Array[StringName] = []
var _managed_ids: Dictionary = {}
var _wired_ids: Dictionary = {}
var _cap := 7
var _fill_queued := false


func configure(main: Node, entity_root: Node2D, layout_entities: Array) -> PackedStringArray:
	var errors := PackedStringArray()
	_main = main
	_entity_root = entity_root
	if _main == null or _entity_root == null:
		errors.append("Chapter 2 spawn director requires Main and an entity root.")
		return errors
	_cap = int(DIFFICULTY_CAPS.get(GameSession.active_difficulty, DIFFICULTY_CAPS[&"easy"]))
	var ordered: Array[Dictionary] = []
	for raw_entity: Variant in layout_entities:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		if not bool(entity.get("chapter_2_directed", false)):
			continue
		var entity_id := StringName(entity.get("id", ""))
		if entity_id.is_empty():
			continue
		_managed_ids[entity_id] = true
		ordered.append(entity)
	ordered.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return int(left.get("director_order", 0)) < int(right.get("director_order", 0))
	)
	for entity: Dictionary in ordered:
		if bool(entity.get("deferred_spawn", false)):
			_pending_ids.append(StringName(entity.get("id", "")))
	if _managed_ids.is_empty():
		errors.append("Chapter 2 spawn director found no directed enemy markers.")
		return errors
	call_deferred(&"_wire_and_fill")
	return errors


func _process(_delta: float) -> void:
	_wire_live_enemies()
	if not _fill_queued and _alive_count() < _cap and not _pending_ids.is_empty():
		_schedule_fill()


func get_snapshot() -> Dictionary:
	return {
		"enabled": _main != null,
		"active_cap": _cap,
		"alive": _alive_count(),
		"pending": _pending_ids.size(),
		"managed_total": _managed_ids.size(),
	}


func _wire_and_fill() -> void:
	_wire_live_enemies()
	_fill_to_cap()


func _wire_live_enemies() -> void:
	if _entity_root == null:
		return
	for child: Node in _entity_root.get_children():
		var entity_id := StringName(child.get_meta(&"level_entity_id", ""))
		if not _managed_ids.has(entity_id) or _wired_ids.has(entity_id):
			continue
		if not child.has_signal(&"died"):
			continue
		var callback := _on_managed_enemy_died.bind(entity_id)
		if not child.is_connected(&"died", callback):
			child.connect(&"died", callback)
		_wired_ids[entity_id] = true


func _on_managed_enemy_died(_enemy: Node, _entity_id: StringName) -> void:
	_schedule_fill()


func _schedule_fill() -> void:
	if _fill_queued:
		return
	_fill_queued = true
	call_deferred(&"_fill_to_cap")


func _fill_to_cap() -> void:
	_fill_queued = false
	if _main == null or _entity_root == null:
		return
	_wire_live_enemies()
	while _alive_count() < _cap and not _pending_ids.is_empty():
		var entity_id: StringName = _pending_ids.pop_front()
		var spawned: Node2D = _main.call(&"spawn_deferred_level_entity", entity_id)
		if spawned == null:
			continue
		queue_advanced.emit(entity_id)
		_wire_live_enemies()


func _alive_count() -> int:
	if _entity_root == null:
		return 0
	var count := 0
	for child: Node in _entity_root.get_children():
		var entity_id := StringName(child.get_meta(&"level_entity_id", ""))
		if not _managed_ids.has(entity_id) or child.is_queued_for_deletion():
			continue
		if child.is_in_group(&"enemies"):
			count += 1
	return count
