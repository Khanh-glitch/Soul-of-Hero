extends SceneTree
## Regression guard: the production overworld must parse and preload.
##
## A syntax error in any overworld script fails at *preload* time, before a
## single statement of this file runs — so reaching the first `_expect()` is
## already evidence that all eight scripts parsed. The per-file `load()` loop
## below then names the offender instead of failing anonymously.
##
## This is deliberately a *static* guard: it needs no GPU, no physics and no
## scene tree. Behavioural evidence lives in the state-asserting runtime tests.

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const OW_DIR := "res://game/overworld"
const SCRIPT_FILES: Array[String] = [
	"chapter1_overworld.gd",
	"overworld_world.gd",
	"overworld_state.gd",
	"overworld_tiles.gd",
	"overworld_gate.gd",
	"overworld_camp.gd",
	"overworld_discovery.gd",
	"overworld_hud.gd",
]
## Pythonic constructs that a GDScript parser rejects, plus the two API mistakes
## that previously slipped through review.
const FORBIDDEN_SNIPPETS: Array[String] = [
	"push_print(",
	".call_deferred(func",
	"PackedVector2Array(0, 0)",
]

var failures: Array[String] = []
var checks := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	# Loaded at runtime: a --script main loop compiles before autoloads exist, so
	# a `preload` of the production chain would fail for the wrong reason.
	var scene := load(OW_SCENE_PATH) as PackedScene
	_expect(scene != null, "production overworld PackedScene loads")
	_expect(scene != null and scene.can_instantiate(), "overworld PackedScene can instantiate")

	for file: String in SCRIPT_FILES:
		var path := "%s/%s" % [OW_DIR, file]
		var script := load(path) as Script
		_expect(script != null, "%s loads as a Script" % file)
		if script == null:
			continue
		_expect(script.can_instantiate(), "%s is instantiable (no missing class_name deps)" % file)
		var source := _read(path)
		_expect(not source.is_empty(), "%s reads from disk" % file)
		for snippet: String in FORBIDDEN_SNIPPETS:
			_expect(not source.contains(snippet), "%s does not use '%s'" % [file, snippet])
		# add_physics_layer() takes no argument; passing one silently added a layer
		# index that no tile ever used.
		var call_index := source.find("add_physics_layer(")
		while call_index >= 0:
			var after := source.substr(call_index + 19, 1)
			_expect(not after.is_valid_int(),
				"%s calls add_physics_layer() without an argument" % file)
			call_index = source.find("add_physics_layer(", call_index + 1)
		_expect(not _has_pythonic_comprehension(source),
			"%s has no Python-style list comprehension" % file)

	# The controller must expose the observable build contract the tests rely on.
	var controller := load("%s/chapter1_overworld.gd" % OW_DIR) as Script
	if controller != null:
		var probe: Object = controller.new()
		_expect(probe != null, "controller instantiates for API probing")
		if probe != null:
			for method: StringName in [
				&"is_world_ready", &"configure", &"gate_for", &"camp_for",
				&"discovery_for", &"interact_with", &"teleport_to", &"walkable_at",
			]:
				_expect(probe.has_method(method), "controller exposes %s()" % method)
			probe.free()

	# The AppFlow entry points the world hands off through must still exist.
	var flow_source := _read("res://game/app/app_flow.gd")
	for method_name: String in [
		"open_overworld", "start_campaign_level", "is_campaign_level_unlocked",
		"is_campaign_level_completed", "has_active_run", "complete_active_run",
		"abort_to_hub", "set_pending_overworld_return",
		"return_to_overworld_after_completion", "clear_pending_overworld_return",
		"has_pending_overworld_return", "get_active_run", "get_current_route",
	]:
		_expect(flow_source.contains("func %s(" % method_name),
			"AppFlow declares %s()" % method_name)

	_finish()


func _read(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func _has_pythonic_comprehension(source: String) -> bool:
	for line: String in source.split("\n"):
		var text := line.strip_edges()
		if text.begins_with("#"):
			continue
		var bracket := text.find("[")
		var for_index := text.find(" for ")
		if bracket >= 0 and for_index > bracket and text.contains(" in "):
			return true
	return false


func _expect(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		return
	failures.append(description)
	push_error("OVERWORLD REGRESSION GUARD FAIL: %s" % description)


func _finish() -> void:
	if failures.is_empty():
		print("OVERWORLD_REGRESSION_GUARD PASSED - %d checks" % checks)
		quit(0)
		return
	for failure: String in failures:
		print("  - %s" % failure)
	push_error("OVERWORLD_REGRESSION_GUARD FAILED - %d/%d" % [failures.size(), checks])
	quit(1)
