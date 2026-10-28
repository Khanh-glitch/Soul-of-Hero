class_name Gold93ParityRegistry
extends RefCounted

## Evidence-backed source-parity status, loaded from disk.
##
## Readiness used to treat "a module exists and `can_cast()` returns true" as
## `native_port_ready`. Those are different claims and must never be conflated:
##
##   native_executable        - a real native module loads and a full cast runs
##                              inside Godot. Says nothing about correctness.
##   source_parity_verified   - the native cast was diffed against the ORIGINAL
##                              engine (per-tick scene/glow raster hashes, hits
##                              and cues) and matched. Backed by an evidence file
##                              that records compared ticks and the first
##                              divergent tick when it fails.
##   gold_visual_approved     - the rendered result was visually reviewed and
##                              accepted against GOLD. A human/owner gate.
##
## `native_port_ready` is the strict conjunction of all three. It is reported
## for historical compatibility, but it is now an earned status rather than a
## restatement of "a module was registered".

const EVIDENCE_DIR := "res://docs/vfx/skill_readiness/parity"
const EVIDENCE_INDEX := EVIDENCE_DIR + "/index.json"

## Statuses a differential run may record.
const PASS := "PASS"
const FAIL := "FAIL"
const PENDING := "PENDING"


static func _load_index() -> Dictionary:
	if not FileAccess.file_exists(EVIDENCE_INDEX):
		return {}
	var f := FileAccess.open(EVIDENCE_INDEX, FileAccess.READ)
	if f == null:
		return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	return parsed if parsed is Dictionary else {}


static func status_for(canonical_id: String) -> String:
	var idx := _load_index()
	var row = idx.get("skills", {}).get(canonical_id, {})
	if row is Dictionary and row.has("status"):
		return String(row["status"])
	return PENDING


static func evidence_for(canonical_id: String) -> Dictionary:
	var idx := _load_index()
	var row = idx.get("skills", {}).get(canonical_id, {})
	return row if row is Dictionary else {}


static func is_source_parity_verified(canonical_id: String) -> bool:
	# Only a recorded PASS counts. PENDING (never diffed) and FAIL (diffed and
	# diverged) both read as unverified.
	return status_for(canonical_id) == PASS


## Written by the differential runner after a real comparison. `first_divergent_tick`
## is -1 when every compared tick matched.
static func record(canonical_id: String, status: String, detail: Dictionary) -> void:
	var idx := _load_index()
	if not idx.has("skills"):
		idx["skills"] = {}
	var row: Dictionary = {
		"status": status,
		"recorded_utc": Time.get_datetime_string_from_system(true),
	}
	for k in detail:
		row[k] = detail[k]
	idx["skills"][canonical_id] = row
	idx["schema"] = "gold93/parity-evidence/v1"
	idx["note"] = (
		"source_parity_verified requires a PASS here: the native cast was "
		+ "diffed tick-by-tick against the ORIGINAL engine and matched."
	)
	_write_index(idx)


static func _write_index(idx: Dictionary) -> void:
	var abs_path := ProjectSettings.globalize_path(EVIDENCE_INDEX)
	DirAccess.make_dir_recursive_absolute(abs_path.get_base_dir())
	var f := FileAccess.open(abs_path, FileAccess.WRITE)
	if f == null:
		push_error("Gold93ParityRegistry: cannot write " + abs_path)
		return
	f.store_string(JSON.stringify(idx, "\t"))
	f.close()
