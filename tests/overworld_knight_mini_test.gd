extends SceneTree
## Minimal sanity check: knight.tscn instantiates in isolation.

var failures: Array[String] = []
var checks := 0

const KNIGHT_PATH := "res://game/characters/knight/knight.tscn"


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	# Runtime load: see overworld_runtime_case.gd for why preload is unsafe here.
	var knight_scene := load(KNIGHT_PATH) as PackedScene
	_expect(knight_scene != null, "knight PackedScene loads")
	if knight_scene == null:
		_finish()
		return
	var k := knight_scene.instantiate()
	_expect(k != null, "knight instantiates")
	if k != null:
		var host := Node2D.new()
		root.add_child(host)
		host.add_child(k)
		for _i in range(60):
			await process_frame
		_expect(k.get_node_or_null("Camera") is Camera2D, "Knight has Camera2D")
		_expect(k.get_node_or_null("Sprite") != null, "Knight has Sprite")
		k.queue_free()
		for _i in range(6):
			await process_frame
	_finish()


func _expect(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append(msg); push_error("KNIGHT_MINI_FAIL: " + msg)


func _finish() -> void:
	if failures.is_empty():
		print("KNIGHT_MINI PASSED - %d checks" % checks)
		quit(0)
	else:
		push_error("KNIGHT_MINI FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
