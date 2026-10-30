class_name PoiAuthorityFixture
extends Node

## TEST FIXTURE ONLY. Never install as an autoload or use as a production economy.
## Its contract intentionally mirrors the boundary A0 must implement: input intent,
## owner validation, atomic commit/reject, owner projection. All inventory here is fake.

const CATALOG_PATH := "res://data/survival/world_content/catalog_candidates.fixture.json"
const CONTRACT_PATH := "res://data/survival/world_content/interaction_contract.v1.json"

var interrupt_next_commit := false
var force_bag_full := false
var _fixture_catalog: Dictionary = {}
var _snapshot: Dictionary = {}
var _required_intent_fields: Array[String] = []


func configure(seed_snapshot: Dictionary = {}) -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CATALOG_PATH))
	_fixture_catalog = parsed.get("items", {}) if parsed is Dictionary else {}
	var contract: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONTRACT_PATH))
	_required_intent_fields.clear()
	if contract is Dictionary:
		for field: String in contract.get("intent_required_fields", []):
			_required_intent_fields.append(field)
	if seed_snapshot.is_empty():
		_snapshot = {
			"schema_version": 1,
			"inventory": {"oak_wood": 2, "stone_chunk": 2, "iron_scrap": 1, "reed_fibre": 1},
			"bag_capacity": 8,
			"site_state": {},
			"claim_generation": {},
			"claims": [],
			"cooldown_until": {},
			"unlock_at": {},
			"clock_seconds": 0.0,
			"capabilities": []
		}
	else:
		_snapshot = seed_snapshot.duplicate(true)


func has_capability(capability: String) -> bool:
	return _snapshot.get("capabilities", []).has(capability)


func set_capabilities(capabilities: Array[String]) -> void:
	_snapshot["capabilities"] = capabilities.duplicate()


func advance_time(seconds: float) -> void:
	_snapshot["clock_seconds"] = float(_snapshot.get("clock_seconds", 0.0)) + maxf(0.0, seconds)


func project_state(site_id: String) -> Dictionary:
	var ready_actions: Array[String] = []
	var site_unlocks: Dictionary = _snapshot.get("unlock_at", {}).get(site_id, {})
	var resource_ready_at: Dictionary = (
		_snapshot.get("cooldown_until", {}).get(site_id, {}).duplicate(true)
	)
	for action_id: String in site_unlocks:
		if float(_snapshot.get("clock_seconds", 0.0)) >= float(site_unlocks[action_id]):
			ready_actions.append(action_id)
	return {
		"schema_version": 1,
		"site_state": _snapshot.get("site_state", {}).get(site_id, {}).duplicate(true),
		"claim_generation": _snapshot.get("claim_generation", {}).get(site_id, {}).duplicate(true),
		"capabilities": _snapshot.get("capabilities", []).duplicate(),
		"ready_actions": ready_actions,
		"resource_ready_at": resource_ready_at,
		"clock_seconds": float(_snapshot.get("clock_seconds", 0.0))
	}


# gdlint: disable=max-returns
func submit_intent(intent: Dictionary) -> Dictionary:
	var intent_id := str(intent.get("intent_id", ""))
	for field: String in _required_intent_fields:
		if not intent.has(field):
			return _reject(intent_id, "Intent is missing contract field: %s" % field)
	if (
		str(intent.get("contract_id", "")) != "soh.native_poi.intent.v1"
		or int(intent.get("contract_version", 0)) != 1
	):
		return _reject(intent_id, "Unsupported interaction contract version.")
	if not bool(intent.get("provisional_test_only", false)):
		return _reject(intent_id, "The test authority refuses non-fixture intents.")
	var source_id := str(intent.get("source_id", ""))
	var object_id := str(intent.get("object_id", ""))
	var action_id := str(intent.get("action_id", ""))
	var claim_id := str(intent.get("claim_id", ""))
	var expected_id := "%s|%s|%s|%s" % [source_id, object_id, action_id, claim_id]
	if (
		source_id.is_empty()
		or object_id.is_empty()
		or action_id.is_empty()
		or claim_id.is_empty()
		or intent_id != expected_id
	):
		return _reject(intent_id, "Invalid or unstable source/object/action/claim identity.")
	if _snapshot.get("claims", []).has(claim_id):
		return _reject(intent_id, "This claim was already committed.")
	for capability: String in intent.get("requires_capabilities", []):
		if not has_capability(capability):
			return _reject(intent_id, "Required capability is not owned.")
	var site_state: Dictionary = _snapshot.get("site_state", {}).get(source_id, {})
	for state_key: String in intent.get("required_state", []):
		if (
			not site_state.has(state_key)
			or site_state[state_key] == false
			or site_state[state_key] == ""
		):
			return _reject(intent_id, "The owner state does not meet this action prerequisite.")
	var required_values: Dictionary = intent.get("required_state_values", {})
	for state_key: String in required_values:
		if not required_values[state_key].has(site_state.get(state_key, null)):
			return _reject(intent_id, "The owner state does not meet the safe route requirement.")
	var group := str(intent.get("choice_group", ""))
	if not group.is_empty() and site_state.has(group):
		return _reject(intent_id, "A different site choice has already been committed.")
	var generation: Dictionary = _snapshot.get("claim_generation", {}).get(source_id, {})
	if str(intent.get("claim_policy", "once")) == "replenishable":
		var wait_until := float(
			_snapshot.get("cooldown_until", {}).get(source_id, {}).get(object_id, 0.0)
		)
		if float(_snapshot.get("clock_seconds", 0.0)) < wait_until:
			return _reject(intent_id, "The work face is spent; return when it has recovered.")
		var expected_claim := (
			"%s/%s/%s/g%d" % [source_id, object_id, action_id, int(generation.get(object_id, 0))]
		)
		if claim_id != expected_claim:
			return _reject(intent_id, "Stale resource cycle; request a fresh owner projection.")

	var costs: Dictionary = intent.get("costs", {})
	var rewards: Dictionary = intent.get("rewards", {})
	for item_id: String in costs.keys() + rewards.keys():
		if not _fixture_catalog.has(item_id):
			return _reject(
				intent_id,
				"Item ID is absent from the S2 candidate fixture; no grant or debit was made."
			)
	for item_id: String in costs:
		var amount := int(costs[item_id])
		if amount <= 0 or int(_snapshot.get("inventory", {}).get(item_id, 0)) < amount:
			return _reject(intent_id, "Not enough material; nothing was spent.")
	if force_bag_full or _would_exceed_bag(rewards):
		return _reject(intent_id, "No room to carry the material; nothing was changed.")

	# Crash injection is before the single atomic owner commit. Retrying the same
	# identity is safe because neither debit nor claim nor world-state was written.
	if interrupt_next_commit:
		interrupt_next_commit = false
		return {
			"intent_id": intent_id,
			"status": "interrupted",
			"reason": "Fixture interrupted before commit; retry is safe."
		}

	for item_id: String in costs:
		_snapshot.inventory[item_id] = (
			int(_snapshot.inventory.get(item_id, 0)) - int(costs[item_id])
		)
	for item_id: String in rewards:
		_snapshot.inventory[item_id] = (
			int(_snapshot.inventory.get(item_id, 0)) + int(rewards[item_id])
		)
	var site_states: Dictionary = _snapshot.get("site_state", {})
	var next_site_state: Dictionary = site_states.get(source_id, {}).duplicate(true)
	for key: String in intent.get("state_delta", {}):
		next_site_state[key] = intent.state_delta[key]
	site_states[source_id] = next_site_state
	_snapshot["site_state"] = site_states
	var claims: Array = _snapshot.get("claims", [])
	claims.append(claim_id)
	_snapshot["claims"] = claims
	var generations: Dictionary = _snapshot.get("claim_generation", {})
	var next_generation: Dictionary = generations.get(source_id, {}).duplicate(true)
	if str(intent.get("claim_policy", "once")) == "replenishable":
		next_generation[object_id] = int(next_generation.get(object_id, 0)) + 1
		var cooldowns: Dictionary = _snapshot.get("cooldown_until", {})
		var site_cooldowns: Dictionary = cooldowns.get(source_id, {}).duplicate(true)
		site_cooldowns[object_id] = (
			float(_snapshot.clock_seconds) + float(intent.get("cooldown_seconds", 0.0))
		)
		cooldowns[source_id] = site_cooldowns
		_snapshot["cooldown_until"] = cooldowns
	generations[source_id] = next_generation
	_snapshot["claim_generation"] = generations
	var unlocks: Dictionary = _snapshot.get("unlock_at", {})
	var site_unlocks: Dictionary = unlocks.get(source_id, {}).duplicate(true)
	for action_id: String in intent.get("unlock_actions", {}):
		site_unlocks[action_id] = (
			float(_snapshot.get("clock_seconds", 0.0)) + float(intent.unlock_actions[action_id])
		)
	unlocks[source_id] = site_unlocks
	_snapshot["unlock_at"] = unlocks
	return {
		"intent_id": intent_id,
		"status": "committed",
		"feedback": "The world changed. (S2 transaction fixture; not a live-game receipt.)"
	}


func snapshot() -> Dictionary:
	return _snapshot.duplicate(true)


func _would_exceed_bag(rewards: Dictionary) -> bool:
	var inventory: Dictionary = _snapshot.get("inventory", {})
	var occupied := 0
	for item_id: String in inventory:
		if int(inventory[item_id]) > 0:
			occupied += 1
	for item_id: String in rewards:
		if int(rewards[item_id]) > 0 and int(inventory.get(item_id, 0)) == 0:
			occupied += 1
	return occupied > int(_snapshot.get("bag_capacity", 0))


func _reject(intent_id: String, reason: String) -> Dictionary:
	return {"intent_id": intent_id, "status": "rejected", "reason": reason}
