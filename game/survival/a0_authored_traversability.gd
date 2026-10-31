class_name A0AuthoredTraversability
extends OverworldTraversability
## Walkability for the authored continent without pre-scanning 786 432 cells.
##
## The legacy `build()` fills a full grid by asking `is_solid_cell()` once per
## cell. On the authored continent that would mean loading all 192 chunk files
## (A1 keeps every loaded chunk) before the first frame, which is both slow and
## hundreds of megabytes for a question the flood fill never needs answered far
## from the player.
##
## So the grid keeps what is genuinely dense — the static bodies the streamer
## actually mounted, which is what `_mark_body()` records — and asks A1 for the
## terrain token of a cell the first time that cell is looked at. A1's reader is
## the authority for both halves; this class only decides *when* to ask.

var _host: Node = null
## Cells already resolved from A1 (0 free, 1 terrain). Grows only where the player
## or a flood actually goes.
var _seen_bodies: Dictionary = {}
var _terrain_resolved := PackedByteArray()
var _terrain_resolved_any := false


func build_authored(host: Node) -> void:
	_host = host
	width = int((host.call(&"world_cells") as Vector2i).x)
	height = int((host.call(&"world_cells") as Vector2i).y)
	_cells = PackedByteArray()
	_cells.resize(width * height)
	_cells.fill(0)
	_terrain_resolved = PackedByteArray()
	_terrain_resolved.resize(width * height)
	_terrain_resolved.fill(0)
	_terrain_resolved_any = false
	_terrain_cells = 0
	_prop_cells = 0
	_seen_bodies.clear()
	refresh_bodies()
	_version += 1


## Streaming adds collision bodies while the player walks — A1's chunk terrain and
## A8's site shells both. The grid is a cache of what is really mounted, so it has to
## learn the new bodies or it will tell a walker that a streamed cliff, or a quarry
## wall, is open ground. Only bodies it has not seen are marked, so the counters stay
## honest across refreshes.
func refresh_bodies() -> int:
	if _host == null:
		return 0
	var added := 0
	for root: Variant in _host.call(&"collision_roots"):
		if not root is Node:
			continue
		for child: Node in (root as Node).get_children():
			var bodies: Array[Node] = []
			for body_node: Node in child.get_children():
				if body_node is StaticBody2D:
					bodies.append(body_node)
			if child is StaticBody2D:
				bodies.append(child)
			for body_node: Node in bodies:
				var body := body_node as StaticBody2D
				if body.collision_layer == 0 or body.is_queued_for_deletion():
					continue
				if _seen_bodies.has(body.get_instance_id()):
					continue
				_seen_bodies[body.get_instance_id()] = true
				_mark_body(body)
				added += 1
	if added > 0:
		_version += 1
	return added


## 0 free, 1 terrain, 2 prop body — the same contract the legacy grid answers.
func blocked_kind(cell: Vector2i) -> int:
	if not in_bounds(cell):
		return 1
	var index := cell.y * width + cell.x
	var recorded := _cells[index]
	if recorded != 0:
		return recorded
	if not _terrain_resolved_any:
		_resolve_near(cell)
		recorded = _cells[index]
		if recorded != 0:
			return recorded
	elif _terrain_resolved[index] != 0:
		return 1 if _terrain_resolved[index] == 2 else 0
	var walkable := bool(_host.call(&"cell_is_walkable", cell)) if _host != null else false
	_terrain_resolved[index] = 1 if walkable else 2
	if not walkable:
		_terrain_cells += 1
		return 1
	return 0


## Ask A1 about the neighbourhood of a cell once. Chunk loading is per 64x64
## chunk, so resolving the 3x3 around the first query costs the same as one cell.
func _resolve_near(cell: Vector2i) -> void:
	_terrain_resolved_any = true
	for dy: int in range(-1, 2):
		for dx: int in range(-1, 2):
			var probe := cell + Vector2i(dx, dy)
			if not in_bounds(probe):
				continue
			var index := probe.y * width + probe.x
			if _terrain_resolved[index] != 0:
				continue
			var walkable := bool(_host.call(&"cell_is_walkable", probe)) if _host != null else false
			_terrain_resolved[index] = 1 if walkable else 2
			if not walkable:
				_terrain_cells += 1


## The base flood reads the dense array directly; this one asks `blocked_kind`,
## which is the only difference and the reason the subclass exists.
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
			if _reach[index] != -1:
				continue
			if blocked_kind(next) != 0:
				continue
			_reach[index] = distance + 1
			queue.append(next)
	return _reach


## The starting cell is A0's persisted safe spawn, not a legacy refuge field.
func spawn_cell() -> Vector2i:
	if _host != null and _host.has_method(&"spawn_cell"):
		return _host.call(&"spawn_cell")
	return Vector2i.ZERO
