extends Node
## A0 survival-economy composition root for one mounted overworld.
##
## This is the production caller the previous round lacked: it does not merely
## define interfaces, it binds them to the real live world and to the one
## authoritative SaveService, then exposes read-only state for UI/A6.
##
## It owns nothing that another owner already owns:
##   * run identity/deadline  -> A0 RunLifecycle (autoload, one authority)
##   * profile wallet         -> A3 V7 policy through A0ProfilePort inside the
##                              SAME SaveService document
##   * offline prepared jobs  -> A3 V7 planners; A0 only supplies the real-UTC
##                              projection and commits A3's proposal once
##   * loot/costs/rates       -> A3; geometry/stands -> A1/A8
## Every field the player sees here is derived from the live world.
const Lifecycle = preload("res://game/survival/economy/a0_run_lifecycle.gd")
const ProfilePort = preload("res://game/survival/economy/a0_profile_port.gd")
const OfflineHost = preload("res://game/survival/economy/a0_offline_host.gd")
const META_POLICY_PATH := "res://data/survival/recipes/meta_economy.v1.json"
## A1/A8 physical owners of the A3 trial endpoints. A3 names the kiosks/kiosk
## kinds; the crown Waystation is the only physical site that currently exists.
const ENDPOINT_POI := {
	"preservation_kiosk_01": "poi_crown_waystation",
	"preservation_kiosk_02": "poi_crown_waystation",
	"preservation_kiosk_03": "poi_crown_waystation",
	"vending_kiosk_01": "poi_crown_waystation",
	"vending_kiosk_02": "poi_crown_waystation",
	"vending_kiosk_03": "poi_crown_waystation",
	"recycler_01": "poi_crown_waystation",
	"recycler_02": "poi_crown_waystation",
	"recycler_03": "poi_crown_waystation",
}

var _world: Node
var _hero: Node2D
var _economy: Node
var _survival: Node
var _save: Node
var _lifecycle: Node
var _port: RefCounted
var _offline: Node
var _adapter: RefCounted
var _endpoints: Dictionary = {}
var _last_settle: Dictionary = {}
var last_error := ""


## Called by the live overworld after the A3 economy session is configured.
func configure(world: Node, hero: Node2D, economy_session: Node) -> bool:
	if world == null or hero == null or economy_session == null or not economy_session.get("_configured"):
		last_error = "economy_session_not_configured"
		return false
	_world = world
	_hero = hero
	_economy = economy_session
	_survival = get_node_or_null("/root/SurvivalService")
	_save = get_node_or_null("/root/SaveService")
	_adapter = economy_session.get("_adapter")
	if _survival == null or _save == null or _adapter == null:
		last_error = "a0_composition_roots_missing"
		return false
	_lifecycle = _find_lifecycle()
	if _lifecycle == null:
		last_error = "a0_run_lifecycle_absent"
		return false
	# A run that died of old age is closed before anything else can use it, and a
	# profile that has never had a run gets one. Both are durable commits.
	var settled: Dictionary = _lifecycle.call(&"settle_expiry")
	if String((_lifecycle.call(&"phase") as Dictionary).get("state", "")) == "absent":
		var started: Dictionary = _lifecycle.call(&"start_run")
		if not bool(started.get("ok", false)):
			last_error = "run_start_refused:" + String(started.get("reason", ""))
			return false
	_endpoints = _policy_endpoints()
	if _endpoints.is_empty():
		last_error = "a3_endpoint_policy_absent"
		return false
	_port = ProfilePort.new()
	var hero_cell := Callable(self, "_hero_cell")
	if not bool(_port.call(&"configure", _save, _endpoints, ENDPOINT_POI, hero_cell)):
		last_error = "profile_port_refused:" + String(_port.get("last_error"))
		return false
	if not bool(_adapter.call(&"configure_meta_profile_port", _port)):
		last_error = "a3_meta_port_refused:" + String(_adapter.get("last_error"))
		return false
	_offline = OfflineHost.new()
	_offline.name = "A0OfflineHost"
	add_child(_offline)
	if not bool(_offline.call(&"configure", _save, _adapter, _lifecycle, Callable(self, "_station_projection"))):
		last_error = "offline_host_refused"
		return false
	_adapter.call(&"configure_offline_time_host", Callable(_offline, "host_projection"))
	# One settlement attempt per launch, from real elapsed wall time only.
	_last_settle = _offline.call(&"settle", int(Time.get_unix_time_from_system()))
	if bool(_last_settle.get("run_expired", false)):
		# The run really reached its deadline while the player was away. Close it
		# durably and open the next one; the settled outputs stay in custody.
		var history_run: Dictionary = _lifecycle.call(&"run_record")
		var closed: Dictionary = _lifecycle.call(&"end_run", "expired", String(history_run.get("run_id", "")))
		if bool(closed.get("ok", false)):
			var reopened: Dictionary = _lifecycle.call(&"start_run")
			_last_settle["expiry_closed"] = true
			_last_settle["run_reopened"] = bool(reopened.get("ok", false))
	last_error = ""
	return true


func _find_lifecycle() -> Node:
	var node := get_node_or_null("/root/RunLifecycle")
	if node != null and node.has_method(&"phase"):
		return node
	# Isolated compositions (native tests that boot the scene directly without the
	# app shell) still get exactly one lifecycle, mounted under this root.
	node = Lifecycle.new()
	node.name = "RunLifecycle"
	get_tree().root.add_child(node)
	if not bool(node.call(&"configure", _save)):
		node.queue_free()
		return null
	return node


func _policy_endpoints() -> Dictionary:
	if not FileAccess.file_exists(META_POLICY_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(META_POLICY_PATH))
	if not parsed is Dictionary or not (parsed as Dictionary).get("policy") is Dictionary:
		return {}
	var policy: Dictionary = (parsed as Dictionary)["policy"]
	var out := {}
	for field: String in ["deposit_endpoints", "vending_machines", "recycler_machines"]:
		for raw: Variant in (policy.get(field, []) as Array):
			if not raw is Dictionary:
				continue
			var entry: Dictionary = raw
			var id := String(entry.get("endpoint_id", entry.get("machine_id", "")))
			if id.is_empty():
				continue
			out[id] = {
				"kind": String(entry.get("kind", "")),
				"endpoint_revision": String(entry.get("endpoint_revision", "")),
				"stand_cells": (entry.get("stand_cells", []) as Array).duplicate(true),
			}
	return out


## The Hero's real stand cell, read from the same traversability grid the game
## uses. Empty until the world is ready, so no endpoint authorizes too early.
func _hero_cell() -> Vector2i:
	if not is_instance_valid(_hero) or not is_instance_valid(_world):
		return Vector2i(-1, -1)
	var nav := _world.get(&"traversability") as OverworldTraversability
	if nav == null:
		return Vector2i(-1, -1)
	if bool(_hero.get(&"dead")) or get_tree().paused:
		return Vector2i(-1, -1)
	return nav.cell_of(_hero.global_position)


## Every station that physically exists in this run, resolved exactly the way A3
## resolves it, so an offline projection can never pay for a demolished station.
func _station_projection() -> Dictionary:
	var out := {}
	if not is_instance_valid(_survival):
		return out
	var structures: Dictionary = (_survival.call(&"document") as Dictionary).get("structures", {})
	for id: Variant in structures.keys():
		var data: Dictionary = _survival.call(&"resolve_station", String(id))
		if data.is_empty():
			continue
		out[String(id)] = data
	return out


# ---------------------------------------------------------------------------
# read-only consumer surface
# ---------------------------------------------------------------------------
## One read-only snapshot for A6's return panel and any UI. It performs no
## commit: amounts are A3's own projection, custody is A0's durable document.
func return_snapshot() -> Dictionary:
	if _port == null:
		return {"status": last_error}
	var document: Dictionary = _save.call(&"get_snapshot")
	var meta: Dictionary = _adapter.call(&"project_meta_economy")
	var offline_state: Dictionary = _adapter.call(&"offline_operation_state")
	return {
		"contract": "soh.a0.return_snapshot.v1",
		"read_only": true,
		"run": _lifecycle.call(&"snapshot"),
		"profile_balance": int(_port.call(&"balance")),
		"meta_projection": meta,
		"offline": {
			"armed": (offline_state.get("armed", {}) as Dictionary).size(),
			"last_settle": _last_settle,
			"last_authenticated_unix": int(offline_state.get("last_authenticated_unix", 0)),
		},
		"inventory": document.get("inventory", {}).get("item_stacks", {}),
		"stations": _station_projection(),
	}
