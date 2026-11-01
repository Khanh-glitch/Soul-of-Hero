extends "res://tests/overworld_runtime_case.gd"
## The Marches remember. Everything the player earns in the world survives a
## save, a fresh boot, and a second world build — and the state is written as a
## versioned schema the next build can actually read back.


func _body() -> void:
	var state: RefCounted = ow.get("state")
	var world: Node = ow.get("world")
	var place: Node = ow.get("player")
	if state == null or world == null or place == null:
		_expect(false, "world, state and player available")
		return

	# Earn something in every persisted category. The camp restore comes first
	# because resting tops provisions up; setting the pack afterwards is what the
	# save is actually being asked to carry.
	state.call("activate_camp", &"camp_crossroads", Vector2(152 * 16, 188 * 16))
	state.set("provisions", 43)
	_expect(bool(state.call("is_camp_visited", &"camp_crossroads")), "camp visited before save")
	state.call("open_shortcut", &"short_beacon_road")
	await _frames(2)
	# Discoveries are granted by the controller, which routes the payout through
	# a reward transaction and flips this flag.
	var discoveries: Dictionary = state.get("discoveries")
	discoveries["d_crypt_offer"] = true
	state.call("mark_dirty")
	ow.call("teleport_to", Vector2(120 * 16 + 8, 170 * 16 + 8))
	await _physics_frames(3)
	var saved_position: Vector2 = place.global_position
	var before: Dictionary = state.call("snapshot")
	_expect(int(before.get("schema", 0)) == 2, "snapshot declares schema 2")

	_expect(bool(state.call("save_now")), "save_now() committed the snapshot")
	_expect(not bool(state.call("is_dirty")), "a successful save clears the dirty flag")

	# The bytes are really on disk, under the schema the loader reads.
	var file := FileAccess.open(save_path, FileAccess.READ)
	_expect(file != null, "save file exists at the configured path")
	if file == null:
		return
	var document: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(document is Dictionary, "save file is valid JSON")
	if document is Dictionary:
		var root: Variant = (document as Dictionary).get("overworld", null)
		_expect(root is Dictionary, "save has an 'overworld' section")
		if root is Dictionary:
			var section: Variant = (root as Dictionary).get("hollow_marches", null)
			_expect(section is Dictionary, "save has the hollow_marches section")
			if section is Dictionary:
				var saved: Dictionary = section
				_expect_equal(int(saved.get("provisions", -1)), 43, "provisions written to disk")
				_expect(bool((saved.get("camps", {}) as Dictionary).get("camp_crossroads", false)),
					"camp written to disk")
				_expect(bool((saved.get("shortcuts", {}) as Dictionary).get("short_beacon_road", false)),
					"shortcut written to disk")
				var position: Array = saved.get("last_position", [])
				_expect(position.size() == 2 and absf(float(position[0]) - saved_position.x) < 2.0,
					"world position written to disk (%s)" % [position])

	# Now rebuild the world from scratch: this is the reload the player sees.
	ow.queue_free()
	for _i in range(6):
		await process_frame
	_expect(not is_instance_valid(ow), "first world torn down")
	var second := (load("res://game/overworld/chapter1_overworld.tscn") as PackedScene).instantiate()
	_host.add_child(second)
	var deadline := Time.get_ticks_msec() + 60000
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if bool(second.call("is_world_ready")):
			break
	_expect(bool(second.call("is_world_ready")), "world rebuilds from the same save")
	if not bool(second.call("is_world_ready")):
		return

	var restored: RefCounted = second.get("state")
	_expect_equal(int(restored.call("snapshot").get("provisions", -1)), 43,
		"provisions restored after reload")
	_expect(bool(restored.call("is_camp_visited", &"camp_crossroads")), "camp restored after reload")
	_expect(bool(restored.call("is_shortcut_open", &"short_beacon_road", root.get_node_or_null("AppFlow"))),
		"shortcut restored after reload")
	var rebuilt_world: Node = second.get("world")
	var box: Array = rebuilt_world.call("shortcut_carve_box", "short_beacon_road")
	_expect(box.size() == 4, "restored world knows the shortcut's carve box")
	if box.size() == 4:
		var probe := Vector2i(int(box[0]) + 1, int(box[1]) + 1)
		_expect(not bool(rebuilt_world.call("is_solid_cell", probe.x, probe.y)),
			"a restored shortcut is passable again, not just drawn open")
	var player_two: CharacterBody2D = second.get("player")
	_expect(player_two.global_position.distance_to(saved_position) < 48.0,
		"player resumes where the save left them (%.1f px out)"
		% player_two.global_position.distance_to(saved_position))

	# A corrupt or future-schema block must not crash the loader. The live world
	# must be gone first, or its autosave would overwrite the corrupt block we
	# are trying to test.
	second.queue_free()
	for _i in range(8):
		await process_frame
	_expect(not is_instance_valid(second), "second world torn down before corrupting the save")
	var save := root.get_node_or_null("SaveService")
	if save != null:
		var corrupt_path: Array[String] = ["overworld", "hollow_marches"]
		_expect(bool(save.call(&"patch_state_path", corrupt_path,
			{"schema": 99, "provisions": 1})), "wrote a future-schema block")
		_expect(bool(save.call(&"save_now")), "flushed the future-schema block")
	var third := (load("res://game/overworld/chapter1_overworld.tscn") as PackedScene).instantiate()
	_host.add_child(third)
	deadline = Time.get_ticks_msec() + 60000
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if bool(third.call("is_world_ready")):
			break
	_expect(bool(third.call("is_world_ready")), "a future schema boots with defaults instead of crashing")
	if bool(third.call("is_world_ready")):
		_expect_equal(int(third.get("state").call("snapshot").get("provisions", -1)), 80,
			"unreadable schema falls back to the authored starting provisions")
	_done()
