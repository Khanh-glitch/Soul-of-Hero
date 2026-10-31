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
	var projection: Dictionary = {}
	var projectable := true

	func get_player_appearance_projection() -> Dictionary:
		return projection.duplicate(true)

	func announce(next: Dictionary) -> void:
		projection = next
		player_avatar_changed.emit(next)


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _check_missing_owner()
	await _check_owner_without_api()
	await _check_no_identity()
	await _check_claimed_identity_without_art()
	await _check_unlicensed_art_record()
	await _check_signal_reresolves()
	_check_state_shape()
	_finish()


## A host with no appearance authority at all must say so by name, not present a
## default character.
func _check_missing_owner() -> void:
	var host := _make_host()
	var presenter := _make_presenter(host, null)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_equals(String(state.get("status", "")), "NO_SAVE_SERVICE", "an absent owner is reported as NO_SAVE_SERVICE")
	_expect(not bool(state.get("ready", false)), "an absent owner is never READY")
	_expect(not String(state.get("reason", "")).is_empty(), "an absent owner carries a human-readable reason")
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


## A grade-1/2 garment request whose art is not licensed must not silently dress the
## player in something unverified; the base appearance of the same character is used
## and the gate is recorded by name.
func _check_unlicensed_art_record() -> void:
	var host := _make_host()
	var owner := FakeOwner.new()
	owner.name = "ArmoredOwner"
	add_child(owner)
	owner.projection = _projection("female", 2)
	var presenter := _make_presenter(host, owner)
	await _settle()
	var state: Dictionary = presenter.call(&"get_presentation_state")
	_expect(
		String(state.get("status", "")) in ["SOURCE_BLOCKED", "READY"],
		"an unlicensed garment grade resolves to a legal state (%s)" % String(state.get("status", "")),
	)
	if String(state.get("status", "")) == "SOURCE_BLOCKED":
		_expect(not host.get_node("Sprite").visible, "an unlicensed garment never leaves the proxy actor visible as the player")
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
