extends RefCounted
## SURV-030A V7 two-layer meta-economy planner (D062-D067).
##
## NOT a wallet, NOT a second save authority, NOT a run lifecycle owner.
## A0 injects one profile port that reads/writes the SAME SaveService candidate.
## Without that port every meta plan fails closed: A0_PROFILE_BOUNDARY_ABSENT.
## Physical late-Ragnarok currency is a losable unique inventory token. Secured
## profile balance changes only inside one authoritative A0 SaveService commit.

const Offline = preload("res://game/survival/economy/offline_operation_planner.gd")
const ROOT := "survival_economy"
const PLAN_CONTRACT := "soh.economy.meta_plan.v1"
const SOURCE_AUTH_CONTRACT := "soh.economy.meta_source_authority.v1"
const ENDPOINT_AUTH_CONTRACT := "soh.economy.meta_endpoint_authority.v1"
const PROFILE_PORT_CONTRACT := "soh.economy.a0_profile_port.v1"
const RUN_CONTEXT_CONTRACT := "soh.economy.a0_run_context.v1"
const RUN_MAX_SECONDS := 1209600
const RAGNAROK_START_SECONDS := 950400
const MAX_TOKENS_PER_DEPOSIT := 50

var _adapter: RefCounted
var _policy: Dictionary = {}
var _policy_sha256 := ""
var _profile_port: RefCounted

func configure(adapter: RefCounted, policy: Dictionary, profile_port: RefCounted = null) -> bool:
	_adapter = adapter
	_policy = policy.duplicate(true)
	_policy_sha256 = Offline.canonical_sha256(_policy)
	_profile_port = profile_port
	return validate_policy() == ""

func set_profile_port(port: RefCounted) -> void:
	_profile_port = port

func policy_sha256() -> String:
	return _policy_sha256

func validate_policy() -> String:
	if _policy.is_empty():
		return "missing_meta_policy"
	if str(_policy.get("policy_id", "")).is_empty() or str(_policy.get("rate_approval", "")) != "AI_TUNABLE_NOT_CREATOR_LOCKED":
		return "invalid_meta_policy_identity"
	var locked: Dictionary = _policy.get("creator_locked", {})
	if int(locked.get("run_max_seconds", 0)) != RUN_MAX_SECONDS or int(locked.get("ragnarok_start_elapsed_seconds", 0)) != RAGNAROK_START_SECONDS:
		return "invalid_creator_locked_time"
	if int(locked.get("elder_region_count", 0)) != 6 or not bool(locked.get("physical_deposit_required", false)):
		return "invalid_creator_locked_structure"
	if not bool(locked.get("no_core_vendor", false)) or not bool(locked.get("no_automatic_starting_kit", false)):
		return "forbidden_vendor_automation"
	var ids: Dictionary = _policy.get("technical_ids", {})
	if str(ids.get("physical_currency_item", "")) != "ragnarok_unbanked":
		return "invalid_currency_technical_id"
	for field in ["currency_sources", "elder_stones", "deposit_endpoints", "vending_machines", "recycler_machines", "forbidden_meta_effects"]:
		if not _policy.get(field) is Array:
			return "invalid_meta_policy_list:" + field
	var stones: Array = _policy.get("elder_stones", [])
	if stones.size() != 6:
		return "elder_stone_count_not_six"
	for stone: Variant in stones:
		if not stone is Dictionary or int((stone as Dictionary).get("currency_value", -1)) != 0 or bool((stone as Dictionary).get("vendor_purchasable", true)):
			return "stone_must_not_be_currency_or_vendor_good"
	if _adapter != null and not _adapter.catalog.is_empty():
		var currency_id := str(ids.get("physical_currency_item", ""))
		var definition: Dictionary = _adapter.item(currency_id)
		if definition.is_empty() or str(definition.get("storage", "")) != "instance" or str(definition.get("kind", "")) != "key_item":
			return "currency_must_be_unique_physical_token"
		for machine: Variant in (_policy.get("vending_machines", []) as Array):
			for item_id: Variant in ((machine as Dictionary).get("stock", {}) as Dictionary).keys():
				var def: Dictionary = _adapter.item(str(item_id))
				if def.is_empty() or str(def.get("kind", "")) in ["skill_core", "key_item"] or int(def.get("tier", 0)) > 2:
					return "forbidden_vendor_item:" + str(item_id)
		for item_id: Variant in (_policy.get("recycler_salvage", {}) as Dictionary).keys():
			var entry: Dictionary = _policy["recycler_salvage"][item_id]
			if int(entry.get("profile_currency_delta", -1)) != 0:
				return "recycler_must_not_emit_profile_currency"
			for out: Variant in (entry.get("outputs", {}) as Dictionary).keys():
				if _adapter.item(str(out)).is_empty():
					return "unknown_recycler_output:" + str(out)
	return ""

static func empty_state() -> Dictionary:
	return {"schema": 1, "run_id": "", "policy_sha256": "", "source_claims": {}, "deposits": {}, "vendor_stock": {}, "purchases": {}, "recycles": {}}

static func state_error(raw: Variant) -> String:
	if not raw is Dictionary:
		return "invalid_meta_state"
	var s: Dictionary = raw
	if int(s.get("schema", 0)) != 1:
		return "unsupported_meta_schema"
	for field in ["run_id", "policy_sha256"]:
		if not s.get(field) is String:
			return "invalid_meta_field:" + field
	for field in ["source_claims", "deposits", "vendor_stock", "purchases", "recycles"]:
		if not s.get(field) is Dictionary:
			return "invalid_meta_field:" + field
	return ""

func _meta(candidate: Dictionary) -> Dictionary:
	var economy: Dictionary = candidate.get(ROOT, {})
	var raw: Variant = economy.get("meta", {})
	if not raw is Dictionary:
		return empty_state()
	return raw

func _mut_meta(candidate: Dictionary) -> Dictionary:
	var economy: Dictionary = candidate.get(ROOT, {})
	if not economy.has("meta") or not economy["meta"] is Dictionary:
		economy["meta"] = empty_state()
	candidate[ROOT] = economy
	return economy["meta"]

func _fail(reason: String) -> Dictionary:
	return {"ok": false, "reason": reason, "contract": PLAN_CONTRACT}

func _port_error() -> String:
	if _profile_port == null:
		return "A0_PROFILE_BOUNDARY_ABSENT"
	for method in ["run_context", "endpoint_authority", "source_authority", "read_profile", "apply_profile_delta"]:
		if not _profile_port.has_method(StringName(method)):
			return "A0_PROFILE_PORT_INCOMPLETE:" + method
	return ""

func _run_context() -> Dictionary:
	var value: Variant = _profile_port.call(&"run_context")
	if not value is Dictionary:
		return {}
	var ctx: Dictionary = value
	if str(ctx.get("contract", "")) != RUN_CONTEXT_CONTRACT:
		return {}
	return ctx

func _run_active(ctx: Dictionary) -> String:
	if str(ctx.get("status", "")) != "active":
		return "run_not_active"
	var started := int(ctx.get("run_started_at_unix", 0))
	var now := int(ctx.get("now_unix", 0))
	if now < started:
		return "clock_rollback"
	if now - started >= RUN_MAX_SECONDS:
		return "run_expired"
	return ""

func _endpoint(endpoint_id: String, kind: String) -> Dictionary:
	var value: Variant = _profile_port.call(&"endpoint_authority", endpoint_id)
	if not value is Dictionary:
		return {}
	var auth: Dictionary = value
	if str(auth.get("contract", "")) != ENDPOINT_AUTH_CONTRACT or str(auth.get("kind", "")) != kind:
		return {}
	return auth

func _endpoint_error(auth: Dictionary, endpoint_id: String, ctx: Dictionary, expected_revision: String) -> String:
	if auth.is_empty():
		return "endpoint_authority_absent"
	if str(auth.get("endpoint_id", "")) != endpoint_id or str(auth.get("run_id", "")) != str(ctx.get("run_id", "")):
		return "endpoint_identity_mismatch"
	if not bool(auth.get("visited", false)) or not bool(auth.get("operational", false)):
		return "endpoint_not_visited_or_offline"
	if str(auth.get("endpoint_revision", "")) != expected_revision:
		return "endpoint_revision_stale"
	var policy_endpoints: Array = []
	if str(auth.get("kind", "")) == "deposit":
		policy_endpoints = _policy.get("deposit_endpoints", [])
	elif str(auth.get("kind", "")) == "vending":
		policy_endpoints = _policy.get("vending_machines", [])
	else:
		policy_endpoints = _policy.get("recycler_machines", [])
	var definition: Dictionary = {}
	for entry: Variant in policy_endpoints:
		var e: Dictionary = entry
		if str(e.get("endpoint_id", e.get("machine_id", ""))) == endpoint_id:
			definition = e
			break
	if definition.is_empty():
		return "endpoint_not_policy_authorized"
	var hero: Variant = auth.get("hero_cell", [])
	var matched := false
	for cell: Variant in (definition.get("stand_cells", []) as Array):
		if hero is Array and cell is Array and (hero as Array).size() == 2 and (cell as Array).size() == 2 and int(hero[0]) == int(cell[0]) and int(hero[1]) == int(cell[1]):
			matched = true
	if not matched:
		return "hero_not_at_endpoint"
	return ""

func _source_policy(source_id: String) -> Dictionary:
	for entry: Variant in (_policy.get("currency_sources", []) as Array):
		var s: Dictionary = entry
		if str(s.get("source_id", "")) == source_id:
			return s
	return {}

func _profile(candidate: Dictionary) -> Dictionary:
	var value: Variant = _profile_port.call(&"read_profile", candidate)
	return value if value is Dictionary else {}

func _secured(candidate: Dictionary) -> int:
	return int(_profile(candidate).get("secured_ragnarok_currency", 0))

## Read-only late-Ragnarok source claim plan. A0/A8 must commit the physical
## token grant together with source depletion. Opening a chest never banks.
func plan_source_claim(request: Variant) -> Dictionary:
	var err := _port_error()
	if not err.is_empty():
		return _fail(err)
	if not request is Dictionary:
		return _fail("invalid_meta_source_request")
	var req: Dictionary = request
	for field in ["contract", "run_id", "source_id", "source_instance_id", "expected_generation", "event_id"]:
		if not req.has(field):
			return _fail("missing_meta_source_field:" + field)
	if str(req.get("contract", "")) != SOURCE_AUTH_CONTRACT:
		return _fail("invalid_meta_source_contract")
	var ctx := _run_context()
	var active := _run_active(ctx)
	if not active.is_empty():
		return _fail(active)
	if str(req.get("run_id", "")) != str(ctx.get("run_id", "")):
		return _fail("run_identity_mismatch")
	var elapsed := int(ctx.get("now_unix", 0)) - int(ctx.get("run_started_at_unix", 0))
	if elapsed < RAGNAROK_START_SECONDS:
		return _fail("premature_ragnarok_claim")
	var source_id := str(req.get("source_id", ""))
	var policy := _source_policy(source_id)
	if policy.is_empty():
		return _fail("source_not_policy_authorized")
	var value: Variant = _profile_port.call(&"source_authority", source_id, str(req.get("source_instance_id", "")))
	if not value is Dictionary:
		return _fail("source_authority_absent")
	var auth: Dictionary = value
	if str(auth.get("contract", "")) != SOURCE_AUTH_CONTRACT or str(auth.get("source_id", "")) != source_id or str(auth.get("source_instance_id", "")) != str(req.get("source_instance_id", "")) or str(auth.get("run_id", "")) != str(req.get("run_id", "")):
		return _fail("source_identity_forgery")
	if int(auth.get("generation", -1)) != int(req.get("expected_generation", -2)):
		return _fail("source_generation_forgery")
	if not bool(auth.get("opened", false)) or bool(auth.get("depleted", false)):
		return _fail("source_not_openable")
	var snapshot: Dictionary = _adapter._save.call(&"get_snapshot")
	var meta := _meta(snapshot)
	var claims: Dictionary = meta.get("source_claims", {})
	var source_claim_count := 0
	for claim: Variant in claims.values():
		if str((claim as Dictionary).get("source_id", "")) == source_id:
			source_claim_count += 1
	if claims.has(str(req.get("source_instance_id", ""))):
		return _fail("source_instance_already_claimed")
	if source_claim_count >= int(policy.get("max_claims_per_run", 0)):
		return _fail("source_run_cap_reached")
	var roll_input := {"run_id": str(req.get("run_id", "")), "source_id": source_id, "source_instance_id": str(req.get("source_instance_id", "")), "generation": int(req.get("expected_generation", 0)), "policy_sha256": _policy_sha256}
	var roll_hash := Offline.canonical_sha256(roll_input)
	var roll := float(int(roll_hash.substr(0, 8).hex_to_int())) / 4294967295.0
	var units := 0
	if roll <= float(policy.get("drop_chance", 0.0)):
		var span := int(policy.get("max_units", 0)) - int(policy.get("min_units", 0)) + 1
		units = int(policy.get("min_units", 0)) + int(roll_hash.substr(8, 8).hex_to_int()) % maxi(1, span)
	var proposal_id := Offline.canonical_sha256({"request": req, "policy_sha256": _policy_sha256, "meta_sha256": Offline.canonical_sha256(meta), "units": units})
	return {"ok": true, "contract": PLAN_CONTRACT, "kind": "source_claim", "proposal_id": proposal_id, "request": req.duplicate(true), "policy_sha256": _policy_sha256, "units": units, "physical_item_id": "ragnarok_unbanked", "profile_delta": 0, "source_id": source_id, "source_instance_id": str(req.get("source_instance_id", "")), "receipt_metadata": {"kind": "a3_meta_source_claim", "proposal_id": proposal_id, "run_id": str(req.get("run_id", "")), "source_id": source_id}}

func apply_source_claim(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	var replan := plan_source_claim(request)
	if not bool(replan.get("ok", false)):
		return replan
	if str(replan.get("proposal_id", "")) != str(proposal.get("proposal_id", "")):
		return _fail("stale_meta_source_proposal")
	var units := int(replan.get("units", 0))
	var meta := _mut_meta(candidate)
	var state: Dictionary = _adapter._state(candidate)
	var token_ids: Array[String] = []
	var trial: Dictionary = candidate.duplicate(true)
	var trial_state: Dictionary = _adapter._state(trial)
	for i in range(units):
		var record: Dictionary = _adapter._new_instance(trial_state, "ragnarok_unbanked", "bag")
		record["origin"] = "meta_source:" + str(replan.get("source_instance_id", ""))
		if not _adapter._add(trial, str(record["instance_id"]), 1, "key_item"):
			return _fail("inventory_full")
		token_ids.append(str(record["instance_id"]))
	if units > 0:
		for i in range(units):
			var record: Dictionary = _adapter._new_instance(state, "ragnarok_unbanked", "bag")
			record["origin"] = "meta_source:" + str(replan.get("source_instance_id", ""))
			if not _adapter._add(candidate, str(record["instance_id"]), 1, "key_item"):
				return _fail("inventory_full")
			token_ids[i] = str(record["instance_id"])
	var claims: Dictionary = meta.get("source_claims", {})
	claims[str(replan.get("source_instance_id", ""))] = {"source_id": str(replan.get("source_id", "")), "generation": int((request as Dictionary).get("expected_generation", 0)), "units": units, "token_ids": token_ids, "policy_sha256": _policy_sha256}
	meta["source_claims"] = claims
	meta["run_id"] = str((request as Dictionary).get("run_id", ""))
	meta["policy_sha256"] = _policy_sha256
	candidate[ROOT] = _merge_meta_into_economy(candidate, meta)
	_adapter._candidate_reset_state(candidate)
	return {"ok": true, "kind": "source_claim", "proposal_id": str(replan.get("proposal_id", "")), "units": units, "token_ids": token_ids, "profile_delta": 0, "receipt_metadata": replan.get("receipt_metadata", {})}

## Read-only deposit plan. Physical tokens must be in the player's bag at an
## authorized preservation endpoint. Home chests/death bags/expiry never bank.
func plan_deposit(request: Variant) -> Dictionary:
	var err := _port_error()
	if not err.is_empty():
		return _fail(err)
	if not request is Dictionary:
		return _fail("invalid_deposit_request")
	var req: Dictionary = request
	for field in ["contract", "run_id", "endpoint_id", "token_ids", "expected_policy_revision", "expected_endpoint_revision", "event_id"]:
		if not req.has(field):
			return _fail("missing_deposit_field:" + field)
	if str(req.get("contract", "")) != PLAN_CONTRACT:
		return _fail("invalid_deposit_contract")
	var ctx := _run_context()
	var active := _run_active(ctx)
	if not active.is_empty():
		return _fail(active)
	if str(req.get("run_id", "")) != str(ctx.get("run_id", "")):
		return _fail("run_identity_mismatch")
	if int(req.get("expected_policy_revision", -1)) != int(_policy.get("policy_revision", -2)):
		return _fail("policy_revision_stale")
	var endpoint_id := str(req.get("endpoint_id", ""))
	var auth := _endpoint(endpoint_id, "deposit")
	var endpoint_error := _endpoint_error(auth, endpoint_id, ctx, str(req.get("expected_endpoint_revision", "")))
	if not endpoint_error.is_empty():
		return _fail(endpoint_error)
	if not req.get("token_ids") is Array:
		return _fail("invalid_token_list")
	var tokens: Array = req["token_ids"]
	if tokens.is_empty() or tokens.size() > MAX_TOKENS_PER_DEPOSIT:
		return _fail("invalid_deposit_token_count")
	var snapshot: Dictionary = _adapter._save.call(&"get_snapshot")
	var state: Dictionary = _adapter._state(snapshot)
	var meta := _meta(snapshot)
	var seen := {}
	for token: Variant in tokens:
		var token_id := str(token)
		if seen.has(token_id):
			return _fail("duplicate_token_in_request")
		seen[token_id] = true
		var token_error: String = _adapter._token_error(snapshot, state, token_id)
		if not token_error.is_empty():
			return _fail("token_not_in_bag_custody:" + token_error)
		var record: Dictionary = state["instances"][token_id]
		if str(record.get("item_id", "")) != "ragnarok_unbanked":
			return _fail("not_physical_currency_token")
		var origin := str(record.get("origin", ""))
		if not origin.begins_with("meta_source:"):
			return _fail("unauthorized_source_conversion")
		var source_instance := origin.trim_prefix("meta_source:")
		var claim: Dictionary = (meta.get("source_claims", {}) as Dictionary).get(source_instance, {})
		if claim.is_empty() or not (claim.get("token_ids", []) as Array).has(token_id):
			return _fail("source_claim_receipt_missing")
		if (meta.get("deposits", {}) as Dictionary).has(token_id):
			return _fail("token_already_deposited")
	var amount := tokens.size()
	var proposal_id := Offline.canonical_sha256({"request": req, "policy_sha256": _policy_sha256, "meta_sha256": Offline.canonical_sha256(meta), "secured_before": _secured(snapshot)})
	return {"ok": true, "contract": PLAN_CONTRACT, "kind": "deposit", "proposal_id": proposal_id, "request": req.duplicate(true), "policy_sha256": _policy_sha256, "amount": amount, "token_ids": tokens.duplicate(true), "profile_delta": amount, "secured_before": _secured(snapshot), "secured_after": _secured(snapshot) + amount, "receipt_metadata": {"kind": "a3_meta_deposit", "proposal_id": proposal_id, "run_id": str(req.get("run_id", "")), "endpoint_id": endpoint_id, "amount": amount}}

func apply_deposit(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	var replan := plan_deposit(request)
	if not bool(replan.get("ok", false)):
		return replan
	if str(replan.get("proposal_id", "")) != str(proposal.get("proposal_id", "")):
		return _fail("stale_meta_deposit_proposal")
	var amount := int(replan.get("amount", 0))
	var state: Dictionary = _adapter._state(candidate)
	var meta := _mut_meta(candidate)
	for token: Variant in (replan.get("token_ids", []) as Array):
		var token_id := str(token)
		if not _adapter._remove(candidate, token_id, 1):
			return _fail("token_custody_lost")
		var record: Dictionary = state["instances"][token_id]
		record["location"] = "deposited"
		record["revision"] = int(record.get("revision", 0)) + 1
		var deposits: Dictionary = meta.get("deposits", {})
		deposits[token_id] = str(replan.get("proposal_id", ""))
		meta["deposits"] = deposits
	var receipt: Dictionary = replan.get("receipt_metadata", {})
	var applied: bool = _profile_port.call(&"apply_profile_delta", candidate, amount, receipt)
	if not applied:
		return _fail("profile_delta_rejected")
	meta["run_id"] = str((request as Dictionary).get("run_id", ""))
	meta["policy_sha256"] = _policy_sha256
	candidate[ROOT] = _merge_meta_into_economy(candidate, meta)
	_adapter._candidate_reset_state(candidate)
	return {"ok": true, "kind": "deposit", "proposal_id": str(replan.get("proposal_id", "")), "amount": amount, "profile_delta": amount, "secured_after": _secured(candidate), "receipt_metadata": receipt}

func _machine(machine_id: String) -> Dictionary:
	for entry: Variant in (_policy.get("vending_machines", []) as Array):
		var m: Dictionary = entry
		if str(m.get("machine_id", "")) == machine_id:
			return m
	return {}

func _stock(meta: Dictionary, machine: Dictionary) -> Dictionary:
	var machine_id := str(machine.get("machine_id", ""))
	var all: Dictionary = meta.get("vendor_stock", {})
	if all.has(machine_id):
		return all[machine_id]
	var items := {}
	for item_id: Variant in (machine.get("stock", {}) as Dictionary).keys():
		items[str(item_id)] = int((machine["stock"][item_id] as Dictionary).get("quantity", 0))
	return {"stock_revision": int(machine.get("stock_revision", 1)), "items": items}

func _grant_vendor_item(candidate: Dictionary, item_id: String, quantity: int, machine_id: String) -> bool:
	var definition: Dictionary = _adapter.item(item_id)
	if definition.is_empty():
		return false
	if str(definition.get("storage", "")) == "instance":
		if quantity != 1:
			return false
		var state: Dictionary = _adapter._state(candidate)
		var record: Dictionary = _adapter._new_instance(state, item_id, "bag")
		record["origin"] = "vendor:" + machine_id
		if not _adapter._add(candidate, str(record["instance_id"]), 1, "key_item"):
			state["instances"].erase(str(record["instance_id"]))
			return false
		candidate[ROOT] = _merge_meta_into_economy(candidate, _meta(candidate))
		_adapter._candidate_reset_state(candidate)
		return true
	var kind := str(definition.get("kind", "material"))
	if kind == "station_kit":
		kind = "material"
	return bool(_adapter._add(candidate, item_id, quantity, kind))

func plan_purchase(request: Variant) -> Dictionary:
	var err := _port_error()
	if not err.is_empty():
		return _fail(err)
	if not request is Dictionary:
		return _fail("invalid_purchase_request")
	var req: Dictionary = request
	for field in ["contract", "run_id", "machine_id", "item_id", "quantity", "expected_stock_revision", "expected_policy_revision", "event_id"]:
		if not req.has(field):
			return _fail("missing_purchase_field:" + field)
	if str(req.get("contract", "")) != PLAN_CONTRACT:
		return _fail("invalid_purchase_contract")
	var ctx := _run_context()
	var active := _run_active(ctx)
	if not active.is_empty():
		return _fail(active)
	if str(req.get("run_id", "")) != str(ctx.get("run_id", "")):
		return _fail("run_identity_mismatch")
	if int(req.get("expected_policy_revision", -1)) != int(_policy.get("policy_revision", -2)):
		return _fail("policy_revision_stale")
	var machine_id := str(req.get("machine_id", ""))
	var machine := _machine(machine_id)
	if machine.is_empty():
		return _fail("machine_not_policy_authorized")
	var auth := _endpoint(machine_id, "vending")
	var endpoint_error := _endpoint_error(auth, machine_id, ctx, str(machine.get("endpoint_revision", "")))
	if not endpoint_error.is_empty():
		return _fail(endpoint_error)
	var snapshot: Dictionary = _adapter._save.call(&"get_snapshot")
	var meta := _meta(snapshot)
	var stock := _stock(meta, machine)
	if int(req.get("expected_stock_revision", -1)) != int(stock.get("stock_revision", -2)):
		return _fail("stock_revision_stale")
	var item_id := str(req.get("item_id", ""))
	var quantity := int(req.get("quantity", 0))
	if quantity <= 0 or quantity > 10:
		return _fail("invalid_purchase_quantity")
	var offer: Dictionary = (machine.get("stock", {}) as Dictionary).get(item_id, {})
	if offer.is_empty():
		return _fail("item_not_stocked")
	var definition: Dictionary = _adapter.item(item_id)
	if definition.is_empty() or str(definition.get("kind", "")) in ["skill_core", "key_item"] or int(definition.get("tier", 0)) > 2:
		return _fail("forbidden_vendor_item")
	var remaining := int((stock.get("items", {}) as Dictionary).get(item_id, 0))
	if quantity > remaining:
		return _fail("insufficient_stock")
	var unit_price := int(offer.get("unit_price", 0))
	var cost := unit_price * quantity
	if _secured(snapshot) < cost:
		return _fail("insufficient_secured_currency")
	var trial: Dictionary = snapshot.duplicate(true)
	if not _grant_vendor_item(trial, item_id, quantity, machine_id):
		return _fail("inventory_full")
	var proposal_id := Offline.canonical_sha256({"request": req, "policy_sha256": _policy_sha256, "stock_sha256": Offline.canonical_sha256(stock), "secured_before": _secured(snapshot)})
	return {"ok": true, "contract": PLAN_CONTRACT, "kind": "purchase", "proposal_id": proposal_id, "request": req.duplicate(true), "policy_sha256": _policy_sha256, "machine_id": machine_id, "item_id": item_id, "quantity": quantity, "unit_price": unit_price, "cost": cost, "profile_delta": -cost, "stock_revision_before": int(stock.get("stock_revision", 0)), "receipt_metadata": {"kind": "a3_meta_purchase", "proposal_id": proposal_id, "run_id": str(req.get("run_id", "")), "machine_id": machine_id, "item_id": item_id, "quantity": quantity, "unit_price": unit_price, "cost": cost}}

func apply_purchase(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	var replan := plan_purchase(request)
	if not bool(replan.get("ok", false)):
		return replan
	if str(replan.get("proposal_id", "")) != str(proposal.get("proposal_id", "")):
		return _fail("stale_meta_purchase_proposal")
	var cost := int(replan.get("cost", 0))
	var receipt: Dictionary = replan.get("receipt_metadata", {})
	var applied: bool = _profile_port.call(&"apply_profile_delta", candidate, -cost, receipt)
	if not applied:
		return _fail("profile_delta_rejected")
	var item_id := str(replan.get("item_id", ""))
	var quantity := int(replan.get("quantity", 0))
	if not _grant_vendor_item(candidate, item_id, quantity, str(replan.get("machine_id", ""))):
		return _fail("inventory_full")
	var meta := _mut_meta(candidate)
	var machine := _machine(str(replan.get("machine_id", "")))
	var stock := _stock(meta, machine)
	var items: Dictionary = stock["items"]
	items[item_id] = int(items.get(item_id, 0)) - quantity
	stock["stock_revision"] = int(stock.get("stock_revision", 0)) + 1
	var all: Dictionary = meta.get("vendor_stock", {})
	all[str(replan.get("machine_id", ""))] = stock
	meta["vendor_stock"] = all
	var purchases: Dictionary = meta.get("purchases", {})
	purchases[str(replan.get("proposal_id", ""))] = {"run_id": str((request as Dictionary).get("run_id", "")), "machine_id": str(replan.get("machine_id", "")), "item_id": item_id, "quantity": quantity, "unit_price": int(replan.get("unit_price", 0)), "cost": cost, "policy_sha256": _policy_sha256, "refunded": false}
	meta["purchases"] = purchases
	meta["run_id"] = str((request as Dictionary).get("run_id", ""))
	meta["policy_sha256"] = _policy_sha256
	candidate[ROOT] = _merge_meta_into_economy(candidate, meta)
	_adapter._candidate_reset_state(candidate)
	return {"ok": true, "kind": "purchase", "proposal_id": str(replan.get("proposal_id", "")), "cost": cost, "profile_delta": -cost, "secured_after": _secured(candidate), "receipt_metadata": receipt}

func plan_refund(request: Variant) -> Dictionary:
	var err := _port_error()
	if not err.is_empty():
		return _fail(err)
	if not request is Dictionary:
		return _fail("invalid_refund_request")
	var req: Dictionary = request
	for field in ["contract", "run_id", "machine_id", "receipt_id", "event_id"]:
		if not req.has(field):
			return _fail("missing_refund_field:" + field)
	var ctx := _run_context()
	var active := _run_active(ctx)
	if not active.is_empty():
		return _fail(active)
	if str(req.get("run_id", "")) != str(ctx.get("run_id", "")):
		return _fail("run_identity_mismatch")
	var snapshot: Dictionary = _adapter._save.call(&"get_snapshot")
	var meta := _meta(snapshot)
	var receipt: Dictionary = (meta.get("purchases", {}) as Dictionary).get(str(req.get("receipt_id", "")), {})
	if receipt.is_empty():
		return _fail("purchase_receipt_missing")
	if str(receipt.get("run_id", "")) != str(req.get("run_id", "")):
		return _fail("old_run_receipt_rejected")
	if bool(receipt.get("refunded", false)):
		return _fail("receipt_already_refunded")
	if str(receipt.get("machine_id", "")) != str(req.get("machine_id", "")):
		return _fail("refund_machine_mismatch")
	var machine_id := str(req.get("machine_id", ""))
	var auth := _endpoint(machine_id, "vending")
	var machine := _machine(machine_id)
	var endpoint_error := _endpoint_error(auth, machine_id, ctx, str(machine.get("endpoint_revision", "")))
	if not endpoint_error.is_empty():
		return _fail(endpoint_error)
	var item_id := str(receipt.get("item_id", ""))
	var quantity := int(receipt.get("quantity", 0))
	var totals: Dictionary = _adapter._candidate_bag_totals(snapshot)
	if int(totals.get(item_id, 0)) < quantity:
		return _fail("refund_item_not_in_bag")
	var amount := int(receipt.get("cost", 0))
	var proposal_id := Offline.canonical_sha256({"request": req, "receipt": receipt, "policy_sha256": _policy_sha256})
	return {"ok": true, "contract": PLAN_CONTRACT, "kind": "refund", "proposal_id": proposal_id, "request": req.duplicate(true), "amount": amount, "profile_delta": amount, "item_id": item_id, "quantity": quantity, "receipt_metadata": {"kind": "a3_meta_refund", "proposal_id": proposal_id, "run_id": str(req.get("run_id", "")), "receipt_id": str(req.get("receipt_id", "")), "amount": amount}}

func apply_refund(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	var replan := plan_refund(request)
	if not bool(replan.get("ok", false)):
		return replan
	if str(replan.get("proposal_id", "")) != str(proposal.get("proposal_id", "")):
		return _fail("stale_meta_refund_proposal")
	var item_id := str(replan.get("item_id", ""))
	var quantity := int(replan.get("quantity", 0))
	if not _adapter._remove(candidate, item_id, quantity):
		return _fail("refund_item_not_in_bag")
	var amount := int(replan.get("amount", 0))
	var receipt: Dictionary = replan.get("receipt_metadata", {})
	var applied: bool = _profile_port.call(&"apply_profile_delta", candidate, amount, receipt)
	if not applied:
		return _fail("profile_delta_rejected")
	var meta := _mut_meta(candidate)
	var req: Dictionary = request
	var purchases: Dictionary = meta.get("purchases", {})
	var purchase: Dictionary = purchases[str(req.get("receipt_id", ""))]
	purchase["refunded"] = true
	purchases[str(req.get("receipt_id", ""))] = purchase
	meta["purchases"] = purchases
	var machine := _machine(str(req.get("machine_id", "")))
	var stock := _stock(meta, machine)
	var items: Dictionary = stock["items"]
	items[item_id] = int(items.get(item_id, 0)) + quantity
	stock["stock_revision"] = int(stock.get("stock_revision", 0)) + 1
	var all: Dictionary = meta.get("vendor_stock", {})
	all[str(req.get("machine_id", ""))] = stock
	meta["vendor_stock"] = all
	candidate[ROOT] = _merge_meta_into_economy(candidate, meta)
	_adapter._candidate_reset_state(candidate)
	return {"ok": true, "kind": "refund", "proposal_id": str(replan.get("proposal_id", "")), "amount": amount, "profile_delta": amount, "secured_after": _secured(candidate), "receipt_metadata": receipt}

func _recycler(machine_id: String) -> Dictionary:
	for entry: Variant in (_policy.get("recycler_machines", []) as Array):
		var m: Dictionary = entry
		if str(m.get("machine_id", "")) == machine_id:
			return m
	return {}

func _consume_recycle_input(candidate: Dictionary, item_id: String, quantity: int) -> bool:
	var definition: Dictionary = _adapter.item(item_id)
	if str(definition.get("storage", "")) != "instance":
		return bool(_adapter._remove(candidate, item_id, quantity))
	if quantity != 1:
		return false
	var state: Dictionary = _adapter._state(candidate)
	var found := ""
	for id: Variant in (state.get("instances", {}) as Dictionary).keys():
		var record: Dictionary = state["instances"][id]
		if str(record.get("item_id", "")) == item_id and str(record.get("location", "")) == "bag" and _adapter._token_error(candidate, state, str(id)) == "":
			found = str(id)
			break
	if found.is_empty():
		return false
	if not _adapter._remove(candidate, found, 1):
		return false
	var record: Dictionary = state["instances"][found]
	record["location"] = "recycled"
	record["revision"] = int(record.get("revision", 0)) + 1
	candidate[ROOT] = _merge_meta_into_economy(candidate, _meta(candidate))
	_adapter._candidate_reset_state(candidate)
	return true

func plan_recycle(request: Variant) -> Dictionary:
	var err := _port_error()
	if not err.is_empty():
		return _fail(err)
	if not request is Dictionary:
		return _fail("invalid_recycle_request")
	var req: Dictionary = request
	for field in ["contract", "run_id", "machine_id", "item_id", "quantity", "event_id"]:
		if not req.has(field):
			return _fail("missing_recycle_field:" + field)
	var ctx := _run_context()
	var active := _run_active(ctx)
	if not active.is_empty():
		return _fail(active)
	if str(req.get("run_id", "")) != str(ctx.get("run_id", "")):
		return _fail("run_identity_mismatch")
	var machine_id := str(req.get("machine_id", ""))
	var machine := _recycler(machine_id)
	if machine.is_empty():
		return _fail("recycler_not_policy_authorized")
	var auth := _endpoint(machine_id, "recycler")
	var endpoint_error := _endpoint_error(auth, machine_id, ctx, str(machine.get("endpoint_revision", "")))
	if not endpoint_error.is_empty():
		return _fail(endpoint_error)
	var item_id := str(req.get("item_id", ""))
	var quantity := int(req.get("quantity", 0))
	if quantity <= 0 or quantity > int(machine.get("max_quantity_per_transaction", 10)):
		return _fail("invalid_recycle_quantity")
	var definition: Dictionary = _adapter.item(item_id)
	if definition.is_empty():
		return _fail("unknown_recycle_item")
	if str(definition.get("kind", "")) in (machine.get("forbidden_input_kinds", []) as Array):
		return _fail("forbidden_recycle_kind")
	for tag: Variant in (definition.get("tags", []) as Array):
		if (machine.get("forbidden_input_tags", []) as Array).has(str(tag)):
			return _fail("forbidden_recycle_tag")
	var salvage: Dictionary = (_policy.get("recycler_salvage", {}) as Dictionary).get(item_id, {})
	if salvage.is_empty() or int(salvage.get("profile_currency_delta", -1)) != 0:
		return _fail("no_legitimate_salvage_route")
	var snapshot: Dictionary = _adapter._save.call(&"get_snapshot")
	var totals: Dictionary = _adapter._candidate_bag_totals(snapshot)
	if int(totals.get(item_id, 0)) < quantity:
		return _fail("insufficient_recycle_input")
	var outputs := {}
	for out: Variant in (salvage.get("outputs", {}) as Dictionary).keys():
		outputs[str(out)] = int(salvage["outputs"][out]) * quantity
	var trial: Dictionary = snapshot.duplicate(true)
	if not _consume_recycle_input(trial, item_id, quantity) or not _adapter._add_outputs(trial, outputs):
		return _fail("inventory_full")
	var proposal_id := Offline.canonical_sha256({"request": req, "policy_sha256": _policy_sha256, "outputs": outputs})
	return {"ok": true, "contract": PLAN_CONTRACT, "kind": "recycle", "proposal_id": proposal_id, "request": req.duplicate(true), "outputs": outputs, "profile_delta": 0, "receipt_metadata": {"kind": "a3_meta_recycle", "proposal_id": proposal_id, "run_id": str(req.get("run_id", "")), "machine_id": machine_id, "item_id": item_id, "quantity": quantity}}

func apply_recycle(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	var replan := plan_recycle(request)
	if not bool(replan.get("ok", false)):
		return replan
	if str(replan.get("proposal_id", "")) != str(proposal.get("proposal_id", "")):
		return _fail("stale_meta_recycle_proposal")
	var req: Dictionary = request
	var item_id := str(req.get("item_id", ""))
	var quantity := int(req.get("quantity", 0))
	var outputs: Dictionary = replan.get("outputs", {})
	if not _consume_recycle_input(candidate, item_id, quantity) or not _adapter._add_outputs(candidate, outputs):
		return _fail("inventory_full")
	var meta := _mut_meta(candidate)
	var recycles: Dictionary = meta.get("recycles", {})
	recycles[str(replan.get("proposal_id", ""))] = {"run_id": str(req.get("run_id", "")), "item_id": item_id, "quantity": quantity, "outputs": outputs, "profile_delta": 0}
	meta["recycles"] = recycles
	meta["run_id"] = str(req.get("run_id", ""))
	meta["policy_sha256"] = _policy_sha256
	candidate[ROOT] = _merge_meta_into_economy(candidate, meta)
	_adapter._candidate_reset_state(candidate)
	return {"ok": true, "kind": "recycle", "proposal_id": str(replan.get("proposal_id", "")), "outputs": outputs, "profile_delta": 0, "receipt_metadata": replan.get("receipt_metadata", {})}

## A6 read-only projection. No mutator, no hidden source rewards, no authority.
func project(candidate: Dictionary) -> Dictionary:
	var meta := _meta(candidate)
	var secured := 0
	var stones: Array = []
	if _profile_port != null and _profile_port.has_method(&"read_profile"):
		var profile := _profile(candidate)
		secured = int(profile.get("secured_ragnarok_currency", 0))
		stones = ((profile.get("achievements", {}) as Dictionary).get("elder_stones", []) as Array).duplicate(true)
	var physical := 0
	var state: Dictionary = _adapter._state(candidate)
	for record: Variant in (state.get("instances", {}) as Dictionary).values():
		var r: Dictionary = record
		if str(r.get("item_id", "")) == "ragnarok_unbanked" and str(r.get("location", "")) == "bag":
			physical += 1
	var machines: Array[Dictionary] = []
	for machine: Variant in (_policy.get("vending_machines", []) as Array):
		var m: Dictionary = machine
		var stock := _stock(meta, m)
		machines.append({"machine_id": str(m.get("machine_id", "")), "region_id": str(m.get("region_id", "")), "stock_revision": int(stock.get("stock_revision", 0)), "items": (stock.get("items", {}) as Dictionary).duplicate(true)})
	return {"contract": "soh.economy.meta_projection.v1", "read_only": true, "secured_ragnarok_currency": secured, "physical_unbanked_tokens": physical, "elder_stones": stones, "vending_machines": machines, "policy_revision": int(_policy.get("policy_revision", 0)), "rate_approval": str(_policy.get("rate_approval", "")), "display_registry": str((_policy.get("technical_ids", {}) as Dictionary).get("display_registry", ""))}

func _merge_meta_into_economy(candidate: Dictionary, meta: Dictionary) -> Dictionary:
	var economy: Dictionary = candidate.get(ROOT, {})
	economy["meta"] = meta
	return economy
