extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## D063 / D066 / D067 / D074 — the two-layer economy, driven against A3's real V7
## planner and then against the runtime A0 actually ships.
##
## ## The split that matters
## A3's `meta_economy_planner.gd` is real code with real rules: it refuses a chest
## before the last 72 hours, refuses a deposit away from a physical endpoint, refuses
## a replayed token, refuses a vending purchase the secured balance cannot cover, and
## forbids a recycler that emits profile currency. None of that is a wish list, so
## this probe drives it and reports what it does.
##
## The runtime is a different question. `save_service.gd` preloads
## `game/survival/economy/vendor/a3_economy_service.gd` and `a0_v5_source_pins.gd`
## pins that file by sha256, so the version of A3 that reaches a player is V5 — which
## has no `configure_meta_profile_port`, no `plan_meta_source_claim` and no
## `plan_meta_deposit`. The rules exist and cannot be reached. Both facts are
## asserted, separately, because one is A3's success and the other is the product's
## gap.
##
## Every number produced through A7's port double is printed as `MODEL_ORACLE`.

const ECONOMY := "res://game/survival/economy/economy_service.gd"
const VENDORED := "res://game/survival/economy/vendor/a3_economy_service.gd"
const META_POLICY := "res://data/survival/recipes/meta_economy.v1.json"
const PORT_DOUBLE := "res://tests/survival/balance_native_r9/r9_profile_port_double.gd"

const RUN_ID := "run-r9"
const RUN_START := 1800000000
const META_API := [
	"configure_meta_profile_port", "plan_meta_source_claim", "apply_meta_source_claim",
	"plan_meta_deposit", "apply_meta_deposit", "plan_meta_purchase", "plan_meta_recycle",
	"plan_meta_refund",
]


func _body() -> void:
	probe_id = "R9ECO"
	probe_title = "A3 V7 currency custody is real and enforced; the shipped runtime cannot reach it"
	owner_action = (
		"A0: implement `soh.economy.a0_profile_port.v1` inside SaveService (run_context, endpoint_authority, "
		+ "source_authority, read_profile, apply_profile_delta) and stop pinning the V5 vendored adapter, so A3's "
		+ "V7 meta economy can be mounted. Until then no player can bank a Ragnarok currency token."
	)

	# ---- 1. runtime surface: which A3 the product actually loads ---------
	var vendored := _has_methods(VENDORED, META_API)
	var canonical := _has_methods(ECONOMY, META_API)
	_note("runtime_vendor_present=%s canonical_present=%s" % [JSON.stringify(vendored["present"]), JSON.stringify(canonical["present"])])
	_note("runtime_vendor_absent=%s" % JSON.stringify(vendored["absent"]))
	if not vendored["absent"].is_empty():
		_missing(
			"the meta-economy API in the adapter the runtime loads (absent: %s)" % JSON.stringify(vendored["absent"]),
			VENDORED
		)
	_expect(canonical["absent"].is_empty(), "A3's canonical service in this composition declares the whole meta API")

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	var snapshot := _snapshot()
	_note("save_sections=%s" % JSON.stringify(_sorted(snapshot.keys())))
	if not snapshot.has("profile"):
		_missing(
			"a `profile` namespace in the authoritative save (D056's three durable categories live there)",
			SAVE_SERVICE
		)
	var profile_port := bool(save.has_method(&"run_context")) and bool(save.has_method(&"apply_profile_delta"))
	_note("save_service_has_profile_port=%s" % str(profile_port))
	if not profile_port:
		_missing(
			"SaveService profile port: run_context / endpoint_authority / source_authority / read_profile / "
			+ "apply_profile_delta",
			SAVE_SERVICE
		)

	# ---- 2. A3's rules, executed ----------------------------------------
	if FileAccess.file_exists(ECONOMY):
		_a3_rules(save)
	else:
		_missing("A3's canonical economy service in this composition", ECONOMY)

	_done()


func _a3_rules(save: Node) -> void:
	var economy_script: Script = load(ECONOMY) as Script
	var port_script: Script = load(PORT_DOUBLE) as Script
	if economy_script == null or port_script == null:
		_missing("an instantiable A3 economy service plus A7's port double", ECONOMY)
		return
	var econ: RefCounted = economy_script.new()
	var configured := bool(econ.call(&"configure", save))
	_note("a3_configure(save)=%s" % str(configured))
	_expect(configured, "A3's economy service configures against the composed SaveService")

	# Fail-closed without the port: this is the honest product state.
	var no_port: Variant = econ.call(&"plan_meta_source_claim", _claim_request("vault-0", 1, "noport"))
	_note("MODEL_ORACLE no_port_plan=%s" % JSON.stringify(_short(no_port)))
	_expect(
		not bool(no_port.get("ok", false)) and String(no_port.get("reason", "")) == "A0_PROFILE_BOUNDARY_ABSENT",
		"without an A0 port every meta operation fails closed by name, not silently"
	)

	var port: RefCounted = port_script.new()
	port.set("run_ctx", _run_context(RUN_START + 950400 + 3600))
	port.set("endpoints", _endpoints())
	port.set("sources", {"elder_ashen_vault|vault-1": _source("elder_ashen_vault", "vault-1", 1)})
	var meta_ok := bool(econ.call(&"configure_meta_profile_port", port))
	_note("configure_meta_profile_port=%s" % str(meta_ok))
	_expect(meta_ok, "A3 accepts a port that implements the published contract")

	# ---- premature currency, and the exact boundary --------------------
	for case: Array in [
		["hour_1", RUN_START + 3600],
		["hour_263", RUN_START + 263 * 3600],
		["hour_264_minus_1s", RUN_START + 950400 - 1],
	]:
		_set_now(port, int(case[1]))
		var early: Variant = econ.call(&"plan_meta_source_claim", _claim_request("vault-1", 1, "early.%s" % case[0]))
		_note("MODEL_ORACLE claim_at_%s=%s" % [String(case[0]), String(early.get("reason", "ok"))])
		_expect(
			String(early.get("reason", "")) == "premature_ragnarok_claim",
			"a chest cannot mint Ragnarok currency before hour 264 (%s)" % String(case[0])
		)
	_set_now(port, RUN_START + 950400)
	var at_boundary: Dictionary = econ.call(&"plan_meta_source_claim", _claim_request("vault-1", 1, "boundary"))
	_note("MODEL_ORACLE claim_at_264h=%s units=%s" % [str(at_boundary.get("ok", false)), str(at_boundary.get("units", -1))])
	_expect(bool(at_boundary.get("ok", false)), "the claim window opens exactly at hour 264")

	# ---- forged source identity ---------------------------------------
	for forgery: Array in [
		["wrong_generation", 2, "source_generation_forgery"],
		["depleted", 1, "source_not_openable"],
	]:
		var source := _source("elder_ashen_vault", "vault-1", int(forgery[1]))
		if String(forgery[0]) == "depleted":
			source["depleted"] = true
		port.set("sources", {"elder_ashen_vault|vault-1": source})
		var forged: Dictionary = econ.call(&"plan_meta_source_claim", _claim_request("vault-1", 1, "forge.%s" % String(forgery[0])))
		_note("MODEL_ORACLE forged_source_%s=%s" % [String(forgery[0]), String(forged.get("reason", "ok"))])
		_expect(String(forged.get("reason", "")) == String(forgery[2]), "a forged source is refused (%s)" % String(forgery[0]))
	port.set("sources", {"elder_ashen_vault|vault-1": _source("elder_ashen_vault", "vault-1", 1)})

	# ---- expiry closes everything -------------------------------------
	_set_now(port, RUN_START + 1209600)
	var expired: Dictionary = econ.call(&"plan_meta_source_claim", _claim_request("vault-2", 1, "expired"))
	_note("MODEL_ORACLE claim_after_expiry=%s" % String(expired.get("reason", "ok")))
	_expect(String(expired.get("reason", "")) == "run_expired", "no currency can be minted after the run expires")
	_set_now(port, RUN_START + 950400 + 3600)
	port.set("sources", {
		"elder_ashen_vault|vault-1": _source("elder_ashen_vault", "vault-1", 1),
		"elder_ashen_vault|vault-2": _source("elder_ashen_vault", "vault-2", 1),
	})

	# ---- deposit: physical, positional, replay-proof -------------------
	# A player holding no token cannot deposit one, whatever the endpoint says.
	var empty_deposit: Dictionary = econ.call(&"plan_meta_deposit", _deposit_request("preservation_kiosk_01", ["token-not-held"], "rev-1"))
	_note("MODEL_ORACLE deposit_without_token=%s" % String(empty_deposit.get("reason", "ok")))
	_expect(String(empty_deposit.get("reason", "")).begins_with("token_not_in_bag_custody"), "a deposit needs a token that is physically in the bag")

	# The endpoint is a place: wrong cell, wrong revision, not visited, wrong run.
	# Fourth entry: whether the exact reason is assertable. `endpoint_revision_stale`
	# sits *downstream* of token custody in A3's order, and this double holds no claim
	# receipt, so the revision forgery is refused for custody first. Recording that as
	# a failure of the revision rule would be a false accusation; recording it as a
	# pass of the revision rule would be an unearned claim. It is therefore asserted
	# as "refused", with the ordering noted, and the rule itself stays unmeasured
	# here — the custody check that shielded it *is* measured above.
	for forgery: Array in [
		["wrong_cell", {"hero_cell": [0, 0]}, "hero_not_at_endpoint", true],
		["stale_revision", {"endpoint_revision": "rev-0"}, "token_not_in_bag_custody:orphan_token", false],
		["not_visited", {"visited": false}, "endpoint_not_visited_or_offline", true],
		["wrong_run", {"run_id": "other-run"}, "endpoint_identity_mismatch", true],
		["wrong_kind", {"kind": "vending"}, "endpoint_authority_absent", true],
	]:
		var endpoints: Dictionary = _endpoints()
		var kiosk: Dictionary = endpoints["preservation_kiosk_01"]
		for key: String in (forgery[1] as Dictionary).keys():
			kiosk[key] = (forgery[1] as Dictionary)[key]
		endpoints["preservation_kiosk_01"] = kiosk
		port.set("endpoints", endpoints)
		var plan: Dictionary = econ.call(&"plan_meta_deposit", _deposit_request("preservation_kiosk_01", ["token-1"], String(kiosk.get("endpoint_revision", "rev-1"))))
		var observed := String(plan.get("reason", "ok"))
		_note("MODEL_ORACLE deposit_forgery_%s=%s%s" % [
			String(forgery[0]), observed, "" if bool(forgery[3]) else " (refused earlier by custody order)",
		])
		if bool(forgery[3]):
			_expect(observed == String(forgery[2]), "a forged deposit endpoint is refused (%s)" % String(forgery[0]))
		else:
			_expect(not bool(plan.get("ok", false)), "a forged deposit endpoint is refused (%s)" % String(forgery[0]))
			_expect(observed == String(forgery[2]),
				"the revision forgery is stopped by the custody rule that runs before it (%s)" % String(forgery[0]))
	port.set("endpoints", _endpoints())

	# A well-formed deposit request with no tokens held is still refused, and the
	# refusal happens before any profile write.
	var writes_before := int(port.get("profile_writes"))
	var clean: Dictionary = econ.call(&"plan_meta_deposit", _deposit_request("preservation_kiosk_01", ["token-1"], "rev-1"))
	_note("MODEL_ORACLE clean_deposit_without_custody=%s" % String(clean.get("reason", "ok")))
	_expect(not bool(clean.get("ok", false)), "a plan for a token the bag does not hold does not succeed")
	_expect(int(port.get("profile_writes")) == writes_before, "a refused plan writes nothing to the durable balance")

	# ---- vending and recycling cannot mint ----------------------------
	var purchase_without_money: Dictionary = econ.call(&"plan_meta_purchase", _purchase_request("field_meal", 1, 1))
	_note("MODEL_ORACLE purchase_with_zero_balance=%s" % String(purchase_without_money.get("reason", "ok")))
	_expect(
		String(purchase_without_money.get("reason", "")) == "insufficient_secured_currency",
		"a vending purchase cannot be paid for out of a zero secured balance"
	)
	var policy: Dictionary = _json(META_POLICY).get("policy", {})
	var recycler_delta := -1
	var recycler_ids: Array = []
	for entry: Variant in (policy.get("recycler_salvage", {}) as Dictionary).values():
		recycler_delta = int((entry as Dictionary).get("profile_currency_delta", -1))
		for item: Variant in ((entry as Dictionary).get("outputs", {}) as Dictionary).keys():
			recycler_ids.append(String(item))
	_note("MODEL_ORACLE recycler_profile_currency_delta=%d outputs=%s" % [recycler_delta, JSON.stringify(recycler_ids)])
	_expect(recycler_delta == 0, "the recycler's declared profile-currency delta is zero (no money printer)")
	_expect(not recycler_ids.is_empty(), "the recycler produces salvage items rather than currency")

	var stone_value := -1
	var stones: Array = policy.get("elder_stones", [])
	for stone: Variant in stones:
		stone_value = maxi(stone_value, int((stone as Dictionary).get("currency_value", -1)))
	_note("MODEL_ORACLE elder_stones=%d max_currency_value=%d" % [stones.size(), stone_value])
	_expect(stones.size() == 6, "the policy declares exactly six elder stones")
	_expect(stone_value == 0, "a stone is never convertible into currency")

	var forbidden: Array = policy.get("forbidden_meta_effects", [])
	_note("MODEL_ORACLE forbidden_effects=%d" % forbidden.size())
	for needle: String in [
		"automatic_profile_credit_on_chest_open",
		"automatic_profile_credit_on_run_expiry",
		"recycler_profile_currency_output",
		"stone_to_currency_conversion",
	]:
		_expect(forbidden.has(needle), "the policy forbids %s" % needle)


# ----------------------------------------------------------------- requests
func _claim_request(instance: String, generation: int, event: String) -> Dictionary:
	return {
		"contract": "soh.economy.meta_source_authority.v1",
		"run_id": RUN_ID,
		"source_id": "elder_ashen_vault",
		"source_instance_id": instance,
		"expected_generation": generation,
		"event_id": event,
	}


func _deposit_request(endpoint: String, tokens: Array, revision: String) -> Dictionary:
	return {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": RUN_ID,
		"endpoint_id": endpoint,
		"token_ids": tokens,
		"expected_policy_revision": 1,
		"expected_endpoint_revision": revision,
		"event_id": "deposit",
	}


func _purchase_request(item: String, quantity: int, stock_revision: int) -> Dictionary:
	return {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": RUN_ID,
		"machine_id": "vending_kiosk_01",
		"item_id": item,
		"quantity": quantity,
		"expected_stock_revision": stock_revision,
		"expected_policy_revision": 1,
		"event_id": "purchase",
	}


func _run_context(now: int) -> Dictionary:
	return {
		"contract": "soh.economy.a0_run_context.v1",
		"run_id": RUN_ID,
		"run_epoch": 1,
		"run_started_at_unix": RUN_START,
		"now_unix": now,
		"expires_at_unix": RUN_START + 1209600,
		"status": "active",
	}


func _set_now(port: RefCounted, now: int) -> void:
	var ctx: Dictionary = port.get("run_ctx")
	ctx["now_unix"] = now
	port.set("run_ctx", ctx)


func _endpoints() -> Dictionary:
	return {
		"preservation_kiosk_01": {
			"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "preservation_kiosk_01",
			"kind": "deposit", "run_id": RUN_ID, "endpoint_revision": "rev-1",
			"visited": true, "operational": true, "hero_cell": [408, 199],
		},
		"vending_kiosk_01": {
			"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "vending_kiosk_01",
			"kind": "vending", "run_id": RUN_ID, "endpoint_revision": "rev-1",
			"visited": true, "operational": true, "hero_cell": [410, 199],
		},
		"recycler_01": {
			"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "recycler_01",
			"kind": "recycler", "run_id": RUN_ID, "endpoint_revision": "rev-1",
			"visited": true, "operational": true, "hero_cell": [412, 199],
		},
	}


func _source(source_id: String, instance: String, generation: int) -> Dictionary:
	return {
		"contract": "soh.economy.meta_source_authority.v1", "source_id": source_id,
		"source_instance_id": instance, "run_id": RUN_ID, "generation": generation,
		"opened": true, "depleted": false, "phase": "last72",
	}


func _short(plan: Variant) -> Dictionary:
	if not plan is Dictionary:
		return {"value": str(plan)}
	var out: Dictionary = {}
	for key: String in ["ok", "reason", "units", "amount", "cost"]:
		if (plan as Dictionary).has(key):
			out[key] = (plan as Dictionary)[key]
	return out


func _sorted(keys: Array) -> Array:
	var copy: Array = keys.duplicate()
	copy.sort()
	return copy
