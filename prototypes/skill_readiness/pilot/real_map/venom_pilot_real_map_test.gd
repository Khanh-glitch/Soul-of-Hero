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
const SKILL_ID: int = 6
const SHOT_TICKS: Array = [1, 30, 70, 120, 180, 260, 340]
const LAST_TICK: int = 360

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

	var stage = STAGE.new()
	_verify(stage.start(SKILL_ID, true), "native pilot stage starts in overlay mode")
	if not stage.overlay:
		_real_map_failures += 1
		return

	var additive := CanvasItemMaterial.new()
	additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	var root := Node2D.new()
	root.name = "NativeVenomPilotOnRealMap"
	# Venom world coordinates map 1:1 onto map pixels, with the caster on the Knight.
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
	for t in range(1, LAST_TICK + 1):
		stage.advance(1)
		var live: Dictionary = stage.live_counts()
		peak_fx = maxi(peak_fx, int(live["fx"]))
		scene_sprite.texture = ImageTexture.create_from_image(stage.scene_image())
		glow_sprite.texture = ImageTexture.create_from_image(stage.glow_image())
		if SHOT_TICKS.has(t):
			await RenderingServer.frame_post_draw
			var shot: Image = get_viewport().get_texture().get_image()
			if shot != null and shot.save_png(folder.path_join("l2_venom_%03d_t%04d.png" % [SKILL_ID, t])) == OK:
				shots_saved += 1
			else:
				_verify(false, "frame %d saved" % t)
		elif t % 10 == 0:
			await get_tree().process_frame

	_verify(shots_saved == SHOT_TICKS.size(), "every checkpoint frame captured from the live viewport")
	_verify(peak_fx > 0, "native effects were live on the real map")
	_verify(level.geometry.get_used_cells().size() > 0, "real map collision survives the overlay")
	_verify(knight.is_inside_tree(), "real Knight still in the live tree")
	var verdict: String = "PASS" if _real_map_failures == 0 else "FAIL"
	print("GOLD93_VENOM_REAL_MAP: %s | skill %03d | real AppFlow Level2 | shots %d | peak_fx %d | failures %d" % [
		verdict, SKILL_ID, shots_saved, peak_fx, _real_map_failures])
