extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## Round 8 blamed the build HUD for refusing a placement. This probe settles it.
##
## ## The retraction
## Round 8 reported that the build HUD's `ClickBlocker` intercepted the placement
## ray. Reading the product instead of the symptom shows the opposite:
##
## * the blocker is deliberate — `is_build_click_blocker()` exists so the placement
##   door can *exempt* it;
## * placement is not a raycast at all: `try_place()` takes `preview_cell()`, which
##   is `camera.get_global_mouse_position()` floored to a tile;
## * round 8 never positioned the pointer, so the preview sat on the Hero's cell over
##   solid ground and the `solid_terrain` refusal was the *correct* answer.
##
## So this probe measures the two things round 8 assumed: whether the pointer
## reaches the preview in this environment, and whether a placement that the pointer
## does reach commits exactly once with exactly its own cost.
##
## ## `NOT_RENDERED`
## Headless has no display and no window (`DisplayServer.window_get_size()==0x0`).
## If the injected pointer does not move the preview, the honest conclusion is
## "click-precision placement needs a display", not "placement is broken" — and the
## commit path is then exercised through `try_place(cell)` and labelled
## `API_NOT_CLICK`, so it is never presented as a click.

const PIECE := "foundation_wood"
const GRANT_KEY := "a7_r9_placement_grant"
const TILE := 16


func _body() -> void:
	probe_id = "R9PLACE"
	probe_title = "placement is driven by the preview cell, not by the HUD blocker; headless pointer projection measured"
	owner_action = (
		"A0: no change is requested by this probe. Round 8's ClickBlocker claim was A7's error and is retracted here. "
		+ "If pointer-driven placement must be verified, that needs a display; headless cannot position the pointer."
	)

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return
	var build: Node = production.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system on the mounted overworld", "chapter1_overworld.gd")
		_done()
		return

	# ---- 1. the environment, measured -----------------------------------
	_note("display_server=%s window=%s root.size=%s final_transform=%s" % [
		DisplayServer.get_name(),
		str(DisplayServer.window_get_size()),
		str(root.size),
		str(root.get_final_transform()),
	])

	# ---- 2. build mode, entered with the real key -----------------------
	await _tap("build_toggle")
	var status: Dictionary = build.call(&"build_hud_status")
	_note("build_status.active=%s blocker_visible=%s" % [
		str(status.get("active", false)), str(status.get("blocker_visible", false)),
	])
	_expect(bool(status.get("active", false)), "the build toggle key opens the build strip")
	_expect(bool(status.get("blocker_visible", false)), "opening build mode shows the full-screen click blocker")

	var hovered := root.gui_get_hovered_control()
	_note("hovered=%s is_build_click_blocker=%s" % [
		String(hovered.name) if hovered != null else "<none>",
		str(hovered != null and bool(build.call(&"is_build_click_blocker", hovered))),
	])
	# What matters for the retraction is not what headless reports as hovered, but
	# that the product exposes this door at all, recognises its own control through
	# it, and that a build-mode click does not leak into gameplay.
	var blocker: Control = (build.get(&"_hud_root") as Control).get_node_or_null("ClickBlocker") as Control
	_expect(blocker != null and bool(build.call(&"is_build_click_blocker", blocker)),
		"`is_build_click_blocker` recognises exactly the HUD's own blocker control")

	await _mouse_click_world(hero.global_position)
	await physics_frame
	var pending_lmb := bool(hero.get(&"_pending_gameplay_lmb"))
	_note("after_build_mode_click_pending_gameplay_lmb=%s" % str(pending_lmb))
	_expect(not pending_lmb, "a click in build mode queues no gameplay attack")

	# ---- 3. does the pointer reach the preview at all? -------------------
	var hero_cell := _hero_cell()
	var wanted := Vector2i(hero_cell.x + 2, hero_cell.y)
	var wanted_world := Vector2(float(wanted.x) * TILE + TILE * 0.5, float(wanted.y) * TILE + TILE * 0.5)
	var mouse_ok := await _mouse_move_to_world(wanted_world)
	for i in 3:
		await process_frame
	var preview: Variant = build.call(&"preview_cell")
	var pointer_tracks := preview is Vector2i and (preview as Vector2i) == wanted
	_note("mouse_move_ok=%s wanted=%s world_point=%s viewport_mouse=%s global_mouse=%s preview_cell=%s" % [
		str(mouse_ok), str(wanted), str(wanted_world), str(root.get_mouse_position()),
		str(hero.get_global_mouse_position()), str(preview),
	])
	var offset := (preview as Vector2i) - wanted if preview is Vector2i else Vector2i(999, 999)
	_note("headless_pointer_projection=%s offset=%s (NOT_RENDERED: no display, window=%s)" % [
		"lands_on_the_aimed_cell" if pointer_tracks else "moves_but_lands_off_the_aim",
		str(offset), str(DisplayServer.window_get_size()),
	])
	if not pointer_tracks:
		# Not a product defect and therefore not a failure: the environment has no
		# display to project through. The consequence is recorded so the acceptance
		# report cannot claim click-precision placement was verified.
		_note(
			"NOT_RENDERED: the preview cell cannot be aimed in headless, so 'the player aimed at a cell and "
			+ "placed it' is unverified; the commit path below is driven by API instead and labelled API_NOT_CLICK"
		)

	# ---- 4. the commit path, with its cost ------------------------------
	var save := _save()
	if save == null:
		_missing("SaveService for the material grant", "res://game/autoload/save_service.gd")
		_done()
		return
	var granted := bool(save.call(&"grant_inventory_item", "oak_wood", "material", 40, GRANT_KEY))
	_note("FIXTURE_GRANT oak_wood=40 ok=%s (materials only; gathering is A0's own journey)" % str(granted))
	_expect(granted, "the product inventory accepts the materials the placement will spend")

	var wood_before := _count(save, "oak_wood")
	var placed_before := int(build.call(&"placed_count"))
	var committed: Array = []
	build.connect(&"placement_committed", func(_entity: String, piece: String, _cell: Vector2i) -> void:
		committed.append(piece))

	var placed := false
	if pointer_tracks:
		await _tap("build_place")
		await physics_frame
		placed = committed.has(PIECE)
		_note("click_placement committed=%s" % JSON.stringify(committed))
	else:
		var cell := _legal_cell_near(hero_cell, build)
		_note("API_NOT_CLICK candidate_cell=%s validate=%s" % [
			str(cell), JSON.stringify(String(build.call(&"validate_cell", cell))),
		])
		if cell != Vector2i(-1, -1):
			var result: Dictionary = build.call(&"try_place", cell)
			await physics_frame
			_note("API_NOT_CLICK try_place=%s" % JSON.stringify(result))
			placed = bool(result.get("ok", false)) and committed.has(PIECE)
	_expect(placed, "one placement of %s commits exactly one structure and emits one signal" % PIECE)
	_expect(int(build.call(&"placed_count")) == placed_before + 1,
		"the placed piece is materialised in the world (placed_count %d -> %d)" % [placed_before, int(build.call(&"placed_count"))])
	var wood_after := _count(save, "oak_wood")
	_note("oak_wood %d -> %d (foundation costs 2)" % [wood_before, wood_after])
	_expect(wood_before - wood_after == 2, "the placement spends exactly its catalogue cost of 2 oak wood")

	# ---- 5. a rock cell is refused, by name -----------------------------
	# The nearest solid cell can also fall inside an encounter exclusion, which is
	# refused earlier in the product's own order. Walk outwards until a solid cell
	# reaches the terrain rule itself, so the assertion is about `solid_terrain` and
	# not about whichever rule happened to fire first.
	var refused := false
	var tried := 0
	for solid: Vector2i in _solid_cells():
		tried += 1
		var reason := String(build.call(&"validate_cell", solid))
		_note("validate_cell(solid=%s)=%s" % [str(solid), JSON.stringify(reason)])
		if reason == "solid_terrain":
			refused = true
			break
		if tried >= 5:
			break
	_expect(refused, "a solid cell is refused by name as solid_terrain rather than silently accepted")

	# Leave build mode the way a player does, so a later probe sees a clean world.
	await _tap("build_toggle")
	var closed: Dictionary = build.call(&"build_hud_status")
	_expect(not bool(closed.get("active", true)), "the same key closes build mode")
	_release_all()
	_done()


# --------------------------------------------------------------------- helpers
func _count(save: Node, item: String) -> int:
	if not save.has_method(&"inventory_totals"):
		return -1
	var totals: Dictionary = save.call(&"inventory_totals")
	return int(totals.get(item, 0))


func _legal_cell_near(origin: Vector2i, build: Node) -> Vector2i:
	for radius in range(1, 6):
		for offset: Vector2i in [
			Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius), Vector2i(0, -radius),
			Vector2i(radius, radius), Vector2i(-radius, radius), Vector2i(radius, -radius), Vector2i(-radius, -radius),
		]:
			var cell: Vector2i = origin + offset
			if String(build.call(&"validate_cell", cell)) == "":
				return cell
	return Vector2i(-1, -1)


## In-bounds solid cells, nearest first. The bounds check matters: the world's edge
## column reports as solid and would otherwise be refused as `outside_world`, which
## tests a different rule.
func _solid_cells() -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	if world_node == null or not world_node.has_method(&"is_solid_cell"):
		return cells
	var origin := _hero_cell()
	for radius in range(2, 60):
		for offset: Vector2i in [Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius), Vector2i(0, -radius)]:
			var cell: Vector2i = origin + offset
			if not _in_bounds(cell):
				continue
			if bool(world_node.call(&"is_solid_cell", cell.x, cell.y)):
				cells.append(cell)
	return cells


func _in_bounds(cell: Vector2i) -> bool:
	if traversability != null and traversability.has_method(&"in_bounds"):
		return bool(traversability.call(&"in_bounds", cell))
	if world_node == null:
		return false
	return cell.x >= 0 and cell.y >= 0 \
		and cell.x < int(world_node.get(&"width")) and cell.y < int(world_node.get(&"height"))


func _finish() -> void:
	_release_all()
	super._finish()
