extends Node2D
## Chapter 1 — The Hollow Marches overworld.
## A standalone explorable region between Home and the existing campaign dungeons.

const TILE := 16
const WORLD_DATA_PATH := "res://data/overworld/hollow_marches.json"
const LANDMARK_REGISTRY_PATH := "res://data/overworld/landmark_registry.json"
const GATE_SCENE := preload("res://game/overworld/overworld_gate.tscn")
const CAMP_SCENE := preload("res://game/overworld/overworld_camp.tscn")
const DISCOVERY_SCENE := preload("res://game/overworld/overworld_discovery.tscn")
const KNIGHT_SCENE := preload("res://game/characters/knight/knight.tscn")

@onready var tint: CanvasModulate = $CanvasTint
@onready var layers: Node2D = $Layers
@onready var ground: TileMapLayer = $Layers/Ground
@onready var decor: TileMapLayer = $Layers/Decor
@onready var collision: TileMapLayer = $Layers/Collision
@onready var landmark_root: Node2D = $Landmarks
@onready var entities_root: Node2D = $Entities
@onready var props_root: Node2D = $Props
@onready var interact_root: Node2D = $Interactables
@onready var player: CharacterBody2D
@onready var camera: Camera2D
@onready var hud: CanvasLayer = $HUD
@onready var hud_label: Label = $HUD/TopLabel
@onready var prompt_label: Label = $HUD/PromptLabel

var world_data: Dictionary = {}
var landmark_registry: Dictionary = {}
var painter: OverworldPainter
var state: OverworldState
var _world_bounds_pixel: Rect2
var _return_data: Dictionary = {}
var build_stage: int = 0   # 0=not started, increments through _build_world for CI diagnostics


func _ready() -> void:
	# World build is deferred so the rest of the scene tree (HUD, Layers,
	# Camera2D that Knight adds under itself, autoloads like HeroSoulManager,
	# InputBootstrap, SaveService) has fully entered the tree before we
	# instantiate the knight and wire signals. Scene tests must pump frames
	# until build_stage == 99 (world ready).
	build_stage = 0
	call_deferred("_build_world")


func _build_world() -> void:
	push_print("OW_BUILD start")
	push_print("OW_BUILD stage=1 load_json")
	world_data = _load_json(WORLD_DATA_PATH)
	landmark_registry = _load_json(LANDMARK_REGISTRY_PATH)
	build_stage = 1
	push_print("OW_BUILD stage=2 painter.paint")
	painter = OverworldPainter.new()
	painter.paint(world_data, layers)
	build_stage = 2
	push_print("OW_BUILD stage=3 state")
	state = OverworldState.new()
	state.name = "OverworldState"
	add_child(state)
	var start_px := _refuge_spawn_pixel()
	state.configure(world_data, start_px, &"camp_refuge")
	_world_bounds_pixel = Rect2(
		0, 0,
		float(int(world_data.get("world_bounds", {}).get("w", 384))) * TILE,
		float(int(world_data.get("world_bounds", {}).get("h", 256))) * TILE,
	)
	build_stage = 3
	push_print("OW_BUILD stage=4 tint+spawn_player")
	_tint()
	_spawn_player()
	build_stage = 4
	push_print("OW_BUILD stage=5 setup_camera")
	_setup_camera()
	build_stage = 5
	push_print("OW_BUILD stage=6 spawn landmarks/camps/discoveries")
	_spawn_landmarks()
	_spawn_camps()
	_spawn_discoveries()
	build_stage = 6
	push_print("OW_BUILD stage=7 connect/hud/shortcuts")
	_connect_app_flow()
	_apply_all_open_shortcuts()
	_hud_refresh()
	state.provisions_changed.connect(func(_c, _m): _hud_refresh())
	state.discovery_found.connect(func(_id): _hud_refresh())
	state.shortcut_opened.connect(func(_id): _apply_shortcut(_id); _hud_refresh())
	get_tree().paused = false
	build_stage = 99
	push_print("OW_BUILD stage=99 complete")


func _process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	state.set_world_position(player.global_position)
	var in_safe := _in_camp_radius(player.global_position)
	var in_hazard := _in_hazard(player.global_position)
	state.drain_provisions(delta, in_hazard, in_safe)
	if Input.is_action_just_pressed("ui_cancel") and not get_tree().paused:
		var app_flow := get_node_or_null("/root/AppFlow")
		if app_flow != null and app_flow.has_method("open_home"):
			# Explicit player retreat to Home; clear pending return so completion
			# routes don't bounce back to the overworld.
			if app_flow.has_method("clear_pending_overworld_return"):
				app_flow.call("clear_pending_overworld_return")
			app_flow.call("open_home")


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var text := f.get_as_text(); f.close()
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}


func _refuge_spawn_pixel() -> Vector2:
	var ref: Dictionary = world_data.get("refuge", {})
	var p: Array = ref.get("pos", [56, 216])
	return Vector2(float(p[0]) * TILE + 8.0, float(p[1]) * TILE + 8.0)


func _tint() -> void:
	var t: Array = world_data.get("default_tint", [1, 1, 1, 1])
	if t.size() >= 3:
		tint.color = Color(float(t[0]), float(t[1]), float(t[2]), float(t[3]) if t.size() >= 4 else 1.0)


func _spawn_player() -> void:
	# Reuse the production Knight prefab (same controller/animations/HUD hooks).
	# Use the preloaded constant so knight dependencies are resolved at parse
	# time, not dynamically during _ready.
	var knight_packed: PackedScene = KNIGHT_SCENE
	if knight_packed == null:
		push_error("Overworld could not load Knight scene.")
		return
	player = knight_packed.instantiate() as CharacterBody2D
	player.name = "Player"
	player.global_position = state.get_spawn_position()
	entities_root.add_child(player)
	player.set_meta("overworld_controlled", true)


func _setup_camera() -> void:
	camera = player.get_node_or_null("Camera") as Camera2D
	if camera == null:
		camera = Camera2D.new()
		camera.name = "Camera"
		player.add_child(camera)
	camera.zoom = Vector2(2.0, 2.0)
	camera.smoothing_enabled = true
	camera.position_smoothing_speed = 10.0
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = int(_world_bounds_pixel.end.x)
	camera.limit_bottom = int(_world_bounds_pixel.end.y)
	camera.make_current()


func _spawn_landmarks() -> void:
	for lm: Dictionary in world_data.get("landmarks", []):
		var gate: OverworldGate = GATE_SCENE.instantiate() as OverworldGate
		gate.name = "Gate_" + String(lm.get("id", "x"))
		gate.level_id = StringName(lm.get("campaign_level_id", ""))
		gate.world_id = StringName(lm.get("id", ""))
		gate.display_name = String(lm.get("title", ""))
		gate.requires_shortcut = StringName(lm.get("requires_shortcut", ""))
		var p: Array = lm.get("pos", [0, 0])
		gate.position = Vector2(float(p[0]) * TILE + 8.0, float(p[1]) * TILE + 8.0)
		landmark_root.add_child(gate)
		gate.gate_interacted.connect(_on_gate_interacted)
		var arch := _make_landmark_sprite(String(lm.get("visual", "generic_entry")))
		arch.position = Vector2(0, -18)
		gate.add_child(arch)
		# NOTE: gate.refresh() calls AppFlow.is_campaign_level_unlocked which
		# reads save data and CAMPAIGN_REGISTRY during spawn; defer it one idle
		# frame so the parent scene has finished entering the tree.
		call_deferred(gate.refresh)


func _make_landmark_sprite(visual_id: String) -> Node2D:
	# Silhouette marker drawn with Polygon2D to give each landmark a distinct shape
	# at gameplay scale without requiring external PNGs.
	var poly := Polygon2D.new()
	poly.color = _visual_color(visual_id)
	match visual_id:
		"crypt_entry":
			poly.polygon = PackedVector2Array(-10,-8, 10,-8, 10,8, -10,8)
		"ossuary_entry":
			poly.polygon = PackedVector2Array(-12,-10, 12,-10, 8,10, -8,10)
		"archive_entry":
			poly.polygon = PackedVector2Array(-14,-8, 14,-8, 14,6, -14,6)
		"shrine_entry":
			poly.polygon = PackedVector2Array(-8,-14, 8,-14, 10,10, -10,10)
		"crucible_entry":
			poly.polygon = PackedVector2Array(-14,-4, 14,-4, 12,12, -12,12)
			poly.color = Color(0.6, 0.15, 0.15)
		"relay_entry":
			poly.polygon = PackedVector2Array(-6,-16, 6,-16, 8,10, -8,10)
			poly.color = Color(0.4, 0.8, 0.8)
		"beacon_entry":
			poly.polygon = PackedVector2Array(-6,-18, 6,-18, 6,10, -6,10)
			poly.color = Color(0.9, 0.55, 0.2)
		"divided_entry":
			poly.polygon = PackedVector2Array(-12,-12, 12,-12, 12,10, -12,10)
			poly.color = Color(0.5, 0.45, 0.8)
		"gate_entry":
			poly.polygon = PackedVector2Array(-14,-16, 14,-16, 14,8, -14,8)
			poly.color = Color(0.65, 0.1, 0.2)
		"citadel_entry":
			poly.polygon = PackedVector2Array(-16,-18, 16,-18, 16,10, -16,10)
			poly.color = Color(0.75, 0.15, 0.35)
		_:
			poly.polygon = PackedVector2Array(-8,-10, 8,-10, 8,8, -8,8)
	var outline := Polygon2D.new()
	outline.color = Color(0.05, 0.03, 0.08, 0.9)
	var outline_points := PackedVector2Array()
	for p: Vector2 in poly.polygon:
		outline_points.append(Vector2(p.x, p.y + 2.0))
	outline.polygon = outline_points
	var n := Node2D.new()
	n.add_child(outline)
	n.add_child(poly)
	return n


func _visual_color(_id: String) -> Color:
	return Color(0.55, 0.5, 0.45)


func _spawn_camps() -> void:
	for camp: Dictionary in world_data.get("camps", []):
		var node = CAMP_SCENE.instantiate()
		node.name = "Camp_" + String(camp.get("id"))
		node.camp_id = StringName(camp.get("id"))
		node.camp_name = String(camp.get("name", "Camp"))
		var p: Array = camp.get("pos", [0, 0])
		node.position = Vector2(float(p[0]) * TILE + 8.0, float(p[1]) * TILE + 8.0)
		node.camp_activated.connect(_on_camp_activated)
		props_root.add_child(node)


func _spawn_discoveries() -> void:
	for d: Dictionary in world_data.get("discoveries", []):
		var node = DISCOVERY_SCENE.instantiate()
		node.discovery_id = StringName(d.get("id"))
		node.kind = String(d.get("kind", "coin_cache"))
		var p: Array = d.get("pos", [0, 0])
		node.position = Vector2(float(p[0]) * TILE + 8.0, float(p[1]) * TILE + 8.0)
		node.discovery_collected.connect(_on_discovery_collected)
		interact_root.add_child(node)


func _connect_app_flow() -> void:
	# Listen for run completion so we can grant shortcuts that are awarded by a
	# completed level. Routing back to the overworld is handled by the player
	# clicking "Return to Marches" on the completion screen, via AppFlow.
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal("run_completion_ready"):
		if not events.run_completion_ready.is_connected(_on_run_completion_ready):
			events.run_completion_ready.connect(_on_run_completion_ready)


func _on_gate_interacted(_gate: Area2D, level_id: StringName, world_id: StringName) -> void:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow == null:
		return
	# Shortcut gating: if landmark prereq shortcut is closed, refuse.
	var lm := _find_landmark_by_id(world_id)
	var shortcut_req := StringName(lm.get("requires_shortcut", "")) if lm != null else &""
	if shortcut_req != &"" and not state.is_shortcut_open(shortcut_req):
		_show_prompt("The route is blocked. (%s)" % shortcut_req)
		return
	# Verify unlock through AppFlow.
	if app_flow.has_method("is_campaign_level_unlocked") \
			and not bool(app_flow.call("is_campaign_level_unlocked", level_id)):
		_show_prompt("You have not yet earned entry to this place.")
		return
	state.record_level_entry(level_id)
	# Remember where to return; tell AppFlow to offer "Return to Marches" on the
	# completion/abort screen instead of "Return Home".
	_return_data = {
		"level_id": String(level_id),
		"return_pos": player.global_position,
		"world_id": String(world_id),
		"last_camp": String(state.get_last_camp_id()),
	}
	if app_flow.has_method("set_pending_overworld_return"):
		app_flow.call("set_pending_overworld_return", _return_data.duplicate(true))
	app_flow.call("start_campaign_level", level_id)


func _on_camp_activated(camp_id: StringName, position: Vector2) -> void:
	state.activate_camp(camp_id, position)
	_show_prompt("You rest at the camp. Provisions restored.")


func _on_discovery_collected(discovery_id: StringName, position: Vector2) -> void:
	var reward := state.collect_discovery(discovery_id)
	if reward.is_empty():
		return
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method("transact_once"):
		return
	var grant := reward.duplicate(true)
	save.call("transact_once", "overworld:discovery:%s" % discovery_id, func(c: Dictionary) -> bool:
		var currencies: Dictionary = (c.get("currencies", {}) as Dictionary).duplicate(true)
		if grant.has("account"):
			currencies["account"] = int(currencies.get("account", 0)) + int(grant["account"])
		if grant.has("hero_materials"):
			currencies["hero_materials"] = int(currencies.get("hero_materials", 0)) + int(grant["hero_materials"])
		if grant.has("monster_fragments"):
			currencies["monster_fragments"] = int(currencies.get("monster_fragments", 0)) + int(grant["monster_fragments"])
		c["currencies"] = currencies
		return true
	, {"kind": "overworld_discovery", "id": String(discovery_id)})
	_show_prompt("Found something.")


func _apply_all_open_shortcuts() -> void:
	# Shortcut repaint requires a TileSet-assigned TileMapLayer; with the
	# StaticBody2D collision pipeline shortcuts clear their own swath by
	# removing matching bodies when activated. On initial build there are no
	# shortcuts open yet, so nothing to restore here.
	pass


func _apply_shortcut(shortcut_id: StringName) -> void:
	for sc: Dictionary in world_data.get("shortcuts", []):
		if StringName(sc.get("id", "")) != shortcut_id:
			continue
		_repaint_shortcut_opened(sc, false)
		return


func _repaint_shortcut_opened(sc: Dictionary, from_restore: bool) -> void:
	# Remove solid collision blocks in the shortcut's swath so the knight can
	# walk through. Ground tile repaint is skipped because TileMapLayers are
	# kept empty under the StaticBody2D collision pipeline.
	var kind := String(sc.get("kind", ""))
	var p: Array = sc.get("pos", [0, 0])
	var center := Vector2i(int(p[0]), int(p[1]))
	var swath: Array[Vector2i] = []
	match kind:
		"broken_bridge", "powered_conduit", "gate_valve":
			for dx in range(-2, 3): swath.append(Vector2i(center.x + dx, center.y))
		"rubble_block":
			for dx in range(-1, 2): swath.append(Vector2i(center.x + dx, center.y))
			swath.append(Vector2i(center.x, center.y - 1))
			swath.append(Vector2i(center.x, center.y + 1))
		_: swath.append(center)
	# Remove matching StaticBody2D children of collision_node whose centers
	# fall in the swath.
	var solid_codes := ['#','t','f','x','s','w']
	for body in collision.get_children():
		if not (body is StaticBody2D): continue
		var bc := body.global_position
		var cx := int(floor(bc.x / float(TILE)))
		var cy := int(floor(bc.y / float(TILE)))
		if Vector2i(cx, cy) in swath:
			body.queue_free()
	if not from_restore:
		for cell in swath:
			painter.open_shortcut_at(Vector2(float(cell.x) * TILE + 8.0, float(cell.y) * TILE + 8.0))


func _on_run_completion_ready(result: Dictionary, _options: Dictionary) -> void:
	# Grant the corresponding shortcut if the completed level opens one. Routing
	# is deferred to the completion-screen "Return to Marches" button, which calls
	# AppFlow.return_to_overworld_after_completion() → show_route(overworld…).
	var completed_level := StringName(result.get("level_id", ""))
	for sc: Dictionary in world_data.get("shortcuts", []):
		if StringName(sc.get("granted_by", "")) == completed_level:
			if not state.is_shortcut_open(StringName(sc.get("id"))):
				state.open_shortcut(StringName(sc.get("id")))
	var return_pos: Vector2 = _return_data.get("return_pos", _refuge_spawn_pixel())
	state.record_level_return(completed_level, return_pos)
	# Refresh AppFlow's pending payload so respawn lands at the last camp/entrance.
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow != null and app_flow.has_method("set_pending_overworld_return"):
		app_flow.call("set_pending_overworld_return", _return_data.duplicate(true))


func _find_landmark_by_id(world_id: StringName) -> Dictionary:
	for lm: Dictionary in world_data.get("landmarks", []):
		if StringName(lm.get("id", "")) == world_id:
			return lm
	return {}


func _in_camp_radius(pos: Vector2) -> bool:
	for camp: Dictionary in world_data.get("camps", []):
		var p: Array = camp.get("pos", [0,0])
		var cp := Vector2(float(p[0]) * TILE + 8.0, float(p[1]) * TILE + 8.0)
		if pos.distance_to(cp) < 32.0:
			return true
	return false


func _in_hazard(pos: Vector2) -> bool:
	# Hazard MVP: crucible valley (center-south, red) and eastern river canyon
	# drain provisions 2x faster. Uses simple authored bounding bands.
	if pos.x > 150.0 * TILE and pos.x < 210.0 * TILE and pos.y > 180.0 * TILE and pos.y < 210.0 * TILE:
		return true
	if pos.x > 230.0 * TILE and pos.y > 120.0 * TILE and pos.y < 180.0 * TILE:
		# Mud/watershed hazard band.
		return true
	return false


func _hud_refresh() -> void:
	hud_label.text = "Hollow Marches  |  Camp: %s  |  Provisions %d/%d" % [
		state.get_last_camp_id(),
		state.provisions,
		state.max_provisions,
	]
	prompt_label.text = ""


func _show_prompt(text: String) -> void:
	prompt_label.text = text
	await get_tree().create_timer(2.5, true).timeout
	if prompt_label.text == text:
		prompt_label.text = ""


func configure(payload: Dictionary) -> void:
	# Invoked by AppRoot when entering the overworld route (including after
	# returning from a dungeon run). Restore the player to the last activated
	# camp (or the dungeon threshold if no closer anchor was set).
	if is_instance_valid(player):
		# Prefer authored spawn position from the state: OverworldState persisted
		# last camp / return position from the previous visit.
		player.global_position = state.get_spawn_position()
		if camera != null:
			camera.reset_smoothing()
	if bool(payload.get("from_return", false)):
		var level_id := StringName(payload.get("level_id", ""))
		if level_id != &"":
			_show_prompt("You return to the Marches.")
