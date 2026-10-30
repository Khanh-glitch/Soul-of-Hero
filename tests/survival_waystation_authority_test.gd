extends SceneTree
## Adversarial FIXTURE test of pinned A3 V3 + actual A0 SaveService. This does
## not prove player input, physical reach, production mount or OS restart.
const SaveDiff = preload("res://tests/fixtures/a0_save_diff.gd")
const SchemaOracle = preload("res://tests/fixtures/a0_waystation_schema_oracle.gd")
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
var save: Node
var adapter: RefCounted
var port: Node
var checks := 0
var failures: Array[String] = []
var cell := Vector2i(408, 199)
var fixture_session := "fixture-world"
var fixture_index := 0
var fixture_sequence := 0
var fixture_seconds := 0
var discovered := true

func _initialize() -> void:
	_run.call_deferred()

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok: failures.append(label)
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _host(poi: String) -> Dictionary:
	return {"contract": "soh.economy.world_host.v1", "poi_id": poi, "hero_cell": [cell.x, cell.y],
		"discovered": discovered, "session_index": fixture_index, "session_id": fixture_session,
		"sequence": fixture_sequence, "active_seconds": fixture_seconds, "world_revision": "fixture"}

func _generic_world_edit(doc: Dictionary) -> bool:
	doc["world_slice"] = {"capabilities": ["cap_salvage"]}
	return true

func _run() -> void:
	save = root.get_node("SaveService")
	var path := "user://tests/waystation_authority_%d.json" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	_expect(bool(save.call(&"configure_storage", path, true)), "real SaveService isolated disk")
	var old: Dictionary = save.call(&"get_snapshot")
	_expect(not bool(save.call(&"transact_once", "fixture.world.spoof", Callable(self, "_generic_world_edit"), {})), "generic transaction cannot create world rights")
	_expect((save.call(&"get_snapshot") as Dictionary) == old, "rejected generic edit leaves no receipt or mutation")
	adapter = Adapter.new()
	port = save.call(&"create_pinned_economy_port", adapter)
	_expect(port != null, "production A0 shim and exact A3 V3 SHA bind real facade")
	if port == null:
		_finish(); return
	_expect(bool(adapter.call(&"configure", port)), "A3 V3 catalogs and canonical bindings configure")
	adapter.call(&"configure_world_host", Callable(self, "_host"))
	var locker := {"poi_id": "poi_crown_waystation", "action_id": "pry_locker"}
	var cache := {"poi_id": "poi_crown_waystation", "action_id": "cache_restock", "instance_id": "node_waystation_cache"}
	discovered = false
	var r: Dictionary = adapter.call(&"world_action", locker, "fixture.undiscovered")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "NOT_DISCOVERED", "undiscovered physical right rejected")
	discovered = true
	cell = Vector2i(407, 199)
	r = adapter.call(&"world_action", locker, "fixture.wrong.cell")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "OUT_OF_RANGE", "wrong stand rejected")
	cell = Vector2i(408, 199)
	var totals: Dictionary = save.call(&"inventory_totals")
	r = adapter.call(&"world_action", locker, "fixture.locker")
	_expect(bool(r.get("ok", false)) and (save.call(&"inventory_totals") as Dictionary) == totals, "locker grants capability and zero items")
	cell = Vector2i(406, 202)
	r = adapter.call(&"world_action", cache, "fixture.cache")
	totals = save.call(&"inventory_totals")
	_expect(bool(r.get("ok", false)) and int(totals.get("iron_scrap", 0)) == 3 and int(totals.get("knowledge_spares", 0)) == 2, "A3 commits canonical cache reward")
	var committed: Dictionary = save.call(&"get_snapshot")
	var poi: Dictionary = ((committed.get("world_slice", {}) as Dictionary).get("pois", {}) as Dictionary).get("poi_crown_waystation", {})
	_expect((poi.get("reward_receipts", {}) as Dictionary).has("a1slice:poi_crown_waystation:cache_restock:1"), "same candidate records canonical receipt")
	_expect(not bool(save.call(&"transact_once", "fixture.world.erase", Callable(self, "_generic_world_edit"), {})), "generic transaction cannot overwrite granted world rights")
	r = adapter.call(&"world_action", cache, "fixture.cache")
	_expect((save.call(&"inventory_totals") as Dictionary) == totals, "replayed original event grants nothing")
	r = adapter.call(&"world_action", cache, "fixture.cache.new")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "COOLDOWN" and (save.call(&"inventory_totals") as Dictionary) == totals, "new event cannot bypass cooldown")
	var disk: Variant = SaveDiff.read_json(path)
	SaveDiff.report_all("waystation-commit-memory-vs-disk", committed, disk)
	_expect(bool(save.call(&"reload_save")), "disk reload succeeds")
	var loaded: Dictionary = save.call(&"get_snapshot")
	var bindings: Dictionary = adapter.call(&"world_bindings")
	_trace_fields("commit-memory", committed)
	_trace_fields("commit-disk", disk)
	_trace_fields("commit-reloaded", loaded)
	_expect(SchemaOracle.equivalent(committed, disk, bindings, true), "partial schema diagnostic: exact values and valid raw-disk types")
	_expect(SchemaOracle.equivalent(committed, loaded, bindings), "partial schema diagnostic: exact values and valid prepared types")
	var changed_qty := loaded.duplicate(true)
	changed_qty.inventory.item_stacks.iron_scrap.quantity = 4
	_expect(not SchemaOracle.equivalent(committed, changed_qty, bindings), "partial schema diagnostic rejects changed item quantity")
	var changed_claim := loaded.duplicate(true)
	var changed_receipts: Dictionary = changed_claim.world_slice.pois.poi_crown_waystation.reward_receipts
	changed_receipts.erase("a1slice:poi_crown_waystation:cache_restock:1")
	changed_receipts["a1slice:poi_crown_waystation:cache_restock:2"] = "rr_waystation_cache_claim"
	_expect(not SchemaOracle.equivalent(committed, changed_claim, bindings), "partial schema diagnostic rejects changed canonical claim id")
	var bad_native_type := loaded.duplicate(true)
	bad_native_type.inventory.item_stacks.iron_scrap.quantity = 3.0
	_expect(not SchemaOracle.equivalent(committed, bad_native_type, bindings), "prepared inventory quantity must remain an int")
	var too_large := loaded.duplicate(true)
	too_large.revision = 9007199254740993
	_expect(not SchemaOracle.equivalent(committed, too_large, bindings), "partial schema diagnostic rejects integers outside JSON exact range")
	var missing := loaded.duplicate(true)
	missing.world_slice.pois.poi_crown_waystation.erase("cache_claim_count")
	_expect(not SchemaOracle.equivalent(committed, missing, bindings), "partial schema diagnostic rejects missing field")
	var ordered := loaded.duplicate(true)
	ordered.world_slice.capabilities = ["cap_salvage", "cap_seal_1"]
	var reordered := ordered.duplicate(true)
	reordered.world_slice.capabilities = ["cap_seal_1", "cap_salvage"]
	_expect(not SchemaOracle.equivalent(ordered, reordered, bindings), "partial schema diagnostic rejects reordered capability array")
	var not_finite := loaded.duplicate(true)
	not_finite["settings"]["master_volume"] = INF
	_expect(not SchemaOracle.equivalent(committed, not_finite, bindings), "partial schema diagnostic rejects non-finite numbers")
	SaveDiff.report_all("waystation-commit-memory-vs-reloaded", committed, loaded)
	SaveDiff.report_all("waystation-commit-disk-vs-reloaded", disk, loaded)
	_expect(loaded.get("world_slice", {}) == committed.get("world_slice", {}) and loaded.get("inventory", {}) == committed.get("inventory", {}) and loaded.get("applied_transactions", {}) == committed.get("applied_transactions", {}), "same-process disk reload preserves custody and rights")
	fixture_index += 1
	fixture_session = "fixture-world-after-reload"
	fixture_sequence = 0
	fixture_seconds = 0
	r = adapter.call(&"world_action", cache, "fixture.restart")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "COOLDOWN" and (save.call(&"inventory_totals") as Dictionary) == totals, "new session grants no offline cooldown")
	# Adversarial fixture clock; this is NOT claimed as ordinary player time.
	r = adapter.call(&"advance_world_time", "poi_crown_waystation", "fixture.clock.baseline")
	_expect(bool(r.get("ok", false)), "new fixture session establishes non-retroactive baseline")
	fixture_seconds = 1800
	fixture_sequence += 1
	r = adapter.call(&"advance_world_time", "poi_crown_waystation", "fixture.clock.ready")
	_expect(bool(r.get("ok", false)), "fixture advances exactly one canonical cooldown")
	_expect(bool(save.call(&"grant_inventory_item", "iron_scrap", "material", 47, "fixture.fill.scrap")), "fixture fills partial scrap stack")
	_expect(bool(save.call(&"grant_inventory_item", "knowledge_spares", "material", 48, "fixture.fill.spares")), "fixture fills partial spares stack")
	var added := 0
	for n in range(35):
		if not bool(save.call(&"grant_inventory_item", "stone_chunk", "material", 50, "fixture.fill.%d" % n)):
			break
		added += 1
	_expect(added >= 2, "fixture fills remaining bag slots")
	var full: Dictionary = save.call(&"get_snapshot")
	r = adapter.call(&"world_action", cache, "fixture.full")
	_expect(not bool(r.get("ok", false)) and String(r.get("reason", "")) == "inventory_full" and (save.call(&"get_snapshot") as Dictionary) == full, "full bag refuses entire reward without cooldown or receipt")
	_expect(bool(save.call(&"consume_inventory_item", "stone_chunk", 100, "fixture.free.two")), "fixture frees two complete stack slots")
	var before_fault: Dictionary = save.call(&"get_snapshot")
	var before_fault_disk: Variant = SaveDiff.read_json(path)
	SaveDiff.report_all("waystation-pre-fault-memory-vs-disk", before_fault, before_fault_disk)
	_expect(bool(save.call(&"configure_test_save_interruption", "after_temporary")), "debug-only temporary-write interruption armed")
	r = adapter.call(&"world_action", cache, "fixture.interrupted")
	_expect(not bool(r.get("ok", false)) and (save.call(&"get_snapshot") as Dictionary) == before_fault, "interrupted candidate leaves memory unchanged")
	var after_fault_disk: Variant = SaveDiff.read_json(path)
	SaveDiff.report_all("waystation-fault-disk-before-vs-after", before_fault_disk, after_fault_disk)
	var fault_reload := bool(save.call(&"reload_save"))
	var fault_reloaded: Dictionary = save.call(&"get_snapshot")
	SaveDiff.report_all("waystation-fault-memory-vs-reloaded", before_fault, fault_reloaded)
	SaveDiff.report_all("waystation-fault-disk-vs-reloaded", after_fault_disk, fault_reloaded)
	_expect(fault_reload and fault_reloaded == before_fault, "interrupted candidate leaves disk unchanged")
	r = adapter.call(&"world_action", cache, "fixture.interrupted")
	_expect(bool(r.get("ok", false)), "same event safely succeeds after interrupted write")
	var after_retry: Dictionary = save.call(&"inventory_totals")
	_expect(int(after_retry.get("iron_scrap", 0)) == 53 and int(after_retry.get("knowledge_spares", 0)) == 52, "retry grants each reward exactly once")
	fixture_seconds = 3600
	fixture_sequence += 1
	r = adapter.call(&"advance_world_time", "poi_crown_waystation", "fixture.clock.second.ready")
	_expect(bool(r.get("ok", false)), "fixture advances second canonical cooldown")
	# Free the partially filled newly granted stacks and two more slots before
	# the ambiguous rename test; this is deliberately test-funded, not gameplay.
	_expect(bool(save.call(&"consume_inventory_item", "stone_chunk", 100, "fixture.free.more")), "fixture leaves enough capacity for next claim")
	_expect(bool(save.call(&"configure_test_save_interruption", "after_primary_renamed")), "debug-only post-rename interruption armed")
	r = adapter.call(&"world_action", cache, "fixture.renamed")
	_expect(not bool(r.get("ok", false)), "ambiguous post-rename call does not report success")
	_expect(bool(save.call(&"reload_save")), "authoritative disk reload resolves post-rename result")
	var durable: Dictionary = save.call(&"inventory_totals")
	_expect(int(durable.get("iron_scrap", 0)) == 56 and int(durable.get("knowledge_spares", 0)) == 54, "post-rename disk contains exactly one committed reward")
	r = adapter.call(&"world_action", cache, "fixture.renamed")
	_expect((save.call(&"inventory_totals") as Dictionary) == durable, "post-rename retry cannot grant the same reward twice")
	await _audit_rebuild(durable)
	_finish()

func _audit_rebuild(before_totals: Dictionary) -> void:
	var before: Dictionary = save.call(&"get_snapshot")
	var packed := load("res://game/overworld/chapter1_overworld.tscn") as PackedScene
	_expect(packed != null, "actual overworld scene available for reconstruction")
	if packed == null: return
	var host := Node2D.new()
	root.add_child(host)
	var world := packed.instantiate()
	host.add_child(world)
	world.call(&"configure", {})
	var deadline := Time.get_ticks_msec() + 90000
	while Time.get_ticks_msec() < deadline and not bool(world.call(&"is_world_ready")) and String(world.get(&"build_error")).is_empty():
		await process_frame
	_expect(bool(world.call(&"is_world_ready")), "actual overworld rebuild completes after disk reload")
	var after: Dictionary = save.call(&"get_snapshot")
	_trace_fields("rebuild-before", before)
	_trace_fields("rebuild-after", after)
	for key: String in ["inventory", "world_slice", "applied_transactions"]:
		SaveDiff.report_all("waystation-rebuild-" + key, before.get(key), after.get(key))
	_expect((save.call(&"inventory_totals") as Dictionary) == before_totals, "rebuild preserves exact material totals")
	_expect(Diff_values_same(before.get("world_slice"), after.get("world_slice")) and Diff_values_same(before.get("applied_transactions"), after.get("applied_transactions")), "rebuild retains source rights and receipt values")
	host.queue_free()
	await process_frame

func Diff_values_same(a: Variant, b: Variant) -> bool:
	for entry: String in SaveDiff.collect(a, b):
		if not entry.begins_with("TYPE "): return false
	return true

func _trace_fields(label: String, raw: Variant) -> void:
	if not raw is Dictionary: return
	var d: Dictionary = raw
	var world: Dictionary = d.get("world_slice", {})
	var clock: Dictionary = world.get("clock", {})
	var poi: Dictionary = (world.get("pois", {}) as Dictionary).get("poi_crown_waystation", {})
	var stacks: Dictionary = (d.get("inventory", {}) as Dictionary).get("item_stacks", {})
	for pair: Array in [["revision", d.get("revision")], ["clock.active_seconds", clock.get("active_seconds")], ["clock.host_active_seconds", clock.get("host_active_seconds")], ["clock.sequence", clock.get("sequence")], ["clock.latest_session_index", clock.get("latest_session_index")], ["clock.session_id", clock.get("session_id")], ["capabilities", world.get("capabilities")], ["cache_claim_count", poi.get("cache_claim_count")], ["cache_next_ready_active_tick", poi.get("cache_next_ready_active_tick")], ["last_transaction_key", poi.get("last_transaction_key")], ["reward_receipts", poi.get("reward_receipts")], ["iron_scrap", stacks.get("iron_scrap")], ["knowledge_spares", stacks.get("knowledge_spares")]]:
		print("A0_FIELD %s %s %s %s" % [label, pair[0], type_string(typeof(pair[1])), var_to_str(pair[1])])
	print("A0_FIELD %s applied_transaction_keys %s" % [label, str((d.get("applied_transactions", {}) as Dictionary).keys())])

func _finish() -> void:
	print("A0 WAYSTATION AUTHORITY %s - %d checks (FIXTURE)" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)
