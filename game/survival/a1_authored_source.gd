class_name A1AuthoredSource
extends RefCounted
## A0 Round 12 (WP2) adapter onto A1's authored continent.
##
## A1 owns the 1024x768 authored world: `data/survival/world/world_plan.v1.json`,
## its 192 64x64 chunks, the reader contract and the reader itself
## (`tests/survival/world/godot/chunk_reader.gd`, SURV-050A). A0 does not fork,
## copy or "re-implement" that reader: this adapter loads the owner's script,
## hands it A1's own root, and exposes the queried answer (per-cell layers,
## region, hazard, build permission, POI/route coordinates) to A0 production.
##
## Fail-closed by construction. Every refusal has a stable named reason so a
## missing owner artifact can never be mistaken for "the continent is empty":
##   A1_AUTHORED_READER_ABSENT         the reader script is not in this tree
##   A1_AUTHORED_READER_UNLOADABLE     the file exists but does not instantiate
##   A1_AUTHORED_SOURCE_<owner_reason> the owner's own configure() refused
##   A1_AUTHORED_FRAME_MISMATCH        the plan frame is not the authored extent
##
## Ownership: this adapter reads only. It never writes world data, never places
## structures, and never decides whether a cell may be built on (that stays A0
## SurvivalBuildSystem.validate_cell, which the owner's reader delegates to).

## A1 now ships a production-path reader (Round 12, PR20): A0 uses that interface
## first. The older SURV-050A reader that lived under tests/ is only accepted as a
## fallback when the production file is absent, so a composition that contains A1's
## production source can never silently keep reading the test-path one.
const PRODUCTION_READER_PATH := "res://game/survival/world/a1_authored_world_reader.gd"
const LEGACY_READER_PATH := "res://tests/survival/world/godot/chunk_reader.gd"
const WORLD_ROOT := "res://data/survival/world/"
const AUTHORED_FRAME := Vector2i(1024, 768)
const AUTHORED_CHUNK_SIZE := 64
const AUTHORED_TILE_PX := 16

var reader: RefCounted
var reader_path := ""
var reader_source := ""
var plan: Dictionary = {}
var frame: Vector2i = Vector2i.ZERO
var last_error := ""


## Loads the owner's reader and validates the authored frame. Returns false with
## [member last_error] set when any part of A1's source is missing or refuses.
func configure(world_root: String = WORLD_ROOT) -> bool:
	reader = null
	plan = {}
	frame = Vector2i.ZERO
	last_error = ""
	reader_path = ""
	reader_source = ""
	if FileAccess.file_exists(PRODUCTION_READER_PATH):
		reader_path = PRODUCTION_READER_PATH
		reader_source = "a1_production"
	elif FileAccess.file_exists(LEGACY_READER_PATH):
		reader_path = LEGACY_READER_PATH
		reader_source = "a1_surv050a_test"
	else:
		last_error = "A1_AUTHORED_READER_ABSENT"
		return false
	var script: Variant = load(reader_path)
	if script == null or not (script is Script):
		last_error = "A1_AUTHORED_READER_UNLOADABLE"
		return false
	var instance: Variant = (script as Script).new()
	if instance == null or not (instance is RefCounted):
		last_error = "A1_AUTHORED_READER_UNLOADABLE"
		return false
	reader = instance as RefCounted
	if not bool(reader.call(&"configure", world_root)):
		last_error = "A1_AUTHORED_SOURCE_" + String(reader.get(&"last_error")).to_upper()
		reader = null
		return false
	plan = reader.get(&"plan") as Dictionary
	var authored: Dictionary = plan.get(&"frame", {})
	frame = Vector2i(int(authored.get(&"w", 0)), int(authored.get(&"h", 0)))
	if frame != AUTHORED_FRAME:
		last_error = "A1_AUTHORED_FRAME_MISMATCH"
		reader = null
		return false
	if int(plan.get(&"chunk_size", 0)) != AUTHORED_CHUNK_SIZE:
		last_error = "A1_AUTHORED_CHUNK_SIZE_MISMATCH"
		reader = null
		return false
	return true


func is_ready() -> bool:
	return reader != null and not plan.is_empty()


## One authored cell, resolved through A1's reader with A0 as the build delegate.
## [param a0_delegate] is A0's own validate_cell callable; when it is absent the
## owner's reader answers `legacy_build_delegate_required` instead of guessing.
func cell(cell_coord: Vector2i, a0_delegate: Callable = Callable()) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": last_error if not last_error.is_empty() else "A1_AUTHORED_SOURCE_NOT_READY"}
	return reader.call(&"resolve_cell", cell_coord, [], a0_delegate, false) as Dictionary


func region_of(cell_coord: Vector2i) -> int:
	var answer := cell(cell_coord)
	if not bool(answer.get(&"ok", false)):
		return -1
	return int((answer.get(&"values", {}) as Dictionary).get(&"region", -1))


func hazard_of(cell_coord: Vector2i) -> int:
	var answer := cell(cell_coord)
	if not bool(answer.get(&"ok", false)):
		return -1
	return int((answer.get(&"values", {}) as Dictionary).get(&"hazard", -1))


func walkable(cell_coord: Vector2i) -> bool:
	var answer := cell(cell_coord)
	if not bool(answer.get(&"ok", false)):
		return false
	return int((answer.get(&"values", {}) as Dictionary).get(&"walk", 0)) == 1


func chunk_count() -> int:
	return (plan.get(&"chunk_manifest", []) as Array).size()


func authored_chunk_manifest() -> Array:
	return (plan.get(&"chunk_manifest", []) as Array).duplicate(true)


## Authored POIs the plan declares, in the canonical global cell frame
## (identity transform: canonical pixels = cell * 16). Coordinates are reported
## verbatim; deciding whether the running world can reach them is A0's job.
func poi_cells() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for raw: Variant in (plan.get(&"pois", []) as Array):
		if not raw is Dictionary:
			continue
		var poi := raw as Dictionary
		var at: Variant = poi.get(&"cell", poi.get(&"stand_cell", null))
		if not at is Array or (at as Array).size() != 2:
			continue
		out.append({
			"poi_id": String(poi.get(&"poi_id", poi.get(&"id", ""))),
			"cell": Vector2i(int((at as Array)[0]), int((at as Array)[1])),
		})
	return out


func region_ids() -> Array:
	var ids: Array = []
	for raw: Variant in (plan.get(&"regions", []) as Array):
		if raw is Dictionary:
			ids.append(int((raw as Dictionary).get(&"region_id", (raw as Dictionary).get(&"id", -1))))
		elif raw is int or raw is float:
			ids.append(int(raw))
	return ids


func in_frame(cell_coord: Vector2i) -> bool:
	return cell_coord.x >= 0 and cell_coord.y >= 0 and cell_coord.x < frame.x and cell_coord.y < frame.y


## The authored pixel rect of the whole continent, in canonical global pixels.
func world_pixels() -> Rect2:
	return Rect2(Vector2.ZERO, Vector2(frame * AUTHORED_TILE_PX))
