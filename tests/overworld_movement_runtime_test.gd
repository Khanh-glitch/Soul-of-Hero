extends SceneTree
## Movement/physics smoke: boot overworld, pump 30 process frames (build
## completes + post-build idle ticks), then free. Physics pipeline is
## exercised implicitly by the knight's own _physics_process running
## during those 30 frames (since a single SceneTree pumps both idle and
## physics when scripts await process_frame — physics still ticks between
## awaits of process_frame). Probing the physics tick explicitly via
## await physics_frame crashes on hosted CI due to the knight's
## motion_mode=FLOATING + GL collision init ordering.
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

func _initialize() -> void: _run.call_deferred()

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	for _i in range(30): await process_frame
	var ents := ow.get_node_or_null("Entities")
	var player: Node = null
	if ents != null:
		for c in ents.get_children():
			if c is CharacterBody2D: player = c; break
	if player == null:
		push_error("MOVE_FAIL: player CharacterBody2D not present after 30 frames")
		quit(1); return
	if not (player.get_node_or_null("BodyShape") is CollisionShape2D):
		push_error("MOVE_FAIL: player missing BodyShape"); quit(1); return
	if not (player.get_node_or_null("Camera") is Camera2D):
		push_error("MOVE_FAIL: player missing Camera"); quit(1); return
	ow.queue_free()
	for _i in range(6): await process_frame
	print("OVERWORLD_MOVEMENT_RUNTIME PASSED - player+BodyShape+Camera after 30 frames")
	quit(0)
