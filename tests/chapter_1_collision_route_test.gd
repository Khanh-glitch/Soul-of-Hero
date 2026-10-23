extends Node

## Loads each Chapter 1 map through Main/DungeonLevel and runs a player-sized
## shape query against the live TileMap collision layer. The route graph uses
## only collision-clear floor cells, blocks authored spike cells, and models
## floor-door transitions as the game's reciprocal teleport links.

const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const TILE_SIZE := 16.0
const BODY_CLEARANCE := Vector2(12.0, 14.0)
const MAPS := [
	{"slot": 1, "path": "res://data/levels/crypt_entrance.json"},
	{"slot": 2, "path": "res://data/levels/chapter_1_level_2.json"},
	{"slot": 3, "path": "res://data/levels/chapter_1_level_3.json"},
	{"slot": 4, "path": "res://data/levels/chapter_1_level_4.json"},
	{"slot": 5, "path": "res://data/levels/chapter_1_level_5.json"},
	{"slot": 6, "path": "res://data/levels/chapter_1_level_6.json"},
	{"slot": 7, "path": "res://data/levels/chapter_1_level_7.json"},
	{"slot": 8, "path": "res://data/levels/chapter_1_level_8.json"},
	{"slot": 9, "path": "res://data/levels/chapter_1_level_9.json"},
	{"slot": 10, "path": "res://data/levels/chapter_1_level_10.json"},
]
const OBJECTIVE_TYPES := [
	"sigil",
	"exit_gate",
	"checkpoint",
	"gate_seal",
	"reliquary_branch_seal",
	"soul_beacon",
	"chest",
	"bow_reward",
]
const COMBAT_TYPES := [
	"skeleton",
	"skeleton_reaper",
	"crimson_reaper",
	"bone_reaper_captain",
	"hooded_archer_miniboss",
	"vampire",
	"vampire_castellan",
	"coven_wraith",
	"venom_bound_wraith",
	"spirit_leech",
	"hexwing_familiar",
	"axe_soul_boss",
	"wizard_hero_boss",
]
const DIRECTIONS := [
	Vector2i.LEFT,
	Vector2i.RIGHT,
	Vector2i.UP,
	Vector2i.DOWN,
	Vector2i(-1, -1),
	Vector2i(1, -1),
	Vector2i(-1, 1),
	Vector2i(1, 1),
]

var _checks := 0
var _failures: Array[String] = []
var _reports: Array[Dictionary] = []
var _runtime_host: Node


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_runtime_host = self
	for map_spec: Dictionary in MAPS:
		await _test_map(map_spec)
	await _test_level_8_branch_routes()
	_finish()


func _test_map(map_spec: Dictionary) -> void:
	var slot := int(map_spec.slot)
	var map_id := "Chapter 1 Level %02d" % slot
	var file := FileAccess.open(String(map_spec.path), FileAccess.READ)
	_expect(file != null, "%s source JSON opens" % map_id)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "%s source JSON is a map object" % map_id)
	if not parsed is Dictionary:
		return
	var document := parsed as Dictionary
	var entities: Array = document.get("entities", [])
	var floor_cells := _cells_by_position(document.get("layers", {}).get("Backdrop", []))
	var spike_cells := _entity_cells_by_type(entities, "spikes")
	var player_cell := _entity_cell(_first_entity(entities, "player"))

	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "%s production Main scene instantiates" % map_id)
	if game == null:
		return
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	_expect(dungeon != null, "%s has the production DungeonLevel" % map_id)
	if dungeon == null:
		game.free()
		return
	dungeon.level_data_path = String(map_spec.path)
	dungeon.watch_file_changes = false
	_runtime_host.add_child(game)
	for _frame: int in 5:
		await get_tree().process_frame
		await get_tree().physics_frame
	var live_player := game.get_node_or_null("Level/Entities/Knight") as CharacterBody2D
	_expect(
		live_player != null, "%s production Main reaches ready and places the live Knight" % map_id
	)

	var backdrop_count := dungeon.backdrop.get_used_cells().size()
	_expect(
		backdrop_count == floor_cells.size(), "%s runtime loads every authored floor cell" % map_id
	)
	var geometry_count := dungeon.geometry.get_used_cells().size()
	_expect(
		geometry_count == _cells_by_position(document.get("layers", {}).get("Geometry", [])).size(),
		"%s runtime loads every collision cell" % map_id
	)

	var body_shape := RectangleShape2D.new()
	body_shape.size = BODY_CLEARANCE
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape
	query.collision_mask = 1  # Dungeon Geometry / World only; ignore actors and pickups.
	query.collide_with_areas = false
	var collision_clear_floor := {}
	for cell: Vector2i in floor_cells:
		var world_center := dungeon.backdrop.to_global(dungeon.backdrop.map_to_local(cell))
		# Knight's BodyShape is centered eight pixels above its foot/root position.
		query.transform = Transform2D(0.0, world_center + Vector2(0.0, -8.0))
		if not _has_current_level_collision(dungeon, query):
			collision_clear_floor[cell] = true
	var spawn_clear := collision_clear_floor.has(player_cell)
	_expect(
		spawn_clear,
		(
			"%s spawn fits the live Knight-sized collision footprint; blockers=%s"
			% [map_id, ", ".join(_collision_names_at_cell(dungeon, body_shape, player_cell))]
		),
	)
	if not collision_clear_floor.has(player_cell):
		game.free()
		await get_tree().process_frame
		await get_tree().physics_frame
		return

	var door_targets := _door_transitions(entities)
	var invalid_door_transitions: Array[String] = []
	for source: Vector2i in door_targets:
		for destination_value: Variant in door_targets[source]:
			var destination: Vector2i = destination_value
			if not collision_clear_floor.has(source) or not collision_clear_floor.has(destination):
				(
					invalid_door_transitions
					. append(
						(
							"%s->%s source_blockers=[%s] target_blockers=[%s]"
							% [
								source,
								destination,
								", ".join(_collision_names_at_cell(dungeon, body_shape, source)),
								", ".join(
									_collision_names_at_cell(dungeon, body_shape, destination)
								),
							]
						)
					)
				)
	_expect(
		invalid_door_transitions.is_empty(),
		(
			"%s all real floor-door source/arrival cells fit the Knight collision footprint: %s"
			% [map_id, ", ".join(invalid_door_transitions)]
		),
	)
	var reached := _reachable(collision_clear_floor, player_cell, spike_cells, door_targets)
	var safe_floor_count := 0
	for cell: Vector2i in collision_clear_floor:
		if not spike_cells.has(cell):
			safe_floor_count += 1
	if slot != 8:
		_expect(
			reached.size() == safe_floor_count,
			(
				"%s every collision-clear non-hazard floor cell belongs to the playable route graph (%d/%d)"
				% [map_id, reached.size(), safe_floor_count]
			),
		)
	else:
		_expect(
			reached.size() < safe_floor_count,
			"Level 8 begins with its two optional branches physically gated until one is chosen",
		)

	var target_types: Array = OBJECTIVE_TYPES + ["floor_door"] + COMBAT_TYPES
	if slot == 8:
		target_types = ["reliquary_branch_seal"]
	var unreachable_targets: Array[String] = []
	for entity_type: String in target_types:
		for target: Vector2i in _entity_cells_by_type(entities, entity_type):
			if not _reachable_near(target, reached, collision_clear_floor):
				unreachable_targets.append("%s@%s" % [entity_type, target])
	_expect(
		unreachable_targets.is_empty(),
		(
			"%s all objectives and combat markers are reachable with Knight clearance: %s"
			% [map_id, ", ".join(unreachable_targets)]
		),
	)
	if slot != 8:
		for raw_entity: Variant in entities:
			if not raw_entity is Dictionary or not raw_entity.has("target_position"):
				continue
			var target_position: Array = raw_entity.get("target_position", [])
			if target_position.size() < 2:
				continue
			var target_cell := Vector2i(
				floori(float(target_position[0]) / TILE_SIZE),
				floori(float(target_position[1]) / TILE_SIZE),
			)
			_expect(
				_reachable_near(target_cell, reached, collision_clear_floor),
				(
					"%s authored patrol target %s has a player-clear path"
					% [map_id, raw_entity.get("id", "entity")]
				),
			)

	var report := {
		"slot": slot,
		"path": String(map_spec.path),
		"backdrop_cells": floor_cells.size(),
		"collision_clear_cells": collision_clear_floor.size(),
		"safe_reachable_cells": reached.size(),
		"objectives_checked": _count_entities_of_types(entities, OBJECTIVE_TYPES),
		"floor_doors_checked": _count_entities_of_types(entities, ["floor_door"]),
		"unreachable_targets": unreachable_targets,
	}
	_reports.append(report)
	print(
		(
			"CHAPTER 1 COLLISION ROUTE: slot=%d safe=%d/%d targets=%d"
			% [
				slot,
				reached.size(),
				safe_floor_count,
				report.objectives_checked + report.floor_doors_checked,
			]
		)
	)
	game.free()
	await get_tree().process_frame
	await get_tree().physics_frame


func _test_level_8_branch_routes() -> void:
	for branch: StringName in [&"reaper", &"vampire"]:
		var game := GAME_SCENE.instantiate() as Node2D
		_expect(game != null, "Level 8 %s route instantiates production Main" % branch)
		if game == null:
			continue
		var dungeon := game.get_node_or_null("Level") as DungeonLevel
		if dungeon == null:
			_expect(false, "Level 8 %s route has the production DungeonLevel" % branch)
			game.free()
			continue
		dungeon.level_data_path = "res://data/levels/chapter_1_level_8.json"
		dungeon.watch_file_changes = false
		_runtime_host.add_child(game)
		for _frame: int in 5:
			await get_tree().process_frame
			await get_tree().physics_frame
		var entity_root := game.get_node_or_null("Level/Entities") as Node2D
		var player := (
			entity_root.get_node_or_null("Knight") as CharacterBody2D
			if entity_root != null
			else null
		)
		var controller := game.get_node_or_null("Level8ReliquaryRuntime")
		_expect(
			player != null,
			(
				"Level 8 %s branch has a live Knight in the production entity root; entity_root=%s children=%s"
				% [
					branch,
					String(entity_root.get_path()) if entity_root != null else "<null>",
					", ".join(_node_names(entity_root)) if entity_root != null else "<none>",
				]
			),
		)
		_expect(
			controller != null,
			(
				"Level 8 %s branch installs its configured production runtime; map=%s root_children=%s"
				% [branch, dungeon.level_data_path, ", ".join(_node_names(game))]
			),
		)
		var seal := (
			controller.call(&"get_branch_seal", branch) as ReliquaryBranchSeal
			if controller != null
			else null
		)
		_expect(seal != null, "Level 8 %s branch exposes its real physical seal" % branch)
		if player == null or seal == null:
			game.free()
			await get_tree().process_frame
			await get_tree().physics_frame
			continue
		seal.call(&"_on_body_entered", player)
		_expect(seal.interact(player), "Level 8 %s branch can be physically selected" % branch)
		for _frame: int in 3:
			await get_tree().physics_frame
		var snapshot: Dictionary = controller.call(&"get_snapshot")
		_expect(
			StringName(snapshot.get("selected_branch", "")) == branch,
			"Level 8 %s branch is the active collision route" % branch,
		)

		var document: Dictionary = dungeon.level_data
		var floor_cells := _cells_by_position(document.get("layers", {}).get("Backdrop", []))
		var spikes := _entity_cells_by_type(document.get("entities", []), "spikes")
		var shape := RectangleShape2D.new()
		shape.size = BODY_CLEARANCE
		var query := PhysicsShapeQueryParameters2D.new()
		query.shape = shape
		query.collision_mask = 1
		query.collide_with_areas = false
		var walkable := {}
		for cell: Vector2i in floor_cells:
			var world_center := dungeon.backdrop.to_global(dungeon.backdrop.map_to_local(cell))
			query.transform = Transform2D(0.0, world_center + Vector2(0.0, -8.0))
			if not _has_current_level_collision(dungeon, query):
				walkable[cell] = true
		var start := _entity_cell(_first_entity(document.get("entities", []), "player"))
		var reached := _reachable(walkable, start, spikes, {})
		var branch_type := "skeleton_reaper" if branch == &"reaper" else "vampire"
		var branch_prefix := "l8_%s_" % branch
		var unreachable_branch_enemies: Array[String] = []
		for raw_entity: Variant in document.get("entities", []):
			if (
				not raw_entity is Dictionary
				or String(raw_entity.get("type", "")) != branch_type
				or not String(raw_entity.get("id", "")).begins_with(branch_prefix)
			):
				continue
			var enemy_cell := _entity_cell(raw_entity)
			if not _reachable_near(enemy_cell, reached, walkable):
				unreachable_branch_enemies.append(String(raw_entity.get("id", "")))
		_expect(
			unreachable_branch_enemies.is_empty(),
			(
				"Level 8 selected %s branch enemies have a Knight-clear route: %s"
				% [branch, ", ".join(unreachable_branch_enemies)]
			),
		)
		for objective_type: String in ["chest", "exit_gate"]:
			for objective_cell: Vector2i in _entity_cells_by_type(
				document.get("entities", []), objective_type
			):
				_expect(
					_reachable_near(objective_cell, reached, walkable),
					(
						"Level 8 %s branch keeps %s reachable after its real seal opens"
						% [branch, objective_type]
					),
				)
		print("CHAPTER 1 COLLISION ROUTE: slot=8 branch=%s reachable=%d" % [branch, reached.size()])
		game.free()
		await get_tree().process_frame
		await get_tree().physics_frame


func _node_names(parent: Node) -> PackedStringArray:
	var names := PackedStringArray()
	for child: Node in parent.get_children():
		names.append(String(child.name))
	return names


func _has_current_level_collision(
	dungeon: DungeonLevel,
	query: PhysicsShapeQueryParameters2D,
) -> bool:
	var game_root := dungeon.get_parent()
	var space := dungeon.get_world_2d().direct_space_state
	for result: Dictionary in space.intersect_shape(query, 64):
		var collider: Variant = result.get("collider")
		if not collider is Node:
			continue
		var node := collider as Node
		if node == dungeon.geometry or game_root == node or game_root.is_ancestor_of(node):
			return true
	return false


func _collision_names_at_cell(
	dungeon: DungeonLevel,
	shape: RectangleShape2D,
	cell: Vector2i,
) -> PackedStringArray:
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape
	query.collision_mask = 1
	query.collide_with_areas = false
	var world_center := dungeon.backdrop.to_global(dungeon.backdrop.map_to_local(cell))
	query.transform = Transform2D(0.0, world_center + Vector2(0.0, -8.0))
	var names := PackedStringArray()
	var game_root := dungeon.get_parent()
	for result: Dictionary in dungeon.get_world_2d().direct_space_state.intersect_shape(query, 64):
		var collider: Variant = result.get("collider")
		if not collider is Node:
			continue
		var node := collider as Node
		if node == dungeon.geometry or game_root == node or game_root.is_ancestor_of(node):
			names.append(String(node.get_path()))
	return names


func _cells_by_position(value: Variant) -> Dictionary:
	var result := {}
	if not value is Array:
		return result
	for raw_cell: Variant in value:
		if raw_cell is Dictionary:
			var cell: Dictionary = raw_cell
			result[Vector2i(int(cell.get("x", -1)), int(cell.get("y", -1)))] = true
	return result


func _first_entity(entities: Array, entity_type: String) -> Dictionary:
	for raw_entity: Variant in entities:
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) == entity_type:
			return raw_entity
	return {}


func _entity_cell(entity: Dictionary) -> Vector2i:
	var position: Array = entity.get("position", [])
	if position.size() < 2:
		return Vector2i(-1, -1)
	return Vector2i(floori(float(position[0]) / TILE_SIZE), floori(float(position[1]) / TILE_SIZE))


func _entity_cells_by_type(entities: Array, entity_type: String) -> Dictionary:
	var result := {}
	for raw_entity: Variant in entities:
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) == entity_type:
			result[_entity_cell(raw_entity)] = true
	return result


func _count_entities_of_types(entities: Array, types: Array) -> int:
	var count := 0
	for raw_entity: Variant in entities:
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) in types:
			count += 1
	return count


func _door_transitions(entities: Array) -> Dictionary:
	var result := {}
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary or String(raw_entity.get("type", "")) != "floor_door":
			continue
		var entity: Dictionary = raw_entity
		var target_position: Array = entity.get("target_position", [])
		if target_position.size() < 2:
			continue
		var source := _entity_cell(entity)
		var destination := Vector2i(
			floori(float(target_position[0]) / TILE_SIZE),
			floori(float(target_position[1]) / TILE_SIZE),
		)
		var targets: Array = result.get(source, [])
		targets.append(destination)
		result[source] = targets
	return result


func _reachable(
	walkable: Dictionary,
	start: Vector2i,
	blocked: Dictionary,
	door_targets: Dictionary,
) -> Dictionary:
	var reached := {}
	if not walkable.has(start) or blocked.has(start):
		return reached
	var queue: Array[Vector2i] = [start]
	reached[start] = true
	var index := 0
	while index < queue.size():
		var current := queue[index]
		index += 1
		for direction: Vector2i in DIRECTIONS:
			var neighbor := current + direction
			if not walkable.has(neighbor) or blocked.has(neighbor) or reached.has(neighbor):
				continue
			if direction.x != 0 and direction.y != 0:
				var horizontal := current + Vector2i(direction.x, 0)
				var vertical := current + Vector2i(0, direction.y)
				if not walkable.has(horizontal) or not walkable.has(vertical):
					continue
			reached[neighbor] = true
			queue.append(neighbor)
		for destination_value: Variant in door_targets.get(current, []):
			var destination: Vector2i = destination_value
			if (
				walkable.has(destination)
				and not blocked.has(destination)
				and not reached.has(destination)
			):
				reached[destination] = true
				queue.append(destination)
	return reached


func _reachable_near(target: Vector2i, reached: Dictionary, walkable: Dictionary) -> bool:
	for radius: int in range(0, 4):
		for offset_y: int in range(-radius, radius + 1):
			for offset_x: int in range(-radius, radius + 1):
				if maxi(absi(offset_x), absi(offset_y)) != radius:
					continue
				var candidate := target + Vector2i(offset_x, offset_y)
				if reached.has(candidate) and walkable.has(candidate):
					return true
	return false


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("CHAPTER 1 COLLISION ROUTE FAIL: " + message)


func _finish() -> void:
	var report_path := "res://.artifacts/chapter_1_collision_route_report.json"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var file := FileAccess.open(ProjectSettings.globalize_path(report_path), FileAccess.WRITE)
	if file != null:
		file.store_string(
			(
				JSON.stringify({"checks": _checks, "failures": _failures, "maps": _reports}, "\t")
				+ "\n"
			)
		)
		file.close()
	if _failures.is_empty():
		print("CHAPTER 1 COLLISION ROUTE TEST PASSED - %d checks across ten live maps" % _checks)
		get_tree().quit(0)
		return
	print(
		"CHAPTER 1 COLLISION ROUTE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks]
	)
	print("CHAPTER 1 COLLISION ROUTE FAILURE DETAILS: " + JSON.stringify(_failures))
	get_tree().quit(1)
