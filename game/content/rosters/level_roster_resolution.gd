class_name LevelRosterResolution
extends RefCounted

const ResolvedRosterUnit = preload("res://game/content/rosters/resolved_roster_unit.gd")

var roster_id: StringName
var seed := 0
var units: Array[ResolvedRosterUnit] = []
var errors := PackedStringArray()


func is_valid() -> bool:
	return errors.is_empty()


func get_total_count() -> int:
	return units.size()


func count_units(combatant_id: StringName) -> int:
	var total := 0
	for unit: ResolvedRosterUnit in units:
		if unit.combatant_id == combatant_id:
			total += 1
	return total


func count_elites(combatant_id: StringName = &"") -> int:
	var total := 0
	for unit: ResolvedRosterUnit in units:
		if unit.is_elite and (combatant_id.is_empty() or unit.combatant_id == combatant_id):
			total += 1
	return total


func get_signature() -> String:
	var tokens := PackedStringArray()
	for unit: ResolvedRosterUnit in units:
		tokens.append("%s:%s:%s" % [unit.serial_id, unit.camp_id, "elite" if unit.is_elite else "normal"])
	return "|".join(tokens)
