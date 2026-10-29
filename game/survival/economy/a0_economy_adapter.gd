extends "res://game/survival/economy/vendor/a3_economy_service.gd"
## A0-owned production composition shim over the unmodified A3 86dc2195 source. A3's generic
## _transact accepts an arbitrary callable. Only callbacks authored by the
## pinned adapter itself may cross into the SaveService capability port.
const PINNED_BASE = preload("res://game/survival/economy/vendor/a3_economy_service.gd")

func _transact(operation: String, event_id: String, payload: Dictionary, mutator: Callable) -> Dictionary:
	var owner := mutator.get_object()
	if not mutator.is_valid() or (owner != self and owner != PINNED_BASE and owner != get_script()):
		return {"ok": false, "reason": "untrusted_economy_mutator", "duplicate": false}
	return super._transact(operation, event_id, payload, mutator)
