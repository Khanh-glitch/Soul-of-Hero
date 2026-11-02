extends "res://tests/survival_production_waystation_candidate_test.gd"
## Real controller + A1 stands + A3 V5, synthetic input in two processes.
## No fixtures grant rewards; this is NOT human or rendered acceptance.

func _test_label() -> String:
	return "A1 ROADSIDE V5 SYNTHETIC INPUT"

func _journey(ow: Node, hero: CharacterBody2D, host: Node, second: bool) -> void:
	var nav := ow.get(&"traversability") as OverworldTraversability
	var refuge := nav.cell_of(hero.global_position)
	var before: Dictionary = _save().call(&"inventory_totals")
	var expected := [
		{"id": "roadside_01", "stand": Vector2i(395, 220), "key": "a3src:r_ashen_crown:roadside_supply:01:claim:1", "items": {"research_notes": 1}},
		{"id": "roadside_02", "stand": Vector2i(400, 217), "key": "a3src:r_ashen_crown:roadside_supply:02:claim:1", "items": {"iron_scrap": 3, "knowledge_spares": 2}},
		{"id": "roadside_03", "stand": Vector2i(402, 221), "key": "a3src:r_ashen_crown:roadside_supply:03:claim:1", "items": {"oak_wood": 2, "research_notes": 1}},
	]
	for entry: Dictionary in expected:
		var point := host.get_node_or_null(str(entry.id).capitalize()) as Node2D
		_expect(point != null, "A1 physical source exists: " + str(entry.id))
		if point == null or not await _leg(hero, nav, entry.stand, "actual input reaches " + str(entry.id)):
			return
		var prior: Dictionary = _save().call(&"inventory_totals")
		await _click_point(ow, hero, point)
		var after: Dictionary = _save().call(&"inventory_totals")
		if second:
			_expect(after == prior, "restart/cooldown prevents extra grant: " + str(entry.id))
		else:
			for item: String in entry.items:
				_expect(int(after.get(item, 0)) == int(prior.get(item, 0)) + int(entry.items[item]), "exact authorized item " + item + " at " + str(entry.id))
			var snapshot: Dictionary = _save().call(&"get_snapshot")
			var receipts: Dictionary = snapshot.world_slice.pois.poi_crown_waystation.reward_receipts
			_expect(receipts.has(entry.key), "canonical receipt persisted: " + str(entry.id))
			await _click_point(ow, hero, point)
			_expect((_save().call(&"inventory_totals") as Dictionary) == after, "same physical object cannot double-grant: " + str(entry.id))
	if second:
		_expect((_save().call(&"inventory_totals") as Dictionary) == before, "all three preserve exact restart inventory")
	if not await _leg(hero, nav, refuge, "ordinary return from roadside sources"):
		return
	if not second:
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)
	_body_complete = true
