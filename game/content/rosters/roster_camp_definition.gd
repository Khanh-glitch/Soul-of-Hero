@tool
class_name RosterCampDefinition
extends Resource

const RosterCampMember = preload("res://game/content/rosters/roster_camp_member.gd")

## Map authoring input for the resolver. It intentionally contains no world
## position, marker, room, or scene dependency.

@export var camp_id: StringName
@export var members: Array[RosterCampMember] = []


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, camp_id, "Roster camp ID")
	if members.is_empty():
		errors.append("Roster camp must contain at least one member allocation.")
	var seen_entry_ids := {}
	for index: int in members.size():
		var member := members[index]
		if member == null:
			errors.append("Roster camp members[%d] cannot be null." % index)
			continue
		for child_error: String in member.get_validation_errors():
			errors.append("members[%d]: %s" % [index, child_error])
		if seen_entry_ids.has(member.entry_id):
			errors.append("Roster camp contains duplicate entry ID '%s'." % member.entry_id)
		else:
			seen_entry_ids[member.entry_id] = true
	return errors
