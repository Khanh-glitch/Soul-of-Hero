extends SceneTree

const TIMEOUT_MSEC := 5000

var _socket := WebSocketPeer.new()
var _responses: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	# Autoloads enter the tree before this deferred call, so RealtimeBridge is listening.
	_socket.inbound_buffer_size = 8 * 1024 * 1024
	_socket.outbound_buffer_size = 8 * 1024 * 1024
	_socket.max_queued_packets = 4096
	var port := OS.get_environment("GODOT_WS_PORT").to_int()
	if port < 1024 or port > 65535:
		port = 9080
	var url := "ws://127.0.0.1:%d" % port
	var error := _socket.connect_to_url(url)
	if error != OK:
		_fail("connect_to_url failed: %s" % error_string(error))
		return
	var deadline := Time.get_ticks_msec() + TIMEOUT_MSEC
	while _socket.get_ready_state() == WebSocketPeer.STATE_CONNECTING and Time.get_ticks_msec() < deadline:
		_socket.poll()
		await create_timer(0.01).timeout
	if _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		_fail("WebSocket did not open")
		return

	var token := _workspace_token()
	if token.is_empty():
		_fail("workspace token is unavailable")
		return
	var auth_sent := false
	var authenticated := false
	while not authenticated and Time.get_ticks_msec() < deadline:
		_socket.poll()
		while _socket.get_available_packet_count() > 0:
			var parser := JSON.new()
			if parser.parse(_socket.get_packet().get_string_from_utf8()) != OK or not parser.data is Dictionary:
				continue
			var message: Dictionary = parser.data
			if message.get("type", "") == "hello" and not auth_sent:
				auth_sent = true
				_socket.send_text(JSON.stringify({
					"type": "auth",
					"id": "auth-smoke",
					"token": token,
					"workspace_id": str(message.get("workspace_id", "")),
				}))
			elif message.get("type", "") == "auth_result" and message.get("id", "") == "auth-smoke":
				authenticated = bool(message.get("ok", false))
		await create_timer(0.01).timeout
	if not authenticated:
		_fail("workspace-token authentication failed")
		return

	_socket.send_text(JSON.stringify({"type": "request", "id": "status-1", "command": "status", "params": {}}))
	_socket.send_text(JSON.stringify({"type": "request", "id": "level-1", "command": "get_level", "params": {}}))
	while _responses.size() < 2 and Time.get_ticks_msec() < deadline:
		_socket.poll()
		while _socket.get_available_packet_count() > 0:
			var parser := JSON.new()
			var parse_error := parser.parse(_socket.get_packet().get_string_from_utf8())
			if parse_error == OK and parser.data is Dictionary and parser.data.get("type", "") == "response":
				_responses[str(parser.data.get("id", ""))] = parser.data
		await create_timer(0.01).timeout

	if not _responses.has("status-1") or not bool(_responses["status-1"].get("ok", false)):
		_fail("status response missing or failed")
		return
	if not _responses.has("level-1") or not bool(_responses["level-1"].get("ok", false)):
		_fail("get_level response missing or failed")
		return
	var status: Dictionary = _responses["status-1"].get("result", {})
	if status.get("endpoint", "") != url:
		_fail("unexpected endpoint in status response")
		return
	print("MCP realtime protocol smoke test passed: status + get_level request/response")
	_socket.close(1000, "test complete")
	quit(0)


func _workspace_token() -> String:
	for environment_name: String in ["GODOT_MCP_TOKEN", "GODOT_BRIDGE_TOKEN"]:
		var environment_token := OS.get_environment(environment_name).strip_edges()
		if not environment_token.is_empty():
			return environment_token
	var file := FileAccess.open("res://.godot/mcp_bridge_token", FileAccess.READ)
	if file == null:
		return ""
	var token := file.get_as_text().strip_edges()
	file.close()
	return token


func _fail(message: String) -> void:
	push_error("MCP realtime protocol smoke test failed: %s" % message)
	_socket.close()
	quit(1)
