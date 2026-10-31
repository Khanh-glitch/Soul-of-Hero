extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP4 — the run boundary, the crash boundary, and what a "new run" would need.
##
## CT's WP4 asks for four things this round has not yet measured, and this probe
## measures each of them against A0's real port rather than against a document:
##
## 1. the clock at `0 / 264 / 288 / 312 / 335:59:59 / 336 h`, read from
##    `run_context()` and from A3's own planner refusals;
## 2. whether the *write* door obeys the clock the port itself reports — this is
##    where the round-10 lifecycle probe found a hole, and it is re-measured here
##    as the run-expiry clause CT asked for;
## 3. whether a run can end at all (logout vs death vs abandon vs terminal) and
##    whether the next run can start — measured as "does `ensure_run` ever return a
##    *second* run";
## 4. a real interrupted commit. A0 ships a one-shot fault hook
##    (`configure_test_save_interruption`) at four disk boundaries; each one is
##    fired, then a **separate OS process** reopens the save and reports what a
##    player would find. The invariant is that no transaction is ever half-applied.
##
## Everything forged is labelled `MUTATION_`; anything that needs the engine's
## fault hook reports `BLOCKED` with the exact missing precondition if the hook is
## not armed (`--survival-save-fault-test`).

const CHILD_FLAG := "--a7-r10-boundary-child="
const FAULT_FLAG := "--survival-save-fault-test"
const BOUNDARIES := ["after_temporary", "after_backup", "after_primary_removed", "after_primary_renamed"]
const HOUR := 3600
## CT's own numbers for the run: 336 h total, Ragnarok opening at hour 264.
const SWEEP := [
	{"label": "0h", "seconds": 0, "status": "active"},
	{"label": "264h", "seconds": 264 * HOUR, "status": "active"},
	{"label": "288h", "seconds": 288 * HOUR, "status": "active"},
	{"label": "312h", "seconds": 312 * HOUR, "status": "active"},
	{"label": "335h59m59s", "seconds": 336 * HOUR - 1, "status": "active"},
	{"label": "336h", "seconds": 336 * HOUR, "status": "expired"},
]


func _body() -> void:
	probe_id = "R10BOUNDS"
	probe_title = "the run boundary, the crash boundary, and whether a new run can start"
	owner_action = (
		"A0: gate `commit_profile_delta`/`commit_meta_deposit` on `run_context().status`, and add a run-end API "
		+ "(end_run(reason)/start_run) so 336 h can roll into a *new* run instead of an expired one being returned "
		+ "forever. Until then every 'new run' clause and the history it would write are unreachable."
	)

	var user_args := OS.get_cmdline_user_args()
	for arg: String in user_args:
		if arg.begins_with(CHILD_FLAG):
			await _child(arg.trim_prefix(CHILD_FLAG))
			_done()
			return

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	var port := _make_port(save, Callable(self, "_hero_cell"))
	if port == null:
		_missing("a configured A0 profile port", PROFILE_PORT)
		_done()
		return
	var econ := _make_a3(save, port)
	if econ == null:
		_missing("A3's economy service accepting A0's port", A3_ECONOMY_SERVICE)
		_done()
		return

	var run: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS, "a7-r10-bounds")
	_expect(not run.is_empty(), "the durable run starts through A0's own port")
	var run_id := String(run.get("run_id", ""))
	var started := int(run.get("run_started_at_unix", 0))

	await _offline_clock(save, port, run_id, started)
	_clock_sweep(port, econ, run_id)
	_expiry_write_door(port)
	_run_end_and_next_run(port, run_id)
	await _crash_boundaries(save, port)
	_done()


# ------------------------------------------------------- 1. the clock, off-process
## A restart must not restart the clock and the clock must not be this process's
## uptime: the child is a different PID reading the same document through A0.
func _offline_clock(save: Node, port: RefCounted, run_id: String, started: int) -> void:
	var parent_ctx: Dictionary = port.call(&"run_context")
	var path := String(save.get(&"_save_path"))
	var child := _run_second_process([CHILD_FLAG + path, FAULT_FLAG])
	var facts := _parse_child(child)
	_note("offline child: %s" % JSON.stringify(facts))
	if facts.is_empty():
		_block("the second OS process produced no readable clock facts (%s)" % String(child.get("output", "")))
		return
	_expect(String(facts.get("run_id", "")) == run_id,
		"a second OS process reads the same run identity (%s)" % run_id)
	_expect(int(facts.get("run_started_at_unix", 0)) == started,
		"the run's start is the durable one, not the new process's start")
	var child_elapsed := int(facts.get("now_unix", 0)) - started
	var parent_elapsed := int(parent_ctx.get("now_unix", 0)) - started
	_note("elapsed parent=%ds child=%ds (monotone in OS wall clock)" % [parent_elapsed, child_elapsed])
	_expect(child_elapsed >= parent_elapsed and child_elapsed >= 0,
		"the run clock advances with OS time across processes (%d -> %d s)" % [parent_elapsed, child_elapsed])


# ------------------------------------------------------------- 2. the boundary sweep
func _clock_sweep(port: RefCounted, econ: RefCounted, run_id: String) -> void:
	var claim_request := {
		"contract": "soh.economy.meta_source_authority.v1",
		"run_id": run_id,
		"source_id": "elder_ashen_vault",
		"source_instance_id": "si:r_ashen_crown:waystation_cache:01",
		"expected_generation": 1,
		"event_id": "a7.r10.bounds.claim",
	}
	for row: Dictionary in SWEEP:
		var seconds := int(row["seconds"])
		# `_forge_run_start` labels itself MUTATION_ and returns only when the
		# durable document carries the forged start.
		var forged := _forge_run_start(port, seconds)
		var ctx: Dictionary = port.call(&"run_context")
		var status := String(ctx.get("status", ""))
		_note("sweep %-10s forged=%s status=%s elapsed=%ds" % [
			row["label"], str(forged), status, int(ctx.get("now_unix", 0)) - int(ctx.get("run_started_at_unix", 0)),
		])
		_expect(status == String(row["status"]),
			"at %s the run reports `%s` (measured `%s`)" % [row["label"], row["status"], status])
		var claim: Dictionary = econ.call(&"plan_meta_source_claim", claim_request)
		var reason := String(claim.get("reason", ""))
		_note("sweep %-10s claim reason=%s" % [row["label"], reason])
		if seconds < 264 * HOUR:
			_expect(reason == "premature_ragnarok_claim",
				"before hour 264 the claim is refused for time, by name (%s)" % reason)
		elif seconds >= 336 * HOUR:
			# A3's `_run_active` checks the status before it checks the arithmetic,
			# so an expired run refuses with `run_not_active` and its own
			# `run_expired` branch is unreachable for as long as A0 reports the
			# status. Both are the same refusal to a player; the note records which.
			_expect(reason in ["run_not_active", "run_expired"],
				"at 336 h the claim is refused because the run is over (%s)" % reason)
			_note("at 336 h A3 refuses with `%s`: the status gate fires before its own `run_expired` branch" % reason)
		else:
			_expect(reason != "premature_ragnarok_claim" and reason != "run_expired",
				"at %s the claim is past both time gates (%s)" % [row["label"], reason])


# --------------------------------------------------- 3. the door that must obey it
## This is the round-10 lifecycle finding restated as CT's expiry clause: the port
## reports `expired`, and the write door must refuse. It currently does not.
func _expiry_write_door(port: RefCounted) -> void:
	var forged := _forge_run_start(port, 336 * HOUR)
	var ctx: Dictionary = port.call(&"run_context")
	_expect(forged and String(ctx.get("status", "")) == "expired",
		"the run is provably expired before the write is attempted")
	var balance_before := int(port.call(&"balance"))
	var wallet: Dictionary = port.call(&"commit_profile_delta", "a7.r10.expired.write", 5, {"kind": "probe"})
	_note("expired write: ok=%s reason=%s balance %d -> %d" % [
		str(wallet.get("ok", false)), String(wallet.get("reason", "")), balance_before, int(port.call(&"balance")),
	])
	_expect(not bool(wallet.get("ok", false)),
		"an expired run refuses a wallet write (ok=%s, balance=%d)"
		% [str(wallet.get("ok", false)), int(port.call(&"balance"))])
	# The same question one layer down: A0's deposit boundary with an applier that
	# does not consult A3. If this commits, the refusal has to live in A0.
	var deposit: Dictionary = port.call(&"commit_meta_deposit", "a7.r10.expired.deposit",
		func(_candidate: Dictionary) -> Dictionary: return {"ok": true, "kind": "probe"}, {"kind": "probe"})
	_note("expired deposit boundary: ok=%s reason=%s" % [str(deposit.get("ok", false)), String(deposit.get("reason", ""))])
	_expect(not bool(deposit.get("ok", false)),
		"an expired run refuses a deposit boundary commit (ok=%s)" % str(deposit.get("ok", false)))


# --------------------------------------------- 4. ending a run, and starting the next
func _run_end_and_next_run(port: RefCounted, run_id: String) -> void:
	var again: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS)
	var same := String(again.get("run_id", "")) == run_id
	_note("ensure_run after expiry -> %s (same=%s)" % [JSON.stringify(String(again.get("run_id", ""))), str(same)])
	_expect(same and not again.is_empty(),
		"`ensure_run` never opens a second run while one exists (currently even an expired one)")

	var methods: Array[String] = []
	for method: Dictionary in (load(PROFILE_PORT) as Script).get_script_method_list():
		methods.append(String(method["name"]))
	var enders: Array[String] = []
	for candidate: String in ["end_run", "abandon_run", "close_run", "start_run", "begin_run", "reset_run"]:
		if methods.has(candidate):
			enders.append(candidate)
	_note("run-lifecycle methods present: %s" % JSON.stringify(enders))
	if enders.is_empty():
		_missing(
			"a way to end a run and start the next one: the port declares none of end_run/abandon_run/close_run/"
			+ "start_run/reset_run, and `ensure_run` returns the expired run forever, so 336 h can never roll into "
			+ "a new run, and logout/death/abandon/terminal expiry cannot be distinguished (only active|expired)"
		)
	var history: Array = _profile().get("run_history", [])
	_expect(history.is_empty(),
		"no run ever ends, so run_history stays empty as the mirror of that (%d entries)" % history.size())


# ------------------------------------------------------ 5. a real interrupted commit
## Fire A0's own one-shot fault hook at each disk boundary, then reopen the save in
## a second OS process. The claim under test is atomicity: the wallet either has
## both the balance and the receipt, or neither.
func _crash_boundaries(save: Node, port: RefCounted) -> void:
	var user_args := OS.get_cmdline_user_args()
	if not user_args.has(FAULT_FLAG):
		_block(
			"the save fault hook needs `%s` in the engine's user args (run_native.py passes it as --probe-args); "
			% FAULT_FLAG + "without it `configure_test_save_interruption` refuses and no crash can be fired"
		)
		return
	# A unique stamp keeps a rerun in the same user:// directory from meeting its
	# own receipts: a fixed path plus fixed receipt ids would make the second run
	# measure `already_applied` instead of the crash boundary.
	var stamp := str(Time.get_ticks_usec())
	for boundary: String in BOUNDARIES:
		var path := "user://tests/a7_r10_crash_%s_%s.json" % [boundary, stamp]
		if not bool(save.call(&"configure_storage", path, true)):
			_block("SaveService refused the isolated crash path %s" % path)
			return
		var crash_port := _make_port(save, Callable(self, "_hero_cell"))
		if crash_port == null:
			_block("the port did not configure against the crash save")
			return
		crash_port.call(&"ensure_run", RUN_MAX_SECONDS, "a7-r10-crash-" + stamp)
		var base: Dictionary = crash_port.call(&"commit_profile_delta", "a7-r10-base-" + stamp, 5, {"kind": "probe"})
		if not bool(base.get("ok", false)):
			_block("the baseline receipt did not commit (%s)" % String(base.get("reason", "")))
			return
		var before := int(crash_port.call(&"balance"))
		var armed := bool(save.call(&"configure_test_save_interruption", boundary))
		if not armed:
			_block("`configure_test_save_interruption(%s)` refused to arm" % boundary)
			return
		var during: Dictionary = crash_port.call(&"commit_profile_delta", "a7-r10-crash-" + stamp, 3, {"kind": "probe"})
		_note("boundary %-24s armed=%s commit_ok=%s reason=%s balance_in_process=%d" % [
			boundary, str(armed), str(during.get("ok", false)), String(during.get("reason", "")), int(crash_port.call(&"balance")),
		])
		var child := _run_second_process([CHILD_FLAG + path + "|" + stamp, FAULT_FLAG])
		var facts := _parse_child(child)
		_note("boundary %-24s reopened by pid %s: %s" % [
			boundary, str(facts.get("pid", "?")), JSON.stringify(facts),
		])
		if facts.is_empty():
			_expect(false, "the %s restart produced a readable save state" % boundary)
			continue
		var balance := int(facts.get("balance", -1))
		var base_applied := bool(facts.get("base_applied", false))
		var crash_applied := bool(facts.get("crash_applied", false))
		var whole := (balance == before and base_applied and not crash_applied) \
			or (balance == before + 3 and base_applied and crash_applied)
		_expect(whole,
			"%s leaves the wallet consistent: balance=%d base=%s crash=%s (no half-applied transaction)"
			% [boundary, balance, str(base_applied), str(crash_applied)])
		# Exactly once, measured where it matters: the *next process* retries the
		# same receipt. If the write had landed, the retry must be a no-op; if it was
		# lost, the retry must land. Either way the player ends with one receipt.
		var retry_balance := int(facts.get("retry_balance", -1))
		var retry_reason := String(facts.get("retry_reason", ""))
		_note("boundary %-24s retry in the fresh process: ok=%s reason=%s balance=%d" % [
			boundary, str(facts.get("retry_ok", false)), retry_reason, retry_balance,
		])
		_expect(retry_balance == before + 3,
			"%s: a retry after the crash lands exactly once (balance %d, expected %d)"
			% [boundary, retry_balance, before + 3])
		if crash_applied:
			_expect(not bool(facts.get("retry_ok", false)) and retry_reason in ["already_applied", "a0_profile_receipt_already_applied"],
				"%s: a retry of a write that already landed is refused as a replay (%s)" % [boundary, retry_reason])


# ------------------------------------------------------------------ child process
func _child(argument: String) -> void:
	var parts := argument.split("|", true, 1)
	var path := parts[0]
	var stamp := parts[1] if parts.size() > 1 else ""
	var save := _save()
	if save == null:
		print("A7 R10BOUNDS CHILD {}")
		return
	var recovered: Array[String] = []
	save.connect(&"save_recovered", func(source: String) -> void: recovered.append(source))
	var loaded := bool(save.call(&"configure_storage", path, true))
	var port := _make_port(save, Callable(self, "_hero_cell"))
	var facts := {
		"pid": OS.get_process_id(),
		"loaded": loaded,
		"recovered": recovered,
		"run_id": String((port.call(&"run_context") as Dictionary).get("run_id", "")) if port != null else "",
		"run_started_at_unix": int((port.call(&"run_context") as Dictionary).get("run_started_at_unix", 0)) if port != null else 0,
		"now_unix": int(Time.get_unix_time_from_system()),
		"balance": int(port.call(&"balance")) if port != null else -1,
		"base_applied": _any_receipt_applied(save, "a7-r10-base"),
		"crash_applied": _any_receipt_applied(save, "a7-r10-crash"),
	}
	# The retry happens *after* the state was read, so the reported balance is the
	# one the crashed process left behind.
	facts["retry_ok"] = false
	facts["retry_reason"] = "no_stamp"
	facts["retry_balance"] = int(port.call(&"balance")) if port != null else -1
	if port != null and not stamp.is_empty():
		var retry: Dictionary = port.call(&"commit_profile_delta", "a7-r10-crash-" + stamp, 3, {"kind": "probe"})
		facts["retry_ok"] = bool(retry.get("ok", false))
		facts["retry_reason"] = String(retry.get("reason", ""))
		facts["retry_balance"] = int(port.call(&"balance"))
	print("A7 R10BOUNDS CHILD %s" % JSON.stringify(facts))


## The child cannot know this process's stamp, so it reports whether *any* receipt
## with the prefix landed. One run, one boundary file, so the prefix is unambiguous.
## `applied_transactions` is keyed by the hashed transaction key, so the receipt id
## is read back from the persisted profile instead.
func _any_receipt_applied(_save: Node, prefix: String) -> bool:
	var profile := _profile()
	for entry: Variant in (profile.get("currency_receipts", []) as Array):
		if entry is Dictionary and String((entry as Dictionary).get("receipt_id", "")).begins_with(prefix):
			return true
	return false


func _parse_child(result: Dictionary) -> Dictionary:
	for line: String in String(result.get("output", "")).split("\n"):
		if line.begins_with("A7 R10BOUNDS CHILD "):
			var parsed: Variant = JSON.parse_string(line.trim_prefix("A7 R10BOUNDS CHILD "))
			if parsed is Dictionary:
				return parsed
	return {}
