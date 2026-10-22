class_name LevelRosterResolver
extends RefCounted

const LevelRosterDefinition = preload("res://game/content/rosters/level_roster_definition.gd")
const LevelRosterEntry = preload("res://game/content/rosters/level_roster_entry.gd")
const RosterCampDefinition = preload("res://game/content/rosters/roster_camp_definition.gd")
const RosterCampMember = preload("res://game/content/rosters/roster_camp_member.gd")
const LevelRosterResolution = preload("res://game/content/rosters/level_roster_resolution.gd")
const ResolvedRosterUnit = preload("res://game/content/rosters/resolved_roster_unit.gd")
const EliteModifierDefinition = preload("res://game/content/rosters/elite_modifier_definition.gd")

## Deterministically resolves camp rolls while preserving exact stage counts.


static func resolve(
	roster: LevelRosterDefinition,
	camps: Array[RosterCampDefinition],
	seed: int
) -> LevelRosterResolution:
	var result := LevelRosterResolution.new()
	result.seed = seed
	if roster == null:
		result.errors.append("Roster is required.")
		return result
	result.roster_id = roster.roster_id
	for error: String in roster.get_validation_errors():
		result.errors.append("roster: %s" % error)
	if camps.is_empty():
		result.errors.append("At least one camp allocation is required.")
		return result

	var seen_camp_ids := {}
	var allocated_by_entry := {}
	for camp_index: int in camps.size():
		var camp := camps[camp_index]
		if camp == null:
			result.errors.append("camps[%d] cannot be null." % camp_index)
			continue
		for error: String in camp.get_validation_errors():
			result.errors.append("camps[%d]: %s" % [camp_index, error])
		if seen_camp_ids.has(camp.camp_id):
			result.errors.append("Duplicate roster camp ID '%s'." % camp.camp_id)
		else:
			seen_camp_ids[camp.camp_id] = true
		for member: RosterCampMember in camp.members:
			if member == null:
				continue
			var entry := roster.get_entry(member.entry_id)
			if entry == null:
				result.errors.append("Camp '%s' references unknown roster entry '%s'." % [camp.camp_id, member.entry_id])
				continue
			allocated_by_entry[member.entry_id] = int(allocated_by_entry.get(member.entry_id, 0)) + member.count

	for entry: LevelRosterEntry in roster.entries:
		if entry == null:
			continue
		var allocated := int(allocated_by_entry.get(entry.entry_id, 0))
		if allocated != entry.count:
			result.errors.append("Roster entry '%s' allocates %d units across camps but requires %d." % [entry.entry_id, allocated, entry.count])

	if not result.errors.is_empty():
		return result

	_build_units(result, roster, camps)
	_apply_elite_policy(result, roster, camps, seed)
	return result


static func _build_units(
	result: LevelRosterResolution,
	roster: LevelRosterDefinition,
	camps: Array[RosterCampDefinition]
) -> void:
	var serial_by_entry := {}
	for camp: RosterCampDefinition in camps:
		for member: RosterCampMember in camp.members:
			var entry := roster.get_entry(member.entry_id)
			for _index: int in member.count:
				var serial := int(serial_by_entry.get(entry.entry_id, 0)) + 1
				serial_by_entry[entry.entry_id] = serial
				var unit := ResolvedRosterUnit.new()
				unit.serial_id = StringName("%s_%03d" % [entry.entry_id, serial])
				unit.camp_id = camp.camp_id
				unit.entry_id = entry.entry_id
				unit.combatant_id = entry.combatant_id
				unit.combatant_kind = entry.combatant_kind
				result.units.append(unit)


static func _apply_elite_policy(
	result: LevelRosterResolution,
	roster: LevelRosterDefinition,
	camps: Array[RosterCampDefinition],
	seed: int
) -> void:
	var policy := roster.elite_policy
	if policy == null or not policy.is_enabled():
		return
	var random := RandomNumberGenerator.new()
	random.seed = seed

	# One roll per camp; a successful roll promotes exactly one eligible unit.
	for camp: RosterCampDefinition in camps:
		if random.randf() >= policy.chance_per_camp:
			continue
		var candidates := _eligible_unit_indices(result, roster, camp.camp_id)
		if candidates.is_empty():
			continue
		_promote(result.units[candidates[random.randi_range(0, candidates.size() - 1)]], policy.modifier)

	if not policy.guarantee_one_per_eligible_archetype:
		return
	for entry: LevelRosterEntry in roster.entries:
		if entry == null or not entry.elite_eligible:
			continue
		if result.count_elites(entry.combatant_id) > 0:
			continue
		var candidates := _normal_unit_indices_for_entry(result, entry.entry_id)
		if candidates.is_empty():
			result.errors.append("Elite guarantee cannot promote missing entry '%s'." % entry.entry_id)
			continue
		if policy.prefer_empty_camp_for_guarantee:
			var empty_camp_candidates := PackedInt32Array()
			for index: int in candidates:
				if _count_elites_in_camp(result, result.units[index].camp_id) == 0:
					empty_camp_candidates.append(index)
			if not empty_camp_candidates.is_empty():
				candidates = empty_camp_candidates
		_promote(result.units[candidates[random.randi_range(0, candidates.size() - 1)]], policy.modifier)


static func _eligible_unit_indices(
	result: LevelRosterResolution,
	roster: LevelRosterDefinition,
	camp_id: StringName
) -> PackedInt32Array:
	var indices := PackedInt32Array()
	for index: int in result.units.size():
		var unit := result.units[index]
		var entry := roster.get_entry(unit.entry_id)
		if unit.camp_id == camp_id and not unit.is_elite and entry != null and entry.elite_eligible:
			indices.append(index)
	return indices


static func _normal_unit_indices_for_entry(
	result: LevelRosterResolution,
	entry_id: StringName
) -> PackedInt32Array:
	var indices := PackedInt32Array()
	for index: int in result.units.size():
		var unit := result.units[index]
		if unit.entry_id == entry_id and not unit.is_elite:
			indices.append(index)
	return indices


static func _count_elites_in_camp(result: LevelRosterResolution, camp_id: StringName) -> int:
	var total := 0
	for unit: ResolvedRosterUnit in result.units:
		if unit.camp_id == camp_id and unit.is_elite:
			total += 1
	return total


static func _promote(unit: ResolvedRosterUnit, modifier: EliteModifierDefinition) -> void:
	unit.is_elite = true
	unit.elite_modifier = modifier
