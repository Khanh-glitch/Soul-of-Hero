extends "res://tests/overworld_runtime_case.gd"
## Gates reflect campaign state honestly: L01 is enterable on a fresh profile,
## L10 is sealed, a sealed gate refuses to launch a run, and clearing a level
## flips the threshold to CLEARED and opens the next one.


func _body() -> void:
	var gates := ow.get("gates") as Dictionary
	_expect(gates.size() == 10, "ten thresholds registered")
	var ids: Array = gates.keys()
	ids.sort()
	for index in range(10):
		var expected := "chapter_1_level_%d" % (index + 1)
		_expect(ids.has(StringName(expected)), "threshold %s exists" % expected)

	var gate_one: Node = gates.get(StringName("chapter_1_level_1"))
	var gate_ten: Node = gates.get(StringName("chapter_1_level_10"))
	if gate_one == null or gate_ten == null:
		_expect(false, "L01 and L10 thresholds present")
		return

	gate_one.call(&"refresh")
	_expect_equal(StringName(gate_one.get("state")), &"ENTER", "L01 accepts on a fresh profile")
	gate_ten.call(&"refresh")
	_expect_equal(StringName(gate_ten.get("state")), &"LOCKED", "L10 sealed on a fresh profile")

	# Every threshold sits on walkable ground with room in front of it.
	var world: Node = ow.get("world")
	var player: CharacterBody2D = ow.get("player")
	for level_id: StringName in ids:
		var gate: Node2D = gates[level_id]
		var cell: Vector2i = world.call("tile_of", gate.global_position)
		_expect(not bool(world.call("is_solid_cell", cell.x, cell.y)),
			"threshold %s is on walkable ground" % level_id)

	# A sealed gate may answer with a refusal message, but it must not start a run.
	ow.call("teleport_to", gate_ten.global_position)
	await _physics_frames(3)
	ow.call("interact_with", gate_ten)
	await _physics_frames(4)
	var flow := root.get_node_or_null("AppFlow")
	_expect_equal(StringName(gate_ten.get("state")), &"LOCKED", "sealed threshold stays sealed")
	if flow != null:
		_expect(not bool(flow.call(&"has_active_run")), "sealed threshold starts no run")

	# Routing is AppRoot's job (covered by the acceptance test); here the
	# campaign authority must simply agree with the thresholds.
	if flow != null:
		_expect(bool(flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_1")),
			"campaign says L01 is unlocked")
		_expect(not bool(flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")),
			"campaign says L10 is locked")

	# Clearing L01 flips its own threshold and opens L02 without a rebuild. The
	# clear is written through the same save path the real completion writes.
	_expect(flow != null, "AppFlow autoload present")
	_mark_cleared(&"chapter_1_level_1")
	gate_one.call(&"refresh")
	_expect_equal(StringName(gate_one.get("state")), &"CLEARED", "L01 reads CLEARED once cleared")
	var gate_two: Node = gates.get(StringName("chapter_1_level_2"))
	if gate_two != null:
		gate_two.call(&"refresh")
		_expect_equal(StringName(gate_two.get("state")), &"ENTER", "clearing L01 opens L02")
	if flow != null:
		_expect(bool(flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_2")),
			"campaign authority agrees that L02 is now open")
	_done()


func _mark_cleared(level_id: StringName) -> void:
	var save := root.get_node_or_null("SaveService")
	_expect(save != null, "SaveService autoload present")
	if save == null:
		return
	var path: Array[String] = ["progression", "campaign", "completed_levels"]
	var completed: Variant = save.call(&"get_value", path, {})
	var updated: Dictionary = (completed as Dictionary).duplicate() if completed is Dictionary else {}
	updated[String(level_id)] = true
	_expect(bool(save.call(&"patch_state_path", path, updated)),
		"writing the clear to the campaign progression")
	_expect(bool(save.call(&"is_transaction_applied", "never-written-key")) == false,
		"unrelated transactions stay unapplied")
