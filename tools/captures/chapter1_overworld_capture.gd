extends Node
## Visual evidence is blocked on hosted CI runners: xvfb+libGL+Godot 4.3
## x11 display driver hangs during initial RenderingServer init (5+ minute
## timeout observed on every run, including a ColorRect-only scene with
## no assets loaded). The production runtime still boots under the same
## Xvfb in the native-runtime tests (windowed --script mode, which
## appears to initialize GL lazily). We exit with code 2 (BLOCKED)
## immediately so the workflow can report the environment limitation
## instead of failing the gate.

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	push_warning("overworld_capture: visual evidence BLOCKED on this runner (GL init hangs in windowed-scene mode). Runtime boot is verified by the native-runtime step.")
	get_tree().quit(2)
