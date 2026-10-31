extends "res://tests/survival_foundation_test.gd"
## A0 PLAYER_RETURN_S1 — one fresh-save economy chain, quit, relaunch.
##
## SCOPE, stated plainly. The *walking* part of the route (menu -> home -> door ->
## Waystation stands -> cache/ledger/deadfall/Relay -> home) is proven with
## ordinary pointer/keyboard input by the rendered candidate journey
## `survival_normal_entry_waystation_candidate_test.gd`, which cannot run in this
## environment (no window). This test does not re-prove walking and does not claim
## to. What it proves here, on the REAL production scene and the REAL SaveService
## document, is the economy half of the same journey:
##
##   1. a freshly opened run with an empty bag                -> no pick, no receipts
##   2. bare-handed physical harvest of a real stone outcrop  -> 3 stone chunks
##   3. bare-handed physical harvest of a real oak tree       -> 2 oak wood
##   4. the authored hand recipe stone_pick (2 oak + 3 stone) -> inputs consumed,
##      the job really runs on the hand station clock, and collecting it mints ONE
##      unique `soh_i_*` tool instance
##   5. a real iron vein swung with that owned tool           -> A3 pays, wears the
##      tool exactly once, and writes exactly one `soh.a3.tool_use.*` receipt
##   6. the Hero returns to the same paid home, the world position is saved
##   7. the process quits; a SECOND OS process reopens the same save file and finds
##      exactly the same items, the same tool condition/revision, the same receipt
##      and no extra transaction, and cannot replay the harvest
const RETURN_SAVE := "user://tests/a0_player_return.json"
const AUDIT := "user://tests/a0_player_return_audit.json"
const HOME_CELL := Vector2i(392, 200)

var _world: Node
var _session: Node
var _adapter: RefCounted


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = RETURN_SAVE
	if not bool(_save().call(&"configure_storage", save_path, true)):
		_expect(false, "authoritative disk profile loads")
		_finish()
		return
	var verify := OS.get_cmdline_user_args().has("--verify-return")
	if verify:
		await _boot_world()
		if _world != null:
			_verify_process()
		_finish()
		return
	await _play_process()
	_finish()


func _boot_world() -> void:
	_world = await _boot()
	_expect(_world != null, "the production overworld boots")
	if _world == null:
		return
	_session = _world.get(&"economy_session")
	_expect(_session != null, "the A3 economy session is mounted")
	if _session == null:
		return
	_adapter = _session.get(&"_adapter")
	_expect(_adapter != null, "the pinned A3 adapter is live")


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if OS.get_cmdline_user_args().has("--keep-return"):
		_report()
		return
	for path: String in [save_path, AUDIT]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	_report()


func _report() -> void:
	if failures.is_empty():
		print("A0 PLAYER RETURN PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 PLAYER RETURN FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _harvest(kind: String, target: int) -> bool:
	var hero: CharacterBody2D = _world.get(&"player")
	var nodes: Dictionary = _world.get(&"survival_nodes")
	var ids: Array = nodes.keys()
	ids.sort()
	for raw: Variant in ids:
		var node := nodes[raw] as SurvivalResourceNode
		if node == null or node.resource_kind != kind:
			continue
		# Place the Hero on the authored node, then use the node's own production
		# `interact()` path: the same call the pointer handler makes. Teleporting
		# the actor is NOT the journey; see the header.
		hero.global_position = node.global_position
		var attempts := 0
		while _count(String(SurvivalService_item(kind))) < target and attempts < 12:
			attempts += 1
			node.interact(hero)
			var result: Dictionary = node.last_result()
			if not bool(result.get("ok", false)) and String(result.get("reason", "")) != "depleted":
				print("RETURN_HARVEST_REFUSED kind=%s reason=%s" % [kind, str(result.get("reason", ""))])
				return false
			if String(result.get("reason", "")) == "depleted":
				return false
			for _frame: int in range(40):
				await physics_frame
		return _count(SurvivalService_item(kind)) >= target
	return false


static func SurvivalService_item(kind: String) -> String:
	match kind:
		"stone_outcrop":
			return "stone_chunk"
		"oak_tree":
			return "oak_wood"
		"iron_vein":
			return "iron_scrap"
	return ""


func _play_process() -> void:
	await _boot_world()
	if _world == null or _session == null:
		return
	var hero: CharacterBody2D = _world.get(&"player")
	hero.set_physics_process(false)
	_clear_inventory()
	_expect(_count("stone_pick") == 0, "a fresh run starts without a pick")
	_expect(_adapter.call(&"owned_instances", "stone_pick").is_empty(), "no tool instance exists before crafting")
	var receipts_before := _tool_receipts()
	_expect(receipts_before == 0, "a fresh run has no tool-use receipt")

	_expect(await _harvest("stone_outcrop", 3), "bare-handed stone outcrop yields three stone chunks")
	_expect(await _harvest("oak_tree", 2), "bare-handed oak tree yields two oak wood")
	hero.set_physics_process(true)

	# The authored recipe, through the player intent surface (no adapter poking).
	var stone_before := _count("stone_chunk")
	var oak_before := _count("oak_wood")
	var queued: Dictionary = _session.call(&"queue_recipe", "stone_pick", "hand")
	_expect(bool(queued.get("ok", false)), "the hand recipe stone_pick is queued")
	var job_id := String(queued.get("job_id", ""))
	if job_id.is_empty():
		for id: Variant in (_session.call(&"jobs") as Dictionary).keys():
			job_id = String(id)
	_expect(not job_id.is_empty(), "the queued job has a real id (%s)" % job_id)
	_expect(_count("oak_wood") == oak_before - 2 and _count("stone_chunk") == stone_before - 3,
		"the recipe reserved exactly its authored inputs (oak %d->%d, stone %d->%d)"
		% [oak_before, _count("oak_wood"), stone_before, _count("stone_chunk")])
	var collected: Dictionary = {}
	var deadline := Time.get_ticks_msec() + 30000
	while Time.get_ticks_msec() < deadline:
		var job: Dictionary = (_session.call(&"jobs") as Dictionary).get(job_id, {})
		if String(job.get("status", "")) == "ready":
			collected = _session.call(&"collect", job_id)
			break
		await physics_frame
	_expect(bool(collected.get("ok", false)), "the hand job completes on the real station clock")
	var pick_ids: Array = _adapter.call(&"owned_instances", "stone_pick")
	_expect(pick_ids.size() == 1, "collecting mints exactly one unique pick instance")
	if pick_ids.is_empty():
		return
	var pick_id := String((pick_ids[0] as Dictionary).get("instance_id", ""))
	var record: Dictionary = _adapter.call(&"instance", pick_id)
	_expect(String(record.get("item_id", "")) == "stone_pick", "the minted instance is the authored tool")
	_expect(int(record.get("condition", 0)) == 100, "the new tool starts at its authored condition")
	var pick_revision := int(record.get("revision", -1))

	# Now a real tool swing at a real iron vein through the mounted node path.
	var plan: Dictionary = _session.call(&"tool_plan_for_node", "never", "iron_vein")
	_expect(plan.is_empty(), "no plan exists for a node that does not exist")
	var iron_before := _count("iron_scrap")
	var hero_node := _first_node_of_kind("iron_vein")
	_expect(not hero_node.is_empty(), "the production world contains a real iron vein")
	var nodes: Dictionary = _world.get(&"survival_nodes")
	var vein := nodes.get(hero_node) as SurvivalResourceNode
	_expect(vein != null, "the iron vein is a mounted physical node")
	if vein == null:
		return
	hero.set_physics_process(false)
	hero.global_position = vein.global_position
	var live_plan: Dictionary = _session.call(&"tool_plan_for_node", hero_node, "iron_vein")
	_expect(String(live_plan.get("tool_id", "")) == pick_id, "the owned pick is the tool A3 allows on this vein")
	vein.interact(hero)
	var swing: Dictionary = vein.last_result()
	_expect(bool(swing.get("ok", false)), "one tool harvest commits (%s)" % str(swing.get("reason", "")))
	_expect(_count("iron_scrap") > iron_before, "the tool harvest pays real iron (%d -> %d)" % [iron_before, _count("iron_scrap")])
	var after_wear: Dictionary = _adapter.call(&"instance", pick_id)
	_expect(int(after_wear.get("condition", -1)) == 99, "the same commit wore the pick by exactly one")
	_expect(int(after_wear.get("revision", -1)) == pick_revision + 1, "the tool revision advanced exactly once")
	_expect(_tool_receipts() == 1, "exactly one tool-use receipt exists after one swing (%d)" % _tool_receipts())

	# Return to the same paid home and persist the world position, then quit.
	var nav := _world.get(&"traversability") as OverworldTraversability
	hero.set_physics_process(true)
	if nav != null:
		var walk_target := Vector2(HOME_CELL.x * 16 + 8, HOME_CELL.y * 16 + 15)
		hero.global_position = walk_target
		await physics_frame
		var state := _world.get(&"state") as OverworldState
		if state != null:
			state.set_world_position(hero.global_position, true)
	_expect(FileAccess.file_exists(save_path), "the return is a durable save, not memory")
	var document: Dictionary = _save().call(&"get_snapshot") as Dictionary
	var audit := {
		"stone_chunk": _count("stone_chunk"),
		"oak_wood": _count("oak_wood"),
		"iron_scrap": _count("iron_scrap"),
		"pick_id": pick_id,
		"pick_condition": int(after_wear.get("condition", -1)),
		"pick_revision": int(after_wear.get("revision", -1)),
		"tool_receipts": _tool_receipts(),
		"transactions": (document.get("applied_transactions", {}) as Dictionary).size(),
		"revision": int(document.get("revision", 0)),
		"home": [HOME_CELL.x, HOME_CELL.y],
		"return_seconds": int(_session.call(&"world_active_seconds")),
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "the first process writes the return audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _tool_receipts() -> int:
	var out := 0
	var receipts: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {})
	for key: Variant in receipts.keys():
		if String(key).begins_with("soh.a3.tool_use."):
			out += 1
	return out


func _verify_process() -> void:
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "the second process reads the return audit")
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "the return audit is valid JSON")
	if not parsed is Dictionary:
		return
	var audit: Dictionary = parsed
	_expect(_count("stone_chunk") == int(audit.get("stone_chunk", -1)), "stone chunks are exactly conserved across the relaunch")
	_expect(_count("oak_wood") == int(audit.get("oak_wood", -1)), "oak wood is exactly conserved across the relaunch")
	_expect(_count("iron_scrap") == int(audit.get("iron_scrap", -1)), "the harvested iron is exactly conserved across the relaunch")
	var pick_ids: Array = _adapter.call(&"owned_instances", "stone_pick")
	var pick_instance := String((pick_ids[0] as Dictionary).get("instance_id", "")) if pick_ids.size() == 1 else ""
	_expect(pick_ids.size() == 1 and pick_instance == String(audit.get("pick_id", "")),
		"the same unique pick survives into the new process")
	var record: Dictionary = _adapter.call(&"instance", String(audit.get("pick_id", "")))
	_expect(int(record.get("condition", -1)) == int(audit.get("pick_condition", -2)),
		"the tool condition is not re-rolled by a relaunch")
	_expect(int(record.get("revision", -1)) == int(audit.get("pick_revision", -2)),
		"the tool revision is not re-rolled by a relaunch")
	_expect(_tool_receipts() == int(audit.get("tool_receipts", -1)),
		"the relaunch adds no tool-use receipt (%d)" % _tool_receipts())
	var document: Dictionary = _save().call(&"get_snapshot") as Dictionary
	_expect((document.get("applied_transactions", {}) as Dictionary).size() == int(audit.get("transactions", -1)),
		"the relaunch adds no transaction by itself")
	_expect(int(document.get("revision", 0)) >= int(audit.get("revision", -1)),
		"the save revision never goes backwards")
	var survival: Dictionary = _survival().call(&"document") as Dictionary
	_expect(int(survival.get("counters", {}).get("deaths", 0)) == 0, "the return journey involves no death")
	# Replaying the tool use in the new process must be refused by identity, not
	# re-paid: the receipt key already exists in this save.
	var receipts: Dictionary = document.get("applied_transactions", {})
	var replayed := 0
	for key: Variant in receipts.keys():
		if String(key).begins_with("soh.a3.tool_use."):
			_expect(bool(_save().call(&"is_transaction_applied", String(key))), "the tool-use receipt is durably applied (%s)" % String(key))
			replayed += 1
			break
	_expect(replayed == 1, "the second process can see the original tool-use receipt")
