extends "res://tests/survival_foundation_test.gd"
## Fixture-funded setup; real production Hero, BuildSystem and SaveService.
## Exercises the last-wall rejection and physical exit; not a fresh B0 journey.

func _finish() -> void:
	for action: String in ["move_up", "move_down", "move_left", "move_right"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL HERO EXIT PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL HERO EXIT FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _body() -> void:
	var ow := _host.get_child(0)
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var hero := ow.get(&"player") as CharacterBody2D
	var world := ow.get(&"world") as OverworldWorld
	_clear_inventory()
	_expect(_give(WOOD, 40) and _give(IRON, 1), "fixture materials use the sole inventory")
	build.select_piece("wall_wood")
	var origin := Vector2i(-1, -1)
	for y in range(6, world.height - 7, 4):
		if origin.x >= 0:
			break
		for x in range(6, world.width - 7, 4):
			hero.global_position = Vector2((x + 2) * 16 + 8, (y + 2) * 16 + 15)
			var valid := true
			for dy in range(-3, 6):
				for dx in range(-1, 6):
					if not build.validate_cell(Vector2i(x + dx, y + dy)).is_empty():
						valid = false
			if valid:
				origin = Vector2i(x, y)
				break
	_expect(origin.x >= 0, "real world has legal five by five room site")
	if origin.x < 0:
		_body_complete = true
		return
	hero.set_physics_process(false)
	for y in range(5):
		for x in range(5):
			if x != 0 and x != 4 and y != 0 and y != 4:
				continue
			if x == 2 and y == 0:
				continue
			_expect(bool(build.try_place(origin + Vector2i(x, y)).get("ok", false)), "paid perimeter %d,%d" % [x, y])
	await physics_frame
	var gap := origin + Vector2i(2, 0)
	var wood := _count(WOOD)
	var before: Dictionary = _save().call(&"get_snapshot")
	var refused := build.try_place(gap, "hero.exit.final.wall")
	var after: Dictionary = _save().call(&"get_snapshot")
	_expect(not bool(refused.get("ok", true)) and refused.get("reason", "") == "no_hero_exit", "final wall is rejected while Hero is inside")
	_expect(_count(WOOD) == wood and before == after and build.entity_at_layer(gap, "object").is_empty(), "rejected last wall changes no item, receipt, save or occupancy")
	var retry := build.try_place(gap, "hero.exit.final.wall")
	_expect(not bool(retry.get("ok", true)) and _count(WOOD) == wood and before == (_save().call(&"get_snapshot") as Dictionary), "same failed key retry remains a no-op")
	# This is the actual Hero controller and collision, driven by the move action.
	hero.set_physics_process(true)
	Input.action_press("move_up")
	for i in range(120):
		await physics_frame
	print("HERO_EXIT_WALK origin=%s hero=%s velocity=%s collisions=%d north1=%s north2=%s gap=%s" % [str(origin), str(hero.global_position), str(hero.velocity), hero.get_slide_collision_count(), str(world.is_solid_cell(gap.x, gap.y - 1)), str(world.is_solid_cell(gap.x, gap.y - 2)), str(build.entity_at_layer(gap, "object"))])
	for index in range(hero.get_slide_collision_count()):
		var hit := hero.get_slide_collision(index)
		var collider := hit.get_collider()
		print("HERO_EXIT_COLLISION collider=%s path=%s point=%s normal=%s" % [str(collider), str((collider as Node).get_path() if collider is Node else "non-node"), str(hit.get_position()), str(hit.get_normal())])
	Input.action_release("move_up")
	await physics_frame
	_expect(hero.global_position.y < origin.y * 16, "actual Hero walks through unsealed last opening")
	_body_complete = true
