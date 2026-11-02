extends RefCounted
## SURV-030A isolated adapter. NOT an autoload and NOT a second save authority.
## A0 mounts this with the real SaveService, a placed-station resolver, an
## authoritative active-session time host, and (later) an A4 skill attestor.
## Unique items use one SaveService key_item stack token per instance. Attributes
## and production escrow live in the SAME candidate document, never a side file.
##
## Safety contracts (see docs/survival/economy/):
## - soH unique tokens: exactly one qty-1 key_item bag stack XOR escrow/terminal.
## - Time: only an injected A0 host may grant active-session ticks; UI-supplied
##   tick counts are rejected. V5 station/source advance remains ACTIVE-only.
##   V6 adds a separate opt-in read-only planner for already-paid prepared jobs;
##   A0 alone commits its proposals through the existing SaveService boundary.
## - Cast: only an injected A4 attestor bound to a verified catalog skill binding
##   may authorize charge debit at the gameplay commit boundary.

const WorldSources = preload("res://game/survival/economy/world_source_adapter.gd")
const OfflineOperations = preload("res://game/survival/economy/offline_operation_planner.gd")
const MetaEconomy = preload("res://game/survival/economy/meta_economy_planner.gd")
const ROOT := "survival_economy"
const WORLD_ROOT := "world_slice"
const SCHEMA := 2
const CATALOG_ROOT := "res://data/survival/"
const MAX_EVENT_LENGTH := 96
const TOKEN_PREFIX := "soh_i_"
const TIME_CONTRACT := "soh.economy.active_tick.v1"
const SKILL_CONTRACT := "soh.economy.skill_attestation.v1"
const TOOL_USE_CONTRACT := "soh.economy.tool_use.v1"
const TOOL_USE_RESOURCE_KINDS := {
	"stone_pick": ["stone_outcrop", "iron_vein"],
	"iron_pick": ["iron_vein", "scrap_pile"],
	"salvage_hammer": ["scrap_pile"]
}
const MAX_TICK_QUANTUM := 600
const MAX_TIME_STATIONS := 256
const UNRESOLVED_JOB_STATES := ["queued", "running", "paused", "ready", "cancelled"]

var _save: Node
var _station_resolver: Callable
var _time_host: Callable
var _skill_attestor: Callable
var _world_host: Callable
var _offline: RefCounted
var _meta_economy: RefCounted
var _meta_profile_port: RefCounted
var catalog: Dictionary = {}
var last_error := ""

func configure(save_service: Node, station_resolver: Callable = Callable()) -> bool:
	if save_service == null or not save_service.has_method(&"transact_once") \
			or not save_service.has_method(&"add_items_to_candidate") \
			or not save_service.has_method(&"remove_items_from_candidate") \
			or not save_service.has_method(&"get_inventory_stacks"):
		last_error = "incompatible_save_service"
		return false
	_save = save_service
	_station_resolver = station_resolver
	_time_host = Callable()
	_skill_attestor = Callable()
	_world_host = Callable()
	_offline = OfflineOperations.new()
	return load_catalog()

## A0 composition root only. The host must be a pure read of authoritative
## active-session state; it must never be reachable from untrusted UI input.
func configure_time_host(host: Callable) -> bool:
	_time_host = host if host.is_valid() else Callable()
	return true

## A0/A4 composition root only. A3 cannot authenticate a Callable by itself;
## production safety depends on this producer being trusted and source-verified.
func configure_skill_attestor(attestor: Callable) -> bool:
	_skill_attestor = attestor if attestor.is_valid() else Callable()
	return true

## A0 composition root only. The world host is a pure read of authoritative
## active-session time, discovery and hero stand cell. It is not a UI flag and
## not a second clock; A0 derives it from the same pausable gameplay clock that
## drives EconomySession. Caller-supplied active seconds are never trusted.
func configure_world_host(host: Callable) -> bool:
	_world_host = host if host.is_valid() else Callable()
	return true

## A0 composition root only. Opt-in D055/D060 real-UTC projection for prepared
## operations. Absent host => V5 behavior unchanged and offline planning fails closed.
func configure_offline_time_host(host: Callable) -> bool:
	if _offline == null:
		_offline = OfflineOperations.new()
	_offline.set_host(host)
	return true

## V6 opt-in: record that an already-paid job may use future real elapsed time.
## This is a player preparation action through the existing SaveService boundary;
## it does not advance the job, create a queue, or touch ACTIVE source cooldowns.
func arm_offline_operation(job_id: String, event_id: String) -> Dictionary:
	if _offline == null:
		return _fail("offline_planner_unavailable")
	return _transact("arm_offline", event_id, {"job": job_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			return _offline.arm(candidate, state, job_id, result))

## Read-only D060 proposal. A0 must commit it via SaveService.transact_once using
## proposal_id as the idempotency key and apply_offline_operation_plan() inside the
## mutator. Calling this function never changes inventory, jobs, cooldowns or disk.
func plan_offline_operations(request: Variant) -> Dictionary:
	if _offline == null:
		return _fail("offline_planner_unavailable")
	return _offline.plan(request)

## Pure candidate transform for A0's existing single SaveService transaction.
## It re-plans from the candidate and rejects stale/tampered proposals.
func apply_offline_operation_plan(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _offline == null:
		return _fail("offline_planner_unavailable")
	return _offline.apply_to_candidate(candidate, proposal, request)

## D059 forecast/interface only; A0 owns shelter, satiety, HP, death and debits.
func forecast_offline_food(request: Variant, needs: Variant) -> Dictionary:
	if _offline == null or _save == null:
		return _fail("offline_planner_unavailable")
	var candidate: Dictionary = _save.call(&"get_snapshot")
	return _offline.forecast_food(candidate, request, needs)

func offline_operation_state() -> Dictionary:
	return document().get("offline", OfflineOperations.empty_state())

## V7 A0 composition root only. The profile port must read/write the SAME
## SaveService candidate inside one A0 transaction. Absent port => fail closed.
func configure_meta_profile_port(port: RefCounted) -> bool:
	_meta_profile_port = port
	if _meta_economy == null:
		_meta_economy = MetaEconomy.new()
		if not _meta_economy.configure(self, catalog.get("meta_policy", {}), port):
			last_error = "invalid_meta_policy"
			return false
	else:
		_meta_economy.set_profile_port(port)
	return true

func meta_economy_state() -> Dictionary:
	return document().get("meta", MetaEconomy.empty_state())

func plan_meta_source_claim(request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.plan_source_claim(request)

func apply_meta_source_claim(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.apply_source_claim(candidate, proposal, request)

func plan_meta_deposit(request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.plan_deposit(request)

func apply_meta_deposit(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.apply_deposit(candidate, proposal, request)

func plan_meta_purchase(request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.plan_purchase(request)

func apply_meta_purchase(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.apply_purchase(candidate, proposal, request)

func plan_meta_refund(request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.plan_refund(request)

func apply_meta_refund(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.apply_refund(candidate, proposal, request)

func plan_meta_recycle(request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.plan_recycle(request)

func apply_meta_recycle(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if _meta_economy == null:
		return _fail("A0_PROFILE_BOUNDARY_ABSENT")
	return _meta_economy.apply_recycle(candidate, proposal, request)

func project_meta_economy() -> Dictionary:
	if _meta_economy == null or _save == null:
		return {"contract": "soh.economy.meta_projection.v1", "read_only": true, "status": "A0_PROFILE_BOUNDARY_ABSENT"}
	var candidate: Dictionary = _save.call(&"get_snapshot")
	return _meta_economy.project(candidate)

## Internal candidate re-normalization after a pure meta transform.
func _candidate_reset_state(candidate: Dictionary) -> void:
	candidate[ROOT] = _state(candidate)

## V5 A0 handoff callable, now implemented. READ-ONLY tool-use plan. A0 must
## apply it inside the SAME SaveService transaction as the harvest hit, node
## depletion and inventory grant. A3 does not authorize a harvest by itself and
## never multiplies yield. active_seconds is an A0 echo for receipt binding, not
## an A3-verified clock; offline/wall-clock condition repair is forbidden.
func plan_tool_use(request: Variant) -> Dictionary:
	if _save == null:
		return _fail("not_configured")
	var candidate: Dictionary = _save.call(&"get_snapshot")
	return plan_tool_use_candidate(candidate, request)

func plan_tool_use_candidate(candidate: Dictionary, request: Variant) -> Dictionary:
	if not request is Dictionary:
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	var req: Dictionary = request
	var expected := ["contract", "node_id", "resource_kind", "tool_instance_id", "expected_tool_revision", "world_revision", "active_seconds"]
	if req.size() != expected.size():
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	for field in expected:
		if not req.has(field):
			return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	if str(req.contract) != TOOL_USE_CONTRACT:
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	for field in ["node_id", "resource_kind", "tool_instance_id", "world_revision"]:
		if not req[field] is String or str(req[field]).is_empty() or str(req[field]).length() > 128:
			return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	if not req.expected_tool_revision is int or int(req.expected_tool_revision) < 0 or int(req.expected_tool_revision) > 1000000:
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	if not req.active_seconds is int or int(req.active_seconds) < 0 or int(req.active_seconds) > 1000000000:
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false}
	var state_error := _candidate_state_error(candidate)
	if not state_error.is_empty():
		return {"ok": false, "reason": "INVALID_TOOL_USE_REQUEST", "allowed": false, "detail": state_error}
	var state := _state(candidate)
	var tool_id := str(req.tool_instance_id)
	var token_error := _token_error(candidate, state, tool_id)
	if not token_error.is_empty():
		return {"ok": false, "reason": "TOOL_NOT_OWNED", "allowed": false, "detail": token_error}
	var record: Dictionary = state["instances"][tool_id]
	var tool_item := str(record.get("item_id", ""))
	if not TOOL_USE_RESOURCE_KINDS.has(tool_item):
		return {"ok": false, "reason": "TOOL_KIND_MISMATCH", "allowed": false, "tool_item_id": tool_item}
	if int(record.get("revision", -1)) != int(req.expected_tool_revision):
		return {"ok": false, "reason": "TOOL_REVISION_STALE", "allowed": false, "tool_item_id": tool_item}
	if int(record.get("condition", 0)) <= 0:
		return {"ok": false, "reason": "TOOL_BROKEN", "allowed": false, "tool_item_id": tool_item}
	var kind := str(req.resource_kind)
	var known_kinds := ["stone_outcrop", "iron_vein", "scrap_pile"]
	if not kind in known_kinds:
		return {"ok": false, "reason": "NODE_KIND_UNKNOWN", "allowed": false, "tool_item_id": tool_item}
	if not (TOOL_USE_RESOURCE_KINDS[tool_item] as Array).has(kind):
		return {"ok": false, "reason": "TOOL_KIND_MISMATCH", "allowed": false, "tool_item_id": tool_item}
	var condition_cost := 1
	var plan_id := JSON.stringify({"request": req, "tool_item_id": tool_item, "condition_before": int(record.condition),
		"condition_cost": condition_cost, "next_tool_revision": int(req.expected_tool_revision) + 1}, "", true, true).sha256_text()
	return {"ok": true, "reason": "", "contract": TOOL_USE_CONTRACT, "plan_id": plan_id,
		"request": req.duplicate(true),
		"tool_item_id": tool_item, "allowed": true, "condition_cost": condition_cost,
		"next_tool_revision": int(req.expected_tool_revision) + 1, "yield_multiplier": 1,
		"active_seconds_authority": "A0_REQUEST_ECHO_NOT_VERIFIED_BY_A3",
		"receipt_metadata": {"a3_tool_use": true, "tool_instance_id": tool_id, "node_id": str(req.node_id), "resource_kind": kind}}

## Pure candidate transform for A0's atomic harvest transaction. It re-plans from
## the candidate and ignores caller-supplied condition/revision deltas. A0 must
## reject the whole harvest if the bag cannot receive the node yield; this helper
## does not grant inventory and must not be committed separately from the harvest.
func apply_tool_use_plan(candidate: Dictionary, plan: Dictionary) -> Dictionary:
	if not plan is Dictionary or str(plan.get("contract", "")) != TOOL_USE_CONTRACT or not plan.get("request") is Dictionary:
		return _fail("invalid_tool_use_plan")
	var fresh := plan_tool_use_candidate(candidate, plan.request)
	if not bool(fresh.get("ok", false)) or not bool(fresh.get("allowed", false)):
		return fresh
	if str(plan.get("plan_id", "")) != str(fresh.plan_id):
		return _fail("stale_tool_use_plan")
	var state := _state(candidate)
	var tool_id := str((plan.request as Dictionary).tool_instance_id)
	var record: Dictionary = state["instances"][tool_id]
	record["condition"] = maxi(0, int(record.condition) - int(fresh.condition_cost))
	record["revision"] = int(fresh.next_tool_revision)
	candidate[ROOT] = state
	return _ok({"tool_instance_id": tool_id, "condition": int(record.condition), "revision": int(record.revision),
		"yield_multiplier": 1, "receipt_metadata": fresh.receipt_metadata})

func load_catalog() -> bool:
	catalog = {}
	for pair in [["items","items/items.json"],["recipes","recipes/recipes.json"],
			["stations","recipes/stations.json"],["technologies","recipes/research.json"],
			["sources","items/sources.json"]]:
		var file := FileAccess.open(CATALOG_ROOT + pair[1], FileAccess.READ)
		if file == null:
			last_error = "missing_catalog:" + pair[1]
			return false
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		file.close()
		if not parsed is Dictionary or not parsed.get(pair[0]) is Dictionary:
			last_error = "invalid_catalog:" + pair[1]
			return false
		catalog[pair[0]] = parsed[pair[0]]
	var world_file := FileAccess.open(CATALOG_ROOT + "items/world_source_bindings.v3.json", FileAccess.READ)
	if world_file == null:
		last_error = "missing_catalog:items/world_source_bindings.v3.json"
		return false
	var world_parsed: Variant = JSON.parse_string(world_file.get_as_text())
	world_file.close()
	if not world_parsed is Dictionary:
		last_error = "invalid_catalog:items/world_source_bindings.v3.json"
		return false
	var binding_errors := WorldSources.validate_catalog(world_parsed, catalog.get("items", {}), catalog.get("sources", {}))
	if not binding_errors.is_empty():
		last_error = "invalid_world_bindings:" + ",".join(binding_errors)
		return false
	catalog["world_bindings"] = world_parsed
	var offline_file := FileAccess.open(CATALOG_ROOT + "recipes/offline_operations.v1.json", FileAccess.READ)
	if offline_file == null:
		last_error = "missing_catalog:recipes/offline_operations.v1.json"
		return false
	var offline_parsed: Variant = JSON.parse_string(offline_file.get_as_text())
	offline_file.close()
	if not offline_parsed is Dictionary or not (offline_parsed as Dictionary).get("policy") is Dictionary:
		last_error = "invalid_catalog:recipes/offline_operations.v1.json"
		return false
	catalog["offline_policy"] = (offline_parsed as Dictionary)["policy"]
	if _offline == null:
		_offline = OfflineOperations.new()
	if not _offline.configure(self, catalog["offline_policy"]):
		last_error = "invalid_offline_policy"
		return false
	var meta_file := FileAccess.open(CATALOG_ROOT + "recipes/meta_economy.v1.json", FileAccess.READ)
	if meta_file == null:
		last_error = "missing_catalog:recipes/meta_economy.v1.json"
		return false
	var meta_parsed: Variant = JSON.parse_string(meta_file.get_as_text())
	meta_file.close()
	if not meta_parsed is Dictionary or not (meta_parsed as Dictionary).get("policy") is Dictionary:
		last_error = "invalid_catalog:recipes/meta_economy.v1.json"
		return false
	catalog["meta_policy"] = (meta_parsed as Dictionary)["policy"]
	_meta_economy = MetaEconomy.new()
	if not _meta_economy.configure(self, catalog["meta_policy"], _meta_profile_port):
		last_error = "invalid_meta_policy"
		return false
	last_error = ""
	return true

func document() -> Dictionary:
	if _save == null:
		return {}
	var raw: Variant = _save.call(&"get_snapshot")
	if not _candidate_state_error(raw).is_empty():
		return {}
	return _state(raw)

func _candidate_state_error(candidate: Dictionary) -> String:
	if candidate.has(WORLD_ROOT):
		var world_error := WorldSources.state_error(candidate[WORLD_ROOT], catalog.get("world_bindings", {}))
		if not world_error.is_empty():
			return world_error
	if not candidate.has(ROOT):
		return ""
	return _state_error(candidate[ROOT])

func _empty_time() -> Dictionary:
	return {"latest_session_index": -1, "session_id": "", "sequence": -1, "stations": {}}

func _state(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get(ROOT, {})
	var state: Dictionary = raw if raw is Dictionary else {}
	var result := {
		"schema": SCHEMA,
		"instances": state.get("instances", {}),
		"jobs": state.get("jobs", {}),
		"technologies": state.get("technologies", {}),
		"commands": state.get("commands", {}),
		"counter": int(state.get("counter", 0)),
		"time": state.get("time", _empty_time()),
		"offline": state.get("offline", OfflineOperations.empty_state()),
		"meta": state.get("meta", MetaEconomy.empty_state()),
	}
	return result

## Strict structural validation. Invalid legacy/foreign state fails closed;
## it is never silently normalized into spendable ownership.
func _is_uint(value: Variant, maximum: int) -> bool:
	if not (value is int) and not (value is float):
		return false
	var number := float(value)
	if number < 0.0 or number > float(maximum):
		return false
	return number == floor(number)

func _state_error(raw: Variant) -> String:
	if not raw is Dictionary:
		return "invalid_economy_state"
	var state: Dictionary = raw
	var schema_value: Variant = state.get("schema", null)
	if not _is_uint(schema_value, 1000000):
		return "unsupported_economy_schema"
	var schema := int(schema_value)
	if schema != 1 and schema != SCHEMA:
		return "unsupported_economy_schema"
	for field in ["instances", "jobs", "technologies", "commands"]:
		if not state.has(field) or not state[field] is Dictionary:
			return "invalid_economy_field:" + field
	if not state.has("counter") or not _is_uint(state["counter"], 1000000):
		return "invalid_counter"
	if schema == SCHEMA and (not state.has("time") or not state["time"] is Dictionary):
		return "invalid_time_state"
	for id: Variant in (state.get("instances", {}) as Dictionary).keys():
		var record: Variant = state["instances"][id]
		if not record is Dictionary:
			return "invalid_instance_record"
		var r: Dictionary = record
		if str(r.get("instance_id", "")) != str(id):
			return "instance_id_mismatch"
		if not str(id).begins_with(TOKEN_PREFIX):
			return "invalid_instance_token_id"
		for field in ["item_id", "location", "origin"]:
			if not r.has(field) or not r[field] is String:
				return "invalid_instance_field:" + field
		for field in ["condition", "max_condition", "uses", "max_uses"]:
			if not r.has(field) or not _is_uint(r[field], 100):
				return "invalid_instance_number:" + field
		if not r.has("revision") or not _is_uint(r["revision"], 1000000):
			return "invalid_instance_number:revision"
		if int(r.get("max_condition", 0)) <= 0 or int(r.get("condition", 0)) > int(r.get("max_condition", 0)):
			return "invalid_instance_condition"
		if int(r.get("uses", 0)) > int(r.get("max_uses", 0)):
			return "invalid_instance_uses"
	for id: Variant in (state.get("jobs", {}) as Dictionary).keys():
		var job: Variant = state["jobs"][id]
		if not job is Dictionary:
			return "invalid_job_record"
		var j: Dictionary = job
		if str(j.get("job_id", "")) != str(id):
			return "job_id_mismatch"
		for field in ["reserved", "reserved_instances", "outputs", "output_instances", "reserved_fuel"]:
			if not j.has(field) or not j[field] is Dictionary:
				return "invalid_job_field:" + field
		for field in ["kind", "target", "station_id", "station_kind", "status"]:
			if not j.has(field) or not j[field] is String:
				return "invalid_job_field:" + field
		if not str(j.get("status", "")) in ["queued","running","paused","ready","collected","cancelled"]:
			return "invalid_job_status"
		for field in ["elapsed", "duration", "tier"]:
			if not j.has(field) or not _is_uint(j[field], 1000000):
				return "invalid_job_number:" + field
		for field in ["reserved", "reserved_fuel", "outputs"]:
			for qid: Variant in (j[field] as Dictionary).keys():
				if str(qid).begins_with(TOKEN_PREFIX) or not _is_uint(j[field][qid], 1000000):
					return "invalid_job_quantity:" + field
				if int(j[field][qid]) <= 0:
					return "invalid_job_quantity:" + field
		for field in ["reserved_instances", "output_instances"]:
			for qid: Variant in (j[field] as Dictionary).keys():
				if not str(qid).begins_with(TOKEN_PREFIX) or not j[field][qid] is Dictionary:
					return "invalid_job_instance:" + field
	if schema == SCHEMA:
		var time_error := _time_state_error(state.get("time", {}))
		if not time_error.is_empty():
			return time_error
	if state.has("offline"):
		var offline_error := OfflineOperations.state_error(state["offline"])
		if not offline_error.is_empty():
			return offline_error
	if state.has("meta"):
		var meta_error := MetaEconomy.state_error(state["meta"])
		if not meta_error.is_empty():
			return meta_error
	return ""

func _time_state_error(raw: Variant) -> String:
	if not raw is Dictionary:
		return "invalid_time_state"
	var t: Dictionary = raw
	if not t.has("latest_session_index") or not t.has("sequence") or not t.has("session_id") or not t.has("stations"):
		return "invalid_time_state"
	if not t["session_id"] is String or not t["stations"] is Dictionary:
		return "invalid_time_state"
	var lsi: Variant = t.get("latest_session_index", null)
	var seq: Variant = t.get("sequence", null)
	var initial := (lsi is int or lsi is float) and (seq is int or seq is float) \
		and int(lsi) == -1 and int(seq) == -1 \
		and str(t.get("session_id", "x")).is_empty() and (t.get("stations", {}) as Dictionary).is_empty()
	if not initial:
		for field in ["latest_session_index", "sequence"]:
			if not _is_uint(t[field], 1000000000000):
				return "invalid_time_number:" + field
		if str(t["session_id"]).is_empty():
			return "invalid_time_session"
	for sid: Variant in (t.get("stations", {}) as Dictionary).keys():
		var b: Variant = t["stations"][sid]
		if not b is Dictionary:
			return "invalid_time_station"
		if not b.has("active_ticks") or not _is_uint(b["active_ticks"], 1000000000000):
			return "invalid_time_station_ticks"
		if not b.has("station_revision") or not b["station_revision"] is String:
			return "invalid_time_station"
	return ""

func item(item_id: String) -> Dictionary:
	return catalog.get("items", {}).get(item_id, {})

func recipe(recipe_id: String) -> Dictionary:
	return catalog.get("recipes", {}).get(recipe_id, {})

func known(recipe_id: String) -> bool:
	var r := recipe(recipe_id)
	if r.is_empty():
		return false
	if str(r.get("knowledge", "")) == "starter":
		return true
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var survival: Dictionary = snapshot.get("survival", {})
	var knowledge: Dictionary = survival.get("knowledge", {})
	return (knowledge.get("recipes", {}) as Dictionary).has(recipe_id)

func knows_technology(technology_id: String) -> bool:
	return document().get("technologies", {}).has(technology_id)

func instance(instance_id: String) -> Dictionary:
	return document().get("instances", {}).get(instance_id, {}).duplicate(true)

func jobs() -> Dictionary:
	return document().get("jobs", {}).duplicate(true)

# ---------------------------------------------------------------------------
# A1 world sources / capabilities. One SaveService candidate, no side journal.
# ---------------------------------------------------------------------------
func world_bindings() -> Dictionary:
	return catalog.get("world_bindings", {})

func world_document() -> Dictionary:
	if _save == null:
		return {}
	var candidate: Dictionary = _save.call(&"get_snapshot")
	if not _candidate_state_error(candidate).is_empty():
		return {}
	return _world_read(candidate)

func _world_read(candidate: Dictionary) -> Dictionary:
	if candidate.has(WORLD_ROOT):
		return (candidate[WORLD_ROOT] as Dictionary).duplicate(true)
	return WorldSources.empty_state(world_bindings())

func _world_mut(candidate: Dictionary) -> Dictionary:
	if not candidate.has(WORLD_ROOT):
		candidate[WORLD_ROOT] = WorldSources.empty_state(world_bindings())
	return candidate[WORLD_ROOT]

func has_capability(capability_id: String) -> bool:
	return (world_document().get("capabilities", []) as Array).has(capability_id)

## Read-only A6/A0 projection. Never exposes the mutator or host receipt.
## Undiscovered POIs expose no private action/reward/prerequisite metadata.
func world_projection(poi_id: String) -> Dictionary:
	var world := world_document()
	var poi: Dictionary = (world.get("pois", {}) as Dictionary).get(poi_id, {})
	if poi.is_empty():
		return {}
	if not bool(poi.get("discovered", false)):
		return {"poi_id": poi_id, "visibility": "HIDDEN", "sources": [], "actions": []}
	var clock: Dictionary = world.get("clock", {})
	var active := int(clock.get("active_seconds", 0))
	var sources: Array[Dictionary] = []
	for raw: Variant in world_bindings().get("bindings", []):
		var b: Dictionary = raw
		if str(b.get("poi_id", "")) != poi_id:
			continue
		var next_ready := int(poi.get(str(b.get("next_ready_field", "")), 0))
		var claim_count := int(poi.get(str(b.get("claim_index_field", "")), 0))
		var max_claims := int(b.get("max_claims", 0))
		var exhausted := max_claims > 0 and claim_count >= max_claims
		var entry := WorldSources.source_identity(b)
		entry.merge({
			"binding_id": str(b.get("binding_id", "")),
			"identity": str(b.get("identity", "")),
			"action_id": str(b.get("action_id", "")),
			"claim_count": claim_count,
			"max_claims": max_claims,
			"exhausted": exhausted,
			"ready": not exhausted and active >= next_ready,
			"remaining_active_seconds": 0 if exhausted else maxi(0, next_ready - active),
			"cooldown_active_seconds": int(b.get("cooldown_active_seconds", 0)),
			"requires_capabilities": (b.get("requires_capabilities", []) as Array).duplicate(true),
			"rewards": (b.get("rewards", []) as Array).duplicate(true),
		}, true)
		sources.append(entry)
	var actions: Array[Dictionary] = []
	for raw: Variant in world_bindings().get("world_actions", []):
		var a: Dictionary = raw
		if str(a.get("poi_id", "")) != poi_id:
			continue
		var flag := str(a.get("one_time_flag", ""))
		var done := not flag.is_empty() and bool(poi.get(flag, false))
		actions.append({"action_id": str(a.get("action_id", "")),
			"reward_right_id": str(a.get("reward_right_id", "")),
			"one_time": bool(a.get("one_time", false)), "already_applied": done,
			"requires_capabilities": (a.get("requires_capabilities", []) as Array).duplicate(true),
			"consumes_items": (a.get("consumes_items", []) as Array).duplicate(true),
			"reward_items": (a.get("reward_items", []) as Array).duplicate(true),
			"grants_capabilities": (a.get("grants_capabilities", []) as Array).duplicate(true)})
	return {"poi_id": poi_id, "visibility": "DISCOVERED", "state": poi.duplicate(true),
		"capabilities": (world.get("capabilities", []) as Array).duplicate(true),
		"active_seconds": active, "sources": sources, "actions": actions}

func _world_host_receipt(poi_id: String) -> Dictionary:
	if not _world_host.is_valid():
		return {}
	var value: Variant = _world_host.call(poi_id)
	if not WorldSources.host_receipt_error(value, poi_id).is_empty():
		return {}
	return value

## Monotonic cumulative ACTIVE seconds. New sessions baseline the host instead
## of crediting offline time; remaining cooldowns survive because next_ready is
## stored against the cumulative counter, not the per-session host counter.
func _advance_world_clock(world: Dictionary, host: Dictionary) -> String:
	var clock: Dictionary = world.get("clock", {})
	var index := int(host.session_index)
	var host_seconds := int(host.active_seconds)
	var latest := int(clock.get("latest_session_index", -1))
	if latest == -1:
		clock = {"latest_session_index": index, "session_id": str(host.session_id), "sequence": int(host.sequence),
			"active_seconds": 0, "host_active_seconds": host_seconds}
	elif index < latest:
		return "stale_world_session"
	elif index == latest:
		if str(host.session_id) != str(clock.get("session_id", "")):
			return "world_session_conflict"
		if int(host.sequence) < int(clock.get("sequence", -1)):
			return "stale_world_sequence"
		var delta := host_seconds - int(clock.get("host_active_seconds", 0))
		if delta < 0:
			return "world_clock_regressed"
		if delta > WorldSources.MAX_HOST_QUANTUM:
			return "world_time_quantum_exceeded"
		clock["active_seconds"] = int(clock.get("active_seconds", 0)) + delta
		clock["host_active_seconds"] = host_seconds
		clock["sequence"] = int(host.sequence)
	else:
		clock = {"latest_session_index": index, "session_id": str(host.session_id), "sequence": int(host.sequence),
			"active_seconds": int(clock.get("active_seconds", 0)), "host_active_seconds": host_seconds}
	world["clock"] = clock
	return ""

func _candidate_bag_totals(candidate: Dictionary) -> Dictionary:
	var totals := {}
	for key: Variant in _bag_stacks(candidate).keys():
		var record: Variant = _bag_stacks(candidate)[key]
		if not record is Dictionary:
			continue
		var id := _stack_base_id(str(key), record)
		if id.begins_with(TOKEN_PREFIX):
			continue
		totals[id] = int(totals.get(id, 0)) + int(record.get("quantity", 0))
	return totals

func _add_source_reward(candidate: Dictionary, reward: Dictionary, context: Dictionary) -> bool:
	var item_id := str(reward.get("item_id", ""))
	var definition := item(item_id)
	if definition.is_empty() or str(definition.get("storage", "")) != "stack":
		return false
	var kind := str(definition.get("kind", "material"))
	if kind == "station_kit":
		kind = "material"
	var metadata := {"source": "survival_economy", "display_name": str(definition.get("label", item_id)),
		"source_id": str(reward.get("source_id", "")), "provenance": (reward.get("provenance", []) as Array).duplicate(true)}
	metadata.merge(context, true)
	return bool(_save.call(&"add_items_to_candidate", candidate, item_id, kind, int(reward.get("quantity", 0)), metadata))

func _world_plan(world: Dictionary, request: Dictionary) -> Dictionary:
	var poi_id := str(request.get("poi_id", ""))
	var action_id := str(request.get("action_id", ""))
	var instance_id := str(request.get("instance_id", ""))
	var poi: Dictionary = (world.get("pois", {}) as Dictionary).get(poi_id, {})
	if poi.is_empty():
		return {"reason": "unknown_world_poi"}
	if not instance_id.is_empty():
		var binding := WorldSources.binding_for(world_bindings(), poi_id, action_id, instance_id)
		if binding.is_empty():
			return {"reason": "unknown_source_instance"}
		var generation := int(poi.get(str(binding.get("claim_index_field", "")), 0)) + 1
		return {"kind": "source", "binding": binding, "generation": generation,
			"key": WorldSources.transaction_key(str(binding.transaction_key_template), generation)}
	var action := WorldSources.action_for(world_bindings(), poi_id, action_id)
	if action.is_empty():
		return {"reason": "unknown_world_action"}
	return {"kind": "action", "action": action, "generation": 1, "key": str(action.transaction_key_template)}

## A0 calls this from the pausable world clock (or immediately before an
## interaction) so cooldowns accrue only while gameplay is active.
func advance_world_time(poi_id: String, event_id: String) -> Dictionary:
	if not (_world_read(_save.call(&"get_snapshot") if _save != null else {}).get("pois", {}) as Dictionary).has(poi_id):
		return _fail("unknown_world_poi")
	return _transact("world_time", event_id, {"poi_id": poi_id},
		func(candidate: Dictionary, _state: Dictionary, result: Dictionary) -> bool:
			var host := _world_host_receipt(poi_id)
			if host.is_empty():
				result["reason"] = "world_host_unavailable"; return false
			var world := _world_mut(candidate)
			var clock_error := _advance_world_clock(world, host)
			if not clock_error.is_empty():
				result["reason"] = clock_error; return false
			result["active_seconds"] = int(world["clock"].active_seconds)
			return true)

## Atomic A1 world action / source claim. request may contain ONLY poi_id,
## action_id and (for a physical source) instance_id. Costs, rewards, cooldown,
## generation, capability and receipt are derived from the pinned A3 binding and
## the authoritative host, never from the caller.
func world_action(request: Dictionary, event_id: String) -> Dictionary:
	for key: Variant in request.keys():
		if not str(key) in ["poi_id", "action_id", "instance_id"]:
			return _fail("invalid_world_request_field:" + str(key))
	var poi_id := str(request.get("poi_id", ""))
	var action_id := str(request.get("action_id", ""))
	if poi_id.is_empty() or action_id.is_empty():
		return _fail("invalid_world_request")
	# The signed payload is the REQUEST ONLY. The canonical A1 transaction key
	# is generation-derived and is written into mutable receipt metadata inside
	# the mutator. If it were signed here, replaying the same event_id after the
	# claim generation advances would hash differently and become a false
	# event_id_conflict instead of ALREADY_APPLIED.
	var payload := {"request": request.duplicate(true), "receipt_metadata": {
		"poi_id": poi_id, "action_id": action_id,
		"instance_id": str(request.get("instance_id", ""))}}
	var event_key := _event_key("world_action", event_id)
	var signature := JSON.stringify(payload).sha256_text()
	if _save != null and bool(_save.call(&"is_transaction_applied", event_key)):
		if _receipt_signature(event_key, signature):
			var snapshot: Dictionary = _save.call(&"get_snapshot")
			var receipt: Dictionary = (snapshot.get("applied_transactions", {}) as Dictionary).get(event_key, {})
			var meta: Dictionary = receipt.get("metadata", {})
			return _ok({"duplicate": true, "result": "ALREADY_APPLIED",
				"transaction_key": str(meta.get("a1_transaction_key", ""))})
		return _fail("event_id_conflict")
	var snapshot: Dictionary = _save.call(&"get_snapshot") if _save != null else {}
	var preflight := _world_plan(_world_read(snapshot), request)
	if preflight.has("reason"):
		return _fail(str(preflight.reason))
	var canonical_key := str(preflight.key)
	var outcome := _transact("world_action", event_id, payload,
		func(candidate: Dictionary, _state: Dictionary, result: Dictionary) -> bool:
			var host := _world_host_receipt(poi_id)
			if host.is_empty():
				result["reason"] = "world_host_unavailable"; return false
			if not bool(host.discovered):
				result["reason"] = "NOT_DISCOVERED"; return false
			var world := _world_mut(candidate)
			var clock_error := _advance_world_clock(world, host)
			if not clock_error.is_empty():
				result["reason"] = clock_error; return false
			var plan := _world_plan(world, request)
			if plan.has("reason") or str(plan.key) != canonical_key:
				result["reason"] = str(plan.get("reason", "stale_world_generation")); return false
			var poi: Dictionary = world["pois"][poi_id]
			var active := int(world["clock"].active_seconds)
			var definition: Dictionary = plan.get("binding", plan.get("action", {}))
			var identity_error := WorldSources.host_identity_error(host, definition)
			if not identity_error.is_empty():
				result["reason"] = identity_error; return false
			if not WorldSources.cell_matches(host.hero_cell, definition.get("stand_cells", [])):
				result["reason"] = "OUT_OF_RANGE"; return false
			for cap: Variant in definition.get("requires_capabilities", []):
				if not (world["capabilities"] as Array).has(str(cap)):
					result["reason"] = "MISSING_CAPABILITY:" + str(cap); return false
			var receipts: Dictionary = poi.get("reward_receipts", {})
			if receipts.has(canonical_key):
				result["reason"] = "ALREADY_APPLIED"; result["already_applied"] = true; return false
			var rewards: Array = []
			var costs: Array = []
			var grants: Array = []
			var state_writes: Dictionary = {}
			if str(plan.kind) == "source":
				var max_claims := int(definition.get("max_claims", 0))
				var claimed := int(poi.get(str(definition.claim_index_field), 0))
				if max_claims > 0 and claimed >= max_claims:
					result["reason"] = "ALREADY_APPLIED"; result["already_applied"] = true; return false
				var next_ready := int(poi.get(str(definition.next_ready_field), 0))
				if active < next_ready:
					result["reason"] = "COOLDOWN"; result["remaining_active_seconds"] = next_ready - active; return false
				rewards = definition.get("rewards", [])
			else:
				if bool(definition.get("one_time", false)) and bool(poi.get(str(definition.get("one_time_flag", "")), false)):
					result["reason"] = "ALREADY_APPLIED"; result["already_applied"] = true; return false
				costs = definition.get("consumes_items", [])
				rewards = definition.get("reward_items", [])
				grants = definition.get("grants_capabilities", [])
				state_writes = definition.get("state_writes", {})
			var totals := _candidate_bag_totals(candidate)
			for cost: Variant in costs:
				var c: Dictionary = cost
				if int(totals.get(str(c.item_id), 0)) < int(c.quantity):
					result["reason"] = "MISSING_ITEM:" + str(c.item_id); return false
			var context := {"binding_id": str(definition.get("binding_id", definition.get("reward_right_id", ""))),
				"instance_id": str(request.get("instance_id", "")), "a1_transaction_key": canonical_key}
			var trial: Dictionary = candidate.duplicate(true)
			for reward: Variant in rewards:
				if not _add_source_reward(trial, reward, context):
					result["reason"] = "inventory_full"; return false
			for cost: Variant in costs:
				var c: Dictionary = cost
				if not _remove(candidate, str(c.item_id), int(c.quantity)):
					result["reason"] = "MISSING_ITEM:" + str(c.item_id); return false
			var granted_items := {}
			for reward: Variant in rewards:
				var r: Dictionary = reward
				if not _add_source_reward(candidate, r, context):
					result["reason"] = "inventory_full"; return false
				granted_items[str(r.item_id)] = int(granted_items.get(str(r.item_id), 0)) + int(r.quantity)
			var granted_caps: Array[String] = []
			for cap: Variant in grants:
				if not (world["capabilities"] as Array).has(str(cap)):
					world["capabilities"].append(str(cap))
					granted_caps.append(str(cap))
			for field: Variant in state_writes.keys():
				poi[str(field)] = state_writes[field]
			if str(plan.kind) == "source":
				poi[str(definition.claim_index_field)] = int(plan.generation)
				poi[str(definition.next_ready_field)] = active + int(definition.cooldown_active_seconds)
			poi["discovered"] = true
			poi["last_transaction_key"] = canonical_key
			receipts[canonical_key] = str(definition.get("reward_right_id", ""))
			poi["reward_receipts"] = receipts
			candidate[WORLD_ROOT] = world
			result["result"] = "SUCCESS"
			result["transaction_key"] = canonical_key
			result["consumed_items"] = WorldSources.cost_totals(costs)
			result["granted_items"] = granted_items
			result["granted_capabilities"] = granted_caps
			result["state_patch"] = state_writes.duplicate(true)
			result["active_seconds"] = active
			result["receipt_metadata"] = {"a1_transaction_key": str(plan.key),
				"reward_right_id": str(definition.get("reward_right_id", "")),
				"binding_id": str(definition.get("binding_id", ""))}
			return true)
	if bool(outcome.get("duplicate", false)) or str(outcome.get("reason", "")) == "ALREADY_APPLIED":
		return _ok({"duplicate": true, "result": "ALREADY_APPLIED", "transaction_key": canonical_key})
	return outcome

func _bag_stacks(candidate: Dictionary) -> Dictionary:
	var inventory: Dictionary = candidate.get("inventory", {})
	var stacks: Variant = inventory.get("item_stacks", {})
	return stacks if stacks is Dictionary else {}

func _storage_stacks(candidate: Dictionary) -> Dictionary:
	var storage: Dictionary = candidate.get("storage", {})
	var stacks: Variant = storage.get("item_stacks", {})
	return stacks if stacks is Dictionary else {}

func _stack_base_id(stack_key: String, record: Dictionary) -> String:
	return str(record.get("item_id", stack_key))

func _token_stack_keys(stacks: Dictionary, token_id: String) -> Array[String]:
	var keys: Array[String] = []
	for key: Variant in stacks.keys():
		var record: Variant = stacks[key]
		if record is Dictionary and _stack_base_id(str(key), record) == token_id:
			keys.append(str(key))
	keys.sort()
	return keys

## Exact physical-token validity. No silent repair, grant, or quantity merge.
func _token_error(candidate: Dictionary, state: Dictionary, instance_id: String) -> String:
	var instances: Dictionary = state.get("instances", {})
	if not instances.has(instance_id):
		return "orphan_token"
	var record: Dictionary = instances[instance_id]
	if str(record.get("instance_id", "")) != instance_id:
		return "instance_id_mismatch"
	var definition := item(str(record.get("item_id", "")))
	if definition.is_empty() or str(definition.get("storage", "")) != "instance":
		return "invalid_instance_item"
	if str(record.get("location", "")) != "bag":
		return "instance_not_in_bag"
	var stacks := _bag_stacks(candidate)
	var keys := _token_stack_keys(stacks, instance_id)
	if keys.size() != 1:
		return "token_missing_or_duplicated"
	if keys[0] != instance_id:
		return "token_stack_key_mismatch"
	var stack: Dictionary = stacks[instance_id]
	if int(stack.get("quantity", 0)) != 1:
		return "token_quantity_not_one"
	if str(stack.get("kind", "")) != "key_item":
		return "token_kind_not_key_item"
	return ""

func _has_token_anywhere(candidate: Dictionary, instance_id: String) -> bool:
	if not _token_stack_keys(_bag_stacks(candidate), instance_id).is_empty():
		return true
	return not _token_stack_keys(_storage_stacks(candidate), instance_id).is_empty()

## Global A3-owned invariant audit. Any detected violation blocks A3 mutations.
## This does NOT protect generic SaveService APIs; A0 must guard those.
func ownership_audit() -> Dictionary:
	if _save == null:
		return {"ok": false, "errors": ["not_configured"]}
	var candidate: Dictionary = _save.call(&"get_snapshot")
	var state_error := _candidate_state_error(candidate)
	if not state_error.is_empty():
		return {"ok": false, "errors": [state_error]}
	return _ownership_audit(candidate, _state(candidate))

func _ownership_audit(candidate: Dictionary, state: Dictionary) -> Dictionary:
	var errors: Array[String] = []
	var instances: Dictionary = state.get("instances", {})
	var bag := _bag_stacks(candidate)
	var storage := _storage_stacks(candidate)
	for key: Variant in bag.keys():
		var record: Variant = bag[key]
		if not record is Dictionary:
			errors.append("invalid_bag_stack")
			continue
		var id := _stack_base_id(str(key), record)
		if id.begins_with(TOKEN_PREFIX):
			var err := _token_error(candidate, state, id)
			if not err.is_empty():
				errors.append(id + ":" + err)
	for key: Variant in storage.keys():
		var record: Variant = storage[key]
		if record is Dictionary and _stack_base_id(str(key), record).begins_with(TOKEN_PREFIX):
			errors.append(str(key) + ":unique_token_outside_bag")
	for id: Variant in instances.keys():
		var record: Dictionary = instances[id]
		var location := str(record.get("location", ""))
		if location == "bag":
			var err := _token_error(candidate, state, str(id))
			if not err.is_empty():
				errors.append(str(id) + ":" + err)
		elif _has_token_anywhere(candidate, str(id)):
			errors.append(str(id) + ":escrow_or_terminal_record_has_token")
	for job: Variant in (state.get("jobs", {}) as Dictionary).values():
		for field in ["reserved_instances", "output_instances"]:
			for id: Variant in (job.get(field, {}) as Dictionary).keys():
				if not instances.has(id):
					errors.append(str(id) + ":job_reference_missing_instance")
				elif _has_token_anywhere(candidate, str(id)):
					errors.append(str(id) + ":job_instance_also_has_token")
	return {"ok": errors.is_empty(), "errors": errors}

func inventory_totals() -> Dictionary:
	var totals: Dictionary = {}
	var candidate: Dictionary = _save.call(&"get_snapshot") if _save != null else {}
	var state := _state(candidate)
	var instances: Dictionary = state.get("instances", {})
	var stacks := _bag_stacks(candidate)
	for key: Variant in stacks.keys():
		var record: Variant = stacks[key]
		if not record is Dictionary:
			continue
		var id := _stack_base_id(str(key), record)
		var quantity := int(record.get("quantity", 0))
		if id.begins_with(TOKEN_PREFIX):
			if not _token_error(candidate, state, id).is_empty():
				continue
			id = str(instances[id].get("item_id", ""))
		totals[id] = int(totals.get(id, 0)) + quantity
	return totals

func owned_instances(item_id := "") -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if _save == null:
		return result
	var candidate: Dictionary = _save.call(&"get_snapshot")
	var state := _state(candidate)
	for id: Variant in (state.get("instances", {}) as Dictionary).keys():
		if not _token_error(candidate, state, str(id)).is_empty():
			continue
		var record: Dictionary = state["instances"][id]
		if item_id.is_empty() or str(record.get("item_id", "")) == item_id:
			result.append(record.duplicate(true))
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return str(a["instance_id"]) < str(b["instance_id"]))
	return result

func _ok(extra: Dictionary = {}) -> Dictionary:
	var result := {"ok": true, "reason": "", "duplicate": false}
	result.merge(extra, true)
	return result

func _fail(reason: String) -> Dictionary:
	last_error = reason
	return {"ok": false, "reason": reason, "duplicate": false}

func _event_key(operation: String, event_id: String) -> String:
	return "soh.a3.%s.%s" % [operation, event_id.sha256_text()]

func _receipt_signature(key: String, signature: String) -> bool:
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var receipts: Dictionary = snapshot.get("applied_transactions", {})
	if receipts.has(key):
		var metadata: Dictionary = receipts[key].get("metadata", {})
		if str(metadata.get("payload_sha256", "")) == signature:
			return true
	var commands: Dictionary = document().get("commands", {})
	return str(commands.get(key, "")) == signature

## Payload binding prevents a reused event id from authorizing different args.
## New payload signatures live in SaveService transaction metadata; the legacy
## commands map is read-only compatibility and is not grown by new operations.
func _transact(operation: String, event_id: String, payload: Dictionary, mutator: Callable) -> Dictionary:
	last_error = ""
	if _save == null:
		return _fail("not_configured")
	if event_id.is_empty() or event_id.length() > MAX_EVENT_LENGTH:
		return _fail("invalid_event_id")
	var snapshot: Dictionary = _save.call(&"get_snapshot")
	var preflight_error := _candidate_state_error(snapshot)
	if not preflight_error.is_empty():
		return _fail(preflight_error)
	var preflight := _ownership_audit(snapshot, _state(snapshot))
	if not bool(preflight.ok):
		last_error = "ownership_invariant_violation"
		return {"ok": false, "reason": "ownership_invariant_violation", "duplicate": false, "errors": preflight.errors}
	var key := _event_key(operation, event_id)
	var signature := JSON.stringify(payload).sha256_text()
	if bool(_save.call(&"is_transaction_applied", key)):
		if _receipt_signature(key, signature):
			return _ok({"duplicate": true})
		return _fail("event_id_conflict")
	var result := {"ok": false, "reason": "rejected"}
	var receipt_metadata := {"kind": "survival_economy", "operation": operation, "event_id": event_id, "payload_sha256": signature}
	var extra_metadata: Variant = payload.get("receipt_metadata", {})
	if extra_metadata is Dictionary:
		receipt_metadata.merge(extra_metadata, true)
	var applied := bool(_save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var state_error := _candidate_state_error(candidate)
		if not state_error.is_empty():
			result["reason"] = state_error; return false
		var state := _state(candidate)
		var audit := _ownership_audit(candidate, state)
		if not bool(audit.ok):
			result["reason"] = "ownership_invariant_violation"
			result["errors"] = audit.errors
			return false
		if not bool(mutator.call(candidate, state, result)):
			return false
		# Mutator-derived receipt metadata is merged AFTER the request signature
		# is fixed. This lets world_action bind the canonical generation key to
		# the durable receipt without making replay depend on the current
		# generation/cooldown state.
		var result_metadata: Variant = result.get("receipt_metadata", {})
		if result_metadata is Dictionary:
			receipt_metadata.merge(result_metadata, true)
			result.erase("receipt_metadata")
		# V6: an arm record is custody of a future offline interval, not a reward.
		# Once the job is ready/collected/cancelled/missing, prune the arm so it
		# cannot occupy a slot or be replayed. V5 saves without offline are untouched.
		if state.has("offline") and state["offline"] is Dictionary:
			var offline_state: Dictionary = state["offline"]
			var armed_records: Dictionary = offline_state.get("armed", {})
			for armed_id: Variant in armed_records.keys():
				var armed_job: Dictionary = (state.get("jobs", {}) as Dictionary).get(str(armed_id), {})
				if armed_job.is_empty() or str(armed_job.get("status", "")) not in ["queued", "running", "paused"]:
					armed_records.erase(str(armed_id))
			offline_state["armed"] = armed_records
			state["offline"] = offline_state
		# Compact only terminal legacy jobs with no remaining escrow. Active,
		# ready-refund, and output-bearing jobs are never silently discarded.
		for job_id: Variant in (state.get("jobs", {}) as Dictionary).keys():
			var old_job: Dictionary = state["jobs"][job_id]
			if str(old_job.get("status", "")) in ["collected", "cancelled"] \
					and (old_job.get("outputs", {}) as Dictionary).is_empty() \
					and (old_job.get("output_instances", {}) as Dictionary).is_empty():
				state["jobs"].erase(job_id)
		var post := _ownership_audit(candidate, state)
		if not bool(post.ok):
			result["reason"] = "ownership_invariant_violation"
			result["errors"] = post.errors
			return false
		state["schema"] = SCHEMA
		candidate[ROOT] = state
		return true
	, receipt_metadata))
	if not applied:
		# SaveService returns false for both mutator rejection and durable write
		# failure. Mutator rejections set a specific reason; an unset/default
		# reason at this point is an authoritative commit/I/O failure.
		var reason := str(result.get("reason", "commit_failed"))
		if reason == "rejected" or reason.is_empty():
			reason = "save_failed"
		var failure := _fail(reason)
		for field in ["remaining_active_seconds", "already_applied", "errors"]:
			if result.has(field):
				failure[field] = result[field]
		return failure
	result["ok"] = true
	result["duplicate"] = false
	return result

func _remove(candidate: Dictionary, item_id: String, quantity: int) -> bool:
	return bool(_save.call(&"remove_items_from_candidate", candidate, item_id, quantity))

func _add(candidate: Dictionary, item_id: String, quantity: int, kind := "material") -> bool:
	if item_id.begins_with(TOKEN_PREFIX):
		if quantity != 1 or kind != "key_item" or not _token_stack_keys(_bag_stacks(candidate), item_id).is_empty():
			return false
	return bool(_save.call(&"add_items_to_candidate", candidate, item_id, kind, quantity,
		{"source": "survival_economy", "display_name": str(item(item_id).get("label", item_id))}))

func _add_outputs(candidate: Dictionary, outputs: Dictionary) -> bool:
	for id: Variant in outputs.keys():
		var definition := item(str(id))
		if definition.is_empty():
			return false
		if str(definition.get("storage", "")) == "instance":
			if int(outputs[id]) != 1:
				return false
			continue
		if str(definition.get("storage", "")) != "stack":
			return false
		var kind := str(definition.get("kind", "material"))
		if kind == "station_kit":
			kind = "material"
		if not _add(candidate, str(id), int(outputs[id]), kind):
			return false
	return true

func _take_inputs(candidate: Dictionary, state: Dictionary, inputs: Dictionary, reserved: Dictionary) -> bool:
	for id: Variant in inputs.keys():
		var amount := int(inputs[id])
		if amount <= 0 or item(str(id)).is_empty():
			return false
		if str(item(str(id)).get("storage", "")) == "instance" or str(id).begins_with(TOKEN_PREFIX):
			return false
		if not _remove(candidate, str(id), amount):
			return false
		reserved[id] = amount
	return true

func _require_bag_instance(candidate: Dictionary, state: Dictionary, instance_id: String, result: Dictionary) -> Dictionary:
	var err := _token_error(candidate, state, instance_id)
	if not err.is_empty():
		result["reason"] = "instance_not_owned:" + err
		return {}
	return state["instances"][instance_id]

func _station(station_id: String, required_kind: String, tier: int) -> Dictionary:
	if required_kind == "hand":
		return {"ok": true, "station_id": station_id, "kind": "hand", "tier": 0,
			"queue_capacity": 1, "operational": true, "condition": 100, "station_revision": "hand"}
	if not _station_resolver.is_valid():
		return {}
	var value: Variant = _station_resolver.call(station_id)
	if not value is Dictionary:
		return {}
	var station: Dictionary = value
	if not bool(station.get("ok", false)) or str(station.get("station_id", "")) != station_id:
		return {}
	if str(station.get("kind", "")) != required_kind or int(station.get("tier", 0)) < tier:
		return {}
	if str(station.get("station_revision", "")).is_empty():
		return {}
	if not bool(station.get("operational", false)) or int(station.get("condition", 0)) <= 0:
		return {}
	return station

func _station_operational(station_id: String) -> Dictionary:
	if station_id == "hand":
		return {"ok": true, "station_id": "hand", "kind": "hand", "tier": 0,
			"queue_capacity": 1, "operational": true, "condition": 100, "station_revision": "hand"}
	if not _station_resolver.is_valid():
		return {}
	var value: Variant = _station_resolver.call(station_id)
	if not value is Dictionary:
		return {}
	var station: Dictionary = value
	if not bool(station.get("ok", false)) or str(station.get("station_id", "")) != station_id:
		return {}
	if str(station.get("station_revision", "")).is_empty():
		return {}
	if not bool(station.get("operational", false)) or int(station.get("condition", 0)) <= 0:
		return {}
	return station

func _prerequisites(candidate: Dictionary, state: Dictionary, required: Array) -> bool:
	for id: Variant in required:
		if not (state.get("technologies", {}) as Dictionary).has(str(id)):
			return false
	return true

func _learn(candidate: Dictionary, recipe_id: String, source: String) -> void:
	var survival: Dictionary = candidate.get("survival", {})
	if survival.is_empty():
		survival = {"schema": 1, "knowledge": {"recipes": {}}}
	var knowledge: Dictionary = survival.get("knowledge", {"recipes": {}})
	var recipes: Dictionary = knowledge.get("recipes", {})
	recipes[recipe_id] = {"source": source, "learned_at": 0}
	knowledge["recipes"] = recipes
	survival["knowledge"] = knowledge
	candidate["survival"] = survival

func _valid_recipe_outputs(r: Dictionary) -> bool:
	var outputs: Dictionary = r.get("outputs", {})
	if outputs.is_empty():
		return false
	for id: Variant in outputs.keys():
		var definition := item(str(id))
		if definition.is_empty() or int(outputs[id]) <= 0:
			return false
		if str(definition.get("storage", "")) == "instance" and int(outputs[id]) != 1:
			return false
	return true

func _queue_count(state: Dictionary, station_id: String) -> int:
	var count := 0
	for job: Variant in (state.get("jobs", {}) as Dictionary).values():
		if str(job.get("station_id", "")) == station_id and str(job.get("status", "")) in UNRESOLVED_JOB_STATES:
			count += 1
	return count

## Establish a non-retroactive time baseline when work is queued. If the host is
## absent, advance later establishes a baseline and grants zero retroactive work.
func _capture_time_baseline(state: Dictionary, station_id: String) -> void:
	var receipt := _host_time_receipt(station_id)
	if receipt.is_empty():
		return
	var time: Dictionary = state.get("time", _empty_time())
	var index := int(receipt.session_index)
	if index > int(time.latest_session_index):
		time = {"latest_session_index": index, "session_id": receipt.session_id,
			"sequence": int(receipt.sequence), "stations": {}}
	elif index != int(time.latest_session_index) or str(receipt.session_id) != str(time.session_id):
		return
	if int(receipt.sequence) < int(time.sequence):
		return
	var stations: Dictionary = time.stations
	if not stations.has(station_id):
		stations[station_id] = {"active_ticks": int(receipt.active_ticks), "station_revision": receipt.station_revision}
	time["stations"] = stations
	state["time"] = time

func enqueue(recipe_id: String, station_id: String, event_id: String) -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty():
		return _fail("unknown_recipe")
	if not _valid_recipe_outputs(r):
		return _fail("invalid_recipe_outputs")
	return _transact("enqueue", event_id, {"recipe": recipe_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if not known(recipe_id):
				result["reason"] = "recipe_not_learned"; return false
			if not _prerequisites(candidate, state, r.get("required_technologies", [])):
				result["reason"] = "technology_missing"; return false
			var station := _station(station_id, str(r["station"]), int(r["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			if _queue_count(state, station_id) >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var reserved := {}
			var fuel_reserved := {}
			if not _take_inputs(candidate, state, r["inputs"], reserved) \
					or not _take_inputs(candidate, state, r.get("fuel", {}), fuel_reserved):
				result["reason"] = "insufficient_or_invalid_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "craft", "target": recipe_id,
				"station_id": station_id, "station_kind": str(r["station"]), "tier": int(r["min_tier"]),
				"status": "queued", "elapsed": 0, "duration": maxi(1, int(r["duration_ticks"])),
				"reserved": reserved, "reserved_fuel": fuel_reserved, "reserved_instances": {}, "outputs": {}, "output_instances": {}}
			_capture_time_baseline(state, station_id)
			result["job_id"] = id
			return true)

func _host_time_receipt(station_id: String) -> Dictionary:
	if not _time_host.is_valid():
		return {}
	var value: Variant = _time_host.call(station_id)
	if not value is Dictionary:
		return {}
	var r: Dictionary = value
	if str(r.get("contract", "")) != TIME_CONTRACT or str(r.get("station_id", "")) != station_id:
		return {}
	if str(r.get("session_id", "")).is_empty() or str(r.get("station_revision", "")).is_empty():
		return {}
	for field in ["session_index", "sequence", "active_ticks"]:
		if not r.has(field) or not r[field] is int or int(r[field]) < 0:
			return {}
	if int(r.session_index) > 1000000000 or int(r.sequence) > 1000000000000 or int(r.active_ticks) > 1000000000000:
		return {}
	if str(r.session_id).length() > 96 or str(r.station_revision).length() > 128 or station_id.length() > 64:
		return {}
	return {
		"contract": TIME_CONTRACT, "station_id": station_id,
		"session_id": str(r.session_id), "session_index": int(r.session_index),
		"sequence": int(r.sequence), "active_ticks": int(r.active_ticks),
		"station_revision": str(r.station_revision),
	}

func _verified_time_receipt(station_id: String, request: Variant) -> Dictionary:
	if not request is Dictionary:
		return {"ok": false, "reason": "invalid_time_receipt"}
	var req: Dictionary = request
	if req.has("ticks"):
		return {"ok": false, "reason": "caller_supplied_ticks_forbidden"}
	var host := _host_time_receipt(station_id)
	if host.is_empty():
		return {"ok": false, "reason": "time_host_unavailable"}
	var expected_fields := ["contract", "station_id", "session_id", "session_index", "sequence", "active_ticks", "station_revision"]
	if req.size() != expected_fields.size():
		return {"ok": false, "reason": "time_receipt_unknown_fields"}
	for field in expected_fields:
		if not req.has(field) or req[field] != host[field]:
			return {"ok": false, "reason": "time_receipt_mismatch:" + field}
	for field in ["session_index", "sequence", "active_ticks"]:
		if not req[field] is int:
			return {"ok": false, "reason": "time_receipt_not_integer:" + field}
	return {"ok": true, "receipt": host}

## Trusted active-session advance. `request` must exactly match the injected A0
## host snapshot; caller-supplied tick counts are forbidden. Replayed event IDs
## are idempotent, but a new event ID with no newly elapsed host time is rejected.
func advance(station_id: String, request: Variant, event_id: String) -> Dictionary:
	var payload := {"station": station_id, "request": request if request is Dictionary else {}}
	return _transact("advance", event_id, payload,
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var verified := _verified_time_receipt(station_id, request)
			if not bool(verified.ok):
				result["reason"] = str(verified.reason); return false
			var receipt: Dictionary = verified.receipt
			var time: Dictionary = state.get("time", _empty_time())
			var index := int(receipt.session_index)
			if index < int(time.latest_session_index):
				result["reason"] = "stale_session"; return false
			if index == int(time.latest_session_index) and str(receipt.session_id) != str(time.session_id):
				result["reason"] = "session_conflict"; return false
			if index > int(time.latest_session_index):
				time = {"latest_session_index": index, "session_id": receipt.session_id, "sequence": -1, "stations": {}}
			if int(receipt.sequence) < int(time.sequence):
				result["reason"] = "stale_sequence"; return false
			var stations: Dictionary = time.stations
			var baseline: Dictionary = stations.get(station_id, {})
			var station := _station_operational(station_id)
			if not station.is_empty() and str(station.get("station_revision", "")) != str(receipt.station_revision):
				result["reason"] = "station_revision_mismatch"; return false
			# Kind/tier are checked per job below; an empty resolver means removed/off.
			var applied := 0
			var completed: Array[String] = []
			var paused := false
			var revision_changed := not baseline.is_empty() and str(baseline.get("station_revision", "")) != str(receipt.station_revision)
			if baseline.is_empty():
				stations[station_id] = {"active_ticks": int(receipt.active_ticks), "station_revision": receipt.station_revision}
				result["baseline_established"] = true
				if station.is_empty():
					for job: Variant in state["jobs"].values():
						if str(job.get("station_id", "")) == station_id and str(job.get("status", "")) in ["queued","running"]:
							job["status"] = "paused"
					paused = true
					result["paused"] = true
			else:
				var delta := int(receipt.active_ticks) - int(baseline.active_ticks)
				if delta < 0:
					result["reason"] = "clock_regressed"; return false
				if revision_changed or station.is_empty():
					for job: Variant in state["jobs"].values():
						if str(job.get("station_id", "")) == station_id and str(job.get("status", "")) in ["queued","running"]:
							job["status"] = "paused"
					stations[station_id] = {"active_ticks": int(receipt.active_ticks), "station_revision": receipt.station_revision}
					paused = true
					result["paused"] = true
				elif delta == 0:
					result["reason"] = "no_elapsed_time"; return false
				elif delta > MAX_TICK_QUANTUM:
					result["reason"] = "time_quantum_exceeded"; return false
				else:
					var ids: Array = state["jobs"].keys()
					ids.sort()
					var remaining := delta
					for id: Variant in ids:
						var job: Dictionary = state["jobs"][id]
						if str(job.get("station_id", "")) != station_id or str(job.get("status", "")) not in ["queued","running","paused"]:
							continue
						var job_station := _station(station_id, str(job.get("station_kind", "")), int(job.get("tier", 0)))
						if job_station.is_empty():
							job["status"] = "paused"
							continue
						job["status"] = "running"
						var used := mini(remaining, int(job["duration"]) - int(job["elapsed"]))
						job["elapsed"] = int(job["elapsed"]) + used
						remaining -= used
						applied += used
						if int(job["elapsed"]) >= int(job["duration"]):
							if not _finish_job(candidate, state, job):
								result["reason"] = "invalid_job_output"; return false
							completed.append(str(id))
						if remaining <= 0:
							break
					stations[station_id] = {"active_ticks": int(receipt.active_ticks), "station_revision": receipt.station_revision}
			time["sequence"] = int(receipt.sequence)
			time["stations"] = _prune_time_stations(stations, state, station_id)
			state["time"] = time
			result["applied_ticks"] = applied
			result["completed"] = completed
			return true)

func _prune_time_stations(stations: Dictionary, state: Dictionary, current_station: String) -> Dictionary:
	var keep := {current_station: true}
	for job: Variant in (state.get("jobs", {}) as Dictionary).values():
		if str(job.get("status", "")) in UNRESOLVED_JOB_STATES:
			keep[str(job.get("station_id", ""))] = true
	var result := {}
	var keys: Array = stations.keys()
	keys.sort()
	for key: Variant in keys:
		if keep.has(key) and result.size() < MAX_TIME_STATIONS:
			result[key] = stations[key]
	for key: Variant in keys:
		if result.size() >= MAX_TIME_STATIONS:
			break
		if not result.has(key):
			result[key] = stations[key]
	return result

func _finish_job(candidate: Dictionary, state: Dictionary, job: Dictionary) -> bool:
	job["reserved_fuel"] = {}
	if str(job["kind"]) == "technology":
		state["technologies"][str(job["target"])] = {"source": "research"}
	elif str(job["kind"]) == "research":
		_learn(candidate, str(job["target"]), "research:" + str(job["job_id"]))
		for old_id: Variant in (job.get("reserved_instances", {}) as Dictionary).keys():
			state["instances"][old_id]["location"] = "consumed_by_research"
			state["instances"][old_id]["revision"] = int(state["instances"][old_id]["revision"]) + 1
	else:
		var r := recipe(str(job["target"]))
		if not _valid_recipe_outputs(r):
			return false
		if r.has("consumes_specimen"):
			for old_id: Variant in (job.get("reserved_instances", {}) as Dictionary).keys():
				state["instances"][old_id]["location"] = "reconstructed"
				state["instances"][old_id]["revision"] = int(state["instances"][old_id]["revision"]) + 1
		job["outputs"] = (r["outputs"] as Dictionary).duplicate(true)
		for id: Variant in (job.get("outputs", {}) as Dictionary).keys():
			if str(item(str(id)).get("storage", "")) == "instance":
				if int(job["outputs"][id]) != 1:
					return false
				var record := _new_instance(state, str(id), "job_output")
				job["output_instances"][str(record["instance_id"])] = record
	job["status"] = "ready"
	job["reserved"] = {}
	job["reserved_instances"] = {}
	return true

func _new_instance(state: Dictionary, item_id: String, location: String) -> Dictionary:
	var definition := item(item_id)
	state["counter"] = int(state["counter"]) + 1
	var id := TOKEN_PREFIX + "%012d_%s" % [int(state["counter"]), str(definition.get("kind", "item")).md5_text().left(8)]
	var record := {"instance_id": id, "item_id": item_id, "location": location,
		"condition": int(definition.get("max_condition", 100)),
		"max_condition": int(definition.get("max_condition", 100)),
		"uses": int(definition.get("max_uses", 0)), "max_uses": int(definition.get("max_uses", 0)),
		"revision": 0, "origin": "economy"}
	state["instances"][id] = record
	return record

func grant_instance(item_id: String, source_event: String, uses := -1, condition := -1) -> Dictionary:
	var definition := item(item_id)
	if definition.is_empty() or str(definition.get("storage", "")) != "instance":
		return _fail("not_an_instance_item")
	return _transact("grant", source_event, {"item": item_id, "uses": uses, "condition": condition},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _new_instance(state, item_id, "bag")
			if uses >= 0:
				record["uses"] = mini(uses, int(record["max_uses"]))
			if condition >= 0:
				record["condition"] = mini(condition, int(record["max_condition"]))
			if not _add(candidate, str(record["instance_id"]), 1, "key_item"):
				state["instances"].erase(record["instance_id"])
				result["reason"] = "inventory_full"; return false
			result["instance_id"] = record["instance_id"]
			return true)

func collect(job_id: String, event_id: String) -> Dictionary:
	return _transact("collect", event_id, {"job": job_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var job: Dictionary = state["jobs"].get(job_id, {})
			if job.is_empty() or str(job["status"]) != "ready":
				result["reason"] = "nothing_to_collect"; return false
			var trial: Dictionary = candidate.duplicate(true)
			if not _add_outputs(trial, job.get("outputs", {})):
				result["reason"] = "inventory_full"; return false
			for id: Variant in (job.get("output_instances", {}) as Dictionary).keys():
				if not _add(trial, str(id), 1, "key_item"):
					result["reason"] = "inventory_full"; return false
			if not _add_outputs(candidate, job.get("outputs", {})):
				result["reason"] = "inventory_full"; return false
			for id: Variant in (job.get("output_instances", {}) as Dictionary).keys():
				if not _add(candidate, str(id), 1, "key_item"):
					result["reason"] = "inventory_full"; return false
				state["instances"][id]["location"] = "bag"
			# Receipt remains in SaveService; collected job escrow is compacted.
			state["jobs"].erase(job_id)
			result["job_id"] = job_id
			return true)

func cancel(job_id: String, event_id: String) -> Dictionary:
	return _transact("cancel", event_id, {"job": job_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var job: Dictionary = state["jobs"].get(job_id, {})
			if job.is_empty() or str(job["status"]) not in ["queued","running","paused"]:
				result["reason"] = "cannot_cancel"; return false
			job["outputs"] = (job.get("reserved", {}) as Dictionary).duplicate(true)
			job["output_instances"] = (job.get("reserved_instances", {}) as Dictionary).duplicate(true)
			job["reserved"] = {}
			job["reserved_fuel"] = {}
			job["reserved_instances"] = {}
			job["status"] = "ready"
			result["job_id"] = job_id
			return true)

func research_technology(technology_id: String, station_id: String, event_id: String) -> Dictionary:
	var t: Dictionary = catalog.get("technologies", {}).get(technology_id, {})
	if t.is_empty():
		return _fail("unknown_technology")
	return _transact("tech", event_id, {"technology": technology_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if knows_technology(technology_id):
				result["reason"] = "already_known"; return false
			if not _prerequisites(candidate, state, t["prerequisites"]):
				result["reason"] = "technology_missing"; return false
			for job: Variant in state["jobs"].values():
				if str(job["target"]) == technology_id and str(job["status"]) in ["queued","running","paused","ready"]:
					result["reason"] = "research_pending"; return false
			var station := _station(station_id, "research", int(t["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			if _queue_count(state, station_id) >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var reserved := {}
			if not _take_inputs(candidate, state, t["inputs"], reserved):
				result["reason"] = "insufficient_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "technology", "target": technology_id,
				"station_id": station_id, "station_kind": "research", "tier": 1, "status": "queued",
				"elapsed": 0, "duration": int(t["duration_ticks"]), "reserved": reserved,
				"reserved_fuel": {}, "reserved_instances": {}, "outputs": {}, "output_instances": {}}
			_capture_time_baseline(state, station_id)
			result["job_id"] = id
			return true)

func research_recipe(recipe_id: String, station_id: String, method: String, event_id: String, specimen_id := "") -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty():
		return _fail("unknown_recipe")
	if not _valid_recipe_outputs(r):
		return _fail("invalid_recipe_outputs")
	return _transact("research", event_id, {"recipe": recipe_id, "station": station_id, "method": method, "specimen": specimen_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if known(recipe_id):
				result["reason"] = "already_known"; return false
			for job: Variant in state["jobs"].values():
				if str(job["target"]) == recipe_id and str(job["kind"]) == "research" and str(job["status"]) in ["queued","running","paused","ready"]:
					result["reason"] = "research_pending"; return false
			var station := _station(station_id, "research", 1)
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			if _queue_count(state, station_id) >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var costs := {"knowledge_spares": 3}
			var reserved := {}
			var reserved_instances := {}
			if method == "blueprint":
				var plan_id := ""
				for id: Variant in catalog["items"].keys():
					if str(catalog["items"][id].get("unlocks_recipe", "")) == recipe_id:
						plan_id = str(id)
				if plan_id.is_empty():
					result["reason"] = "no_blueprint_for_recipe"; return false
				costs[plan_id] = 1
			elif method == "specimen":
				var outputs: Dictionary = r.get("outputs", {})
				if outputs.size() != 1:
					result["reason"] = "invalid_research_output"; return false
				var expected := str(outputs.keys()[0])
				var specimen := _require_bag_instance(candidate, state, specimen_id, result)
				if specimen.is_empty():
					return false
				if str(specimen.get("item_id", "")) != expected:
					result["reason"] = "specimen_item_mismatch"; return false
				if not _remove(candidate, specimen_id, 1):
					result["reason"] = "specimen_not_owned"; return false
				specimen["location"] = "research:" + str(event_id)
				reserved_instances[specimen_id] = specimen
				costs["knowledge_spares"] = 5
			elif method == "targeted":
				# A3 may explicitly price basic tool learning below advanced
				# targeted research. The override is catalog data, not a UI flag.
				costs = (r.get("research_cost", {"knowledge_spares": 6, "research_notes": 2}) as Dictionary).duplicate(true)
			else:
				result["reason"] = "unknown_research_method"; return false
			if not _prerequisites(candidate, state, r.get("required_technologies", [])):
				result["reason"] = "technology_missing"; return false
			if not _take_inputs(candidate, state, costs, reserved):
				result["reason"] = "insufficient_inputs"; return false
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "research", "target": recipe_id,
				"station_id": station_id, "station_kind": "research", "tier": 1, "status": "queued",
				"elapsed": 0, "duration": 40, "reserved": reserved, "reserved_fuel": {},
				"reserved_instances": reserved_instances, "outputs": {}, "output_instances": {}}
			_capture_time_baseline(state, station_id)
			result["job_id"] = id
			return true)

func dismantle_stack(item_id: String, amount: int, station_id: String, event_id: String) -> Dictionary:
	var definition := item(item_id)
	var salvage: Dictionary = definition.get("salvage", {})
	if amount <= 0 or salvage.is_empty() or item_id.begins_with(TOKEN_PREFIX):
		return _fail("not_dismantlable")
	return _transact("dismantle", event_id, {"item": item_id, "quantity": amount, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if _station(station_id, str(salvage["station"]), int(salvage["min_tier"])).is_empty():
				result["reason"] = "station_unavailable"; return false
			var outputs := {}
			for id: Variant in (salvage["outputs"] as Dictionary).keys():
				outputs[id] = int(salvage["outputs"][id]) * amount
			var trial: Dictionary = candidate.duplicate(true)
			if not _remove(trial, item_id, amount) or not _add_outputs(trial, outputs):
				result["reason"] = "insufficient_inputs_or_inventory_full"; return false
			if not _remove(candidate, item_id, amount) or not _add_outputs(candidate, outputs):
				result["reason"] = "insufficient_inputs_or_inventory_full"; return false
			return true)

func dismantle_instance(instance_id: String, station_id: String, event_id: String) -> Dictionary:
	return _transact("dismantle_instance", event_id, {"instance": instance_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _require_bag_instance(candidate, state, instance_id, result)
			if record.is_empty():
				return false
			var salvage: Dictionary = item(str(record["item_id"])).get("salvage", {})
			if salvage.is_empty():
				result["reason"] = "not_dismantlable"; return false
			if _station(station_id, str(salvage["station"]), int(salvage["min_tier"])).is_empty():
				result["reason"] = "station_unavailable"; return false
			var trial: Dictionary = candidate.duplicate(true)
			if not _remove(trial, instance_id, 1) or not _add_outputs(trial, salvage["outputs"]):
				result["reason"] = "inventory_full"; return false
			if not _remove(candidate, instance_id, 1) or not _add_outputs(candidate, salvage["outputs"]):
				result["reason"] = "inventory_full"; return false
			record["location"] = "dismantled"
			record["revision"] = int(record["revision"]) + 1
			return true)

func repair(instance_id: String, station_id: String, event_id: String) -> Dictionary:
	return _transact("repair", event_id, {"instance": instance_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _require_bag_instance(candidate, state, instance_id, result)
			if record.is_empty():
				return false
			var definition := item(str(record["item_id"]))
			if str(definition.get("repair_policy", "")) != "material_repair":
				result["reason"] = "core_requires_reconstruction"; return false
			var missing := int(record["max_condition"]) - int(record["condition"])
			if missing <= 0:
				result["reason"] = "already_full_condition"; return false
			if _station(station_id, "workbench", 1).is_empty():
				result["reason"] = "station_unavailable"; return false
			var costs := {"iron_parts": maxi(1, int(ceil(float(missing) / 25.0))), "binding_cloth": 1}
			var reserved := {}
			if not _take_inputs(candidate, state, costs, reserved):
				result["reason"] = "insufficient_inputs"; return false
			record["condition"] = record["max_condition"]
			record["revision"] = int(record["revision"]) + 1
			return true)

func reconstruct_core(recipe_id: String, specimen_id: String, station_id: String, event_id: String) -> Dictionary:
	var r := recipe(recipe_id)
	if r.is_empty() or str(r.get("category", "")) != "reconstruction":
		return _fail("not_a_reconstruction")
	if not _valid_recipe_outputs(r):
		return _fail("invalid_recipe_outputs")
	return _transact("reconstruct", event_id, {"recipe": recipe_id, "specimen": specimen_id, "station": station_id},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			if not known(recipe_id) or not _prerequisites(candidate, state, r["required_technologies"]):
				result["reason"] = "knowledge_missing"; return false
			var record := _require_bag_instance(candidate, state, specimen_id, result)
			if record.is_empty():
				return false
			if str(record["item_id"]) != str(r["consumes_specimen"]):
				result["reason"] = "specimen_item_mismatch"; return false
			var station := _station(station_id, str(r["station"]), int(r["min_tier"]))
			if station.is_empty():
				result["reason"] = "station_unavailable"; return false
			if _queue_count(state, station_id) >= int(station.get("queue_capacity", 1)):
				result["reason"] = "queue_full"; return false
			var reserved := {}
			var fuel_reserved := {}
			if not _remove(candidate, specimen_id, 1) or not _take_inputs(candidate, state, r["inputs"], reserved) \
					or not _take_inputs(candidate, state, r.get("fuel", {}), fuel_reserved):
				result["reason"] = "insufficient_inputs"; return false
			record["location"] = "reconstruction:" + specimen_id
			state["counter"] = int(state["counter"]) + 1
			var id := "job_%06d" % int(state["counter"])
			state["jobs"][id] = {"job_id": id, "kind": "craft", "target": recipe_id,
				"station_id": station_id, "station_kind": str(r["station"]), "tier": int(r["min_tier"]),
				"status": "queued", "elapsed": 0, "duration": int(r["duration_ticks"]),
				"reserved": reserved, "reserved_fuel": fuel_reserved, "reserved_instances": {specimen_id: record}, "outputs": {}, "output_instances": {}}
			_capture_time_baseline(state, station_id)
			result["job_id"] = id
			return true)

func _skill_binding(definition: Dictionary) -> Dictionary:
	if str(definition.get("skill_readiness", "")) != "A4_VERIFIED":
		return {}
	var binding: Variant = definition.get("verified_skill_binding", {})
	return binding if binding is Dictionary else {}

func _valid_skill_attestation(attestation: Variant, definition: Dictionary, instance_id: String, cast_id: String, expected_revision: int, context_sha256: String) -> bool:
	if not attestation is Dictionary:
		return false
	var a: Dictionary = attestation
	var binding := _skill_binding(definition)
	if binding.is_empty():
		return false
	if str(a.get("contract", "")) != SKILL_CONTRACT or str(a.get("verification_status", "")) != "A4_VERIFIED":
		return false
	if not bool(a.get("ready", false)) or str(a.get("gameplay_boundary", "")) != "authoritative_commit":
		return false
	if str(a.get("cast_id", "")) != cast_id or str(a.get("instance_id", "")) != instance_id:
		return false
	if not (a.get("expected_revision", null) is int) or int(a["expected_revision"]) != expected_revision:
		return false
	if str(a.get("context_sha256", "")) != context_sha256:
		return false
	for field in ["abstract_skill_id", "original_skill_id", "skill_version", "source_sha256", "verification_evidence_id"]:
		if str(a.get(field, "")).is_empty() or str(a.get(field, "")) != str(binding.get(field, "")):
			return false
	if str(a.get("gameplay_commit_token", "")).is_empty():
		return false
	if str(a.get("core_item_id", "")) != str(definition.get("id", "")):
		return false
	var sha := str(a.get("source_sha256", ""))
	if sha.length() != 64:
		return false
	for i in range(sha.length()):
		if not "0123456789abcdef".contains(sha[i]):
			return false
	return true

## A4/A0 calls this only at the authoritative gameplay commit boundary. The
## attestor is injected by the trusted composition root, never supplied by UI.
func commit_cast(instance_id: String, cast_id: String, expected_revision: int, cast_context: Dictionary = {}) -> Dictionary:
	return _transact("cast", cast_id, {"instance": instance_id, "revision": expected_revision, "context": cast_context},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _require_bag_instance(candidate, state, instance_id, result)
			if record.is_empty():
				return false
			if int(record["revision"]) != expected_revision:
				result["reason"] = "stale_revision"; return false
			if int(record["uses"]) <= 0 or int(record["condition"]) <= 0:
				result["reason"] = "core_depleted"; return false
			var definition := item(str(record["item_id"]))
			if str(definition.get("kind", "")) != "skill_core":
				result["reason"] = "not_a_skill_core"; return false
			var binding := _skill_binding(definition)
			if binding.is_empty() or not _skill_attestor.is_valid():
				result["reason"] = "skill_gate_unavailable"; return false
			var context_sha256 := JSON.stringify(cast_context).sha256_text()
			var request := {
				"contract": SKILL_CONTRACT, "context_sha256": context_sha256,
				"abstract_skill_id": binding.get("abstract_skill_id", ""),
				"original_skill_id": binding.get("original_skill_id", ""), "skill_version": binding.get("skill_version", ""),
				"source_sha256": binding.get("source_sha256", ""),
				"verification_evidence_id": binding.get("verification_evidence_id", ""),
				"core_item_id": record["item_id"], "instance_id": instance_id, "cast_id": cast_id,
				"expected_revision": expected_revision, "gameplay_boundary": "authoritative_commit",
				"context": cast_context,
			}
			var attestation: Variant = _skill_attestor.call(request)
			if not _valid_skill_attestation(attestation, definition, instance_id, cast_id, expected_revision, context_sha256):
				result["reason"] = "skill_not_verified"; return false
			record["uses"] = int(record["uses"]) - 1
			record["revision"] = int(record["revision"]) + 1
			result["remaining_uses"] = record["uses"]
			return true)

func wear(instance_id: String, amount: int, event_id: String) -> Dictionary:
	if amount <= 0:
		return _fail("invalid_wear")
	return _transact("wear", event_id, {"instance": instance_id, "amount": amount},
		func(candidate: Dictionary, state: Dictionary, result: Dictionary) -> bool:
			var record := _require_bag_instance(candidate, state, instance_id, result)
			if record.is_empty():
				return false
			record["condition"] = maxi(0, int(record["condition"]) - amount)
			record["revision"] = int(record["revision"]) + 1
			return true)
