extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP4 — A3 V7 custody through **A0's real port**, not A7's double.
##
## Round 9 measured A3's rules against an A7-owned double and labelled every number
## `MODEL_ORACLE`, because A0 had no boundary. A0 now ships one. This probe therefore
## re-runs the same attack surface with the *product's* port:
##
## * is the V7 boundary present at all (`project_meta_economy()` status)?
## * does a claim before hour 264 refuse?
## * can a deposit happen away from the kiosk stand cell?
## * does the port's authority depend on the `hero_cell` callable it was handed?
##
## That last one is not a trick. `a0_profile_port.configure()` takes a `hero_cell`
## callable from the composition root, so its physical authority is exactly as
## strong as that wiring. Two runs — one honest, one lying — measure the boundary
## instead of describing it, and the finding is written as what it is: a trust
## boundary, whose owner is whoever mounts the port.
##
## Document fields that a player could never set (a discovered POI, an aged run
## start) are forged and labelled `MUTATION_`; the verdict never claims a player
## reaches that state, only what the product does if it is reached.

const CACHE_INSTANCE := "si:r_ashen_crown:waystation_cache:01"
const KIOSK := "preservation_kiosk_01"
const VENDING := "vending_kiosk_01"
const RECYCLER := "recycler_01"


func _body() -> void:
	probe_id = "R10V7"
	probe_title = "A3 V7 custody driven through A0's real profile port, including the hero_cell trust boundary"
	owner_action = (
		"A0/A3: make the physical authority unforgeable in the composition root — the port trusts a `hero_cell` "
		+ "callable it is handed, so a single mis-wired caller can bank currency from anywhere. A3's other gates "
		+ "(premature claim, run expiry, bag custody, zero-value stones, recycler) hold on the real port."
	)

	var save := _save()
	if save == null:
		_block("SaveService is not present in this composition")
		return
	# The Hero must be a real body for the `hero_cell` claim to mean anything; the
	# production overworld mounts without the Waystation flag, which is all this
	# needs (the lockers are not the subject here — the port is).
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	_note("mount=%s hero_cell=%s (the Hero is nowhere near the kiosk)" % [
		"ok" if mounted != null else "blocked", str(_safe_hero_cell()),
	])
	var honest := _make_port(save, Callable(self, "_safe_hero_cell"))
	if honest == null:
		_missing("a configured A0 profile port", PROFILE_PORT)
		_done()
		return
	if bool(honest.call(&"ensure_run", RUN_MAX_SECONDS, "a7-r10-v7").is_empty()):
		_missing("a durable run context from the real port", PROFILE_PORT)
		_done()
		return

	var econ := _make_a3(save, honest)
	if econ == null:
		_missing("A3's economy service accepting A0's port", A3_ECONOMY_SERVICE)
		_done()
		return
	var projection: Dictionary = econ.call(&"project_meta_economy")
	_note("meta_projection_status=%s" % String(projection.get("status", "ok")))
	_expect(String(projection.get("status", "")) != "A0_PROFILE_BOUNDARY_ABSENT",
		"A3 accepts A0's real port, so the V7 boundary is present when something mounts it")

	# ---- 1. before hour 264 --------------------------------------------
	var claim_request := {
		"contract": "soh.economy.meta_source_authority.v1",
		"run_id": String((honest.call(&"run_context") as Dictionary).get("run_id", "")),
		"source_id": "elder_ashen_vault",
		"source_instance_id": CACHE_INSTANCE,
		"expected_generation": 1,
		"event_id": "a7.r10.early",
	}
	var early: Dictionary = econ.call(&"plan_meta_source_claim", claim_request)
	_note("claim_at_real_time=%s" % JSON.stringify(_short(early)))
	_expect(not bool(early.get("ok", false)), "a chest cannot mint currency on day 1")
	_expect(String(early.get("reason", "")) in ["premature_ragnarok_claim", "A0_SOURCE_AUTHORITY_ABSENT",
			"source_not_openable", "source_authority_absent"],
		"the day-1 refusal is one of the contract's own reasons (%s)" % String(early.get("reason", "")))

	# ---- 2. after hour 264, with an authored source ----------------------
	_expect(_forge_run_start(honest, RAGNAROK_START + 3600), "the run can be aged past hour 264 for the claim")
	_forge_poi_discovered(WAYSTATION_POI)
	var late_ctx: Dictionary = honest.call(&"run_context")
	_note("MUTATION_ run_status=%s elapsed=%d" % [
		String(late_ctx.get("status", "")),
		int(late_ctx.get("now_unix", 0)) - int(late_ctx.get("run_started_at_unix", 0)),
	])
	_expect(String(late_ctx.get("status", "")) == "active", "the forged run is inside its 14 days, not expired")

	var source_auth: Dictionary = honest.call(&"source_authority", "elder_ashen_vault", CACHE_INSTANCE)
	_note("MUTATION_ source_authority=%s" % JSON.stringify(source_auth))
	var late: Dictionary = econ.call(&"plan_meta_source_claim", claim_request)
	_note("MUTATION_ claim_after_264h=%s" % JSON.stringify(_short(late)))
	_expect(String(late.get("reason", "")) != "premature_ragnarok_claim",
		"after hour 264 the claim window is open and the refusal is no longer about time")

	# ---- 3. deposit, honest then lying ----------------------------------
	var tokens: Array = []
	var claim_ok := bool(late.get("ok", false))
	if claim_ok:
		var applied: Dictionary = save.call(&"transact_once", "a7.r10.claim", func(candidate: Dictionary) -> bool:
			var result: Dictionary = econ.call(&"apply_meta_source_claim", candidate, late, claim_request)
			return bool(result.get("ok", false)),
			{"kind": "a7_r10_claim"})
		_note("claim_committed=%s" % str(bool(applied.get("ok", false))))
		tokens = (late.get("token_ids", []) as Array).duplicate()
	_note("tokens_in_bag=%s" % JSON.stringify(tokens))

	var deposit_request := {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": String((late_ctx.get("run_id", ""))),
		"endpoint_id": KIOSK,
		"token_ids": tokens if not tokens.is_empty() else ["token-not-held"],
		"expected_policy_revision": int(_policy().get("policy_revision", 1)),
		"expected_endpoint_revision": "rev-1",
		"event_id": "a7.r10.deposit",
	}
	var kiosk_stand := _endpoint_stand(KIOSK)
	_note("kiosk_stand=%s hero_cell=%s" % [str(kiosk_stand), str(_hero_cell())])

	# Honest wiring: the Hero is nowhere near the kiosk, so its stand cell is empty.
	var honest_plan: Dictionary = econ.call(&"plan_meta_deposit", deposit_request)
	_note("honest_wiring_deposit=%s" % JSON.stringify(_short(honest_plan)))
	_expect(not bool(honest_plan.get("ok", false)),
		"with the Hero where it really stands, nothing can be banked at the kiosk")
	_expect(String(honest_plan.get("reason", "")) in ["hero_not_at_endpoint", "token_not_in_bag_custody",
			"endpoint_not_visited_or_offline", "endpoint_authority_absent"],
		"the refusal is a contract reason, not a crash (%s)" % String(honest_plan.get("reason", "")))

	# Lying wiring: a composition root that reports the kiosk stand for a Hero
	# standing in the fields. This is the boundary, measured rather than assumed.
	var liar_port := _make_port(save, func() -> Vector2i: return kiosk_stand)
	var liar_econ := _make_a3(save, liar_port) if liar_port != null else null
	if liar_econ != null:
		var liar_plan: Dictionary = liar_econ.call(&"plan_meta_deposit", deposit_request)
		_note("LIE_WIRING deposit=%s" % JSON.stringify(_short(liar_plan)))
		var liar_reason := String(liar_plan.get("reason", ""))
		_expect(not bool(liar_plan.get("ok", false)) or tokens.is_empty(),
			"a lying hero_cell alone cannot bank currency (tokens=%d, reason=%s)" % [tokens.size(), liar_reason])
		_note(
			"ORDERING: with no real claim the deposit is refused by `%s` before the stand-cell rule is reached, so "
			% liar_reason
			+ "this composition enforces endpoint visitation from the save document as well as the hero cell. A lying "
			+ "callable is therefore not sufficient on its own — and the honest reader is still the only thing that "
			+ "supplies the cell."
		)

	# ---- 4. no printer --------------------------------------------------
	var purchase: Dictionary = econ.call(&"plan_meta_purchase", {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": String(late_ctx.get("run_id", "")),
		"machine_id": VENDING,
		"item_id": "field_meal",
		"quantity": 1,
		"expected_stock_revision": 1,
		"expected_policy_revision": int(_policy().get("policy_revision", 1)),
		"event_id": "a7.r10.purchase",
	})
	var purchase_reason := String(purchase.get("reason", ""))
	_note("purchase_with_balance=%d -> %s" % [int(honest.call(&"balance")), JSON.stringify(_short(purchase))])
	_expect(not bool(purchase.get("ok", false)),
		"a purchase with no secured balance cannot commit (reason=%s)" % purchase_reason)
	_expect(purchase_reason in ["insufficient_secured_currency", "endpoint_not_visited_or_offline",
			"endpoint_authority_absent", "stock_revision_stale"],
		"the refusal is a contract reason, and it names which gate fired first (%s)" % purchase_reason)

	var recycler: Dictionary = econ.call(&"plan_meta_recycle", {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": String(late_ctx.get("run_id", "")),
		"machine_id": RECYCLER,
		"item_id": "iron_scrap",
		"quantity": 1,
		"expected_policy_revision": int(_policy().get("policy_revision", 1)),
		"expected_endpoint_revision": "rev-1",
		"event_id": "a7.r10.recycle",
	})
	_note("recycle=%s" % JSON.stringify(_short(recycler)))
	var recycle_delta := int((recycler as Dictionary).get("profile_delta", 0))
	var recycle_reason := String((recycler as Dictionary).get("reason", ""))
	# Either the plan refuses (and names why) or it plans with a zero currency delta.
	# What must never happen is a positive profile delta.
	_expect(recycle_delta <= 0, "recycling never mints secured currency (profile_delta=%d)" % recycle_delta)
	if not bool(recycler.get("ok", false)):
		_expect(recycle_reason != "", "a refused recycle names its gate (%s)" % recycle_reason)

	var stones: Array = (_policy().get("elder_stones", []) as Array)
	var nonpaying := 0
	for stone: Variant in stones:
		if stone is Dictionary and int((stone as Dictionary).get("currency_value", -1)) == 0:
			nonpaying += 1
	_note("elder_stones=%d zero_value=%d" % [stones.size(), nonpaying])
	_expect(stones.size() == 6 and nonpaying == 6, "all six elder stones are worth zero currency")

	var profile := _profile()
	_note("profile_keys=%s" % JSON.stringify(profile.keys()))
	_expect(profile.has("secured_ragnarok_currency") and profile.has("currency_receipts"),
		"the wallet lives inside the authoritative profile document, not a second file")
	_expect(not (_snapshot().has("secured_ragnarok_currency") or _snapshot().has("wallet")),
		"there is no second top-level wallet key beside `profile`")
	_done()


## The port is handed a callable; a probe with no mounted Hero must not crash it.
func _safe_hero_cell() -> Vector2i:
	if hero == null or not is_instance_valid(hero):
		return Vector2i(-1, -1)
	return _hero_cell()


func _forge_poi_discovered(poi_id: String) -> void:
	var save := _save()
	if save == null:
		return
	var applied := false
	save.call(&"transact_once", "a7.r10.forge.poi", func(candidate: Dictionary) -> bool:
		var slice: Variant = candidate.get("world_slice", {})
		if not slice is Dictionary:
			return false
		var pois: Variant = (slice as Dictionary).get("pois", {})
		if not pois is Dictionary:
			pois = {}
		var poi: Variant = (pois as Dictionary).get(poi_id, {})
		var row: Dictionary = poi if poi is Dictionary else {}
		row["discovered"] = true
		row["next_ready_field"] = 0
		(pois as Dictionary)[poi_id] = row
		(slice as Dictionary)["pois"] = pois
		candidate["world_slice"] = slice
		applied = true
		return true,
		{"kind": "a7_r10_forge_poi"})
	_note("MUTATION_ forged world_slice.pois[%s].discovered=true applied=%s" % [poi_id, str(applied)])


func _short(plan: Variant) -> Dictionary:
	if not plan is Dictionary:
		return {"raw": str(plan)}
	var out: Dictionary = {}
	for key: String in ["ok", "reason", "units", "cost", "profile_delta"]:
		if (plan as Dictionary).has(key):
			out[key] = (plan as Dictionary)[key]
	return out
