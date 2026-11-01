extends Node
## Narrow composition port for a pinned A3 adapter. Not a save or inventory.
## This runs trusted game code in-process, not a sandbox against hostile scripts.
var _owner_save: Node
var _adapter: RefCounted
var _capability: RefCounted


func bind(save: Node, adapter: RefCounted, capability: RefCounted) -> void:
	_owner_save = save
	_adapter = adapter
	_capability = capability


func transact_once(key: String, mutator: Callable, metadata: Dictionary = {}) -> bool:
	# Godot 4.7 self-capturing lambdas report their bound object. A callable
	# authored by a UI/test cannot impersonate the configured A3 instance.
	if not mutator.is_valid() or mutator.get_object() != _adapter:
		return false
	return bool(_owner_save.call(&"_economy_transact_once", _capability, _adapter, key, mutator, metadata))


func add_items_to_candidate(candidate: Dictionary, id: String, kind: String, quantity: int, metadata: Dictionary = {}) -> bool:
	return bool(_owner_save.call(&"_economy_add_to_candidate", _capability, candidate, id, kind, quantity, metadata))


func remove_items_from_candidate(candidate: Dictionary, id: String, quantity: int) -> bool:
	return bool(_owner_save.call(&"_economy_remove_from_candidate", _capability, candidate, id, quantity))


func get_snapshot() -> Dictionary:
	return _owner_save.call(&"get_snapshot")


func get_inventory_stacks() -> Dictionary:
	return _owner_save.call(&"get_inventory_stacks")


func is_transaction_applied(key: String) -> bool:
	return bool(_owner_save.call(&"is_transaction_applied", key))
