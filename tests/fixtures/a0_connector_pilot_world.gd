extends "res://game/overworld/chapter1_overworld.gd"
## CI-only, explicitly instantiated test subclass. Normal world never loads the
## annex, obstacles, or alternate inputs. Files are generated from pinned A1.

const PILOT_ROOT := "res://artifacts/a0-connector/"
const SLICE_ROOT := "res://artifacts/a0-connector/slices/"
const WAYSTATION_GEOMETRY = preload("res://game/survival/waystation_geometry.gd")
var mounted_obstacles := 0

func _world_source_paths() -> Dictionary:
	return {"world": PILOT_ROOT + "annex_world.v1.json", "layers": PILOT_ROOT + "annex_layers.v1.json", "props": PILOT_ROOT + "annex_props.v1.json"}

func _mount_world_extensions() -> void:
	# Reuse A0's production-capable source-pinned geometry, not a second test
	# implementation. The normal legacy scene still does not mount the annex.
	var result: Dictionary = WAYSTATION_GEOMETRY.mount(world, SLICE_ROOT)
	if not bool(result.get("ok", false)):
		push_error("A1 geometry mount rejected: " + String(result.get("reason", "unknown")))
		return
	mounted_obstacles = int(result.get("count", 0))

func _build_survival() -> void:
	super._build_survival()
	if survival_build != null:
		survival_build.annex_disabled_from_x = 384
