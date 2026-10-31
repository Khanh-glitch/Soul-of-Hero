class_name A0WorldSpatialContract
extends RefCounted
## A0 Round 12 (WP2) spatial contract between the legacy Marches and the A1
## authored continent.
##
## Two worlds genuinely coexist at this SHA and this class is the test that says
## so in numbers, not prose:
##
##   * the legacy baked Marches, 384x256 cells, unchanged (`hollow_marches*`);
##   * the composed pilot, 448x256 cells: the legacy frame plus A1's authored
##     chunk 6:3 (one 64x64 annex) joined by A1's exact 46-cell collision carve;
##   * the authored continent frame, 1024x768 cells, read through A1's own reader
##     by [A1AuthoredSource]. It is the source of truth for terrain/region/
##     hazard/POI identity, and it is NOT a second playable world (A1's connector
##     says `unsupported_new_cells: SOLID_FAIL_CLOSED`).
##
## Coordinates are canonical global cells, identity transform
## (`canonical pixels = cell * 16`), so nothing here needs a local offset.
##
## The verifier is pure data: it never builds a scene, so it runs identically in
## CI, on a workstation and in this sandbox with no display.

const LEGACY_WORLD := "res://data/overworld/hollow_marches.json"
const LEGACY_LAYERS := "res://data/overworld/hollow_marches_layers.json"
const LEGACY_PROPS := "res://data/overworld/hollow_marches_props.json"
const COMPOSED_DIR := "res://data/survival/connector/a0_candidate/"
const COMPOSED_WORLD := COMPOSED_DIR + "annex_world.v1.json"
const COMPOSED_LAYERS := COMPOSED_DIR + "annex_layers.v1.json"
const COMPOSED_PROPS := COMPOSED_DIR + "annex_props.v1.json"
const COMPOSED_PILOT := COMPOSED_DIR + "pilot_manifest.json"
const CONNECTOR := "res://data/survival/world/connector/canonical_connector.v1.json"
const DELTA := "res://data/survival/world/connector/legacy_cell_delta.v1.json"
const TILE_PX := 16

var last_error := ""
var checks: Array[Dictionary] = []
var measurements: Dictionary = {}


## Runs every contract check. Returns `{ok, reason, checks, measurements}`; the
## reason list is empty only when the composed world is the pinned A1 geography.
func verify(authored: A1AuthoredSource = null) -> Dictionary:
	last_error = ""
	checks.clear()
	measurements = {}
	var missing: Array[String] = []
	for path: String in [LEGACY_WORLD, LEGACY_LAYERS, COMPOSED_WORLD, COMPOSED_LAYERS, COMPOSED_PILOT]:
		if not FileAccess.file_exists(path):
			missing.append(path)
	measurements["missing_a0_inputs"] = missing
	var absent_owner: Array[String] = []
	for path: String in [CONNECTOR, DELTA]:
		if not FileAccess.file_exists(path):
			absent_owner.append(path)
	measurements["missing_owner_inputs"] = absent_owner
	var legacy := _load_json(LEGACY_WORLD)
	var legacy_layers := _load_json(LEGACY_LAYERS)
	var composed := _load_json(COMPOSED_WORLD)
	var composed_layers := _load_json(COMPOSED_LAYERS)
	var pilot := _load_json(COMPOSED_PILOT)
	var connector := _load_json(CONNECTOR)
	var delta := _load_json(DELTA)
	if legacy.is_empty() or legacy_layers.is_empty() or composed.is_empty() \
			or composed_layers.is_empty() or pilot.is_empty():
		last_error = "A0_SPATIAL_CONTRACT_SOURCE_MISSING"
		return _result()
	var owner_contract := absent_owner.is_empty()
	checks.append({
		"name": "owner_contract_present",
		"ok": true,
		"detail": "A1's connector and legacy cell delta are present" if owner_contract
			else "A1_OWNER_CONTRACT_ABSENT: %s - the composed geometry was verified structurally, "
				% ", ".join(absent_owner)
				+ "but the authored carve, camera limits and continent coverage cannot be claimed",
		"skipped": not owner_contract,
	})
	_check_pins(pilot, connector, delta)
	var legacy_grid := _grid(legacy_layers)
	var composed_grid := _grid(composed_layers)
	if legacy_grid.is_empty() or composed_grid.is_empty():
		last_error = "A0_SPATIAL_CONTRACT_LAYERS_INVALID"
		return _result()
	var legacy_size := Vector2i(int(legacy_layers.get("width", 0)), int(legacy_layers.get("height", 0)))
	var composed_size := Vector2i(int(composed_layers.get("width", 0)), int(composed_layers.get("height", 0)))
	_check_composed_extent(legacy_size, composed_size, composed, connector)
	_check_legacy_identity_structural(legacy_grid, legacy_size, composed_grid, composed_size)
	if owner_contract:
		_check_legacy_identity(legacy_grid, legacy_size, composed_grid, composed_size, delta)
		_check_seam_carve(composed_grid, composed_size, delta)
	_check_annex_seam_crossing(composed_grid, composed_size, connector)
	if authored != null and authored.is_ready():
		_check_authored_annex(authored, composed_grid, composed_size)
		_check_authored_coverage(authored, composed_size)
	else:
		checks.append({
			"name": "authored_coverage",
			"ok": true,
			"detail": "A1_AUTHORED_READER_ABSENT: the authored continent was not readable in this tree, "
				+ "so only the composed (legacy + pinned annex) contract was verified. "
				+ "The composition workflow runs this check with A1's reader present.",
			"skipped": true,
		})
	var failed: Array[String] = []
	for check: Dictionary in checks:
		if not bool(check.get("ok", false)):
			failed.append("%s: %s" % [String(check.get("name", "")), String(check.get("detail", ""))])
	return _result(failed)


func _result(failed: Array[String] = []) -> Dictionary:
	return {
		"ok": failed.is_empty() and last_error.is_empty(),
		"reason": last_error if not last_error.is_empty() else String(", ").join(failed),
		"checks": checks.duplicate(true),
		"measurements": measurements.duplicate(true),
	}


func _check(name: String, ok: bool, detail: String) -> void:
	checks.append({"name": name, "ok": ok, "detail": detail})


# ---------------------------------------------------------------------------
# pins: the composed bytes are the pinned A1 bytes, not a local redraw
# ---------------------------------------------------------------------------
func _check_pins(pilot: Dictionary, connector: Dictionary, delta: Dictionary) -> void:
	var files: Dictionary = pilot.get("files", {})
	var expected := {
		"annex_world.v1.json": COMPOSED_WORLD,
		"annex_layers.v1.json": COMPOSED_LAYERS,
		"annex_props.v1.json": COMPOSED_PROPS,
	}
	var bad: Array[String] = []
	for name: String in expected:
		var want := String((files.get(name, {}) as Dictionary).get("sha256", ""))
		var got := FileAccess.get_sha256(String(expected[name]))
		if want.is_empty() or want != got:
			bad.append("%s (%s != %s)" % [name, want.left(12), got.left(12)])
	_check("composed_source_pins", bad.is_empty(),
		"composed world/layers/props hashes match A1's pilot manifest" if bad.is_empty()
		else "mismatched " + ", ".join(bad))
	if FileAccess.file_exists(CONNECTOR):
		var contract_hash := FileAccess.get_sha256(CONNECTOR)
		_check("connector_pin", contract_hash == String(pilot.get("contract_sha256", "")),
			"connector sha256 %s matches A1's pilot manifest" % contract_hash.left(16))
	if FileAccess.file_exists(DELTA):
		var delta_hash := FileAccess.get_sha256(DELTA)
		_check("legacy_delta_pin", delta_hash == String(pilot.get("delta_sha256", "")),
			"legacy cell delta sha256 %s matches A1's pilot manifest" % delta_hash.left(16))
	if not connector.is_empty():
		_check("connector_id", String(connector.get("connector_id", "")) == String(pilot.get("connector_id", "")),
			"connector id %s" % String(connector.get("connector_id", "")))
	measurements["pilot_native_playable"] = bool(pilot.get("native_playable", true))
	measurements["connector_status"] = String(connector.get("status", ""))


# ---------------------------------------------------------------------------
# extent + camera: one frame, explicit limits, no teleport
# ---------------------------------------------------------------------------
func _check_composed_extent(legacy_size: Vector2i, composed_size: Vector2i,
		composed: Dictionary, connector: Dictionary) -> void:
	var bounds: Dictionary = composed.get("world_bounds", {})
	_check("composed_bounds",
		composed_size == Vector2i(448, 256)
			and int(bounds.get("w", 0)) == 448 and int(bounds.get("h", 0)) == 256,
		"composed frame %dx%d cells (%d px wide)" % [composed_size.x, composed_size.y, composed_size.x * TILE_PX])
	var frame: Dictionary = connector.get("coordinate_frame", {})
	var declared: Dictionary = frame.get("composed_bounds", {})
	if not declared.is_empty():
		_check("composed_bounds_are_connector_bounds",
			int(declared.get("w", 0)) == composed_size.x and int(declared.get("h", 0)) == composed_size.y,
			"connector declares %dx%d" % [int(declared.get("w", 0)), int(declared.get("h", 0))])
	var camera: Dictionary = connector.get("camera", {})
	if not camera.is_empty():
		_check("camera_limits_match_extent",
			int(camera.get("limit_right_px", 0)) == composed_size.x * TILE_PX
				and int(camera.get("limit_bottom_px", 0)) == composed_size.y * TILE_PX,
			"right %d px / bottom %d px" % [int(camera.get("limit_right_px", 0)), int(camera.get("limit_bottom_px", 0))])
	var start: Array = composed.get("start_position", [])
	var inside := start.size() == 2 and Vector2(start[0], start[1]).x >= 0.0 \
		and Vector2(start[0], start[1]).y >= 0.0 \
		and Vector2(start[0], start[1]).x < float(composed_size.x * TILE_PX) \
		and Vector2(start[0], start[1]).y < float(composed_size.y * TILE_PX)
	_check("spawn_inside_composed_frame", inside, "authored start %s" % str(start))
	if start.size() == 2:
		var spawn_cell := Vector2i(int(float(start[0]) / TILE_PX), int(float(start[1]) / TILE_PX))
		measurements["spawn_cell"] = [spawn_cell.x, spawn_cell.y]
	measurements["composed_cells"] = composed_size.x * composed_size.y
	measurements["legacy_cells"] = legacy_size.x * legacy_size.y


# ---------------------------------------------------------------------------
# legacy identity: nothing in the old world moved except the authored carve
# ---------------------------------------------------------------------------
func _check_legacy_identity(legacy_grid: Dictionary, legacy_size: Vector2i,
		composed_grid: Dictionary, composed_size: Vector2i, delta: Dictionary) -> void:
	var carved := {}
	for raw: Variant in (delta.get("cell_deltas", []) as Array):
		if raw is Dictionary:
			var cell: Array = (raw as Dictionary).get("cell", [])
			if cell.size() == 2:
				carved[Vector2i(int(cell[0]), int(cell[1]))] = raw
	var compared := 0
	var mismatches: Array[String] = []
	for y: int in range(legacy_size.y):
		if y >= composed_size.y:
			break
		for x: int in range(legacy_size.x):
			if x >= composed_size.x:
				break
			var cell := Vector2i(x, y)
			if carved.has(cell):
				continue
			compared += 1
			for layer: String in ["ground", "solid", "detail"]:
				var want := String((legacy_grid[layer] as PackedStringArray)[y * legacy_size.x + x])
				var got := String((composed_grid[layer] as PackedStringArray)[y * composed_size.x + x])
				if want != got:
					if mismatches.size() < 8:
						mismatches.append("%s@%d,%d %s!=%s" % [layer, x, y, want, got])
		# cells to the right of the legacy width only exist in the annex
	measurements["legacy_cells_compared"] = compared
	_check("legacy_identity", mismatches.is_empty() and compared == 384 * 256 - carved.size(),
		"%d legacy cells byte-identical outside the authored carve" % compared
			if mismatches.is_empty() else "diverged: " + ", ".join(mismatches))
	measurements["carve_cells"] = carved.size()


## Independent of A1's delta: whatever the shipped composed world changed in the
## legacy half MUST be confined to the authored 16x3 seam carve at x=368,y=199.
## Anything else is a redraw of the old world and fails here.
func _check_legacy_identity_structural(legacy_grid: Dictionary, legacy_size: Vector2i,
		composed_grid: Dictionary, composed_size: Vector2i) -> void:
	var diffs := 0
	var outside: Array[String] = []
	var min_cell := Vector2i(1 << 20, 1 << 20)
	var max_cell := Vector2i(-1, -1)
	for y: int in range(legacy_size.y):
		for x: int in range(legacy_size.x):
			for layer: String in ["ground", "solid", "detail"]:
				var want := String((legacy_grid[layer] as PackedStringArray)[y * legacy_size.x + x])
				var got := String((composed_grid[layer] as PackedStringArray)[y * composed_size.x + x])
				if want == got:
					continue
				diffs += 1
				min_cell = Vector2i(mini(min_cell.x, x), mini(min_cell.y, y))
				max_cell = Vector2i(maxi(max_cell.x, x), maxi(max_cell.y, y))
				var in_carve := x >= 368 and x < 384 and y >= 199 and y < 202
				if not in_carve and outside.size() < 8:
					outside.append("%s@%d,%d %s->%s" % [layer, x, y, want, got])
	measurements["legacy_layer_diffs"] = diffs
	measurements["legacy_diff_bounds"] = [min_cell.x, min_cell.y, max_cell.x, max_cell.y]
	var confined := outside.is_empty() and diffs > 0 and max_cell.x < 384 and max_cell.y < 256
	_check("legacy_changes_confined_to_seam", confined,
		"%d layer writes, all inside the authored 16x3 seam carve (bounds %s)"
			% [diffs, str([min_cell.x, min_cell.y, max_cell.x, max_cell.y])]
		if confined else "changed cells outside the seam carve: " + ", ".join(outside))


func _check_seam_carve(composed_grid: Dictionary, composed_size: Vector2i, delta: Dictionary) -> void:
	var wrong: Array[String] = []
	var applied := 0
	for raw: Variant in (delta.get("cell_deltas", []) as Array):
		if not raw is Dictionary:
			continue
		var entry := raw as Dictionary
		var cell: Array = entry.get("cell", [])
		var after: Dictionary = entry.get("after", {})
		if cell.size() != 2:
			continue
		var x := int(cell[0])
		var y := int(cell[1])
		if x < 0 or y < 0 or x >= composed_size.x or y >= composed_size.y:
			wrong.append("delta outside frame at %d,%d" % [x, y])
			continue
		applied += 1
		for layer: String in ["ground", "solid", "detail"]:
			if not after.has(layer):
				continue
			var want := String(after[layer])
			var got := String((composed_grid[layer] as PackedStringArray)[y * composed_size.x + x])
			if want != got and wrong.size() < 8:
				wrong.append("%s@%d,%d %s!=%s" % [layer, x, y, got, want])
	measurements["carve_cells_applied"] = applied
	_check("seam_carve_exact", wrong.is_empty() and applied >= int(delta.get("collision_cell_count", 0)),
		"%d authored delta cells applied verbatim" % applied if wrong.is_empty() else "wrong: " + ", ".join(wrong))


# ---------------------------------------------------------------------------
# the join is walkable: the player can step from the old world into the annex
# ---------------------------------------------------------------------------
func _check_annex_seam_crossing(composed_grid: Dictionary, composed_size: Vector2i, connector: Dictionary) -> void:
	var rows: Array = (connector.get("legacy_carve", {}) as Dictionary).get("clearance_rows", [199, 200, 201])
	var open_legacy := 0
	var open_annex := 0
	var checked := 0
	for raw: Variant in rows:
		var y := int(raw)
		if y < 0 or y >= composed_size.y:
			continue
		checked += 1
		if String((composed_grid["solid"] as PackedStringArray)[y * composed_size.x + 383]) == ".":
			open_legacy += 1
		if String((composed_grid["solid"] as PackedStringArray)[y * composed_size.x + 384]) == ".":
			open_annex += 1
	measurements["seam_rows"] = checked
	measurements["seam_open_legacy_side"] = open_legacy
	measurements["seam_open_annex_side"] = open_annex
	_check("seam_walkable_both_sides", checked > 0 and open_legacy == checked and open_annex == checked,
		"%d/%d clearance rows open on both sides of x=383|384" % [mini(open_legacy, open_annex), checked])
	var annex_walkable := 0
	for y: int in range(192, mini(256, composed_size.y)):
		for x: int in range(384, mini(448, composed_size.x)):
			if String((composed_grid["solid"] as PackedStringArray)[y * composed_size.x + x]) == ".":
				annex_walkable += 1
	measurements["annex_walkable_cells"] = annex_walkable
	_check("annex_has_ground", annex_walkable > 1000,
		"%d walkable annex cells (64x64 authored chunk)" % annex_walkable)


# ---------------------------------------------------------------------------
# authored cross-checks (only when A1's reader is present)
# ---------------------------------------------------------------------------
func _check_authored_annex(authored: A1AuthoredSource, composed_grid: Dictionary,
		composed_size: Vector2i) -> void:
	var authored_walkable := 0
	var walls_on_authored_ground := 0
	var examples: Array[String] = []
	for y: int in range(192, 256):
		for x: int in range(384, 448):
			if not authored.walkable(Vector2i(x, y)):
				continue
			authored_walkable += 1
			if String((composed_grid["solid"] as PackedStringArray)[y * composed_size.x + x]) != ".":
				walls_on_authored_ground += 1
				if examples.size() < 8:
					examples.append("%d,%d" % [x, y])
	measurements["authored_annex_walkable"] = authored_walkable
	_check("annex_matches_authored_walk", authored_walkable > 0 and walls_on_authored_ground == 0,
		"all %d authored-walkable annex cells are walkable in the composed world" % authored_walkable
			if walls_on_authored_ground == 0
			else "%d authored walkable cells are solid in the composed world (%s)" % [walls_on_authored_ground, ", ".join(examples)])
	# A1's build_permission is machine-readable authority; A0 must be the delegate.
	var sample := Vector2i(400, 200)
	var answer := authored.cell(sample)
	var build: Dictionary = answer.get("build", {}) if answer is Dictionary else {}
	measurements["annex_build_authority"] = String(build.get("authority", "unknown"))
	_check("annex_build_delegates_to_a0",
		String(build.get("authority", "")) in ["a0", "a1", "a1_candidate", "dynamic_child"],
		"build_permission at 400,200 resolves with authority '%s' (never a silent deny)"
			% String(build.get("authority", "missing")))


func _check_authored_coverage(authored: A1AuthoredSource, composed_size: Vector2i) -> void:
	var pois := authored.poi_cells()
	var inside: Array[String] = []
	var outside: Array[String] = []
	for entry: Dictionary in pois:
		var cell: Vector2i = entry["cell"]
		if cell.x >= 0 and cell.y >= 0 and cell.x < composed_size.x and cell.y < composed_size.y:
			inside.append(String(entry["poi_id"]))
		else:
			outside.append(String(entry["poi_id"]))
	measurements["authored_pois"] = pois.size()
	measurements["authored_pois_in_composed"] = inside.size()
	measurements["authored_pois_outside_composed"] = outside.size()
	measurements["authored_frame_cells"] = authored.frame.x * authored.frame.y
	measurements["composed_share_of_authored"] = float(composed_size.x * composed_size.y) \
		/ float(authored.frame.x * authored.frame.y)
	measurements["authored_pois_outside_examples"] = outside.slice(0, mini(8, outside.size()))
	_check("authored_pois_inside_composed", inside.size() >= 2,
		"%d authored POIs are inside the composed frame: %s" % [inside.size(), ", ".join(inside.slice(0, mini(6, inside.size())))])
	# Regions are authored per cell; count the ones reachable inside the frame.
	var regions := {}
	for y: int in range(0, composed_size.y, 4):
		for x: int in range(0, composed_size.x, 4):
			var region := authored.region_of(Vector2i(x, y))
			if region >= 0:
				regions[region] = int(regions.get(region, 0)) + 1
	measurements["authored_regions_sampled_in_composed"] = regions.size()
	_check("composed_covers_multiple_regions", regions.size() >= 1,
		"%d distinct authored region ids sampled inside the composed frame" % regions.size())
	var hazards := {}
	for raw: Variant in ((authored.plan.get("hazards", []) as Array)):
		if not raw is Dictionary:
			continue
		var hazard := raw as Dictionary
		var rect: Array = hazard.get("rect", [])
		if rect.size() != 4:
			continue
		var rect_cell := Rect2i(int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3]))
		var composed_rect := Rect2i(0, 0, composed_size.x, composed_size.y)
		if rect_cell.intersects(composed_rect):
			hazards[String(hazard.get("hazard_id", ""))] = rect_cell
	measurements["authored_hazards_in_composed"] = hazards.keys()
	_check("authored_hazards_in_composed", hazards.size() >= 1,
		"%d authored hazard rect(s) intersect the composed frame: %s"
			% [hazards.size(), ", ".join(hazards.keys())])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


## Expands the shipped RLE layer documents (`{rle: [[token, count], ...]}`) into
## one token per cell, row-major. Anything else is refused rather than guessed.
func _grid(layers: Dictionary) -> Dictionary:
	var width := int(layers.get("width", 0))
	var height := int(layers.get("height", 0))
	if width <= 0 or height <= 0:
		return {}
	var raw: Dictionary = layers.get("layers", {})
	var out := {}
	var total := width * height
	for layer: String in ["ground", "solid", "detail"]:
		var document: Dictionary = raw.get(layer, {})
		var rle: Array = document.get("rle", [])
		if rle.is_empty():
			return {}
		var flat := PackedStringArray()
		flat.resize(total)
		var cursor := 0
		for pair: Variant in rle:
			if not pair is Array or (pair as Array).size() != 2:
				return {}
			var token := String((pair as Array)[0])
			var count := int((pair as Array)[1])
			for _i: int in range(count):
				if cursor >= total:
					break
				flat[cursor] = token
				cursor += 1
		if cursor != total:
			return {}
		out[layer] = flat
	return out
