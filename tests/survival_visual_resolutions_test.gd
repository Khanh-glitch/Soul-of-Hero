extends "res://tests/survival_room_topology_test.gd"
## Rendered production scene with fixture-funded construction/repositioning.
## Native resolution evidence only, not an ordinary-input journey or human test.

func _capture(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_expect(image != null and not image.is_empty(), "native visual frame exists: " + name)
	if image == null or image.is_empty():
		return
	var expected := OS.get_environment("A0_VISUAL_RESOLUTION").split("x")
	if expected.size() == 2:
		_expect(image.get_width() == int(expected[0]) and image.get_height() == int(expected[1]), "native image pixel dimensions match " + name)
	var path := "res://artifacts/visual_%s.png" % name
	_expect(image.save_png(path) == OK, "native visual saved: " + name)
	print("NATIVE_VISUAL name=%s width=%d height=%d path=%s" % [name, image.get_width(), image.get_height(), path])

func _capture_roof_frame(name: String) -> void:
	await _capture("roof_" + name)

func _body() -> void:
	await _capture("fresh_world")
	var ow := _host.get_child(0)
	var panel: Node = ow.get(&"economy_panel")
	var toggle := InputEventAction.new()
	toggle.action = &"economy_toggle"
	toggle.pressed = true
	Input.parse_input_event(toggle)
	await process_frame
	toggle.pressed = false
	Input.parse_input_event(toggle)
	await process_frame
	_expect(panel != null and bool(panel.call(&"is_open")), "actual economy UI is visible for capture")
	var hud := ow.get(&"hud") as CanvasLayer
	_expect(hud != null and (panel as CanvasLayer).layer > hud.layer, "crafting modal paints above overworld HUD")
	await _capture("economy")
	panel.call(&"close_panel")
	await process_frame
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	build.set_active(true)
	await process_frame
	var strip := build.get_node("BuildHud/BuildRoot/Strip") as Control
	var text := strip.get_node("Text") as Label
	_expect(strip.get_global_rect().position.x >= 0.0 and strip.get_global_rect().end.x <= root.get_visible_rect().size.x, "construction strip fits viewport")
	_expect(text.get_visible_line_count() == text.get_line_count() and text.text.contains("[9]"), "all wrapped construction lines and slots fit")
	await _capture("build")
	build.set_active(false)
	await super._body()
