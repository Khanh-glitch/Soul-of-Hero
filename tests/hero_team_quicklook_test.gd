extends SceneTree

## Functional contract for a compact, honest two-Hero loadout summary.
const PROJECTOR := preload(
	"res://game/ui/screens/hub/tabs/components/hero_team_quicklook.gd"
)
const ROSTER_SCRIPT := "res://game/ui/screens/hub/tabs/arsenal_tab.gd"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	# Source integration is asserted without a SceneTree direct-instantiation
	# of Arsenal: it requires /root GameEvents and SaveService autoloads.
	var roster_source := FileAccess.get_file_as_string(ROSTER_SCRIPT)
	_expect(roster_source.contains("_tabs.current_tab = 1"),
		"Opening Hero Roster selects actionable Team & Souls")
	_expect(roster_source.contains("TeamQuickLook")
		and roster_source.contains("TEAM_QUICK_LOOK.summarize"),
		"Roster delegates both slots to canonical read-only summary projector")

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
	var sword: Dictionary = PROJECTOR.summarize(fixture, "sword_hero", "CHỦ LỰC")
	var archer: Dictionary = PROJECTOR.summarize(fixture, "archer_hero", "DỰ BỊ")
	_expect("K-NIGHT" in String(sword.get("hero", "")).to_upper(),
		"Active summary names the actual Hero")
	_expect("HIẾM L5" in String(sword.get("hero", "")),
		"Active Soul summary reads canonical rarity and item level")
	_expect("PHÉP THUẬT L2" in String(archer.get("hero", "")),
		"Reserve Soul summary reads a different selected instance")
	_expect("GIÁP ✓" in String(sword.get("gear", "")),
		"Correct armor UUID shows as equipped")
	_expect("GIÀY —" in String(sword.get("gear", "")),
		"An orphan UUID cannot appear as equipped")
	_expect("TRANG SỨC ✓" in String(sword.get("gear", "")),
		"Valid selected jewelry shows as equipped")
	_expect("GIÀY ✓" in String(archer.get("gear", "")),
		"Reserve Hero's own gear does not bleed into active Hero")
	var empty: Dictionary = PROJECTOR.summarize(fixture, "", "DỰ BỊ")
	_expect("TRỐNG" in String(empty.get("hero", "")),
		"Empty reserve is labeled empty, not as a fake unlocked Hero")
	var wrong: Dictionary = fixture.duplicate(true)
	wrong["soul_team"]["selected_soul_instances"]["sword_hero"] = "archer-1"
	var wrong_soul: Dictionary = PROJECTOR.summarize(wrong, "sword_hero", "CHỦ LỰC")
	_expect("SOUL CHƯA GẮN" in String(wrong_soul.get("hero", "")),
		"A Soul belonging to a different Hero is never shown as equipped")
	var misplaced: Dictionary = fixture.duplicate(true)
	misplaced["hero_loadouts"]["sword_hero"]["armor"] = "boots-1"
	var wrong_slot: Dictionary = PROJECTOR.summarize(misplaced, "sword_hero", "CHỦ LỰC")
	_expect("GIÁP —" in String(wrong_slot.get("gear", "")),
		"An item from the wrong slot cannot masquerade as armor")
	_expect(fixture == before, "Read-only overview never mutates the save snapshot")
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
