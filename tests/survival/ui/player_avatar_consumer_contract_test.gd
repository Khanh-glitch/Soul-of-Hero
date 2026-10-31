extends Node

## Executable A6 -> A0 consumer contract for the player avatar.
##
## This is the integration handoff A0 can run on its own: it needs no licensed art,
## no renderer and no save file, because it proves the part that must never lie -
## what the consumer does when the owner projection is absent, empty, or points at
## art that is not staged. The READY path with real sheets is proven separately by
## `avatar_identity_native_test.gd` in the private-staged-art job.
##
##   godot --headless --path . res://tests/survival/ui/player_avatar_consumer_contract_test.tscn
##
## Pass prints `A6 AVATAR CONSUMER CONTRACT PASSED (N checks)` and exits 0.

const PRESENTER_SCRIPT := preload("res://game/survival/player/player_avatar_presenter.gd")

var _checks := 0
var _failures: Array[String] = []


## Stand-in for the A0 owner. It exposes exactly the surface the contract promises
## and nothing else, so the presenter cannot accidentally depend on the real service.
class FakeOwner:
	extends Node
	signal player_avatar_changed(snapshot: Dictionary)
	signal save_loaded(snapshot: Dictionary)
	var projection: Dictionary = {}
	var projectable := true

	func get_player_appearance_projection() -> Dictionary:
		return projection.duplicate(true)

	func announce(next: Dictionary) -> void:
		projection = next
		player_avatar_changed.emit(next)

	## The same-process shape of a reload: A0 re-emits the loaded document.
	func reload() -> void:
		save_loaded.emit({})


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _check_owner_default()
	await _check_owner_without_api()
	await _check_no_identity()
	await _check_claimed_identity_without_art()
	_check_grade_manifest_is_honest()
	await _check_grade_fallback_or_refusal()
	await _check_signal_reresolves()
	_check_state_shape()
	_finish()


## With no injected owner the presenter resolves the production SaveService autoload.
## That fallback is the contract, so it is asserted rather than assumed: a null seam
## must never be treated as "no appearance authority".
func _check_owner_default() -> void:
	var host := _make_host()
	var presenter := _make_presenter(host, null)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_expect(
		String(state.get("status", "")) != "NO_SAVE_SERVICE",
		"a null owner seam falls back to the production SaveService (%s)" % String(state.get("status", "")),
	)
	_cleanup(presenter, host)


## An older owner that has the node but not the projection method is the same
## blocker, not a crash.
func _check_owner_without_api() -> void:
	var host := _make_host()
	var owner := Node.new()
	owner.name = "OwnerWithoutProjection"
	add_child(owner)
	var presenter := _make_presenter(host, owner)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_equals(String(state.get("status", "")), "NO_SAVE_SERVICE", "an owner without the projection method is NO_SAVE_SERVICE")
	_cleanup(presenter, host)
	owner.queue_free()


## Before the player has chosen anyone, the authored actor stays visible: nothing has
## been claimed, so hiding it would be a lie in the other direction.
func _check_no_identity() -> void:
	var host := _make_host()
	var owner := FakeOwner.new()
	owner.name = "EmptyOwner"
	add_child(owner)
	owner.projection = {}
	var presenter := _make_presenter(host, owner)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_equals(String(state.get("status", "")), "NO_IDENTITY", "an empty projection is NO_IDENTITY, not a default character")
	_expect(host.get_node("Sprite").visible, "with no identity chosen the authored actor stays visible")
	_expect(presenter.get_node_or_null("AvatarUnavailable") == null, "no art blocker is shown before a character is chosen")
	_cleanup(presenter, host)
	owner.queue_free()


## The case that matters most: an identity exists but its licensed art is not staged.
## The consumer must remove the proxy actor and say why - never substitute one.
func _check_claimed_identity_without_art() -> void:
	var host := _make_host()
	var owner := FakeOwner.new()
	owner.name = "ClaimedOwner"
	add_child(owner)
	owner.projection = _projection("male")
	var presenter := _make_presenter(host, owner)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_equals(String(state.get("status", "")), "SOURCE_BLOCKED", "a claimed identity without staged art is SOURCE_BLOCKED")
	_expect(not host.get_node("Sprite").visible, "the proxy actor is hidden rather than shown as a substitute player")
	_expect(presenter.get_node_or_null("AvatarUnavailable") != null, "the blocker is visible in the world, not only in a log")
	_expect(not String(state.get("reason", "")).is_empty(), "the blocker explains itself")
	_cleanup(presenter, host)
	owner.queue_free()


## Data-level proof that no unlicensed garment can be presented at all: the shipped
## manifest may only carry a grade record that is loadable. D051 requires grade 1 and
## grade 2 gender-matched art to come from inspected sources; until they do, the record
## must be absent or unloadable, and this test says which.
func _check_grade_manifest_is_honest() -> void:
	var path := "res://game/survival/ui/avatar_art_manifest.json"
	if not FileAccess.file_exists(path):
		_fail("the avatar art manifest is missing")
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	_expect(parsed is Dictionary, "the avatar art manifest parses")
	if not parsed is Dictionary:
		return
	var manifest: Dictionary = parsed
	_equals(String((manifest.get("license_review", {}) as Dictionary).get("status", "")),
		"VERIFIED_GAME_USE", "the manifest states a verified game-use license")
	var people: Dictionary = manifest.get("characters", {})
	for gender: String in ["male", "female"]:
		_expect(people.has(gender), "the manifest has a %s character record" % gender)
		var grades: Dictionary = (people.get(gender, {}) as Dictionary).get("armor_grades", {})
		for grade: String in ["1", "2"]:
			if not grades.has(grade):
				# Not a passing assertion, just the observed fact: with no record there
				# is nothing that could dress the player.
				print("note: %s grade %s has no manifest record; nothing can be presented" % [gender, grade])
				continue
			# A record is only honest if an unlicensed one cannot load.
			var sheet := String((grades[grade] as Dictionary).get("idle_sheet", ""))
			_expect(
				sheet.is_empty() or not ResourceLoader.exists(sheet),
				"%s grade %s does not point at a loadable sheet it is not licensed for (%s)" % [gender, grade, sheet],
			)


## With no staged garment art the consumer must refuse by name, never present the
## proxy character and never claim readiness; and the refusal must survive a reload.
func _check_grade_fallback_or_refusal() -> void:
	for grade: int in [1, 2]:
		var host := _make_host()
		var owner := FakeOwner.new()
		owner.name = "Grade%dOwner" % grade
		add_child(owner)
		owner.projection = _projection("male", grade)
		var presenter := _make_presenter(host, owner)
		await _settle()
		var state: Dictionary = presenter.call(&"get_presentation_state")

		var status := String(state.get("status", ""))
		var gate := String(state.get("appearance_gate", ""))
		var presented := presenter.call(&"get_avatar_sprite") as Node
		if status == "READY":
			# The only legal READY is the same person at their licensed base look.
			_equals(int(state.get("armor_grade", -1)), 0, "grade %d READY is the licensed grade-0 look" % grade)
			_equals(gate, "GRADE_%d_APPEARANCE_SOURCE_BLOCKED" % grade,
				"grade %d fallback records the appearance gate by name" % grade)
			_equals(String(state.get("gender", "")), "male", "grade %d fallback keeps the chosen identity" % grade)
			_expect(presented != null and is_instance_valid(presented),
				"grade %d fallback presents the licensed base character" % grade)
		else:
			# Refusal is the other legal answer, and it must be explicit.
			_equals(status, "SOURCE_BLOCKED", "grade %d without licensed art refuses by name (%s)" % [grade, status])
			_expect(not String(state.get("reason", "")).is_empty(), "grade %d refusal explains itself" % grade)
			_expect(not bool(state.get("ready", true)), "grade %d refusal is never reported ready" % grade)
			_expect(presented == null or not is_instance_valid(presented),
				"grade %d refusal presents no sprite at all, licensed or not" % grade)
			_expect(not host.get_node("Sprite").visible,
				"grade %d refusal hides the proxy character instead of substituting it" % grade)

		# A reload must not upgrade the answer: no unlicensed sprite appears after restart.
		owner.reload()
		await _settle()
		var after: Dictionary = presenter.call(&"get_presentation_state")
		_equals(String(after.get("status", "")), status, "grade %d keeps its answer across a reload" % grade)
		var sprite_after := presenter.call(&"get_avatar_sprite") as Node
		if status != "READY":
			_expect(sprite_after == null or not is_instance_valid(sprite_after),
				"grade %d presents no sprite after a reload either" % grade)
		_cleanup(presenter, host)
		owner.queue_free()


## A changed identity must re-resolve without a restart of the process, and a commit
## that does not change the identity key must not disturb the running clip.
func _check_signal_reresolves() -> void:
	var host := _make_host()
	var owner := FakeOwner.new()
	owner.name = "SignallingOwner"
	add_child(owner)
	owner.projection = {}
	var presenter := _make_presenter(host, owner)
	await _settle()
	_expect(
		String(presenter.call(&"get_presentation_state").get("status", "")) == "NO_IDENTITY",
		"starts with no identity",
	)
	var connections := owner.player_avatar_changed.get_connections()
	_expect(not connections.is_empty(), "the consumer subscribes to player_avatar_changed")
	owner.announce(_projection("male"))
	await _settle()
	var after: Dictionary = presenter.call(&"get_presentation_state")
	_expect(
		String(after.get("status", "")) != "NO_IDENTITY",
		"the announcement is consumed and the identity is resolved (%s)" % String(after.get("status", "")),
	)
	owner.announce(_projection("male"))
	await _settle()
	_equals(
		String(presenter.call(&"get_presentation_state").get("status", "")),
		String(after.get("status", "")),
		"a second announcement of the same identity does not change the presented state",
	)
	_cleanup(presenter, host)
	owner.queue_free()


## The published state must always carry enough for A0 to act on the consumer's
## answer without reaching into its internals.
func _check_state_shape() -> void:
	var host := _make_host()
	var owner := FakeOwner.new()
	owner.name = "ShapeOwner"
	add_child(owner)
	var presenter := _make_presenter(host, owner)
	var state: Dictionary = presenter.call(&"get_presentation_state")
	for key: String in ["status", "ready", "gender", "armor_grade", "reason", "action", "direction"]:
		_expect(state.has(key), "presentation state exposes '%s'" % key)
	_cleanup(presenter, host)
	owner.queue_free()


func _projection(gender: String, grade := 0) -> Dictionary:
	return {
		"schema": "soh.ui.avatar_appearance.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"gender": gender,
		"armor_grade": grade,
		"revision": "player_avatar:%s:g%d:r1" % [gender, grade],
	}


## A host shaped like the production actor: a Node2D with an AnimatedSprite2D child
## named `Sprite`, which is exactly what the presenter looks for.
func _make_host() -> Node2D:
	var host := Node2D.new()
	host.name = "ContractHost"
	var sprite := AnimatedSprite2D.new()
	sprite.name = "Sprite"
	sprite.sprite_frames = SpriteFrames.new()
	host.add_child(sprite)
	add_child(host)
	return host


func _make_presenter(host: Node2D, owner: Node) -> Node:
	var presenter := PRESENTER_SCRIPT.new() as Node
	presenter.name = "AvatarPresenter"
	presenter.set(&"owner_source", owner)
	host.add_child(presenter)
	return presenter


func _cleanup(presenter: Node, host: Node) -> void:
	if is_instance_valid(host) and host.is_inside_tree():
		host.get_parent().remove_child(host)
	host.queue_free()
	if is_instance_valid(presenter):
		presenter.queue_free()


func _settle() -> void:
	for _frame in range(3):
		await get_tree().process_frame


func _equals(actual: Variant, expected: Variant, label: String) -> void:
	_checks += 1
	if actual != expected:
		_failures.append("%s (got %s, expected %s)" % [label, str(actual), str(expected)])


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _finish() -> void:
	if _failures.is_empty():
		print("A6 AVATAR CONSUMER CONTRACT PASSED (%d checks)" % _checks)
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("A6 AVATAR CONSUMER CONTRACT FAILED: ", failure)
	print("A6 AVATAR CONSUMER CONTRACT FAILED (%d/%d)" % [_failures.size(), _checks])
	get_tree().quit(1)
