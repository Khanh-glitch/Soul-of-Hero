extends SceneTree
## Shared harness for the overworld runtime tests.
##
## Every test boots the **production** `chapter1_overworld.tscn` and waits for
## the observable build contract (`world_ready` / `is_world_ready()`), then makes
## assertions about live state. There is deliberately no frame-count pump here:
## a test that only proves "forty frames elapsed" cannot fail when the world
## stops building, which is exactly how the previous version of this suite went
## green while the feature was disconnected.
##
## Subclasses implement `_body()`; the harness owns boot, isolation, reporting and
## the exit code.

## Loaded at runtime, not `preload`ed: a `--script` main loop is compiled before
## the autoload singletons exist as identifiers, and the production scene chain
## references them (the Knight talks to GameEvents). `load()` happens once the
## tree is live, which is exactly the state the game boots in.
const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const BUILD_TIMEOUT_MS := 60_000

var failures: Array[String] = []
var checks := 0
var ow: Node
var save_path := ""

var _host: Node2D
var _deadline_msec := 0
var _body_complete := false


func _initialize() -> void:
	_console.call_deferred()


func _console() -> void:
	# A parse/compile failure upstream would otherwise leave a SceneTree running
	# forever; this is the difference between a red build and a hung one.
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 3)
	save_path = "user://tests/%s_%d.json" % [_test_name(), Time.get_ticks_usec()]
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await _boot()
	if ow != null:
		await _body()
		if not _body_complete:
			# A runtime error inside `_body()` stops that function but not this
			# one, so a crash would otherwise look like a pass with fewer checks.
			_expect(false, "test body ran to completion")
	_teardown()
	_finish()


func _test_name() -> String:
	# A SceneTree main loop has no `name`; derive the label from whatever script
	# the engine was pointed at.
	for argument: String in OS.get_cmdline_args():
		if argument.begins_with("res://tests/overworld_"):
			return argument.get_file().get_basename()
	var script: Script = get_script()
	if script != null and not String(script.resource_path).is_empty():
		return String(script.resource_path).get_file().get_basename()
	return "overworld_runtime"


func _boot() -> void:
	_host = Node2D.new()
	root.add_child(_host)
	var packed := load(OW_SCENE_PATH) as PackedScene
	if packed == null:
		_expect(false, "production overworld scene loads")
		return
	ow = packed.instantiate()
	_host.add_child(ow)
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if not is_instance_valid(ow):
			break
		var stage := int(ow.get("build_stage"))
		if stage == 7: # FAILED
			_expect(false, "world build failed: %s" % String(ow.get("build_error")))
			return
		if bool(ow.call(&"is_world_ready")):
			return
	_expect(false, "world did not reach READY within %d ms (stage %d)"
		% [BUILD_TIMEOUT_MS, int(ow.get("build_stage"))])


func _body() -> void:
	pass


## Every `_body()` must end with this. It is what distinguishes "all assertions
## passed" from "the body died halfway through and nobody noticed".
func _done(description := "test body reached its end") -> void:
	_body_complete = true
	_expect(true, description)


func _process(_delta: float) -> bool:
	if _deadline_msec > 0 and Time.get_ticks_msec() > _deadline_msec:
		print("OVERWORLD TEST TIMEOUT - forcing exit")
		_expect(false, "test finished inside the watchdog window")
		_finish()
		return true
	return false


func _teardown() -> void:
	if _host != null and is_instance_valid(_host):
		_host.queue_free()
		for _i in range(4):
			await process_frame


# -- assertions ----------------------------------------------------------------
func _expect(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % description)
		return
	failures.append(description)
	print("  FAIL  %s" % description)
	push_error("OVERWORLD TEST FAIL: %s" % description)


func _expect_equal(actual: Variant, expected: Variant, description: String) -> void:
	_expect(actual == expected, "%s (expected %s, got %s)" % [description, expected, actual])


# -- helpers -------------------------------------------------------------------
func _frames(count: int) -> void:
	for _i in range(count):
		await process_frame


func _physics_frames(count: int) -> void:
	for _i in range(count):
		await physics_frame
		await process_frame


func _finish() -> void:
	var label := _test_name().trim_prefix("overworld_").to_upper()
	if failures.is_empty():
		print("OVERWORLD %s PASSED - %d checks" % [label, checks])
		quit(0)
		return
	for failure: String in failures:
		print("  - %s" % failure)
	print("OVERWORLD %s FAILED - %d/%d" % [label, failures.size(), checks])
	quit(1)
