extends "res://tests/survival_waystation_input_restart_test.gd"
## Exercises the actual Chapter 1 production scene/controller with the explicit
## candidate setting, not the isolated connector fixture. Input is synthetic;
## this is not a normal-entry home-to-threat journey or human acceptance.

func _geometry_directory() -> String:
	return "res://data/survival/connector/a0_candidate/slices/"

func _test_label() -> String:
	return "PRODUCTION CONTROLLER, GUARDED CANDIDATE"

func _boot() -> Node:
	ProjectSettings.set_setting("survival/a0_waystation_candidate", true)
	var scene := load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_expect(false, "the actual production overworld scene loads")
		return null
	_host = Node2D.new()
	_host.name = "SurvivalTestHost"
	root.add_child(_host)
	var ow := scene.instantiate()
	_host.add_child(ow)
	ow.configure({})
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if ow.has_method(&"is_world_ready") and bool(ow.call(&"is_world_ready")):
			_expect((ow.get(&"world") as OverworldWorld).width == 448, "candidate bounds are on the real production controller")
			_expect((ow.get(&"survival_build") as SurvivalBuildSystem).annex_disabled_from_x == 384, "construction in unreviewed annex fails closed")
			return ow
		var err := String(ow.get(&"build_error"))
		if not err.is_empty():
			_expect(false, "production candidate built (%s)" % err)
			return null
	_expect(false, "production candidate build timed out")
	return null
