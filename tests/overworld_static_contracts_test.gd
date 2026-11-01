extends SceneTree
## Static contract: authored JSON declares the required anchors — refuge, 10
## landmarks with campaign_level_ids, ≥3 camps/discoveries/shortcuts, and a
## survival block with sane rates. This is a DATA CHECK only.

const WORLD_DATA_PATH := "res://data/overworld/hollow_marches.json"
const REGISTRY_PATH := "res://data/overworld/landmark_registry.json"

var failures: Array[String] = []
var checks := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_mark("begin")
	var f := FileAccess.open(WORLD_DATA_PATH, FileAccess.READ)
	_expect(f != null, "hollow_marches.json accessible")
	var wd: Dictionary = {}
	if f != null:
		var text := f.get_as_text(); f.close()
		var parsed = JSON.parse_string(text)
		_expect(parsed is Dictionary, "hollow_marches.json parses as Dictionary")
		if parsed is Dictionary:
			wd = parsed
	var rf := FileAccess.open(REGISTRY_PATH, FileAccess.READ)
	var reg: Dictionary = {}
	if rf != null:
		var rt := rf.get_as_text(); rf.close()
		var rp = JSON.parse_string(rt)
		if rp is Dictionary:
			reg = rp

	_expect(int(wd.get("tile_size", 0)) == 16, "tile_size == 16")
	var wb: Dictionary = wd.get("world_bounds", {}) as Dictionary
	_expect(int(wb.get("w", 0)) >= 200 and int(wb.get("h", 0)) >= 200, "world bounds ≥ 200x200")

	var camps: Array = wd.get("camps", []) as Array
	var discoveries: Array = wd.get("discoveries", []) as Array
	var shortcuts: Array = wd.get("shortcuts", []) as Array
	var landmarks: Array = wd.get("landmarks", []) as Array
	_expect(camps.size() >= 3, "≥3 camps authored (got %d)" % camps.size())
	_expect(discoveries.size() >= 3, "≥3 discoveries (got %d)" % discoveries.size())
	_expect(shortcuts.size() >= 3, "≥3 shortcuts (got %d)" % shortcuts.size())
	_expect(landmarks.size() == 10, "exactly 10 landmarks (got %d)" % landmarks.size())

	var refuge: Dictionary = wd.get("refuge", {}) as Dictionary
	_expect(not refuge.is_empty() and refuge.has("pos"), "refuge with pos authored")

	for lm in landmarks:
		if not (lm is Dictionary):
			failures.append("non-dict landmark entry"); continue
		var d: Dictionary = lm as Dictionary
		_expect(String(d.get("campaign_level_id", "")).begins_with("chapter_1_level_"),
			"landmark %s declares campaign_level_id" % d.get("id", "?"))

	_mark("world-data")
	# Survival block invariants.
	var surv: Dictionary = wd.get("survival", {}) as Dictionary
	if not surv.is_empty():
		_expect(String(surv.get("resource_id", "")) == "provisions", "survival.resource_id == 'provisions'")
		var max_p := int(surv.get("max", 0))
		var start_p := int(surv.get("start", 0))
		_expect(max_p > 0 and start_p > 0 and start_p <= max_p, "start/max sane")
		var wild := float(surv.get("drain_per_second_wild", -1.0))
		var hazard := float(surv.get("drain_per_second_hazard", -1.0))
		var safe := float(surv.get("drain_per_second_safe", -1.0))
		_expect(wild >= 0.0 and hazard >= wild and safe <= wild, "rates ordered safe≤wild≤hazard")
		if wild > 0.0:
			_expect(float(max_p) / wild >= 120.0, "wild drain lasts ≥ 2 min")
		_expect(is_equal_approx(safe, 0.0), "safe drain is 0")

	_mark("survival")
	# Shortcut carve boxes: authored, four numbers, and solid in the baked layers.
	var layers_file := FileAccess.open("res://data/overworld/hollow_marches_layers.json", FileAccess.READ)
	_expect(layers_file != null, "hollow_marches_layers.json accessible")
	var solid_grid: PackedStringArray = PackedStringArray()
	var grid_width := 0
	var grid_height := 0
	if layers_file != null:
		var layer_doc: Variant = JSON.parse_string(layers_file.get_as_text())
		layers_file.close()
		_expect(layer_doc is Dictionary, "layer document parses")
		if layer_doc is Dictionary:
			grid_width = int((layer_doc as Dictionary).get("width", 0))
			grid_height = int((layer_doc as Dictionary).get("height", 0))
			var layers: Dictionary = (layer_doc as Dictionary).get("layers", {})
			var solid_layer: Dictionary = layers.get("solid", {})
			var rle: Array = solid_layer.get("rle", [])
			solid_grid = _decode_rle(rle)
			_expect_equal(solid_grid.size(), grid_width * grid_height,
				"solid layer decodes to W*H cells (%dx%d)" % [grid_width, grid_height])
	var blocked := ["#", "W", "T", "!"]
	for raw_shortcut: Variant in shortcuts:
		if not raw_shortcut is Dictionary:
			continue
		var entry: Dictionary = raw_shortcut
		var sid := String(entry.get("id", "?"))
		var carve: Array = entry.get("carve", []) as Array
		_expect(carve.size() == 4, "%s declares a 4-number carve box" % sid)
		if carve.size() != 4 or solid_grid.is_empty():
			continue
		var all_solid := true
		for y in range(int(carve[1]), int(carve[3]) + 1):
			for x in range(int(carve[0]), int(carve[2]) + 1):
				var index := y * grid_width + x
				if index < 0 or index >= solid_grid.size():
					all_solid = false
					continue
				var token := String(solid_grid[index])
				if not blocked.has(token.substr(0, 1) if not token.is_empty() else "."):
					all_solid = false
		_expect(all_solid, "%s carve box is solid while closed (baked)" % sid)

	_mark("carve-boxes")
	# Every landmark threshold must be walkable in the baked layers.
	if not solid_grid.is_empty():
		var unwalkable := 0
		for raw_landmark: Variant in landmarks:
			if not raw_landmark is Dictionary:
				continue
			var lm: Dictionary = raw_landmark
			var threshold: Array = lm.get("threshold", lm.get("pos", []))
			if threshold.size() < 2:
				unwalkable += 1
				continue
			var index2 := int(threshold[1]) * grid_width + int(threshold[0])
			if index2 < 0 or index2 >= solid_grid.size():
				unwalkable += 1
				continue
			var token2 := String(solid_grid[index2])
			if blocked.has(token2.substr(0, 1) if not token2.is_empty() else "."):
				unwalkable += 1
		_expect_equal(unwalkable, 0, "all ten thresholds stand on walkable ground")

	_mark("thresholds")
	# Registry bijectivity.
	var by_world: Dictionary = reg.get("camp_levels_by_world_id", {}) as Dictionary
	_expect(by_world.size() == 10, "registry camp_levels_by_world_id has 10 entries")
	var by_campaign: Dictionary = {}
	for wid in by_world.keys():
		by_campaign[String(by_world[wid])] = String(wid)
	_expect(by_campaign.size() == 10, "derived campaign→world map bijective")

	_mark("registry")
	# --- the atlas must be able to draw a scattered overlay without a lattice ---
	#
	# An unmasked detail overlay drawn from a single frame repeats identically on
	# every cell it covers; scattered over the fen that read as a grid of puddles.
	# The contract is that every overlay code declared in the baked layers either is
	# single-use by construction (a road, a path - one frame is correct there) or
	# carries several frames for a per-tile pick.
	var atlas_file := FileAccess.open("res://data/overworld/overworld_tiles.json", FileAccess.READ)
	_expect(atlas_file != null, "overworld_tiles.json accessible")
	if atlas_file != null:
		var atlas := JSON.parse_string(atlas_file.get_as_text()) as Dictionary
		atlas_file.close()
		var detail_codes: Dictionary = ((atlas.get("codes", {}) as Dictionary).get("detail", {}) as Dictionary)
		var atlas_layers_file := FileAccess.open("res://data/overworld/hollow_marches_layers.json", FileAccess.READ)
		if atlas_layers_file != null:
			var atlas_layers_doc := JSON.parse_string(atlas_layers_file.get_as_text()) as Dictionary
			atlas_layers_file.close()
			var used := {}
			var layer_bag: Dictionary = atlas_layers_doc.get("layers", {})
			var detail_layer: Dictionary = layer_bag.get("detail", {})
			var detail_rle: Array = detail_layer.get("rle", [])
			for run: Variant in detail_rle:
				if not (run is Array):
					continue
				var run_cells: Array = run
				if run_cells.is_empty():
					continue
				var run_token := String(run_cells[0])
				if run_token.is_empty():
					continue
				var run_code := run_token.substr(0, 1)
				# "." is the layer's "nothing here" marker, not an atlas code: the
				# renderer skips it before it ever looks a frame up. It accounts for
				# most detail-layer cells, so counting it as an overlay would assert
				# against a frame that must not exist.
				if run_code == ".":
					continue
				used[run_code] = true
			for code in used.keys():
				_expect(detail_codes.has(code), "detail code '%s' is in the atlas" % code)
			_expect(detail_codes.has("p"), "the pool overlay is in the atlas")
			var pool: Dictionary = detail_codes.get("p", {})
			var pool_frames: Array = pool.get("variant_names", [])
			_expect(pool_frames.size() >= 4,
				"the pool overlay carries at least 4 frames (has %d)" % pool_frames.size())
			_expect(not bool(pool.get("masked", true)),
				"the pool overlay is unmasked (it has no neighbours to mask against)")

	_mark("atlas-block")
	if failures.size() > 0:
		push_error("OVERWORLD_STATIC_CONTRACTS FAIL")
		quit(1)
		return
	print("OVERWORLD_STATIC_CONTRACTS PASSED - %d checks" % checks)
	quit(0)


func _expect_equal(actual: Variant, expected: Variant, msg: String) -> void:
	_expect(actual == expected, "%s (expected %s, got %s)" % [msg, expected, actual])


func _mark(label: String) -> void:
	# A progress checkpoint that survives into the run summary. If the script dies
	# part-way - a runtime error, not a failed check - the last marker shows where,
	# which is the difference between "some assertion failed" and a five-minute
	# guess. Costs one line of stdout per section.
	print("::notice::OW_STATIC_MARK " + label)


func _expect(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append(msg)
		push_error("OW_STATIC_FAIL: " + msg)
		# Also emit a GitHub workflow command. The step's own log is only reachable
		# through a host this project's tooling cannot always read, but annotations
		# come back through the API - so a failure names itself where it can be seen
		# instead of only inside a log file. Harmless outside Actions: it is a line of
		# stdout that looks like a command.
		print("::error title=overworld static contract::" + msg)


func _decode_rle(rle: Array) -> PackedStringArray:
	var out := PackedStringArray()
	for entry: Variant in rle:
		if not entry is Array or (entry as Array).size() < 2:
			continue
		var token := String((entry as Array)[0])
		var count := int((entry as Array)[1])
		for _i in range(maxi(0, count)):
			out.append(token)
	return out
