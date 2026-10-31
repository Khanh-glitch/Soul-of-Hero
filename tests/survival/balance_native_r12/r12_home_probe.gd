extends "res://tests/survival/balance_native_r12/r12_harness.gd"
## R12HOME — "a paid physical home": foundation, walls, roof, chest, bed, workshop.
##
## The product contract says the home is built from pieces the player pays for, in
## the world, and that storage is a physical cabinet rather than a GUI list. That
## is measurable without a rasterizer: every placement goes through the shipped
## `select_piece` + `try_place` door, every committed piece must appear in the
## economy document, the roof layer must derive a footprint from the same topology,
## a chest must move real stacks, and a station recipe must be refused when the
## player is not standing at the station.
##
## What is a fixture: the materials. `FIXTURE_GRANT` is printed on every grant, and
## the probe never presents a grant as a harvest. What is real: the cost, the
## occupancy rules, the room topology, the station range gate, the transactions.
##
## Not claimed: that the house looks like a house. The roof and wall art are
## developer placeholders (`SurvivalRoofLayer` says so in its own header) and no
## pixel verdict is possible here (R12VIS).

const PREFERRED_RADIUS := 2      # 5x5 perimeter -> 3x3 interior
const FALLBACK_RADIUS := 1       # 3x3 perimeter -> 1 interior cell (still a room)
const OAK_NEEDED := 60
const IRON_NEEDED := 30


func _body() -> void:
	probe_id = "R12HOME"
	probe_title = "home: paid pieces, an actual room, a derived roof, a chest transfer and a station-gated recipe"
	owner_action = (
		"A0 (arena_dea2428e, 21c37aec): the pieces and the roof exist; what is missing is the player-facing sequence — "
		+ "no recipe, tutorial or prompt tells the player that walls must be placed before a bed, and the roof is a "
		+ "developer placeholder with no art review. A3/AVFX own the placeholder art replacement. Keep the fail-closed "
		+ "placement reasons; they are the only truthful feedback the player has."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a survival build system in the shipped world", "chapter1_overworld.survival_build")
		_done()
		return

	# FIXTURE_GRANT: the house's material cost, paid from a fixture bag, not a harvest.
	var oak := _grant_item("oak_wood", OAK_NEEDED, "a7_r12_home_oak")
	var iron := _grant_item("iron_scrap", IRON_NEEDED, "a7_r12_home_iron")
	var kit := _grant_item("workbench_kit", 1, "a7_r12_home_kit")
	_note("FIXTURE_GRANT oak=%s(%d) iron=%s(%d) workbench_kit=%s(%d)" % [
		str(oak), _count_item("oak_wood"), str(iron), _count_item("iron_scrap"), str(kit), _count_item("workbench_kit"),
	])
	if not oak or not iron:
		_block("the fixture could not place the house's materials in the bag")
		_done()
		return

	var plot := await _find_plot(build)
	var origin: Vector2i = plot["origin"]
	var radius := int(plot["radius"])
	if origin == Vector2i(-1, -1):
		_missing("a legal plot inside build range", "every candidate ring was refused by validate_cell")
		_done()
		return
	_note("house origin=%s radius=%d hero=%s" % [str(origin), radius, str(_hero_cell())])

	_walls(build, origin, radius)
	var room: Array = await _room(build, origin, radius)
	_floor(build, origin, radius)
	_bed(build, origin, room)
	var chest_id := _chest(build, origin, radius)
	_chest_transfer(mounted, chest_id)
	await _workshop(mounted, build, origin, radius)

	_done()


# ------------------------------------------------------------------ 1. search
## A plot the product accepts for walls *and* floors. The spawn area is heavily
## protected (A0 refuses `protected_place` on the spawn ring), so a player walks a
## little before building. The probe does the same with real keys, then scans; a
## 5x5 house is preferred and a 3x3 room is the fallback, because "my first house"
## should not depend on finding a 25-cell clearing next to the bed.
func _find_plot(build: Node) -> Dictionary:
	for attempt in 5:
		for radius: int in [PREFERRED_RADIUS, FALLBACK_RADIUS]:
			var origin := _scan_plot(build, radius)
			if origin != Vector2i(-1, -1):
				return {"origin": origin, "radius": radius}
		if attempt < 4:
			await _walk_for_space(attempt)
	return {"origin": Vector2i(-1, -1), "radius": 0}


func _scan_plot(build: Node, radius: int) -> Vector2i:
	var hero_cell := _hero_cell()
	for r in range(1, 7):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var center := hero_cell + Vector2i(dx, dy)
				if _plot_is_free(build, center, radius):
					return center
	return Vector2i(-1, -1)


func _plot_is_free(build: Node, center: Vector2i, radius: int) -> bool:
	# The walls must be legal at every perimeter cell...
	if not bool(build.call(&"select_piece", "wall_wood")):
		return false
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if maxi(absi(dx), absi(dy)) != radius:
				continue
			if not String(build.call(&"validate_cell", center + Vector2i(dx, dy))).is_empty():
				return false
	# ...and a floor must fit inside, so the plot is not a walled hole.
	if not bool(build.call(&"select_piece", "foundation_wood")):
		return false
	for dy in range(-radius + 1, radius):
		for dx in range(-radius + 1, radius):
			if not String(build.call(&"validate_cell", center + Vector2i(dx, dy))).is_empty():
				return false
	return true


## Real movement toward open ground: four directions, one per attempt. This is the
## same input path a player uses; nothing is teleported.
func _walk_for_space(attempt: int) -> void:
	var directions := [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]
	var step: Vector2 = directions[attempt % directions.size()] * 160.0
	await _walk_toward_point(hero.global_position + step, 420, 18.0)
	_note("walked toward %s for open ground; now at %s" % [str(step), str(_hero_cell())])


# ------------------------------------------------------------------- 2. walls
func _walls(build: Node, origin: Vector2i, radius: int) -> void:
	var placed := 0
	var refused: Array[String] = []
	var perimeter := 8 * radius
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if maxi(absi(dx), absi(dy)) != radius:
				continue
			var cell := origin + Vector2i(dx, dy)
			var result := _place(build, "wall_wood", cell)
			if bool(result.get("ok", false)):
				placed += 1
			else:
				refused.append("%s:%s" % [str(cell), String(result.get("reason", "?"))])
	_note("walls placed=%d/%d refused=%s" % [placed, perimeter, str(refused.slice(0, 4))])
	_expect(placed == perimeter,
		"a player can pay for and place a closed wall ring (%d/%d)" % [placed, perimeter])
	var structures: Dictionary = _survival().call(&"structures") as Dictionary
	var wall_records := 0
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == "wall_wood":
			wall_records += 1
	_expect(wall_records >= placed,
		"every placed wall is a committed structure record (%d records / %d placed)" % [wall_records, placed])


# -------------------------------------------------------------------- 3. room
func _room(build: Node, origin: Vector2i, radius: int) -> Array:
	var topology: Variant = build.get(&"room_topology")
	if topology == null:
		_missing("room topology derived from walls", "survival_build_system.room_topology")
		return []
	# `room_at` returns the room's stable id, not its cells; the cells live in
	# `rooms[id]`. Reading it as an Array was a probe bug in the first pass of this
	# round and is fixed here rather than being reported as a product defect.
	var room_id := String(topology.call(&"room_at", origin))
	var rooms: Dictionary = topology.get(&"rooms") if topology.get(&"rooms") is Dictionary else {}
	var room: Array = rooms.get(room_id, []) if not room_id.is_empty() else []
	var expected := (2 * radius - 1) * (2 * radius - 1)
	_note("room_at(%s) -> id=%s with %d interior cells (expected at least %d)"
		% [str(origin), room_id if not room_id.is_empty() else "<none>", room.size(), expected])
	_expect(not room_id.is_empty() and room.size() >= expected,
		"the closed ring yields a real interior the product can reason about (%d/%d cells)"
		% [room.size(), expected])
	var roof: Node = build.get(&"roof_layer")
	if roof == null:
		_missing("a roof layer derived from the same topology", "survival_build_system.roof_layer")
	else:
		# The roof derives its geometry in `_process` on a topology revision, so a
		# read in the same frame as the last wall is a race, not a finding.
		await _wait_seconds(0.3)
		var footprints: Variant = roof.get(&"_footprints")
		var count: int = (footprints as Dictionary).size() if footprints is Dictionary else -1
		var alpha_row: Array[String] = []
		var alpha_max := -1.0
		var room_ids: Array = rooms.keys()
		for raw_id: Variant in room_ids:
			var value := float(roof.call(&"alpha_for", String(raw_id)))
			alpha_row.append("%s=%.2f" % [String(raw_id).substr(0, 8), value])
			alpha_max = maxf(alpha_max, value)
		_note("roof layer footprints=%d visible=%s alphas=%s"
			% [count, str(roof.get(&"visible")), str(alpha_row)])
		if count <= 0:
			_missing("a roof drawn over a finished room",
				"SurvivalRoofLayer._footprints is empty after a frame for a closed ring")
		else:
			_expect(alpha_max > 0.5,
				"a roof over a room the player is not standing in is drawn (alpha %.2f)" % alpha_max)
	return room


# ------------------------------------------------------------------- 4. floor
func _floor(build: Node, origin: Vector2i, radius: int) -> void:
	var placed := 0
	var expected := (2 * radius - 1) * (2 * radius - 1)
	for dy in range(-radius + 1, radius):
		for dx in range(-radius + 1, radius):
			var result := _place(build, "foundation_wood", origin + Vector2i(dx, dy))
			if bool(result.get("ok", false)):
				placed += 1
	_note("interior floors placed=%d/%d" % [placed, expected])
	_expect(placed == expected,
		"the interior can be floored one paid piece at a time (%d/%d)" % [placed, expected])


# --------------------------------------------------------------------- 5. bed
func _bed(build: Node, origin: Vector2i, room: Array) -> void:
	if room.is_empty():
		# Capture the product's own refusal rather than skipping silently.
		var probe := _place(build, "bed_wood", origin)
		_note("bed placement attempted without a room -> ok=%s reason=%s"
			% [str(probe.get("ok", false)), String(probe.get("reason", ""))])
		_missing("a bed a player can place",
			"no room was derived, so the product's own reason applies: %s" % String(probe.get("reason", "?")))
		return
	var result := _place(build, "bed_wood", origin)
	_note("bed placement -> ok=%s reason=%s" % [str(result.get("ok", false)), String(result.get("reason", ""))])
	_expect(bool(result.get("ok", false)), "the bed can be placed inside the finished room")
	if not bool(result.get("ok", false)):
		_missing("a placeable bed (the run's respawn anchor)", String(result.get("reason", "?")))
		return
	var entity_id := String(result.get("entity_id", ""))
	var service := _survival()
	if service != null and service.has_method(&"activate_bed"):
		var activated: Dictionary = service.call(&"activate_bed", entity_id,
			func() -> bool: return true) as Dictionary
		_note("activate_bed(%s) -> %s" % [entity_id, str(activated)])
		_expect(bool(activated.get("ok", false)),
			"the bed becomes the run's spawn anchor through its own transaction")
		var anchor := String((service.call(&"document") as Dictionary).get("spawn_anchor", ""))
		_expect(anchor == entity_id, "the spawn anchor is the bed the player slept in (%s)" % anchor)


# ------------------------------------------------------------------- 6. chest
func _chest(build: Node, origin: Vector2i, radius: int) -> String:
	# Outside the ring, next to the house: a chest is furniture, not a wall cell.
	# The spawn surroundings are protected, so the cell is chosen by the product's
	# own validator instead of a fixed offset.
	var cell := _free_place_cell(build, "chest_wood", origin, radius + 1, 6)
	if cell == Vector2i(-1, -1):
		_missing("a legal cell for a storage chest", "validate_cell refused every cell near the house")
		return ""
	var result := _place(build, "chest_wood", cell)
	_note("chest placement at %s -> ok=%s reason=%s" % [str(cell), str(result.get("ok", false)), String(result.get("reason", ""))])
	_expect(bool(result.get("ok", false)), "a storage chest can be placed inside the room")
	return String(result.get("entity_id", "")) if bool(result.get("ok", false)) else ""


func _chest_transfer(mounted: Node, chest_id: String) -> void:
	if chest_id.is_empty():
		_missing("a physical storage container", "no chest entity id")
		return
	var service := _survival()
	var before_bag := _count_item("oak_wood")
	var deposited: Dictionary = service.call(&"deposit_all", chest_id) as Dictionary
	var stored: Dictionary = service.call(&"container_contents", chest_id) as Dictionary
	var after_bag := _count_item("oak_wood")
	_note("deposit_all(%s) -> ok=%s moved=%s; bag oak %d->%d; chest=%s"
		% [chest_id, str(deposited.get("ok", false)), str(deposited.get("moved", {})), before_bag, after_bag, str(stored)])
	_expect(bool(deposited.get("ok", false)), "the chest accepts a real deposit")
	_expect(not stored.is_empty(), "the chest's contents are readable as physical storage (%d item ids)" % stored.size())
	_expect(after_bag < before_bag or int(stored.get("oak_wood", 0)) > 0,
		"the deposited oak left the bag and lives in the chest (bag %d->%d, chest oak %d)"
		% [before_bag, after_bag, int(stored.get("oak_wood", 0))])
	var withdrawn: Dictionary = service.call(&"withdraw_all", chest_id) as Dictionary
	var bag_after := _count_item("oak_wood")
	var chest_after: Dictionary = service.call(&"container_contents", chest_id) as Dictionary
	_note("withdraw_all -> ok=%s; bag oak %d; chest=%s" % [str(withdrawn.get("ok", false)), bag_after, str(chest_after)])
	_expect(bag_after >= before_bag and chest_after.is_empty(),
		"withdrawing returns the whole stack to the bag and empties the chest (bag %d, %d ids left)"
		% [bag_after, chest_after.size()])


## A cell the product's own `validate_cell` accepts for `piece`, searched outward
## from the house. `select_piece` is called first because the validator reads the
## currently selected piece, exactly as the HUD does.
func _free_place_cell(build: Node, piece: String, origin: Vector2i, from_radius: int, to_radius: int) -> Vector2i:
	if not bool(build.call(&"select_piece", piece)):
		return Vector2i(-1, -1)
	for r in range(from_radius, to_radius + 1):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var cell := origin + Vector2i(dx, dy)
				if String(build.call(&"validate_cell", cell)).is_empty():
					return cell
	return Vector2i(-1, -1)


# ---------------------------------------------------------------- 7. workshop
func _workshop(mounted: Node, build: Node, origin: Vector2i, radius: int) -> void:
	var economy := _a3()
	if economy == null:
		_missing("an economy session in the shipped world", "chapter1_overworld.economy_session")
		return
	# Before any station exists the same recipe must be refused: that is the gate
	# that makes a workshop physical rather than a menu.
	var early: Dictionary = economy.call(&"queue_recipe", "make_parts", "workbench") as Dictionary
	_note("queue_recipe(make_parts, workbench) before a station -> ok=%s reason=%s"
		% [str(early.get("ok", false)), String(early.get("reason", ""))])
	_expect(not bool(early.get("ok", false)),
		"a station recipe is refused while no station exists (%s)" % String(early.get("reason", "")))
	var station_cell := _free_place_cell(build, "station_workbench", origin, radius + 1, 6)
	if station_cell == Vector2i(-1, -1):
		_missing("a legal cell for the workbench", "validate_cell refused every cell near the house")
		return
	var kit_before := _count_item("workbench_kit")
	var result := _place(build, "station_workbench", station_cell)
	var kit_after := _count_item("workbench_kit")
	_note("workbench placement at %s -> ok=%s reason=%s kit %d->%d"
		% [str(station_cell), str(result.get("ok", false)), String(result.get("reason", "")), kit_before, kit_after])
	# "Paid" is the whole promise: a placed station that leaves the kit in the bag
	# is a free structure. A0's own `tests/survival_normal_input_gather_test.gd`
	# fails this same clause in this composition, so it is measured here too.
	if bool(result.get("ok", false)):
		# Payment is only owed when the placement committed; a refused cell must not
		# consume a kit, so the assertion is scoped to the committed case.
		_expect(kit_after < kit_before,
			"placing the workbench consumes the kit the player paid (%d -> %d)" % [kit_before, kit_after])
	else:
		_expect(kit_after == kit_before,
			"a refused placement does not consume the kit (%d -> %d)" % [kit_before, kit_after])
	if not bool(result.get("ok", false)):
		_missing("a placeable workbench", String(result.get("reason", "?")))
		return
	var station_id := String(result.get("entity_id", ""))
	var resolved: Dictionary = _survival().call(&"resolve_station", station_id) as Dictionary
	_note("resolve_station(%s) -> %s" % [station_id, str(resolved)])
	_expect(bool(resolved.get("ok", false)) and String(resolved.get("kind", "")) == "workbench",
		"the placed station resolves as a workbench with its own receipt")
	# FIXTURE_GRANT: the recipe input. `weave_cloth` is a shipped workbench recipe
	# whose input (`reed_fibre`) is in the survival catalogue, so the station gate
	# is what is measured rather than a missing item.
	var granted := _grant_item("reed_fibre", 6, "a7_r12_home_reed")
	_note("FIXTURE_GRANT reed_fibre=%s (%d)" % [str(granted), _count_item("reed_fibre")])
	# The range gate is real: the same call fails from further than 64 px.
	var away := await _walk_toward_point(hero.global_position + Vector2(160, 0), 700, 20.0)
	var far_distance := hero.global_position.distance_to(Vector2(station_cell.x * 16 + 16, station_cell.y * 16 + 16))
	var far: Dictionary = economy.call(&"queue_recipe", "weave_cloth", station_id) as Dictionary
	_note("walked away (%s) to %.0f px; queue_recipe -> ok=%s reason=%s"
		% [str(away), far_distance, str(far.get("ok", false)), String(far.get("reason", ""))])
	_expect(not bool(far.get("ok", false)),
		"the workshop cannot be used from across the map at %.0f px (%s)"
		% [far_distance, String(far.get("reason", ""))])
	# Walk back and buy it standing at the bench.
	var stand := await _reach_station(station_cell)
	_note("stand cell for the station: %s" % str(stand))
	var near: Dictionary = economy.call(&"queue_recipe", "weave_cloth", station_id) as Dictionary
	_note("queue_recipe at the station -> ok=%s reason=%s"
		% [str(near.get("ok", false)), String(near.get("reason", ""))])
	_expect(bool(near.get("ok", false)),
		"standing at the workbench admits its recipe (%s)" % String(near.get("reason", "")))


## Walk to a cell next to the station and report where the body ended up. The walk
## is ordinary input; a failure is a fact about reachability, not about the walker.
func _reach_station(cell: Vector2i) -> Vector2i:
	var target := Vector2(cell.x * 16 + 16, cell.y * 16 + 16)
	await _walk_toward_point(target, 900, 26.0)
	return _hero_cell()
