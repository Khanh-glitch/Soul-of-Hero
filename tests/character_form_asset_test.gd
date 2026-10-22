extends SceneTree

const KnightAnimations := preload("res://game/characters/knight/knight_animation_library.gd")
const AxeWarriorAnimations := preload("res://game/characters/knight/axe_warrior_animation_library.gd")
const AXE: WeaponDefinition = preload("res://game/weapons/data/axe.tres")

var _checks := 0
var _failures: Array[String] = []


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var default_frames := KnightAnimations.build()
	var axe_frames := AxeWarriorAnimations.build()
	_expect(axe_frames.get_animation_names().size() == KnightAnimations.SPECS.size(), "Axe form exposes the complete canonical animation set")
	for raw_name: String in KnightAnimations.SPECS:
		var animation_name := StringName(raw_name)
		var spec: Array = KnightAnimations.SPECS[raw_name]
		var first_frame := axe_frames.get_frame_texture(animation_name, 0) as AtlasTexture
		_expect(
			axe_frames.has_animation(animation_name)
			and axe_frames.get_frame_count(animation_name) == int(spec[1]),
			"Axe form %s has %d authored frames" % [raw_name, int(spec[1])]
		)
		_expect(
			first_frame != null and first_frame.atlas.resource_path.begins_with(AxeWarriorAnimations.ROOT),
			"Axe form %s resolves from AxeWarriorRPG" % raw_name
		)
	var axe_idle := axe_frames.get_frame_texture(&"idle", 0) as AtlasTexture
	var knight_idle := default_frames.get_frame_texture(&"idle", 0) as AtlasTexture
	_expect(axe_idle != null and knight_idle != null and axe_idle.atlas != knight_idle.atlas, "Axe and FreeKnight forms use distinct raster atlases")
	_expect(
		axe_idle != null
		and axe_idle.atlas.resource_path.begins_with(AxeWarriorAnimations.ROOT),
		"Axe form resolves textures from the imported AxeWarriorRPG folder"
	)
	var png_count := 0
	for filename: String in DirAccess.get_files_at(AxeWarriorAnimations.ROOT):
		if filename.get_extension().to_lower() == "png":
			png_count += 1
	var expected_sheet_files: Dictionary = {}
	for raw_name: String in KnightAnimations.SPECS:
		expected_sheet_files[String(KnightAnimations.SPECS[raw_name][0])] = true
	_expect(
		png_count == expected_sheet_files.size(),
		"runtime Axe import contains one PNG for every unique canonical source sheet"
	)
	_expect(AXE.hand_animation_library == &"axe_warrior_rpg", "Axe definition selects the full AxeWarriorRPG character form")
	_expect(is_equal_approx(axe_frames.get_animation_speed(&"idle"), 12.5), "Axe Idle uses source-manifest timing")
	_expect(is_equal_approx(axe_frames.get_animation_speed(&"run"), 16.666667), "Axe Run uses source-manifest timing")
	_expect(is_equal_approx(axe_frames.get_animation_speed(&"heavy_attack"), 16.666667), "Axe Heavy animation uses source-manifest timing")
	_finish()


func _finish() -> void:
	if _failures.is_empty():
		print("CHARACTER FORM ASSET TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("CHARACTER FORM ASSET TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
