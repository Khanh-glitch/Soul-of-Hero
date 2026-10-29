extends SceneTree
## Real SaveService + immutable A3 86dc2195 adapter with a narrowly scoped A0
## shim. Station is an explicit fixture; these tests do not certify E-02.
const PinnedEconomy = preload("res://tests/fixtures/a3_86dc2195/adapter/a0_authorized_economy.gd")
var save: Node
var economy: RefCounted
var port: Node
var checks := 0
var failures: Array[String] = []
var lab_enabled := true

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
	if id != "lab" or not lab_enabled:
		return {}
	return {"ok": true, "station_id": "lab", "kind": "research", "tier": 1,
		"queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "fixture-r1"}

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
	for mode: String in ["quantity", "kind", "orphan", "duplicate", "schema"]:
		var corrupt := safe.duplicate(true)
		if mode == "schema":
			corrupt["survival_economy"]["schema"] = 999
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
		_expect(FileAccess.get_file_as_string(path) == bytes, "malformed bytes are not replaced: " + mode)
		var repair := FileAccess.open(path, FileAccess.WRITE)
		repair.store_string(JSON.stringify(safe, "\t") + "\n")
		repair.close()
		_expect(bool(save.call(&"reload_save")), "explicitly restored file reloads: " + mode)
		_expect(bool((economy.call(&"ownership_audit") as Dictionary).get("ok", false)), "restored pair remains auditable: " + mode)
	_finish()

func _finish() -> void:
	if failures.is_empty():
		print("A0 A3 AUTHORITY PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 A3 AUTHORITY FAILED - %d/%d" % [failures.size(), checks])
		for failure: String in failures:
			print("  - " + failure)
		quit(1)
