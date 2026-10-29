extends SceneTree

## Per-skill HOST ADAPTER lifecycle test for one Venomwright skill.
##
## usage: godot --headless --script .../gold93_host_adapter_skill_test.gd -- --skill=NNN
##
## Drives ONE registered host adapter through the public surfaces only:
##   * Gold93SkillRuntime.module_for / cast / handle lifecycle, and
##   * the isolated SkillReadinessLab (selector, cast, step, cancel, run, release).
##
## It proves, for that skill:
##   1. the canonical id, original skill id and generator are the expected ones;
##   2. cast -> start -> step -> cancel stops every generator task of the cast,
##      and no intent is emitted after cancellation;
##   3. a full cast reaches FINISHED and its authored intents stay typed and
##      combat stays unconfigured (nothing is applied);
##   4. replay with the same seed produces a byte-identical trace digest;
##   5. the Lab selects the same id, steps it, cancels it, runs it to the end
##      and releases it.
##
## This is HOST CASTABILITY evidence. It is not source parity (that is the
## differential against the original TypeScript) and not visual approval.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const LAB_SCENE = preload("res://prototypes/skill_readiness/lab/skill_readiness_lab.tscn")

const CAST_SEED: int = 20261028
const MAX_TICKS: int = 4096

var _failures: Array[String] = []
var _skill: int = 0
var _id: String = ""


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_HOST_ADAPTER: " + message)


## Stderr is unbuffered, so the last phase reached survives a `timeout` kill.
func _phase(name: String) -> void:
	printerr("GOLD93_HOST_ADAPTER PHASE %s %s t=%d ms" % [_id, name, Time.get_ticks_msec()])


func _make_context(source_seed: int) -> Gold93CastContext:
	var caster := Node2D.new()
	caster.name = "HostAdapterCaster"
	root.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), source_seed, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors([
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 420.0, "y": 215.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 295.0, "y": 115.0, "r": 6.0, "exists": true, "dying": 0.0},
	])
	ctx.set_ports(bundle)
	return ctx


func _emitted(handle) -> int:
	return int(handle.result().get("intents", {}).get("emitted", 0))


func _parse_skill() -> int:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--skill="):
			return int(a.substr(8))
	return 0


func _initialize() -> void:
	await _run()


func _run() -> void:
	_skill = _parse_skill()
	_id = "venomwright:%03d" % _skill
	if _skill <= 0:
		_check(false, "missing --skill=NNN")
		_finish()
		return

	var runtime = RUNTIME.new()
	_check(RUNTIME.MODULE_PATHS.has(_id), "%s is not a registered host adapter" % _id)
	_check(runtime.can_cast(_id), "%s must be host-castable" % _id)

	# --- 1. registry identity ----------------------------------------------
	_phase("identity")
	var probe_mod = runtime.module_for(_id)
	_check(probe_mod != null, "module_for must return the adapter for " + _id)
	if probe_mod != null:
		_check(String(probe_mod.canonical_id) == _id,
				"canonical id must be %s, got %s" % [_id, String(probe_mod.canonical_id)])
		_check(int(probe_mod.original_skill_id) == _skill,
				"original skill id must be %d" % _skill)
		_check(probe_mod.has_source_locked_generator(), "adapter must front a source-native generator")
		_check(not probe_mod.original_name().is_empty(), "original name must be recorded")

	# --- 2. cancel stops every generator task and emits nothing afterwards ----
	_phase("cancel")
	var hb = runtime.cast(StringName(_id), _make_context(CAST_SEED), PARAMS.diagnostic("venomwright"))
	_check(not hb.is_blocked(), "cast must not be blocked: " + hb.block_reason)
	var mb = hb.module
	_check(hb.start(), "start() must succeed from READY")
	hb.tick_source(45)
	_check(hb.status == Gold93SkillHandle.Status.RUNNING,
			"cast must still be RUNNING after 45 source ticks, got " + hb.status_name())
	var world_b = mb.source_runtime()
	_check(world_b != null, "the source runtime must exist for " + _id)
	var tasks_before: int = _generator_tasks(world_b)
	if tasks_before >= 0:
		_check(tasks_before > 0, "the authored generator must be live before cancel")
	var emitted_before_cancel: int = _emitted(hb)
	_check(hb.cancel(), "cancel() must succeed while RUNNING")
	_check(hb.status == Gold93SkillHandle.Status.CANCELLED, "cancel must reach CANCELLED")
	if tasks_before >= 0:
		_check(_generator_tasks(world_b) == 0,
				"cancel must end every generator task of this cast (threads must not stay parked)")
	_phase("cancelled")
	hb.tick_source(10)
	_check(_emitted(hb) == emitted_before_cancel, "no intent may be emitted after cancellation")
	_phase("cancel-stepped")
	hb.dispose()
	_phase("disposed")
	_check(hb.status == Gold93SkillHandle.Status.DISPOSED, "dispose must reach DISPOSED")

	# --- 3. full cast reaches FINISHED with typed, unapplied intents ----------
	_phase("full-cast")
	var hc = runtime.cast(StringName(_id), _make_context(CAST_SEED), PARAMS.diagnostic("venomwright"))
	var mc = hc.module
	_check(hc.start(), "start() must succeed for the full cast")
	var ticks_c: int = hc.run_to_completion(MAX_TICKS)
	_check(hc.status == Gold93SkillHandle.Status.FINISHED,
			"full cast must reach FINISHED, got %s after %d ticks" % [hc.status_name(), ticks_c])
	_check(ticks_c >= 60, "full cast must run at least one second of authored time, got %d ticks" % ticks_c)
	var res_c: Dictionary = hc.result()
	var digest_c: String = hc.trace_digest()
	var stats_c: Dictionary = res_c.get("module", {})
	_check(int(res_c.get("combat", {}).get("applied", 0)) == 0,
			"unconfigured gameplay rules must never apply damage")
	_check(not digest_c.is_empty(), "trace digest must be produced")
	var emitted_c: int = _emitted(hc)
	var damage_c: int = int(stats_c.get("damage_intents", 0))
	var status_c: int = int(stats_c.get("status_intents", 0))
	_check(emitted_c >= damage_c + status_c,
			"every host damage/status intent must be emitted through the bus")
	# Scene and glow rasters are produced by the shared VenomWorld sources. Skill
	# 001 renders through the gold_pair family path, which has its own render gate
	# (GOLD93_RENDER), so its frame payload is empty by design and is not asserted here.
	if _generator_tasks(mc.source_runtime()) >= 0:
		var frame_c: Dictionary = mc.frame_payload()
		_check(frame_c.get("scene") != null and frame_c.get("glow") != null,
				"the original scene and glow rasters must be available after the cast")

	# --- 4. replay: same seed, byte-identical trace --------------------------
	_phase("replay")
	var hd = runtime.cast(StringName(_id), _make_context(CAST_SEED), PARAMS.diagnostic("venomwright"))
	_check(hd.start(), "replay start() must succeed")
	var ticks_d: int = hd.run_to_completion(MAX_TICKS)
	_check(ticks_d == ticks_c, "replay must finish on the same tick: %d vs %d" % [ticks_d, ticks_c])
	_check(hd.trace_digest() == digest_c, "same seed must replay with an identical trace digest")
	hd.dispose()
	hc.dispose()
	_check(hc.status == Gold93SkillHandle.Status.DISPOSED, "full cast must dispose cleanly")

	# --- 5. the Lab drives the same id through its real selector -------------
	_phase("lab")
	await _run_lab()

	_phase("done")
	print("GOLD93_HOST_ADAPTER: %s stats ticks=%d emitted=%d damage=%d status=%d digest=%s" % [
		_id, ticks_c, emitted_c, damage_c, status_c, digest_c.substr(0, 16)])
	_finish()


## The Lab is a scene: its `_ready` (which builds the selector and the stage)
## runs only once it has entered the tree and is ready. Waiting on that explicitly
## is what makes the Lab checks meaningful; otherwise they would run on nil nodes.
func _run_lab() -> void:
	var lab = LAB_SCENE.instantiate()
	root.add_child(lab)
	if not lab.is_node_ready():
		await lab.ready
	_check(lab.is_node_ready(), "the Lab scene must be ready after entering the tree")
	if not lab.is_node_ready():
		return
	_check(lab.select_id(_id), "the Lab selector must offer " + _id)
	lab.cast_selected()
	var lab_h = lab.current_handle()
	_check(lab_h != null and not lab_h.is_blocked(), "the Lab must cast " + _id + " without blocking")
	lab.step_ticks(40)
	_check(lab_h != null and lab_h.status == Gold93SkillHandle.Status.RUNNING,
			"the Lab must step the cast while RUNNING")
	lab.cancel_cast()
	_check(lab_h != null and lab_h.status == Gold93SkillHandle.Status.CANCELLED,
			"the Lab cancel must reach CANCELLED")
	lab.cast_selected()
	lab_h = lab.current_handle()
	lab.run_to_end()
	_check(lab_h != null and lab_h.status == Gold93SkillHandle.Status.FINISHED,
			"the Lab run_to_end must reach FINISHED")
	lab.release_all()
	_check(lab.current_handle() == null, "release_all must release the Lab's handle")
	# Let the root finish its current child update before removing the Lab.
	await process_frame
	root.remove_child(lab)
	lab.free()


## Thread-backed generator tasks of a source runtime. The shared VenomWorld
## keeps them in `tasks`; a source without thread-backed generators (the
## Glassfang engine of skill 001) has none, so -1 means "not applicable".
func _generator_tasks(src) -> int:
	if src == null:
		return -1
	var t = src.get("tasks")
	if not (t is Array):
		return -1
	return t.size()


func _finish() -> void:
	if _failures.is_empty():
		print("GOLD93_HOST_ADAPTER: PASS %s / canonical id, cancel, full cast, replay, dispose, Lab" % _id)
		quit(0)
	else:
		print("GOLD93_HOST_ADAPTER: FAIL %s / %d problem(s)" % [_id, _failures.size()])
		quit(1)
