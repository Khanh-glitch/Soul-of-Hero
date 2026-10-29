extends "res://tests/survival_foundation_test.gd"

const FIBRE := "reed_fibre"


func _finish() -> void:
	paused = false
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL BED RESPAWN PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL BED RESPAWN FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _body() -> void:
	var ow := _host.get_child(0)
	var build: SurvivalBuildSystem = ow.get(&"survival_build")
	var hero: CharacterBody2D = ow.get(&"player")
	var world: OverworldWorld = ow.get(&"world")
	var svc := _survival()
	_clear_inventory()
	_expect(_give(WOOD, 48) and _give(IRON, 2), "resources granted via SaveService")
	build.select_piece("wall_wood")
	var origin := Vector2i(-1, -1)
	for y in range(5, world.height - 9, 4):
		if origin.x >= 0:
			break
		for x in range(5, world.width - 9, 4):
			hero.global_position = Vector2((x + 3) * 16 + 8, (y + 3) * 16 + 8)
			var valid := true
			for yy in range(-1, 8):
				for xx in range(-1, 8):
					if not build.validate_cell(Vector2i(x + xx, y + yy)).is_empty():
						valid = false
			if valid:
				origin = Vector2i(x, y)
				break
	_expect(origin.x >= 0, "legal production-world room footprint")
	if origin.x < 0:
		_body_complete = true
		return
	hero.set_physics_process(false)
	build.select_piece("bed_wood")
	var before := _count(WOOD)
	_expect(not bool(build.try_place(origin).get("ok", false)) and _count(WOOD) == before,
		"outdoor bed refused without material charge")
	build.select_piece("wall_wood")
	var breach_id := ""
	for yy in range(7):
		for xx in range(7):
			if xx != 0 and xx != 6 and yy != 0 and yy != 6:
				continue
			if xx == 3 and yy == 0:
				continue
			var result: Dictionary = build.try_place(origin + Vector2i(xx, yy))
			_expect(bool(result.get("ok", false)), "paid wall %d,%d" % [xx, yy])
			if xx == 0 and yy == 3:
				breach_id = String(result.get("entity_id", ""))
	build.select_piece("door_wood")
	var door: Dictionary = build.try_place(origin + Vector2i(3, 0))
	_expect(bool(door.get("ok", false)), "paid door closes enclosure")
	_expect(_give(WOOD, 4), "bed timber granted")
	build.select_piece("bed_wood")
	var paid_before := _count(WOOD)
	var iron_before := _count(IRON)
	var bed_result: Dictionary = build.try_place(origin + Vector2i(3, 3), "survival.test.bed.purchase")
	var bed_id := String(bed_result.get("entity_id", ""))
	_expect(bool(bed_result.get("ok", false)) and _count(WOOD) == paid_before - 4 and _count(IRON) == iron_before - 1,
		"indoor bed charged atomically")
	var again: Dictionary = build.try_place(origin + Vector2i(4, 3), "survival.test.bed.purchase")
	_expect(not bool(again.get("ok", false)) and _count(WOOD) == 0, "replayed bed purchase cannot duplicate or charge")
	await process_frame
	await physics_frame
	var bed := build.structure_node(bed_id)
	_expect(bed != null and bed.get_node_or_null("Solid") != null, "bed projects live collision")
	hero.global_position = Vector2((origin.x + 2) * 16 + 8, (origin.y + 3) * 16 + 15)
	var far := Node2D.new()
	_host.add_child(far)
	_expect(not bool(build.activate_bed(bed_id, far).get("ok", false)), "foreign actor cannot activate")
	far.queue_free()
	var activation: Dictionary = build.activate_bed(bed_id, hero)
	_expect(bool(activation.get("ok", false)), "owned reachable enclosed bed has safe exit with closed door")
	var repeated: Dictionary = build.activate_bed(bed_id, hero)
	_expect(bool(repeated.get("ok", false)) and bool(repeated.get("already_active", false)), "double activation idempotent")
	_expect(String((svc.call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id, "anchor commits bed identity")
	_expect(bool(_save().call(&"reload_save")), "reload anchor from disk")
	ow = await _reload_world(ow)
	build = ow.get(&"survival_build")
	hero = ow.get(&"player")
	hero.set_physics_process(false)
	await physics_frame
	_expect(String((svc.call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id,
		"active bed survives world restart")
	_expect(bool(build.bed_wake_position(bed_id).get("ok", false)), "closed door permits a safe wake and exit")
	var doorway := build.structure_node(String(door.get("entity_id", "")))
	var blocker := StaticBody2D.new()
	blocker.collision_layer = 1
	var blocker_shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(16, 16)
	blocker_shape.shape = rect
	blocker.add_child(blocker_shape)
	ow.add_child(blocker)
	blocker.global_position = doorway.global_position + Vector2(8, -8)
	await physics_frame
	_expect(not bool(build.bed_wake_position(bed_id).get("ok", true)), "obstructed door exit invalidates bed wake")
	_expect(String((ow.call(&"_resolve_overworld_respawn") as Dictionary).get("source", "")) == "camp", "obstructed bed selects safe fallback")
	blocker.queue_free()
	await physics_frame
	var enemy := CharacterBody2D.new()
	enemy.collision_layer = 4
	var enemy_shape := CollisionShape2D.new()
	var enemy_rect := RectangleShape2D.new()
	enemy_rect.size = Vector2(8, 8)
	enemy_shape.shape = enemy_rect
	enemy.add_child(enemy_shape)
	ow.add_child(enemy)
	enemy.global_position = build.structure_node(bed_id).global_position + Vector2(8, 8)
	await physics_frame
	_expect(not bool(build.bed_wake_position(bed_id).get("ok", true)), "nearby enemy-layer actor prevents unsafe bed wake")
	enemy.queue_free()
	await physics_frame
	hero.global_position = doorway.global_position + Vector2(24, 31)
	_expect(doorway.interact(hero), "open door from reach")
	await process_frame
	await physics_frame
	_expect(bool(build.bed_wake_position(bed_id).get("ok", false)), "open doorway permits safe bed wake")
	_expect(doorway.interact(hero), "close clear door from reach")
	await process_frame
	await physics_frame

	_expect(bool(svc.call(&"learn_recipe", "bed_test_recipe", "test", "survival.test.recipe")), "learned knowledge committed")
	_expect(_give(STONE, 3), "carried materials granted before death")
	var old_checkpoint := Vector2(123, 456)
	root.get_node("GameSession").set(&"checkpoint", old_checkpoint)
	hero.global_position = Vector2((origin.x + 2) * 16 + 8, (origin.y + 3) * 16 + 15)
	hero.call(&"kill")
	var doc: Dictionary = svc.call(&"document")
	var bag_id := String(doc.get("pending_death", ""))
	_expect(bool(hero.get(&"dead")) and not bag_id.is_empty() and _count(STONE) == 0,
		"actual Hero death atomically creates one bag and removes carried stack")
	_expect(bool(svc.call(&"is_recipe_learned", "bed_test_recipe")), "death never transfers permanent knowledge")
	# Simulate process restart after death committed but before respawn.
	paused = false
	_expect(bool(_save().call(&"reload_save")), "reload committed pending death from disk")
	ow = await _reload_world(ow)
	build = ow.get(&"survival_build")
	hero = ow.get(&"player")
	hero.set_physics_process(false)
	_expect(bool(hero.get(&"dead")) and String((svc.call(&"document") as Dictionary).get("pending_death", "")) == bag_id,
		"restart restores death and does not create a duplicate bag")
	_expect(bool(ow.call(&"_respawn_overworld_hero")), "actual Hero respawns via active bed")
	_expect(not bool(hero.get(&"dead")) and root.get_node("GameSession").get(&"checkpoint") == old_checkpoint,
		"overworld respawn keeps dungeon checkpoint untouched")
	_expect(String((svc.call(&"document") as Dictionary).get("pending_death", "")) == "", "respawn commit clears pending death")
	var bag: Node = (ow.get(&"_death_bags") as Dictionary).get(bag_id, null)
	_expect(bag != null, "death bag projected in live overworld")
	if bag != null:
		hero.global_position = (bag as Node2D).global_position
		var fillers: Array[String] = []
		for index in range(35):
			var item := "bed_filler_%02d" % index
			if not _give(item, 50):
				break
			fillers.append(item)
		_expect(not fillers.is_empty() and fillers.size() < 35, "fill inventory to actual capacity")
		_expect(bool(bag.call(&"interact", hero)) and _count(STONE) == 0 and (svc.call(&"document") as Dictionary).get("death_bags", {}).has(bag_id),
			"full inventory refuses recovery and preserves bag")
		if not fillers.is_empty():
			_expect(bool(_save().call(&"consume_inventory_item", fillers[0], 50, "survival.test.bed.free_slot")), "free capacity for bag")
		_expect(bool(bag.call(&"interact", hero)) and _count(STONE) == 3, "recover bag by real interaction without item loss")
		_expect(not bool(svc.call(&"recover_death_bag", bag_id)), "replaying recovery cannot duplicate")
	_expect(bool(svc.call(&"is_recipe_learned", "bed_test_recipe")), "knowledge remains after bag recovery")
	var first_bag_count: int = ((svc.call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).size()
	hero.call(&"kill")
	var second_doc: Dictionary = svc.call(&"document")
	var second_bag := String(second_doc.get("pending_death", ""))
	_expect(not second_bag.is_empty() and second_bag != bag_id and (second_doc.get("death_bags", {}) as Dictionary).size() == first_bag_count + 1,
		"repeated death creates a distinct durable bag")
	_expect(bool(ow.call(&"_respawn_overworld_hero")), "second death respawns independently")
	_expect(bool(_save().call(&"reload_save")), "reload after second respawn")
	_expect((svc.call(&"document") as Dictionary).get("death_bags", {}).has(second_bag), "unrecovered bag persists after restart boundary")

	_expect(bool(svc.call(&"remove_structure", breach_id)), "demolish enclosing wall")
	await physics_frame
	_expect(not bool(build.bed_wake_position(bed_id).get("ok", true)), "breached room invalidates bed")
	var fallback: Dictionary = ow.call(&"_resolve_overworld_respawn")
	_expect(bool(fallback.get("ok", false)) and String(fallback.get("source", "")) == "camp", "invalid bed chooses collision-safe camp fallback")
	_expect(bool(svc.call(&"remove_structure", bed_id)), "demolish activated bed")
	_expect(String((svc.call(&"document") as Dictionary).get("spawn_anchor", "")) == "", "bed demolition clears anchor atomically")
	_body_complete = true
