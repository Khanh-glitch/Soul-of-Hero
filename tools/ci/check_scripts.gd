extends SceneTree
## Compile every script the gate names, in a real project context.
##
## Why not `--check-only --script`: that mode compiles a file without the autoload
## singletons being registered as globals, so a file that preloads any script using
## `GameEvents` (every A1/A6 file that touches the Knight) reports
## "Identifier not found: GameEvents" while the same file runs perfectly in the game.
## A gate that fails on a working file teaches nothing. Loading the resource here
## happens after ProjectSettings and the autoload list exist, which is the same
## context the engine gives a scene at runtime - and it is still the engine's own
## parser and compiler, not a linter.
##
## Usage: godot --headless --script res://tools/ci/check_scripts.gd -- res://a.gd res://b.gd
## Exit code 0 only if every named script parses, compiles and yields a Script.

func _initialize() -> void:
	var paths: PackedStringArray = OS.get_cmdline_user_args()
	if paths.is_empty():
		push_error("check_scripts: no scripts named")
		quit(2)
		return
	var failures := 0
	for path: String in paths:
		var loaded: Resource = null
		if ResourceLoader.exists(path):
			loaded = ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE)
		if loaded == null or not (loaded is Script):
			print("PARSE_FAIL ", path)
			failures += 1
			continue
		var script := loaded as Script
		# A script whose dependency failed to compile also loses its base class; asking
		# for the path proves the resource is the file we named and that it compiled.
		if script.resource_path != path:
			print("PARSE_FAIL ", path, " resolved=", script.resource_path)
			failures += 1
			continue
		print("PARSE_OK ", path)
	print("PARSE_GATE scripts=%d failures=%d" % [paths.size(), failures])
	quit(0 if failures == 0 else 1)
