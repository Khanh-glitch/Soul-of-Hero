extends Node
## DISPOSABLE REGRESSION FIXTURE — this file is intentionally broken.
##
## It contains the exact class of parse error that previously bit production
## (Python-style list comprehension written into GDScript, e.g. `[x for x in y]`).
## The regression-guard step in CI runs this file through the Godot parser and
## MUST OBSERVE A NONZERO EXIT; if the parser accepted it, the regression guard
## would fail and CI would be red — proving that real parse errors in
## production would also be caught by the preload/instantiate test.
##
## DO NOT FIX THIS FILE. Its brokenness is the test.

func _ready() -> void:
	# The line below is the Python-style comprehension bug. Valid GDScript uses
	# a for-loop with append, not `[expr for x in arr]`.
	var bogus := [x * 2 for x in [1, 2, 3]]
	print(bogus)
	get_tree().quit(0)
