extends RefCounted
## A0 production side of `soh.economy.a0_profile_port.v1` (A3 V7 D062-D067).
##
## This is the ONLY profile/run boundary. It is not an autoload, not a second
## save authority and not a second wallet: `profile.*` lives inside the SAME
## SaveService document that holds `inventory`, `survival` and `world_slice`,
## and every write happens inside one SaveService.transact_once mutator. A
## replayed proposal key returns duplicate and the old candidate is untouched;
## an interrupted write leaves the previous balance intact because the commit
## is ordinary SaveService atomic replace.
##
## Run lifecycle is A0-owned. A3 never invents run expiry: the run record is
## durable, `run_max_seconds` is passed in by the composition root from the
## A3 creator-locked policy, and `run_context()` only reports what the document
## holds. Absent run record => empty context => every A3 meta plan fails closed.
##
## Physical endpoint/source identity stays with A1/A8: authorizations are read
## from the A3 policy directory and the pinned A1 bindings, and a hero cell is
## only reported when the Hero genuinely stands on an authored stand cell.
const WorldSources = preload("res://game/survival/economy/world_source_adapter.gd")
const BINDINGS := "res://data/survival/items/world_source_bindings.v3.json"
const CONTRACT := "soh.economy.a0_profile_port.v1"
const RUN_CONTEXT_CONTRACT := "soh.economy.a0_run_context.v1"
const ENDPOINT_AUTH_CONTRACT := "soh.economy.meta_endpoint_authority.v1"
const SOURCE_AUTH_CONTRACT := "soh.economy.meta_source_authority.v1"
const ROOT := "profile"
const SCHEMA := 1
const PROFILE_MARKER := "profile.secured_ragnarok_currency"
const STONE_MARKER := "profile.achievements.elder_stones"
const MAX_DELTA := 1000000
## An endpoint may only authorize a meta deposit/vending/recycle when A1/A8 has
## actually accepted it. A3's policy currently marks every endpoint
## `OWNER_CONTRACT_CANDIDATE_A1_A8`; A0 must fail closed on that word rather than
## treat "listed in the policy" as "physically authorized".
const AUTHORIZED_ENDPOINT_STATUS := ["A1_A8_AUTHORIZED", "OWNER_AUTHORIZED_A1_A8", "A0_TEST_ONLY_AUTHORIZED"]

var _save: Node
var _policy_endpoints: Dictionary = {}
var _endpoint_poi: Dictionary = {}
var _hero_cell: Callable
var _bindings: Dictionary = {}
var _commit_open := false
var _commit_reason := ""
var last_error := ""


## Composition root only. `policy_endpoints` is A3's endpoint directory keyed by
## endpoint_id -> {kind, stand_cells, endpoint_revision}; `endpoint_poi` maps an
## endpoint_id to the A1/A8 POI that physically owns those stands; `hero_cell`
## is a pure read of the authoritative Hero stand cell.
func configure(
	save_service: Node,
	policy_endpoints: Dictionary,
	endpoint_poi: Dictionary,
	hero_cell: Callable = Callable()
) -> bool:
	if save_service == null or not save_service.has_method(&"transact_once") \
			or not save_service.has_method(&"get_snapshot"):
		last_error = "incompatible_save_service"
		return false
	_save = save_service
	_policy_endpoints = policy_endpoints.duplicate(true)
	_endpoint_poi = endpoint_poi.duplicate(true)
	_hero_cell = hero_cell if hero_cell.is_valid() else Callable()
	_bindings = _load_bindings()
	if _bindings.is_empty():
		last_error = "a1_bindings_unavailable"
		return false
	return true


static func _load_bindings() -> Dictionary:
	if not FileAccess.file_exists(BINDINGS):
		return {}
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(BINDINGS))
	return raw if raw is Dictionary else {}


func _document() -> Dictionary:
	return _save.call(&"get_snapshot")


func _now() -> int:
	return int(Time.get_unix_time_from_system())


# ---------------------------------------------------------------------------
# profile (one wallet, inside the authoritative document)
# ---------------------------------------------------------------------------
static func default_profile() -> Dictionary:
	return {
		"schema": SCHEMA,
		"secured_ragnarok_currency": 0,
		"achievements": {"elder_stones": []},
		"run_history": [],
		"currency_receipts": [],
	}


func read_profile(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get(ROOT, {})
	var profile: Dictionary = raw.duplicate(true) if raw is Dictionary else default_profile()
	if not profile.get("achievements") is Dictionary:
		profile["achievements"] = {"elder_stones": []}
	if not profile.get("achievements", {}).get("elder_stones") is Array:
		(profile["achievements"] as Dictionary)["elder_stones"] = []
	if not profile.get("run_history") is Array:
		profile["run_history"] = []
	if not profile.get("currency_receipts") is Array:
		profile["currency_receipts"] = []
	profile["secured_ragnarok_currency"] = maxi(0, int(profile.get("secured_ragnarok_currency", 0)))
	profile["schema"] = SCHEMA
	return profile


func balance() -> int:
	return int(read_profile(_document()).get("secured_ragnarok_currency", 0))


## A3 calls this ONLY from inside the mutator that A0 opened through
## commit_meta_deposit(); outside that boundary it refuses so no UI, chest,
## death, reset or expiry path can mint secured currency.
func apply_profile_delta(candidate: Dictionary, delta: int, receipt: Dictionary) -> bool:
	last_error = ""
	if not _commit_open:
		last_error = "a0_profile_commit_boundary_absent"
		return false
	if receipt.is_empty() or not receipt.get("receipt_id") is String \
			or String(receipt.get("receipt_id", "")).is_empty():
		last_error = "a0_profile_receipt_identity_absent"
		return false
	if delta == 0 or absi(delta) > MAX_DELTA:
		last_error = "a0_profile_delta_invalid"
		return false
	var profile := read_profile(candidate)
	var receipt_id := String(receipt["receipt_id"])
	var receipts: Array = profile["currency_receipts"]
	for entry: Variant in receipts:
		if entry is Dictionary and String((entry as Dictionary).get("receipt_id", "")) == receipt_id:
			last_error = "a0_profile_receipt_already_applied"
			return false
	var total := int(profile["secured_ragnarok_currency"]) + delta
	if total < 0:
		last_error = "a0_profile_negative_balance"
		return false
	profile["secured_ragnarok_currency"] = total
	receipts.append(receipt.duplicate(true))
	profile["currency_receipts"] = receipts
	candidate[ROOT] = profile
	return true


## One atomic A0 commit for an A0-owned wallet change (deposits arrive through
## commit_meta_deposit so A3 re-plans against the same candidate).
func commit_profile_delta(receipt_id: String, delta: int, metadata: Dictionary = {}) -> Dictionary:
	var receipt := {"receipt_id": receipt_id, "delta": delta, "applied_at_unix": _now()}
	receipt["metadata"] = metadata.duplicate(true)
	var result := {"ok": false, "reason": "not_attempted", "duplicate": false}
	var key := "soh.a0.profile.currency." + receipt_id.sha256_text()
	if _save.call(&"is_transaction_applied", key):
		return {"ok": false, "reason": "already_applied", "duplicate": true}
	var committed: bool = _save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		_commit_open = true
		var applied := apply_profile_delta(candidate, delta, receipt)
		_commit_open = false
		if not applied:
			result["reason"] = last_error
		return applied,
		{"kind": "a0_profile_currency", "receipt_id": receipt_id, "delta": delta})
	result["ok"] = committed
	if committed:
		result["reason"] = ""
	elif String(result["reason"]) == "not_attempted":
		result["reason"] = last_error if not last_error.is_empty() else "commit_refused"
	return result


## The single atomic deposit boundary from A3_META_ECONOMY_CONTRACT_V7: A0 opens
## ONE transact_once under `soh.a3.meta_deposit.<proposal_id>`, hands the live
## candidate to A3's apply_meta_deposit inside that mutator, and commits once.
## A3 re-plans against the candidate; a false/rejected proposal commits nothing.
func commit_meta_deposit(proposal_id: String, applier: Callable, payload: Dictionary = {}) -> Dictionary:
	var result := {"ok": false, "reason": "not_attempted", "duplicate": false, "proposal": {}}
	if proposal_id.is_empty() or not applier.is_valid():
		return {"ok": false, "reason": "invalid_meta_deposit_request", "duplicate": false, "proposal": {}}
	var key := "soh.a3.meta_deposit." + proposal_id
	if _save.call(&"is_transaction_applied", key):
		return {"ok": false, "reason": "already_applied", "duplicate": true, "proposal": {}}
	var committed: bool = _save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		_commit_open = true
		var applied: Variant = applier.call(candidate)
		_commit_open = false
		result["proposal"] = applied
		if applied is Dictionary and not bool((applied as Dictionary).get("ok", false)):
			result["reason"] = String((applied as Dictionary).get("reason", "meta_deposit_rejected"))
			return false
		if applied is bool and not bool(applied):
			result["reason"] = "meta_deposit_rejected"
			return false
		return true,
		({"kind": "a3_meta_deposit", "proposal_id": proposal_id} as Dictionary).merged(payload, true))
	result["ok"] = committed
	if committed:
		result["reason"] = ""
	elif String(result["reason"]) == "not_attempted":
		result["reason"] = "a0_commit_refused"
	return result


## Run lifecycle: A0 RunLifecycle is the ONE authority for run_id/epoch/deadline.
## The port never creates a run; it only reports the durable record the lifecycle
## wrote, so A3 can never mint a second run identity or extend a deadline.
func run_context() -> Dictionary:
	var profile := read_profile(_document())
	var raw: Variant = profile.get("run", {})
	if not raw is Dictionary or (raw as Dictionary).is_empty():
		return {}
	var run: Dictionary = raw
	var started := int(run.get("run_started_at_unix", 0))
	var expires := int(run.get("run_expires_at_unix", 0))
	if started <= 0 or expires <= started or String(run.get("run_id", "")).is_empty():
		return {}
	if String(run.get("state", "active")) != "active":
		# An ended run is never offered to A3 as a place to earn: the status is
		# truthful and every meta plan fails closed on it.
		return {
			"contract": RUN_CONTEXT_CONTRACT,
			"run_id": String(run["run_id"]),
			"run_epoch": int(run.get("run_epoch", 1)),
			"run_started_at_unix": started,
			"now_unix": _now(),
			"expires_at_unix": expires,
			"status": String(run.get("state", "expired")),
		}
	var now := _now()
	return {
		"contract": RUN_CONTEXT_CONTRACT,
		"run_id": String(run["run_id"]),
		"run_epoch": int(run.get("run_epoch", 1)),
		"run_started_at_unix": started,
		"now_unix": now,
		"expires_at_unix": expires,
		"status": "expired" if now >= expires else "active",
	}


# ---------------------------------------------------------------------------
# physical authority (identity stays with A1/A8; A0 only reports live custody)
# ---------------------------------------------------------------------------
func endpoint_authority(endpoint_id: String) -> Dictionary:
	var entry: Variant = _policy_endpoints.get(endpoint_id, {})
	if not entry is Dictionary or (entry as Dictionary).is_empty():
		return {}
	var run := run_context()
	if run.is_empty():
		return {}
	var status := String((entry as Dictionary).get("integration_status", ""))
	var authorized := status in AUTHORIZED_ENDPOINT_STATUS
	var poi_id := String(_endpoint_poi.get(endpoint_id, ""))
	var blocked := ""
	if poi_id.is_empty():
		blocked = "A1_A8_ENDPOINT_SITE_ABSENT:" + String((entry as Dictionary).get("region_id", ""))
	elif not authorized:
		blocked = "A1_A8_ENDPOINT_UNAUTHORIZED:" + status
	var world: Dictionary = _document().get("world_slice", {})
	var poi: Variant = (world.get("pois", {}) as Dictionary).get(poi_id, {})
	var discovered := poi is Dictionary and bool((poi as Dictionary).get("discovered", false))
	var hero := Vector2i(-1, -1)
	if _hero_cell.is_valid():
		hero = _hero_cell.call()
	var stands: Array = (entry as Dictionary).get("stand_cells", [])
	var on_stand := false
	for raw_cell: Variant in stands:
		if not raw_cell is Array or (raw_cell as Array).size() != 2:
			continue
		if hero == Vector2i(int(raw_cell[0]), int(raw_cell[1])):
			on_stand = true
			break
	# `operational` is the one field A3 gates the whole deposit on, so it is true
	# only when the site exists, the owner authorized it, the player has found it
	# and the player is physically standing on the authored cell.
	var operational := blocked.is_empty() and discovered and on_stand
	return {
		"contract": ENDPOINT_AUTH_CONTRACT,
		"endpoint_id": endpoint_id,
		"kind": String((entry as Dictionary).get("kind", "")),
		"run_id": String(run["run_id"]),
		"endpoint_revision": String((entry as Dictionary).get("endpoint_revision", "")),
		"integration_status": status,
		"authorized": authorized,
		"visited": discovered,
		"operational": operational,
		"blocked_reason": blocked,
		"hero_cell": [hero.x, hero.y] if on_stand else [],
	}


func source_authority(source_id: String, source_instance_id: String) -> Dictionary:
	if source_instance_id.is_empty():
		return {}
	var binding: Dictionary = {}
	for raw: Variant in _bindings.get("bindings", []):
		if raw is Dictionary and String((raw as Dictionary).get("instance_id", "")) == source_instance_id:
			binding = raw
			break
	if binding.is_empty():
		return {}
	var run := run_context()
	if run.is_empty():
		return {}
	var world: Dictionary = _document().get("world_slice", {})
	var poi: Variant = (world.get("pois", {}) as Dictionary).get(str(binding.get("poi_id", "")), {})
	if not poi is Dictionary:
		return {}
	var claims := int((poi as Dictionary).get(str(binding.get("claim_index_field", "")), 0))
	var ready_at := int((poi as Dictionary).get(str(binding.get("next_ready_field", "")), 0))
	var active := int((world.get("clock", {}) as Dictionary).get("active_seconds", 0))
	return {
		"contract": SOURCE_AUTH_CONTRACT,
		"source_id": source_id,
		"source_instance_id": source_instance_id,
		"run_id": String(run["run_id"]),
		"generation": claims + 1,
		"opened": claims > 0,
		"depleted": false,
		"phase": "ready" if active >= ready_at else "cooling",
	}
