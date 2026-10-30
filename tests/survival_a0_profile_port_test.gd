extends "res://tests/survival_foundation_test.gd"
## A0 production profile port (`soh.economy.a0_profile_port.v1`) at the real
## SaveService boundary. No fixture wallet, no grants, no teleport, no test
## clock: every write below goes through the same transact_once that gameplay
## uses, and the second process reads the same disk profile.
const Port = preload("res://game/survival/economy/a0_profile_port.gd")
const PROFILE_SAVE := "user://tests/a0_profile_port.json"
const AUDIT := "user://tests/a0_profile_port_audit.json"
const RUN_MAX_SECONDS := 1209600
const CACHE_INSTANCE := "si:r_ashen_crown:waystation_cache:01"
const ENDPOINTS := {
	"preservation_kiosk_01": {"kind": "deposit", "endpoint_revision": "rev-1", "stand_cells": [[408, 199]]},
	"vending_kiosk_01": {"kind": "vending", "endpoint_revision": "rev-1", "stand_cells": [[410, 199]]},
	"recycler_01": {"kind": "recycler", "endpoint_revision": "rev-1", "stand_cells": [[412, 199]]},
}
const ENDPOINT_POI := {
	"preservation_kiosk_01": "poi_crown_waystation",
	"vending_kiosk_01": "poi_crown_waystation",
	"recycler_01": "poi_crown_waystation",
}


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = PROFILE_SAVE
	var verify := OS.get_cmdline_user_args().has("--verify-profile")
	var loaded := bool(_save().call(&"configure_storage", save_path, true))
	_expect(loaded, "authoritative disk profile loads")
	if not loaded:
		_finish()
		return
	if verify:
		_verify_process()
	else:
		await _first_process()
	_finish()


func _finish() -> void:
	# The first process of the two-process pair keeps the disk profile so the
	# relaunch reads the real bytes; whichever process closes the pair deletes it.
	if OS.get_cmdline_user_args().has("--keep-profile"):
		if failures.is_empty():
			print("A0 PROFILE PORT PASSED - %d checks" % checks)
			quit(0)
		else:
			print("A0 PROFILE PORT FAILED - %d/%d" % [failures.size(), checks])
			quit(1)
		return
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if FileAccess.file_exists(AUDIT):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(AUDIT))
	if failures.is_empty():
		print("A0 PROFILE PORT PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 PROFILE PORT FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _port(hero: Array) -> RefCounted:
	var port: RefCounted = Port.new()
	var ok := bool(port.call(&"configure", _save(), ENDPOINTS, ENDPOINT_POI,
		func() -> Vector2i: return hero[0]))
	_expect(ok, "A0 profile port binds the authoritative SaveService")
	return port


func _first_process() -> void:
	var hero: Array = [Vector2i(-1, -1)]
	var port := _port(hero)
	var fresh := _save().call(&"get_snapshot") as Dictionary
	_expect(port.call(&"run_context").is_empty(), "no run is invented before A0 opens one")
	_expect((port.call(&"endpoint_authority", "preservation_kiosk_01") as Dictionary).is_empty(),
		"no endpoint authorizes anything without a live run")
	_expect((port.call(&"read_profile", fresh) as Dictionary).get("secured_ragnarok_currency", -1) == 0,
		"fresh profile has no secured currency")
	_expect((port.call(&"read_profile", fresh) as Dictionary).get("achievements", {}).get("elder_stones", ["x"]) == [],
		"fresh profile has no elder stones")

	var ctx: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS)
	_expect(String(ctx.get("contract", "")) == "soh.economy.a0_run_context.v1", "run context matches the A3 contract")
	_expect(String(ctx.get("status", "")) == "active", "new run reports active")
	_expect(int(ctx.get("expires_at_unix", 0)) - int(ctx.get("run_started_at_unix", 0)) == RUN_MAX_SECONDS,
		"run expiry is the A3 creator-locked window, not a UI value")
	_expect(int(ctx.get("now_unix", 0)) >= int(ctx.get("run_started_at_unix", 0)), "run clock never runs backwards")
	var again: Dictionary = port.call(&"ensure_run", RUN_MAX_SECONDS)
	_expect(String(again.get("run_id", "")) == String(ctx.get("run_id", "")), "a second launch does not open a second run")
	_expect(not String(ctx.get("run_id", "")).is_empty(), "run identity is durable and non-empty")

	# Currency may only be minted inside an A0 commit boundary. A direct call
	# from any other path (UI, chest, death, reset) must fail closed.
	var outside: Dictionary = _save().call(&"get_snapshot")
	_expect(not bool(port.call(&"apply_profile_delta", outside, 5, {"receipt_id": "r-outside"})),
		"profile currency cannot be minted outside an A0 commit boundary")
	_expect(int((port.call(&"read_profile", outside) as Dictionary).get("secured_ragnarok_currency", -1)) == 0,
		"a refused mint leaves the balance untouched")

	var first: Dictionary = port.call(&"commit_profile_delta", "receipt-a", 7, {"kind": "unit"})
	_expect(bool(first.get("ok", false)), "one atomic commit secures currency (%s)" % str(first.get("reason", "")))
	_expect(int(port.call(&"balance")) == 7, "secured balance is 7 after the first deposit")
	var keys: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {})
	_expect(keys.size() >= 2, "the deposit is one durable SaveService receipt (%d)" % keys.size())

	var replay: Dictionary = port.call(&"commit_profile_delta", "receipt-a", 7, {"kind": "unit"})
	_expect(bool(replay.get("duplicate", false)), "a replayed deposit key reports duplicate")
	_expect(int(port.call(&"balance")) == 7, "a replayed deposit never doubles the balance")

	# Same receipt identity under a new transaction key must still be refused.
	var forged: Dictionary = port.call(&"commit_meta_deposit", "proposal-forged", func(candidate: Dictionary) -> Dictionary:
		var applied := bool(port.call(&"apply_profile_delta", candidate, 3, {"receipt_id": "receipt-a"}))
		return {"ok": applied, "reason": "duplicate_profile_receipt"},
		{"token_ids": []})
	_expect(not bool(forged.get("ok", true)), "a duplicate profile receipt cannot be re-applied under a new key")
	_expect(int(port.call(&"balance")) == 7, "a refused meta deposit leaves the balance untouched")

	var atomic: Dictionary = port.call(&"commit_meta_deposit", "proposal-real", func(candidate: Dictionary) -> Dictionary:
		var applied := bool(port.call(&"apply_profile_delta", candidate, 3, {"receipt_id": "receipt-b"}))
		return {"ok": applied, "reason": "" if applied else "rejected"},
		{"token_ids": ["tok-1"]})
	_expect(bool(atomic.get("ok", false)), "one transact_once secures a deposit proposal (%s)" % str(atomic.get("reason", "")))
	_expect(int(port.call(&"balance")) == 10, "secured balance is 10 after the A3 deposit")
	var deposit_key := "soh.a3.meta_deposit.proposal-real"
	_expect(bool(_save().call(&"is_transaction_applied", deposit_key)), "the deposit key is durably applied")
	var atomic_replay: Dictionary = port.call(&"commit_meta_deposit", "proposal-real", func(_candidate: Dictionary) -> Dictionary:
		return {"ok": true}, {})
	_expect(bool(atomic_replay.get("duplicate", false)), "a replayed deposit key returns duplicate")
	_expect(int(port.call(&"balance")) == 10, "a replayed deposit key cannot mint again")

	# A3 rejecting after the port mutated the candidate must commit NOTHING: the
	# SaveService discards the whole candidate, so a full bag cannot half-grant.
	var half: Dictionary = port.call(&"commit_meta_deposit", "proposal-half", func(candidate: Dictionary) -> Dictionary:
		port.call(&"apply_profile_delta", candidate, 4, {"receipt_id": "receipt-c"})
		return {"ok": false, "reason": "full_bag"},
		{})
	_expect(not bool(half.get("ok", true)), "a rejected proposal commits nothing")
	_expect(int(port.call(&"balance")) == 10, "an interrupted commit leaves the old balance intact")
	_expect(not bool(_save().call(&"is_transaction_applied", "soh.a3.meta_deposit.proposal-half")),
		"a rejected proposal leaves no receipt behind")
	var negative: Dictionary = port.call(&"commit_profile_delta", "receipt-neg", -20, {})
	_expect(not bool(negative.get("ok", true)), "the wallet refuses to go negative")
	_expect(int(port.call(&"balance")) == 10, "a refused debit changes nothing")

	# Physical authority: nothing is authorized until the player is physically at
	# the endpoint on an authored stand cell, and the POI has really been found.
	var unseen: Dictionary = port.call(&"endpoint_authority", "preservation_kiosk_01")
	_expect(String(unseen.get("contract", "")) == "soh.economy.meta_endpoint_authority.v1", "endpoint authority speaks the A3 contract")
	_expect(not bool(unseen.get("visited", true)), "an undiscovered endpoint is not visited")
	_expect((unseen.get("hero_cell", [1]) as Array).is_empty(), "a hero away from the authored stand reports no cell")
	var remote: Dictionary = port.call(&"endpoint_authority", "preservation_kiosk_99")
	_expect(remote.is_empty(), "an endpoint outside the A3 directory has no authority")
	hero[0] = Vector2i(408, 199)
	var standing: Dictionary = port.call(&"endpoint_authority", "preservation_kiosk_01")
	_expect((standing.get("hero_cell", []) as Array) == [408, 199], "an authored stand cell reports the real hero cell")
	_expect(not bool(standing.get("visited", true)), "standing on a stand cannot substitute for real discovery")
	hero[0] = Vector2i(409, 199)
	_expect((port.call(&"endpoint_authority", "preservation_kiosk_01") as Dictionary).get("hero_cell", [1]).is_empty(),
		"a cell that is not the authored stand is refused")
	hero[0] = Vector2i(-1, -1)

	var source: Dictionary = port.call(&"source_authority", "roadside_cache", CACHE_INSTANCE)
	_expect(String(source.get("contract", "")) == "soh.economy.meta_source_authority.v1", "source authority speaks the A3 contract")
	_expect(int(source.get("generation", 0)) == 1, "an unclaimed A1 source reports generation 1")
	_expect(not bool(source.get("opened", true)), "an unclaimed A1 source is not opened")
	_expect(String(source.get("run_id", "x")) == String(ctx.get("run_id", "")), "source authority is scoped to the same run")
	_expect((port.call(&"source_authority", "roadside_cache", "si:foreign:99") as Dictionary).is_empty(),
		"a foreign source alias has no authority")

	var snapshot := _save().call(&"get_snapshot") as Dictionary
	var audit := {
		"run_id": ctx.get("run_id", ""),
		"balance": port.call(&"balance"),
		"receipts": (port.call(&"read_profile", snapshot) as Dictionary).get("currency_receipts", []).size(),
		"transactions": (snapshot.get("applied_transactions", {}) as Dictionary).size(),
		"profile": snapshot.get("profile", {}),
		"transactions_keys": (snapshot.get("applied_transactions", {}) as Dictionary).keys(),
	}
	var out := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(out != null, "first process writes the restart audit")
	if out != null:
		out.store_string(JSON.stringify(audit))
		out.close()


func _verify_process() -> void:
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "second process reads the first process audit")
	if file == null:
		return
	var baseline: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(baseline is Dictionary, "restart audit is valid JSON")
	if not baseline is Dictionary:
		return
	var hero: Array = [Vector2i(-1, -1)]
	var port := _port(hero)
	var ctx: Dictionary = port.call(&"run_context")
	_expect(String(ctx.get("run_id", "")) == String((baseline as Dictionary).get("run_id", "")),
		"separate process restores the same run identity")
	_expect(String(ctx.get("status", "")) == "active", "separate process still reports an active run")
	_expect(int(port.call(&"balance")) == int((baseline as Dictionary).get("balance", -1)),
		"separate process restores the exact secured balance")
	var snapshot := _save().call(&"get_snapshot") as Dictionary
	var profile: Dictionary = port.call(&"read_profile", snapshot)
	_expect(int(profile.get("secured_ragnarok_currency", -1)) == 10, "restored wallet holds exactly 10 secured units")
	_expect((profile.get("achievements", {}) as Dictionary).get("elder_stones", ["x"]) == [], "restored profile keeps elder stones empty")
	_expect((profile.get("currency_receipts", []) as Array).size() == int((baseline as Dictionary).get("receipts", -1)),
		"restored wallet keeps exactly the deposited receipts")
	var transactions: Dictionary = snapshot.get("applied_transactions", {})
	_expect(transactions.size() == int((baseline as Dictionary).get("transactions", -1)),
		"relaunch adds no custody receipt by itself")
	_expect(transactions.has("soh.a3.meta_deposit.proposal-real"), "the real deposit receipt survives the relaunch")
	_expect(not transactions.has("soh.a3.meta_deposit.proposal-half"), "the refused proposal is still absent")
	var replay: Dictionary = port.call(&"commit_profile_delta", "receipt-a", 7, {"kind": "unit"})
	_expect(bool(replay.get("duplicate", false)), "a relaunch cannot replay the first deposit")
	_expect(int(port.call(&"balance")) == 10, "a relaunched replay cannot mint currency")
