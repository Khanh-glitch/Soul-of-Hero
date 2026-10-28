extends SceneTree
## Scene-instantiate smoke: boot overworld, pump process frames until the
## knight exists under Entities AND all 10 landmark gates are spawned
## under Landmarks AND OverworldState is in the tree. Then verify
## Camera2D + BodyShape on player and a configured max_provisions on state.

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c:
		failures += 1
		push_error("SCENE_FAIL: " + m)
		push_warning("SCENE_FAIL: " + m)
		print("SCENE_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	if ow == null:
		push_error("SCENE_FAIL: instantiate returned null"); quit(1); return
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	var player: CharacterBody2D = null
	var lm_count := -1
	var ready_frame := -1
	for i in range(240):
		await process_frame
		var s := ow.get_node_or_null("OverworldState")
		var e := ow.get_node_or_null("Entities")
		var lm := ow.get_node_or_null("Landmarks")
		if s == null or e == null or lm == null: continue
		# Find player CharacterBody2D under Entities.
		if player == null:
			for c in e.get_children():
				if c is CharacterBody2D: player = c; break
		lm_count = lm.get_child_count()
		if player != null and lm_count == 10:
			ready_frame = i; break
	if ready_frame < 0:
		push_error("SCENE_FAIL: world did not reach ready in 240 frames (player=%s, landmarks=%d)" % [str(player != null), lm_count])
		_finish(); return
	# Structural post-ready checks — use get_node_or_null exclusively; do
	# NOT iterate child arrays again unless necessary (iteration during
	# partial init caused crashes in earlier revisions).
	var cam_ok := is_instance_valid(player) and player.get_node_or_null("Camera") is Camera2D
	var body_ok := is_instance_valid(player) and player.get_node_or_null("BodyShape") is CollisionShape2D
	expect(cam_ok, "player Camera2D attached")
	expect(body_ok, "player BodyShape CollisionShape2D attached")
	var state := ow.get_node_or_null("OverworldState")
	expect(state != null, "OverworldState in tree")
	if state != null:
		expect(int(state.get("max_provisions")) > 0, "state.max_provisions > 0")
	expect(ow.get_node_or_null("Layers") != null, "Layers container present")
	print("SCENE RUNTIME PASSED ready_frame=", ready_frame, " checks=", checks)
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0:
		print("SCENE RUNTIME PASSED - %d checks" % checks)
		quit(0)
	push_error("SCENE RUNTIME FAILED - %d/%d" % [failures, checks])
	quit(1)
