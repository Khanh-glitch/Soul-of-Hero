class_name NativePoiPhaseContext
extends RefCounted

## Validates owner-supplied A0 run phase context. It has no clock, save access,
## phase advancement, or ability to authorize an economy transaction.

const CONTRACT_PATH := "res://data/survival/world_content/site_phase_transformations.v1.json"
const PROJECTION_CONTRACT_ID := "soh.a0.run_phase_projection.v1"

var _schedule: Array = []
var _poi_id := ""
var _world_id := ""
var _projection: Dictionary = {}
var _initialized := false


func configure(site_definition: Dictionary) -> bool:
	var file := FileAccess.open(CONTRACT_PATH, FileAccess.READ)
	if file == null:
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if (
		not parsed is Dictionary
		or str(parsed.get("schema", "")) != "soh.a8.site_phase_transformations.v1"
	):
		return false
	var projection_contract: Dictionary = parsed.get("phase_projection_contract", {})
	if str(projection_contract.get("contract_id", "")) != PROJECTION_CONTRACT_ID:
		return false
	_schedule = parsed.get("phase_schedule", [])
	var source: Dictionary = site_definition.get("source", {})
	_poi_id = str(source.get("poi_id", ""))
	_world_id = str(source.get("world_id", ""))
	return not _poi_id.is_empty() and not _world_id.is_empty() and not _schedule.is_empty()


# gdlint: disable=max-returns
func apply_projection(candidate: Dictionary) -> bool:
	if _poi_id.is_empty() or _world_id.is_empty():
		return false
	if str(candidate.get("contract_id", "")) != PROJECTION_CONTRACT_ID:
		return false
	if str(candidate.get("projection_authority", "")) != "A0.RunLifecycle":
		return false
	if str(candidate.get("world_id", "")) != _world_id:
		return false
	if str(candidate.get("poi_id", "")) != _poi_id:
		return false
	if str(candidate.get("site_instance_id", "")).strip_edges().is_empty():
		return false
	if str(candidate.get("run_id", "")).strip_edges().is_empty():
		return false
	var run_epoch: Variant = candidate.get("run_epoch", null)
	var projection_revision: Variant = candidate.get("projection_revision", null)
	var elapsed_hours: Variant = candidate.get("elapsed_real_hours", null)
	if typeof(run_epoch) != TYPE_INT or int(run_epoch) < 0:
		return false
	if typeof(projection_revision) != TYPE_INT or int(projection_revision) < 0:
		return false
	if (
		(typeof(elapsed_hours) != TYPE_INT and typeof(elapsed_hours) != TYPE_FLOAT)
		or not is_finite(float(elapsed_hours))
		or float(elapsed_hours) < 0.0
	):
		return false
	var phase_id := str(candidate.get("phase_id", ""))
	if phase_id != phase_id_for_elapsed_hours(float(elapsed_hours)):
		return false
	var active_effects: Variant = candidate.get("active_effect_ids", null)
	var environment: Variant = candidate.get("environment", null)
	if not active_effects is Array or not environment is Dictionary:
		return false
	var seen_effects: Dictionary = {}
	for effect_value: Variant in active_effects:
		if typeof(effect_value) != TYPE_STRING or str(effect_value).strip_edges().is_empty():
			return false
		if seen_effects.has(str(effect_value)):
			return false
		seen_effects[str(effect_value)] = true
	var phase_entry := _phase_entry(phase_id)
	if phase_entry.is_empty():
		return false
	var global_effect_value: Variant = phase_entry.get("phase_effect_id", "")
	var global_effect_id := (
		str(global_effect_value) if typeof(global_effect_value) == TYPE_STRING else ""
	)
	if not global_effect_id.is_empty() and not seen_effects.has(global_effect_id):
		return false

	if _initialized:
		var current_run_id := str(_projection.get("run_id", ""))
		var current_epoch := int(_projection.get("run_epoch", -1))
		var current_revision := int(_projection.get("projection_revision", -1))
		var current_instance := str(_projection.get("site_instance_id", ""))
		var new_run := str(candidate.run_id) != current_run_id
		if new_run:
			if int(run_epoch) <= current_epoch or phase_id != "ordinary":
				return false
			if float(elapsed_hours) >= 264.0:
				return false
		elif int(run_epoch) != current_epoch or str(candidate.site_instance_id) != current_instance:
			return false
		if not new_run and int(projection_revision) < current_revision:
			return false
		if not new_run and int(projection_revision) == current_revision:
			return _projection == candidate
	_projection = candidate.duplicate(true)
	_initialized = true
	return true


func is_initialized() -> bool:
	return _initialized


func get_projection() -> Dictionary:
	return _projection.duplicate(true)


func get_phase_id() -> String:
	return str(_projection.get("phase_id", "")) if _initialized else ""


func get_run_context() -> Dictionary:
	if not _initialized:
		return {}
	return {
		"world_id": str(_projection.get("world_id", "")),
		"run_id": str(_projection.get("run_id", "")),
		"run_epoch": int(_projection.get("run_epoch", -1)),
		"phase_id": str(_projection.get("phase_id", "")),
		"observed_phase_projection_revision": int(_projection.get("projection_revision", -1)),
		"site_instance_id": str(_projection.get("site_instance_id", ""))
	}


func has_effect(effect_id: String) -> bool:
	return _initialized and _projection.get("active_effect_ids", []).has(effect_id)


func permits_mutating_intents() -> bool:
	if not _initialized:
		return false
	var phase: Dictionary = _phase_entry(get_phase_id())
	return bool(phase.get("mutating_a8_intents_allowed", false))


func phase_id_for_elapsed_hours(elapsed_hours: float) -> String:
	if not is_finite(elapsed_hours) or elapsed_hours < 0.0:
		return ""
	for entry_value: Variant in _schedule:
		if not entry_value is Dictionary:
			continue
		var minimum := float(entry_value.get("minimum_elapsed_real_hours_inclusive", INF))
		var maximum := float(entry_value.get("maximum_elapsed_real_hours_exclusive", -INF))
		if elapsed_hours >= minimum and elapsed_hours < maximum:
			return str(entry_value.get("phase_id", ""))
	return ""


func _phase_entry(phase_id: String) -> Dictionary:
	for entry_value: Variant in _schedule:
		if entry_value is Dictionary and str(entry_value.get("phase_id", "")) == phase_id:
			return entry_value
	return {}
