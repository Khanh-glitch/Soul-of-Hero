extends "res://tests/survival_foundation_test.gd"
## A0 component probe (NOT a player journey): the station interaction policy.
##
## The first hour failed because two different rules decided whether a player could
## use a station:
##
##   * the economy session listed a station within 64 px of
##     `structure.global_position + Vector2(16, 16)` - a hardcoded half-cell offset,
##     right for a 2x2 furnace and wrong for a 1x1 or 2x1 piece; and
##   * `SurvivalStructure.REACH` (44 px) measured from the structure origin decided
##     interaction.
##
## For a 2x2 furnace a player standing at a legal interaction distance could be
## outside the panel's window, so the panel offered no furnace recipes at all while
## the furnace stood in front of them.
##
## This probe pins the one policy (`SurvivalStationReach`) and the real catalogue
## values it is fed with, so the fix cannot silently regress to a hardcoded offset.
## It does not place anything, teleport anything, or prove a journey.

const FURNACE := "station_furnace"
const WORKBENCH := "station_workbench"

var _ow: Node


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_station_reach_%d.json" % Time.get_ticks_usec()
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	var started := Time.get_ticks_msec()
	print("A0 STATION REACH PROBE (component, not a journey)")
	var host := await _boot()
	if host == null:
		_expect(false, "the world boots so the real piece catalogue can be read")
		_finish()
		return
	_ow = host
	var svc: Node = _survival()
	var furnace: Dictionary = svc.call(&"piece_definition", FURNACE)
	var bench: Dictionary = svc.call(&"piece_definition", WORKBENCH)
	_expect(not furnace.is_empty() and not bench.is_empty(), "the real catalogue defines both stations")
	_expect(String(furnace.get("station_kind", "")) == "furnace", "the furnace declares station kind furnace")
	_expect(String(bench.get("station_kind", "")) == "workbench", "the workbench declares station kind workbench")
	_expect(int(furnace.get("station_tier", 0)) >= 1, "the furnace declares its real tier")

	# 1. the anchor comes from the footprint, not from a hardcoded half cell
	_expect(SurvivalStationReach.footprint_pixels(furnace) == Vector2(32, 32),
		"a 2x2 furnace footprint is 32x32 px (%s)" % str(SurvivalStationReach.footprint_pixels(furnace)))
	_expect(SurvivalStationReach.footprint_pixels(bench) == Vector2(32, 16),
		"a 2x1 workbench footprint is 32x16 px (%s)" % str(SurvivalStationReach.footprint_pixels(bench)))
	_expect(SurvivalStationReach.footprint_pixels({}) == Vector2(16, 16),
		"a piece with no declared footprint occupies its own cell")

	var furnace_node := Node2D.new()
	furnace_node.global_position = Vector2(800, 640)
	_ow.add_child(furnace_node)
	var anchor := SurvivalStationReach.anchor_for(furnace_node, furnace)
	_expect(anchor == Vector2(816, 656), "the 2x2 furnace anchor is its footprint centre (%s)" % str(anchor))
	_expect(SurvivalStationReach.footprint_rect(furnace_node, furnace) == Rect2(800, 640, 32, 32),
		"the 2x2 furnace occupies the 32x32 block it is drawn on")
	var bench_node := Node2D.new()
	bench_node.global_position = Vector2(800, 640)
	_ow.add_child(bench_node)
	_expect(SurvivalStationReach.anchor_for(bench_node, bench) == Vector2(816, 648),
		"the 2x1 workbench anchor is its own footprint centre")

	# 2. the exact case that failed: a player standing beside the 2x2 furnace.
	#    The block spans 800..832 x 640..672; a body one cell to the right of it
	#    stands at x=848, i.e. 32 px from the anchor and well inside 44 px.
	var adjacent := Vector2(848, 656)
	_expect(is_equal_approx(SurvivalStationReach.distance_to(adjacent, furnace_node, furnace), 16.0),
		"reach is measured to the block, so standing beside a 2x2 furnace is 16 px, not 32")
	_expect(SurvivalStationReach.in_reach(adjacent, furnace_node, furnace),
		"a player standing beside a 2x2 furnace is in reach of it")
	_expect(SurvivalStationReach.in_reach(Vector2(816, 656), furnace_node, furnace),
		"a player standing inside the footprint is trivially in reach")
	var edge := Vector2(832, 656)   # the furnace's own right edge
	_expect(not SurvivalStationReach.in_reach(edge + Vector2(SurvivalStationReach.RADIUS + 1, 0), furnace_node, furnace),
		"one pixel past the radius from the block is refused")
	_expect(SurvivalStationReach.in_reach(edge + Vector2(SurvivalStationReach.RADIUS - 1, 0), furnace_node, furnace),
		"one pixel inside the radius from the block is accepted")
	# A player who just placed a piece with the build pointer can stand up to three
	# cells (48 px) from it, so they must walk closer before the station counts.
	var three_cells_away := Vector2(832 + 48, 656)
	_expect(not SurvivalStationReach.in_reach(three_cells_away, furnace_node, furnace),
		"a station three cells away is not usable without walking to it (this is a walk, not a bug)")
	# The old listing rule measured from the same anchor with 64 px, so it also
	# accepted this; the old *command* rule measured from the origin with 44 px and
	# accepted it too. What used to disagree was a player at 60 px from the origin,
	# which the panel listed and the command path also allowed... so the failure was
	# not a disagreement at all in this direction. Keep both boundaries explicit.


	# 3. the anchor is what the session uses for listing and queueing
	_expect(_ow.get(&"economy_session").has_method(&"station_in_reach"),
		"the economy session exposes the one reach rule (not a private distance)")
	_expect(_ow.get(&"economy_session").has_method(&"nearby_stations"),
		"the session still exposes nearby_stations() to the panel")
	_expect(not _ow.get(&"economy_session").has_method(&"available_stations"),
		"there is no invented available_stations() contract")

	# 4. the catalogue the panel reads really has the second act's recipes
	# The authored catalogue the economy runs on, read from its shipped file rather
	# than through a private field: what matters is that the second act's recipes
	# exist at a furnace tier this world can build.
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/survival/recipes/recipes.json"))
	var recipes: Dictionary = (parsed as Dictionary).get("recipes", {}) if parsed is Dictionary else {}
	_expect(recipes.has("burn_charcoal") and String((recipes["burn_charcoal"] as Dictionary).get("station", "")) == "furnace",
		"the furnace catalogue contains burn_charcoal")
	_expect(recipes.has("smelt_iron") and String((recipes["smelt_iron"] as Dictionary).get("station", "")) == "furnace",
		"the furnace catalogue contains smelt_iron")
	_expect(int((recipes["smelt_iron"] as Dictionary).get("duration_ticks", 0)) == 12,
		"smelt_iron is a 12 tick job")
	print("A0 STATION REACH PROBE %s - %d checks in %d ms" % [
		"PASSED" if failures.is_empty() else "FAILED", checks, Time.get_ticks_msec() - started])
	_finish()


func _finish() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	_teardown()
	if failures.is_empty():
		print("A0 STATION REACH COMPONENT PROBE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 STATION REACH COMPONENT PROBE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
