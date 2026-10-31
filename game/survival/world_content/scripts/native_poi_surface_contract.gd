class_name NativePoiSurfaceContract
extends RefCounted

## A8 local surface metadata. It never owns global weather/time, footprints, or
## persistent progression; the only world context it accepts is owner-provided.

const CONTRACT_PATH := "res://data/survival/world_content/surface_affordances.v1.json"
const ENVIRONMENT_CONTRACT_ID := "soh.a8.environment_presentation_input.v1"


static func load_contract() -> Dictionary:
	if not FileAccess.file_exists(CONTRACT_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONTRACT_PATH))
	if not parsed is Dictionary or parsed.get("schema") != "soh.a8.local_surface_affordance.v1":
		return {}
	return parsed


static func site_surface(source_poi_id: String) -> Dictionary:
	var contract := load_contract()
	var sites: Dictionary = contract.get("site_surfaces", {})
	var site: Variant = sites.get(source_poi_id, {})
	return site.duplicate(true) if site is Dictionary else {}


static func unknown_environment(source_poi_id: String) -> Dictionary:
	return {
		"contract_id": ENVIRONMENT_CONTRACT_ID,
		"site_id": source_poi_id,
		"projection_revision": -1,
		"world_time": "UNKNOWN",
		"weather": "UNKNOWN",
		"tide": "UNKNOWN",
	}


static func normalize_environment_projection(
	candidate: Dictionary, expected_poi_id: String
) -> Dictionary:
	if str(candidate.get("contract_id", "")) != ENVIRONMENT_CONTRACT_ID:
		return {}
	if str(candidate.get("site_id", "")) != expected_poi_id:
		return {}
	var revision: Variant = candidate.get("projection_revision", null)
	if typeof(revision) != TYPE_INT or int(revision) < 0:
		return {}
	var normalized := unknown_environment(expected_poi_id)
	normalized.projection_revision = int(revision)
	for field: String in ["world_time", "weather", "tide"]:
		var value: Variant = candidate.get(field, null)
		if value == null:
			continue
		if typeof(value) != TYPE_STRING or str(value).is_empty():
			return {}
		normalized[field] = str(value)
	return normalized
