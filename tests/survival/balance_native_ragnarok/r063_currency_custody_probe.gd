extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## D063 / D064 — losable physical currency, banking only at a physical endpoint,
## fixed-price vending, and a recycler that cannot print money.
##
## ## What this probe is, and what it refuses to pretend
## The composition has no currency item, no deposit endpoint, no vending machine
## and no recycler (part A asserts that with names, not adjectives). So the
## product side of D063/D064 is RED and this probe says which symbols are absent.
##
## What it adds on top is an executable **acceptance model**: the invariants a
## vault/vending/recycler implementation must satisfy, written as a small state
## machine in A7-owned test code and then attacked with the ten adversarial cases
## the mission names. Two reasons this is worth the code rather than another
## paragraph of red text:
##
##   * the cases are the actual deliverable — an owner who lands banking can port
##     `_Ledger` assertions into a native test the same day, and every case has a
##     named, expected refusal instead of a vibe;
##   * it proves the invariants are *checkable*, i.e. that "only the secured
##     amount survives" is a statement with a falsifier, not a wish.
##
## Every model line is printed as `MODEL_ORACLE` so no reader can mistake it for
## evidence about the game. The verdict stays RED while part A is empty.

const CURRENCY_SYMBOLS := [
	"secured_ragnarok_currency", "deposit_currency", "bank_deposit", "vault_deposit",
	"currency_token", "carry_currency", "vending_purchase", "recycle_for_currency",
]


func _body() -> void:
	probe_id = "R063"
	probe_title = "currency is physical and losable, banking needs an endpoint, vending and recycling cannot mint"
	owner_action = (
		"A0/A3: add a currency item with unique token ids, a physical deposit endpoint that writes only to "
		+ "profile.secured_ragnarok_currency, a fixed-price vending endpoint and a bounded recycler; make run reset "
		+ "drop unbanked currency and keep the run's faucet total conserved."
	)

	# ---- A. the product side: does any of this exist? -------------------
	var all_gd: Array = _all_gd_under("res://game")
	_note("game_scripts_scanned=%d" % all_gd.size())
	var found: Array = []
	for symbol: String in CURRENCY_SYMBOLS:
		var hits := _files_matching(all_gd, "\\b%s\\b" % symbol)
		if not hits.is_empty():
			found.append("%s in %s" % [symbol, JSON.stringify(hits)])
	_note("currency_symbols_found=%s" % JSON.stringify(found))
	if found.is_empty():
		_missing("any currency custody symbol (deposit endpoint, token id, vending, recycler) in runtime code", "res://game/")

	var persistent := _persistent_profile_categories()
	_note("persistent_profile_categories_present=%s" % JSON.stringify(persistent))
	if not persistent.has("secured_ragnarok_currency"):
		_missing("profile.secured_ragnarok_currency as a permitted persistent category (D063)", SAVE_SERVICE)

	# ---- B. the model, attacked ----------------------------------------
	_note("MODEL_ORACLE the checks below validate A7's acceptance model, not the product; product status is RED")
	_model_checks()
	_done()

# ------------------------------------------------------------------ model
## A deliberately small custody model. It is not a game system: it is the set of
## invariants the mission says the game system must have, made falsifiable.
class Ledger:
	## Endpoints are places, not functions: a deposit names where the player is.
	var endpoints: Dictionary = {"bank_crown_waystation": true, "bank_saffron_well": true}
	var here := "poi_crown_quarry"          # the player's real position
	var carried: Dictionary = {}            # token id -> value, inside one run
	var secured := 0                        # survives the run
	var minted_this_run := 0                # every unit that entered, for conservation
	var faucet_cap := 400
	var deposited_tokens: Dictionary = {}   # token id -> run id, for replay detection
	var recovery_bag: Dictionary = {}
	var run_id := "run-1"
	var expiry_losses := 0
	var abandon_payouts := 0
	var spent := 0                          # left the currency system as goods

	func mint(token: String, value: int) -> bool:
		if token.is_empty() or value <= 0 or carried.has(token) or deposited_tokens.has(token):
			return false
		if minted_this_run + value > faucet_cap:
			return false
		carried[token] = value
		minted_this_run += value
		return true

	func travel_to(where: String) -> void:
		here = where

	func deposit(token: String) -> String:
		if not carried.has(token):
			if deposited_tokens.has(token):
				return "duplicate_deposit"
			return "no_such_token"
		if not endpoints.has(here):
			return "not_at_bank"
		secured += int(carried[token])
		deposited_tokens[token] = run_id
		carried.erase(token)
		return ""

	func deposit_worth(total_token: String, value: int) -> String:
		## A player may deposit several times in one run; each deposit is its own
		## token so the second one is additive, never a re-parse of the first.
		return deposit(total_token) if carried.has(total_token) else "no_such_token"

	func die() -> void:
		## Exactly one recovery bag. Anything already in it is lost — that is the
		## point of "single bag", not an accumulation of bags.
		recovery_bag = {"contents": carried.duplicate(true), "where": here}
		carried = {}

	func recover() -> bool:
		if recovery_bag.is_empty():
			return false
		carried = (recovery_bag["contents"] as Dictionary).duplicate(true)
		recovery_bag = {}
		return true

	func purchase(price: int, where: String) -> String:
		if not endpoints.has(where):
			return "not_at_vendor"
		if price <= 0:
			return "invalid_price"
		var held := _carried_total()
		if held < price:
			return "insufficient"
		# Spend the exact price, tokens whole: no change is created out of nothing.
		spent += price
		var remaining := price
		var ids: Array = carried.keys()
		ids.sort()
		for id: String in ids:
			if remaining <= 0:
				break
			var value := int(carried[id])
			var taken := mini(value, remaining)
			remaining -= taken
			if taken == value:
				carried.erase(id)
			else:
				carried[id] = value - taken
		return ""

	func recycle(value_in: int, payout: int) -> String:
		## A recycler returns at most what the goods are worth and never more
		## currency than it consumed; it is a conversion, not a faucet.
		if payout > value_in:
			return "would_mint_currency"
		if minted_this_run + payout > faucet_cap:
			return "faucet_cap"
		minted_this_run += payout
		return ""

	func end_run(how: String) -> void:
		## Expiry and abandonment are different events with the same money rule:
		## unbanked currency is lost, and neither pays a reward.
		expiry_losses += _carried_total()
		carried = {}
		recovery_bag = {}
		if how == "abandon":
			abandon_payouts += 0

	func reset_to_new_run(new_id: String) -> void:
		run_id = new_id
		carried = {}
		recovery_bag = {}
		minted_this_run = 0
		here = "poi_crown_quarry"
		# secured and deposited_tokens deliberately survive: secured money is the
		# only durable kind, and past token ids must never pay twice.

	func _carried_total() -> int:
		var total := 0
		for id: String in carried:
			total += int(carried[id])
		return total


func _model_checks() -> void:
	# 1. A chest is not a bank.
	var ledger := Ledger.new()
	ledger.mint("t1", 50)
	_expect(ledger.deposit("t1") == "not_at_bank", "MODEL chest/field deposit is refused: banking needs a physical endpoint")
	_expect(ledger.secured == 0, "MODEL a refused deposit secures nothing")

	# 2. Carrying it is not owning it.
	_expect(ledger._carried_total() == 50, "MODEL carried value is tracked while it is still losable")

	# 3. A chest inside the run does not survive the run.
	ledger.end_run("expire")
	_expect(ledger.secured == 0 and ledger._carried_total() == 0, "MODEL expiry loses unbanked currency held anywhere in the run")

	# 4. Death yields exactly one recovery bag, and a second death loses it.
	ledger = Ledger.new()
	ledger.mint("t2", 30)
	ledger.mint("t3", 20)
	ledger.die()
	_expect(ledger.carried.is_empty() and not ledger.recovery_bag.is_empty(), "MODEL death moves currency into one recovery bag")
	ledger.mint("t4", 10)
	ledger.die()
	_expect(
		(ledger.recovery_bag["contents"] as Dictionary).size() == 1,
		"MODEL a second death replaces the bag instead of stacking a second one"
	)
	_expect(ledger.recover(), "MODEL the bag can be recovered")
	_expect(ledger.recover() == false, "MODEL a recovered bag cannot be collected twice")

	# 5. Physical deposit, 6. multiple deposits, 7. replay.
	ledger = Ledger.new()
	ledger.mint("t5", 60)
	ledger.travel_to("bank_crown_waystation")
	_expect(ledger.deposit("t5") == "", "MODEL a physical deposit at a bank endpoint is accepted")
	_expect(ledger.secured == 60, "MODEL the secured balance receives exactly the token value")
	_expect(ledger.deposit("t5") == "duplicate_deposit", "MODEL replaying a spent token is refused")
	ledger.mint("t6", 40)
	_expect(ledger.deposit("t6") == "", "MODEL a second deposit in the same run is allowed")
	_expect(ledger.secured == 100, "MODEL deposits are additive within one run")
	ledger.travel_to("poi_crown_quarry")

	# 8/9. Loss is the same for expiry and abandonment; 0. no reward either way.
	var before := ledger.secured
	ledger.mint("t7", 25)
	ledger.end_run("abandon")
	_expect(ledger.secured == before, "MODEL abandoning does not touch already-secured money")
	_expect(ledger.abandon_payouts == 0, "MODEL abandoning pays nothing")

	# 10. Only the secured amount crosses the run boundary, and old tokens cannot pay again.
	ledger.reset_to_new_run("run-2")
	_expect(ledger.secured == 100, "MODEL only the secured balance survives the reset")
	_expect(ledger.deposit("t5") != "", "MODEL a token banked in the previous run cannot be deposited again")
	_expect(ledger.deposit("t7") == "no_such_token", "MODEL a token lost at run end cannot be resurrected")

	# 11. Fixed-price vending: exact deduction, no free purchase, no change minted.
	ledger = Ledger.new()
	ledger.mint("t8", 100)
	_expect(ledger.purchase(30, "poi_crown_quarry") == "not_at_vendor", "MODEL a vendor purchase requires being at the vendor")
	_expect(ledger.purchase(30, "bank_crown_waystation") == "", "MODEL a purchase at the vendor succeeds")
	_expect(ledger._carried_total() == 70, "MODEL the exact price leaves the purse (no change created)")
	_expect(ledger.purchase(500, "bank_crown_waystation") == "insufficient", "MODEL a purchase beyond the purse is refused")
	_expect(ledger._carried_total() == 70, "MODEL a refused purchase costs nothing")

	# 12. The recycler is a conversion, not a faucet.
	ledger = Ledger.new()
	_expect(ledger.recycle(10, 25) == "would_mint_currency", "MODEL a recycler payout above the goods' worth is refused")
	_expect(ledger.minted_this_run == 0, "MODEL a refused recycle invented no currency")
	_expect(ledger.recycle(10, 6) == "", "MODEL a recycler payout at or below worth is allowed")
	_expect(ledger.minted_this_run == 6, "MODEL the recycler's payout is counted against the run faucet")
	ledger.faucet_cap = 8
	_expect(ledger.recycle(10, 6) == "faucet_cap", "MODEL the recycler cannot exceed the run's declared faucet")

	# Conservation: nothing in the model ever increases unless mint() or an
	# allowed recycle() did it, and both are bounded.
	var probe := Ledger.new()
	probe.mint("a", 10)
	probe.travel_to("bank_crown_waystation")
	probe.deposit("a")
	probe.mint("b", 5)
	probe.purchase(3, "bank_crown_waystation")
	_expect(
		probe.secured + probe._carried_total() + probe.spent == 15,
		"MODEL every unit is still accounted for after deposit, purchase and carry (banked + purse + spent)"
	)


func _all_gd_under(root: String) -> Array:
	var found: Array = []
	var dir := DirAccess.open(root)
	if dir == null:
		return found
	for name: String in dir.get_files():
		if name.ends_with(".gd"):
			found.append(root.path_join(name))
	for sub: String in dir.get_directories():
		found.append_array(_all_gd_under(root.path_join(sub)))
	return found
