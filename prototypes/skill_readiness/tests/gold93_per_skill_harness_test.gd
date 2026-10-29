extends SceneTree

## Per-skill independent native harness (EPIC measurable output #2).
##
## "93 skill modules / source-driven registrations + per-skill independent
## native harness, not just a YAML/JSON skeleton."
##
## For EVERY one of the 93 canonical ids this harness builds a completely
## isolated instance — its own runtime, its own family runtime, its own stage
## node, its own caster, its own port bundle — and drives the whole public cast
## API through it:
##
##   cast -> start -> free 360-degree re-aim -> drag-release path -> tick at the
##   family's ORIGINAL fixed clock -> cancel -> verify no further emission ->
##   dispose -> release every resource -> verify zero leaked nodes.
##
## Castable ids additionally run a full start-to-afterlife cast and record the
## deterministic trace digest. Blocked ids must fail closed here too: no tick,
## no intent, no invented VFX.
##
## Every row is written to `res://.artifacts/gold93/per_skill_harness.json`.
## This harness never mutates production content and never invents a gameplay
## number: damage stays unconfigured, so the combat authority must reject.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")

const SOURCE_SEED: int = 20261028
const SMOKE_TICKS: int = 32

var _failures: Array[String] = []
var _rows: Array = []
var _root_children_before: int = 0


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_HARNESS: " + message)


func _actors() -> Array:
	return [
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 430.0, "y": 215.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 290.0, "y": 110.0, "r": 6.0, "exists": true, "dying": 0.0},
	]


## One completely isolated harness instance for a single canonical id.
func _run_skill(runtime, key: String) -> Dictionary:
	var entry: Dictionary = runtime.catalog.skill(key)
	var family := String(entry.get("family", ""))
	var row: Dictionary = {
		"key": key,
		"family": family,
		"original_name": String(entry.get("original_name", "")),
		"source_target_class": String(entry.get("source_target_class", "")),
		"native_executable": runtime.can_cast(key),
		"blocker": runtime.catalog.blocker(key),
		"harness_status": "UNKNOWN",
		"family_attached": false,
		"family_surfaces": 0,
		"source_hz": 0.0,
		"ticks_run": 0,
		"intents_emitted": 0,
		"aim_reassigned": false,
		"drag_path_accepted": false,
		"cancel_stopped_emission": false,
		"resources_released": 0,
		"leaked_nodes": -1,
		"trace_digest": "",
		"combat_applied": 0,
		"combat_rejected": 0,
	}

	# --- isolated stage, caster, ports --------------------------------------
	var stage := Node2D.new()
	stage.name = "Harness_" + key.replace(":", "_")
	root.add_child(stage)

	var caster := Node2D.new()
	caster.name = "HarnessCaster"
	caster.global_position = Vector2(200.0, 170.0)
	stage.add_child(caster)

	var family_runtime = runtime.family_runtime(family)
	_check(family_runtime != null, "family runtime must resolve for " + key)
	if family_runtime == null:
		stage.queue_free()
		row["harness_status"] = "FAMILY_UNRESOLVED"
		return row
	row["family_attached"] = bool(family_runtime.attach(stage, family_runtime.default_density()))
	# Baseline of everything legitimately living under the harness stage: the
	# caster plus the family-owned render surfaces. Anything added after this
	# point and still present at teardown is a real leak.
	var baseline: Array[String] = []
	for child in stage.get_children():
		baseline.append(String(child.name))
	row["family_surfaces"] = int(family_runtime.stats().get("owned_nodes", 0))
	row["source_hz"] = float(family_runtime.default_hz())
	_check(row["family_attached"], "family surfaces must attach for " + key)
	_check(row["family_surfaces"] > 0, "family must own at least one surface for " + key)

	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), SOURCE_SEED, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors(_actors())
	ctx.set_ports(bundle)

	# --- cast ----------------------------------------------------------------
	var handle = runtime.cast(StringName(key), ctx, PARAMS.diagnostic(family))
	_check(handle != null, "cast must return a handle for " + key)
	if handle == null:
		family_runtime.detach()
		stage.queue_free()
		row["harness_status"] = "NO_HANDLE"
		return row

	# --- blocked ids must fail closed inside the harness too -----------------
	if handle.is_blocked():
		row["harness_status"] = "BLOCKED_FAIL_CLOSED"
		_check(not handle.start(), "a blocked handle must refuse start(): " + key)
		_check(handle.tick_source(16) == 0, "a blocked handle must not tick: " + key)
		_check(int(handle.result().get("intents", {}).get("emitted", 0)) == 0,
				"a blocked handle must emit nothing: " + key)
		_check(not row["blocker"].is_empty(),
				"a blocked id must state its material blocker: " + key)
		_check(not row["native_executable"],
				"a blocked id must never report native_executable: " + key)
		row["resources_released"] = _dispose_and_count(handle)
		row["cancel_stopped_emission"] = true
		row["leaked_nodes"] = _leaked_nodes(stage, baseline)
		family_runtime.detach()
		stage.queue_free()
		return row

	# --- castable id: full API drive ----------------------------------------
	row["harness_status"] = "NATIVE_CAST"
	_check(handle.start(), "start() must succeed for " + key)
	row["aim_reassigned"] = handle.update_aim(Vector2(120.0, 260.0))
	_check(row["aim_reassigned"], "free 360-degree re-aim must be accepted: " + key)
	row["drag_path_accepted"] = handle.set_drag_path(PackedVector2Array([
		Vector2(200.0, 170.0), Vector2(250.0, 130.0), Vector2(310.0, 100.0),
	]))
	_check(row["drag_path_accepted"], "drag-release path must be accepted: " + key)

	row["ticks_run"] = handle.tick_source(SMOKE_TICKS)
	_check(row["ticks_run"] == SMOKE_TICKS, "smoke ticks must advance: " + key)

	var before_cancel: int = int(handle.result().get("intents", {}).get("emitted", 0))
	row["intents_emitted"] = before_cancel
	# Deliberately NOT asserting `before_cancel > 0` here. The smoke window is
	# only SMOKE_TICKS long (a third of a second), and several authored casts
	# have their first contact later than that - so this would assert the
	# fixture's luck rather than the code. Whether a cast really emits is
	# asserted on the full cast below, which runs to completion.

	_check(handle.cancel(), "cancel() must succeed while running: " + key)
	handle.tick_source(SMOKE_TICKS)
	row["cancel_stopped_emission"] = (
			int(handle.result().get("intents", {}).get("emitted", 0)) == before_cancel)
	_check(row["cancel_stopped_emission"],
			"no intent may be emitted after cancellation: " + key)

	var combat: Dictionary = handle.result().get("combat", {})
	row["combat_applied"] = int(combat.get("applied", 0))
	row["combat_rejected"] = int(combat.get("rejected", 0))
	_check(row["combat_applied"] == 0,
			"unconfigured rules must never apply damage: " + key)
	# The authority can only reject what the cast actually submitted, so this
	# is asserted on the full cast below rather than on the short smoke window.
	_check(row["combat_rejected"] >= 0, "combat rejection count must be readable: " + key)

	row["resources_released"] = handle.release_resources()
	_check(row["resources_released"] > 0, "teardown must release owned resources: " + key)
	handle.dispose()
	_check(handle.status == Gold93SkillHandle.Status.DISPOSED,
			"dispose must reach DISPOSED: " + key)
	row["leaked_nodes"] = _leaked_nodes(stage, baseline)

	# --- full independent cast to completion, for the castable ids only ------
	var full_stage := Node2D.new()
	full_stage.name = "FullCast_" + key.replace(":", "_")
	root.add_child(full_stage)
	var full_caster := Node2D.new()
	full_caster.global_position = Vector2(200.0, 170.0)
	full_stage.add_child(full_caster)
	var full_ctx := CONTEXT.new()
	full_ctx.initialize(full_caster, Vector2(200.0, 170.0), SOURCE_SEED, true)
	full_ctx.set_source_to_world(Transform2D.IDENTITY)
	full_ctx.set_world_aim(Vector2(340.0, 170.0))
	var full_bundle := PORTS.Bundle.new(true)
	full_bundle.targets.set_actors(_actors())
	full_ctx.set_ports(full_bundle)
	var full = runtime.cast(StringName(key), full_ctx, PARAMS.diagnostic(family))
	full.run_to_completion(4096)
	_check(full.status == Gold93SkillHandle.Status.FINISHED,
			"the full cast must reach FINISHED: " + key)
	row["full_cast_ticks"] = int(full.source_tick)
	row["full_cast_module"] = full.result().get("module", {})
	row["trace_digest"] = full.trace_digest()
	_check(not row["trace_digest"].is_empty(),
			"a full cast must produce a deterministic trace digest: " + key)

	# The full cast ran the whole authored timeline, so it is the honest place
	# to require that the cast actually did something and that every authored
	# event survived the trip into typed intents.
	var full_combat: Dictionary = full.result().get("combat", {})
	_check(int(full_combat.get("applied", 0)) == 0,
			"unconfigured rules must never apply damage: " + key)
	_check(int(full_combat.get("rejected", 0)) > 0,
			"unconfigured rules must be rejected by the authority: " + key)
	var full_stats: Dictionary = full.module.stats() if full.module != null else {}
	var full_emitted: int = int(full.result().get("intents", {}).get("emitted", 0))
	if full_stats.has("damage_intents"):
		# Modules that publish the authored-event counters are held to exact
		# 1:1 transmission.
		var authored: int = (int(full_stats.get("damage_intents", 0))
				+ int(full_stats.get("status_intents", 0)))
		_check(authored > 0,
				"a full authored cast must produce real events: " + key)
		_check(full_emitted == authored,
				"every authored event must become exactly one typed intent: " + key
				+ " (%d emitted vs %d authored)" % [full_emitted, authored])
	else:
		# The legacy gold_pair module does not publish per-event counters and
		# lives outside this prototype (read-only dependency), so it can only
		# be held to the weaker "it emitted something" bar here.
		_check(full_emitted > 0,
				"a full authored cast must produce real events: " + key)
	full.dispose()
	full_stage.queue_free()

	family_runtime.detach()
	stage.queue_free()
	return row


## Nodes left under the harness stage after teardown, excluding the stage's own
## caster (freed with the stage) and the family surfaces the runtime still owns
## until `detach()`.
func _leaked_nodes(stage: Node2D, baseline: Array[String]) -> int:
	var leaked: int = 0
	for child in stage.get_children():
		if baseline.has(String(child.name)):
			continue
		leaked += 1
		child.queue_free()
	return leaked


func _dispose_and_count(handle) -> int:
	return handle.release_resources()


func _initialize() -> void:
	_root_children_before = root.get_child_count()
	var runtime = RUNTIME.new()
	_check(runtime.catalog.is_valid(),
			"catalog invalid: " + runtime.catalog.error_message())
	if not runtime.catalog.is_valid():
		_finish()
		return

	var ids: PackedStringArray = runtime.catalog.ids()
	_check(ids.size() == 93, "harness must walk exactly 93 ids, got %d" % ids.size())

	for key in ids:
		# A fresh runtime per skill keeps each harness instance independent:
		# nothing is shared between two skill runs.
		var skill_runtime = RUNTIME.new()
		var row: Dictionary = _run_skill(skill_runtime, key)
		if not row.has("full_cast_ticks"):
			row["full_cast_ticks"] = 0
		_rows.append(row)

	# --- aggregate assertions -------------------------------------------------
	_check(_rows.size() == 93, "harness must record 93 rows, got %d" % _rows.size())
	var native: int = 0
	var blocked: int = 0
	var leaked: int = 0
	var families: Dictionary = {}
	for row in _rows:
		if bool(row.get("native_executable", false)):
			native += 1
			_check(String(row.get("harness_status", "")) == "NATIVE_CAST",
					"a native id must run a native cast: " + String(row.get("key", "")))
		else:
			blocked += 1
			_check(String(row.get("harness_status", "")) == "BLOCKED_FAIL_CLOSED",
					"a blocked id must fail closed: " + String(row.get("key", "")))
		leaked += int(row.get("leaked_nodes", 0))
		var fam: String = String(row.get("family", ""))
		families[fam] = int(families.get(fam, 0)) + 1
		_check(int(row.get("source_hz", 0.0)) > 0.0,
				"every id must run at a real source clock: " + String(row.get("key", "")))
		_check(int(row.get("family_surfaces", 0)) > 0,
				"every id must attach its family surfaces: " + String(row.get("key", "")))
		_check(int(row.get("combat_applied", 0)) == 0,
				"no id may apply unconfigured damage: " + String(row.get("key", "")))
	# The split must never be hardcoded. The factory exists to grow the native
	# side, so a frozen "1 native / 92 blocked" assertion would have to be
	# edited every time a generator lands - and editing a test to match new
	# code is how a gate stops being a gate. What must hold is that the split
	# is exhaustive, that it agrees with what the runtime itself reports, and
	# that it moves in one direction only.
	_check(native + blocked == 93,
			"every id is either natively executable or fails closed, got %d + %d"
			% [native, blocked])
	_check(native >= 1,
			"the factory must have ported at least one generator, got %d" % native)
	var reported_native: int = RUNTIME.new().readiness_report()["native_executable"].size()
	_check(native == reported_native,
			"the harness must agree with the runtime's own count: %d vs %d"
			% [native, reported_native])
	_check(leaked == 0, "no harness instance may leak a node, got %d" % leaked)
	_check(int(families.get("venomwright", 0)) == 21, "21 Venomwright harness rows")
	_check(int(families.get("arcana_iii", 0)) == 72, "72 ARCANA harness rows")

	# Every queued stage is freed before the process ends.
	for child in root.get_children():
		if String(child.name).begins_with("Harness_") or String(child.name).begins_with("FullCast_"):
			child.free()

	DirAccess.make_dir_recursive_absolute("res://.artifacts/gold93")
	var file := FileAccess.open(
			"res://.artifacts/gold93/per_skill_harness.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({
			"schema": "gold93/per-skill-harness/v1",
			"scope": 93,
			"native_executable": native,
			"fail_closed": blocked,
			"leaked_nodes": leaked,
			"rows": _rows,
		}, "  ") + "\n")
		file.close()

	_finish()


func _finish() -> void:
	if _failures.is_empty():
		# Counted from the run, never hardcoded: the native side grows as
		# generators are ported, and a PASS line that still said "1 native"
		# would be lying about the evidence that was just collected.
		var native: int = 0
		var blocked: int = 0
		for row in _rows:
			if bool(row.get("native_executable", false)):
				native += 1
			else:
				blocked += 1
		print("GOLD93_PER_SKILL_HARNESS: PASS / %d isolated harness instances / "
				% _rows.size()
				+ "%d native full cast / %d fail-closed / zero leaked nodes / "
				% [native, blocked]
				+ "zero unconfigured damage")
		quit(0)
	else:
		print("GOLD93_PER_SKILL_HARNESS: FAIL / %d problem(s)" % _failures.size())
		quit(1)
