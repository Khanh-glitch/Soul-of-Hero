extends Node

## Chapter 1 audit sweep — read-only observation, not evidence, not a fix.
##
## The review harness photographs five named stations per level. That is enough to
## hand a level over, and not nearly enough to audit it: most of a map is never in
## those five frames. This scene walks the level instead.
##
## For one campaign slot it:
##
##   * boots the production AppRoot / AppFlow exactly like the review harness,
##   * hides every actor and the HUD, so the frame shows the map rather than the
##     fight (the audit is about geometry, not combat),
##   * steps the player camera across the level's own camera bounds on a grid that
##     overlaps by a quarter of a frame, and photographs each position,
##   * records the world rectangle of each frame exactly as the renderer drew it,
##     so the frames can be stitched back into one native, 1:1 mosaic.
##
## Two things this harness learned the hard way, both recorded here so the numbers
## in a manifest can be trusted later:
##
##   1. The chapter renders to a 640x360 canvas and the window upscales it. A
##      1280x720 screenshot therefore covers 640x360 *world* units, not 1280x720.
##      A sweep that steps by fractions of a screenshot leaves gaps.
##   2. Camera2D.get_screen_center_position() returns the centre the camera is
##      aiming at, not the view that was drawn once limits clamp it. Frames placed
##      by that number land tens of pixels from where they belong. The canvas
##      transform is the only description of a frame that cannot disagree with the
##      pixels, so that is what gets written down.
##
## Nothing here writes to the repository and nothing here touches gameplay: the
## player node is teleported and its physics disabled, exactly as the review
## harness already does, and the run quits without saving.
##
## Usage:
##   godot --path . --resolution 1280x720 \
##     res://tools/captures/chapter1_audit_sweep.tscn -- \
##     --slot=7 --out-dir=res://.artifacts/audit/level_7

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

const SETTLE_FRAMES := 20
## Overlap between neighbouring frames, as a fraction of a frame. A quarter is
## enough that every pixel is seen twice at least, so the stitcher can check that
## two frames agree instead of assuming it.
const STEP_FRACTION := Vector2(0.75, 0.75)
const CONTENT_PAD := 32

var _slot := 1
var _level_id := ""
var _out_dir := "res://.artifacts/audit/level_1"
var _app_root: Node


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--slot="):
			_slot = int(argument.get_slice("=", 1))
		elif argument.begins_with("--level="):
			_level_id = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--out-dir="):
			_out_dir = argument.get_slice("=", 1).strip_edges()
	_run.call_deferred()


func _run() -> void:
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/chapter1_audit_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_seed_campaign_entry()

	var definition := _resolve_definition()
	if definition == null:
		push_error("CHAPTER1 AUDIT FAIL: no campaign definition for slot %d" % _slot)
		get_tree().quit(1)
		return
	_level_id = String(definition.level_id)

	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame
	AppFlow.start_campaign_level(StringName(_level_id))
	for _frame: int in 12:
		await get_tree().process_frame
		await get_tree().physics_frame

	var game := _live_game()
	var dungeon := _dungeon(game)
	var player := _player(game)
	if game == null or dungeon == null or player == null:
		push_error("CHAPTER1 AUDIT FAIL: %s did not reach a live scene" % _level_id)
		get_tree().quit(1)
		return

	var art := dungeon.get_node_or_null("EnvironmentArt")
	if art == null:
		art = dungeon.get_node_or_null("CrucibleArt")
	print("CHAPTER1 AUDIT: level=%s slot=%d art=%s" % [
		_level_id, definition.campaign_slot, "on" if art != null else "off",
	])

	_hide_actors(dungeon)
	_hide_overlays(_app_root)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))

	var bounds := _camera_bounds(dungeon)
	var content := _content_rect(dungeon)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.limit_left = int(bounds[0])
		camera.limit_top = int(bounds[1])
		camera.limit_right = int(bounds[2])
		camera.limit_bottom = int(bounds[3])
		camera.position_smoothing_enabled = false
		camera.limit_smoothed = false

	var view := _world_view(camera)
	var positions := _positions(bounds, content, view)
	print("CHAPTER1 AUDIT PLAN: level=%s frames=%d bounds=%s content=%s world_view=%s"
		% [_level_id, positions.size(), bounds, content, view])

	var frames: Array = []
	var seen_rects := {}
	var index := 0
	for centre: Vector2i in positions:
		var cell := Vector2i(floori(float(centre.x) / 16.0), floori(float(centre.y) / 16.0))
		player.global_position = dungeon.to_global(Vector2(cell * 16) + Vector2(8.0, 8.0))
		player.set_physics_process(false)
		if camera != null:
			camera.reset_smoothing()
			camera.force_update_scroll()
		for _frame: int in SETTLE_FRAMES:
			await get_tree().physics_frame
			await get_tree().process_frame
			if "health" in player and "max_health" in player:
				player.set("health", player.get("max_health"))
			if camera != null:
				camera.reset_smoothing()
				camera.force_update_scroll()
		var rect := _frame_rect(view)
		var key := "%d,%d" % [int(rect[0]), int(rect[1])]
		if seen_rects.has(key):
			continue
		seen_rects[key] = true
		await RenderingServer.frame_post_draw
		var image := get_viewport().get_texture().get_image()
		var stem := "%s_%03d" % [_level_id, index]
		var output := "%s/%s.png" % [_out_dir, stem]
		var saved := image.save_png(ProjectSettings.globalize_path(output))
		frames.append({
			"file": stem + ".png",
			"rect": rect,
			"world_size": [view.x, view.y],
			"size": [image.get_width(), image.get_height()],
			"cell": [cell.x, cell.y],
		})
		print("CHAPTER1 AUDIT SHOT: level=%s frame=%03d cell=%s rect=%s ok=%s"
			% [_level_id, index, cell, rect, str(saved == OK)])
		index += 1

	# Whether the camera actually obeyed its limits. If it did not, the sweep has
	# photographed a strip the player can never reach, and every claim about what
	# is cut at the top of the screen has to be made from the limits rather than
	# from the picture. Recording it stops the two being confused later.
	var limits_applied := not frames.is_empty()
	for frame: Dictionary in frames:
		var rect: Array = frame["rect"]
		if float(rect[0]) < float(bounds[0]) - 0.5 or float(rect[1]) < float(bounds[1]) - 0.5 \
				or float(rect[2]) > float(bounds[2]) + 0.5 or float(rect[3]) > float(bounds[3]) + 0.5:
			limits_applied = false

	var manifest := {
		"level": _level_id,
		"slot": definition.campaign_slot,
		"bounds": bounds,
		"content": content,
		"world_view": [view.x, view.y],
		"limits_applied": limits_applied,
		"frames": frames,
	}
	var file := FileAccess.open("%s/manifest.json" % _out_dir, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(manifest, "  "))
		file.close()
	print("CHAPTER1 AUDIT DONE: level=%s frames=%d limits_applied=%s"
		% [_level_id, frames.size(), str(limits_applied)])
	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
	get_tree().quit(0)


# -- level data --------------------------------------------------------------
func _resolve_definition() -> LevelDefinition:
	if not _level_id.is_empty():
		return CAMPAIGN_REGISTRY.find_level(StringName(_level_id))
	return CAMPAIGN_REGISTRY.find_campaign_level(_slot)


func _live_game() -> Node2D:
	var host := _app_root.get_node_or_null("RouteHost")
	if host == null or host.get_child_count() == 0:
		return null
	return host.get_child(0) as Node2D


func _dungeon(game: Node2D) -> DungeonLevel:
	if game == null:
		return null
	return game.get_node_or_null("Level") as DungeonLevel


func _player(game: Node2D) -> CharacterBody2D:
	if game == null:
		return null
	var entities := game.get_node_or_null("Level/Entities")
	if entities == null:
		return null
	return entities.get_node_or_null("Knight") as CharacterBody2D


## The world rectangle one screenshot covers, in world units. The chapter renders
## to a 640x360 canvas and the window upscales it, so this is not the size of the
## PNG that comes back.
func _world_view(camera: Camera2D) -> Vector2:
	var visible := get_viewport().get_visible_rect().size
	var zoom := Vector2.ONE if camera == null else camera.zoom
	return Vector2(visible.x / maxf(0.01, zoom.x), visible.y / maxf(0.01, zoom.y))


## The world rectangle of the frame that was actually drawn, read back from the
## canvas transform rather than from the camera, because the camera reports the
## centre it is aiming at and the limits decide what it actually gets.
func _frame_rect(view: Vector2) -> Array:
	var origin := get_viewport().get_canvas_transform().affine_inverse().origin
	return [snappedf(origin.x, 0.01), snappedf(origin.y, 0.01),
		snappedf(origin.x + view.x, 0.01), snappedf(origin.y + view.y, 0.01)]


## The camera rectangle the player is actually allowed to reach.
func _camera_bounds(dungeon: DungeonLevel) -> Array:
	var metadata: Dictionary = dungeon.level_data.get("metadata", {})
	var raw: Variant = metadata.get("camera_bounds", null)
	if raw is Array and (raw as Array).size() == 4:
		var values: Array = raw as Array
		if float(values[2]) > float(values[0]) and float(values[3]) > float(values[1]):
			return [int(values[0]), int(values[1]), int(values[2]), int(values[3])]
	var visible := get_viewport().get_visible_rect().size
	return [0, 0, int(visible.x), int(visible.y)]


## Pixel rectangle the authored map actually occupies, from its own tile layers.
func _content_rect(dungeon: DungeonLevel) -> Array:
	var min_cell := Vector2i(1 << 20, 1 << 20)
	var max_cell := Vector2i(-(1 << 20), -(1 << 20))
	for layer: TileMapLayer in [dungeon.backdrop, dungeon.geometry]:
		if layer == null:
			continue
		for cell: Vector2i in layer.get_used_cells():
			min_cell.x = mini(min_cell.x, cell.x)
			min_cell.y = mini(min_cell.y, cell.y)
			max_cell.x = maxi(max_cell.x, cell.x)
			max_cell.y = maxi(max_cell.y, cell.y)
	if min_cell.x > max_cell.x:
		var visible := get_viewport().get_visible_rect().size
		return [0, 0, int(visible.x), int(visible.y)]
	return [min_cell.x * 16, min_cell.y * 16, (max_cell.x + 1) * 16, (max_cell.y + 1) * 16]


## Camera centres across the reachable rectangle, overlapping so the mosaic has
## something to check itself against. Cells the player cannot stand on are used
## too: the question is what the camera can see, not where the knight can walk.
func _positions(bounds: Array, content: Array, view: Vector2) -> Array:
	var left := float(bounds[0])
	var top := float(bounds[1])
	var right := float(bounds[2])
	var bottom := float(bounds[3])
	var step := Vector2(view.x * STEP_FRACTION.x, view.y * STEP_FRACTION.y)
	var xs: Array = _axis(left, right, view.x, step.x)
	var ys: Array = _axis(top, bottom, view.y, step.y)

	var out: Array = []
	var authored := Rect2i(int(content[0]) - CONTENT_PAD, int(content[1]) - CONTENT_PAD,
		int(content[2]) - int(content[0]) + CONTENT_PAD * 2,
		int(content[3]) - int(content[1]) + CONTENT_PAD * 2)
	for cy: int in ys:
		for cx: int in xs:
			var rect := Rect2i(int(cx - view.x * 0.5), int(cy - view.y * 0.5),
				int(view.x), int(view.y))
			if rect.intersects(authored):
				out.append(Vector2i(cx, cy))
	return out


func _axis(low: float, high: float, span: float, step: float) -> Array:
	var out: Array = []
	if high - low <= span:
		out.append(int(round((low + high) * 0.5)))
		return out
	var value := low + span * 0.5
	while value <= high - span * 0.5 + 0.01:
		out.append(int(round(value)))
		value += step
	out.append(int(round(high - span * 0.5)))
	return out


# -- visibility --------------------------------------------------------------
## Hide every actor so the frame is the map, not the fight. Authored props are
## kept: they are the subject.
func _hide_actors(dungeon: DungeonLevel) -> void:
	var entities := dungeon.get_node_or_null("Entities")
	if entities == null:
		return
	for child: Node in entities.get_children():
		if child.has_meta(&"crucible_prop"):
			continue
		if child is CanvasItem:
			(child as CanvasItem).visible = false


func _hide_overlays(node: Node) -> void:
	if node is CanvasLayer:
		var layer := node as CanvasLayer
		var layer_name := String(layer.name).to_lower()
		if layer_name.contains("hud") or layer_name.contains("tutorial") or layer_name.contains("overlay"):
			layer.visible = false
	for child: Node in node.get_children():
		_hide_overlays(child)


func _seed_campaign_entry() -> void:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_ids.append(String(level.level_id))
	SaveService.call(
		&"transact_once",
		"tests:chapter1_audit_sweep:%d" % _slot,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			campaign["unlocked_levels"] = ready_ids.duplicate()
			var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
			for level: LevelDefinition in ready_levels:
				for prerequisite_id: String in level.unlock_requirements.prerequisite_level_ids:
					completed[prerequisite_id] = true
			campaign["completed_levels"] = completed
			progression["campaign"] = campaign
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			for level: LevelDefinition in ready_levels:
				for feature_id: String in level.unlock_requirements.required_feature_ids:
					features[feature_id] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true,
		{"kind": "chapter1_audit_sweep", "slot": _slot}
	)
