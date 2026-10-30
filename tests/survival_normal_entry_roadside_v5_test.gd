extends "res://tests/survival_normal_entry_waystation_candidate_test.gd"
## Normal app entry -> real Home -> real overworld -> three A1 roadside crates
## at their authored stands -> back to the same paid home -> separate process.
## UI/physics inputs are injected; not a human playtest or rendered review.

func _after_home_continuation() -> void:
	if not is_instance_valid(_host) or _host.get_child_count() == 0:
		_expect(false, "roadside continuation has a production world")
		return
	var ow := _host.get_child(0)
	var host := ow.get_node_or_null("WaystationRuntime")
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	_expect(host != null and hero != null and nav != null, "production world owns one candidate host and Hero")
	if host == null or hero == null or nav == null:
		return
	var home := nav.cell_of(hero.global_position)
	# The inherited journey ends inside the paid room. A closed door really does
	# block the route planner, so the player has to walk to it and open it before
	# the roadside stands are reachable -- ordinary movement and pointer only.
	if not await _open_closed_doors(ow, hero, nav):
		return
	var sources := [
		{"id": "roadside_01", "stand": Vector2i(395, 220), "key": "a3src:r_ashen_crown:roadside_supply:01:claim:1", "items": {"research_notes": 1}},
		{"id": "roadside_02", "stand": Vector2i(400, 217), "key": "a3src:r_ashen_crown:roadside_supply:02:claim:1", "items": {"iron_scrap": 3, "knowledge_spares": 2}},
		{"id": "roadside_03", "stand": Vector2i(402, 221), "key": "a3src:r_ashen_crown:roadside_supply:03:claim:1", "items": {"oak_wood": 2, "research_notes": 1}},
	]
	for source: Dictionary in sources:
		var point := host.get_node_or_null(String(source.id).capitalize()) as Node2D
		_expect(point != null, "authored roadside object exists in the live world: " + String(source.id))
		if point == null:
			return
		if not await _walk_to(hero, nav, source.stand, "ordinary input walks to " + String(source.id)):
			print("ROADSIDE_STAND_FAIL id=%s hero=%s cell=%s stand=%s route=%d" % [String(source.id), str(hero.global_position), str(nav.cell_of(hero.global_position)), str(source.stand), _route(nav.cell_of(hero.global_position), source.stand, nav, hero).size()])
			return
		var prior: Dictionary = _save().call(&"inventory_totals")
		await _use(ow, hero, point)
		var after: Dictionary = _save().call(&"inventory_totals")
		for item: String in source.items:
			_expect(int(after.get(item, 0)) == int(prior.get(item, 0)) + int(source.items[item]), "exact A3 item " + item + " from " + String(source.id))
		var snapshot: Dictionary = _save().call(&"get_snapshot")
		var world: Dictionary = snapshot.get("world_slice", {})
		var pois: Dictionary = world.get("pois", {})
		var waystation: Dictionary = pois.get("poi_crown_waystation", {})
		var receipts: Dictionary = waystation.get("reward_receipts", {})
		_expect(receipts.has(source.key), "canonical receipt for " + String(source.id))
		await _use(ow, hero, point)
		_expect((_save().call(&"inventory_totals") as Dictionary) == after, "second activation cannot duplicate " + String(source.id))
	if await _walk_to(hero, nav, home, "ordinary input returns to the same paid home"):
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)

func _open_closed_doors(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability) -> bool:
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	if build == null:
		return true
	var structures: Dictionary = _survival().call(&"structures")
	var ids: Array = structures.keys()
	ids.sort()
	for value: Variant in ids:
		var id := String(value)
		var record: Dictionary = structures[id]
		if String(record.get("piece", "")) != "door_wood" or bool(record.get("door_open", false)):
			continue
		var node: Node2D = build.structure_node(id)
		if node == null:
			continue
		var door_cell := nav.cell_of(node.global_position + Vector2(8, 8))
		var approach := Vector2i(-9999, -9999)
		for step: Vector2i in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
			var candidate: Vector2i = door_cell + step
			if not _route(nav.cell_of(hero.global_position), candidate, nav, hero).is_empty():
				approach = candidate
				break
		if approach.x == -9999:
			continue
		if not await _walk_to(hero, nav, approach, "ordinary input approaches the closed home door"):
			return false
		await _use(ow, hero, node)
		var opened := bool(((_survival().call(&"structures") as Dictionary).get(id, {}) as Dictionary).get("door_open", false))
		_expect(opened, "ordinary pointer opens the home door before the roadside journey")
		if not opened:
			return false
	return true
