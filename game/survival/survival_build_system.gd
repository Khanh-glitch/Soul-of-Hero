class_name SurvivalBuildSystem
extends Node2D

## Placement preview, placement validation and the built-structure layer.
##
## ## Why this is a node in the overworld and not an autoload
##
## Placement legality is a question about the *world*: is this cell on solid
## terrain, is it on a pilgrimage road, is it inside a landmark's clearance, is it
## within arm's reach of the player. All of that is owned by the mounted overworld,
## and there is no overworld on the home screen or inside a dungeon. So the spatial
## half lives here, next to the world it interrogates, and the durable half lives in
## `SurvivalService` inside SaveService. `SurvivalService.place_structure()` takes
## this object's validator as a callable and re-runs the occupancy/affordability
## half inside its own transaction.
##
## That split is the CT-07 contract: **no free placement, no blocked route, the
## entity and the payment committed together.**
##
## ## Input
##
## The build tool is modal and explicit: `B` toggles build mode, `1`-`4` select the
## piece, left-click places, right-click or `ESC` leaves. Nothing here is wired into
## the Knight's combat input, so no existing control path changes meaning.

signal piece_changed(piece_id: String)
signal placement_rejected(reason: String)
signal placement_committed(entity_id: String, piece_id: String, cell: Vector2i)
signal build_mode_changed(active: bool)

const ROOM_TOPOLOGY = preload("res://game/survival/survival_room_topology.gd")
const TILE := 16
const BUILD_ART_PATH := "res://assets/survival/build/placeholder_build.png"
const BUILD_ART_META := "res://data/survival/placeholder_build.json"
const SOLID_LAYER_MASK := 1

var active := false
var selected_piece := "foundation_wood"

var world: OverworldWorld
var player: Node2D
var camera: Camera2D
var state: OverworldState

var _structures_root: Node2D
var _preview: Sprite2D
var _preview_frame: Sprite2D
var _texture: Texture2D
var _frames: Dictionary = {}
var _placed: Dictionary = {}          # entity_id -> SurvivalStructure
var _occupied: Dictionary = {}        # "x,y" -> {floor/object: entity_id}
var room_topology = ROOM_TOPOLOGY.new()
var _last_rejection := ""
var _ready_built := false
var _hud_layer: CanvasLayer
var _hud_root: Control
var _hud_label: Label


func configure(world_ref: OverworldWorld, player_ref: Node2D, camera_ref: Camera2D,
		state_ref: OverworldState) -> void:
	world = world_ref
	player = player_ref
	camera = camera_ref
	state = state_ref
	_ensure_roots()
	_load_art()
	_build_hud()
	# Affordability changes whenever the bag does; the strip is a read of the same
	# document the transaction will read, not a cache.
	var svc := service()
	if svc != null and svc.has_signal(&"survival_state_changed") \
			and not svc.is_connected(&"survival_state_changed", _refresh_hud):
		svc.connect(&"survival_state_changed", _refresh_hud)
	rebuild_from_save()


func _ensure_roots() -> void:
	if _structures_root == null:
		_structures_root = Node2D.new()
		_structures_root.name = "BuiltStructures"
		if not _structures_root.is_inside_tree():
			add_child(_structures_root)
	if _preview == null:
		_preview = Sprite2D.new()
		_preview.name = "PlacementPreview"
		_preview.visible = false
		_preview.modulate = Color(0.65, 1.0, 0.75, 0.62)
		add_child(_preview)
		# The footprint marker: a dim copy of the piece's base tile laid flat on the
		# cell the build would occupy. The ghost above it is drawn with the piece's
		# real height, which means it floats a few pixels north of its own cell —
		# without the footprint the player cannot tell which tile is actually being
		# bought. Solid pieces get one because they have a floor to align to.
		_preview_frame = Sprite2D.new()
		_preview_frame.name = "PlacementFootprint"
		_preview_frame.visible = false
		_preview_frame.modulate = Color(0.62, 0.58, 0.5, 0.34)
		add_child(_preview_frame)


func _load_art() -> void:
	if not FileAccess.file_exists(BUILD_ART_PATH) or not FileAccess.file_exists(BUILD_ART_META):
		return
	_texture = load(BUILD_ART_PATH) as Texture2D
	var file := FileAccess.open(BUILD_ART_META, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if parsed is Dictionary:
		_frames = (parsed as Dictionary).get("frames", {})


func service() -> Node:
	return get_node_or_null("/root/SurvivalService")


# ---------------------------------------------------------------------------
# mode
# ---------------------------------------------------------------------------
func set_active(value: bool) -> void:
	if active == value:
		return
	active = value
	if not active:
		_hide_preview()
	_refresh_hud()
	build_mode_changed.emit(active)


func select_piece(piece_id: String) -> bool:
	var svc := service()
	if svc == null:
		return false
	if (svc.call(&"piece_definition", piece_id) as Dictionary).is_empty():
		return false
	selected_piece = piece_id
	_refresh_hud()
	piece_changed.emit(piece_id)
	return true


# ---------------------------------------------------------------------------
# rebuild from the document
# ---------------------------------------------------------------------------
## Rebuilds the visual/collision layer from the committed survival document.
##
## This is the single path by which structures exist in a scene: it runs on world
## build, after a reload, and after every successful placement. Nothing else may
## add a structure node, so a desync between save and screen has exactly one place
## to be found.
func rebuild_from_save() -> void:
	_ensure_roots()
	for child: Node in _structures_root.get_children():
		child.queue_free()
	_placed.clear()
	_occupied.clear()
	var svc := service()
	if svc == null:
		return
	var document: Dictionary = svc.call(&"document")
	var structures: Dictionary = document.get("structures", {})
	var ids: Array = structures.keys()
	ids.sort()
	for raw_id: Variant in ids:
		var entity_id := String(raw_id)
		var entry: Dictionary = structures[raw_id]
		var raw_cell: Array = entry.get("cell", [])
		if raw_cell.size() < 2:
			continue
		_materialize(entity_id, String(entry.get("piece", "")),
			Vector2i(int(raw_cell[0]), int(raw_cell[1])))
	room_topology.rebuild(structures)
	_ready_built = true


## Brings the scene into agreement with the committed document without tearing the
## existing nodes down.
##
## [method rebuild_from_save] is correct but total: it frees and re-materializes
## every structure. That is the right thing on world build and on a reload, and the
## wrong thing on a signal — `survival_state_changed` fires on every harvest and
## every container transfer, and a full teardown there would destroy and recreate
## colliders the player is standing against (and hand out fresh node identities
## while old ones are still queued for deletion).
##
## Reconcile is idempotent and minimal: it adds what the document has and the scene
## lacks, removes what the scene has and the document lost, and leaves everything
## else untouched.
func reconcile_from_save() -> void:
	_ensure_roots()
	var svc := service()
	if svc == null:
		return
	var structures: Dictionary = (svc.call(&"document") as Dictionary).get("structures", {})
	var topology_changed := false
	for entity_id: Variant in _placed.keys():
		if structures.has(entity_id):
			continue
		var doomed: SurvivalStructure = _placed[entity_id]
		_erase_occupancy(doomed)
		if doomed.piece_id in ["wall_wood", "door_wood"]:
			topology_changed = true
		_placed.erase(entity_id)
		if is_instance_valid(doomed):
			doomed.queue_free()
	var ids: Array = structures.keys()
	ids.sort()
	for raw_id: Variant in ids:
		var entity_id := String(raw_id)
		var entry: Dictionary = structures[raw_id]
		var raw_cell: Array = entry.get("cell", [])
		if raw_cell.size() < 2:
			continue
		var cell := Vector2i(int(raw_cell[0]), int(raw_cell[1]))
		var piece_id := String(entry.get("piece", ""))
		var existing: SurvivalStructure = _placed.get(entity_id, null)
		if existing != null and is_instance_valid(existing):
			if existing.piece_id == piece_id and existing.cell == cell:
				# Contents may have moved without the node changing; a chest that
				# still advertises its pre-transfer count is the kind of small lie
				# that makes a player distrust the stash.
				if existing.has_method(&"refresh_prompt"):
					existing.call(&"refresh_prompt")
				continue
			_erase_occupancy(existing)
			if existing.piece_id in ["wall_wood", "door_wood"]:
				topology_changed = true
			_placed.erase(entity_id)
			existing.queue_free()
		_materialize(entity_id, piece_id, cell)
		if piece_id in ["wall_wood", "door_wood"]:
			topology_changed = true
	if topology_changed:
		room_topology.rebuild(structures)
	_ready_built = true


func _materialize(entity_id: String, piece_id: String, cell: Vector2i) -> SurvivalStructure:
	var node := SurvivalStructure.new()
	node.name = "B_%s" % entity_id
	node.entity_id = entity_id
	node.piece_id = piece_id
	node.cell = cell
	node.position = Vector2(cell.x * TILE, cell.y * TILE)
	node.collision_layer = 0
	node.collision_mask = 0
	node.monitoring = false
	node.monitorable = false
	var sprite := Sprite2D.new()
	sprite.name = "Sprite"
	sprite.centered = false
	sprite.texture = _texture
	var frame: Dictionary = _frames.get(piece_id, {})
	if not frame.is_empty():
		sprite.region_enabled = true
		sprite.region_rect = Rect2(
			int(frame.get("x", 0)), int(frame.get("y", 0)),
			int(frame.get("w", TILE)), int(frame.get("h", TILE)))
	# Anchor the sprite by its foot: the catalog frame is drawn as a 16-wide cell
	# whose base sits on the cell's south edge, which is what makes a wall read as
	# standing in front of the floor it sits on.
	sprite.position = Vector2(0, TILE - int(frame.get("h", TILE)))
	node.add_child(sprite)
	if SurvivalStructure.is_solid_piece(piece_id):
		var body := StaticBody2D.new()
		body.name = "Solid"
		body.collision_layer = SOLID_LAYER_MASK
		body.collision_mask = 0
		# Block the standing part of the piece, not the whole tile: a wall's south
		# two pixels are its shadow, and the player must be able to stand against
		# the wall without being pushed off the floor in front of it.
		var shape := CollisionShape2D.new()
		shape.name = "CollisionShape2D"
		var rect := RectangleShape2D.new()
		rect.size = Vector2(TILE - 2, TILE - 6)
		shape.shape = rect
		shape.position = Vector2(TILE * 0.5, TILE * 0.5 - 3.0)
		body.add_child(shape)
		node.add_child(body)
	# A chest joins `player_interactable` from inside SurvivalStructure._ready, so
	# the behaviour belongs to the piece rather than to this call site.
	_structures_root.add_child(node)
	_placed[entity_id] = node
	var key := _cell_key(cell)
	var slots: Dictionary = _occupied.get(key, {})
	var svc := service()
	var layer := String(svc.call(&"occupancy_layer", piece_id)) if svc != null else "object"
	slots[layer] = entity_id
	_occupied[key] = slots
	return node


func _erase_occupancy(node: SurvivalStructure) -> void:
	var key := _cell_key(node.cell)
	var slots: Dictionary = _occupied.get(key, {})
	var svc := service()
	var layer := String(svc.call(&"occupancy_layer", node.piece_id)) if svc != null else "object"
	if String(slots.get(layer, "")) == node.entity_id:
		slots.erase(layer)
	if slots.is_empty():
		_occupied.erase(key)
	else:
		_occupied[key] = slots


func _cell_key(cell: Vector2i) -> String:
	return "%d,%d" % [cell.x, cell.y]


func structure_node(entity_id: String) -> SurvivalStructure:
	return _placed.get(entity_id, null)


func placed_count() -> int:
	return _placed.size()


func entity_at(cell: Vector2i) -> String:
	var slots: Dictionary = _occupied.get(_cell_key(cell), {})
	return String(slots.get("object", slots.get("floor", "")))


func entity_at_layer(cell: Vector2i, layer: String) -> String:
	var slots: Dictionary = _occupied.get(_cell_key(cell), {})
	return String(slots.get(layer, ""))


# ---------------------------------------------------------------------------
# validation — CT-07 route safety
# ---------------------------------------------------------------------------
## Returns "" when the cell may be built on, or a short machine-readable reason.
##
## The rules, and why each exists:
##
## * **inside the world and on open ground** — a wall cannot be built into a cliff;
## * **not on water** — the authored water is the map's geography;
## * **not within `landmark_clearance_tiles` of a dungeon threshold or camp** — the
##   ten Chapter 1 approaches and the four camps are the mandatory progression
##   routes, and a player must not be able to seal one;
## * **not on a road or path detail code** — the pilgrimage road is the world's
##   readable navigation; blocking it with a wall would strand a player who has no
##   demolition tool yet;
## * **not within `shortcut_clearance_tiles` of a shortcut** — those are authored
##   route decisions, not building land;
## * **within `build_range_tiles` of the player** — placement is a physical act;
## * **cell unoccupied** — one structure per cell.
func validate_cell(cell: Vector2i) -> String:
	if world == null:
		return "no_world"
	if cell.x < 0 or cell.y < 0 or cell.x >= world.width or cell.y >= world.height:
		return "outside_world"
	if world.is_solid_cell(cell.x, cell.y):
		return "solid_terrain"
	if world.is_water_cell(cell.x, cell.y):
		return "water"
	var svc := service()
	# Read the rules through the service's accessor: `catalog` is a field, not a
	# method, and reading it directly is how a null reaches a clearance comparison.
	var landmark_clear := int(svc.call(&"rule", "landmark_clearance_tiles", 5)) if svc != null else 5
	var shortcut_clear := int(svc.call(&"rule", "shortcut_clearance_tiles", 4)) if svc != null else 4
	var reach_default := int(svc.call(&"rule", "build_range_tiles", 6)) if svc != null else 6
	if _near_authored_place(cell, landmark_clear):
		return "protected_place"
	if _on_route_detail(cell):
		return "on_route"
	if _near_shortcut(cell, shortcut_clear):
		return "near_shortcut"
	if player != null and is_instance_valid(player):
		var origin := world.tile_of(player.global_position)
		var reach := reach_default
		if absi(cell.x - origin.x) > reach or absi(cell.y - origin.y) > reach:
			return "out_of_range"
	var layer := String(svc.call(&"occupancy_layer", selected_piece)) if svc != null else "object"
	if not entity_at_layer(cell, layer).is_empty():
		return "cell_occupied"
	return ""


func _near_authored_place(cell: Vector2i, clearance: int) -> bool:
	if state == null:
		return false
	var data: Dictionary = world.data if world != null else {}
	for raw: Variant in data.get("landmarks", []):
		if not raw is Dictionary:
			continue
		var tile: Array = (raw as Dictionary).get("threshold", (raw as Dictionary).get("pos", []))
		if tile.size() >= 2 and absi(cell.x - int(tile[0])) <= clearance \
				and absi(cell.y - int(tile[1])) <= clearance:
			return true
	for raw: Variant in data.get("camps", []):
		if not raw is Dictionary:
			continue
		var tile: Array = (raw as Dictionary).get("pos", [])
		if tile.size() >= 2 and absi(cell.x - int(tile[0])) <= clearance \
				and absi(cell.y - int(tile[1])) <= clearance:
			return true
	return false


func _on_route_detail(cell: Vector2i) -> bool:
	if world == null:
		return false
	var token: String = world.detail_code_at(Vector2(cell.x * TILE + 8, cell.y * TILE + 8))
	return token in ["=", "+", ":"]


func _near_shortcut(cell: Vector2i, clearance: int) -> bool:
	if world == null:
		return false
	var data: Dictionary = world.data
	for raw: Variant in data.get("shortcuts", []):
		if not raw is Dictionary:
			continue
		var tile: Array = (raw as Dictionary).get("pos", [])
		if tile.size() >= 2 and absi(cell.x - int(tile[0])) <= clearance \
				and absi(cell.y - int(tile[1])) <= clearance:
			return true
	return false


# ---------------------------------------------------------------------------
# placement
# ---------------------------------------------------------------------------
## The full placement action: validate, pay, create, and reflect.
## Returns the service's result dictionary plus the human-readable reason.
func try_place(cell: Vector2i, transaction_key := "") -> Dictionary:
	if not _ready_built:
		# No rebuilt layer means this system was never configured against a world:
		# placing now would commit a structure that nothing on screen represents.
		return {"ok": false, "reason": "not_configured"}
	var local_reason := validate_cell(cell)
	if not local_reason.is_empty():
		_last_rejection = local_reason
		placement_rejected.emit(local_reason)
		return {"ok": false, "reason": local_reason}
	var svc := service()
	if svc == null:
		return {"ok": false, "reason": "no_service"}
	var key := transaction_key
	if key.is_empty():
		key = "%s%d,%d" % [String(svc.call(&"build_transaction_key")), cell.x, cell.y]
	var result: Dictionary = svc.call(
		&"place_structure", selected_piece, cell, key,
		func() -> String: return validate_cell(cell),
	)
	if not bool(result.get("ok", false)):
		_last_rejection = String(result.get("reason", "rejected"))
		placement_rejected.emit(_last_rejection)
		return result
	# `place_structure` emits `survival_state_changed`, and any world listening to
	# it has already materialized this node by the time the call returns. Calling
	# `_materialize` here would therefore create it twice — so the scene is brought
	# in line through the one idempotent path instead, which also covers the case
	# where nothing was listening.
	reconcile_from_save()
	placement_committed.emit(String(result.get("entity_id", "")), selected_piece, cell)
	if state != null:
		state.mark_dirty()
	return result


## Index of a piece's cost as a short readable string, e.g. "2 Oak Wood + 1 Iron Scrap".
func cost_summary(piece_id: String) -> String:
	var svc := service()
	if svc == null:
		return ""
	var definition: Dictionary = svc.call(&"piece_definition", piece_id)
	var cost: Dictionary = definition.get("cost", {})
	var parts: Array[String] = []
	for item_id: Variant in cost.keys():
		var item: Dictionary = svc.call(&"item_definition", String(item_id))
		parts.append("%d %s" % [int(cost[item_id]), String(item.get("label", item_id))])
	return " + ".join(parts)


# ---------------------------------------------------------------------------
# build HUD
# ---------------------------------------------------------------------------
## The build modal's own surface: a full-screen click blocker plus a strip that
## says what is being built and what it costs.
##
## Two things make this more than decoration:
##
## * The blocker is a [Control] that consumes the left click. The Knight resolves
##   attacks from `_unhandled_input`, so a click that a Control consumed never
##   becomes an attack — which is what lets placement and combat share one button
##   without touching the player's input code.
## * The costs are read from the catalog on every refresh, so the strip can never
##   advertise a price the transaction will not charge.
func _build_hud() -> void:
	if _hud_layer != null:
		return
	_hud_layer = CanvasLayer.new()
	_hud_layer.name = "BuildHud"
	_hud_layer.layer = 6
	add_child(_hud_layer)
	_hud_root = Control.new()
	_hud_root.name = "BuildRoot"
	_hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud_layer.add_child(_hud_root)
	var blocker := Control.new()
	blocker.name = "ClickBlocker"
	blocker.set_anchors_preset(Control.PRESET_FULL_RECT)
	# STOP, not PASS: the point is to own the click while the modal is open.
	blocker.mouse_filter = Control.MOUSE_FILTER_STOP
	blocker.visible = false
	_hud_root.add_child(blocker)
	var panel := PanelContainer.new()
	panel.name = "Strip"
	panel.anchor_left = 0.0
	panel.anchor_top = 1.0
	panel.anchor_right = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_top = -34.0
	panel.offset_bottom = -4.0
	panel.offset_left = 8.0
	panel.offset_right = -8.0
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.visible = false
	_hud_root.add_child(panel)
	_hud_label = Label.new()
	_hud_label.name = "Text"
	_hud_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_hud_label.add_theme_font_size_override("font_size", 10)
	_hud_label.add_theme_color_override("font_color", Color(0.94, 0.92, 0.84))
	_hud_label.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_hud_label.add_theme_constant_override("outline_size", 4)
	_hud_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(_hud_label)
	_refresh_hud()


func _refresh_hud() -> void:
	if _hud_root == null:
		return
	var blocker := _hud_root.get_node_or_null("ClickBlocker")
	var panel := _hud_root.get_node_or_null("Strip") as Control
	if blocker != null:
		blocker.visible = active
	if panel != null:
		panel.visible = active
	if _hud_label == null:
		return
	if not active:
		_hud_label.text = ""
		return
	var parts: Array[String] = []
	var svc := service()
	var ids: Array[String] = ["foundation_wood", "wall_wood", "door_wood", "chest_wood"]
	for index: int in ids.size():
		var piece_id := ids[index]
		var marker := ">" if piece_id == selected_piece else " "
		var cost_text := ""
		if svc != null:
			var definition: Dictionary = svc.call(&"piece_definition", piece_id)
			cost_text = _cost_text(definition.get("cost", {}))
			var affordable := bool(svc.call(&"can_afford", definition.get("cost", {})))
			if not affordable:
				cost_text = "%s (short)" % cost_text
		parts.append("%s[%d] %s %s" % [marker, index + 1,
			piece_id.replace("_wood", "").capitalize(), cost_text])
	_hud_label.text = "BUILD   %s   —   left click to place, B to close" % "   ".join(parts)


func _cost_text(cost: Dictionary) -> String:
	var parts: Array[String] = []
	for item_id: Variant in cost.keys():
		parts.append("%d %s" % [int(cost[item_id]), String(item_id).replace("_", " ")])
	return ", ".join(parts)


## Test/UI surface: what the build strip is showing right now.
func build_hud_status() -> Dictionary:
	var blocker: Node = null
	if _hud_root != null:
		blocker = _hud_root.get_node_or_null("ClickBlocker")
	return {
		"active": active,
		"blocker_visible": blocker != null and (blocker as Control).visible,
		"text": _hud_label.text if _hud_label != null else "",
	}


# ---------------------------------------------------------------------------
# preview
# ---------------------------------------------------------------------------
func _process(_delta: float) -> void:
	if not active:
		return
	_update_preview()


func _target_cell() -> Vector2i:
	if world == null or player == null or not is_instance_valid(player):
		return Vector2i(-1, -1)
	var mouse := get_global_mouse_position()
	if camera != null:
		mouse = camera.get_global_mouse_position()
	return Vector2i(int(floor(mouse.x / TILE)), int(floor(mouse.y / TILE)))


func _update_preview() -> void:
	if _preview == null:
		return
	var cell := _target_cell()
	if cell.x < 0:
		_hide_preview()
		return
	var frame: Dictionary = _frames.get(selected_piece, {})
	_apply_frame(_preview, frame)
	_preview.visible = _texture != null
	_preview.position = Vector2(cell.x * TILE, cell.y * TILE + TILE - int(frame.get("h", TILE)))
	if _preview_frame != null:
		var footprint: Dictionary = _frames.get("foundation_wood", {})
		_apply_frame(_preview_frame, footprint)
		_preview_frame.visible = _texture != null and not footprint.is_empty()
		_preview_frame.position = Vector2(cell.x * TILE, cell.y * TILE)
	var reason := validate_cell(cell)
	# A ghost is tinted by legality: green where it would be paid for, red where the
	# cell is refused. This is the readable affordance the top-down camera needs —
	# the player sees *where* before committing to *what*.
	_preview.modulate = Color(0.62, 1.0, 0.7, 0.66) if reason.is_empty() \
		else Color(1.0, 0.62, 0.5, 0.5)


func _apply_frame(sprite: Sprite2D, frame: Dictionary) -> void:
	sprite.texture = _texture
	if frame.is_empty():
		return
	sprite.region_enabled = true
	sprite.region_rect = Rect2(
		int(frame.get("x", 0)), int(frame.get("y", 0)),
		int(frame.get("w", TILE)), int(frame.get("h", TILE)))


func _hide_preview() -> void:
	if _preview != null:
		_preview.visible = false
	if _preview_frame != null:
		_preview_frame.visible = false


func last_rejection() -> String:
	return _last_rejection


func has_preview() -> bool:
	return _preview != null and _preview.visible


func preview_cell() -> Vector2i:
	return _target_cell()


## Test/UI surface: which piece the preview is currently showing and whether that
## cell is legal right now.
func preview_state() -> Dictionary:
	var cell := _target_cell()
	return {
		"active": active,
		"piece": selected_piece,
		"cell": cell,
		"visible": has_preview(),
		"reason": validate_cell(cell) if cell.x >= 0 else "no_target",
	}
