extends SceneTree

const Serializer := preload("res://game/levels/authoring/map_entity_authoring_serializer.gd")

var _checks := 0
var _failures := 0


func _initialize() -> void:
	call_deferred(&"_run")


func _run() -> void:
	var stage := Node2D.new()
	stage.name = "AuthoringTestStage"
	root.add_child(stage)
	var container := Node2D.new()
	container.name = "AuthoringEntities"
	stage.add_child(container)

	for entity_type: String in Serializer.PRESET_PATHS:
		var path := String(Serializer.PRESET_PATHS[entity_type])
		_expect(ResourceLoader.exists(path), "preset exists: %s" % entity_type)
		var scene := load(path) as PackedScene
		var marker := scene.instantiate() as MapElementMarker if scene != null else null
		_expect(marker != null, "preset instantiates MapElementMarker: %s" % entity_type)
		if marker != null:
			_expect(marker.entity_type == entity_type, "preset type is correct: %s" % entity_type)
			marker.free()

	var imported: Dictionary = Serializer.deserialize_level_file(
		container,
		"res://data/levels/crypt_entrance.json",
		stage,
	)
	_expect(bool(imported.get("ok", false)), "existing Level 01 entities deserialize")
	_expect(int(imported.get("count", 0)) > 20, "all Level 01 entity markers are created")

	var floor_door_count := 0
	var runtime_hidden_count := 0
	for child: Node in container.get_children():
		if child is MapElementMarker:
			var marker := child as MapElementMarker
			if marker.entity_type == "floor_door":
				floor_door_count += 1
				_expect(not marker.door_target_marker.is_empty(), "%s links to its paired door" % marker.entity_id)
			if not marker.visible and marker.process_mode == Node.PROCESS_MODE_DISABLED:
				runtime_hidden_count += 1
	print("[INFO] Runtime-hidden markers: %d/%d; editor_hint=%s" % [
		runtime_hidden_count, imported.get("count", 0), Engine.is_editor_hint(),
	])
	_expect(floor_door_count == 4, "all four floor-door markers import")
	_expect(runtime_hidden_count == int(imported.get("count", 0)), "runtime markers are invisible and inert")

	var exported: Dictionary = Serializer.serialize_container(container)
	_expect(bool(exported.get("ok", false)), "authoring markers serialize")
	_expect(int(exported.get("count", 0)) == int(imported.get("count", -1)), "round-trip preserves entity count")
	var source := _read_json("res://data/levels/crypt_entrance.json")
	var document_result: Dictionary = Serializer.serialize_level_document(container, source)
	_expect(bool(document_result.get("ok", false)), "round-tripped document passes LevelSchema")

	var temporary_level_path := "user://map_entity_authoring_serializer_test.json"
	_cleanup_serializer_artifacts(temporary_level_path)
	var seeded := _write_text(
		temporary_level_path,
		JSON.stringify(source, "  ", false, true) + "\n",
	)
	_expect(seeded, "temporary level fixture is created")
	var file_export: Dictionary = Serializer.serialize_level_file(container, temporary_level_path)
	_expect(bool(file_export.get("ok", false)), "entity export uses verified replacement")
	var saved := _read_json(temporary_level_path)
	_expect(saved.get("layers", {}) == source.get("layers", {}), "file export preserves every authored tile layer")
	_expect(saved.get("metadata", {}) == source.get("metadata", {}), "file export preserves level metadata")

	var before_stale_attempt := _read_text(temporary_level_path)
	var stale_export: Dictionary = Serializer.serialize_level_file(
		container,
		temporary_level_path,
		"stale-test-signature",
	)
	_expect(not bool(stale_export.get("ok", true)), "stale expected signature blocks entity export")
	_expect(bool(stale_export.get("conflict", false)), "stale expected signature reports a CAS conflict")
	_expect(_read_text(temporary_level_path) == before_stale_attempt, "stale CAS failure leaves the original JSON byte-for-byte intact")

	var lock_path := ProjectSettings.globalize_path(temporary_level_path) + Serializer.WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	_expect(lock_error == OK, "test acquires the shared serializer write lock")
	if lock_error == OK:
		var before_locked_attempt := _read_text(temporary_level_path)
		var locked_export: Dictionary = Serializer.serialize_level_file(container, temporary_level_path)
		_expect(not bool(locked_export.get("ok", true)), "shared writer lock blocks entity export")
		_expect(bool(locked_export.get("conflict", false)), "shared writer lock reports a conflict")
		_expect(_read_text(temporary_level_path) == before_locked_attempt, "lock conflict leaves the original JSON byte-for-byte intact")
		DirAccess.remove_absolute(lock_path)
	_cleanup_serializer_artifacts(temporary_level_path)

	stage.queue_free()
	if _failures == 0:
		print("MAP ENTITY AUTHORING PASSED: %d checks" % _checks)
		quit(0)
	else:
		push_error("MAP ENTITY AUTHORING FAILED: %d/%d checks" % [_failures, _checks])
		quit(1)


func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var contents := file.get_as_text()
	file.close()
	return contents


func _write_text(path: String, contents: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(contents)
	file.flush()
	var result := file.get_error() == OK
	file.close()
	return result


func _cleanup_serializer_artifacts(path: String) -> void:
	var absolute_path := ProjectSettings.globalize_path(path)
	var lock_path := absolute_path + Serializer.WRITE_LOCK_SUFFIX
	if DirAccess.dir_exists_absolute(lock_path):
		DirAccess.remove_absolute(lock_path)
	for file_path: String in [
		absolute_path,
		absolute_path + Serializer.RECOVERY_BACKUP_SUFFIX,
	]:
		if FileAccess.file_exists(file_path):
			DirAccess.remove_absolute(file_path)


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if condition:
		print("[PASS] ", label)
	else:
		_failures += 1
		push_error("[FAIL] %s" % label)
