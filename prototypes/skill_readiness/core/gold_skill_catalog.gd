class_name Gold93SkillCatalog
extends RefCounted

## Authoritative scoped inventory for ARCANA III + Venomwright readiness.
## Important: catalog presence MUST NOT be interpreted as a native cast.
## A row only becomes castable when a module with a SOURCE-LOCKED authored
## generator is registered for it (see Gold93SkillRuntime).
const MANIFEST_PATH: String = "res://docs/vfx/skill_readiness/readiness_manifest.json"
const SUPPORTED_FAMILIES = ["arcana_iii", "venomwright"]
const RUNTIME_SCRIPT: String = "res://prototypes/skill_readiness/core/gold93_runtime.gd"

var _by_key: Dictionary = {}
var _error: String = ""
## Weak on purpose: the runtime holds a strong reference back to this catalog,
## so a strong reference here would create a RefCounted cycle and leak both at
## process exit. The runtime is recreated on demand if it was collected.
var _runtime_ref: WeakRef = null


func _init() -> void:
	var raw: String = FileAccess.get_file_as_string(MANIFEST_PATH)
	if raw.is_empty():
		_error = "READINESS_MANIFEST_MISSING"
		return
	var parsed: Variant = JSON.parse_string(raw)
	if not parsed is Dictionary:
		_error = "READINESS_MANIFEST_NOT_OBJECT"
		return
	var rows: Variant = parsed.get("entries", [])
	if not rows is Array:
		_error = "READINESS_MANIFEST_ENTRIES_NOT_ARRAY"
		return
	for row in rows:
		if not row is Dictionary:
			_error = "READINESS_MANIFEST_BAD_ENTRY"
			return
		var key: String = String(row.get("key", ""))
		var family: String = String(row.get("family", ""))
		if key.is_empty() or _by_key.has(key) or not SUPPORTED_FAMILIES.has(family):
			_error = "READINESS_MANIFEST_INVALID_OR_DUPLICATE_ID"
			return
		_by_key[key] = row.duplicate(true)
	if _by_key.size() != 93:
		_error = "READINESS_MANIFEST_EXPECTED_93_GOT_" + str(_by_key.size())


## --- basic accessors ---------------------------------------------------------

func is_valid() -> bool:
	return _error.is_empty()


func error_message() -> String:
	return _error


func ids() -> PackedStringArray:
	var result := PackedStringArray()
	for key in _by_key:
		result.append(String(key))
	result.sort()
	return result


func has_skill(key: String) -> bool:
	return _by_key.has(key)


func skill(key: String) -> Dictionary:
	if not _by_key.has(key):
		return {}
	var out: Dictionary = _by_key[key]
	return out.duplicate(true)


func family_count(family: String) -> int:
	var count: int = 0
	for row in _by_key.values():
		if String(row.get("family", "")) == family:
			count += 1
	return count


func count_ready() -> int:
	var count: int = 0
	for row in _by_key.values():
		if bool(row.get("native_port_ready", false)):
			count += 1
	return count


func can_cast_in_lab(key: String) -> bool:
	# Do not synthesize any Gold skill when only its registry row exists.
	return _by_key.has(key) and bool((_by_key[key] as Dictionary).get("native_port_ready", false))


func can_cast_in_production(key: String) -> bool:
	if not can_cast_in_lab(key):
		return false
	var entry: Dictionary = _by_key[key]
	return bool(entry.get("gameplay_configured", false)) and bool(entry.get("production_integrated", false))


## --- runtime-aware accessors ---------------------------------------------------

func runtime():
	if _runtime_ref != null:
		var existing = _runtime_ref.get_ref()
		if existing != null:
			return existing
	var script: GDScript = load(RUNTIME_SCRIPT) as GDScript
	if script == null:
		return null
	var created = script.new(self)
	_runtime_ref = weakref(created)
	return created


## Path of the native module for this id, or "" when no source-locked module
## has been ported yet.
func runtime_module_path(key: String) -> String:
	var r = runtime()
	if r == null:
		return ""
	return r.module_path_for(key)


## True only when a real native cast can execute for this id right now.
func is_source_locked(key: String) -> bool:
	var r = runtime()
	if r == null or not has_skill(key):
		return false
	return r.can_cast(key)


## Precise, human-readable blocker for ids that are not yet native.
func blocker(key: String) -> String:
	var r = runtime()
	if r == null:
		return "RUNTIME_UNAVAILABLE"
	if not has_skill(key):
		return "UNKNOWN_CANONICAL_ID"
	return r.blocker_for(key)


## Original registry component requirements for a skill (dependency graph).
func dependency_graph(key: String) -> PackedStringArray:
	var entry: Dictionary = skill(key)
	if entry.is_empty():
		return PackedStringArray()
	var module = _instantiate(key)
	if module != null and module is Gold93SkillModule:
		var req: PackedStringArray = (module as Gold93SkillModule).required_components()
		if not req.is_empty():
			return req
	var deps: Variant = entry.get("source_dependencies", [])
	if deps is Array:
		return PackedStringArray(deps)
	return PackedStringArray()


func _instantiate(key: String):
	var r = runtime()
	if r == null:
		return null
	return r.module_for(key)


## Control envelope the future user configuration may bind to. This describes
## CAPABILITY only; no binding, timing or cost is decided here.
func supported_controls(key: String) -> Dictionary:
	var entry: Dictionary = skill(key)
	if entry.is_empty():
		return {}
	var module = _instantiate(key)
	if module != null and module is Gold93SkillModule:
		var m := module as Gold93SkillModule
		return {
			"target_semantics": m.target_semantics(),
			"supports_retarget": m.supports_retarget(),
			"supports_drag_path": m.supports_drag_path(),
			"tap": true,
			"hold": true,
			"drag_release": m.supports_drag_path(),
			"target_pick": m.target_semantics() in ["target", "multi", "mixed"],
			"free_360_aim": true,
			"trajectory_path": m.supports_drag_path(),
			"multi_stage": true,
			"gamepad": true,
		}
	# Capability inferred from the registry target class only. Values are
	# capability flags, never gameplay numbers.
	var target_class := String(entry.get("source_target_class", ""))
	return {
		"target_semantics": target_class,
		"supports_retarget": target_class in ["target", "multi", "mixed"],
		"supports_drag_path": target_class in ["drag", "path", "mixed", "ground", "cone"],
		"tap": true,
		"hold": true,
		"drag_release": target_class in ["drag", "path", "mixed", "ground", "cone"],
		"target_pick": target_class in ["target", "multi", "mixed"],
		"free_360_aim": true,
		"trajectory_path": target_class in ["drag", "path", "mixed"],
		"multi_stage": true,
		"gamepad": true,
	}


func maturity(key: String) -> String:
	if not has_skill(key):
		return "UNKNOWN"
	if is_source_locked(key):
		return "NATIVE_SOURCE_LOCKED"
	return "CATALOGUED_SOURCE_MATERIAL_BLOCKED"


## Machine-readable roll-up for CI and handoff documents.
func coverage_report() -> Dictionary:
	var rows: Array = []
	var counts: Dictionary = {
		"NATIVE_SOURCE_LOCKED": 0,
		"CATALOGUED_SOURCE_MATERIAL_BLOCKED": 0,
	}
	for key in ids():
		var level := maturity(key)
		counts[level] = int(counts.get(level, 0)) + 1
		rows.append({
			"key": key,
			"family": String(skill(key).get("family", "")),
			"maturity": level,
			"module_path": runtime_module_path(key),
			"blocker": blocker(key) if level != "NATIVE_SOURCE_LOCKED" else "",
			"controls": supported_controls(key),
			"dependencies": Array(dependency_graph(key)),
		})
	return {"counts": counts, "rows": rows}
