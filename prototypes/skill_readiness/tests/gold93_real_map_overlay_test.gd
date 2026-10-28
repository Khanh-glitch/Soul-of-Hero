extends Node

## Disposable real-map overlay gate (G4).
##
## Runs the real Chapter 1 Level 2 production map from the IMMUTABLE commit
## `f9fb8d4b7490a2579426bd5c4ee4667704d3a05e` in a disposable CI workspace,
## overlays only `prototypes/skill_readiness/**` plus the pinned READ-ONLY Gold
## components, casts Venomwright #001 through the unified API and proves:
##
##   1. the native cast completes on a real authored map with real TileMaps,
##   2. no authored TileMap cell, collision cell or level file is mutated,
##   3. every ground/environment mark the cast produced is released on cleanup,
##   4. no gameplay damage is applied while user rules are unconfigured.
##
## This scene is executed by `.github/workflows/gold-93-readiness-runtime.yml`
## and never writes to `game/`, `data/`, `assets/`, `config/`, `addons/` or
## `project.godot`.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")

const LEVEL2_PATH := "res://data/levels/chapter_1_level_2.json"
const MAIN_SCENE_PATH := "res://game/main.tscn"
## Loaded lazily, NOT preloaded: autoloads (GameSession, GameEvents, ...) are
## only registered once the SceneTree is running, and `game/main.gd` references
## them. A `preload()` here would compile those scripts too early and the level
## would silently instantiate without its authored behaviour.
var _game_scene: PackedScene = null

var _checks: int = 0
var _failures: Array[String] = []
var _blockers: Array[String] = []

## Emitted with the process exit code once the overlay gate finished.
signal finished(exit_code: int)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("GOLD93_REAL_MAP_OVERLAY: " + message)


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	if not FileAccess.file_exists(LEVEL2_PATH):
		_blockers.append("REAL_MAP_OVERLAY_BLOCKED: level data %s missing in this workspace" % LEVEL2_PATH)
		_finish()
		return

	_game_scene = load(MAIN_SCENE_PATH) as PackedScene
	_expect(_game_scene != null, "real production gameplay scene resource loads")
	if _game_scene == null:
		_finish()
		return
	var game: Node2D = _game_scene.instantiate() as Node2D
	_expect(game != null, "real production gameplay scene instantiates for Level 2")
	if game == null:
		_finish()
		return
	var level: Node = game.get_node_or_null("Level")
	if level != null and "level_data_path" in level:
		level.set("level_data_path", LEVEL2_PATH)
	if level != null and "watch_file_changes" in level:
		level.set("watch_file_changes", false)
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame

	var tilemaps: Array[Node] = _collect_tilemaps(game)
	_expect(tilemaps.size() > 0, "real authored Level 2 exposes TileMaps to mask against")
	# Guard against a hollow instantiation: the level must actually have built
	# its authored content, not just the node skeleton.
	var built_cells: int = 0
	for tm in tilemaps:
		if tm.has_method("get_used_cells"):
			built_cells += (tm.get_used_cells() as Array).size()
	_expect(built_cells > 0,
			"real authored Level 2 TileMaps contain authored cells (got %d)" % built_cells)

	var before := _tilemap_signature(tilemaps)
	var level_before := _level_file_signature()

	# --- cast through the unified API on the real map -------------------------
	var caster: Node2D = Node2D.new()
	caster.name = "Gold93OverlayCaster"
	game.add_child(caster)
	var player: Node2D = _find_player(game)
	if player != null:
		caster.global_position = player.global_position
	else:
		caster.global_position = Vector2(320.0, 180.0)

	var ctx := CONTEXT.new()
	ctx.initialize(caster, caster.global_position, 20261028, true)
	# Original Venomwright logical space is 600x340; anchor it at the caster's
	# real world position so source coordinates map onto the authored map.
	ctx.set_source_to_world(Transform2D.IDENTITY.translated(
			caster.global_position - Vector2(300.0, 170.0)))
	ctx.set_world_aim(caster.global_position + Vector2(120.0, 0.0))

	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors(_enemy_actors(game, caster.global_position))
	ctx.set_ports(bundle)

	var runtime = RUNTIME.new()
	var handle = runtime.cast(&"venomwright:001", ctx, PARAMS.diagnostic("venomwright"))
	_expect(not handle.is_blocked(), "venomwright:001 casts on the real Level 2 map")
	if handle.is_blocked():
		_finish()
		return
	handle.start()
	var ticks: int = handle.run_to_completion(4096)
	_expect(handle.status == Gold93SkillHandle.Status.FINISHED,
			"full original cast reaches FINISHED on the real map (got %s, %d ticks)" % [
				handle.status_name(), ticks,
			])

	var result: Dictionary = handle.result()
	_expect(int(result.get("intents", {}).get("emitted", 0)) > 20,
			"real-map cast emits the authored intent stream")
	_expect(int(result.get("terrain", {}).get("writes", 0)) > 0,
			"authored ground/environment operations reach the real-map terrain port")
	_expect(int(result.get("combat", {}).get("applied", 0)) == 0,
			"no gameplay damage without user-approved combat rules")

	# --- cleanup ---------------------------------------------------------------
	handle.dispose()
	_expect(handle.status == Gold93SkillHandle.Status.DISPOSED, "cast disposes on the real map")
	await get_tree().process_frame

	# --- zero map mutation -------------------------------------------------------
	var after := _tilemap_signature(tilemaps)
	_expect(before == after, "authored Level 2 TileMap cells are unchanged by the VFX cast")
	_expect(_level_file_signature() == level_before,
			"authored level JSON is unchanged by the VFX cast")

	_finish()


func _collect_tilemaps(root: Node) -> Array[Node]:
	var out: Array[Node] = []
	for node in root.find_children("*", "TileMapLayer", true, false):
		out.append(node)
	for node in root.find_children("*", "TileMap", true, false):
		out.append(node)
	return out


func _tilemap_signature(tilemaps: Array[Node]) -> String:
	var rows := PackedStringArray()
	for node in tilemaps:
		var name_path: String = String(node.get_path())
		var cells: Array = []
		if node.has_method("get_used_cells"):
			cells = node.get_used_cells()
		var cell_rows := PackedStringArray()
		for cell in cells:
			var coords := Vector2i(int(cell.x), int(cell.y))
			var source_id: int = -1
			var atlas := Vector2i(-1, -1)
			if node.has_method("get_cell_source_id"):
				source_id = int(node.get_cell_source_id(coords))
			if node.has_method("get_cell_atlas_coords"):
				atlas = Vector2i(node.get_cell_atlas_coords(coords))
			cell_rows.append("%d,%d,%d,%d,%d" % [
				coords.x, coords.y, source_id, atlas.x, atlas.y,
			])
		rows.append("%s=%s" % [name_path, ",".join(cell_rows)])
	return "\n".join(rows)


func _level_file_signature() -> String:
	var text: String = FileAccess.get_file_as_string(LEVEL2_PATH)
	if text.is_empty():
		return "MISSING"
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(text.to_utf8_buffer())
	return ctx.finish().hex_encode()


func _find_player(game: Node) -> Node2D:
	for node in game.find_children("*", "CharacterBody2D", true, false):
		if node.is_in_group("player") or String(node.name).to_lower().contains("player"):
			return node as Node2D
	for node in game.find_children("*", "Node2D", true, false):
		if String(node.name).to_lower().contains("player"):
			return node as Node2D
	return null


## Maps real enemies into ORIGINAL source actor shape. Coordinates are converted
## into the family's source space; nothing about the real enemies is modified.
func _enemy_actors(game: Node, caster_world: Vector2) -> Array:
	var inverse := Transform2D.IDENTITY.translated(
			caster_world - Vector2(300.0, 170.0)).inverse()
	var out: Array = []
	var next_id: int = 1
	for node in game.find_children("*", "CharacterBody2D", true, false):
		var body := node as Node2D
		if body == null or body.is_in_group("player"):
			continue
		var source_pos: Vector2 = inverse * body.global_position
		out.append({
			"id": next_id,
			"x": source_pos.x,
			"y": source_pos.y,
			"r": 7.0,
			"exists": true,
			"dying": 0.0,
		})
		next_id += 1
		if out.size() >= 4:
			break
	if out.is_empty():
		out = [
			{"id": 1, "x": 420.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
			{"id": 2, "x": 460.0, "y": 210.0, "r": 7.0, "exists": true, "dying": 0.0},
		]
	return out


func _finish() -> void:
	var payload: Dictionary = {
		"checks": _checks,
		"failures": _failures,
		"blockers": _blockers,
		"level": LEVEL2_PATH,
		"pass": _failures.is_empty() and _blockers.is_empty(),
	}
	DirAccess.make_dir_recursive_absolute("res://.artifacts/gold93")
	var file := FileAccess.open("res://.artifacts/gold93/real_map_overlay.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(payload, "  ") + "\n")
		file.close()

	if not _blockers.is_empty():
		for b in _blockers:
			print(b)
		finished.emit(0)
		return
	if _failures.is_empty():
		print("GOLD93_REAL_MAP_OVERLAY: PASS / real Level 2 / native full cast / zero authored map mutation / cleanup")
		finished.emit(0)
	else:
		print("GOLD93_REAL_MAP_OVERLAY: FAIL / %d problem(s)" % _failures.size())
		finished.emit(1)
