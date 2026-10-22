@tool
class_name LevelSchema
extends RefCounted

const CURRENT_VERSION := 2
const MOVEMENT_MODE := "top_down"
const TILE_SIZE := 16
const ATLAS_GRIDS := {
	0: Vector2i(32, 32),
	1: Vector2i(12, 4),
}
const REQUIRED_LAYERS := [&"Backdrop", &"Geometry", &"Decor"]
const ENTITY_TYPES := ["player", "skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain", "hooded_archer_miniboss", "vampire", "vampire_castellan", "coven_wraith", "venom_bound_wraith", "spirit_leech", "hexwing_familiar", "axe_soul_boss", "wizard_hero_boss", "coin", "sigil", "soul_beacon", "checkpoint", "chest", "reliquary_branch_seal", "gate_seal", "bow_reward", "exit_gate", "floor_door", "spikes", "torch"]
const ENEMY_ENTITY_TYPES := [
	"skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain",
	"hooded_archer_miniboss", "vampire", "vampire_castellan", "coven_wraith",
	"venom_bound_wraith", "spirit_leech", "hexwing_familiar", "axe_soul_boss",
	"wizard_hero_boss",
]
const CHAPTER_TWO_ENEMY_ENTITY_TYPES := [
	"coven_wraith", "venom_bound_wraith", "spirit_leech", "hexwing_familiar",
	"axe_soul_boss", "wizard_hero_boss",
]


static func validate_level(value: Variant) -> Dictionary:
	if not value is Dictionary:
		return _failure("Top-level JSON must be an object.")
	var level: Dictionary = value
	if not _is_integer_number(level.get("version", null)) or int(level.get("version")) != CURRENT_VERSION:
		return _failure("version must be exactly %d; legacy schema fallback is not supported." % CURRENT_VERSION)
	if level.get("movement_mode", null) != MOVEMENT_MODE:
		return _failure("movement_mode must be exactly \"%s\"." % MOVEMENT_MODE)

	for field: StringName in [&"tile_size", &"width", &"height"]:
		var field_value: Variant = level.get(field, null)
		if not _is_integer_number(field_value) or int(field_value) <= 0:
			return _failure("%s must be a positive integer." % field)
	var tile_size := int(level["tile_size"])
	if tile_size != TILE_SIZE:
		return _failure("tile_size must be exactly %d for the configured dungeon TileSet." % TILE_SIZE)
	var width := int(level["width"])
	var height := int(level["height"])

	var layers_value: Variant = level.get("layers", null)
	if not layers_value is Dictionary:
		return _failure("layers must be an object.")
	var layers: Dictionary = layers_value
	for layer_name: StringName in REQUIRED_LAYERS:
		var cells: Variant = layers.get(layer_name, null)
		if not cells is Array:
			return _failure("layers.%s must be an array." % layer_name)
		var layer_result := _validate_cells(cells, width, height, String(layer_name))
		if not bool(layer_result.get("ok", false)):
			return layer_result

	var entities_value: Variant = level.get("entities", null)
	if not entities_value is Array:
		return _failure("entities must be an array.")
	var entity_result := _validate_entities(entities_value, width * tile_size, height * tile_size)
	if not bool(entity_result.get("ok", false)):
		return entity_result

	var metadata_value: Variant = level.get("metadata", null)
	if not metadata_value is Dictionary:
		return _failure("metadata must be an object.")
	var bounds_result := _validate_camera_bounds(metadata_value, width * tile_size, height * tile_size)
	if not bool(bounds_result.get("ok", false)):
		return bounds_result
	var pack_result := _validate_encounter_pack_model(metadata_value)
	if not bool(pack_result.get("ok", false)):
		return pack_result
	var required_value: Variant = metadata_value.get("required_sigils", null)
	if not _is_integer_number(required_value) or int(required_value) < 1 or int(required_value) > 99:
		return _failure("metadata.required_sigils must be an integer between 1 and 99.")
	var available_sigils := 0
	for raw_entity: Variant in entities_value:
		if not raw_entity is Dictionary:
			continue
		if raw_entity.get("type", "") in ["sigil", "gate_seal"] \
				or (raw_entity.get("type", "") == "chest" and bool(raw_entity.get("contains_sigil", false))):
			available_sigils += 1
		elif raw_entity.get("type", "") == "vampire_castellan" \
				and bool(raw_entity.get("grants_sigil_on_defeat", false)):
			available_sigils += 1
	if int(required_value) > available_sigils:
		return _failure("metadata.required_sigils exceeds the %d sigil entities in this level." % available_sigils)
	return {"ok": true}


static func _validate_cells(cells: Array, width: int, height: int, layer_name: String) -> Dictionary:
	var seen := {}
	for index: int in cells.size():
		var raw_cell: Variant = cells[index]
		var path := "layers.%s[%d]" % [layer_name, index]
		if not raw_cell is Dictionary:
			return _failure("%s must be an object." % path)
		var cell: Dictionary = raw_cell
		for field: StringName in [&"x", &"y", &"source", &"alternative"]:
			if not cell.has(field) or not _is_integer_number(cell[field]):
				return _failure("%s.%s must be an integer." % [path, field])
		var x := int(cell["x"])
		var y := int(cell["y"])
		if x < 0 or x >= width or y < 0 or y >= height:
			return _failure("%s coordinate (%d, %d) is outside %dx%d bounds." % [path, x, y, width, height])
		var coordinate_key := "%d,%d" % [x, y]
		if seen.has(coordinate_key):
			return _failure("layers.%s contains duplicate coordinate (%s)." % [layer_name, coordinate_key])
		seen[coordinate_key] = true
		var source_id := int(cell["source"])
		if not ATLAS_GRIDS.has(source_id):
			return _failure("%s.source must be one of the configured dungeon TileSet sources: %s." % [path, ATLAS_GRIDS.keys()])
		if int(cell["alternative"]) != 0:
			return _failure("%s.alternative must be 0; this atlas has no alternative tiles." % path)
		var atlas_value: Variant = cell.get("atlas", null)
		if not atlas_value is Array or atlas_value.size() != 2:
			return _failure("%s.atlas must be exactly [x, y]." % path)
		if not _is_integer_number(atlas_value[0]) or not _is_integer_number(atlas_value[1]):
			return _failure("%s.atlas coordinates must be integers." % path)
		if int(atlas_value[0]) < 0 or int(atlas_value[1]) < 0:
			return _failure("%s.atlas coordinates must be non-negative." % path)
		var atlas_grid: Vector2i = ATLAS_GRIDS[source_id]
		if int(atlas_value[0]) >= atlas_grid.x or int(atlas_value[1]) >= atlas_grid.y:
			return _failure("%s.atlas coordinates must stay inside the %dx%d atlas for source %d." % [path, atlas_grid.x, atlas_grid.y, source_id])
	return {"ok": true}


static func _validate_entities(entities: Array, pixel_width: int, pixel_height: int) -> Dictionary:
	var seen_ids := {}
	var player_count := 0
	var exit_gate_count := 0
	for index: int in entities.size():
		var raw_entity: Variant = entities[index]
		var path := "entities[%d]" % index
		if not raw_entity is Dictionary:
			return _failure("%s must be an object." % path)
		var entity: Dictionary = raw_entity
		var entity_id: Variant = entity.get("id", null)
		if not entity_id is String or entity_id.strip_edges().is_empty():
			return _failure("%s.id must be a non-empty string." % path)
		if seen_ids.has(entity_id):
			return _failure("entities contains duplicate id \"%s\"." % entity_id)
		seen_ids[entity_id] = true
		var entity_type: Variant = entity.get("type", null)
		if not entity_type is String or entity_type.strip_edges().is_empty():
			return _failure("%s.type must be a non-empty string." % path)
		if entity_type not in ENTITY_TYPES:
			return _failure("%s.type '%s' is not registered by the level loader." % [path, entity_type])
		if entity_type == "player":
			player_count += 1
		elif entity_type == "exit_gate":
			exit_gate_count += 1
		var position: Variant = entity.get("position", null)
		if not position is Array or position.size() != 2:
			return _failure("%s.position must be exactly [x, y]." % path)
		if not _is_finite_number(position[0]) or not _is_finite_number(position[1]):
			return _failure("%s.position coordinates must be finite numbers." % path)
		var x := float(position[0])
		var y := float(position[1])
		if x < 0.0 or x >= pixel_width or y < 0.0 or y >= pixel_height:
			return _failure("%s.position (%s, %s) is outside %dx%d pixel bounds." % [path, x, y, pixel_width, pixel_height])
		var allowed_fields := ["id", "type", "position"]
		# Guaranteed rewards are authored as a named loot profile on an enemy,
		# then resolved by LootDirector. Keep this an explicit enemy-only field;
		# accepting arbitrary entity keys here would hide loader/schema drift.
		if entity_type in ENEMY_ENTITY_TYPES and entity.has("guaranteed_loot_profile"):
			allowed_fields.append("guaranteed_loot_profile")
			var profile_value: Variant = entity.guaranteed_loot_profile
			if not profile_value is String and not profile_value is StringName:
				return _failure(
					"%s.guaranteed_loot_profile must be a string or StringName." % path
				)
			var profile_id := StringName(String(profile_value).strip_edges())
			if not ContentId.is_valid(profile_id):
				return _failure(
					"%s.guaranteed_loot_profile must be a non-empty lower_snake_case content ID." % path
				)
		if entity_type in CHAPTER_TWO_ENEMY_ENTITY_TYPES:
			allowed_fields.append_array([
				"patrol", "chapter_2_directed", "deferred_spawn", "director_order",
				"objective_bound", "retreat_health_ratio",
			])
			if entity.has("patrol") and (
				not _is_finite_number(entity.patrol)
				or float(entity.patrol) < 8.0
				or float(entity.patrol) > 600.0
			):
				return _failure("%s.patrol must be a number between 8 and 600." % path)
			for bool_field: String in ["chapter_2_directed", "deferred_spawn", "objective_bound"]:
				if entity.has(bool_field) and not (entity[bool_field] is bool):
					return _failure("%s.%s must be a boolean." % [path, bool_field])
			if entity.has("director_order") and (
				not _is_integer_number(entity.director_order)
				or int(entity.director_order) < 0
			):
				return _failure("%s.director_order must be a non-negative integer." % path)
			if entity.has("retreat_health_ratio") and (
				not _is_finite_number(entity.retreat_health_ratio)
				or float(entity.retreat_health_ratio) <= 0.0
				or float(entity.retreat_health_ratio) >= 1.0
			):
				return _failure("%s.retreat_health_ratio must be between zero and one." % path)
		if entity_type in ["skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain", "hooded_archer_miniboss", "vampire"]:
			allowed_fields.append("patrol")
			if entity.has("patrol") and (not _is_finite_number(entity.patrol) or float(entity.patrol) < 8.0 or float(entity.patrol) > 600.0):
				return _failure("%s.patrol must be a number between 8 and 600." % path)
		elif entity_type == "vampire_castellan":
			allowed_fields.append("grants_sigil_on_defeat")
			if not entity.get("grants_sigil_on_defeat", null) is bool:
				return _failure("%s.grants_sigil_on_defeat must be a boolean." % path)
		elif entity_type == "chest":
			allowed_fields.append_array([
				"score_reward", "contains_sigil", "interaction_message", "chest_family",
				"guaranteed_jackpot", "rarity_override",
			])
			if entity.has("score_reward") and (not _is_integer_number(entity.score_reward) or int(entity.score_reward) < 0 or int(entity.score_reward) > 9999):
				return _failure("%s.score_reward must be an integer between 0 and 9999." % path)
			if entity.has("contains_sigil") and not entity.contains_sigil is bool:
				return _failure("%s.contains_sigil must be a boolean." % path)
			if entity.has("interaction_message") and not entity.interaction_message is String:
				return _failure("%s.interaction_message must be a string." % path)
			if entity.has("chest_family") and String(entity.chest_family) \
					not in ["auto", "regular", "monster"]:
				return _failure("%s.chest_family must be auto, regular, or monster." % path)
			if entity.has("guaranteed_jackpot") and not entity.guaranteed_jackpot is bool:
				return _failure("%s.guaranteed_jackpot must be a boolean." % path)
			if entity.has("rarity_override") and String(entity.rarity_override) not in [
				"random", "normal", "magic", "rare", "epic", "legendary", "crystal",
				"mythic", "eternal",
			]:
				return _failure("%s.rarity_override is not a supported core rarity." % path)
		elif entity_type == "reliquary_branch_seal":
			allowed_fields.append_array(["branch_id", "display_name", "interaction_message"])
			if not entity.get("branch_id", null) is String \
					or String(entity.get("branch_id", "")).strip_edges().is_empty():
				return _failure("%s.branch_id must be a non-empty string." % path)
			if entity.has("display_name") and not entity.display_name is String:
				return _failure("%s.display_name must be a string." % path)
			if entity.has("interaction_message") and not entity.interaction_message is String:
				return _failure("%s.interaction_message must be a string." % path)
		elif entity_type == "gate_seal":
			allowed_fields.append_array(["seal_id", "display_name", "interaction_message"])
			if not entity.get("seal_id", null) is String \
					or String(entity.get("seal_id", "")).strip_edges().is_empty():
				return _failure("%s.seal_id must be a non-empty string." % path)
			if entity.has("display_name") and not entity.display_name is String:
				return _failure("%s.display_name must be a string." % path)
			if entity.has("interaction_message") and not entity.interaction_message is String:
				return _failure("%s.interaction_message must be a string." % path)
		elif entity_type == "floor_door":
			allowed_fields.append_array(["target_position", "label", "message"])
			if not entity.has("target_position") or not entity.target_position is Array or entity.target_position.size() != 2:
				return _failure("%s.target_position must be exactly [x, y]." % path)
			if not _is_finite_number(entity.target_position[0]) or not _is_finite_number(entity.target_position[1]):
				return _failure("%s.target_position coordinates must be finite numbers." % path)
			var target_x := float(entity.target_position[0])
			var target_y := float(entity.target_position[1])
			if target_x < 0.0 or target_x >= pixel_width or target_y < 0.0 or target_y >= pixel_height:
				return _failure("%s.target_position is outside %dx%d pixel bounds." % [path, pixel_width, pixel_height])
			if entity.has("label") and not entity.label is String:
				return _failure("%s.label must be a string." % path)
			if entity.has("message") and not entity.message is String:
				return _failure("%s.message must be a string." % path)
		for raw_field: Variant in entity:
			if str(raw_field) not in allowed_fields:
				return _failure("%s contains unsupported field '%s'. Register it in LevelSchema and main.gd first." % [path, raw_field])
	if player_count != 1:
		return _failure("entities must contain exactly one player; found %d." % player_count)
	if exit_gate_count != 1:
		return _failure("entities must contain exactly one exit_gate; found %d." % exit_gate_count)
	return {"ok": true}


static func _validate_camera_bounds(metadata: Dictionary, pixel_width: int, pixel_height: int) -> Dictionary:
	if not metadata.has("camera_bounds"):
		return {"ok": true}
	var bounds: Variant = metadata["camera_bounds"]
	if not bounds is Array or bounds.size() != 4:
		return _failure("metadata.camera_bounds must be exactly [left, top, right, bottom].")
	for value: Variant in bounds:
		if not _is_finite_number(value):
			return _failure("metadata.camera_bounds values must be finite numbers.")
	var left := float(bounds[0])
	var top := float(bounds[1])
	var right := float(bounds[2])
	var bottom := float(bounds[3])
	if left < 0.0 or top < 0.0 or right <= left or bottom <= top:
		return _failure("metadata.camera_bounds must define a positive rectangle inside the level.")
	if right > pixel_width or bottom > pixel_height:
		return _failure("metadata.camera_bounds exceeds %dx%d pixel level bounds." % [pixel_width, pixel_height])
	return {"ok": true}


static func _validate_encounter_pack_model(metadata: Dictionary) -> Dictionary:
	if not metadata.has("encounter_pack_model"):
		return {"ok": true}
	var model_value: Variant = metadata["encounter_pack_model"]
	if not model_value is Dictionary:
		return _failure("metadata.encounter_pack_model must be an object.")
	var model: Dictionary = model_value
	if not model.get("enabled", null) is bool:
		return _failure("metadata.encounter_pack_model.enabled must be a boolean.")
	if not bool(model.enabled):
		return {"ok": true}
	var profile_stage: Variant = model.get("profile_stage", null)
	if not _is_integer_number(profile_stage) or int(profile_stage) < 1 or int(profile_stage) > 100:
		return _failure("metadata.encounter_pack_model.profile_stage must be an integer between 1 and 100.")
	var floor_count_value: Variant = model.get("floor_count", null)
	if not _is_integer_number(floor_count_value) or int(floor_count_value) < 1 or int(floor_count_value) > 20:
		return _failure("metadata.encounter_pack_model.floor_count must be an integer between 1 and 20.")
	if String(model.get("placement", "")) != "authored_camp_anchors":
		return _failure("metadata.encounter_pack_model.placement must be exactly 'authored_camp_anchors'.")
	if model.get("authored_counts_are_anchors", null) != true:
		return _failure("metadata.encounter_pack_model.authored_counts_are_anchors must be true.")
	for field: String in ["packs_per_floor_override", "members_per_pack_override"]:
		if model.has(field) and (
			not _is_integer_number(model[field])
			or int(model[field]) < 1
			or int(model[field]) > 20
		):
			return _failure("metadata.encounter_pack_model.%s must be an integer between 1 and 20." % field)
	if model.has("allow_difficulty_extra_packs") \
			and not model.allow_difficulty_extra_packs is bool:
		return _failure("metadata.encounter_pack_model.allow_difficulty_extra_packs must be a boolean.")
	var anchor_camp_ids := {}
	if model.has("anchor_camp_ids"):
		var anchor_ids_value: Variant = model.anchor_camp_ids
		if not anchor_ids_value is Array or (anchor_ids_value as Array).is_empty():
			return _failure("metadata.encounter_pack_model.anchor_camp_ids must contain at least one camp ID.")
		for raw_anchor_id: Variant in anchor_ids_value:
			if not raw_anchor_id is String or String(raw_anchor_id).strip_edges().is_empty():
				return _failure("metadata.encounter_pack_model.anchor_camp_ids must contain non-empty strings.")
			if anchor_camp_ids.has(String(raw_anchor_id)):
				return _failure("metadata.encounter_pack_model.anchor_camp_ids contains a duplicate camp ID.")
			anchor_camp_ids[String(raw_anchor_id)] = true

	var camps_value: Variant = metadata.get("combat_camps", null)
	if not camps_value is Array:
		return _failure("An enabled encounter pack model requires metadata.combat_camps.")
	var covered_floors := {}
	var found_anchor_camp_ids := {}
	for camp_index: int in (camps_value as Array).size():
		var raw_camp: Variant = (camps_value as Array)[camp_index]
		if not raw_camp is Dictionary:
			return _failure("metadata.combat_camps[%d] must be an object." % camp_index)
		var camp: Dictionary = raw_camp
		var camp_id := String(camp.get("id", ""))
		var floor_value: Variant = camp.get("floor", null)
		if not _is_integer_number(floor_value) \
				or int(floor_value) < 1 \
				or int(floor_value) > int(floor_count_value):
			return _failure("metadata.combat_camps[%d].floor is outside the encounter pack floor range." % camp_index)
		var enemy_ids: Variant = camp.get("enemy_ids", null)
		if not enemy_ids is Array or (enemy_ids as Array).is_empty():
			return _failure("metadata.combat_camps[%d].enemy_ids must contain authored encounter anchors." % camp_index)
		if anchor_camp_ids.is_empty() or anchor_camp_ids.has(camp_id):
			covered_floors[int(floor_value)] = true
			found_anchor_camp_ids[camp_id] = true
	for anchor_camp_id: String in anchor_camp_ids:
		if not found_anchor_camp_ids.has(anchor_camp_id):
			return _failure("metadata.encounter_pack_model references missing anchor camp '%s'." % anchor_camp_id)
	for floor_number: int in range(1, int(floor_count_value) + 1):
		if not covered_floors.has(floor_number):
			return _failure("metadata.encounter_pack_model floor %d has no authored combat-camp anchor." % floor_number)
	return {"ok": true}


static func _is_integer_number(value: Variant) -> bool:
	if value is int:
		return true
	if not value is float:
		return false
	var number := float(value)
	return is_finite(number) and number == floor(number)


static func _is_finite_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))


static func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}
