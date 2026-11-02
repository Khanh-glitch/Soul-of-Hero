extends "res://tests/overworld_runtime_case.gd"
## Traversability, measured on the world the player actually walks through.
##
## `world.is_solid_cell()` only knows the terrain painter. The running world also
## builds a `StaticBody2D` for every landmark, tent, tree and cart, and those are
## walls too — so the honest question is not "is the terrain grid connected" (the
## bake proves that) but "can the player still walk from the refuge to every door,
## camp and discovery now that the props exist".
##
## The shortcut assertions are the other half: a shortcut that only changes its
## sprite is not a shortcut. Opening one must clear terrain, drop its own body out
## of collision, and measurably shorten the walk between the two sides.

func _body() -> void:
	var trav: OverworldTraversability = ow.get("traversability") as OverworldTraversability
	_expect(trav != null, "the overworld builds a traversability grid")
	var world: OverworldWorld = ow.get("world") as OverworldWorld
	_expect(world != null, "the overworld built a world")
	if trav == null or world == null:
		_done("traversability test could not run")
		return

	_expect(trav.width == world.width and trav.height == world.height,
		"the grid matches the world (%dx%d)" % [trav.width, trav.height])

	# Terrain agreement: the grid must not be a second opinion about the terrain.
	var disagreements := 0
	var sampled := 0
	for y in range(0, world.height, 7):
		for x in range(0, world.width, 7):
			sampled += 1
			var solid := world.is_solid_cell(x, y)
			var blocked := trav.blocked_kind(Vector2i(x, y)) == 1
			if solid != blocked:
				disagreements += 1
	_expect(disagreements == 0,
		"terrain blocking agrees with the world (%d of %d sampled cells disagree)"
			% [disagreements, sampled])
	_expect(trav.terrain_blocked_cells() == world.solid_cell_count(),
		"every solid terrain cell is counted (%d)" % trav.terrain_blocked_cells())

	# Props contribute real walls that the terrain grid does not know about. If this
	# is zero, the system is measuring nothing.
	_expect(trav.prop_blocked_cells() > 300,
		"prop bodies block cells of their own (%d)" % trav.prop_blocked_cells())

	# -- the assertion that matters: nothing is sealed off --------------------
	var sealed: Array = ow.get("traversability_failures")
	var sealed_count := (sealed as Array).size() if sealed != null else -1
	var sealed_names := ""
	if sealed_count > 0:
		for failure: Dictionary in sealed:
			sealed_names += " %s" % String(failure.get("id", "?"))
	_expect(sealed_count == 0,
		"every landmark, camp, discovery and the spawn are reachable (%d sealed:%s)"
			% [sealed_count, sealed_names])

	var spawn := trav.spawn_cell()
	_expect(trav.in_bounds(spawn), "the spawn cell is inside the world")
	# The authored spawn is the middle of the refuge's cooking ground, and a tent
	# body stands there. The origin is therefore the nearest standable cell, and it
	# has to be *close*: a flood that starts half a march away would prove nothing.
	var origin := trav.origin_cell()
	_expect(trav.spawn_offset() <= 2,
		"the player starts within two tiles of the authored spawn (%d)" % trav.spawn_offset())
	_expect(trav.is_free(origin),
		"the flood starts on standable ground (%s is %d)" % [str(origin), trav.blocked_kind(origin)])
	_expect(trav.walking_distance(origin, origin) == 0, "the spawn can reach itself")
	# The throne's own cell carries the keep's body; the threshold one tile south
	# is the cell the player stands on to enter. Asking about the body would only
	# ever prove that a wall is a wall.
	var far := Vector2i(280, 37)  # the Castellan Throne's threshold
	var walk := trav.walking_distance(origin, far)
	_expect(trav.is_free(far), "the citadel threshold is standable ground")
	_expect(walk > 200, "the walk to the citadel is a real journey (%d cells)" % walk)
	_expect(trav.is_reachable(origin, Vector2i(-5, -5)) == false,
		"cells outside the envelope are not reachable")

	# The defect this test found: a fresh character was spawned inside the tent
	# body at the refuge and had to be pushed out by physics. Assert the scene has
	# already resolved it, so nothing depends on a first-frame collision response.
	var player_cell := trav.cell_of(ow.player.position)
	_expect(trav.is_free(player_cell),
		"the player does not start inside a body (%s is %d)" % [str(player_cell), trav.blocked_kind(player_cell)])
	_expect(player_cell.distance_to(origin) <= 1,
		"the player starts on the flood origin (%s vs %s)" % [str(player_cell), str(origin)])

	# -- shortcuts really open the world --------------------------------------
	var shortcut_id := StringName("short_crucible_bridge")
	var box: Array = world.shortcut_carve_box(shortcut_id)
	_expect(box.size() == 4, "the crucible bridge has an authored carve box")
	if box.size() == 4:
		var x0 := int(box[0])
		var y0 := int(box[1])
		var x1 := int(box[2])
		var y1 := int(box[3])
		var inside := Vector2i((x0 + x1) / 2, (y0 + y1) / 2)
		# The two banks are resolved to ground a player can stand on *before*
		# anything is measured: the cell two tiles off the carve box can be a rock,
		# and "unreachable because the probe was inside a boulder" is not a finding.
		var north := trav.nearest_reachable(origin, Vector2i((x0 + x1) / 2, y0 - 2), 6)
		var south := trav.nearest_reachable(origin, Vector2i((x0 + x1) / 2, y1 + 2), 6)
		_expect(trav.is_free(north) and trav.is_free(south),
			"both bridge banks resolve to standable ground (%s, %s)" % [str(north), str(south)])

		_expect(trav.blocked_kind(inside) == 1,
			"the closed bridge is terrain to the grid (%d)" % trav.blocked_kind(inside))
		var before := trav.walking_distance(north, south)
		_expect(before > 0, "the two banks are connected the long way round (%d cells)" % before)

		world.set_shortcut_open(shortcut_id, true)
		trav.invalidate()
		_expect(trav.blocked_kind(inside) != 1,
			"opening the bridge clears the terrain band (%d)" % trav.blocked_kind(inside))
		var after := trav.walking_distance(north, south)
		_expect(after > 0, "the banks are still connected after opening (%d)" % after)
		_expect(after < before,
			"opening the shortcut shortens the walk (%d -> %d cells)" % [before, after])

		# A shortcut whose own body stays solid is a sprite swap, not a shortcut.
		var solid_bodies := 0
		for child: Node in world.blocker_root.get_children():
			if child is StaticBody2D and (child as StaticBody2D).collision_layer != 0:
				solid_bodies += 1
		world.set_shortcut_open(shortcut_id, false)
		trav.invalidate()
		var closed_bodies := 0
		for child: Node in world.blocker_root.get_children():
			if child is StaticBody2D and (child as StaticBody2D).collision_layer != 0:
				closed_bodies += 1
		_expect(closed_bodies > solid_bodies,
			"closing the bridge restores a body to collision (%d -> %d)"
				% [solid_bodies, closed_bodies])

	# -- spawn must be on standable ground ------------------------------------
	var spawn_position := trav.nearest_free_position(
		Vector2(float(spawn.x) * 16.0 + 8.0, float(spawn.y) * 16.0 + 8.0), 6)
	_expect(world.is_walkable(spawn_position),
		"the spawn resolves to a walkable position, not inside a tent")

	_done("traversability: the built world is connected, and shortcuts change it")
