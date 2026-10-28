extends "res://tests/overworld_runtime_case.gd"
## Provisions are survival, not a wall: the wilds drain, safe ground does not,
## hazards drain faster, camps restore, and an empty pack slows the march rather
## than stopping it.


func _body() -> void:
	var state: RefCounted = ow.get("state")
	var player: CharacterBody2D = ow.get("player")
	if state == null or player == null:
		_expect(false, "state and player available")
		return

	var survival: Dictionary = (ow.get("world_data") as Dictionary).get("survival", {})
	var wild_rate := float(survival.get("drain_per_second_wild", 0.0))
	var hazard_rate := float(survival.get("drain_per_second_hazard", 0.0))
	_expect(wild_rate > 0.0, "authored wild drain is positive (%.2f/s)" % wild_rate)
	_expect(hazard_rate > wild_rate, "hazard drain exceeds wild drain (%.2f > %.2f)"
		% [hazard_rate, wild_rate])

	# The tick is the only thing that moves provisions; drive it directly with
	# known inputs so the arithmetic is testable rather than observed.
	state.set("provisions", 50)
	state.call("tick", 10.0, false, false)
	_expect_equal(int(state.get("provisions")), 50 - int(round(wild_rate * 10.0)),
		"ten wild seconds drain at the authored rate")

	state.set("provisions", 50)
	state.call("tick", 10.0, true, false)
	_expect(int(state.get("provisions")) < 50 - int(round(wild_rate * 10.0)),
		"the same ten seconds in a hazard cost more")

	state.set("provisions", 50)
	state.call("tick", 10.0, false, true)
	_expect_equal(int(state.get("provisions")), 50, "safe ground (a camp) drains nothing")

	# Camps restore; the authored amount is a real number, not a no-op.
	var camp: Node = (ow.get("camps") as Dictionary).get(&"camp_crossroads")
	_expect(camp != null, "camp_crossroads exists")
	if camp != null:
		state.set("provisions", 10)
		ow.call("teleport_to", camp.call("rest_position"))
		await _physics_frames(3)
		_expect(bool(ow.call("interact_with", camp)), "camp accepts a rest")
		await _physics_frames(2)
		_expect(int(state.get("provisions")) > 10,
			"resting restores provisions (10 -> %d)" % int(state.get("provisions")))
		_expect(bool(state.call("is_camp_visited", &"camp_crossroads")), "camp marked visited")

	# Empty pack: slow, not stopped, and never negative.
	var base_speed := float(ow.get("_base_move_speed"))
	state.set("provisions", 0)
	await _physics_frames(40)
	var weary := float(player.get(&"move_speed"))
	_expect(weary < base_speed, "empty pack lowers speed (%.1f < %.1f)" % [weary, base_speed])
	_expect(weary > base_speed * 0.4, "empty pack never freezes the march (%.1f px/s)" % weary)
	ow.call("teleport_to", player.global_position + Vector2(4, 0))
	var before := player.global_position
	Input.action_press(&"move_right")
	await _physics_frames(30)
	Input.action_release(&"move_right")
	await _physics_frames(2)
	_expect(player.global_position.x - before.x > 8.0,
		"an exhausted knight still walks (%.1f px)" % (player.global_position.x - before.x))

	state.set("provisions", 100)
	await _physics_frames(3)
	_expect(is_equal_approx(float(player.get(&"move_speed")), base_speed),
		"a full pack restores full speed")

	# Tick clamps instead of going negative.
	state.set("provisions", 1)
	state.call("tick", 60.0, true, false)
	_expect(int(state.get("provisions")) >= 0, "provisions clamp at zero, never negative")


	_done()
