extends Node

## Level 5 "Blood Crucible" review capture harness.
##
## Boots the production AppRoot/AppFlow, enters Level 5 through the campaign
## registry, and photographs the six review stations in one native pass.
##
## Every station is a *staged* vantage: the Knight is placed at an authored
## anchor (validated against live TileMap collision, spike cells and body
## overlap before the shutter), because a level review needs repeatable framings
## from one storey to the next and a literal walk would take ten minutes and
## depend on the fight's outcome. Nothing about the map, the entities or the
## HUD is staged: the frames are the shipped level rendered by the shipped game.
##
## Usage:
##   godot --path . res://tools/captures/level5_blood_crucible_capture.tscn \
##     -- --out-dir=res://.artifacts/level5 --tag=after [--station=f1_spawn]
##
## Stations: f1_spawn, f1_camp, f2_court, f2_checkpoint, f3_approach, f3_archer.
## With no --station every station is captured in one run.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

const STATIONS := [
	"f1_spawn",
	"f1_camp",
	"f2_court",
	"f2_checkpoint",
	"f3_approach",
	"f3_archer",
]
## Station anchors in cells, each one a walkable cell of the authored level.
## f3_archer is derived at runtime from the live Archer so the 165 px stance of
## the boss-capture contract is always used.
const STATION_CELLS := {
	"f1_spawn": Vector2i(10, 17),
	"f1_camp": Vector2i(66, 16),
	"f2_court": Vector2i(30, 48),
	"f2_checkpoint": Vector2i(10, 49),
	"f3_approach": Vector2i(64, 76),
}

var _out_dir := "res://.artifacts/level5"
var _tag := "after"
var _only := ""
var _sim_frames := 70
var _check_only := false
var _app_root: Node


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--out-dir="):
			_out_dir = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--tag="):
			_tag = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--station="):
			_only = argument.get_slice("=", 1).strip_edges()
		elif argument.begins_with("--sim-frames="):
			_sim_frames = maxi(12, int(argument.get_slice("=", 1)))
		elif argument == "--check":
			_check_only = true
	_run.call_deferred()


func _run() -> void:
	var exit_code := 0
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/level5_review_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_seed_campaign_entry()
	if _check_only:
		# Smoke check: the scene graph, both autoloads and the Level 5 document
		# all have to resolve before a fifteen-minute capture is worth starting.
		# This runs the *scene*, not `--check-only --script`, so AppFlow and
		# SaveService are registered exactly as they are in the capture.
		var level := CAMPAIGN_REGISTRY.find_campaign_level(5)
		if level == null:
			push_error("LEVEL5 HARNESS CHECK FAIL: campaign slot 5 is not registered")
			get_tree().quit(1)
			return
		_app_root = APP_ROOT_SCENE.instantiate()
		add_child(_app_root)
		await get_tree().process_frame
		AppFlow.start_campaign_level(StringName("chapter_1_level_5"))
		for _frame: int in 10:
			await get_tree().process_frame
			await get_tree().physics_frame
		var host := _app_root.get_node_or_null("RouteHost")
		var live := host.get_child(0) if host != null and host.get_child_count() > 0 else null
		var dungeon := live.get_node_or_null("Level") as DungeonLevel if live != null else null
		var ok := dungeon != null and not dungeon.level_data.is_empty()
		print("LEVEL5 HARNESS CHECK %s: level=%s floor_cells=%d entities=%d"
			% [
				"OK" if ok else "FAIL",
				dungeon.level_data_path if dungeon != null else "(none)",
				dungeon.backdrop.get_used_cells().size() if dungeon != null else 0,
				(dungeon.level_data.get("entities", []) as Array).size() if dungeon != null else 0,
			])
		if AppFlow.has_active_run():
			AppFlow.abort_to_home()
			await get_tree().process_frame
		get_tree().quit(0 if ok else 1)
		return

	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	await get_tree().process_frame
	AppFlow.start_campaign_level(StringName("chapter_1_level_5"))
	for _frame: int in 10:
		await get_tree().process_frame
		await get_tree().physics_frame

	var route_host := _app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0) as Node2D
		if route_host != null and route_host.get_child_count() > 0
		else null
	)
	var dungeon := (
		(game.get_node_or_null("Level") as DungeonLevel) if game != null else null
	)
	var entity_root := (
		(game.get_node_or_null("Level/Entities") as Node2D) if game != null else null
	)
	var player := (
		entity_root.get_node_or_null("Knight") as CharacterBody2D
		if entity_root != null
		else null
	)
	if game == null or dungeon == null or player == null:
		push_error("LEVEL5 REVIEW CAPTURE FAIL: live Level 5 scene did not reach ready")
		exit_code = 1
	else:
		print("LEVEL5 REVIEW CAPTURE: level doc=%s floors=%d entities=%d"
			% [
				dungeon.level_data_path,
				dungeon.backdrop.get_used_cells().size(),
				(dungeon.level_data.get("entities", []) as Array).size(),
			])
		var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
		if tutorial != null:
			tutorial.hide()
			tutorial.process_mode = Node.PROCESS_MODE_DISABLED
		DirAccess.make_dir_recursive_absolute(
			ProjectSettings.globalize_path(_out_dir)
		)
		for station: String in STATIONS:
			if not _only.is_empty() and station != _only:
				continue
			var ok := await _capture_station(station, dungeon, player, game)
			if not ok:
				exit_code = 1

	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
		await get_tree().process_frame
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := save_path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
	print("LEVEL5 REVIEW CAPTURE DONE: tag=%s stations=%s" % [_tag, _only if not _only.is_empty() else "all"])
	get_tree().quit(exit_code)


func _find_boss(game: Node2D, dungeon: DungeonLevel) -> HoodedArcherMiniboss:
	# main.gd renames every spawned entity to the PascalCase of its map id
	# (`l5_hooded_archer_miniboss` -> `L5HoodedArcherMiniboss`), so the boss
	# scene's own root name "KingdomArcher" is never a node name at runtime.
	# Query it the way the game does: the live `minibosses` group, filtered to
	# the id the Level 5 document actually authors.
	var authored := ""
	for raw: Variant in (dungeon.level_data.get("entities", []) as Array):
		if raw is Dictionary \
				and String((raw as Dictionary).get("type", "")) == "hooded_archer_miniboss":
			authored = String((raw as Dictionary).get("id", ""))
			break
	var expected := authored.to_pascal_case()
	for node: Node in game.get_tree().get_nodes_in_group(&"minibosses"):
		var candidate := node as HoodedArcherMiniboss
		if candidate == null or not candidate.is_inside_tree():
			continue
		if not expected.is_empty() and String(candidate.name) != expected:
			continue
		return candidate
	return null


func _capture_station(
	station: String,
	dungeon: DungeonLevel,
	player: CharacterBody2D,
	game: Node2D,
) -> bool:
	var boss := _find_boss(game, dungeon)
	var target := Vector2.ZERO
	if station == "f3_archer":
		if boss == null:
			push_error("LEVEL5 REVIEW CAPTURE FAIL: station f3_archer has no live KingdomArcher")
			return false
		target = boss.global_position + Vector2(165.0, 0.0)
	else:
		var cell: Vector2i = STATION_CELLS[station]
		target = dungeon.to_global(Vector2(cell * 16) + Vector2(8.0, 8.0))

	var cell_now := Vector2i(floori(target.x / 16.0), floori(target.y / 16.0))
	if not _station_cell_is_valid(dungeon, cell_now):
		# The anchor is a design intent, not a guarantee: if a later map edit
		# moves the floor under it, step outward instead of losing the whole
		# capture pass, and say so in the log.
		var snapped := _nearest_valid_cell(dungeon, cell_now)
		if snapped == cell_now:
			push_error("LEVEL5 REVIEW CAPTURE INVALID STATION %s at %s" % [station, cell_now])
			return false
		print("LEVEL5 REVIEW STATION MOVED tag=%s station=%s %s -> %s"
			% [_tag, station, cell_now, snapped])
		cell_now = snapped
		target = dungeon.to_global(Vector2(cell_now * 16) + Vector2(8.0, 8.0))

	if station == "f3_archer" and boss != null:
		# The production phase-2 Soul Mark windup: bow-local charge plus the
		# target-bound rune. This is the state the boss HUD is authored for, and
		# it is set exactly the way tests/chapter_1_level_5_archer_visual_capture.gd
		# sets it, so the frame is comparable with that suite's own artifact.
		boss.set_priority_target(player)
		boss.set(&"_target", player)
		boss.call(&"_mark_engaged")
		boss.health = roundi(float(boss.max_health) * 0.64)
		boss.set(&"_phase", 2)
		boss.health_changed.emit(boss.health, boss.max_health)
		boss.phase_changed.emit(2)
		boss.call(&"_enter_state", HoodedArcherMiniboss.State.MARK_AIM)
		boss.call(&"_sync_boss_vfx")

	player.global_position = target
	player.set_physics_process(false)
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	for _f: int in _sim_frames:
		await get_tree().physics_frame
		await get_tree().process_frame
		# Review frames are about the level, not about how far the Knight has
		# walked: keep the HUD alive without simulating a whole fight between
		# stations. Health only; no other state is touched.
		if "health" in player and "max_health" in player:
			player.set("health", player.get("max_health"))
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var output := "%s/%s_%s.png" % [_out_dir, _tag, station]
	var saved := image.save_png(ProjectSettings.globalize_path(output))
	print("LEVEL5 REVIEW STATION tag=%s station=%s cell=%s size=%dx%d out=%s ok=%s"
		% [_tag, station, cell_now, image.get_width(), image.get_height(), output, str(saved == OK)])
	return saved == OK


func _station_cell_is_valid(dungeon: DungeonLevel, cell: Vector2i) -> bool:
	if dungeon.backdrop.get_cell_source_id(cell) == -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell) != -1:
		return false
	if dungeon.geometry.get_cell_source_id(cell + Vector2i.UP) != -1:
		return false
	for entity_raw: Variant in dungeon.level_data.get("entities", []):
		if not entity_raw is Dictionary or String((entity_raw as Dictionary).get("type", "")) != "spikes":
			continue
		var position: Array = (entity_raw as Dictionary).get("position", [])
		if position.size() < 2:
			continue
		var spike_cell := Vector2i(floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0))
		if spike_cell == cell:
			return false
	return true


func _nearest_valid_cell(dungeon: DungeonLevel, origin: Vector2i) -> Vector2i:
	for radius: int in range(1, 8):
		for offset_y: int in range(-radius, radius + 1):
			for offset_x: int in range(-radius, radius + 1):
				if maxi(absi(offset_x), absi(offset_y)) != radius:
					continue
				var candidate := origin + Vector2i(offset_x, offset_y)
				if _station_cell_is_valid(dungeon, candidate):
					return candidate
	return origin


func _seed_campaign_entry() -> void:
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ready_level_ids: Array[String] = []
	for level: LevelDefinition in ready_levels:
		ready_level_ids.append(String(level.level_id))
	SaveService.call(
		&"transact_once",
		"tests:level5_blood_crucible_capture:%s" % _tag,
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			campaign["unlocked_levels"] = ready_level_ids.duplicate()
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
		{
			"kind": "level5_review_capture",
			"tag": _tag,
		}
	)
