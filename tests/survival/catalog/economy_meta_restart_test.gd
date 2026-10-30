extends SceneTree
## Two independent OS processes, one durable SaveService save. Proves legitimate
## deposit survives restart, exact-once replay, unbanked loss on reset, secured
## survival, and a new-run fixed-machine paid purchase. OWNER-CONTRACT CANDIDATE.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const Economy = preload("res://game/survival/economy/economy_service.gd")
const PortCandidate = preload("res://tests/survival/catalog/a0_profile_port_candidate.gd")
const PATH := "user://tests/a3_meta_two_process.json"
const RUN_START := 1800000000
const RUN_SECONDS := 1209600
const LAST72 := 950400

var checks := 0
var failures: Array[String] = []
var save: Node
var eco: RefCounted
var port: RefCounted

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _setup_port(run_id: String, now: int) -> void:
	port = PortCandidate.new()
	port.run_ctx = {"contract": "soh.economy.a0_run_context.v1", "run_id": run_id, "run_epoch": 1 if run_id == "run-v7-restart" else 2, "run_started_at_unix": RUN_START if run_id == "run-v7-restart" else now, "now_unix": now, "expires_at_unix": (RUN_START if run_id == "run-v7-restart" else now) + RUN_SECONDS, "status": "active"}
	port.endpoints = {
		"preservation_kiosk_01": {"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "preservation_kiosk_01", "kind": "deposit", "run_id": run_id, "endpoint_revision": "rev-1", "visited": true, "operational": true, "hero_cell": [408, 199]},
		"vending_kiosk_01": {"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "vending_kiosk_01", "kind": "vending", "run_id": run_id, "endpoint_revision": "rev-1", "visited": true, "operational": true, "hero_cell": [410, 199]}}
	port.sources = {"elder_tide_vault|vault-r1": {"contract": "soh.economy.meta_source_authority.v1", "source_id": "elder_tide_vault", "source_instance_id": "vault-r1", "run_id": run_id, "generation": 1, "opened": true, "depleted": false, "phase": "last72"}}

func _commit(method: String, request: Dictionary, prefix: String) -> Dictionary:
	var plan: Dictionary = eco.call(method, request)
	if not bool(plan.get("ok", false)):
		return plan
	var key := prefix + str(plan.proposal_id)
	if bool(save.call(&"is_transaction_applied", key)):
		return {"ok": true, "duplicate": true}
	var result := {"ok": false, "reason": "rejected"}
	var apply_method := method.replace("plan_", "apply_")
	var applied: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var r: Dictionary = eco.call(apply_method, candidate, plan, request)
		for k: Variant in r.keys():
			result[k] = r[k]
		return bool(r.get("ok", false)), {"kind": "a3_meta_restart", "proposal_id": str(plan.proposal_id)}))
	if not applied:
		if bool(save.call(&"is_transaction_applied", key)):
			return {"ok": true, "duplicate": true}
		if bool(result.get("ok", false)):
			return {"ok": false, "reason": "save_failed"}
	result["duplicate"] = false
	return result

func _ensure_tokens(minimum: int, run_id: String) -> void:
	var policy: Dictionary = eco.catalog.get("meta_policy", {})
	for entry: Variant in (policy.get("currency_sources", []) as Array):
		if _tokens().size() >= minimum:
			return
		var source: Dictionary = entry
		var source_id := str(source.get("source_id", ""))
		var instance := source_id + "-restart-1"
		port.sources[source_id + "|" + instance] = {"contract": "soh.economy.meta_source_authority.v1", "source_id": source_id, "source_instance_id": instance, "run_id": run_id, "generation": 1, "opened": true, "depleted": false, "phase": "last72"}
		_commit("plan_meta_source_claim", {"contract": "soh.economy.meta_source_authority.v1", "run_id": run_id, "source_id": source_id, "source_instance_id": instance, "expected_generation": 1, "event_id": "restart.ensure." + source_id}, "soh.a3.meta_restart_source.")

func _secured() -> int:
	return int((save.call(&"get_snapshot") as Dictionary).get("profile", {}).get("secured_ragnarok_currency", 0))

func _tokens() -> Array:
	var out: Array = []
	for record: Variant in eco.owned_instances("ragnarok_unbanked"):
		out.append(str(record.instance_id))
	return out

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		save = SaveServiceClass.new()
		save.name = "SaveService"
		root.add_child(save)
	var phase := OS.get_environment("A3_META_RESTART_PHASE")
	_expect(bool(save.call(&"configure_storage", PATH)), "real SaveService storage")
	eco = Economy.new()
	_expect(bool(eco.configure(save)), "adapter")
	if phase == "1":
		_expect(bool(save.call(&"reset_to_defaults", SaveServiceClass.RESET_ALL_TOKEN)), "explicit test-only reset before phase one")
		_setup_port("run-v7-restart", RUN_START + LAST72 + 7200)
		_expect(bool(eco.configure_meta_profile_port(port)), "phase one profile port")
		var claim: Dictionary = _commit("plan_meta_source_claim", {"contract": "soh.economy.meta_source_authority.v1", "run_id": "run-v7-restart", "source_id": "elder_tide_vault", "source_instance_id": "vault-r1", "expected_generation": 1, "event_id": "restart.claim"}, "soh.a3.meta_restart_source.")
		_expect(bool(claim.ok), "phase one legitimate last-72 claim")
		_ensure_tokens(2, "run-v7-restart")
		var tokens := _tokens()
		_expect(tokens.size() >= 2, "physical currency exists before exit")
		if tokens.size() >= 2:
			var deposit: Dictionary = _commit("plan_meta_deposit", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-restart", "endpoint_id": "preservation_kiosk_01", "token_ids": [tokens[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "restart.deposit"}, "soh.a3.meta_restart_deposit.")
			_expect(bool(deposit.ok), "phase one partial deposit")
			_expect(_secured() == 1, "one unit secured before process exit")
			_expect(_tokens().size() == tokens.size() - 1, "unbanked remainder stays physical")
		print("A3 META RESTART PHASE 1 PASSED - %d checks" % checks)
		quit(0 if failures.is_empty() else 1)
	elif phase == "2":
		_setup_port("run-v7-restart", RUN_START + LAST72 + 7200)
		_expect(bool(eco.configure_meta_profile_port(port)), "phase two profile port after OS restart")
		var secured_before := _secured()
		_expect(secured_before >= 1, "secured deposit survived separate OS process")
		var tokens := _tokens()
		_expect(not tokens.is_empty(), "unbanked physical remainder survived restart")
		if not tokens.is_empty():
			# interrupted write: obstruct temporary save, expect no partial credit
			var save_path := ProjectSettings.globalize_path(PATH)
			DirAccess.make_dir_absolute(save_path + ".tmp")
			var interrupted: Dictionary = _commit("plan_meta_deposit", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-restart", "endpoint_id": "preservation_kiosk_01", "token_ids": [tokens[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "restart.deposit2"}, "soh.a3.meta_restart_deposit.")
			_expect(not bool(interrupted.ok) and str(interrupted.reason) == "save_failed", "interrupted write fails closed")
			_expect(_secured() == secured_before, "no partial profile credit on interrupted write")
			DirAccess.remove_absolute(save_path + ".tmp")
			var retry: Dictionary = _commit("plan_meta_deposit", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-restart", "endpoint_id": "preservation_kiosk_01", "token_ids": [tokens[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "restart.deposit2"}, "soh.a3.meta_restart_deposit.")
			_expect(bool(retry.ok), "retry after interrupted write commits exactly once")
			_expect(_secured() == secured_before + 1, "exact-once credit after retry")
			var replay: Dictionary = _commit("plan_meta_deposit", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-restart", "endpoint_id": "preservation_kiosk_01", "token_ids": [tokens[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "restart.deposit2"}, "soh.a3.meta_restart_deposit.")
			_expect(bool(replay.get("duplicate", false)) or not bool(replay.ok), "receipt replay cannot mint")
		var secured_pre_reset := _secured()
		var new_now := RUN_START + RUN_SECONDS + 50
		_setup_port("run-v7-after", new_now)
		save.call(&"transact_once", "soh.a3.meta_restart.reset", func(candidate: Dictionary) -> bool:
			port.reset_run(candidate, port.run_ctx)
			return true, {})
		_expect(bool(eco.configure_meta_profile_port(port)), "new-run profile port")
		_expect(_secured() == secured_pre_reset, "secured currency survives 14-day expiration/reset")
		_expect(_tokens().is_empty(), "no unbanked currency leaks across run boundary")
		_expect(int((save.call(&"get_snapshot") as Dictionary).get("inventory", {}).get("item_stacks", {}).size()) == 0, "no ordinary item/Core/station/recipe leak")
		var buy: Dictionary = _commit("plan_meta_purchase", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-after", "machine_id": "vending_kiosk_01", "item_id": "field_meal", "quantity": 1, "expected_stock_revision": 1, "expected_policy_revision": 1, "event_id": "restart.buy"}, "soh.a3.meta_restart_purchase.")
		_expect(bool(buy.ok), "new-run physical machine paid purchase")
		_expect(_secured() == secured_pre_reset - 1, "purchase debits secured balance exactly")
		print("A3 META RESTART PHASE 2 PASSED - %d checks" % checks)
		quit(0 if failures.is_empty() else 1)
	else:
		print("A3_META_RESTART_PHASE must be 1 or 2")
		quit(2)
