extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP2 — the physical Waystation: eight stands, one click, one receipt, a denied
## second click, and the three roadside caches as real identities.
##
## Round 9 established the authored geometry and could not walk it, because the
## world refused to build under its own candidate flag. This probe keeps that
## static half (it is cheap and it caught a table/constant drift once already) and
## then *tries* the mount. Whatever the outcome, the probe states which half of the
## claim was measured:
##
## * `GEOMETRY` — the authored cells, stand adjacency, and the 24 px rule;
## * `REACHED` — the production Hero stood on every stand cell with ordinary input;
## * `CLICKED` — one click produced one receipt and a replay produced none.
##
## A claim that never reached its level is reported as such, never as a pass.

const TILE := 16
const HOST := "res://game/survival/waystation_host.gd"
## Authored ids and cells, asserted against the shipped constant below.
const STANDS := {
	"locker": {"cell": Vector2i(408, 198), "stand": Vector2i(408, 199)},
	"cache": {"cell": Vector2i(406, 203), "stand": Vector2i(406, 202)},
	"ledger": {"cell": Vector2i(411, 202), "stand": Vector2i(410, 202)},
	"deadfall": {"cell": Vector2i(398, 202), "stand": Vector2i(398, 201)},
	"roadside_01": {"cell": Vector2i(395, 219), "stand": Vector2i(395, 220)},
	"roadside_02": {"cell": Vector2i(400, 216), "stand": Vector2i(400, 217)},
	"roadside_03": {"cell": Vector2i(402, 220), "stand": Vector2i(402, 221)},
	"crank": {"cell": Vector2i(443, 234), "stand": Vector2i(442, 234)},
}


func _body() -> void:
	probe_id = "R10WALK"
	probe_title = "eight authored stands, one physical interaction, one receipt, and a denied second click"
	owner_action = (
		"A0: the Waystation cannot mount while the economy session refuses to configure (see R10SEAM). Until that "
		+ "single fence conflict is resolved, no player can reach a locker, a cache or the crank, and the reward "
		+ "text in `waystation_host.interact_point` is unreachable code."
	)

	# ---- GEOMETRY: independent of any mount -----------------------------
	var host_script: Script = load(HOST) as Script
	if host_script == null:
		_missing("the Waystation host script", HOST)
		_done()
		return
	var points: Dictionary = host_script.get_script_constant_map().get("POINTS", {})
	_note("authored_points=%d table=%d" % [points.size(), STANDS.size()])
	_expect(points.size() == STANDS.size(), "the host authors the eight points this probe walks")
	var mismatched: Array[String] = []
	for id: String in STANDS:
		if not points.has(id):
			mismatched.append("absent:%s" % id)
			continue
		var want: Dictionary = STANDS[id]
		if points[id].get("cell") != want["cell"] or points[id].get("stand") != want["stand"]:
			mismatched.append("%s authored=%s/%s table=%s/%s" % [
				id, str(points[id].get("cell")), str(points[id].get("stand")), str(want["cell"]), str(want["stand"]),
			])
	_expect(mismatched.is_empty(), "every authored cell and stand matches (%s)" % JSON.stringify(mismatched))

	var adjacent := 0
	for id: String in STANDS:
		var offset: Vector2i = (STANDS[id]["stand"] as Vector2i) - (STANDS[id]["cell"] as Vector2i)
		if absi(offset.x) + absi(offset.y) == 1:
			adjacent += 1
	_expect(adjacent == STANDS.size(),
		"every stand is orthogonally adjacent, so 16 px always satisfies the host's 24 px reach")

	# The three roadside caches must be *distinct* authored identities, because A3
	# treats each instance as its own finite source. Two ids pointing at one source
	# would grant the same reward twice from different furniture.
	var instances: Array[String] = []
	for id: String in ["cache", "roadside_01", "roadside_02", "roadside_03"]:
		instances.append(String(points[id].get("instance", "")))
	_note("cache_instances=%s" % JSON.stringify(instances))
	_expect(not instances.has("") and instances.size() == instances.duplicate().size(),
		"each cache names an instance")
	var unique := {}
	for value: String in instances:
		unique[value] = true
	_expect(unique.size() == instances.size(), "the cache, roadside 01/02/03 are four distinct source identities")

	# ---- REACHED / CLICKED ----------------------------------------------
	var mounted := await _mount_production_world(true, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		_block(
			"REACHED and CLICKED are unmeasured: the overworld refuses to build with "
			+ "survival/a0_waystation_candidate=true. Cause: " + blocked
		)
		return
	if waystation_host == null:
		_note("mounted with no WaystationRuntime node")
		_block("the world built but produced no Waystation host, so no point exists to click")
		return
	_note("waystation_host=present mounted_under_forced_flag=%s" % str(mounted_under_forced_flag))

	# ---- REACHED: the product's own navigation graph ---------------------
	# A 6,000 px route through an authored continent is not something a probe can
	# walk in a few hundred frames, so the *graph* claim is measured first (A0's own
	# traversability), and the *input* claim is attempted separately with an explicit
	# frame budget. Conflating the two is how "reachable" ends up meaning "the probe
	# got lucky with its axis-stepping".
	var origin := _hero_cell()
	var unreachable: Array[String] = []
	for id: String in STANDS:
		var stand: Vector2i = STANDS[id]["stand"]
		var ok := false
		if traversability != null and traversability.has_method(&"is_reachable"):
			ok = bool(traversability.call(&"is_reachable", origin, stand))
		if not ok:
			unreachable.append(id)
		_note("graph %s origin=%s stand=%s reachable=%s" % [id, str(origin), str(stand), str(ok)])
	_expect(unreachable.is_empty(),
		"every authored stand cell is in the Hero's reachable set according to A0's traversability (%s)"
		% JSON.stringify(unreachable))

	var walk_target: Vector2i = STANDS["locker"]["stand"]
	var walk := await _walk_to_point(Vector2(float(walk_target.x) * TILE + TILE * 0.5, float(walk_target.y) * TILE + TILE * 0.5))
	var gap := _cell_gap(walk_target)
	_note("input walk to locker: gap=%d cells frames=%s (the distance is %.0f px)" % [
		gap, str(walk.get("frames", -1)), hero.global_position.distance_to(Vector2(walk_target) * TILE),
	])
	if gap != 0:
		_note(
			"INPUT_NOT_CLAIMED: the axis-stepping helper cannot cover the route inside its frame budget, so "
			+ "'the player walked there' is not established by this probe — only that the graph says they can."
		)

	# ---- CLICKED: only from the stand cell ------------------------------
	var locker := _point("locker")
	if locker == null:
		_missing("the locker point node on the mounted host", HOST)
		_done()
		return
	var in_range := _in_range_points()
	_note("in_range_at_spawn=%s" % JSON.stringify(in_range.map(func(node: Node) -> String: return String(node.name))))
	if gap == 0:
		var receipts_before := _receipt_count()
		var inventory_before := _inventory_totals()
		await _mouse_click_world((locker as Node2D).global_position)
		await physics_frame
		var receipts_after := _receipt_count()
		var inventory_after := _inventory_totals()
		_note("click receipts %d -> %d inventory=%s" % [receipts_before, receipts_after, JSON.stringify(inventory_after)])
		_expect(receipts_after == receipts_before + 1, "standing on the stand cell, one click commits one receipt")
		await _mouse_click_world((locker as Node2D).global_position)
		await physics_frame
		_expect(_receipt_count() == receipts_after, "the same click again writes no second receipt")
		_expect(_inventory_totals() == inventory_after, "the same click again grants nothing")
	else:
		# The negative half is still worth measuring: a click aimed at the locker from
		# far away must not credit it. A resource node near the spawn may legitimately
		# answer the same click, so the assertion is about the *locker's* receipt, not
		# about "nothing happened".
		_expect(in_range.is_empty(), "the host reports no interaction in range from the spawn cell")
		var before := _snapshot().get("applied_transactions", {}) as Dictionary
		await _mouse_click_world((locker as Node2D).global_position)
		await physics_frame
		var after: Dictionary = _snapshot().get("applied_transactions", {})
		var fresh: Array = after.keys().filter(func(key: String) -> bool: return not before.has(key))
		_note("far_click new_receipts=%s (a nearby resource node may legitimately answer the click)" % JSON.stringify(fresh))
		var locker_receipt := false
		for key: Variant in fresh:
			var text := String(key)
			if text.contains("waystation") or text.contains("cache") or text.contains("locker"):
				locker_receipt = true
		_expect(not locker_receipt, "a click aimed at the locker from outside its stand credits nothing")

	_note("VERDICT: geometry verified on the host; graph reachability measured; click asserted only where it was in range.")
	_done()


func _inventory_totals() -> Dictionary:
	var save := _save()
	if save == null or not save.has_method(&"inventory_totals"):
		return {}
	return save.call(&"inventory_totals") as Dictionary


func _finish() -> void:
	_release_all()
	super._finish()
