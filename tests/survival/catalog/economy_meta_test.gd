extends SceneTree
## V7 native two-layer meta-economy tests against the REAL SaveService.
## The profile/run/endpoint/source producers are explicit OWNER-CONTRACT
## CANDIDATE fixtures, not production A0/A1/A8 gameplay.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const Economy = preload("res://game/survival/economy/economy_service.gd")
const PortCandidate = preload("res://tests/survival/catalog/a0_profile_port_candidate.gd")
const RUN_START := 1800000000
const RUN_SECONDS := 1209600
const LAST72 := 950400

var checks := 0
var failures: Array[String] = []
var case_id := 0
var save: Node
var eco: RefCounted
var port: RefCounted
var path := ""

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _begin(label: String) -> void:
	case_id += 1
	print("[meta case %02d] %s" % [case_id, label])
	if case_id == 1:
		_setup_fresh()

func _setup_fresh() -> void:
	path = "user://tests/a3_meta_%d_%d.json" % [Time.get_ticks_usec(), case_id]
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh authoritative save")
	eco = Economy.new()
	_expect(bool(eco.configure(save)), "catalog + real SaveService adapter")
	port = PortCandidate.new()
	port.run_ctx = {"contract": "soh.economy.a0_run_context.v1", "run_id": "run-v7", "run_epoch": 1, "run_started_at_unix": RUN_START, "now_unix": RUN_START + LAST72 + 3600, "expires_at_unix": RUN_START + RUN_SECONDS, "status": "active"}
	port.endpoints = {
		"preservation_kiosk_01": {"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "preservation_kiosk_01", "kind": "deposit", "run_id": "run-v7", "endpoint_revision": "rev-1", "visited": true, "operational": true, "hero_cell": [408, 199]},
		"vending_kiosk_01": {"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "vending_kiosk_01", "kind": "vending", "run_id": "run-v7", "endpoint_revision": "rev-1", "visited": true, "operational": true, "hero_cell": [410, 199]},
		"recycler_01": {"contract": "soh.economy.meta_endpoint_authority.v1", "endpoint_id": "recycler_01", "kind": "recycler", "run_id": "run-v7", "endpoint_revision": "rev-1", "visited": true, "operational": true, "hero_cell": [412, 199]}}
	port.sources = {"elder_ashen_vault|vault-1": {"contract": "soh.economy.meta_source_authority.v1", "source_id": "elder_ashen_vault", "source_instance_id": "vault-1", "run_id": "run-v7", "generation": 1, "opened": true, "depleted": false, "phase": "last72"}}
	_expect(bool(eco.configure_meta_profile_port(port)), "owner-contract candidate profile port")

func _snapshot() -> Dictionary:
	return save.call(&"get_snapshot")

func _secured() -> int:
	return int(_snapshot().get("profile", {}).get("secured_ragnarok_currency", 0))

func _commit_meta(method: String, request: Dictionary, key_prefix: String) -> Dictionary:
	var plan: Dictionary = eco.call(method, request)
	if not bool(plan.get("ok", false)):
		return plan
	var key := key_prefix + str(plan.proposal_id)
	if bool(save.call(&"is_transaction_applied", key)):
		return {"ok": true, "duplicate": true, "proposal_id": str(plan.proposal_id)}
	var result := {"ok": false, "reason": "rejected"}
	var apply_method := method.replace("plan_", "apply_")
	var applied: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var applied_result: Dictionary = eco.call(apply_method, candidate, plan, request)
		for result_key: Variant in applied_result.keys():
			result[result_key] = applied_result[result_key]
		return bool(applied_result.get("ok", false)), {"kind": "a3_meta_fixture", "proposal_id": str(plan.proposal_id)}))
	if not applied:
		if bool(save.call(&"is_transaction_applied", key)):
			return {"ok": true, "duplicate": true, "proposal_id": str(plan.proposal_id)}
		if bool(result.get("ok", false)):
			return {"ok": false, "reason": "save_failed"}
	result["duplicate"] = false
	return result

func _claim(instance: String, generation: int, event: String, source_id := "elder_ashen_vault") -> Dictionary:
	return _commit_meta("plan_meta_source_claim", {"contract": "soh.economy.meta_source_authority.v1", "run_id": "run-v7", "source_id": source_id, "source_instance_id": instance, "expected_generation": generation, "event_id": event}, "soh.a3.meta_source.")

func _ensure_tokens(minimum: int) -> void:
	var policy: Dictionary = eco.catalog.get("meta_policy", {})
	for entry: Variant in (policy.get("currency_sources", []) as Array):
		var source: Dictionary = entry
		var source_id := str(source.get("source_id", ""))
		var cap := int(source.get("max_claims_per_run", 1))
		for i in range(cap):
			if _currency_tokens().size() >= minimum:
				return
			var instance := source_id + "-fixture-%d" % (i + 1)
			port.sources[source_id + "|" + instance] = {"contract": "soh.economy.meta_source_authority.v1", "source_id": source_id, "source_instance_id": instance, "run_id": "run-v7", "generation": 1, "opened": true, "depleted": false, "phase": "last72"}
			_claim(instance, 1, "ensure.%s.%d" % [source_id, i], source_id)

func _deposit(tokens: Array, event: String) -> Dictionary:
	return _commit_meta("plan_meta_deposit", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7", "endpoint_id": "preservation_kiosk_01", "token_ids": tokens, "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": event}, "soh.a3.meta_deposit.")

func _purchase(item_id: String, quantity: int, stock_rev: int, event: String) -> Dictionary:
	return _commit_meta("plan_meta_purchase", {"contract": "soh.economy.meta_plan.v1", "run_id": str(port.run_ctx.get("run_id", "run-v7")), "machine_id": "vending_kiosk_01", "item_id": item_id, "quantity": quantity, "expected_stock_revision": stock_rev, "expected_policy_revision": 1, "event_id": event}, "soh.a3.meta_purchase.")

func _currency_tokens() -> Array:
	var tokens: Array = []
	for record: Variant in eco.owned_instances("ragnarok_unbanked"):
		tokens.append(str(record.instance_id))
	return tokens

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		save = SaveServiceClass.new()
		save.name = "SaveService"
		root.add_child(save)

	_begin("premature claim rejected; last-72 legitimate claim mints physical tokens only")
	port.run_ctx["now_unix"] = RUN_START + 1000
	var premature: Dictionary = eco.plan_meta_source_claim({"contract": "soh.economy.meta_source_authority.v1", "run_id": "run-v7", "source_id": "elder_ashen_vault", "source_instance_id": "vault-1", "expected_generation": 1, "event_id": "early"})
	_expect(not bool(premature.ok) and str(premature.reason) == "premature_ragnarok_claim", "day-1 chest cannot mint late currency")
	port.run_ctx["now_unix"] = RUN_START + LAST72 + 3600
	var claim: Dictionary = _claim("vault-1", 1, "claim.vault1")
	_expect(bool(claim.ok), "last-72 source claim commits")
	_expect(int(claim.get("units", 0)) >= 0 and _secured() == 0, "opening/claiming never credits profile")
	var tokens := _currency_tokens()
	_expect(tokens.size() == int(claim.get("units", 0)), "physical unique tokens equal claimed units")
	_ensure_tokens(2)
	tokens = _currency_tokens()
	_expect(tokens.size() >= 2, "fixture has enough physical currency tokens for custody/deposit/reset tests")

	_begin("source identity and generation forgery rejected")
	var forged: Dictionary = eco.plan_meta_source_claim({"contract": "soh.economy.meta_source_authority.v1", "run_id": "run-v7", "source_id": "elder_ashen_vault", "source_instance_id": "vault-1", "expected_generation": 99, "event_id": "forge"})
	_expect(not bool(forged.ok) and str(forged.reason) == "source_generation_forgery", "wrong generation rejected")
	var unknown: Dictionary = eco.plan_meta_source_claim({"contract": "soh.economy.meta_source_authority.v1", "run_id": "run-v7", "source_id": "fake_vault", "source_instance_id": "vault-1", "expected_generation": 1, "event_id": "fake"})
	_expect(not bool(unknown.ok) and str(unknown.reason) == "source_not_policy_authorized", "unauthorized source rejected")

	_begin("unbanked currency in death bag is not depositable and never profile credit")
	var death_token := str(tokens[0])
	var before_death := _secured()
	var moved: bool = bool(save.call(&"transact_once", "fixture.death_bag.%d" % case_id, func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {})
		var stacks: Dictionary = inventory.get("item_stacks", {})
		var stack: Dictionary = stacks.get(death_token, {})
		stacks.erase(death_token)
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		var survival: Dictionary = candidate.get("survival", {})
		var bags: Dictionary = survival.get("death_bags", {})
		bags["bag-1"] = {"item_stacks": {death_token: stack}}
		survival["death_bags"] = bags
		candidate["survival"] = survival
		var economy: Dictionary = candidate.get("survival_economy", {})
		var instances: Dictionary = economy.get("instances", {})
		if instances.has(death_token):
			instances[death_token]["location"] = "death_bag"
		economy["instances"] = instances
		candidate["survival_economy"] = economy
		return true, {}))
	_expect(moved, "owner-contract death bag moves physical token")
	var death_plan: Dictionary = eco.plan_meta_deposit({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7", "endpoint_id": "preservation_kiosk_01", "token_ids": [death_token], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "death"})
	_expect(not bool(death_plan.ok) and str(death_plan.reason).begins_with("token_not_in_bag_custody"), "death-bag token cannot be deposited remotely")
	_expect(_secured() == before_death, "death does not bank currency")
	# recover token to bag for later tests
	save.call(&"transact_once", "fixture.recover.%d" % case_id, func(candidate: Dictionary) -> bool:
		var survival: Dictionary = candidate.get("survival", {})
		var bags: Dictionary = survival.get("death_bags", {})
		var bag: Dictionary = bags.get("bag-1", {})
		var stacks: Dictionary = bag.get("item_stacks", {})
		var stack: Dictionary = stacks.get(death_token, {})
		stack["kind"] = "key_item"
		stack["quantity"] = 1
		stacks.erase(death_token)
		bag["item_stacks"] = stacks
		bags["bag-1"] = bag
		survival["death_bags"] = bags
		candidate["survival"] = survival
		var inventory: Dictionary = candidate.get("inventory", {})
		var inv_stacks: Dictionary = inventory.get("item_stacks", {})
		inv_stacks[death_token] = stack
		inventory["item_stacks"] = inv_stacks
		candidate["inventory"] = inventory
		var economy: Dictionary = candidate.get("survival_economy", {})
		var instances: Dictionary = economy.get("instances", {})
		if instances.has(death_token):
			instances[death_token]["location"] = "bag"
		economy["instances"] = instances
		candidate["survival_economy"] = economy
		return true, {})
	tokens = _currency_tokens()

	_begin("legitimate deposit atomically removes tokens and credits profile once")
	var deposit_tokens := tokens.slice(0, mini(2, tokens.size()))
	var before := _secured()
	var deposit: Dictionary = _deposit(deposit_tokens, "deposit.1")
	_expect(bool(deposit.ok), "deposit commits")
	_expect(_secured() == before + deposit_tokens.size(), "profile balance increases by exact physical amount")
	_expect(_currency_tokens().size() == tokens.size() - deposit_tokens.size(), "exact tokens removed from bag")
	var replay: Dictionary = _deposit(deposit_tokens, "deposit.1")
	_expect(bool(replay.get("duplicate", false)) or not bool(replay.ok), "same proposal replay cannot mint")
	_expect(_secured() == before + deposit_tokens.size(), "replay leaves balance unchanged")
	if tokens.size() > deposit_tokens.size():
		var second: Dictionary = _deposit([tokens[deposit_tokens.size()]], "deposit.2")
		_expect(bool(second.ok), "different currency second trip is valid")

	_begin("duplicate token and double-spend rejected")
	var remaining := _currency_tokens()
	if not remaining.is_empty():
		var dup: Dictionary = eco.plan_meta_deposit({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7", "endpoint_id": "preservation_kiosk_01", "token_ids": [remaining[0], remaining[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "dup"})
		_expect(not bool(dup.ok) and str(dup.reason) == "duplicate_token_in_request", "duplicate token in one request rejected")
		var p1: Dictionary = eco.plan_meta_deposit({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7", "endpoint_id": "preservation_kiosk_01", "token_ids": [remaining[0]], "expected_policy_revision": 1, "expected_endpoint_revision": "rev-1", "event_id": "spend1"})
		var key := "soh.a3.meta_deposit." + str(p1.proposal_id)
		var ok1: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
			var r: Dictionary = eco.apply_meta_deposit(candidate, p1, p1.request)
			return bool(r.get("ok", false)), {}))
		_expect(ok1, "first spend commits")
		var stale: Dictionary = eco.apply_meta_deposit(_snapshot().duplicate(true), p1, p1.request)
		_expect(not bool(stale.ok), "second spend of same token fails closed")

	_begin("home chest currency is lost on run reset; secured currency survives")
	var chest_tokens := _currency_tokens()
	if not chest_tokens.is_empty():
		var chest_token := str(chest_tokens[0])
		var _chest_moved: bool = bool(save.call(&"transact_once", "fixture.chest.%d" % case_id, func(candidate: Dictionary) -> bool:
			var inventory: Dictionary = candidate.get("inventory", {})
			var stacks: Dictionary = inventory.get("item_stacks", {})
			var stack: Dictionary = stacks.get(chest_token, {})
			stacks.erase(chest_token)
			inventory["item_stacks"] = stacks
			candidate["inventory"] = inventory
			var storage: Dictionary = candidate.get("storage", {})
			var sstacks: Dictionary = storage.get("item_stacks", {})
			sstacks[chest_token] = stack
			storage["item_stacks"] = sstacks
			candidate["storage"] = storage
			var economy: Dictionary = candidate.get("survival_economy", {})
			var instances: Dictionary = economy.get("instances", {})
			if instances.has(chest_token):
				instances[chest_token]["location"] = "home_chest"
			economy["instances"] = instances
			candidate["survival_economy"] = economy
			return true, {}))
		_expect(_chest_moved, "owner-contract home chest stores physical token")
	var secured_before_reset := _secured()
	var new_ctx: Dictionary = port.run_ctx.duplicate(true)
	new_ctx["run_id"] = "run-v7-next"
	new_ctx["run_epoch"] = 2
	new_ctx["now_unix"] = RUN_START + RUN_SECONDS + 10
	new_ctx["run_started_at_unix"] = RUN_START + RUN_SECONDS + 10
	save.call(&"transact_once", "fixture.run_reset.%d" % case_id, func(candidate: Dictionary) -> bool:
		port.reset_run(candidate, new_ctx)
		return true, {})
	for endpoint_id: Variant in port.endpoints.keys():
		port.endpoints[endpoint_id]["run_id"] = "run-v7-next"
	_expect(_secured() == secured_before_reset, "secured currency survives voluntary restart")
	_expect(_currency_tokens().is_empty(), "unbanked home-chest currency lost on reset")
	_expect(_snapshot().get("survival_economy", {}).is_empty(), "run-local economy namespace cleared")
	_expect(int(_snapshot().get("inventory", {}).get("item_stacks", {}).size()) == 0, "no ordinary item leaks across run boundary")

	_begin("new-run fixed machine visit and paid purchase; insufficient money and stale stock")
	port.run_ctx = {"contract": "soh.economy.a0_run_context.v1", "run_id": "run-v7-next", "run_epoch": 2, "run_started_at_unix": RUN_START + RUN_SECONDS + 10, "now_unix": RUN_START + RUN_SECONDS + 3700, "expires_at_unix": RUN_START + RUN_SECONDS * 2 + 10, "status": "active"}
	port.endpoints["vending_kiosk_01"]["run_id"] = "run-v7-next"
	var secured_now := _secured()
	if secured_now > 0:
		var buy: Dictionary = _purchase("field_meal", 1, 1, "buy.meal")
		_expect(bool(buy.ok), "paid purchase commits at fixed machine")
		_expect(_secured() == secured_now - 1, "exact price debited")
		_expect(int(eco.inventory_totals().get("field_meal", 0)) >= 1, "run-local item granted")
		var stale: Dictionary = _purchase("field_meal", 1, 1, "buy.stale")
		_expect(not bool(stale.ok) and str(stale.reason) == "stock_revision_stale", "stale stock revision rejected")
	else:
		var poor: Dictionary = _purchase("field_meal", 1, 1, "buy.poor")
		_expect(not bool(poor.ok) and str(poor.reason) == "insufficient_secured_currency", "insufficient secured money rejected")
	var expensive: Dictionary = _purchase("research_kit", 1, 2, "buy.expensive")
	_expect(not bool(expensive.ok), "cannot afford high price without enough banking")

	_begin("refund restores profile and stock; old-run receipt rejected")
	# make a fresh purchase in current run if possible
	var meal_plan: Dictionary = eco.plan_meta_purchase({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "vending_kiosk_01", "item_id": "field_meal", "quantity": 1, "expected_stock_revision": 2, "expected_policy_revision": 1, "event_id": "buy.refundable"})
	if bool(meal_plan.ok):
		var receipt_id := str(meal_plan.proposal_id)
		var key := "soh.a3.meta_purchase." + receipt_id
		var bought: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
			var r: Dictionary = eco.apply_meta_purchase(candidate, meal_plan, meal_plan.request)
			return bool(r.get("ok", false)), {}))
		_expect(bought, "refundable purchase committed")
		var before_refund := _secured()
		var refund: Dictionary = _commit_meta("plan_meta_refund", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "vending_kiosk_01", "receipt_id": receipt_id, "event_id": "refund.1"}, "soh.a3.meta_refund.")
		_expect(bool(refund.ok) and _secured() == before_refund + 1, "refund credits original receipt price")
		var again: Dictionary = _commit_meta("plan_meta_refund", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "vending_kiosk_01", "receipt_id": receipt_id, "event_id": "refund.2"}, "soh.a3.meta_refund.")
		_expect(not bool(again.ok), "receipt cannot refund twice")
		port.run_ctx["run_id"] = "run-v7-old"
		var old: Dictionary = eco.plan_meta_refund({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-old", "machine_id": "vending_kiosk_01", "receipt_id": receipt_id, "event_id": "refund.old"})
		_expect(not bool(old.ok), "old-run receipt rejected")
		port.run_ctx["run_id"] = "run-v7-next"

	_begin("recycler returns run-local salvage only; currency/Core conversion forbidden")
	eco.configure_meta_profile_port(port)
	var give: bool = bool(save.call(&"grant_inventory_item", "binding_cloth", "material", 2, "meta.fixture.cloth"))
	_expect(give, "fixture run-local salvage input")
	var recycle: Dictionary = _commit_meta("plan_meta_recycle", {"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "recycler_01", "item_id": "binding_cloth", "quantity": 1, "event_id": "recycle.1"}, "soh.a3.meta_recycle.")
	_expect(bool(recycle.ok) and int(recycle.get("profile_delta", -1)) == 0, "recycle emits zero profile currency")
	_expect(int(eco.inventory_totals().get("reed_fibre", 0)) >= 1, "legitimate run-local salvage output")
	var bad_recycle: Dictionary = eco.plan_meta_recycle({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "recycler_01", "item_id": "ragnarok_unbanked", "quantity": 1, "event_id": "recycle.cash"})
	_expect(not bool(bad_recycle.ok), "physical currency cannot be recycled into secured money")

	_begin("elder stones are distinct achievements, not currency")
	var secured_before_stone := _secured()
	var stone_committed: bool = bool(save.call(&"transact_once", "fixture.stone.%d" % case_id, func(candidate: Dictionary) -> bool:
		return port.record_elder_stone(candidate, "stone_ashen", {"run_id": "run-v7-next", "stone_id": "stone_ashen"}), {}))
	_expect(stone_committed, "owner-contract stone achievement commits in same SaveService")
	_expect(_secured() == secured_before_stone, "elder stone does not credit currency")
	var projection: Dictionary = eco.project_meta_economy()
	_expect(bool(projection.get("read_only", false)) and int(projection.get("policy_revision", 0)) == 1, "A6 projection is read-only and policy-versioned")
	_expect((projection.get("elder_stones", []) as Array).has("stone_ashen"), "projection shows distinct achievement stone")

	_begin("full inventory blocks vendor purchase without partial debit")
	var fill_ids := ["oak_wood", "stone_chunk", "iron_scrap", "reed_fibre", "charcoal", "iron_ingot", "steel_ingot", "iron_parts", "spring", "binding_cloth", "venom_extract", "frost_extract", "core_blank", "charged_blank", "moonleaf", "moonleaf_seed", "wild_berries", "grain", "grain_seed", "compost", "furnace_kit", "workbench_kit", "research_kit", "garden_kit", "advanced_furnace_kit", "field_meal", "minor_salve", "research_notes", "knowledge_spares", "soul_ember"]
	var secured_before_full := _secured()
	save.call(&"transact_once", "fixture.fill_bag.%d" % case_id, func(candidate: Dictionary) -> bool:
		var stacks := {}
		for id: String in fill_ids:
			stacks[id] = {"kind": "material", "quantity": 50}
		candidate["inventory"] = {"item_stacks": stacks}
		return true, {})
	var stock_now := 1
	var meta_state: Dictionary = eco.meta_economy_state()
	var vendor_stock: Dictionary = (meta_state.get("vendor_stock", {}) as Dictionary).get("vending_kiosk_01", {})
	if not vendor_stock.is_empty():
		stock_now = int(vendor_stock.get("stock_revision", 1))
	var full: Dictionary = eco.plan_meta_purchase({"contract": "soh.economy.meta_plan.v1", "run_id": "run-v7-next", "machine_id": "vending_kiosk_01", "item_id": "oak_wood", "quantity": 1, "expected_stock_revision": stock_now, "expected_policy_revision": 1, "event_id": "buy.full"})
	_expect(not bool(full.ok) and str(full.reason) == "inventory_full", "full bag rejects purchase")
	_expect(_secured() == secured_before_full, "no partial profile debit on full inventory")
	save.call(&"transact_once", "fixture.clear_bag.%d" % case_id, func(candidate: Dictionary) -> bool:
		candidate["inventory"] = {"item_stacks": {}}
		return true, {})

	_begin("absent A0 profile port fails closed")
	var bare: RefCounted = Economy.new()
	_expect(bool(bare.configure(save)), "bare adapter")
	var absent: Dictionary = bare.plan_meta_deposit({"contract": "soh.economy.meta_plan.v1"})
	_expect(not bool(absent.ok) and str(absent.reason) == "A0_PROFILE_BOUNDARY_ABSENT", "no second wallet without A0 boundary")

	print("")
	if failures.is_empty():
		print("A3 META ECONOMY PASSED - %d checks / %d cases" % [checks, case_id])
		quit(0)
	else:
		print("A3 META ECONOMY FAILED - %d/%d checks failed" % [failures.size(), checks])
		quit(1)
