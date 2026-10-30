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
				body.position = Vector2(int(cell[0]) * 16 + 8, int(cell[1]) * 16 + 8)
				var collision := CollisionShape2D.new()
				var box := RectangleShape2D.new()
				box.size = Vector2(16, 16)
				collision.shape = box
				body.add_child(collision)
				world.blocker_root.add_child(body)
				mounted_obstacles += 1

func _build_survival() -> void:
	super._build_survival()
	if survival_build != null:
		survival_build.annex_disabled_from_x = 384
