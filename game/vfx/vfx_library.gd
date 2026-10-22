@tool
class_name VfxLibrary
extends Resource

## The one place that lists every reusable VFX profile.  Add a VfxDefinition
## here, give it a unique ID, and it is available to existing gameplay calls.

@export var library_id: StringName = &"soul_of_hero_vfx"
@export var profiles: Array[VfxDefinition] = []


func find(effect_id: StringName) -> VfxDefinition:
	for profile: VfxDefinition in profiles:
		if profile != null and profile.effect_id == effect_id:
			return profile
	return null


func has_effect(effect_id: StringName) -> bool:
	return find(effect_id) != null


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if library_id.is_empty():
		errors.append("VFX library ID is required.")
	if profiles.is_empty():
		errors.append("VFX library must contain at least one profile.")
	var seen := {}
	for profile: VfxDefinition in profiles:
		if profile == null:
			errors.append("VFX library contains an empty profile slot.")
			continue
		if seen.has(profile.effect_id):
			errors.append("Duplicate VFX ID: %s." % profile.effect_id)
		seen[profile.effect_id] = true
		for error: String in profile.get_validation_errors():
			errors.append("%s: %s" % [profile.effect_id, error])
	return errors
