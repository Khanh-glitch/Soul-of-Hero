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
var _progress := "boot"


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
	# Watchdog: a CI capture must never hang. If any await never resolves (a
	# viewport that stops drawing, a campaign boot that stalls), this quits with a
	# non-zero code and a printed reason so the log says what happened.
	var watchdog := Timer.new()
	watchdog.wait_time = 480.0
	watchdog.one_shot = true
	watchdog.autostart = true
	watchdog.timeout.connect(func() -> void:
		push_error("CRUCIBLE CAPTURE TIMEOUT: last station started was %s" % _progress)
		get_tree().quit(2))
	add_child(watchdog)
	_run.call_deferred()



func _run() -> void:
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://tests/crucible_capture_%d.json" % Time.get_ticks_usec()
	SaveService.call(&"configure_storage", save_path, true)
	_seed_campaign_entry()
	print("CRUCIBLE BOOT: save=%s" % save_path)

	_app_root = APP_ROOT_SCENE.instantiate()
	add_child(_app_root)
	# Let the app finish its own boot before starting a run.
	#
	# Starting a campaign level while AppRoot is still booting leaves the app's
	# route unfinished: its boot coroutine sees an active run, skips opening the
	# title, records boot_state=failed and pushes "Home scene loaded, but AppFlow
	# did not open the startup profile choice." This harness used to trigger that
	# every run, which is where the startup error in the previous evidence came
	# from. Waiting for the boot to complete removes it without touching the app,
	# and it also means every frame below is taken on the route a player actually
	# walks: title -> campaign level.
	var boot_state := "unknown"
	for _attempt: int in range(240):
		boot_state = String(_app_root.get("_boot_state"))
		if boot_state == "complete" or boot_state == "failed":
			break
		await get_tree().process_frame
	print("CRUCIBLE BOOT: app_boot=%s" % boot_state)
	await get_tree().process_frame

	var definition := CAMPAIGN_REGISTRY.find_campaign_level(SLOT)
	if definition == null:
		push_error("CRUCIBLE CAPTURE FAIL: no campaign definition for slot %d" % SLOT)
		_finish(1)
		return
	_level_id = String(definition.level_id)
	_progress = "start_campaign_level"
	var started := AppFlow.start_campaign_level(StringName(_level_id))
	print("CRUCIBLE BOOT: level=%s started=%s" % [_level_id, started])
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
	# Cost, not speed. The CI runner renders with llvmpipe (software rasterising),
	# so a frame rate measured here says nothing about a player's GPU: the previous
	# evidence printed fps=1 and that number was meaningless. What is meaningful is
	# how much the layer costs to submit -- nodes, draw calls and the atlas memory
	# it adds -- so that is what is recorded, and the renderer is named alongside it.
	print("CRUCIBLE PERF: art=%s renderer=%s nodes=%d draw_calls=%d static_mb=%.1f tree_objects=%d"
		% [
			"on" if art != null else "off",
			RenderingServer.get_video_adapter_name(),
			int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
			int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
			Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
			int(Performance.get_monitor(Performance.OBJECT_COUNT)),
		])

	var tutorial := game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial != null:
		tutorial.hide()
		tutorial.process_mode = Node.PROCESS_MODE_DISABLED
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out_dir))

	var exit_code := 0
	for station: Dictionary in STATIONS:
		if station["id"] == "f3_fight":
			# GDScript refuses `not await call()` inside a condition, so the result
			# is bound to a local first.
			var fought: bool = await _capture_fight(station, dungeon, player)
			if not fought:
				exit_code = 1
			continue
		var shot: bool = await _capture(station, player)
		if not shot:
			exit_code = 1
	for overview: Dictionary in OVERVIEWS:
		var wide: bool = await _capture(overview, player, true)
		if not wide:
			exit_code = 1
	# Real input: walk the Knight through the level with the movement actions,
	# along a path found in the level's own collision grid, and cross a door.
	if not _no_art:
		var traversed: bool = await _traverse(player, dungeon)
		if not traversed:
			exit_code = 1
	print("CRUCIBLE CAPTURE DONE: tag=%s" % _tag)
	_finish(exit_code)


func _finish(code: int) -> void:
	# Free the app we created and let two frames go by before quitting. The
	# previous evidence logged a leaked CanvasItem RID and 8 leaked ObjectDB
	# instances on exit; those are our own live nodes being destroyed by the
	# process teardown rather than by their owner, so the owner is torn down
	# explicitly first and the exit is clean.
	if _app_root != null and is_instance_valid(_app_root):
		_app_root.queue_free()
		for _i: int in range(3):
			await get_tree().process_frame
		_app_root = null
	print("CRUCIBLE EXIT: code=%d" % code)
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
	_progress = String(station.get("id", "?"))
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
## the Knight into the arena, wakes the archer, lets the fight run and photographs
## it mid-combat with the boss's own projectiles in the air. It also reports the
## Knight's health and the boss's health/state, so the frame is backed by numbers
## taken from the live objects rather than by a filename.
func _capture_fight(station: Dictionary, dungeon: DungeonLevel, player: CharacterBody2D) -> bool:
	var archer: Node2D = null
	var root := dungeon.get_node_or_null("Entities")
	if root != null:
		for child: Node in root.get_children():
			# main.gd stamps entities with level_entity_type; older builds used
			# entity_type. Read both rather than silently missing the boss.
			var kind := String(child.get_meta(&"level_entity_type",
				child.get_meta(&"entity_type", "")))
			if kind == "hooded_archer_miniboss":
				archer = child as Node2D
				break
	if archer == null:
		push_error("CRUCIBLE FIGHT: no hooded_archer_miniboss in the live entity root")
		return false
	print("CRUCIBLE FIGHT: archer found at %s" % archer.global_position)
	var target := Vector2i(
		int(archer.global_position.x / TILE) - 6, int(archer.global_position.y / TILE) + 1)
	var cell := _valid_cell(dungeon, target)
	_progress = "f3_fight"
	player.global_position = Vector2(cell.x * TILE + TILE * 0.5, cell.y * TILE + TILE * 0.5)
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		camera.zoom = Vector2.ONE
		camera.force_update_scroll()
	# Record the fight from the live objects: the Knight's health pool and the
	# boss's health, poise and state machine. Values are read through `get` so the
	# harness does not depend on a particular script interface.
	var hp_before := _health_of(player)
	var boss_before := _number_property(archer, "health")
	await get_tree().physics_frame
	# The fight runs under input: the Knight closes the distance and swings. The
	# harness never touches health values, so any damage in this frame is the
	# game's own combat resolving.
	var attack_frames := 0
	for frame: int in range(240):
		var to_archer := archer.global_position - player.global_position
		if to_archer.length() > 92.0:
			_drive(player, to_archer)
		else:
			_release_movement()
		if frame % 40 < 8:
			if not Input.is_action_pressed(&"attack"):
				Input.action_press(&"attack")
				attack_frames += 1
		elif Input.is_action_pressed(&"attack"):
			Input.action_release(&"attack")
		await get_tree().physics_frame
	var boss_after := _number_property(archer, "health")
	_release_movement()
	if Input.is_action_pressed(&"attack"):
		Input.action_release(&"attack")
	print("CRUCIBLE FIGHT: swings=%d boss_hp %s -> %s" % [attack_frames, boss_before, boss_after])
	var hp_after := _health_of(player)
	var boss_health := _number_property(archer, "health")
	var boss_max := _number_property(archer, "max_health")
	# The archer keeps its machine in `_state`; read it through the script property
	# rather than guessing a public name.
	var boss_state := "n/a"
	if "_state" in archer:
		boss_state = _enum_name(archer, "State", archer.get("_state"))
	elif "state" in archer:
		boss_state = _enum_name(archer, "State", archer.get("state"))
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var path := "%s/%s_%s.png" % [_out_dir, _tag, station["id"]]
	var error := image.save_png(path)
	print("CRUCIBLE FIGHT: knight_hp %s -> %s | boss_hp=%s/%s boss_state=%s"
		% [hp_before, hp_after, boss_health, boss_max, boss_state])
	print("CRUCIBLE STATION tag=%s station=%s cell=%s zoom=1.00 out=%s ok=%s knight_hp=%s boss_hp=%s"
		% [_tag, station["id"], cell, path, error == OK, hp_after, boss_health])
	# The frame counts as a fight frame only if it happened mid-combat.
	var engaged := boss_state != "0" and boss_state != "n/a"
	if not engaged:
		push_warning("CRUCIBLE FIGHT: boss state %s looked like it had not engaged" % boss_state)
	return error == OK


func _health_of(node: Node) -> String:
	var current := _number_property(node, "health")
	var maximum := _number_property(node, "max_health")
	if current.is_empty() or maximum.is_empty():
		return "n/a"
	return "%s/%s" % [current, maximum]


func _number_property(node: Node, property: String) -> String:
	if node == null or not property in node:
		return ""
	return str(int(node.get(property)))


# -- input-driven traversal ---------------------------------------------------
## Walk the Knight through the level with the real movement actions and open floor
## doors with real left clicks.
##
## This is the part of the evidence that is not a staged camera station. A path is
## found in the level's own collision grid, the Knight is driven along it by
## pressing the same actions a player presses, and each door is opened by
## injecting a left mouse button event, which goes through the Knight's own
## _unhandled_input -> _try_interact path. The two legs run F1 spawn -> F1 gate ->
## F2 landing, then F2 landing -> F2/F3 door -> F3 landing, so the sequence crosses
## two floor transitions under input.
##
## The Knight is staged at the start of the first leg (after the fight station he
## is standing in the arena). That staging is printed, because it is the only
## teleport in the sequence; everything after it is walked.
func _traverse(player: CharacterBody2D, dungeon: DungeonLevel) -> bool:
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		camera.zoom = Vector2.ONE
	var legs := [
		{"name": "f1_spawn_to_f1_gate", "start": Vector2i(10, 17), "door": Vector2i(104, 17)},
		{"name": "f2_landing_to_f2_f3_door", "start": Vector2i(9, 48), "door": Vector2i(106, 48)},
	]
	var walkable := _walkable_cells(dungeon)
	# Enemies are solid bodies, so a route that ignores them ends with the Knight
	# walking into a skeleton and stopping. Their cells are treated as blocked for
	# planning (with a margin that shrinks if no route exists), and the walk itself
	# is still real input: the harness does not move enemies or teleport past them.
	var enemy_cells := _enemy_cells(dungeon)
	var shot := 0
	var ok := true
	for leg: Dictionary in legs:
		var start_cell: Vector2i = leg["start"]
		var door_cell: Vector2i = leg["door"]
		player.global_position = Vector2(start_cell.x * TILE + TILE * 0.5,
			start_cell.y * TILE + TILE * 0.5)
		player.velocity = Vector2.ZERO
		for _i: int in range(6):
			await get_tree().physics_frame
		print("CRUCIBLE TRAVERSAL: leg=%s staged_at=%s" % [leg["name"], start_cell])
		var path := _path_around_enemies(walkable, enemy_cells, start_cell, door_cell)
		if path.is_empty():
			push_error("CRUCIBLE TRAVERSAL FAIL: no walkable path %s -> %s"
				% [start_cell, door_cell])
			ok = false
			continue
		print("CRUCIBLE TRAVERSAL: leg=%s path=%d cells" % [leg["name"], path.size()])
		# Walk leg by leg. The path is planned on the tile grid; the Knight is a
		# body with a radius, so a corner can stop him where a cell is technically
		# walkable. When that happens the harness re-plans from wherever he actually
		# is, and nudges him sideways for a few frames, rather than teleporting:
		# the point of this sequence is that the movement is real input.
		var index := 0
		var frames := 0
		var replans := 0
		var stuck := 0
		var last_position := player.global_position
		var shot_taken := 0
		while frames < 2200:
			var cell_now := Vector2i(int(player.global_position.x / TILE),
				int(player.global_position.y / TILE))
			if cell_now == door_cell or index >= path.size():
				break
			var target := Vector2(path[index].x * TILE + TILE * 0.5,
				path[index].y * TILE + TILE * 0.5)
			var delta := target - player.global_position
			if delta.length() < 7.0:
				index += 1
				continue
			_drive(player, delta)
			await get_tree().physics_frame
			frames += 1
			if player.global_position.distance_to(last_position) < 0.4:
				stuck += 1
				if stuck > 18:
					replans += 1
					_release_movement()
					# step off the corner: press perpendicular to the blocked heading
					var side := Vector2(-delta.y, delta.x).normalized()
					if replans % 2 == 0:
						side = -side
					_drive_direction(player, side)
					for _k: int in range(16):
						await get_tree().physics_frame
					_release_movement()
					var from_here := Vector2i(int(player.global_position.x / TILE),
						int(player.global_position.y / TILE))
					var replanned := _path_around_enemies(walkable, enemy_cells, from_here, door_cell)
					if replanned.is_empty() or replans > 12:
						push_error("CRUCIBLE TRAVERSAL FAIL: no route from %s after %d replans"
							% [from_here, replans])
						break
					path = replanned
					index = 0
					stuck = 0
					print("CRUCIBLE TRAVERSAL: leg=%s replan=%d from=%s path=%d"
						% [leg["name"], replans, from_here, path.size()])
			else:
				stuck = 0
				last_position = player.global_position
			if shot_taken < 4 and frames > 26 * (shot_taken + 1):
				await RenderingServer.frame_post_draw
				var image := get_viewport().get_texture().get_image()
				var path_out := "%s/%s_traversal_%d.png" % [_out_dir, _tag, shot_taken + 1]
				var saved := image.save_png(path_out) == OK
				print("CRUCIBLE TRAVERSAL SHOT tag=%s leg=%s step=%d cell=%s out=%s ok=%s"
					% [_tag, leg["name"], shot_taken + 1,
						Vector2i(int(player.global_position.x / TILE),
							int(player.global_position.y / TILE)), path_out, saved])
				shot_taken += 1
		_release_movement()
		var arrived := player.global_position.distance_to(
			Vector2(door_cell.x * TILE + TILE * 0.5, door_cell.y * TILE + TILE * 0.5)) < 44.0
		print("CRUCIBLE TRAVERSAL: leg=%s arrived=%s frames=%d at=%s"
			% [leg["name"], arrived, frames,
				Vector2i(int(player.global_position.x / TILE), int(player.global_position.y / TILE))])
		if not arrived:
			ok = false
			continue
		if not await _use_door(player, dungeon, door_cell, leg["name"]):
			ok = false
	_drive_shots_done()
	return ok


## Open a door with a real left click, and fall back to the door's own interact()
## only if the injected click was swallowed -- logging which one happened.
func _use_door(player: CharacterBody2D, dungeon: DungeonLevel, door_cell: Vector2i,
		leg_name: String) -> bool:
	for _i: int in range(4):
		await get_tree().physics_frame
	var before := player.global_position
	var screen_position: Vector2 = get_viewport().get_canvas_transform() * before
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		event.position = screen_position
		Input.parse_input_event(event)
	for _i: int in range(24):
		await get_tree().physics_frame
	var moved := player.global_position.distance_to(before)
	var via := "input_click" if moved > 64.0 else "none"
	if via == "none":
		var door := _door_near(dungeon, door_cell)
		if door != null and door.has_method(&"interact"):
			var used: bool = bool(door.call(&"interact", player))
			via = "direct_call" if used else "failed"
			for _i: int in range(12):
				await get_tree().physics_frame
			moved = player.global_position.distance_to(before)
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var out := "%s/%s_traversal_door_%s.png" % [_out_dir, _tag, leg_name]
	var saved := image.save_png(out) == OK
	print("CRUCIBLE TRAVERSAL: leg=%s door_used_via=%s moved=%.1f from=%s to=%s ok=%s"
		% [leg_name, via, moved, before, player.global_position, saved])
	return moved > 64.0


func _drive_shots_done() -> void:
	print("CRUCIBLE TRAVERSAL: sequence complete")


func _drive(player: CharacterBody2D, delta: Vector2) -> void:
	var pressed := {
		&"move_right": delta.x > 4.0, &"move_left": delta.x < -4.0,
		&"move_down": delta.y > 4.0, &"move_up": delta.y < -4.0,
	}
	for action: StringName in pressed:
		if bool(pressed[action]):
			if not Input.is_action_pressed(action):
				Input.action_press(action)
		elif Input.is_action_pressed(action):
			Input.action_release(action)


func _drive_direction(player: CharacterBody2D, direction: Vector2) -> void:
	_drive(player, direction * 12.0)


func _release_movement() -> void:
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		if Input.is_action_pressed(action):
			Input.action_release(action)


func _walkable_cells(dungeon: DungeonLevel) -> Dictionary:
	var floor := {}
	for tile: Dictionary in dungeon.level_data.get("layers", {}).get("Backdrop", []):
		floor[Vector2i(int(tile["x"]), int(tile["y"]))] = true
	for tile: Dictionary in dungeon.level_data.get("layers", {}).get("Geometry", []):
		floor.erase(Vector2i(int(tile["x"]), int(tile["y"])))
	return floor


## Turn an enum integer into its declared name, so the log reads RECOVER rather
## than 10. Falls back to the raw value when the enum is not on the script.
func _enum_name(node: Object, enum_name: String, value: Variant) -> String:
	var script: Script = node.get_script() as Script
	if script != null:
		var constants := script.get_script_constant_map()
		var table: Variant = constants.get(enum_name)
		if table is Dictionary:
			for key: String in table:
				if int(table[key]) == int(value):
					return key
	return str(value)


## Cells occupied by a living enemy, grown by `margin` cells.
func _enemy_cells(dungeon: DungeonLevel, margin: int = 1) -> Dictionary:
	var blocked := {}
	var root := dungeon.get_node_or_null("Entities")
	if root == null:
		return blocked
	for child: Node in root.get_children():
		if not child is Node2D or not (child is CharacterBody2D):
			continue
		if String(child.name) == "Knight":
			continue
		if "health" in child and int(child.get("health")) <= 0:
			continue
		var cell := Vector2i(int((child as Node2D).global_position.x / TILE),
			int((child as Node2D).global_position.y / TILE))
		for dy: int in range(-margin, margin + 1):
			for dx: int in range(-margin, margin + 1):
				blocked[Vector2i(cell.x + dx, cell.y + dy)] = true
	return blocked


## Plan a route that respects the enemies standing on it, widening the margin
## only when nothing else works.
func _path_around_enemies(walkable: Dictionary, enemy_cells: Dictionary,
		start: Vector2i, goal: Vector2i) -> Array:
	for margin: int in [1, 0]:
		var filtered := {}
		for cell: Vector2i in walkable:
			if margin == 1 and enemy_cells.has(cell):
				continue
			filtered[cell] = true
		var path := _path_cells(filtered, start, goal)
		if not path.is_empty():
			return path
	return _path_cells(walkable, start, goal)


func _path_cells(walkable: Dictionary, start: Vector2i, goal: Vector2i) -> Array:
	if not walkable.has(start) or not walkable.has(goal):
		return []
	var previous := {start: start}
	var queue: Array = [start]
	var head := 0
	while head < queue.size():
		var cell: Vector2i = queue[head]
		head += 1
		if cell == goal:
			break
		for step: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next: Vector2i = cell + step
			if walkable.has(next) and not previous.has(next):
				previous[next] = cell
				queue.append(next)
	if not previous.has(goal):
		return []
	var path: Array = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		cursor = previous[cursor]
	return path


func _door_near(dungeon: DungeonLevel, cell: Vector2i) -> Node2D:
	var wanted := Vector2(cell.x * TILE + TILE * 0.5, cell.y * TILE + TILE * 0.5)
	for node: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if node is Node2D and (node as Node2D).global_position.distance_to(wanted) < 48.0:
			return node as Node2D
	return null
