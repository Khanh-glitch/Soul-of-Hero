class_name OverworldTraversability
extends RefCounted
## Runtime walkability for the Hollow Marches.
##
## `OverworldWorld.is_solid_cell()` answers "did the terrain painter block this
## cell", and that is all it answers. It does not know about the second kind of
## wall the world builds: every landmark, tent, tree, column and cart registers a
## `StaticBody2D` in `blocker_root`, and those bodies are real collision. So a
## prop footprint could seal a road while the terrain grid still called every cell
## walkable — the bake checks props against the *authored* lanes, but nothing ever
## asked the running world whether it was still possible to walk from the refuge
## to the last landmark.
##
## This class answers that, from the physics nodes themselves:
##
##   * `blocker` for a cell is 0 (free), 1 (terrain) or 2 (prop body),
##   * `reachable_from()` is a breadth-first flood over free cells, cached per
##     version and invalidated whenever a shortcut opens or closes,
##   * `unreachable_endpoints()` lists the landmarks, camps, discoveries and the
##     spawn that the running world has sealed off from the refuge.
##
## It reads the live `StaticBody2D`s rather than recomputing their rectangles from
## the atlas, so it cannot drift out of step with the collision the player feels:
## if a blocker is freed (a shortcut opening) or moved, the next rebuild sees it.

const TILE := 16

## 0 = free, 1 = terrain, 2 = prop body.
var width: int = 0
var height: int = 0

var _cells := PackedByteArray()
var _world: OverworldWorld
var _version := 0
var _reach_version := -1
var _reach_origin := Vector2i(-1, -1)
var _reach := PackedInt32Array()   # distance in cells from the BFS origin, -1 = unreachable
var _prop_cells := 0
var _terrain_cells := 0


func build(world: OverworldWorld) -> void:
	_world = world
	width = world.width
	height = world.height
	_cells = PackedByteArray()
	_cells.resize(width * height)
	_cells.fill(0)
	_terrain_cells = 0
	for y in height:
		for x in width:
			if world.is_solid_cell(x, y):
				_cells[y * width + x] = 1
				_terrain_cells += 1
	_prop_cells = 0
	var blockers: Node = world.blocker_root
	if blockers != null:
		for child: Node in blockers.get_children():
			if not child is StaticBody2D:
				continue
			var body := child as StaticBody2D
			# An open shortcut drops its body to collision layer 0 instead of
			# freeing it, so "still in the tree" is not the same as "still solid".
			# Reading the layer is the difference between a shortcut that really
			# opens the world and one that only changes its sprite.
			if body.collision_layer == 0 or body.is_queued_for_deletion():
				continue
			_mark_body(body)
	_version += 1


## Re-read the live prop bodies. Call after a shortcut opens, closes, or after any
## prop is swapped.
func invalidate() -> void:
	if _world == null or not is_instance_valid(_world):
		return
	# Terrain only changes through a shortcut carve, so rebuild from scratch: it is
	# a few thousand comparisons, not a per-frame cost.
	build(_world)


func version() -> int:
	return _version


func cell_of(world_position: Vector2) -> Vector2i:
	return Vector2i(floori(world_position.x / float(TILE)), floori(world_position.y / float(TILE)))


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height


func blocked_kind(cell: Vector2i) -> int:
	if not in_bounds(cell):
		return 1
	return _cells[cell.y * width + cell.x]


func is_free(cell: Vector2i) -> bool:
	return blocked_kind(cell) == 0


## True when a prop body — not the terrain — is what stops the player here.
func blocked_by_prop(cell: Vector2i) -> bool:
	return blocked_kind(cell) == 2


func prop_blocked_cells() -> int:
	return _prop_cells


func terrain_blocked_cells() -> int:
	return _terrain_cells


## Flood fill over free cells. 4-neighbour on purpose: a diagonal gap between two
## blockers is not a corridor a character with a 6 px radius can use, and the
## author's own reachability gate uses the same rule.
## Flood fill over free cells, carrying the walking distance in cells.
##
## 4-neighbour on purpose: a diagonal gap between two blockers is not a corridor a
## character with a 6 px radius can use, and the author's own reachability gate
## uses the same rule. Distances (not just a yes/no) are kept because the honest
## question about a shortcut is not "is there a path" — the Marches are a loop, so
## there always is one — but "how much shorter is it now".
func reachable_from(origin: Vector2i) -> PackedInt32Array:
	if _reach_version == _version and _reach_origin == origin:
		return _reach
	_reach = PackedInt32Array()
	_reach.resize(width * height)
	_reach.fill(-1)
	_reach_origin = origin
	_reach_version = _version
	if not in_bounds(origin) or not is_free(origin):
		return _reach
	# An index cursor, not `pop_front()`: the Marches have ~73 000 free cells and
	# removing from the head of an Array is O(n), which turns this flood into an
	# O(n^2) stall. The cursor keeps it linear.
	var queue: Array[Vector2i] = [origin]
	_reach[origin.y * width + origin.x] = 0
	var head := 0
	while head < queue.size():
		var cell: Vector2i = queue[head]
		head += 1
		var distance := _reach[cell.y * width + cell.x]
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var next := cell + step
			if not in_bounds(next):
				continue
			var index := next.y * width + next.x
			if _reach[index] != -1 or _cells[index] != 0:
				continue
			_reach[index] = distance + 1
			queue.append(next)
	return _reach


func is_reachable(origin: Vector2i, target: Vector2i) -> bool:
	return walking_distance(origin, target) >= 0


## Walking distance in cells, or -1 when the target cannot be reached at all.
func walking_distance(origin: Vector2i, target: Vector2i) -> int:
	if not in_bounds(target):
		return -1
	return reachable_from(origin)[target.y * width + target.x]


## Nearest free cell to a target that the origin can actually reach. Used by the
## reports, and by the occlusion demonstration to put the player somewhere a
## person could really stand.
func nearest_reachable(origin: Vector2i, target: Vector2i, radius := 8) -> Vector2i:
	var reach := reachable_from(origin)
	if in_bounds(target) and reach[target.y * width + target.x] >= 0:
		return target
	for ring in range(1, radius + 1):
		for dy in range(-ring, ring + 1):
			for dx in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dy)) != ring:
					continue
				var probe := target + Vector2i(dx, dy)
				if in_bounds(probe) and reach[probe.y * width + probe.x] >= 0:
					return probe
	return target


## The spawn cell is the world's own refuge cell, not a guess: everything the
## player must be able to walk to is measured from where the player starts.
func spawn_cell() -> Vector2i:
	if _world == null:
		return Vector2i.ZERO
	# `start_position` is what the controller actually places the player on;
	# `refuge.pos` is the camp it belongs to. They agree today, and preferring the
	# controller's key means a future divergence shows up here rather than hiding.
	var start: Array = _world.data.get("start_position", [])
	if start.size() == 2:
		return Vector2i(int(start[0]), int(start[1]))
	var refuge: Dictionary = _world.data.get("refuge", {})
	var pos: Array = refuge.get("pos", [])
	if pos.size() != 2:
		return Vector2i.ZERO
	return Vector2i(int(pos[0]), int(pos[1]))


## Where the flood actually starts. The authored spawn is a place, not necessarily
## a standable cell — the refuge's is under a tent — so the origin is the nearest
## free cell, and `spawn_offset()` says how far that nudge was. Every reachability
## claim in the reports is measured from here, because this is where the player
## really begins the march.
func origin_cell() -> Vector2i:
	return nearest_free(spawn_cell(), 8)


## Cells between the authored spawn point and the ground the player starts on.
func spawn_offset() -> int:
	var spawn := spawn_cell()
	var origin := origin_cell()
	return maxi(absi(origin.x - spawn.x), absi(origin.y - spawn.y))


## Every place the player has to be able to stand, with a label for the report.
func endpoints(world_data: Dictionary) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for raw: Variant in world_data.get("landmarks", []):
		if not raw is Dictionary:
			continue
		var landmark: Dictionary = raw
		var threshold: Array = landmark.get("threshold", [])
		if threshold.size() != 2:
			var pos: Array = landmark.get("pos", [0, 0])
			threshold = [int(pos[0]), int(pos[1]) + 1]
		out.append({
			"id": str(landmark.get("id", "landmark")),
			"kind": "landmark",
			"cell": Vector2i(int(threshold[0]), int(threshold[1])),
		})
	for raw: Variant in world_data.get("camps", []):
		if raw is Dictionary:
			var camp: Dictionary = raw
			var pos: Array = camp.get("pos", [])
			if pos.size() == 2:
				out.append({
					"id": str(camp.get("id", "camp")),
					"kind": "camp",
					"cell": Vector2i(int(pos[0]), int(pos[1])),
				})
	for raw: Variant in world_data.get("discoveries", []):
		if raw is Dictionary:
			var find: Dictionary = raw
			var pos: Array = find.get("pos", [])
			if pos.size() == 2:
				out.append({
					"id": str(find.get("id", "discovery")),
					"kind": "discovery",
					"cell": Vector2i(int(pos[0]), int(pos[1])),
				})
	out.append({"id": "refuge_spawn", "kind": "spawn", "cell": spawn_cell()})
	return out


## Endpoints the running world has sealed off. Empty means the player can still
## walk from the refuge to every dungeon door, camp and discovery.
##
## A cell that is blocked *by a prop* is reported separately from one blocked by
## terrain, because the fix is different: terrain is a bake problem, a prop is
## either a footprint that grew too large or a prop that should not be there.
func unreachable_endpoints(world_data: Dictionary) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var origin := origin_cell()
	var reach := reachable_from(origin)
	for endpoint: Dictionary in endpoints(world_data):
		var cell: Vector2i = endpoint["cell"]
		# An interaction point does not have to be standable itself: a camp tent
		# and a discovery cache both put a body on their own cell, and the Area2D
		# fires from next to it. What must exist is a reachable free cell close
		# enough to interact from.
		var tolerance := 1 if String(endpoint["kind"]) == "landmark" else 2
		if _has_reachable_neighbour(cell, reach, tolerance):
			continue
		var copy := endpoint.duplicate()
		copy["blocked"] = blocked_kind(cell)
		copy["near"] = _nearest_reachable_distance(cell, reach, tolerance)
		out.append(copy)
	return out


func _has_reachable_neighbour(cell: Vector2i, reach: PackedInt32Array, radius: int) -> bool:
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			var probe := cell + Vector2i(dx, dy)
			if not in_bounds(probe):
				continue
			if reach[probe.y * width + probe.x] >= 0:
				return true
	return false


## How far the nearest reachable cell is, for the failure message: "the door is
## three tiles from anywhere you can stand" is a diagnosable report, "unreachable"
## on its own is not.
func _nearest_reachable_distance(cell: Vector2i, reach: PackedInt32Array, radius: int) -> int:
	for ring in range(radius + 1, radius + 9):
		for dy in range(-ring, ring + 1):
			for dx in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dy)) != ring:
					continue
				var probe := cell + Vector2i(dx, dy)
				if in_bounds(probe) and reach[probe.y * width + probe.x] >= 0:
					return ring
	return -1


## Nearest free cell to a target, searching outward. Used to place the player and
## to sanity-check a teleport instead of dropping them inside a body.
func nearest_free(cell: Vector2i, radius := 12) -> Vector2i:
	if in_bounds(cell) and is_free(cell):
		return cell
	for ring in range(1, radius + 1):
		for dy in range(-ring, ring + 1):
			for dx in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dy)) != ring:
					continue
				var candidate := cell + Vector2i(dx, dy)
				if in_bounds(candidate) and is_free(candidate):
					return candidate
	return cell


func nearest_free_position(world_position: Vector2, radius := 12) -> Vector2:
	var cell := nearest_free(cell_of(world_position), radius)
	return Vector2(float(cell.x) * TILE + TILE * 0.5, float(cell.y) * TILE + TILE * 0.5)


func _mark_body(body: StaticBody2D) -> void:
	for child: Node in body.get_children():
		if not child is CollisionShape2D:
			continue
		var shape := (child as CollisionShape2D).shape
		if not shape is RectangleShape2D:
			continue
		var rect: RectangleShape2D = shape
		# The shape node's own transform already carries the body's: its origin is
		# the centre of the rectangle, and the shape has no offset of its own.
		var centre := (child as CollisionShape2D).global_position
		var half := rect.size * 0.5
		var x0 := floori((centre.x - half.x) / float(TILE))
		var x1 := floori((centre.x + half.x) / float(TILE))
		var y0 := floori((centre.y - half.y) / float(TILE))
		var y1 := floori((centre.y + half.y) / float(TILE))
		for y in range(y0, y1 + 1):
			for x in range(x0, x1 + 1):
				if x < 0 or y < 0 or x >= width or y >= height:
					continue
				var index := y * width + x
				# Terrain stays terrain: the report distinguishes the two kinds.
				if _cells[index] == 0:
					_cells[index] = 2
					_prop_cells += 1
