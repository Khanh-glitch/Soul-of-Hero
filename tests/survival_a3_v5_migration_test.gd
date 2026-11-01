extends SceneTree
## V3→V5 migration against the actual SaveService. Synthetic data is limited to
## this migration test and is never evidence for the normal-input journey.
const Migration = preload("res://game/survival/economy/a0_world_slice_v5_migration.gd")
const Old = preload("res://game/survival/economy/vendor/a3_world_source_c23292be.gd")
const Adapter = preload("res://game/survival/economy/a0_economy_adapter.gd")
const Diff = preload("res://tests/fixtures/a0_save_diff.gd")
var checks := 0
var failures := 0

func _initialize() -> void:
	_run.call_deferred()

func _expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition: failures += 1
	print("  %s  %s" % ["ok  " if condition else "FAIL", label])

func _read(path: String) -> Variant:
	return Diff.read_json(path)

func _legacy_receipt(doc: Dictionary, poi: String, action: String, instance: String, key: String, right: String, event: String) -> void:
	var request := {"poi_id": poi, "action_id": action}
	if not instance.is_empty(): request["instance_id"] = instance
	# Exactly the V3 service's signed payload shape (no canonical key yet).
	var meta := {"a1_transaction_key": key, "poi_id": poi, "action_id": action, "instance_id": instance, "reward_right_id": right}
	var payload := {"request": request, "receipt_metadata": {"poi_id": poi, "action_id": action, "instance_id": instance}}
	meta.merge({"kind": "survival_economy", "operation": "world_action", "event_id": event, "payload_sha256": JSON.stringify(payload).sha256_text()})
	doc.applied_transactions["soh.a3.world_action." + event.sha256_text()] = {"applied_at_unix": 1700000000, "metadata": meta}

func _run() -> void:
	var save := root.get_node("SaveService")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	var path := "user://tests/a3v5_migration_%d.json" % Time.get_ticks_usec()
	_expect(bool(save.call(&"configure_storage", path, true)), "real isolated SaveService profile")
	var bindings: Variant = _read(Migration.OLD_BINDINGS)
	_expect(bindings is Dictionary, "legacy exact-source bindings load")
	if not bindings is Dictionary:
		_finish(); return
	var fixture: Dictionary = save.call(&"get_snapshot")
	fixture.world_slice = Old.empty_state(bindings)
	var world: Dictionary = fixture.world_slice
	var poi: Dictionary = world.pois.poi_crown_waystation
	world.capabilities = ["cap_salvage"]
	world.clock = {"latest_session_index": 3, "session_id": "old-session", "sequence": 17, "active_seconds": 120, "host_active_seconds": 120}
	poi.discovered = true
	poi.locker_opened = true
	poi.cache_claim_count = 1
	poi.cache_next_ready_active_tick = 1800
	poi.last_transaction_key = "a1slice:poi_crown_waystation:cache_restock:1"
	poi.reward_receipts = {"a1slice:poi_crown_waystation:pry_locker:1": "rr_waystation_salvage_tool", "a1slice:poi_crown_waystation:cache_restock:1": "rr_waystation_cache_claim"}
	_legacy_receipt(fixture, "poi_crown_waystation", "pry_locker", "", "a1slice:poi_crown_waystation:pry_locker:1", "rr_waystation_salvage_tool", "legacy.locker")
	_legacy_receipt(fixture, "poi_crown_waystation", "cache_restock", "node_waystation_cache", "a1slice:poi_crown_waystation:cache_restock:1", "rr_waystation_cache_claim", "legacy.cache")
	var intact := fixture.duplicate(true)
	var candidate := fixture.duplicate(true)
	var result: Dictionary = Migration.migrate(candidate)
	_expect(bool(result.get("ok", false)) and bool(result.get("changed", false)), "valid V3 world/receipts migrate additively")
	_expect(candidate.world_slice.clock == intact.world_slice.clock and candidate.applied_transactions == intact.applied_transactions and candidate.revision == intact.revision, "migration preserves clock, revision, signed receipts")
	_expect(candidate.world_slice.pois.poi_crown_waystation.cache_claim_count == 1 and candidate.world_slice.pois.poi_crown_waystation.cache_next_ready_active_tick == 1800, "claim generation and remaining cooldown preserved")
	_expect(candidate.world_slice.pois.poi_crown_waystation.roadside_salvage_02_claim_count == 0, "new source begins unclaimed without a grant")
	var repeat := Migration.migrate(candidate)
	_expect(bool(repeat.get("ok", false)) and not bool(repeat.get("changed", true)), "migration is idempotent")
	var bad := intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.cache_claim_count = 2
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "stale claim counter rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.reward_receipts["a1slice:poi_crown_waystation:cache_restock:1"] = "wrong_right"
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "corrupt right rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.reward_receipts["foreign:claim:1"] = "fake"
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "foreign claim rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.cache_next_ready_active_tick = INF
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "nonfinite clock/cooldown rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.cache_claim_count = 9007199254740993
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "inexact JSON integer and unbounded count rejected")
	bad = intact.duplicate(true)
	bad.world_slice.clock.host_active_seconds = -4
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "negative host clock rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.locker_opened = "true"
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "coerced action flag rejected")
	bad = intact.duplicate(true)
	bad.world_slice.capabilities = ["cap_salvage", "cap_foreign"]
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "foreign capability rejected")
	bad = intact.duplicate(true)
	bad.world_slice.pois.poi_crown_waystation.roadside_notes_01_claim_count = 0
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "partial V5 namespace rejected, not repaired")
	bad = intact.duplicate(true)
	var tx_id := "soh.a3.world_action." + "legacy.cache".sha256_text()
	bad.applied_transactions[tx_id].metadata.instance_id = "foreign_alias"
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "foreign source alias in old receipt rejected")
	bad = intact.duplicate(true)
	bad.applied_transactions[tx_id].metadata.payload_sha256 = "forged"
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "altered legacy event signature rejected")
	bad = intact.duplicate(true)
	bad.applied_transactions.erase(tx_id)
	_expect(not bool(Migration.migrate(bad).get("ok", true)), "missing old durable receipt rejected")
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(intact, "\t", true, true)); file.close()
	_expect(bool(save.call(&"reload_save")), "actual SaveService migrates legacy primary on reload")
	var reloaded: Dictionary = save.call(&"get_snapshot")
	_expect(int(reloaded.world_slice.pois.poi_crown_waystation.cache_claim_count) == 1 and int(reloaded.world_slice.clock.active_seconds) == 120 and int(reloaded.world_slice.pois.poi_crown_waystation.cache_next_ready_active_tick) == 1800, "SaveService preserves claim and no offline time")
	_expect((reloaded.applied_transactions as Dictionary).size() == (intact.applied_transactions as Dictionary).size(), "all signed receipts survive disk migration")
	var disk: Variant = _read(path)
	var backup: Variant = _read(path + ".bak")
	_expect(disk is Dictionary and disk.world_slice.pois.poi_crown_waystation.has("roadside_notes_01_claim_count"), "migration persisted to primary")
	_expect(backup is Dictionary and not backup.world_slice.pois.poi_crown_waystation.has("roadside_notes_01_claim_count"), "pre-migration primary preserved as backup")
	var adapter := Adapter.new()
	var port: Node = save.call(&"create_pinned_economy_port", adapter)
	_expect(port != null and bool(adapter.call(&"configure", port)), "V5 adapter binds real SaveService after migration")
	if port != null:
		var totals_before_replay: Dictionary = save.call(&"inventory_totals")
		var receipts_before_replay: Dictionary = (save.call(&"get_snapshot") as Dictionary).get("applied_transactions", {})
		var replay: Dictionary = adapter.call(&"world_action", {"poi_id":"poi_crown_waystation", "action_id":"cache_restock", "instance_id":"node_waystation_cache"}, "legacy.cache")
		print("A0_V5_REPLAY %s" % str(replay))
		var after_replay: Dictionary = save.call(&"inventory_totals")
		_expect(bool(replay.get("duplicate", false)) and str(replay.get("result", "")) == "ALREADY_APPLIED" and str(replay.get("transaction_key", "")) == "a1slice:poi_crown_waystation:cache_restock:1", "identical legacy event stays idempotent after V5")
		_expect(after_replay == totals_before_replay and (save.call(&"get_snapshot") as Dictionary).applied_transactions == receipts_before_replay, "idempotent replay grants nothing and adds no receipt")
		var conflict: Dictionary = adapter.call(&"world_action", {"poi_id":"poi_crown_waystation", "action_id":"cache_restock", "instance_id":"si:r_ashen_crown:waystation_cache:01"}, "legacy.cache")
		_expect(not bool(conflict.get("ok", true)) and str(conflict.get("reason", "")) == "event_id_conflict", "reused event id for a different request fails closed")
	# Simulated process boundaries, not power-loss/fsync proof. Each starts with
	# identical V3 bytes and must preserve a copy before retrying the migration.
	if OS.get_cmdline_user_args().has("--survival-save-fault-test"):
		var serial := JSON.stringify(intact, "\t", true, true)
		for boundary: String in ["after_temporary", "after_backup", "after_primary_removed", "after_primary_renamed"]:
			var fault_path := path + "." + boundary + ".json"
			var out := FileAccess.open(fault_path, FileAccess.WRITE)
			out.store_string(serial); out.close()
			_expect(bool(save.call(&"configure_storage", fault_path, false)) and bool(save.call(&"configure_test_save_interruption", boundary)), "armed migration fault " + boundary)
			_expect(not bool(save.call(&"reload_save")) and bool((save.call(&"get_economy_quarantine") as Dictionary).active), "failed migration quarantines " + boundary)
			var primary_bytes := FileAccess.get_file_as_string(fault_path) if FileAccess.file_exists(fault_path) else ""
			var backup_bytes := FileAccess.get_file_as_string(fault_path + ".bak") if FileAccess.file_exists(fault_path + ".bak") else ""
			_expect(primary_bytes == serial or backup_bytes == serial, "V3 original survives " + boundary)
			_expect(bool(save.call(&"reload_save")), "retry/recovery succeeds " + boundary)
			var recovered: Dictionary = save.call(&"get_snapshot")
			_expect(int(recovered.world_slice.pois.poi_crown_waystation.cache_claim_count) == 1 and (recovered.applied_transactions as Dictionary).size() == 2 and int(recovered.world_slice.clock.active_seconds) == 120, "recovery conserves claim, receipts and active clock " + boundary)
	var corrupt_path := path + ".corrupt.json"
	var corrupt := intact.duplicate(true)
	corrupt.world_slice.pois.poi_crown_waystation.reward_receipts["a1slice:poi_crown_waystation:cache_restock:1"] = "wrong_right"
	var corrupt_bytes := JSON.stringify(corrupt)
	var out := FileAccess.open(corrupt_path, FileAccess.WRITE)
	out.store_string(corrupt_bytes); out.close()
	_expect(not bool(save.call(&"configure_storage", corrupt_path, true)) and bool((save.call(&"get_economy_quarantine") as Dictionary).active), "corrupt primary quarantined instead of default/backup overwrite")
	_expect(FileAccess.get_file_as_string(corrupt_path) == corrupt_bytes, "corrupt primary bytes remain available for recovery")
	# Decoder type restoration must fail closed rather than coerce.
	var coercion := intact.duplicate(true)
	coercion.world_slice.pois.poi_crown_waystation.cache_claim_count = 1.5
	_expect(not Migration.normalize_numbers(coercion).is_empty() or str(Migration.migrate(coercion).get("error", "")) != "", "fractional claim count rejected, never truncated")
	var huge := intact.duplicate(true)
	huge.world_slice.clock.active_seconds = 9007199254740993.0
	_expect(not Migration.normalize_numbers(huge).is_empty(), "integer beyond exact float range rejected")
	var meta_bad := intact.duplicate(true)
	meta_bad.applied_transactions[tx_id].metadata.quantity = 2.5
	_expect(not Migration.normalize_numbers(meta_bad).is_empty(), "fractional ledger quantity rejected")
	var restored: Dictionary = candidate.duplicate(true)
	restored.world_slice.clock.active_seconds = 120.0
	restored.applied_transactions[tx_id].applied_at_unix = 1700000000.0
	restored.revision = 2.0
	var norm_error: String = Migration.normalize_numbers(restored)
	print("A0_NORMALIZE error=%s types=%s/%s/%s" % [norm_error, type_string(typeof(restored.world_slice.clock.active_seconds)), type_string(typeof(restored.applied_transactions[tx_id].applied_at_unix)), type_string(typeof(restored.revision))])
	_expect(norm_error.is_empty() and typeof(restored.world_slice.clock.active_seconds) == TYPE_INT and typeof(restored.applied_transactions[tx_id].applied_at_unix) == TYPE_INT and typeof(restored.revision) == TYPE_INT, "whole JSON numbers restored to exact ints")
	_finish()

func _finish() -> void:
	print("A0 A3 V5 MIGRATION %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
