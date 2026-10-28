extends SceneTree
## Regression guard: verifies that production scripts parse cleanly by
## preloading the overworld PackedScene. A parse error (like the Python-style
## list comprehension on chapter1_overworld.gd:193 we just fixed) causes Godot
## to error at SCRIPT LOAD TIME, before this file even executes — so if this
## script runs at all, preload succeeded.
##
## NOTE: Full scene instantiation/paint + TileMapLayer + Knight spawn is
## exercised by overworld_scene_runtime_test.gd. That test runs the same
## scene under a real GL context (xvfb) and is where physics/rendering
## assertions live. Keeping the regression guard narrow avoids coupling it to
## TileMap texture resources that require a GPU.

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: Array[String] = []
var checks := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_expect(OW_SCENE != null, "overworld PackedScene preloads (parse check)")

	# Positive-control: production source scan for pythonic comprehension lines.
	# (The CI static-contracts job additionally runs the intentionally_broken
	# fixture through Godot and asserts nonzero exit; we rely on that step for
	# the "broken must fail" guarantee, rather than spawning a subprocess here.)

	# Static source scan: no Pythonic comprehensions in production source.
	var f := FileAccess.open("res://game/overworld/chapter1_overworld.gd", FileAccess.READ)
	if f != null:
		var src := f.get_as_text(); f.close()
		var bad := false
		for line in src.split("\n"):
			var s: String = line.strip_edges()
			if s.begins_with("#"):
				continue
			if s.begins_with("var ") and " for " in s and " in " in s and s.find("[") >= 0 and s.find("[") < s.find(" for "):
				bad = true
				push_error("OW_REGRESSION: suspicious comprehension line: " + s)
		_expect(not bad, "no Python-style comprehension lines in production source")

	call_deferred("_do_quit")


func _do_quit() -> void:
	if failures.is_empty():
		print("OVERWORLD_REGRESSION_GUARD PASSED - %d checks" % checks)
		quit(0)
	else:
		push_error("OVERWORLD_REGRESSION_GUARD FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _expect(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append(msg); push_error("OW_REGRESSION_FAIL: " + msg)
