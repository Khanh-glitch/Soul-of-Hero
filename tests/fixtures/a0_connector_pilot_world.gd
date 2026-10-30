extends "res://game/overworld/chapter1_overworld.gd"
## CI-only, explicitly instantiated test subclass. Normal world never loads the
## annex, obstacles, or alternate inputs. Files are generated from pinned A1.

const PILOT_ROOT := "res://artifacts/a0-connector/"
const SLICE_ROOT := "res://artifacts/a0-connector/slices/"
var mounted_obstacles := 0

func _world_source_paths() -> Dictionary:
	return {"world": PILOT_ROOT + "annex_world.v1.json", "layers": PILOT_ROOT + "annex_layers.v1.json", "props": PILOT_ROOT + "annex_props.v1.json"}

func _mount_world_extensions() -> void:
	for name: String in ["poi_crown_waystation.slice.json", "poi_crown_relay_shed.slice.json"]:
		var doc := _load_json(SLICE_ROOT + name)
		for raw: Variant in doc.get("immutable_geography", {}).get("static_obstacles", []):
			var obstacle: Dictionary = raw
			if not bool(obstacle.get("blocks_nav", false)):
				continue
			for raw_cell: Variant in obstacle.get("cells", []):
				var cell: Array = raw_cell
				var body := StaticBody2D.new()
				body.name = "%s_%d_%d" % [String(obstacle.get("obstacle_id", "obstacle")), int(cell[0]), int(cell[1])]
				body.collision_layer = 1
				body.collision_mask = 0
				var authored_size: Array = obstacle.get("collision_size_px", [16, 16])
				var authored_offset: Array = obstacle.get("collision_offset_px", [0, 0])
				if authored_size.size() != 2 or authored_offset.size() != 2:
					push_error("Malformed A1 obstacle collision geometry")
					body.free()
					continue
				var size := Vector2(float(authored_size[0]), float(authored_size[1]))
				var offset := Vector2(float(authored_offset[0]), float(authored_offset[1]))
				if size.x <= 0.0 or size.y <= 0.0 or size.x > 16.0 or size.y > 16.0 or absf(offset.x) + size.x * 0.5 > 8.0 or absf(offset.y) + size.y * 0.5 > 8.0:
					push_error("A1 obstacle collision must remain within its authored tile")
					body.free()
					continue
				body.position = Vector2(int(cell[0]) * 16 + 8, int(cell[1]) * 16 + 8) + offset
				var collision := CollisionShape2D.new()
				var box := RectangleShape2D.new()
				box.size = size
				collision.shape = box
				body.add_child(collision)
				world.blocker_root.add_child(body)
				mounted_obstacles += 1

func _build_survival() -> void:
	super._build_survival()
	if survival_build != null:
		survival_build.annex_disabled_from_x = 384
