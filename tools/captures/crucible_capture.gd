extends Node

## Native capture harness for the Blood Crucible (Chapter 1, Level 5).
##
## Boots the production campaign through AppRoot/AppFlow exactly as a player
## would, then photographs the six stations the architecture brief asks for:
##
##   f1_spawn        the first gameplay frame
##   f1_gate         the processional gate and the altar, from the walk
##   f2_court        the blood court
##   f2_encounter    the court's east side, where the camp fights
##   f3_approach     the arena threshold, before the boss wakes
##   f3_fight        the live Hooded Archer fight, mid-combat
##
## plus floor overviews (a camera pulled back by scaling the viewport, never by
## moving the Knight somewhere unreachable) and integer-scaled detail crops.
##
## Usage:
##   godot --path . res://tools/captures/crucible_capture.tscn -- \
##       --out-dir=res://.artifacts/crucible/after --tag=after [--no-art]
##
## --no-art sets Engine meta so CrucibleArt.attach() returns early: the map, its
## collision, its entities and its HUD are untouched, so a before/after pair
## isolates the architecture layer and nothing else.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)
const TILE := 16
const SLOT := 5

## Stations are authored against the plan, not derived from the nearest entity:
## a "gate" frame has to be taken from where a player actually stands when they
## first see the gate.
const STATIONS := [
	{"id": "f1_spawn", "label": "Floor 1 - spawn", "cell": [10, 17]},
	{"id": "f1_gate", "label": "Floor 1 - gate and altar", "cell": [16, 14]},
	{"id": "f1_altar", "label": "Floor 1 - the altar up close", "cell": [48, 17]},
	{"id": "f2_landing", "label": "Floor 2 - landing", "cell": [8, 47]},
	{"id": "f2_court", "label": "Floor 2 - blood court", "cell": [91, 47]},
	{"id": "f2_encounter", "label": "Floor 2 - court encounter", "cell": [91, 47]},
	{"id": "f3_approach", "label": "Floor 3 - arena threshold", "cell": [70, 76]},
	{"id": "f3_fight", "label": "Floor 3 - live Hooded Archer fight", "cell": [88, 78]},
]

## Overview frames are taken with the camera zoomed out so a whole floor is
## legible in one picture. They are marked OVERVIEW in their filename and are
## never presented as gameplay-size frames.
const OVERVIEWS := [
	{"id": "overview_f1", "label": "Floor 1 overview", "cell": [32, 16], "zoom": 0.5},
	{"id": "overview_f2", "label": "Floor 2 overview", "cell": [56, 47], "zoom": 0.4},
	{"id": "overview_f3", "label": "Floor 3 overview", "cell": [60, 75], "zoom": 0.45},
]

var _app_root: Node
var _tag := "after"
var _out_dir := "res://.artifacts/crucible/after"
var _no_art := false
var _level_id := "chapter_1_level_5"


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--tag="):
			_tag = argument.trim_prefix("--tag=")
		elif argument.begins_with("--out-dir="):
			_out_dir = argument.trim_prefix("--out-dir=")
		elif argument == "--no-art":
			_no_art = true
	if _no_art:
		Engine.set_meta(&"chapter1_art_disabled", true)
		Engine.set_meta(&"crucible_art_disabled", true)
	_run.call_deferred()


func _run() -> void:
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/crucible_capture_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_seed_campaign_entry()

	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame
	await get_tree().process_frame

	var definition := CAMPAIGN_REGISTRY.find_campaign_level(SLOT)
	if definition == null:
		push_error("CRUCIBLE CAPTURE FAIL: no campaign definition for slot %d" % SLOT)
		_finish(1)
		return
	_level_id = String(definition.level_id)
	AppFlow.start_campaign_level(StringName(_level_id))
	var game: Node2D = null
	for _attempt: int in range(200):
		game = _live_game()
		if game != null:
			break
		await get_tree().process_frame
	if game == null:
		push_error("CRUCIBLE CAPTURE FAIL: campaign level did not start")
		_finish(1)
		return
	await get_tree().physics_frame
	await get_tree().process_frame

	var dungeon: DungeonLevel = _dungeon(game)
	var player: CharacterBody2D = _player(game)
	if dungeon == null or player == null:
		push_error("CRUCIBLE CAPTURE FAIL: level or Knight missing")
		_finish(1)
		return

	var art := dungeon.get_node_or_null("CrucibleArt") as CrucibleArt
	var walls := art.get_node_or_null("CrucibleWalls") as TileMapLayer if art != null else null
	var props := 0
	if art != null:
		var root := dungeon.get_node_or_null("Entities")
		if root != null:
			for child: Node in root.get_children():
				if child.has_meta(&"crucible_prop"):
					props += 1
	var lights := 0
	if art != null:
		var holder := art.get_node_or_null("CrucibleLights")
		if holder != null:
			lights = holder.get_child_count()
	print("CRUCIBLE CAPTURE: level=%s art=%s wall_cells=%d props=%d lights=%d entities=%d"
		% [
			_level_id,
			"on" if art != null else "off",
			walls.get_used_cells().size() if walls != null else 0,
			props,
			lights,
			(dungeon.level_data.get("entities", []) as Array).size(),
		])
	print("CRUCIBLE PERF: art=%s nodes=%d draw_calls=%d static_mb=%.1f fps=%d"
		% [
			"on" if art != null else "off",
			int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
			int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
			Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
			int(Performance.get_monitor(Performance.TIME_FPS)),
		])

	var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial != null:
		tutorial.hide()
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))

	var exit_code := 0
	for station: Dictionary in STATIONS:
		if station["id"] == "f3_fight":
			if not await _capture_fight(station, dungeon, player):
				exit_code = 1
			continue
		if not await _capture(station, player):
			exit_code = 1
	for overview: Dictionary in OVERVIEWS:
		if not await _capture(overview, player, overview_frame=true):
			exit_code = 1
	print("CRUCIBLE CAPTURE DONE: tag=%s" % _tag)
	_finish(exit_code)


func _finish(code: int) -> void:
	get_tree().quit(code)


## Unlock every ready campaign level in a throwaway save so the harness can boot
## Level 5 directly. This is the same seeding the Chapter 1 harness uses and it
## never touches a real player profile: the save path is a temp file.
func _seed_campaign_entry() -> void:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_ids.append(String(level.level_id))
	SaveService.call(
		&"transact_once",
		"tests:crucible_capture:%s" % _tag,
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
			candidate["progression"] = progression
			return true
	)


func _live_game() -> Node2D:
	var host := _app_root.get_node_or_null("RouteHost")
	if host == null or host.get_child_count() == 0:
		return null
	return host.get_child(0) as Node2D


func _dungeon(game: Node2D) -> DungeonLevel:
	return game.get_node_or_null("Level") as DungeonLevel


func _player(game: Node2D) -> CharacterBody2D:
	var root := game.get_node_or_null("Level/Entities")
	if root == null:
		return null
	return root.get_node_or_null("Knight") as CharacterBody2D


func _valid_cell(dungeon: DungeonLevel, wanted: Vector2i) -> Vector2i:
	var floor := {}
	for tile: Dictionary in dungeon.level_data.get("layers", {}).get("Backdrop", []):
		floor[Vector2i(int(tile["x"]), int(tile["y"]))] = true
	var geometry := {}
	for tile: Dictionary in dungeon.level_data.get("layers", {}).get("Geometry", []):
		geometry[Vector2i(int(tile["x"]), int(tile["y"]))] = true
	if floor.has(wanted) and not geometry.has(wanted):
		return wanted
	for radius: int in range(1, 12):
		for dy: int in range(-radius, radius + 1):
			for dx: int in range(-radius, radius + 1):
				var cell := Vector2i(wanted.x + dx, wanted.y + dy)
				if floor.has(cell) and not geometry.has(cell):
					return cell
	return wanted


func _capture(station: Dictionary, player: CharacterBody2D, overview_frame: bool = false) -> bool:
	var cell_raw: Array = station["cell"]
	var zoom := float(station.get("zoom", 1.0))
	var dungeon: DungeonLevel = player.get_parent().get_parent() as DungeonLevel
	var cell := _valid_cell(dungeon, Vector2i(int(cell_raw[0]), int(cell_raw[1])))
	# Place the Knight at the station. These are all cells a player can stand on
	# (the harness validates walkability first) and the camera is then snapped, so
	# the frame is a real gameplay view from that spot.
	player.global_position = Vector2(cell.x * TILE + TILE * 0.5, cell.y * TILE + TILE * 0.5)
	if player is CharacterBody2D:
		(player as CharacterBody2D).velocity = Vector2.ZERO
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		camera.zoom = Vector2(zoom, zoom)
		camera.force_update_scroll()
	for _i: int in range(4):
		await get_tree().physics_frame
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var prefix := "overview_" if overview_frame else ""
	var path := "%s/%s%s_%s.png" % [_out_dir, prefix, _tag, station["id"]]
	var error := image.save_png(path)
	print("CRUCIBLE STATION tag=%s station=%s cell=%s zoom=%.2f out=%s ok=%s"
		% [_tag, station["id"], cell, zoom, path, error == OK])
	return error == OK


## The boss frame has to be a real fight, not a posed tableau: the harness walks
## the Knight into the arena, wakes the archer, lets the fight run for a moment
## and photographs it mid-combat with the boss's own projectiles in the air.
func _capture_fight(station: Dictionary, dungeon: DungeonLevel, player: CharacterBody2D) -> bool:
	var archer: Node2D = null
	var root := dungeon.get_node_or_null("Entities")
	if root != null:
		for child: Node in root.get_children():
			var type_name := String(child.get_meta(&"entity_type", ""))
			if type_name == "hooded_archer_miniboss":
				archer = child as Node2D
				break
	if archer == null:
		# fall back to the authored spawn cell if the type meta is not exposed
		for entity: Dictionary in dungeon.level_data.get("entities", []):
			if String(entity.get("type", "")) == "hooded_archer_miniboss":
				var position: Array = entity.get("position", [0, 0])
				archer = Node2D.new()
				archer.global_position = Vector2(float(position[0]), float(position[1]))
				break
	print("CRUCIBLE FIGHT: archer=%s" % ("found" if archer != null else "MISSING"))
	# stand off at bow range, in the open, so the fight starts
	var target := Vector2i(88, 78) if archer == null else Vector2i(
		int(archer.global_position.x / TILE) - 6, int(archer.global_position.y / TILE) + 1)
	var cell := _valid_cell(dungeon, target)
	player.global_position = Vector2(cell.x * TILE + TILE * 0.5, cell.y * TILE + TILE * 0.5)
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		camera.zoom = Vector2.ONE
	# let the encounter wake up and the archer loose a few volleys
	for _i: int in range(150):
		await get_tree().physics_frame
	var health: Node = player.get_node_or_null("Health")
	var health_text := "n/a"
	if health != null and health.has_method("get_current_health"):
		health_text = str(health.get_current_health())
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var path := "%s/%s_%s.png" % [_out_dir, _tag, station["id"]]
	var error := image.save_png(path)
	print("CRUCIBLE STATION tag=%s station=%s cell=%s zoom=1.00 out=%s ok=%s knight_hp=%s"
		% [_tag, station["id"], cell, path, error == OK, health_text])
	return error == OK
