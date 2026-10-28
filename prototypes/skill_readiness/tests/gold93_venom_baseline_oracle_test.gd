extends SceneTree

## Baseline oracle gate for the 21 Venomwright skills.
##
## `docs/vfx/skill_readiness/venom_21_source_baselines.json` holds the canonical
## ORIGINAL source runtime measurements (mid-cast tick, active FX count, live
## particle count and the whole-scene RGBA SHA-256 prefix) produced by running
## the authored TypeScript unmodified into two independent 1200x680 native Ultra
## (k=2) buffers.
##
## The gate:
##   1. validates the baseline table against the 93-entry catalog (21 rows,
##      matching ids and original names),
##   2. for every skill with a real native module, replays the ORIGINAL capture
##      seed and records the native measurements at the same source tick,
##   3. marks skills without a module as BASELINE_RECORDED_AWAITING_MODULE.
##
## It deliberately does NOT assert numeric equality yet: the original capture
## used the archive's own synthetic actor fixture, which is not replicated here.
## The recorded evidence rows are what a future module must match once the
## original archive fixture is reproducible.

const RUNTIME = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")

const BASELINE_PATH := "res://docs/vfx/skill_readiness/venom_21_source_baselines.json"
## Original capture seed documented in the baseline provenance.
const GOLD_BASELINE_SEED: int = 0x20261027

var _failures: Array[String] = []


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_VENOM_BASELINE: " + message)


func _initialize() -> void:
	var raw: String = FileAccess.get_file_as_string(BASELINE_PATH)
	_check(not raw.is_empty(), "baseline table must be present at " + BASELINE_PATH)
	if raw.is_empty():
		quit(1)
		return
	var baseline: Dictionary = JSON.parse_string(raw)
	_check(not baseline.is_empty(), "baseline table must parse")
	var rows: Array = baseline.get("rows", [])
	_check(rows.size() == 21, "baseline table must hold 21 Venomwright rows")

	var runtime = RUNTIME.new()
	_check(runtime.catalog.is_valid(), "catalog must be valid")

	var evidence: Array = []
	var awaiting: int = 0
	var replayed: int = 0
	for row in rows:
		if not row is Dictionary:
			_check(false, "baseline row must be an object")
			continue
		var b: Dictionary = row
		var key := String(b.get("key", ""))
		_check(runtime.catalog.has_skill(key), "baseline row %s must exist in the catalog" % key)
		var entry: Dictionary = runtime.catalog.skill(key)
		_check(String(entry.get("original_name", "")) == String(b.get("original_name", "")),
				"baseline name mismatch for %s" % key)
		_check(int(entry.get("original_skill_id", -1)) == int(b.get("original_skill_id", -2)),
				"baseline id mismatch for %s" % key)
		_check(String(b.get("whole_source_rgba_sha256_prefix", "")).length() == 16,
				"baseline SHA prefix must be 16 hex characters for %s" % key)
		_check(int(b.get("source_mid_cast_tick", 0)) > 0, "baseline tick required for %s" % key)
		_check(int(baseline.get("source_archive", {}).get("raster_density_k", 0)) == 2,
				"baseline must be native Ultra k2, never an upscaled 1x frame")

		if runtime.can_cast(key):
			evidence.append(_replay(runtime, key, b))
			replayed += 1
		else:
			awaiting += 1
			evidence.append({
				"key": key,
				"status": "BASELINE_RECORDED_AWAITING_MODULE",
				"blocker": runtime.blocker_for(key),
			"source_mid_cast_tick": int(b.get("source_mid_cast_tick", 0)),
			"source_fx_count": int(b.get("source_fx_count", 0)),
			"source_particle_count": int(b.get("source_particle_count", 0)),
			"whole_source_rgba_sha256_prefix": String(
					b.get("whole_source_rgba_sha256_prefix", "")),
		})

	_check(replayed + awaiting == 21, "every Venomwright skill must be accounted for")

	var payload: Dictionary = {
		"baseline_seed": GOLD_BASELINE_SEED,
		"rows": evidence,
		"replayed": replayed,
		"awaiting_module": awaiting,
		"equality_asserted": false,
		"equality_blocker": ("this legacy hand-written baseline was captured "
				+ "against a synthetic actor fixture whose exact positions were "
				+ "never recorded, so it cannot be regenerated or verified. It is "
				+ "NOT a parity gate. The authoritative, reproducible comparison "
				+ "is docs/vfx/skill_readiness/oracle/venomwright_NNN.json, "
				+ "generated from the recovered ORIGINAL TypeScript engine under a "
				+ "fully recorded protocol; see gold93_venom_differential_test.gd"),
	}
	DirAccess.make_dir_recursive_absolute("res://.artifacts/gold93")
	var file := FileAccess.open(
			"res://.artifacts/gold93/venom_baseline_oracle.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(payload, "  ") + "\n")
		file.close()
	_check(file != null, "baseline oracle artifact must be written")

	if _failures.is_empty():
		print("GOLD93_VENOM_BASELINE: PASS / 21 authored baselines validated / %d replayed / %d awaiting module"
				% [replayed, awaiting])
		quit(0)
	else:
		print("GOLD93_VENOM_BASELINE: FAIL / %d problem(s)" % _failures.size())
		quit(1)


## Runs the real native module to the ORIGINAL capture tick with the ORIGINAL
## capture seed and records what the native runtime produced.
func _replay(runtime, key: String, baseline: Dictionary) -> Dictionary:
	var caster := Node2D.new()
	root.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), GOLD_BASELINE_SEED, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors([
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 420.0, "y": 210.0, "r": 7.0, "exists": true, "dying": 0.0},
		{"id": 3, "x": 300.0, "y": 120.0, "r": 6.0, "exists": true, "dying": 0.0},
	])
	ctx.set_ports(bundle)

	var handle = runtime.cast(StringName(key), ctx, PARAMS.diagnostic("venomwright"))
	handle.start()
	var target_tick: int = int(baseline.get("source_mid_cast_tick", 0))
	handle.tick_source(target_tick)
	var result: Dictionary = handle.result()
	var module_stats: Dictionary = result.get("module", {})
	var row: Dictionary = {
		"key": key,
		"status": "NATIVE_REPLAY_RECORDED",
		"source_mid_cast_tick": target_tick,
		"source_fx_count": int(baseline.get("source_fx_count", 0)),
		"source_particle_count": int(baseline.get("source_particle_count", 0)),
		"whole_source_rgba_sha256_prefix": String(
				baseline.get("whole_source_rgba_sha256_prefix", "")),
		"native_source_tick": int(result.get("source_tick", 0)),
		"native_particles": int(module_stats.get("source_particles", 0)),
		"native_active_pools": int(module_stats.get("active_pools", 0)),
		"native_bites": int(module_stats.get("bites", 0)),
		"native_terrain_ops": int(module_stats.get("terrain_ops", 0)),
		"native_intents": int(result.get("intents", {}).get("emitted", 0)),
		"native_trace_digest": handle.trace_digest(),
	}
	handle.dispose()
	caster.queue_free()
	return row
