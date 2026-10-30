extends SceneTree
## A1 isolated native visual fixture for the survival world art presentation.
## NOT production: no A0 mount, no A3 economy, no SaveService mutation, no A8
## interaction engine. It loads the real pinned Knight as a physics/scale proxy,
## paints A1 visual-only art, reuses OverworldOcclusion, proves zero added
## collision, checks inherited VFX light-mask isolation, and captures true
## 720p / 1440p / 2160p frames. Integer-downscaled logical hashes must match.

const INDEX := "res://data/survival/world/art/presentations.v1.json"
const ATLAS := "res://data/survival/world/art/atlas.v1.json"
const KNIGHT := "res://game/characters/knight/knight.tscn"
const VFX := preload("res://game/vfx/vfx_catalog.gd")
const LOGICAL := Vector2i(640, 360)

var failures: Array[String] = []
var checks := 0
var out_root := "artifacts/a1-world-art"
var resolutions: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
var screenshots: Array[String] = []
var capture_rows: Array[Dictionary] = []
var stats_rows: Array[Dictionary] = []
var perf_rows: Array[Dictionary] = []
var host: Node2D
var hero: CharacterBody2D
var camera: Camera2D

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

func _sha_png(image: Image) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(image.save_png_to_buffer())
	return ctx.finish().hex_encode()

func _unique_colors(image: Image) -> int:
	var seen := {}
	for y: int in range(0, image.get_height(), 4):
		for x: int in range(0, image.get_width(), 4):
			seen[image.get_pixel(x, y).to_rgba32()] = true
			if seen.size() > 512:
				return seen.size()
	return seen.size()

func _capture(name: String, res: Vector2i, view_id: String, treatment_id: String) -> Dictionary:
	root.size = res
	await process_frame
	await process_frame
	camera.force_update_scroll()
	await process_frame
	var image := root.get_texture().get_image()
	var row := {"file": name, "resolution": [res.x, res.y], "view_id": view_id, "treatment_id": treatment_id}
	if image == null:
		_expect(false, "native capture returned null " + name)
		return row
	var path := _out(name)
	var saved := image.save_png(path) == OK
	row["saved"] = saved
	row["actual_size"] = [image.get_width(), image.get_height()]
	row["unique_colors_sampled"] = _unique_colors(image)
	var logical := image.duplicate() as Image
	logical.resize(LOGICAL.x, LOGICAL.y, Image.INTERPOLATE_NEAREST)
	row["logical_sha256"] = _sha_png(logical)
	if saved:
		screenshots.append(path)
	_expect(saved and image.get_size() == res and int(row.unique_colors_sampled) >= 64,
		"native capture %s (%dx%d, non-uniform pixels)" % [name, image.get_width(), image.get_height()])
	capture_rows.append(row)
	return row

func _pause_hero() -> void:
	hero.set_physics_process(false)
	hero.set_process(false)
	var anim := hero.get_node_or_null("Sprite") as AnimatedSprite2D
	if anim != null:
		anim.pause()
		anim.frame = 0

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(_out(""))
	root.content_scale_size = LOGICAL
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	var save := root.get_node_or_null("SaveService")
	if save != null and save.has_method("configure_storage"):
		save.call("configure_storage", "user://tests/a1_world_art_native.json", true)
	host = Node2D.new()
	host.name = "A1WorldArtHost"
	root.add_child(host)
	var knight_scene := load(KNIGHT) as PackedScene
	hero = knight_scene.instantiate() as CharacterBody2D
	host.add_child(hero)
	_pause_hero()
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rect := body_shape.shape as RectangleShape2D
	_expect(rect.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8), "real pinned Knight body unchanged")
	camera = hero.get_node("Camera") as Camera2D
	camera.position_smoothing_enabled = false
	camera.limit_left = -100000
	camera.limit_top = -100000
	camera.limit_right = 100000
	camera.limit_bottom = 100000
	camera.zoom = Vector2.ONE
	camera.make_current()
	var index := _read_json(INDEX)
	var presentations: Array = index.get("presentations", [])
	_expect(presentations.size() >= 3, "compiled art presentations index loaded (%d)" % presentations.size())
	var gold_probe: Dictionary = {}
	for raw: Variant in presentations:
		var entry: Dictionary = raw
		var pres_path := "res://" + String(entry.path)
		var pres := WorldArtPresentation.new()
		host.add_child(pres)
		var loaded := pres.load_presentation(pres_path, ATLAS)
		_expect(loaded, "presentation loaded " + String(entry.treatment_id))
		if not loaded:
			pres.queue_free()
			continue
		var built := pres.build(hero)
		_expect(built, "presentation built " + String(entry.treatment_id))
		var st0 := pres.stats()
		_expect(int(st0.collision_bodies) == 0 and int(st0.interactive_areas) == 0 and int(st0.tile_physics_layers) == 0,
			"visual presentation adds zero collision bodies " + String(entry.treatment_id))
		# Reparent the real Knight into the y-sorted prop root so art and Hero
		# sort by feet exactly as in the overworld. No gameplay state changes.
		hero.reparent(pres.props_root)
		_expect(pres.bind_focus(hero), "focus rebound after foot-sort reparent " + String(entry.treatment_id))
		var st := pres.stats()
		_expect(int(st.collision_bodies) == 0 and int(st.interactive_areas) == 0,
			"collision count excludes bound Hero and remains zero " + String(entry.treatment_id))
		st["resolution_scope"] = "all"
		stats_rows.append(st)
		if String(entry.treatment_id).ends_with("_region_window"):
			_expect(int(st.props) >= 20 and not String(pres.data.get("region_id", "")).is_empty(),
				"region window has authored density and canonical region " + String(entry.treatment_id))
		_expect(int(st.props) > 0 and int(st.ground_cells) > 0 and int(st.overlays) > 0,
			"art is non-empty with road/bank overlays " + String(entry.treatment_id))
		# Rebuild guard: a second build must not duplicate children.
		var before_props := int(st.props)
		_expect(pres.build(hero), "rebuild succeeds " + String(entry.treatment_id))
		hero.reparent(pres.props_root)
		pres.bind_focus(hero)
		_expect(int(pres.stats().props) == before_props and int(pres.stats().collision_bodies) == 0,
			"rebuild is idempotent and still collision-free " + String(entry.treatment_id))
		# Atomic validation: a bad frame must not replace the loaded document.
		var bad := pres.data.duplicate(true)
		bad["ground"]["rows"][0][0] = "__missing_frame__"
		var bad_path := _out("bad_%s.json" % entry.treatment_id)
		var bf := FileAccess.open(bad_path, FileAccess.WRITE)
		bf.store_string(JSON.stringify(bad))
		bf.close()
		var old_tid := String(pres.data.treatment_id)
		_expect(not pres.load_presentation(bad_path, ATLAS) and not pres.last_error.is_empty() and String(pres.data.treatment_id) == old_tid,
			"invalid presentation rejected atomically " + String(entry.treatment_id))
		_expect(pres.load_presentation(pres_path, ATLAS), "valid presentation reloads " + String(entry.treatment_id))
		var views: Array = pres.data.get("capture_views", [])
		for vraw: Variant in views:
			var view: Dictionary = vraw
			hero.global_position = _foot(view.center_cell)
			pres.set_time_of_day(float(view.get("time_of_day", 0.35)))
			pres.snap_occlusion()
			await physics_frame
			var hashes: Array[String] = []
			for res: Vector2i in resolutions:
				var name := "%s_%s_%dx%d.png" % [entry.treatment_id, view.id, res.x, res.y]
				var row := await _capture(name, res, String(view.id), String(entry.treatment_id))
				if row.has("logical_sha256"):
					hashes.append(String(row.logical_sha256))
			var crisp := hashes.size() == resolutions.size()
			if crisp:
				for h: String in hashes:
					crisp = crisp and h == hashes[0]
			_expect(crisp, "integer-downscaled logical pixels match across resolutions " + String(entry.treatment_id) + "/" + String(view.id))
		# Occlusion stepping: stand behind the tallest landmark and prove fade.
		var tall: Dictionary = {}
		for p_raw: Variant in pres.data.get("props", []):
			var p: Dictionary = p_raw
			if String(p.frame).begins_with("lm_") or String(p.frame).begins_with("tree_"):
				tall = p
				break
		if not tall.is_empty():
			var c: Array = tall.cell
			hero.global_position = Vector2(float(c[0]) * 16 + 8, float(c[1]) * 16 + 4)
			pres.snap_occlusion()
			_expect(int(pres.stats().faded_occluders) > 0, "occlusion fades tall art over Hero " + String(entry.treatment_id))
		# Performance sample is isolated software-GL evidence, not production FPS.
		root.size = resolutions[-1]
		var samples: Array[Dictionary] = []
		for i: int in range(30):
			await process_frame
			samples.append(pres.performance_snapshot())
		var avg_draw := 0.0
		var avg_ms := 0.0
		for s: Dictionary in samples:
			avg_draw += float(s.draw_calls)
			avg_ms += float(s.process_ms)
		perf_rows.append({"treatment_id": entry.treatment_id, "resolution": [resolutions[-1].x, resolutions[-1].y],
			"frames": samples.size(), "avg_draw_calls": avg_draw / samples.size(), "avg_process_ms": avg_ms / samples.size(),
			"scope": "ISOLATED_SOFTWARE_GL_NOT_PRODUCTION"})
		# Inherited VFX compatibility probe on the brightest frost view.
		if String(entry.treatment_id) == "frost_crown_shrine_skarn":
			var view: Dictionary = views[0]
			hero.global_position = _foot(view.center_cell)
			pres.set_time_of_day(0.4)
			pres.snap_occlusion()
			var pos := _foot(view.center_cell) + Vector2(24, -12)
			var effect := VFX.spawn(host, &"world_sparkle", pos, 0.0, 1.0, Color.TRANSPARENT, 20)
			_expect(effect != null, "inherited VFX probe spawned")
			if effect != null:
				await process_frame
				var spr := effect.get_node_or_null("LicensedEffect") as AnimatedSprite2D
				if spr != null:
					spr.pause()
					spr.frame = mini(2, spr.sprite_frames.get_frame_count(&"play") - 1)
				var mask_before := spr.light_mask if spr != null else -1
				var mod_before := spr.modulate if spr != null else Color.BLACK
				pres.set_time_of_day(0.85)
				pres.set_time_of_day(0.4)
				var mask_after := spr.light_mask if spr != null else -2
				var mod_after := spr.modulate if spr != null else Color.BLACK
				_expect(mask_before == 1 and mask_after == 1 and mod_before.is_equal_approx(mod_after),
					"inherited VFX keeps default light mask and tint through A1 day/night")
				gold_probe = {"effect_id": "world_sparkle", "light_mask": mask_after,
					"modulate": [mod_after.r, mod_after.g, mod_after.b, mod_after.a],
					"scope": "INHERITED_VFX_COMPATIBILITY_PROBE_NOT_FULL_A4_GOLD_ACCEPTANCE"}
				for res: Vector2i in resolutions:
					await _capture("frost_gold_compat_%dx%d.png" % [res.x, res.y], res, "gold_compat", String(entry.treatment_id))
				effect.queue_free()
		hero.reparent(host)
		pres.queue_free()
		await process_frame
	var report := {
		"schema": "soh.world.art_native_report.v2",
		"ok": failures.is_empty(),
		"native_fixture_verified": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"screenshots": screenshots,
		"captures": capture_rows,
		"stats": stats_rows,
		"performance": perf_rows,
		"gold_probe": gold_probe,
		"logical_viewport": [LOGICAL.x, LOGICAL.y],
		"scope": "ISOLATED_NATIVE_VISUAL_FIXTURE_NOT_PRODUCTION",
		"production_native_playable": false,
	}
	var f := FileAccess.open(_out("world_art_native_report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, "  "))
	f.close()
	print("WORLD_ART SUMMARY checks=%d failures=%d captures=%d" % [checks, failures.size(), screenshots.size()])
	quit(0 if failures.is_empty() else 1)
