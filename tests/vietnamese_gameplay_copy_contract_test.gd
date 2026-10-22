extends SceneTree

const TARGETS := [
	"res://game/ui/HUD.tscn",
	"res://game/ui/hud.gd",
	"res://game/ui/progression_focus_hud.tscn",
	"res://game/ui/progression_focus_hud.gd",
	"res://game/ui/completion_choice.tscn",
	"res://game/ui/completion_choice.gd",
	"res://game/ui/screens/home/home_map_screen.tscn",
	"res://game/ui/screens/home/home_map_screen.gd",
	"res://game/ui/screens/hub/hub_screen.tscn",
	"res://game/ui/screens/hub/hub_screen.gd",
	"res://game/ui/screens/hub/tabs/arsenal_tab.tscn",
	"res://game/ui/screens/hub/tabs/arsenal_tab.gd",
	"res://game/ui/screens/hub/tabs/bestiary_tab.tscn",
	"res://game/ui/screens/boot/boot_screen.tscn",
	"res://game/ui/screens/level_details/training_details_screen.tscn",
	"res://game/ui/screens/level_details/training_details_screen.gd",
	"res://game/ui/screens/results/training_results_screen.tscn",
	"res://game/ui/screens/results/training_results_screen.gd",
	"res://game/ui/field_codex.tscn",
	"res://game/ui/field_codex.gd",
	"res://game/ui/field_codex_item_tile.tscn",
	"res://game/ui/field_codex_equipment_slot.tscn",
	"res://game/ui/objectives/level_5_kingdom_archer_hud.tscn",
	"res://game/ui/objectives/level_7_beacon_hud.tscn",
	"res://game/ui/objectives/level_8_reliquary_hud.tscn",
	"res://game/ui/objectives/level_9_crimson_gate_hud.tscn",
	"res://game/ui/objectives/level_10_castellan_hud.tscn",
	"res://game/levels/objectives/level_5_archer_recruitment_runtime.gd",
	"res://game/levels/objectives/level_7_beacon_runtime.gd",
	"res://game/levels/objectives/level_8_reliquary_runtime.gd",
	"res://game/levels/objectives/level_9_crimson_gate_runtime.gd",
	"res://game/levels/objectives/level_10_castellan_runtime.gd",
	"res://game/tutorial/level_one_tutorial.gd",
]

# Proper names and compact system acronyms intentionally remain readable in the
# Vietnamese UI. These are not translation debt.
const ALLOWED_TERMS := [
	"HP", "MANA", "POWER", "DMG", "XP", "LV", "HERO SOUL", "SOUL ECHO", "ELITE",
	"KINGDOMARCHER", "VAMPIRE CASTELLAN", "CRIMSON REAPER",
]

# These phrases represent player-facing English actions/states that previously
# leaked into combat HUDs. IDs, APIs, comments and test fixtures are ignored;
# only authored display strings are inspected.
const FORBIDDEN_PHRASES := [
	"PRESS E", "ACTIVE COPY", "SELECTED COPY", "EQUIP THIS COPY", "SELL",
	"FIRST CLEAR", "EASY", "MEDIUM", "HARD", "RECALL", "THROW", "CHARGE",
	"SHOT", "FOCUS", "MARKED", "NO AFFIX", "AFFIXES", "RETURN HOME",
	"RETRY LEVEL", "ACTIVE SKILL", "SWORD COMBO", "FIRST CHOICE",
	"ITEM LV", "ILVL", "REALTIME", "GAME KHÔNG TẠM DỪNG", "RANK ",
	"HERO ROSTER", "PLAYER STATS", "ALL 6 TRACKS", "POINTS AVAILABLE",
	"RANK GATE", "SHARED ACCOUNT EQUIPMENT", "NO ITEM FOR THIS SLOT",
	"INSTANCE STATUS", "TEAM STATUS", "PROTECTION •", "VS EQUIPPED",
	"HOME MAP", "ĐẾN GẦN NPC", "LOCKED UNTIL LEVEL", "NOT APPLIED",
]

var _checks := 0
var _failures: Array[String] = []
var _quoted_string := RegEx.new()


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var matcher_error := _quoted_string.compile('"([^"]*)"')
	_expect(matcher_error == OK, "quoted string matcher compiles")
	if matcher_error != OK:
		for failure: String in _failures:
			push_error(failure)
		quit(1)
		return
	_expect(not ALLOWED_TERMS.is_empty(), "proper-name/system acronym allowlist is explicit")
	for path: String in TARGETS:
		_expect(FileAccess.file_exists(path), "%s exists" % path)
		if not FileAccess.file_exists(path):
			continue
		var source := FileAccess.get_file_as_string(path)
		var lines := source.split("\n")
		for line_number: int in lines.size():
			var line := lines[line_number]
			if not _is_player_facing_line(path, line):
				continue
			for matched: RegExMatch in _quoted_string.search_all(line):
				_check_copy(path, line_number + 1, matched.get_string(1))
	if _failures.is_empty():
		print("VIETNAMESE GAMEPLAY COPY CONTRACT PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("VIETNAMESE GAMEPLAY COPY CONTRACT FAILED - %d issue(s)" % _failures.size())
	quit(1)


func _is_player_facing_line(path: String, line: String) -> bool:
	var stripped := line.strip_edges()
	if stripped.begins_with("#"):
		return false
	if path.ends_with(".tscn"):
		return stripped.begins_with("text =") or stripped.begins_with("tooltip_text =")
	if path.ends_with("level_one_tutorial.gd"):
		return stripped.begins_with("&\"")
	if path.ends_with("arsenal_tab.gd"):
		return (
			".text =" in line
			or ".tooltip_text =" in line
			or "_label(" in line
			or "_commit(" in line
			or "lines.append(" in line
		)
	return (
		".text =" in line
		or ".tooltip_text =" in line
		or "toast_requested.emit" in line
		or "_toast(" in line
		or "set_interaction_locked" in line
	)


func _check_copy(path: String, line_number: int, copy: String) -> void:
	# Stable transaction IDs are not rendered; keep them out of the copy audit.
	if copy.begins_with("ui_"):
		return
	var upper := copy.to_upper()
	for phrase: String in FORBIDDEN_PHRASES:
		_checks += 1
		if phrase in upper:
			_failures.append("%s:%d contains untranslated gameplay copy '%s': %s" % [path, line_number, phrase, copy])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
