extends "res://tests/survival_normal_home_journey_test.gd"
## Experimental end-to-end probe, NOT a production-enabled threat. Inherits the
## fresh ordinary-input home build and uses the real Hero, existing enemy AI,
## paused GUI and real SaveService. It never teleports, grants or injects damage.

var _observed_input_kill := false

func _on_probe_enemy_died(_enemy: Node) -> void:
	_observed_input_kill = true

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
	var home_room: String = build.room_topology.room_at(start)
	_expect(not home_room.is_empty(), "journey starts inside the original player-built room")
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
	var session := root.get_node("GameSession")
	var score_before := int(session.get("score"))
	var safe_health := int(hero.get("health"))
	await create_timer(3.0).timeout
	_expect(int(hero.get("health")) == safe_health and int(session.get("score")) == score_before, "avoiding the distant optional encounter leaves Hero and score unchanged")
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
	var home_doc: Dictionary = _survival().call(&"document")
	var home_structures: Dictionary = (home_doc.get("structures", {}) as Dictionary).duplicate(true)
	var home_containers: Dictionary = (home_doc.get("containers", {}) as Dictionary).duplicate(true)
	var home_bed := String(home_doc.get("spawn_anchor", ""))
	var health_before := int(hero.get("health"))
	_expect(health_before > 0, "fresh actual Hero begins the encounter alive")
	var approached := await _walk_path(hero, path)
	_expect(approached, "ordinary movement reaches the warned encounter")
	if not approached:
		_body_complete = true
		return
	# If detection is occluded at the first warned approach, voluntarily walk
	# closer using the real controller; do not command the enemy or fabricate a
	# hit. Record its state/position to diagnose line of sight or leash issues.
	if int(hero.get("health")) == health_before:
		for offset: Vector2i in [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(0, -3), Vector2i(0, 3)]:
			var closer := _route(nav.cell_of(hero.global_position), site + offset, nav, hero)
			if not closer.is_empty():
				await _walk_path(hero, closer)
				break
	var until := Time.get_ticks_msec() + 30000
	while int(hero.get("health")) == health_before and not bool(hero.get("dead")) and Time.get_ticks_msec() < until:
		await physics_frame
	var current_enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	print("OPTIONAL_THREAT_TRACE hero=%s hp=%s enemy=%s enemy_pos=%s state=%s distance=%s" % [str(hero.global_position), str(hero.get("health")), str(current_enemy), str(current_enemy.global_position if current_enemy != null else Vector2.ZERO), str(current_enemy.get("_state") if current_enemy != null else "missing"), str(hero.global_position.distance_to(current_enemy.global_position) if current_enemy != null else -1)])
	var damaged := int(hero.get("health")) < health_before and not bool(hero.get("dead"))
	_expect(damaged, "existing autonomous skeleton inflicts actual survivable damage")
	if not damaged:
		_body_complete = true
		return
	# Escape the live enemy's collision footprint with ordinary movement before
	# requesting a static shape-aware path. Otherwise the path query may have
	# no free first neighbour while the two bodies are in melee contact.
	var home_point := Vector2(start.x * 16 + 8, start.y * 16 + 15)
	var escape_deadline := Time.get_ticks_msec() + 4000
	while is_instance_valid(current_enemy) and hero.global_position.distance_to(current_enemy.global_position) < 48.0 and not bool(hero.get("dead")) and Time.get_ticks_msec() < escape_deadline:
		_set_direction(home_point - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	var retreat_start := hero.global_position
	var back := _route(nav.cell_of(hero.global_position), start, nav, hero)
	var walked_back := not back.is_empty() and await _walk_path(hero, back)
	# Home is a room, not a single exact foot pixel. The path helper's last-cell
	# tolerance can stop against furniture even after the Hero has entered it.
	var retreated := not home_room.is_empty() and build.room_topology.room_at(nav.cell_of(hero.global_position)) == home_room and not bool(hero.get("dead"))
	print("OPTIONAL_THREAT_TRACE retreat_start=%s path=%d end=%s hp=%s dead=%s walked=%s same_room=%s" % [str(retreat_start), back.size(), str(hero.global_position), str(hero.get("health")), str(hero.get("dead")), str(walked_back), str(retreated)])
	_expect(retreated, "ordinary movement retreats alive into the original built room")
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
	# Re-enter close combat through ordinary movement, as on the first visit;
	# stopping at the warning boundary alone need not trigger enemy detection.
	for offset: Vector2i in [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(0, -3), Vector2i(0, 3)]:
		var engage := _route(nav.cell_of(hero.global_position), site + offset, nav, hero)
		if not engage.is_empty():
			await _walk_path(hero, engage)
			break
	await _engage_until_death(hero, encounter, nav, start, 300000)
	var last_enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	print("OPTIONAL_THREAT_TRACE lethal_wait_end hp=%s dead=%s hero=%s enemy=%s enemy_pos=%s state=%s distance=%s" % [str(hero.get("health")), str(hero.get("dead")), str(hero.global_position), str(last_enemy), str(last_enemy.global_position if last_enemy != null else Vector2.ZERO), str(last_enemy.get("_state") if last_enemy != null else "missing"), str(hero.global_position.distance_to(last_enemy.global_position) if last_enemy != null else -1)])
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
	await physics_frame
	_expect(encounter.get_node_or_null("BoundedSkeleton") == null, "real death synchronously cleans the one encounter enemy before recovery")
	var bag_cell := nav.cell_of(bag.global_position)
	var approach: Array[Vector2i] = []
	var current := nav.cell_of(hero.global_position)
	var bag_goal := Vector2i(-1, -1)
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1), Vector2i(-2, 0), Vector2i(2, 0), Vector2i(0, -2), Vector2i(0, 2)]:
		var candidate := bag_cell + offset
		var point := Vector2(candidate.x * 16 + 8, candidate.y * 16 + 15)
		if point.distance_to(bag.global_position) > 44.0:
			continue
		var trial := _route(current, candidate, nav, hero)
		if current == candidate or not trial.is_empty():
			approach = trial
			bag_goal = candidate
			break
	var physically_revisited := (approach.is_empty() and current == bag_goal) or (not approach.is_empty() and await _walk_path(hero, approach))
	print("OPTIONAL_THREAT_TRACE bag=%s start=%s goal=%s path=%d actual=%s hp=%s dead=%s reached=%s" % [str(bag.global_position), str(current), str(bag_goal), approach.size(), str(hero.global_position), str(hero.get("health")), str(hero.get("dead")), str(physically_revisited)])
	_expect(physically_revisited and hero.global_position.distance_to(bag.global_position) <= 44.0, "ordinary movement physically returns to the same death bag")
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
	if not return_home.is_empty():
		await _walk_path(hero, return_home)
	var home_again := not home_room.is_empty() and build.room_topology.room_at(nav.cell_of(hero.global_position)) == home_room and not bool(hero.get("dead"))
	_expect(home_again, "ordinary movement returns to the original built room")
	if not home_again:
		_body_complete = true
		return
	var repeated := await _repeat_real_death(ow, encounter, site, goal, start, home_room, bag_id, before)
	_expect(repeated, "second real death and distinct bag recovery return to the original home without duplication")
	_expect(int(session.get("score")) == score_before, "incoming damage, death and cleanup grant no encounter score")
	if not repeated:
		_body_complete = true
		return
	var consumed := await _consume_encounter_by_real_attack(ow, encounter, goal, start, home_room, before)
	_expect(consumed, "real-input kill consumes the encounter and prevents repeat-score rearm")
	if not consumed:
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
	if fresh != null:
		var fresh_doc: Dictionary = _survival().call(&"document")
		var fresh_build := fresh.get(&"survival_build") as SurvivalBuildSystem
		var fresh_records: Dictionary = fresh_doc.get("structures", {})
		var same_structures := fresh_records.size() == home_structures.size()
		for id: Variant in home_structures.keys():
			if not fresh_records.has(id) or fresh_build.structure_node(String(id)) == null:
				same_structures = false
		_expect(same_structures and String(fresh_doc.get("spawn_anchor", "")) == home_bed and (fresh_doc.get("containers", {}) as Dictionary) == home_containers, "fresh overworld reconstructs all original home identities, active bed and exact stored contents")
		var restored_encounter := Node2D.new()
		restored_encounter.name = "OptionalSkeletonEncounter"
		restored_encounter.set_script(encounter_script)
		fresh.add_child(restored_encounter)
		var fresh_hero := fresh.get(&"player") as CharacterBody2D
		var fresh_nav := fresh.get(&"traversability") as OverworldTraversability
		var restored := bool(restored_encounter.call(&"configure", fresh_hero, fresh_build, fresh_nav, site))
		_expect(restored and restored_encounter.get_node_or_null("BoundedSkeleton") == null and bool(_save().call(&"is_transaction_applied", "survival.encounter.optional_skeleton.first_hit.v1")), "same consumed encounter stays non-spawning after disk and world reconstruction")
	_body_complete = true

# Use real movement to re-engage after knockback. A leashed enemy may despawn;
# in that case physically retreat beyond its safe spawn radius and wait for the
# real cooldown rather than teleporting, changing the enemy or inflicting hits.
func _engage_until_death(hero: CharacterBody2D, encounter: Node2D, nav: OverworldTraversability, home_cell: Vector2i, max_msec: int) -> void:
	var deadline := Time.get_ticks_msec() + max_msec
	var last_phase := ""
	while not bool(hero.get("dead")) and Time.get_ticks_msec() < deadline:
		var live := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
		var phase := "engage" if is_instance_valid(live) and not live.is_queued_for_deletion() else "cooldown"
		if phase != last_phase:
			print("OPTIONAL_THREAT_ENGAGE phase=%s pos=%s hp=%s distance=%s" % [phase, str(hero.global_position), str(hero.get("health")), str(hero.global_position.distance_to(encounter.global_position))])
			last_phase = phase
		if phase == "engage":
			var delta := live.global_position - hero.global_position
			_set_direction(delta if delta.length() > 28.0 else Vector2.ZERO)
		elif hero.global_position.distance_to(encounter.global_position) < 350.0:
			# A straight vector to home can press the real Hero forever into a
			# blocker, preventing the 350px spawn-safety condition. Follow the
			# production live-shape route with ordinary movement instead.
			var path := _route(nav.cell_of(hero.global_position), home_cell, nav, hero)
			print("OPTIONAL_THREAT_ENGAGE safe_route=%d pos=%s" % [path.size(), str(hero.global_position)])
			for cell: Vector2i in path:
				var target := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
				var cell_deadline := mini(deadline, Time.get_ticks_msec() + 3500)
				while hero.global_position.distance_to(target) > 4.5 and hero.global_position.distance_to(encounter.global_position) < 350.0 and Time.get_ticks_msec() < cell_deadline and not bool(hero.get("dead")):
					_set_direction(target - hero.global_position)
					await physics_frame
				if hero.global_position.distance_to(encounter.global_position) >= 350.0 or Time.get_ticks_msec() >= deadline or bool(hero.get("dead")):
					break
				if hero.global_position.distance_to(target) > 4.5:
					print("OPTIONAL_THREAT_ENGAGE safe_route_blocked target=%s actual=%s" % [str(cell), str(hero.global_position)])
					break
			_set_direction(Vector2.ZERO)
			if path.is_empty():
				await create_timer(1.0).timeout
		else:
			_set_direction(Vector2.ZERO)
		await physics_frame
	_set_direction(Vector2.ZERO)

# Supplemental anti-farming gate in the same continuous journey. No direct
# damage, synthetic death, teleport, inventory grants or attack callbacks.
# The Hero may award its ordinary per-hit score once; the durable receipt must
# prevent this experimental site from being repeatedly rearmed.
func _consume_encounter_by_real_attack(ow: Node, encounter: Node2D, goal: Vector2i, base: Vector2i, home_room: String, expected: Dictionary) -> bool:
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var session := root.get_node("GameSession")
	var key := "survival.encounter.optional_skeleton.first_hit.v1"
	var score_before_hit := int(session.get("score"))
	var progression_before: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("progression", {}).duplicate(true)
	await create_timer(62.0).timeout
	var approach := _route(nav.cell_of(hero.global_position), goal, nav, hero)
	if encounter.get_node_or_null("BoundedSkeleton") == null or approach.is_empty() or not await _walk_path(hero, approach):
		print("FARM_PROBE_FAIL no rearmed enemy or physical approach")
		return false
	var probe_enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	if not is_instance_valid(probe_enemy):
		return false
	_observed_input_kill = false
	probe_enemy.connect(&"died", _on_probe_enemy_died)
	var clock := 0.0
	while clock < 35.0 and not _observed_input_kill and not bool(hero.get("dead")):
		var enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
		if not is_instance_valid(enemy):
			break
		var offset := enemy.global_position - hero.global_position
		if offset.length() > 30.0:
			_set_direction(offset)
			await create_timer(0.25).timeout
			_set_direction(Vector2.ZERO)
		else:
			# A brief directional movement supplies the same facing a player uses;
			# the subsequent action is processed by the real Hero/controller.
			_set_direction(offset)
			await create_timer(0.04).timeout
			_set_direction(Vector2.ZERO)
			await _tap_action(&"attack")
			await create_timer(0.55).timeout
		clock += 0.6
	_set_direction(Vector2.ZERO)
	var applied := bool(_save().call(&"is_transaction_applied", key))
	print("FARM_PROBE attack_receipt=%s real_kill=%s score_before=%d score_after=%d hp=%d pos=%s" % [applied, _observed_input_kill, score_before_hit, int(session.get("score")), int(hero.get("health")), str(hero.global_position)])
	if not applied or not _observed_input_kill or bool(hero.get("dead")):
		return false
	var home_path := _route(nav.cell_of(hero.global_position), base, nav, hero)
	if not home_path.is_empty():
		await _walk_path(hero, home_path)
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	if bool(hero.get("dead")) or build.room_topology.room_at(nav.cell_of(hero.global_position)) != home_room:
		return false
	var score_after_attack := int(session.get("score"))
	await create_timer(62.0).timeout
	return encounter.get_node_or_null("BoundedSkeleton") == null \
		and int(session.get("score")) == score_after_attack \
		and (_save().call(&"inventory_totals") as Dictionary) == expected \
		and (_save().call(&"get_snapshot") as Dictionary).get("progression", {}) == progression_before

func _repeat_real_death(ow: Node, encounter: Node2D, site: Vector2i, goal: Vector2i,
		home_cell: Vector2i, home_room: String, previous_bag: String, before: Dictionary) -> bool:
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	# Real active time, not a manipulated timer. The Hero remains at the home.
	await create_timer(62.0).timeout
	var enemy := encounter.get_node_or_null("BoundedSkeleton") as CharacterBody2D
	_expect(enemy != null and int(enemy.get("score_reward")) == 0, "one skeleton without a kill bonus re-arms after active cooldown")
	var enemy_count := 0
	for child: Node in encounter.get_children():
		if child is CharacterBody2D:
			enemy_count += 1
	_expect(enemy_count == 1, "cooldown re-arm never duplicates the encounter enemy")
	if enemy == null:
		return false
	var path := _route(nav.cell_of(hero.global_position), goal, nav, hero)
	if path.is_empty() or not await _walk_path(hero, path):
		return false
	for offset: Vector2i in [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(0, -3), Vector2i(0, 3)]:
		var engage := _route(nav.cell_of(hero.global_position), site + offset, nav, hero)
		if not engage.is_empty():
			await _walk_path(hero, engage)
			break
	await _engage_until_death(hero, encounter, nav, home_cell, 300000)
	var doc: Dictionary = _survival().call(&"document")
	var second_id := String(doc.get("pending_death", ""))
	var second_created := bool(hero.get("dead")) and not second_id.is_empty() and second_id != previous_bag and (doc.get("death_bags", {}) as Dictionary).has(second_id) and not (doc.get("death_bags", {}) as Dictionary).has(previous_bag)
	print("OPTIONAL_THREAT_TRACE second_death hp=%s id=%s first=%s" % [str(hero.get("health")), second_id, previous_bag])
	_expect(second_created, "second autonomous death creates a distinct bag without resurrecting the first")
	if not second_created:
		return false
	var hud := ow.get(&"hud") as Node
	var button := hud.find_child("Respawn", true, false) as Button
	if button == null or not button.is_visible_in_tree():
		return false
	await _click_window(root.get_final_transform() * button.get_global_rect().get_center())
	await physics_frame
	var bag := (ow.get(&"_death_bags") as Dictionary).get(second_id, null) as Node2D
	var clean := not bool(hero.get("dead")) and bag != null and encounter.get_node_or_null("BoundedSkeleton") == null
	_expect(clean, "second GUI bed respawn retains the distinct bag and cleans the enemy")
	if not clean:
		return false
	var bag_cell := nav.cell_of(bag.global_position)
	var current := nav.cell_of(hero.global_position)
	var route: Array[Vector2i] = []
	var destination := Vector2i(-1, -1)
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1), Vector2i(-2, 0), Vector2i(2, 0), Vector2i(0, -2), Vector2i(0, 2)]:
		var candidate := bag_cell + offset
		var point := Vector2(candidate.x * 16 + 8, candidate.y * 16 + 15)
		if point.distance_to(bag.global_position) > 44.0:
			continue
		var trial := _route(current, candidate, nav, hero)
		if current == candidate or not trial.is_empty():
			destination = candidate
			route = trial
			break
	var walked := (current == destination) or (not route.is_empty() and await _walk_path(hero, route))
	if not walked or hero.global_position.distance_to(bag.global_position) > 44.0:
		return false
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * (camera.get_canvas_transform() * bag.global_position))
	var recovered := (_save().call(&"inventory_totals") as Dictionary) == before and not ((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).has(second_id)
	_expect(recovered, "second physical bag recovery restores exactly the same possessions")
	if not recovered:
		return false
	var home_path := _route(nav.cell_of(hero.global_position), home_cell, nav, hero)
	if not home_path.is_empty():
		await _walk_path(hero, home_path)
	return not bool(hero.get("dead")) and build.room_topology.room_at(nav.cell_of(hero.global_position)) == home_room
