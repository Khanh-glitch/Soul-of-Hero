extends "res://tests/survival_optional_threat_journey_test.gd"
## Focused negative gate: real input, debug-only first-hit write interruption,
## reload from disk and a new overworld in the SAME process. This does not
## simulate an OS kill or prove score persistence across a process restart.
## No direct damage, enemy commands, position assignments or inventory grants.

func _finish() -> void:
	paused = false
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("OPTIONAL THREAT FAULT %s - %d checks" % ["PASSED" if failures.is_empty() else "BLOCKED", checks])
	quit(0 if failures.is_empty() else 1)

func _configure_site(ow: Node, site: Vector2i = Vector2i(-1, -1)) -> Dictionary:
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var world := ow.get(&"world") as OverworldWorld
	var encounter := Node2D.new()
	encounter.name = "OptionalSkeletonEncounter"
	encounter.set_script(load("res://game/survival/optional_skeleton_encounter.gd") as Script)
	ow.add_child(encounter)
	if site.x >= 0:
		return {"node": encounter, "site": site, "ok": bool(encounter.call(&"configure", hero, build, nav, site))}
	var origin := nav.cell_of(hero.global_position)
	var reach := nav.reachable_from(origin)
	var endpoints := nav.endpoints(world.data)
	for radius in range(45, 111):
		for dy in range(-radius, radius + 1):
			for dx in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := origin + Vector2i(dx, dy)
				if candidate.x < 15 or candidate.y < 15 or candidate.x >= nav.width - 15 or candidate.y >= nav.height - 15 or not nav.is_free(candidate) or reach[candidate.y * nav.width + candidate.x] < 0:
					continue
				var protected := false
				for endpoint: Dictionary in endpoints:
					var cell: Vector2i = endpoint["cell"]
					if maxi(absi(candidate.x - cell.x), absi(candidate.y - cell.y)) <= 24:
						protected = true
						break
				if protected or build._near_shortcut(candidate, 24):
					continue
				if bool(encounter.call(&"configure", hero, build, nav, candidate)):
					return {"node": encounter, "site": candidate, "ok": true}
	return {"node": encounter, "site": Vector2i(-1, -1), "ok": false}

# Approach using live shape queries and actual movement, then let the real
# controller attack. Only arm the interruption after arriving in attack range.
func _real_hit(ow: Node, encounter: Node2D, arm_fault: bool) -> bool:
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	if enemy == null:
		return false
	var site := nav.cell_of(encounter.global_position)
	var path: Array[Vector2i] = []
	for offset: Vector2i in [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(0, -3), Vector2i(0, 3), Vector2i(-5, 0), Vector2i(5, 0)]:
		path = _route(nav.cell_of(hero.global_position), site + offset, nav, hero)
		if not path.is_empty():
			break
	if path.is_empty() or not await _walk_path(hero, path):
		return false
	var deadline := Time.get_ticks_msec() + 30000
	var fault_armed := false
	var last_detour := Time.get_ticks_msec()
	var last_position := hero.global_position
	while is_instance_valid(enemy) and not enemy.is_queued_for_deletion() and not bool(hero.get("dead")) and Time.get_ticks_msec() < deadline:
		var delta := enemy.global_position - hero.global_position
		if delta.length() > 28.0:
			_set_direction(delta)
			await physics_frame
			if Time.get_ticks_msec() - last_detour > 4000:
				if hero.global_position.distance_to(last_position) < 6.0:
					_set_direction(Vector2.ZERO)
					await _reengage_detour(hero, nav, enemy)
				last_detour = Time.get_ticks_msec()
				last_position = hero.global_position
			continue
		_set_direction(delta)
		await physics_frame
		_set_direction(Vector2.ZERO)
		if arm_fault and not fault_armed:
			fault_armed = bool(_save().call(&"configure_test_save_interruption", "after_temporary"))
			_expect(fault_armed, "debug-only first-hit interruption was armed")
			if not fault_armed:
				return false
		await _tap_action(&"attack")
		await create_timer(0.55).timeout
		if bool(encounter.get("_spent")):
			return true
	_set_direction(Vector2.ZERO)
	return false

func _body() -> void:
	_body_complete = false
	var ow := _host.get_child(0)
	var initial_hero := ow.get(&"player") as CharacterBody2D
	var initial_nav := ow.get(&"traversability") as OverworldTraversability
	var safe_cell := initial_nav.cell_of(initial_hero.global_position)
	var configured := _configure_site(ow)
	var encounter := configured["node"] as Node2D
	var site: Vector2i = configured["site"]
	_expect(bool(configured["ok"]) and encounter.get_node_or_null("BoundedSkeleton") != null, "fresh world has one nav- and shape-validated warned enemy")
	if not bool(configured["ok"]):
		_body_complete = true
		return
	var session := root.get_node("GameSession")
	var initial_score := int(session.get("score"))
	var initial_inventory: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("inventory", {}).duplicate(true)
	var hit := await _real_hit(ow, encounter, true)
	var after_fault_score := int(session.get("score"))
	var receipt := "survival.encounter.optional_skeleton.first_hit.v1"
	var absent_receipt := not bool(_save().call(&"is_transaction_applied", receipt))
	_expect(hit and bool(encounter.get("_spent")) and absent_receipt, "real first hit reaches interrupted write and disables current session without a receipt")
	print("FAULT_TRACE after_hit=%s receipt_absent=%s score_before=%d score_after=%d" % [hit, absent_receipt, initial_score, after_fault_score])
	if not hit or not absent_receipt:
		_body_complete = true
		return
	await process_frame
	_expect(encounter.get_node_or_null("BoundedSkeleton") == null, "failed first-hit write removes live enemy in current session")
	ow.queue_free()
	await process_frame
	_host.queue_free()
	_host = null
	await process_frame
	var loaded := bool(_save().call(&"reload_save"))
	var fresh := await _boot()
	_expect(loaded and fresh != null and not bool(_save().call(&"is_transaction_applied", receipt)), "disk reload selects pre-hit state after interrupted temporary write")
	if not loaded or fresh == null:
		_body_complete = true
		return
	# Position autosaves may restore the Hero near the site. Walk to the original
	# safe cell before reconfiguring; do not teleport or bypass spawn safety.
	var fresh_hero := fresh.get(&"player") as CharacterBody2D
	var fresh_nav := fresh.get(&"traversability") as OverworldTraversability
	var site_center := Vector2(site.x * 16 + 8, site.y * 16 + 15)
	if fresh_hero.global_position.distance_to(site_center) <= 320.0:
		var safe_route := _route(fresh_nav.cell_of(fresh_hero.global_position), safe_cell, fresh_nav, fresh_hero)
		var reached_safety := not safe_route.is_empty() and await _walk_path(fresh_hero, safe_route)
		_expect(reached_safety and fresh_hero.global_position.distance_to(site_center) > 320.0, "ordinary movement reaches spawn-safe distance after reload")
		if not reached_safety or fresh_hero.global_position.distance_to(site_center) <= 320.0:
			_body_complete = true
			return
	var restored := _configure_site(fresh, site)
	var renewed := restored["node"] as Node2D
	var respawned := bool(restored["ok"]) and renewed.get_node_or_null("BoundedSkeleton") != null
	print("FAULT_TRACE fresh_configured=%s respawned=%s score_after_reload=%d" % [str(restored["ok"]), respawned, int(session.get("score"))])
	_expect(bool(restored["ok"]) and not respawned, "failed-write reconstruction does not rearm a previously hit source")
	if respawned:
		var before_second := int(session.get("score"))
		var hit_again := await _real_hit(fresh, renewed, false)
		var after_second := int(session.get("score"))
		print("FAULT_TRACE second_real_hit=%s score_before=%d score_after=%d" % [hit_again, before_second, after_second])
		_expect(hit_again and after_second == before_second, "reconstructed encounter cannot yield repeat hit score")
	_expect(((_save().call(&"get_snapshot") as Dictionary).get("inventory", {}) as Dictionary) == initial_inventory, "fault and reload preserve complete carried inventory")
	_body_complete = true
