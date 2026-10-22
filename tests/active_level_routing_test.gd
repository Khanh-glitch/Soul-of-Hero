extends SceneTree

const DEFAULT_LEVEL_PATH := "res://data/levels/crypt_entrance.json"
const PROBE_LEVEL_PATH := "res://.artifacts/active_level_routing_probe.json"
const PROBE_NAME := "Active level routing probe"

var _checks := 0
var _failures := 0


class LiveLevelStub:
	extends Node

	var level_data_path := ""
	var reload_count := 0


	func _init(path: String = "") -> void:
		level_data_path = path


	func reload_from_disk() -> bool:
		reload_count += 1
		return true


func _initialize() -> void:
	call_deferred(&"_run")


func _run() -> void:
	var bridge := root.get_node_or_null("RealtimeBridge")
	_expect(bridge != null, "RealtimeBridge autoload is available")
	if bridge == null:
		_finish()
		return

	var document := _read_json(DEFAULT_LEVEL_PATH)
	_expect(not document.is_empty(), "canonical level fixture is readable")
	if document.is_empty() or not _write_probe(document):
		_finish()
		return

	var live_level := LiveLevelStub.new()
	live_level.name = "ActiveLevelProbe"
	live_level.add_to_group(&"live_level")
	root.add_child(live_level)
	# Adding the group before the node enters the tree is supported, but assigning
	# the path afterwards mirrors the production Main scene's run-level handoff.
	live_level.level_data_path = PROBE_LEVEL_PATH

	var status: Dictionary = bridge.call(&"get_status")
	_expect(status.get("active_level_path", "") == PROBE_LEVEL_PATH, "status reports the active live_level data path")
	var watched_files: Array = status.get("watched_files", [])
	_expect(watched_files.has(PROBE_LEVEL_PATH), "status watches the active level JSON")
	_expect(not watched_files.has(DEFAULT_LEVEL_PATH), "status does not advertise the inactive default level")

	# get_level is intentionally called before the 0.4 s file-watch poll. A command
	# must never return the previous level just because the scene changed recently.
	var immediate_get: Dictionary = bridge.call(&"_dispatch_command", "get_level", {})
	var immediate_document: Dictionary = immediate_get.get("result", {})
	_expect(bool(immediate_get.get("ok", false)), "get_level succeeds immediately after the active scene changes")
	_expect(immediate_document.get("name", "") == PROBE_NAME, "get_level reads the active path without waiting for file polling")

	var reload: Dictionary = bridge.call(&"_dispatch_command", "reload", {"target": "level"})
	var reload_result: Dictionary = reload.get("result", {})
	var level_result: Dictionary = reload_result.get("level", {})
	_expect(bool(reload.get("ok", false)), "reload level command succeeds for the active path")
	_expect(level_result.get("path", "") == PROBE_LEVEL_PATH, "reload level command reports the active path")
	_expect(live_level.reload_count > 0, "active live_level receives the reload callback")

	var conflicting_level := LiveLevelStub.new(DEFAULT_LEVEL_PATH)
	conflicting_level.name = "ConflictingLevelProbe"
	conflicting_level.add_to_group(&"live_level")
	root.add_child(conflicting_level)
	var ambiguous_status: Dictionary = bridge.call(&"get_status")
	_expect(ambiguous_status.get("active_level_path", "") == "", "status fails closed when two live levels own different JSON paths")
	_expect(not ambiguous_status.get("watched_files", []).has(PROBE_LEVEL_PATH), "ambiguous status does not advertise a writable level JSON")
	var ambiguous_get: Dictionary = bridge.call(&"_dispatch_command", "get_level", {})
	_expect(not bool(ambiguous_get.get("ok", true)), "get_level rejects an ambiguous active level instead of returning stale data")
	var ambiguous_reload: Dictionary = bridge.call(&"_dispatch_command", "reload", {"target": "level"})
	var ambiguous_level_result: Dictionary = ambiguous_reload.get("result", {}).get("level", {})
	_expect(not bool(ambiguous_level_result.get("ok", true)), "reload refuses to choose between conflicting live levels")
	conflicting_level.queue_free()
	await process_frame

	# The editor dock's resolver is intentionally fail-closed: no root, no owner,
	# or multiple owners all resolve to an empty path and disable mutating controls.
	var plugin_source := FileAccess.get_file_as_string("res://addons/live_sync/live_sync_plugin.gd")
	_expect(plugin_source.contains("if root == null:\n\t\treturn \"\""), "live-sync resolver rejects an editor with no open scene")
	_expect(plugin_source.contains("if candidates.size() != 1:\n\t\treturn \"\""), "live-sync resolver rejects non-level and ambiguous scenes")
	_expect(plugin_source.contains("_pull_button.disabled = _level_path.is_empty()"), "live-sync Pull is disabled without an active level")
	_expect(plugin_source.contains("_push_button.disabled = _level_path.is_empty()"), "live-sync Push is disabled without an active level")
	_expect(plugin_source.contains("_auto_sync.disabled = _level_path.is_empty()"), "live-sync auto-sync is disabled without an active level")

	live_level.queue_free()
	await process_frame
	_cleanup_probe()
	_finish()


func _read_json(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}


func _write_probe(document: Dictionary) -> bool:
	var artifact_dir := ProjectSettings.globalize_path("res://.artifacts")
	var mkdir_error := DirAccess.make_dir_recursive_absolute(artifact_dir)
	if mkdir_error != OK:
		_expect(false, "probe artifact directory can be created")
		return false
	var probe := document.duplicate(true)
	probe["name"] = PROBE_NAME
	var file := FileAccess.open(PROBE_LEVEL_PATH, FileAccess.WRITE)
	if file == null:
		_expect(false, "active-level probe JSON can be created")
		return false
	file.store_string(JSON.stringify(probe, "  ") + "\n")
	file.close()
	return true


func _cleanup_probe() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(PROBE_LEVEL_PATH))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(PROBE_LEVEL_PATH + ".write.backup"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(PROBE_LEVEL_PATH + ".write.lock"))


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if condition:
		print("[PASS] ", label)
	else:
		_failures += 1
		push_error("[FAIL] %s" % label)


func _finish() -> void:
	_cleanup_probe()
	if _failures == 0:
		print("ACTIVE LEVEL ROUTING PASSED: %d checks" % _checks)
		quit(0)
	else:
		push_error("ACTIVE LEVEL ROUTING FAILED: %d/%d checks" % [_failures, _checks])
		quit(1)
