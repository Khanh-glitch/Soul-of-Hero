extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## D055 / D056 / D057 — 14 real calendar days, one season closure, full gameplay
## reset, and a guide chain that only pays once per run.
##
## ## What the decision requires (verbatim scope, DECISIONS.md on refs/ct)
##
## D055: a run lasts 14x24 real hours including app-closed time; expiry is a
## durable UTC boundary, not a login event.
## D056: at expiry the next run starts from zero in *all* gameplay state; only
## `profile.achievements` and an immutable `profile.run_history` survive, in a
## namespace strictly separated from the disposable run state; the completed
## season record is preserved *before* the run state is dropped.
## D057: the starter chain resets every run, may be completed out of order from
## run 2 onward, and pays once per `run_id + quest_id`.
##
## ## How this probe behaves
##
## It looks for the rule in the shipped composition. Where the namespace or the
## boundary API does not exist it records `MISSING` (exit 3, RED_NOT_IMPLEMENTED)
## and prints the measurements an owner needs to implement it. It never invents a
## run, never writes a fake `run_id`, and never calls a season end that the
## product does not own.
##
##   godot --headless --path . --script res://tests/survival/balance_native/d055_d057_season_probe.gd

const SAVE_SERVICE := "res://game/autoload/save_service.gd"
const SURVIVAL_SERVICE := "res://game/survival/survival_service.gd"
const RUN_STATE_KEYS := ["run_id", "run_started_at", "run_expires_at", "season", "runs"]
const PROFILE_KEYS := ["profile", "profile.achievements", "profile.run_history"]
const QUEST_KEYS := ["quests", "run_quests", "starter_chain"]
const SEASON_SECONDS := 1_209_600


func _ready_probe() -> void:
	pass


func _body() -> void:
	probe_id = "D055"
	probe_title = "14-day run boundary, full gameplay reset, achievements/run history, first-run guidance"
	owner_action = (
		"A0: add a durable run namespace to the authoritative save - run_id, run_started_at (UTC), "
		"run_expires_at = run_started_at + 1209600 - plus profile.achievements and an immutable "
		"profile.run_history, all outside the disposable run state; add a season-end entry point that "
		"writes the result record BEFORE dropping run state. A3: scope quest reward receipts by "
		"run_id + quest_id."
	)

	var snapshot := _snapshot()
	if snapshot.is_empty():
		_block("SaveService returned no snapshot document")
		return

	# ---- 1. is there a run at all? -----------------------------------------
	var top_keys := snapshot.keys()
	top_keys.sort()
	_note("save_top_level_keys=%s" % JSON.stringify(top_keys))
	var present_run: Array = []
	for key: String in RUN_STATE_KEYS:
		if snapshot.has(key):
			present_run.append(key)
	_note("run_namespace_present=%s" % JSON.stringify(present_run))
	if present_run.is_empty():
		_missing("run_id / run_started_at / run_expires_at", SAVE_SERVICE)
		# The 14-day boundary cannot be measured without a run; the arithmetic the
		# owner must persist is still printed so the contract is unambiguous.
		_note("required_expiry_seconds=%d (14 x 24 x 3600)" % SEASON_SECONDS)

	# ---- 2. is there a durable profile outside the run? --------------------
	var profile: Variant = snapshot.get("profile", null)
	var profile_present := profile is Dictionary
	_note("profile_namespace_present=%s" % str(profile_present))
	if not profile_present:
		_missing("profile.achievements + profile.run_history", SAVE_SERVICE)
	else:
		var profile_dict: Dictionary = profile
		var keys := profile_dict.keys()
		keys.sort()
		_note("profile_keys=%s" % JSON.stringify(keys))
		if not profile_dict.has("achievements"):
			_missing("profile.achievements", SAVE_SERVICE)
		if not profile_dict.has("run_history"):
			_missing("profile.run_history", SAVE_SERVICE)
		if profile_dict.has("run_history") and not (profile_dict["run_history"] is Array):
			_expect(false, "run_history must be an append-only list of completed runs")
		# Separation is the actual D056 requirement: a run-scoped key must never
		# live inside the profile and a durable key must never live inside the run.
		for durable_only: String in ["core_uses", "recipes", "structures", "inventory"]:
			if profile_dict.has(durable_only):
				_expect(false, "profile must not carry disposable gameplay state (%s)" % durable_only)

	# ---- 3. does a season-end boundary exist in code? ----------------------
	var boundary_symbols := [
		"func end_run", "func season_state", "func run_expires_at", "func settle_season",
		"func start_run", "func begin_run",
	]
	var found_symbols: Array = []
	for symbol: String in boundary_symbols:
		if _source_has(SAVE_SERVICE, symbol):
			found_symbols.append(symbol)
	_note("run_boundary_symbols=%s" % JSON.stringify(found_symbols))
	if found_symbols.is_empty():
		_missing("a season-end / run-start entry point on SaveService", SAVE_SERVICE)
	else:
		var save := _save()
		for method: String in ["end_run", "start_run", "begin_run", "run_expires_at"]:
			_expect(save.has_method(StringName(method)), "SaveService exposes %s() once the boundary is claimed" % method)

	# ---- 4. D057 starter chain --------------------------------------------
	var quest_present: Array = []
	for key: String in QUEST_KEYS:
		if snapshot.has(key):
			quest_present.append(key)
		if _survival_document().has(key):
			quest_present.append("survival." + key)
	_note("quest_namespace_present=%s" % JSON.stringify(quest_present))
	if quest_present.is_empty():
		_missing("a per-run quest namespace with run-scoped receipts", SURVIVAL_SERVICE)
	else:
		# Once a quest namespace exists, a receipt must be keyed by run, or a
		# second run can never re-earn the same quest and the first run's claim
		# silently blocks it. That is the exact failure D057 forbids.
		var receipts: Dictionary = snapshot.get("applied_transactions", {})
		var run_scoped := 0
		for key: Variant in receipts.keys():
			if String(key).contains("run"):
				run_scoped += 1
		_note("transactions=%d run_scoped_receipts=%d" % [receipts.size(), run_scoped])
		_expect(run_scoped > 0, "quest receipts are scoped by run_id once quests exist")

	# ---- 5. what a second run would inherit today -------------------------
	# Measured, not asserted: this is the list A0 must be able to empty at the
	# boundary. Printing it now is what makes the reset testable later.
	var gameplay_keys: Array = []
	for key: Variant in snapshot.keys():
		var name := String(key)
		if name in ["schema", "settings", "profile"]:
			continue
		gameplay_keys.append(name)
	_note("state_that_must_reset_at_season_end=%s" % JSON.stringify(gameplay_keys))
	var survival_keys: Array = _survival_document().keys()
	survival_keys.sort()
	_note("survival_state_that_must_reset=%s" % JSON.stringify(survival_keys))
