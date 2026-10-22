class_name ChapterTwoLevelRuntime
extends Node

## Owns the three Chapter 2 branch-critical fights. The standard encounter
## runtime still counts ordinary enemy deaths; this bridge records the two
## retreat outcomes and waits for the physical Wizard Soul pickup at Level 20.

signal objective_event_recorded(event_id: StringName)
signal wizard_soul_spawned(loot: Node)

const HUD_SCENE: PackedScene = preload("res://game/ui/objectives/level_10_castellan_hud.tscn")

const AXE_ENTITY_ID := &"l15_axe"
const HEXWING_ENTITY_ID := &"l18_hexwing"
const WIZARD_ENTITY_ID := &"l20_wizard"
const WIZARD_LOOT_PROFILE := &"level_20_wizard_soul"
const WIZARD_PICKUP_EVENT := &"wizard_hero_soul_collected"

var _main: Node
var _entity_root: Node2D
var _encounter: EncounterDefinition
var _slot := 0
var _boss_entity_id: StringName
var _boss: Node
var _event_recorded := false
var _boss_defeated := false
var _wizard_drop: Node
var _wizard_drop_payload: Dictionary = {}
var _hud_layer: CanvasLayer
var _boss_bar: ProgressBar
var _boss_name: Label
var _boss_health_label: Label
var _phase_label: Label
var _pattern_label: Label


func configure(main: Node, entity_root: Node2D, encounter: EncounterDefinition) -> PackedStringArray:
	var errors := PackedStringArray()
	_main = main
	_entity_root = entity_root
	_encounter = encounter
	if _main == null or _entity_root == null or _encounter == null:
		errors.append("Chapter 2 runtime requires Main, the entity root, and an encounter.")
		return errors
	_slot = _slot_from_encounter_id(_encounter.encounter_id)
	_boss_entity_id = _boss_marker_for_slot(_slot)
	if _slot == 0 or _boss_entity_id.is_empty():
		errors.append("Chapter 2 runtime received an unsupported encounter '%s'." % _encounter.encounter_id)
		return errors
	_boss = _find_entity(_boss_entity_id)
	if _boss == null or not _boss.has_signal(&"health_changed"):
		errors.append("Chapter 2 special marker '%s' is missing or invalid." % _boss_entity_id)
		return errors
	if _slot in [15, 18] and not _boss.has_signal(&"retreated"):
		errors.append("Chapter 2 retreat boss '%s' does not emit retreated." % _boss_entity_id)
		return errors
	if _slot == 20 and not _boss.has_signal(&"died"):
		errors.append("Wizard boss does not emit died for the physical Soul pipeline.")
		return errors

	_connect_boss_signals()
	if _slot in [15, 20]:
		_prepare_boss_hud()
	if _slot == 20:
		_connect_wizard_loot_events(errors)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"player_died"):
		var reset_callback := _on_player_died
		if not events.is_connected(&"player_died", reset_callback):
			events.connect(&"player_died", reset_callback)
	return errors


func _exit_tree() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		return
	if events.has_signal(&"loot_spawned") and events.loot_spawned.is_connected(_on_loot_spawned):
		events.loot_spawned.disconnect(_on_loot_spawned)
	if events.has_signal(&"loot_pickup_resolved") and events.loot_pickup_resolved.is_connected(_on_loot_pickup_resolved):
		events.loot_pickup_resolved.disconnect(_on_loot_pickup_resolved)
	if events.has_signal(&"player_died") and events.player_died.is_connected(_on_player_died):
		events.player_died.disconnect(_on_player_died)


func get_snapshot() -> Dictionary:
	var boss_snapshot := {}
	if is_instance_valid(_boss) and _boss.has_method(&"get_runtime_snapshot"):
		boss_snapshot = _boss.call(&"get_runtime_snapshot")
	return {
		"slot": _slot,
		"boss_entity_id": String(_boss_entity_id),
		"boss": boss_snapshot,
		"boss_defeated": _boss_defeated,
		"objective_event_recorded": _event_recorded,
		"wizard_drop_spawned": is_instance_valid(_wizard_drop),
		"wizard_pickup_transaction": String(_wizard_drop_payload.get("pickup_transaction_key", "")),
	}


func get_boss_for_test() -> Node:
	return _boss


func _connect_boss_signals() -> void:
	var health_callback := _on_boss_health_changed
	if not _boss.is_connected(&"health_changed", health_callback):
		_boss.connect(&"health_changed", health_callback)
	if _boss.has_signal(&"attack_telegraphed"):
		var telegraph_callback := _on_attack_telegraphed
		if not _boss.is_connected(&"attack_telegraphed", telegraph_callback):
			_boss.connect(&"attack_telegraphed", telegraph_callback)
	if _boss.has_signal(&"phase_changed"):
		var phase_callback := _on_boss_phase_changed
		if not _boss.is_connected(&"phase_changed", phase_callback):
			_boss.connect(&"phase_changed", phase_callback)
	if _slot in [15, 18]:
		var retreat_callback := _on_boss_retreated
		if not _boss.is_connected(&"retreated", retreat_callback):
			_boss.connect(&"retreated", retreat_callback)
	if _slot == 20:
		var death_callback := _on_wizard_died
		if not _boss.is_connected(&"died", death_callback):
			_boss.connect(&"died", death_callback)


func _connect_wizard_loot_events(errors: PackedStringArray) -> void:
	var config_value: Variant = _boss.get_meta(&"level_entity_config", {})
	if not config_value is Dictionary \
			or StringName((config_value as Dictionary).get("guaranteed_loot_profile", &"")) != WIZARD_LOOT_PROFILE:
		errors.append("Wizard boss is missing the authored guaranteed Wizard Soul loot profile.")
		return
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		errors.append("Chapter 2 Wizard runtime requires GameEvents loot observation.")
		return
	if not events.loot_spawned.is_connected(_on_loot_spawned):
		events.loot_spawned.connect(_on_loot_spawned)
	if not events.loot_pickup_resolved.is_connected(_on_loot_pickup_resolved):
		events.loot_pickup_resolved.connect(_on_loot_pickup_resolved)


func _on_boss_retreated(_retreating_boss: Node) -> void:
	if _event_recorded:
		return
	var event_id := &"axe_retreated" if _slot == 15 else &"hexwing_retreated"
	if _main != null and _main.has_method(&"deactivate_encounter_enemies"):
		_main.call(&"deactivate_encounter_enemies", PackedStringArray([String(_boss_entity_id)]))
	if _main != null and _main.has_method(&"record_encounter_event"):
		_event_recorded = bool(_main.call(&"record_encounter_event", event_id, 1))
	if _event_recorded:
		if is_instance_valid(_phase_label):
			_phase_label.text = "RETREATED — ROUTE SECURED"
		if is_instance_valid(_pattern_label):
			_pattern_label.text = "EXIT GATE UNSEALED"
		objective_event_recorded.emit(event_id)


func _on_wizard_died(_dead_boss: Node) -> void:
	if _boss_defeated:
		return
	_boss_defeated = true
	_clear_wizard_arena_adds()
	if is_instance_valid(_phase_label):
		_phase_label.text = "WIZARD DEFEATED"
	if is_instance_valid(_pattern_label):
		_pattern_label.text = "COLLECT THE RELEASED WIZARD SOUL"
	GameEvents.toast_requested.emit("WIZARD SOUL RELEASED — COLLECT IT PHYSICALLY")


func _clear_wizard_arena_adds() -> void:
	if _entity_root == null:
		return
	var removed_ids := PackedStringArray()
	for child: Node in _entity_root.get_children():
		if child == _boss or not child.is_in_group(&"enemies"):
			continue
		var entity_id := StringName(child.get_meta(&"level_entity_id", &""))
		if not entity_id.is_empty():
			removed_ids.append(String(entity_id))
		child.queue_free()
	if not removed_ids.is_empty() and _main != null and _main.has_method(&"deactivate_encounter_enemies"):
		_main.call(&"deactivate_encounter_enemies", removed_ids)


func _on_loot_spawned(loot: Node, payload: Dictionary) -> void:
	if not _is_wizard_soul_payload(payload):
		return
	_wizard_drop = loot
	_wizard_drop_payload = payload.duplicate(true)
	wizard_soul_spawned.emit(loot)


func _on_loot_pickup_resolved(payload: Dictionary, _newly_granted: bool) -> void:
	if _event_recorded or not _is_wizard_soul_payload(payload):
		return
	if _main != null and _main.has_method(&"record_encounter_event"):
		_event_recorded = bool(_main.call(&"record_encounter_event", WIZARD_PICKUP_EVENT, 1))
	if _event_recorded:
		if is_instance_valid(_phase_label):
			_phase_label.text = "WIZARD SOUL CLAIMED"
		if is_instance_valid(_pattern_label):
			_pattern_label.text = "EXIT GATE UNSEALED"
		objective_event_recorded.emit(WIZARD_PICKUP_EVENT)


func _is_wizard_soul_payload(payload: Dictionary) -> bool:
	if StringName(payload.get("loot_profile", &"")) != WIZARD_LOOT_PROFILE:
		return false
	if StringName(payload.get("source_id", &"")) != WIZARD_ENTITY_ID:
		return false
	if StringName(payload.get("kind", &"")) != &"hero_soul":
		return false
	var item_value: Variant = payload.get("item", {})
	return item_value is Dictionary and String((item_value as Dictionary).get("hero_id", "")) == "wizard_hero"


func _on_player_died() -> void:
	if _event_recorded or _boss_defeated or not is_instance_valid(_boss):
		return
	if _boss.has_method(&"reset_encounter"):
		_boss.call_deferred(&"reset_encounter")


func _prepare_boss_hud() -> void:
	var hud := _main.get_node_or_null("HUD") if _main != null else null
	if hud != null:
		var objective_panel := hud.find_child("ObjectivePanel", true, false) as Control
		if objective_panel != null:
			objective_panel.hide()
		var toast_panel := hud.find_child("ToastPanel", true, false) as Control
		if toast_panel != null:
			toast_panel.position.y = 78.0
	_set_generic_focus_suppressed(true)
	_hud_layer = HUD_SCENE.instantiate() as CanvasLayer
	add_child(_hud_layer)
	_boss_name = _hud_layer.get_node("%BossName") as Label
	_boss_bar = _hud_layer.get_node("%BossHealthBar") as ProgressBar
	_boss_health_label = _hud_layer.get_node("%BossHealthValue") as Label
	_phase_label = _hud_layer.get_node("%BossPhase") as Label
	_pattern_label = _hud_layer.get_node("%BossPattern") as Label
	_on_boss_health_changed(int(_boss.get("health")), int(_boss.get("max_health")))
	var phase_name := String(_boss.call(&"get_phase_name")) if _boss.has_method(&"get_phase_name") else "ENGAGED"


func _on_boss_health_changed(current: int, maximum: int) -> void:
	if not is_instance_valid(_boss_bar):
		return
	_boss_bar.max_value = maxi(1, maximum)
	_boss_bar.value = clampi(current, 0, maxi(1, maximum))
	var display_name := "AXE SOUL" if _slot == 15 else "WIZARD HERO"
	_boss_name.text = "%s (LEVEL %d)" % [display_name, _boss_stage_level()]
	if is_instance_valid(_boss_health_label):
		_boss_health_label.text = "%d/%d" % [clampi(current, 0, maximum), maxi(1, maximum)]


func _on_boss_phase_changed(phase: int, phase_name: String) -> void:
	if not is_instance_valid(_phase_label):
		return
	if _slot == 15:
		_phase_label.text = "BREAK TO EXACTLY 50% — %s" % phase_name
	else:
		_phase_label.text = "PHASE %d/2 — %s" % [clampi(phase, 1, 2), phase_name]


func _on_attack_telegraphed(pattern_id: StringName, seconds: float) -> void:
	if is_instance_valid(_pattern_label):
		_pattern_label.text = "%s (%.1fs)" % [String(pattern_id).replace("_", " ").to_upper(), seconds]


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


func _find_entity(entity_id: StringName) -> Node:
	for child: Node in _entity_root.get_children():
		if StringName(child.get_meta(&"level_entity_id", &"")) == entity_id:
			return child
	return null


func _slot_from_encounter_id(encounter_id: StringName) -> int:
	return {
		&"chapter_2_level_15_axe_pactbreaker": 15,
		&"chapter_2_level_18_breathing_relic": 18,
		&"chapter_2_level_20_wizard_foundry_heart": 20,
	}.get(encounter_id, 0)


func _boss_marker_for_slot(slot: int) -> StringName:
	return {
		15: AXE_ENTITY_ID,
		18: HEXWING_ENTITY_ID,
		20: WIZARD_ENTITY_ID,
	}.get(slot, StringName())


func _boss_stage_level() -> int:
	return clampi(int(_boss.get_meta(&"stage_level", _slot)) if is_instance_valid(_boss) else _slot, 1, 100)
