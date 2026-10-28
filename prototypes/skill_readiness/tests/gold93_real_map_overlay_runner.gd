extends SceneTree

## SceneTree entry point for the disposable real-map overlay gate.
## The gate itself needs frame processing, so it lives in a Node script and this
## runner only boots it and forwards the exit code to the CI process.

const OVERLAY = preload("res://prototypes/skill_readiness/tests/gold93_real_map_overlay_test.gd")

var _done: bool = false


func _initialize() -> void:
	var gate = OVERLAY.new()
	gate.finished.connect(_on_finished)
	root.add_child(gate)


func _on_finished(exit_code: int) -> void:
	if _done:
		return
	_done = true
	quit(exit_code)
