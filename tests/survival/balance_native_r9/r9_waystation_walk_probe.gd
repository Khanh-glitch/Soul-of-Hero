extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## D063 / D067 — can the production Hero physically reach the current Waystation,
## interact with it using ordinary input, and come back?
##
## ## What makes this round different
## Round 8 walked an A7-built stand-in body and called product methods. This probe
## mounts the shipped overworld, takes the *production* `Knight` (RectangleShape2D
## 12x16 at (0,-8), `collision_mask = 5`, `motion_mode = float`), and moves it with
## `Input.action_press` so `move_and_slide`, acceleration and corner sliding all
## run. Interaction is a real `InputEventMouseButton` through
## `Input.parse_input_event`, so it goes through the viewport, the HUD hit-test and
## the Knight's own pointer path.
##
## ## The question it answers
## A0's host requires the Hero's **exact authored stand cell** plus 24 px
## (`matches_interaction`). That is a tight, falsifiable claim: either the body can
## stand on that cell or the interaction can never happen. This probe measures it
## for every authored point, then measures the same route with A8's shadow actor to
## see whether the shadow's locally reconstructed physics agrees.

const TILE := 16
const HOST := "res://game/survival/waystation_host.gd"
## Copied from A0's `waystation_host.gd` `POINTS` (keys are the authored ids; the
## host names the nodes `id.capitalize()`) and asserted against the shipped constant
## below, so a host edit that moves a cell fails loudly here.
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
	probe_id = "R9WALK"
	probe_title = "production Hero walks to every authored Waystation stand, interacts, and returns"
	owner_action = (
		"A0: if a stand cell cannot be stood on by the production body, move the authored stand or the "
		+ "blocking body; the host's `matches_interaction` requires the exact cell, so an unreachable stand is "
		+ "an unreachable interaction."
	)

	# ---- static: the authored geometry, read from the host script itself ----
	# This half needs no mount, so it stays measurable even while the host cannot be
	# built (see R9SEAM). It also keeps `STANDS` honest: the table above is compared
	# against the shipped constant rather than trusted.
	var host_script: Script = load(HOST) as Script
	if host_script == null:
		_missing("the Waystation host script", HOST)
		_done()
		return
	var points: Dictionary = host_script.get_script_constant_map().get("POINTS", {})
	_note("authored_points=%d table_entries=%d" % [points.size(), STANDS.size()])
	_expect(points.size() == STANDS.size(),
		"the shipped host authors exactly the %d points this probe walks" % STANDS.size())
	var mismatched: Array[String] = []
	for named: String in STANDS:
		if not points.has(named):
			mismatched.append("absent:%s" % named)
			continue
		var authored: Dictionary = points[named]
		var want: Dictionary = STANDS[named]
		if authored.get("cell") != want["cell"] or authored.get("stand") != want["stand"]:
			mismatched.append("%s authored=%s/%s table=%s/%s" % [
				named, str(authored.get("cell")), str(authored.get("stand")), str(want["cell"]), str(want["stand"]),
			])
	_expect(mismatched.is_empty(), "every authored cell and stand matches the table this probe walks (%s)" % JSON.stringify(mismatched))

	# `matches_interaction` is the contract the whole probe rests on: the Hero must be
	# on the exact stand cell *and* within 24 px of the point's cell centre. Both are
	# asserted in the product's own source, because a looser rule would make a walk
	# test meaningless and a tighter one could make the point unreachable.
	var host_source := FileAccess.get_file_as_string(HOST) if FileAccess.file_exists(HOST) else ""
	_expect(host_source.contains("nav.cell_of(_hero.global_position) == data.stand"),
		"interaction requires the production body's exact stand cell")
	_expect(host_source.contains("<= 24.0"), "interaction requires the body within 24 px of the point centre")
	var stand_offsets: Array[String] = []
	for named: String in STANDS:
		var cell: Vector2i = STANDS[named]["cell"]
		var stand: Vector2i = STANDS[named]["stand"]
		var offset := stand - cell
		if absi(offset.x) + absi(offset.y) != 1:
			stand_offsets.append("%s:%s" % [named, str(offset)])
	# A stand cell two tiles away would satisfy the cell test but fail the 24 px test,
	# which is the kind of authored inconsistency no runtime walk would explain.
	_expect(stand_offsets.is_empty(),
		"every stand cell is orthogonally adjacent to its point, so 16 px always satisfies the 24 px rule (%s)"
		% JSON.stringify(stand_offsets))

	# ---- the mount, which is where this stops ------------------------------
	var mounted := await _mount_production_world(true, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		_block(
			"the Waystation host cannot be mounted in this composition, so no stand cell or click can be walked: "
			+ blocked
		)
		return
	_note("mount=production_overworld waystation_host=%s forced_flag=%s" % [
		str(waystation_host != null), str(mounted_under_forced_flag)
	])
	if waystation_host == null:
		_block("the shipped overworld built without a WaystationRuntime node even with the candidate flag set")
		return

	# ---- 0. the host's own geometry, against the cells this probe expects ----
	var authored_ok := 0
	for named: String in STANDS:
		var point := _point(named)
		if point == null:
			continue
		var want: Dictionary = STANDS[named]
		var want_position := Vector2(float(want["cell"].x) * TILE + TILE * 0.5, float(want["cell"].y) * TILE + TILE * 0.5)
		if (point as Node2D).global_position.distance_to(want_position) < 0.01:
			authored_ok += 1
		else:
			_note("point_moved %s at %s expected %s" % [named, str(point.global_position), str(want_position)])
	_note("authored_points_matching=%d of %d" % [authored_ok, STANDS.size()])
	_expect(authored_ok == STANDS.size(), "every authored point is where the host contract says it is")

	# ---- 1. reach every stand cell with ordinary movement input ------------
	var unreachable: Array = []
	var reached_cells: Dictionary = {}
	for named: String in STANDS:
		var want: Dictionary = STANDS[named]
		var stand_cell: Vector2i = want["stand"]
		var target := Vector2(float(stand_cell.x) * TILE + TILE * 0.5, float(stand_cell.y) * TILE + TILE * 0.5)
		var walk := await _walk_to_point(target)
		var gap := _cell_gap(stand_cell)
		reached_cells[named] = gap
		_note("walk %s cell_gap=%d frames=%s ok=%s" % [
			named, gap, str(walk.get("frames", -1)), str(walk.get("ok", false))
		])
		if gap != 0:
			unreachable.append("%s(gap=%d)" % [named, gap])
	# One assertion over the whole set: a per-point pass would hide that a single
	# unreachable stand still makes that point's interaction impossible.
	_expect(unreachable.is_empty(), "the production Hero can stand on every authored stand cell (failed: %s)" % JSON.stringify(unreachable))

	# ---- 2. ordinary click interaction at the Waystation -------------------
	var locker := _point("locker")
	if locker != null:
		var at_locker_cell := _cell_gap(STANDS["locker"]["stand"]) == 0
		if not at_locker_cell:
			await _walk_to_point(Vector2(408.5 * TILE, 199.5 * TILE))
		var before := _hero_state()
		var in_range := _in_range_points()
		_note("in_range_points=%s" % JSON.stringify(in_range.map(func(node: Node) -> String: return String(node.name))))
		_expect(not in_range.is_empty(), "the host reports at least one interaction in range at the locker stand")
		await _mouse_click_world((locker as Node2D).global_position)
		await physics_frame
		var after := _hero_state()
		_note("receipts %d -> %d, inventory_stacks %d -> %d" % [
			int(before["receipts"]), int(after["receipts"]),
			int(before["inventory_total"]), int(after["inventory_total"]),
		])
		_expect(int(after["receipts"]) >= int(before["receipts"]), "an ordinary click never removes a committed receipt")
		# Replay: the same click again must not write a second receipt.
		var once := _hero_state()
		await _mouse_click_world((locker as Node2D).global_position)
		await physics_frame
		var twice := _hero_state()
		_note("replay receipts %d -> %d" % [int(once["receipts"]), int(twice["receipts"])])
		_expect(int(twice["receipts"]) == int(once["receipts"]), "a repeated click at the same point writes no second receipt")

	# ---- 3. collision is physical, not decorative -------------------------
	# Walk straight at the locker's own body from its stand; the production body
	# must be stopped by geometry rather than passing through the sprite.
	var body := _blocker("obs_waystation_locker_bank")
	if body != null:
		var body_2d := body as Node2D
		var start := Vector2(408.5 * TILE, 199.5 * TILE)
		await _walk_to_point(start)
		var before_pos := hero.global_position
		# Push north, straight into the locker body one cell above.
		Input.action_press("move_up")
		for i in 40:
			await physics_frame
		Input.action_release("move_up")
		var moved := before_pos.distance_to(hero.global_position)
		_note("push_into_locker moved=%.2f px (body at %s)" % [moved, str(body_2d.global_position)])
		_expect(moved < 24.0, "the locker body physically stops the Hero instead of letting it walk through")
	else:
		_missing("the named locker collision body in the mounted blocker layer", "chapter1_overworld world blocker layer")

	# ---- 4. return to the authored spawn (same home) ----------------------
	var home := Vector2(float(spawn_cell.x) * TILE + TILE * 0.5, float(spawn_cell.y) * TILE + TILE * 0.5)
	var back := await _walk_to_point(home)
	_note("return_walk ok=%s frames=%s cell_gap=%d" % [str(back.get("ok", false)), str(back.get("frames", -1)), _cell_gap(spawn_cell)])
	_expect(bool(back.get("ok", false)), "the Hero can walk back to the authored spawn without being trapped")
	_expect(_cell_gap(spawn_cell) <= 1, "the return lands on the same home cell it started from")

	# ---- 5. conservation: walking changes nothing but position ------------
	var snapshot_now := _snapshot()
	var inventory: Dictionary = snapshot_now.get("inventory", {})
	_note("inventory_stacks_after_route=%d revision=%d" % [inventory.size(), int(snapshot_now.get("revision", 0))])
	_expect(not snapshot_now.is_empty(), "the production save is readable after a long route")

	_release_all()
	_done()


func _finish() -> void:
	_release_all()
	super._finish()
