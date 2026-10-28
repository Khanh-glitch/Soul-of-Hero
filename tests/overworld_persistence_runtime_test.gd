extends SceneTree
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")
func _initialize() -> void: _run.call_deferred()
func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	for _i in range(30): await process_frame
	ow.queue_free()
	for _j in range(6): await process_frame
	print("OVERWORLD_PERSISTENCE_RUNTIME PASSED")
	quit(0)
