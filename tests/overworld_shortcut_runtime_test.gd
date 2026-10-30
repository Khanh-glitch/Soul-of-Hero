extends "res://tests/overworld_runtime_case.gd"
## Shortcuts are world surgery: opening one clears the collision that blocked it,
## swaps the prop to its crossing frame, and stays open across a rebuild.


func _body() -> void:
	var world: Node = ow.get("world")
	var state: RefCounted = ow.get("state")
	if world == null or state == null:
		_expect(false, "world and state available")
		return
	var shortcuts: Array = (ow.get("world_data") as Dictionary).get("shortcuts", [])
	_expect(shortcuts.size() == 4, "four authored shortcuts")

	# The carve boxes are the collision the world itself opens; asking the world
	# where they are keeps this test honest if the geography is re-authored.
	var carve_boxes: Dictionary = world.call("shortcut_carve_boxes")
	_expect(carve_boxes.size() == 4, "world reads four authored carve boxes")
	_expect_equal((carve_boxes[String(shortcuts[0]["id"])] as Array).size(), 4,
		"carve boxes are [x0, y0, x1, y1]")
	for entry: Dictionary in shortcuts:
		var shortcut_id := StringName(String(entry.get("id", "")))
		var box: Array = carve_boxes.get(String(shortcut_id), [])
		if box.size() < 4:
			_expect(false, "%s has a carve box" % shortcut_id)
			continue
		# box is [x0, y0, x1, y1] — centre, not x0 + width/2.
		var probe := Vector2i(
			(int(box[0]) + int(box[2])) / 2,
			(int(box[1]) + int(box[3])) / 2
		)
		var closed := bool(world.call("is_solid_cell", probe.x, probe.y))
		_expect(closed, "%s starts blocked at %s" % [shortcut_id, probe])

		# The gate that earns it must be the authored level.
		var granted_by := StringName(String(entry.get("granted_by", "")))
		_expect(String(granted_by).begins_with("chapter_1_level_"),
			"%s names the level that opens it (%s)" % [shortcut_id, granted_by])

		state.call("open_shortcut", shortcut_id)
		await _frames(2)
		_expect(not bool(world.call("is_solid_cell", probe.x, probe.y)),
			"%s carved collision at %s once open" % [shortcut_id, probe])
		_expect(bool(state.call("is_shortcut_open", shortcut_id, root.get_node_or_null("AppFlow"))),
			"%s records as open" % shortcut_id)
		var frame := _sprite_frame(world, shortcut_id)
		var open_suffixes := ["_fixed", "_on", "_cleared", "_open"]
		var swapped := frame.begins_with("short_")
		for suffix: String in open_suffixes:
			if frame.ends_with(suffix):
				swapped = true
		_expect(swapped, "%s sprite swapped to its crossing frame (frame '%s')"
			% [shortcut_id, frame])

	# Opening is idempotent and never re-carves into a different shape.
	var first_open: Dictionary = (world.get("_shortcut_open") as Dictionary).duplicate()
	state.call("open_shortcut", &"short_crucible_bridge")
	await _frames(2)
	_expect_equal((world.get("_shortcut_open") as Dictionary).size(), first_open.size(),
		"re-opening a shortcut changes nothing")
	_expect_equal(_sprite_frame(world, &"short_crucible_bridge"), first_open_frame(world),
		"the crossing frame is stable across repeat opens")

	# Closing restores the exact terrain that was carved away. Capture the token
	# from a *closed* band first, otherwise we would be comparing open to open.
	var bridge_box: Array = carve_boxes["short_crucible_bridge"]
	var bridge_cell := Vector2i(int(bridge_box[0]) + 1, int(bridge_box[1]) + 1)
	world.call("set_shortcut_open", "short_crucible_bridge", false)
	await _frames(2)
	var carved_token := _solid_token(world, bridge_cell)
	_expect(not carved_token.is_empty() and carved_token != ".",
		"the closed band holds a real terrain token ('%s')" % carved_token)
	world.call("set_shortcut_open", "short_crucible_bridge", true)
	await _frames(2)
	_expect(not bool(world.call("is_solid_cell", bridge_cell.x, bridge_cell.y)),
		"re-opening clears that same cell")
	world.call("set_shortcut_open", "short_crucible_bridge", false)
	await _frames(2)
	_expect(bool(world.call("is_solid_cell", bridge_cell.x, bridge_cell.y)),
		"closing a shortcut puts its collision back")
	_expect_equal(_solid_token(world, bridge_cell), carved_token,
		"closing restores the original terrain token, not a guess")
	world.call("set_shortcut_open", "short_crucible_bridge", true)
	await _frames(2)
	_done()


func _sprite_frame(world: Node, shortcut_id: StringName) -> String:
	var sprites: Dictionary = world.get("_shortcut_sprites")
	var list: Array = sprites.get(String(shortcut_id), [])
	if list.is_empty():
		return ""
	var sprite: Sprite2D = list[0]
	if not is_instance_valid(sprite) or not sprite.texture is AtlasTexture:
		return ""
	var region := (sprite.texture as AtlasTexture).region
	var meta: Dictionary = world.get("props_meta")
	for frame_name: String in meta:
		var info: Dictionary = meta[frame_name]
		if Vector2(float(info.get("x", -1)), float(info.get("y", -1))) == region.position \
				and Vector2(float(info.get("w", 0)), float(info.get("h", 0))) == region.size:
			return frame_name
	return ""


func first_open_frame(world: Node) -> String:
	return _sprite_frame(world, &"short_crucible_bridge")


func _solid_token(world: Node, cell: Vector2i) -> String:
	var grid: PackedStringArray = world.get("_solid")
	var index := cell.y * int(world.get("width")) + cell.x
	if index < 0 or index >= grid.size():
		return ""
	return String(grid[index])
