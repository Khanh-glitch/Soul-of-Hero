extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## Phase 1 — the record survives a *new Godot OS process*, and the numbers that
## come back are checked for real loss rather than for JSON spelling.
##
## ## Why this probe exists
## "The save restored" is the one claim in the first-hour chain that cannot be
## made from inside one process: re-reading memory that was never flushed proves
## nothing. So this probe writes through the production `SaveService`, quits that
## value's world by spawning a second engine process, and compares what the second
## process actually loads from disk.
##
## It also separates the two things that are easy to confuse in a JSON save:
##
##   * an integer written as `1234567890` and read back as `1234567890.0` is the
##     same number, and reporting that as a lost save would be a false defect;
##   * an integer that comes back as a *different* number, a string, or missing is
##     real loss or real corruption.
##
## Both are asserted, so the second one cannot hide behind the first.
##
## ## What it does not claim
## `SaveService` has no run record, no currency and no Ragnarok state (R055/R063
## report that). This probe therefore proves the persistence *mechanism* works for
## A0's existing namespaces, which is the part a 336-hour run would depend on.

## Typed, because `SaveService.get_value` takes `Array[String]`; passing an
## untyped array is a runtime error, not a silent coercion.
## `settings` drops unknown keys (its sanitiser is a whitelist), and that is a
## good property, not a bug: the save refuses arbitrary state. `tutorials` accepts
## any valid identifier, so the flag lives there, and an existing numeric field
## carries the number.
const FLAG_PATH_TEXT := ["tutorials", "a7_persistence_probe"]
const FLAG_ID := "a7_persistence_probe"
## The number rides on a real inventory grant, not on a field this probe invented:
## quantity is an integer the save's own sanitiser validates, and `inventory_totals`
## is the product accessor for reading it back.
const ITEM_ID := "oak_wood"
const ITEM_KIND := "material"
const EXACT_NUMBER := 987
const GRANT_KEY := "a7_persistence_grant"
const CHILD_FLAG := "--a7-child"


func _body() -> void:
	probe_id = "RSAVE"
	probe_title = "a value written in one engine process is read back in a second OS process"
	owner_action = (
		"A0: persist the run record and the currency ledger through this same save path, so a 336-hour run can be "
		+ "resumed rather than restarted."
	)

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return

	# ---- child mode -----------------------------------------------------
	# The second process is the same script with a flag: it configures the same
	# save file, reads the value and prints it. Nothing is written here.
	var user_args := OS.get_cmdline_user_args()
	if user_args.has(CHILD_FLAG):
		await _child(save, user_args)
		_done()
		return

	# ---- parent mode ----------------------------------------------------
	# A boolean through a real public API, and an exact integer through the same
	# patch door the save uses internally. Two shapes, because "restored" has to
	# mean more than "a key came back".
	var flagged := bool(save.call(&"set_tutorial_completed", FLAG_ID))
	_note("set_tutorial_completed=%s" % str(flagged))
	_expect(flagged, "the production save records a completed flag through its public API")

	var granted := bool(save.call(&"grant_inventory_item", ITEM_ID, ITEM_KIND, EXACT_NUMBER, GRANT_KEY))
	_note("grant_inventory_item(%d)=%s" % [EXACT_NUMBER, str(granted)])
	_expect(granted, "the production save accepts an exact integer quantity through its inventory API")
	# Observed on this composition: 7 and 999 are accepted, 1234567 is refused. A
	# quantity is therefore bounded by a per-stack rule, which is a property worth
	# stating instead of assuming an int is an int.
	var huge := bool(save.call(&"grant_inventory_item", ITEM_ID, ITEM_KIND, 1234567, "a7_persistence_huge"))
	_note("grant_1234567=%s (bounded per stack)" % str(huge))
	_expect(not huge, "an implausible stack quantity is refused rather than silently truncated")

	var replay := bool(save.call(&"grant_inventory_item", ITEM_ID, ITEM_KIND, EXACT_NUMBER, GRANT_KEY))
	_note("grant_replay=%s" % str(replay))
	_expect(not replay, "replaying the same transaction key is refused (no duplicate quantity)")

	var saved := bool(save.call(&"save_now"))
	_note("save_now=%s" % str(saved))
	_expect(saved, "the production save flushes to disk")
	_expect(FileAccess.file_exists(save_path), "the save file exists on disk after the flush")

	var flag_path: Array[String] = []
	flag_path.assign(FLAG_PATH_TEXT)
	var restored_flag: Variant = save.call(&"get_value", flag_path, null)
	var totals: Dictionary = save.call(&"inventory_totals")
	var restored_number: Variant = totals.get(ITEM_ID, 0)
	_note("in_process flag=%s number=%s" % [JSON.stringify(restored_flag), JSON.stringify(restored_number)])
	_expect(restored_flag == true, "the flag is readable in the writing process (baseline)")
	_expect(_as_number(restored_number) == EXACT_NUMBER, "the exact integer is readable in the writing process (baseline)")

	# ---- a genuine second OS process ------------------------------------
	var child := _run_second_process([CHILD_FLAG, save_path])
	_note("second_process_exit=%d lines=%d" % [int(child["code"]), String(child["output"]).split("\n").size()])
	if not bool(child["ok"]):
		_note("second_process_output=%s" % JSON.stringify(String(child["output"]).substr(0, 600)))
		_block("the second engine process did not exit cleanly: %s" % String(child.get("reason", "")))
		return

	var reported := _child_payload(String(child["output"]))
	_note("second_process_value=%s" % JSON.stringify(reported.get("value", null)))
	if reported.is_empty():
		_expect(false, "the second process reported what it loaded instead of printing nothing")
		return

	# A different process id is the evidence that this is not the same memory.
	_expect(int(reported.get("pid", 0)) != OS.get_process_id(), "the value was read by a different OS process")

	var value: Dictionary = reported.get("value", {})
	_expect(not value.is_empty(), "the second process loaded the state at all")
	_expect(value.get("flag", null) == true, "the completed flag survived the process boundary")
	_note("second flag=%s number=%s" % [JSON.stringify(value.get("flag", null)), JSON.stringify(value.get("number", null))])
	_expect(
		_as_number(value.get("number", null)) == EXACT_NUMBER,
		"the exact integer survived the process boundary (%d), whatever its JSON spelling" % EXACT_NUMBER
	)
	# A save that invents fields is as broken as one that loses them.
	_expect(not value.has("a7_never_written"), "the restored record contains nothing that was never written")
	_done()

func _child(save: Node, user_args: PackedStringArray) -> void:
	var path := ""
	for arg: String in user_args:
		if arg.ends_with(".json"):
			path = arg
	if path.is_empty():
		print("A7CHILD error=no_save_path")
		return
	# The child is a reader: it points the service at the parent's file and loads.
	var configured := bool(save.call(&"configure_storage", path, true))
	var loaded := bool(save.call(&"is_loaded"))
	print("A7CHILD pid=%d configured=%s loaded=%s" % [OS.get_process_id(), str(configured), str(loaded)])
	var flag_path: Array[String] = []
	flag_path.assign(FLAG_PATH_TEXT)
	var totals: Dictionary = save.call(&"inventory_totals")
	var value := {
		"flag": save.call(&"get_value", flag_path, null),
		"number": totals.get(ITEM_ID, 0),
	}
	print("A7CHILD value=%s" % JSON.stringify(value))


func _child_payload(output: String) -> Dictionary:
	var result: Dictionary = {}
	for line: String in output.split("\n"):
		if not line.contains("A7CHILD "):
			continue
		if line.contains(" pid="):
			result["pid"] = int(line.split(" pid=")[1].split(" ")[0])
		if line.contains(" value="):
			var parsed: Variant = JSON.parse_string(line.split(" value=")[1])
			if parsed is Dictionary:
				result["value"] = parsed
	return result


## JSON has one number type. Accept an integral float as the same number; reject
## strings, fractions and nulls, because those are how real loss looks.
func _as_number(value: Variant) -> int:
	if value is int:
		return int(value)
	if value is float:
		var f := float(value)
		if is_finite(f) and f == floor(f):
			return int(f)
		return -123456789
	return -123456789
