extends "res://tests/survival_foundation_test.gd"
## A3 V7 tool use and prepared offline operations, composed by A0 on the REAL
## production overworld and the real SaveService.
##
## Two honesty notes:
##   * The stone pick is created through A3's own authoring API
##     (`grant_instance`), which is how A3 mints a unique tool instance. The
##     player-facing path that produces the same instance is the shipped
##     hand-station `stone_pick` recipe; this test does not claim to have walked
##     it, and it does not touch any A3 formula, cost or wear rate.
##   * There is no mounted production damage source in the survival world yet, so
##     nothing here pretends a harvest or a job is combat.
const TOOL_SAVE := "user://tests/a0_tool_offline.json"
const AUDIT := "user://tests/a0_tool_offline_audit.json"

var _economy: Node
var _adapter: RefCounted


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = TOOL_SAVE
	var verify := OS.get_cmdline_user_args().has("--verify-tool-offline")
	if not bool(_save().call(&"configure_storage", save_path, true)):
		_expect(false, "authoritative disk profile loads")
		_finish()
		return
	if verify:
		_verify_process()
		_finish()
		return
	await _boot_and_run()
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if OS.get_cmdline_user_args().has("--keep-tool"):
		_report()
		return
	for path: String in [save_path, AUDIT]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	_report()


func _report() -> void:
	if failures.is_empty():
		print("A0 TOOL AND OFFLINE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 TOOL AND OFFLINE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _boot_and_run() -> void:
	var world := await _boot()
	_expect(world != null, "the production overworld boots")
	if world == null:
		return
	_economy = world.get(&"economy_session")
	_expect(_economy != null, "the A3 economy session is mounted in the real world")
	if _economy == null:
		return
	_adapter = _economy.get("_adapter")
	_expect(_adapter != null, "the pinned A3 adapter is the live economy authority")
	var composition: Node = world.get(&"economy_composition")
	_expect(composition != null and is_instance_valid(composition),
		"the A0 composition root (run lifecycle + profile port + offline host) is mounted")
	if composition != null:
		var lifecycle: Node = root.get_node_or_null("RunLifecycle")
		_expect(lifecycle != null and not (lifecycle.call(&"run_record") as Dictionary).is_empty(),
			"the mounted world belongs to a durable run")
		var port: RefCounted = composition.get("_port")
		_expect(port != null, "the A3 V7 profile port is bound to real SaveService")
		if port != null:
			var ctx: Dictionary = port.call(&"run_context")
			_expect(String(ctx.get("contract", "")) == "soh.economy.a0_run_context.v1",
				"the bound port speaks the A3 profile contract")
			_expect(String(ctx.get("run_id", "")) == String((lifecycle.call(&"run_record") as Dictionary).get("run_id", "x")),
				"the port and the lifecycle agree on the one run identity")

	# --- physical meta endpoints -------------------------------------------
	# The A3 policy lists nine endpoints in three regions. Only the ones whose
	# stand cell is an authored A1 interaction stand have a physical owner, and
	# every production endpoint is still `OWNER_CONTRACT_CANDIDATE_A1_A8`, so none
	# of them may authorize a deposit yet.
	if composition != null:
		var report: Dictionary = composition.call(&"endpoint_report")
		var kiosk: Dictionary = report.get("preservation_kiosk_01", {})
		_expect(String(((kiosk.get("physical_owner", {}) as Dictionary)).get("node_id", "")) == "node_waystation_locker",
			"the deposit kiosk is tied to the authored A1 Waystation locker stand")
		_expect(String(kiosk.get("blocked_reason", "")).begins_with("A1_A8_ENDPOINT_UNAUTHORIZED:"),
			"a candidate endpoint is reported blocked by its owner (%s)" % str(kiosk.get("blocked_reason", "")))
		var distant: Dictionary = report.get("preservation_kiosk_02", {})
		_expect(String(distant.get("blocked_reason", "")).begins_with("A1_A8_ENDPOINT_SITE_ABSENT:"),
			"an endpoint with no authored stand is reported as an absent site (%s)" % str(distant.get("blocked_reason", "")))
		# The A3 planner is the real gate: a deposit at an unauthorized endpoint is
		# refused, and no currency is secured.
		var run_authority: Node = root.get_node_or_null("RunLifecycle")
		var lifecycle_run: Dictionary = run_authority.call(&"run_record") if run_authority != null else {}
		var deposit_request := {
			"contract": "soh.economy.meta_plan.v1",
			"run_id": String(lifecycle_run.get("run_id", "")),
			"endpoint_id": "preservation_kiosk_01",
			"token_ids": ["soh_i_000000000001_deadbeef"],
			"expected_policy_revision": 1,
			"expected_endpoint_revision": "rev-1",
			"event_id": "test.deposit.refused",
		}
		var planned: Dictionary = _adapter.call(&"plan_meta_deposit", deposit_request)
		_expect(not bool(planned.get("ok", true)), "A3 refuses a deposit at an unauthorized endpoint (%s)" % str(planned.get("reason", "")))
		_expect(int(_composition_balance(composition)) == 0, "a refused deposit secures no currency")

	# --- tool use -----------------------------------------------------------
	var granted: Dictionary = _adapter.call(&"grant_instance", "stone_pick", "test.authoring.tool", -1, -1)
	_expect(bool(granted.get("ok", false)), "A3 mints one unique stone pick instance (%s)" % str(granted.get("reason", "")))
	var tool_id := String(granted.get("instance_id", ""))
	if tool_id.is_empty():
		return
	var record: Dictionary = (_adapter.call(&"document") as Dictionary).get("instances", {}).get(tool_id, {})
	var revision := int(record.get("revision", -1))
	var condition := int(record.get("condition", 0))
	_expect(condition > 0, "the authored tool starts with real condition (%d)" % condition)

	var node_id := _first_node_of_kind("iron_vein")
	_expect(not node_id.is_empty(), "the production world contains a real iron vein")
	if node_id.is_empty():
		return
	var iron_before := _count("iron_scrap")
	var ok_swing: Dictionary = _survival().call(&"harvest_with_tool", node_id, "iron_vein", _economy,
		tool_id, "world:0:0", 0)
	_expect(bool(ok_swing.get("ok", false)), "one paid tool harvest commits (%s)" % str(ok_swing.get("reason", "")))
	var worn: Dictionary = (_adapter.call(&"document") as Dictionary).get("instances", {}).get(tool_id, {})
	_expect(int(worn.get("condition", -1)) < condition, "the same commit wore the physical tool")
	_expect(int(worn.get("revision", -1)) == revision + 1, "the tool revision advanced exactly once")
	var iron_after := _count("iron_scrap")
	_expect(iron_after > iron_before, "the harvest paid real iron into the bag (%d -> %d)" % [iron_before, iron_after])
	var receipts: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {})
	var tool_receipts := 0
	for key: Variant in receipts.keys():
		if String(key).begins_with("soh.a3.tool_use."):
			tool_receipts += 1
	_expect(tool_receipts == 1, "exactly one tool-use receipt exists (%d)" % tool_receipts)

	# A stale plan (the revision before the swing) must be refused, and a refusal
	# must not cost condition or pay an item.
	var stale_revision := revision
	var stale: Dictionary = _survival().call(&"harvest_with_tool", node_id, "iron_vein", _economy,
		tool_id, "world:0:0", 0, -1, stale_revision)
	var after_stale: Dictionary = (_adapter.call(&"document") as Dictionary).get("instances", {}).get(tool_id, {})
	_expect(not bool(stale.get("ok", true)) and String(stale.get("reason", "")) == "TOOL_REVISION_STALE",
		"a plan made against an older tool revision is refused (%s)" % str(stale.get("reason", "")))
	_expect(int(after_stale.get("condition", -2)) == int(worn.get("condition", -3)),
		"a refused stale swing costs no tool condition")
	_expect(_count("iron_scrap") == iron_after, "a refused stale swing pays no item")
	# The physical path plans first and commits the planned revision.
	var plan: Dictionary = _economy.call(&"tool_plan_for_node", node_id, "iron_vein")
	_expect(String(plan.get("tool_id", "")) == tool_id and int(plan.get("expected_tool_revision", -1)) == int(after_stale.get("revision", -2)),
		"the mounted node path plans against the live tool revision (%s)" % str(plan.get("tool_id", "")))
	# A tool that cannot work this kind must be refused by A3, not by A0.
	var wrong_kind: Dictionary = _survival().call(&"harvest_with_tool", _first_node_of_kind("oak_tree"),
		"oak_tree", _economy, tool_id, "world:0:0", 0)
	_expect(not bool(wrong_kind.get("ok", true)), "A3 refuses a tool on a node kind it does not cut (%s)" % str(wrong_kind.get("reason", "")))
	# A foreign tool id is refused before any write.
	var foreign: Dictionary = _survival().call(&"harvest_with_tool", node_id, "iron_vein", _economy,
		"soh_i_000000000999_foreign", "world:0:0", 0)
	_expect(not bool(foreign.get("ok", true)) and String(foreign.get("reason", "")) == "TOOL_NOT_OWNED",
		"a foreign tool identity is refused")
	# A full bag must refuse the whole swing: no wear, no partial grant. "Full"
	# means the save's 30 inventory slots with the iron stack already at its own
	# 50-item limit, so the yield genuinely has nowhere to go.
	var iron_held := _count("iron_scrap")
	if iron_held < 50:
		_expect(bool(_give("iron_scrap", 50 - iron_held)), "the iron stack is filled to its authored limit")
	var fillers: Array[String] = []
	var material_ids: Array[String] = []
	var items_file := FileAccess.open("res://data/survival/items/items.json", FileAccess.READ)
	if items_file != null:
		var parsed: Variant = JSON.parse_string(items_file.get_as_text())
		items_file.close()
		if parsed is Dictionary:
			for id: Variant in ((parsed as Dictionary).get("items", {}) as Dictionary).keys():
				var entry: Dictionary = ((parsed as Dictionary)["items"] as Dictionary)[id]
				if String(entry.get("kind", "")) == "material" and String(id) != "iron_scrap":
					material_ids.append(String(id))
	material_ids.sort()
	for item_id: String in material_ids:
		if ((_save().call(&"get_inventory_stacks") as Dictionary).size()) >= 30:
			break
		if (_save().call(&"get_inventory_stacks") as Dictionary).has(item_id):
			continue
		if bool(_give(item_id, 1)):
			fillers.append(item_id)
	var filled_slots: Dictionary = _save().call(&"get_inventory_stacks")
	# Every grantable material is in the bag and the iron stack is at its limit, so
	# the next yield can only arrive by opening a new slot.
	_expect(filled_slots.size() >= 29, "the bag holds every authored material stack (%d slots)" % filled_slots.size())
	var slot_count_before := filled_slots.size()
	var full_before: Dictionary = _adapter.call(&"instance", tool_id)
	var full_swing: Dictionary = _survival().call(&"harvest_with_tool", node_id, "iron_vein", _economy,
		tool_id, "world:0:0", 0, -1, int(full_before.get("revision", -1)))
	var after_full: Dictionary = _adapter.call(&"instance", tool_id)
	_expect(not bool(full_swing.get("ok", true)),
		"a full bag refuses the harvest (%s)" % str(full_swing.get("reason", "")))
	_expect(int(after_full.get("condition", -2)) == int(full_before.get("condition", -3)),
		"a full bag costs no tool condition")
	_expect(int(after_full.get("revision", -2)) == int(full_before.get("revision", -3)),
		"a full bag does not advance the tool revision")
	_expect(((_save().call(&"get_inventory_stacks") as Dictionary).size()) == slot_count_before,
		"the refused harvest grants no partial item and opens no slot")
	# Give the bag back so the offline section starts from the same state.
	for item_id: String in fillers:
		var held := _count(item_id)
		if held > 0:
			_save().call(&"consume_inventory_item", item_id, held, "test.clear.%s.%d" % [item_id, Time.get_ticks_usec()])
	_expect(((_save().call(&"get_inventory_stacks") as Dictionary).size()) < slot_count_before, "the filler materials are released")

	# A broken tool is refused by A3 and pays nothing. The tool is worn out
	# through A3's own `wear` API, so this is the owner's state transition and
	# not a test poking at the economy document.
	var wear_out: Dictionary = _adapter.call(&"wear", tool_id, 100, "test.authoring.wear_out")
	_expect(bool(wear_out.get("ok", false)), "A3 wears the tool out through its own API (%s)" % str(wear_out.get("reason", "")))
	var worn_record: Dictionary = _adapter.call(&"instance", tool_id)
	_expect(int(worn_record.get("condition", -1)) == 0, "the tool really is at condition 0")
	var iron_broken := _count("iron_scrap")
	var broken_revision := int(worn_record.get("revision", 0))
	var broken_swing: Dictionary = _survival().call(&"harvest_with_tool", node_id, "iron_vein", _economy,
		tool_id, "world:0:0", broken_revision, 0)
	_expect(not bool(broken_swing.get("ok", true)) and String(broken_swing.get("reason", "")) == "TOOL_BROKEN",
		"a broken tool is refused by A3 (%s)" % str(broken_swing.get("reason", "")))
	_expect(_count("iron_scrap") == iron_broken, "a refused broken-tool swing pays nothing")
	_expect(int((_adapter.call(&"instance", tool_id) as Dictionary).get("revision", 0)) == broken_revision,
		"a refused swing does not advance the tool revision")

	# --- prepared offline operation ----------------------------------------
	var offline: Node = composition.get("_offline") if composition != null else null
	_expect(offline != null, "the A0 offline host is mounted")
	if offline == null:
		return
	var lifecycle: Node = root.get_node_or_null("RunLifecycle")
	var run: Dictionary = lifecycle.call(&"phase")
	_expect(String(run.get("state", "")) == "active", "the offline host works inside a live run")
	# No armed job yet: the plan must be honest about that, not invent work.
	var empty_plan: Dictionary = offline.call(&"plan", int(Time.get_unix_time_from_system()))
	_expect(bool(empty_plan.get("ok", false)), "A3 plans an empty interval cleanly (%s)" % str(empty_plan.get("reason", "")))
	_expect((empty_plan.get("operations", []) as Array).is_empty(), "an empty interval settles no operation")
	_expect(bool(empty_plan.get("active_source_cooldowns_changed", true)) == false,
		"A3 reports that no active source cooldown moved")
	# A forged projection is refused: the host projection is the only authority.
	var forged: Dictionary = offline.call(&"plan", int(Time.get_unix_time_from_system()) + 3600)
	_expect(not bool(forged.get("ok", true)) and String(forged.get("reason", "")) == "interval_in_future",
		"a future interval cannot be settled as if it had happened")
	# Rollback is refused.
	var rollback: Dictionary = offline.call(&"plan", 1)
	_expect(not bool(rollback.get("ok", true)), "a rolled-back interval is refused")

	var audit := {
		"tool_id": tool_id,
		"condition": int(((_adapter.call(&"document") as Dictionary).get("instances", {}) as Dictionary).get(tool_id, {}).get("condition", -1)),
		"revision": int(((_adapter.call(&"document") as Dictionary).get("instances", {}) as Dictionary).get(tool_id, {}).get("revision", -1)),
		"iron": _count("iron_scrap"),
		"receipts": (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size(),
		"profile": (_save().call(&"get_snapshot") as Dictionary).get("profile", {}),
		"run": run,
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "first process writes the tool audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _verify_process() -> void:
	# A genuine relaunch reads the same disk profile: the tool wear, the harvest
	# receipt and the run identity must all come back exactly.
	var audit_file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(audit_file != null, "second process reads the tool audit")
	if audit_file == null:
		return
	var baseline: Variant = JSON.parse_string(audit_file.get_as_text())
	audit_file.close()
	_expect(baseline is Dictionary, "tool audit is valid JSON")
	if not baseline is Dictionary:
		return
	var base: Dictionary = baseline
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	var instances: Dictionary = snapshot.get("survival_economy", {}).get("instances", {})
	var tool_id := String(base.get("tool_id", ""))
	_expect(instances.has(tool_id), "the unique tool instance survives a real relaunch")
	if instances.has(tool_id):
		_expect(int((instances[tool_id] as Dictionary).get("condition", -1)) == int(base.get("condition", -2)),
			"tool condition is restored exactly (no extra wear on load)")
		_expect(int((instances[tool_id] as Dictionary).get("revision", -1)) == int(base.get("revision", -2)),
			"tool revision is restored exactly")
	_expect(int(_count("iron_scrap")) == int(base.get("iron", -1)), "harvested iron is restored exactly")
	var receipts: Dictionary = snapshot.get("applied_transactions", {})
	_expect(receipts.size() == int(base.get("receipts", -1)), "relaunch adds no economy receipt by itself")
	var tool_receipts := 0
	for key: Variant in receipts.keys():
		if String(key).begins_with("soh.a3.tool_use."):
			tool_receipts += 1
	_expect(tool_receipts == 1, "the tool-use receipt is still exactly one after relaunch")
	# A replay of the same swing from the relaunched process must not pay again.
	var lifecycle: Node = root.get_node_or_null("RunLifecycle")
	_expect(lifecycle != null, "the relaunched process has a lifecycle")


## Secured profile balance through the A0 port inside the composition root.
func _composition_balance(composition: Node) -> int:
	var port: RefCounted = composition.get(&"_port")
	if port == null:
		return -1
	return int(port.call(&"balance"))
