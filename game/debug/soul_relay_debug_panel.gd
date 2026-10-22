extends CanvasLayer

@onready var panel: PanelContainer = $Panel
@onready var state_label: Label = $Panel/Margin/Rows/State

var _player: Node
var _manager: HeroSoulManager
var _threat_serial := 0


func _ready() -> void:
	if not OS.has_feature("debug"):
		queue_free()
		return
	panel.hide()
	$Panel/Margin/Rows/Setup.pressed.connect(_setup_debug_team)
	$Panel/Margin/Rows/Threat.pressed.connect(_add_threat)
	$Panel/Margin/Rows/Relay.pressed.connect(_request_relay)
	$Panel/Margin/Rows/Production.pressed.connect(_restore_production)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F8:
		panel.visible = not panel.visible
		get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	if not panel.visible:
		return
	_resolve_player()
	if not is_instance_valid(_manager):
		state_label.text = "No HeroSoulManager"
		return
	var snapshot := _manager.get_state_snapshot()
	state_label.text = (
		"Active: %s\nReserve: %s\nState: %s  Ready: %d/%d\nTakeover: %s  Time: %.2f\nSupport CD: %.2f"
		% [
			snapshot.get("active_hero", ""), snapshot.get("reserve_soul", ""),
			snapshot.get("state", ""), snapshot.get("readiness", 0),
			snapshot.get("readiness_required", 0), snapshot.get("takeover_open", false),
			maxf(float(snapshot.get("ready_seconds", 0.0)), float(snapshot.get("summon_elapsed", 0.0))),
			snapshot.get("support_cooldown", 0.0),
		]
	)


func _resolve_player() -> void:
	if is_instance_valid(_player) and is_instance_valid(_manager):
		return
	_player = get_tree().get_first_node_in_group(&"player")
	if _player != null and _player.has_method(&"get_hero_soul_manager"):
		_manager = _player.call(&"get_hero_soul_manager") as HeroSoulManager


func _setup_debug_team() -> void:
	_resolve_player()
	if _player != null and _player.has_method(&"enable_debug_sword_relay_team"):
		_player.call(&"enable_debug_sword_relay_team")


func _add_threat() -> void:
	_resolve_player()
	if not is_instance_valid(_manager) or not _player is Node2D:
		return
	_threat_serial += 1
	var actor := _player as Node2D
	_manager.register_melee_threat(
		StringName("debug_threat_%d" % _threat_serial),
		actor,
		actor,
		actor.global_position + Vector2(20, 0),
		100.0
	)


func _request_relay() -> void:
	_resolve_player()
	if is_instance_valid(_manager):
		_manager.request_soul_relay()


func _restore_production() -> void:
	_resolve_player()
	if _player != null and _player.has_method(&"disable_debug_sword_relay_team"):
		_player.call(&"disable_debug_sword_relay_team")

