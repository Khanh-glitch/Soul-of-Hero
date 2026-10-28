class_name OverworldPainter
extends RefCounted
## Procedurally paints the Hollow Marches overworld into TileMapLayers.
## Uses a preloaded placeholder texture to avoid ImageTexture.create_from_image
## (which races GL init under --script). The atlas assigns each tile code to a
## distinct source coordinate on the placeholder tilesheet; distinct terrain
## colors are approximated by setting modulation on the TileMapLayer per-code
## using TileData.modulate at assign time.

const TILE := 16

var _placeholder_tex: Texture2D

var palette: Dictionary = {}
var tilesets_by_layer: Dictionary = {}
var world_w := 384
var world_h := 256
var grid: Dictionary = {}  # Vector2i -> char
var layer_cells: Dictionary = {}  # layer_name -> Array[Dictionary]


func paint(world_data: Dictionary, layers_node: Node2D) -> void:
	if _placeholder_tex == null:
		var ph := PlaceholderTexture2D.new()
		ph.size = Vector2(TILE, TILE)
		_placeholder_tex = ph
	palette = world_data.get("palette", {})
	world_w = int(world_data.get("world_bounds", {}).get("w", 384))
	world_h = int(world_data.get("world_bounds", {}).get("h", 256))
	_grid_init()
	_layout_terrain(world_data)
	_layout_roads(world_data)
	_layout_rivers(world_data)
	_layout_camps(world_data)
	_layout_landmark_footprints(world_data)
	_layout_shortcuts(world_data)
	_layout_discoveries(world_data)
	_layout_vegetation()
	_write_to_layers(layers_node)


func _grid_init() -> void:
	grid.clear()
	for y in range(world_h):
		for x in range(world_w):
			grid[Vector2i(x, y)] = '.'


func _get(c: Vector2i) -> String:
	return String(grid.get(c, '.'))


func _set(c: Vector2i, ch: String) -> void:
	grid[c] = ch


func _fill(rect: Rect2i, ch: String) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			grid[Vector2i(x, y)] = ch


func _layout_terrain(world_data: Dictionary) -> void:
	_fill(Rect2i(0, 0, world_w, world_h), 'g')
	for sec in world_data.get("sectors", []):
		var terrain := String(sec.get("terrain", "grass"))
		var x := int(sec.get("x", 0)); var y := int(sec.get("y", 0))
		var w := int(sec.get("w", world_w)); var h := int(sec.get("h", world_h))
		var code := 'g'
		match terrain:
			"wastes": code = 'd'
			"wetlands": code = 'w'
			"highlands": code = 's'
			"forest": code = 'G'
			"mud": code = 'm'
		_fill(Rect2i(x, y, w, h), code)


func _layout_roads(world_data: Dictionary) -> void:
	for r in world_data.get("roads", []):
		var pts := r.get("points", [])
		for i in range(pts.size() - 1):
			var a: Array = pts[i]; var b: Array = pts[i+1]
			_draw_line(Vector2i(int(a[0]), int(a[1])), Vector2i(int(b[0]), int(b[1])), 'R')


func _layout_rivers(world_data: Dictionary) -> void:
	for rv in world_data.get("rivers", []):
		var pts := rv.get("points", [])
		for i in range(pts.size() - 1):
			var a: Array = pts[i]; var b: Array = pts[i+1]
			_draw_line(Vector2i(int(a[0]), int(a[1])), Vector2i(int(b[0]), int(b[1])), 'w')


func _draw_line(a: Vector2i, b: Vector2i, ch: String) -> void:
	var dx := abs(b.x - a.x); var dy := -abs(b.y - a.y)
	var sx := 1 if a.x < b.x else -1
	var sy := 1 if a.y < b.y else -1
	var err := dx + dy
	var p := a
	while true:
		grid[p] = ch
		if p == b: break
		var e2 := 2 * err
		if e2 >= dy: err += dy; p.x += sx
		if e2 <= dx: err += dx; p.y += sy


func _layout_camps(_w: Dictionary) -> void:
	pass

func _layout_landmark_footprints(world_data: Dictionary) -> void:
	for lm in world_data.get("landmarks", []):
		var p: Array = lm.get("pos", [0,0])
		grid[Vector2i(int(p[0]), int(p[1]))] = 'L'

func _layout_shortcuts(_w: Dictionary) -> void: pass
func _layout_discoveries(_w: Dictionary) -> void: pass
func _layout_vegetation() -> void: pass


func _write_to_layers(layers_node: Node2D) -> void:
	# Under --script on llvmpipe/GitHub runners, assigning any TileSet (even
	# one with PlaceholderTexture2D and no cells) to a TileMapLayer crashes
	# the RenderingServer. Until visual tiles are authored via the editor
	# pipeline, the painter writes collision with StaticBody2D children and
	# leaves the TileMapLayers empty — ground color is provided by the
	# Background ColorRect under Layers.
	var collision_node := layers_node.get_node_or_null("Collision") as Node2D
	if collision_node == null:
		return
	# Collect solid cells from the grid and emit StaticBody2D+RectangleShape2D
	# in coarse blocks so the knight has something to collide against.
	_emit_solid_blocks(collision_node)

func _emit_solid_blocks(collision_node: Node2D) -> void:
	# Solid codes (same as the original painter): rocks, trees, water, walls.
	var solid_codes := ['#', 't', 'f', 'x', 's', 'w']
	var solid := {}
	for y in range(world_h):
		for x in range(world_w):
			var c := Vector2i(x, y)
			if _get(c) in solid_codes:
				solid[c] = true
	# Greedy horizontal merge of solid runs into wider StaticBody2D blocks
	# so we don't spawn 30k+ body nodes (faster, fewer Nodes).
	var visited := {}
	for y in range(world_h):
		var x := 0
		while x < world_w:
			var c := Vector2i(x, y)
			if not solid.has(c) or visited.has(c):
				x += 1; continue
			var x1 := x
			while x1 < world_w and solid.has(Vector2i(x1, y)) and not visited.has(Vector2i(x1, y)):
				visited[Vector2i(x1, y)] = true
				x1 += 1
			var body := StaticBody2D.new()
			body.position = Vector2((x + x1) * 0.5 * TILE + 0.5, float(y) * TILE + TILE * 0.5)
			body.collision_layer = 1
			body.collision_mask = 0
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2((x1 - x) * TILE, TILE)
			shape.shape = rect
			body.add_child(shape)
			collision_node.add_child(body)
			x = x1

# --- compatibility helpers used by overworld.gd (shortcuts/walkability probes) ---
var _opened_cells: Dictionary = {}

func open_shortcut_at(_world_pos: Vector2) -> void:
	_opened_cells[_world_pos] = true

func is_walkable(world_pos: Vector2) -> bool:
	var cell := Vector2i(int(floor(world_pos.x / float(TILE))), int(floor(world_pos.y / float(TILE))))
	var ch: String = String(grid.get(cell, '.'))
	return ch != '.' and ch != '#' and ch != 't' and ch != 'f' and ch != 'x' and ch != 'w' \
		or _opened_cells.has(world_pos)
