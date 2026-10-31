extends SceneTree
## A7 R14 certification probe — runtime markers for `tools/survival/balance/a7_certify.py`.
##
## A7-owned verification code. It never mutates an owner file, never grants an item,
## never teleports an actor and never writes a save. It reads the composed tree the
## way the game reads it and prints one machine-readable line per certified question:
##
##     A7C <case_id> {"...": ...}
##
## Anything it cannot prove it reports as `ok=false` with a reason; the harness turns
## that into FAIL or BLOCKED rather than a silent pass.
##
## Run (CI, Godot 4.7, headless):
##     godot --headless --path <composition> --script res://tests/survival/a7_certification_probe.gd
##
## Exit code is always 0 when the probe itself ran: the harness, not the probe, decides
## the verdict, so a product failure cannot be mistaken for a broken test runner.

const READER_PATH := "res://game/survival/world/a1_authored_world_reader.gd"
const BOOTSTRAP_PATH := "res://game/autoload/input_bootstrap.gd"
const CONTROLLER_PATH := "res://game/overworld/chapter1_overworld.gd"
const AUTHORITY_PATH := "res://game/survival/a0_world_authority.gd"
## A script this probe knows compiles in this tree. It proves the load check itself
## works, so "nothing loaded" is never confused with "the loader is broken".
const KNOWN_GOOD_PATH := "res://game/survival/world/a1_authored_world_reader.gd"
const LEGACY_WORLD := "res://data/overworld/hollow_marches.json"
const A8_PACKAGE := "res://data/survival/world_content/a8_a0_mount_transition_package.v2.json"
const COMPAT_PATH := "res://game/survival/world/a1_runtime_compatibility.gd"

var _reader: Variant = null
var _native: Dictionary = {}
## The world the *game* activates, resolved once from the production controller.
## The legacy document is only live when the controller does not mount an authority.
var _live_frame := Vector2i.ZERO
var _live_source := "UNRESOLVED"


func _initialize() -> void:
	# A direct `--script` SceneTree enters before root is active; defer so autoloads
	# and the root window exist. This ordering is the whole point of case T1.5.
	call_deferred("_run")


func _run() -> void:
	print("A7C_ENGINE {\"version\": \"%s\"}" % str(Engine.get_version_info().get("string", "")))
	_case_t1_5_bootstrap()
	_case_native_load()
	_case_authority()
	_case_t1_1_world()
	_case_t1_3_spawn()
	_case_t1_4_sites()
	_case_t2_1_sites()
	_case_t2_6_gates()
	_case_t3_9_receipt_absent()
	_finish()


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
func _emit(case_id: String, payload: Dictionary) -> void:
	print("A7C %s %s" % [case_id, JSON.stringify(payload)])


func _load_reader() -> Variant:
	if _reader == null:
		var script: Variant = load(READER_PATH)
		if script is Script:
			_reader = (script as Script).new()
	return _reader


func _legacy_bounds() -> Vector2i:
	var file := FileAccess.open(LEGACY_WORLD, FileAccess.READ)
	if file == null:
		return Vector2i.ZERO
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not (parsed is Dictionary):
		return Vector2i.ZERO
	var bounds: Variant = (parsed as Dictionary).get("world_bounds", {})
	if not (bounds is Dictionary):
		return Vector2i.ZERO
	return Vector2i(int((bounds as Dictionary).get("w", 0)), int((bounds as Dictionary).get("h", 0)))


# --------------------------------------------------------------------------- #
# NATIVE_LOAD — does the tree actually compile, or only read well?
#
# Round 14's second answer scanned `chapter1_overworld.gd` as text and reported
# "authored 1024x768" on a tree where Godot printed
#   SCRIPT ERROR: Function "_spawn_cell()" not found in base self.
#   SCRIPT ERROR: Failed to compile depended scripts.
# and could not load the controller at all. Text is not a program. Every claim of
# an active world must survive `load()` and `new()` in this engine build.
# --------------------------------------------------------------------------- #
func _case_native_load() -> void:
	var known_good: Variant = load(KNOWN_GOOD_PATH)
	var controller_script: Variant = load(CONTROLLER_PATH)
	var authority_script: Variant = load(AUTHORITY_PATH)
	var controller_inst := false
	var authority_inst := false
	var controller_error := ""
	var mode := ""
	if controller_script is Script:
		var node: Variant = (controller_script as Script).new()
		if node != null:
			controller_inst = true
			if node.has_method(&"_world_authority_mode"):
				mode = String(node.call(&"_world_authority_mode"))
			elif node.has_method(&"world_authority_report"):
				mode = String((node.call(&"world_authority_report") as Dictionary).get("mode", ""))
			(node as Node).free()
		else:
			controller_error = "NEW_RETURNED_NULL"
	else:
		controller_error = "SCRIPT_DOES_NOT_LOAD"
	if authority_script is Script:
		var authority: Variant = (authority_script as Script).new()
		if authority != null:
			authority_inst = true
			(authority as Node).free()
	_native = {
		"known_good_loads": known_good is Script,
		"controller_loads": controller_script is Script,
		"controller_instantiates": controller_inst,
		"authority_loads": authority_script is Script,
		"authority_instantiates": authority_inst,
		"controller_mode": mode,
		"controller_error": controller_error,
		"controller_sha256": FileAccess.get_file_as_string(CONTROLLER_PATH).sha256_text() \
			if FileAccess.file_exists(CONTROLLER_PATH) else "",
		"authority_sha256": FileAccess.get_file_as_string(AUTHORITY_PATH).sha256_text() \
			if FileAccess.file_exists(AUTHORITY_PATH) else "",
	}
	_emit("NATIVE_LOAD", _native)


# --------------------------------------------------------------------------- #
# AUTHORITY — which world does the production controller actually activate?
#
# Round 14 first answer treated `data/overworld/hollow_marches.json` as "the live
# world" no matter what the controller mounted. On a tree whose controller mounts
# A0's authored authority that assumption is wrong, and it produces a confident,
# false owner defect. This case measures the controller instead: what it mounts,
# what the project setting resolves to, and therefore which frame is live.
# --------------------------------------------------------------------------- #
func _case_authority() -> void:
	var file := FileAccess.open(CONTROLLER_PATH, FileAccess.READ)
	var text := ""
	if file != null:
		text = file.get_as_text()
	var mounts_authority := text.contains("A0WorldAuthority") and text.contains("WORLD_AUTHORITY")
	var mounts_sidecar := text.contains("A0AuthoredWorldMount")
	var default_authored := text.contains("get_setting(WORLD_AUTHORITY_SETTING, WORLD_AUTHORITY_AUTHORED)") \
		or text.contains("get_setting( WORLD_AUTHORITY_SETTING, WORLD_AUTHORITY_AUTHORED)")
	var setting_defined := FileAccess.file_exists("res://project.godot") \
		and FileAccess.get_file_as_string("res://project.godot").contains("survival/a0_world_authority")
	var legacy := _legacy_bounds()
	var authored := Vector2i.ZERO
	var reader: Variant = _load_reader()
	if reader != null and bool(reader.call(&"configure")):
		authored = reader.call(&"world_frame")
	var controller_runnable := bool(_native.get("controller_loads", false)) \
		and bool(_native.get("controller_instantiates", false))
	var authority_runnable := bool(_native.get("authority_loads", false)) \
		and bool(_native.get("authority_instantiates", false))
	var mode_resolved := String(_native.get("controller_mode", ""))
	var source_mount := "authored" if mounts_authority else ("sidecar" if mounts_sidecar else "none")
	var runtime_authority_verified := false
	if mounts_authority:
		# Source says "authored". Only the engine can confirm it: the controller and the
		# authority must both load and instantiate, and the controller's own resolver
		# must answer "authored". Text alone proves nothing (round 14: `_spawn_cell()`).
		runtime_authority_verified = controller_runnable and authority_runnable \
			and default_authored and mode_resolved == "authored"
		if runtime_authority_verified:
			_live_frame = authored
			_live_source = "authored_authority"
		else:
			_live_frame = Vector2i.ZERO
			_live_source = "UNRESOLVED_AUTHORITY_NOT_RUNNABLE"
	elif mounts_sidecar and controller_runnable:
		_live_frame = legacy
		_live_source = "legacy_sidecar"
	else:
		_live_frame = Vector2i.ZERO
		_live_source = "UNRESOLVED_CONTROLLER_NOT_RUNNABLE"
	_emit("AUTHORITY", {
		"controller": CONTROLLER_PATH.replace("res://", ""),
		"controller_present": text != "",
		"controller_lines": text.split("\n").size(),
		"controller_sha256": text.sha256_text(),
		"mounts_authority": mounts_authority,
		"mounts_sidecar": mounts_sidecar,
		"authority_default_authored": default_authored,
		"authority_setting_defined": setting_defined,
		"setting_value": String(ProjectSettings.get_setting("survival/a0_world_authority", "<unset>")),
		"authored_frame": [authored.x, authored.y],
		"legacy_frame": [legacy.x, legacy.y],
		"live_frame": [_live_frame.x, _live_frame.y],
		"live_source": _live_source,
		"source_mount": source_mount,
		"source_authority_present": mounts_authority,
		"runtime_authority_verified": runtime_authority_verified,
		"controller_runnable": controller_runnable,
		"authority_runnable": authority_runnable,
		"controller_mode_resolved": mode_resolved,
	})


# --------------------------------------------------------------------------- #
# T1.5 — is a reader refusal a harness artefact or the owner's contract?
# --------------------------------------------------------------------------- #
func _case_t1_5_bootstrap() -> void:
	var had_action := InputMap.has_action(&"move_left")
	var before: Variant = _load_reader()
	var before_ok := false
	var before_reason := "READER_UNAVAILABLE"
	if before != null:
		before_ok = bool(before.call(&"configure"))
		before_reason = String(before.get(&"last_error"))
	_emit("T1.5_BEFORE", {"input_action_present": had_action, "reader_ok": before_ok,
		"reason": before_reason})

	# Install the application's own bootstrap through the same path the game uses.
	if not had_action:
		var bootstrap_script: Variant = load(BOOTSTRAP_PATH)
		if bootstrap_script is Script:
			var node: Node = (bootstrap_script as Script).new()
			get_root().add_child(node)
			await process_frame
	var after: Variant = _load_reader()
	var after_ok := false
	var after_reason := "READER_UNAVAILABLE"
	if after != null:
		after_ok = bool(after.call(&"configure"))
		after_reason = String(after.get(&"last_error"))
	_emit("T1.5_AFTER", {"input_action_present": InputMap.has_action(&"move_left"),
		"reader_ok": after_ok, "reason": after_reason})


# --------------------------------------------------------------------------- #
# T1.1 — world facts, measured in the engine from the composed data
# --------------------------------------------------------------------------- #
func _case_t1_1_world() -> void:
	var live := _live_frame
	var reader: Variant = _load_reader()
	var authored := Vector2i.ZERO
	var reader_ok := false
	if reader != null:
		reader_ok = bool(reader.call(&"configure"))
		if reader_ok:
			authored = reader.call(&"world_frame")
	var live_resolved := live != Vector2i.ZERO
	_emit("T1.1", {"live": [live.x, live.y] if live_resolved else null,
		"live_resolved": live_resolved,
		"authored": [authored.x, authored.y],
		"live_source": _live_source, "reader_ok": reader_ok,
		"same_document": (reader_ok and live == authored) if live_resolved else null})


# --------------------------------------------------------------------------- #
# T1.3 — a safe spawn, and whether it is inside the world the player can walk
# --------------------------------------------------------------------------- #
func _case_t1_3_spawn() -> void:
	var reader: Variant = _load_reader()
	if reader == null or not bool(reader.call(&"configure")):
		_emit("T1.3", {"ok": false, "error": "READER_UNAVAILABLE"})
		return
	var spawn: Dictionary = reader.call(&"choose_safe_spawn", 20261031)
	if not bool(spawn.get("ok", false)):
		_emit("T1.3", {"ok": false, "error": String(spawn.get("error", "SPAWN_FAILED"))})
		return
	var cell := Vector2i(int(spawn.cell_array[0]), int(spawn.cell_array[1]))
	var live := _live_frame
	var profile: Dictionary = reader.call(&"traversal_profile", cell)
	var live_resolved := live != Vector2i.ZERO
	_emit("T1.3", {
		"ok": true, "cell": [cell.x, cell.y], "chunk_id": String(spawn.get("chunk_id", "")),
		"live_frame": [live.x, live.y] if live_resolved else null, "live_source": _live_source,
		"live_resolved": live_resolved,
		"in_live_world": (cell.x >= 0 and cell.y >= 0 and cell.x < live.x and cell.y < live.y) \
			if live_resolved else null,
		"standable": bool(profile.get("ok", false)) and bool(profile.get("walkable", false)),
		"traversal": String(profile.get("profile", profile.get("reason", ""))),
		"region": String(spawn.get("region_id", "")),
		"production_spawn_approval": bool(spawn.get("production_spawn_approval", false)),
	})


# --------------------------------------------------------------------------- #
# T1.4 / T2.1 — canonical sites: A8 cells versus the live world, and their scenes
# --------------------------------------------------------------------------- #
func _case_t1_4_sites() -> void:
	var package := _read_json(A8_PACKAGE)
	var live := _live_frame
	var rows: Array = []
	var outside := 0
	var live_resolved := live != Vector2i.ZERO
	for raw: Variant in package.get("existing_a8_sites", []):
		if not (raw is Dictionary):
			continue
		var site: Dictionary = raw
		var cell: Array = site.get("canonical_cell", [])
		if cell.size() != 2:
			continue
		var x := int(cell[0])
		var y := int(cell[1])
		var inside: Variant = null
		if live_resolved:
			inside = x >= 0 and y >= 0 and x < live.x and y < live.y
			if not bool(inside):
				outside += 1
		rows.append({"poi_id": String(site.get("poi_id", "")), "cell": [x, y],
			"inside_live_world": inside, "scene": String(site.get("scene", ""))})
	_emit("T1.4", {"live": [live.x, live.y] if live_resolved else null,
		"live_source": _live_source, "live_resolved": live_resolved, "sites": rows,
		"outside": outside if live_resolved else null})


func _case_t2_1_sites() -> void:
	var package := _read_json(A8_PACKAGE)
	var declared: Array = []
	for raw: Variant in package.get("existing_a8_sites", []):
		if raw is Dictionary:
			var path := String((raw as Dictionary).get("scene", ""))
			declared.append({"poi_id": String((raw as Dictionary).get("poi_id", "")),
				"scene": path, "exists": path != "" and ResourceLoader.exists(path)})
	_emit("T2.1", {"sites": declared,
		"package_status": String(package.get("package_status", ""))})


func _case_t2_6_gates() -> void:
	var package := _read_json(A8_PACKAGE)
	var gates: Array = package.get("production_mount_gates", [])
	_emit("T2.6", {"declared_gates": gates.size(), "refused": null,
		"note": "declaration only: no runtime threshold refusal is recorded by this probe"})


# --------------------------------------------------------------------------- #
# T3.9 — deliberately absent: this probe does not own a factory receipt
# --------------------------------------------------------------------------- #
func _case_t3_9_receipt_absent() -> void:
	# The paid two-process receipt is A0's journey harness; inventing one here would be
	# exactly the fabricated custody proof the R13 oracle pack refuses. State it plainly.
	_emit("T3.9", {"settled": false, "granted": 0, "duplicate_refused": false,
		"second_granted": null, "reason": "NOT_THIS_PROBE",
		"note": "requires A0's normal-input two-process journey; A7 never fabricates it"})


func _finish() -> void:
	_emit("SUMMARY", {"probe": "a7_certification_probe", "engine": Engine.get_version_info().get("string", ""),
		"completed": true})
	print("A7C_DONE")
	quit(0)


func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}
