extends Node

## Native A6 identity/avatar integration test.
##
## Runs the real project (autoloads + routes + the production Knight scene) and
## proves, on a real Godot 4.7 binary:
##   * New Game asks for an identity and stores it in A0 SaveService only;
##   * the stored identity drives the CraftPix avatar pipeline instead of the
##     Knight art, and the animation frames actually advance without resetting;
##   * movement, attack, damage, death and respawn all present the matching
##     directional clip;
##   * a second, independent process reads the same identity back (phase=verify);
##   * the save is never damaged and no item is granted by any of this.
##
## Usage (after `--`):
##   --avatar-identity-test --avatar-phase=full|verify
##   [--avatar-gender=male|female] [--avatar-expectation=auto|ready|blocked]

const PRIVATE_MANIFEST_PATH := "res://private_art/a6_avatar/avatar_art_private_runtime.json"
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const SOURCE_FRAME_COUNT_IDLE := 12
const ATTACK_INPUT := &"attack"
const RIGHT_INPUT := &"move_right"
const UP_INPUT := &"move_up"

var _app_root: Node
var _save: Node
var _checks := 0
var _failures: Array[String] = []
var _phase := "full"
var _gender := "male"
var _expectation := "auto"
var _knight: CharacterBody2D
var _presenter: Node2D
var _inventory_before: Dictionary = {}


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	_phase = _argument_value(args, "--avatar-phase", "full")
	_gender = _argument_value(args, "--avatar-gender", "male")
	_expectation = _argument_value(args, "--avatar-expectation", "auto")
	_save = get_tree().root.get_node_or_null("SaveService")
	_expect(_save != null, "production SaveService autoload is available")
	if _save == null:
		_finish()
		return
	_inventory_before = _save.call(&"inventory_totals")
	if _phase == "verify":
		await _run_verify_phase()
	else:
		await _run_full_phase()
	_finish()


func _run_full_phase() -> void:
	_expect(await _wait_for_route(&"title", 12000), "the game boots to the authored profile choice")
	var title := _current_screen()
	_expect(title != null and title.name == &"TitleScreen", "the title screen is the production scene")
	if title == null:
		return
	_expect(
		not bool(_save.call(&"has_player_avatar")),
		"a fresh profile has no identity before the player chooses"
	)
	var new_game_button := title.find_child("NewGameButton", true, false) as Button
	_expect(new_game_button != null, "New Game is reachable")
	if new_game_button == null:
		return
	new_game_button.pressed.emit()
	_expect(await _wait_for_route(&"avatar_choice", 8000), "New Game opens the identity step")
	var choice := _current_screen()
	_expect(choice != null and choice.name == &"AvatarChoiceScreen", "the authored identity scene is mounted")
	if choice == null:
		return
	var button_name := "MaleButton" if _gender == "male" else "FemaleButton"
	var identity_button := choice.find_child(button_name, true, false) as Button
	_expect(identity_button != null, "the requested identity button exists")
	if identity_button == null:
		return
	identity_button.pressed.emit()
	_expect(await _wait_for_route(&"home", 8000), "choosing an identity enters Home")

	var avatar: Dictionary = _save.call(&"get_player_avatar")
	_expect(String(avatar.get("gender", "")) == _gender, "SaveService stores the chosen identity")
	_expect(String(avatar.get("schema", "")) == "soh.player_avatar.v1", "identity record carries its schema")
	_expect(int(avatar.get("revision", 0)) >= 1, "identity revision advances")
	var projection: Dictionary = _save.call(&"get_player_appearance_projection")
	_expect(String(projection.get("provenance", "")) == "A0_OWNER_PROJECTION", "identity projection is A0-owned")
	_expect(not String(projection.get("revision", "")).is_empty(), "projection carries a revision token")
	_expect(String(projection.get("gender", "")) == _gender, "projection echoes the chosen identity")

	await _check_home_avatar()
	await _check_knight_avatar()
	_check_persistence_and_inventory()


func _run_verify_phase() -> void:
	_expect(bool(_save.call(&"has_player_avatar")), "an independent process still sees a stored identity")
	var avatar: Dictionary = _save.call(&"get_player_avatar")
	_expect(
		String(avatar.get("gender", "")) == _gender,
		"the independent process restores the same identity (%s)" % _gender
	)
	_expect(await _wait_for_route(&"title", 12000), "the second process boots to the profile choice")
	var title := _current_screen()
	if title == null:
		return
	var continue_button := title.find_child("ContinueButton", true, false) as Button
	_expect(continue_button != null, "Continue is reachable in the second process")
	if continue_button == null:
		return
	continue_button.pressed.emit()
	_expect(await _wait_for_route(&"home", 8000), "Continue enters Home without rewriting the save")
	await _check_home_avatar()
	await _check_knight_avatar()
	_check_persistence_and_inventory()


func _check_home_avatar() -> void:
	await get_tree().process_frame
	var home := _current_screen()
	_expect(home != null, "Home is mounted")
	if home == null:
		return
	var home_player := _find_avatar_host(home)
	_expect(home_player != null, "Home owns the authored player actor")
	if home_player == null:
		return
	var presenter := home_player.get_node_or_null(^"AvatarPresenter")
	_expect(presenter != null, "Home actor carries the avatar presenter")
	if presenter == null:
		return
	await _wait_frames(6)
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_expect_state_matches_expectation(state, "Home")
	var present_sprite := home_player.get_node_or_null(^"Sprite") as AnimatedSprite2D
	if present_sprite != null:
		_expect(
			present_sprite.visible == (String(state.get("status", "")) != "READY"),
			"Home hides the Knight art exactly when the chosen character is drawn"
		)
	_expect(
		String(state.get("gender", "")) == _gender,
		"Home presents the identity the player chose"
	)


func _check_knight_avatar() -> void:
	# The real Chapter 1 overworld instantiates the production Knight scene, so
	# physics, input, combat, death and respawn here are the shipping ones.
	AppFlow.open_overworld()
	_expect(await _wait_for_route(&"overworld", 20000), "the overworld route loads the production player")
	var world := _current_screen()
	if world != null and world.has_method(&"is_world_ready"):
		await _wait_until(func() -> bool: return bool(world.call(&"is_world_ready")), 60000)
	await _wait_frames(5)
	_knight = _find_player()
	_expect(_knight != null, "the overworld owns a live player actor")
	if _knight == null:
		return
	_presenter = _knight.get_node_or_null(^"AvatarPresenter")
	_expect(_presenter != null, "production Knight carries the avatar presenter")
	if _presenter == null:
		return
	var state: Dictionary = _presenter.call(&"get_presentation_state")
	_expect_state_matches_expectation(state, "Gameplay")
	if String(state.get("status", "")) != "READY":
		# Art-gate path: the Knight must be hidden, no items granted and the save
		# must still carry the identity. That is the honest fail-closed contract.
		var knight_sprite := _knight.get_node_or_null(^"Sprite") as AnimatedSprite2D
		_expect(
			knight_sprite != null and not knight_sprite.visible,
			"fail-closed hides the Knight instead of substituting it"
		)
		_expect(bool(_save.call(&"has_player_avatar")), "fail-closed keeps the stored identity")
		return
	await _check_locomotion_clips()
	await _check_attack_clip()
	await _check_hurt_and_death_clip()
	_check_respawn_clip()
	await _check_equipment_grade_presentation()


func _check_locomotion_clips() -> void:
	Input.action_press(RIGHT_INPUT)
	await _wait_frames(10)
	var right_direction := String(_presenter.call(&"get_presented_direction"))
	var right_action := String(_presenter.call(&"get_presented_action"))
	_expect(right_direction == "side_right", "moving right presents the side_right row (%s)" % right_direction)
	var measured_speed := (_knight as CharacterBody2D).velocity.length()
	var expected_action := "idle"
	if measured_speed > 6.0:
		expected_action = "run" if measured_speed >= 120.0 else "walk"
	_expect(
		right_action == expected_action,
		"locomotion clip follows real movement (speed %.1f -> %s, got %s)" % [
			measured_speed, expected_action, right_action,
		]
	)
	_expect(right_action != "death" and right_action != "hurt", "movement never shows a combat clip")
	Input.action_release(RIGHT_INPUT)
	Input.action_press(UP_INPUT)
	await _wait_frames(10)
	var back_direction := String(_presenter.call(&"get_presented_direction"))
	_expect(back_direction == "back", "moving up presents the back row (%s)" % back_direction)
	Input.action_release(UP_INPUT)
	await _wait_frames(12)
	await _check_frame_progression()


## A clip that is rewound every frame cannot show more than one or two distinct
## frames; a healthy loop walks the whole strip and only wraps at the end.
func _check_frame_progression() -> void:
	var avatar_sprite := _presenter.call(&"get_avatar_sprite") as AnimatedSprite2D
	_expect(avatar_sprite != null, "the avatar sprite is mounted")
	if avatar_sprite == null:
		return
	_expect(avatar_sprite.texture_filter == CanvasItem.TEXTURE_FILTER_NEAREST, "avatar art renders crisply")
	_expect(avatar_sprite.is_playing(), "the presented clip is playing")
	var observed: Array[int] = []
	for _index in range(24):
		await get_tree().process_frame
		observed.append(avatar_sprite.frame)
	var distinct: Dictionary = {}
	var backwards := 0
	for index in observed.size():
		distinct[observed[index]] = true
		if index > 0 and observed[index] < observed[index - 1]:
			backwards += 1
	_expect(distinct.size() >= 3, "idle animation advances through distinct frames (%d)" % distinct.size())
	_expect(backwards <= 1, "idle animation does not reset every frame (%d backward steps)" % backwards)


func _check_attack_clip() -> void:
	Input.action_press(ATTACK_INPUT)
	await _wait_frames(2)
	Input.action_release(ATTACK_INPUT)
	var saw_attack := await _wait_for_presented_action("attack", 1600, 900)
	_expect(saw_attack, "attack presents the sword attack clip")
	await _wait_frames(20)


func _check_hurt_and_death_clip() -> void:
	_knight.invulnerability_remaining = 0.0
	_knight.take_damage(4, _knight.global_position + Vector2(16, 0))
	var saw_hurt := await _wait_for_presented_action("hurt", 1200, 900)
	_expect(saw_hurt, "taking damage presents the hurt clip")
	await _wait_frames(12)
	_knight.invulnerability_remaining = 0.0
	_knight.take_damage(999999, _knight.global_position + Vector2(16, 0))
	var saw_death := await _wait_for_presented_action("death", 2000, 900)
	_expect(saw_death, "a lethal hit presents the death clip")
	var avatar_sprite := _presenter.call(&"get_avatar_sprite") as AnimatedSprite2D
	_expect(avatar_sprite != null, "the avatar sprite survives death")
	if avatar_sprite == null:
		return
	var animation_name := String(avatar_sprite.animation)
	_expect(animation_name.begins_with("death/"), "death clip is a directional death row (%s)" % animation_name)
	await _wait_frames(90)
	var resting_frame := avatar_sprite.frame
	await _wait_frames(20)
	_expect(
		avatar_sprite.frame == resting_frame,
		"the death clip holds its final pose instead of looping"
	)


func _check_respawn_clip() -> void:
	_expect(bool(_knight.get("dead")), "the Knight is dead before respawn")
	_knight.respawn(Vector2(120, 96))
	_expect(not bool(_knight.get("dead")), "respawn clears the dead state")
	var state: Dictionary = _presenter.call(&"get_presentation_state")
	_expect(String(state.get("status", "")) == "READY", "the avatar is still presented after respawn")
	var action := String(_presenter.call(&"get_presented_action"))
	_expect(action != "death", "respawn leaves the death clip (%s)" % action)
	_expect(
		String(_save.call(&"get_player_avatar").get("gender", "")) == _gender,
		"respawn keeps the stored identity"
	)


## What the player wears is A0 state, never art state. Equipping real gear must
## keep the same chosen character on screen and unequipping must restore the base
## look; a commit that cannot change appearance must not restart the clip.
func _check_equipment_grade_presentation() -> void:
	var sprite_before := _presenter.call(&"get_avatar_sprite") as AnimatedSprite2D
	_expect(sprite_before != null, "equipment checks start from a mounted avatar")
	if sprite_before == null:
		return
	var revision_before_grant := String(_save.call(&"get_player_appearance_projection").get("revision", ""))
	var vessel: Dictionary = AUX_RULES.generate_item(&"soul_vessel", &"normal", 2, 71001, &"a6_native")
	_expect(
		bool(_save.call(&"grant_auxiliary_equipment", vessel, "a6:fixture:grant_vessel")),
		"the gate grants one real Soul Vessel as a fixture"
	)
	_expect(
		bool(_save.call(&"grant_player_levels", 1, "a6:fixture:level_two")),
		"the gate reaches the Vessel unlock level through A0 progression"
	)
	_expect(
		bool(_save.call(&"equip_auxiliary_equipment", String(vessel.get("uuid", "")), "a6:fixture:equip_vessel")),
		"the Vessel equips through the A0 transaction path"
	)
	await _wait_frames(4)
	var equipped_projection: Dictionary = _save.call(&"get_player_appearance_projection")
	_expect(int(equipped_projection.get("armor_grade", -1)) == 1, "A0 requests grade 1 for one equipped Vessel")
	_expect(
		String(equipped_projection.get("revision", "")) != revision_before_grant,
		"equipment changes the projection revision"
	)
	var equipped_state: Dictionary = _presenter.call(&"get_presentation_state")
	_expect(String(equipped_state.get("gender", "")) == _gender, "equipping keeps the chosen character")
	_expect(bool(equipped_state.get("has_avatar_sprite", false)), "equipping keeps a real avatar on screen")
	var gate := String(equipped_state.get("appearance_gate", ""))
	var presented_grade := int(equipped_state.get("armor_grade", -1))
	_expect(
		(gate == "GRADE_1_APPEARANCE_SOURCE_BLOCKED" and presented_grade == 0)
			or (gate.is_empty() and presented_grade == 1),
		"grade 1 either presents verified art or reports the explicit gate (gate=%s grade=%d)" % [
			gate, presented_grade,
		]
	)
	_expect(
		bool(_save.call(&"unequip_auxiliary_slot", &"soul_vessel", "a6:fixture:unequip_vessel")),
		"the Vessel unequips through the A0 transaction path"
	)
	await _wait_frames(4)
	var restored_state: Dictionary = _presenter.call(&"get_presentation_state")
	_expect(String(restored_state.get("status", "")) == "READY", "removing gear keeps the avatar presented")
	_expect(String(restored_state.get("appearance_gate", "")).is_empty(), "the grade gate clears when the gear is removed")
	_expect(int(restored_state.get("armor_grade", -1)) == 0, "removing gear restores the base appearance")
	_expect(String(restored_state.get("gender", "")) == _gender, "unequipping keeps the same character")
	var sprite_after := _presenter.call(&"get_avatar_sprite") as AnimatedSprite2D
	_expect(sprite_after != null and sprite_after.is_playing(), "the avatar still animates after the gear round trip")
	var resolved_after := String(_presenter.call(&"get_resolved_revision"))
	_expect(not resolved_after.is_empty(), "the mounted avatar records the revision it was built from")
	_expect(
		bool(_save.call(&"set_tutorial_completed", &"a6_native_cosmetic", "a6:fixture:cosmetic_commit")),
		"an unrelated A0 commit succeeds"
	)
	await _wait_frames(3)
	_expect(
		String(_presenter.call(&"get_resolved_revision")) == resolved_after,
		"an unrelated commit does not rebuild the avatar"
	)
	_expect(
		_presenter.call(&"get_avatar_sprite") == sprite_after,
		"an unrelated commit keeps the same sprite node instead of restarting the clip"
	)
	_expect(
		not bool(_save.call(&"grant_auxiliary_equipment", vessel, "a6:fixture:grant_vessel")),
		"the fixture grant receipt cannot replay, so the round trip duplicated nothing"
	)
	_expect(
		bool(_save.call(&"equip_auxiliary_equipment", String(vessel.get("uuid", "")), "a6:fixture:reequip_vessel")),
		"the same Vessel instance can be equipped again after unequipping"
	)
	_expect(
		bool(_save.call(&"unequip_auxiliary_slot", &"soul_vessel", "a6:fixture:final_unequip")),
		"the final unequip leaves the profile on the base appearance"
	)
	await _wait_frames(2)
	# From here on the profile legitimately owns one fixture Vessel, so the
	# "identity work grants nothing" check measures only the remaining work.
	_inventory_before = _save.call(&"inventory_totals")


func _check_persistence_and_inventory() -> void:
	_expect(bool(_save.call(&"save_now")), "the profile can be committed to disk")
	_expect(bool(_save.call(&"reload_save")), "the profile can be reloaded from disk")
	_expect(
		String(_save.call(&"get_player_avatar").get("gender", "")) == _gender,
		"identity survives a disk reload"
	)
	var inventory_after: Dictionary = _save.call(&"inventory_totals")
	_expect(inventory_after == _inventory_before, "identity and avatar work grant no items")


func _expect_state_matches_expectation(state: Dictionary, context: String) -> void:
	var status := String(state.get("status", ""))
	if _expectation == "ready":
		_expect(status == "READY", "%s presents the licensed avatar art (%s)" % [context, status])
	elif _expectation == "blocked":
		_expect(status == "SOURCE_BLOCKED", "%s fails closed without private art (%s)" % [context, status])
	else:
		_expect(
			status in ["READY", "SOURCE_BLOCKED"],
			"%s reports an explicit avatar gate (%s)" % [context, status]
		)
	if _expectation != "blocked":
		return
	_expect(
		not String(state.get("reason", "")).is_empty(),
		"%s explains why art is unavailable" % context
	)


func _wait_for_presented_action(action: String, timeout_msec: int, poll_msec: int) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_msec
	while Time.get_ticks_msec() < deadline:
		if _presenter == null or not is_instance_valid(_presenter):
			return false
		if String(_presenter.call(&"get_presented_action")) == action:
			return true
		await get_tree().create_timer(float(poll_msec) / 1000.0).timeout
	return false


func _wait_for_route(route_id: StringName, timeout_msec := 4000) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_msec
	while Time.get_ticks_msec() < deadline:
		if is_instance_valid(_app_root) and StringName(_app_root.call(&"get_current_route")) == route_id:
			await get_tree().process_frame
			return true
		await get_tree().create_timer(0.02).timeout
	return false


func _wait_until(predicate: Callable, timeout_msec: int) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_msec
	while Time.get_ticks_msec() < deadline:
		if bool(predicate.call()):
			return true
		await get_tree().process_frame
	return bool(predicate.call())


func _wait_frames(count: int) -> void:
	for _index in range(count):
		await get_tree().process_frame


## The Home map names its instanced actor "Player"; the overworld keeps the
## authored "Knight" node. Both carry the presenter, so discover by contract.
func _find_avatar_host(root: Node) -> CharacterBody2D:
	for candidate: Node in root.find_children("*", "CharacterBody2D", true, false):
		if candidate.get_node_or_null(^"AvatarPresenter") != null:
			return candidate as CharacterBody2D
	return null


func _find_player() -> Node:
	var players := get_tree().get_nodes_in_group(&"player")
	for candidate: Node in players:
		if candidate.get_node_or_null(^"AvatarPresenter") != null:
			return candidate
	return null


func _current_screen() -> Node:
	if not is_instance_valid(_app_root):
		return null
	var host := _app_root.get_node_or_null(^"RouteHost")
	return host.get_child(0) if host != null and host.get_child_count() == 1 else null


func _argument_value(args: PackedStringArray, key: String, fallback: String) -> String:
	for argument: String in args:
		if argument.begins_with(key + "="):
			return argument.substr((key + "=").length()).strip_edges()
	return fallback


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _finish() -> void:
	var exit_code := 0 if _failures.is_empty() else 1
	if _failures.is_empty():
		print("A6 AVATAR IDENTITY NATIVE TEST PASSED (%s) — %d checks" % [_phase, _checks])
	else:
		for failure: String in _failures:
			push_error("A6 AVATAR IDENTITY FAIL: %s" % failure)
		print("A6 AVATAR IDENTITY NATIVE TEST FAILED (%s) — %d/%d" % [_phase, _failures.size(), _checks])
	get_tree().quit(exit_code)
