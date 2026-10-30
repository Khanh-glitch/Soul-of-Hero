extends RefCounted
## A6-only adapter from an already authorized appearance's directional sheets to
## SpriteFrames. It never reads input, changes equipment, selects a player
## identity, writes save state, or substitutes a missing action/direction.

const ACTIONS := ["idle", "walk", "run", "attack", "walk_attack", "run_attack", "hurt", "death"]
const DIRECTIONS := ["front", "side_left", "side_right", "back"]
const MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
const APPEARANCE_ADAPTER := preload("res://game/survival/ui/avatar_appearance_adapter.gd")


## Looks up only the source record selected by A0. This returns manifest metadata,
## not a playable texture; the license gate is enforced before any runtime load.
static func lookup_appearance_record(owner_snapshot: Dictionary, manifest: Dictionary) -> Dictionary:
	var gender_value: Variant = owner_snapshot.get("gender", null)
	var gender := String(gender_value) if gender_value is String else ""
	var grade_value: Variant = owner_snapshot.get("armor_grade", null)
	var revision_value: Variant = owner_snapshot.get("revision", null)
	var revision := String(revision_value).strip_edges() if revision_value is String else ""
	if (
		owner_snapshot.get("schema", "") != "soh.ui.avatar_appearance.v1"
		or owner_snapshot.get("provenance", "") != "A0_OWNER_PROJECTION"
		or revision.is_empty()
		or gender not in ["male", "female"]
		or not grade_value is int
		or int(grade_value) not in [0, 1, 2]
	):
		return _blocked_for_owner(gender, -1, revision, "A0 appearance snapshot is invalid.")
	var people_value: Variant = manifest.get("characters", {})
	if not people_value is Dictionary:
		return _blocked_for_owner(gender, int(grade_value), revision, "Identity-specific avatar sources are missing.")
	var person_value: Variant = people_value.get(gender, null)
	if not person_value is Dictionary:
		return _blocked_for_owner(gender, int(grade_value), revision, "Matching player identity has no avatar record.")
	var grades_value: Variant = person_value.get("armor_grades", {})
	if not grades_value is Dictionary:
		return _blocked_for_owner(gender, int(grade_value), revision, "Matching equipment appearance has no source record.")
	var record_value: Variant = grades_value.get(str(int(grade_value)), null)
	if not record_value is Dictionary:
		return _blocked_for_owner(gender, int(grade_value), revision, "Matching equipment appearance is not verified.")
	return {
		"status": "RECORD_FOUND",
		"gender": gender,
		"craftpix_id": String(person_value.get("craftpix_id", "")),
		"source_pack": String(person_value.get("source_pack", "")),
		"armor_grade": int(grade_value),
		"owner_revision": revision,
		"record": record_value.duplicate(true),
	}


## Resolves the saved identity/equipment through A0, then builds only authorized
## runtime frames. No source record or texture is fabricated on a blocked result.
static func resolve_owner_appearance(owner_snapshot: Dictionary, manifest: Dictionary = {}) -> Dictionary:
	var selected_manifest := manifest
	if selected_manifest.is_empty():
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
		if not parsed is Dictionary:
			return _blocked("Avatar art manifest is invalid.")
		selected_manifest = parsed
	var pipeline_value: Variant = selected_manifest.get("runtime_presentation_pipeline", {})
	if not pipeline_value is Dictionary or pipeline_value.get("schema", "") != "soh.a6.avatar_sprite_pipeline.v1":
		return _blocked("Runtime avatar pipeline manifest is missing or unsupported.")
	var sources := action_sources_for_owner(owner_snapshot, selected_manifest)
	if sources.get("status", "") != "READY":
		return sources
	var resolved: Dictionary = APPEARANCE_ADAPTER.resolve(owner_snapshot, selected_manifest)
	if resolved.get("status", "") != "READY":
		return resolved
	if (
		resolved.get("gender", "") != sources.get("gender", "")
		or resolved.get("armor_grade", -1) != sources.get("armor_grade", -2)
		or resolved.get("owner_revision", "") != sources.get("owner_revision", "")
	):
		return _blocked("Owner identity changed during appearance resolution.")
	var action_sheets_value: Variant = sources.get("action_sheets", null)
	if not action_sheets_value is Dictionary:
		return _blocked_for_owner(
			String(sources.get("gender", "")), int(sources.get("armor_grade", -1)),
			String(sources.get("owner_revision", "")), "Resolved avatar action sheets are invalid."
		)
	var action_sheets: Dictionary = action_sheets_value
	var built := build_sprite_frames(action_sheets)
	if built.get("status", "") != "READY":
		return built
	resolved["sprite_frames"] = built["sprite_frames"]
	return resolved


## Converts the A0-selected record into runtime sources only after the explicit
## game-use license gate passes. Each record is scoped to one gender and grade.
static func action_sources_for_owner(owner_snapshot: Dictionary, manifest: Dictionary) -> Dictionary:
	var selected := lookup_appearance_record(owner_snapshot, manifest)
	if selected.get("status", "") != "RECORD_FOUND":
		return selected
	var license_value: Variant = manifest.get("license_review", {})
	if not license_value is Dictionary or license_value.get("status", "") != "VERIFIED_GAME_USE":
		return _blocked_for_owner(
			String(selected.gender), int(selected.armor_grade), String(selected.owner_revision),
			"Avatar source license is not verified for game use."
		)
	var sources_value: Variant = selected.record.get("runtime_action_sheets", null)
	if not sources_value is Dictionary or sources_value.is_empty():
		return _blocked_for_owner(
			String(selected.gender), int(selected.armor_grade), String(selected.owner_revision),
			"Identity-specific runtime action sheets are not installed."
		)
	return {
		"status": "READY",
		"gender": selected.gender,
		"armor_grade": selected.armor_grade,
		"owner_revision": selected.owner_revision,
		"action_sheets": sources_value.duplicate(true),
	}


## Each action record contains `texture` (Texture2D) or `texture_path`,
## `frame_size` ([width, height]), `fps`, `loop`, and a `directions` map whose
## entries contain `row` and `frames`. The manifest is deliberately data-only;
## source rows must be reviewed before licensed art is installed.
static func build_sprite_frames(action_sheets: Dictionary) -> Dictionary:
	if action_sheets.is_empty():
		return _blocked("No authorized directional sprite sheets are installed.")
	var output := SpriteFrames.new()
	output.clear_all()
	var actions: Array = action_sheets.keys()
	actions.sort()
	for raw_action: Variant in actions:
		var action := String(raw_action)
		if action not in ACTIONS:
			return _blocked("Unsupported sprite action.")
		var raw_record: Variant = action_sheets[raw_action]
		if not raw_record is Dictionary:
			return _blocked("Sprite action record is invalid.")
		var record: Dictionary = raw_record
		var texture: Texture2D = _resolve_texture(record)
		if texture == null:
			return _blocked("Authorized sprite texture is unavailable.")
		var frame_size_value: Variant = record.get("frame_size", null)
		if not frame_size_value is Array or frame_size_value.size() != 2:
			return _blocked("Sprite frame size is invalid.")
		var frame_size := Vector2i(int(frame_size_value[0]), int(frame_size_value[1]))
		var texture_size := texture.get_size()
		if (
			frame_size.x <= 0
			or frame_size.y <= 0
			or int(texture_size.x) % frame_size.x != 0
			or int(texture_size.y) % frame_size.y != 0
		):
			return _blocked("Sprite sheet dimensions do not match the declared frame grid.")
		var fps_value: Variant = record.get("fps", null)
		if (not fps_value is int and not fps_value is float) or float(fps_value) <= 0.0:
			return _blocked("Sprite animation speed is invalid.")
		var loop_value: Variant = record.get("loop", null)
		if not loop_value is bool:
			return _blocked("Sprite loop policy is missing.")
		var directions_value: Variant = record.get("directions", null)
		if not directions_value is Dictionary:
			return _blocked("Directional sprite rows are missing.")
		var directions: Dictionary = directions_value
		for direction: String in DIRECTIONS:
			var spec_value: Variant = directions.get(direction, null)
			if not spec_value is Dictionary:
				return _blocked("A required directional row is missing.")
			var spec: Dictionary = spec_value
			var row_value: Variant = spec.get("row", null)
			var count_value: Variant = spec.get("frames", null)
			var columns := int(texture_size.x) / frame_size.x
			var rows := int(texture_size.y) / frame_size.y
			if (
				not row_value is int
				or not count_value is int
				or int(row_value) < 0
				or int(row_value) >= rows
				or int(count_value) < 1
				or int(count_value) > columns
			):
				return _blocked("Directional sprite frame bounds are invalid.")
			var animation_name := StringName(action + "/" + direction)
			output.add_animation(animation_name)
			output.set_animation_speed(animation_name, float(fps_value))
			output.set_animation_loop(animation_name, bool(loop_value))
			for frame_index in int(count_value):
				var atlas_frame := AtlasTexture.new()
				atlas_frame.atlas = texture
				atlas_frame.region = Rect2(
					Vector2(frame_index * frame_size.x, int(row_value) * frame_size.y),
					Vector2(frame_size.x, frame_size.y)
				)
				output.add_frame(animation_name, atlas_frame)
			if bool(spec.get("repeat_last_frame", false)):
				var final_frame := AtlasTexture.new()
				final_frame.atlas = texture
				final_frame.region = Rect2(
					Vector2((int(count_value) - 1) * frame_size.x, int(row_value) * frame_size.y),
					Vector2(frame_size.x, frame_size.y)
				)
				output.add_frame(animation_name, final_frame)
	return {"status": "READY", "sprite_frames": output, "reason": ""}


## Applies only a previously resolved A0-owned appearance. The game host must
## supply its own action/direction; this adapter does not poll gameplay input.
static func present(
		sprite: AnimatedSprite2D,
		appearance: Dictionary,
		action: String,
		direction: String,
) -> bool:
	if not is_instance_valid(sprite) or appearance.get("status", "") != "READY":
		return false
	if action not in ACTIONS or direction not in DIRECTIONS:
		return false
	var frames_value: Variant = appearance.get("sprite_frames", null)
	if not frames_value is SpriteFrames:
		return false
	var frames: SpriteFrames = frames_value
	var animation_name := StringName(action + "/" + direction)
	if not frames.has_animation(animation_name):
		return false
	sprite.sprite_frames = frames
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	if sprite.animation != animation_name:
		sprite.play(animation_name)
	elif frames.get_animation_loop(animation_name) and not sprite.is_playing():
		sprite.play(animation_name)
	return true


static func _resolve_texture(record: Dictionary) -> Texture2D:
	var candidate: Variant = record.get("texture", null)
	if candidate is Texture2D:
		return candidate
	var path_value: Variant = record.get("texture_path", null)
	if not path_value is String:
		return null
	var path := String(path_value)
	if path.is_empty() or not ResourceLoader.exists(path):
		return null
	return load(path) as Texture2D


static func _blocked_for_owner(gender: String, grade: int, revision: String, reason: String) -> Dictionary:
	return {
		"status": "SOURCE_BLOCKED",
		"gender": gender,
		"armor_grade": grade,
		"owner_revision": revision,
		"sprite_frames": null,
		"reason": reason,
	}


static func _blocked(reason: String) -> Dictionary:
	return {"status": "SOURCE_BLOCKED", "sprite_frames": null, "reason": reason}
