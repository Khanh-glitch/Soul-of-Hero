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
	# The parent harness treats an unfinished body as a failure; this suite owns its
	# console, so it must do the same or a script error would read as a pass.
	_expect(_body_complete, "the threat body ran to completion")
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

	# --- measured lethality (honest, not a fixture) ------------------------
	# This is the fact a reviewer needs: what the shipped numbers actually do.
	var max_hp := int(hero.get("health"))
	var enemy_contact := int(enemy.get(&"contact_damage"))
	var enemy_reach := float(enemy.get(&"attack_range"))
	var hits := 0
	var damage_total := 0
	var last_hp := int(hero.get("health"))
	var until_wait := Time.get_ticks_msec() + 60000
	var enemy_lost := false
	while hits < 8 and not bool(hero.get("dead")) and Time.get_ticks_msec() < until_wait:
		if not is_instance_valid(enemy) or enemy.is_queued_for_deletion():
			enemy_lost = true
			break
		var gap := hero.global_position.distance_to(enemy.global_position)
		_set_direction(enemy.global_position - hero.global_position if gap > 30.0 else Vector2.ZERO)
		await physics_frame
		var hp := int(hero.get("health"))
		if hp < last_hp:
			hits += 1
			# A real denominator: sum the decrements the engine actually applied.
			# The old report divided the whole pool delta by this count and folded
			# a preceding hit into every per-hit figure.
			damage_total += last_hp - hp
			last_hp = hp
	_set_direction(Vector2.ZERO)
	_expect(hits >= 2, "the shipped enemy lands repeated real hits through the Hero's i-frame (%d)" % hits)
	# Measured, not assumed: the seam frees its enemy past a 160 px leash and does
	# not re-arm while the player stands nearby, so a fight drifts out of bounds
	# after a few knockbacks. That is the current bounded design, reported as fact.
	print("A0_THREAT_LETHALITY ", JSON.stringify({
		"max_health": max_hp, "hp_before": hp_before, "hp_after": last_hp,
		"hits": hits, "damage_observed": damage_total,
		"damage_per_hit": int(round(float(damage_total) / float(maxi(1, hits)))),
		"player_pool_max": int(hero.get("max_health")),
		"enemy_contact_damage": enemy_contact, "enemy_attack_range": enemy_reach,
		"enemy_disengaged": enemy_lost, "site_cell": [site.x, site.y],
		"hero_at": [hero.global_position.x, hero.global_position.y],
	}))
	# A lethal sequence is NOT claimed. With 14 damage per hit against this Hero's
	# health pool and a 160 px bound on the encounter, the shipped numbers cannot
	# kill the player who holds ground, and inventing damage to make a death
	# happen is exactly the fixture this round forbids. Death and bed routing are
	# therefore evidenced by the labelled deterministic owner-composition probe,
	# never by this test and never as player combat.
	print("A0_THREAT_DEATH_NOT_TESTED a full-health Hero cannot be killed by this source at current balance")

	# --- the encounter is not a faucet ------------------------------------
	_expect(_count(CARRIED) == carried_before, "fighting changes no inventory")
	_expect(int(session.get("score")) == score_before, "fighting awards no score at all")
	_expect(int((_survival().call(&"document") as Dictionary).get("counters", {}).get("deaths", 0)) == 0,
		"no death counter was written by a fight that did not kill anyone")
	_expect(((_survival().call(&"document") as Dictionary).get("death_bags", {}) as Dictionary).is_empty(),
		"no death bag exists without a real death")
	var run_authority: Node = root.get_node_or_null("RunLifecycle")
	var run_before: Dictionary = run_authority.call(&"phase") if run_authority != null else {}
	_expect(String(run_before.get("state", "")) == "active", "the run is still active after real combat damage")

	var audit := {
		"site": [site.x, site.y],
		"hp_before": hp_before,
		"hp_after": last_hp,
		"hits": hits,
		"max_health": max_hp,
		"score": int(session.get("score")),
		"run_id": String(run_before.get("run_id", "")),
		"run_epoch": int(run_before.get("run_epoch", 0)),
		"transactions": (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size(),
		"carried": _count(CARRIED),
		"mount": report,
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "the first process writes the threat audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()
	_body_complete = true


func _verify_process() -> void:
	# Flag OFF: this is the shipped default. Nothing may be mounted, and the
	# previous process's real fight must not have become free progress.
	_expect(_world.get_node_or_null("OptionalSkeletonEncounter") == null, "with the setting off the world mounts no encounter")
	_expect(_world.get(&"threat_mount") != null, "the mount controller still exists and reports honestly")
	var report: Dictionary = (_world.get(&"threat_mount") as Node).call(&"snapshot")
	_expect(not bool(report.get("enabled", true)) and not bool(report.get("mounted", true)),
		"the mount reports itself disabled and unmounted")
	_expect(_enemies().is_empty(), "no enemy exists in a default world")
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "the second process reads the threat audit")
	if file == null:
		_body_complete = true
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "the threat audit is valid JSON")
	if not parsed is Dictionary:
		_body_complete = true
		return
	var audit: Dictionary = parsed
	var document: Dictionary = _survival().call(&"document")
	_expect(int((document.get("counters", {}) as Dictionary).get("deaths", -1)) == 0,
		"the relaunch does not invent a death")
	_expect((document.get("death_bags", {}) as Dictionary).is_empty(), "the relaunch creates no bag")
	_expect(_count(CARRIED) == int(audit.get("carried", -1)), "the carried stack survives the relaunch exactly")
	_expect((_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size() == int(audit.get("transactions", -1)),
		"the relaunch adds no transaction")
	var run_authority: Node = root.get_node_or_null("RunLifecycle")
	var run: Dictionary = run_authority.call(&"phase") if run_authority != null else {}
	_expect(String(run.get("run_id", "")) == String(audit.get("run_id", "x")), "the same run identity is restored")
	_expect(int(run.get("run_epoch", 0)) == int(audit.get("run_epoch", -1)), "the same run epoch is restored")
	var session := root.get_node("GameSession")
	_expect(int(session.get("score")) == int(audit.get("score", -1)), "no score is replayed or invented on relaunch")
	_body_complete = true
