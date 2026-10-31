extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## A7 harness for round 10 (CT P0): current owner heads, the A0 profile port, and
## the cross-owner seams that round 9 could not see.
##
## ## What changed since round 9
## Round 9 concluded that A0 had no run clock and no profile boundary. Both
## statements are now obsolete as *source* claims: `game/survival/economy/
## a0_profile_port.gd` exists at A0 `84ac9c1a`. So this family never asserts an
## absence of the file. It asks the harder question the contract actually cares
## about — is the boundary **mounted, initialised, committed and restored on the
## ordinary player path** — and it separates three answers that are easy to blur:
##
## 1. `SOURCE_PRESENT` — the method exists in the composed tree;
## 2. `REACHABLE` — something in `game/` actually calls it;
## 3. `EXERCISED` — a probe drove it and observed a durable effect.
##
## A rule can be 1 without 2 (dead code), and this harness reports that distinction
## in the verdict line rather than upgrading it.
##
## The port is driven **for real** here: the same `SaveService` autoload the game
## uses, the same `transact_once`, and a `hero_cell` callable. Where a probe has to
## forge a document field to reach a boundary (an 11-day-old run start, a
## discovered POI) the note says `MUTATION_` and the verdict never claims a player
## can reach that state.

const PROFILE_PORT := "res://game/survival/economy/a0_profile_port.gd"
const A3_ECONOMY_SERVICE := "res://game/survival/economy/economy_service.gd"
const META_POLICY := "res://data/survival/recipes/meta_economy.v1.json"
const BINDINGS := "res://data/survival/items/world_source_bindings.v3.json"
const WAYSTATION_POI := "poi_crown_waystation"
const RUN_MAX_SECONDS := 1209600
const RAGNAROK_START := 950400


# ------------------------------------------------------------------ policy reads
func _policy() -> Dictionary:
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(META_POLICY)) if FileAccess.file_exists(META_POLICY) else null
	if raw is Dictionary and (raw as Dictionary).has("policy"):
		return raw["policy"]
	return raw if raw is Dictionary else {}


## A3's policy lists these as arrays; the A0 port wants `endpoint_id -> entry`.
func _endpoint_map() -> Dictionary:
	var policy := _policy()
	var out: Dictionary = {}
	for key: String in ["deposit_endpoints", "vending_machines", "recycler_machines"]:
		for entry: Variant in (policy.get(key, []) as Array):
			if not entry is Dictionary:
				continue
			var row: Dictionary = entry
			var id := String(row.get("endpoint_id", row.get("machine_id", "")))
			if id.is_empty():
				continue
			out[id] = {
				"kind": String(row.get("kind", "")),
				"stand_cells": (row.get("stand_cells", []) as Array).duplicate(true),
				"endpoint_revision": String(row.get("endpoint_revision", "")),
			}
	return out


## Every endpoint in the opening marches belongs to the one mounted Waystation POI.
func _endpoint_poi_map() -> Dictionary:
	var out: Dictionary = {}
	for id: String in _endpoint_map().keys():
		out[id] = WAYSTATION_POI
	return out


func _endpoint_stand(endpoint_id: String) -> Vector2i:
	var cells: Array = (_endpoint_map().get(endpoint_id, {}) as Dictionary).get("stand_cells", [])
	if cells.is_empty():
		return Vector2i(-1, -1)
	var first: Variant = cells[0]
	if first is Array and (first as Array).size() == 2:
		return Vector2i(int(first[0]), int(first[1]))
	return Vector2i(-1, -1)


# -------------------------------------------------------------------- the port
## Build the real A0 port against the real SaveService. `hero_cell` is a callable
## so a probe can pass either the honest reader (`_hero_cell`) or a deliberately
## lying one, which is how the trust boundary is measured rather than assumed.
func _make_port(save: Node, hero_cell: Callable) -> RefCounted:
	var script: Script = load(PROFILE_PORT) as Script
	if script == null or save == null:
		return null
	var port: RefCounted = script.new()
	if not bool(port.call(&"configure", save, _endpoint_map(), _endpoint_poi_map(), hero_cell)):
		_note("port_configure failed: %s" % String(port.get(&"last_error")))
		return null
	return port


func _make_a3(save: Node, port: RefCounted) -> RefCounted:
	var script: Script = load(A3_ECONOMY_SERVICE) as Script
	if script == null or save == null:
		return null
	var econ: RefCounted = script.new()
	if not bool(econ.call(&"configure", save, Callable())):
		return null
	if port != null and not bool(econ.call(&"configure_meta_profile_port", port)):
		return null
	return econ


func _profile() -> Dictionary:
	var snapshot := _snapshot()
	var raw: Variant = snapshot.get("profile", {})
	return raw if raw is Dictionary else {}


func _profile_run() -> Dictionary:
	var raw: Variant = _profile().get("run", {})
	return raw if raw is Dictionary else {}


## Forge the durable run start backwards so the 264 h / 336 h gates can be reached
## without waiting. This is a document mutation on a throwaway save, labelled
## `MUTATION_` in every note that depends on it.
func _forge_run_start(port: RefCounted, seconds_ago: int) -> bool:
	var save := _save()
	if save == null:
		return false
	var target := int(Time.get_unix_time_from_system()) - seconds_ago
	var applied := false
	save.call(&"transact_once", "a7.r10.forge.%d" % seconds_ago, func(candidate: Dictionary) -> bool:
		var root: Variant = candidate.get("profile", {})
		if not root is Dictionary:
			return false
		var run: Variant = (root as Dictionary).get("run", {})
		if not run is Dictionary:
			return false
		(run as Dictionary)["run_started_at_unix"] = target
		(run as Dictionary)["expires_at_unix"] = target + int((run as Dictionary).get("max_seconds", RUN_MAX_SECONDS))
		(root as Dictionary)["run"] = run
		candidate["profile"] = root
		applied = true
		return true,
		{"kind": "a7_r10_forge_run_start"})
	var observed := String((port.call(&"run_context") as Dictionary).get("status", ""))
	_note("MUTATION_ forged run_started_at_unix=%d (%d s ago); mutator ran=%s, context_now=%s" % [
		target, seconds_ago, str(applied), observed,
	])
	# The durable effect is what matters, not the mutator's return value: the save
	# may commit the candidate after the call returns.
	return int((port.call(&"run_context") as Dictionary).get("run_started_at_unix", 0)) == target


func _receipt_count() -> int:
	return (_snapshot().get("applied_transactions", {}) as Dictionary).size()
