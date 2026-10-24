extends Node

## Gate 3 evidence harness.
##
## Starts Chapter 1 Level 3 through the real AppRoot/AppFlow campaign route and
## captures native frames of the production Main scene with the real HUD and the
## real Knight. Nothing is composited, cropped or upscaled here.
##
##   godot --path . --rendering-method gl_compatibility --audio-driver Dummy \
##         --resolution 1280x720 res://prototypes/gate3/capture_gate3.tscn
##   ... same, with `-- --overlay` for the AFTER run.
##
## The harness never teleports the Knight between stations: it plans a route over
## the level's own walkable cells (minus the props' solid footprints and minus
## Candidate A's spike hazards) and walks it with the production input actions.
## Floors 2 and 3 are reached the way the game reaches them — by walking onto the
## authored floor door and using it — never by moving the Knight.
##
## Camera evaluation (Phase D): for the `landmark` station the harness captures the
## same moment through two framings — the campaign's own zoom 1 and an archive
## framing at zoom 2 — at 1280x720 and at 1024x576. Both are native frames from the
## same run. The camera change is applied to the live Camera2D at runtime and is
## prototype-local: no project setting and no production scene is modified.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const OVERLAY_SCENE: PackedScene = preload("res://prototypes/gate3/gate3_redesign.tscn")
const LEVEL_PATH := "res://data/levels/chapter_1_level_3.json"
const PLACEMENT_PATH := "res://prototypes/gate3/visual_placement.json"
const GATE3_LEVEL_PATH := "res://prototypes/gate3/level_data/chapter_1_level_3_gate3.json"
const OUT_DIR := "res://.artifacts/gate3"

## Candidate A's pinned Level 3 document.
const LEVEL_SHA256 := "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
const EXPECTED_BASE_CELLS := {"Backdrop": 3351, "Geometry": 1702, "Decor": 73}
const EXPECTED_GATE3_CELLS := {"Backdrop": 3413, "Geometry": 1686, "Decor": 73}
const EXPECTED_ENTITIES := 79
const EXPECTED_TILESET_SOURCES := 2
const EXPECTED_SIZE := Vector2i(1280, 720)
const SMALL_SIZE := Vector2i(1024, 576)
const TILE := 16
## A spike footprint is walkable, but the router treats it as this much worse than
## open floor, so the Knight only crosses one where the level leaves no choice.
const HAZARD_COST := 25

## Stations, in cells.  `spawn` is Candidate A's authored spawn point; the rest are
## chosen so the thing each station is about lands in the clear band of the frame.
##   descent_landing  the repaired sealed shaft (Gate 2 defect C1)
##   south_loop       the opened south ambulatory, past the spike bay (C5)
const STATIONS := {
	"spawn": Vector2i(17, 13),
	"archive_entry": Vector2i(23, 12),
	"landmark": Vector2i(30, 12),
	"descent_landing": Vector2i(30, 17),
	"cloister": Vector2i(38, 18),
	"south_loop": Vector2i(46, 23),
	"combat_space": Vector2i(58, 21),
	"return_route": Vector2i(44, 21),
	"floor2_arrival": Vector2i(106, 42),
	"floor2_stacks": Vector2i(48, 52),
	"floor3_camp": Vector2i(45, 89),
}
const FLOOR1_ORDER: Array[String] = [
	"spawn", "archive_entry", "landmark", "descent_landing", "cloister",
	"south_loop", "combat_space", "return_route",
]
const FLOOR2_ORDER: Array[String] = ["floor2_arrival", "floor2_stacks"]
const FLOOR3_ORDER: Array[String] = ["floor3_camp"]

## The two authored descents, as (walk-to cell, door cell, expected landing cell).
const DESCENT_1 := {"walk": Vector2i(109, 17), "door": Vector2i(109, 16), "landing": Vector2i(106, 42)}
const DESCENT_2 := {"walk": Vector2i(9, 51), "door": Vector2i(9, 51), "landing": Vector2i(9, 80)}

var _with_overlay := false
var _app_root: Node
var _game: Node2D
var _dungeon: DungeonLevel
var _player: CharacterBody2D
var _overlay: Node
var _failures: Array[String] = []
var _shots := 0
var _blocked_cells := {}
var _start_health := 0
var _walked_cells := 0
var _walked_pixels := 0.0
var _camera_frames := 0
var _engaged_fights := 0
var _hazard_cache: Dictionary = {}
var _enemy_heat: Dictionary = {}
## Frames left before the harness is willing to start another fight after it broke
## one off to survive. Without this it re-engages the same enemy every frame.
var _disengage_frames := 0


func _ready() -> void:
	var arguments := OS.get_cmdline_user_args()
	for argument: String in arguments:
		if argument == "--overlay":
			_with_overlay = true
	if "--check" in arguments:
		_check_scripts()
		return
	_run.call_deferred()


func _check_scripts() -> void:
	## A cheap smoke test that the whole Gate 3 scene graph compiles inside the real
	## project: a script that fails to load leaves the capture scene empty, and under
	## Xvfb that only shows up as a fifteen-minute timeout. This takes seconds.
	var ok := true
	var overlay_script := load("res://prototypes/gate3/gate3_redesign.gd") as Script
	if overlay_script == null or not overlay_script.can_instantiate():
		printerr("GATE3 SCRIPT CHECK FAILED: gate3_redesign.gd does not compile")
		ok = false
	var overlay: Node = OVERLAY_SCENE.instantiate()
	if overlay == null or not overlay.has_method("attach_to_level"):
		printerr("GATE3 SCRIPT CHECK FAILED: the overlay scene has no attach_to_level")
		ok = false
	elif overlay != null:
		overlay.free()
	if ok:
		print("GATE3 SCRIPT CHECK OK: capture and overlay compile in the live project")
	get_tree().quit(0 if ok else 1)


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	if not await _boot():
		_finish()
		return
	if _with_overlay and not await _attach_overlay():
		_finish()
		return
	_check_contracts()
	_hazard_cache = _hazard_cells()
	_enemy_heat = _build_enemy_heat()
	_start_health = int(_player.get("health"))
	await _capture_floor_one()
	await _descend(DESCENT_1, FLOOR2_ORDER)
	await _descend(DESCENT_2, FLOOR3_ORDER)
	await _probe_collision()
	_report_walk()
	_finish()


# ---------------------------------------------------------------- boot -------

func _boot() -> bool:
	var digest := _file_sha256(LEVEL_PATH)
	var expected := _file_sha256(GATE3_LEVEL_PATH) if _with_overlay else LEVEL_SHA256
	if expected.is_empty():
		_push("the pinned level document is missing from the checkout")
		return false
	if digest != expected:
		_push("Level 3 source pin mismatch; expected %s, observed %s" % [expected, digest])
		return false
	print("GATE3 LEVEL: %s sha256=%s" % [LEVEL_PATH, digest])

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
	print("GATE3 CAMPAIGN ROUTE: %s, real HUD and active Level 3"
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
		save_path = "user://gate3_%d.json" % Time.get_ticks_usec()
	if not bool(SaveService.call(&"configure_storage", save_path, true)):
		_push("failed to isolate campaign save")
		return false
	var ready_levels := CAMPAIGN_REGISTRY.get_ordered_campaign_levels(false)
	var ids: Array[String] = []
	for definition: LevelDefinition in ready_levels:
		ids.append(String(definition.level_id))
	var seeded := bool(SaveService.call(&"transact_once",
		"gate3:isolated_campaign_entry",
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
		{"kind": "isolated_gate3_native_capture"}))
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
	print("GATE3 OVERLAY ATTACHED: %d props, %d solid bodies, %d material layers, %d lights, shade=%s"
		% [int(_overlay.get("props_added")), int(_overlay.get("colliders_added")),
			int(_overlay.get("material_layers_added")), int(_overlay.get("lights_added")),
			str(bool(_overlay.get("shade_built")))])
	if int(_overlay.get("colliders_added")) <= 0:
		_push("the overlay added no collision bodies, which cannot be right")
	_expect(bool(_overlay.get("shade_built")),
		"the shade field was built (C6: one node instead of five band layers)")
	_blocked_cells = _overlay_blocked_cells()
	return _failures.is_empty()


# ---------------------------------------------------------- contracts --------

func _check_contracts() -> void:
	var document: Dictionary = _dungeon.level_data
	var expected: Dictionary = EXPECTED_GATE3_CELLS if _with_overlay else EXPECTED_BASE_CELLS
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
	var solids := 0
	for entry: Dictionary in placement.get("props", []):
		if bool(entry.get("solid", false)):
			solids += 1
	_expect(int(_overlay.get("colliders_added")) == solids,
		"one collider per solid prop (%d)" % solids)
	_expect(int(_overlay.get("lights_added")) == (placement.get("lights", []) as Array).size(),
		"every authored light was built")

	var material: Dictionary = placement.get("material", {})
	var roles := 0
	for role: String in (material.keys() as Array).duplicate():
		var layer := _dungeon.get_node_or_null("Gate3_" + role) as TileMapLayer
		if not (material[role] as Array).is_empty() and layer == null:
			_push("the material layer Gate3_%s is missing from the live level" % role)
			continue
		if layer != null:
			roles += 1
			_expect(layer.get_used_cells().size() == (material[role] as Array).size(),
				"Gate3_%s holds %d cells, the document authors %d"
				% [role, layer.get_used_cells().size(), (material[role] as Array).size()])
	_expect(roles >= 10, "the material is composited on %d layers" % roles)

	# Nothing opaque may cover an authored floor cell: the walk must never be hidden.
	var walkable := _authored_floor_cells()
	# `shadow` is deliberately excluded: it is a translucent contact darkening
	# (alpha 0.62) painted over floor next to walls, not an opaque cover.
	for role: String in ["rock", "mass", "wall_face", "niche"]:
		var layer := _dungeon.get_node_or_null("Gate3_" + role) as TileMapLayer
		if layer == null:
			continue
		var covered := 0
		for cell: Vector2i in layer.get_used_cells():
			if walkable.has(cell):
				covered += 1
		_expect(covered == 0, "Gate3_%s covers %d walkable floor cells" % [role, covered])

	# C2: Candidate A's cool-toned Decor layer must be off, and the archive's own
	# fittings must be on.
	var decor := _dungeon.get_node_or_null("Decor") as CanvasItem
	_expect(decor != null, "Candidate A's Decor layer is still in the level")
	if decor != null:
		_expect(not decor.visible, "Candidate A's Decor layer is hidden (C2)")
	_expect((_overlay.get("hidden_layers") as Array).size() >= 1,
		"the overlay reports the layer it replaced")


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
	## Candidate A's floor spikes. Like the production game these are Area2Ds that
	## damage a body standing in them; they do not block the walk. The router gives
	## them a high cost, so the Knight avoids them whenever the level offers a safe
	## way round and only crosses one where the level itself demands it. Whatever HP
	## that costs is reported, not hidden.
	var cells := {}
	for entity: Dictionary in _dungeon.level_data.get("entities", []):
		if String(entity.get("type", "")) != "spikes":
			continue
		var centre := Vector2i(floori(float(entity["position"][0]) / TILE),
			floori(float(entity["position"][1]) / TILE))
		for dx: int in [-1, 0, 1]:
			for dy: int in [-1, 0, 1]:
				cells[centre + Vector2i(dx, dy)] = true
	return cells


func _build_enemy_heat() -> Dictionary:
	## Cells close to an authored enemy are less attractive. This is a routing cost,
	## not a claim about where the enemies will be: they chase, and the harness still
	## fights whatever ends up in front of it.
	var heat := {}
	for entity: Dictionary in _dungeon.level_data.get("entities", []):
		var kind := String(entity.get("type", ""))
		if kind == "player" or kind == "floor_door" or kind == "torch":
			continue
		var centre := Vector2i(floori(float(entity["position"][0]) / TILE),
			floori(float(entity["position"][1]) / TILE))
		for dx: int in range(-4, 5):
			for dy: int in range(-4, 5):
				var cell: Vector2i = centre + Vector2i(dx, dy)
				var ring := maxi(absi(dx), absi(dy))
				var weight := 6 if ring <= 2 else (3 if ring <= 3 else 1)
				heat[cell] = int(heat.get(cell, 0)) + weight
	return heat


func _overlay_blocked_cells() -> Dictionary:
	var cells := {}
	for entry: Dictionary in _load_json(PLACEMENT_PATH).get("props", []):
		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		# The authored contract is a pixel bounding box: [left, top, right, bottom].
		var left := float(box[0])
		var top := float(box[1])
		var right := float(box[2])
		var bottom := float(box[3])
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
	# centre puts his body across that cell and the one above it.
	var body_safe := {}
	for cell: Vector2i in walkable:
		if walkable.has(cell + Vector2i.UP):
			body_safe[cell] = true
	return body_safe


func _plan_route(from_cell: Vector2i, to_cell: Vector2i) -> Array[Vector2i]:
	## Dijkstra over the body-safe cells. Ordinary floor costs 1, a spike footprint
	## costs HAZARD_COST, so a safe detour always wins when one exists and the
	## harness never walks over a hazard on a whim. Returns [] when there is no route
	## at all, and a one-cell route when the Knight already stands on the target
	## (which is what happens immediately after a floor door).
	var walkable := _walkable_cells()
	if not walkable.has(from_cell) or not walkable.has(to_cell):
		return []
	if from_cell == to_cell:
		return [from_cell]
	var hazards := _hazard_cache if not _hazard_cache.is_empty() else _hazard_cells()
	var best := {from_cell: 0}
	var previous := {}
	var frontier: Array[Vector2i] = [from_cell]
	var frontier_cost: Array[int] = [0]
	while not frontier.is_empty():
		var pick := 0
		for index: int in range(1, frontier.size()):
			if frontier_cost[index] < frontier_cost[pick]:
				pick = index
		var current: Vector2i = frontier[pick]
		var cost := frontier_cost[pick]
		frontier.remove_at(pick)
		frontier_cost.remove_at(pick)
		if current == to_cell:
			break
		if cost > int(best.get(current, 1 << 30)):
			continue
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]:
			var neighbour: Vector2i = current + step
			if not walkable.has(neighbour):
				continue
			# Hazards are expensive and so is walking into a crowd: the harness takes
			# the quiet way round, the way a player who wants to reach floor 2 alive
			# would, and only fights what the route cannot avoid.
			var step_cost := HAZARD_COST if hazards.has(neighbour) else 1
			step_cost += int(_enemy_heat.get(neighbour, 0))
			var tentative := cost + step_cost
			if tentative >= int(best.get(neighbour, 1 << 30)):
				continue
			best[neighbour] = tentative
			previous[neighbour] = current
			frontier.append(neighbour)
			frontier_cost.append(tentative)
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


func _nearest_enemy(within: float, heading: Vector2) -> Node2D:
	## Nearest live enemy inside `within` pixels that lies ahead of the walk, so the
	## harness fights what is in its way and does not chase side rooms.
	var best: Node2D = null
	var best_distance := within
	for node: Node in get_tree().get_nodes_in_group(&"enemies"):
		var enemy := node as Node2D
		if enemy == null or not enemy.is_inside_tree() or not enemy.is_visible_in_tree():
			continue
		var offset := enemy.global_position - _player.global_position
		var distance := offset.length()
		if distance >= best_distance:
			continue
		if heading.length_squared() > 0.01 and offset.normalized().dot(heading.normalized()) < -0.2:
			continue
		best_distance = distance
		best = enemy
	return best


func _nearest_enemy_distance() -> float:
	var nearest := 1.0e9
	for node: Node in get_tree().get_nodes_in_group(&"enemies"):
		var enemy := node as Node2D
		if enemy == null or not enemy.is_inside_tree():
			continue
		nearest = minf(nearest, enemy.global_position.distance_to(_player.global_position))
	return nearest


func _engage_enemy(target: Node2D, label: String) -> int:
	## Fight the way the game is played: hold the production `attack` action, which is
	## the sword hero's combo, and steer into the target. `light_attack` is only an
	## alias of `attack` for the HUD, and pressing it starts a stub action that swings
	## a 17 px hitbox without auto-aim — an earlier revision of this harness did
	## exactly that and logged two hundred frames of combat at 13 px range in which the
	## skeleton never lost a single hit point. Returns frames spent.
	var spent := 0
	var start_health := int(_player.get("health"))
	var target_health := int(target.get("health")) if target.get("health") != null else -1
	print("GATE3 COMBAT: engaging %s at %.0f px, target HP %d, Knight HP %d"
		% [String(target.name), target.global_position.distance_to(_player.global_position),
			target_health, start_health])
	Input.action_press("attack", 1.0)
	while spent < 260:
		if int(_player.get("health")) <= 0:
			Input.action_release("attack")
			_push("the Knight died fighting near '%s'" % label)
			return spent
		if not is_instance_valid(target) or not target.is_inside_tree():
			break
		var offset := target.global_position - _player.global_position
		var actions: Array[String] = []
		if offset.length() > 20.0:
			if absf(offset.x) > 2.0:
				actions.append("move_right" if offset.x > 0.0 else "move_left")
			if absf(offset.y) > 2.0:
				actions.append("move_down" if offset.y > 0.0 else "move_up")
		for action: String in actions:
			Input.action_press(action, 1.0)
		await get_tree().physics_frame
		for action: String in actions:
			Input.action_release(action)
		spent += 1
		if spent % 30 == 0:
			print("GATE3 COMBAT: '%s' %s at %.0f px, target HP %s, Knight HP %d"
				% [label, String(target.name), offset.length(),
					str(target.get("health")), int(_player.get("health"))])
		if int(_player.get("health")) < 300:
			print("GATE3 COMBAT: the Knight disengaged near '%s' at HP %d"
				% [label, int(_player.get("health"))])
			_disengage_frames = 420
			break
	Input.action_release("attack")
	_engaged_fights += 1
	print("GATE3 COMBAT: fight near '%s' ended after %d frames, Knight HP %d -> %d"
		% [label, spent, start_health, int(_player.get("health"))])
	return spent


func _enemy_count() -> int:
	var count := 0
	for node: Node in get_tree().get_nodes_in_group(&"enemies"):
		if node.is_inside_tree():
			count += 1
	return count


func _walk_to_cell(label: String, target_cell: Vector2i) -> bool:
	## Walk the planned route with the production input actions, and deal with what
	## the level puts in the way the way a player would: kill what holds the corridor,
	## re-plan when the route goes stale, and roll through when nothing can be killed.
	## Progress is measured towards the waypoint, not raw movement, because being
	## pushed back and forth by an enemy body looks like movement and is not progress.
	var failures_before := _failures.size()
	var route := _plan_route(_current_cell(), target_cell)
	print("GATE3 PLAN: %s -> %s is %d cells" % [label, str(target_cell), route.size()])
	if route.is_empty():
		_push("no walkable route to '%s' at %s" % [label, str(target_cell)])
		return false
	var started := _player.global_position
	var index := 1
	var frames := 0
	var budget := route.size() * 200 + 900
	var visited := {_current_cell(): true}
	var frames_since_new_cell := 0
	var replans := 0
	var rolls := 0
	while index < route.size() and frames < budget:
		if int(_player.get("health")) <= 0:
			_push("the Knight died on the way to '%s' at %s"
				% [label, str(_player.global_position)])
			return false
		var waypoint := _cell_centre(route[index])
		var delta := waypoint - _player.global_position
		if delta.length() <= 5.0:
			index += 1
			continue
		# Progress is "reached a cell this leg has not been in yet". Being shoved back
		# and forth by an enemy body, or rocking on a spike, reaches no new cell and is
		# not progress however much the position wobbles.
		var cell := _current_cell()
		if not visited.has(cell):
			visited[cell] = true
			frames_since_new_cell = 0
		else:
			frames_since_new_cell += 1
		if _disengage_frames > 0:
			_disengage_frames -= 1
		if frames_since_new_cell > 60 and _disengage_frames <= 0:
			var blocker := _nearest_enemy(64.0, delta)
			var hurt := int(_player.get("health")) < 260
			if blocker != null and not hurt and not _hazard_cache.has(cell) and rolls < 2:
				var spent := await _engage_enemy(blocker, label)
				frames += spent
				frames_since_new_cell = 0
				continue
			if replans < 3:
				var fresh := _plan_route(cell, target_cell)
				if fresh.size() > 1:
					route = fresh
					index = 1
					replans += 1
					frames_since_new_cell = 0
					continue
			# Nothing left to kill and no better route: roll through the gap. The roll
			# is the Knight's own i-frame move, so this is still playing the game.
			var toward := _key_directions(delta)
			for action: String in toward:
				Input.action_press(action, 1.0)
			Input.action_press("roll", 1.0)
			await get_tree().physics_frame
			Input.action_release("roll")
			for action: String in toward:
				Input.action_release(action)
			frames += 1
			rolls += 1
			frames_since_new_cell = 0
			continue
		var actions := _key_directions(delta)
		for action: String in actions:
			Input.action_press(action, 1.0)
		await get_tree().physics_frame
		for action: String in actions:
			Input.action_release(action)
		frames += 1
		if frames % 60 == 0:
			print("GATE3 TRACE: %s frame %d cell %s HP %d stuck %d waypoint %s"
				% [label, frames, str(_current_cell()), int(_player.get("health")),
					frames_since_new_cell, str(route[mini(index, route.size() - 1)])])
	if index < route.size():
		_push("the Knight ran out of frames walking to '%s' (%d/%d waypoints)"
			% [label, index, route.size()])
		return false
	await _settle()
	var travelled := started.distance_to(_player.global_position)
	_walked_cells += route.size() - 1
	_walked_pixels += travelled
	print("GATE3 WALK: %s  (%.0f, %.0f) -> (%.0f, %.0f)  %.0f px over %d cells in %d frames, HP %d"
		% [label, started.x, started.y, _player.global_position.x,
			_player.global_position.y, travelled, route.size() - 1, frames,
			int(_player.get("health"))])
	# A one-waypoint route means the Knight is already standing on the station, which
	# only happens on the landing cell a floor door just moved him to; that transition
	# is itself proved separately by `_use_floor_door`.
	_expect(travelled > 16.0 or route.size() <= 1 or label == "spawn",
		"'%s' was reached on foot, not by teleporting" % label)
	return _failures.size() == failures_before


func _key_directions(delta: Vector2) -> Array[String]:
	var actions: Array[String] = []
	if absf(delta.x) > 2.0:
		actions.append("move_right" if delta.x > 0.0 else "move_left")
	if absf(delta.y) > 2.0:
		actions.append("move_down" if delta.y > 0.0 else "move_up")
	return actions


func _walk_to_station(name: String) -> bool:
	return await _walk_to_cell(name, STATIONS[name])


# ---------------------------------------------------------- evidence ---------

func _capture_floor_one() -> void:
	# `descent_landing` is the repaired shaft: it does not exist as a room in
	# Candidate A, which is precisely what Gate 2 defect C1 is about, so the BEFORE
	# run has no walk there and records that instead of inventing a viewpoint.
	var order: Array[String] = []
	for name: String in FLOOR1_ORDER:
		if not _with_overlay and name == "descent_landing":
			continue
		order.append(name)
	for name: String in order:
		if name != "spawn":
			if not await _walk_to_station(name):
				return
		await _shot(name)
		if name == "landmark":
			await _capture_camera_comparison(name)


func _descend(descent: Dictionary, order: Array[String]) -> bool:
	if not await _walk_to_cell("descent approach", descent["walk"]):
		return false
	if not await _use_floor_door(descent["door"]):
		return false
	var landed := _current_cell()
	_expect(landed == descent["landing"],
		"the floor door landed the Knight at %s (expected %s)"
		% [str(landed), str(descent["landing"])])
	for name: String in order:
		if not await _walk_to_station(name):
			return false
		await _shot(name)
	return true


func _use_floor_door(door_cell: Vector2i) -> bool:
	## The game's own transition: the Knight walks into the door's area, and the door
	## teleports him to its authored target. Nothing here moves the Knight by hand.
	var door := _find_door(door_cell)
	if door == null:
		_push("no FloorDoor node within a cell of %s" % str(door_cell))
		return false
	for _frame: int in 12:
		await get_tree().physics_frame
	var before := _player.global_position
	if bool(door.call("can_interact", _player)):
		door.call("interact", _player)
	else:
		_push("the floor door at %s did not register the Knight in its area" % str(door_cell))
		return false
	for _frame: int in 8:
		await get_tree().physics_frame
	var moved := before.distance_to(_player.global_position)
	print("GATE3 FLOOR DOOR: %s moved the Knight %.0f px to %s"
		% [String(door.get("door_label")), moved, str(_player.global_position)])
	_expect(moved > 64.0, "the floor door actually changed floors")
	await _settle()
	return true


func _find_door(cell: Vector2i) -> Node:
	var target := _cell_centre(cell)
	var best: Node = null
	var best_distance := 40.0
	for node: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if not node is Node2D:
			continue
		var distance := (node as Node2D).global_position.distance_to(target)
		if distance < best_distance:
			best_distance = distance
			best = node
	return best


func _capture_camera_comparison(station: String) -> void:
	## Phase D: the same moment through two framings, at two resolutions.
	var camera := _player.get_node_or_null("Camera") as Camera2D
	if camera == null:
		_push("the Knight has no Camera to evaluate")
		return
	for profile: Dictionary in [
		{"name": "baseline", "zoom": 1.0},
		{"name": "archive", "zoom": 2.0},
	]:
		camera.zoom = Vector2(float(profile["zoom"]), float(profile["zoom"]))
		camera.reset_smoothing()
		camera.force_update_scroll()
		await _settle(6)
		await _camera_shot("cam_%s_1280_%s" % [String(profile["name"]), station], EXPECTED_SIZE)
	if not await _set_resolution(SMALL_SIZE):
		return
	for profile: Dictionary in [
		{"name": "baseline", "zoom": 1.0},
		{"name": "archive", "zoom": 2.0},
	]:
		camera.zoom = Vector2(float(profile["zoom"]), float(profile["zoom"]))
		camera.reset_smoothing()
		camera.force_update_scroll()
		await _settle(6)
		await _camera_shot("cam_%s_1024_%s" % [String(profile["name"]), station], SMALL_SIZE)
	await _set_resolution(EXPECTED_SIZE)
	camera.zoom = Vector2.ONE
	camera.reset_smoothing()
	camera.force_update_scroll()
	await _settle(6)


func _set_resolution(size: Vector2i) -> bool:
	var window := get_window()
	window.size = size
	for _frame: int in 8:
		await get_tree().process_frame
		await get_tree().physics_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var actual := Vector2i(image.get_width(), image.get_height())
	if actual != size:
		_push("the viewport rendered %s when asked for %s" % [str(actual), str(size)])
		return false
	print("GATE3 RESOLUTION: rendering at %s" % str(actual))
	return true


func _camera_shot(name: String, size: Vector2i) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	if image == null:
		_push("the viewport returned no image for '%s'" % name)
		return
	if Vector2i(image.get_width(), image.get_height()) != size:
		_push("%s is %dx%d, expected %s"
			% [name, image.get_width(), image.get_height(), str(size)])
		return
	var camera := _player.get_node_or_null("Camera") as Camera2D
	var knight_on_screen := true
	if camera != null:
		var rect := get_viewport().get_visible_rect()
		# Go through the viewport's canvas transform instead of any one Camera2D
		# accessor, so the check is independent of which camera is following.
		var screen_position: Vector2 = get_viewport().get_canvas_transform() * _player.global_position
		var safe_rect := Rect2(Vector2(32.0, 64.0),
			rect.size - Vector2(64.0, 64.0))
		knight_on_screen = safe_rect.has_point(screen_position)
	_expect(knight_on_screen, "%s keeps the Knight inside the frame" % name)
	var path := "%s/after_%s.png" % [OUT_DIR, name]
	if image.save_png(ProjectSettings.globalize_path(path)) != OK:
		_push("could not write %s" % path)
		return
	_camera_frames += 1
	print("GATE3 CAMERA: %s (%dx%d) zoom=%s" % [path, image.get_width(), image.get_height(),
		str(camera.zoom) if camera != null else "n/a"])


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
	print("GATE3 CAPTURE: %s (%dx%d) at %s"
		% [path, image.get_width(), image.get_height(), str(_player.global_position)])


# ------------------------------------------------------------ collision ------

func _probe_collision() -> void:
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
		print("GATE3 COLLISION: Knight at %s is clear of every wall and prop"
			% str(_player.global_position))

	if not _with_overlay or _overlay == null:
		return
	var collider_root := _overlay.get_node_or_null("Gate3Collision")
	if collider_root == null or collider_root.get_child_count() == 0:
		_push("the overlay has no collision bodies to probe")
		return
	var checked := 0
	for entry: Dictionary in _load_json(PLACEMENT_PATH).get("props", []):
		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		# [left, top, right, bottom] in level pixels; probe the centre.
		var point := Vector2((float(box[0]) + float(box[2])) * 0.5,
			(float(box[1]) + float(box[3])) * 0.5)
		if not _point_hits_gate3_collision(space, point, collider_root):
			_push("no Gate3Collision body under the solid prop '%s' at %s"
				% [String(entry.get("id")), str(point)])
		checked += 1
	print("GATE3 COLLISION: %d solid prop footprints probed, each covered by a body" % checked)

	var clear_point := _player.global_position + Vector2(0, -4)
	if _point_hits_gate3_collision(space, clear_point, collider_root):
		_push("a prop body covers open floor at %s" % str(clear_point))
	else:
		print("GATE3 COLLISION: open floor at %s is free of prop bodies" % str(clear_point))


func _point_hits_gate3_collision(
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

func _report_walk() -> void:
	var end_health := int(_player.get("health"))
	print("GATE3 ROUTE: %d cells walked, %.0f px travelled, %d fights, HP %d -> %d (delta %d)"
		% [_walked_cells, _walked_pixels, _engaged_fights, _start_health, end_health,
			_start_health - end_health])
	print("GATE3 CAMERA FRAMES: %d" % _camera_frames)
	var counted := 0
	for _index: int in range(1):
		counted = int(Performance.get_monitor(Performance.OBJECT_COUNT))
	print("GATE3 OBJECTS: ObjectDB holds %d objects at the end of the run" % counted)
	var nodes := get_tree().get_node_count()
	print("GATE3 OBJECTS: the live scene tree holds %d nodes" % nodes)


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
		print("GATE3 CAPTURE TEST PASSED: %d frames, %d camera frames (%s)"
			% [_shots, _camera_frames, run])
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("GATE3 FAILURE: " + failure)
	printerr("GATE3 CAPTURE TEST FAILED (%s)" % run)
	get_tree().quit(1)
