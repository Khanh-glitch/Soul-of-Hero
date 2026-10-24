extends Node

## Chapter 1 native review capture harness — one scene, ten levels.
##
## Boots the production AppRoot / AppFlow, enters a campaign slot through the
## campaign registry, and photographs that level from vantages derived from its
## own authored data:
##
##   entry       the authored player spawn (first impression)
##   landmark    the first required Sigil / objective marker
##   checkpoint  the first checkpoint (route breather)
##   exit        the exit gate (final state)
##   boss        the named boss / Elite, if the level has one
##
## No station is hand-placed per level, so a level cannot silently lose its
## evidence when its map is re-authored: if the entity moves, the camera follows.
##
## `--no-art` boots the same map with the Chapter 1 presentation layer disabled,
## which is the honest BEFORE for this overhaul: identical geometry, collision,
## entities and HUD, only the art layer absent.
##
## Usage:
##   godot --path . res://tools/captures/chapter1_visual_capture.tscn -- \
##     --slot=5 --out-dir=res://.artifacts/chapter1/after --tag=after [--no-art] [--check]

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

const BOSS_TYPES := ["hooded_archer_miniboss", "vampire_castellan", "vampire", "crimson_reaper"]

var _slot := 5
var _level_id := ""
var _out_dir := "res://.artifacts/chapter1/after"
var _tag := "after"
var _no_art := false
var _check_only := false
var _sim_frames := 48
var _app_root: Node


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--slot="):
			_slot = int(argument.get_slice("=", 1))
		elif argument.begins_with("--level="):
			_level_id = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--out-dir="):
			_out_dir = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--tag="):
			_tag = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--sim-frames="):
			_sim_frames = maxi(8, int(argument.get_slice("=", 1)))
		elif argument == "--no-art":
			_no_art = true
		elif argument == "--check":
			_check_only = true
	if _no_art:
		# Read by Chapter1EnvironmentArt.attach(): the map, its collision and every
		# entity stay exactly as they are; only the derived art layer is skipped.
		Engine.set_meta(&"chapter1_art_disabled", true)
	_run.call_deferred()


func _run() -> void:
	var exit_code := 0
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/chapter1_capture_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_seed_campaign_entry()

	var definition := _resolve_definition()
	if definition == null:
		push_error("CHAPTER1 CAPTURE FAIL: no campaign definition for slot %d" % _slot)
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
		push_error("CHAPTER1 CAPTURE FAIL: %s did not reach a live scene" % _level_id)
		_finish(1)
		return

	var art := dungeon.get_node_or_null("EnvironmentArt")
	var facade_cells := 0
	var light_count := 0
	if art != null:
		var facade := art.get_node_or_null("EnvironmentFacade") as TileMapLayer
		facade_cells = facade.get_used_cells().size() if facade != null else 0
		var lights := art.get_node_or_null("EnvironmentLights")
		light_count = lights.get_child_count() if lights != null else 0
	print("CHAPTER1 CAPTURE: level=%s slot=%d art=%s facade_cells=%d lights=%d entities=%d"
		% [
			_level_id,
			definition.campaign_slot,
			"on" if art != null else "off",
			facade_cells,
			light_count,
			(dungeon.level_data.get("entities", []) as Array).size(),
		])

	if _check_only:
		var ok := true
		if not _no_art:
			ok = art != null and facade_cells > 0
		print("CHAPTER1 HARNESS CHECK %s: level=%s facade_cells=%d lights=%d"
			% ["OK" if ok else "FAIL", _level_id, facade_cells, light_count])
		_finish(0 if ok else 1)
		return

	var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial != null:
		tutorial.hide()
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))

	for station: Dictionary in _stations(dungeon):
		var captured := await _capture(station, dungeon, player)
		if not captured:
			exit_code = 1
	print("CHAPTER1 CAPTURE DONE: tag=%s level=%s" % [_tag, _level_id])
	_finish(exit_code)


func _finish(code: int) -> void:
	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
	get_tree().quit(code)


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


# -- stations -----------------------------------------------------------------
func _stations(dungeon: DungeonLevel) -> Array:
	var entities: Array = dungeon.level_data.get("entities", []) as Array
	var by_type := {}
	for raw: Variant in entities:
		if not raw is Dictionary:
			continue
		var entity: Dictionary = raw as Dictionary
		var kind := String(entity.get("type", ""))
		if not by_type.has(kind):
			by_type[kind] = []
		(by_type[kind] as Array).append(entity)

	var stations: Array = []
	stations.append(_station("entry", "Entry — first impression", by_type, "player"))
	stations.append(_station("landmark", "Primary landmark", by_type, "sigil"))
	stations.append(_station("checkpoint", "Checkpoint breather", by_type, "checkpoint"))
	stations.append(_station("exit", "Exit gate", by_type, "exit_gate"))
	for kind: String in BOSS_TYPES:
		if by_type.has(kind):
			stations.append(_station("boss", "Boss arena — %s" % kind, by_type, kind, 6))
			break
	var result: Array = []
	for station: Dictionary in stations:
		if station.is_empty():
			continue
		result.append(station)
	if result.is_empty():
		# A level with no authored markers still gets a frame: its spawn cell.
		var metadata: Dictionary = dungeon.level_data.get("metadata", {})
		var spawn: Variant = metadata.get("spawn_cell", [])
		if spawn is Array and (spawn as Array).size() >= 2:
			result.append({
				"id": "entry",
				"label": "Entry",
				"cell": Vector2i(int((spawn as Array)[0]), int((spawn as Array)[1])),
			})
	return result


func _station(
	id: String,
	label: String,
	by_type: Dictionary,
	kind: String,
	offset_x: int = 0
) -> Dictionary:
	if not by_type.has(kind):
		return {}
	var list: Array = by_type[kind]
	if list.is_empty():
		return {}
	var entity: Dictionary = list[0] as Dictionary
	var position: Variant = entity.get("position", [])
	if not position is Array or (position as Array).size() < 2:
		return {}
	var cell := Vector2i(int((position as Array)[0]) / 16, int((position as Array)[1]) / 16)
	return {"id": id, "label": label, "cell": cell + Vector2i(offset_x, 0)}


# -- capture ------------------------------------------------------------------
func _capture(station: Dictionary, dungeon: DungeonLevel, player: CharacterBody2D) -> bool:
	var origin: Vector2i = station["cell"]
	var cell: Vector2i = _valid_cell(dungeon, origin)
	var target := dungeon.to_global(Vector2(cell * 16) + Vector2(8.0, 8.0))
	player.global_position = target
	player.set_physics_process(false)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	for _frame: int in _sim_frames:
		await get_tree().physics_frame
		await get_tree().process_frame
		if "health" in player and "max_health" in player:
			player.set("health", player.get("max_health"))
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var output := "%s/%s_%s.png" % [_out_dir, _tag, String(station["id"])]
	var saved := image.save_png(ProjectSettings.globalize_path(output))
	print("CHAPTER1 STATION tag=%s level=%s station=%s cell=%s size=%dx%d out=%s ok=%s"
		% [
			_tag,
			_level_id,
			String(station["id"]),
			cell,
			image.get_width(),
			image.get_height(),
			output,
			str(saved == OK),
		])
	return saved == OK


func _valid_cell(dungeon: DungeonLevel, origin: Vector2i) -> Vector2i:
	if _cell_ok(dungeon, origin):
		return origin
	for radius: int in range(1, 9):
		for offset_y: int in range(-radius, radius + 1):
			for offset_x: int in range(-radius, radius + 1):
				if maxi(absi(offset_x), absi(offset_y)) != radius:
					continue
				var candidate := origin + Vector2i(offset_x, offset_y)
				if _cell_ok(dungeon, candidate):
					return candidate
	return origin


func _cell_ok(dungeon: DungeonLevel, cell: Vector2i) -> bool:
	if dungeon.backdrop.get_cell_source_id(cell) == -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell) != -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell + Vector2i.UP) != -1:
		return false
	for raw: Variant in (dungeon.level_data.get("entities", []) as Array):
		if not raw is Dictionary or String((raw as Dictionary).get("type", "")) != "spikes":
			continue
		var position: Array = (raw as Dictionary).get("position", [])
		if position.size() < 2:
			continue
		if Vector2i(int(position[0]) / 16, int(position[1]) / 16) == cell:
			return false
	return true


func _seed_campaign_entry() -> void:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_ids.append(String(level.level_id))
	SaveService.call(
		&"transact_once",
		"tests:chapter1_visual_capture:%s" % _tag,
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
		{"kind": "chapter1_visual_capture", "tag": _tag}
	)
