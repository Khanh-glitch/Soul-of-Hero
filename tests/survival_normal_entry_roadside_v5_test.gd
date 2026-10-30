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
	var sources := [
		{"id": "roadside_01", "stand": Vector2i(395, 220), "key": "a3src:r_ashen_crown:roadside_supply:01:claim:1", "items": {"research_notes": 1}},
		{"id": "roadside_02", "stand": Vector2i(400, 217), "key": "a3src:r_ashen_crown:roadside_supply:02:claim:1", "items": {"iron_scrap": 3, "knowledge_spares": 2}},
		{"id": "roadside_03", "stand": Vector2i(402, 221), "key": "a3src:r_ashen_crown:roadside_supply:03:claim:1", "items": {"oak_wood": 2, "research_notes": 1}},
	]
	for source: Dictionary in sources:
		var point := host.get_node_or_null(String(source.id).capitalize()) as Node2D
		_expect(point != null, "authored roadside object exists in the live world: " + String(source.id))
		if point == null or not await _walk_to(hero, nav, source.stand, "ordinary input walks to " + String(source.id)):
			return
		var prior: Dictionary = _save().call(&"inventory_totals")
		await _use(ow, hero, point)
		var after: Dictionary = _save().call(&"inventory_totals")
		for item: String in source.items:
			_expect(int(after.get(item, 0)) == int(prior.get(item, 0)) + int(source.items[item]), "exact A3 item " + item + " from " + String(source.id))
		var snapshot: Dictionary = _save().call(&"get_snapshot")
		_expect((((snapshot.get("world_slice", {}) as Dictionary).get("pois", {}) as Dictionary).get("poi_crown_waystation", {}) as Dictionary).get("reward_receipts", {}) as Dictionary).has(source.key), "canonical receipt for " + String(source.id))
		await _use(ow, hero, point)
		_expect((_save().call(&"inventory_totals") as Dictionary) == after, "second activation cannot duplicate " + String(source.id))
	if await _walk_to(hero, nav, home, "ordinary input returns to the same paid home"):
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)
