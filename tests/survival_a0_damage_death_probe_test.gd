extends "res://tests/survival_foundation_test.gd"
## A0 OWNER-COMPOSITION DAMAGE PROBE — NOT A PLAYER ENCOUNTER.
##
## The production survival world currently mounts no authentic hostile/hazard
## damage producer, so this test does NOT pretend to be combat. What it does is
## drive the REAL production damage entry point on the real Knight in the real
## overworld (`take_damage`, the same API any enemy, projectile or hazard calls),
## through the real invulnerability window, into the real death handler, and then
## checks the durable custody that the rest of the product depends on:
##   lethal damage -> exactly one bag -> run continues -> second OS process
##   restores the same bag and creates no second one.
## The missing piece is an owner-approved damage SOURCE (see
## docs/survival/handoffs/A0_ROUND11_DAMAGE_SOURCE_INTERFACE.md); this probe is
## the evidence that everything behind that seam already works.
const DEATH_SAVE := "user://tests/a0_damage_death_probe.json"
const AUDIT := "user://tests/a0_damage_death_probe_audit.json"
const CARRIED := "stone_chunk"

var _world: Node


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = DEATH_SAVE
	if not bool(_save().call(&"configure_storage", save_path, true)):
		_expect(false, "authoritative disk profile loads")
		_finish()
		return
	var verify := OS.get_cmdline_user_args().has("--verify-death-probe")
	if verify:
		await _boot()
		_verify_process()
		_finish()
		return
	await _boot_and_kill()
	_finish()


func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if OS.get_cmdline_user_args().has("--keep-death"):
		_report()
		return
	for path: String in [save_path, AUDIT]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	_report()


func _report() -> void:
	if failures.is_empty():
		print("A0 DAMAGE DEATH PROBE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 DAMAGE DEATH PROBE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _boot_and_kill() -> void:
	_world = await _boot()
	_expect(_world != null, "the production overworld boots")
	if _world == null:
		return
	var hero: CharacterBody2D = _world.get(&"player")
	_expect(hero != null, "the real Knight is mounted")
	if hero == null:
		return
	var svc := _survival()
	_expect(bool(_give(CARRIED, 3)), "the Hero carries ordinary materials before the hit")
	var carried := _count(CARRIED)
	_expect(carried == 3, "carried count is exact before death (%d)" % carried)
	_expect(int(hero.get(&"health")) > 0, "the Hero starts alive")

	# Real damage API, real invulnerability window: keep striking until lethal.
	# Each call is an authentic in-engine damage event, not a death toggle.
	var strikes := 0
	while not bool(hero.get(&"dead")) and strikes < 64:
		hero.call(&"take_damage", 250, hero.global_position + Vector2(8, 0))
		strikes += 1
		await physics_frame
	_expect(strikes > 1, "the damage path respected the real i-frames (%d strikes)" % strikes)
	_expect(bool(hero.get(&"dead")), "lethal production damage kills the real Hero")
	var document: Dictionary = svc.call(&"document")
	var bag_id := String(document.get("pending_death", ""))
	_expect(not bag_id.is_empty(), "death atomically created one pending bag")
	_expect(int((document.get("counters", {}) as Dictionary).get("deaths", 0)) == 1, "exactly one death is recorded")
	_expect((document.get("death_bags", {}) as Dictionary).size() == 1, "exactly one bag exists in the document")
	_expect(_count(CARRIED) == 0, "carried materials moved into the bag, not duplicated")
	var bag: Dictionary = (document.get("death_bags", {}) as Dictionary).get(bag_id, {})
	_expect(int(((bag.get("stacks", {}) as Dictionary).get(CARRIED, {}) as Dictionary).get("quantity", 0)) == 3,
		"the bag holds exactly the carried stack")
	var bag_nodes := 0
	for node: Node in get_tree().get_nodes_in_group(&"survival_death_bag"):
		bag_nodes += 1
	_expect(bag_nodes == 1, "exactly one physical bag is projected in the world (%d)" % bag_nodes)

	# The run survives death: dying is not a run boundary and must not reset or
	# extend the 336 h deadline (D062-D067).
	var lifecycle: Node = get_node_or_null("/root/RunLifecycle")
	if lifecycle != null:
		var run: Dictionary = lifecycle.call(&"phase")
		_expect(String(run.get("state", "")) == "active", "death does not end the run")
		var run_id := String(run.get("run_id", ""))
		# Respawn through the production service, then confirm the run identity is
		# unchanged and no second bag appears.
		var respawned := bool(svc.call(&"finish_overworld_death", hero.global_position))
		_expect(respawned, "the production respawn commit clears pending death")
		_expect(String((lifecycle.call(&"phase") as Dictionary).get("run_id", "")) == run_id,
			"respawn keeps the same durable run identity")
		var after: Dictionary = svc.call(&"document")
		_expect(int((after.get("counters", {}) as Dictionary).get("deaths", 0)) == 1, "respawn creates no second death")
		_expect((after.get("death_bags", {}) as Dictionary).size() == 1, "respawn creates no second bag")

	var audit := {
		"bag_id": bag_id,
		"deaths": int((document.get("counters", {}) as Dictionary).get("deaths", 0)),
		"bags": (document.get("death_bags", {}) as Dictionary).size(),
		"receipts": (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size(),
		"run": (lifecycle.call(&"phase") if lifecycle != null else {}),
		"carried": carried,
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "first process writes the death audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _verify_process() -> void:
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "second process reads the death audit")
	if file == null:
		return
	var baseline: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(baseline is Dictionary, "death audit is valid JSON")
	if not baseline is Dictionary:
		return
	var base: Dictionary = baseline
	var document: Dictionary = _survival().call(&"document")
	_expect(String(document.get("pending_death", "")) == "", "the relaunch does not resurrect the pending death")
	_expect((document.get("death_bags", {}) as Dictionary).size() == int(base.get("bags", -1)),
		"the relaunch restores exactly the same bags")
	_expect((document.get("death_bags", {}) as Dictionary).has(String(base.get("bag_id", ""))),
		"the original bag identity survives the relaunch")
	_expect(int((document.get("counters", {}) as Dictionary).get("deaths", -1)) == 1,
		"the relaunch does not add a death")
	_expect(_count(CARRIED) == 0, "the bag still owns the materials after relaunch (no duplication)")
	# Recovery after a genuine relaunch pays the bag exactly once.
	var bag_id := String(base.get("bag_id", ""))
	_expect(bool(_survival().call(&"recover_death_bag", bag_id)), "the relaunched process recovers the same bag")
	_expect(_count(CARRIED) == int(base.get("carried", -1)), "recovery restores the exact carried count")
	_expect(not bool(_survival().call(&"recover_death_bag", bag_id)), "a replayed recovery pays nothing")
	var lifecycle: Node = get_node_or_null("/root/RunLifecycle")
	if lifecycle != null:
		_expect(String((lifecycle.call(&"phase") as Dictionary).get("run_id", "")) == String((base.get("run", {}) as Dictionary).get("run_id", "x")),
			"the full death/recovery cycle kept one run identity")
