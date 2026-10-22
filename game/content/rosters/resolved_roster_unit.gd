class_name ResolvedRosterUnit
extends RefCounted

const LevelRosterEntry = preload("res://game/content/rosters/level_roster_entry.gd")
const EliteModifierDefinition = preload("res://game/content/rosters/elite_modifier_definition.gd")

var serial_id: StringName
var camp_id: StringName
var entry_id: StringName
var combatant_id: StringName
var combatant_kind := LevelRosterEntry.CombatantKind.ENEMY
var is_elite := false
var elite_modifier: EliteModifierDefinition
