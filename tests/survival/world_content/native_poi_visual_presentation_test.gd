extends SceneTree

## Verifies authored A8 environment changes under owner-projected site state.
## This is presentation evidence only: it grants no item, time, or save mutation.

const ART_SCRIPT := preload("res://game/survival/world_content/scripts/native_poi_art.gd")
const SITE_ROOT := "res://data/survival/world_content/sites/"

var _assertions := 0
var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var quarry := _test_context("south_quarry", false)
	var orchard := _test_context("south_orchard_ruin", false)
	var mill := _test_context("south_crown_mill", false)
	_test_context("south_quarry", true)
	await _test_orchard_flow(orchard)
	await _test_mill_wheel(mill)
	if quarry != null:
		quarry.queue_free()
	if orchard != null:
		orchard.queue_free()
	if mill != null:
		mill.queue_free()
	await process_frame
	if _failures.is_empty():
		print("A8_NATIVE_POI_VISUAL_PRESENTATION_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print("A8_NATIVE_POI_VISUAL_PRESENTATION_FAIL failures=%d" % _failures.size())
		quit(1)


func _test_context(site_name: String, shell_role: bool) -> Node2D:
	var definition: Variant = JSON.parse_string(
		FileAccess.get_file_as_string(SITE_ROOT + site_name + ".json")
	)
	_check(definition is Dictionary, "%s site definition loads" % site_name)
	if not definition is Dictionary:
		return null
	var art := ART_SCRIPT.new() as Node2D
	root.add_child(art)
	_check(
		bool(art.call("configure", definition, shell_role)),
		"%s source-backed art configures" % site_name
	)
	var context := art.get_node_or_null("A8_SourceBacked_EnvironmentContext") as TileMapLayer
	_check(context != null, "%s has an in-world context ground layer" % site_name)
	if context != null:
		_check(
			context.get_used_cells().size() >= 2500,
			"%s context ground covers capture bounds" % site_name
		)
	return art


func _test_orchard_flow(art: Node2D) -> void:
	if not is_instance_valid(art):
		return
	art.call("set_site_state", {})
	var ground := art.get_node("A8_16px_Ground") as TileMapLayer
	var still_frame := str(art.call("get_terrain_frame_at_cell", Vector2i(46, 17)))
	_check(
		ground.get_cell_source_id(Vector2i(46, 17)) >= 0 and not still_frame.begins_with("water_"),
		"blocked Orchard channel is still water but does not pretend to flow broadly"
	)
	art.call("set_site_state", {"orchard_channel": "flowing"})
	var flowing_frame := str(art.call("get_terrain_frame_at_cell", Vector2i(46, 17)))
	_check(
		flowing_frame.begins_with("water_"),
		"owner-projected irrigation visibly widens the Orchard's flowing channel"
	)


func _test_mill_wheel(art: Node2D) -> void:
	if not is_instance_valid(art):
		return
	art.call("set_site_state", {"mill_wheel": "seized"})
	var wheel := art.get_node_or_null("A8_SourceSized_Props/race_wheel") as Sprite2D
	_check(wheel != null, "Mill scene retains its source-art waterwheel")
	if wheel == null:
		return
	art.call("set_site_state", {"mill_wheel": "seized"})
	wheel = art.get_node_or_null("A8_SourceSized_Props/race_wheel") as Sprite2D
	_check(wheel != null, "seized-state projection retains its source-art wheel")
	if wheel == null:
		return
	for _frame in range(24):
		await process_frame
	_check(is_equal_approx(wheel.rotation_degrees, 0.0), "seized Mill wheel remains still")
	art.call("set_site_state", {"mill_wheel": "turning"})
	wheel = art.get_node_or_null("A8_SourceSized_Props/race_wheel") as Sprite2D
	_check(wheel != null, "turning-state projection retains its source-art wheel")
	if wheel == null:
		return
	for _frame in range(120):
		await process_frame
		if not is_equal_approx(wheel.rotation_degrees, 0.0):
			break
	_check(not is_equal_approx(wheel.rotation_degrees, 0.0), "repaired Mill wheel visibly turns")
	var flowing_frame := str(art.call("get_terrain_frame_at_cell", Vector2i(46, 18)))
	_check(
		flowing_frame.begins_with("water_"), "repair projects a broader moving-race water surface"
	)


func _check(condition: bool, label: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append(label)
		push_error("Assertion failed: " + label)
