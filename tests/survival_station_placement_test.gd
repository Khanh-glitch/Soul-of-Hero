extends "res://tests/survival_foundation_test.gd"
## Actual overworld / SaveService test. The economy service and clock are not
## wired by this placement increment; this test is not E-02 completion.

func _finish() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL STATION PLACEMENT PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL STATION PLACEMENT FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _body() -> void:
	var ow := _host.get_child(0)
	var build: SurvivalBuildSystem = ow.get(&"survival_build")
	var hero: CharacterBody2D = ow.get(&"player")
	var world: OverworldWorld = ow.get(&"world")
	var svc := _survival()
	_clear_inventory()
	hero.set_physics_process(false)
	_expect(build.select_piece("station_furnace"), "furnace is a selectable actual build piece")
	var origin := Vector2i(-1, -1)
	for y in range(6, world.height - 7, 4):
		if origin.x >= 0:
			break
		for x in range(6, world.width - 7, 4):
			hero.global_position = Vector2(x * 16 + 8, y * 16 + 8)
			var candidate := Vector2i(x, y)
			if build.validate_cell(candidate).is_empty() and build.validate_cell(candidate + Vector2i(2, 0)).is_empty():
				origin = candidate
				break
	_expect(origin.x >= 0, "free multi-cell terrain found in real world")
	if origin.x < 0:
		_body_complete = true
		return
	var unpaid: Dictionary = build.try_place(origin, "station.test.unpaid")
	_expect(not bool(unpaid.get("ok", false)) and _count("furnace_kit") == 0, "unpaid station cannot be placed")
	_expect(_give("furnace_kit", 2), "station kit placed in sole inventory")
	var no_world: Dictionary = svc.call(&"place_structure", "station_furnace", origin, "station.test.no.world")
	_expect(not bool(no_world.get("ok", false)) and _count("furnace_kit") == 2, "station requires live world validator")
	var purchased := build.try_place(origin, "station.test.furnace")
	var id := String(purchased.get("entity_id", ""))
	_expect(bool(purchased.get("ok", false)) and _count("furnace_kit") == 1 and not id.is_empty(), "kit payment and station identity commit together")
	var station: Dictionary = svc.call(&"resolve_station", id)
	_expect(station.get("kind", "") == "furnace" and int(station.get("tier", 0)) == 1 and int(station.get("queue_capacity", 0)) == 3 and bool(station.get("operational", false)), "resolver reads real durable station identity and attributes")
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.RIGHT, Vector2i.DOWN, Vector2i.ONE]:
		_expect(build.entity_at_layer(origin + offset, "object") == id, "station owns footprint cell %s" % str(offset))
	var placed := build.structure_node(id)
	var collision := placed.get_node_or_null("Solid/CollisionShape2D") as CollisionShape2D
	_expect(collision != null and (collision.shape as RectangleShape2D).size == Vector2(30, 26), "real collision covers 2x2 footprint")
	var overlap := build.try_place(origin + Vector2i.RIGHT, "station.test.overlap")
	_expect(not bool(overlap.get("ok", false)) and _count("furnace_kit") == 1, "overlap in non-origin cell rejected without payment")
	build.select_piece("wall_wood")
	_expect(_give(WOOD, 4), "wall material granted")
	var wall := build.try_place(origin + Vector2i.ONE, "station.test.wall.overlap")
	_expect(not bool(wall.get("ok", false)) and _count(WOOD) == 4, "single-cell piece cannot overlap station footprint")
	var direct_wall: Dictionary = svc.call(&"place_structure", "wall_wood", origin + Vector2i.ONE, "station.test.direct.overlap")
	_expect(not bool(direct_wall.get("ok", false)) and _count(WOOD) == 4, "candidate transaction independently refuses overlap with non-origin cell")
	build.select_piece("foundation_wood")
	var floor_result := build.try_place(origin + Vector2i.ONE, "station.test.floor")
	_expect(bool(floor_result.get("ok", false)) and build.entity_at_layer(origin + Vector2i.ONE, "floor") != "", "floor may coexist below station")
	_expect(bool(_save().call(&"reload_save")), "reload durable station and floor")
	ow = await _reload_world(ow)
	build = ow.get(&"survival_build")
	_expect(build.entity_at_layer(origin + Vector2i.ONE, "object") == id and (svc.call(&"resolve_station", id) as Dictionary).get("station_revision", "") == "placed:" + id, "reload preserves footprint identity and station revision")
	_expect(bool(svc.call(&"remove_structure", id)), "demolish station through authoritative transaction")
	await process_frame
	_expect((svc.call(&"resolve_station", id) as Dictionary).is_empty(), "removed station is not resolvable")
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.RIGHT, Vector2i.DOWN, Vector2i.ONE]:
		_expect(build.entity_at_layer(origin + offset, "object").is_empty(), "demolition clears footprint cell %s" % str(offset))
	_expect(not build.entity_at_layer(origin + Vector2i.ONE, "floor").is_empty(), "demolition preserves floor underneath")
	for pair: Array in [["workbench", 2, 1, 3], ["research", 2, 2, 2], ["garden", 2, 2, 2], ["furnace", 2, 2, 3]]:
		var definition: Dictionary = svc.call(&"piece_definition", "station_" + String(pair[0]))
		var footprint: Array = definition.get("footprint", [])
		_expect(footprint.size() == 2 and int(footprint[0]) == int(pair[1]) and int(footprint[1]) == int(pair[2]) and int(definition.get("queue_capacity", 0)) == int(pair[3]), "station footprint and capacity match pinned A3: " + String(pair[0]))
	_body_complete = true
