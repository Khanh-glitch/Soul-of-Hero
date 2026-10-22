extends Control

## Visual verification with Godot 4.7 GL Compatibility under Xvfb.
## Each run captures the actual production Roster Team and Equipment tabs.
const ROSTER_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/arsenal_tab.tscn"
)
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const ARTIFACT_DIR := "res://.artifacts"

var _expected := Vector2i(1280, 720)
var _failed := false


func _ready() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--expected-width="):
			_expected.x = int(arg.get_slice("=", 1))
		if arg.begins_with("--expected-height="):
			_expected.y = int(arg.get_slice("=", 1))
	_run.call_deferred()


func _run() -> void:
	var save := get_node_or_null("/root/SaveService")
	_check(save != null, "SaveService autoload exists")
	if save == null:
		_finish()
		return
	var gear := AUX_RULES.generate_item(
		&"soul_vessel", &"normal", 1, 81025, &"hero_roster_visual"
	)
	_check(AUX_RULES.validate_item(gear).is_empty(), "Authored Armor fixture validates")
	_check(save.grant_auxiliary_equipment(
		gear, "test:hero_roster:visual:armor"
	), "Fixture equips a valid previewable Armor item")
	var roster := ROSTER_SCENE.instantiate() as Control
	_check(roster != null, "Production Hero Roster instantiates")
	if roster == null:
		_finish()
		return
	add_child(roster)
	roster.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for _n: int in 5:
		await get_tree().process_frame
	var tabs := roster.find_child("RosterTabs", true, false) as TabContainer
	_check(tabs != null and tabs.get_tab_count() == 5,
		"Real Hero Roster contains all five tabs")
	if tabs == null:
		_finish()
		return
	_check(tabs.current_tab == 1, "Team tab opens first")
	_check(roster.size.x > 0 and roster.size.y > 0,
		"Hero Roster has nonzero layout dimensions")
	await _capture("team")
	tabs.current_tab = 4
	roster.call("_select_equipment_preview", "armor", String(gear["uuid"]))
	for _n: int in 4:
		await get_tree().process_frame
	var comparison := roster.find_child("EquipmentComparisonDelta", true, false) as Label
	_check(comparison != null and comparison.is_visible_in_tree(),
		"Preview delta is visible in Equipment tab")
	if comparison != null:
		_check(comparison.size.x > 0 and comparison.size.y > 0,
			"Preview has measurable layout")
		_check(comparison.text.contains("HP") and comparison.text.contains("POWER"),
			"Preview displays actual combat metrics")
	await _capture("equipment")
	_finish()


func _capture(tab_name: String) -> void:
	for _n: int in 4:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	_check(Vector2i(image.get_width(), image.get_height()) == _expected,
		"Rendered %s screenshot matches %dx%d" % [
			tab_name, _expected.x, _expected.y
		])
	var sampled := 0
	var visible := 0
	for y: int in range(0, image.get_height(), 10):
		for x: int in range(0, image.get_width(), 10):
			sampled += 1
			if image.get_pixel(x, y).get_luminance() > 0.035:
				visible += 1
	_check(float(visible) / float(maxi(1, sampled)) > 0.03,
		"%s screenshot is not an empty/dark frame" % tab_name)
	DirAccess.make_dir_recursive_absolute(
		ProjectSettings.globalize_path(ARTIFACT_DIR)
	)
	var name := "hero_roster_%s_%dx%d.png" % [
		tab_name, _expected.x, _expected.y
	]
	_check(image.save_png(ProjectSettings.globalize_path(
		"%s/%s" % [ARTIFACT_DIR, name]
	)) == OK, "Saves real %s screenshot" % name)
	print("HERO ROSTER VISUAL CAPTURE: " + name)


func _check(condition: bool, detail: String) -> void:
	if not condition:
		_failed = true
		push_error("HERO ROSTER VISUAL CHECK FAILED: " + detail)


func _finish() -> void:
	if not _failed:
		print("HERO ROSTER VISUAL CAPTURE PASSED: %dx%d" % [
			_expected.x, _expected.y
		])
	get_tree().quit(1 if _failed else 0)
