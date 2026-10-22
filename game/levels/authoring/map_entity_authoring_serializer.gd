@tool
class_name MapEntityAuthoringSerializer
extends RefCounted

const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const WRITE_LOCK_SUFFIX := ".write.lock"
const RECOVERY_BACKUP_SUFFIX := ".write.backup"
const FILE_RENAME_ATTEMPTS := 8
const FILE_RENAME_RETRY_MSEC := 8

const PRESET_PATHS := {
	"player": "res://game/levels/authoring/presets/player.tscn",
	"skeleton": "res://game/levels/authoring/presets/skeleton.tscn",
	"skeleton_reaper": "res://game/levels/authoring/presets/skeleton_reaper.tscn",
	"bone_reaper_captain": "res://game/levels/authoring/presets/bone_reaper_captain.tscn",
	"hooded_archer_miniboss": "res://game/levels/authoring/presets/hooded_archer_miniboss.tscn",
	"vampire": "res://game/levels/authoring/presets/vampire.tscn",
	"coin": "res://game/levels/authoring/presets/coin.tscn",
	"sigil": "res://game/levels/authoring/presets/sigil.tscn",
	"checkpoint": "res://game/levels/authoring/presets/checkpoint.tscn",
	"chest": "res://game/levels/authoring/presets/chest.tscn",
	"bow_reward": "res://game/levels/authoring/presets/bow_reward.tscn",
	"exit_gate": "res://game/levels/authoring/presets/exit_gate.tscn",
	"floor_door": "res://game/levels/authoring/presets/floor_door.tscn",
	"spikes": "res://game/levels/authoring/presets/spikes.tscn",
	"torch": "res://game/levels/authoring/presets/torch.tscn",
}


static func serialize_container(container: Node2D) -> Dictionary:
	if container == null:
		return _failure("AuthoringEntities container was not found.")
	var markers: Array[MapElementMarker] = []
	_collect_markers(container, markers)
	var entities: Array = []
	var ids := {}
	var warnings := PackedStringArray()
	for marker: MapElementMarker in markers:
		var entity_id := marker.get_effective_entity_id()
		if ids.has(entity_id):
			return _failure("Duplicate map entity ID '%s'. Rename one marker or set Entity ID." % entity_id)
		ids[entity_id] = true
		var level_position := _position_relative_to(container, marker)
		var door_target := Vector2.INF
		if marker.entity_type == "floor_door" and not marker.door_target_marker.is_empty():
			var target := marker.get_node_or_null(marker.door_target_marker) as Node2D
			if target == null:
				warnings.append("%s: paired floor-door target is missing; fallback position was used." % entity_id)
			else:
				door_target = _position_relative_to(container, target)
		entities.append(marker.make_entity_dictionary(level_position, door_target))
	return {
		"ok": true,
		"entities": entities,
		"count": entities.size(),
		"warnings": warnings,
	}


static func serialize_level_document(container: Node2D, source_document: Dictionary) -> Dictionary:
	var result := serialize_container(container)
	if not bool(result.get("ok", false)):
		return result
	var document := source_document.duplicate(true)
	document["entities"] = result["entities"]
	var validation: Dictionary = LevelSchemaValidator.validate_level(document)
	if not bool(validation.get("ok", false)):
		return _failure("Entity export would make the level invalid: %s" % validation.get("error", "unknown error"))
	result["document"] = document
	return result


static func serialize_level_file(
		container: Node2D,
		level_path: String,
		expected_signature := "",
) -> Dictionary:
	var loaded := _read_level_document(level_path)
	if not bool(loaded.get("ok", false)):
		return loaded
	var result := serialize_level_document(container, loaded["document"])
	if not bool(result.get("ok", false)):
		return result
	var compared_signature := String(expected_signature)
	if compared_signature.is_empty():
		compared_signature = String(loaded.get("signature", ""))
	var written := _write_level_document(level_path, result["document"], compared_signature)
	if not bool(written.get("ok", false)):
		return written
	result["path"] = level_path
	result["signature"] = written.get("signature", "")
	return result


static func deserialize_level_file(
		container: Node2D,
		level_path: String,
		edited_scene_root: Node = null,
) -> Dictionary:
	var loaded := _read_level_document(level_path)
	if not bool(loaded.get("ok", false)):
		return loaded
	var result := deserialize_entities(container, loaded["document"].get("entities", []), edited_scene_root)
	result["path"] = level_path
	return result


static func deserialize_entities(
		container: Node2D,
		entities: Array,
		edited_scene_root: Node = null,
) -> Dictionary:
	if container == null:
		return _failure("AuthoringEntities container was not found.")
	var scene_owner := edited_scene_root
	if scene_owner == null:
		scene_owner = container.owner
	# Import always replaces the preview.  Without this, pressing "Load
	# elements" a second time left duplicate markers in the editor and the next
	# save was rejected for duplicate IDs.
	_clear_markers(container)
	var markers: Array[MapElementMarker] = []
	var warnings := PackedStringArray()
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			return _failure("Level entities contains a non-object entry.")
		var entity: Dictionary = raw_entity
		var entity_type := String(entity.get("type", ""))
		if not PRESET_PATHS.has(entity_type):
			return _failure("No drag-and-drop preset is registered for entity type '%s'." % entity_type)
		var preset := load(String(PRESET_PATHS[entity_type])) as PackedScene
		if preset == null:
			return _failure("Could not load authoring preset: %s" % PRESET_PATHS[entity_type])
		var marker := preset.instantiate() as MapElementMarker
		if marker == null:
			return _failure("Authoring preset root is not MapElementMarker: %s" % PRESET_PATHS[entity_type])
		marker.name = _safe_node_name(String(entity.get("id", entity_type)))
		marker.entity_id = String(entity.get("id", ""))
		marker.entity_type = entity_type
		marker.position = _array_to_vector2(entity.get("position", []), Vector2.ZERO)
		if entity_type in MapElementMarker.ENEMY_TYPES:
			marker.patrol_distance = float(entity.get("patrol", 72.0))
		elif entity_type == "chest":
			marker.chest_score_reward = int(entity.get("score_reward", 150))
		elif entity_type == "floor_door":
			marker.door_target_position = _array_to_vector2(entity.get("target_position", []), Vector2.ZERO)
			marker.door_label = String(entity.get("label", "Door"))
			marker.door_message = String(entity.get("message", "Nhấn chuột trái để đi qua cửa"))
		container.add_child(marker)
		if scene_owner != null:
			marker.owner = scene_owner
		markers.append(marker)
	_link_paired_floor_doors(markers, container, warnings)
	return {
		"ok": true,
		"count": markers.size(),
		"markers": markers,
		"warnings": warnings,
	}


static func _read_level_document(level_path: String) -> Dictionary:
	var recovery := _recover_interrupted_replacement(level_path)
	if not bool(recovery.get("ok", false)):
		return recovery
	if not FileAccess.file_exists(level_path):
		return _failure("Level file does not exist: %s" % level_path)
	var file := FileAccess.open(level_path, FileAccess.READ)
	if file == null:
		return _failure("Could not open level file: %s" % level_path)
	var contents := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(contents)
	if not parsed is Dictionary:
		return _failure("Level file is not a JSON object: %s" % level_path)
	return {
		"ok": true,
		"document": parsed,
		"signature": contents.sha256_text(),
	}


static func _write_level_document(
		level_path: String,
		document: Dictionary,
		expected_signature: String,
) -> Dictionary:
	var directory_error := DirAccess.make_dir_recursive_absolute(
		ProjectSettings.globalize_path(level_path.get_base_dir())
	)
	if directory_error != OK and directory_error != ERR_ALREADY_EXISTS:
		return _failure("Could not create the level directory: %s" % error_string(directory_error))
	var lock_path := ProjectSettings.globalize_path(level_path) + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return _conflict_failure("Another editor/MCP writer currently owns the level JSON write lock.")
	var recovery := _recover_backup_locked(level_path, expected_signature)
	var result := recovery
	if bool(recovery.get("ok", false)):
		result = _write_level_document_locked(level_path, document, expected_signature)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release level JSON write lock %s: %s" % [
			lock_path,
			error_string(unlock_error),
		])
	return result


static func _write_level_document_locked(
		level_path: String,
		document: Dictionary,
		expected_signature: String,
) -> Dictionary:
	if expected_signature.is_empty() or _file_signature(level_path) != expected_signature:
		return _conflict_failure(
			"Level JSON revision changed before replacement (compare-and-swap failed)."
		)
	var contents := JSON.stringify(document, "  ", false, true) + "\n"
	var replacement_signature := contents.sha256_text()
	var target_absolute := ProjectSettings.globalize_path(level_path)
	# Keep the temporary file beside the target so promotion never crosses a
	# volume boundary. This also makes the rollback file discoverable to the
	# live-sync and MCP writers that share the same lock protocol.
	var temporary_absolute := "%s.tmp.%d.%d" % [
		target_absolute,
		OS.get_process_id(),
		Time.get_ticks_usec(),
	]
	var file := FileAccess.open(temporary_absolute, FileAccess.WRITE)
	if file == null:
		return _failure("Could not create the temporary level file: %s" % error_string(FileAccess.get_open_error()))
	file.store_string(contents)
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return _failure("Temporary level write failed: %s" % error_string(write_error))
	if _file_signature(temporary_absolute) != replacement_signature:
		DirAccess.remove_absolute(temporary_absolute)
		return _failure("Temporary level verification failed; the original JSON was preserved.")
	# CAS is checked a second time after the potentially slow serialization and
	# flush, immediately before the verified file is promoted.
	if _file_signature(level_path) != expected_signature:
		DirAccess.remove_absolute(temporary_absolute)
		return _conflict_failure(
			"Level JSON revision changed during serialization (compare-and-swap failed)."
		)
	if OS.get_name() == "Windows":
		return _replace_file_windows(
			level_path,
			temporary_absolute,
			target_absolute,
			expected_signature,
			replacement_signature,
		)
	var rename_error := _rename_with_short_retry(temporary_absolute, target_absolute)
	if rename_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return _failure(
			"Level replacement failed (%s); the original JSON was preserved."
			% error_string(rename_error)
		)
	if _file_signature(level_path) != replacement_signature:
		return _conflict_failure("Promoted level JSON failed hash verification.")
	return {"ok": true, "signature": replacement_signature}


static func _replace_file_windows(
		level_path: String,
		temporary_absolute: String,
		target_absolute: String,
		expected_signature: String,
		replacement_signature: String,
) -> Dictionary:
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	# Godot's Windows rename cannot atomically replace an existing destination.
	# Retain a complete, hash-verified rollback copy between the two renames.
	var backup_error := _rename_with_short_retry(target_absolute, backup_absolute)
	if backup_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return _failure(
			"Could not create the recovery backup (%s); the original JSON was preserved."
			% error_string(backup_error)
		)
	if _file_signature(backup_absolute) != expected_signature:
		var stale_restore_error := _restore_backup(backup_absolute, target_absolute, false)
		DirAccess.remove_absolute(temporary_absolute)
		return _conflict_failure("Recovery backup failed CAS verification; rollback %s." % [
			"succeeded" if stale_restore_error == OK else "failed (%s)" % error_string(stale_restore_error),
		])
	var promote_error := _rename_with_short_retry(temporary_absolute, target_absolute)
	if promote_error != OK:
		var promote_restore_error := _restore_backup(backup_absolute, target_absolute, true)
		DirAccess.remove_absolute(temporary_absolute)
		return _failure("Level promotion failed (%s); rollback %s." % [
			error_string(promote_error),
			"succeeded" if promote_restore_error == OK else "failed (%s)" % error_string(promote_restore_error),
		])
	if _file_signature(level_path) != replacement_signature:
		var corrupt_restore_error := _restore_backup(backup_absolute, target_absolute, true)
		return _conflict_failure("Promoted level JSON failed verification; rollback %s." % [
			"succeeded" if corrupt_restore_error == OK else "failed (%s)" % error_string(corrupt_restore_error),
		])
	var cleanup_error := DirAccess.remove_absolute(backup_absolute)
	if cleanup_error != OK:
		push_warning("Level replacement succeeded but backup cleanup failed at %s: %s" % [
			backup_absolute,
			error_string(cleanup_error),
		])
	return {"ok": true, "signature": replacement_signature}


static func _recover_interrupted_replacement(level_path: String) -> Dictionary:
	var target_absolute := ProjectSettings.globalize_path(level_path)
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	if FileAccess.file_exists(target_absolute) or not FileAccess.file_exists(backup_absolute):
		return {"ok": true, "recovered": false}
	var lock_path := target_absolute + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return _conflict_failure(
			"Level JSON is between replacement steps and its write lock is still active."
		)
	var recovery := _recover_backup_locked(level_path, "")
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release level recovery lock %s: %s" % [
			lock_path,
			error_string(unlock_error),
		])
	return recovery


static func _recover_backup_locked(level_path: String, expected_signature: String) -> Dictionary:
	var target_absolute := ProjectSettings.globalize_path(level_path)
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	if not FileAccess.file_exists(backup_absolute):
		return {"ok": true, "recovered": false}
	if FileAccess.file_exists(target_absolute):
		# Both files means promotion completed and cleanup was interrupted. Only
		# discard the rollback copy after CAS proves the canonical revision is the
		# exact document this caller parsed.
		if expected_signature.is_empty() or _file_signature(level_path) != expected_signature:
			return _conflict_failure(
				"A recovery backup exists for a different level JSON revision."
			)
		var cleanup_error := DirAccess.remove_absolute(backup_absolute)
		if cleanup_error != OK:
			return _failure("Could not clear the verified recovery backup: %s" % error_string(cleanup_error))
		return {"ok": true, "recovered": false}
	var restore_error := _rename_with_short_retry(backup_absolute, target_absolute)
	if restore_error != OK:
		return _failure("Interrupted level replacement recovery failed: %s" % error_string(restore_error))
	if not FileAccess.file_exists(target_absolute):
		return _failure("Recovery reported success but the level JSON is still missing.")
	return {
		"ok": true,
		"recovered": true,
		"signature": _file_signature(level_path),
	}


static func _restore_backup(
		backup_absolute: String,
		target_absolute: String,
		remove_target: bool,
) -> Error:
	if FileAccess.file_exists(target_absolute):
		if not remove_target:
			return ERR_ALREADY_EXISTS
		var remove_error := DirAccess.remove_absolute(target_absolute)
		if remove_error != OK:
			return remove_error
	return _rename_with_short_retry(backup_absolute, target_absolute)


static func _rename_with_short_retry(from_path: String, to_path: String) -> Error:
	var rename_error := FAILED
	for attempt: int in FILE_RENAME_ATTEMPTS:
		rename_error = DirAccess.rename_absolute(from_path, to_path)
		if rename_error == OK:
			return OK
		if attempt + 1 < FILE_RENAME_ATTEMPTS:
			OS.delay_msec(FILE_RENAME_RETRY_MSEC)
	return rename_error


static func _file_signature(path: String) -> String:
	if not FileAccess.file_exists(path):
		return "missing"
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return "unreadable:%d" % FileAccess.get_open_error()
	var signature := file.get_as_text().sha256_text()
	file.close()
	return signature


static func _collect_markers(node: Node, output: Array[MapElementMarker]) -> void:
	for child: Node in node.get_children():
		if child is MapElementMarker:
			output.append(child as MapElementMarker)
		else:
			_collect_markers(child, output)


static func _clear_markers(container: Node) -> void:
	var markers: Array[MapElementMarker] = []
	_collect_markers(container, markers)
	for marker: MapElementMarker in markers:
		var parent := marker.get_parent()
		if parent != null:
			parent.remove_child(marker)
		marker.free()


static func _link_paired_floor_doors(
		markers: Array[MapElementMarker],
		container: Node2D,
		warnings: PackedStringArray,
) -> void:
	for marker: MapElementMarker in markers:
		if marker.entity_type != "floor_door":
			continue
		var best: MapElementMarker
		var best_distance := 0.51
		for candidate: MapElementMarker in markers:
			if candidate == marker or candidate.entity_type != "floor_door":
				continue
			var distance := _position_relative_to(container, candidate).distance_to(marker.door_target_position)
			if distance < best_distance:
				best = candidate
				best_distance = distance
		if best != null:
			marker.door_target_marker = marker.get_path_to(best)
		else:
			warnings.append("%s: no paired floor door exists at %s; fallback target is preserved." % [
				marker.get_effective_entity_id(), marker.door_target_position,
			])


static func _position_relative_to(container: Node2D, node: Node2D) -> Vector2:
	if container.is_inside_tree() and node.is_inside_tree():
		return container.to_local(node.global_position)
	if node.get_parent() == container:
		return node.position
	var transform := Transform2D.IDENTITY
	var cursor: Node = node
	while cursor != null and cursor != container:
		if cursor is Node2D:
			transform = (cursor as Node2D).transform * transform
		cursor = cursor.get_parent()
	return transform.origin


static func _array_to_vector2(value: Variant, fallback: Vector2) -> Vector2:
	if value is Array and value.size() >= 2:
		return Vector2(float(value[0]), float(value[1]))
	return fallback


static func _safe_node_name(value: String) -> String:
	var candidate := value.to_pascal_case()
	for forbidden: String in [".", ":", "@", "/", "\\", "%"]:
		candidate = candidate.replace(forbidden, "_")
	return candidate if not candidate.is_empty() else "MapElement"


static func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message, "count": 0, "warnings": PackedStringArray()}


static func _conflict_failure(message: String) -> Dictionary:
	var result := _failure(message)
	result["conflict"] = true
	return result
