extends "res://tests/survival_production_waystation_candidate_test.gd"
## A0 diagnostics probe: the two ridges where the continuous rendered journey
## stopped. The real production world, the real Hero body and the real shared
## walker are used; only the destination order is chosen here.
##
## Failure that motivated this probe (rendered `8ce3add8`):
##   normal-entry-roadside FAIL `ordinary input returns to the same paid home`
##     at (343,223) -> (342,222), velocity (-90,0), motion (-0.000977,0)
##   normal-entry          FAIL `ordinary input walks to physical cache stand`
##     at (407,203) -> (406,202), same signature
## Both are crossed, outbound and back, by this probe.

func _test_label() -> String:
	return "A0 WALKER RIDGE PROBE"

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("A0 WALKER RIDGE PROBE %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _journey(ow: Node, hero: CharacterBody2D, host: Node, second: bool) -> void:
	var nav := ow.get(&"traversability") as OverworldTraversability
	if second:
		_body_complete = true
		return
	var refuge := nav.cell_of(hero.global_position)
	var legs := [
		{"cell": Vector2i(46, 208), "label": "Refuge to the west ridge approach"},
		{"cell": Vector2i(395, 220), "label": "west approach to roadside_01 (ridge outbound)"},
		{"cell": Vector2i(406, 202), "label": "roadside_01 to the cache stand (ridge eastbound)"},
		{"cell": Vector2i(395, 220), "label": "cache stand to roadside_01 (reverse)"},
		{"cell": Vector2i(46, 208), "label": "roadside_01 to the west ridge approach (ridge return)"},
		{"cell": refuge, "label": "west ridge approach back to the Refuge"},
	]
	for leg: Dictionary in legs:
		var cell: Vector2i = leg.cell
		if not await _leg(hero, nav, cell, String(leg.label)):
			return
		_expect(nav.cell_of(hero.global_position) == cell, "probe stands exactly on " + str(cell))
	print("A0_WALKER_RIDGE_TRACE cells=%s final=%s" % [
		str(refuge), str(nav.cell_of(hero.global_position))])
	_body_complete = true
