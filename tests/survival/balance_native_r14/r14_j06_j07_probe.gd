extends "res://tests/survival/balance_native_r14/r14_harness.gd"
## Round 14: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP2 — J06 and J07: the last 72 hours, and what survives the reset.
##
## J06 is the custodial climax: physical, losable currency exists only in the last
## 72 hours of a run, it must be carried to a fixed location and deposited, and only
## the deposit becomes a profile benefit. J07 is the exit: expiry at exactly 336 h,
## voluntary abandon, physical evacuation, an immutable history and exactly three
## carried-over benefits.
##
## The probe is deliberately split into what it can prove and what it cannot:
##
## * **proved here** — the currency is a real unique physical token in the shipped
##   catalogue; six elder stones are explicitly not money; a claim before 264 h is
##   refused by the planner; a claim in the last 72 h reaches the *physical source*
##   gate and stops there with the exact reason; a deposit at an unvisited,
##   un-authorized kiosk is refused and secures nothing; an un-deposited token is
##   destroyed by the run reset; a deposited profile balance, the elder stones and
##   the run history survive it; and the run closes at 336 h with one immutable
##   history entry and reopens with a new identity.
## * **not proved, and never upgraded** — that a player can actually walk to a
##   chest and carry currency home. No A8 chest exists in this composition, so the
##   source authority reports `opened: false` and the probe records it as missing
##   rather than staging a fixture reward.
##
## Two mutations are unavoidable and are named: `MUTATION_RUN_CLOCK` (eleven days
## cannot pass inside a probe) and `MUTATION_DIRECT_WRITE` (the wallet has no
## player-facing deposit door yet, so the reset claim is driven through the port the
## product itself owns).

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const KIOSK := "preservation_kiosk_01"
const CHEST_SOURCE := "elder_ashen_vault"
const CURRENCY := "ragnarok_unbanked"

func _body() -> void:
	probe_id = "R14J06"
	probe_title = "J06/J07 last-72h custody, deposit refusal, run reset, and the three carried benefits"
	owner_action = (
		"A1/A8: the last-72 h currency has no physical source and the nine kiosks are still candidate endpoints, so "
		+ "no player can earn or bank it. A0: nothing in game/ calls `abandon_run`/`evacuation`, so voluntary exit "
		+ "and the physical evac are API-only. Everything else — the token, the guards, the reset and the history — "
		+ "behaves."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return
	var port: RefCounted = _composition().get(&"_port") if _composition() != null else null
	var adapter := _adapter()
	if port == null or adapter == null:
		_missing("a bound profile port and A3 adapter", "a0_economy_composition.gd")
		_done()
		return

	_currency_is_physical()
	await _claim_gates(port, adapter)
	await _deposit_gate(port, adapter)
	await _reset_and_benefits(port, adapter)

	_done()


# ------------------------------------------------- 1. the token is physical
func _currency_is_physical() -> void:
	var catalog: Variant = JSON.parse_string(_source("res://data/survival/items/items.json"))
	var items: Dictionary = {}
	if catalog is Dictionary and (catalog as Dictionary).get("items") is Dictionary:
		items = (catalog as Dictionary)["items"]
	var token: Dictionary = items.get(CURRENCY, {}) if items.get(CURRENCY) is Dictionary else {}
	_expect(not token.is_empty(), "the physical late-run currency exists as a catalogue item (%s)" % CURRENCY)
	_expect(String(token.get("kind", "")) == "key_item", "the currency is a key item, not a stackable material (%s)" % String(token.get("kind", "")))
	_expect(String(token.get("storage", "")) == "instance", "the currency is stored as a unique instance, so it can be lost (%s)" % String(token.get("storage", "")))
	var policy: Variant = JSON.parse_string(_source("res://data/survival/recipes/meta_economy.v1.json"))
	var locked: Dictionary = {}
	var stones: Array = []
	var sources: Array = []
	if policy is Dictionary and (policy as Dictionary).get("policy") is Dictionary:
		var p: Dictionary = (policy as Dictionary)["policy"]
		locked = p.get("creator_locked", {})
		stones = p.get("elder_stones", [])
		sources = p.get("currency_sources", [])
	_expect(int(locked.get("run_max_seconds", 0)) == 1209600, "the run length is locked at 336 h in the policy")
	_expect(int(locked.get("ragnarok_start_elapsed_seconds", 0)) == 950400, "the last-72 h window starts at 264 h")
	_expect(bool(locked.get("physical_deposit_required", false)), "the policy requires a physical deposit")
	_expect(bool(locked.get("no_core_vendor", false)), "the policy forbids vending a Skill Core")
	_expect(stones.size() == 6, "the six elder stones are declared (%d)" % stones.size())
	var stones_are_money := 0
	for stone: Variant in stones:
		if stone is Dictionary and int((stone as Dictionary).get("currency_value", 0)) != 0:
			stones_are_money += 1
	_expect(stones_are_money == 0, "no elder stone is money (%d offenders)" % stones_are_money)
	_expect(sources.size() >= 6, "the policy declares the currency sources (%d)" % sources.size())
	var candidate := 0
	for source: Variant in sources:
		if source is Dictionary and String((source as Dictionary).get("integration_status", "")).begins_with("OWNER_CONTRACT_CANDIDATE"):
			candidate += 1
	_note("currency sources: %d, of which owner-candidate (not physical) = %d" % [sources.size(), candidate])


# --------------------------------------------------- 2. the claim guard rails
func _claim_gates(port: RefCounted, adapter: RefCounted) -> void:
	var run := _active_run()
	var claim := func(source_id: String) -> Dictionary:
		return adapter.call(&"plan_meta_source_claim", {
			"contract": "soh.economy.meta_source_authority.v1",
			"run_id": String(run.get("run_id", "")),
			"source_id": source_id,
			"source_instance_id": "a7.r11.chest.%d" % Time.get_ticks_usec(),
			"expected_generation": 1,
			"event_id": "a7.r11.claim.%d" % Time.get_ticks_usec(),
		}) as Dictionary

	# (a) before the last 72 hours the planner refuses outright.
	_forge_run_clock(100 * 3600)
	var early: Dictionary = claim.call(CHEST_SOURCE)
	_expect(not bool(early.get("ok", true)),
		"a currency claim at 100 h is refused (%s)" % String(early.get("reason", "")))
	_expect(String(early.get("reason", "")) == "premature_ragnarok_claim",
		"the refusal names the last-72 h boundary, not an unrelated error (%s)" % String(early.get("reason", "")))

	# (b) inside the window, the planner accepts the window and stops at the
	# physical source — which is the honest blocker for this composition.
	_forge_run_clock(11 * 86400 + 12 * 3600)
	var phase := _run_phase()
	_expect(String(phase.get("phase", "")) == "last72",
		"at 276 h the run is in its last-72 h phase (%s)" % String(phase.get("phase", "")))
	var late: Dictionary = claim.call(CHEST_SOURCE)
	_note("claim in last72 -> ok=%s reason=%s" % [str(late.get("ok", false)), String(late.get("reason", ""))])
	_expect(not bool(late.get("ok", true)),
		"the claim still stops at the physical source gate (%s)" % String(late.get("reason", "")))
	_expect(String(late.get("reason", "")) in ["source_authority_absent", "source_identity_forgery", "source_not_openable"],
		"the blocker is the absent physical chest, not a planner formula (%s)" % String(late.get("reason", "")))
	if String(late.get("reason", "")) in ["source_authority_absent", "source_identity_forgery", "source_not_openable"]:
		_missing("a physical awakened-elder chest the player can open in the last 72 h (A8 source, A1 geometry)",
			"plan_meta_source_claim(%s) -> %s; the world binds no instance of it" % [CHEST_SOURCE, String(late.get("reason", ""))])

	# (c) an un-authorized source id cannot be claimed by naming it.
	var forged: Dictionary = claim.call("a7_forged_chest")
	_expect(String(forged.get("reason", "")) == "source_not_policy_authorized",
		"a source id outside the policy is refused by name (%s)" % String(forged.get("reason", "")))


# --------------------------------------------------------- 3. the deposit gate
func _deposit_gate(port: RefCounted, adapter: RefCounted) -> void:
	var run := _active_run()
	# The player must be standing on the authored stand cell for the endpoint to be
	# operational; the kiosk's stand is the Waystation locker cell in this
	# composition, so the check below is about authority, not about a teleport.
	var stand := _endpoint_stand_cell(KIOSK)
	_note("kiosk %s authored stand=%s hero=%s" % [KIOSK, str(stand), str(_hero_cell())])
	var auth: Dictionary = port.call(&"endpoint_authority", KIOSK)
	_note("kiosk authority: blocked=%s operational=%s visited=%s" % [
		String(auth.get("blocked_reason", "")), str(auth.get("operational", false)), str(auth.get("visited", false)),
	])
	_expect(not bool(auth.get("operational", true)),
		"an owner-candidate kiosk is never operational for a deposit")
	_expect(String(auth.get("blocked_reason", "")).begins_with("A1_A8_ENDPOINT_UNAUTHORIZED"),
		"the kiosk reports the owner status that blocks it (%s)" % String(auth.get("blocked_reason", "")))

	var balance_before := int(port.call(&"balance"))
	var planned: Dictionary = adapter.call(&"plan_meta_deposit", {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": String(run.get("run_id", "")),
		"endpoint_id": KIOSK,
		"token_ids": ["a7.r11.token.0001"],
		"expected_policy_revision": 1,
		"expected_endpoint_revision": String(auth.get("endpoint_revision", "rev-1")),
		"event_id": "a7.r11.deposit.%d" % Time.get_ticks_usec(),
	}) as Dictionary
	_expect(not bool(planned.get("ok", true)),
		"a deposit at the unauthorized kiosk is refused (%s)" % String(planned.get("reason", "")))
	_expect(int(port.call(&"balance")) == balance_before,
		"a refused deposit secures nothing (%d)" % int(port.call(&"balance")))


# ------------------------------------------- 4. the reset and the three benefits
func _reset_and_benefits(port: RefCounted, adapter: RefCounted) -> void:
	# A token the player never banked: real item, real loss on reset.
	_grant(CURRENCY, "key_item", 2, "a7.r11.j06.token")
	var tokens_held := _count_item(CURRENCY)
	_expect(tokens_held >= 2,
		"FIXTURE_GRANT the un-banked currency exists in the run bag as real tokens (%d)" % tokens_held)

	# A deposited profile balance. The product has no player door to it in this
	# composition (see R11J06's owner note), so the port A0 owns is driven directly.
	var receipt := port.call(&"commit_profile_delta", "a7.r11.j06.deposit.1", 5, {"kind": "probe_deposit"}) as Dictionary
	_expect(bool(receipt.get("ok", false)),
		"MUTATION_DIRECT_WRITE the A0 commit boundary accepts one wallet receipt (%s)" % String(receipt.get("reason", "")))
	var replay := port.call(&"commit_profile_delta", "a7.r11.j06.deposit.1", 5, {"kind": "probe_deposit"}) as Dictionary
	_expect(not bool(replay.get("ok", true)) and bool(replay.get("duplicate", false)),
		"the same receipt cannot be applied twice (%s)" % String(replay.get("reason", "")))
	var balance := int(port.call(&"balance"))
	_expect(balance == 5, "the profile holds exactly the deposited amount (%d)" % balance)

	# Fill some run-local state that must NOT survive: a chest and materials.
	var build: Node = mounted_world.get(&"survival_build")
	var structures_before := (_survival().call(&"structures") as Dictionary).size()
	if build != null:
		_grant("oak_wood", "material", 8, "a7.r11.j06.oak")
		_grant("iron_scrap", "material", 2, "a7.r11.j06.iron")
		var cell := _free_cell_near(_hero_cell(), build)
		if cell.x >= 0:
			_place(build, "chest_wood", cell)
	var structures_after_place := (_survival().call(&"structures") as Dictionary).size()
	_note("structures before=%d after_place=%d" % [structures_before, structures_after_place])

	# The run really reaching its deadline is what closes it.
	_forge_run_clock(336 * 3600 + 60)
	var expired := _run_phase()
	_expect(String(expired.get("state", "")) == "expired",
		"at 336 h the run reports expired before anything closes it (%s)" % String(expired.get("state", "")))
	var settled: Dictionary = _lifecycle().call(&"settle_expiry")
	_expect(bool(settled.get("ok", false)),
		"the product closes the expired run through its own settle_expiry (%s)" % String(settled.get("reason", "")))
	var ended: Dictionary = settled.get("ended", {})
	_expect(String(ended.get("end_reason", "")) == "expired",
		"the closed run records expiry as its reason (%s)" % String(ended.get("end_reason", "")))
	var history_entry: Dictionary = settled.get("history", {})
	_expect(int(history_entry.get("elapsed_seconds", 0)) >= 336 * 3600,
		"the history entry spans at least the full 336 h (%d s)" % int(history_entry.get("elapsed_seconds", 0)))

	# --- what survived -----------------------------------------------------
	var profile := _bound_profile()
	_expect(int(profile.get("secured_ragnarok_currency", -1)) == 5,
		"the deposited currency is a profile benefit and survives the reset (%d)" % int(profile.get("secured_ragnarok_currency", -1)))
	var history: Array = profile.get("run_history", []) if profile.get("run_history") is Array else []
	_expect(history.size() == 1, "the profile keeps exactly one history entry for the closed run (%d)" % history.size())
	if history.size() == 1:
		_expect(String((history[0] as Dictionary).get("end_reason", "")) == "expired",
			"the kept history entry says the run expired")
	var achievements: Dictionary = profile.get("achievements", {}) if profile.get("achievements") is Dictionary else {}
	_expect(achievements.has("elder_stones"), "the third permitted benefit (elder stones) is part of the kept profile")

	# --- what did not ------------------------------------------------------
	_expect(_count_item(CURRENCY) == 0,
		"the un-banked physical currency is destroyed by the reset (%d left)" % _count_item(CURRENCY))
	_expect(_count_item("oak_wood") == 0, "the run's materials are gone (%d left)" % _count_item("oak_wood"))
	_expect((_survival().call(&"structures") as Dictionary).size() == 0,
		"the run's built structures are gone (%d left)" % (_survival().call(&"structures") as Dictionary).size())

	# --- a new run, and the histories stay put -----------------------------
	var started: Dictionary = _lifecycle().call(&"start_run")
	_expect(bool(started.get("ok", false)), "a new run opens after the reset (%s)" % String(started.get("reason", "")))
	var new_run: Dictionary = _active_run()
	_expect(String(new_run.get("run_id", "")) != String(run_id_of(history_entry)),
		"the new run has a new identity (%s)" % String(new_run.get("run_id", "")))
	_expect(int(port.call(&"balance")) == 5, "the carried currency is still spendable in the new run (%d)" % int(port.call(&"balance")))
	var history_after: Array = _bound_profile().get("run_history", [])
	_expect(history_after.size() == 1, "opening a new run does not rewrite the closed run's history (%d entries)" % history_after.size())

	# --- the exit doors that do not exist for a player ---------------------
	var abandon_without_token: Dictionary = _lifecycle().call(&"abandon_run", "not-a-token")
	_expect(not bool(abandon_without_token.get("ok", true)),
		"abandon is refused without the product's own token (%s)" % String(abandon_without_token.get("reason", "")))
	var abandon_callers := _source_calls("res://game", "abandon_run", "a0_run_lifecycle.gd")
	# A0 calls its own lifecycle through a `Callable` (`_lifecycle.call(&"end_run", …)`),
	# so the literal `end_run(` never appears at a call site. Search the dynamic form.
	var end_callers := _source_calls("res://game", "\"end_run\"", "a0_run_lifecycle.gd")
	_note("calls to abandon_run in game/ = %d, calls to end_run( in game/ = %d" % [abandon_callers, end_callers])
	if abandon_callers == 0:
		_missing("a player-facing voluntary abandon / physical evacuation door",
			"a0_run_lifecycle.abandon_run has no caller in game/ (0 hits); the finale cannot be chosen by a player")
	_expect(end_callers >= 1,
		"the product itself closes a run on the ordinary path (composition expiry path)")


func run_id_of(entry: Dictionary) -> String:
	return String(entry.get("run_id", ""))


func _finish() -> void:
	_release_all()
	super._finish()
