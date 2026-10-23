extends Node

## Production Training route gate. This uses AppRoot/AppFlow and the live Knight
## collision shape, then drives Main's real enemy-death callback with each live
## authored actor. It does not substitute a standalone EncounterRuntimeState.

const APP_ROOT_SCENE: PackedScene = preload("res://game/app/app_root.tscn")
const SANDBOX_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/sandbox_content_registry.tres"
)
const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const EXPECTED_LAYOUT := "res://data/levels/crypt_training_sandbox.json"
const TILE_SIZE := 16.0
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
const SKELETON_IDS := [
	"training_skeleton_01",
	"training_skeleton_02",
	"training_skeleton_03",
	"training_skeleton_04",
	"training_skeleton_05",
]

var _checks := 0
var _failures: Array[String] = []
var _app_root: Node
var _save_path := ""
var _route_report: Dictionary = {}


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_save_path = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if _save_path.is_empty():
		_save_path = "user://tests/training_sandbox_live_route_%d.json" % Time.get_ticks_usec()
	_remove_generations(_save_path)
	_expect(
		SaveService.configure_storage(_save_path, true),
		"Training route uses a fresh isolated save profile",
	)
	_test_schema_contract()

	_app_root = APP_ROOT_SCENE.instantiate()
	_expect(_app_root != null, "production AppRoot instantiates for Training")
	if _app_root == null:
		_finish()
		return
	add_child(_app_root)
	await get_tree().process_frame
	var campaign_before: Dictionary = (
		SaveService.get_value(["progression", "campaign"], {}).duplicate(true)
	)

	AppFlow.start_training()
	for _frame: int in 8:
		await get_tree().process_frame
	await get_tree().physics_frame
	var active_run := AppFlow.get_active_run()
	_expect(AppFlow.has_active_run(), "AppFlow creates a live Training run")
	_expect(
		(
			active_run.get("content_level_id") == &"crypt_entrance_sandbox"
			and int(active_run.get("campaign_slot", -1)) == 0
			and active_run.get("mode_id") == &"training"
		),
		"Training run keeps its sandbox identity outside campaign slots",
	)
	_expect(
		String(active_run.get("layout_data_path", "")) == EXPECTED_LAYOUT,
		"AppFlow routes Training to its dedicated map, not Campaign Level 01",
	)

	var route_host := _app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0) as Node2D
		if route_host != null and route_host.get_child_count() > 0
		else null
	)
	_expect(game != null, "production Training route hosts Main")
	if game == null:
		await _cleanup()
		_finish()
		return
	var dungeon := game.get_node_or_null("Level") as DungeonLevel
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := (
		entity_root.get_node_or_null("Knight") as CharacterBody2D if entity_root != null else null
	)
	_expect(
		dungeon != null and entity_root != null and player != null,
		"Training contains the production dungeon, entity root, and Knight",
	)
	if dungeon == null or entity_root == null or player == null:
		await _cleanup()
		_finish()
		return
	_expect(dungeon.level_data_path == EXPECTED_LAYOUT, "Main loads the registered Training layout")
	_expect(GameSession.required_sigils == 0, "Training has no campaign Sigil requirement")

	var live_enemies := {}
	for child: Node in entity_root.get_children():
		if child.is_in_group(&"enemies"):
			live_enemies[String(child.get_meta(&"level_entity_id", ""))] = child
	_expect(live_enemies.size() == 5, "Training spawns exactly five live Skeletons")
	for entity_id: String in SKELETON_IDS:
		_expect(live_enemies.has(entity_id), "Live Training actor exists: %s" % entity_id)

	var initial_snapshot: Dictionary = game.get_runtime_snapshot()
	var initial_encounter := _encounter_snapshot(initial_snapshot)
	_expect(
		bool(initial_encounter.get("configured", false)), "Sandbox encounter runtime is configured"
	)
	_expect(
		String(initial_encounter.get("level_id", "")) == "crypt_entrance_sandbox",
		"Encounter runtime belongs to the sandbox definition",
	)
	_expect(
		int(initial_encounter.get("total_enemies", 0)) == 5,
		"Runtime tracks all five Training enemies"
	)
	_expect(
		not bool(initial_encounter.get("complete", true)),
		"Training clear objective starts incomplete"
	)
	var encounter_states := initial_encounter.get("encounters", {}) as Dictionary
	var sandbox_state := encounter_states.get("crypt_skeleton_sandbox", {}) as Dictionary
	_expect(
		bool(sandbox_state.get("valid", false)), "Registered Training encounter is runtime-valid"
	)
	var exit_gate: ExitGate
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_id", "")) == "training_exit":
			exit_gate = child as ExitGate
			break
	_expect(exit_gate != null and exit_gate.is_open, "Training retains its free practice exit")

	_test_collision_route(dungeon, player)
	_test_enemy_death_projection(game, live_enemies)

	AppFlow.complete_training({"score": 500, "sigils": 0, "required_sigils": 0})
	var result := AppFlow.get_last_result()
	_expect(
		result.get("mode_id") == &"training" and int(result.get("campaign_slot", -1)) == 0,
		"Training result remains outside campaign completion authority",
	)
	_expect(not result.has("reward"), "Training result contains no campaign reward bundle")
	var campaign_after: Dictionary = SaveService.get_value(["progression", "campaign"], {})
	_expect(
		campaign_after == campaign_before, "Training route does not change campaign progression"
	)

	await _cleanup()
	_finish()


func _test_collision_route(dungeon: DungeonLevel, player: CharacterBody2D) -> void:
	var body_collision := player.get_node_or_null("BodyShape") as CollisionShape2D
	_expect(
		body_collision != null and body_collision.shape != null,
		"Training route uses the live Knight BodyShape",
	)
	if body_collision == null or body_collision.shape == null:
		return
	var document := dungeon.level_data
	var entities: Array = document.get("entities", [])
	var floor_cells := _cells_by_position(document.get("layers", {}).get("Backdrop", []))
	var spike_cells := _entity_cells_by_type(entities, "spikes")
	var player_cell := _entity_cell(_first_entity(entities, "player"))
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_collision.shape
	query.collision_mask = 1
	query.collide_with_areas = false
	var collision_clear := {}
	for cell: Vector2i in floor_cells:
		query.transform = _knight_collision_transform_at_cell(dungeon, player, body_collision, cell)
		if not _has_current_level_collision(dungeon, query):
			collision_clear[cell] = true
	_expect(collision_clear.has(player_cell), "Training spawn fits the real Knight footprint")
	var reached := _reachable(collision_clear, player_cell, spike_cells)
	var safe_floor_count := 0
	for cell: Vector2i in collision_clear:
		if not spike_cells.has(cell):
			safe_floor_count += 1
	_expect(
		reached.size() == safe_floor_count,
		(
			"Every collision-clear Training cell belongs to the playable loop (%d/%d)"
			% [
				reached.size(),
				safe_floor_count,
			]
		),
	)
	var unreachable: Array[String] = []
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		if String(entity.get("type", "")) not in ["skeleton", "exit_gate"]:
			continue
		var target := _entity_cell(entity)
		if not _reachable_near(target, reached, collision_clear):
			unreachable.append(String(entity.get("id", "entity")))
	_expect(
		unreachable.is_empty(),
		(
			"All five Skeletons and the exit are reachable with Knight clearance: %s"
			% ", ".join(unreachable)
		),
	)
	_route_report = {
		"backdrop_cells": floor_cells.size(),
		"collision_clear_cells": collision_clear.size(),
		"safe_reachable_cells": reached.size(),
		"safe_floor_cells": safe_floor_count,
		"unreachable_targets": unreachable,
	}
	print(
		(
			"TRAINING SANDBOX COLLISION ROUTE: safe=%d/%d targets=6"
			% [reached.size(), safe_floor_count]
		)
	)


func _test_enemy_death_projection(game: Node2D, live_enemies: Dictionary) -> void:
	for entity_id: String in SKELETON_IDS:
		var enemy := live_enemies.get(entity_id) as Node
		if enemy == null:
			continue
		game.call("_on_encounter_enemy_died", enemy, StringName(entity_id))
	var snapshot := _encounter_snapshot(game.get_runtime_snapshot())
	_expect(
		int(snapshot.get("defeated_enemies", 0)) == 5, "Main death bridge records all five enemies"
	)
	_expect(
		bool(snapshot.get("complete", false)),
		"Training encounter completes after its five real markers"
	)
	var gates := snapshot.get("gates", {}) as Dictionary
	_expect(
		bool(gates.get("training_exit", false)),
		"Encounter completion resolves the authored Training exit"
	)
	var first_enemy := live_enemies.get(SKELETON_IDS[0]) as Node
	if first_enemy != null:
		game.call("_on_encounter_enemy_died", first_enemy, StringName(SKELETON_IDS[0]))
	var duplicate_snapshot := _encounter_snapshot(game.get_runtime_snapshot())
	_expect(
		int(duplicate_snapshot.get("defeated_enemies", 0)) == 5,
		"Duplicate enemy death cannot inflate Training completion",
	)


func _test_schema_contract() -> void:
	var file := FileAccess.open(EXPECTED_LAYOUT, FileAccess.READ)
	_expect(file != null, "Training schema fixture opens the dedicated layout")
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "Training schema fixture parses as a map")
	if not parsed is Dictionary:
		return
	var document := parsed as Dictionary
	var validation: Dictionary = LEVEL_SCHEMA.validate_level(document)
	_expect(
		bool(validation.get("ok", false)),
		(
			"Explicit free-practice Training contract accepts zero Sigils: %s"
			% validation.get("error", "")
		),
	)
	var uncontracted := document.duplicate(true)
	var uncontracted_metadata := uncontracted.get("metadata", {}) as Dictionary
	uncontracted_metadata.erase("training_contract")
	_expect(
		not bool(LEVEL_SCHEMA.validate_level(uncontracted).get("ok", false)),
		"Zero Sigils remain invalid without the explicit Training contract",
	)


func _encounter_snapshot(runtime_snapshot: Dictionary) -> Dictionary:
	var session := runtime_snapshot.get("session", {}) as Dictionary
	return session.get("encounter", {}) as Dictionary


func _has_current_level_collision(
	dungeon: DungeonLevel, query: PhysicsShapeQueryParameters2D
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


func _knight_collision_transform_at_cell(
	dungeon: DungeonLevel,
	player: CharacterBody2D,
	body_collision: CollisionShape2D,
	cell: Vector2i,
) -> Transform2D:
	var world_center := dungeon.backdrop.to_global(dungeon.backdrop.map_to_local(cell))
	var root_transform := player.global_transform
	root_transform.origin = world_center
	return root_transform * body_collision.transform


func _cells_by_position(value: Variant) -> Dictionary:
	var result := {}
	if not value is Array:
		return result
	for raw_cell: Variant in value:
		if raw_cell is Dictionary:
			var cell := raw_cell as Dictionary
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


func _reachable(walkable: Dictionary, start: Vector2i, blocked: Dictionary) -> Dictionary:
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


func _cleanup() -> void:
	if AppFlow.has_active_run():
		AppFlow.abort_to_home()
		await get_tree().process_frame
	if is_instance_valid(_app_root):
		_app_root.queue_free()
		await get_tree().process_frame
	_remove_generations(_save_path)


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("TRAINING SANDBOX LIVE ROUTE FAIL: " + message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"failures": _failures,
		"route": _route_report,
	}
	var file := FileAccess.open(
		"res://.artifacts/training_sandbox_live_route_report.json", FileAccess.WRITE
	)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("TRAINING SANDBOX LIVE ROUTE PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("TRAINING SANDBOX LIVE ROUTE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
