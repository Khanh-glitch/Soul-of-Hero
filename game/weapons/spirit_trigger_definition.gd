@tool
class_name SpiritTriggerDefinition
extends Resource

const EVENT_HAND_ATTACK_INSTANCE_CREATED := &"hand_attack_instance_created"
const EVENT_HAND_SKILL_RESOLVED := &"hand_skill_resolved"
const EVENT_DASH_STARTED := &"dash_started"
const EVENT_DASH_COMPLETED := &"dash_completed"

@export var trigger_id: StringName
@export var confirmed_event: StringName
@export_multiline var description: String
@export_range(1, 99, 1) var required_count: int = 1
@export_range(0.01, 99.0, 0.01) var progress_per_event: float = 1.0
@export var pause_and_preserve_while_in_hand: bool = true
@export var reset_progress_after_action: bool = true
@export var deduplicate_per_confirmed_event: bool = true
@export var required_context_key: StringName
@export var require_nonzero_vector: bool = false
@export var require_truthy_context_value: bool = false
@export var deduplication_context_key: StringName


func accepts(event_name: StringName, context: Dictionary) -> bool:
	if event_name != confirmed_event:
		return false
	if not required_context_key.is_empty() and not context.has(required_context_key):
		return false
	if require_truthy_context_value and not bool(context.get(required_context_key, false)):
		return false
	if require_nonzero_vector:
		var raw_vector: Variant = context.get(required_context_key, Vector2.ZERO)
		if not raw_vector is Vector2 or (raw_vector as Vector2).is_zero_approx():
			return false
	return true


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if trigger_id.is_empty():
		errors.append("Spirit trigger ID is required.")
	if confirmed_event.is_empty():
		errors.append("Spirit confirmed event is required.")
	if required_count < 1:
		errors.append("Spirit required count must be at least one.")
	if require_nonzero_vector and required_context_key.is_empty():
		errors.append("A vector context key is required when a non-zero vector is mandatory.")
	if require_truthy_context_value and required_context_key.is_empty():
		errors.append("A context key is required when a truthy value is mandatory.")
	return errors
