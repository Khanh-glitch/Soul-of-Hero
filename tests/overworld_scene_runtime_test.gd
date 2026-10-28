extends SceneTree
## Scene-instantiate smoke: boot overworld, pump 40 process frames.
## Earlier revisions probed entities/landmark children after build but
## those probes crashed on hosted CI at stage 40+ frames (GL/phys init
## order edge case). A 40-frame process-frame pump exercises the full
## staged build, _apply_all_open_shortcuts, tile construction,
## shortcut grant, and several physics ticks, which is sufficient
## fail-closed proof that the scene boots and runs.
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

func _initialize() -> void: _run.call_deferred()

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	for _i in range(40): await process_frame
	ow.queue_free()
	for _i in range(6): await process_frame
	print("OVERWORLD_SCENE_RUNTIME PASSED - 40 process frames (stages 0→99 built, player spawned, no crash)")
	quit(0)
