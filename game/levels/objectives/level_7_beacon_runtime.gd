class_name LevelSevenBeaconRuntime
extends Node

signal wave_started(wave_number: int, total_waves: int)
signal defense_failed
signal defense_cleared

const HUD_SCENE := preload("res://game/ui/objectives/level_7_beacon_hud.tscn")
const BEACON_ID := &"l7_soul_beacon"
const CORE_ID := &"l7_beacon_core"

var _game_root: Node
var _entity_root: Node2D
var _encounter: EncounterDefinition
var _beacon: SoulBeacon
var _beacon_core: Node2D
var _waves: Array[Dictionary] = []
var _enemy_by_id: Dictionary = {}
var _enemy_collision_profiles: Dictionary = {}
var _active_enemy_ids: Dictionary = {}
var _defeated_enemy_ids: Dictionary = {}
var _next_wave_index := 0
var _current_wave_number := 0
var _intermission_left := 0.0
var _failed := false
var _cleared := false

var _status_label: Label
var _health_bar: ProgressBar
var _health_label: Label
var _wave_label: Label
var _timer_label: Label
var _failure_overlay: Control


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_process(false)


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
		errors.append("Level 7 Beacon runtime requires game, entity root, and encounter.")
		return errors

	_index_live_entities()
	_beacon = _enemy_by_id.get(BEACON_ID) as SoulBeacon
	_beacon_core = _enemy_by_id.get(CORE_ID) as Node2D
	if _beacon == null:
		errors.append("Level 7 Beacon runtime cannot find l7_soul_beacon.")
	if _beacon_core == null:
		errors.append("Level 7 Beacon runtime cannot find l7_beacon_core.")
	_build_wave_plan(errors)
	_append_runtime_pack_members(errors)
	if not errors.is_empty():
		return errors

	_build_hud()
	_prepare_beacon_core()
	for enemy_id: StringName in _all_authored_enemy_ids():
		var enemy := _enemy_by_id.get(enemy_id) as CollisionObject2D
		if enemy == null:
			errors.append("Level 7 wave marker '%s' has no live enemy." % enemy_id)
			continue
		_enemy_collision_profiles[enemy_id] = {
			"layer": enemy.collision_layer,
			"mask": enemy.collision_mask,
		}
		_set_enemy_dormant(enemy)
		if enemy.has_signal(&"died"):
			var callback := _on_enemy_died.bind(enemy_id)
			if not enemy.is_connected(&"died", callback):
				enemy.connect(&"died", callback)
	if not errors.is_empty():
		return errors

	_beacon.health_changed.connect(_on_beacon_health_changed)
	_beacon.died.connect(_on_beacon_died)
	_on_beacon_health_changed(_beacon.health, _beacon.max_health)
	_intermission_left = float(_waves[0].get("delay", 0.0))
	_refresh_status()
	set_process(true)
	return errors


func _process(delta: float) -> void:
	if _failed or _cleared or get_tree().paused:
		return
	if not _active_enemy_ids.is_empty() or _next_wave_index >= _waves.size():
		_refresh_status()
		return
	_intermission_left = maxf(0.0, _intermission_left - delta)
	if _intermission_left <= 0.0:
		_start_next_wave()
	else:
		_refresh_status()


func get_snapshot() -> Dictionary:
	return {
		"configured": _encounter != null and _beacon != null and _waves.size() == 3,
		"wave": _current_wave_number,
		"total_waves": _waves.size(),
		"next_wave": _next_wave_index + 1 if _next_wave_index < _waves.size() else 0,
		"intermission_seconds": _intermission_left,
		"active_enemies": _active_enemy_ids.size(),
		"defeated_enemies": _defeated_enemy_ids.size(),
		"total_enemies": _all_authored_enemy_ids().size(),
		"beacon": _beacon.get_health_snapshot() if is_instance_valid(_beacon) else {},
		"failed": _failed,
		"cleared": _cleared,
	}


func force_start_next_wave_for_test() -> bool:
	if _failed or _cleared or not _active_enemy_ids.is_empty() or _next_wave_index >= _waves.size():
		return false
	_intermission_left = 0.0
	_start_next_wave()
	return true


func _index_live_entities() -> void:
	_enemy_by_id.clear()
	for child: Node in _entity_root.get_children():
		var entity_id := StringName(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			_enemy_by_id[entity_id] = child


func _build_wave_plan(errors: PackedStringArray) -> void:
	_waves.clear()
	for wave: EncounterWaveDefinition in _encounter.waves:
		if wave == null:
			continue
		var marker_ids: Array[StringName] = []
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			for entry: EncounterSpawnEntry in group.spawn_entries:
				if entry == null:
					continue
				for raw_marker_id: String in entry.spawn_marker_ids:
					marker_ids.append(StringName(raw_marker_id))
		_waves.append({
			"id": wave.wave_id,
			"delay": wave.start_delay_seconds,
			"enemy_ids": marker_ids,
		})
	if _waves.size() != 3:
		errors.append("Level 7 Beacon runtime requires exactly three authored waves.")
	var seen := {}
	for wave: Dictionary in _waves:
		for enemy_id: StringName in wave.get("enemy_ids", []):
			if seen.has(enemy_id):
				errors.append("Level 7 enemy marker '%s' appears in more than one wave." % enemy_id)
			seen[enemy_id] = true
	if seen.size() != 16:
		errors.append("Level 7 Beacon runtime requires exactly sixteen unique enemy markers.")


func _append_runtime_pack_members(errors: PackedStringArray) -> void:
	if _waves.size() != 3:
		return
	for raw_enemy_id: Variant in _enemy_by_id:
		var enemy := _enemy_by_id.get(raw_enemy_id) as Node
		if enemy == null or not bool(enemy.get_meta(&"runtime_pack_member", false)):
			continue
		var pack_index := int(enemy.get_meta(&"encounter_pack_index", 0)) - 1
		if pack_index < 0 or pack_index >= _waves.size():
			errors.append(
				"Level 7 runtime pack member '%s' targets missing wave %d."
				% [String(raw_enemy_id), pack_index + 1]
			)
			continue
		var enemy_ids: Array[StringName] = []
		enemy_ids.assign((_waves[pack_index] as Dictionary).get("enemy_ids", []))
		var enemy_id := StringName(raw_enemy_id)
		if not enemy_ids.has(enemy_id):
			enemy_ids.append(enemy_id)
			_waves[pack_index]["enemy_ids"] = enemy_ids


func _all_authored_enemy_ids() -> Array[StringName]:
	var result: Array[StringName] = []
	for wave: Dictionary in _waves:
		for enemy_id: StringName in wave.get("enemy_ids", []):
			result.append(enemy_id)
	return result


func _set_enemy_dormant(enemy: CollisionObject2D) -> void:
	enemy.process_mode = Node.PROCESS_MODE_DISABLED
	enemy.hide()
	enemy.collision_layer = 0
	enemy.collision_mask = 0


func _activate_enemy(enemy_id: StringName) -> void:
	var enemy := _enemy_by_id.get(enemy_id) as CollisionObject2D
	if enemy == null or not is_instance_valid(enemy):
		return
	var profile: Dictionary = _enemy_collision_profiles.get(enemy_id, {})
	enemy.collision_layer = int(profile.get("layer", 4))
	enemy.collision_mask = int(profile.get("mask", 3))
	enemy.process_mode = Node.PROCESS_MODE_INHERIT
	enemy.show()
	if enemy.has_method(&"set_priority_target"):
		enemy.call(&"set_priority_target", _beacon)
	_active_enemy_ids[enemy_id] = true


func _start_next_wave() -> void:
	if _next_wave_index >= _waves.size() or _failed or _cleared:
		return
	var wave: Dictionary = _waves[_next_wave_index]
	_current_wave_number = _next_wave_index + 1
	_next_wave_index += 1
	for enemy_id: StringName in wave.get("enemy_ids", []):
		_activate_enemy(enemy_id)
	GameEvents.toast_requested.emit(
		"HẢI ĐĂNG • ĐỢT %d/%d • %d MỤC TIÊU" % [
			_current_wave_number,
			_waves.size(),
			_active_enemy_ids.size(),
		]
	)
	wave_started.emit(_current_wave_number, _waves.size())
	_refresh_status()


func _on_enemy_died(_enemy: Node, enemy_id: StringName) -> void:
	if _defeated_enemy_ids.has(enemy_id):
		return
	_defeated_enemy_ids[enemy_id] = true
	_active_enemy_ids.erase(enemy_id)
	if not _active_enemy_ids.is_empty() or _failed:
		_refresh_status()
		return
	if _next_wave_index < _waves.size():
		_intermission_left = float(_waves[_next_wave_index].get("delay", 0.0))
		GameEvents.toast_requested.emit(
			"XONG ĐỢT %d • VIỆN BINH SAU %.0fs" % [
				_current_wave_number,
				_intermission_left,
			]
		)
		_refresh_status()
		return
	_confirm_final_clear.call_deferred()


func _confirm_final_clear() -> void:
	if _failed or _cleared or _defeated_enemy_ids.size() != _all_authored_enemy_ids().size():
		return
	if (
		_game_root == null
		or not _game_root.has_method(&"record_encounter_event")
		or not bool(_game_root.call(&"record_encounter_event", &"soul_beacon_survived", 1))
	):
		push_error("Level 7 could not commit the Beacon survival event to the encounter authority.")
		return
	_cleared = true
	if GameSession.sigils < GameSession.required_sigils:
		GameSession.collect_sigil()
	if is_instance_valid(_beacon_core):
		_beacon_core.queue_free()
	_status_label.text = "HẢI ĐĂNG ĐÃ ỔN ĐỊNH • LỐI BẮC ĐÃ MỞ"
	_wave_label.text = "ĐỢT 3/3"
	_timer_label.text = "XONG"
	GameEvents.toast_requested.emit("HẢI ĐĂNG ĐÃ ỔN ĐỊNH • LỐI RA ĐÃ MỞ")
	defense_cleared.emit()


func _on_beacon_health_changed(current: int, maximum: int) -> void:
	if _health_bar == null:
		return
	_health_bar.max_value = maxi(1, maximum)
	_health_bar.value = clampi(current, 0, maxi(1, maximum))
	_health_label.text = "%d/%d" % [clampi(current, 0, maximum), maximum]
	if current <= maximum / 3 and current > 0:
		_status_label.text = "HẢI ĐĂNG NGUY CẤP • CHẶN QUÁI NGAY"


func _on_beacon_died(_dead_beacon: SoulBeacon) -> void:
	if _failed or _cleared:
		return
	_failed = true
	_status_label.text = "HẢI ĐĂNG ĐÃ VỠ"
	_wave_label.text = "PHÒNG THỦ THẤT BẠI"
	_timer_label.text = "0 HP"
	_failure_overlay.show()
	defense_failed.emit()
	get_tree().paused = true


func _prepare_beacon_core() -> void:
	# The authored core satisfies the common sigil contract, but Level 7 awards it
	# only after the encounter authority confirms all three waves. It must never be
	# collectible early and accidentally make the gate appear ready.
	_beacon_core.hide()
	_beacon_core.process_mode = Node.PROCESS_MODE_DISABLED
	if _beacon_core is CollisionObject2D:
		(_beacon_core as CollisionObject2D).collision_layer = 0
		(_beacon_core as CollisionObject2D).collision_mask = 0


func _refresh_status() -> void:
	if _status_label == null or _failed or _cleared:
		return
	if not _active_enemy_ids.is_empty():
		_status_label.text = "BẢO VỆ HẢI ĐĂNG • %d MỤC TIÊU" % _active_enemy_ids.size()
		_wave_label.text = "ĐỢT %d/%d" % [_current_wave_number, _waves.size()]
		_timer_label.text = "CÒN %d" % _active_enemy_ids.size()
	elif _next_wave_index < _waves.size():
		_status_label.text = "VIỆN BINH ĐANG TỚI"
		_wave_label.text = "ĐỢT KẾ %d/%d" % [_next_wave_index + 1, _waves.size()]
		_timer_label.text = "%.1fs" % _intermission_left


func _build_hud() -> void:
	var canvas := HUD_SCENE.instantiate() as CanvasLayer
	add_child(canvas)
	_status_label = canvas.get_node("%BeaconStatusLabel") as Label
	_health_bar = canvas.get_node("%BeaconHealthBar") as ProgressBar
	_health_label = canvas.get_node("%BeaconHealthLabel") as Label
	_wave_label = canvas.get_node("%WaveLabel") as Label
	_timer_label = canvas.get_node("%WaveTimerLabel") as Label
	_failure_overlay = canvas.get_node("%BeaconFailureOverlay") as Control
	var retry := canvas.get_node("%RetryButton") as Button
	retry.pressed.connect(_retry_level)
	var home := canvas.get_node("%ReturnHomeButton") as Button
	home.pressed.connect(_return_home)


func _retry_level() -> void:
	get_tree().paused = false
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow != null and app_flow.has_method(&"retry_active_run"):
		app_flow.call(&"retry_active_run")
	else:
		get_tree().reload_current_scene()


func _return_home() -> void:
	get_tree().paused = false
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow != null and app_flow.has_method(&"abort_to_home"):
		app_flow.call(&"abort_to_home")
