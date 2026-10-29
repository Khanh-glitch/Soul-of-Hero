extends "res://tests/survival_foundation_test.gd"

const FIBRE := "reed_fibre"
const PinnedA3 = preload("res://tests/fixtures/a3_86dc2195/adapter/a0_authorized_economy.gd")


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


func _capture_frame(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_expect(image != null and not image.is_empty(), "native frame exists: " + name)
	if image == null or image.is_empty():
		return
	var path := "res://artifacts/roof_%s.png" % name
	_expect(image.save_png(path) == OK, "native frame saved: " + name)
	image.get_region(Rect2i((image.get_width() - 280) / 2, (image.get_height() - 140) / 2, 280, 140)).save_png("res://artifacts/roof_%s_crop.png" % name)


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
	# Exercise Godot's actual mouse event path through Knight._input,
	# _unhandled_input and its normal physics interaction resolver.
	hero.global_position = bed.global_position + Vector2(-7, 8)
	var camera: Camera2D = ow.get(&"camera")
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = root.get_canvas_transform() * bed.global_position
	root.warp_mouse(click.position)
	await process_frame
	hero.set_physics_process(true)
	click.pressed = true
	Input.parse_input_event(click)
	await physics_frame
	await physics_frame
	click.pressed = false
	Input.parse_input_event(click)
	await physics_frame
	hero.set_physics_process(false)
	_expect(String((svc.call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id,
		"normal mouse input activates reachable indoor bed through the Hero")
	await create_timer(0.4).timeout
	await _capture_frame("bed_active")
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

	# Genuine pinned A3 adapter, composed through A0's narrow authority port.
	# The test catalogs are mounted from the immutable fixture in native CI.
	var economy_adapter := PinnedA3.new()
	var economy_port: Node = _save().call(&"create_pinned_economy_port", economy_adapter)
	_expect(economy_port != null and economy_adapter.configure(economy_port), "compose pinned A3 adapter and real SaveService")
	var fixture_grant: Dictionary = economy_adapter.grant_instance("iron_pick", "fixture.unique.token", -1, 70)
	var token := String(fixture_grant.get("instance_id", ""))
	_expect(bool(fixture_grant.get("ok", false)) and not token.is_empty(), "A3 creates real token and attributes atomically")
	_expect(not bool(_save().call(&"drop_inventory_item", token, 1, "fixture.unique.drop")), "generic drop refuses unique token")
	_expect(not bool(_save().call(&"home_transfer_to_storage", "item_stack", token, "fixture.unique.storage")), "home storage refuses unique token")
	_expect(_give(WOOD, 4) and _give(IRON, 1), "chest materials granted for unique-token guard")
	build.select_piece("chest_wood")
	var chest: Dictionary = build.try_place(origin + Vector2i(1, 1), "fixture.unique.chest")
	var chest_id := String(chest.get("entity_id", ""))
	_expect(bool(chest.get("ok", false)), "chest placed for unique-token guard")
	_expect(not bool(svc.call(&"transfer_to_container", chest_id, token, 1, "fixture.unique.chest.transfer")), "chest direct transfer refuses unique token")
	_expect(bool(_give(STONE, 1)), "ordinary material granted for mixed chest sweep")
	var sweep: Dictionary = svc.call(&"deposit_all", chest_id)
	_expect(bool(sweep.get("ok", false)) and _count(STONE) == 0 and _count(token) == 1, "mixed sweep stores ordinary item while retaining unique token")

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
	_expect(_count(token) == 1 and not ((doc.get("death_bags", {}) as Dictionary).get(bag_id, {}) as Dictionary).get("stacks", {}).has(token),
		"death retains unique token instead of orphaning its coupled A3 record")
	await _capture_frame("bed_death")
	# Simulate process restart after death committed but before respawn.
	paused = false
	_expect(bool(_save().call(&"reload_save")), "reload committed pending death from disk")
	ow = await _reload_world(ow)
	build = ow.get(&"survival_build")
	hero = ow.get(&"player")
	hero.set_physics_process(false)
	_expect(bool(hero.get(&"dead")) and String((svc.call(&"document") as Dictionary).get("pending_death", "")) == bag_id,
		"restart restores death and does not create a duplicate bag")
	_expect(_count(token) == 1, "protected A3 token survives death and reload exactly once")
	var economy: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("survival_economy", {})
	var attributes: Dictionary = (economy.get("instances", {}) as Dictionary).get(token, {})
	_expect(int(attributes.get("condition", 0)) == 70 and String(attributes.get("location", "")) == "bag", "A3 token attributes remain coupled through death and reload")
	var hud: Node = ow.get(&"hud")
	var button := hud.find_child("Respawn", true, false) as Button
	_expect(button != null and button.is_visible_in_tree(), "paused overworld exposes an actual respawn button")
	if button != null:
		await process_frame
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = button.get_global_rect().get_center()
		root.warp_mouse(event.position)
		await process_frame
		event.pressed = true
		Input.parse_input_event(event)
		await process_frame
		event.pressed = false
		Input.parse_input_event(event)
		await process_frame
	_expect(not bool(hero.get(&"dead")), "normal GUI mouse input respawns actual Hero via active bed")
	_expect(not bool(hero.get(&"dead")) and root.get_node("GameSession").get(&"checkpoint") == old_checkpoint,
		"overworld respawn keeps dungeon checkpoint untouched")
	_expect(String((svc.call(&"document") as Dictionary).get("pending_death", "")) == "", "respawn commit clears pending death")
	await create_timer(0.4).timeout
	await _capture_frame("bed_respawn")
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
		# Dispatch a real world click through Knight input and physics rather than
		# calling the bag method; this is automated input, not a human playtest.
		camera = ow.get(&"camera")
		camera.reset_smoothing()
		camera.force_update_scroll()
		await process_frame
		var recovery_click := InputEventMouseButton.new()
		recovery_click.button_index = MOUSE_BUTTON_LEFT
		recovery_click.position = root.get_canvas_transform() * (bag as Node2D).global_position
		root.warp_mouse(recovery_click.position)
		await process_frame
		hero.set_physics_process(true)
		recovery_click.pressed = true
		Input.parse_input_event(recovery_click)
		await physics_frame
		await physics_frame
		recovery_click.pressed = false
		Input.parse_input_event(recovery_click)
		await physics_frame
		hero.set_physics_process(false)
		_expect(_count(STONE) == 3, "normal world mouse input recovers bag without item loss")
		_expect(not bool(svc.call(&"recover_death_bag", bag_id)), "replaying recovery cannot duplicate")
	_expect(bool(svc.call(&"is_recipe_learned", "bed_test_recipe")), "knowledge remains after bag recovery")
	var inject_bag := func(candidate: Dictionary) -> bool:
		var survival: Dictionary = candidate.get("survival", {})
		var bags: Dictionary = survival.get("death_bags", {})
		bags["synthetic_bad_bag"] = {"region": "hollow_marches", "position": [0, 0], "stacks": {token: {"kind": "key_item", "quantity": 1}}}
		survival["death_bags"] = bags
		candidate["survival"] = survival
		return true
	_expect(not bool(_save().call(&"transact_once", "fixture.corrupt.bag", inject_bag)), "commit guard refuses malformed duplicate token in a bag")
	_expect(not bool(svc.call(&"recover_death_bag", "synthetic_bad_bag")) and _count(token) == 1,
		"recovery cannot duplicate a rejected malformed token bag")
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
	_expect(_give(STONE, 1), "material granted for fallback death")
	hero.call(&"kill")
	_expect(bool(ow.call(&"_respawn_overworld_hero")) and not bool(hero.get(&"dead")), "actual death after bed removal revives at safe fallback")
	_expect(not bool(ow.call(&"_respawn_overworld_hero")), "duplicate respawn cannot create a second life")
	var bags_before_dungeon: Dictionary = (svc.call(&"document") as Dictionary).get("death_bags", {}).duplicate(true)
	ow.queue_free()
	await process_frame
	var scene := load("res://game/main.tscn") as PackedScene
	var dungeon := scene.instantiate()
	_host.add_child(dungeon)
	await process_frame
	await physics_frame
	var dungeon_hero := get_first_node_in_group(&"player") as CharacterBody2D
	_expect(dungeon_hero != null, "production dungeon Hero loads after overworld")
	if dungeon_hero != null:
		dungeon_hero.set_physics_process(false)
		var dungeon_checkpoint := Vector2(124, 132)
		root.get_node("GameSession").set(&"checkpoint", dungeon_checkpoint)
		dungeon_hero.call(&"kill")
		_expect(bool(dungeon_hero.get(&"dead")), "production dungeon Hero uses original death lifecycle")
		_expect((svc.call(&"document") as Dictionary).get("death_bags", {}) == bags_before_dungeon,
			"dungeon death does not create an overworld-coordinate bag")
		dungeon_hero.call(&"respawn")
		_expect(dungeon_hero.global_position == dungeon_checkpoint, "dungeon respawn retains its own checkpoint")
	paused = false
	dungeon.queue_free()
	await process_frame
	_body_complete = true
