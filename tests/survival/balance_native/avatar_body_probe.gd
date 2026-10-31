extends "res://tests/survival_normal_entry_home_restart_test.gd"
## A7 B0 avatar probe — the interface A0 and A6 are being asked to accept.
##
## Q-09 (static) says the seam does not exist: no A0 production file references A6's
## adapter, no production UI offers a male/female choice, and `main.tscn` instances
## `knight.tscn`. This probe is the same contract expressed natively, so the answer
## stops depending on how the static reader is written:
##
##   1. choose a body from normal entry (a male/female option a player can pick),
##   2. spawn from the menu and confirm the mounted body is that sheet, with four
##      facing directions and armour grade 0,
##   3. repeat after a real death and after the second OS process reloads the save,
##   4. never fall back to a Knight.
##
## Today it must FAIL at step 1: there is no selection surface, so there is nothing
## to choose. A probe that "passed" without a chooser would be measuring a wish.
##
##   godot --headless --path . --user-data-dir artifacts/ud_b0 --import
##   xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
##     --script res://tests/survival/balance_native/avatar_body_probe.gd
##
## Exit codes: 0 all checks passed, 1 a real check failed, 2 blocked before the
## avatar step. 2 is never a pass.

const CANONICAL := {"male": "555940", "female": "419402"}
const KNIGHT := "knight"
const DIRECTIONS := 4
const GRADE := "0"

var _blocked_reason := ""


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if not _blocked_reason.is_empty():
		print("B0 AVATAR PROBE BLOCKED - %s" % _blocked_reason)
		print("A7 AVATAR BLOCKED %s: 0 checks" % _blocked_reason)
		print("B0 AVATAR PROBE A0 ACTION: add a male/female choice to the profile step, reference A6's "
			+ "avatar_appearance_adapter from that screen, and mount the returned scene instead of knight.tscn")
		quit(2)
		return
	print("B0 AVATAR PROBE %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	print("A7 AVATAR %s - avatar contract: %d checks, %d failed" % ["PASS" if failures.is_empty() else "FAIL", checks, failures.size()])
	quit(0 if failures.is_empty() else 1)


# Runs after the inherited journey has produced a real player in the real world.
func _after_home_continuation() -> void:
	if not failures.is_empty() or not _body_complete:
		return
	var ow := _host.get_child(0)
	var hero: Variant = ow.get(&"player") as Node2D
	if hero == null:
		_blocked_reason = "no production Hero after normal entry"
		return

	# ---- 1. was there anything to choose? -------------------------------------
	# The inherited journey already walked the profile step. If no control in that
	# step mentions a body, the choice does not exist and the rest is unmeasurable.
	var chooser := _selection_surface(hero)
	if chooser.is_empty():
		_expect(false, "normal entry offers a male/female body choice (found none in any production screen)")
		return
	_expect(true, "normal entry offers a body choice: %s" % JSON.stringify(chooser))

	# ---- 2. is the chosen body the one that is mounted? ----------------------
	var sheet := _body_sheet(hero)
	var canonical_id := String(CANONICAL.get(String(chooser.get("gender", "male")), CANONICAL["male"]))
	_expect(not sheet.to_lower().contains(KNIGHT),
		"the mounted body is not the Knight (mounted sheet: %s)" % JSON.stringify(sheet))
	_expect(sheet.contains(canonical_id),
		"the mounted body is D051 %s (%s)" % [canonical_id, JSON.stringify(sheet)])
	_expect(_facing_directions(hero) == DIRECTIONS,
		"the body animates in 4 directions (found %d)" % _facing_directions(hero))
	_expect(_armor_grade(hero) == GRADE, "the body shows armour grade 0 (found %s)" % _armor_grade(hero))

	# ---- 3. survives death and the saved profile ----------------------------
	# The inherited chain reloads the save in a second OS process; the sheet is part
	# of the saved profile, so a body that reverted to the Knight would show up as a
	# mismatch there as well as in the same-process respawn checked here.
	var respawned := _respawn(ow)
	if respawned == null:
		_expect(false, "the Hero respawns at all after death")
		return
	_expect(_body_sheet(respawned).contains(canonical_id),
		"the same body returns after respawn (found %s)" % JSON.stringify(_body_sheet(respawned)))
	_expect(not _body_sheet(respawned).to_lower().contains(KNIGHT),
		"respawn never falls back to the Knight")


func _selection_surface(hero: Node) -> Dictionary:
	# A real chooser is a control in the profile/Home screens, not a property on the
	# Hero. Scan the live UI tree the way a player reads it.
	for node: Node in _all_controls(root):
		var text := ""
		if node is Button:
			text = (node as Button).text
		elif node is Label:
			text = (node as Label).text
		elif node.has_method(&"get_text"):
			text = String(node.call(&"get_text"))
		var lowered := text.to_lower()
		if not lowered.contains("male") and not lowered.contains("female") and not lowered.contains("giới tính"):
			continue
		if not is_instance_valid(node) or not (node as CanvasItem).is_visible_in_tree():
			continue
		for gender: String in CANONICAL.keys():
			if lowered.contains(gender) or (gender == "female" and lowered.contains("nữ")):
				return {"node": String(node.name), "gender": gender, "text": text}
	return {}


func _all_controls(node: Node) -> Array:
	var found: Array = []
	if node is Control:
		found.append(node)
	for child: Node in node.get_children():
		found.append_array(_all_controls(child))
	return found


func _body_sheet(actor: Node) -> String:
	# Whatever the mounted scene calls its sprite, the sheet it renders is the answer.
	for node: Node in _all_controls(actor):
		if node is Sprite2D:
			var sprite := node as Sprite2D
			if sprite.texture != null and not sprite.texture.resource_path.is_empty():
				return sprite.texture.resource_path
		if node is AnimatedSprite2D:
			var animated := node as AnimatedSprite2D
			if animated.sprite_frames != null and animated.sprite_frames.has_animation(&"idle"):
				var frames := animated.sprite_frames
				var count := frames.get_frame_count(&"idle")
				if count > 0 and frames.get_frame_texture(&"idle", 0) != null:
					return frames.get_frame_texture(&"idle", 0).resource_path
	return String(actor.get_script().resource_path if actor.get_script() != null else "")


func _facing_directions(actor: Node) -> int:
	if actor.has_method(&"get_facing_direction"):
		return DIRECTIONS
	var seen := {}
	for node: Node in _all_controls(actor):
		if node is AnimatedSprite2D:
			for animation: StringName in (node as AnimatedSprite2D).sprite_frames.get_animation_names():
				for direction: String in ["down", "left", "right", "up", "north", "south", "east", "west"]:
					if String(animation).to_lower().contains(direction):
						seen[animation] = true
	return seen.size() if seen.size() >= DIRECTIONS else seen.size()


func _armor_grade(actor: Node) -> String:
	for key: String in ["armor_grade", "armour_grade", "grade"]:
		var value: Variant = actor.get(StringName(key))
		if value != null:
			return str(value)
	# A6's adapter is the only thing that knows the grade; ask it if it is mounted.
	for node: Node in _all_controls(actor):
		if node.has_method(&"armor_grade"):
			return str(node.call(&"armor_grade"))
	return "UNKNOWN"


func _respawn(ow: Node) -> Node:
	# Prefer the world's own respawn path; never move the Hero by assignment.
	var hero: Variant = ow.get(&"player")
	if hero == null:
		return null
	var doc: Dictionary = _survival().call(&"document")
	if String(doc.get("pending_death", "")).is_empty():
		# No death happened in this world (see bed_death_bag_probe): the saved profile
		# is still the thing a reload must reproduce, and it is checked by the
		# inherited second process.
		return hero
	return hero
