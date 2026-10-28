extends SceneTree
## Movement + physics: boot overworld, wait for player CharacterBody2D, then
## hold move_right and verify knight's global_position.x advances
## (real displacement, not just "physics doesn't crash"). Player is placed
## on walkable ground near refuge; authored move_speed is ~150 px/s so over
## 60 physics frames (~1s) we expect ~100+ px displacement.

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("MOVE_FAIL: " + m); print("MOVE_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	# Wait until player exists AND a few physics frames have elapsed so the
	# knight has finished _ready (SpriteFrames loaded, wizard_runtime configured).
	var player: CharacterBody2D = null
	for i in range(240):
		await process_frame
		var ents := ow.get_node_or_null("Entities")
		if ents != null:
			for c in ents.get_children():
				if c is CharacterBody2D: player = c; break
		if player != null:
			# Pump a few more frames to let ready complete.
			for _j in range(10): await process_frame
			for _j in range(5): await physics_frame
			break
	expect(player != null, "player CharacterBody2D present")
	if player == null: _finish(); return
	expect(player.get_node_or_null("BodyShape") is CollisionShape2D, "player collision shape attached")
	var start := player.global_position
	Input.action_press("move_right")
	var dx := 0.0
	for i in range(90):
		await physics_frame
		dx = player.global_position.x - start.x
		if dx > 20.0: break
	Input.action_release("move_right")
	expect(dx > 20.0, "knight moves right under input (dx=%.1f px over %d physics frames)" % [dx, 90])
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_MOVEMENT_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_MOVEMENT_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)
