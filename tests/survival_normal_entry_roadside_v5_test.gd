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
		if not await _leg_to(hero, nav, source.stand, "ordinary input walks to " + String(source.id)):
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
	if await _leg_to(hero, nav, home, "ordinary input returns to the same paid home"):
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)

## Required B0 step 9: in the independent second OS process, walk back to a
## source that was already claimed in the first process and click it for real.
## It must grant nothing, add no receipt and lose no paid construction.
func _verify_restart() -> void:
	await super._verify_restart()
	if not is_instance_valid(_host) or _host.get_child_count() == 0:
		_expect(false, "restart rebuild offers a production world for the retry walk")
		return
	var ow := _host.get_child(0)
	var host := ow.get_node_or_null("WaystationRuntime")
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	_expect(host != null and hero != null and nav != null, "restart world owns the candidate host and Hero")
	if host == null or hero == null or nav == null:
		return
	var point := host.get_node_or_null("Roadside 01") as Node2D
	_expect(point != null, "claimed roadside object reconstructs in the second process")
	if point == null:
		return
	if not await _open_closed_doors(ow, hero, nav):
		_expect(false, "restart world keeps a traversable way out of the same paid home")
		return
	var before: Dictionary = _save().call(&"inventory_totals")
	var receipts_before := (_save().call(&"get_snapshot").get("world_slice", {}).get("pois", {}).get("poi_crown_waystation", {}).get("reward_receipts", {}) as Dictionary).size()
	if not await _leg_to(hero, nav, Vector2i(395, 220), "second process walks back to the already-claimed roadside_01"):
		return
	await _use(ow, hero, point)
	var after: Dictionary = _save().call(&"inventory_totals")
	var receipts_after := (_save().call(&"get_snapshot").get("world_slice", {}).get("pois", {}).get("poi_crown_waystation", {}).get("reward_receipts", {}) as Dictionary).size()
	_expect(after == before, "replayed roadside click in a new process grants no loot")
	_expect(receipts_after == receipts_before, "replayed roadside click in a new process writes no receipt")
	var structures: Dictionary = _survival().call(&"structures")
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var all_present := not structures.is_empty()
	for id: Variant in structures.keys():
		if build == null or build.structure_node(String(id)) == null:
			all_present = false
	_expect(all_present, "every paid structure still stands after the replay walk")
	print("ROADSIDE_REPLAY_SECOND_PROCESS inventory=%s receipts=%d structures=%d" % [str(after), receipts_after, structures.size()])
