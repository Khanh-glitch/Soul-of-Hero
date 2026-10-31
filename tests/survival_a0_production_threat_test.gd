extends "res://tests/survival_normal_input_gather_test.gd"
## A0 PRODUCTION THREAT — the guarded real encounter mounted by the world itself.
##
## Authority: CT decision T1 (bounded A0 integration of ONE opening-world threat).
## The world mounts the encounter (`game/survival/a0_threat_mount.gd`) when
## `survival/a0_optional_threat` is on; this test does not add an enemy, move one,
## grant damage or grant a reward. It walks to what the world placed, with real
## key input, and asserts what the shipped combat path does.
##
## First process (flag ON): production mount is the only encounter, one enemy,
## zero reward, real damage through the Hero's own 0.75 s i-frame window, a real
## lethal sequence, exactly one bag, the world's own respawn, and physical
## recovery of the exact carried stack back to the refuge.
## Second process (flag OFF, same save): the threat is off by default, the run
## identity survives, no bag is duplicated, nothing is re-awarded.
const AUDIT := "user://tests/a0_production_threat_audit.json"
const CARRIED := "stone_chunk"

var _world: Node


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/a0_production_threat.json"
	var verify := OS.get_cmdline_user_args().has("--verify-threat")
	# The guarded switch is a project setting, set before the world builds, exactly
	# like the Waystation candidate. Off is the shipped default (proved in the
	# second process).
	ProjectSettings.set_setting("survival/a0_optional_threat", not verify)
	if not bool(_save().call(&"configure_storage", save_path, true)):
		_expect(false, "authoritative disk profile loads")
		_finish()
		return
	await _boot()
	_world = _host.get_child(0) if _host != null and _host.get_child_count() > 0 else null
	_expect(_world != null, "the production overworld boots with the threat setting %s" % ("off" if verify else "on"))
	if _world != null:
		if verify:
			_verify_process()
		else:
			await _play_process()
	_teardown()
	await process_frame
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if OS.get_cmdline_user_args().has("--keep-threat"):
		_report()
		return
	for path: String in [save_path, AUDIT]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	_report()


func _report() -> void:
	if failures.is_empty():
		print("A0 PRODUCTION THREAT PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 PRODUCTION THREAT FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _enemies() -> Array[Node]:
	var out: Array[Node] = []
	for node: Node in get_nodes_in_group(&"enemies"):
		if is_instance_valid(node) and not node.is_queued_for_deletion():
			out.append(node)
	return out


func _play_process() -> void:
	var hero: CharacterBody2D = _world.get(&"player")
	var nav := _world.get(&"traversability") as OverworldTraversability
	var mount := _world.get(&"threat_mount") as Node
	_expect(hero != null and nav != null and mount != null, "world exposes Hero, navigation and the threat mount")
	if hero == null or nav == null or mount == null:
		return
	var report: Dictionary = mount.call(&"snapshot")
	print("A0_THREAT_MOUNT ", JSON.stringify(report))
	_expect(bool(report.get("mounted", false)), "the world mounted the guarded encounter (%s)" % str(report.get("last_error", "")))
	if not bool(report.get("mounted", false)):
		return
	_expect(bool(report.get("reward_free", false)) and int((report.get("attempts", 0) as int)) > 0,
		"the site was found by live validation, not by a hard-coded coordinate (%d probes)" % int(report.get("attempts", 0)))
	var site_cell: Array = report.get("site_cell", [])
	_expect(site_cell.size() == 2, "the mount reports the physical site it validated")
	var site := Vector2i(int(site_cell[0]), int(site_cell[1]))
	var spawn_cell := nav.cell_of(hero.global_position)
	_expect(maxi(absi(site.x - spawn_cell.x), absi(site.y - spawn_cell.y)) >= 20,
		"the encounter is not next to the starting bed (%d tiles away)" % maxi(absi(site.x - spawn_cell.x), absi(site.y - spawn_cell.y)))
	var enemies := _enemies()
	_expect(enemies.size() == 1, "exactly one enemy exists in the whole world (%d)" % enemies.size())
	if enemies.size() != 1:
		return
	var enemy := enemies[0]
	_expect(int(enemy.get(&"score_reward")) == 0, "the encounter awards no score")
	_expect(enemy.has_meta(&"loot_drop_processed"), "the encounter cannot drop random loot through the global director")
	# A fragile but truthful fairness check: the player must be able to see the
	# warning before the enemy can reach them.
	var warning := mount.get(&"encounter").get_node_or_null("OptionalEncounterWarning") as Label
	_expect(warning != null and warning.is_visible_in_tree(), "a visible warning marks the optional danger")

	_clear_inventory()
	_expect(bool(_give(CARRIED, 4)), "the Hero carries a real stack before the fight")
	var carried_before := _count(CARRIED)
	_expect(carried_before == 4, "the carried stack is exact (%d)" % carried_before)
	var session := root.get_node("GameSession")
	var score_before := int(session.get("score"))
	var hp_before := int(hero.get("health"))
	_expect(hp_before > 0, "the Hero begins alive")

	# --- ordinary input to the danger -------------------------------------
	# Walk in legs toward the site with real key input; the enemy detects within
	# 184 px and closes the rest of the distance itself.
	var reached := false
	var goal := Vector2i(-1, -1)
	for offset: Vector2i in [Vector2i(-6, 0), Vector2i(6, 0), Vector2i(0, -6), Vector2i(0, 6)]:
		var candidate := site + offset
		if not nav.in_bounds(candidate) or not nav.is_free(candidate):
			continue
		var path := _route(nav.cell_of(hero.global_position), candidate, nav, hero)
		if path.is_empty() and nav.cell_of(hero.global_position) != candidate:
			continue
		goal = candidate
		reached = await _walk_path(hero, path)
		break
	_expect(reached, "ordinary input walks from the spawn to the warned encounter")
	if not reached:
		return
	# Stand still and let the shipped AI act: no damage is injected.
	var landed_at := 0
	var until := Time.get_ticks_msec() + 45000
	while int(hero.get("health")) >= hp_before and not bool(hero.get("dead")) and Time.get_ticks_msec() < until:
		await physics_frame
	var hp_after := int(hero.get("health"))
	_expect(hp_after < hp_before, "the shipped skeleton lands real damage (%d -> %d)" % [hp_before, hp_after])
	_expect(float(hero.get("invulnerability_remaining")) >= 0.0, "the Hero's own i-frame timer is the only gate between hits")
	_expect(int(session.get("score")) == score_before, "being hit awards no encounter score")
	if hp_after >= hp_before:
		print("A0_THREAT_TRACE no_damage hero=%s enemy=%s delta=%s state=%s" % [str(hero.global_position), str(enemy.global_position), str(hero.global_position.distance_to(enemy.global_position)), str(enemy.get("_state"))])
		return

	# --- real lethal sequence ---------------------------------------------
	var deaths_before := int((_survival().call(&"document") as Dictionary).get("counters", {}).get("deaths", 0))
	until = Time.get_ticks_msec() + 180000
	while not bool(hero.get("dead")) and Time.get_ticks_msec() < until:
		await physics_frame
	_expect(bool(hero.get("dead")), "the same encounter can really kill the Hero (no scripted damage)")
	if not bool(hero.get("dead")):
		print("A0_THREAT_TRACE survived hp=%d" % int(hero.get("health")))
		return
	await process_frame
	var document: Dictionary = _survival().call(&"document")
	var bag_id := String(document.get("pending_death", ""))
	_expect(not bag_id.is_empty(), "death commits exactly one pending bag")
	_expect(int((document.get("counters", {}) as Dictionary).get("deaths", 0)) == deaths_before + 1,
		"exactly one death is recorded")
	_expect(_count(CARRIED) == 0, "the carried stack moved into the bag, not duplicated")
	var bag: Dictionary = (document.get("death_bags", {}) as Dictionary).get(bag_id, {})
	_expect(int((bag.get("stacks", {}) as Dictionary).get(CARRIED, {}).get("quantity", 0)) == carried_before,
		"the bag holds exactly the carried stack")
	_expect(_world.get_node_or_null("OptionalSkeletonEncounter") != null, "the encounter node itself survives the death")
	_expect(_enemies().is_empty(), "the one enemy is cleaned up on death (no second pursuer)")

	# --- the world's own respawn ------------------------------------------
	var respawn: Button = null
	var hud := _world.get(&"hud") as Node
	if hud != null:
		respawn = hud.find_child("Respawn", true, false) as Button
	_expect(respawn != null and respawn.is_visible_in_tree(), "the paused death panel offers the world's respawn")
	if respawn == null:
		return
	var camera := _world.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * respawn.get_global_rect().get_center())
	await process_frame
	_expect(not bool(hero.get("dead")), "respawn returns the Hero to the world")
	_expect(String((_survival().call(&"document") as Dictionary).get("pending_death", "")).is_empty(),
		"respawn clears the pending death")
	var respawn_cell := nav.cell_of(hero.global_position)
	_expect(nav.in_bounds(respawn_cell) and nav.is_free(respawn_cell),
		"the respawn cell is real navigable ground (%s)" % str(respawn_cell))

	# --- physical recovery of the same bag --------------------------------
	var bag_node: Node2D = null
	for raw: Variant in (_world.get(&"_death_bags") as Dictionary).values():
		if raw is Node2D and is_instance_valid(raw):
			bag_node = raw
	_expect(bag_node != null, "one physical bag is projected in the world")
	if bag_node == null:
		return
	var bag_cell := nav.cell_of(bag_node.global_position)
	var approach: Array[Vector2i] = []
	var here := nav.cell_of(hero.global_position)
	var bag_goal := Vector2i(-1, -1)
	for offset: Vector2i in [Vector2i.ZERO, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN,
			Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1)]:
		# The bag itself first: recovery is a proximity interaction (REACH 44 px),
		# so standing on the tile is the honest way to reach it.
		var candidate := bag_cell + offset
		var trial := _route(here, candidate, nav, hero)
		if here == candidate or not trial.is_empty():
			approach = trial
			bag_goal = candidate
			break
	var walked := bag_goal.x >= 0 and (approach.is_empty() or await _walk_path(hero, approach))
	_expect(walked and hero.global_position.distance_to(bag_node.global_position) <= 40.0,
		"ordinary movement physically returns to the same bag")
	if not walked:
		return
	# Recovery is the game's own left-click interaction: the pointer is resolved to
	# a world point and the nearest interactable inside the player's local radius
	# answers. Clicking at the Hero is the same gesture a player makes.
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	await process_frame
	_expect(_count(CARRIED) == carried_before, "recovering the bag restores the exact carried stack (%d)" % _count(CARRIED))
	_expect(not ((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).has(bag_id),
		"the recovered bag is gone, not duplicated")
	var run_authority: Node = root.get_node_or_null("RunLifecycle")
	var run_before: Dictionary = run_authority.call(&"phase") if run_authority != null else {}
	_expect(String(run_before.get("state", "")) == "active", "dying and recovering does not end the run")

	var audit := {
		"site": [site.x, site.y],
		"death_bag": bag_id,
		"deaths": int((_survival().call(&"document") as Dictionary).get("counters", {}).get("deaths", 0)),
		"carried": _count(CARRIED),
		"hp_before": hp_before,
		"hp_after_first_hit": hp_after,
		"score": int(session.get("score")),
		"score_before": score_before,
		"run_id": String(run_before.get("run_id", "")),
		"run_epoch": int(run_before.get("run_epoch", 0)),
		"bags": ((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).size(),
		"transactions": (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size(),
		"mount": report,
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "the first process writes the threat audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _verify_process() -> void:
	# Flag OFF: this is the shipped default. Nothing may be mounted.
	_expect(_world.get_node_or_null("OptionalSkeletonEncounter") == null, "with the setting off the world mounts no encounter")
	_expect(_world.get(&"threat_mount") != null, "the mount controller still exists and reports honestly")
	var report: Dictionary = (_world.get(&"threat_mount") as Node).call(&"snapshot")
	_expect(not bool(report.get("enabled", true)) and not bool(report.get("mounted", true)),
		"the mount reports itself disabled and unmounted")
	_expect(_enemies().is_empty(), "no enemy exists in a default world")
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "the second process reads the threat audit")
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "the threat audit is valid JSON")
	if not parsed is Dictionary:
		return
	var audit: Dictionary = parsed
	var document: Dictionary = _survival().call(&"document")
	_expect(int((document.get("counters", {}) as Dictionary).get("deaths", -1)) == int(audit.get("deaths", -2)),
		"the relaunch does not add a death")
	_expect((document.get("death_bags", {}) as Dictionary).size() == int(audit.get("bags", -1)),
		"the relaunch does not create or drop a bag")
	_expect(_count(CARRIED) == int(audit.get("carried", -1)), "the recovered stack survives the relaunch exactly")
	_expect((_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size() == int(audit.get("transactions", -1)),
		"the relaunch adds no transaction")
	var run_authority: Node = root.get_node_or_null("RunLifecycle")
	var run: Dictionary = run_authority.call(&"phase") if run_authority != null else {}
	_expect(String(run.get("run_id", "")) == String(audit.get("run_id", "x")), "the same run identity is restored")
	_expect(int(run.get("run_epoch", 0)) == int(audit.get("run_epoch", -1)), "the same run epoch is restored")
	var session := root.get_node("GameSession")
	_expect(int(session.get("score")) == int(audit.get("score", -1)), "no score is replayed or invented on relaunch")
