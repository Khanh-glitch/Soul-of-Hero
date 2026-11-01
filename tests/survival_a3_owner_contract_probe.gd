extends SceneTree
## Run against an isolated A3 project checkout, not the A0 production tree.
## A0_V3_BINDINGS points at the exact previously shipped A0 V3 binding JSON.
## No saves, fixture grants, scene mounts, or A3 source edits are performed.
const WorldSources = preload("res://game/survival/economy/world_source_adapter.gd")
const V5_PATH := "res://data/survival/items/world_source_bindings.v3.json"
var checks := 0
var failures := 0

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _initialize() -> void:
	var old_path := OS.get_environment("A0_V3_BINDINGS")
	var old_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(old_path))
	var new_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(V5_PATH))
	_expect(old_value is Dictionary and new_value is Dictionary, "load exact old and new authored binding documents")
	if not old_value is Dictionary or not new_value is Dictionary:
		quit(1)
		return
	var old: Dictionary = old_value
	var current: Dictionary = new_value
	var cache := {}
	for raw: Variant in current.get("bindings", []):
		if raw is Dictionary and String(raw.get("instance_id", "")) == "si:r_ashen_crown:waystation_cache:01":
			cache = raw
			break
	_expect(not cache.is_empty(), "canonical physical cache binding exists")
	if cache.is_empty():
		quit(1)
		return
	var stands: Array = cache.get("stand_cells", [])
	print("A3_OWNER_PROBE authored_cache_stands=", stands)
	_expect(WorldSources.cell_matches(Vector2i(406, 202), stands), "actual integer hero on canonical JSON stand is accepted")
	_expect(not WorldSources.cell_matches([406.5, 202], stands), "fractional spoofed hero coordinate is rejected")
	# Observational only: a future valid migration may run before validation.
	# Do not require raw legacy state to be valid without that migration.
	var legacy_state: Dictionary = WorldSources.empty_state(old)
	print("A3_OWNER_PROBE legacy_raw_v5_state_error=", WorldSources.state_error(legacy_state, current))
	print("A3 OWNER CONTRACT PROBE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
