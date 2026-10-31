extends SceneTree
## Real SaveService + immutable A3 86dc2195 adapter with a narrowly scoped A0
## shim. Station is an explicit fixture; these tests do not certify E-02.
const PinnedEconomy = preload("res://tests/fixtures/a3_86dc2195/adapter/a0_authorized_economy.gd")
const Guard = preload("res://game/survival/economy/unique_ownership_guard.gd")
var save: Node
var economy: RefCounted
var port: Node
var checks := 0
var failures: Array[String] = []
var lab_enabled := true
var fixture_sequence := 0
var fixture_ticks := {}

func _initialize() -> void:
	_run.call_deferred()

func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _station(id: String) -> Dictionary:
	if id == "lab" and lab_enabled:
		return {"ok": true, "station_id": id, "kind": "research", "tier": 1,
			"queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "fixture-r1"}
	if id == "bench":
		return {"ok": true, "station_id": id, "kind": "workbench", "tier": 1,
			"queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "fixture-r1"}
	return {}

# Explicit test fixture; not a production E-02 host or offline timer.
func _fixture_time(id: String) -> Dictionary:
	return {"contract": "soh.economy.active_tick.v1", "station_id": id,
		"session_id": "authority-fixture", "session_index": 1, "sequence": fixture_sequence,
		"active_ticks": int(fixture_ticks.get(id, 0)), "station_revision": "fixture-r1"}

func _fixture_advance(id: String, amount: int, event_id: String) -> Dictionary:
	fixture_sequence += 1
	fixture_ticks[id] = int(fixture_ticks.get(id, 0)) + amount
	return economy.call(&"advance", id, _fixture_time(id), event_id)

func _mutate_token(candidate: Dictionary, id: String, mode: String) -> bool:
	var inventory: Dictionary = candidate.get("inventory", {})
	var stacks: Dictionary = inventory.get("item_stacks", {})
	match mode:
		"quantity": stacks[id]["quantity"] = 2
		"kind": stacks[id]["kind"] = "material"
		"erase": stacks.erase(id)
		"duplicate": stacks[id + "_stack_2"] = {"item_id": id, "kind": "key_item", "quantity": 1}
		"orphan":
			var state: Dictionary = candidate["survival_economy"]
			state["instances"].erase(id)
			candidate["survival_economy"] = state
		"container":
			var survival: Dictionary = candidate.get("survival", {})
			survival["containers"] = {"fake": {id: 1}}
			candidate["survival"] = survival
		"reward": candidate["pending_rewards"] = [{"item_id": id, "quantity": 1}]
		"loadout": candidate["auxiliary_loadout"] = {"armor": id}
	inventory["item_stacks"] = stacks
	candidate["inventory"] = inventory
	return true

func _run() -> void:
	save = root.get_node("SaveService")
	var path := "user://tests/a0_a3_authority_%d.json" % Time.get_ticks_usec()
	_expect(bool(save.call(&"configure_storage", path, true)), "isolated real SaveService")
	economy = PinnedEconomy.new()
	port = save.call(&"create_pinned_economy_port", economy)
	_expect(port != null, "pinned A3 adapter receives A0 port")
	if port == null:
		return _finish()
	_expect(bool(economy.call(&"configure", port, _station)), "actual A3 catalog and service configured")
	var instance_ids: Array[String] = []
	var a3_catalog: Dictionary = economy.get(&"catalog")
	for item_id: Variant in a3_catalog.get("items", {}):
		if String(a3_catalog["items"][item_id].get("storage", "")) == "instance":
			instance_ids.append(String(item_id))
	instance_ids.sort()
	var approved: Array = Guard.APPROVED_INSTANCE_ITEMS.duplicate()
	approved.sort()
	_expect(instance_ids == approved, "A0 guard identity list exactly matches pinned A3 instance catalog")
	var created: Dictionary = economy.call(&"grant_instance", "iron_pick", "actual.grant", -1, 70)
	var id := String(created.get("instance_id", ""))
	_expect(bool(created.get("ok", false)) and not id.is_empty(), "trusted A3 creates one token plus record")
	if id.is_empty():
		return _finish()
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "A3 ownership audit accepts created pair")
	var replay: Dictionary = economy.call(&"grant_instance", "iron_pick", "actual.grant", -1, 70)
	_expect(bool(replay.get("duplicate", false)), "same genuine operation replay is idempotent")
	var conflict: Dictionary = economy.call(&"grant_instance", "iron_pick", "actual.grant", -1, 60)
	_expect(not bool(conflict.get("ok", false)), "same event with different payload rejects")
	var candidate: Dictionary = save.call(&"get_snapshot")
	_expect(not bool(save.call(&"add_items_to_candidate", candidate, id, "key_item", 1, {})), "generic candidate merge refuses unique")
	_expect(not bool(save.call(&"remove_items_from_candidate", candidate, id, 1)), "generic candidate removal refuses unique")
	_expect(not bool(save.call(&"grant_inventory_item", "soh_i_000000000099_deadbeef", "key_item", 1, "forge.grant")), "generic forged grant refused")
	_expect(not bool(save.call(&"consume_inventory_item", id, 1, "forge.consume")), "generic consume refused")
	_expect(not bool(save.call(&"drop_inventory_item", id, 1, "forge.drop")), "generic drop refused")
	_expect(not bool(save.call(&"home_transfer_to_storage", "item_stack", id, "forge.home")), "generic storage refused")
	for mode: String in ["quantity", "kind", "erase", "duplicate", "orphan", "container", "reward", "loadout"]:
		var attempted := func(c: Dictionary) -> bool: return _mutate_token(c, id, mode)
		_expect(not bool(save.call(&"transact_once", "forge." + mode, attempted, {"kind": "survival_economy"})),
			"forged metadata and " + mode + " cannot commit")
	var forged_id := "soh_i_000000000099_deadbeef"
	var balanced_forgery := func(c: Dictionary) -> bool:
		var stacks: Dictionary = c["inventory"]["item_stacks"]
		stacks[forged_id] = {"kind": "key_item", "quantity": 1}
		var state: Dictionary = c["survival_economy"]
		var copy: Dictionary = state["instances"][id].duplicate(true)
		copy["instance_id"] = forged_id
		state["instances"][forged_id] = copy
		return true
	_expect(not bool(save.call(&"transact_once", "forge.balanced", balanced_forgery, {"kind": "survival_economy"})), "even a balanced forged token and attribute pair is unauthorized")
	var forged_terminal := func(c: Dictionary) -> bool:
		c["inventory"]["item_stacks"].erase(id)
		c["survival_economy"]["instances"][id]["location"] = "dismantled"
		return true
	_expect(not bool(save.call(&"transact_once", "forge.terminal", forged_terminal, {"kind": "survival_economy"})), "balanced but unauthorized terminal conversion refused")
	_expect(save.call(&"create_pinned_economy_port", RefCounted.new()) == null, "unreviewed object cannot bind an economy authority")
	var bag_path: Array = ["inventory", "item_stacks", id, "quantity"]
	_expect(not bool(save.call(&"patch_state_path", bag_path, 2)), "nontransactional patch cannot bypass guard")
	var bad_snapshot: Dictionary = save.call(&"get_snapshot")
	_mutate_token(bad_snapshot, id, "quantity")
	_expect(not bool(save.call(&"_commit_snapshot", bad_snapshot, false)), "direct disk snapshot cannot bypass commit boundary")
	var fake := func(c: Dictionary) -> bool: return _mutate_token(c, id, "quantity")
	_expect(not bool(port.call(&"transact_once", "fake.port", fake, {"kind": "survival_economy"})), "untrusted callable cannot use A3 port")
	var wrapped: Dictionary = economy.call(&"_transact", "grant", "fake.wrapper", {},
		func(c: Dictionary, state: Dictionary, _result: Dictionary) -> bool:
			state["instances"].erase(id)
			return _mutate_token(c, id, "erase"))
	_expect(not bool(wrapped.get("ok", false)), "A3 wrapper refuses foreign mutator")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "audit remains valid after generic attacks")
	var callback_result := {"called": false, "accepted": false}
	var attack_on_signal := func(_snapshot: Dictionary) -> void:
		callback_result["called"] = true
		callback_result["accepted"] = bool(save.call(&"patch_state_path", ["survival_economy", "instances", id, "condition"], 1))
	save.connect(&"save_committed", attack_on_signal)
	var wear: Dictionary = economy.call(&"wear", id, 1, "legitimate.wear")
	save.disconnect(&"save_committed", attack_on_signal)
	_expect(bool(wear.get("ok", false)), "genuine A3 wear commits")
	_expect(bool(callback_result["called"]) and not bool(callback_result["accepted"]), "save signal re-entry cannot inherit A3 authorization")
	_expect(int((economy.call(&"instance", id) as Dictionary).get("condition", 0)) == 69, "re-entry cannot rewrite A3 attributes")
	var core: Dictionary = economy.call(&"grant_instance", "core_venom", "fixture.core.blocked", 2, 100)
	_expect(bool(core.get("ok", false)), "A3 can create genuine physical Core without granting Gold readiness")
	var blocked_cast: Dictionary = economy.call(&"commit_cast", String(core.get("instance_id", "")), "fixture.unattested.cast", 0)
	_expect(not bool(blocked_cast.get("ok", false)), "production Core remains BLOCKED_PENDING_A4")
	_expect(bool(save.call(&"grant_inventory_item", "knowledge_spares", "material", 5, "fixture.spares")), "ordinary inventory grant unaffected")
	var research: Dictionary = economy.call(&"research_recipe", "iron_pick", "lab", "specimen", "specimen.research", id)
	_expect(bool(research.get("ok", false)), "genuine A3 moves specimen into research escrow")
	var job_id := String(research.get("job_id", ""))
	if job_id.is_empty():
		return _finish()
	_expect((save.call(&"get_inventory_stacks") as Dictionary).get(id, null) == null, "escrow has no physical bag token")
	_expect(not bool(save.call(&"grant_inventory_item", id, "key_item", 1, "forge.escrow")), "generic grant cannot duplicate escrow")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "A3 escrow audit remains valid")
	lab_enabled = false
	var cancelled: Dictionary = economy.call(&"cancel", job_id, "cancel.after.removal")
	_expect(bool(cancelled.get("ok", false)), "removed station retains cancellable escrow: " + String(cancelled.get("reason", "")))
	var filled: Array[String] = []
	for i in range(40):
		var key := "fixture_full_%02d" % i
		if not bool(save.call(&"grant_inventory_item", key, "material", 1, "fill.%02d" % i)):
			break
		filled.append(key)
	_expect(not filled.is_empty() and filled.size() < 35, "inventory filled to real capacity")
	var full_snapshot: Dictionary = save.call(&"get_snapshot")
	var no_space: Dictionary = economy.call(&"grant_instance", "iron_pick", "actual.grant.full")
	_expect(not bool(no_space.get("ok", false)) and (save.call(&"get_snapshot") as Dictionary) == full_snapshot,
		"full inventory refuses real A3 unique creation without spending identity or receipt")
	_expect(not bool((economy.call(&"collect", job_id, "collect.full") as Dictionary).get("ok", false)), "full inventory refuses escrow recovery")
	_expect(bool(save.call(&"reload_save")), "reload preserves escrow and receipt")
	_expect(not bool((economy.call(&"collect", job_id, "collect.full.reload") as Dictionary).get("ok", false)), "full inventory still refuses after reload")
	if filled.size() >= 2:
		_expect(bool(save.call(&"consume_inventory_item", filled[0], 1, "free.0")), "free refund slot one")
		_expect(bool(save.call(&"consume_inventory_item", filled[1], 1, "free.1")), "free refund slot two")
	var collected: Dictionary = economy.call(&"collect", job_id, "collect.after.free")
	_expect(bool(collected.get("ok", false)), "escrow specimen returned once after station removal: " + String(collected.get("reason", "")))
	var again: Dictionary = economy.call(&"collect", job_id, "collect.after.free")
	_expect(bool(again.get("duplicate", false)), "refund replay is idempotent")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "actual A3 ownership audit passes after return")
	_expect((economy.call(&"owned_instances", "iron_pick") as Array).size() == 1, "exactly one genuine specimen retained")
	_expect(bool(save.call(&"reload_save")), "reload real returned pair")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "A3 ownership audit passes after reload")
	# External corruption is deliberately written to disk, not through a trusted
	# API. A bad primary must not be replaced with a backup or new defaults.
	var safe: Dictionary = save.call(&"get_snapshot")
	for mode: String in ["quantity", "kind", "orphan", "duplicate", "schema", "attributes", "unknown_item"]:
		var corrupt := safe.duplicate(true)
		if mode == "schema":
			corrupt["survival_economy"]["schema"] = 999
		elif mode == "attributes":
			corrupt["survival_economy"]["instances"][id]["condition"] = 101
		elif mode == "unknown_item":
			corrupt["survival_economy"]["instances"][id]["item_id"] = "not_an_a3_instance"
		else:
			_mutate_token(corrupt, id, mode)
		var bytes := JSON.stringify(corrupt, "\t") + "\n"
		var writer := FileAccess.open(path, FileAccess.WRITE)
		writer.store_string(bytes)
		writer.close()
		_expect(not bool(save.call(&"reload_save")), "malformed " + mode + " load fails closed")
		_expect(bool((save.call(&"get_economy_quarantine") as Dictionary).get("active", false)), "malformed " + mode + " is explicitly quarantined")
		if mode == "quantity":
			var application := (load("res://game/app/app_root.tscn") as PackedScene).instantiate()
			root.add_child(application)
			_expect(application.find_child("SaveRecoveryOverlay", true, false) != null and paused,
				"production app blocks play and shows recovery overlay")
			application.queue_free()
			paused = false
			await process_frame
		_expect(not bool(save.call(&"save_now")) and not bool(save.call(&"grant_inventory_item", "oak_wood", "material", 1, "quarantine." + mode)), "quarantine blocks writes: " + mode)
		_expect(not bool(save.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE")), "quarantine blocks destructive reset: " + mode)
		_expect(FileAccess.get_file_as_string(path) == bytes, "malformed bytes are not replaced: " + mode)
		var repair := FileAccess.open(path, FileAccess.WRITE)
		repair.store_string(JSON.stringify(safe, "\t") + "\n")
		repair.close()
		_expect(bool(save.call(&"reload_save")), "explicitly restored file reloads: " + mode)
		_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "restored pair remains auditable: " + mode)
	var legacy := safe.duplicate(true)
	legacy["survival_economy"]["schema"] = 1
	legacy["survival_economy"].erase("time")
	var legacy_file := FileAccess.open(path, FileAccess.WRITE)
	legacy_file.store_string(JSON.stringify(legacy, "\t") + "\n")
	legacy_file.close()
	_expect(bool(save.call(&"reload_save")), "valid v1 economy namespace loads")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "v1 token pair remains auditable")
	var migrated: Dictionary = economy.call(&"wear", id, 1, "legacy.v1.migrate")
	_expect(bool(migrated.get("ok", false)), "actual A3 mutation migrates v1 namespace transactionally")
	_expect(int(((save.call(&"get_snapshot") as Dictionary).get("survival_economy", {}) as Dictionary).get("schema", 0)) == 2,
		"legacy v1 becomes v2 without losing token attributes")
	_test_real_specimen_consumption_and_unique_output()
	_finish()

func _test_real_specimen_consumption_and_unique_output() -> void:
	var path := "user://tests/a0_a3_consume_%d.json" % Time.get_ticks_usec()
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh profile for genuine terminal and output operations")
	lab_enabled = true
	fixture_sequence = 0
	fixture_ticks = {}
	economy.call(&"configure_time_host", _fixture_time)
	_expect(bool(save.call(&"grant_inventory_item", "knowledge_spares", "material", 5, "consume.spares")), "grant research inputs")
	var specimen: Dictionary = economy.call(&"grant_instance", "iron_pick", "consume.specimen", -1, 50)
	var old_id := String(specimen.get("instance_id", ""))
	_expect(bool(specimen.get("ok", false)), "create real specimen for research")
	var research: Dictionary = economy.call(&"research_recipe", "iron_pick", "lab", "specimen", "consume.research", old_id)
	_expect(bool(research.get("ok", false)), "real specimen enters research escrow")
	var advanced := _fixture_advance("lab", 40, "consume.research.tick")
	_expect(bool(advanced.get("ok", false)), "actual A3 research consumes specimen using fixture clock")
	_expect(String((economy.call(&"instance", old_id) as Dictionary).get("location", "")) == "consumed_by_research",
		"specimen has terminal identity and no physical token")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "terminal specimen passes A3 ownership audit")
	for item: Array in [["oak_wood", 2], ["iron_ingot", 2], ["binding_cloth", 1]]:
		_expect(bool(save.call(&"grant_inventory_item", String(item[0]), "material", int(item[1]), "craft." + String(item[0]))), "grant real recipe input " + String(item[0]))
	var job: Dictionary = economy.call(&"enqueue", "iron_pick", "bench", "craft.pick")
	_expect(bool(job.get("ok", false)), "actual A3 queues researched unique output")
	var complete := _fixture_advance("bench", 14, "craft.pick.tick")
	_expect(bool(complete.get("ok", false)), "actual A3 produces escrowed unique output")
	var job_id := String(job.get("job_id", ""))
	var collected: Dictionary = economy.call(&"collect", job_id, "craft.pick.collect")
	_expect(bool(collected.get("ok", false)), "actual A3 collects newly crafted unique token")
	var owned: Array = economy.call(&"owned_instances", "iron_pick")
	_expect(owned.size() == 1 and String(owned[0].get("instance_id", "")) != old_id, "new unique output has one distinct identity")
	_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "crafted output passes A3 ownership audit")
	_expect(bool(save.call(&"reload_save")) and bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)),
		"consumed specimen and new output survive reload")


func _finish() -> void:
	if failures.is_empty():
		print("A0 A3 AUTHORITY PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 A3 AUTHORITY FAILED - %d/%d" % [failures.size(), checks])
		for failure: String in failures:
			print("  - " + failure)
		quit(1)
