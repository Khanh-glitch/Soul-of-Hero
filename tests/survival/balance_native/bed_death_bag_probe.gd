extends "res://tests/survival_normal_entry_home_restart_test.gd"
## A7 B0 death probe — is there a mounted threat that can actually kill an
## ordinary player, and does bed/same-bag recovery hold across a second process?
##
## The probe refuses to fabricate the interesting part. It does not call
## `begin_overworld_death()`, does not force `_die()`, does not teleport a
## monster in and does not hand the bag back. It looks for whatever A0 has
## mounted, walks into it with ordinary movement, and then relies on the
## authoritative survival document (`pending_death`) as the death signal — a
## death that never reaches `begin_overworld_death()` never happened for the
## player either.
##
## Expected outcome on the current heads: BLOCKED, because A0's overworld mounts
## no hostile body and SurvivalService exposes no environmental damage. Death in
## the shipped game is only reachable from a fixture, which is precisely why
## bed/same-bag recovery is RUNTIME_UNKNOWN rather than verified.
##
##   godot --headless --path . --user-data-dir artifacts/ud_b0 --import
##   xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 \
##     --script res://tests/survival/balance_native/bed_death_bag_probe.gd
##
## Exit codes: 0 the Hero was killed by something in the world and the same bag
## survived a restart, 1 a recovery invariant failed, 2 blocked before the first
## death. 2 is never a pass.

const HAZARD_GROUPS: Array[StringName] = [&"overworld_hazards", &"hostiles", &"threats", &"enemies"]

var _blocked_reason := ""


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if not _blocked_reason.is_empty():
		print("B0 DEATH PROBE BLOCKED - %s" % _blocked_reason)
		print("A7 BED_DEATH BLOCKED %s: 0 checks" % _blocked_reason)
		print("B0 DEATH PROBE A5/A0 ACTION: mount one authored hazard or hostile in the production "
			+ "overworld with contact damage that calls begin_overworld_death(), then re-run unchanged")
		quit(2)
		return
	print("B0 DEATH PROBE %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	print("A7 BED_DEATH %s - death/bag journey: %d checks, %d failed" % ["PASS" if failures.is_empty() else "FAIL", checks, failures.size()])
	quit(0 if failures.is_empty() else 1)


func _after_home_continuation() -> void:
	if not failures.is_empty() or not _body_complete:
		return
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	if ow == null or hero == null:
		_blocked_reason = "no production world or Hero after normal entry"
		return

	# A bed has to exist for a death to be fair; the inherited journey builds one.
	var structures: Dictionary = (_survival().call(&"document") as Dictionary).get("structures", {})
	if structures.is_empty():
		_blocked_reason = "the inherited journey left no placed structure, so there is no bed to respawn at"
		return

	var threats := _mounted_threats(ow, hero)
	if threats.is_empty():
		_blocked_reason = ("the composed overworld mounts 0 hazard/hostile bodies (groups %s, no other "
			+ "CharacterBody2D, SurvivalService has no environmental damage): death is only reachable "
			+ "from a fixture, so bed/same-bag recovery is RUNTIME_UNKNOWN") % str(HAZARD_GROUPS)
		return

	# Walk into the nearest threat with ordinary movement and let it act.
	var target := threats[0] as Node2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var path := _route(nav.cell_of(hero.global_position), nav.cell_of(target.global_position), nav, hero)
	if path.is_empty():
		_blocked_reason = "a threat is mounted at %s but no traversable route reaches it" % str(nav.cell_of(target.global_position))
		return
	await _walk_path(hero, path)
	var deadline := Time.get_ticks_msec() + 20000
	while Time.get_ticks_msec() < deadline and _pending_death().is_empty():
		await physics_frame
	_expect(not _pending_death().is_empty(), "a mounted threat actually kills an ordinary underprepared Hero")
	if _pending_death().is_empty():
		return

	var bag_id := _pending_death()
	var after: Dictionary = _survival().call(&"document")
	var bags: Dictionary = after.get("death_bags", {})
	_expect(bags.has(bag_id), "the pending bag exists exactly once")
	_expect(int((after.get("counters", {}) as Dictionary).get("deaths", 0)) >= 1, "the death was counted once")
	_expect(bool(_survival().call(&"recover_death_bag", bag_id)), "the same bag can be recovered after respawn")
	var final_doc: Dictionary = _survival().call(&"document")
	_expect(not (final_doc.get("death_bags", {}) as Dictionary).has(bag_id), "recovering removes that bag, not a copy")
	_expect(_pending_death().is_empty(), "the recovered bag leaves no pending death behind")


func _pending_death() -> String:
	return String((_survival().call(&"document") as Dictionary).get("pending_death", ""))


## Everything the world itself publishes as dangerous for the Hero. No synthetic
## creation here: if this returns empty, the finding is the empty list.
func _mounted_threats(ow: Node, hero: Node) -> Array:
	var found: Array = []
	for group: StringName in HAZARD_GROUPS:
		for node: Node in get_tree().get_nodes_in_group(group):
			if node is Node2D and node != hero:
				found.append(node)
	for node: Node in ow.find_children("*", "CharacterBody2D", true, false):
		if node == hero:
			continue
		var script := String(node.get_script().resource_path if node.get_script() != null else "")
		if script.contains("hazard") or script.contains("enemy") or script.contains("threat") \
				or node.has_method(&"contact_damage") or node.has_method(&"apply_damage"):
			found.append(node)
	return found
