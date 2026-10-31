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
const TRAVERSABILITY_SCRIPT := preload("res://game/overworld/overworld_traversability.gd")
const OCCLUSION_SCRIPT := preload("res://game/overworld/overworld_occlusion.gd")
const SURVIVAL_BUILD_SCRIPT := preload("res://game/survival/survival_build_system.gd")
const ECONOMY_SESSION_SCRIPT := preload("res://game/survival/economy/economy_session.gd")
const ECONOMY_COMPOSITION_SCRIPT := preload("res://game/survival/economy/a0_economy_composition.gd")
const ECONOMY_PANEL_SCRIPT := preload("res://game/survival/economy/economy_panel.gd")
const CHEST_PANEL_SCRIPT := preload("res://game/survival/chest_inventory_panel.gd")
const SURVIVAL_NODE_SCRIPT := preload("res://game/survival/survival_resource_node.gd")
const DEATH_BAG_SCRIPT := preload("res://game/survival/survival_death_bag.gd")
const SURVIVAL_RESOURCE_PLAN_PATH := "res://data/survival/hollow_marches_resources.json"
# Reversible candidate only. The default production route remains unchanged
# until native input/restart and owner gates are independently reviewed.
const WORLD_ART_CANDIDATE_SETTING := "survival/a0_world_art_candidate"
const A0_WORLD_ART_CANDIDATE := preload("res://game/survival/a0_world_art_candidate.gd")
## A0 Round 12 production threat (CT decision T1). Off by default; when on, it is
## the ONE way the survival world ever exposes an enemy.
const A0_THREAT_MOUNT := preload("res://game/survival/a0_threat_mount.gd")
const WAYSTATION_CANDIDATE_SETTING := "survival/a0_waystation_candidate"
const WAYSTATION_ROOT := "res://data/survival/connector/a0_candidate/"
const A0_WAYSTATION_GEOMETRY := preload("res://game/survival/waystation_geometry.gd")
const A0_WAYSTATION_HOST := preload("res://game/survival/waystation_host.gd")
const WAYSTATION_ASSET_PINS := {
	"annex_world.v1.json": "8883a224f05372f7ad3afa5317da82268e624acfc76f9891ba9fc24a22f6e1c6",
	"annex_layers.v1.json": "674643e862168ab52b00fe7f8038fcf6be8c6aa66cb6666c28ca752394ca2d00",
	"annex_props.v1.json": "dc80877a0425ceac546fbed2dcc352c14fb6548e67c346d9f1226ef914440cd2",
}

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
## Runtime walkability that includes prop bodies, and the fade that keeps the
## Knight visible behind architecture. Both are built from the live scene, not
## from the authored document, so they describe the world the player has.
var traversability: OverworldTraversability
var occlusion: OverworldOcclusion
## Endpoints the running world has sealed off. Empty is the only healthy value;
## the build reports here instead of silently shipping a walled-in dungeon door.
var traversability_failures: Array[Dictionary] = []

var survival_build: SurvivalBuildSystem
var economy_session: Node
var economy_composition: Node
var threat_mount: Node
var economy_panel: CanvasLayer
var chest_panel: CanvasLayer
var _death_bags: Dictionary = {}
var _death_bag_root: Node2D
var survival_nodes: Dictionary = {}  # node_id:String -> SurvivalResourceNode
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
	_ensure_prepare_work_binding()
	call_deferred(&"_build_world")


## A0-owned production binding. A6 owns presentation; this is the gameplay input
## that says "keep my paid work running while I am away". It is registered here,
## not in an A6 panel, so a missing panel cannot make preparation impossible.
const PREPARE_WORK_ACTION := &"prepare_work"

func _ensure_prepare_work_binding() -> void:
	if InputMap.has_action(PREPARE_WORK_ACTION):
		return
	InputMap.add_action(PREPARE_WORK_ACTION)
	var key := InputEventKey.new()
	key.physical_keycode = KEY_P
	InputMap.action_add_event(PREPARE_WORK_ACTION, key)


## One departure, three ordered SaveService steps, all through the composition's
## authoritative offline host:
##   1. settle the interval that ended now (active play is never re-settled),
##   2. mark the jobs the player actually paid for and left running as prepared,
##   3. stamp the departure again so the offline interval starts at this moment.
## Returns the exact report the world can show and a test can inspect.
func depart_world(now_unix: int = -1) -> Dictionary:
	var report := {"ok": false, "reason": "not_ready", "settle": {}, "prepared": {}, "stamp": {}, "persisted": false}
	if build_stage != BuildStage.READY or economy_composition == null or not is_instance_valid(economy_composition):
		return report
	var offline: Node = economy_composition.get(&"_offline") as Node
	if offline == null:
		report["reason"] = "offline_host_absent"
		return report
	var stamp := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())
	report["settle"] = offline.call(&"settle", stamp)
	if economy_session != null and is_instance_valid(economy_session):
		report["prepared"] = economy_session.call(&"prepare_work_away")
	report["stamp"] = offline.call(&"settle", stamp)
	# Leaving the world is the last thing this process does, so the departure must
	# be durable before the process can die. Relying on a later autosave would make
	# "close the game" and "the game lost my furnace" the same event.
	var save := get_node_or_null("/root/SaveService")
	if save != null and save.has_method(&"save_now"):
		report["persisted"] = bool(save.call(&"save_now"))
	else:
		report["persisted"] = false
	report["reason"] = ""
	report["ok"] = true
	return report


func _notification(what: int) -> void:
	# Closing the window is a normal exit, not a run end: it must leave the same
	# durable truth a quit-to-title does.
	if what == NOTIFICATION_WM_CLOSE_REQUEST and build_stage == BuildStage.READY:
		var departure := depart_world()
		print("A0_DEPARTURE ", JSON.stringify(departure))


func configure(payload: Dictionary) -> void:
	_pending_payload = payload.duplicate(true)
	_payload = payload.duplicate(true)
	if build_stage == BuildStage.READY:
		_apply_payload_spawn()


func is_world_ready() -> bool:
	return build_stage == BuildStage.READY


# The scene defaults to pinned legacy sources. A project-level candidate may
# explicitly select the bounded source; payloads and saves cannot select files.
func _waystation_candidate_enabled() -> bool:
	return bool(ProjectSettings.get_setting(WAYSTATION_CANDIDATE_SETTING, false))


func _world_source_paths() -> Dictionary:
	if _waystation_candidate_enabled():
		for name: String in WAYSTATION_ASSET_PINS:
			var path := WAYSTATION_ROOT + name
			if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != String(WAYSTATION_ASSET_PINS[name]):
				_fail("Waystation candidate source mismatch: " + name)
				return {}
		return {"world": WAYSTATION_ROOT + "annex_world.v1.json", "layers": WAYSTATION_ROOT + "annex_layers.v1.json", "props": WAYSTATION_ROOT + "annex_props.v1.json"}
	return {"world": WORLD_DATA_PATH, "layers": LAYERS_PATH, "props": PROPS_PATH}


func _mount_world_extensions() -> void:
	if not _waystation_candidate_enabled():
		return
	var result: Dictionary = A0_WAYSTATION_GEOMETRY.mount(world, WAYSTATION_ROOT + "slices/")
	if not bool(result.get("ok", false)):
		_fail("Waystation candidate geometry refused: " + String(result.get("reason", "unknown")))


func _build_world() -> void:
	if build_stage != BuildStage.IDLE:
		return
	build_stage = BuildStage.LOADING_DATA
	var sources := _world_source_paths()
	if build_stage == BuildStage.FAILED:
		return
	var world_path := String(sources.get("world", ""))
	var layers_path := String(sources.get("layers", ""))
	var props_path := String(sources.get("props", ""))
	world_data = _load_json(world_path)
	if world_data.is_empty():
		_fail("world document missing at %s" % world_path)
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
	if not world.build(world_data, layers_path, props_path, entities):
		_fail("world layers failed to paint")
		return
	_mount_world_extensions()
	if build_stage == BuildStage.FAILED:
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
	# Both systems read the finished scene, so they are built after progress is
	# restored: a shortcut the save had already opened must not be measured as a
	# closed wall.
	_build_traversability()
	_settle_spawn_on_walkable_ground()
	# Survival sits between traversability and occlusion on purpose: its resource
	# nodes and built structures carry collision, and the occlusion system has to
	# see them when it buckets occluders.
	_build_survival()
	if _waystation_candidate_enabled() and survival_build != null:
		survival_build.annex_disabled_from_x = 384
	_build_economy_session()
	_build_economy_composition()
	_build_occlusion()
	_build_hud()
	if _waystation_candidate_enabled():
		if economy_session == null:
			_fail("Waystation candidate requires the A3 economy session")
			return
		var candidate_host := A0_WAYSTATION_HOST.new()
		candidate_host.name = "WaystationRuntime"
		add_child(candidate_host)
		if not bool(candidate_host.call(&"configure", self, player, economy_session)):
			candidate_host.queue_free()
			_fail("Waystation candidate physical host refused")
			return
	# Separate opt-in A1 visual candidate: never silently reparent the Hero or
	# activate unrelated region art. Default remains OFF pending visual review.
	if bool(ProjectSettings.get_setting(WORLD_ART_CANDIDATE_SETTING, false)):
		if not _waystation_candidate_enabled():
			_fail("A1 roadside art candidate requires the guarded connector")
			return
		var art_result: Dictionary = A0_WORLD_ART_CANDIDATE.mount(self, player)
		if not bool(art_result.get("ok", false)):
			_fail("A1 roadside art candidate refused: " + String(art_result.get("reason", "unknown")))
			return
	_mount_optional_threat()
	_build_economy_panel()
	chest_panel = CHEST_PANEL_SCRIPT.new()
	chest_panel.name = "ChestInventoryPanel"
	add_child(chest_panel)
	_connect_run_events()
	_apply_hud()
	build_stage = BuildStage.READY
	world_ready.emit()
	# A death interrupted after its save commit must resume the death screen,
	# not grant a free life or create a second bag.
	var survival := get_node_or_null("/root/SurvivalService")
	if survival != null and not String((survival.call(&"document") as Dictionary).get("pending_death", "")).is_empty():
		player.call(&"_die")


func _build_economy_session() -> void:
	var save := get_node_or_null("/root/SaveService")
	var survival := get_node_or_null("/root/SurvivalService")
	if save == null or survival == null or survival_build == null:
		return
	economy_session = ECONOMY_SESSION_SCRIPT.new()
	economy_session.name = "EconomySession"
	add_child(economy_session)
	if not bool(economy_session.call(&"configure", save, survival, self, survival_build, player)):
		push_warning("Economy session unavailable; crafting remains disabled.")
		economy_session.queue_free()
		economy_session = null


## A0 composition root: run lifecycle, A3 V7 profile port and offline
## settlement, all bound to this live world. It is opt-in only in the sense that
## a world without a configured A3 session cannot host it; a world WITH the
## session must have it, or the player would be able to play a run that has no
## durable identity.
func _build_economy_composition() -> void:
	if economy_session == null:
		return
	var composition := ECONOMY_COMPOSITION_SCRIPT.new()
	composition.name = "EconomyComposition"
	add_child(composition)
	if not bool(composition.call(&"configure", self, player, economy_session)):
		push_error("A0 economy composition refused: " + String(composition.get("last_error")))
		composition.queue_free()
		return
	economy_composition = composition


## A0 WP-A0.3: the guarded production threat. Placement is validated against the
## live world by the encounter seam itself; a refusal is a build failure, never a
## silent "no danger today", so a player can never be told one thing while the
## world holds another.
func _mount_optional_threat() -> void:
	var mount := A0_THREAT_MOUNT.new()
	mount.name = "A0ThreatMount"
	add_child(mount)
	var report: Dictionary = mount.call(&"mount", self, player, traversability, survival_build)
	threat_mount = mount
	if not bool(report.get("enabled", false)):
		return
	if not bool(report.get("mounted", false)):
		_fail("A0 production threat refused: " + str(report.get("last_error", "unknown")))


func _build_economy_panel() -> void:
	if economy_session == null:
		return
	economy_panel = ECONOMY_PANEL_SCRIPT.new()
	economy_panel.name = "EconomyPanel"
	add_child(economy_panel)
	economy_panel.call(&"configure", economy_session)


func _build_traversability() -> void:
	traversability = TRAVERSABILITY_SCRIPT.new() as OverworldTraversability
	traversability.build(world)
	traversability_failures = traversability.unreachable_endpoints(world_data)
	if traversability_failures.is_empty():
		return
	var parts: Array[String] = []
	for failure: Dictionary in traversability_failures:
		parts.append("%s (%s at %s, nearest reachable %d tiles)" % [
			str(failure.get("id", "?")), str(failure.get("kind", "?")),
			str(failure.get("cell", "?")), int(failure.get("near", -1)),
		])
	push_error("Overworld: the built world seals off %d endpoint(s): %s"
		% [traversability_failures.size(), "; ".join(parts)])


func _settle_spawn_on_walkable_ground() -> void:
	# The authored spawn is a *place*, not a standable cell: at the Ashen Refuge it
	# is the middle of the cooking ground, and a tent body covers it. A fresh
	# character therefore used to start inside a wall and be pushed out by physics
	# on the first frame. Now the traversability grid — which is the only thing
	# that knows about prop bodies — resolves the point before the player moves.
	if traversability == null or player == null:
		return
	var cell := traversability.cell_of(player.position)
	if traversability.is_free(cell):
		return
	var resolved := traversability.nearest_free_position(player.position, 12)
	push_warning("Overworld: spawn cell %s is blocked by a prop body; the player starts at %s instead"
		% [str(cell), str(traversability.cell_of(resolved))])
	player.position = resolved
	if camera != null:
		camera.reset_smoothing()


func _build_survival() -> void:
	# Resource nodes come from an authored plan, not a random scatter: each entry
	# is a real world cell next to a real route, so a player walking the marches
	# meets timber where there are trees and stone where there is rock. The plan
	# is data (data/survival/hollow_marches_resources.json) so A1 can replace it
	# with the continent's ecology without touching this file.
	var root := _ensure_node("Resources")
	var plan := _load_json(SURVIVAL_RESOURCE_PLAN_PATH)
	for raw: Variant in plan.get("nodes", []):
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var cell: Array = entry.get("cell", [])
		if cell.size() < 2:
			continue
		var cell_value := Vector2i(int(cell[0]), int(cell[1]))
		var kind := String(entry.get("kind", ""))
		var node_id := SurvivalStateData.resource_node_id(kind, cell_value)
		var node := SURVIVAL_NODE_SCRIPT.new() as SurvivalResourceNode
		node.name = "Res_%s" % node_id.replace("@", "_").replace(",", "_")
		node.node_id = node_id
		node.resource_kind = kind
		var svc := get_node_or_null("/root/SurvivalService")
		if svc != null:
			node.display_name = String(
				(svc.call(&"resource_definition", kind) as Dictionary).get("label", kind))
		node.position = Vector2(cell_value.x * 16 + 8, cell_value.y * 16 + 8)
		root.add_child(node)
		survival_nodes[node_id] = node

	survival_build = SURVIVAL_BUILD_SCRIPT.new() as SurvivalBuildSystem
	survival_build.name = "SurvivalBuild"
	add_child(survival_build)
	survival_build.configure(world, player, camera, state)
	_death_bag_root = Node2D.new()
	_death_bag_root.name = "DeathBags"
	add_child(_death_bag_root)
	_sync_death_bags()
	var svc2 := get_node_or_null("/root/SurvivalService")
	if svc2 != null and svc2.has_signal(&"survival_state_changed"):
		svc2.connect(&"survival_state_changed", _on_survival_state_changed)


func _on_survival_state_changed() -> void:
	# A reconcile, not a rebuild: this signal fires on every harvest and every
	# container transfer, and tearing the whole structure layer down each time
	# would destroy colliders the player is standing against.
	if survival_build != null and is_instance_valid(survival_build):
		survival_build.reconcile_from_save()
	_sync_death_bags()
	# Only the node that changed needs to re-read its own state, but the signal
	# carries no identity — a chain of harvests is short, and refreshing the plan
	# costs one dictionary lookup per node against a document already in memory.
	for node_id: String in survival_nodes:
		var node: SurvivalResourceNode = survival_nodes[node_id]
		if is_instance_valid(node):
			node.refresh()


func _sync_death_bags() -> void:
	if _death_bag_root == null or not is_instance_valid(_death_bag_root):
		return
	var svc := get_node_or_null("/root/SurvivalService")
	if svc == null:
		return
	var bags: Dictionary = (svc.call(&"document") as Dictionary).get("death_bags", {})
	for key: Variant in _death_bags.keys():
		if not bags.has(key):
			var old: Node = _death_bags[key]
			_death_bags.erase(key)
			if is_instance_valid(old):
				old.queue_free()
	for key: Variant in bags.keys():
		if _death_bags.has(key) or not bags[key] is Dictionary:
			continue
		var record: Dictionary = bags[key]
		var coords: Variant = record.get("position", [])
		if String(record.get("region", "")) != "hollow_marches" or not coords is Array or coords.size() != 2:
			continue
		var node := DEATH_BAG_SCRIPT.new()
		node.entity_id = String(key)
		node.position = Vector2(float(coords[0]), float(coords[1]))
		_death_bag_root.add_child(node)
		_death_bags[key] = node


func survival_node(node_id: String) -> SurvivalResourceNode:
	return survival_nodes.get(node_id, null)


## The survival slice's test surface: one call that answers "what is actually in
## the running world right now" without reaching into private state.
func survival_status() -> Dictionary:
	var svc := get_node_or_null("/root/SurvivalService")
	var document: Dictionary = svc.call(&"document") if svc != null else {}
	return {
		"nodes": survival_nodes.size(),
		"structures": survival_build.placed_count() if survival_build != null else 0,
		"document_structures": (document.get("structures", {}) as Dictionary).size(),
		"build_active": survival_build.active if survival_build != null else false,
	}


func _build_occlusion() -> void:
	occlusion = OCCLUSION_SCRIPT.new() as OverworldOcclusion
	occlusion.name = "Occlusion"
	add_child(occlusion)
	occlusion.configure(world, player)


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
	hud.respawn_requested.connect(_respawn_overworld_hero)


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
	# Prop bodies are walls too, and the terrain grid does not know about them:
	# asking only `world.is_walkable()` is how a return point ends up inside a
	# camp tent.
	if traversability != null:
		var free := traversability.nearest_free_position(origin, 20)
		if world.is_walkable(free):
			return free
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
# Opt-in bounded debug probe; samples this node's process chain only, not GPU,
# other nodes, or complete frame time. Disabled in ordinary gameplay.
var _perf_trace_enabled := false
var _perf_trace_usec: Array[int] = []

func _begin_perf_trace() -> void:
	if OS.is_debug_build():
		_perf_trace_usec.clear()
		_perf_trace_enabled = true

func _end_perf_trace() -> Array[int]:
	_perf_trace_enabled = false
	return _perf_trace_usec.duplicate()

func _process(delta: float) -> void:
	_frame_count += 1
	if build_stage != BuildStage.READY:
		return
	if state == null or not is_instance_valid(player):
		return
	var perf_start := Time.get_ticks_usec() if _perf_trace_enabled else 0
	if not bool(player.get(&"dead")):
		state.set_world_position(player.global_position)
	if occlusion != null and is_instance_valid(occlusion):
		occlusion.step(delta)
	var hazard := _in_hazard(player.global_position)
	var safe := _in_camp_radius(player.global_position)
	state.tick(delta, hazard, safe)
	_apply_fatigue()
	_apply_hud()
	_handle_survival_input()
	if _perf_trace_enabled and _perf_trace_usec.size() < 240:
		_perf_trace_usec.append(Time.get_ticks_usec() - perf_start)


# Cancellation follows Godot's event dispatch instead of polling Input. A modal
# that consumes Escape cannot also cause a retreat, and one Escape closes build
# mode rather than both closing it and returning to the Sanctum.
func _unhandled_input(event: InputEvent) -> void:
	if event.is_echo():
		return
	if event.is_action_pressed(&"storage_toggle") and chest_panel != null and is_instance_valid(player) and not bool(player.get(&"dead")):
		if bool(chest_panel.call(&"is_open")):
			chest_panel.call(&"close_panel")
		elif not _has_gameplay_modal() and _world_action_allowed(&"storage_toggle"):
			var nearest: SurvivalStructure = null
			var nearest_distance := SurvivalStructure.REACH
			for value: Variant in survival_build._placed.values():
				var candidate := value as SurvivalStructure
				if not is_instance_valid(candidate) or candidate.piece_id != SurvivalStructure.PIECE_CHEST:
					continue
				var distance := candidate.global_position.distance_to(player.global_position)
				if distance <= nearest_distance:
					nearest = candidate
					nearest_distance = distance
			if nearest != null:
				if survival_build.active:
					survival_build.set_active(false)
				chest_panel.call(&"open_chest", nearest, player, get_node_or_null("/root/SurvivalService"))
			elif hud != null:
				hud.show_prompt("Stand near a chest to choose items.", 2.0)
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed(&"economy_toggle") and economy_panel != null and not bool(player.get(&"dead")):
		# A different visible modal owns input; do not stack a crafting panel on
		# top of it. Closing our own panel remains available with the same key.
		if _has_gameplay_modal() and not bool(economy_panel.call(&"is_open")):
			get_viewport().set_input_as_handled()
			return
		if survival_build != null and survival_build.active:
			survival_build.set_active(false)
		economy_panel.call(&"toggle")
		get_viewport().set_input_as_handled()
		return
	if not (event.is_action_pressed(&"pause") or event.is_action_pressed(&"ui_cancel")):
		return
	if (event.is_action_pressed(&"pause") and not _world_action_allowed(&"pause")) \
			or (event.is_action_pressed(&"ui_cancel") and not _world_action_allowed(&"ui_cancel")):
		get_viewport().set_input_as_handled()
		return
	if build_stage != BuildStage.READY:
		return
	if _has_gameplay_modal():
		get_viewport().set_input_as_handled()
		return
	if survival_build != null and is_instance_valid(survival_build) and survival_build.active:
		survival_build.set_active(false)
	else:
		_retreat_to_home()
	get_viewport().set_input_as_handled()


# A6 modal roots must join this group while visible; merely consuming mouse GUI
# events is insufficient because build placement is polled from Input.
## Physically nearest paid station, by the same reach the build system uses. A
## station the player cannot stand next to cannot be prepared.
func _prepare_work_at_nearest_station() -> void:
	if economy_session == null or not is_instance_valid(economy_session) or survival_build == null:
		return
	var nearest := ""
	var nearest_distance := 99999.0
	for value: Variant in survival_build._placed.values():
		var structure := value as SurvivalStructure
		if structure == null or not is_instance_valid(structure) or not structure.piece_id.begins_with("station_"):
			continue
		var distance := structure.global_position.distance_to(player.global_position)
		if distance <= SurvivalStructure.REACH and distance < nearest_distance:
			nearest = String(structure.entity_id)
			nearest_distance = distance
	if nearest.is_empty():
		_say("Stand at a workstation to keep its work running while you are away.")
		return
	var report: Dictionary = economy_session.call(&"prepare_work_away", nearest)
	if bool(report.get("ok", false)):
		var jobs: Array = report.get("prepared", [])
		_say("Prepared %d job(s) to run while you are away." % jobs.size())
	else:
		var reason := String(report.get("reason", ""))
		if reason == "nothing_in_progress":
			_say("Nothing is being made here yet.")
		elif reason == "already_prepared":
			_say("That work is already prepared.")
		else:
			_say("Could not prepare that work (%s)." % reason)


func _has_gameplay_modal() -> bool:
	for node: Node in get_tree().get_nodes_in_group(&"gameplay_modal"):
		if node is CanvasItem and (node as CanvasItem).is_visible_in_tree():
			return true
	return false


func _world_action_allowed(action: StringName) -> bool:
	return player == null or not is_instance_valid(player) or not player.has_method(&"gameplay_input_allowed") \
		or bool(player.call(&"gameplay_input_allowed", action))


func _world_action_just_pressed(action: StringName) -> bool:
	return _world_action_allowed(action) and Input.is_action_just_pressed(action)


## Build-mode input. Deliberately a small, self-contained block: survival does not
## touch the Knight's combat bindings, and the modal build tool is enterable and
## leavable with one key so an accidental press cannot trap the player.
func _handle_survival_input() -> void:
	if _world_action_just_pressed(PREPARE_WORK_ACTION) and not bool(player.get(&"dead")):
		_prepare_work_at_nearest_station()
		return
	if survival_build == null or not is_instance_valid(survival_build) or _has_gameplay_modal():
		return
	if _world_action_just_pressed(&"build_toggle"):
		survival_build.set_active(not survival_build.active)
		_say("Build: %s" % survival_build.selected_piece.replace("_", " ")
			if survival_build.active else "Build closed")
		return
	if not survival_build.active:
		return
	for index: int in SurvivalBuildSystem.BUILD_SLOTS.size():
		if _world_action_just_pressed(&"build_slot_%d" % (index + 1)):
			var ids: Array[String] = SurvivalBuildSystem.BUILD_SLOTS
			if index < ids.size() and survival_build.select_piece(ids[index]):
				_say("Build: %s — %s" % [
					ids[index].replace("_", " "), survival_build.cost_summary(ids[index])])
				return
	if _world_action_just_pressed(&"build_place"):
		var hovered := get_viewport().gui_get_hovered_control()
		if hovered != null and hovered.is_visible_in_tree() and hovered.mouse_filter != Control.MOUSE_FILTER_IGNORE \
				and not survival_build.is_build_click_blocker(hovered):
			return
		var result := survival_build.try_place(survival_build.preview_cell())
		if bool(result.get("ok", false)):
			_say("Built %s." % survival_build.selected_piece.replace("_", " "))
		else:
			_say(_build_rejection_message(String(result.get("reason", "rejected"))))


func _build_rejection_message(reason: String) -> String:
	match reason:
		"cannot_afford":
			return "Not enough materials."
		"on_route", "protected_place", "near_shortcut":
			return "That ground is part of the road."
		"solid_terrain", "water":
			return "You cannot build there."
		"out_of_range":
			return "Too far away."
		"cell_occupied":
			return "Something is already there."
		"not_configured":
			return "The ground here is not ready yet."
		"no_hero_exit", "exit_check_limit":
			return "Leave yourself a clear door and exit."
		"hero_in_footprint":
			return "Move clear before building there."
		"duplicate_or_failed":
			return "The build could not be recorded."
		_:
			return "You cannot build there."


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


## Resource-node descendants discover this host via their ancestor chain.
## Keep harvest success and full-pack feedback on the existing overworld HUD.
func show_prompt(text: String, seconds := 3.0) -> void:
	if hud != null:
		hud.show_prompt(text, seconds)


func _say(text: String) -> void:
	show_prompt(text)
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
	# The shortcut just changed the walls: re-read them so the traversability
	# answer keeps matching the world the player is walking through.
	if traversability != null:
		traversability.invalidate()
	_apply_hud()


func _on_provisions_changed(_current: int, _maximum: int) -> void:
	_apply_hud()


func _on_state_saved(ok: bool) -> void:
	if not ok and hud != null:
		hud.show_prompt("The Marches could not record your progress — retrying.", 2.0)


func _connect_run_events() -> void:
	var death_events := get_node_or_null("/root/GameEvents")
	if death_events != null and not death_events.is_connected(&"player_died", _on_overworld_hero_died):
		death_events.connect(&"player_died", _on_overworld_hero_died)
	# A run that finishes while the overworld is still mounted (a very fast
	# return, or a future in-place dungeon host) should still unlock its
	# shortcut. The normal path is the AppFlow completion check at build time.
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"run_completion_ready"):
		if not events.is_connected(&"run_completion_ready", _on_run_completion_ready):
			events.connect(&"run_completion_ready", _on_run_completion_ready)


func _on_overworld_hero_died() -> void:
	# The signal is global. Only the Hero belonging to this live world is ours;
	# a dungeon's own Hero and checkpoint remain entirely under dungeon control.
	if not is_instance_valid(player) or not bool(player.get(&"dead")) or build_stage != BuildStage.READY:
		return
	if survival_build != null:
		survival_build.set_active(false)
	if economy_panel != null:
		economy_panel.call(&"close_panel")
	if chest_panel != null:
		chest_panel.call(&"close_panel")
	if state != null:
		state.save_now()
	var svc := get_node_or_null("/root/SurvivalService")
	var recorded := false
	if svc != null:
		recorded = bool((svc.call(&"begin_overworld_death", player.global_position) as Dictionary).get("ok", false))
	if hud != null:
		hud.show_death("You fell in the Hollow Marches. Choose respawn." if recorded else "Could not save your death bag. Retry respawn to save again.")
	get_tree().paused = true


# Fail closed instead of reviving into a wall. The static camp graph gives an
# ordered search center; the live Hero shape checks every candidate, and a local
# flood rejects sealed-off spots. No random choice or world-sized per-frame scan.
func _fallback_has_escape(start: Vector2i) -> bool:
	var pending: Array[Vector2i] = [start]
	var seen: Dictionary = {start: true}
	var cursor := 0
	while cursor < pending.size() and cursor < 2048:
		var cell: Vector2i = pending[cursor]
		cursor += 1
		# Protected route cells cannot legally be blocked by construction. Reaching
		# one is stronger than merely finding several cells in a dead-end pocket.
		if survival_build._on_route_detail(cell):
			return true
		for step: Vector2i in [Vector2i.UP, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.DOWN]:
			var next := cell + step
			if seen.has(next):
				continue
			seen[next] = true
			if survival_build.room_topology.room_at(next).is_empty() and survival_build._wake_cell_clear(next):
				pending.append(next)
	return false


func _resolve_overworld_respawn() -> Dictionary:
	if survival_build == null or not is_instance_valid(survival_build):
		return {"ok": false, "reason": "world_not_ready"}
	var svc := get_node_or_null("/root/SurvivalService")
	if svc != null:
		var doc: Dictionary = svc.call(&"document")
		var bed_id := String(doc.get("spawn_anchor", ""))
		if not bed_id.is_empty():
			var wake: Dictionary = survival_build.bed_wake_position(bed_id)
			if bool(wake.get("ok", false)):
				wake["source"] = "bed"
				return wake
	var centers: Array[Vector2] = []
	var camp := camps.get(String(state.last_camp_id), null) as OverworldCamp if state != null else null
	if camp != null and is_instance_valid(camp):
		centers.append(camp.rest_position())
	centers.append(_authored_spawn())
	for centre: Vector2 in centers:
		var base := world.tile_of(centre)
		for ring in range(0, 33):
			for dy in range(-ring, ring + 1):
				for dx in range(-ring, ring + 1):
					if maxi(absi(dx), absi(dy)) != ring:
						continue
					var cell := base + Vector2i(dx, dy)
					if not survival_build.room_topology.room_at(cell).is_empty() or not survival_build._wake_cell_clear(cell):
						continue
					if _fallback_has_escape(cell):
						return {"ok": true, "position": Vector2(cell.x * 16 + 8, cell.y * 16 + 15), "source": "camp"}
	return {"ok": false, "reason": "no_safe_fallback"}


func _respawn_overworld_hero() -> bool:
	if not is_instance_valid(player) or not bool(player.get(&"dead")):
		return false
	var svc := get_node_or_null("/root/SurvivalService")
	if svc == null or not bool((svc.call(&"begin_overworld_death", player.global_position) as Dictionary).get("ok", false)):
		if hud != null:
			hud.show_death("Could not save your death bag. Please retry.")
		return false
	var destination := _resolve_overworld_respawn()
	if not bool(destination.get("ok", false)):
		if hud != null:
			hud.show_death("No safe respawn point is currently available.")
		return false
	if not bool(svc.call(&"finish_overworld_death", destination["position"])):
		if hud != null:
			hud.show_death("Could not save respawn. Please retry.")
		return false
	player.call(&"respawn", destination["position"])
	if state != null:
		state.set_world_position(player.global_position, true)
	if hud != null:
		hud.hide_death()
	get_tree().paused = false
	_say("Returned to your bed." if String(destination.get("source", "")) == "bed" else "Returned to a safe camp.")
	return true


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
