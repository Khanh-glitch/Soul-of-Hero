extends SceneTree
## Test the diagnostic independently; no approximate numeric comparisons.
const Diff = preload("res://tests/fixtures/a0_save_diff.gd")
var failures := 0
var checks := 0

func _initialize() -> void:
	_run.call_deferred()

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
	print("  %s  %s" % ["ok  " if ok else "FAIL", label])

func _run() -> void:
	_check(Diff.collect({"a": [1, {"b": "v"}]}, {"a": [1, {"b": "v"}]}).is_empty(), "equal nested state")
	var numeric: Array[String] = Diff.collect({"quantity": 2}, {"quantity": 2.0})
	_check(numeric.size() == 1 and numeric[0].begins_with("TYPE $.quantity"), "equal int and float are recorded as type only")
	var changed: Array[String] = Diff.collect({"quantity": 2}, {"quantity": 3.0})
	_check(changed.size() == 1 and changed[0].begins_with("VALUE $.quantity"), "changed numeric value is not hidden")
	var precision: Array[String] = Diff.collect({"n": 9007199254740993}, {"n": 9007199254740992.0})
	_check(precision.size() == 1 and precision[0].begins_with("VALUE $.n"), "loss beyond 2^53 is a value error")
	var missing: Array[String] = Diff.collect({"a": 1}, {"b": 1})
	_check(missing.size() == 2 and missing[0].begins_with("VALUE ") and missing[1].begins_with("VALUE "), "missing and added keys remain distinct errors")
	var items: Array[String] = Diff.collect({"items": [1, 2]}, {"items": [1, 3]})
	_check(items.size() == 1 and items[0].begins_with("VALUE $.items[1]"), "array value changes are found")
	print("A0 SAVE DIFF ORACLE %s - %d checks" % ["PASSED" if failures == 0 else "FAILED", checks])
	quit(0 if failures == 0 else 1)
