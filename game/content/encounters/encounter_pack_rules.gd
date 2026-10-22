class_name EncounterPackRules
extends RefCounted

## Canonical campaign pressure contract. Maps author safe encounter anchors;
## this ruleset owns pack frequency, pack size and family rolls. Total enemy
## count is therefore a result of the plan, never a level-design input.

const SWORDSMAN: StringName = &"skeleton"
const REAPER: StringName = &"skeleton_reaper"
const VAMPIRE: StringName = &"vampire"
const DEFAULT_FLOOR_COUNT := 3
const POPULATION_CONTEXT_REVISION := 1

## Selection order, fallback behavior and difficulty response live beside each
## family as data. Adding another weighted family does not require a new branch
## in normalization or selection code.
const FAMILY_CATALOG := [
	{"id": SWORDSMAN, "difficulty_category": &"baseline", "fallback": true},
	{"id": REAPER, "difficulty_category": &"advanced"},
	{"id": VAMPIRE, "difficulty_category": &"advanced"},
]

const _DIFFICULTY_PRESSURE := {
	"easy": {
		"extra_packs": 0, "extra_members": 0,
		"family_category_multipliers": {"baseline": 1.0, "advanced": 1.0},
	},
	"medium": {
		"extra_packs": 0, "extra_members": 1,
		"family_category_multipliers": {"baseline": 1.0, "advanced": 1.15},
	},
	"hard": {
		"extra_packs": 1, "extra_members": 1,
		"family_category_multipliers": {"baseline": 1.0, "advanced": 1.35},
	},
}

## Later stages add packs before making individual packs unreadably crowded.
## tactical_gap_seconds is an authoring target: while moving through a floor,
## another authored pack anchor should be reached within that cadence.
const _STAGE_PROFILES := {
	1: {
		"packs_per_floor": 1, "members_per_pack": 5, "tactical_gap_seconds": 7.5,
		"traps_per_floor": 4, "pursuit_multiplier": 1.30,
		"family_weights": {"skeleton": 1.0, "skeleton_reaper": 0.0, "vampire": 0.0},
	},
	2: {
		"packs_per_floor": 1, "members_per_pack": 6, "tactical_gap_seconds": 6.8,
		"traps_per_floor": 5, "pursuit_multiplier": 1.34,
		"family_weights": {"skeleton": 1.0, "skeleton_reaper": 0.0, "vampire": 0.0},
	},
	3: {
		"packs_per_floor": 1, "members_per_pack": 7, "tactical_gap_seconds": 6.2,
		"traps_per_floor": 6, "pursuit_multiplier": 1.38,
		"family_weights": {"skeleton": 0.900, "skeleton_reaper": 0.100, "vampire": 0.0},
	},
	4: {
		"packs_per_floor": 2, "members_per_pack": 4, "tactical_gap_seconds": 5.7,
		"traps_per_floor": 7, "pursuit_multiplier": 1.42,
		"family_weights": {"skeleton": 0.750, "skeleton_reaper": 0.250, "vampire": 0.0},
	},
	5: {
		"packs_per_floor": 2, "members_per_pack": 5, "tactical_gap_seconds": 5.3,
		"traps_per_floor": 8, "pursuit_multiplier": 1.46,
		"family_weights": {"skeleton": 0.680, "skeleton_reaper": 0.250, "vampire": 0.070},
	},
	6: {
		"packs_per_floor": 2, "members_per_pack": 6, "tactical_gap_seconds": 5.0,
		"traps_per_floor": 8, "pursuit_multiplier": 1.50,
		"family_weights": {"skeleton": 0.600, "skeleton_reaper": 0.270, "vampire": 0.130},
	},
	7: {
		"packs_per_floor": 2, "members_per_pack": 7, "tactical_gap_seconds": 4.7,
		"traps_per_floor": 9, "pursuit_multiplier": 1.54,
		"family_weights": {"skeleton": 0.530, "skeleton_reaper": 0.290, "vampire": 0.180},
	},
	8: {
		"packs_per_floor": 2, "members_per_pack": 8, "tactical_gap_seconds": 4.4,
		"traps_per_floor": 9, "pursuit_multiplier": 1.58,
		"family_weights": {"skeleton": 0.460, "skeleton_reaper": 0.310, "vampire": 0.230},
	},
	9: {
		"packs_per_floor": 3, "members_per_pack": 6, "tactical_gap_seconds": 4.1,
		"traps_per_floor": 10, "pursuit_multiplier": 1.62,
		"family_weights": {"skeleton": 0.390, "skeleton_reaper": 0.330, "vampire": 0.280},
	},
	10: {
		"packs_per_floor": 3, "members_per_pack": 7, "tactical_gap_seconds": 3.8,
		"traps_per_floor": 10, "pursuit_multiplier": 1.66,
		"family_weights": {"skeleton": 0.320, "skeleton_reaper": 0.340, "vampire": 0.340},
	},
}

## Chapter 2+ population grows only at authored bands.  Every Easy transition
## is at most 1.15x the preceding band and the final shape is capped at
## 3 floors x 4 packs x 10 members = 120 enemies.
const CHAPTER_TWO_BANDS := [
	{
		"stage_min": 11, "stage_max": 20,
		"packs_per_floor": 3, "members_per_pack": 8,
		"tactical_gap_seconds": 3.7, "traps_per_floor": 10,
		"pursuit_multiplier": 1.68,
		"family_weights": {"skeleton": 0.300, "skeleton_reaper": 0.340, "vampire": 0.360},
	},
	{
		"stage_min": 21, "stage_max": 30,
		"packs_per_floor": 3, "members_per_pack": 9,
		"tactical_gap_seconds": 3.6, "traps_per_floor": 11,
		"pursuit_multiplier": 1.71,
		"family_weights": {"skeleton": 0.280, "skeleton_reaper": 0.340, "vampire": 0.380},
	},
	{
		"stage_min": 31, "stage_max": 50,
		"packs_per_floor": 3, "members_per_pack": 10,
		"tactical_gap_seconds": 3.5, "traps_per_floor": 11,
		"pursuit_multiplier": 1.74,
		"family_weights": {"skeleton": 0.260, "skeleton_reaper": 0.340, "vampire": 0.400},
	},
	{
		"stage_min": 51, "stage_max": 70,
		"packs_per_floor": 4, "members_per_pack": 8,
		"tactical_gap_seconds": 3.4, "traps_per_floor": 12,
		"pursuit_multiplier": 1.77,
		"family_weights": {"skeleton": 0.240, "skeleton_reaper": 0.340, "vampire": 0.420},
	},
	{
		"stage_min": 71, "stage_max": 85,
		"packs_per_floor": 4, "members_per_pack": 9,
		"tactical_gap_seconds": 3.2, "traps_per_floor": 12,
		"pursuit_multiplier": 1.80,
		"family_weights": {"skeleton": 0.220, "skeleton_reaper": 0.340, "vampire": 0.440},
	},
	{
		"stage_min": 86, "stage_max": 100,
		"packs_per_floor": 4, "members_per_pack": 10,
		"tactical_gap_seconds": 3.1, "traps_per_floor": 12,
		"pursuit_multiplier": 1.82,
		"family_weights": {"skeleton": 0.200, "skeleton_reaper": 0.340, "vampire": 0.460},
	},
]

const _FORMATION_OFFSETS := [
	Vector2.ZERO,
	Vector2(28.0, 0.0),
	Vector2(-28.0, 0.0),
	Vector2(0.0, 28.0),
	Vector2(0.0, -28.0),
	Vector2(24.0, 24.0),
	Vector2(-24.0, 24.0),
	Vector2(24.0, -24.0),
	Vector2(-24.0, -24.0),
]


static func get_stage_profile(stage_level: int) -> Dictionary:
	var stage := clampi(stage_level, 1, 100)
	if _STAGE_PROFILES.has(stage):
		return (_STAGE_PROFILES[stage] as Dictionary).duplicate(true)
	for raw_band: Variant in CHAPTER_TWO_BANDS:
		var band := raw_band as Dictionary
		if stage >= int(band["stage_min"]) and stage <= int(band["stage_max"]):
			return band.duplicate(true)
	# The table covers 1..100; this is a defensive fallback for malformed data.
	return (CHAPTER_TWO_BANDS[-1] as Dictionary).duplicate(true)


static func get_pack_plan(
	stage_level: int,
	difficulty_id: Variant,
	floor_count := DEFAULT_FLOOR_COUNT,
) -> Dictionary:
	var profile := get_stage_profile(stage_level)
	var difficulty := _normalize_difficulty(difficulty_id)
	var pressure := _get_density_pressure(stage_level, difficulty)
	var packs_per_floor := int(profile["packs_per_floor"]) + int(pressure["extra_packs"])
	var members_per_pack := int(profile["members_per_pack"]) + int(pressure["extra_members"])
	var floors := maxi(1, floor_count)
	return {
		"stage_level": clampi(stage_level, 1, 100),
		"difficulty": StringName(difficulty),
		"floor_count": floors,
		"packs_per_floor": packs_per_floor,
		"members_per_pack": members_per_pack,
		"total_packs": floors * packs_per_floor,
		"total_members": floors * packs_per_floor * members_per_pack,
		"tactical_gap_seconds": float(profile["tactical_gap_seconds"]),
		"traps_per_floor": int(profile["traps_per_floor"]),
		"pursuit_multiplier": float(profile["pursuit_multiplier"]),
		"family_weights": get_family_weights(stage_level, difficulty),
	}


## Resolves an authored level's encounter shape without turning its legacy
## enemy count into gameplay authority. Objective-heavy arenas may narrow the
## number of approach packs while retaining the stage's family pressure.
static func get_level_pack_plan(
	metadata: Dictionary,
	stage_level: int,
	difficulty_id: Variant,
) -> Dictionary:
	var model_value: Variant = metadata.get("encounter_pack_model", {})
	var model: Dictionary = model_value if model_value is Dictionary else {}
	var profile_stage := int(model.get("profile_stage", stage_level))
	var floor_count := int(model.get("floor_count", DEFAULT_FLOOR_COUNT))
	var plan := get_pack_plan(profile_stage, difficulty_id, floor_count)
	var difficulty := _normalize_difficulty(difficulty_id)
	var pressure := _get_density_pressure(profile_stage, difficulty)
	if model.has("packs_per_floor_override"):
		var extra_packs := int(pressure["extra_packs"])
		if not bool(model.get("allow_difficulty_extra_packs", true)):
			extra_packs = 0
		plan["packs_per_floor"] = maxi(1, int(model.packs_per_floor_override) + extra_packs)
	if model.has("members_per_pack_override"):
		plan["members_per_pack"] = maxi(
			1,
			int(model.members_per_pack_override) + int(pressure["extra_members"]),
		)
	plan["total_packs"] = int(plan.floor_count) * int(plan.packs_per_floor)
	plan["total_members"] = int(plan.total_packs) * int(plan.members_per_pack)
	return plan


static func get_family_weights(stage_level: int, difficulty_id: Variant) -> Dictionary:
	var raw: Dictionary = get_stage_profile(stage_level)["family_weights"]
	var difficulty := _normalize_difficulty(difficulty_id)
	var pressure: Dictionary = _DIFFICULTY_PRESSURE[difficulty]
	var category_value: Variant = pressure.get("family_category_multipliers", {})
	var category_multipliers: Dictionary = (
		category_value if category_value is Dictionary else {}
	)
	return normalize_family_weights(raw, FAMILY_CATALOG, category_multipliers)


## Pure catalog-driven normalization. Raw stage weights and difficulty category
## multipliers are independent data inputs, so the helper is reusable by future
## chapters without knowing any concrete enemy ID.
static func normalize_family_weights(
	raw_weights: Dictionary,
	ordered_catalog: Array,
	category_multipliers: Dictionary = {},
) -> Dictionary:
	var weights := {}
	var ordered_ids: Array[StringName] = []
	var fallback_id := &""
	var has_explicit_fallback := false
	var total := 0.0
	for raw_entry: Variant in ordered_catalog:
		if not raw_entry is Dictionary:
			continue
		var entry: Dictionary = raw_entry
		var family_id := StringName(String(entry.get("id", "")).strip_edges())
		var family_key := String(family_id)
		if family_id == &"" or weights.has(family_key):
			continue
		ordered_ids.append(family_id)
		if fallback_id == &"":
			fallback_id = family_id
		if bool(entry.get("fallback", false)) and not has_explicit_fallback:
			fallback_id = family_id
			has_explicit_fallback = true
		var category_key := String(entry.get("difficulty_category", &"default"))
		var category_multiplier := maxf(
			0.0,
			float(category_multipliers.get(category_key, 1.0)),
		)
		var raw_weight := float(raw_weights.get(
			family_key,
			raw_weights.get(family_id, 0.0),
		))
		var adjusted_weight := maxf(0.0, raw_weight) * category_multiplier
		weights[family_key] = adjusted_weight
		total += adjusted_weight
	if ordered_ids.is_empty():
		return {}
	if total <= 0.0:
		for family_id: StringName in ordered_ids:
			weights[String(family_id)] = 1.0 if family_id == fallback_id else 0.0
		return weights
	for family_id: StringName in ordered_ids:
		var family_key := String(family_id)
		weights[family_key] = float(weights[family_key]) / total
	return weights


## Pure ordered weighted selection. The final positive entry absorbs floating
## point residue, while an all-zero malformed input falls back through catalog
## metadata instead of a hard-coded family ID.
static func select_weighted_family(
	normalized_weights: Dictionary,
	ordered_catalog: Array,
	normalized_roll: float,
) -> StringName:
	var roll := clampf(normalized_roll, 0.0, 0.999999999)
	var cursor := 0.0
	var fallback_id := &""
	var has_explicit_fallback := false
	var last_positive_id := &""
	for raw_entry: Variant in ordered_catalog:
		if not raw_entry is Dictionary:
			continue
		var entry: Dictionary = raw_entry
		var family_id := StringName(String(entry.get("id", "")).strip_edges())
		if family_id == &"":
			continue
		if fallback_id == &"":
			fallback_id = family_id
		if bool(entry.get("fallback", false)) and not has_explicit_fallback:
			fallback_id = family_id
			has_explicit_fallback = true
		var family_weight := maxf(0.0, float(normalized_weights.get(
			String(family_id),
			normalized_weights.get(family_id, 0.0),
		)))
		if family_weight <= 0.0:
			continue
		last_positive_id = family_id
		cursor += family_weight
		if roll < cursor:
			return family_id
	return last_positive_id if last_positive_id != &"" else fallback_id


static func get_family_types(ordered_catalog: Array = FAMILY_CATALOG) -> Array[StringName]:
	var result: Array[StringName] = []
	for raw_entry: Variant in ordered_catalog:
		if not raw_entry is Dictionary:
			continue
		var family_id := StringName(String((raw_entry as Dictionary).get("id", "")).strip_edges())
		if family_id != &"" and not result.has(family_id):
			result.append(family_id)
	return result


static func roll_family(
	stage_level: int,
	difficulty_id: Variant,
	run_id: String,
	pack_id: String,
	slot_index: int,
) -> StringName:
	var weights := get_family_weights(stage_level, difficulty_id)
	var roll := _deterministic_roll(
		"%s|%s|%d|%s|%d" % [run_id, _normalize_difficulty(difficulty_id), stage_level, pack_id, slot_index]
	)
	return select_weighted_family(weights, FAMILY_CATALOG, roll)


static func uses_pack_model(metadata: Dictionary) -> bool:
	var value: Variant = metadata.get("encounter_pack_model", {})
	return value is Dictionary and bool((value as Dictionary).get("enabled", false))


static func expected_bonus_count(
	metadata: Dictionary,
	stage_level: int,
	difficulty_id: Variant,
) -> int:
	if not uses_pack_model(metadata):
		return 0
	var model: Dictionary = metadata["encounter_pack_model"]
	var plan := get_level_pack_plan(metadata, stage_level, difficulty_id)
	var anchor_camp_ids := _string_set(model.get("anchor_camp_ids", []))
	var authored_members := 0
	for raw_camp: Variant in metadata.get("combat_camps", []):
		if raw_camp is Dictionary:
			var camp_id := String((raw_camp as Dictionary).get("id", ""))
			if not anchor_camp_ids.is_empty() and not anchor_camp_ids.has(camp_id):
				continue
			var enemy_ids: Variant = (raw_camp as Dictionary).get("enemy_ids", [])
			if enemy_ids is Array:
				authored_members += (enemy_ids as Array).size()
	return maxi(0, int(plan["total_members"]) - authored_members)


## Builds the immutable population authority consumed by kill-XP projection.
## The Easy reference is level-specific: objective arenas are allowed to author
## a smaller pack shape than the generic three-floor stage profile. The current
## run's realized population is counted from the same projected entities Main
## will materialize, so telemetry can prove the plan was actually realized.
##
## Campaign callers fail closed when the pack model is absent or when the live
## projection does not match its declared plan. This prevents a malformed map
## from silently falling back to an unrelated three-floor XP divisor.
static func build_population_context(
	metadata: Dictionary,
	stage_level: int,
	difficulty_id: Variant,
	runtime_entities: Array,
	enemy_entity_types: Array,
) -> Dictionary:
	var stage := clampi(stage_level, 1, 100)
	var difficulty := _normalize_difficulty(difficulty_id)
	var base := {
		"revision": POPULATION_CONTEXT_REVISION,
		"valid": false,
		"source": "level_pack_plan",
		"stage_level": stage,
		"difficulty": difficulty,
		"reference_difficulty": "easy",
		"reference_easy_population": 0,
		"expected_population": 0,
		"realized_population": 0,
		"plan_signature": "",
		"error": "",
	}
	if not uses_pack_model(metadata):
		base["error"] = "Campaign XP population requires an enabled encounter_pack_model."
		return base

	var reference_plan := get_level_pack_plan(metadata, stage, &"easy")
	var active_plan := get_level_pack_plan(metadata, stage, difficulty)
	var reference_population := maxi(0, int(reference_plan.get("total_members", 0)))
	var expected_population := maxi(0, int(active_plan.get("total_members", 0)))
	var realized_population := count_realized_pack_members(
		runtime_entities,
		enemy_entity_types,
	)
	base["reference_easy_population"] = reference_population
	base["expected_population"] = expected_population
	base["realized_population"] = realized_population
	base["reference_plan"] = reference_plan.duplicate(true)
	base["active_plan"] = active_plan.duplicate(true)

	if reference_population <= 0:
		base["error"] = "Level-specific Easy XP reference population must be positive."
		return base
	if expected_population <= 0:
		base["error"] = "Active encounter XP population must be positive."
		return base
	if realized_population != expected_population:
		base["error"] = (
			"Realized pack population %d does not match active plan %d."
			% [realized_population, expected_population]
		)
		return base

	var signature_payload := {
		"revision": POPULATION_CONTEXT_REVISION,
		"source": "level_pack_plan",
		"stage_level": stage,
		"difficulty": difficulty,
		"reference_easy_population": reference_population,
		"expected_population": expected_population,
		"realized_population": realized_population,
		"reference_floor_count": int(reference_plan.get("floor_count", 0)),
		"reference_packs_per_floor": int(reference_plan.get("packs_per_floor", 0)),
		"reference_members_per_pack": int(reference_plan.get("members_per_pack", 0)),
		"active_floor_count": int(active_plan.get("floor_count", 0)),
		"active_packs_per_floor": int(active_plan.get("packs_per_floor", 0)),
		"active_members_per_pack": int(active_plan.get("members_per_pack", 0)),
	}
	base["plan_signature"] = JSON.stringify(signature_payload).sha256_text()
	base["valid"] = true
	return base


static func count_realized_pack_members(
	runtime_entities: Array,
	enemy_entity_types: Array,
) -> int:
	var total := 0
	for raw_entity: Variant in runtime_entities:
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if (
			String(entity.get("type", "")) in enemy_entity_types
			and bool(entity.get("encounter_pack", false))
		):
			total += 1
	return total


static func project_runtime_entities(
	authored_entities: Array,
	metadata: Dictionary,
	stage_level: int,
	difficulty_id: Variant,
	run_id: String,
	eligible_types: Array,
	excluded_types: Array,
	excluded_entity_ids: Array = [],
	walkable_cells: Array = [],
) -> Array:
	var result: Array = authored_entities.duplicate(true)
	if not uses_pack_model(metadata):
		return result
	var model: Dictionary = metadata["encounter_pack_model"]
	var floor_count := int(model.get("floor_count", DEFAULT_FLOOR_COUNT))
	var plan := get_level_pack_plan(metadata, stage_level, difficulty_id)
	var camps_by_floor := _camps_by_floor(metadata.get("combat_camps", []), floor_count)
	var anchor_camp_ids := _string_set(model.get("anchor_camp_ids", []))
	var excluded_ids := _string_set(excluded_entity_ids)
	var walkable_lookup := _cell_lookup(walkable_cells)
	var occupied_lookup := _occupied_cell_lookup(result)
	var result_index_by_id := {}
	for index: int in result.size():
		var raw_entity: Variant = result[index]
		if raw_entity is Dictionary:
			result_index_by_id[String((raw_entity as Dictionary).get("id", ""))] = index

	for floor_number: int in range(1, floor_count + 1):
		var floor_camps: Array = camps_by_floor.get(floor_number, [])
		var source_entries: Array[Dictionary] = []
		for raw_camp: Variant in floor_camps:
			if not raw_camp is Dictionary:
				continue
			var camp_id := String((raw_camp as Dictionary).get("id", ""))
			if not anchor_camp_ids.is_empty() and not anchor_camp_ids.has(camp_id):
				continue
			for raw_id: Variant in (raw_camp as Dictionary).get("enemy_ids", []):
				if excluded_ids.has(String(raw_id)):
					continue
				var entity_index := int(result_index_by_id.get(String(raw_id), -1))
				if entity_index < 0:
					continue
				var source: Dictionary = result[entity_index]
				var source_type := String(source.get("type", ""))
				if source_type in eligible_types and source_type not in excluded_types:
					source_entries.append({"index": entity_index, "entity": source})
		_expand_floor(
			result,
			source_entries,
			floor_number,
			int(plan["packs_per_floor"]),
			int(plan["members_per_pack"]),
			stage_level,
			difficulty_id,
			run_id,
			walkable_lookup,
			occupied_lookup,
		)
		_ensure_late_floor_family_presence(result, floor_number, stage_level)

	_apply_cadence_scout(result, metadata)
	return result


static func _expand_floor(
	result: Array,
	source_entries: Array[Dictionary],
	floor_number: int,
	pack_count: int,
	members_per_pack: int,
	stage_level: int,
	difficulty_id: Variant,
	run_id: String,
	walkable_lookup: Dictionary,
	occupied_lookup: Dictionary,
) -> void:
	if source_entries.is_empty():
		return
	var members_by_pack: Array[Array] = []
	for _pack_index: int in pack_count:
		members_by_pack.append([])
	for source_index: int in source_entries.size():
		var pack_index := source_index % pack_count
		var entry: Dictionary = source_entries[source_index]
		var entity: Dictionary = entry.entity
		_tag_pack_entity(entity, floor_number, pack_index, members_by_pack[pack_index].size(), false)
		result[int(entry.index)] = entity
		members_by_pack[pack_index].append(entity)

	for pack_index: int in pack_count:
		var pack_id := "floor_%02d_pack_%02d" % [floor_number, pack_index + 1]
		var center_source: Dictionary = source_entries[pack_index % source_entries.size()].entity
		var center := _array_to_vector2(center_source.get("position", []))
		while members_by_pack[pack_index].size() < members_per_pack:
			var slot_index := members_by_pack[pack_index].size()
			var source: Dictionary = source_entries[
				(pack_index * members_per_pack + slot_index) % source_entries.size()
			].entity
			var synthetic := source.duplicate(true)
			synthetic["id"] = "%s__member_%02d" % [pack_id, slot_index + 1]
			synthetic["type"] = String(roll_family(
				stage_level, difficulty_id, run_id, pack_id, slot_index
			))
			# The family roll owns the synthetic member's identity. Never inherit an
			# explicit canonical ID from the authored source after changing type.
			synthetic.erase("enemy_definition_id")
			var offset: Vector2 = _FORMATION_OFFSETS[slot_index % _FORMATION_OFFSETS.size()]
			# Rotate repeated formations so adjacent packs do not create one flat row.
			offset = offset.rotated(float(pack_index) * 0.73)
			var desired_position := center + offset
			var spawn_position := _resolve_spawn_position(
				desired_position,
				center,
				walkable_lookup,
				occupied_lookup,
				pack_index,
				slot_index,
			)
			synthetic["position"] = [spawn_position.x, spawn_position.y]
			# The pack centre is an authored, navigation-safe anchor. Keeping that
			# exact source ID also lets diagnostics prove every generated member
			# remains a small local offset from real map authoring.
			synthetic["source_entity_id"] = String(center_source.get("id", ""))
			synthetic["density_bonus"] = true
			synthetic["required_for_completion"] = false
			_tag_pack_entity(synthetic, floor_number, pack_index, slot_index, true)
			members_by_pack[pack_index].append(synthetic)
			result.append(synthetic)


static func _tag_pack_entity(
	entity: Dictionary,
	floor_number: int,
	pack_index: int,
	slot_index: int,
	is_runtime_member: bool,
) -> void:
	entity["encounter_pack"] = true
	entity["encounter_floor"] = floor_number
	entity["encounter_pack_index"] = pack_index + 1
	entity["encounter_pack_slot"] = slot_index + 1
	entity["runtime_pack_member"] = is_runtime_member


static func _ensure_late_floor_family_presence(
	result: Array,
	floor_number: int,
	stage_level: int,
) -> void:
	if stage_level < 6:
		return
	var present := {}
	var runtime_indices: Array[int] = []
	for index: int in result.size():
		var raw_entity: Variant = result[index]
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if not bool(entity.get("encounter_pack", false)) \
				or int(entity.get("encounter_floor", 0)) != floor_number:
			continue
		present[String(entity.get("type", ""))] = true
		if bool(entity.get("runtime_pack_member", false)):
			runtime_indices.append(index)
	var replacement_cursor := runtime_indices.size() - 1
	for family: StringName in get_family_types():
		if present.has(String(family)) or replacement_cursor < 0:
			continue
		var replacement_index := runtime_indices[replacement_cursor]
		replacement_cursor -= 1
		var replacement: Dictionary = result[replacement_index]
		replacement["type"] = String(family)
		replacement.erase("enemy_definition_id")
		replacement["family_presence_guarantee"] = true
		result[replacement_index] = replacement


static func _apply_cadence_scout(result: Array, metadata: Dictionary) -> void:
	var anchor_value: Variant = metadata.get("density_cadence_anchor", [])
	if not anchor_value is Array or (anchor_value as Array).size() < 2:
		return
	for raw_entity: Variant in result:
		if not raw_entity is Dictionary:
			continue
		var entity: Dictionary = raw_entity
		if not bool(entity.get("density_bonus", false)):
			continue
		var anchor := _array_to_vector2(anchor_value)
		entity["position"] = [anchor.x, anchor.y]
		entity["density_cadence_scout"] = true
		return


static func _camps_by_floor(raw_camps: Variant, floor_count: int) -> Dictionary:
	var result := {}
	for floor_number: int in range(1, floor_count + 1):
		result[floor_number] = []
	if not raw_camps is Array:
		return result
	for raw_camp: Variant in raw_camps:
		if not raw_camp is Dictionary:
			continue
		var floor_number := clampi(int((raw_camp as Dictionary).get("floor", 1)), 1, floor_count)
		(result[floor_number] as Array).append(raw_camp)
	return result


static func _resolve_spawn_position(
	desired_position: Vector2,
	center_position: Vector2,
	walkable_lookup: Dictionary,
	occupied_lookup: Dictionary,
	pack_index: int,
	slot_index: int,
) -> Vector2:
	if walkable_lookup.is_empty():
		return desired_position
	var desired_cell := Vector2i(floori(desired_position.x / 16.0), floori(desired_position.y / 16.0))
	var center_cell := Vector2i(floori(center_position.x / 16.0), floori(center_position.y / 16.0))
	var candidates: Array[Vector2i] = [desired_cell]
	for radius: int in range(1, 6):
		for y_offset: int in range(-radius, radius + 1):
			for x_offset: int in range(-radius, radius + 1):
				if maxi(absi(x_offset), absi(y_offset)) != radius:
					continue
				candidates.append(desired_cell + Vector2i(x_offset, y_offset))
	var rotation := (pack_index * 7 + slot_index * 3) % maxi(1, candidates.size())
	for candidate_index: int in candidates.size():
		var candidate: Vector2i = candidates[(candidate_index + rotation) % candidates.size()]
		var key := _cell_key(candidate)
		if (
			walkable_lookup.has(key)
			and not occupied_lookup.has(key)
			and candidate.distance_squared_to(center_cell) <= 49
		):
			occupied_lookup[key] = true
			return Vector2(candidate.x * 16 + 8, candidate.y * 16 + 8)
	return center_position


static func _cell_lookup(raw_cells: Array) -> Dictionary:
	var result := {}
	for raw_cell: Variant in raw_cells:
		if not raw_cell is Dictionary:
			continue
		var cell := Vector2i(int(raw_cell.get("x", -1)), int(raw_cell.get("y", -1)))
		result[_cell_key(cell)] = true
	return result


static func _occupied_cell_lookup(entities: Array) -> Dictionary:
	var result := {}
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			continue
		var position := _array_to_vector2((raw_entity as Dictionary).get("position", []))
		result[_cell_key(Vector2i(floori(position.x / 16.0), floori(position.y / 16.0)))] = true
	return result


static func _string_set(values: Variant) -> Dictionary:
	var result := {}
	if values is Array:
		for value: Variant in values:
			result[String(value)] = true
	return result


static func _cell_key(cell: Vector2i) -> String:
	return "%d,%d" % [cell.x, cell.y]


## Hard widens packs throughout the chapter but does not add an approach pack
## before Level 11. At Level 11+ its one-pack/one-member increase is at most
## 1.5x the canonical Easy population and becomes proportionally smaller later.
static func _get_density_pressure(stage_level: int, difficulty_id: Variant) -> Dictionary:
	var difficulty := _normalize_difficulty(difficulty_id)
	var pressure: Dictionary = (_DIFFICULTY_PRESSURE[difficulty] as Dictionary).duplicate()
	if difficulty == "hard" and clampi(stage_level, 1, 100) < 11:
		pressure["extra_packs"] = 0
	return pressure


static func _normalize_difficulty(value: Variant) -> String:
	var normalized := String(value).strip_edges().to_lower()
	return normalized if _DIFFICULTY_PRESSURE.has(normalized) else "easy"


static func _deterministic_roll(value: String) -> float:
	var bucket := value.sha256_text().substr(0, 8).hex_to_int()
	return clampf(float(bucket) / 4294967296.0, 0.0, 0.999999999)


static func _array_to_vector2(value: Variant) -> Vector2:
	if value is Array and (value as Array).size() >= 2:
		return Vector2(float((value as Array)[0]), float((value as Array)[1]))
	return Vector2.ZERO
