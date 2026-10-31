extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## Does A8's locally reconstructed walk prove anything about the production Hero?
##
## ## The claim being audited
## A8's `native_poi_ragnarok_test.gd` asserts things like *"actor physically walks
## from Quarry entrance to work stand"* and *"day-12 west alternate route remains
## physically traversable"*. It does that with its own actor, its own shape and a
## mover that issues **one `move_and_collide` for the entire distance**. Production
## gameplay moves a `Knight` at 96 px/s through `move_and_slide`, which slides along
## surfaces it touches.
##
## Two movers with different semantics can disagree in both directions:
##
## * **slide versus stop** — a diagonal approach to a wall corner slides in production
##   but stops dead in the harness, so the harness can call "impassable" a corner a
##   player walks around;
## * **one long sweep versus many small ones** — a single sweep can tunnel or catch a
##   gap that frame-sized steps never touch;
## * **unbounded step versus bounded speed** — the harness reaches any distance in one
##   call, so it can never report how long a route takes, and a route that costs a
##   player 20 seconds looks free.
##
## This probe measures those differences on the *same mounted geometry*, from the
## same cell, with the same body size. It does not re-run A8's POI scenes (their
## geometry needs A8's own mount), so it audits the mover, not A8's whole test, and
## says so. It needs no Waystation flag: any authored wall will do.

const SHADOW = preload("res://tests/survival/balance_native_r9/r9_shadow_mover.gd")
const TILE := 16


func _body() -> void:
	probe_id = "R9SHADOW"
	probe_title = "A8's harness mover (one move_and_collide per step) against the production Hero"
	owner_action = (
		"A8: state the mover's semantics in the acceptance claim (\"a body of this size can reach this cell with "
		+ "single-sweep collision\") or mount the production Knight for route claims. A7 accepts either, but not a "
		+ "harness walk presented as proof of how a player moves."
	)

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return

	# ---- 1. the contracts, side by side ---------------------------------
	var hero_shape := "none"
	var hero_rect := Vector2.ZERO
	var hero_offset := Vector2.ZERO
	for child: Node in hero.get_children():
		if child is CollisionShape2D and String(child.name) == "BodyShape":
			var shape: Shape2D = (child as CollisionShape2D).shape
			hero_offset = (child as CollisionShape2D).position
			if shape is RectangleShape2D:
				hero_shape = "RectangleShape2D"
				hero_rect = (shape as RectangleShape2D).size
	_note("production hero: motion_mode=%d layer=%d mask=%d shape=%s size=%s offset=%s speed=%.1f" % [
		hero.motion_mode, hero.collision_layer, hero.collision_mask, hero_shape,
		str(hero_rect), str(hero_offset), float(hero.get(&"move_speed")),
	])
	var shadow: CharacterBody2D = SHADOW.new() as CharacterBody2D
	shadow.call(&"configure_world_only", true)
	root.add_child(shadow)
	await physics_frame
	_note("shadow mover: motion_mode=%d layer=%d mask=%d shape=RectangleShape2D size=(12, 16) offset=(0, -8) step=move_and_collide(whole)" % [
		shadow.motion_mode, shadow.collision_layer, shadow.collision_mask,
	])
	_expect(hero_shape == "RectangleShape2D" and hero_rect == Vector2(12, 16) and hero_offset == Vector2(0, -8),
		"the production Hero's body is the 12x16 rectangle A8's A1 harness reproduces")
	_expect(hero.collision_mask != shadow.collision_mask,
		"the two movers do not share a collision mask (production %d, shadow %d)" % [hero.collision_mask, shadow.collision_mask])
	_expect(hero.motion_mode == 1, "the production Hero is a floating body, not A8's default grounded mode")

	# ---- 2. slide versus stop, on one wall both movers face ------------
	# A fixture wall rather than an authored one, and labelled as such: the variable
	# under test is the *mover*, so the geometry must be identical for both bodies.
	# Using an authored wall would make a route-finding failure look like a mover
	# difference, which is the class of confusion this round exists to remove.
	var wall := StaticBody2D.new()
	wall.name = "A7FixtureWall"
	wall.collision_layer = 1
	wall.collision_mask = 0
	var wall_shape := CollisionShape2D.new()
	var wall_rect := RectangleShape2D.new()
	wall_rect.size = Vector2(16, 160)
	wall_shape.shape = wall_rect
	wall.add_child(wall_shape)
	var hero_start := hero.global_position
	# Left face 16 px to the Hero's right: contact after ~10 px of travel.
	wall.global_position = hero_start + Vector2(16 + 8, 0)
	root.add_child(wall)
	await physics_frame
	_note("FIXTURE_WALL at %s size=(16, 160) hero_start=%s" % [str(wall.global_position), str(hero_start)])

	Input.action_press("move_right")
	Input.action_press("move_up")
	for i in 60:
		await physics_frame
	Input.action_release("move_right")
	Input.action_release("move_up")
	await physics_frame
	var hero_travel := hero.global_position - hero_start
	_note("production diagonal-into-wall travel=%s (dx=%.2f dy=%.2f)" % [str(hero_travel), hero_travel.x, hero_travel.y])

	shadow.global_position = hero_start
	await physics_frame
	shadow.call(&"step", Vector2(40, -40))
	await shadow.call(&"await_step")
	var shadow_travel := shadow.global_position - hero_start
	_note("shadow diagonal-into-wall travel=%s collided=%s" % [str(shadow_travel), str(shadow.last_collision != null)])

	# The Hero slides up the wall, clears its top edge and keeps the eastward input:
	# both axes moved a long way, and it never ends up inside the wall.
	_expect(hero_travel.y < -20.0,
		"the production Hero slides along the wall it is pressed into (dy=%.2f px up)" % hero_travel.y)
	_expect(hero_travel.x > 20.0,
		"after sliding clear of the wall's top edge the Hero keeps travelling east (dx=%.2f px)" % hero_travel.x)
	_expect(not _point_in_wall(hero.global_position, wall.global_position),
		"the Hero is not inside the fixture wall after the push, so this is sliding, not tunnelling")
	_expect(shadow.last_collision != null, "the harness mover also contacts the same wall")
	_expect(absf(shadow_travel.y) < absf(hero_travel.y) * 0.25,
		"the harness mover discards the rest of its step at contact: dy=%.2f against the player's %.2f"
		% [shadow_travel.y, hero_travel.y])
	_note(
		"slide_measured: the player keeps %.1f px of vertical travel where the harness mover keeps %.1f px"
		% [absf(hero_travel.y), absf(shadow_travel.y)]
	)
	wall.queue_free()
	await physics_frame

	# ---- 3. one step versus a real frame budget -------------------------
	# Same distance, two budgets: 30 frames of ordinary input against one harness step.
	var open_start := hero.global_position
	await _hold("move_right", 30)
	var hero_distance := hero.global_position.x - open_start.x
	_note("production 30 frames of move_right = %.2f px" % hero_distance)
	shadow.global_position = open_start
	await physics_frame
	shadow.call(&"step", Vector2(hero_distance, 0))
	await shadow.call(&"await_step")
	var shadow_distance := shadow.global_position.x - open_start.x
	_note("shadow one step = %.2f px (steps=%d)" % [shadow_distance, int(shadow.steps)])
	_expect(absf(hero_distance) > 1.0, "30 frames of ordinary input move the production Hero")
	_expect(absf(shadow_distance - hero_distance) < 0.5,
		"the shadow covers the same distance in a single step (%.2f px), so its step count says nothing about time"
		% shadow_distance)
	_expect(hero_distance <= float(hero.get(&"move_speed")) * 0.5 + 1.0,
		"the production Hero is speed-bounded over those 30 frames (%.2f px <= speed * 0.5 s)" % hero_distance)

	# ---- 4. verdict on transferability ----------------------------------
	_note(
		"TRANSFER: A8's mover shares the body size and the world-collision layer, and differs in mask, slide "
		+ "response and step granularity. Its 'reachable' claims are evidence about geometry, not about player "
		+ "movement; its 'blocked' claims are stricter than the player's route; and no claim of either kind can "
		+ "carry pacing."
	)
	shadow.queue_free()
	_release_all()
	_done()


# --------------------------------------------------------------------- helpers
func _point_in_wall(point: Vector2, wall_center: Vector2) -> bool:
	return absf(point.x - wall_center.x) < 8.0 and absf(point.y - wall_center.y) < 80.0


func _cell_center(cell: Vector2i) -> Vector2:
	return Vector2(float(cell.x) * TILE + TILE * 0.5, float(cell.y) * TILE + TILE * 0.5)


func _finish() -> void:
	_release_all()
	super._finish()
