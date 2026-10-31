extends "res://game/survival/economy/vendor/a3_economy_service.gd"
## A0-owned production composition shim over the unmodified A3 V7 service
## (owner head 35214ed8). A3's generic _transact accepts an arbitrary callable, so
## only callbacks authored by the pinned adapter itself may cross into the
## SaveService capability port.
##
## Round 11 adds exactly two A0-owned commit boundaries and no A3 semantics:
##   * commit_tool_use  — one atomic harvest: A3 plans the wear, A0 commits the
##     wear and the node yield in the SAME SaveService transaction.
##   * commit_offline_settlement — one atomic settlement of A3's read-only
##     prepared-operation plan.
## Both are authored here (never by UI, a test lambda or a caller-supplied
## script), so the facade's "mutator must belong to the pinned adapter" rule
## still holds.
const PINNED_BASE = preload("res://game/survival/economy/vendor/a3_economy_service.gd")


func _transact(operation: String, event_id: String, payload: Dictionary, mutator: Callable) -> Dictionary:
	var owner := mutator.get_object()
	if not mutator.is_valid() or (owner != self and owner != PINNED_BASE and owner != get_script()):
		return {"ok": false, "reason": "untrusted_economy_mutator", "duplicate": false}
	return super._transact(operation, event_id, payload, mutator)


## One atomic tool-use harvest. `request` must be the exact A3
## `soh.economy.tool_use.v1` request the caller already planned read-only; A3
## re-plans from the live candidate inside the mutator and rejects a stale plan,
## a foreign tool, a broken tool or an already-consumed revision. `grant` is an
## A0 callback that adds the node's real yield to the same candidate; it runs
## AFTER wear is accepted, and if it returns false the whole harvest - wear
## included - is discarded by SaveService.
func commit_tool_use(request: Dictionary, event_id: String, grant: Callable) -> Dictionary:
	if request.is_empty() or not grant.is_valid():
		return {"ok": false, "reason": "invalid_tool_use_request", "duplicate": false}
	var planned: Dictionary = plan_tool_use(request)
	if not bool(planned.get("ok", false)):
		return {"ok": false, "reason": String(planned.get("reason", "tool_use_refused")), "duplicate": false, "plan": planned}
	if not bool(planned.get("allowed", false)):
		return {"ok": false, "reason": String(planned.get("reason", "tool_use_not_allowed")), "duplicate": false, "plan": planned}
	var outcome := {"ok": false, "reason": "not_attempted", "wear": {}, "grant": false}
	var payload := {
		"node_id": String(request.get("node_id", "")),
		"resource_kind": String(request.get("resource_kind", "")),
		"tool_instance_id": String(request.get("tool_instance_id", "")),
		"world_revision": String(request.get("world_revision", "")),
		"active_seconds": int(request.get("active_seconds", 0)),
		"plan_id": String(planned.get("plan_id", "")),
	}
	var result := _transact("tool_use", event_id, payload,
		func(candidate: Dictionary, _state: Dictionary, res: Dictionary) -> bool:
			var wear: Dictionary = apply_tool_use_plan(candidate, planned)
			if not bool(wear.get("ok", false)):
				res["reason"] = String(wear.get("reason", "tool_use_apply_refused"))
				return false
			if not bool(grant.call(candidate)):
				# The harvest is one thing: no yield means no wear either.
				res["reason"] = "harvest_grant_refused"
				return false
			outcome["wear"] = wear
			outcome["grant"] = true
			res["receipt_metadata"] = wear.get("receipt_metadata", {})
			res["plan_id"] = String(planned.get("plan_id", ""))
			return true)
	outcome["ok"] = bool(result.get("ok", false))
	outcome["duplicate"] = bool(result.get("duplicate", false))
	if not outcome["ok"]:
		outcome["reason"] = String(result.get("reason", "tool_use_commit_refused"))
	elif outcome["duplicate"]:
		outcome["reason"] = "already_applied"
	else:
		outcome["reason"] = ""
	outcome["plan"] = planned
	return outcome


## One atomic settlement of A3's read-only offline plan. Replays and interrupted
## writes cannot pay twice because the A3 event key is derived from
## `event_id` (A0 passes the proposal id) and re-checked against the receipt's
## payload signature.
func commit_offline_settlement(proposal: Dictionary, request: Dictionary, event_id: String) -> Dictionary:
	if proposal.is_empty() or request.is_empty() or event_id.is_empty():
		return {"ok": false, "reason": "invalid_offline_settlement", "duplicate": false}
	var outcome := {"ok": false, "reason": "not_attempted", "applied": {}}
	var payload := {
		"proposal_id": String(proposal.get("proposal_id", "")),
		"run_id": String(request.get("run_id", "")),
		"interval_start_unix": int(request.get("interval_start_unix", 0)),
		"interval_end_unix": int(request.get("interval_end_unix", 0)),
		"operations": (proposal.get("operations", []) as Array).size(),
	}
	var result := _transact("offline_settle", event_id, payload,
		func(candidate: Dictionary, _state: Dictionary, res: Dictionary) -> bool:
			var applied: Dictionary = apply_offline_operation_plan(candidate, proposal, request)
			outcome["applied"] = applied
			if not bool(applied.get("ok", false)):
				res["reason"] = String(applied.get("reason", "offline_apply_refused"))
				return false
			return true)
	outcome["ok"] = bool(result.get("ok", false))
	outcome["duplicate"] = bool(result.get("duplicate", false))
	outcome["reason"] = "" if outcome["ok"] else String(result.get("reason", "offline_commit_refused"))
	return outcome
