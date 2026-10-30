extends SceneTree
## Private-art native composition capture on the pinned A0 overworld.
## The hidden A0 sprite is replaced only in this temporary test process; the
## A0 CharacterBody2D, collision, camera, input, world, HUD, SaveService and VFX
## remain the actual owner objects. This is not an A0 production mount.

const OVERWORLD_PATH := "res://game/overworld/chapter1_overworld.tscn"
const DRIVER := preload("res://game/survival/ui/a0_avatar_presentation_driver.gd")
const PRIVATE_MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"

var failures: Array[String] = []
var captures := 0
var actor: CharacterBody2D
var driver: Node
var gender := "male"
var tag := "native"
var output_dir := ""
var capture_actions := false


func _initialize() -> void:
	call_deferred("_run")


func _fail(message: String) -> void:
	failures.append(message)
	push_error(message)


func _run() -> void:
	_parse_arguments()
	if gender.is_empty():
		_fail("The private capture harness requires --gender=male or --gender=female.")
		quit(1)
		return
	_run_mapping_checks()
	var manifest: Variant = JSON.parse_string(FileAccess.get_file_as_string(PRIVATE_MANIFEST_PATH))
	if not manifest is Dictionary or manifest.get("status", "") != "LOCAL_PRIVATE_PREVIEW_ONLY":
		_fail(
			"Private local runtime metadata is missing; stage source privately before this capture."
		)
		quit(1)
		return
	if not FileAccess.file_exists(PRIVATE_MANIFEST_PATH):
		_fail("Private local runtime metadata is not present in this composed project.")
		quit(1)
		return
	var save_service := root.get_node_or_null("SaveService")
	if save_service == null or not save_service.has_method(&"configure_storage"):
		_fail("Pinned A0 SaveService is unavailable.")
		quit(1)
		return
	save_service.call(
		"configure_storage", "user://a6_avatar_preview_%s_%s.json" % [gender, tag], true
	)
	var packed := load(OVERWORLD_PATH) as PackedScene
	if packed == null:
		_fail("Pinned A0 overworld scene is unavailable.")
		quit(1)
		return
	var host := Node2D.new()
	host.name = "A6PrivateAvatarCompositionPreview"
	root.add_child(host)
	var overworld := packed.instantiate()
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
			_fail("Pinned A0 world build failed: %s" % String(overworld.get("build_error")))
			quit(1)
			return
	if not overworld.has_method(&"is_world_ready") or not bool(overworld.call(&"is_world_ready")):
		_fail("Pinned A0 world did not become ready within 90 seconds.")
		quit(1)
		return
	actor = overworld.get("player") as CharacterBody2D
	if actor == null:
		_fail("Pinned A0 Hero CharacterBody2D is missing.")
		quit(1)
		return
	var owner_sprite := actor.get_node_or_null("Sprite") as AnimatedSprite2D
	if owner_sprite == null:
		_fail("Pinned A0 presentation anchor is missing.")
		quit(1)
		return
	var avatar := AnimatedSprite2D.new()
	avatar.name = "A6CanonicalAvatarPreview"
	avatar.position = Vector2(0.0, -11.0)  # A0 ground origin; source idle boots end at cell y=43.
	avatar.z_index = owner_sprite.z_index
	avatar.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	actor.add_child(avatar)
	actor.move_child(avatar, owner_sprite.get_index())
	# The legacy Knight image is hidden only in this throwaway composition host.
	owner_sprite.visible = false
	driver = DRIVER.new()
	driver.name = "A6ReadOnlyA0AvatarDriver"
	actor.add_child(driver)
	var owner_projection := {
		"schema": "soh.ui.avatar_appearance.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"revision": "private-native-preview-%s" % gender,
		"gender": gender,
		"armor_grade": 0,
	}
	if not driver.bind_owner(actor, avatar, owner_projection, manifest):
		_fail(
			(
				"A6 could not bind private source to the A0 visual anchor: %s"
				% String(driver.get("last_error"))
			)
		)
		quit(1)
		return
	if driver.get("resolved_appearance").get("gender", "") != gender:
		_fail("Private A0 preview changed the canonical selected identity.")
		quit(1)
		return
	await _settle(0.3)
	await _capture("idle")
	if capture_actions:
		for direction: String in ["up", "right", "down", "left"]:
			var action := "move_" + direction
			Input.action_press(action)
			await _settle(0.75)
			if not _expect_motion("walk"):
				break
			await _capture("walk_" + direction)
			Input.action_release(action)
			await _settle(0.30)
		# Keep the native camera/world/owner input; the A0 movement speed naturally
		# selects the run clip. Do not force velocity or replace physics in this host.
		Input.action_press("move_right")
		await _settle(1.20)
		if _expect_motion("run"):
			await _capture("run_right")
		Input.action_release("move_right")
		await _settle(0.30)
		# This is the real A0 input action. Gold VFX are left untouched and remain A0-owned.
		Input.action_press("attack")
		await _settle(0.20)
		if _expect_motion("attack"):
			await _capture("attack_input")
		Input.action_release("attack")
		await _settle(0.8)
	print(
		"A6 private avatar capture: A0 source actor physics/input retained; identity projection is preview-only."
	)
	print(
		"Gold VFX, SaveService and production scene were not changed; no mount or acceptance claim."
	)
	print(
		(
			"A6 AVATAR NATIVE COMPOSITION: %s (%d captures)"
			% ["FAILED" if not failures.is_empty() else "CAPTURED", captures]
		)
	)
	quit(1 if not failures.is_empty() else 0)


func _run_mapping_checks() -> void:
	_expect(
		DRIVER.action_for_owner_state("IDLE", "", 0.0) == "idle",
		"A0 idle maps to the real grade-zero idle sheet"
	)
	_expect(
		(
			DRIVER.action_for_owner_state("MOVE", "", 45.0) == "walk"
			and DRIVER.action_for_owner_state("MOVE", "", 120.0) == "run"
		),
		"A0 owner velocity selects the real walk and run clips"
	)
	_expect(
		(
			DRIVER.action_for_owner_state("ATTACK", "sword_attack_1", 0.0) == "attack"
			and DRIVER.action_for_owner_state("ATTACK", "sword_attack_1", 45.0) == "walk_attack"
			and DRIVER.action_for_owner_state("ATTACK", "sword_attack_1", 120.0) == "run_attack"
		),
		"A0 sword attack motion selects the source-composed attack clips"
	)
	_expect(
		(
			DRIVER.action_for_owner_state("HURT", "hit", 0.0) == "hurt"
			and DRIVER.action_for_owner_state("DEAD", "", 0.0) == "death"
		),
		"A0 hit/death states select non-looping source clips"
	)
	_expect(
		DRIVER.action_for_owner_state("DASH", "dash", 0.0) == "idle",
		"unsupported dash presentation does not fabricate an attack"
	)
	_expect(
		(
			DRIVER.direction_for_vector(Vector2(0, 1)) == "front"
			and DRIVER.direction_for_vector(Vector2(-1, 0)) == "side_left"
			and DRIVER.direction_for_vector(Vector2(1, 0)) == "side_right"
			and DRIVER.direction_for_vector(Vector2(0, -1)) == "back"
		),
		"A0 facing vectors resolve to all four reviewed sheet rows"
	)


func _parse_arguments() -> void:
	for arg: String in OS.get_cmdline_user_args():
		var parts := arg.split("=", true, 1)
		if parts.size() != 2:
			continue
		match parts[0]:
			"gender":
				gender = parts[1]
			"tag":
				tag = parts[1]
			"out":
				output_dir = parts[1]
			"actions":
				capture_actions = parts[1].to_lower() == "true"
	if gender not in ["male", "female"]:
		gender = ""
	if output_dir.is_empty():
		output_dir = ProjectSettings.globalize_path("res://.artifacts/a6-avatar")
	DirAccess.make_dir_recursive_absolute(output_dir)


func _settle(seconds: float) -> void:
	await create_timer(seconds).timeout
	await process_frame
	if is_instance_valid(driver):
		driver.call("update_from_owner")


func _expect_motion(expected: String) -> bool:
	if not is_instance_valid(actor) or not is_instance_valid(driver):
		_fail("A0 actor or A6 read-only driver disappeared during native movement.")
		return false
	var action := DRIVER.action_for_owner_state(
		DRIVER.state_name_from_owner(actor),
		String(actor.get("current_action")),
		actor.velocity.length()
	)
	if expected == "walk" and action not in ["walk", "run"]:
		_fail("A0 keyboard movement did not reach the walk/run presentation state.")
		return false
	if expected == "run" and action != "run":
		_fail("A0 input did not reach the run presentation state.")
		return false
	if expected == "attack" and action not in ["attack", "walk_attack", "run_attack"]:
		_fail("A0 attack input did not reach the source-backed attack presentation state.")
		return false
	return true


func _capture(label: String) -> void:
	await process_frame
	var image := root.get_viewport().get_texture().get_image()
	var width := image.get_width()
	var height := image.get_height()
	var suffix := "%s_%s_%s_%dx%d.png" % [gender, tag, label, width, height]
	var path := output_dir.path_join(suffix)
	if image.save_png(path) != OK:
		_fail("Could not save native avatar capture: %s" % path)
		return
	captures += 1
	print("A6 AVATAR NATIVE CAPTURE %s %dx%d" % [path, width, height])
