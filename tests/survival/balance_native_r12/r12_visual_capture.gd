extends Node
## A7 round-12 visual capture (test code; shipped nowhere).
##
## Runs inside a real window (Xvfb + llvmpipe in CI) against the pinned
## `r12_full` composition, builds a small house through the product's own doors,
## and writes one true 1x PNG per requested resolution plus a JSON of the
## measurements that a resized window cannot fake.
##
##   godot --path <composition> --resolution 1280x720 \
##     res://tests/survival/balance_native_r12/r12_visual_capture.tscn -- \
##     --out=/abs/dir [--sizes=1280x720,2560x1440,3840x2160]
##
## Nothing here is a product feature: the house is paid for with `FIXTURE_GRANT`
## materials (printed as such), and the PNGs are evidence for a human, not a pass.

const WORLD_SCENE := "res://game/overworld/chapter1_overworld.tscn"
const DEFAULT_SIZES := "1280x720,2560x1440,3840x2160"

var out_dir := ""
var sizes: Array[Vector2i] = []
var world: Node = null
var build: Node = null
var hero: Node2D = null
var report: Array[Dictionary] = []


func _ready() -> void:
	var out := ""
	var size_arg := DEFAULT_SIZES
	for raw: String in OS.get_cmdline_user_args():
		if raw.begins_with("--out="):
			out = raw.substr(6)
		elif raw.begins_with("--sizes="):
			size_arg = raw.substr(8)
	out_dir = out if not out.is_empty() else ProjectSettings.globalize_path("user://r12_captures")
	DirAccess.make_dir_recursive_absolute(out_dir)
	for token: String in size_arg.split(",", false):
		var parts := token.split("x")
		if parts.size() == 2:
			sizes.append(Vector2i(int(parts[0]), int(parts[1])))
	if sizes.is_empty():
		sizes.append(Vector2i(1280, 720))
	_capture.call_deferred()


func _capture() -> void:
	print("A7CAPTURE start out=%s sizes=%s display=%s" % [out_dir, str(sizes), DisplayServer.get_name()])
	var ok := await _mount_world()
	if not ok:
		_finish(1)
		return
	await _build_house()
	# Let the camera settle on the Hero and the roof derive its footprint.
	await _wait_frames(20)
	for size: Vector2i in sizes:
		await _capture_one(size)
	_finish(0)


func _mount_world() -> bool:
	if not ResourceLoader.exists(WORLD_SCENE):
		print("A7CAPTURE FAIL the production overworld is not in this composition")
		return false
	var save := get_node_or_null("/root/SaveService")
	if save != null and save.has_method(&"configure_storage"):
		save.call(&"configure_storage", "user://tests/a7_r12_capture_%d.json" % Time.get_ticks_usec(), true)
	var packed := load(WORLD_SCENE) as PackedScene
	if packed == null:
		print("A7CAPTURE FAIL the overworld scene did not load")
		return false
	world = packed.instantiate()
	if world == null:
		print("A7CAPTURE FAIL the overworld did not instantiate")
		return false
	get_tree().root.add_child(world)
	var deadline := Time.get_ticks_msec() + 120_000
	while Time.get_ticks_msec() < deadline:
		if world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready")):
			break
		await get_tree().process_frame
	if not (world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready"))):
		print("A7CAPTURE FAIL the overworld never reached READY (build_error=%s)" % String(world.get(&"build_error")))
		return false
	build = world.get(&"survival_build") as Node
	hero = world.get(&"player") as Node2D
	print("A7CAPTURE world READY hero=%s build=%s" % [
		str(hero.global_position) if hero != null else "none", "yes" if build != null else "no",
	])
	return hero != null


# ------------------------------------------------------------------- 1. a house
## The home is built exactly as a player builds it: select a piece, validate the
## cell, commit. Only the materials are a fixture.
func _build_house() -> void:
	if build == null:
		print("A7CAPTURE NOTE no survival build system; capturing the world alone")
		return
	_grant("oak_wood", "material", 60)
	_grant("iron_scrap", "material", 30)
	_grant("workbench_kit", "material", 1)
	var hero_cell := _cell_of(hero.global_position)
	var plot := _find_plot(hero_cell, 2)
	var radius := 2
	if plot == Vector2i(-1, -1):
		plot = _find_plot(hero_cell, 1)
		radius = 1
	if plot == Vector2i(-1, -1):
		print("A7CAPTURE NOTE no legal plot near the spawn; capturing the world alone")
		return
	var placed := 0
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if maxi(absi(dx), absi(dy)) != radius:
				continue
			if _place("wall_wood", plot + Vector2i(dx, dy)):
				placed += 1
	for dy in range(-radius + 1, radius):
		for dx in range(-radius + 1, radius):
			_place("foundation_wood", plot + Vector2i(dx, dy))
	_place("bed_wood", plot)
	var chest_cell := _free_cell("chest_wood", plot, radius + 1, 6)
	if chest_cell != Vector2i(-1, -1):
		_place("chest_wood", chest_cell)
	var bench_cell := _free_cell("station_workbench", plot, radius + 1, 6)
	if bench_cell != Vector2i(-1, -1):
		_place("station_workbench", bench_cell)
	var room := ""
	if build.get(&"room_topology") != null:
		room = String(build.get(&"room_topology").call(&"room_at", plot))
	print("A7CAPTURE house origin=%s radius=%d walls=%d room=%s" % [str(plot), radius, placed, room if not room.is_empty() else "<none>"])
	report.append({"house": {"origin": [plot.x, plot.y], "radius": radius, "walls": placed, "room": room}})


func _grant(item_id: String, kind: String, quantity: int) -> void:
	var save := get_node_or_null("/root/SaveService")
	if save == null:
		return
	var ok := bool(save.call(&"grant_inventory_item", StringName(item_id), StringName(kind), quantity,
		"a7_r12_capture_%s_%d" % [item_id, Time.get_ticks_usec()], {"source": "a7.r12.capture_fixture"}))
	print("A7CAPTURE FIXTURE_GRANT %s x%d -> %s" % [item_id, quantity, str(ok)])


func _find_plot(hero_cell: Vector2i, radius: int) -> Vector2i:
	for r in range(1, 7):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				var center := hero_cell + Vector2i(dx, dy)
				if bool(build.call(&"select_piece", "wall_wood")):
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


func _place(piece: String, cell: Vector2i) -> bool:
	if not bool(build.call(&"select_piece", piece)):
		return false
	var result: Dictionary = build.call(&"try_place", cell) as Dictionary
	var ok := bool(result.get("ok", false))
	if not ok:
		print("A7CAPTURE NOTE placement %s at %s refused: %s" % [piece, str(cell), String(result.get("reason", "?"))])
	return ok


# ----------------------------------------------------------------- 2. capture
func _capture_one(size: Vector2i) -> void:
	DisplayServer.window_set_size(size)
	get_tree().root.size = size
	await _wait_frames(12)
	# A frame that has actually been drawn; the dummy renderer never reaches this.
	await RenderingServer.frame_post_draw
	var texture := get_tree().root.get_texture()
	var image: Image = texture.get_image() if texture != null else null
	var path := out_dir.path_join("r12_overworld_%dx%d.png" % [size.x, size.y])
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
	var row := {
		"size": [size.x, size.y],
		"image_size": image_size,
		"save_result": saved,
		"png_bytes": bytes,
		"sampled_colours": colours,
		"path": path,
	}
	report.append(row)
	print("A7CAPTURE %dx%d -> image=%s save=%d bytes=%d colours=%d %s"
		% [size.x, size.y, str(image_size), saved, bytes, colours, path])


## Distinct colours over a coarse grid: a blank (or single-colour) frame is not a
## screenshot of a game, and this catches that without a human.
func _sample_colours(image: Image) -> int:
	if image == null or image.is_empty():
		return 0
	var seen := {}
	var width := image.get_width()
	var height := image.get_height()
	for i in range(0, 33):
		for j in range(0, 19):
			var x := mini(width - 1, int(width * (float(i) / 32.0)))
			var y := mini(height - 1, int(height * (float(j) / 18.0)))
			seen[image.get_pixel(x, y).to_rgba32()] = true
	return seen.size()


func _wait_frames(count: int) -> void:
	for i in count:
		await get_tree().process_frame


func _cell_of(point: Vector2) -> Vector2i:
	return Vector2i(floori(point.x / 16.0), floori(point.y / 16.0))


# ------------------------------------------------------------------- 3. done
func _finish(code: int) -> void:
	var summary := {
		"schema": "soh.a7.r12.visual_capture.v1",
		"engine": Engine.get_version_info().get("string", ""),
		"display_server": DisplayServer.get_name(),
		"adapter": RenderingServer.get_video_adapter_name(),
		"out_dir": out_dir,
		"rows": report,
	}
	var json_path := out_dir.path_join("r12_visual_measurements.json")
	var file := FileAccess.open(json_path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(summary, "  ", false))
		file.close()
	print("A7CAPTURE summary %s" % json_path)
	print("A7CAPTURE DONE code=%d" % code)
	if world != null and is_instance_valid(world):
		world.free()
	get_tree().quit(code)
