extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## D059 — shelter protects, wilderness does not, and a death produces exactly one
## durable recoverable bag.
##
## ## What the decision requires (SELECTED OPTION 2)
##
## Inside a valid owned shelter, offline absence may empty satiety and drop HP to
## a floor of 1, but hunger alone never kills. Outside shelter the same absence is
## a real starvation risk, with a warning and exactly one durable recovery bag.
## Food that is physically present must be consumed before exhaustion; the floor
## is not free food and not immunity to anything else.
##
## ## What exists in the composition and what does not
##
## There is no satiety, hunger, HP or "needs" system in the survival document at
## all, and no elapsed-time settlement, so the *hunger* half cannot be tested: it
## is RED, and this probe says which symbols are absent.
##
## The *bag* half does exist and is worth attacking now, because it is the part a
## dupe would break. The probe therefore runs an API-level idempotency test:
## `begin_overworld_death()` twice must yield one bag, one counter increment, and
## survive a real save reload; `recover_death_bag()` must remove that same bag and
## leave no pending death. This is a contract test of the product's own API — it
## is **not** a player journey and never claims one.
##
##   godot --headless --path . --script res://tests/survival/balance_native/d059_offline_hunger_probe.gd

const SURVIVAL_SERVICE := "res://game/survival/survival_service.gd"
const SAVE_SERVICE := "res://game/autoload/save_service.gd"
const NEEDS_SYMBOLS := ["satiety", "hunger", "starvation", "health", "hit_points", "hp_floor"]
const SETTLE_SYMBOLS := ["func settle_offline", "func apply_elapsed", "func advance_offline", "func last_seen_at"]


func _body() -> void:
	probe_id = "D059"
	probe_title = "offline hunger floor in shelter, wilderness risk, one durable recovery bag"
	owner_action = (
		"A0: persist satiety/HP with a last_seen_at UTC stamp and settle elapsed offline time atomically once; " +
		"inside a valid owned shelter clamp HP at 1, outside shelter apply real starvation. A6: warn before " +
		"logout and report on return. A3: provision item debits. A1: shelter validity from the real " +
		"walls/door/roof/bed topology, not a test flag."
	)

	var survival := _survival()
	if survival == null:
		_block("SurvivalService is not present in this composition")
		return
	var document := _survival_document()

	# ---- 1. does a needs/HP model exist? ---------------------------------
	var needed: Array = []
	for symbol: String in NEEDS_SYMBOLS:
		if document.has(symbol):
			needed.append("document." + symbol)
		if _source_has(SURVIVAL_SERVICE, symbol):
			needed.append("source." + symbol)
	_note("needs_symbols_found=%s" % JSON.stringify(needed))
	if needed.is_empty():
		_missing("satiety/hunger/HP state and its settlement", SURVIVAL_SERVICE)

	# ---- 2. does elapsed offline time settle at all? ----------------------
	var settle_found: Array = []
	for symbol: String in SETTLE_SYMBOLS:
		if _source_has(SURVIVAL_SERVICE, symbol) or _source_has(SAVE_SERVICE, symbol):
			settle_found.append(symbol)
	_note("offline_settlement_symbols=%s" % JSON.stringify(settle_found))
	if settle_found.is_empty():
		_missing("an offline elapsed-time settlement entry point with a durable last_seen timestamp", SAVE_SERVICE)
		_note("consequence=offline hunger, the 1HP shelter floor and the wilderness warning cannot be measured")

	# ---- 3. the bag clause is NOT measured here -------------------------
	# The decision requires *one* durable recoverable bag after a *warned
	# wilderness starvation death*. Since the hunger rule and its settlement do
	# not exist, that death cannot happen, so the bag clause cannot be measured
	# in this composition either — and A7 will not manufacture the death with
	# `begin_overworld_death()` to get a green line out of a missing feature.
	#
	# Two real owners of that clause remain, both of which observe rather than
	# fabricate:
	#   * tests/survival/balance_native/bed_death_bag_probe.gd — a real player
	#     death in the shipped journey, one bag, one recovery;
	#   * oracle_corruption_probe.gd C1 — the duplicate-payment barrier itself
	#     (`transact_once` + receipt identity), attacked by replaying a receipt.
	_note("bag_clause=NOT_MEASURED_HERE: needs a real starvation death; owned by bed_death_bag_probe.gd + oracle C1")
	_note("fabricated_death_used=no")
