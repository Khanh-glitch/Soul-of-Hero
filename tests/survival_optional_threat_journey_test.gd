extends "res://tests/survival_normal_home_journey_test.gd"
## Experimental end-to-end probe, NOT a production-enabled threat. Inherits the
## fresh ordinary-input home build and uses the real Hero, existing enemy AI,
## paused GUI and real SaveService. It never teleports, grants or inflicts damage.

func _finish() -> void:
	paused = false
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("OPTIONAL THREAT JOURNEY %s - %d checks" % ["PASSED" if failures.is_empty() else "BLOCKED", checks])
	quit(0 if failures.is_empty() else 1)

func _body() -> void:
	await super._body()
	if not failures.is_empty():
		return
	_body_complete = false
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var world := ow.get(&"world") as OverworldWorld
	var start := nav.cell_of(hero.global_position)
	var reach := nav.reachable_from(start)
	var endpoint_data := nav.endpoints(world.data)
	var encounter_script := load("res://game/survival/optional_skeleton_encounter.gd") as Script
	var encounter := Node2D.new()
	encounter.name = "OptionalSkeletonEncounter"
	encounter.set_script(encounter_script)
	ow.add_child(encounter)
	var site := Vector2i(-1, -1)
	# Find a bounded off-road clearing rather than inventing or moving a POI.
	for radius in range(45, 111):
		if site.x >= 0:
			break
		for dy in range(-radius, radius + 1):
			if site.x >= 0:
				break
			for dx in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := start + Vector2i(dx, dy)
				if candidate.x < 15 or candidate.y < 15 or candidate.x >= nav.width - 15 or candidate.y >= nav.height - 15 or not nav.is_free(candidate) or reach[candidate.y * nav.width + candidate.x] < 0:
					continue
				var protected := false
				for endpoint: Dictionary in endpoint_data:
					var cell: Vector2i = endpoint["cell"]
					if maxi(absi(candidate.x - cell.x), absi(candidate.y - cell.y)) <= 24:
						protected = true
						break
				if protected or build._near_shortcut(candidate, 24):
					continue
				if bool(encounter.call(&"configure", hero, build, nav, candidate)):
					site = candidate
					break
	print("OPTIONAL_THREAT_SITE %s" % str(site))
	_expect(site.x >= 0, "a bounded optional encounter validates against nav, live enemy shape, roads, protected endpoints and existing home")
	if site.x < 0:
		_body_complete = true
		return
	_expect(build.validate_cell(site) == "encounter_exclusion" and encounter.get_node_or_null("OptionalEncounterWarning") != null, "validated encounter reserves building and presents a warning")
	var enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	_expect(enemy != null and int(enemy.get("score_reward")) == 0, "one existing skeleton spawned without score rewards")
	var goal := Vector2i(-1, -1)
	var path: Array[Vector2i] = []
	for offset: Vector2i in [Vector2i(-8, 0), Vector2i(8, 0), Vector2i(0, -8), Vector2i(0, 8)]:
		var candidate := site + offset
		if nav.in_bounds(candidate) and nav.is_free(candidate) and reach[candidate.y * nav.width + candidate.x] >= 0:
			var trial := _route(start, candidate, nav, hero)
			if not trial.is_empty():
				goal = candidate
				path = trial
				break
	_expect(goal.x >= 0, "ordinary-input, Hero-shape route exists to optional danger")
	if goal.x < 0:
		_body_complete = true
		return
	var before: Dictionary = _save().call(&"inventory_totals")
	var approached := await _walk_path(hero, path)
	_expect(approached, "ordinary movement reaches the warned encounter")
	if not approached:
		_body_complete = true
		return
	# If detection is occluded at the first warned approach, voluntarily walk
	# closer using the real controller; do not command the enemy or fabricate a
	# hit. Record its state/position to diagnose line of sight or leash issues.
	if int(hero.get("health")) == 100:
		for offset: Vector2i in [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(0, -3), Vector2i(0, 3)]:
			var closer := _route(nav.cell_of(hero.global_position), site + offset, nav, hero)
			if not closer.is_empty():
				await _walk_path(hero, closer)
				break
	var until := Time.get_ticks_msec() + 30000
	while int(hero.get("health")) == 100 and not bool(hero.get("dead")) and Time.get_ticks_msec() < until:
		await physics_frame
	var current_enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	print("OPTIONAL_THREAT_TRACE hero=%s hp=%s enemy=%s enemy_pos=%s state=%s distance=%s" % [str(hero.global_position), str(hero.get("health")), str(current_enemy), str(current_enemy.global_position if current_enemy != null else Vector2.ZERO), str(current_enemy.get("_state") if current_enemy != null else "missing"), str(hero.global_position.distance_to(current_enemy.global_position) if current_enemy != null else -1)])
	var damaged := int(hero.get("health")) < 100 and not bool(hero.get("dead"))
	_expect(damaged, "existing autonomous skeleton inflicts actual survivable damage")
	if not damaged:
		_body_complete = true
		return
	var back := _route(nav.cell_of(hero.global_position), start, nav, hero)
	var retreated := not back.is_empty() and await _walk_path(hero, back)
	_expect(retreated and not bool(hero.get("dead")), "ordinary movement retreats alive to the original home")
	_expect((_save().call(&"inventory_totals") as Dictionary) == before, "retreat does not duplicate or lose carried possessions")
	if not retreated:
		_body_complete = true
		return
	# Wait for the actual active-time leash cooldown, then approach the existing
	# autonomous enemy again. Never fabricate a hit, death or reward.
	await create_timer(62.0).timeout
	var second_path := _route(nav.cell_of(hero.global_position), goal, nav, hero)
	var returned_to_danger := not second_path.is_empty() and await _walk_path(hero, second_path)
	_expect(returned_to_danger, "ordinary movement revisits the same danger after cooldown")
	if not returned_to_danger:
		_body_complete = true
		return
	until = Time.get_ticks_msec() + 120000
	while not bool(hero.get("dead")) and Time.get_ticks_msec() < until:
		await physics_frame
	var doc: Dictionary = _survival().call(&"document")
	var bag_id := String(doc.get("pending_death", ""))
	_expect(bool(hero.get("dead")) and not bag_id.is_empty() and (doc.get("death_bags", {}) as Dictionary).has(bag_id), "real autonomous lethal combat commits the actual death bag")
	if bag_id.is_empty():
		_body_complete = true
		return
	var hud := ow.get(&"hud") as Node
	var respawn := hud.find_child("Respawn", true, false) as Button
	_expect(respawn != null and respawn.is_visible_in_tree(), "real paused GUI exposes bed respawn")
	if respawn == null:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * respawn.get_global_rect().get_center())
	_expect(not bool(hero.get("dead")) and String((_survival().call(&"document") as Dictionary).get("pending_death", "")).is_empty(), "pointer GUI respawns the Hero at the active bed")
	if bool(hero.get("dead")):
		_body_complete = true
		return
	var bag := (ow.get(&"_death_bags") as Dictionary).get(bag_id, null) as Node2D
	_expect(bag != null, "same death-bag identity remains in the physical world")
	if bag == null:
		_body_complete = true
		return
	var bag_cell := nav.cell_of(bag.global_position)
	var approach: Array[Vector2i] = []
	var current := nav.cell_of(hero.global_position)
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
		var candidate := bag_cell + offset
		var trial := _route(current, candidate, nav, hero)
		if current == candidate or not trial.is_empty():
			approach = trial
			break
	var physically_revisited := (approach.is_empty() and current == bag_cell) or (not approach.is_empty() and await _walk_path(hero, approach))
	_expect(physically_revisited, "ordinary movement physically returns to the same death bag")
	if not physically_revisited:
		_body_complete = true
		return
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * (camera.get_canvas_transform() * bag.global_position))
	_expect((_save().call(&"inventory_totals") as Dictionary) == before and not ((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).has(bag_id), "pointer recovers exact carried possessions from the same bag")
	var return_home := _route(nav.cell_of(hero.global_position), start, nav, hero)
	var home_again := not return_home.is_empty() and await _walk_path(hero, return_home)
	_expect(home_again and not bool(hero.get("dead")), "ordinary movement returns to the original home")
	if not home_again:
		_body_complete = true
		return
	(ow.get(&"state") as OverworldState).save_now()
	ow.queue_free()
	await process_frame
	_host.queue_free()
	_host = null
	await process_frame
	var loaded := bool(_save().call(&"reload_save"))
	var fresh := await _boot()
	_expect(loaded and fresh != null and (_save().call(&"inventory_totals") as Dictionary) == before and not ((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).has(bag_id), "disk and fresh overworld preserve recovered custody without a duplicate bag")
	_body_complete = true
