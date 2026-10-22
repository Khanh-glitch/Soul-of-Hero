class_name WizardControlLock
extends Node

## Small, target-local hard-CC adapter. Enemy archetypes do not share a common
## stun API yet; pausing their own processing gives Wizard one consistent 0.35 /
## 0.65 second control contract without modifying every enemy scene.

var _remaining := 0.0
var _target: Node
var _was_processing := true
var _was_physics_processing := true


func refresh(target: Node, duration_seconds: float) -> void:
	_target = target
	_remaining = maxf(_remaining, maxf(0.0, duration_seconds))
	if _target == null:
		return
	_was_processing = _target.is_processing()
	_was_physics_processing = _target.is_physics_processing()
	_target.set_process(false)
	_target.set_physics_process(false)


func _process(delta: float) -> void:
	_remaining = maxf(0.0, _remaining - maxf(0.0, delta))
	if _remaining > 0.0:
		return
	if is_instance_valid(_target) and not _target.is_queued_for_deletion():
		_target.set_process(_was_processing)
		_target.set_physics_process(_was_physics_processing)
	queue_free()
