extends SceneTree
## A1 isolated native visual fixture for the survival world art presentation.
## NOT production: no A0 mount, no A3 economy, no SaveService mutation, no A8
## interaction engine. It loads the real Knight, paints A1 visual-only art,
## reuses OverworldOcclusion, and captures native frames at 720p / 1440p / 2160p.

const INDEX := "res://data/survival/world/art/presentations.v1.json"
const ATLAS := "res://data/survival/world/art/atlas.v1.json"
const KNIGHT := "res://game/characters/knight/knight.tscn"

var failures: Array[String] = []
var checks := 0
var out_root := "artifacts/a1-world-art"
var resolutions: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
var screenshots: Array[String] = []
var stats_rows: Array[Dictionary] = []
var host: Node2D
var hero: CharacterBody2D

func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
		elif arg.begins_with("--resolutions="):
			resolutions.clear()
			for part: String in arg.trim_prefix("--resolutions=").split(","):
				var wh: PackedStringArray = part.split("x")
				if wh.size() == 2:
					resolutions.append(Vector2i(int(wh[0]), int(wh[1])))
	call_deferred("_run")

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("WORLD_ART PASS: " + label)
	else:
		failures.append(label)
		print("WORLD_ART FAIL: " + label)

func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}

func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))

func _foot(cell: Array) -> Vector2:
	return Vector2(float(cell[0]) * 16 + 8, float(cell[1]) * 16 + 15)

func _collision_count(node: Node) -> int:
	var n := 1 if node is CollisionObject2D else 0
	for child: Node in node.get_children():
		n += _collision_count(child)
	return n

func _capture(name: String) -> void:
	await process_frame
	await process_frame
	var image := root.get_texture().get_image()
	var path := _out(name)
	if image != null and image.save_png(path) == OK:
		screenshots.append(path)
		_expect(true, "native capture %s (%dx%d)" % [name, image.get_width(), image.get_height()])
	else:
		_expect(false, "native capture " + name)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(_out(""))
	var save := root.get_node_or_null("SaveService")
	if save != null and save.has_method("configure_storage"):
		save.call("configure_storage", "user://tests/a1_world_art_native.json", true)
	host = Node2D.new()
	host.name = "A1WorldArtHost"
	root.add_child(host)
	var knight_scene := load(KNIGHT) as PackedScene
	hero = knight_scene.instantiate() as CharacterBody2D
	host.add_child(hero)
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rect := body_shape.shape as RectangleShape2D
	_expect(rect.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8), "real pinned Knight body unchanged")
	var camera := hero.get_node("Camera") as Camera2D
	camera.limit_left = -100000
	camera.limit_top = -100000
	camera.limit_right = 100000
	camera.limit_bottom = 100000
	camera.make_current()
	var index := _read_json(INDEX)
	var presentations: Array = index.get("presentations", [])
	_expect(presentations.size() >= 3, "compiled art presentations index loaded (%d)" % presentations.size())
	for res: Vector2i in resolutions:
		root.size = res
		root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
		root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
		await process_frame
		await process_frame
		for raw: Variant in presentations:
			var entry: Dictionary = raw
			var rel := String(entry.path)
			var pres_path := "res://" + rel
			var pres := WorldArtPresentation.new()
			host.add_child(pres)
			var loaded := pres.load_presentation(pres_path, ATLAS)
			_expect(loaded, "presentation loaded " + String(entry.treatment_id))
			if not loaded:
				pres.queue_free()
				continue
			var built := pres.build(hero)
			_expect(built, "presentation built " + String(entry.treatment_id))
			# Reparent the real Knight into the y-sorted prop root so art and Hero
			# sort by feet exactly as in the overworld. No gameplay state changes.
			if built:
				hero.reparent(pres.props_root)
			_expect(_collision_count(pres) == 0, "visual presentation adds zero collision bodies " + String(entry.treatment_id))
			var st := pres.stats()
			st["resolution"] = [res.x, res.y]
			stats_rows.append(st)
			_expect(int(st.props) > 0 and int(st.ground_cells) > 0, "art is non-empty " + String(entry.treatment_id))
			var views: Array = pres.data.get("capture_views", [])
			for vraw: Variant in views:
				var view: Dictionary = vraw
				hero.global_position = _foot(view.center_cell)
				camera.force_update_scroll()
				pres.set_time_of_day(float(view.get("time_of_day", 0.35)))
				pres.snap_occlusion()
				await physics_frame
				var name := "%s_%s_%dx%d.png" % [entry.treatment_id, view.id, res.x, res.y]
				await _capture(name)
			# Keep Hero alive for the next presentation before freeing the art root.
			hero.reparent(host)
			pres.queue_free()
			await process_frame
	var report := {
		"schema": "soh.world.art_native_report.v1",
		"ok": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"screenshots": screenshots,
		"stats": stats_rows,
		"scope": "ISOLATED_NATIVE_VISUAL_FIXTURE_NOT_PRODUCTION",
		"production_native_playable": false,
	}
	var f := FileAccess.open(_out("world_art_native_report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, "  "))
	f.close()
	print("WORLD_ART SUMMARY checks=%d failures=%d captures=%d" % [checks, failures.size(), screenshots.size()])
	quit(0 if failures.is_empty() else 1)
