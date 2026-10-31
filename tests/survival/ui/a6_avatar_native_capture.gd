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
	if not FileAccess.file_exists(PRIVATE_MANIFEST_PATH):
		_fail("Private local runtime metadata is not present in this composed project.")
		quit(1)
		return
	var manifest: Variant = JSON.parse_string(FileAccess.get_file_as_string(PRIVATE_MANIFEST_PATH))
	if not manifest is Dictionary or manifest.get("status", "") != "LOCAL_PRIVATE_PREVIEW_ONLY":
		_fail(
			"Private local runtime metadata is missing; stage source privately before this capture."
		)
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
		"revision": "preview-only-not-a0-save-%s-r0" % gender,
		"appearance_revision": 0,
		"gender": gender,
		"armor_grade": 0,
		"preview_only": true,
		"identity_source": "COMMAND_LINE_FIXTURE_NOT_A0_PERSISTED_SELECTION",
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
	await _settle(0.04)
	var frames_reference: SpriteFrames = avatar.sprite_frames
	var initial_frame := avatar.frame
	await create_timer(0.20).timeout
	await process_frame
	driver.call("update_from_owner")
	_expect(
		avatar.frame != initial_frame and avatar.sprite_frames == frames_reference,
		"source 150 ms idle frames advance while SpriteFrames resource remains stable"
	)
	await _capture("idle")
	_run_revision_contract_checks(owner_projection)
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
			var active_attack_animation := avatar.animation
			var active_attack_frame := avatar.frame
			for _update in 5:
				driver.call("update_from_owner")
			_expect(
				avatar.animation == active_attack_animation and avatar.frame == active_attack_frame,
				"repeated owner updates do not restart or rewind the active A0 sword one-shot"
			)
			await _capture("attack_input")
		Input.action_release("attack")
		await _settle(0.9)
		await _capture_hurt_and_death(avatar)
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
	for action: StringName in [&"move_up", &"move_down", &"move_left", &"move_right", &"attack"]:
		_expect(InputMap.has_action(action), "pinned A0 registers input action %s" % String(action))
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
		(
			DRIVER.action_for_owner_state("DASH", "dash", 0.0) == "idle"
			and DRIVER.action_for_owner_state("ATTACK", "bow_attack", 0.0) == "idle"
			and DRIVER.action_for_owner_state("ATTACK", "axe_cleave", 0.0) == "idle"
			and DRIVER.action_for_owner_state("ATTACK", "light_attack", 0.0) == "idle"
		),
		"unsupported dash/bow/axe actions do not fabricate sword attacks"
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


func _run_revision_contract_checks(base_snapshot: Dictionary) -> void:
	var original_gender := String(base_snapshot.gender)
	var alternate_gender := "female" if original_gender == "male" else "male"
	var unavailable_grade := base_snapshot.duplicate(true)
	unavailable_grade["gender"] = original_gender
	unavailable_grade["armor_grade"] = 1
	unavailable_grade["appearance_revision"] = 1
	unavailable_grade["revision"] = "preview-grade-1-source-blocked"
	_expect(
		(
			not bool(driver.call("update_owner_appearance", unavailable_grade))
			and not bool((driver.get("sprite") as AnimatedSprite2D).visible)
			and driver.get("resolved_appearance").is_empty()
		),
		"new unsupported armor grade hides stale grade-zero art and has no fallback"
	)
	var grade_zero_restore := base_snapshot.duplicate(true)
	grade_zero_restore["appearance_revision"] = 2
	grade_zero_restore["revision"] = "preview-grade-zero-restored"
	_expect(
		(
			bool(driver.call("update_owner_appearance", grade_zero_restore))
			and bool((driver.get("sprite") as AnimatedSprite2D).visible)
			and String(driver.get("resolved_appearance").get("gender", "")) == original_gender
		),
		"newer owner grade-zero revision restores only the matching identity"
	)
	var switch_identity := base_snapshot.duplicate(true)
	switch_identity["gender"] = alternate_gender
	switch_identity["appearance_revision"] = 3
	switch_identity["revision"] = "preview-identity-switch"
	_expect(
		(
			bool(driver.call("update_owner_appearance", switch_identity))
			and String(driver.get("resolved_appearance").get("gender", "")) == alternate_gender
		),
		"driver can rebind to a newer A0-projected identity without choosing it"
	)
	var same_revision_conflict := switch_identity.duplicate(true)
	same_revision_conflict["gender"] = original_gender
	_expect(
		(
			not bool(driver.call("update_owner_appearance", same_revision_conflict))
			and not bool((driver.get("sprite") as AnimatedSprite2D).visible)
		),
		"conflicting payload at the same appearance revision fails closed"
	)
	_expect(
		(
			bool(driver.call("update_owner_appearance", switch_identity))
			and bool((driver.get("sprite") as AnimatedSprite2D).visible)
		),
		"same-revision authoritative projection can recover after conflict rejection"
	)
	_expect(
		(
			not bool(driver.call("update_owner_appearance", grade_zero_restore))
			and String(driver.get("resolved_appearance").get("gender", "")) == alternate_gender
		),
		"stale pre-switch identity cannot roll back the current projection"
	)
	var final_restore := base_snapshot.duplicate(true)
	final_restore["appearance_revision"] = 4
	final_restore["revision"] = "preview-original-identity-restored"
	_expect(
		(
			bool(driver.call("update_owner_appearance", final_restore))
			and String(driver.get("resolved_appearance").get("gender", "")) == original_gender
		),
		"latest preview projection rebinds to the requested canonical source"
	)
	var malformed_latest := final_restore.duplicate(true)
	malformed_latest["appearance_revision"] = 5
	malformed_latest["revision"] = ""
	malformed_latest["gender"] = "unknown"
	_expect(
		(
			not bool(driver.call("update_owner_appearance", malformed_latest))
			and not bool((driver.get("sprite") as AnimatedSprite2D).visible)
			and int(driver.get("owner_appearance_revision")) == 5
		),
		"malformed newer owner payload fails closed but preserves its monotonic revision watermark"
	)
	_expect(
		(
			not bool(driver.call("update_owner_appearance", switch_identity))
			and not bool((driver.get("sprite") as AnimatedSprite2D).visible)
		),
		"older valid identity cannot reappear after a malformed newer projection"
	)
	var corrected_latest := final_restore.duplicate(true)
	corrected_latest["appearance_revision"] = 5
	corrected_latest["revision"] = "preview-corrected-latest"
	_expect(
		(
			bool(driver.call("update_owner_appearance", corrected_latest))
			and bool((driver.get("sprite") as AnimatedSprite2D).visible)
			and String(driver.get("resolved_appearance").get("gender", "")) == original_gender
		),
		"corrected projection at the unseen revision can recover without lowering the revision floor"
	)


func _capture_hurt_and_death(avatar: AnimatedSprite2D) -> void:
	var hit_applied := false
	for attempt in 5:
		if attempt > 0:
			await _settle(0.85)  # A0 hit invulnerability/dodge window must expire before retry.
		var hit_amount := int(actor.get("barrier")) + 1
		hit_applied = bool(
			actor.call("take_damage", hit_amount, actor.global_position + Vector2(8.0, 0.0))
		)
		if hit_applied:
			break
	_expect(hit_applied, "A0's actual damage handler accepts a nonlethal preview hit")
	if not hit_applied:
		return
	await _settle(0.03)
	_expect(
		(
			String(actor.get("current_action")) == "hit"
			and String(avatar.animation).begins_with("hurt/")
		),
		"A0 current_action=hit presents the canonical hurt sheet"
	)
	await _capture("hurt_input")
	await _settle(0.36)
	var facing_value: Variant = actor.get("facing_direction")
	var hurt_animation := StringName("hurt/" + DRIVER.direction_for_vector(facing_value as Vector2))
	_expect(
		(
			avatar.animation == hurt_animation
			and not avatar.is_playing()
			and avatar.frame == avatar.sprite_frames.get_frame_count(hurt_animation) - 1
		),
		"the owner-timed non-looping hurt clip reaches its terminal frame"
	)
	await _settle(0.8)
	var killed := false
	for attempt in 5:
		if bool(actor.get("dead")):
			break
		if attempt > 0:
			await _settle(0.85)
		var lethal_damage := int(actor.get("health")) + int(actor.get("barrier")) + 1
		killed = bool(
			actor.call("take_damage", lethal_damage, actor.global_position + Vector2(8.0, 0.0))
		)
	_expect(
		killed and bool(actor.get("dead")), "A0's actual damage/death path enters its dead state"
	)
	if not bool(actor.get("dead")):
		return
	await _settle(0.05)
	_expect(String(avatar.animation).begins_with("death/"), "A0 dead state selects the death sheet")
	await _settle(1.35)
	var death_animation := avatar.animation
	_expect(
		(
			String(death_animation).begins_with("death/")
			and not avatar.is_playing()
			and avatar.frame == avatar.sprite_frames.get_frame_count(death_animation) - 1
		),
		"source death animation completes on its held terminal pose"
	)
	await _capture("death_terminal")


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
