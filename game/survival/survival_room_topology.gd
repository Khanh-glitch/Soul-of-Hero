class_name SurvivalRoomTopology
extends RefCounted

## Derived topology of cell-based wall and door structures. No room data is saved:
## the authoritative structure records are sufficient to reconstruct it.
## Floods are bounded per connected wall cluster, never by the world-sized box
## between unrelated houses. Oversized clusters fail closed and report overflow.
## Eight-way interior flooding deliberately treats diagonal wall contacts as leaks.
const MAX_SCAN_CELLS := 16384
const SEAL_PIECES := ["wall_wood", "door_wood"]
const NEIGHBOURS := [Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1),
	Vector2i(-1, 0), Vector2i(1, 0), Vector2i(-1, 1), Vector2i(0, 1), Vector2i(1, 1)]

var rooms: Dictionary = {} # stable id -> Array[Vector2i] interior
var cell_to_room: Dictionary = {} # Vector2i -> room id
var overflow_clusters := 0
var scanned_cells := 0
var revision := 0
var _cluster_cache: Dictionary = {} # boundary signature -> derived room dictionary


func rebuild(structures: Dictionary) -> void:
	var walls: Dictionary = {}
	for entry: Variant in structures.values():
		if not entry is Dictionary or not SEAL_PIECES.has(String(entry.get("piece", ""))):
			continue
		var coords: Variant = entry.get("cell", [])
		if coords is Array and coords.size() >= 2:
			walls[Vector2i(int(coords[0]), int(coords[1]))] = true
	rooms.clear()
	cell_to_room.clear()
	overflow_clusters = 0
	scanned_cells = 0
	revision += 1
	var seen_walls: Dictionary = {}
	var next_cache: Dictionary = {}
	for raw: Variant in walls.keys():
		var start: Vector2i = raw
		if seen_walls.has(start):
			continue
		var queue: Array[Vector2i] = [start]
		seen_walls[start] = true
		var lo := start
		var hi := start
		while not queue.is_empty():
			var cell: Vector2i = queue.pop_back()
			lo = Vector2i(mini(lo.x, cell.x), mini(lo.y, cell.y))
			hi = Vector2i(maxi(hi.x, cell.x), maxi(hi.y, cell.y))
			for offset: Vector2i in NEIGHBOURS:
				var adjacent := cell + offset
				if walls.has(adjacent) and not seen_walls.has(adjacent):
					seen_walls[adjacent] = true
					queue.append(adjacent)
		lo -= Vector2i.ONE
		hi += Vector2i.ONE
		var width := hi.x - lo.x + 1
		var height := hi.y - lo.y + 1
		# Do not multiply untrusted coordinates until both dimensions are bounded.
		if width > MAX_SCAN_CELLS or height > MAX_SCAN_CELLS or width * height > MAX_SCAN_CELLS:
			overflow_clusters += 1
			continue
		# Include every seal in the box, including disconnected nested walls.
		# The signature changes if a local edit affects this flood; distant
		# clusters keep their results and do not scan their interiors again.
		var keys: Array[String] = []
		for raw_wall: Variant in walls.keys():
			var wall: Vector2i = raw_wall
			if wall.x >= lo.x and wall.x <= hi.x and wall.y >= lo.y and wall.y <= hi.y:
				keys.append("%d,%d" % [wall.x, wall.y])
		keys.sort()
		var cache_key := "%d,%d:%d,%d:%s" % [lo.x, lo.y, hi.x, hi.y, ";".join(keys)]
		var derived: Dictionary = _cluster_cache.get(cache_key, {})
		if not _cluster_cache.has(cache_key):
			derived = _scan_box(lo, hi, walls)
		next_cache[cache_key] = derived
		for id: Variant in derived.keys():
			rooms[id] = derived[id]
			for cell: Vector2i in derived[id]:
				cell_to_room[cell] = id
	_cluster_cache = next_cache


func _scan_box(lo: Vector2i, hi: Vector2i, walls: Dictionary) -> Dictionary:
	var found: Dictionary = {}
	var visited: Dictionary = {}
	for y in range(lo.y, hi.y + 1):
		for x in range(lo.x, hi.x + 1):
			var start := Vector2i(x, y)
			if visited.has(start) or walls.has(start):
				continue
			var queue: Array[Vector2i] = [start]
			var region: Array[Vector2i] = []
			var open := false
			visited[start] = true
			while not queue.is_empty():
				var cell: Vector2i = queue.pop_back()
				region.append(cell)
				scanned_cells += 1
				if cell.x == lo.x or cell.x == hi.x or cell.y == lo.y or cell.y == hi.y:
					open = true
				for offset: Vector2i in NEIGHBOURS:
					var next := cell + offset
					if next.x < lo.x or next.x > hi.x or next.y < lo.y or next.y > hi.y:
						continue
					if walls.has(next) or visited.has(next):
						continue
					visited[next] = true
					queue.append(next)
			if not open:
				_add_room(region, found)
	return found


func _add_room(region: Array[Vector2i], found: Dictionary) -> void:
	region.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		return a.y < b.y if a.y != b.y else a.x < b.x)
	var signature := ""
	for cell: Vector2i in region:
		signature += "%d,%d;" % [cell.x, cell.y]
	var id := "room_" + signature.sha256_text()
	found[id] = region


func room_at(cell: Vector2i) -> String:
	return String(cell_to_room.get(cell, ""))


func snapshot() -> Dictionary:
	return {"rooms": rooms.duplicate(true), "overflow_clusters": overflow_clusters,
		"scanned_cells": scanned_cells, "revision": revision}
