extends RefCounted
## A6 request-shape adapter for the existing A0 selective-storage surface.
## It deliberately does not call SurvivalService or SaveService: A0's chest
## panel owns reach/death validation, transaction IDs, and atomic commits.
## A production host must not treat this shape check as authorization.

const INTENT_SCHEMA := "soh.ui.intent.v2"
const INSTANCE_PREFIX := "soh_i_"


## Canonicalizes the A6 planner's request for an A0-owned host. The accepted
## result is a command description only; it is not permission to mutate.
static func normalize_intent(action: String, target_id: String, intent: Dictionary) -> Dictionary:
	if String(intent.get("schema", "")) != INTENT_SCHEMA or action != "transfer":
		return _rejected("Unsupported storage request.")
	var request_value: Variant = intent.get("request_id", null)
	if not request_value is String or not _valid_request_id(String(request_value)):
		return _rejected("The transfer request could not be identified.")
	var request_id := String(request_value)
	var container_value: Variant = intent.get("container_id", null)
	var projected_item_value: Variant = intent.get("item_id", null)
	var stack_key_value: Variant = intent.get("stack_key", null)
	var revision_value: Variant = intent.get("revision", null)
	var direction_value: Variant = intent.get("direction", null)
	var container_id := String(container_value).strip_edges()
	var item_id := target_id.strip_edges().to_lower()
	var projected_item_id := String(projected_item_value).strip_edges().to_lower()
	var stack_key := String(stack_key_value).strip_edges()
	var revision := String(revision_value).strip_edges()
	var sequence: Variant = intent.get("sequence", null)
	var direction := String(direction_value)
	var amount: Variant = intent.get("amount", null)
	if (
		not container_value is String
		or not projected_item_value is String
		or not stack_key_value is String
		or not revision_value is String
		or not direction_value is String
		or container_id.is_empty()
		or container_id.length() > 128
		or not _valid_item_id(item_id)
		or projected_item_id != item_id
		or stack_key.is_empty()
		or stack_key.length() > 128
		or revision.is_empty()
		or revision.length() > 128
		or not sequence is int
		or int(sequence) < 0
		or item_id.begins_with(INSTANCE_PREFIX)
		or item_id.contains("#")
		or not amount is int
		or int(amount) < 1
		or int(amount) > 1000000
		or direction not in ["deposit", "withdraw"]
	):
		return _rejected("Choose a stackable item, exact item ID, and positive whole quantity.")
	return {
		"status": "validated_for_a0_host",
		"request_id": request_id,
		"container_id": container_id,
		"item_id": item_id,
		"direction": direction,
		"amount": int(amount),
		"transaction_owner": "A0 SaveService / SurvivalService",
		"context_owner": "A0 ChestInventoryPanel",
		"mutated": false,
		"message":
		"Shape validated only; A0 must revalidate context and execute the authoritative transfer.",
	}


static func _valid_request_id(value: String) -> bool:
	if value.is_empty() or value.length() > 40:
		return false
	for index in value.length():
		var character := value.substr(index, 1).to_lower()
		if "abcdefghijklmnopqrstuvwxyz0123456789_-".find(character) < 0:
			return false
	return true


static func _valid_item_id(value: String) -> bool:
	if value.is_empty() or value.length() > 64 or "abcdefghijklmnopqrstuvwxyz".find(value.substr(0, 1)) < 0:
		return false
	for index in value.length():
		var character := value.substr(index, 1)
		if "abcdefghijklmnopqrstuvwxyz0123456789_".find(character) < 0:
			return false
	return true


static func _rejected(message: String) -> Dictionary:
	return {"status": "rejected", "mutated": false, "message": message}
