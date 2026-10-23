extends Node2D

## Gate 0 runtime adapter — Candidate B's archive furniture on Candidate A's
## Chapter 1 Level 3.
##
## PROTOTYPE-LOCAL. This node is added to the live `DungeonLevel` and does five
## things, none of which touch the level format:
##
##   1. it refuses to decorate any level other than Level 3;
##   2. it inserts each whole prop sprite into the level's own y-sorted
##      `Entities` container, so props occlude and are occluded exactly like
##      Candidate A's actors — no separate render layer, no z_index games;
##   3. it gives each solid prop ONE static rectangle, derived by the authoring
##      script from the sprite's rendered width, so the body can never drift
##      from the art;
##   4. it adds no TileSet source, no second Knight, no HUD, no campaign node;
##   5. it reports every refusal through `get_failures()` instead of failing
##      quietly.
##
## Everything it draws comes from `overlay_level3_archive.json`, which
## `tools/gate0/author_overlay.py` generates and validates. Nothing is placed
## or nudged at runtime.

const OVERLAY_PATH := "res://prototypes/gate0/overlay_level3_archive.json"
const EXPECTED_LEVEL := "res://data/levels/chapter_1_level_3.json"

@export var overlay_path := OVERLAY_PATH

var props_added := 0
var colliders_added := 0
var _failures: Array[String] = []


func attach_to_level(level: Node) -> bool:
	## `level` must be the live DungeonLevel for Level 3. Returns false and
	## records why if this overlay does not belong here.
	var level_path := String(level.get("level_data_path"))
	if level_path != EXPECTED_LEVEL:
		_fail("overlay targets %s but the live level is %s" % [EXPECTED_LEVEL, level_path])
		return false
	var data := _load_overlay()
	if data.is_empty():
		return false
	var container := level.get_node_or_null("Entities") as Node2D
	if container == null:
		_fail("the live level has no Entities container to sort against")
		return false
	if not container.y_sort_enabled:
		# Never silently re-order somebody else's actors: report it.
		_fail("Entities is not y-sorted, so props could not occlude correctly")
		return false
	_build(data, container, level)
	return _failures.is_empty()


func _load_overlay() -> Dictionary:
	var file := FileAccess.open(overlay_path, FileAccess.READ)
	if file == null:
		_fail("cannot open %s" % overlay_path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		_fail("%s is not a JSON object" % overlay_path)
		return {}
	return parsed as Dictionary


func _build(data: Dictionary, container: Node2D, level: Node) -> void:
	var atlas_path := String(data.get("atlas", ""))
	var sheet: Texture2D = load(atlas_path)
	if sheet == null:
		_fail("cannot load the prop atlas %s" % atlas_path)
		return

	var tint_values: Array = data.get("modulate", [1.0, 1.0, 1.0, 1.0])
	var tint_alpha := 1.0
	if tint_values.size() > 3:
		tint_alpha = float(tint_values[3])
	var prop_tint := Color(
		float(tint_values[0]), float(tint_values[1]),
		float(tint_values[2]), tint_alpha
	)

	# One node owns every body, so the whole overlay can be removed in one go.
	var collision_root := Node2D.new()
	collision_root.name = "ArchiveCollision"
	add_child(collision_root)

	for entry: Dictionary in data.get("props", []):
		var region: Array = entry["source"]
		var width := float(region[2])
		var height := float(region[3])

		var sprite := Sprite2D.new()
		var texture := AtlasTexture.new()
		texture.atlas = sheet
		texture.region = Rect2(float(region[0]), float(region[1]), width, height)
		sprite.texture = texture
		sprite.centered = true
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.modulate = prop_tint
		sprite.name = String(entry.get("id", "archive_prop"))
		sprite.position = Vector2(float(entry["x"]), float(entry["base_y"]))
		# Centred sprite: lifting by half the frame height puts the art's base
		# exactly on the standing line the validator checked.
		sprite.offset = Vector2(0.0, -height * 0.5)
		container.add_child(sprite)
		props_added += 1

		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		var body := StaticBody2D.new()
		body.name = "solid_" + String(entry.get("id", "prop"))
		body.collision_layer = int(data.get("collision_layer", 1))
		body.collision_mask = 0  # a wall: never queries actors
		var shape := RectangleShape2D.new()
		shape.size = Vector2(float(box[2]), float(box[3]))
		var shape_node := CollisionShape2D.new()
		shape_node.shape = shape
		# box[0..1] is the shape CENTRE in level pixels (the JSON contract).
		body.position = Vector2(float(box[0]), float(box[1]))
		body.add_child(shape_node)
		collision_root.add_child(body)
		colliders_added += 1

	print("GATE0 OVERLAY: %d props (%d solid) attached to %s"
		% [props_added, colliders_added, String(level.get("level_data_path"))])


func _fail(message: String) -> void:
	_failures.append(message)
	push_error("Gate0 overlay: " + message)


func get_failures() -> Array[String]:
	return _failures
