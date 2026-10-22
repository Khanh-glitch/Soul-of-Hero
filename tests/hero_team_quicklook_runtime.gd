extends Control

## Loaded as an actual project scene, not --script: SaveService and GameEvents
## autoloads are available to the Hero Roster implementation.
const ROSTER_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/arsenal_tab.tscn"
)
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := get_node_or_null("/root/SaveService")
	_expect(save != null, "Real project scene has SaveService autoload")
	_expect(get_node_or_null("/root/GameEvents") != null,
		"Real project scene has GameEvents autoload")
	var gear := AUX_RULES.generate_item(
		&"soul_vessel", &"normal", 1, 771901, &"h1_3_preview_runtime"
	)
	_expect(AUX_RULES.validate_item(gear).is_empty(),
		"Runtime preview fixture is a valid authored Armor item")
	var granted := false
	if save != null and save.has_method("grant_auxiliary_equipment"):
		granted = bool(save.call(
			"grant_auxiliary_equipment", gear, "test:h1_3:preview:grant"
		))
	_expect(granted, "Runtime fixture grants one Armor to the test profile")
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
	if tabs != null and granted:
		tabs.current_tab = 4
		await get_tree().process_frame
		var item_row_name := "AuxItemVisual_%s" % String(gear["uuid"]).left(8)
		var item_row := roster.find_child(item_row_name, true, false)
		_expect(item_row != null, "Equipped-items panel renders the granted Armor")
		var compare: Button
		if item_row != null:
			var box := item_row.get_parent()
			for row_node: Node in box.get_children():
				for node: Node in row_node.get_children():
					if node is Button and (node as Button).text == "XEM ±":
						compare = node as Button
						break
		_expect(compare != null, "Armor has an actionable what-if preview button")
		if compare != null:
			_expect(compare.is_visible_in_tree() and compare.size.x >= 65.0,
				"Compare action has readable width in the actual Roster scene")
			var bounds := compare.get_global_rect()
			var host_bounds: Rect2 = roster.get_global_rect()
			_expect(bounds.position.x >= host_bounds.position.x
				and bounds.end.x <= host_bounds.end.x + 1.0,
				"Compare action is not clipped beyond the Roster horizontal bounds")
		if compare != null and save.has_method("get_snapshot"):
			var before_preview: Dictionary = save.call("get_snapshot")
			compare.pressed.emit()
			await get_tree().process_frame
			await get_tree().process_frame
			var comparison := roster.find_child(
				"EquipmentComparisonDelta", true, false
			) as Label
			_expect(comparison != null,
				"Clicking XEM ± renders the actual EquipmentComparisonDelta")
			_expect(comparison != null and "HP" in comparison.text
				and "POWER" in comparison.text and "MANA" in comparison.text,
				"Displayed item comparison includes canonical HP, Power and Mana")
			_expect(String(roster.get("_equipment_preview_instance")) == String(gear["uuid"]),
				"Click selects the exact Armor instance UUID")
			_expect(save.call("get_snapshot") == before_preview,
				"Preview click does not mutate SaveService")
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
