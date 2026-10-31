extends Node2D
## Soul of Hero - world visual pilot, runtime compositor.
##
## Draws the pilot environment from the same pinned files the Python compositor
## uses, in the same order, with the same maths, so a Godot frame and a
## tools/compose.py frame agree:
##
##   ground  -> variant_index(x,y,n) + flip_id(x,y) mirror
##   detail  -> token frame, masked variants keep their baked mask
##   solid   -> token frame
##   decals  -> placement.v1.json decals, 16x16 atlas frames
##   props   -> foot anchor (x, y), flat frames at z = -1, else y-sorted
##   actor   -> knight _Idle frame 0 crop, foot anchored
##
## Native viewport is 640x360 with a 2x draw transform over a 320x180 world
## window, which is project.godot's viewport (640x360) at camera_default.zoom=2.
##
## NOT EXECUTED IN THE SANDBOX THAT PRODUCED IT: there is no Godot binary in
## that environment, so this scene is shipped as an executable reproduction, not
## as tested output. The verified pixel evidence is tools/compose.py's.

const TILE := 16
const VARIANT_BLOCK := 3
const WORLD_WINDOW := Vector2(320, 180)

@export var camera_cell := Vector2i(397, 200)
@export var walk_speed := 7.0  # cells per second
@export var autoplay := true

var tiles_tex: Texture2D
var props_tex: Texture2D
var knight_tex: Texture2D
var tiles_index: Dictionary = {}
var props_index: Dictionary = {}
var cells: Dictionary = {}
var placement: Dictionary = {}
var walk: Array = []

var origin := Vector2i.ZERO
var win_size := Vector2i.ZERO
var ground: Array = []
var detail: Array = []
var solid: Array = []
var hero_cell := Vector2i.ZERO
var hero_cell_f := Vector2.ZERO


func _ready() -> void:
	tiles_tex = load("res://pilot/art/overworld_tiles.png")
	props_tex = load("res://pilot/art/overworld_props.png")
	knight_tex = load("res://pilot/art/knight_idle_sheet.png")
	tiles_index = _read_json("res://pilot/data/overworld_tiles.v1.json")["index"]
	props_index = _read_json("res://pilot/data/overworld_props.v1.json")["frames"]
	cells = _read_json("res://pilot/data/corridor_cells.v1.json")
	placement = _read_json("res://pilot/data/placement.v1.json")
	walk = _read_json("res://pilot/data/walk_path.v1.json")["cells"]

	var win: Dictionary = cells["corridor"]
	origin = Vector2i(win["origin_cell"][0], win["origin_cell"][1])
	win_size = Vector2i(win["size_cells"][0], win["size_cells"][1])
	ground = win["layers"]["ground"]
	detail = win["layers"]["detail"]
	solid = win["layers"]["solid"]
	hero_cell = Vector2i(walk[0][0], walk[0][1])
	hero_cell_f = Vector2(hero_cell)
	camera_cell = hero_cell
	for tex in [tiles_tex, props_tex, knight_tex]:
		tex.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	RenderingServer.set_default_clear_color(Color(0.05, 0.05, 0.07))


func _read_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("missing pinned data: " + path)
		return {}
	return JSON.parse_string(f.get_as_text())


func _process(delta: float) -> void:
	if not autoplay or walk.size() < 2:
		return
	# walk the verified BFS path, exactly as data/walk_path.v1.json lists it
	var target := Vector2(walk[mini(int(hero_cell_f.y), 0)])
	var idx := 0
	for i in range(walk.size()):
		if Vector2i(walk[i][0], walk[i][1]) == hero_cell:
			idx = i
			break
	target = Vector2(walk[mini(idx + 1, walk.size() - 1)][0], walk[mini(idx + 1, walk.size() - 1)][1])
	hero_cell_f = hero_cell_f.move_toward(target, walk_speed * delta)
	hero_cell = Vector2i(roundi(hero_cell_f.x), roundi(hero_cell_f.y))
	if hero_cell_f.distance_to(target) < 0.01:
		hero_cell_f = target
	camera_cell = hero_cell
	queue_redraw()


## A1 runtime: per-tile variant inside 3x3 blocks.
func variant_index(x: int, y: int, count: int) -> int:
	if count <= 1:
		return 0
	var bx := floori(float(x) / VARIANT_BLOCK)
	var by := floori(float(y) / VARIANT_BLOCK)
	var h: int = absi((bx * 73856093) ^ (by * 19349663))
	return h % count


func absi(v: int) -> int:
	return v if v >= 0 else -v


func flip_id(x: int, y: int) -> int:
	return absi((x * 92837111) ^ (y * 689287499)) % 2


func _draw() -> void:
	# camera: 320x180 world px centred on the cell centre, drawn at 2x
	var cam_px := Vector2(camera_cell) * TILE + Vector2(TILE, TILE) * 0.5
	var cam_origin := (cam_px - WORLD_WINDOW * 0.5).round()
	draw_set_transform(-cam_origin * 2.0, 0.0, Vector2(2, 2))

	var base := Rect2(cam_origin / TILE, WORLD_WINDOW / TILE + Vector2(2, 2))
	for cy in range(int(base.position.y), int(base.end.y)):
		for cx in range(int(base.position.x), int(base.end.x)):
			_draw_cell(cx, cy)
	_draw_decals(base)
	_draw_sprites(base)


func _in_window(cx: int, cy: int) -> bool:
	return cx >= origin.x and cy >= origin.y \
		and cx < origin.x + win_size.x and cy < origin.y + win_size.y


func _token(layer: Array, cx: int, cy: int) -> String:
	if not _in_window(cx, cy):
		return "."
	return layer[cy - origin.y][cx - origin.x]


func _draw_frame(tex: Texture2D, index: Dictionary, name: String, dst: Vector2, mirror := false) -> void:
	if not index.has(name):
		return
	var r: Array = index[name]
	var src := Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
	if mirror:
		draw_texture_rect_region(tex, Rect2(dst, src.size), src, Color.WHITE, false, true)
	else:
		draw_texture_rect_region(tex, Rect2(dst, src.size), src)


func _ground_frame(token: String) -> Array:
	# data/overworld_tiles.v1.json codes.ground[token] = {frame, variants}
	var code: Dictionary = cells["codes"]["ground"].get(token, {})
	if code.is_empty():
		return []
	var variants: Array = code.get("variant_names", [])
	if variants.is_empty():
		return [code["frame"]]
	return [variants[0]]


func _draw_cell(cx: int, cy: int) -> void:
	var g := _token(ground, cx, cy)
	if g == "." or g == " ":
		return
	var code: Dictionary = cells["codes"]["ground"].get(g, {})
	if code.is_empty():
		return
	var variants: Array = code.get("variant_names", [code.get("frame", "")])
	var frame: String = variants[variant_index(cx, cy, variants.size())] if variants.size() > 0 else ""
	_draw_frame(tiles_tex, tiles_index, frame, Vector2(cx, cy) * TILE, flip_id(cx, cy) == 1)

	var d := _token(detail, cx, cy)
	if d != "." and not placement["tuning"].get("drop_detail_tokens", "").contains(d):
		var dcode: Dictionary = cells["codes"]["detail"].get(d, {})
		if not dcode.is_empty():
			var dn: String = dcode["frame"]
			if dcode.get("masked", false):
				dn = "%s#%d" % [dn, variant_index(cx, cy, 16)]
			elif dcode.has("variant_names"):
				var dv: Array = dcode["variant_names"]
				dn = dv[variant_index(cx, cy, dv.size())]
			_draw_frame(tiles_tex, tiles_index, dn, Vector2(cx, cy) * TILE)

	var s := _token(solid, cx, cy)
	if s != ".":
		_draw_frame(tiles_tex, tiles_index, s, Vector2(cx, cy) * TILE)


func _draw_decals(base: Rect2) -> void:
	for d in placement["decals"]:
		var c: Array = d["cell"]
		if not base.has_point(Vector2(c[0], c[1])):
			continue
		_draw_frame(tiles_tex, tiles_index, d["frame"], Vector2(c[0], c[1]) * TILE)


func _flat_props() -> Array:
	return ["disc_cache", "disc_bones", "disc_lore", "camp_bedroll",
		"cliff_patch_a", "cliff_patch_b", "cliff_patch_c", "cliff_patch_d",
		"cliff_crack_a", "cliff_crack_b", "cliff_ledge_a", "cliff_ledge_b"]


func _draw_sprites(base: Rect2) -> void:
	var list: Array = []
	for p in placement["props"]:
		if p["frame"] in _flat_props():
			_draw_prop(p)
		else:
			var yy: float = p["y"] / TILE
			if yy < base.position.y - 8 or yy > base.end.y + 8:
				continue
			list.append(p)
	list.sort_custom(func(a, b): return a["y"] < b["y"])
	for p in list:
		_draw_prop(p)
	# actor, foot anchored, drawn last so it is never hidden by a prop at the same y
	for a in placement.get("actors", []):
		var crop: Array = a["crop"]
		var src := Rect2(float(crop[0]), float(crop[1]), float(crop[2]), float(crop[3]))
		var foot := Vector2(hero_cell_f.x * TILE + TILE * 0.5, hero_cell_f.y * TILE + TILE - 1)
		draw_texture_rect_region(knight_tex,
			Rect2(Vector2(foot.x - src.size.x * 0.5, foot.y - src.size.y), src.size), src)


func _draw_prop(p: Dictionary) -> void:
	if not props_index.has(p["frame"]):
		return
	var r: Array = props_index[p["frame"]]
	var src := Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
	var dst := Vector2(float(p["x"]) - src.size.x * 0.5, float(p["y"]) - src.size.y)
	if p.get("flip", null) == "h":
		draw_texture_rect_region(props_tex, Rect2(dst, src.size), src, Color.WHITE, false, true)
	else:
		draw_texture_rect_region(props_tex, Rect2(dst, src.size), src)
