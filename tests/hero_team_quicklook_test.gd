extends SceneTree

## Functional contract for a compact, honest two-Hero loadout summary.
const ROSTER_SCENE: PackedScene = preload(
	"res://game/ui/screens/hub/tabs/arsenal_tab.tscn"
)

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var roster := ROSTER_SCENE.instantiate()
	root.add_child(roster)
	await process_frame
	var tabs := roster.find_child("RosterTabs", true, false) as TabContainer
	_expect(tabs != null, "Hero Roster has tabs")
	if tabs != null:
		_expect(tabs.current_tab == 1, "Hero Roster opens actionable Team & Souls first")
	var quick_row := roster.find_child("TeamQuickLook", true, false) as HBoxContainer
	var active_label := roster.find_child("ActiveQuickLook", true, false) as Label
	var reserve_label := roster.find_child("ReserveQuickLook", true, false) as Label
	_expect(quick_row != null, "Team tab renders compact two-Hero summary")
	_expect(active_label != null and reserve_label != null,
		"Both active and reserve summary labels are present")
	if quick_row != null:
		_expect(quick_row.get_child_count() == 2,
			"Team summary has exactly two balanced columns")

	var fixture := {
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": ["archer_hero"],
			"selected_soul_instances": {
				"sword_hero": "sword-1",
				"archer_hero": "archer-1",
			},
		},
		"inventory": {
			"hero_souls": [
				{"instance_id": "sword-1", "hero_id": "sword_hero",
				 "rarity": 2, "item_level": 5},
				{"instance_id": "archer-1", "hero_id": "archer_hero",
				 "rarity": 1, "item_level": 2},
			],
			"auxiliary_equipment": [
				{"uuid": "armor-1", "slot": "soul_vessel"},
				{"uuid": "jewel-1", "slot": "soul_trace"},
				{"uuid": "boots-1", "slot": "soul_boots"},
			],
		},
		"hero_loadouts": {
			"sword_hero": {
				"hero_weapon": "sword-1",
				"armor": "armor-1",
				"boots": "ghost-item",
				"jewelry": "jewel-1",
			},
			"archer_hero": {
				"hero_weapon": "archer-1",
				"armor": "",
				"boots": "boots-1",
				"jewelry": "",
			},
		},
	}
	var before: Dictionary = fixture.duplicate(true)
	var sword: Dictionary = roster.call(
		"_team_quick_look", fixture, "sword_hero", "CHỦ LỰC"
	)
	var archer: Dictionary = roster.call(
		"_team_quick_look", fixture, "archer_hero", "DỰ BỊ"
	)
	_expect("K-NIGHT" in String(sword.get("hero", "")).to_upper(),
		"Active summary names the actual Hero")
	_expect("HIẾM L5" in String(sword.get("hero", "")),
		"Active Soul summary reads canonical rarity and item level")
	_expect("MA THUẬT L2" in String(archer.get("hero", "")),
		"Reserve Soul summary reads a different selected instance")
	_expect("GIÁP ✓" in String(sword.get("gear", "")),
		"Correct armor UUID shows as equipped")
	_expect("GIÀY —" in String(sword.get("gear", "")),
		"An orphan UUID cannot appear as equipped")
	_expect("TRANG SỨC ✓" in String(sword.get("gear", "")),
		"Valid selected jewelry shows as equipped")
	_expect("GIÀY ✓" in String(archer.get("gear", "")),
		"Reserve Hero's own gear does not bleed into active Hero")
	var empty: Dictionary = roster.call("_team_quick_look", fixture, "", "DỰ BỊ")
	_expect("TRỐNG" in String(empty.get("hero", "")),
		"Empty reserve is labeled empty, not as a fake unlocked Hero")
	var wrong: Dictionary = fixture.duplicate(true)
	wrong["soul_team"]["selected_soul_instances"]["sword_hero"] = "archer-1"
	var wrong_soul: Dictionary = roster.call(
		"_team_quick_look", wrong, "sword_hero", "CHỦ LỰC"
	)
	_expect("SOUL CHƯA GẮN" in String(wrong_soul.get("hero", "")),
		"A Soul belonging to a different Hero is never shown as equipped")
	var misplaced: Dictionary = fixture.duplicate(true)
	misplaced["hero_loadouts"]["sword_hero"]["armor"] = "boots-1"
	var wrong_slot: Dictionary = roster.call(
		"_team_quick_look", misplaced, "sword_hero", "CHỦ LỰC"
	)
	_expect("GIÁP —" in String(wrong_slot.get("gear", "")),
		"An item from the wrong slot cannot masquerade as armor")
	_expect(fixture == before, "Read-only overview never mutates the save snapshot")
	roster.free()
	_finish()


func _expect(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("HERO TEAM QUICK LOOK TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("HERO TEAM QUICK LOOK TEST FAILED - %d / %d" % [
		_failures.size(), _checks,
	])
	quit(1)
