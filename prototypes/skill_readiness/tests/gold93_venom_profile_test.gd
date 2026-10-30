extends SceneTree

## Wall-clock profile of one Venomwright host adapter (diagnosis only, no verdict).
##
## usage: godot --headless --script .../gold93_venom_profile_test.gd -- --skill=NNN
## env:   GOLD93_PROFILE_TICKS (default 240) source ticks to step with profiling on.
##
## Runs the registered host adapter exactly as the host test does, with the
## VenomWorld profiler switched on. It prints the wall time per section and per
## effect kind, so a fix can be chosen from measurement. It does not gate parity,
## timing or visuals; those are the host and differential gates.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const VENOM_WORLD = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")

const CAST_SEED: int = 20261028
const TOP_ROWS: int = 40


func _initialize() -> void:
	var skill: int = 0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--skill="):
			skill = int(a.substr(8))
	var ticks: int = int(OS.get_environment("GOLD93_PROFILE_TICKS")) if not OS.get_environment("GOLD93_PROFILE_TICKS").is_empty() else 240
	var id: String = "venomwright:%03d" % skill
	var runtime = RUNTIME.new()
	if skill <= 0 or not runtime.can_cast(id):
		print("GOLD93_VENOM_PROFILE: FAIL cannot cast " + id)
		quit(1)
		return

	var caster := Node2D.new()
	caster.name = "ProfileCaster"
	root.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), CAST_SEED, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors([
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 420.0, "y": 215.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 295.0, "y": 115.0, "r": 6.0, "exists": true, "dying": 0.0},
	])
	ctx.set_ports(bundle)

	var h = runtime.cast(StringName(id), ctx, PARAMS.diagnostic("venomwright"))
	h.start()
	VENOM_WORLD.prof.clear()
	VENOM_WORLD.PROFILE_ON = true
	var t0: int = Time.get_ticks_usec()
	h.tick_source(ticks)
	var wall_ms: int = int((Time.get_ticks_usec() - t0) / 1000)
	VENOM_WORLD.PROFILE_ON = false
	print("GOLD93_VENOM_PROFILE: %s ticks=%d wall_ms=%d per_tick_ms=%.2f status=%s" % [
		id, ticks, wall_ms, float(wall_ms) / float(maxi(1, ticks)), h.status_name()])

	var rows: Array = []
	for key in VENOM_WORLD.prof.keys():
		var e: Array = VENOM_WORLD.prof[key]
		rows.append({"key": String(key), "total_us": int(e[0]), "calls": int(e[1])})
	rows.sort_custom(func(a, b): return int(a["total_us"]) > int(b["total_us"]))
	var shown: int = mini(TOP_ROWS, rows.size())
	for i in range(shown):
		var r: Dictionary = rows[i]
		var calls: int = int(r["calls"])
		print("GOLD93_VENOM_PROFILE_ROW %-36s total_ms=%10.1f calls=%8d avg_us=%9.1f" % [
			String(r["key"]), float(r["total_us"]) / 1000.0, calls,
			float(r["total_us"]) / float(maxi(1, calls))])

	h.cancel()
	h.dispose()
	print("GOLD93_VENOM_PROFILE: DONE")
	quit(0)
