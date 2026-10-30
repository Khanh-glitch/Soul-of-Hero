class_name A6OwnerProjectionSource
extends RefCounted

## Reads A0/A1/A3 projections and nothing else.
##
## The return UI must be mountable without those owners having shipped a season
## clock yet, so every accessor degrades to an "unavailable" contract value that
## the components render as *nothing*. There is no default, no guess and no local
## substitute: a missing projection can never become a visible countdown, a
## fabricated output or a safety verdict.
##
## Tests inject callables through `configure()`; in the game the source resolves
## optional methods on the real autoloads by name, so adding a projection on the
## owner side is enough and A6 needs no import cycle.

const SAVE_SERVICE_PATH := "/root/SaveService"
const SURVIVAL_SERVICE_PATH := "/root/SurvivalService"

## Owner method names A6 will call when they exist. Any one of them is enough;
## the contract string inside the returned dictionary decides whether it is used.
const SEASON_CLOCK_METHODS := ["get_season_projection", "get_run_season_projection", "get_run_projection"]
const RETURN_DIGEST_METHODS := ["get_offline_return_digest", "get_return_digest"]
const RUN_HISTORY_METHODS := ["get_profile_history_projection", "get_run_history_projection"]
const SITE_CUE_METHODS := ["get_site_cue_projection", "get_signs_projection"]

var _overrides: Dictionary = {}
var _tree: SceneTree


func configure(tree: SceneTree, overrides: Dictionary = {}) -> void:
	_tree = tree
	_overrides = overrides.duplicate(true)


# --- projections ------------------------------------------------------------


func season_clock() -> Dictionary:
	var raw: Variant = _read_override_or_owner("season_clock", SAVE_SERVICE_PATH, SEASON_CLOCK_METHODS)
	return A6ProjectionContract.sanitize_season_clock(raw)


func return_digest() -> Dictionary:
	var raw: Variant = _read_override_or_owner("return_digest", SAVE_SERVICE_PATH, RETURN_DIGEST_METHODS)
	return A6ProjectionContract.sanitize_return_digest(raw)


func run_history() -> Dictionary:
	var raw: Variant = _read_override_or_owner("run_history", SAVE_SERVICE_PATH, RUN_HISTORY_METHODS)
	return A6ProjectionContract.sanitize_run_history(raw)


## D061 cues may come from the world/ecology owner instead of SaveService, so the
## survival service is tried second.
func site_cues() -> Dictionary:
	var raw: Variant = _read_override_or_owner("site_cues", SURVIVAL_SERVICE_PATH, SITE_CUE_METHODS)
	return A6ProjectionContract.sanitize_site_cues(raw)


# --- guidance facts ---------------------------------------------------------
#
# D057 requires the starter guidance to accept actions the player legitimately
# already performed, in any order. These facts are therefore read from committed
# A0 state every time the panel refreshes instead of from a step counter.

## Real, already-committed player activity. Every field is either a count A0 owns
## or zero; `available` says whether the survival block could be read at all.
func guidance_facts() -> Dictionary:
	var facts := {
		"available": false,
		"reason": "survival_state_missing",
		"materials": 0,
		"structures": 0,
		"bed": false,
		"storage": false,
		"recipes": 0,
		"player_level": 1,
		"deaths": 0,
	}
	var override: Variant = _overrides.get("guidance_facts", null)
	if override != null:
		var injected: Variant = _call_override(override)
		if injected is Dictionary:
			return _merge_facts(facts, injected as Dictionary)
	var survival := _node(SURVIVAL_SERVICE_PATH)
	if survival == null:
		return facts
	facts["available"] = true
	facts["reason"] = ""
	facts["materials"] = _survival_material_total(survival)
	facts["structures"] = int(survival.call(&"structure_count")) if survival.has_method(&"structure_count") else 0
	var pieces := _structure_pieces(survival)
	facts["bed"] = pieces.has("bed_wood")
	facts["storage"] = pieces.has("chest_wood")
	var document := _call_dict(survival, &"document")
	var knowledge: Variant = document.get("knowledge", {})
	if knowledge is Dictionary:
		var recipes: Variant = (knowledge as Dictionary).get("recipes", {})
		if recipes is Dictionary:
			facts["recipes"] = (recipes as Dictionary).size()
	var counters: Variant = document.get("counters", {})
	if counters is Dictionary:
		facts["deaths"] = int((counters as Dictionary).get("deaths", 0))
	var save := _node(SAVE_SERVICE_PATH)
	if save != null and save.has_method(&"get_player_progression_snapshot"):
		var progression: Dictionary = save.call(&"get_player_progression_snapshot")
		facts["player_level"] = maxi(1, int(progression.get("player_level", 1)))
	return facts


func _survival_material_total(survival: Node) -> int:
	if not survival.has_method(&"inventory_totals"):
		return 0
	var totals_value: Variant = survival.call(&"inventory_totals")
	if not totals_value is Dictionary:
		return 0
	var total := 0
	for quantity: Variant in (totals_value as Dictionary).values():
		if quantity is int or quantity is float:
			total += maxi(0, int(quantity))
	return total


func _structure_pieces(survival: Node) -> Dictionary:
	var pieces := {}
	if not survival.has_method(&"structures"):
		return pieces
	var structures_value: Variant = survival.call(&"structures")
	if not structures_value is Dictionary:
		return pieces
	for record_value: Variant in (structures_value as Dictionary).values():
		if record_value is Dictionary:
			pieces[String((record_value as Dictionary).get("piece", ""))] = true
	return pieces


func _merge_facts(facts: Dictionary, injected: Dictionary) -> Dictionary:
	var merged := facts.duplicate(true)
	merged["available"] = bool(injected.get("available", true))
	merged["reason"] = String(injected.get("reason", ""))
	for key: String in ["materials", "structures", "recipes", "player_level", "deaths"]:
		if injected.has(key) and (injected[key] is int or injected[key] is float):
			merged[key] = maxi(0, int(injected[key]))
	merged["player_level"] = maxi(1, int(merged["player_level"]))
	for key: String in ["bed", "storage"]:
		if injected.has(key):
			merged[key] = bool(injected[key])
	return merged


# --- plumbing ---------------------------------------------------------------


func _read_override_or_owner(override_key: String, service_path: String, methods: Array) -> Variant:
	var override: Variant = _overrides.get(override_key, null)
	if override != null:
		var value: Variant = _call_override(override)
		if value != null:
			return value
	var service := _node(service_path)
	if service == null:
		return null
	for method: String in methods:
		if not service.has_method(method):
			continue
		var result: Variant = service.call(method)
		if result is Dictionary:
			return result
	return null


func _call_override(override: Variant) -> Variant:
	if override is Callable:
		var callable: Callable = override
		if callable.is_valid():
			return callable.call()
		return null
	if override is Dictionary:
		return override
	return null


func _node(path: String) -> Node:
	if _tree == null or _tree.root == null:
		return null
	return _tree.root.get_node_or_null(path)


func _call_dict(target: Node, method: StringName) -> Dictionary:
	if not target.has_method(method):
		return {}
	var value: Variant = target.call(method)
	return value if value is Dictionary else {}
