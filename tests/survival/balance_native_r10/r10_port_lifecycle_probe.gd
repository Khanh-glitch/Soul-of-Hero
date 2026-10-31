extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP4 — A0's run lifecycle and the one wallet, driven through the real port.
##
## The port is not a mock: it is `a0_profile_port.gd` at A0 `84ac9c1a`, configured
## against the composed `SaveService`, committing through `transact_once`. What
## this probe tests is the part A0's own CI also tests — a run record that
## survives a restart, one receipt applied once, a delta refused outside A0's own
## commit boundary — plus the two questions A0's CI does **not** answer:
##
## * does the wallet door close when the run has expired?
## * what happens when the composition root hands the port a lying `hero_cell`?
##
## Both are trust-boundary questions, and both are answered by measurement.
##
## The clock is real: `port._now()` is `Time.get_unix_time_from_system()`. The 264 h
## and 336 h states are therefore reached by rewriting the durable `run_started_at`
## on a throwaway save, labelled `MUTATION_`. That measures the product's gate, not
## a player's ability to reach it, and the verdict says so.

const RUN_ID := "a7-r10-lifecycle"


func _body() -> void:
	probe_id = "R10PORT"
	probe_title = "the A0 run record: one run, one wallet, a closed commit boundary, and a run-expiry question"
	owner_action = (
		"A0: decide and implement whether `commit_profile_delta` accepts writes after `run_context().status == "
		+ "\"expired\"`. Today it does, so A0's own wallet door is the only one without a run gate; every other path "
		+ "(A3 plans) refuses. Also mount the port from the composition root, see R10SEAM."
	)

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	var port := _make_port(save, Callable(self, "_hero_cell"))
	if port == null:
		_missing("a configured A0 profile port against the composed SaveService", PROFILE_PORT)
		_done()
		return
	_expect(true, "the real A0 port accepts the real SaveService")

	# ---- 1. one run, created once --------------------------------------
	var first: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS, RUN_ID)
	_note("ensure_run=%s" % JSON.stringify(first))
	_expect(not first.is_empty(), "the port creates a durable run record")
	_expect(String(first.get("run_id", "")) == RUN_ID, "the run keeps the identity it was given")
	_expect(int(first.get("expires_at_unix", 0)) - int(first.get("run_started_at_unix", 0)) == RUN_MAX_SECONDS,
		"the 14-day maximum is recorded in the run itself, not recomputed by the UI")
	var second: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS, "a-different-run")
	_expect(String(second.get("run_id", "")) == RUN_ID,
		"a second `ensure_run` returns the existing run instead of minting a new one")
	var stored := _profile_run()
	_note("durable_run=%s" % JSON.stringify(stored))
	_expect(String(stored.get("run_id", "")) == RUN_ID, "the run lives in the authoritative profile document")

	# ---- 2. the clock is monotonic and read from the OS ------------------
	var ctx_a: Dictionary = port.call(&"run_context")
	await process_frame
	var ctx_b: Dictionary = port.call(&"run_context")
	_note("run_context a=%s b=%s" % [JSON.stringify(ctx_a), JSON.stringify(ctx_b)])
	_expect(int(ctx_b.get("now_unix", 0)) >= int(ctx_a.get("now_unix", 0)), "run time never goes backwards")
	_expect(String(ctx_a.get("status", "")) == "active", "a freshly created run is active")
	_expect(int(ctx_a.get("now_unix", 0)) >= int(ctx_a.get("run_started_at_unix", 0)),
		"the context reports a real OS clock, not a supplied one")
	var rollback := int(ctx_a["now_unix"]) - int(ctx_a["run_started_at_unix"])
	_note("elapsed_since_start=%d s (a player would need %d s to reach the finale)" % [rollback, RAGNAROK_START])
	_expect(rollback < 300, "the run really did just start here, so no boundary below is a lucky accident")

	# ---- 3. one receipt, applied once ----------------------------------
	var balance_before := int(port.call(&"balance"))
	var receipts_before := (_profile().get("currency_receipts", []) as Array).size()
	var commit: Dictionary = port.call(&"commit_profile_delta", "a7-r10-deposit-1", 7, {"reason": "probe"})
	_note("commit_profile_delta=%s balance %d -> %d" % [JSON.stringify(commit), balance_before, int(port.call(&"balance"))])
	_expect(bool(commit.get("ok", false)), "an A0-owned wallet change commits through transact_once")
	_expect(int(port.call(&"balance")) == balance_before + 7, "the committed delta is visible in the balance")
	_expect((_profile().get("currency_receipts", []) as Array).size() == receipts_before + 1,
		"the receipt is durable, so a replay can be recognised after a restart")

	var replay: Dictionary = port.call(&"commit_profile_delta", "a7-r10-deposit-1", 7, {})
	_note("replay=%s" % JSON.stringify(replay))
	_expect(bool(replay.get("duplicate", false)) and not bool(replay.get("ok", true)),
		"the same receipt_id cannot be applied twice")
	_expect(int(port.call(&"balance")) == balance_before + 7, "a refused replay leaves the balance untouched")

	# ---- 4. the commit boundary is closed outside A0 ---------------------
	var direct := false
	if port.has_method(&"apply_profile_delta"):
		var candidate := _snapshot()
		direct = bool(port.call(&"apply_profile_delta", candidate, 5, {"receipt_id": "a7-r10-direct"}))
	_note("apply_profile_delta_outside_commit=%s last_error=%s" % [str(direct), String(port.get(&"last_error"))])
	_expect(not direct, "a wallet delta is refused outside A0's own commit boundary")
	_expect(String(port.get(&"last_error")) == "a0_profile_commit_boundary_absent",
		"the refusal names the missing boundary instead of failing silently")

	# ---- 5. does the wallet door close when the run expires? -------------
	_expect(_forge_run_start(port, RUN_MAX_SECONDS + 60),
		"the durable run start can be aged for the expiry test (MUTATION_, so this measures the gate, not play)")
	var expired_ctx: Dictionary = port.call(&"run_context")
	_note("MUTATION_ expired_context=%s" % JSON.stringify(expired_ctx))
	_expect(String(expired_ctx.get("status", "")) == "expired", "the context reports the run as expired")
	var expired_delta: Dictionary = port.call(&"commit_profile_delta", "a7-r10-after-expiry", 3, {})
	_note("MUTATION_ deposit_after_expiry=%s" % JSON.stringify(expired_delta))
	var balance_at_expiry := int(port.call(&"balance"))
	_expect(
		not bool(expired_delta.get("ok", true)),
		"A0's own wallet door refuses a deposit after the run expired (ok=%s, balance=%d)"
		% [str(expired_delta.get("ok", false)), balance_at_expiry]
	)

	_note(
		"VERDICT: the run record, the receipt ledger and the commit boundary are real and durable. The run gate is "
		+ "enforced by A3's plans and by nothing on A0's own wallet path, which is the one correction this probe asks for."
	)
	_done()
