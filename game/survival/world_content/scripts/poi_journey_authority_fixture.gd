class_name PoiJourneyAuthorityFixture
extends RefCounted

## A8-only, projection-shaped test fixture for frame-driven pilot journeys.
## It holds site state and owner-projected gates only. It has no inventory,
## currency, save, economy, clock, or production authorization surface.

const REQUIRED_INTENT_FIELDS := [
	"contract_id",
	"contract_version",
	"intent_id",
	"source_id",
	"object_id",
	"action_id",
	"claim_id",
	"observed_projection_revision",
	"actor_local_position",
	"actor_facing",
	"world_id",
	"run_id",
	"run_epoch",
	"phase_id",
	"observed_phase_projection_revision",
	"site_instance_id",
]

const ALLOWED_INTENT_FIELDS := [
	"contract_id",
	"contract_version",
	"intent_id",
	"source_id",
	"object_id",
	"action_id",
	"claim_id",
	"observed_projection_revision",
	"actor_local_position",
	"actor_facing",
	"world_id",
	"run_id",
	"run_epoch",
	"phase_id",
	"observed_phase_projection_revision",
	"site_instance_id",
]

var _definitions: Dictionary = {}
var _capabilities: Array[String] = []
var _ready_actions: Array[String] = []
var _site_states: Dictionary = {}
var _claim_generations: Dictionary = {}
var _projection_revision := 1


func configure(definitions: Dictionary, owner_projection_seed: Dictionary = {}) -> void:
	_definitions = definitions.duplicate(true)
	_capabilities.clear()
	for capability: Variant in owner_projection_seed.get("capabilities", []):
		if typeof(capability) == TYPE_STRING and not _capabilities.has(str(capability)):
			_capabilities.append(str(capability))
	_ready_actions.clear()
	for action_id: Variant in owner_projection_seed.get("ready_actions", []):
		if typeof(action_id) == TYPE_STRING and not _ready_actions.has(str(action_id)):
			_ready_actions.append(str(action_id))
	_site_states = owner_projection_seed.get("site_state", {}).duplicate(true)
	_claim_generations.clear()
	_projection_revision = 1


## Test driver supplies a new owner projection; the A8 pilot cannot call this.
func replace_capabilities(owner_projected_capabilities: Array) -> void:
	var next_capabilities: Array[String] = []
	for capability: Variant in owner_projected_capabilities:
		if typeof(capability) == TYPE_STRING and not next_capabilities.has(str(capability)):
			next_capabilities.append(str(capability))
	if next_capabilities == _capabilities:
		return
	_capabilities = next_capabilities
	_projection_revision += 1


## Test driver supplies a newer site-state projection; this changes no inventory,
## currency, save data, clock, or production authority.
func replace_site_state(source_id: String, owner_projected_state: Dictionary) -> void:
	if source_id.is_empty():
		return
	_site_states[source_id] = owner_projected_state.duplicate(true)
	_projection_revision += 1


func project_state(source_id: String) -> Dictionary:
	return {
		"schema_version": 1,
		"source_id": source_id,
		"projection_revision": _projection_revision,
		"site_state": _site_states.get(source_id, {}).duplicate(true),
		"claim_generation": _claim_generations.get(source_id, {}).duplicate(true),
		"capabilities": _capabilities.duplicate(),
		"ready_actions": _ready_actions.duplicate(),
		"resource_ready_at": {},
		# Schema-required constant placeholder; this fixture never advances time.
		"clock_seconds": 0.0,
	}


## gdlint: disable=max-returns
func submit_intent(intent: Dictionary) -> Dictionary:
	var intent_id := str(intent.get("intent_id", ""))
	for field: String in REQUIRED_INTENT_FIELDS:
		if not intent.has(field):
			return _reject(intent_id, "Journey fixture requires neutral identity: %s" % field)
	for field: Variant in intent.keys():
		if not ALLOWED_INTENT_FIELDS.has(str(field)):
			return _reject(intent_id, "Journey fixture rejects non-neutral field: %s" % field)
	if (
		str(intent.get("contract_id", "")) != "soh.native_poi.intent.v3"
		or int(intent.get("contract_version", 0)) != 3
		or typeof(intent.get("observed_projection_revision", null)) != TYPE_INT
		or int(intent.get("observed_projection_revision", -1)) != _projection_revision
		or typeof(intent.get("run_epoch", null)) != TYPE_INT
		or int(intent.get("run_epoch", -1)) < 0
		or typeof(intent.get("observed_phase_projection_revision", null)) != TYPE_INT
		or int(intent.get("observed_phase_projection_revision", -1)) < 0
		or typeof(intent.get("actor_local_position", null)) != TYPE_VECTOR2
		or typeof(intent.get("actor_facing", null)) != TYPE_VECTOR2
		or str(intent.get("run_id", "")).is_empty()
		or str(intent.get("site_instance_id", "")).is_empty()
		or str(intent.get("phase_id", "")).is_empty()
	):
		return _reject(intent_id, "Invalid or stale owner-projected journey context.")

	var source_id := str(intent.get("source_id", ""))
	var object_id := str(intent.get("object_id", ""))
	var action_id := str(intent.get("action_id", ""))
	var claim_id := str(intent.get("claim_id", ""))
	var expected_intent_id := (
		"%s|%s|%s|%s|%s|%s|%d|%s|%d|%d"
		% [
			source_id,
			object_id,
			action_id,
			claim_id,
			str(intent.get("run_id", "")),
			str(intent.get("site_instance_id", "")),
			int(intent.get("run_epoch", -1)),
			str(intent.get("phase_id", "")),
			int(intent.get("observed_phase_projection_revision", -1)),
			int(intent.get("observed_projection_revision", -1)),
		]
	)
	if intent_id != expected_intent_id:
		return _reject(intent_id, "Neutral intent identity does not match its A0 run context.")
	var definition: Dictionary = _definitions.get(source_id, {})
	if str(intent.get("world_id", "")) != str(definition.get("source", {}).get("world_id", "")):
		return _reject(intent_id, "Journey intent is foreign to the authored source world.")
	var selected_action := _find_action(definition, action_id)
	if selected_action.is_empty() or str(selected_action.get("object_id", "")) != object_id:
		return _reject(intent_id, "No exact A8 site/action identity exists in this fixture.")

	var site_state: Dictionary = _site_states.get(source_id, {}).duplicate(true)
	for capability: String in selected_action.get("requires_capabilities", []):
		if not _capabilities.has(capability):
			return _reject(intent_id, "Required owner-projected capability is absent.")
	for state_key: String in selected_action.get("requires_state", []):
		if not _has_meaningful_value(site_state, state_key):
			return _reject(intent_id, "Required owner-projected site state is absent.")
	var required_values: Dictionary = selected_action.get("requires_state_values", {})
	for state_key: String in required_values:
		if not required_values[state_key].has(site_state.get(state_key, null)):
			return _reject(intent_id, "Required owner-projected site value is absent.")
	if (
		bool(selected_action.get("owner_ready_required", false))
		and not _ready_actions.has(action_id)
	):
		return _reject(intent_id, "Owner projection does not mark this action ready.")
	var choice_group := str(selected_action.get("choice_group", ""))
	if not choice_group.is_empty() and site_state.has(choice_group):
		return _reject(intent_id, "This choice group already has an owner-projected result.")

	var generation: Dictionary = _claim_generations.get(source_id, {}).duplicate(true)
	var expected_claim := (
		"%s/%s/%s/g%d" % [source_id, object_id, action_id, int(generation.get(object_id, 0))]
	)
	if str(intent.get("claim_id", "")) != expected_claim:
		return _reject(intent_id, "Stale or foreign site claim identity.")
	var next_site_state := site_state.duplicate(true)
	for state_key: String in selected_action.get("set_state", {}):
		next_site_state[state_key] = selected_action.set_state[state_key]
	_site_states[source_id] = next_site_state
	var used_claims: Dictionary = _claim_generations.get(source_id, {}).duplicate(true)
	used_claims[object_id] = int(used_claims.get(object_id, 0)) + 1
	_claim_generations[source_id] = used_claims
	_projection_revision += 1
	return {
		"intent_id": intent_id,
		"status": "committed",
		"feedback": "A8 journey projection changed; no live item, currency, or save effect.",
	}


func snapshot() -> Dictionary:
	return {
		"projection_revision": _projection_revision,
		"site_state": _site_states.duplicate(true),
		"claim_generation": _claim_generations.duplicate(true),
		"capabilities": _capabilities.duplicate(),
		"ready_actions": _ready_actions.duplicate(),
	}


func _find_action(definition: Dictionary, action_id: String) -> Dictionary:
	for action: Dictionary in definition.get("choices", []):
		if str(action.get("action_id", "")) == action_id:
			return action.duplicate(true)
	for action: Dictionary in definition.get("actions", []):
		if str(action.get("action_id", "")) == action_id:
			return action.duplicate(true)
	return {}


func _has_meaningful_value(site_state: Dictionary, state_key: String) -> bool:
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


func _reject(intent_id: String, reason: String) -> Dictionary:
	return {"intent_id": intent_id, "status": "rejected", "reason": reason}
