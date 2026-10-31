extends "res://tests/survival_normal_input_gather_test.gd"
## A0 Round 12 (corrective) — ONE connected survival journey through ordinary input.
##
## The prefix is the proven gather -> craft -> place-bench -> weave-cloth journey
## inherited from `survival_normal_input_gather_test` (every step is key/mouse
## input on the production scene: no teleport, no direct gameplay call, no grant).
## This file continues it with the parts the product actually needs:
##
##   gather the furnace's own inputs -> craft `furnace_kit` through the GUI ->
##   place the furnace with the build pointer -> burn charcoal at it ->
##   queue `smelt_iron` (3 scrap + 1 charcoal fuel) -> prepare the paid job for
##   the time away (real KEY_P) -> leave the world with `depart_world()` ->
##   independent process 2 relaunch on the SAME save: the same run, the same
##   structures on the same cells, the same inventory, the offline settlement of
##   the prepared job exactly once, the ingot collected through the GUI, and a
##   recipe that only becomes orderable because that ingot now exists.
##
## Honesty notes:
##  * Process 1 uses a fixed save path on purpose so process 2 can load it; that
##    is the only difference from a normal single session.
##  * The test never calls `queue_recipe`/`collect`/`interact` on behalf of the
##    player: recipes and collection go through the visible panel and real clicks.
##  * `depart_world()` is the same function the window-close hook calls; the test
##    calls it through the world exactly as the closing application does.
##  * The run seed and the station are produced by ordinary play; nothing is
##    minted, teleported or granted.
# The audit must never share a path with the save: reading the save document as
# the audit is how a two-process gate silently "passes" check one and then fails
# everything it recorded.
const AUDIT := "user://tests/a0_connected_audit.json"
const FURNACE_SLOT := "6"   # SurvivalBuildSystem.BUILD_SLOTS index 5 -> build_slot_6

var _phase := "play"
## Why the last recipe row could not be revealed. The failure label carries it, so
## the annotation itself says what happened instead of only that it did.
var _scroll_reason := ""
var _keep := false
var _prefix_complete := false


func _console() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--verify-connected":
			_phase = "verify"
		elif arg == "--keep-connected":
			_keep = true
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/a0_connected_journey.json"
	# Process 1 must start from a genuinely fresh profile; process 2 (verify) must
	# find the profile process 1 left behind. Deleting here can never mask a
	# persistence failure, because the verify phase never deletes.
	if _phase == "play":
		for stale: String in [save_path, AUDIT]:
			if FileAccess.file_exists(stale):
				DirAccess.remove_absolute(ProjectSettings.globalize_path(stale))
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	if not DisplayServer.has_feature(DisplayServer.FEATURE_MOUSE):
		print("A0 CONNECTED NOT_TESTED - this environment exposes no mouse feature; build placement and the pointer half of the journey need a real window (CI Xvfb is the authority).")
		quit(0)
		return
	if _phase == "verify":
		await _boot()
		if _host != null:
			await _verify_body()
		_teardown()
		await process_frame
		_finish()
		return
	await _boot()
	if _host != null:
		await _body()
		if not _body_complete:
			_expect(false, "test body ran to completion")
	_teardown()
	await process_frame
	await process_frame
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if not _keep and FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("A0 CONNECTED SURVIVAL JOURNEY PASSED - %d checks (%s)" % [checks, _phase])
		quit(0)
	else:
		print("A0 CONNECTED SURVIVAL JOURNEY FAILED - %d/%d (%s)" % [failures.size(), checks, _phase])
		quit(1)


## The inherited journey, then the connected half. The prefix must genuinely have
## finished (bench placed, cloth collected) or the continuation is not attempted.
func _body() -> void:
	await _capture("connected_entry")
	await super._body()
	if _host != null and _host.get_child_count() > 0:
		_diag("after-prefix", _host.get_child(0))
	await _capture("connected_home")
	_prefix_complete = _body_complete and failures.is_empty()
	print("A0_CONNECTED prefix_complete=%s checks=%d failures=%d" % [str(_prefix_complete), checks, failures.size()])
	if not _prefix_complete:
		return
	_body_complete = false
	var ow := _host.get_child(0)
	await _continuation(ow)


func _continuation(ow: Node) -> void:
	var hero: CharacterBody2D = ow.get(&"player")
	var nav: OverworldTraversability = ow.get(&"traversability")
	var camera: Camera2D = ow.get(&"camera")
	var panel: Node = ow.get(&"economy_panel")
	var host: Node = ow.get(&"economy_session")
	var build: SurvivalBuildSystem = ow.get(&"survival_build")
	if hero == null or nav == null or camera == null or panel == null or host == null or build == null:
		_expect(false, "the world exposes every seat the connected journey needs")
		return

	# --- 1. the furnace's own inputs, from the world ------------------------
	# The furnace kit costs 8 stone + 3 scrap; the fuelled smelt costs 3 scrap and
	# 1 charcoal, and the charcoal itself costs 2 oak. Everything is walked to and
	# clicked by the player, in one trip, before any of it is spent.
	var stone := await _gather_until(ow, hero, nav, camera, "stone_outcrop", STONE, 8, 10)
	_expect(stone, "ordinary movement and clicks gather the furnace's 8 stone")
	var wood := await _gather_until(ow, hero, nav, camera, "oak_tree", WOOD, 2, 5)
	_expect(wood, "ordinary movement and clicks gather the charcoal's 2 oak")
	var scrap := await _gather_until(ow, hero, nav, camera, "scrap_pile", IRON, 6, 12)
	_expect(scrap, "ordinary movement and clicks gather the 6 iron scrap the kit and smelt need")
	if not stone or not wood or not scrap:
		_write_audit(ow, {})
		return
	var stone_before := _count(STONE)
	var scrap_before := _count(IRON)

	# --- 2. craft the furnace kit through the visible panel -----------------
	await _open_panel(panel)
	var kit_button := panel.find_child("Recipe_furnace_kit_hand", true, false) as Button
	_expect(kit_button != null, "the hand station visibly offers the furnace kit")
	if kit_button == null:
		_write_audit(ow, {})
		return
	var kit_row := await _scroll_recipe(panel, kit_button)
	_expect(kit_row != null, "ordinary wheel input reaches the furnace kit (%s)" % _scroll_reason)
	if kit_row == null:
		_write_audit(ow, {})
		return
	await _click_window(root.get_final_transform() * (kit_row.get_global_transform_with_canvas() * (kit_row.size * 0.5)))
	var furnace_job := _job_for("furnace_kit")
	_expect(not furnace_job.is_empty(), "the GUI queues the furnace kit (%s)" % furnace_job)
	if furnace_job.is_empty():
		_write_audit(ow, {})
		return
	_expect(_count(STONE) == stone_before - 8 and _count(IRON) == scrap_before - 3,
		"the furnace kit reserves exactly the gathered inputs (stone %d->%d, scrap %d->%d)"
			% [stone_before, _count(STONE), scrap_before, _count(IRON)])
	await _close_panel(panel)
	var kit_ready := await _wait_job(furnace_job, 30000)
	_expect(kit_ready, "active gameplay completes the furnace kit")
	if not kit_ready:
		_write_audit(ow, {})
		return
	await _open_panel(panel)
	var kit_collect := _collect_button("furnace kit")
	_expect(kit_collect != null, "the finished furnace kit exposes a Collect control")
	if kit_collect == null:
		_write_audit(ow, {})
		return
	var kit_scroll2 := _owning_scroll(kit_collect)
	_expect(await _scroll_to(kit_scroll2, kit_collect), "ordinary wheel input reaches the furnace kit collect control")
	await _click_window(root.get_final_transform() * (kit_collect.get_global_transform_with_canvas() * (kit_collect.size * 0.5)))
	_expect(_count("furnace_kit") == 1, "ordinary GUI click collects exactly one furnace kit")
	await _close_panel(panel)

	# --- 3. place the furnace with the build pointer ------------------------
	if _count("furnace_kit") != 1:
		_write_audit(ow, {})
		return
	await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_%s" % FURNACE_SLOT)
	_expect(build.active and build.selected_piece == "station_furnace", "ordinary build inputs select the furnace")
	var placed := await _place_piece(ow, hero, nav, camera, build, "station_furnace")
	_expect(placed.x >= 0 and _count("furnace_kit") == 0, "ordinary placement input pays for a physical furnace")
	if placed.x < 0:
		_write_audit(ow, {})
		return
	var furnace_id := _station_id("station_furnace")
	_expect(not furnace_id.is_empty(), "the placed furnace is a real station (%s)" % furnace_id)
	if furnace_id.is_empty():
		_write_audit(ow, {})
		return

	# --- 4. burn the fuel the smelting needs, at that furnace --------------
	# The furnace now occupies the cell it was built on, so the player cannot stand
	# on it. They walk up to it with ordinary directional input until the station is
	# within arm's length, which is what a player does after placing something.
	var reached := await _approach_station(hero, nav, _station_point(furnace_id, placed), "the built furnace")
	_expect(reached, "the player can stand at the furnace it just built")
	if not reached:
		_write_audit(ow, {})
		return
	var nearby: Array = host.call(&"nearby_stations")
	var furnace_visible := false
	for entry: Variant in nearby:
		if String((entry as Dictionary).get("station_id", "")) == furnace_id:
			furnace_visible = true
	_expect(furnace_visible, "the panel counts the built furnace as a nearby station (%d listed)" % nearby.size())
	await _open_panel(panel)
	var charcoal_button := _recipe_button(panel, "burn_charcoal", furnace_id)
	if charcoal_button == null:
		# The panel rebuilds its station list as the player moves; give it a frame
		# of real time before calling the recipe missing.
		await create_timer(1.0).timeout
		charcoal_button = _recipe_button(panel, "burn_charcoal", furnace_id)
	if charcoal_button == null:
		_dump_panel(panel, host, furnace_id)
	_expect(charcoal_button != null, "the physical furnace offers its own charcoal recipe")
	if charcoal_button == null:
		_write_audit(ow, {})
		return
	var charcoal_row := await _scroll_recipe(panel, charcoal_button)
	_expect(charcoal_row != null, "ordinary wheel input reaches the charcoal recipe (%s)" % _scroll_reason)
	if charcoal_row == null:
		_write_audit(ow, {})
		return
	await _click_window(root.get_final_transform() * (charcoal_row.get_global_transform_with_canvas() * (charcoal_row.size * 0.5)))
	var charcoal_job := _job_for("burn_charcoal")
	_expect(not charcoal_job.is_empty(), "the GUI queues charcoal at the furnace (%s)" % charcoal_job)
	await _close_panel(panel)
	if charcoal_job.is_empty() or not await _wait_job(charcoal_job, 40000):
		_expect(false, "active gameplay completes the charcoal burn")
		_write_audit(ow, {})
		return
	await _open_panel(panel)
	var charcoal_collect := _collect_button("burn charcoal")
	_expect(charcoal_collect != null,
		"the burned charcoal exposes a Collect control (%s)" % _job_rows(panel))
	if charcoal_collect == null:
		_write_audit(ow, {})
		return
	_expect(await _scroll_to(_owning_scroll(charcoal_collect), charcoal_collect), "ordinary wheel input reaches the charcoal control")
	await _click_window(root.get_final_transform() * (charcoal_collect.get_global_transform_with_canvas() * (charcoal_collect.size * 0.5)))
	_expect(_count("charcoal") == 2, "ordinary GUI click collects two charcoal")
	await _close_panel(panel)

	# --- 5. queue the fuelled smelt, then prepare it for the time away -----
	var scrap_for_smelt := _count(IRON)
	var charcoal_for_smelt := _count("charcoal")
	if charcoal_for_smelt < 1 or scrap_for_smelt < 3:
		_expect(false, "the smelt has its fuelled inputs (scrap %d, charcoal %d)" % [scrap_for_smelt, charcoal_for_smelt])
		_write_audit(ow, {})
		return
	await _open_panel(panel)
	var smelt_button := _recipe_button(panel, "smelt_iron", furnace_id)
	_expect(smelt_button != null, "the furnace offers the fuelled smelt recipe")
	if smelt_button == null:
		_write_audit(ow, {})
		return
	var smelt_row := await _scroll_recipe(panel, smelt_button)
	_expect(smelt_row != null, "ordinary wheel input reaches the smelt recipe (%s)" % _scroll_reason)
	if smelt_row == null:
		_write_audit(ow, {})
		return
	await _click_window(root.get_final_transform() * (smelt_row.get_global_transform_with_canvas() * (smelt_row.size * 0.5)))
	var smelt_job := _job_for("smelt_iron")
	_expect(not smelt_job.is_empty(), "the GUI queues the fuelled smelt (%s)" % smelt_job)
	await _close_panel(panel)
	if smelt_job.is_empty():
		_write_audit(ow, {})
		return
	_expect(_count(IRON) == scrap_for_smelt - 3 and _count("charcoal") == charcoal_for_smelt - 1,
		"the smelt reserves 3 scrap and 1 charcoal fuel (scrap %d->%d, charcoal %d->%d)"
			% [scrap_for_smelt, _count(IRON), charcoal_for_smelt, _count("charcoal")])
	var prepared := await _press_prepare_work()
	_expect(prepared, "the ordinary prepare-work key marks the paid job for the time away")
	var state: Dictionary = host.call(&"prepared_work")
	var prepared_jobs: Array = state.get("jobs", [])
	_expect(prepared_jobs.size() == 1 and String((prepared_jobs[0] as Dictionary).get("job_id", "")) == smelt_job,
		"exactly the fuelled smelt is prepared (%s)" % str(prepared_jobs))
	await _capture("connected_prepare")
	var departure: Dictionary = ow.call(&"depart_world")
	print("A0_CONNECTED_DEPARTURE ", JSON.stringify(departure))
	_diag("after-departure", ow)
	_expect(bool(departure.get("ok", false)), "the world records a real departure (%s)" % String(departure.get("reason", "")))
	_expect(bool(departure.get("persisted", false)), "the departure is durable before the process can die")
	_write_audit(ow, {
		"furnace_id": furnace_id,
		"furnace_cell": [placed.x, placed.y],
		"smelt_job": smelt_job,
		"prepared": prepared_jobs.size(),
		"departure": departure,
	})
	_keep = true
	_body_complete = true


# ---------------------------------------------------------------------------
# process 2: the same save, an independent process, and the offline payment
# ---------------------------------------------------------------------------
func _verify_body() -> void:
	var audit := _read_audit()
	_expect(not audit.is_empty(), "the second process reads the first process's audit")
	if audit.is_empty():
		return
	var ow := _host.get_child(0)
	_diag("relaunch", ow)
	await _capture("connected_return")
	var hero: CharacterBody2D = ow.get(&"player")
	var panel: Node = ow.get(&"economy_panel")
	var host: Node = ow.get(&"economy_session")
	var composition: Node = ow.get(&"economy_composition")
	_expect(hero != null and panel != null and host != null and composition != null, "the relaunched world exposes its seats")
	if hero == null or panel == null or host == null or composition == null:
		return
	var lifecycle: Node = root.get_node_or_null("RunLifecycle")
	var run: Dictionary = lifecycle.call(&"phase") if lifecycle != null else {}
	print("A0_CONNECTED_RUNID audit=%s lifecycle=%s keys=%s" % [String(audit.get("run_id", "")),
		String(run.get("run_id", "")), str(run.keys())])
	_expect(String(run.get("run_id", "")) == String(audit.get("run_id", "")),
		"the independent process resumed the same run (audit %s, relaunch %s)" % [
			String(audit.get("run_id", "")), String(run.get("run_id", ""))])
	var structures: Dictionary = _survival().call(&"structures")
	var furnace_id := String(audit.get("furnace_id", ""))
	if furnace_id.is_empty():
		_expect(false, "process 1 finished the paid cycle, so there is a furnace to resume (audit has no furnace_id)")
		return
	_expect(structures.has(furnace_id), "the paid furnace survived the relaunch as a physical structure")
	var audit_cell: Array = audit.get("furnace_cell", [])
	if structures.has(furnace_id) and audit_cell.size() == 2:
		var record: Dictionary = structures[furnace_id]
		var cell: Array = record.get("cell", [])
		_expect(cell.size() == 2 and int(cell[0]) == int(audit_cell[0]) and int(cell[1]) == int(audit_cell[1]),
			"the furnace is on the exact cell it was built on (%s vs %s)" % [str(cell), str(audit_cell)])
	_expect(_count("binding_cloth") == int(audit.get("cloth", -1)), "the woven cloth survived the relaunch exactly")
	var settle: Dictionary = composition.get(&"_last_settle")
	print("A0_CONNECTED_OFFLINE_SETTLE ", JSON.stringify(settle))
	var smelt_job := String(audit.get("smelt_job", ""))
	var job: Dictionary = (host.call(&"jobs") as Dictionary).get(smelt_job, {})
	_expect(String(job.get("status", "")) == "ready",
		"the prepared fuelled smelt completed while the application was closed (%s)" % String(job.get("status", "")))
	if String(job.get("status", "")) != "ready":
		return
	# Collecting is the player's act, through the visible panel.
	await _open_panel(panel)
	var collect := _collect_button("smelt iron")
	_expect(collect != null, "the settled smelt exposes a Collect control")
	if collect == null:
		return
	_expect(await _scroll_to(_owning_scroll(collect), collect), "ordinary wheel input reaches the settled output")
	var receipts_before := _collect_receipt_count()
	await _click_window(root.get_final_transform() * (collect.get_global_transform_with_canvas() * (collect.size * 0.5)))
	_expect(_count("iron_ingot") == 1, "the player collects exactly one smelted iron ingot")
	_expect(_collect_receipt_count() == receipts_before + 1, "the collection is one committed receipt")
	await _close_panel(panel)
	# A second settlement must not pay again.
	var offline: Node = composition.get(&"_offline") as Node
	var again: Dictionary = offline.call(&"settle", int(Time.get_unix_time_from_system()))
	print("A0_CONNECTED_RESETTLE ", JSON.stringify(again))
	_expect(not bool(again.get("ok", false)) or int((again.get("operations", 0) as int)) == 0 or bool(again.get("duplicate", false)),
		"a second settlement of the same interval pays nothing (%s)" % String(again.get("reason", "")))
	_expect(_count("iron_ingot") == 1 and _collect_receipt_count() == receipts_before + 1,
		"no duplicate ingot and no duplicate receipt after re-settling")
	# The ingot is a new reason to play: a recipe that needs it becomes orderable.
	await _open_panel(panel)
	var parts := panel.find_child("Recipe_make_parts_%s" % String(audit.get("furnace_id", "")), true, false) as Button
	var hand_parts := panel.find_child("Recipe_make_parts_hand", true, false) as Button
	_expect(parts != null or hand_parts != null,
		"the smelted ingot makes an ingot-dependent recipe visible in the real panel")
	await _close_panel(panel)
	_body_complete = true


# ---------------------------------------------------------------------------
# durable-state diagnostics: what the process actually left on disk
# ---------------------------------------------------------------------------
## A two-process gate that cannot say *what* the first process wrote is a gate
## nobody can debug, so every phase prints the real save path, size, digest and
## the durable run record it reads back from the one SaveService.
func _diag(tag: String, ow: Node) -> void:
	var save := root.get_node_or_null("SaveService")
	var path := "absent"
	var exists := false
	var size := 0
	var digest := "-"
	var run: Dictionary = {}
	var phase: Dictionary = {}
	if save != null:
		path = String(save.get(&"_save_path"))
		exists = FileAccess.file_exists(path)
		if exists:
			var bytes := FileAccess.get_file_as_bytes(path)
			size = bytes.size()
			var hash := HashingContext.new()
			hash.start(HashingContext.HASH_SHA256)
			hash.update(bytes)
			digest = hash.finish().hex_encode().substr(0, 16)
		var snapshot: Dictionary = save.call(&"get_snapshot")
		var profile: Dictionary = snapshot.get("profile", {}) if snapshot.get("profile") is Dictionary else {}
		var raw: Variant = profile.get("run", {})
		run = raw if raw is Dictionary else {}
	var lifecycle := root.get_node_or_null("RunLifecycle")
	if lifecycle != null:
		phase = lifecycle.call(&"phase")
	print("A0_CONNECTED_DIAG %s path=%s exists=%s size=%d sha=%s run_id=%s epoch=%s state=%s phase_state=%s ltree=%s" % [
		tag, path, str(exists), size, digest,
		String(run.get("run_id", "")), str(run.get("run_epoch", "")), String(run.get("state", "")),
		String(phase.get("state", "")), str(lifecycle != null)])


# ---------------------------------------------------------------------------
# small helpers, all expressed through ordinary input
# ---------------------------------------------------------------------------
## Gathering is a real walk to a real node, so a node whose approach is blocked
## must not end the journey: the next nearest node of the same kind is tried, and
## only running out of nodes reports a miss. Nothing is granted or teleported.
func _gather_until(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability, camera: Camera2D,
		kind: String, item_id: String, target: int, max_swings: int) -> bool:
	var tried: Array = []
	for attempt: int in range(4):
		if _count(item_id) >= target:
			return true
		var node := await _walk_to_kind(ow, hero, nav, kind, tried)
		if node == null or bool(hero.get(&"dead")):
			break
		camera.reset_smoothing()
		camera.force_update_scroll()
		await process_frame
		var before := _count(item_id)
		for swing: int in range(max_swings):
			if _count(item_id) >= target:
				break
			if not node.can_interact(hero):
				break
			await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
			await create_timer(0.25).timeout
		if _count(item_id) == before:
			# This node gave nothing: it is spent or its swings miss. Remember it
			# and walk to the next one instead of retrying the same dead end.
			tried.append(node.node_id)
	print("A0_CONNECTED_GATHER kind=%s want=%d have=%d at=%s tried=%d" % [
		kind, target, _count(item_id), str(hero.global_position), tried.size()])
	return _count(item_id) >= target


func _job_for(target: String) -> String:
	var host: Node = _host.get_child(0).get(&"economy_session")
	var jobs: Dictionary = host.call(&"jobs")
	for key: Variant in jobs.keys():
		var job: Dictionary = jobs[key]
		if String(job.get("target", "")) == target and String(job.get("status", "")) in ["queued", "running"]:
			return String(key)
	return ""


func _wait_job(job_id: String, timeout_ms: int) -> bool:
	var host: Node = _host.get_child(0).get(&"economy_session")
	var deadline := Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		var job: Dictionary = (host.call(&"jobs") as Dictionary).get(job_id, {})
		if String(job.get("status", "")) == "ready":
			return true
		await process_frame
	return false


func _station_id(piece: String) -> String:
	for key: Variant in (_survival().call(&"structures") as Dictionary).keys():
		var record: Dictionary = (_survival().call(&"structures") as Dictionary)[key]
		if String(record.get("piece", "")) == piece:
			return String(key)
	return ""


## Every job row the panel is currently showing, as "label | action" — so a missing
## control is reported as the panel's own state, not as a guess about the session.
func _job_rows(panel: Node) -> String:
	var rows: Array[String] = []
	for value: Node in panel.find_children("*", "Label", true, false):
		var label := value as Label
		if label == null or not label.text.contains(": "):
			continue
		var action := ""
		var row := label.get_parent()
		if row != null:
			for sibling: Node in row.get_children():
				var button := sibling as Button
				if button != null and action == "":
					action = button.text
		rows.append("%s | %s" % [label.text.replace("\n", " "), action])
	if rows.is_empty():
		return "no job rows open=%s" % str(bool(panel.call(&"is_open")))
	return "; ".join(rows)


func _collect_button(label_prefix: String) -> Button:
	var panel: Node = _host.get_child(0).get(&"economy_panel")
	for value: Node in panel.find_children("*", "Button", true, false):
		var candidate := value as Button
		if candidate == null or candidate.text.to_lower() != "collect":
			continue
		var label := _row_label(candidate.get_parent())
		if label != null and label.text.to_lower().begins_with(label_prefix.to_lower()):
			return candidate
	return null


func _place_piece(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability, camera: Camera2D,
		build: SurvivalBuildSystem, piece: String) -> Vector2i:
	var centre := nav.cell_of(hero.global_position)
	var placement := Vector2i(-1, -1)
	for dy: int in range(-3, 4):
		if placement.x >= 0:
			break
		for dx: int in range(-3, 4):
			var candidate := centre + Vector2i(dx, dy)
			if build.validate_cell(candidate).is_empty():
				placement = candidate
				break
	if placement.x < 0:
		return placement
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var world_point := Vector2(placement.x * 16 + 8, placement.y * 16 + 8)
	var window_point := root.get_final_transform() * (camera.get_canvas_transform() * world_point)
	Input.warp_mouse(window_point)
	await process_frame
	await process_frame
	await _click_window(window_point)
	await process_frame
	return placement


## A player presses C until the panel they want is on screen. Asserting the toggle
## did exactly the right thing every time is not a player behaviour and it hid the
## panel behind a second press; open() is idempotent instead.
func _close_panel(panel: Node) -> bool:
	for _i: int in range(3):
		if not bool(panel.call(&"is_open")):
			return true
		await _tap_action(&"economy_toggle")
		await process_frame
	return not bool(panel.call(&"is_open"))


## Bring a row into view with ordinary wheel input. If the list was already open
## with stale layout, a player closes and reopens the panel; the row is looked up
## again in the rebuilt list rather than trusting a stale node.
## Returns the live row: the panel rebuilds its list when it reopens, which frees
## the Button the caller handed in, so clicking the original node is a bug — a real
## player clicks what is on screen.
func _scroll_recipe(panel: Node, button: Button) -> Button:
	_scroll_reason = ""
	if button == null:
		_scroll_reason = "row_absent"
		return null
	var row_name := String(button.name)
	# Two frames: the panel rebuilds its list on the toggle's frame and only then
	# does the wrapped layout know how tall each row is.
	await process_frame
	await process_frame
	var is_open := bool(panel.call(&"is_open"))
	var scroll := _owning_scroll(button)
	_scroll_reason = "open=%s scroll=%s" % [str(is_open), str(scroll != null)]
	if scroll != null and await _wheel_until_visible(scroll, button):
		_scroll_reason = "revealed"
		return button
	# Reopening rebuilds the list; the row must be looked up again by name, because
	# the old node is gone once the panel is rebuilt.
	await _close_panel(panel)
	await _open_panel(panel)
	await process_frame
	await process_frame
	var rebuilt_button := panel.find_child(row_name, true, false) as Button
	var rebuilt := _owning_scroll(rebuilt_button)
	_scroll_reason += " | rebuilt=%s scroll=%s" % [str(rebuilt_button != null), str(rebuilt != null)]
	if rebuilt_button != null and rebuilt != null and await _wheel_until_visible(rebuilt, rebuilt_button):
		_scroll_reason += " | revealed_after_reopen"
		return rebuilt_button
	var rows: Array[String] = []
	for value: Node in panel.find_children("Recipe_*", "Button", true, false):
		rows.append(String(value.name))
	_scroll_reason += " | rows=%d %s" % [rows.size(), str(rows.slice(0, 12))]
	return null


## Wheel a row into view. A long list needs more than a fixed handful of clicks, so
## the loop keeps wheeling in the row's direction until the row is inside the
## viewport, the list stops moving, or the patience runs out.
func _wheel_until_visible(scroll: ScrollContainer, control: Control) -> bool:
	var previous := -1.0
	var still := 0
	var spot := 0
	for _i: int in range(400):
		if scroll.get_global_rect().has_point(control.get_global_rect().get_center()):
			return true
		var rect := scroll.get_global_rect()
		# The player wheels wherever the pointer happens to be: over the list, or
		# over the scroll bar on its right edge. If one spot does not move the list,
		# the next try is the other, exactly as a player would move the mouse.
		var local_point := rect.size * 0.5 if spot == 0 else Vector2(rect.size.x - 4.0, rect.size.y * 0.5)
		var target_y := control.get_global_rect().get_center().y
		var window_point: Vector2 = root.get_final_transform() * (scroll.get_global_transform_with_canvas() * local_point)
		# Move the pointer onto the list first. A wheel event with no pointer over the
		# control is not a player action and this engine does not route it there.
		await _move_pointer(window_point)
		# A fresh event object per notch: a re-parsed event is dropped by the input
		# layer, which is why a re-used wheel object never moved a list.
		var wheel := InputEventMouseButton.new()
		wheel.position = window_point
		wheel.button_index = MOUSE_BUTTON_WHEEL_UP if target_y < rect.get_center().y else MOUSE_BUTTON_WHEEL_DOWN
		wheel.pressed = true
		Input.parse_input_event(wheel)
		await process_frame
		var offset := float(scroll.scroll_vertical)
		still = still + 1 if is_equal_approx(offset, previous) else 0
		previous = offset
		if still > 4:
			spot = 1 - spot
			still = 0
		if _i > 12 and spot == 1 and still == 0 and offset <= 0.0:
			break
	print("A0_CONNECTED_SCROLL_GEOM scroll=%s target=%s scroll_vertical=%d max=%.1f bar=%s visible=%s" % [
		str(scroll.get_global_rect()), str(control.get_global_rect()), scroll.scroll_vertical,
		scroll.get_v_scroll_bar().max_value, str(scroll.get_v_scroll_bar().visible),
		str(control.is_visible_in_tree())])
	return false


## Ordinary mouse motion: the pointer travels to a point and settles there.
func _move_pointer(point: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = point
	motion.global_position = point
	Input.parse_input_event(motion)
	await process_frame


func _open_panel(panel: Node) -> bool:
	if panel == null:
		return false
	for _i: int in range(3):
		if bool(panel.call(&"is_open")):
			return true
		await _tap_action(&"economy_toggle")
		await process_frame
	return bool(panel.call(&"is_open"))


## The row a player actually sees for this recipe at this station. The panel names
## rows after the station it resolved, which is not required to be the same string
## the structure record is keyed by, so the exact name is tried first and the
## recipe's own rows second; the caller still proves the furnace is a real station.
func _recipe_button(panel: Node, recipe_id: String, station_id: String) -> Button:
	var exact := panel.find_child("Recipe_%s_%s" % [recipe_id, station_id], true, false) as Button
	if exact != null:
		return exact
	# A wildcard may match a row that belongs to a different station, so it is only
	# trusted when exactly one row carries this recipe id.
	var matches: Array = panel.find_children("Recipe_%s_*" % recipe_id, "Button", true, false)
	if matches.size() == 1:
		return matches[0] as Button
	if matches.size() > 1:
		var names: Array[String] = []
		for value: Node in matches:
			names.append(String(value.name))
		print("A0_CONNECTED_RECIPE_AMBIGUOUS recipe=%s rows=%s" % [recipe_id, str(names)])
	return null


## When a recipe is not where the panel says it should be, print what the panel
## and the session actually contain. A missing button must be a fact, not a guess.
func _dump_panel(panel: Node, host: Node, station_id: String) -> void:
	var rows: Array[String] = []
	for value: Node in panel.find_children("*", "Button", true, false):
		rows.append(String(value.name))
	var recipes: Array[String] = []
	for entry: Variant in (host.call(&"available_recipes", station_id) as Array):
		recipes.append(String((entry as Dictionary).get("id", "")))
	var stations: Array[String] = []
	for entry: Variant in (host.call(&"nearby_stations") as Array):
		var station: Dictionary = entry
		stations.append("%s:%s:t%d" % [String(station.get("station_id", "")),
			String(station.get("kind", "")), int(station.get("tier", 0))])
	print("A0_CONNECTED_PANEL open=%s station=%s anchor_ok=%s recipes=%s stations=%s buttons=%s" % [
		str(bool(panel.call(&"is_open"))), station_id,
		str(host.call(&"station_in_reach", station_id, (panel.get_parent() as Node).get(&"survival_build").call(&"structure_node", station_id))),
		str(recipes), str(stations), str(rows.slice(0, 24))])


## Walk toward a physical station until it is within the interaction reach, using
## only directional input. No teleport and no pathing shortcut: if the body cannot
## get close enough, the step fails and says how far away it stopped.
func _approach_station(hero: CharacterBody2D, nav: OverworldTraversability, point: Vector2, label: String) -> bool:
	var deadline := Time.get_ticks_msec() + 9000
	var stalled := 0
	# A3's panel lists a station within 64 px of the *centre of its footprint*
	# (origin + 16,16), while A0's interaction reach is 44 px from the origin cell.
	# For a 2x2 furnace those two windows disagree, so a player standing at a legal
	# interaction distance can be outside the panel's station window. Walk up close
	# enough that both agree, which is also what a player does at a furnace.
	# One policy: SurvivalStationReach measures from the centre of the station's
	# footprint and the player must be inside SurvivalStructure.REACH of it. Walk
	# until comfortably inside that radius, not to an invented tighter number.
	var want := SurvivalStationReach.RADIUS - 8.0
	while point.distance_to(hero.global_position) > want and Time.get_ticks_msec() < deadline:
		var before := hero.global_position
		_set_direction(point - before)
		await physics_frame
		stalled = stalled + 1 if hero.global_position.distance_to(before) < 0.2 else 0
		if stalled > 40:
			break
	_set_direction(Vector2.ZERO)
	var ok := point.distance_to(hero.global_position) <= SurvivalStationReach.RADIUS
	if not ok:
		print("A0_CONNECTED_APPROACH %s cell=%s hero=%s distance=%.2f radius=%.1f" % [
			label, str(nav.cell_of(point)), str(hero.global_position),
			point.distance_to(hero.global_position), SurvivalStationReach.RADIUS])
	return ok


## Where a station physically stands, from the authoritative structure record.
## The station's interaction anchor, measured exactly the way the product measures
## it: the centre of the footprint of the piece that actually stands there.
func _station_point(station_id: String, fallback_cell: Vector2i) -> Vector2:
	var structures: Dictionary = _survival().call(&"structures")
	var record: Dictionary = structures.get(station_id, {}) if structures.has(station_id) else {}
	var definition: Dictionary = _survival().call(&"piece_definition", String(record.get("piece", "")))
	var cell: Array = record.get("cell", [])
	var origin := Vector2(float(fallback_cell.x) * 16.0, float(fallback_cell.y) * 16.0)
	if cell.size() == 2:
		origin = Vector2(float(cell[0]) * 16.0, float(cell[1]) * 16.0)
	return origin + SurvivalStationReach.footprint_pixels(definition) * 0.5


func _walk_to_cell(hero: CharacterBody2D, nav: OverworldTraversability, cell: Vector2i, label: String) -> bool:
	var start := nav.cell_of(hero.global_position)
	var path := _route(start, cell, nav, hero)
	var ok := start == cell or (not path.is_empty() and await _walk_path(hero, path))
	var deadline := Time.get_ticks_msec() + 3000
	var target := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
	while ok and nav.cell_of(hero.global_position) != cell and Time.get_ticks_msec() < deadline:
		_set_direction(target - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	ok = ok and nav.cell_of(hero.global_position) == cell
	_expect(ok, label)
	return ok


## A real KEY_P press through the engine's input pipeline, not a method call.
func _press_prepare_work() -> bool:
	var press := InputEventKey.new()
	press.physical_keycode = KEY_P
	press.keycode = KEY_P
	press.pressed = true
	Input.parse_input_event(press)
	await process_frame
	await physics_frame
	var release := InputEventKey.new()
	release.physical_keycode = KEY_P
	release.keycode = KEY_P
	release.pressed = false
	Input.parse_input_event(release)
	await process_frame
	var host: Node = _host.get_child(0).get(&"economy_session")
	var state: Dictionary = host.call(&"prepared_work")
	return (state.get("jobs", []) as Array).size() > 0


func _write_audit(ow: Node, extra: Dictionary) -> void:
	var lifecycle: Node = root.get_node_or_null("RunLifecycle")
	var run: Dictionary = lifecycle.call(&"phase") if lifecycle != null else {}
	var structures := {}
	for key: Variant in (_survival().call(&"structures") as Dictionary).keys():
		var record: Dictionary = (_survival().call(&"structures") as Dictionary)[key]
		structures[String(key)] = {"piece": String(record.get("piece", "")), "cell": record.get("cell", [])}
	var audit := {
		"schema": "soh.a0.connected_journey.v1",
		"run_id": String(run.get("run_id", "")),
		"structures": structures,
		"cloth": _count("binding_cloth"),
		"charcoal": _count("charcoal"),
		"stone": _count(STONE),
		"scrap": _count(IRON),
		"ingot": _count("iron_ingot"),
		"receipts": _collect_receipt_count(),
		"extra": extra,
	}
	# Flatten the continuation's own fields: a reader should not have to know
	# which half of the journey a field came from.
	for key: Variant in extra.keys():
		audit[String(key)] = extra[key]
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _read_audit() -> Dictionary:
	if not FileAccess.file_exists(AUDIT):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(AUDIT))
	return parsed as Dictionary if parsed is Dictionary else {}


## A real pixel of the running game, at the resolution the run was started with.
## Headless runs cannot produce pixels; the capture then reports itself absent
## instead of writing a bogus image.
func _capture(stage: String) -> void:
	var image := root.get_texture().get_image()
	if image == null or image.is_empty():
		print("A0_CAPTURE_ABSENT %s (no renderer in this run)" % stage)
		return
	var path := "user://tests/capture_%s_%dx%d.png" % [stage, image.get_width(), image.get_height()]
	var error := image.save_png(path)
	print("A0_CAPTURE %s %s error=%d" % [stage, ProjectSettings.globalize_path(path), error])
