class_name PoiAuthorityFixture
extends Node

## TEST FIXTURE ONLY. Never install as an autoload or use as a production economy.
## Every fake action cost/reward/timer is resolved from tests/fixtures, never from
## the NativePoiSite request. This is not A0, A3, SaveService, or a live receipt.

const ITEM_CATALOG_PATH := "res://data/survival/world_content/catalog_candidates.fixture.json"
const ACTION_CATALOG_PATH := (
	"res://tests/fixtures/survival/world_content/" + "a8_native_poi_action_catalog.fixture.json"
)
const CONTRACT_PATH := "res://data/survival/world_content/interaction_contract.v3.json"
const ALLOWED_INTENT_FIELDS := [
	"contract_id",
	"contract_version",
	"intent_id",
	"world_id",
	"run_id",
	"run_epoch",
	"phase_id",
	"observed_phase_projection_revision",
	"source_id",
	"site_instance_id",
	"object_id",
	"action_id",
	"claim_id",
	"observed_projection_revision",
	"actor_local_position",
	"actor_facing"
]

var interrupt_next_commit := false
var force_bag_full := false
var _fixture_items: Dictionary = {}
var _fixture_action_catalog: Dictionary = {}
var _snapshot: Dictionary = {}
var _required_intent_fields: Array[String] = []
var _require_a3_approval := false


func configure(seed_snapshot: Dictionary = {}) -> void:
	_require_a3_approval = false
	var item_document: Variant = JSON.parse_string(FileAccess.get_file_as_string(ITEM_CATALOG_PATH))
	_fixture_items = item_document.get("items", {}) if item_document is Dictionary else {}
	var action_document: Variant = JSON.parse_string(
		FileAccess.get_file_as_string(ACTION_CATALOG_PATH)
	)
	_fixture_action_catalog = action_document if action_document is Dictionary else {}
	var fixture_bindings: Variant = _fixture_action_catalog.get("a3_approved_bindings", {})
	if (
		_fixture_action_catalog.get("schema") != "soh.a8.test_only_action_catalog.v1"
		or not _fixture_action_catalog.get("fixture_only", false)
		or not fixture_bindings is Dictionary
		or not fixture_bindings.is_empty()
	):
		push_error(
			"PoiAuthorityFixture requires the explicit fixture-only catalog with no A3 bindings"
		)
		_fixture_action_catalog = {}
	var contract_document: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONTRACT_PATH))
	_required_intent_fields.clear()
	if contract_document is Dictionary:
		for field: String in contract_document.get("intent_required_fields", []):
			_required_intent_fields.append(field)
	if seed_snapshot.is_empty():
		_snapshot = {
			"schema_version": 1,
			"projection_revision": 0,
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
	if not _snapshot.has("projection_revision"):
		_snapshot["projection_revision"] = 0


func configure_unapproved_production_probe(seed_snapshot: Dictionary = {}) -> void:
	# Negative test mode only. It models the current no-A3-binding condition; it
	# never commits and is not an A0 implementation.
	configure(seed_snapshot)
	_require_a3_approval = true


func has_capability(capability: String) -> bool:
	return _snapshot.get("capabilities", []).has(capability)


func set_capabilities(capabilities: Array[String]) -> void:
	if _snapshot.get("capabilities", []) == capabilities:
		return
	_snapshot["capabilities"] = capabilities.duplicate()
	_increment_projection_revision()


func advance_time(seconds: float) -> void:
	var elapsed := maxf(0.0, seconds)
	if elapsed <= 0.0:
		return
	_snapshot["clock_seconds"] = float(_snapshot.get("clock_seconds", 0.0)) + elapsed
	_increment_projection_revision()


func _increment_projection_revision() -> void:
	_snapshot["projection_revision"] = int(_snapshot.get("projection_revision", 0)) + 1


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
		"source_id": site_id,
		"projection_revision": int(_snapshot.get("projection_revision", 0)),
		"site_state": _snapshot.get("site_state", {}).get(site_id, {}).duplicate(true),
		"claim_generation": _snapshot.get("claim_generation", {}).get(site_id, {}).duplicate(true),
		"capabilities": _snapshot.get("capabilities", []).duplicate(),
		"ready_actions": ready_actions,
		"resource_ready_at": resource_ready_at,
		"clock_seconds": float(_snapshot.get("clock_seconds", 0.0))
	}


# gdlint: disable=max-returns
func _has_meaningful_state_value(site_state: Dictionary, state_key: String) -> bool:
	if not site_state.has(state_key):
		return false
	var value: Variant = site_state[state_key]
	if value == null:
		return false
	if value is bool:
		return bool(value)
	if value is String:
		return not value.strip_edges().is_empty()
	return false


func submit_intent(intent: Dictionary) -> Dictionary:
	var intent_id := str(intent.get("intent_id", ""))
	if not bool(_fixture_action_catalog.get("fixture_only", false)):
		return _reject(intent_id, "The test-only action catalog is missing its fixture guard.")
	for field: String in _required_intent_fields:
		if not intent.has(field):
			return _reject(intent_id, "Intent is missing neutral identity field: %s" % field)
	for field: Variant in intent.keys():
		if not ALLOWED_INTENT_FIELDS.has(str(field)):
			return _reject(intent_id, "Non-neutral client field is forbidden: %s" % str(field))
	if (
		str(intent.get("contract_id", "")) != "soh.native_poi.intent.v3"
		or int(intent.get("contract_version", 0)) != 3
	):
		return _reject(intent_id, "Unsupported interaction contract; v3 is required.")
	var source_id := str(intent.get("source_id", ""))
	var object_id := str(intent.get("object_id", ""))
	var action_id := str(intent.get("action_id", ""))
	var claim_id := str(intent.get("claim_id", ""))
	var run_id := str(intent.get("run_id", ""))
	var site_instance_id := str(intent.get("site_instance_id", ""))
	var phase_id := str(intent.get("phase_id", ""))
	var expected_id := (
		"%s|%s|%s|%s|%s|%s|%d|%s|%d|%d"
		% [
			source_id,
			object_id,
			action_id,
			claim_id,
			run_id,
			site_instance_id,
			int(intent.get("run_epoch", -1)),
			phase_id,
			int(intent.get("observed_phase_projection_revision", -1)),
			int(intent.get("observed_projection_revision", -1))
		]
	)
	if (
		source_id.is_empty()
		or object_id.is_empty()
		or action_id.is_empty()
		or claim_id.is_empty()
		or run_id.is_empty()
		or site_instance_id.is_empty()
		or phase_id.is_empty()
		or typeof(intent.get("run_epoch", null)) != TYPE_INT
		or typeof(intent.get("observed_phase_projection_revision", null)) != TYPE_INT
		or typeof(intent.get("actor_local_position", null)) != TYPE_VECTOR2
		or typeof(intent.get("actor_facing", null)) != TYPE_VECTOR2
		or intent_id != expected_id
	):
		return _reject(intent_id, "Invalid neutral identity, A0 run context, or physical approach.")
	var observed_revision: Variant = intent.get("observed_projection_revision", null)
	if typeof(observed_revision) != TYPE_INT:
		return _reject(intent_id, "Observed owner revision must be an integer.")
	if int(observed_revision) != int(_snapshot.get("projection_revision", 0)):
		return _reject(intent_id, "Stale owner revision; refresh the neutral action request.")
	if _require_a3_approval:
		var approvals: Dictionary = _fixture_action_catalog.get("a3_approved_bindings", {})
		if not approvals.has("%s|%s" % [source_id, action_id]):
			return _reject(
				intent_id, "No A3-approved production binding exists for this site/action."
			)
		return _reject(intent_id, "This test fixture cannot commit production-authorized actions.")
	var site_actions: Dictionary = _fixture_action_catalog.get("actions", {}).get(source_id, {})
	var action_value: Variant = site_actions.get(action_id, null)
	if not action_value is Dictionary:
		return _reject(intent_id, "The fixture catalog has no exact source/action entry.")
	var action: Dictionary = action_value
	if str(action.get("object_id", "")) != object_id:
		return _reject(
			intent_id, "Object identity does not match the test-only source/action binding."
		)
	var claim_policy := str(action.get("claim_policy", ""))
	if claim_policy != "once" and claim_policy != "replenishable":
		return _reject(intent_id, "Fixture action policy is invalid; no transaction was made.")
	var generation: Dictionary = _snapshot.get("claim_generation", {}).get(source_id, {})
	var expected_claim := (
		"%s/%s/%s/g%d" % [source_id, object_id, action_id, int(generation.get(object_id, 0))]
	)
	if claim_id != expected_claim:
		return _reject(
			intent_id, "Stale or foreign claim identity; use the owner-projected generation."
		)
	if _snapshot.get("claims", []).has(claim_id):
		return _reject(intent_id, "This claim was already committed.")
	for capability: String in action.get("requires_capabilities", []):
		if not has_capability(capability):
			return _reject(intent_id, "Required capability is not owned.")
	var site_state: Dictionary = _snapshot.get("site_state", {}).get(source_id, {})
	for state_key: String in action.get("required_state", []):
		if not _has_meaningful_state_value(site_state, state_key):
			return _reject(intent_id, "The owner state does not meet this action prerequisite.")
	var required_values: Dictionary = action.get("required_state_values", {})
	for state_key: String in required_values:
		if not required_values[state_key].has(site_state.get(state_key, null)):
			return _reject(intent_id, "The owner state does not meet the safe route requirement.")
	var group := str(action.get("choice_group", ""))
	if not group.is_empty() and site_state.has(group):
		return _reject(intent_id, "A different site choice has already been committed.")
	if claim_policy == "replenishable":
		var wait_until := float(
			_snapshot.get("cooldown_until", {}).get(source_id, {}).get(object_id, 0.0)
		)
		if float(_snapshot.get("clock_seconds", 0.0)) < wait_until:
			return _reject(intent_id, "The work face is spent; return when it has recovered.")
	var costs: Dictionary = action.get("costs", {})
	var rewards: Dictionary = action.get("rewards", {})
	for item_id: String in costs.keys() + rewards.keys():
		if not _fixture_items.has(item_id):
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
	if claim_policy == "replenishable" and float(action.get("cooldown_seconds", 0.0)) <= 0.0:
		return _reject(intent_id, "Fixture replenishable action lacks a test-only interval.")

	# Crash injection is before the single fixture commit. Retrying the same
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
	for key: String in action.get("state_delta", {}):
		next_site_state[key] = action.state_delta[key]
	site_states[source_id] = next_site_state
	_snapshot["site_state"] = site_states
	var claims: Array = _snapshot.get("claims", [])
	claims.append(claim_id)
	_snapshot["claims"] = claims
	var generations: Dictionary = _snapshot.get("claim_generation", {})
	var next_generation: Dictionary = generations.get(source_id, {}).duplicate(true)
	if claim_policy == "replenishable":
		next_generation[object_id] = int(next_generation.get(object_id, 0)) + 1
		var cooldowns: Dictionary = _snapshot.get("cooldown_until", {})
		var site_cooldowns: Dictionary = cooldowns.get(source_id, {}).duplicate(true)
		site_cooldowns[object_id] = (
			float(_snapshot.clock_seconds) + float(action.get("cooldown_seconds", 0.0))
		)
		cooldowns[source_id] = site_cooldowns
		_snapshot["cooldown_until"] = cooldowns
	generations[source_id] = next_generation
	_snapshot["claim_generation"] = generations
	var unlocks: Dictionary = _snapshot.get("unlock_at", {})
	var site_unlocks: Dictionary = unlocks.get(source_id, {}).duplicate(true)
	for unlock_id: String in action.get("unlock_actions", {}):
		site_unlocks[unlock_id] = (
			float(_snapshot.get("clock_seconds", 0.0)) + float(action.unlock_actions[unlock_id])
		)
	unlocks[source_id] = site_unlocks
	_snapshot["unlock_at"] = unlocks
	_increment_projection_revision()
	return {
		"intent_id": intent_id,
		"status": "committed",
		"feedback": "The world changed. (S2 test fixture; not a live-game receipt.)"
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
