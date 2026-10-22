class_name LevelFiveArcherRecruitmentRuntime
extends Node

## Level 5 owns only encounter presentation and objective observation. The Bow
## Soul itself is a standard GroundLoot item created by LootDirector from the
## guaranteed_loot_profile authored on KingdomArcher.

signal soul_drop_spawned(drop: GroundLoot)
signal soul_collected

const BOSS_ENTITY_ID := &"l5_hooded_archer_miniboss"
const PICKUP_EVENT_ID := &"archer_hero_soul_collected"
const LOOT_PROFILE_ID := &"level_5_archer_soul"
const BOSS_HUD_SCENE: PackedScene = preload(
	"res://game/ui/objectives/level_5_kingdom_archer_hud.tscn"
)

var _game_root: Node
var _entity_root: Node2D
var _encounter: EncounterDefinition
var _boss: Node2D
var _drop: GroundLoot
var _drop_payload: Dictionary = {}
var _boss_defeated := false
var _pickup_event_recorded := false
var _transaction_was_new := false
var _boss_hud: CanvasLayer
var _boss_name: Label
var _boss_health_bar: ProgressBar
var _boss_health_value: Label
var _boss_poise_bar: ProgressBar
var _boss_poise_value: Label
var _boss_phase: Label


func configure(
		game_root: Node,
		entity_root: Node2D,
		encounter: EncounterDefinition,
		_run_context: Dictionary = {},
) -> PackedStringArray:
	var errors := PackedStringArray()
	_game_root = game_root
	_entity_root = entity_root
	_encounter = encounter
	if _game_root == null or _entity_root == null or _encounter == null:
		errors.append("Level 5 Archer runtime requires game, entity root, and encounter.")
		return errors
	_boss = _find_entity(BOSS_ENTITY_ID)
	if _boss == null or not _boss.has_signal(&"died"):
		errors.append("Level 5 Archer runtime cannot find its live KingdomArcher miniboss.")
		return errors
	var config_value: Variant = _boss.get_meta(&"level_entity_config", {})
	if not config_value is Dictionary \
			or StringName((config_value as Dictionary).get("guaranteed_loot_profile", &"")) \
			!= LOOT_PROFILE_ID:
		errors.append("KingdomArcher is missing its authored guaranteed Bow Soul loot profile.")
		return errors
	if not _encounter_tracks_pickup_event():
		errors.append("Level 5 encounter does not track archer_hero_soul_collected.")
		return errors
	var callback := _on_boss_died
	if not _boss.is_connected(&"died", callback):
		_boss.connect(&"died", callback)
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		errors.append("Level 5 Archer runtime requires GameEvents loot observation.")
		return errors
	if not events.loot_spawned.is_connected(_on_loot_spawned):
		events.loot_spawned.connect(_on_loot_spawned)
	if not events.loot_pickup_resolved.is_connected(_on_loot_pickup_resolved):
		events.loot_pickup_resolved.connect(_on_loot_pickup_resolved)
	_build_boss_hud()
	return errors


func _exit_tree() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		return
	if events.loot_spawned.is_connected(_on_loot_spawned):
		events.loot_spawned.disconnect(_on_loot_spawned)
	if events.loot_pickup_resolved.is_connected(_on_loot_pickup_resolved):
		events.loot_pickup_resolved.disconnect(_on_loot_pickup_resolved)


func get_snapshot() -> Dictionary:
	return {
		"configured": _game_root != null and _boss != null,
		"boss_defeated": _boss_defeated,
		"drop_spawned": is_instance_valid(_drop),
		"pickup_transaction_applied": _is_transaction_applied(
			String(_drop_payload.get("pickup_transaction_key", "")),
		),
		"pickup_event_recorded": _pickup_event_recorded,
		"transaction_was_new": _transaction_was_new,
		"first_clear_drop": bool(_drop_payload.get("first_clear", true)),
		"drop_rarity": int((_drop_payload.get("item", {}) as Dictionary).get("rarity", -1)) \
			if _drop_payload.get("item", {}) is Dictionary else -1,
		"drop_transaction_key": String(_drop_payload.get("pickup_transaction_key", "")),
		"run_id": String(_drop_payload.get("run_id", "")),
		"difficulty": StringName(_drop_payload.get("difficulty", &"easy")),
		"loot_profile": LOOT_PROFILE_ID,
	}


func get_drop_for_test() -> GroundLoot:
	return _drop


func get_boss() -> Node2D:
	return _boss


func _on_boss_died(_dead_boss: Node) -> void:
	if _boss_defeated:
		return
	_boss_defeated = true
	if is_instance_valid(_boss_hud):
		_boss_hud.visible = false
	_set_generic_focus_suppressed(false)


func _on_loot_spawned(loot: Node, payload: Dictionary) -> void:
	if not _is_archer_bow_payload(payload) or not loot is GroundLoot:
		return
	_drop = loot as GroundLoot
	_drop_payload = payload.duplicate(true)
	soul_drop_spawned.emit(_drop)


func _on_loot_pickup_resolved(payload: Dictionary, newly_granted: bool) -> void:
	if not _is_archer_bow_payload(payload) or _pickup_event_recorded:
		return
	_transaction_was_new = newly_granted
	if _game_root != null and _game_root.has_method(&"record_encounter_event"):
		_pickup_event_recorded = bool(_game_root.call(
			&"record_encounter_event",
			PICKUP_EVENT_ID,
			1,
		))
	if _pickup_event_recorded:
		soul_collected.emit()


func _is_archer_bow_payload(payload: Dictionary) -> bool:
	return StringName(payload.get("loot_profile", &"")) == LOOT_PROFILE_ID \
		and StringName(payload.get("source_id", &"")) == BOSS_ENTITY_ID \
		and StringName(payload.get("kind", &"")) == &"hero_soul" \
		and String((payload.get("item", {}) as Dictionary).get("hero_id", "")) == "archer_hero" \
		if payload.get("item", {}) is Dictionary else false


func _is_transaction_applied(transaction_key: String) -> bool:
	var save_service := get_node_or_null("/root/SaveService")
	return not transaction_key.is_empty() \
		and save_service != null \
		and save_service.has_method(&"is_transaction_applied") \
		and bool(save_service.call(&"is_transaction_applied", transaction_key))


func _build_boss_hud() -> void:
	if is_instance_valid(_boss_hud):
		return
	_boss_hud = BOSS_HUD_SCENE.instantiate() as CanvasLayer
	if _boss_hud == null:
		return
	add_child(_boss_hud)
	_boss_name = _boss_hud.get_node("%BossName") as Label
	_boss_health_bar = _boss_hud.get_node("%BossHealthBar") as ProgressBar
	_boss_health_value = _boss_hud.get_node("%BossHealthValue") as Label
	_boss_poise_bar = _boss_hud.get_node("%BossPoiseBar") as ProgressBar
	_boss_poise_value = _boss_hud.get_node("%BossPoiseValue") as Label
	_boss_phase = _boss_hud.get_node("%BossPhase") as Label
	_boss_name.text = "KingdomArcher (Cấp %d)" % _boss_stage_level()
	if _boss.has_signal(&"health_changed"):
		_boss.connect(&"health_changed", _on_boss_health_changed)
	if _boss.has_signal(&"poise_changed"):
		_boss.connect(&"poise_changed", _on_boss_poise_changed)
	if _boss.has_signal(&"phase_changed"):
		_boss.connect(&"phase_changed", _on_boss_phase_changed)
	if _boss.has_signal(&"engaged"):
		_boss.connect(&"engaged", _on_boss_engaged)
	_on_boss_health_changed(int(_boss.get("health")), int(_boss.get("max_health")))
	var poise_snapshot: Dictionary = _boss.call(&"get_poise_snapshot")
	_on_boss_poise_changed(
		float(poise_snapshot.get("current", 0.0)),
		float(poise_snapshot.get("maximum", 1.0)),
		bool(poise_snapshot.get("immune", false)),
	)
	_on_boss_phase_changed(int(_boss.call(&"get_phase")))
	_boss_hud.visible = bool(_boss.call(&"is_engaged"))


func _on_boss_engaged() -> void:
	if is_instance_valid(_boss_hud):
		_boss_hud.visible = true
	_set_generic_focus_suppressed(true)


func _on_boss_health_changed(current: int, maximum: int) -> void:
	if is_instance_valid(_boss_health_bar):
		_boss_health_bar.max_value = maxf(1.0, float(maximum))
		_boss_health_bar.value = clampf(float(current), 0.0, float(maximum))
	if is_instance_valid(_boss_health_value):
		_boss_health_value.text = "%d/%d" % [maxi(0, current), maxi(1, maximum)]


func _on_boss_poise_changed(current: float, maximum: float, immune: bool) -> void:
	if is_instance_valid(_boss_poise_bar):
		_boss_poise_bar.max_value = maxf(1.0, maximum)
		_boss_poise_bar.value = clampf(current, 0.0, maximum)
	if is_instance_valid(_boss_poise_value):
		_boss_poise_value.text = "%d/%d%s" % [
			roundi(maxf(0.0, current)),
			roundi(maxf(1.0, maximum)),
			" • CHẮN" if immune else "",
		]


func _on_boss_phase_changed(current: int) -> void:
	if is_instance_valid(_boss_phase):
		_boss_phase.text = "GIAI ĐOẠN %d • NÉ TÊN, PHẢN CÔNG" % clampi(current, 1, 3)


func _boss_stage_level() -> int:
	var value: Variant = _boss.get_meta(&"stage_level", 5) if is_instance_valid(_boss) else 5
	return clampi(int(value), 1, 100)


func _set_generic_focus_suppressed(suppressed: bool) -> void:
	if _game_root == null:
		return
	var hud := _game_root.get_node_or_null("HUD")
	var focus_hud := hud.find_child("ProgressionFocusHud", true, false) as Control \
		if hud != null else null
	if focus_hud == null:
		return
	focus_hud.set_process(not suppressed)
	var focus_panel := focus_hud.find_child("FocusPanel", true, false) as Control
	if focus_panel != null:
		focus_panel.hide()


func _encounter_tracks_pickup_event() -> bool:
	for objective: EncounterObjectiveDefinition in _encounter.objectives:
		if objective != null \
				and objective.objective_type == EncounterObjectiveDefinition.ObjectiveType.CUSTOM_EVENT \
				and objective.target_id == PICKUP_EVENT_ID:
			return true
	return false


func _find_entity(entity_id: StringName) -> Node2D:
	for child: Node in _entity_root.get_children():
		if StringName(child.get_meta(&"level_entity_id", "")) == entity_id:
			return child as Node2D
	return null
