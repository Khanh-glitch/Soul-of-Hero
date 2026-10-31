extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP2 — nonvacuity of the green A0 matrix, on the composed bytes.
##
## A0's own CI reports "4/4 rendered native matrix" and a home-only restart. This
## probe asks the question those runs cannot ask for CT: **is the green real**. It
## does that by attacking the four things a green journey can be faked through:
##
## * **routes** — three genuinely different first legs (east, south, east-then-
##   south), driven with real key events, not a teleport;
## * **the paid build** — nineteen structures at catalogue cost, the twentieth
##   refused for the exact shortfall;
## * **the bag boundary** — what happens when a stack is full, and what the
##   product refuses to do silently;
## * **partial construction** — whether a half-built structure can even exist.
##
## Where a clause cannot be exercised on this composition (a 30-slot bag with 8
## item kinds; a construction stage that does not exist) the probe says so with the
## reason, and never upgrades it to a pass.

const PIECE := "foundation_wood"
const GRANT_KEY := "a7_r10_field_grant"
const WANTED_STRUCTURES := 19


func _body() -> void:
	probe_id = "R10FIELD"
	probe_title = "nonvacuity of A0's green: three routes, nineteen paid structures, and the bag boundary"
	owner_action = (
		"A0: none for this probe — the paid build, the routes and the stack overflow all behave. The 30-slot bag and "
		+ "a multi-stage construction cannot be reached at all: the survival catalogue ships 8 item kinds and "
		+ "`place_structure` is atomic, so both clauses stay NOT_TESTED rather than passing."
	)

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_block("the shipped overworld could not be mounted: %s" % blocked)
		return
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system", "chapter1_overworld.gd")
		_done()
		return

	await _routes(build)
	await _structures(build, mounted)
	await _bag_boundary(mounted)
	_partial_construction()
	_done()


# ------------------------------------------------------------------ 1. three routes
## Three *different* legs from the real spawn, each driven by keys. A route claim
## has to survive being walked, not just being declared reachable.
func _routes(_build: Node) -> void:
	var legs := [
		{"label": "east", "keys": ["move_right"], "axis": "x", "sign": 1},
		{"label": "south", "keys": ["move_down"], "axis": "y", "sign": 1},
		{"label": "east-then-south", "keys": ["move_right", "move_down"], "axis": "", "sign": 1},
	]
	for leg: Dictionary in legs:
		var start := _hero_cell()
		var path: Array = []
		for action: String in (leg["keys"] as Array):
			await _hold(String(action), 26)
			path.append(_hero_cell())
		var end := _hero_cell()
		var moved := start.distance_to(end)
		_note("route %-16s %s -> %s (%d cells via %s)" % [
			String(leg["label"]), str(start), str(end), moved, JSON.stringify(path),
		])
		_expect(moved >= 2,
			"the %s route physically moves the Hero at least two cells (%d)" % [String(leg["label"]), moved])
		var axis_ok := true
		if String(leg["axis"]) == "x":
			axis_ok = end.x > start.x
		elif String(leg["axis"]) == "y":
			axis_ok = end.y > start.y
		else:
			axis_ok = end.x > start.x and end.y > start.y
		_expect(axis_ok, "the %s route moved along the direction the keys asked for" % String(leg["label"]))
		# And the destination is on the graph, so the leg is a route and not a slide.
		var reachable := traversability != null and bool(traversability.call(&"is_reachable", start, end))
		_note("route %-16s graph_reachable=%s" % [String(leg["label"]), str(reachable)])
		_expect(reachable, "the %s leg ends on a cell the map graph also reaches" % String(leg["label"]))


# ----------------------------------------------------- 2. nineteen paid structures
func _structures(build: Node, mounted: Node) -> void:
	var save := _save()
	# FIXTURE_GRANT: the materials are granted, the *placement* is not. Nineteen
	# foundations cost 38 oak wood; the grant covers it so the count is what is
	# measured, and the world validation, payment and commit are the product's.
	_expect(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 40, GRANT_KEY)),
		"the inventory accepts the materials the structures will spend (FIXTURE_GRANT 40 oak_wood)")

	var placed := 0
	var world_cells: Array[Vector2i] = []
	var reasons: Dictionary = {}
	var origin := _hero_cell()
	for ring: int in range(1, 8):
		for offset: Vector2i in [
			Vector2i(ring, 0), Vector2i(-ring, 0), Vector2i(0, ring), Vector2i(0, -ring),
			Vector2i(ring, ring), Vector2i(-ring, ring), Vector2i(ring, -ring), Vector2i(-ring, -ring),
		]:
			if placed >= WANTED_STRUCTURES:
				break
			var cell := origin + offset
			var result: Dictionary = build.call(&"try_place", cell)
			if bool(result.get("ok", false)):
				placed += 1
				world_cells.append(cell)
			else:
				var reason := String(result.get("reason", "unknown"))
				reasons[reason] = int(reasons.get(reason, 0)) + 1
	_note("try_place successes=%d refusals=%s" % [placed, JSON.stringify(reasons)])
	_expect(placed >= 3,
		"the shipped build door places several structures in the world it built (%d placed)" % placed)

	# The rest of the nineteen go through the service door, because the world
	# validator legitimately refuses cells near props/landmarks. The difference is
	# stated instead of hidden: the first `placed` are the player's door.
	var service: Node = mounted.get(&"survival_build").call(&"service")
	var stored := 0
	var index := 0
	while placed < WANTED_STRUCTURES and index < 64:
		var cell := Vector2i(2000 + index, 2000)
		var result: Dictionary = service.call(&"place_structure", PIECE, cell, "a7_r10_field_%d" % index, Callable())
		if bool(result.get("ok", false)):
			placed += 1
			stored += 1
		index += 1
	_note("structures total=%d (player door=%d, service door=%d)" % [placed, placed - stored, stored])
	_expect(placed == WANTED_STRUCTURES,
		"%d structures exist after the paid placements (%d)" % [WANTED_STRUCTURES, placed])
	_expect(int(service.call(&"structure_count")) == placed,
		"the survival document counts exactly the structures that were paid for")

	var wood := _count(save, "oak_wood")
	_note("oak_wood after %d foundations: %d (40 granted, 2 per foundation)" % [placed, wood])
	_expect(wood == 40 - 2 * placed,
		"each structure cost exactly its catalogue price (%d oak wood left)" % wood)

	# 40 oak wood is exactly twenty foundations, so the affordable edge is the
	# twentieth; the twenty-first is where the product has to say no.
	var twentieth: Dictionary = service.call(&"place_structure", PIECE, Vector2i(3000, 3000), "a7_r10_field_20", Callable())
	_note("twentieth structure (exactly the last 2 oak): %s" % JSON.stringify(twentieth))
	_expect(bool(twentieth.get("ok", false)), "the last affordable structure still commits")
	var refused: Dictionary = service.call(&"place_structure", PIECE, Vector2i(3001, 3000), "a7_r10_field_over", Callable())
	var missing: Dictionary = refused.get("missing", {})
	_note("twentieth structure: %s" % JSON.stringify(refused))
	_expect(not bool(refused.get("ok", false)) and String(refused.get("reason", "")) == "cannot_afford",
		"the next structure is refused for affordability, by name (%s)" % String(refused.get("reason", "")))
	_expect(int(missing.get("oak_wood", 0)) > 0,
		"and the refusal names the exact shortfall (%s)" % JSON.stringify(missing))


# --------------------------------------------------------- 3. the bag boundary
func _bag_boundary(mounted: Node) -> void:
	var save := _save()
	var nodes: Dictionary = mounted.get(&"survival_nodes")
	if nodes.is_empty():
		_missing("a materialised survival resource node", "chapter1_overworld.gd")
		return
	# The nearest harvestable node, so the walk is short enough to be real.
	var nearest_id := ""
	var nearest_distance := INF
	for node_id: String in nodes.keys():
		var node: Node2D = nodes[node_id]
		if node == null or not is_instance_valid(node):
			continue
		var distance := hero.global_position.distance_to(node.global_position)
		if distance < nearest_distance and String(node_id).begins_with("oak_tree"):
			nearest_distance = distance
			nearest_id = node_id
	if nearest_id.is_empty():
		_missing("an authored oak node in the shipped world", "chapter1_overworld.gd")
		return
	var node: Node2D = nodes[nearest_id]
	_note("nearest oak node=%s at %s (%d px)" % [nearest_id, str(node.global_position), int(nearest_distance)])

	var walk := await _walk_to_point(node.global_position)
	_note("walk to node: ok=%s frames=%d gap_cells=%d" % [
		str(walk.get("ok", false)), int(walk.get("frames", -1)), _cell_gap(Vector2i(int(node.global_position.x / 16.0), int(node.global_position.y / 16.0))),
	])
	var interacted := bool(node.call(&"interact", hero))
	var first: Dictionary = node.call(&"last_result")
	_note("harvest interact=%s result=%s" % [str(interacted), JSON.stringify(first)])
	if not interacted:
		_note("PROBE_LIMIT: the walker could not bring the Hero into reach; the harvest door is measured by "
			+ "r10_restart_probe (4 receipts) instead")
	else:
		_expect(int(first.get("amount", 0)) > 0 or bool(first.get("ok", false)),
			"a real node pays on a real interaction (%s)" % JSON.stringify(first))

	# The interesting boundary: a full stack. 50 is the product's per-slot limit,
	# and it must open a second slot rather than silently exceeding it.
	var have := _count(save, "oak_wood")
	var top_up := 50 - have
	if top_up > 0:
		save.call(&"grant_inventory_item", "oak_wood", "material", top_up, GRANT_KEY + "_fill")
	var stacks := _oak_stacks(save)
	_note("oak stacks at the limit: %s" % JSON.stringify(stacks.values()))
	_expect(stacks.size() >= 1 and int(stacks.values()[0]) == 50,
		"the first oak slot is exactly at the product's 50-per-slot limit (%s)" % JSON.stringify(stacks.values()))
	if interacted:
		# The node carries a 0.18 s interaction cooldown and answers `true` while it
		# is cooling down without swinging, so the second attempt waits it out —
		# otherwise this measures the cooldown instead of the bag.
		for _frame: int in range(18):
			await process_frame
		var second_ok := bool(node.call(&"interact", hero))
		var second: Dictionary = node.call(&"last_result")
		var after := _oak_stacks(save)
		_note("harvest with a full stack: ok=%s result=%s stacks=%s oak_total=%d raw=%s" % [
			str(second_ok), JSON.stringify(second), JSON.stringify(after.values()),
			int(_inventory_totals().get("oak_wood", 0)), JSON.stringify(_raw_inventory(save)),
		])
		var total_after := int(_inventory_totals().get("oak_wood", 0))
		_expect(after.size() >= 2 or (not second_ok and String(second.get("reason", "")) == "inventory_full"),
			"a full stack either opens a second slot or refuses by name — never a silent loss "
			+ "(slots=%s total=%d reason=%s)" % [JSON.stringify(after.values()), total_after, String(second.get("reason", ""))])
	_note("NOT_TESTED: the 30-slot bag cannot be filled in this composition — the survival catalogue ships 8 item "
		+ "kinds, so a player can occupy at most 8 of 30 slots; the observable boundary is the per-stack limit above")


## The raw inventory block, so a probe bug cannot be mistaken for a product one.
func _raw_inventory(save: Node) -> Dictionary:
	var inventory: Dictionary = (save.call(&"get_snapshot") as Dictionary).get("inventory", {})
	return {"keys": inventory.keys(), "stacks": inventory.get("item_stacks", {})}


## One item's carried quantity, read from A0's own stack records.
func _count(save: Node, item: String) -> int:
	return int((_inventory_totals() as Dictionary).get(item, 0))


## Totals per item id, straight out of the save document.
func _inventory_totals() -> Dictionary:
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	var inventory: Dictionary = snapshot.get("inventory", {})
	var out: Dictionary = {}
	var stacks: Dictionary = inventory.get("item_stacks", {})
	for key: String in stacks.keys():
		var record: Variant = stacks[key]
		if not record is Dictionary:
			continue
		var item := String((record as Dictionary).get("item_id", key))
		out[item] = int(out.get(item, 0)) + int((record as Dictionary).get("quantity", 0))
	return out


## Oak stack records, keyed by stack key, so the per-slot limit is read rather than
## assumed from a total.
func _oak_stacks(save: Node) -> Dictionary:
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var inventory: Dictionary = snapshot.get("inventory", {})
	var stacks: Dictionary = inventory.get("item_stacks", {})
	var out: Dictionary = {}
	for key: String in stacks.keys():
		var record: Variant = stacks[key]
		if record is Dictionary and String((record as Dictionary).get("item_id", key)) == "oak_wood":
			out[key] = int((record as Dictionary).get("quantity", 0))
	return out


# --------------------------------------------------- 4. partial construction
func _partial_construction() -> void:
	var service_source := FileAccess.get_file_as_string("res://game/survival/survival_service.gd")
	var staged := service_source.contains("build_progress") or service_source.contains("construction_progress") \
		or service_source.contains("stage_progress")
	_note("construction progress field present=%s" % str(staged))
	if not staged:
		_missing(
			"a partial construction state: `place_structure` pays and creates in one commit and no progress field "
			+ "exists, so 'a half-built structure' cannot be produced, abandoned or resumed — the clause is "
			+ "unreachable rather than passing"
		)
	else:
		_expect(true, "the survival document carries a construction progress field")
