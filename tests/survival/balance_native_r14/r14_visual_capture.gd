extends Node
## A7 round-14 visual control set (test code; shipped nowhere).
##
## Round 12 and round 13 each produced a house capture that was *itself* broken: a
## harness that stood inside the wall it was placing, so the room never sealed and
## the frame proved nothing about a home. A malformed fixture is not an oracle.
##
## This scene therefore builds **two deliberately different controls** in the real
## composed product, in a real window, and photographs both:
##
##   A. VALID    — a paid, closed room with a door, a roof, a bed and a chest,
##                 placed through the product's own `select_piece` / `validate_cell`
##                 / `try_place` / `activate_bed` doors. Materials are
##                 `FIXTURE_GRANT`ed and printed as such: this proves what a
##                 complete home *is and looks like*, not that a player funded it.
##                 Photographed at 720p, 1440p and 2160p from outside the door, and
##                 once from inside the room.
##   B. BLOCKED  — the same build door refusing the things a player actually gets
##                 wrong, each refusal quoted verbatim: a wall on the Hero's own
##                 cell, a bed with no room, a station recipe out of reach. This is
##                 the error case, kept separate so it cannot contaminate A.
##
## Nothing here edits owner code, invents art, or upgrades a refusal into a pass.
##   godot --path <composition> --resolution 1280x720 \
##     res://tests/survival/balance_native_r14/r14_visual_capture.tscn -- --out=/abs/dir

const WORLD_SCENE := "res://game/overworld/chapter1_overworld.tscn"
const DEFAULT_SIZES := "1280x720,2560x1440,3840x2160"

var out_dir := ""
var sizes: Array[Vector2i] = []
var world: Node = null
var build: Node = null
var hero: Node2D = null
var facts: Dictionary = {}
var report: Array[Dictionary] = []


func _ready() -> void:
	var out := ""
	var size_arg := DEFAULT_SIZES
	for raw: String in OS.get_cmdline_user_args():
		if raw.begins_with("--out="):
			out = raw.substr(6)
		elif raw.begins_with("--sizes="):
			size_arg = raw.substr(8)
	out_dir = out if not out.is_empty() else ProjectSettings.globalize_path("user://r14_captures")
	DirAccess.make_dir_recursive_absolute(out_dir)
	for token: String in size_arg.split(",", false):
		var parts := token.split("x")
		if parts.size() == 2:
			sizes.append(Vector2i(int(parts[0]), int(parts[1])))
	if sizes.is_empty():
		sizes.append(Vector2i(1280, 720))
	_capture.call_deferred()


func _capture() -> void:
	print("A7CTRL start out=%s sizes=%s display=%s" % [out_dir, str(sizes), DisplayServer.get_name()])
	if not await _mount_world():
		_finish(1)
		return
	var valid: Dictionary = await _control_valid()
	await _control_blocked(valid)
	await _photograph(valid)
	_finish(0)


# ------------------------------------------------------------------ mount
func _mount_world() -> bool:
	if not ResourceLoader.exists(WORLD_SCENE):
		print("A7CTRL FAIL the production overworld is not in this composition")
		return false
	var save := get_node_or_null("/root/SaveService")
	if save != null and save.has_method(&"configure_storage"):
		save.call(&"configure_storage", "user://tests/a7_r14_controls_%d.json" % Time.get_ticks_usec(), true)
	var packed := load(WORLD_SCENE) as PackedScene
	if packed == null:
		print("A7CTRL FAIL the overworld scene did not load")
		return false
	world = packed.instantiate()
	if world == null:
		print("A7CTRL FAIL the overworld did not instantiate")
		return false
	get_tree().root.add_child(world)
	var deadline := Time.get_ticks_msec() + 120_000
	while Time.get_ticks_msec() < deadline:
		if world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready")):
			break
		await get_tree().process_frame
	if not (world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready"))):
		print("A7CTRL FAIL the overworld never reached READY (build_error=%s)" % String(world.get(&"build_error")))
		return false
	build = world.get(&"survival_build") as Node
	hero = world.get(&"player") as Node2D
	facts["world_scene"] = WORLD_SCENE
	facts["hero_spawn"] = [hero.global_position.x, hero.global_position.y] if hero != null else null
	facts["has_survival_build"] = build != null
	facts["viewport"] = [get_tree().root.size.x, get_tree().root.size.y]
	facts["content_scale_size"] = [get_tree().root.content_scale_size.x, get_tree().root.content_scale_size.y]
	var cam := get_viewport().get_camera_2d()
	facts["camera_zoom"] = [cam.zoom.x, cam.zoom.y] if cam != null else null
	facts["render"] = {
		"adapter": RenderingServer.get_video_adapter_name(),
		"display": DisplayServer.get_name(),
		"scale_mode": get_tree().root.content_scale_mode,
		"scale_factor": get_tree().root.content_scale_factor,
	}
	print("A7CTRL world READY hero=%s build=%s" % [
		str(hero.global_position) if hero != null else "none", "yes" if build != null else "no"])
	return hero != null


# ------------------------------------------------------- A. the valid control
func _control_valid() -> Dictionary:
	var out := {"built": false, "reason": ""}
	if build == null:
		out["reason"] = "no_survival_build"
		facts["valid"] = out
		return out
	# FIXTURE: the materials, and nothing else, are granted.
	_grant("oak_wood", "material", 60)
	_grant("iron_scrap", "material", 30)
	_grant("workbench_kit", "material", 1)
	var hero_cell := _cell_of(hero.global_position)
	facts["census_at_spawn"] = _reason_census(hero_cell)
	var plot := Vector2i(-1, -1)
	var radius := 1
	var walks: Array = []
	# The spawn is inside the Ashen Refuge, whose cells answer `protected_place`.
	# A player walks out before building; the control does the same, with real keys.
	for attempt in 5:
		plot = _find_plot(_cell_of(hero.global_position), 1)
		if plot == Vector2i(-1, -1):
			plot = _find_plot(_cell_of(hero.global_position), 2)
			radius = 2
		if plot != Vector2i(-1, -1):
			break
		if attempt < 4:
			var direction: String = ["move_down", "move_right", "move_up", "move_left"][attempt]
			await _walk(direction, 260)
			walks.append({"attempt": attempt, "direction": direction,
				"hero_cell": [_cell_of(hero.global_position).x, _cell_of(hero.global_position).y]})
	facts["walks"] = walks
	if plot == Vector2i(-1, -1):
		out["reason"] = "no_legal_plot"
		facts["valid"] = out
		return out
	# Stand clear of the ring: a wall on the Hero's own cell is refused by the
	# product (`hero_in_footprint`), so a builder who never steps out can never
	# seal a room. That is a fact about the build door, not a harness excuse.
	var steps := 0
	var dirs := ["move_down", "move_right", "move_up", "move_left"]
	while _inside_ring(_cell_of(hero.global_position), plot, radius) and steps < 40:
		await _walk(dirs[int(steps / 10) % dirs.size()], 8)
		steps += 1
	facts["steps_out_of_footprint"] = steps
	var door_cell := plot + Vector2i(0, radius)
	var attempts: Array = []
	var placed := 0
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if maxi(absi(dx), absi(dy)) != radius:
				continue
			var cell := plot + Vector2i(dx, dy)
			var piece := "door_wood" if cell == door_cell else "wall_wood"
			var ring_result := _place(piece, cell)
			attempts.append([piece, cell.x, cell.y, _ok(ring_result), String(ring_result.get("reason", ""))])
			if _ok(ring_result):
				placed += 1
	for dy in range(-radius + 1, radius):
		for dx in range(-radius + 1, radius):
			_place("foundation_wood", plot + Vector2i(dx, dy))
	var bed_result := _place("bed_wood", plot)
	var bed := _ok(bed_result)
	var bed_id := String(bed_result.get("entity_id", ""))
	var chest_cell := _free_cell("chest_wood", plot, radius + 1, 5)
	var chest_result := _place("chest_wood", chest_cell) if chest_cell != Vector2i(-1, -1) else {}
	var chest := _ok(chest_result)
	var bench_cell := _free_cell("station_workbench", plot, radius + 1, 6)
	var bench_result := _place("station_workbench", bench_cell) if bench_cell != Vector2i(-1, -1) else {}
	var bench := _ok(bench_result)
	var bench_id := String(bench_result.get("entity_id", ""))
	var room := ""
	if build.get(&"room_topology") != null:
		room = String(build.get(&"room_topology").call(&"room_at", plot))
	# The bed is only a spawn anchor once it is activated, and that is its own
	# transaction: `activate_bed(entity_id, validator)`, with the scene supplying
	# ownership/proximity/enclosure. The control passes the product's own
	# "is this cell safe to wake in" answer rather than a bare `true`.
	var bed_activated := false
	var bed_activation := {}
	if bed and not bed_id.is_empty():
		var service: Node = world.get(&"survival_service") as Node
		if service != null and service.has_method(&"activate_bed"):
			var validator := func() -> bool: return String(build.call(&"validate_cell", plot)).is_empty()
			bed_activation = service.call(&"activate_bed", bed_id, validator) as Dictionary
			bed_activated = bool(bed_activation.get("ok", false))
	out = {
		"built": placed > 0, "origin": [plot.x, plot.y], "radius": radius,
		"ring_pieces": placed, "ring_expected": 8 if radius == 1 else 16,
		"door_cell": [door_cell.x, door_cell.y],
		"door_placed": _piece_at(door_cell) == "door_wood",
		"chest_reason": String(chest_result.get("reason", "")),
		"bench_reason": String(bench_result.get("reason", "")),
		"bed_placed": bed, "bed_id": bed_id, "bed_activated": bed_activated,
		"bed_activation": bed_activation, "workbench_id": bench_id,
		"chest_placed": chest, "chest_cell": [chest_cell.x, chest_cell.y],
		"workbench_placed": bench, "workbench_cell": [bench_cell.x, bench_cell.y],
		"room": room, "attempts": attempts,
	}
	facts["valid"] = out
	print("A7CTRL VALID plot=%s r=%d ring=%d/%d door=%s bed=%s/%s chest=%s bench=%s room=%s"
		% [str(plot), radius, placed, out["ring_expected"], str(out["door_placed"]), str(bed),
			str(bed_activated), str(chest), str(bench), room if not room.is_empty() else "<none>"])
	out["door_point"] = Vector2(door_cell.x * 16.0 + 8.0, (door_cell.y + 2) * 16.0 + 8.0)
	out["interior_point"] = Vector2(plot.x * 16.0 + 8.0, plot.y * 16.0 + 8.0)
	return out


# ---------------------------------------------------- B. the blocked controls
## Every row is a *refusal the product actually returns*, quoted verbatim, for an
## action a player plausibly takes and gets wrong. Kept apart from the valid house
## so a rejection can never be mistaken for the home's appearance.
func _control_blocked(valid: Dictionary) -> void:
	var rows: Array = []
	if build == null:
		facts["blocked"] = rows
		return
	# (i) A wall on the cell the Hero stands in. The preview says the cell is legal
	# and the commit refuses it: two different answers from one build door.
	var hero_cell := _cell_of(hero.global_position)
	if bool(build.call(&"select_piece", "wall_wood")):
		var preview := String(build.call(&"validate_cell", hero_cell))
		var commit: Dictionary = build.call(&"try_place", hero_cell) as Dictionary
		rows.append({"case": "wall_on_hero_cell", "cell": [hero_cell.x, hero_cell.y],
			"preview_reason": preview, "preview_says_legal": preview.is_empty(),
			"commit_ok": bool(commit.get("ok", false)),
			"commit_reason": String(commit.get("reason", ""))})
	# (ii) A bed outside any room: `bed_requires_room` from the product's topology.
	var probe_cell := hero_cell + Vector2i(3, 0)
	if bool(build.call(&"select_piece", "bed_wood")):
		var preview_bed := String(build.call(&"validate_cell", probe_cell))
		var commit_bed: Dictionary = build.call(&"try_place", probe_cell) as Dictionary
		rows.append({"case": "bed_without_room", "cell": [probe_cell.x, probe_cell.y],
			"preview_reason": preview_bed, "preview_says_legal": preview_bed.is_empty(),
			"commit_ok": bool(commit_bed.get("ok", false)),
			"commit_reason": String(commit_bed.get("reason", ""))})
	# (iii) A furnace recipe asked of the workbench the player just built: physical
	# station, wrong kind. The session answers, the player must read it.
	var session: Node = world.get(&"economy_session") as Node
	var bench_id := String(valid.get("workbench_id", ""))
	if session != null and session.has_method(&"queue_recipe") and not bench_id.is_empty():
		var wrong: Dictionary = session.call(&"queue_recipe", "smelt_iron", bench_id) as Dictionary
		rows.append({"case": "furnace_recipe_at_workbench", "station": bench_id,
			"ok": bool(wrong.get("ok", false)), "reason": String(wrong.get("reason", ""))})
	# (iv) The same bench reached from across the map — the reach rule, not the kind.
	if session != null and not bench_id.is_empty():
		var keep := hero.global_position
		hero.global_position = keep + Vector2(400, 0)
		var far: Dictionary = session.call(&"queue_recipe", "make_parts", bench_id) as Dictionary
		hero.global_position = keep
		rows.append({"case": "recipe_from_out_of_reach", "distance_px": 400,
			"ok": bool(far.get("ok", false)), "reason": String(far.get("reason", ""))})
	facts["blocked"] = rows
	for row: Dictionary in rows:
		print("A7CTRL BLOCKED %s -> %s" % [String(row.get("case", "")), JSON.stringify(row)])


# ------------------------------------------------------------- photography
## Three framings of the valid home from the door, plus one interior frame.
func _photograph(valid: Dictionary) -> void:
	if not bool(valid.get("built", false)):
		print("A7CTRL NOTE no valid home to photograph; capturing the world alone")
		for size: Vector2i in sizes:
			await _capture_one(size, "r14_world_%dx%d.png")
		return
	hero.global_position = valid["door_point"] as Vector2
	await _wait_frames(20)
	for size: Vector2i in sizes:
		await _capture_one(size, "r14_home_%dx%d.png")
	# Inside the room: does the roof let a player see their own home?
	hero.global_position = valid["interior_point"] as Vector2
	await _wait_frames(24)
	await _capture_one(sizes[0], "r14_home_interior_%dx%d.png")
	facts["home_shots"] = {
		"outside_from": valid["door_point"], "inside_at": valid["interior_point"],
		"frames": ["r14_home_<w>x<h>.png", "r14_home_interior_<w>x<h>.png"],
	}


func _capture_one(size: Vector2i, name_pattern: String) -> void:
	DisplayServer.window_set_size(size)
	get_tree().root.size = size
	await _wait_frames(12)
	await RenderingServer.frame_post_draw
	var texture := get_tree().root.get_texture()
	var image: Image = texture.get_image() if texture != null else null
	var path := out_dir.path_join(name_pattern % [size.x, size.y])
	var saved := ERR_UNAVAILABLE
	var bytes := 0
	var colours := 0
	var image_size := [0, 0]
	if image != null:
		saved = image.save_png(path)
		image_size = [image.get_width(), image.get_height()]
		colours = _sample_colours(image)
		if FileAccess.file_exists(path):
			bytes = FileAccess.get_file_as_bytes(path).size()
	var row := {"file": path.get_file(), "size": [size.x, size.y], "viewport": [get_tree().root.size.x, get_tree().root.size.y],
		"image_size": image_size, "save_result": saved, "png_bytes": bytes, "sampled_colours": colours, "path": path}
	report.append(row)
	print("A7CTRL SHOT %s %dx%d bytes=%d colours=%d" % [path.get_file(), size.x, size.y, bytes, colours])


func _sample_colours(image: Image) -> int:
	var seen := {}
	var width := image.get_width()
	var height := image.get_height()
	for i in range(0, 33):
		for j in range(0, 19):
			var x := mini(width - 1, int(width * (float(i) / 32.0)))
			var y := mini(height - 1, int(height * (float(j) / 18.0)))
			seen[image.get_pixel(x, y).to_rgba32()] = true
	return seen.size()


# ---------------------------------------------------------------- helpers
func _grant(item_id: String, kind: String, quantity: int) -> void:
	var save := get_node_or_null("/root/SaveService")
	if save == null:
		return
	var ok := bool(save.call(&"grant_inventory_item", StringName(item_id), StringName(kind), quantity,
		"a7_r14_fixture_%s_%d" % [item_id, Time.get_ticks_usec()], {"source": "a7.r14.capture_fixture"}))
	print("A7CTRL FIXTURE_GRANT %s x%d -> %s" % [item_id, quantity, str(ok)])


func _reason_census(center: Vector2i) -> Dictionary:
	if not bool(build.call(&"select_piece", "wall_wood")):
		return {"select_piece_refused": 1}
	var counts := {}
	for r in [1, 2, 3, 5, 8, 12]:
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var reason := String(build.call(&"validate_cell", center + Vector2i(dx, dy)))
				if reason.is_empty():
					reason = "<ok>"
				counts[reason] = int(counts.get(reason, 0)) + 1
	return counts


func _find_plot(hero_cell: Vector2i, radius: int) -> Vector2i:
	if not bool(build.call(&"select_piece", "wall_wood")):
		return Vector2i(-1, -1)
	for r in range(1, 17):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var center := hero_cell + Vector2i(dx, dy)
				# A plot whose ring contains the Hero can never seal: the product
				# refuses a wall on his own cell.
				if maxi(absi(hero_cell.x - center.x), absi(hero_cell.y - center.y)) <= radius:
					continue
				var all_ok := true
				for wy in range(-radius, radius + 1):
					for wx in range(-radius, radius + 1):
						if maxi(absi(wx), absi(wy)) != radius:
							continue
						if not String(build.call(&"validate_cell", center + Vector2i(wx, wy))).is_empty():
							all_ok = false
							break
					if not all_ok:
						break
				if all_ok:
					return center
	return Vector2i(-1, -1)


func _free_cell(piece: String, origin: Vector2i, from_radius: int, to_radius: int) -> Vector2i:
	if not bool(build.call(&"select_piece", piece)):
		return Vector2i(-1, -1)
	for r in range(from_radius, to_radius + 1):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var cell := origin + Vector2i(dx, dy)
				if String(build.call(&"validate_cell", cell)).is_empty():
					return cell
	return Vector2i(-1, -1)


func _place(piece: String, cell: Vector2i) -> Dictionary:
	if not bool(build.call(&"select_piece", piece)):
		return {"ok": false, "reason": "select_piece_refused"}
	var result: Dictionary = build.call(&"try_place", cell) as Dictionary
	if not bool(result.get("ok", false)):
		print("A7CTRL NOTE placement %s at %s refused: %s" % [piece, str(cell), String(result.get("reason", "?"))])
	return result


func _ok(result: Dictionary) -> bool:
	return bool(result.get("ok", false))


func _piece_at(cell: Vector2i) -> String:
	if build == null:
		return ""
	var table: Variant = build.get(&"_placed")
	if not table is Dictionary:
		return ""
	for value: Variant in (table as Dictionary).values():
		var structure := value as Node
		if structure != null and Vector2i(roundi(structure.global_position.x / 16.0), roundi(structure.global_position.y / 16.0)) == cell:
			return String(structure.get(&"piece_id"))
	return ""


func _inside_ring(cell: Vector2i, center: Vector2i, radius: int) -> bool:
	return maxi(absi(cell.x - center.x), absi(cell.y - center.y)) <= radius + 1


func _walk(direction: String, frames: int) -> void:
	Input.action_press(direction)
	for i in frames:
		await get_tree().physics_frame
	Input.action_release(direction)


func _wait_frames(count: int) -> void:
	for i in count:
		await get_tree().process_frame


func _cell_of(point: Vector2) -> Vector2i:
	return Vector2i(floori(point.x / 16.0), floori(point.y / 16.0))


func _finish(code: int) -> void:
	var summary := {
		"schema": "soh.a7.r14.visual_controls.v1",
		"label": "FIXTURE_SETUP for materials only; every placement goes through the product's own build door",
		"engine": Engine.get_version_info().get("string", ""),
		"display_server": DisplayServer.get_name(),
		"adapter": RenderingServer.get_video_adapter_name(),
		"out_dir": out_dir,
		"facts": facts,
		"rows": report,
	}
	var json_path := out_dir.path_join("r14_visual_controls.json")
	var file := FileAccess.open(json_path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(summary, "  ", false))
		file.close()
	print("A7CTRL summary %s" % json_path)
	print("A7CTRL DONE code=%d" % code)
	if world != null and is_instance_valid(world):
		world.free()
	get_tree().quit(code)
