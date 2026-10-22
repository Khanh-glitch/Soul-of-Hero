@tool
extends EditorPlugin

const DEFAULT_LEVEL_PATH := "res://data/levels/crypt_entrance.json"
const POLL_INTERVAL := 0.75
const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const WRITE_LOCK_SUFFIX := ".write.lock"
const RECOVERY_BACKUP_SUFFIX := ".write.backup"
const SYNC_LAYERS := ["Backdrop", "Geometry", "Decor"]
const DEFAULT_LAYER_INDEX := 1

var _dock: VBoxContainer
var _path_label: Label
var _layer_selector: OptionButton
var _pull_button: Button
var _push_button: Button
var _hint_label: Label
var _status_label: Label
var _auto_sync: CheckButton
var _tracked_layer: TileMapLayer
var _poll_elapsed := 0.0
var _last_file_signature := ""
var _last_node_signature := ""
var _busy := false
var _level_path := DEFAULT_LEVEL_PATH


func _enter_tree() -> void:
	_build_dock()
	add_control_to_dock(EditorPlugin.DOCK_SLOT_RIGHT_BL, _dock)
	get_editor_interface().get_selection().selection_changed.connect(_on_selection_changed)
	if not scene_changed.is_connected(_on_scene_changed):
		scene_changed.connect(_on_scene_changed)
	set_process(true)
	call_deferred("_reset_tracking")


func _exit_tree() -> void:
	set_process(false)
	var selection := get_editor_interface().get_selection()
	if selection.selection_changed.is_connected(_on_selection_changed):
		selection.selection_changed.disconnect(_on_selection_changed)
	if scene_changed.is_connected(_on_scene_changed):
		scene_changed.disconnect(_on_scene_changed)
	if _dock != null:
		remove_control_from_docks(_dock)
		_dock.queue_free()
	_tracked_layer = null


func _process(delta: float) -> void:
	_poll_elapsed += delta
	if _poll_elapsed < POLL_INTERVAL:
		return
	_poll_elapsed = fmod(_poll_elapsed, POLL_INTERVAL)
	_poll_sync()


func _build_dock() -> void:
	_dock = VBoxContainer.new()
	_dock.name = "Map Live Sync"
	_dock.custom_minimum_size = Vector2(280.0, 0.0)

	var title := Label.new()
	title.text = "Map Layer Live Sync"
	title.add_theme_font_size_override("font_size", 17)
	_dock.add_child(title)

	var path_label := Label.new()
	_path_label = path_label
	path_label.text = _level_path
	path_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	path_label.modulate = Color(0.72, 0.76, 0.85)
	_dock.add_child(path_label)

	var separator := HSeparator.new()
	_dock.add_child(separator)

	var layer_row := HBoxContainer.new()
	var layer_label := Label.new()
	layer_label.text = "Layer"
	layer_row.add_child(layer_label)
	_layer_selector = OptionButton.new()
	_layer_selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for layer_name: String in SYNC_LAYERS:
		_layer_selector.add_item(layer_name)
	_layer_selector.select(DEFAULT_LAYER_INDEX)
	_layer_selector.tooltip_text = "Choose which TileMapLayer and matching JSON layers entry to synchronize."
	_layer_selector.item_selected.connect(_on_layer_selected)
	layer_row.add_child(_layer_selector)
	_dock.add_child(layer_row)

	var pull_button := Button.new()
	_pull_button = pull_button
	pull_button.text = "Pull JSON -> selected layer"
	pull_button.tooltip_text = "Validate every source/atlas tile, then replace the selected layer cells."
	pull_button.pressed.connect(_pull_from_json)
	_dock.add_child(pull_button)

	var push_button := Button.new()
	_push_button = push_button
	push_button.text = "Push selected layer -> JSON"
	push_button.tooltip_text = "Update only the selected layer; preserve entities and other level fields."
	push_button.pressed.connect(_push_to_json)
	_dock.add_child(push_button)

	_auto_sync = CheckButton.new()
	_auto_sync.text = "Auto sync (0.75 s)"
	_auto_sync.tooltip_text = "Watch both the scene cells and JSON file. Conflicts pause auto sync."
	_auto_sync.button_pressed = true
	_auto_sync.toggled.connect(_on_auto_sync_toggled)
	_dock.add_child(_auto_sync)

	var hint := Label.new()
	_hint_label = hint
	hint.text = "Choose one map layer to synchronize. Manual buttons are always available."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.modulate = Color(0.67, 0.7, 0.78)
	_dock.add_child(hint)

	_status_label = Label.new()
	_status_label.text = "Looking for Geometry…"
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status_label.custom_minimum_size = Vector2(0.0, 72.0)
	_dock.add_child(_status_label)
	_refresh_layer_ui()


func _poll_sync() -> void:
	if _busy:
		return
	var resolved_path := _resolve_level_path()
	if resolved_path != _level_path:
		_level_path = resolved_path
		_refresh_path_label()
		_reset_tracking()
		return
	if _level_path.is_empty():
		return
	if OS.get_name() == "Windows" and not FileAccess.file_exists(_level_path):
		var recovery := _recover_interrupted_replacement(_level_path)
		if not bool(recovery.get("ok", false)):
			_set_status(String(recovery.get("error", "Waiting for the level write lock.")), true)
			return
	var layer_name := _selected_layer_name()
	var layer := _find_layer(layer_name)
	if layer != _tracked_layer:
		_tracked_layer = layer
		_reset_signatures()
		if layer == null:
			_set_status("Waiting: the edited scene has no TileMapLayer named %s." % layer_name, true)
		else:
			_set_status("Tracking %s layer at %s (%d cells)." % [layer_name, layer.get_path(), layer.get_used_cells().size()])
		return
	if layer == null:
		return

	var file_signature := _file_signature(_level_path)
	var node_signature := _layer_signature(layer)
	var file_changed := file_signature != _last_file_signature
	var node_changed := node_signature != _last_node_signature
	if not _auto_sync.button_pressed:
		return
	if file_changed and node_changed:
		_auto_sync.set_pressed_no_signal(false)
		_set_status("Conflict: both JSON and %s changed. Auto sync paused; choose Pull or Push." % layer_name, true)
		return
	if file_changed:
		_pull_from_json(true)
	elif node_changed:
		_push_to_json(true)


func _pull_from_json(automatic := false) -> void:
	if _busy:
		return
	var layer_name := _selected_layer_name()
	var layer := _find_layer(layer_name)
	if layer == null:
		_set_status("Pull failed: no TileMapLayer named %s in the edited scene." % layer_name, true)
		return
	var starting_node_signature := _layer_signature(layer)
	if automatic and starting_node_signature != _last_node_signature:
		_pause_for_conflict("Pull blocked: %s changed while the JSON update was being processed." % layer_name)
		return
	var read := _read_json_file(_level_path)
	if not bool(read.get("ok", false)):
		_set_status("Pull failed: %s" % read.get("error", "cannot read JSON"), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var level: Dictionary = read.get("data", {})
	var schema_validation := LEVEL_SCHEMA.validate_level(level)
	if not bool(schema_validation.get("ok", false)):
		_set_status("Pull blocked safely: %s" % schema_validation.get("error", "invalid level schema"), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var layers: Dictionary = level["layers"]
	var cells: Array = layers[layer_name]
	var validation := _validate_layer_tiles(layer, cells)
	if not bool(validation.get("ok", false)):
		_set_status("Pull blocked safely: %s" % validation.get("error", "invalid tile data"), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var pulled_signature: String = read.get("signature", "")
	if _file_signature(_level_path) != pulled_signature:
		_pause_for_conflict("Pull blocked: JSON changed again during validation; no %s cells were replaced." % layer_name)
		return
	if _layer_signature(layer) != starting_node_signature:
		_pause_for_conflict("Pull blocked: %s changed during validation; no local cells were replaced." % layer_name)
		return

	_busy = true
	layer.clear()
	for raw_cell: Variant in cells:
		_apply_cell(layer, raw_cell)
	if layer.has_method("update_internals"):
		layer.update_internals()
	if get_editor_interface().has_method("mark_scene_as_unsaved"):
		get_editor_interface().call("mark_scene_as_unsaved")
	_busy = false
	_tracked_layer = layer
	_last_file_signature = pulled_signature
	_last_node_signature = _layer_signature(layer)
	if _file_signature(_level_path) != pulled_signature:
		_pause_for_conflict("JSON changed while %s was being applied. Pull again to accept the latest file." % layer_name)
		return
	_set_status("Pulled %d %s cells from JSON%s." % [cells.size(), layer_name, " automatically" if automatic else ""])


func _push_to_json(automatic := false) -> void:
	if _busy:
		return
	var layer_name := _selected_layer_name()
	var layer := _find_layer(layer_name)
	if layer == null:
		_set_status("Push failed: no TileMapLayer named %s in the edited scene." % layer_name, true)
		return
	var starting_node_signature := _layer_signature(layer)
	if automatic and _file_signature(_level_path) != _last_file_signature:
		_pause_for_conflict("Push blocked: JSON changed since the last synchronized revision.")
		return
	var read := _read_json_file(_level_path)
	if not bool(read.get("ok", false)):
		_set_status("Push blocked: a valid existing schema-v2 JSON file is required. %s" % read.get("error", ""), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var level: Dictionary = read.get("data", {})
	var current_validation := LEVEL_SCHEMA.validate_level(level)
	if not bool(current_validation.get("ok", false)):
		_set_status("Push blocked: existing JSON failed schema validation. %s" % current_validation.get("error", ""), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var layers: Dictionary = level["layers"].duplicate(true)
	var cells := _serialize_layer(layer)
	layers[layer_name] = cells
	level["layers"] = layers
	var next_validation := LEVEL_SCHEMA.validate_level(level)
	if not bool(next_validation.get("ok", false)):
		_set_status("Push blocked safely: %s" % next_validation.get("error", "invalid level schema"), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	var tile_validation := _validate_layer_tiles(layer, cells)
	if not bool(tile_validation.get("ok", false)):
		_set_status("Push blocked safely: %s" % tile_validation.get("error", "invalid tile data"), true)
		if automatic:
			_auto_sync.set_pressed_no_signal(false)
		return
	if _layer_signature(layer) != starting_node_signature:
		_pause_for_conflict("Push blocked: %s changed during serialization; retry with the latest cells." % layer_name)
		return
	var write := _write_json_file(_level_path, level, String(read.get("signature", "")))
	if not bool(write.get("ok", false)):
		_set_status("Push blocked: %s" % write.get("error", "verified replacement failed"), true)
		if automatic or bool(write.get("conflict", false)):
			_auto_sync.set_pressed_no_signal(false)
		return
	_tracked_layer = layer
	_last_file_signature = String(write.get("signature", ""))
	_last_node_signature = starting_node_signature
	if _file_signature(_level_path) != _last_file_signature:
		_pause_for_conflict("JSON changed immediately after the push. Pull or Push to resolve the new revision.")
		return
	_set_status("Pushed %d %s cells to JSON%s." % [cells.size(), layer_name, " automatically" if automatic else ""])


func _find_layer(layer_name: String) -> TileMapLayer:
	var root := get_editor_interface().get_edited_scene_root()
	if root == null:
		return null
	if root is TileMapLayer and String(root.name) == layer_name:
		return root
	var found := root.find_child(layer_name, true, false)
	return found as TileMapLayer


func _serialize_layer(layer: TileMapLayer) -> Array:
	var cells: Array = []
	for coords: Vector2i in layer.get_used_cells():
		var atlas := layer.get_cell_atlas_coords(coords)
		cells.append({
			"x": coords.x,
			"y": coords.y,
			"source": layer.get_cell_source_id(coords),
			"atlas": [atlas.x, atlas.y],
			"alternative": layer.get_cell_alternative_tile(coords),
		})
	_sort_cells(cells)
	return cells


func _validate_layer_tiles(layer: TileMapLayer, cells: Array) -> Dictionary:
	if layer.tile_set == null:
		return {"ok": false, "error": "%s has no TileSet." % layer.name}
	for index: int in cells.size():
		var raw_cell: Variant = cells[index]
		if not raw_cell is Dictionary:
			return {"ok": false, "error": "Cell %d is not an object." % index}
		var cell: Dictionary = raw_cell
		var key := "%d,%d" % [int(cell.x), int(cell.y)]
		var source_id := int(cell.source)
		if not layer.tile_set.has_source(source_id):
			return {"ok": false, "error": "TileSet source %d does not exist (cell %s)." % [source_id, key]}
		var atlas_value: Array = cell.atlas
		var source := layer.tile_set.get_source(source_id)
		if source is TileSetAtlasSource:
			var atlas := Vector2i(int(atlas_value[0]), int(atlas_value[1]))
			if not source.has_tile(atlas):
				return {"ok": false, "error": "Atlas tile %s is absent from source %d." % [atlas, source_id]}
	return {"ok": true}


func _apply_cell(layer: TileMapLayer, cell: Dictionary) -> void:
	var coords := Vector2i(int(cell.get("x", 0)), int(cell.get("y", 0)))
	var source_id := int(cell.get("source", -1))
	if source_id < 0:
		layer.erase_cell(coords)
		return
	var atlas_value: Array = cell.get("atlas", [-1, -1])
	var atlas := Vector2i(int(atlas_value[0]), int(atlas_value[1]))
	layer.set_cell(coords, source_id, atlas, int(cell.get("alternative", 0)))


func _sort_cells(cells: Array) -> void:
	cells.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("y", 0)) < int(b.get("y", 0)) or (int(a.get("y", 0)) == int(b.get("y", 0)) and int(a.get("x", 0)) < int(b.get("x", 0)))
	)


func _layer_signature(layer: TileMapLayer) -> String:
	return JSON.stringify(_serialize_layer(layer)).sha256_text()


func _file_signature(path: String) -> String:
	if not FileAccess.file_exists(path):
		return "missing"
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return "unreadable:%d" % FileAccess.get_open_error()
	return file.get_as_text().sha256_text()


func _read_json_file(path: String) -> Dictionary:
	var recovery := _recover_interrupted_replacement(path)
	if not bool(recovery.get("ok", false)):
		return recovery
	if not FileAccess.file_exists(path):
		return {"ok": false, "error": "File does not exist: %s" % path}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"ok": false, "error": "Cannot open file (%s)." % error_string(FileAccess.get_open_error())}
	var contents := file.get_as_text()
	file.close()
	var parser := JSON.new()
	var error := parser.parse(contents)
	if error != OK:
		return {"ok": false, "error": "line %d: %s" % [parser.get_error_line(), parser.get_error_message()]}
	if not parser.data is Dictionary:
		return {"ok": false, "error": "Top-level JSON must be an object."}
	return {"ok": true, "data": parser.data, "signature": contents.sha256_text()}


func _write_json_file(path: String, data: Dictionary, expected_signature: String) -> Dictionary:
	var directory_error := DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	if directory_error != OK and directory_error != ERR_ALREADY_EXISTS:
		return {"ok": false, "error": error_string(directory_error)}
	var lock_path := ProjectSettings.globalize_path(path) + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return {
			"ok": false,
			"conflict": true,
			"error": "Another editor/MCP writer currently owns the JSON write lock.",
		}
	var recovery := _recover_backup_locked(path)
	var result := recovery if not bool(recovery.get("ok", false)) else _write_json_file_locked(path, data, expected_signature)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release JSON write lock %s: %s" % [lock_path, error_string(unlock_error)])
	return result


func _write_json_file_locked(path: String, data: Dictionary, expected_signature: String) -> Dictionary:
	if _file_signature(path) != expected_signature:
		return {
			"ok": false,
			"conflict": true,
			"error": "JSON revision changed before replacement (compare-and-swap failed).",
		}
	var contents := JSON.stringify(data, "  ") + "\n"
	var replacement_signature := contents.sha256_text()
	var temporary_path := "%s.tmp.%d.%d" % [path, OS.get_process_id(), Time.get_ticks_usec()]
	var temporary_absolute := ProjectSettings.globalize_path(temporary_path)
	var target_absolute := ProjectSettings.globalize_path(path)
	var file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if file == null:
		return {"ok": false, "error": "Cannot create temporary file (%s)." % error_string(FileAccess.get_open_error())}
	file.store_string(contents)
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return {"ok": false, "error": "Temporary write failed (%s)." % error_string(write_error)}
	if _file_signature(temporary_path) != replacement_signature:
		DirAccess.remove_absolute(temporary_absolute)
		return {"ok": false, "error": "Temporary file verification failed; original JSON was preserved."}
	# Recheck immediately before promotion. The temp file guarantees complete
	# bytes; CAS and the shared lock coordinate editor/MCP writers. Windows uses
	# a recoverable backup-first sequence because replacement rename is not atomic.
	if _file_signature(path) != expected_signature:
		DirAccess.remove_absolute(temporary_absolute)
		return {
			"ok": false,
			"conflict": true,
			"error": "JSON revision changed during serialization (compare-and-swap failed).",
		}
	if OS.get_name() == "Windows":
		return _replace_file_windows(
			path,
			temporary_absolute,
			target_absolute,
			expected_signature,
			replacement_signature
		)
	var rename_error := DirAccess.rename_absolute(temporary_absolute, target_absolute)
	if rename_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return {"ok": false, "error": "Replacement rename failed (%s); original JSON was preserved." % error_string(rename_error)}
	if _file_signature(path) != replacement_signature:
		return {
			"ok": false,
			"conflict": true,
			"error": "JSON changed during replacement verification; synchronization is paused.",
		}
	return {"ok": true, "signature": replacement_signature}


func _replace_file_windows(
	path: String,
	temporary_absolute: String,
	target_absolute: String,
	expected_signature: String,
	replacement_signature: String
) -> Dictionary:
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	# A target plus backup means the prior promotion completed and only backup
	# cleanup was interrupted. CAS already proved the target is the revision the
	# caller read, so this stale rollback copy is no longer authoritative.
	if FileAccess.file_exists(backup_absolute):
		var stale_remove_error := DirAccess.remove_absolute(backup_absolute)
		if stale_remove_error != OK:
			DirAccess.remove_absolute(temporary_absolute)
			return {"ok": false, "error": "Cannot clear stale recovery backup (%s)." % error_string(stale_remove_error)}

	var backup_error := DirAccess.rename_absolute(target_absolute, backup_absolute)
	if backup_error != OK:
		DirAccess.remove_absolute(temporary_absolute)
		return {"ok": false, "error": "Cannot create recovery backup (%s); original JSON was preserved." % error_string(backup_error)}
	if _file_signature(backup_absolute) != expected_signature:
		var stale_restore_error := _restore_windows_backup(backup_absolute, target_absolute, false)
		DirAccess.remove_absolute(temporary_absolute)
		return {
			"ok": false,
			"conflict": true,
			"error": "Backup hash changed before promotion; rollback %s." % ("succeeded" if stale_restore_error == OK else "failed (%s), recover from %s" % [error_string(stale_restore_error), backup_absolute]),
		}

	var promote_error := DirAccess.rename_absolute(temporary_absolute, target_absolute)
	if promote_error != OK:
		var promote_restore_error := _restore_windows_backup(backup_absolute, target_absolute, true)
		DirAccess.remove_absolute(temporary_absolute)
		return {
			"ok": false,
			"error": "Replacement promotion failed (%s); rollback %s." % [error_string(promote_error), "succeeded" if promote_restore_error == OK else "failed (%s), recover from %s" % [error_string(promote_restore_error), backup_absolute]],
		}

	if _file_signature(path) != replacement_signature:
		var corrupt_restore_error := _restore_windows_backup(backup_absolute, target_absolute, true)
		return {
			"ok": false,
			"conflict": true,
			"error": "Promoted JSON failed hash verification; rollback %s." % ("succeeded" if corrupt_restore_error == OK else "failed (%s), recover from %s" % [error_string(corrupt_restore_error), backup_absolute]),
		}

	var cleanup_error := DirAccess.remove_absolute(backup_absolute)
	if cleanup_error != OK:
		push_warning("Replacement succeeded but recovery backup cleanup failed at %s: %s" % [backup_absolute, error_string(cleanup_error)])
	return {"ok": true, "signature": replacement_signature}


func _restore_windows_backup(backup_absolute: String, target_absolute: String, remove_target: bool) -> Error:
	if FileAccess.file_exists(target_absolute):
		if not remove_target:
			return ERR_ALREADY_EXISTS
		var remove_error := DirAccess.remove_absolute(target_absolute)
		if remove_error != OK:
			return remove_error
	return DirAccess.rename_absolute(backup_absolute, target_absolute)


func _recover_interrupted_replacement(path: String) -> Dictionary:
	if OS.get_name() != "Windows":
		return {"ok": true, "recovered": false}
	var target_absolute := ProjectSettings.globalize_path(path)
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	if FileAccess.file_exists(target_absolute) or not FileAccess.file_exists(backup_absolute):
		return {"ok": true, "recovered": false}
	var lock_path := target_absolute + WRITE_LOCK_SUFFIX
	var lock_error := DirAccess.make_dir_absolute(lock_path)
	if lock_error != OK:
		return {
			"ok": false,
			"conflict": true,
			"error": "Level JSON is between replacement steps and its write lock is still active.",
		}
	var recovery := _recover_backup_locked(path)
	var unlock_error := DirAccess.remove_absolute(lock_path)
	if unlock_error != OK:
		push_warning("Cannot release recovery write lock %s: %s" % [lock_path, error_string(unlock_error)])
	return recovery


func _recover_backup_locked(path: String) -> Dictionary:
	if OS.get_name() != "Windows":
		return {"ok": true, "recovered": false}
	var target_absolute := ProjectSettings.globalize_path(path)
	var backup_absolute := target_absolute + RECOVERY_BACKUP_SUFFIX
	if FileAccess.file_exists(target_absolute) or not FileAccess.file_exists(backup_absolute):
		return {"ok": true, "recovered": false}
	var restore_error := DirAccess.rename_absolute(backup_absolute, target_absolute)
	if restore_error != OK:
		return {
			"ok": false,
			"error": "Interrupted replacement recovery failed (%s); backup remains at %s." % [error_string(restore_error), backup_absolute],
		}
	if not FileAccess.file_exists(target_absolute):
		return {"ok": false, "error": "Recovery rename reported success but the level JSON is still missing."}
	return {"ok": true, "recovered": true, "signature": _file_signature(path)}


func _reset_tracking() -> void:
	_level_path = _resolve_level_path()
	_refresh_path_label()
	if _level_path.is_empty():
		_tracked_layer = null
		_reset_signatures()
		_set_status("Waiting: open exactly one scene tagged live_level.")
		return
	var layer_name := _selected_layer_name()
	_tracked_layer = _find_layer(layer_name)
	_reset_signatures()
	if _tracked_layer == null:
		_set_status("Waiting: open a scene containing a TileMapLayer named %s." % layer_name)
	else:
		_set_status("Tracking %s layer at %s (%d cells)." % [layer_name, _tracked_layer.get_path(), _tracked_layer.get_used_cells().size()])


func _reset_signatures() -> void:
	_last_file_signature = _file_signature(_level_path)
	_last_node_signature = _layer_signature(_tracked_layer) if _tracked_layer != null else ""


func _resolve_level_path() -> String:
	var root := get_editor_interface().get_edited_scene_root()
	if root == null:
		return ""
	var candidates: Array[Node] = []
	_collect_level_data_owners(root, candidates)
	if candidates.size() != 1:
		return ""
	var owner := candidates[0]
	var value := String(owner.get(&"level_data_path")).strip_edges()
	return value


func _collect_level_data_owners(node: Node, result: Array[Node]) -> void:
	if node.is_in_group(&"live_level") and _has_property(node, &"level_data_path"):
		result.append(node)
	for child: Node in node.get_children():
		_collect_level_data_owners(child, result)


func _has_property(object: Object, property_name: StringName) -> bool:
	for property: Dictionary in object.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return true
	return false


func _refresh_path_label() -> void:
	if _path_label == null:
		return
	_path_label.text = _level_path if not _level_path.is_empty() else "No active level scene"
	_path_label.tooltip_text = "JSON của scene level đang mở; dock tự đổi path theo level_data_path."
	if _pull_button != null:
		_pull_button.disabled = _level_path.is_empty()
	if _push_button != null:
		_push_button.disabled = _level_path.is_empty()
	if _auto_sync != null:
		_auto_sync.disabled = _level_path.is_empty()


func _on_scene_changed(_scene_root: Node) -> void:
	# Selection signals do not fire reliably when switching scene tabs. Reset on
	# the editor's scene_changed signal so no UI scene can accidentally retain a
	# previous map path.
	call_deferred("_reset_tracking")


func _on_selection_changed() -> void:
	# Scene changes are normally detected by polling; this makes the dock react sooner.
	var current := _find_layer(_selected_layer_name())
	if current != _tracked_layer:
		_reset_tracking()


func _selected_layer_name() -> String:
	if _layer_selector == null or _layer_selector.selected < 0:
		return String(SYNC_LAYERS[DEFAULT_LAYER_INDEX])
	return _layer_selector.get_item_text(_layer_selector.selected)


func _refresh_layer_ui() -> void:
	var layer_name := _selected_layer_name()
	if _pull_button != null:
		_pull_button.text = "Pull JSON -> %s" % layer_name
		_pull_button.tooltip_text = "Validate the full level schema and every tile, then replace only %s cells." % layer_name
	if _push_button != null:
		_push_button.text = "Push %s -> JSON" % layer_name
		_push_button.tooltip_text = "Update only layers.%s while preserving the other layers, entities, and metadata." % layer_name
	if _auto_sync != null:
		_auto_sync.text = "Auto sync %s (0.75 s)" % layer_name
	if _hint_label != null:
		_hint_label.text = "Syncing the selected TileMapLayer only. Pull and Push always validate the complete level through LevelSchema."


func _on_layer_selected(_index: int) -> void:
	_refresh_layer_ui()
	_reset_tracking()


func _on_auto_sync_toggled(enabled: bool) -> void:
	var layer_name := _selected_layer_name()
	_set_status("Auto sync enabled for %s; checking both sides against the last synchronized revision." % layer_name if enabled else "Auto sync paused for %s; unsynchronized revisions remain tracked." % layer_name)
	if enabled:
		_poll_elapsed = POLL_INTERVAL


func _pause_for_conflict(message: String) -> void:
	_auto_sync.set_pressed_no_signal(false)
	_set_status(message, true)


func _set_status(message: String, is_error := false) -> void:
	if _status_label == null:
		return
	_status_label.text = message
	_status_label.modulate = Color(1.0, 0.55, 0.5) if is_error else Color(0.58, 0.9, 0.68)
