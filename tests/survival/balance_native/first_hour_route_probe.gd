extends "res://tests/survival_normal_entry_home_restart_test.gd"
## A7 B0 route probe — the first-hour journey segment that has never been played.
##
## The inherited chain already proves: real menu -> real Home map -> real paid
## shelter, all by ordinary pointer and key input. This probe continues from
## there and asks the only question that matters for the first hour: can a player
## walk to A1's Waystation and get the thing A1 promises, through A0's host and
## A3's authority, and keep it across a genuine second process?
##
## Rules this file holds itself to:
##   * no node is injected, no position assigned, no item granted, no clock moved;
##   * no coordinate is invented — points and their stand cells come from A0's own
##     host (`matches_interaction()` decides, not this test);
##   * the press is the same screen-centre click the inherited gather test uses,
##     so whatever A0's nearest-interactable rule picks is what the player would hit;
##   * a missing mount is reported as BLOCKED (exit 2), never as a pass.
##
## Run (Godot 4.7, from the repo root):
##   godot --headless --path . --user-data-dir artifacts/ud_b0 --import
##   xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
##     --script res://tests/survival/balance_native/first_hour_route_probe.gd
##   xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
##     --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --verify-separate-process
##
## Exit codes: 0 all checks passed, 1 a real check failed, 2 blocked before the
## first player action (the branch is not mounted). 2 is never a pass.
##
## `--force-branch` additionally sets the shipped ProjectSettings guard
## (survival/a0_waystation_candidate) in memory for this run only. That separates
## "A0 has not mounted it" from "A0 mounted it and it is broken". Evidence from a
## forced run is classed SOURCE_PRESENT_BEHIND_GUARD, never acceptance.

const GUARD := "survival/a0_waystation_candidate"
const POI := "poi_crown_waystation"
const CAPABILITY := "cap_salvage"

var _blocked_at := ""
var _blocked_reason := ""
var _forced := false


func _console() -> void:
	_forced = OS.get_cmdline_user_args().has("--force-branch")
	if _forced:
		print("B0 ROUTE PROBE: --force-branch sets %s in memory; evidence class is SOURCE_PRESENT_BEHIND_GUARD, not acceptance" % GUARD)
		ProjectSettings.set_setting(GUARD, true)
	await super._console()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if not _blocked_at.is_empty():
		print("B0 ROUTE PROBE BLOCKED at %s - %s" % [_blocked_at, _blocked_reason])
		print("B0 ROUTE PROBE A0 ACTION: %s" % _next_a0_action())
		quit(2)
		return
	var verdict := "PASSED" if failures.is_empty() else "FAILED"
	var evidence := "FORCED_FLAG_SOURCE_ONLY" if _forced else "SHIPPED_PROJECT"
	print("B0 ROUTE PROBE %s - %d checks - evidence=%s" % [verdict, checks, evidence])
	quit(0 if failures.is_empty() else 1)


func _next_a0_action() -> String:
	if _forced:
		return ("the branch is present but broken when enabled: fix the reported edge in "
			+ "game/survival/waystation_host.gd or the A3 binding, no flag change needed")
	return ("mount the A1 Waystation from the composed world and enable "
		+ "survival/a0_waystation_candidate in project.godot, then re-run this file unchanged")


# ---------------------------------------------------------------- the journey
func _after_home_continuation() -> void:
	if not failures.is_empty() or not _body_complete:
		return
	var ow := _host.get_child(0)
	if ow == null:
		_blocked_at = "L1_ENTRY"
		_blocked_reason = "no overworld on the route host after the paid-home journey"
		return
	var host := ow.get_node_or_null("WaystationRuntime")
	if host == null:
		_blocked_at = "L2_MOUNT"
		_blocked_reason = "A0 does not mount WaystationRuntime on this path (guard %s=%s)" % [
			GUARD, str(bool(ProjectSettings.get_setting(GUARD, false)))]
		return
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	if hero == null or nav == null:
		_blocked_at = "L1_ENTRY"
		_blocked_reason = "the composed world has no Hero or traversability"
		return

	# ---- L3: the physical route to A0's own authored stand cell ----
	var locker := host.get_node_or_null("Locker")
	if locker == null:
		_blocked_at = "L3_POINT"
		_blocked_reason = "WaystationRuntime mounted but has no Locker point"
		return
	var stand := await _reach_point(ow, host, hero, nav, locker, "Locker")
	if stand == Vector2i(-1, -1):
		return
	_expect(host.call(&"matches_interaction", locker, hero),
		"A0's host accepts the Hero standing on its own authored stand cell for the locker")

	# ---- L4: the press a player actually makes ----
	var prompt := await _press_centre(ow)
	_expect(prompt == "Salvage access unlocked. The locker held no items.",
		"the player is told what the locker did (got %s)" % JSON.stringify(prompt))
	var world_after := _world()
	var pois: Dictionary = world_after.get("pois", {})
	var poi: Dictionary = pois.get(POI, {})
	var receipts: Dictionary = poi.get("reward_receipts", {})
	_expect(receipts.size() == 1, "the locker wrote exactly one A3 receipt (got %d)" % receipts.size())
	_expect((world_after.get("capabilities", []) as Array).has(CAPABILITY),
		"the locker granted A1's %s into the A3 world document" % CAPABILITY)
	if receipts.size() != 1:
		_blocked_at = "L4_INTERACTION"
		_blocked_reason = ("the press reached the locker but A3 committed nothing; %s"
			% _diagnose(ow, {"poi_id": POI, "action_id": "pry_locker"}))
		return

	# ---- L4b: the one-time action must be idempotent for the player ----
	var keys_before := receipts.keys()
	prompt = await _press_centre(ow)
	_expect(prompt == "Already opened.", "a second press says the locker is already open (got %s)" % JSON.stringify(prompt))
	var receipts_after: Dictionary = (_world().get("pois", {}).get(POI, {}) as Dictionary).get("reward_receipts", {})
	_expect(receipts_after.size() == keys_before.size(), "a second press writes no second receipt")

	# ---- L4c: the renewable cache, under the identity the host really sends ----
	# This is the one that costs a player real loot when it fails, so it is a hard
	# check, not a blocked state: the branch is mounted and the locker worked.
	var cache := host.get_node_or_null("Cache")
	if cache == null:
		_expect(false, "the mounted host exposes the cache point A1's renewable reward needs")
		return
	var cache_stand := await _reach_point(ow, host, hero, nav, cache, "Cache")
	if cache_stand == Vector2i(-1, -1):
		return
	var cache_before: int = (_world().get("pois", {}).get(POI, {}) as Dictionary).get("reward_receipts", {}).size()
	prompt = await _press_centre(ow)
	var cache_result := _world().get("pois", {}).get(POI, {})
	var cache_receipts: Dictionary = (cache_result as Dictionary).get("reward_receipts", {})
	var cache_paid := cache_receipts.size() == cache_before + 1
	_expect(cache_paid, "the cache pays out iron scrap through the identity A0's host sends (%s) - got prompt %s"
		% [str(host.call(&"request_for", cache).get("instance_id", "")), JSON.stringify(prompt)])
	if not cache_paid:
		print("B0 CACHE DIAGNOSTIC: %s" % _diagnose(ow, host.call(&"request_for", cache)))
		print("B0 CACHE DIAGNOSTIC: world_slice capabilities=%s receipts=%s"
			% [str((_world().get("capabilities", []) as Array)), str(cache_receipts.keys())])
		return
	_expect(_count("iron_scrap") > 0, "the cache reward is in the player's bag, not only in the document")

	# ---- L5: durability is inherited; make sure it covers world_slice ----
	print("B0 ROUTE PROBE: %d world receipt(s) now live in world_slice; the inherited second process compares world_slice exactly"
		% cache_receipts.size())


# ---------------------------------------------------------------- helpers
## Walk to a cell A0's host will accept for `point`, using ordinary movement only.
## Returns the accepted cell, or (-1,-1) after reporting why no cell worked.
func _reach_point(ow: Node, host: Node, hero: CharacterBody2D, nav: OverworldTraversability,
		point: Node2D, label: String) -> Vector2i:
	var cell := nav.cell_of(point.global_position)
	var start := nav.cell_of(hero.global_position)
	var candidates: Array[Vector2i] = []
	for dy: int in [-1, 0, 1]:
		for dx: int in [-1, 0, 1]:
			if dx == 0 and dy == 0:
				continue
			var probe := cell + Vector2i(dx, dy)
			if nav.in_bounds(probe) and nav.is_free(probe):
				candidates.append(probe)
	if candidates.is_empty():
		_blocked_at = "L3_POINT"
		_blocked_reason = "%s at %s has no free neighbour cell to stand on" % [label, str(cell)]
		return Vector2i(-1, -1)
	candidates.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		return a.distance_squared_to(start) < b.distance_squared_to(start))
	for probe: Vector2i in candidates:
		var path := _route(start, probe, nav, hero)
		if path.is_empty():
			continue
		var walked: bool = await _walk_path(hero, path)
		if not walked:
			continue
		if nav.cell_of(hero.global_position) == probe and bool(host.call(&"matches_interaction", point, hero)):
			start = nav.cell_of(hero.global_position)
			return probe
	# Nothing the host accepts: say exactly which cells were tried.
	_blocked_at = "L3_STAND"
	_blocked_reason = ("A0's host refuses every free neighbour of %s at %s (tried %s); "
		+ "the point is not reachable by a walking player") % [label, str(cell), str(candidates)]
	return Vector2i(-1, -1)


## The honest press: one left click at the screen centre, where the Hero is.
## Returns the HUD line the player was shown.
func _press_centre(ow: Node) -> String:
	var camera := ow.get(&"camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		camera.force_update_scroll()
	await process_frame
	var intruders := _closer_interactables(ow)
	if not intruders.is_empty():
		push_warning("B0 ROUTE PROBE: nearer interactables own this press: %s" % str(intruders))
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	await create_timer(0.4).timeout
	var hud := ow.get(&"hud")
	if hud != null and hud.has_method(&"prompt_text"):
		return String(hud.call(&"prompt_text"))
	return ""


## A1 point must not be beaten to the press by a nearer interactable: Knight
## hands the click to the nearest node that returns true, and an in-reach refusal
## consumes the press.
func _closer_interactables(ow: Node) -> Array:
	var out: Array = []
	var hero := ow.get(&"player") as Node2D
	if hero == null:
		return out
	var best := INF
	for node: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if node is Node2D:
			best = minf(best, hero.global_position.distance_squared_to((node as Node2D).global_position))
	for node: Node in get_tree().get_nodes_in_group(&"player_interactable"):
		if not node is Node2D:
			continue
		var d := hero.global_position.distance_squared_to((node as Node2D).global_position)
		if d <= best and d < 24.0 * 24.0 and String(node.name) != "Locker" and String(node.name) != "Cache":
			out.append("%s@%.1fpx" % [node.name, sqrt(d)])
	return out


func _world() -> Dictionary:
	return (_save().call(&"get_snapshot") as Dictionary).get("world_slice", {})


## Diagnostic only, and strictly read-only: A3's planner answers "which binding
## would this request resolve to" without transacting. It is printed as
## DIAGNOSTIC and never scored as a pass; a successful transaction here would be
## exactly the self-injection this file forbids.
func _diagnose(ow: Node, request: Dictionary) -> String:
	var session := ow.get(&"economy_session")
	if session == null:
		return "economy_session is not built on this world"
	if not session.has_method(&"_world_plan"):
		return "A3 exposes no read-only planner; no diagnostic available"
	var plan: Variant = session.call(&"_world_plan", _world(), request)
	return "A3 plan(%s) -> %s" % [JSON.stringify(request), JSON.stringify(plan)]
