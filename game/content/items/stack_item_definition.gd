@tool
class_name StackItemDefinition
extends Resource

## Presentation and inventory rules for a stackable item.  Reward bundles drag
## this resource into RewardItemStack, so designers choose a real item instead
## of repeatedly typing an ID and losing its name/icon metadata.

@export_category("Identity")
@export var item_id: StringName
@export var display_name := ""
@export_multiline var description := ""
@export_enum("Material:material", "Consumable:consumable", "Blueprint:blueprint", "Key item:key_item") var item_kind := "material"

@export_category("Presentation")
@export var icon: Texture2D
@export var rarity_id: StringName = &"normal"

@export_category("Inventory")
@export_range(1, 999999, 1) var stack_capacity := 999999
@export_multiline var authoring_notes := ""

@export_category("Hero progression")
## Positive only for consumable stones that grant XP to one chosen Hero.
## The SaveService applies the campaign's enemy-level hard cap atomically with
## consumption, so this value can never create banked XP above the cap.
@export_range(0, 1000000, 1) var hero_xp_value := 0


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if item_id.is_empty():
		errors.append("Item ID is required.")
	if display_name.strip_edges().is_empty():
		errors.append("Item display name is required.")
	if item_kind not in ["material", "consumable", "blueprint", "key_item"]:
		errors.append("Item kind is unsupported.")
	if icon == null:
		errors.append("Item icon is required.")
	if stack_capacity < 1:
		errors.append("Item stack capacity must be at least one.")
	if hero_xp_value > 0 and item_kind != "consumable":
		errors.append("Hero XP items must use the consumable item kind.")
	return errors


func to_inventory_metadata() -> Dictionary:
	return {
		"item_id": String(item_id),
		"kind": item_kind,
		"display_name": display_name,
		"icon_path": icon.resource_path if icon != null else "",
		"rarity": String(rarity_id),
		"hero_xp_value": hero_xp_value,
	}
