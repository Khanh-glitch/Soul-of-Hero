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
	var request_id := String(intent.get("request_id", ""))
	if not _valid_request_id(request_id):
		return _rejected("The transfer request could not be identified.")
	var container_id := String(intent.get("container_id", ""))
	var item_id := target_id.strip_edges().to_lower()
	var projected_item_id := String(intent.get("item_id", item_id)).strip_edges().to_lower()
	var direction := String(intent.get("direction", ""))
	var amount: Variant = intent.get("amount", null)
	if (
		container_id.is_empty()
		or item_id.is_empty()
		or projected_item_id != item_id
		or item_id.begins_with(INSTANCE_PREFIX)
		or item_id.contains("#")
		or not amount is int
		or int(amount) < 1
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


static func _rejected(message: String) -> Dictionary:
	return {"status": "rejected", "mutated": false, "message": message}
