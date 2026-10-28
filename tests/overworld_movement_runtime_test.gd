extends SceneTree
## Movement/physics smoke: boot overworld, pump 30 process frames so build
## completes, then pump 30 physics frames (verifies move_and_slide / physics
## tick pipeline runs without crashing). Displacement is a bonus; just
## surviving the physics pipeline is the fail-closed check.
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("MOVE_FAIL: " + m); print("MOVE_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	for _i in range(30): await process_frame
	for _i in range(30): await physics_frame
	var ents := ow.get_node_or_null("Entities")
	var player: Node = null
	if ents != null:
		for c in ents.get_children():
			if c is CharacterBody2D: player = c; break
	expect(player != null, "CharacterBody2D player in tree after physics pumps")
	if player != null:
		expect(player.get_node_or_null("BodyShape") is CollisionShape2D, "BodyShape present")
		expect(player.get_node_or_null("Camera") is Camera2D, "Camera present")
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_MOVEMENT_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_MOVEMENT_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)
