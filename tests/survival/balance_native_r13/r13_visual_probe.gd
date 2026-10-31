extends "res://tests/survival/balance_native_r13/r13_harness.gd"
## R13VIS — pixels, or an honest admission that there are none.
##
## The round-12 work order asks for true production screenshots at 720p, 1440p and
## 2160p, opened and inspected at 1x. This engine build has no window and no
## rasterizer, so the probe:
##
##   1. attempts a real capture at each of the three resolutions and records the
##      image size, emptiness and PNG byte count — evidence, not a claim;
##   2. measures what *is* CPU-observable at those viewport sizes: the camera's
##      zoom (the product pins it to 1), the HUD's label pixel sizes, and how much
##      of the world a 1x frame contains at each height;
##   3. reports `VISUAL_NOT_TESTED` when no image came back. A structural
##      substitute never becomes a visual verdict.
##
## The arithmetic matters on its own: with zoom 1 and 16 px tiles, a 2160p frame
## shows nine times the world area of a 720p frame, and the 32 px Hero occupies
## 1.5% of screen height instead of 4.4%. That is a design fact about the 1x
## framings the order asks for — and a reason a human review cannot be replaced by
## resizing a window.

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const SIZES := [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
const TILE := 16.0
const HERO_PX := 32.0


func _body() -> void:
	probe_id = "R13VIS"
	probe_title = "three 1x framings attempted; no rasterizer, so VISUAL_NOT_TESTED with measured substitutes"
	owner_action = (
		"A0/AVFX: the product pins `Camera2D.zoom` to `Vector2.ONE` and keeps HUD fonts at fixed pixel sizes, so "
		+ "the three requested 1x frames are three different world-to-screen scales rather than one design scaled "
		+ "three ways. Before any visual acceptance, a human must open real PNGs at 720p/1440p/2160p; this sandbox "
		+ "cannot produce them (no libGL/libEGL/libvulkan/dri)."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	var facts := _display_facts()
	_note("display facts: %s" % str(facts))
	var camera: Camera2D = mounted.get(&"camera") as Camera2D
	var hud: CanvasLayer = mounted.get(&"hud") as CanvasLayer
	var captures := 0
	var pixels := 0
	var zoom_seen: Array[String] = []
	var fonts_seen: Array[String] = []
	for size: Vector2i in SIZES:
		var capture := await _capture_attempt(size)
		captures += 1
		if bool(capture.get("ok", false)):
			pixels += 1
		_note("capture %dx%d -> ok=%s image_size=%s empty=%s png_bytes=%d why=%s"
			% [size.x, size.y, str(capture.get("ok", false)), str(capture.get("image_size", [])),
				str(capture.get("image_empty", true)), int(capture.get("png_bytes", 0)), String(capture.get("why", ""))])
		var zoom := camera.zoom if camera != null else Vector2.ZERO
		# The comparison below is about the zoom alone; the size is already in the
		# note, so it must not be part of the compared string.
		zoom_seen.append("%.2f,%.2f" % [zoom.x, zoom.y])
		var world_width := float(size.x) / TILE / zoom.x if zoom.x > 0.0 else 0.0
		var world_height := float(size.y) / TILE / zoom.y if zoom.y > 0.0 else 0.0
		var hero_fraction := HERO_PX * zoom.y / float(size.y)
		_note("%dx%d at 1x shows %.0fx%.0f tiles (%.1f%% of the 384x256 world); the 32 px Hero is %.2f%% of "
			% [size.x, size.y, world_width, world_height,
				(world_width * world_height) / (384.0 * 256.0) * 100.0, hero_fraction * 100.0]
			+ "screen height")
		_expect(world_width > 0.0 and world_height > 0.0,
			"the %dx%d viewport has a real camera framing" % [size.x, size.y])
		# HUD: the same labels, the same pixel sizes, at every resolution.
		if hud != null:
			var labels := hud.find_children("*", "Label", true, false)
			var sizes_here: Array[int] = []
			var outside := 0
			var viewport := Rect2(Vector2.ZERO, Vector2(size))
			for node: Node in labels:
				var label := node as Label
				if label == null or not label.is_visible_in_tree():
					continue
				sizes_here.append(label.get_theme_font_size(&"font_size"))
				# A label flush with the edge is legal; only a rect that leaves the
				# viewport is clipped UI. The 2 px slack keeps a border pixel from
				# being reported as a layout failure.
				if not viewport.grow(2.0).encloses(label.get_global_rect()):
					outside += 1
			sizes_here.sort()
			fonts_seen.append("%dx%d:%s" % [size.x, size.y, str(sizes_here)])
			_note("%dx%d HUD visible labels=%d font sizes=%s outside viewport=%d"
				% [size.x, size.y, sizes_here.size(), str(sizes_here), outside])
			_expect(outside == 0, "every visible HUD label stays inside the %dx%d viewport (%d outside)"
				% [size.x, size.y, outside])
	_note("camera zoom across the three framings: %s" % str(zoom_seen))
	_note("HUD font sizes across the three framings: %s" % str(fonts_seen))
	_expect(zoom_seen.size() == 3 and zoom_seen[0] == zoom_seen[1] and zoom_seen[1] == zoom_seen[2],
		"the camera keeps one zoom for all three resolutions (it does not scale the design)")
	_expect(captures == 3, "three capture attempts were made (%d)" % captures)

	if pixels == 0:
		_block("VISUAL_NOT_TESTED: %d/%d capture attempts returned no image (display=%s, adapter='%s'); no pixel "
			% [captures - pixels, captures, DisplayServer.get_name(), RenderingServer.get_video_adapter_name()]
			+ "was inspected at 720p, 1440p or 2160p and no visual verdict is claimed")
	elif pixels < captures:
		_block("VISUAL_NOT_TESTED_PARTIAL: only %d/%d framings produced an image; the rest have no pixels to inspect"
			% [pixels, captures])
	else:
		_note("captures were written, but A7 cannot open an image from this process: a human must inspect them "
			+ "and no visual verdict is claimed here")
		_block("VISUAL_NOT_TESTED_NO_HUMAN_REVIEW: %d PNGs exist but were not opened at 1x by a human" % pixels)

	_done()
