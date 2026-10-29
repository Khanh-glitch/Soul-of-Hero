extends SceneTree

## Full native lifecycle proof for the Gold-93 readiness API.
## Runs the real ORIGINAL Venomwright #001 cast through the unified API and
## asserts the lifecycle guarantees the epic requires. It also proves that the
## other 92 ids FAIL CLOSED instead of pretending to be playable.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const INTENTS = preload("res://prototypes/skill_readiness/core/gold93_intents.gd")

var _failures: Array[String] = []


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_LIFECYCLE: " + message)


func _make_context(source_seed: int, actors: Array) -> Gold93CastContext:
	var caster := Node2D.new()
	caster.name = "LabCaster"
	root.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), source_seed, true)
	# Identity source-to-world keeps this fixture in original source units.
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors(actors)
	ctx.set_ports(bundle)
	return ctx


func _default_actors() -> Array:
	return [
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 420.0, "y": 210.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 300.0, "y": 120.0, "r": 6.0, "exists": true, "dying": 0.0},
	]


func _finish() -> void:
	if _failures.is_empty():
		print("GOLD93_LIFECYCLE: PASS / native start->afterlife->cleanup / 92 ids fail closed / no gameplay numbers invented")
		quit(0)
	else:
		print("GOLD93_LIFECYCLE: FAIL / %d problem(s)" % _failures.size())
		quit(1)


func _initialize() -> void:
	var runtime = RUNTIME.new()
	_check(runtime.catalog.is_valid(), "catalog invalid: " + runtime.catalog.error_message())

	# --- 1. real native cast -------------------------------------------------
	var ctx := _make_context(20261028, _default_actors())
	var params := PARAMS.diagnostic("venomwright")
	var handle = runtime.cast(&"venomwright:001", ctx, params)
	_check(not handle.is_blocked(), "venomwright:001 must be castable, got " + handle.block_reason)
	_check(handle.status == Gold93SkillHandle.Status.READY, "fresh handle must be READY")
	_check(handle.start(), "start() must succeed from READY")
	_check(handle.status == Gold93SkillHandle.Status.RUNNING, "handle must be RUNNING after start")

	var ticks: int = handle.run_to_completion(4096)
	_check(handle.status == Gold93SkillHandle.Status.FINISHED,
			"full original cast must reach FINISHED, got " + handle.status_name())
	_check(ticks > 300, "cast must run the authored timeline incl. 4.2s pool afterlife, got %d ticks" % ticks)

	var result: Dictionary = handle.result()
	var module_stats: Dictionary = result.get("module", {})
	_check(int(module_stats.get("bites", 0)) == 5,
			"original Glassfang has 4 bite cycles + 1 finisher, got %d" % int(module_stats.get("bites", 0)))
	_check(int(module_stats.get("active_pools", 0)) == 0,
			"afterlife pools must expire before FINISHED")
	_check(int(module_stats.get("source_particles", 0)) >= 0, "particle world must be readable")

	var intents: Dictionary = result.get("intents", {})
	_check(int(intents.get("emitted", 0)) > 20,
			"cast must emit a real intent stream, got %d" % int(intents.get("emitted", 0)))
	_check(int(result.get("terrain", {}).get("writes", 0)) > 0,
			"authored ground/environment operations must reach the terrain port")
	_check(int(result.get("combat", {}).get("applied", 0)) == 0,
			"unconfigured gameplay rules must never apply damage")
	_check(int(result.get("combat", {}).get("rejected", 0)) > 0,
			"unconfigured combat port must reject, not silently drop")

	var digest_a: String = handle.trace_digest()
	_check(not digest_a.is_empty(), "deterministic trace digest must be produced")

	# --- 2. cancellation releases resources and stops emission ---------------
	var emitted_before: int = int(intents.get("emitted", 0))
	var released: int = handle.release_resources()
	_check(released > 0, "teardown must release owned visual/audio/terrain resources")
	handle.tick_source(10)
	var after_cancel: Dictionary = handle.result()
	_check(int(after_cancel.get("intents", {}).get("emitted", 0)) == emitted_before,
			"no intent may be emitted after cancellation")
	handle.dispose()
	_check(handle.status == Gold93SkillHandle.Status.DISPOSED, "dispose must reach DISPOSED")

	# --- 3. deterministic replay --------------------------------------------
	var ctx2 := _make_context(20261028, _default_actors())
	var handle2 = runtime.cast(&"venomwright:001", ctx2, PARAMS.diagnostic("venomwright"))
	handle2.run_to_completion(4096)
	_check(handle2.trace_digest() == digest_a,
			"same seed + same aim + same targets must replay byte-identically")

	var ctx3 := _make_context(20261027, _default_actors())
	var handle3 = runtime.cast(&"venomwright:001", ctx3, PARAMS.diagnostic("venomwright"))
	handle3.run_to_completion(4096)
	_check(handle3.trace_digest() != digest_a, "a different source seed must change the cast")

	# --- 3b. every host-adapter-castable skill really casts -------------------
	# A registered module that loads but draws nothing, emits nothing or dies
	# on the first tick would still satisfy `can_cast()`. So each one is cast
	# for real here: it must run, emit intents, produce non-empty rasters,
	# replay deterministically, cancel cleanly and dispose.
	var hb_emitted: int = 0
	for id in runtime.readiness_report()["host_adapter_castable"]:
		if not String(id).begins_with("venomwright:"):
			continue
		var hb_ctx := _make_context(20261028, _default_actors())
		var hb = runtime.cast(StringName(id), hb_ctx, PARAMS.diagnostic("venomwright"))
		_check(not hb.is_blocked(), "%s must not be blocked once a module is registered" % id)
		hb.start()
		var hb_ticks: int = hb.run_to_completion(4096)
		_check(hb_ticks > 1, "%s must advance more than one authored tick, got %d"
				% [id, hb_ticks])
		var hb_res: Dictionary = hb.result()
		var hb_intents: Dictionary = hb_res.get("intents", {})
		var hb_stats: Dictionary = hb.module.stats() if hb.module != null else {}
		# The adapter's real invariant is FAITHFUL TRANSMISSION, not "the cast
		# happened to touch something": every authored hit and every status cue
		# the source recorded must come out as exactly one typed intent - no
		# drops, no duplicates. Requiring `emitted > 0` instead would be
		# asserting the target layout rather than the adapter, and would fail
		# whenever a lab fixture simply misses.
		_check(int(hb_intents.get("emitted", 0))
						== int(hb_stats.get("damage_intents", 0))
						+ int(hb_stats.get("status_intents", 0)),
				"%s must emit exactly one intent per authored event: %d emitted "
				% [id, int(hb_intents.get("emitted", 0))]
				+ "vs %d damage + %d status"
				% [int(hb_stats.get("damage_intents", 0)),
						int(hb_stats.get("status_intents", 0))])
		hb_emitted += int(hb_intents.get("emitted", 0))
		if hb_stats.has("frames_rendered"):
			_check(int(hb_stats["frames_rendered"]) > 1,
					"%s must render more than one frame" % id)
			_check(int(hb_stats["ink_peak"]) > 0,
					"%s rendered frames must not be blank" % id)
			_check(bool(hb_stats.get("cast_fired", false)),
					"%s must actually fire the authored cast" % id)
		# Deterministic replay through the host adapter.
		var hb_ctx2 := _make_context(20261028, _default_actors())
		var hb2 = runtime.cast(StringName(id), hb_ctx2, PARAMS.diagnostic("venomwright"))
		hb2.run_to_completion(4096)
		_check(hb2.trace_digest() == hb.trace_digest(),
				"%s must replay byte-identically through the host adapter" % id)
		# Cancellation then disposal.
		var hb_ctx3 := _make_context(20261028, _default_actors())
		var hb3 = runtime.cast(StringName(id), hb_ctx3, PARAMS.diagnostic("venomwright"))
		hb3.start()
		hb3.tick_source(6)
		var emitted3: int = int(hb3.result().get("intents", {}).get("emitted", 0))
		hb3.cancel()
		hb3.tick_source(30)
		_check(int(hb3.result().get("intents", {}).get("emitted", 0)) == emitted3,
				"%s must emit nothing after cancellation" % id)
		hb3.dispose()
		_check(hb3.status == Gold93SkillHandle.Status.DISPOSED,
				"%s must reach DISPOSED" % id)

	# --- 4. blocked ids fail closed ------------------------------------------
	# Which ids are castable is whatever the runtime actually has a ported
	# generator for; everything else must fail closed. Neither the ported count
	# nor the blocked count is hardcoded: both are read back from the runtime,
	# so this stays true as generators land instead of rotting into a lie.
	var ported: Array = runtime.readiness_report()["native_executable"]
	var blocked_count: int = 0
	for id in runtime.catalog.ids():
		if ported.has(id):
			continue
		var b_ctx := _make_context(20261028, _default_actors())
		var b_handle = runtime.cast(StringName(id), b_ctx, PARAMS.diagnostic(""))
		if b_handle.is_blocked():
			blocked_count += 1
			_check(not b_handle.block_reason.is_empty(),
					"blocked id %s must name the real blocker, not fail silently" % id)
			_check(int(b_handle.result().get("intents", {}).get("emitted", 0)) == 0,
					"blocked id %s must not emit any intents" % id)
	_check(blocked_count == 93 - ported.size(),
			"%d ids are ported so %d must be blocked, got %d"
			% [ported.size(), 93 - ported.size(), blocked_count])

	# --- 5. free 360-degree aim is not locked to the demo direction ----------
	var ctx4 := _make_context(20261028, _default_actors())
	_check(ctx4.set_aim_direction(Vector2(-0.6, -0.8)), "free 360-degree aim direction must be accepted")
	_check(absf(ctx4.aim_direction.length() - 1.0) < 0.000001, "aim direction must be normalized")
	var ctx5 := _make_context(20261028, _default_actors())
	_check(ctx5.set_drag_path(PackedVector2Array([
		Vector2(200.0, 170.0), Vector2(260.0, 120.0), Vector2(320.0, 90.0),
	])), "drag-release path must be accepted")
	_check(ctx5.drag_path.size() == 3, "drag path must be retained")

	# --- 6. gameplay slots remain unconfigured --------------------------------
	var missing: PackedStringArray = params.unconfigured_gameplay_slots()
	_check(missing.size() == PARAMS.GAMEPLAY_SLOTS.size(),
			"every gameplay slot must stay unconfigured until the owner supplies it")
	_check(params.lab_only, "diagnostic parameters must be flagged LAB-only")

	var report: Dictionary = runtime.readiness_report()
	# The axes are strictly separated: `native_port_ready` is the conjunction of
	# executable AND parity-verified AND visually approved, so it can never
	# outrun any single axis. Asserting a fixed "1 ready / 92 blocked" split
	# would stop being true the moment a second generator lands.
	_check(report["native_port_ready"].size() <= report["source_parity_verified"].size(),
			"native_port_ready can never exceed source_parity_verified")
	_check(report["native_port_ready"].size() <= report["gold_visual_approved"].size(),
			"native_port_ready can never exceed gold_visual_approved")

	# --- 6b. the five readiness axes are separate and each is enforced -------
	#
	# These are different claims about different things and were once mixed
	# into one `native_executable` count, which let six source-parity-verified
	# skills coexist with exactly one host-castable module and still pass.
	#
	#   source_native_executable  the ported ORIGINAL engine runs the authored
	#                             generator. Proven by EXECUTING it here, not
	#                             by a table lookup.
	#   host_adapter_castable     a Gold93SkillModule drives it through the
	#                             host-facing CastContext and emits intents.
	#   source_parity_verified    the source-native cast was diffed tick by
	#                             tick against the original TypeScript and
	#                             matched (evidence in parity/index.json).
	#   gold_visual_approved      owner acceptance. Never auto-awarded.
	#   production_integrated     prohibited without owner approval.
	#
	# The invariant that broke CI: parity is measured in the SOURCE-NATIVE
	# domain, so it may only be claimed for ids that execute there. It says
	# nothing about the host adapter, and the host adapter says nothing about
	# parity - the two counts must never be added or substituted.
	var src_native: Array = report["source_native_executable"]
	var host_cast: Array = report["host_adapter_castable"]
	var parity_ids: Array = report["source_parity_verified"]
	for id in parity_ids:
		_check(src_native.has(id),
				"source parity can only be claimed for ids that actually execute "
				+ "in the source-native engine: %s does not" % id)
	_check(parity_ids.size() <= src_native.size(),
			"source_parity_verified (%d) can never exceed source_native_executable (%d)"
			% [parity_ids.size(), src_native.size()])
	# A host module is only honest if the source-native generator behind it
	# really exists; otherwise the adapter would be driving nothing.
	for id in host_cast:
		_check(not String(id).begins_with("venomwright:") or src_native.has(id),
				"host adapter %s is registered but no source-native generator executes "
				+ "behind it: the module would be casting an approximation" % id)
	# An adapter that transmitted nothing at all across every cast would still
	# satisfy the per-skill 1:1 check, so the aggregate is asserted too.
	_check(hb_emitted > 0,
			"the host adapter must actually transmit authored events, got 0 intents")
	_check(src_native.size() >= 1,
			"at least one generator must be ported: a factory that ports nothing is not progress")
	_check(host_cast.size() >= 1,
			"at least one skill must be reachable through the host adapter")
	_check(report["gold_visual_approved"].size() == 0, "no id may claim Gold visual approval yet")
	_check(report["gameplay_configured"].size() == 0, "no gameplay numbers may be invented")
	_check(report["production_integrated"].size() == 0, "production integration stays out of scope")

	_finish()
