extends "res://tests/survival_normal_entry_home_restart_test.gd"
## A7 B0 route probe — one player, one real source event, one honest verdict.
##
## This extends A0's *normal entry* journey instead of inventing a scene. The parent
## boots the product shell, walks the real menus, pays the real home journey and then
## reloads the save in a second OS process (that comparison already covers inventory,
## structures, receipts and world slice exactly). This probe adds the part no A0 test
## has ever done from a player gesture:
##
##   walk to the Waystation locker -> press `interact` -> one A3-authorised receipt
##   -> press again (must refuse) -> walk to the cache -> press -> second receipt
##
## It never creates a node, never moves the Hero by assignment and never calls the
## economy service directly to make something pass: the only way state changes here
## is a key press the Knight itself resolves through `player_interactable`.
##
## Today it stops at step 1 with exit 2, because production builds ship
## `survival/a0_waystation_candidate` off, so the Waystation host is not mounted at
## all. That is a true statement about the product, and the probe reports it instead
## of manufacturing a mount.
##
##   godot --headless --path . --user-data-dir artifacts/ud_b0 --import
##   xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
##     --script res://tests/survival/balance_native/first_hour_route_probe.gd
##
## Exit: 0 every check held, 1 a real check failed, 2 blocked before the first press.

## The exact production flag the shipped project file is missing.
const GUARD := "survival/a0_waystation_candidate"
## Points are named by A0's host; no coordinate is repeated here.
const LOCKER := "Locker"
const CACHE := "Cache"
## Authored player-visible outcomes, quoted from a0.waystation_host.gd.
const MSG_OPENED := "Salvage access unlocked. The locker held no items."
const MSG_DUPLICATE := "Already opened."
const MSG_CACHE := "Cache: 3 iron scrap and 2 knowledge spares."

var _blocked := ""
var _forced := false


func _console() -> void:
	# Opt-in, never default: setting a production flag from a test is not acceptance.
	# It only separates "not mounted" from "mounted and broken", and the summary line
	# says which of the two the numbers describe.
	if OS.get_cmdline_user_args().has("--force-branch"):
		ProjectSettings.set_setting(GUARD, true)
		_forced = true
	await super._console()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down", "interact"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if not _blocked.is_empty():
		print("B0 ROUTE PROBE BLOCKED - %s" % _blocked)
		print(
			"B0 ROUTE PROBE A0 ACTION: add `%s=true` to project.godot and mount the Waystation host from "
			% GUARD
			+ "the composed world (the code path already exists in chapter1_overworld.gd); then re-vendor A3's "
			+ "world_source_bindings.v3.json so the cache instance resolves."
		)
		quit(2)
		return
	var verdict := "PASSED" if failures.is_empty() else "FAILED"
	if _forced:
		verdict += "_UNDER_FORCED_FLAG (evidence class: SOURCE_PRESENT_BEHIND_GUARD, not acceptance)"
	print("B0 ROUTE PROBE %s - %d checks" % [verdict, checks])
	quit(0 if failures.is_empty() else 1)


func _after_home_continuation() -> void:
	if not failures.is_empty() or not _body_complete:
		return
	var ow := _host.get_child(0) as Node2D
	if ow == null:
		_blocked = "the normal-entry route produced no overworld"
		return
	var host := ow.get_node_or_null("WaystationRuntime")
	if host == null:
		_blocked = "no WaystationRuntime under the mounted overworld (%s is %s)" % [
			GUARD, str(ProjectSettings.get_setting(GUARD, false))
		]
		return
	var hero := ow.get(&"player") as CharacterBody2D
	if hero == null:
		_blocked = "the mounted player is not a CharacterBody2D, so no real walk is possible"
		return
	var nav := ow.get(&"traversability") as OverworldTraversability
	if nav == null:
		_blocked = "the mounted world has no traversability, so no reach can be measured"
		return
	var locker := _point(host, LOCKER)
	var cache := _point(host, CACHE)
	if locker == null or cache == null:
		_blocked = "the host mounted without its authored %s/%s points" % [LOCKER, CACHE]
		return

	# ---- 1. a real walk to an authored stand cell --------------------------
	var stood := await _stand_at(host, locker, nav, hero)
	if not stood:
		_expect(false, "the Hero can walk to %s's authored stand cell with ordinary input" % LOCKER)
		return
	# Only the host can say whether the Hero is close enough *and* on the right cell.
	_expect(_in_range_points(host, hero) == [locker],
		"exactly one world action is in range at the press point (found %d)" % _in_range_points(host, hero).size())

	# ---- 2. one press, one receipt, one authored message -------------------
	var before := _receipts()
	var flags_before := _waystation_flags()
	await _tap_action(&"interact")
	var after := _receipts()
	var flags_after := _waystation_flags()
	_expect(after.size() == before.size() + 1,
		"one key press writes exactly one receipt (%d -> %d)" % [before.size(), after.size()])
	var fresh: Array = after.keys().filter(func(key: String) -> bool: return not before.has(key))
	_expect(fresh.size() == 1, "the new receipt is identifiable (%s)" % str(fresh))
	if fresh.size() == 1:
		_expect(String(fresh[0]).contains("pry_locker"),
			"the receipt names the action A3 authorised (%s)" % str(fresh[0]))
	_expect(_json(flags_after) != _json(flags_before), "the locker's permanent state changed exactly once")
	_expect(_hud_prompt(ow) == MSG_OPENED,
		"the player is told what happened in the authored words (%s)" % JSON.stringify(_hud_prompt(ow)))

	# ---- 3. the same press must not pay twice -----------------------------
	var before_dup := _receipts()
	var flags_dup := _waystation_flags()
	await _tap_action(&"interact")
	_expect(_receipts().size() == before_dup.size(), "a second press writes no second receipt")
	_expect(_json(_waystation_flags()) == _json(flags_dup), "a second press changes no permanent state")
	_expect(_hud_prompt(ow) == MSG_DUPLICATE,
		"the second press is refused in words the player can act on (%s)" % JSON.stringify(_hud_prompt(ow)))

	# ---- 4. the second, renewable source ----------------------------------
	var cache_stood := await _stand_at(host, cache, nav, hero)
	if not cache_stood:
		_expect(false, "the Hero can walk to %s's authored stand cell with ordinary input" % CACHE)
		return
	_expect(_in_range_points(host, hero) == [cache],
		"exactly one world action is in range at the cache (found %d)" % _in_range_points(host, hero).size())
	var before_cache := _receipts()
	await _tap_action(&"interact")
	var after_cache := _receipts()
	var gave := after_cache.size() == before_cache.size() + 1
	# This is the honest negative: the host sends an A3 instance id that A0's vendored
	# table does not carry, so the reward cannot resolve. The check fails and names
	# the edge instead of being skipped.
	_expect(gave,
		"the cache pays out under the identity the host actually sends (A3 reason: %s, prompt: %s)"
		% [JSON.stringify(_last_reason(ow)), JSON.stringify(_hud_prompt(ow))])
	if gave:
		_expect(_hud_prompt(ow) == MSG_CACHE,
			"the cache reports its authored contents (%s)" % JSON.stringify(_hud_prompt(ow)))


# ------------------------------------------------------------------ helpers
func _point(host: Node, point_name: String) -> Node2D:
	var found := host.get_node_or_null(point_name)
	return found as Node2D


func _in_range_points(host: Node, hero: Node2D) -> Array:
	var hits: Array = []
	if not host.has_method(&"matches_interaction"):
		return hits
	for child: Node in host.get_children():
		if child.has_method(&"interact") and bool(host.call(&"matches_interaction", child, hero)):
			hits.append(child)
	return hits


## Walk to a cell the host itself accepts as the interaction stand, using only
## movement input. The stand cell is never hardcoded: it is whichever neighbour of
## the point satisfies the host's own `matches_interaction` contract.
func _stand_at(host: Node, point: Node2D, nav: OverworldTraversability, hero: CharacterBody2D) -> bool:
	var point_cell := nav.cell_of(point.global_position)
	var candidates: Array[Vector2i] = []
	for dy: int in [-1, 0, 1]:
		for dx: int in [-1, 0, 1]:
			var cell := point_cell + Vector2i(dx, dy)
			if nav.is_free(cell):
				candidates.append(cell)
	candidates.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		return Vector2(a).distance_squared_to(Vector2(point_cell)) < Vector2(b).distance_squared_to(Vector2(point_cell)))
	for cell: Vector2i in candidates:
		var start := nav.cell_of(hero.global_position)
		if not nav.is_reachable(start, cell):
			continue
		var path := _route(start, cell, nav, hero)
		if path.is_empty() and start != cell:
			continue
		if not await _walk_path(hero, path):
			continue
		if bool(host.call(&"matches_interaction", point, hero)):
			return true
	return false


func _receipts() -> Dictionary:
	var snapshot: Dictionary = _save().call(&"get_snapshot")
	return (snapshot.get("applied_transactions", {}) as Dictionary).duplicate(true)


func _waystation_flags() -> Dictionary:
	var document: Dictionary = _survival().call(&"document")
	return (document.get("waystation", {}) as Dictionary).duplicate(true)


func _json(value: Variant) -> String:
	return JSON.stringify(value, "", true, true)


func _hud_prompt(ow: Node) -> String:
	var hud := ow.get(&"hud")
	if hud == null or not hud.has_method(&"prompt_text"):
		return ""
	return String(hud.call(&"prompt_text"))


## A3's own refusal reason, for the message only. Reading it never makes a check pass.
func _last_reason(ow: Node) -> Variant:
	var session := ow.get(&"economy_session")
	if session == null:
		return null
	var adapter: Variant = session.get(&"_adapter")
	if adapter == null or not (adapter is Object):
		return null
	return (adapter as Object).get(&"last_error")
