extends Node

## Gate 2 evidence harness.
##
## Starts Chapter 1 Level 3 through the real AppRoot/AppFlow campaign route and
## captures native 1280x720 frames of the production Main scene with the real
## HUD and the real Knight. Nothing is composited, cropped or upscaled here.
##
##   godot --path . --rendering-method gl_compatibility --audio-driver Dummy \
##         --resolution 1280x720 res://prototypes/gate2/capture_gate2.tscn
##   ... same, with `-- --overlay` for the AFTER run.
##
## The harness never teleports the Knight between stations: it plans a route over
## the level's own walkable cells (minus the props' solid footprints and minus
## Candidate A's spike hazards) and walks it with the production input actions.
## If a station cannot be reached on foot the run FAILS rather than quietly
## framing a teleport.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const OVERLAY_SCENE: PackedScene = preload("res://prototypes/gate2/gate2_redesign.tscn")
const LEVEL_PATH := "res://data/levels/chapter_1_level_3.json"
const PLACEMENT_PATH := "res://prototypes/gate2/visual_placement.json"
const GATE2_LEVEL_PATH := "res://prototypes/gate2/level_data/chapter_1_level_3_gate2.json"
const OUT_DIR := "res://.artifacts/gate2"

## Candidate A's pinned Level 3 document (design-pilot f27e8b7).
const LEVEL_SHA256 := "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
const EXPECTED_BASE_CELLS := {"Backdrop": 3351, "Geometry": 1702, "Decor": 73}
const EXPECTED_GATE2_CELLS := {"Backdrop": 3363, "Geometry": 1690, "Decor": 73}
const EXPECTED_ENTITIES := 79
const EXPECTED_TILESET_SOURCES := 2
const EXPECTED_SIZE := Vector2i(1280, 720)
const TILE := 16

## Camera stations, in cells. `spawn` is Candidate A's authored spawn point and
## is not a choice; the rest are chosen so the thing each station is about lands
## in the clear band of the frame, between the top banner and the bottom bar:
##   archive_entry  walking the artery into the armarium bay
##   landmark       the open armarium in its alcove
##   cloister       the flooded garth seen from the west ambulatory
##   combat_space   the east reading room, long board used as cover
##   return_route   the south ambulatory, looking back at the cloister
const STATIONS := {
	"spawn": Vector2i(17, 13),
	"archive_entry": Vector2i(23, 12),
	"landmark": Vector2i(30, 12),
	"cloister": Vector2i(38, 16),
	"combat_space": Vector2i(62, 21),
	"return_route": Vector2i(46, 21),
}
const STATION_ORDER: Array[String] = [
	"spawn", "archive_entry", "landmark", "cloister", "combat_space", "return_route",
]

var _with_overlay := false
var _app_root: Node
var _game: Node2D
var _dungeon: DungeonLevel
var _player: CharacterBody2D
var _overlay: Node
var _failures: Array[String] = []
var _shots := 0
var _blocked_cells := {}


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument == "--overlay":
			_with_overlay = true
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	if not await _boot():
		_finish()
		return
	if _with_overlay and not await _attach_overlay():
		_finish()
		return
	_check_contracts()
	await _capture_stations()
	await _probe_collision()
	_finish()


# ---------------------------------------------------------------- boot -------

func _boot() -> bool:
	var digest := _file_sha256(LEVEL_PATH)
	var expected := _file_sha256(GATE2_LEVEL_PATH) if _with_overlay else LEVEL_SHA256
	if expected.is_empty():
		_push("the pinned level document is missing from the checkout")
		return false
	if digest != expected:
		_push("Level 3 source pin mismatch; expected %s, observed %s" % [expected, digest])
		return false
	print("GATE2 LEVEL: %s sha256=%s" % [LEVEL_PATH, digest])

	# A direct Main launch activates the Level 1 movement/dash tutorial; enter
	# through AppFlow as a real campaign run instead.
	if not _seed_isolated_campaign_save():
		return false
	_app_root = APP_ROOT_SCENE.instantiate()
	if _app_root == null:
		_push("production AppRoot did not instantiate")
		return false
	add_child(_app_root)
	var boot_deadline := Time.get_ticks_msec() + 20000
	while AppFlow.get_current_route() != &"title" and Time.get_ticks_msec() < boot_deadline:
		await get_tree().process_frame
	if AppFlow.get_current_route() != &"title":
		_push("production AppRoot did not complete its Boot -> Title route")
		return false
	if not AppFlow.start_campaign_level(&"chapter_1_level_3"):
		_push("production campaign gate rejected Level 3")
		return false
	if not AppFlow.has_active_run():
		_push("production campaign run is not active")
		return false
	var active: Dictionary = AppFlow.get_active_run()
	if StringName(active.get("content_level_id", &"")) != &"chapter_1_level_3":
		_push("wrong campaign content level in AppFlow")
		return false
	for _frame: int in 10:
		await get_tree().process_frame
		await get_tree().physics_frame
	var host := _app_root.get_node_or_null("RouteHost")
	_game = host.get_child(0) as Node2D if host != null and host.get_child_count() > 0 else null
	if _game == null:
		_push("production campaign route did not instantiate Main")
		return false
	_dungeon = _game.get_node_or_null("Level") as DungeonLevel
	if _dungeon == null or String(_dungeon.level_data_path) != LEVEL_PATH:
		_push("campaign Main failed to load the intended Level 3")
		return false
	_dungeon.watch_file_changes = false
	var tutorial := _game.get_node_or_null("LevelOneTutorial") as CanvasLayer
	if tutorial == null:
		_push("production Main is missing its LevelOneTutorial node")
	else:
		var tutorial_panel := tutorial.get_node_or_null("%TutorialPanel") as CanvasItem
		if tutorial_panel == null:
			_push("cannot locate the real tutorial panel for Level 3 validation")
		elif tutorial_panel.visible:
			_push("Level 1 tutorial incorrectly visible in campaign Level 3")
	print("GATE2 CAMPAIGN ROUTE: %s, real HUD and active Level 3"
		% String(active.get("content_level_id", "")))

	var container := _game.get_node_or_null("Level/Entities") as Node2D
	if container == null:
		_push("the live level has no Entities container")
		return false
	_player = container.get_node_or_null("Knight") as CharacterBody2D
	if _player == null:
		_push("the production Knight is not in the Entities container")
		return false
	var players := get_tree().get_nodes_in_group(&"player")
	if players.size() != 1:
		_push("expected exactly 1 Knight in the scene, found %d" % players.size())
	return _failures.is_empty()


func _seed_isolated_campaign_save() -> bool:
	var save_path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = "user://gate2_%d.json" % Time.get_ticks_usec()
	if not bool(SaveService.call(&"configure_storage", save_path, true)):
		_push("failed to isolate campaign save")
		return false
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ids: Array[String] = []
	for definition: LevelDefinition in ready_levels:
		ids.append(String(definition.level_id))
	var seeded := bool(SaveService.call(&"transact_once",
		"gate2:isolated_campaign_entry",
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var campaign: Dictionary = progression.get("campaign", {}).duplicate(true)
			campaign["unlocked_levels"] = ids.duplicate()
			var completed: Dictionary = campaign.get("completed_levels", {}).duplicate(true)
			for definition: LevelDefinition in ready_levels:
				for prerequisite_id: String in definition.unlock_requirements.prerequisite_level_ids:
					completed[prerequisite_id] = true
			campaign["completed_levels"] = completed
			progression["campaign"] = campaign
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			for definition: LevelDefinition in ready_levels:
				for feature_id: String in definition.unlock_requirements.required_feature_ids:
					features[feature_id] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true,
		{"kind": "isolated_gate2_native_capture"}))
	if not seeded:
		_push("could not seed isolated Level 3 entitlement")
	return seeded


func _attach_overlay() -> bool:
	_overlay = OVERLAY_SCENE.instantiate()
	if _overlay == null:
		_push("the overlay scene did not instantiate")
		return false
	_dungeon.add_child(_overlay)
	await get_tree().process_frame
	await get_tree().physics_frame
	if not bool(_overlay.call("attach_to_level", _dungeon)):
		for message: Variant in _overlay.call("get_failures"):
			_push("overlay: " + String(message))
		return false
	for _frame: int in 2:
		await get_tree().physics_frame
	print("GATE2 OVERLAY ATTACHED: %d props, %d solid bodies, %d material layers, %d lights"
		% [int(_overlay.get("props_added")), int(_overlay.get("colliders_added")),
			int(_overlay.get("material_layers_added")), int(_overlay.get("lights_added"))])
	if int(_overlay.get("colliders_added")) <= 0:
		_push("the overlay added no collision bodies, which cannot be right")
	_blocked_cells = _overlay_blocked_cells()
	_blocked_cells.merge(_hazard_cells())
	return _failures.is_empty()


# ---------------------------------------------------------- contracts --------

func _check_contracts() -> void:
	var document: Dictionary = _dungeon.level_data
	var expected: Dictionary = EXPECTED_GATE2_CELLS if _with_overlay else EXPECTED_BASE_CELLS
	for layer_name: String in expected:
		var authored := int((document.get("layers", {}).get(layer_name, []) as Array).size())
		_expect(authored == expected[layer_name],
			"%s authors %d cells (expected %d)"
			% [layer_name, authored, expected[layer_name]])
	_expect(_dungeon.backdrop.get_used_cells().size() == expected["Backdrop"],
		"every authored Backdrop cell is applied to the live TileMapLayer")
	_expect(_dungeon.geometry.get_used_cells().size() == expected["Geometry"],
		"every authored Geometry cell is applied to the live TileMapLayer")
	_expect(_dungeon.decor.get_used_cells().size() == expected["Decor"],
		"every authored Decor cell is applied to the live TileMapLayer")

	var entities: Array = document.get("entities", [])
	_expect(entities.size() == EXPECTED_ENTITIES,
		"the level still authors %d entities (found %d)" % [EXPECTED_ENTITIES, entities.size()])
	var spawn := Vector2i(17, 13)
	var spawn_entity := false
	for entity: Dictionary in entities:
		if String(entity.get("type", "")) == "player":
			var cell := Vector2i(int(entity["position"][0]) / TILE, int(entity["position"][1]) / TILE)
			spawn_entity = spawn_entity or cell == spawn
	_expect(spawn_entity, "the authored player spawn is still at %s" % str(spawn))

	var container := _game.get_node_or_null("Level/Entities") as Node2D
	if container != null:
		var enemies := 0
		for child: Node in container.get_children():
			if child.is_in_group(&"enemies"):
				enemies += 1
		_expect(enemies > 0, "live enemy actors still spawned (%d)" % enemies)
		_expect(container.y_sort_enabled,
			"the entity container is still y-sorted, so props sort with actors")

	var hud := _game.get_node_or_null("HUD")
	_expect(hud != null, "the production HUD is in the scene")
	if hud is CanvasItem:
		_expect((hud as CanvasItem).visible, "the production HUD is visible in frame")
	elif hud is CanvasLayer:
		_expect((hud as CanvasLayer).visible, "the production HUD layer is visible in frame")
	_expect(_count_huds() == 1, "exactly one HUD in the scene")

	# The overlay must not smuggle in a third TileSet source.
	var tileset := _dungeon.backdrop.tile_set
	_expect(tileset != null and tileset.get_source_count() == EXPECTED_TILESET_SOURCES,
		"Backdrop still declares exactly %d authored TileSet sources" % EXPECTED_TILESET_SOURCES)
	_expect(_dungeon.geometry.tile_set != null,
		"Geometry still uses a TileSet built by DungeonLevel")

	if not _with_overlay:
		return
	var placement := _load_json(PLACEMENT_PATH)
	if placement.is_empty():
		_push("cannot read %s" % PLACEMENT_PATH)
		return
	_expect(int(_overlay.get("props_added")) == (placement.get("props", []) as Array).size(),
		"every prop in the placement document was built")
	var material: Dictionary = placement.get("material", {})
	for role: String in (material.keys() as Array).duplicate():
		if role in ["atlas", "tile", "layer_style", "garth"]:
			continue
		var layer := _dungeon.get_node_or_null("Gate2_" + role) as TileMapLayer
		if not (material[role] as Array).is_empty() and layer == null:
			_push("the material layer Gate2_%s is missing from the live level" % role)
			continue
		if layer != null:
			_expect(layer.get_used_cells().size() == (material[role] as Array).size(),
				"Gate2_%s holds %d cells, the document authors %d"
				% [role, layer.get_used_cells().size(), (material[role] as Array).size()])
	# Nothing in the material may cover an authored floor cell: the player's path
	# must never be hidden by scenery.
	var walkable := _authored_floor_cells()
	for role: String in ["vault_b1", "vault_b2", "vault_b3", "vault_b4", "vault_b5", "water", "mass", "wall_face"]:
		var layer := _dungeon.get_node_or_null("Gate2_" + role) as TileMapLayer
		if layer == null:
			continue
		var covered := 0
		for cell: Vector2i in layer.get_used_cells():
			if walkable.has(cell):
				covered += 1
		_expect(covered == 0, "Gate2_%s covers %d walkable floor cells" % [role, covered])


func _count_huds() -> int:
	var count := 0
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if String(node.name) == "HUD":
			count += 1
		stack.append_array(node.get_children())
	return count


func _load_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed as Dictionary if parsed is Dictionary else {}


func _authored_floor_cells() -> Dictionary:
	var cells := {}
	var layers: Dictionary = _dungeon.level_data.get("layers", {})
	for cell: Dictionary in layers.get("Backdrop", []):
		cells[Vector2i(int(cell["x"]), int(cell["y"]))] = true
	for cell: Dictionary in layers.get("Geometry", []):
		cells.erase(Vector2i(int(cell["x"]), int(cell["y"])))
	return cells


func _hazard_cells() -> Dictionary:
	## Candidate A's floor spikes, so the walk avoids them instead of gambling on
	## the Knight surviving a crossing.
	var cells := {}
	for entity: Dictionary in _dungeon.level_data.get("entities", []):
		if String(entity.get("type", "")) != "spikes":
			continue
		var px := float(entity["position"][0])
		var py := float(entity["position"][1])
		for cx: int in range(floori((px - 16.0) / TILE), floori((px + 15.0) / TILE) + 1):
			for cy: int in range(floori((py - 16.0) / TILE), floori((py + 15.0) / TILE) + 1):
				cells[Vector2i(cx, cy)] = true
	return cells


func _overlay_blocked_cells() -> Dictionary:
	## Mirror of the authoring validator: the cells the solid props occupy, so
	## route planning walks around furniture instead of into it.
	var cells := {}
	for entry: Dictionary in _load_json(PLACEMENT_PATH).get("props", []):
		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		var left := float(box[0]) - float(box[2]) * 0.5
		var top := float(box[1]) - float(box[3]) * 0.5
		var right := float(box[0]) + float(box[2]) * 0.5
		var bottom := float(box[1]) + float(box[3]) * 0.5
		for cx: int in range(floori(left / TILE), floori((right - 1.0) / TILE) + 1):
			for cy: int in range(floori(top / TILE), floori((bottom - 1.0) / TILE) + 1):
				cells[Vector2i(cx, cy)] = true
	return cells


# ------------------------------------------------------------ walking --------

func _walkable_cells() -> Dictionary:
	var walkable := _authored_floor_cells()
	for key: Vector2i in _blocked_cells:
		walkable.erase(key)
	# The Knight's BodyShape is 12x16 anchored at his feet, so standing at a cell
	# centre puts his body across that cell and the one above it. A cell is only
	# walkable if BOTH rows are open, or the route plans through gaps his
	# shoulders do not fit through and he wedges on a wall corner.
	var body_safe := {}
	for cell: Vector2i in walkable:
		if walkable.has(cell + Vector2i.UP):
			body_safe[cell] = true
	return body_safe


func _plan_route(from_cell: Vector2i, to_cell: Vector2i) -> Array[Vector2i]:
	var walkable := _walkable_cells()
	if not walkable.has(from_cell) or not walkable.has(to_cell):
		return []
	var previous := {from_cell: from_cell}
	var queue: Array[Vector2i] = [from_cell]
	var head := 0
	while head < queue.size():
		var current: Vector2i = queue[head]
		head += 1
		if current == to_cell:
			break
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]:
			var neighbour: Vector2i = current + step
			if walkable.has(neighbour) and not previous.has(neighbour):
				previous[neighbour] = current
				queue.append(neighbour)
	if not previous.has(to_cell):
		return []
	var route: Array[Vector2i] = []
	var cursor: Vector2i = to_cell
	while cursor != from_cell:
		route.append(cursor)
		cursor = previous[cursor]
	route.append(from_cell)
	route.reverse()
	return route


func _cell_centre(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * TILE + TILE * 0.5, cell.y * TILE + TILE * 0.5)


func _current_cell() -> Vector2i:
	return Vector2i(
		int(floor(_player.global_position.x / TILE)),
		int(floor(_player.global_position.y / TILE))
	)


func _walk_to_station(name: String) -> bool:
	var target_cell: Vector2i = STATIONS[name]
	var route := _plan_route(_current_cell(), target_cell)
	if route.is_empty():
		_push("no walkable route to the '%s' station at %s" % [name, str(target_cell)])
		return false
	var started := _player.global_position
	var index := 1
	var frames := 0
	var stall := 0
	var last_position := started
	var budget := route.size() * 90 + 180
	while index < route.size() and frames < budget:
		var waypoint := _cell_centre(route[index])
		var delta := waypoint - _player.global_position
		if delta.length() <= 5.0:
			index += 1
			stall = 0
			continue
		# Correct both axes, not just the dominant one: pressing one axis lets a
		# few pixels of drift accumulate until the Knight's shoulder catches a
		# wall corner and he wedges.
		var actions: Array[String] = []
		if absf(delta.x) > 2.0:
			actions.append("move_right" if delta.x > 0.0 else "move_left")
		if absf(delta.y) > 2.0:
			actions.append("move_down" if delta.y > 0.0 else "move_up")
		if actions.is_empty():
			actions.append("move_right" if delta.x > 0.0 else "move_left")
		for action: String in actions:
			Input.action_press(action, 1.0)
		await get_tree().physics_frame
		for action: String in actions:
			Input.action_release(action)
		frames += 1
		if _player.global_position.distance_to(last_position) < 0.25:
			stall += 1
			if stall > 45:
				_push("the Knight stalled walking to '%s' at %s"
					% [name, str(_player.global_position)])
				return false
		else:
			stall = 0
			last_position = _player.global_position
	if index < route.size():
		_push("the Knight ran out of frames walking to '%s' (%d/%d waypoints)"
			% [name, index, route.size()])
		return false
	await _settle()
	var travelled := started.distance_to(_player.global_position)
	print("GATE2 WALK: %s  (%.0f, %.0f) -> (%.0f, %.0f)  %.0f px over %d cells in %d frames"
		% [name, started.x, started.y, _player.global_position.x,
			_player.global_position.y, travelled, route.size() - 1, frames])
	_expect(travelled > 16.0 or name == "spawn",
		"'%s' was reached on foot, not by teleporting" % name)
	return true


# ---------------------------------------------------------- evidence ---------

func _capture_stations() -> void:
	for name: String in STATION_ORDER:
		if name != "spawn":
			if not await _walk_to_station(name):
				return
		await _shot(name)


func _settle(frames: int = 8) -> void:
	for _frame: int in frames:
		await get_tree().process_frame
		await get_tree().physics_frame
	var camera := _player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	for _frame: int in 3:
		await get_tree().process_frame


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	if image == null:
		_push("the viewport returned no image for '%s'" % name)
		return
	var prefix := "after" if _with_overlay else "before"
	var path := "%s/%s_%s.png" % [OUT_DIR, prefix, name]
	if image.save_png(ProjectSettings.globalize_path(path)) != OK:
		_push("could not write %s" % path)
		return
	_shots += 1
	if Vector2i(image.get_width(), image.get_height()) != EXPECTED_SIZE:
		_push("%s is %dx%d, expected %dx%d"
			% [name, image.get_width(), image.get_height(), EXPECTED_SIZE.x, EXPECTED_SIZE.y])
	print("GATE2 CAPTURE: %s (%dx%d) at %s"
		% [path, image.get_width(), image.get_height(), str(_player.global_position)])


func _probe_collision() -> void:
	## Collision evidence, in two halves:
	##   1. the Knight's own body shape, at his feet, must not be inside a wall or
	##      a prop at the end of the walk;
	##   2. a point probe inside a solid prop's authored footprint must hit a
	##      Gate2Collision body, and open floor beside the Knight must not - so
	##      the bodies really are where the art is, not somewhere else.
	var shape_node := _player.get_node_or_null("BodyShape") as CollisionShape2D
	if shape_node == null or shape_node.shape == null:
		_push("the Knight has no BodyShape to probe with")
		return
	var space := _player.get_world_2d().direct_space_state
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape_node.shape
	query.transform = _player.global_transform.translated(shape_node.position)
	query.collision_mask = 1
	query.collide_with_areas = false
	var hits := space.intersect_shape(query, 16)
	if not hits.is_empty():
		_push("the Knight ended the walk inside %d collider(s)" % hits.size())
	else:
		print("GATE2 COLLISION: Knight at %s is clear of every wall and prop"
			% str(_player.global_position))

	if not _with_overlay or _overlay == null:
		return
	var collider_root := _overlay.get_node_or_null("Gate2Collision")
	if collider_root == null or collider_root.get_child_count() == 0:
		_push("the overlay has no collision bodies to probe")
		return
	var checked := 0
	for entry: Dictionary in _load_json(PLACEMENT_PATH).get("props", []):
		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		var point := Vector2(float(box[0]), float(box[1]))
		if not _point_hits_gate2_collision(space, point, collider_root):
			_push("no Gate2Collision body under the solid prop '%s' at %s"
				% [String(entry.get("id")), str(point)])
		checked += 1
	print("GATE2 COLLISION: %d solid prop footprints probed, each covered by a body" % checked)

	var clear_point := _player.global_position + Vector2(0, -4)
	if _point_hits_gate2_collision(space, clear_point, collider_root):
		_push("a prop body covers open floor at %s" % str(clear_point))
	else:
		print("GATE2 COLLISION: open floor at %s is free of prop bodies" % str(clear_point))


func _point_hits_gate2_collision(
	space: PhysicsDirectSpaceState2D, point: Vector2, collider_root: Node
) -> bool:
	var params := PhysicsPointQueryParameters2D.new()
	params.position = point
	params.collision_mask = 1
	params.collide_with_areas = false
	params.collide_with_bodies = true
	var found := space.intersect_point(params, 8)
	for hit: Dictionary in found:
		var collider: Object = hit.get("collider")
		if collider is Node and collider_root.is_ancestor_of(collider as Node):
			return true
	return false


# -------------------------------------------------------------- report -------

func _file_sha256(path: String) -> String:
	if FileAccess.file_exists(path):
		return FileAccess.get_sha256(path)
	return ""


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_push(message)


func _push(message: String) -> void:
	_failures.append(message)


func _finish() -> void:
	var run := "after" if _with_overlay else "before"
	if _failures.is_empty():
		print("GATE2 CAPTURE TEST PASSED: %d frames (%s)" % [_shots, run])
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("GATE2 FAILURE: " + failure)
	printerr("GATE2 CAPTURE TEST FAILED (%s)" % run)
	get_tree().quit(1)
