extends SceneTree
## C08 TRACE STORE — bounded evidence index unit gate (synthetic samples only).
##
## This is NOT gameplay acceptance. It exercises the index contract that the
## native causal gate (`survival_c08_trace_causality_test.gd`) then uses with a
## real body, a real run clock and real surfaces. Every case here is a negative
## control for one way a footprint trail could lie:
##
##   * a link across a movement gap, a clock rollback, a death or a missing
##     surface must never be created;
##   * an expired record must never be readable, and must never be re-linked;
##   * a query must stay local, bounded and deterministically ordered;
##   * a different run must never inherit evidence;
##   * non-finite input must not poison the spatial index;
##   * a very long walk must stay inside the storage bound.
##
## Run: godot --headless --path . --script res://tests/c08_trace_store_unit_test.gd

const Store := preload("res://game/survival/c08_trace_store.gd")

var failures: Array[String] = []
var checks := 0


func _initialize() -> void:
	_case_chain_identity()
	_case_expiry()
	_case_breaks()
	_case_run_isolation()
	_case_query_bounds()
	_case_eviction()
	_case_non_finite()
	_case_prune()
	_case_ledger()
	_report()


func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)


func _report() -> void:
	if failures.is_empty():
		print("\nC08 TRACE STORE UNIT PASSED - %d checks" % checks)
		quit(0)
		return
	print("\nC08 TRACE STORE UNIT FAILED - %d/%d" % [failures.size(), checks])
	for failure: String in failures:
		print("  - %s" % failure)
	quit(1)


func _case_chain_identity() -> void:
	var store = Store.new()
	store.reset("run-a")
	_expect(store.sample(Vector2.ZERO, 1.0, "grass", true, 10.0, 60.0, 20.0) == 0,
		"the first sample positions the body and writes no record")
	var first: int = store.sample(Vector2(10, 0), 2.0, "grass", true, 10.0, 60.0, 20.0)
	var second: int = store.sample(Vector2(20, 0), 3.0, "grass", true, 10.0, 60.0, 20.0)
	_expect(first == 1 and second == 2, "records are created in order (%d, %d)" % [first, second])
	_expect(int(store.successor(first, 3.0).get("id", 0)) == second,
		"the successor is the causal next link")
	_expect(store.successor(second, 3.0).is_empty(), "the newest record has no successor")
	_expect(String(store.trace(first, 3.0).get("surface", "")) == "grass",
		"each record keeps the caller's K2 surface identity")
	_expect(int(store.trace(first, 3.0).get("previous", -1)) == 0,
		"the first record is a chain head")
	_expect(store.live_count(3.0) == 2 and store.total_count() == 2,
		"live and total counts agree at the same instant")
	_expect(store.sample(Vector2(25, 0), 4.0, "grass", true, 10.0, 60.0, 20.0) == 0,
		"a step shorter than the spacing writes no record")
	var third: int = store.sample(Vector2(40, 0), 5.0, "grass", true, 10.0, 60.0, 20.0)
	_expect(third > second, "the accumulated distance finally crosses the spacing")


func _case_expiry() -> void:
	var store = Store.new()
	store.reset("run-expiry")
	store.sample(Vector2.ZERO, 10.0, "moor", true, 5.0, 10.0, 20.0)
	var a: int = store.sample(Vector2(10, 0), 11.0, "moor", true, 5.0, 10.0, 20.0)
	var b: int = store.sample(Vector2(20, 0), 12.0, "moor", true, 5.0, 10.0, 20.0)
	_expect(a > 0 and b > 0, "two live records exist before expiry")
	_expect(not store.trace(a, 20.9).is_empty(), "a record is readable just before it expires")
	_expect(store.trace(a, 21.0).is_empty(), "a record is dead exactly at its expiry stamp")
	_expect(store.successor(a, 21.0).is_empty(), "an expired record yields no successor")
	_expect(store.live_count(22.5) == 0, "no record is live after every lifetime passed")
	_expect(store.total_count() == 2, "expiry is decided at read time, not by silent deletion")
	_expect(store.trace(a, 10.5).is_empty(), "a stamp before creation is not readable")


func _case_breaks() -> void:
	var store = Store.new()
	store.reset("run-breaks")
	store.sample(Vector2.ZERO, 1.0, "court", true, 10.0, 120.0, 20.0)
	var head: int = store.sample(Vector2(10, 0), 2.0, "court", true, 10.0, 120.0, 20.0)
	# A movement gap larger than one physics step is not a walk.
	store.sample(Vector2(400, 0), 3.0, "court", true, 10.0, 120.0, 20.0)
	var after_gap: int = store.sample(Vector2(410, 0), 4.0, "court", true, 10.0, 120.0, 20.0)
	_expect(after_gap > head, "the walk continues after the gap")
	_expect(store.successor(head, 4.0).is_empty(), "no link bridges a movement gap")
	_expect(int(store.trace(after_gap, 4.0).get("previous", -1)) == 0,
		"the first record after a gap starts a new chain")
	# A clock that moves backwards cannot be evidence: the refused sample re-seeds
	# the body, and the record after it is a new chain head.
	store.sample(Vector2(420, 0), 5.0, "court", true, 10.0, 120.0, 20.0)
	var last_before_rollback := store.last_id()
	_expect(store.sample(Vector2(430, 0), 4.5, "court", true, 10.0, 120.0, 20.0) == 0,
		"a backwards stamp writes no record")
	var after_rollback: int = store.sample(Vector2(440, 0), 4.6, "court", true, 10.0, 120.0, 20.0)
	_expect(after_rollback > 0 and int(store.trace(after_rollback, 4.6).get("previous", -1)) == 0,
		"the record after a rollback starts a new chain")
	_expect(store.successor(last_before_rollback, 5.1).is_empty(),
		"the rollback never links the new chain to the old one")
	# Ineligible motion (death / interior / unknown surface) writes nothing.
	var before: int = store.total_count()
	_expect(store.sample(Vector2(440, 0), 6.0, "court", false, 10.0, 120.0, 20.0) == 0,
		"an ineligible sample writes no record")
	_expect(store.sample(Vector2(450, 0), 6.1, "", true, 10.0, 120.0, 20.0) == 0,
		"a sample with no surface identity writes no record")
	_expect(store.total_count() == before, "refused samples change no storage")
	_expect(store.sample(Vector2(460, 0), 6.2, "court", true, 10.0, 120.0, 20.0) == 0,
		"the sample right after a refusal only re-seeds the body")
	var after_refusal: int = store.sample(Vector2(470, 0), 6.3, "court", true, 10.0, 120.0, 20.0)
	_expect(after_refusal > 0 and int(store.trace(after_refusal, 6.3).get("previous", -1)) == 0,
		"movement after an ineligible sample starts a new chain")


func _case_run_isolation() -> void:
	var store = Store.new()
	store.reset("run-one")
	store.sample(Vector2.ZERO, 1.0, "grass", true, 5.0, 120.0, 20.0)
	var id: int = store.sample(Vector2(10, 0), 2.0, "grass", true, 5.0, 120.0, 20.0)
	_expect(id > 0 and store.live_count(2.0) == 1, "run one has evidence")
	store.reset("run-two")
	_expect(store.total_count() == 0, "a new run starts with no evidence")
	_expect(store.trace(id, 2.0).is_empty(), "a previous run's id is unreadable")
	_expect(store.nearby(Vector2(10, 0), 128.0, 2.0).is_empty(), "a previous run's position is unreadable")
	store.sample(Vector2(10, 0), 3.0, "grass", true, 5.0, 120.0, 20.0)
	var fresh: int = store.sample(Vector2(20, 0), 4.0, "grass", true, 5.0, 120.0, 20.0)
	_expect(fresh > 0 and int(store.trace(fresh, 4.0).get("previous", -1)) == 0,
		"the new run's first record is not linked to the old run")


func _case_query_bounds() -> void:
	var store = Store.new()
	store.reset("run-query")
	for index in range(10):
		store.sample(Vector2(index * 6, 0), 1.0 + float(index) * 0.1, "court", true, 5.0, 120.0, 20.0)
	var near: Array = store.nearby(Vector2(27, 0), 16.0, 3.0)
	_expect(near.size() >= 2, "a local query returns the nearby records (%d)" % near.size())
	var newest_first := true
	for index in range(1, near.size()):
		if int(near[index].id) > int(near[index - 1].id):
			newest_first = false
	_expect(newest_first, "query results are newest-first")
	_expect(store.nearby(Vector2(27, 0), 129.0, 3.0).is_empty(),
		"a radius beyond the locality cap is refused rather than answered")
	_expect(store.nearby(Vector2(27, 0), -1.0, 3.0).is_empty(), "a negative radius is refused")
	_expect(store.nearby(Vector2(27, 0), 16.0, 999.0).is_empty(), "an expired query returns nothing")
	# Result cap: many records inside one radius.
	var dense = Store.new()
	dense.reset("run-dense")
	for index in range(80):
		dense.sample(Vector2(float(index), 0), 1.0 + float(index) * 0.01, "court", true, 0.5, 600.0, 20.0)
	_expect(dense.nearby(Vector2(40, 0), 128.0, 5.0).size() <= Store.MAX_QUERY_RESULTS,
		"the query result is capped at MAX_QUERY_RESULTS (%d)" % Store.MAX_QUERY_RESULTS)


func _case_eviction() -> void:
	var store = Store.new()
	store.reset("run-long")
	var written := 0
	for index in range(Store.MAX_TRACES + 200):
		var id: int = store.sample(Vector2(float(index) * 6.0, 0), 1.0 + float(index) * 0.01,
			"court", true, 5.0, 900.0, 20.0)
		if id > 0:
			written += 1
	_expect(written > Store.MAX_TRACES, "a long walk writes far more records than the bound (%d)" % written)
	_expect(store.total_count() <= Store.MAX_TRACES,
		"storage stays inside MAX_TRACES (%d <= %d)" % [store.total_count(), Store.MAX_TRACES])
	_expect(store.trace(1, 30.0).is_empty(), "the oldest records were evicted")
	_expect(not store.trace(store.last_id(), 30.0).is_empty(), "the newest record survives eviction")
	_expect(store.nearby(Vector2(0, 0), 128.0, 30.0).size() <= Store.MAX_QUERY_RESULTS,
		"the evicted range is not resurrected by a query")


func _case_non_finite() -> void:
	var store = Store.new()
	store.reset("run-nan")
	store.sample(Vector2.ZERO, 1.0, "court", true, 5.0, 60.0, 20.0)
	var good: int = store.sample(Vector2(10, 0), 2.0, "court", true, 5.0, 60.0, 20.0)
	_expect(good > 0, "a valid record exists before the hostile input")
	_expect(store.sample(Vector2(NAN, 0), 3.0, "court", true, 5.0, 60.0, 20.0) == 0,
		"a non-finite position is refused")
	_expect(store.sample(Vector2(20, 0), NAN, "court", true, 5.0, 60.0, 20.0) == 0,
		"a non-finite stamp is refused")
	_expect(store.sample(Vector2(20, 0), 3.0, "court", true, NAN, 60.0, 20.0) == 0,
		"a non-finite spacing is refused")
	_expect(store.nearby(Vector2(NAN, 0), 16.0, 3.0).is_empty(),
		"a non-finite query position returns nothing instead of corrupting a bucket")
	_expect(store.nearby(Vector2(10, 0), 16.0, 3.0).size() >= 1,
		"the index still answers a valid query after hostile input")
	_expect(store.sample(Vector2(30, 0), 3.1, "court", true, 5.0, 60.0, 20.0) == 0,
		"the chain was broken by the refused samples, so there is no jump link")


## K8 ledger: live evidence survives a process, dead evidence does not, and a
## foreign run can never read it back. Synthetic input; the native gate proves the
## save round trip with a real body.
func _case_ledger() -> void:
	var store = Store.new()
	store.reset("run-ledger")
	store.sample(Vector2.ZERO, 1.0, "grass", true, 5.0, 300.0, 20.0)
	var a: int = store.sample(Vector2(10, 0), 2.0, "grass", true, 5.0, 300.0, 20.0)
	var b: int = store.sample(Vector2(20, 0), 3.0, "grass", true, 5.0, 300.0, 20.0)
	var ledger: Dictionary = store.export_ledger(4.0)
	_expect(String(ledger.get("schema", "")) == Store.LEDGER_SCHEMA, "the ledger names its own schema")
	_expect((ledger.get("marks", []) as Array).size() == 2, "the ledger holds only live marks")
	var restored = Store.new()
	restored.reset("run-ledger")
	var count: int = restored.import_ledger(ledger, 5.0)
	_expect(count == 2 and restored.live_count(5.0) == 2, "a same-run ledger restores exactly its live marks")
	_expect(int(restored.successor(a, 5.0).get("id", 0)) == b,
		"the restored chain keeps its causal link")
	_expect(restored.total_count() == 2, "the restore creates no extra record")
	# A mark that expired while the game was closed is not evidence any more.
	var later = Store.new()
	later.reset("run-ledger")
	_expect(later.import_ledger(ledger, 400.0) == 0, "an expired ledger restores nothing")
	_expect(later.total_count() == 0, "an expired ledger leaves no phantom record")
	# A different run never inherits another run's trail.
	var foreign = Store.new()
	foreign.reset("run-other")
	_expect(foreign.import_ledger(ledger, 5.0) == 0, "a foreign run cannot import this ledger")
	# Malformed and orphaned marks are dropped, and an orphan cannot bridge a gap.
	var broken := ledger.duplicate(true)
	(broken["marks"] as Array).append([999, 30.0, 0.0, "grass", 3.5, 300.0, 12345])
	(broken["marks"] as Array).append([1000, NAN, 0.0, "grass", 3.5, 300.0, 0])
	(broken["marks"] as Array).append([1001, 40.0, 0.0, "grass", 900.0, 1200.0, 0])
	var hardened = Store.new()
	hardened.reset("run-ledger")
	var kept: int = hardened.import_ledger(broken, 5.0)
	_expect(kept == 2, "malformed, future and orphaned marks are dropped at import (%d kept)" % kept)
	_expect(hardened.trace(999, 5.0).is_empty() and hardened.trace(1001, 5.0).is_empty(),
		"no invented record survives the import")
	# The ledger is bounded even for an absurd source.
	var long_store = Store.new()
	long_store.reset("run-bound")
	for index in range(700):
		long_store.sample(Vector2(float(index) * 6.0, 0), 1.0 + float(index) * 0.01, "court", true, 5.0, 900.0, 20.0)
	var big: Dictionary = long_store.export_ledger(8.0)
	_expect((big.get("marks", []) as Array).size() <= Store.LEDGER_MAX_MARKS,
		"the exported ledger never exceeds LEDGER_MAX_MARKS (%d)" % (big.get("marks", []) as Array).size())


func _case_prune() -> void:
	var store = Store.new()
	store.reset("run-prune")
	store.sample(Vector2.ZERO, 1.0, "grass", true, 5.0, 10.0, 20.0)
	var a: int = store.sample(Vector2(10, 0), 2.0, "grass", true, 5.0, 10.0, 20.0)
	var c: int = store.sample(Vector2(20, 0), 30.0, "grass", true, 5.0, 40.0, 20.0)
	var b: int = store.sample(Vector2(30, 0), 31.0, "grass", true, 5.0, 40.0, 20.0)
	_expect(a > 0 and c > 0 and b > 0, "one expired and two live records exist")
	var dropped: int = store.prune(35.0)
	_expect(dropped == 1, "prune reclaims exactly the expired record (%d)" % dropped)
	_expect(store.trace(a, 35.0).is_empty() and not store.trace(b, 35.0).is_empty(),
		"prune keeps live evidence and forgets dead evidence")
	_expect(store.live_count(35.0) == 2 and store.total_count() == 2,
		"the live set is unchanged by pruning")
