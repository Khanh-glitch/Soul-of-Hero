extends Node
## A0 side of A3's prepared-operation contract: the ONE authoritative real-UTC
## projection for `soh.economy.offline_time.v1` plus the single settlement
## boundary that commits A3's read-only plan.
##
## Rules this file is built to keep:
##   * A3 owns every rate, cost, escrow check and output. This host never invents
##     an amount: it asks A3 to re-plan from the live candidate inside the
##     mutator and commits only what A3 approved.
##   * The clock is real UTC and it only ever moves forward. `last_authenticated_unix`
##     is the durable high-water mark; a system clock that went backwards, a
##     repeated interval, or a projection the caller forged fails closed.
##   * Nothing settles while the run is expired or ended: the run expiry caps the
##     effective interval, so an offline job stops at the deadline instead of
##     minting past it.
##   * Settlement is exactly once per (run, interval): the proposal id is the
##     SaveService idempotency key, so a second process, a replay or an
##     interrupted write cannot double-pay.
##   * No active gameplay clock is touched: A3's own plan reports
##     `active_source_cooldowns_changed: false` and `world_action_claims: 0`.
const Offline = preload("res://game/survival/economy/offline_operation_planner.gd")
const Lifecycle = preload("res://game/survival/economy/a0_run_lifecycle.gd")
const TIME_CONTRACT := "soh.economy.offline_time.v1"
const CALENDAR_ID := "soh.world.calendar.v1"
const CALENDAR_RATE_POLICY := "a0_continuous_world_projection_v1"
const WORLD_US_PER_SECOND := 1000000

var _save: Node
var _adapter: RefCounted
var _lifecycle: Node
var _station_source: Callable
var _projection_sequence := 0
var last_error := ""
var last_plan: Dictionary = {}
var last_settle: Dictionary = {}


## `station_source` is an A0 read-only callable returning
## `{station_id: {station_revision, operational, condition}}` for the stations
## that physically exist in this run. A3 owns what an eligible job is; A0 owns
## which physical stations exist and whether they still work.
func configure(save: Node, adapter: RefCounted, lifecycle: Node, station_source: Callable = Callable()) -> bool:
	if save == null or adapter == null or lifecycle == null:
		last_error = "incompatible_offline_composition"
		return false
	_save = save
	_adapter = adapter
	_lifecycle = lifecycle
	_station_source = station_source if station_source.is_valid() else Callable()
	return true


func _document() -> Dictionary:
	return _save.call(&"get_snapshot")


func _now() -> int:
	return int(Time.get_unix_time_from_system())


func _offline_state() -> Dictionary:
	var economy: Variant = _document().get("survival_economy", {})
	if not economy is Dictionary:
		return Offline.empty_state()
	var raw: Variant = (economy as Dictionary).get("offline", {})
	return raw if raw is Dictionary and not (raw as Dictionary).is_empty() else Offline.empty_state()


## Stations A3 may project: real, physically mounted, currently operable. A
## station that was demolished or broken before the closure cannot pay out.
func _station_projection(run_id: String) -> Dictionary:
	var out := {}
	if not _station_source.is_valid():
		return out
	var value: Variant = _station_source.call()
	if not value is Dictionary:
		return out
	for raw_id: Variant in (value as Dictionary).keys():
		var data: Variant = (value as Dictionary)[raw_id]
		if not data is Dictionary or (data as Dictionary).is_empty():
			continue
		var revision := String((data as Dictionary).get("station_revision", ""))
		if revision.is_empty():
			continue
		out[String(raw_id)] = {
			"owner_run_id": run_id,
			"station_revision": revision,
			"operational": bool((data as Dictionary).get("operational", false)),
			"condition": int((data as Dictionary).get("condition", 0)),
		}
	return out


## Builds the projection A3 will hash-match. Anything the caller passes is
## ignored: this is the only producer, and it reads the durable document.
func project(interval_start_unix: int, interval_end_unix: int) -> Dictionary:
	var run: Dictionary = _lifecycle.call(&"phase")
	if String(run.get("state", "")) != "active":
		last_error = "run_not_active"
		return {}
	var started := int(run.get("run_started_at_unix", 0))
	var expires := int(run.get("run_expires_at_unix", 0))
	var high_water := maxi(int(_offline_state().get("last_authenticated_unix", 0)), started)
	var now := _now()
	if interval_end_unix > now:
		# A caller may not forecast a future interval as if it had happened.
		last_error = "interval_in_future"
		return {}
	if interval_start_unix < high_water:
		last_error = "clock_rollback"
		return {}
	if interval_end_unix < interval_start_unix:
		last_error = "invalid_interval"
		return {}
	_projection_sequence += 1
	var calendar_start := int(high_water - started) * WORLD_US_PER_SECOND
	var calendar_end := int(interval_end_unix - started) * WORLD_US_PER_SECOND
	var projection := {
		"contract": TIME_CONTRACT,
		"run_id": String(run.get("run_id", "")),
		"run_started_at_unix": started,
		"run_expires_at_unix": expires,
		"interval_start_unix": interval_start_unix,
		"interval_end_unix": interval_end_unix,
		"last_authenticated_unix": high_water,
		"projection_sequence": int(_offline_state().get("last_projection_sequence", 0)) + _projection_sequence,
		"projection_id": "a0proj-%s-%d-%d" % [String(run.get("run_id", "")).sha256_text().substr(0, 12), interval_end_unix, _projection_sequence],
		"world_calendar": {
			"run_id": String(run.get("run_id", "")),
			"calendar_id": CALENDAR_ID,
			"rate_policy_id": CALENDAR_RATE_POLICY,
			"start_world_us": maxi(0, calendar_start),
			"end_world_us": maxi(0, calendar_end),
			"rate_approval": "NOT_USER_LOCKED",
		},
		"stations": _station_projection(String(run.get("run_id", ""))),
	}
	last_error = ""
	return projection


## The projection callable A3 calls back for `_exact_host_request`. It must agree
## byte-for-byte with the request this host handed out; that is what makes a
## forged or stale request fail instead of paying out.
func host_projection() -> Dictionary:
	return last_plan.get("last_projection", {})


## Read-only: asks A3 for the bounded delta. Never mutates or commits.
func plan(interval_end_unix: int) -> Dictionary:
	var state := _offline_state()
	var started := int(_lifecycle.call(&"phase").get("run_started_at_unix", 0))
	if started <= 0:
		return {"ok": false, "reason": "run_not_active"}
	var high_water := maxi(int(state.get("last_authenticated_unix", 0)), started)
	var projection := project(high_water, interval_end_unix)
	if projection.is_empty():
		return {"ok": false, "reason": last_error}
	last_plan = {"last_projection": projection}
	var proposal: Dictionary = _adapter.call(&"plan_offline_operations", projection)
	last_plan["proposal"] = proposal
	last_plan["request"] = projection
	return proposal


## Commits exactly one settlement. Returns the A3 result merged with the A0
## commit outcome; a rejected plan or a duplicate key reports why.
func settle(interval_end_unix: int) -> Dictionary:
	var proposal: Dictionary = plan(interval_end_unix)
	if not bool(proposal.get("ok", false)):
		last_settle = {"ok": false, "reason": String(proposal.get("reason", "plan_failed")), "duplicate": false}
		return last_settle
	var operations: Array = proposal.get("operations", [])
	if operations.is_empty():
		last_settle = {"ok": true, "reason": "nothing_to_settle", "duplicate": false,
			"blocked": proposal.get("blocked", []), "proposal_id": String(proposal.get("proposal_id", ""))}
		return last_settle
	var proposal_id := String(proposal.get("proposal_id", ""))
	var request: Dictionary = last_plan.get("request", {})
	# The commit is authored by the pinned A0 adapter shim, so the SaveService
	# economy capability still only accepts mutators owned by that adapter.
	var result: Dictionary = _adapter.call(&"commit_offline_settlement", proposal, request, proposal_id)
	var committed := bool(result.get("ok", false))
	last_settle = {
		"ok": committed,
		"reason": String(result.get("reason", "")),
		"duplicate": bool(result.get("duplicate", false)),
		"proposal_id": proposal_id,
		"operations": operations.size(),
		"applied": result.get("applied", {}),
		"blocked": proposal.get("blocked", []),
	}
	if committed:
		last_settle["run_expired"] = bool(proposal.get("run_expired", false))
	last_plan.clear()
	return last_settle
