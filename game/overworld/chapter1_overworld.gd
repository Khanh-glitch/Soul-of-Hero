class_name Chapter1Overworld
extends Node2D
## **THE HOLLOW MARCHES — BIÊN VỰC TÀN VONG**
##
## The explorable region that connects Home to the ten existing Chapter 1
## dungeon levels. This node is the controller: it owns the world's construction
## order, the player, the ten thresholds, the four camps, the eight discoveries,
## the four shortcuts, the survival tick and the campaign hand-off.
##
## Construction is deferred one idle frame on purpose. The world build loads
## JSON, builds a TileSet, paints ~100k cells and instantiates the Knight — all
## of which touch autoloads (SaveService, AppFlow, CampaignProgression) and the
## RenderingServer. Doing that inside `_ready()` races the rest of the scene
## tree, so it happens after the tree is settled.
##
## Build completion is *observable*: `build_stage` advances through
## `BuildStage`, `is_world_ready()` becomes true, and `world_ready` is emitted.
## Tests wait for that, never for a frame count.

signal world_ready
signal build_failed(reason: String)
signal level_entered(level_id: StringName)
signal travel_prompt(text: String)

enum BuildStage {
	IDLE = 0,
	LOADING_DATA = 1,
	PAINTING_TERRAIN = 2,
	SPAWNING_PLAYER = 3,
	SPAWNING_PLACES = 4,
	RESTORING_PROGRESS = 5,
	READY = 6,
	FAILED = 7,
}

const WORLD_DATA_PATH := "res://data/overworld/hollow_marches.json"
const LAYERS_PATH := "res://data/overworld/hollow_marches_layers.json"
const PROPS_PATH := "res://data/overworld/hollow_marches_props.json"
const KNIGHT_SCENE: PackedScene = preload("res://game/characters/knight/knight.tscn")
const GATE_SCRIPT := preload("res://game/overworld/overworld_gate.gd")
const CAMP_SCRIPT := preload("res://game/overworld/overworld_camp.gd")
const DISCOVERY_SCRIPT := preload("res://game/overworld/overworld_discovery.gd")
const HUD_SCRIPT := preload("res://game/overworld/overworld_hud.gd")
const WORLD_SCRIPT := preload("res://game/overworld/overworld_world.gd")

const CAMERA_ZOOM := Vector2.ONE
const WEARY_SPEED_SCALE := 0.82
const EXHAUSTED_SPEED_SCALE := 0.66

var build_stage: int = BuildStage.IDLE
var build_error: String = ""
var world_data: Dictionary = {}
var world: OverworldWorld
var state: OverworldState
var player: CharacterBody2D
var camera: Camera2D
var hud: OverworldHud

var gates: Dictionary = {}       # level_id:String -> OverworldGate
var camps: Dictionary = {}       # camp_id:String -> OverworldCamp
var discoveries: Dictionary = {} # id:String -> OverworldDiscovery

var _payload: Dictionary = {}
var _pending_payload: Dictionary = {}
var _return_point: Vector2 = Vector2.ZERO
var _base_move_speed := 112.0
var _speed_scale_applied := 1.0
var _frame_count := 0


# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------
func _ready() -> void:
	# AppRoot calls configure() right after add_child(); remember anything that
	# arrives before the deferred build runs.
	_payload = _pending_payload.duplicate(true)
	call_deferred(&"_build_world")


func configure(payload: Dictionary) -> void:
	_pending_payload = payload.duplicate(true)
	_payload = payload.duplicate(true)
	if build_stage == BuildStage.READY:
		_apply_payload_spawn()


func is_world_ready() -> bool:
	return build_stage == BuildStage.READY


func _build_world() -> void:
	if build_stage != BuildStage.IDLE:
		return
	build_stage = BuildStage.LOADING_DATA
	world_data = _load_json(WORLD_DATA_PATH)
	if world_data.is_empty():
		_fail("world document missing at %s" % WORLD_DATA_PATH)
		return
	var landmark_names: Array = world_data.get("landmarks", [])
	if landmark_names.size() != 10:
		_fail("world document declares %d landmarks, expected 10" % landmark_names.size())
		return

	build_stage = BuildStage.PAINTING_TERRAIN
	var entities := _ensure_node("Entities")
	world = WORLD_SCRIPT.new() as OverworldWorld
	world.name = "World"
	add_child(world)
	if not world.build(world_data, LAYERS_PATH, PROPS_PATH, entities):
		_fail("world layers failed to paint")
		return

	build_stage = BuildStage.SPAWNING_PLAYER
	state = OverworldState.new()
	state.state_saved.connect(_on_state_saved)
	state.discovery_found.connect(_on_state_discovery)
	state.shortcut_opened.connect(_on_state_shortcut_opened)
	state.provisions_changed.connect(_on_provisions_changed)
	var spawn := _authored_spawn()
	state.configure(world_data, spawn, StringName(String(world_data.get("refuge", {}).get("id", "camp_refuge"))), _save_service())
	_spawn_player()
	_setup_camera()

	build_stage = BuildStage.SPAWNING_PLACES
	_spawn_landmarks()
	_spawn_camps()
	_spawn_discoveries()

	build_stage = BuildStage.RESTORING_PROGRESS
	_apply_payload_spawn()
	_restore_progress()
	_build_hud()
	_connect_run_events()
	_apply_hud()
	build_stage = BuildStage.READY
	world_ready.emit()


func _fail(reason: String) -> void:
	build_error = reason
	build_stage = BuildStage.FAILED
	push_error("Overworld build failed: %s" % reason)
	build_failed.emit(reason)


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}


func _save_service() -> Node:
	return get_node_or_null("/root/SaveService")


func _app_flow() -> Node:
	return get_node_or_null("/root/AppFlow")


# ---------------------------------------------------------------------------
# spawning
# ---------------------------------------------------------------------------
func _authored_spawn() -> Vector2:
	var start: Array = world_data.get("start_position", [56, 218])
	if start.size() < 2:
		return Vector2(56 * 16 + 8, 218 * 16 + 8)
	return Vector2(float(start[0]) * 16.0 + 8.0, float(start[1]) * 16.0 + 8.0)


func _spawn_player() -> void:
	player = KNIGHT_SCENE.instantiate() as CharacterBody2D
	player.name = "Player"
	player.position = state.last_position if state.last_position != Vector2.ZERO else _authored_spawn()
	player.set_meta("overworld_controlled", true)
	# The region is a travel space, not a combat arena: the Knight keeps its
	# animation, collision and camera, and starts with its tuning speed.
	if player.get(&"move_speed") != null:
		_base_move_speed = float(player.get(&"move_speed"))
	var entities := get_node_or_null("Entities")
	if entities == null:
		entities = Node2D.new()
		entities.name = "Entities"
		entities.y_sort_enabled = true
		add_child(entities)
	entities.add_child(player)


func _setup_camera() -> void:
	camera = player.get_node_or_null("Camera") as Camera2D
	if camera == null:
		camera = Camera2D.new()
		camera.name = "Camera"
		player.add_child(camera)
	camera.zoom = CAMERA_ZOOM
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 8.0
	camera.limit_smoothed = true
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = world.width * OverworldWorld.TILE
	camera.limit_bottom = world.height * OverworldWorld.TILE
	camera.make_current()
	camera.reset_smoothing()


func _spawn_landmarks() -> void:
	var root := _ensure_node("Places")
	for raw: Variant in world_data.get("landmarks", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var level_id := StringName(entry.get("campaign_level_id", ""))
		var tile: Array = entry.get("pos", [0, 0])
		var threshold: Array = entry.get("threshold", tile)
		var gate := GATE_SCRIPT.new() as OverworldGate
		gate.name = "Gate_%s" % String(entry.get("id", "x"))
		gate.level_id = level_id
		gate.world_id = StringName(entry.get("id", ""))
		gate.display_name = String(entry.get("title", ""))
		gate.subtitle = String(entry.get("subtitle", ""))
		gate.position = Vector2(float(threshold[0]) * 16.0 + 8.0, float(threshold[1]) * 16.0 + 8.0)
		gate.gate_interacted.connect(_on_gate_interacted)
		gate.gate_state_changed.connect(_on_gate_state_changed)
		root.add_child(gate)
		gates[String(level_id)] = gate
	# AppFlow reads save data during refresh; defer so it never runs inside the
	# builder while the tree is still assembling.
	call_deferred(&"_refresh_gates")


func _refresh_gates() -> void:
	for level_id: String in gates:
		var gate: OverworldGate = gates[level_id]
		if is_instance_valid(gate):
			gate.refresh()


func _spawn_camps() -> void:
	var root := _ensure_node("Places")
	for raw: Variant in world_data.get("camps", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var tile: Array = entry.get("pos", [0, 0])
		var camp := CAMP_SCRIPT.new() as OverworldCamp
		var camp_id := StringName(entry.get("id", "camp"))
		camp.name = "Camp_%s" % String(camp_id)
		camp.camp_id = camp_id
		camp.camp_name = String(entry.get("name", "Camp"))
		camp.position = Vector2(float(tile[0]) * 16.0 + 8.0, float(tile[1]) * 16.0 + 8.0)
		camp.rest_point = camp.position + Vector2(0, 14)
		camp.camp_touched.connect(_on_camp_touched)
		root.add_child(camp)
		camps[String(camp_id)] = camp


func _spawn_discoveries() -> void:
	var root := _ensure_node("Places")
	for raw: Variant in world_data.get("discoveries", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var tile: Array = entry.get("pos", [0, 0])
		var node := DISCOVERY_SCRIPT.new() as OverworldDiscovery
		var discovery_id := StringName(entry.get("id", "discovery"))
		node.name = "Find_%s" % String(discovery_id)
		node.discovery_id = discovery_id
		node.kind = String(entry.get("kind", "coin_cache"))
		node.position = Vector2(float(tile[0]) * 16.0 + 8.0, float(tile[1]) * 16.0 + 8.0)
		node.discovered.connect(_on_discovery_collected)
		root.add_child(node)
		discoveries[String(discovery_id)] = node


func _ensure_node(node_name: String) -> Node2D:
	var existing := get_node_or_null(node_name) as Node2D
	if existing != null:
		return existing
	var node := Node2D.new()
	node.name = node_name
	node.y_sort_enabled = true
	add_child(node)
	return node


func _build_hud() -> void:
	hud = HUD_SCRIPT.new() as OverworldHud
	hud.name = "HUD"
	add_child(hud)


# ---------------------------------------------------------------------------
# progress restore
# ---------------------------------------------------------------------------
func _restore_progress() -> void:
	if state == null:
		return
	var flow := _app_flow()
	# Camps that were ever lit stay lit.
	for camp_id: String in camps:
		var camp: OverworldCamp = camps[camp_id]
		if is_instance_valid(camp):
			camp.set_visited(state.is_camp_visited(StringName(camp_id)))
	# Discoveries that were already searched show no glint.
	for discovery_id: String in discoveries:
		var node: OverworldDiscovery = discoveries[discovery_id]
		if is_instance_valid(node):
			node.set_found(state.is_discovery_found(StringName(discovery_id)))
	# Shortcuts: opened state comes from the save, and falls back to the level
	# that grants it (so an existing campaign profile keeps its reward).
	var opened := 0
	for raw: Variant in world_data.get("shortcuts", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var shortcut_id := String(entry.get("id", ""))
		if shortcut_id.is_empty():
			continue
		if state.is_shortcut_open(StringName(shortcut_id), flow):
			if not bool(state.shortcuts.get(shortcut_id, false)):
				# Backfill the persisted flag without emitting a second grant.
				state.shortcuts[shortcut_id] = true
				state.mark_dirty()
			world.set_shortcut_open(shortcut_id, true)
			opened += 1
		else:
			world.set_shortcut_open(shortcut_id, false)
	if opened > 0:
		state.mark_dirty()


func _apply_payload_spawn() -> void:
	if player == null or state == null:
		return
	var from_return := bool(_payload.get("from_return", false))
	var target := state.last_position
	if target == Vector2.ZERO:
		target = _authored_spawn()
	if from_return and not _return_point.is_zero_approx():
		target = _return_point
	if from_return:
		# Return policy, stated once: a cleared level puts you back at the
		# threshold you entered by; dying or retreating from an uncleared level
		# puts you back at the last camp you lit, which is always safe ground.
		var level_id := StringName(_payload.get("level_id", ""))
		var flow := _app_flow()
		var cleared := flow != null and flow.has_method(&"is_campaign_level_completed") \
			and bool(flow.call(&"is_campaign_level_completed", level_id))
		if not cleared:
			var camp: OverworldCamp = camps.get(String(state.last_camp_id), null)
			if camp != null:
				target = camp.rest_position()
	# Never place the player inside terrain: step back to the nearest walkable
	# cell along the approach if the saved point is no longer valid.
	if world != null and not world.is_walkable(target):
		target = _nearest_walkable(target)
	player.position = target
	if camera != null:
		camera.reset_smoothing()
		camera.make_current()
	if from_return:
		var level_id := StringName(_payload.get("level_id", ""))
		_say("You climb back into the Marches." if level_id == &"" else "You return from %s." % _title_for_level(level_id))
		_refresh_gates.call_deferred()


func _nearest_walkable(origin: Vector2) -> Vector2:
	for radius in range(1, 14):
		for angle_index in range(12):
			var angle := TAU * float(angle_index) / 12.0
			var candidate := origin + Vector2(cos(angle), sin(angle)) * float(radius) * 16.0
			if world.is_walkable(candidate):
				return candidate
	return _authored_spawn()


func _title_for_level(level_id: StringName) -> String:
	for raw: Variant in world_data.get("landmarks", []):
		if raw is Dictionary and StringName((raw as Dictionary).get("campaign_level_id", "")) == level_id:
			return String((raw as Dictionary).get("title", ""))
	return String(level_id)


# ---------------------------------------------------------------------------
# per-frame
# ---------------------------------------------------------------------------
func _process(delta: float) -> void:
	_frame_count += 1
	if build_stage != BuildStage.READY:
		return
	if state == null or not is_instance_valid(player):
		return
	state.set_world_position(player.global_position)
	var hazard := _in_hazard(player.global_position)
	var safe := _in_camp_radius(player.global_position)
	state.tick(delta, hazard, safe)
	_apply_fatigue()
	_apply_hud()
	if Input.is_action_just_pressed(&"pause") or Input.is_action_just_pressed(&"ui_cancel"):
		_retreat_to_home()


func _in_hazard(position: Vector2) -> bool:
	var tile := position / 16.0
	for raw: Variant in world_data.get("hazards", []):
		if not raw is Dictionary:
			continue
		var rect: Array = (raw as Dictionary).get("rect", [])
		if rect.size() < 4:
			continue
		if tile.x >= float(rect[0]) and tile.x <= float(rect[0]) + float(rect[2]) \
				and tile.y >= float(rect[1]) and tile.y <= float(rect[1]) + float(rect[3]):
			return true
	return false


func _in_camp_radius(position: Vector2) -> bool:
	for camp_id: String in camps:
		var camp: OverworldCamp = camps[camp_id]
		if is_instance_valid(camp) and position.distance_to(camp.global_position) < 56.0:
			return true
	return false


func _apply_fatigue() -> void:
	# Provisions are pressure, not a wall: an empty pack slows the walk and says
	# so, and nothing else about the run is taken away.
	var ratio := 0.0 if state.max_provisions <= 0 else float(state.provisions) / float(state.max_provisions)
	var target := 1.0
	if state.provisions <= 0:
		target = EXHAUSTED_SPEED_SCALE
	elif ratio < 0.2:
		target = WEARY_SPEED_SCALE
	if not is_equal_approx(target, _speed_scale_applied):
		_speed_scale_applied = target
		player.set(&"move_speed", _base_move_speed * target)


func _apply_hud() -> void:
	if hud == null or state == null:
		return
	hud.set_region(_region_label())
	hud.set_provisions(state.provisions, state.max_provisions)
	hud.set_counts(
		_lit_camp_count(), camps.size(),
		state.discoveries.size(), discoveries.size(),
		_open_shortcut_count(), int((world_data.get("shortcuts", []) as Array).size())
	)


func _region_label() -> String:
	var region := _region_at(player.global_position) if is_instance_valid(player) else ""
	if region.is_empty():
		return "THE HOLLOW MARCHES"
	return "THE HOLLOW MARCHES  ·  %s" % region.to_upper()


## Public so the runtime tests can assert the label a player would read.
func region_at(position: Vector2) -> String:
	return _region_at(position)


func _region_at(position: Vector2) -> String:
	# Every square metre of the Marches belongs to a named region: the position
	# resolves to its nearest landmark and takes that landmark's region label from
	# the `regions` table in the world document. An earlier pass gave up beyond a
	# 40-tile radius, so the HUD fell back to the bare world name across most of
	# the map.
	var nearest := ""
	var nearest_distance := INF
	for raw: Variant in world_data.get("landmarks", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var tile: Array = entry.get("pos", [0, 0])
		var anchor := Vector2(float(tile[0]) * 16.0, float(tile[1]) * 16.0)
		var distance := anchor.distance_to(position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = String(entry.get("region", ""))
	if nearest.is_empty():
		return ""
	for raw: Variant in world_data.get("regions", []):
		if raw is Dictionary and String((raw as Dictionary).get("id", "")) == nearest:
			return String((raw as Dictionary).get("label", nearest.replace("_", " ")))
	return nearest.replace("_", " ")


func _lit_camp_count() -> int:
	var count := 0
	for camp_id: String in camps:
		if state.is_camp_visited(StringName(camp_id)):
			count += 1
	return count


func _open_shortcut_count() -> int:
	var count := 0
	for raw: Variant in world_data.get("shortcuts", []):
		if raw is Dictionary and bool(state.shortcuts.get(String((raw as Dictionary).get("id", "")), false)):
			count += 1
	return count


func _say(text: String) -> void:
	if hud != null:
		hud.show_prompt(text)
	travel_prompt.emit(text)


# ---------------------------------------------------------------------------
# interaction
# ---------------------------------------------------------------------------
func _on_gate_interacted(gate: OverworldGate, level_id: StringName, _world_id: StringName) -> void:
	var flow := _app_flow()
	if flow == null:
		_say("The way is not ready.")
		return
	if not bool(flow.call(&"is_campaign_level_unlocked", level_id)):
		_say("%s is still sealed. Clear the road that leads here." % gate.display_name)
		return
	# Remember exactly where to stand on return, then commit it before the scene
	# is replaced: the overworld node is freed by the route switch.
	_return_point = player.global_position
	state.set_world_position(_return_point, true)
	state.record_level_entry(level_id)
	var payload := {
		"level_id": String(level_id),
		"world_id": String(gate.world_id),
		"last_camp": String(state.last_camp_id),
	}
	if flow.has_method(&"set_pending_overworld_return"):
		flow.call(&"set_pending_overworld_return", payload)
	level_entered.emit(level_id)
	var started := bool(flow.call(&"start_campaign_level", level_id))
	if not started:
		_say("%s refused the descent." % gate.display_name)


func _on_gate_state_changed(level_id: StringName, _state: StringName) -> void:
	if hud != null:
		_apply_hud()
	if level_id == &"":
		return


func _on_camp_touched(camp_id: StringName, position: Vector2) -> void:
	if state == null:
		return
	var first := state.activate_camp(camp_id, position + Vector2(0, 12))
	var camp: OverworldCamp = camps.get(String(camp_id), null)
	if camp != null:
		camp.set_visited(true)
	_say("You rest at %s. Provisions restored." % (camp.camp_name if camp != null else "the camp"))
	if first:
		_apply_hud()


func _on_discovery_collected(discovery_id: StringName, _position: Vector2) -> void:
	if state == null:
		return
	var node: OverworldDiscovery = discoveries.get(String(discovery_id), null)
	if node != null and node.found:
		return
	var reward := state.collect_discovery(discovery_id)
	if node != null:
		node.set_found(true)
	if reward.is_empty():
		_say("Nothing left here.")
		return
	_grant_discovery_reward(discovery_id, reward)
	_say(_reward_text(reward))


func _grant_discovery_reward(discovery_id: StringName, reward: Dictionary) -> void:
	var save := _save_service()
	if save == null or not save.has_method(&"transact_once"):
		return
	var grant := reward.duplicate(true)
	# One-shot entitlement: the receipt key makes a second grant impossible even
	# if the player re-enters the cell, reloads, or replays the scene.
	save.call(&"transact_once", "overworld:discovery:%s" % String(discovery_id), func(candidate: Dictionary) -> bool:
		var currencies: Dictionary = (candidate.get("currencies", {}) as Dictionary).duplicate(true)
		for key: String in ["account", "hero_materials", "monster_fragments", "sigils"]:
			if grant.has(key):
				currencies[key] = int(currencies.get(key, 0)) + int(grant[key])
		candidate["currencies"] = currencies
		return true
	, {"kind": "overworld_discovery", "id": String(discovery_id)})


func _reward_text(reward: Dictionary) -> String:
	var parts: Array[String] = []
	if reward.has("account"):
		parts.append("+%d gold" % int(reward["account"]))
	if reward.has("hero_materials"):
		parts.append("+%d soul shard" % int(reward["hero_materials"]))
	if reward.has("monster_fragments"):
		parts.append("+%d fragment" % int(reward["monster_fragments"]))
	if reward.has("sigils"):
		parts.append("+%d sigil" % int(reward["sigils"]))
	if reward.has("restore"):
		parts.append("rested")
	if parts.is_empty():
		return "The place remembers you."
	return "Found: %s" % ", ".join(parts)


func _on_state_discovery(discovery_id: StringName) -> void:
	var node: OverworldDiscovery = discoveries.get(String(discovery_id), null)
	if node != null:
		node.set_found(true)


func _on_state_shortcut_opened(shortcut_id: StringName) -> void:
	if world != null:
		world.set_shortcut_open(String(shortcut_id), true)
	_apply_hud()


func _on_provisions_changed(_current: int, _maximum: int) -> void:
	_apply_hud()


func _on_state_saved(ok: bool) -> void:
	if not ok and hud != null:
		hud.show_prompt("The Marches could not record your progress — retrying.", 2.0)


func _connect_run_events() -> void:
	# A run that finishes while the overworld is still mounted (a very fast
	# return, or a future in-place dungeon host) should still unlock its
	# shortcut. The normal path is the AppFlow completion check at build time.
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"run_completion_ready"):
		if not events.is_connected(&"run_completion_ready", _on_run_completion_ready):
			events.connect(&"run_completion_ready", _on_run_completion_ready)


func _on_run_completion_ready(result: Dictionary, _options: Dictionary) -> void:
	var level_id := StringName(result.get("level_id", ""))
	if String(level_id).is_empty():
		return
	for raw: Variant in world_data.get("shortcuts", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		if StringName(entry.get("granted_by", "")) == level_id:
			var shortcut_id := StringName(entry.get("id", ""))
			if state.open_shortcut(shortcut_id):
				_say("The Marches open a new way: %s" % String(shortcut_id).replace("_", " "))


func _retreat_to_home() -> void:
	var flow := _app_flow()
	if flow == null:
		return
	state.save_now()
	if flow.has_method(&"clear_pending_overworld_return"):
		flow.call(&"clear_pending_overworld_return")
	flow.call(&"open_home", &"campaign")


func _exit_tree() -> void:
	if state != null:
		state.save_now()


# ---------------------------------------------------------------------------
# test / tooling surface
# ---------------------------------------------------------------------------
func walkable_at(position: Vector2) -> bool:
	return world != null and world.is_walkable(position)


func gate_for(level_id: StringName) -> OverworldGate:
	return gates.get(String(level_id), null)


func camp_for(camp_id: StringName) -> OverworldCamp:
	return camps.get(String(camp_id), null)


func discovery_for(discovery_id: StringName) -> OverworldDiscovery:
	return discoveries.get(String(discovery_id), null)


func interact_with(node: Node) -> bool:
	if node == null or not node.has_method(&"interact"):
		return false
	return bool(node.call(&"interact", player))


func teleport_to(position: Vector2) -> void:
	if is_instance_valid(player):
		player.global_position = position
		player.velocity = Vector2.ZERO
		if camera != null:
			camera.reset_smoothing()


func frame_count() -> int:
	return _frame_count
