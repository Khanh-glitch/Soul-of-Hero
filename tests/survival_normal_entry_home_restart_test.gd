extends "res://tests/survival_normal_home_journey_test.gd"
## Normal profile choice and Home-map pointer -> real overworld -> inherited
## real-input home journey. The optional second process reads the same disk
## profile and compares complete custody, structures, receipts and knowledge.
## No actor position assignment, inventory grants, direct interactions or mocked
## time. UI/physics inputs are injected; this is not a human playtest.
const SaveDiff = preload("res://tests/fixtures/a0_save_diff.gd")
## The audit is JSON, so every integer comes back as a float. Restore the
## declared integer slots with the exact decoder SaveService uses before any
## strict comparison; comparing raw JSON would report type noise, not custody.
const Integers = preload("res://game/survival/economy/a0_world_slice_v5_migration.gd")
const ENTRY_SAVE := "user://tests/entry_home_restart.json"
const ENTRY_AUDIT := "user://tests/entry_home_restart_audit.json"
var _app: Node

func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = ENTRY_SAVE
	var restart := OS.get_cmdline_user_args().has("--verify-separate-process")
	var loaded := bool(_save().call(&"configure_storage", save_path, true))
	_expect(loaded, "isolated authoritative disk profile loads")
	if not loaded:
		_finish()
		return
	if restart:
		await _verify_restart()
	else:
		await _run_from_menu()
	if is_instance_valid(_host):
		_host.queue_free()
		_host = null
	if is_instance_valid(_app):
		_app.queue_free()
	await process_frame
	await process_frame
	_finish()

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	print("NORMAL ENTRY HOME RESTART %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _wait_route(app: Node, route: StringName, timeout_ms: int) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		if StringName(app.call(&"get_current_route")) == route:
			return true
		await process_frame
	return false

# Specialized production journey extensions run after the paid home, before
# taking the independent-process baseline. Default test has no extension.
func _after_home_continuation() -> void:
	pass

func _run_from_menu() -> void:
	var packed := load("res://game/app/app_root.tscn") as PackedScene
	_expect(packed != null, "production application shell loads")
	if packed == null:
		return
	_app = packed.instantiate()
	root.add_child(_app)
	var title_open := await _wait_route(_app, &"title", 30000)
	_expect(title_open, "normal boot reaches the profile-choice screen")
	if not title_open:
		return
	await process_frame
	var new_game := _app.find_child("NewGameButton", true, false) as Button
	_expect(new_game != null and new_game.is_visible_in_tree() and not new_game.disabled, "new profile button is visible and enabled")
	if new_game == null or not new_game.is_visible_in_tree() or new_game.disabled:
		return
	await _click_window(root.get_final_transform() * new_game.get_global_rect().get_center())
	var home_open := await _wait_route(_app, &"home", 30000)
	_expect(home_open, "pointer chooses New Game and opens the actual Home map")
	if not home_open:
		return
	await process_frame
	await physics_frame
	var home := (_app.get_node("RouteHost") as Node).get_child(0)
	var hero := home.get(&"player") as CharacterBody2D
	var destinations: Dictionary = home.get(&"_destinations")
	var gatekeeper := destinations.get(&"campaign") as Node2D
	_expect(hero != null and gatekeeper != null, "Home map exposes its actual player and campaign destination")
	if hero == null or gatekeeper == null:
		return
	var before := hero.position
	var gate_screen := root.get_final_transform() * gatekeeper.get_global_transform_with_canvas().origin
	await _click_window(gate_screen)
	var deadline := Time.get_ticks_msec() + 30000
	while Time.get_ticks_msec() < deadline and StringName(home.call(&"get_current_function")) != &"campaign":
		await process_frame
	var campaign_open := StringName(home.call(&"get_current_function")) == &"campaign"
	_expect(campaign_open and hero.position.distance_to(before) > 1.0, "pointer walks the actual Home player to the campaign destination")
	if not campaign_open:
		return
	var entry := home.find_child("EnterOverworldButton", true, false) as Button
	_expect(entry != null and entry.is_visible_in_tree() and not entry.disabled, "overworld entry is visible in the real campaign interface")
	if entry == null or not entry.is_visible_in_tree() or entry.disabled:
		return
	var scroll := _owning_scroll(entry)
	if scroll != null and not scroll.get_global_rect().has_point(entry.get_global_rect().get_center()):
		_expect(await _scroll_to(scroll, entry), "ordinary wheel input reveals overworld entry")
	await _click_window(root.get_final_transform() * entry.get_global_rect().get_center())
	var overworld_open := await _wait_route(_app, &"overworld", 30000)
	_expect(overworld_open, "pointer enters the actual survival overworld through AppFlow")
	if not overworld_open:
		return
	_host = _app.get_node("RouteHost")
	var ow := _host.get_child(0)
	deadline = Time.get_ticks_msec() + 90000
	while Time.get_ticks_msec() < deadline and not bool(ow.call(&"is_world_ready")):
		await process_frame
	var ready := bool(ow.call(&"is_world_ready"))
	_expect(ready and ow.get(&"player") != null and ow.get(&"survival_build") != null, "normal entry builds one production Hero and survival world")
	if not ready:
		return
	var world_hero := ow.get(&"player") as CharacterBody2D
	_expect(world_hero.has_method(&"get_facing_direction"), "production Hero exposes stable facing to world interaction owners")
	if world_hero.has_method(&"get_facing_direction"):
		Input.action_press(&"move_left")
		for _frame in range(5):
			await physics_frame
		Input.action_release(&"move_left")
		for _frame in range(5):
			await physics_frame
		var retained_left: Variant = world_hero.call(&"get_facing_direction")
		_expect(retained_left is Vector2 and (retained_left as Vector2).dot(Vector2.LEFT) > 0.99, "actual movement leaves an accurate stationary left-facing direction")
		Input.action_press(&"move_down")
		for _frame in range(5):
			await physics_frame
		Input.action_release(&"move_down")
		for _frame in range(5):
			await physics_frame
		var retained_down: Variant = world_hero.call(&"get_facing_direction")
		_expect(retained_down is Vector2 and (retained_down as Vector2).dot(Vector2.DOWN) > 0.99, "actual movement changes stationary facing instead of using an UP fallback")
	# Existing test makes the full paid home, craft, storage and same-process
	# reload journey using normal injected input. Its reconstruction intentionally
	# destroys the route host and boots a fresh test-hosted world; the independent
	# process below separately checks durable disk state.
	await super._body()
	if not failures.is_empty() or not _body_complete:
		_expect(_body_complete, "normal-entry home continuation completed")
		return
	await _after_home_continuation()
	if not failures.is_empty():
		return
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	var document: Dictionary = _survival().call(&"document")
	var disk: Variant = SaveDiff.read_json(ENTRY_SAVE)
	SaveDiff.report("entry-first-memory-vs-disk.inventory", snapshot.get("inventory", {}), disk.get("inventory", {}) if disk is Dictionary else disk)
	SaveDiff.report("entry-first-memory-vs-disk.survival", snapshot.get("survival", {}), disk.get("survival", {}) if disk is Dictionary else disk)
	SaveDiff.report("entry-first-memory-vs-disk.receipts", snapshot.get("applied_transactions", {}), disk.get("applied_transactions", {}) if disk is Dictionary else disk)
	var audit := {"inventory": snapshot.get("inventory", {}).duplicate(true), "survival": document.duplicate(true), "transactions": snapshot.get("applied_transactions", {}).duplicate(true), "world_slice": snapshot.get("world_slice", {}).duplicate(true)}
	var file := FileAccess.open(ENTRY_AUDIT, FileAccess.WRITE)
	_expect(file != null, "independent restart baseline can be written")
	if file != null:
		# Independent baseline must not truncate the doubles it later compares.
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()
	print("ENTRY_HOME_FIRST_PROCESS inventory=%s receipts=%d structures=%d" % [str(_save().call(&"inventory_totals")), (audit.transactions as Dictionary).size(), (document.get("structures", {}) as Dictionary).size()])

func _verify_restart() -> void:
	var file := FileAccess.open(ENTRY_AUDIT, FileAccess.READ)
	_expect(file != null, "separate process reads baseline from first process")
	if file == null:
		return
	var baseline: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(baseline is Dictionary, "restart baseline is valid JSON")
	if not baseline is Dictionary:
		return
	var restore: String = Integers.normalize_numbers(baseline)
	_expect(restore.is_empty(), "restart baseline restores exact integer types (%s)" % restore)
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	var document: Dictionary = _survival().call(&"document")
	var disk: Variant = SaveDiff.read_json(ENTRY_SAVE)
	SaveDiff.report("entry-restart-baseline-vs-reloaded.inventory", baseline.get("inventory", {}), snapshot.get("inventory", {}))
	SaveDiff.report("entry-restart-baseline-vs-reloaded.survival", baseline.get("survival", {}), document)
	SaveDiff.report("entry-restart-disk-vs-reloaded.inventory", disk.get("inventory", {}) if disk is Dictionary else disk, snapshot.get("inventory", {}))
	SaveDiff.report("entry-restart-disk-vs-reloaded.receipts", disk.get("applied_transactions", {}) if disk is Dictionary else disk, snapshot.get("applied_transactions", {}))
	_expect((snapshot.get("inventory", {}) as Dictionary) == (baseline.get("inventory", {}) as Dictionary), "separate process restores exact ordinary and unique inventory")
	_expect(document == (baseline.get("survival", {}) as Dictionary), "separate process restores exact structures, chests and permanent knowledge")
	# A relaunched process legitimately advances the pausable world clock and
	# records that as world_time receipts. Custody must be untouchable: every
	# baseline receipt survives byte-identical, and a receipt that did not exist
	# may only be a clock advance -- never a source, craft, transfer or deposit.
	var base_receipts: Dictionary = baseline.get("transactions", {})
	var live_receipts: Dictionary = snapshot.get("applied_transactions", {})
	var missing: Array[String] = []
	var rewritten: Array[String] = []
	var forged: Array[String] = []
	for key: Variant in base_receipts.keys():
		if not live_receipts.has(key):
			missing.append(String(key))
		elif live_receipts[key] != base_receipts[key]:
			rewritten.append(String(key))
	for key: Variant in live_receipts.keys():
		if base_receipts.has(key):
			continue
		var metadata: Dictionary = ((live_receipts[key] as Dictionary).get("metadata", {}) as Dictionary)
		if String(metadata.get("operation", "")) != "world_time":
			forged.append("%s:%s" % [String(key), String(metadata.get("operation", "?"))])
	SaveDiff.report("entry-restart-baseline-vs-reloaded.receipts", base_receipts, live_receipts)
	_expect(missing.is_empty(), "no baseline receipt is lost on restart (%s)" % str(missing.slice(0, 3)))
	_expect(rewritten.is_empty(), "no baseline receipt is rewritten on restart (%s)" % str(rewritten.slice(0, 3)))
	_expect(forged.is_empty(), "restart adds no receipt except clock advances (%s)" % str(forged.slice(0, 3)))
	# Same rule for the world slice: the only field allowed to move is the
	# pausable clock, and it may only move forward.
	var base_world: Dictionary = (baseline.get("world_slice", {}) as Dictionary).duplicate(true)
	var live_world: Dictionary = (snapshot.get("world_slice", {}) as Dictionary).duplicate(true)
	SaveDiff.report("entry-restart-baseline-vs-reloaded.world_slice", base_world, live_world)
	var base_clock: Dictionary = (base_world.get("clock", {}) as Dictionary)
	var live_clock: Dictionary = (live_world.get("clock", {}) as Dictionary)
	base_world.erase("clock")
	live_world.erase("clock")
	_expect(int(live_clock.get("active_seconds", -1)) >= int(base_clock.get("active_seconds", 0)), "restart clock never runs backwards")
	_expect(live_world == base_world, "separate process preserves exact POI state and capabilities")
	var world := await _boot()
	_expect(world != null, "separate process reconstructs the actual production overworld")
	if world == null:
		return
	var build := world.get(&"survival_build") as SurvivalBuildSystem
	var structures: Dictionary = document.get("structures", {})
	var all_present := not structures.is_empty()
	for id: Variant in structures.keys():
		if build.structure_node(String(id)) == null:
			all_present = false
	_expect(all_present, "all paid structure identities reconstruct after a genuine process restart")
	var rebuilt: Dictionary = _save().call(&"get_snapshot")
	SaveDiff.report("entry-restart-reloaded-vs-rebuild.inventory", snapshot.get("inventory", {}), rebuilt.get("inventory", {}))
	SaveDiff.report("entry-restart-reloaded-vs-rebuild.survival", document, _survival().call(&"document"))
	SaveDiff.report("entry-restart-reloaded-vs-rebuild.receipts", snapshot.get("applied_transactions", {}), rebuilt.get("applied_transactions", {}))
	_expect(rebuilt.get("inventory", {}) == baseline.get("inventory", {}), "world reconstruction does not duplicate carried items")
	print("ENTRY_HOME_SECOND_PROCESS inventory=%s receipts=%d structures=%d" % [str(_save().call(&"inventory_totals")), (snapshot.get("applied_transactions", {}) as Dictionary).size(), structures.size()])
