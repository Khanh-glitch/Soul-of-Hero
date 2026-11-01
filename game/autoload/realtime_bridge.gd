extends Node

## Optional, local-only runtime bridge used by the editor live-sync plugin and the
## stdio MCP adapter in tools/mcp. The game never depends on a client being present.

signal connected_changed(is_connected: bool)
signal command_received(command: String, params: Dictionary, request_id: String)
signal tuning_reloaded(tuning: Dictionary)
signal level_reloaded(level: Dictionary)
signal remote_action_requested(action: String, pressed: bool, strength: float, duration: float)

const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const TUNING_SCHEMA := preload("res://game/characters/knight/gameplay_tuning_schema.gd")

const HOST := "127.0.0.1"
const DEFAULT_PORT := 9080
const TUNING_PATH := "res://config/gameplay_tuning.json"
const DEFAULT_LEVEL_PATH := "res://data/levels/crypt_entrance.json"
const TOKEN_PATH := "res://.godot/mcp_bridge_token"
const WATCH_INTERVAL := 0.4
const STATE_INTERVAL := 0.15
const HANDSHAKE_TIMEOUT_MSEC := 5000
const WEBSOCKET_INBOUND_BUFFER_BYTES := 128 * 1024
const WEBSOCKET_OUTBOUND_BUFFER_BYTES := 2 * 1024 * 1024
const MAX_INBOUND_MESSAGE_BYTES := 64 * 1024
const MAX_OUTBOUND_MESSAGE_BYTES := 2 * 1024 * 1024
const MAX_QUEUED_PACKETS := 128
const MAX_REQUESTS_PER_SECOND := 90
const MAX_AUTH_FAILURES := 3
const WRITE_LOCK_SUFFIX := ".write.lock"
const RECOVERY_BACKUP_SUFFIX := ".write.backup"
const FILE_RENAME_ATTEMPTS := 8
const FILE_RENAME_RETRY_MSEC := 8
const READ_ONLY_COMMANDS := [&"status", &"get_state", &"get_level"]
const ALLOWED_TILE_LAYERS := [&"Backdrop", &"Geometry", &"Decor"]
const ALLOWED_REMOTE_ACTIONS := [
	&"move_up", &"move_down", &"move_left", &"move_right", &"jump",
	&"light_attack", &"heavy_attack", &"dash", &"roll", &"slide", &"crouch", &"interact",
	&"attack", &"skill", &"soul_relay_1", &"soul_relay_2", &"pause",
	# Read-only compatibility aliases accepted from older automation clients.
	&"spirit_swap_1", &"spirit_swap_2",
]

var connected := false

var _server := TCPServer.new()
var _listen_error: Error = OK
var _port := DEFAULT_PORT
var _workspace_id := ""
var _workspace_token := ""
var _peers: Dictionary = {}
var _peer_started_at: Dictionary = {}
var _peer_announced: Dictionary = {}
var _peer_authenticated: Dictionary = {}
var _peer_auth_failures: Dictionary = {}
var _peer_rate_windows: Dictionary = {}
var _peer_rate_counts: Dictionary = {}
var _next_peer_id := 1
var _watch_elapsed := 0.0
var _state_elapsed := 0.0
var _file_signatures: Dictionary = {}
var _pending_file_signatures: Dictionary = {}
var _tuning: Dictionary = {}
var _level: Dictionary = {}
var _watched_level_path := DEFAULT_LEVEL_PATH
var _loaded_level_path := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# Browsers cannot bind a local TCP listener. The optional editor bridge is
	# not a game service and must not attempt to start one in a Web export.
	if OS.has_feature("web"):
		_listen_error = ERR_UNAVAILABLE
		set_process(false)
		return
	_port = _configured_port()
	_workspace_id = ProjectSettings.globalize_path("res://").simplify_path().to_lower().sha256_text()
	_workspace_token = _load_or_create_workspace_token()
	_watched_level_path = _active_level_path()
	_load_tuning(false)
	_load_level(false)
	_connect_game_events()
	_listen_error = _server.listen(_port, HOST)
	if _listen_error != OK:
		push_warning("RealtimeBridge is disabled: cannot listen on %s:%d (%s)." % [HOST, _port, error_string(_listen_error)])
	elif _workspace_token.is_empty():
		push_warning("RealtimeBridge mutation commands are disabled: no workspace token is available.")
	set_process(true)


func _exit_tree() -> void:
	for peer: WebSocketPeer in _peers.values():
		peer.close(1001, "Game stopped")
	_peers.clear()
	_peer_started_at.clear()
	_peer_announced.clear()
	_peer_authenticated.clear()
	_peer_auth_failures.clear()
	_peer_rate_windows.clear()
	_peer_rate_counts.clear()
	_server.stop()
	_set_connected(false)


func _process(delta: float) -> void:
	if _listen_error == OK:
		_accept_connections()
		_poll_peers()

	_watch_elapsed += delta
	if _watch_elapsed >= WATCH_INTERVAL:
		_watch_elapsed = fmod(_watch_elapsed, WATCH_INTERVAL)
		_poll_watched_files()

	_state_elapsed += delta
	if connected and _state_elapsed >= STATE_INTERVAL:
		_state_elapsed = fmod(_state_elapsed, STATE_INTERVAL)
		publish_state()


func get_status() -> Dictionary:
	var level_path := _active_level_path()
	var watched_files := [TUNING_PATH]
	if not level_path.is_empty():
		watched_files.append(level_path)
	return {
		"connected": connected,
		"listening": _listen_error == OK,
		"endpoint": "ws://%s:%d" % [HOST, _port],
		"peer_count": _authenticated_peer_count(),
		"connection_count": _open_peer_count(),
		"authenticated_peer_count": _authenticated_peer_count(),
		"listen_error": "" if _listen_error == OK else error_string(_listen_error),
		"watched_files": watched_files,
		"active_level_path": level_path,
		"workspace_id": _workspace_id,
		"authentication_required": true,
		"authentication_available": not _workspace_token.is_empty(),
		"protocol": 1,
	}


func get_runtime_state() -> Dictionary:
	var scene_path := ""
	if get_tree().current_scene != null:
		scene_path = str(get_tree().current_scene.scene_file_path)
	var players: Array = []
	for player: Node in _player_nodes():
		players.append(_player_state(player))
	return {
		"scene": scene_path,
		"paused": get_tree().paused,
		"engine_fps": Engine.get_frames_per_second(),
		"physics_frame": Engine.get_physics_frames(),
		"players": players,
		"session": _session_state(),
		"bridge": get_status(),
	}


func publish_state(extra: Dictionary = {}) -> void:
	var state := get_runtime_state()
	_deep_merge(state, extra)
	_broadcast({"type": "state", "state": state, "time_msec": Time.get_ticks_msec()})


func publish_event(event_name: String, payload: Dictionary = {}) -> void:
	_broadcast({
		"type": "event",
		"event": event_name,
		"payload": _json_safe(payload),
		"time_msec": Time.get_ticks_msec(),
	})


func _accept_connections() -> void:
	while _server.is_connection_available():
		var stream := _server.take_connection()
		if stream == null:
			return
		var peer := WebSocketPeer.new()
		peer.inbound_buffer_size = WEBSOCKET_INBOUND_BUFFER_BYTES
		peer.outbound_buffer_size = WEBSOCKET_OUTBOUND_BUFFER_BYTES
		peer.max_queued_packets = MAX_QUEUED_PACKETS
		var error := peer.accept_stream(stream)
		if error != OK:
			stream.disconnect_from_host()
			continue
		var peer_id := _next_peer_id
		_next_peer_id += 1
		_peers[peer_id] = peer
		_peer_started_at[peer_id] = Time.get_ticks_msec()
		_peer_announced[peer_id] = false
		_peer_authenticated[peer_id] = false
		_peer_auth_failures[peer_id] = 0
		_peer_rate_windows[peer_id] = Time.get_ticks_msec()
		_peer_rate_counts[peer_id] = 0


func _poll_peers() -> void:
	var remove_ids: Array[int] = []
	for raw_id: Variant in _peers.keys():
		var peer_id := int(raw_id)
		var peer: WebSocketPeer = _peers[peer_id]
		peer.poll()
		var state := peer.get_ready_state()
		if state == WebSocketPeer.STATE_OPEN:
			if not bool(_peer_announced.get(peer_id, false)):
				_peer_announced[peer_id] = true
				_send(peer, {
					"type": "hello",
					"protocol": 1,
					"server": "where-i-am-godot",
					"workspace_id": _workspace_id,
					"authentication": {
						"required": true,
						"method": "workspace_token",
						"token_file": ".godot/mcp_bridge_token",
					},
					"status": get_status(),
				})
			if not bool(_peer_authenticated.get(peer_id, false)) and Time.get_ticks_msec() - int(_peer_started_at.get(peer_id, 0)) > HANDSHAKE_TIMEOUT_MSEC:
				peer.close(1008, "Authentication timeout")
				remove_ids.append(peer_id)
				continue
			while peer.get_available_packet_count() > 0:
				_handle_packet(peer_id, peer, peer.get_packet().get_string_from_utf8())
		elif state == WebSocketPeer.STATE_CLOSED:
			remove_ids.append(peer_id)
		elif Time.get_ticks_msec() - int(_peer_started_at.get(peer_id, 0)) > HANDSHAKE_TIMEOUT_MSEC:
			peer.close(1002, "Handshake timeout")
			remove_ids.append(peer_id)
	for peer_id: int in remove_ids:
		_peers.erase(peer_id)
		_peer_started_at.erase(peer_id)
		_peer_announced.erase(peer_id)
		_peer_authenticated.erase(peer_id)
		_peer_auth_failures.erase(peer_id)
		_peer_rate_windows.erase(peer_id)
		_peer_rate_counts.erase(peer_id)
	_set_connected(_authenticated_peer_count() > 0)


func _handle_packet(peer_id: int, peer: WebSocketPeer, text: String) -> void:
	if text.to_utf8_buffer().size() > MAX_INBOUND_MESSAGE_BYTES:
		peer.close(1009, "Message too large")
		return
	if not _consume_request_quota(peer_id):
		peer.close(1008, "Rate limit exceeded")
		return
	var parser := JSON.new()
	var parse_error := parser.parse(text)
	if parse_error != OK or not parser.data is Dictionary:
		_send(peer, {
			"type": "response",
			"id": "",
			"ok": false,
			"error": "Invalid JSON object: %s" % parser.get_error_message(),
		})
		return

	var message: Dictionary = parser.data
	var message_type := str(message.get("type", "request"))
	if message_type == "auth":
		_handle_auth_message(peer_id, peer, message)
		return
	if message_type == "ping":
		_send(peer, {"type": "pong", "id": message.get("id", ""), "time_msec": Time.get_ticks_msec()})
		return
	if message_type != "request" and message_type != "command":
		_send(peer, {"type": "response", "id": message.get("id", ""), "ok": false, "error": "Unsupported message type"})
		return

	var request_id := str(message.get("id", "%d-%d" % [peer_id, Time.get_ticks_msec()]))
	var command := str(message.get("command", message.get("method", "")))
	var params_value: Variant = message.get("params", {})
	var params: Dictionary = params_value if params_value is Dictionary else {}
	if request_id.length() > 128 or command.length() > 64:
		_send(peer, {"type": "response", "id": request_id.left(128), "ok": false, "error": "Request id or command is too long"})
		return
	if command == "authenticate":
		var auth_result := _authenticate_peer(peer_id, str(params.get("token", "")), str(params.get("workspace_id", "")))
		_send(peer, {
			"type": "response",
			"id": request_id,
			"ok": bool(auth_result.get("ok", false)),
			"result": {"authenticated": true, "workspace_id": _workspace_id} if bool(auth_result.get("ok", false)) else {},
			"error": str(auth_result.get("error", "")),
		})
		if not bool(auth_result.get("ok", false)) and int(_peer_auth_failures.get(peer_id, 0)) >= MAX_AUTH_FAILURES:
			peer.close(1008, "Authentication failed")
		return
	if not bool(_peer_authenticated.get(peer_id, false)) and not (_allow_unauthenticated_reads() and StringName(command) in READ_ONLY_COMMANDS):
		_send(peer, {"type": "response", "id": request_id, "ok": false, "error": "Authentication required"})
		return
	command_received.emit(command, params, request_id)
	var outcome := _dispatch_command(command, params)
	if bool(outcome.get("ok", false)):
		_send(peer, {"type": "response", "id": request_id, "ok": true, "result": _json_safe(outcome.get("result", {}))})
	else:
		_send(peer, {"type": "response", "id": request_id, "ok": false, "error": str(outcome.get("error", "Command failed"))})


func _handle_auth_message(peer_id: int, peer: WebSocketPeer, message: Dictionary) -> void:
	var request_id := str(message.get("id", "auth-%d" % peer_id)).left(128)
	var outcome := _authenticate_peer(peer_id, str(message.get("token", "")), str(message.get("workspace_id", "")))
	var succeeded := bool(outcome.get("ok", false))
	_send(peer, {
		"type": "auth_result",
		"id": request_id,
		"ok": succeeded,
		"authenticated": succeeded,
		"workspace_id": _workspace_id,
		"error": "" if succeeded else str(outcome.get("error", "Authentication failed")),
	})
	if not succeeded and int(_peer_auth_failures.get(peer_id, 0)) >= MAX_AUTH_FAILURES:
		peer.close(1008, "Authentication failed")


func _authenticate_peer(peer_id: int, token: String, workspace_id: String) -> Dictionary:
	if _workspace_token.is_empty():
		return _fail("Workspace token is unavailable")
	if workspace_id != _workspace_id:
		_peer_auth_failures[peer_id] = int(_peer_auth_failures.get(peer_id, 0)) + 1
		return _fail("Workspace identity mismatch")
	if not _constant_time_equals(token, _workspace_token):
		_peer_auth_failures[peer_id] = int(_peer_auth_failures.get(peer_id, 0)) + 1
		return _fail("Invalid workspace token")
	_peer_authenticated[peer_id] = true
	_peer_auth_failures[peer_id] = 0
	_set_connected(_authenticated_peer_count() > 0)
	return _ok({"authenticated": true, "workspace_id": _workspace_id})


func _consume_request_quota(peer_id: int) -> bool:
	var now := Time.get_ticks_msec()
	var window_start := int(_peer_rate_windows.get(peer_id, now))
	if now - window_start >= 1000:
		_peer_rate_windows[peer_id] = now
		_peer_rate_counts[peer_id] = 1
		return true
	var count := int(_peer_rate_counts.get(peer_id, 0)) + 1
	_peer_rate_counts[peer_id] = count
	return count <= MAX_REQUESTS_PER_SECOND


func _constant_time_equals(left: String, right: String) -> bool:
	var left_bytes := left.to_utf8_buffer()
	var right_bytes := right.to_utf8_buffer()
	var difference := left_bytes.size() ^ right_bytes.size()
	var compared_size := maxi(left_bytes.size(), right_bytes.size())
	for index: int in compared_size:
		var left_byte := int(left_bytes[index]) if index < left_bytes.size() else 0
		var right_byte := int(right_bytes[index]) if index < right_bytes.size() else 0
		difference |= left_byte ^ right_byte
	return difference == 0


func _dispatch_command(command: String, params: Dictionary) -> Dictionary:
	match command:
		"status":
			return _ok(get_status())
		"get_state":
			return _ok(get_runtime_state())
		"set_player_tuning":
			return _set_player_tuning(params)
		"trigger_action":
			return _trigger_action(params)
		"get_level":
			return _get_level_command()
		"set_tile":
			return _set_tile(params)
		"reload":
			return _reload_command(params)
		"save_runtime_map":
			return _save_runtime_map(params)

	return _fail("Unknown command: %s" % command)


func _get_level_command() -> Dictionary:
	var level_path := _active_level_path()
	if level_path != _loaded_level_path:
		var load_result := _load_level(false)
		if not bool(load_result.get("ok", false)):
			return load_result
	return _ok(_level.duplicate(true))


func _set_player_tuning(params: Dictionary) -> Dictionary:
	var section := str(params.get("section", "player"))
	if section not in ["player", "combat"]:
		return _fail("section must be player or combat")
	var values_value: Variant = params.get("values", params.get("patch", {}))
	if not values_value is Dictionary:
		return _fail("values must be a JSON object")
	var values: Dictionary = values_value
	if values.is_empty():
		return _fail("values cannot be empty")
	var patch_validation: Dictionary = TUNING_SCHEMA.validate_patch(section, values)
	if not bool(patch_validation.get("ok", false)):
		return _fail("Invalid tuning patch: %s" % patch_validation.get("error", "invalid values"))

	var latest_tuning := _read_json_file(TUNING_PATH)
	if not bool(latest_tuning.get("ok", false)):
		return _fail("Refusing to overwrite unreadable tuning JSON: %s" % latest_tuning.get("error", "unknown error"))
	var updated: Dictionary = latest_tuning.get("data", {}).duplicate(true)
	if params.has("patch") and not params.has("section"):
		_deep_merge(updated, values)
	else:
		var section_data: Dictionary = {}
		if updated.get(section, {}) is Dictionary:
			section_data = updated.get(section, {}).duplicate(true)
		_deep_merge(section_data, values)
		updated[section] = section_data
	var document_validation: Dictionary = TUNING_SCHEMA.validate_document(updated)
	if not bool(document_validation.get("ok", false)):
		return _fail("Invalid tuning document: %s" % document_validation.get("error", "invalid document"))

	var previous_tuning: Dictionary = latest_tuning.get("data", {}).duplicate(true)
	var original_signature := str(latest_tuning.get("signature", ""))
	var write_error := _write_json_file(TUNING_PATH, updated, original_signature)
	if write_error != OK:
		return _fail("Cannot write tuning file: %s" % error_string(write_error))
	_tuning = updated
	if not _apply_tuning_to_players():
		# Runtime mutation only happens after the durable write. A validated Knight
		# should accept this document, but restore both copies if a custom player
		# rejects it unexpectedly.
		var updated_signature := _json_text(updated).sha256_text()
		var restore_error := _write_json_file(TUNING_PATH, previous_tuning, updated_signature)
		_tuning = previous_tuning
		_apply_tuning_to_players()
		if restore_error != OK:
			return _fail("Running player rejected tuning and the file rollback failed: %s" % error_string(restore_error))
		_remember_written_signature(TUNING_PATH, previous_tuning)
		return _fail("Running player rejected the validated tuning document")
	_remember_written_signature(TUNING_PATH, updated)
	tuning_reloaded.emit(_tuning.duplicate(true))
	publish_event("tuning_reloaded", {"path": TUNING_PATH, "source": "mcp"})
	return _ok({"path": TUNING_PATH, "tuning": _tuning.duplicate(true)})


func _trigger_action(params: Dictionary) -> Dictionary:
	var action := str(params.get("action", ""))
	if action.is_empty():
		return _fail("action is required")
	if StringName(action) not in ALLOWED_REMOTE_ACTIONS:
		return _fail("action is not allowed for remote input: %s" % action)
	var pressed := bool(params.get("pressed", true))
	var strength := clampf(float(params.get("strength", 1.0)), 0.0, 1.0)
	var duration := clampf(float(params.get("duration", 0.0)), 0.0, 10.0)
	var receivers := 0
	for player: Node in _player_nodes():
		if player.has_method("trigger_remote_action"):
			player.call("trigger_remote_action", action, pressed, strength, duration)
			receivers += 1
		elif player.has_method("handle_remote_action"):
			player.call("handle_remote_action", action, pressed, strength, duration)
			receivers += 1
	remote_action_requested.emit(action, pressed, strength, duration)
	if InputMap.has_action(action):
		if pressed:
			Input.action_press(action, strength)
			if duration > 0.0:
				_release_action_later(action, duration)
		else:
			Input.action_release(action)
	publish_event("remote_action", {"action": action, "pressed": pressed, "strength": strength, "duration": duration})
	return _ok({"action": action, "pressed": pressed, "receivers": receivers, "input_action_exists": InputMap.has_action(action)})


func _release_action_later(action: String, duration: float) -> void:
	await get_tree().create_timer(duration, true, false, true).timeout
	Input.action_release(action)


func _set_tile(params: Dictionary) -> Dictionary:
	if not params.has("x") or not params.has("y"):
		return _fail("x and y are required")
	if not _is_integer_value(params.get("x")) or not _is_integer_value(params.get("y")):
		return _fail("x and y must be integers")
	var persist_value: Variant = params.get("persist", true)
	if typeof(persist_value) != TYPE_BOOL:
		return _fail("persist must be a boolean")
	var persist := bool(persist_value)
	var level_path := _active_level_path()
	if level_path.is_empty():
		return _fail("Active level path is ambiguous; keep exactly one live level in the running scene")
	var latest_level := _read_json_file(level_path)
	if not bool(latest_level.get("ok", false)):
		return _fail("Refusing to overwrite unreadable level JSON: %s" % latest_level.get("error", "unknown error"))
	var layer := str(params.get("layer", "Geometry"))
	if StringName(layer) not in ALLOWED_TILE_LAYERS:
		return _fail("layer must be Backdrop, Geometry, or Decor")
	var atlas_value: Variant = params.get("atlas", [params.get("atlas_x", -1), params.get("atlas_y", -1)])
	if not atlas_value is Array or atlas_value.size() != 2:
		return _fail("atlas must contain exactly two integers")
	if not _is_integer_value(atlas_value[0]) or not _is_integer_value(atlas_value[1]):
		return _fail("atlas coordinates must be integers")
	var source_value: Variant = params.get("source", params.get("source_id", -1))
	var alternative_value: Variant = params.get("alternative", 0)
	if not _is_integer_value(source_value) or int(source_value) < -1:
		return _fail("source must be an integer greater than or equal to -1")
	if not _is_integer_value(alternative_value) or int(alternative_value) < 0:
		return _fail("alternative must be a non-negative integer")
	var cell := {
		"x": int(params.get("x", 0)),
		"y": int(params.get("y", 0)),
		"source": int(source_value),
		"atlas": [int(atlas_value[0]), int(atlas_value[1])],
		"alternative": int(alternative_value),
	}
	var canonical: Dictionary = latest_level.get("data", {})
	var runtime_layer := _find_tile_layer(layer)
	var validation := _validate_set_tile_request(canonical, layer, cell, runtime_layer)
	if not bool(validation.get("ok", false)):
		return validation

	var proposed := canonical.duplicate(true)
	_upsert_level_cell_on(proposed, layer, cell)
	var schema_validation: Dictionary = LEVEL_SCHEMA.validate_level(proposed)
	if not bool(schema_validation.get("ok", false)):
		return _fail("Level schema rejected tile update: %s" % schema_validation.get("error", "invalid level"))
	var previous_runtime_cell := _runtime_cell_snapshot(runtime_layer, Vector2i(cell.x, cell.y))
	var runtime_result := _apply_one_cell_to_runtime(layer, cell)
	if not bool(runtime_result.get("applied", false)):
		_apply_cell(runtime_layer, previous_runtime_cell)
		return _fail("Runtime rejected tile update: %s" % runtime_result.get("reason", "unknown error"))
	if not persist:
		publish_event("tile_previewed", {"layer": layer, "cell": cell, "source": "mcp", "runtime": runtime_result})
		return _ok({"path": level_path, "layer": layer, "cell": cell, "runtime": runtime_result, "persisted": false})

	var write_error := _write_json_file(level_path, proposed, str(latest_level.get("signature", "")))
	if write_error != OK:
		_apply_cell(runtime_layer, previous_runtime_cell)
		return _fail("Cannot write level file: %s" % error_string(write_error))
	_level = proposed
	_loaded_level_path = level_path
	_remember_written_signature(level_path, proposed)
	_update_live_level_after_bridge_write(false, level_path)
	level_reloaded.emit(_level.duplicate(true))
	publish_event("tile_changed", {"layer": layer, "cell": cell, "source": "mcp", "runtime": runtime_result})
	return _ok({"path": level_path, "layer": layer, "cell": cell, "runtime": runtime_result, "persisted": true})


func _reload_command(params: Dictionary) -> Dictionary:
	var target := str(params.get("target", "all"))
	var result := {}
	if target == "all" or target == "tuning":
		result["tuning"] = _load_tuning(true)
	if target == "all" or target == "level":
		result["level"] = _load_level(true)
	if result.is_empty():
		return _fail("target must be all, tuning, or level")
	return _ok(result)


func _save_runtime_map(params: Dictionary) -> Dictionary:
	var layer := str(params.get("layer", "Geometry"))
	if StringName(layer) not in ALLOWED_TILE_LAYERS:
		return _fail("layer must be Backdrop, Geometry, or Decor")
	var runtime_layer := _find_tile_layer(layer)
	if runtime_layer == null:
		return _fail("No TileMapLayer named %s exists in the running scene" % layer)
	var level_path := _active_level_path()
	if level_path.is_empty():
		return _fail("Active level path is ambiguous; keep exactly one live level in the running scene")
	var latest_level := _read_json_file(level_path)
	if not bool(latest_level.get("ok", false)):
		return _fail("Refusing to overwrite unreadable level JSON: %s" % latest_level.get("error", "unknown error"))
	var proposed: Dictionary = latest_level.get("data", {}).duplicate(true)
	var cells := _serialize_tilemap_layer(runtime_layer)
	var validation := _validate_level_dimensions_and_cells(proposed, layer, cells, runtime_layer)
	if not bool(validation.get("ok", false)):
		return validation
	_set_level_cells_on(proposed, layer, cells)
	var schema_validation: Dictionary = LEVEL_SCHEMA.validate_level(proposed)
	if not bool(schema_validation.get("ok", false)):
		return _fail("Level schema rejected runtime map: %s" % schema_validation.get("error", "invalid level"))
	var write_error := _write_json_file(level_path, proposed, str(latest_level.get("signature", "")))
	if write_error != OK:
		return _fail("Cannot write level file: %s" % error_string(write_error))
	_level = proposed
	_loaded_level_path = level_path
	_remember_written_signature(level_path, proposed)
	_update_live_level_after_bridge_write(false, level_path)
	level_reloaded.emit(_level.duplicate(true))
	publish_event("runtime_map_saved", {"path": level_path, "layer": layer, "cell_count": cells.size()})
	return _ok({"path": level_path, "layer": layer, "cell_count": cells.size()})


func _poll_watched_files() -> void:
	var active_path := _active_level_path()
	if active_path != _watched_level_path:
		_file_signatures.erase(_watched_level_path)
		_pending_file_signatures.erase(_watched_level_path)
		_watched_level_path = active_path
		if not _watched_level_path.is_empty():
			_file_signatures[_watched_level_path] = ""
			_pending_file_signatures.erase(_watched_level_path)
		publish_event("active_level_path_changed", {"path": _watched_level_path})
	var watched_paths: Array[String] = [TUNING_PATH]
	if not _watched_level_path.is_empty():
		watched_paths.append(_watched_level_path)
	for path: String in watched_paths:
		var signature := _file_signature(path)
		if signature == str(_file_signatures.get(path, "")):
			_pending_file_signatures.erase(path)
			continue
		# A one-interval debounce avoids parsing a file while another process is
		# still replacing it, while the content hash still catches same-mtime edits.
		if signature != str(_pending_file_signatures.get(path, "")):
			_pending_file_signatures[path] = signature
			continue
		var load_result: Dictionary
		if path == TUNING_PATH:
			load_result = _load_tuning(true)
		else:
			load_result = _load_level(true)
		if bool(load_result.get("ok", false)):
			_pending_file_signatures.erase(path)


func _load_tuning(emit_update: bool) -> Dictionary:
	var read := _read_json_file(TUNING_PATH)
	if not bool(read.get("ok", false)):
		if emit_update:
			push_warning(str(read.get("error", "Cannot load tuning")))
		return read
	var candidate: Dictionary = read.get("data", {})
	var validation: Dictionary = TUNING_SCHEMA.validate_document(candidate)
	if not bool(validation.get("ok", false)):
		var failure := _fail("Invalid gameplay tuning: %s" % validation.get("error", "invalid document"))
		if emit_update:
			push_warning(str(failure.get("error")))
		return failure
	var previous_tuning := _tuning.duplicate(true)
	_tuning = candidate
	if not _apply_tuning_to_players():
		_tuning = previous_tuning
		_apply_tuning_to_players()
		return _fail("Running player rejected the validated tuning document")
	_file_signatures[TUNING_PATH] = str(read.get("signature", ""))
	_pending_file_signatures.erase(TUNING_PATH)
	if emit_update:
		tuning_reloaded.emit(_tuning.duplicate(true))
		publish_event("tuning_reloaded", {"path": TUNING_PATH, "source": "file_watch"})
	return {"ok": true, "path": TUNING_PATH}


func _load_level(emit_update: bool) -> Dictionary:
	var level_path := _active_level_path()
	if level_path.is_empty():
		return _fail("Active level path is ambiguous; keep exactly one live level in the running scene")
	_watched_level_path = level_path
	var read := _read_json_file(level_path)
	if not bool(read.get("ok", false)):
		if emit_update and FileAccess.file_exists(level_path):
			push_warning(str(read.get("error", "Cannot load level")))
		return read
	var candidate: Dictionary = read.get("data", {})
	var schema_validation: Dictionary = LEVEL_SCHEMA.validate_level(candidate)
	if not bool(schema_validation.get("ok", false)):
		var schema_failure := _fail("Invalid level schema: %s" % schema_validation.get("error", "unknown error"))
		if emit_update:
			push_warning(str(schema_failure.get("error")))
		return schema_failure
	var previous_level := _level.duplicate(true)
	_level = candidate
	var runtime_layers_exist := _has_any_runtime_tile_layer()
	var runtime_result := _apply_level_cells_to_runtime()
	if runtime_layers_exist and not bool(runtime_result.get("applied", false)):
		_level = previous_level
		return _fail("Runtime rejected level reload: %s" % runtime_result.get("reason", "unknown error"))
	var live_level_updated := _update_live_level_after_bridge_write(true, level_path)
	if _has_live_level_for_path(level_path) and not live_level_updated:
		_level = previous_level
		_apply_level_cells_to_runtime()
		return _fail("DungeonLevel rejected level reload; the previous runtime map was preserved")
	_file_signatures[level_path] = str(read.get("signature", ""))
	_pending_file_signatures.erase(level_path)
	_loaded_level_path = level_path
	if emit_update:
		level_reloaded.emit(_level.duplicate(true))
		publish_event("level_reloaded", {"path": level_path, "source": "file_watch", "runtime": runtime_result, "live_level_updated": live_level_updated})
	return {"ok": true, "path": level_path, "runtime": runtime_result, "live_level_updated": live_level_updated}


func _apply_tuning_to_players() -> bool:
	var accepted := true
	for player: Node in _player_nodes():
		if player.has_method("apply_tuning"):
			var outcome: Variant = player.call("apply_tuning", _tuning.duplicate(true))
			if outcome is bool and not bool(outcome):
				accepted = false
		elif player.has_method("reload_tuning"):
			player.call("reload_tuning")
	return accepted


func _apply_level_cells_to_runtime() -> Dictionary:
	var runtime_layers := {}
	var layer_cells := {}
	var cell_counts := {}
	for layer_name: StringName in ALLOWED_TILE_LAYERS:
		var layer := str(layer_name)
		var runtime_layer := _find_tile_layer(layer)
		if runtime_layer == null:
			return {"applied": false, "reason": "%s is not in the running scene" % layer}
		var cells: Variant = _get_level_cells(layer)
		if not cells is Array:
			return {"applied": false, "reason": "JSON has no layers.%s cell array" % layer}
		var validation := _validate_level_dimensions_and_cells(_level, layer, cells, runtime_layer)
		if not bool(validation.get("ok", false)):
			return {"applied": false, "reason": validation.get("error", "Invalid cells")}
		runtime_layers[layer] = runtime_layer
		layer_cells[layer] = cells
		cell_counts[layer] = cells.size()
	# Validate every layer before clearing any of them, preserving the previous
	# runtime map if one source/atlas entry is invalid.
	for layer_name: StringName in ALLOWED_TILE_LAYERS:
		var layer := str(layer_name)
		var runtime_layer: Node = runtime_layers[layer]
		runtime_layer.call("clear")
		for raw_cell: Variant in layer_cells[layer]:
			_apply_cell(runtime_layer, raw_cell)
	return {"applied": true, "cell_counts": cell_counts}


func _apply_one_cell_to_runtime(layer: String, cell: Dictionary) -> Dictionary:
	if StringName(layer) not in ALLOWED_TILE_LAYERS:
		return {"applied": false, "reason": "Layer is not available for runtime map sync: %s" % layer}
	var runtime_layer := _find_tile_layer(layer)
	if runtime_layer == null:
		return {"applied": false, "reason": "%s is not in the running scene" % layer}
	var validation := _validate_cells_for_tilemap(runtime_layer, [cell], layer)
	if not bool(validation.get("ok", false)):
		return {"applied": false, "reason": validation.get("error", "Invalid cell")}
	_apply_cell(runtime_layer, cell)
	var coords := Vector2i(int(cell.get("x", 0)), int(cell.get("y", 0)))
	var expected_source := int(cell.get("source", cell.get("source_id", -1)))
	var actual_source := int(runtime_layer.call("get_cell_source_id", coords))
	if actual_source != expected_source:
		return {"applied": false, "reason": "Runtime TileMap did not retain the requested source"}
	if expected_source >= 0:
		var expected_atlas := Vector2i(int(cell.atlas[0]), int(cell.atlas[1]))
		var actual_atlas: Vector2i = runtime_layer.call("get_cell_atlas_coords", coords)
		var actual_alternative := int(runtime_layer.call("get_cell_alternative_tile", coords))
		if actual_atlas != expected_atlas or actual_alternative != int(cell.get("alternative", 0)):
			return {"applied": false, "reason": "Runtime TileMap did not retain atlas/alternative values"}
	return {"applied": true}


func _apply_cell(tilemap: Node, cell: Dictionary) -> void:
	var coords := Vector2i(int(cell.get("x", 0)), int(cell.get("y", 0)))
	var source_id := int(cell.get("source", cell.get("source_id", -1)))
	if source_id < 0:
		tilemap.call("erase_cell", coords)
		return
	var atlas_array: Variant = cell.get("atlas", [cell.get("atlas_x", -1), cell.get("atlas_y", -1)])
	var atlas := Vector2i(-1, -1)
	if atlas_array is Array and atlas_array.size() >= 2:
		atlas = Vector2i(int(atlas_array[0]), int(atlas_array[1]))
	tilemap.call("set_cell", coords, source_id, atlas, int(cell.get("alternative", 0)))


func _validate_cells_for_tilemap(tilemap: Node, cells: Array, layer := "TileMapLayer") -> Dictionary:
	if not tilemap.has_method("set_cell") or not tilemap.has_method("erase_cell"):
		return _fail("%s is not a compatible TileMapLayer" % layer)
	var tile_set: TileSet = tilemap.get("tile_set")
	if tile_set == null:
		return _fail("%s has no TileSet" % layer)
	for raw_cell: Variant in cells:
		if not raw_cell is Dictionary:
			return _fail("Every cell must be an object")
		var cell: Dictionary = raw_cell
		var source_value: Variant = cell.get("source", cell.get("source_id", -1))
		if not _is_integer_value(source_value):
			return _fail("Tile source must be an integer")
		var source_id := int(source_value)
		if source_id < -1:
			return _fail("Tile source must be greater than or equal to -1")
		var alternative_value: Variant = cell.get("alternative", 0)
		if not _is_integer_value(alternative_value) or int(alternative_value) < 0:
			return _fail("Tile alternative must be a non-negative integer")
		if source_id < 0:
			continue
		if not tile_set.has_source(source_id):
			return _fail("TileSet source %d does not exist" % source_id)
		var source := tile_set.get_source(source_id)
		if not source is TileSetAtlasSource:
			return _fail("TileSet source %d is not an atlas source" % source_id)
		var atlas_array: Variant = cell.get("atlas", [cell.get("atlas_x", -1), cell.get("atlas_y", -1)])
		if not atlas_array is Array or atlas_array.size() != 2:
			return _fail("atlas must be [x, y]")
		if not _is_integer_value(atlas_array[0]) or not _is_integer_value(atlas_array[1]):
			return _fail("Atlas coordinates must be integers")
		var atlas := Vector2i(int(atlas_array[0]), int(atlas_array[1]))
		if not source.has_tile(atlas):
			return _fail("Atlas tile %s does not exist in source %d" % [atlas, source_id])
		var alternative := int(alternative_value)
		if not source.has_alternative_tile(atlas, alternative):
			return _fail("Alternative %d does not exist for atlas tile %s" % [alternative, atlas])
	return {"ok": true}


func _validate_set_tile_request(level: Dictionary, layer: String, cell: Dictionary, tilemap: Node) -> Dictionary:
	if tilemap == null:
		return _fail("No TileMapLayer named %s exists in the running scene" % layer)
	return _validate_level_dimensions_and_cells(level, layer, [cell], tilemap)


func _validate_level_dimensions_and_cells(level: Dictionary, layer: String, cells: Array, tilemap: Node) -> Dictionary:
	var width_value: Variant = level.get("width", null)
	var height_value: Variant = level.get("height", null)
	if not _is_integer_value(width_value) or not _is_integer_value(height_value):
		return _fail("Level width and height must be integers")
	var width := int(width_value)
	var height := int(height_value)
	if width <= 0 or height <= 0:
		return _fail("Level width and height must be positive")
	var layers_value: Variant = level.get("layers", null)
	if not layers_value is Dictionary or not layers_value.has(layer) or not layers_value.get(layer) is Array:
		return _fail("Level has no cell array for layer %s" % layer)
	for raw_cell: Variant in cells:
		if not raw_cell is Dictionary:
			return _fail("Every cell must be an object")
		var cell: Dictionary = raw_cell
		if not _is_integer_value(cell.get("x", null)) or not _is_integer_value(cell.get("y", null)):
			return _fail("Tile x and y must be integers")
		var x := int(cell.get("x"))
		var y := int(cell.get("y"))
		if x < 0 or x >= width or y < 0 or y >= height:
			return _fail("Tile (%d, %d) is outside level bounds 0..%d x 0..%d" % [x, y, width - 1, height - 1])
	return _validate_cells_for_tilemap(tilemap, cells, layer)


func _runtime_cell_snapshot(tilemap: Node, coords: Vector2i) -> Dictionary:
	var source_id := int(tilemap.call("get_cell_source_id", coords))
	if source_id < 0:
		return {"x": coords.x, "y": coords.y, "source": -1, "atlas": [-1, -1], "alternative": 0}
	var atlas: Vector2i = tilemap.call("get_cell_atlas_coords", coords)
	return {
		"x": coords.x,
		"y": coords.y,
		"source": source_id,
		"atlas": [atlas.x, atlas.y],
		"alternative": int(tilemap.call("get_cell_alternative_tile", coords)),
	}


func _is_integer_value(value: Variant) -> bool:
	if typeof(value) == TYPE_INT:
		return true
	if typeof(value) != TYPE_FLOAT:
		return false
	var number := float(value)
	return is_finite(number) and number == floorf(number)


func _active_level_path() -> String:
	var matches: Array[String] = []
	for live_level: Node in get_tree().get_nodes_in_group(&"live_level"):
		if not _has_object_property(live_level, &"level_data_path"):
			continue
		var path := String(live_level.get(&"level_data_path")).strip_edges()
		if not path.is_empty() and not matches.has(path):
			matches.append(path)
	if matches.size() == 1:
		return matches[0]
	# Before a gameplay scene enters the tree there is no live level yet. Keeping
	# the production default lets the MCP handshake and status endpoint remain
	# useful without ever overriding a different active level.
	if matches.is_empty():
		return DEFAULT_LEVEL_PATH
	# Never select an arbitrary JSON when more than one different live level is
	# present. Mutating commands fail closed until the scene has one authority.
	return ""


func _has_object_property(object: Object, property_name: StringName) -> bool:
	for property: Dictionary in object.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return true
	return false


func _has_live_level_for_path(level_path: String) -> bool:
	for live_level: Node in get_tree().get_nodes_in_group(&"live_level"):
		if (
			_has_object_property(live_level, &"level_data_path")
			and String(live_level.get(&"level_data_path")) == level_path
		):
			return true
	return false


func _update_live_level_after_bridge_write(_external_source: bool, level_path: String) -> bool:
	var updated := false
	for live_level: Node in get_tree().get_nodes_in_group(&"live_level"):
		if (
			_has_object_property(live_level, &"level_data_path")
			and String(live_level.get(&"level_data_path")) == level_path
			and live_level.has_method("reload_from_disk")
		):
			updated = bool(live_level.call("reload_from_disk")) or updated
	return updated


func _find_tile_layer(layer: String) -> Node:
	var root := get_tree().current_scene
	if root == null:
		return null
	if root.name == layer and root.has_method("get_used_cells"):
		return root
	var found := root.find_child(layer, true, false)
	if found != null and found.has_method("get_used_cells"):
		return found
	return null


func _has_any_runtime_tile_layer() -> bool:
	for layer_name: StringName in ALLOWED_TILE_LAYERS:
		if _find_tile_layer(str(layer_name)) != null:
			return true
	return false


func _serialize_tilemap_layer(tilemap: Node) -> Array:
	var cells: Array = []
	for coords: Vector2i in tilemap.call("get_used_cells"):
		var atlas: Vector2i = tilemap.call("get_cell_atlas_coords", coords)
		cells.append({
			"x": coords.x,
			"y": coords.y,
			"source": int(tilemap.call("get_cell_source_id", coords)),
			"atlas": [atlas.x, atlas.y],
			"alternative": int(tilemap.call("get_cell_alternative_tile", coords)),
		})
	cells.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("y", 0)) < int(b.get("y", 0)) or (int(a.get("y", 0)) == int(b.get("y", 0)) and int(a.get("x", 0)) < int(b.get("x", 0)))
	)
	return cells


func _get_level_cells(layer: String) -> Variant:
	return _get_level_cells_from(_level, layer)


func _get_level_cells_from(level: Dictionary, layer: String) -> Variant:
	var simple_layers: Variant = level.get("layers", {})
	if simple_layers is Dictionary:
		var simple_cells: Variant = simple_layers.get(layer, null)
		if simple_cells is Array:
			return simple_cells
	# Backward-compatible reader for early live-sync drafts.
	var layers_value: Variant = level.get("tilemap_layers", {})
	if not layers_value is Dictionary:
		return null
	var layer_value: Variant = layers_value.get(layer, {})
	if not layer_value is Dictionary:
		return null
	var cells_value: Variant = layer_value.get("cells", null)
	return cells_value if cells_value is Array else null


func _set_level_cells(layer: String, cells: Array) -> void:
	_set_level_cells_on(_level, layer, cells)


func _set_level_cells_on(level: Dictionary, layer: String, cells: Array) -> void:
	var layers: Dictionary = {}
	if level.get("layers", {}) is Dictionary:
		layers = level.get("layers", {}).duplicate(true)
	layers[layer] = cells
	level["layers"] = layers
	if not level.has("version"):
		level["version"] = 1


func _upsert_level_cell(layer: String, cell: Dictionary) -> void:
	_upsert_level_cell_on(_level, layer, cell)


func _upsert_level_cell_on(level: Dictionary, layer: String, cell: Dictionary) -> void:
	var current_value: Variant = _get_level_cells_from(level, layer)
	var cells: Array = current_value.duplicate(true) if current_value is Array else []
	var found_index := -1
	for index: int in cells.size():
		var existing: Variant = cells[index]
		if existing is Dictionary and int(existing.get("x", 0)) == int(cell.x) and int(existing.get("y", 0)) == int(cell.y):
			found_index = index
			break
	if int(cell.get("source", cell.get("source_id", -1))) < 0:
		if found_index >= 0:
			cells.remove_at(found_index)
	elif found_index >= 0:
		cells[found_index] = cell
	else:
		cells.append(cell)
	cells.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("y", 0)) < int(b.get("y", 0)) or (int(a.get("y", 0)) == int(b.get("y", 0)) and int(a.get("x", 0)) < int(b.get("x", 0)))
	)
	_set_level_cells_on(level, layer, cells)


func _player_nodes() -> Array[Node]:
	var result: Array[Node] = []
	for group_name: StringName in [&"player", &"players"]:
		for node: Node in get_tree().get_nodes_in_group(group_name):
			if not result.has(node):
				result.append(node)
	return result


func _player_state(player: Node) -> Dictionary:
	if player.has_method("get_runtime_state"):
		var custom: Variant = player.call("get_runtime_state")
		if custom is Dictionary:
			return _json_safe(custom)
	var state := {"name": player.name, "path": str(player.get_path())}
	if player is Node2D:
		state["position"] = {"x": player.global_position.x, "y": player.global_position.y}
	var known_properties := ["velocity", "health", "max_health", "stamina", "max_stamina", "facing", "current_state", "animation_state"]
	var available := {}
	for property_info: Dictionary in player.get_property_list():
		available[str(property_info.get("name", ""))] = true
	for property_name: String in known_properties:
		if available.has(property_name):
			state[property_name] = _json_safe(player.get(property_name))
	return state


func _session_state() -> Dictionary:
	var session := get_node_or_null("/root/GameSession")
	if session == null:
		return {}
	var state := {}
	for property_name: String in ["score", "sigils", "required_sigils", "checkpoint", "objective_finished"]:
		for property_info: Dictionary in session.get_property_list():
			if str(property_info.get("name", "")) == property_name:
				state[property_name] = _json_safe(session.get(property_name))
				break
	return state


func _connect_game_events() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		return
	var bindings := {
		"player_registered": Callable(self, "_on_player_registered"),
		"player_health_changed": Callable(self, "_on_player_health_changed"),
		"player_stamina_changed": Callable(self, "_on_player_stamina_changed"),
		"player_mana_changed": Callable(self, "_on_player_mana_changed"),
		"score_changed": Callable(self, "_on_score_changed"),
		"sigil_collected": Callable(self, "_on_sigil_collected"),
		"checkpoint_changed": Callable(self, "_on_checkpoint_changed"),
		"objective_completed": Callable(self, "_on_objective_completed"),
		"player_died": Callable(self, "_on_player_died"),
		"player_respawned": Callable(self, "_on_player_respawned"),
		"toast_requested": Callable(self, "_on_toast_requested"),
		"map_changed": Callable(self, "_on_map_changed"),
	}
	for signal_name: String in bindings:
		var callback: Callable = bindings[signal_name]
		if events.has_signal(signal_name) and not events.is_connected(signal_name, callback):
			events.connect(signal_name, callback)


func _on_player_registered(player: Node) -> void:
	publish_event("player_registered", {"name": player.name, "path": player.get_path()})


func _on_player_health_changed(current: int, maximum: int) -> void:
	publish_event("player_health_changed", {"current": current, "maximum": maximum})


func _on_player_stamina_changed(current: float, maximum: float) -> void:
	publish_event("player_stamina_changed", {"current": current, "maximum": maximum})


func _on_player_mana_changed(current: float, maximum: float) -> void:
	publish_event("player_mana_changed", {"current": current, "maximum": maximum})


func _on_score_changed(score: int) -> void:
	publish_event("score_changed", {"score": score})


func _on_sigil_collected(current: int, required: int) -> void:
	publish_event("sigil_collected", {"current": current, "required": required})


func _on_checkpoint_changed(position: Vector2) -> void:
	publish_event("checkpoint_changed", {"position": position})


func _on_objective_completed() -> void:
	publish_event("objective_completed", {"completed": true})


func _on_player_died() -> void:
	publish_event("player_died")


func _on_player_respawned() -> void:
	publish_event("player_respawned")


func _on_toast_requested(message: String) -> void:
	publish_event("toast_requested", {"message": message})


func _on_map_changed(source: String) -> void:
	publish_event("map_changed", {"source": source})


func _read_json_file(path: String) -> Dictionary:
	var recovery_error := _recover_interrupted_write(path)
	if recovery_error != OK and recovery_error != ERR_BUSY:
		return _fail("Cannot recover interrupted write for %s: %s" % [path, error_string(recovery_error)])
	var read_path := path
	var backup_path := _recovery_backup_path(path)
	if not FileAccess.file_exists(read_path):
		if FileAccess.file_exists(backup_path):
			# A writer may currently own the lock between the two same-volume
			# renames. The complete rollback copy remains safe for read-only use.
			read_path = backup_path
		else:
			return _fail("File does not exist: %s" % path)
	var result := _parse_json_file(read_path, path)
	if bool(result.get("ok", false)):
		if read_path == path and FileAccess.file_exists(backup_path):
			var cleanup_error := _discard_verified_recovery_backup(path, str(result.get("signature", "")))
			if cleanup_error != OK and cleanup_error != ERR_BUSY:
				push_warning("Cannot clean verified JSON recovery backup for %s: %s" % [path, error_string(cleanup_error)])
		return result
	if read_path == path and FileAccess.file_exists(backup_path):
		var invalid_signature := _file_signature(path)
		var restore_error := _restore_recovery_backup_over_invalid_target(path, invalid_signature)
		if restore_error == OK:
			var restored_result := _parse_json_file(path, path)
			if bool(restored_result.get("ok", false)):
				return restored_result
			return _fail("Recovered backup for %s is also invalid: %s" % [path, restored_result.get("error", "unknown error")])
		if restore_error != ERR_BUSY:
			return _fail("Invalid JSON in %s and backup restore failed: %s" % [path, error_string(restore_error)])
	return result


func _parse_json_file(read_path: String, display_path: String) -> Dictionary:
	var file := FileAccess.open(read_path, FileAccess.READ)
	if file == null:
		return _fail("Cannot open %s (%s)" % [display_path, error_string(FileAccess.get_open_error())])
	var text := file.get_as_text()
	file.close()
	var parser := JSON.new()
	var error := parser.parse(text)
	if error != OK:
		return _fail("Invalid JSON in %s at line %d: %s" % [display_path, parser.get_error_line(), parser.get_error_message()])
	if not parser.data is Dictionary:
		return _fail("Top-level JSON value in %s must be an object" % display_path)
	return {"ok": true, "data": parser.data, "signature": text.sha256_text()}


func _write_json_file(path: String, data: Dictionary, expected_signature := "") -> Error:
	return _write_text_with_recovery(path, _json_text(data), expected_signature)


func _write_text_with_recovery(path: String, text: String, expected_signature := "") -> Error:
	var directory := path.get_base_dir()
	var directory_error := DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(directory))
	if directory_error != OK and directory_error != ERR_ALREADY_EXISTS:
		return directory_error
	var lock_path := ProjectSettings.globalize_path(path) + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return ERR_BUSY
	var recovery_error := _recover_interrupted_write_locked(path, expected_signature)
	var result := recovery_error
	if recovery_error == OK:
		result = _write_text_with_recovery_locked(path, text, expected_signature)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release JSON write lock %s: %s" % [lock_path, error_string(unlock_error)])
	return result


func _write_text_with_recovery_locked(path: String, text: String, expected_signature := "") -> Error:
	if not expected_signature.is_empty() and _file_signature(path) != expected_signature:
		return ERR_BUSY
	var absolute_path := ProjectSettings.globalize_path(path)
	var temporary_path := "%s.tmp.%d.%d" % [absolute_path, OS.get_process_id(), Time.get_ticks_usec()]
	var backup_path := _recovery_backup_path(path)
	var file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(text)
	file.flush()
	var store_error := file.get_error()
	file.close()
	if store_error != OK:
		DirAccess.remove_absolute(temporary_path)
		return store_error
	var replacement_signature := text.sha256_text()
	if _file_signature(temporary_path) != replacement_signature:
		DirAccess.remove_absolute(temporary_path)
		return ERR_FILE_CORRUPT
	# Recheck after writing the temporary file so an editor save that happened
	# concurrently is never silently overwritten.
	if not expected_signature.is_empty() and _file_signature(path) != expected_signature:
		DirAccess.remove_absolute(temporary_path)
		return ERR_BUSY
	# Godot's Windows rename implementation deletes an existing destination
	# before MoveFileW. Move the verified original to a discoverable rollback
	# path first so a crash never destroys both complete documents.
	if OS.get_name() != "Windows" or not FileAccess.file_exists(path):
		var direct_rename_error := _rename_with_short_retry(temporary_path, absolute_path)
		if direct_rename_error != OK:
			DirAccess.remove_absolute(temporary_path)
			return direct_rename_error
		if _file_signature(path) == replacement_signature:
			return OK
		DirAccess.remove_absolute(absolute_path)
		return ERR_FILE_CORRUPT
	if FileAccess.file_exists(backup_path):
		DirAccess.remove_absolute(temporary_path)
		return ERR_BUSY
	var backup_error := _rename_with_short_retry(absolute_path, backup_path)
	if backup_error != OK:
		DirAccess.remove_absolute(temporary_path)
		return backup_error
	if not expected_signature.is_empty() and _file_signature(backup_path) != expected_signature:
		var stale_restore_error := _rename_with_short_retry(backup_path, absolute_path)
		DirAccess.remove_absolute(temporary_path)
		return ERR_BUSY if stale_restore_error == OK else stale_restore_error
	var rename_error := _rename_with_short_retry(temporary_path, absolute_path)
	if rename_error != OK:
		var restore_error := _rename_with_short_retry(backup_path, absolute_path)
		DirAccess.remove_absolute(temporary_path)
		return rename_error if restore_error == OK else restore_error
	if _file_signature(path) != replacement_signature:
		DirAccess.remove_absolute(absolute_path)
		var corrupt_restore_error := _rename_with_short_retry(backup_path, absolute_path)
		return ERR_FILE_CORRUPT if corrupt_restore_error == OK else corrupt_restore_error
	DirAccess.remove_absolute(backup_path)
	return OK


func _recover_interrupted_write(path: String) -> Error:
	var backup_path := _recovery_backup_path(path)
	if not FileAccess.file_exists(backup_path):
		return OK
	var lock_path := ProjectSettings.globalize_path(path) + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return ERR_BUSY
	var recovery_error := _recover_interrupted_write_locked(path)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release JSON recovery lock %s: %s" % [lock_path, error_string(unlock_error)])
	return recovery_error


func _recover_interrupted_write_locked(path: String, verified_target_signature := "") -> Error:
	var absolute_path := ProjectSettings.globalize_path(path)
	var backup_path := _recovery_backup_path(path)
	if not FileAccess.file_exists(backup_path):
		return OK
	if FileAccess.file_exists(path):
		# Never discard the last rollback copy until a caller has parsed/validated
		# the canonical target and proves it is still the same revision.
		if verified_target_signature.is_empty():
			return OK
		if _file_signature(path) != verified_target_signature:
			return ERR_BUSY
		return DirAccess.remove_absolute(backup_path)
	return _rename_with_short_retry(backup_path, absolute_path)


func _discard_verified_recovery_backup(path: String, verified_signature: String) -> Error:
	if verified_signature.is_empty() or not FileAccess.file_exists(_recovery_backup_path(path)):
		return OK
	var lock_path := ProjectSettings.globalize_path(path) + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return ERR_BUSY
	var cleanup_error := _recover_interrupted_write_locked(path, verified_signature)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release verified recovery lock %s: %s" % [lock_path, error_string(unlock_error)])
	return cleanup_error


func _restore_recovery_backup_over_invalid_target(path: String, invalid_signature: String) -> Error:
	var absolute_path := ProjectSettings.globalize_path(path)
	var backup_path := _recovery_backup_path(path)
	var lock_path := absolute_path + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return ERR_BUSY
	var result: Error = OK
	var quarantine_path := "%s.invalid.%d.%d" % [absolute_path, OS.get_process_id(), Time.get_ticks_usec()]
	if not FileAccess.file_exists(backup_path):
		result = ERR_FILE_NOT_FOUND
	elif not FileAccess.file_exists(path) or _file_signature(path) != invalid_signature:
		result = ERR_BUSY
	else:
		result = _rename_with_short_retry(absolute_path, quarantine_path)
		if result == OK:
			result = _rename_with_short_retry(backup_path, absolute_path)
			if result == OK:
				DirAccess.remove_absolute(quarantine_path)
			else:
				var rollback_error := _rename_with_short_retry(quarantine_path, absolute_path)
				if rollback_error != OK:
					result = rollback_error
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release invalid-target recovery lock %s: %s" % [lock_path, error_string(unlock_error)])
	return result


func _recovery_backup_path(path: String) -> String:
	return ProjectSettings.globalize_path(path) + RECOVERY_BACKUP_SUFFIX


func _rename_with_short_retry(from_path: String, to_path: String) -> Error:
	var rename_error := FAILED
	for attempt: int in FILE_RENAME_ATTEMPTS:
		rename_error = DirAccess.rename_absolute(from_path, to_path)
		if rename_error == OK:
			return OK
		if attempt + 1 < FILE_RENAME_ATTEMPTS:
			OS.delay_msec(FILE_RENAME_RETRY_MSEC)
	return rename_error


func _json_text(data: Dictionary) -> String:
	# Preserve the schema-first key order already present in the authored JSON.
	# Godot sorts object keys by default, which would rewrite the entire level on
	# a one-cell MCP edit and makes conflict-safe rollback indistinguishable from
	# unrelated external changes.
	return JSON.stringify(_json_safe(data), "  ", false) + "\n"


func _remember_written_signature(path: String, data: Dictionary) -> void:
	_file_signatures[path] = _json_text(data).sha256_text()
	_pending_file_signatures.erase(path)


func _file_signature(path: String) -> String:
	if not FileAccess.file_exists(path):
		return "missing"
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return "unreadable:%d" % FileAccess.get_open_error()
	var signature := file.get_as_text().sha256_text()
	file.close()
	return signature


func _configured_port() -> int:
	var value := OS.get_environment("GODOT_WS_PORT").strip_edges()
	if value.is_valid_int():
		var configured := int(value)
		if configured >= 1024 and configured <= 65535:
			return configured
	return DEFAULT_PORT


func _allow_unauthenticated_reads() -> bool:
	return OS.get_environment("GODOT_MCP_ALLOW_UNAUTHENTICATED_READS") == "1"


func _load_or_create_workspace_token() -> String:
	for environment_name: String in ["GODOT_MCP_TOKEN", "GODOT_BRIDGE_TOKEN"]:
		var environment_token := OS.get_environment(environment_name).strip_edges()
		if environment_token.length() >= 32 and environment_token.length() <= 512:
			return environment_token
	if FileAccess.file_exists(TOKEN_PATH):
		var existing := FileAccess.open(TOKEN_PATH, FileAccess.READ)
		if existing != null:
			var stored_token := existing.get_as_text().strip_edges()
			existing.close()
			if stored_token.length() >= 32 and stored_token.length() <= 512:
				return stored_token
	var crypto := Crypto.new()
	var generated := crypto.generate_random_bytes(32).hex_encode()
	if generated.is_empty():
		return ""
	var write_error := _write_text_with_recovery(TOKEN_PATH, generated + "\n")
	if write_error != OK:
		push_warning("Cannot create MCP workspace token: %s" % error_string(write_error))
		return ""
	return generated


func _deep_merge(target: Dictionary, patch: Dictionary) -> void:
	for key: Variant in patch:
		var incoming: Variant = patch[key]
		if incoming is Dictionary and target.get(key, null) is Dictionary:
			var nested: Dictionary = target[key]
			_deep_merge(nested, incoming)
			target[key] = nested
		else:
			target[key] = incoming


func _json_safe(value: Variant) -> Variant:
	if value is Dictionary:
		var dictionary := {}
		for key: Variant in value:
			dictionary[str(key)] = _json_safe(value[key])
		return dictionary
	if value is Array:
		var array: Array = []
		for item: Variant in value:
			array.append(_json_safe(item))
		return array
	if value is Vector2 or value is Vector2i:
		return {"x": value.x, "y": value.y}
	if value is Vector3 or value is Vector3i:
		return {"x": value.x, "y": value.y, "z": value.z}
	if value is Color:
		return value.to_html(true)
	if value is StringName or value is NodePath:
		return str(value)
	if typeof(value) == TYPE_OBJECT:
		return str(value)
	return value


func _send(peer: WebSocketPeer, message: Dictionary) -> void:
	if peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
		var text := JSON.stringify(_json_safe(message))
		if text.to_utf8_buffer().size() > MAX_OUTBOUND_MESSAGE_BYTES:
			peer.close(1009, "Response too large")
			return
		peer.send_text(text)


func _broadcast(message: Dictionary) -> void:
	for raw_id: Variant in _peers.keys():
		var peer_id := int(raw_id)
		if bool(_peer_authenticated.get(peer_id, false)):
			_send(_peers[peer_id], message)


func _open_peer_count() -> int:
	var count := 0
	for peer: WebSocketPeer in _peers.values():
		if peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
			count += 1
	return count


func _authenticated_peer_count() -> int:
	var count := 0
	for raw_id: Variant in _peers.keys():
		var peer_id := int(raw_id)
		var peer: WebSocketPeer = _peers[peer_id]
		if bool(_peer_authenticated.get(peer_id, false)) and peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
			count += 1
	return count


func _set_connected(value: bool) -> void:
	if connected == value:
		return
	connected = value
	connected_changed.emit(connected)
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal("live_sync_status_changed"):
		events.emit_signal("live_sync_status_changed", connected, "Connected to authenticated local MCP" if connected else "Waiting on ws://%s:%d" % [HOST, _port])


func _ok(result: Variant) -> Dictionary:
	return {"ok": true, "result": result}


func _fail(message: String) -> Dictionary:
	return {"ok": false, "error": message}
