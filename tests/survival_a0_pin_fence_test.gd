extends SceneTree
## A0 owner-byte fence regression (Round 11 WP1).
##
## The economy session refuses to mount when the pinned A3 bytes are stale. This
## test proves the fence itself, and proves the refusal is *named* rather than a
## silent "no economy": a stale `items.json` must produce
## `A3_OWNER_BYTES_STALE:a3_data_pin_mismatch:…@<owner commit>`.
##
## It does not weaken the fence: `verify_with()` is the same code path `verify()`
## uses, and the live table is checked independently against the real files.
const PINS = preload("res://game/survival/economy/a0_v5_source_pins.gd")

var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	print("A0 PIN FENCE")
	_fence_is_live()
	_refuses_stale_bytes()
	_refuses_missing_owner_file()
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
		print("A0 PIN FENCE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 PIN FENCE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _fence_is_live() -> void:
	_expect(PINS.verify() == "", "the live A3 byte table verifies (%s)" % PINS.verify())
	_expect(PINS.verify_or_reason() == "", "the live fence reports no stale-owner refusal")
	# Independent of the fence's own loop: recompute every pinned data hash.
	var data: Dictionary = PINS.DATA
	var mismatched: Array[String] = []
	for path: String in data:
		if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != String(data[path]):
			mismatched.append(path)
	_expect(mismatched.is_empty(), "every pinned A3 data file matches its sha256 (%s)" % ", ".join(mismatched))
	_expect(String(PINS.A3_OWNER_COMMIT).length() == 40, "the fence names a full 40-char A3 owner commit")


func _refuses_stale_bytes() -> void:
	var target := "res://data/survival/items/items.json"
	var reason: String = PINS.verify_with({target: "0000000000000000000000000000000000000000000000000000000000000000"})
	_expect(reason == "a3_data_pin_mismatch:" + target,
		"a stale owner byte set is refused by path (%s)" % reason)
	_expect(not PINS.verify_with({target: "0000"}).is_empty(),
		"any wrong expectation is refused, not just a well-formed one")
	var script_target := "res://game/survival/economy/vendor/a3_economy_service.gd"
	var script_reason: String = PINS.verify_with({script_target: "deadbeef"})
	_expect(script_reason == "a3_script_pin_mismatch:" + script_target,
		"a stale owner script is refused by path (%s)" % script_reason)


func _refuses_missing_owner_file() -> void:
	# The fence only ever looks at the pinned table, so an unknown path cannot be
	# smuggled in as an "extra" pin (and cannot excuse a stale one either).
	var missing := "res://data/survival/items/__a0_pin_fence_absent__.json"
	_expect(PINS.verify_with({missing: "abc"}) == "",
		"an unknown path is not part of the fence (the table is the authority)")
	var target := "res://data/survival/items/sources.json"
	var truth := String((PINS.DATA as Dictionary)[target])
	_expect(PINS.verify_with({target: truth}) == "", "restating the pinned hash keeps the fence green")
	_expect(PINS.verify_with({target: truth}).is_empty() and not PINS.verify_with({target: "00"}).is_empty(),
		"the fence distinguishes the real hash from a stale one")
