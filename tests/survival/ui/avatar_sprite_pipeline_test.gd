extends SceneTree

const PIPELINE := preload("res://game/survival/ui/avatar_sprite_pipeline.gd")
const MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)


func _directional_sheet() -> Dictionary:
	var image := Image.create(4, 8, false, Image.FORMAT_RGBA8)
	for y in range(8):
		for x in range(4):
			image.set_pixel(x, y, Color(float(y / 2) / 4.0, float(x / 2) / 2.0, 0.5, 1.0))
	var texture := ImageTexture.create_from_image(image)
	return {
		"texture": texture,
		"frame_size": [2, 2],
		"fps": 8.0,
		"loop": true,
		"directions": {
			"front": {"row": 0, "frames": 2},
			"side_left": {"row": 1, "frames": 2},
			"side_right": {"row": 2, "frames": 2},
			"back": {"row": 3, "frames": 2},
		},
	}


func _run() -> void:
	var manifest: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
	_check(manifest is Dictionary, "load avatar manifest alongside the runtime pipeline")
	if manifest is Dictionary:
		var gate: Dictionary = manifest.get("runtime_presentation_pipeline", {})
		_check(
			gate.get("schema", "") == "soh.a6.avatar_sprite_pipeline.v1"
			and gate.get("status", "") == "IMPLEMENTED; SOURCE_LICENSE_BLOCKED",
			"manifest distinguishes the versioned controller contract from unverified art licensing"
		)
		_check(
			gate.get("runtime_action_sheets", {}) == {},
			"unlicensed source sheets are not exposed as runtime resources"
		)
	_check(
		PIPELINE.build_sprite_frames({}).status == "SOURCE_BLOCKED",
		"empty manifest fails closed instead of rendering a substitute"
	)
	if manifest is Dictionary:
		var owner := {
			"schema": "soh.ui.avatar_appearance.v1",
			"provenance": "A0_OWNER_PROJECTION",
			"revision": "owner-avatar-1",
			"gender": "female",
			"armor_grade": 0,
		}
		var selected_record := PIPELINE.lookup_appearance_record(owner, manifest)
		_check(
			selected_record.get("status", "") == "RECORD_FOUND"
			and selected_record.get("gender", "") == "female"
			and selected_record.get("craftpix_id", "") == "419402"
			and selected_record.get("armor_grade", -1) == 0,
			"A0 appearance lookup retains the exact selected identity and equipped grade"
		)
		var blocked_sources := PIPELINE.action_sources_for_owner(owner, manifest)
		_check(
			blocked_sources.get("status", "") == "SOURCE_BLOCKED"
			and String(blocked_sources.get("reason", "")).contains("license"),
			"unverified source license blocks runtime sheets even if an identity record exists"
		)
		var blocked_owner := PIPELINE.resolve_owner_appearance(owner, manifest)
		_check(
			blocked_owner.get("status", "") == "SOURCE_BLOCKED"
			and blocked_owner.get("gender", "") == "female",
			"owner-to-manifest pipeline preserves identity and blocks licensed runtime art"
		)
		var male_owner := owner.duplicate(true)
		male_owner.gender = "male"
		var male_record := PIPELINE.lookup_appearance_record(male_owner, manifest)
		_check(
			male_record.get("status", "") == "RECORD_FOUND"
			and male_record.gender == "male"
			and male_record.get("craftpix_id", "") == "555940",
			"male owner cannot select the female or substituted character record"
		)
		var unsupported_grade := owner.duplicate(true)
		unsupported_grade.armor_grade = 1
		_check(
			PIPELINE.lookup_appearance_record(unsupported_grade, manifest).status == "SOURCE_BLOCKED",
			"unverified armor grade cannot borrow the base or another tier's frames"
		)
	var built: Dictionary = PIPELINE.build_sprite_frames({"idle": _directional_sheet()})
	_check(built.status == "READY", "synthetic authorized sheet builds directional SpriteFrames")
	if built.status == "READY":
		var frames: SpriteFrames = built.sprite_frames
		for index in PIPELINE.DIRECTIONS.size():
			var direction: String = PIPELINE.DIRECTIONS[index]
			var animation := StringName("idle/" + direction)
			_check(frames.has_animation(animation), "built animation exists for " + direction)
			_check(frames.get_frame_count(animation) == 2, "animation frame count is preserved for " + direction)
			var first_frame := frames.get_frame_texture(animation, 0) as AtlasTexture
			_check(
				first_frame != null and first_frame.region.position == Vector2(0, index * 2),
				"direction " + direction + " slices its declared row"
			)
		var sprite := AnimatedSprite2D.new()
		var appearance := {"status": "READY", "sprite_frames": frames}
		_check(PIPELINE.present(sprite, appearance, "idle", "side_left"), "host-supplied movement state selects a real directional animation")
		_check(sprite.animation == &"idle/side_left", "selected direction reaches AnimatedSprite2D without inference")
		_check(not PIPELINE.present(sprite, appearance, "attack", "side_left"), "missing combat sheet blocks rather than faking or substituting an attack")
		_check(sprite.animation == &"idle/side_left", "blocked action does not alter the last valid presentation")
		sprite.free()
	var malformed := _directional_sheet()
	malformed.frame_size = [3, 2]
	_check(
		PIPELINE.build_sprite_frames({"idle": malformed}).status == "SOURCE_BLOCKED",
		"invalid sheet grid fails closed"
	)
	var incomplete := _directional_sheet()
	incomplete.directions.erase("back")
	_check(
		PIPELINE.build_sprite_frames({"walk": incomplete}).status == "SOURCE_BLOCKED",
		"missing direction cannot silently reuse another direction"
	)
	if failures.is_empty():
		print("A6 AVATAR SPRITE PIPELINE PASSED - %d checks" % checks)
		quit(0)
	else:
		printerr("A6 AVATAR SPRITE PIPELINE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
