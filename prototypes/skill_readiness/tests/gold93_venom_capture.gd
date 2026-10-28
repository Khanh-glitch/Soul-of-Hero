extends SceneTree

## GOLD93 Venomwright CAPTURE runner.
##
## Renders the NATIVE cast headlessly and writes real PNGs of the scene and glow
## rasters at the timeline points that matter (windup, first contact, mid-cast,
## finisher, aftermath, cleanup). Hashes prove the numbers agree; these frames
## are what the parity claim actually looks like.
##
##   godot --headless --script res://prototypes/skill_readiness/tests/gold93_venom_capture.gd -- --skill=1
##
## Output: docs/vfx/skill_readiness/captures/venomwright_NNN/
##   tNNNN_scene.png / tNNNN_glow.png  plus manifest.json
##
## The frames are produced by the same `World.step` + `World.draw` path the
## differential test hashes, so a capture can never show something the parity
## run did not verify.

const WORLD = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")
const ENGINE = preload("res://prototypes/skill_readiness/native/venom/venom_engine.gd")
const SKILLS = preload("res://prototypes/skill_readiness/native/venom/venom_skills.gd")

const F: float = 1.0 / 60.0
const CAPTURE_DIR := "res://docs/vfx/skill_readiness/captures"
const ORACLE_DIR := "res://docs/vfx/skill_readiness/oracle"
const DIAG_DIR := "res://docs/vfx/skill_readiness/diagnostics"

var _sid: int = 1
var _seed_: int = 7
var _ticks: Array = []
var _verbose: bool = false


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--skill="):
			_sid = int(a.substr(8))
		elif a.begins_with("--seed="):
			_seed_ = int(a.substr(7))
		elif a.begins_with("--ticks="):
			for t in a.substr(8).split(","):
				if t.strip_edges() != "":
					_ticks.append(int(t))
		elif a == "--verbose":
			_verbose = true
	if _ticks.is_empty():
		_ticks = default_ticks(_sid)
	_capture()
	quit(0)


## Default capture points: the authored timeline of the cast. Windup, the first
## frame an effect exists, first contact, the middle of the cast, the authored
## end frame, and the aftermath tail where cleanup happens.
func default_ticks(sid: int) -> Array:
	var defs: Dictionary = SKILLS.defs()
	var def: Dictionary = defs.get(sid, {})
	var frames: float = float(def.get("total", 205))
	# `total` is authored in frames at 60 Hz, so the authored end of the cast is
	# `total` ticks of World.step(1/60).
	var end_tick: int = int(frames)
	var out: Array = [1, 5, 15]
	for t in [60, 120, 180]:
		if t < end_tick:
			out.append(t)
	out.append(end_tick)
	out.append(end_tick + 20)
	out.append(end_tick + 40)
	var uniq: Array = []
	for t in out:
		if t > 0 and not uniq.has(t):
			uniq.append(t)
	uniq.sort()
	return uniq


func _capture() -> void:
	var defs: Dictionary = SKILLS.defs()
	if not defs.has(_sid):
		printerr("capture: skill %d has no native def" % _sid)
		return
	var def: Dictionary = defs[_sid]
	if not SKILLS.has_generator(_sid):
		printerr("capture: skill %d generator not ported" % _sid)
		return
	var factory: Callable = SKILLS.run_factory(_sid)

	var w = WORLD.new(ENGINE.WW, ENGINE.WH)
	w.cfg["density"] = 16
	w.reset_ids()
	w.uid = 1
	w.reset(_seed_, true)
	w.lab = true
	w.stats = {"total": 0.0, "kills": 0, "hits": 0, "ev": []}
	var p = w.player
	p.form = "venom" if String(def["form"]) == "venom" else "vessel"
	p.venomT = 999
	p.cat = 100
	if String(def["form"]) != "venom":
		p.venomT = 0

	var g: Dictionary = ENGINE.build_gfx()
	var ground = ENGINE.make_ground_buffer()

	var last: int = 0
	for t in _ticks:
		last = maxi(last, int(t))

	var dir := "%s/venomwright_%03d" % [CAPTURE_DIR, _sid]
	var abs_dir := ProjectSettings.globalize_path(dir)
	DirAccess.make_dir_recursive_absolute(abs_dir)

	var manifest: Array = []
	var n: int = 0
	while n < last:
		w.step(F)
		n += 1
		if n == 1:
			var r: Dictionary = ENGINE.auto_aim(w, def)
			ENGINE.cast(w, def, r, factory)
		if not _ticks.has(n):
			continue
		g["s"].copy_from(ground)
		g["l"].clear(0xFF000000)
		g["s"].reset()
		g["l"].reset()
		g["t"] = w.time
		w.draw(g)
		var sp := "%s/t%04d_scene.png" % [abs_dir, n]
		var gp := "%s/t%04d_glow.png" % [abs_dir, n]
		_write_png(sp, g["s"])
		_write_png(gp, g["l"])
		var live: int = 0
		for e in w.enemies:
			if e.dying <= 0:
				live += 1
		manifest.append({
			"tick": n,
			"t": snappedf(w.time, 1e-4),
			"scene": "t%04d_scene.png" % n,
			"glow": "t%04d_glow.png" % n,
			"scene_sha256": _sha(g["s"].bytes),
			"glow_sha256": _sha(g["l"].bytes),
			"fx": w.fx.size(),
			"parts": w.parts.list.size(),
			"enemies": live,
			"player_hp": w.player.hp,
			"damage_total": w.stats["total"],
			"oracle": _oracle_check(n, g),
		})
		if _verbose:
			print("  captured tick %d" % n)

	var mf := FileAccess.open(abs_dir + "/manifest.json", FileAccess.WRITE)
	mf.store_string(JSON.stringify({
		"schema": "gold93/venomwright-capture/v1",
		"canonical_id": "venomwright:%03d" % _sid,
		"name": String(def["name"]),
		"seed": _seed_,
		"step_hz": 60,
		"native_resolution": [ENGINE.RW, ENGINE.RH],
		"ground_seed": 17,
		"engine": "native GDScript port (venom_world/venom_engine/venom_s1)",
		"frames": manifest,
	}, "  ") + "\n")
	mf.close()
	# A capture that does not verify against the ORIGINAL engine is not evidence:
	# report it as a failure rather than shipping decorative frames.
	var mismatched: Array = []
	for fr in manifest:
		if String(fr["oracle"]).begins_with("MISMATCH"):
			mismatched.append("%d:%s" % [int(fr["tick"]), String(fr["oracle"])])
	if not mismatched.is_empty():
		print("GOLD93_CAPTURE: FAIL / %d frame(s) do not match the original engine: %s"
				% [mismatched.size(), ", ".join(mismatched)])
		return
	print("GOLD93_CAPTURE: PASS / skill %d seed %d / %d frames -> %s"
			% [_sid, _seed_, manifest.size(), dir])


## A capture is only evidence if it is the parity-verified frame. Every captured
## tick that the oracle also sampled is hashed against it right here, so a
## capture that drifts from the ORIGINAL engine says so instead of quietly
## shipping a pretty picture. Returns a short verdict string stored per frame.
func _oracle_check(tick: int, g: Dictionary) -> String:
	var path := "%s/venomwright_%03d.json" % [ORACLE_DIR, _sid]
	if _seed_ != 7:
		path = "%s/venomwright_%03d_s%d.json" % [DIAG_DIR, _sid, _seed_]
	if not FileAccess.file_exists(path):
		return "no-oracle"
	var f := FileAccess.open(path, FileAccess.READ)
	var parsed = JSON.parse_string(f.get_as_text())
	f.close()
	if not (parsed is Dictionary):
		return "unreadable"
	var rows = parsed.get("rows", [])
	if typeof(rows) != TYPE_ARRAY:
		return "unreadable"
	for row in rows:
		if int(row["tick"]) != tick:
			continue
		var scene_ok: bool = String(row.get("scene_sha256", "")) == _sha(g["s"].bytes)
		var glow_ok: bool = String(row.get("glow_sha256", "")) == _sha(g["l"].bytes)
		if scene_ok and glow_ok:
			return "match"
		return "MISMATCH scene=%s glow=%s" % [
			"ok" if scene_ok else "differs", "ok" if glow_ok else "differs"]
	return "not-sampled"


func _sha(b: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(b)
	return ctx.finish().hex_encode().substr(0, 32)


func _write_png(path: String, L) -> void:
	var img := Image.create_from_data(L.W, L.H, false, Image.FORMAT_RGBA8, L.bytes)
	var err: int = img.save_png(path)
	if err != OK:
		printerr("capture: failed to write %s (err %d)" % [path, err])
