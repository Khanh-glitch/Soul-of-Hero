extends "res://tests/survival_normal_home_journey_test.gd"
## Isolated CT-authorized pilot, not production enablement or POI gameplay.
## A1-derived inputs are staged by CI from an exact source SHA. Ordinary input
## walks the real A0 controller; the locker assertion remains an actual gate.
const REACH_PROBE = preload("res://tests/fixtures/a0_connector_reach_probe.gd")
var _legacy_mode := false

func _boot() -> Node:
	var scene := load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_expect(false, "production overworld scene loads")
		return null
	_host = Node2D.new()
	root.add_child(_host)
	var ow := scene.instantiate()
	# Load after autoload initialization: preloading the derived controller from
	# a SceneTree script can compile Knight before GameEvents is registered.
	if not _legacy_mode:
		var pilot_script := load("res://tests/fixtures/a0_connector_pilot_world.gd") as Script
		if pilot_script == null:
			_expect(false, "pilot controller script loads after autoload boot")
			return null
		ow.set_script(pilot_script)
	_host.add_child(ow)
	# R13: this suite plays A0's retained Chapter-1 route world (the pilot one-chunk
	# fixture and the legacy annex). The authored continent is the production world
	# and has its own gate; asking for the annex here is explicit, not a fallback.
	ow.configure({"world_authority": "annex"})
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if ow.is_world_ready():
			return ow
		if not String(ow.get("build_error")).is_empty():
			_expect(false, "pilot production controller builds: " + String(ow.get("build_error")))
			return null
	_expect(false, "pilot production controller builds within deadline")
	return null

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("A0 CONNECTOR PILOT %s - %d checks (NOT PRODUCTION ENABLED)" % ["PASSED" if failures.is_empty() else "BLOCKED", checks])
	quit(0 if failures.is_empty() else 1)

func _set_direction(delta: Vector2) -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	# Same player-faithful input rule as the normal-entry chain: no deadband.
	if delta.x < -0.05:
		Input.action_press("move_left")
	elif delta.x > 0.05:
		Input.action_press("move_right")
	if delta.y < -0.05:
		Input.action_press("move_up")
	elif delta.y > 0.05:
		Input.action_press("move_down")

func _leg(hero: CharacterBody2D, nav: OverworldTraversability, destination: Vector2i, label: String) -> bool:
	var start := nav.cell_of(hero.global_position)
	var path := _route(start, destination, nav, hero)
	_expect(start == destination or not path.is_empty(), label + " live-shape route exists")
	if start != destination and path.is_empty():
		return false
	var walked := await _walk_path(hero, path)
	# The general journey helper accepts 4.5px of error. At a tile's bottom
	# edge that can be in the next cell, which is not an exact stand. Continue
	# with real movement until the Hero actually enters the requested cell.
	var refine_deadline := Time.get_ticks_msec() + 2500
	var target := Vector2(destination.x * 16 + 8, destination.y * 16 + 15)
	while walked and nav.cell_of(hero.global_position) != destination and Time.get_ticks_msec() < refine_deadline:
		_set_direction(target - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	print("A0_CONNECTOR_TRACE %s start=%s target=%s actual=%s actual_cell=%s walked=%s" % [label, str(start), str(destination), str(hero.global_position), str(nav.cell_of(hero.global_position)), str(walked)])
	_expect(walked and nav.cell_of(hero.global_position) == destination, label + " ordinary movement reaches intended cell")
	return walked and nav.cell_of(hero.global_position) == destination

func _body() -> void:
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var world := ow.get(&"world") as OverworldWorld
	var nav := ow.get(&"traversability") as OverworldTraversability
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var camera := ow.get(&"camera") as Camera2D
	var refuge := nav.cell_of(hero.global_position)
	_expect(world.width == 448 and world.height == 256 and int(ow.get("mounted_obstacles")) == 12, "actual A0 controller builds exact one-chunk pilot and both obstacle sets")
	_expect(refuge == Vector2i(56, 218) and (ow.get("traversability_failures") as Array).is_empty(), "fresh Refuge and all original endpoints remain navigable")
	_expect(camera.limit_right == 7168 and camera.limit_bottom == 4096, "production camera uses composed world bounds")
	_expect(world.is_solid_cell(384, 191) and world.is_solid_cell(447, 191), "unsupported annex rows fail closed")
	build.select_piece("wall_wood")
	_expect(build.validate_cell(Vector2i(383, 200)) == "on_route", "legacy connector road rejects building")
	_expect(build.validate_cell(Vector2i(384, 200)) == "annex_build_not_enabled", "annex rejects building")
	var before := _save().call(&"get_snapshot") as Dictionary
	var denied: Dictionary = build.try_place(Vector2i(384, 200), "pilot.annex.denied")
	_expect(not bool(denied.get("ok", true)) and before == (_save().call(&"get_snapshot") as Dictionary), "annex refusal spends nothing and leaves no receipt")
	await physics_frame
	var locker_clear := _shape_clear(Vector2i(408, 199), nav, hero, {})
	var locker_shape := hero.get_node("BodyShape") as CollisionShape2D
	var locker_query := PhysicsShapeQueryParameters2D.new()
	locker_query.shape = locker_shape.shape
	locker_query.transform = Transform2D(0.0, Vector2(408 * 16 + 8, 199 * 16 + 15) + locker_shape.position)
	locker_query.collision_mask = hero.collision_mask
	locker_query.exclude = [hero.get_rid()]
	locker_query.collide_with_bodies = true
	locker_query.collide_with_areas = false
	var collider_names: Array[String] = []
	for hit: Dictionary in hero.get_world_2d().direct_space_state.intersect_shape(locker_query, 128):
		var collider := hit.get("collider") as Node
		if collider != null:
			collider_names.append(String(collider.get_path()))
	print("A0_CONNECTOR_LOCKER exact_stand=(408,199) shape_clear=%s colliders=%s" % [str(locker_clear), str(collider_names)])
	var original_box := RectangleShape2D.new()
	original_box.size = Vector2(16, 16)
	var original_transform := Transform2D(0.0, Vector2(408 * 16 + 8, 198 * 16 + 8))
	_expect(locker_shape.shape.collide(locker_query.transform, original_box, original_transform), "adverse original full-tile locker shape overlaps exact stand")
	_expect(collider_names.is_empty(), "corrected authored obstacle is clear in independent live physics")
	# This is a REQUIRED positive gate, not an expected-negative pass. Continue
	# other diagnostics when it fails, but never label the pilot accepted.
	_expect(locker_clear, "original locker stand (408,199) clears actual Hero shape against authored blockers")
	# A1-owned toe-clearance correction preserves exact coordinates; the
	# positive gate is the specified locker stand, never the anchor substitute.
	var outbound := await _leg(hero, nav, Vector2i(408, 199), "Refuge to exact Waystation locker stand")
	if outbound:
		var probe := REACH_PROBE.new()
		probe.name = "FixtureReachOnly"
		probe.position = Vector2(408 * 16 + 8, 198 * 16 + 8)
		world.add_child(probe)
		# Path tolerance can stop a few pixels shy of the 24px interaction
		# radius; move closer using the real Hero without leaving the stand.
		var reach_deadline := Time.get_ticks_msec() + 2500
		while hero.global_position.distance_to(probe.global_position) > 24.0 and Time.get_ticks_msec() < reach_deadline:
			_set_direction(probe.global_position - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		_expect(nav.cell_of(hero.global_position) == Vector2i(408, 199) and hero.global_position.distance_to(probe.global_position) <= 24.0, "actual Hero at exact locker stand is within the authored 24px reach")
		camera.reset_smoothing()
		camera.force_update_scroll()
		await process_frame
		var click_position := root.get_final_transform() * (camera.get_canvas_transform() * probe.global_position)
		Input.warp_mouse(click_position)
		await process_frame
		await _click_window(click_position)
		_expect(probe.activations == 1, "ordinary pointer input reaches diagnostic marker without granting rewards")
		probe.queue_free()
		await process_frame
		var relay := await _leg(hero, nav, Vector2i(442, 234), "Waystation to Relay")
		if relay:
			camera.reset_smoothing()
			camera.force_update_scroll()
			var screen := root.get_canvas_transform() * hero.global_position
			_expect(root.get_visible_rect().has_point(screen), "actual Hero remains visible at Relay")
			var saved_position := hero.global_position
			var state := ow.get(&"state") as OverworldState
			state.set_world_position(saved_position, true)
			_expect(bool(_save().call(&"reload_save")), "actual annex position reloads from disk")
			ow = await _reload_world(ow)
			hero = ow.get(&"player") as CharacterBody2D
			nav = ow.get(&"traversability") as OverworldTraversability
			_expect(hero.global_position.distance_to(saved_position) < 2.0, "fresh production controller restores global Relay coordinates")
			var returned := await _leg(hero, nav, refuge, "Relay to original Refuge")
			if returned:
				var inverse_relay := await _leg(hero, nav, Vector2i(442, 234), "inverse Refuge to Relay crank stand")
				if inverse_relay:
					var inverse_station := await _leg(hero, nav, Vector2i(408, 199), "inverse Relay to exact Waystation locker stand")
					var inverse_refuge := false
					if inverse_station:
						inverse_refuge = await _leg(hero, nav, refuge, "inverse Waystation to Refuge")
					var reached_for_downgrade := false
					if inverse_refuge:
						reached_for_downgrade = await _leg(hero, nav, Vector2i(442, 234), "Refuge to Relay for downgrade")
					if not reached_for_downgrade:
						_body_complete = true
						return
					# Downgrade the exact real annex position to the unchanged legacy
					# controller; no fabricated save position or teleport.
					(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)
					var custody: Dictionary = _save().call(&"inventory_totals")
					var survival_before: Dictionary = _survival().call(&"document")
					_legacy_mode = true
					ow = await _reload_world(ow)
					if ow != null:
						hero = ow.get(&"player") as CharacterBody2D
						world = ow.get(&"world") as OverworldWorld
						nav = ow.get(&"traversability") as OverworldTraversability
						var legacy_cell := nav.cell_of(hero.global_position)
						var downgrade_safe := world.width == 384 and nav.in_bounds(legacy_cell) and _shape_clear(legacy_cell, nav, hero, {})
						print("A0_CONNECTOR_DOWNGRADE position=%s cell=%s safe=%s" % [str(hero.global_position), str(legacy_cell), str(downgrade_safe)])
						_expect(downgrade_safe, "annex-save downgrade respawns safely inside unmodified legacy geometry")
						_expect(world.is_solid_cell(369, 200) and (_save().call(&"inventory_totals") as Dictionary) == custody and (_survival().call(&"document") as Dictionary) == survival_before, "legacy rollback restores seam and preserves custody and survival state")
						_legacy_mode = false
						ow = await _reload_world(ow)
						if ow != null:
							hero = ow.get(&"player") as CharacterBody2D
							nav = ow.get(&"traversability") as OverworldTraversability
							var resumed_cell := nav.cell_of(hero.global_position)
							_expect(nav.in_bounds(resumed_cell) and _shape_clear(resumed_cell, nav, hero, {}), "re-enabled pilot retains a safe downgrade position")
							_expect((_save().call(&"inventory_totals") as Dictionary) == custody and (_survival().call(&"document") as Dictionary) == survival_before, "re-enabled pilot preserves exact custody after downgrade")
	_body_complete = true
