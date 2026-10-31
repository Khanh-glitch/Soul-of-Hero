extends Node

## Data-authority consumer test: A6 shows what its owners project, and nothing else.
##
## A6 is a read-only UX surface (D074). Season time, the secured Ragnarok wallet,
## durability, Core charges and the recovered bag belong to A0/A3; if A6 grew its own
## copy of any of them the player would eventually see a number that disagrees with the
## save. This runs the consumer side of that rule on the real contract code, and scans
## the A6 sources for a second authority.
##
##   godot --headless --path . res://tests/survival/ui/a6_data_authority_consumer_test.tscn
##
## Pass prints `A6 DATA AUTHORITY PASSED (N checks)` and exits 0.

const CONTRACT := preload("res://game/survival/ui/return/a6_projection_contract.gd")

const RUN_SECONDS := 14 * 24 * 60 * 60
const RAGNAROK_SECONDS := 72 * 60 * 60
const NOW := 1_772_000_000

## A6 directories. Every file in them is scanned below.
const A6_DIRS := ["game/survival/ui"]

## State A6 must never own. Each entry is a declaration pattern plus what it means.
const FORBIDDEN_DECLARATIONS := [
	["_wallet", "a wallet balance"],
	["_currency_balance", "a currency balance"],
	["_season_seconds", "a run clock"],
	["_run_clock", "a run clock"],
	["_durability", "equipment durability"],
	["_core_charges", "Core charges"],
	["_bag_recovery", "bag recovery state"],
	["_offline_outputs", "settled offline production"],
]

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_check_wallet_comes_from_its_owner()
	_check_evacuation_is_a_run_ending()
	_check_ragnarok_window_is_arithmetic()
	_check_no_second_authority()
	_finish()


## The wallet contract: a projected balance is printed unchanged, and every way of
## inventing one is refused.
func _check_wallet_comes_from_its_owner() -> void:
	var projected := CONTRACT.sanitize_account_wallet({
		"contract": "soh.a6.account_wallet.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"amount": 420,
		"currency_label": "Ragnarok",
		"secured": true,
		"revision": "wallet:r7",
	})
	_expect(bool(projected.get("available", false)), "an owner-projected wallet is accepted")
	_equals(int(projected.get("amount", -1)), 420,
		"the balance is the owner's number, unchanged")
	_equals(String(projected.get("currency_label", "")), "Ragnarok", "the label is the owner's label")
	_expect(bool(projected.get("secured", false)), "a deposited balance stays deposited")
	_equals(String(projected.get("revision", "")), "wallet:r7",
		"the revision comes through, so a stale card is provable")

	# No projection at all is not zero currency.
	var absent := CONTRACT.sanitize_account_wallet(null)
	_expect(not bool(absent.get("available", true)), "a missing wallet is unavailable")
	_expect(not absent.has("currency_label"), "an unavailable wallet has no label to print")

	# A fixture, a stub or a hand-typed number must never reach the player.
	for bad_provenance: String in ["FIXTURE", "TEST_ONLY", "", "A6_LOCAL_STATE"]:
		var refused := CONTRACT.sanitize_account_wallet({
			"contract": "soh.a6.account_wallet.v1",
			"provenance": bad_provenance,
			"amount": 99,
			"currency_label": "Ragnarok",
		})
		_expect(not bool(refused.get("available", true)),
			"a wallet marked '%s' is refused" % bad_provenance)

	# Arithmetic on the balance is not A6's to do; a non-number is not coerced.
	var negative := CONTRACT.sanitize_account_wallet({
		"contract": "soh.a6.account_wallet.v1",
		"provenance": "A3_OWNER_PROJECTION",
		"amount": -5,
		"currency_label": "Ragnarok",
	})
	_expect(not bool(negative.get("available", true)), "a negative balance is refused, not clamped")
	var textual := CONTRACT.sanitize_account_wallet({
		"contract": "soh.a6.account_wallet.v1",
		"provenance": "A3_OWNER_PROJECTION",
		"amount": "420",
		"currency_label": "Ragnarok",
	})
	_expect(not bool(textual.get("available", true)), "a string balance is refused rather than parsed")
	var unlabelled := CONTRACT.sanitize_account_wallet({
		"contract": "soh.a6.account_wallet.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"amount": 420,
		"currency_label": "",
	})
	_expect(not bool(unlabelled.get("available", true)), "a balance with no label is refused")
	var leaky := CONTRACT.sanitize_account_wallet({
		"contract": "soh.a6.account_wallet.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"amount": 420,
		"currency_label": "soh.secured_ragnarok_currency",
	})
	_expect(not bool(leaky.get("available", true)), "a source token as a label is refused (D052)")


## D062/D068: deadline, abandon and evacuation are three different endings.
func _check_evacuation_is_a_run_ending() -> void:
	var base := {
		"contract": "soh.a6.season_clock.v1",
		"run_id": "run-7",
		"run_number": 3,
		"started_at_unix": NOW - 3600,
		"ends_at_unix": NOW - 3600 + RUN_SECONDS,
		"ended": true,
	}
	for reason: String in ["deadline", "abandoned", "evacuation"]:
		var clock: Dictionary = base.duplicate(true)
		clock["ended_reason"] = reason
		var accepted := CONTRACT.sanitize_season_clock(clock)
		_expect(bool(accepted.get("available", false)), "a run ended by %s is valid" % reason)
		_equals(String(accepted.get("ended_reason", "")), reason,
			"the UI keeps the label '%s' instead of blanking it" % reason)
	var invented: Dictionary = base.duplicate(true)
	invented["ended_reason"] = "something_else"
	_equals(String(CONTRACT.sanitize_season_clock(invented).get("ended_reason", "x")), "",
		"an unknown ending is blanked, not printed raw")


## D065: the last 72 hours are Ragnarok. Asserted on both sides of the boundary,
## because an off-by-one here tells the player the wrong thing about their run.
func _check_ragnarok_window_is_arithmetic() -> void:
	var starts := NOW - 3600
	var clock := CONTRACT.sanitize_season_clock({
		"contract": "soh.a6.season_clock.v1",
		"run_id": "run-7",
		"started_at_unix": starts,
		"ends_at_unix": starts + RUN_SECONDS,
	})
	var ends := int(clock.get("ends_at_unix", 0))
	var enters := ends - RAGNAROK_SECONDS

	var before := CONTRACT.ragnarok_window(clock, enters - 1)
	_expect(bool(before.get("available", false)), "the window is available whenever the clock is")
	_expect(not bool(before.get("active", true)), "one second before the window is not Ragnarok")

	var first := CONTRACT.ragnarok_window(clock, enters)
	_expect(bool(first.get("active", false)), "the first second of the window is Ragnarok")
	_equals(int(first.get("seconds_left", -1)), RAGNAROK_SECONDS,
		"the window opens with exactly 72 hours left")

	var last := CONTRACT.ragnarok_window(clock, ends - 1)
	_expect(bool(last.get("active", false)), "the last second of the run is still Ragnarok")
	_expect(not bool(CONTRACT.ragnarok_window(clock, ends).get("active", true)),
		"an expired run is no longer in Ragnarok")

	# A missing clock must not produce a Ragnarok banner.
	var none := CONTRACT.ragnarok_window(CONTRACT.make_unavailable_clock("missing"), NOW)
	_expect(not bool(none.get("active", true)), "no clock means no Ragnarok claim")
	_expect(not bool(none.get("available", true)), "no clock means the window is unavailable")


## A6 must not hold a second copy of any owner's numbers. This scans the real files,
## so a future convenience variable fails here instead of drifting from the save.
func _check_no_second_authority() -> void:
	var scanned := 0
	for folder: String in A6_DIRS:
		for path: String in _gd_files(folder):
			var text := FileAccess.get_file_as_string(path)
			scanned += 1
			for pair: Array in FORBIDDEN_DECLARATIONS:
				var token := String(pair[0])
				if _declares_variable(text, token):
					_fail("%s declares %s (%s); that belongs to A0/A3" % [path, token, String(pair[1])])
			# Reading the save directly would bypass the projection seam. One module
			# is allowed to resolve it; everything else must receive it.
			var resolves_owner := text.contains("SAVE_SERVICE_PATH") or text.contains("/root/SaveService")
			if resolves_owner and not path.ends_with("a6_owner_projection_source.gd"):
				_fail("%s reaches for SaveService outside the projection source" % path)
	_expect(scanned > 8, "the scan covered the A6 UI sources (%d files)" % scanned)
	# The detector itself must not be a no-op: a known-bad declaration is caught.
	_expect(_declares_variable("var _wallet := {}\n", "_wallet"),
		"the detector catches a forbidden declaration it is shown")
	var harmless := 'const WALLET_CONTRACT := "soh.a6.account_wallet.v1"\n'
	_expect(not _declares_variable(harmless, "_wallet"),
		"the detector does not fire on a contract-name constant")

	# The contract intentionally exposes only read/validation entry points.
	for banned: String in ["func set_account_wallet", "func save_wallet", "func credit_wallet"]:
		_expect(not _any_file_contains(A6_DIRS, banned), "A6 exposes no wallet writer (%s)" % banned)


func _gd_files(folder: String) -> Array[String]:
	var out: Array[String] = []
	var root := DirAccess.open("res://" + folder)
	if root == null:
		return out
	for name: String in root.get_files():
		if name.ends_with(".gd"):
			out.append("res://%s/%s" % [folder, name])
	for sub: String in root.get_directories():
		out.append_array(_gd_files("%s/%s" % [folder, sub]))
	return out


func _declares_variable(text: String, token: String) -> bool:
	for line: String in text.split("\n"):
		var trimmed := line.strip_edges()
		if trimmed.begins_with("var ") and trimmed.contains(token):
			return true
	return false


func _any_file_contains(folders: Array, needle: String) -> bool:
	for folder: String in folders:
		for path: String in _gd_files(folder):
			if FileAccess.get_file_as_string(path).contains(needle):
				return true
	return false


func _equals(actual: Variant, expected: Variant, label: String) -> void:
	_checks += 1
	if actual != expected:
		_failures.append("%s (got %s, expected %s)" % [label, str(actual), str(expected)])


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _fail(label: String) -> void:
	_failures.append(label)


func _finish() -> void:
	if _failures.is_empty():
		print("A6 DATA AUTHORITY PASSED (%d checks)" % _checks)
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("A6 DATA AUTHORITY FAILED: ", failure)
		print("::error::A6 DATA AUTHORITY FAILED: %s" % failure)
	print("A6 DATA AUTHORITY FAILED (%d/%d)" % [_failures.size(), _checks])
	get_tree().quit(1)
