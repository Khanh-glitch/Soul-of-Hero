@tool
class_name StackItemCatalog
extends Resource

@export var catalog_id: StringName = &"soul_of_hero_stack_items"
@export var items: Array[StackItemDefinition] = []


func find(item_id: StringName) -> StackItemDefinition:
	for item: StackItemDefinition in items:
		if item != null and item.item_id == item_id:
			return item
	return null


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	var seen := {}
	for item: StackItemDefinition in items:
		if item == null:
			errors.append("Item catalog contains an empty slot.")
			continue
		if seen.has(item.item_id):
			errors.append("Duplicate item ID: %s." % item.item_id)
		seen[item.item_id] = true
		for error: String in item.get_validation_errors():
			errors.append("%s: %s" % [item.item_id, error])
	return errors
