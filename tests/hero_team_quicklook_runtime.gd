extends Control

## Loaded as an actual project scene, not --script: SaveService and GameEvents
## autoloads are available to the Hero Roster implementation.
const ROSTER_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/arsenal_tab.tscn"
)

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := get_node_or_null("/root/SaveService")
	_expect(save != null, "Real project scene has SaveService autoload")
	_expect(get_node_or_null("/root/GameEvents") != null,
		"Real project scene has GameEvents autoload")
	var roster := ROSTER_SCENE.instantiate()
	add_child(roster)
	roster.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	await get_tree().process_frame
	await get_tree().process_frame
	var tabs := roster.find_child("RosterTabs", true, false) as TabContainer
	_expect(tabs != null and tabs.get_tab_count() == 5,
		"Production Hero Roster renders its five tabs")
	if tabs != null:
		_expect(tabs.current_tab == 1, "Hero Roster opens Team & Souls first")
	var quick_row := roster.find_child("TeamQuickLook", true, false) as HBoxContainer
	var active := roster.find_child("ActiveQuickLook", true, false) as Label
	var reserve := roster.find_child("ReserveQuickLook", true, false) as Label
	_expect(quick_row != null and quick_row.get_child_count() == 2,
		"Production Roster renders exactly two compact overview columns")
	_expect(active != null and "CHỦ LỰC" in active.text,
		"Active team summary is present and labeled")
	_expect(reserve != null and "DỰ BỊ" in reserve.text,
		"Reserve team summary is present and labeled")
	_expect(active != null and active.size.x > 0,
		"Active quick-look summary receives visible layout width")
	_expect(reserve != null and reserve.size.x > 0,
		"Reserve quick-look summary receives visible layout width")
	_finish()


func _expect(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("HERO TEAM RUNTIME SCENE TEST PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("HERO TEAM RUNTIME SCENE TEST FAILED - %d / %d" % [
		_failures.size(), _checks,
	])
	get_tree().quit(1)
