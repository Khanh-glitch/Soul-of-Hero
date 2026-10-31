extends Node
## A0 RunLifecycle — the ONE authority for a survival run (D062-D067, A3 V7
## `run_reset_rule`). Not an autoload, not a wallet, not a second save: every
## state change is one SaveService commit against the SAME document the rest of
## the game uses.
##
## Owned here and nowhere else:
##   run_id / run_epoch / run_started_at_unix / run_expires_at_unix (14 real
##   days, 1209600 s) and the derived `last72h` flag. Time is real UTC including
##   app closure; the pausable gameplay clock stays A3's ACTIVE-only domain and
##   is never used as a run deadline.
##
## Lifecycle states are durable and transition once:
##   active -> expired     (offline or online wall time reaches the deadline)
##   active -> exited      (explicit voluntary abandon / physical evacuation)
## Either terminal state clears every run-local namespace in one commit and keeps
## ONLY profile.secured_ragnarok_currency, profile.currency_receipts,
## profile.achievements and profile.run_history. A new run is then one more
## commit under a new run_id with epoch+1. A reload never rewinds the deadline,
## never revives an ended run, and a clock rollback fails closed.
##
## `save_loaded` / `save_reset` re-read the durable record; nothing is cached
## across processes.

signal run_started(run: Dictionary)
signal run_ended(run: Dictionary, reason: String)

const RUN_MAX_SECONDS := 1209600
const LAST_PHASE_SECONDS := 259200
const ENTRY_SECONDS := 950400
const RUN_START_TOKEN := "RUN_SOUL_OF_HERO_START"
const RUN_END_TOKEN := "RUN_SOUL_OF_HERO_END"
const PROFILE_ROOT := "profile"

var _save: Node
var _configured := false
var _event := ""
var last_error := ""
## Tests only: a fixed authoritative wall clock so the 264 h / 336 h boundaries
## can be exercised at +-1 s without waiting and without touching real time. It
## is set through `configure_test_clock` and never by gameplay or UI.
var _test_now := 0


func _ready() -> void:
	# As an autoload this binds the one authoritative SaveService at startup, so
	# Home, the menu and the overworld all see the same durable run identity.
	if _configured:
		return
	var save := get_node_or_null("/root/SaveService")
	if save != null:
		configure(save)


func configure(save: Node) -> bool:
	if _configured or save == null or not save.has_method(&"transact_once") \
			or not save.has_method(&"get_snapshot") or not save.has_method(&"reset_run_preserving_profile"):
		last_error = "incompatible_save_service"
		return false
	_save = save
	_configured = true
	_save.connect(&"save_loaded", _on_save_loaded)
	return true


func _exit_tree() -> void:
	if _save != null and is_instance_valid(_save) and _save.is_connected(&"save_loaded", _on_save_loaded):
		_save.disconnect(&"save_loaded", _on_save_loaded)


func _on_save_loaded(_snapshot: Dictionary) -> void:
	# The deadline is recomputed from the durable record on every load. This is
	# also the one place an offline expiry becomes visible to the player.
	var state := phase()
	if state.get("state", "") == "expired" and bool(state.get("just_expired", false)):
		_event = "expired"
		run_ended.emit(run_record(), "expired")


func _now() -> int:
	if _test_now > 0:
		return _test_now
	return int(Time.get_unix_time_from_system())


## Isolated native tests only. Returns false in a normal run so production code
## cannot silently pin the run clock.
func configure_test_clock(now_unix: int) -> bool:
	if not OS.is_debug_build() or not OS.get_cmdline_user_args().has("--survival-run-clock-test"):
		return false
	_test_now = now_unix
	return true


func _document() -> Dictionary:
	return _save.call(&"get_snapshot")


func run_record() -> Dictionary:
	var profile: Variant = _document().get(PROFILE_ROOT, {})
	if not profile is Dictionary:
		return {}
	var raw: Variant = (profile as Dictionary).get("run", {})
	if not raw is Dictionary or (raw as Dictionary).is_empty():
		return {}
	return (raw as Dictionary).duplicate(true)


func is_active() -> bool:
	return not run_record().is_empty()


## Read-only. `state` is one of absent/active/expired/exited. `phase` is the A3
## D062 naming for the same run: entry (0..264h), last72 (264..336h), expired.
func phase() -> Dictionary:
	var record := run_record()
	if record.is_empty():
		return {"state": "absent", "phase": "absent", "run_id": "", "seconds_elapsed": 0,
			"seconds_remaining": 0, "just_expired": false}
	var started := int(record.get("run_started_at_unix", 0))
	var expires := int(record.get("run_expires_at_unix", 0))
	var now := _now()
	var elapsed := now - started
	var durable := String(record.get("state", "active"))
	var state := durable
	var just_expired := false
	if durable == "active" and now >= expires:
		state = "expired"
		# Between the deadline passing and the durable transition, this flag is
		# the only difference the caller sees; it is not persisted by a read.
		just_expired = true
	var phase_id := "expired"
	if state == "active":
		phase_id = "last72" if elapsed >= ENTRY_SECONDS else "entry"
	return {
		"state": state,
		"phase": phase_id,
		"run_id": String(record.get("run_id", "")),
		"run_epoch": int(record.get("run_epoch", 0)),
		"run_started_at_unix": started,
		"run_expires_at_unix": expires,
		"now_unix": now,
		"seconds_elapsed": maxi(0, elapsed),
		"seconds_remaining": maxi(0, expires - now),
		"last72_window_seconds": LAST_PHASE_SECONDS,
		"just_expired": just_expired,
	}


# ---------------------------------------------------------------------------
# durable transitions
# ---------------------------------------------------------------------------
## Starts a NEW run. A live active run is never silently replaced: the caller
## must end it first, which is what makes the durable history entry honest.
func start_run(run_id_override: String = "") -> Dictionary:
	if not _configured:
		return {"ok": false, "reason": "not_configured"}
	var current := phase()
	if String(current.get("state", "absent")) == "active":
		return {"ok": false, "reason": "run_already_active", "run": current}
	var previous := run_record()
	var epoch := 1
	if not previous.is_empty():
		epoch = int(previous.get("run_epoch", 0)) + 1
	var now := _now()
	var run_id := run_id_override
	if run_id.is_empty():
		run_id = "run-%d-%08x" % [now, randi()]
	var record := {
		"run_id": run_id,
		"run_epoch": epoch,
		"run_started_at_unix": now,
		"run_expires_at_unix": now + RUN_MAX_SECONDS,
		"run_max_seconds": RUN_MAX_SECONDS,
		"last72_started_at_unix": now + ENTRY_SECONDS,
		"state": "active",
		"ended_at_unix": 0,
		"end_reason": "",
	}
	last_error = ""
	var refused_reason := ""
	var committed: bool = _save.call(&"transact_once", "soh.a0.run.start." + run_id,
		func(candidate: Dictionary) -> bool:
			var profile: Dictionary = candidate.get(PROFILE_ROOT, {}) if candidate.get(PROFILE_ROOT, {}) is Dictionary else {}
			var existing: Variant = profile.get("run", {})
			if existing is Dictionary and String((existing as Dictionary).get("state", "ended")) == "active":
				refused_reason = "run_already_active"
				return false
			profile["run"] = record.duplicate(true)
			if not profile.get("currency_receipts") is Array:
				profile["currency_receipts"] = []
			if not profile.get("run_history") is Array:
				profile["run_history"] = []
			if not profile.get("achievements") is Dictionary:
				profile["achievements"] = {"elder_stones": []}
			profile["schema"] = 1
			profile["secured_ragnarok_currency"] = maxi(0, int(profile.get("secured_ragnarok_currency", 0)))
			candidate[PROFILE_ROOT] = profile
			return true,
		{"kind": "a0_run_start", "run_id": run_id, "run_epoch": epoch})
	if not committed:
		last_error = refused_reason if not refused_reason.is_empty() else "run_start_refused"
		return {"ok": false, "reason": last_error}
	run_started.emit(record)
	return {"ok": true, "reason": "", "run": record}


## Closes the CURRENT run exactly once and resets run-local state. `reason` is
## one of `expired`, `voluntary_exit`, `evacuation`. A second call with the same
## run_id is refused (the record is no longer active), so a restart cannot charge
## a run twice or duplicate its history entry.
func end_run(reason: String, run_id: String = "") -> Dictionary:
	if not _configured:
		return {"ok": false, "reason": "not_configured"}
	if reason not in ["expired", "voluntary_exit", "evacuation"]:
		return {"ok": false, "reason": "invalid_end_reason"}
	var record := run_record()
	if record.is_empty() or String(record.get("state", "")) != "active":
		return {"ok": false, "reason": "no_active_run"}
	if not run_id.is_empty() and run_id != String(record.get("run_id", "")):
		return {"ok": false, "reason": "run_identity_mismatch"}
	var now := _now()
	if reason == "expired" and now < int(record.get("run_expires_at_unix", 0)):
		# Expiry is a wall-clock fact, never a caller's opinion.
		return {"ok": false, "reason": "not_expired"}
	if reason != "expired" and now >= int(record.get("run_expires_at_unix", 0)):
		reason = "expired"
	var ended := record.duplicate(true)
	ended["state"] = "expired" if reason == "expired" else "exited"
	ended["ended_at_unix"] = now
	ended["end_reason"] = reason
	var entry := {
		"run_id": String(record.get("run_id", "")),
		"run_epoch": int(record.get("run_epoch", 0)),
		"started_at_unix": int(record.get("run_started_at_unix", 0)),
		"ended_at_unix": now,
		"end_reason": reason,
		"elapsed_seconds": maxi(0, now - int(record.get("run_started_at_unix", 0))),
	}
	last_error = ""
	var committed: bool = _save.call(&"reset_run_preserving_profile", _save.RUN_RESET_TOKEN, ended, entry)
	if not committed:
		last_error = "run_reset_refused"
		return {"ok": false, "reason": last_error}
	run_ended.emit(ended, reason)
	return {"ok": true, "reason": "", "ended": ended, "history": entry}


## Ends the current run only if its own deadline has really passed. Used on load
## and before every life-consuming action, so an expired run can never be played
## as if it were alive.
func settle_expiry() -> Dictionary:
	var state := phase()
	if String(state.get("state", "")) != "expired":
		return {"ok": true, "reason": "run_active", "changed": false}
	var record := run_record()
	return end_run("expired", String(record.get("run_id", "")))


## Voluntary abandon / physical evacuation. Both are ordinary player choices, so
## they need the explicit token rather than a bare method call from any UI flag.
func abandon_run(token: String, evacuation: bool = false) -> Dictionary:
	if token != RUN_END_TOKEN:
		return {"ok": false, "reason": "invalid_run_end_token"}
	var record := run_record()
	if record.is_empty():
		return {"ok": false, "reason": "no_active_run"}
	return end_run("evacuation" if evacuation else "voluntary_exit", String(record.get("run_id", "")))


## A run-scoped read for UI/A6: never exposes a killed run as active.
func snapshot() -> Dictionary:
	var state := phase()
	var record := run_record()
	return {
		"run_id": String(state.get("run_id", "")),
		"run_epoch": int(state.get("run_epoch", 0)),
		"state": String(state.get("state", "absent")),
		"phase": String(state.get("phase", "absent")),
		"run_started_at_unix": int(state.get("run_started_at_unix", 0)),
		"run_expires_at_unix": int(state.get("run_expires_at_unix", 0)),
		"seconds_remaining": int(state.get("seconds_remaining", 0)),
		"real_seconds_clock": true,
		"gameplay_clock_domain": "soh.economy.active_tick.v1",
		"end_reason": String(record.get("end_reason", "")),
	}
