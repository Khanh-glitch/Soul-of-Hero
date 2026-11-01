extends "res://tests/survival_connector_pilot_test.gd"
## Additional isolated A1-pinned composition gate. Unlike the flood-fill report,
## this drives the actual A0 Hero to an actual physics overlap with every legacy
## gate, camp and discovery. It does not activate gates or invent rewards.

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("A0 CONNECTOR ENDPOINT WALK %s - %d checks (NOT PRODUCTION ENABLED)" % ["PASSED" if failures.is_empty() else "BLOCKED", checks])
	quit(0 if failures.is_empty() else 1)

func _body() -> void:
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var world := ow.get(&"world") as OverworldWorld
	var gates := ow.get(&"gates") as Dictionary
	var camps := ow.get(&"camps") as Dictionary
	var discoveries := ow.get(&"discoveries") as Dictionary
	_expect(world.width == 448 and world.height == 256 and int(ow.get("mounted_obstacles")) == 12, "exact bounded pilot and both original obstacle sets are mounted")
	_expect(gates.size() == 10 and camps.size() > 0 and discoveries.size() > 0, "all ten gates plus camps and discoveries exist in the actual controller")
	var targets: Array[Dictionary] = []
	for kind: String in ["gate", "camp", "discovery"]:
		var entries := gates if kind == "gate" else (camps if kind == "camp" else discoveries)
		for key: Variant in entries.keys():
			var area := entries[key] as Area2D
			if is_instance_valid(area):
				targets.append({"kind": kind, "id": String(key), "area": area})
	var visited := 0
	while not targets.is_empty():
		# Choose the nearest remaining real interactable to avoid needless travel;
		# this is route planning only, not a position or interaction mutation.
		var best := 0
		var distance := INF
		for i in targets.size():
			var candidate := targets[i]["area"] as Area2D
			var d := hero.global_position.distance_squared_to(candidate.global_position)
			if d < distance:
				distance = d
				best = i
		var target: Dictionary = targets.pop_at(best)
		var area := target["area"] as Area2D
		var path: Array[Vector2i] = []
		var selected := Vector2i(-1, -1)
		var centre := nav.cell_of(area.global_position)
		var area_shape := area.get_node_or_null("Shape") as CollisionShape2D
		var hero_shape := hero.get_node("BodyShape") as CollisionShape2D
		if area_shape != null and area_shape.shape != null and hero_shape.shape != null:
			for radius in range(0, 4):
				if selected.x >= 0:
					break
				for dy in range(-radius, radius + 1):
					if selected.x >= 0:
						break
					for dx in range(-radius, radius + 1):
						if maxi(absi(dx), absi(dy)) != radius:
							continue
						var cell := centre + Vector2i(dx, dy)
						if not nav.in_bounds(cell) or not _shape_clear(cell, nav, hero, {}):
							continue
						var foot := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
						var transform := Transform2D(0.0, foot + hero_shape.position)
						if not hero_shape.shape.collide(transform, area_shape.shape, area_shape.global_transform):
							continue
						var start := nav.cell_of(hero.global_position)
						var trial := _route(start, cell, nav, hero)
						if start == cell or not trial.is_empty():
							selected = cell
							path = trial
							break
		var walked := selected.x >= 0 and await _walk_path(hero, path)
		# As with the exact locker, the generic helper's 4.5px tolerance can be
		# outside a narrow Area. Refine using normal movement, never teleport.
		var point := Vector2(selected.x * 16 + 8, selected.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 2500
		while walked and not area.overlaps_body(hero) and Time.get_ticks_msec() < deadline:
			_set_direction(point - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		await physics_frame
		var overlap := walked and area.overlaps_body(hero)
		print("A0_ENDPOINT_TRACE kind=%s id=%s cell=%s actual=%s overlap=%s" % [target["kind"], target["id"], str(selected), str(hero.global_position), str(overlap)])
		_expect(overlap, "ordinary input physically overlaps %s %s" % [target["kind"], target["id"]])
		if not overlap:
			break
		visited += 1
	_expect(targets.is_empty() and visited == gates.size() + camps.size() + discoveries.size(), "every original gate, camp and discovery was physically visited")
	_body_complete = true
