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
##                    It reaches the home through contiguous evidence; it may only
##                    pick the Hero up directly once it is already standing at the
##                    house, and the defender is really wounded when he steps out.
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
##
## The ordinary walker drives the Hero's centre to a cell's bottom edge, so a cell
## whose lower corner holds the bed, or whose row is the room's bottom row, cannot
## be reached: the body stops a few pixels short and the walk reports a wedge that
## is really furniture. Candidates are therefore checked against the real placed
## structures (the door is skipped: an open door has no collider) before one is
## chosen, and the cell below the doorway is tried first because the room is only
## three free cells wide.
func _stand_cell() -> Vector2i:
	var nav := _nav()
	var bed := nav.cell_of(_home_center())
	for offset: Vector2i in [Vector2i(-1, -2), Vector2i(0, -2), Vector2i(-2, -2), Vector2i(-1, 0),
			Vector2i(-1, -1), Vector2i(0, -1)]:
		var cell := bed + offset
		if not nav.in_bounds(cell) or not nav.is_free(cell):
			continue
		if _stand_point_clear(cell):
			return cell
	return bed


func _stand_point_clear(cell: Vector2i) -> bool:
	var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
	var build := _builder()
	if build == null:
		return true
	for value: Variant in build._placed.values():
		var structure := value as SurvivalStructure
		if structure == null or not is_instance_valid(structure) or structure.piece_id == SurvivalStructure.PIECE_DOOR:
			continue
		var rect := Rect2(structure.cell.x * 16.0, structure.cell.y * 16.0, 16.0, 16.0).grow(6.0)
		if rect.has_point(point):
			return false
	return true


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
	var encounter := _encounter()
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
	# Each counterfactual must complete before the next is attempted: a red A is a
	# diagnosis, not a licence to keep bolting on evidence.
	var window_a := await _counterfactual_a(source, encounter, enemy, hero, home)
	_audit["A_no_trace"] = window_a
	if not bool(window_a.get("ok", false)):
		_expect(false, "A must pass before B is attempted")
		_body_complete = false
		return

	# --- B: VALID CHAIN ---------------------------------------------------
	var window_b := await _counterfactual_b(source, encounter, enemy, hero, nav, home)
	_audit["B_valid_chain"] = window_b
	if not bool(window_b.get("ok", false)):
		_expect(false, "B must pass before C is attempted")
		_body_complete = false
		return

	# --- C: BROKEN / EXPIRED CHAIN ---------------------------------------
	var window_c := await _counterfactual_c(source, encounter, enemy, hero, nav, home)
	_audit["C_broken_chain"] = window_c
	if not bool(window_c.get("ok", false)):
		_expect(false, "C must pass before the K8 evidence window")
		_body_complete = false
		return

	# --- K8: a still-valid trail may not be erased by quitting ------------
	_expect(bool(source.call(&"configure_policy", SPACING, 600.0, MAX_STEP)),
		"policy for the K8 persistence window: live marks survive the quit")
	await _walk_to_cell(hero, _door_cell())
	await _walk_to_cell(hero, _stand_cell())
	var committed := bool(source.call(&"commit_evidence"))
	_expect(committed, "the still-valid trail is written to the authoritative save (%s)"
		% String(source.get(&"ledger_error")))
	var ledger: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("c08_traces", {})
	var marks: Array = ledger.get("marks", []) if ledger.get("marks", []) is Array else []
	_expect(String(ledger.get("run_id", "")) == String(phase.get("run_id", "")),
		"the stored ledger belongs to this run")
	_expect(marks.size() > 0, "the stored ledger holds live marks (%d)" % marks.size())
	_audit["ledger"] = {"run_id": String(ledger.get("run_id", "")), "marks": marks.size(),
		"commit": committed, "error": String(source.get(&"ledger_error"))}

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
	# at least 26 tiles from the Hero when it mounts, so a shelter built near the
	# spawn cannot be confused with a shelter built next to the monster. The spawn
	# itself is a refuge with authored props, so the search is a bounded ring
	# around it and falls back to the Hero's own position if the refuge is full.
	var spawn_point: Vector2 = _world.call(&"_authored_spawn")
	var spawn_free := nav.nearest_free_position(spawn_point, 16)
	var anchors: Array[Vector2i] = [nav.cell_of(spawn_free), nav.cell_of(hero.global_position)]
	var center := Vector2i(-1, -1)
	var start := nav.cell_of(hero.global_position)
	for anchor: Vector2i in anchors:
		if center.x >= 0:
			break
		var here := nav.cell_of(hero.global_position)
		if here != anchor:
			var to_anchor := _route(here, anchor, nav, hero)
			if not to_anchor.is_empty():
				await _walk_path(hero, to_anchor)
		start = nav.cell_of(hero.global_position)
		var distances := nav.reachable_from(start)
		for radius in range(0, 31):
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
	_expect(center.x >= 0, "a reachable prospective shelter site exists near the run spawn")
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
	var _window_failures_before := failures.size()
	follower.begin_window("A_no_trace")
	var hp_before := int(hero.get(&"health"))
	var site: Vector2 = _encounter().global_position
	var stats := await _observe(enemy, hero, home, 12.0)
	await _capture("c08_a_no_trace")
	var snapshot: Dictionary = follower.snapshot()
	print("C08_A ", JSON.stringify({"follower": _compact_follower(snapshot), "observe": stats,
		"hero_hp": [hp_before, int(hero.get(&"health"))]}))
	_expect(int(snapshot.get("sensed", -1)) == 0, "A: the creature never observes a mark that does not exist")
	_expect(int(snapshot.get("hops", -1)) == 0, "A: the creature takes no step toward the home")
	_expect(int(stats.get("direct_ticks", -1)) == 0, "A: the hidden home is never in the creature's direct sight")
	_expect(float(stats.get("min_home_distance", 0.0)) >= 240.0,
		"A: the creature never approaches the home (%0.0f px)" % float(stats.get("min_home_distance", 7.0)))
	_expect(int(stats.get("investigate_ticks", -1)) == 0, "A: the creature never enters the evidence state")
	_expect(int(hero.get(&"health")) == hp_before, "A: the home is not attacked from nowhere")
	_expect(enemy.get(&"evidence_follower") != null and enemy.get(&"_priority_target") == null,
		"A: no target was injected into the creature")
	var ok := failures.size() == _window_failures_before
	return {"ok": ok, "live_at_start": live, "follower": snapshot, "observe": stats,
		"site": [site.x, site.y]}


func _counterfactual_b(source: Node, encounter: Node, enemy: CharacterBody2D,
		hero: CharacterBody2D, nav: OverworldTraversability, home: Vector2) -> Dictionary:
	_expect(bool(source.call(&"configure_policy", SPACING, POLICY_B_LIFETIME, MAX_STEP)),
		"policy B: marks survive the walk (%.0f run-seconds)" % POLICY_B_LIFETIME)
	var follower: Variant = encounter.get(&"follower")
	if follower == null:
		_expect(false, "B: the creature holds the C08 evidence adapter")
		return {"ok": false}
	var opened := await _open_door(hero)
	_expect(opened, "B: ordinary pointer input opens the paid door (a sealed room is a real rule)")
	if not opened:
		print("C08_DOOR_FAIL cell=%s open=%s hero=%s" % [str(_door_cell()), str(_door_open()),
			str(hero.global_position)])
		return {"ok": false}
	var route := _route_plan(hero, nav, home)
	_expect(bool(route.get("ok", false)), "B: a real walkable route exists past the creature and back home")
	if not bool(route.get("ok", false)):
		return {"ok": false}
	var _window_failures_before := failures.size()
	follower.begin_window("B_valid_chain")
	print("C08_B_SOURCE_START ", JSON.stringify(source.call(&"snapshot")))
	var hp_before := int(hero.get(&"health"))
	var stats := _walk_stats()
	var legs: Array = route["legs"]
	var walked_home := true
	for index in range(legs.size()):
		var leg: Array[Vector2i] = legs[index]
		if leg.is_empty():
			continue
		var outcome: Dictionary = await _walk_with_observation(hero, enemy, home, leg, stats)
		stats = outcome
		if not bool(outcome.get("walked", false)):
			walked_home = false
			print("C08_B_LEG_FAIL ", JSON.stringify({"leg": index, "cells": leg.size(),
				"follower": _compact_follower(follower.snapshot()),
				"hero": [hero.global_position.x, hero.global_position.y],
				"probe": _trace_probe(source, enemy)}))
			break
		print("C08_B_LEG ", JSON.stringify({"leg": index, "cells": leg.size(),
			"skipped": int(stats.get("skipped", 0)),
			"hero": [snappedf(hero.global_position.x, 0.1), snappedf(hero.global_position.y, 0.1)],
			"source": _source_probe(source), "probe": _trace_probe(source, enemy)}))
		if index == 0:
			print("C08_B_SOURCE_OUT ", JSON.stringify({"source": source.call(&"snapshot"),
				"follower": _compact_follower(follower.snapshot()),
				"probe": _trace_probe(source, enemy),
				"enemy": [enemy.global_position.x, enemy.global_position.y]}))
			await _capture("c08_b_outbound")
	_expect(walked_home, "B: ordinary input walks the whole out-and-back route and home")
	if not walked_home:
		return {"ok": false, "stats": stats}
	await _walk_to_cell(hero, _stand_cell())
	# The Hero is now behind a wall, 26 tiles from the creature: it can neither see
	# nor chase him. Give it a bounded window to reach a real mark on its own and
	# start walking the chain. Nothing is handed to it here.
	var armed := await _wait_until(func() -> bool:
		var view: Dictionary = follower.snapshot()
		return int(view.get("sensed", 0)) >= 1 and int(view.get("hops", 0)) >= 1, 120.0)
	print("C08_B_ARMED ", JSON.stringify({"armed": armed, "source": _source_probe(source),
		"follower": _compact_follower(follower.snapshot()), "probe": _trace_probe(source, enemy)}))
	# The defender is inside a roofed room. The final leg to the door therefore
	# cannot be line of sight: the creature must follow the marks it can reach.
	var arrival := await _observe(enemy, hero, home, 150.0,
		func() -> bool:
			var snapshot: Dictionary = follower.snapshot()
			return bool(snapshot.get("reached_end", false)) \
				or (not bool(snapshot.get("pursuing", false)) and String(snapshot.get("lost_reason", "")) != "") \
				or (is_instance_valid(enemy) and enemy.global_position.distance_to(home) <= 140.0),
		follower
	)
	var snapshot: Dictionary = follower.snapshot()
	var hp_after := int(hero.get(&"health"))
	print("C08_B ", JSON.stringify({"follower": _compact_follower(snapshot), "arrival": arrival,
		"hero_hp": [hp_before, hp_after], "source": _source_probe(source),
		"enemy": [enemy.global_position.x, enemy.global_position.y], "home": [home.x, home.y]}))
	_expect(int(snapshot.get("sensed", 0)) >= 1, "B: the creature observes real, physically local evidence")
	_expect(int(snapshot.get("hops", 0)) >= 6,
		"B: the creature follows contiguous marks, not one guess (%d hops)" % int(snapshot.get("hops", 0)))
	_expect(float(snapshot.get("max_hop", 999.0)) <= 48.0,
		"B: no link is a jump (%0.1f px longest link)" % float(snapshot.get("max_hop", 0.0)))
	_expect(float(arrival.get("min_home_distance", 99999.0)) <= 160.0,
		"B: the creature physically arrives at the home (%0.0f px)" % float(arrival.get("min_home_distance", 99999.0)))
	# "It arrived" is only interesting if it was made to work for it: the skeleton
	# asks the adapter only while it cannot see the Hero, so a non-zero call count
	# plus real hops is the difference between tracking and looking.
	_expect(int(snapshot.get("drive_calls", 0)) >= 1,
		"B: the skeleton really consulted the evidence adapter (%d calls)" % int(snapshot.get("drive_calls", 0)))
	print("C08_B_ARRIVAL ", JSON.stringify({"state": String(arrival.get("arrival_state", "")),
		"hops_at_arrival": int(arrival.get("arrival_hops", 0)),
		"first_direct": float(arrival.get("first_direct_distance", -1.0))}))
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
	return {"ok": failures.size() == _window_failures_before, "follower": snapshot,
		"arrival": arrival, "defence": defence,
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
	var habitat := _encounter()
	if habitat == null or not is_instance_valid(enemy):
		_expect(false, "C: the creature and its habitat still exist")
		return {"ok": false}
	# Ordinary retreat: the defender walks out of his own door and a few cells away,
	# so the creature is not cornered inside the paid room when the trail goes cold.
	if await _open_door(hero):
		var outside := _nearest_free_near(nav, _door_cell() + Vector2i(0, -2), 2)
		if outside.x >= 0:
			await _walk_to_cell(hero, outside)
	var returned := await _wait_until(func() -> bool:
		return is_instance_valid(enemy) and enemy.global_position.distance_to(habitat.global_position) <= 120.0, 60.0)
	_expect(returned, "C: the creature returns to its habitat before the trail test")
	var _window_failures_before := failures.size()
	follower.begin_window("C_broken_chain")
	var route := _route_plan(hero, nav, home)
	_expect(bool(route.get("ok", false)), "C: the same walkable route is used again")
	if not bool(route.get("ok", false)):
		return {"ok": false}
	var stats := _walk_stats()
	var walked_all := true
	var legs: Array = route["legs"]
	for leg_index in range(legs.size()):
		var leg: Array[Vector2i] = legs[leg_index]
		if leg.is_empty():
			continue
		var outcome: Dictionary = await _walk_with_observation(hero, enemy, home, leg, stats)
		stats = outcome
		if not bool(outcome.get("walked", false)):
			walked_all = false
			print("C08_C_LEG_FAIL ", JSON.stringify({"leg": leg_index, "cells": leg.size(),
				"follower": _compact_follower(follower.snapshot()), "probe": _trace_probe(source, enemy)}))
			break
	_expect(walked_all, "C: ordinary input walks the same route again")
	await _walk_to_cell(hero, _stand_cell())
	var hp_before := int(hero.get(&"health"))
	var observe := await _observe(enemy, hero, home, 25.0)
	var snapshot: Dictionary = follower.snapshot()
	print("C08_C ", JSON.stringify({"follower": _compact_follower(snapshot), "observe": observe,
		"walk": stats, "hero_hp": [hp_before, int(hero.get(&"health"))]}))
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
	return {"ok": failures.size() == _window_failures_before, "follower": snapshot,
		"observe": observe, "hp": int(hero.get(&"health"))}


# ---------------------------------------------------------------------------
# observation, walking, capture
# ---------------------------------------------------------------------------
## Every detection sample passes through here, so "the creature came within range
## of the Hero" always records how far the creature was from the home at that
## instant. That is the difference between arriving by evidence and knowing where
## the player lives.
func _note_direct(stats: Dictionary, enemy: CharacterBody2D, home: Vector2) -> void:
	if not bool(enemy.call(&"_can_detect_target", float(enemy.get(&"disengage_range")))):
		return
	stats.direct_ticks = int(stats.direct_ticks) + 1
	if float(stats.get("first_direct_distance", -1.0)) < 0.0:
		stats["first_direct_distance"] = enemy.global_position.distance_to(home)


## Per-frame observation, used instead of a blind sleep so every claim about what
## the creature did has a sample behind it. Damage is counted, never injected, and
## the distance at which the first damage landed is recorded so "no remote damage"
## is a measurement rather than a promise.
func _observe(enemy: CharacterBody2D, hero: CharacterBody2D, home: Vector2, seconds: float,
		stop: Callable = Callable(), follower: Variant = null) -> Dictionary:
	var stats := {"direct_ticks": 0, "direct_ticks_at_end": 0, "min_home_distance": 99999.0,
		"investigate_ticks": 0, "samples": 0, "states": {}, "damage_events": 0,
		"first_direct_distance": -1.0, "first_damage_distance": -1.0, "max_damage_distance": 0.0,
		"hp_start": int(hero.get(&"health")), "hp_end": int(hero.get(&"health"))}
	var last_hp := int(hero.get(&"health"))
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		if not is_instance_valid(enemy) or enemy.is_queued_for_deletion():
			break
		stats.samples = int(stats.samples) + 1
		var at: Vector2 = enemy.global_position
		stats.min_home_distance = minf(float(stats.min_home_distance), at.distance_to(home))
		_note_direct(stats, enemy, home)
		var label := String(enemy.call(&"state_label"))
		stats.states[label] = int((stats.states as Dictionary).get(label, 0)) + 1
		# First sample inside the house's own reach. Whatever the creature was
		# doing at that instant is the honest answer to "how did it get here": a
		# creature that walked up the chain is INVESTIGATE, one that chased the
		# defender is CHASE and one that was handed a target never leaves PATROL.
		if float(stats.get("arrival_state_at", -1.0)) < 0.0 and at.distance_to(home) <= 160.0:
			stats["arrival_state_at"] = at.distance_to(home)
			stats["arrival_state"] = label
			if follower != null:
				var view: Dictionary = follower.snapshot()
				stats["arrival_pursuing"] = bool(view.get("pursuing", false))
				stats["arrival_goal_trace"] = int(view.get("goal_trace", 0))
				stats["arrival_hops"] = int(view.get("hops", 0))
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


## The follower snapshot without the step history. A window line has to fit in a
## CI annotation (GitHub truncates and drops long messages), so the history is
## summarised as a count plus the last few events instead of being dumped.
func _compact_follower(view: Dictionary) -> Dictionary:
	var events: Array = []
	var history: Array = view.get("history", []) if view.get("history", []) is Array else []
	var start := maxi(0, history.size() - 6)
	for index in range(start, history.size()):
		var raw: Variant = history[index]
		if raw is Dictionary:
			var event: Dictionary = raw
			events.append({"e": String(event.get("event", "")), "t": int(event.get("trace", 0)),
				"hop": snappedf(float(event.get("hop", 0.0)), 0.1)})
	return {"window": String(view.get("window", "")), "sensed": int(view.get("sensed", 0)),
		"hops": int(view.get("hops", 0)), "max_hop": snappedf(float(view.get("max_hop", 0.0)), 0.1),
		"refused": int(view.get("refused_links", 0)), "pursuing": bool(view.get("pursuing", false)),
		"reached_end": bool(view.get("reached_end", false)),
		"lost": String(view.get("lost_reason", "")), "goal_trace": int(view.get("goal_trace", 0)),
		"drive_calls": int(view.get("drive_calls", 0)),
		"block": String(view.get("block_reason", "")), "history": history.size(), "last": events}


## Every key the walk sampler writes, in one place. A missing key raises a script
## error on property access, and Godot keeps running after it: that once truncated
## a real 56-cell walk while the log looked merely unremarkable, so the window is
## seeded explicitly instead of assumed.
## What the creature could physically reach at this instant: live marks near it,
## the nearest one, and the store's own local query result. Evidence for "it had
## nothing to sense" instead of an assumption.
## The source's own counters, compact: how many samples it took, how many became
## marks, why the last one was refused, and whether the chain was broken. A trail
## that stops being written is a fact, not a mystery, once these are printed.
func _source_probe(source: Node) -> Dictionary:
	if source == null:
		return {"absent": true}
	var view: Dictionary = source.call(&"snapshot")
	return {"samples": int(view.get("samples", -1)), "written": int(view.get("records_written", -1)),
		"refused": int(view.get("samples_refused", -1)), "breaks": int(view.get("chain_breaks", -1)),
		"reason": String(view.get("last_reason", "")), "surface": String(view.get("last_surface", "")),
		"live": int(view.get("live", -1)), "total": int(view.get("total_records", -1)),
		"stamp": snappedf(float(view.get("stamp", -1.0)), 0.01)}


func _trace_probe(source: Node, enemy: Node2D) -> Dictionary:
	if source == null or enemy == null or not is_instance_valid(enemy):
		return {"ok": false, "reason": "absent"}
	var store: Variant = source.get(&"store")
	var clock: Dictionary = source.call(&"clock")
	if store == null or not bool(clock.get("ok", false)):
		return {"ok": false, "reason": "no_store_or_clock"}
	var stamp := float(clock["stamp"])
	var live: Array = source.call(&"live_traces", 96)
	var nearest := -1.0
	var nearest_id := 0
	for raw: Variant in live:
		if not raw is Dictionary:
			continue
		var record: Dictionary = raw
		var distance: float = enemy.global_position.distance_to(record.get("position", Vector2.ZERO))
		if nearest < 0.0 or distance < nearest:
			nearest = distance
			nearest_id = int(record.get("id", 0))
	var local: Array = store.call(&"nearby", enemy.global_position, 96.0, stamp)
	return {"ok": true, "live": live.size(), "total": int(store.call(&"total_count")),
		"nearest": snappedf(nearest, 0.1), "nearest_id": nearest_id, "local": local.size(),
		"enemy": [enemy.global_position.x, enemy.global_position.y], "stamp": snappedf(stamp, 0.01)}


func _walk_stats() -> Dictionary:
	return {"samples": 0, "min_home_distance": 99999.0, "direct_ticks": 0,
		"investigate_ticks": 0, "first_direct_distance": -1.0, "skipped": 0}


## Walk one planned path while recording what the creature could see. Each cell of
## the plan is walked with the inherited ordinary-input walker.
func _walk_with_observation(hero: CharacterBody2D, enemy: CharacterBody2D, home: Vector2,
		path: Array[Vector2i], stats: Dictionary) -> Dictionary:
	for key: String in ["samples", "direct_ticks", "investigate_ticks", "first_direct_distance", "skipped"]:
		if not stats.has(key):
			stats[key] = 0
	if not stats.has("min_home_distance"):
		stats["min_home_distance"] = 99999.0
	var origin := hero.global_position
	var walked := true
	for index in range(0, path.size(), 4):
		var slice: Array[Vector2i] = []
		for step in range(index, mini(index + 4, path.size())):
			slice.append(path[step])
		var leg: Dictionary = await _observe_walk(hero, enemy, home, slice, stats)
		if not bool(leg.get("walked", false)):
			walked = false
			break
	# A leg that was entirely skipped is not a walk. Without this guard the walker
	# could "succeed" while standing still: every blocked cell was skipped and every
	# skip counted as progress, which is the exact shape of a gate that passes
	# without doing anything.
	if walked and path.size() >= 4:
		var expected := float(path.size()) * 16.0 * 0.4
		var moved := hero.global_position.distance_to(origin)
		if moved < expected:
			print("C08_LEG_STALLED ", JSON.stringify({"cells": path.size(),
				"moved": snappedf(moved, 0.1), "expected": snappedf(expected, 0.1),
				"hero": [snappedf(hero.global_position.x, 0.1), snappedf(hero.global_position.y, 0.1)],
				"skips": int(stats.get("skipped", 0))}))
			walked = false
	# The window itself is returned, not a wrapper around it: handing a caller a
	# different shape than the sampler writes is exactly how a missing key turned
	# into a silent script error mid-walk once already.
	stats["walked"] = walked
	return stats


func _observe_walk(hero: CharacterBody2D, enemy: CharacterBody2D, home: Vector2,
		path: Array[Vector2i], stats: Dictionary) -> Dictionary:
	var walked := true
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 6000
		var stalled := 0
		var escapes := 0
		var escape_frames := 0
		var escape_direction := Vector2.ZERO
		var closest := hero.global_position.distance_to(point)
		var skipped := false
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline:
			if is_instance_valid(enemy) and not enemy.is_queued_for_deletion():
				stats.samples = int(stats.samples) + 1
				stats.min_home_distance = minf(float(stats.min_home_distance), enemy.global_position.distance_to(home))
				_note_direct(stats, enemy, home)
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
			# Progress, not motion. A body pressed against a creature slides a few
			# tenths of a pixel per frame and never arrives: measuring movement alone
			# reported no stall at all while the walker burned its whole deadline.
			var now := hero.global_position.distance_to(point)
			stalled = stalled + 1 if now >= closest - 0.05 else 0
			closest = minf(closest, now)
			if stalled >= 5:
				if _blocked_by_body(hero):
					# A living body is not terrain. A player does not shove at the
					# same pixel for six seconds while something stands on it: he
					# steps around it and picks up the path at the next cell. The
					# skip is counted and printed, never silent.
					skipped = true
					stats["skipped"] = int(stats.get("skipped", 0)) + 1
					_note_skip(point, hero)
					break
				escapes += 1
				if escapes > 4:
					# Four wiggles is a player's patience at one cell. Beyond that the
					# cell is not where the fight is happening: pick the path up at
					# the next one instead of drifting away from the route. Bounded,
					# counted, and printed.
					skipped = true
					stats["skipped"] = int(stats.get("skipped", 0)) + 1
					_note_skip(point, hero)
					break
				_report_wedge(hero, cell, before, escapes)
				escape_direction = _escape_direction(hero, before, point, escapes)
				escape_frames = 24
				stalled = 0
		if not skipped and hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			walked = false
			# One compact fact line: GitHub truncates annotations at 4 KB, so the
			# diagnosis must not depend on a long line surviving the tail.
			print("C08_WEDGE ", JSON.stringify({
				"planned": [point.x, point.y],
				"hero": [hero.global_position.x, hero.global_position.y],
				"cell": [_nav().cell_of(hero.global_position).x, _nav().cell_of(hero.global_position).y],
				"door_cell": [_door_cell().x, _door_cell().y], "door_open": _door_open(),
				"enemy": [enemy.global_position.x, enemy.global_position.y] if is_instance_valid(enemy) else [],
				"state": String(enemy.call(&"state_label")) if is_instance_valid(enemy) else "-",
				"escapes": escapes, "dead": bool(hero.get(&"dead"))}))
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


var _skips := 0


## Name a skipped cell, capped after eight. "It skipped" without the blocker, the
## cell and the door state is the kind of evidence that turns a diagnosis into a
## guess.
func _note_skip(point: Vector2, hero: CharacterBody2D) -> void:
	_skips += 1
	if _skips > 8:
		return
	var contacts: Array = []
	for index in range(hero.get_slide_collision_count()):
		var other: Variant = hero.get_slide_collision(index).get_collider()
		contacts.append("%s:%s" % [str(other.name) if other is Node else "?",
			other.get_class() if other is Object else "?"])
	print("C08_SKIP ", JSON.stringify({"planned": [point.x, point.y],
		"hero": [snappedf(hero.global_position.x, 0.1), snappedf(hero.global_position.y, 0.1)],
		"cell": [_nav().cell_of(hero.global_position).x, _nav().cell_of(hero.global_position).y],
		"door_open": _door_open(), "contacts": contacts, "n": _skips}))


## A body pressed against another body slides a few tenths of a pixel per frame.
## Reported separately from a terrain wedge so the two failures never look alike.
func _blocked_by_body(hero: CharacterBody2D) -> bool:
	for index in range(hero.get_slide_collision_count()):
		var other: Variant = hero.get_slide_collision(index).get_collider()
		if other is CharacterBody2D or other is RigidBody2D:
			return true
	return false


## Overrides the inherited wiggle: it keeps the clearance test but returns no
## direction when nothing is clear. The inherited fallback picks a cardinal
## anyway, which once walked the Hero seventeen cells away from his own route.
func _escape_direction(hero: CharacterBody2D, at: Vector2, point: Vector2, attempt: int) -> Vector2:
	var to_target := (point - at).normalized()
	var order: Array[Vector2] = []
	if absf(to_target.x) >= absf(to_target.y):
		order = [Vector2(0, -signf(to_target.x)), Vector2(0, signf(to_target.x)),
			Vector2(to_target.x, 0), Vector2(-to_target.x, 0)]
	else:
		order = [Vector2(-signf(to_target.y), 0), Vector2(signf(to_target.y), 0),
			Vector2(0, to_target.y), Vector2(0, -to_target.y)]
	for candidate: Vector2 in order:
		if candidate.length() < 0.5:
			continue
		var query := _shape_query(hero)
		var body := hero.get_node_or_null("BodyShape") as CollisionShape2D
		query.transform = Transform2D(0.0, hero.global_position + (body.position if body != null else Vector2.ZERO))
		query.motion = candidate * 10.0
		var fractions := hero.get_world_2d().direct_space_state.cast_motion(query)
		if fractions.size() >= 2 and fractions[0] > 0.5:
			return candidate
	return Vector2.ZERO


func _door_open() -> bool:
	var cell := _door_cell()
	if cell.x < 0:
		return false
	var id: String = _builder().entity_at_layer(cell, "object")
	if id.is_empty():
		return false
	var record: Dictionary = (_survival().call(&"structures") as Dictionary).get(id, {})
	return bool(record.get("door_open", false))


## Ordinary pointer on a placed structure, exactly like the proven home-journey
## test: the camera is settled first so the emitted screen position is real.
func _click_structure(point: Vector2) -> void:
	var camera := _world.get(&"camera") as Camera2D
	if camera == null:
		await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
		return
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * (camera.get_canvas_transform() * point))


## The paid room is sealed by a real door with a real collider, so a player walks
## to it and clicks it open. The C08 walk obeys that rule too: no route is planned
## through a closed door and no collider is disabled for the test.
func _open_door(hero: CharacterBody2D) -> bool:
	if _door_open():
		return true
	var cell := _door_cell()
	if cell.x < 0:
		return false
	await _walk_to_cell(hero, cell + Vector2i(0, 1))
	var build := _builder()
	var structure := build.structure_node(build.entity_at_layer(cell, "object")) as SurvivalStructure
	if structure == null:
		return false
	await _click_structure(structure.global_position + Vector2(8, 8))
	await physics_frame
	await physics_frame
	return _door_open()


## A real walkable route that passes physically close to the creature (so its own
## local sensing can reach the marks) without teleporting the Hero.
##
## The legs matter as much as the cells. A player who wants to leave a trail a
## creature can find does not walk back through it: he walks past, keeps going
## until the creature has lost him, comes home on a second lane, and shuts himself
## in. So the plan is: out past the creature, further out, north, home.
func _route_plan(hero: CharacterBody2D, nav: OverworldTraversability, home: Vector2) -> Dictionary:
	var encounter := _encounter()
	if encounter == null:
		return {"ok": false, "reason": "encounter_absent"}
	var site: Vector2 = encounter.global_position
	var site_cell := nav.cell_of(site)
	# The bed cell itself is occupied by the paid structure, so the walk home is
	# planned to a free interior cell, exactly like a player stepping inside.
	var home_cell := _stand_cell()
	var start := nav.cell_of(hero.global_position)
	# A stand cell beside the creature: the marks there are inside its local query.
	var near := _nearest_free_near(nav, site_cell + Vector2i(0, 2), 4)
	if near.x < 0:
		print("C08_ROUTE_FAIL reason=no_stand_cell_near_creature site=%s" % str(site_cell))
		return {"ok": false, "reason": "no_stand_cell_near_creature"}
	# Continue outward, away from the home, so the trail is a journey and not a
	# circle around the house.
	var outward_dir := Vector2(site - home).normalized()
	var far := _nearest_free_near(nav, nav.cell_of(site + outward_dir * 320.0), 5)
	if far.x < 0:
		far = near
	# Keep going: this is the leg that lets the creature fall far enough behind to
	# stop chasing, which is the only way a trail can ever be read by something
	# that is also looking at the player.
	var away := _nearest_free_near(nav, far + Vector2i(roundi(outward_dir.x * 6.0), roundi(outward_dir.y * 6.0)), 6)
	if away.x < 0:
		away = far
	# The second lane, well north of the creature's own ground.
	var break_cell := _nearest_free_near(nav, away + Vector2i(0, -12), 8)
	if break_cell.x < 0:
		break_cell = away
	var outbound := _join(_route(start, near, nav, hero), _route(near, far, nav, hero))
	if outbound.is_empty() and start != far:
		print("C08_ROUTE_FAIL reason=no_route_to_creature start=%s near=%s site=%s hero=%s"
			% [str(start), str(near), str(site_cell), str(hero.global_position)])
		return {"ok": false, "reason": "no_route_to_creature"}
	var away_leg := _route(far, away, nav, hero)
	var break_leg := _route(away, break_cell, nav, hero)
	var home_leg := _route(break_cell, home_cell, nav, hero)
	if home_leg.is_empty() and break_cell != home_cell:
		print("C08_ROUTE_FAIL reason=no_route_home far=%s home=%s site=%s" % [str(break_cell), str(home_cell), str(site_cell)])
		return {"ok": false, "reason": "no_route_home"}
	var legs: Array = [outbound, away_leg, break_leg, home_leg]
	var report := {"near": [near.x, near.y], "far": [far.x, far.y], "away": [away.x, away.y],
		"break": [break_cell.x, break_cell.y], "site": [site_cell.x, site_cell.y],
		"home": [home_cell.x, home_cell.y],
		"legs": [outbound.size(), away_leg.size(), break_leg.size(), home_leg.size()]}
	print("C08_ROUTE ", JSON.stringify(report))
	return {"ok": true, "legs": legs, "report": report, "far": far, "break": break_cell}


func _join(first: Array[Vector2i], second: Array[Vector2i]) -> Array[Vector2i]:
	var joined: Array[Vector2i] = []
	for cell: Vector2i in first:
		joined.append(cell)
	for cell: Vector2i in second:
		joined.append(cell)
	return joined


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
	await RenderingServer.frame_post_draw
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
		var seen := {}
		var total := 0.0
		var total_sq := 0.0
		var count := 0
		for y in range(0, image.get_height(), 12):
			for x in range(0, image.get_width(), 12):
				var pixel := image.get_pixel(x, y)
				seen[pixel.to_rgba32()] = true
				var luma := pixel.get_luminance()
				total += luma
				total_sq += luma * luma
				count += 1
		var mean := total / maxf(1.0, float(count))
		var sd := sqrt(maxf(0.0, total_sq / maxf(1.0, float(count)) - mean * mean))
		print("C08_FRAME %s %dx%d distinct=%d luma_sd=%.2f" % [name, image.get_width(), image.get_height(), seen.size(), sd])
		_expect(seen.size() >= 24, "the %s frame is not a flat colour (%d distinct)" % [name, seen.size()])
		# Color.get_luminance() is normalised 0..1, so contrast is measured on that
		# scale: 0.02 is 2% of full range and a black or flat frame cannot reach it.
		_expect(sd >= 0.02, "the %s frame has real contrast (sd %.3f of full range)" % [name, sd])


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
	var restored := int(snapshot.get("ledger_restored", -1))
	_expect(restored >= 1, "a still-valid trail survives quitting the game (%d marks restored)" % restored)
	_expect(int(snapshot.get("total_records", -1)) == restored,
		"the cold start holds exactly the restored marks, with no stale record")
	_expect(int(source.call(&"live_count")) == restored,
		"every restored mark is still live on the K8 clock; expired marks were dropped")
	var ledger: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("c08_traces", {})
	_expect(String(ledger.get("run_id", "")) == String(audit.get("run_id", "")),
		"the stored ledger is still the first process's run")
	_expect((ledger.get("marks", []) as Array).size() <= 512, "the stored ledger stays bounded")
	_expect(String(source.call(&"snapshot").get("ledger_error", "x")).is_empty(),
		"the evidence restore reported no error")
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
