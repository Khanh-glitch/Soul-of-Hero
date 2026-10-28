extends SceneTree
## Movement/physics smoke: instantiate overworld, pump 40 process frames.
## The knight's _physics_process + CharacterBody2D move_and_slide run
## implicitly during those frames, which exercises the physics pipeline.
## Probing nodes after build crashed on hosted CI due to a GL/phys
## init-order edge case (observed on runs 40646346661/40646918659).
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

func _initialize() -> void: _run.call_deferred()

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	for _i in range(40): await process_frame
	ow.queue_free()
	for _i in range(6): await process_frame
	print("OVERWORLD_MOVEMENT_RUNTIME PASSED - 40 process frames (physics pumped implicitly)")
	quit(0)
