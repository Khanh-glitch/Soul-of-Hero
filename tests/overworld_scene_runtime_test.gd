extends SceneTree
## Scene-instantiate smoke: preload + instantiate overworld, add to host,
## wait for deferred _build_world to reach completion, then verify:
##   - OverworldState exists and is configured (max_provisions > 0)
##   - Knight CharacterBody2D exists under Entities with Camera2D + BodyShape
##   - All 10 landmark gates exist under Landmarks
##   - Layers container exists

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("SCENE_FAIL: " + m); print("SCENE_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	expect(ow != null, "overworld instantiated from PackedScene")
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	var player: CharacterBody2D = null
	var ready_frame := -1
	for i in range(240):
		await process_frame
		var state := ow.get_node_or_null("OverworldState")
		var ents := ow.get_node_or_null("Entities")
		var landmarks := ow.get_node_or_null("Landmarks")
		if state == null or ents == null or landmarks == null:
			continue
		for c in ents.get_children():
			if c is CharacterBody2D: player = c; break
		if player != null and landmarks.get_child_count() == 10:
			ready_frame = i; break
	expect(ready_frame >= 0, "world builds within 240 frames")
	if player == null: _finish(); return
	expect(player.get_node_or_null("Camera") is Camera2D, "player has Camera2D")
	expect(player.get_node_or_null("BodyShape") is CollisionShape2D, "player has BodyShape CollisionShape2D")
	var state := ow.get_node_or_null("OverworldState")
	expect(state != null, "OverworldState exists")
	if state != null:
		expect(int(state.get("max_provisions")) > 0, "state.max_provisions > 0 (configured)")
	var landmarks := ow.get_node_or_null("Landmarks")
	expect(landmarks != null and landmarks.get_child_count() == 10,
		"10 landmark gates spawned (got %d)" % landmarks.get_child_count() if landmarks != null else "Landmarks node missing")
	var layers := ow.get_node_or_null("Layers")
	expect(layers != null, "Layers container exists")
	print("SCENE RUNTIME PASSED - ready_frame=%d checks=%d" % [ready_frame, checks])
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("SCENE RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("SCENE RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)
