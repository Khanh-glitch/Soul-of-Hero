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
##   * hides every actor, the HUD and the tutorial, so the frame shows the map
##     rather than the fight (the audit is about geometry, not combat),
##   * steps the player camera across the level's own camera bounds on a
##     960x540 grid (25% overlap) and photographs each position at 1280x720,
##   * records the *actual* camera rectangle of each frame in a manifest, so the
##     frames can be stitched back into one native, 1:1 mosaic.
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

const VIEW_SIZE := Vector2i(1280, 720)
const STEP := Vector2i(960, 540)
const SETTLE_FRAMES := 20
const SEARCH_RADIUS := 28

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

	var positions := _positions(bounds, content)
	print("CHAPTER1 AUDIT PLAN: level=%s frames=%d bounds=%s content=%s"
		% [_level_id, positions.size(), bounds, content])

	var frames: Array = []
	var index := 0
	for centre: Vector2i in positions:
		var cell := _valid_cell(dungeon, Vector2i(centre.x / 16, centre.y / 16))
		if cell.x < 0:
			print("CHAPTER1 AUDIT SKIP: level=%s centre=%s (no walkable cell)" % [_level_id, centre])
			continue
		var target := dungeon.to_global(Vector2(cell * 16) + Vector2(8.0, 8.0))
		player.global_position = target
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
		# The canvas transform is the authority on where the frame is looking. A
		# camera's own centre is not: it reports the target, and it disagrees with
		# what was drawn as soon as limits, smoothing or an offset are in play.
		# Reading the transform back means the mosaic cannot drift from the frame.
		var canvas := get_viewport().get_canvas_transform()
		var world_origin := canvas.affine_inverse().origin
		var scale := Vector2(canvas.x.length(), canvas.y.length())
		await RenderingServer.frame_post_draw
		var image := get_viewport().get_texture().get_image()
		var stem := "%s_%03d" % [_level_id, index]
		var output := "%s/%s.png" % [_out_dir, stem]
		var saved := image.save_png(ProjectSettings.globalize_path(output))
		var rect := [
			snappedf(world_origin.x, 0.01), snappedf(world_origin.y, 0.01),
			snappedf(world_origin.x + image.get_width() * scale.x, 0.01),
			snappedf(world_origin.y + image.get_height() * scale.y, 0.01),
		]
		frames.append({
			"file": stem + ".png",
			"rect": rect,
			"size": [image.get_width(), image.get_height()],
			"cell": [cell.x, cell.y],
		})
		print("CHAPTER1 AUDIT SHOT: level=%s frame=%03d cell=%s rect=%s ok=%s"
			% [_level_id, index, cell, rect, str(saved == OK)])
		index += 1

	# Whether the camera actually obeyed its limits. If it did not, the sweep has
	# photographed a strip the player can never reach, and every claim about what
	# is cut at the top of the screen has to be made from the limits, not the
	# picture. Recording it stops the two being confused later.
	var limits_applied := true
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
		"limits_applied": limits_applied,
		"frames": frames,
	}
	var file := FileAccess.open("%s/manifest.json" % _out_dir, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(manifest, "  "))
		file.close()
	print("CHAPTER1 AUDIT DONE: level=%s frames=%d" % [_level_id, frames.size()])
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


## The camera rectangle the player is actually allowed to reach.
func _camera_bounds(dungeon: DungeonLevel) -> Array:
	var metadata: Dictionary = dungeon.level_data.get("metadata", {})
	var raw: Variant = metadata.get("camera_bounds", null)
	if raw is Array and (raw as Array).size() == 4:
		var values: Array = raw as Array
		if float(values[2]) > float(values[0]) and float(values[3]) > float(values[1]):
			return [int(values[0]), int(values[1]), int(values[2]), int(values[3])]
	return [0, 0, VIEW_SIZE.x, VIEW_SIZE.y]


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
		return [0, 0, VIEW_SIZE.x, VIEW_SIZE.y]
	return [min_cell.x * 16, min_cell.y * 16, (max_cell.x + 1) * 16, (max_cell.y + 1) * 16]


## Camera centres on a 960x540 grid across the reachable rectangle, minus the
## frames that would photograph nothing but rock.
func _positions(bounds: Array, content: Array) -> Array:
	var left := int(bounds[0])
	var top := int(bounds[1])
	var right := int(bounds[2])
	var bottom := int(bounds[3])
	var xs: Array = []
	var x := left + VIEW_SIZE.x / 2
	while x + VIEW_SIZE.x / 2 <= right:
		xs.append(x)
		x += STEP.x
	var last_x := right - VIEW_SIZE.x / 2
	if xs.is_empty() or int(xs[xs.size() - 1]) != last_x:
		xs.append(last_x)
	var ys: Array = []
	var y := top + VIEW_SIZE.y / 2
	while y + VIEW_SIZE.y / 2 <= bottom:
		ys.append(y)
		y += STEP.y
	var last_y := bottom - VIEW_SIZE.y / 2
	if ys.is_empty() or int(ys[ys.size() - 1]) != last_y:
		ys.append(last_y)

	var out: Array = []
	var pad := 48
	for cy: int in ys:
		for cx: int in xs:
			var rect := Rect2i(cx - VIEW_SIZE.x / 2, cy - VIEW_SIZE.y / 2, VIEW_SIZE.x, VIEW_SIZE.y)
			var authored := Rect2i(int(content[0]) - pad, int(content[1]) - pad,
				int(content[2]) - int(content[0]) + pad * 2,
				int(content[3]) - int(content[1]) + pad * 2)
			if rect.intersects(authored):
				out.append(Vector2i(cx, cy))
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
		var name := String(layer.name).to_lower()
		if name.contains("hud") or name.contains("tutorial") or name.contains("overlay"):
			layer.visible = false
	for child: Node in node.get_children():
		_hide_overlays(child)


# -- placement ---------------------------------------------------------------
func _valid_cell(dungeon: DungeonLevel, origin: Vector2i) -> Vector2i:
	if _cell_ok(dungeon, origin):
		return origin
	for radius: int in range(1, SEARCH_RADIUS + 1):
		for offset_y: int in range(-radius, radius + 1):
			for offset_x: int in range(-radius, radius + 1):
				if maxi(absi(offset_x), absi(offset_y)) != radius:
					continue
				var candidate := origin + Vector2i(offset_x, offset_y)
				if _cell_ok(dungeon, candidate):
					return candidate
	return Vector2i(-1, -1)


func _cell_ok(dungeon: DungeonLevel, cell: Vector2i) -> bool:
	if dungeon.backdrop.get_cell_source_id(cell) == -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell) != -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell + Vector2i.UP) != -1:
		return false
	return true


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
