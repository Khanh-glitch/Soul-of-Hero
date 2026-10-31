extends SceneTree
## A0 Round 12 (WP2) authored-world spatial contract.
##
## Executes [A0WorldSpatialContract] against the shipped bytes. Two runs matter:
##
##   * in the A0 tree, A1's reader is not present, so the authored continent
##     cannot be read. The test then proves the composed (legacy + pinned annex)
##     half and prints `A0_AUTHORED_WORLD_NOT_READ` with the owner's exact named
##     reason. It does NOT pretend the continent was verified.
##   * in the composition (A1 pinned), the same test proves the annex is A1's
##     authored chunk and reports how much of the 1024x768 continent the playable
##     frame actually covers.
##
## `-- --require-authored` turns a missing reader into a FAILURE. The composition
## workflow passes that flag, so a silently vanished A1 seat cannot go green.
##
## Byte-level pins are not re-derived here: they are read from A1's own pilot
## manifest and connector, which is the only place the numbers are authored.

const CONTRACT = preload("res://game/survival/a0_world_spatial_contract.gd")
const AUTHORED = preload("res://game/survival/a1_authored_source.gd")

var checks := 0
var failures: Array[String] = []
var require_authored := false


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--require-authored":
			require_authored = true
	print("A0 AUTHORED WORLD CONTRACT (require_authored=%s)" % str(require_authored))
	var authored := AUTHORED.new()
	var ready := authored.configure()
	if not ready:
		print("A0_AUTHORED_WORLD_NOT_READ %s" % authored.last_error)
	_expect(ready or not require_authored,
		"the authored continent is readable in this tree (reason: %s)" % authored.last_error)
	if require_authored and not ready:
		print("A0_AUTHORED_WORLD_REQUIRED_BUT_ABSENT %s" % authored.last_error)
	var verifier = CONTRACT.new()
	var report: Dictionary = verifier.verify(authored)
	for check: Dictionary in (report.get("checks", []) as Array):
		var suffix := ""
		if bool(check.get("skipped", false)):
			suffix = " [SKIPPED]"
		_expect(bool(check.get("ok", false)),
			"%s - %s%s" % [String(check.get("name", "")), String(check.get("detail", "")), suffix])
	var measurements: Dictionary = report.get("measurements", {})
	print("A0_SPATIAL_MEASUREMENTS %s" % JSON.stringify(measurements))
	if require_authored:
		var missing: Array = (report.get("measurements", {}) as Dictionary).get("missing_owner_inputs", [])
		var missing_text := "none missing"
		if missing.size() > 0:
			missing_text = ", ".join(PackedStringArray(missing))
		_expect(missing.is_empty(), "every A1 connector input is present (%s)" % missing_text)
	if not bool(report.get("ok", false)):
		print("A0_SPATIAL_REASON %s" % String(report.get("reason", "")))
	_list_measurements(measurements)
	if ready and not measurements.is_empty():
		_report_authored_reach(authored, measurements)
	_report()


func _list_measurements(measurements: Dictionary) -> void:
	# One stable, greppable line per fact the reviewer needs in the log.
	for key: String in ["composed_cells", "legacy_cells", "legacy_cells_compared",
			"carve_cells", "carve_cells_applied", "annex_walkable_cells",
			"authored_annex_walkable", "authored_pois", "authored_pois_in_composed",
			"authored_pois_outside_composed", "authored_frame_cells",
			"composed_share_of_authored", "authored_regions_sampled_in_composed"]:
		if measurements.has(key):
			print("A0_SPATIAL %s=%s" % [key, str(measurements[key])])


## The continent is authored; the playable frame is not the continent. Say that
## plainly, once, with numbers, instead of implying WP2 is complete.
func _report_authored_reach(authored: A1AuthoredSource, measurements: Dictionary) -> void:
	var frame: Vector2i = authored.frame
	var composed := int(measurements.get("composed_cells", 0))
	var share := float(composed) / float(frame.x * frame.y)
	print("A0_AUTHORED_REACH authored_frame=%dx%d composed_cells=%d share=%.4f outside_pois=%d" % [
		frame.x, frame.y, composed, share, int(measurements.get("authored_pois_outside_composed", 0))])
	_expect(share < 0.2,
		"the playable composed frame is a bounded pilot of the authored continent (%.1f%%)" % (share * 100.0))


func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)


func _report() -> void:
	if failures.is_empty():
		print("A0 AUTHORED WORLD CONTRACT PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 AUTHORED WORLD CONTRACT FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
