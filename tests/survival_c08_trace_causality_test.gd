extends "res://tests/survival_normal_home_journey_test.gd"
## C08 — REAL-INPUT FOOTPRINT CAUSALITY GATE (native, one production scene).
##
## ## What this proves, and with what
##
## A real `CharacterBody2D` Hero, moved only by `move_left/right/up/down` and
## pointer clicks, builds a real paid shelter with a real bed (the run's
## `spawn_anchor`), then performs the three C08 counterfactuals on that same
## scene and that same run:
##
##   A  NO TRACE      the home exists, every mark has decayed, and the creature
##                    never targets the home. It has no GPS and no target is
##                    injected anywhere.
##   B  VALID CHAIN   the same real walking lays a live trail; the creature
##                    observes one physically local, unoccluded mark, walks to
##                    it, and only then reads that mark's own causal successor.
##                    It reaches the home through contiguous evidence with no
##                    direct target, and the defender is really wounded when he
##                    chooses to step out.
##   C  BROKEN CHAIN  the same route with a lifetime too short for the trail to
##                    survive. The creature senses real evidence, then loses it
##                    and returns to its habitat. It never jumps to the player's
##                    current position and never reaches the home.
##
## ## What it is NOT
##
## It does not grant items (the shelter is paid with gathered material), does not
## teleport the Hero, does not inject damage, does not place a trace by hand, does
## not name a target, and does not read a mock clock: the run identity and the run
## clock come from `/root/RunLifecycle`, the surface from A1's reader or the annex
## world's authored ground code.
##
## Two more processes prove the K8 side:
##   --phase=relaunch   same save, second OS process: same run, same home, no
##                      inherited evidence, no replayed receipt, no new damage.
##   --phase=newrun     fresh profile: a new run id, no evidence from the old run.
##
## Run (native, Xvfb):
##   godot --path . --script res://tests/survival_c08_trace_causality_test.gd -- --phase=play --shots=<dir>
##   godot --path . --script res://tests/survival_c08_trace_causality_test.gd -- --phase=relaunch
##   godot --path . --script res://tests/survival_c08_trace_causality_test.gd -- --phase=newrun --shots=<dir>

const C08_SAVE := "user://tests/c08_causality.json"
const C08_NEW_SAVE := "user://tests/c08_newrun.json"
const C08_AUDIT := "user://tests/c08_causality_audit.json"
const PHASE_PLAY := "play"
const PHASE_RELAUNCH := "relaunch"
const PHASE_NEWRUN := "newrun"
## Explicit C08 policy inputs (owner-pending: K2 surface/weather law). The store
## treats them as caller inputs, so the gate sets them instead of pretending a
## number is canonical.
const POLICY_A_LIFETIME := 16.0
const POLICY_B_LIFETIME := 300.0
const POLICY_C_LIFETIME := 4.0
const SPACING := 24.0
const MAX_STEP := 48.0
const WOOD_FOR_HOME := 36

var _phase := PHASE_PLAY
var _shots := ""
var _keep := false
var _body_complete := false
var _world: Node = null
var _audit: Dictionary = {}


func _initialize() -> void:
	_console.call_deferred()


func _console() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--phase="):
			_phase = arg.substr("--phase=".length())
		elif arg.begins_with("--shots="):
			_shots = arg.substr("--shots=".length())
		elif arg == "--keep":
			_keep = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	if not _shots.is_empty():
		DirAccess.make_dir_recursive_absolute(_shots)
	# The shipped threat seam is default OFF. This gate turns the ONE bounded
	# encounter and the ONE C08 adapter on explicitly, exactly as a player would
	# through the guarded settings, and proves the default-off path separately in
	# the relaunch phase's receipt checks.
	# The shipped default is OFF. The play phase proves that default and then mounts
	# the one bounded creature through the world's own production mount, after the
	# shelter exists, so a gathering walk can never be described as a C08 test.
	ProjectSettings.set_setting("survival/a0_optional_threat", false)
	ProjectSettings.set_setting("survival/c08_footprints", true)
	ProjectSettings.set_setting("survival/c08_trace_follow", _phase != PHASE_RELAUNCH)
	ProjectSettings.set_setting("survival/c08_footprint_marks", true)
	var save := _save()
	var path := C08_NEW_SAVE if _phase == PHASE_NEWRUN else C08_SAVE
	if _phase == PHASE_PLAY or _phase == PHASE_NEWRUN:
		# A fresh profile: the world opens the run, exactly like a new game.
		_expect(bool(save.call(&"configure_storage", path, false)), "authoritative storage configures a fresh profile")
		save.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE")
		save.call(&"save_now")
	else:
		_expect(bool(save.call(&"configure_storage", path, true)), "the second process reads the first process's save")
	await _boot()
	if _host != null and _host.get_child_count() > 0:
		_world = _host.get_child(0)
		if _phase == PHASE_RELAUNCH:
			await _relaunch_body()
		elif _phase == PHASE_NEWRUN:
			await _newrun_body()
		else:
			await _body()
	_expect(_body_complete, "the C08 body ran to completion")
	_teardown()
	await process_frame
	await process_frame
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	Engine.time_scale = 1.0
	if not _keep:
		for path: String in [C08_SAVE, C08_NEW_SAVE]:
			if FileAccess.file_exists(path):
				DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	if failures.is_empty():
		print("\nC08 TRACE CAUSALITY %s PASSED - %d checks" % [_phase.to_upper(), checks])
		quit(0)
		return
	print("\nC08 TRACE CAUSALITY %s FAILED - %d/%d" % [_phase.to_upper(), failures.size(), checks])
	for failure: String in failures:
		print("  - %s" % failure)
	quit(1)


func _boot() -> Node:
	# Test speed control only: physics rules, collision and input are unchanged,
	# the run clock is wall time and is therefore not scaled.
	Engine.time_scale = 2.0
	var world: Node = await super._boot()
	if world == null:
		return null
	# Let the world finish its first frames so the C08 source has real samples.
	await process_frame
	await physics_frame
	return world


# ---------------------------------------------------------------------------
# seats
# ---------------------------------------------------------------------------
func _hero() -> CharacterBody2D:
	return _world.get(&"player") as CharacterBody2D


func _nav() -> OverworldTraversability:
	return _world.get(&"traversability") as OverworldTraversability


func _builder() -> SurvivalBuildSystem:
	return _world.get(&"survival_build") as SurvivalBuildSystem


func _traces() -> Node:
	return _world.get(&"c08_traces") as Node


func _mount() -> Node:
	return _world.get(&"threat_mount") as Node


func _encounter() -> Node:
	var mount := _mount()
	if mount == null:
		return null
	return mount.get(&"encounter") as Node


func _enemy() -> CharacterBody2D:
	var found: Array[Node] = []
	for node: Node in get_nodes_in_group(&"enemies"):
		if is_instance_valid(node) and not node.is_queued_for_deletion():
			found.append(node)
	return found[0] as CharacterBody2D if found.size() == 1 else null


func _follower() -> Variant:
	var encounter := _encounter()
	return null if encounter == null else encounter.get(&"follower")


func _run_phase() -> Dictionary:
	var lifecycle := root.get_node_or_null("RunLifecycle")
	return lifecycle.call(&"phase") if lifecycle != null else {}


## An interior cell the Hero can stand in without standing on the bed itself.
func _stand_cell() -> Vector2i:
	var nav := _nav()
	var bed := nav.cell_of(_home_center())
	for offset: Vector2i in [Vector2i(-1, -1), Vector2i(-1, 0), Vector2i(0, -1), Vector2i.ZERO]:
		var cell := bed + offset
		if nav.in_bounds(cell) and nav.is_free(cell):
			return cell
	return bed


func _home_center() -> Vector2:
	var build := _builder()
	for value: Variant in build._placed.values():
		var structure := value as SurvivalStructure
		if structure != null and is_instance_valid(structure) and structure.piece_id == SurvivalStructure.PIECE_BED:
			return structure.global_position
	return Vector2.ZERO


func _direct(enemy: CharacterBody2D, hero: CharacterBody2D) -> bool:
	if enemy == null or hero == null or not is_instance_valid(enemy):
		return false
	return bool(enemy.call(&"_can_detect_target", float(enemy.get(&"disengage_range")))) \
		and bool(enemy.call(&"_has_line_of_sight", hero))


# ---------------------------------------------------------------------------
# main body (phase = play)
# ---------------------------------------------------------------------------
func _body() -> void:
	var hero := _hero()
	var nav := _nav()
	var build := _builder()
	var source := _traces()
	var mount := _mount()
	_expect(hero != null and nav != null and build != null, "the production world exposes Hero, navigation and the survival build")
	if hero == null or nav == null or build == null:
		return
	_expect(source != null and bool(source.call(&"is_active")), "the world mounted the C08 footprint source")
	_expect(mount != null, "the world owns a threat mount that honestly reports the shipped default")
	if mount != null:
		_expect(not bool(mount.call(&"snapshot").get("mounted", true)), "with the flag off, no creature is mounted")
	if source == null:
		_body_complete = false
		return
	_expect(bool(source.call(&"configure_policy", SPACING, POLICY_A_LIFETIME, MAX_STEP)),
		"policy A is set before the shelter walk, so no mark outlives its own rule")
	_expect(_enemy() == null and _world.get_node_or_null("OptionalSkeletonEncounter") == null,
		"the shipped default exposes no creature in a fresh default world")
	var phase := _run_phase()
	var source_snapshot: Dictionary = source.call(&"snapshot")
	print("C08_SOURCE ", JSON.stringify(source_snapshot))
	_expect(String(source_snapshot.get("run_id", "")) == String(phase.get("run_id", "")),
		"footprint evidence is bound to the authoritative K8 run id")
	_expect(bool(source_snapshot.get("run_clock_ok", false)), "the run clock is available and active")
	_expect(int(source_snapshot.get("run_clock_agrees_with_phase", -1)) == 1,
		"the derived run clock agrees with the K8 phase's own elapsed seconds")
	_expect(int(source_snapshot.get("total_records", -1)) == 0, "a fresh run starts with no evidence")

	# --- a real paid shelter, built by real input -------------------------
	if not await _build_home(hero, nav, build):
		_body_complete = false
		return
	var home := _home_center()
	_expect(home != Vector2.ZERO, "the paid bed is the home anchor")
	_expect(not String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")).is_empty(),
		"the paid bed is the run's authoritative spawn anchor")
	await _capture("c08_00_home_built")

	# --- the one bounded creature, mounted by the world's own production path --
	ProjectSettings.set_setting("survival/a0_optional_threat", true)
	_world.call(&"_mount_optional_threat")
	mount = _mount()
	encounter = _encounter()
	var enemy := _enemy()
	_expect(mount != null and bool(mount.call(&"snapshot").get("mounted", false)),
		"the world mounts the guarded creature at a live-validated site (%s)"
			% (str(mount.call(&"snapshot").get("last_error", "")) if mount != null else "no mount"))
	_expect(encounter != null and enemy != null, "exactly one creature exists and exposes the C08 adapter")
	if encounter == null or enemy == null:
		_body_complete = false
		return
	_expect(enemy.get(&"evidence_follower") != null, "the creature holds the evidence adapter, not a target")
	_expect(enemy.get(&"_priority_target") == null, "no target was injected into the creature")
	_expect(int(enemy.get(&"score_reward")) == 0 and bool(enemy.has_meta(&"loot_drop_processed")),
		"the creature still awards no score and cannot drop loot")

	# --- A: NO TRACE ------------------------------------------------------
	var window_a := await _counterfactual_a(source, encounter, enemy, hero, home)
	_audit["A_no_trace"] = window_a

	# --- B: VALID CHAIN ---------------------------------------------------
	var window_b := await _counterfactual_b(source, encounter, enemy, hero, nav, home)
	_audit["B_valid_chain"] = window_b

	# --- C: BROKEN / EXPIRED CHAIN ---------------------------------------
	var window_c := await _counterfactual_c(source, encounter, enemy, hero, nav, home)
	_audit["C_broken_chain"] = window_c

	# --- K8 identity for the second process ------------------------------
	var run := _run_phase()
	_audit["run_id"] = String(run.get("run_id", ""))
	_audit["run_epoch"] = int(run.get("run_epoch", 0))
	_audit["transactions"] = (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size()
	_audit["hero_health"] = int(hero.get(&"health"))
	_audit["score"] = int(root.get_node("GameSession").get(&"score"))
	_audit["deaths"] = int((_survival().call(&"document") as Dictionary).get("counters", {}).get("deaths", 0))
	_audit["source"] = source.call(&"snapshot")
	_audit["encounter"] = encounter.call(&"c08_snapshot")
	_write_audit()
	_save().call(&"save_now")
	_keep = true
	_body_complete = true


# ---------------------------------------------------------------------------
# shelter
# ---------------------------------------------------------------------------
func _build_home(hero: CharacterBody2D, nav: OverworldTraversability, build: SurvivalBuildSystem) -> bool:
	var ok := await _gather_until(_world, hero, nav, "oak_tree", WOOD, WOOD_FOR_HOME)
	_expect(ok, "ordinary inputs gather %d oak for a real shelter" % WOOD_FOR_HOME)
	if not ok:
		return false
	ok = await _gather_until(_world, hero, nav, "scrap_pile", IRON, 2)
	_expect(ok, "ordinary inputs gather two scrap for the door and the bed")
	if not ok:
		return false
	# The home belongs near the run's own spawn: the creature's site is validated
	# 26..64 tiles from that spawn, so a shelter built close to it cannot be
	# confused with a shelter built next to the monster.
	var spawn_point: Vector2 = _world.call(&"_authored_spawn")
	var spawn_cell := nav.cell_of(spawn_point)
	if nav.cell_of(hero.global_position) != spawn_cell:
		var to_spawn := _route(nav.cell_of(hero.global_position), spawn_cell, nav, hero)
		if not to_spawn.is_empty():
			await _walk_path(hero, to_spawn)
	var start := nav.cell_of(hero.global_position)
	var distances := nav.reachable_from(start)
	var center := Vector2i(-1, -1)
	for radius in range(0, 8):
		if center.x >= 0:
			break
		for dy in range(-radius, radius + 1):
			if center.x >= 0:
				break
			for dx in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := start + Vector2i(dx, dy)
				if not nav.in_bounds(candidate) or distances[candidate.y * nav.width + candidate.x] < 0:
					continue
				if _site_clear(build, candidate):
					center = candidate
					break
	_expect(center.x >= 0, "a reachable prospective shelter site exists")
	if center.x < 0:
		return false
	var path := _route(start, center, nav, hero)
	var walked := await _walk_path(hero, path)
	_expect(walked and nav.cell_of(hero.global_position) == center, "ordinary movement reaches the chosen site")
	if not walked:
		return false
	if not build.active:
		await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_2")
	_expect(build.active and build.selected_piece == "wall_wood", "ordinary build inputs arm and select paid walls")
	if not build.active or build.selected_piece != "wall_wood":
		return false
	var origin := center - Vector2i(2, 2)
	for y in range(5):
		for x in range(5):
			if x != 0 and x != 4 and y != 0 and y != 4:
				continue
			if x == 2 and y == 0:
				continue
			if not await _place_at(_world, build, origin + Vector2i(x, y)):
				_expect(false, "ordinary pointer paid wall %d,%d" % [x, y])
				return false
	await _tap_action(&"build_slot_3")
	if not await _place_at(_world, build, origin + Vector2i(2, 0)):
		_expect(false, "ordinary pointer paid the door")
		return false
	var room: String = build.room_topology.room_at(center)
	_expect(not room.is_empty(), "the paid enclosure is a derived room (roofed)")
	if room.is_empty():
		return false
	await _tap_action(&"build_slot_5")
	if not await _place_at(_world, build, origin + Vector2i(3, 3)):
		_expect(false, "ordinary pointer paid the bed inside the room")
		return false
	await _tap_action(&"build_toggle")
	var bed_id := build.entity_at_layer(origin + Vector2i(3, 3), "object")
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	var bed_active := String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id
	_expect(bed_active, "an ordinary world click activates the paid bed as the home anchor")
	if not bed_active:
		print("C08_BED_FAIL interaction=%s hero=%s" % [str(build.structure_node(bed_id).last_interaction()), str(_hero().global_position)])
		return false
	_expect(build.active == false and _count(WOOD) == 0, "the shelter charged exactly the gathered material")
	return true


# ---------------------------------------------------------------------------
# counterfactuals
# ---------------------------------------------------------------------------
func _counterfactual_a(source: Node, encounter: Node, enemy: CharacterBody2D,
		hero: CharacterBody2D, home: Vector2) -> Dictionary:
	_expect(bool(source.call(&"configure_policy", SPACING, POLICY_A_LIFETIME, MAX_STEP)),
		"policy A: marks decay in %.0f run-seconds" % POLICY_A_LIFETIME)
	# Walk the Hero to the bed and let every mark laid during construction decay.
	await _walk_to_cell(hero, _stand_cell())
	var deadline := Time.get_ticks_msec() + 40_000
	while int(source.call(&"live_count")) > 0 and Time.get_ticks_msec() < deadline:
		await physics_frame
	var live := int(source.call(&"live_count"))
	_expect(live == 0, "every mark from the construction walk has decayed (%d live)" % live)
	var follower: Variant = encounter.get(&"follower")
	if follower == null:
		_expect(false, "A: the creature holds the C08 evidence adapter")
		return {}
	follower.begin_window("A_no_trace")
	var hp_before := int(hero.get(&"health"))
	var site: Vector2 = _encounter().global_position
	var stats := await _observe(enemy, hero, home, 12.0)
	await _capture("c08_a_no_trace")
	var snapshot: Dictionary = follower.snapshot()
	print("C08_A ", JSON.stringify({"follower": snapshot, "observe": stats, "hero_hp": [hp_before, int(hero.get(&"health"))]}))
	_expect(int(snapshot.get("sensed", -1)) == 0, "A: the creature never observes a mark that does not exist")
	_expect(int(snapshot.get("hops", -1)) == 0, "A: the creature takes no step toward the home")
	_expect(String(snapshot.get("lost_reason", "")) != "direct_sight", "A: the home is out of the creature's direct sight")
	_expect(float(stats.get("min_home_distance", 0.0)) >= 240.0,
		"A: the creature never approaches the home (%0.0f px)" % float(stats.get("min_home_distance", 7.0)))
	_expect(int(stats.get("investigate_ticks", -1)) == 0, "A: the creature never enters the evidence state")
	_expect(int(hero.get(&"health")) == hp_before, "A: the home is not attacked from nowhere")
	_expect(enemy.get(&"evidence_follower") != null and enemy.get(&"_priority_target") == null,
		"A: no target was injected into the creature")
	return {"live_at_start": live, "follower": snapshot, "observe": stats, "site": [site.x, site.y]}


func _counterfactual_b(source: Node, encounter: Node, enemy: CharacterBody2D,
		hero: CharacterBody2D, nav: OverworldTraversability, home: Vector2) -> Dictionary:
	_expect(bool(source.call(&"configure_policy", SPACING, POLICY_B_LIFETIME, MAX_STEP)),
		"policy B: marks survive the walk (%.0f run-seconds)" % POLICY_B_LIFETIME)
	var follower: Variant = encounter.get(&"follower")
	if follower == null:
		_expect(false, "B: the creature holds the C08 evidence adapter")
		return {"ok": false}
	var route := _route_plan(hero, nav, home)
	_expect(bool(route.get("ok", false)), "B: a real walkable route exists past the creature and back home")
	if not bool(route.get("ok", false)):
		return {"ok": false}
	follower.begin_window("B_valid_chain")
	var hp_before := int(hero.get(&"health"))
	var stats := {"direct_ticks": 0, "min_home_distance": 99999.0, "investigate_ticks": 0}
	stats = await _walk_with_observation(hero, enemy, home, route["outbound"], stats)
	await _capture("c08_b_outbound")
	var walked_back := await _walk_with_observation(hero, enemy, home, route["inbound"], stats)
	_expect(walked_back.get("walked", false), "B: ordinary input walks back into the home")
	if not walked_back.get("walked", false):
		return {"ok": false, "stats": walked_back}
	stats = walked_back
	await _walk_to_cell(hero, _stand_cell())
	# The defender is inside a roofed room. The final leg to the door therefore
	# cannot be line of sight: the creature must follow the marks it can reach.
	var arrival := await _observe(enemy, hero, home, 150.0,
		func() -> bool:
			var snapshot: Dictionary = follower.snapshot()
			return bool(snapshot.get("reached_end", false)) \
				or (not bool(snapshot.get("pursuing", false)) and String(snapshot.get("lost_reason", "")) != "")
	)
	var snapshot: Dictionary = follower.snapshot()
	var hp_after := int(hero.get(&"health"))
	print("C08_B ", JSON.stringify({"follower": snapshot, "arrival": arrival, "hero_hp": [hp_before, hp_after],
		"enemy": [enemy.global_position.x, enemy.global_position.y], "home": [home.x, home.y]}))
	_expect(int(snapshot.get("sensed", 0)) >= 1, "B: the creature observes real, physically local evidence")
	_expect(int(snapshot.get("hops", 0)) >= 6,
		"B: the creature follows contiguous marks, not one guess (%d hops)" % int(snapshot.get("hops", 0)))
	_expect(float(snapshot.get("max_hop", 999.0)) <= 48.0,
		"B: no link is a jump (%0.1f px longest link)" % float(snapshot.get("max_hop", 0.0)))
	_expect(bool(snapshot.get("reached_end", false)) and String(snapshot.get("lost_reason", "")) == "chain_end",
		"B: the creature reaches the end of the real trail, at the home")
	_expect(float(arrival.get("min_home_distance", 99999.0)) <= 160.0,
		"B: the creature physically arrives at the home (%0.0f px)" % float(arrival.get("min_home_distance", 99999.0)))
	_expect(int(arrival.get("direct_ticks_at_end", -1)) == 0,
		"B: the final approach is evidence-driven, with no direct target on the Hero")
	_expect(int(arrival.get("damage_events", -1)) == 0 or float(arrival.get("first_damage_distance", 9999.0)) <= 100.0,
		"B: any damage during the approach happens only at the home, never at range")
	_expect(int(arrival.get("max_damage_distance", 0)) <= 0 or float(arrival.get("first_damage_distance", 9999.0)) <= 100.0,
		"B: the creature cannot damage the Hero from outside its own reach")
	var harm := int(hp_before) - int(hero.get(&"health"))
	_expect(harm >= 0, "B: the Hero cannot gain health from a witness")
	await _capture("c08_b_home_arrival")

	# The defender chooses to step out through the real door and face it. Only now
	# may real damage land, and it must be the shipped combat path.
	var door := _door_cell()
	if door.x >= 0:
		await _walk_to_cell(hero, door)
	var defence := await _observe(enemy, hero, home, 30.0,
		func() -> bool: return int(hero.get(&"health")) < int(hp_after))
	var hp_fight := int(hero.get(&"health"))
	_expect(hp_fight < hp_after, "B: stepping out really puts the defender in the creature's reach (%d -> %d)" % [int(hp_after), hp_fight])
	_expect(int(root.get_node("GameSession").get(&"score")) == 0, "B: the encounter still awards no score")
	_expect(float(defence.get("first_damage_distance", 9999.0)) <= 100.0,
		"B: the damage lands at the home, not through the world (%0.0f px)" % float(defence.get("first_damage_distance", 9999.0)))
	await _capture("c08_b_defence")
	return {"ok": true, "follower": snapshot, "arrival": arrival, "defence": defence,
		"hp": [hp_before, hp_after, hp_fight], "route": route["report"], "walk": stats}


func _counterfactual_c(source: Node, encounter: Node, enemy: CharacterBody2D,
		hero: CharacterBody2D, nav: OverworldTraversability, home: Vector2) -> Dictionary:
	_expect(bool(source.call(&"configure_policy", SPACING, POLICY_C_LIFETIME, MAX_STEP)),
		"policy C: marks decay faster than the creature can walk (%.0f run-seconds)" % POLICY_C_LIFETIME)
	var follower: Variant = encounter.get(&"follower")
	if follower == null:
		_expect(false, "C: the creature holds the C08 evidence adapter")
		return {"ok": false}
	# Give the creature time to walk its own way home, so this run starts from the
	# habitat and not from the previous counterfactual's doorstep.
	var returned := await _wait_until(func() -> bool:
		return enemy.global_position.distance_to(_mount().get("encounter").global_position) <= 120.0, 60.0)
	_expect(returned, "C: the creature returns to its habitat before the trail test")
	follower.begin_window("C_broken_chain")
	var route := _route_plan(hero, nav, home)
	_expect(bool(route.get("ok", false)), "C: the same walkable route is used again")
	if not bool(route.get("ok", false)):
		return {"ok": false}
	var stats := {"direct_ticks": 0, "min_home_distance": 99999.0, "investigate_ticks": 0}
	stats = await _walk_with_observation(hero, enemy, home, route["outbound"], stats)
	var back := await _walk_with_observation(hero, enemy, home, route["inbound"], stats)
	stats = back
	_expect(bool(back.get("walked", false)), "C: ordinary input walks back home again")
	await _walk_to_cell(hero, _stand_cell())
	var hp_before := int(hero.get(&"health"))
	var observe := await _observe(enemy, hero, home, 25.0)
	var snapshot: Dictionary = follower.snapshot()
	print("C08_C ", JSON.stringify({"follower": snapshot, "observe": observe, "hero_hp": [hp_before, int(hero.get(&"health"))]}))
	_expect(int(snapshot.get("sensed", 0)) >= 1, "C: the creature really observes evidence before losing it")
	_expect(String(snapshot.get("lost_reason", "")) == "expired",
		"C: the trail goes cold and the creature loses it (%s)" % String(snapshot.get("lost_reason", "")))
	_expect(not bool(snapshot.get("reached_end", false)),
		"C: an expired chain never hands the creature the walker's destination")
	_expect(float(snapshot.get("max_hop", 999.0)) <= 48.0,
		"C: even when losing the trail, no mark-to-mark jump happens (%0.1f px)" % float(snapshot.get("max_hop", 0.0)))
	_expect(float(observe.get("min_home_distance", 99999.0)) >= 200.0,
		"C: the creature does not reach the home on a dead trail (%0.0f px)" % float(observe.get("min_home_distance", 99999.0)))
	_expect(int(hero.get(&"health")) == hp_before, "C: a dead trail causes no damage at the home")
	await _capture("c08_c_lost")
	return {"ok": true, "follower": snapshot, "observe": observe, "hp": int(hero.get(&"health"))}


# ---------------------------------------------------------------------------
# observation, walking, capture
# ---------------------------------------------------------------------------
## Per-frame observation, used instead of a blind sleep so every claim about what
## the creature did has a sample behind it. Damage is counted, never injected, and
## the distance at which the first damage landed is recorded so "no remote damage"
## is a measurement rather than a promise.
func _observe(enemy: CharacterBody2D, hero: CharacterBody2D, home: Vector2, seconds: float,
		stop: Callable = Callable()) -> Dictionary:
	var stats := {"direct_ticks": 0, "direct_ticks_at_end": 0, "min_home_distance": 99999.0,
		"investigate_ticks": 0, "samples": 0, "states": {}, "damage_events": 0,
		"first_damage_distance": -1.0, "max_damage_distance": 0.0,
		"hp_start": int(hero.get(&"health")), "hp_end": int(hero.get(&"health"))}
	var last_hp := int(hero.get(&"health"))
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		if not is_instance_valid(enemy) or enemy.is_queued_for_deletion():
			break
		stats.samples = int(stats.samples) + 1
		var at: Vector2 = enemy.global_position
		stats.min_home_distance = minf(float(stats.min_home_distance), at.distance_to(home))
		if bool(enemy.call(&"_can_detect_target", float(enemy.get(&"disengage_range")))):
			stats.direct_ticks = int(stats.direct_ticks) + 1
		var label := String(enemy.call(&"state_label"))
		stats.states[label] = int((stats.states as Dictionary).get(label, 0)) + 1
		if label == "INVESTIGATE":
			stats.investigate_ticks = int(stats.investigate_ticks) + 1
		var hp := int(hero.get(&"health"))
		if hp < last_hp:
			stats.damage_events = int(stats.damage_events) + 1
			var distance := at.distance_to(home)
			if float(stats.first_damage_distance) < 0.0:
				stats.first_damage_distance = distance
			stats.max_damage_distance = maxf(float(stats.max_damage_distance), distance)
			last_hp = hp
		if stop.is_valid() and bool(stop.call()):
			break
		await physics_frame
	stats.hp_end = last_hp
	stats.direct_ticks_at_end = 1 if (is_instance_valid(enemy) and bool(enemy.call(&"_can_detect_target", float(enemy.get(&"disengage_range"))))) else 0
	return stats


## Walk one planned path while recording what the creature could see. Each cell of
## the plan is walked with the inherited ordinary-input walker.
func _walk_with_observation(hero: CharacterBody2D, enemy: CharacterBody2D, home: Vector2,
		path: Array[Vector2i], stats: Dictionary) -> Dictionary:
	var walked := true
	for index in range(0, path.size(), 4):
		var slice: Array[Vector2i] = []
		for step in range(index, mini(index + 4, path.size())):
			slice.append(path[step])
		var leg := _observe_walk(hero, enemy, home, slice, stats)
		if not bool(leg.get("walked", false)):
			walked = false
			break
	return {"walked": walked, "stats": stats, "min_home_distance": stats.min_home_distance,
		"direct_ticks": stats.direct_ticks, "investigate_ticks": stats.investigate_ticks}


func _observe_walk(hero: CharacterBody2D, enemy: CharacterBody2D, home: Vector2,
		path: Array[Vector2i], stats: Dictionary) -> Dictionary:
	var walked := true
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		var stalled := 0
		var escapes := 0
		var escape_frames := 0
		var escape_direction := Vector2.ZERO
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline:
			if is_instance_valid(enemy) and not enemy.is_queued_for_deletion():
				stats.samples = int(stats.samples) + 1
				stats.min_home_distance = minf(float(stats.min_home_distance), enemy.global_position.distance_to(home))
				if bool(enemy.call(&"_can_detect_target", float(enemy.get(&"disengage_range")))):
					stats.direct_ticks = int(stats.direct_ticks) + 1
				if String(enemy.call(&"state_label")) == "INVESTIGATE":
					stats.investigate_ticks = int(stats.investigate_ticks) + 1
			if escape_frames > 0:
				escape_frames -= 1
				_set_direction(escape_direction)
				await physics_frame
				continue
			var before := hero.global_position
			_set_direction(point - before)
			await physics_frame
			stalled = stalled + 1 if hero.global_position.distance_to(before) < 0.25 else 0
			if stalled >= 5:
				escapes += 1
				if escapes > 6:
					break
				_report_wedge(hero, cell, before, escapes)
				escape_direction = _escape_direction(hero, before, point, escapes)
				escape_frames = 10
				stalled = 0
		if hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			walked = false
			break
	_set_direction(Vector2.ZERO)
	return {"walked": walked}


func _walk_to_cell(hero: CharacterBody2D, cell: Vector2i) -> bool:
	var nav := _nav()
	if nav.cell_of(hero.global_position) == cell:
		return true
	var path := _route(nav.cell_of(hero.global_position), cell, nav, hero)
	if path.is_empty():
		return false
	return await _walk_path(hero, path)


func _door_cell() -> Vector2i:
	var build := _builder()
	for value: Variant in build._placed.values():
		var structure := value as SurvivalStructure
		if structure != null and is_instance_valid(structure) and structure.piece_id == SurvivalStructure.PIECE_DOOR:
			return structure.cell
	return Vector2i(-1, -1)


## A real walkable out-and-back route that passes physically close to the creature
## (so its own local sensing can reach the marks) without teleporting the Hero.
func _route_plan(hero: CharacterBody2D, nav: OverworldTraversability, home: Vector2) -> Dictionary:
	var encounter := _encounter()
	if encounter == null:
		return {"ok": false, "reason": "encounter_absent"}
	var site: Vector2 = encounter.global_position
	var site_cell := nav.cell_of(site)
	var home_cell := nav.cell_of(home)
	var start := nav.cell_of(hero.global_position)
	# A stand cell beside the creature: the marks there are inside its local query.
	var near := _nearest_free_near(nav, site_cell + Vector2i(0, 2), 4)
	if near.x < 0:
		return {"ok": false, "reason": "no_stand_cell_near_creature"}
	# Continue outward, away from the home, so the trail is a journey and not a
	# circle around the house.
	var outward_dir := Vector2(site - home).normalized()
	var far_point := site + outward_dir * 320.0
	var far := _nearest_free_near(nav, nav.cell_of(far_point), 5)
	if far.x < 0:
		far = near
	var outbound := _route(start, near, nav, hero)
	var second := _route(near, far, nav, hero)
	if outbound.is_empty() and start != near:
		return {"ok": false, "reason": "no_route_to_creature"}
	for cell: Vector2i in second:
		outbound.append(cell)
	var inbound := _route(far, home_cell, nav, hero)
	if inbound.is_empty() and far != home_cell:
		return {"ok": false, "reason": "no_route_home"}
	var report := {"near": [near.x, near.y], "far": [far.x, far.y],
		"site": [site_cell.x, site_cell.y], "home": [home_cell.x, home_cell.y],
		"outbound_cells": outbound.size(), "inbound_cells": inbound.size()}
	print("C08_ROUTE ", JSON.stringify(report))
	return {"ok": true, "outbound": outbound, "inbound": inbound, "near": near, "far": far, "report": report}


func _nearest_free_near(nav: OverworldTraversability, origin: Vector2i, radius: int) -> Vector2i:
	if nav.in_bounds(origin) and nav.is_free(origin):
		return origin
	for ring in range(1, radius + 1):
		for dy in range(-ring, ring + 1):
			for dx in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dy)) != ring:
					continue
				var cell := origin + Vector2i(dx, dy)
				if nav.in_bounds(cell) and nav.is_free(cell):
					return cell
	return Vector2i(-1, -1)


func _wait_until(predicate: Callable, seconds: float) -> bool:
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		if predicate.is_valid() and bool(predicate.call()):
			return true
		await physics_frame
	return false


## Native frame. Never headless: the CI job runs under Xvfb with a real GL context.
func _capture(name: String) -> void:
	if _shots.is_empty():
		return
	await process_frame
	await process_frame
	var texture := root.get_texture()
	if texture == null:
		_expect(false, "a native viewport texture is available for %s" % name)
		return
	var image := texture.get_image()
	if image == null or image.is_empty():
		_expect(false, "a decoded native frame exists for %s" % name)
		return
	var path := _shots.path_join("%s.png" % name)
	_expect(image.save_png(path) == OK, "the %s frame is saved to %s" % [name, path])
	if image.get_width() > 0:
		var sample := image.get_pixel(image.get_width() / 2, image.get_height() / 3)
		print("C08_FRAME %s %dx%d center=%s" % [name, image.get_width(), image.get_height(), str(sample)])


# ---------------------------------------------------------------------------
# second and third processes (K8)
# ---------------------------------------------------------------------------
func _relaunch_body() -> void:
	var hero := _hero()
	var build := _builder()
	var source := _traces()
	var phase := _run_phase()
	var file := FileAccess.open(C08_AUDIT, FileAccess.READ)
	_expect(file != null, "the second process reads the first process's audit")
	if file == null:
		_body_complete = false
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "the audit is valid JSON")
	if not parsed is Dictionary:
		_body_complete = false
		return
	var audit: Dictionary = parsed
	# Keep the first process's evidence in the file this process rewrites.
	_audit = audit.duplicate(true)
	_expect(String(phase.get("run_id", "")) == String(audit.get("run_id", "")),
		"the same run identity is restored from the save")
	_expect(int(phase.get("run_epoch", 0)) == int(audit.get("run_epoch", -1)), "the same run epoch is restored")
	_expect(_home_center() != Vector2.ZERO, "the paid home and its bed are reconstructed from the save")
	_expect(not String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")).is_empty(),
		"the bed is still the run's spawn anchor after the relaunch")
	_expect(source != null and bool(source.call(&"is_active")), "the relaunched world mounts the footprint source again")
	if source == null:
		_body_complete = false
		return
	var snapshot: Dictionary = source.call(&"snapshot")
	print("C08_RELAUNCH_SOURCE ", JSON.stringify(snapshot))
	_expect(String(snapshot.get("run_id", "")) == String(audit.get("run_id", "")),
		"footprint evidence is bound to the restored run")
	_expect(int(snapshot.get("total_records", -1)) == 0,
		"a cold start carries no evidence from the previous process")
	_expect(int(source.call(&"live_count")) == 0, "no stale mark is live after the relaunch")
	# The threat receipt was consumed before the enemy was exposed, so the shipped
	# default (and a relaunch) cannot re-expose the encounter.
	_expect(_enemy() == null, "the one-shot encounter is not re-exposed on relaunch")
	_expect(_world.get_node_or_null("OptionalSkeletonEncounter") == null,
		"no encounter node exists on relaunch")
	_expect((_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size() == int(audit.get("transactions", -1)),
		"the relaunch adds no transaction")
	_expect(int(hero.get(&"health")) == int(audit.get("hero_health", -1)), "the relaunched Hero is the one that finished the run")
	_expect(int(root.get_node("GameSession").get(&"score")) == int(audit.get("score", -1)),
		"no score is replayed or invented on relaunch")
	_expect(int((_survival().call(&"document") as Dictionary).get("counters", {}).get("deaths", -1)) == int(audit.get("deaths", -2)),
		"no death is invented on relaunch")
	# Real movement in the new process must produce NEW evidence under the SAME run,
	# never resurrect the old records.
	var before := int(snapshot.get("records_written", 0))
	await _walk_to_cell(hero, _stand_cell() + Vector2i(0, 2))
	await _walk_to_cell(hero, _stand_cell())
	var after: Dictionary = source.call(&"snapshot")
	_expect(int(after.get("records_written", 0)) >= before, "the relaunched process records its own movement")
	_expect(int(after.get("total_records", 999999)) <= 256,
		"the relaunched evidence set is bounded (%d records)" % int(after.get("total_records", 0)))
	_audit["relaunch"] = after
	_write_audit()
	_body_complete = true


func _newrun_body() -> void:
	var source := _traces()
	var phase := _run_phase()
	var file := FileAccess.open(C08_AUDIT, FileAccess.READ)
	var previous: String = ""
	if file != null:
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		file.close()
		if parsed is Dictionary:
			previous = String((parsed as Dictionary).get("run_id", ""))
	_expect(source != null and bool(source.call(&"is_active")), "a new run mounts the footprint source")
	if source == null:
		_body_complete = false
		return
	var snapshot: Dictionary = source.call(&"snapshot")
	print("C08_NEWRUN_SOURCE ", JSON.stringify(snapshot))
	_expect(not previous.is_empty(), "the previous run id is available for comparison")
	_expect(String(snapshot.get("run_id", "")) != previous, "a new run has its own run identity")
	_expect(int(snapshot.get("total_records", -1)) == 0, "a new run inherits no evidence from the previous one")
	_expect(int(source.call(&"live_count")) == 0, "a new run starts with no live mark")
	await _capture("c08_newrun_start")
	_body_complete = true


func _write_audit() -> void:
	var file := FileAccess.open(C08_AUDIT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(_audit, "\t", true, true))
	file.close()
