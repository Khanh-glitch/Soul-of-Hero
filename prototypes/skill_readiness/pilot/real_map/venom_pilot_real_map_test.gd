extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## Venomwright 006 / 010 native pilot on the REAL Chapter 1 Level 2 map.
##
## Runs inside the production AppFlow capture harness. The real Knight, real
## Camera2D, real TileMaps and real enemies are untouched. The native venom
## world is anchored on the Knight and composited onto the map:
##   - scene raster: premultiplied with per-pixel coverage (`coverage`), so
##     unpainted pixels show the map and solid / translucent effects occlude it;
##   - glow raster: additive, as in the original renderer;
##   - optional map darkening (host presentation only, backdrop / geometry /
##     decor layers only).
##
## A/B evidence for each pilot skill at matched ticks and seeds:
##   B  gold_isolated       native render alone (isolated viewport, 1200x680)
##   C  legacy_additive     previous real-map composite (baseline)
##   D  coverage            corrected composite, darkening OFF
##   E  coverage_darkened   corrected composite, darkening ON
##   A  original GOLD       NOT RENDERED. Original source is not reachable from
##                          this sandbox; an UNAVAILABLE record is written instead.
##
## Non-goals stated explicitly: the venom formation enemies are the native
## pilot's own virtual actors, not the map's enemies; this is not a gameplay
## integration, not a GOLD visual comparison and not an owner approval.

const STAGE = preload("res://prototypes/skill_readiness/pilot/venom_pilot_stage.gd")
const DARKEN = preload("res://prototypes/skill_readiness/pilot/venom_map_darkening.gd")

const OUT_DIR := "res://.artifacts/venom_real_map"
const FRAME_DT: float = 1.0 / 60.0
const SCENE_W: int = 1200
const SCENE_H: int = 680
const MODES: Array = ["gold_isolated", "legacy_additive", "coverage", "coverage_darkened"]
const ORIGINAL_UNAVAILABLE: String = "Original GOLD renderer source (Venomwright TypeScript/PixiJS) is in private vault Khanh-glitch/APEX-CHAOS-ASSET-VAULT @ 725d12677a1b59777e1def767d12508e836a8332. GitHub returned HTTP 403 (Resource not accessible by integration) for the Arena identity, so the original was not rendered. No approximation was substituted."

## Checkpoints are derived from the recorded oracle timeline (tick = 1 + round(t * 60)).
## anticipation: before the first authored cue; wind_up: before the first hit;
## impact: first authored hit; peak: maximum live fx in the oracle run;
## finisher: last authored hit; aftermath: end of the recorded timeline.
const RUNS: Array = [
	{"skill": 6, "last": 420, "checkpoints": [["anticipation", 7], ["wind_up", 16], ["impact", 25], ["peak", 335], ["finisher", 354], ["aftermath", 385]]},
	{"skill": 10, "last": 840, "checkpoints": [["anticipation", 7], ["wind_up", 31], ["impact", 54], ["peak", 715], ["finisher", 821], ["aftermath", 840]]},
]

var _real_map_failures: int = 0
var _index: Array = []


func _verify(condition: bool, label: String) -> void:
	if not condition:
		_real_map_failures += 1
		_expect(false, "VENOM REAL MAP: " + label)


func _capture_campaign_state(game: Node2D) -> void:
	await super._capture_campaign_state(game)
	var level := game.get_node_or_null("Level") as DungeonLevel
	var entities := game.get_node_or_null("Level/Entities") as Node2D
	var knight := entities.get_node_or_null("Knight") as CharacterBody2D if entities != null else null
	_verify(level != null and entities != null and knight != null, "real production level and Knight exist")
	if knight == null:
		return
	var camera := knight.get_node_or_null("Camera") as Camera2D
	_verify(camera != null and camera.is_current(), "real Knight camera is active")
	if camera == null:
		return
	# Freeze the real Knight so the camera and map stay still during the cast.
	knight.velocity = Vector2.ZERO
	knight.set_physics_process(false)
	camera.reset_smoothing()
	camera.force_update_scroll()
	await get_tree().process_frame
	await RenderingServer.frame_post_draw

	var folder := ProjectSettings.globalize_path(OUT_DIR)
	_verify(DirAccess.make_dir_recursive_absolute(folder) == OK, "evidence folder can be created")
	var baseline: Image = get_viewport().get_texture().get_image()
	_baseline_frame = baseline
	_verify(baseline != null and baseline.save_png(folder.path_join("l2_baseline_no_vfx.png")) == OK,
		"baseline frame of the untouched real map")

	var total_shots: int = 0
	var expected_shots: int = 0
	var skills_done: Array = []
	for run in RUNS:
		for mode in MODES:
			var r: Dictionary = await _run_pass(game, knight, level, folder, run, String(mode))
			total_shots += int(r["shots"])
			expected_shots += int(r["expected"])
		skills_done.append(int(run["skill"]))
		_write_unavailable_original(folder, int(run["skill"]))
	_verify(total_shots == expected_shots, "every checkpoint frame captured from the live viewport")
	_write_index(folder)
	_verify(knight.is_inside_tree(), "real Knight still in the live tree")
	_verify(level.geometry.get_used_cells().size() > 0, "real map collision survives the overlay")
	var verdict: String = "PASS" if _real_map_failures == 0 else "FAIL"
	var ids: String = ""
	for sid in skills_done:
		ids += ("" if ids.is_empty() else ",") + ("%03d" % int(sid))
	# The label is part of the verdict on purpose: PRESENTATION overlay of native
	# VFX on the real map. Not native enemy integration, not gameplay damage, not
	# a GOLD renderer comparison (original renderer not available for A).
	print("GOLD93_VENOM_REAL_MAP: %s | skills %s | real AppFlow Level2 | presentation overlay (coverage composite, darkening A/B), not enemy integration | GOLD original UNAVAILABLE | shots %d/%d | failures %d" % [
		verdict, ids, total_shots, expected_shots, _real_map_failures])


func _run_pass(game: Node2D, knight: CharacterBody2D, level: DungeonLevel, folder: String, run: Dictionary, mode: String) -> Dictionary:
	var sid: int = int(run["skill"])
	var last: int = int(run["last"])
	var isolated: bool = mode == "gold_isolated"
	var darkened: bool = mode == "coverage_darkened"
	var stage = STAGE.new()
	var stage_mode: String = STAGE.MODE_LEGACY_ADDITIVE if mode == "legacy_additive" else STAGE.MODE_COVERAGE
	var started: bool = stage.start(sid, not isolated, stage_mode)
	_verify(started, "native pilot stage starts (skill %03d, %s)" % [sid, mode])
	if not started:
		return {"shots": 0, "expected": (run["checkpoints"] as Array).size()}

	var viewport: SubViewport = null
	var holder := Node2D.new()
	holder.name = "NativeVenomPilot_%03d_%s" % [sid, mode]
	if isolated:
		# B: the native render alone, at its own 1200x680 raster, on black.
		viewport = SubViewport.new()
		viewport.size = Vector2i(SCENE_W, SCENE_H)
		viewport.transparent_bg = false
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		game.add_child(viewport)
		var black := ColorRect.new()
		black.color = Color(0, 0, 0, 1)
		black.size = Vector2(SCENE_W, SCENE_H)
		viewport.add_child(black)
		viewport.add_child(holder)
	else:
		# Venom world units are map pixels (world 600x340, raster 1200x680 at k=2, sprite scale 0.5).
		holder.position = knight.global_position - stage.player_xy()
		game.add_child(holder)

	var sprite_scale: float = 1.0 if isolated else 0.5
	var scene_sprite := Sprite2D.new()
	scene_sprite.name = "NativeSceneEffects"
	scene_sprite.centered = false
	scene_sprite.scale = Vector2(sprite_scale, sprite_scale)
	scene_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	if not isolated:
		var scene_mat := CanvasItemMaterial.new()
		scene_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA if stage.scene_premultiplied() else CanvasItemMaterial.BLEND_MODE_ADD
		scene_sprite.material = scene_mat
	holder.add_child(scene_sprite)

	var glow_sprite := Sprite2D.new()
	glow_sprite.name = "NativeGlow"
	glow_sprite.centered = false
	glow_sprite.scale = Vector2(sprite_scale, sprite_scale)
	glow_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var additive := CanvasItemMaterial.new()
	additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow_sprite.material = additive
	holder.add_child(glow_sprite)

	# Map darkening (Gate 8): authored scenery only — Backdrop/Geometry/Decor
	# TileMapLayers plus CrucibleArt facade and parallax when the map has them.
	# Level/Entities (Knight, enemies) and HUD are never attached.
	var dk = null
	if darkened:
		dk = DARKEN.new()
		var bound: int = dk.attach_by_names(level)
		_verify(bound >= 3, "map darkening binds authored scenery layers (bound %d)" % bound)
		# Baseline-aware adaptive policy: luminance from the untouched map
		# baseline frame captured before any pass ran, never from a live FX frame.
		dk.adaptive = true
		if _baseline_frame != null:
			dk.sample_baseline(_baseline_frame)
		_verify(dk.effective_strength() > 0.0, "adaptive darkening engages on the bright Level2 baseline (lum %.4f)" % dk.baseline_luminance)
	var dark_key: String = "skill_%03d" % sid

	var shots_by_tick: Dictionary = {}
	for cp in run["checkpoints"]:
		shots_by_tick[int(cp[1])] = String(cp[0])
	var shots_saved: int = 0
	var peak_fx: int = 0
	var peak_level: float = 0.0
	var scene_tex: ImageTexture = null
	var glow_tex: ImageTexture = null
	for t in range(1, last + 1):
		stage.advance(1)
		var live: Dictionary = stage.live_counts()
		peak_fx = maxi(peak_fx, int(live["fx"]))
		if dk != null:
			dk.request(dark_key, stage.cast_started and not stage.lifecycle_complete(0))
			dk.step(FRAME_DT)
			peak_level = maxf(peak_level, float(dk.level))
		var scene_img: Image = stage.scene_image()
		var glow_img: Image = stage.glow_image()
		if scene_tex == null:
			scene_tex = ImageTexture.create_from_image(scene_img)
			glow_tex = ImageTexture.create_from_image(glow_img)
			scene_sprite.texture = scene_tex
			glow_sprite.texture = glow_tex
		else:
			scene_tex.update(scene_img)
			glow_tex.update(glow_img)
		if shots_by_tick.has(t):
			await RenderingServer.frame_post_draw
			var shot: Image = viewport.get_texture().get_image() if isolated else get_viewport().get_texture().get_image()
			var cp_name: String = shots_by_tick[t]
			var file_name: String = "s%03d_%s_%s_t%04d.png" % [sid, mode, cp_name, t]
			if shot != null and shot.save_png(folder.path_join(file_name)) == OK:
				shots_saved += 1
				_index.append({
					"skill": sid, "mode": mode, "checkpoint": cp_name, "tick": t, "file": file_name,
					"scene_uncovered_fraction": snappedf(_uncovered_fraction(stage.scene_bytes()), 0.0001) if not isolated else 0.0,
					"darkening_level": snappedf(float(dk.level), 0.0001) if dk != null else 0.0,
					"darkening_multiplier": snappedf(float(dk.multiplier()), 0.0001) if dk != null else 1.0,
				})
			else:
				_verify(false, "frame %d of skill %03d (%s) saved" % [t, sid, mode])
		elif t % 10 == 0:
			await get_tree().process_frame

	_verify(peak_fx > 0, "native effects were live on the real map (skill %03d, %s)" % [sid, mode])
	if mode == "coverage" or darkened:
		_verify(_uncovered_fraction(stage.scene_bytes()) > 0.0 or peak_fx == 0,
			"coverage composite leaves unpainted pixels transparent (skill %03d, %s)" % [sid, mode])
	if darkened:
		_verify(peak_level > 0.999, "darkening reaches full level on the real map (skill %03d)" % sid)
		dk.restore()
		var restored: bool = true
		for i in range(map_layers.size()):
			restored = restored and (map_layers[i] as CanvasItem).modulate == base_colors[i]
		_verify(restored, "darkening restores the original map modulate exactly (skill %03d)" % sid)
	print("GOLD93_VENOM_REAL_MAP skill %03d %s | shots %d | peak_fx %d | live_fx_end %d | darkening_peak %.3f" % [
		sid, mode, shots_saved, peak_fx, int(stage.live_counts()["fx"]), peak_level])
	stage.dispose()
	holder.queue_free()
	if viewport != null:
		viewport.queue_free()
	await get_tree().process_frame
	return {"shots": shots_saved, "expected": (run["checkpoints"] as Array).size()}


func _uncovered_fraction(bytes: PackedByteArray) -> float:
	var n: int = bytes.size() / 4
	if n == 0:
		return 0.0
	var zero: int = 0
	var i: int = 3
	while i < bytes.size():
		if bytes[i] == 0:
			zero += 1
		i += 4
	return float(zero) / float(n)


func _write_unavailable_original(folder: String, sid: int) -> void:
	var f := FileAccess.open(folder.path_join("s%03d_gold_original_UNAVAILABLE.txt" % sid), FileAccess.WRITE)
	if f != null:
		f.store_string(ORIGINAL_UNAVAILABLE + "\n")
		f.close()
	_index.append({"skill": sid, "mode": "gold_original", "status": "UNAVAILABLE", "reason": ORIGINAL_UNAVAILABLE})


func _write_index(folder: String) -> void:
	var f := FileAccess.open(folder.path_join("ab_index.json"), FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify({
			"schema": "gold93/venom-real-map-ab/v1",
			"presentation_only": true,
			"gold_visual_comparison": "UNAVAILABLE",
			"owner_visual_approved": false,
			"views": {"A": "original GOLD (unavailable)", "B": "gold_isolated", "C": "legacy_additive", "D": "coverage", "E": "coverage_darkened"},
			"records": _index,
		}, "  "))
		f.close()
