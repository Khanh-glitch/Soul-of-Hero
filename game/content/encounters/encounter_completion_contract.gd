@tool
class_name EncounterCompletionContract
extends Resource

## Side-effect contract applied once after required objectives complete.
## reward_transaction_id is mandatory with a reward bundle so SaveService can
## make reward delivery idempotent. Gates are addressed by stable entity IDs.

enum GateAction {
	NONE,
	OPEN,
	UNLOCK,
	ACTIVATE,
}

@export var required_objective_ids: PackedStringArray
@export var gate_action := GateAction.NONE
@export var gate_entity_ids: PackedStringArray
@export var reward_bundle_id: StringName
@export var reward_transaction_id: StringName
@export var granted_feature_ids: PackedStringArray
@export var completion_signal: StringName = &"encounter_completed"
@export var next_encounter_id: StringName


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if required_objective_ids.is_empty():
		errors.append("Encounter completion contract requires at least one objective ID.")
	ContentId.append_duplicate_or_invalid_ids(errors, required_objective_ids, "Completion objective IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, gate_entity_ids, "Completion gate entity IDs")
	ContentId.append_duplicate_or_invalid_ids(errors, granted_feature_ids, "Completion feature IDs")
	match gate_action:
		GateAction.NONE:
			if not gate_entity_ids.is_empty():
				errors.append("Gate entity IDs require a non-NONE gate action.")
		GateAction.OPEN, GateAction.UNLOCK, GateAction.ACTIVATE:
			if gate_entity_ids.is_empty():
				errors.append("Non-NONE gate action requires at least one gate entity ID.")
		_:
			errors.append("Encounter completion gate action is not supported.")
	var has_reward := not reward_bundle_id.is_empty()
	var has_transaction := not reward_transaction_id.is_empty()
	if has_reward != has_transaction:
		errors.append("Reward bundle ID and reward transaction ID must be configured together.")
	if has_reward:
		ContentId.append_if_invalid(errors, reward_bundle_id, "Reward bundle ID")
		ContentId.append_if_invalid_transaction_key(errors, reward_transaction_id, "Reward transaction ID")
	ContentId.append_if_invalid(errors, completion_signal, "Encounter completion signal")
	if not next_encounter_id.is_empty():
		ContentId.append_if_invalid(errors, next_encounter_id, "Next encounter ID")
	return errors
