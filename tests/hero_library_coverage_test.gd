extends SceneTree

## Hero Library coverage contract: all authored Hero identities must have a
## readable, navigable card with a real portrait and canonical skill-kit data.
const CATALOG := preload("res://game/heroes/hero_library_catalog.gd")
const LIBRARY_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/components/hero_library_panel.tscn"
)

const EXPECTED_IDS := [
	&"sword_hero", &"archer_hero", &"axe_hero", &"wizard_hero",
]

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var hero_ids: Array[StringName] = CATALOG.hero_ids()
	_expect(hero_ids == EXPECTED_IDS, "Hero Library lists all four authored identities")
	for hero_id: StringName in EXPECTED_IDS:
		var profile: Dictionary = CATALOG.profile(hero_id)
		_expect(not profile.is_empty(), "%s has a nonempty profile" % hero_id)
		if profile.is_empty():
			continue
		_expect(String(profile.get("hero_id", "")) == String(hero_id),
			"%s uses its canonical Hero ID" % hero_id)
		_expect(not String(profile.get("display_name", "")).is_empty(),
			"%s displays its canonical name" % hero_id)
		_expect(not String(profile.get("summary", "")).is_empty(),
			"%s has a readable role summary" % hero_id)
		_expect((profile.get("rarities", []) as Array).size() == 8,
			"%s exposes all eight Hero Weapon rarities" % hero_id)
		_expect((profile.get("basic_skills", []) as Array).size() >= 2,
			"%s exposes two basic skills" % hero_id)
		_expect((profile.get("advanced_skills", []) as Array).size() >= 2,
			"%s exposes two advanced skills" % hero_id)
		_expect((profile.get("soul_skills", []) as Array).size() >= 1,
			"%s exposes its Soul action" % hero_id)
		_expect((profile.get("departure_skills", []) as Array).size() >= 1,
			"%s exposes its departure action" % hero_id)
		_expect(FileAccess.file_exists(String(profile.get("portrait", ""))),
			"%s portrait references a real atlas" % hero_id)

	var host := Control.new()
	host.size = Vector2(640, 260)
	root.add_child(host)
	var library := LIBRARY_SCENE.instantiate() as HeroLibraryPanel
	_expect(library != null, "production Hero Library scene instantiates")
	if library == null:
		host.free()
		_finish()
		return
	host.add_child(library)
	library.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	await process_frame

	var rail_scroll := library.find_child("RailScroll", true, false) as ScrollContainer
	_expect(rail_scroll != null, "four-Hero rail has a real scrolling container")
	for hero_id: StringName in EXPECTED_IDS:
		var id_copy := String(hero_id)
		var button_name := "%sLibraryButton" % id_copy.to_pascal_case()
		var button := library.find_child(button_name, true, false) as Button
		_expect(button != null, "%s has a navigable Library button" % id_copy)
		if button == null:
			continue
		button.pressed.emit()
		await process_frame
		var portrait_name := "KNightPortrait" if hero_id == &"sword_hero" \
			else "%sPortrait" % id_copy.to_pascal_case()
		var portrait := library.find_child(portrait_name, true, false) as TextureRect
		_expect(portrait != null and portrait.texture != null,
			"%s shows its own portrait" % id_copy)
		if portrait != null:
			var atlas := portrait.texture as AtlasTexture
			_expect(atlas != null and atlas.region.size ==
				Vector2(CATALOG.profile(hero_id).get("portrait_frame_size", Vector2.ZERO)),
				"%s crops a full animation frame, not an arbitrary thumbnail" % id_copy)

	host.free()
	_finish()


func _expect(passed: bool, message: String) -> void:
	_checks += 1
	if not passed:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("HERO LIBRARY COVERAGE TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("HERO LIBRARY COVERAGE TEST FAILED - %d / %d" % [_failures.size(), _checks])
	quit(1)
