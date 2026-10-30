extends SceneTree
## Native-render preview on the current A0 overworld. The world is real in the
## composed source tree; every A6 HUD datum below is explicitly fixture-only.
const OVERWORLD := "res://game/overworld/chapter1_overworld.tscn"
const HUD := preload("res://game/survival/ui/player_first_hud.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var save := root.get_node_or_null("SaveService")
	if save == null or not save.has_method(&"configure_storage"):
		push_error("A0 SaveService is unavailable in the composed native preview")
		quit(1)
		return
	var save_path := "user://a6_v4_capture_%d.json" % Time.get_ticks_usec()
	save.call(&"configure_storage", save_path, true)
	var world_scene := load(OVERWORLD) as PackedScene
	if world_scene == null:
		push_error("Current A0 overworld scene could not be loaded")
		quit(1)
		return
	var host := Node2D.new()
	host.name = "A6V4CaptureHost"
	root.add_child(host)
	var overworld := world_scene.instantiate()
	host.add_child(overworld)
	if overworld.has_method(&"configure"):
		overworld.call(&"configure", {})
	var deadline := Time.get_ticks_msec() + 90000
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if overworld.has_method(&"is_world_ready") and bool(overworld.call(&"is_world_ready")):
			break
		if (
			overworld.has_method(&"is_world_ready")
			and not String(overworld.get("build_error")).is_empty()
		):
			push_error("A0 world build failed: %s" % String(overworld.get("build_error")))
			quit(1)
			return
	if not overworld.has_method(&"is_world_ready") or not bool(overworld.call(&"is_world_ready")):
		push_error("A0 world did not become ready within 90 seconds")
		quit(1)
		return
	var layer := CanvasLayer.new()
	layer.name = "A6V4PresentationOnly"
	layer.layer = 90
	root.add_child(layer)
	var hud: Control = HUD.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(hud)
	var projection := {
		"schema": "soh.ui.player_hud.v1",
		"provenance": "FIXTURE_PROJECTION",
		"mode": "looting",
		"needs":
		[
			{"label": "Health", "current": 84, "maximum": 100},
			{"label": "Stamina", "current": 67, "maximum": 100}
		],
		"danger": {"status": "known", "label": "Threat clue supplied · not a gameplay verdict"},
		"bag": {"used": 18, "capacity": 24},
		"core":
		{
			"name": "Ember Core",
			"instance_id": "soh_i_000000000011_a1c0ffee",
			"ownership_state": "In satchel · unequipped",
			"uses": 3,
			"max_uses": 8,
			"condition": 76,
			"max_condition": 100,
			"readiness": "BLOCKED_PENDING_A4"
		},
		"feedback":
		{
			"status": "committed",
			"kind": "core_acquired",
			"provenance": "FIXTURE_PROJECTION",
			"title": "Physical instance recorded",
			"item_name": "Ember Core"
		}
	}
	if not hud.set_projection(projection):
		push_error("A6 HUD rejected its explicitly labeled preview projection")
		quit(1)
		return
	await process_frame
	await process_frame
	await create_timer(0.2).timeout
	var viewport := root.get_viewport()
	var size := viewport.get_texture().get_image().get_size()
	var requested_tag := "native"
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		requested_tag = String(args[0])
	var output := ProjectSettings.globalize_path("res://.artifacts/a6-v4")
	DirAccess.make_dir_recursive_absolute(output)
	var filename := "v4_hud_%s.png" % requested_tag
	var path := output.path_join(filename)
	var image := viewport.get_texture().get_image()
	var status_rect: Rect2 = hud.get_node("A6ContextStatus").get_global_rect()
	var core_rect: Rect2 = hud.get_node("PhysicalCoreStatus").get_global_rect()
	var owner_hud: Node = overworld.get("hud")
	var owner_plate := (
		owner_hud.find_child("Plate", true, false) as Control if owner_hud != null else null
	)
	if status_rect.intersects(core_rect):
		failures += 1
		push_error("HUD context and Core card overlap at %s" % str(size))
	if owner_plate != null and status_rect.intersects(owner_plate.get_global_rect()):
		failures += 1
		push_error("A6 context extension overlaps A0's existing HUD plate at %s" % str(size))
	if image.save_png(path) != OK:
		failures += 1
		push_error("Could not save native A6 HUD preview: %s" % path)
	else:
		print(
			(
				"A6 V4 NATIVE HUD CAPTURE %s %dx%d %d bytes"
				% [
					path,
					image.get_width(),
					image.get_height(),
					FileAccess.get_file_as_bytes(path).size()
				]
			)
		)
	if size.x < 1000 or size.y < 650:
		failures += 1
		push_error("Native viewport is smaller than the requested capture: %s" % str(size))
	print("A6 V4 HUD CAPTURE — %s" % ("FAILED" if failures else "COMPLETE"))
	print("Owner world loaded; HUD data is FIXTURE_PROJECTION.")
	print("No production mount or input-safety claim.")
	quit(1 if failures else 0)
