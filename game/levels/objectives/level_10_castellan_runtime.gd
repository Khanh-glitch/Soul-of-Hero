class_name LevelTenCastellanRuntime
extends Node

signal boss_bound(boss: Node)
signal phase_two_started
signal boss_defeated
signal encounter_rewound

const HUD_SCENE := preload("res://game/ui/objectives/level_10_castellan_hud.tscn")

var _main: Node
var _entity_root: Node2D
var _boss: Node
var _hud_layer: CanvasLayer
var _boss_bar: ProgressBar
var _boss_name: Label
var _boss_health_label: Label
var _phase_label: Label
var _pattern_label: Label
var _boss_was_defeated := false
var _reset_count := 0


func configure(main: Node, entity_root: Node2D, encounter: EncounterDefinition) -> PackedStringArray:
	var errors := PackedStringArray()
	_main = main
	_entity_root = entity_root
	if _main == null or _entity_root == null:
		errors.append("Level 10 runtime requires Main and the live entity root.")
		return errors
	if encounter == null or encounter.encounter_id != &"chapter_1_level_10_castellan_phase_one":
		errors.append("Level 10 runtime requires the authored Castellan phase-one encounter.")
		return errors
	_boss = _find_entity(&"l10_vampire_castellan")
	if _boss == null or not _boss.has_signal(&"health_changed") or not _boss.has_signal(&"phase_changed") or not _boss.has_signal(&"died"):
		errors.append("The dedicated Vampire Castellan boss marker is missing or invalid.")
		return errors
	_prepare_shared_hud()
	_build_boss_hud()
	_boss.connect(&"health_changed", _on_boss_health_changed)
	_boss.connect(&"phase_changed", _on_boss_phase_changed)
	_boss.connect(&"attack_telegraphed", _on_attack_telegraphed)
	_boss.connect(&"encounter_reset", _on_boss_reset)
	_boss.connect(&"died", _on_boss_died)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"player_died"):
		events.connect(&"player_died", _on_player_died)
	_on_boss_health_changed(int(_boss.get("health")), int(_boss.get("max_health")))
	_on_boss_phase_changed(int(_boss.get("phase")), String(_boss.call(&"get_phase_name")))
	boss_bound.emit(_boss)
	return errors


func get_boss() -> Node:
	return _boss


func get_snapshot() -> Dictionary:
	var boss_snapshot := {}
	if is_instance_valid(_boss) and _boss.has_method(&"get_runtime_snapshot"):
		boss_snapshot = _boss.call(&"get_runtime_snapshot")
	return {
		"objective_id": "level_10_vampire_castellan",
		"boss": boss_snapshot,
		"boss_defeated": _boss_was_defeated,
		"reset_count": _reset_count,
		"boss_hud_visible": is_instance_valid(_hud_layer) and _hud_layer.visible,
	}


func _find_entity(entity_id: StringName) -> Node:
	for child: Node in _entity_root.get_children():
		if StringName(child.get_meta(&"level_entity_id", "")) == entity_id:
			return child
	return null


func _on_boss_health_changed(current: int, maximum: int) -> void:
	if not is_instance_valid(_boss_bar):
		return
	_boss_bar.max_value = maxi(1, maximum)
	_boss_bar.value = clampi(current, 0, maxi(1, maximum))
	_boss_name.text = "Vampire Castellan (Cấp %d)" % _boss_stage_level()
	if is_instance_valid(_boss_health_label):
		_boss_health_label.text = "%d/%d" % [clampi(current, 0, maximum), maximum]


func _on_boss_phase_changed(next_phase: int, _phase_name: String) -> void:
	if is_instance_valid(_phase_label):
		_phase_label.text = "GIAI ĐOẠN %d/2 • %s" % [next_phase, "HUYẾT TRIỀU" if next_phase == 1 else "DẠ HUYẾT"]
	if next_phase != 2 or _boss_was_defeated:
		return
	if _main.has_method(&"record_encounter_event"):
		_main.call(&"record_encounter_event", &"castellan_phase_two_started")
	phase_two_started.emit()


func _on_attack_telegraphed(pattern_id: StringName, seconds: float) -> void:
	if not is_instance_valid(_pattern_label):
		return
	var readable: String = String({
		&"blood_lunge": "LAO HUYẾT • NÉ ĐƯỜNG THẲNG",
		&"blink_lanes": "DỊCH CHUYỂN • RỜI GIAO ĐIỂM",
		&"disc_fan": "QUẠT ĐĨA • LUỒN QUA KHE",
	}.get(pattern_id, String(pattern_id).replace("_", " ").to_upper()))
	_pattern_label.text = "%s  (%.1fs)" % [readable, seconds]
	var tween := create_tween()
	tween.tween_interval(seconds + 0.35)
	tween.tween_callback(func() -> void:
		if is_instance_valid(_pattern_label) and not _boss_was_defeated:
			_pattern_label.text = "ĐỌC ĐÒN • PHẢN CÔNG"
	)


func _on_boss_died(_enemy: Node) -> void:
	if _boss_was_defeated:
		return
	_boss_was_defeated = true
	if _main.has_method(&"record_encounter_event"):
		_main.call(&"record_encounter_event", &"castellan_defeated")
	GameSession.collect_sigil()
	if is_instance_valid(_phase_label):
		_phase_label.text = "ĐÃ HẠ THÀNH CHỦ"
	if is_instance_valid(_pattern_label):
		_pattern_label.text = "LỐI RA PHÍA BẮC ĐÃ MỞ"
	_set_generic_focus_suppressed(false)
	GameEvents.toast_requested.emit("ĐÃ HẠ THÀNH CHỦ • LỐI RA ĐÃ MỞ")
	boss_defeated.emit()


func _on_player_died() -> void:
	if _boss_was_defeated or not is_instance_valid(_boss) or not _boss.has_method(&"reset_encounter"):
		return
	_reset_count += 1
	_boss.call_deferred(&"reset_encounter")
	encounter_rewound.emit()


func _on_boss_reset() -> void:
	if is_instance_valid(_pattern_label):
		_pattern_label.text = "THỬ LẠI • VỀ GIAI ĐOẠN 1"


func _boss_stage_level() -> int:
	var value: Variant = _boss.get_meta(&"stage_level", 10) if is_instance_valid(_boss) else 10
	return clampi(int(value), 1, 100)


func _prepare_shared_hud() -> void:
	# Level 10 replaces the generic one-line objective with persistent boss
	# telemetry in the exact center gap between the left and right HUD blocks.
	# It also moves ordinary action toasts below that top strip. The Level-1-only
	# tutorial is never relevant in the chapter boss room, including direct-editor
	# launches where AppFlow has no active run to suppress it automatically.
	var hud := _main.get_node_or_null("HUD")
	if hud != null:
		var objective_panel := hud.find_child("ObjectivePanel", true, false) as Control
		if objective_panel != null:
			objective_panel.hide()
		var toast_panel := hud.find_child("ToastPanel", true, false) as Control
		if toast_panel != null:
			toast_panel.position.y = 78.0
	_set_generic_focus_suppressed(true)
	# Main configures the encounter while HUD._ready may still be installing the
	# shared focus widget. Repeat once deferred so the dedicated boss strip is the
	# only target presentation visible in the throne room.
	call_deferred(&"_set_generic_focus_suppressed", true)
	var tutorial := _main.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial != null:
		tutorial.hide()
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED


func _build_boss_hud() -> void:
	_hud_layer = HUD_SCENE.instantiate() as CanvasLayer
	add_child(_hud_layer)
	_boss_name = _hud_layer.get_node("%BossName") as Label
	_boss_bar = _hud_layer.get_node("%BossHealthBar") as ProgressBar
	_boss_health_label = _hud_layer.get_node("%BossHealthValue") as Label
	_phase_label = _hud_layer.get_node("%BossPhase") as Label
	_pattern_label = _hud_layer.get_node("%BossPattern") as Label


func _set_generic_focus_suppressed(suppressed: bool) -> void:
	if _main == null:
		return
	var hud := _main.get_node_or_null("HUD")
	var focus_hud := hud.find_child("ProgressionFocusHud", true, false) as Control if hud != null else null
	if focus_hud == null:
		return
	focus_hud.set_process(not suppressed)
	var focus_panel := focus_hud.find_child("FocusPanel", true, false) as Control
	if focus_panel != null:
		focus_panel.hide()
