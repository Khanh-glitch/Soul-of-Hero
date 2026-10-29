extends "res://tests/chapter_1_campaign_level_visual_capture.gd"

## Venomwright 006 / 010 native pilot on the REAL Chapter 1 Level 2 map.
##
## Runs inside the production AppFlow capture harness (the same harness the S01
## real-map integration uses). The real Knight, real Camera2D, real TileMaps
## and real enemies are untouched. The native venom world is anchored on the
## Knight and its effects are added onto the map with additive blending.
##
## Non-goals stated explicitly: the venom formation enemies are the native
## pilot's own virtual actors, not the map's enemies, and this is not a
## gameplay-damage integration and not a GOLD renderer comparison.

const STAGE = preload("res://prototypes/skill_readiness/pilot/venom_pilot_stage.gd")
const OUT_DIR := "res://.artifacts/venom_real_map"
## Per-skill evidence plan. 006: its full recorded timeline (385 ticks) and the
## start of its aftermath. 010: the full recorded timeline (840 ticks).
const RUNS: Array = [
	{"skill": 6, "last": 420, "shots": [1, 30, 70, 120, 180, 260, 340]},
	{"skill": 10, "last": 840, "shots": [1, 120, 300, 480, 600, 720, 840]},
]

var _real_map_failures: int = 0


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
	_verify(baseline != null and baseline.save_png(folder.path_join("l2_baseline_no_vfx.png")) == OK,
		"baseline frame of the untouched real map")

	var total_shots: int = 0
	var expected_shots: int = 0
	var skills_done: Array = []
	for run in RUNS:
		var r: Dictionary = await _run_skill(game, knight, level, folder, run)
		total_shots += int(r["shots"])
		expected_shots += int(r["expected"])
		skills_done.append(int(run["skill"]))
	_verify(total_shots == expected_shots, "every checkpoint frame captured from the live viewport")
	_verify(knight.is_inside_tree(), "real Knight still in the live tree")
	_verify(level.geometry.get_used_cells().size() > 0, "real map collision survives the overlay")
	var verdict: String = "PASS" if _real_map_failures == 0 else "FAIL"
	var ids: String = ""
	for sid in skills_done:
		ids += ("" if ids.is_empty() else ",") + ("%03d" % int(sid))
	print("GOLD93_VENOM_REAL_MAP: %s | skills %s | real AppFlow Level2 | shots %d/%d | failures %d" % [
		verdict, ids, total_shots, expected_shots, _real_map_failures])


func _run_skill(game: Node2D, knight: CharacterBody2D, level: DungeonLevel, folder: String, run: Dictionary) -> Dictionary:
	var sid: int = int(run["skill"])
	var shots: Array = run["shots"]
	var stage = STAGE.new()
	_verify(stage.start(sid, true), "native pilot stage starts in overlay mode (skill %03d)" % sid)
	if not stage.overlay:
		return {"shots": 0, "expected": shots.size()}

	var additive := CanvasItemMaterial.new()
	additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	var root := Node2D.new()
	root.name = "NativeVenomPilot_%03d" % sid
	# Venom world units are map pixels (world 600x340, raster 1200x680 at k=2, sprite scale 0.5).
	root.position = knight.global_position - stage.player_xy()
	game.add_child(root)
	var scene_sprite := Sprite2D.new()
	scene_sprite.name = "NativeSceneEffects"
	scene_sprite.centered = false
	scene_sprite.scale = Vector2(0.5, 0.5)
	scene_sprite.material = additive
	root.add_child(scene_sprite)
	var glow_sprite := Sprite2D.new()
	glow_sprite.name = "NativeGlow"
	glow_sprite.centered = false
	glow_sprite.scale = Vector2(0.5, 0.5)
	glow_sprite.material = additive
	root.add_child(glow_sprite)

	var shots_saved: int = 0
	var peak_fx: int = 0
	var last: int = int(run["last"])
	for t in range(1, last + 1):
		stage.advance(1)
		var live: Dictionary = stage.live_counts()
		peak_fx = maxi(peak_fx, int(live["fx"]))
		scene_sprite.texture = ImageTexture.create_from_image(stage.scene_image())
		glow_sprite.texture = ImageTexture.create_from_image(stage.glow_image())
		if shots.has(t):
			await RenderingServer.frame_post_draw
			var shot: Image = get_viewport().get_texture().get_image()
			if shot != null and shot.save_png(folder.path_join("l2_venom_%03d_t%04d.png" % [sid, t])) == OK:
				shots_saved += 1
			else:
				_verify(false, "frame %d of skill %03d saved" % [t, sid])
		elif t % 10 == 0:
			await get_tree().process_frame

	_verify(peak_fx > 0, "native effects were live on the real map (skill %03d)" % sid)
	print("GOLD93_VENOM_REAL_MAP skill %03d | shots %d | peak_fx %d | live_fx_end %d" % [sid, shots_saved, peak_fx, int(stage.live_counts()["fx"])])
	root.queue_free()
	await get_tree().process_frame
	return {"shots": shots_saved, "expected": shots.size()}
