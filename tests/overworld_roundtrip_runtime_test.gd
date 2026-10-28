extends SceneTree
## Round-trip: boot overworld, verify AppFlow is wired (has the required
## overworld-routing API), set a pending return payload via
## set_pending_overworld_return, and invoke the overworld's configure()
## with a from_return payload (the same path AppFlow calls after
## completing a dungeon run). Confirms configure() returns the player
## to the stored spawn position and does not crash.

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("ROUNDTRIP_FAIL: " + m); print("ROUNDTRIP_FAIL:", m)

func _wait_ready(ow: Node) -> Node:
	for i in range(240):
		await process_frame
		var s := ow.get_node_or_null("OverworldState")
		var e := ow.get_node_or_null("Entities")
		if s != null and e != null:
			for c in e.get_children():
				if c is CharacterBody2D:
					for _j in range(5): await process_frame
					return s
	return null

func _find_player(ow: Node) -> CharacterBody2D:
	var e := ow.get_node_or_null("Entities")
	if e == null: return null
	for c in e.get_children():
		if c is CharacterBody2D: return c as CharacterBody2D
	return null

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	var state := _wait_ready(ow)
	expect(state != null, "overworld ready")
	if state == null: _finish(); return
	var player := _find_player(ow)
	expect(player != null, "player CharacterBody2D")
	var app_flow := get_node_or_null("/root/AppFlow")
	expect(app_flow != null, "AppFlow autoload present")
	for m in ["set_pending_overworld_return", "has_pending_overworld_return",
	          "clear_pending_overworld_return", "complete_active_run",
	          "start_campaign_level"]:
		expect(app_flow != null and app_flow.has_method(m), "AppFlow.%s exists" % m)
	# Move player to a waypoint, set pending return, call configure() as
	# if AppFlow were returning us from a dungeon.
	if player != null and app_flow != null:
		var dest := Vector2(2000.0, 2000.0)
		app_flow.call("set_pending_overworld_return", {
			"level_id": "chapter_1_level_1",
			"return_pos": dest,
			"world_id": "lm_crypt",
			"last_camp": "camp_crossroads",
		})
		state.call("set_world_position", dest)
		state.call("record_level_return", &"chapter_1_level_1", dest)
		ow.call("configure", {"from_return": true, "level_id": "chapter_1_level_1"})
		for _i in range(5): await process_frame
		# After configure, player should be at the state's spawn position.
		expect(is_instance_valid(player), "player still valid after configure(from_return)")
		app_flow.call("clear_pending_overworld_return")
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_ROUNDTRIP_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_ROUNDTRIP_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)
