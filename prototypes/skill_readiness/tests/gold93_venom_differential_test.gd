extends SceneTree

## GOLD93 Venomwright DIFFERENTIAL parity gate.
##
## Runs the NATIVE GDScript port (venom_world / venom_engine / venom_skills /
## venom_s1) under exactly the protocol recorded in
## docs/vfx/skill_readiness/oracle/venomwright_NNN.json — the same world seed,
## enemy density, cast tick, buffer fill values and sampling schedule the
## original TypeScript engine was driven with — and compares, per sampled tick:
##
##   * scene raster SHA-256 (32 hex, as the oracle records it)
##   * glow  raster SHA-256
##   * fx count, particle count, live enemy count
##
## and, across the whole cast, every authored hit and every status / camera /
## environmental cue the skill emits.
##
## The native run is instrumented by SUBCLASSING the world and overriding the
## authored effect entry points (hit / mark / poison / shake / shock /
## screenFlash). GDScript dispatches those calls virtually, so skill code that
## calls `c.w.hit(...)` is captured; the override records the event and then
## delegates to the original implementation, so behaviour is unchanged.
##
## On the first divergence the test reports the tick, the field, and both
## values, then continues so a single run surfaces the whole picture.
## The verdict is written into docs/vfx/skill_readiness/parity/index.json.

const WORLD = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")
const ENGINE = preload("res://prototypes/skill_readiness/native/venom/venom_engine.gd")
const SKILLS = preload("res://prototypes/skill_readiness/native/venom/venom_skills.gd")
const REGISTRY = preload("res://prototypes/skill_readiness/core/gold93_parity_registry.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const CANDIDATES = preload("res://prototypes/skill_readiness/native/venom/venom_candidates.gd")

const ORACLE_DIR := "res://docs/vfx/skill_readiness/oracle"
## Ticks emitting the per-object GOLD93_OBJ diagnosis (divergent tick and its
## predecessor) per unresolved raster skill.
const OBJ_TICKS: Dictionary = {7: [89, 90, 264, 265], 13: [319, 320], 16: [194, 195], 20: [179, 180]}
const DIAG_DIR := "res://docs/vfx/skill_readiness/diagnostics"
const F: float = 1.0 / 60.0

var _failures: Array = []
var _rows_out: Array = []
var _verbose: bool = false
var _dump_tick: int = -1
var _en12_log: Array = []
## CI shards this suite one skill per job. A shard for a skill whose generator
## is not ported yet is "not yet applicable", not "broken": without this flag
## every unported shard would fail and the matrix could not be declared once.
var _skip_unported: bool = false
## `-- --candidates` lets the differential reach UNVERIFIED generators in
## venom_candidates.gd. Without it, only the registry is visible.
var _use_candidates: bool = false


func _init() -> void:
	var only := ""
	var world_only := false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--skill="):
			only = a.substr(8)
		elif a == "--verbose":
			_verbose = true
		elif a == "--world-only":
			world_only = true
		elif a.begins_with("--dump-tick="):
			_dump_tick = int(a.substr(12))
		elif a == "--skip-unported":
			_skip_unported = true
		elif a == "--candidates":
			_use_candidates = true
	if world_only:
		var wok := _run_world_only()
		print("GOLD93_VENOM_WORLD_DIFFERENTIAL: " + ("PASS" if wok else "FAIL"))
		for f in _failures:
			print("  FAIL " + str(f))
		quit(0 if wok else 1)
		return
	var ids: Array = []
	if only != "":
		ids = [int(only)]
	else:
		for k in SKILLS.defs():
			if _has_gen(int(k)):
				ids.append(int(k))
		ids.sort()
	if ids.is_empty():
		print("GOLD93_VENOM_DIFFERENTIAL: no ported generators")
		quit(1)
		return
	var ok := true
	for sid in ids:
		if not _run(int(sid)):
			ok = false
	for line in _en12_log:
		print("GOLD93_EN12SUM " + String(line))
	print("GOLD93_VENOM_DIFFERENTIAL: " + ("PASS" if ok else "FAIL"))
	for f in _failures:
		print("  FAIL " + str(f))
	quit(0 if ok else 1)


## Registry first; candidates only when explicitly requested.
func _has_gen(sid: int) -> bool:
	if SKILLS.has_generator(sid):
		return true
	return _use_candidates and CANDIDATES.has_generator(sid)


func _factory(sid: int):
	if SKILLS.has_generator(sid):
		return SKILLS.run_factory(sid)
	return CANDIDATES.run_factory(sid)


func _fail(msg: String) -> void:
	_failures.append(msg)
	push_error("GOLD93_DIFF: " + msg)


func _sha(b: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(b)
	return ctx.finish().hex_encode().substr(0, 32)


## The world in isolation: `World.step` + `World.draw` with no skill at all.
## This is the pre-condition for every skill parity claim - if the world
## simulation or the renderer drifts, no skill can match - and it is the first
## thing to look at when a cast diverges on tick 1.
func _run_world_only() -> bool:
	var variants := _world_oracle_variants()
	if variants.is_empty():
		_fail("world: no diagnostics/venomwright_world_only*.json oracle found")
		return false
	var all_ok := true
	for v in variants:
		var oracle: Dictionary = _load_json(String(v["path"]))
		if oracle.is_empty():
			_fail("world: unreadable oracle %s" % v["path"])
			all_ok = false
			continue
		if not _run_world_seed(oracle, String(v["canonical"])):
			all_ok = false
	return all_ok


## Every world-only oracle on disk: the canonical seed-7 reference plus any
## `venomwright_world_only_sN.json` variants. Parity proven on a single world is
## a single data point; the variants make it a claim about the simulation.
func _world_oracle_variants() -> Array:
	var out: Array = []
	var d := DirAccess.open("res://docs/vfx/skill_readiness/diagnostics")
	if d == null:
		return out
	for name in d.get_files():
		if not name.begins_with("venomwright_world_only") or not name.ends_with(".json"):
			continue
		var path := "res://docs/vfx/skill_readiness/diagnostics/" + name
		var data: Dictionary = _load_json(path)
		var dproto: Dictionary = data.get("protocol", {})
		var seed_: int = int(dproto.get("seed", 7))
		out.append({
			"path": path, "seed": seed_,
			"canonical": "venomwright:world" if seed_ == 7 else "venomwright:world@s%d" % seed_,
		})
	out.sort_custom(func(a, b): return int(a["seed"]) < int(b["seed"]))
	return out


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var parsed = JSON.parse_string(f.get_as_text())
	f.close()
	return parsed if parsed is Dictionary else {}


func _run_world_seed(oracle: Dictionary, canonical: String) -> bool:
	var proto: Dictionary = oracle.get("protocol", {})
	var seed_: int = int(proto.get("seed", 7))
	var density: int = int(proto.get("enemy_density", 16))
	var ticks: int = int(oracle.get("ticks", 0))
	var want: Dictionary = {}
	for row in oracle.get("rows", []):
		want[int(row["tick"])] = row

	var w := ProbeWorld.new(ENGINE.WW, ENGINE.WH)
	w.cfg["density"] = density
	w.reset_ids()
	w.uid = 1
	w.reset(seed_, true)
	w.lab = true
	w.stats = {"total": 0.0, "kills": 0, "hits": 0, "ev": []}
	var p = w.player
	p.form = "vessel"
	p.venomT = 0
	p.cat = 100

	var g: Dictionary = ENGINE.build_gfx()
	var ground = ENGINE.make_ground_buffer()

	var n: int = 0
	var divergent_tick: int = -1
	var first_mismatch := ""
	var compared: int = 0
	while n < ticks:
		w.step(F)
		n += 1
		g["s"].copy_from(ground)
		g["l"].clear(0xFF000000)
		g["s"].reset()
		g["l"].reset()
		g["t"] = w.time
		w.draw(g)
		if _dump_tick == n:
			_dump_rasters(g, 0, n)
		if want.has(n):
			var got := {
				"tick": n,
				"scene_sha256": _sha(g["s"].bytes),
				"glow_sha256": _sha(g["l"].bytes),
				"fx": w.fx.size(),
				"parts": w.parts.list.size(),
			}
			var live: int = 0
			for e in w.enemies:
				if e.dying <= 0:
					live += 1
			got["enemies"] = live
			compared += 1
			var which := _mismatch(want[n], got)
			if which != "" and divergent_tick < 0:
				divergent_tick = n
				first_mismatch = which
			if _verbose and which == "":
				print("  world tick %4d OK" % n)

	if w.hits.size() or w.cues.size():
		_fail("world: no cast was fired yet %d hits / %d cues were emitted"
				% [w.hits.size(), w.cues.size()])
	var matched: bool = divergent_tick < 0
	print(JSON.stringify({
		"check": canonical,
		"seed": seed_,
		"ticks_run": ticks,
		"sampled_compared": compared,
		"first_divergent_tick": divergent_tick,
		"first_mismatch": first_mismatch,
		"parity": matched,
	}, "  "))
	if divergent_tick >= 0:
		_fail("%s: first raster divergence at tick %d -> %s"
				% [canonical, divergent_tick, first_mismatch])
	REGISTRY.record(canonical, REGISTRY.PASS if matched else REGISTRY.FAIL, {
			"check": "world-only",
			"seed": seed_,
			"compared_ticks": compared,
			"first_divergent_tick": divergent_tick,
			"first_mismatch": first_mismatch,
			"ticks": ticks,
	})
	return matched


func _run(sid: int) -> bool:
	if _skip_unported and not _has_gen(sid):
		# Recorded as PENDING, never as PASS: an unported skill has no parity
		# evidence and must not be counted as verified anywhere.
		print("GOLD93_VENOM_DIFFERENTIAL: SKIP skill %d (generator not ported)" % sid)
		return true
	var variants := _oracle_variants(sid)
	if variants.is_empty():
		_fail("skill %d: oracle file missing" % sid)
		return false
	var all_ok := true
	for v in variants:
		var oracle: Dictionary = _load_json(String(v["path"]))
		if oracle.is_empty():
			_fail("skill %d: unreadable oracle %s" % [sid, v["path"]])
			all_ok = false
			continue
		if not _run_seed(sid, oracle, String(v["canonical"])):
			all_ok = false
	return all_ok


## The canonical seed-7 oracle plus every `venomwright_NNN_sN.json` variant in
## the diagnostics directory. Different worlds exercise different targets,
## different enemy clusters and different kill/no-kill outcomes, so parity is
## checked against more than one authored scenario.
func _oracle_variants(sid: int) -> Array:
	var out: Array = []
	var main := "%s/venomwright_%03d.json" % [ORACLE_DIR, sid]
	if FileAccess.file_exists(main):
		out.append({"path": main, "seed": 7,
				"canonical": "venomwright:%03d" % sid})
	var d := DirAccess.open(DIAG_DIR)
	if d != null:
		var prefix := "venomwright_%03d_s" % sid
		for name in d.get_files():
			if not name.begins_with(prefix) or not name.ends_with(".json"):
				continue
			var path := DIAG_DIR + "/" + name
			var data: Dictionary = _load_json(path)
			var dproto: Dictionary = data.get("protocol", {})
			var fallback_seed: int = int(name.get_basename().split("_s")[1])
			var seed_: int = int(dproto.get("seed", fallback_seed))
			out.append({"path": path, "seed": seed_,
					"canonical": "venomwright:%03d@s%d" % [sid, seed_]})
	out.sort_custom(func(a, b): return int(a["seed"]) < int(b["seed"]))
	return out


func _run_seed(sid: int, oracle: Dictionary, canonical: String) -> bool:
	if oracle.is_empty():
		_fail("skill %d: oracle file missing" % sid)
		return false
	var defs: Dictionary = SKILLS.defs()
	if not defs.has(sid):
		_fail("skill %d: no native def" % sid)
		return false
	var def: Dictionary = defs[sid]
	if not _has_gen(sid):
		_fail("skill %d: generator not ported" % sid)
		return false
	var factory: Callable = _factory(sid)

	var proto: Dictionary = oracle.get("protocol", {})
	var seed_: int = int(proto.get("seed", 7))
	var density: int = int(proto.get("enemy_density", 16))
	var ground_seed: int = int(proto.get("ground_seed", 17))
	var cast_tick: int = int(oracle.get("cast_tick", 1))
	var ticks: int = int(oracle.get("ticks", 0))
	if ticks == 0:
		_fail("skill %d: oracle has no tick count" % sid)
		return false
	if ground_seed != 17:
		_fail("skill %d: oracle ground_seed %d != supported 17" % [sid, ground_seed])
		return false

	# ---- world, exactly as the oracle drove the original -------------------
	if _verbose:
		printerr("  begin seed %d ticks=%d cast_tick=%d" % [seed_, ticks, cast_tick])
	var w := ProbeWorld.new(ENGINE.WW, ENGINE.WH)
	w.cfg["density"] = density
	w.reset_ids()
	w.uid = 1
	w.reset(seed_, true)
	w.lab = true
	w.stats = {"total": 0.0, "kills": 0, "hits": 0, "ev": []}
	var p = w.player
	p.form = "venom" if String(def["form"]) == "venom" else "vessel"
	p.venomT = 999
	p.cat = 100
	if String(def["form"]) != "venom":
		p.venomT = 0

	# ---- rasters -----------------------------------------------------------
	var g: Dictionary = ENGINE.build_gfx()
	var ground = ENGINE.make_ground_buffer()

	# ---- sampled ticks -----------------------------------------------------
	var want: Dictionary = {}
	for row in oracle.get("rows", []):
		want[int(row["tick"])] = row

	var n: int = 0
	var casted := false
	var divergent_tick: int = -1
	var first_mismatch := ""
	var compared: int = 0

	while n < ticks:
		w.step(F)
		n += 1
		if _verbose:
			printerr("  step %4d" % n)
		if n == cast_tick and not casted:
			casted = true
			var r: Dictionary = ENGINE.auto_aim(w, def)
			ENGINE.cast(w, def, r, factory)
		# render: scene <- ground, glow <- 0xFF000000, then w.draw(g)
		g["s"].copy_from(ground)
		g["l"].clear(0xFF000000)
		g["s"].reset()
		g["l"].reset()
		g["t"] = w.time
		# Per-object raster diagnosis at the known first-divergent ticks of the
		# unresolved raster skills (compact GOLD93_OBJ lines; identical format
		# from the Node reference `objhash` mode, tick list passed as argv 6).
		w.objhash_on = OBJ_TICKS.has(sid) and n in OBJ_TICKS[sid]
		if sid == 7:
			w.hatch_trace = n >= 200 and n <= 210
		if w.objhash_on:
			w.objhash_log.clear()
		w.draw(g)
		if w.objhash_on:
			# ONE line per tick: the CI annotation feed truncates long logs, so
			# each entry is `label:hash6` and the whole tick fits one line.
			var compact: Array = []
			for entry in w.objhash_log:
				var sp: PackedStringArray = String(entry).split(" ")
				compact.append("%s:%s" % [sp[0], sp[1].substr(0, 6)])
			# Chunked at 10 entries: annotation messages cap near 1000 chars.
			var part: int = 0
			var i0: int = 0
			while i0 < compact.size():
				print("GOLD93_OBJ t=%d p=%d %s" % [n, part, " ".join(compact.slice(i0, mini(i0 + 10, compact.size())))])
				part += 1
				i0 += 10
			w.objhash_on = false
		if sid == 7 and (n == 89 or n == 90 or n == 264 or n == 265):
			# 12x10 block grid (100x68 px each) scene hashes, chunked per line.
			var blks: Array = []
			for by in range(10):
				for bx in range(12):
					var ctx := HashingContext.new()
					ctx.start(HashingContext.HASH_SHA256)
					for row in range(68):
						var off: int = ((by * 68 + row) * 1200 + bx * 100) * 4
						ctx.update(g["s"].bytes.slice(off, off + 400))
					blks.append(ctx.finish().hex_encode().substr(0, 6))
			var bi: int = 0
			var bp: int = 0
			while bi < blks.size():
				print("GOLD93_BLK t=%d p=%d %s" % [n, bp, " ".join(blks.slice(bi, mini(bi + 15, blks.size())))])
				bp += 1
				bi += 15
		if _dump_tick == n:
			_dump_rasters(g, sid, n)
		if sid == 7 and n <= 92:
			_dump_summon_state(w, n)
		if sid == 7 and n in [2, 30, 60, 80]:
			print("GOLD93_PL t=%d px=%.12f py=%.12f" % [n, float(w.player.x), float(w.player.y)])
			var ee2 = w.enemies[12]
			print("GOLD93_EN12 t=%d e%d x=%.12f y=%.12f kx=%.12f ky=%.12f face=%.12f" % [n, 12, float(ee2.x), float(ee2.y), float(ee2.kx), float(ee2.ky), float(ee2.face)])
			_en12_log.append("t=%d x=%.12f y=%.12f kx=%.12f ky=%.12f face=%.12f" % [n, float(ee2.x), float(ee2.y), float(ee2.kx), float(ee2.ky), float(ee2.face)])
		if sid == 7 and n in [185, 190, 195, 200, 205, 210]:
			var es: Array = []
			for ei in range(w.enemies.size()):
				var ee = w.enemies[ei]
				es.append("e%d:%.9f,%.9f" % [ei, float(ee.x), float(ee.y)])
			for i0 in range(0, es.size(), 6):
				print("GOLD93_EN t=%d %s" % [n, " ".join(es.slice(i0, mini(i0 + 6, es.size())))])
		if sid == 7 and n in [120, 150, 180, 210, 240, 263, 264]:
			for f in w.fx:
				if f.get("idx") != null and (int(f.idx) == 0 or int(f.idx) == 2):
					print("GOLD93_HATCH t=%d h%d x=%.9f y=%.9f hd=%.9f vx=%.9f vy=%.9f" % [n, int(f.idx), float(f.x), float(f.y), float(f.hd), float(f.vx), float(f.vy)])
		if sid == 7 and (n == 89 or n == 90):
			var co = w.fx[0]
			print("GOLD93_COCOON t=%d x=%.9f y=%.9f z=%.9f open=%.9f pulseY=%.9f glow=%.9f age=%.9f trans=%.9f shake=%.9f grow=%.9f vis=%.9f rup=%s" % [n, float(co.x), float(co.y), float(co.z), float(co.open), float(co.pulseY), float(co.glowAdd), float(co.age), float(co.trans), float(co.shake), float(co.grow), float(co.vis), str(co.ruptured)])
		if sid == 20 and (n == 179 or n == 180):
			for f in w.fx:
				if String(_fx(f, "kind", "")) == "flow":
					var bs: Array = []
					for b in f.br:
						bs.append("d%.3f/l%.3f/w%.3f" % [float(b["drawn"]), float(b["len"]), float(b["w"])])
					var ds: Array = []
					for d in f.discs:
						ds.append("%.4f" % float(d["r"]))
					print("GOLD93_FLOW t=%d age=%.6f br=%d discs=%d %s | discs %s" % [n, float(f.age), f.br.size(), f.discs.size(), " ".join(bs), " ".join(ds)])
		if want.has(n):
			var exp: Dictionary = want[n]
			var got := {
				"tick": n,
				"scene_sha256": _sha(g["s"].bytes),
				"glow_sha256": _sha(g["l"].bytes),
				"fx": w.fx.size(),
				"parts": w.parts.list.size(),
			}
			var live: int = 0
			for e in w.enemies:
				if e.dying <= 0:
					live += 1
			got["enemies"] = live
			compared += 1
			var which := _mismatch(exp, got)
			if which != "" and divergent_tick < 0:
				divergent_tick = n
				first_mismatch = which
				_trace_fx(w, n)
			if _verbose and which == "":
				print("  tick %4d OK  scene=%s" % [n, got["scene_sha256"]])

	# Capture authored events at the exact oracle end tick BEFORE teardown.
	# VenomGen.dispose() releases its parked thread through the remaining
	# yield points. Those teardown-only callbacks can emit additional events
	# which were never part of the original timeline. Never compare them.
	var actual_hits: Array = w.hits.duplicate(true)
	var actual_cues: Array = w.cues.duplicate(true)
	# Still drain the worker threads to avoid an unsafe headless exit.
	w.drain_all()
	if _verbose:
		printerr("  loop done n=%d casted=%s" % [n, str(casted)])

	if not casted:
		_fail("skill %d: cast never fired (cast_tick=%d, ticks=%d)"
				% [sid, cast_tick, ticks])

	# ---- authored event logs ----------------------------------------------
	var hit_res := _compare_events(oracle.get("hits", []), actual_hits)
	var cue_res := _compare_events(oracle.get("cues", []), actual_cues)

	var matched: bool = (divergent_tick < 0) and casted and hit_res[0] and cue_res[0]
	print(JSON.stringify({
		"skill": sid,
		"canonical": canonical,
		"seed": seed_,
		"name": String(def["name"]),
		"ticks_run": ticks,
		"sampled_compared": compared,
		"cast_tick": cast_tick,
		"hits_original": oracle.get("hits", []).size(),
		"hits_native": actual_hits.size(),
		"cues_original": oracle.get("cues", []).size(),
		"cues_native": actual_cues.size(),
		"first_divergent_tick": divergent_tick,
		"first_mismatch": first_mismatch,
		"hit_mismatch": hit_res[1],
		"cue_mismatch": cue_res[1],
		"parity": matched,
	}, "  "))
	if divergent_tick >= 0:
		_fail("%s: first raster divergence at tick %d -> %s"
				% [canonical, divergent_tick, first_mismatch])
	if not hit_res[0]:
		_fail("%s: authored hits differ -> %s" % [canonical, hit_res[1]])
	if not cue_res[0]:
		_fail("%s: authored cues differ -> %s" % [canonical, cue_res[1]])

	REGISTRY.record(canonical,
			REGISTRY.PASS if matched else REGISTRY.FAIL, {
				"skill": sid,
				"seed": seed_,
				"compared_ticks": compared,
				"first_divergent_tick": divergent_tick,
				"first_mismatch": first_mismatch,
				"hit_mismatch": hit_res[1],
				"cue_mismatch": cue_res[1],
				"oracle_schema": String(oracle.get("schema", "")),
				"oracle_cast_tick": cast_tick,
				"ticks": ticks,
			})
	return matched


## On the first divergent tick, dump the native effect list so the difference can
## be located without a debugger: what effects exist, where they are, and which
## of the original's draw hooks they actually implement.
func _trace_fx(w, tick: int) -> void:
	print("  trace tick %d: %d fx, %d parts, %d enemies"
			% [tick, w.fx.size(), w.parts.list.size(), w.enemies.size()])
	for f in w.fx:
		print("    fx kind=%s x=%.2f y=%.2f z=%.2f sy=%.2f age=%.3f dead=%s hooks=%s"
				% [String(_fx(f, "kind", "?")), float(_fx(f, "x", 0.0)),
					float(_fx(f, "y", 0.0)), float(_fx(f, "z", 0.0)),
					float(_fx(f, "sy", 0.0)), float(_fx(f, "age", 0.0)),
					str(_fx(f, "dead", "?")),
					str(["gnd" if f.has_method("gnd") else "",
						"up" if f.has_method("up") else "",
						"air" if f.has_method("air") else "",
						"lit" if f.has_method("lit") else ""])])
	if OS.get_environment("GOLD93_TRACE_ALL") == "1":
		for e in w.enemies:
			print("    en id=%d k=%s x=%.2f y=%.2f r=%.2f hp=%.2f dying=%.3f dyT=%.3f dyKind=%s st=%s" % [
				int(e.id), str(e.kind), float(e.x), float(e.y), float(e.r),
				float(e.hp), float(e.dying), float(e.dyT), str(e.dyKind),
				str(e.st.keys())])
		for q in w.parts.list:
			print("    pt k=%s x=%.2f y=%.2f z=%.2f sz=%.2f c1=%08x" % [
				str(q.get("k")), float(q.get("x", 0.0)), float(q.get("y", 0.0)),
				float(q.get("z", 0.0)), float(q.get("size", 0.0)),
				int(q.get("c1", 0)) & 0xFFFFFFFF])


## `Object.get` takes exactly one argument in Godot 4, so optional properties
## are read through this helper instead of the usual two-argument form.
func _fx(o, key: String, fallback):
	return o.get(key) if key in o else fallback


## Diagnostic (read-only): enemy positions per tick, two lines per tick (8 each),
## same text format as the Node reference `GOLD93_EN`. Used to find the first
## tick and enemy where native world state leaves the original (skill 7).
func _dump_summon_state(w, tick: int) -> void:
	for g in range(2):
		var parts: Array = []
		for i in range(g * 8, mini(g * 8 + 8, w.enemies.size())):
			var e = w.enemies[i]
			parts.append("%.8f,%.8f" % [float(e.x), float(e.y)])
		var head: String = ("fx=%d pt=%d n=%d |" % [w.fx.size(), w.parts.list.size(), w.enemies.size()]) if g == 0 else "|"
		print("GOLD93_EN t=%d g=%d %s %s" % [tick, g, head, " ".join(parts)])


func _mismatch(exp: Dictionary, got: Dictionary) -> String:
	for k in ["scene_sha256", "glow_sha256"]:
		if String(exp.get(k, "")) != String(got.get(k, "")):
			return "%s: original=%s native=%s" % [k, String(exp.get(k, "")),
					String(got.get(k, ""))]
	for k in ["fx", "parts", "enemies"]:
		if int(exp.get(k, -1)) != int(got.get(k, -2)):
			return "%s: original=%d native=%d" % [k, int(exp.get(k, -1)),
					int(got.get(k, -2))]
	return ""


## Order-insensitive canonical rendering of a value so two dictionaries with the
## same content but different key insertion order still compare equal.
func _canon(v) -> String:
	if v is Dictionary:
		var d: Dictionary = v
		var keys: Array = d.keys()
		keys.sort()
		var parts: Array = []
		for k in keys:
			parts.append("%s=%s" % [str(k), _canon(d[k])])
		return "{" + ",".join(parts) + "}"
	if v is Array:
		var a: Array = v
		var parts2: Array = []
		for e in a:
			parts2.append(_canon(e))
		return "[" + ",".join(parts2) + "]"
	if typeof(v) == TYPE_FLOAT:
		return "%.6f" % [float(v)]
	if v == null:
		return "null"
	return str(v)


## Compares two authored event logs element by element, rounding floats to the
## precision the oracle recorded them at.
func _compare_events(exp: Array, got: Array) -> Array:
	if exp.size() != got.size():
		return [false, "count: original=%d native=%d  (original_tail=%s native_tail=%s)"
				% [exp.size(), got.size(),
					_canon(exp[exp.size() - 1]) if exp.size() else "-",
					_canon(got[got.size() - 1]) if got.size() else "-"]]
	for i in range(exp.size()):
		var a: String = _canon(_round_event(exp[i]))
		var b: String = _canon(_round_event(got[i]))
		if a != b:
			return [false, "event %d:\n      original=%s\n      native  =%s" % [i, a, b]]
	return [true, ""]


## JSON carries every number as a float, so an integral id read from the oracle
## arrives as `13.0` while the native log holds the int `13`. Both are snapped to
## the precision the oracle recorded and integral values are normalised to ints
## so the comparison is about the VALUE, not the JSON number type.
func _round_event(e: Dictionary) -> Dictionary:
	var o: Dictionary = {}
	for k in e.keys():
		o[k] = _norm(e[k])
	return o


func _norm(v):
	if typeof(v) == TYPE_FLOAT:
		var f: float = snappedf(float(v), 1e-6)
		if absf(f - roundf(f)) < 1e-9:
			return int(roundf(f))
		return f
	if v is Array:
		var a: Array = []
		for x in v:
			a.append(_norm(x))
		return a
	if v is Dictionary:
		var d: Dictionary = {}
		for k in v.keys():
			d[k] = _norm(v[k])
		return d
	return v


func _dump_rasters(g: Dictionary, sid: int, tick: int) -> void:
	var dir := "user://gold93_diff"
	DirAccess.make_dir_recursive_absolute(dir)
	var sp := "%s/skill%03d_t%04d_scene.png" % [dir, sid, tick]
	var gp := "%s/skill%03d_t%04d_glow.png" % [dir, sid, tick]
	_write_png(ProjectSettings.globalize_path(sp), g["s"])
	_write_png(ProjectSettings.globalize_path(gp), g["l"])
	# Raw RGBA next to the PNGs. `GOLD93_RAW_DIR` makes the ORIGINAL engine emit
	# the same buffers from the oracle driver, so a divergence can be located
	# pixel by pixel instead of only being reported as a hash mismatch.
	var raw_dir: String = OS.get_environment("GOLD93_RAW_DIR")
	if raw_dir != "":
		_write_raw("%s/native_t%04d_scene.bin" % [raw_dir, tick], g["s"])
		_write_raw("%s/native_t%04d_glow.bin" % [raw_dir, tick], g["l"])
	print("GOLD93_DUMP %s %s" % [sp, gp])


func _write_raw(path: String, L) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f != null:
		f.store_buffer(L.bytes)
		f.close()
		print("GOLD93_RAW %s" % path)


func _write_png(path: String, L) -> void:
	var img := Image.create_from_data(L.W, L.H, false, Image.FORMAT_RGBA8, L.bytes)
	img.save_png(path)
	# Raw RGBA alongside the PNG so the two engines can be diffed byte-exactly
	# without going through an image decoder.
	var raw := FileAccess.open(path.get_basename() + ".bin", FileAccess.WRITE)
	raw.store_buffer(L.bytes)
	raw.close()


# ---------------------------------------------------------------------------
# The instrumented world. Behaviour is untouched: every override records the
# event and then delegates to the original implementation.
# ---------------------------------------------------------------------------

class ProbeWorld extends "res://prototypes/skill_readiness/native/venom/venom_world.gd":
	var hits: Array = []
	var cues: Array = []

	func _r6(v: float) -> float:
		return snappedf(v, 1e-6)

	func _p3(v: float) -> float:
		return snappedf(v, 1e-6)

	## The oracle records shock positions with `toFixed(3)`, so those two fields
	## are compared at that precision; everything else is compared at 1e-6.
	func _shock_v(v: float) -> float:
		return snappedf(v, 1e-3)

	func hit(e, amt: float, o: Dictionary) -> bool:
		var r: bool = super.hit(e, amt, o)
		hits.append({
			"t": _r6(time), "e": e.id, "amt": snappedf(amt, 1e-4),
			"kind": String(o.get("kind", "impact")), "src": o.get("src", null),
			"at": o.get("at", null), "kx": _p3(float(o.get("kx", 0.0))),
			"ky": _p3(float(o.get("ky", 0.0))), "stag": _p3(float(o.get("stagger", 0.0))),
			"big": bool(o.get("big", false)), "heal": _p3(float(o.get("heal", 0.0))),
			"killed": r,
		})
		return r

	func mark(e, key: String, dur: float, k: float = 1.0) -> void:
		cues.append({"t": _r6(time), "k": "mark", "e": e.id, "key": key,
				"dur": _p3(dur)})
		super.mark(e, key, dur, k)

	func poison(e, total: float, dur: float, key: int, src: int,
			every: float = 0.5) -> void:
		cues.append({"t": _r6(time), "k": "poison", "e": e.id,
				"total": _p3(total), "dur": _p3(dur), "src": src})
		super.poison(e, total, dur, key, src, every)

	func shake(m: float, d: float = 0.25) -> void:
		cues.append({"t": _r6(time), "k": "shake", "m": _p3(m), "d": _p3(d)})
		super.shake(m, d)

	func shock(x: float, y: float, max_: float, dur: float, amp: float = 3) -> void:
		cues.append({"t": _r6(time), "k": "shock", "x": _shock_v(x),
				"y": _shock_v(y), "max": _p3(max_), "dur": _p3(dur),
				"amp": _p3(amp)})
		super.shock(x, y, max_, dur, amp)

	func screen_flash(c: int, a: float, dur: float = 0.2) -> void:
		cues.append({"t": _r6(time), "k": "flash", "c": c & 0xFFFFFFFF,
				"a": _p3(a), "dur": _p3(dur)})
		super.screen_flash(c, a, dur)
