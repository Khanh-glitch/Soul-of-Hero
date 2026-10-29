extends SceneTree

## Headless acceptance for the Venomwright 006 / 010 pilot.
##
## For each pilot skill it runs the native generator for the full recorded
## timeline plus an aftermath, and gates on five things:
##   1. every recorded sampled SCENE raster hash matches the oracle,
##   2. every recorded sampled GLOW raster hash matches the oracle,
##   3. the authored HIT events, and separately the CUE events, recorded at the
##      oracle end tick equal the oracle's logs in count, order and every field,
##   4. cleanup: live fx and particles reach zero after the aftermath,
##   5. the exported frames are non-blank and were rendered by the native world.
## The oracle JSON is only read, never written. Raster and event matches are
## hash- and value-level synchronisation with the recorded GOLD reference; they
## are not a GOLD visual comparison (the GOLD reference is skipped for now).
## Frames (scene, glow, presentation composite) are written to the directory in
## VENOM_PILOT_OUT (absolute path) or user://venom_pilot.

const STAGE = preload("res://prototypes/skill_readiness/pilot/venom_pilot_stage.gd")
const EVENTS = preload("res://prototypes/skill_readiness/pilot/venom_pilot_events.gd")

const ORACLE_PATH := "res://docs/vfx/skill_readiness/oracle/venomwright_%03d.json"
## Aftermath length past the recorded oracle end. Long enough to observe the
## finale decay; the cleanup gate itself stays strict (zero live fx/particles).
const TAIL_TICKS_DEFAULT: int = 1800
const DECAY_STEP: int = 60
var TAIL_TICKS: int = TAIL_TICKS_DEFAULT
var SKILLS: Array = [6, 10]

var _all_ok: bool = true


func _init() -> void:
	var skills_env: String = OS.get_environment("VENOM_PILOT_SKILLS")
	if not skills_env.is_empty():
		SKILLS = []
		for part in skills_env.split(","):
			SKILLS.append(int(part.strip_edges()))
	var tail_env: String = OS.get_environment("VENOM_PILOT_TAIL")
	if not tail_env.is_empty():
		TAIL_TICKS = int(tail_env)
	var out_root: String = OS.get_environment("VENOM_PILOT_OUT")
	if out_root.is_empty():
		out_root = "user://venom_pilot"
	if out_root.begins_with("user://"):
		out_root = ProjectSettings.globalize_path(out_root)
	DirAccess.make_dir_recursive_absolute(out_root)
	var manifest: Dictionary = {"schema": "gold93/venom-pilot/v1", "skills": {}}
	for sid in SKILLS:
		var r: Dictionary = _run_skill(sid, out_root)
		manifest["skills"][str(sid)] = r
		_all_ok = _all_ok and bool(r["ok"])
	var f := FileAccess.open(out_root.path_join("manifest.json"), FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(manifest, "\t"))
		f.close()
	print("GOLD93_VENOM_PILOT: %s" % ("PASS" if _all_ok else "FAIL"))
	quit(0 if _all_ok else 1)


func _load_oracle(sid: int) -> Dictionary:
	var f := FileAccess.open(ORACLE_PATH % sid, FileAccess.READ)
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	return parsed if parsed is Dictionary else {}


func _sha(b: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(b)
	return ctx.finish().hex_encode().substr(0, 32)


func _nonblank(b: PackedByteArray) -> int:
	var lit: int = 0
	var i: int = 0
	var n: int = b.size()
	while i < n:
		if b[i] != 0 or b[i + 1] != 0 or b[i + 2] != 0:
			lit += 1
		i += 4
	return lit


func _composite(scene: PackedByteArray, glow: PackedByteArray, w: int, h: int) -> Image:
	var out := PackedByteArray()
	out.resize(w * h * 4)
	for i in range(w * h * 4):
		out[i] = mini(scene[i] + glow[i], 255) if (i & 3) != 3 else 255
	return Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, out)


func _run_skill(sid: int, out_root: String) -> Dictionary:
	var oracle: Dictionary = _load_oracle(sid)
	var res: Dictionary = {"ok": false, "skill": sid}
	if oracle.is_empty():
		res["error"] = "oracle missing"
		_report(sid, res)
		return res
	var rows: Dictionary = {}
	for row in oracle.get("rows", []):
		rows[int(row["tick"])] = row
	var oracle_end: int = int(oracle.get("ticks", 0))
	var end_tick: int = oracle_end + TAIL_TICKS
	var frame_ticks: Dictionary = {}
	for t in [1, int(oracle_end * 0.1), int(oracle_end * 0.25), int(oracle_end * 0.5), oracle_end, end_tick]:
		frame_ticks[maxi(1, t)] = true

	var stage = STAGE.new()
	if not stage.start(sid):
		res["error"] = "stage refused skill"
		_report(sid, res)
		return res

	var dir: String = out_root.path_join("skill%03d" % sid)
	DirAccess.make_dir_recursive_absolute(dir)
	var ok_rows: int = 0
	var bad_ticks: Array = []
	var bad_field: String = ""
	var end_hits: Array = []
	var end_cues: Array = []
	var events_captured: bool = false
	var frames: Array = []
	var decay: Array = []
	var zero_tick: int = -1
	var peak_fx: int = 0
	var peak_parts: int = 0
	var blank_frames: int = 0
	for _n in range(end_tick):
		stage.advance(1)
		var t: int = stage.tick
		var live: Dictionary = stage.live_counts()
		peak_fx = maxi(peak_fx, int(live["fx"]))
		peak_parts = maxi(peak_parts, int(live["parts"]))
		if t > oracle_end and (t - oracle_end) % DECAY_STEP == 0:
			decay.append({"tick": t, "fx": live["fx"], "parts": live["parts"]})
		if t > oracle_end and zero_tick < 0 and int(live["fx"]) == 0 and int(live["parts"]) == 0:
			zero_tick = t
		if t == oracle_end:
			# Snapshot the authored events at the oracle end tick, BEFORE the
			# aftermath, exactly where the differential captures them.
			end_hits = stage.authored_hits()
			end_cues = stage.authored_cues()
			events_captured = true
		if rows.has(t):
			var row: Dictionary = rows[t]
			var scene_ok: bool = _sha(stage.scene_bytes()) == String(row["scene_sha256"])
			var glow_ok: bool = _sha(stage.glow_bytes()) == String(row.get("glow_sha256", ""))
			if scene_ok and glow_ok:
				ok_rows += 1
			else:
				bad_ticks.append(t)
				if bad_field.is_empty():
					bad_field = "scene" if not scene_ok else "glow"
		if frame_ticks.has(t):
			var s: PackedByteArray = stage.scene_bytes()
			var g: PackedByteArray = stage.glow_bytes()
			var lit_scene: int = _nonblank(s)
			if lit_scene == 0:
				blank_frames += 1
			var base: String = dir.path_join("t%04d" % t)
			stage.scene_image().save_png(base + "_scene.png")
			stage.glow_image().save_png(base + "_glow.png")
			_composite(s, g, 1200, 680).save_png(base + "_composite.png")
			frames.append({"tick": t, "time": live["time"], "fx": live["fx"], "parts": live["parts"],
				"enemies": live["enemies"], "lit_scene_px": lit_scene,
				"scene_sha256": _sha(s), "glow_sha256": _sha(g)})

	var end_live: Dictionary = stage.live_counts()
	# Authored events from the ORACLE file, compared field by field and in order.
	var oracle_hits: Array = oracle.get("hits", [])
	var oracle_cues: Array = oracle.get("cues", [])
	var hit_res: Array = EVENTS.compare(oracle_hits, end_hits)
	var cue_res: Array = EVENTS.compare(oracle_cues, end_cues)
	# Drain the generator threads only now that every comparison is taken.
	stage.dispose()
	res["hits_original"] = oracle_hits.size()
	res["hits_native"] = end_hits.size()
	res["cues_original"] = oracle_cues.size()
	res["cues_native"] = end_cues.size()
	res["hits_match"] = bool(hit_res[0])
	res["cues_match"] = bool(cue_res[0])
	res["hit_mismatch"] = String(hit_res[1])
	res["cue_mismatch"] = String(cue_res[1])
	res["first_mismatch_field"] = bad_field
	res["oracle_ticks"] = oracle_end
	res["end_tick"] = end_tick
	res["gold_rows"] = rows.size()
	res["gold_row_matches"] = ok_rows
	res["gold_row_mismatches"] = bad_ticks.size()
	res["first_mismatch_tick"] = bad_ticks[0] if not bad_ticks.is_empty() else -1
	res["decay"] = decay
	res["zero_tick"] = zero_tick
	res["peak_fx"] = peak_fx
	res["peak_parts"] = peak_parts
	res["end_fx"] = end_live["fx"]
	res["end_parts"] = end_live["parts"]
	res["blank_frames"] = blank_frames
	res["frames"] = frames
	var parity_ok: bool = bad_ticks.is_empty() and ok_rows == rows.size() and not rows.is_empty()
	var events_ok: bool = events_captured and bool(hit_res[0]) and bool(cue_res[0]) \
			and not oracle_hits.is_empty()
	parity_ok = parity_ok and events_ok
	var cleanup_ok: bool = int(end_live["fx"]) == 0 and int(end_live["parts"]) == 0
	res["ok"] = parity_ok and cleanup_ok and blank_frames == 0 and not frames.is_empty()
	_report(sid, res)
	return res


func _report(sid: int, r: Dictionary) -> void:
	if r.has("error"):
		print("GOLD93_VENOM_PILOT skill %03d FAIL: %s" % [sid, r["error"]])
		return
	var verdict: String = "PASS" if bool(r["ok"]) else "FAIL"
	print("GOLD93_VENOM_PILOT skill %03d %s gold_rows %d/%d first_mismatch %d first_mismatch_field %s end_fx %d end_parts %d zero_tick %d peak_fx %d peak_parts %d blank_frames %d" % [
		sid, verdict, int(r["gold_row_matches"]), int(r["gold_rows"]), int(r["first_mismatch_tick"]),
		String(r.get("first_mismatch_field", "")) if not String(r.get("first_mismatch_field", "")).is_empty() else "none",
		int(r["end_fx"]), int(r["end_parts"]), int(r["zero_tick"]), int(r["peak_fx"]), int(r["peak_parts"]), int(r["blank_frames"])])
	print("GOLD93_VENOM_PILOT skill %03d events hits %d/%d match=%s cues %d/%d match=%s" % [
		sid, int(r["hits_native"]), int(r["hits_original"]), str(r["hits_match"]),
		int(r["cues_native"]), int(r["cues_original"]), str(r["cues_match"])])
	if not bool(r.get("hits_match", true)):
		print("GOLD93_VENOM_PILOT skill %03d hit mismatch: %s" % [sid, String(r["hit_mismatch"])])
	if not bool(r.get("cues_match", true)):
		print("GOLD93_VENOM_PILOT skill %03d cue mismatch: %s" % [sid, String(r["cue_mismatch"])])
	for d in r["decay"]:
		print("GOLD93_VENOM_PILOT skill %03d decay tick %d fx %d parts %d" % [sid, int(d["tick"]), int(d["fx"]), int(d["parts"])])
