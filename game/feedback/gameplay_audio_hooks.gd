class_name GameplayAudioHooks
extends Node

## Converts high-level gameplay events into the stable audio cue contract.
## The hooks deliberately avoid hit events already voiced by CombatDamage.

var _events: Node
var _player: Node2D
var _soul_was_ready := false
var _last_player_position := Vector2.ZERO
var _step_distance := 0.0
var _step_index := 0
var _step_cooldown := 0.0


func _ready() -> void:
	_events = get_node_or_null("/root/GameEvents")
	if _events == null:
		return
	_connect_if_available(&"player_registered", _on_player_registered)
	_connect_if_available(&"hand_attack_started", _on_hand_attack_started)
	_connect_if_available(&"hand_skill_started", _on_hand_skill_started)
	_connect_if_available(&"hand_skill_resolved", _on_hand_skill_resolved)
	_connect_if_available(&"dash_started", _on_dash_started)
	_connect_if_available(&"enemy_killed", _on_enemy_killed)
	_connect_if_available(&"weapon_unlocked", _on_weapon_unlocked)
	_connect_if_available(&"sigil_collected", _on_sigil_collected)
	_connect_if_available(&"checkpoint_changed", _on_checkpoint_changed)
	_connect_if_available(&"objective_completed", _on_objective_completed)
	_connect_if_available(&"player_died", _on_player_died)
	_connect_if_available(&"player_respawned", _on_player_respawned)
	_connect_if_available(&"soul_readiness_changed", _on_soul_readiness_changed)


func _process(delta: float) -> void:
	_step_cooldown = maxf(0.0, _step_cooldown - delta)
	if not is_instance_valid(_player):
		return
	var position := _player.global_position
	var travelled := position.distance_to(_last_player_position)
	_last_player_position = position
	if travelled > 36.0:
		_step_distance = 0.0
		return
	if travelled < 0.02:
		return
	_step_distance += travelled
	if _step_distance < 22.0 or _step_cooldown > 0.0:
		return
	_step_distance = fmod(_step_distance, 22.0)
	_step_cooldown = 0.16
	_step_index += 1
	_request(&"footstep_stone", position, {
		"pitch_scale": 0.97 if _step_index % 2 == 0 else 1.03,
	})


func _connect_if_available(signal_name: StringName, callback: Callable) -> void:
	if _events.has_signal(signal_name) and not _events.is_connected(signal_name, callback):
		_events.connect(signal_name, callback)


func _on_player_registered(player: Node) -> void:
	_player = player as Node2D
	if is_instance_valid(_player):
		_last_player_position = _player.global_position
	_step_distance = 0.0


func _on_hand_attack_started(weapon_id: StringName, _combo_index: int) -> void:
	match weapon_id:
		&"axe":
			_request(&"axe_cleave", _player_position())
		&"bow":
			_request(&"bow_release", _player_position())


func _on_hand_skill_started(weapon_id: StringName) -> void:
	match weapon_id:
		&"axe":
			_request(&"axe_throw", _player_position())
		&"bow":
			_request(&"bow_volley", _player_position())


func _on_hand_skill_resolved(weapon_id: StringName, endpoint: Vector2, _hit_count: int) -> void:
	if weapon_id == &"axe":
		_request(&"axe_catch", endpoint)


func _on_dash_started(_direction: Vector2) -> void:
	_request(&"dash", _player_position())


func _on_enemy_killed(enemy: Node, _weapon_id: StringName) -> void:
	_request(&"enemy_death", _node_position(enemy))


func _on_weapon_unlocked(_weapon_id: StringName) -> void:
	_request(&"weapon_unlock", _player_position())


func _on_sigil_collected(_current: int, _required: int) -> void:
	_request(&"pickup_sigil", _player_position())


func _on_checkpoint_changed(position: Vector2) -> void:
	_request(&"checkpoint", position)


func _on_objective_completed() -> void:
	_request(&"objective_complete", _player_position())


func _on_player_died() -> void:
	_request(&"player_death", _player_position())


func _on_player_respawned() -> void:
	_request(&"player_respawn", _player_position())


func _on_soul_readiness_changed(current: int, required: int, ready_seconds: float) -> void:
	var is_ready := current >= required and ready_seconds > 0.0
	if is_ready and not _soul_was_ready:
		_request(&"soul_ready", _player_position())
	_soul_was_ready = is_ready


func _request(cue_id: StringName, world_position: Vector2, context: Dictionary = {}) -> void:
	if _events != null and _events.has_signal(&"combat_cue_requested"):
		var request_context := context.duplicate(true)
		request_context["source"] = &"gameplay_audio_hooks"
		_events.emit_signal(&"combat_cue_requested", cue_id, world_position, request_context)


func _player_position() -> Vector2:
	return _player.global_position if is_instance_valid(_player) else Vector2.ZERO


func _node_position(node: Node) -> Vector2:
	return (node as Node2D).global_position if is_instance_valid(node) and node is Node2D else _player_position()
