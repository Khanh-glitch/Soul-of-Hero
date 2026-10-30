extends RefCounted
## Resolves an A0-authoritative player appearance to a verified source asset.
## Presentation only: no save, inventory, equip, selection, fallback or input logic.

const MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
const SCHEMA := "soh.ui.avatar_appearance.v1"
const OWNER_SOURCE := "A0_OWNER_PROJECTION"


static func resolve(owner_snapshot: Dictionary, manifest: Dictionary = {}) -> Dictionary:
	if owner_snapshot.get("schema", "") != SCHEMA:
		return _blocked("", -1, "Invalid appearance snapshot.")
	if String(owner_snapshot.get("provenance", "")) != OWNER_SOURCE:
		return _blocked("", -1, "Appearance requires A0 owner state.")
	var gender := String(owner_snapshot.get("gender", ""))
	if gender not in ["male", "female"]:
		return _blocked(gender, -1, "Unsupported player identity.")
	var grade: Variant = owner_snapshot.get("armor_grade", null)
	if not grade is int or int(grade) not in [0, 1, 2]:
		return _blocked(gender, -1, "Unsupported equipment appearance.")
	var art := manifest
	if art.is_empty():
		if not FileAccess.file_exists(MANIFEST_PATH):
			return _blocked(gender, int(grade), "Verified avatar art manifest is missing.")
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
		if not parsed is Dictionary:
			return _blocked(gender, int(grade), "Avatar art manifest is invalid.")
		art = parsed
	var people: Variant = art.get("characters", {})
	if not people is Dictionary or not people.has(gender):
		return _blocked(gender, int(grade), "No verified art for this player identity.")
	var character: Variant = people[gender]
	if not character is Dictionary:
		return _blocked(gender, int(grade), "Character source record is invalid.")
	var appearances: Variant = character.get("armor_grades", {})
	if not appearances is Dictionary:
		return _blocked(gender, int(grade), "Character appearance sources are incomplete.")
	var source: Variant = appearances.get(str(int(grade)), {})
	if not source is Dictionary:
		return _blocked(gender, int(grade), "Matching armor appearance is not verified.")
	var texture_path := String(source.get("idle_sheet", ""))
	if texture_path.is_empty() or not ResourceLoader.exists(texture_path):
		return _blocked(gender, int(grade), "Matching avatar art is not installed.")
	var texture := load(texture_path) as Texture2D
	if texture == null:
		return _blocked(gender, int(grade), "Matching avatar art could not be loaded.")
	return {
		"status": "READY",
		"gender": gender,
		"armor_grade": int(grade),
		"texture": texture,
		"texture_path": texture_path,
		"source_pack": String(source.get("source_pack", "")),
		"owner_revision": String(owner_snapshot.get("revision", "")),
	}


static func _blocked(gender: String, grade: int, reason: String) -> Dictionary:
	return {
		"status": "SOURCE_BLOCKED",
		"gender": gender,
		"armor_grade": grade,
		"texture": null,
		"texture_path": "",
		"reason": reason,
	}
