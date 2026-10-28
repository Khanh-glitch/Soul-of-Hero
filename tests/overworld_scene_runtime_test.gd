extends "res://tests/overworld_runtime_case.gd"
## The scene builds: every layer is a real TileMapLayer with cells in it, the
## Knight is spawned with a camera bounded to the world, and the places exist.


func _body() -> void:
	var world: Node = ow.get("world")
	_expect(world != null, "OverworldWorld node exists")
	if world == null:
		return

	_expect_equal(int(world.get("width")), 384, "world width in tiles")
	_expect_equal(int(world.get("height")), 256, "world height in tiles")
	_expect(world.get("ground_layer") is TileMapLayer, "ground is a TileMapLayer")
	_expect(world.get("detail_layer") is TileMapLayer, "detail is a TileMapLayer")
	_expect(world.get("solid_layer") is TileMapLayer, "solid is a TileMapLayer")

	var ground_cells: int = (world.get("ground_layer") as TileMapLayer).get_used_cells().size()
	var detail_cells: int = (world.get("detail_layer") as TileMapLayer).get_used_cells().size()
	var solid_cells: int = (world.get("solid_layer") as TileMapLayer).get_used_cells().size()
	_expect(ground_cells >= 384 * 256, "ground painted every cell (%d)" % ground_cells)
	_expect(detail_cells > 3000, "detail layer has authored detail (%d)" % detail_cells)
	_expect(solid_cells > 10000, "solid layer has cliffs/trees/water (%d)" % solid_cells)

	# Collision is real: the solid layer must own a physics layer with cells.
	var tile_set := (world.get("solid_layer") as TileMapLayer).tile_set
	_expect(tile_set != null and tile_set.get_physics_layers_count() >= 1,
		"TileSet declares a physics layer")
	var blocked := 0
	for cell: Vector2i in (world.get("solid_layer") as TileMapLayer).get_used_cells():
		if world.call("is_solid_cell", cell.x, cell.y):
			blocked += 1
			if blocked > 200:
				break
	_expect(blocked > 200, "solid cells answer is_solid_cell()")

	_expect(world.call("prop_count") > 1500, "props instantiated (%d)" % int(world.call("prop_count")))
	var props_root: Node = world.get("props_root")
	_expect(props_root != null and props_root.get_parent() != null,
		"props hang off a live parent (y-sorted with the player)")
	_expect(props_root is Node2D and (props_root as Node2D).y_sort_enabled,
		"prop layer is y-sorted so the knight can walk behind a tower")

	var player: CharacterBody2D = ow.get("player")
	_expect(player != null, "knight spawned")
	if player != null:
		_expect(player.is_in_group(&"player"), "spawned node is in the player group")
		var camera := player.get_node_or_null("Camera") as Camera2D
		_expect(camera != null, "knight carries its Camera2D")
		if camera != null:
			_expect(camera.limit_right > camera.limit_left and camera.limit_bottom > camera.limit_top,
				"camera limits bound the world (%d..%d x %d..%d)"
				% [camera.limit_left, camera.limit_right, camera.limit_top, camera.limit_bottom])
		var tile: Vector2i = world.call("tile_of", player.global_position)
		_expect(not bool(world.call("is_solid_cell", tile.x, tile.y)),
			"knight spawns on walkable ground at %s" % tile)

	_expect((ow.get("gates") as Dictionary).size() == 10, "ten gates")
	_expect((ow.get("camps") as Dictionary).size() == 4, "four camps")
	_expect((ow.get("discoveries") as Dictionary).size() == 8, "eight discoveries")
	_expect(ow.get("hud") != null, "HUD mounted")

	# Every square metre has a named region, and the name comes from the world
	# document rather than a hard-coded string in the HUD.
	var regions: Array = ow.get("world_data").get("regions", [])
	_expect_equal(regions.size(), 10, "world document names ten regions")
	var labelled := 0
	for raw: Variant in regions:
		if raw is Dictionary and not String((raw as Dictionary).get("label", "")).is_empty():
			labelled += 1
	_expect_equal(labelled, 10, "every region carries a display label")
	var start: Array = (ow.get("world_data") as Dictionary).get("start_position", [56, 218])
	var refuge_cell := Vector2(float(start[0]) * 16.0 + 8.0, float(start[1]) * 16.0 + 8.0)
	var refuge_label := String(ow.call("region_at", refuge_cell))
	_expect(not refuge_label.is_empty(), "the refuge sits in a named region ('%s')" % refuge_label)
	var far_label := String(ow.call("region_at", Vector2(340, 240) * 16.0))
	_expect(not far_label.is_empty(), "the far south-east corner is in a named region ('%s')" % far_label)
	_expect(far_label != refuge_label, "regions actually differ across the map")
	_done()
