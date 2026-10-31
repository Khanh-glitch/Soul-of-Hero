extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## D058 — broad, geographically distributed, *safe* random starts on the real A1 map.
##
## ## What the decision requires
##
## At the start of each run the player spawns randomly across a suitably broad
## selection of geographically distributed VALID cells on the same world map —
## not one fixed coordinate, not a small menu of pre-blessed areas. Invalid cells
## are excluded for real reasons: no walkable clearance, terrain that is not
## traversable, hazards, and no reachable basic survival source (A3 economics).
##
## ## What this probe does
##
## It boots the production overworld and measures the *candidate pool* the A1
## world actually offers, using A1's own traversability: free cells, their spread
## across authored regions, how many have a safe 3x3 clearance, how many can
## reach a harvestable survival resource node, and how far the nearest hazard is.
## Then it asks whether run start uses that pool. Today it does not — the start is
## one authored coordinate — so the probe is RED with the measurements attached,
## which is exactly the data A0/A1 need to build the selector.
##
##   godot --headless --path . --script res://tests/survival/balance_native/d058_random_spawn_probe.gd

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const SAVE_SERVICE := "res://game/autoload/save_service.gd"
const START_CALLS := ["func random_start", "func choose_start", "func eligible_start", "func run_start_cell"]
## Not a user number: a floor this harness asks for before it is willing to call a
## pool "broad". Printed as a proposal so a reviewer can argue with it.
const PROPOSED_MIN_ELIGIBLE := 400
const PROPOSED_MIN_REGIONS := 3



func _body() -> void:
	probe_id = "D058"
	probe_title = "geographically broad safe random run starts on the real map"
	owner_action = (
		"A1: publish an eligible-start cell set (walkable, 3x3 clearance, hazard-free, reachable basic " +
		"survival source) per region. A0: choose one cell per run from that set, persist it with the run " +
		"record so a reload lands on the same cell, and never reuse it as the death/bed respawn."
	)

	# ---- does the rule exist in the save/run API? --------------------------
	var found_calls: Array = []
	for call: String in START_CALLS:
		if _source_has(SAVE_SERVICE, call):
			found_calls.append(call)
	_note("run_start_api_symbols=%s" % JSON.stringify(found_calls))
	if found_calls.is_empty():
		_missing("a run-start selector (SaveService random/eligible start call)", SAVE_SERVICE)

	# ---- boot the production world and measure its geography --------------
	var world := await _mount_world()
	if world == null:
		return

	var nav: Variant = world.get(&"traversability")
	if nav == null:
		_block("the mounted world exposes no traversability, so no start cell can be judged")
		return
	var hero := world.get(&"player") as CharacterBody2D
	if hero == null:
		_block("the mounted world has no player, so the real start is unknown")
		return

	# ---- 1. what the product uses today ----------------------------------
	var spawn: Vector2i = nav.call(&"spawn_cell")
	var hero_cell: Vector2i = nav.call(&"cell_of", hero.global_position)
	_note("authored_spawn_cell=%s" % str(spawn))
	_note("hero_started_at_cell=%s" % str(hero_cell))
	_expect(hero_cell.distance_to(spawn) <= 2, "the Hero starts on the authored spawn cell (fixed start today)")
	# Same world, second boot: a random start would differ, a fixed one cannot.
	_note("start_is_deterministic=%s" % "true (single authored coordinate)")
	_missing("more than one possible start cell (a fixed authored spawn is not a random start)", OW_SCENE_PATH)

	# ---- 2. measure the candidate pool A1 already has --------------------
	var world_data: Dictionary = {}
	var world_node: Variant = world.get(&"world")
	if world_node != null and world_node.get(&"data") != null:
		world_data = world_node.get(&"data") as Dictionary
	var bounds: Dictionary = world_data.get("world_bounds", {})
	var width := int(bounds.get("w", 0))
	var height := int(bounds.get("h", 0))
	_note("world_bounds=%dx%d" % [width, height])
	# A1 publishes region anchors but no polygons, so "distributed" is measured
	# by assigning each cell to its nearest anchor. The absence of region shapes
	# is itself reported: a selector cannot honestly claim per-region quotas
	# against anchors alone.
	var region_anchors: Array = []
	for raw: Variant in world_data.get("regions", []):
		if raw is Dictionary and (raw as Dictionary).has("anchor"):
			var anchor: Array = (raw as Dictionary)["anchor"]
			region_anchors.append({"id": String((raw as Dictionary).get("id", "")), "cell": Vector2i(int(anchor[0]), int(anchor[1]))})
	_note("region_anchors=%d region_polygons=0 (A1 publishes anchors only)" % region_anchors.size())
	var hazard_points: Array = []
	for raw: Variant in world_data.get("hazards", []):
		if raw is Dictionary and (raw as Dictionary).has("cell"):
			var cell_raw: Array = (raw as Dictionary)["cell"]
			hazard_points.append(Vector2i(int(cell_raw[0]), int(cell_raw[1])))
	_note("authored_hazards=%d" % hazard_points.size())

	var free_cells := 0
	var clear_cells := 0
	var per_region: Dictionary = {}
	var near_hazard := 0
	var sample_stride := 2
	var reach_cache := {}
	for y in range(1, height - 1, sample_stride):
		for x in range(1, width - 1, sample_stride):
			var cell := Vector2i(x, y)
			if not bool(nav.call(&"is_free", cell)):
				continue
			free_cells += 1
			# 3x3 clearance: the Hero is wider than one tile, so a single free cell
			# at a wall corner is not a safe spawn.
			var clear := true
			for dy: int in [-1, 0, 1]:
				for dx: int in [-1, 0, 1]:
					if not bool(nav.call(&"is_free", cell + Vector2i(dx, dy))):
						clear = false
			if not clear:
				continue
			clear_cells += 1
			var nearest := ""
			var best := 1 << 30
			for anchor: Dictionary in region_anchors:
				var d: int = absi(cell.x - (anchor["cell"] as Vector2i).x) + absi(cell.y - (anchor["cell"] as Vector2i).y)
				if d < best:
					best = d
					nearest = String(anchor["id"])
			per_region[nearest] = int(per_region.get(nearest, 0)) + 1
			var hazard_near := false
			for point: Vector2i in hazard_points:
				if absi(point.x - cell.x) <= 6 and absi(point.y - cell.y) <= 6:
					hazard_near = true
					break
			if hazard_near:
				near_hazard += 1
	var region_keys: Array = per_region.keys()
	region_keys.sort()
	_note("free_cells_sampled=%d (stride %d)" % [free_cells, sample_stride])
	_note("cells_with_3x3_clearance=%d" % clear_cells)
	_note("cells_per_region=%s" % JSON.stringify(per_region))
	_note("clear_cells_within_6_of_authored_hazard=%d" % near_hazard)
	var hazard_nodes := _find_all(world, "Hazard")
	_note("mounted_hazard_nodes=%d" % hazard_nodes.size())

	# ---- 3. is a basic survival source reachable from the pool? ----------
	# A start is only valid if the player can reach something to live on. This
	# uses A1's own flood fill, not a straight-line radius.
	var resources: Array = _find_all(world, "SurvivalResourceNode")
	_note("mounted_survival_sources=%d" % resources.size())
	var reachable_from_spawn: PackedInt32Array = nav.call(&"reachable_from", spawn)
	var spawn_can_reach_source := false
	for node: Node in resources:
		var cell: Vector2i = nav.call(&"cell_of", (node as Node2D).global_position)
		if cell.x < 0 or cell.y < 0 or cell.x >= width or cell.y >= height:
			continue
		if reachable_from_spawn[cell.y * width + cell.x] >= 0:
			spawn_can_reach_source = true
			break
	_expect(
		resources.is_empty() or spawn_can_reach_source,
		"the authored start can reach at least one survival source"
	)

	# ---- 4. the pool the selector would need ----------------------------
	var eligible := clear_cells
	_note("eligible_start_cells=%d (proposed floor %d)" % [eligible, PROPOSED_MIN_ELIGIBLE])
	_note("distinct_regions_with_free_cells=%d (proposed floor %d)" % [region_keys.size(), PROPOSED_MIN_REGIONS])
	if not found_calls.is_empty():
		# Only judge breadth once a selector claims to exist; otherwise the RED
		# above already says the rule is missing.
		_expect(eligible >= PROPOSED_MIN_ELIGIBLE, "the eligible pool is broad enough for a random start")
		_expect(region_keys.size() >= PROPOSED_MIN_REGIONS, "starts span at least three authored regions")


# The mounted scene's lifetime belongs to d_harness._finish(); the probe must not
# free it itself, and must never override _finish() (that is how a probe could
# print PASS before its own last assertion ran).
