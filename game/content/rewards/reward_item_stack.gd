@tool
class_name RewardItemStack
extends Resource

## One authored stack inside a reward bundle.
##
## Equipment rolls will eventually need unique instance IDs and affix data. This
## compact contract deliberately covers only stackable progression items so the
## first meta-loop does not paint the future equipment system into a corner.

enum ItemKind {
	MATERIAL,
	CONSUMABLE,
	BLUEPRINT,
	KEY_ITEM,
}

const MAX_QUANTITY := 999999

@export var item_id: StringName
@export var item_kind := ItemKind.MATERIAL
@export_range(1, MAX_QUANTITY, 1) var quantity := 1
## Preferred authoring route: drag a StackItemDefinition here.  Legacy rewards
## remain valid with the fields above, so old saves/content do not need a
## migration.
@export var item_definition: StackItemDefinition


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, get_effective_item_id(), "Reward item ID")
	if item_definition != null:
		for definition_error: String in item_definition.get_validation_errors():
			errors.append("Item definition: %s" % definition_error)
	if item_definition == null and item_kind not in ItemKind.values():
		errors.append("Reward item kind is unsupported.")
	if quantity < 1 or quantity > MAX_QUANTITY:
		errors.append("Reward item quantity must be between 1 and %d." % MAX_QUANTITY)
	return errors


func get_kind_id() -> StringName:
	if item_definition != null:
		return StringName(item_definition.item_kind)
	match item_kind:
		ItemKind.MATERIAL:
			return &"material"
		ItemKind.CONSUMABLE:
			return &"consumable"
		ItemKind.BLUEPRINT:
			return &"blueprint"
		ItemKind.KEY_ITEM:
			return &"key_item"
		_:
			return &"invalid"


func get_effective_item_id() -> StringName:
	return item_definition.item_id if item_definition != null else item_id


func get_presentation_metadata() -> Dictionary:
	return item_definition.to_inventory_metadata() if item_definition != null else {}


func to_summary() -> Dictionary:
	return {
		"item_id": String(get_effective_item_id()),
		"kind": String(get_kind_id()),
		"quantity": quantity,
	}
