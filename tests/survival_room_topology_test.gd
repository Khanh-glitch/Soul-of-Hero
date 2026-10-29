extends "res://tests/survival_foundation_test.gd"

const TOPOLOGY_SCRIPT = preload("res://game/survival/survival_room_topology.gd")


func _finish() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL TOPOLOGY PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL TOPOLOGY FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _perimeter(left: int, top: int, width: int, height: int) -> Dictionary:
	var result: Dictionary = {}
	for y in range(top, top + height):
		for x in range(left, left + width):
			if x == left or x == left + width - 1 or y == top or y == top + height - 1:
				result["%d,%d" % [x, y]] = {"piece": "wall_wood", "cell": [x, y]}
	return result


func _body() -> void:
	print("[topology] bounded algorithm")
	var model = TOPOLOGY_SCRIPT.new()
	var walls := _perimeter(0, 0, 7, 5)
	for y in range(1, 4):
		walls["3,%d" % y] = {"piece": "wall_wood", "cell": [3, y]}
	model.rebuild(walls)
	_expect(model.rooms.size() == 2, "shared wall forms two independent rooms")
	var left_id: String = model.room_at(Vector2i(1, 2))
	var right_id: String = model.room_at(Vector2i(5, 2))
	_expect(not left_id.is_empty() and not right_id.is_empty() and left_id != right_id,
		"adjacent room ids differ")
	walls.erase("3,2")
	model.rebuild(walls)
	_expect(model.rooms.size() == 1 and model.room_at(Vector2i(1, 2)) == model.room_at(Vector2i(5, 2)),
		"demolishing a partition merges rooms")
	walls.erase("0,2")
	model.rebuild(walls)
	_expect(model.rooms.is_empty(), "breaching the exterior opens the merged space")
	# A diagonal gap between two sealing cells is not a watertight corner.
	walls = _perimeter(0, 0, 5, 5)
	walls.erase("0,0")
	model.rebuild(walls)
	_expect(model.rooms.is_empty(), "diagonal corner opening leaks")
	# An L-shaped interior is surrounded using its eight-neighbour boundary.
	var interior: Array[Vector2i] = [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(0, 2)]
	walls = {}
	for cell: Vector2i in interior:
		for offset: Vector2i in TOPOLOGY_SCRIPT.NEIGHBOURS:
			var edge: Vector2i = cell + offset
			if not interior.has(edge):
				walls["%d,%d" % [edge.x, edge.y]] = {"piece": "wall_wood", "cell": [edge.x, edge.y]}
	model.rebuild(walls)
	_expect(model.rooms.size() == 1 and not model.room_at(Vector2i(0, 2)).is_empty(), "nonrectangular enclosure")
	# Independent adversarial fixture: two closed homes separated by 5,000 cells.
	walls = _perimeter(0, 0, 5, 5)
	walls.merge(_perimeter(5000, 5000, 5, 5))
	model.rebuild(walls)
	print("[spatial] distant: rooms=%d scanned=%d overflow=%d" % [model.rooms.size(), model.scanned_cells, model.overflow_clusters])
	_expect(model.rooms.size() == 2 and model.scanned_cells < 100, "far buildings avoid global rectangle scan")
	var distant_id: String = model.room_at(Vector2i(5002, 5002))
	walls.erase("0,2")
	model.rebuild(walls)
	_expect(model.rooms.size() == 1 and model.room_at(Vector2i(5002, 5002)) == distant_id,
		"local edit preserves unrelated room identity")
	print("[spatial] after breach: rooms=%d rescanned=%d" % [model.rooms.size(), model.scanned_cells])
	_expect(model.scanned_cells < 50, "unchanged distant cluster uses cached topology")
	walls = _perimeter(0, 0, 130, 130)
	model.rebuild(walls)
	_expect(model.rooms.is_empty() and model.overflow_clusters == 1, "oversized scan fails closed")

	print("[topology] production overworld")
	var ow := _host.get_child(0)
	var build: SurvivalBuildSystem = ow.get(&"survival_build") as SurvivalBuildSystem
	var player: Node2D = ow.get(&"player") as Node2D
	var world: OverworldWorld = ow.get(&"world") as OverworldWorld
	var service := _survival()
	_clear_inventory()
	_expect(_give(WOOD, 45) and _give(IRON, 2), "materials granted through SaveService")
	build.select_piece("wall_wood")
	var origin := Vector2i(-1, -1)
	# Search real terrain and protected-world validation, moving the Hero to keep
	# placement within reach. No expected room state is injected into the save.
	for y in range(4, world.height - 4, 4):
		if origin.x >= 0:
			break
		for x in range(4, world.width - 4, 4):
			player.global_position = Vector2((x + 2) * 16 + 8, (y + 2) * 16 + 8)
			var valid := true
			for yy in range(4):
				for xx in range(4):
					if not build.validate_cell(Vector2i(x + xx, y + yy)).is_empty():
						valid = false
			if valid:
				origin = Vector2i(x, y)
				break
	_expect(origin.x >= 0, "found legal 4x4 footprint on production map")
	if origin.x < 0:
		_body_complete = true
		return
	var wall_to_remove := ""
	for yy in range(4):
		for xx in range(4):
			if xx != 0 and xx != 3 and yy != 0 and yy != 3:
				continue
			if xx == 1 and yy == 0:
				continue # leave one missing piece to test an incomplete perimeter
			var placed: Dictionary = build.try_place(origin + Vector2i(xx, yy))
			_expect(bool(placed.get("ok", false)), "paid perimeter piece %d,%d" % [xx, yy])
			if xx == 0 and yy == 1:
				wall_to_remove = String(placed.get("entity_id", ""))
	_expect(build.room_topology.room_at(origin + Vector2i(1, 1)).is_empty(), "open production perimeter is not a room")
	build.select_piece("door_wood")
	var door: Dictionary = build.try_place(origin + Vector2i(1, 0))
	_expect(bool(door.get("ok", false)), "paid door seals production boundary")
	var room_id: String = build.room_topology.room_at(origin + Vector2i(1, 1))
	_expect(not room_id.is_empty(), "closed production room derived from placed pieces")
	var interior_cell := origin + Vector2i(1, 1)
	build.select_piece("foundation_wood")
	var floor_result: Dictionary = build.try_place(interior_cell)
	build.select_piece("chest_wood")
	var chest_result: Dictionary = build.try_place(interior_cell)
	_expect(bool(floor_result.get("ok", false)) and bool(chest_result.get("ok", false)),
		"floor and chest occupy separate layers of one cell")
	_expect(not build.entity_at_layer(interior_cell, "floor").is_empty() and not build.entity_at_layer(interior_cell, "object").is_empty(),
		"both occupancy layers materialized")
	var wood_before_duplicate := _count(WOOD)
	var duplicate: Dictionary = build.try_place(interior_cell)
	_expect(not bool(duplicate.get("ok", false)) and _count(WOOD) == wood_before_duplicate,
		"second object on the same cell is rejected without charging")
	_expect(_give(IRON, 1) and _give(STONE, 3), "materials for a second chest and storage test granted")
	var second_chest: Dictionary = build.try_place(origin + Vector2i(2, 1))
	var chest_one_id := String(chest_result.get("entity_id", ""))
	var chest_two_id := String(second_chest.get("entity_id", ""))
	_expect(bool(second_chest.get("ok", false)) and chest_one_id != chest_two_id,
		"two chests have distinct persistent identities")
	_expect(bool(service.call(&"transfer_to_container", chest_one_id, STONE, 1, "survival.test.room.chest1")),
		"deposit into first indoor chest")
	_expect(bool(service.call(&"transfer_to_container", chest_two_id, STONE, 2, "survival.test.room.chest2")),
		"deposit into second indoor chest")
	_expect(int((service.call(&"container_contents", chest_one_id) as Dictionary).get(STONE, 0)) == 1
		and int((service.call(&"container_contents", chest_two_id) as Dictionary).get(STONE, 0)) == 2,
		"two chests hold independent contents")
	_expect(build.structure_node(wall_to_remove).get_node_or_null("Solid") != null, "real wall collider exists")
	_expect(bool(_save().call(&"reload_save")), "disk save reloaded")
	ow = await _reload_world(ow)
	_expect(ow != null, "production overworld rebuilt")
	if ow == null:
		_body_complete = true
		return
	build = ow.get(&"survival_build") as SurvivalBuildSystem
	_expect(build.room_topology.room_at(interior_cell) == room_id, "room id stable after reload")
	_expect(int((service.call(&"container_contents", chest_one_id) as Dictionary).get(STONE, 0)) == 1
		and int((service.call(&"container_contents", chest_two_id) as Dictionary).get(STONE, 0)) == 2,
		"distinct chest contents survive disk reload")
	_expect(not build.entity_at_layer(interior_cell, "floor").is_empty() and not build.entity_at_layer(interior_cell, "object").is_empty(),
		"floor and furniture survive reload")
	# Fill through the real inventory API until capacity refuses the next stack.
	var fillers: Array[String] = []
	for index in range(35):
		var item := "room_filler_%02d" % index
		if not _give(item, 50):
			break
		fillers.append(item)
	_expect(not fillers.is_empty() and fillers.size() < 35, "real bag reaches capacity")
	var refused: bool = bool(service.call(&"transfer_from_container", chest_one_id, STONE, 1, "survival.test.room.fullbag"))
	_expect(not refused and int((service.call(&"container_contents", chest_one_id) as Dictionary).get(STONE, 0)) == 1,
		"full bag refuses withdrawal without losing chest contents")
	if not fillers.is_empty():
		_expect(bool(_save().call(&"consume_inventory_item", fillers[0], 50, "survival.test.room.free_slot")),
			"free one real inventory slot")
		var key := "survival.test.room.same_command"
		_expect(bool(service.call(&"transfer_from_container", chest_one_id, STONE, 1, key)), "keyed withdrawal succeeds")
		_expect(not bool(service.call(&"transfer_from_container", chest_one_id, STONE, 1, key)) and _count(STONE) == 1,
			"replaying one keyed transfer cannot duplicate items")
		_expect(bool(service.call(&"transfer_to_container", chest_one_id, STONE, 1, "survival.test.room.restore")),
			"restore item with a distinct command")
	_expect(bool(service.call(&"remove_structure", wall_to_remove)), "production wall demolition committed")
	await process_frame
	await physics_frame
	_expect(build.room_topology.room_at(interior_cell).is_empty(), "demolition removes enclosure")
	_expect(build.structure_node(wall_to_remove) == null, "demolition removes collision node")
	_expect(int((service.call(&"container_contents", chest_one_id) as Dictionary).get(STONE, 0)) == 1
		and int((service.call(&"container_contents", chest_two_id) as Dictionary).get(STONE, 0)) == 2,
		"breaching room preserves both occupied chests")
	_body_complete = true
