extends RefCounted
## Bounded A1 source-to-physics projection. Not called by the legacy world yet.
## It changes no rewards, saves, navigation authority or Hero shape. The A0
## connector test and any future production mount must use the same function.
const PINS := {
	"poi_crown_waystation.slice.json": "3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f",
	"poi_crown_relay_shed.slice.json": "5ab0042980a43e64f05aa73870b0d99f906fb95f70492daf2a6b6f7b585b77ad",
}

static func mount(world: OverworldWorld, directory: String) -> Dictionary:
	if world == null or world.blocker_root == null or world.width != 448 or world.height != 256:
		return {"ok": false, "reason": "unexpected_world_bounds"}
	var plans: Array[Dictionary] = []
	var names := {}
	for file_name: String in PINS:
		var file := FileAccess.open(directory.path_join(file_name), FileAccess.READ)
		if file == null:
			return {"ok": false, "reason": "slice_missing:" + file_name}
		var text := file.get_as_text()
		file.close()
		if text.sha256_text() != String(PINS[file_name]):
			return {"ok": false, "reason": "slice_hash_mismatch:" + file_name}
		var raw: Variant = JSON.parse_string(text)
		if not raw is Dictionary or not raw.get("immutable_geography", null) is Dictionary:
			return {"ok": false, "reason": "slice_invalid:" + file_name}
		for entry: Variant in raw.immutable_geography.get("static_obstacles", []):
			if not entry is Dictionary or not bool(entry.get("blocks_nav", false)):
				continue
			var size_data: Variant = entry.get("collision_size_px", [16, 16])
			var offset_data: Variant = entry.get("collision_offset_px", [0, 0])
			if not size_data is Array or size_data.size() != 2 or not offset_data is Array or offset_data.size() != 2:
				return {"ok": false, "reason": "invalid_shape"}
			var size := Vector2(float(size_data[0]), float(size_data[1]))
			var offset := Vector2(float(offset_data[0]), float(offset_data[1]))
			if size.x <= 0.0 or size.y <= 0.0 or absf(offset.x) + size.x * 0.5 > 8.0 or absf(offset.y) + size.y * 0.5 > 8.0:
				return {"ok": false, "reason": "shape_outside_cell"}
			for raw_cell: Variant in entry.get("cells", []):
				if not raw_cell is Array or raw_cell.size() != 2:
					return {"ok": false, "reason": "invalid_cell"}
				var cell := Vector2i(int(raw_cell[0]), int(raw_cell[1]))
				if cell.x < 384 or cell.x >= 448 or cell.y < 192 or cell.y >= 256:
					return {"ok": false, "reason": "cell_outside_annex"}
				var name := "%s_%d_%d" % [String(entry.get("obstacle_id", "obstacle")), cell.x, cell.y]
				if names.has(name) or world.blocker_root.get_node_or_null(name) != null:
					return {"ok": false, "reason": "duplicate_obstacle:" + name}
				names[name] = true
				plans.append({"name": name, "cell": cell, "size": size, "offset": offset})
	if plans.size() != 12:
		return {"ok": false, "reason": "unexpected_obstacle_count"}
	# Validate the whole source before inserting any body; no half-mounted POI.
	for plan: Dictionary in plans:
		var body := StaticBody2D.new()
		body.name = String(plan.name)
		body.collision_layer = 1
		body.collision_mask = 0
		var cell: Vector2i = plan.cell
		var offset: Vector2 = plan.offset
		body.position = Vector2(cell.x * 16 + 8, cell.y * 16 + 8) + offset
		var shape := CollisionShape2D.new()
		var box := RectangleShape2D.new()
		box.size = plan.size
		shape.shape = box
		body.add_child(shape)
		world.blocker_root.add_child(body)
	return {"ok": true, "count": plans.size()}
