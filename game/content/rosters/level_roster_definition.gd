@tool
class_name LevelRosterDefinition
extends Resource

const LevelRosterEntry = preload("res://game/content/rosters/level_roster_entry.gd")
const EliteSpawnPolicy = preload("res://game/content/rosters/elite_spawn_policy.gd")

## Map-independent combat roster for one campaign slot. Camps and positions are
## authored later; this resource locks exact counts and elite eligibility now.

enum AuthoringStatus {
	DESIGN_LOCKED,
	RUNTIME_READY,
}

const CAMPAIGN_LEVEL_CAPACITY := LevelDefinition.CAMPAIGN_LEVEL_CAPACITY

@export_category("Identity")
@export var roster_id: StringName
@export_range(1, CAMPAIGN_LEVEL_CAPACITY, 1) var campaign_slot := 1
@export var authoring_status := AuthoringStatus.DESIGN_LOCKED
@export_multiline var authoring_notes: String

@export_category("Exact stage composition")
@export var entries: Array[LevelRosterEntry] = []

@export_category("Elite promotion")
@export var elite_policy: EliteSpawnPolicy


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, roster_id, "Level roster ID")
	if campaign_slot < 1 or campaign_slot > CAMPAIGN_LEVEL_CAPACITY:
		errors.append("Level roster campaign slot must stay between 1 and %d." % CAMPAIGN_LEVEL_CAPACITY)
	if authoring_status < AuthoringStatus.DESIGN_LOCKED or authoring_status > AuthoringStatus.RUNTIME_READY:
		errors.append("Level roster authoring status is not supported.")
	if entries.is_empty():
		errors.append("Level roster must contain at least one entry.")

	var seen_entry_ids := {}
	var seen_combatant_ids := {}
	var eligible_count := 0
	for index: int in entries.size():
		var entry := entries[index]
		if entry == null:
			errors.append("Level roster entries[%d] cannot be null." % index)
			continue
		for child_error: String in entry.get_validation_errors():
			errors.append("entries[%d]: %s" % [index, child_error])
		if seen_entry_ids.has(entry.entry_id):
			errors.append("Level roster contains duplicate entry ID '%s'." % entry.entry_id)
		else:
			seen_entry_ids[entry.entry_id] = true
		if seen_combatant_ids.has(entry.combatant_id):
			errors.append("Level roster contains duplicate combatant ID '%s'." % entry.combatant_id)
		else:
			seen_combatant_ids[entry.combatant_id] = true
		if entry.elite_eligible:
			eligible_count += 1

	if elite_policy != null:
		for child_error: String in elite_policy.get_validation_errors():
			errors.append("elite_policy: %s" % child_error)
		if elite_policy.is_enabled() and eligible_count == 0:
			errors.append("Enabled elite policy requires at least one elite-eligible roster entry.")
	return errors


func get_entry(entry_id: StringName) -> LevelRosterEntry:
	for entry: LevelRosterEntry in entries:
		if entry != null and entry.entry_id == entry_id:
			return entry
	return null


func get_entry_for_combatant(combatant_id: StringName) -> LevelRosterEntry:
	for entry: LevelRosterEntry in entries:
		if entry != null and entry.combatant_id == combatant_id:
			return entry
	return null


func get_count_for(combatant_id: StringName) -> int:
	var entry := get_entry_for_combatant(combatant_id)
	return entry.count if entry != null else 0


func get_total_count() -> int:
	var total := 0
	for entry: LevelRosterEntry in entries:
		if entry != null:
			total += entry.count
	return total
