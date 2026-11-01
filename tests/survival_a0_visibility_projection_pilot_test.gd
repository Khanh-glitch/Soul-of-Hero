extends SceneTree
## Research-only semantic verification; NOT a native playable-map, LOS-art, or AI test.
const PROJECTION = preload("res://game/survival/perception/a0_visibility_projection.gd")
var _checks := 0
var _failures: Array[String] = []
var _blocked_cells: Dictionary = {}
var _queries := 0


func _opacity(cell: Vector2i) -> bool:
	_queries += 1
	return bool(_blocked_cells.get(cell, false))


func _malformed_opacity(_cell: Vector2i) -> String:
	return "unknown"


func _expect(ok: bool, label: String) -> void:
	_checks += 1
	if ok:
		print("  ok    ", label)
	else:
		print("  FAIL  ", label)
		_failures.append(label)


func _initialize() -> void:
	print("A0_VISIBILITY_PILOT_SOURCE_SCOPE")
	var projection = PROJECTION.new()
	_expect(not projection.configure(Vector2i.ZERO, Callable(self, "_opacity")), "invalid bounds rejected")
	_expect(projection.last_error == "INVALID_WORLD_BOUNDS", "bounds reason named")
	_expect(not projection.configure(Vector2i(22, 18), Callable()), "missing opacity authority rejected")
	_expect(projection.last_error == "MISSING_LIVE_OPACITY_AUTHORITY", "authority reason named")
	_expect(projection.configure(Vector2i(22, 18), Callable(self, "_opacity")), "read-only live opacity adapter accepted")

	for y in range(18):
		_blocked_cells[Vector2i(10, y)] = true
	var player := Vector2i(7, 9)
	var door := Vector2i(10, 9)
	var other_side := Vector2i(13, 9)
	_expect(not projection.has_line_of_sight(player, other_side, 9), "closed physical door blocks observer LOS")
	_expect(projection.has_line_of_sight(player, door, 9), "blocking door itself remains visible")
	_expect(not projection.has_line_of_sight(player, Vector2i(100, 9), 9), "outside-world LOS fails closed")
	_expect(not projection.has_line_of_sight(player, other_side, 40), "unbounded LOS rejected")
	_expect(not projection.has_line_of_sight(player, other_side, -1), "negative radius rejected")
	_expect(not projection.has_line_of_sight(player, Vector2i(13, 0), 9), "range rejects physically distant point")
	_expect(projection.refresh(player, 9), "first FOV computed")
	_expect(projection.visibility_state(player) == PROJECTION.CURRENT, "origin visible")
	_expect(projection.visibility_state(door) == PROJECTION.CURRENT, "wall front visible")
	_expect(projection.visibility_state(other_side) == PROJECTION.UNKNOWN, "behind closed door unknown")
	_expect(not projection.can_show_live_entity(other_side), "hidden enemy/loot gate fails closed")
	_expect(projection.can_show_static_knowledge(door), "known static door can be represented")
	var first_count: int = projection.visible_count()
	_expect(first_count > 1 and first_count < 22 * 18, "FOV bounded and partly occluded")
	var after_first_queries := _queries
	_expect(not projection.refresh(player, 9), "unchanged FOV not blindly recomputed every frame")
	_expect(_queries == after_first_queries, "cache avoids opacity queries")

	_blocked_cells.erase(door)
	projection.invalidate()
	_expect(projection.refresh(player, 9), "open door event invalidates visibility")
	_expect(projection.has_line_of_sight(player, other_side, 9), "open door permits LOS")
	_expect(projection.visibility_state(other_side) == PROJECTION.CURRENT, "newly visible cell discovered")
	_expect(projection.can_show_live_entity(other_side), "live entity can appear only with valid visibility")
	var remembered_index := other_side.y * 22 + other_side.x

	_blocked_cells[door] = true
	projection.invalidate()
	_expect(projection.refresh(player, 9), "closed door invalidates visibility again")
	_expect(projection.visibility_state(other_side) == PROJECTION.REMEMBERED, "previously seen region becomes memory, not live sight")
	_expect(not projection.can_show_live_entity(other_side), "stale enemy/source/gate status not visible in memory")
	_expect(projection.can_show_static_knowledge(other_side), "previously discovered static topology remains known")
	var snapshot: PackedInt32Array = projection.discovered_indices_snapshot()
	_expect(snapshot.has(remembered_index), "discovery snapshot contains previously seen cell")
	_expect(snapshot.size() == projection.discovered_count(), "snapshot has exactly one entry per known cell")
	var ordered := true
	for i in range(1, snapshot.size()):
		if snapshot[i - 1] >= snapshot[i]:
			ordered = false
	_expect(ordered, "snapshot is sorted and deterministic")

	var second = PROJECTION.new()
	_expect(second.configure(Vector2i(22, 18), Callable(self, "_opacity")), "new process projection config")
	second.load_run_local_discovered(snapshot)
	_expect(second.visibility_state(other_side) == PROJECTION.REMEMBERED, "validated run-local restore remembers geography only")
	_expect(not second.can_show_live_entity(other_side), "restart never restores old enemy vision")
	_expect(second.refresh(player, 9), "restored projection recomputes from current world geometry")
	_expect(second.visibility_state(other_side) == PROJECTION.REMEMBERED, "closed physical door respected after restore")
	second.clear_for_new_run()
	_expect(second.discovered_count() == 0 and second.visible_count() == 0, "new run clears ALL exploration memory")
	_expect(second.visibility_state(other_side) == PROJECTION.UNKNOWN, "new run does not inherit exploration knowledge")
	second.load_run_local_discovered(PackedInt32Array([-1, 999999, 22 * 18, 0]))
	_expect(second.discovered_count() == 1, "malformed/outside saved indices ignored")
	_expect(second.visibility_state(Vector2i(0, 0)) == PROJECTION.REMEMBERED, "valid saved index accepted")
	_expect(not second.refresh(Vector2i(-1, 0), 9), "invalid observer origin rejected")
	_expect(second.visible_count() == 0, "invalid origin does not leave stale live FOV")
	_expect(not second.refresh(player, -1), "negative refresh radius rejected")
	_expect(not second.refresh(player, 50), "oversized refresh radius rejected")
	_expect(second.refresh(player, 9), "valid observer can recover from rejected refresh")

	## A corner must not produce a visual diagonal x-ray through two walls.
	_blocked_cells.clear()
	_blocked_cells[Vector2i(6, 5)] = true
	_blocked_cells[Vector2i(5, 6)] = true
	var corner_start := Vector2i(5, 5)
	var corner_target := Vector2i(6, 6)
	_expect(not projection.has_line_of_sight(corner_start, corner_target, 2), "two touching walls block diagonal x-ray")
	_blocked_cells.erase(Vector2i(5, 6))
	_expect(projection.has_line_of_sight(corner_start, corner_target, 2), "one open diagonal side allows looking past corner")
	_blocked_cells[corner_target] = true
	_expect(projection.has_line_of_sight(corner_start, corner_target, 2), "opaque target itself is still visible")
	_expect(not projection.has_line_of_sight(corner_start, Vector2i(7, 7), 2), "diagonal target outside radius hidden")

	## Fail-closed on invalid opacity authority responses.
	var malformed = PROJECTION.new()
	_expect(malformed.configure(Vector2i(8, 8), Callable(self, "_malformed_opacity")), "malformed-query fixture accepted as callable")
	_expect(not malformed.has_line_of_sight(Vector2i(1, 1), Vector2i(4, 1), 6), "invalid opacity result fails closed")
	_expect(malformed.refresh(Vector2i(1, 1), 3), "malformed opacity remains bounded on FOV update")
	_expect(malformed.visibility_state(Vector2i(4, 1)) == PROJECTION.UNKNOWN, "bad source cannot reveal beyond itself")

	## No world-map mutation, source/item minting, pathfinding, AI claims or rendering.
	print("A0_VISIBILITY_PILOT_METRICS checks=%d queries=%d first_visible=%d remembered=%d" % [
		_checks, _queries, first_count, snapshot.size()])
	if _failures.is_empty():
		print("A0_VISIBILITY_PILOT_PASSED")
		quit(0)
	else:
		print("A0_VISIBILITY_PILOT_FAILED %d/%d" % [_failures.size(), _checks])
		quit(1)
